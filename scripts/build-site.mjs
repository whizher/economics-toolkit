import { cp, mkdir, rm } from "node:fs/promises";

await rm("_site", { recursive: true, force: true });
await mkdir("_site/src", { recursive: true });

for (const file of ["index.html", "styles.css", "app.js"]) {
  await cp(file, "_site/" + file);
}
await cp("src/calculators.mjs", "_site/src/calculators.mjs");

console.log("Built _site with 4 approved public runtime files.");
