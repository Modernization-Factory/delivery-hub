// ============================================================
// BUSINESS LOGIC (pure functions)
// ============================================================
export function parseISO(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toISO(d) {
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}

export function fmt(s) {
  if (!s) return "—";
  const d = parseISO(s);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function fmtShort(s) {
  if (!s) return "—";
  const d = parseISO(s);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function isWeekend(d, weekendDays) {
  return weekendDays.includes(d.getDay());
}

export function isWorkingDay(d, weekendDays, holidaySet) {
  return !isWeekend(d, weekendDays) && !holidaySet.has(toISO(d));
}

export function workingDaysBetween(startISO, endISO, weekendDays, holidaySet) {
  let d = parseISO(startISO);
  const end = parseISO(endISO);
  let n = 0;
  while (d <= end) {
    if (isWorkingDay(d, weekendDays, holidaySet)) n++;
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  }
  return n;
}

export function monthRange(y, m) { // m: 1-12
  const p = (n) => String(n).padStart(2, "0");
  const last = new Date(y, m, 0).getDate();
  return [y + "-" + p(m) + "-01", y + "-" + p(m) + "-" + p(last)];
}

export function addWorkingDays(startISO, n, weekendDays, holidaySet) {
  // Excel WORKDAY semantics: fraction truncated, start day not counted
  let remaining = Math.floor(n);
  const d = parseISO(startISO);
  let iso = startISO;
  let guard = 0;
  while (remaining > 0 && guard < 3000) {
    d.setDate(d.getDate() + 1);
    iso = toISO(d);
    guard++;
    if (isWorkingDay(d, weekendDays, holidaySet)) remaining--;
  }
  return iso;
}

export function weekAnchor(todayISO) {
  // Excel: TODAY() - WEEKDAY(TODAY()) -> the most recent Saturday
  const d = parseISO(todayISO);
  return toISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay() - 1));
}

export const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
