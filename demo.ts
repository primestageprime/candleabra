import { toCandlestick, reduceCandlesticks, toSample } from "./candlestick.ts";
import { DateTime } from "luxon";
import { renderSmartCandlesticks } from "./renderCandlesticks.ts";
import * as R from "ramda";
import type { Candlestick } from "./types.d.ts";

const baseTime = DateTime.fromISO("2025-06-27T00:00:00Z");

const makeSample = (value: number, offset: number) => toCandlestick(toSample(value, baseTime.plus({ seconds: offset })));

const atomics = R.map(R.apply(makeSample), [
  [1, 0],
  [50, 1],
  [3, 30],
  [1, 60],
  [50, 61],
  [3, 90],
  [1, 120],
  [5, 121],
  [3, 150],
  [1, 180],
  [5, 181],
  [3, 210],
  [1, 240],
  [5, 241],
  [3, 270],
  [1, 300],
  [5, 301],
  [3, 330],
  [1, 360],
  [5, 361],
  [3, 390],
  [1, 420],
  [5, 421],
  [20, 2000],
  [10, 2001],
  [20, 2002],
  [10, 2003],
  [20, 2004],
  [10, 2005],
  [20, 2006],
  [6, 60 * 60 * 5],
  [10, 60 * 60 * 7],
  [20, 60 * 60 * 8],
  [10, 60 * 60 * 9],
  [20, 60 * 60 * 10],
  [10, 60 * 60 * 11],
  [20, 60 * 60 * 12],
]);


function sliceCandlesticksByGranularity(candlesticks: Candlestick[], granularity: string): Candlestick[] {
  // Parse granularity (e.g., "1m", "5m", "2h", "5d")
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
  
  // Group candlesticks by their closeAt time, rounded to the granularity
  const timeSlices = R.groupBy((candlestick) => {
    const closeAt = candlestick.closeAt;
    let bucketStart: DateTime;
    
    switch (unit) {
      case 'm': {
        // Round to nearest minute interval
        const minutes = Math.floor(closeAt.minute / amount) * amount;
        bucketStart = closeAt.set({ minute: minutes, second: 0, millisecond: 0 });
        break;
      }
      case 'h': {
        // Round to nearest hour interval
        const hours = Math.floor(closeAt.hour / amount) * amount;
        bucketStart = closeAt.set({ hour: hours, minute: 0, second: 0, millisecond: 0 });
        break;
      }
      case 'd': {
        // Round to nearest day interval (for now, just use the day)
        bucketStart = closeAt.set({ hour: 0, minute: 0, second: 0, millisecond: 0 });
        break;
      }
      default:
        throw new Error(`Unsupported unit: ${unit}`);
    }
    
    return bucketStart.toISO();
  }, candlesticks);
  
  // Reduce each group of candlesticks into a single candlestick
  return R.map((candlestickGroup) => {
    if (!candlestickGroup || candlestickGroup.length === 0) {
      throw new Error("Empty candlestick group found");
    }
    
    const reduced = reduceCandlesticks(candlestickGroup as R.NonEmptyArray<Candlestick>);
    
    // Get the bucket start time from the group key
    const bucketStart = DateTime.fromISO(candlestickGroup[0].closeAt.toISO());
    let bucketStartRounded: DateTime;
    
    switch (unit) {
      case 'm': {
        const minutes = Math.floor(bucketStart.minute / amount) * amount;
        bucketStartRounded = bucketStart.set({ minute: minutes, second: 0, millisecond: 0 });
        break;
      }
      case 'h': {
        const hours = Math.floor(bucketStart.hour / amount) * amount;
        bucketStartRounded = bucketStart.set({ hour: hours, minute: 0, second: 0, millisecond: 0 });
        break;
      }
      case 'd': {
        bucketStartRounded = bucketStart.set({ hour: 0, minute: 0, second: 0, millisecond: 0 });
        break;
      }
      default:
        throw new Error(`Unsupported unit: ${unit}`);
    }
    
    // Calculate bucket end time
    let bucketEnd: DateTime;
    switch (unit) {
      case 'm':
        bucketEnd = bucketStartRounded.plus({ minutes: amount });
        break;
      case 'h':
        bucketEnd = bucketStartRounded.plus({ hours: amount });
        break;
      case 'd':
        bucketEnd = bucketStartRounded.plus({ days: amount });
        break;
      default:
        throw new Error(`Unsupported unit: ${unit}`);
    }
    
    return {
      ...reduced,
      openAt: bucketStartRounded,
      closeAt: bucketEnd,
    };
  }, R.values(timeSlices));
}

console.log("Samples");
renderSmartCandlesticks(atomics);
const minuteSamples = sliceCandlesticksByGranularity(atomics, "1m");
console.log("One minute samples");
renderSmartCandlesticks(minuteSamples, "1m");
console.log("5 minute samples");
const fiveMinuteSamples = sliceCandlesticksByGranularity(minuteSamples, "5m");
renderSmartCandlesticks(fiveMinuteSamples, "5m");
console.log("1 hour samples");
const hourSamples = sliceCandlesticksByGranularity(fiveMinuteSamples, "1h");
renderSmartCandlesticks(hourSamples, "1h");
console.log("1 day samples");
const daySamples = sliceCandlesticksByGranularity(hourSamples, "1d");
renderSmartCandlesticks(daySamples, "1d");