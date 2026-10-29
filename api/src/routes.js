/**
 * DeliveryHub API routes. Every route runs after resolveUser (identity + role +
 * permission function) — capability checks mirror the app's Administration matrix.
 * Server-side validation reuses the same pure rules the frontend runs.
 */
const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const { col, ObjectId } = require("./db");
const R = require("./rules");
const { requireCap, requireAdmin } = require("./auth");
const { audit } = require("./audit");

const router = express.Router();

/**
 * Express 4 does not catch rejections from async handlers: one throw inside any of the
 * routes below becomes an unhandled rejection, which Node exits on — so a single bad
 * request takes the whole API down (and would crashloop the pod on Kanopy). Wrapping
 * every handler routes those failures to the central error handler instead.
 * Error-handling middleware (arity 4) is passed through untouched.
 */
for (const method of ["get", "post", "put", "patch", "delete", "use"]) {
  const original = router[method].bind(router);
  router[method] = (...args) =>
    original(...args.map((a) =>
      typeof a === "function" && a.length < 4
        ? function wrapped(req, res, next) { return Promise.resolve(a(req, res, next)).catch(next); }
        : a));
}

const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } });
const iso = (d) => (d ? R.toISO(d) : null);
const day = (s) => (s ? new Date(s + "T00:00:00Z") : null);
// Request value -> ObjectId. Validates first so a malformed id is a 400 rather than a
// raw BSONError surfacing as a 500.
const oid = (v) => {
  if (!ObjectId.isValid(String(v))) {
    const e = new Error("invalid_id");
    e.status = 400;
    e.detail = `"${v}" is not a valid id`;
    throw e;
  }
  return new ObjectId(String(v));
};

async function settings() {
  return (await col("settings").findOne({ _id: "global" })) || {};
}
function leaveCtx(s) {
  return {
    leaveTypes: s.leaveTypes || [],
    weekendDays: s.weekendDays || [0, 6],
    holidaySet: new Set((s.holidays || []).map(iso)),
  };
}
const empShape = (e) => ({ id: e._id, name: e.name, email: e.email, role: e.role, streamLead: !!e.streamLead, viewer: !!e.viewer, isAdmin: !!e.isAdmin, inactive: !!e.inactive, company: e.company, start: iso(e.startDate), term: iso(e.endDate), custom: e.custom || {} });

// ---------- me ----------
// `email` is the identity the request was authenticated as (the Okta claim on Kanopy),
// so the login screen can tell a user who typed someone else's address apart from
// one who typed their own.
router.get("/me", async (req, res) => {
  // `can`: this user's effective capabilities from the saved matrix, so the app's menus and
  // buttons match what the server will allow (not the built-in defaults)
  const can = Object.fromEntries(Object.keys(req.user.perms).map((cap) => [cap, req.can(cap)]));
  res.json({ employee: empShape(req.user.employee), role: req.user.role, email: req.user.email, can });
});

// ---------- employees ----------
// Without employees.view the caller still gets a name directory (no email / custom fields) —
// every role needs it to resolve names on their own leave, timecard and the team calendar.
const dirShape = (e) => ({ id: e._id, name: e.name, role: e.role, inactive: !!e.inactive, company: e.company, start: iso(e.startDate), term: iso(e.endDate) });
router.get("/employees", async (req, res) => {
  const all = await col("employees").find().sort({ name: 1 }).toArray();
  res.json(all.map(req.can("employees.view") ? empShape : dirShape));
});
router.post("/employees", requireCap("employees.edit"), audit("employee.create"), async (req, res) => {
  const { name, email, role, company, start, term, streamLead, viewer, inactive, custom } = req.body;
  if (!name || !name.trim()) return res.status(422).json({ error: "name_required" });
  if (await col("employees").findOne({ name: name.trim() })) return res.status(409).json({ error: "duplicate_name" });
  const doc = { name: name.trim(), email: email ? String(email).toLowerCase() : null, role: role || "Developer", streamLead: !!streamLead, viewer: !!viewer, inactive: !!inactive, custom: custom || {}, isAdmin: false, company: company || "MDB", startDate: day(start), endDate: day(term), createdAt: new Date(), updatedAt: new Date(), updatedBy: req.user.employee.name };
  const r = await col("employees").insertOne(doc);
  res.status(201).json(empShape({ ...doc, _id: r.insertedId }));
});
router.put("/employees/:id", requireCap("employees.edit"), audit("employee.update"), async (req, res) => {
  const { name, email, role, company, start, term, streamLead, viewer, inactive, custom } = req.body;
  if (term && start && term < start) return res.status(422).json({ error: "end_before_start" });
  if (inactive && String(req.params.id) === String(req.user.employee._id)) return res.status(422).json({ error: "cannot_deactivate_self", detail: "You can't mark yourself inactive." });
  await col("employees").updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { name, email: email ? String(email).toLowerCase() : null, role, company, streamLead: !!streamLead, viewer: !!viewer, inactive: !!inactive, custom: custom || {}, startDate: day(start), endDate: day(term), updatedAt: new Date(), updatedBy: req.user.employee.name } }
  );
  res.json({ ok: true });
});

