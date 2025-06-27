import { DateTime, Duration } from "luxon";
import {
  addSamplesToCandelabra,
  addSampleToCandelabra,
  reduceCandlesticks,
  toCandelabra,
  toCandlestick,
  toSample,
  calculateTimeWeightedMean,
  samplesToCandlestick,
} from "./candlestick.ts";
import { assertEquals, assertThrows } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { renderSmartCandlesticks } from "./renderCandlesticks.ts";
import type {
  Candelabra,
  Candlestick,
  Sample,
  Tier,
  TierConfig,
} from "./types.d.ts";

const testTime = DateTime.fromISO("2025-06-20T12:00:00.000Z");
const tPlusOneMs = testTime.plus({ milliseconds: 1 });

const defaultSample = toSample(1, testTime);
const defaultSampleCandlestick = toCandlestick(defaultSample);

const oneMinute = Duration.fromISO("PT1M");
const oneMinuteTier = { name: "1m", duration: oneMinute };
const oneMinuteCandelabra = toCandelabra(defaultSample, [
  oneMinuteTier,
]);

const baseTime = DateTime.fromISO("2024-01-01T10:00:00Z");

Deno.test("toSample", async (t) => {
  await t.step("should create sample from value and datetime", () => {
    const result = toSample(42, baseTime);
    assertEquals(result.value, 42);
    assertEquals(result.dateTime, baseTime);
  });
});

Deno.test("toCandlestick", async (t) => {
  await t.step("should create candlestick from sample", () => {
    const sample = toSample(42, baseTime);
    const result = toCandlestick(sample);
    
    assertEquals(result.open, 42);
    assertEquals(result.close, 42);
    assertEquals(result.high, 42);
    assertEquals(result.low, 42);
    assertEquals(result.mean, 42);
    assertEquals(result.openAt, baseTime);
    assertEquals(result.closeAt, baseTime);
  });
});

Deno.test("calculateTimeWeightedMean", async (t) => {
  await t.step("should return value for single sample", () => {
    const samples = [toSample(42, baseTime)];
    const result = calculateTimeWeightedMean(samples);
    assertEquals(result, 42);
  });

  await t.step("should calculate time-weighted mean for multiple samples", () => {
    const samples = [
      toSample(1, baseTime),
      toSample(50, baseTime.plus({ seconds: 1 })),
      toSample(3, baseTime.plus({ seconds: 30 })),
      toSample(1, baseTime.plus({ seconds: 60 })),
    ];
    
    const result = calculateTimeWeightedMean(samples);
    
    // Expected calculation:
    // Value 1: duration 1 second
    // Value 50: duration 29 seconds  
    // Value 3: duration 30 seconds
    // Value 1: duration 0 seconds
    // Total weighted: (1×1 + 50×29 + 3×30 + 1×0) = 1541
    // Total duration: 60 seconds
    // Mean: 1541 / 60 = 25.68
    assertEquals(result, 25.68);
  });

  await t.step("should handle samples with no duration", () => {
    const samples = [
      toSample(1, baseTime),
      toSample(2, baseTime), // Same time
    ];
    
    const result = calculateTimeWeightedMean(samples);
    assertEquals(result, 1.5); // Simple average
  });
});

Deno.test("samplesToCandlestick", async (t) => {
  await t.step("should create candlestick from samples", () => {
    const samples = [
      toSample(1, baseTime),
      toSample(50, baseTime.plus({ seconds: 1 })),
      toSample(3, baseTime.plus({ seconds: 30 })),
    ];
    
    const openAt = baseTime;
    const closeAt = baseTime.plus({ minutes: 1 });
    
    const result = samplesToCandlestick(samples, openAt, closeAt);
    
    assertEquals(result.open, 1);
    assertEquals(result.close, 3);
    assertEquals(result.high, 50);
    assertEquals(result.low, 1);
    assertEquals(result.openAt, openAt);
    assertEquals(result.closeAt, closeAt);
  });

  await t.step("should throw error for empty samples", () => {
    assertThrows(() => samplesToCandlestick([], baseTime, baseTime), Error, "Cannot create candlestick from empty samples");
  });
});

Deno.test("toCandelabra", async (t) => {
  await t.step("toCandelabra", () => {
    const sample = toSample(1, testTime);
    const bucketConfigs: R.NonEmptyArray<TierConfig> = [
      { name: "1m", duration: oneMinute },
    ];
    const actual: Candelabra = toCandelabra(sample, bucketConfigs);
    const expectedCandlestick: Candlestick = toCandlestick(sample);
    const expected: Candelabra = {
      samples: [sample],
      tiers: [
        {
          name: "1m",
          duration: oneMinute,
          history: [],
          current: expectedCandlestick,
        },
      ],
      eternal: expectedCandlestick,
    };
    assertEquals(actual, expected);
  });
});

