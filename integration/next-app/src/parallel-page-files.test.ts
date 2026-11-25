import { createRpcClient } from "rpc4next/client";
import { createRpcTestPageClient, createRpcTestPageFileClient } from "rpc4next/client/test";
import { describe, expect, expectTypeOf, it } from "vitest";

import type { PathStructure } from "./generated/rpc";
import { testPages } from "./generated/rpc-test-manifest";

const files = createRpcTestPageFileClient(testPages);
const team = files.page("../../app/patterns/parallel/@team/shared/page");
const analytics = files.page("../../app/patterns/parallel/@analytics/shared/page");
const client = createRpcClient<PathStructure>("http://localhost");

const checkPageTypes = () => {
  void team.$render({ query: { team: "members" } });
  void analytics.$render({ query: { period: "month" } });
  // @ts-expect-error The team page does not accept the analytics query.
  void team.$render({ query: { period: "month" } });
  // @ts-expect-error The analytics query is required.
  void analytics.$render();
  // @ts-expect-error The manifest does not contain this file.
  files.page("../../app/patterns/parallel/@missing/shared/page");
  void files.page("../../app/procedure-page-meta/page").$render({ query: { tab: "info" } });
  // @ts-expect-error Procedure-backed pages retain their query contract.
  void files.page("../../app/procedure-page-meta/page").$render({ query: { tab: "other" } });
  void files
    .page("../../app/patterns/catch-all/[...parts]/page")
    .$render({ params: { parts: ["a"] } });
  void files
    .page("../../app/patterns/catch-all/[...parts]/page")
    // @ts-expect-error Catch-all parameters must contain at least one value.
    .$render({ params: { parts: [] } });
  client.patterns.parallel.shared.$url({ query: { team: "members", period: "month" } });
  // @ts-expect-error Both pages' query contracts apply to the shared URL.
  client.patterns.parallel.shared.$url({ query: { team: "members" } });
  // @ts-expect-error The two view values cannot both be satisfied.
  client.patterns.parallel.conflict.$url({ query: { view: "team" } });
  expectTypeOf(team.$render({ query: { team: "members" } })).toEqualTypeOf<
    Promise<React.JSX.Element>
  >();
};
void checkPageTypes;

describe("parallel page file tests", () => {
  it("renders each generated page with its own query", async () => {
    await expect(team.$render({ query: { team: "members" } })).resolves.toMatchObject({
      props: { children: ["team:", "members"] },
    });
    await expect(analytics.$render({ query: { period: "month" } })).resolves.toMatchObject({
      props: { children: ["analytics:", "month"] },
    });
  });

  it("passes catch-all parameters and procedure request context", async () => {
    await expect(
      files.page("../../app/patterns/catch-all/[...parts]/page").$render({
        params: { parts: ["a/b", "c"] },
      }),
    ).resolves.toMatchObject({ props: { children: ["catch-all:", "a/b/c"] } });
    await expect(
      files.page("../../app/procedure-page-meta/page").$render({
        query: { tab: "info" },
        init: { headers: { "x-page-test-user": "alice", cookie: "session=abc" } },
      }),
    ).resolves.toMatchObject({ props: { children: "page-meta:alice:abc:info" } });
  });

  it("rejects ambiguous pathname dispatch", async () => {
    const pages = createRpcTestPageClient<PathStructure>(testPages);
    await expect(
      pages.patterns.parallel.shared.$render({ url: { query: { team: "x", period: "y" } } }),
    ).rejects.toThrow("Multiple rpc4next test pages matched");
  });
});
