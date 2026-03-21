# Procedure Design for rpc4next

## Status

- Draft
- Intended audience: maintainers of `rpc4next` and Codex-based implementation work
- Scope: `packages/rpc4next`, `packages/rpc4next-cli`, and `integration/next-app`
- Current implementation status:
  - Phases 1 through 8 are implemented
  - `procedure` and `nextRoute` are available publicly
  - procedure input contracts are executed through Standard Schema V1-compatible validators
  - the integration fixture includes a shared `baseProcedure` preset under `integration/next-app/app/api/_shared/base-procedure.ts`
  - shared guarded procedures can declare multiple error variants and opt into runtime output validation

## Background

`rpc4next` currently has two strong characteristics:

1. It uses Next.js App Router files under `app/**` as the source of truth for route shape.
2. It derives client-side RPC types from exported route handler function types.

The current server authoring experience is centered on `routeHandlerFactory()` and `RouteContext`. This is productive, but it is visually and conceptually close to Hono:

- middleware chain style handler composition
- validator middleware that stores validated input on the request context
- response helpers on a route-local context object
- optional error handler passed to the factory

That overlap is acceptable, but it should not become the primary identity of `rpc4next`. The differentiator is not "a Hono-like server DSL for Next.js". The differentiator is "a contract layer for Next.js App Router that can generate typed RPC clients from real route files".

This document proposes a staged evolution toward a `procedure`-oriented design while preserving the current architecture and minimizing breakage.

## Goals

- Keep `app/**` files as the route source of truth.
- Preserve the current type inference model based on exported route types.
- Introduce `procedure`-style contract building inspired by tRPC, without adopting tRPC's router-first model.
- Add route metadata and output contracts in a way that is useful to the generator and client.
- Standardize server error shape for client ergonomics.
- Keep migration cost low for existing `routeHandlerFactory()` users.
- Make implementation safe for Codex to perform incrementally.

## Non-goals

- Replacing Next.js routing with a custom router.
- Recreating Hono's full app/router/middleware ecosystem.
- Converting `rpc4next` into JSON-RPC or GraphQL.
- Requiring all users to rewrite existing route files immediately.
- Adding broad OpenAPI generation in the first phase.

## Design principles

### 1. File-route-first, not router-first

The file system remains authoritative. A route contract should attach to a route file, not to a manually assembled global router.

### 2. HTTP-aware contracts

Unlike tRPC, `rpc4next` should keep HTTP method, status, headers, redirects, and Next-native response behavior visible.

### 3. Transport adapter boundary

Procedure contracts should be framework-agnostic enough to be adapted into Next route handlers, but the initial implementation only needs a Next adapter.

### 4. Compatibility before purity

The initial implementation should coexist with `routeHandlerFactory()`. Internals may move toward `procedure`, but the public migration should be gradual.

### 5. Generator-first metadata

If new type information cannot be consumed by the CLI or client, it should not be introduced unless it clearly improves authoring ergonomics.

## Problems in the current design

### Public API is close to Hono

`routeHandlerFactory().get(zValidator(...), async (rc) => rc.json(...))` is structurally similar to Hono's middleware and context model.

### Contract information is spread across multiple concepts

- route params are inferred from file paths
- query/body/header/cookie contracts come from validator middleware
- response shape is inferred indirectly from `TypedNextResponse`
- metadata such as auth or cache policy has no first-class place

### Overloads are costly

`MethodRouteDefinition` currently relies on multiple overloads to model middleware composition. This is workable but hard to extend for metadata and output contracts.

### Error handling is flexible but under-standardized

`onError` can return any typed response, but client code cannot rely on a shared machine-readable error envelope.

## Proposed model

Introduce a first-class `procedure` contract builder with a Next adapter.

### High-level shape

