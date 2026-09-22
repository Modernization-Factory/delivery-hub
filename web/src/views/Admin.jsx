import { useState } from "react";
import { isActiveDuring } from "../lib/leave.js";
import { PERM_GROUPS, defaultPerms } from "../lib/permissions.js";
import { Btn, Card, Field, Notice, Stat, inputCls } from "../ui/atoms.jsx";
import { BRAND_FONT } from "../ui/brand.jsx";

// ============================================================
// ADMIN PANEL
// ============================================================
export function AdminPanel(ctx) {
  const { employees, leaves, comps, tcRows, tcWeeks, todayISO } = ctx;
  const activeCount = employees.filter((e) => isActiveDuring(e, todayISO, todayISO)).length;
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>Administration</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Employees" value={employees.length} sub={activeCount + " active today (end dates respected)"} />
        <Stat label="Leave records" value={leaves.length} />
        <Stat label="Comp-off entries" value={comps.length} />
        <Stat label="Timecard rows" value={tcRows.length} sub={tcWeeks.length + " weeks · " + ctx.assignments.length + " assignments · " + ctx.scores.length + " perf scores"} />
      </div>
      <Card title="Permissions — per module, per capability (changes apply instantly)"
        right={<Btn small kind="ghost" onClick={() => ctx.setPerms(defaultPerms())}>Reset to defaults</Btn>}>
        <p className="mb-3 text-sm text-slate-500">Core rights are fixed: everyone submits their own leave, sees the team calendar and their own timecard; Admin always has everything. Everything else is editable below per role. Stream Leads inherit the Lead column; Viewers browse everything and write nothing until granted here.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4">Capability</th>
                {["Developer", "Lead", "Project Manager", "Viewer"].map((r) => <th key={r} className="py-2 pr-4 text-center">{r}</th>)}
                <th className="py-2 pr-4 text-center">Admin</th>
              </tr>
            </thead>
            <tbody>
              {PERM_GROUPS.map((g) => [
                <tr key={g.module} className="bg-slate-50">
                  <td colSpan={6} className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{g.module}</td>
                </tr>,
                ...g.caps.map(([id, label]) => (
                  <tr key={id} className="border-b border-slate-100">
                    <td className="py-1.5 pr-4 text-slate-700">{label}</td>
                    {["Developer", "Lead", "Project Manager", "Viewer"].map((r) => (
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
      <ExtLinksCard {...ctx} />
      <Card title="Shipped in v2.3 — Remaining Runway">
        <p className="text-sm text-slate-700">Per-role runway per project, reproducing the source sheet's model with its bugs fixed: remaining billable hours ÷ weekly burn (headcount × 40 h, per-assignment overrides honoured — e.g. the three 48 h/week developers), projected from the week anchor with real working-day math. Remaining hours are derived from allocations (8 h per working day, day-weighted across concurrent projects, from the funding start) with per-role manual overrides for finance corrections. The last date is extended by real approved leave — fixing the source formula that passed a leave-day count where WORKDAY expects holiday dates, so forecasts never actually shifted anything. Pricing rows from the source sheet remain excluded.</p>
      </Card>
      <Card title="Shipped in v2.2 — Performance">
        <p className="text-sm text-slate-700">Weekly partner scoring exactly per the locked decisions: partner resources only (WeKan · Globant · Ciklum) with an Admin switch to extend to MDB; Config-tab weights as baseline (Delivery 25 · Quality 20 · Communication 10 · Tech 25 · Timecard 10 · Collaboration 10), Admin-editable with a must-total-100 guard; RAG Green ≥ 3.5 / Amber ≥ 2.5; Leads (including Stream Leads) score openly; Developers never see the module. 60 real scoring rows migrated from the source tracker (12 weeks, with the drag-filled 2029–2062 week dates corrected to 2026 and four name variants reconciled). Timecard metric offers a one-click suggestion derived from each person's proactiveness %.</p>
      </Card>
      <Card title="Shipped in v2.1 — Allocations (merged with Team Plans)">
        <p className="text-sm text-slate-700">Project → Phase → Stream assignments with date ranges (same-project overlaps blocked; concurrent projects allowed with even day-weighted FTE split) · allocation status derived from active assignments · retention tracking dropped by decision · projected burn (effort days, FTE, unallocated) derived from ranges against real working days, clipped to employment windows · pricing excluded (revisits in Runway, Admin-only) · Lead, PM and Admin can all create and edit assignments. Source-data note: the Excel allocation grid was empty (2 cells), so this module starts greenfield with those two real assignments seeded.</p>
      </Card>
      <Card title="v2 modules — decisions already locked">
        <ul className="space-y-2 text-sm text-slate-700">
          <li className="rounded-lg bg-slate-50 p-3"><span className="font-semibold">Allocations:</span> monthly stream allocation (14 streams from the source Config), retention remarks and projected burn — the data backbone (Name · Company · Release · Role) is already shared with this app.</li>
          <li className="rounded-lg bg-slate-50 p-3"><span className="font-semibold">Program Health</span> (from AMP APAC Program Health v2.0 — analysed, sequenced ahead of Runway since it feeds it): pipeline stage board (7 opportunities), active project register with KPIs and RAG, weekly health via a single entry form replacing the sheet-per-project pattern, milestone slip timeline, RAID log with aging, decision tracker. Open questions for the build round: margin visibility (Admin-only or excluded, like pricing), meaning of the pipeline "xW" column, weekly-entry ownership, and a correction pass on the corrupted Bendigo week dates during migration.</li>

          <li className="rounded-lg bg-slate-50 p-3"><span className="font-semibold">Team Plans:</span> per-project planning — assign people to streams with allocation % and date ranges, flag over-allocation across projects, and validate planned capacity against the leave calendar. Extends Allocations from a read-only grid to a planning tool.</li>
        </ul>
      </Card>
    </div>
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
