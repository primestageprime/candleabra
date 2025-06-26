import * as R from "ramda";
import type { NonEmptyArray } from "npm:@types/ramda@0.30.2";
import type { Candelabra, Candlestick, Sample, Tier } from "./types.d.ts";
import { Duration } from "luxon";
import { renderSmartCandlesticks } from "./renderCandlesticks.ts";
import { toCandlestick } from "./core.ts";

export function renderTier(tier: Tier): void {
  console.log(`====== name: ${tier.name} ======`);
  console.log("current");
  renderSmartCandlesticks([tier.current], tier.duration);
  console.log("history");
  renderSmartCandlesticks(tier.history || [], tier.duration);
  console.log(`====== end tier: ${tier.name} ======`);
}

export function renderCandelabra(candelabra: Candelabra): void {
  console.log("====== candelabra ======");
  console.log("samples:");
  renderSamples(candelabra.samples);
  console.log("eternal:");
  renderSmartCandlesticks(
    [candelabra.eternal],
    candelabra.eternal.closeAt.diff(candelabra.eternal.openAt),
  );
  console.log("tiers:");
  candelabra.tiers.forEach(renderTier);
  console.log("====== end candelabra ======");
}

export function renderSamples(samples: R.NonEmptyArray<Sample>): void {
  renderSmartCandlesticks(
    R.map(toCandlestick, samples),
    Duration.fromMillis(1),
  );
}
