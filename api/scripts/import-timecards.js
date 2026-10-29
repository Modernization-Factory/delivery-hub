/**
 * Incremental timecard import — loads the Timecard-Proactiveness sheet of a workbook into
 * `timecards`, exactly like the in-app "Import weekly file" button: one upsert per
 * (employee, week). Safe on an established database: nothing is dropped or deleted, and
 * employees are never created or changed.
 *
 *   new (employee, week) cells  inserted
 *   existing cells              overwritten with the sheet's SF / JIRA status (the file is the source of truth)
 *
 * Rows naming someone not in `employees` are reported and skipped; inactive employees are skipped silently.
 *
 * Run: node --env-file=.env scripts/import-timecards.js <workbook.xlsx> [--week=YYYY-MM-DD] [--write]
 *      --week limits the import to that week ending (repeatable); without it every week in the sheet is loaded.
 *      without --write it is a dry run and only prints what would change.
 */
const { MongoClient } = require("mongodb");
const XLSX = require("xlsx");
const R = require("../src/rules");

const WRITE = process.argv.includes("--write");
const FILE = process.argv.slice(2).find((a) => !a.startsWith("--"));
const ONLY = process.argv.filter((a) => a.startsWith("--week=")).map((a) => a.slice(7));
const URI = process.env.MONGODB_URI;
const DB = process.env.DB_NAME || "deliveryhub";
if (!FILE) { console.error("Usage: node scripts/import-timecards.js <workbook.xlsx> [--write]"); process.exit(1); }
if (!URI) { console.error("Set MONGODB_URI"); process.exit(1); }
const d = (iso) => (iso ? new Date(iso + "T00:00:00Z") : null);
const iso = (dt) => (dt ? dt.toISOString().slice(0, 10) : null);

const wb = XLSX.readFile(FILE, { cellDates: true });
const wsName = wb.SheetNames.find((n) => n.toLowerCase().includes("proactive")) || wb.SheetNames.find((n) => n.toLowerCase().includes("timecard"));
if (!wsName) { console.error("No Timecard-Proactiveness sheet in " + FILE); process.exit(1); }
const parsed = R.parseTimecardGrid(XLSX.utils.sheet_to_json(wb.Sheets[wsName], { header: 1, raw: true, defval: null }));
if (!parsed.weeks.length || !parsed.rows.length) { console.error("Sheet \"" + wsName + "\" is not in the expected template"); process.exit(1); }
const absent = ONLY.filter((w) => !parsed.weeks.includes(w));
if (absent.length) { console.error("Week(s) not in the sheet: " + absent.join(", ") + ". Sheet weeks: " + parsed.weeks.join(", ")); process.exit(1); }

(async () => {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db(DB);
  const now = new Date();

  const idByName = {};
  const inactive = [];
  for (const e of await db.collection("employees").find({}, { projection: { name: 1, inactive: 1 } }).toArray()) {
    if (e.inactive) inactive.push(e.name);
    else idByName[e.name] = e._id;
  }
  const have = new Map((await db.collection("timecards").find().toArray()).map((t) => [String(t.employeeId) + "|" + iso(t.week), t]));

  const missing = [];
  const ops = [];
  let inserts = 0, changes = 0, same = 0;
  for (const r of parsed.rows) {
    const employeeId = idByName[r.name];
    if (!employeeId) { if (!inactive.includes(r.name)) missing.push(r.name); continue; }
    r.weeks.forEach(([sf, jira], i) => {
      const week = parsed.weeks[i];
      if (ONLY.length && !ONLY.includes(week)) return;
      const cur = have.get(String(employeeId) + "|" + week);
      const next = { sf: sf || null, jira: jira || null, release: r.release || null, remarks: r.remarks || null };
      // blank cells are inserted too, as in the in-app import — the grid needs a doc per person per week to edit
      if (!cur) inserts++;
      else if ((cur.sf || null) === next.sf && (cur.jira || null) === next.jira && (cur.release || null) === next.release && (cur.remarks || null) === next.remarks) {
        same++;
        return;
      } else changes++;
      ops.push({ updateOne: { filter: { employeeId, week: d(week) }, update: { $set: { ...next, updatedAt: now, updatedBy: "migration", source: "import" } }, upsert: true } });
    });
  }

  const dbWeeks = [...new Set([...have.values()].map((t) => iso(t.week)))].sort();
  console.log(`sheet "${wsName}": ${parsed.rows.length} people · ${parsed.weeks.length} weeks (${parsed.weeks[0]} → ${parsed.weeks[parsed.weeks.length - 1]})`);
  console.log(`database:  ${have.size} cells · ${dbWeeks.length} weeks${dbWeeks.length ? ` (${dbWeeks[0]} → ${dbWeeks[dbWeeks.length - 1]})` : ""}`);
  console.log(`new weeks: ${parsed.weeks.filter((w) => !dbWeeks.includes(w)).join(", ") || "none"}`);
  if (ONLY.length) console.log(`limited to week(s): ${ONLY.join(", ")}`);
  console.log(`timecards: ${inserts} to insert · ${changes} to update · ${same} unchanged`);
  if (parsed.unknownStatuses) console.log(`unrecognised status values (imported as blank): ${parsed.unknownStatuses}`);
  if (parsed.duplicates) console.log(`duplicate name rows in sheet (first kept): ${parsed.duplicates}`);
  if (missing.length) console.log(`skipped — not in employees: ${missing.join(", ")}`);

  if (!WRITE) {
    console.log("\nDry run — nothing written. Re-run with --write to apply.");
  } else if (ops.length) {
    const res = await db.collection("timecards").bulkWrite(ops, { ordered: false });
    console.log(`\nwritten: ${res.upsertedCount} inserted · ${res.modifiedCount} updated`);
  } else {
    console.log("\nNothing to write.");
  }
  await client.close();
})().catch((e) => { console.error(e); process.exit(1); });
