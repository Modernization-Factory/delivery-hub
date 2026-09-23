#!/usr/bin/env node
/**
 * Runs the API and the Vite dev server together, so local development is one command.
 *
 * Deliberately dependency-free — no concurrently/npm-run-all — because the repo has no
 * root package to install into and this is short enough not to warrant one.
 *
 * The two child processes are spawned directly rather than through `npm run`, so there
 * is no npm wrapper between us and the process: killing the wrapper can leave the real
 * server orphaned holding the port, which is exactly the confusion this is meant to
 * avoid. Ctrl-C stops both; if either exits on its own, the other is stopped too, so
 * you never end up with half the stack running.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tty = process.stdout.isTTY;
const c = (code, s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const die = (msg) => { console.error("\n" + c(31, "✗ ") + msg + "\n"); process.exit(1); };

// ---- preflight: fail with a fixable message rather than a stack trace ----
for (const dir of ["api", "web"]) {
  if (!fs.existsSync(path.join(root, dir, "node_modules"))) {
    die(`${dir}/node_modules is missing. Run:\n\n    npm run setup\n`);
  }
}
if (!fs.existsSync(path.join(root, "api/.env"))) {
  die("api/.env is missing — the API cannot start without MONGODB_URI.\n\n" +
      "    cp api/.env.example api/.env    # then set MONGODB_URI\n");
}

const vite = path.join(root, "web/node_modules/.bin/vite");
if (!fs.existsSync(vite)) die("web/node_modules/.bin/vite is missing. Run:\n\n    npm run setup\n");

const targets = [
  { name: "api", colour: 36, cwd: path.join(root, "api"), cmd: process.execPath, args: ["--env-file=.env", "src/server.js"] },
  { name: "web", colour: 35, cwd: path.join(root, "web"), cmd: vite, args: [] },
];

const children = [];
let shuttingDown = false;

function stopAll(signal = "SIGTERM") {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const ch of children) if (ch.exitCode === null && ch.signalCode === null) ch.kill(signal);
}

for (const t of targets) {
  const label = c(t.colour, t.name.padEnd(3));
  const child = spawn(t.cmd, t.args, { cwd: t.cwd, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
  children.push(child);

  // Line-buffer so a prefix never lands mid-line when both write at once.
  for (const stream of [child.stdout, child.stderr]) {
    let buf = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      buf += chunk;
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const line of lines) console.log(`${label} │ ${line}`);
    });
    stream.on("end", () => { if (buf.trim()) console.log(`${label} │ ${buf}`); });
  }

  child.on("error", (err) => { console.error(`${label} │ failed to start: ${err.message}`); stopAll(); });
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    console.log(`${label} │ exited (${signal || "code " + code}) — stopping the other process too`);
    stopAll();
    process.exitCode = code === null ? 1 : code;
  });
}

for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => stopAll(sig));

console.log(`
  ${c(36, "api")}  http://localhost:${process.env.PORT || 8080}
  ${c(35, "web")}  http://localhost:5173   ${c(90, "← open this one")}

  ${c(90, "Ctrl-C stops both.")}
`);
