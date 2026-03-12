import { createRpcClient } from "rpc4next/client";
import type { PathStructure } from "../src/generated/rpc";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3000";
const client = createRpcClient<PathStructure>(baseUrl);

const userResponse = await client.api.users
  ._userId("smoke-user")
  .$get({ url: { query: { includePosts: "true" } } });

if (!userResponse.ok) {
  throw new Error(`GET /api/users/[userId] failed with ${userResponse.status}`);
}

const userJson = await userResponse.json();

if (userJson.userId !== "smoke-user" || userJson.includePosts !== true) {
  throw new Error(`Unexpected GET response: ${JSON.stringify(userJson)}`);
}

const postResponse = await client.api.posts.$post({
  body: { json: { title: "hello from smoke script" } },
});

if (postResponse.status !== 201) {
  throw new Error(`POST /api/posts failed with ${postResponse.status}`);
}

const postJson = await postResponse.json();

if (postJson.title !== "hello from smoke script") {
  throw new Error(`Unexpected POST response: ${JSON.stringify(postJson)}`);
}

console.log("Smoke test passed.");
