import { DateTime, Duration } from "luxon";
import {
  reduceCandlesticks,
  samplesToCandlestick,
  singleSampleCandelabra,
  toCandelabra,
  toCandlestick,
  toSample,
  toTier,
} from "./core.ts";
import { assertAlmostEquals, assertEquals } from "jsr:@std/assert";
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
const threeMinute = Duration.fromISO("PT3M");

// Test data setup
const sample1 = toSample(2, testTime);
const sample2 = toSample(4, testTime.plus({ seconds: 30 }));
const sample3 = toSample(1, testTime.plus({ seconds: 60 }));

const candlestick1 = toCandlestick(sample1);
const candlestick2 = toCandlestick(sample2);
const candlestick3 = toCandlestick(sample3);

Deno.test("toSample", async (t) => {
  await t.step(
    "toSample creates sample with correct value and datetime",
    () => {
      const sample = toSample(2, testTime);
      assertEquals(sample, { dateTime: testTime, value: 2 });
    },
  );

  await t.step("toSample handles different values", () => {
    const sample = toSample(10.5, testTime);
    assertEquals(sample, { dateTime: testTime, value: 10.5 });
  });

  await t.step("toSample handles different datetimes", () => {
    const laterTime = testTime.plus({ hours: 1 });
    const sample = toSample(5, laterTime);
    assertEquals(sample, { dateTime: laterTime, value: 5 });
  });
});

Deno.test("toCandlestick", async (t) => {
  await t.step(
    "toCandlestick creates candlestick with all values equal to sample value",
    () => {
      const sample = toSample(3, testTime);
      const actual = toCandlestick(sample);
      const expected: Candlestick = {
        open: 3,
        close: 3,
        high: 3,
        low: 3,
        mean: 3,
        openAt: testTime,
        closeAt: testTime,
      };
      assertEquals(actual, expected);
    },
  );

  await t.step("toCandlestick handles decimal values", () => {
    const sample = toSample(3.14, testTime);
    const actual = toCandlestick(sample);
    assertEquals(actual.open, 3.14);
    assertEquals(actual.close, 3.14);
    assertEquals(actual.high, 3.14);
    assertEquals(actual.low, 3.14);
    assertEquals(actual.mean, 3.14);
  });

  await t.step("toCandlestick preserves datetime", () => {
    const laterTime = testTime.plus({ minutes: 5 });
    const sample = toSample(7, laterTime);
    const actual = toCandlestick(sample);
    assertEquals(actual.openAt, laterTime);
    assertEquals(actual.closeAt, laterTime);
  });
});

Deno.test("toTier", async (t) => {
  await t.step("toTier creates tier with config and candlestick", () => {
    const tierConfig: TierConfig = { name: "1m", duration: oneMinute };
    const candlestick = toCandlestick(sample1);
    const actual = toTier(tierConfig, candlestick);

    const expected: Tier = {
      name: "1m",
      duration: oneMinute,
      history: [],
      current: candlestick,
    };
    assertEquals(actual, expected);
  });

  await t.step("toTier preserves all config properties", () => {
    const tierConfig: TierConfig = {
      name: "5m",
      duration: Duration.fromISO("PT5M"),
    };
    const candlestick = toCandlestick(sample1);
    const actual = toTier(tierConfig, candlestick);

    assertEquals(actual.name, "5m");
    assertEquals(actual.duration, Duration.fromISO("PT5M"));
    assertEquals(actual.current, candlestick);
    assertEquals(actual.history, []);
  });
});

