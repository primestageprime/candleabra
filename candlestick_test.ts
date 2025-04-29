import * as R from "npm:ramda@0.30.1";
import { assertEquals } from "jsr:@std/assert";
import { 
  createEmptyAccumulator, 
  processValue,
} from "./candlestick.ts";

const values = [1,1,1,1,1, 1,1,9,9,1, 1,1,9,1,1, 1,1,1,1,1]

const nominal = {open: 1, close: 1, high: 1, low: 1}
const critical = {open: 9, close: 9, high: 9, low: 9}
const critical_new = {open: 1, close: 9, high: 9, low: 1}
const resolved = {open: 9, close: 1, high: 9, low: 1}
const spike = {open: 1, close: 1, high: 9, low: 1}
const temporary_resolution = {open: 9, close: 9, high: 9, low: 1}

const getLatestOneSample = R.pipe(
  R.prop('oneSample'),
  R.last
)

Deno.test("should process first value correctly", async (t) => {
  let accumulator = createEmptyAccumulator();
  
  await t.step("process first value", () => {
    accumulator = processValue(accumulator, values[0]);
  });
  
  await t.step("verify one-sample candlesticks", () => {
    assertEquals(accumulator.oneSample.length, 1);
    assertEquals(getLatestOneSample(accumulator), nominal);
  });
  
  await t.step("verify two-sample candlesticks", () => {
    assertEquals(accumulator.twoSamples.length, 1);
    assertEquals(accumulator.twoSamples[0], nominal);
  });

  await t.step("verify five-sample candlesticks", () => {
    assertEquals(accumulator.fiveSamples.length, 1);
    assertEquals(accumulator.fiveSamples[0], nominal);
  });

  await t.step("verify all-time candlestick", () => {
    assertEquals(accumulator.allTime, nominal);
  });
}); 

Deno.test("should process second value correctly", async (t) => {
  let accumulator = {
    oneSample: [nominal],
    twoSamples: [nominal],
    fiveSamples: [nominal],
    allTime: nominal
  }

  await t.step("process second value", () => {
    accumulator = processValue(accumulator, values[1]);
  });
  
  await t.step("verify one-sample candlesticks", () => {
    assertEquals(accumulator.oneSample.length, 2);
    assertEquals(getLatestOneSample(accumulator), nominal);
  });

  await t.step("verify two-sample candlesticks", () => {
    assertEquals(accumulator.twoSamples.length, 2);
    assertEquals(accumulator.twoSamples[1], nominal);
  });

  await t.step("verify five-sample candlesticks", () => {
    assertEquals(accumulator.fiveSamples.length, 2);
    assertEquals(accumulator.fiveSamples[1], nominal);
  });
}); 

Deno.test("should process 7th value correctly", async (t) => {
  let accumulator = {
    oneSample: [nominal],
    twoSamples: [nominal],
    fiveSamples: [nominal],
    allTime: nominal
  } 

  await t.step("process 7th value", () => {
    accumulator = processValue(accumulator, values[7]);
  });
  
  await t.step("verify one-sample candlesticks", () => {
    assertEquals(accumulator.oneSample.length, 2);
    assertEquals(getLatestOneSample(accumulator), critical);
  });

  await t.step("verify two-sample candlesticks", () => {
    assertEquals(accumulator.twoSamples.length, 2);
    assertEquals(accumulator.twoSamples[1], critical_new);
  });

  await t.step("verify five-sample candlesticks", () => {
    assertEquals(accumulator.fiveSamples.length, 2);
    assertEquals(accumulator.fiveSamples[1], critical_new);
  });
  
  await t.step("verify all-time candlestick", () => {
    assertEquals(accumulator.allTime, critical_new);
  });
}); 

