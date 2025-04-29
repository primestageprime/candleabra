import { assertEquals, assertThrows } from "std/testing/asserts.ts";
import { 
  Candlestick, 
  Accumulator, 
  createEmptyCandlestick, 
  createEmptyAccumulator,
  visualizeCandlestick,
  visualizeAccumulator,
  processValue,
  createOneSampleCandlestick,
  createTwoSampleCandlestick,
  createFiveSampleCandlestick
} from "./candlestick.ts";

// Test creating empty candlestick
Deno.test("createEmptyCandlestick", () => {
  const candlestick = createEmptyCandlestick();
  assertEquals(candlestick.open, null);
  assertEquals(candlestick.close, null);
  assertEquals(candlestick.high, null);
  assertEquals(candlestick.low, null);
});

// Test creating empty accumulator
Deno.test("createEmptyAccumulator", () => {
  const accumulator = createEmptyAccumulator();
  assertEquals(accumulator.oneSample.length, 0);
  assertEquals(accumulator.twoSamples.length, 0);
  assertEquals(accumulator.fiveSamples.length, 0);
  assertEquals(accumulator.allTime.open, null);
});

// Test visualizing a candlestick
Deno.test("visualizeCandlestick", () => {
  const candlestick: Candlestick = {
    open: 1,
    close: 2,
    high: 3,
    low: 0
  };
  
  const visualization = visualizeCandlestick(candlestick);
  assertEquals(visualization.includes("[ 3 ]"), true);
  assertEquals(visualization.includes("[1]"), true);
  assertEquals(visualization.includes("[2]"), true);
  assertEquals(visualization.includes("[ 0 ]"), true);
});

// Test visualizing an empty candlestick
Deno.test("visualizeEmptyCandlestick", () => {
  const candlestick = createEmptyCandlestick();
  const visualization = visualizeCandlestick(candlestick);
  assertEquals(visualization, "Empty candlestick");
});

// Test visualizing an accumulator
Deno.test("visualizeAccumulator", () => {
  const accumulator = createEmptyAccumulator();
  const visualization = visualizeAccumulator(accumulator);
  assertEquals(visualization.includes("One Sample Candlesticks:"), true);
  assertEquals(visualization.includes("Two Sample Candlesticks:"), true);
  assertEquals(visualization.includes("Five Sample Candlesticks:"), true);
  assertEquals(visualization.includes("All Time Candlestick:"), true);
});

// Test creating a one-sample candlestick
Deno.test("createOneSampleCandlestick", () => {
  const value = 42;
  const candlestick = createOneSampleCandlestick(value);
  assertEquals(candlestick.open, value);
  assertEquals(candlestick.close, value);
  assertEquals(candlestick.high, value);
  assertEquals(candlestick.low, value);
});

// Test creating a two-sample candlestick
Deno.test("createTwoSampleCandlestick", () => {
  const first: Candlestick = {
    open: 10,
    close: 15,
    high: 20,
    low: 5
  };
  
  const second: Candlestick = {
    open: 15,
    close: 25,
    high: 30,
    low: 10
  };
  
  const twoSample = createTwoSampleCandlestick(first, second);
  assertEquals(twoSample.open, 10); // First open
  assertEquals(twoSample.close, 25); // Second close
  assertEquals(twoSample.high, 30); // Max of both highs
  assertEquals(twoSample.low, 5); // Min of both lows
});

// Test creating a two-sample candlestick with invalid input
Deno.test("createTwoSampleCandlestick - invalid input", () => {
  const incomplete: Candlestick = {
    open: null,
    close: null,
    high: null,
    low: null
  };
  
  const complete: Candlestick = {
    open: 10,
    close: 15,
    high: 20,
    low: 5
  };
  
  assertThrows(() => createTwoSampleCandlestick(incomplete, complete));
  assertThrows(() => createTwoSampleCandlestick(complete, incomplete));
});

