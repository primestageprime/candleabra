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
const defaultCandelabra = toCandelabra(defaultSample, [
  { name: "1m", bucketDuration: oneMinute },
  { name: "5m", bucketDuration: fiveMinutes },
  { name: "15m", bucketDuration: fifteenMinutes },
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
      { name: "5m", bucketDuration: fiveMinutes },
      { name: "15m", bucketDuration: fifteenMinutes },
    ];
    const actual: Candelabra = toCandelabra(sample, bucketConfigs);
    const expectedCandlestick: Candlestick = toCandlestick(sample);
    const expected: Candelabra = {
      atomic: [sample],
      buckets: [
        {
          name: "1m",
          bucketDuration: oneMinute,
          candlesticks: [reduceCandlesticks([expectedCandlestick])],
        },
        {
          name: "5m",
          bucketDuration: fiveMinutes,
          candlesticks: [reduceCandlesticks([expectedCandlestick])],
        },
        {
          name: "15m",
          bucketDuration: fifteenMinutes,
          candlesticks: [reduceCandlesticks([expectedCandlestick])],
        },
      ],
      eternal: expectedCandlestick,
    };
    assertEquals(actual, expected);
  });
});

Deno.test("addSampleToCandelabra", async (t) => {
  await t.step(
    "addSampleToCandelabra should be able to add a sample to a candelabra",
    () => {
      const sample = toSample(1, tPlusOneMs);
      const actual = addSampleToCandelabra(sample, defaultCandelabra);
      const sampleCandlestick = toCandlestick(sample);
      const expectedCandlestick = reduceCandlesticks([
        defaultSampleCandlestick,
        sampleCandlestick,
      ]);
      const expected = {
        atomic: [defaultSample, sample],
        buckets: [
          {
            name: "1m",
            bucketDuration: oneMinute,
            candlesticks: [
              expectedCandlestick,
            ],
          },
          {
            name: "5m",
            bucketDuration: fiveMinutes,
            candlesticks: [
              expectedCandlestick,
            ],
          },
          {
            name: "15m",
            bucketDuration: fifteenMinutes,
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
        atomic: [sample],
        buckets: [
          {
            name: "1m",
            bucketDuration: oneMinute,
            candlesticks: [sampleCandlestick],
          },
          {
            name: "5m",
            bucketDuration: fiveMinutes,
            candlesticks: [sampleCandlestick],
          },
          {
            name: "15m",
            bucketDuration: fifteenMinutes,
            candlesticks: [sampleCandlestick],
          },
        ],
        eternal: sampleCandlestick,
      };
      assertEquals(actual, expected);
    },
  );
});
