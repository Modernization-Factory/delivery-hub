// timecard stats for one row: weeks = [[sf,jira],...]
export function tcStats(weeks) {
  const s = { Proactive: 0, Chased: 0, "Beyond Monday": 0, "Not Updated": 0, "Partial Updated": 0, "N/A": 0, blank: 0, filled: 0 };
  weeks.forEach(([sf, jira]) =>
    [sf, jira].forEach((v) => {
      if (!v) s.blank++;
      else {
        s[v] = (s[v] || 0) + 1;
        if (v !== "N/A") s.filled++;
      }
    })
  );
  s.pct = s.filled ? Math.round((s.Proactive / s.filled) * 100) : null;
  return s;
}

export function weekCompliance(rows, weekIdx) {
  let pro = 0, filled = 0;
  rows.forEach((r) =>
    r.weeks[weekIdx].forEach((v) => {
      if (v && v !== "N/A") {
        filled++;
        if (v === "Proactive") pro++;
      }
    })
  );
  return filled ? Math.round((pro / filled) * 100) : null;
}

// timecard stats where JIRA counts only when the week's flag is true (project-level setting)
export function tcStatsFlex(weeks, jiraFlags) {
  const s = { Proactive: 0, Chased: 0, "Beyond Monday": 0, "Not Updated": 0, "Partial Updated": 0, "N/A": 0, blank: 0, filled: 0 };
  weeks.forEach(([sf, jira], i) => {
    const cells = jiraFlags && jiraFlags[i] === false ? [sf] : [sf, jira];
    cells.forEach((v) => {
      if (!v) s.blank++;
      else {
        s[v] = (s[v] || 0) + 1;
        if (v !== "N/A") s.filled++;
      }
    });
  });
  s.pct = s.filled ? Math.round((s.Proactive / s.filled) * 100) : null;
  return s;
}

export function weekComplianceFlex(rows, weekIdx, flagsById) {
  let pro = 0, filled = 0;
  rows.forEach((r) => {
    const flags = flagsById && flagsById[r.id];
    const [sf, jira] = r.weeks[weekIdx] || ["", ""];
    const cells = flags && flags[weekIdx] === false ? [sf] : [sf, jira];
    cells.forEach((v) => {
      if (v && v !== "N/A") {
        filled++;
        if (v === "Proactive") pro++;
      }
    });
  });
  return filled ? Math.round((pro / filled) * 100) : null;
}

// statuses that mark a person-week as an outlier (the source sheet coloured the last two red)
export const TC_PROBLEM = ["Chased", "Beyond Monday", "Not Updated", "Partial Updated"];

// per-week tally like the source sheet's footer block: each status counted separately for
// SF and JIRA, Completed = filled cells (N/A included, as in the sheet), plus flagged person-weeks.
// JIRA cells on weeks a row's project doesn't track JIRA are left out.
export function weekOutliers(rows, weekIdx, flagsById) {
  const blank = () => Object.fromEntries([...TC_STATUSES.map((s) => [s, 0]), ["Completed", 0]]);
  const out = { sf: blank(), jira: blank(), flagged: 0, problemPeople: 0 };
  rows.forEach((r) => {
    const [sf, jira] = r.weeks[weekIdx] || ["", ""];
    const jiraOn = !(flagsById && flagsById[r.id] && flagsById[r.id][weekIdx] === false);
    [["sf", sf], ["jira", jiraOn ? jira : ""]].forEach(([k, v]) => {
      if (!v) return;
      out[k][v] = (out[k][v] || 0) + 1;
      out[k].Completed++;
    });
    if (TC_PROBLEM.includes(sf) || (jiraOn && TC_PROBLEM.includes(jira))) out.problemPeople++;
    if (r.notes && r.notes[weekIdx]) out.flagged++;
  });
  return out;
}

