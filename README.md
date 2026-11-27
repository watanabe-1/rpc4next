# rpc4next

<a href="https://deepwiki.com/watanabe-1/rpc4next">
  <picture>
    <source srcset="https://img.shields.io/badge/Ask-DeepWiki-blue">
    <img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki">
  </picture>
</a>

`rpc4next` is a lightweight, type-safe RPC layer for Next.js App Router projects.
It scans your existing `app/**` files, generates a `PathStructure` type, and lets you call route handlers through a typed client without introducing a custom server framework.
Think of it as a typed `fetch` replacement for your own App Router endpoints:
you still get familiar `Response` objects, `response.ok`, `response.status`,
and `response.json()`, but path params, query strings, request bodies, and
response payloads are inferred from your routes.

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

- Node.js `>=22.0.0` for the runtime library; `>=22.22.0` for `rpc4next-cli`
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

The CLI can also be invoked explicitly with Bun after installing it locally:

```bash
bun ./node_modules/rpc4next-cli/dist/index.js init
bun ./node_modules/rpc4next-cli/dist/index.js --check
```

`bunx rpc4next` respects the CLI's Node.js shebang and can run it on Node.js;
the explicit `bun` command above runs the CLI itself on Bun. CI targets Bun
1.1.0, 1.2.0, and the version in `aqua/aqua.yaml` on Linux, plus the aqua
version on Windows. The built CLI has been verified locally on Windows with Bun
1.1.0, 1.2.0, 1.3.9, and 1.4.4. Linux CI results are pending. These CLI checks do not establish support for running the
Next.js server on Bun.

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

<!-- rpc4next-init-template:start RPC_ERRORS -->

```ts
// app/_rpc/errors.ts
import { createRpcValidationErrorHandler, defineRpcErrors } from "rpc4next/server";
import type { InputTarget, RouteOnError, RouteValidationErrorHandler } from "rpc4next/server";

export const appRpcErrors = defineRpcErrors({});

export const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export const routeOnError = ((error, { response }) => {
  console.error("[rpc4next] Unexpected procedure error", {
    message: getErrorMessage(error),
    error,
  });

  return response.error("INTERNAL_SERVER_ERROR", {
    message: "Internal server error",
  });
}) satisfies RouteOnError<typeof appRpcErrors>;

export const routeOnValidationError = createRpcValidationErrorHandler<
  InputTarget,
  typeof appRpcErrors
>() satisfies RouteValidationErrorHandler<typeof appRpcErrors>;

export const pageOnError = () => {
  throw new Error("Unhandled rpc4next page procedure error.");
};
```

<!-- rpc4next-init-template:end RPC_ERRORS -->

<!-- rpc4next-init-template:start ROUTE_PROCEDURE -->

```ts
// app/_rpc/route-procedure.ts
import { createRouteProcedure } from "rpc4next/server";

import { appRpcErrors, routeOnError, routeOnValidationError } from "./errors";

export const appRouteProcedure = createRouteProcedure({
  errors: appRpcErrors,
  onError: routeOnError,
  onValidationError: routeOnValidationError,
});
```

<!-- rpc4next-init-template:end ROUTE_PROCEDURE -->

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
- route handlers receive project-level error and validation handling from `createRouteProcedure({ errors, onError, onValidationError })`; bare `procedure` routes still pass `onError` directly to method terminals
- choose `createRouteProcedure(...)` for route presets and `createPageProcedure(...)` for page presets; terminal `.page(...)` remains the page-render adapter
- route presets such as `appRouteProcedure`, guarded route presets such as `guardedRouteProcedure`, and validator-stage customization all build on this path

`procedure` input contracts validate request input and return typed `400` JSON
errors by default when validation fails. If you need custom branching at the
validation stage, use `onValidationError(...)` on the relevant input contract.
For known application errors that clients should branch on, return
`response.error(...)` from the procedure handler or middleware. Those returned
error responses are preserved in the generated client response union.

Pages use their own shared preset from `rpc4next init`. Keep route and page
procedures separate because they adapt to different Next.js surfaces: route
procedures expose HTTP response helpers and method terminals, while page
procedures expose page navigation helpers and terminate with `.page(...)`.

<!-- rpc4next-init-template:start PAGE_PROCEDURE -->

