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

test("Pages workflow trigger policy is main-only or manual", async () => {
  const workflow = await readFile(".github/workflows/pages.yml", "utf8");
  assert.match(
    workflow,
    /^on:\n  push:\n    branches: \["main"\]\n  workflow_dispatch:\s*$/m,
  );
  assert.doesNotMatch(workflow, /^\s*pull_request:\s*$/m);
});

test("Pages workflow remains bounded and immutably pinned", async () => {
  const workflow = await readFile(".github/workflows/pages.yml", "utf8");
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

test("Pages workflow isolates read-only build from privileged deploy", async () => {
  const workflow = await readFile(".github/workflows/pages.yml", "utf8");
  const build = jobBlock(workflow, "build", "deploy");
  const deploy = jobBlock(workflow, "deploy");

  assert.match(workflow, /^permissions: \{\}$/m);

  assert.match(build, /^  build:\n    permissions:\n      contents: read$/m);
  assert.doesNotMatch(build, /^\s*(?:pages: write|id-token: write)$/m);
  assert.match(build, /^\s*run: npm test$/m);
  assert.match(build, /^\s*run: npm run build$/m);
  assert.match(
    build,
    /actions\/upload-pages-artifact@7b1f4a764d45c48632c6b24a0339c27f5614fb0b/,
  );

  assert.match(
    deploy,
    /^  deploy:\n    permissions:\n      pages: write\n      id-token: write\n    needs: build$/m,
  );
  assert.doesNotMatch(deploy, /^\s*contents: read$/m);
  assert.doesNotMatch(deploy, /^\s*run:\s*(?:npm|node)\b/m);
  assert.match(
    deploy,
    /actions\/deploy-pages@d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e/,
  );

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
