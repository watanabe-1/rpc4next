で含めたプロンプトを書きます。

Phase 10 を実装してください。対象は `docs/procedure-design.md` に追加済みの `Phase 10: configurable project-level error strategy` です。

目的:
- `rpc4next` 標準の error envelope は default として維持する
- ただし project ごとに error ha# Procedure Design for rpc4next

## Status

- Draft
- Intended audience: maintainers of `rpc4next` and Codex-based implementation work
- Scope: `packages/rpc4next`, `packages/rpc4next-cli`, and `integration/next-app`
- Current implementation status:
  - Phases 1 through 14 are implemented
  - `procedure` and `nextRoute` are available publicly
  - procedure input contracts are executed through Standard Schema V1-compatible validators
  - the integration fixture includes a shared `baseProcedure` preset under `integration/next-app/app/api/_shared/base-procedure.ts`
  - shared guarded procedures can declare multiple error variants and opt into runtime output validation
  - `procedure.formData(...)` is available publicly and validated by `nextRoute()`
  - `procedure.defaults({ onError })` can provide shared project-level route defaults, including `onError`, for procedure routes
  - `createProcedureKit(...)` remains as thin compatibility sugar over the same preset/default mechanism
  - procedure input contracts accept validator-stage failure branching through `procedure.<target>(schema, { onValidationError(...) { ... } })`
  - narrow `response.*(...)` helpers are available inside `procedure.handle(...)`, `onValidationError(...)`, and `errorFormatter`
  - README and integration fixture docs now present `procedure` / `nextRoute()` as the typed server authoring path
  - legacy middleware-first exports described in early sections of this draft are historical design context, not the current public API

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

This document proposes a staged evolution toward a `procedure`-oriented design. Some early sections discuss a gradual migration that was relevant during design, but the current public API has already moved to the procedure-first surface.

## Goals

- Keep `app/**` files as the route source of truth.
- Preserve the current type inference model based on exported route types.
- Introduce `procedure`-style contract building inspired by tRPC, without adopting tRPC's router-first model.
- Add lightweight descriptive metadata and explicit output contracts without expanding the CLI's current responsibility.
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

### 5. Minimal descriptive metadata

If new metadata cannot improve route authoring readability directly, it should not be introduced. The CLI should stay focused on path structure, exported HTTP methods, exported `Query` types, and generated route contracts rather than accumulating unrelated route annotations.

## Problems in the current design

### Public API is close to Hono

`routeHandlerFactory().get(zValidator(...), async (rc) => rc.json(...))` is structurally similar to Hono's middleware and context model.

### Contract information is spread across multiple concepts

- route params are inferred from file paths
- query/body/header/cookie contracts come from validator middleware
- response shape is inferred indirectly from `TypedNextResponse`
- lightweight route descriptions such as summary/tags/deprecated have no first-class place

### Overloads are costly

`MethodRouteDefinition` currently relies on multiple overloads to model middleware composition. This is workable but hard to extend for metadata and output contracts.

### Error handling is flexible but under-standardized

`onError` can return any typed response, but client code cannot rely on a shared machine-readable error envelope.

## Proposed model

Introduce a first-class `procedure` contract builder with a Next adapter.

### High-level shape

```ts
const getUser = procedure
  .meta({ summary: "Get a user", tags: ["users"] })
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
  })
  .nextRoute({ method: "GET", onError });
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
- optional descriptive `meta`
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

Ergonomics note:

- the default route-file shape should be terminal `.handle(...).nextRoute(options)` because it keeps single-route authoring linear and local
- that sugar should remain a thin delegation to the same adapter internals, equivalent to `nextRoute(procedure, options)`
- the implementation goal is API ergonomics, not a collapse of responsibilities; procedure construction and Next route adaptation should still stay separate internally
- the standalone `nextRoute(procedure, options)` form should remain supported because it keeps shared `baseProcedure` reuse and `createProcedureKit(...).nextRoute(...)` composition straightforward

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

Route metadata should stay typed but intentionally lightweight. It is useful for
human-readable route description and optional tooling, but it should not become
the mechanism for rpc4next-specific policy or Next.js runtime configuration.

Initial recommended shape:

```ts
type RpcMeta = {
  summary?: string;
  tags?: string[];
  deprecated?: boolean;
};
```

This should remain open to user extension later, but the built-in surface should
stop at descriptive fields. `meta` should not affect generated client types or
CLI output in the current design.

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
- the public server authoring surface is now procedure-first
- legacy `routeHandlerFactory()` / `zValidator(...)` compatibility notes in this draft describe the migration intent that preceded the current public API cleanup

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
  .meta({
    summary: "Shared guarded procedure preset",
    tags: ["guarded"],
  })
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

## Phase 10: configurable project-level error strategy

Scope:

- keep the built-in rpc4next error envelope as the default experience
- allow projects to opt into that default rather than hard-coding it as the only supported runtime path
- let projects customize how recognized procedure errors are serialized to HTTP responses
- make room for project-defined error conventions without requiring every route to drop down to ad hoc `Response` handling

Deliverables:

- an overridable error formatting hook for `nextRoute(...)`, such as `errorFormatter`
- a project-level factory or preset API, such as `createProcedureKit(...)`, that can provide shared error behavior
- a documented distinction between rpc4next's default error codes and optional project-defined codes or registries
- fixture coverage showing:
  - the default rpc4next formatter
  - a project-custom formatter
  - a route or project that chooses not to use rpc4next's default envelope

Target authoring shape:

```ts
const procedureKit = createProcedureKit({
  errorFormatter: defaultRpcErrorFormatter,
});

