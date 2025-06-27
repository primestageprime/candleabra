import { toCandlestick, reduceCandlesticks, toSample } from "./candlestick.ts";
import { DateTime, Duration } from "luxon";
import { renderSmartCandlesticks } from "./renderCandlesticks.ts";
import * as R from "ramda";
import type { Candlestick, Sample } from "./types.d.ts";

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
  // [1, 180],
  // [5, 181],
  // [3, 210],
  // [1, 240],
  // [5, 241],
  // [3, 270],
  // [1, 300],
  // [5, 301],
  // [3, 330],
  // [1, 360],
  // [5, 361],
  // [3, 390],
  // [1, 420],
  // [5, 421],
  // [20, 2000],
  // [10, 2001],
  // [20, 2002],
  // [10, 2003],
  // [20, 2004],
  // [10, 2005],
  // [20, 2006],
  // [6, 60 * 60 * 5],
  // [10, 60 * 60 * 7],
  // [20, 60 * 60 * 8],
  // [10, 60 * 60 * 9],
  // [20, 60 * 60 * 10],
  // [10, 60 * 60 * 11],
  // [20, 60 * 60 * 12],
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

// Time-weighted mean calculation
function calculateTimeWeightedMean(candlesticks: Candlestick[]): number {
  if (candlesticks.length === 1) {
    return candlesticks[0].mean;
  }
  
  let totalWeightedValue = 0;
  let totalDuration = 0;
  
  for (let i = 0; i < candlesticks.length; i++) {
    const candlestick = candlesticks[i];
    const duration = candlestick.closeAt.diff(candlestick.openAt, "milliseconds").as("milliseconds");
    totalWeightedValue += candlestick.mean * duration;
    totalDuration += duration;
  }
  
  return totalDuration > 0 ? totalWeightedValue / totalDuration : 0;
}

// Streaming multi-tier candlestick processor
class MultiTierProcessor {
  private tiers: Array<{
    duration: Duration;
    current: Candlestick | null;
    history: Candlestick[];
    name: string;
  }>;
  private atomicSamples: Sample[] = [];
  
