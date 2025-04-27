import { describe, it, expect } from "vitest";
import { searchParamsToObject } from "./server-utils";

describe("searchParamsToObject", () => {
  it("should retrieve a single query parameter", () => {
    const params = new URLSearchParams("name=John");
    expect(searchParamsToObject(params)).toEqual({ name: "John" });
  });

  it("should retrieve multiple query parameters", () => {
    const params = new URLSearchParams("name=John&age=30");
    expect(searchParamsToObject(params)).toEqual({ name: "John", age: "30" });
  });

  it("should retrieve duplicate keys as arrays", () => {
    const params = new URLSearchParams("id=1&id=2&id=3");
    expect(searchParamsToObject(params)).toEqual({ id: ["1", "2", "3"] });
  });

  it("should retrieve mixed single and multiple parameters correctly", () => {
    const params = new URLSearchParams("id=1&id=2&page=5");
    expect(searchParamsToObject(params)).toEqual({ id: ["1", "2"], page: "5" });
  });

  it("should return an empty object when parameters are empty", () => {
    const params = new URLSearchParams("");
    expect(searchParamsToObject(params)).toEqual({});
  });
});
