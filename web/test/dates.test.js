import test from "node:test";
import assert from "node:assert/strict";
import { addWorkingDays, fmt, isWeekend, isWorkingDay, monthRange, parseISO, toISO, weekAnchor, workingDaysBetween } from "../src/lib/dates.js";
import { HOLIDAYS, NO_HOLIDAYS, WEEKEND } from "./fixtures.js";

test("parseISO/toISO round-trip in local time", () => {
  assert.equal(toISO(parseISO("2026-07-16")), "2026-07-16");
  assert.equal(toISO(parseISO("2026-01-01")), "2026-01-01");
  assert.equal(parseISO("2026-07-16").getDay(), 4); // Thursday
});

test("fmt renders a readable date and tolerates empty input", () => {
  assert.equal(fmt(""), "—");
  assert.equal(fmt(null), "—");
  assert.match(fmt("2026-07-16"), /16 Jul 2026/);
});

test("weekend and working-day predicates honour config", () => {
  assert.equal(isWeekend(parseISO("2026-07-04"), WEEKEND), true); // Saturday
  assert.equal(isWeekend(parseISO("2026-07-04"), [5]), false); // Friday-only weekend
  assert.equal(isWorkingDay(parseISO("2026-07-17"), WEEKEND, HOLIDAYS), false); // holiday
  assert.equal(isWorkingDay(parseISO("2026-07-17"), WEEKEND, NO_HOLIDAYS), true);
});

test("workingDaysBetween is inclusive and skips weekends + holidays", () => {
  assert.equal(workingDaysBetween("2026-07-20", "2026-07-24", WEEKEND, NO_HOLIDAYS), 5);
  assert.equal(workingDaysBetween("2026-07-18", "2026-07-19", WEEKEND, NO_HOLIDAYS), 0); // Sat+Sun
  assert.equal(workingDaysBetween("2026-07-13", "2026-07-17", WEEKEND, HOLIDAYS), 4); // holiday on the Friday
  assert.equal(workingDaysBetween("2026-07-20", "2026-07-20", WEEKEND, NO_HOLIDAYS), 1);
});

test("monthRange covers the whole month, including leap February", () => {
  assert.deepEqual(monthRange(2026, 7), ["2026-07-01", "2026-07-31"]);
  assert.deepEqual(monthRange(2026, 2), ["2026-02-01", "2026-02-28"]);
  assert.deepEqual(monthRange(2028, 2), ["2028-02-01", "2028-02-29"]);
});

test("addWorkingDays follows Excel WORKDAY semantics", () => {
  assert.equal(addWorkingDays("2026-07-16", 1, WEEKEND, NO_HOLIDAYS), "2026-07-17"); // start day not counted
  assert.equal(addWorkingDays("2026-07-17", 1, WEEKEND, NO_HOLIDAYS), "2026-07-20"); // jumps the weekend
  assert.equal(addWorkingDays("2026-07-16", 1, WEEKEND, HOLIDAYS), "2026-07-20"); // holiday skipped too
  assert.equal(addWorkingDays("2026-07-16", 1.9, WEEKEND, NO_HOLIDAYS), "2026-07-17"); // fraction truncated
  assert.equal(addWorkingDays("2026-07-16", 0, WEEKEND, NO_HOLIDAYS), "2026-07-16");
});

test("weekAnchor is the most recent Saturday strictly before today", () => {
  assert.equal(weekAnchor("2026-07-16"), "2026-07-11"); // Thu -> previous Sat
  assert.equal(weekAnchor("2026-07-11"), "2026-07-04"); // on a Sat -> the one before
  assert.equal(weekAnchor("2026-07-12"), "2026-07-11"); // Sun -> yesterday
});
