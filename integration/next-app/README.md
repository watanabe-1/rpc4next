# next-app integration workspace

This workspace is a real Next.js app for verifying the end-to-end rpc4next flow:

1. `rpc4next-cli` scans `app/**`
2. generated types are written to `src/generated/rpc.ts` and `app/**/route-params.ts`
3. `rpc4next/client` consumes those types
4. Next.js compiles and serves the resulting app

This workspace intentionally resolves `rpc4next` imports to the monorepo source via `tsconfig.json` paths so you can verify changes before rebuilding package `dist/`.
Generated files are committed in this workspace so CLI output diffs are reviewable in Git, including `src/generated/rpc.ts` and `app/**/route-params.ts`.

## App folder pattern coverage

This workspace now includes fixture routes for the official `app` directory folder conventions documented by Next.js:

- Dynamic segments, catch-all segments, and optional catch-all segments
- Route groups
- Parallel routes
- Private folders
- Escaped underscore segments via `%5F`
- Intercepting route fixtures

`check:folder-patterns` is a dedicated detection command. It intentionally reports gaps without changing `rpc4next` itself.

Official references used for these fixtures:

- https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes
- https://nextjs.org/docs/app/building-your-application/routing/route-groups
- https://nextjs.org/docs/14/app/building-your-application/routing/parallel-routes
- https://nextjs.org/docs/app/building-your-application/routing/intercepting-routes
- https://nextjs.org/docs/app/building-your-application/routing/colocation

## Commands

From the repository root:

```bash
bun install
bun run integration:next-app:generate
bun run integration:next-app:check-patterns
bun run integration:next-app:typecheck
bun run integration:next-app:dev
```

In another terminal, with the dev server running:

```bash
bun run integration:next-app:smoke
```

`integration:next-app:smoke` calls the live Next.js routes through the generated client.

`integration:next-app:check-patterns` is expected to fail while official folder conventions are still missing or misrepresented in the generated `PathStructure`.

If `next build` asks for `@types/react`, run `bun install` once at the repo root so the new workspace devDependencies are installed.
