# Pages Trigger and Privilege Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete issue #2 by explicitly regression-testing the Pages production trigger policy and separating read-only repository execution from privileged GitHub Pages deployment.

**Architecture:** Keep one Pages workflow, but split it into a read-only `build` job and a dependent privileged `deploy` job. The build job checks out the repository, runs Node 22 tests, builds the existing four-file `_site` artifact, configures Pages, and uploads exactly one `github-pages` artifact; the deploy job receives only Pages/OIDC write permissions and runs `actions/deploy-pages` after `build` succeeds.

**Tech Stack:** GitHub Actions YAML, Node.js 22, Node built-in test runner, GitHub Pages.

## Global Constraints

- Preserve calculator HTML, CSS, JavaScript, formulas, visible behavior, and browser storage behavior byte-for-byte.
- Preserve Node 22.
- Preserve 10-minute job bounds.
- Preserve the current immutable Action SHAs and human-readable major-version comments.
- Preserve the exact four-file `_site` artifact: `index.html`, `styles.css`, `app.js`, `src/calculators.mjs`.
- Preserve the `github-pages` environment and `pages` concurrency group.
- Production Pages execution remains limited to pushes to `main` and manual `workflow_dispatch`; never add a `pull_request` trigger or other push branches.
- `build` receives only `contents: read`.
- `deploy` receives only `pages: write` and `id-token: write` and declares `needs: build`.
- The deploy job must not execute repository-controlled `npm` or `node` commands.
- Add no dependencies, analytics, external scripts, APIs, cookies, or broader permissions.
- Keep this work in a separate PR linked to issue #2.
- Do not merge without explicit user approval.

---

### Task 1: Strengthen the Pages trigger policy regression test

**Files:**
- Modify: `tests/workflows.test.mjs`

**Interfaces:**
- Consumes: `.github/workflows/pages.yml` as UTF-8 text.
- Produces: a regression test named `Pages workflow trigger policy is main-only or manual` that requires the exact production trigger block.

- [ ] **Step 1: Add the explicit trigger-policy test**

Replace the current Pages workflow test with a focused trigger test plus the existing workflow/action checks. Add this test before the privilege-isolation test introduced in Task 2:

```js
test("Pages workflow trigger policy is main-only or manual", async () => {
  const workflow = await readFile(".github/workflows/pages.yml", "utf8");
  assert.match(
    workflow,
    /^on:\n  push:\n    branches: \["main"\]\n  workflow_dispatch:\s*$/m,
  );
  assert.doesNotMatch(workflow, /^\s*pull_request:\s*$/m);
});
```

This exact block intentionally fails if another production push branch is added or if a pull-request trigger appears.

- [ ] **Step 2: Run the focused trigger test**

Run:

```bash
node --test --test-name-pattern="Pages workflow trigger policy" tests/workflows.test.mjs
```

Expected: PASS on the current workflow, because PR #1 already restricted production execution to `main` pushes plus manual dispatch. This step converts that existing behavior into an explicit regression contract; the RED cycle for issue #2 occurs in Task 2 on the new privilege boundary.

- [ ] **Step 3: Commit the trigger-policy regression test**

```bash
git add tests/workflows.test.mjs
git commit -m "test: lock Pages deployment triggers"
```

---

### Task 2: Enforce and implement per-job privilege isolation

**Files:**
- Modify: `tests/workflows.test.mjs`
- Modify: `.github/workflows/pages.yml`

**Interfaces:**
- Consumes: the existing Pages workflow, immutable Action pins, `npm test`, `npm run build`, and `_site` artifact boundary.
- Produces: a two-job workflow where `build` has only `contents: read`, `deploy` has only `pages: write` plus `id-token: write`, and `deploy` depends on `build`.

- [ ] **Step 1: Add helpers for extracting the two job blocks**

Add this helper below `assertApprovedActions`:

```js
function jobBlock(workflow, jobName, nextJobName = null) {
  const start = workflow.indexOf(`  ${jobName}:\n`);
  assert.notEqual(start, -1, `missing ${jobName} job`);
  if (!nextJobName) {
    return workflow.slice(start);
  }
  const end = workflow.indexOf(`  ${nextJobName}:\n`, start + 1);
  assert.notEqual(end, -1, `missing ${nextJobName} job`);
  return workflow.slice(start, end);
}
```

- [ ] **Step 2: Add the failing privilege-isolation test**

Add:

