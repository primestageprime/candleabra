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