const procedure = procedureKit.procedure;
const nextRoute = procedureKit.nextRoute;
const rpcError = procedureKit.rpcError;
```

Possible project-level customization:

```ts
const procedureKit = createProcedureKit({
  errorRegistry: {
    BAD_REQUEST: { status: 400 },
    AUTH_EXPIRED: { status: 401 },
    PLAN_LIMIT_EXCEEDED: { status: 403 },
  },
  errorFormatter: (error, response) => {
    if (!isProjectError(error)) return;

    return response.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          meta: error.details,
        },
      },
      { status: error.status },
    );
  },
});
```

Why tenth:

- error envelopes are one of the areas most likely to vary across projects, even when route typing and procedure composition stay shared
- rpc4next should provide a strong standard path without forcing every application into the same operational or product-level error vocabulary
- allowing formatter and registry customization is a better escape hatch than requiring projects to abandon `procedure` and `nextRoute()` entirely

Notes:

- the built-in rpc4next formatter should remain the default for zero-config users
- `procedure.error(...)` should continue to describe the route contract first; runtime HTTP shaping should be delegated to a formatter layer
- initial customization can focus on formatting hooks and project presets before introducing full user-defined error-code extensibility at the type level
- if project-defined codes are added later, they should be documented as an extension layer on top of the default rpc4next codes rather than a replacement for the default ergonomics
- `procedure.error(...)` should be documented as a declaration of known client-visible errors, not as a promise that every thrown exception has been exhaustively enumerated
- unexpected exceptions should still fall back through the formatter path, typically as `INTERNAL_SERVER_ERROR`

### Relationship to tRPC-style error handling

The nearest tRPC comparison point is not per-procedure error inference. It is the combination of:

- a shared error formatter that defines the client-visible envelope
- middleware and procedures that may throw known framework error values at runtime
- a fallback path for unexpected exceptions

`rpc4next` should follow that broad runtime model, but keep a stronger route-level contract surface than tRPC exposes by default.

That means:

- `errorFormatter` remains the primary place to define project-level response serialization
- `procedure.error(...)` remains the primary place to declare known route-level errors that should appear in generated client types
- the absence of a declared error should not block runtime handling; it only means the error is not part of the explicit client contract

### Minimum inference from shared toolchains

Full static inference of every thrown error from arbitrary procedure implementations is not a realistic TypeScript goal. Thrown exceptions are not represented in function return types, and route logic may delegate through middleware, helper functions, libraries, or external systems that are opaque to the type system.

However, `rpc4next` can support a narrower and much more practical form of inference:

- shared middleware, validation helpers, and other reusable procedure toolchain functions may attach declared error metadata
- `procedure.use(...)` and similar composition points may merge that metadata into the procedure's known error contract
- route-local `procedure.error(...)` remains available to add route-specific known errors on top of shared declarations

This should be framed as declared-error propagation rather than implementation-body exception analysis.

In other words:

- `rpc4next` should not try to infer all thrown exceptions from arbitrary handler code
- `rpc4next` may infer a minimum known error set from reusable typed building blocks that explicitly declare their own error contracts
- formatter fallback remains necessary for undeclared or unexpected failures

## Phase 11: validator-stage customization for procedure input

Scope:

- close the last major extensibility gap between `procedure` and validator middleware routes
- allow projects to customize validation-failure behavior closer to the input contract boundary
- preserve the `procedure` model as schema-first rather than reverting to middleware-first public typing

Deliverables:

- add an optional second argument to `procedure.params/query/json/formData/headers/cookies`
- support the main practical replacement for `zValidator(target, schema, hook)`-style branching
- document the intended boundary between schema validation, middleware policy, and route-level error formatting
- test coverage proving the mechanism works with shared `baseProcedure` presets and current inference

Why eleventh:

- after phase 10, this is the clearest remaining feature gap versus the legacy API
- addressing it first reduces the number of routes that need to stay on `routeHandlerFactory()` for non-historical reasons
- it clarifies whether `procedure` is intended to fully subsume validator-driven route authoring

Notes:

- the design should avoid reintroducing ad hoc validator wrappers as a required public concept
- route-level `errorFormatter` and middleware should remain the preferred places for broad policy decisions
- the new mechanism should solve targeted validation branching rather than reopening full middleware-style validator composition

Adopted API shape:

```ts
const getUsers = procedure
  .query(
    z.object({
      page: z.coerce.number().int().positive(),
    }),
    {
      onValidationError: ({
        target,
        value,
        issues,
        response,
      }) => {
        return response.json(
          {
            source: "validator",
            target,
            issues,
            received: value,
          },
          { status: 422 },
        );
      },
    },
  )
  .handle(async ({ query }) => {
    return {
      body: {
        page: query.page,
      },
    };
  });
