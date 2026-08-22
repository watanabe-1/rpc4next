# next-app integration workspace

This package is the real Next.js integration fixture for `rpc4next`. Use it to verify the full app-router flow in one place:

1. `rpc4next-cli` scans `app/**`
2. generated types are written to `src/generated/rpc.ts` and `app/**/route-contract.ts`
3. procedure route files import `routeContract` from their sibling `route-contract.ts`
4. `rpc4next/client` consumes the generated types
5. Next.js compiles and serves the resulting app

This workspace resolves `rpc4next` imports to the monorepo source via `tsconfig.json` paths, so scanner and runtime changes are testable before rebuilding package `dist/`.
It still depends on built workspace artifacts for packages such as `rpc4next-shared`, so a fresh clone needs one root build before starting the app or using the built CLI entrypoint.
Generated files are committed here so CLI output diffs stay reviewable in Git, including `src/generated/rpc.ts` and `app/**/route-contract.ts`.
The local `rpc4next.config.json` keeps generator commands short by pinning `baseDir`, `outputPath`, and `paramsFile`.

## Quick start

If you want to understand the integration package with the least context switching:

1. From the repository root, run `bun install`
2. From the repository root, run `bun run build` once on a fresh clone
3. From `integration/next-app`, run `bun run generate:rpc`
4. Inspect `src/generated/rpc.ts`
5. Inspect `src/lib/rpc-client.ts`
6. Inspect the example routes and pages under `app/**`

The default generator commands in this package execute the CLI from monorepo source, so scanner changes are testable without rebuilding the CLI `dist/`.
If you want to verify the built package entrypoint instead, use the `:dist` variants after building the workspace packages from the repository root.

## Example map

Use these files as entry points, depending on what you want to understand:

- Recommended typed procedure route via `.handle(...).nextRoute(...)`: `app/api/procedure-contract/[userId]/route.ts`
- Shared guarded procedure preset: `app/api/procedure-guarded/[userId]/route.ts`
- Shared procedure preset definitions: `app/api/_shared/procedure-defaults.ts` and `app/api/_shared/base-procedure.ts`
- Procedure json/header/cookie input: `app/api/procedure-submit/route.ts`
- Procedure form-data input via `.handle(...).nextRoute(...)` sugar: `app/api/procedure-form-data/route.ts`
- Procedure runtime output validation: `app/api/procedure-invalid-output/route.ts`
- Procedure validator-stage customization: `app/api/procedure-validation-branch/route.ts`
- Project-level route procedure defaults via `appRouteProcedure`: `app/api/procedure-defaults-error/route.ts`
- Project-level page procedure defaults via `appPageProcedure`: `app/patterns/page-helpers/page.tsx`
- Procedure-backed page with params and runtime output validation: `app/photo/[id]/page.tsx`
- Procedure-backed page with typed search params: `app/patterns/search/page.tsx`
- Procedure-first walkthrough page: `app/procedure-examples/page.tsx`
- Response promise unwrap examples: `app/response-unwrap/page.tsx`
- Typed client setup: `src/lib/rpc-client.ts`
- Generated output shape: `src/generated/rpc.ts`
- Generated sibling route contract: `app/api/procedure-contract/[userId]/route-contract.ts`
- Procedure params/query route: `app/api/users/[userId]/route.ts`
- Procedure JSON route: `app/api/posts/route.ts`
- Procedure headers/cookies route: `app/api/request-meta/route.ts`
- Plain Next.js handler with `NextResponse.json(...)`: `app/api/next-native/[itemId]/route.ts`
- Plain Next.js handler with `Response.json(...)`: `app/api/next-native-response/route.ts`
- Plain Next.js page with exported query typing: `app/patterns/native-query/page.tsx`
- Procedure redirect helper route: `app/api/redirect-me/route.ts`
- Route-local procedure error handler override: `app/api/error-demo/route.ts`
- Page-path typing examples: `app/photo/[id]/page.tsx` and `app/feed/page.tsx`
- App Router folder-pattern coverage: `app/patterns/**`

## Commands in `integration/next-app`

Run these from this directory when working on the integration package itself:

```bash
bun run generate:rpc
bun run generate:rpc:watch
bun run generate:rpc:dist
bun run generate:rpc:dist:watch
bun run dev
bun run build
bun run test
bun run typecheck
bun run e2e
```

Command meanings:

