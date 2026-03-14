# AGENTS.md

## Project Scope
- This repository is the `rpc4next` monorepo.
- Runtime and library code lives under `packages/*`.
- The real integration fixture app lives under `integration/next-app`.

## Environment Assumptions
- Use the repository root as the default working directory unless a task is clearly package-local.
- Use Bun for repository scripts.
- The repository declares `node >=20.19.2` in `package.json`; avoid introducing code that requires a lower version assumption.
- If browser e2e is required and Playwright is not installed yet, install the browser once before relying on e2e commands.

## Architecture Notes
- `packages/rpc4next-cli` scans Next.js `app/**` files and generates RPC types.
- `packages/rpc4next` provides the runtime client/server helpers.
- `integration/next-app` is not a toy example; it is the end-to-end verification workspace for the monorepo.

## Generated Files
- Treat `integration/next-app/src/generated/rpc.ts` and `integration/next-app/app/**/params.ts` as generated artifacts.
- Do not hand-edit generated files unless the task is specifically about generator output or test fixtures that intentionally update committed generated output.
- If changes affect route scanning, route typing, params extraction, or generated client behavior, regenerate integration artifacts and review the resulting diffs.

## Regeneration Rules
- Run `bun run integration:next-app:generate` when changes affect CLI scanning, generated path structure output, params generation, or integration fixture routes that should change generated artifacts.
- If a task updates the integration fixture under `integration/next-app/app/**`, check whether committed generated files should change as part of the same work.
- Treat generated diffs as part of the review surface, not as opaque byproducts.

## Working Style
- Prefer `rg` / `rg --files` for search.
- Preserve existing Biome formatting and naming patterns.
- Keep edits minimal and consistent with the current package boundaries.
- When changing Next.js integration behavior, verify both the library code and the integration fixture app.
- Avoid unrelated renames, drive-by refactors, and broad formatting churn unless the task explicitly calls for them.

## Guardrails
- Do not manually edit generated files just to satisfy tests if the source behavior should be fixed in generator or fixture inputs.
- Do not introduce package-boundary leakage between `packages/rpc4next-cli` and `packages/rpc4next` without clear necessity.
- Prefer committed, reviewable fixture updates over hidden test-only behavior when validating scanner or generator behavior.

## Approval-Sensitive Actions
- Do not add or upgrade dependencies unless the task requires it or the user approves it.
- Do not run broad or slow integration steps such as full browser e2e unless they are relevant to the task or needed to verify behavior.
- Do not perform destructive git or filesystem operations unless the user explicitly asks for them.
- If a change would require large-scale generated diffs, broad refactors, or cross-package API churn, call that out before proceeding blindly.

## Validation Requirements
- After every code change, run the root commands `bun run test`, `bun run lint`, and `bun run typecheck`.
- Do not consider the task complete unless all three root commands pass, or the user explicitly allows an exception.
- When relevant to the change, also run focused integration commands such as `bun run integration:next-app:generate` or `bun run integration:next-app:e2e`.

## Validation Order
- Prefer fast, targeted checks while iterating when they materially reduce feedback time.
- Before finishing, always run the full root validation set: `bun run test`, `bun run lint`, and `bun run typecheck`.
- If the task touches browser-client integration, route generation, or real Next.js runtime behavior, run the relevant integration command in addition to the root validation set.

## CLI Test Helpers
- For CLI tests under `packages/rpc4next-cli`, if a test needs filesystem-backed temporary directories, use the shared helpers in `packages/rpc4next-cli/src/test-helpers/tmp-dir.ts`.
- Prefer `makeTempDir`, `cleanupTempDir`, `writeTree`, and `resetTempDir` instead of open-coded `fs.mkdtempSync(...)`, ad-hoc temp cleanup, or repeated file-tree setup.
- Only bypass these helpers when the test is specifically verifying lower-level temp-directory behavior.

## Change Scope
- Keep commits and patches focused on the user request.
- Do not mix feature work with opportunistic cleanup unless the cleanup is required to make the change correct.
- Keep generated file updates in the same change when they are a direct consequence of the source edits.

## Local AGENTS Strategy
- Prefer adding a nested `AGENTS.md` when a subproject needs rules that do not apply repository-wide.
- Put package-specific testing, fixture, generation, or architectural rules in the closest relevant directory instead of overloading the root file.
- When both root and nested `AGENTS.md` files exist, follow the closest applicable file for local conventions while still honoring repository-wide rules.

## Important Paths
- `packages/rpc4next`
- `packages/rpc4next-cli`
- `integration/next-app`
- `integration/next-app/src/generated/rpc.ts`
- `integration/next-app/app`
