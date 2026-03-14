"use client";

import { useState } from "react";
import { createRpcClient } from "rpc4next/client";
import type { PathStructure } from "../../src/generated/rpc";

const client = createRpcClient<PathStructure>("");

type ResultState = {
  users: string;
  posts: string;
  requestMeta: string;
  invalidUsers: string;
};

const initialResult: ResultState = {
  users: "idle",
  posts: "idle",
  requestMeta: "idle",
  invalidUsers: "idle",
};

const stringifyResponse = async (response: Response) => {
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  return JSON.stringify({
    ok: response.ok,
    status: response.status,
    body,
  });
};

export default function E2eClientPage() {
  const [result, setResult] = useState<ResultState>(initialResult);

  return (
    <main>
      <h1>rpc4next browser client e2e</h1>
      <button
        type="button"
        onClick={async () => {
          const response = await client.api.users._userId("browser-user").$get({
            url: { query: { includePosts: "true" } },
          });
          const payload = await stringifyResponse(response);

          setResult((current) => ({ ...current, users: payload }));
        }}
      >
        call users
      </button>
      <button
        type="button"
        onClick={async () => {
          const response = await client.api.posts.$post({
            body: { json: { title: "browser-title" } },
          });
          const payload = await stringifyResponse(response);

          setResult((current) => ({ ...current, posts: payload }));
        }}
      >
        call posts
      </button>
      <button
        type="button"
        onClick={async () => {
          await cookieStore.set({
            name: "session",
            value: "browser-session",
            path: "/",
          });

          const response = await client.api["request-meta"].$get({
            requestHeaders: {
              headers: { "x-integration-test": "browser-header" },
              cookies: { session: "browser-session" },
            },
          });
          const payload = await stringifyResponse(response);

          setResult((current) => ({ ...current, requestMeta: payload }));
        }}
      >
        call request-meta
      </button>
      <button
        type="button"
        onClick={async () => {
          const response = await client.api.users._userId("browser-user").$get({
            url: { query: { includePosts: "maybe" as unknown as "true" } },
          });
          const payload = await stringifyResponse(response);

          setResult((current) => ({ ...current, invalidUsers: payload }));
        }}
      >
        call invalid users
      </button>
      <pre data-testid="users-result">{result.users}</pre>
      <pre data-testid="posts-result">{result.posts}</pre>
      <pre data-testid="request-meta-result">{result.requestMeta}</pre>
      <pre data-testid="invalid-users-result">{result.invalidUsers}</pre>
    </main>
  );
}
