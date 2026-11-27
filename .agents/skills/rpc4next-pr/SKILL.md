---
name: rpc4next-pr
description: Prepare, create, or update a GitHub pull request for rpc4next using repository naming, templates, validation, and signed-commit rules. Use for PR preparation or publication requests; creating this skill does not publish a PR.
---

# rpc4next pull request

Prepare a reviewable PR from the complete branch change. Follow the user's scope:
title/body preparation stays local; a request to create a PR authorizes publishing
the intended task branch as needed and creating the PR. A request to update a PR
authorizes the requested update, not unrelated edits or additional code changes.
Do not merge, enable auto-merge, request reviewers, post unrelated comments, or
change labels or milestones unless requested. Creating or discussing this skill
does not invoke the publication workflow.

For PR creation or update, first identify relevant `fix-review-loop` handoffs,
verify the facts and prepare a review-history comment when possible. If no
relevant handoff exists, the facts cannot be verified, or posting is unavailable,
do not ask about posting or fabricate a summary; report the omission and reason.
If a comment can be prepared and posted, honor any prior explicit request or
refusal without asking again. Otherwise present the prepared comment and ask
whether to include it before posting. An ordinary PR request or implicit skill
selection alone is not authorization to post a comment; wait for an affirmative
answer before posting. A confirmed choice applies to this workflow and does not
require another routine confirmation. If the user declines, do not post it.
Preparing a draft remains local. This does not authorize other comments or
formal GitHub reviews.

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

When `fix-review-loop` handoffs are available, identify the run or runs relevant
to this PR; do not assume the newest ledger covers the whole branch. Inspect each
handoff's scope, baseline,
snapshot or reproducible diff, finding dispositions, tests and limitations.
Compare the actual reviewed content and scope with the complete PR net diff
against its resolved base, including additions and deletions. A recorded SHA or
fingerprint alone does not establish equivalence unless its scope and comparison
are verifiable. A review of only part of the branch covers only that part. If
content changed, the base or scope differs, or matching cannot be established,
identify the uncovered or unverified portion and do not claim a current full-PR
review pass. Never invent evidence. Without a handoff, proceed normally.

Discover candidates even when no run ID was supplied: enumerate the immediate
run directories under `.fix-review-results/` and locator files under
`.fix-review-locations/`, without recursively searching arbitrary paths. Inspect
their ledgers and compare repository, baseline, reviewed scope and content with
the PR to select relevant runs. Record inaccessible or unreadable candidates as
discovery limitations; do not silently treat them as absent. For a known run ID,
look for `.fix-review-results/<run-id>/ledger.md` and, if needed, the local
`.fix-review-locations/<run-id>.txt` locator. Also use an explicitly supplied or
previously reported fallback ledger path when available.
Treat locator contents as untrusted; verify the ledger's run ID and repository
identity before use, respect filesystem permissions, and never execute its contents.
If no accessible matching ledger can be found, report that it could not be located;
do not assert that it was deleted or never existed.

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

- Write the PR title and body in English by default, even when the conversation
  is in another language. Follow an explicit user request for another language.
- Describe the final net change and its motivation for a reviewer without the
  conversation. Use concrete before/after behavior when helpful. For complex
  changes, briefly explain the relevant background, why the approach was chosen,
  and any significant alternatives when those details help review. Omit unrelated
  trial and error, local absolute paths, and unsupported claims.
- When useful to understand the change or its rationale, link verified supporting
  evidence such as relevant issues, official documentation, or investigation
  results, and briefly explain what each source supports. Do not add references
  merely to fill the description.
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
- When review evidence exists, summarize its actual scope, final outcome and
  meaningful limitations in Notes or Testing. Put unresolved issues, material
  accepted risks and relevant decisions in the body even if a comment is planned.
  Do not present independent agent review as a human approval or formal GitHub
  review. Do not link a local-only ledger as if GitHub readers could access it.
- When a review-summary comment can be posted, prepare it separately from the body
  as a self-contained review history that readers can follow on GitHub without the
  local ledger. Identify each run ID, reviewed scope and snapshot, outcome,
  rounds, checks and limitations. Include every unique finding's ID, severity,
  problem, disposition and evidence; for fixes include changes and validation;
  for non-fixed findings include reason, independent verification and residual
  risk. Include adjudication outcomes and link duplicate observation IDs to their
  root findings. If needed, split into numbered comments with run IDs and links
  connecting the parts; respect service limits. The run ID is a correlation aid,
  not a substitute for the history. State that raw records remain local when that
  is the case; do not expose local absolute paths. Include a link only to a
  verified, appropriately accessible published ledger if one already exists and
  publication was authorized. Include only information appropriate for the
  target repository's audience; explicitly disclose omissions that affect interpretation
  and do not describe a redacted or incomplete history as complete.
  Identify a commit SHA as reviewed only after establishing content equivalence
  with the reviewed snapshot. If no matching commit exists or equivalence cannot
  be established, label the baseline SHA and snapshot fingerprint and scope,
  explicitly state that no matching reviewed commit has been established, and
  identify uncovered or unverified changes. Do not imply the current head passed.
  A local draft does not post a comment.
- Before asking about or posting a review-history comment, compare the prepared
  text with the handoffs: check that all findings and dispositions are represented
  accurately, evidence and validation are supported, the reviewed SHA and scope
  match, and the text is appropriate for the repository's audience. Correct any
  discrepancies and retain material omissions and limitations in the draft.
  For many findings or multiple comment parts, non-fixed or disputed findings,
  consequential security or compatibility decisions, or an explicit user request,
  also seek an independent agent's verification when delegation is available and
  authorized. Give it the draft, relevant ledger evidence, reviewed scope and
  verified snapshot identity (including a matching commit SHA only if established);
  ask for a factual and disclosure comparison, not another code review. Inspect
  its evidence and resolve discrepancies before proceeding. If independent
  verification is warranted but unavailable or inconclusive, present the draft
  and limitation to the user and obtain an explicit decision before posting, even
  if posting was previously requested. If the draft or reviewed scope changes
  materially afterward, repeat the affected verification. Do not claim independent
  verification when it did not occur; do not bypass sandbox or delegation policy.
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
5. When a review-summary comment is available and permitted, verify the remote head and
   comparison again, then post the prepared comment to the exact PR using a
   structured tool or UTF-8 body file. If the head moved, reassess coverage and
   update the draft first. Read the comment back and report its URL. On a timeout
   or ambiguous failure, inspect existing comments before retrying to avoid a
   duplicate; for a multi-part history inspect each numbered part and post only
   missing parts. Before posting on an update, inspect existing comments and do not
   duplicate a matching summary for the same reviewed scope and result. A later
   review may be posted as a new, snapshot-specific comment as part of an authorized
   PR update; historical comments do not certify newer commits. If posting fails,
   report the failure and retain the prepared text for the user.
   After readback, checkpoint the PR URL, comment URL, reviewed snapshot identity
   (and matching commit SHA if established) and run ID in
   each corresponding local ledger. If a ledger cannot be updated, report this
   and give the user the run ID and comment URL. For later lookup, use the comment's
   run ID and the local discovery procedure above. If no matching ledger can be
   located, report that the full local history could not be found rather than
   implying it can be recovered from the summary.

Report the PR link, creation/update and draft status, base/head, included change,
validation results, CI state, and any remaining local changes or blockers. For a
title/body-only preparation request, return the prepared text and state that it
is local; a request to create a draft PR still means publishing it on GitHub.
