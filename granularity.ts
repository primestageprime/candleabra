import * as R from "ramda";
import type { Granularity, GranularityConfig } from "./types.ts";

/**
 * Parses a granularity string (e.g., "1m", "5m", "2h", "5d") into a Granularity object
 * @param granularity - String representation of granularity
 * @returns Granularity object with name and duration in milliseconds
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
        `- days (d): any positive integer`,
    );
  }

  const [, amountStr, unit] = match;
  const amount = parseInt(amountStr, 10);

  // Validate that the amount divides evenly into the base unit
  if (unit === "m" && 60 % amount !== 0) {
    throw new Error(
      `Invalid minute granularity: "${granularity}". ` +
        `${amount} does not divide evenly into 60 minutes. ` +
        `Valid values: 1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30`,
    );
  }
  if (unit === "h" && 24 % amount !== 0) {
    throw new Error(
      `Invalid hour granularity: "${granularity}". ` +
        `${amount} does not divide evenly into 24 hours. ` +
        `Valid values: 1, 2, 3, 4, 6, 8, 12`,
    );
  }
  if (unit === "d" && amount <= 0) {
    throw new Error(
      `Invalid day granularity: "${granularity}". ` +
        `Days must be a positive integer, got: ${amount}`,
    );
  }

  let durationMs: number;
  switch (unit) {
    case "m":
      durationMs = amount * 60 * 1000; // minutes to milliseconds
      break;
    case "h":
      durationMs = amount * 60 * 60 * 1000; // hours to milliseconds
      break;
    case "d":
      durationMs = amount * 24 * 60 * 60 * 1000; // days to milliseconds
      break;
    default:
      throw new Error(`Unsupported unit: ${unit}. Supported units: m, h, d`);
  }

  return {
    name: granularity,
    durationMs,
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
 * Gets the bucket start time for a given timestamp and duration
 * Aligns the timestamp to the start of its time bucket
 * @param timestamp - The timestamp in milliseconds to align
 * @param durationMs - The bucket duration in milliseconds
 * @returns Timestamp aligned to bucket start in milliseconds
 */
export function getBucketStart(timestamp: number, durationMs: number): number {
  return Math.floor(timestamp / durationMs) * durationMs;
}
