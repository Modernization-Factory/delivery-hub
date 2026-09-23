/**
 * Rebuilds scripts/ph-seed.json from the AMP APAC Program Health workbook in
 * raw-seed-files/.
 *
 *   projects   <- Program_Health_Projects (+ _closed, flagged closed:true)
 *   weekly     <- every WeeklyProjectHealth_<suffix> sheet
 *   pipeline   <- Pipeline_Health
 *   raid       <- RAID_Log
 *   milestones <- Milestones
 *
 * Usage: node scripts/build-ph-seed.js [--write]
 *        without --write it is a dry run and only prints the diff summary.
 */
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const R = require("../src/rules");

const RAW = path.join(__dirname, "..", "..", "raw-seed-files");
const OUT = path.join(__dirname, "ph-seed.json");
const WB = path.join(RAW, "AMP APAC Program Health - v2.0.xlsx");
const WRITE = process.argv.includes("--write");

const wb = XLSX.readFile(WB);
const grid = (name) => XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null });
const txt = (v) => (v === null || v === undefined ? "" : String(v).trim());
const num = (v) => (v === null || v === undefined || v === "" || isNaN(Number(v)) ? null : Number(v));
const warn = [];
const prev = JSON.parse(fs.readFileSync(OUT, "utf8"));

// The sheet stores probability as a fraction; the app's register wants H/M/L.
const PROB = { 1: "H", 0.75: "M", 0.5: "L" };
function probability(v) {
  if (typeof v !== "number") return txt(v).toUpperCase() || null;
  const m = PROB[v];
  if (!m) { warn.push(`unmapped RAID probability value ${v} — stored as-is`); return String(v); }
  return m;
}

// ---- projects (register rows only; blank template rows carry no name) ----
const projects = [];
const readProjects = (sheet, closed) => {
  for (const r of grid(sheet).slice(1)) {
    if (!r || !txt(r[0])) continue;
    projects.push({
      name: txt(r[0]), pm: txt(r[1]), phase: txt(r[2]),
      start: R.excelToISO(r[3]), end: R.excelToISO(r[4]),
      totalStories: num(r[6]), doneStories: num(r[7]),
      currentMargin: num(r[12]), keyUpdate: txt(r[15]), closed,
    });
  }
};
readProjects("Program_Health_Projects", false);
readProjects("Program_Health_Projects_closed", true);

/**
 * A project can drop out of the register while its weekly/RAID/milestone history stays
 * in the workbook. import-program-health.js resolves those rows through idByName, so a
 * missing register entry would import them with an undefined projectId and orphan the
 * history. Carry such projects forward from the previous seed instead.
 */
const byName = new Map(projects.map((p) => [p.name, p]));
const carryProject = (name) => {
  if (!name || byName.has(name)) return;
  const old = (prev.projects || []).find((p) => p.name === name);
  if (old) {
    warn.push(`CARRIED FORWARD: project "${name}" has history but is no longer in the register — kept from the previous seed`);
    projects.push({ ...old });
  } else {
    warn.push(`UNRESOLVED: project "${name}" has history but is in no register, old or new — rows will import with a null projectId`);
    projects.push({ name, pm: "", phase: "", start: null, end: null, totalStories: null, doneStories: null, currentMargin: null, keyUpdate: "", closed: true });
  }
  byName.set(name, true);
};

// ---- weekly health: one sheet per project/phase ----
// Sheet suffix is an abbreviation ("Bendigo" -> "Bendigo Bank"), so resolve it against
// the known project names: exact match first, then unique prefix match.
const knownNames = [...new Set([...projects.map((p) => p.name), ...(prev.projects || []).map((p) => p.name)])];
function resolveProject(suffix) {
  if (knownNames.includes(suffix)) return suffix;
  const hits = knownNames.filter((n) => n.startsWith(suffix));
  if (hits.length === 1) return hits[0];
  if (hits.length > 1) warn.push(`sheet suffix "${suffix}" matches ${hits.length} projects (${hits.join(", ")}) — used "${hits[0]}"`);
  else warn.push(`sheet suffix "${suffix}" matches no known project — used the suffix verbatim`);
  return hits[0] || suffix;
}

const weekly = [];
for (const sheet of wb.SheetNames.filter((s) => s.startsWith("WeeklyProjectHealth_"))) {
  const project = resolveProject(sheet.replace("WeeklyProjectHealth_", ""));
  carryProject(project);
  for (const r of grid(sheet).slice(1)) {
    const week = r && R.excelToISO(r[0]);
    if (!week) continue;
    weekly.push({
      project, week,
      hoursPlanned: num(r[1]), hoursBurnt: num(r[2]),
      scopeChanges: txt(r[3]).toUpperCase().startsWith("Y"),
      rag: txt(r[5]), oneLiner: txt(r[6]),
    });
  }
}

// ---- pipeline ----
const pipeline = [];
for (const r of grid("Pipeline_Health").slice(1)) {
  if (!r || !txt(r[0])) continue;
  pipeline.push({
    company: txt(r[0]), stage: txt(r[1]),
    potentialStart: R.excelToISO(r[2]) || "", potentialResources: num(r[3]),
    commentary: txt(r[4]), nextAction: txt(r[5]),
  });
}

// ---- raid ----
const raid = [];
for (const r of grid("RAID_Log").slice(1)) {
  if (!r || !txt(r[1])) continue;
  carryProject(txt(r[1]));
  raid.push({
    project: txt(r[1]), type: txt(r[2]), desc: txt(r[3]),
    impact: txt(r[4]).toUpperCase() || null, probability: probability(r[5]),
    owner: txt(r[6]), targetDate: R.excelToISO(r[7]), status: txt(r[8]),
    link: txt(r[9]), comments: txt(r[10]),
  });
}

// ---- milestones ----
const milestones = [];
for (const r of grid("Milestones").slice(1)) {
  if (!r || !txt(r[1])) continue;
  carryProject(txt(r[1]));
  milestones.push({
    project: txt(r[1]), name: txt(r[2]), phase: txt(r[3]),
    planned: R.excelToISO(r[4]), actual: R.excelToISO(r[5]),
    status: txt(r[6]), rag: txt(r[7]), comments: txt(r[8]),
  });
}

const out = { projects, weekly, pipeline, raid, milestones };

console.log("dataset      before   after   delta");
for (const k of Object.keys(out)) {
  const b = (prev[k] || []).length, a = out[k].length, d = a - b;
  console.log(`  ${k.padEnd(11)} ${String(b).padStart(5)} ${String(a).padStart(7)}   ${d > 0 ? "+" + d : d}`);
}
console.log("\nprojects: " + projects.map((p) => p.name + (p.closed ? " (closed)" : "")).join(" | "));
if (warn.length) { console.log("\nwarnings:"); warn.forEach((w) => console.log("  - " + w)); }

if (WRITE) {
  fs.writeFileSync(OUT, JSON.stringify(out, null, 0) + "\n");
  console.log(`\nwrote ${OUT}`);
} else {
  console.log("\ndry run — re-run with --write to update ph-seed.json");
}
