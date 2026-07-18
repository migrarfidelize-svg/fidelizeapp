import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function downloadCSV(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const csv = [headers.map(csvEscape).join(","), ...rows.map(r => r.map(csvEscape).join(","))].join("\n");
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
