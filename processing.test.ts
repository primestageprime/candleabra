import { DateTime, Duration } from "luxon";
import { processSamples } from "./processing.ts";
import { toCandlestick, toSample } from "./core.ts";
import { assertEquals } from "jsr:@std/assert";
import type { Sample, Tier } from "./types.d.ts";

const testTime = DateTime.fromISO("2025-06-20T12:00:00.000Z");
const oneMinute = Duration.fromISO("PT1M");

Deno.test("processSamples should handle basic tier processing", () => {
  const sample1 = toSample(2, testTime);
  const sample2 = toSample(4, testTime.plus({ seconds: 30 }));
  const samples: R.NonEmptyArray<Sample> = [sample1, sample2];

  const tier: Tier = {
    name: "1m",
    duration: oneMinute,
    history: [],
    current: toCandlestick(sample1),
  };

  const tiers: R.NonEmptyArray<Tier> = [tier];

  const result = processSamples(tiers, samples);

  // Should return a single tier with updated current candlestick
  assertEquals(result.tiers.length, 1);
  assertEquals(result.tiers[0].name, "1m");
  assertEquals(result.tiers[0].current.close, 4);
  assertEquals(result.eternal.close, 4);
});
