export const SMALLEST_GRANULARITY = "atomicSamples";
export const LARGEST_GRANULARITY = "allSamples";

// "ish" implies second-level atomic granularity
export const minuteish = 60 / 2;
export const fiveMinuteish = Math.ceil(5 / 2);
export const hourish = Math.ceil(12 / 2);
