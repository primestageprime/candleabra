import * as R from "ramda"
import type { Candlestick, Accumulator } from "./types.d.ts"
import { getOpen, getClose, getHigh, getLow } from "./utils.ts"
import { SMALLEST_GRANULARITY, LARGEST_GRANULARITY } from "./constants.ts"

// Re-export types
export type { Candlestick, Accumulator }

/**
 * Updates the one-sample candlesticks in the accumulator with a new value
 */
export function updateAtomicSampleCandlesticks(accumulator: Accumulator | null, value: number, pruningCount: number): Accumulator {
  const newCandlestick = {
    open: value,
    close: value,
    high: value,
    low: value
  };
  
  if (!accumulator) {
    return {
      [SMALLEST_GRANULARITY]: [newCandlestick],
      allSamples: [newCandlestick]
    };
  }

  return {
    ...accumulator,
    [SMALLEST_GRANULARITY]: R.isEmpty(accumulator[SMALLEST_GRANULARITY]) 
      ? [newCandlestick] 
      : R.takeLast(pruningCount, [...accumulator[SMALLEST_GRANULARITY], newCandlestick]) as R.NonEmptyArray<Candlestick>
  };
}

/**
 * Updates the all-time candlestick with a new value
 */
export const updateAllTimeCandlestick = (largestTierGranularity: keyof Accumulator) => (accumulator: Accumulator): Accumulator => {
    const samples: R.NonEmptyArray<Candlestick> = accumulator[largestTierGranularity] 
    const result: R.NonEmptyArray<Candlestick> = [toCandlestick([...accumulator.allSamples, ...samples])] 
    return {
      ...accumulator,
      [LARGEST_GRANULARITY]: result
    }
  }

export const selector = (granularity: string, lastCount: number) => 
  (acc: Accumulator): R.NonEmptyArray<Candlestick> => {
    const samples = acc[granularity];
    if (!samples || !Array.isArray(samples) || granularity === LARGEST_GRANULARITY) {
      return acc[LARGEST_GRANULARITY];
    }
    return R.takeLast(lastCount, samples) as R.NonEmptyArray<Candlestick>;
  };


const toCandlestick = R.applySpec<Candlestick>({
  open: getOpen,
  close: getClose, 
  high: getHigh,
  low: getLow
})
/**
 * Updates the two-sample candlesticks in the accumulator
 */
const candlestickMaker = (parentGranularity: string, granularity: string, sampleCount: number, pruningCount: number) => (accumulator: Accumulator): Accumulator => {
  const selectedCandlesticks = selector(parentGranularity, sampleCount)(accumulator);
  const newCandlestick = toCandlestick(selectedCandlesticks);
  const priorAccumulator: R.NonEmptyArray<Candlestick> = accumulator[granularity] 
  const result: R.NonEmptyArray<Candlestick> = Array.isArray(priorAccumulator) ? [...priorAccumulator, newCandlestick] : [newCandlestick]
  const samples: R.NonEmptyArray<Candlestick> = pruningCount > 0 ? R.takeLast(pruningCount, result) as R.NonEmptyArray<Candlestick> : result
  return {
    ...accumulator,
    [granularity]: samples
  };
}
  

const getLargestTierGranularity = R.pipe<[number[]], number, string>(
  R.head,
  num => `samplesOf${num}`
)

/**
 * Processes a new value and updates the accumulator
 */

export const makeProcessValue = (sampleTiers: number[]) => (accumulator: Accumulator | null, value: number): Accumulator => {

  // Update one-sample candlesticks
  let updatedAccumulator = updateAtomicSampleCandlesticks(accumulator, value, R.last(sampleTiers) ?? 1);
  const defaultPruningCount = 1
  let parentGranularity = SMALLEST_GRANULARITY
  const pairs = R.aperture(2, [...sampleTiers, 1])
  pairs.forEach(([sampleCount, nextSampleCount]) => {
    const granularity = `samplesOf${sampleCount}`
    const pruningCount = nextSampleCount || defaultPruningCount
    updatedAccumulator = candlestickMaker(parentGranularity, granularity, sampleCount, pruningCount)(updatedAccumulator);
    parentGranularity = granularity
  });

  // Update all-time candlestick
  return updateAllTimeCandlestick(getLargestTierGranularity(sampleTiers))(updatedAccumulator);
} 

export const processValueTwoFive: (accumulator: Accumulator | null, value: number) => Accumulator = makeProcessValue([ 2, 5])

export const processValueMinHourDay: (accumulator: Accumulator | null, value: number) => Accumulator = makeProcessValue([60,  360,  1440])