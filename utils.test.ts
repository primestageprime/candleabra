import { DateTime, Duration } from "luxon";
import {
  getClose,
  getCloseAt,
  getCutoffTime,
  getDistance,
  getHigh,
  getLow,
  getMean,
  getOpen,
  getOpenAt,
  getTimeWeightedMean,
  historizeCandlestick,
  pruneSamples,
  toHistoricalCandlesticks,
  updateSamples,
} from "./utils.ts";
import { toCandlestick, toSample } from "./core.ts";
import { assertAlmostEquals, assertEquals } from "jsr:@std/assert";
import type { Candlestick, Sample, Tier } from "./types.d.ts";

const testTime = DateTime.fromISO("2025-06-20T12:00:00.000Z");
const oneMinute = Duration.fromISO("PT1M");
const twoMinutes = Duration.fromISO("PT2M");

// Test data setup
const sample1 = toSample(2, testTime);
const sample2 = toSample(4, testTime.plus({ seconds: 30 }));
const sample3 = toSample(1, testTime.plus({ seconds: 60 }));

const candlestick1 = toCandlestick(sample1);
const candlestick2 = toCandlestick(sample2);
const candlestick3 = toCandlestick(sample3);

const candlesticks: R.NonEmptyArray<Candlestick> = [
  candlestick1,
  candlestick2,
  candlestick3,
];

Deno.test("getOpenAt", () => {
  const actual = getOpenAt(candlesticks);
  assertEquals(actual, testTime);
});

Deno.test("getCloseAt", () => {
  const actual = getCloseAt(candlesticks);
  assertEquals(actual, testTime.plus({ seconds: 60 }));
});

Deno.test("getOpen", () => {
  const actual = getOpen(candlesticks);
  assertEquals(actual, 2);
});

Deno.test("getClose", () => {
  const actual = getClose(candlesticks);
  assertEquals(actual, 1);
});

Deno.test("getHigh", () => {
  const actual = getHigh(candlesticks);
  assertEquals(actual, 4);
});

Deno.test("getHigh with single candlestick", () => {
  const singleCandlestick: R.NonEmptyArray<Candlestick> = [candlestick1];
  const actual = getHigh(singleCandlestick);
  assertEquals(actual, 2);
});

Deno.test("getLow", () => {
  const actual = getLow(candlesticks);
  assertEquals(actual, 1);
});

Deno.test("getLow with single candlestick", () => {
  const singleCandlestick: R.NonEmptyArray<Candlestick> = [candlestick1];
  const actual = getLow(singleCandlestick);
  assertEquals(actual, 2);
});

Deno.test("getMean", () => {
  const actual = getMean(candlesticks);
  assertEquals(actual, 2.3333333333333335);
});

Deno.test("getMean with single candlestick", () => {
  const singleCandlestick: R.NonEmptyArray<Candlestick> = [candlestick1];
  const actual = getMean(singleCandlestick);
  assertEquals(actual, 2);
});

Deno.test("getTimeWeightedMean with single candlestick", () => {
  const singleCandlestick: R.NonEmptyArray<Candlestick> = [candlestick1];
  const actual = getTimeWeightedMean(singleCandlestick);
  assertEquals(actual, 2);
});

Deno.test("getTimeWeightedMean with equal duration candlesticks", () => {
  // Create candlesticks with equal durations (1 minute each)
  const candlestickA = {
    ...candlestick1,
    openAt: testTime,
    closeAt: testTime.plus(oneMinute),
    mean: 10,
  };
  const candlestickB = {
    ...candlestick2,
    openAt: testTime.plus(oneMinute),
    closeAt: testTime.plus(twoMinutes),
    mean: 20,
  };

  const candlesticks: R.NonEmptyArray<Candlestick> = [
    candlestickA,
    candlestickB,
  ];
  const actual = getTimeWeightedMean(candlesticks);

  // With equal durations, should be simple average: (10 + 20) / 2 = 15
  assertEquals(actual, 15);
});

Deno.test("getTimeWeightedMean with different duration candlesticks", () => {
  // Create candlesticks with different durations
  const candlestickA = {
    ...candlestick1,
    openAt: testTime,
    closeAt: testTime.plus(oneMinute), // 1 minute duration
    mean: 10,
  };
  const candlestickB = {
    ...candlestick2,
    openAt: testTime.plus(oneMinute),
    closeAt: testTime.plus({ minutes: 3 }), // 2 minutes duration
    mean: 20,
  };

  const candlesticks: R.NonEmptyArray<Candlestick> = [
    candlestickA,
    candlestickB,
  ];
  const actual = getTimeWeightedMean(candlesticks);

  // Weighted calculation: (10 * 60000 + 20 * 120000) / (60000 + 120000) = 16.67
  const expected = (10 * 60000 + 20 * 120000) / (60000 + 120000);
  assertAlmostEquals(actual, expected, 0.01);
});

