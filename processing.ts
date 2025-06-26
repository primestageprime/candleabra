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

export function processSamples(
  [tier, ...restTiers]: R.NonEmptyArray<Tier>,
  samples: R.NonEmptyArray<Sample>,
): {
  tiers: R.NonEmptyArray<Tier>;
  eternal: Candlestick;
} {
  console.log("processing tier", tier.name);
  const newestSample = R.last(samples);
  const newestSampleCandlestick = toCandlestick(newestSample);
  const oldestSample = R.head(samples);

  const distance = getDistance(
    R.head(tier.history),
    oldestSample.dateTime,
    newestSample.dateTime,
  );
  console.log(`distance: ${distance.as("seconds")}`);
  const distanceExceedsTierDuration =
    distance > tier.duration.as("milliseconds");
  if (distanceExceedsTierDuration) {
    console.log(
      "distance exceeds tier duration, historizing current:",
      JSON.stringify(tier.current),
    );
    // newest sample's time means we should historize "current"
    return processOverflow(
      tier,
      newestSampleCandlestick,
      newestSample,
      distance,
      restTiers as NonEmptyArray<Tier>,
      samples,
    );
  } else {
    // if the newest sample should not result in this tier's current candlestick being historized
    // then just update the new current candlestick
    return processPartial(
      tier,
      newestSampleCandlestick,
      restTiers as NonEmptyArray<Tier>,
      samples,
    );
  }
}

export function processOverflow(
  tier: Tier,
  newestSampleCandlestick: Candlestick,
  newestSample: Sample,
  distance: Duration,
  restTiers: NonEmptyArray<Tier>,
  samples: NonEmptyArray<Sample>,
): {
  tiers: NonEmptyArray<Tier>;
  eternal: Candlestick;
} {
  const newHistoricalCandlestick = historizeCandlestick(
    tier.current,
    tier.duration,
  );
  const historicalCandlesticks = toHistoricalCandlesticks(
    newHistoricalCandlestick,
    tier.duration,
    distance,
  );
  console.log(
    "newHistoricalCandlesticks",
    JSON.stringify(historicalCandlesticks),
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
      newestSampleCandlestick,
      historicalCandlesticks,
      newestSample,
      newHistoricalCandlestick,
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
      samples,
      historicalCandlesticks,
      newestSampleCandlestick,
    );
  }
}

export function processOverflowLeaf(
  tier: Tier,
  newestSampleCandlestick: Candlestick,
  historicalCandlesticks: NonEmptyArray<Candlestick>,
  newestSample: Sample,
  newHistoricalCandlestick: Candlestick,
): {
  tiers: NonEmptyArray<Tier>;
  eternal: Candlestick;
} {
  const eternal = reduceCandlesticks([
    tier.current,
    newestSampleCandlestick,
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
  const currentOpenAt = newHistoricalCandlestick?.closeAt ||
    newestSample.dateTime;
  const newCurrent = {
    ...newestSampleCandlestick,
    openAt: currentOpenAt,
  };
  console.log(
    `leaf node new bucket: newCurrent: ${JSON.stringify(newCurrent)}`,
  );
  const history = [...historicalCandlesticks]; // todo do we need this? eternal should handle history in this case
  return {
    tiers: [{
      ...tier,
      history,
      current: newCurrent,
    }],
    eternal,
  };
}

export function processOverflowBranch(
  tier: Tier,
  restTiers: NonEmptyArray<Tier>,
  samples: NonEmptyArray<Sample>,
  historicalCandlesticks: NonEmptyArray<Candlestick>,
  newestSampleCandlestick: Candlestick,
): {
  tiers: NonEmptyArray<Tier>;
  eternal: Candlestick;
} {
  const recursed = processSamples(
    restTiers as NonEmptyArray<Tier>,
    samples,
  );
  const history = [...tier.history, ...historicalCandlesticks];
  const newCurrentTier = {
    ...tier,
    history,
    current: newestSampleCandlestick,
  };
  return {
    tiers: [newCurrentTier, ...recursed.tiers],
    eternal: recursed.eternal,
  };
}

export function processPartial(
  tier: Tier,
  newestSampleCandlestick: Candlestick,
  restTiers: NonEmptyArray<Tier>,
  samples: NonEmptyArray<Sample>,
): {
  tiers: NonEmptyArray<Tier>;
  eternal: Candlestick;
} {
  const newCurrentTier = addSampleCandlestickToCurrent(
    tier,
    newestSampleCandlestick,
  );
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
      samples,
    );
  }
}

export function addSampleCandlestickToCurrent(
  tier: Tier,
  newestSampleCandlestick: Candlestick,
) {
  const newCurrentCandlestick = reduceCandlesticks([
    tier.current,
    newestSampleCandlestick,
  ]);
  return { ...tier, current: newCurrentCandlestick };
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
  samples: NonEmptyArray<Sample>,
): {
  tiers: NonEmptyArray<Tier>;
  eternal: Candlestick;
} {
  const recursed = processSamples(
    tiers,
    samples,
  );
  return {
    tiers: [currentTier, ...recursed.tiers],
    eternal: recursed.eternal,
  };
}
