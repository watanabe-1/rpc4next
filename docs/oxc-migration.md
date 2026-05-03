# Oxc migration

This repository now uses `oxlint` and `oxfmt` for active linting and formatting.

## Added files

- `.oxlintrc.json`
- `.oxfmtrc.json`

## Current script state

- root `lint` runs `oxfmt --check` and `oxlint`
- root `check:fix` runs `oxfmt` and `oxlint --fix`
- package-local `lint` and `check:fix` scripts under `packages/*` follow the same Oxc-based pattern

## What the draft restores from the old ESLint setup

- `eqeqeq`
- `_`-prefixed unused variable exceptions
- `vitest/consistent-test-it`
- `vitest/require-top-level-describe`
- `padding-line-between-statements`
- `spaced-comment`

It also maps the current Biome test-oriented rules to Oxlint equivalents where available:

- `vitest/no-focused-tests`
- `vitest/no-disabled-tests`
- `vitest/no-duplicate-hooks`
- `vitest/no-standalone-expect`
- `vitest/expect-expect`
- `vitest/no-conditional-expect`

## Known gaps

These old ESLint rules are not restored in the draft config:

- `import/order`
- `vitest/no-export`
- `vitest/no-done-callback`

Current handling:

- `import/order`
  - approximated with `oxfmt.sortImports`
  - this is not guaranteed to match `eslint-plugin-import/order` exactly
- `padding-line-between-statements`
  - restored with the local `return-padding/padding-line-before-return` Oxlint JS plugin rule
- `spaced-comment`
  - restored with the local `local/comment-spacing` Oxlint JS plugin rule

If those gaps matter, the next options are:

1. keep ESLint for only the missing rules
2. use Oxlint JS plugins for those ESLint plugins/rules where practical

## Suggested commands

Use these commands during regular development:

```bash
bun run lint
bun run check:fix
```

If you want type-aware TypeScript rules later, evaluate:

```bash
bun add -D oxlint-tsgolint
bunx oxlint --type-aware .
```

## Notes

Biome has been removed from the active toolchain. If you need the old configuration or demo rules, inspect the git history instead of restoring Biome config files.
