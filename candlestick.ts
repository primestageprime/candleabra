import * as R from "ramda";
import type { NonEmptyArray } from "npm:@types/ramda@0.30.2";
import type { Accumulator, Candlestick, SampleTiers } from "./types.d.ts";
import { getClose, getHigh, getLow, getMean, getOpen } from "./utils.ts";
import {
  fifteenMinuteish,
  fiveMinuteish,
  hourish,
  LARGEST_GRANULARITY,
  minuteish,
  SMALLEST_GRANULARITY,
} from "./constants.ts";
import { DateTime } from "luxon";

// Re-export types
export type { Accumulator, Candlestick };
export {
  fifteenMinuteish,
  fiveMinuteish,
  hourish,
  LARGEST_GRANULARITY,
  minuteish,
  SMALLEST_GRANULARITY,
};

export interface GridData {
  start: string;
  duration: string;
  end: string;
  open: string;
  mean: string;
  close: string;
  low: string;
}

export function observeCandlestick(
  candlestick: Candlestick,
  startTime?: string,
  endTime?: string,
): GridData {
  return {
    start: startTime || "N/A",
    duration: "1m", // You can make this configurable
    end: endTime || "N/A",
    open: candlestick.open.toString(),
    mean: candlestick.mean.toString(),
    close: candlestick.close.toString(),
    low: candlestick.low.toString(),
  };
}

/**
 * Updates the one-sample candlesticks in the accumulator with a new value
 */
export function updateAtomicSampleCandlesticks(
  accumulator: Accumulator | null,
  value: number,
  pruningCount: number,
): Accumulator {
  const newCandlestick = {
    open: value,
    close: value,
    high: value,
    low: value,
    mean: value,
    openAt: DateTime.now(),
    closeAt: DateTime.now(),
  };

  if (!accumulator) {
    return {
      [SMALLEST_GRANULARITY]: [newCandlestick],
      [LARGEST_GRANULARITY]: [newCandlestick],
    };
  }

  return {
    ...accumulator,
    [SMALLEST_GRANULARITY]: R.isEmpty(accumulator[SMALLEST_GRANULARITY])
      ? [newCandlestick]
      : R.takeLast(pruningCount, [
        ...accumulator[SMALLEST_GRANULARITY],
        newCandlestick,
      ]) as R.NonEmptyArray<Candlestick>,
    [LARGEST_GRANULARITY]: R.isEmpty(accumulator[LARGEST_GRANULARITY])
      ? [newCandlestick]
      : R.takeLast(pruningCount, [
        ...accumulator[LARGEST_GRANULARITY],
        newCandlestick,
      ]) as R.NonEmptyArray<Candlestick>,
  };
}

/**
 * Updates the all-samples candlestick with a new value
 */
export const updateAllSamplesCandlestick =
  (largestTierGranularity: keyof Accumulator) =>
  (accumulator: Accumulator): Accumulator => {
    const samples: R.NonEmptyArray<Candlestick> =
      accumulator[largestTierGranularity];
    const result: R.NonEmptyArray<Candlestick> = [
      toCandlestick([...accumulator[LARGEST_GRANULARITY], ...samples]),
    ];
    return {
      ...accumulator,
      [LARGEST_GRANULARITY]: result,
    };
  };

export const selector =
  (granularity: string, lastCount: number) =>
  (acc: Accumulator): R.NonEmptyArray<Candlestick> => {
    const samples = acc[granularity];
    if (
      !samples || !Array.isArray(samples) || granularity === LARGEST_GRANULARITY
    ) {
      return acc[LARGEST_GRANULARITY];
    }
    return R.takeLast(lastCount, samples) as R.NonEmptyArray<Candlestick>;
  };

export const toCandlestick: (list: NonEmptyArray<Candlestick>) => Candlestick =
  R.applySpec<Candlestick>({
    open: getOpen,
    close: getClose,
    high: getHigh,
    low: getLow,
    mean: getMean,
  });
/**
 * Updates the two-sample candlesticks in the accumulator
 */
export const candlestickMaker =
  (
    parentGranularity: string,
    granularity: string,
    sampleCount: number,
    pruningCount: number,
  ) =>
  (accumulator: Accumulator): Accumulator => {
    const selectedCandlesticks = selector(parentGranularity, sampleCount)(
      accumulator,
    );
    const newCandlestick = toCandlestick(selectedCandlesticks);
    const priorAccumulator: R.NonEmptyArray<Candlestick> =
      accumulator[granularity];
    const result: R.NonEmptyArray<Candlestick> = Array.isArray(priorAccumulator)
      ? [...priorAccumulator, newCandlestick]
      : [newCandlestick];
    const samples: R.NonEmptyArray<Candlestick> = pruningCount > 0
      ? R.takeLast(pruningCount, result) as R.NonEmptyArray<Candlestick>
      : result;
    return {
      ...accumulator,
      [granularity]: samples,
    };
  };

const getLargestTierGranularity = R.pipe<
  [R.NonEmptyArray<SampleTiers>],
  SampleTiers,
  string
>(
  R.last,
  R.prop("granularity"),
);

/**
 * Processes a new value and updates the accumulator
 */

export const makeProcessValue =
  (sampleTiers: R.NonEmptyArray<SampleTiers>) =>
  (accumulator: Accumulator | null, value: number): Accumulator => {
    // Update one-sample candlesticks
    const smallestTier = R.head(sampleTiers);
    let updatedAccumulator = updateAtomicSampleCandlesticks(
      accumulator,
      value,
      smallestTier.sampleCount ?? 1,
    );
    const defaultPruningCount = 1;
    let parentGranularity: string = SMALLEST_GRANULARITY;
    const pairs = R.aperture(2, [...sampleTiers, {
      granularity: "default",
      sampleCount: defaultPruningCount,
    }]);
    pairs.forEach(
      ([{ granularity, sampleCount }, { sampleCount: nextSampleCount }]) => {
        const pruningCount = nextSampleCount || defaultPruningCount;
        updatedAccumulator = candlestickMaker(
          parentGranularity,
          granularity,
          sampleCount,
          pruningCount,
        )(updatedAccumulator);
        parentGranularity = granularity;
      },
    );

    // Update all-samples candlestick
    return updateAllSamplesCandlestick(getLargestTierGranularity(sampleTiers))(
      updatedAccumulator,
    );
  };

export const processValueTwoFive: (
  accumulator: Accumulator | null,
  value: number,
) => Accumulator = makeProcessValue([{
  granularity: "samplesOf2",
  sampleCount: 2,
}, { granularity: "samplesOf5", sampleCount: 5 }]);

export const processValueTimeishSegments: (
  accumulator: Accumulator | null,
  value: number,
) => Accumulator = makeProcessValue([
  { granularity: "minuteish", sampleCount: minuteish },
  { granularity: "fiveMinuteish", sampleCount: fiveMinuteish },
  { granularity: "fifteenMinuteish", sampleCount: fifteenMinuteish },
  { granularity: "hourish", sampleCount: hourish },
]);

export function toAtomicCandlestick(
  value: number,
  dateTime: DateTime,
): Candlestick {
  return {
    open: value,
    close: value,
    high: value,
    low: value,
    mean: value,
    openAt: dateTime,
    closeAt: dateTime,
  };
}
