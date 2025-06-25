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
    mean: getMean,
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
  console.log("================addSampleToCandelabra", { sample, candelabra });
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

  console.log("tiers");
  tiers.forEach(observeTier);
  const firstTier = tiers[0];
  const sampleCutoff = firstTier.current?.openAt;
  const samples = R.dropWhile(
    (sample) => sample.dateTime < sampleCutoff,
    sortedSamples,
  ) as R.NonEmptyArray<Sample>;

  console.log("sampleCutoff", sampleCutoff?.toFormat("HH:mm:ss.SSS"));
  console.log("samples", samples);
  console.log("candelabra samples", candelabra.samples);

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
  const [thisTier, ...restTiers] = tiers;
  const newestSample = R.last(samples);
  const newestSampleCandlestick = toCandlestick(newestSample);
  const oldestSample = R.head(samples);

  // does the distance between the openAt of the oldest candlestick in this tier's history and the newest sample candlestick's closeAt exceed this tier's duration?
  const currentTierDuration = thisTier.duration;
  const oldestCandlestick = R.head(thisTier.history);
  const openAt = oldestCandlestick?.openAt || oldestSample.dateTime;
  const distance = newestSample.dateTime.diff(openAt, "milliseconds")
    .as(
      "milliseconds",
    );
  const distanceExceedsDuration =
    distance > currentTierDuration.as("milliseconds");
  console.log("processSamples", {
    currentTierDuration,
    oldestCandlestick,
    oldestCandlestickOpenAt: oldestCandlestick?.openAt,
    newestSampleDateTime: newestSample.dateTime,
    distance,
    distanceExceedsDuration,
    newestSampleCloseAt: newestSample.dateTime,
  });
  if (distanceExceedsDuration) {
    // newest sample's time means we should historize "current"
    const newHistoricalCandlestick = historizeCandlestick(
      thisTier.current,
      thisTier.duration,
    );
    // the current openAt is either the last history's closeAt or, if this is the first sample, that sample's datetime
    const currentOpenAt = newHistoricalCandlestick?.closeAt ||
      newestSample.dateTime;
    if (R.isEmpty(restTiers)) {
      console.log("leaf node, new bucket");
      // if the newest sample should result in the current candlestick being historized
      // and there are no tiers to cascade to
      // then return this tier with the current candlestick
      // and set newest sample candlestick as eternal
      // and set the samples to just the newest sample
      const eternal = reduceCandlesticks([
        thisTier.current,
        newestSampleCandlestick,
      ]);
      const newCurrent = {
        ...newestSampleCandlestick,
        openAt: currentOpenAt,
      };
      const history = [newHistoricalCandlestick]; // todo do we need this? eternal should handle history in this case
      return {
        tiers: [{
          ...thisTier,
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
      const history = [...thisTier.history, newHistoricalCandlestick];
      const newCurrentTier = {
        ...thisTier,
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
      thisTier.current,
      newestSampleCandlestick,
    ]);
    const newCurrentTier = { ...thisTier, current: newCurrentCandlestick };
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
    (candelabra, sample) => addSampleToCandelabra(sample, candelabra),
    initialCandelabra,
    samples,
  );
}

function observeTier(tier: Tier): void {
  console.log(`====== name: ${tier.name} ======`);
  console.log("current");
  renderSmartCandlesticks([tier.current], tier.duration);
  console.log("history");
  renderSmartCandlesticks(tier.history || [], tier.duration);
  console.log("====== end tier ======");
}