Deno.test("getTimeWeightedMean with zero duration candlesticks", () => {
  // Create candlesticks with zero duration (should use minimum weight of 1ms)
  const candlestickA = {
    ...candlestick1,
    openAt: testTime,
    closeAt: testTime, // Zero duration
    mean: 10,
  };
  const candlestickB = {
    ...candlestick2,
    openAt: testTime,
    closeAt: testTime, // Zero duration
    mean: 20,
  };

  const candlesticks: R.NonEmptyArray<Candlestick> = [
    candlestickA,
    candlestickB,
  ];
  const actual = getTimeWeightedMean(candlesticks);

  // With minimum weights of 1ms each: (10 * 1 + 20 * 1) / (1 + 1) = 15
  assertEquals(actual, 15);
});

Deno.test("getTimeWeightedMean with three candlesticks of varying durations", () => {
  const candlestickA = {
    ...candlestick1,
    openAt: testTime,
    closeAt: testTime.plus({ seconds: 30 }), // 30 seconds
    mean: 10,
  };
  const candlestickB = {
    ...candlestick2,
    openAt: testTime.plus({ seconds: 30 }),
    closeAt: testTime.plus({ minutes: 1, seconds: 30 }), // 1 minute
    mean: 20,
  };
  const candlestickC = {
    ...candlestick3,
    openAt: testTime.plus({ minutes: 1, seconds: 30 }),
    closeAt: testTime.plus({ minutes: 2 }), // 30 seconds
    mean: 30,
  };

  const candlesticks: R.NonEmptyArray<Candlestick> = [
    candlestickA,
    candlestickB,
    candlestickC,
  ];
  const actual = getTimeWeightedMean(candlesticks);

  // Weighted calculation: (10 * 30000 + 20 * 60000 + 30 * 30000) / (30000 + 60000 + 30000) = 20
  const expected = (10 * 30000 + 20 * 60000 + 30 * 30000) /
    (30000 + 60000 + 30000);
  assertAlmostEquals(actual, expected, 0.01);
});

Deno.test("getTimeWeightedMean with original test data", () => {
  // Test with the original test data to ensure backward compatibility
  const actual = getTimeWeightedMean(candlesticks);

  // Calculate expected based on the original test data structure
  // candlestick1: mean=2, duration=0 (instantaneous)
  // candlestick2: mean=4, duration=0 (instantaneous)
  // candlestick3: mean=1, duration=0 (instantaneous)
  // With minimum weights of 1ms each: (2 * 1 + 4 * 1 + 1 * 1) / (1 + 1 + 1) = 2.33
  const expected = (2 + 4 + 1) / 3;
  assertAlmostEquals(actual, expected, 0.01);
});

Deno.test("getCutoffTime", () => {
  const tier: Tier = {
    name: "1m",
    duration: oneMinute,
    history: [],
    current: candlestick1,
  };
  const tiers: R.NonEmptyArray<Tier> = [tier];
  const latestSample = sample2;

  const actual = getCutoffTime(latestSample, tiers);
  const expected = latestSample.dateTime.minus(oneMinute);

  assertEquals(actual, expected);
});

Deno.test("getDistance with historical candlestick", () => {
  const historicalCandlestick = historizeCandlestick(candlestick1, oneMinute);
  const oldestSampleDateTime = testTime;
  const newestSampleDateTime = testTime.plus({ minutes: 2 });

  const actual = getDistance(
    historicalCandlestick,
    oldestSampleDateTime,
    newestSampleDateTime,
  );
  const expected = Duration.fromMillis(60000); // 1 minute in milliseconds

  assertEquals(actual.as("milliseconds"), expected.as("milliseconds"));
});

Deno.test("getDistance without historical candlestick", () => {
  const oldestSampleDateTime = testTime;
  const newestSampleDateTime = testTime.plus({ minutes: 2 });

  const actual = getDistance(
    undefined,
    oldestSampleDateTime,
    newestSampleDateTime,
  );
  const expected = Duration.fromMillis(120000); // 2 minutes in milliseconds

  assertEquals(actual.as("milliseconds"), expected.as("milliseconds"));
});

Deno.test("historizeCandlestick", () => {
  const actual = historizeCandlestick(candlestick1, oneMinute);
  const expected: Candlestick = {
    ...candlestick1,
    closeAt: testTime.plus(oneMinute),
  };
  assertEquals(actual, expected);
});

Deno.test("toHistoricalCandlesticks with distance less than duration", () => {
  const distance = Duration.fromMillis(30000); // 30 seconds
  const actual = toHistoricalCandlesticks(candlestick1, oneMinute, distance);

  // Should return just the original candlestick since distance < duration
  assertEquals(actual.length, 1);
  assertEquals(actual[0], candlestick1);
});

Deno.test("toHistoricalCandlesticks with distance equal to duration", () => {
  const distance = Duration.fromMillis(60000); // 1 minute
  const actual = toHistoricalCandlesticks(candlestick1, oneMinute, distance);

  // Should return just the original candlestick since distance = duration
  assertEquals(actual.length, 1);
  assertEquals(actual[0], candlestick1);
});

