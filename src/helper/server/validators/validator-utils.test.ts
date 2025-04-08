import * as headersModule from "next/headers";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getHeadersObject, getCookiesObject } from "./validator-utils";

// Mock the next/headers module
vi.mock("next/headers", () => ({
  headers: vi.fn(),
  cookies: vi.fn(),
}));

// Helper to set up mock for headers
const setupHeadersMock = (entries: [string, string][]) => {
  vi.mocked(headersModule.headers).mockResolvedValue(
    // Return an object with only entries() and cast it as Headers type
    {
      entries: () => entries[Symbol.iterator](),
    } as unknown as Headers
  );
};

// Helper to set up mock for cookies
const setupCookiesMock = (cookies: { name: string; value: string }[]) => {
  vi.mocked(headersModule.cookies).mockResolvedValue(
    // Return an object with only getAll(), cast as RequestCookies & ResponseCookies type
    {
      getAll: () => cookies,
    } as unknown as Awaited<ReturnType<typeof headersModule.cookies>>
  );
};

describe("getHeadersObject – Pattern Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const cases: Array<{
    name: string;
    entries: [string, string][];
    expected: Record<string, string>;
  }> = [
    { name: "Empty header list", entries: [], expected: {} },
    {
      name: "Single header",
      entries: [["accept", "text/html"]],
      expected: { accept: "text/html" },
    },
    {
      name: "Multiple headers",
      entries: [
        ["content-type", "application/json"],
        ["x-test", "value"],
      ],
      expected: {
        "content-type": "application/json",
        "x-test": "value",
      },
    },
    {
      name: "Duplicate keys are overwritten by later value",
      entries: [
        ["x-dup", "first"],
        ["x-dup", "second"],
      ],
      expected: { "x-dup": "second" },
    },
  ];

  for (const { name, entries, expected } of cases) {
    it(name, async () => {
      setupHeadersMock(entries);
      const result = await getHeadersObject();
      expect(result).toEqual(expected);
    });
  }
});

describe("getCookiesObject – Pattern Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const cases: Array<{
    name: string;
    cookies: { name: string; value: string }[];
    expected: Record<string, string>;
  }> = [
    { name: "Empty cookie list", cookies: [], expected: {} },
    {
      name: "Single cookie",
      cookies: [{ name: "token", value: "xyz" }],
      expected: { token: "xyz" },
    },
    {
      name: "Multiple cookies",
      cookies: [
        { name: "a", value: "1" },
        { name: "b", value: "2" },
      ],
      expected: { a: "1", b: "2" },
    },
    {
      name: "Duplicate cookie names are overwritten by later value",
      cookies: [
        { name: "dup", value: "first" },
        { name: "dup", value: "second" },
      ],
      expected: { dup: "second" },
    },
  ];

  for (const { name, cookies, expected } of cases) {
    it(name, async () => {
      setupCookiesMock(cookies);
      const result = await getCookiesObject();
      expect(result).toEqual(expected);
    });
  }
});
