/**
 * Represents a candlestick with open, close, high, and low values
 */
export interface Candlestick {
  open: number;
  close: number;
  high: number;
  low: number;
}

/**
 * Represents an accumulator that holds candlesticks for different time windows
 */
export interface Accumulator {
  oneSample: R.NonEmptyArray<Candlestick>;
  allTime: Candlestick;
  [key: string]: R.NonEmptyArray<Candlestick> | Candlestick;
}

export interface Tier {
  granularity: string;
  selector: (accumulator: Accumulator) => R.NonEmptyArray<Candlestick>;
}