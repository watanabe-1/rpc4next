---
name: rpc4next-signed-commit
description: Create a task branch, validate changes, choose coherent commit boundaries, and make signed Git commits in rpc4next using repository rules. Use when the user requests this workflow or asks to finish current changes with a signed commit.
---

# rpc4next signed commit

Complete the requested work on a task branch and finish with verified signed
commits. Creating or discussing this skill does not authorize running its workflow.
Pushes and pull requests require a separate user request.

## Read the repository rules

Work from the Git repository root. Read these files at invocation time rather than
relying on this skill's snapshot of the rules:

- `AGENTS.md` and any nested `AGENTS.md` governing the changed files.
- `conventional-commit.tpl.md` for commit and branch naming.
- `package.json` for current Bun scripts and the declared Node version.

The commit template also describes PR output and a canvas. Apply its naming rules
here; its PR instructions apply when the user requests PR preparation or creation.
Do not expand a branch-to-commit task into a PR workflow.

## Inspect and create the branch

1. Inspect `git status --short --branch`, `git diff`, and `git diff --cached`.
   Inspect untracked files relevant to the task. Record existing changes so that
   unrelated user work stays out of the commit. Do not reset, stash, or unstage
   user changes to obtain a clean tree. If unrelated changes are already staged,
   resolve the commit scope with the user before committing.
   Check `git status` for unresolved conflicts and an in-progress merge, rebase,
   or cherry-pick. Do not start a new task commit or continue/abort an existing
   Git operation unless that operation is part of the user's request.
2. Choose the branch base from the user's instructions. Otherwise, use the current
   HEAD; do not silently switch to or update `main`. If HEAD is detached or the
   intended base is ambiguous in a way that affects the task, clarify first.
3. Follow the template's allowed types, optional scope, ASCII kebab-case segments,
   and length limit. The branch form is `type[/scope]/short-kebab-slug`; keep the
   portion after `type/`, including any scope and separator, within 40 characters.
   For example, `fix/client/preserve-query-unions` pairs with a `fix(client)` commit.
4. Validate the name with `git check-ref-format --branch <branch>`, then run
   `git switch -c <branch>`. Reuse an existing task branch only when the user's
   request or session context identifies it as the intended branch. Do not force
   overwrite a branch or create an extra branch when resuming the same task.

## Complete and validate the change

Keep changes within the requested scope and package boundaries. Follow the current
repository formatting tools, generated-file rules, and nested instructions.

For code changes, run all three commands from the repository root after the final
edit, and inspect each exit code:

```text
bun run test
bun run lint
bun run typecheck
```

Follow `AGENTS.md` for additional checks. In particular, changes affecting CLI
scanning, generated paths, route contracts, or integration routes require
`bun run integration:next-app:generate`. Inspect the resulting generated diff.
Changes to Next.js integration behavior also require relevant integration
validation of both library and fixture; run `bun run integration:next-app:e2e`
when that behavior is affected. Do not run broad e2e flows for unrelated changes.

For skill or documentation changes, validate the affected artifacts and run the
relevant repository lint checks. Do not claim unexecuted checks passed. A failing
required check blocks completion unless the user explicitly allows an exception;
fix failures within scope or report the blocker without committing incomplete work.

## Choose commit boundaries

Review the complete task diff before staging and decide whether one commit or a
short sequence best expresses the change. Briefly explain the grouping to the
user, then proceed within the authorized scope without a routine approval step.

- Split changes when they serve distinct purposes and can be reviewed or reverted
  independently. A preparatory refactor and a behavior change can be separate
  commits when the refactor preserves behavior and stands on its own.
- Keep an implementation with its regression tests, required generated artifacts,
  and documentation needed to describe the changed behavior. Keep coordinated
  package changes together when splitting would break their shared contract.
- Do not split solely by file, package, extension, or commit size. Do not mix
  unrelated cleanup into a task commit. Respect an explicit user request for one
  commit or a particular grouping when it remains coherent.
- Order dependent commits so each builds on earlier commits and remains usable.
  If partial staging would leave an invalid intermediate state, combine those
  changes. Validation of the complete working tree does not prove that a partial
  staged snapshot passes; validate that snapshot separately when needed or keep
  the dependent change together. Do not stash or discard user work to test it.

## Stage and sign

For each planned commit, stage only its changes and perform the following steps.
Stop the sequence if a commit or signature verification fails; preserve already
created commits and report the remaining work.

1. Review the final diff and use `git add -- <explicit-paths>` for task files only.
   If a file mixes task and unrelated changes, stage only the intended hunks.
   Inspect `git diff --cached --stat`, `git diff --cached`, and
   `git diff --cached --check` before committing. An empty task diff needs no commit.
   Check the staged file list for credentials, local environment files, temporary
   output, and unrelated lockfile or formatting changes. Review new and binary
   files that a text diff cannot adequately show. Do not force-add ignored files
   unless their inclusion is required by the task. Do not print secret values.
2. Form a single-line commit message from the actual staged change using
   `conventional-commit.tpl.md`: an allowed type, scope when clear, a concise
   sentence-case subject (ideally at most 72 characters), and no trailing period.
   Do not include the template's `Commit message:` label or Markdown backticks
   in the actual message.
   Describe the actual behavior or purpose, not merely the files edited. Identify
   compatibility breaks and follow any repository release policy; do not invent
   issue references, trailers, or release metadata.
3. Inspect the existing signing configuration with `git config --get` for
   `commit.gpgsign`, `user.signingkey`, `gpg.format`, and the relevant signer
   program. An unset `gpg.format` means the default OpenPGP format. Use the
   configured signing identity; do not embed a machine-specific key ID in this
   skill, alter Git configuration, generate a key, or access private key material.
   Confirm the effective author/committer identity with `git var GIT_AUTHOR_IDENT`
   and `git var GIT_COMMITTER_IDENT`. Keep the configured identity unless the
   user requests another; missing identity is a blocker, not permission to invent it.
4. Run `git commit -S -m <message>` using correct quoting for the active shell.
   For multiline messages explicitly required by the user, write a UTF-8 message
   file and use `git commit -S -F <file>`. `-S` requests a cryptographic signature;
   `--signoff` does not satisfy this requirement.
5. If signing fails, inspect the error and Git state before retrying. Never fall
   back to an unsigned commit, disable hooks, or amend an existing commit to hide
   the failure. Request user action only when the signer requires key access or
   interaction that the agent cannot complete. Preserve the prepared changes.
   For hook failures, inspect the error and working/index diffs. If a hook changes
   files, review those changes and repeat affected checks before restaging and
   retrying. Do not bypass hooks with `--no-verify`. Do not amend, rebase, or
   otherwise rewrite existing history unless the user requests it.

## Verify and report

After each commit, inspect `git show --stat --oneline HEAD` to confirm the actual
committed scope, then run `git verify-commit HEAD` and
`git log -1 --format='%h %s'`. Report signature
verification as successful only when verification succeeds. If a commit was
created but verification is unavailable or fails (for example, missing local SSH
allowed-signers configuration), report that state and the exact blocker without
creating another commit or rewriting history.

Inspect `git status --short --branch` and report the branch, each commit's hash and
subject, the grouping rationale, checks performed, signature verification results,
and any remaining changes. Never describe the tree as clean when unrelated
changes remain.
