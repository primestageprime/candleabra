import * as R from "ramda"
/**
 * Represents a candlestick with open, close, high, and low values
 */
export interface Candlestick {
  open: number;
  close: number;
  high: number;
  low: number;
}

/**
 * Represents an accumulator that holds candlesticks for different time windows
 */
export interface Accumulator {
  oneSample: Candlestick[];
  twoSamples: Candlestick[];
  fiveSamples: Candlestick[];
  allTime: Candlestick;
}

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
 * Creates an empty accumulator
 */
export function createEmptyAccumulator(): Accumulator {
  return {
    oneSample: [],
    twoSamples: [],
    fiveSamples: [],
    allTime: createEmptyCandlestick()
  };
}



const getOpen = R.pipe<[Candlestick[]], Candlestick, number>(
  R.head as (arr: Candlestick[]) => Candlestick,
  R.prop('open') as (c: Candlestick) => number
);

const getClose = R.pipe<[Candlestick[]], Candlestick, number>(
  R.last as (arr: Candlestick[]) => Candlestick,
  R.prop('close') as (c: Candlestick) => number
);

const getHigh = (list: Candlestick[]) => {
  if (list.length === 1) {
    return list[0].high
  }
  return R.reduce<Candlestick, number>(
    (acc, c) => R.isNil(acc) ? c.high : Math.max(acc, c.high),
    R.head(list)?.high ?? Infinity
  )(R.tail(list))
}

const getLow = (list: Candlestick[]) => {
  return R.reduce<Candlestick, number>(
    (acc, c) => R.isNil(acc) ? c.low : Math.min(acc, c.low),
    R.head(list)?.low ?? Infinity
  )(R.tail(list))
}


/**
 * Updates the one-sample candlesticks in the accumulator with a new value
 */
export function updateOneSampleCandlesticks(accumulator: Accumulator, value: number): Accumulator {
  
  // Create a new accumulator with the updated one-sample candlesticks
  return {
    ...accumulator,
    oneSample: [...accumulator.oneSample, {
      open: value,
      close: value,
      high: value,
      low: value
    }]
  };
}

export const twoSampleSelector: (accumulator: Accumulator) => Candlestick[] = R.pipe<[Accumulator], Candlestick[], Candlestick[]>(
  R.prop('oneSample'),
  R.takeLast(2)
)

export const fiveSampleSelector: (accumulator: Accumulator) => Candlestick[] = R.pipe<[Accumulator], Candlestick[], Candlestick[]>(
  R.prop('twoSamples'),
  R.takeLast(3)
)

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

export function processValue(accumulator: Accumulator, value: number): Accumulator {
  const tiers: Tier[] = [
    {granularity: "twoSamples", selector: twoSampleSelector},
    {granularity: "fiveSamples", selector: fiveSampleSelector}
  ]
  // Update one-sample candlesticks
  let updatedAccumulator = updateOneSampleCandlesticks(accumulator, value);
  tiers.forEach(({granularity, selector}) => {
    updatedAccumulator = candlestickMaker(granularity as string, selector as (accumulator: Accumulator) => Candlestick[])(updatedAccumulator);
  });
  
  // Update all-time candlestick
  return updateAllTimeCandlestick(getLargestGranularity(tiers))(updatedAccumulator);
} 