```ts
const getUser = procedure
  .meta({ tags: ["users"], auth: "optional" })
  .params(paramsSchema)
  .query(querySchema)
  .output(userResponseSchema)
  .use(authMiddleware)
  .handle(async ({ params, query, request, ctx }) => {
    return {
      status: 200,
      body: {
        ok: true,
        userId: params.userId,
        includePosts: query.includePosts ?? false,
      },
    };
  });

export const GET = nextRoute(getUser);
```

This keeps route files and HTTP methods explicit while moving contract assembly into a builder.

### Validator direction

`procedure.params()`, `.query()`, `.json()`, `.headers()`, and `.cookies()` should accept schema objects directly rather than requiring rpc4next-specific validator wrappers.

The runtime contract for those schemas should follow Standard Schema V1. In practice this means:

- application code can pass supported validator schemas directly
- `rpc4next` should read validation input/output types from the schema where possible
- `nextRoute()` should execute validation through the schema's Standard Schema interface instead of validator-specific duck typing

This keeps the authoring style simple:

```ts
const getUser = procedure
  .params(z.object({ userId: z.string().min(1) }))
  .query(
    z.object({
      includePosts: z.enum(["true", "false"]).optional(),
    }),
  )
  .handle(async ({ params, query }) => {
    return {
      body: {
        userId: params.userId,
        includePosts: query.includePosts === "true",
      },
    };
  });
```

And it avoids coupling the public procedure API to a specific validator library or to rpc4next-owned adapter values.

## Sources of inspiration

### tRPC

Adopt:

- builder style contract composition
- first-class `meta`
- a clear split between contract construction and execution

Do not adopt:

- router-first architecture
- transport abstraction that hides HTTP semantics
- query/mutation naming as the primary route abstraction

### Hono

Adopt:

- composable middleware mindset
- ergonomic route-local context where useful

Do not adopt:

- app/router as the primary abstraction
- deep context variable API as a major feature direction

### ts-rest / Connect / gRPC

Adopt:

- stronger output and error contracts
- clear transport boundaries

Do not adopt:

- heavyweight protocol requirements
- centralized schema registry as the only authoring model

## Proposed public API

## Core concepts

### `procedure`

A builder that accumulates contract information and produces a typed procedure definition.

Initial target capabilities:

- `.meta(meta)`
- `.params(schema)`
- `.query(schema)`
- `.json(schema)`
- `.headers(schema)`
- `.cookies(schema)`
- `.output(schema)`
- `.use(middleware)`
- `.handle(handler)`

Input contract methods should accept Standard Schema V1-compatible schema values directly.

### `nextRoute(procedure)`

A Next adapter that converts a procedure into a route handler compatible with `export const GET`, `POST`, and other supported HTTP method exports.

### `defineError`

Optional helper to create a standardized error envelope.

Example:

```ts
throw rpcError("UNAUTHORIZED", {
  message: "Sign-in required",
  status: 401,
});
```

### `meta`

Route metadata should be typed but extensible.

Initial recommended shape:

```ts
type RpcMeta = {
  summary?: string;
  tags?: string[];
  auth?: "required" | "optional" | "none";
  cache?: "default" | "no-store" | "force-cache";
  idempotent?: boolean;
  deprecated?: boolean;
};
```

This should remain open to user extension later.

## Handler model

The handler should receive normalized validated input instead of relying only on `rc.req.valid(...)`.

```ts
type ProcedureHandlerContext = {
  request: NextRequest;
  params: TParams;
  query: TQuery;
  json: TJson;
  headers: THeaders;
  cookies: TCookies;
  ctx: TContext;
};
```

The returned value should support either:

1. a normalized procedure result object, or
2. a raw `Response`/`NextResponse` for escape hatches

Normalized result shape:

```ts
type ProcedureResult<TBody> = {
  status?: HttpStatusCode;
  headers?: HeadersInit;
  body?: TBody;
  redirect?: string;
};
```

The Next adapter converts this into `TypedNextResponse` when possible.

## Error model

Introduce a common client-visible error envelope:

