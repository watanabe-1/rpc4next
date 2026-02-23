// NOTE:
// We intentionally include the `.js` extension in re-export specifiers.
//
// This package is published as native ESM and consumed directly by Node.js.
// Node's ESM loader does NOT resolve extensionless relative imports
// (e.g. `./constants`), so the emitted JavaScript must reference
// `./constants.js` explicitly.
//
// Bun and some bundlers can resolve extensionless imports,
// but Node (v20+) will throw ERR_MODULE_NOT_FOUND without `.js`.
//
// Using `.js` here ensures the built files work in:
// - Node.js (ESM loader)
// - Bun
// - npm-installed consumers
//
// See: https://nodejs.org/api/esm.html#mandatory-file-extensions
export * from "./constants.js";
export * from "./types.js";