Deno.test("reduceCandlesticks", async (t) => {
  await t.step(
    "reduceCandlesticks should handle out of order candlesticks",
    () => {
      const oldSample = toSample(1, testTime.minus(oneMinute));
      const newSample = toSample(2, testTime);
      const actual = reduceCandlesticks([
        toCandlestick(newSample),
        toCandlestick(oldSample),
      ]);
      const expected = {
        open: 1,
        close: 2,
        high: 2,
        low: 1,
        mean: 1.5,
        openAt: oldSample.dateTime,
        closeAt: newSample.dateTime,
      };
      assertEquals(actual, expected);
    },
  );
});

Deno.test("addSampleToCandelabra", async (t) => {
  await t.step(
    "addSampleToCandelabra should be able to add a sample to a candelabra",
    () => {
      const newSample = toSample(1, tPlusOneMs);
      const actual = addSampleToCandelabra(newSample, oneMinuteCandelabra);
      const sampleCandlestick = toCandlestick(newSample);
      const expectedCandlestick = reduceCandlesticks([
        defaultSampleCandlestick,
        sampleCandlestick,
      ]);
      const expected = {
        samples: [defaultSample, newSample] as R.NonEmptyArray<Sample>,
        tiers: [
          {
            name: "1m",
            duration: oneMinute,
            history: [],
            current: expectedCandlestick,
          },
        ] as R.NonEmptyArray<Tier>,
        eternal: expectedCandlestick,
      };
      assertEquals(actual, expected);
    },
  );

  await t.step(
    "addSampleToCandelabra should be idempotent when adding the same sample",
    () => {
      const actual = addSampleToCandelabra(defaultSample, oneMinuteCandelabra);
      const expected = oneMinuteCandelabra;
      assertEquals(actual, expected);
    },
  );

  await t.step(
    "addSampleToCandelabra should handle samples with identical dateTime but different value as an upserts",
    () => {
      const sample = toSample(2, testTime);
      const actual = addSampleToCandelabra(sample, oneMinuteCandelabra);
      const sampleCandlestick = toCandlestick(sample);
      const expectedCandlestick = reduceCandlesticks([
        defaultSampleCandlestick,
        sampleCandlestick,
      ]);
      const expected = {
        samples: [sample] as R.NonEmptyArray<Sample>,
        tiers: [
          {
            name: "1m",
            duration: oneMinute,
            history: [],
            current: expectedCandlestick,
          },
        ] as R.NonEmptyArray<Tier>,
        eternal: expectedCandlestick,
      };
      assertEquals(actual, expected);
    },
  );

  await t.step(
    "addSampleToCandelabra should ignore a sample with datetime earlier than the oldest sample",
    () => {
      const tooOld = testTime.minus(oneMinute).minus({ milliseconds: 1 });
      const tooOldSample = toSample(1, tooOld);
      const actual = addSampleToCandelabra(tooOldSample, oneMinuteCandelabra);
      const expected = oneMinuteCandelabra;
      assertEquals(actual, expected);
    },
  );

  await t.step(
    "addSampleToCandelabra, when given a sample that's after the first bucket's current candlestick, should add the old candlestick to history and create a new current candlestick with the new sample. It should also prune the samples to only contain those that are newer than the oldest sample in the new current candlestick.",
    () => {
      const firstMinTime = testTime.plus({ seconds: 30 });
      const firstMinSample = toSample(4, firstMinTime); // this sample should fall within the 1m bucket's first candlestick

      const secondMinTime = firstMinTime.plus({ seconds: 31 });
      const secondMinSample = toSample(5, secondMinTime); // this sample should fall outside the 1m bucket's first candlestick

      const samples: R.NonEmptyArray<Sample> = [
        firstMinSample,
        secondMinSample,
      ];

      const actual = addSamplesToCandelabra(samples, oneMinuteCandelabra);
      const firstMinCloseAt = testTime.plus(oneMinute);
      const firstMinCandlestick = {
        open: 1,
        close: 4,
        high: 4,
        low: 1,
        mean: 2.5,
        openAt: testTime,
        closeAt: firstMinCloseAt, // candlestick lasts an entire minute because it's no longer active
      };
      const secondMinCandlestick = {
        open: 5,
        close: 5,
        high: 5,
        low: 5,
        mean: 5,
        openAt: firstMinCloseAt,
        closeAt: secondMinTime, // candlestick is active, so closeAt is the last sample's datetime
      };
      const eternalCandlestick = reduceCandlesticks([
        firstMinCandlestick,
        secondMinCandlestick,
      ]);
      const expected = {
        samples: [secondMinSample] as R.NonEmptyArray<Sample>,
        tiers: [
          {
            name: "1m",
            duration: oneMinute,
            history: [], // don't need any history b/c eternal candlestick will serve as history
            current: secondMinCandlestick,
          },
        ] as R.NonEmptyArray<Tier>,
        eternal: eternalCandlestick,
      };
      assertEquals(actual, expected);
    },
  );

  await t.step(
    "addSampleToCandelabra: current candlestick's closeAt should be updated to the new sample's datetime",
    () => {
      const newSample = toSample(2, testTime.plus({ seconds: 30 }));
      const actual = addSampleToCandelabra(newSample, oneMinuteCandelabra);

      const expectedCandlestick = {
        open: 1,
        close: 2,
        high: 2,
        low: 1,
        mean: 1.5,
        openAt: testTime,
        closeAt: newSample.dateTime,
      };
      const expected = {
        samples: [defaultSample, newSample],
        tiers: [
          {
            name: "1m",
            duration: oneMinute,
            history: [],
            current: expectedCandlestick,
          },
        ] as R.NonEmptyArray<Tier>,
        eternal: expectedCandlestick,
      };

      assertEquals(actual, expected);
    },
  );

  await t.step(
    "addSampleToCandelabra: if a sample is recieved that more than two durations away from the openAt of the first bucket's current candlestick, should generate the correct number of historical candlesticks in that bucket using existing data",
    () => {
      const firstMinTime = testTime.plus({ milliseconds: 100 });
      const firstMinSample1 = toSample(2, firstMinTime); // this sample should fall within the 1m bucket's first min candlestick
      const firstMinTime2 = firstMinTime.plus({ milliseconds: 100 });
      const firstMinSample2 = toSample(3, firstMinTime2); // this sample should fall within the 1m bucket's first min candlestick
      const fourthMinSample = toSample(
        4,
        testTime.plus({ minutes: 3, seconds: 30 }),
      ); // this sample skips three entire candlestick durations, should fall within the 1m bucket's fourth min candlestick
      const actual = addSamplesToCandelabra(
        [firstMinSample1, firstMinSample2, fourthMinSample],
        oneMinuteCandelabra,
      );

      // we expect a first min candlestick that consists of the multiple samples that fall within it
      const expectedFirstMinCandlestick = reduceCandlesticks([
        defaultSampleCandlestick,
        toCandlestick(firstMinSample1),
        toCandlestick(firstMinSample2),
      ]);

      // we expect a second min candlestick that consists entirely of one datapoint extrapolated from the last data point we have before it
      const expectedSecondMinCandlestick = {
        ...toCandlestick(firstMinSample2),
        openAt: testTime.plus(oneMinute),
        closeAt: testTime.plus({ minutes: 2 }),
      };
      // same with third min candlestick
      const expectedThirdMinCandlestick = {
        ...expectedSecondMinCandlestick,
        openAt: testTime.plus({ minutes: 2 }),
        closeAt: testTime.plus({ minutes: 3 }),
      };
      // our current candlestick is created using the newest sample
      const expectedCurrentCandlestick = toCandlestick(fourthMinSample);
      const expectedEternalCandlestick = reduceCandlesticks([
        expectedFirstMinCandlestick,
        expectedSecondMinCandlestick,
        expectedThirdMinCandlestick,
        expectedCurrentCandlestick,
      ]);
      const expected = {
        samples: [fourthMinSample] as R.NonEmptyArray<Sample>, // we only keep samples that are relevant to the current candlestick
        tiers: [
          {
            name: "1m",
            duration: oneMinute,
            history: [
              expectedFirstMinCandlestick,
              expectedSecondMinCandlestick,
              expectedThirdMinCandlestick,
            ],
            current: expectedCurrentCandlestick,
          },
        ] as R.NonEmptyArray<Tier>,
        eternal: expectedEternalCandlestick,
      };
      assertEquals(actual, expected);
    },
  );
});