```

Behavior and constraints:

- `onValidationError(...)` only runs when Standard Schema validation reports issues for that specific input target
- success-path coercion and transformation remain the schema's job; the hook is for failure branching only
- returning `Response`, `NextResponse`, or a normalized `ProcedureResult` short-circuits the procedure before middleware and handler execution
- returning `undefined` falls back to the normal `rpcError("BAD_REQUEST", ...)` path
- if that fallback throws, route-level or project-level `errorFormatter` can still reshape the resulting error response
- this keeps validator-stage branching narrower than `use()` middleware and earlier than `errorFormatter`
- shared presets such as `baseProcedure` can define these hooks once and reuse them across derived procedures

Relationship to the legacy API:

- `zValidator(target, schema, hook)` maps most directly to `procedure.<target>(schema, { onValidationError(...) { ... } })`
- the legacy hook received validator-library-specific parse results; the new hook receives Standard Schema issues plus the raw extracted input value
- in the current public API, that migration path has been superseded by the procedure-first surface rather than remaining as a co-equal supported authoring path

## Phase 12: documentation default shift to procedure-first authoring

Implemented outcome:

- `procedure` is now the documented default for new typed route authoring
- the legacy middleware-first API is no longer presented as a public default or compatibility surface in the current server exports
- new-user docs now reduce ambiguity by leading with `procedure` / `nextRoute()`

Completed documentation changes:

- README and integration docs now lead typed examples with `procedure` / `nextRoute()`
- fixture walkthroughs and example pages now present a single procedure-first story instead of a dual-surface migration map
- stale wording that framed this shift as a future milestone has been removed from the current assessment and recommendation sections

Why this change mattered:

- once the main capability gap is addressed or intentionally bounded, the docs should stop presenting the legacy API as a co-equal default
- documentation drift is now a larger adoption risk than missing runtime primitives

Positioning notes:

- this phase is about recommendation and framing, not deprecation
- examples should still preserve at least a small compatibility surface for legacy users

## Phase 13: incremental migration of legacy integration fixtures

Scope:

- migrate legacy integration routes that still use `zValidator(...)` when the `procedure` builder improves clarity, precision, or reuse
- keep a small number of legacy fixtures only where they still demonstrate compatibility or an unresolved feature gap
- use the fixture app to prove that `procedure` is viable as the default authoring path

Deliverables:

- convert representative validator-based fixtures such as simple query/json routes to `procedure`
- complete the representative fixture migration so the integration app reflects the procedure-first recommendation end to end
- update tests and generated outputs as needed after fixture migration
- document any intentionally retained legacy notes separately from the current public API story if they still matter historically

Why thirteenth:

- once docs recommend `procedure`, the integration app should reflect that recommendation
- fixture migration is the most visible proof that the new API is practical for day-to-day route authoring
- keeping migration incremental avoids losing compatibility coverage for the old API

Notes:

- prioritize migrations that reduce duplicated contracts or improve shared policy reuse
- thin redirect-only or plain compatibility examples do not need forced migration

## Phase 14: procedure response helpers for handler ergonomics

Scope:

- improve `procedure.handle(...)` authoring ergonomics without reverting to the full `RouteContext` model
- align success-path response authoring more closely with existing `routeHandlerFactory()` and validation-error hooks
- improve editor completion quality by steering authors toward a narrow response helper surface instead of broad `Response` instance methods

Deliverables:

- add a response helper object to the procedure handler context, for example `response.json(...)`, `response.text(...)`, `response.body(...)`, and `response.redirect(...)`
- keep `Response` / `NextResponse` return support as escape hatches rather than removing them
- type `response.json(...)` against `.output(...)` when an explicit output contract exists, while keeping the untyped path available when no output contract is declared
- document the distinction between the preferred normalized `ProcedureResult` path and the optional response-helper path
- fixture and type-test coverage showing improved completion-oriented authoring in `procedure.handle(...)`

Target authoring shape:

```ts
const getUsers = procedure
  .forRoute(routeContract)
  .query(
    z.object({
      page: z.coerce.number().int().positive(),
    }),
  )
  .output(
    z.object({
      ok: z.literal(true),
      page: z.number().int().positive(),
    }),
  )
  .handle(async ({ query, response }) => {
    return response.json({
      ok: true,
      page: query.page,
    });
  });
