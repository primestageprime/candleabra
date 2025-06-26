import { DateTime, Duration } from "luxon";
import {
  reduceCandlesticks,
  toCandelabra,
  toCandlestick,
  toSample,
} from "./core.ts";
import { assertEquals } from "jsr:@std/assert";
import type {
  Candelabra,
  Candlestick,
  Sample,
  Tier,
  TierConfig,
} from "./types.d.ts";

const testTime = DateTime.fromISO("2025-06-20T12:00:00.000Z");
const tPlusOneMs = testTime.plus({ milliseconds: 1 });

const defaultSample = toSample(2, testTime);
const defaultSampleCandlestick = toCandlestick(defaultSample);

const oneMinute = Duration.fromISO("PT1M");
const oneMinuteTier = { name: "1m", duration: oneMinute };

Deno.test("toSample", async (t) => {
  await t.step("toSample", () => {
    const sample = toSample(2, testTime);
    assertEquals(sample, { dateTime: testTime, value: 2 });
  });
});

Deno.test("toCandelabra", () => {
  const sample = toSample(2, testTime);
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

Deno.test(
  "reduceCandlesticks should handle out of order candlesticks",
  () => {
    const oldSample = toSample(2, testTime.minus(oneMinute));
    const newSample = toSample(4, testTime);
    const actual = reduceCandlesticks([
      toCandlestick(newSample),
      toCandlestick(oldSample),
    ]);
    const expected = {
      open: 2,
      close: 4,
      high: 4,
      low: 2,
      mean: 3,
      openAt: oldSample.dateTime,
      closeAt: newSample.dateTime,
    };
    assertEquals(actual, expected);
  },
);
