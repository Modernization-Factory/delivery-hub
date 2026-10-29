import test from "node:test";
import assert from "node:assert/strict";
import { PAGE_DATA, REFRESH_EVERY_MS, datasetsMissing, datasetsToRefresh } from "../src/lib/refresh.js";

test("datasetsToRefresh returns a page's stale datasets, employees first", () => {
  const now = 10 * REFRESH_EVERY_MS;
  assert.deepEqual(datasetsToRefresh("calendar", {}, {}, now), ["employees", "leaves"]);
  assert.deepEqual(datasetsToRefresh("calendar", { employees: now - 1000 }, {}, now), ["leaves"]); // fetched a second ago
  assert.deepEqual(datasetsToRefresh("calendar", { employees: now - REFRESH_EVERY_MS }, {}, now), ["employees", "leaves"]); // a minute ago
});

test("datasetsToRefresh skips anything with a save in flight", () => {
  assert.deepEqual(datasetsToRefresh("myleave", {}, { leaves: 1 }, Date.now()), ["comps"]);
  assert.deepEqual(datasetsToRefresh("myleave", {}, { leaves: 0 }, Date.now()), ["leaves", "comps"]);
});

test("unknown pages refresh nothing, and every page lists known datasets", () => {
  assert.deepEqual(datasetsToRefresh("v2:whatever", {}, {}, Date.now()), []);
  const known = ["employees", "leaves", "comps", "timecards", "projects", "assignments", "scores", "plans", "raid", "milestones", "weeklyHealth", "pipeline", "settings"];
  Object.values(PAGE_DATA).flat().forEach((k) => assert.ok(known.includes(k), k));
});

test("datasetsMissing lists what a page still needs before it can render", () => {
  assert.deepEqual(datasetsMissing("calendar", {}), ["employees", "leaves"]);
  assert.deepEqual(datasetsMissing("calendar", { employees: 1 }), ["leaves"]);
  assert.deepEqual(datasetsMissing("calendar", { employees: 1, leaves: 1 }), []);
  assert.deepEqual(datasetsMissing("v2:x", {}), []);
});

// Guards the lazy-loading contract: if a view reads a dataset its page doesn't declare,
// that page would render with an empty list (looks plausible, is wrong).
import fs from "node:fs";
test("every page declares each dataset its view reads", () => {
  const VIEW = { dash: ["Dashboard"], myleave: ["MyLeave"], calendar: ["TeamCalendar"], allrecords: ["AllLeaveRecords"], compoff: ["CompOffLog"],
    reports: ["LeaveReports"], timecard: ["TimecardGrid", "../ui/FlaggedResources"], tcsummary: ["TimecardInsights", "../ui/FlaggedResources"], alloc: ["Allocations"],
    projects: ["Projects"], plans: ["TeamPlans"], programhealth: ["ProgramHealth"], perf: ["Performance"], runway: ["Runway"], employees: ["Employees"], settings: ["Settings"], admin: ["Admin"] };
  const SIGNS = { leaves: /\bleaves\b/, comps: /\bcomps\b/, timecards: /\btcRows\b|\btcWeeks\b/, projects: /\b(allP|p)rojects\b/, assignments: /\bassignments\b/,
    scores: /\bscores\b/, plans: /\bplans\b/, raid: /\braid\b/, milestones: /\bmilestones\b/, weeklyHealth: /\bweeklyHealth\b/, pipeline: /\bpipeline\b/ };
  for (const [page, files] of Object.entries(VIEW)) {
    const src = files.map((f) => fs.readFileSync(new URL("../src/views/" + f + ".jsx", import.meta.url), "utf8")).join("\n");
    for (const [k, re] of Object.entries(SIGNS)) {
      if (re.test(src)) assert.ok(PAGE_DATA[page].includes(k), page + " reads " + k + " but PAGE_DATA." + page + " doesn't load it");
    }
  }
});