```

Why fourteenth:

- phases 1 through 13 cover the major contract and migration work, so the next remaining gap is largely ergonomic rather than functional
- current handler return types allow `Response` / `NextResponse`, which weakens editor suggestions by surfacing many unrelated instance members
- a narrow response helper surface preserves the procedure-first design while matching the most familiar and productive part of the legacy `rc.json(...)` style

Notes:

- this should not expose the full legacy `RouteContext` inside `procedure.handle(...)`; specifically, it should not reintroduce `req.valid(...)` or middleware-style request mutation as the primary procedure model
- the helper should ideally share the same underlying typed response primitives already used by `createRouteContext(...)`
- `onValidationError(...)`, `errorFormatter`, and `procedure.handle(...)` should converge on the same response helper vocabulary where practical
- docs should continue to recommend plain `{ body, status }` returns as the most framework-agnostic procedure result, with `response.*(...)` documented as an ergonomic helper and escape hatch

## Phase 15: optional client ergonomics

Possible items:

- TanStack Query helpers
- richer docs generation
- optional OpenAPI emission

These should remain out of scope until the core contract model is stable.

## Phase 16: mandatory route error handling with optional project presets

Scope:

- replace formatter-centric error customization with an explicit `onError` contract on `nextRoute(...)`
- make final route error serialization mandatory instead of optional fallback behavior
- keep `createProcedureKit(...)` as an optional convenience wrapper rather than a required public entry point
- remove procedure-level typed error contracts from the core authoring model

Deliverables:

- `nextRoute(...)` requires `onError(error, context)` and always delegates caught errors through it
- `createProcedureKit({ onError })` remains available as a thin helper that preconfigures `nextRoute(...)`
- `procedure.error(...)` and related typed error-contract machinery are removed from the primary procedure surface
- shared `onError` implementations should preserve their concrete return types so client inference can reflect the final error response shape
- fixture coverage showing:
  - direct `nextRoute(..., { onError })` usage without a kit
  - shared `createProcedureKit({ onError })` usage for project-wide policy
  - standard `rpcError(...)` handling through a user-supplied `onError`
  - arbitrary thrown errors mapped by the same `onError`

Target authoring shape:

```ts
export const GET = nextRoute(
  procedure
    .route(routeContract)
    .handle(async ({ response }) => {
      throw rpcError("FORBIDDEN", { message: "Forbidden" });
    }),
  {
    onError(error, ctx) {
      if (error instanceof Response) {
        return error;
      }

      if (error instanceof RpcError) {
        return ctx.response.json(error.toJSON(), {
          status: error.status,
        });
      }

      return ctx.response.json(
        {
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Internal Server Error",
          },
        },
        { status: 500 },
      );
    },
  },
);
```

Optional project preset shape:

```ts
const procedureKit = createProcedureKit({
  onError(error, ctx) {
    if (error instanceof Response) {
      return error;
    }

    if (error instanceof RpcError) {
      return ctx.response.json(error.toJSON(), {
        status: error.status,
      });
    }

    return ctx.response.json(
      {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Internal Server Error",
        },
      },
      { status: 500 },
    );
  },
});

