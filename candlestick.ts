import * as R from "ramda";
import type { NonEmptyArray } from "npm:@types/ramda@0.30.2";
import type {
  Bucket,
  BucketConfig,
  Candelabra,
  Candlestick,
  Sample,
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

export const toBucket = (
  bucketConfig: BucketConfig,
  candlestick: Candlestick,
) => {
  return {
    ...bucketConfig,
    candlesticks: [reduceCandlesticks([candlestick])],
  };
};
export function toSample(value: number, dateTime: DateTime): Sample {
  return { dateTime, value };
}

export function toCandelabra(
  sample: Sample,
  bucketConfigs: R.NonEmptyArray<BucketConfig>,
): Candelabra {
  const initialCandlestick: Candlestick = toCandlestick(sample);
  const buckets: R.NonEmptyArray<Bucket> = R.map(
    (bucketConfig) => toBucket(bucketConfig, initialCandlestick),
    bucketConfigs,
  ) as R.NonEmptyArray<Bucket>;
  return {
    samples: [sample],
    buckets: buckets,
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
      buckets: R.map(
        (bucket) => ({
          ...bucket,
          candlesticks: [toCandlestick(sample)] as R.NonEmptyArray<Candlestick>,
        }),
        candelabra.buckets,
      ) as R.NonEmptyArray<Bucket>,
      eternal: toCandlestick(sample),
    };
  }

  // Get the first bucket's duration (smallest granularity)
  const firstBucketDuration = candelabra.buckets[0].bucketDuration;

  // Calculate the cutoff time: latest sample time minus first bucket duration
  const cutoffTime = latestSample.dateTime.minus(firstBucketDuration);

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

  // Recalculate all candlesticks from sortedSamples
  const updatedCandlesticks = R.map(
    toCandlestick,
    sortedSamples,
  ) as R.NonEmptyArray<Candlestick>;

  const updatedBuckets = R.map(
    (bucket) => ({
      ...bucket,
      candlesticks: [
        reduceCandlesticks(updatedCandlesticks),
      ] as R.NonEmptyArray<Candlestick>,
    }),
    candelabra.buckets,
  ) as R.NonEmptyArray<Bucket>;

  const updatedEternal = reduceCandlesticks(updatedCandlesticks);

  return {
    samples: sortedSamples,
    buckets: updatedBuckets,
    eternal: updatedEternal,
  };
}
