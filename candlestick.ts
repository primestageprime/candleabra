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
import {
  fifteenMinuteish,
  fiveMinuteish,
  hourish,
  LARGEST_GRANULARITY,
  minuteish,
  SMALLEST_GRANULARITY,
} from "./constants.ts";
import { DateTime } from "luxon";

// Re-export types
export * from "./types.d.ts";

export {
  fifteenMinuteish,
  fiveMinuteish,
  hourish,
  LARGEST_GRANULARITY,
  minuteish,
  SMALLEST_GRANULARITY,
};

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
    atomic: [sample],
    buckets: buckets,
    eternal: initialCandlestick,
  };
}