- `bun run generate:rpc`: runs `packages/rpc4next-cli/src/cli/index.ts` directly from source
- `bun run generate:rpc:watch`: same as above in watch mode
- `bun run generate:rpc:dist`: runs the built `rpc4next` bin from `rpc4next-cli`
- `bun run generate:rpc:dist:watch`: same as above in watch mode
- `bun run test`: runs the integration workspace test suite, including typecheck, Vitest runtime checks, direct route-handler checks, folder-pattern checks, and TypeScript-only `PathStructure` assertions
- `bun run e2e`: runs Playwright checks against the real Next.js app on `http://127.0.0.1:3100`

For headed browser debugging inside `integration/next-app`, run `bun run e2e -- --headed`.
Before the first Playwright run, install the browser once:

```bash
bunx playwright install chromium
```

## Commands in the repository root

Use root commands when you need monorepo-wide setup or the convenience wrappers defined in the root `package.json`:

```bash
bun install
bun run build
bun run integration:next-app:generate
bun run integration:next-app:watch
bun run integration:next-app:e2e
bun run integration:next-app:dev
bun run test
bun run lint
bun run typecheck
```

Use the root commands mainly for:

- first-time setup
- building workspace packages needed by this integration package
- running monorepo-wide validation
- triggering this package's common workflows without changing directories

## Development workflow

If a change touches route scanning, generated client shape, params generation, or integration fixture routes under `app/**`, run `bun run generate:rpc` from `integration/next-app` and review the committed generated diffs.

This workspace is intended to make scanner and runtime regressions visible in Git. Avoid hand-editing `src/generated/rpc.ts` or `app/**/route-contract.ts` unless the task is specifically about generator output.

The main walkthrough in this fixture is now procedure-first. `app/api/procedure-contract/[userId]/route.ts` is the baseline typed route: it binds the generated `routeContract`, declares params/query/output in one builder, and exports `GET` through terminal `export const { GET } = appRouteProcedure.handle(...).nextRoute({ method: "GET" })` sugar. `app/api/procedure-submit/route.ts` extends that path to json/header/cookie input, `app/api/procedure-form-data/route.ts` covers multipart-style input with the same terminal shape, and `app/api/procedure-guarded/[userId]/route.ts` shows the shared-preset case where continuing the builder chain with `.nextRoute(...)` remains natural because the procedure value comes from a reusable base.

The form-data fixture intentionally validates user-controlled upload fields in
the schema, including display-name length, file size, file type, tag length, and
tag count. That schema protects the parsed values passed to the handler.
Overall request body limits still belong at the Next.js runtime, hosting,
reverse proxy, CDN, or middleware layer because `request.json()` and
`request.formData()` parse the body before schema validation runs.

Shared procedure middleware should be defined from the builder that declares the
inputs it needs. `app/api/_shared/base-procedure.ts` uses
`appRouteProcedure.headers(schema).use(...)`, so the middleware is applied in the same
chain and receives typed `headers`, `request`, `ctx`, and `response` without a
handwritten `ProcedureMiddlewareContext<...>` annotation. The returned
`{ ctx: ... }` is available to later middleware and handlers. Routes share that
middleware by importing `guardedBaseProcedure` and continuing the builder chain,
as shown in `app/api/procedure-guarded/[userId]/route.ts`.

This shared procedure pattern is intentionally positioned as the place for
route-local but reusable checks that should not be forgotten, such as assigning a
trace ID, writing structured logs, verifying a viewer, resolving an organization
or tenant, enforcing a plan gate, loading account state, checking role
permissions, or preparing request context before API integration or database
access. Next.js Proxy is still useful for broad, optimistic checks and redirects
before a request reaches the route, but it is not the right place for slow data
fetching or complete authorization. The guarded procedure fixture demonstrates
the complementary layer: every route that starts from `guardedBaseProcedure`
gets the same trace logging, validated auth headers, typed
`UNAUTHORIZED`/`FORBIDDEN` responses, and `ctx.viewer`/`ctx.organization`/
`ctx.traceId` before its handler can reach protected data.

The procedure fixtures also cover the later design phases that made the procedure path complete enough to recommend by default. `app/api/procedure-invalid-output/route.ts` demonstrates opt-in runtime output enforcement with a Standard Schema output contract. `app/api/procedure-defaults-error/route.ts` shows project-level `procedure.defaults({ route: { onError } })` usage through `appRouteProcedure`, while `app/api/_shared/procedure-defaults.ts` keeps the route and page presets explicit. `app/api/procedure-validation-branch/route.ts` shows validator-stage customization through `procedure.query(schema, { onValidationError(...) { ... } })`. `app/api/error-demo/route.ts` shows a route-local `onError` override on top of the shared route preset, and `app/api/_shared/on-error.ts` shows generic `Error` mapping in a shared `onError` implementation.

