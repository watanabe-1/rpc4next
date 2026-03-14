# next-app integration workspace

This workspace is a real Next.js app for verifying the end-to-end rpc4next flow:

1. `rpc4next-cli` scans `app/**`
2. generated types are written to `src/generated/rpc.ts` and `app/**/params.ts`
3. route files can import `Params` from their sibling `params.ts`
4. `rpc4next/client` consumes those types
5. Next.js compiles and serves the resulting app

This workspace intentionally resolves `rpc4next` imports to the monorepo source via `tsconfig.json` paths so you can verify changes before rebuilding package `dist/`.
Generated files are committed in this workspace so CLI output diffs are reviewable in Git, including `src/generated/rpc.ts` and `app/**/params.ts`.
The local `rpc4next.config.json` keeps the generator command short by pinning `baseDir`, `outputPath`, and `paramsFile`.

## Development workflow

If a change touches route scanning, generated client shape, params generation, or integration fixture routes under `app/**`, run `bun run integration:next-app:generate` and review the committed generated diffs.

This workspace is intended to make scanner and runtime regressions visible in Git. Avoid hand-editing `src/generated/rpc.ts` or `app/**/params.ts` unless the task is specifically about generator output.

## App folder pattern coverage

This workspace now includes fixture routes for the official `app` directory folder conventions documented by Next.js:

- Dynamic segments, catch-all segments, and optional catch-all segments
- Route groups
- Parallel routes
- Private folders
- Escaped underscore segments via `%5F`
- Intercepting route fixtures
- A plain Next.js route-handler fixture using `NextResponse.json(...)`

Folder-pattern coverage is verified as part of the normal integration workspace test flow without changing `rpc4next` itself.

Official references used for these fixtures:

- [Dynamic Routes](https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes)
- [Route Groups](https://nextjs.org/docs/app/building-your-application/routing/route-groups)
- [Parallel Routes](https://nextjs.org/docs/14/app/building-your-application/routing/parallel-routes)
- [Intercepting Routes](https://nextjs.org/docs/app/building-your-application/routing/intercepting-routes)
- [Colocation](https://nextjs.org/docs/app/building-your-application/routing/colocation)

## Commands

From the repository root:

```bash
bun install
bun run integration:next-app:generate
bun run integration:next-app:watch
bun run integration:next-app:e2e
bun run integration:next-app:dev
bun run test
bun run typecheck
```

Inside `integration/next-app`, `bun run test` runs the integration workspace test suite: a normal workspace typecheck, runtime Vitest checks, direct server-route handler checks for validation, redirects, and error handling, folder-pattern Vitest checks, and the TypeScript-only pattern assertions used to validate generated `PathStructure`.

The API fixtures also include plain Next.js routes written without `routeHandlerFactory`, including a static `NextResponse.json(...)` route, a dynamic route that reads `params` and `nextUrl.searchParams`, and a `Response.json(...)` route. The generated client can still call them as RPC, but their response types are intentionally broader than rpc4next's `TypedNextResponse` helpers.

`bun run integration:next-app:e2e` runs browser-based Playwright checks against the real Next.js app on `http://127.0.0.1:3100`. Before the first run, install the browser once:

```bash
bunx playwright install chromium
```

For headed browser debugging inside `integration/next-app`, run `bun run e2e -- --headed`.

`bun run integration:next-app:watch` keeps `src/generated/rpc.ts` and `app/**/params.ts` in sync while route files under `app/**` change.

Intercepting route fixtures are kept to verify scanning behavior, but they are intentionally excluded from `PathStructure` because rpc4next models public URL paths rather than intercepted UI branches.

If `next build` asks for `@types/react`, run `bun install` once at the repo root so the new workspace devDependencies are installed.
