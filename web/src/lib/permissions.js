// ---- Permission registry: module-level groups, capability-level entries, role defaults ----
// (D = Developer, S = Senior Developer, L = Lead incl. Stream Leads, P = Project Manager; Admin always has everything;
// S falls back to D when omitted)
export const PERM_GROUPS = [
  { module: "Leave", caps: [
    ["leave.own", "Submit own leave · delete own entries", { D: 1, L: 1, P: 1, V: 0 }],
    ["leave.records", "View all leave records", { D: 0, L: 1, P: 1, V: 1 }],
    ["leave.forAnyone", "File / delete leave for anyone", { D: 0, L: 1, P: 1, V: 0 }],
    ["leave.compoff", "Log & manage comp-off earned", { D: 0, L: 1, P: 1, V: 0 }],
    ["leave.reports", "Leave reports (role / company / project totals)", { D: 0, L: 1, P: 1, V: 1 }],
    ["settings.edit", "Leave settings (types · weekends · holidays)", { D: 0, L: 0, P: 1, V: 0 }],
  ]},
  { module: "Timecard", caps: [
    ["timecard.editAll", "Edit full grid · import weekly file · add weeks", { D: 0, L: 1, P: 1, V: 0 }],
    ["timecard.insights", "Timecard insights & compliance", { D: 0, L: 1, P: 1, V: 1 }],
  ]},
  { module: "Allocations & Projects", caps: [
    ["alloc.view", "View allocations (plan · roster · burn)", { D: 0, L: 1, P: 1, V: 1 }],
    ["alloc.edit", "Create / end / delete assignments", { D: 0, L: 1, P: 1, V: 0 }],
    ["projects.view", "View project master", { D: 0, L: 1, P: 1, V: 1 }],
    ["projects.manage", "Manage projects (names · phases · streams · JIRA setting)", { D: 0, L: 0, P: 1, V: 0 }],
    ["projects.raid", "Manage RAID log & milestones on projects", { D: 0, L: 1, P: 1, V: 0 }],
  ]},
  { module: "Team Plans", caps: [
    ["plans.view", "View team plans & manage grid", { D: 0, L: 1, P: 1, V: 1 }],
    ["plans.manage", "Create / update / archive / delete team plans", { D: 0, L: 1, P: 1, V: 0 }],
  ]},
  { module: "Program Health", caps: [
    ["ph.view", "View program health (portfolio · weekly · pipeline)", { D: 0, L: 1, P: 1, V: 1 }],
    ["ph.register", "Edit PM-maintained project fields (stories · current margin · key update)", { D: 0, L: 0, P: 1, V: 0 }],
    ["ph.weekly", "Submit & edit weekly health entries", { D: 0, L: 0, P: 1, V: 0 }],
    ["ph.pipeline", "Manage the pipeline board", { D: 0, L: 0, P: 1, V: 0 }],
  ]},
  { module: "Performance", caps: [
    ["perf.view", "View performance · watchlist", { D: 0, L: 1, P: 1, V: 1 }],
    ["perf.score", "Enter & edit weekly scores", { D: 0, L: 1, P: 1, V: 0 }],
    ["perf.reports", "Performance reports & exports (Excel · PDF)", { D: 0, L: 1, P: 1, V: 1 }],
    ["perf.config", "Scoring configuration (weights · RAG · scope)", { D: 0, L: 0, P: 0, V: 0 }],
  ]},
  { module: "Runway", caps: [
    ["runway.view", "View remaining runway (weeks · days · last date)", { D: 0, L: 1, P: 1, V: 1 }],
    ["runway.funding", "Manage funding hours & remaining overrides", { D: 0, L: 0, P: 1, V: 0 }],
  ]},
  { module: "People", caps: [
    ["employees.view", "View employee master", { D: 0, L: 1, P: 1, V: 1 }],
    ["employees.edit", "Edit employee master · Stream Leads · Viewers", { D: 0, L: 0, P: 1, V: 0 }],
  ]},
];

export function defaultPerms() {
  const o = {};
  PERM_GROUPS.forEach((g) => g.caps.forEach(([id, _l, d]) => { o[id] = { Developer: !!d.D, "Senior Developer": !!(d.S ?? d.D), Lead: !!d.L, "Project Manager": !!d.P, Viewer: !!d.V }; }));
  return o;
}

// stored permission docs from before a capability/role existed lack keys — merge defaults under them
export function mergePerms(stored) {
  const base = defaultPerms();
  const out = {};
  Object.keys(base).forEach((cap) => {
    const s = (stored || {})[cap] || {};
    // Senior Developer split out of Developer later — until saved, it mirrors the stored Developer setting
    const sd = "Senior Developer" in s ? {} : "Developer" in s ? { "Senior Developer": s.Developer } : {};
    out[cap] = { ...base[cap], ...s, ...sd };
  });
  return out;
}

export function canDo(perms, role, cap) {
  if (role === "Admin") return true;
  const p = perms[cap];
  return p ? !!p[role] : false;
}

// leave whose start date has passed is locked — only PM / Admin may delete it
export function canDeletePastLeave(role) {
  return role === "Project Manager" || role === "Admin";
}

// effective app role: Lead Developer OR designated Stream Lead -> Lead
export function appRoleForEmp(e) {
  if (e.viewer) return "Viewer"; // read-only persona, regardless of PS role
  if (e.role === "Project Manager") return "Project Manager";
  if (e.role === "Lead Developer" || e.streamLead) return "Lead";
  if (e.role === "Senior Developer") return "Senior Developer";
  return "Developer";
}

// ============================================================
// STATIC CONFIG
// ============================================================
export const ROLES = ["Developer", "Senior Developer", "Lead", "Project Manager", "Admin", "Viewer"];