```js
test("Pages workflow isolates read-only build from privileged deploy", async () => {
  const workflow = await readFile(".github/workflows/pages.yml", "utf8");
  const build = jobBlock(workflow, "build", "deploy");
  const deploy = jobBlock(workflow, "deploy");

  assert.match(workflow, /^permissions: \{\}$/m);

  assert.match(build, /^  build:\n    permissions:\n      contents: read$/m);
  assert.doesNotMatch(build, /^\s*(?:pages: write|id-token: write)$/m);
  assert.match(build, /^\s*run: npm test$/m);
  assert.match(build, /^\s*run: npm run build$/m);
  assert.match(build, /actions\/upload-pages-artifact@7b1f4a764d45c48632c6b24a0339c27f5614fb0b/);

  assert.match(
    deploy,
    /^  deploy:\n    permissions:\n      pages: write\n      id-token: write\n    needs: build$/m,
  );
  assert.doesNotMatch(deploy, /^\s*contents: read$/m);
  assert.doesNotMatch(deploy, /^\s*run:\s*(?:npm|node)\b/m);
  assert.match(deploy, /actions\/deploy-pages@d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e/);

  assertApprovedActions(
    workflow,
    new Map([
      ["actions/checkout", "11d5960a326750d5838078e36cf38b85af677262"],
      ["actions/setup-node", "49933ea5288caeca8642d1e84afbd3f7d6820020"],
      ["actions/configure-pages", "983d7736d9b0ae728b81ab479565c72886d7745b"],
      ["actions/upload-pages-artifact", "7b1f4a764d45c48632c6b24a0339c27f5614fb0b"],
      ["actions/deploy-pages", "d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e"],
    ]),
  );
});
```

- [ ] **Step 3: Run the focused isolation test and verify RED**

Run:

```bash
node --test --test-name-pattern="isolates read-only build" tests/workflows.test.mjs
```

Expected: FAIL because the current workflow has one `deploy` job, grants `contents: read`, `pages: write`, and `id-token: write` at workflow level, and executes tests/build under those privileges.

- [ ] **Step 4: Refactor `.github/workflows/pages.yml` minimally**

Replace the workflow with exactly:

```yaml
name: Validate and deploy GitHub Pages

on:
  push:
    branches: ["main"]
  workflow_dispatch:

permissions: {}

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    permissions:
      contents: read
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Check out repository
        uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4

      - name: Set up Node.js
        uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4
        with:
          node-version: 22

      - name: Run checks and tests
        run: npm test

      - name: Build public artifact
        run: npm run build

      - name: Configure Pages
        uses: actions/configure-pages@983d7736d9b0ae728b81ab479565c72886d7745b # v5

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@7b1f4a764d45c48632c6b24a0339c27f5614fb0b # v4
        with:
          path: _site

  deploy:
    permissions:
      pages: write
      id-token: write
    needs: build
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Deploy
        id: deployment
        uses: actions/deploy-pages@d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e # v4
```

Do not add checkout, Node setup, repository commands, or `contents: read` to the deploy job.

- [ ] **Step 5: Run the focused policy tests and verify GREEN**

Run:

```bash
node --test --test-name-pattern="Pages workflow" tests/workflows.test.mjs
```

Expected: all Pages workflow policy tests pass.

- [ ] **Step 6: Run the full test suite**

Run:

```bash
npm test
```

Expected: all existing calculator/build/validation tests plus the strengthened Pages policy tests pass with zero failures.

- [ ] **Step 7: Build and verify the public artifact boundary**

Run:

```bash
npm run build
find _site -type f | sort
cmp index.html _site/index.html
cmp styles.css _site/styles.css
cmp app.js _site/app.js
cmp src/calculators.mjs _site/src/calculators.mjs
```

Expected file inventory:

```text
_site/app.js
_site/index.html
_site/src/calculators.mjs
_site/styles.css
```

Every `cmp` must exit `0` with no output.

- [ ] **Step 8: Review the final diff for scope**

Run:

```bash
git diff main...HEAD -- .github/workflows/pages.yml tests/workflows.test.mjs docs/superpowers/specs/2026-08-14-pages-trigger-privilege-isolation-design.md docs/superpowers/plans/2026-08-14-pages-trigger-privilege-isolation.md
```

Expected: only the Pages workflow, workflow-policy tests, approved spec, and this plan changed. No `index.html`, `styles.css`, `app.js`, `src/calculators.mjs`, package metadata, or dependency file changes.

- [ ] **Step 9: Commit the privilege-isolation implementation**

```bash
git add .github/workflows/pages.yml tests/workflows.test.mjs
git commit -m "ci: isolate Pages deployment privileges"
```

- [ ] **Step 10: Open the follow-up PR without merging**

Open a PR from `security/pages-privilege-isolation` to `main` titled:

```text
Isolate GitHub Pages deployment privileges
```

The PR body must:
- link issue #2;
- state the exact trigger and permission boundaries;
- report RED→GREEN evidence, full test/build/artifact results, and final diff scope;
- mention that deployment/live-site verification occurs only after a separately approved merge;
- explicitly state that the PR is left unmerged pending approval.
