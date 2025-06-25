import * as R from "ramda";
import type { NonEmptyArray } from "npm:@types/ramda@0.30.2";
import type {
  Candelabra,
  Candlestick,
  Sample,
  Tier,
  TierConfig,
} from "./types.d.ts";
import {
  getClose,
  getCloseAt,
  getHigh,
  getLow,
  getMean,
  getOpen,
  getOpenAt,
  getTimeWeightedMean,
} from "./utils.ts";
import { DateTime, Duration } from "luxon";
import { renderSmartCandlesticks } from "./renderCandlesticks.ts";

// Re-export types
export * from "./types.d.ts";

export interface GridData {
  start: string;
  duration: string;
  end: string;
  open: string;
  mean: string;
  close: string;
  low: string;
}

export const reduceCandlesticks: (
  list: NonEmptyArray<Candlestick>,
) => Candlestick = R.pipe(
  // Sort candlesticks by datetime to ensure proper chronological order
  R.sortBy((c: Candlestick) => c.openAt.toMillis()),
  R.applySpec<Candlestick>({
    open: getOpen,
    close: getClose,
    high: getHigh,
    low: getLow,
    mean: getTimeWeightedMean,
    openAt: getOpenAt,
    closeAt: getCloseAt,
  }),
);

export const toCandlestick: (sample: Sample) => Candlestick = (sample) => {
  return {
    open: sample.value,
    close: sample.value,
    high: sample.value,
    low: sample.value,
    mean: sample.value,
    openAt: sample.dateTime,
    closeAt: sample.dateTime,
  };
};

export const toTier = (
  tierConfig: TierConfig,
  candlestick: Candlestick,
): Tier => {
  return {
    ...tierConfig,
    history: [],
    current: candlestick,
  };
};
export function toSample(value: number, dateTime: DateTime): Sample {
  return { dateTime, value };
}

export function toCandelabra(
  sample: Sample,
  tierConfigs: R.NonEmptyArray<TierConfig>,
): Candelabra {
  const initialCandlestick: Candlestick = toCandlestick(sample);
  const tiers: R.NonEmptyArray<Tier> = R.map(
    (config) => toTier(config, initialCandlestick),
    tierConfigs,
  ) as R.NonEmptyArray<Tier>;
  return {
    samples: [sample],
    tiers: tiers,
    eternal: initialCandlestick,
  };
}

export function addSampleToCandelabra(
  sample: Sample,
  candelabra: Candelabra,
): Candelabra {
  console.log("================addSampleToCandelabra=================");
  console.log("sample");
  renderSamples([sample]);
  console.log("candelabra");
  renderCandelabra(candelabra);
  // Get the latest sample's datetime
  const latestSample = R.last(candelabra.samples);
  if (!latestSample) {
    // If no samples exist, just add the new one
    return {
      samples: [sample],
      tiers: R.map(
        (tier) => ({
          ...tier,
          current: toCandlestick(sample),
        }),
        candelabra.tiers,
      ) as R.NonEmptyArray<Tier>,
      eternal: toCandlestick(sample),
    };
  }

  // Get the first tier's duration (smallest granularity)
  const firstTierDuration = candelabra.tiers[0].duration;

  // Calculate the cutoff time: latest sample time minus first tier duration
  const cutoffTime = latestSample.dateTime.minus(firstTierDuration);

  // If the new sample is too old, ignore it
  if (sample.dateTime < cutoffTime) {
    return candelabra;
  }

  // Check if a sample with the same dateTime exists and find its index
  const existingIndex = R.findIndex(
    (existingSample) => existingSample.dateTime.equals(sample.dateTime),
    candelabra.samples,
  );

  // Update samples based on whether we need to upsert or append
  const updatedSamples = existingIndex >= 0
    ? R.adjust(
      existingIndex,
      () => sample,
      candelabra.samples,
    ) as R.NonEmptyArray<Sample>
    : R.append(sample, candelabra.samples) as R.NonEmptyArray<Sample>;

  // Sort samples by datetime (ascending, oldest first) for aggregates
  const sortedSamples = R.sort(
    (a: Sample, b: Sample) => a.dateTime.toMillis() - b.dateTime.toMillis(),
    updatedSamples,
  ) as R.NonEmptyArray<Sample>;

  const { tiers, eternal } = processSamples(
    candelabra.tiers,
    sortedSamples,
  );

  // console.log("tiers");
  // tiers.forEach(renderTier);
  const firstTier = tiers[0];
  const sampleCutoff = firstTier.current?.openAt;
  const samples = R.dropWhile(
    (sample) => sample.dateTime < sampleCutoff,
    sortedSamples,
  ) as R.NonEmptyArray<Sample>;

  return {
    samples,
    tiers: tiers,
    eternal,
  };
}

