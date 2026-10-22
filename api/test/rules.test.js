/** Condensed server-side rules test — core assertion from each domain. */
const R = require("../src/rules");
const seed = require("../scripts/seed.json");
let pass = 0, fail = 0;
const eq = (n, g, w) => { if (JSON.stringify(g) === JSON.stringify(w)) pass++; else { fail++; console.log("FAIL", n, "got", JSON.stringify(g), "want", JSON.stringify(w)); } };
const near = (n, g, w, t) => { if (Math.abs(g - w) <= (t || 1e-9)) pass++; else { fail++; console.log("FAIL", n, g, w); } };
const LT = [{ name: "Vacation", value: 1 }, { name: "Sick", value: 1 }, { name: "Unpaid", value: 1 }, { name: "Half Day", value: 0.5 }, { name: "Comp-Off", value: 1 }];
const WE = [0, 6], HS = new Set(seed.H);

// leave engine
eq("leave-week", R.leaveDays("2026-07-20", "2026-07-24", "Vacation", LT, WE, HS), 5);
eq("leave-halfday", R.leaveDays("2026-07-20", "2026-07-20", "Half Day", LT, WE, HS), 0.5);
eq("leave-holiday-excluded", R.leaveDays("2026-04-30", "2026-05-04", "Vacation", LT, WE, HS), 2);
eq("compoff-weekday-invalid", R.compOffDateValid("2026-07-16", WE, HS), false);
// end dates
eq("active-boundary", R.isActiveDuring({ start: "2026-01-01", term: "2026-07-16" }, "2026-07-16", "2026-07-16"), true);
eq("inactive-after", R.isActiveDuring({ start: "2026-01-01", term: "2026-06-30" }, "2026-07-16", "2026-07-16"), false);
// timecard flex
eq("flex-jira-off", R.tcStatsFlex([["Proactive", "Not Updated"]], [false]).pct, 100);
// capacity example (16 Jul -> 16 Aug ≈ 1 person-month)
near("capacity-example", R.assignmentDaysInMonth({ from: "2026-07-16", to: "2026-08-16" }, 2026, 7, WE, HS) / 23 + R.assignmentDaysInMonth({ from: "2026-07-16", to: "2026-08-16" }, 2026, 8, WE, HS) / 20, 1.0, 0.05);
// FTE split
const s = R.effortSplitInMonth([{ id: "a", from: "2026-05-01", to: null }, { id: "b", from: "2026-05-01", to: null }], 2026, 5, WE, HS);
near("split-even", s.a, 9.5); near("split-caps-1fte", s.a + s.b, 19);
// perf math reproduces source tracker values
near("perf-source-1.7", R.weightedScore([2, 1, 2, 2, 1, 2], [25, 20, 10, 25, 10, 10]), 1.7);
eq("rag-amber-boundary", R.ragOf(2.5, { green: 3.5, amber: 2.5 }), "Amber");
// perms
const P = R.defaultPerms();
eq("perms-lead-records", R.canDo(P, "Lead", "leave.records"), true);
eq("perms-pm-no-cfg", R.canDo(P, "Project Manager", "perf.config"), false);
eq("perms-admin-all", R.PERM_GROUPS.flatMap(g => g.caps).every(([id]) => R.canDo(P, "Admin", id)), true);
// report builders on real seed
const employees = seed.E.map(([name, role, company, start, term]) => ({ name, role, company, start, term }));
const scores = seed.P.map(([name, week, m], i) => ({ id: "s" + i, name, week, m }));
const sc = R.perfScorecard(employees, scores, "2026-05-18", { weights: [25, 20, 10, 25, 10, 10], green: 3.5, amber: 2.5, partnerOnly: true });
eq("scorecard-partners", sc.rows.every(r => R.PARTNER_COS.includes(r.vendor)), true);
eq("scorecard-rag-sum", Object.values(sc.vendors).reduce((a, v) => a + v.Green + v.Amber + v.Red, 0), sc.rows.filter(r => r.score !== null).length);
// role model
eq("streamlead-role", R.appRoleForEmp({ role: "Senior Developer", streamLead: true }), "Lead");
eq("past-leave-pm", R.canDeletePastLeave("Project Manager"), true);
eq("past-leave-lead", R.canDeletePastLeave("Lead"), false);
console.log("SERVER RULES TESTS — PASS:", pass, "FAIL:", fail);
process.exit(fail ? 1 : 0);
