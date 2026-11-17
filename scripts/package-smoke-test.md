# Distribution smoke test

Run `bun run test:package` from the repository root. This builds the packages and
tests their npm tarballs with Node and npm. Registry access is required; external
dependencies and peers are intentionally resolved from the packed manifests,
without the repository's lockfile or `node_modules`.

The test copies the release packages to an independent OS temporary directory,
then applies the same `replaceWorkspaceDepsFromManifest` transformation used by
`.github/workflows/publish.yml`. `npm pack` preserves `workspace:` references, so
packing the untransformed checkout would not represent the published package.
The original checkout and the positive test tarballs are never rewritten.

The consumer project declares only the local release tarballs. npm overrides
pin all references to those packages to the same tarballs, and lockfile SHA-512
checks reject registry versions or directory links, including nested copies.
No external dependency is added to the fixture manifest. npm installs external
dependencies, peers, and platform-specific optional packages normally, including
Oxc's native binding and lifecycle scripts.

The test checks browser bundling and public exports, executes a bundled client
API consumer in Node, and runs the packed CLI using its declared bin entry. The
runtime library targets Next's bundler and has extensionless internal imports;
it is consumed through esbuild here, while the CLI runs directly in Node. It verifies the
generated path types, route contract, and test manifest. A second fresh consumer
installs a deliberately broken CLI tarball with only the `oxc-parser` dependency
declaration removed. Installation must succeed and CLI execution must fail with
`ERR_MODULE_NOT_FOUND` for Oxc. This detects regression to supplying undeclared
dependencies from the repository or fixture setup. As with any smoke test,
imports on paths that are never exercised can still need separate coverage.

The fixtures, npm cache, and empty npm config files live outside the repository
and are removed in `finally`. Ancestor `node_modules` directories are rejected;
`NODE_PATH`, `NODE_OPTIONS`, and inherited npm configuration variables are removed,
and Node's global search paths are disabled. esbuild remains a repository test
tool, but its JavaScript API runs in a separate Node process with the fixture as
its working directory and the same sanitized environment. Both bundles use this
API, which selects the platform's native executable without assuming that
`bin/esbuild` is JavaScript. The API's service is stopped in `finally`.

Commands use executable plus argument arrays without a shell, including paths
containing spaces. The test resolves Node shims to `process.execPath`, locates
`npm-cli.js`, and executes that script with the real Node. It never executes
`npm.cmd` or an npm executable shim. For unusual tool layouts, set
`RPC4NEXT_SMOKE_NODE` to the Node executable and/or `RPC4NEXT_SMOKE_NPM_CLI` to the
absolute path of `npm-cli.js`. A standard Node installation needs no overrides.
Failures include the command, working directory, exit status, stdout, and stderr.
Commands have a three-minute timeout; interruption and timeout terminate the
child process tree before temporary-directory cleanup. The package smoke CI step
runs on Linux in the aqua/from-package matrix entry. Windows execution is
supported for local validation.
