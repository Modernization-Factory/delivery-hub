/** Probes, identity resolution and role-based access — the gate every /api request passes. */
const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./harness");

let people;
before(h.start);
after(h.stop);
beforeEach(async () => { people = await h.seed(); });

test("probes answer without authentication", async () => {
  assert.deepEqual((await h.api(null, "GET", "/healthz")).body, { ok: true });
  const ready = await h.api(null, "GET", "/readyz");
  assert.equal(ready.status, 200);
  assert.deepEqual(ready.body, { mongo: true });
});

test("a request without an identity header is 401", async () => {
  const r = await h.api(null, "GET", "/api/me");
  assert.equal(r.status, 401);
  assert.equal(r.body.error, "not_authenticated");
});

test("an identity with no employee record is 403 no_employee_record", async () => {
  const r = await h.api("stranger@example.com", "GET", "/api/me");
  assert.equal(r.status, 403);
  assert.equal(r.body.error, "no_employee_record");
});

test("inactive and ended employees are refused", async () => {
  for (const who of [h.USERS.inactive, h.USERS.ended]) {
    const r = await h.api(who, "GET", "/api/me");
    assert.equal(r.status, 403, who);
    assert.equal(r.body.error, "inactive", who);
  }
});

test("the identity header is matched case-insensitively", async () => {
  const r = await h.api("DEV@Example.COM", "GET", "/api/me");
  assert.equal(r.status, 200);
  assert.equal(r.body.employee.name, "Dev One");
});

test("/me reports the role and capabilities the server will enforce", async () => {
  const dev = await h.api(h.USERS.dev, "GET", "/api/me");
  assert.equal(dev.body.role, "Developer");
  assert.equal(dev.body.can["employees.edit"], false);

  const pm = await h.api(h.USERS.pm, "GET", "/api/me");
  assert.equal(pm.body.role, "Project Manager");
  assert.equal(pm.body.can["employees.edit"], true);

  const admin = await h.api(h.USERS.admin, "GET", "/api/me");
  assert.equal(admin.body.role, "Admin");
  assert.ok(Object.values(admin.body.can).every(Boolean), "Admin has every capability");
});

test("admin-only routes refuse everyone else", async () => {
  for (const who of [h.USERS.dev, h.USERS.pm]) {
    assert.equal((await h.api(who, "GET", "/api/admin/permissions")).status, 403, who);
    assert.equal((await h.api(who, "GET", "/api/audit")).status, 403, who);
  }
  assert.equal((await h.api(h.USERS.admin, "GET", "/api/admin/permissions")).status, 200);
});

test("a saved permissions matrix changes what a role can do", async () => {
  const { body } = await h.api(h.USERS.admin, "GET", "/api/admin/permissions");
  const perms = body.perms;
  perms["projects.manage"].Developer = true;
  assert.equal((await h.api(h.USERS.admin, "PUT", "/api/admin/permissions", { perms })).status, 200);

  const me = await h.api(h.USERS.dev, "GET", "/api/me");
  assert.equal(me.body.can["projects.manage"], true);
  assert.equal((await h.api(h.USERS.dev, "POST", "/api/projects", { name: "Granted" })).status, 201);
});

test("granting and revoking Admin", async () => {
  assert.equal((await h.api(h.USERS.admin, "PUT", `/api/admin/employees/${people.dev.id}/admin`, { isAdmin: true })).status, 200);
  assert.equal((await h.api(h.USERS.dev, "GET", "/api/me")).body.role, "Admin");

  const self = await h.api(h.USERS.admin, "PUT", `/api/admin/employees/${people.admin.id}/admin`, { isAdmin: false });
  assert.equal(self.status, 422);
  assert.equal(self.body.error, "cannot_revoke_self");

  const inactive = await h.api(h.USERS.admin, "PUT", `/api/admin/employees/${people.inactive.id}/admin`, { isAdmin: true });
  assert.equal(inactive.body.error, "employee_inactive");
});

test("mutating requests are written to the audit log", async () => {
  await h.api(h.USERS.pm, "POST", "/api/projects", { name: "Audited" });
  const entry = await h.store().collection("auditLog").findOne({ action: "project.create" });
  assert.ok(entry, "audit entry written");
  assert.equal(entry.actor, "Pat PM");
  assert.equal(entry.body.name, "Audited");
});
