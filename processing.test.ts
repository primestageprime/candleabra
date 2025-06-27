import { DateTime, Duration } from "luxon";
import { assertEquals } from "jsr:@std/assert";
import { assertEqualsWithFloatTolerance } from "./testUtils.ts";
import {
  processOverflow,
  processOverflowBranch,
  processOverflowLeaf,
  processPartial,
  processPartialBranch,
  processPartialLeaf,
  processSample,
} from "./processing.ts";
import { samplesToCandlestick, toCandlestick } from "./core.ts";
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

Deno.test("processSample - partial update within tier duration", () => {
  const sample1 = createSample(2, testTime);
  const tier = createTier("1m", oneMinute, toCandlestick(sample1));
  const tiers: R.NonEmptyArray<Tier> = [tier];

  const sample2 = createSample(4, testTime.plus({ seconds: 30 }));
  const result = processSample(tiers, sample2);

  assertEquals(result.tiers.length, 1);
  assertEquals(result.tiers[0].name, "1m");
  assertEquals(result.tiers[0].history.length, 0);
  assertEquals(result.tiers[0].current.open, 2);
  assertEquals(result.tiers[0].current.close, 4);
  assertEquals(result.tiers[0].current.low, 2);
  assertEquals(result.tiers[0].current.high, 4);
  assertEquals(result.eternal.close, 4);
});

Deno.test("processSample - overflow triggers historization, creates synthetic historical candlesticks if necessary", () => {
  const sample1 = createSample(2, testTime);

  const tier = createTier("1m", oneMinute, toCandlestick(sample1));
  const tiers: R.NonEmptyArray<Tier> = [tier];

  const sample2 = createSample(4, testTime.plus({ minutes: 2 })); // Exceeds 1 minute duration
  const result = processSample(tiers, sample2);

  assertEquals(result.tiers.length, 1);
  assertEquals(result.tiers[0].name, "1m");
  assertEquals(result.tiers[0].history.length, 3); // Should have 3 historized candlesticks (2 synthetic + 1 original)
  assertEquals(result.tiers[0].current.close, 4); // Current should be the new sample
  assertEquals(result.eternal.close, 4);
});

Deno.test("processSample - should handle overflow with multiple tiers", () => {
  // given a bases loaded 1 minute tier (4 historical minutes, 1 current)
  const minuteOneSample = createSample(2, testTime.plus({ seconds: 30 }));
  const minuteTwoSample = createSample(
    4,
    testTime.plus({ minutes: 1, seconds: 30 }),
  );
  const minuteThreeSample = createSample(
    6,
    testTime.plus({ minutes: 2, seconds: 30 }),
  );
  const minuteFourSample = createSample(
    8,
    testTime.plus({ minutes: 3, seconds: 30 }),
  );
  const minuteFiveSample = createSample(
    10,
    testTime.plus({ minutes: 4, seconds: 30 }),
  );
  const basesLoaded = [
    minuteOneSample,
    minuteTwoSample,
    minuteThreeSample,
    minuteFourSample,
  ].map(toCandlestick);

  const oneMinuteTier = createTier(
    "1m",
    oneMinute,
    toCandlestick(minuteFiveSample),
    basesLoaded,
  );
  const fiveMinuteTier = createTier(
    "5m",
    fiveMinutes,
    toCandlestick(minuteFiveSample),
  );
  const tiers: R.NonEmptyArray<Tier> = [oneMinuteTier, fiveMinuteTier];

  const minuteSixSample = createSample(
    12,
    testTime.plus({ minutes: 5, seconds: 30 }),
  );
  // when we process a sample in the sixth minute, the 1m tier should overflow
  const result = processSample(tiers, minuteSixSample);

  assertEquals(result.tiers.length, 2);
  assertEquals(result.tiers[0].name, "1m");
  assertEquals(result.tiers[1].name, "5m");
  assertEquals(result.tiers[0].history.length, 0); // 1m tier should have 0 historized candlesticks
  assertEquals(result.tiers[1].history.length, 1); // 5m tier should have 1 historized candlestick
});

Deno.test("processOverflow - creates synthetic historical candlesticks", () => {
  const sample1 = createSample(2, testTime);
  const currentCandlestick = toCandlestick(sample1);
  const distance = Duration.fromISO("PT2M");

  const tier1 = createTier("1m", oneMinute, currentCandlestick);
  const tier2 = createTier("5m", fiveMinutes, currentCandlestick);
  const restTiers: R.NonEmptyArray<Tier> = [tier2];

  const sample2 = createSample(4, testTime); // time doesn't matter because it's processOverflow
  const result = processOverflow(
    tier1,
    distance,
    sample2,
    restTiers,
  );

  assertEquals(result.tiers.length, 2);
  assertEquals(result.tiers[0].name, "1m");
  assertEquals(result.tiers[1].name, "5m");
  assertEquals(result.tiers[0].history.length, 3); // 1m tier should have 3 historized candlesticks
  assertEquals(result.tiers[1].history.length, 0); // 5m tier should not have historized yet
});

