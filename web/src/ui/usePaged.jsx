import { useState } from "react";
import { pageSlice } from "../lib/paging.js";

export function usePaged(rows, defaultSize = 25) {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(defaultSize);
  const p = pageSlice(rows, page, size);
  const pager = p.total > Math.min(10, size) ? (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600 no-print">
      <span className="flex items-center gap-2">
        Rows per page
        <select className="rounded-lg border border-slate-200 px-2 py-1 text-sm" value={size}
          onChange={(e) => { setSize(Number(e.target.value)); setPage(1); }}>
          {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <span className="text-slate-400">{p.from}–{p.to} of {p.total}</span>
      </span>
      <span className="flex items-center gap-1">
        <button disabled={p.cur <= 1} onClick={() => setPage(p.cur - 1)}
          className={"rounded-lg border border-slate-200 px-2.5 py-1 " + (p.cur <= 1 ? "cursor-not-allowed text-slate-300" : "hover:bg-slate-50")}>‹ Prev</button>
        <span className="px-2 text-slate-500">Page {p.cur} / {p.pages}</span>
        <button disabled={p.cur >= p.pages} onClick={() => setPage(p.cur + 1)}
          className={"rounded-lg border border-slate-200 px-2.5 py-1 " + (p.cur >= p.pages ? "cursor-not-allowed text-slate-300" : "hover:bg-slate-50")}>Next ›</button>
      </span>
    </div>
  ) : null;
  return { rows: p.slice, pager };
}