```ts
type RpcErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNPROCESSABLE_CONTENT"
  | "TOO_MANY_REQUESTS"
  | "INTERNAL_SERVER_ERROR";

type RpcErrorEnvelope = {
  error: {
    code: RpcErrorCode;
    message: string;
    details?: unknown;
  };
};
```

Design rules:

- user code may still return custom responses
- the default error path should produce a standard envelope
- client helpers may inspect `error.code` without parsing ad hoc payloads

## Output contract

`output(schema)` is intended to solve two problems:

1. make response shape explicit as part of the route contract
2. allow future validation or generator-side documentation work

Rules:

- `output(schema)` describes the successful body payload
- it should not prohibit manual `Response` returns, but those may degrade inferred precision
- in the first phase, output schema may be type-level only
- runtime output validation should be optional and disabled by default

## Compatibility strategy

This work should not begin with a hard cutover.

### Existing API remains supported

The following should continue to work:

```ts
const createRouteHandler = routeHandlerFactory();

export const { GET } = createRouteHandler<{
  params: Params;
  query: Query;
}>().get(zValidator("query", querySchema), async (rc) => {
  return rc.json({ ok: true });
});
```

### Optional bridge from old API to new internals

`routeHandlerFactory()` may eventually be implemented on top of internal procedure primitives, but that is an implementation detail.

### Type compatibility target

Generated client types should continue to work for:

- existing `routeHandlerFactory()` routes
- plain Next route handlers
- new `procedure`-based routes

## Validator compatibility strategy

The `procedure` API should not introduce an rpc4next-specific validator abstraction as a required public concept.

Instead:

- `routeHandlerFactory()` may continue to use middleware-oriented validators such as `zValidator(...)`
- `procedure` should accept schema values directly
- runtime validation for `procedure` should depend on Standard Schema V1 compatibility

This is intentionally close to the direction used by Hono's Standard Schema integration: validator libraries remain external, while the framework consumes a shared schema contract.

## Alternatives considered

### Alternative A: Expand `routeHandlerFactory()` only

Add `.meta()` and `.output()` directly to the existing builder and stop there.

Pros:

- minimal migration cost
- fewer new concepts

Cons:

- overload complexity grows further
- contract assembly remains harder to reason about
- long-term design stays constrained by middleware-first typing

Decision:

- useful as a short-term compatibility layer
- not preferred as the final conceptual model

### Alternative B: Use standalone exported metadata objects only

Example:

```ts
export const rpc = defineRpcMeta({
  query: querySchema,
  output: userSchema,
  tags: ["users"],
});
```

Pros:

- generator-friendly
- minimal runtime change

Cons:

- contract and handler drift apart easily
- validation and metadata become duplicated

Decision:

- acceptable as a fallback, not as the primary design

## Suggested implementation phases

## Phase 0: internal groundwork

Scope:

- audit existing server and client type dependencies
- identify the minimum internal contract representation
- avoid user-facing breakage

Deliverables:

- internal `ProcedureDefinition` types
- tests proving current `routeHandlerFactory()` types still work

Target files:

- `packages/rpc4next/src/rpc/server/route-types.ts`
- `packages/rpc4next/src/rpc/server/types.ts`
- new internal files under `packages/rpc4next/src/rpc/server/`

## Phase 1: metadata and error envelope

Scope:

- add typed metadata support
- add standard error envelope helpers
- preserve current public API

Deliverables:

- `RpcMeta` types
- `rpcError` helper
- route-level error typing that can surface the error envelope to clients

Why first:

- highest value with low migration risk
- useful to both existing and future APIs

## Phase 2: output contracts

Scope:

- add type-level `output(schema)` support
- thread output contract through generated client types

Deliverables:

- output schema typing
- generated client inference using explicit output contracts when present
- fixture coverage in `integration/next-app`

Why second:

- strengthens the contract model without requiring a new authoring style

## Phase 3: first-class `procedure` and `nextRoute`

Scope:

- introduce public `procedure`
- introduce `nextRoute(procedure)`

Deliverables:

