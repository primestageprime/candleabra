import { DateTime, Duration } from "luxon";
import { assertEquals } from "jsr:@std/assert";
import { assertEqualsWithFloatTolerance } from "./testUtils.ts";
import {
  addSampleCandlestickToCurrent,
  processOverflow,
  processOverflowBranch,
  processOverflowLeaf,
  processPartial,
  processPartialBranch,
  processPartialLeaf,
  processSamples,
} from "./processing.ts";
import { toCandlestick } from "./core.ts";
import type { Candlestick, Sample, Tier } from "./types.d.ts";

const testTime = DateTime.fromISO("2025-06-20T12:00:00.000Z");
const oneMinute = Duration.fromISO("PT1M");
const fiveMinutes = Duration.fromISO("PT5M");
const oneHour = Duration.fromISO("PT1H");

// Test utilities
function createTier(
  name: string,
  duration: Duration,
  current: Candlestick,
  history: Candlestick[] = [],
): Tier {
  return {
    name,
    duration,
    current,
    history,
  };
}

function createSample(value: number, dateTime: DateTime): Sample {
  return { dateTime, value };
}

Deno.test("processSamples - partial update within tier duration", () => {
  const sample1 = createSample(2, testTime);
  const sample2 = createSample(4, testTime.plus({ seconds: 30 }));
  const samples: R.NonEmptyArray<Sample> = [sample1, sample2];

  const tier = createTier("1m", oneMinute, toCandlestick(sample1));
  const tiers: R.NonEmptyArray<Tier> = [tier];

  const result = processSamples(tiers, samples);

  assertEquals(result.tiers.length, 1);
  assertEquals(result.tiers[0].name, "1m");
  assertEquals(result.tiers[0].current.close, 4);
  assertEquals(result.tiers[0].current.high, 4);
  assertEquals(result.tiers[0].current.low, 2);
  assertEquals(result.eternal.close, 4);
});

Deno.test("processSamples - overflow triggers historization", () => {
  const sample1 = createSample(2, testTime);
  const sample2 = createSample(4, testTime.plus({ minutes: 2 })); // Exceeds 1 minute duration
  const samples: R.NonEmptyArray<Sample> = [sample1, sample2];

  const tier = createTier("1m", oneMinute, toCandlestick(sample1));
  const tiers: R.NonEmptyArray<Tier> = [tier];

  const result = processSamples(tiers, samples);

  assertEquals(result.tiers.length, 1);
  assertEquals(result.tiers[0].name, "1m");
  assertEquals(result.tiers[0].history.length, 3); // Should have 3 historized candlesticks (2 synthetic + 1 original)
  assertEquals(result.tiers[0].current.close, 4); // Current should be the new sample
  assertEquals(result.eternal.close, 4);
});

Deno.test("processSamples - multiple tiers with cascade", () => {
  const sample1 = createSample(2, testTime);
  const sample2 = createSample(4, testTime.plus({ minutes: 2 }));
  const samples: R.NonEmptyArray<Sample> = [sample1, sample2];

  const tier1 = createTier("1m", oneMinute, toCandlestick(sample1));
  const tier2 = createTier("5m", fiveMinutes, toCandlestick(sample1));
  const tiers: R.NonEmptyArray<Tier> = [tier1, tier2];

  const result = processSamples(tiers, samples);

  assertEquals(result.tiers.length, 2);
  assertEquals(result.tiers[0].name, "1m");
  assertEquals(result.tiers[1].name, "5m");
  assertEquals(result.tiers[0].history.length, 3); // 1m tier should have 3 historized candlesticks
  assertEquals(result.tiers[1].history.length, 0); // 5m tier should not have historized yet
});

Deno.test("processOverflow - branch node scenario", () => {
  const sample1 = createSample(2, testTime);
  const sample2 = createSample(4, testTime.plus({ minutes: 2 }));
  const currentCandlestick = toCandlestick(sample1);
  const newCandlestick = toCandlestick(sample2);
  const distance = Duration.fromISO("PT2M");

  const tier1 = createTier("1m", oneMinute, currentCandlestick);
  const tier2 = createTier("5m", fiveMinutes, currentCandlestick);
  const restTiers: R.NonEmptyArray<Tier> = [tier2];

  const result = processOverflow(
    tier1,
    newCandlestick,
    distance,
    [sample1, sample2],
    restTiers,
  );

  assertEquals(result.tiers.length, 2);
  assertEquals(result.tiers[0].name, "1m");
  assertEquals(result.tiers[1].name, "5m");
  assertEquals(result.tiers[0].history.length, 3); // Should have 3 historized candlesticks
});