export function samplesToCandlestick(
  samples: R.NonEmptyArray<Sample>,
): Candlestick {
  const updatedCandlesticks = R.map(
    toCandlestick,
    samples,
  ) as R.NonEmptyArray<Candlestick>;
  return reduceCandlesticks(updatedCandlesticks);
}

export function processSamples(
  tiers: R.NonEmptyArray<Tier>,
  samples: R.NonEmptyArray<Sample>,
): {
  tiers: R.NonEmptyArray<Tier>;
  eternal: Candlestick;
} {
  const [tier, ...restTiers] = tiers;
  const sampleCandlesticks: R.NonEmptyArray<Candlestick> = R.map(
    toCandlestick,
    samples,
  ) as R.NonEmptyArray<Candlestick>;
  const currentCandlestick = reduceCandlesticks(sampleCandlesticks);
  const newestSample = R.last(samples);
  const newestSampleCandlestick = toCandlestick(newestSample);
  const oldestSample = R.head(samples);

  const distance = getDistance(
    R.head(tier.history),
    oldestSample.dateTime,
    newestSample.dateTime,
  );
  console.log(`distance: ${distance.as("seconds")}`);
  const distanceExceedsTierDuration =
    distance > tier.duration.as("milliseconds");
  if (distanceExceedsTierDuration) {
    // newest sample's time means we should historize "current"
    const newHistoricalCandlestick = historizeCandlestick(
      tier.current,
      tier.duration,
    );
    // the current openAt is either the last history's closeAt or, if this is the first sample, that sample's datetime
    const currentOpenAt = newHistoricalCandlestick?.closeAt ||
      currentCandlestick.closeAt;

    const howManyCurrentTierDurationsSinceLastSample = Math.floor(
      distance / tier.duration.as("milliseconds"),
    );
    const historicalCandlesticks = toHistoricalCandlesticks(
      newHistoricalCandlestick,
      tier.duration,
      howManyCurrentTierDurationsSinceLastSample,
    );
    console.log(
      "newHistoricalCandlesticks",
      JSON.stringify(historicalCandlesticks),
    );
    if (R.isEmpty(restTiers)) {
      console.log("leaf node, new bucket");
      // if the newest sample should result in the current candlestick being historized
      // and there are no tiers to cascade to
      // then return this tier with the current candlestick
      // and set newest sample candlestick as eternal
      // and set the samples to just the newest sample

      const eternal = reduceCandlesticks([
        tier.current,
        newestSampleCandlestick,
      ]);
      // console.log(
      //   `newestSampleCandlestick: ${JSON.stringify(newestSampleCandlestick)}`,
      // );
      // console.log("thisTier.current");
      // renderSmartCandlesticks(
      //   [thisTier.current],
      //   thisTier.current.closeAt.diff(thisTier.current.openAt),
      // );
      // console.log("newestSampleCandlestick");
      // renderSmartCandlesticks([newestSampleCandlestick], thisTier.duration);
      // console.log("eternal");
      // renderSmartCandlesticks(
      //   [eternal],
      //   newestSampleCandlestick.closeAt.diff(
      //     tiers?.[0]?.history?.[0]?.openAt || Duration.fromMillis(0),
      //   ).as("seconds"),
      // );
      const newCurrent = {
        ...newestSampleCandlestick,
        openAt: currentOpenAt,
      };
      const history = [...historicalCandlesticks]; // todo do we need this? eternal should handle history in this case
      return {
        tiers: [{
          ...tier,
          history,
          current: newCurrent,
        }],
        eternal,
      };
    } else {
      console.log("branch, new bucket");
      // if the newest sample should result in this tier's current candlestick being historized
      // and there are other tiers to cascade to
      // then recurse into the rest of the tiers
      // and set the samples to just the newest sample
      const recursed = processSamples(
        restTiers as NonEmptyArray<Tier>,
        samples,
      );
      const history = [...tier.history, ...historicalCandlesticks];
      const newCurrentTier = {
        ...tier,
        history,
        current: newestSampleCandlestick,
      };
      return {
        tiers: [newCurrentTier, ...recursed.tiers],
        eternal: recursed.eternal,
      };
    }
  } else {
    console.log("leaf node, no new bucket");
    const newCurrentCandlestick = reduceCandlesticks([
      tier.current,
      newestSampleCandlestick,
    ]);
    const newCurrentTier = { ...tier, current: newCurrentCandlestick };
    if (R.isEmpty(restTiers)) {
      // if the newest sample should not result in this tier's current candlestick being historized
      // and there are no other tiers to cascade to
      // then just update the new current candlestick
      return {
        tiers: [newCurrentTier],
        eternal: newCurrentCandlestick,
      };
    } else {
      console.log("branch, no new bucket");
      // if the newest sample should not result in this tier's current candlestick being historized
      // and there are other tiers to cascade to
      // then just update the new current candlestick and process the rest of the tiers
      // (which should also just update their current candlesticks)
      const recursed = processSamples(
        restTiers as NonEmptyArray<Tier>,
        samples,
      );
      return {
        tiers: [newCurrentTier, ...recursed.tiers],
        eternal: recursed.eternal,
      };
    }
  }
}

