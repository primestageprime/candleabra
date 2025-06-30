import { toCandlestick, reduceCandlesticks, toSample } from "./candlestick.ts";
import { DateTime, Duration } from "luxon";
import { renderSmartCandlesticks } from "./renderCandlesticks.ts";
import * as R from "ramda";
import type { Candlestick, Sample } from "./types.d.ts";
import { createProcessor, processSample, getResults } from "./processor.ts";

const baseTime = DateTime.fromISO("2025-06-27T00:00:00Z");

const minute = 60;
const hour = 60 * minute;
const day = 24 * hour;

const atomics = [
  // === ATOMIC SAMPLES (until we generate a 1-minute sample) ===
  // First minute: 00:00:00 to 00:01:00
  [1, 0],      // 00:00:00 - start of minute
  [50, 30],    // 00:00:30 - middle of minute  
  [3, 59],     // 00:00:59 - end of minute
  [1, 60],     // 00:01:00 - start of next minute (triggers 1m completion)
  
  // Second minute: 00:01:00 to 00:02:00
  [5, 90],     // 00:01:30 - middle
  [10, 119],   // 00:01:59 - end
  [2, 120],    // 00:02:00 - start of next minute
  
  // Third minute: 00:02:00 to 00:03:00
  [8, 150],    // 00:02:30 - middle
  [15, 179],   // 00:02:59 - end
  [4, 180],    // 00:03:00 - start of next minute
  
  // Fourth minute: 00:03:00 to 00:04:00
  [12, 210],   // 00:03:30 - middle
  [20, 239],   // 00:03:59 - end
  [6, 240],    // 00:04:00 - start of next minute
  
  // Fifth minute: 00:04:00 to 00:05:00
  [18, 270],   // 00:04:30 - middle
  [25, 299],   // 00:04:59 - end
  [9, 300],    // 00:05:00 - start of next minute (triggers 5m completion)
  
  // === 1-MINUTE SAMPLES (until we generate a 5-minute sample) ===
  // First sample at start of 5-minute period
  [7, 300],    // 00:05:00 - start of period
  
  // Sample at 3rd minute
  [13, 480],   // 00:08:00 - middle of period
  
  // Sample at end of 5-minute period
  [23, 600],   // 00:10:00 - end of period (triggers 5m completion)
  
  // === 5-MINUTE SAMPLES (until we generate a 1-hour sample) ===
  // === 5-MINUTE SAMPLES (until we generate a 1-hour sample) ===
  // First 5-minute sample at start of hour
  [26, 630],   // 00:10:01
  [39, 780],   // 00:13:00
  [49, 899],   // 00:14:59
  [46, 900],   // 00:15:00 (triggers 5m completion)
  
  // Middle of hour (around 00:30:00)
  [91, 1770],  // 00:29:30
  [93, 1799],  // 00:29:59
  [92, 1800],  // 00:30:00 (triggers 5m completion)
  [108, 2099], // 00:34:59
  [107, 2100], // 00:35:00 (triggers 5m completion)
  
  // End of hour (around 00:55:00)
  [183, 3599], // 00:59:59
  [182, 3600], // 01:00:00 - start of next hour (triggers 1h completion)
  
  // === 1-HOUR SAMPLES (until we generate a 1-day sample) ===
  // Continue with hourly samples...
  [184, 3630], // 01:00:01
  [186, 3659], // 01:30:00
  [188, 3720], // 01:59:59
  [187, 3721], // 02:00:00 - start of next hour (triggers 1h completion)
  [189, 3750], // 02:30:00
  [191, 3779], // 02:59:59
  [190, 3780], // 03:00:00 - start of next hour (triggers 1h completion)
  [192, 3810], // 03:30:00
  [194, 3839], // 03:59:59
  [193, 3840], // 04:00:00 - start of next hour (triggers 1h completion)
  [195, 3870], // 04:30:00
  
  // Jump to hour 23 (last hour of the day)
  [200, 23 * hour + 30],   // 15:00:00
  [202, 23 * hour + 59],   // 15:59:59
  [201, 24 * hour],        // 16:00:00 - start of next day (triggers 1d completion)
  
  // Final sample to trigger day completion
  [220, 24 * hour],        // 00:00:00 next day (triggers 1d completion)
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