Deno.test("processOverflowLeaf - creates new bucket correctly", () => {
  const sample1 = createSample(2, testTime);
  const sample2 = createSample(4, testTime.plus({ minutes: 2 }));
  const currentCandlestick = toCandlestick(sample1);
  const newCandlestick = toCandlestick(sample2);
  const historicalCandlestick = {
    ...currentCandlestick,
    closeAt: testTime.plus({ minutes: 1 }),
  };

  const tier = createTier("1m", oneMinute, currentCandlestick);
  const historicalCandlesticks: R.NonEmptyArray<Candlestick> = [
    historicalCandlestick,
  ];

  const result = processOverflowLeaf(
    tier,
    newCandlestick,
    historicalCandlesticks,
  );

  assertEquals(result.tiers.length, 1);
  assertEquals(result.tiers[0].current.close, 4);
  assertEquals(result.tiers[0].current.openAt, historicalCandlestick.closeAt);
  assertEquals(result.eternal.close, 4);
});

Deno.test("processOverflowBranch - cascades to child tiers", () => {
  const sample1 = createSample(2, testTime);
  const sample2 = createSample(4, testTime.plus({ minutes: 2 }));
  const currentCandlestick = toCandlestick(sample1);
  const newCandlestick = toCandlestick(sample2);
  const historicalCandlestick = {
    ...currentCandlestick,
    closeAt: testTime.plus({ minutes: 1 }),
  };

  const tier1 = createTier("1m", oneMinute, currentCandlestick);
  const tier2 = createTier("5m", fiveMinutes, currentCandlestick);
  const restTiers: R.NonEmptyArray<Tier> = [tier2];
  const historicalCandlesticks: R.NonEmptyArray<Candlestick> = [
    historicalCandlestick,
  ];

  const result = processOverflowBranch(
    tier1,
    restTiers,
    [sample1, sample2],
    historicalCandlesticks,
    newCandlestick,
  );

  assertEquals(result.tiers.length, 2);
  assertEquals(result.tiers[0].name, "1m");
  assertEquals(result.tiers[1].name, "5m");
  assertEquals(result.tiers[0].history.length, 1);
});

Deno.test("processPartial - branch node scenario", () => {
  const sample1 = createSample(2, testTime);
  const sample2 = createSample(4, testTime.plus({ seconds: 30 }));
  const currentCandlestick = toCandlestick(sample1);
  const newCandlestick = toCandlestick(sample2);

  const tier1 = createTier("1m", oneMinute, currentCandlestick);
  const tier2 = createTier("5m", fiveMinutes, currentCandlestick);
  const restTiers: R.NonEmptyArray<Tier> = [tier2];

  const result = processPartial(
    tier1,
    newCandlestick,
    restTiers,
    [sample1, sample2],
  );

  assertEquals(result.tiers.length, 2);
  assertEquals(result.tiers[0].name, "1m");
  assertEquals(result.tiers[1].name, "5m");
  assertEquals(result.tiers[0].current.close, 4);
});

Deno.test("addSampleCandlestickToCurrent - merges candlesticks correctly", () => {
  const sample1 = createSample(2, testTime);
  const sample2 = createSample(6, testTime.plus({ seconds: 30 }));
  const currentCandlestick = toCandlestick(sample1);
  const newCandlestick = toCandlestick(sample2);

  const tier = createTier("1m", oneMinute, currentCandlestick);
  const result = addSampleCandlestickToCurrent(tier, newCandlestick);

  assertEquals(result.current.open, 2);
  assertEquals(result.current.close, 6);
  assertEquals(result.current.high, 6);
  assertEquals(result.current.low, 2);
  assertEquals(result.name, "1m");
  assertEquals(result.duration, oneMinute);
});

Deno.test("processPartialLeaf - returns tier with current as eternal", () => {
  const sample = createSample(2, testTime);
  const candlestick = toCandlestick(sample);
  const tier = createTier("1m", oneMinute, candlestick);

  const result = processPartialLeaf(tier);

  assertEquals(result.tiers.length, 1);
  assertEquals(result.tiers[0], tier);
  assertEquals(result.eternal, candlestick);
});

