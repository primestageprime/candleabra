We want to build a system where we keep sliding window candlestick metrics. 

If a typescript library already exists to do this, we can consider that.

Consider a time series metric that follows this pattern:

```
const values = [1,1,1,1,1, 1,1,9,9,1, 1,1,9,1,1, 1,1,1,1,1]
```

A candlestick object that contains the:
open: first value in the time range
close: last value in the time range
high: greatest value in the time range
low: least value in the time range

const nominal = {open: 1, close: 1, high: 1, low: 1}
const critical = {open: 9, close: 9, high: 9, low: 9}
const critical_new = {open: 1, close: 9, high: 9, low: 1}
const resolved = {open: 9, close: 1, high: 9, low: 1}
const spike = {open: 1, close: 1, high: 9, low: 1}
const temporary_resolution = {open: 9, close: 9, high: 9, low: 1}

Consider the following time ranges:

At the 0th position in the values list
one_sample: nominal
two_samples: nominal
five_samples: nominal
all_time: nominal

At the 7th position in the values list
one_sample: critical
two_samples: critical_new
five_samples: critical_new
all_time: critical_new


At the 8th position in the values list
one_sample: critical
two_samples: critical
five_samples: critical_new
all_time: critical_new

At the 9th position in the values list
one_sample: nominal
two_samples: resolved
five_samples: spike
all_time: spike

At the 12th position in the values list
one_sample: critical
two_samples: critical_new
five_samples: temporary_resolution
all_time: critical_new

At the 18th position in the values list
one_sample: nominal
two_samples: nominal
five_samples: nominal
all_time: spike

I imagine this as a transducer. Where I can pass in one value at a time and construct the one_sample candlestick which will be unified in its values. I will accumulate the history of the one_sample array of candlesticks until I have enough to produce a list at the granularity of 2 samples candlesticks.

When I accumulate enough to create the two_samples candlesticks, I'll prune the samples off the one_sample array of candlesticks to reduce the memory footprint. The two_samples will similarly accumulate candlesticks until they have enough to fill the five_samples. Then they will prune to reduce memory.

The five samples will retain only retain one candlestick. Each time it accumulates enough, it will merge its contents into the all_time candlestick. I want to create the system such that I could add arbitrary sliding windows and they would work.

First create an observation that is capable of console logging the starting accumulator, new value, and ending accumulator. Prioritize terse but clear rendering. Represent lists as single line lists and candlesticks as following this format:

      [ high ]
[open]        [close]
      [ low  ]   

Step 1: Begin by creating a reducer function that can receive an empty accumulator (null for open, close, high, low) and receives each value producing the correct one_sample candlestick.

Step 2: create a reducer function that takes the accumulator and each value and produces the correct two_samples candlestick. This needs to work for both a null accumulator, and one that has historical values.

Step 3: create a reducer function that takes the accumulator and each value and produces the correct five_samples candlestick. For the five samples, it will be necessary to store the correct number of samples.

Step 4: create a function that prunes the accumulator of history when retaining candlesticks is no longer necessary to produce the correct answers.
