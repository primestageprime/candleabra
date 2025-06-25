import type { Candlestick } from "./types.d.ts";
import { DateTime, Duration } from "luxon";

const CELL_WIDTH = 10;
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";
const BORDER = "\x1b[36m"; // Cyan for borders

function formatCell(
  value: string,
  width: number,
  align: "left" | "right" | "center" = "center",
): string {
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

function formatTime(dt: DateTime): string {
  return formatCell(dt.toFormat("HH:mm:ss"), CELL_WIDTH);
}

function renderCandlestickGrid(
  candlestick: Candlestick,
  duration: Duration,
): string[] {
  // Top, mid, bottom borders
  const top = BORDER + "┌" + "─".repeat(CELL_WIDTH) + "┬" +
    "─".repeat(CELL_WIDTH) + "┬" + "─".repeat(CELL_WIDTH) + "┐" + RESET;
  const mid = BORDER + "├" + "─".repeat(CELL_WIDTH) + "┼" +
    "─".repeat(CELL_WIDTH) + "┼" + "─".repeat(CELL_WIDTH) + "┤" + RESET;
  const bot = BORDER + "└" + "─".repeat(CELL_WIDTH) + "┴" +
    "─".repeat(CELL_WIDTH) + "┴" + "─".repeat(CELL_WIDTH) + "┘" + RESET;

  // Row 1: [tier duration (e.g. "1m"), high, actual duration (e.g. "00:01:00")]
  const row1 = BORDER + "│" + RESET +
    YELLOW +
    formatCell(duration.toHuman({ unitDisplay: "short" }), CELL_WIDTH) + RESET +
    BORDER + "│" + RESET +
    YELLOW + formatNumber(candlestick.high) + RESET +
    BORDER + "│" + RESET +
    YELLOW + formatCell(duration.toFormat("mm:ss.SSS"), CELL_WIDTH) + RESET +
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
    YELLOW + formatTime(candlestick.openAt) + RESET +
    BORDER + "│" + RESET +
    YELLOW + formatNumber(candlestick.low) + RESET +
    BORDER + "│" + RESET +
    YELLOW + formatTime(candlestick.closeAt) + RESET +
    BORDER + "│" + RESET;

  return [top, row1, mid, row2, mid, row3, bot];
}

function renderMultipleCandlesticks(
  candlesticks: Candlestick[],
  duration: Duration,
) {
  const grids = candlesticks.map((c) => renderCandlestickGrid(c, duration));
  for (let i = 0; i < grids[0].length; i++) {
    const line = grids.map((g) => g[i]).join("  -  ");
    console.log(line);
  }
}

function generateSecondLevelCandlesticks(): Candlestick[] {
  return Array.from({ length: 5 }, (_, i) => ({
    open: 1.0 + i * 0.5,
    close: 2.0 + i * 0.3,
    high: 3.0 + i * 0.2,
    low: 0.5 + i * 0.1,
    mean: 1.5 + i * 0.4,
    openAt: DateTime.fromISO(`2024-01-01T10:00:0${i}`),
    closeAt: DateTime.fromISO(`2024-01-01T10:00:0${i + 1}`),
  }));
}

function generateMinuteLevelCandlesticks(): Candlestick[] {
  return Array.from({ length: 3 }, (_, i) => ({
    open: 2.0 + i * 1.0,
    close: 3.0 + i * 0.8,
    high: 4.0 + i * 0.5,
    low: 1.0 + i * 0.3,
    mean: 2.5 + i * 0.7,
    openAt: DateTime.fromISO(`2024-01-01T10:${String(i).padStart(2, "0")}:00`),
    closeAt: DateTime.fromISO(
      `2024-01-01T10:${String(i + 1).padStart(2, "0")}:00`,
    ),
  }));
}

function generateHourLevelCandlesticks(): Candlestick[] {
  return Array.from({ length: 2 }, (_, i) => ({
    open: 5.0 + i * 2.0,
    close: 6.0 + i * 1.5,
    high: 7.0 + i * 1.0,
    low: 4.0 + i * 0.8,
    mean: 5.5 + i * 1.2,
    openAt: DateTime.fromISO(
      `2024-01-01T${String(10 + i).padStart(2, "0")}:00:00`,
    ),
    closeAt: DateTime.fromISO(
      `2024-01-01T${String(11 + i).padStart(2, "0")}:00:00`,
    ),
  }));
}

function renderEllipsisBox(omitted: number): string[] {
  const ellipsis = `${omitted} samples`;
  const top = BORDER + "┌" + "─".repeat(CELL_WIDTH) + "┐" + RESET;
  const mid = BORDER + "├" + "─".repeat(CELL_WIDTH) + "┤" + RESET;
  const bot = BORDER + "└" + "─".repeat(CELL_WIDTH) + "┘" + RESET;
  const row = BORDER + "│" + RESET +
    YELLOW + formatCell(ellipsis, CELL_WIDTH) + RESET +
    BORDER + "│" + RESET;
  return [top, row, mid, row, mid, row, bot];
}

export function renderSmartCandlesticks(
  candlesticks: Candlestick[],
  duration: Duration,
) {
  if (candlesticks.length === 0) {
    console.log("renderSmartCandlesticks: no candlesticks");
    return;
  }
  let display: (Candlestick | null)[];
  let omitted = 0;
  if (candlesticks.length <= 4) {
    display = candlesticks;
  } else {
    omitted = candlesticks.length - 4;
    display = [
      candlesticks[0],
      candlesticks[1],
      null, // placeholder for ellipsis
      candlesticks[candlesticks.length - 2],
      candlesticks[candlesticks.length - 1],
    ];
  }
  // Render each grid, using the ellipsis function for null values
  const grids = display.map((c, i) => {
    if (c) return renderCandlestickGrid(c, duration);
    return renderEllipsisBox(omitted);
  });
  for (let i = 0; i < grids[0].length; i++) {
    const line = grids.map((g) => g[i]).join("  -  ");
    console.log(line);
  }
}

function generateLargeSamples() {
  const baseTime = DateTime.fromISO("2024-01-01T10:00:00");

  // 120 second-level
  const seconds = Array.from({ length: 120 }, (_, i) => ({
    open: 1 + i * 0.01,
    close: 2 + i * 0.01,
    high: 3 + i * 0.01,
    low: 0.5 + i * 0.01,
    mean: 1.5 + i * 0.01,
    openAt: baseTime.plus({ seconds: i }),
    closeAt: baseTime.plus({ seconds: i + 1 }),
  }));

  // 120 minute-level
  const minutes = Array.from({ length: 120 }, (_, i) => ({
    open: 2 + i * 0.02,
    close: 3 + i * 0.02,
    high: 4 + i * 0.02,
    low: 1 + i * 0.02,
    mean: 2.5 + i * 0.02,
    openAt: baseTime.plus({ minutes: i }),
    closeAt: baseTime.plus({ minutes: i + 1 }),
  }));

  // 3 hour-level
  const hours = Array.from({ length: 3 }, (_, i) => ({
    open: 5 + i * 2,
    close: 6 + i * 1.5,
    high: 7 + i * 1,
    low: 4 + i * 0.8,
    mean: 5.5 + i * 1.2,
    openAt: baseTime.plus({ hours: i }),
    closeAt: baseTime.plus({ hours: i + 1 }),
  }));

  return { seconds, minutes, hours };
}

// Example usage for large samples
if (import.meta.main) {
  const { seconds, minutes, hours } = generateLargeSamples();
  console.log("Smart Render: 120 Second Level Candlesticks (1s each):");
  renderSmartCandlesticks(seconds, "1s");
  console.log("\nSmart Render: 120 Minute Level Candlesticks (1m each):");
  renderSmartCandlesticks(minutes, "1m");
  console.log("\nSmart Render: 3 Hour Level Candlesticks (1h each):");
  renderSmartCandlesticks(hours, "1h");
}
