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
  // assertEquals(accumulator.twoSamples[0], nominal);
  // // Verify five-sample candlesticks (should be empty)
  // assertEquals(accumulator.fiveSamples.length, 1);
  // assertEquals(accumulator.fiveSamples[0], nominal);
  // Verify all-time candlestick
  assertEquals(accumulator.allTime, nominal);
}); 