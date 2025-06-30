import { DateTime } from "luxon";
import { renderSmartCandlesticks } from "./renderCandlesticks.ts";
import { toSample } from "./candlestick.ts";
import { createProcessor, processSample, getResults } from "./processor.ts";

// Parse command line arguments
const args = Deno.args;
const tierConfig = args[0] || "default";

// Tier configurations
const tierConfigs = {
  default: ["1m", "5m", "1h", "1d"],
  extended: ["1m", "5m", "15m", "1h", "6h", "1d", "7d"]
};

if (!tierConfigs[tierConfig as keyof typeof tierConfigs]) {
  console.error(`Unknown tier config: ${tierConfig}`);
  console.error(`Available configs: ${Object.keys(tierConfigs).join(", ")}`);
  Deno.exit(1);
}

const selectedTiers = tierConfigs[tierConfig as keyof typeof tierConfigs];
console.log(`Running with tier config: ${tierConfig} - [${selectedTiers.join(", ")}]`);

const baseTime = DateTime.fromISO("2025-06-27T00:00:00Z");

const minute = 60;
const hour = 60 * minute;
const day = 24 * hour;

// Generate samples based on the tier configuration
function generateSamples(tiers: string[]) {
  const samples: [number, number][] = [];
  
  // Helper to add samples for a time period
  const addSamplesForPeriod = (startOffset: number, endOffset: number, count: number, maxValue: number) => {
    for (let i = 0; i < count; i++) {
      const offset = startOffset + (endOffset - startOffset) * (i / (count - 1));
      const value = Math.floor(Math.random() * maxValue) + 1;
      samples.push([value, offset]);
    }
  };

  // Atomic samples (first 5 minutes)
  addSamplesForPeriod(0, 5 * minute, 20, 50);
  
  // 1-minute samples (next 10 minutes)
  addSamplesForPeriod(5 * minute, 15 * minute, 10, 30);
  
  // 5-minute samples (next 30 minutes)
  addSamplesForPeriod(15 * minute, 45 * minute, 6, 25);
  
  // If we have 15m tier, add 15-minute samples
  if (tiers.includes("15m")) {
    addSamplesForPeriod(45 * minute, 2 * hour, 4, 20);
  }
  
  // 1-hour samples (next 6 hours)
  addSamplesForPeriod(2 * hour, 8 * hour, 6, 15);
  
  // If we have 6h tier, add 6-hour samples
  if (tiers.includes("6h")) {
    addSamplesForPeriod(8 * hour, 24 * hour, 3, 12);
  }
  
  // 1-day samples (next 7 days)
  addSamplesForPeriod(24 * hour, 8 * day, 7, 10);
  
  // If we have 7d tier, add 7-day samples
  if (tiers.includes("7d")) {
    addSamplesForPeriod(8 * day, 15 * day, 2, 8);
  }
  
  // Sort by offset
  samples.sort((a, b) => a[1] - b[1]);
  
  return samples.map(([value, offset]) => toSample(value, baseTime.plus({ seconds: offset })));
}

const samples = generateSamples(selectedTiers);

// Parse iterations argument
const iterationsArg = args.find(arg => arg.startsWith("--iterations="));
const iterations = iterationsArg ? parseInt(iterationsArg.split("=")[1]) : samples.length;

console.log(`=== Configurable Processing - Running ${iterations} iterations ===`);
console.log(`Tiers: [${selectedTiers.join(", ")}]`);
console.log(`Total samples available: ${samples.length}`);

// Create processor with selected tiers
const processor = createProcessor(selectedTiers);
let state = processor;

// Process samples
for (let i = 0; i < Math.min(iterations, samples.length); i++) {
  const sample = samples[i];
  
  console.log(`\n--- Iteration ${i + 1}: Sample ${sample.value} at ${sample.dateTime.toFormat("HH:mm:ss")} ---`);
  
  // Process sample through functional processor
  const result = processSample(state, sample);
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
  
  console.log("=".repeat(80));
}

console.log("\nConfigurable processing complete!"); 