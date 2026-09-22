import test from "node:test";
import assert from "node:assert/strict";
import { phBurnVsPlan, phEffortVar, phElapsedPct, phHighRisks, phOverallStatus, phPct, phScheduleVar } from "../src/lib/programHealth.js";

test("phElapsedPct is the share of the project window that has passed", () => {
  assert.equal(phElapsedPct("2026-01-01", "2026-12-31", "2026-07-02"), 0.5);
  assert.equal(phElapsedPct("2026-01-01", "2026-12-31", "2027-01-31"), 1.09); // overrun > 1
  assert.equal(phElapsedPct(null, "2026-12-31", "2026-07-02"), null);
  assert.equal(phElapsedPct("2026-12-31", "2026-01-01", "2026-07-02"), null); // end before start
});

test("phEffortVar and phBurnVsPlan express overspend as a positive fraction", () => {
  assert.equal(phEffortVar(100, 110), 0.1);
  assert.equal(phEffortVar(100, 90), -0.1);
  assert.equal(phEffortVar(0, 40), null); // nothing planned = no variance
  assert.equal(phBurnVsPlan([{ hoursPlanned: 40, hoursBurnt: 44 }, { hoursPlanned: 60, hoursBurnt: 66 }]), 0.1);
  assert.equal(phBurnVsPlan([]), null);
});

test("phScheduleVar compares delivery against elapsed time", () => {
  assert.deepEqual(phScheduleVar(100, 40, 0.5), { completion: 0.4, variance: -0.1 }); // behind
  assert.deepEqual(phScheduleVar(100, 60, 0.5), { completion: 0.6, variance: 0.1 }); // ahead
  assert.deepEqual(phScheduleVar(0, 0, 0.5), { completion: null, variance: null });
  assert.deepEqual(phScheduleVar(100, 40, null), { completion: 0, variance: null });
});

test("phHighRisks counts only open high-impact entries for that project", () => {
  const raid = [
    { projectId: "p1", impact: "H", status: "Open" },
    { projectId: "p1", impact: "H", status: "Closed" },
    { projectId: "p1", impact: "M", status: "Open" },
    { projectId: "p2", impact: "H", status: "Open" },
  ];
  assert.equal(phHighRisks(raid, "p1"), 1);
  assert.equal(phHighRisks(raid, "p3"), 0);
});

test("phPct renders fractions as percentages and blanks out nulls", () => {
  assert.equal(phPct(0.42), "42%");
  assert.equal(phPct(null), "—");
  assert.equal(phPct(undefined), "—");
});

const clean = { latestRag: null, burnVsPlan: null, scheduleVar: null, elapsedPct: null, highRisks: 0, overdueMilestones: 0 };

test("phOverallStatus is Green with no adverse signal", () => {
  const s = phOverallStatus(clean);
  assert.equal(s.status, "Green");
  assert.equal(s.derived, "Green");
  assert.equal(s.fromPM, false);
  assert.deepEqual(s.reasons, []);
});

test("phOverallStatus escalates on burn, schedule, overrun and risks", () => {
  assert.equal(phOverallStatus({ ...clean, burnVsPlan: 0.05 }).derived, "Amber");
  assert.equal(phOverallStatus({ ...clean, burnVsPlan: 0.2 }).derived, "Red");
  assert.equal(phOverallStatus({ ...clean, scheduleVar: -0.08 }).derived, "Amber");
  assert.equal(phOverallStatus({ ...clean, scheduleVar: -0.2 }).derived, "Red");
  assert.equal(phOverallStatus({ ...clean, elapsedPct: 1.01 }).derived, "Red");
  assert.equal(phOverallStatus({ ...clean, highRisks: 1 }).derived, "Amber");
  assert.equal(phOverallStatus({ ...clean, highRisks: 3 }).derived, "Red");
  assert.equal(phOverallStatus({ ...clean, overdueMilestones: 2 }).derived, "Amber");
});

test("phOverallStatus keeps the worst level and explains every signal", () => {
  const s = phOverallStatus({ ...clean, burnVsPlan: 0.2, highRisks: 1, overdueMilestones: 1 });
  assert.equal(s.derived, "Red"); // an Amber signal after a Red one cannot downgrade it
  assert.equal(s.reasons.length, 3);
  assert.match(s.reasons[0], /burn 20% over plan/);
  assert.match(s.reasons[1], /1 high-impact risk open/);
  assert.match(s.reasons[2], /1 milestone overdue/);
});

test("phOverallStatus lets a submitted PM RAG override the derived colour", () => {
  const s = phOverallStatus({ ...clean, latestRag: "Green", burnVsPlan: 0.5 });
  assert.equal(s.status, "Green");
  assert.equal(s.derived, "Red");
  assert.equal(s.fromPM, true);
  assert.equal(s.reasons.length, 1); // still reported, so the UI can flag the disagreement
});
