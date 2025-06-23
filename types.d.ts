import { DateTime } from "luxon";
import type { Duration } from "luxon";

/**
 * Represents a candlestick with open, close, high, and low values
 */
export type Candlestick = {
  open: number;
  close: number;
  high: number;
  low: number;
  mean: number;
  openAt: DateTime;
  closeAt: DateTime;
};

export type BucketConfig = {
  name: string;
  bucketDuration: Duration;
};

export type Bucket = BucketConfig & {
  candlesticks: R.NonEmptyArray<Candlestick>;
};

export type Sample = {
  dateTime: DateTime;
  value: number;
};

export type Candelabra = {
  samples: R.NonEmptyArray<Sample>;
  buckets: R.NonEmptyArray<Bucket>;
  eternal: Candlestick;
};
