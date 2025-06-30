import { DateTime } from "luxon";
import { createProcessor, processSample, toSample } from "./index.ts";

// Debug test to understand the behavior
const processor = createProcessor(["1m", "5m"]);
const t0 = DateTime.fromISO("2025-01-01T10:00:00Z");
let state = processor;

console.log("Initial state:");
console.log("1m tier history length:", state.tiers[0].history.length);
console.log("5m tier history length:", state.tiers[1].history.length);

// Add 6 samples, one per minute
for (let i = 0; i < 6; i++) {
  state = processSample(state, toSample(i + 1, t0.plus({ minutes: i }))).updatedState;
  console.log(`After sample ${i + 1}:`);
  console.log("  1m tier history length:", state.tiers[0].history.length);
  console.log("  5m tier history length:", state.tiers[1].history.length);
  if (state.tiers[1].history.length > 0) {
    console.log("  5m tier last history closeAt:", state.tiers[1].history[state.tiers[1].history.length - 1].closeAt.toFormat("HH:mm:ss"));
  }
  if (state.tiers[1].current) {
    console.log("  5m tier current openAt:", state.tiers[1].current.openAt.toFormat("HH:mm:ss"));
  }
} 