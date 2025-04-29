import { assertStrictEquals } from "std/testing/asserts.ts";
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
  assertStrictEquals(accumulator.oneSample.length, 1);
  assertStrictEquals(JSON.stringify(accumulator.oneSample[0]), JSON.stringify(nominal));
  
  // Verify two-sample candlesticks (should be empty)
  assertStrictEquals(accumulator.twoSamples.length, 1);
  assertStrictEquals(JSON.stringify(accumulator.twoSamples[0]), JSON.stringify(nominal));
  // Verify five-sample candlesticks (should be empty)
  assertStrictEquals(accumulator.fiveSamples.length, 1);
  assertStrictEquals(JSON.stringify(accumulator.fiveSamples[0]), JSON.stringify(nominal));
  // Verify all-time candlestick
  assertStrictEquals(JSON.stringify(accumulator.allTime), JSON.stringify(nominal));
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
  assertStrictEquals(accumulator.oneSample.length, 2);
  assertStrictEquals(JSON.stringify(accumulator.oneSample[1]), JSON.stringify(nominal));

  // Verify two-sample candlesticks
  assertStrictEquals(accumulator.twoSamples.length, 2);
  assertStrictEquals(JSON.stringify(accumulator.twoSamples[1]), JSON.stringify(nominal));

  // Verify five-sample candlesticks
  assertStrictEquals(accumulator.fiveSamples.length, 2);
  assertStrictEquals(JSON.stringify(accumulator.fiveSamples[1]), JSON.stringify(nominal));
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
  assertStrictEquals(accumulator.oneSample.length, 2);
  assertStrictEquals(JSON.stringify(accumulator.oneSample[1]), JSON.stringify(critical));

  // Verify two-sample candlesticks
  assertStrictEquals(accumulator.twoSamples.length, 2);
  assertStrictEquals(JSON.stringify(accumulator.twoSamples[1]), JSON.stringify(critical_new));

  // Verify five-sample candlesticks
  assertStrictEquals(accumulator.fiveSamples.length, 2);
  assertStrictEquals(JSON.stringify(accumulator.fiveSamples[1]), JSON.stringify(critical_new));
  
  // Verify all-time candlestick
  assertStrictEquals(JSON.stringify(accumulator.allTime), JSON.stringify(critical_new));
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
  assertStrictEquals(accumulator.oneSample.length, 3);
  assertStrictEquals(JSON.stringify(accumulator.oneSample[2]), JSON.stringify(critical));

  // Verify two-sample candlesticks
  assertStrictEquals(accumulator.twoSamples.length, 3);
  assertStrictEquals(JSON.stringify(accumulator.twoSamples[2]), JSON.stringify(critical));

  // Verify five-sample candlesticks
  assertStrictEquals(accumulator.fiveSamples.length, 3);
  assertStrictEquals(JSON.stringify(accumulator.fiveSamples[2]), JSON.stringify(critical_new));

  // Verify all-time candlestick
  assertStrictEquals(JSON.stringify(accumulator.allTime), JSON.stringify(critical_new));
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
  assertStrictEquals(accumulator.oneSample.length, 4);
  assertStrictEquals(JSON.stringify(accumulator.oneSample[3]), JSON.stringify(nominal));
  
  // Verify two-sample candlesticks
  assertStrictEquals(accumulator.twoSamples.length, 4);
  assertStrictEquals(JSON.stringify(accumulator.twoSamples[3]), JSON.stringify(resolved));

  // Verify five-sample candlesticks
  assertStrictEquals(accumulator.fiveSamples.length, 4);
  assertStrictEquals(JSON.stringify(accumulator.fiveSamples[3]), JSON.stringify(spike));

  // Verify all-time candlestick
  assertStrictEquals(JSON.stringify(accumulator.allTime), JSON.stringify(spike));
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
  assertStrictEquals(accumulator.oneSample.length, 5);
  assertStrictEquals(JSON.stringify(accumulator.oneSample[4]), JSON.stringify(critical));

  // Verify two-sample candlesticks
  assertStrictEquals(accumulator.twoSamples.length, 3);
  assertStrictEquals(JSON.stringify(accumulator.twoSamples[2]), JSON.stringify(critical_new));

  // Verify five-sample candlesticks
  assertStrictEquals(accumulator.fiveSamples.length, 3);
  assertStrictEquals(JSON.stringify(accumulator.fiveSamples[2]), JSON.stringify(temporary_resolution));
  
  // Verify all-time candlestick
  assertStrictEquals(JSON.stringify(accumulator.allTime), JSON.stringify(critical_new));
});

Deno.test('should process 18th value correctly', () => {
  let accumulator = {
    oneSample: [nominal, nominal, nominal, nominal],
    twoSamples: [nominal, nominal],
    fiveSamples: [spike, nominal],
    allTime: spike
  }

  // Process first value
  accumulator = processValue(accumulator, values[18]);

  console.log(accumulator)

  // Verify one-sample candlesticks
  assertStrictEquals(accumulator.oneSample.length, 5);
  assertStrictEquals(JSON.stringify(accumulator.oneSample[4]), JSON.stringify(nominal));
  
  // Verify two-sample candlesticks
  assertStrictEquals(accumulator.twoSamples.length, 3);
  assertStrictEquals(JSON.stringify(accumulator.twoSamples[2]), JSON.stringify(nominal));

  // Verify five-sample candlesticks
  assertStrictEquals(accumulator.fiveSamples.length, 3);
  assertStrictEquals(JSON.stringify(accumulator.fiveSamples[2]), JSON.stringify(nominal));

  // Verify all-time candlestick
  assertStrictEquals(JSON.stringify(accumulator.allTime), JSON.stringify(spike));
});