import * as R from "ramda"
import type { Candlestick, Accumulator } from "./types.d.ts"
import { getOpen, getClose, getHigh, getLow } from "./utils.ts"

// Re-export types
export type { Candlestick, Accumulator }

const SMALLEST_GRANULARITY = 'samplesOf1'
/**
 * Updates the one-sample candlesticks in the accumulator with a new value
 */
export function updateOneSampleCandlesticks(accumulator: Accumulator | null, value: number, pruningCount: number): Accumulator {
  const newCandlestick = {
    open: value,
    close: value,
    high: value,
    low: value
  };
  
  if (!accumulator) {
    return {
      [SMALLEST_GRANULARITY]: [newCandlestick],
      allTime: [newCandlestick]
    };
  }

  return {
    ...accumulator,
    [SMALLEST_GRANULARITY]: R.isEmpty(accumulator[SMALLEST_GRANULARITY]) 
      ? [newCandlestick] 
      : R.takeLast(pruningCount, [...accumulator[SMALLEST_GRANULARITY], newCandlestick]) as R.NonEmptyArray<Candlestick>
  };
}

export const makeSelector = (granularity: string, lastCount: number) => 
  (acc: Accumulator): R.NonEmptyArray<Candlestick> => {
    const samples = acc[granularity];
    if (!samples || !Array.isArray(samples) || granularity === 'allTime') {
      return [acc.allTime];
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
const candlestickMaker = (granularity: string, pruningCount: number) => (accumulator: Accumulator): Accumulator => {

  const selectedCandlesticks = makeSelector(granularity, pruningCount)(accumulator);
  const newCandlestick = toCandlestick(selectedCandlesticks);
  const item: R.NonEmptyArray<Candlestick> | Candlestick = accumulator[granularity] 
  const result: R.NonEmptyArray<Candlestick> | Candlestick = Array.isArray(item) ? [...item, newCandlestick] : [newCandlestick]
  return {
    ...accumulator,
    [granularity]: result
  };
}
  
/**
 * Updates the all-time candlestick with a new value
 */
export const updateAllTimeCandlestick = (largestGranularity: keyof Accumulator) => (accumulator: Accumulator): Accumulator => ({
  ...accumulator,
  allTime: toCandlestick([accumulator.allTime, ...(Array.isArray(accumulator[largestGranularity]) ? accumulator[largestGranularity] : [])])
})

const getLargestGranularity = R.pipe<[number[]], number, string>(
  R.head,
  num => `samplesOf${num}`
)
/**
 * Processes a new value and updates the accumulator
 */


export const makeProcessValue = (sampleTiers: number[]) => (accumulator: Accumulator | null, value: number): Accumulator => {

  // Update one-sample candlesticks
  let updatedAccumulator = updateOneSampleCandlesticks(accumulator, value);
  let pruningCount = 0
  let granularity = SMALLEST_GRANULARITY
  sampleTiers.forEach((sampleCount) => {
    granularity = `samplesOf${sampleCount}`
    updatedAccumulator = candlestickMaker(granularity, pruningCount)(updatedAccumulator);
    pruningCount = sampleCount
  });

  // Update all-time candlestick
  return updateAllTimeCandlestick(getLargestGranularity(sampleTiers))(updatedAccumulator);
} 

export const processValueTwoFive: (accumulator: Accumulator | null, value: number) => Accumulator = makeProcessValue([ 5,2])

export const processValueMinHourDay: (accumulator: Accumulator | null, value: number) => Accumulator = makeProcessValue([60,  360,  1440])