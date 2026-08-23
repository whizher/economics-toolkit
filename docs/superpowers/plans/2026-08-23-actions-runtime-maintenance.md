# GitHub Actions Runtime Maintenance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh the safe GitHub Actions pins to maintained Node-24-compatible immutable commits without changing calculator behavior, project Node 22, least-privilege job boundaries, or the exact four-file Pages artifact.

**Architecture:** Keep the existing two-workflow structure and the current build/deploy privilege split. Change only immutable Action references and the regression tests that pin them; use TDD to make the old pins fail first, then update the workflows to the exact approved SHAs and run the full existing verification boundary.

**Tech Stack:** GitHub Actions YAML, Node.js 22, Node built-in test runner, existing dependency-free build script.

**Spec:** `docs/superpowers/specs/2026-08-23-actions-runtime-maintenance-design.md`

## Global Constraints

- Keep project runtime `node-version: 22`.
- Keep `actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020` unchanged.
- Pin every changed Action to an exact 40-character SHA, never a mutable tag.
- Target pins:
  - `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1` (`v7.0.1`, Node 24).
  - `actions/configure-pages@45bfe0192ca1faeb007ade9deae92b16b8254a0d` (`v6`, Node 24).
  - `actions/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9` (`v5`, composite; transitively pins `actions/upload-artifact@bbbca2ddaa5d8feaa63e36b76fdaad77386f024f`).
  - `actions/deploy-pages@cd2ce8fcbc39b97be8ca5fce6e763baed58fa128` (`v5`, Node 24).
- Keep Pages workflow-level `permissions: {}`.
- Keep `build` permissions exactly `contents: read`.
- Keep `deploy` permissions exactly `pages: write` and `id-token: write`.
- Keep Pages triggers limited to pushes to `main` plus `workflow_dispatch`; do not add PR deployment.
- Keep validation read-only and PR-enabled.
- Keep all existing 10-minute job timeouts, concurrency, `github-pages` environment, `_site` path, and build-to-deploy dependency.
- Keep the production artifact exactly: `_site/index.html`, `_site/styles.css`, `_site/app.js`, `_site/src/calculators.mjs`.
- Do not change calculator runtime files, package metadata, dependencies, or build logic.
- Open an unmerged PR and do not merge without explicit user approval.

---

### Task 1: Move immutable-pin expectations to the approved maintenance SHAs

**Files:**
- Modify: `tests/workflows.test.mjs`
- Read only: `.github/workflows/validate.yml`
- Read only: `.github/workflows/pages.yml`

**Interfaces:**
- Consumes: existing `assertApprovedActions(workflow, approved)` helper and current workflow text.
- Produces: regression expectations that require the four new Action SHAs while preserving the existing setup-node SHA and workflow invariants.

- [ ] **Step 1: Update the validation-workflow approved map first**

Replace only the checkout expectation in the validation test:

```js
new Map([
  ["actions/checkout", "3d3c42e5aac5ba805825da76410c181273ba90b1"],
  ["actions/setup-node", "49933ea5288caeca8642d1e84afbd3f7d6820020"],
])
```

- [ ] **Step 2: Update both Pages approved maps and the focused privilege assertions**

Use these exact values everywhere the test file currently embeds old Action SHAs:

```js
new Map([
  ["actions/checkout", "3d3c42e5aac5ba805825da76410c181273ba90b1"],
  ["actions/setup-node", "49933ea5288caeca8642d1e84afbd3f7d6820020"],
  ["actions/configure-pages", "45bfe0192ca1faeb007ade9deae92b16b8254a0d"],
  ["actions/upload-pages-artifact", "fc324d3547104276b827a68afc52ff2a11cc49c9"],
  ["actions/deploy-pages", "cd2ce8fcbc39b97be8ca5fce6e763baed58fa128"],
])
```

Update the focused regexes in the privilege-isolation test to the same upload/deploy SHAs:

```js
/actions\/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9/
```

```js
/actions\/deploy-pages@cd2ce8fcbc39b97be8ca5fce6e763baed58fa128/
```

Do not alter the existing trigger, permission, timeout, build-command, or dependency assertions.

- [ ] **Step 3: Run the workflow policy tests and verify RED**

Run:

```bash
node --test tests/workflows.test.mjs
```

Expected: FAIL specifically because `.github/workflows/validate.yml` and `.github/workflows/pages.yml` still contain the old Action SHAs. Existing structural assertions should remain passing.

- [ ] **Step 4: Commit the RED test change**

```bash
git add tests/workflows.test.mjs
git commit -m "test: require maintained Actions runtime pins"
```

---

### Task 2: Refresh the validation workflow checkout pin

**Files:**
- Modify: `.github/workflows/validate.yml`
- Test: `tests/workflows.test.mjs`

**Interfaces:**
- Consumes: exact checkout SHA required by Task 1.
- Produces: validation workflow using checkout v7.0.1 while retaining setup-node v4, Node 22, read-only permissions, PR trigger, and 10-minute timeout.

- [ ] **Step 1: Replace only the checkout line**

Change:

