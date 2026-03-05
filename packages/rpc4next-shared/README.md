# rpc4next-shared

Internal shared package for the `rpc4next` monorepo.

## Purpose

Provides shared constants and types used by:

- `rpc4next`
- `rpc4next-cli`

## Not Intended for Direct Use

This package is an implementation detail of the rpc4next ecosystem.
Application developers should use `rpc4next` and `rpc4next-cli` directly.

## Maintenance Notes

- Native ESM package; keep explicit `.js` extensions in internal re-exports.
- Changes to exported constants/types can affect both `rpc4next` and `rpc4next-cli`.
