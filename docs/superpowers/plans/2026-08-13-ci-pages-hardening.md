# CI and GitHub Pages Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden CI and GitHub Pages by pinning external Actions to immutable commits, bounding PR-triggered test execution, and publishing only an allowlisted build artifact through a dedicated Pages workflow.

**Architecture:** Add a tiny Node build script that creates `_site/` from exactly four public runtime files, cover the artifact boundary and workflow security invariants with Node built-in tests, harden the existing validation workflow, and add a separate Pages deployment workflow that never runs on pull requests. Keep the browser application code byte-for-byte unchanged.

**Tech Stack:** Static HTML/CSS/JavaScript, Node.js 22, Node built-in test runner, GitHub Actions, GitHub Pages.

## Global Constraints

- Preserve all calculator formulas, validation, DOM rendering, theme persistence, styles, and visible content.
- No runtime dependencies, frameworks, external scripts, analytics, APIs, cookies, or new browser storage.
- CI pull-request permissions remain exactly `contents: read`.
- Any job that executes repository-controlled Node code uses `timeout-minutes: 10`.
- Approved immutable pins:
  - `actions/checkout` -> `11d5960a326750d5838078e36cf38b85af677262` (`v4`)
  - `actions/setup-node` -> `49933ea5288caeca8642d1e84afbd3f7d6820020` (`v4`)
  - `actions/configure-pages` -> `983d7736d9b0ae728b81ab479565c72886d7745b` (`v5`)
  - `actions/upload-pages-artifact` -> `7b1f4a764d45c48632c6b24a0339c27f5614fb0b` (`v4`)
  - `actions/deploy-pages` -> `d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e` (`v4`)
- `_site/` contains only `index.html`, `styles.css`, `app.js`, and `src/calculators.mjs`.
- Do not publish tests, workflows, package metadata, docs, or other repository files.
- Pages deployment permissions are exactly `contents: read`, `pages: write`, and `id-token: write`.
- Pages deployment triggers only on pushes to `main` and manual dispatch; never on pull requests.
- Do not merge the resulting PR without explicit user approval.
- The current repository setting uses legacy branch Pages publishing; after merge, verify and if necessary switch Pages Source to GitHub Actions before relying on the new deployment workflow.

---

### Task 1: Create a privacy-bounded public build artifact

**Files:**
- Create: `scripts/build-site.mjs`
- Create: `tests/build.test.mjs`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: the four existing public runtime files `index.html`, `styles.css`, `app.js`, and `src/calculators.mjs`.
- Produces: `npm run build`, which recreates `_site/` with exactly those four files at their existing relative paths.

- [ ] **Step 1: Write the failing public-artifact regression test**

Create `tests/build.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

async function listFiles(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = join(prefix, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(join(directory, entry.name), relativePath)));
    } else {
      files.push(relativePath.replaceAll("\\", "/"));
    }
  }
  return files.sort();
}

test("build publishes only the approved browser runtime files", async () => {
  await rm("_site", { recursive: true, force: true });
  try {
    const result = spawnSync(process.execPath, ["scripts/build-site.mjs"], {
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(await listFiles("_site"), [
      "app.js",
      "index.html",
      "src/calculators.mjs",
      "styles.css",
    ]);

    for (const path of [
      "index.html",
      "styles.css",
      "app.js",
      "src/calculators.mjs",
    ]) {
      assert.deepEqual(await readFile("_site/" + path), await readFile(path));
    }
  } finally {
    await rm("_site", { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the focused test and verify it fails because the builder does not exist**

Run:

```bash
node --test tests/build.test.mjs
```

Expected: FAIL because `scripts/build-site.mjs` does not exist.

- [ ] **Step 3: Implement the minimal allowlisted builder**

Create `scripts/build-site.mjs`:

```js
import { cp, mkdir, rm } from "node:fs/promises";

await rm("_site", { recursive: true, force: true });
await mkdir("_site/src", { recursive: true });

for (const file of ["index.html", "styles.css", "app.js"]) {
  await cp(file, "_site/" + file);
}
await cp("src/calculators.mjs", "_site/src/calculators.mjs");