```ts
// app/_rpc/page-procedure.ts
import { createPageProcedure } from "rpc4next/server";

import { pageOnError } from "./errors";

export const appPageProcedure = createPageProcedure({
  onError: pageOnError,
});
```

<!-- rpc4next-init-template:end PAGE_PROCEDURE -->

```tsx
// app/photo/[id]/page.tsx
import { z } from "zod";

import { appPageProcedure } from "../../_rpc/page-procedure";
import { routeContract } from "./route-contract";

const paramsSchema = z.object({
  id: z.string().min(1),
});

export default appPageProcedure
  .forRoute(routeContract)
  .params(paramsSchema)
  .handle(async ({ params }) => ({
    body: {
      id: params.id,
    },
  }))
  .page(({ data }) => <div>photo:{data.id}</div>);
```

Use `appPageProcedure` for shared page defaults such as generic page error
handling, validation UI, or reusable page middleware. If a page only needs
validated `params` or `query`, `.handle(...)` is optional and `.page(...)` can
render directly from the validated inputs.

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
  "paramsFile": "route-contract.ts",
  "testManifestOutputPath": "src/generated/rpc-test-manifest.ts"
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

Generated schema version 2 escapes `_` as `%5F` and `%` as `%25` in parameter
names inside client keys. For example, `[__id]` uses `client["_%5F%5Fid"]("value")`;
`$url()` and `$match()` preserve the original `__id` name. Dynamic, catch-all,
and optional catch-all markers remain `_`, `___`, and `_____`. Names without
underscores or percent signs are unchanged. Upgrade
`rpc4next` and `rpc4next-cli` together, regenerate with `bunx rpc4next`, and
update calls using escaped keys. Version 1 output must be regenerated because
its keys cannot distinguish names such as `[__id]` and `[...id]`.

Dynamic route parameter values cannot be empty strings, `.` or `..`, including
individual catch-all and optional catch-all elements. These values cannot represent
the intended path segment after URL normalization, so URL construction throws an
error naming the parameter before a request is sent. Validate user input before
accessing `$url` or an HTTP method; for example, do not call `_id(id)` when `id`
is an empty form field. Optional catch-all parameters can be omitted or passed as
an empty array to omit the entire segment; an array containing an empty string is
invalid. TypeScript accepts these strings, so the check happens at runtime.

A static `then` segment uses the generated key `["%74hen"]`, at any depth:

```ts
rpc["%74hen"].$url(); // /then
rpc.nested["%74hen"].$url(); // /nested/then
rpcHelper["%74hen"].$match("/then");
```

The escape keeps RPC proxies from being mistaken for Promises by `await` or
`Promise.resolve`. Regenerate existing clients and update accesses to `then`;
other static keys are unchanged.
The CLI also writes a test-only manifest next to the generated client type,
such as `src/generated/rpc-test-manifest.ts` for `src/generated/rpc.ts`. This file
loads route handlers and pages directly, so keep it in server-side test code and out of
browser client code. Set `testManifestOutputPath` in `rpc4next.config.json` to
place that manifest somewhere else; when it is omitted, the CLI keeps deriving
the manifest path from `outputPath`.

#### Route Export Detection

The CLI parses `route.ts` with `oxc-parser` and detects the exported value names
`GET`, `HEAD`, `POST`, `PUT`, `DELETE`, and `PATCH`. `OPTIONS` is excluded from
generated client methods.

Supported forms include:

- Function declarations, such as `export async function GET(...)`
- Variable declarations, including type annotations and multiple bindings,
  such as `export const GET = ..., POST = ...`
- Destructuring, including the procedure form `export const { GET } = ...`,
  renamed properties, nested bindings, defaults, and rest bindings
- Export lists and aliases, such as `export { GET }` and `export { handler as POST }`
- Explicit named re-exports, such as `export { GET } from "./handler"`
  and `export { handler as POST } from "./handler"`

Detection uses the public name: `export { GET as POST }` detects only `POST`.
For destructuring, `export const { GET: handler, handler: POST } = ...` exports
`handler` and `POST`, so only `POST` is detected as an HTTP method.

Comments, string contents, and type-only exports are ignored. Local type aliases,
interfaces, and type-only imports are also excluded when exported through a list
without an explicit `type` modifier. A named default function alone, such as
`export default function GET(...)`, does not export an HTTP method by name.

