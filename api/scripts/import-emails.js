/**
 * Email import — fills employees.email from a Name / Email workbook, matching on name,
 * then sets `inactive` from it: employees with an email are active, those without are
 * inactive. Update-only: nothing is inserted, deleted or dropped, and no field other
 * than email / inactive is touched.
 *
 *   email     set only where the employee has none — an existing email is never
 *             overwritten unless that name is listed in REPLACE below
 *   inactive  false when the employee ends up with an email, true otherwise
 *
 * File names that differ from employees.name are mapped in ALIASES; anything still
 * unmatched is reported. An email already held by a different employee is refused
 * (emails are the login identity and unique).
 *
 * Run: node --env-file=.env scripts/import-emails.js <workbook.xlsx> [--write]
 *      without --write it is a dry run and only prints what would change.
 */
const { MongoClient } = require("mongodb");
const XLSX = require("xlsx");

// file name -> employees.name, confirmed by hand
const ALIASES = {
  "Amit Jain": "Amit Jain(L)",
  "Chaitanya Kuthiyala": "Chaitanya Kuthiala",
  "Manmeet Devgun": "Manmeet",
};
// existing emails the file may replace (placeholders, not real identities)
const REPLACE = ["Samriti Arora"];

const WRITE = process.argv.includes("--write");
const FILE = process.argv.slice(2).find((a) => !a.startsWith("--"));
const URI = process.env.MONGODB_URI;
const DB = process.env.DB_NAME || "deliveryhub";
if (!FILE) { console.error("Usage: node scripts/import-emails.js <workbook.xlsx> [--write]"); process.exit(1); }
if (!URI) { console.error("Set MONGODB_URI"); process.exit(1); }

const wb = XLSX.readFile(FILE);
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null })
  .map((r) => ({ name: String(r.Name || "").trim(), email: String(r.Email || "").trim().toLowerCase() }))
  .filter((r) => r.name && r.email);

(async () => {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db(DB);
  const now = new Date();

  const emps = await db.collection("employees").find().toArray();
  const byName = Object.fromEntries(emps.map((e) => [e.name, e]));
  const owner = Object.fromEntries(emps.filter((e) => e.email).map((e) => [e.email.toLowerCase(), e.name]));

  const emailFor = {}; // employees.name -> email to set
  const unmatched = [], kept = [], refused = [];
  for (const r of rows) {
    const name = ALIASES[r.name] || r.name;
    const e = byName[name];
    if (!e) { unmatched.push(r.name); continue; }
    if (e.email && e.email.toLowerCase() === r.email) continue;
    if (e.email && !REPLACE.includes(name)) { kept.push(`${name} (keeps ${e.email}, file has ${r.email})`); continue; }
    if (owner[r.email] && owner[r.email] !== name) { refused.push(`${name} -> ${r.email} (already on ${owner[r.email]})`); continue; }
    emailFor[name] = r.email;
    owner[r.email] = name;
  }

  const ops = [];
  const changes = { email: [], replaced: [], activate: [], deactivate: [] };
  for (const e of emps) {
    const set = {};
    const email = emailFor[e.name] || e.email || null;
    if (emailFor[e.name]) {
      set.email = emailFor[e.name];
      (e.email ? changes.replaced : changes.email).push(e.name + (e.email ? ` (${e.email} -> ${set.email})` : ` -> ${set.email}`));
    }
    const inactive = !email;
    if (!!e.inactive !== inactive) {
      set.inactive = inactive;
      (inactive ? changes.deactivate : changes.activate).push(e.name);
    }
    if (Object.keys(set).length) ops.push({ updateOne: { filter: { _id: e._id }, update: { $set: { ...set, updatedAt: now, updatedBy: "migration" } } } });
  }

  console.log(`file: ${rows.length} people · employees: ${emps.length}`);
  console.log(`emails to set:      ${changes.email.length}`);
  changes.replaced.forEach((x) => console.log(`email replaced:     ${x}`));
  console.log(`mark active:        ${changes.activate.length}`);
  console.log(`mark inactive:      ${changes.deactivate.length}${changes.deactivate.length ? " — " + changes.deactivate.join(", ") : ""}`);
  if (kept.length) console.log(`existing email kept: ${kept.join("; ")}`);
  if (refused.length) console.log(`refused (duplicate email): ${refused.join("; ")}`);
  if (unmatched.length) console.log(`not matched to an employee: ${unmatched.join(", ")}`);
  const adminsOff = emps.filter((e) => e.isAdmin && !(emailFor[e.name] || e.email));
  if (adminsOff.length) console.log(`WARNING — Admins left without email (would be inactive): ${adminsOff.map((e) => e.name).join(", ")}`);

  if (!WRITE) console.log("\nDry run — nothing written. Re-run with --write to apply.");
  else if (ops.length) {
    const res = await db.collection("employees").bulkWrite(ops, { ordered: false });
    console.log(`\nwritten: ${res.modifiedCount} employees updated`);
  } else console.log("\nNothing to write.");
  await client.close();
})().catch((e) => { console.error(e); process.exit(1); });
