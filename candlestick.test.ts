import { DateTime, Duration } from "luxon";
import {
  reduceCandlesticks,
  toCandelabra,
  toCandlestick,
  toSample,
} from "./candlestick.ts";
import { assertEquals } from "jsr:@std/assert";
import { renderSmartCandlesticks } from "./renderCandlesticks.ts";
import type { BucketConfig, Candelabra, Candlestick } from "./types.d.ts";

const testTime = DateTime.fromISO("2025-06-20T12:00:00.000Z");
const oneMinute = Duration.fromISO("PT1M");
const fiveMinutes = Duration.fromISO("PT5M");
const fifteenMinutes = Duration.fromISO("PT15M");

Deno.test("Candlestick", async (t) => {
  await t.step("toSample", () => {
    const sample = toSample(1, testTime);
    assertEquals(sample, { dateTime: testTime, value: 1 });
  });

  await t.step("mkCandelabra", () => {
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
