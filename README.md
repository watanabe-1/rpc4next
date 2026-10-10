# rpc4next

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/watanabe-1/rpc4next)

`rpc4next` is a lightweight, type-safe RPC layer for Next.js App Router projects.
It scans your existing `app/**` files, generates a `PathStructure` type, and lets you call route handlers through a typed client without introducing a custom server framework.

It is inspired by Hono RPC and Pathpida:

- `route.ts` files become typed RPC endpoints
- `page.tsx` files become typed URL/path entries
- dynamic segments and exported route `Query` types are reflected in generated client types
- optional generated `route-contract.ts` files can give route files a stable sibling route contract

If you want to see a full working example, start with the real integration fixture in [integration/next-app/README.md](./integration/next-app/README.md). It shows how route scanning, generated types, the client, and a real Next.js app fit together in this repository.

## What It Covers

- Typed client calls for `app/**/route.ts`
- Typed URL generation for `app/**/page.tsx`
- Dynamic routes, catch-all routes, and optional catch-all routes
- Route groups and parallel-route descendants
- Validation helpers for `params`, `query`, `json`, `headers`, and `cookies`
- Plain Next.js route handlers written with `NextResponse.json(...)` or `Response.json(...)`

Routing notes:

- Route group folders do not appear in generated public paths
- Parallel route slot names are excluded, but their descendant pages are flattened onto public URL paths
- Intercepting route branches are excluded from `PathStructure` because rpc4next models public URL paths

This is a good fit if you want typed client calls and typed URLs from an existing App Router codebase without moving to a custom RPC server framework. If you already want to keep writing normal `route.ts` and `page.tsx` files, `rpc4next` is designed for that.

## Requirements

- Node.js `>=22.0.0`
- Next.js App Router
- Package peer dependency support in `rpc4next` and `rpc4next-cli`: Next.js `^15` or `^16`

## Installation

```bash
npm install rpc4next
npm install -D rpc4next-cli
```

If you use Bun in your project:

```bash
bun add rpc4next
bun add -d rpc4next-cli
```

`zod` is only needed if you use server-side schema validation such as
`procedure.query(...)` or `procedure.json(...)`. If you only use the generated
client types and do not validate request input, you can omit it.

If you want Zod-based request validation later:

```bash
npm install zod
```

## Quick Start

If you prefer to inspect a complete app before wiring this into your own project, see [integration/next-app/README.md](./integration/next-app/README.md).

### 1. Initialize rpc4next

Create the default config, generated client type file, browser client, and
shared route/page procedure presets:

```bash
npm install rpc4next
npm install -D rpc4next-cli
npx rpc4next init
npx rpc4next
```

If you use Bun:

```bash
bun add rpc4next
bun add -d rpc4next-cli
bunx rpc4next init
bunx rpc4next
```

`rpc4next init` creates:

- `rpc4next.config.json`
- `src/generated/rpc.ts`
- `src/lib/rpc-client.ts`
- `app/_rpc/errors.ts`
- `app/_rpc/route-procedure.ts`
- `app/_rpc/page-procedure.ts`

It does not overwrite existing files by default. Use `npx rpc4next init --dry-run`
to preview the files, or `npx rpc4next init --force` to overwrite existing init
files.

### 2. Define a Route

`rpc4next` can scan plain Next.js App Router handlers as-is, but the recommended
typed server authoring path is `procedure` with method terminal APIs such as
`.get()` and `.post()`. This keeps the route file as the source of truth while making input,
output, and reusable builder composition explicit. Optional `meta(...)` values
remain lightweight descriptive annotations rather than a policy system.

```ts
// app/_rpc/route-procedure.ts
import { createRouteProcedure, type ProcedureOnError } from "rpc4next/server";

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const onError = ((error, { response }) => {
  if (error instanceof Response) {
    return error;
  }

  console.error("[rpc4next] Unexpected procedure error", {
    message: getErrorMessage(error),
    error,
  });

  return response.error("INTERNAL_SERVER_ERROR", {
    message: "Internal server error",
  });
}) satisfies ProcedureOnError;

export const appRouteProcedure = createRouteProcedure({
  onError,
});
```

