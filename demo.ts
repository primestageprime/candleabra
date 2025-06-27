import { toCandlestick, reduceCandlesticks, toSample } from "./candlestick.ts";
import { DateTime, Duration } from "luxon";
import { renderSmartCandlesticks } from "./renderCandlesticks.ts";
import * as R from "ramda";
import type { Candlestick, Sample } from "./types.d.ts";
import { createProcessor, processSample, getResults } from "./processor.ts";

const baseTime = DateTime.fromISO("2025-06-27T00:00:00Z");

const makeSample = (value: number, offset: number) => toCandlestick(toSample(value, baseTime.plus({ seconds: offset })));

const minute = 60;
const hour = 60 * minute;
const day = 24 * hour;

const atomics = [
  [1, 0],
  [50, 1],
  [3, 10],
  [1, 20],
  [5, 30],
  [3, 40],
  [1, 50],
  [5, 60],
  [3, 61],
  [1, 62],
  [5, 70],
  [3, 80],
  [1, 90],
  [5, 100],
  [3, 110],
  [1, 120],
  [5, 121],
  [3, 122],
  [1, minute * 3],
  [5, minute * 4],
  [20, minute * 5],
  [10, minute * 6],
  [20, hour + minute * 2],
  [10, hour + minute * 3],
  [20, hour + minute * 4],
  [10, hour + minute * 5],
  [20, hour * 2 + minute ],
  [6, hour * 2 + minute * 2],
  [10, hour * 3 + minute * 3],
  [20, hour * 3 + minute * 4],
  [10, hour * 3 + minute * 5],
  [20, hour * 3 + minute * 6],
  [10, hour * 24 + minute * 2],
  [20, hour * 24 + minute * 3],
  [10, hour * 24 + minute * 4],
].map(([value, offset]) => toSample(value, baseTime.plus({ seconds: offset })));


function sliceCandlesticksByGranularity(candlesticks: Candlestick[], granularity: string): Candlestick[] {
  // Parse granularity (e.g., "1m", "5m", "2h", "5d")
  const match = granularity.match(/^(\d+)([mhd])$/);
  if (!match) {
    throw new Error(`Invalid granularity format: ${granularity}. Expected format like "1m", "5m", "2h", "5d"`);
  }
  
  const [, amountStr, unit] = match;
  const amount = parseInt(amountStr, 10);
  
  // Validate that the amount divides evenly into the base unit
  const baseUnits = { m: 60, h: 24, d: 1 };
  const baseUnit = baseUnits[unit as keyof typeof baseUnits];
  if (baseUnit % amount !== 0) {
    throw new Error(`Invalid granularity: ${granularity}. ${amount} does not divide evenly into ${baseUnit} ${unit}`);
  }
  
  // Group candlesticks by their closeAt time, rounded to the granularity
  const timeSlices = R.groupBy((candlestick) => {
    const closeAt = candlestick.closeAt;
    let bucketStart: DateTime;
    
    switch (unit) {
      case 'm': {
        // Round to nearest minute interval
        const minutes = Math.floor(closeAt.minute / amount) * amount;
        bucketStart = closeAt.set({ minute: minutes, second: 0, millisecond: 0 });
        break;
      }
      case 'h': {
        // Round to nearest hour interval
        const hours = Math.floor(closeAt.hour / amount) * amount;
        bucketStart = closeAt.set({ hour: hours, minute: 0, second: 0, millisecond: 0 });
        break;
      }
      case 'd': {
        // Round to nearest day interval (for now, just use the day)
        bucketStart = closeAt.set({ hour: 0, minute: 0, second: 0, millisecond: 0 });
        break;
      }
      default:
        throw new Error(`Unsupported unit: ${unit}`);
    }
    
    return bucketStart.toISO();
  }, candlesticks);
  
  // Reduce each group of candlesticks into a single candlestick
  return R.map((candlestickGroup) => {
    if (!candlestickGroup || candlestickGroup.length === 0) {
      throw new Error("Empty candlestick group found");
    }
    
    const reduced = reduceCandlesticks(candlestickGroup as R.NonEmptyArray<Candlestick>);
    
    // Get the bucket start time from the group key
    const bucketStart = DateTime.fromISO(candlestickGroup[0].closeAt.toISO());
    let bucketStartRounded: DateTime;
    
    switch (unit) {
      case 'm': {
        const minutes = Math.floor(bucketStart.minute / amount) * amount;
        bucketStartRounded = bucketStart.set({ minute: minutes, second: 0, millisecond: 0 });
        break;
      }
      case 'h': {
        const hours = Math.floor(bucketStart.hour / amount) * amount;
        bucketStartRounded = bucketStart.set({ hour: hours, minute: 0, second: 0, millisecond: 0 });
        break;
      }
      case 'd': {
        bucketStartRounded = bucketStart.set({ hour: 0, minute: 0, second: 0, millisecond: 0 });
        break;
      }
      default:
        throw new Error(`Unsupported unit: ${unit}`);
    }
    
    // Calculate bucket end time
    let bucketEnd: DateTime;
    switch (unit) {
      case 'm':
        bucketEnd = bucketStartRounded.plus({ minutes: amount });
        break;
      case 'h':
        bucketEnd = bucketStartRounded.plus({ hours: amount });
        break;
      case 'd':
        bucketEnd = bucketStartRounded.plus({ days: amount });
        break;
      default:
        throw new Error(`Unsupported unit: ${unit}`);
    }
    
    return {
      ...reduced,
      openAt: bucketStartRounded,
      closeAt: bucketEnd,
    };
  }, R.values(timeSlices));
}

