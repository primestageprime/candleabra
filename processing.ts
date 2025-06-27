import * as R from "ramda";
import type { NonEmptyArray } from "npm:@types/ramda@0.30.2";
import type { Candlestick, Sample, Tier } from "./types.d.ts";
import { Duration } from "luxon";
import { reduceCandlesticks, toCandlestick } from "./core.ts";
import {
  getDistance,
  historizeCandlestick,
  toHistoricalCandlesticks,
} from "./utils.ts";

export function processSample(
  [tier, ...restTiers]: R.NonEmptyArray<Tier>,
  sample: Sample,
): {
  tiers: R.NonEmptyArray<Tier>;
  eternal: Candlestick;
} {
  console.log("processing tier", tier.name);

  const distance = getDistance(
    R.head(tier.history),
    tier.current.openAt,
    sample.dateTime,
  );
  console.log(`distance: ${distance.as("seconds")}`);
  const overflow = distance > tier.duration.as("milliseconds");
  if (overflow) {
    console.log(
      "distance exceeds tier duration, historizing current:",
      JSON.stringify(tier.current),
    );
    // newest sample's time means we should historize "current"
    return processOverflow(
      tier,
      distance,
      sample,
      restTiers as NonEmptyArray<Tier>,
    );
  } else {
    // if the newest sample should not result in this tier's current candlestick being historized
    // then just update the new current candlestick
    return processPartial(
      tier,
      restTiers as NonEmptyArray<Tier>,
      sample,
    );
  }
}

export function processOverflow(
  tier: Tier,
  distance: Duration,
  sample: Sample,
  restTiers: NonEmptyArray<Tier>,
): {
  tiers: NonEmptyArray<Tier>;
  eternal: Candlestick;
} {
  const newHistoricalCandlestick = historizeCandlestick(
    tier.current,
    tier.duration,
  );
  const newHistoricalCandlesticks = toHistoricalCandlesticks(
    newHistoricalCandlestick,
    tier.duration,
    distance,
  );
  console.log(
    "newHistoricalCandlesticks",
    JSON.stringify(newHistoricalCandlesticks),
  );
  if (R.isEmpty(restTiers)) {
    console.log("leaf node, new bucket");
    // if the newest sample should result in the current candlestick being historized
    // and there are no tiers to cascade to
    // then return this tier with the current candlestick
    // and set newest sample candlestick as eternal
    // and set the samples to just the newest sample
    return processOverflowLeaf(
      tier,
      sample,
      newHistoricalCandlesticks,
    );
  } else {
    console.log("branch, new bucket");
    // if the newest sample should result in this tier's current candlestick being historized
    // and there are other tiers to cascade to
    // then recurse into the rest of the tiers
    // and set the samples to just the newest sample
    return processOverflowBranch(
      tier,
      restTiers as NonEmptyArray<Tier>,
      sample,
      newHistoricalCandlesticks,
    );
  }
}

export function processOverflowLeaf(
  tier: Tier,
  sample: Sample,
  historicalCandlesticks: NonEmptyArray<Candlestick>,
): {
  tiers: NonEmptyArray<Tier>;
  eternal: Candlestick;
} {
  const sampleCandlestick = toCandlestick(sample);
  // todo not sure about this... does current already contain the "samples" candlestick??
  const eternal = reduceCandlesticks([
    tier.current,
    sampleCandlestick,
  ]);
  // console.log(
  //   `newestSampleCandlestick: ${JSON.stringify(newestSampleCandlestick)}`,
  // );
  // console.log("thisTier.current");
  // renderSmartCandlesticks(
  //   [thisTier.current],
  //   thisTier.current.closeAt.diff(thisTier.current.openAt),
  // );
  // console.log("newestSampleCandlestick");
  // renderSmartCandlesticks([newestSampleCandlestick], thisTier.duration);
  // console.log("eternal");
  // renderSmartCandlesticks(
  //   [eternal],
  //   newestSampleCandlestick.closeAt.diff(
  //     tiers?.[0]?.history?.[0]?.openAt || Duration.fromMillis(0),
  //   ).as("seconds"),
  // );
  // the current openAt is either the newest history's closeAt or, if this is the first sample, that sample's datetime
  const newHistoricalCandlestick = R.last(historicalCandlesticks);
  const currentOpenAt = newHistoricalCandlestick?.closeAt ||
    sampleCandlestick.openAt;
  const newCurrent = {
    ...sampleCandlestick,
    openAt: currentOpenAt,
  };
  console.log(
    `leaf node new bucket: newCurrent: ${JSON.stringify(newCurrent)}`,
  );
  return {
    tiers: [{
      ...tier,
      history: historicalCandlesticks,
      current: newCurrent,
    }],
    eternal,
  };
}

export function processOverflowBranch(
  tier: Tier,
  restTiers: NonEmptyArray<Tier>,
  sample: Sample,
  historicalCandlesticks: NonEmptyArray<Candlestick>,
): {
  tiers: NonEmptyArray<Tier>;
  eternal: Candlestick;
} {
  const recursed = processSample(
    restTiers as NonEmptyArray<Tier>,
    sample,
  );
  const history = [...tier.history, ...historicalCandlesticks];
  const newCurrentTier = {
    ...tier,
    history,
    current: toCandlestick(sample),
  };
  return {
    tiers: [newCurrentTier, ...recursed.tiers],
    eternal: recursed.eternal,
  };
}

export function processPartial(
  tier: Tier,
  restTiers: NonEmptyArray<Tier>,
  sample: Sample,
): {
  tiers: NonEmptyArray<Tier>;
  eternal: Candlestick;
} {
  const newCurrentTier = {
    ...tier,
    current: reduceCandlesticks([tier.current, toCandlestick(sample)]),
  };

  if (R.isEmpty(restTiers)) {
    // if there are no other tiers to cascade to
    // then just return the new current tier and update eternal
    return processPartialLeaf(newCurrentTier);
  } else {
    // if there are other tiers to cascade to
    // then just update the new current candlestick and recurse into the other tiers
    // (which will update their current candlesticks)
    return processPartialBranch(
      newCurrentTier,
      restTiers as NonEmptyArray<Tier>,
      sample,
    );
  }
}

export function processPartialLeaf(
  tier: Tier,
): {
  tiers: NonEmptyArray<Tier>;
  eternal: Candlestick;
} {
  return {
    tiers: [tier],
    eternal: tier.current,
  };
}

export function processPartialBranch(
  currentTier: Tier,
  tiers: NonEmptyArray<Tier>,
  sample: Sample,
): {
  tiers: NonEmptyArray<Tier>;
  eternal: Candlestick;
} {
  const recursed = processSample(
    tiers,
    sample,
  );
  return {
    tiers: [currentTier, ...recursed.tiers],
    eternal: recursed.eternal,
  };
}
