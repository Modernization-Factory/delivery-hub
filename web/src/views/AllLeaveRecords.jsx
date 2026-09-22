import { useState } from "react";
import { fmtShort } from "../lib/dates.js";
import { LEAVE_COLORS, leaveDays } from "../lib/leave.js";
import { Btn, Card, Pill, inputCls } from "../ui/atoms.jsx";
import { BRAND_FONT } from "../ui/brand.jsx";
import { usePaged } from "../ui/usePaged.jsx";

// ============================================================
// ALL LEAVE RECORDS (Lead / PM / Admin)
// ============================================================
export function AllLeaveRecords(ctx) {
  const { leaves, leaveTypes, weekendDays, holidaySet, setLeaves, empByName } = ctx;
  const [q, setQ] = useState("");
  const [ft, setFt] = useState("All");
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
          {leaveTypes.map((t) => <option key={t.name}>{t.name}</option>)}
        </select>
        <span className="self-center text-xs text-slate-500">{rows.length} entries</span>
      </div>
      <Card>
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4">Employee</th><th className="py-2 pr-4">Company</th><th className="py-2 pr-4">Dates</th><th className="py-2 pr-4">Type</th><th className="py-2 pr-4">Days</th><th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.map((l) => (
                <tr key={l.id}>
                  <td className="py-1.5 pr-4 font-medium text-slate-800">{l.name}</td>
                  <td className="py-1.5 pr-4 text-slate-500">{empByName[l.name] ? empByName[l.name].company : "—"}</td>
                  <td className="py-1.5 pr-4">{fmtShort(l.start)}{l.start !== l.end ? " – " + fmtShort(l.end) : ""}</td>
                  <td className="py-1.5 pr-4"><Pill tone={LEAVE_COLORS[l.type] || "bg-slate-100 text-slate-600"}>{l.type}</Pill></td>
                  <td className="py-1.5 pr-4">{leaveDays(l.start, l.end, l.type, leaveTypes, weekendDays, holidaySet)}</td>
                  <td className="py-1.5 text-right"><Btn small kind="danger" onClick={() => setLeaves(leaves.filter((x) => x.id !== l.id))}>Delete</Btn></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {leavePager}
      </Card>
    </div>
  );
}
