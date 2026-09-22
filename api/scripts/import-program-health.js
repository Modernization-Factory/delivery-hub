/**
 * Program Health historical import — loads scripts/ph-seed.json (converted from
 * the AMP APAC Program Health workbook, with Bendigo date repairs applied).
 *
 * Idempotent: projects are upserted by name (register fields only — existing
 * streams/funding/links are never touched); weeklyHealth, pipeline, raid and
 * milestones docs carry source:"ph-import" and are wiped+reloaded each run,
 * so in-app entries (no source tag) always survive.
 *
 * Run: node --env-file=.env scripts/import-program-health.js
 */
const { MongoClient } = require("mongodb");
const fs = require("fs");
const path = require("path");

async function main() {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017";
  const dbName = process.env.DB_NAME || "deliveryhub";
  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, "ph-seed.json"), "utf8"));
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const day = (s) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + "T00:00:00Z") : null);

  // 1) projects: upsert by name, set register fields only
  const idByName = {};
  for (const p of seed.projects) {
    const $set = {
      pm: p.pm, currentPhase: p.phase,
      start: day(p.start), end: day(p.end),
      totalStories: p.totalStories ?? null, doneStories: p.doneStories ?? null,
      currentMargin: p.currentMargin ?? null, keyUpdate: p.keyUpdate || "",
      updatedAt: new Date(), updatedBy: "ph-import",
    };
    const $setOnInsert = { name: p.name, phases: p.phase ? [p.phase] : [], streams: [], description: p.closed ? "(closed engagement — imported from Program Health workbook)" : "", linkLabel: "", linkUrl: "", targetMargin: null, trackJira: true, createdAt: new Date() };
    const r = await db.collection("projects").findOneAndUpdate(
      { name: p.name }, { $set, $setOnInsert }, { upsert: true, returnDocument: "after" });
    idByName[p.name] = r._id || (r.value && r.value._id);
  }
  // driver version differences: refetch ids plainly
  for (const p of seed.projects) {
    if (!idByName[p.name]) idByName[p.name] = (await db.collection("projects").findOne({ name: p.name }))._id;
  }

  // 2) tagged collections: wipe + reload
  async function reload(coll, docs) {
    await db.collection(coll).deleteMany({ source: "ph-import" });
    if (docs.length) await db.collection(coll).insertMany(docs);
    return docs.length;
  }
  const stamp = { source: "ph-import", createdBy: "ph-import", createdAt: new Date(), updatedAt: new Date() };
  const nW = await reload("weeklyHealth", seed.weekly.map((w) => ({
    projectId: idByName[w.project], week: day(w.week), hoursPlanned: w.hoursPlanned, hoursBurnt: w.hoursBurnt,
    scopeChanges: !!w.scopeChanges, rag: w.rag, oneLiner: w.oneLiner, ...stamp })));
  const nP = await reload("pipeline", seed.pipeline.map((x) => ({
    company: x.company, stage: x.stage, potentialStart: x.potentialStart || "", potentialResources: x.potentialResources ?? null,
    commentary: x.commentary, nextAction: x.nextAction, ...stamp })));
  const nR = await reload("raid", seed.raid.map((x) => ({
    projectId: idByName[x.project], type: x.type, desc: x.desc, impact: x.impact, probability: x.probability,
    owner: x.owner, targetDate: day(x.targetDate), status: x.status, link: x.link, comments: x.comments, ...stamp })));
  const nM = await reload("milestones", seed.milestones.map((x) => ({
    projectId: idByName[x.project], name: x.name, phase: x.phase, planned: day(x.planned), actual: day(x.actual),
    status: x.status, rag: x.rag, comments: x.comments, ...stamp })));

  console.log(`Program Health import: ${seed.projects.length} projects upserted · weekly ${nW} · pipeline ${nP} · raid ${nR} · milestones ${nM}`);
  await client.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
