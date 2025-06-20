import type { Candlestick } from "./types.d.ts";
import { observeCandlestick, type GridData } from "./candlestick.ts";

const CELL_WIDTH = 10;
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";
const BORDER = "\x1b[36m"; // Cyan for borders

interface CandlestickWithTime extends Candlestick {
  start: string;
  end: string;
}

function formatCell(value: string, width: number, align: "left" | "right" | "center" = "center"): string {
  const len = value.length;
  if (len >= width) return value.slice(0, width);
  const pad = width - len;
  if (align === "right") return " ".repeat(pad) + value;
  if (align === "left") return value + " ".repeat(pad);
  // center
  const left = Math.floor(pad / 2);
  const right = pad - left;
  return " ".repeat(left) + value + " ".repeat(right);
}

function formatNumber(value: number): string {
  let str = value.toFixed(3); // e.g. 1.234
  if (str.length > 5) str = value.toPrecision(5);
  if (str.length > 5) str = value.toExponential(2); // fallback
  if (str.length > 5) str = str.slice(0, 5);
  return formatCell(str, CELL_WIDTH, "center");
}

function renderCandlestickGrid(candlestick: CandlestickWithTime, granularity: string = "1s"): string[] {
  // Top, mid, bottom borders
  const top = BORDER + "┌" + "─".repeat(CELL_WIDTH) + "┬" + "─".repeat(CELL_WIDTH) + "┬" + "─".repeat(CELL_WIDTH) + "┐" + RESET;
  const mid = BORDER + "├" + "─".repeat(CELL_WIDTH) + "┼" + "─".repeat(CELL_WIDTH) + "┼" + "─".repeat(CELL_WIDTH) + "┤" + RESET;
  const bot = BORDER + "└" + "─".repeat(CELL_WIDTH) + "┴" + "─".repeat(CELL_WIDTH) + "┴" + "─".repeat(CELL_WIDTH) + "┘" + RESET;
  
  // Row 1: [granularity, high, duration]
  const row1 = BORDER + "│" + RESET +
    YELLOW + formatCell(granularity, CELL_WIDTH) + RESET +
    BORDER + "│" + RESET +
    YELLOW + formatNumber(candlestick.high) + RESET +
    BORDER + "│" + RESET +
    YELLOW + formatCell(granularity, CELL_WIDTH) + RESET +
    BORDER + "│" + RESET;
  
  // Row 2: [open, mean, close]
  const row2 = BORDER + "│" + RESET +
    YELLOW + formatNumber(candlestick.open) + RESET +
    BORDER + "│" + RESET +
    YELLOW + formatNumber(candlestick.mean) + RESET +
    BORDER + "│" + RESET +
    YELLOW + formatNumber(candlestick.close) + RESET +
    BORDER + "│" + RESET;
  
  // Row 3: [start, low, end]
  const row3 = BORDER + "│" + RESET +
    YELLOW + formatCell(candlestick.start, CELL_WIDTH) + RESET +
    BORDER + "│" + RESET +
    YELLOW + formatNumber(candlestick.low) + RESET +
    BORDER + "│" + RESET +
    YELLOW + formatCell(candlestick.end, CELL_WIDTH) + RESET +
    BORDER + "│" + RESET;
  
  return [top, row1, mid, row2, mid, row3, bot];
}

function renderMultipleCandlesticks(candlesticks: CandlestickWithTime[], granularity: string = "1s") {
  const grids = candlesticks.map(c => renderCandlestickGrid(c, granularity));
  for (let i = 0; i < grids[0].length; i++) {
    const line = grids.map(g => g[i]).join("  -  ");
    console.log(line);
  }
}

function generateSecondLevelCandlesticks(): CandlestickWithTime[] {
  return Array.from({ length: 5 }, (_, i) => ({
    open: 1.0 + i * 0.5,
    close: 2.0 + i * 0.3,
    high: 3.0 + i * 0.2,
    low: 0.5 + i * 0.1,
    mean: 1.5 + i * 0.4,
    start: `10:00:0${i}`,
    end: `10:00:0${i + 1}`
  }));
}

function generateMinuteLevelCandlesticks(): CandlestickWithTime[] {
  return Array.from({ length: 3 }, (_, i) => ({
    open: 2.0 + i * 1.0,
    close: 3.0 + i * 0.8,
    high: 4.0 + i * 0.5,
    low: 1.0 + i * 0.3,
    mean: 2.5 + i * 0.7,
    start: `10:${String(i).padStart(2, '0')}:00`,
    end: `10:${String(i + 1).padStart(2, '0')}:00`
  }));
}

function generateHourLevelCandlesticks(): CandlestickWithTime[] {
  return Array.from({ length: 2 }, (_, i) => ({
    open: 5.0 + i * 2.0,
    close: 6.0 + i * 1.5,
    high: 7.0 + i * 1.0,
    low: 4.0 + i * 0.8,
    mean: 5.5 + i * 1.2,
    start: `${String(10 + i).padStart(2, '0')}:00:00`,
    end: `${String(11 + i).padStart(2, '0')}:00:00`
  }));
}

if (import.meta.main) {
  console.log("Second Level Candlesticks (1s each, 5 samples):");
  renderMultipleCandlesticks(generateSecondLevelCandlesticks(), "1s");
  
  console.log("\nMinute Level Candlesticks (1m each, 3 samples):");
  renderMultipleCandlesticks(generateMinuteLevelCandlesticks(), "1m");
  
  console.log("\nHour Level Candlesticks (1h each, 2 samples):");
  renderMultipleCandlesticks(generateHourLevelCandlesticks(), "1h");
} 