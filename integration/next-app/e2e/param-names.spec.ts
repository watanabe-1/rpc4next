import { expect, test } from "@playwright/test";
import { createRpcClient } from "rpc4next/client";

import type { PathStructure } from "../src/generated/rpc";

const client = createRpcClient<PathStructure>("http://127.0.0.1:3100")["param-names"];

for (const { name, segment } of [
  { name: "id", segment: client.dynamic.plain["_id"] },
  { name: "_id", segment: client.dynamic.one["_%5Fid"] },
  { name: "__id", segment: client.dynamic.two["_%5F%5Fid"] },
  { name: "____id", segment: client.dynamic.four["_%5F%5F%5F%5Fid"] },
]) {
  test(`generated dynamic URL preserves ${name} in Next.js`, async ({ request }) => {
    const url = segment("a/b").$url();
    const response = await request.get(url.path);
    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toEqual(url.params);
  });
}

for (const { name, segment } of [
  { name: "id", segment: client.catch.plain["___id"] },
  { name: "_id", segment: client.catch.one["___%5Fid"] },
  { name: "__id", segment: client.catch.two["___%5F%5Fid"] },
  { name: "____id", segment: client.catch.four["___%5F%5F%5F%5Fid"] },
]) {
  test(`generated catch URL preserves ${name} in Next.js`, async ({ request }) => {
    const url = segment(["a/b", "c"]).$url();
    const response = await request.get(url.path);
    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toEqual(url.params);
  });
}

for (const { name, segment } of [
  { name: "id", segment: client.optional.plain["_____id"] },
  { name: "_id", segment: client.optional.one["_____%5Fid"] },
  { name: "__id", segment: client.optional.two["_____%5F%5Fid"] },
  { name: "____id", segment: client.optional.four["_____%5F%5F%5F%5Fid"] },
]) {
  test(`generated optional URL preserves ${name} in Next.js`, async ({ request }) => {
    const url = segment(["a/b", "c"]).$url();
    const response = await request.get(url.path);
    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toEqual(url.params);
    const omitted = await request.get(segment().$url().path);
    expect(omitted.status()).toBe(200);
    await expect(omitted.json()).resolves.toEqual({});
  });
}
