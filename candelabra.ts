import * as R from "ramda";
import type { Candelabra, Sample } from "./types.d.ts";
import { singleSampleCandelabra } from "./core.ts";
import { getCutoffTime, pruneSamples, updateSamples } from "./utils.ts";
import { processSamples } from "./processing.ts";
import { renderCandelabra, renderSamples } from "./render.ts";

export function addSampleToCandelabra(
  sample: Sample,
  candelabra: Candelabra,
): Candelabra {
  console.log("================addSampleToCandelabra=================");
  console.log("sample");
  renderSamples([sample]);
  console.log("candelabra");
  renderCandelabra(candelabra);
  // get the latest sample before the one we're adding
  const latestSample = R.last(candelabra.samples);
  if (!latestSample) {
    // If no samples exist, just add the new one
    return singleSampleCandelabra(sample, candelabra.tiers);
  }

  const cutoffTime = getCutoffTime(latestSample, candelabra.tiers);
  // If the new sample is too old, ignore it
  if (sample.dateTime < cutoffTime) {
    return candelabra;
  }

  const sortedSamples = updateSamples(sample, candelabra);

  const { tiers, eternal } = processSamples(
    candelabra.tiers,
    sortedSamples,
  );

  const samples = pruneSamples(tiers, sortedSamples);

  return {
    samples,
    tiers,
    eternal,
  };
}

export function addSamplesToCandelabra(
  samples: R.NonEmptyArray<Sample>,
  initialCandelabra: Candelabra,
): Candelabra {
  return R.reduce(
    (candelabra, sample) => {
      console.log("!!!calling addSampleToCandelabra!!!");
      return addSampleToCandelabra(sample, candelabra);
    },
    initialCandelabra,
    samples,
  );
}