```ts
// app/api/users/[userId]/route.ts
import { z } from "zod";
import { appRouteProcedure } from "../../../_rpc/route-procedure";
import { routeContract } from "./route-contract";

const paramsSchema = z.object({
  userId: z.string().min(1),
});

const querySchema = z.object({
  includePosts: z.enum(["true", "false"]).optional(),
});

export const { GET } = appRouteProcedure
  .forRoute(routeContract)
  .meta({ summary: "Get a user", tags: ["users"] })
  .params(paramsSchema)
  .query(querySchema)
  .output<{
    ok: true;
    userId: string;
    includePosts: boolean;
  }>()
  .handle(async ({ params, query }) => ({
    status: 200,
    body: {
      ok: true,
      userId: params.userId,
      includePosts: query.includePosts === "true",
    },
  }))
  .get();
```

Notes:

- `procedure.handle(...).get()` / `.post()` / `.put()` / `.patch()` / `.delete()` / `.head()` is the default recommendation for new typed routes
- method terminals return an object keyed by the matching Next.js export name, such as `{ GET }` or `{ POST }`
- generated sibling `route-contract.ts` files are the recommended params source for procedure routes
- input contracts consume Standard Schema V1-compatible schemas directly
- route handlers receive project-level error handling from `createRouteProcedure({ onError })`; bare `procedure` routes still pass `onError` directly to method terminals
- choose `createRouteProcedure(...)` for route presets and `createPageProcedure(...)` for page presets; terminal `.page(...)` remains the page-render adapter
- route presets such as `appRouteProcedure`, guarded route presets such as `guardedRouteProcedure`, and validator-stage customization all build on this path

`procedure` input contracts validate request input and return typed `400` JSON
errors by default when validation fails. If you need custom branching at the
validation stage, use `onValidationError(...)` on the relevant input contract.
For known application errors that clients should branch on, return
`response.error(...)` from the procedure handler or middleware. Those returned
error responses are preserved in the generated client response union.

### 3. Generate `PathStructure`

After adding or changing routes, regenerate the client types:

```bash
npx rpc4next
```

If you use Bun:

```bash
bunx rpc4next
```

You can also generate manually by passing the source and output paths:

```bash
npx rpc4next app src/generated/rpc.ts
```

If you use Bun:

```bash
bunx rpc4next app src/generated/rpc.ts
```

You can also configure the CLI with `rpc4next.config.json`:

```json
{
  "baseDir": "app",
  "outputPath": "src/generated/rpc.ts",
  "paramsFile": "route-contract.ts"
}
```

When positional arguments are omitted, `rpc4next` reads the config file:

```bash
npx rpc4next
```

Or with Bun:

```bash
bunx rpc4next
```

Positional arguments:

- `<baseDir>`: the App Router root to scan, such as `app`
- `<outputPath>`: the file to generate, such as `src/generated/rpc.ts`

Useful options:

- `-w`, `--watch`: regenerate on file changes
- `-c`, `--check`: verify generated files are current without writing changes
- `-p`, `--params-file [filename]`: generate sibling route contract files such as `app/users/[userId]/route-contract.ts`

Examples:

```bash
npx rpc4next --watch
npx rpc4next app src/generated/rpc.ts --check
npx rpc4next app src/generated/rpc.ts --params-file route-contract.ts
```

The generated `PathStructure` includes the rpc4next client schema version used by
the CLI. If `rpc4next` and `rpc4next-cli` drift out of sync, TypeScript reports
the mismatch at `createRpcClient<PathStructure>(...)` so stale generated files do
not silently keep compiling.
Use `--check` in CI to fail when `src/generated/rpc.ts` or generated route
contract files are stale.
The CLI also writes a test-only route manifest next to the generated client type,
such as `src/generated/rpc-test-routes.ts` for `src/generated/rpc.ts`. This file
imports route handlers directly, so keep it in server-side test code and out of
browser client code.

### 4. Create a Client

