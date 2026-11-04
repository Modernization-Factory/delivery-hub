/**
 * Resets timecard editing in a saved permission matrix to Project Manager only.
 *
 * Changing the capability defaults in rules.js only reaches matrices that never stored
 * a value: once an Admin saves the matrix, every box is stored, and a Lead (or any other
 * role) ticked back then keeps the right. This unticks every role except Project Manager
 * for the two timecard editing capabilities:
 *
 *   timecard.editAll   edit SF / JIRA statuses · import the weekly file · add a week
 *   timecard.flag      flag outlier weeks and comment on them
 *
 * Admin always has every capability, so after this only PMs and Admins edit timecards.
 * Viewing the grid and insights (timecard.insights) is left alone. Both boxes stay
 * editable in Administration afterwards.
 *
 * Touches only those two entries of the "global" permissions document; every other
 * capability is written back exactly as stored. Idempotent. Dry run unless --write.
 *
 *   node scripts/reset-timecard-edit-perms.js                     # dry run, local
 *   node scripts/reset-timecard-edit-perms.js --write
 *   MONGODB_URI="<atlas-uri>" DB_NAME=deliveryhub node scripts/reset-timecard-edit-perms.js --write
 */
const { MongoClient } = require("mongodb");
const R = require("../src/rules");

const WRITE = process.argv.includes("--write");
const URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const DB = process.env.DB_NAME || "deliveryhub";
const CAPS = ["timecard.editAll", "timecard.flag"];
const ROLES = ["Developer", "Senior Developer", "Lead", "Project Manager", "Viewer", "Team Manager"];
const TARGET = Object.fromEntries(ROLES.map((r) => [r, r === "Project Manager"]));

(async () => {
  const client = new MongoClient(URI);
  await client.connect();
  try {
    const db = client.db(DB);
    const doc = await db.collection("permissions").findOne({ _id: "global" });
    if (!doc || !doc.perms) {
      console.log(`No saved permission matrix in ${DB} — the built-in defaults apply, which already limit timecard editing to PM and Admin. Nothing to do.`);
      return;
    }
    // what each role effectively has now (stored values over the defaults)
    const before = R.mergePerms(doc.perms);
    const changes = [];
    for (const cap of CAPS) for (const role of ROLES) {
      if (!!before[cap][role] !== TARGET[role]) changes.push(`${cap.padEnd(17)} ${role.padEnd(17)} ${before[cap][role] ? "on" : "off"} -> ${TARGET[role] ? "on" : "off"}`);
    }
    if (!changes.length) {
      console.log(`Already correct in ${DB}: only PM (and Admin) can edit or flag timecards.`);
      return;
    }
    console.log(`${WRITE ? "Changing" : "Would change"} in ${DB}:`);
    changes.forEach((c) => console.log("  " + c));
    if (!WRITE) {
      console.log("\nDry run — re-run with --write to apply.");
      return;
    }
    // capability ids contain a dot, so they can't be addressed as a $set path — write the
    // whole object back with only these two entries replaced
    const perms = { ...doc.perms };
    for (const cap of CAPS) perms[cap] = { ...(perms[cap] || {}), ...TARGET };
    await db.collection("permissions").updateOne({ _id: "global" }, { $set: { perms, updatedAt: new Date(), updatedBy: "reset-timecard-edit-perms" } });
    await db.collection("auditLog").insertOne({ at: new Date(), actor: "reset-timecard-edit-perms (script)", role: "script", action: "permissions.update", method: "SCRIPT", path: "scripts/reset-timecard-edit-perms.js", body: { caps: CAPS, set: TARGET } });
    console.log(`\nDone — ${changes.length} change(s) written and recorded in the audit log.`);
  } finally {
    await client.close();
  }
})().catch((e) => { console.error(e.message || e); process.exit(1); });
