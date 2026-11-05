// Reader stand-in: turns an owner's Excel recap or a bank statement (CSV or PDF) into
// canonical ledger rows, each carrying its source (sheet + cell, or statement line).
// Rules-based column mapping; swap mapColumns() for a Claude call later.
import * as XLSX from "xlsx";

export type Channel = "cash" | "qris" | "expense";

export type Source = { file: string; sheet?: string; cell?: string; line?: number };

export type LedgerRow = {
  date: string; // ISO yyyy-mm-dd
  channel: Channel;
  amount: number | null; // null = cell left blank by the owner
  item: string;
  source: Source;
  sig: string; // raw row content, used to spot rows typed twice
  confidence: number;
};

export type Field = "date" | "cash" | "qris" | "desc" | "in" | "out" | "amount";

export type SheetMapping = {
  sheet: string;
  kind: "sales" | "kas" | "expense";
  headerRow: number; // 1-based, as Excel shows it
  columns: Partial<Record<Field, { col: string; header: string }>>;
};

// First matching pattern wins, so order matters ("kas masuk" before "masuk").
const HEADER_PATTERNS: [Field, RegExp][] = [
  ["date", /^(tanggal|tgl|date)\b/i],
  ["qris", /qris/i],
  ["cash", /tunai|cash/i],
  ["in", /kas masuk|pemasukan|debet/i],
  ["out", /kas keluar|kredit/i],
  ["desc", /keterangan|uraian|deskripsi/i],
  ["amount", /^(jumlah|nominal|total biaya)$/i],
];

export function mapColumns(sheet: string, rows: unknown[][]): SheetMapping | null {
  const headerIdx = rows.slice(0, 15).findIndex((r) => r.some((c) => typeof c === "string" && HEADER_PATTERNS[0][1].test(c.trim())));
  if (headerIdx < 0) return null;
  const columns: SheetMapping["columns"] = {};
  rows[headerIdx].forEach((cell, c) => {
    if (typeof cell !== "string") return;
    const hit = HEADER_PATTERNS.find(([f, re]) => !columns[f] && re.test(cell.trim()));
    if (hit) columns[hit[0]] = { col: XLSX.utils.encode_col(c), header: cell.trim() };
  });
  let kind: SheetMapping["kind"];
  if (columns.cash || columns.qris) kind = "sales";
  else if (columns.in) kind = "kas";
  else if (columns.amount && /pengeluaran|biaya|belanja/i.test(sheet)) kind = "expense";
  else return null; // e.g. the Stok sheet: no money columns
  return { sheet, kind, headerRow: headerIdx + 1, columns };
}

const pad = (n: number) => String(n).padStart(2, "0");

// A real calendar date only: rejects 31/02 and month 13 (e.g. a US-order 10/31/2026).
const realDate = (iso: string) => {
  const t = Date.parse(iso + "T00:00:00Z");
  return !isNaN(t) && new Date(t).toISOString().slice(0, 10) === iso ? iso : null;
};

export function toIsoDate(v: unknown): string | null {
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    return d ? `${d.y}-${pad(d.m)}-${pad(d.d)}` : null;
  }
  if (typeof v === "string") {
    const m = v.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (m) return realDate(`${m[3]}-${pad(+m[2])}-${pad(+m[1])}`);
    if (/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) return realDate(v.trim());
  }
  return null;
}