// ---------- leaves ----------
router.get("/leaves", async (req, res) => {
  // Full list is readable by every authenticated user — the v1 decision made the
  // team calendar visible to all roles. leave.records gates the management UI, not reads.
  const mine = req.query.mine === "1";
  const q = mine ? { employeeId: req.user.employee._id } : {};
  const leaves = await col("leaves").find(q).sort({ start: -1 }).toArray();
  res.json(leaves.map((l) => ({ id: l._id, employeeId: l.employeeId, start: iso(l.start), end: iso(l.end), type: l.type })));
});
router.post("/leaves", audit("leave.create"), async (req, res) => {
  const { employeeId, start, end, type, force } = req.body;
  const self = String(employeeId || "") === String(req.user.employee._id) || !employeeId;
  if (!self && !req.can("leave.forAnyone")) return res.status(403).json({ error: "forbidden" });
  const target = self ? req.user.employee : await col("employees").findOne({ _id: new ObjectId(employeeId) });
  if (!target) return res.status(404).json({ error: "employee_not_found" });
  if (target.inactive) return res.status(422).json({ error: "employee_inactive", detail: target.name + " is marked inactive." });
  if (!start || !end || end < start) return res.status(422).json({ error: "invalid_dates" });
  const s = await settings();
  const { leaveTypes, weekendDays, holidaySet } = leaveCtx(s);
  const existing = (await col("leaves").find({ employeeId: target._id }).toArray()).map((l) => ({ id: String(l._id), name: target.name, start: iso(l.start), end: iso(l.end), type: l.type }));
  const entry = { name: target.name, start, end, type };
  if (R.isDuplicate(existing, entry)) return res.status(409).json({ error: "duplicate" });
  const days = R.leaveDays(start, end, type, leaveTypes, weekendDays, holidaySet);
  if (days === 0) return res.status(422).json({ error: "no_working_days" });
  const overlaps = R.findOverlaps(existing, entry);
  if (overlaps.length && !force) return res.status(409).json({ error: "overlap", overlaps });
  await col("leaves").insertOne({ employeeId: target._id, start: day(start), end: day(end), type, createdAt: new Date(), createdBy: req.user.employee.name });
  res.status(201).json({ ok: true, days, warnings: overlaps.length ? ["overlap_saved"] : [] });
});
router.delete("/leaves/:id", audit("leave.delete"), async (req, res) => {
  const l = await col("leaves").findOne({ _id: new ObjectId(req.params.id) });
  if (!l) return res.status(404).json({ error: "not_found" });
  const own = String(l.employeeId) === String(req.user.employee._id);
  if (!own && !req.can("leave.forAnyone")) return res.status(403).json({ error: "forbidden" });
  if (R.toISO(l.start) < R.toISO(new Date()) && !R.canDeletePastLeave(req.user.role)) return res.status(403).json({ error: "past_leave_locked", detail: "Leave that has already started can only be deleted by a PM or Admin." });
  await col("leaves").deleteOne({ _id: l._id });
  res.json({ ok: true });
});

// ---------- comp-off ----------
router.get("/compoffs", async (req, res) => {
  // everyone can read their own comp-off (for My Leave balances); the full log needs leave.compoff
  const mine = req.query.mine === "1";
  if (!mine && !req.can("leave.compoff")) return res.status(403).json({ error: "forbidden" });
  const q = mine ? { employeeId: req.user.employee._id } : {};
  res.json(await col("compOffs").find(q).sort({ dateWorked: -1 }).toArray());
});
router.post("/compoffs", requireCap("leave.compoff"), audit("compoff.create"), async (req, res) => {
  const { employeeId, dateWorked, days, reason } = req.body;
  if (await col("employees").findOne({ _id: new ObjectId(employeeId), inactive: true })) return res.status(422).json({ error: "employee_inactive" });
  const s = await settings();
  const { weekendDays, holidaySet } = leaveCtx(s);
  if (!R.compOffDateValid(dateWorked, weekendDays, holidaySet)) return res.status(422).json({ error: "not_weekend_or_holiday" });
  try {
    await col("compOffs").insertOne({ employeeId: new ObjectId(employeeId), dateWorked: day(dateWorked), days: Number(days), reason: reason || null, createdAt: new Date(), createdBy: req.user.employee.name });
  } catch (e) {
    return res.status(409).json({ error: "duplicate_entry" });
  }
  res.status(201).json({ ok: true });
});
router.delete("/compoffs/:id", requireCap("leave.compoff"), audit("compoff.delete"), async (req, res) => {
  await col("compOffs").deleteOne({ _id: new ObjectId(req.params.id) });
  res.json({ ok: true });
});

