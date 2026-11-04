import { useState } from "react";
import { isActiveDuring } from "../lib/leave.js";
import { PERM_GROUPS, defaultPerms } from "../lib/permissions.js";

// "Team Manager" isn't a role: a flagged team manager gets their role's column plus this one,
// always limited to their reporting chain, and never the project screens
const PERM_ROLES = ["Developer", "Senior Developer", "Lead", "Project Manager", "Viewer", "Team Manager"];
import { Btn, Card, Field, Notice, Stat, inputCls } from "../ui/atoms.jsx";
import { BRAND_FONT } from "../ui/brand.jsx";

// ============================================================
// ADMIN PANEL
// ============================================================
export function AdminPanel(ctx) {
  const { allEmployees: employees, leaves, comps, tcRows, tcWeeks, todayISO } = ctx;
  const activeCount = employees.filter((e) => !e.inactive && isActiveDuring(e, todayISO, todayISO)).length;
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>Administration</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Employees" value={employees.length} sub={activeCount + " active today (end dates and Inactive flag respected)"} />
        <Stat label="Leave records" value={leaves.length} />
        <Stat label="Comp-off entries" value={comps.length} />
        <Stat label="Timecard rows" value={tcRows.length} sub={tcWeeks.length + " weeks · " + ctx.assignments.length + " assignments · " + ctx.scores.length + " perf scores"} />
      </div>
      <Card title="Permissions — per module, per capability (changes apply instantly)"
        right={<Btn small kind="ghost" onClick={() => ctx.setPerms(defaultPerms())}>Reset to defaults</Btn>}>
        <p className="mb-3 text-sm text-slate-500">Core rights are fixed: everyone submits their own leave, sees the team calendar and their own timecard; Admin always has everything. Everything else is editable below per role. Senior Developers who are Stream Leads inherit the Lead column; Viewers browse everything and write nothing until granted here. <b>Team Manager</b> is added on top of a flagged person's own role, only ever for their reporting chain — project screens (Projects, Team Plans, Program Health, Runway) stay off for them whatever is ticked.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4">Capability</th>
                {PERM_ROLES.map((r) => <th key={r} className="py-2 pr-4 text-center">{r}</th>)}
                <th className="py-2 pr-4 text-center">Admin</th>
              </tr>
            </thead>
            <tbody>
              {PERM_GROUPS.map((g) => [
                <tr key={g.module} className="bg-slate-50">
                  <td colSpan={PERM_ROLES.length + 2} className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{g.module}</td>
                </tr>,
                ...g.caps.map(([id, label]) => (
                  <tr key={id} className="border-b border-slate-100">
                    <td className="py-1.5 pr-4 text-slate-700">{label}</td>
                    {PERM_ROLES.map((r) => (
                      <td key={r} className="py-1.5 pr-4 text-center">
                        <input type="checkbox" className="h-4 w-4 cursor-pointer accent-emerald-700"
                          checked={!!(ctx.perms[id] && ctx.perms[id][r])}
                          onChange={(e) => ctx.setPerms({ ...ctx.perms, [id]: { ...ctx.perms[id], [r]: e.target.checked } })} />
                      </td>
                    ))}
                    <td className="py-1.5 pr-4 text-center"><span className="text-emerald-600" title="Admin always has full access">●</span></td>
                  </tr>
                )),
              ])}
            </tbody>
          </table>
        </div>
      </Card>
      <AdminAccessCard {...ctx} />
      <ExtLinksCard {...ctx} />
    </div>
  );
}

// Grant / revoke Admin access. The server refuses self-revocation, so one Admin always remains.
export function AdminAccessCard(ctx) {
  const { employees, user, todayISO, setEmployeeAdmin } = ctx;
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const admins = ctx.allEmployees.filter((e) => e.isAdmin);
  const candidates = employees.filter((e) => !e.isAdmin && e.email && isActiveDuring(e, todayISO, todayISO));
  async function change(emp, isAdmin) {
    setMsg(null); setBusy(true);
    try {
      await setEmployeeAdmin(emp.id, isAdmin);
      setMsg({ tone: "success", text: emp.name + (isAdmin ? " is now an Admin." : " is no longer an Admin.") });
      if (isAdmin) setPick("");
    } catch (e) {
      setMsg({ tone: "error", text: e.message });
    } finally { setBusy(false); }
  }
  return (
    <Card title={"Admin access (" + admins.length + ")"}>
      <p className="mb-3 text-sm text-slate-500">Admins have every capability, including this screen. Only active employees with an email on record can be made Admin. You can't remove your own access — ask another Admin.</p>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Make an employee Admin">
          <select className={inputCls} value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">Select an employee…</option>
            {candidates.map((e) => <option key={e.id} value={e.id}>{e.name} — {e.email}</option>)}
          </select>
        </Field>
        <Btn small disabled={!pick || busy} onClick={() => { const emp = employees.find((e) => e.id === pick); if (emp && window.confirm("Give " + emp.name + " full Admin access?")) change(emp, true); }}>Make Admin</Btn>
      </div>
      {msg && <div className="mt-2"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
      {admins.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-100">
          {admins.map((a) => (
            <li key={a.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                <span className="font-medium text-slate-800">{a.name}</span>
                <span className="ml-2 text-xs text-slate-400">{a.email}</span>
                {a.name === user.name && <span className="ml-2 text-xs text-slate-500">(you)</span>}
              </span>
              {a.name !== user.name && <Btn small kind="danger" disabled={busy} onClick={() => { if (window.confirm("Remove Admin access from " + a.name + "?")) change(a, false); }}>Remove Admin</Btn>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// External application links manager (Admin) — rendered in every user's sidebar
export function ExtLinksCard(ctx) {
  const { extLinks, setExtLinks, nextId } = ctx;
  const [f, setF] = useState({ label: "", url: "", description: "" });
  const [msg, setMsg] = useState(null);
  function add() {
    setMsg(null);
    if (!f.label.trim()) return setMsg("A label is required — it's the menu text.");
    if (!/^https?:\/\//.test(f.url.trim())) return setMsg("The URL must start with http:// or https://");
    if (extLinks.some((l) => l.label.toLowerCase() === f.label.trim().toLowerCase())) return setMsg("A link with that label already exists.");
    setExtLinks([...extLinks, { id: nextId("x"), label: f.label.trim(), url: f.url.trim(), description: f.description.trim() }]);
    setF({ label: "", url: "", description: "" });
  }
  return (
    <Card title={"External application links (" + extLinks.length + ") — shown in everyone's sidebar under \"Links\""}>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Menu label"><input className={inputCls} value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="JIRA board" /></Field>
        <Field label="URL"><input className={inputCls} value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://…" /></Field>
        <Field label="Description (hover tooltip)"><input className={inputCls} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Sprint board for OPUSM R2" /></Field>
        <div className="self-end"><Btn small onClick={add}>Add link</Btn></div>
      </div>
      {msg && <div className="mt-2"><Notice tone="error">{msg}</Notice></div>}
      {extLinks.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-100">
          {extLinks.map((l) => (
            <li key={l.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                <span className="font-medium text-slate-800">{l.label}</span>
                <a href={l.url} target="_blank" rel="noopener noreferrer" className="ml-2 text-xs text-emerald-700 underline">{l.url}</a>
                {l.description && <span className="ml-2 text-xs text-slate-400">{l.description}</span>}
              </span>
              <Btn small kind="danger" onClick={() => setExtLinks(extLinks.filter((x) => x.id !== l.id))}>Remove</Btn>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-slate-400">Links open in a new tab. Visible to every role — keep them non-sensitive.</p>
    </Card>
  );
}
