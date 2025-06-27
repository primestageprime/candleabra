import { DateTime, Duration } from "luxon";
import * as R from "ramda";
import type { Granularity, GranularityConfig } from "./types.ts";

/**
 * Parses a granularity string (e.g., "1m", "5m", "2h", "5d") into a Granularity object
 */
export function parseGranularity(granularity: string): Granularity {
  const match = granularity.match(/^(\d+)([mhd])$/);
  if (!match) {
    throw new Error(`Invalid granularity format: ${granularity}. Expected format like "1m", "5m", "2h", "5d"`);
  }
  
  const [, amountStr, unit] = match;
  const amount = parseInt(amountStr, 10);
  
  // Validate that the amount divides evenly into the base unit
  const baseUnits = { m: 60, h: 24, d: 1 };
  const baseUnit = baseUnits[unit as keyof typeof baseUnits];
  if (baseUnit % amount !== 0) {
    throw new Error(`Invalid granularity: ${granularity}. ${amount} does not divide evenly into ${baseUnit} ${unit}`);
  }
  
  let duration: Duration;
  switch (unit) {
    case 'm':
      duration = Duration.fromObject({ minutes: amount });
      break;
    case 'h':
      duration = Duration.fromObject({ hours: amount });
      break;
    case 'd':
      duration = Duration.fromObject({ days: amount });
      break;
    default:
      throw new Error(`Unsupported unit: ${unit}`);
  }
  
  return {
    name: granularity,
    duration,
  };
}

/**
 * Creates a list of Granularity objects from a GranularityConfig
 */
export function createGranularities(config: GranularityConfig): Granularity[] {
  return R.map(parseGranularity, config);
}

/**
 * Gets the bucket start time for a given datetime and duration
 */
export function getBucketStart(dateTime: DateTime, duration: Duration): DateTime {
  const durationMillis = duration.as("milliseconds");
  const dateTimeMillis = dateTime.toMillis();
  const bucketStartMillis = Math.floor(dateTimeMillis / durationMillis) * durationMillis;
  return DateTime.fromMillis(bucketStartMillis);
} 