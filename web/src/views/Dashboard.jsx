import { STREAM_COLORS, activeAssignmentsOn } from "../lib/allocations.js";
import { fmt, fmtShort, parseISO, toISO } from "../lib/dates.js";
import { LEAVE_COLORS, balancesFor, onLeaveOn } from "../lib/leave.js";
import { TC_COLORS, weekComplianceFlex } from "../lib/timecard.js";
import { Btn, Card, Pill, Stat } from "../ui/atoms.jsx";
import { BRAND_FONT } from "../ui/brand.jsx";

// ============================================================
// DASHBOARD
// ============================================================
export function Dashboard(ctx) {
  const { user, leaves, tcRows, tcWeeks, holidays, todayISO, leaveTypes, weekendDays, holidaySet, comps, isDev, setNav, empByName } = ctx;
  const canManage = ctx.can("timecard.insights");
  const onToday = onLeaveOn(todayISO, leaves);
  // this week range (Mon..Sun containing today)
  const t = parseISO(todayISO);
  const monday = new Date(t.getFullYear(), t.getMonth(), t.getDate() - ((t.getDay() + 6) % 7));
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  const wkStart = toISO(monday), wkEnd = toISO(sunday);
  const thisWeek = leaves.filter((l) => l.start <= wkEnd && wkStart <= l.end);
  const upcomingHol = holidays.filter((h) => h >= todayISO).slice(0, 3);
  let lastWeekIdx = tcWeeks.length - 1;
  while (lastWeekIdx > 0 && weekComplianceFlex(tcRows, lastWeekIdx, ctx.jiraFlags) === null) lastWeekIdx--;
  const compliance = weekComplianceFlex(tcRows, lastWeekIdx, ctx.jiraFlags);
  const mine = balancesFor(user.name, leaves, comps, leaveTypes, weekendDays, holidaySet);
  const myNext = leaves.filter((l) => l.name === user.name && l.end >= todayISO).sort((a, b) => a.start.localeCompare(b.start))[0];
  const myTc = tcRows.find((r) => r.name === user.name);
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>
          {new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening"}, {user.name.split(" ")[0]}
        </h2>
        <p className="text-sm text-slate-500">{fmt(todayISO)} · viewing as {user.role}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="On leave today" value={onToday.length} sub={onToday.slice(0, 2).map((l) => l.name.split(" ")[0]).join(", ") || "Full house"} />
        <Stat label="Leaves this week" value={thisWeek.length} sub={fmtShort(wkStart) + " – " + fmtShort(wkEnd)} />
        <Stat label={canManage ? "Timecard proactive (last wk)" : "My comp-off balance"} value={canManage ? (compliance === null ? "—" : compliance + "%") : mine.compOffBalance} sub={canManage ? "week ending " + fmtShort(tcWeeks[lastWeekIdx]) : mine.compOffEarned + " earned · " + mine.compOffUsed + " used"} />
        <Stat label="Next holiday" value={upcomingHol[0] ? fmtShort(upcomingHol[0]) : "—"} sub={upcomingHol.slice(1).map(fmtShort).join(" · ")} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Away this week" right={<Btn kind="ghost" small onClick={() => setNav("calendar")}>Open calendar</Btn>}>
          {thisWeek.length === 0 ? (
            <p className="text-sm text-slate-500">No one is on leave this week.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {thisWeek.slice(0, 8).map((l) => (
                <li key={l.id} className="flex items-center justify-between py-2">
                  <div>
                    <div className="text-sm font-medium text-slate-800">{l.name}</div>
                    <div className="text-xs text-slate-500">{fmtShort(l.start)}{l.start !== l.end ? " – " + fmtShort(l.end) : ""} · {empByName[l.name] ? empByName[l.name].company : ""}</div>
                  </div>
                  <Pill tone={LEAVE_COLORS[l.type] || "bg-slate-100 text-slate-600"}>{l.type}</Pill>
                </li>
              ))}
              {thisWeek.length > 8 && <li className="py-2 text-xs text-slate-400">+ {thisWeek.length - 8} more on the calendar</li>}
            </ul>
          )}
        </Card>
        <Card title="My snapshot" right={<Btn kind="ghost" small onClick={() => setNav("myleave")}>My leave</Btn>}>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Vacation taken</div>
              <div className="text-lg font-semibold">{mine.byType["Vacation"] || 0} days</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Sick taken</div>
              <div className="text-lg font-semibold">{mine.byType["Sick"] || 0} days</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs text-slate-500">My stream</div>
              <div className="mt-1">
                {(() => {
                  const act = activeAssignmentsOn(ctx.assignments, user.name, todayISO);
                  if (act.length === 0) return <span className="text-sm text-slate-400">Unallocated</span>;
                  const pname = (a) => { const p = ctx.projects.find((x) => x.id === a.projectId); return (p ? p.name : "?") + (a.phase ? " · " + a.phase : ""); };
                  return <span className="inline-flex flex-wrap gap-1">{act.slice(0, 2).map((a) => <Pill key={a.id} tone={STREAM_COLORS[a.stream] || "bg-slate-100 text-slate-600"}>{pname(a)}{a.stream ? " · " + a.stream : ""}</Pill>)}</span>;
                })()}
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Next leave</div>
              <div className="text-sm font-medium">{myNext ? fmtShort(myNext.start) + " · " + myNext.type : "None planned"}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs text-slate-500">My last timecard (SF / JIRA)</div>
              <div className="mt-1 flex gap-1">
                {myTc ? (
                  <>
                    <Pill tone={TC_COLORS[(myTc.weeks[lastWeekIdx] || ["", ""])[0] || ""]}>{(myTc.weeks[lastWeekIdx] || ["", ""])[0] || "—"}</Pill>
                    <Pill tone={TC_COLORS[(myTc.weeks[lastWeekIdx] || ["", ""])[1] || ""]}>{(myTc.weeks[lastWeekIdx] || ["", ""])[1] || "—"}</Pill>
                  </>
                ) : (
                  <span className="text-xs text-slate-400">Not on the timecard grid</span>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
