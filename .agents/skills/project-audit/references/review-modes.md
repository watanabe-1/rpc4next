# Scope and modes

`all` covers the project in bounded components; `path` covers the specified files or directories and relevant callers/contracts; `feature` traces the feature across implementation, tests and documentation. Record context read outside the target and exclusions. Identify what was actually examined, not merely what was planned.

`quick` prioritizes obvious, high-impact problems; `standard` follows major execution paths; `deep` also examines relevant tests, contracts, edge cases and interactions. None implies exhaustive coverage.

- `general`: correctness, errors, maintainability with concrete impact, latent defects.
- `security`: authentication, authorization, trust boundaries, input validation, secrets, dependencies; avoid exploitation or transmitting sensitive data.
- `spec`: compare specifications, README, public APIs, types and runtime behavior.
- `performance`: complexity, allocations, I/O, concurrency and realistic bottlenecks; substantiate impact.
- `testing`: missing boundaries and failure cases, unreliable assertions and test isolation.
- `architecture`: dependencies, module boundaries and responsibilities where they cause demonstrable problems.

Multiple modes may overlap. Combine candidates with the same root cause, not merely similar symptoms. Reject taste-based suggestions and unsupported hypothetical issues. Severity describes impact; confidence describes evidence and is independent of severity.
