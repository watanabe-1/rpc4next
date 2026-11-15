import { describe, expect, it } from "vitest";

import { normalizeHeaders, normalizeResponseHeaders } from "./headers";

describe("normalizeHeaders", () => {
  it("should return an empty object if headers is undefined", () => {
    expect(normalizeHeaders()).toEqual({});
  });

  it("should return a null-prototype object", () => {
    const result = normalizeHeaders([
      ["__proto__", "polluted"],
      ["Constructor", "value"],
    ]);

    expect(Object.getPrototypeOf(result)).toBeNull();
    expect(result.__proto__).toBe("polluted");
    expect(result.constructor).toBe("value");
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

  it("keeps the last duplicate tuple value for request headers", () => {
    expect(
      normalizeHeaders([
        ["X-Test", "first"],
        ["x-test", "last"],
      ]),
    ).toEqual({
      "x-test": "last",
    });
  });
});

describe("normalizeResponseHeaders", () => {
  const cookies = [
    "session=abc; Path=/; Expires=Wed, 21 Oct 2037 07:28:00 GMT; HttpOnly",
    "theme=dark; Path=/; Expires=Thu, 22 Oct 2037 07:28:00 GMT",
  ];
  const tuples: [string, string][] = [
    ["Set-Cookie", cookies[0]],
    ["set-cookie", cookies[1]],
    ["X-Test", "first"],
    ["x-test", "last"],
  ];

  it.each(["Headers", "tuples"])("preserves separate cookies from %s", (format) => {
    const input = format === "Headers" ? new Headers(tuples) : tuples;
    const result = normalizeResponseHeaders(input);

    expect(result.getSetCookie()).toEqual(cookies);
    expect(result.get("x-test")).toBe(normalizeHeaders(input)["x-test"]);
    expect(input).toEqual(format === "Headers" ? new Headers(tuples) : tuples);
  });

  it("normalizes objects and missing headers", () => {
    expect([...normalizeResponseHeaders()]).toEqual([]);
    const result = normalizeResponseHeaders({ "Set-Cookie": cookies[0], "X-Test": "value" });
    expect(result.getSetCookie()).toEqual([cookies[0]]);
    expect(result.get("x-test")).toBe("value");
  });
});
