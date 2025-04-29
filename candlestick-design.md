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

