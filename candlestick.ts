/**
 * Represents a candlestick with open, close, high, and low values
 */
export interface Candlestick {
  open: number | null;
  close: number | null;
  high: number | null;
  low: number | null;
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
    open: null,
    close: null,
    high: null,
    low: null
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

/**
 * Visualizes a candlestick in the specified format
 */
export function visualizeCandlestick(candlestick: Candlestick): string {
  if (candlestick.open === null || candlestick.close === null || 
      candlestick.high === null || candlestick.low === null) {
    return "Empty candlestick";
  }
  
  return `
      [ ${candlestick.high} ]
[${candlestick.open}]        [${candlestick.close}]
      [ ${candlestick.low} ]`;
}

/**
 * Visualizes an accumulator
 */
export function visualizeAccumulator(accumulator: Accumulator): string {
  return `
One Sample Candlesticks:
${accumulator.oneSample.map(visualizeCandlestick).join('\n')}

Two Sample Candlesticks:
${accumulator.twoSamples.map(visualizeCandlestick).join('\n')}

Five Sample Candlesticks:
${accumulator.fiveSamples.map(visualizeCandlestick).join('\n')}

All Time Candlestick:
${visualizeCandlestick(accumulator.allTime)}
`;
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
 * Creates a two-sample candlestick from two consecutive one-sample candlesticks
 */
export function createTwoSampleCandlestick(first: Candlestick, second: Candlestick): Candlestick {
  if (first.open === null || second.close === null || 
      first.high === null || second.high === null ||
      first.low === null || second.low === null) {
    throw new Error("Cannot create two-sample candlestick from incomplete candlesticks");
  }

  return {
    open: first.open,
    close: second.close,
    high: Math.max(first.high, second.high),
    low: Math.min(first.low, second.low)
  };
}

/**
 * Updates the two-sample candlesticks in the accumulator
 */
export function updateTwoSampleCandlesticks(accumulator: Accumulator): Accumulator {
  const { oneSample } = accumulator;
  
  // We need at least 2 one-sample candlesticks to create a two-sample candlestick
  if (oneSample.length < 2) {
    return accumulator;
  }

  // Get the last two one-sample candlesticks
  const lastTwo = oneSample.slice(-2);
  
  // If we already have a two-sample candlestick for these one-sample candlesticks, skip
  if (accumulator.twoSamples.length * 2 >= oneSample.length - 1) {
    return accumulator;
  }

  // Create a new two-sample candlestick
  const newTwoSample = createTwoSampleCandlestick(lastTwo[0], lastTwo[1]);

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