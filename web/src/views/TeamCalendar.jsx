import { useState, useMemo } from "react";
import { fmt, fmtShort, toISO } from "../lib/dates.js";
import { leaveColor, onLeaveOn } from "../lib/leave.js";
import { Btn, Card, Pill } from "../ui/atoms.jsx";
import { BRAND_FONT } from "../ui/brand.jsx";

// ============================================================
// TEAM CALENDAR (view for everyone)
// ============================================================
export function TeamCalendar(ctx) {
  const { leaves, holidays, holidaySet, weekendDays, empByName, leaveTypes } = ctx;
  const [day, setDay] = useState(null); // ISO date whose full list is open
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
          <Btn kind="ghost" small onClick={() => { setDay(null); setYm(month === 0 ? [year - 1, 11] : [year, month - 1]); }}>←</Btn>
          <div className="w-44 text-center text-sm font-semibold">{monthName}</div>
          <Btn kind="ghost" small onClick={() => { setDay(null); setYm(month === 11 ? [year + 1, 0] : [year, month + 1]); }}>→</Btn>
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
              <div key={iso} style={{ minHeight: 84 }}
                role={on.length ? "button" : undefined} tabIndex={on.length ? 0 : undefined}
                title={on.length ? "Click to see everyone away on this day" : undefined}
                onClick={() => on.length && setDay(day === iso ? null : iso)}
                onKeyDown={(e) => on.length && (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setDay(day === iso ? null : iso))}
                className={"p-1.5 " + (hol ? "bg-emerald-50" : wk ? "bg-slate-50" : "bg-white") + (on.length ? " cursor-pointer hover:ring-2 hover:ring-inset hover:ring-emerald-300" : "") + (day === iso ? " ring-2 ring-inset ring-emerald-600" : "")}>
                <div className="flex items-center justify-between">
                  <span className={"text-xs font-semibold " + (hol ? "text-emerald-700" : wk ? "text-slate-400" : "text-slate-600")}>{d}</span>
                  {hol && <span className="text-xs font-medium uppercase text-emerald-600">Holiday</span>}
                </div>
                <div className="mt-1 space-y-0.5">
                  {on.slice(0, 3).map((l) => (
                    <div key={l.id + iso} className={"truncate rounded px-1 py-0.5 text-xs font-medium " + leaveColor(l.type, ctx.leaveTypes)} title={l.name + " · " + l.type + (empByName[l.name] ? " · " + empByName[l.name].company : "") + (l.comment ? " · " + l.comment : "")}>
                      {l.name.split(" ")[0]} {l.name.split(" ")[1] ? l.name.split(" ")[1][0] + "." : ""}{l.comment ? " ✎" : ""}
                    </div>
                  ))}
                  {on.length > 3 && <div className="text-xs font-medium text-emerald-700 underline">+{on.length - 3} more</div>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="font-medium">Legend:</span>
          {leaveTypes.map((t) => <Pill key={t.name} tone={leaveColor(t.name, leaveTypes)}>{t.name}</Pill>)}
          <Pill tone="bg-emerald-50 text-emerald-700 border border-emerald-200">Holiday</Pill>
          <span className="ml-auto text-slate-400">Click a day to see everyone away on it.</span>
        </div>
      </Card>
      {day && (() => {
        const away = onLeaveOn(day, monthLeaves).sort((a, b) => a.name.localeCompare(b.name));
        const byType = {};
        away.forEach((l) => (byType[l.type] = (byType[l.type] || 0) + 1));
        return (
          <div ref={(el) => el && el.scrollIntoView({ behavior: "smooth", block: "nearest" })}>
          <Card title={"Away on " + fmt(day) + " (" + away.length + ")"} right={<Btn kind="ghost" small onClick={() => setDay(null)}>Close</Btn>}>
            <div className="mb-3 flex flex-wrap gap-1">
              {Object.entries(byType).map(([t, n]) => <Pill key={t} tone={leaveColor(t, leaveTypes)}>{t} {n}</Pill>)}
              {holidaySet.has(day) && <Pill tone="bg-emerald-50 text-emerald-700 border border-emerald-200">Holiday</Pill>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-4">Name</th><th className="py-2 pr-4">Company</th><th className="py-2 pr-4">Type</th><th className="py-2 pr-4">Leave dates</th><th className="py-2 pr-4">Comment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {away.map((l) => (
                    <tr key={l.id}>
                      <td className="py-1.5 pr-4 font-medium text-slate-800">{l.name}</td>
                      <td className="py-1.5 pr-4 text-slate-500">{empByName[l.name] ? empByName[l.name].company : "—"}</td>
                      <td className="py-1.5 pr-4"><Pill tone={leaveColor(l.type, leaveTypes)}>{l.type}</Pill></td>
                      <td className="py-1.5 pr-4 text-slate-600">{l.start === l.end ? fmtShort(l.start) : fmtShort(l.start) + " – " + fmtShort(l.end)}</td>
                      <td className="py-1.5 pr-4 text-xs text-slate-600">{l.comment || <span className="text-slate-300">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          </div>
        );
      })()}
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
