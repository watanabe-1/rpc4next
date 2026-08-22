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

- Node.js `>=20.19.2`
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

### 1. Define a Route

`rpc4next` can scan plain Next.js App Router handlers as-is, but the recommended
typed server authoring path is `procedure` with terminal `.nextRoute(...)`
sugar. This keeps the route file as the source of truth while making input,
output, and reusable builder composition explicit. Optional `meta(...)` values
remain lightweight descriptive annotations rather than a policy system.

```ts
// app/api/_shared/procedure-defaults.ts
import { procedure, type ProcedureOnError } from "rpc4next/server";

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

export const appProcedure = procedure.defaults({
  route: {
    onError,
  },
});
```

```ts
// app/api/users/[userId]/route.ts
import { z } from "zod";
import { appProcedure } from "../_shared/procedure-defaults";
import { routeContract } from "./route-contract";

const paramsSchema = z.object({
  userId: z.string().min(1),
});

const querySchema = z.object({
  includePosts: z.enum(["true", "false"]).optional(),
});

export const { GET } = appProcedure
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
  .nextRoute({ method: "GET" });
```

Notes:

- `procedure.handle(...).nextRoute(...)` is the default recommendation for new typed routes
- `.nextRoute({ method })` returns an object keyed by the matching Next.js export name, such as `{ GET }` or `{ POST }`
- generated sibling `route-contract.ts` files are the recommended params source for procedure routes
- input contracts consume Standard Schema V1-compatible schemas directly
- route handlers can receive project-level error handling from a reusable preset such as `procedure.defaults({ route: { onError } })`; bare `procedure` routes still pass `onError` directly to `.nextRoute(...)` / `nextRoute(...)`
- route-specific presets expose route response helpers and terminal `.nextRoute(...)`; page-specific presets expose page helpers and terminal `.nextPage(...)`
- shared presets such as `baseProcedure`, `procedure.defaults({ route: { onError } })`, and validator-stage customization all build on this path

`procedure` input contracts validate request input and return typed `400` JSON
errors by default when validation fails. If you need custom branching at the
validation stage, use `onValidationError(...)` on the relevant input contract.
For known application errors that clients should branch on, return
`response.error(...)` from the procedure handler or middleware. Those returned
error responses are preserved in the generated client response union.

### 2. Generate `PathStructure`

Generate the client types from your `app` directory:

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

Then run:

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
- `-p`, `--params-file [filename]`: generate sibling route contract files such as `app/users/[userId]/route-contract.ts`

Examples:

```bash
npx rpc4next --watch
npx rpc4next app src/generated/rpc.ts --params-file route-contract.ts
```

### 3. Create a Client

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

### 4. Call Routes

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
validation details, configure `procedure.defaults({ route: { onValidationError }
})` and explicitly choose a sanitized shape. A route-local
`onValidationError(...)` on a specific input contract can still override that
shared default for custom branches.

```ts
export const appProcedure = procedure.defaults({
  route: {
    onError,
    onValidationError: ({ issues, response, target }) =>
      response.error("BAD_REQUEST", {
        message: "Validation failed.",
        details: {
          target,
          issues: issues.map(({ message, path }) => ({ message, path })),
        },
      }),
  },
});
```

For page procedures, validation failures do not produce JSON error envelopes.
They flow through page rendering instead. Use
`procedure.defaults({ page: { onValidationError } })` when you want shared
validation UI for pages, or keep using `page.onError` for the generic fallback.

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

### 5. Unwrap Typed Responses

Client methods still return typed `Response` objects, so existing
`response.ok`, `response.status`, and `response.json()` narrowing continues to
work:

```ts
const response = await rpc.api.users._userId("123").$get({
  url: { query: { includePosts: "true" } },
});

if (!response.ok) {
  const errorBody = await response.json();
  throw new Error(JSON.stringify(errorBody));
}

const body = await response.json();
```

When application code only needs the parsed success body, use `parseResponse`
from `rpc4next/client`. It returns the payload from the `ok: true` response
branch and throws `RpcResponseError` for non-2xx responses.

```ts
import { parseResponse, RpcResponseError } from "rpc4next/client";

try {
  const body = await parseResponse(
    rpc.api.users._userId("123").$get({
      url: { query: { includePosts: "true" } },
    }),
  );

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

Non-JSON error bodies are also handled safely. `parseResponse` parses JSON when
possible, falls back to text for non-JSON responses, and still throws
`RpcResponseError` with `status`, `statusText`, and `response` if the body is
empty or cannot be read.

### 6. Generate Typed URLs for Pages

`page.tsx` files are included in the generated path tree, so you can build typed URLs even when there is no RPC method to call.

```ts
const photoUrl = rpc.photo._id("42").$url();

photoUrl.path;
photoUrl.relativePath;
photoUrl.pathname;
photoUrl.params;
```

## Server Helpers

### `procedure` and `nextRoute`

`procedure` is the recommended typed server authoring API for new routes.

It supports:

- `forRoute(routeContract)` for generated route-contract binding
- direct schema contracts for `params`, `query`, `json`, `formData`, `headers`, and `cookies`
- `meta(...)` for lightweight descriptive annotations and `output(...)`
- shared presets via reusable builders such as `baseProcedure`
- middleware through `.use(fn)`
- validator-stage customization with `onValidationError(...)`
- adaptation to App Router exports through terminal `export const { GET } = appProcedure.handle(...).nextRoute({ method: "GET" })`
- standalone `nextRoute(procedure, { method, onError })` for shared base procedures or reused procedure values

Example:

```ts
import { z } from "zod";
import { appProcedure } from "../_shared/procedure-defaults";
import { routeContract } from "./route-contract";

export const { GET } = appProcedure
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
  .nextRoute({ method: "GET" });
