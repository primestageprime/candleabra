import { DateTime, Duration } from "luxon";

/**
 * Represents a single data point with a value and timestamp
 */
export type Sample = {
  dateTime: DateTime;
  value: number;
};

/**
 * Represents a candlestick with open, close, high, low, and mean values
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

/**
 * Represents a time granularity (e.g., "1m", "5m", "1h", "1d")
 */
export type Granularity = {
  name: string;
  duration: Duration;
};

/**
 * Represents the state of a single processing tier
 */
export type TierState = {
  granularity: Granularity;
  current: Candlestick | null;
  history: Candlestick[];
  samples: Sample[];
};

/**
 * Represents the complete state of the multi-tier processor
 */
export type ProcessorState = {
  tiers: TierState[];
  atomicSamples: Sample[];
};

/**
 * Represents the result of processing a single sample
 */
export type ProcessingResult = {
  atomics: Sample[];
  tierResults: Candlestick[];
  updatedState: ProcessorState;
};

/**
 * Configuration for granularities as an array of strings
 * e.g., ["1m", "5m", "1h", "1d"]
 */
export type GranularityConfig = string[]; 