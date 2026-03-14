# next-app integration workspace

This workspace is a real Next.js app for verifying the end-to-end rpc4next flow:

1. `rpc4next-cli` scans `app/**`
2. generated types are written to `src/generated/rpc.ts` and `app/**/params.ts`
3. route files can import `Params` from their sibling `params.ts`
4. `rpc4next/client` consumes those types
5. Next.js compiles and serves the resulting app

This workspace intentionally resolves `rpc4next` imports to the monorepo source via `tsconfig.json` paths so you can verify changes before rebuilding package `dist/`.
Generated files are committed in this workspace so CLI output diffs are reviewable in Git, including `src/generated/rpc.ts` and `app/**/params.ts`.

## App folder pattern coverage

This workspace now includes fixture routes for the official `app` directory folder conventions documented by Next.js:

- Dynamic segments, catch-all segments, and optional catch-all segments
- Route groups
- Parallel routes
- Private folders
- Escaped underscore segments via `%5F`
- Intercepting route fixtures

`check:folder-patterns` is a dedicated test command for folder-pattern coverage. It runs both the type-level assertions and the fixture-oriented Vitest suite without changing `rpc4next` itself.

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
bun run integration:next-app:test
bun run integration:next-app:typecheck
bun run integration:next-app:dev
```

In another terminal, with the dev server running:

```bash
bun run integration:next-app:smoke
```

`integration:next-app:test` runs the integration workspace test suite: runtime Vitest checks, direct server-route handler checks for validation, redirects, and error handling, folder-pattern Vitest checks, and the TypeScript-only pattern assertions used to validate generated `PathStructure`.

`integration:next-app:smoke` calls the live Next.js routes through the generated client.

`integration:next-app:watch` keeps `src/generated/rpc.ts` and `app/**/params.ts` in sync while route files under `app/**` change.

For focused local debugging inside `integration/next-app`, `test:runtime` and `check:folder-patterns` still exist as narrower workspace-level commands.

Intercepting route fixtures are kept to verify scanning behavior, but they are intentionally excluded from `PathStructure` because rpc4next models public URL paths rather than intercepted UI branches.

If `next build` asks for `@types/react`, run `bun install` once at the repo root so the new workspace devDependencies are installed.
