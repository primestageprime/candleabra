import { DateTime, Duration } from "luxon";
import * as R from "ramda";
import type { Granularity, GranularityConfig } from "./types.ts";

/**
 * Parses a granularity string (e.g., "1m", "5m", "2h", "5d") into a Granularity object
 * @param granularity - String representation of granularity
 * @returns Granularity object with name and duration
 * @throws Error for invalid formats or unsupported values
 */
export function parseGranularity(granularity: string): Granularity {
  const match = granularity.match(/^(\d+)([mhd])$/);
  if (!match) {
    throw new Error(
      `Invalid granularity format: "${granularity}". ` +
      `Expected format like "1m", "5m", "2h", "5d" where: ` +
      `- minutes (m): must divide 60 evenly (1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30) ` +
      `- hours (h): must divide 24 evenly (1, 2, 3, 4, 6, 8, 12) ` +
      `- days (d): any positive integer`
    );
  }
  
  const [, amountStr, unit] = match;
  const amount = parseInt(amountStr, 10);
  
  // Validate that the amount divides evenly into the base unit
  if (unit === 'm' && 60 % amount !== 0) {
    throw new Error(
      `Invalid minute granularity: "${granularity}". ` +
      `${amount} does not divide evenly into 60 minutes. ` +
      `Valid values: 1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30`
    );
  }
  if (unit === 'h' && 24 % amount !== 0) {
    throw new Error(
      `Invalid hour granularity: "${granularity}". ` +
      `${amount} does not divide evenly into 24 hours. ` +
      `Valid values: 1, 2, 3, 4, 6, 8, 12`
    );
  }
  if (unit === 'd' && amount <= 0) {
    throw new Error(
      `Invalid day granularity: "${granularity}". ` +
      `Days must be a positive integer, got: ${amount}`
    );
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
      throw new Error(`Unsupported unit: ${unit}. Supported units: m, h, d`);
  }
  
  return {
    name: granularity,
    duration,
  };
}

/**
 * Creates a list of Granularity objects from a GranularityConfig
 * @param config - Array of granularity strings
 * @returns Array of parsed Granularity objects
 */
export function createGranularities(config: GranularityConfig): Granularity[] {
  return R.map(parseGranularity, config);
}

/**
 * Gets the bucket start time for a given datetime and duration
 * Aligns the datetime to the start of its time bucket
 * @param dateTime - The datetime to align
 * @param duration - The bucket duration
 * @returns DateTime aligned to bucket start
 */
export function getBucketStart(dateTime: DateTime, duration: Duration): DateTime {
  const durationMillis = duration.as("milliseconds");
  const dateTimeMillis = dateTime.toMillis();
  const bucketStartMillis = Math.floor(dateTimeMillis / durationMillis) * durationMillis;
  return DateTime.fromMillis(bucketStartMillis);
} 