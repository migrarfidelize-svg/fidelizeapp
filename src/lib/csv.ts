// Minimal CSV parser: supports quoted fields, escaped quotes, comma/semicolon.
export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const clean = text.replace(/^\ufeff/, "");
  // Detect delimiter from first line
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === delim) { cur.push(field); field = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && clean[i + 1] === "\n") i++;
        cur.push(field); field = "";
        if (cur.some(c => c.length)) rows.push(cur);
        cur = [];
      } else field += ch;
    }
  }
  if (field.length || cur.length) { cur.push(field); if (cur.some(c => c.length)) rows.push(cur); }
  if (rows.length === 0) return { headers: [], rows: [] };
  const headers = rows[0].map(h => h.trim().toLowerCase());
  const dataRows = rows.slice(1).map(r => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = (r[idx] ?? "").trim(); });
    return obj;
  });
  return { headers, rows: dataRows };
}

export const CUSTOMER_CSV_TEMPLATE =
  "name,phone,email,birthdate,notes,marketing_opt_in\n" +
  "Maria Silva,11999998888,maria@example.com,1990-05-12,Cliente VIP,sim\n" +
  "João Souza,11988887777,,,,não\n";
