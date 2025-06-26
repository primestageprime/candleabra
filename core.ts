import * as R from "ramda";
import type { NonEmptyArray } from "npm:@types/ramda@0.30.2";
import type {
  Candelabra,
  Candlestick,
  Sample,
  Tier,
  TierConfig,
} from "./types.d.ts";
import {
  getClose,
  getCloseAt,
  getHigh,
  getLow,
  getOpen,
  getOpenAt,
  getTimeWeightedMean,
} from "./utils.ts";
import { DateTime } from "luxon";

// Re-export types
export * from "./types.d.ts";

export interface GridData {
  start: string;
  duration: string;
  end: string;
  open: string;
  mean: string;
  close: string;
  low: string;
}

export const reduceCandlesticks: (
  list: NonEmptyArray<Candlestick>,
) => Candlestick = R.pipe(
  // Sort candlesticks by datetime to ensure proper chronological order
  R.sortBy((c: Candlestick) => c.openAt.toMillis()),
  R.applySpec<Candlestick>({
    open: getOpen,
    close: getClose,
    high: getHigh,
    low: getLow,
    mean: getTimeWeightedMean,
    openAt: getOpenAt,
    closeAt: getCloseAt,
  }),
);

export const toCandlestick: (sample: Sample) => Candlestick = (sample) => {
  return {
    open: sample.value,
    close: sample.value,
    high: sample.value,
    low: sample.value,
    mean: sample.value,
    openAt: sample.dateTime,
    closeAt: sample.dateTime,
  };
};

export const toTier = (
  tierConfig: TierConfig,
  candlestick: Candlestick,
): Tier => {
  return {
    ...tierConfig,
    history: [],
    current: candlestick,
  };
};

export function toSample(value: number, dateTime: DateTime): Sample {
  return { dateTime, value };
}

export function toCandelabra(
  sample: Sample,
  tierConfigs: R.NonEmptyArray<TierConfig>,
): Candelabra {
  const initialCandlestick: Candlestick = toCandlestick(sample);
  const tiers: R.NonEmptyArray<Tier> = R.map(
    (config) => toTier(config, initialCandlestick),
    tierConfigs,
  ) as R.NonEmptyArray<Tier>;
  return {
    samples: [sample],
    tiers: tiers,
    eternal: initialCandlestick,
  };
}

export function singleSampleCandelabra(
  sample: Sample,
  tiers: NonEmptyArray<Tier>,
): Candelabra {
  return {
    samples: [sample],
    tiers: R.map(
      (tier) => ({
        ...tier,
        current: toCandlestick(sample),
      }),
      tiers,
    ) as R.NonEmptyArray<Tier>,
    eternal: toCandlestick(sample),
  };
}

export function samplesToCandlestick(
  samples: R.NonEmptyArray<Sample>,
): Candlestick {
  const updatedCandlesticks = R.map(
    toCandlestick,
    samples,
  ) as R.NonEmptyArray<Candlestick>;
  return reduceCandlesticks(updatedCandlesticks);
}
