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
import { DateTime } from "luxon";

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
  const firstTier = candelabra.tiers[0];
  const firstTierDuration = firstTier.duration;

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

  // Recalculate current candlestick from sortedSamples
  const currentCandlestick = samplesToCandlestick(sortedSamples);

  const { tiers, longestTierCandlestick } = cascadeCurrentCandlestick(
    candelabra.tiers,
    currentCandlestick,
  );

  return {
    ...candelabra,
    samples: sortedSamples,
    tiers: tiers,
    eternal: longestTierCandlestick,
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

export function cascadeCurrentCandlestick(
  tiers: R.NonEmptyArray<Tier>,
  currentCandlestick: Candlestick,
): { tiers: R.NonEmptyArray<Tier>; longestTierCandlestick: Candlestick } {
  const [currentTier, ...restTiers] = tiers;
  // does the distance between the oldest candlestick in my tier's history and the current candlestick's closeAt exceed my duration?
  const currentTierDuration = currentTier.duration;
  const oldestCandlestick = R.head(currentTier.history);
  const openAt = oldestCandlestick?.openAt || currentCandlestick.openAt;
  const distance = currentCandlestick.closeAt.diff(openAt, "milliseconds").as(
    "milliseconds",
  );
  const distanceExceedsDuration =
    distance > currentTierDuration.as("milliseconds");
  if (distanceExceedsDuration) {
    if (R.isEmpty(restTiers)) {
      // base case / leaf node; no other tiers to process
      const longestTierCandlestick = R.isEmpty(currentTier.history)
        ? currentCandlestick
        : reduceCandlesticks(currentTier.history as NonEmptyArray<Candlestick>);
      return {
        tiers: [{
          ...currentTier,
          current: currentCandlestick,
          history: [],
        }],
        longestTierCandlestick,
      };
    } else {
      // other tiers to process
      const recursed = cascadeCurrentCandlestick(
        restTiers as NonEmptyArray<Tier>,
        currentCandlestick,
      );
      const newCurrentTier = {
        ...currentTier,
        history: [],
        current: currentCandlestick,
      };
      return {
        tiers: [newCurrentTier, ...recursed.tiers],
        longestTierCandlestick: recursed.longestTierCandlestick,
      };
    }
  } else {
    // no other tiers to process
    if (R.isEmpty(restTiers)) {
      const newCurrentCandlestick = reduceCandlesticks([
        currentTier.current,
        currentCandlestick,
      ]);
      const newCurrentTier = { ...currentTier, current: newCurrentCandlestick };
      return {
        tiers: [newCurrentTier],
        longestTierCandlestick: newCurrentCandlestick,
      };
    } else {
      // other tiers to process
      const recursed = cascadeCurrentCandlestick(
        restTiers as NonEmptyArray<Tier>,
        currentCandlestick,
      );
      const newCurrentCandlestick = reduceCandlesticks([
        currentTier.current,
        currentCandlestick,
      ]);
      const newCurrentTier = { ...currentTier, current: newCurrentCandlestick };
      return {
        tiers: [newCurrentTier, ...recursed.tiers],
        longestTierCandlestick: recursed.longestTierCandlestick,
      };
    }
  }
}

export function cascadeTiers(
  tiers: R.NonEmptyArray<Tier>,
  candlestick: Candlestick,
): R.NonEmptyArray<Tier> {
  return tiers;
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
