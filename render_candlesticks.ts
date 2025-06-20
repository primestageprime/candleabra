import type { Candlestick } from "./types.d.ts";
import { observeCandlestick, type GridData } from "./candlestick.ts";

function centerText(text: string, width: number): string {
  const padding = Math.max(0, width - text.length);
  const leftPadding = Math.floor(padding / 2);
  const rightPadding = padding - leftPadding;
  return " ".repeat(leftPadding) + text + " ".repeat(rightPadding);
}

function renderCandlestickGrid(candlestick: Candlestick, startTime?: string, endTime?: string) {
  const gridData = observeCandlestick(candlestick, startTime, endTime);
  
  // ANSI color codes
  const yellow = "\x1b[33m";
  const reset = "\x1b[0m";
  const border = "\x1b[36m"; // Cyan for borders
  
  const cellWidth = 15;
  const cellHeight = 3;
  
  // Create the grid using Unicode box drawing characters
  const topBorder = border + "┌" + "─".repeat(cellWidth) + "┬" + "─".repeat(cellWidth) + "┬" + "─".repeat(cellWidth) + "┐" + reset;
  const middleBorder = border + "├" + "─".repeat(cellWidth) + "┼" + "─".repeat(cellWidth) + "┼" + "─".repeat(cellWidth) + "┤" + reset;
  const bottomBorder = border + "└" + "─".repeat(cellWidth) + "┴" + "─".repeat(cellWidth) + "┴" + "─".repeat(cellWidth) + "┘" + reset;
  
  // Row 1: [start, duration, end]
  const row1 = border + "│" + reset + 
               yellow + centerText(gridData.start, cellWidth) + reset + 
               border + "│" + reset + 
               yellow + centerText(gridData.duration, cellWidth) + reset + 
               border + "│" + reset + 
               yellow + centerText(gridData.end, cellWidth) + reset + 
               border + "│" + reset;
  
  // Row 2: [open, mean, close]
  const row2 = border + "│" + reset + 
               yellow + centerText(gridData.open, cellWidth) + reset + 
               border + "│" + reset + 
               yellow + centerText(gridData.mean, cellWidth) + reset + 
               border + "│" + reset + 
               yellow + centerText(gridData.close, cellWidth) + reset + 
               border + "│" + reset;
  
  // Row 3: [__, low, ___]
  const row3 = border + "│" + reset + 
               yellow + centerText("__", cellWidth) + reset + 
               border + "│" + reset + 
               yellow + centerText(gridData.low, cellWidth) + reset + 
               border + "│" + reset + 
               yellow + centerText("___", cellWidth) + reset + 
               border + "│" + reset;
  
  // Print the grid
  console.log("\n" + topBorder);
  console.log(row1);
  console.log(middleBorder);
  console.log(row2);
  console.log(middleBorder);
  console.log(row3);
  console.log(bottomBorder + "\n");
}

// Example usage with sample data
const sampleCandlestick: Candlestick = {
  open: 1.0,
  close: 9.0,
  high: 9.0,
  low: 1.0,
  mean: 5.0
};

// Run the renderer
if (import.meta.main) {
  renderCandlestickGrid(sampleCandlestick, "10:00", "10:01");
} 