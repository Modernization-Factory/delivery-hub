import { useState } from "react";
import * as XLSX from "xlsx";
import { fmt, fmtShort, parseISO, toISO } from "../lib/dates.js";
import { TC_COLORS, TC_STATUSES, parseTimecardGrid, tcStatsFlex } from "../lib/timecard.js";
import { Btn, Card, Notice, Pill, inputCls } from "../ui/atoms.jsx";
import { BRAND_FONT } from "../ui/brand.jsx";
import { usePaged } from "../ui/usePaged.jsx";

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
  const [winStart, setWinStart] = useState(Math.max(0, tcWeeks.length - WIN));
  const maxStart = Math.max(0, tcWeeks.length - WIN);
  const start = Math.min(Math.max(0, winStart), maxStart);
  const visWeeks = tcWeeks.map((w, i) => ({ w, i })).slice(start, start + WIN);

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
    setImpMsg({ tone: "ok", text: "Week ending " + fmt(nextWeekISO) + " added — every resource gets blank SF/JIRA cells to fill through the week." });
  }
  const companies = ["All", ...Array.from(new Set(tcRows.map((r) => SEEDCO(r.name)))).sort()];
  function SEEDCO(name) {
    const e = ctx.empByName[name];
    return e ? e.company : "—";
  }
  const rows = isDev
    ? tcRows.filter((r) => r.name === user.name)
    : tcRows.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()) && (co === "All" || SEEDCO(r.name) === co));
  const { rows: gridRows, pager: gridPager } = usePaged(rows, 25);
  function setCell(rowId, weekIdx, slot, value) {
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
      {isDev && rows.length === 0 && (
        <Notice tone="warn">You're not on the timecard grid yet — your lead or PM will add you when SF / JIRA tracking starts for you.</Notice>
      )}
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Btn kind="ghost" small onClick={() => setWinStart(0)} disabled={start === 0}>« First</Btn>
          <Btn kind="ghost" small onClick={() => setWinStart(start - WIN)} disabled={start === 0}>← Earlier</Btn>
          <select className={inputCls + " w-48"} value={start} onChange={(e) => setWinStart(Math.min(Number(e.target.value), maxStart))}>
            {tcWeeks.map((w, i) => <option key={w} value={i}>week ending {fmtShort(w)}</option>)}
          </select>
          <Btn kind="ghost" small onClick={() => setWinStart(start + WIN)} disabled={start >= maxStart}>Later →</Btn>
          <Btn kind="ghost" small onClick={() => setWinStart(maxStart)} disabled={start >= maxStart}>Latest »</Btn>
          <span className="text-xs text-slate-500">showing weeks {start + 1}–{start + visWeeks.length} of {tcWeeks.length}</span>
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
                <th className="sticky left-0 z-20 border-b border-slate-200 bg-white px-2 py-1 text-left font-normal text-slate-400">week ending →</th>
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
                return (
                  <tr key={r.id} className="group">
                    <td className="sticky left-0 z-10 whitespace-nowrap border-b border-slate-100 bg-white px-2 py-1 font-medium text-slate-800 group-hover:bg-slate-50">
                      {r.name}
                      <span className="ml-1 text-xs text-slate-400">{r.release}</span>
                      {r.remarks && <span className="ml-1 cursor-help text-amber-500" title={r.remarks}>ⓘ</span>}
                    </td>
                    {visWeeks.map(({ i: wi }) => {
                      const w = r.weeks[wi] || ["", ""];
                      const jiraOn = !jiraFlags[r.id] || jiraFlags[r.id][wi] !== false;
                      return [0, 1].map((slot) => slot === 1 && !jiraOn ? (
                        <td key={r.id + wi + slot} className="border-b border-slate-100 p-0.5">
                          <div style={{ width: 86 }} title="JIRA not tracked for this resource's project this week — excluded from the proactiveness score" className="rounded bg-slate-50 px-1 py-1 text-center text-xs font-medium text-slate-300">n/t</div>
                        </td>
                      ) : (
                        <td key={r.id + wi + slot} className={"border-b border-slate-100 p-0.5 " + (slot === 0 ? "border-l" : "")}>
                          {canManage ? (
                            <select
                              value={w[slot] || ""}
                              onChange={(e) => setCell(r.id, wi, slot, e.target.value)}
                              style={{ width: 86 }}
                              className={"cursor-pointer appearance-none rounded px-1 py-1 text-center text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-400 " + TC_COLORS[w[slot] || ""]}
                            >
                              <option value="">—</option>
                              {TC_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                          ) : (
                            <div style={{ width: 86 }} className={"rounded px-1 py-1 text-center text-xs font-medium " + TC_COLORS[w[slot] || ""]}>{w[slot] || "—"}</div>
                          )}
                        </td>
                      ));
                    })}
                    <td className="border-b border-l border-slate-100 px-2 text-center">
                      {st.pct === null ? <span className="text-slate-300">—</span> : (
                        <Pill tone={st.pct >= 80 ? "bg-emerald-100 text-emerald-800" : st.pct >= 60 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}>{st.pct}%</Pill>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {gridPager}
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {TC_STATUSES.map((s) => <Pill key={s} tone={TC_COLORS[s]}>{s}</Pill>)}
          {canManage && <span className="self-center text-slate-400">Click any cell to update. "n/t" = JIRA not tracked for that project (configured per project in the Projects menu) — excluded from the score.</span>}
        </div>
      </Card>
    </div>
  );
}
