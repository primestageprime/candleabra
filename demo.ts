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
  [26, 630],   // 00:10:30
  [40, 659],   // 00:10:59
  [29, 660],   // 00:11:00
  
  [33, 690],   // 00:11:30
  [42, 719],   // 00:11:59
  [36, 720],   // 00:12:00
  
  [37, 750],   // 00:12:30
  [45, 779],   // 00:12:59
  [39, 780],   // 00:13:00
  
  [41, 810],   // 00:13:30
  [47, 839],   // 00:13:59
  [43, 840],   // 00:14:00
  
  [44, 870],   // 00:14:30
  [49, 899],   // 00:14:59
  [46, 900],   // 00:15:00 (triggers 5m completion)
  
  // Middle of hour (around 00:30:00)
  [91, 1770],  // 00:29:30
  [93, 1799],  // 00:29:59
  [92, 1800],  // 00:30:00 (triggers 5m completion)
  
  [94, 1830],  // 00:30:30
  [96, 1859],  // 00:30:59
  [95, 1860],  // 00:31:00
  
  [97, 1890],  // 00:31:30
  [99, 1919],  // 00:31:59
  [98, 1920],  // 00:32:00
  
  [100, 1950], // 00:32:30
  [102, 1979], // 00:32:59
  [101, 1980], // 00:33:00
  
  [103, 2010], // 00:33:30
  [105, 2039], // 00:33:59
  [104, 2040], // 00:34:00
  
  [106, 2070], // 00:34:30
  [108, 2099], // 00:34:59
  [107, 2100], // 00:35:00 (triggers 5m completion)
  
  // End of hour (around 00:55:00)
  [169, 3330], // 00:55:30
  [171, 3359], // 00:55:59
  [170, 3360], // 00:56:00
  
  [172, 3390], // 00:56:30
  [174, 3419], // 00:56:59
  [173, 3420], // 00:57:00
  
  [175, 3450], // 00:57:30
  [177, 3479], // 00:57:59
  [176, 3480], // 00:58:00
  
  [178, 3510], // 00:58:30
  [180, 3539], // 00:58:59
  [179, 3540], // 00:59:00
  
  [181, 3570], // 00:59:30
  [183, 3599], // 00:59:59
  [182, 3600], // 01:00:00 - start of next hour (triggers 1h completion)
  
  // === 1-HOUR SAMPLES (until we generate a 1-day sample) ===
  // Continue with hourly samples...
  [184, 3630], // 01:00:30
  [186, 3659], // 01:00:59
  [185, 3660], // 01:01:00
  
  [187, 3690], // 01:01:30
  [189, 3719], // 01:01:59
  [188, 3720], // 01:02:00
  
  // ... continue with hourly samples until we have 24 hours
  // For brevity, I'll jump to key hours:
  
  [190, 3750], // 01:02:30
  [192, 3779], // 01:02:59
  [191, 3780], // 01:03:00
  
  // Jump to hour 23 (last hour of the day)
  [200, 23 * hour + 30],   // 23:00:30
  [202, 23 * hour + 59],   // 23:00:59
  [201, 23 * hour + 60],   // 23:01:00
  
  [203, 23 * hour + 90],   // 23:01:30
  [205, 23 * hour + 119],  // 23:01:59
  [204, 23 * hour + 120],  // 23:02:00
  
  [206, 23 * hour + 150],  // 23:02:30
  [208, 23 * hour + 179],  // 23:02:59
  [207, 23 * hour + 180],  // 23:03:00
  
  [209, 23 * hour + 210],  // 23:03:30
  [211, 23 * hour + 239],  // 23:03:59
  [210, 23 * hour + 240],  // 23:04:00
  
  [212, 23 * hour + 270],  // 23:04:30
  [214, 23 * hour + 299],  // 23:04:59
  [213, 23 * hour + 300],  // 23:05:00 (triggers 5m completion)
  
  // Continue until we have 24 hours worth of 1-hour samples...
  [215, 23 * hour + 330],  // 23:05:30
  [217, 23 * hour + 359],  // 23:05:59
  [216, 23 * hour + 360],  // 23:06:00
  
  // ... continue with more hourly samples until we reach 24 hours
  
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