// Test creating a five-sample candlestick
Deno.test("createFiveSampleCandlestick", () => {
  const firstTwoSample: Candlestick = {
    open: 10,
    close: 15,
    high: 20,
    low: 5
  };
  
  const secondTwoSample: Candlestick = {
    open: 15,
    close: 25,
    high: 30,
    low: 10
  };
  
  const lastOneSample: Candlestick = {
    open: 25,
    close: 40,
    high: 45,
    low: 20
  };
  
  const fiveSample = createFiveSampleCandlestick(firstTwoSample, secondTwoSample, lastOneSample);
  assertEquals(fiveSample.open, 10); // First open from first two-sample
  assertEquals(fiveSample.close, 40); // Last close from last one-sample
  assertEquals(fiveSample.high, 45); // Max of all highs
  assertEquals(fiveSample.low, 5); // Min of all lows
});

// Test creating a five-sample candlestick with invalid input
Deno.test("createFiveSampleCandlestick - invalid input", () => {
  const complete: Candlestick = {
    open: 10,
    close: 15,
    high: 20,
    low: 5
  };
  
  const incomplete: Candlestick = {
    open: 15,
    close: null,
    high: 30,
    low: 10
  };
  
  assertThrows(() => createFiveSampleCandlestick(incomplete, complete, complete));
  assertThrows(() => createFiveSampleCandlestick(complete, incomplete, complete));
  assertThrows(() => createFiveSampleCandlestick(complete, complete, incomplete));
});

// Test processing a single value
Deno.test("processValue - first value", () => {
  const accumulator = createEmptyAccumulator();
  const value = 42;
  const result = processValue(accumulator, value);
  
  // Check one-sample candlesticks
  assertEquals(result.oneSample.length, 1);
  assertEquals(result.oneSample[0].open, value);
  assertEquals(result.oneSample[0].close, value);
  
  // Check all-time candlestick
  assertEquals(result.allTime.open, value);
  assertEquals(result.allTime.close, value);
  assertEquals(result.allTime.high, value);
  assertEquals(result.allTime.low, value);
});

// Test processing multiple values
Deno.test("processValue - multiple values", () => {
  let accumulator = createEmptyAccumulator();
  const values = [10, 20, 5, 15];
  
  // Process all values
  for (const value of values) {
    accumulator = processValue(accumulator, value);
  }
  
  // Check one-sample candlesticks
  assertEquals(accumulator.oneSample.length, values.length);
  for (let i = 0; i < values.length; i++) {
    assertEquals(accumulator.oneSample[i].open, values[i]);
    assertEquals(accumulator.oneSample[i].close, values[i]);
  }
  
  // Check all-time candlestick
  assertEquals(accumulator.allTime.open, values[0]); // First value
  assertEquals(accumulator.allTime.close, values[values.length - 1]); // Last value
  assertEquals(accumulator.allTime.high, Math.max(...values));
  assertEquals(accumulator.allTime.low, Math.min(...values));
});

// Test processing values for two-sample candlesticks
Deno.test("processValue - two-sample candlesticks", () => {
  let accumulator = createEmptyAccumulator();
  const values = [10, 20, 5, 15]; // Should create two two-sample candlesticks
  
  // Process all values
  for (const value of values) {
    accumulator = processValue(accumulator, value);
  }
  
  // Check two-sample candlesticks
  assertEquals(accumulator.twoSamples.length, 2);
  
  // First two-sample candlestick (from values[0] and values[1])
  assertEquals(accumulator.twoSamples[0].open, 10);
  assertEquals(accumulator.twoSamples[0].close, 20);
  assertEquals(accumulator.twoSamples[0].high, 20);
  assertEquals(accumulator.twoSamples[0].low, 10);
  
  // Second two-sample candlestick (from values[2] and values[3])
  assertEquals(accumulator.twoSamples[1].open, 5);
  assertEquals(accumulator.twoSamples[1].close, 15);
  assertEquals(accumulator.twoSamples[1].high, 15);
  assertEquals(accumulator.twoSamples[1].low, 5);
});

