import { DateTime } from "luxon";
import { toAtomicCandlestick } from "./candlestick.ts";
import { assertEquals } from "jsr:@std/assert";
import { renderSmartCandlesticks } from "./renderCandlesticks.ts";

Deno.test("Candlestick", async (t) => {
  await t.step("test", () => {
    const value = 1;
    const dateTime = DateTime.now();
    const actual = toAtomicCandlestick(value, dateTime);
    const expected = {
      open: value,
      close: value,
      high: value,
      low: value,
      mean: value,
      openAt: dateTime,
      closeAt: dateTime,
    };
    renderSmartCandlesticks([actual]);
    assertEquals(actual, expected);
  });
});
