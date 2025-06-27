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

export type TierConfig = {
  name: string;
  duration: Duration;
};

export type Tier = TierConfig & {
  history: Candlestick[];
  current: Candlestick;
};

export type Sample = {
  dateTime: DateTime;
  value: number;
};

export type Candelabra = {
  samples: R.NonEmptyArray<Sample>; // todo replace with lastProcessedDateTime
  tiers: R.NonEmptyArray<Tier>;
  eternal: Candlestick;
};
