# AGENTS.md

## Scope
- This repository is the `rpc4next` monorepo.
- Library code lives under `packages/*`.
- `integration/next-app` is the real Next.js integration fixture, not a toy example.

## Environment
- Use the repository root as the default working directory unless the task is clearly package-local.
- Use Bun for repository scripts.
- Keep compatibility with the repo's declared Node version in `package.json`.

## Architecture
- `packages/rpc4next-cli` scans Next.js `app/**` files and generates RPC types.
- `packages/rpc4next` provides the runtime client/server helpers.

## Generated Artifacts
- Treat `integration/next-app/src/generated/rpc.ts` and `integration/next-app/app/**/route-contract.ts` as generated files.
- Do not hand-edit generated files unless the task is specifically about generator output.
- Run `bun run integration:next-app:generate` when changes affect CLI scanning, generated path structure output, route contract generation, or integration fixture routes.

## Working Rules
- Prefer `rg` / `rg --files` for search.
- Preserve existing Biome formatting and naming patterns.
- Keep edits minimal, scoped to the request, and consistent with current package boundaries.
- Avoid unrelated renames, broad formatting churn, and cross-package API changes unless they are required.
- When changing Next.js integration behavior, verify both the library code and the integration fixture app.

## Validation
- After every code change, run `bun run test`, `bun run lint`, and `bun run typecheck` from the repository root.
- Do not consider the task complete unless all three commands pass, unless the user explicitly allows an exception.
- Run additional relevant integration commands such as `bun run integration:next-app:generate` or `bun run integration:next-app:e2e` when the change touches that behavior.

## Guardrails
- Do not add or upgrade dependencies unless the task requires it or the user approves it.
- Do not run broad or slow e2e flows unless they are relevant to the task.
- Do not perform destructive git or filesystem operations unless explicitly requested.
- If a task needs subproject-specific rules, prefer a nested `AGENTS.md` near that code.
