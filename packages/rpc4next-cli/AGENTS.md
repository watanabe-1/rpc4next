# AGENTS.md

## Scope
- These rules apply to `packages/rpc4next-cli`.

## CLI Test Helpers
- For tests that need temporary filesystem state, use `src/test-helpers/tmp-dir.ts`.
- Prefer `makeTempDir`, `cleanupTempDir`, `writeTree`, and `resetTempDir` over ad-hoc temp-dir setup and cleanup.
- Only bypass these helpers when the test is specifically about lower-level temp-directory behavior.
