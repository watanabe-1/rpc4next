# Procedure Design for rpc4next

## Status

- Draft
- Intended audience: maintainers of `rpc4next` and Codex-based implementation work
- Scope: `packages/rpc4next`, `packages/rpc4next-cli`, and `integration/next-app`
- Current implementation status:
  - Phases 1 through 4 are implemented
  - `procedure` and `nextRoute` are available publicly
  - procedure input contracts are executed through Standard Schema V1-compatible validators

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

## Phase 5: optional client ergonomics

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

## Recommended immediate next step

With phases 1 through 4 implemented, the next design work should focus on stabilization rather than new surface area.

Recommended priorities:

1. document Standard Schema V1 as the validator contract for `procedure`
2. verify supported validator libraries in fixtures and type tests
3. decide how far shared internals between `procedure` and `routeHandlerFactory()` should go
4. defer broader client ergonomics until the procedure contract shape is stable