Deno.test("should process 8th value correctly", async (t) => {
  let accumulator = {
    oneSample: [nominal, critical],
    twoSamples: [nominal, critical_new],
    fiveSamples: [nominal, critical_new],
    allTime: critical_new
  } 

  await t.step("process 8th value", () => {
    accumulator = processValue(accumulator, values[8]);
  });
  
  await t.step("verify one-sample candlesticks", () => {
    assertEquals(accumulator.oneSample.length, 3);
    assertEquals(accumulator.oneSample[2], critical);
  });

  await t.step("verify two-sample candlesticks", () => {
    assertEquals(accumulator.twoSamples.length, 3);
    assertEquals(accumulator.twoSamples[2], critical);
  });

  await t.step("verify five-sample candlesticks", () => {
    assertEquals(accumulator.fiveSamples.length, 3);
    assertEquals(accumulator.fiveSamples[2], critical_new);
  });

  await t.step("verify all-time candlestick", () => {
    assertEquals(accumulator.allTime, critical_new);
  });
}); 

Deno.test("should process 9th value correctly", async (t) => {
  let accumulator = {
    oneSample: [nominal, critical, critical],
    twoSamples: [nominal, nominal, critical],
    fiveSamples: [nominal, critical_new, critical_new],
    allTime: critical_new
  } 

  await t.step("process 9th value", () => {
    accumulator = processValue(accumulator, values[9]);
  });

  await t.step("verify one-sample candlesticks", () => {
    assertEquals(accumulator.oneSample.length, 4);
    assertEquals(accumulator.oneSample[3], nominal);
  });
  
  await t.step("verify two-sample candlesticks", () => {
    assertEquals(accumulator.twoSamples.length, 4);
    assertEquals(accumulator.twoSamples[3], resolved);
  });

  await t.step("verify five-sample candlesticks", () => {
    assertEquals(accumulator.fiveSamples.length, 4);
    assertEquals(accumulator.fiveSamples[3], spike);
  });

  await t.step("verify all-time candlestick", () => {
    assertEquals(accumulator.allTime, spike);
  });
}); 

Deno.test("should process 12th value correctly", async (t) => {
  let accumulator = {
    oneSample: [critical, nominal, nominal, nominal],
    twoSamples: [resolved, nominal],
    fiveSamples: [nominal,resolved],
    allTime: spike
  }

  await t.step("process 12th value", () => {
    accumulator = processValue(accumulator, values[12]);
  });

  await t.step("verify one-sample candlesticks", () => {
    assertEquals(accumulator.oneSample.length, 5);
    assertEquals(accumulator.oneSample[4], critical);
  });

  await t.step("verify two-sample candlesticks", () => {
    assertEquals(accumulator.twoSamples.length, 3);
    assertEquals(accumulator.twoSamples[2], critical_new);
  });

  await t.step("verify five-sample candlesticks", () => {
    assertEquals(accumulator.fiveSamples.length, 3);
    assertEquals(accumulator.fiveSamples[2], temporary_resolution);
  });
  
  await t.step("verify all-time candlestick", () => {
    assertEquals(accumulator.allTime, critical_new);
  });
});

Deno.test("should process 18th value correctly", async (t) => {
  let accumulator = {
    oneSample: [nominal, nominal, nominal, nominal],
    twoSamples: [nominal, nominal],
    fiveSamples: [spike, nominal],
    allTime: spike
  }

  await t.step("process 18th value", () => {
    accumulator = processValue(accumulator, values[18]);
  });

  await t.step("verify one-sample candlesticks", () => {
    assertEquals(accumulator.oneSample.length, 5);
    assertEquals(accumulator.oneSample[4], nominal);
  });
  
  await t.step("verify two-sample candlesticks", () => {
    assertEquals(accumulator.twoSamples.length, 3);
    assertEquals(accumulator.twoSamples[2], nominal);
  });

  await t.step("verify five-sample candlesticks", () => {
    assertEquals(accumulator.fiveSamples.length, 3);
    assertEquals(accumulator.fiveSamples[2], nominal);
  });

  await t.step("verify all-time candlestick", () => {
    assertEquals(accumulator.allTime, spike);
  });
});