console.log("Built _site with 4 approved public runtime files.");
```

- [ ] **Step 4: Add the repository-native build command and ignore its output**

Update `package.json` scripts to include:

```json
"build": "node scripts/build-site.mjs"
```

while preserving:

```json
"check": "node --check app.js && node --check src/calculators.mjs",
"test": "npm run check && node --test"
```

Append this line to `.gitignore`:

```text
_site/
```

- [ ] **Step 5: Run the focused build test and verify it passes**

Run:

```bash
node --test tests/build.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Run the complete existing test command**

Run:

```bash
npm test
```

Expected: all calculator and build tests pass.

- [ ] **Step 7: Commit the public-artifact boundary**

```bash
git add .gitignore package.json scripts/build-site.mjs tests/build.test.mjs
git commit -m "build: publish only approved runtime files"
```

---

### Task 2: Harden pull-request validation against mutable Actions and runaway jobs

**Files:**
- Create: `tests/workflows.test.mjs`
- Modify: `.github/workflows/validate.yml`

**Interfaces:**
- Consumes: the existing `Validate` workflow.
- Produces: a read-only PR/push validation workflow with a 10-minute timeout and exact immutable pins for `actions/checkout` and `actions/setup-node`.

- [ ] **Step 1: Write the failing validation-workflow security test**

Create `tests/workflows.test.mjs` with these helpers and test:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

