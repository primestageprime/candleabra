import type {NonEmptyArray} from "npm:@types/ramda"
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
  atomicSamples: NonEmptyArray<Candlestick>;
  allSamples: NonEmptyArray<Candlestick>;
  [key: string]: NonEmptyArray<Candlestick>;
}
