import { isActiveDuring } from "./leave.js";

// ---- Performance report builders (pure, testable) ----
export const PARTNER_COS = ["WeKan", "Ciklum", "Globant"];

// ---- Performance scoring math (weights in %, must total 100) ----
export const METRICS = ["Delivery", "Quality", "Communication", "Tech Skill", "Timecard", "Collaboration"];

export function weightedScore(m, weights) {
  if (!m || m.length !== 6 || m.some((x) => x === null || x === undefined || x === "")) return null;
  const t = weights.reduce((s, w) => s + Number(w), 0) || 100;
  return m.reduce((s, x, i) => s + Number(x) * Number(weights[i]), 0) / t;
}

export function starsOf(score) {
  return score === null ? null : Math.round(score * 2) / 2;
}

export function ragOf(score, cfg) {
  return score === null ? null : score >= cfg.green ? "Green" : score >= cfg.amber ? "Amber" : "Red";
}

export function perfScorecard(employees, scores, week, cfg) {
  const pool = employees
    .filter((e) => isActiveDuring(e, week, week) && (cfg.partnerOnly ? PARTNER_COS.includes(e.company) : true))
    .sort((a, b) => a.name.localeCompare(b.name));
  const rows = pool.map((e) => {
    const s = scores.find((x) => x.name === e.name && x.week === week);
    const sc = s ? weightedScore(s.m, cfg.weights) : null;
    return { name: e.name, vendor: e.company, m: s ? s.m : [null, null, null, null, null, null], score: sc, stars: starsOf(sc), rag: ragOf(sc, cfg) };
  });
  const vendors = {};
  rows.forEach((r) => {
    const v = (vendors[r.vendor] = vendors[r.vendor] || { total: 0, scored: 0, sum: 0, Green: 0, Amber: 0, Red: 0 });
    v.total++;
    if (r.score !== null) { v.scored++; v.sum += r.score; v[r.rag]++; }
  });
  Object.values(vendors).forEach((v) => { v.avg = v.scored ? v.sum / v.scored : null; });
  return { rows, vendors };
}

export function perfVendorTrend(employees, scores, cfg) {
  const weeks = [...new Set(scores.map((s) => s.week))].sort();
  const coOf = Object.fromEntries(employees.map((e) => [e.name, e.company]));
  const grid = {}; // vendor -> { week -> {sum, n} }
  scores.forEach((s) => {
    const sc = weightedScore(s.m, cfg.weights);
    if (sc === null) return;
    const v = coOf[s.name] || "?";
    if (cfg.partnerOnly && !PARTNER_COS.includes(v)) return;
    const g = (grid[v] = grid[v] || {});
    const c = (g[s.week] = g[s.week] || { sum: 0, n: 0 });
    c.sum += sc; c.n++;
  });
  return { weeks, vendors: Object.fromEntries(Object.entries(grid).map(([v, g]) => [v, weeks.map((w) => (g[w] ? g[w].sum / g[w].n : null))])) };
}

export function perfResourceTrend(scores, name, cfg) {
  return scores
    .filter((s) => s.name === name)
    .sort((a, b) => a.week.localeCompare(b.week))
    .map((s) => ({ week: s.week, m: s.m, score: weightedScore(s.m, cfg.weights) }))
    .map((x) => ({ ...x, stars: starsOf(x.score), rag: ragOf(x.score, cfg) }));
}
