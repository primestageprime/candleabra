import { assertEquals } from "https://deno.land/std@0.220.1/assert/mod.ts";
import { DateTime } from "luxon";
import { 
  createProcessor, 
  processSample, 
  toSample, 
  getResults,
  parseGranularity 
} from "./index.ts";

Deno.test("Refactored API - Basic Processing", async (t) => {
  await t.step("should create processor with tiers", () => {
    const processor = createProcessor(["1m", "5m", "1h"]);
    assertEquals(processor.tiers.length, 3);
    assertEquals(processor.tiers[0].granularity.name, "1m");
    assertEquals(processor.tiers[1].granularity.name, "5m");
    assertEquals(processor.tiers[2].granularity.name, "1h");
  });

  await t.step("should process single sample", () => {
    const processor = createProcessor(["1m"]);
    const sample = toSample(100, DateTime.fromISO("2025-01-01T10:00:00Z"));
    const result = processSample(processor, sample);
    
    assertEquals(result.atomics.length, 1);
    assertEquals(result.atomics[0].value, 100);
    assertEquals(result.tierResults.length, 1);
    assertEquals(result.tierResults[0].open, 100);
    assertEquals(result.tierResults[0].close, 100);
  });

  await t.step("should parse granularity correctly", () => {
    const granularity = parseGranularity("5m");
    assertEquals(granularity.name, "5m");
    assertEquals(granularity.duration.as("minutes"), 5);
  });

  await t.step("should get results correctly", () => {
    const processor = createProcessor(["1m"]);
    const sample = toSample(100, DateTime.fromISO("2025-01-01T10:00:00Z"));
    const result = processSample(processor, sample);
    const results = getResults(result.updatedState);
    
    assertEquals(results.length, 1);
    assertEquals(results[0].name, "1m");
    assertEquals(results[0].candlesticks.length, 1);
    assertEquals(results[0].candlesticks[0].open, 100);
  });
});

Deno.test("Processor - Tier boundary and history/pruning edge cases", async (t) => {
  await t.step("should add new 1m candlestick to history when crossing minute boundary", () => {
    const processor = createProcessor(["1m"]);
    const t0 = DateTime.fromISO("2025-01-01T10:00:00Z");
    const t1 = t0.plus({ seconds: 30 });
    const t2 = t0.plus({ minutes: 1 }); // new minute
    let state = processor;
    state = processSample(state, toSample(1, t0)).updatedState;
    state = processSample(state, toSample(2, t1)).updatedState;
    // Should still be in the same 1m bucket
    assertEquals(state.tiers[0].history.length, 0);
    state = processSample(state, toSample(3, t2)).updatedState;
    // Should have finalized the first 1m candlestick
    assertEquals(state.tiers[0].history.length, 1);
    assertEquals(state.tiers[0].history[0].open, 1);
    assertEquals(state.tiers[0].history[0].close, 2);
    // Current candlestick is for the new minute
    assertEquals(state.tiers[0].current?.open, 3);
  });

  await t.step("should add new 5m candlestick to history when crossing 5m boundary", () => {
    const processor = createProcessor(["1m", "5m"]);
    const t0 = DateTime.fromISO("2025-01-01T10:00:00Z");
    let state = processor;
    // Add 6 samples, one per minute, to cross a 5m boundary
    for (let i = 0; i < 6; i++) {
      state = processSample(state, toSample(i + 1, t0.plus({ minutes: i }))).updatedState;
    }
    // 1m tier should have 1 in history (pruned after 5m finalized), 1 current
    assertEquals(state.tiers[0].history.length, 1);
    // 5m tier should have 1 in history (first 5m), 1 current (6th sample starts new 5m)
    assertEquals(state.tiers[1].history.length, 1);
    assertEquals(state.tiers[1].history[0].open, 1);
    assertEquals(state.tiers[1].history[0].close, 5);
    assertEquals(state.tiers[1].current?.open, 6);
  });

  await t.step("should prune 1m history after 5m history is finalized", () => {
    const processor = createProcessor(["1m", "5m"]);
    const t0 = DateTime.fromISO("2025-01-01T10:00:00Z");
    let state = processor;
    // Add 10 samples, one per minute, to create 2 finalized 5m candlesticks
    for (let i = 0; i < 10; i++) {
      state = processSample(state, toSample(i + 1, t0.plus({ minutes: i }))).updatedState;
    }
    // 1m tier should be pruned to only those 1m candlesticks that are >= the closeAt of the last 5m history
    const last5mClose = state.tiers[1].history[state.tiers[1].history.length - 1].closeAt;
    const pruned1m = state.tiers[0].history.filter(c => c.closeAt >= last5mClose);
    assertEquals(state.tiers[0].history, pruned1m);
  });

  await t.step("should handle custom tier configuration (1m, 15m, 1h)", () => {
    const processor = createProcessor(["1m", "15m", "1h"]);
    const t0 = DateTime.fromISO("2025-01-01T00:00:00Z");
    let state = processor;
    // Add 16 samples, one per minute, to cross a 15m boundary
    for (let i = 0; i < 16; i++) {
      state = processSample(state, toSample(i + 1, t0.plus({ minutes: i }))).updatedState;
    }
    // 1m tier: 1 in history (pruned after 15m finalized), 1 current
    assertEquals(state.tiers[0].history.length, 1);
    // 15m tier: 1 in history, 1 current
    assertEquals(state.tiers[1].history.length, 1);
    assertEquals(state.tiers[1].history[0].open, 1);
    assertEquals(state.tiers[1].history[0].close, 15);
    assertEquals(state.tiers[1].current?.open, 16);
    // 1h tier: no finalized history yet
    assertEquals(state.tiers[2].history.length, 0);
  });
}); 