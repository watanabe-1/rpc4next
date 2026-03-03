import { describe, expect, it, suite } from "vitest";

it("forbidden at top-level", () => {
  expect(1 + 1).toBe(2);
});

describe("grouped tests", () => {
  it("allowed in describe", () => {
    expect(2 + 2).toBe(4);
  });
});

describe.each([1, 2])("table suite %d", (_n) => {
  it("allowed in describe.each", () => {
    expect(3 + 3).toBe(6);
  });
});

suite.only("alias suite", () => {
  it("allowed in suite.only", () => {
    expect(4 + 4).toBe(8);
  });
});