// ---------- timecards ----------
router.get("/timecards", async (req, res) => {
  const mine = req.query.mine === "1";
  if (!mine && !req.can("timecard.insights") && !req.can("timecard.editAll") && !req.can("timecard.flag")) return res.status(403).json({ error: "forbidden" });
  const q = mine ? { employeeId: req.user.employee._id } : {};
  // outlier flags are a manager's note — only roles that see the whole grid get them
  const proj = req.can("timecard.editAll") || req.can("timecard.insights") || req.can("timecard.flag") ? {} : { projection: { flag: 0 } };
  res.json(await col("timecards").find(q, proj).sort({ week: 1 }).toArray());
});
router.put("/timecards/:id", requireCap("timecard.editAll"), audit("timecard.update"), async (req, res) => {
  const { sf, jira } = req.body;
  const valid = (v) => v === null || v === "" || R.TC_STATUSES.includes(v);
  if (!valid(sf) || !valid(jira)) return res.status(422).json({ error: "invalid_status" });
  await col("timecards").updateOne({ _id: new ObjectId(req.params.id) }, { $set: { sf: sf || null, jira: jira || null, updatedAt: new Date(), updatedBy: req.user.employee.name, source: "manual" } });
  res.json({ ok: true });
});
// outlier flag + comment on one person-week; kept separate from sf/jira so a sheet re-import never clears it
router.put("/timecards/:id/flag", requireCap("timecard.flag"), audit("timecard.flag"), async (req, res) => {
  const flagged = !!(req.body && req.body.flagged);
  const comment = String((req.body && req.body.comment) || "").trim().slice(0, 500);
  const r = await col("timecards").updateOne({ _id: new ObjectId(req.params.id) }, flagged
    ? { $set: { flag: { comment, by: req.user.employee.name, at: new Date() } } }
    : { $unset: { flag: "" } });
  if (!r.matchedCount) return res.status(404).json({ error: "not_found" });
  res.json({ ok: true });
});
router.post("/timecards/weeks", requireCap("timecard.editAll"), audit("timecard.addWeek"), async (req, res) => {
  const last = await col("timecards").find().sort({ week: -1 }).limit(1).toArray();
  const base = last[0] ? R.toISO(last[0].week) : R.toISO(new Date());
  const d = R.parseISO(base);
  const next = R.toISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7));
  const inactiveIds = await col("employees").distinct("_id", { inactive: true });
  const people = await col("timecards").distinct("employeeId", { employeeId: { $nin: inactiveIds } });
  if (people.length) {
    await col("timecards").insertMany(people.map((employeeId) => ({ employeeId, week: day(next), sf: null, jira: null, updatedAt: new Date(), updatedBy: req.user.employee.name, source: "manual" })), { ordered: false });
  }
  res.status(201).json({ ok: true, week: next, rows: people.length });
});
router.post("/timecards/import", requireCap("timecard.editAll"), upload.single("file"), audit("timecard.import"), async (req, res) => {
  const wb = XLSX.read(req.file.buffer, { cellDates: true });
  const wsName = wb.SheetNames.find((n) => n.toLowerCase().includes("proactive")) || wb.SheetNames.find((n) => n.toLowerCase().includes("timecard")) || wb.SheetNames[0];
  const grid = XLSX.utils.sheet_to_json(wb.Sheets[wsName], { header: 1, raw: true, defval: null });
  const parsed = R.parseTimecardGrid(grid);
  if (!parsed.weeks.length || !parsed.rows.length) return res.status(422).json({ error: "unrecognised_template", sheet: wsName });
  const employees = await col("employees").find().toArray();
  const idByName = Object.fromEntries(employees.filter((e) => !e.inactive).map((e) => [e.name, e._id]));
  const unknown = parsed.rows.filter((r) => !idByName[r.name] && !employees.some((e) => e.name === r.name)).map((r) => r.name);
  const ops = [];
  parsed.rows.forEach((r) => {
    const employeeId = idByName[r.name];
    if (!employeeId) return;
    r.weeks.forEach(([sf, jira], i) => {
      ops.push({ updateOne: { filter: { employeeId, week: day(parsed.weeks[i]) }, update: { $set: { sf: sf || null, jira: jira || null, release: r.release || null, remarks: r.remarks || null, updatedAt: new Date(), updatedBy: req.user.employee.name, source: "import" } }, upsert: true } });
    });
  });
  if (ops.length) await col("timecards").bulkWrite(ops, { ordered: false });
  res.json({ ok: true, weeks: parsed.weeks.length, resources: parsed.rows.length, upserts: ops.length, unknownNames: unknown, unknownStatuses: parsed.unknownStatuses, duplicates: parsed.duplicates });
});

