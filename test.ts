import { assertEquals } from "https://deno.land/std@0.220.1/assert/mod.ts";
import { DateTime } from "luxon";
import {
  createProcessor,
  getResults,
  parseGranularity,
  processSample,
  toSample,
} from "./index.ts";

Deno.test("Refactored API - Basic Processing", async (t) => {
  await t.step("should create processor with tiers", () => {
    const processor = createProcessor(["1m", "5m", "1h"]);
    assertEquals(processor.tiers.length, 3);
    assertEquals(processor.tiers[0].granularity.name, "1m");
    assertEquals(processor.tiers[1].granularity.name, "5m");
    assertEquals(processor.tiers[2].granularity.name, "1h");
  });

  await t.step("should process single sample", () => {
    const processor = createProcessor(["1m"]);
    const sample = toSample(100, DateTime.fromISO("2025-01-01T10:00:00Z"));
    const result = processSample(processor, sample);

    assertEquals(result.atomics.length, 1);
    assertEquals(result.atomics[0].value, 100);
    assertEquals(result.tierResults.length, 1);
    assertEquals(result.tierResults[0].open, 100);
    assertEquals(result.tierResults[0].close, 100);
  });

  await t.step("should parse granularity correctly", () => {
    const granularity = parseGranularity("5m");
    assertEquals(granularity.name, "5m");
    assertEquals(granularity.duration.as("minutes"), 5);
  });

  await t.step("should get results correctly", () => {
    const processor = createProcessor(["1m"]);
    const sample = toSample(100, DateTime.fromISO("2025-01-01T10:00:00Z"));
    const result = processSample(processor, sample);
    const results = getResults(result.updatedState);

    assertEquals(results.length, 1);
    assertEquals(results[0].name, "1m");
    assertEquals(results[0].candlesticks.length, 1);
    assertEquals(results[0].candlesticks[0].open, 100);
  });
});

Deno.test("Processor - Tier boundary and history/pruning edge cases", async (t) => {
  await t.step(
    "should add new 1m candlestick to history when crossing minute boundary",
    () => {
      const processor = createProcessor(["1m"]);
      const t0 = DateTime.fromISO("2025-01-01T10:00:00Z");
      const t1 = t0.plus({ seconds: 30 });
      const t2 = t0.plus({ minutes: 1 }); // new minute
      let state = processor;
      state = processSample(state, toSample(1, t0)).updatedState;
      state = processSample(state, toSample(2, t1)).updatedState;
      // Should still be in the same 1m bucket
      assertEquals(state.tiers[0].history.length, 0);
      state = processSample(state, toSample(3, t2)).updatedState;
      // Should have finalized the first 1m candlestick
      assertEquals(state.tiers[0].history.length, 1);
      assertEquals(state.tiers[0].history[0].open, 1);
      assertEquals(state.tiers[0].history[0].close, 2);
      // Current candlestick is for the new minute
      assertEquals(state.tiers[0].current?.open, 3);
    },
  );

  await t.step(
    "should add new 5m candlestick to history when crossing 5m boundary",
    () => {
      const processor = createProcessor(["1m", "5m"]);
      const t0 = DateTime.fromISO("2025-01-01T10:00:00Z");
      let state = processor;
      // Add 6 samples, one per minute, to cross a 5m boundary
      for (let i = 0; i < 6; i++) {
        state = processSample(state, toSample(i + 1, t0.plus({ minutes: i })))
          .updatedState;
      }
      // 1m tier should have 1 in history (pruned after 5m finalized), 1 current
      assertEquals(state.tiers[0].history.length, 1);
      // 5m tier should have 1 in history (first 5m), 1 current (6th sample starts new 5m)
      assertEquals(state.tiers[1].history.length, 1);
      assertEquals(state.tiers[1].history[0].open, 1);
      assertEquals(state.tiers[1].history[0].close, 5);
      assertEquals(state.tiers[1].current?.open, 6);
    },
  );

  await t.step("should prune 1m history after 5m history is finalized", () => {
    const processor = createProcessor(["1m", "5m"]);
    const t0 = DateTime.fromISO("2025-01-01T10:00:00Z");
    let state = processor;
    // Add 10 samples, one per minute, to create 2 finalized 5m candlesticks
    for (let i = 0; i < 10; i++) {
      state = processSample(state, toSample(i + 1, t0.plus({ minutes: i })))
        .updatedState;
    }
    // 1m tier should be pruned to only those 1m candlesticks that are >= the closeAt of the last 5m history
    const last5mClose =
      state.tiers[1].history[state.tiers[1].history.length - 1].closeAt;
    const pruned1m = state.tiers[0].history.filter((c) =>
      c.closeAt >= last5mClose
    );
    assertEquals(state.tiers[0].history, pruned1m);
  });

  await t.step("should handle custom tier configuration (1m, 15m, 1h)", () => {
    const processor = createProcessor(["1m", "15m", "1h"]);
    const t0 = DateTime.fromISO("2025-01-01T00:00:00Z");
    let state = processor;
    // Add 16 samples, one per minute, to cross a 15m boundary
    for (let i = 0; i < 16; i++) {
      state = processSample(state, toSample(i + 1, t0.plus({ minutes: i })))
        .updatedState;
    }
    // 1m tier: 1 in history (pruned after 15m finalized), 1 current
    assertEquals(state.tiers[0].history.length, 1);
    // 15m tier: 1 in history, 1 current
    assertEquals(state.tiers[1].history.length, 1);
    assertEquals(state.tiers[1].history[0].open, 1);
    assertEquals(state.tiers[1].history[0].close, 15);
    assertEquals(state.tiers[1].current?.open, 16);
    // 1h tier: no finalized history yet
    assertEquals(state.tiers[2].history.length, 0);
  });
});

