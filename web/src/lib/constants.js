// ============================================================
// SEED DATA — extracted from the three source trackers
// E: [name, role, company, start, term]
// L: [name, start, end, type]  (leave records)
// C: [name, dateWorked, earnedDays, reason]  (comp-off earned)
// T: [name, release, remarks, [[SF,JIRA] x weeks]]
// W: week-ending dates  |  H: holidays
// ============================================================
export const SEED = { E: [], L: [], C: [], T: [], W: [], H: [], A: [], P: [] }; // data now loads from the API

export const OPEN_END = "9999-12-31"; // null `to` = ongoing

export const MODULES_V2 = []; // all v2 modules shipped — Program Health was the last