// ---------- projects & assignments ----------
router.get("/projects", async (req, res) => {
  const all = await col("projects").find().sort({ name: 1 }).toArray();
  // without projects.view: just enough to name a person's own project on their dashboard
  res.json(req.can("projects.view") ? all : all.map((p) => ({ _id: p._id, name: p.name, phases: p.phases || [], closedAt: p.closedAt || null })));
});
router.post("/projects", requireCap("projects.manage"), audit("project.create"), async (req, res) => {
  const { name, phases, trackJira } = req.body;
  if (!name || !name.trim()) return res.status(422).json({ error: "name_required" });
  if (await col("projects").findOne({ name: name.trim() })) return res.status(409).json({ error: "duplicate_name" });
  const { streams, description, linkLabel, linkUrl, start, end, targetMargin, pm, currentPhase } = req.body;
  const r = await col("projects").insertOne({ name: name.trim(), phases: phases || [], streams: streams || [], description: description || "", linkLabel: linkLabel || "", linkUrl: linkUrl || "", start: start ? day(start) : null, end: end ? day(end) : null, targetMargin: targetMargin === null || targetMargin === undefined || targetMargin === "" ? null : Number(targetMargin), pm: pm || null, currentPhase: currentPhase || null, trackJira: trackJira !== false, createdAt: new Date() });
  res.status(201).json({ id: r.insertedId });
});
router.put("/projects/:id", audit("project.update"), async (req, res) => {
  const { name, phases, trackJira, funding, streams, description, linkLabel, linkUrl, start, end, targetMargin, pm, currentPhase } = req.body;
  // catalogue fields need projects.manage; funding alone may be edited with runway.funding
  const wantsCatalogue = name !== undefined || phases !== undefined || trackJira !== undefined;
  if (wantsCatalogue && !req.can("projects.manage")) return res.status(403).json({ error: "forbidden", cap: "projects.manage" });
  if (funding !== undefined && !req.can("projects.manage") && !req.can("runway.funding")) return res.status(403).json({ error: "forbidden", cap: "runway.funding" });
  const $set = { updatedAt: new Date() };
  if (wantsCatalogue) Object.assign($set, { name, phases, trackJira: trackJira !== false, streams: streams || [], description: description || "", linkLabel: linkLabel || "", linkUrl: linkUrl || "", start: start ? day(start) : null, end: end ? day(end) : null, targetMargin: targetMargin === null || targetMargin === undefined || targetMargin === "" ? null : Number(targetMargin), pm: pm || null, currentPhase: currentPhase || null });
  if (funding !== undefined) $set.funding = funding;
  const { totalStories, doneStories, currentMargin, keyUpdate } = req.body;
  const wantsRegister = totalStories !== undefined || doneStories !== undefined || currentMargin !== undefined || keyUpdate !== undefined;
  if (wantsRegister) {
    if (!req.can("ph.register") && !req.can("projects.manage")) return res.status(403).json({ error: "forbidden", cap: "ph.register" });
    if (totalStories !== undefined) $set.totalStories = totalStories === null || totalStories === "" ? null : Number(totalStories);
    if (doneStories !== undefined) $set.doneStories = doneStories === null || doneStories === "" ? null : Number(doneStories);
    if (currentMargin !== undefined) $set.currentMargin = currentMargin === null || currentMargin === "" ? null : Number(currentMargin);
    if (keyUpdate !== undefined) $set.keyUpdate = keyUpdate || "";
  }
  await col("projects").updateOne({ _id: new ObjectId(req.params.id) }, { $set });
  res.json({ ok: true });
});
// new work can't be booked against a closed project
async function refuseClosed(projectId, res) {
  const p = projectId && await col("projects").findOne({ _id: oid(String(projectId)) }, { projection: { closedAt: 1, name: 1 } });
  if (p && p.closedAt) { res.status(422).json({ error: "project_closed", detail: p.name + " is closed — reopen it on the Projects page first." }); return true; }
  return false;
}
// Close a completed project: it drops out of Program Health, runway, pickers and the
// integration feed; open assignments end on the closure date. History is kept. Reopen undoes it.
router.put("/projects/:id/close", requireCap("projects.manage"), audit("project.close"), async (req, res) => {
  const id = new ObjectId(req.params.id);
  const p = await col("projects").findOne({ _id: id });
  if (!p) return res.status(404).json({ error: "not_found" });
  if (req.body && req.body.reopen) {
    await col("projects").updateOne({ _id: id }, { $unset: { closedAt: "", closedBy: "", closureNote: "" }, $set: { updatedAt: new Date() } });
    return res.json({ ok: true, reopened: true });
  }
  if (p.closedAt) return res.status(409).json({ error: "already_closed" });
  const on = (req.body && req.body.on) || R.toISO(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(on)) return res.status(422).json({ error: "invalid_date" });
  // assignments running past the closure date end on it
  const ended = await col("assignments").updateMany(
    { projectId: id, $or: [{ to: null }, { to: { $gt: day(on) } }], from: { $lte: day(on) } },
    { $set: { to: day(on), updatedAt: new Date(), endedBy: "project.close" } });
  const future = await col("assignments").countDocuments({ projectId: id, from: { $gt: day(on) } });
  await col("projects").updateOne({ _id: id }, { $set: { closedAt: day(on), closedBy: req.user.employee.name, closureNote: String((req.body && req.body.note) || "").trim().slice(0, 500), updatedAt: new Date() } });
  res.json({ ok: true, endedAssignments: ended.modifiedCount, futureAssignments: future });
});
router.delete("/projects/:id", requireCap("projects.manage"), audit("project.delete"), async (req, res) => {
  const inUse = await col("assignments").countDocuments({ projectId: new ObjectId(req.params.id) });
  if (inUse) return res.status(409).json({ error: "has_assignments", count: inUse });
  await col("projects").deleteOne({ _id: new ObjectId(req.params.id) });
  res.json({ ok: true });
});
router.get("/assignments", async (req, res) => {
  // everyone may read their own assignments (dashboard "my project"); the full plan needs alloc.view
  const mine = req.query.mine === "1";
  if (!mine && !req.can("alloc.view")) return res.status(403).json({ error: "forbidden" });
  res.json(await col("assignments").find(mine ? { employeeId: req.user.employee._id } : {}).toArray());
});
router.post("/assignments", requireCap("alloc.edit"), audit("assignment.create"), async (req, res) => {
  const { employeeId, projectId, phase, stream, from, to } = req.body;
  const emp = await col("employees").findOne({ _id: new ObjectId(employeeId) });
  if (!emp) return res.status(404).json({ error: "employee_not_found" });
  if (emp.inactive) return res.status(422).json({ error: "employee_inactive", detail: emp.name + " is marked inactive." });
  if (await refuseClosed(projectId, res)) return;
  if (!from) return res.status(422).json({ error: "from_required" });
  if (to && to < from) return res.status(422).json({ error: "invalid_range" });
  if (emp.endDate && from > R.toISO(emp.endDate)) return res.status(422).json({ error: "starts_after_end_date" });
  const existing = (await col("assignments").find({ employeeId: emp._id }).toArray()).map((a) => ({ id: String(a._id), name: emp.name, projectId: String(a.projectId), from: iso(a.from), to: iso(a.to) }));
  const entry = { name: emp.name, projectId: String(projectId), from, to: to || null };
  const clash = R.aOverlaps(existing, entry);
  if (clash.length) return res.status(409).json({ error: "overlap_same_project", clash });
  const concurrent = R.crossProjectConcurrent(existing, entry);
  await col("assignments").insertOne({ employeeId: emp._id, projectId: new ObjectId(projectId), phase: phase || null, stream, from: day(from), to: day(to), weeklyHours: Number(req.body.weeklyHours) || 40, createdAt: new Date(), createdBy: req.user.employee.name });
  res.status(201).json({ ok: true, splitsWith: concurrent.length });
});
router.patch("/assignments/:id/end", requireCap("alloc.edit"), audit("assignment.end"), async (req, res) => {
  await col("assignments").updateOne({ _id: new ObjectId(req.params.id) }, { $set: { to: day(req.body.to || R.toISO(new Date())), updatedAt: new Date() } });
  res.json({ ok: true });
});
router.delete("/assignments/:id", requireCap("alloc.edit"), audit("assignment.delete"), async (req, res) => {
  await col("assignments").deleteOne({ _id: new ObjectId(req.params.id) });
  res.json({ ok: true });
});
router.get("/burn", requireCap("alloc.view"), async (req, res) => {
  const year = Number(req.query.year || new Date().getFullYear());
  const s = await settings();
  const { weekendDays, holidaySet } = leaveCtx(s);
  const employees = await col("employees").find().toArray();
  const empByName = Object.fromEntries(employees.map((e) => [e.name, { start: iso(e.startDate), term: iso(e.endDate) }]));
  const nameById = Object.fromEntries(employees.map((e) => [String(e._id), e.name]));
  const assignments = (await col("assignments").find().toArray()).map((a) => ({ id: String(a._id), name: nameById[String(a.employeeId)], projectId: String(a.projectId), phase: a.phase, stream: a.stream, from: iso(a.from), to: iso(a.to) }));
  const emps = employees.map((e) => ({ name: e.name, start: iso(e.startDate), term: iso(e.endDate) }));
  res.json(R.computeBurn(assignments, emps, empByName, year, weekendDays, holidaySet));
});