// timecard proactiveness % -> suggested performance metric (1-5)
export function tcSuggested(pct) {
  if (pct === null || pct === undefined) return null;
  return pct >= 90 ? 5 : pct >= 75 ? 4 : pct >= 60 ? 3 : pct >= 40 ? 2 : 1;
}

// name spelling variants seen across the source trackers -> canonical master names
export const NAME_ALIASES = {
  "Devashish Saksena": "Devashish Sakesna",
  "Amit Jain": "Amit Jain(L)",
  "Aniket Sambhaji Patil": "Aniket Sambhaji",
  "Chaitanya Kuthiyala": "Chaitanya Kuthiala",
  "Christopher Niklowoski*": "Christopher Niklowoski",
  "Gaurav Chittineni": "Chittineni Gaurav",
  "Lazar Dukic*": "Lazar Dukic",
};

// Excel cell (Date | serial number | string) -> "YYYY-MM-DD" | null
export function excelToISO(v) {
  if (v === null || v === undefined || v === "") return null;
  let ms;
  if (v instanceof Date) ms = v.getTime();
  else if (typeof v === "number") ms = Math.round((v - 25569) * 86400000);
  else {
    const s = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const t = Date.parse(s);
    if (isNaN(t)) return null;
    ms = t;
  }
  const d = new Date(ms + 12 * 3600 * 1000); // noon shift tolerates timezone skew either way
  const p = (n) => String(n).padStart(2, "0");
  return d.getUTCFullYear() + "-" + p(d.getUTCMonth() + 1) + "-" + p(d.getUTCDate());
}

// Parses the Timecard-Proactiveness sheet as array-of-arrays (header row 1: week dates
// from col F, merged over SF+JIRA pairs; row 2: SF/JIRA labels; data from row 3).
export function parseTimecardGrid(grid) {
  const header = grid[0] || [];
  const weeks = [];
  for (let c = 5; c < header.length; c += 2) {
    const iso = excelToISO(header[c]);
    if (!iso) break;
    weeks.push({ col: c, iso });
  }
  const canon = {};
  TC_STATUSES.forEach((s) => (canon[s.toLowerCase()] = s));
  let unknownStatuses = 0;
  let duplicates = 0;
  const seen = new Set();
  const rows = [];
  for (let r = 2; r < grid.length; r++) {
    const raw = grid[r] || [];
    if (raw[0] === null || raw[0] === undefined || String(raw[0]).trim() === "") continue;
    const name0 = String(raw[0]).trim();
    const name = NAME_ALIASES[name0] || name0;
    if (seen.has(name)) { duplicates++; continue; }
    seen.add(name);
    const norm = (v) => {
      if (v === null || v === undefined) return "";
      const t = String(v).trim();
      if (!t) return "";
      const c2 = canon[t.toLowerCase()];
      if (c2 === undefined) { unknownStatuses++; return ""; }
      return c2;
    };
    rows.push({
      name,
      company: raw[1] ? String(raw[1]).trim() : "",
      release: raw[2] ? String(raw[2]).trim() : "",
      role: raw[3] ? String(raw[3]).trim() : "",
      remarks: raw[4] ? String(raw[4]).trim() : "",
      weeks: weeks.map((w) => [norm(raw[w.col]), norm(raw[w.col + 1])]),
    });
  }
  return { weeks: weeks.map((w) => w.iso), rows, unknownStatuses, duplicates };
}

export const TC_STATUSES = ["Proactive", "Chased", "Beyond Monday", "N/A", "Not Updated", "Partial Updated"];

export const TC_COLORS = {
  Proactive: "bg-emerald-100 text-emerald-800",
  Chased: "bg-amber-100 text-amber-800",
  "Beyond Monday": "bg-orange-100 text-orange-800",
  "Not Updated": "bg-red-100 text-red-800",
  "Partial Updated": "bg-yellow-100 text-yellow-800",
  "N/A": "bg-slate-100 text-slate-500",
  "": "bg-white text-slate-300",
};
