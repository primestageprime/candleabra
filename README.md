# Candleabra - Multi-Tier Candlestick Processing

A TypeScript library for processing time-series data into multi-tier candlestick aggregations with automatic memory management and cascading updates.

## Features

- **Multi-tier Processing**: Process data into multiple time granularities (1m, 5m, 1h, 1d, etc.)
- **Streaming Architecture**: Process samples one at a time with real-time updates
- **Automatic Memory Management**: Intelligent pruning of historical data based on higher-tier completion
- **Time-weighted Aggregation**: Proper handling of time-weighted means across time buckets
- **Configurable Tiers**: Define custom tier configurations for your use case
- **Functional Design**: Pure functions with immutable state updates

## Installation

```bash
# Using Deno
import { createProcessor, processSample, toSample } from "https://deno.land/x/candleabra@0.1.12/mod.ts";

# Using npm (if published)
npm install @primestage/candleabra
```

## Quick Start

### Basic Usage

```typescript
import { DateTime } from "luxon";
import { 
  createProcessor, 
  processSample, 
  toSample,
  getResults 
} from "https://deno.land/x/candleabra@0.1.12/mod.ts";

// Define your tier configuration
const tiers = ["1m", "5m", "1h", "1d"];

// Create a processor
const processor = createProcessor(tiers);
let state = processor;

// Process samples
const sample1 = toSample(100, DateTime.fromISO("2025-01-01T10:00:00Z"));
const result1 = processSample(state, sample1);
state = result1.updatedState;

const sample2 = toSample(105, DateTime.fromISO("2025-01-01T10:00:30Z"));
const result2 = processSample(state, sample2);
state = result2.updatedState;

// Get current results
const results = getResults(state);
results.forEach(({ name, candlesticks }) => {
  console.log(`${name}:`, candlesticks);
});
```

### Advanced Example: Real-time Trading Data

```typescript
import { DateTime } from "luxon";
import { 
  createProcessor, 
  processSample, 
  toSample,
  getResults,
  type ProcessorState 
} from "https://deno.land/x/candleabra@0.1.12/mod.ts";

class TradingDataProcessor {
  private state: ProcessorState;
  
  constructor() {
    // Define tiers for different timeframes
    const tiers = ["1m", "5m", "15m", "1h", "6h", "1d"];
    this.state = createProcessor(tiers);
  }
  
  // Process incoming trade data
  processTrade(price: number, timestamp: DateTime) {
    const sample = toSample(price, timestamp);
    const result = processSample(this.state, sample);
    this.state = result.updatedState;
    
    // Return atomic samples and current candlesticks
    return {
      atomics: result.atomics,
      tiers: getResults(this.state)
    };
  }
  
  // Get current state for all tiers
  getCurrentState() {
    return getResults(this.state);
  }
  
  // Get historical data for a specific tier
  getHistoricalData(tierName: string) {
    const results = getResults(this.state);
    const tier = results.find(r => r.name === tierName);
    return tier?.candlesticks.filter(c => !c.isPartial) || [];
  }
}

// Usage
const processor = new TradingDataProcessor();

// Simulate incoming trades
const trades = [
  { price: 100.50, time: "2025-01-01T10:00:00Z" },
  { price: 100.75, time: "2025-01-01T10:00:15Z" },
  { price: 100.25, time: "2025-01-01T10:00:30Z" },
  { price: 101.00, time: "2025-01-01T10:00:45Z" },
  { price: 100.80, time: "2025-01-01T10:01:00Z" }, // Triggers 1m completion
];

trades.forEach(trade => {
  const timestamp = DateTime.fromISO(trade.time);
  const result = processor.processTrade(trade.price, timestamp);
  
  console.log(`Trade: $${trade.price} at ${timestamp.toFormat("HH:mm:ss")}`);
  console.log("Current 1m candlestick:", result.tiers.find(t => t.name === "1m")?.candlesticks);
});
```

### Custom Tier Configuration

```typescript
import { createProcessor, parseGranularity } from "https://deno.land/x/candleabra@0.1.12/mod.ts";

// Define custom tiers for your use case
const customTiers = [
  "30s",   // 30-second intervals
  "2m",    // 2-minute intervals  
  "10m",   // 10-minute intervals
  "1h",    // 1-hour intervals
  "4h",    // 4-hour intervals
  "1d",    // 1-day intervals
  "3d",    // 3-day intervals
];

// Validate granularities
customTiers.forEach(tier => {
  try {
    const granularity = parseGranularity(tier);
    console.log(`✓ ${tier}: ${granularity.duration.toISO()}`);
  } catch (error) {
    console.error(`✗ ${tier}: ${error.message}`);
  }
});

// Create processor with custom tiers
const processor = createProcessor(customTiers);
```

## API Reference

### Core Functions

#### `createProcessor(tiers: GranularityConfig): ProcessorState`
Creates a new processor state with the specified tier configuration.

**Parameters:**
- `tiers`: Array of granularity strings (e.g., `["1m", "5m", "1h", "1d"]`)

**Returns:** Initial processor state

#### `processSample(state: ProcessorState, sample: Sample): ProcessingResult`
Processes a single sample through all tiers.

**Parameters:**
- `state`: Current processor state
- `sample`: Sample to process

**Returns:** Object containing updated state and atomic samples

#### `getResults(state: ProcessorState): Array<{name: string, candlesticks: Candlestick[]}>`
Gets current candlesticks for all tiers.

**Parameters:**
- `state`: Processor state

**Returns:** Array of tier results with candlesticks

### Utility Functions

#### `toSample(value: number, dateTime: DateTime): Sample`
Creates a sample from a value and timestamp.

#### `toCandlestick(sample: Sample): Candlestick`
Creates a single-sample candlestick.

#### `reduceCandlesticks(candlesticks: NonEmptyArray<Candlestick>): Candlestick`
Reduces multiple candlesticks into a single aggregated candlestick.

#### `parseGranularity(granularity: string): Granularity`
Parses a granularity string into a Granularity object.

### Types

#### `Candlestick`
```typescript
type Candlestick = {
  open: number;
  close: number;
  high: number;
  low: number;
  mean: number;
  openAt: DateTime;
  closeAt: DateTime;
};
```

#### `Sample`
```typescript
type Sample = {
  value: number;
  dateTime: DateTime;
};
```

#### `Granularity`
```typescript
type Granularity = {
  amount: number;
  unit: 'm' | 'h' | 'd';
  duration: Duration;
};
```

## Supported Granularities

### Minutes
- `1m`, `2m`, `3m`, `4m`, `5m`, `6m`, `10m`, `12m`, `15m`, `20m`, `30m`

### Hours  
- `1h`, `2h`, `3h`, `4h`, `6h`, `8h`, `12h`

### Days
- `1d`, `2d`, `3d`, `4d`, `5d`, `6d`, `7d`, etc.

## Memory Management

The library automatically manages memory by pruning historical data:

- **Current candlesticks** (white in demos) track the latest sample time
- **Finalized candlesticks** (gray in demos) use proper bucket end times
- **Pruning** occurs when higher tiers create finalized candlesticks
- **Atomic samples** are dropped immediately after processing

## Examples

See the `demo/` directory for complete examples:

- `demo.ts` - Interactive streaming demo
- `demo-batch.ts` - Batch processing demo
- `demo-configurable.ts` - Configurable tier demo

## Development

```bash
# Run tests
deno task test

# Run interactive demo
deno task demo

# Run batch demo
deno task demo-batch

# Run with custom tiers
deno task demo-extended
```

## License

MIT License - see LICENSE file for details. 