router.get("/runway", requireCap("runway.view"), async (_req, res) => {
  const s = await settings();
  const { leaveTypes, weekendDays, holidaySet } = leaveCtx(s);
  const employees = await col("employees").find().toArray();
  const empByName = Object.fromEntries(employees.map((e) => [e.name, { name: e.name, role: e.role, inactive: !!e.inactive, start: iso(e.startDate), term: iso(e.endDate) }]));
  const nameById = Object.fromEntries(employees.map((e) => [String(e._id), e.name]));
  const assignments = (await col("assignments").find().toArray()).map((a) => ({ id: String(a._id), name: nameById[String(a.employeeId)], projectId: String(a.projectId), from: iso(a.from), to: iso(a.to), weeklyHours: a.weeklyHours || 40 }));
  const leaves = (await col("leaves").find().toArray()).map((l) => ({ name: nameById[String(l.employeeId)], start: iso(l.start), end: iso(l.end), type: l.type }));
  const projects = await col("projects").find({ closedAt: null }).toArray();
  const today = R.toISO(new Date());
  res.json(projects.map((p) => ({ projectId: p._id, name: p.name, runway: R.computeRunway({ id: String(p._id), funding: p.funding }, empByName, assignments, leaves, leaveTypes, weekendDays, holidaySet, today) })));
});

router.get("/reports/leave-project-role", requireCap("leave.reports"), async (req, res) => {
  const s = await settings();
  const { leaveTypes, weekendDays, holidaySet } = leaveCtx(s);
  const employees = await col("employees").find().toArray();
  const empByName = Object.fromEntries(employees.map((e) => [e.name, { name: e.name, role: e.role }]));
  const nameById = Object.fromEntries(employees.map((e) => [String(e._id), e.name]));
  const leaves = (await col("leaves").find().toArray()).map((l) => ({ name: nameById[String(l.employeeId)], start: iso(l.start), end: iso(l.end), type: l.type }));
  const assignments = (await col("assignments").find().toArray()).map((a) => ({ name: nameById[String(a.employeeId)], projectId: String(a.projectId), from: iso(a.from), to: iso(a.to) }));
  res.json(R.leaveByProjectRole(leaves, empByName, assignments, req.query.from || "0000-01-01", req.query.to || "9999-12-31", leaveTypes, weekendDays, holidaySet));
});

// ---------- program health: weekly entries & pipeline ----------
const whShape = (x) => ({ id: x._id, projectId: String(x.projectId), week: iso(x.week), hoursPlanned: x.hoursPlanned, hoursBurnt: x.hoursBurnt, scopeChanges: !!x.scopeChanges, rag: x.rag, oneLiner: x.oneLiner || "", createdBy: x.createdBy, updatedAt: iso(x.updatedAt) });
router.get("/weeklyhealth", requireCap("ph.view"), async (_req, res) => {
  res.json((await col("weeklyHealth").find().toArray()).map(whShape));
});
router.post("/weeklyhealth", requireCap("ph.weekly"), audit("ph.weekly.create"), async (req, res) => {
  const { projectId, week, hoursPlanned, hoursBurnt, scopeChanges, rag, oneLiner } = req.body;
  if (!projectId || !week) return res.status(422).json({ error: "projectId_week_required" });
  if (await refuseClosed(projectId, res)) return;
  const dup = await col("weeklyHealth").findOne({ projectId: oid(projectId), week: day(week) });
  if (dup) return res.status(409).json({ error: "entry_exists_for_week" });
  const doc = { projectId: oid(projectId), week: day(week), hoursPlanned: Number(hoursPlanned) || 0, hoursBurnt: Number(hoursBurnt) || 0, scopeChanges: !!scopeChanges, rag: rag || "Green", oneLiner: oneLiner || "", createdBy: req.user.employee.name, createdAt: new Date(), updatedAt: new Date() };
  const r2 = await col("weeklyHealth").insertOne(doc);
  res.status(201).json(whShape({ ...doc, _id: r2.insertedId }));
});
router.put("/weeklyhealth/:id", requireCap("ph.weekly"), audit("ph.weekly.update"), async (req, res) => {
  const { week, hoursPlanned, hoursBurnt, scopeChanges, rag, oneLiner } = req.body;
  const $set = { updatedAt: new Date(), updatedBy: req.user.employee.name };
  if (week !== undefined) $set.week = day(week);
  if (hoursPlanned !== undefined) $set.hoursPlanned = Number(hoursPlanned) || 0;
  if (hoursBurnt !== undefined) $set.hoursBurnt = Number(hoursBurnt) || 0;
  if (scopeChanges !== undefined) $set.scopeChanges = !!scopeChanges;
  if (rag !== undefined) $set.rag = rag;
  if (oneLiner !== undefined) $set.oneLiner = oneLiner || "";
  const r2 = await col("weeklyHealth").updateOne({ _id: oid(req.params.id) }, { $set });
  if (!r2.matchedCount) return res.status(404).json({ error: "not_found" });
  res.json({ ok: true });
});
router.delete("/weeklyhealth/:id", requireCap("ph.weekly"), audit("ph.weekly.delete"), async (req, res) => {
  const r2 = await col("weeklyHealth").deleteOne({ _id: oid(req.params.id) });
  if (!r2.deletedCount) return res.status(404).json({ error: "not_found" });
  res.json({ ok: true });
});

