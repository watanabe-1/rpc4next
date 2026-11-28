# Resuming npm publication

The publish workflow calls `bun scripts/publish-released-packages.ts` with
`PATHS_RELEASED`, the JSON array produced by release-please. After a partial npm
publication, use **Re-run failed jobs** or rerun the failed **publish** job. The
successful release-please job retains its outputs, and checkout uses the original
event commit. Re-running all jobs is outside this recovery contract because
release-please would recalculate the release outputs.

Before contacting npm, the script validates all paths against the release-please
configuration and checks package names and manifest versions. Redirected package
directories are rejected. Lookup and publication both target
`https://registry.npmjs.org/`; registry redirects are rejected, and npm runs with
an argument array rather than shell interpolation. The workflow keeps its
existing OIDC publishing permissions and adds no token.

Each exact name/version is queried immediately before publication. A matching
HTTP 200 response skips that version; HTTP 404 permits publication. All other
HTTP statuses, invalid metadata, malformed JSON, network failures, and timeouts
stop the job. A publish failure also stops the job. If npm accepted a version
before the command reported failure, the next job retry detects and skips it.
Skipping does not update dist-tags.

This recovery mechanism trusts the npm registry and existing package publishing
permissions. Name/version matching does **not** verify that the published tarball
matches the intended build or validate its provenance. Detecting publication by
a compromised publisher would require additional artifact identity verification;
this script does not provide that guarantee.

Tests inject registry responses and publication failures; they do not publish
packages or require npm credentials. Run `bun run test` for regression coverage.