Deno.test("Atomic Sample Pruning", async (t) => {
  await t.step("should not prune atomic samples when no history exists", () => {
    const processor = createProcessor(["1m", "5m"]);
    const t0 = DateTime.fromISO("2025-01-01T10:00:00Z");
    let state = processor;

    // Add samples within the same 1m bucket
    state = processSample(state, toSample(1, t0)).updatedState;
    state =
      processSample(state, toSample(2, t0.plus({ seconds: 30 }))).updatedState;

    // Should have 2 atomic samples since no history exists yet
    assertEquals(state.atomicSamples.length, 2);
    assertEquals(state.atomicSamples[0].value, 1);
    assertEquals(state.atomicSamples[1].value, 2);
  });

  await t.step("should prune atomic samples after bucket finalization", () => {
    const processor = createProcessor(["1m", "5m"]);
    const t0 = DateTime.fromISO("2025-01-01T10:00:00Z");
    let state = processor;

    // Add samples to complete a 1m bucket
    state = processSample(state, toSample(1, t0)).updatedState;
    state =
      processSample(state, toSample(2, t0.plus({ seconds: 30 }))).updatedState;
    state =
      processSample(state, toSample(3, t0.plus({ minutes: 1 }))).updatedState; // Crosses 1m boundary

    // After crossing 1m boundary, should still have 3 atomic samples (no pruning yet)
    assertEquals(state.atomicSamples.length, 3);

    // Add another sample to trigger pruning
    state =
      processSample(state, toSample(4, t0.plus({ minutes: 2 }))).updatedState;

    // Now should have pruned atomic samples (typically 2 samples)
    assertEquals(state.atomicSamples.length, 2);
    assertEquals(state.atomicSamples[0].value, 3);
    assertEquals(state.atomicSamples[1].value, 4);
  });

  await t.step("should keep atomic samples bounded", () => {
    const processor = createProcessor(["1m", "5m"]);
    const t0 = DateTime.fromISO("2025-01-01T10:00:00Z");
    let state = processor;

    // Add many samples to see if atomic samples grow unbounded
    for (let i = 0; i < 20; i++) {
      const time = t0.plus({ minutes: i });
      state = processSample(state, toSample(i + 1, time)).updatedState;
    }

    // Atomic samples should be bounded (not growing unbounded)
    assertEquals(state.atomicSamples.length <= 5, true);

    // Should have some history entries
    assertEquals(state.tiers[0].history.length > 0, true);
  });

  await t.step("should handle edge case with no tiers", () => {
    const processor = createProcessor([]);
    const t0 = DateTime.fromISO("2025-01-01T10:00:00Z");
    let state = processor;

    // Should not prune when no tiers exist
    state = processSample(state, toSample(1, t0)).updatedState;
    state =
      processSample(state, toSample(2, t0.plus({ seconds: 30 }))).updatedState;

    assertEquals(state.atomicSamples.length, 2);
    assertEquals(state.atomicSamples[0].value, 1);
    assertEquals(state.atomicSamples[1].value, 2);
  });

  await t.step("should maintain chronological order after pruning", () => {
    const processor = createProcessor(["1m"]);
    const t0 = DateTime.fromISO("2025-01-01T10:00:00Z");
    let state = processor;

    // Add samples across multiple minutes
    const samples = [
      { value: 1, time: t0 },
      { value: 2, time: t0.plus({ seconds: 30 }) },
      { value: 3, time: t0.plus({ minutes: 1 }) },
      { value: 4, time: t0.plus({ minutes: 1, seconds: 30 }) },
      { value: 5, time: t0.plus({ minutes: 2 }) },
    ];

    samples.forEach((sample) => {
      state =
        processSample(state, toSample(sample.value, sample.time)).updatedState;
    });

    // Should maintain chronological order of remaining atomic samples
    for (let i = 1; i < state.atomicSamples.length; i++) {
      assertEquals(
        state.atomicSamples[i].dateTime >= state.atomicSamples[i - 1].dateTime,
        true,
      );
    }

    // Should have bounded atomic samples
    assertEquals(state.atomicSamples.length <= 5, true);
  });
});

