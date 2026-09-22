import { parseISO } from "./dates.js";

// ---- Program Health derivations (store raw facts; compute here) ----
export function phElapsedPct(start, end, todayISO2) {
  if (!start || !end || end <= start) return null;
  return Math.round(((parseISO(todayISO2) - parseISO(start)) / (parseISO(end) - parseISO(start))) * 100) / 100;
}

export function phEffortVar(planned, burnt) {
  const p = Number(planned) || 0;
  if (!p) return null;
  return Math.round(((Number(burnt) || 0) / p - 1) * 1000) / 1000;
}

export function phBurnVsPlan(entries) {
  const P = entries.reduce((s, e) => s + (Number(e.hoursPlanned) || 0), 0);
  const B = entries.reduce((s, e) => s + (Number(e.hoursBurnt) || 0), 0);
  return P ? Math.round((B / P - 1) * 1000) / 1000 : null;
}

export function phScheduleVar(totalStories, doneStories, elapsedPct) {
  const t = Number(totalStories) || 0;
  if (!t || elapsedPct === null) return { completion: t ? 0 : null, variance: null };
  const completion = Math.round(((Number(doneStories) || 0) / t) * 100) / 100;
  return { completion, variance: Math.round((completion - elapsedPct) * 100) / 100 };
}

export function phHighRisks(raid, projectId) {
  return raid.filter((x) => x.projectId === projectId && x.status !== "Closed" && x.impact === "H").length;
}

export const PH_STAGES = ["Exploratory", "POC", "Proposal", "MFW", "SOW Signed", "Closed"];

// Overall project status for the dashboard tile. The PM-submitted RAG of the latest
// weekly entry wins when present; otherwise it is derived from the same signals the
// portfolio table already shows. `reasons` explains the colour on the tile.
export const PH_RAG_TONE = { Green: "bg-emerald-100 text-emerald-800", Amber: "bg-amber-100 text-amber-800", Red: "bg-red-100 text-red-800" };

export const PH_RAG_ACCENT = { Green: "#00ED64", Amber: "#F59E0B", Red: "#DC2626" };

export const phPct = (x) => (x === null || x === undefined ? "—" : Math.round(x * 100) + "%");

export function phOverallStatus({ latestRag, burnVsPlan, scheduleVar, elapsedPct, highRisks, overdueMilestones }) {
  const reasons = [];
  let score = 0; // 0 green · 1 amber · 2 red
  const bump = (lvl, why) => { if (lvl > score) score = lvl; reasons.push(why); };
  if (burnVsPlan !== null && burnVsPlan > 0.1) bump(2, "burn " + Math.round(burnVsPlan * 100) + "% over plan");
  else if (burnVsPlan !== null && burnVsPlan > 0.02) bump(1, "burn slightly over plan");
  if (scheduleVar !== null && scheduleVar < -0.15) bump(2, "schedule " + Math.round(Math.abs(scheduleVar) * 100) + "% behind");
  else if (scheduleVar !== null && scheduleVar < -0.05) bump(1, "slipping against elapsed time");
  if (elapsedPct !== null && elapsedPct > 1) bump(2, "past target end date");
  if (highRisks >= 3) bump(2, highRisks + " high-impact risks open");
  else if (highRisks > 0) bump(1, highRisks + " high-impact risk" + (highRisks > 1 ? "s" : "") + " open");
  if (overdueMilestones > 0) bump(1, overdueMilestones + " milestone" + (overdueMilestones > 1 ? "s" : "") + " overdue");
  const derived = ["Green", "Amber", "Red"][score];
  const status = latestRag || derived;
  return { status, derived, reasons, fromPM: !!latestRag };
}