Deno.test("toHistoricalCandlesticks with distance greater than duration", () => {
  const distance = Duration.fromMillis(180000); // 3 minutes
  const actual = toHistoricalCandlesticks(candlestick1, oneMinute, distance);

  // The function generates 3 synthetic candlesticks, then appends the original at the end
  assertEquals(actual.length, 4);

  // Check first synthetic candlestick
  assertEquals(actual[0].open, candlestick1.open);
  assertEquals(actual[0].close, candlestick1.close);
  assertEquals(actual[0].high, candlestick1.high);
  assertEquals(actual[0].low, candlestick1.low);
  assertEquals(actual[0].mean, candlestick1.mean);
  assertEquals(actual[0].openAt, testTime);
  assertEquals(actual[0].closeAt, testTime.plus(oneMinute));

  // Check second synthetic candlestick
  assertEquals(actual[1].openAt, testTime.plus(oneMinute));
  assertEquals(actual[1].closeAt, testTime.plus(twoMinutes));

  // Check third synthetic candlestick
  assertEquals(actual[2].openAt, testTime.plus(twoMinutes));
  assertEquals(actual[2].closeAt, testTime.plus({ minutes: 3 }));

  // The original candlestick is appended at the end
  assertEquals(actual[3], candlestick1);
});

Deno.test("pruneSamples", () => {
  const tier: Tier = {
    name: "1m",
    duration: oneMinute,
    history: [],
    current: {
      ...candlestick1,
      openAt: testTime.plus({ seconds: 30 }), // Set current openAt to 30 seconds after testTime
    },
  };
  const tiers: R.NonEmptyArray<Tier> = [tier];
  const samples: R.NonEmptyArray<Sample> = [sample1, sample2, sample3];

  const actual = pruneSamples(tiers, samples);

  // Should only keep samples that are >= current openAt (30 seconds after testTime)
  // sample1 is at testTime, sample2 is at testTime + 30s, sample3 is at testTime + 60s
  // So should keep sample2 and sample3
  assertEquals(actual.length, 2);
  assertEquals(actual[0], sample2);
  assertEquals(actual[1], sample3);
});

Deno.test("pruneSamples with no samples to prune", () => {
  const tier: Tier = {
    name: "1m",
    duration: oneMinute,
    history: [],
    current: {
      ...candlestick1,
      openAt: testTime.minus({ seconds: 30 }), // Set current openAt to 30 seconds before testTime
    },
  };
  const tiers: R.NonEmptyArray<Tier> = [tier];
  const samples: R.NonEmptyArray<Sample> = [sample1, sample2, sample3];

  const actual = pruneSamples(tiers, samples);

  // Should keep all samples since current openAt is before all samples
  assertEquals(actual.length, 3);
  assertEquals(actual[0], sample1);
  assertEquals(actual[1], sample2);
  assertEquals(actual[2], sample3);
});

Deno.test("updateSamples with new sample", () => {
  const candelabra = {
    samples: [sample1, sample2] as R.NonEmptyArray<Sample>,
  };
  const newSample = toSample(5, testTime.plus({ seconds: 90 }));

  const actual = updateSamples(newSample, candelabra);

  // Should append the new sample and sort by datetime
  assertEquals(actual.length, 3);
  assertEquals(actual[0], sample1);
  assertEquals(actual[1], sample2);
  assertEquals(actual[2], newSample);
});

Deno.test("updateSamples with existing datetime (upsert)", () => {
  const candelabra = {
    samples: [sample1, sample2] as R.NonEmptyArray<Sample>,
  };
  const updatedSample = toSample(10, testTime); // Same datetime as sample1, different value

  const actual = updateSamples(updatedSample, candelabra);

  // Should replace sample1 with updatedSample and keep sample2
  assertEquals(actual.length, 2);
  assertEquals(actual[0], updatedSample);
  assertEquals(actual[1], sample2);
});

Deno.test("updateSamples with sample in middle", () => {
  const candelabra = {
    samples: [sample1, sample3] as R.NonEmptyArray<Sample>, // sample1 at testTime, sample3 at testTime + 60s
  };
  const middleSample = toSample(7, testTime.plus({ seconds: 30 })); // Between sample1 and sample3

  const actual = updateSamples(middleSample, candelabra);

  // Should insert middleSample between sample1 and sample3
  assertEquals(actual.length, 3);
  assertEquals(actual[0], sample1);
  assertEquals(actual[1], middleSample);
  assertEquals(actual[2], sample3);
});

Deno.test("updateSamples with sample before existing samples", () => {
  const candelabra = {
    samples: [sample2, sample3] as R.NonEmptyArray<Sample>, // sample2 at testTime + 30s, sample3 at testTime + 60s
  };
  const earlySample = toSample(8, testTime.minus({ seconds: 30 })); // Before sample2

  const actual = updateSamples(earlySample, candelabra);

  // Should insert earlySample at the beginning
  assertEquals(actual.length, 3);
  assertEquals(actual[0], earlySample);
  assertEquals(actual[1], sample2);
  assertEquals(actual[2], sample3);
});
