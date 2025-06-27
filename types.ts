import { DateTime, Duration } from "luxon";

export type Sample = {
  dateTime: DateTime;
  value: number;
};

export type Candlestick = {
  open: number;
  close: number;
  high: number;
  low: number;
  mean: number;
  openAt: DateTime;
  closeAt: DateTime;
};

export type Granularity = {
  name: string;
  duration: Duration;
};

export type TierState = {
  granularity: Granularity;
  current: Candlestick | null;
  history: Candlestick[];
  samples: Sample[];
};

export type ProcessorState = {
  tiers: TierState[];
  atomicSamples: Sample[];
};

export type ProcessingResult = {
  atomics: Sample[];
  tierResults: Candlestick[];
  updatedState: ProcessorState;
};

export type GranularityConfig = string[]; // e.g., ["1m", "5m", "1h", "1d"] 