export const GET = procedureKit.nextRoute(
  procedure.route(routeContract).handle(async () => {
    throw new Error("Unexpected");
  }),
);
```

Typing note:

- prefer `const onError = (...) => ... satisfies ProcedureOnError` when the
  response shape returned from `onError` should flow into route/client inference
- avoid `const onError: ProcedureOnError = ...` for shared handlers because that
  widens the function to the generic contract and discards the concrete
  `response.json(...)` / `response.text(...)` return type

Why sixteenth:

- the current formatter-plus-contract model adds type and API surface area without guaranteeing that every route makes an explicit runtime error decision
- projects often want freedom to throw domain-specific errors while still forcing one final HTTP serialization path
- `createProcedureKit(...)` is useful as a shared preset, but it should not be the conceptual center of the server API

Notes:

- `onError` should be required for `nextRoute(...)` and should not be allowed to return `undefined`
- `createProcedureKit(...)` should be documented as optional convenience, not as the default entry point for procedure authoring
- the primary abstraction should be a reusable procedure preset/default, not a separate kit namespace
- if projects want shared route behavior such as `onError`, the preferred long-term shape is `procedure`-derived configuration reuse, for example `const appProcedure = procedure.defaults({ onError })`
- any shared setting applied at the procedure level should flow naturally into terminal `.nextRoute(...)` without requiring a parallel builder surface that must mirror `procedure`
- `createProcedureKit(...)` is acceptable only as a thin compatibility helper around that preset model, or as a migration bridge while the procedure-defaults path becomes the main API
- `rpcError(...)` should remain as a standard framework error value, but it should no longer imply a required route-level error contract declaration
- `Response` / `NextResponse` escape hatches should continue to work by allowing `onError` to return them directly
- validator-stage customization can continue to use `onValidationError(...)`, but unexpected exceptions from validation should still flow through the required `onError`

Design direction:

- avoid duplicating the procedure builder API just to carry project-level route defaults; that increases long-term maintenance cost and creates an avoidable second surface that must track every builder change
- prefer one canonical builder contract, with optional internal support for shared defaults/presets that are attached to derived procedures and consumed by `.nextRoute(...)`
- if `createProcedureKit(...)` remains in the public API, treat it as syntax sugar over the same underlying procedure-preset mechanism rather than a separate conceptual system

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
- document `meta` as descriptive server-side annotation only

Validation:

- root test/lint/typecheck

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

- decide early whether the generator should read only exported HTTP handler functions or also inspect additional contract exports
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

## Current assessment after phase 12

With phases 1 through 14 in place, the `procedure` / `nextRoute()` path now covers the typed server authoring scenarios that were previously split across the legacy middleware-first API and the newer procedure path.

What is now covered:

- direct schema-based input contracts for params, query, json, headers, cookies, and formData
- route-bound params enforcement through generated `route-contract.ts`
- reusable shared presets such as `baseProcedure`
- shared and route-local typed error contracts
- optional runtime output validation
- project-level shared `onError` through `procedure.defaults({ onError })` or `createProcedureKit(...)`
- validator-stage failure branching on procedure input contracts
- raw `Response` / `NextResponse` escape hatches
- middleware short-circuiting and incremental context widening

Design backlog after phase 14:

- re-center route error handling around required `nextRoute(..., { onError })`
- keep `createProcedureKit(...)` only as an optional compatibility helper over procedure presets/defaults
- remove `procedure.error(...)` from the core procedure contract if the mandatory `onError` model proves cleaner in practice
- consider adding `.nextRoute(options)` as optional sugar over `nextRoute(procedure, options)` if the current split keeps feeling heavier than necessary in route files

Remaining notable gap versus the old middleware-first path:

- no major functional gap remains for standard typed route authoring; remaining differences are mostly historical or validator-library-specific

The center of gravity for server authoring has therefore moved fully to `procedure`.

Current documentation stance:

- new typed server examples should lead with `procedure`, generated `route-contract.ts`, and `nextRoute()`
- route-level redirects, formatter hooks, validation branching, and shared presets should all be demonstrated on the same procedure-first surface
- fixture walkthroughs should show one consistent procedure-first story rather than a dual-API migration map
- migration guidance should stay short and practical rather than prescriptive

## Recommended immediate next step

With phases 1 through 14 implemented, the next design work should focus on strengthening the procedure-first surface rather than preserving a parallel middleware-first API.

Recommended priorities:

1. decide whether route-bound procedures should become mandatory for all `procedure` routes once the generated `route-contract.ts` workflow is considered stable
2. evaluate whether richer output contracts, such as success variants by status code, are needed before pursuing broader ecosystem features
3. evaluate Phase 16's mandatory `onError` design as a replacement for formatter-centric error contracts and optional project-level kits
ndling / serialization 方針を差し替えられるようにする
- 標準利用者は今までどおり zero-config で使えること
- `procedure.error(...)` は route contract の宣言として維持し、runtime の HTTP レスポンス整形は formatter 層に寄せること

前提:
- リポジトリは `rpc4next` monorepo
- ルールは repo root の `AGENTS.md` に従うこと
- generated file は hand-edit しないこと
- 変更後は必ず root で `bun run test` `bun run lint` `bun run typecheck` を実行すること
- 変更が integration fixture に影響するなら必要に応じて `bun run integration:next-app:generate` も実行すること

設計意図:
- Next.js 標準ではなく `rpc4next` の独自 abstraction として、標準 error strategy を提供する
- ただし「どういう error envelope を採用するか」は project ごとに違うため、利用者が opt-in / override できる構造にする
- route ごとに ad hoc な `Response` を書かなくても、project-level に統一した error strategy を持てるようにする

実装要件:
1. `nextRoute(...)` に overridable な error formatting hook を追加する
- 例: `errorFormatter`
- formatter は thrown error と route context を受け取り、Response を返せるようにする
- formatter が `undefined` を返した場合は既存 default path にフォールバックする構造でもよい
- zero-config の既存利用者は挙動変更なしにすること

2. built-in default formatter を明示的な関数として切り出す
- 現在 `RpcError` を `{ error: { code, message, details } }` に正規化している標準ロジックを、再利用可能な default formatter として整理する
- デフォルトではそれが使われること
- 既存の `rpcError(...)` の利用体験と response shape は維持すること

3. project-level preset / factory API を追加する
- 名前は `createProcedureKit(...)` を第一候補とする
- ここから `procedure`, `nextRoute`, `rpcError` などを取り出せる構成を検討する
- 最小実装でよいが、「project 全体で共通の errorFormatter を配る」ユースケースを実現すること
- 既存 public API は壊さないこと

4. `procedure.error(...)` の意味は contract declaration として維持する
- route type / generated client inference が壊れないこと
- runtime formatter 導入によって explicit error contract の型が消えないこと
- 既存の shared base procedure と route-local error contract の合成も壊さないこと

5. project-defined error convention のための拡張余地を作る
- 今回の実装では full custom error code extensibility まで必須ではない
- ただし将来 `errorRegistry` のような project-level 拡張を載せやすい設計にすること
- もし無理なく入れられるなら最小限の `errorRegistry` も入れてよい
- ただし型複雑化で既存 API を壊さないことを優先する

推奨 API イメージ:
```ts
const procedureKit = createProcedureKit({
  errorFormatter: defaultRpcErrorFormatter,
});