function toAmount(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string" && /\d/.test(v)) { // "libur", "tutup": no number, so treat as blank
    const n = Number(v.replace(/[^\d.,-]/g, "").replace(/[.,](?=\d{3}\b)/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function readExcel(file: string, data: ArrayBuffer | Uint8Array) {
  const wb = XLSX.read(data, { type: "array" });
  const mappings: SheetMapping[] = [];
  const rows: LedgerRow[] = [];
  const skipped: Source[] = []; // date cells that hold something date-like we could not read
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null, blankrows: true });
    const origin = XLSX.utils.decode_range(ws["!ref"] ?? "A1").s;
    const m = mapColumns(name, grid);
    if (!m) continue;
    mappings.push(m);
    const idx = (f: Field) => (m.columns[f] ? XLSX.utils.decode_col(m.columns[f]!.col) : -1);
    const at = (r: number, f: Field) => XLSX.utils.encode_cell({ r: r + origin.r, c: idx(f) + origin.c });
    for (let r = m.headerRow; r < grid.length; r++) {
      const row = grid[r];
      const date = toIsoDate(row[idx("date")]);
      if (!date) {
        if (/\d/.test(String(row[idx("date")] ?? ""))) skipped.push({ file, sheet: name, cell: at(r, "date") });
        continue;
      }
      const sig = JSON.stringify(row);
      const desc = idx("desc") >= 0 ? String(row[idx("desc")] ?? "").trim() : "";
      const push = (channel: Channel, f: Field, item: string) =>
        rows.push({ date, channel, amount: toAmount(row[idx(f)]), item, sig, confidence: 0.9, source: { file, sheet: name, cell: at(r, f) } });
      if (m.kind === "sales") {
        if (idx("cash") >= 0) push("cash", "cash", "Penjualan tunai");
        if (idx("qris") >= 0) push("qris", "qris", "Penjualan QRIS");
      } else if (m.kind === "expense") {
        push("expense", "amount", desc || "Pengeluaran");
      } else {
        // Kas book: one line per entry, channel read from the description.
        if (toAmount(row[idx("in")]) != null) push(/qris/i.test(desc) ? "qris" : "cash", "in", desc);
        else if (idx("out") >= 0 && toAmount(row[idx("out")]) != null) push("expense", "out", desc);
      }
    }
  }
  return { mappings, rows, skipped };
}

// ---------- bank statement (CSV: Tanggal, Keterangan, Mutasi, DB/CR, Saldo) ----------

export type BankKind = "opening" | "qris" | "cash_deposit" | "supplier" | "personal" | "fee" | "interest" | "other";

export type BankLine = {
  line: number; // 1-based line in the file, header = 1
  date: string;
  desc: string;
  amount: number;
  dir: "CR" | "DB" | "";
  time?: string; // HH:MM:SS, PDF e-Statements only
  kind: BankKind;
  business: boolean;
  covers?: string[]; // QRIS settlement: the sales dates it pays out
  source: Source;
};

const BANK_RULES: [BankKind, RegExp, boolean][] = [
  ["opening", /SALDO AWAL/i, false],
  ["qris", /SETTLEMENT QRIS|QRIS/i, true],
  ["cash_deposit", /SETORAN TUNAI|SETOR TUNAI/i, true],
  ["personal", /PRIBADI|SAUDARA|KELUARGA/i, false],
  ["fee", /BIAYA ADM|ADM BANK/i, false],
  ["interest", /BUNGA|PAJAK BUNGA/i, false],
  // A company or shop as counterparty, in any bank's wording ("TRF KE PT …", "Ke BCA PT …", "Pembayaran QR ke TOKO …").
  ["supplier", /\b(PT|CV|UD|TOKO)\s+[A-Z]/i, true],
];

function parseCsvLine(s: string, sep: "," | ";"): string[] {
  const re = sep === ";" ? /("([^"]*)"|[^;]*)(;|$)/g : /("([^"]*)"|[^,]*)(,|$)/g;
  return [...s.matchAll(re)].slice(0, -1).map((m) => (m[2] ?? m[1]).trim());
}

function expandCovers(label: string, year: string): string[] {
  const m = label.match(/(\d{2})\/(\d{2})(?:-(\d{2})\/(\d{2}))?/);
  if (!m) return [];
  const start = new Date(`${year}-${m[2]}-${m[1]}T00:00:00Z`);
  const end = m[3] ? new Date(`${year}-${m[4]}-${m[3]}T00:00:00Z`) : start;
  const out: string[] = [];
  for (let d = start; d <= end; d = new Date(d.getTime() + 864e5)) out.push(d.toISOString().slice(0, 10));
  return out;
}

