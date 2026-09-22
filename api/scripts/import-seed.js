/**
 * One-time Atlas import for DeliveryHub — loads all data reconciled from the four
 * source workbooks: employees, leaves, comp-offs, timecards, projects, assignments,
 * performance scores, settings, and default permissions.
 * Usage: MONGODB_URI="..." DB_NAME="deliveryhub" node scripts/import-seed.js
 * Idempotent: drops and recreates the collections.
 */
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");
const R = require("../src/rules");

const URI = process.env.MONGODB_URI;
const DB = process.env.DB_NAME || "deliveryhub";
if (!URI) { console.error("Set MONGODB_URI"); process.exit(1); }
const seed = JSON.parse(fs.readFileSync(path.join(__dirname, "seed.json"), "utf8"));
const d = (iso) => (iso ? new Date(iso + "T00:00:00Z") : null);

(async () => {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db(DB);
  const now = new Date();
  for (const c of ["employees", "leaves", "compOffs", "timecards", "projects", "assignments", "scores", "settings", "permissions"]) {
    await db.collection(c).drop().catch(() => {});
  }

  // employees (email null until backfilled; isAdmin/streamLead set in-app)
  const empDocs = seed.E.map(([name, role, company, start, term]) => ({
    name, email: null, role, streamLead: false, isAdmin: false, company,
    startDate: d(start), endDate: d(term), createdAt: now, updatedAt: now, updatedBy: "migration",
  }));
  const er = await db.collection("employees").insertMany(empDocs);
  const idByName = {}; empDocs.forEach((e, i) => (idByName[e.name] = er.insertedIds[i]));
  const relByName = {}; seed.E.forEach((e) => (relByName[e[0]] = e[5] || null));
  // unique only for real emails — null placeholders (pre-Okta-backfill) are exempt
  await db.collection("employees").createIndex({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: "string" } } });
  await db.collection("employees").createIndex({ name: 1 }, { unique: true });

  const orphan = (n) => { throw new Error("No employee: " + n); };
  await db.collection("leaves").insertMany(seed.L.map(([n, s, e, t]) => ({ employeeId: idByName[n] || orphan(n), start: d(s), end: d(e), type: t, createdAt: now, createdBy: "migration" })));
  await db.collection("leaves").createIndex({ employeeId: 1, start: 1, end: 1 });

  const compMap = new Map(); // one entry per person per date — duplicates in source data collapse (last wins)
  seed.C.forEach(([n, dt, days, reason]) => compMap.set(n + "|" + dt, [n, dt, days, reason]));
  if (compMap.size < seed.C.length) console.log(`Note: collapsed ${seed.C.length - compMap.size} duplicate comp-off entr(y/ies) from the source data.`);
  await db.collection("compOffs").insertMany([...compMap.values()].map(([n, dt, days, reason]) => ({ employeeId: idByName[n] || orphan(n), dateWorked: d(dt), days: Number(days), reason: reason || null, createdAt: now, createdBy: "migration" })));
  await db.collection("compOffs").createIndex({ employeeId: 1, dateWorked: 1 }, { unique: true });

  const tcDocs = [];
  for (const [n, release, remarks, weeks] of seed.T) {
    const employeeId = idByName[n] || orphan(n);
    weeks.forEach(([sf, jira], i) => tcDocs.push({ employeeId, week: d(seed.W[i]), sf: sf || null, jira: jira || null, release: release || null, remarks: remarks || null, updatedAt: now, updatedBy: "migration", source: "import" }));
  }
  await db.collection("timecards").insertMany(tcDocs);
  await db.collection("timecards").createIndex({ employeeId: 1, week: 1 }, { unique: true });
  await db.collection("timecards").createIndex({ week: 1 });

  const pr = await db.collection("projects").insertOne({ name: "OPUSM", phases: ["R1", "R2"], trackJira: true, createdAt: now });
  await db.collection("assignments").insertMany((seed.A || []).map(([n, stream, from, to]) => ({ employeeId: idByName[n] || orphan(n), projectId: pr.insertedId, phase: relByName[n] || null, stream, from: d(from), to: d(to), createdAt: now, createdBy: "migration" })));
  await db.collection("assignments").createIndex({ employeeId: 1, from: 1 });
  await db.collection("assignments").createIndex({ projectId: 1 });

  await db.collection("scores").insertMany((seed.P || []).map(([n, week, m]) => ({ employeeId: idByName[n] || orphan(n), week: d(week), m, updatedAt: now, updatedBy: "migration" })));
  await db.collection("scores").createIndex({ employeeId: 1, week: 1 }, { unique: true });

  await db.collection("settings").insertOne({
    _id: "global",
    leaveTypes: [{ name: "Vacation", value: 1 }, { name: "Sick", value: 1 }, { name: "Unpaid", value: 1 }, { name: "Half Day", value: 0.5 }, { name: "Comp-Off", value: 1 }],
    weekendDays: [0, 6],
    holidays: seed.H.map(d),
    performance: { weights: [25, 20, 10, 25, 10, 10], green: 3.5, amber: 2.5, partnerOnly: true },
    updatedAt: now, updatedBy: "migration",
  });
  await db.collection("permissions").insertOne({ _id: "global", perms: R.defaultPerms(), updatedAt: now, updatedBy: "migration" });

  console.log(`Imported: ${empDocs.length} employees, ${seed.L.length} leaves, ${seed.C.length} comp-offs, ${tcDocs.length} timecard docs, 1 project, ${(seed.A || []).length} assignments, ${(seed.P || []).length} scores, settings, default permissions.`);
  console.log("NEXT: (1) backfill employee emails (Okta login emails), (2) set isAdmin:true for admin PMs, (3) designate stream leads in-app.");
  await client.close();
})().catch((e) => { console.error(e); process.exit(1); });
