import * as R from "npm:ramda@0.30.1";
import { assertEquals } from "jsr:@std/assert";
import { 
  processValueTwoFive,
} from "./candlestick.ts";
import type { Accumulator } from "./types.d.ts";
const values = [1,1,1,1,1, 1,1,9,9,1, 1,1,9,1,1, 1,1,1,1,1]

const nominal = {open: 1, close: 1, high: 1, low: 1}
const critical = {open: 9, close: 9, high: 9, low: 9}
const critical_new = {open: 1, close: 9, high: 9, low: 1}
const resolved = {open: 9, close: 1, high: 9, low: 1}
const spike = {open: 1, close: 1, high: 9, low: 1}
const temporary_resolution = {open: 9, close: 9, high: 9, low: 1}

// Helper functions
const getLatestOneSample = R.pipe(
  R.prop('oneSample'),
  R.last
)

const getLatestTwoSample = R.pipe(
  R.prop('twoSamples'),
  R.last
)

const getLatestFiveSample = R.pipe(
  R.prop('fiveSamples'),
  R.last
)

const verifyLength = (length: number) => R.pipe(
  R.prop('length'),
  R.equals(length)
)

const verifyLatestOneSample = (expected: any) => R.pipe(
  getLatestOneSample,
  R.equals(expected)
)

const verifyLatestTwoSample = (expected: any) => R.pipe(
  getLatestTwoSample,
  R.equals(expected)
)

const verifyLatestFiveSample = (expected: any) => R.pipe(
  getLatestFiveSample,
  R.equals(expected)
)

const verifyAllTime = (expected: any) => R.pipe(
  R.prop('allTime'),
  R.equals(expected)
)

Deno.test("should process first value correctly", async (t) => {
  let accumulator: Accumulator | null = null
  
  await t.step("process first value", () => {
    accumulator = processValueTwoFive(accumulator, values[0]);
  });
  
  await t.step("verify one-sample candlesticks", () => {
    assertEquals(verifyLength(1)(accumulator!.oneSample), true);
    assertEquals(verifyLatestOneSample(nominal)(accumulator), true);
  });
  
  await t.step("verify two-sample candlesticks", () => {
    assertEquals(verifyLength(1)(accumulator!.twoSamples), true);
    assertEquals(verifyLatestTwoSample(nominal)(accumulator), true);
  });

  await t.step("verify five-sample candlesticks", () => {
    assertEquals(verifyLength(1)(accumulator!.fiveSamples), true);
    assertEquals(verifyLatestFiveSample(nominal)(accumulator), true);
  });

  await t.step("verify all-time candlestick", () => {
    assertEquals(verifyAllTime(nominal)(accumulator!), true);
  });
}); 

Deno.test("should process second value correctly", async (t) => {
  let accumulator: Accumulator = {
    oneSample: [nominal],
    twoSamples: [nominal],
    fiveSamples: [nominal],
    allTime: nominal
  }

  await t.step("process second value", () => {
    accumulator = processValueTwoFive(accumulator, values[1]);
  });
  
  await t.step("verify one-sample candlesticks", () => {
    assertEquals(verifyLength(2)(accumulator.oneSample), true);
    assertEquals(verifyLatestOneSample(nominal)(accumulator), true);
  });

  await t.step("verify two-sample candlesticks", () => {
    assertEquals(verifyLength(2)(accumulator.twoSamples), true, `twoSamples: ${JSON.stringify(accumulator.twoSamples)}`);
    assertEquals(verifyLatestTwoSample(nominal)(accumulator), true, `twoSamples: ${JSON.stringify(accumulator.twoSamples)}`);
  });

  await t.step("verify five-sample candlesticks", () => {
    assertEquals(verifyLength(2)(accumulator.fiveSamples), true);
    assertEquals(verifyLatestFiveSample(nominal)(accumulator), true);
  });
}); 

Deno.test("should process 7th value correctly", async (t) => {
  let accumulator: Accumulator = {
    oneSample: [nominal],
    twoSamples: [nominal],
    fiveSamples: [nominal],
    allTime: nominal
  } 

  await t.step("process 7th value", () => {
    accumulator = processValueTwoFive(accumulator, values[7]);
  });
  
  await t.step("verify one-sample candlesticks", () => {
    assertEquals(verifyLength(2)(accumulator.oneSample), true);
    assertEquals(verifyLatestOneSample(critical)(accumulator), true);
  });

  await t.step("verify two-sample candlesticks", () => {
    assertEquals(verifyLength(2)(accumulator.twoSamples), true);
    assertEquals(verifyLatestTwoSample(critical_new)(accumulator), true);
  });

  await t.step("verify five-sample candlesticks", () => {
    assertEquals(verifyLength(2)(accumulator.fiveSamples), true);
    assertEquals(verifyLatestFiveSample(critical_new)(accumulator), true);
  });
  
  await t.step("verify all-time candlestick", () => {
    assertEquals(verifyAllTime(critical_new)(accumulator), true);
  });
}); 

