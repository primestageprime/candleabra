import * as R from "npm:ramda@0.30.1";
import { assertEquals } from "jsr:@std/assert";
import { 
  processValueTwoFive,
} from "./candlestick.ts";
import type { Accumulator } from "./types.d.ts";
const values = [1,1,1,1,1, 1,1,9,9,1, 1,1,9,1,1, 1,1,1,1,1]

const nominal = {open: 1, close: 1, high: 1, low: 1, mean: 1}
const critical = {open: 9, close: 9, high: 9, low: 9, mean: 9}
const critical_new_2 = {open: 1, close: 9, high: 9, low: 1, mean: 5}
const critical_new_5 = {open: 1, close: 9, high: 9, low: 1, mean: 3}
const critical_new_all = {open: 1, close: 9, high: 9, low: 1, mean: 4.333333333333333}
const critical_new_all_2 = {open: 1, close: 9, high: 9, low: 1, mean: 6.111111111111111}
const resolved = {open: 9, close: 1, high: 9, low: 1, mean: 5}
const spike = {open: 1, close: 1, high: 9, low: 1, mean: 4}
const spike_all = {open: 1, close: 1, high: 9, low: 1, mean: 2.6666666666666665}
const spike_all_2 = {open: 1, close: 1, high: 1, low: 1, mean: 1}
const temporary_resolution_all = {open: 9, close: 9, high: 9, low: 1, mean: 3.6666666666666665}
const temporary_resolution_all_5 = {open: 9, close: 9, high: 9, low: 1, mean: 5.888888888888889}

// Helper functions
const getLatestAtomicSample = R.pipe(
  R.prop('atomicSamples'),
  R.last
)

const getLatestSamplesOf2 = R.pipe(
  R.prop('samplesOf2'),
  R.last
)

const getLatestSamplesOf5 = R.pipe(
  R.prop('samplesOf5'),
  R.last
)

const verifyLength = (length: number) => R.pipe(
  R.prop('length'),
  R.equals(length)
)

const verifyLatestAtomicSample = (expected: any) => R.pipe(
  getLatestAtomicSample,
  R.equals(expected)
)

const verifyLatestSamplesOf2 = (expected: any) => R.pipe(
  getLatestSamplesOf2,
  R.equals(expected)
)

const verifyLatestSamplesOf5 = (expected: any) => R.pipe(
  getLatestSamplesOf5,
  R.equals(expected)
)

const verifyAllSamples = (expected: any) => R.pipe(
  R.prop('allSamples'),
  R.equals(expected)
)

Deno.test("should process first value correctly", async (t) => {
  let accumulator: Accumulator | null = null
  await t.step("process first value", () => {
    accumulator = processValueTwoFive(accumulator, values[0]);
  });
  console.log(accumulator)
  await t.step("verify atomicSamples candlesticks", () => {
    assertEquals(verifyLength(1)(accumulator!.atomicSamples), true);
    assertEquals(verifyLatestAtomicSample(nominal)(accumulator), true);
  });
  
  await t.step("verify samplesOf2 candlesticks", () => {
    assertEquals(verifyLength(1)(accumulator!.samplesOf2), true);
    assertEquals(verifyLatestSamplesOf2(nominal)(accumulator), true);
  });

  await t.step("verify samplesOf5 candlesticks", () => {
    assertEquals(verifyLength(1)(accumulator!.samplesOf5), true, "incorrect length");
    assertEquals(verifyLatestSamplesOf5(nominal)(accumulator), true, "incorrect latest");
  });

  await t.step("verify allSamples candlesticks", () => {
    assertEquals(verifyLength(1)(accumulator!.allSamples), true, "incorrect length");
    assertEquals(verifyAllSamples([nominal])(accumulator!), true);
  });
}); 

Deno.test("should process second value correctly", async (t) => {
  let accumulator: Accumulator = {
    atomicSamples: [nominal],
    samplesOf2: [nominal],
    samplesOf5: [nominal],
    allSamples: [nominal]
  }

  await t.step("process second value", () => {
    accumulator = processValueTwoFive(accumulator, values[1]);
  });
  await t.step("verify one-sample candlesticks", () => {
    assertEquals(verifyLength(2)(accumulator.atomicSamples), true);
    assertEquals(verifyLatestAtomicSample(nominal)(accumulator), true);
  });

  await t.step("verify two-sample candlesticks", () => {
    assertEquals(verifyLength(2)(accumulator.samplesOf2), true, `twoSamples: ${JSON.stringify(accumulator.twoSamples)}`);
    assertEquals(verifyLatestSamplesOf2(nominal)(accumulator), true, `twoSamples: ${JSON.stringify(accumulator.twoSamples)}`);
  });

  await t.step("verify five-sample candlesticks", () => {
    assertEquals(verifyLength(1)(accumulator.samplesOf5), true);
    assertEquals(verifyLatestSamplesOf5(nominal)(accumulator), true);
  });
}); 

Deno.test("should process 7th value correctly", async (t) => {
  let accumulator: Accumulator = {
    atomicSamples: [nominal],
    samplesOf2: [nominal],
    samplesOf5: [nominal],
    allSamples: [nominal]
  } 

  await t.step("process 7th value", () => {
    accumulator = processValueTwoFive(accumulator, values[7]);
  });

  await t.step("verify one-sample candlesticks", () => {
    assertEquals(verifyLength(2)(accumulator.atomicSamples), true);
    assertEquals(verifyLatestAtomicSample(critical)(accumulator), true);
  });

  await t.step("verify two-sample candlesticks", () => {
    assertEquals(verifyLength(2)(accumulator.samplesOf2), true);
    assertEquals(verifyLatestSamplesOf2(critical_new_2)(accumulator), true);
  });

  await t.step("verify five-sample candlesticks", () => {
    assertEquals(verifyLength(1)(accumulator.samplesOf5), true);
    assertEquals(verifyLatestSamplesOf5(critical_new_5)(accumulator), true);
  });
  
  await t.step("verify all-time candlestick", () => {
    assertEquals(verifyAllSamples([critical_new_all])(accumulator), true);
  });
}); 

