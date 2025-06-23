import * as R from "ramda";
import type { NonEmptyArray } from "npm:@types/ramda@0.30.2";
import type { Candlestick } from "./types.d.ts";
import { DateTime } from "luxon";

export const getOpenAt: (list: NonEmptyArray<Candlestick>) => DateTime = R.pipe<
  [NonEmptyArray<Candlestick>],
  Candlestick,
  DateTime
>(
  R.head,
  R.prop("openAt"),
);

export const getCloseAt: (list: NonEmptyArray<Candlestick>) => DateTime = R
  .pipe<[NonEmptyArray<Candlestick>], Candlestick, DateTime>(
    R.last,
    R.prop("closeAt"),
  );

export const getOpen: (list: NonEmptyArray<Candlestick>) => number = R.pipe<
  [NonEmptyArray<Candlestick>],
  Candlestick,
  number
>(
  R.head,
  R.prop("open"),
);

export const getClose: (list: NonEmptyArray<Candlestick>) => number = R.pipe<
  [NonEmptyArray<Candlestick>],
  Candlestick,
  number
>(
  R.last,
  R.prop("close"),
);

export const getHigh = (list: NonEmptyArray<Candlestick>): number => {
  if (list.length === 1) {
    return list[0].high;
  }

  return R.reduce<Candlestick, number>(
    (acc, c) => R.isNil(acc) ? c.high : Math.max(acc, c.high),
    R.head(list)!.high,
  )(R.tail(list));
};

export const getLow = (list: NonEmptyArray<Candlestick>): number => {
  if (list.length === 1) {
    return list[0].low;
  }

  return R.reduce<Candlestick, number>(
    (acc, c) => R.isNil(acc) ? c.low : Math.min(acc, c.low),
    R.head(list)!.low,
  )(R.tail(list));
};

export const getMean = (list: NonEmptyArray<Candlestick>): number => {
  if (list.length === 1) {
    return list[0].mean;
  }

  return R.mean(R.map(R.prop("mean"), list));
};