```ts
// src/lib/rpc-client.ts
import { createRpcClient } from "rpc4next/client";
import type { PathStructure } from "../generated/rpc";

export const rpc = createRpcClient<PathStructure>("");
```

Use `""` for same-origin calls in the browser, or pass an absolute base URL for server-side or cross-origin usage.
When you call routes from a Server Component or another server-side runtime, derive
that absolute base URL from request headers or your deployment config before
creating the client:

```ts
import { headers } from "next/headers";
import { createRpcClient } from "rpc4next/client";
import type { PathStructure } from "../generated/rpc";

export const createServerRpcClient = async () => {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? "https";

  if (!host) {
    throw new Error("Missing host header");
  }

  return createRpcClient<PathStructure>(`${protocol}://${host}`);
};
```

For route-handler tests, use `createRpcTestClient` to call your exported
`GET`/`POST` functions directly. This keeps the generated typed client in the
test path without starting Next.js, MSW, or another mock HTTP server:

```ts
import { createRpcTestClient } from "rpc4next/client/test";
import type { PathStructure } from "../generated/rpc";
import { testRoutes } from "../generated/rpc-test-routes";

const rpc = createRpcTestClient<PathStructure>(testRoutes);

const response = await rpc.api.users._userId("123").$get();
```

The generated test route manifest is built from the same `app/**/route.ts`
scanner that produces `PathStructure`, so tests do not hand-pair arbitrary
handlers with arbitrary pathnames.

`createRpcTestClient` does not run the Next.js router, middleware, rewrites, or
runtime. It infers route params from the matched test route pathname by default,
so dynamic segments such as `[userId]` receive the value from the typed client
URL. Those params are test-only values inferred by rpc4next, not values produced
by the real Next.js runtime, so they can differ from what Next.js would provide
in an application.

The RPC client still builds the URL, request method, query string, headers,
cookies, and body; the test client dispatches that request to the matching
handler in-process.

### 5. Call Routes

Generated client naming follows the App Router path shape:

- static segments stay as property access, such as `rpc.api.users`
- dynamic segments become callable helpers, such as `[userId] -> ._userId("123")`
- `route.ts` methods become `$get()`, `$post()`, and so on
- `page.tsx` entries can be turned into typed URLs with `$url()`

```ts
const response = await rpc.api.users._userId("123").$get({
  url: { query: { includePosts: "true" } },
});

const data = await response.json();
```

For JSON request bodies:

```ts
const response = await rpc.api.posts.$post({
  body: { json: { title: "hello" } },
});
```

For multipart form data, validate field length, file size, file type, and
repeatable field counts in your schema:

```ts
const formDataSchema = z.object({
  displayName: z.string().min(1).max(80),
  avatar: z
    .instanceof(File)
    .refine((file) => file.size <= 2 * 1024 * 1024, "Avatar file is too large.")
    .refine((file) => ["image/png", "image/jpeg", "image/webp"].includes(file.type)),
  tags: z.array(z.string().min(1).max(40)).max(10).optional(),
});
```

Schema validation runs after the runtime reads and parses the request body. For
overall JSON or multipart body limits, configure your Next.js runtime, hosting
platform, reverse proxy, CDN, or middleware to reject oversized requests before
they reach the route handler.

Default validation error responses include the `BAD_REQUEST` code and message,
but do not expose raw schema issues in `details`. If your app needs shared
validation details, configure `createRouteProcedure({ onError, onValidationError })`
and explicitly choose a sanitized shape. A route-local
`onValidationError(...)` on a specific input contract can still override that
shared default for custom branches.

```ts
export const appRouteProcedure = createRouteProcedure({
  onError,
  onValidationError: ({ issues, response, target }) =>
    response.error("BAD_REQUEST", {
      message: "Validation failed.",
      details: {
        target,
        issues: issues.map(({ message, path }) => ({ message, path })),
      },
    }),
});
```

For page procedures, validation failures do not produce JSON error envelopes.
They flow through page rendering instead. Use
`createPageProcedure({ onError, onValidationError })` when you want shared
validation UI for pages, or keep using `onError` for the generic fallback.

### `rpc4next init` Layout

The `rpc4next init` default layout keeps generated files and shared procedure
foundations separate:

- `app/_rpc/errors.ts`
- `app/_rpc/route-procedure.ts`
- `app/_rpc/page-procedure.ts`
- `src/lib/rpc-client.ts`
- `src/generated/rpc.ts`
- `rpc4next.config.json`

When a project wants an authorization preset for route handlers, add
`app/_rpc/guarded-route-procedure.ts`. The `app/_rpc` directory is an App Router
private folder, so it can be imported by both `route.ts` and `page.tsx` without
creating public URL paths.

For request headers and cookies:

```ts
const response = await rpc.api["request-meta"].$get({
  requestHeaders: {
    headers: { "x-integration-test": "example" },
    cookies: { session: "abc123" },
  },
});
```

`requestHeaders.cookies` is part of the typed input contract. On the server, or
when you provide a non-browser `fetch`, rpc4next serializes it into the `Cookie`
header. In the browser, scripts cannot set the `Cookie` header directly, so
rpc4next omits that synthetic header and lets `fetch` send real browser cookies
instead. For cross-origin browser calls, pass the appropriate `credentials`
option, such as `{ init: { credentials: "include" } }`.

### 6. Handle Typed Responses

Client methods still return typed `Response` objects, so existing
`response.ok`, `response.status`, and `response.json()` narrowing continues to
work. This is the recommended path when UI code needs to branch on expected
application errors such as validation failures, authorization failures, or
business-rule conflicts:

```ts
const response = await rpc.api.users._userId("123").$get({
  url: { query: { includePosts: "true" } },
});

