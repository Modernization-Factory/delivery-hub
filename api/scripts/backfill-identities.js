/**
 * Backfills sign-in identities onto the employee master.
 *
 * import-seed.js inserts every employee with `email: null`, so after any reload nobody
 * can sign in until this runs. Keeping the mapping in a file makes that repeatable
 * instead of a hand-typed mongosh session that gets lost between reloads.
 *
 * Update-only and idempotent: it never inserts, deletes or drops. It touches exactly
 * four fields — email, isAdmin, streamLead, viewer — and leaves everything else alone.
 *
 *   node scripts/backfill-identities.js scripts/identities.local.json            # dry run
 *   node scripts/backfill-identities.js scripts/identities.local.json --write
 *   MONGODB_URI="<atlas-uri>" node scripts/backfill-identities.js identities.prod.json --write
 *
 * Mapping file: { "Employee Name": "someone@mongodb.com", ... } — or, for flags:
 *   { "Employee Name": { "email": "...", "isAdmin": true, "streamLead": false } }
 *
 * Names must match employees.name exactly; anything that doesn't match is reported
 * rather than skipped silently, which is the failure mode of a bare updateOne (it
 * matches nothing and reports success).
 */
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

const file = process.argv[2];
const WRITE = process.argv.includes("--write");
if (!file) { console.error("Usage: node scripts/backfill-identities.js <mapping.json> [--write]"); process.exit(1); }

const URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const DB = process.env.DB_NAME || "deliveryhub";

const raw = JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
const wanted = Object.entries(raw).filter(([k]) => !k.startsWith("_")).map(([name, v]) => {
  const o = typeof v === "string" ? { email: v } : { ...v };
  if (!o.email) throw new Error(`"${name}" has no email in the mapping file`);
  o.email = String(o.email).trim().toLowerCase();
  return { name: name.trim(), ...o };
});

// Catch collisions before touching the database: employees.email carries a unique
// partial index, so a duplicate would fail mid-run and leave a half-applied mapping.
const byEmail = new Map();
for (const w of wanted) {
  if (byEmail.has(w.email)) throw new Error(`duplicate email ${w.email} (${byEmail.get(w.email)} and ${w.name})`);
  byEmail.set(w.email, w.name);
}

(async () => {
  const client = new MongoClient(URI);
  await client.connect();
  const emp = client.db(DB).collection("employees");

  const applied = [], unchanged = [], missing = [], conflicts = [];
  for (const w of wanted) {
    const doc = await emp.findOne({ name: w.name });
    if (!doc) { missing.push(w.name); continue; }
    // the same address already sitting on a different person
    const holder = await emp.findOne({ email: w.email, name: { $ne: w.name } });
    if (holder) { conflicts.push(`${w.email} already belongs to ${holder.name}`); continue; }

    const $set = { email: w.email };
    for (const f of ["isAdmin", "streamLead", "viewer"]) if (w[f] !== undefined) $set[f] = !!w[f];
    const same = Object.entries($set).every(([k, v]) => (doc[k] ?? (typeof v === "boolean" ? false : null)) === v);
    if (same) { unchanged.push(w.name); continue; }

    if (WRITE) await emp.updateOne({ name: w.name }, { $set: { ...$set, updatedAt: new Date(), updatedBy: "backfill-identities" } });
    applied.push(`${w.name} -> ${w.email}${$set.isAdmin ? " (isAdmin)" : ""}${$set.streamLead ? " (streamLead)" : ""}`);
  }

  const total = await emp.countDocuments();
  const withEmail = await emp.countDocuments({ email: { $type: "string" } });

  console.log(`${WRITE ? "applied" : "would apply"}: ${applied.length}`);
  applied.forEach((s) => console.log("  " + s));
  if (unchanged.length) console.log(`already correct: ${unchanged.length}`);
  if (missing.length) {
    console.log(`\nNOT FOUND in the employee master (${missing.length}) — check the spelling against employees.name:`);
    missing.forEach((n) => console.log("  - " + n));
  }
  if (conflicts.length) {
    console.log(`\nSKIPPED, address already in use (${conflicts.length}):`);
    conflicts.forEach((c) => console.log("  - " + c));
  }
  console.log(`\nemployees with a sign-in identity: ${WRITE ? withEmail : withEmail + " (before this run)"} / ${total}`);
  if (!WRITE) console.log("\ndry run — re-run with --write to apply");

  await client.close();
  if (missing.length || conflicts.length) process.exitCode = 1;
})().catch((e) => { console.error(e); process.exit(1); });
