import { DateTime, Duration } from "luxon";
import {
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

const oneMinute = Duration.fromISO("PT1M");
const fiveMinutes = Duration.fromISO("PT5M");
const fifteenMinutes = Duration.fromISO("PT15M");

const defaultSample = toSample(1, testTime);
const defaultSampleCandlestick = toCandlestick(defaultSample);
const oneMinuteBucket = { name: "1m", bucketDuration: oneMinute };
const defaultCandelabra = toCandelabra(defaultSample, [
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
      const actual = addSampleToCandelabra(newSample, defaultCandelabra);
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
      const actual = addSampleToCandelabra(defaultSample, defaultCandelabra);
      const expected = defaultCandelabra;
      assertEquals(actual, expected);
    },
  );

  await t.step(
    "addSampleToCandelabra should handle samples with identical dateTime but different value as an upserts",
    () => {
      const sample = toSample(2, testTime);
      const actual = addSampleToCandelabra(sample, defaultCandelabra);
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
      const actual = addSampleToCandelabra(tooOldSample, defaultCandelabra);
      const expected = defaultCandelabra;
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
        defaultCandelabra,
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
});
