import { OPEN_END } from "./constants.js";
import { TC_PROBLEM } from "./timecard.js";

// ---- Dashboard derivations: who is "my team", what needs my attention ----

// projects a person is assigned to on a date
export function projectsOf(assignments, name, iso) {
  return [...new Set(assignments.filter((a) => a.name === name && a.from <= iso && iso <= (a.to || OPEN_END)).map((a) => a.projectId))];
}

// "My team": everyone assigned on `iso` to any project I'm on, or that I PM.
// Excludes me. Returns a Set of names.
export function teamOf(assignments, projects, name, iso) {
  const mine = new Set([...projectsOf(assignments, name, iso), ...projects.filter((p) => p.pm === name).map((p) => p.id)]);
  return new Set(assignments.filter((a) => mine.has(a.projectId) && a.from <= iso && iso <= (a.to || OPEN_END) && a.name !== name).map((a) => a.name));
}

// leaves overlapping [fromISO, toISO], optionally restricted to a set of names, soonest first
export function leavesBetween(leaves, fromISO, toISO, names) {
  return leaves
    .filter((l) => l.start <= toISO && fromISO <= l.end && (!names || names.has(l.name)))
    .sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name));
}

// people whose last filled timecard week has a problem status (Chased, Beyond Monday,
// Not Updated, Partial Updated), optionally restricted to a set of names
export function timecardLaggards(tcRows, weekIdx, jiraFlags, names) {
  return tcRows
    .filter((r) => !names || names.has(r.name))
    .map((r) => {
      const [sf, jira] = r.weeks[weekIdx] || ["", ""];
      const jiraOn = !(jiraFlags && jiraFlags[r.id] && jiraFlags[r.id][weekIdx] === false);
      const bad = [["SF", sf], ["JIRA", jiraOn ? jira : ""]].filter(([, v]) => TC_PROBLEM.includes(v));
      return { name: r.name, bad };
    })
    .filter((x) => x.bad.length)
    .sort((a, b) => a.name.localeCompare(b.name));
}

// my own timecard trail: last n weeks of [week, sf, jira] plus proactive % over them
export function myTimecardTrail(row, weeks, n, jiraFlags) {
  if (!row) return null;
  const from = Math.max(0, weeks.length - n);
  const trail = weeks.slice(from).map((w, k) => {
    const i = from + k;
    const [sf, jira] = row.weeks[i] || ["", ""];
    const jiraOn = !(jiraFlags && jiraFlags[i] === false);
    return { week: w, sf, jira: jiraOn ? jira : null };
  });
  let pro = 0, filled = 0;
  trail.forEach((t) => [t.sf, t.jira].forEach((v) => { if (v && v !== "N/A") { filled++; if (v === "Proactive") pro++; } }));
  return { trail, pct: filled ? Math.round((pro / filled) * 100) : null };
}

// data-hygiene counts for Admins: things that quietly break other screens
export function dataGaps(employees, projects) {
  const active = employees.filter((e) => !e.inactive);
  return {
    noEmail: active.filter((e) => !e.email).length,
    noRole: active.filter((e) => !e.role).length,
    noPm: projects.filter((p) => !p.closedAt && !p.pm).length,
    noDates: projects.filter((p) => !p.closedAt && (!p.start || !p.end)).length,
  };
}
