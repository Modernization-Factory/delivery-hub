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

// The Working Days tab nets leave and comp-off across the whole team, so it is a PM / Admin
// tool: the button must not exist for anyone else, not merely be disabled.
test("the Working Days tab is offered to PM / Admin only", () => {
  assert.ok(harness.renderScreen("AllocationsView").includes("Working Days"), "a PM should see the tab");
  assert.ok(!harness.renderScreen("AllocationsViewAsLead").includes("Working Days"), "a Lead should not see the tab");
  assert.ok(!harness.renderScreen("AllocationsViewAsViewer").includes("Working Days"), "a Viewer should not see the tab");
});

test("the Working Days by-type split lists a leave type that isn't in settings", () => {
  const html = harness.renderScreen("AllocationsWorkingDaysOffList");
  assert.ok(html.includes("Tentative"), "the off-list type should get its own chip");
  assert.ok(html.includes("not in settings"), "and be labelled as off-list");
});

test("the harness covers every screen module in src/views", async () => {
  const fs = await import("node:fs");
  const views = fs.readdirSync(path.join(root, "src/views")).filter((f) => f.endsWith(".jsx"));
  assert.equal(views.length, 19);
  assert.ok(Object.keys(harness.SCREENS).length >= views.length);
});