export function readBankCsv(file: string, text: string): BankLine[] {
  const lines = text.split(/\r?\n/);
  const out: BankLine[] = [];
  // Excel with an Indonesian locale saves CSV with ";"
  const sep = (lines[0].match(/;/g) ?? []).length > (lines[0].match(/,/g) ?? []).length ? ";" : ",";
  lines.slice(1).forEach((raw, i) => {
    if (!raw.trim()) return;
    const [tgl, desc, mutasi, dir] = parseCsvLine(raw, sep);
    const date = toIsoDate(tgl);
    if (!date) return;
    out.push(bankLine(file, i + 2, date, desc, toAmount(mutasi.replace(/\.\d{2}$/, "")) ?? 0, dir === "CR" || dir === "DB" ? dir : ""));
  });
  return out;
}

function bankLine(file: string, line: number, date: string, desc: string, amount: number, dir: BankLine["dir"]): BankLine {
  const [kind, , business] = BANK_RULES.find(([, re]) => re.test(desc)) ?? ["other", /./, false];
  return {
    line, date, desc, kind, business, amount, dir,
    covers: kind === "qris" ? expandCovers(desc, date.slice(0, 4)) : undefined,
    source: { file, line },
  };
}

// ---------- bank statement (PDF e-Statement table: No | Tanggal | Keterangan | Nominal | Saldo) ----------
// Takes text items with page coordinates (pdf.js getTextContent), so it runs without pdf.js.
// Each transaction is anchored on its "No" cell; everything between two anchors belongs to it.
// ponytail: one layout (Mandiri-style signed Nominal); add per-bank layouts as real statements arrive.

export type PdfText = { str: string; x: number; y: number };

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, mei: 5, jun: 6, jul: 7, aug: 8, agu: 8, agt: 8, sep: 9, oct: 10, okt: 10, nov: 11, dec: 12, des: 12,
};
const SIGNED = /^[+-]\s?\d{1,3}(\.\d{3})*,\d{2}$/;

function pdfDate(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2}) ([A-Za-z]{3})[a-z]* (\d{4})$/);
  const mon = m && MONTHS[m[2].toLowerCase()];
  return mon ? realDate(`${m[3]}-${pad(mon)}-${pad(+m[1])}`) : null;
}

export function readBankPdf(file: string, pages: PdfText[][]): BankLine[] {
  const out: BankLine[] = [];
  for (const items of pages) {
    const find = (re: RegExp) => items.find((i) => re.test(i.str.trim()));
    const tgl = find(/^Tanggal$/i), ket = find(/^Keterangan$/i);
    if (!tgl || !ket) continue; // no transaction table on this page
    const body = items.filter((i) => i.y < ket.y - 15 && i.str.trim());
    const anchors = body.filter((i) => i.x < tgl.x && /^\d{1,5}$/.test(i.str.trim())).sort((a, b) => b.y - a.y);
    anchors.forEach((a, k) => {
      const up = k > 0 ? anchors[k - 1].y - a.y : anchors[k + 1] ? a.y - anchors[k + 1].y : 46;
      const down = anchors[k + 1] ? a.y - anchors[k + 1].y : up;
      const band = body.filter((i) => i.y < a.y + up / 2 && i.y >= a.y - down / 2);
      const date = band.map((i) => (i.x < ket.x ? pdfDate(i.str) : null)).find(Boolean);
      const amt = band.find((i) => SIGNED.test(i.str.trim()));
      if (!date || !amt) return;
      const desc = band
        .filter((i) => i.x >= ket.x - 2 && i.x < amt.x - 5 && i.str.trim() !== "-")
        .sort((p, q) => q.y - p.y || p.x - q.x)
        .map((i) => i.str.trim())
        .join(" ");
      const s = amt.str.trim();
      const time = band.map((i) => i.str.trim().match(/^(\d{2}:\d{2}(?::\d{2})?) WIB$/)?.[1]).find(Boolean);
      out.push({ ...bankLine(file, Number(a.str), date, desc, Math.abs(toAmount(s) ?? 0), s.startsWith("+") ? "CR" : "DB"), time });
    });
  }
  return out;
}