export function getDistance(
  lastHistoricalCandlestick: Candlestick | undefined,
  oldestSampleDateTime: DateTime,
  newestSampleDateTime: DateTime,
): Duration {
  const openAt = lastHistoricalCandlestick?.closeAt || oldestSampleDateTime;
  return newestSampleDateTime.diff(openAt, "milliseconds");
}

export function historizeCandlestick(
  candlestick: Candlestick,
  duration: Duration,
): Candlestick {
  return {
    ...candlestick,
    // historized candlesticks should be fixed to the size of the duration after openAt
    closeAt: candlestick.openAt.plus(duration),
  };
}

export function addSamplesToCandelabra(
  samples: R.NonEmptyArray<Sample>,
  initialCandelabra: Candelabra,
): Candelabra {
  return R.reduce(
    (candelabra, sample) => {
      console.log("!!!calling addSampleToCandelabra!!!");
      return addSampleToCandelabra(sample, candelabra);
    },
    initialCandelabra,
    samples,
  );
}

function renderTier(tier: Tier): void {
  console.log(`====== name: ${tier.name} ======`);
  console.log("current");
  renderSmartCandlesticks([tier.current], tier.duration);
  console.log("history");
  renderSmartCandlesticks(tier.history || [], tier.duration);
  console.log(`====== end tier: ${tier.name} ======`);
}

function renderCandelabra(candelabra: Candelabra): void {
  console.log("====== candelabra ======");
  console.log("samples:");
  renderSamples(candelabra.samples);
  console.log("eternal:");
  renderSmartCandlesticks(
    [candelabra.eternal],
    candelabra.eternal.closeAt.diff(candelabra.eternal.openAt),
  );
  console.log("tiers:");
  candelabra.tiers.forEach(renderTier);
  console.log("====== end candelabra ======");
}

function renderSamples(samples: R.NonEmptyArray<Sample>): void {
  renderSmartCandlesticks(
    R.map(toCandlestick, samples),
    Duration.fromMillis(1),
  );
}

export function toHistoricalCandlesticks(
  candlestick: Candlestick,
  duration: Duration,
  numToGenerate: number,
): R.NonEmptyArray<Candlestick> {
  const syntheticCandlesticks = (numToGenerate > 1)
    ? R.range(
      0,
      numToGenerate,
    ).map((i) => {
      return {
        ...candlestick,
        openAt: candlestick.openAt.plus({
          milliseconds: i * duration.as("milliseconds"),
        }),
        closeAt: candlestick.closeAt.plus({
          milliseconds: (i + 1) * duration.as("milliseconds"),
        }),
      };
    }) as R.NonEmptyArray<Candlestick>
    : [];
  return R.append(candlestick, syntheticCandlesticks) as R.NonEmptyArray<
    Candlestick
  >;
}
