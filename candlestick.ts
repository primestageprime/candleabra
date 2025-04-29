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
 * Creates a one-sample candlestick from a single value
 */
export function createOneSampleCandlestick(value: number): Candlestick {
  return {
    open: value,
    close: value,
    high: value,
    low: value
  };
}

/**
 * Updates the one-sample candlesticks in the accumulator with a new value
 */
export function updateOneSampleCandlesticks(accumulator: Accumulator, value: number): Accumulator {
  const newCandlestick = createOneSampleCandlestick(value);
  
  // Create a new accumulator with the updated one-sample candlesticks
  return {
    ...accumulator,
    oneSample: [...accumulator.oneSample, newCandlestick]
  };
}



/**
 * Updates the two-sample candlesticks in the accumulator
 */
export function updateTwoSampleCandlesticks(accumulator: Accumulator): Accumulator {
  const { oneSample } = accumulator;  

  // Get the last two one-sample candlesticks
  const lastTwo = oneSample.slice(-2);
  const open = getOpen(lastTwo)
  const close = getClose(lastTwo)
  const high = getHigh(lastTwo)
  const low = getLow(lastTwo)

  // Create a new two-sample candlestick
  const newTwoSample = {open, close, high, low};
  return {
    ...accumulator,
    twoSamples: [...accumulator.twoSamples, newTwoSample]
  };
}

/**
 * Updates the all-time candlestick with a new value
 */
export function updateAllTimeCandlestick(accumulator: Accumulator, value: number): Accumulator {
  const currentAllTime = accumulator.allTime;
  
  // If the all-time candlestick is empty, initialize it with the new value
  if (currentAllTime.open === null) {
    return {
      ...accumulator,
      allTime: createOneSampleCandlestick(value)
    };
  }
  
  // Update the all-time candlestick with the new value
  const updatedAllTime: Candlestick = {
    open: currentAllTime.open, // Open remains the same (first value)
    close: value, // Close is updated to the new value
    high: Math.max(currentAllTime.high!, value), // High is the maximum of current high and new value
    low: Math.min(currentAllTime.low!, value) // Low is the minimum of current low and new value
  };
  
  return {
    ...accumulator,
    allTime: updatedAllTime
  };
}

/**
 * Creates a five-sample candlestick from two two-sample candlesticks and one one-sample candlestick
 */
export function createFiveSampleCandlestick(
  firstTwoSample: Candlestick, 
  secondTwoSample: Candlestick, 
  lastOneSample: Candlestick
): Candlestick {
  // Validate all candlesticks are complete
  if (firstTwoSample.open === null || firstTwoSample.close === null || 
      firstTwoSample.high === null || firstTwoSample.low === null ||
      secondTwoSample.open === null || secondTwoSample.close === null || 
      secondTwoSample.high === null || secondTwoSample.low === null ||
      lastOneSample.open === null || lastOneSample.close === null || 
      lastOneSample.high === null || lastOneSample.low === null) {
    throw new Error("Cannot create five-sample candlestick from incomplete candlesticks");
  }

  // First open from first two-sample, last close from last one-sample, max of all highs, min of all lows
  return {
    open: firstTwoSample.open,
    close: lastOneSample.close,
    high: Math.max(firstTwoSample.high, secondTwoSample.high, lastOneSample.high),
    low: Math.min(firstTwoSample.low, secondTwoSample.low, lastOneSample.low)
  };
}

/**
 * Updates the five-sample candlesticks in the accumulator
 */
export function updateFiveSampleCandlesticks(accumulator: Accumulator): Accumulator {
  const { oneSample, twoSamples } = accumulator;
  
  // We need at least 5 one-sample candlesticks
  if (oneSample.length < 5) {
    return accumulator;
  }

  // Calculate how many complete five-sample candlesticks we should have
  const expectedFiveSampleCount = Math.floor(oneSample.length / 5);
  
  // If we already have all the five-sample candlesticks we need, skip
  if (accumulator.fiveSamples.length >= expectedFiveSampleCount) {
    return accumulator;
  }

  // Get the five samples for the next candlestick
  const startIndex = accumulator.fiveSamples.length * 5;
  const nextFive = oneSample.slice(startIndex, startIndex + 5);

  // Create a new five-sample candlestick
  const newFiveSample = {
    open: nextFive[0].open,
    close: nextFive[4].close,
    high: Math.max(...nextFive.map(c => c.high!)),
    low: Math.min(...nextFive.map(c => c.low!))
  };

  return {
    ...accumulator,
    fiveSamples: [...accumulator.fiveSamples, newFiveSample]
  };
}

/**
 * Processes a new value and updates the accumulator
 */
export function processValue(accumulator: Accumulator, value: number): Accumulator {
  // Update one-sample candlesticks
  let updatedAccumulator = updateOneSampleCandlesticks(accumulator, value);
  
  // Update two-sample candlesticks
  updatedAccumulator = updateTwoSampleCandlesticks(updatedAccumulator);
  
  // Update five-sample candlesticks
  updatedAccumulator = updateFiveSampleCandlesticks(updatedAccumulator);
  
  // Update all-time candlestick
  return updateAllTimeCandlestick(updatedAccumulator, value);
} 