```

For route procedures, prefer returning the `response` helpers when the exact
client response shape matters:

```ts
export const { GET } = appProcedure
  .forRoute(routeContract)
  .query(z.object({ name: z.string().min(1) }))
  .handle(({ query, response }) => response.text(`hello:${query.name}`, { status: 202 }))
  .nextRoute({ method: "GET" });

export const { POST } = appProcedure
  .forRoute(routeContract)
  .handle(({ response }) => response.redirect("/feed", 307))
  .nextRoute({ method: "POST" });
```

`response.json(...)`, `response.text(...)`, `response.body(...)`,
`response.redirect(...)`, and `response.error(...)` preserve more precise status,
content-type, and payload information than returning a raw `NextResponse` in
custom branches. Raw `NextResponse.json(...)` is still allowed, but its status and
content-type often stay broader in the generated client type.

### `procedure` and `nextPage`

`nextPage` adapts a route-bound procedure to a Next.js App Router `page.tsx`
default export. It is for validating page props and preparing typed render data,
not for returning HTTP responses.

```tsx
// app/photo/[id]/page.tsx
import { procedure } from "rpc4next/server";
import { z } from "zod";
import { routeContract } from "./route-contract";

const paramsSchema = z.object({
  id: z.string(),
});

const pageDataSchema = z.object({
  id: z.string(),
});

export default procedure
  .forRoute(routeContract)
  .params(paramsSchema)
  .output(pageDataSchema)
  .handle(({ params }) => ({
    body: {
      id: params.id,
    },
  }))
  .nextPage(({ data }) => <div>photo:{data.id}</div>, {
    validateOutput: true,
  });
```

For pages:

- supported input contracts are `params`, `query`, `headers`, and `cookies`
- `json` and `formData` are rejected because pages do not receive request bodies
- `nextPage` receives validated `params` and `query` directly from the procedure pipeline
- if the page only needs validated URL input, `.handle()` is optional
- handlers are still useful for DB reads or render-time data preparation; their `ProcedureResult` body is passed to `nextPage` as `data`
- `validateOutput: true` parses the body with `.output(schema)` before render
- raw `Response`, `response.error(...)`, and `{ redirect: ... }` results are rejected for page procedures; use Next.js `redirect()` / `notFound()` by throwing them from page code instead
- `page.redirect(...)` and `page.notFound()` do not return at runtime, but prefer `return page.redirect(...)` / `return page.notFound()` so the terminal branch is clear to TypeScript and readers

When no page-specific data fetch is needed, render from the validated query or
params directly:

```tsx
export default procedure
  .forRoute(routeContract)
  .query(querySchema)
  .nextPage(({ query }) => <Page initialMonth={query.month} />);
```

When the page needs work before render, return that data from `.handle()`:

```tsx
export default procedure
  .forRoute(routeContract)
  .params(paramsSchema)
  .query(querySchema)
  .handle(async ({ params }) => ({
    body: {
      user: await getUser(params.id),
    },
  }))
  .nextPage(({ data, params, query }) => <Page user={data.user} id={params.id} tab={query.tab} />);
```

If a page should have project-level error handling or shared page middleware,
use a page default:

```tsx
const pageProcedure = procedure.defaults({
  page: {
    onError: (error) => {
      throw error;
    },
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
  .nextPage(({ data }) => <div>{data.mode}</div>);
```

`nextRoute` remains the HTTP adapter. `nextPage` is the page-render adapter.
When `procedure.defaults({ route: { onError } })` is used, later middleware and
handlers receive `response` helpers and the handled procedure exposes
`.nextRoute(...)`. When `procedure.defaults({ page: { onError } })` is used,
later middleware and handlers receive `page.redirect(...)` and
`page.notFound()`, and the handled procedure exposes `.nextPage(...)`.
The un-defaulted `procedure` builder can still feed either adapter, but the
terminal adapter decides which inputs and return values are valid.

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
export const guardedBaseProcedure = appProcedure
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
export const { GET } = guardedBaseProcedure
  .params(z.object({ userId: z.string().min(1) }))
  .handle(({ params, ctx }) => ({
    body: {
      userId: params.userId,
      viewerId: ctx.viewer.id,
    },
  }))
  .nextRoute({ method: "GET" });
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

Unexpected failures should still be thrown as normal exceptions. `nextRoute()`
requires `onError(error, context)` for that fallback path. For project-level
reuse, prefer `procedure.defaults({ route: { onError } })` and export a shared
`appProcedure` or similar preset from your project.

Input validation adds a typed `BAD_REQUEST` response when validation fails.
Runtime output validation, when enabled, adds an `INTERNAL_SERVER_ERROR`
response. Other known error codes are only inferred when your handler or
middleware returns them.

```ts
import { nextRoute, procedure, type ProcedureOnError } from "rpc4next/server";
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

const appProcedure = procedure.defaults({
  route: {
    onError,
  },
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

export const { GET } = nextRoute(guardedProcedure, {
  method: "GET",
  onError,
});

export const { POST } = appProcedure
  .forRoute(routeContract)
  .handle(async () => {
    throw new Error("expected failure");
  })
  .nextRoute({
    method: "POST",
  });
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
5. Prefer `procedure` with `nextRoute()` for typed routes and `nextPage()` for typed page render data; keep plain Next.js handlers when you intentionally want broader response typing

## Repository Layout

- `packages/rpc4next`: runtime client and server helpers
- `packages/rpc4next-cli`: route scanner and type generator
- `packages/rpc4next-shared`: internal shared constants and types
- `integration/next-app`: real Next.js integration fixture

If you are evaluating the repository itself, `integration/next-app` is the best place to see the full flow working in a real app.

## License

MIT
