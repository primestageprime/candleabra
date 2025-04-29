import * as R from "ramda"
import type { Candlestick, Accumulator, Tier } from "./types.ts"
import { getOpen, getClose, getHigh, getLow } from "./utils.ts"

/**
 * Updates the one-sample candlesticks in the accumulator with a new value
 */
export function updateOneSampleCandlesticks(accumulator: Accumulator | null, value: number): Accumulator {
  const newCandlestick = {
    open: value,
    close: value,
    high: value,
    low: value
  };
  
  if (!accumulator) {
    return {
      oneSample: [newCandlestick],
      allTime: newCandlestick
    };
  }
  
  return {
    ...accumulator,
    oneSample: [...accumulator.oneSample, newCandlestick]
  };
}

const makeSelector = (granularity: keyof Accumulator, lastCount: number) => 
  (acc: Accumulator): R.NonEmptyArray<Candlestick> => {
    const samples = acc[granularity];
    if (!samples || !Array.isArray(samples)) {
      return [acc.allTime];
    }
    return R.takeLast(lastCount, samples) as R.NonEmptyArray<Candlestick>;
  };

export const twoSampleSelector = makeSelector('oneSample', 2);
export const fiveSampleSelector = makeSelector('twoSamples', 3);
export const sixtySecondsSelector = makeSelector('oneSample', 60);
export const sixtyMinutesSelector = makeSelector('sixtySeconds', 60);
export const twentyFourHoursSelector = makeSelector('sixtyMinutes', 24);

const toCandlestick = R.applySpec<Candlestick>({
  open: getOpen,
  close: getClose, 
  high: getHigh,
  low: getLow
})
/**
 * Updates the two-sample candlesticks in the accumulator
 */
const candlestickMaker = (granularity: keyof Accumulator, selector: (accumulator: Accumulator) => R.NonEmptyArray<Candlestick>) => (accumulator: Accumulator): Accumulator => {
  const selectedCandlesticks = selector(accumulator);
  const newCandlestick = toCandlestick(selectedCandlesticks);
  const item: R.NonEmptyArray<Candlestick> | Candlestick = accumulator[granularity] 
  const result: R.NonEmptyArray<Candlestick> | Candlestick = Array.isArray(item) ? [...item, newCandlestick] : newCandlestick
  return {
    ...accumulator,
    [granularity]: result
  };
}
  
/**
 * Updates the all-time candlestick with a new value
 */
export const updateAllTimeCandlestick = (granularity: keyof Accumulator) => (accumulator: Accumulator): Accumulator => ({
  ...accumulator,
  allTime: toCandlestick(accumulator[granularity])
})

const getLargestGranularity = R.pipe<[Tier[]], Tier, string>(
  R.last,
  R.prop('granularity')
)
/**
 * Processes a new value and updates the accumulator
 */


export const processValue = (tiers: Tier[]) => (accumulator: Accumulator | null, value: number): Accumulator => {

  // Update one-sample candlesticks
  let updatedAccumulator = updateOneSampleCandlesticks(accumulator, value);
  tiers.forEach(({granularity, selector}) => {
    updatedAccumulator = candlestickMaker(granularity, selector)(updatedAccumulator);
  });

  // Update all-time candlestick
  return updateAllTimeCandlestick(getLargestGranularity(tiers))(updatedAccumulator);
} 

export const processValueTwoFive = processValue([
  {granularity: "twoSamples", selector: twoSampleSelector},
  {granularity: "fiveSamples", selector: fiveSampleSelector}
])

export const processValueMinHourDay = processValue([
  {granularity: "sixtySeconds", selector: sixtySecondsSelector},
  {granularity: "sixtyMinutes", selector: sixtyMinutesSelector},
  {granularity: "twentyFourHours", selector: twentyFourHoursSelector}
])