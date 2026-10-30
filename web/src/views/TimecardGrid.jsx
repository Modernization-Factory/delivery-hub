import { useState } from "react";
import * as XLSX from "xlsx";
import { fmt, fmtShort, parseISO, toISO } from "../lib/dates.js";
import { TC_COLORS, TC_PROBLEM, TC_STATUSES, parseTimecardGrid, tcStatsFlex, weekOutliers } from "../lib/timecard.js";
import { Btn, Card, Field, Notice, Pill, inputCls } from "../ui/atoms.jsx";
import { BRAND_FONT } from "../ui/brand.jsx";
import { usePaged } from "../ui/usePaged.jsx";
import { FlaggedResources } from "../ui/FlaggedResources.jsx";
import { WeekLeavePanel } from "../ui/LeaveEditor.jsx";
import { onLeaveWholeWeek, tcWeekDays } from "../lib/leave.js";
import { canDeletePastLeave } from "../lib/permissions.js";

// ============================================================
// TIMECARD GRID
// ============================================================
export function TimecardGrid(ctx) {
  const { tcRows, setTcRows, tcWeeks, setTcWeeks, employees, setEmployees, empByName, user, isDev, todayISO, jiraFlags } = ctx;
  const canManage = ctx.can("timecard.editAll"); // edit cells · import · add weeks
  const [q, setQ] = useState("");
  const [co, setCo] = useState("All");
  const [pending, setPending] = useState(null); // parsed upload awaiting confirmation
  const [impMsg, setImpMsg] = useState(null);
  const WIN = 8; // weeks visible at once
  // newest week is the leftmost column: `offset` = how many weeks back from the newest the window starts
  const [offset0, setOffset] = useState(0);
  const maxOffset = Math.max(0, tcWeeks.length - WIN);
  const offset = Math.min(Math.max(0, offset0), maxOffset);
  const visWeeks = tcWeeks.map((w, i) => ({ w, i })).reverse().slice(offset, offset + WIN);
  const setWinStart = () => setOffset(0); // after an import / new week, jump to the newest
  const [tab, setTab] = useState("grid"); // grid | flagged | outliers
  const [activeRow, setActiveRow] = useState(null); // row being worked on — highlighted
  const [weekLeave, setWeekLeave] = useState(null); // { name, wi } — leave panel for one person-week
  const [statusF, setStatusF] = useState(""); // show only people with this status in the visible weeks
  const [flaggedOnly, setFlaggedOnly] = useState(false);

  async function handleFile(e) {
    const file = e.target.files[0];
    e.target.value = "";
    setImpMsg(null);
    setPending(null);
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { cellDates: true });
      const wsName =
        wb.SheetNames.find((n) => n.toLowerCase().includes("proactive")) ||
        wb.SheetNames.find((n) => n.toLowerCase().includes("timecard")) ||
        wb.SheetNames[0];
      const grid = XLSX.utils.sheet_to_json(wb.Sheets[wsName], { header: 1, raw: true, defval: null });
      const parsed = parseTimecardGrid(grid);
      if (parsed.weeks.length === 0 || parsed.rows.length === 0) {
        return setImpMsg({ tone: "error", text: "Couldn't read the sheet \"" + wsName + "\" — expected week dates in row 1 from column F (SF/JIRA pairs) and resources from row 3, like the Resource Allocation template." });
      }
      const knownRoles = ["Developer", "Senior Developer", "Lead Developer", "Project Manager"];
      const knownCos = ["MDB", "WeKan", "Ciklum", "Globant"];
      const newPeople = parsed.rows
        .filter((r) => !empByName[r.name])
        .map((r) => ({
          name: r.name,
          role: knownRoles.find((k) => k.toLowerCase() === r.role.toLowerCase()) || "Developer",
          company: knownCos.find((k) => k.toLowerCase() === r.company.toLowerCase()) || (r.company || "MDB"),
          start: todayISO,
          term: null,
        }));
      setPending({ ...parsed, sheet: wsName, fileName: file.name, newPeople, file });
    } catch (err) {
      setImpMsg({ tone: "error", text: "That file couldn't be opened as an Excel workbook (" + (err && err.message ? err.message : "unknown error") + ")." });
    }
  }
  async function applyImport() {
    if (!pending) return;
    if (ctx.uploadTimecardFile && pending.file) {
      if (pending.newPeople.length) setEmployees([...employees, ...pending.newPeople.map((p, i) => ({ ...p, id: "eimp" + Date.now() + "_" + i }))]);
      try {
        const r = await ctx.uploadTimecardFile(pending.file);
        setWinStart(Number.MAX_SAFE_INTEGER);
        setImpMsg({ tone: "ok", text: "Imported on the server: " + r.resources + " resources × " + r.weeks + " weeks (" + r.upserts + " cells)" + (r.unknownNames.length ? ". Unmatched names skipped: " + r.unknownNames.join(", ") : ".") });
      } catch (e) {
        setImpMsg({ tone: "error", text: "Server import failed: " + e.message });
      }
      setPending(null);
      return;
    }
    const stamp = Date.now();
    if (pending.newPeople.length) {
      setEmployees([...employees, ...pending.newPeople.map((p, i) => ({ ...p, id: "eimp" + stamp + "_" + i }))]);
    }
    setTcWeeks(pending.weeks);
    setTcRows(pending.rows.map((r, i) => ({ id: "timp" + stamp + "_" + i, name: r.name, release: r.release, remarks: r.remarks, weeks: r.weeks })));
    setWinStart(Number.MAX_SAFE_INTEGER); // clamps to the latest window
    setImpMsg({
      tone: "ok",
      text: "Imported " + pending.rows.length + " resources × " + pending.weeks.length + " weeks from " + pending.fileName +
        (pending.newPeople.length ? ". Added " + pending.newPeople.length + " new " + (pending.newPeople.length > 1 ? "people" : "person") + " to the employee master." : "."),
    });
    setPending(null);
  }
  const nextWeekISO = (() => {
    if (!tcWeeks.length) { const t = parseISO(todayISO); return toISO(new Date(t.getFullYear(), t.getMonth(), t.getDate() + ((7 - t.getDay()) % 7 || 7))); }
    const d = parseISO(tcWeeks[tcWeeks.length - 1]);
    return toISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7));
  })();
  function addWeek() {
    setTcWeeks([...tcWeeks, nextWeekISO]);
    setTcRows(tcRows.map((r) => ({ ...r, weeks: [...r.weeks, ["", ""]] })));
    setWinStart(Number.MAX_SAFE_INTEGER);
    setImpMsg({ tone: "ok", text: "Week of " + fmt(nextWeekISO) + " added — every resource gets blank SF/JIRA cells; anyone on leave the whole week gets N/A automatically." });
  }
  const companies = ["All", ...Array.from(new Set(tcRows.map((r) => SEEDCO(r.name)))).sort()];
  function SEEDCO(name) {
    const e = ctx.empByName[name];
    return e ? e.company : "—";
  }
  const visIdx = visWeeks.map((v) => v.i);
  const hasStatus = (r) => !statusF || visIdx.some((i) => (r.weeks[i] || []).includes(statusF));
  const hasFlag = (r) => !flaggedOnly || visIdx.some((i) => (r.notes || {})[i]);
  const rows = isDev
    ? tcRows.filter((r) => r.name === user.name)
    : tcRows.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()) && (co === "All" || SEEDCO(r.name) === co) && hasStatus(r) && hasFlag(r));
  // leave per person-week (dated Sunday, covers the Mon-Fri after) for the grid's leave markers
  const weekSpan = (w) => { const d = tcWeekDays(w, ctx.weekendDays, ctx.holidaySet); return [d[0] || w, d[d.length - 1] || w]; };
  const leaveIn = (name, w) => { const [a, b] = weekSpan(w); return ctx.leaves.filter((l) => l.name === name && l.start <= b && a <= l.end); };
  const { rows: gridRows, pager: gridPager } = usePaged(rows, 25);
  const canFlag = ctx.can("timecard.flag") && !!ctx.setTcFlag;
  // leave markers and add / edit leave from the grid: PM and Admin only
  const leaveOnGrid = canDeletePastLeave(user.role);
  const [flagEdit, setFlagEdit] = useState(null); // { rowId, name, weekIdx, comment, existing }
  const [flagBusy, setFlagBusy] = useState(false);
  function openFlag(r, wi) {
    setActiveRow(r.id); setWeekLeave(null);
    const n = (r.notes || {})[wi];
    setFlagEdit({ rowId: r.id, name: r.name, weekIdx: wi, comment: n ? n.comment : "", existing: !!n });
  }
  async function saveFlag(flagged) {
    setFlagBusy(true);
    try {
      await ctx.setTcFlag(flagEdit.rowId, flagEdit.weekIdx, flagged ? { comment: flagEdit.comment.trim() } : null);
      setImpMsg({ tone: "ok", text: (flagged ? "Flagged " : "Removed the flag on ") + flagEdit.name + " · week of " + fmtShort(tcWeeks[flagEdit.weekIdx]) + "." });
      setFlagEdit(null);
    } catch (e) {
      setImpMsg({ tone: "error", text: "Couldn't save the flag: " + e.message });
    } finally { setFlagBusy(false); }
  }
  async function deleteFlag(r, wi) {
    if (!window.confirm("Remove the outlier flag on " + r.name + " · week of " + fmtShort(tcWeeks[wi]) + "?")) return;
    try { await ctx.setTcFlag(r.id, wi, null); setImpMsg({ tone: "ok", text: "Removed the flag on " + r.name + " · week of " + fmtShort(tcWeeks[wi]) + "." }); }
    catch (e) { setImpMsg({ tone: "error", text: "Couldn't remove the flag: " + e.message }); }
  }
  function setCell(rowId, weekIdx, slot, value) {
    setActiveRow(rowId);
    setTcRows(tcRows.map((r) => {
      if (r.id !== rowId) return r;
      const weeks = r.weeks.map((w, i) => (i === weekIdx ? [slot === 0 ? value : w[0], slot === 1 ? value : w[1]] : w));
      return { ...r, weeks };
    }));
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>{isDev ? "My Timecard Proactiveness" : "Timecard Proactiveness Grid"}</h2>
        {!isDev && (
          <div className="flex flex-wrap gap-2">
            <input className={inputCls + " w-48"} placeholder="Search name…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className={inputCls + " w-32"} value={co} onChange={(e) => setCo(e.target.value)}>
              {companies.map((c) => <option key={c}>{c}</option>)}
            </select>
            {canManage && <Btn kind="ghost" small onClick={addWeek}>+ Add week ({fmtShort(nextWeekISO)})</Btn>}
            {canManage && (
              <label className="cursor-pointer rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                Import weekly file
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
              </label>
            )}
          </div>
        )}
      </div>
      {impMsg && <Notice tone={impMsg.tone === "error" ? "error" : "ok"}>{impMsg.text}</Notice>}
      {pending && (
        <Card title={"Review import — " + pending.fileName}>
          <ul className="space-y-1 text-sm text-slate-700">
            <li><span className="font-medium">{pending.weeks.length} weeks</span> found on sheet "{pending.sheet}" — {fmtShort(pending.weeks[0])} to {fmtShort(pending.weeks[pending.weeks.length - 1])}.</li>
            <li><span className="font-medium">{pending.rows.length} resources</span>, {pending.rows.length - pending.newPeople.length} already in the employee master.</li>
            {pending.newPeople.length > 0 && (
              <li className="text-amber-700">{pending.newPeople.length} new: {pending.newPeople.map((p) => p.name).join(", ")} — will be added to the employee master on import.</li>
            )}
            {pending.duplicates > 0 && <li className="text-amber-700">{pending.duplicates} duplicate name row(s) in the file — first occurrence kept.</li>}
            {pending.unknownStatuses > 0 && <li className="text-amber-700">{pending.unknownStatuses} cell(s) had unrecognised status values and will import as blank. Valid: {TC_STATUSES.join(", ")}.</li>}
            <li className="text-slate-500">Importing replaces the whole grid with the file contents — the file is the source of truth, so week-on-week you just re-upload the same workbook.</li>
          </ul>
          <div className="mt-3 flex gap-2">
            <Btn onClick={applyImport}>Import & replace grid</Btn>
            <Btn kind="ghost" onClick={() => setPending(null)}>Cancel</Btn>
          </div>
        </Card>
      )}
      {!isDev && (
        <div className="flex overflow-hidden rounded-lg border border-slate-300 bg-white" style={{ width: "fit-content" }}>
          {[["grid", "Grid"], ["flagged", "Flagged (" + tcRows.reduce((n, r) => n + Object.keys(r.notes || {}).length, 0) + ")"], ["outliers", "Outliers by week"]].map(([v, lab]) => (
            <button key={v} onClick={() => setTab(v)}
              className={"px-4 py-2 text-sm font-medium transition " + (tab === v ? "mdb-btn-primary text-white" : "bg-white text-slate-600 hover:bg-slate-50")}>{lab}</button>
          ))}
        </div>
      )}
      {!isDev && tab === "outliers" && <OutlierPanel rows={tcRows} weeks={tcWeeks} jiraFlags={jiraFlags} />}
      {!isDev && tab === "flagged" && (
        <>
          {flagEdit && <FlagEditor flagEdit={flagEdit} setFlagEdit={setFlagEdit} busy={flagBusy} onSave={saveFlag} weekLabel={fmtShort(tcWeeks[flagEdit.weekIdx])} />}
          <FlaggedResources tcRows={tcRows} tcWeeks={tcWeeks} empByName={empByName} asTable onEdit={canFlag ? openFlag : null} onDelete={canFlag ? deleteFlag : null} />
        </>
      )}
      {isDev && rows.length === 0 && (
        <Notice tone="warn">You're not on the timecard grid yet — your lead or PM will add you when SF / JIRA tracking starts for you.</Notice>
      )}
      {(isDev || tab === "grid") && <Card>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Btn kind="ghost" small onClick={() => setOffset(0)} disabled={offset === 0}>« Newest</Btn>
          <Btn kind="ghost" small onClick={() => setOffset(offset - WIN)} disabled={offset === 0}>← Newer</Btn>
          <select className={inputCls + " w-44"} value={offset} onChange={(e) => setOffset(Number(e.target.value))}>
            {tcWeeks.map((w, i) => ({ w, off: tcWeeks.length - 1 - i })).reverse().map(({ w, off }) => <option key={w} value={Math.min(off, maxOffset)}>from week of {fmtShort(w)}</option>)}
          </select>
          <Btn kind="ghost" small onClick={() => setOffset(offset + WIN)} disabled={offset >= maxOffset}>Older →</Btn>
          <span className="text-xs text-slate-500">{visWeeks.length} of {tcWeeks.length} weeks · newest first</span>
          {!isDev && (
            <span className="ml-auto flex flex-wrap items-center gap-2">
              <select className={inputCls + " w-44"} value={statusF} onChange={(e) => setStatusF(e.target.value)} title="Show people with this status in the weeks shown">
                <option value="">Any status</option>
                {TC_STATUSES.map((st) => <option key={st} value={st}>Has {st}</option>)}
              </select>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
                <input type="checkbox" className="h-4 w-4 accent-amber-600" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} />⚑ flagged only
              </label>
              {(statusF || flaggedOnly) && <Btn small kind="ghost" onClick={() => { setStatusF(""); setFlaggedOnly(false); }}>Clear</Btn>}
            </span>
          )}
        </div>
        <div className="max-h-[70vh] overflow-auto">
          <table className="min-w-full border-separate text-xs" style={{ borderSpacing: 0 }}>
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="sticky left-0 z-20 border-b border-slate-200 bg-white px-2 py-2 text-left font-semibold text-slate-600">Resource</th>
                {visWeeks.map(({ w }) => (
                  <th key={w} colSpan={2} className="border-b border-l border-slate-200 bg-white px-1 py-1 text-center font-semibold text-slate-600">{fmtShort(w)}</th>
                ))}
                <th className="border-b border-l border-slate-200 bg-white px-2 py-2 font-semibold text-slate-600">Proactive %</th>
              </tr>
              <tr>
                <th className="sticky left-0 z-20 border-b border-slate-200 bg-white px-2 py-1 text-left font-normal text-slate-400">week of →</th>
                {visWeeks.map(({ w }) => [
                  <th key={w + "sf"} className="border-b border-l border-slate-200 bg-slate-50 px-1 py-1 font-medium text-slate-500">SF</th>,
                  <th key={w + "j"} className="border-b border-slate-200 bg-slate-50 px-1 py-1 font-medium text-slate-500">JIRA</th>,
                ])}
                <th className="border-b border-l border-slate-200 bg-white" />
              </tr>
            </thead>
            <tbody>
              {gridRows.map((r) => {
                const st = tcStatsFlex(r.weeks, jiraFlags[r.id]);
                const active = activeRow === r.id;
                const panelOpen = (weekLeave && weekLeave.rowId === r.id) || (flagEdit && flagEdit.rowId === r.id && tab === "grid");
                return [
                  <tr key={r.id} className={"group " + (active ? "bg-emerald-50" : "")} onClick={() => setActiveRow(r.id)}>
                    <td className={"sticky left-0 z-10 whitespace-nowrap border-b border-slate-100 px-2 py-1 font-medium text-slate-800 " + (active ? "bg-emerald-100 shadow-[inset_3px_0_0_#059669]" : "bg-white group-hover:bg-slate-50")}>
                      {r.name}
                      <span className="ml-1 text-xs text-slate-400">{r.release}</span>
                      {r.remarks && <span className="ml-1 cursor-help text-amber-500" title={r.remarks}>ⓘ</span>}
                    </td>
                    {visWeeks.map(({ i: wi }) => {
                      const w = r.weeks[wi] || ["", ""];
                      const jiraOn = !jiraFlags[r.id] || jiraFlags[r.id][wi] !== false;
                      const note = !isDev && (r.notes || {})[wi];
                      // a flagged person-week is outlined in amber across its SF + JIRA cells
                      const hl = note ? (slot) => " bg-amber-50 border-y-2 border-amber-400" + (slot === 0 ? " border-l-2" : " border-r-2") : () => "";
                      const lv = leaveIn(r.name, tcWeeks[wi]);
                      // bold 🌴 = away the whole week (what sets N/A); faint = some days off
                      const fullWeek = lv.length > 0 && onLeaveWholeWeek(r.name, tcWeeks[wi], ctx.leaves, ctx.leaveTypes, ctx.weekendDays, ctx.holidaySet);
                      const auto = (r.autoNA || {})[wi] || [];
                      // 🌴 opens the person-week leave panel: always when there is leave; on hover for
                      // empty weeks when this user may add leave for that person (PM / Lead, or themselves)
                      const canAddFor = leaveOnGrid;
                      const openLeave = (e) => { e.stopPropagation(); setActiveRow(r.id); setFlagEdit(null); setWeekLeave(weekLeave && weekLeave.rowId === r.id && weekLeave.wi === wi ? null : { rowId: r.id, name: r.name, wi }); };
                      const leaveBtn = !leaveOnGrid ? null : lv.length > 0 ? (
                        <button type="button" onClick={openLeave}
                          title={lv.map((l) => l.type + " " + fmtShort(l.start) + (l.start !== l.end ? "–" + fmtShort(l.end) : "") + (l.comment ? " · " + l.comment : "")).join("\n") + "\nClick to view / edit"}
                          className={"ml-0.5 align-middle text-xs " + (fullWeek ? "" : "opacity-40 hover:opacity-100")}>🌴</button>
                      ) : canAddFor && (
                        <button type="button" onClick={openLeave} title={"Add leave for " + r.name + " this week"}
                          className="ml-0.5 align-middle text-[10px] text-slate-400 opacity-0 hover:text-emerald-700 group-hover:opacity-100">+🌴</button>
                      );
                      const flagBtn = (canFlag || note) && (
                        <button type="button" disabled={!canFlag} onClick={(e) => { e.stopPropagation(); openFlag(r, wi); }}
                          title={note ? "Outlier: " + (note.comment || "(no comment)") + " — " + note.by + (canFlag ? " · click to edit" : "") : "Flag this week as an outlier"}
                          className={"ml-0.5 align-middle text-xs " + (note ? "text-amber-600" : "text-slate-300 opacity-0 group-hover:opacity-100 hover:text-amber-600")}>⚑</button>
                      );
                      return [0, 1].map((slot) => slot === 1 && !jiraOn ? (
                        <td key={r.id + wi + slot} className={"border-b border-slate-100 p-0.5" + hl(slot)}>
                          <div style={{ width: 86 }} title="JIRA not tracked for this resource's project this week — excluded from the proactiveness score" className="rounded bg-slate-50 px-1 py-1 text-center text-xs font-medium text-slate-300">n/t</div>
                        </td>
                      ) : (
                        <td key={r.id + wi + slot} className={"whitespace-nowrap border-b border-slate-100 p-0.5 " + (slot === 0 ? "border-l" : "") + hl(slot)}>
                          {canManage ? (
                            <select
                              value={w[slot] || ""}
                              onChange={(e) => setCell(r.id, wi, slot, e.target.value)}
                              style={{ width: 86 }}
                              className={"inline-block cursor-pointer appearance-none rounded px-1 py-1 text-center text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-400 " + TC_COLORS[w[slot] || ""]}
                            >
                              <option value="">—</option>
                              {TC_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                          ) : (
                            <div style={{ width: 86 }} className={"inline-block rounded px-1 py-1 text-center text-xs font-medium " + TC_COLORS[w[slot] || ""]}>{w[slot] || "—"}</div>
                          )}
                          {auto.includes(slot === 0 ? "sf" : "jira") && <span title="Set to N/A automatically — on leave the whole week" className="ml-0.5 align-middle text-[10px] text-slate-400">auto</span>}
                          {slot === 0 && flagBtn}
                          {slot === 1 && leaveBtn}
                        </td>
                      ));
                    })}
                    <td className="border-b border-l border-slate-100 px-2 text-center">
                      {st.pct === null ? <span className="text-slate-300">—</span> : (
                        <Pill tone={st.pct >= 80 ? "bg-emerald-100 text-emerald-800" : st.pct >= 60 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}>{st.pct}%</Pill>
                      )}
                    </td>
                  </tr>,
                  panelOpen && (
                    <tr key={r.id + "_panel"}>
                      <td colSpan={visWeeks.length * 2 + 2} className="border-b border-emerald-200 bg-emerald-50/50 px-3 py-3">
                        <div className="sticky left-3" style={{ maxWidth: 900 }}>
                          {weekLeave && weekLeave.rowId === r.id
                            ? <WeekLeavePanel name={r.name} weekISO={tcWeeks[weekLeave.wi]} ctx={ctx} onClose={() => setWeekLeave(null)} />
                            : <FlagEditor flagEdit={flagEdit} setFlagEdit={setFlagEdit} busy={flagBusy} onSave={saveFlag} weekLabel={fmtShort(tcWeeks[flagEdit.weekIdx])} inline />}
                        </div>
                      </td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
          </table>
        </div>
        {gridPager}
        {rows.length === 0 && (statusF || flaggedOnly) && <p className="mt-2 text-sm text-slate-500">Nobody matches these filters in the weeks shown.</p>}
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {TC_STATUSES.map((s) => <Pill key={s} tone={TC_COLORS[s]}>{s}</Pill>)}
          <span className="self-center text-slate-400">{leaveOnGrid ? "🌴 = leave that week (bold = the whole week; click to view / edit) · hover a week and click +🌴 to add leave · " : ""}"auto" = N/A set because of a full week of leave{canManage ? " · click a cell to update" : ""}{canFlag ? " · ⚑ flags a week as an outlier" : ""} · "n/t" = JIRA not tracked for that project. Weeks are dated by their Sunday and cover the Mon–Fri after it.</span>
        </div>
      </Card>}
    </div>
  );
}

// Outliers by week — the source sheet's footer tally (status counts per week, SF and JIRA
// separately, Completed), with problem statuses highlighted, plus flagged person-weeks.
function OutlierPanel({ rows, weeks, jiraFlags }) {
  const [n, setN] = useState(8); // most recent weeks shown
  const recent = weeks.map((w, i) => ({ w, i })).slice(-n).reverse();
  const tallies = recent.map(({ w, i }) => ({ w, i, t: weekOutliers(rows, i, jiraFlags) }));
  const cols = [...TC_STATUSES.filter((s) => s !== "N/A"), "N/A", "Completed"];
  const pair = (t, s) => (
    <span className="tabular-nums">{t.sf[s]}<span className="text-slate-300"> / </span>{t.jira[s]}</span>
  );
  return (
    <Card title="Outliers by week" right={
      <select className={inputCls + " w-36"} value={n} onChange={(e) => setN(Number(e.target.value))}>
        {[4, 8, 12, weeks.length].filter((x, k, a) => x <= weeks.length && a.indexOf(x) === k).map((x) => <option key={x} value={x}>{x === weeks.length ? "All weeks" : "Last " + x + " weeks"}</option>)}
      </select>
    }>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-left uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-3">Week of</th>
              {cols.map((s) => <th key={s} className={"py-2 pr-3 text-center " + (TC_PROBLEM.includes(s) ? "text-red-600" : "")}>{s}</th>)}
              <th className="py-2 pr-3 text-center">People with an issue</th>
              <th className="py-2 pr-3 text-center text-amber-600">⚑ Flagged</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tallies.map(({ w, t }) => (
              <tr key={w}>
                <td className="py-1.5 pr-3 font-medium text-slate-700">{fmtShort(w)}</td>
                {cols.map((s) => {
                  const bad = TC_PROBLEM.includes(s) && t.sf[s] + t.jira[s] > 0;
                  return <td key={s} className={"py-1.5 pr-3 text-center " + (bad ? "bg-red-50 font-semibold text-red-700" : "text-slate-600")}>{pair(t, s)}</td>;
                })}
                <td className={"py-1.5 pr-3 text-center " + (t.problemPeople ? "font-semibold text-red-700" : "text-slate-400")}>{t.problemPeople}</td>
                <td className={"py-1.5 pr-3 text-center " + (t.flagged ? "font-semibold text-amber-700" : "text-slate-400")}>{t.flagged}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-xs text-slate-400">Counts are SF / JIRA. Red columns are problem statuses; "People with an issue" counts anyone with at least one of them that week. Completed = filled cells. JIRA cells are skipped on weeks the project doesn't track JIRA.</p>
    </Card>
  );
}

// Outlier flag editor — inline under the grid row, or above the Flagged table
function FlagEditor({ flagEdit, setFlagEdit, busy, onSave, weekLabel, inline }) {
  const body = (
    <>
      <div className="mb-1 text-sm font-semibold text-slate-800">⚑ Outlier — {flagEdit.name} · week of {weekLabel}</div>
      <textarea className={inputCls + " h-16"} maxLength={500} value={flagEdit.comment} autoFocus
        onChange={(e) => setFlagEdit({ ...flagEdit, comment: e.target.value })} placeholder="Why is this week an outlier? e.g. chased twice for SF; JIRA updated Tuesday" />
      <div className="mt-2 flex gap-2">
        <Btn small disabled={busy} onClick={() => onSave(true)}>{flagEdit.existing ? "Save comment" : "Flag as outlier"}</Btn>
        {flagEdit.existing && <Btn small kind="danger" disabled={busy} onClick={() => onSave(false)}>Remove flag</Btn>}
        <Btn small kind="ghost" disabled={busy} onClick={() => setFlagEdit(null)}>Cancel</Btn>
      </div>
    </>
  );
  return inline ? body : <Card>{body}</Card>;
}
