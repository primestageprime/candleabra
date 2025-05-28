import type {NonEmptyArray} from "npm:@types/ramda@0.30.2"
import { SMALLEST_GRANULARITY, LARGEST_GRANULARITY } from "./constants.ts"
/**
 * Represents a candlestick with open, close, high, and low values
 */
export type Candlestick = {
  open: number;
  close: number;
  high: number;
  low: number;
}

/**
 * Represents an accumulator that holds candlesticks for different time windows
 */

export type Accumulator = {
  [SMALLEST_GRANULARITY]: NonEmptyArray<Candlestick>;
  [LARGEST_GRANULARITY]: NonEmptyArray<Candlestick>;
  [key: string]: NonEmptyArray<Candlestick>;
}

export type SampleTiers = {
  granularity: string;
  sampleCount: number;
}
