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

/**
 * Creates a candlestick from a single sample
 */
export function toCandlestick(sample: Sample): Candlestick {
  return {
    open: sample.value,
    close: sample.value,
    high: sample.value,
    low: sample.value,
    mean: sample.value,
    openAt: sample.dateTime,
    closeAt: sample.dateTime,
  };
}

/**
 * Creates a sample from a value and datetime
 */
export function toSample(value: number, dateTime: DateTime): Sample {
  return { dateTime, value };
}

/**
 * Calculates time-weighted mean from a list of samples
 */
export function calculateTimeWeightedMean(samples: Sample[]): number {
  if (samples.length === 1) {
    return samples[0].value;
  }
  
  let totalWeightedValue = 0;
  let totalDuration = 0;
  
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    let duration: number;
    
    if (i === samples.length - 1) {
      // Last sample - duration is 0 (instantaneous)
      duration = 0;
    } else {
      // Duration from this sample to the next sample
      const nextSample = samples[i + 1];
      duration = nextSample.dateTime.diff(sample.dateTime, "milliseconds").as("milliseconds");
    }
    
    totalWeightedValue += sample.value * duration;
    totalDuration += duration;
  }
  
  // If no duration, return simple average
  if (totalDuration === 0) {
    return samples.reduce((sum, s) => sum + s.value, 0) / samples.length;
  }
  
  return totalWeightedValue / totalDuration;
}

/**
 * Creates a candlestick from a list of samples with proper OHLC values
 */
export function samplesToCandlestick(samples: Sample[], openAt: DateTime, closeAt: DateTime): Candlestick {
  if (samples.length === 0) {
    throw new Error("Cannot create candlestick from empty samples");
  }
  
  const values = R.map(R.prop('value'), samples);
  
  return {
    open: R.head(values)!,
    close: R.last(values)!,
    high: Math.max(...values),
    low: Math.min(...values),
    mean: calculateTimeWeightedMean(samples),
    openAt,
    closeAt,
  };
}

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

  const { tiers, eternal } = processSamples(
    candelabra.tiers,
    sortedSamples,
  );

  const newFirstTier = tiers[0];
  const myFirstTierDuration = newFirstTier.duration;
  const sampleCutoff = newFirstTier.current.openAt;
  const samples = R.dropWhile(
    (sample) => sample.dateTime < sampleCutoff,
    sortedSamples,
  ) as R.NonEmptyArray<Sample>;

  console.log("sampleCutoff", sampleCutoff);
  console.log("samples", samples);
  console.log("candelabra samples", candelabra.samples);

  return {
    samples,
    tiers: tiers,
    eternal,
  };
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

  // does the distance between the openAt of the oldest candlestick in this tier's history and the newest sample candlestick's closeAt exceed this tier's duration?
  const currentTierDuration = thisTier.duration;
  const oldestCandlestick = R.head(thisTier.history);
  const openAt = oldestCandlestick?.openAt || newestSample.dateTime;
  const distance = newestSample.dateTime.diff(openAt, "milliseconds")
    .as(
      "milliseconds",
    );
  const distanceExceedsDuration =
    distance > currentTierDuration.as("milliseconds");
  console.log({
    currentTierDuration,
    oldestCandlestick,
    oldestCandlestickOpenAt: oldestCandlestick?.openAt,
    newestSampleDateTime: newestSample.dateTime,
    distance,
    distanceExceedsDuration,
  });
  if (distanceExceedsDuration) {
    if (R.isEmpty(restTiers)) {
      console.log("leaf node, new bucket");
      // if the newest sample should result in the current candlestick being historized
      // and there are no tiers to cascade to
      // then return this tier with the current candlestick
      // and set newest sample candlestick as eternal
      // and set the samples to just the newest sample
      return {
        tiers: [{
          ...thisTier,
          history: [], // don't need any history b/c eternal candlestick will serve as history
          current: newestSampleCandlestick,
        }],
        eternal: newestSampleCandlestick,
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
      const history = [...thisTier.history, newestSampleCandlestick];
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
