# Pages Trigger and Privilege Isolation Design

## Goal
Complete issue #2 by tightening production deployment trigger assertions and separating read-only repository execution from privileged GitHub Pages deployment, without changing calculator runtime behavior.

## Chosen approach
Use two jobs in the existing `.github/workflows/pages.yml`.

1. `build` runs checkout, Node setup, tests, and the allowlisted `_site` build with only `contents: read`.
2. `deploy` depends on `build`, downloads the Pages artifact, and performs Pages deployment with only `pages: write` and `id-token: write`.

This is preferred over a reusable workflow or two separate workflow files because it keeps one deployment transaction, preserves the existing `github-pages` environment/concurrency model, and minimizes moving parts.

## Trigger policy
Production Pages execution remains limited to:
- pushes to `main`; and
- manual `workflow_dispatch`.

Focused regression tests must explicitly reject a pull-request trigger and reject any production push branch other than `main`.

## Permission boundary
Workflow-level permissions will not grant Pages write/OIDC access to the build job.

- `build`: `contents: read` only.
- `deploy`: `pages: write` and `id-token: write` only.

`deploy` must declare `needs: build`, so it cannot execute unless the read-only job succeeds.

## Artifact flow
The existing four-file `_site` boundary remains unchanged:
- `index.html`
- `styles.css`
- `app.js`
- `src/calculators.mjs`

The build job uploads exactly one `github-pages` artifact. The deploy job consumes that artifact through `actions/deploy-pages`; it must not rerun repository-controlled tests or build commands.

## Invariants
- Preserve Node 22.
- Preserve 10-minute job bounds.
- Preserve current immutable GitHub Action SHAs and human-readable major-version comments.
- Preserve the `github-pages` environment and Pages concurrency group.
- Preserve calculator HTML, CSS, JavaScript, formulas, visible behavior, and browser storage behavior byte-for-byte.
- Add no dependencies, analytics, external scripts, APIs, cookies, or broader permissions.
- Keep this work in a separate PR linked to issue #2.
- Do not merge without explicit user approval.

## Verification
Use RED→GREEN policy tests:
1. Add failing assertions for exact `main` push restriction, no PR trigger, per-job permissions, and `deploy.needs: build`.
2. Refactor the workflow minimally.
3. Run focused workflow tests and the complete test suite.
4. Run `npm run build` and verify `_site` contains exactly the four approved files with byte-identical source copies.
5. Review the final diff and confirm no browser/runtime file changed.
6. Open a separate PR and stop before merge.

## Post-merge verification
After a separately approved merge, verify the first Pages workflow on `main`, confirm a single `github-pages` artifact is produced, confirm deployment succeeds, and smoke-test the live calculator.