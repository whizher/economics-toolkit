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
