import { assertEquals, assertThrows } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { DateTime, Duration } from "luxon";
import { parseGranularity, createGranularities, getBucketStart } from "./granularity.ts";

Deno.test("parseGranularity", async (t) => {
  await t.step("should parse valid minute granularities", () => {
    const result = parseGranularity("1m");
    assertEquals(result.name, "1m");
    assertEquals(result.duration.as("minutes"), 1);
  });

  await t.step("should parse valid hour granularities", () => {
    const result = parseGranularity("2h");
    assertEquals(result.name, "2h");
    assertEquals(result.duration.as("hours"), 2);
  });

  await t.step("should parse valid day granularities", () => {
    const result = parseGranularity("5d");
    assertEquals(result.name, "5d");
    assertEquals(result.duration.as("days"), 5);
  });

  await t.step("should throw error for invalid format", () => {
    assertThrows(() => parseGranularity("invalid"), Error, "Invalid granularity format");
  });

  await t.step("should throw error for non-divisible amounts", () => {
    assertThrows(() => parseGranularity("7m"), Error, "does not divide evenly");
  });
});

Deno.test("createGranularities", async (t) => {
  await t.step("should create multiple granularities", () => {
    const config = ["1m", "5m", "1h"];
    const result = createGranularities(config);
    
    assertEquals(result.length, 3);
    assertEquals(result[0].name, "1m");
    assertEquals(result[1].name, "5m");
    assertEquals(result[2].name, "1h");
  });
});

Deno.test("getBucketStart", async (t) => {
  await t.step("should align to minute boundaries", () => {
    const dateTime = DateTime.fromISO("2024-01-01T10:30:45.123Z");
    const duration = Duration.fromObject({ minutes: 5 });
    const result = getBucketStart(dateTime, duration);
    
    // Should align to 5-minute boundary
    assertEquals(result.toFormat("HH:mm"), "10:30");
  });

  await t.step("should align to hour boundaries", () => {
    const dateTime = DateTime.fromISO("2024-01-01T10:30:45.123Z");
    const duration = Duration.fromObject({ hours: 1 });
    const result = getBucketStart(dateTime, duration);
    
    // Should align to hour boundary
    assertEquals(result.toFormat("HH:mm"), "10:00");
  });
}); 