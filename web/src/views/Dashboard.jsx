import { STREAM_COLORS, activeAssignmentsOn } from "../lib/allocations.js";
import { dataGaps, leavesBetween, myTimecardTrail, projectsOf, teamOf, timecardLaggards } from "../lib/dashboard.js";
import { fmt, fmtShort, parseISO, toISO } from "../lib/dates.js";
import { LEAVE_COLORS, leaveColor, balancesFor, onLeaveOn } from "../lib/leave.js";
import { PH_RAG_TONE, phRowFor } from "../lib/programHealth.js";
import { computeRunway, runwaySummary } from "../lib/runway.js";
import { TC_COLORS, weekComplianceFlex } from "../lib/timecard.js";
import { Btn, Card, Pill, Stat } from "../ui/atoms.jsx";
import { BRAND_FONT } from "../ui/brand.jsx";

// ============================================================
// DASHBOARD — a personal strip for everyone, then the sections that match
// what this person is responsible for. Sections key off capabilities, not role
// names, so a custom permission matrix still gets a sensible dashboard.
// ============================================================
export function Dashboard(ctx) {
  const { user, leaves, tcRows, tcWeeks, holidays, todayISO, leaveTypes, weekendDays, holidaySet, comps, setNav, empByName, assignments, jiraFlags } = ctx;
  const projects = ctx.projects; // open projects only
  const can = ctx.can;
  const add = (iso, n) => { const d = parseISO(iso); return toISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)); };
  const t = parseISO(todayISO);
  const wkStart = toISO(new Date(t.getFullYear(), t.getMonth(), t.getDate() - ((t.getDay() + 6) % 7)));
  const wkEnd = add(wkStart, 6);
  const in14 = add(todayISO, 14);

  // the last week anyone actually filled in
  let lastWeekIdx = tcWeeks.length - 1;
  while (lastWeekIdx > 0 && weekComplianceFlex(tcRows, lastWeekIdx, jiraFlags) === null) lastWeekIdx--;

  // ---- me ----
  const mine = balancesFor(user.name, leaves, comps, leaveTypes, weekendDays, holidaySet);
  const myNext = leaves.filter((l) => l.name === user.name && l.end >= todayISO).sort((a, b) => a.start.localeCompare(b.start))[0];
  const myRow = tcRows.find((r) => r.name === user.name);
  const myTrail = myTimecardTrail(myRow, tcWeeks, 8, myRow ? jiraFlags[myRow.id] : null);
  const myAssign = activeAssignmentsOn(assignments, user.name, todayISO);
  const allProjects = ctx.allProjects || projects;
  const pname = (pid) => { const p = allProjects.find((x) => x.id === pid); return p ? p.name : "?"; };
  const nextHol = holidays.filter((h) => h >= todayISO);
  const myLastTc = myRow ? myRow.weeks[lastWeekIdx] || ["", ""] : null;

  // ---- my team: people on my projects (or projects I PM) ----
  const team = teamOf(assignments, projects, user.name, todayISO);
  const teamAwayToday = leavesBetween(leaves, todayISO, todayISO, team);
  const teamAwaySoon = leavesBetween(leaves, todayISO, in14, team);

  // ---- responsibilities ----
  const seesTeamTc = can("timecard.insights") || can("timecard.editAll") || can("timecard.flag");
  const seesPortfolio = can("ph.view");
  const isAdmin = user.role === "Admin";
  const myPmProjects = projects.filter((p) => p.pm === user.name);
  const healthOf = (p) => phRowFor(p, { weeklyHealth: ctx.weeklyHealth || [], raid: ctx.raid || [], milestones: ctx.milestones || [], todayISO });
  const runwayOf = (p) => (can("runway.view") ? runwaySummary(computeRunway(p, empByName, assignments, leaves, leaveTypes, weekendDays, holidaySet, todayISO)) : null);

  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening";
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>{greeting}, {user.name.split(" ")[0]}</h2>
        <p className="text-sm text-slate-500">{fmt(todayISO)} · {user.role}{myAssign.length ? " · " + [...new Set(myAssign.map((a) => pname(a.projectId)))].join(", ") : ""}</p>
      </div>

      {/* ---- personal strip: everyone ---- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="My next leave" value={myNext ? fmtShort(myNext.start) : "None planned"} sub={myNext ? myNext.type + (myNext.start !== myNext.end ? " · until " + fmtShort(myNext.end) : "") : "Plan one in My Leave"} />
        <Stat label="Comp-off balance" value={mine.compOffBalance} sub={mine.compOffEarned + " earned · " + mine.compOffUsed + " used"} />
        <Stat label="My timecard" value={myTrail && myTrail.pct !== null ? myTrail.pct + "%" : "—"} sub={myTrail ? "proactive, last " + myTrail.trail.length + " weeks" : "not on the timecard grid"} />
        <Stat label="Next holiday" value={nextHol[0] ? fmtShort(nextHol[0]) : "—"} sub={nextHol.slice(1, 3).map(fmtShort).join(" · ") || "none scheduled"} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="My work" right={<Btn kind="ghost" small onClick={() => setNav("timecard")}>My timecard</Btn>}>
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-xs text-slate-500">Assigned to</div>
              {myAssign.length === 0 ? <span className="text-slate-400">Not allocated to a project today</span> : (
                <span className="mt-1 inline-flex flex-wrap gap-1">
                  {myAssign.map((a) => <Pill key={a.id} tone={STREAM_COLORS[a.stream] || "bg-slate-100 text-slate-600"}>{pname(a.projectId)}{a.phase ? " · " + a.phase : ""}{a.stream ? " · " + a.stream : ""}{a.to ? " · until " + fmtShort(a.to) : ""}</Pill>)}
                </span>
              )}
            </div>
            <div>
              <div className="text-xs text-slate-500">Timecard, last {myTrail ? myTrail.trail.length : 0} weeks (SF / JIRA)</div>
              {!myTrail ? <span className="text-slate-400">You're not on the timecard grid yet.</span> : (
                <div className="mt-1 flex flex-wrap gap-1">
                  {myTrail.trail.map((w) => (
                    <div key={w.week} className="text-center" title={"week ending " + fmt(w.week)}>
                      <div className="flex gap-0.5">
                        <span className={"h-3 w-3 rounded-sm " + (TC_COLORS[w.sf || ""] || "").split(" ")[0]} />
                        {w.jira !== null && <span className={"h-3 w-3 rounded-sm " + (TC_COLORS[w.jira || ""] || "").split(" ")[0]} />}
                      </div>
                      <div className="mt-0.5 text-[10px] text-slate-400">{fmtShort(w.week).split(" ")[0]}</div>
                    </div>
                  ))}
                </div>
              )}
              {myLastTc && (myLastTc[0] || myLastTc[1]) && (
                <div className="mt-1 text-xs text-slate-500">Last week: <Pill tone={TC_COLORS[myLastTc[0] || ""]}>SF {myLastTc[0] || "—"}</Pill> <Pill tone={TC_COLORS[myLastTc[1] || ""]}>JIRA {myLastTc[1] || "—"}</Pill></div>
              )}
            </div>
            <div>
              <div className="text-xs text-slate-500">My leave this year</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {leaveTypes.filter((lt) => mine.byType[lt.name]).map((lt) => <Pill key={lt.name} tone={leaveColor(lt.name, ctx.leaveTypes)}>{lt.name} {mine.byType[lt.name]}</Pill>)}
                {!leaveTypes.some((lt) => mine.byType[lt.name]) && <span className="text-slate-400">No leave taken</span>}
              </div>
            </div>
          </div>
        </Card>

        <Card title={team.size ? "My team — away in the next 2 weeks" : "Away this week"} right={<Btn kind="ghost" small onClick={() => setNav("calendar")}>Team calendar</Btn>}>
          {team.size ? (
            <>
              <p className="mb-2 text-xs text-slate-500">{team.size} {team.size === 1 ? "person" : "people"} on your project{myPmProjects.length + projectsOf(assignments, user.name, todayISO).length > 1 ? "s" : ""} · {teamAwayToday.length ? teamAwayToday.length + " away today" : "everyone in today"}</p>
              <LeaveList leaves={teamAwaySoon} todayISO={todayISO} leaveTypes={leaveTypes} empty="Nobody on your team has leave in the next two weeks." />
            </>
          ) : (
            <LeaveList leaves={leavesBetween(leaves, wkStart, wkEnd)} todayISO={todayISO} leaveTypes={leaveTypes} empty="No one is on leave this week." />
          )}
        </Card>
      </div>

      {/* ---- PM: the projects I run ---- */}
      {myPmProjects.length > 0 && (
        <Card title={"My projects (" + myPmProjects.length + ")"} right={seesPortfolio && <Btn kind="ghost" small onClick={() => setNav("programhealth")}>Program Health</Btn>}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3">Project</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Why</th>
                  <th className="py-2 pr-3 text-center">High risks</th><th className="py-2 pr-3 text-center">Overdue milestones</th>
                  {can("runway.view") && <th className="py-2 pr-3 text-right">Runway</th>}
                  <th className="py-2 pr-3">Last weekly entry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {myPmProjects.map((p) => {
                  const h = healthOf(p);
                  const rw = runwayOf(p);
                  const stale = !h.lw || h.lw.week < add(todayISO, -7);
                  return (
                    <tr key={p.id}>
                      <td className="py-2 pr-3 font-medium text-slate-800">{p.name}{p.currentPhase ? <span className="ml-1 text-xs text-slate-400">{p.currentPhase}</span> : null}</td>
                      <td className="py-2 pr-3"><Pill tone={PH_RAG_TONE[h.st.status]}>{h.st.status}</Pill></td>
                      <td className="py-2 pr-3 text-xs text-slate-500">{h.st.reasons.slice(0, 2).join("; ") || (h.st.fromPM ? "PM-submitted RAG" : "on track")}</td>
                      <td className={"py-2 pr-3 text-center " + (h.hr ? "font-semibold text-red-700" : "text-slate-300")}>{h.hr}</td>
                      <td className={"py-2 pr-3 text-center " + (h.overdue ? "font-semibold text-amber-700" : "text-slate-300")}>{h.overdue}</td>
                      {can("runway.view") && <td className="py-2 pr-3 text-right text-xs">{rw && rw.minWeeks !== null ? <Pill tone={PH_RAG_TONE[rw.rag] || "bg-slate-100 text-slate-600"}>{Math.round(rw.minWeeks * 10) / 10} wks</Pill> : <span className="text-slate-300">no funding</span>}</td>}
                      <td className={"py-2 pr-3 text-xs " + (stale ? "text-amber-700" : "text-slate-500")}>{h.lw ? "w/e " + fmtShort(h.lw.week) : "none yet"}{stale && can("ph.weekly") ? " · due" : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ---- Leads / PMs / anyone who manages timecards: my team's follow-ups ---- */}
      {seesTeamTc && tcWeeks.length > 0 && (() => {
        const scope = team.size && !isAdmin ? team : null; // Admins see everyone
        const lag = timecardLaggards(tcRows, lastWeekIdx, jiraFlags, scope);
        const flaggedRecent = tcRows
          .filter((r) => !scope || scope.has(r.name))
          .flatMap((r) => Object.entries(r.notes || {}).filter(([wi]) => Number(wi) >= tcWeeks.length - 4).map(([wi, n]) => ({ r, wi: Number(wi), n })))
          .sort((a, b) => b.wi - a.wi);
        return (
          <div className="grid gap-5 lg:grid-cols-2">
            <Card title={"Timecard follow-ups — w/e " + fmtShort(tcWeeks[lastWeekIdx]) + (scope ? " · my team" : "")} right={<Btn kind="ghost" small onClick={() => setNav("timecard")}>Timecard grid</Btn>}>
              {lag.length === 0 ? <p className="text-sm text-slate-500">Everyone{scope ? " on your team" : ""} was proactive last week.</p> : (
                <ul className="divide-y divide-slate-100">
                  {lag.slice(0, 8).map((x) => (
                    <li key={x.name} className="flex items-center justify-between py-1.5 text-sm">
                      <span className="font-medium text-slate-800">{x.name}</span>
                      <span className="flex gap-1">{x.bad.map(([k, v]) => <Pill key={k} tone={TC_COLORS[v]}>{k} {v}</Pill>)}</span>
                    </li>
                  ))}
                  {lag.length > 8 && <li className="py-1.5 text-xs text-slate-400">+ {lag.length - 8} more on the grid</li>}
                </ul>
              )}
            </Card>
            <Card title={"Flagged weeks — last 4 weeks" + (scope ? " · my team" : "")} right={can("timecard.insights") && <Btn kind="ghost" small onClick={() => setNav("tcsummary")}>All flagged</Btn>}>
              {flaggedRecent.length === 0 ? <p className="text-sm text-slate-500">Nothing flagged recently.</p> : (
                <ul className="divide-y divide-slate-100">
                  {flaggedRecent.slice(0, 6).map(({ r, wi, n }) => (
                    <li key={r.id + wi} className="py-1.5 text-sm">
                      <span className="text-amber-600">⚑</span> <span className="font-medium text-slate-800">{r.name}</span>
                      <span className="text-xs text-slate-400"> · w/e {fmtShort(tcWeeks[wi])}</span>
                      <div className="text-xs text-slate-600">{n.comment || "(no comment)"}</div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        );
      })()}

      {/* ---- portfolio view: Admins, Viewers and anyone with Program Health but no projects of their own ---- */}
      {seesPortfolio && (isAdmin || user.role === "Viewer" || (myPmProjects.length === 0 && !team.size)) && (() => {
        const rows = projects.map(healthOf);
        const byRag = { Red: 0, Amber: 0, Green: 0 };
        rows.forEach((r) => (byRag[r.st.status] = (byRag[r.st.status] || 0) + 1));
        const watch = rows.filter((r) => r.st.status !== "Green").sort((a, b) => (a.st.status === "Red" ? -1 : 1) - (b.st.status === "Red" ? -1 : 1));
        const lastPct = weekComplianceFlex(tcRows, lastWeekIdx, jiraFlags);
        const onToday = onLeaveOn(todayISO, leaves);
        return (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Open projects" value={projects.length} sub={byRag.Red + " red · " + byRag.Amber + " amber · " + byRag.Green + " green"} />
              <Stat label="Timecard proactive" value={lastPct === null ? "—" : lastPct + "%"} sub={"org-wide · w/e " + fmtShort(tcWeeks[lastWeekIdx] || todayISO)} />
              <Stat label="On leave today" value={onToday.length} sub={leavesBetween(leaves, wkStart, wkEnd).length + " leaves this week"} />
              <Stat label="Active people" value={ctx.employees.length} sub={assignments.filter((a) => a.from <= todayISO && todayISO <= (a.to || "9999-12-31")).map((a) => a.name).filter((n, i, xs) => xs.indexOf(n) === i).length + " allocated today"} />
            </div>
            <Card title="Projects needing attention" right={<Btn kind="ghost" small onClick={() => setNav("programhealth")}>Program Health</Btn>}>
              {watch.length === 0 ? <p className="text-sm text-slate-500">Every open project is green.</p> : (
                <ul className="divide-y divide-slate-100">
                  {watch.slice(0, 8).map((r) => (
                    <li key={r.p.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                      <span><span className="font-medium text-slate-800">{r.p.name}</span><span className="ml-2 text-xs text-slate-500">{r.p.pm || "no PM"} · {r.st.reasons.slice(0, 2).join("; ") || "PM-submitted RAG"}</span></span>
                      <Pill tone={PH_RAG_TONE[r.st.status]}>{r.st.status}</Pill>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        );
      })()}

      {/* ---- Admin: data hygiene ---- */}
      {isAdmin && (() => {
        const g = dataGaps(ctx.allEmployees || ctx.employees, allProjects);
        const items = [
          [g.noEmail, "active employee(s) without an email — they can't sign in", "employees"],
          [g.noRole, "active employee(s) without a role", "employees"],
          [g.noPm, "open project(s) without a PM", "projects"],
          [g.noDates, "open project(s) without start / end dates — no schedule tracking", "projects"],
        ].filter(([n]) => n > 0);
        return (
          <Card title="Data to tidy up">
            {items.length === 0 ? <p className="text-sm text-slate-500">Nothing missing — employee and project records are complete.</p> : (
              <ul className="space-y-1.5 text-sm">
                {items.map(([n, text, nav]) => (
                  <li key={text} className="flex items-center justify-between gap-3">
                    <span><span className="font-semibold text-amber-700">{n}</span> {text}</span>
                    <Btn kind="ghost" small onClick={() => setNav(nav)}>Fix</Btn>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })()}
    </div>
  );
}

function LeaveList({ leaves, todayISO, empty, leaveTypes }) {
  if (!leaves.length) return <p className="text-sm text-slate-500">{empty}</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {leaves.slice(0, 8).map((l) => (
        <li key={l.id} className="flex items-center justify-between py-1.5">
          <div>
            <div className="text-sm font-medium text-slate-800">{l.name}{l.start <= todayISO && todayISO <= l.end && <span className="ml-1 text-xs font-normal text-emerald-700">away today</span>}</div>
            <div className="text-xs text-slate-500">{fmtShort(l.start)}{l.start !== l.end ? " – " + fmtShort(l.end) : ""}{l.comment ? <span className="italic text-slate-600"> · {l.comment}</span> : null}</div>
          </div>
          <Pill tone={leaveColor(l.type, leaveTypes)}>{l.type}</Pill>
        </li>
      ))}
      {leaves.length > 8 && <li className="py-1.5 text-xs text-slate-400">+ {leaves.length - 8} more on the calendar</li>}
    </ul>
  );
}
