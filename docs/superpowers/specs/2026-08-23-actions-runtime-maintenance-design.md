# GitHub Actions Runtime Maintenance Design

**Date:** 2026-08-23

## Goal

Refresh the repository's pinned GitHub Actions to maintained Node-24-compatible releases where that can be done safely, while preserving the calculator application, the Node 22 project runtime, the existing privilege split, deterministic four-file Pages artifact, and explicit merge approval gate.

## Current state

The repository currently pins external Actions to immutable commits. The Pages workflow uses `actions/checkout` v4, `actions/setup-node` v4, `actions/configure-pages` v5, `actions/upload-pages-artifact` v4, and `actions/deploy-pages` v4. GitHub-hosted runners now emit Node 20 deprecation warnings for several of those Action runtimes.

The application itself has no dependency-install step and continues to target Node 22 in CI. The production Pages workflow already separates a read-only `build` job from the privileged `deploy` job and must keep that boundary unchanged.

## Scope

Update only the Action pins that have a maintained Node-24-compatible upstream generation and can be verified before pinning:

- `actions/checkout`: move from the current v4 commit to a verified immutable commit from the maintained v7 line.
- `actions/configure-pages`: move from the current v5 commit to a verified immutable commit whose `action.yml` uses Node 24.
- `actions/upload-pages-artifact`: move from the current v4 commit to a verified immutable commit from the maintained Node-24-compatible line and verify its transitive `actions/upload-artifact` dependency is current.
- `actions/deploy-pages`: move from the current v4 commit to a verified immutable commit whose `action.yml` uses Node 24.

Do **not** update `actions/setup-node` in this maintenance change. Keep the current immutable v4 pin until a maintained upstream release is verified to include the relevant dependency/security fixes while using the desired runtime. The project runtime remains `node-version: 22` regardless of Action-runtime generations.

## Pin-selection policy

Implementation must resolve each selected upstream Action to an exact 40-character commit SHA, never a mutable tag. Before editing this repository, verify the selected upstream commit corresponds to the intended maintained release/generation and inspect the upstream `action.yml` or release commit evidence for its runtime behavior.

The current maintenance investigation has already identified viable upstream candidates, including checkout v7.0.1 and Node-24 migrations in configure-pages and deploy-pages. The implementation plan must re-resolve and record the exact final SHAs immediately before editing so the PR does not rely on stale discovery data.

## Files expected to change

- `.github/workflows/validate.yml` — checkout pin only; setup-node remains unchanged.
- `.github/workflows/pages.yml` — checkout/configure-pages/upload-pages-artifact/deploy-pages pins only; setup-node, triggers, permissions, jobs, timeouts, concurrency, Node 22, artifact path, and deployment environment remain unchanged.
- `tests/workflows.test.mjs` — update immutable-pin regression expectations and, where useful, add assertions that the intended workflow structure and Node 22 project runtime remain unchanged.
- This design document and the later implementation plan.

No calculator HTML, CSS, JavaScript, build script, package metadata, or dependencies should change unless verification reveals a maintenance blocker. If such hidden complexity appears, stop and re-scope rather than bundling unrelated changes.

## Security and behavior invariants

- Workflow-level least privilege remains `permissions: {}` for Pages.
- `build` retains only `contents: read`.
- `deploy` retains only `pages: write` and `id-token: write`.
- Production Pages deployment remains limited to pushes to `main` and manual dispatch; pull requests do not deploy.
- Validation remains read-only.
- Node 22 remains the project test/build runtime.
- The `_site` artifact remains exactly the existing four approved public runtime files.
- No application behavior, analytics, networking, storage, or public content changes.
- All third-party Actions remain immutable-SHA pinned.

## Verification

Use TDD for the pin-regression change: first update/add expectations so they fail against the old pins, then update the workflow pins to make them pass.

Before opening the PR, run the complete repository test suite and production build. Verify the exact four-file `_site` inventory and byte equality against the approved source files. Review the final diff to ensure only workflow/test/spec/plan maintenance files changed.

After a separately approved merge, verify both the `Validate` and Pages runs on the exact merge SHA. Confirm build-to-deploy dependency behavior, exactly one `github-pages` artifact, successful deployment, and that the live calculator remains functional.

## Separate housekeeping findings

The old `security/harden-ci-pages` and `security/pages-privilege-isolation` branches are fully superseded by merged PRs and are safe stale-branch cleanup candidates. `main` is currently unprotected. Branch deletion and branch-protection/ruleset changes are intentionally separate from this PR because they are repository-administration operations and the current connector does not expose the required safe write controls.

## Merge gate

Open the implementation as an unmerged pull request. Do not merge without explicit user approval.