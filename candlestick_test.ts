import { assertEquals } from "std/testing/asserts.ts";
import { 
  createEmptyAccumulator, 
  processValue,
} from "./candlestick.ts";

const values = [1,1,1,1,1, 1,1,9,9,1, 1,1,9,1,1, 1,1,1,1,1]

const nominal = {open: 1, close: 1, high: 1, low: 1}
const critical = {open: 9, close: 9, high: 9, low: 9}
const critical_new = {open: 1, close: 9, high: 9, low: 1}
const resolved = {open: 9, close: 1, high: 9, low: 1}
const spike = {open: 1, close: 1, high: 9, low: 1}
const temporary_resolution = {open: 9, close: 9, high: 9, low: 1}

Deno.test('should process first value correctly', () => {
  let accumulator = createEmptyAccumulator();
  
  // Process first value
  accumulator = processValue(accumulator, values[0]);
  
  
  // Verify one-sample candlesticks
  assertEquals(accumulator.oneSample.length, 1);
  assertEquals(accumulator.oneSample[0], nominal);
  
  // Verify two-sample candlesticks (should be empty)
  assertEquals(accumulator.twoSamples.length, 1);
  assertEquals(accumulator.twoSamples[0], nominal);
  // Verify five-sample candlesticks (should be empty)
  assertEquals(accumulator.fiveSamples.length, 1);
  assertEquals(accumulator.fiveSamples[0], nominal);
  // Verify all-time candlestick
  assertEquals(accumulator.allTime, nominal);
}); 

Deno.test('should process second value correctly', () => {
  let accumulator = {
    oneSample: [nominal],
    twoSamples: [nominal],
    fiveSamples: [nominal],
    allTime: nominal
  }

  // Process first value
  accumulator = processValue(accumulator, values[1]);
  
  // Verify one-sample candlesticks
  assertEquals(accumulator.oneSample.length, 2);
  assertEquals(accumulator.oneSample[1], nominal);

  // Verify two-sample candlesticks
  assertEquals(accumulator.twoSamples.length, 2);
  assertEquals(accumulator.twoSamples[1], nominal);

  // Verify five-sample candlesticks
  assertEquals(accumulator.fiveSamples.length, 2);
  assertEquals(accumulator.fiveSamples[1], nominal);
}); 

Deno.test('should process 7th value correctly', () => {
  let accumulator = {
    oneSample: [nominal],
    twoSamples: [nominal],
    fiveSamples: [nominal],
    allTime: nominal
  } 

  // Process first value
  accumulator = processValue(accumulator, values[7]);
  
  // Verify one-sample candlesticks
  assertEquals(accumulator.oneSample.length, 2);
  assertEquals(accumulator.oneSample[1], critical);

  // Verify two-sample candlesticks
  assertEquals(accumulator.twoSamples.length, 2);
  assertEquals(accumulator.twoSamples[1], critical_new);

  // Verify five-sample candlesticks
  assertEquals(accumulator.fiveSamples.length, 2);
  assertEquals(accumulator.fiveSamples[1], critical_new);
  
  // Verify all-time candlestick
  assertEquals(accumulator.allTime, critical_new);
}); 

Deno.test('should process 8th value correctly', () => {
  let accumulator = {
    oneSample: [nominal, critical],
    twoSamples: [nominal, critical_new],
    fiveSamples: [nominal, critical_new],
    allTime: critical_new
  } 

  // Process first value
  accumulator = processValue(accumulator, values[8]);
  
  // Verify one-sample candlesticks
  assertEquals(accumulator.oneSample.length, 3);
  assertEquals(accumulator.oneSample[2], critical);

  // Verify two-sample candlesticks
  assertEquals(accumulator.twoSamples.length, 3);
  assertEquals(accumulator.twoSamples[2], critical);

  // Verify five-sample candlesticks
  assertEquals(accumulator.fiveSamples.length, 3);
  assertEquals(accumulator.fiveSamples[2], critical_new);

  // Verify all-time candlestick
  assertEquals(accumulator.allTime, critical_new);
  }); 

Deno.test('should process 9th value correctly', () => {
  let accumulator = {
    oneSample: [nominal, critical, critical],
    twoSamples: [nominal, nominal, critical],
    fiveSamples: [nominal, critical_new, critical_new],
    allTime: critical_new
  } 

  // Process first value
  accumulator = processValue(accumulator, values[9]);

  // Verify one-sample candlesticks
  assertEquals(accumulator.oneSample.length, 4);
  assertEquals(accumulator.oneSample[3], nominal);
  
  // Verify two-sample candlesticks
  assertEquals(accumulator.twoSamples.length, 4);
  assertEquals(accumulator.twoSamples[3], resolved);

  // Verify five-sample candlesticks
  assertEquals(accumulator.fiveSamples.length, 4);
  assertEquals(accumulator.fiveSamples[3], spike);

  // Verify all-time candlestick
  assertEquals(accumulator.allTime, spike);
}); 
// [1,1,1,1,1, 1,1,9,9,1, 1,1,9,1,1, 1,1,1,1,1]
Deno.test('should process 12th value correctly', () => {
  let accumulator = {
    oneSample: [critical, nominal, nominal, nominal],
    twoSamples: [resolved, nominal],
    fiveSamples: [nominal,resolved],
    allTime: spike
  }

  // Process first value
  accumulator = processValue(accumulator, values[12]);

  console.log(accumulator)
  // Verify one-sample candlesticks
  assertEquals(accumulator.oneSample.length, 5);
  assertEquals(accumulator.oneSample[4], critical);

  // Verify two-sample candlesticks
  assertEquals(accumulator.twoSamples.length, 3);
  assertEquals(accumulator.twoSamples[2], critical_new);

  // Verify five-sample candlesticks
  assertEquals(accumulator.fiveSamples.length, 3);
  assertEquals(accumulator.fiveSamples[2], temporary_resolution);
  
  // Verify all-time candlestick
  assertEquals(accumulator.allTime, critical_new);
});