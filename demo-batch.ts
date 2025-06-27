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

// Batch processing - run through all iterations at once
function runBatchProcessing() {
  console.log("=== Batch Processing - Memory Management Validation ===");
  
  // Create functional processor
  const processor = createProcessor(["1m", "5m", "1h", "1d"]);
  let state = processor;
  
  // Track memory usage at key points
  const memorySnapshots: Array<{
    iteration: number;
    sample: string;
    atomicCount: number;
    tierHistories: Array<{ name: string; count: number }>;
  }> = [];
  
  for (let i = 0; i < atomics.length; i++) {
    const sample = atomics[i];
    
    // Process sample through functional processor
    const result = processSample(state, sample);
    state = result.updatedState;
    
    // Take memory snapshot at key points
    if (i % 5 === 0 || i === atomics.length - 1) {
      const currentResults = getResults(state);
      memorySnapshots.push({
        iteration: i + 1,
        sample: `${sample.value}@${sample.dateTime.toFormat("HH:mm:ss")}`,
        atomicCount: result.atomics.length,
        tierHistories: currentResults.map(({ name, candlesticks }) => ({
          name,
          count: candlesticks.length
        }))
      });
    }
  }
  
  // Display final results
  console.log("\n=== Final Results ===");
  const finalResults = getResults(state);
  finalResults.forEach(({ name, candlesticks }) => {
    if (candlesticks.length > 0) {
      console.log(`\n${name} samples (${candlesticks.length} total):`);
      renderSmartCandlesticks(candlesticks, name);
    }
  });
  
  // Display memory management analysis
  console.log("\n=== Memory Management Analysis ===");
  memorySnapshots.forEach(snapshot => {
    console.log(`\nIteration ${snapshot.iteration} (${snapshot.sample}):`);
    console.log(`  Atomic samples: ${snapshot.atomicCount}`);
    snapshot.tierHistories.forEach(tier => {
      console.log(`  ${tier.name} history: ${tier.count} candlesticks`);
    });
  });
  
  // Validate memory management expectations
  console.log("\n=== Memory Management Validation ===");
  const finalSnapshot = memorySnapshots[memorySnapshots.length - 1];
  
  // Check that we're not keeping excessive history
  const oneMinuteTier = finalSnapshot.tierHistories.find(t => t.name === "1m");
  const fiveMinuteTier = finalSnapshot.tierHistories.find(t => t.name === "5m");
  const oneHourTier = finalSnapshot.tierHistories.find(t => t.name === "1h");
  
  console.log("Validation Results:");
  console.log(`  1m history count: ${oneMinuteTier?.count} (should be minimal - only needed for 5m)`);
  console.log(`  5m history count: ${fiveMinuteTier?.count} (should be minimal - only needed for 1h)`);
  console.log(`  1h history count: ${oneHourTier?.count} (should be minimal - only needed for 1d)`);
  console.log(`  Atomic samples: ${finalSnapshot.atomicCount} (should be ≤60 for 1-minute window)`);
  
  // Expected behavior validation
  const validations = [
    {
      name: "Atomic samples pruned",
      condition: finalSnapshot.atomicCount <= 60,
      description: "Atomic samples should be pruned to only keep what's needed for 1-minute buckets"
    },
    {
      name: "1m history minimal",
      condition: (oneMinuteTier?.count || 0) <= 12, // Should only keep enough for 5m buckets
      description: "1-minute history should be minimal, only keeping what's needed for 5-minute aggregation"
    },
    {
      name: "5m history minimal", 
      condition: (fiveMinuteTier?.count || 0) <= 12, // Should only keep enough for 1h buckets
      description: "5-minute history should be minimal, only keeping what's needed for 1-hour aggregation"
    }
  ];
  
  validations.forEach(validation => {
    const status = validation.condition ? "✅ PASS" : "❌ FAIL";
    console.log(`${status} ${validation.name}: ${validation.description}`);
  });
}

// Run the batch processing
runBatchProcessing(); 