Deno.test("Out-of-Order Sample Handling", async (t) => {
  await t.step("should accept first sample regardless of timestamp", () => {
    const processor = createProcessor(["1m"]);
    const t0 = DateTime.fromISO("2025-01-01T10:00:00Z");
    let state = processor;

    // First sample should always be accepted
    const result = processSample(state, toSample(100, t0));
    assertEquals(result.atomics.length, 1);
    assertEquals(result.atomics[0].value, 100);
    assertEquals(result.updatedState.atomicSamples.length, 1);
  });

  await t.step("should accept newer samples", () => {
    const processor = createProcessor(["1m"]);
    const t0 = DateTime.fromISO("2025-01-01T10:00:00Z");
    let state = processor;

    // Add first sample
    state = processSample(state, toSample(100, t0)).updatedState;
    assertEquals(state.atomicSamples.length, 1);

    // Add newer sample
    const result = processSample(
      state,
      toSample(200, t0.plus({ seconds: 30 })),
    );
    assertEquals(result.atomics.length, 2);
    assertEquals(result.atomics[0].value, 100);
    assertEquals(result.atomics[1].value, 200);
    assertEquals(result.updatedState.atomicSamples.length, 2);
  });

  await t.step("should throw away samples with same timestamp", () => {
    const processor = createProcessor(["1m"]);
    const t0 = DateTime.fromISO("2025-01-01T10:00:00Z");
    let state = processor;

    // Add first sample
    state = processSample(state, toSample(100, t0)).updatedState;
    assertEquals(state.atomicSamples.length, 1);

    // Add sample with same timestamp
    const result = processSample(state, toSample(200, t0));
    assertEquals(result.atomics.length, 1); // Should not have increased
    assertEquals(result.atomics[0].value, 100); // Should still be the original sample
    assertEquals(result.updatedState.atomicSamples.length, 1);
    assertEquals(result.updatedState, state); // State should be unchanged
  });

  await t.step("should throw away samples with older timestamp", () => {
    const processor = createProcessor(["1m"]);
    const t0 = DateTime.fromISO("2025-01-01T10:00:00Z");
    let state = processor;

    // Add first sample
    state = processSample(state, toSample(100, t0)).updatedState;
    assertEquals(state.atomicSamples.length, 1);

    // Add sample with older timestamp
    const result = processSample(
      state,
      toSample(200, t0.minus({ seconds: 30 })),
    );
    assertEquals(result.atomics.length, 1); // Should not have increased
    assertEquals(result.atomics[0].value, 100); // Should still be the original sample
    assertEquals(result.updatedState.atomicSamples.length, 1);
    assertEquals(result.updatedState, state); // State should be unchanged
  });

  await t.step("should throw away multiple out-of-order samples", () => {
    const processor = createProcessor(["1m"]);
    const t0 = DateTime.fromISO("2025-01-01T10:00:00Z");
    let state = processor;

    // Add first sample
    state = processSample(state, toSample(100, t0)).updatedState;
    assertEquals(state.atomicSamples.length, 1);

    // Add newer sample
    state = processSample(state, toSample(200, t0.plus({ seconds: 30 })))
      .updatedState;
    assertEquals(state.atomicSamples.length, 2);

    // Try to add multiple out-of-order samples
    const result1 = processSample(
      state,
      toSample(300, t0.minus({ seconds: 10 })),
    );
    assertEquals(result1.atomics.length, 2); // Should not have increased
    assertEquals(result1.updatedState, state); // State should be unchanged

    const result2 = processSample(
      result1.updatedState,
      toSample(400, t0.plus({ seconds: 15 })),
    );
    assertEquals(result2.atomics.length, 2); // Should not have increased (same timestamp as existing)
    assertEquals(result2.updatedState, state); // State should be unchanged

    // Add a truly newer sample
    const result3 = processSample(
      result2.updatedState,
      toSample(500, t0.plus({ seconds: 60 })),
    );
    assertEquals(result3.atomics.length, 3); // Should have increased
    assertEquals(result3.atomics[2].value, 500); // Should be the new sample
  });

  await t.step("should handle out-of-order samples with multiple tiers", () => {
    const processor = createProcessor(["1m", "5m"]);
    const t0 = DateTime.fromISO("2025-01-01T10:00:00Z");
    let state = processor;

    // Add samples to create some history
    state = processSample(state, toSample(100, t0)).updatedState;
    state =
      processSample(state, toSample(200, t0.plus({ minutes: 1 }))).updatedState;
    state =
      processSample(state, toSample(300, t0.plus({ minutes: 2 }))).updatedState;

    assertEquals(state.atomicSamples.length, 2); // Should be pruned to 2 samples
    assertEquals(state.tiers[0].history.length, 2); // Should have 2 1m history entries

    // Try to add out-of-order sample
    const result = processSample(
      state,
      toSample(400, t0.plus({ minutes: 1, seconds: 30 })),
    );
    assertEquals(result.atomics.length, 2); // Should not have increased
    assertEquals(result.updatedState, state); // State should be unchanged
    assertEquals(result.updatedState.tiers[0].history.length, 2); // History should be unchanged
  });

  await t.step("should handle edge case with exact timestamp equality", () => {
    const processor = createProcessor(["1m"]);
    const t0 = DateTime.fromISO("2025-01-01T10:00:00Z");
    let state = processor;

    // Add first sample
    state = processSample(state, toSample(100, t0)).updatedState;
    assertEquals(state.atomicSamples.length, 1);

    // Add sample with exactly the same timestamp
    const result = processSample(state, toSample(200, t0));
    assertEquals(result.atomics.length, 1); // Should not have increased
    assertEquals(result.atomics[0].value, 100); // Should still be the original sample
    assertEquals(result.updatedState, state); // State should be unchanged
  });
});
