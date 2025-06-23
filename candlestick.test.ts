import { DateTime, Duration } from "luxon";
import {
  addSamplesToCandelabra,
  addSampleToCandelabra,
  reduceCandlesticks,
  toCandelabra,
  toCandlestick,
  toSample,
} from "./candlestick.ts";
import { assertEquals } from "jsr:@std/assert";
import { renderSmartCandlesticks } from "./renderCandlesticks.ts";
import type { BucketConfig, Candelabra, Candlestick } from "./types.d.ts";

const testTime = DateTime.fromISO("2025-06-20T12:00:00.000Z");
const tPlusOneMs = testTime.plus({ milliseconds: 1 });

const defaultSample = toSample(1, testTime);
const defaultSampleCandlestick = toCandlestick(defaultSample);

const oneMinute = Duration.fromISO("PT1M");
const oneMinuteBucket = { name: "1m", bucketDuration: oneMinute };
const oneMinuteCandelabra = toCandelabra(defaultSample, [
  oneMinuteBucket,
]);

Deno.test("toSample", async (t) => {
  await t.step("toSample", () => {
    const sample = toSample(1, testTime);
    assertEquals(sample, { dateTime: testTime, value: 1 });
  });
});

Deno.test("toCandelabra", async (t) => {
  await t.step("toCandelabra", () => {
    const sample = toSample(1, testTime);
    const bucketConfigs: R.NonEmptyArray<BucketConfig> = [
      { name: "1m", bucketDuration: oneMinute },
    ];
    const actual: Candelabra = toCandelabra(sample, bucketConfigs);
    const expectedCandlestick: Candlestick = toCandlestick(sample);
    const expected: Candelabra = {
      samples: [sample],
      buckets: [
        {
          name: "1m",
          bucketDuration: oneMinute,
          candlesticks: [reduceCandlesticks([expectedCandlestick])],
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
        samples: [defaultSample, newSample],
        buckets: [
          {
            name: "1m",
            bucketDuration: oneMinute,
            candlesticks: [
              expectedCandlestick,
            ],
          },
        ],
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
      const expected = {
        samples: [sample],
        buckets: [
          {
            name: "1m",
            bucketDuration: oneMinute,
            candlesticks: [sampleCandlestick],
          },
        ],
        eternal: sampleCandlestick,
      };
      assertEquals(actual, expected);
    },
  );

  await t.step(
    "addSampleToCandelabra should ignore a sample with datetime earlier than the latest saved sample minus the duration of the first bucket",
    () => {
      const tooOld = testTime.minus(oneMinute).minus({ milliseconds: 1 });
      const tooOldSample = toSample(1, tooOld);
      const actual = addSampleToCandelabra(tooOldSample, oneMinuteCandelabra);
      const expected = oneMinuteCandelabra;
      assertEquals(actual, expected);
    },
  );

  await t.step(
    "addSampleToCandelabra should allow a sample with datetime equal to the latest saved sample minus the duration of the first bucket",
    () => {
      const oneMinAgo = testTime.minus(oneMinute);
      const oldSample = toSample(1, oneMinAgo);
      const oldCandlestick = reduceCandlesticks([
        defaultSampleCandlestick,
        toCandlestick(oldSample),
      ]);
      const actual = addSampleToCandelabra(
        oldSample,
        oneMinuteCandelabra,
      );
      const expected = {
        samples: [oldSample, defaultSample],
        buckets: [
          {
            name: "1m",
            bucketDuration: oneMinute,
            candlesticks: [oldCandlestick],
          },
        ],
        eternal: oldCandlestick,
      };
      assertEquals(actual, expected);
    },
  );

  await t.step(
    "addSampleToCandelabra, when given a sample with a datetime the distance of which from the oldest sample is greater than the duration of the first bucket, should split the bucket's candlesticks into two: one with the samples before the cutoff time, and one with the samples after the cutoff time. It should also prune the samples to only contain those that are newer than the cutoff time.",
    () => {
      const newSample = toSample(4, testTime.plus(oneMinute));
      const actual = addSampleToCandelabra(newSample, oneMinuteCandelabra);
      const oldCandlestick = {
        open: 1,
        close: 1,
        high: 1,
        low: 1,
        mean: 1,
        openAt: testTime,
        closeAt: testTime.plus(oneMinute),
      };
      const newCandlestick = {
        open: 4,
        close: 4,
        high: 4,
        low: 4,
        mean: 4,
        openAt: testTime.plus(oneMinute),
        closeAt: newSample.dateTime,
      };
      const expected = {
        samples: [newSample],
        buckets: [
          {
            name: "1m",
            bucketDuration: oneMinute,
            candlesticks: [oldCandlestick, newCandlestick],
          },
        ],
        eternal: {
          open: 1,
          close: 4,
          high: 4,
          low: 1,
          mean: 2.5,
          openAt: testTime,
          closeAt: testTime.plus(oneMinute),
        },
      };
      assertEquals(actual, expected);
    },
  );

  await t.step(
    "addSampleToCandelabra, if adding to a bucket that is still within the active duration, should set the closeAt of that bucket's candlestick to the new sample's datetime",
    () => {
      const newSample = toSample(2, testTime.plus({ seconds: 30 }));
      const actual = addSampleToCandelabra(newSample, oneMinuteCandelabra);
      const newCandlestick = {
        open: 2,
        close: 2,
        high: 2,
        low: 2,
        mean: 2,
        openAt: testTime,
        closeAt: newSample.dateTime,
      };
      const expected = {
        samples: [newSample],
        buckets: [
          {
            name: "1m",
            bucketDuration: oneMinute,
            candlesticks: [newCandlestick],
          },
        ],
        eternal: newCandlestick,
      };
      assertEquals(actual, expected);
    },
  );

  await t.step(
    "addSampleToCandelabra: if a sample is recieved that skips multiple durations of a bucket, should generate the correct number of candlesticks in that bucket using existing data",
    () => {
      const firstMinTime = testTime.plus({ milliseconds: 100 });
      const firstMinSample1 = toSample(2, firstMinTime);
      const firstMinTime2 = firstMinTime.plus({ milliseconds: 100 });
      const firstMinSample2 = toSample(3, firstMinTime2);
      const newSample = toSample(
        4,
        testTime.plus({ minutes: 3, seconds: 30 }),
      );
      const actual = addSamplesToCandelabra(
        [firstMinSample1, firstMinSample2, newSample],
        oneMinuteCandelabra,
      );

      const expectedFirstMinCandlestick = reduceCandlesticks([
        defaultSampleCandlestick,
        toCandlestick(firstMinSample1),
        toCandlestick(firstMinSample2),
      ]);

      const expectedSecondMinCandlestick = {
        ...toCandlestick(firstMinSample2),
        openAt: testTime.plus(oneMinute),
        closeAt: testTime.plus({ minutes: 2 }),
      };
      const expectedThirdMinCandlestick = {
        ...expectedSecondMinCandlestick,
        openAt: testTime.plus({ minutes: 2 }),
        closeAt: testTime.plus({ minutes: 3 }),
      };
      const expectedCurrentCandlestick = toCandlestick(newSample);
      const expectedEternalCandlestick = reduceCandlesticks([
        expectedFirstMinCandlestick,
        expectedSecondMinCandlestick,
        expectedThirdMinCandlestick,
        expectedCurrentCandlestick,
      ]);
      const expected = {
        samples: [newSample],
        buckets: [
          {
            name: "1m",
            bucketDuration: oneMinute,
            candlesticks: [
              expectedFirstMinCandlestick,
              expectedSecondMinCandlestick,
              expectedThirdMinCandlestick,
              expectedCurrentCandlestick,
            ],
          },
        ],
        eternal: expectedEternalCandlestick,
      };
      assertEquals(actual, expected);
    },
  );
});