const plShape = (x) => ({ id: x._id, company: x.company, stage: x.stage, potentialStart: x.potentialStart || "", potentialResources: x.potentialResources ?? null, commentary: x.commentary || "", nextAction: x.nextAction || "", updatedAt: iso(x.updatedAt) });
router.get("/pipeline", requireCap("ph.view"), async (_req, res) => {
  res.json((await col("pipeline").find().toArray()).map(plShape));
});
router.post("/pipeline", requireCap("ph.pipeline"), audit("ph.pipeline.create"), async (req, res) => {
  const { company, stage, potentialStart, potentialResources, commentary, nextAction } = req.body;
  if (!company || !company.trim()) return res.status(422).json({ error: "company_required" });
  const doc = { company: company.trim(), stage: stage || R.PH_STAGES[0], potentialStart: potentialStart || "", potentialResources: potentialResources === null || potentialResources === undefined || potentialResources === "" ? null : Number(potentialResources), commentary: commentary || "", nextAction: nextAction || "", createdBy: req.user.employee.name, createdAt: new Date(), updatedAt: new Date() };
  const r2 = await col("pipeline").insertOne(doc);
  res.status(201).json(plShape({ ...doc, _id: r2.insertedId }));
});
router.put("/pipeline/:id", requireCap("ph.pipeline"), audit("ph.pipeline.update"), async (req, res) => {
  const { company, stage, potentialStart, potentialResources, commentary, nextAction } = req.body;
  const $set = { updatedAt: new Date(), updatedBy: req.user.employee.name };
  if (company !== undefined) $set.company = String(company).trim();
  if (stage !== undefined) $set.stage = stage;
  if (potentialStart !== undefined) $set.potentialStart = potentialStart || "";
  if (potentialResources !== undefined) $set.potentialResources = potentialResources === null || potentialResources === "" ? null : Number(potentialResources);
  if (commentary !== undefined) $set.commentary = commentary || "";
  if (nextAction !== undefined) $set.nextAction = nextAction || "";
  const r2 = await col("pipeline").updateOne({ _id: oid(req.params.id) }, { $set });
  if (!r2.matchedCount) return res.status(404).json({ error: "not_found" });
  res.json({ ok: true });
});
router.delete("/pipeline/:id", requireCap("ph.pipeline"), audit("ph.pipeline.delete"), async (req, res) => {
  const r2 = await col("pipeline").deleteOne({ _id: oid(req.params.id) });
  if (!r2.deletedCount) return res.status(404).json({ error: "not_found" });
  res.json({ ok: true });
});

// ---------- RAID log & milestones (per project) ----------
const raidShape = (x) => ({ id: x._id, projectId: String(x.projectId), type: x.type, desc: x.desc, impact: x.impact, probability: x.probability, owner: x.owner || "", targetDate: iso(x.targetDate), status: x.status, link: x.link || "", comments: x.comments || "", createdBy: x.createdBy, createdAt: iso(x.createdAt), updatedAt: iso(x.updatedAt) });
router.get("/raid", requireCap("projects.view"), async (_req, res) => {
  res.json((await col("raid").find().toArray()).map(raidShape));
});
router.post("/raid", requireCap("projects.raid"), audit("raid.create"), async (req, res) => {
  const { projectId, type, desc, impact, probability, owner, targetDate, status, link, comments } = req.body;
  if (!projectId || !desc || !["Risk", "Issue", "Dependency", "Decision"].includes(type)) return res.status(422).json({ error: "projectId_type_desc_required" });
  if (await refuseClosed(projectId, res)) return;
  const doc = { projectId: oid(projectId), type, desc: String(desc).trim(), impact: impact || "M", probability: probability || "M", owner: owner || "", targetDate: targetDate ? day(targetDate) : null, status: status || "Open", link: link || "", comments: comments || "", createdBy: req.user.employee.name, createdAt: new Date(), updatedAt: new Date() };
  const r2 = await col("raid").insertOne(doc);
  res.status(201).json(raidShape({ ...doc, _id: r2.insertedId }));
});
router.put("/raid/:id", requireCap("projects.raid"), audit("raid.update"), async (req, res) => {
  const { type, desc, impact, probability, owner, targetDate, status, link, comments } = req.body;
  const $set = { updatedAt: new Date(), updatedBy: req.user.employee.name };
  if (type !== undefined) $set.type = type;
  if (desc !== undefined) $set.desc = String(desc).trim();
  if (impact !== undefined) $set.impact = impact;
  if (probability !== undefined) $set.probability = probability;
  if (owner !== undefined) $set.owner = owner || "";
  if (targetDate !== undefined) $set.targetDate = targetDate ? day(targetDate) : null;
  if (status !== undefined) $set.status = status;
  if (link !== undefined) $set.link = link || "";
  if (comments !== undefined) $set.comments = comments || "";
  const r2 = await col("raid").updateOne({ _id: oid(req.params.id) }, { $set });
  if (!r2.matchedCount) return res.status(404).json({ error: "not_found" });
  res.json({ ok: true });
});
router.delete("/raid/:id", requireCap("projects.raid"), audit("raid.delete"), async (req, res) => {
  const r2 = await col("raid").deleteOne({ _id: oid(req.params.id) });
  if (!r2.deletedCount) return res.status(404).json({ error: "not_found" });
  res.json({ ok: true });
});

