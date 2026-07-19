import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

function csvEscape(v: unknown, delimiter: string): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  const re = new RegExp(`["\\n${delimiter === ";" ? ";" : ","}]`);
  if (re.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export type CsvDelimiter = "," | ";";

export function downloadCSV(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
  opts?: { delimiter?: CsvDelimiter; preamble?: string[] },
) {
  const delimiter: CsvDelimiter = opts?.delimiter ?? ",";
  const lines: string[] = [];
  if (opts?.preamble && opts.preamble.length) {
    for (const p of opts.preamble) lines.push(`# ${p}`);
    lines.push("");
  }
  lines.push(headers.map((h) => csvEscape(h, delimiter)).join(delimiter));
  for (const r of rows) lines.push(r.map((c) => csvEscape(c, delimiter)).join(delimiter));
  const csv = lines.join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}


export function downloadPDF(filename: string, title: string, headers: string[], rows: (string | number | null | undefined)[][], subtitle?: string) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setFontSize(16); doc.text(title, 40, 40);
  if (subtitle) { doc.setFontSize(10); doc.setTextColor(120); doc.text(subtitle, 40, 58); doc.setTextColor(0); }
  autoTable(doc, {
    head: [headers],
    body: rows.map(r => r.map(v => (v ?? "").toString())),
    startY: subtitle ? 72 : 60,
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [124, 58, 237] },
  });
  doc.save(filename);
}
