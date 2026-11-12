/** Employees, projects and settings: the master data the rest of the app hangs off. */
const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { ObjectId } = require("mongodb");
const h = require("./harness");

let people;
before(h.start);
after(h.stop);
beforeEach(async () => { people = await h.seed(); });

test("employee directory: full records with employees.view, names only without", async () => {
  const pm = await h.api(h.USERS.pm, "GET", "/api/employees");
  assert.equal(pm.status, 200);
  assert.equal(pm.body.length, 6);
  assert.ok(pm.body.every((e) => "email" in e), "PM sees emails");

  const dev = await h.api(h.USERS.dev, "GET", "/api/employees");
  assert.equal(dev.body.length, 6);
  assert.ok(dev.body.every((e) => !("email" in e)), "developer gets the directory shape");
});

test("creating and updating an employee", async () => {
  const denied = await h.api(h.USERS.dev, "POST", "/api/employees", { name: "New Hire" });
  assert.equal(denied.status, 403);

  const created = await h.api(h.USERS.pm, "POST", "/api/employees", { name: " New Hire ", email: "New.Hire@Example.com", role: "Senior Developer", start: "2025-01-06" });
  assert.equal(created.status, 201);
  assert.equal(created.body.name, "New Hire");
  assert.equal(created.body.email, "new.hire@example.com");

  assert.equal((await h.api(h.USERS.pm, "POST", "/api/employees", { name: "New Hire" })).body.error, "duplicate_name");
  assert.equal((await h.api(h.USERS.pm, "POST", "/api/employees", { name: "  " })).body.error, "name_required");

  // the new hire can sign in straight away with that email, in any case
  assert.equal((await h.api("NEW.HIRE@example.com", "GET", "/api/me")).body.role, "Senior Developer");

  const updated = await h.api(h.USERS.pm, "PUT", `/api/employees/${created.body.id}`, { name: "New Hire", email: "new.hire@example.com", role: "Lead Developer", start: "2025-01-06" });
  assert.equal(updated.status, 200);
  assert.equal((await h.api("new.hire@example.com", "GET", "/api/me")).body.role, "Lead");
});

// PUT replaces the record: the app always sends every field, but a client that leaves one
// out clears it — and a cleared email means that person can no longer sign in.
test("employee PUT is a full replace: an omitted email is cleared", async () => {
  await h.api(h.USERS.pm, "PUT", `/api/employees/${people.dev.id}`, { name: "Dev One", role: "Developer", start: "2020-01-01" });
  const stored = await h.store().collection("employees").findOne({ _id: people.dev._id });
  assert.equal(stored.email, null);
  assert.equal((await h.api(h.USERS.dev, "GET", "/api/me")).body.error, "no_employee_record");
});

test("employee updates validate their input", async () => {
  const self = await h.api(h.USERS.pm, "PUT", `/api/employees/${people.pm.id}`, { name: "Pat PM", inactive: true });
  assert.equal(self.body.error, "cannot_deactivate_self");
  const dates = await h.api(h.USERS.pm, "PUT", `/api/employees/${people.dev.id}`, { name: "Dev One", start: "2025-02-01", term: "2025-01-01" });
  assert.equal(dates.body.error, "end_before_start");
  assert.equal((await h.api(h.USERS.pm, "PUT", "/api/employees/xyz", { name: "x" })).status, 400);
  assert.equal((await h.api(h.USERS.pm, "PUT", "/api/employees/0123456789abcdef01234567", { name: "x" })).status, 404);
});

test("project lifecycle and its permission checks", async () => {
  assert.equal((await h.api(h.USERS.dev, "POST", "/api/projects", { name: "Apollo" })).status, 403);

  const created = await h.api(h.USERS.pm, "POST", "/api/projects", { name: "Apollo", phases: ["Discovery", "Build"], start: "2025-01-06" });
  assert.equal(created.status, 201);
  assert.equal((await h.api(h.USERS.pm, "POST", "/api/projects", { name: "Apollo" })).body.error, "duplicate_name");

  const list = await h.api(h.USERS.pm, "GET", "/api/projects");
  assert.equal(list.body.length, 1);
  assert.deepEqual(list.body[0].phases, ["Discovery", "Build"]);

  // a project with assignments can't be deleted
  await h.store().collection("assignments").insertOne({ projectId: new ObjectId(created.body.id), employeeId: people.dev._id });
  const blocked = await h.api(h.USERS.pm, "DELETE", `/api/projects/${created.body.id}`);
  assert.equal(blocked.status, 409);
  assert.equal(blocked.body.error, "has_assignments");

  await h.store().collection("assignments").deleteMany({});
  assert.equal((await h.api(h.USERS.pm, "DELETE", `/api/projects/${created.body.id}`)).status, 200);
  assert.equal((await h.api(h.USERS.pm, "GET", "/api/projects")).body.length, 0);
});

test("settings are readable by everyone and editable only with settings.edit", async () => {
  const s = await h.api(h.USERS.dev, "GET", "/api/settings");
  assert.equal(s.status, 200);
  assert.deepEqual(s.body.weekendDays, [0, 6]);
  assert.equal((await h.api(h.USERS.dev, "PUT", "/api/settings", { weekendDays: [5, 6] })).status, 403);
});

test("external links in settings are visible to Admins only", async () => {
  await h.store().collection("settings").updateOne({ _id: "global" }, { $set: { extLinks: [{ label: "Wiki", url: "https://example.com" }] } });
  assert.equal((await h.api(h.USERS.pm, "GET", "/api/settings")).body.extLinks, undefined);
  assert.equal((await h.api(h.USERS.admin, "GET", "/api/settings")).body.extLinks.length, 1);
});