Detection does not expand `export *` or follow imported and re-exported modules
to determine whether their bindings are types or values. Use explicit named
exports for handlers and `export type` or `export { type ... }` for external types.
The CLI warns when a `route.ts` in a generated public route uses a value `export *`, because handlers
may be missing from the generated client. Replace it with explicit exports such as
`export { GET, POST } from "./handler"`. Warnings do not change the exit status;
successful generation and `--check` do not guarantee that every route was detected.
Input files must have valid TypeScript or TSX syntax; syntax errors stop generation
and report the input filename.

### 4. Create a Client

```ts
// src/lib/rpc-client.ts
import { createRpcClient } from "rpc4next/client";

import type { PathStructure } from "../generated/rpc";

export const rpc = createRpcClient<PathStructure>("");
```

The default `managed` cookie mode uses the browser cookie store and does not accept cookie values as call arguments. Use `""` for same-origin calls in the browser, or pass an absolute base URL for server-side or cross-origin usage.
For server-side calls, configure an absolute origin in your deployment environment
(for example, `RPC_ORIGIN=https://example.com`) and use it to create the client:

```ts
import { createRpcClient } from "rpc4next/client";

import type { PathStructure } from "../generated/rpc";

export const createServerRpcClient = () => {
  const origin = process.env.RPC_ORIGIN;
  if (!origin) {
    throw new Error("Missing RPC_ORIGIN deployment configuration");
  }
  return createRpcClient<PathStructure>(origin);
};
```

Do not use request headers as the destination without establishing a trust boundary:
a trusted proxy must overwrite forwarding headers, and the resulting protocol and
host must be checked against an explicit allowlist before making the request.

#### Public URL prefixes and rewrites

The scanner derives routes from the `app` directory; it does not read Next.js
configuration or deployment proxy rules. Configure the client with the public
prefix needed to reach those routes:

| Deployment                         | Client configuration and scope                                                                                                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Same origin, no prefix             | Use `""` in the browser, or an absolute origin on the server.                                                                                                                        |
| Next.js `basePath: "/docs"`        | Use `"/docs"` in the browser, or `"https://example.com/docs"` on the server. Next.js `basePath` is a build-time setting.                                                             |
| Reverse proxy or hosting prefix    | Include the public prefix in `baseUrl`, such as `"https://example.com/service"`. The proxy must forward the resulting paths to the matching Next.js routes.                          |
| Rewrites or route-specific aliases | The scanner does not generate rewrite source paths or infer per-route mappings. Generated paths work only if the public endpoint accepts those paths; configure routing accordingly. |

`baseUrl` is concatenated with the generated route, after removing one trailing
slash. Use a base origin and optional path prefix without a query or fragment.
For `baseUrl = "https://example.com/docs"` and `app/users/[id]/page.tsx`:

```ts
const url = rpc.users._id("42").$url({ query: { tab: "profile" } });
// url.path:         "https://example.com/docs/users/42?tab=profile"
// url.relativePath: "/users/42?tab=profile"
// url.pathname:     "/users/[id]"
// url.params:       { id: "42" }
```

