// ---- Team Plan engine ----
// A plan targets project+phase over a month window. Rows = stream/label + task +
// #resources per month. Projected effort = resources × per-month multiplier
// (default 20 working days; overridable per month — the source sheet used ×15 for a
// partial July). Estimated effort is user-supplied per row; variance = projected − estimated.
export function planMonths(startYm, count) {
  const [y, m] = startYm.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(y, m - 1 + i, 1);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  });
}

export function planCalc(plan) {
  const count = Number(plan.monthsCount) || 0;
  const ovr = plan.multOverrides || {};
  const multFor = (i) => (ovr[i] === null || ovr[i] === undefined || ovr[i] === "" ? (Number(plan.mult) || 20) : Number(ovr[i]));
  const rows = (plan.rows || []).map((r) => {
    const res = Array.from({ length: count }, (_, i) => Number(r.res[i]) || 0);
    const effort = res.reduce((s, x, i) => s + x * multFor(i), 0);
    const resTotal = res.reduce((s, x) => s + x, 0);
    const est = r.est === null || r.est === undefined || r.est === "" ? null : Number(r.est);
    return { id: r.id, effort, resTotal, est, variance: est === null ? null : Math.round((effort - est) * 10) / 10 };
  });
  const totalRes = Array.from({ length: count }, (_, i) => (plan.rows || []).reduce((s, r) => s + (Number(r.res[i]) || 0), 0));
  const projEffort = totalRes.map((x, i) => x * multFor(i));
  return {
    rows, totalRes, projEffort, multFor,
    grandRes: totalRes.reduce((s, x) => s + x, 0),
    grandEffort: projEffort.reduce((s, x) => s + x, 0),
    grandEst: rows.reduce((s, r) => s + (r.est || 0), 0),
  };
}
