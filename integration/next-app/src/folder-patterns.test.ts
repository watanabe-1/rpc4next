import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRpcClient } from "rpc4next/client";
import { describe, expect, it } from "vitest";

import { routeContract as escapedRouteContract } from "../app/patterns/%5Fescaped/route-contract";
import { routeContract as malformedRouteContract } from "../app/patterns/%E3%81%ZZ/route-contract";
import type { PathStructure } from "./generated/rpc";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const client = createRpcClient<PathStructure>("http://127.0.0.1:3000");

const fixturePaths = [
  "app/patterns/dynamic/[category]/page.tsx",
  "app/patterns/catch-all/[...parts]/page.tsx",
  "app/patterns/optional-catch-all/[[...parts]]/page.tsx",
  "app/patterns/(grouped)/reports/page.tsx",
  "app/patterns/parallel/default.tsx",
  "app/patterns/parallel/@analytics/views/page.tsx",
  "app/patterns/parallel/@team/members/page.tsx",
  "app/patterns/search/page.tsx",
  "app/patterns/native-query/page.tsx",
  "app/patterns/_private/ignored/page.tsx",
  "app/patterns/%5Fescaped/page.tsx",
  "app/patterns/%E3%81%ZZ/page.tsx",
  "app/feed/@modal/(..)photo/[id]/page.tsx",
  "app/feed/@drilldown/(..)photo/[id]/comments/[commentId]/page.tsx",
];

describe("integration next-app folder pattern coverage", () => {
  for (const fixturePath of fixturePaths) {
    it(`keeps fixture ${fixturePath}`, () => {
      expect(fs.existsSync(path.join(workspaceRoot, fixturePath))).toBe(true);
    });
  }

  it("excludes Next.js private folders from the generated client", () => {
    expect("_private" in client.patterns).toBe(false);
  });

  it("preserves escaped underscore folder keys in the generated client", () => {
    expect(client.patterns["%5Fescaped"].$url()).toEqual({
      path: "http://127.0.0.1:3000/patterns/_escaped",
      relativePath: "/patterns/_escaped",
      pathname: "/patterns/_escaped",
      params: {},
    });
  });

  it("preserves malformed encoded folder keys in the generated client", () => {
    expect(client.patterns["%E3%81%ZZ"].$url()).toEqual({
      path: "http://127.0.0.1:3000/patterns/%E3%81%ZZ",
      relativePath: "/patterns/%E3%81%ZZ",
      pathname: "/patterns/%E3%81%ZZ",
      params: {},
    });
  });

  it("normalizes generated route contract pathnames with the client pathname rules", () => {
    expect(escapedRouteContract.pathname).toBe("/patterns/_escaped");
    expect(malformedRouteContract.pathname).toBe("/patterns/%E3%81%ZZ");
  });

  it("excludes intercepting route variants from the generated client", () => {
    expect("@drilldown" in client.feed).toBe(false);
    expect("@modal" in client.feed).toBe(false);
    expect("(..)photo" in client.feed).toBe(false);
  });

  it("flattens parallel route descendants into public generated client keys", () => {
    expect("@analytics" in client.patterns.parallel).toBe(false);
    expect("@team" in client.patterns.parallel).toBe(false);
    expect(client.patterns.parallel.views.$url().relativePath).toBe("/patterns/parallel/views");
    expect(client.patterns.parallel.members.$url().relativePath).toBe("/patterns/parallel/members");
  });
});
