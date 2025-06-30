import * as R from "ramda";
import type { NonEmptyArray } from "npm:@types/ramda@0.30.2";
import type { Candlestick, Sample } from "./types.ts";
import {
  getClose,
  getCloseAt,
  getHigh,
  getLow,
  getMean,
  getOpen,
  getOpenAt,
} from "./utils.ts";
import { DateTime } from "luxon";

/**
 * Reduces multiple candlesticks into a single aggregated candlestick
 * Sorts by openAt time to ensure proper chronological order
 */
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
    mean: getMean,
    openAt: getOpenAt,
    closeAt: getCloseAt,
  }),
);

/**
 * Creates a candlestick from a single sample
 */
export function toCandlestick(sample: Sample): Candlestick {
  return {
    open: sample.value,
    close: sample.value,
    high: sample.value,
    low: sample.value,
    mean: sample.value,
    openAt: sample.dateTime,
    closeAt: sample.dateTime,
  };
}

/**
 * Creates a sample from a value and datetime
 */
export function toSample(value: number, dateTime: DateTime): Sample {
  return { dateTime, value };
}

/**
 * Calculates time-weighted mean from a list of samples
 * Handles edge cases like single samples and zero-duration periods
 */
export function calculateTimeWeightedMean(samples: Sample[]): number {
  if (samples.length === 1) {
    return samples[0].value;
  }
  
  let totalWeightedValue = 0;
  let totalDuration = 0;
  
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    let duration: number;
    
    if (i === samples.length - 1) {
      // Last sample - duration is 0 (instantaneous)
      duration = 0;
    } else {
      // Duration from this sample to the next sample
      const nextSample = samples[i + 1];
      duration = nextSample.dateTime.diff(sample.dateTime, "milliseconds").as("milliseconds");
    }
    
    totalWeightedValue += sample.value * duration;
    totalDuration += duration;
  }
  
  // If no duration, return simple average
  if (totalDuration === 0) {
    return samples.reduce((sum, s) => sum + s.value, 0) / samples.length;
  }
  
  return totalWeightedValue / totalDuration;
}

/**
 * Creates a candlestick from a list of samples with proper OHLC values
 * @param samples - Array of samples to aggregate
 * @param openAt - Start time of the candlestick bucket
 * @param closeAt - End time of the candlestick bucket
 */
export function samplesToCandlestick(samples: Sample[], openAt: DateTime, closeAt: DateTime): Candlestick {
  if (samples.length === 0) {
    throw new Error("Cannot create candlestick from empty samples");
  }
  
  const values = R.map(R.prop('value'), samples);
  
  return {
    open: R.head(values)!,
    close: R.last(values)!,
    high: Math.max(...values),
    low: Math.min(...values),
    mean: calculateTimeWeightedMean(samples),
    openAt,
    closeAt,
  };
} 