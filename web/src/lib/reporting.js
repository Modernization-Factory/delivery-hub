// ---- Reporting lines: who reports to whom, and who may be a team manager ----
// (mirrors api/src/rules.js — the API enforces the same rules)
//
// An employee carries `managerId` (who they report to) and `teamManager` (flagged as a
// team manager). Only a flagged manager can be reported to. A flagged manager sees only
// themselves and their whole reporting chain — reportees, their reportees, and so on.

// PMs and Admins see the whole team, so they are never team managers
export function canBeTeamManager(e) {
  return !!e && e.role !== "Project Manager" && !e.isAdmin;
}
export function isTeamManager(e) {
  return !!(e && e.teamManager) && canBeTeamManager(e);
}

export function reporteesOf(employees, id) {
  return employees.filter((e) => e.managerId && e.managerId === id);
}

// everyone below `id`, however many levels down (not `id` itself); safe against a loop in
// stored data, which the save rules below prevent but old or hand-edited data could hold
export function reportingChain(employees, id) {
  const below = new Set();
  const queue = [id];
  while (queue.length) {
    const cur = queue.shift();
    employees.forEach((e) => {
      if (e.managerId === cur && e.id !== id && !below.has(e.id)) {
        below.add(e.id);
        queue.push(e.id);
      }
    });
  }
  return below;
}

// managers above `id`, nearest first (direct manager, their manager, ...)
export function managersAbove(employees, id) {
  const byId = Object.fromEntries(employees.map((e) => [e.id, e]));
  const out = [];
  let cur = byId[id];
  while (cur && cur.managerId && !out.includes(cur.managerId) && cur.managerId !== id) {
    out.push(cur.managerId);
    cur = byId[cur.managerId];
  }
  return out;
}

// who `emp` may be set to report to: active flagged managers, not themselves, and nobody
// already below them (that would make a loop)
export function managerOptions(employees, emp) {
  const below = emp && emp.id ? reportingChain(employees, emp.id) : new Set();
  return employees
    .filter((m) => isTeamManager(m) && !m.inactive && (!emp || m.id !== emp.id) && !below.has(m.id))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// The reason a proposed employee record breaks the reporting rules, or null when it's fine.
// `next` is the record as it would be saved; `employees` is everyone as they are now.
export function reportingError(employees, next) {
  const prev = next.id ? employees.find((e) => e.id === next.id) : null;
  if (next.teamManager && !canBeTeamManager(next)) {
    return { error: "team_manager_ineligible", detail: "A Project Manager or Admin can't be a team manager — they already see the whole team." };
  }
  if (prev && prev.teamManager && !next.teamManager) {
    const still = reporteesOf(employees, prev.id);
    if (still.length) return { error: "has_reportees", detail: still.map((e) => e.name).sort().join(", ") + (still.length === 1 ? " still reports" : " still report") + " to " + prev.name + " — assign them another manager first." };
  }
  if (next.managerId) {
    if (next.id && next.managerId === next.id) return { error: "self_manager", detail: "Someone can't report to themselves." };
    const mgr = employees.find((e) => e.id === next.managerId);
    if (!mgr) return { error: "manager_not_found", detail: "That manager isn't in the employee master." };
    if (!isTeamManager(mgr)) return { error: "manager_not_flagged", detail: mgr.name + " isn't flagged as a team manager." };
    const changed = !prev || prev.managerId !== next.managerId;
    if (changed && mgr.inactive) return { error: "manager_inactive", detail: mgr.name + " is inactive — pick an active manager." };
    if (next.id && reportingChain(employees, next.id).has(mgr.id)) return { error: "reporting_loop", detail: mgr.name + " already reports to " + (next.name || "this person") + ", directly or further down — that would make a loop." };
  }
  return null;
}

// Who may approve or reject a pending comp-off: an Admin for anyone; otherwise a flagged team
// manager (with leave.compoffApprove) anywhere above that person in the reporting chain —
// never for their own entry. `approver` is { id, role (app role), teamManager }.
export function canDecideCompOff(approver, employees, targetId, can) {
  if (!approver) return false;
  if (approver.role === "Admin") return true;
  if (!approver.teamManager || !can("leave.compoffApprove")) return false;
  if (!targetId || targetId === approver.id) return false;
  return managersAbove(employees, targetId).includes(approver.id);
}
