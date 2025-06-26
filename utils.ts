import * as R from "ramda";
import type { NonEmptyArray } from "npm:@types/ramda@0.30.2";
import type { Candlestick, Sample, Tier } from "./types.d.ts";
import { DateTime, Duration } from "luxon";

export const getOpenAt: (list: NonEmptyArray<Candlestick>) => DateTime = R.pipe<
  [NonEmptyArray<Candlestick>],
  Candlestick,
  DateTime
>(
  R.head,
  R.prop("openAt"),
);

export const getCloseAt: (list: NonEmptyArray<Candlestick>) => DateTime = R
  .pipe<[NonEmptyArray<Candlestick>], Candlestick, DateTime>(
    R.last,
    R.prop("closeAt"),
  );

export const getOpen: (list: NonEmptyArray<Candlestick>) => number = R.pipe<
  [NonEmptyArray<Candlestick>],
  Candlestick,
  number
>(
  R.head,
  R.prop("open"),
);

export const getClose: (list: NonEmptyArray<Candlestick>) => number = R.pipe<
  [NonEmptyArray<Candlestick>],
  Candlestick,
  number
>(
  R.last,
  R.prop("close"),
);

export const getHigh = (list: NonEmptyArray<Candlestick>): number => {
  if (list.length === 1) {
    return list[0].high;
  }

  return R.reduce<Candlestick, number>(
    (acc, c) => R.isNil(acc) ? c.high : Math.max(acc, c.high),
    R.head(list)!.high,
  )(R.tail(list));
};

export const getLow = (list: NonEmptyArray<Candlestick>): number => {
  if (list.length === 1) {
    return list[0].low;
  }

  return R.reduce<Candlestick, number>(
    (acc, c) => R.isNil(acc) ? c.low : Math.min(acc, c.low),
    R.head(list)!.low,
  )(R.tail(list));
};

export const getMean = (list: NonEmptyArray<Candlestick>): number => {
  if (list.length === 1) {
    return list[0].mean;
  }
  const means = R.map(R.prop("mean"), list);
  const result = R.mean(means);
  console.log(
    `mean of ${JSON.stringify(means)}: ${
      R.sum(means)
    } / ${means.length} = ${result}`,
  );
  return result;
};

export const getTimeWeightedMean = (
  list: NonEmptyArray<Candlestick>,
): number => {
  if (list.length === 1) {
    return list[0].mean;
  }

  const init = R.init(list);
  const last = R.last(list);
  const openAt = init[0].openAt;
  const closeAt = R.last(init)!.closeAt;
  const duration = R.equals(closeAt, openAt)
    ? 1
    : closeAt.diff(openAt, "milliseconds").as("milliseconds");

  const initMeans = R.map(R.prop("mean"), init);
  const initMeansSum = R.sum(initMeans);
  const weightedInitMean = initMeansSum / duration;

  const result = (weightedInitMean + last.mean) / 2;

  // console.log(`duration: ${duration}`);
  // console.log(
  //   `mean of ${JSON.stringify(initMeans)} and ${last.mean}: ${
  //     weightedInitMean + last.mean
  //   } / 2 = ${result}`,
  // );
  return result;
};

// Calculate the cutoff time: latest sample time minus smallest tier duration
export function getCutoffTime(
  latestSample: Sample,
  tiers: NonEmptyArray<Tier>,
): DateTime {
  const smallestTierDuration = tiers[0].duration;
  return latestSample.dateTime.minus(smallestTierDuration);
}

export function getDistance(
  lastHistoricalCandlestick: Candlestick | undefined,
  oldestSampleDateTime: DateTime,
  newestSampleDateTime: DateTime,
): Duration {
  const openAt = lastHistoricalCandlestick?.closeAt || oldestSampleDateTime;
  return newestSampleDateTime.diff(openAt, "milliseconds");
}

export function historizeCandlestick(
  candlestick: Candlestick,
  duration: Duration,
): Candlestick {
  return {
    ...candlestick,
    // historized candlesticks should be fixed to the size of the duration after openAt
    closeAt: candlestick.openAt.plus(duration),
  };
}

export function toHistoricalCandlesticks(
  candlestick: Candlestick,
  duration: Duration,
  distance: Duration,
): R.NonEmptyArray<Candlestick> {
  const numToGenerate = Math.floor(
    distance / duration.as("milliseconds"),
  );

  // Use the candlestick's openAt as the anchor time for all bucket boundaries
  const anchorTime = candlestick.openAt;

  const syntheticCandlesticks = (numToGenerate > 1)
    ? R.range(
      0,
      numToGenerate,
    ).map((i) => {
      return {
        ...candlestick,
        openAt: anchorTime.plus({
          milliseconds: i * duration.as("milliseconds"),
        }),
        closeAt: anchorTime.plus({
          milliseconds: (i + 1) * duration.as("milliseconds"),
        }),
      };
    }) as R.NonEmptyArray<Candlestick>
    : [];
  return R.append(candlestick, syntheticCandlesticks) as R.NonEmptyArray<
    Candlestick
  >;
}

export function pruneSamples(
  tiers: R.NonEmptyArray<Tier>,
  sortedSamples: R.NonEmptyArray<Sample>,
) {
  const firstTier = tiers[0];
  const sampleCutoff = firstTier.current?.openAt;
  const samples = R.dropWhile(
    (sample) => sample.dateTime < sampleCutoff,
    sortedSamples,
  ) as R.NonEmptyArray<Sample>;
  return samples;
}

export function updateSamples(
  sample: Sample,
  candelabra: { samples: R.NonEmptyArray<Sample> },
): R.NonEmptyArray<Sample> {
  const existingIndex = R.findIndex(
    (existingSample) => existingSample.dateTime.equals(sample.dateTime),
    candelabra.samples,
  );

  // Update samples based on whether we need to upsert or append
  const updatedSamples = existingIndex >= 0
    ? R.adjust(
      existingIndex,
      () => sample,
      candelabra.samples,
    ) as R.NonEmptyArray<Sample>
    : R.append(sample, candelabra.samples) as R.NonEmptyArray<Sample>;

  // Sort samples by datetime (ascending, oldest first) for aggregates
  const sortedSamples = R.sort(
    (a: Sample, b: Sample) => a.dateTime.toMillis() - b.dateTime.toMillis(),
    updatedSamples,
  ) as R.NonEmptyArray<Sample>;
  return sortedSamples;
}
