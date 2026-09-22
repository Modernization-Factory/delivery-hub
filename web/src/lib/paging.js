// slice rows for pagination — pure and testable
export function pageSlice(rows, page, size) {
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / Math.max(1, size)));
  const cur = Math.min(Math.max(1, page), pages);
  const from = (cur - 1) * size;
  return { slice: rows.slice(from, from + size), cur, pages, total, from: total ? from + 1 : 0, to: Math.min(from + size, total) };
}