Deno.test("should process 8th value correctly", async (t) => {
  let accumulator: Accumulator = {
    oneSample: [nominal, critical],
    twoSamples: [nominal, critical_new],
    fiveSamples: [nominal, critical_new],
    allTime: critical_new
  } 

  await t.step("process 8th value", () => {
    accumulator = processValueTwoFive(accumulator, values[8]);
  });
  
  await t.step("verify one-sample candlesticks", () => {
    assertEquals(verifyLength(3)(accumulator.oneSample), true);
    assertEquals(verifyLatestOneSample(critical)(accumulator), true);
  });

  await t.step("verify two-sample candlesticks", () => {
    assertEquals(verifyLength(3)(accumulator.twoSamples), true);
    assertEquals(verifyLatestTwoSample(critical)(accumulator), true);
  });

  await t.step("verify five-sample candlesticks", () => {
    assertEquals(verifyLength(3)(accumulator.fiveSamples), true);
    assertEquals(verifyLatestFiveSample(critical_new)(accumulator), true);
  });

  await t.step("verify all-time candlestick", () => {
    assertEquals(verifyAllTime(critical_new)(accumulator), true);
  });
}); 

Deno.test("should process 9th value correctly", async (t) => {
  let accumulator: Accumulator = {
    oneSample: [nominal, critical, critical],
    twoSamples: [nominal, nominal, critical],
    fiveSamples: [nominal, critical_new, critical_new],
    allTime: critical_new
  } 

  await t.step("process 9th value", () => {
    accumulator = processValueTwoFive(accumulator, values[9]);
  });

  await t.step("verify one-sample candlesticks", () => {
    assertEquals(verifyLength(4)(accumulator.oneSample), true);
    assertEquals(verifyLatestOneSample(nominal)(accumulator), true);
  });
  
  await t.step("verify two-sample candlesticks", () => {
    assertEquals(verifyLength(4)(accumulator.twoSamples), true);
    assertEquals(verifyLatestTwoSample(resolved)(accumulator), true);
  });

  await t.step("verify five-sample candlesticks", () => {
    assertEquals(verifyLength(4)(accumulator.fiveSamples), true);
    assertEquals(verifyLatestFiveSample(spike)(accumulator), true);
  });

  await t.step("verify all-time candlestick", () => {
    assertEquals(verifyAllTime(spike)(accumulator), true);
  });
}); 

Deno.test("should process 12th value correctly", async (t) => {
  let accumulator: Accumulator = {
    oneSample: [critical, nominal, nominal, nominal],
    twoSamples: [resolved, nominal],
    fiveSamples: [nominal,resolved],
    allTime: spike
  }

  await t.step("process 12th value", () => {
    accumulator = processValueTwoFive(accumulator, values[12]);
  });

  await t.step("verify one-sample candlesticks", () => {
    assertEquals(verifyLength(5)(accumulator.oneSample), true);
    assertEquals(verifyLatestOneSample(critical)(accumulator), true);
  });

  await t.step("verify two-sample candlesticks", () => {
    assertEquals(verifyLength(3)(accumulator.twoSamples), true);
    assertEquals(verifyLatestTwoSample(critical_new)(accumulator), true);
  });

  await t.step("verify five-sample candlesticks", () => {
    assertEquals(verifyLength(3)(accumulator.fiveSamples), true);
    assertEquals(verifyLatestFiveSample(temporary_resolution)(accumulator), true);
  });
  
  await t.step("verify all-time candlestick", () => {
    assertEquals(verifyAllTime(critical_new)(accumulator), true);
  });
});

Deno.test("should process 18th value correctly", async (t) => {
  let accumulator: Accumulator = {
    oneSample: [nominal, nominal, nominal, nominal],
    twoSamples: [nominal, nominal],
    fiveSamples: [spike, nominal],
    allTime: spike
  }

  await t.step("process 18th value", () => {
    accumulator = processValueTwoFive(accumulator, values[18]);
  });

  await t.step("verify one-sample candlesticks", () => {
    assertEquals(verifyLength(5)(accumulator.oneSample), true);
    assertEquals(verifyLatestOneSample(nominal)(accumulator), true);
  });
  
  await t.step("verify two-sample candlesticks", () => {
    assertEquals(verifyLength(3)(accumulator.twoSamples), true);
    assertEquals(verifyLatestTwoSample(nominal)(accumulator), true);
  });

  await t.step("verify five-sample candlesticks", () => {
    assertEquals(verifyLength(3)(accumulator.fiveSamples), true);
    assertEquals(verifyLatestFiveSample(nominal)(accumulator), true);
  });

  await t.step("verify all-time candlestick", () => {
    assertEquals(verifyAllTime(spike)(accumulator), true);
  });
});