Procedure-backed pages use `appPageProcedure` and terminate with `.nextPage(...)`
instead of `.nextRoute(...)`. `app/photo/[id]/page.tsx` demonstrates validated
`params` and opt-in runtime output validation before render.
`app/patterns/search/page.tsx` demonstrates page query input inference flowing
into generated `$url({ query })` types while the page itself validates
`searchParams` through `procedure.query(schema)` and renders from the validated
`query` without a `.handle()` step. Use `.handle()` when a page needs server-side
data fetching or preparation before render; that returned `body` becomes
`data` in `.nextPage(...)`. HTTP response helpers and raw `Response` values are
reserved for route procedures. When a shared preset is page-specific, prefer
`procedure.defaults({ page: { onError } })` so later middleware and handlers
receive page helpers such as `page.redirect(...)` and `page.notFound()` instead
of route response helpers. Those page helpers throw Next.js navigation
interrupts and do not return at runtime, but examples still use
`return page.redirect(...)` and `return page.notFound()` to make terminal
branches explicit for TypeScript and readers.
`app/patterns/client-page/page.tsx` keeps `.nextPage(...)` on the server-side
page entry while rendering a `"use client"` component with serializable `data`
props for browser interactivity.

When a handler or shared middleware should contribute a known error to
client-side response inference, return `response.error(...)`. Those returned
errors remain part of the generated response union with their concrete status,
code, and details shape. `app/api/_shared/base-procedure.ts` demonstrates this
for shared `UNAUTHORIZED` and `FORBIDDEN` branches, and
`app/api/procedure-guarded/[userId]/route.ts` adds a route-local `FORBIDDEN`
branch on top.

`onError` is still required for bare route procedures, but this fixture provides
it through the shared `appRouteProcedure` default. It is the fallback for unexpected
thrown exceptions rather than the primary path for known client-visible errors.
Input validation still contributes a typed `BAD_REQUEST` response, and opt-in
runtime output validation contributes an `INTERNAL_SERVER_ERROR` response.

The fixtures also include plain Next.js entries written without `procedure`.
`app/api/next-native/[itemId]/route.ts` is the native route-handler fixture for
generated params plus an exported `Query` type. `app/patterns/native-query/page.tsx`
is the native page fixture for exported `Query` plus promised `searchParams`.
The generated client can still target those routes and pages, but native route
response types are intentionally broader than rpc4next's `TypedNextResponse`
helpers.

`bun run generate:rpc:watch` keeps `src/generated/rpc.ts` and `app/**/route-contract.ts` in sync while route files under `app/**` change.

Parallel route slot names are excluded from `PathStructure`, but their descendant pages are flattened onto public URL paths such as `/patterns/parallel/views` and `/patterns/parallel/members`.

Intercepting route fixtures are kept to verify scanning behavior, but they are intentionally excluded from `PathStructure` because rpc4next models public URL paths rather than intercepted UI branches.

If `next build` asks for `@types/react`, run `bun install` once at the repository root so the workspace devDependencies are installed.

## App folder pattern coverage

This workspace includes fixture routes for the official `app` directory folder conventions documented by Next.js:

- Dynamic segments, catch-all segments, and optional catch-all segments
- Route groups
- Parallel routes
- Private folders
- Escaped underscore segments via `%5F`
- Page `searchParams` as promised props
- Intercepting route fixtures
- A plain Next.js route-handler fixture using `NextResponse.json(...)`

Folder-pattern coverage is verified as part of the normal integration workspace test flow without changing `rpc4next` itself.

Official references used for these fixtures:

- [Dynamic Routes](https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes)
- [Route Groups](https://nextjs.org/docs/app/building-your-application/routing/route-groups)
- [Parallel Routes](https://nextjs.org/docs/app/building-your-application/routing/parallel-routes)
- [Intercepting Routes](https://nextjs.org/docs/app/building-your-application/routing/intercepting-routes)
- [Colocation](https://nextjs.org/docs/app/building-your-application/routing/colocation)
- [page.js](https://nextjs.org/docs/app/api-reference/file-conventions/page)
