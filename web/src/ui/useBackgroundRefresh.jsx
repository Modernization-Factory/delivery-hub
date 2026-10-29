import { useEffect, useRef, useState } from "react";
import { datasetsMissing, datasetsToRefresh } from "../lib/refresh.js";
import { Notice } from "./atoms.jsx";

// Loads a page's data the first time it opens, then keeps it fresh: re-pulls when the page
// opens again and when the tab comes back into view (at most once a minute per dataset,
// never mid-save). `deps.loaders(names)` maps dataset -> loader; employees load first
// because the person-keyed loaders resolve names through them.
//
// Returns { ready, error, retry } for the current page: `ready` is false until every
// dataset the page reads has loaded once, so the page shows "Loading…" rather than empty
// lists that look like real data. A failed first load sets `error`; background refresh
// failures are silent (the page keeps what it has; the next trigger tries again).
export function useBackgroundRefresh(page, booted, deps) {
  const queue = useRef(Promise.resolve()); // loads run one after another so a fast page switch is never dropped
  const latest = useRef(null);
  const [, bump] = useState(0); // re-render when a page's first load lands
  const [error, setError] = useState(null);
  latest.current = (pg, { firstOnly = false } = {}) => {
    queue.current = queue.current.then(async () => {
      if (!booted) return;
      const { lastFetched, inFlight } = deps;
      const missing = datasetsMissing(pg, lastFetched.current);
      // background refreshes wait for a visible tab; a page's first load never does
      const keys = missing.length ? missing : firstOnly || document.hidden ? [] : datasetsToRefresh(pg, lastFetched.current, inFlight.current, Date.now());
      if (!keys.length) return;
      const names = keys.includes("employees") ? await deps.loadEmployees() : deps.empNameByIdNow();
      const load = deps.loaders(names);
      const now = Date.now();
      if (keys.includes("employees")) lastFetched.current.employees = now;
      // a save may have started while employees loaded — skip anything now in flight
      const results = await Promise.all(keys.filter((k) => k !== "employees" && !(inFlight.current[k] > 0)).map((k) =>
        load[k]().then(() => { lastFetched.current[k] = now; return null; }, (e) => k + ": " + (e.message || e))));
      const failed = results.filter(Boolean);
      if (missing.length) {
        setError(failed.length && datasetsMissing(pg, lastFetched.current).length ? failed.join("; ") : null);
        bump((n) => n + 1);
      }
    });
    return queue.current;
  };
  useEffect(() => { setError(null); latest.current(page); }, [page, booted]);
  useEffect(() => {
    const onBack = () => { if (!document.hidden) latest.current(page); };
    document.addEventListener("visibilitychange", onBack);
    window.addEventListener("focus", onBack);
    return () => { document.removeEventListener("visibilitychange", onBack); window.removeEventListener("focus", onBack); };
  }, [page]);
  const ready = booted && datasetsMissing(page, deps.lastFetched.current).length === 0;
  return { ready, error: ready ? null : error, retry: () => { setError(null); latest.current(page, { firstOnly: true }); } };
}

// shown in place of a page until its data has loaded once
export function PageLoading({ error, retry }) {
  if (error) return <Notice tone="error">Couldn't load this page's data ({error}). <button className="ml-2 underline" onClick={retry}>Retry</button></Notice>;
  return <div className="flex items-center gap-2 py-16 text-sm text-slate-500"><span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />Loading…</div>;
}
