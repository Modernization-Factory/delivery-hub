/** Leave filing, editing and deletion end to end: validation, ownership rules and storage. */
const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./harness");

let people;
const mon = h.futureMonday(4);
const fri = h.addDays(mon, 4);
before(h.start);
after(h.stop);
beforeEach(async () => { people = await h.seed(); });

const file = (who, body) => h.api(who, "POST", "/api/leaves", body);

test("a developer files their own leave and sees it", async () => {
  const r = await file(h.USERS.dev, { start: mon, end: fri, type: "Vacation", comment: "  trip  " });
  assert.equal(r.status, 201);
  assert.equal(r.body.days, 5);

  const mine = await h.api(h.USERS.dev, "GET", "/api/leaves?mine=1");
  assert.equal(mine.body.length, 1);
  assert.deepEqual({ ...mine.body[0], id: undefined }, { id: undefined, employeeId: people.dev.id, start: mon, end: fri, type: "Vacation", comment: "trip" });
});

test("half-day and weekend-spanning leave count working days by type value", async () => {
  const sat = h.addDays(mon, 5), nextMon = h.addDays(mon, 7);
  assert.equal((await file(h.USERS.dev, { start: fri, end: nextMon, type: "Vacation" })).body.days, 2);
  assert.equal((await file(h.USERS.dev2, { start: mon, end: mon, type: "Half Day" })).body.days, 0.5);
  const weekend = await file(h.USERS.dev, { start: sat, end: h.addDays(sat, 1), type: "Sick" });
  assert.equal(weekend.status, 422);
  assert.equal(weekend.body.error, "no_working_days");
});

test("invalid input is rejected", async () => {
  assert.equal((await file(h.USERS.dev, { start: fri, end: mon, type: "Vacation" })).body.error, "invalid_dates");
  const unknown = await file(h.USERS.dev, { start: mon, end: fri, type: "Sabbatical" });
  assert.equal(unknown.status, 422);
  assert.equal(unknown.body.error, "unknown_leave_type");
});

test("duplicates are refused and overlaps need force", async () => {
  await file(h.USERS.dev, { start: mon, end: fri, type: "Vacation" });
  assert.equal((await file(h.USERS.dev, { start: mon, end: fri, type: "Vacation" })).body.error, "duplicate");

  const overlap = await file(h.USERS.dev, { start: h.addDays(mon, 2), end: h.addDays(mon, 2), type: "Sick" });
  assert.equal(overlap.status, 409);
  assert.equal(overlap.body.error, "overlap");
  const forced = await file(h.USERS.dev, { start: h.addDays(mon, 2), end: h.addDays(mon, 2), type: "Sick", force: true });
  assert.equal(forced.status, 201);
  assert.deepEqual(forced.body.warnings, ["overlap_saved"]);
});

test("filing for someone else needs leave.forAnyone", async () => {
  const denied = await file(h.USERS.dev, { employeeId: people.dev2.id, start: mon, end: fri, type: "Vacation" });
  assert.equal(denied.status, 403);
  const ok = await file(h.USERS.pm, { employeeId: people.dev2.id, start: mon, end: fri, type: "Vacation" });
  assert.equal(ok.status, 201);
  const stored = await h.store().collection("leaves").findOne({ employeeId: people.dev2._id });
  assert.equal(stored.createdBy, "Pat PM");
});

test("leave cannot be filed for an inactive employee", async () => {
  const r = await file(h.USERS.pm, { employeeId: people.inactive.id, start: mon, end: fri, type: "Vacation" });
  assert.equal(r.status, 422);
  assert.equal(r.body.error, "employee_inactive");
});

test("comp-off leave is limited to the approved balance", async () => {
  const short = await file(h.USERS.dev, { start: mon, end: mon, type: "Comp-Off" });
  assert.equal(short.status, 422);
  assert.equal(short.body.error, "insufficient_compoff");

  await h.store().collection("compOffs").insertOne({ employeeId: people.dev._id, dateWorked: new Date("2024-01-06T00:00:00Z"), days: 1, status: "approved" });
  assert.equal((await file(h.USERS.dev, { start: mon, end: mon, type: "Comp-Off" })).status, 201);
  assert.equal((await file(h.USERS.dev, { start: h.addDays(mon, 1), end: h.addDays(mon, 1), type: "Comp-Off" })).body.error, "insufficient_compoff");
});

test("editing: owners move their own future leave, others cannot", async () => {
  await file(h.USERS.dev, { start: mon, end: fri, type: "Vacation" });
  const [l] = (await h.api(h.USERS.dev, "GET", "/api/leaves?mine=1")).body;

  const moved = await h.api(h.USERS.dev, "PUT", `/api/leaves/${l.id}`, { start: h.addDays(mon, 7), end: h.addDays(fri, 7) });
  assert.equal(moved.status, 200);
  const stored = await h.store().collection("leaves").findOne({});
  assert.equal(stored.start.toISOString().slice(0, 10), h.addDays(mon, 7));

  const other = await h.api(h.USERS.dev2, "PUT", `/api/leaves/${l.id}`, { type: "Sick" });
  assert.equal(other.status, 403);
  assert.equal((await h.api(h.USERS.pm, "PUT", `/api/leaves/${l.id}`, { type: "Sick" })).status, 200);
});

test("leave that has started is locked for its owner but not for a PM", async () => {
  const r = await h.store().collection("leaves").insertOne({ employeeId: people.dev._id, start: new Date("2024-03-04T00:00:00Z"), end: new Date("2024-03-05T00:00:00Z"), type: "Vacation" });
  const id = String(r.insertedId);
  assert.equal((await h.api(h.USERS.dev, "PUT", `/api/leaves/${id}`, { type: "Sick" })).body.error, "leave_started");
  assert.equal((await h.api(h.USERS.dev, "DELETE", `/api/leaves/${id}`)).body.error, "past_leave_locked");
  assert.equal((await h.api(h.USERS.pm, "DELETE", `/api/leaves/${id}`)).status, 200);
  assert.equal(await h.store().collection("leaves").countDocuments(), 0);
});

test("a malformed or unknown leave id is a client error, not a 500", async () => {
  for (const method of ["PUT", "DELETE"]) {
    const bad = await h.api(h.USERS.pm, method, "/api/leaves/not-an-id", method === "PUT" ? { type: "Sick" } : undefined);
    assert.equal(bad.status, 400, method + " malformed id");
    const missing = await h.api(h.USERS.pm, method, "/api/leaves/0123456789abcdef01234567", method === "PUT" ? { type: "Sick" } : undefined);
    assert.equal(missing.status, 404, method + " unknown id");
  }
});

test("full-week leave marks blank timecard cells N/A, and clears them when removed", async () => {
  const t = h.store().collection("timecards");
  // a timecard column is dated by the Sunday before the working week it covers
  await t.insertOne({ employeeId: people.dev._id, week: new Date(h.addDays(mon, -1) + "T00:00:00Z"), sf: null, jira: null });
  const r = await file(h.USERS.dev, { start: mon, end: fri, type: "Vacation" });
  assert.equal(r.body.autoNA, 1);
  let card = await t.findOne({});
  assert.equal(card.sf, "N/A");
  assert.deepEqual(card.autoNA.sort(), ["jira", "sf"]);

  const [l] = (await h.api(h.USERS.dev, "GET", "/api/leaves?mine=1")).body;
  await h.api(h.USERS.dev, "DELETE", `/api/leaves/${l.id}`);
  card = await t.findOne({});
  assert.equal(card.sf, null);
});
