import * as R from "ramda"
import { Candlestick, Accumulator } from "./types.ts"
import { getOpen, getClose, getHigh, getLow } from "./utils.ts"

/**
 * Creates an empty candlestick
 */
export function createEmptyCandlestick(): Candlestick {
  return {
    open: 0,
    close: 0,
    high: 0,
    low: 0
  };
}

/**
 * Updates the one-sample candlesticks in the accumulator with a new value
 */
export function updateOneSampleCandlesticks(accumulator: Accumulator | null, value: number): Accumulator {
  // Create a new accumulator with the updated one-sample candlesticks
  return {
    ...accumulator,
    oneSample: [...(accumulator?.oneSample as Candlestick[]), {
      open: value,
      close: value,
      high: value,
      low: value
    }]
  } as Accumulator;
}

const makeSelector = (granularity: string, lastCount: number) => R.pipe<[Accumulator], Candlestick[], Candlestick[]>(
  (acc: Accumulator) => acc[granularity as keyof Accumulator] as Candlestick[],
  R.takeLast(lastCount)
)

export const twoSampleSelector: (accumulator: Accumulator) => Candlestick[] = makeSelector('oneSample', 2)
export const fiveSampleSelector: (accumulator: Accumulator) => Candlestick[] = makeSelector('twoSamples', 3)
export const sixtySecondsSelector: (accumulator: Accumulator) => Candlestick[] = makeSelector('oneSample', 60)
export const sixtyMinutesSelector: (accumulator: Accumulator) => Candlestick[] = makeSelector('sixtySeconds', 60)
export const twentyFourHoursSelector: (accumulator: Accumulator) => Candlestick[] = makeSelector('sixtyMinutes', 24)

const toCandlestick = R.applySpec<Candlestick>({
  open: getOpen,
  close: getClose, 
  high: getHigh,
  low: getLow
})
/**
 * Updates the two-sample candlesticks in the accumulator
 */
const candlestickMaker = (granularity: string, selector: (accumulator: Accumulator) => Candlestick[]) => (accumulator: Accumulator): Accumulator => ({
    ...accumulator,
    [granularity]: [...(R.prop(granularity as keyof Accumulator, accumulator) as Candlestick[]), toCandlestick(selector(accumulator))]
  });
  
/**
 * Updates the all-time candlestick with a new value
 */
export const updateAllTimeCandlestick = (granularity: string) => (accumulator: Accumulator): Accumulator => ({
  ...accumulator,
  allTime: toCandlestick(accumulator[granularity as keyof Accumulator] as Candlestick[])
})

const getLargestGranularity = R.pipe<[Tier[]], Tier, string>(
  R.last as (arr: Tier[]) => Tier,
  R.prop('granularity') as (t: Tier) => string
)
/**
 * Processes a new value and updates the accumulator
 */
interface Tier {
  granularity: string;
  selector: (accumulator: Accumulator) => Candlestick[];
}

export const processValue = (tiers: Tier[]) => (accumulator: Accumulator | null, value: number): Accumulator => {

  // Update one-sample candlesticks
  let updatedAccumulator = updateOneSampleCandlesticks(accumulator, value);
  tiers.forEach(({granularity, selector}) => {
    updatedAccumulator = candlestickMaker(granularity as string, selector as (accumulator: Accumulator) => Candlestick[])(updatedAccumulator);
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