Deno.test(
  "addSampleToCandelabra, when given a sample that's after the first bucket's current candlestick, should add the old candlestick to history and create a new current candlestick with the new sample. It should also prune the samples to only contain those that are newer than the oldest sample in the new current candlestick.",
  () => {
    const firstMinTime = testTime.plus({ seconds: 30 });
    const firstMinSample = toSample(4, firstMinTime); // this sample should fall within the 1m bucket's first candlestick

    const secondMinTime = testTime.plus({ seconds: 61 });
    const secondMinSample = toSample(5, secondMinTime); // this sample should fall outside the 1m bucket's first candlestick

    const samples: R.NonEmptyArray<Sample> = [
      firstMinSample,
      secondMinSample,
    ];

    const actual = addSamplesToCandelabra(samples, oneMinuteCandelabra);
    
    const firstMinCloseAt = testTime.plus(oneMinute);
    const firstMinCandlestick = {
      open: 1,
      close: 4,
      high: 4,
      low: 1,
      mean: 2.5,
      openAt: testTime,
      closeAt: firstMinCloseAt, // candlestick lasts an entire minute because it's no longer active
    };
    const secondMinCandlestick = {
      open: 5,
      close: 5,
      high: 5,
      low: 5,
      mean: 5,
      openAt: firstMinCloseAt,
      closeAt: secondMinTime, // candlestick is active, so closeAt is the last sample's datetime
    };
    const eternalCandlestick = reduceCandlesticks([
      firstMinCandlestick,
      secondMinCandlestick,
    ]);
    const expected = {
      samples: [secondMinSample] as R.NonEmptyArray<Sample>,
      tiers: [
        {
          name: "1m",
          duration: oneMinute,
          history: [], // don't need any history b/c eternal candlestick will serve as history
          current: secondMinCandlestick,
        },
      ] as R.NonEmptyArray<Tier>,
      eternal: eternalCandlestick,
    };
    assertEquals(actual, expected);
  },
);
