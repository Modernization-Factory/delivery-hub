// ---- Remaining Runway engine ----
// Runway per role = remaining billable hours / weekly team burn, projected onto
// the calendar from the week anchor, extended by REAL approved leave (fixing the
// source sheet's broken WORKDAY usage where leave forecasts never took effect).
export const RUNWAY_ROLES = ["PM", "LD", "SD", "Dev"];

export function runwayRoleOf(psRole) {
  return psRole === "Project Manager" ? "PM" : psRole === "Lead Developer" ? "LD" : psRole === "Senior Developer" ? "SD" : "Dev";
}

// map master roles -> app roles
export function appRoleOf(masterRole) {
  if (masterRole === "Project Manager") return "Project Manager";
  if (masterRole === "Lead Developer") return "Lead";
  return "Developer";
}