```yaml
uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4
```

to:

```yaml
uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
```

Leave the setup-node line and every other workflow line unchanged.

- [ ] **Step 2: Run the validation-workflow test**

Run:

```bash
node --test tests/workflows.test.mjs
```

Expected: still FAIL because the Pages workflow has not yet been migrated; the validation-workflow pin assertion should now pass.

- [ ] **Step 3: Commit the validation workflow migration**

```bash
git add .github/workflows/validate.yml
git commit -m "ci: refresh validation checkout action"
```

---

### Task 3: Refresh the Pages workflow Action pins without changing privilege architecture

**Files:**
- Modify: `.github/workflows/pages.yml`
- Test: `tests/workflows.test.mjs`

**Interfaces:**
- Consumes: exact approved Action SHAs from Global Constraints.
- Produces: identical Pages workflow behavior using maintained immutable Action commits.

- [ ] **Step 1: Replace checkout only**

Use:

```yaml
uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
```

- [ ] **Step 2: Keep setup-node byte-for-byte unchanged**

Confirm this remains:

```yaml
uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4
with:
  node-version: 22
```

- [ ] **Step 3: Replace configure-pages**

Use:

```yaml
uses: actions/configure-pages@45bfe0192ca1faeb007ade9deae92b16b8254a0d # v6
```

- [ ] **Step 4: Replace upload-pages-artifact**

Use:

```yaml
uses: actions/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9 # v5
with:
  path: _site
```

- [ ] **Step 5: Replace deploy-pages**

Use:

```yaml
uses: actions/deploy-pages@cd2ce8fcbc39b97be8ca5fce6e763baed58fa128 # v5
```

Do not move steps between jobs and do not alter `permissions`, `needs`, triggers, timeouts, environment, concurrency, commands, or artifact path.

- [ ] **Step 6: Run the workflow policy tests and verify GREEN**

Run:

```bash
node --test tests/workflows.test.mjs
```

Expected: all workflow tests PASS.

- [ ] **Step 7: Commit the Pages workflow migration**

```bash
git add .github/workflows/pages.yml
git commit -m "ci: refresh Pages action runtimes"
```

---

### Task 4: Run the complete repository verification boundary

**Files:**
- Read only: all production/test/build files
- Generated only: `_site/` (must not be committed)

**Interfaces:**
- Consumes: migrated workflows and updated policy tests.
- Produces: evidence that application behavior and deterministic artifact boundary remain unchanged.

- [ ] **Step 1: Run the full test suite**

Run:

```bash
npm test
```

Expected: all tests PASS, including workflow policy, calculator behavior, and build-boundary tests.

- [ ] **Step 2: Run the production build separately**

Run:

```bash
npm run build
```

Expected: success and `_site/` contains only the approved runtime files.

- [ ] **Step 3: Verify exact artifact inventory**

Run:

```bash
find _site -type f -print | sort
```

Expected exactly:

```text
_site/app.js
_site/index.html
_site/src/calculators.mjs
_site/styles.css
```

- [ ] **Step 4: Verify built files are byte-identical to sources**

Run:

```bash
cmp index.html _site/index.html
cmp styles.css _site/styles.css
cmp app.js _site/app.js
cmp src/calculators.mjs _site/src/calculators.mjs
```

Expected: all commands exit 0 with no output.

- [ ] **Step 5: Confirm the diff is maintenance-only**

Run:

```bash
git diff --check main...HEAD
git diff --name-only main...HEAD
```

Expected changed paths are limited to:

```text
.github/workflows/pages.yml
.github/workflows/validate.yml
docs/superpowers/plans/2026-08-23-actions-runtime-maintenance.md
docs/superpowers/specs/2026-08-23-actions-runtime-maintenance-design.md
tests/workflows.test.mjs
```

- [ ] **Step 6: Commit only if verification produced an intentional tracked correction**

Normally no commit is expected here. If verification reveals a necessary change outside the listed maintenance files, stop and re-scope instead of committing it.

---

### Task 5: Open the unmerged maintenance PR and verify CI

**Files:**
- No additional repository file changes expected.

**Interfaces:**
- Consumes: fully verified maintenance branch.
- Produces: an unmerged PR ready for explicit user approval.

- [ ] **Step 1: Recompare branch to `main`**

Run:

```bash
git log --oneline --decorate main..HEAD
git diff --stat main...HEAD
```

Expected: only the approved workflow/test/spec/plan maintenance changes.

- [ ] **Step 2: Open the pull request**

Use title:

```text
Refresh GitHub Actions runtimes
```

PR body must summarize the four upgraded Action pins, explicitly state setup-node and project Node 22 are unchanged, state that no calculator runtime files changed, and include full test/build/artifact verification results.

- [ ] **Step 3: Verify PR-triggered validation**

Confirm the `Validate` workflow runs on the PR head and succeeds.

- [ ] **Step 4: Leave the PR unmerged**

Do not merge. Report the PR number, head SHA, validation result, exact changed-file scope, and any remaining Node-runtime warning caused by the intentionally retained setup-node v4 pin.
