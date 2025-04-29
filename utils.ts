import * as R from "ramda"
import type { Candlestick } from "./types.ts"

export const getOpen = R.pipe<[Candlestick[]], Candlestick, number>(
  R.head,
  R.prop('open')
);

export const getClose = R.pipe<[Candlestick[]], Candlestick, number>(
  R.last,
  R.prop('close')
);

export const getHigh = (list: Candlestick[]) => {
  if (list.length === 1) {
    return list[0].high
  }
  
  return R.reduce<Candlestick, number>(
    (acc, c) => R.isNil(acc) ? c.high : Math.max(acc, c.high),
    R.head(list)!.high
  )(R.tail(list))
}

export const getLow = (list: Candlestick[]) => {
  return R.reduce<Candlestick, number>(
    (acc, c) => R.isNil(acc) ? c.low : Math.min(acc, c.low),
    R.head(list)!.low
  )(R.tail(list))
}
