import { describe, expect, it } from "vitest";
import { normalizeHeaders } from "./headers";

describe("normalizeHeaders", () => {
  it("should return an empty object if headers is undefined", () => {
    expect(normalizeHeaders()).toEqual({});
  });

  it("should normalize Headers instance", () => {
    const headers = new Headers();
    headers.append("X-Test", "value");
    headers.append("Content-Type", "application/json");

    expect(normalizeHeaders(headers)).toEqual({
      "x-test": "value",
      "content-type": "application/json",
    });
  });

  it("should normalize array of tuples", () => {
    const headers: [string, string][] = [
      ["X-Test", "value"],
      ["Content-Type", "application/json"],
    ];

    expect(normalizeHeaders(headers)).toEqual({
      "x-test": "value",
      "content-type": "application/json",
    });
  });

  it("should normalize object", () => {
    const headers = {
      "X-Test": "value",
      "Content-Type": "application/json",
    };

    expect(normalizeHeaders(headers)).toEqual({
      "x-test": "value",
      "content-type": "application/json",
    });
  });

  it("should overwrite keys with same name but different case", () => {
    const headers = {
      "X-Test": "value1",
      "x-test": "value2",
    };

    expect(normalizeHeaders(headers)).toEqual({
      "x-test": "value2",
    });
  });
});
