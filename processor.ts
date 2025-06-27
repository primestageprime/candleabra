import { DateTime, Duration } from "luxon";
import * as R from "ramda";
import type { 
  Sample, 
  Candlestick, 
  Granularity, 
  TierState, 
  ProcessorState, 
  ProcessingResult,
  GranularityConfig 
} from "./types.ts";
import { createGranularities, getBucketStart } from "./granularity.ts";
import { toCandlestick, samplesToCandlestick } from "./candlestick.ts";

/**
 * Creates initial processor state from granularity configuration
 */
export function createProcessor(config: GranularityConfig): ProcessorState {
  const granularities = createGranularities(config);
  
  const tiers: TierState[] = R.map(granularity => ({
    granularity,
    current: null,
    history: [],
    samples: [],
  }), granularities);
  
  return {
    tiers,
    atomicSamples: [],
  };
}

/**
 * Prunes atomic samples to keep only those needed for the next 1-minute bucket
 */
export function pruneAtomicSamples(samples: Sample[], latestSample: Sample): Sample[] {
  const oneMinuteDuration = Duration.fromObject({ minutes: 1 });
  const cutoffTime = latestSample.dateTime.minus(oneMinuteDuration);
  return R.filter(sample => sample.dateTime >= cutoffTime, samples);
}

/**
 * Processes a single tier with a new sample
 */
export function processTier(tier: TierState, sample: Sample): TierState {
  const { granularity, current, history, samples } = tier;
  const sampleCandlestick = toCandlestick(sample);
  
  if (!current) {
    // First sample for this tier
    const bucketStart = getBucketStart(sample.dateTime, granularity.duration);
    
    return {
      ...tier,
      current: {
        ...sampleCandlestick,
        openAt: bucketStart,
        closeAt: sample.dateTime,
      },
      samples: [sample],
    };
  }
  
  // Check if this sample starts a new bucket
  const bucketStart = getBucketStart(sample.dateTime, granularity.duration);
  const currentBucketStart = getBucketStart(current.openAt, granularity.duration);
  
  if (bucketStart.equals(currentBucketStart)) {
    // Same bucket - update current candlestick
    const updatedSamples = [...samples, sample];
    const updatedCandlestick = samplesToCandlestick(
      updatedSamples,
      current.openAt,
      sample.dateTime
    );
    
    return {
      ...tier,
      current: updatedCandlestick,
      samples: updatedSamples,
    };
  } else {
    // New bucket - historize current and start new
    const bucketEnd = currentBucketStart.plus(granularity.duration);
    const completedCandlestick = {
      ...current,
      closeAt: bucketEnd,
    };
    
    return {
      ...tier,
      current: {
        ...sampleCandlestick,
        openAt: bucketStart,
        closeAt: sample.dateTime,
      },
      history: [...history, completedCandlestick],
      samples: [sample],
    };
  }
}

/**
 * Prunes history for a tier based on what's needed by higher tiers
 */
export function pruneTierHistory(
  tier: TierState, 
  higherTier: TierState | null
): TierState {
  if (!higherTier?.current) {
    return tier;
  }
  
  const higherTierBucketStart = getBucketStart(
    higherTier.current.openAt, 
    higherTier.granularity.duration
  );
  const cutoffTime = higherTierBucketStart.minus(higherTier.granularity.duration);
  
  const prunedHistory = R.filter(
    candlestick => candlestick.closeAt >= cutoffTime,
    tier.history
  );
  
  return {
    ...tier,
    history: prunedHistory,
  };
}

/**
 * Processes all tiers with a new sample
 */
export function processAllTiers(tiers: TierState[], sample: Sample): TierState[] {
  return R.reduce(
    (processedTiers: TierState[], tier: TierState) => {
      const index = processedTiers.length;
      const processedTier = processTier(tier, sample);
      
      // Prune history based on higher tier needs
      const higherTier = index > 0 ? processedTiers[index - 1] : null;
      const prunedTier = pruneTierHistory(processedTier, higherTier);
      
      return [...processedTiers, prunedTier];
    },
    [],
    tiers
  );
}

/**
 * Main processing function - processes a single sample through all tiers
 */
export function processSample(
  state: ProcessorState, 
  sample: Sample
): ProcessingResult {
  // Update atomic samples
  const updatedAtomics = [...state.atomicSamples, sample];
  const prunedAtomics = pruneAtomicSamples(updatedAtomics, sample);
  
  // Process all tiers
  const updatedTiers = processAllTiers(state.tiers, sample);
  
  // Get current results from each tier
  const tierResults = R.chain(
    tier => tier.current ? [tier.current] : [],
    updatedTiers
  );
  
  return {
    atomics: prunedAtomics,
    tierResults,
    updatedState: {
      ...state,
      atomicSamples: prunedAtomics,
      tiers: updatedTiers,
    },
  };
}

/**
 * Gets final results from processor state
 */
export function getResults(state: ProcessorState): Array<{ name: string; candlesticks: Candlestick[] }> {
  return R.map(tier => ({
    name: tier.granularity.name,
    candlesticks: [...tier.history, ...(tier.current ? [tier.current] : [])],
  }), state.tiers);
} 