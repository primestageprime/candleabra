import { DateTime } from "luxon";
import { renderSmartCandlesticks } from "./renderCandlesticks.ts";
import { toSample } from "./candlestick.ts";
import { createProcessor, processSample, getResults } from "./processor.ts";

const baseTime = DateTime.fromISO("2025-06-27T00:00:00Z");

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