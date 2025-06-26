import { DateTime, Duration } from "luxon";
import { historizeCandlestick } from "./utils.ts";
import { toCandlestick, toSample } from "./core.ts";
import { assertEquals } from "jsr:@std/assert";
import type { Candlestick } from "./types.d.ts";

const testTime = DateTime.fromISO("2025-06-20T12:00:00.000Z");
const oneMinute = Duration.fromISO("PT1M");

Deno.test("historizeCandlestick", () => {
  const sample = toSample(2, testTime);
  const candlestick = toCandlestick(sample);
  const actual = historizeCandlestick(candlestick, oneMinute);
  const expected: Candlestick = {
    ...candlestick,
    closeAt: testTime.plus(oneMinute),
  };
  assertEquals(actual, expected);
});
