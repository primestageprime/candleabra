// Main exports for the candlestick processing library
export { toCandlestick, reduceCandlesticks, toSample } from "./candlestick.ts";
export { parseGranularity } from "./granularity.ts";
export { createProcessor, processSample, getResults } from "./processor.ts";

// Re-export types for convenience
export type { 
  Candlestick, 
  Sample, 
  Granularity, 
  TierState, 
  ProcessorState,
  ProcessingResult,
  GranularityConfig 
} from "./types.ts"; 