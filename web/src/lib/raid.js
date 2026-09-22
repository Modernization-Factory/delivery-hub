// ============================================================
// PROJECTS (Lead view · PM/Admin manage) — project master
// ============================================================
export const RAID_TYPES = ["Risk", "Issue", "Dependency", "Decision"];

export const HML = ["H", "M", "L"];

export const RAID_STATUSES = ["Open", "In Progress", "Closed"];

export const MS_STATUSES = ["Not Started", "In Progress", "Complete"];

export const RAG_OPTS = ["Green", "Amber", "Red"];

export const ragPill = (x) => x === "Red" ? "bg-red-100 text-red-800" : x === "Amber" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800";

export const hmlPill = (x) => x === "H" ? "bg-red-100 text-red-800" : x === "M" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600";