Deno.test("processPartialBranch - cascades to child tiers", () => {
  const sample1 = createSample(2, testTime);
  const sample2 = createSample(4, testTime.plus({ seconds: 30 }));
  const currentCandlestick = toCandlestick(sample1);
  const newCandlestick = toCandlestick(sample2);

  const tier1 = createTier("1m", oneMinute, currentCandlestick);
  const tier2 = createTier("5m", fiveMinutes, currentCandlestick);
  const restTiers: R.NonEmptyArray<Tier> = [tier2];

  const updatedTier1 = addSampleCandlestickToCurrent(tier1, newCandlestick);
  const result = processPartialBranch(updatedTier1, restTiers, [
    sample1,
    sample2,
  ]);

  assertEquals(result.tiers.length, 2);
  assertEquals(result.tiers[0].name, "1m");
  assertEquals(result.tiers[1].name, "5m");
  assertEquals(result.tiers[0].current.close, 4);
});

Deno.test("processSamples - handles empty restTiers correctly", () => {
  const sample1 = createSample(2, testTime);
  const sample2 = createSample(4, testTime.plus({ minutes: 2 }));
  const samples: R.NonEmptyArray<Sample> = [sample1, sample2];

  const tier = createTier("1m", oneMinute, toCandlestick(sample1));
  const tiers: R.NonEmptyArray<Tier> = [tier];

  const result = processSamples(tiers, samples);

  assertEquals(result.tiers.length, 1);
  assertEquals(result.tiers[0].history.length, 3); // Should have 3 historized candlesticks
  assertEquals(result.eternal.close, 4);
});

Deno.test("processSamples - handles multiple samples in sequence", () => {
  const sample1 = createSample(2, testTime);
  const sample2 = createSample(4, testTime.plus({ seconds: 30 }));
  const sample3 = createSample(6, testTime.plus({ seconds: 45 }));
  const samples: R.NonEmptyArray<Sample> = [sample1, sample2, sample3];

  const tier = createTier("1m", oneMinute, toCandlestick(sample1));
  const tiers: R.NonEmptyArray<Tier> = [tier];

  const result = processSamples(tiers, samples);

  assertEquals(result.tiers.length, 1);
  assertEquals(result.tiers[0].current.close, 6);
  assertEquals(result.tiers[0].current.high, 6);
  assertEquals(result.tiers[0].current.low, 2);
  assertEquals(result.eternal.close, 6);
});

Deno.test("processSamples - handles decreasing values", () => {
  const sample1 = createSample(6, testTime);
  const sample2 = createSample(4, testTime.plus({ seconds: 30 }));
  const sample3 = createSample(2, testTime.plus({ seconds: 45 }));
  const samples: R.NonEmptyArray<Sample> = [sample1, sample2, sample3];

  const tier = createTier("1m", oneMinute, toCandlestick(sample1));
  const tiers: R.NonEmptyArray<Tier> = [tier];

  const result = processSamples(tiers, samples);

  assertEquals(result.tiers.length, 1);
  assertEquals(result.tiers[0].current.close, 2);
  assertEquals(result.tiers[0].current.high, 6);
  assertEquals(result.tiers[0].current.low, 2);
  assertEquals(result.eternal.close, 2);
});

Deno.test("processSamples - handles exact duration boundary", () => {
  const sample1 = createSample(2, testTime);
  const sample2 = createSample(4, testTime.plus({ minutes: 1 })); // Exactly 1 minute later
  const samples: R.NonEmptyArray<Sample> = [sample1, sample2];

  const tier = createTier("1m", oneMinute, toCandlestick(sample1));
  const tiers: R.NonEmptyArray<Tier> = [tier];

  const result = processSamples(tiers, samples);

  // Should trigger overflow since distance equals duration
  assertEquals(result.tiers.length, 1);
  assertEquals(result.tiers[0].history.length, 0); // Should have 0 historized candlesticks (distance = duration, no synthetic candlesticks generated)
  assertEquals(result.tiers[0].current.close, 4);
  assertEquals(result.eternal.close, 4);
});

Deno.test("processSamples - preserves tier properties", () => {
  const sample1 = createSample(2, testTime);
  const sample2 = createSample(4, testTime.plus({ seconds: 30 }));
  const samples: R.NonEmptyArray<Sample> = [sample1, sample2];

  const tier = createTier("custom-tier", oneHour, toCandlestick(sample1));
  const tiers: R.NonEmptyArray<Tier> = [tier];

  const result = processSamples(tiers, samples);

  assertEquals(result.tiers.length, 1);
  assertEquals(result.tiers[0].name, "custom-tier");
  assertEquals(result.tiers[0].duration, oneHour);
  assertEquals(result.tiers[0].current.close, 4);
});