if (!response.ok) {
  const error = await response.json();

  switch (error.error.code) {
    case "BAD_REQUEST":
      showValidationMessage(error.error.message);
      break;
    case "UNAUTHORIZED":
      showSignInPrompt();
      break;
    case "INTERNAL_SERVER_ERROR":
      showRetryMessage();
      break;
  }

  return;
}

const body = await response.json();
renderUser(body);
```

When application code only needs the parsed success body and non-2xx responses
can follow the exception path, call `unwrap()` on the RPC response promise. It
returns the payload from the `ok: true` response branch and throws
`RpcResponseError` for non-2xx responses.

```ts
import { RpcResponseError } from "rpc4next/client";

try {
  const body = await rpc.api.users
    ._userId("123")
    .$get({
      url: { query: { includePosts: "true" } },
    })
    .unwrap();

  console.log(body);
} catch (error) {
  if (error instanceof RpcResponseError) {
    console.log(error.status);
    console.log(error.statusText);
    console.log(error.code);
    console.log(error.payload);
    console.log(error.response);
  }
}
```

`RpcResponseError.code` is populated when the response body is an rpc4next error
envelope returned by `response.error(...)`:

```ts
return response.error("FORBIDDEN", {
  message: "Editor role required.",
  details: { reason: "editor_only" as const },
});
```

TypeScript does not type thrown values from a `catch` block, so `unwrap()` is not
the primary API for fine-grained UI branching on known errors. Use the typed
`Response` path above when the UI needs exhaustive, endpoint-specific handling.

Non-JSON error bodies are also handled safely. `unwrap()` parses JSON when
possible, reads text responses for `text/*`, XML, and YAML media types, and
still throws `RpcResponseError` with `status`, `statusText`, and `response` if
the body is empty or cannot be read.

Responses with HTTP statuses that cannot include a body, such as `204`, `205`,
and `304`, unwrap to `undefined` regardless of their `Content-Type` header.

For file downloads, call `unwrapFile()` instead. It keeps the same error
handling behavior as `unwrap()`, but reads successful responses as `Blob`
payloads and includes response metadata for saving the file.

```ts
const file = await rpc.api.exports.$get().unwrapFile();

console.log(file.blob);
console.log(file.filename);
console.log(file.contentType);
```

### Reusable Client Types

The generated client is useful beyond the exact place where you call it.
`rpc4next/client` exports compact inference helpers so forms, service functions,
hooks, test data, and error UI can reuse the same request and response types
without spelling out `Parameters<typeof method>[0]` or `Awaited<ReturnType<...>>`.

Use `InferRpcRequestType` for generated method inputs:

```ts
import type { InferRpcRequestType } from "rpc4next/client";

type CreatePostInput = InferRpcRequestType<typeof client.api.posts.$post>;

export async function submitPost(input: CreatePostInput) {
  return client.api.posts.$post(input).unwrap();
}
```

Pass a target when you only need one part of the generated request shape:

```ts
import type { InferRpcRequestType } from "rpc4next/client";

type SearchQuery = InferRpcRequestType<typeof client.patterns.search.$url, "query">;
type CreatePostFormValues = InferRpcRequestType<typeof client.api.posts.$post, "json">;

const initialValues: CreatePostFormValues = {
  title: "",
};
```

Use `InferRpcResponseType` for success payloads. It accepts either a generated
method or a `RpcResponsePromise`:

```ts
import type { InferRpcResponseType } from "rpc4next/client";

type CreatedPost = InferRpcResponseType<typeof client.api.posts.$post>;
type UserPayload = InferRpcResponseType<ReturnType<typeof client.api.users._userId>["$get"]>;
```

For status-specific response handling, pass the status as the second generic.
By default this returns the parsed payload; pass `"response"` as the third
generic when you need the typed `Response` branch itself:

```ts
import type { InferRpcResponseType } from "rpc4next/client";

type CreatedPost = InferRpcResponseType<typeof client.api.posts.$post, 201>;
type CreatedPostResponse = InferRpcResponseType<typeof client.api.posts.$post, 201, "response">;
type PostErrorPayload = InferRpcResponseType<typeof client.api.posts.$post, "error">;
```

Error payload and code helpers let UI branches follow the endpoint definition,
including custom error catalogs:

```ts
import {
  matchRpcResponseError,
  RpcResponseError,
  type InferRpcErrorCode,
} from "rpc4next/client";

type GuardedErrorCode = InferRpcErrorCode<
  ReturnType<typeof client.api["procedure-guarded"]._userId>["$get"]
>;

async function loadGuarded(userId: string) {
  try {
    return await client.api["procedure-guarded"]._userId(userId).$get().unwrap();
  } catch (error) {
    if (error instanceof RpcResponseError) {
      return matchRpcResponseError(error, {
        FORBIDDEN: () => "Permission denied",
        BAD_REQUEST: () => "Invalid input",
        INTERNAL_SERVER_ERROR: () => "Server error",
      });
    }

    throw error;
  }
}
```

These types also compose with data-fetching libraries. For example, React Query
can own cache, loading, refetch, and error state, while rpc4next owns the type
safety for path params, query, request bodies, headers, cookies, and response
payloads:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InferRpcRequestType, InferRpcResponseType } from "rpc4next/client";

type UserPayload = InferRpcResponseType<ReturnType<typeof client.api.users._userId>["$get"]>;
type CreatePostInput = InferRpcRequestType<typeof client.api.posts.$post>;
type CreatePostPayload = InferRpcResponseType<typeof client.api.posts.$post>;

export function useUser(userId: string) {
  return useQuery<UserPayload>({
    queryKey: ["user", userId],
    queryFn: () => client.api.users._userId(userId).$get().unwrap(),
  });
}

export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation<CreatePostPayload, Error, CreatePostInput>({
    mutationFn: (input) => client.api.posts.$post(input).unwrap(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });
}
```

### 7. Generate Typed URLs for Pages

`page.tsx` files are included in the generated path tree, so you can build typed URLs even when there is no RPC method to call.

```ts
const photoUrl = rpc.photo._id("42").$url();

photoUrl.path;
photoUrl.relativePath;
photoUrl.pathname;
photoUrl.params;
```

## Server Helpers

### Route Procedures

`procedure` is the recommended typed server authoring API for new routes.

It supports:

- `forRoute(routeContract)` for generated route-contract binding
- direct schema contracts for `params`, `query`, `json`, `formData`, `headers`, and `cookies`
- `meta(...)` for lightweight descriptive annotations and `output(...)`
- shared presets via reusable route builders such as `guardedRouteProcedure`
- middleware through `.use(fn)`
- validator-stage customization with `onValidationError(...)`
- adaptation to App Router exports through terminal `export const { GET } = appRouteProcedure.handle(...).get()`
- method-specific terminal APIs: `.get(options?)`, `.post(options?)`, `.put(options?)`, `.patch(options?)`, `.delete(options?)`, and `.head(options?)`

Example:

```ts
import { z } from "zod";
import { appRouteProcedure } from "../../../_rpc/route-procedure";
import { routeContract } from "./route-contract";

export const { GET } = appRouteProcedure
  .forRoute(routeContract)
  .params(z.object({ userId: z.string().min(1) }))
  .query(
    z.object({
      includeDrafts: z.enum(["true", "false"]).optional(),
    }),
  )
  .output<{
    ok: true;
    userId: string;
    includeDrafts: boolean;
  }>()
  .handle(async ({ params, query }) => ({
    status: 200,
    body: {
      ok: true,
      userId: params.userId,
      includeDrafts: query.includeDrafts === "true",
    },
  }))
  .get();
```

For route procedures, prefer returning the `response` helpers when the exact
client response shape matters:

```ts
export const { GET } = appRouteProcedure
  .forRoute(routeContract)
  .query(z.object({ name: z.string().min(1) }))
  .handle(({ query, response }) => response.text(`hello:${query.name}`, { status: 202 }))
  .get();

export const { POST } = appRouteProcedure
  .forRoute(routeContract)
  .handle(({ response }) => response.redirect("/feed", 307))
  .post();
```

`response.json(...)`, `response.text(...)`, `response.body(...)`,
`response.redirect(...)`, and `response.error(...)` preserve more precise status,
content-type, and payload information than returning a raw `NextResponse` in
custom branches. Raw `NextResponse.json(...)` is still allowed, but its status and
content-type often stay broader in the generated client type.

### Page Procedures

`.page(render, options?)` adapts a route-bound procedure to a Next.js App Router
`page.tsx` default export. It is for validating page props and preparing typed
render data, not for returning HTTP responses.

```tsx
// app/photo/[id]/page.tsx
import { createPageProcedure } from "rpc4next/server";
import { z } from "zod";
import { routeContract } from "./route-contract";

const pageProcedure = createPageProcedure({
  onError: (error) => {
    throw error;
  },
});

const paramsSchema = z.object({
  id: z.string(),
});

const pageDataSchema = z.object({
  id: z.string(),
});

export default pageProcedure
  .forRoute(routeContract)
  .params(paramsSchema)
  .output(pageDataSchema)
  .handle(({ params }) => ({
    body: {
      id: params.id,
    },
  }))
  .page(({ data }) => <div>photo:{data.id}</div>, {
    validateOutput: true,
  });
```

For pages:

- supported input contracts are `params`, `query`, `headers`, and `cookies`
- `json` and `formData` are rejected because pages do not receive request bodies
- `.page(...)` receives validated `params` and `query` directly from the procedure pipeline
- if the page only needs validated URL input, `.handle()` is optional
- handlers are still useful for DB reads or render-time data preparation; their `ProcedureResult` body is passed to `.page(...)` as `data`
- `validateOutput: true` parses the body with `.output(schema)` before render
- raw `Response`, `response.error(...)`, and `{ redirect: ... }` results are rejected for page procedures; use Next.js `redirect()` / `notFound()` by throwing them from page code instead
- `page.redirect(...)` and `page.notFound()` do not return at runtime, but prefer `return page.redirect(...)` / `return page.notFound()` so the terminal branch is clear to TypeScript and readers

When no page-specific data fetch is needed, render from the validated query or
params directly:

```tsx
export default pageProcedure
  .forRoute(routeContract)
  .query(querySchema)
  .page(({ query }) => <Page initialMonth={query.month} />);
```

When the page needs work before render, return that data from `.handle()`:

```tsx
export default pageProcedure
  .forRoute(routeContract)
  .params(paramsSchema)
  .query(querySchema)
  .handle(async ({ params }) => ({
    body: {
      user: await getUser(params.id),
    },
  }))
  .page(({ data, params, query }) => <Page user={data.user} id={params.id} tab={query.tab} />);
```

If a page should have project-level error handling or shared page middleware,
start from `createPageProcedure(...)`:

```tsx
const pageProcedure = createPageProcedure({
  onError: (error) => {
    throw error;
  },
});

export default pageProcedure
  .forRoute(routeContract)
  .query(querySchema)
  .handle(({ page, query }) => {
    if (query.mode === "redirect") {
      return page.redirect("/feed");
    }

    if (query.mode === "not-found") {
      return page.notFound();
    }

    return {
      body: {
        mode: "render" as const,
      },
    };
  })
  .page(({ data }) => <div>{data.mode}</div>);
```

Method terminals are the HTTP adapter. `.page(...)` is the page-render adapter.
When `createRouteProcedure({ onError })` is used, later middleware and handlers
receive `response` helpers and the handled procedure exposes method terminals.
When `createPageProcedure({ onError })` is used, later middleware and handlers
receive `page.redirect(...)` and `page.notFound()`, and the handled procedure
exposes `.page(...)`. The un-defaulted `procedure` builder can still feed either
adapter, but app presets should choose the factory first.

### Middleware

Use `.use(fn)` to add middleware to the current builder. The middleware context
includes `request`, `ctx`, `response`, and any inputs already declared on the
builder, such as `params`, `query`, `json`, `formData`, `headers`, and
`cookies`.

```ts
const guardedProcedure = procedure
  .headers(z.object({ "x-demo-user": z.string().min(1) }))
  .use(({ headers }) => ({
    ctx: {
      viewerId: headers["x-demo-user"],
    },
  }))
  .handle(({ ctx }) => ({
    body: {
      viewerId: ctx.viewerId,
    },
  }));
```

Share middleware by exporting a base procedure builder with `.use(...)` already
applied. This keeps `headers`, `query`, `params`, and accumulated `ctx` typed
without writing `ProcedureMiddlewareContext<...>` by hand.

```ts
export const guardedRouteProcedure = appRouteProcedure
  .headers(
    z.object({
      "x-demo-user": z.string().min(1).optional(),
    }),
  )
  .use(({ headers, response }) => {
    const viewerId = headers["x-demo-user"];

    if (!viewerId) {
      return response.error("UNAUTHORIZED", {
        message: "Demo user header required.",
        details: { reason: "missing_demo_user" as const },
      });
    }

    return {
      ctx: {
        viewer: { id: viewerId },
      },
    };
  });
```

Then build route-specific procedures from that shared builder:

```ts
export const { GET } = guardedRouteProcedure
  .params(z.object({ userId: z.string().min(1) }))
  .handle(({ params, ctx }) => ({
    body: {
      userId: params.userId,
      viewerId: ctx.viewer.id,
    },
  }))
  .get();
```

Returning `{ ctx: ... }` from middleware adds that shape to later middleware and
the final handler. Returning `response.error(...)`, `response.json(...)`, or
another terminal response short-circuits execution and preserves that response in
the generated client response union.

Use shared procedure builders for checks that must run with the route itself,
such as assigning trace IDs, resolving the viewer or tenant, enforcing role or
plan rules, preparing request context, or logging structured request metadata.
Next.js Proxy or middleware can still handle broad early redirects, but
procedure middleware is the safer place for typed checks that need validated
headers, request-local context, or route-specific error unions.

### Error Handling

Known errors should be returned as responses. Use `response.error(code, init)`
inside a procedure handler or middleware when the client is expected to branch on
that error. Because this is a normal return value, rpc4next can preserve the
exact `code`, HTTP status, and `details` shape in the generated client response
type.

Unexpected failures should still be thrown as normal exceptions. Route method
terminals require `onError(error, context)` for that fallback path. For project-level
reuse, prefer `createRouteProcedure({ onError })` and export a shared
`appRouteProcedure` preset from `app/_rpc/route-procedure`.

Input validation adds a typed `BAD_REQUEST` response when validation fails.
Runtime output validation, when enabled, adds an `INTERNAL_SERVER_ERROR`
response. Other known error codes are only inferred when your handler or
middleware returns them.

```ts
import { createRouteProcedure, procedure, type ProcedureOnError } from "rpc4next/server";
import { routeContract } from "./route-contract";

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const onError = ((error, { response }) => {
  if (error instanceof Response) {
    return error;
  }

  console.error("[rpc4next] Unexpected procedure error", {
    message: getErrorMessage(error),
    error,
  });

  return response.error("INTERNAL_SERVER_ERROR", {
    message: "Internal server error",
  });
}) satisfies ProcedureOnError;

const appRouteProcedure = createRouteProcedure({
  onError,
});

const guardedProcedure = procedure.forRoute(routeContract).handle(async ({ response }) => {
  const allowed = false;

  if (!allowed) {
    return response.error("FORBIDDEN", {
      message: "Editor role required.",
      details: { reason: "editor_only" as const },
    });
  }

  return response.json({ ok: true as const });
});

export const { GET } = guardedProcedure.get({ onError });

export const { POST } = appRouteProcedure
  .forRoute(routeContract)
  .handle(async () => {
    throw new Error("expected failure");
  })
  .post();
```

## Plain Next.js Route Handlers Also Work

You can keep using native App Router handlers without adopting `procedure`.
This is useful when you want to stay close to stock Next.js APIs and only use `rpc4next` for route scanning and client generation.

Example with `NextResponse.json(...)`:

```ts
// app/api/next-native/[itemId]/route.ts
import { type NextRequest, NextResponse } from "next/server";

export type Query = {
  filter?: string;
};

export async function GET(request: NextRequest, context: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await context.params;
  const filter = request.nextUrl.searchParams.get("filter") ?? "all";

  return NextResponse.json({
    ok: true,
    itemId,
    filter,
  });
}
```

Example with `Response.json(...)`:

```ts
// app/api/next-native-response/route.ts
export async function GET() {
  return Response.json({
    ok: true,
    source: "response-json",
  });
}
```

The generated client can still call this route:

```ts
const response = await rpc.api["next-native"]
  ._itemId("item-1")
  .$get({ url: { query: { filter: "recent" } } });
```

You can also call a plain `Response.json(...)` route:

```ts
const response = await rpc.api["next-native-response"].$get();
```

For native handlers, route discovery and request typing still work, but response typing is naturally broader than when you return rpc4next's typed helpers.

See [integration/next-app/README.md](./integration/next-app/README.md) for the repository's full integration fixture coverage and route-pattern notes.

## Generated Files

When `paramsFile` is enabled, the CLI can generate sibling files such as:

```ts
// app/api/users/[userId]/route-contract.ts
export type Params = { userId: string };
export declare const routeContract: unknown;
```

That lets procedure routes import a generated `routeContract` and lets other
routes import the param shape instead of repeating it manually.
These generated `route-contract.ts` files are optional, and your generated `src/generated/rpc.ts` is typically not something you edit by hand.
`src/generated/rpc.ts` also carries the rpc4next client schema version, so
upgrading the runtime without regenerating types fails during type checking
instead of surfacing later in application code.

Your generated `src/generated/rpc.ts` exports a `PathStructure` type that includes:

- path entries from `page.tsx`
- callable HTTP methods from `route.ts`
- dynamic segment parameter types
- route `Query` exports where available

## Typical Workflow

1. Add or update files under `app/**`
2. Run `rpc4next` to regenerate `PathStructure`
3. Import `PathStructure` into your client
4. Call routes with `createRpcClient<PathStructure>(...)`
5. Prefer `procedure` with method terminals for typed routes and `.page()` for typed page render data; keep plain Next.js handlers when you intentionally want broader response typing

## Repository Layout

- `packages/rpc4next`: runtime client and server helpers
- `packages/rpc4next-cli`: route scanner and type generator
- `packages/rpc4next-shared`: internal shared constants and types
- `integration/next-app`: real Next.js integration fixture

If you are evaluating the repository itself, `integration/next-app` is the best place to see the full flow working in a real app.

## License

MIT
