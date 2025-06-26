import { DateTime, Duration } from "luxon";
import {
  addSamplesToCandelabra,
  addSampleToCandelabra,
  historizeCandlestick,
  reduceCandlesticks,
  toCandelabra,
  toCandlestick,
  toSample,
} from "./candlestick.ts";
import { assertAlmostEquals, assertEquals } from "jsr:@std/assert";
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

const defaultSample = toSample(2, testTime);
const defaultSampleCandlestick = toCandlestick(defaultSample);

const oneMinute = Duration.fromISO("PT1M");
const oneMinuteTier = { name: "1m", duration: oneMinute };
const oneMinuteCandelabra = toCandelabra(defaultSample, [
  oneMinuteTier,
]);

const threeMinute = Duration.fromISO("PT3M");
const threeMinuteTier = { name: "3m", duration: threeMinute };
const oneAndThreeMinuteCandelabra = toCandelabra(defaultSample, [
  oneMinuteTier,
  threeMinuteTier,
]);

// Helper function for comparing objects with float tolerance
function assertEqualsWithFloatTolerance(
  actual: any,
  expected: any,
  tolerance: number = 1e-6,
  path: string = "",
): void {
  if (typeof actual === "number" && typeof expected === "number") {
    assertAlmostEquals(
      actual,
      expected,
      tolerance,
      `${path}: ${actual} ≈ ${expected}`,
    );
    return;
  }

  if (typeof actual !== typeof expected) {
    throw new Error(
      `${path}: Types don't match. Expected ${typeof expected}, got ${typeof actual}`,
    );
  }

  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (actual.length !== expected.length) {
      throw new Error(
        `${path}: Array lengths don't match. Expected ${expected.length}, got ${actual.length}`,
      );
    }
    actual.forEach((item, index) => {
      assertEqualsWithFloatTolerance(
        item,
        expected[index],
        tolerance,
        `${path}[${index}]`,
      );
    });
    return;
  }

  if (typeof actual === "object" && actual !== null && expected !== null) {
    const actualKeys = Object.keys(actual);
    const expectedKeys = Object.keys(expected);

    if (actualKeys.length !== expectedKeys.length) {
      throw new Error(
        `${path}: Object key counts don't match. Expected ${expectedKeys.length}, got ${actualKeys.length}`,
      );
    }

    expectedKeys.forEach((key) => {
      if (!(key in actual)) {
        throw new Error(`${path}: Missing key '${key}' in actual`);
      }
      assertEqualsWithFloatTolerance(
        actual[key],
        expected[key],
        tolerance,
        `${path}.${key}`,
      );
    });
    return;
  }

  assertEquals(actual, expected, path);
}

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

