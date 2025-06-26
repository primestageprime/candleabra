import { DateTime, Duration } from "luxon";
import { addSamplesToCandelabra, addSampleToCandelabra } from "./candelabra.ts";
import {
  reduceCandlesticks,
  toCandelabra,
  toCandlestick,
  toSample,
} from "./core.ts";
import { historizeCandlestick } from "./utils.ts";
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
const oneMinuteCandelabra = toCandelabra(defaultSample, [
  oneMinuteTier,
]);

const threeMinute = Duration.fromISO("PT3M");
const threeMinuteTier = { name: "3m", duration: threeMinute };
const oneAndThreeMinuteCandelabra = toCandelabra(defaultSample, [
  oneMinuteTier,
  threeMinuteTier,
]);

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
