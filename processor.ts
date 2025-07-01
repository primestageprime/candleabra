import { DateTime, Duration } from "luxon";
import * as R from "ramda";
import type {
  Candlestick,
  Granularity,
  GranularityConfig,
  ProcessingResult,
  ProcessorState,
  Sample,
  TierState,
} from "./types.ts";
import { createGranularities, getBucketStart } from "./granularity.ts";
import { samplesToCandlestick, toCandlestick } from "./candlestick.ts";

/**
 * Creates initial processor state from granularity configuration
 * @param config - Array of granularity strings (e.g., ["1m", "5m", "1h", "1d"])
 * @returns Initial processor state with empty tiers
 */
export function createProcessor(config: GranularityConfig): ProcessorState {
  const granularities = createGranularities(config);

  const tiers: TierState[] = R.map((granularity) => ({
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
 * Prunes atomic samples by removing those older than the most recent 1m history candlestick
 * This prevents memory bloat from accumulating atomic samples
 */
export function pruneAtomicSamples(
  samples: Sample[],
  state: ProcessorState,
): Sample[] {
  if (state.tiers.length === 0) return samples;

  const smallestTier = state.tiers[0];
  if (!smallestTier.history.length) return samples;

  // Get the closeAt of the most recent 1m history candlestick
  const mostRecentSmallestTierHistory =
    smallestTier.history[smallestTier.history.length - 1];
  const cutoffTime = mostRecentSmallestTierHistory.closeAt;

  return R.filter((sample) => sample.dateTime >= cutoffTime, samples);
}

/**
 * Processes a single tier with a new sample
 * Handles bucket transitions and candlestick aggregation
 */
export function processTier(tier: TierState, sample: Sample): TierState {
  const { granularity, current, history, samples } = tier;
  const sampleCandlestick = toCandlestick(sample);

  if (!current) {
    // First sample for this tier - create initial candlestick
    const bucketStart = getBucketStart(sample.dateTime, granularity.duration);

    return {
      ...tier,
      current: {
        ...sampleCandlestick,
        openAt: bucketStart,
        closeAt: sample.dateTime, // Current candlestick tracks latest sample time
      },
      samples: [sample],
    };
  }

  // Check if this sample starts a new bucket
  const bucketStart = getBucketStart(sample.dateTime, granularity.duration);
  const currentBucketStart = getBucketStart(
    current.openAt,
    granularity.duration,
  );

  if (bucketStart.equals(currentBucketStart)) {
    // Same bucket - update current candlestick with new sample
    const updatedSamples = [...samples, sample];
    const updatedCandlestick = samplesToCandlestick(
      updatedSamples,
      current.openAt,
      sample.dateTime, // Current candlestick tracks latest sample time
    );

    return {
      ...tier,
      current: updatedCandlestick,
      samples: updatedSamples,
    };
  } else {
    // New bucket - finalize current candlestick and start new one
    const bucketEnd = currentBucketStart.plus(granularity.duration);
    const completedCandlestick = {
      ...current,
      closeAt: bucketEnd, // Finalized candlestick uses bucket end time
    };

    return {
      ...tier,
      current: {
        ...sampleCandlestick,
        openAt: bucketStart,
        closeAt: sample.dateTime, // Current candlestick tracks latest sample time
      },
      history: [...history, completedCandlestick],
      samples: [sample],
    };
  }
}

/**
 * Prunes history for a tier based on higher-tier completion
 * Only keeps history that's newer than the most recent higher-tier finalized candlestick
 */
export function pruneTierHistory(
  tier: TierState,
  higherTier: TierState | null,
): TierState {
  if (!higherTier || higherTier.history.length === 0) {
    return tier;
  }

  // Only prune up to the closeAt of the last finalized (history) higher-tier candlestick
  const mostRecentHigherHistory =
    higherTier.history[higherTier.history.length - 1];
  const cutoffTime = mostRecentHigherHistory.closeAt;

  const prunedHistory = R.filter(
    (candlestick) => candlestick.closeAt >= cutoffTime,
    tier.history,
  );

  return {
    ...tier,
    history: prunedHistory,
  };
}

/**
 * Processes all tiers with a new sample and applies pruning
 * This is the main orchestration function for multi-tier processing
 */
export function processAllTiers(
  tiers: TierState[],
  sample: Sample,
): TierState[] {
  // First, process all tiers without pruning to get final state
  const processedTiers = R.map((tier) => processTier(tier, sample), tiers);

  // Then, prune each tier based on the final state of higher tiers
  return processedTiers.map((tier, index) => {
    // For pruning, we want to use the tier one level above:
    // - 5m tier should be pruned based on 1h tier history (not 1m tier)
    // - 1h tier should be pruned based on 1d tier history (not 5m tier)
    // - 1d tier has no higher tier to prune based on
    const higherTierIndex = index + 1;
    const higherTier = higherTierIndex < processedTiers.length
      ? processedTiers[higherTierIndex]
      : null;
    return pruneTierHistory(tier, higherTier);
  });
}

/**
 * Main processing function - processes a single sample through all tiers
 * This is the primary entry point for the streaming processor
 */
export function processSample(
  state: ProcessorState,
  sample: Sample,
): ProcessingResult {
  // Check if this sample is newer than the newest sample we've processed
  const newestProcessedSample = state.atomicSamples.length > 0
    ? state.atomicSamples[state.atomicSamples.length - 1]
    : null;

  if (
    newestProcessedSample && sample.dateTime <= newestProcessedSample.dateTime
  ) {
    // Sample is not newer than the newest processed sample - throw it away
    return {
      atomics: state.atomicSamples,
      tierResults: R.chain(
        (tier) => tier.current ? [tier.current] : [],
        state.tiers,
      ),
      updatedState: state,
    };
  }

  // Update atomic samples with pruning
  const updatedAtomics = [...state.atomicSamples, sample];
  const prunedAtomics = pruneAtomicSamples(updatedAtomics, state);

  // Process all tiers
  const updatedTiers = processAllTiers(state.tiers, sample);

  // Get current results from each tier (for backward compatibility)
  const tierResults = R.chain(
    (tier) => tier.current ? [tier.current] : [],
    updatedTiers,
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
 * Returns an array of tier results with candlesticks (history + current)
 */
export function getResults(
  state: ProcessorState,
): Array<{ name: string; candlesticks: Candlestick[] }> {
  return R.map((tier) => ({
    name: tier.granularity.name,
    candlesticks: [...tier.history, ...(tier.current ? [tier.current] : [])],
  }), state.tiers);
}
