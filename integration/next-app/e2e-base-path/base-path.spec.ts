import { expect, test } from "@playwright/test";
import { createRpcClient } from "rpc4next/client";

import type { PathStructure } from "../src/generated/rpc";

test("basePath applies to RPC requests and Next.js navigation", async ({ page }) => {
  const client = createRpcClient<PathStructure>("http://127.0.0.1:3101/docs");
  const url = client.api.users._userId("demo-user").$url({ query: { includePosts: "true" } });
  expect(url.path).toBe("http://127.0.0.1:3101/docs/api/users/demo-user?includePosts=true");
  expect(url.relativePath).toBe("/api/users/demo-user?includePosts=true");
  expect(url.pathname).toBe("/api/users/[userId]");
  const response = await client.api.users._userId("demo-user").$get({
    url: { query: { includePosts: "true" } },
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ userId: "demo-user", includePosts: true });

  await page.goto("/docs");
  const link = page.getByRole("link", { name: "Open generated user" });
  await expect(link).toHaveAttribute("href", "/docs/users/demo-user");
  await link.click();
  await expect(page).toHaveURL(/\/docs\/users\/demo-user$/);
  await expect(page.getByText("grouped-user:demo-user")).toBeVisible();
});

test("rewrites serve aliases without changing generated URLs", async ({ request }) => {
  const client = createRpcClient<PathStructure>("http://127.0.0.1:3101/docs");
  expect(client.api.users._userId("demo-user").$url().path).toBe(
    "http://127.0.0.1:3101/docs/api/users/demo-user",
  );
  const response = await request.get("/docs/public-user/demo-user");
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ userId: "demo-user" });
});
