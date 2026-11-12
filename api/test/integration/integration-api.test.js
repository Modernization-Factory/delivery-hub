/** The read-only /api/integration feed the Program Health app pulls from (bearer-token auth). */
const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./harness");

before(h.start);
after(h.stop);
beforeEach(h.seed);

const feed = (path, token = h.INTEGRATION_TOKEN) =>
  h.api(null, "GET", "/api/integration" + path, undefined, token ? { authorization: "Bearer " + token } : {});

test("the feed needs a valid bearer token, and ignores user identity", async () => {
  assert.equal((await feed("/projects", null)).status, 401);
  assert.equal((await feed("/projects", "wrong")).status, 401);
  // a valid user header is not a substitute for the token
  const asUser = await h.api(h.USERS.admin, "GET", "/api/integration/projects");
  assert.equal(asUser.status, 401);
  assert.equal((await feed("/projects")).status, 200);
});

test("projects: open projects only, with stable ids and ISO dates", async () => {
  const p = h.store().collection("projects");
  const { insertedId } = await p.insertOne({ name: "Live", pm: "Pat PM", currentPhase: "Build", phases: ["Build"], start: new Date("2025-01-06T00:00:00Z"), end: null, closedAt: null });
  await p.insertOne({ name: "Closed", closedAt: new Date() });

  const { body } = await feed("/projects");
  assert.deepEqual(body, { items: [{ external_id: String(insertedId), name: "Live", pm: "Pat PM", phase: "Build", phases: ["Build"], start: "2025-01-06", end: null, description: "" }] });
});

test("milestones and RAID are limited to open projects and carry the project name", async () => {
  const s = h.store();
  const open = (await s.collection("projects").insertOne({ name: "Live", closedAt: null })).insertedId;
  const closed = (await s.collection("projects").insertOne({ name: "Closed", closedAt: new Date() })).insertedId;
  await s.collection("milestones").insertMany([
    { projectId: open, name: "Go-live", planned: new Date("2025-06-02T00:00:00Z"), status: "Planned", rag: "G" },
    { projectId: closed, name: "Hidden" },
  ]);
  await s.collection("raid").insertMany([
    { projectId: open, type: "Risk", desc: "Vendor delay", impact: "High", probability: "Medium", status: "Open" },
    { projectId: closed, type: "Issue", desc: "Hidden" },
  ]);

  const ms = (await feed("/milestones")).body.items;
  assert.equal(ms.length, 1);
  assert.equal(ms[0].project_name, "Live");
  assert.equal(ms[0].planned, "2025-06-02");

  const raid = (await feed("/raid")).body.items;
  assert.equal(raid.length, 1);
  assert.equal(raid[0].description, "Vendor delay");
});
