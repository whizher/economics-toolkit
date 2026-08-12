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
