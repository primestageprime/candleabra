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
 * Prunes atomic samples - drop when closeAt is before the most recent 1m history candlestick
 */
export function pruneAtomicSamples(samples: Sample[], state: ProcessorState): Sample[] {
  if (state.tiers.length === 0) return samples;
  
  const oneMinuteTier = state.tiers[0];
  if (!oneMinuteTier.history.length) return samples;
  
  // Get the closeAt of the most recent 1m history candlestick
  const mostRecent1mHistory = oneMinuteTier.history[oneMinuteTier.history.length - 1];
  const cutoffTime = mostRecent1mHistory.closeAt;
  
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
 * Prunes history for a tier - drop when closeAt is before the most recent higher-tier history candlestick
 */
export function pruneTierHistory(
  tier: TierState, 
  higherTier: TierState | null
): TierState {
  if (!higherTier || higherTier.history.length === 0) {
    return tier;
  }

  // Only prune up to the closeAt of the last finalized (history) higher-tier candlestick
  const mostRecentHigherHistory = higherTier.history[higherTier.history.length - 1];
  const cutoffTime = mostRecentHigherHistory.closeAt;

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
  // First, process all tiers without pruning
  const processedTiers = R.map(tier => processTier(tier, sample), tiers);
  
  // Then, prune each tier based on the final state of higher tiers
  return processedTiers.map((tier, index) => {
    // For pruning, we want to use the tier two levels above:
    // - 5m tier should be pruned based on 1h tier history (not 1m tier)
    // - 1h tier should be pruned based on 1d tier history (not 5m tier)
    // - 1d tier has no higher tier to prune based on
    const higherTierIndex = index + 2;
    const higherTier = higherTierIndex < processedTiers.length ? processedTiers[higherTierIndex] : null;
    return pruneTierHistory(tier, higherTier);
  });
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
  const prunedAtomics = pruneAtomicSamples(updatedAtomics, state);
  
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