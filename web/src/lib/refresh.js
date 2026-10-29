// ---- Background refresh: re-pull the data a page shows so other people's changes appear
// without a browser reload. Pure planning here; ui/useBackgroundRefresh.jsx owns the timers.

// which datasets each page reads. "employees" first: names on leaves, timecards and
// assignments resolve through it, so it is refreshed before anything keyed by person.
export const PAGE_DATA = {
  dash: ["employees", "leaves", "comps", "timecards", "projects", "assignments", "weeklyHealth", "raid", "milestones"],
  myleave: ["leaves", "comps"],
  calendar: ["employees", "leaves"],
  allrecords: ["employees", "leaves"],
  compoff: ["employees", "comps", "leaves"],
  reports: ["employees", "leaves", "projects", "assignments"],
  timecard: ["employees", "timecards", "projects", "assignments"],
  tcsummary: ["employees", "timecards", "projects", "assignments"],
  alloc: ["employees", "assignments", "projects", "leaves"],
  projects: ["employees", "projects", "assignments", "raid", "milestones"],
  plans: ["plans", "projects"],
  programhealth: ["projects", "weeklyHealth", "raid", "milestones", "pipeline"],
  perf: ["employees", "scores", "timecards", "projects", "assignments"],
  runway: ["employees", "projects", "assignments", "leaves"],
  employees: ["employees", "assignments"],
  settings: ["settings"],
  admin: ["employees", "leaves", "comps", "timecards", "assignments", "scores"],
};

// Loaded once at sign-in, before any page shows: every page needs names, settings
// (leave types, holidays, weekends) and the permission matrix.
export const BOOT_DATA = ["employees", "settings"];

// Datasets `page` still needs before it can render: those it reads that haven't been
// fetched yet. Until this is empty the page shows a loading state instead of empty data.
export function datasetsMissing(page, lastFetched) {
  return (PAGE_DATA[page] || []).filter((k) => !lastFetched[k]);
}

export const REFRESH_EVERY_MS = 60 * 1000; // a page's data is re-pulled at most once a minute

// Datasets to refresh for `page` now: those it shows that weren't fetched in the last
// REFRESH_EVERY_MS and have no save in flight (a refresh landing mid-save would overwrite
// the user's unsaved edit with the server's older copy).
export function datasetsToRefresh(page, lastFetched, inFlight, now) {
  const want = PAGE_DATA[page] || [];
  return want.filter((k) => !(inFlight[k] > 0) && now - (lastFetched[k] || 0) >= REFRESH_EVERY_MS);
}

