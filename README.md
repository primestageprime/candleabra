# candleabra
A deno library for generating candlesticks


## Usage
This library provides functions to generate candlesticks from time series data. There are two main processing functions:

### processValueTwoFive
Generates candlesticks by grouping samples into sets of 2 and 5.

```
import {processValueTimeishSegments} from "@primestage/candleabra@0.1.7";

const acc = {
  atomicSamples: [{open: 1, close: 1, high: 1, low: 1}],
  minuteish: [{open: 1, close: 1, high: 1, low: 1}],
  fiveMinuteish: [{open: 1, close: 1, high: 1, low: 1}],
  hourish: [{open: 1, close: 1, high: 1, low: 1}],
  allSamples: [{open: 1, close: 1, high: 1, low: 1}]
}

const value = 9

processValueTimeishSegments(acc, value) => {
  atomicSamples: [{open: 9, close: 9, high: 9, low: 9}],
  minuteish: [{open: 1, close: 9, high: 9, low: 1}],
  fiveMinuteish: [{open: 1, close: 9, high: 9, low: 1}],
  hourish: [{open: 1, close: 9, high: 9, low: 1}],
  allSamples: [{open: 1, close: 9, high: 9, low: 1}]
}
```

The function should automatically prune the ranges so they contain the minimal amount to serve the tiered candlesticks
