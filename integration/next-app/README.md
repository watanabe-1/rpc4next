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
- Shared procedure preset definition: `app/api/_shared/base-procedure.ts`
- Procedure json/header/cookie input: `app/api/procedure-submit/route.ts`
- Procedure form-data input via `.handle(...).nextRoute(...)` sugar: `app/api/procedure-form-data/route.ts`
- Procedure runtime output validation: `app/api/procedure-invalid-output/route.ts`
- Procedure validator-stage customization: `app/api/procedure-validation-branch/route.ts`
- Project-level procedure defaults via `procedure.defaults({ onError })`: `app/api/procedure-kit-error/route.ts`
- Procedure-first walkthrough page: `app/procedure-examples/page.tsx`
- Typed client setup: `src/lib/rpc-client.ts`
- Generated output shape: `src/generated/rpc.ts`
- Generated sibling route contract: `app/api/procedure-contract/[userId]/route-contract.ts`
- Procedure params/query route: `app/api/users/[userId]/route.ts`
- Procedure JSON route: `app/api/posts/route.ts`
- Procedure headers/cookies route: `app/api/request-meta/route.ts`
- Plain Next.js handler with `NextResponse.json(...)`: `app/api/next-native/[itemId]/route.ts`
- Plain Next.js handler with `Response.json(...)`: `app/api/next-native-response/route.ts`
- Procedure redirect helper route: `app/api/redirect-me/route.ts`
- Direct standalone `nextRoute(..., { onError })` route: `app/api/error-demo/route.ts`
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

The main walkthrough in this fixture is now procedure-first. `app/api/procedure-contract/[userId]/route.ts` is the baseline typed route: it binds the generated `routeContract`, declares params/query/output in one builder, and exports `GET` through terminal `.handle(...).nextRoute({ onError })` sugar. `app/api/procedure-submit/route.ts` extends that path to json/header/cookie input, `app/api/procedure-form-data/route.ts` covers multipart-style input with the same terminal shape, and `app/api/procedure-guarded/[userId]/route.ts` shows the shared-preset case where keeping a standalone `nextRoute(procedure, options)` call remains natural because the procedure value comes from a reusable base.

The procedure fixtures also cover the later design phases that made the procedure path complete enough to recommend by default. `app/api/procedure-invalid-output/route.ts` demonstrates opt-in runtime output enforcement with a Standard Schema output contract. `app/api/procedure-kit-error/route.ts` shows project-level `procedure.defaults({ onError })` usage, while `app/api/_shared/procedure-kit.ts` keeps `createProcedureKit(...)` as compatibility sugar over the same shared preset model. `app/api/procedure-validation-branch/route.ts` shows validator-stage customization through `procedure.query(schema, { onValidationError(...) { ... } })`. `app/api/error-demo/route.ts` keeps the direct standalone `nextRoute(..., { onError })` form for arbitrary thrown errors, and `app/api/_shared/on-error.ts` shows `rpcError(...)` plus generic `Error` mapping in a shared `onError` implementation.

When a shared handler should contribute its concrete error envelope to client-side
response inference, define it with `satisfies ProcedureOnError` instead of
`const onError: ProcedureOnError = ...`. The explicit annotation widens the
function type and loses the specific `response.json(...)` shape.

The fixtures also include plain Next.js routes written without `procedure`, including a static `NextResponse.json(...)` route, a dynamic route that reads `params` and `nextUrl.searchParams`, and a `Response.json(...)` route. The generated client can still call them as RPC, but their response types are intentionally broader than rpc4next's `TypedNextResponse` helpers.

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
