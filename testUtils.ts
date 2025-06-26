import { assertAlmostEquals, assertEquals } from "jsr:@std/assert";

export function assertEqualsWithFloatTolerance(
  actual: any,
  expected: any,
  tolerance: number = 1e-6,
  path: string = "",
): void {
  if (typeof actual === "number" && typeof expected === "number") {
    assertAlmostEquals(
      actual,
      expected,
      tolerance,
      `${path}: ${actual} ≈ ${expected}`,
    );
    return;
  }

  if (typeof actual !== typeof expected) {
    throw new Error(
      `${path}: Types don't match. Expected ${typeof expected}, got ${typeof actual}`,
    );
  }

  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (actual.length !== expected.length) {
      throw new Error(
        `${path}: Array lengths don't match. Expected ${expected.length}, got ${actual.length}`,
      );
    }
    actual.forEach((item, index) => {
      assertEqualsWithFloatTolerance(
        item,
        expected[index],
        tolerance,
        `${path}[${index}]`,
      );
    });
    return;
  }

  if (typeof actual === "object" && actual !== null && expected !== null) {
    const actualKeys = Object.keys(actual);
    const expectedKeys = Object.keys(expected);

    if (actualKeys.length !== expectedKeys.length) {
      throw new Error(
        `${path}: Object key counts don't match. Expected ${expectedKeys.length}, got ${actualKeys.length}`,
      );
    }

    expectedKeys.forEach((key) => {
      if (!(key in actual)) {
        throw new Error(`${path}: Missing key '${key}' in actual`);
      }
      assertEqualsWithFloatTolerance(
        actual[key],
        expected[key],
        tolerance,
        `${path}.${key}`,
      );
    });
    return;
  }

  assertEquals(actual, expected, path);
}