Deno.test("toCandelabra", async (t) => {
  await t.step("toCandelabra creates candelabra with single tier", () => {
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

  await t.step("toCandelabra creates candelabra with multiple tiers", () => {
    const sample = toSample(5, testTime);
    const bucketConfigs: R.NonEmptyArray<TierConfig> = [
      { name: "1m", duration: oneMinute },
      { name: "3m", duration: threeMinute },
    ];
    const actual: Candelabra = toCandelabra(sample, bucketConfigs);
    const expectedCandlestick: Candlestick = toCandlestick(sample);

    assertEquals(actual.samples, [sample]);
    assertEquals(actual.eternal, expectedCandlestick);
    assertEquals(actual.tiers.length, 2);

    // Check first tier
    assertEquals(actual.tiers[0].name, "1m");
    assertEquals(actual.tiers[0].duration, oneMinute);
    assertEquals(actual.tiers[0].current, expectedCandlestick);
    assertEquals(actual.tiers[0].history, []);

    // Check second tier
    assertEquals(actual.tiers[1].name, "3m");
    assertEquals(actual.tiers[1].duration, threeMinute);
    assertEquals(actual.tiers[1].current, expectedCandlestick);
    assertEquals(actual.tiers[1].history, []);
  });
});

Deno.test("singleSampleCandelabra", async (t) => {
  await t.step(
    "singleSampleCandelabra creates candelabra with existing tiers",
    () => {
      const sample = toSample(7, testTime);
      const existingTier: Tier = {
        name: "1m",
        duration: oneMinute,
        history: [candlestick1, candlestick2], // Some existing history
        current: candlestick1,
      };
      const tiers: R.NonEmptyArray<Tier> = [existingTier];

      const actual = singleSampleCandelabra(sample, tiers);
      const expectedCandlestick = toCandlestick(sample);

      assertEquals(actual.samples, [sample]);
      assertEquals(actual.eternal, expectedCandlestick);
      assertEquals(actual.tiers.length, 1);

      // The tier should have the new candlestick as current, but preserve other properties
      assertEquals(actual.tiers[0].name, "1m");
      assertEquals(actual.tiers[0].duration, oneMinute);
      assertEquals(actual.tiers[0].current, expectedCandlestick);
      // History should be preserved
      assertEquals(actual.tiers[0].history, [candlestick1, candlestick2]);
    },
  );

  await t.step("singleSampleCandelabra handles multiple tiers", () => {
    const sample = toSample(9, testTime);
    const tier1: Tier = {
      name: "1m",
      duration: oneMinute,
      history: [],
      current: candlestick1,
    };
    const tier2: Tier = {
      name: "3m",
      duration: threeMinute,
      history: [candlestick2],
      current: candlestick2,
    };
    const tiers: R.NonEmptyArray<Tier> = [tier1, tier2];

    const actual = singleSampleCandelabra(sample, tiers);
    const expectedCandlestick = toCandlestick(sample);

    assertEquals(actual.tiers.length, 2);
    assertEquals(actual.tiers[0].current, expectedCandlestick);
    assertEquals(actual.tiers[1].current, expectedCandlestick);
  });
});

Deno.test("samplesToCandlestick", async (t) => {
  await t.step(
    "samplesToCandlestick reduces multiple samples to single candlestick",
    () => {
      const samples: R.NonEmptyArray<Sample> = [sample1, sample2, sample3];
      const actual = samplesToCandlestick(samples);

      // Should have open from first sample, close from last sample
      assertEquals(actual.open, 2);
      assertEquals(actual.close, 1);
      // Should have high and low from all samples
      assertEquals(actual.high, 4);
      assertEquals(actual.low, 1);
      // Should have correct time range
      assertEquals(actual.openAt, testTime);
      assertEquals(actual.closeAt, testTime.plus({ minutes: 1 })); // 60 seconds = 1 minute
    },
  );

  await t.step("samplesToCandlestick handles single sample", () => {
    const samples: R.NonEmptyArray<Sample> = [sample1];
    const actual = samplesToCandlestick(samples);

    assertEquals(actual.open, 2);
    assertEquals(actual.close, 2);
    assertEquals(actual.high, 2);
    assertEquals(actual.low, 2);
    assertEquals(actual.mean, 2);
    assertEquals(actual.openAt, testTime);
    assertEquals(actual.closeAt, testTime);
  });

  await t.step("samplesToCandlestick handles out of order samples", () => {
    const samples: R.NonEmptyArray<Sample> = [sample3, sample1, sample2]; // Out of order
    const actual = samplesToCandlestick(samples);

    // Should sort by datetime and use first as open, last as close
    assertEquals(actual.open, 2); // sample1 is earliest
    assertEquals(actual.close, 1); // sample3 is latest
    assertEquals(actual.high, 4); // sample2 has highest value
    assertEquals(actual.low, 1); // sample3 has lowest value
    assertEquals(actual.openAt, testTime); // sample1 datetime
    // for some reason, I need to stringify these to get them to compare?
    assertEquals(
      JSON.stringify(actual.closeAt),
      JSON.stringify(testTime.plus({ minutes: 1 })),
    ); // sample3 datetime (60 seconds = 1 minute)
  });
});

Deno.test("reduceCandlesticks", async (t) => {
  await t.step(
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

  await t.step("reduceCandlesticks should handle single candlestick", () => {
    const actual = reduceCandlesticks([candlestick1]);
    assertEquals(actual, candlestick1);
  });

  await t.step(
    "reduceCandlesticks should handle multiple candlesticks in order",
    () => {
      console.log("HERE");
      const actual = reduceCandlesticks([
        candlestick1,
        candlestick2,
        candlestick3,
      ]);
      console.log("HERE2");

      assertEquals(actual.open, 2); // First candlestick open
      assertEquals(actual.close, 1); // Last candlestick close
      assertEquals(actual.high, 4); // Highest value across all
      assertEquals(actual.low, 1); // Lowest value across all
      assertEquals(actual.openAt, testTime); // First candlestick openAt
      assertAlmostEquals(actual.mean, 2.3333333333333335); // (2 + 4 + 1) / 3 = 2.33
      // for some reason, I need to stringify these to get them to compare?
      assertEquals(
        JSON.stringify(actual.closeAt),
        JSON.stringify(testTime.plus({ minutes: 1 })),
      ); // Last candlestick closeAt (60 seconds = 1 minute)
    },
  );

  await t.step(
    "reduceCandlesticks should handle candlesticks with same values",
    () => {
      const candlestickA = toCandlestick(toSample(5, testTime));
      const candlestickB = toCandlestick(
        toSample(5, testTime.plus({ seconds: 30 })),
      );
      const actual = reduceCandlesticks([candlestickA, candlestickB]);

      assertEquals(actual.open, 5);
      assertEquals(actual.close, 5);
      assertEquals(actual.high, 5);
      assertEquals(actual.low, 5);
      assertEquals(actual.mean, 5);
      assertEquals(actual.openAt, testTime);
      assertEquals(actual.closeAt, testTime.plus({ seconds: 30 }));
    },
  );

  await t.step(
    "reduceCandlesticks should handle candlesticks with decreasing values",
    () => {
      const candlestickA = toCandlestick(toSample(10, testTime));
      const candlestickB = toCandlestick(
        toSample(8, testTime.plus({ seconds: 30 })),
      );
      const candlestickC = toCandlestick(
        toSample(6, testTime.plus({ seconds: 60 })),
      );
      const actual = reduceCandlesticks([
        candlestickA,
        candlestickB,
        candlestickC,
      ]);

      assertEquals(actual.open, 10);
      assertEquals(actual.close, 6);
      assertEquals(actual.high, 10);
      assertEquals(actual.low, 6);
      assertEquals(actual.openAt, testTime);
      assertEquals(actual.closeAt, testTime.plus({ seconds: 60 }));
    },
  );

  await t.step(
    "reduceCandlesticks should handle candlesticks with increasing values",
    () => {
      const candlestickA = toCandlestick(toSample(1, testTime));
      const candlestickB = toCandlestick(
        toSample(3, testTime.plus({ seconds: 30 })),
      );
      const candlestickC = toCandlestick(
        toSample(5, testTime.plus({ seconds: 60 })),
      );
      const actual = reduceCandlesticks([
        candlestickA,
        candlestickB,
        candlestickC,
      ]);

      assertEquals(actual.open, 1);
      assertEquals(actual.close, 5);
      assertEquals(actual.high, 5);
      assertEquals(actual.low, 1);
      assertEquals(actual.openAt, testTime);
      assertEquals(actual.closeAt, testTime.plus({ seconds: 60 }));
    },
  );

  await t.step(
    "reduceCandlesticks should handle candlesticks with mixed values",
    () => {
      const candlestickA = toCandlestick(toSample(3, testTime));
      const candlestickB = toCandlestick(
        toSample(7, testTime.plus({ seconds: 30 })),
      );
      const candlestickC = toCandlestick(
        toSample(2, testTime.plus({ seconds: 60 })),
      );
      const actual = reduceCandlesticks([
        candlestickA,
        candlestickB,
        candlestickC,
      ]);

      assertEquals(actual.open, 3);
      assertEquals(actual.close, 2);
      assertEquals(actual.high, 7);
      assertEquals(actual.low, 2);
      assertEquals(actual.openAt, testTime);
      assertEquals(actual.closeAt, testTime.plus({ seconds: 60 }));
    },
  );

  await t.step("reduceCandlesticks should handle mean calculation", () => {
    const newSample = toSample(1, tPlusOneMs);
    const sampleCandlestick = toCandlestick(newSample);
    const actual = reduceCandlesticks([
      defaultSampleCandlestick,
      sampleCandlestick,
    ]);
    const expected = {
      open: 2,
      close: 1,
      high: 2,
      low: 1,
      mean: 1.5,
      openAt: testTime,
      closeAt: tPlusOneMs,
    };
    assertEquals(actual, expected);
  });
});
