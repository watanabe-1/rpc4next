import path from "node:path";
import { createRpcClient } from "rpc4next/client";
import type { RpcEndpoint, RpcGeneratedPathStructure } from "rpc4next/client/generated";
import { procedure } from "rpc4next/server";
import { afterEach, describe, expect, it } from "vitest";

import {
  scanAppDirCache,
  visitedDirsCache,
} from "../../../packages/rpc4next-cli/src/cli/core/cache.js";
import { scanAppDir } from "../../../packages/rpc4next-cli/src/cli/core/route-scanner.js";
import {
  cleanupTempDir,
  makeTempDir,
  writeTree,
} from "../../../packages/rpc4next-cli/src/test-helpers/tmp-dir.js";
import { routeContract as unicodeContract } from "../app/static-encoding/%E6%97%A5%E6%9C%AC%E8%AA%9E/route-contract";
import { routeContract as percentContract } from "../app/static-encoding/100%25/route-contract";
import { routeContract as slashContract } from "../app/static-encoding/a%2Fb/route-contract";
import { routeContract as questionContract } from "../app/static-encoding/a%3Fb/route-contract";
import { routeContract as spaceContract } from "../app/static-encoding/a%20b/route-contract";
import { routeContract as hashContract } from "../app/static-encoding/a%23b/route-contract";
import { routeContract as encodedHashContract } from "../app/static-encoding/a%2523b/route-contract";

let tmpDir: string | undefined;

describe("scanned static route keys and generated URLs", () => {
  afterEach(() => {
    cleanupTempDir(tmpDir);
    tmpDir = undefined;
    scanAppDirCache.clear();
    visitedDirsCache.clear();
  });

  it.each([
    ["then", "%74hen", "then", "then"],
    ["$url", "%24url", "%24url", "$url"],
    ["$get", "%24get", "%24get", "$get"],
    ["$head", "%24head", "%24head", "$head"],
    ["$post", "%24post", "%24post", "$post"],
    ["$put", "%24put", "%24put", "$put"],
    ["$delete", "%24delete", "%24delete", "$delete"],
    ["$patch", "%24patch", "%24patch", "$patch"],
    ["$match", "%24match", "%24match", "$match"],
    ["$render", "%24render", "%24render", "$render"],
    ["%24url", "%24url", "%24url", "$url"],
    ["%2524url", "%2524url", "%2524url", "%24url"],
    ["$options", "$options", "%24options", "$options"],
    ["a%23b", "a#b", "a%23b", "a#b"],
    ["a%3Fb", "a?b", "a%3Fb", "a?b"],
    ["100%25", "100%", "100%25", "100%"],
    ["a%20b", "a b", "a%20b", "a b"],
    ["日本語", "日本語", "%E6%97%A5%E6%9C%AC%E8%AA%9E", "日本語"],
    ["%E6%97%A5%E6%9C%AC%E8%AA%9E", "日本語", "%E6%97%A5%E6%9C%AC%E8%AA%9E", "日本語"],
    ["a%2Fb", "a/b", "a%2Fb", "a/b"],
    ["a%2523b", "a%2523b", "a%2523b", "a%23b"],
    ["a%252Fb", "a%252Fb", "a%252Fb", "a%2Fb"],
    ["%5Fescaped", "%5Fescaped", "_escaped", "_escaped"],
    ["%E3%81%ZZ", "%E3%81%ZZ", "%E3%81%ZZ", "%E3%81%ZZ"],
    ["%E0%A4%A", "%E0%A4%A", "%E0%A4%A", "%E0%A4%A"],
  ])(
    "builds the URL from the scanned %s directory",
    (directory, expectedKey, encoded, pathname) => {
      tmpDir = makeTempDir();
      writeTree(tmpDir, {
        app: { [directory]: { "page.tsx": "export default function Page() {}" } },
      });

      const scan = scanAppDir(path.join(tmpDir, "rpc.ts"), path.join(tmpDir, "app"));
      const keys = [...scan.pathNode.children.keys()];
      expect(keys).toEqual([expectedKey]);
      expect(scan.pathStructure).toContain(`${JSON.stringify(expectedKey)}:`);
      expect(scan.paramsTypes[0].pathname).toBe(`/${encodeURIComponent(pathname)}`);

      const client = createRpcClient<RpcGeneratedPathStructure & Record<string, RpcEndpoint>>(
        "https://example.com",
      );
      const result = client[keys[0]].$url({ hash: "section" });
      expect(result).toEqual({
        path: `https://example.com/${encoded}#section`,
        relativePath: `/${encoded}#section`,
        pathname: `/${pathname}`,
        params: {},
      });
      const parsed = new URL(result.path);
      expect(parsed.pathname).toBe(`/${encoded}`);
      expect(parsed.search).toBe("");
      expect(parsed.hash).toBe("#section");
    },
  );
});

describe("generated static route contracts used by page procedures", () => {
  it.each([
    [questionContract, "a%3Fb"],
    [hashContract, "a%23b"],
    [percentContract, "100%25"],
    [spaceContract, "a%20b"],
    [unicodeContract, "%E6%97%A5%E6%9C%AC%E8%AA%9E"],
    [slashContract, "a%2Fb"],
    [encodedHashContract, "a%2523b"],
  ] as const)("constructs a request from %j", async (contract, encoded) => {
    const page = procedure
      .forRoute(contract)
      .handle(({ request }) => ({
        body: {
          pathname: request.nextUrl.pathname,
          searchParams: [...request.nextUrl.searchParams],
          hash: request.nextUrl.hash,
        },
      }))
      .page(({ data }) => data);

    expect(contract.pathname).toBe(`/static-encoding/${encoded}`);
    await expect(
      page({
        params: Promise.resolve({}),
        searchParams: Promise.resolve({ tag: ["a?b", "#日本語/%23"] }),
      }),
    ).resolves.toEqual({
      pathname: `/static-encoding/${encoded}`,
      searchParams: [
        ["tag", "a?b"],
        ["tag", "#日本語/%23"],
      ],
      hash: "",
    });
  });
});
