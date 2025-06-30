import * as R from "ramda";
import type { NonEmptyArray } from "npm:@types/ramda@0.30.2";
import type { Candlestick } from "./types.ts";
import { DateTime } from "luxon";

/**
 * Gets the openAt time from the first candlestick in a list
 */
export const getOpenAt: (list: NonEmptyArray<Candlestick>) => DateTime = R.pipe<
  [NonEmptyArray<Candlestick>],
  Candlestick,
  DateTime
>(
  R.head,
  R.prop("openAt"),
);

/**
 * Gets the closeAt time from the last candlestick in a list
 */
export const getCloseAt: (list: NonEmptyArray<Candlestick>) => DateTime = R
  .pipe<[NonEmptyArray<Candlestick>], Candlestick, DateTime>(
    R.last,
    R.prop("closeAt"),
  );

/**
 * Gets the open value from the first candlestick in a list
 */
export const getOpen: (list: NonEmptyArray<Candlestick>) => number = R.pipe<
  [NonEmptyArray<Candlestick>],
  Candlestick,
  number
>(
  R.head,
  R.prop("open"),
);

/**
 * Gets the close value from the last candlestick in a list
 */
export const getClose: (list: NonEmptyArray<Candlestick>) => number = R.pipe<
  [NonEmptyArray<Candlestick>],
  Candlestick,
  number
>(
  R.last,
  R.prop("close"),
);

/**
 * Gets the highest high value from a list of candlesticks
 */
export const getHigh = (list: NonEmptyArray<Candlestick>): number => {
  if (list.length === 1) {
    return list[0].high;
  }

  return R.reduce<Candlestick, number>(
    (acc, c) => R.isNil(acc) ? c.high : Math.max(acc, c.high),
    R.head(list)!.high,
  )(R.tail(list));
};

/**
 * Gets the lowest low value from a list of candlesticks
 */
export const getLow = (list: NonEmptyArray<Candlestick>): number => {
  if (list.length === 1) {
    return list[0].low;
  }

  return R.reduce<Candlestick, number>(
    (acc, c) => R.isNil(acc) ? c.low : Math.min(acc, c.low),
    R.head(list)!.low,
  )(R.tail(list));
};

/**
 * Gets the mean value from a list of candlesticks
 */
export const getMean = (list: NonEmptyArray<Candlestick>): number => {
  if (list.length === 1) {
    return list[0].mean;
  }

  return R.mean(R.map(R.prop("mean"), list));
};
