#!/usr/bin/env node

const { spawn } = require("node:child_process");
const path = require("node:path");

const args = process.argv.slice(2);
const isAllTests = args.includes("--all");
const testFile = args.find((arg) => !arg.startsWith("--"));

if (isAllTests) {
  // Run all tests
  const denoProcess = spawn(
    "deno",
    ["test", "--allow-read", "--inspect-brk=0.0.0.0:9229"],
    {
      stdio: "inherit",
      cwd: process.cwd(),
    }
  );

  denoProcess.on("close", (code) => {
    process.exit(code);
  });
} else if (testFile) {
  // Run specific test file
  const denoProcess = spawn(
    "deno",
    ["test", "--allow-read", "--inspect-brk=0.0.0.0:9229", testFile],
    {
      stdio: "inherit",
      cwd: process.cwd(),
    }
  );

  denoProcess.on("close", (code) => {
    process.exit(code);
  });
} else {
  console.error(
    "Usage: node deno-test-runner.js [test-file] or node deno-test-runner.js --all"
  );
  process.exit(1);
}