const procedure = procedureKit.procedure;
const nextRoute = procedureKit.nextRoute;
const rpcError = procedureKit.rpcError;
project custom formatter のイメージ:

const procedureKit = createProcedureKit({
  errorFormatter: (error, rc) => {
    if (error instanceof Error) {
      return rc.json(
        {
          success: false,
          error: {
            message: error.message,
          },
        },
        { status: 500 },
      );
    }
  },
});
最低限ほしい成果物:

server runtime 実装
public export 整理
単体テスト追加
integration fixture 追加または既存 fixture 拡張
docs/procedure-design.md の Phase 10 と整合する簡単なドキュメント更新が必要なら実施
テスト観点:

default formatter では既存 rpcError(...) の JSON envelope が維持される
custom formatter を nextRoute(...) に直接渡したとき、その formatter が優先される
project-level kit の formatter が nextRoute(...) に反映される
formatter が処理しない error は default handling または既存挙動にフォールバックする
explicit procedure error contracts の型が維持される
shared base procedure の error contracts と route-local error contracts の合成が維持される
既存 routeHandlerFactory(...) の onError 挙動は壊さない
実装方針:

まず関連実装を読み、既存 error normalization と nextRoute の catch path を把握する
その後、型と runtime の責務分離を明確にした最小変更で実装する
不必要な API 拡張や broad refactor は避ける
変更は最小・局所的に保つこと
最後に:

変更内容の要約
どの API を追加したか
どの挙動が default / override 可能か
実行した検証結果
残っている制約や未実装の拡張余地
を簡潔に報告してください