Deno.test("should process 8th value correctly", async (t) => {
  let accumulator: Accumulator = {
    atomicSamples: [nominal, critical],
    samplesOf2: [nominal, critical_new_2],
    samplesOf5: [nominal, critical_new_5],
    allSamples: [nominal, critical_new_all]
  } 

  await t.step("process 8th value", () => {
    accumulator = processValueTwoFive(accumulator, values[8]);
  });
  
  await t.step("verify one-sample candlesticks", () => {
    assertEquals(verifyLength(2)(accumulator.atomicSamples), true);
    assertEquals(verifyLatestAtomicSample(critical)(accumulator), true);
  });

  await t.step("verify two-sample candlesticks", () => {
    assertEquals(verifyLength(3)(accumulator.samplesOf2), true);
    assertEquals(verifyLatestSamplesOf2(critical)(accumulator), true);
  });

  await t.step("verify five-sample candlesticks", () => {
    assertEquals(verifyLength(1)(accumulator.samplesOf5), true);
    assertEquals(verifyLatestSamplesOf5(critical_new_2)(accumulator), true);
  });

  await t.step("verify all-time candlestick", () => {
    assertEquals(verifyAllSamples([critical_new_all_2])(accumulator), true);
  });
}); 

Deno.test("should process 9th value correctly", async (t) => {
  let accumulator: Accumulator = {
    atomicSamples: [nominal, critical, critical],
    samplesOf2: [nominal, nominal, critical],
    samplesOf5: [nominal, critical_new_5, critical_new_5],
    allSamples: [nominal, critical_new_5]
  } 

  await t.step("process 9th value", () => {
    accumulator = processValueTwoFive(accumulator, values[9]);
  });

  await t.step("verify one-sample candlesticks", () => {
    assertEquals(verifyLength(2)(accumulator.atomicSamples), true);
    assertEquals(verifyLatestAtomicSample(nominal)(accumulator), true);
  });
  
  await t.step("verify two-sample candlesticks", () => {
    assertEquals(verifyLength(4)(accumulator.samplesOf2), true);
    assertEquals(verifyLatestSamplesOf2(resolved)(accumulator), true);
  });

  await t.step("verify five-sample candlesticks", () => {
    assertEquals(verifyLength(1)(accumulator.samplesOf5), true);
    assertEquals(verifyLatestSamplesOf5(spike)(accumulator), true);
  });

  await t.step("verify all-time candlestick", () => {
    assertEquals(verifyAllSamples([spike_all])(accumulator), true);
  });
}); 

Deno.test("should process 12th value correctly", async (t) => {
  let accumulator: Accumulator = {
    atomicSamples: [critical, nominal, nominal, nominal],
    samplesOf2: [resolved, nominal],
    samplesOf5: [nominal,resolved],
    allSamples: [nominal, resolved]
  }

  await t.step("process 12th value", () => {
    accumulator = processValueTwoFive(accumulator, values[12]);
  });

  await t.step("verify one-sample candlesticks", () => {
    assertEquals(verifyLength(2)(accumulator.atomicSamples), true);
    assertEquals(verifyLatestAtomicSample(critical)(accumulator), true);
  });

  await t.step("verify two-sample candlesticks", () => {
    assertEquals(verifyLength(3)(accumulator.samplesOf2), true);
    assertEquals(verifyLatestSamplesOf2(critical_new_2)(accumulator), true);
  });

  await t.step("verify five-sample candlesticks", () => {
    assertEquals(verifyLength(1)(accumulator.samplesOf5), true);
    assertEquals(verifyLatestSamplesOf5(temporary_resolution_all)(accumulator), true);
  });
  
  await t.step("verify all-time candlestick", () => {
    assertEquals(verifyAllSamples([temporary_resolution_all_5])(accumulator), true);
  });
});

Deno.test("should process 18th value correctly", async (t) => {
  let accumulator: Accumulator = {
    atomicSamples: [nominal, nominal, nominal, nominal],
    samplesOf2: [nominal, nominal],
    samplesOf5: [spike, nominal],
    allSamples: [spike, nominal]
  }

  await t.step("process 18th value", () => {
    accumulator = processValueTwoFive(accumulator, values[18]);
  });

  await t.step("verify one-sample candlesticks", () => {
    assertEquals(verifyLength(2)(accumulator.atomicSamples), true);
    assertEquals(verifyLatestAtomicSample(nominal)(accumulator), true);
  });
  
  await t.step("verify two-sample candlesticks", () => {
    assertEquals(verifyLength(3)(accumulator.samplesOf2), true);
    assertEquals(verifyLatestSamplesOf2(nominal)(accumulator), true);
  });

  await t.step("verify five-sample candlesticks", () => {
    assertEquals(verifyLength(1)(accumulator.samplesOf5), true);
    assertEquals(verifyLatestSamplesOf5(nominal)(accumulator), true);
  });

  await t.step("verify all-time candlestick", () => {
    assertEquals(verifyAllSamples([spike_all_2])(accumulator), true);
  });
});

