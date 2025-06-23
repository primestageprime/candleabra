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
) => Candlestick = R.applySpec<Candlestick>({
  open: getOpen,
  close: getClose,
  high: getHigh,
  low: getLow,
  mean: getMean,
  openAt: getOpenAt,
  closeAt: getCloseAt,
});

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
  // Check if a sample with the same dateTime exists
  const hasSameDateTime = R.any(
    (existingSample) => existingSample.dateTime.equals(sample.dateTime),
    candelabra.samples,
  );

  let updatedSamples: R.NonEmptyArray<Sample>;
  if (hasSameDateTime) {
    // Replace the sample with the same dateTime (upsert)
    const replaced = R.map(
      (existingSample) =>
        existingSample.dateTime.equals(sample.dateTime)
          ? sample
          : existingSample,
      candelabra.samples,
    );
    // Remove duplicates in case there are multiple with the same dateTime (shouldn't happen, but for safety)
    const unique = R.uniqBy((s: Sample) => s.dateTime.toISO(), replaced);
    updatedSamples = unique as R.NonEmptyArray<Sample>;
  } else {
    // Otherwise, append as before
    updatedSamples = R.append(sample, candelabra.samples) as R.NonEmptyArray<
      Sample
    >;
  }

  // Recalculate all candlesticks from updatedSamples
  const updatedCandlesticks = R.map(
    toCandlestick,
    updatedSamples,
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
    samples: updatedSamples,
    buckets: updatedBuckets,
    eternal: updatedEternal,
  };
}
