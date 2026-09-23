/**
 * Rebuilds scripts/seed.json from the source workbooks in raw-seed-files/.
 *
 * Refreshes only the three datasets sourced from those workbooks:
 *   E (employees)  <- Leave Tracker EMPLOYEES  + role/release from Timecard-Proactiveness
 *   L (leaves)     <- Leave Tracker LEAVE
 *   C (comp-offs)  <- Leave Tracker COMP_OFF_EARNED
 *   H (holidays)   <- Leave Tracker SETTINGS
 *   T, W (timecard)<- Resource Allocation "Timecard-Proactiveness"
 *
 * A (allocations) and P (performance scores) are NOT in those workbooks, so they are
 * carried over verbatim from the existing seed.json. Rows in A/P naming someone who is
 * no longer in E would make import-seed.js throw on orphan(), so they are reported and
 * dropped rather than silently shipped.
 *
 * Parsing goes through src/rules.js (excelToISO, parseTimecardGrid, NAME_ALIASES) so the
 * seed is built by exactly the same code as the in-app .xlsx import.
 *
 * Usage: node scripts/build-seed.js [--write]
 *        without --write it is a dry run and only prints the diff summary.
 */
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const R = require("../src/rules");

const RAW = path.join(__dirname, "..", "..", "raw-seed-files");
const OUT = path.join(__dirname, "seed.json");
const LEAVE_WB = path.join(RAW, "Leave Tracker.xlsx");
const ALLOC_WB = path.join(RAW, "Copy of Resource Allocation - Mar'26 ++.xlsx");
const WRITE = process.argv.includes("--write");

const grid = (wb, name) => {
  const sh = wb.Sheets[name];
  if (!sh) throw new Error(`Sheet "${name}" not found in workbook`);
  return XLSX.utils.sheet_to_json(sh, { header: 1, raw: true, defval: null });
};
const txt = (v) => (v === null || v === undefined ? "" : String(v).trim());
const canonName = (v) => { const n = txt(v); return R.NAME_ALIASES[n] || n; };

const warn = [];

// ---- Timecard-Proactiveness: W, T, and the role/release master ----
const alloc = XLSX.readFile(ALLOC_WB);
const tc = R.parseTimecardGrid(grid(alloc, "Timecard-Proactiveness"));
if (tc.unknownStatuses) warn.push(`${tc.unknownStatuses} timecard cell(s) held an unrecognised status and were blanked`);
if (tc.duplicates) warn.push(`${tc.duplicates} duplicate person row(s) in Timecard-Proactiveness were skipped (first wins)`);
const W = tc.weeks;
const T = tc.rows.map((r) => [r.name, r.release, r.remarks, r.weeks]);
const meta = {};                                  // name -> { role, release, company }
tc.rows.forEach((r) => (meta[r.name] = { role: r.role, release: r.release, company: r.company }));

// ---- Leave Tracker ----
const lt = XLSX.readFile(LEAVE_WB);

// EMPLOYEES: header on row index 3 -> NAME | START DATE | TERMINATION DATE | COMPANY
const E = [];
const seenEmp = new Set();
for (const row of grid(lt, "EMPLOYEES").slice(4)) {
  const name = canonName(row[0]);
  if (!name) continue;
  if (seenEmp.has(name)) { warn.push(`duplicate employee row "${name}" collapsed (first wins)`); continue; }
  seenEmp.add(name);
  const m = meta[name] || {};
  E.push([name, m.role || "", txt(row[3]) || m.company || "", R.excelToISO(row[1]), R.excelToISO(row[2]), m.release || null]);
}
// Anyone on the timecard but missing from the employee master still needs an E row,
// or import-seed.js throws on orphan() when it reaches their timecard entries.
for (const r of tc.rows) {
  if (seenEmp.has(r.name)) continue;
  seenEmp.add(r.name);
  warn.push(`"${r.name}" is on Timecard-Proactiveness but not in EMPLOYEES — added with no start date`);
  E.push([r.name, r.role || "", r.company || "", null, null, r.release || null]);
}

// LEAVE: header on row index 2 -> NAME | START | END | TYPE | dup? | overlap?
const L = [];
for (const row of grid(lt, "LEAVE").slice(3)) {
  const name = canonName(row[0]);
  const s = R.excelToISO(row[1]), e = R.excelToISO(row[2]);
  if (!name || !s || !e) continue;
  L.push([name, s, e, txt(row[3]) || "Vacation"]);
}

// COMP_OFF_EARNED: header on row index 2, data offset one column
const C = [];
for (const row of grid(lt, "COMP_OFF_EARNED").slice(3)) {
  const name = canonName(row[1]);
  const dt = R.excelToISO(row[2]);
  if (!name || !dt) continue;
  C.push([name, dt, Number(row[3]) || 0, txt(row[4])]);
}

// SETTINGS: holiday list lives in column H (index 7), below the "HOLIDAY" label
const H = [];
const settings = grid(lt, "SETTINGS");
const hStart = settings.findIndex((r) => txt(r[7]).toUpperCase() === "HOLIDAY");
if (hStart < 0) throw new Error("Could not find the HOLIDAY header in SETTINGS column H");
for (const row of settings.slice(hStart + 1)) {
  const iso = R.excelToISO(row[7]);
  if (iso) H.push(iso);
}
H.sort();