function actionUses(workflow) {
  return [
    ...workflow.matchAll(/^\s*uses:\s+([^@\s]+)@([^\s#]+)(?:\s+#.*)?$/gm),
  ].map(([, action, ref]) => [action, ref]);
}

function assertApprovedActions(workflow, approved) {
  const uses = actionUses(workflow);
  assert.equal(uses.length, approved.size);
  assert.deepEqual(new Set(uses.map(([action]) => action)), new Set(approved.keys()));
  for (const [action, ref] of uses) {
    assert.match(ref, /^[0-9a-f]{40}$/);
    assert.equal(ref, approved.get(action));
  }
}

test("validation workflow is read-only, bounded, and immutably pinned", async () => {
  const workflow = await readFile(".github/workflows/validate.yml", "utf8");
  assert.match(workflow, /^permissions:\n  contents: read$/m);
  assert.match(workflow, /^\s*timeout-minutes:\s*10$/m);
  assert.match(workflow, /^\s*pull_request:\s*$/m);
  assertApprovedActions(
    workflow,
    new Map([
      ["actions/checkout", "11d5960a326750d5838078e36cf38b85af677262"],
      ["actions/setup-node", "49933ea5288caeca8642d1e84afbd3f7d6820020"],
    ]),
  );
});
```

- [ ] **Step 2: Run the focused test and verify it fails on the current workflow**

Run:

```bash
node --test --test-name-pattern="validation workflow" tests/workflows.test.mjs
```

Expected: FAIL because the current workflow uses mutable `@v4` tags and has no `timeout-minutes`.

- [ ] **Step 3: Apply the minimal validation-workflow hardening**

Change `.github/workflows/validate.yml` to preserve its triggers and read-only permission while making the job body:

```yaml
jobs:
  test:
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
```

- [ ] **Step 4: Run the focused workflow test and verify it passes**

Run:

```bash
node --test --test-name-pattern="validation workflow" tests/workflows.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Run the repository test command**

Run:

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit the CI hardening**

```bash
git add .github/workflows/validate.yml tests/workflows.test.mjs
git commit -m "ci: harden validation workflow"
```

---

### Task 3: Add an explicit least-privilege GitHub Pages deployment workflow

**Files:**
- Modify: `tests/workflows.test.mjs`
- Create: `.github/workflows/pages.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: `npm test` and `npm run build` from Tasks 1 and 2.
- Produces: a main-branch/manual-only Pages workflow that uploads only `_site/`, plus repository documentation that no longer claims legacy branch publishing.

- [ ] **Step 1: Add a failing Pages-workflow security test**

Append to `tests/workflows.test.mjs`:

```js
test("Pages workflow deploys only from main or manual dispatch with least privilege", async () => {
  const workflow = await readFile(".github/workflows/pages.yml", "utf8");
  assert.match(
    workflow,
    /^permissions:\n  contents: read\n  pages: write\n  id-token: write$/m,
  );
  assert.doesNotMatch(workflow, /^\s*pull_request:\s*$/m);
  assert.match(workflow, /^\s*workflow_dispatch:\s*$/m);
  assert.match(workflow, /^\s*timeout-minutes:\s*10$/m);
  assert.match(workflow, /^\s*path:\s*_site$/m);
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

- [ ] **Step 2: Run the focused Pages test and verify it fails because the workflow does not exist**

Run:

```bash
node --test --test-name-pattern="Pages workflow" tests/workflows.test.mjs
```

Expected: FAIL with an `ENOENT` for `.github/workflows/pages.yml`.

- [ ] **Step 3: Create the pinned Pages workflow**

Create `.github/workflows/pages.yml` with exactly this behavior:

```yaml
name: Validate and deploy GitHub Pages

on:
  push:
    branches: ["main"]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
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

      - name: Deploy
        id: deployment
        uses: actions/deploy-pages@d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e # v4
```

- [ ] **Step 4: Update stale publishing documentation without changing product copy**

In `README.md`, replace:

```text
GitHub Actions runs the same checks on every push and pull request. GitHub Pages publishes the static site directly from the `main` branch.
```

with:

```text
GitHub Actions runs validation on every push and pull request. Production deploys use a separate GitHub Pages workflow that tests the repository, builds an allowlisted `_site/` artifact, and publishes only the browser runtime files.
```

Update the project structure block to include:

```text
├── scripts/build-site.mjs     # Allowlisted GitHub Pages artifact builder
├── tests/build.test.mjs       # Public-artifact boundary tests
├── tests/workflows.test.mjs   # CI/Pages security-policy tests
└── .github/workflows/        # Validation and Pages deployment
```

while retaining the existing application entries.

- [ ] **Step 5: Run the focused Pages workflow test and verify it passes**

Run:

```bash
node --test --test-name-pattern="Pages workflow" tests/workflows.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Run the full repository suite and explicit build**

Run:

```bash
npm test
npm run build
```

Expected: all tests pass and the build logs `Built _site with 4 approved public runtime files.`

- [ ] **Step 7: Independently inspect the artifact boundary**

Run:

```bash
find _site -type f | sort
cmp index.html _site/index.html
cmp styles.css _site/styles.css
cmp app.js _site/app.js
cmp src/calculators.mjs _site/src/calculators.mjs
```

Expected file list:

```text
_site/app.js
_site/index.html
_site/src/calculators.mjs
_site/styles.css
```

Every `cmp` must exit `0` with no output.

- [ ] **Step 8: Review the final diff for application-code invariance and workflow scope**

Run:

```bash
git diff main...HEAD -- . ':!docs/superpowers/**'
```

Expected: no changes to `index.html`, `styles.css`, `app.js`, or `src/calculators.mjs`; only `.gitignore`, `package.json`, the builder/tests, workflows, and README documentation change.

- [ ] **Step 9: Commit the Pages deployment migration**

```bash
git add .github/workflows/pages.yml README.md tests/workflows.test.mjs
git commit -m "ci: deploy Pages from a bounded artifact"
```

- [ ] **Step 10: Open a PR without merging**

Open a PR from `security/harden-ci-pages` to `main` titled:

```text
Harden CI and GitHub Pages deployment
```

The PR body must summarize immutable action pins, the 10-minute CI boundary, the four-file `_site/` allowlist, least-privilege deployment permissions, test/build evidence, and the operational note that the repository currently uses legacy Pages publishing. Stop before merge and wait for explicit user approval.

- [ ] **Step 11: Post-merge operational gate (do not perform before explicit merge approval)**

After a user-approved merge, query the repository Pages settings. If `build_type` remains `legacy`, instruct the user to change **Settings -> Pages -> Build and deployment -> Source** to **GitHub Actions** because the connected GitHub tool cannot write that repository setting. Then run or verify the new Pages workflow and confirm the live site still serves successfully over HTTPS. Do not claim the migration complete until the Pages API reports workflow-based publishing and the deployment succeeds.