`path` includes `baseUrl`; `relativePath` excludes it and includes any query
and hash. `pathname` is the route pattern, not the resolved public URL. For a
plain anchor or browser navigation, use a URL containing the public prefix,
such as `path`. For Next.js `Link` or `router.push` within the same app, use
`relativePath` when Next.js itself applies `basePath`; passing an already
prefixed URL can add the prefix twice. An external proxy prefix unknown to
Next.js needs separate deployment-specific navigation handling. See the Next.js
[`basePath`](https://nextjs.org/docs/app/api-reference/config/next-config-js/basePath)
and [`rewrites`](https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites)
documentation.

For route-handler tests, use `createRpcTestClient` to call your exported
`GET`/`POST` functions directly. This keeps the generated typed client in the
test path without starting Next.js, MSW, or another mock HTTP server:

```ts
import { createRpcTestClient } from "rpc4next/client/test";

import type { PathStructure } from "../generated/rpc";
import { testRoutes } from "../generated/rpc-test-manifest";

const rpc = createRpcTestClient<PathStructure>(testRoutes);

const response = await rpc.api.users._userId("123").$get();
```

The generated test manifest is built from the same App Router scanner that
produces `PathStructure`, so tests do not hand-pair arbitrary handlers or pages
with arbitrary pathnames.

`createRpcTestClient` does not run the Next.js router, middleware, rewrites, or
runtime. It infers route params from the matched test route pathname by default,
so dynamic segments such as `[userId]` receive the value from the typed client
URL. Those params are test-only values inferred by rpc4next, not values produced
by the real Next.js runtime, so they can differ from what Next.js would provide
in an application.

The RPC client still builds the URL, request method, query string, headers,
cookies, and body; the test client dispatches that request to the matching
handler in-process.

Use these tests to check the behavior of the invoked handler, and test the
public request path separately. A passing test client call does not guarantee
that the same request reaches that handler in a deployed application.

| Concern                          | In-process typed tests                                                                                                      | Real server, browser, or deployment tests                                                                                        |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Authentication and authorization | Check missing, invalid, and valid credentials and the responses from the handler and its procedure `.use()` middleware.     | Check Next.js middleware or Proxy authentication, redirects, and protection of the intended routes through the real server.      |
| URL resolution                   | Check client-built paths and queries and the behavior of the matched handler. Route params are inferred by the test client. | Check Next.js route matching and params, `basePath`, rewrites, and access through the public URL.                                |
| Cookies                          | Check how the handler validates and responds to explicitly supplied cookies.                                                | In a browser, check cookie storage and sending, including `HttpOnly`, `Secure`, `SameSite`, credentials, and CORS as applicable. |
| Deployment                       | Check handler behavior under the test configuration.                                                                        | Smoke-test the deployed public URL, environment variables, prefixes, reverse proxy, and hosting configuration.                   |

Cover handler success and error cases with typed tests, then exercise critical
routes through a running Next.js server. Use a real browser for browser cookie
behavior, and verify deployment-specific routing against the deployed environment.

For page procedure tests, use `createRpcTestPageClient` with the generated
`PathStructure` and `testPages` manifest:

```ts
import { createRpcTestPageClient } from "rpc4next/client/test";

import type { PathStructure } from "../generated/rpc";
import { testPages } from "../generated/rpc-test-manifest";

const pages = createRpcTestPageClient<PathStructure>(testPages);

await pages.photo._id("photo-1").$render({
  url: { query: { tab: "comments" } },
  init: {
    headers: {
      "x-test-user": "alice",
      cookie: "session=abc",
    },
  },
});
```

This page helper supplies request headers and cookies only to rpc4next page
procedure `.headers()` / `.cookies()` validation. It does not recreate the full
Next.js request async context, so user code that imports and calls
`next/headers` directly is outside its guarantees.

When multiple pages share a pathname, such as pages in parallel route slots,
select the file with `createRpcTestPageFileClient`. The manifest retains each
page's own query and result types:

```ts
import { createRpcTestPageFileClient } from "rpc4next/client/test";

const pageFiles = createRpcTestPageFileClient(testPages);
await pageFiles.page("../../app/@team/settings/page").$render();
```

The file path is relative to the generated test manifest, without the extension.
Pass dynamic segments as `params` and query values as `query` to `$render()`.
The helper renders only that page; it does not render layouts or combine slots.
Use a Next.js integration test to verify the composed page.

The URL path structure combines query contracts for pages sharing a pathname.
The generated URL therefore requires values satisfying all of those contracts;
this can be stricter than a particular parallel-route navigation state.

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

The client method is deliberately fetch-like: awaiting it gives you a typed
`Response`, so existing `fetch` control flow maps directly to rpc4next.

For JSON request bodies:

```ts
const response = await rpc.api.posts.$post({
  body: { json: { title: "hello" } },
});
```

JSON bodies cross a serialization boundary. The client sends `JSON.stringify`
output and the server validates the parsed value against the schema's input
type. Define JSON schema inputs using values that survive this round trip: for
example, accept a date string and transform it to `Date` in the schema. Passing
a `Date` to a schema expecting `Date` sends a string and will fail validation.
Properties with `undefined` are omitted; array elements become `null`.

JSON response types describe the parsed value: for example, `Date` becomes a
string or `null` (for an invalid date). When an `.output(schema)` contract is declared,
output validation checks the
server-side value. A handler's `response.json(...)` call serializes immediately,
before validation checks that original value, so serialization can fail first.
JSON serialization can fail for values such as `bigint` or circular
references. Non-finite numbers become `null`, so a general `number` is inferred
as `number | null` in JSON responses.

For procedure routes, `.output(schema)` validates successful procedure
result bodies and values passed to rpc4next response helpers against the
`.output(schema)` contract. An absent body is validated as `undefined`; the
schema must accept it for an empty success response. Raw successful `Response`
or `NextResponse` objects cannot be validated and cause an output error; use
the rpc4next response helpers instead. Redirects and non-success responses are
not validated against the success output contract. Omit `.output(...)` to infer
response types without runtime output validation.
TypeScript checks returned procedure bodies against the schema's input type;
successful empty results require a schema input that accepts `undefined`.

When the output schema transforms values, the handler returns the schema's
input type and the client receives the parsed output type. Page renderers
likewise receive the parsed output. For example, a `z.string().transform(Number)`
schema accepts a string from the handler and produces a number for the client.
When a route output is validated, an explicit `Content-Length` is removed
because parsing may change the serialized response body.
Array element types also include `null` because sparse array slots serialize as
`null`. Mutable tuples are inferred as arrays of their possible element types,
since methods like `shift` and `pop` can change their length and order. Readonly
tuple inference assumes the value is not mutated through another reference.

For predictable response types, return plain objects with enumerable data
properties. TypeScript types do not describe property enumerability or whether
a property is inherited: class instances and getters can therefore serialize
differently from their inferred types. Convert them to plain objects explicitly
or define a `toJSON` method that returns a plain JSON value.
Boxed primitives and structurally similar objects cannot be distinguished by
TypeScript, so their inferred JSON types may include both representations.

For multipart form data, validate field length, file size, file type, and
repeatable field counts in your schema:

```ts
const optionalTags = z.preprocess(
  (value) => (value === undefined || Array.isArray(value) ? value : [value]),
  z.array(z.string().min(1).max(40)).max(10).optional(),
);

const formDataSchema = z.object({
  displayName: z.string().min(1).max(80),
  avatar: z
    .instanceof(File)
    .refine((file) => file.size <= 2 * 1024 * 1024, "Avatar file is too large.")
    .refine((file) => ["image/png", "image/jpeg", "image/webp"].includes(file.type)),
  tags: optionalTags,
});
```

Query parameters and form fields with one value are passed to the schema as a
scalar; repeated values are passed as an array. Missing fields are `undefined`.
Normalize repeatable fields in the schema as above, including query fields in
route and page procedures. An empty array sends no values, so it cannot be
distinguished from a missing field. Use a schema default if both should become
an empty array.

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
The hook also handles JSON and form-data body parsing failures. Its `kind` is
`"parse"` for those failures and `"validation"` for schema failures; only the
latter provides `value` and `issues`. Input-specific hooks take precedence over
the shared hook. If the selected hook returns no response, the default
`BAD_REQUEST` response is used. GET and HEAD body contract errors are not
passed to this hook.

```ts
export const appRouteProcedure = createRouteProcedure({
  onError,
  onValidationError: ({ issues, response, target }) =>
    response.error("BAD_REQUEST", {
      message: "Validation failed.",
      details: {
        target,
        issues: (issues ?? []).map(({ message, path }) => ({ message, path })),
      },
    }),
});
```

**Migration:** Route `onValidationError` handlers written before parse failures
were included must handle both `kind` values. Update both shared and input-local
handlers before upgrading: narrow `kind` before accessing `issues` or `value`,
or use an empty issue list for parse failures as in the example above. To keep
the previous default response for malformed bodies, return `undefined` when
`kind === "parse"` and handle schema failures as before. Without this change,
an existing handler that accesses `issues` may throw on malformed bodies; the
exception goes to `onError` and can produce a server error instead of a 400.
The context type change also requires existing TypeScript handlers to be updated.
Page validation handlers are unaffected.

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

For request headers and explicitly supplied server-side cookies, create a client with
`{ cookieMode: "explicit" }`:

```ts
const rpc = createRpcClient<PathStructure>(origin, { cookieMode: "explicit" });
const response = await rpc.api["request-meta"].$get({
  requestHeaders: {
    headers: { "x-integration-test": "example" },
    cookies: { session: "abc123" },
  },
});
```

In `explicit` mode, `requestHeaders.cookies` is part of the typed input contract
and is serialized into the `Cookie` header. Browser and browser Worker requests in this mode throw.
Server-side Workers can use explicit mode. Worker detection uses browser navigator properties,
so environments that imitate a browser Worker may also be treated as browsers.
The default `managed` mode uses cookies managed by the browser or a custom transport:

```ts
const rpc = createRpcClient<PathStructure>("", { cookieMode: "managed" });
const response = await rpc.api["request-meta"].$get({
  requestHeaders: { headers: { "x-integration-test": "example" } },
});
```

Managed mode removes cookie values from typed RPC call arguments and rejects them at runtime;
it does not set or verify cookies. A custom `fetch` receives any Cookie header configured through
request init, including in browsers; the native browser `fetch` uses the cookie
store instead. Server-issued
`HttpOnly` cookies are available to requests without exposing their values to
JavaScript. For cross-origin browser calls, set appropriate credentials, for
example `{ cookieMode: "managed", init: { credentials: "include" } }`; cookie
attributes, browser policy, and CORS also affect whether cookies are sent.
For server-side requests, managed mode does not automatically forward incoming cookies;
use explicit mode when passing them as call arguments. The server still validates received
cookies and may reject a request when they are missing or invalid.
When `cookieMode` is only known at runtime, the returned client has a union of
both modes; narrow the option before creating the client when mode-specific call
types are needed. The in-process `createRpcTestClient` supports the same modes.

**Migration:** The default cookie mode changed from `explicit` to `managed`.
For server-side clients that pass `requestHeaders.cookies`, set
`{ cookieMode: "explicit" }` when creating the client (including test clients).
In browser clients, remove cookie arguments and let the browser manage cookies.
Existing JavaScript and compiled clients that still pass cookie arguments in managed
mode now throw before sending a request, rather than silently dropping them.

### 6. Handle Typed Responses

Client methods still return typed, fetch-compatible `Response` objects. Await
`$get()`, `$post()`, and the other method terminals just like `fetch`, then
branch with `response.ok`, `response.status`, and `response.json()`. This is the
recommended path when UI code needs to handle expected application errors such
as validation failures, authorization failures, or business-rule conflicts:

```ts
const response = await rpc.api.users._userId("123").$get({
  url: { query: { includePosts: "true" } },
});

if (response.status === 400) {
  const error = await response.json();
  showValidationMessage(error.error.message);
  return;
}

if (response.status === 401) {
  showSignInPrompt();
  return;
}

if (!response.ok) {
  const error = await response.json();
  showRetryMessage(error.error.message);
  return;
}

const body = await response.json();
renderUser(body);
```

You can call `response.json()` without an `ok` branch. That is valid and does
not produce a compile error, but the payload type is the full success/error
union for that endpoint:

```ts
const response = await rpc.api.users._userId("123").$get();
const body = await response.json();
// body is the success/error response body union.
```

When you want to treat the result as the success payload, narrow the response
first with `response.ok` or a status check, then call `response.json()` in that
branch.

For downloads, read the body and headers using the standard `Response` API:

```ts
const response = await rpc.api.exports.$get();
if (!response.ok) throw new Error(`Download failed: ${response.status}`);
const blob = await response.blob();
const contentDisposition = response.headers.get("content-disposition");
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
  return client.api.posts.$post(input);
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
method or its response promise:

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

Error payload and code helpers can be used with typed `Response` branches,
including custom error catalogs:

```ts
import type { InferRpcErrorCode, InferRpcResponseType } from "rpc4next/client";

type GuardedGet = ReturnType<typeof client.api["procedure-guarded"]._userId>["$get"];
type GuardedErrorCode = InferRpcErrorCode<GuardedGet>;
type GuardedForbidden = InferRpcResponseType<GuardedGet, 403>;

async function loadGuarded(userId: string) {
  const response = await client.api["procedure-guarded"]._userId(userId).$get();

  if (response.status === 403) {
    const error: GuardedForbidden = await response.json();
    return error.error.message;
  }

  if (!response.ok) {
    const error = await response.json();
    return error.error.code satisfies GuardedErrorCode;
  }

  return response.json();
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
    queryFn: async () => {
      const response = await client.api.users._userId(userId).$get();
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      return response.json();
    },
  });
}

