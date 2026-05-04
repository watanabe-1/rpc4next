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
// app/api/users/[userId]/route.ts
import { procedure } from "rpc4next/server";
import { z } from "zod";
import { routeContract } from "./route-contract";

const paramsSchema = z.object({
  userId: z.string().min(1),
});

const querySchema = z.object({
  includePosts: z.enum(["true", "false"]).optional(),
});

export const GET = procedure
  .forRoute(routeContract)
  .meta({ summary: "Get a user", tags: ["users"] })
  .params(paramsSchema)
  .query(querySchema)
  .output({
    _output: {
      ok: true as const,
      userId: "" as string,
      includePosts: false as boolean,
    },
  })
  .handle(async ({ params, query }) => ({
    status: 200,
    body: {
      ok: true,
      userId: params.userId,
      includePosts: query.includePosts === "true",
    },
  }))
  .nextRoute({ method: "GET", onError });
export type Query = z.input<typeof querySchema>;
```

Notes:

- `procedure.handle(...).nextRoute(...)` is the default recommendation for new typed routes
- generated sibling `route-contract.ts` files are the recommended params source for procedure routes
- input contracts consume Standard Schema V1-compatible schemas directly
- route handlers must provide `onError`, either directly on `.nextRoute(...)` / `nextRoute(...)` or via a reusable preset such as `procedure.defaults({ onError })`
- shared presets such as `baseProcedure`, `procedure.defaults({ onError })`, and validator-stage customization all build on this path

`procedure` input contracts validate request input and return typed `400` JSON
errors by default when validation fails. If you need custom branching at the
validation stage, use `onValidationError(...)` on the relevant input contract.

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

For request headers and cookies:

```ts
const response = await rpc.api["request-meta"].$get({
  requestHeaders: {
    headers: { "x-integration-test": "example" },
    cookies: { session: "abc123" },
  },
});
```

### 5. Generate Typed URLs for Pages

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
- validator-stage customization with `onValidationError(...)`
- adaptation to App Router exports through terminal `procedure.handle(...).nextRoute({ method, onError })`
- standalone `nextRoute(procedure, { method, onError })` for shared base procedures or reused procedure values

Example:

```ts
import { procedure } from "rpc4next/server";
import { z } from "zod";
import { routeContract } from "./route-contract";

export const GET = procedure
  .forRoute(routeContract)
  .params(z.object({ userId: z.string().min(1) }))
  .query(
    z.object({
      includeDrafts: z.enum(["true", "false"]).optional(),
    }),
  )
  .output({
    _output: {
      ok: true as const,
      userId: "" as string,
      includeDrafts: false as boolean,
    },
  })
  .handle(async ({ params, query }) => ({
    status: 200,
    body: {
      ok: true,
      userId: params.userId,
      includeDrafts: query.includeDrafts === "true",
    },
  }))
  .nextRoute({ method: "GET", onError });
```

### Error Handling

`nextRoute()` requires `onError(error, context)`. For project-level reuse, prefer
`procedure.defaults({ onError })` and export a shared `appProcedure` or
similar preset from your project.

If you want client-side inference to preserve the concrete response shape returned
from `onError`, prefer `satisfies ProcedureOnError` over
`const onError: ProcedureOnError = ...`. A direct type annotation widens the
return type to the generic `ProcedureOnError` contract, while `satisfies`
checks the contract without discarding the specific `response.json(...)` /
`response.text(...)` result type.

```ts
import { isRpcError, nextRoute, procedure, type ProcedureOnError } from "rpc4next/server";
import { routeContract } from "./route-contract";

const failingProcedure = procedure.forRoute(routeContract).handle(async () => {
  throw new Error("expected failure");
});

const onError = ((error, { response }) => {
  if (error instanceof Response) {
    return error;
  }

  if (isRpcError(error)) {
    return response.json(error.toJSON(), { status: error.status });
  }

  const message = error instanceof Error ? error.message : "unknown integration error";

  return response.text(`handled:${message}`, { status: 500 });
}) satisfies ProcedureOnError;

const appProcedure = procedure.defaults({ onError });

export const GET = nextRoute(failingProcedure, {
  method: "GET",
  onError,
});

export const POST = appProcedure
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
5. Prefer `procedure` and `nextRoute()` for typed routes; keep plain Next.js handlers when you intentionally want broader response typing

## Repository Layout

- `packages/rpc4next`: runtime client and server helpers
- `packages/rpc4next-cli`: route scanner and type generator
- `packages/rpc4next-shared`: internal shared constants and types
- `integration/next-app`: real Next.js integration fixture

If you are evaluating the repository itself, `integration/next-app` is the best place to see the full flow working in a real app.

## License

MIT