Deno.test(
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

Deno.test(
  "addSampleToCandelabra should be idempotent when adding the same sample",
  () => {
    const actual = addSampleToCandelabra(defaultSample, oneMinuteCandelabra);
    const expected = oneMinuteCandelabra;
    assertEquals(actual, expected);
  },
);

Deno.test(
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

Deno.test(
  "addSampleToCandelabra should ignore a sample with datetime earlier than the oldest sample",
  () => {
    const tooOld = testTime.minus(oneMinute).minus({ milliseconds: 1 });
    const tooOldSample = toSample(1, tooOld);
    const actual = addSampleToCandelabra(tooOldSample, oneMinuteCandelabra);
    const expected = oneMinuteCandelabra;
    assertEquals(actual, expected);
  },
);

Deno.test(
  "addSampleToCandelabra: current candlestick's closeAt should be updated to the new sample's datetime",
  () => {
    const newSample = toSample(4, testTime.plus({ seconds: 30 }));
    const actual = addSampleToCandelabra(newSample, oneMinuteCandelabra);

    const expectedCandlestick = {
      open: 2,
      close: 4,
      high: 4,
      low: 2,
      mean: 3,
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

Deno.test(
  "addSampleToCandelabra, when given a sample that's after the first bucket's current candlestick, should add the old candlestick to history and create a new current candlestick with the new sample. It should also prune the samples to only contain those that are newer than the oldest sample in the new current candlestick.",
  () => {
    const secondMinTime = testTime.plus({ seconds: 90 });
    const secondMinSample = toSample(6, secondMinTime); // this sample should fall outside the 1m bucket's first candlestick
    const secondMinSampleCandlestick = toCandlestick(secondMinSample);

    const samples: R.NonEmptyArray<Sample> = [
      secondMinSample,
    ];

    const actual = addSamplesToCandelabra(samples, oneMinuteCandelabra);
    const firstMinCloseAt = testTime.plus(oneMinute);
    const eternalCandlestick = reduceCandlesticks([
      defaultSampleCandlestick,
      secondMinSampleCandlestick,
    ]);
    // console.log("defaultSampleCandlestick");
    // renderSmartCandlesticks([defaultSampleCandlestick], oneMinute);
    // console.log("secondMinCandlestick");
    // renderSmartCandlesticks([secondMinCandlestick], oneMinute);
    // console.log("eternalCandlestick");
    // renderSmartCandlesticks([eternalCandlestick], oneMinute);
    const expectedHistory = [
      historizeCandlestick(defaultSampleCandlestick, oneMinute),
    ];
    const expectedSecondMinCandlestick = {
      ...secondMinSampleCandlestick,
      openAt: firstMinCloseAt,
    };
    const expected = {
      samples: [secondMinSample] as R.NonEmptyArray<Sample>,
      tiers: [
        {
          name: "1m",
          duration: oneMinute,
          history: expectedHistory,
          current: expectedSecondMinCandlestick,
        },
      ] as R.NonEmptyArray<Tier>,
      eternal: eternalCandlestick,
    };
    // todo why do I have to stringify these to make them equal?
    assertEquals(JSON.stringify(actual), JSON.stringify(expected));
  },
);

Deno.test("addSampleToCandelabra: multi-tier: should handle a sample causing a tier to cascade", () => {
  // first, "bases loaded" on the 1m tier
  // first minute filled by default sample above, and time started
  const secondMinOpenAt = testTime.plus(oneMinute);
  const secondMinSampleTime = testTime.plus({ seconds: 61 });
  const secondMinSample = toSample(4, secondMinSampleTime); // fill second minute tier
  const thirdMinOpenAt = secondMinSampleTime.plus(oneMinute);
  const thirdMinSampleTime = secondMinSampleTime.plus({ seconds: 61 });
  const thirdMinSample = toSample(6, thirdMinSampleTime); // fill third minute tier
  const samples: R.NonEmptyArray<Sample> = [
    // don't need to include defaultSample because the candelabra is created with it
    secondMinSample,
    thirdMinSample,
  ];
  const actualBasesLoaded = addSamplesToCandelabra(
    samples,
    oneAndThreeMinuteCandelabra,
  );
  const expectedFirstMinCandlestick = {
    ...toCandlestick(defaultSample),
    openAt: testTime,
    closeAt: testTime.plus(oneMinute),
  };
  const expectedSecondMinCandlestick = {
    ...toCandlestick(secondMinSample),
    openAt: secondMinOpenAt,
    closeAt: thirdMinOpenAt,
  };
  const expectedThirdMinCurrentCandlestick = {
    ...toCandlestick(thirdMinSample),
    openAt: thirdMinSampleTime,
    closeAt: thirdMinSampleTime,
  };
  const expectedFirstSecondThirdMinCurrentCandlestick = reduceCandlesticks([
    expectedFirstMinCandlestick,
    expectedSecondMinCandlestick,
    expectedThirdMinCurrentCandlestick,
  ]);
  const expectedBasesLoaded: Candelabra = {
    samples: [thirdMinSample] as R.NonEmptyArray<Sample>,
    tiers: [
      {
        name: "1m",
        duration: oneMinute,
        history: [expectedFirstMinCandlestick, expectedSecondMinCandlestick],
        current: expectedThirdMinCurrentCandlestick,
      },
      {
        name: "3m",
        duration: threeMinute,
        history: [],
        current: expectedFirstSecondThirdMinCurrentCandlestick,
      },
    ],
    eternal: expectedFirstSecondThirdMinCurrentCandlestick,
  };
  assertEquals(actualBasesLoaded, expectedBasesLoaded);

  // // now that bases are loaded, trigger a cascade:
  // const fourthMinTime = thirdMinSampleTime.plus({ seconds: 61 });
  // const fourthMinSample = toSample(8, fourthMinTime);
  // const actualCascaded = addSampleToCandelabra(
  //   fourthMinSample,
  //   actualBasesLoaded,
  // );
  // const expectedThirdMinCandlestick = {
  //   ...toCandlestick(thirdMinSample),
  //   openAt: thirdMinSampleTime,
  //   closeAt: thirdMinSampleTime.plus(oneMinute),
  // };
  // const expectedFourthMinCandlestick = {
  //   ...toCandlestick(fourthMinSample),
  //   openAt: fourthMinTime,
  //   closeAt: fourthMinTime,
  // };
  // const expectedEternalCandlestick = reduceCandlesticks([
  //   expectedFirstMinCandlestick,
  //   expectedSecondMinCandlestick,
  //   expectedThirdMinCandlestick,
  //   expectedFourthMinCandlestick,
  // ]);
  // const expectedCascaded = {
  //   samples: [fourthMinSample] as R.NonEmptyArray<Sample>,
  //   tiers: [
  //     {
  //       name: "1m",
  //       duration: oneMinute,
  //       history: [],
  //       current: expectedFourthMinCandlestick,
  //     },
  //     {
  //       name: "3m",
  //       duration: threeMinute,
  //       history: [expectedFirstSecondThirdMinCurrentCandlestick],
  //       current: expectedFourthMinCandlestick,
  //     },
  //   ],
  //   eternal: expectedEternalCandlestick,
  // };
  // assertEquals(actualCascaded, expectedCascaded);
});

Deno.test(
  "addSampleToCandelabra: if a sample is recieved that more than two durations away from the openAt of the first bucket's current candlestick, should generate the correct number of historical candlesticks in that bucket using existing data",
  () => {
    const fourthMinSample = toSample(4, testTime.plus({ minutes: 3 }));
    const actual = addSamplesToCandelabra(
      [fourthMinSample],
      oneMinuteCandelabra,
    );

    // we expect a first min candlestick that consists of the single sample that falls within it
    const expectedFirstMinCandlestick = reduceCandlesticks([
      defaultSampleCandlestick,
      toCandlestick(fourthMinSample),
    ]);

    // we expect a second min candlestick that consists entirely of one datapoint extrapolated from the last data point we have before it
    const expectedSecondMinCandlestick = {
      ...toCandlestick(defaultSample),
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
    const expectedCurrentCandlestick = {
      ...toCandlestick(fourthMinSample),
      openAt: testTime.plus({ minutes: 3 }),
    };
    const expectedEternalCandlestick = reduceCandlesticks([
      expectedFirstMinCandlestick,
      expectedSecondMinCandlestick,
      expectedThirdMinCandlestick,
      toCandlestick(fourthMinSample), // note that we want the sample openAt (as opposed to the "snapped" one) when adding the current candlestick to eternal
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
    console.log(`actual current: ${JSON.stringify(actual.tiers[0].current)}`);
    console.log(
      `expected current: ${JSON.stringify(expected.tiers[0].current)}`,
    );
    assertEquals(actual, expected);
  },
);
