---
name: rpc4next-pr
description: Prepare, create, or update a GitHub pull request for rpc4next using repository naming, templates, validation, and signed-commit rules. Use for PR preparation or publication requests; creating this skill does not publish a PR.
---

# rpc4next pull request

Prepare a reviewable PR from the complete branch change. Follow the user's scope:
title/body preparation stays local; a request to create a PR authorizes publishing
the intended task branch as needed and creating the PR. A request to update a PR
authorizes the requested update, not unrelated edits or additional code changes.
Do not merge, enable auto-merge, request reviewers, post comments, or change labels
or milestones unless requested. Creating or discussing this skill does not invoke
the publication workflow.

## Load the current rules

Work from the repository root and read:

- `AGENTS.md` and nested instructions for changed files.
- `conventional-commit.tpl.md` for allowed types, naming, and requested output.
- `.github/pull_request_template.md` for the actual PR body structure.
- `package.json` for current validation commands. For workflow changes, also read
  `.github/ACTIONS.md` for action lockfile generation and verification rules.

Use an available connected GitHub plugin when its tools support the operation;
otherwise use `gh`, which is available in this repository's toolchain. Before
remote operations, check `gh --version` and `gh auth status` when using the CLI.
If authentication is missing, finish the local draft and report what is needed.
Do not expose credentials or install tools or plugins without authorization.

## Establish the exact PR scope

1. Inspect `git status --short --branch`, the current branch, remotes, upstream,
   working/index diffs, and recent commits. Preserve unrelated work. Do not publish
   a detached HEAD or a default/protected branch as a task branch.
2. Resolve the destination repository, head repository/branch, and base explicitly.
   Prefer the user's choices, then an existing PR's base, then the destination
   repository's default branch from remote metadata. Do not assume `origin`,
   `main`, or a fork destination. Clarify only if the ambiguity affects publication.
3. Query existing open PRs for the exact head repository/branch and destination.
   Reuse the matching PR for an authorized update; preserve its base and draft
   state unless a change was requested. If several matches exist, resolve the
   target before editing. Do not reopen closed/merged PRs implicitly.
4. Fetch the specific base/head refs as needed without changing the working tree.
   Inspect `git log <base-ref>..HEAD`, `git diff --stat <base-ref>...HEAD`, and
   `git diff <base-ref>...HEAD`. Review every branch commit, not just the latest.
   Detect unrelated commits, accidentally included files, empty net diffs, and
   conflicts. Explain a scope problem before publishing; do not silently rebase,
   reset, split branches, or rewrite existing commits.
5. For unfinished task changes, use
   [rpc4next-signed-commit](../rpc4next-signed-commit/SKILL.md) when completing those
   changes is part of the request. It handles branch creation, coherent commit
   boundaries, validation, and signed commits. A text-only PR request does not
   authorize committing. Do not recommit work already completed by that skill.
   Identify uncommitted changes as excluded from the PR.

## Check readiness

Use existing validation evidence only when it covers the exact committed code
being proposed. Otherwise run `bun run test`, `bun run lint`, and
`bun run typecheck` from the root as required by `AGENTS.md`, plus relevant
generation/integration checks. Do not run unrelated e2e flows. Tests against a
dirty tree may include fixes missing from the PR: validate the committed snapshot
in isolation when needed, without stashing or discarding user changes.

Inspect the outgoing commits' signatures. Verify each newly created task commit
with `git verify-commit <sha>`, or reuse verification evidence from the signed
commit workflow for the same hashes. Report missing or unverifiable signatures;
do not rewrite inherited commits to add signatures. Required-check failures block
completion unless the user allows an exception; drafting text can still proceed
with the failure disclosed. Publishing a known incomplete PR requires the user's
request for that state and must describe the remaining work.

## Compose the title and body

- Describe the final net change and its motivation for a reviewer without the
  conversation. Use concrete before/after behavior when helpful. Omit abandoned
  approaches, local absolute paths, and unsupported claims.
- Apply `conventional-commit.tpl.md` naming. For a single-commit PR, mirror its
  compliant commit subject exactly. For multiple coherent commits, use one
  Conventional Commit message summarizing the complete PR as the proposed squash
  subject, and use it verbatim as the PR title. Do not amend commits to match it.
- Fill the current PR template's meaningful headings and checklists. Check only
  actual completed validations; include typecheck and relevant integration
  results even if the template omits them. Distinguish not run, failed, and passed.
  Include material compatibility changes, limitations, and follow-up work.
- Link issues only when supplied or verified. Use closing keywords only when the
  PR actually resolves the issue. Do not invent issue numbers or review evidence.
- For an update, read the current title/body and preserve useful user-written
  context, issue links, screenshots, and notes while updating stale claims.
- Present the template's three labeled naming lines when drafting, then provide
  the filled body in an editable canvas if available. Otherwise use a Markdown
  body file or fenced Markdown block. Do not put those naming labels into the
  actual GitHub title/body. For multiple commits, label the proposed squash
  message in the accompanying explanation so it is not mistaken for an existing
  commit.

## Publish and verify

Finish and inspect the title/body before any publication. A creation request is
sufficient authorization; do not add a routine confirmation step. Use an explicit
repository/base/head and correct quoting for the active shell.

1. Confirm which commits will be pushed and that the remote head has not diverged.
   Push only the intended branch with an explicit refspec, for example
   `git push -u <remote> HEAD:refs/heads/<branch>`. Do not force-push, bypass hooks,
   pull an arbitrary branch, or change remotes on failure. Reinspect before retrying.
2. Write the filled body to a UTF-8 temporary file with actual newlines. With `gh`,
   use `gh pr create --repo <owner/repo> --base <base> --head <head> --title <title>
   --body-file <file>` and add `--draft` for a new PR unless the user requested
   ready-for-review. Use `owner:branch` for a fork head when needed. Do not rely on
   `--fill` or pass an unfilled template as the final body.
3. For a requested update, use the exact PR number and repository with
   `gh pr edit --title <title> --body-file <file>` for authorized title/body changes.
   Do not change an existing PR's review state implicitly. After a timeout or
   ambiguous API failure, look up the exact PR before retrying to avoid duplicates.
4. Read back the PR URL, title, body, base/head, draft state, and head SHA. Confirm
   the remote head matches the intended local commit and inspect current CI state
   (for example, `gh pr checks`). Pending CI is not a pass. Do not wait indefinitely
   or expand into CI repair unless requested; link failed checks and report them.

Report the PR link, creation/update and draft status, base/head, included change,
validation results, CI state, and any remaining local changes or blockers. For a
title/body-only preparation request, return the prepared text and state that it
is local; a request to create a draft PR still means publishing it on GitHub.