// Test processing values for five-sample candlesticks
Deno.test("processValue - five-sample candlesticks", () => {
  let accumulator = createEmptyAccumulator();
  const values = [1, 1, 1, 1, 1, 9, 1, 1, 1, 1]; // Should create two five-sample candlesticks
  
  // Process all values
  for (const value of values) {
    accumulator = processValue(accumulator, value);
  }
  
  // Check five-sample candlesticks
  assertEquals(accumulator.fiveSamples.length, 2);
  
  // First five-sample candlestick (from first 5 values)
  assertEquals(accumulator.fiveSamples[0].open, 1);
  assertEquals(accumulator.fiveSamples[0].close, 1);
  assertEquals(accumulator.fiveSamples[0].high, 1);
  assertEquals(accumulator.fiveSamples[0].low, 1);
  
  // Second five-sample candlestick (from last 5 values)
  assertEquals(accumulator.fiveSamples[1].open, 9);
  assertEquals(accumulator.fiveSamples[1].close, 1);
  assertEquals(accumulator.fiveSamples[1].high, 9);
  assertEquals(accumulator.fiveSamples[1].low, 1);
});

// Test showing accumulator state after each iteration
Deno.test("processValue - accumulator state after each iteration", () => {
  let accumulator = createEmptyAccumulator();
  const values = [1, 1, 1, 1, 1, 1, 1, 9, 9, 1, 1, 1, 9, 1, 1, 1, 1, 1, 1, 1];
  
  // Process each value and show the accumulator state
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    accumulator = processValue(accumulator, value);
    
    console.log(`At position ${i} in the values list`);
    console.log(`one_sample: ${formatCandlesticks(accumulator.oneSample)}`);
    console.log(`two_samples: ${formatCandlesticks(accumulator.twoSamples)}`);
    console.log(`five_samples: ${formatCandlesticks(accumulator.fiveSamples)}`);
    console.log(`all_time: ${formatCandlestick(accumulator.allTime)}`);
    console.log("-----------------------------------");
  }
  
  // Verify final state
  assertEquals(accumulator.oneSample.length, values.length);
  assertEquals(accumulator.twoSamples.length, Math.floor(values.length / 2));
  assertEquals(accumulator.fiveSamples.length, Math.floor(values.length / 5));
  
  // Verify specific candlesticks at key positions
  
  // At position 7 (value 9)
  let position7Accumulator = createEmptyAccumulator();
  for (let i = 0; i <= 7; i++) {
    position7Accumulator = processValue(position7Accumulator, values[i]);
  }
  
  console.log("At position 7 in the values list");
  console.log(`one_sample: ${formatCandlesticks(position7Accumulator.oneSample)}`);
  console.log(`two_samples: ${formatCandlesticks(position7Accumulator.twoSamples)}`);
  console.log(`five_samples: ${formatCandlesticks(position7Accumulator.fiveSamples)}`);
  console.log(`all_time: ${formatCandlestick(position7Accumulator.allTime)}`);
  
  // At position 12 (value 9)
  let position12Accumulator = createEmptyAccumulator();
  for (let i = 0; i <= 12; i++) {
    position12Accumulator = processValue(position12Accumulator, values[i]);
  }
  
  console.log("At position 12 in the values list");
  console.log(`one_sample: ${formatCandlesticks(position12Accumulator.oneSample)}`);
  console.log(`two_samples: ${formatCandlesticks(position12Accumulator.twoSamples)}`);
  console.log(`five_samples: ${formatCandlesticks(position12Accumulator.fiveSamples)}`);
  console.log(`all_time: ${formatCandlestick(position12Accumulator.allTime)}`);
});

// Helper functions to format candlesticks in a cleaner way
function formatCandlestick(candlestick: Candlestick): string {
  if (candlestick.open === null || candlestick.close === null || 
      candlestick.high === null || candlestick.low === null) {
    return "empty";
  }
  return `[${candlestick.open},${candlestick.close},${candlestick.high},${candlestick.low}]`;
}

function formatCandlesticks(candlesticks: Candlestick[]): string {
  if (candlesticks.length === 0) return "empty";
  return candlesticks.map(formatCandlestick).join(" ");
} 