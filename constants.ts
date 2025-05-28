export const SMALLEST_GRANULARITY = "atomicSamples" as const;
export const LARGEST_GRANULARITY = "allSamples" as const;

// "ish" implies second-level atomic granularity
export const minuteish: number = Math.ceil(30 / 2);
export const fiveMinuteish: number = Math.ceil(5 / 2);
export const hourish: number = Math.ceil(12 / 2);