Deno.test("processOverflowLeaf - handles adding synthetic historical candlesticks", () => {
  const sample1 = createSample(2, testTime);
  const currentCandlestick = toCandlestick(sample1);
  const generatedCandlestick = {
    ...currentCandlestick,
    closeAt: testTime.plus({ minutes: 1 }),
  };

  const tier = createTier("1m", oneMinute, currentCandlestick);
  const historicalCandlesticks: R.NonEmptyArray<Candlestick> = [
    generatedCandlestick,
  ];

  // because this is more than one tier duration away from test time, we expect one generated historical candlestick
  const sample2 = createSample(4, testTime.plus({ minutes: 2 }));
  const result = processOverflowLeaf(
    tier,
    sample2,
    historicalCandlesticks,
  );

  assertEquals(result.tiers.length, 1);
  assertEquals(result.tiers[0].current.close, 4);
  assertEquals(result.tiers[0].current.openAt, generatedCandlestick.closeAt);
  assertEquals(result.eternal.close, 4);
});

Deno.test("processOverflowBranch - overflows to child tiers", () => {
  const sample1 = createSample(2, testTime);
  const currentCandlestick = toCandlestick(sample1);
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

  const sample2 = createSample(4, testTime.plus({ minutes: 2 }));
  const result = processOverflowBranch(
    tier1,
    restTiers,
    sample2,
    historicalCandlesticks,
  );

  assertEquals(result.tiers.length, 2);
  assertEquals(result.tiers[0].name, "1m");
  assertEquals(result.tiers[1].name, "5m");
  assertEquals(result.tiers[0].history.length, 1);
  assertEquals(result.tiers[1].history.length, 0);
});

Deno.test("processPartial - handles multiple tiers", () => {
  const sample1 = createSample(2, testTime);
  const currentCandlestick = toCandlestick(sample1);

  const tier1 = createTier("1m", oneMinute, currentCandlestick);
  const tier2 = createTier("5m", fiveMinutes, currentCandlestick);
  const restTiers: R.NonEmptyArray<Tier> = [tier2];

  const sample2 = createSample(4, testTime.plus({ seconds: 30 }));
  const result = processPartial(
    tier1,
    restTiers,
    sample2,
  );

  assertEquals(result.tiers.length, 2);
  assertEquals(result.tiers[0].name, "1m");
  assertEquals(result.tiers[1].name, "5m");
  assertEquals(result.tiers[0].current.close, 4);
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

Deno.test("processSample - handles decreasing values", () => {
  const sample1 = createSample(6, testTime);
  const sample2 = createSample(4, testTime.plus({ seconds: 30 }));

  const tier = createTier("1m", oneMinute, toCandlestick(sample2), [
    toCandlestick(sample1),
  ]);
  const tiers: R.NonEmptyArray<Tier> = [tier];

  const sample3 = createSample(2, testTime.plus({ seconds: 45 })); // decreasing value
  const result = processSample(tiers, sample3);

  assertEquals(result.tiers.length, 1);
  assertEquals(result.tiers[0].current.close, 2);
  assertEquals(result.tiers[0].current.high, 4);
  assertEquals(result.tiers[0].history[0].high, 6);
  assertEquals(result.tiers[0].current.low, 2);
  assertEquals(result.tiers[0].history[0].low, 6);
  assertEquals(result.eternal.close, 2);
});

Deno.test("processSample - handles exact duration boundary", () => {
  const sample1 = createSample(2, testTime);

  const tier = createTier("1m", oneMinute, toCandlestick(sample1));
  const tiers: R.NonEmptyArray<Tier> = [tier];

  const sample2 = createSample(4, testTime.plus({ minutes: 1 })); // Exactly 1 minute later
  const result = processSample(tiers, sample2);

  // Should trigger overflow since distance equals duration
  assertEquals(result.tiers.length, 1);
  assertEquals(result.tiers[0].history.length, 0); // Should have 0 historized candlesticks (distance = duration, no synthetic candlesticks generated)
  assertEquals(result.tiers[0].current.close, 4);
  assertEquals(result.eternal.close, 4);
});

Deno.test("processSample - preserves tier properties", () => {
  const sample1 = createSample(2, testTime);

  const tier = createTier("custom-tier", oneHour, toCandlestick(sample1));
  const tiers: R.NonEmptyArray<Tier> = [tier];

  const sample2 = createSample(4, testTime.plus({ seconds: 30 }));
  const result = processSample(tiers, sample2);

  assertEquals(result.tiers.length, 1);
  assertEquals(result.tiers[0].name, "custom-tier");
  assertEquals(result.tiers[0].duration, oneHour);
  assertEquals(result.tiers[0].current.close, 4);
});