- builder API
- Next adapter
- tests for params, query, json, headers, cookies, metadata, and error flow
- procedure input contract execution based on Standard Schema V1-compatible schemas

Why third:

- this is the biggest API addition
- it should land after metadata and output types already exist

## Phase 4: bridge `routeHandlerFactory()` onto shared internals

Scope:

- reduce duplication by sharing internal execution/typing machinery

Deliverables:

- refactor, not a user-visible rewrite
- compatibility tests

Why fourth:

- do it only after `procedure` semantics stabilize

Current status:

- phase 4 internals are partially shared
- `routeHandlerFactory()` still exists as a separate public authoring style
- validator middleware behavior for `routeHandlerFactory()` remains unchanged

## Phase 5: shared `baseProcedure` presets

Scope:

- make `procedure` practical as a reusable policy layer, not only as a route-local builder
- allow applications to define shared builder presets and extend them in route files

Deliverables:

- documentation and fixture coverage for extracting common builders such as `baseProcedure`
- explicit guidance that builder chaining is immutable and safe to reuse across routes
- examples of shared headers/cookies validation, shared metadata, shared auth context, and shared middleware

Target authoring shape:

```ts
// app/api/_shared/base-procedure.ts
export const baseProcedure = procedure
  .headers(commonHeadersSchema)
  .meta({ auth: "required" })
  .use(authMiddleware);

// app/api/users/[userId]/route.ts
const getUser = baseProcedure
  .params(paramsSchema)
  .output(userSchema)
  .handle(({ params, ctx }) => {
    return {
      status: 200,
      body: {
        userId: params.userId,
        viewerId: ctx.viewer.id,
      },
    };
  });
```

Why fifth:

- this is the first point where `procedure` starts expressing the project's stronger value proposition
- it supports "forced-by-default" behavior such as validation, auth, and context setup without introducing a global router
- it can be delivered mostly as semantics, examples, and fixture proof before new API surface is added

Notes:

- the existing builder already supports this pattern structurally because each chain returns a new builder
- phase 5 is about making that pattern explicit, recommended, and tested
- the integration fixture now demonstrates this with `app/api/_shared/base-procedure.ts` extended by `app/api/procedure-guarded/[userId]/route.ts`

## Phase 6: richer error contracts for shared policies

Scope:

- improve how shared procedures declare and enforce standardized error behavior
- support multiple known error variants without collapsing everything into one route-local `rpcError` convention

Deliverables:

- decide whether `procedure.error(...)` remains singular or grows into a multi-error API such as `errors([...])`
- preserve typed error envelopes when errors are introduced by shared middleware
- fixture coverage for shared auth/authorization procedures that can surface common error envelopes

Current fixture coverage:

- `integration/next-app/app/api/_shared/base-procedure.ts` now declares shared `UNAUTHORIZED` and `FORBIDDEN` contracts on the guarded preset itself
- `integration/next-app/app/api/procedure-guarded/[userId]/route.ts` extends that preset with route-local params/query/output plus an additional `FORBIDDEN` variant for `editor_only`
- `integration/next-app/src/rpc-types.test.ts` and `integration/next-app/src/server-routes.test.ts` cover that the route type and generated client inference retain the shared and route-local error envelopes together

Why sixth:

- shared `baseProcedure` becomes much more valuable once common failures can also be declared contractually
- current single-error shape is sufficient for initial routes but weak for reusable policy presets

Notes:

- this phase should focus on contract expression first
- runtime normalization can continue to use `rpcError(...)` internally as long as the exported route type remains precise

## Phase 7: runtime output enforcement for procedure responses

Scope:

- close the gap between type-level output contracts and runtime behavior
- make "forced-by-default" response shaping possible for teams that want stricter guarantees

Deliverables:

- optional runtime output validation in `nextRoute()`
- clear failure behavior for invalid handler output, likely normalized as internal server error or explicit contract error
- docs that distinguish type-only output contracts from runtime-enforced output contracts

Why seventh:

- input validation is already enforced at runtime, but output validation is still primarily descriptive
- shared procedures become more trustworthy when they can validate both ingress and egress

Notes:

- output validation should remain opt-in initially to avoid unexpected runtime cost
- phase 7 should not block the simpler phase 5 shared preset pattern
- recommended initial API: `nextRoute(procedure, { method: "GET", validateOutput: true })`
- when enabled, runtime enforcement should apply to successful `ProcedureResult.body` payloads produced by the procedure pipeline
- raw `Response` / `NextResponse`, redirects, and empty-body results should remain escape hatches and skip output validation
- invalid runtime output should normalize through `rpcError("INTERNAL_SERVER_ERROR", ...)` so failure behavior stays explicit and machine-readable

## Phase 8: CLI-generated server route contracts and bound procedures

Scope:

- make CLI-generated route shape available to server-side `procedure` authoring without depending on client-oriented generated types
- force route files to bind a generated route contract before completing a `procedure`
- require `params` validation whenever the bound route contract says params exist
- reject `params` schemas whose type-level output fails to cover the generated route params contract

Deliverables:

- generated server-side companion contract output for route files, preferably via each route directory's generated `route-contract.ts`
- a branded route contract value such as `routeContract` that route files import from generated output rather than reconstructing structurally
- a binding API on `procedure` or shared presets, such as `baseProcedure.forRoute(routeContract)`, that carries generated route expectations into the builder
- type constraints that prevent calling `.handle()` for params-bearing routes unless `.params(schema)` has been provided
- type constraints on `.params(schema)` that reject schemas whose output does not cover the generated params type
- fixture coverage proving route files must import generated contracts and that shared `baseProcedure` presets compose correctly with route-local binding

Target authoring shape:

```ts
// app/api/procedure-guarded/[userId]/route-contract.ts
declare const routeContractBrand: unique symbol;

export type Params = { userId: string };

export type RouteContract = {
  pathname: "/api/procedure-guarded/[userId]";
  params: Params;
  [routeContractBrand]: true;
};

export declare const routeContract: RouteContract;

// app/api/procedure-guarded/[userId]/route.ts
import { routeContract } from "./params";

const getGuardedProcedureUser = guardedBaseProcedure
  .forRoute(routeContract)
  .params(paramsSchema)
  .query(querySchema)
  .output(outputSchema)
  .handle(async ({ params, query, ctx }) => {
    return {
      status: 200,
      body: {
        ok: true,
        userId: params.userId,
        includeDrafts: query.includeDrafts === "true",
        role: ctx.viewer.role,
        source: "procedure-guarded",
        requestId: ctx.requestId,
      },
    };
  });

export const GET = nextRoute(getGuardedProcedureUser, {
  method: "GET",
  validateOutput: true,
});
```

Why eighth:

- route files already know they are extending a shared preset, so the most ergonomic time to attach generated route constraints is before `.params(...)` and `.handle(...)`
- pushing route binding into `nextRoute()` would surface errors too late in the authoring flow
- requiring a generated branded value is stronger than requiring a generic type argument because it avoids easy structural re-creation by hand
- this phase strengthens the "file-route-first" identity by making server procedures consume CLI knowledge derived from the route file system itself

Notes:

- `generated/rpc.ts` should remain client-oriented and should not become the server binding source because route files importing it would create awkward dependency cycles
- the preferred source of server route contracts is the generated `app/**/route-contract.ts` companion file, extended to include a branded `routeContract` export in addition to the existing `Params` type
- `forRoute(routeContract)` should produce a route-bound builder; `nextRoute()` may optionally be narrowed later to only accept route-bound procedures
- initial type enforcement should focus on "params schema is required" and "schema output covers generated params"; strict exactness for extra keys can remain a follow-up if validator interoperability makes it worthwhile
- the same pattern may later be extended to generated query or body contracts, but phase 8 should focus on route params first

## Phase 9: multipart/form-data procedure contracts

Scope:

- add first-class request contract support for `multipart/form-data` and other `FormData`-backed submissions
- make validated form fields available to `procedure.handle(...)` without requiring manual `request.formData()` parsing in every route
- preserve the current `procedure` mental model where input contracts are declared before execution and validated by `nextRoute()`

Deliverables:

- a new `procedure.formData(schema)` input contract method
- a `formData` property on the procedure handler context alongside `params`, `query`, `json`, `headers`, and `cookies`
- runtime extraction in `nextRoute()` via `request.formData()`
- normalization from `FormData` into a validator-friendly plain object shape before Standard Schema validation
- type and runtime constraints that reject ambiguous body contract combinations such as `.json(...)` together with `.formData(...)`
- fixture coverage for scalar form fields, repeated keys, and uploaded `File` values

Target authoring shape:

```ts
const uploadAvatar = procedure
  .forRoute(routeContract)
  .formData(
    z.object({
      displayName: z.string().min(1),
      avatar: z.instanceof(File),
      tags: z.array(z.string()).optional(),
    }),
  )
  .output(uploadAvatarResponseSchema)
  .handle(async ({ formData, ctx }) => {
    return {
      status: 200,
      body: {
        ok: true,
        displayName: formData.displayName,
        filename: formData.avatar.name,
        tags: formData.tags ?? [],
        uploaderId: ctx.viewer.id,
      },
    };
  });

export const POST = nextRoute(uploadAvatar, {
  method: "POST",
  validateOutput: true,
});
```

Why ninth:

- multipart form submission is a common App Router workflow for file uploads and browser-native forms, and it currently falls outside the first-class `procedure` contract surface
- forcing routes to call `request.formData()` manually weakens the value proposition of `procedure` as the single place where validated input is declared
- adding `formData` keeps the API symmetric with existing validated inputs while preserving the file-route-first design

Notes:

- `procedure.formData(schema)` should be mutually exclusive with `.json(schema)` because both consume the request body
- `GET` and `HEAD` procedures should reject `formData` contracts for the same reason they reject JSON body contracts
- the normalization step should preserve `File` instances and collapse repeated field names into arrays so validator schemas can describe uploads and multi-select form fields naturally
- the initial phase should focus on server-side authoring and validation; generator and client ergonomics for multipart requests can remain a follow-up
- validator expectations should stay Standard Schema V1-compatible at the public boundary even if the internal `FormData` normalization logic is rpc4next-specific

## Phase 10: optional client ergonomics

Possible items:

- TanStack Query helpers
- richer docs generation
- optional OpenAPI emission

These should remain out of scope until the core contract model is stable.

## Detailed implementation order for Codex

This section is intentionally written as a sequence of small, reviewable Codex tasks.

### Step 1

Create internal contract types without exporting them publicly.

Expected work:

- add internal `ProcedureDefinition`
- add internal `ProcedureInputContract`
- add internal `ProcedureOutputContract`
- add tests only for type composition primitives

Validation:

- `bun run test`
- `bun run lint`
- `bun run typecheck`

### Step 2

Add standard error helpers and envelope typing.

Expected work:

- create `rpcError` and error envelope types
- add default error serialization path
- keep `routeHandlerFactory(onError)` behavior intact

Validation:

- root test/lint/typecheck
- targeted server tests for typed error responses

### Step 3

Add metadata typing.

Expected work:

- define `RpcMeta`
- allow metadata attachment on internal definitions
- expose metadata to the generator shape where possible

Validation:

- root test/lint/typecheck
- generated fixture diff review if generator output changes

### Step 4

Add output contracts.

Expected work:

- type-level `output(schema)`
- client inference path uses explicit output schema when available
- preserve fallback inference from `TypedNextResponse`

Validation:

- root test/lint/typecheck
- `bun run integration:next-app:generate` if generated types change

### Step 5

Introduce public `procedure`.

Expected work:

- builder implementation
- `handle()` typing
- initial middleware typing, likely limited in phase 1 of the builder
- direct schema input contracts for params/query/json/headers/cookies

Validation:

- root test/lint/typecheck
- integration fixture route examples added

### Step 6

Introduce `nextRoute(procedure)`.

Expected work:

- Next adapter
- response normalization
- redirect support
- raw `Response` escape hatch
- Standard Schema V1 validation execution for procedure input contracts

Validation:

- root test/lint/typecheck
- `bun run integration:next-app:generate` if route exports affect generated shape
- relevant integration tests

### Step 7

Refactor `routeHandlerFactory()` to share internals if it materially reduces maintenance cost.

Expected work:

- no breaking changes
- no behavior drift in validator pipelines

Validation:

- root test/lint/typecheck
- integration fixture tests

## Suggested file layout

Potential additions:

```txt
packages/rpc4next/src/rpc/server/
  procedure.ts
  procedure-types.ts
  procedure-result.ts
  next-route.ts
  error.ts
  meta.ts
```

Potential compatibility updates:

```txt
packages/rpc4next/src/rpc/server/
  route-handler-factory.ts
  route-types.ts
  types.ts
  index.ts
```

Potential generator updates:

```txt
packages/rpc4next-cli/src/cli/core/
  scan-utils.ts
  route-scanner.ts
```

Potential fixture updates:

```txt
integration/next-app/app/api/**/route.ts
integration/next-app/app/**/route-contract.ts
integration/next-app/src/generated/rpc.ts
integration/next-app/src/*.test.ts
```

## Risks

### Type complexity growth

Builder APIs can become hard to maintain if generics are allowed to accumulate without clear boundaries.

Mitigation:

- keep internal helper types small
- prefer one source of truth for contract state
- add type-focused tests early

### Dual API maintenance

Supporting both `routeHandlerFactory()` and `procedure` can create duplication.

Mitigation:

- allow separate public APIs initially
- consolidate internals later, not immediately

### Generator drift

If the generator reads only legacy route exports, new procedure-based routes may lag behind.

Mitigation:

- decide early whether the generator should read only exported HTTP handler functions or also procedure metadata exports
- prefer keeping generated inference centered on exported `GET`/`POST` functions whenever possible

### Over-promising runtime validation

Output validation and metadata can be useful at type level even when runtime behavior is not yet enforced.

Mitigation:

- document phase boundaries clearly
- keep runtime output validation opt-in

### Schema compatibility gaps

Not every validator library exposes exactly the same type metadata or issue shape even when it supports Standard Schema.

Mitigation:

- keep `procedure` focused on Standard Schema V1 as the public contract
- preserve explicit `output(...)` contracts so success-body inference does not depend only on validator metadata
- add fixture coverage for representative supported validators over time

## Open questions

- Should `procedure` support multiple output variants by status code in the first version, or only a single success body?
- Should metadata be purely type-level at first, or also available at runtime for docs and tooling?
- Should middleware in `procedure.use()` be allowed to widen context immediately, or should phase 1 keep middleware scope narrow?
- Should plain Next route handlers gain an optional companion export for metadata, or should that remain out of scope?
- Should `forRoute(routeContract)` become mandatory for every `procedure` route eventually, or only for routes that want generated params enforcement?
- Should `nextRoute()` eventually reject unbound procedures entirely once the route-bound workflow is stable?
- Should `procedure.formData(...)` validate against a normalized plain object only, or should rpc4next also expose a lower-level way to validate the raw `FormData` object when a schema library can support it?

## Recommended immediate next step

With phases 1 through 8 implemented, the next design work should focus on making multipart/form-data a first-class part of `procedure` authoring before adding broader ecosystem features.

Recommended priorities:

1. add `procedure.formData(schema)` and thread `formData` through the typed handler context
2. implement `request.formData()` extraction plus `FormData` normalization in `nextRoute()`
3. reject invalid body contract combinations such as `.json(...)` with `.formData(...)`
4. add type and runtime constraints that reject `formData` contracts for `GET` and `HEAD`
5. add integration fixtures and tests for scalar fields, repeated keys, and `File` uploads