  constructor(granularities: string[]) {
    this.tiers = granularities.map(granularity => {
      const match = granularity.match(/^(\d+)([mhd])$/);
      if (!match) {
        throw new Error(`Invalid granularity: ${granularity}`);
      }
      const [, amountStr, unit] = match;
      const amount = parseInt(amountStr, 10);
      
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
        duration,
        current: null,
        history: [],
        name: granularity,
      };
    });
  }
  
  processSample(sample: Sample): { atomics: Sample[], tierResults: Candlestick[] } {
    // Add to atomic samples
    this.atomicSamples.push(sample);
    
    // Keep only enough atomic samples to generate one 1-minute candlestick
    if (this.tiers.length > 0) {
      const oneMinuteDuration = Duration.fromObject({ minutes: 1 });
      const cutoffTime = sample.dateTime.minus(oneMinuteDuration);
      this.atomicSamples = this.atomicSamples.filter(s => s.dateTime >= cutoffTime);
    }
    
    const tierResults: Candlestick[] = [];
    
    // Process each tier
    for (let i = 0; i < this.tiers.length; i++) {
      const tier = this.tiers[i];
      const sampleCandlestick = toCandlestick(sample);
      
      if (!tier.current) {
        // First sample for this tier - create proper bucket boundaries
        const bucketStart = this.getBucketStart(sample.dateTime, tier.duration);
        const bucketEnd = bucketStart.plus(tier.duration);
        
        tier.current = {
          ...sampleCandlestick,
          openAt: bucketStart,
          closeAt: bucketEnd,
        };
        tierResults.push(tier.current);
        continue;
      }
      
      // Check if this sample starts a new bucket
      const bucketStart = this.getBucketStart(sample.dateTime, tier.duration);
      const currentBucketStart = this.getBucketStart(tier.current.openAt, tier.duration);
      
      if (bucketStart.equals(currentBucketStart)) {
        // Same bucket - update current candlestick
        tier.current = {
          open: tier.current.open,
          close: sampleCandlestick.close,
          high: Math.max(tier.current.high, sampleCandlestick.high),
          low: Math.min(tier.current.low, sampleCandlestick.low),
          mean: this.calculateTimeWeightedMeanForBucket(tier.current, sampleCandlestick),
          openAt: tier.current.openAt,
          closeAt: tier.current.closeAt, // Keep the bucket end time
        };
      } else {
        // New bucket - historize current and start new
        tier.history.push(tier.current);
        
        // Prune old history that's no longer needed for higher tiers
        this.pruneHistory(i);
        
        // Create new bucket with proper boundaries
        const bucketEnd = bucketStart.plus(tier.duration);
        tier.current = {
          ...sampleCandlestick,
          openAt: bucketStart,
          closeAt: bucketEnd,
        };
      }
      
      tierResults.push(tier.current);
    }
    
    return {
      atomics: [...this.atomicSamples],
      tierResults
    };
  }
  
  private getBucketStart(dateTime: DateTime, duration: Duration): DateTime {
    const durationMillis = duration.as("milliseconds");
    const dateTimeMillis = dateTime.toMillis();
    const bucketStartMillis = Math.floor(dateTimeMillis / durationMillis) * durationMillis;
    return DateTime.fromMillis(bucketStartMillis);
  }
  
  private calculateTimeWeightedMeanForBucket(existing: Candlestick, newSample: Candlestick): number {
    // For time-weighted mean, we need to consider the actual time each sample represents
    // Since we're in the same bucket, we can use a simple average for now
    // A more sophisticated approach would track individual sample durations
    return (existing.mean + newSample.mean) / 2;
  }
  
  private pruneHistory(tierIndex: number): void {
    if (tierIndex === this.tiers.length - 1) return; // No higher tier to consider
    
    const currentTier = this.tiers[tierIndex];
    const higherTier = this.tiers[tierIndex + 1];
    
    if (!higherTier.current) return;
    
    // Keep only history needed for the higher tier's current bucket
    const higherTierBucketStart = this.getBucketStart(higherTier.current.openAt, higherTier.duration);
    const cutoffTime = higherTierBucketStart.minus(higherTier.duration);
    
    currentTier.history = currentTier.history.filter(
      candlestick => candlestick.closeAt >= cutoffTime
    );
  }
  
  getResults(): Array<{ name: string; candlesticks: Candlestick[] }> {
    return this.tiers.map(tier => ({
      name: tier.name,
      candlesticks: [...tier.history, ...(tier.current ? [tier.current] : [])],
    }));
  }
  
  getAtomics(): Sample[] {
    return [...this.atomicSamples];
  }
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

// Test the new streaming approach
console.log("=== Streaming Multi-Tier Processing ===");
const processor = new MultiTierProcessor(["1m", "5m", "1h", "1d"]);

// Process samples one by one and show each iteration
for (let i = 0; i < atomics.length; i++) {
  const [value, offset] = [atomics[i].open, atomics[i].openAt.diff(baseTime, "seconds").as("seconds")];
  const sample = toSample(value, baseTime.plus({ seconds: offset }));
  
  console.log(`\n--- Iteration ${i + 1}: Sample ${value} at ${sample.dateTime.toFormat("HH:mm:ss")} ---`);
  
  const results = processor.processSample(sample);
  
  // Display atomic samples
  console.log("Atomic samples:");
  const atomicCandlesticks = results.atomics.map(sample => toCandlestick(sample));
  renderSmartCandlesticks(atomicCandlesticks, "1s");
  
  // Display current state of each tier
  const currentResults = processor.getResults();
  currentResults.forEach(({ name, candlesticks }) => {
    if (candlesticks.length > 0) {
      console.log(`${name} samples:`);
      renderSmartCandlesticks(candlesticks, name);
    }
  });
  
  console.log("=".repeat(80));
}