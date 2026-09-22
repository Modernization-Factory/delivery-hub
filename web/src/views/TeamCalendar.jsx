import { useState, useMemo } from "react";
import { fmtShort, toISO } from "../lib/dates.js";
import { LEAVE_COLORS, onLeaveOn } from "../lib/leave.js";
import { Btn, Card, Pill } from "../ui/atoms.jsx";
import { BRAND_FONT } from "../ui/brand.jsx";

// ============================================================
// TEAM CALENDAR (view for everyone)
// ============================================================
export function TeamCalendar(ctx) {
  const { leaves, holidays, holidaySet, weekendDays, empByName } = ctx;
  const now = new Date();
  const [ym, setYm] = useState([now.getFullYear(), now.getMonth()]); // [year, 0-based month]
  const [year, month] = ym;
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lead = first.getDay(); // cells before day 1 (weeks start Sunday like the source tracker)
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const monthName = first.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const monthLeaves = useMemo(() => {
    const startISO = toISO(new Date(year, month, 1));
    const endISO = toISO(new Date(year, month, daysInMonth));
    return leaves.filter((l) => l.start <= endISO && startISO <= l.end);
  }, [leaves, year, month, daysInMonth]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>Team Calendar</h2>
        <div className="flex items-center gap-2">
          <Btn kind="ghost" small onClick={() => setYm(month === 0 ? [year - 1, 11] : [year, month - 1])}>←</Btn>
          <div className="w-44 text-center text-sm font-semibold">{monthName}</div>
          <Btn kind="ghost" small onClick={() => setYm(month === 11 ? [year + 1, 0] : [year, month + 1])}>→</Btn>
        </div>
      </div>
      <Card>
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-slate-200 text-xs">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="bg-slate-50 px-2 py-1.5 text-center font-semibold text-slate-500">{d}</div>
          ))}
          {cells.map((d, i) => {
            if (d === null) return <div key={"x" + i} className="bg-white" style={{ minHeight: 84 }} />;
            const iso = toISO(new Date(year, month, d));
            const dow = new Date(year, month, d).getDay();
            const wk = weekendDays.includes(dow);
            const hol = holidaySet.has(iso);
            const on = onLeaveOn(iso, monthLeaves);
            return (
              <div key={iso} style={{ minHeight: 84 }} className={"p-1.5 " + (hol ? "bg-emerald-50" : wk ? "bg-slate-50" : "bg-white")}>
                <div className="flex items-center justify-between">
                  <span className={"text-xs font-semibold " + (hol ? "text-emerald-700" : wk ? "text-slate-400" : "text-slate-600")}>{d}</span>
                  {hol && <span className="text-xs font-medium uppercase text-emerald-600">Holiday</span>}
                </div>
                <div className="mt-1 space-y-0.5">
                  {on.slice(0, 3).map((l) => (
                    <div key={l.id + iso} className={"truncate rounded px-1 py-0.5 text-xs font-medium " + (LEAVE_COLORS[l.type] || "bg-slate-100 text-slate-600")} title={l.name + " · " + l.type + (empByName[l.name] ? " · " + empByName[l.name].company : "")}>
                      {l.name.split(" ")[0]} {l.name.split(" ")[1] ? l.name.split(" ")[1][0] + "." : ""}
                    </div>
                  ))}
                  {on.length > 3 && <div className="text-xs text-slate-400">+{on.length - 3} more</div>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="font-medium">Legend:</span>
          {Object.entries(LEAVE_COLORS).map(([k, v]) => <Pill key={k} tone={v}>{k}</Pill>)}
          <Pill tone="bg-emerald-50 text-emerald-700 border border-emerald-200">Holiday</Pill>
        </div>
      </Card>
      <Card title={"Everyone away in " + monthName + " (" + monthLeaves.length + " entries)"}>
        <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {monthLeaves.sort((a, b) => a.start.localeCompare(b.start)).map((l) => (
            <div key={l.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-xs">
              <span className="truncate font-medium text-slate-700">{l.name}</span>
              <span className="ml-2 shrink-0 text-slate-500">{fmtShort(l.start)}{l.start !== l.end ? "–" + fmtShort(l.end) : ""}</span>
            </div>
          ))}
          {monthLeaves.length === 0 && <p className="text-sm text-slate-500">No leave this month.</p>}
        </div>
      </Card>
    </div>
  );
}
