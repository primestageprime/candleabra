export const SMALLEST_GRANULARITY = "atomicSamples" as const;
export const LARGEST_GRANULARITY = "allSamples" as const;

// "ish" implies second-level atomic granularity
export const minuteish: number = 60/2;
export const fiveMinuteish: number = 5;
export const fifteenMinuteish: number = 15;
export const hourish: number = 4;
