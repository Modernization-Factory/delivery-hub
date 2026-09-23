// Guards the module boundaries the codebase was split along, so the structure
// documented in README.md cannot silently decay.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SRC = new URL("../src/", import.meta.url).pathname;

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? walk(p) : /\.jsx?$/.test(d.name) ? [p] : [];
  });
}
const files = walk(SRC);
const relOf = (p) => path.relative(SRC, p);
const importsOf = (p) => [...fs.readFileSync(p, "utf8").matchAll(/from "(\.[^"]+)"/g)]
  .map((m) => path.normalize(path.join(path.dirname(p), m[1])));

test("lib/ stays free of React and JSX so the logic is testable in plain node", () => {
  for (const f of files.filter((f) => relOf(f).startsWith("lib/"))) {
    const src = fs.readFileSync(f, "utf8");
    assert.ok(!/from "react"/.test(src), relOf(f) + " imports react");
    assert.ok(!/\.jsx"/.test(src), relOf(f) + " imports a .jsx module");
    assert.equal(path.extname(f), ".js", relOf(f) + " should be a plain .js module");
  }
});

test("lib/ never imports from ui/ or views/", () => {
  for (const f of files.filter((f) => relOf(f).startsWith("lib/"))) {
    for (const dep of importsOf(f)) {
      const r = relOf(dep);
      assert.ok(r.startsWith("lib/"), relOf(f) + " -> " + r);
    }
  }
});

test("views/ never import each other — shared pieces belong in ui/ or lib/", () => {
  for (const f of files.filter((f) => relOf(f).startsWith("views/"))) {
    for (const dep of importsOf(f)) {
      assert.ok(!relOf(dep).startsWith("views/"), relOf(f) + " -> " + relOf(dep));
    }
  }
});

test("there are no import cycles", () => {
  const graph = Object.fromEntries(files.map((f) => [f, importsOf(f)]));
  const cycles = [];
  const done = new Set();
  const visit = (n, stack) => {
    if (stack.includes(n)) return cycles.push([...stack.slice(stack.indexOf(n)), n].map(relOf).join(" -> "));
    if (done.has(n) || !graph[n]) return;
    graph[n].forEach((m) => visit(m, [...stack, n]));
    done.add(n);
  };
  files.forEach((f) => visit(f, []));
  assert.deepEqual(cycles, []);
});

test("App.jsx stays a thin shell — state, nav and routing only", () => {
  const lines = fs.readFileSync(path.join(SRC, "App.jsx"), "utf8").split("\n").length;
  assert.ok(lines < 600, "App.jsx grew to " + lines + " lines; move the new code into views/");
});

test("every view module exports exactly the screens it owns", () => {
  const views = files.filter((f) => relOf(f).startsWith("views/"));
  assert.ok(views.length >= 19, "expected one module per screen, found " + views.length);
  for (const f of views) {
    const src = fs.readFileSync(f, "utf8");
    assert.match(src, /^export function [A-Z]/m, relOf(f) + " exports no component");
    assert.ok(!/export default/.test(src), relOf(f) + " should use named exports");
  }
});

// React requires the same hooks, in the same order, on every render of a component.
// A view that returns early for one mode (TeamPlans renders an editor branch before
// its list branch) and then calls a hook further down renders fewer hooks the moment
// that branch is taken, and React throws "Rendered fewer hooks than expected" — a
// crash the single-pass render smoke tests cannot see, because they never re-render
// into the other branch.
test("views call no hook after a conditional early return", () => {
  for (const f of files.filter((f) => relOf(f).startsWith("views/"))) {
    const lines = fs.readFileSync(f, "utf8").split("\n");
    let earlyReturn = -1;
    let depth = 0;
    lines.forEach((l, i) => {
      if (/^  if\s*\(/.test(l)) depth = 1;
      if (depth && /^\s{4,}return\s*\(/.test(l) && earlyReturn < 0) earlyReturn = i;
      if (/^  \}/.test(l)) depth = 0;
    });
    if (earlyReturn < 0) continue;
    lines.forEach((l, i) => {
      const m = l.match(/\b(use[A-Z]\w*)\s*\(/);
      if (m && i > earlyReturn && /^  (const|let)\b/.test(l)) {
        assert.fail(`${relOf(f)}:${i + 1} calls ${m[1]}() after the early return on line ${earlyReturn + 1} — hoist it above that return`);
      }
    });
  }
});
