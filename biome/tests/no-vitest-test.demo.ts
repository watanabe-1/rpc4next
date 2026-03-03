import { expect, it, test } from "vitest";

it("allowed style", () => {
  expect(1 + 1).toBe(2);
});

test("forbidden style", () => {
  expect(2 + 2).toBe(4);
});
