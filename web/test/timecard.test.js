import test from "node:test";
import assert from "node:assert/strict";
import { excelToISO, parseTimecardGrid, tcStats, tcStatsFlex, tcSuggested, weekCompliance, weekComplianceFlex } from "../src/lib/timecard.js";

test("tcStats counts cells and excludes N/A from the denominator", () => {
  const s = tcStats([["Proactive", "Proactive"], ["Chased", "N/A"], ["", ""]]);
  assert.equal(s.Proactive, 2);
  assert.equal(s.Chased, 1);
  assert.equal(s["N/A"], 1);
  assert.equal(s.blank, 2);
  assert.equal(s.filled, 3);
  assert.equal(s.pct, 67); // 2/3
});

test("tcStats returns null pct when nothing countable was filled", () => {
  assert.equal(tcStats([["", ""], ["N/A", "N/A"]]).pct, null);
});

test("tcStatsFlex ignores the JIRA cell on weeks where the project opted out", () => {
  const weeks = [["Proactive", "Not Updated"], ["Proactive", "Not Updated"]];
  assert.equal(tcStatsFlex(weeks, [true, true]).pct, 50);
  assert.equal(tcStatsFlex(weeks, [false, false]).pct, 100);
  assert.equal(tcStatsFlex(weeks, [false, true]).pct, 67); // 2 of 3
  assert.equal(tcStatsFlex(weeks, undefined).pct, 50); // no flags = count both
});

test("weekCompliance aggregates one week down a column", () => {
  const rows = [
    { id: "r1", weeks: [["Proactive", "Proactive"], ["Chased", "Chased"]] },
    { id: "r2", weeks: [["Proactive", "N/A"], ["Proactive", ""]] },
  ];
  assert.equal(weekCompliance(rows, 0), 100); // 3 proactive of 3 countable
  assert.equal(weekCompliance(rows, 1), 33);
});

test("weekComplianceFlex drops JIRA per row when that row's flag is off", () => {
  const rows = [{ id: "r1", weeks: [["Proactive", "Not Updated"]] }];
  assert.equal(weekComplianceFlex(rows, 0, { r1: [true] }), 50);
  assert.equal(weekComplianceFlex(rows, 0, { r1: [false] }), 100);
  assert.equal(weekComplianceFlex(rows, 0, {}), 50);
});

test("weekComplianceFlex tolerates rows shorter than the week index", () => {
  assert.equal(weekComplianceFlex([{ id: "r1", weeks: [] }], 3, {}), null);
});

test("tcSuggested maps proactiveness onto the 1-5 metric band", () => {
  assert.equal(tcSuggested(95), 5);
  assert.equal(tcSuggested(90), 5);
  assert.equal(tcSuggested(89), 4);
  assert.equal(tcSuggested(60), 3);
  assert.equal(tcSuggested(40), 2);
  assert.equal(tcSuggested(0), 1);
  assert.equal(tcSuggested(null), null);
});

test("excelToISO accepts dates, serial numbers and strings", () => {
  assert.equal(excelToISO(new Date(2026, 6, 16)), "2026-07-16");
  assert.equal(excelToISO(46219), "2026-07-16"); // Excel serial
  assert.equal(excelToISO("2026-07-16"), "2026-07-16");
  assert.equal(excelToISO("16 Jul 2026"), "2026-07-16");
  assert.equal(excelToISO(""), null);
  assert.equal(excelToISO("not a date"), null);
});

test("parseTimecardGrid reads weeks from col F and data from row 3", () => {
  const grid = [
    ["Name", "Company", "Release", "Role", "Remarks", "2026-07-11", null, "2026-07-18", null],
    ["", "", "", "", "", "SF", "JIRA", "SF", "JIRA"],
    ["Asha", "WeKan", "R1", "Dev", "", "Proactive", "chased", "N/A", ""],
    ["Amit Jain", "Ciklum", "R2", "Lead", "note", "proactive", "Proactive", "Proactive", "Proactive"],
  ];
  const out = parseTimecardGrid(grid);
  assert.deepEqual(out.weeks, ["2026-07-11", "2026-07-18"]);
  assert.equal(out.rows.length, 2);
  assert.deepEqual(out.rows[0].weeks, [["Proactive", "Chased"], ["N/A", ""]]); // case-insensitive
  assert.equal(out.rows[1].name, "Amit Jain(L)"); // alias applied
  assert.equal(out.rows[1].remarks, "note");
  assert.equal(out.unknownStatuses, 0);
  assert.equal(out.duplicates, 0);
});

test("parseTimecardGrid reports unknown statuses and skips duplicate people", () => {
  const grid = [
    ["Name", "", "", "", "", "2026-07-11", null],
    ["", "", "", "", "", "SF", "JIRA"],
    ["Asha", "", "", "", "", "Whatever", "Proactive"],
    ["Asha", "", "", "", "", "Proactive", "Proactive"],
    ["", "", "", "", "", "Proactive", "Proactive"],
  ];
  const out = parseTimecardGrid(grid);
  assert.equal(out.rows.length, 1);
  assert.equal(out.duplicates, 1);
  assert.equal(out.unknownStatuses, 1);
  assert.deepEqual(out.rows[0].weeks, [["", "Proactive"]]);
});