// Time-weighted mean calculation
function calculateTimeWeightedMean(candlesticks: Candlestick[]): number {
  if (candlesticks.length === 1) {
    return candlesticks[0].mean;
  }
  
  let totalWeightedValue = 0;
  let totalDuration = 0;
  
  for (let i = 0; i < candlesticks.length; i++) {
    const candlestick = candlesticks[i];
    const duration = candlestick.closeAt.diff(candlestick.openAt, "milliseconds").as("milliseconds");
    totalWeightedValue += candlestick.mean * duration;
    totalDuration += duration;
  }
  
  return totalDuration > 0 ? totalWeightedValue / totalDuration : 0;
}

// Interactive streaming - press space to advance
async function runInteractiveStreaming() {
  const decoder = new TextDecoder();
  
  // Set up stdin for raw mode
  const stdin = Deno.stdin;
  await stdin.setRaw(true);
  
  // Create functional processor
  const processor = createProcessor(["1m", "5m", "1h", "1d"]);
  let state = processor;
  
  try {
    for (let i = 0; i < atomics.length; i++) {
      const sample = atomics[i];
      
      console.log(`\n--- Iteration ${i + 1}: Sample ${sample.value} at ${sample.dateTime.toFormat("HH:mm:ss")} ---`);
      
      // Process sample through functional processor
      const result = processSample(state, sample);
      
      // Update state with the new state from processing
      state = result.updatedState;
      
      // Display atomic samples
      console.log("Atomic samples:");
      const atomicCandlesticks = result.atomics.map(sample => ({
        open: sample.value,
        close: sample.value,
        high: sample.value,
        low: sample.value,
        mean: sample.value,
        openAt: sample.dateTime,
        closeAt: sample.dateTime,
      }));
      renderSmartCandlesticks(atomicCandlesticks, "1s");
      
      // Display current state of each tier
      const currentResults = getResults(state);
      currentResults.forEach(({ name, candlesticks }) => {
        if (candlesticks.length > 0) {
          console.log(`${name} samples:`);
          renderSmartCandlesticks(candlesticks, name);
        }
      });
      
      if (i < atomics.length - 1) {
        console.log("\nPress SPACE to continue to next iteration...");
        
        // Wait for space key
        while (true) {
          const buffer = new Uint8Array(1);
          await stdin.read(buffer);
          const char = decoder.decode(buffer);
          
          if (char === " ") {
            break;
          } else if (char === "\u0003") { // Ctrl+C
            console.log("\nExiting...");
            return;
          }
        }
      }
      
      console.log("=".repeat(80));
    }
    
    console.log("\nStreaming complete!");
  } finally {
    // Restore stdin to normal mode
    await stdin.setRaw(false);
  }
}

// Run the interactive streaming
await runInteractiveStreaming();