// ---- carry over the datasets these workbooks do not own ----
const prev = JSON.parse(fs.readFileSync(OUT, "utf8"));

/**
 * The Timecard-Proactiveness export is a partial roster: it covers 63 people, while the
 * previous seed held 88, and the people it omits are still active in EMPLOYEES over the
 * same weeks. Treating the export as authoritative would retroactively erase their
 * history, so anyone absent from the new sheet keeps their previous rows, re-aligned
 * onto the new week axis BY DATE (never by position — the two axes differ in length,
 * and a positional copy would silently shift statuses into the wrong weeks).
 */
{
  const inNew = new Set(T.map((t) => t[0]));
  const slot = new Map(W.map((iso, i) => [iso, i]));
  let carried = 0, unplaceable = new Set();
  for (const [name, release, remarks, weeks] of prev.T || []) {
    if (inNew.has(name)) continue;
    const row = W.map(() => ["", ""]);
    let placed = 0;
    (prev.W || []).forEach((iso, i) => {
      const j = slot.get(iso);
      if (j === undefined) { if (weeks[i] && (weeks[i][0] || weeks[i][1])) unplaceable.add(iso); return; }
      row[j] = weeks[i] || ["", ""];
      placed++;
    });
    T.push([name, release, remarks, row]);
    carried++;
  }
  if (carried) warn.push(`MERGED: ${carried} person(s) absent from the new timecard sheet kept their previous history`);
  if (unplaceable.size) warn.push(`${unplaceable.size} previous week(s) fall outside the new week axis and were not carried: ${[...unplaceable].join(", ")}`);
  T.sort((a, b) => a[0].localeCompare(b[0]));
}
const A = prev.A || [];   // allocations      — source: Resource Allocation "Allocations" sheet
const P = prev.P || [];   // performance scores — entered in-app, no workbook source

/**
 * Someone dropped from the EMPLOYEES sheet but still named by any dataset is a leaver
 * whose history outlived their master record. import-seed.js throws on orphan() for
 * those rows, and deleting the rows instead would silently destroy history — so carry
 * the person forward from the previous seed and surface it. Retiring them for real is
 * a decision for the data owner, not this script.
 */
{
  const inMaster = new Set(E.map((e) => e[0]));
  const prevByName = Object.fromEntries((prev.E || []).map((e) => [e[0], e]));
  const where = new Map();  // name -> which datasets still reference them
  for (const [rows, label] of [[L, "leave"], [C, "comp-off"], [T, "timecard"], [A, "allocation"], [P, "score"]]) {
    for (const r of rows) {
      if (inMaster.has(r[0])) continue;
      where.set(r[0], (where.get(r[0]) || new Set()).add(label));
    }
  }
  const unresolved = [];
  for (const [name, labels] of where) {
    const tags = [...labels].join(", ");
    if (prevByName[name]) {
      warn.push(`CARRIED FORWARD: "${name}" is gone from EMPLOYEES but still has ${tags} history — kept from the previous seed`);
      E.push(prevByName[name]);
    } else {
      warn.push(`UNRESOLVED: "${name}" has ${tags} history but is in no employee master, old or new — rows dropped`);
      unresolved.push(name);
    }
  }
  E.sort((a, b) => a[0].localeCompare(b[0]));
  // only genuinely unresolvable names get their rows removed
  if (unresolved.length) {
    const drop = (rows) => rows.filter((r) => !unresolved.includes(r[0]));
    [L, C, T, A, P].forEach((rows, i) => { const k = drop(rows); rows.length = 0; rows.push(...k); });
  }
}

const known = new Set(E.map((e) => e[0]));
for (const [rows, label] of [[L, "leave"], [C, "comp-off"], [T, "timecard"], [A, "allocation"], [P, "score"]]) {
  const bad = [...new Set(rows.map((r) => r[0]).filter((n) => !known.has(n)))];
  if (bad.length) throw new Error(`${label} rows still reference unknown employees: ${bad.join(", ")}`);
}

const out = { E, L, C, T, W, H, A, P };

const n = (o) => Object.fromEntries(Object.keys(o).map((k) => [k, o[k].length]));
const before = n(prev), after = n(out);
console.log("dataset   before   after   delta");
for (const k of Object.keys(after)) {
  const d = after[k] - before[k];
  console.log(`  ${k.padEnd(8)} ${String(before[k]).padStart(5)} ${String(after[k]).padStart(7)}   ${d > 0 ? "+" + d : d}`);
}
console.log(`\nweeks: ${before.W ? prev.W[0] + "…" + prev.W[prev.W.length - 1] : "-"}  ->  ${W[0]}…${W[W.length - 1]}`);
if (warn.length) { console.log("\nwarnings:"); warn.forEach((w) => console.log("  - " + w)); }

if (WRITE) {
  fs.writeFileSync(OUT, JSON.stringify(out, null, 0) + "\n");
  console.log(`\nwrote ${OUT}`);
} else {
  console.log("\ndry run — re-run with --write to update seed.json");
}