const msShape = (x) => ({ id: x._id, projectId: String(x.projectId), name: x.name, phase: x.phase || "", planned: iso(x.planned), actual: iso(x.actual), status: x.status, rag: x.rag, comments: x.comments || "", createdBy: x.createdBy, createdAt: iso(x.createdAt), updatedAt: iso(x.updatedAt) });
router.get("/milestones", requireCap("projects.view"), async (_req, res) => {
  res.json((await col("milestones").find().toArray()).map(msShape));
});
router.post("/milestones", requireCap("projects.raid"), audit("milestone.create"), async (req, res) => {
  const { projectId, name, phase, planned, actual, status, rag, comments } = req.body;
  if (!projectId || !name) return res.status(422).json({ error: "projectId_name_required" });
  if (await refuseClosed(projectId, res)) return;
  const doc = { projectId: oid(projectId), name: String(name).trim(), phase: phase || "", planned: planned ? day(planned) : null, actual: actual ? day(actual) : null, status: status || "Not Started", rag: rag || "Green", comments: comments || "", createdBy: req.user.employee.name, createdAt: new Date(), updatedAt: new Date() };
  const r2 = await col("milestones").insertOne(doc);
  res.status(201).json(msShape({ ...doc, _id: r2.insertedId }));
});
router.put("/milestones/:id", requireCap("projects.raid"), audit("milestone.update"), async (req, res) => {
  const { name, phase, planned, actual, status, rag, comments } = req.body;
  const $set = { updatedAt: new Date(), updatedBy: req.user.employee.name };
  if (name !== undefined) $set.name = String(name).trim();
  if (phase !== undefined) $set.phase = phase || "";
  if (planned !== undefined) $set.planned = planned ? day(planned) : null;
  if (actual !== undefined) $set.actual = actual ? day(actual) : null;
  if (status !== undefined) $set.status = status;
  if (rag !== undefined) $set.rag = rag;
  if (comments !== undefined) $set.comments = comments || "";
  const r2 = await col("milestones").updateOne({ _id: oid(req.params.id) }, { $set });
  if (!r2.matchedCount) return res.status(404).json({ error: "not_found" });
  res.json({ ok: true });
});
router.delete("/milestones/:id", requireCap("projects.raid"), audit("milestone.delete"), async (req, res) => {
  const r2 = await col("milestones").deleteOne({ _id: oid(req.params.id) });
  if (!r2.deletedCount) return res.status(404).json({ error: "not_found" });
  res.json({ ok: true });
});

// ---------- team plans ----------
const planShape = (p) => ({ id: p._id, name: p.name, projectId: String(p.projectId), phase: p.phase || null, startYm: p.startYm, monthsCount: p.monthsCount, mult: p.mult, multOverrides: p.multOverrides || {}, rows: p.rows || [], archived: !!p.archived, createdBy: p.createdBy, createdAt: iso(p.createdAt), updatedAt: iso(p.updatedAt) });
router.get("/plans", requireCap("plans.view"), async (_req, res) => {
  res.json((await col("plans").find().sort({ updatedAt: -1 }).toArray()).map(planShape));
});
router.post("/plans", requireCap("plans.manage"), audit("plan.create"), async (req, res) => {
  const { name, projectId, phase, startYm, monthsCount, mult, multOverrides, rows } = req.body;
  if (!name || !projectId || !/^\d{4}-\d{2}$/.test(startYm || "")) return res.status(422).json({ error: "name_project_startYm_required" });
  if (await refuseClosed(projectId, res)) return;
  const count = Math.max(1, Math.min(12, Number(monthsCount) || 6));
  const doc = {
    name: String(name).trim(), projectId: oid(projectId), phase: phase || null,
    startYm, monthsCount: count, mult: Number(mult) || 20,
    multOverrides: multOverrides || {}, rows: rows || [], archived: false,
    createdBy: req.user.employee.name, createdAt: new Date(), updatedAt: new Date(),
  };
  const r2 = await col("plans").insertOne(doc);
  res.status(201).json(planShape({ ...doc, _id: r2.insertedId }));
});
router.put("/plans/:id", requireCap("plans.manage"), audit("plan.update"), async (req, res) => {
  const { name, phase, startYm, monthsCount, mult, multOverrides, rows, archived } = req.body;
  const $set = { updatedAt: new Date(), updatedBy: req.user.employee.name };
  if (name !== undefined) $set.name = String(name).trim();
  if (phase !== undefined) $set.phase = phase || null;
  if (startYm !== undefined) $set.startYm = startYm;
  if (monthsCount !== undefined) $set.monthsCount = Math.max(1, Math.min(12, Number(monthsCount) || 6));
  if (mult !== undefined) $set.mult = Number(mult) || 20;
  if (multOverrides !== undefined) $set.multOverrides = multOverrides || {};
  if (rows !== undefined) $set.rows = rows || [];
  if (archived !== undefined) $set.archived = !!archived;
  const r2 = await col("plans").updateOne({ _id: oid(req.params.id) }, { $set });
  if (!r2.matchedCount) return res.status(404).json({ error: "not_found" });
  res.json({ ok: true });
});
router.delete("/plans/:id", requireCap("plans.manage"), audit("plan.delete"), async (req, res) => {
  const r2 = await col("plans").deleteOne({ _id: oid(req.params.id) });
  if (!r2.deletedCount) return res.status(404).json({ error: "not_found" });
  res.json({ ok: true });
});