export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation<CreatePostPayload, Error, CreatePostInput>({
    mutationFn: async (input) => {
      const response = await client.api.posts.$post(input);
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      return response.json();
    },
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

For route matching outside the generated client, use
`createRpcHelper<PathStructure>()` from `rpc4next/client/helper`. It is useful in
tests, analytics, navigation state, or middleware-like code that already has a
concrete pathname and needs the generated params shape:

```ts
import { createRpcHelper } from "rpc4next/client/helper";

import type { PathStructure } from "./generated/rpc";

const rpcHelper = createRpcHelper<PathStructure>();
const match = rpcHelper.photo._id.$match("/photo/42");

if (match) {
  match.params.id;
}
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

`response.json({ ok: true })` preserves the top-level boolean literal as
`true` in the inferred response type. String and number properties generally
infer as `string` and `number`; use `as const` when a literal value must be
preserved for response discrimination.

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
  .page(({ data }) => <div>photo:{data.id}</div>);
```

For pages:

- supported input contracts are `params`, `query`, `headers`, and `cookies`
- `json` and `formData` are rejected because pages do not receive request bodies
- `.page(...)` receives validated `params` and `query` directly from the procedure pipeline; declare `.params(...)` or `.query(...)` for each value the render callback needs. Without the corresponding contract, its runtime value is `undefined`.
- if the page only needs validated URL input, `.handle()` is optional
- pages with `.output(schema)` must declare `.handle()` before `.page()`; the schema validates the handler's data before rendering
- handlers are still useful for DB reads or render-time data preparation; their `ProcedureResult` body is passed to `.page(...)` as `data`
- `.output(schema)` parses the body before render
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

Input contracts and middleware execute in the order they are declared. A middleware
can use inputs declared before it; later input contracts run only after that
middleware succeeds. For authenticated routes, declare authentication before
`.json(...)` or `.formData(...)` so unauthorized requests are rejected before
reading or validating the body. In route procedures, authentication can read raw
headers or cookies from `request`, and must validate those values before trusting
them.

This order also applies to shared procedure builders and page procedures.

When composing a procedure object directly, input contracts or middleware added
after the builder's recorded steps execute after those steps. Added input
contracts execute before added middleware, in the order `params`, `query`,
`json`, `formData`, `headers`, `cookies`.

If page middleware returns a result to render, later middleware and the handler
are skipped, but any remaining `params` and `query` contracts are validated
before rendering. A validation failure is handled instead of rendering.

Page procedures receive a synthetic `request` containing the URL, not the
incoming headers or cookies. For page authentication, declare `.headers(...)`
or `.cookies(...)` before the authentication middleware and use the validated
values it receives. For example:

```tsx
const guardedPage = createPageProcedure({ onError })
  .cookies(z.object({ session: z.string().optional() }))
  .use(async ({ cookies, page }) => {
    const viewer = await authenticateSession(cookies.session);
    if (!viewer) return page.redirect("/login");
    return { ctx: { viewer } };
  });
```

`authenticateSession` is application-defined and must reject missing, malformed,
or invalid credentials. The cookie contract is validated before authentication;
other input contracts can be declared after the middleware.

For example, put a shared authentication middleware before a route's body contract:

```ts
const guarded = appRouteProcedure.use(async ({ request, response }) => {
  const viewer = await authenticate(request.headers.get("authorization"));
  if (!viewer) return response.error("UNAUTHORIZED");
  return { ctx: { viewer } };
});

const createPost = guarded
  .json(postSchema)
  .handle(({ json, ctx }) => ({ body: { title: json.title, author: ctx.viewer.id } }));
```

`authenticate` and `postSchema` are application-defined. The middleware must
handle missing or malformed credentials as well as invalid tokens.

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
An output schema adds an `INTERNAL_SERVER_ERROR`
response. Other known error codes are only inferred when your handler or
middleware returns them.

```ts
import { createRouteProcedure, procedure, type RouteOnError } from "rpc4next/server";

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
}) satisfies RouteOnError;

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
For precise inferred response types, use a procedure and its `response` helpers.

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
