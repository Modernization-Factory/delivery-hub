import * as XLSX from "xlsx";

export function downloadXlsx(filename, sheets) {
  const wb = XLSX.utils.book_new();
  sheets.forEach(([name, aoa]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name.slice(0, 31)));
  XLSX.writeFile(wb, filename);
}