// ---------- performance ----------
router.get("/scores", requireCap("perf.view"), async (_req, res) => {
  res.json(await col("scores").find().sort({ week: 1 }).toArray());
});
router.put("/scores", requireCap("perf.view"), audit("score.upsert"), async (req, res) => {
  const { employeeId, week, m } = req.body;
  if (!Array.isArray(m) || m.length !== 6 || m.some((x) => x !== null && (x < 0 || x > 5))) return res.status(422).json({ error: "invalid_metrics" });
  await col("scores").updateOne(
    { employeeId: new ObjectId(employeeId), week: day(week) },
    { $set: { m, updatedAt: new Date(), updatedBy: req.user.employee.name } },
    { upsert: true }
  );
  res.json({ ok: true });
});
router.get("/perf/report/:kind", requireCap("perf.reports"), async (req, res) => {
  const s = await settings();
  const cfg = s.performance || { weights: [25, 20, 10, 25, 10, 10], green: 3.5, amber: 2.5, partnerOnly: true };
  const employees = (await col("employees").find().toArray()).map((e) => ({ name: e.name, company: e.company, start: iso(e.startDate), term: iso(e.endDate) }));
  const byId = Object.fromEntries((await col("employees").find().toArray()).map((e) => [String(e._id), e.name]));
  const scores = (await col("scores").find().toArray()).map((x) => ({ name: byId[String(x.employeeId)], week: iso(x.week), m: x.m }));
  if (req.params.kind === "scorecard") return res.json(R.perfScorecard(employees, scores, req.query.week, cfg));
  if (req.params.kind === "vendors") return res.json(R.perfVendorTrend(employees, scores, cfg));
  if (req.params.kind === "resource") return res.json(R.perfResourceTrend(scores, req.query.name, cfg));
  res.status(404).json({ error: "unknown_report" });
});
router.put("/perf/config", requireCap("perf.config"), audit("perf.config"), async (req, res) => {
  const { weights, green, amber, partnerOnly } = req.body;
  const tot = (weights || []).reduce((s, w) => s + Number(w), 0);
  if (tot !== 100) return res.status(422).json({ error: "weights_must_total_100", total: tot });
  if (Number(green) <= Number(amber)) return res.status(422).json({ error: "green_must_exceed_amber" });
  await col("settings").updateOne({ _id: "global" }, { $set: { performance: { weights: weights.map(Number), green: Number(green), amber: Number(amber), partnerOnly: !!partnerOnly } } });
  res.json({ ok: true });
});

// ---------- settings & admin ----------
router.get("/settings", async (_req, res) => res.json(await settings()));
router.put("/settings", requireCap("settings.edit"), audit("settings.update"), async (req, res) => {
  const { leaveTypes, weekendDays, holidays, extLinks, empFields } = req.body;
  if (leaveTypes && leaveTypes.length > 5) return res.status(422).json({ error: "max_5_leave_types" });
  const $set = { updatedAt: new Date(), updatedBy: req.user.employee.name };
  if (leaveTypes !== undefined) Object.assign($set, { leaveTypes, weekendDays, holidays: (holidays || []).map(day) });
  if (empFields !== undefined) {
    if (!req.user.employee.isAdmin) return res.status(403).json({ error: "admin_only", field: "empFields" });
    $set.empFields = empFields;
  }
  if (extLinks !== undefined) {
    if (!req.user.employee.isAdmin) return res.status(403).json({ error: "admin_only", field: "extLinks" });
    if (extLinks.some((l) => !/^https?:\/\//.test(l.url || ""))) return res.status(422).json({ error: "invalid_link_url" });
    $set.extLinks = extLinks;
  }
  await col("settings").updateOne({ _id: "global" }, { $set });
  res.json({ ok: true });
});
router.get("/admin/permissions", requireAdmin, async (_req, res) => {
  const doc = await col("permissions").findOne({ _id: "global" });
  res.json({ groups: R.PERM_GROUPS.map((g) => ({ module: g.module, caps: g.caps.map(([id, label]) => ({ id, label })) })), perms: R.mergePerms(doc && doc.perms) });
});
router.put("/admin/permissions", requireAdmin, audit("permissions.update"), async (req, res) => {
  await col("permissions").updateOne({ _id: "global" }, { $set: { perms: req.body.perms, updatedAt: new Date(), updatedBy: req.user.employee.name } }, { upsert: true });
  res.json({ ok: true });
});
// Grant or revoke Admin. Admins cannot revoke themselves, which also guarantees at
// least one Admin always remains.
router.put("/admin/employees/:id/admin", requireAdmin, audit("employee.setAdmin"), async (req, res) => {
  const id = oid(req.params.id);
  const isAdmin = req.body && req.body.isAdmin;
  if (typeof isAdmin !== "boolean") return res.status(422).json({ error: "isAdmin_must_be_boolean" });
  if (isAdmin && (await col("employees").findOne({ _id: id, inactive: true }))) return res.status(422).json({ error: "employee_inactive", detail: "Inactive employees can't be made Admin." });
  if (!isAdmin && id.equals(req.user.employee._id)) return res.status(422).json({ error: "cannot_revoke_self", detail: "You can't remove your own Admin access — ask another Admin." });
  const r = await col("employees").updateOne({ _id: id }, { $set: { isAdmin, updatedAt: new Date(), updatedBy: req.user.employee.name } });
  if (!r.matchedCount) return res.status(404).json({ error: "employee_not_found" });
  res.json({ ok: true });
});
router.get("/audit", requireAdmin, async (req, res) => {
  res.json(await col("auditLog").find().sort({ at: -1 }).limit(Number(req.query.limit || 200)).toArray());
});

module.exports = router;
