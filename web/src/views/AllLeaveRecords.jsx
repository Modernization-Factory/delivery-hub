import { useState } from "react";
import { fmtShort } from "../lib/dates.js";
import { LEAVE_COLORS, leaveColor, leaveDays } from "../lib/leave.js";
import { canDeletePastLeave } from "../lib/permissions.js";
import { Btn, Card, Notice, Pill, inputCls } from "../ui/atoms.jsx";
import { BRAND_FONT } from "../ui/brand.jsx";
import { usePaged } from "../ui/usePaged.jsx";
import { LeaveEditForm, canEditLeave } from "../ui/LeaveEditor.jsx";

// ============================================================
// ALL LEAVE RECORDS (Lead / PM / Admin)
// ============================================================
export function AllLeaveRecords(ctx) {
  const { leaves, leaveTypes, weekendDays, holidaySet, setLeaves, empByName, user, todayISO } = ctx;
  const canDeletePast = canDeletePastLeave(user.role);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null); // leave id being edited (row stays highlighted)
  const [msg, setMsg] = useState(null);
  const [ft0, setFt] = useState("All");
  // types in the data, not just the configured list — so an off-list type (e.g. "Tentative") can be found;
  // a filter on a name that no longer exists (renamed type) falls back to All
  const typeOptions = [...new Set([...leaveTypes.map((t) => t.name), ...leaves.map((l) => l.type)])];
  const ft = ft0 === "All" || typeOptions.includes(ft0) ? ft0 : "All";
  const unknown = (t) => !leaveTypes.some((x) => x.name === t);
  const rows = leaves
    .filter((l) => (ft === "All" || l.type === ft) && l.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.start.localeCompare(a.start));
  const { rows: pageRows, pager: leavePager } = usePaged(rows, 25);
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>Leave Records — all people</h2>
      <div className="flex flex-wrap gap-3">
        <input className={inputCls + " max-w-xs"} placeholder="Search name…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={inputCls} style={{ maxWidth: 160 }} value={ft} onChange={(e) => setFt(e.target.value)}>
          <option>All</option>
          {typeOptions.map((t) => <option key={t} value={t}>{t}{unknown(t) ? " (not a configured type)" : ""}</option>)}
        </select>
        <span className="self-center text-xs text-slate-500">{rows.length} entries</span>
      </div>
      {msg && <Notice tone={msg.tone === "ok" ? "ok" : "error"}>{msg.text}</Notice>}
      <Card>
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4">Employee</th><th className="py-2 pr-4">Company</th><th className="py-2 pr-4">Dates</th><th className="py-2 pr-4">Type</th><th className="py-2 pr-4">Days</th><th className="py-2 pr-4">Comment</th><th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.map((l) => (
                [
                <tr key={l.id} className={editing === l.id ? "bg-emerald-50" : ""}>
                  <td className="py-1.5 pr-4 font-medium text-slate-800">{l.name}</td>
                  <td className="py-1.5 pr-4 text-slate-500">{empByName[l.name] ? empByName[l.name].company : "—"}</td>
                  <td className="py-1.5 pr-4">{fmtShort(l.start)}{l.start !== l.end ? " – " + fmtShort(l.end) : ""}</td>
                  <td className="py-1.5 pr-4"><Pill tone={leaveColor(l.type, ctx.leaveTypes)}>{l.type}</Pill></td>
                  <td className="py-1.5 pr-4">{leaveDays(l.start, l.end, l.type, leaveTypes, weekendDays, holidaySet)}</td>
                  <td className="py-1.5 pr-4 text-xs text-slate-600">{l.comment || <span className="text-slate-300">—</span>}</td>
                  <td className="py-1.5 whitespace-nowrap text-right">{canEditLeave(l, user, todayISO) && <Btn small kind="ghost" onClick={() => { setMsg(null); setEditing(editing === l.id ? null : l.id); }}>Edit</Btn>}{(l.start >= todayISO || canDeletePast) && <Btn small kind="danger" onClick={() => setLeaves(leaves.filter((x) => x.id !== l.id))}>Delete</Btn>}</td>
                </tr>,
                editing === l.id && (
                  <tr key={l.id + "_edit"}><td colSpan={8} className="bg-emerald-50 px-2 py-2">
                    <LeaveEditForm leave={l} leaveTypes={leaveTypes} user={user} todayISO={todayISO}
                      onSave={async (p) => { await ctx.updateLeave(l.id, p); setEditing(null); setMsg({ tone: "ok", text: l.name + "'s leave updated." }); }}
                      onCancel={() => setEditing(null)} />
                  </td></tr>
                ),
                ]
              ))}
            </tbody>
          </table>
        </div>
        {leavePager}
      </Card>
    </div>
  );
}
