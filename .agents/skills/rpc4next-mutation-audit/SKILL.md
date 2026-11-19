---
name: rpc4next-mutation-audit
description: Audit and periodically reassess test effectiveness in rpc4next using mutation testing, classify findings against runtime and type contracts, and prepare actionable follow-up issues.
---

# rpc4next mutation audit

Assess test effectiveness without treating mutation score or survivor count as a
quality guarantee. An audit request authorizes measurement, analysis, and issue
tracking within the audit scope. Prepare and publish relevant audit updates and
follow-up issues without a separate request. Make small test improvements in
batches without repeated approval when the public contract and test approach are
clear and within the requested audit scope. Before changes requiring a product or
contract decision, implementation changes, or substantial test redesign, present
a concrete proposal and obtain approval; honor approval already given in the
session. Do not change dependencies or set up a scheduler without approval.
Follow the user's requested scope and repository `AGENTS.md`.

## Compose the workflows

- For mutator execution and report interpretation, read the bundled
  [mutator](../mutator/SKILL.md) skill. For test repairs,
  also use [mutation-test-loop](../mutation-test-loop/SKILL.md), subject to the
  user's scope and the repository's dependency and validation rules.
- For GitHub issue operations within the audit, use
  [github-issues](../github-issues/SKILL.md). Use an existing issue for related
  findings when suitable. Do not change parent relationships, labels or assignees
  unless requested or necessary to the authorized operation.
- The bundled upstream skills are snapshots: mutator and mutation-test-loop from
  [mizchi/mutator v0.4.2](https://github.com/mizchi/mutator/tree/v0.4.2/packages/cli/skills)
  and github-issues from [github/awesome-copilot](https://github.com/github/awesome-copilot/tree/1a8e8f1302a31ddb60089e2db15b21bbd148e8ff/skills/github-issues).
  Check the installed tool's version and help; flags and report semantics may change.
  Repository and user instructions take precedence over upstream installation,
  remediation, and approval suggestions.

## Measure

1. Inspect the working tree and test configuration. Preserve user changes, report
   the tested commit and relevant dirty state, and run the baseline. A failing
   baseline or broken runner is not a mutation result; diagnose and report it.
2. Use `bun run test:mutation` to run the pinned project dependency with Node 24+
   and Vitest 5; the library itself continues to support its declared Node version.
   Check the actual versions and tool availability. Do not add or upgrade
   dependencies unless the task authorizes it. Diagnose runner setup errors
   separately from a failing Vitest baseline and avoid modifying user caches.
3. For change-focused work, choose an appropriate base and include affected
   implementation and tests; `--since` alone may omit test-only changes. For a
   periodic audit, specify package source globs explicitly: mutator's default
   `src/**` does not cover this monorepo. Choose bounded scopes, budgets or
   per-line sampling when needed; record pending work and resume with compatible
   cache or further scopes. Never label a partial run complete.
4. Avoid overlapping builds, Next.js E2E, client-bundle tests, generators, or
   package builds with each other or measurement when they modify shared `.next`,
   `dist`, generated files, or other test inputs. Inspect normal Vitest, typecheck,
   Next.js and package checks separately as relevant; mutation only observes the
   selected runner and in-process instrumentation.
5. Record date, commit/dirty state, versions, runner, scope, command, typecheck and
   sampling settings, elapsed time, and counts for killed, survived, no coverage,
   pending, ignored, runtime errors and timeouts. Distinguish tool-reported status
   from conclusions; timeouts and runtime errors need investigation, even if the
   tool includes timeouts in its score. Report skipped tests, child processes,
   type-only tests, and other coverage limitations. Never infer a full-project
   score from a subset or compare incompatible runs as a trend.

## Classify and track

- Check the public contract, actual call paths and tests before classifying each
  candidate as a test gap, equivalent, type-constrained/out of scope, or unresolved.
  State the evidence and distinguish a suspicion from a confirmed gap. A type
  constraint alone does not validate HTTP, URL, file or other external data.
- Use type tests for invalid call shapes; use runtime tests for observable behavior
  of valid calls and external inputs. Do not fabricate impossible inputs or assert
  private implementation solely to kill a mutant. Type-only tests can be valuable
  even when they detect no runtime mutations.
- Accept an equivalent mutant only after its equivalence is justified for relevant
  callers and within the authorized work. Record a specific reason; leave uncertain
  cases unresolved. Do not bulk accept survivors or remove tests based on kill
  matrices alone. Inspect stale acceptances on later runs.
- For tracking, identify the existing audit issue, such as #743 for the 2026 audit,
  and check for duplicate open or closed issues. Group confirmed fixes by coherent
  behavior or independently deliverable work, not one issue per mutant. An issue
  should describe evidence, affected contract, reproduction or mutant key, needed
  test, and verification; link the audit and clarify incomplete measurement.
  Update the audit record with the run summary, unresolved scope, and whether
  fixes are proposed, local, or merged. At each stopping point, state the next
  concrete investigation or repair; request approval before edits that require a
  product or contract decision, implementation changes, or substantial test
  redesign. Do not claim that a transient `.mutator` report is durable history.
- For authorized test changes, re-run selected mutants, then the required root
  `bun run test`, `bun run lint`, and `bun run typecheck`, plus relevant integration
  checks. Report untested areas and pending work. A skill does not schedule runs:
  periodic execution needs an explicitly configured scheduler or a manual request.
