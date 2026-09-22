// Smoke-renders every screen. The views are JSX, so they are bundled with the
// esbuild that ships inside vite (no new dependency) and then rendered to a
// string — which catches missing imports and bad references that a bundle-only
// build cannot see.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bundle = path.join(root, "node_modules/.cache/render-harness.mjs");

execFileSync(path.join(root, "node_modules/.bin/esbuild"), [
  path.join(root, "test/render-harness.jsx"),
  "--bundle", "--format=esm", "--platform=node", "--jsx=automatic",
  "--outfile=" + bundle,
  "--external:react", "--external:react-dom", "--external:xlsx", "--external:lucide-react",
], { stdio: "pipe" });

const harness = await import(bundle);

for (const name of Object.keys(harness.SCREENS)) {
  test(name + " renders without throwing", () => {
    const html = harness.renderScreen(name);
    assert.ok(html.length > 200, name + " rendered suspiciously little markup");
  });
}

test("the harness covers every screen module in src/views", async () => {
  const fs = await import("node:fs");
  const views = fs.readdirSync(path.join(root, "src/views")).filter((f) => f.endsWith(".jsx"));
  assert.equal(views.length, 19);
  assert.ok(Object.keys(harness.SCREENS).length >= views.length);
});
