// Fixes: changes the owner chooses to make to their own Excel from the match page.
// Applied to a copy of the uploaded workbook, so the app re-reads it (flags that were
// typos disappear) and the owner can download the corrected file.
import * as XLSX from "xlsx";

export type Fix = { flag: string; sheet: string; at: string } & (
  | { set: { cell: string; from: number | null; to: number | null } } // retype one amount
  | { dropRow: number } // delete a row typed twice (1-based, as Excel shows it)
  | { addRow: { cols: Record<string, string | number>; label: string } } // add a missing row; ISO strings are dates
);

// Keeps formula cells that have no cached value (files saved by openpyxl, LibreOffice scripts).
export const openWorkbook = (data: ArrayBuffer | Uint8Array) => XLSX.read(data, { type: "array", sheetStubs: true, cellStyles: true });

export function applyFixes(data: ArrayBuffer | Uint8Array, fixes: Fix[]): XLSX.WorkBook {
  const wb = openWorkbook(data);
  for (const f of fixes) {
    const ws = wb.Sheets[f.sheet];
    if (!ws) continue;
    if ("set" in f) {
      const old = ws[f.set.cell] ?? {};
      if (f.set.to == null) ws[f.set.cell] = { t: "z", z: old.z, s: old.s };
      else ws[f.set.cell] = { t: "n", v: f.set.to, z: old.z, s: old.s };
      grow(ws, XLSX.utils.decode_cell(f.set.cell).r);
    } else if ("dropRow" in f) {
      shiftRows(wb, f.sheet, f.dropRow, -1);
    } else {
      // Insert in date order among the rows that have a date, so SUM ranges and the TOTAL row below still cover it.
      const iso = Object.values(f.addRow.cols).find((v) => typeof v === "string" && ISO.test(v)) as string;
      const dateCol = Object.keys(f.addRow.cols).find((c) => f.addRow.cols[c] === iso)!;
      const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
      let after = 0; // 1-based row of the last dated row on or before the new date
      for (let r = range.s.r; r <= range.e.r; r++) {
        const c = ws[`${dateCol}${r + 1}`];
        if (c?.t === "n" && c.v <= serial(iso)) after = r + 1;
        if (c?.t === "n" && c.v > serial(iso)) break;
      }
      const row = after + 1;
      shiftRows(wb, f.sheet, row, 1);
      const style = (col: string) => ws[`${col}${after}`]; // copy the look of the row above
      for (const [col, v] of Object.entries(f.addRow.cols)) {
        const date = typeof v === "string" && ISO.test(v);
        ws[`${col}${row}`] = date ? { t: "n", v: serial(v), z: style(col)?.z ?? "dd/mm/yyyy", s: style(col)?.s }
          : typeof v === "number" ? { t: "n", v, z: style(col)?.z, s: style(col)?.s } : { t: "s", v, s: style(col)?.s };
      }
    }
  }
  return wb;
}

export const writeWorkbook = (wb: XLSX.WorkBook) => XLSX.write(wb, { type: "array", bookType: "xlsx", cellStyles: true }) as ArrayBuffer;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const serial = (iso: string) => Date.parse(iso + "T00:00:00Z") / 864e5 + 25569;

function grow(ws: XLSX.WorkSheet, r: number) {
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  range.e.r = Math.max(range.e.r, r);
  ws["!ref"] = XLSX.utils.encode_range(range);
}

// Inserts one empty row before `row` (delta 1) or deletes `row` (delta -1), like Excel does,
// including every formula in the workbook that points at the moved rows.
export function shiftRows(wb: XLSX.WorkBook, sheet: string, row: number, delta: 1 | -1) {
  const ws = wb.Sheets[sheet];
  const at = row - 1; // 0-based
  const cells = Object.keys(ws).filter((k) => k[0] !== "!").map((k) => [k, XLSX.utils.decode_cell(k)] as const);
  const moved: XLSX.WorkSheet = {};
  for (const [k, a] of cells) {
    if (a.r < at) continue;
    const cell = ws[k];
    delete ws[k];
    if (delta === -1 && a.r === at) continue; // the deleted row
    moved[XLSX.utils.encode_cell({ r: a.r + delta, c: a.c })] = cell;
  }
  Object.assign(ws, moved);
  ws["!merges"] = ws["!merges"]?.map((m) => (m.s.r >= at ? { s: { ...m.s, r: m.s.r + delta }, e: { ...m.e, r: m.e.r + delta } } : m));
  ws["!rows"]?.splice(at, delta === 1 ? 0 : 1, ...(delta === 1 ? [{}] : []));
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  range.e.r += delta;
  ws["!ref"] = XLSX.utils.encode_range(range);
  for (const name of wb.SheetNames) {
    const s = wb.Sheets[name];
    for (const k of Object.keys(s)) if (k[0] !== "!" && s[k].f) s[k].f = shiftFormula(s[k].f, name, sheet, row, delta);
  }
}

// Rows from `row` on move by delta. A range ending on the row just above an insert grows to
// include it (adding to the end of a table); a range ending on a deleted row shrinks.
const REF = /(?<![\w.$])((?:'[^']+'|[A-Za-z_][\w.]*)!)?(\$?[A-Z]{1,3}\$?)(\d+)(?::(\$?[A-Z]{1,3}\$?)(\d+))?(?![\w(])/g;
export function shiftFormula(f: string, own: string, sheet: string, row: number, delta: 1 | -1): string {
  return f.replace(REF, (all, pre: string | undefined, c1: string, r1: string, c2?: string, r2?: string) => {
    const target = pre ? pre.slice(0, -1).replace(/^'|'$/g, "") : own;
    if (target !== sheet) return all;
    const move = (r: number) => (r >= row + (delta === -1 ? 1 : 0) ? r + delta : r);
    if (!c2) return `${pre ?? ""}${c1}${move(+r1)}`;
    const end = delta === 1 && +r2! === row - 1 && +r1 < row - 1 ? +r2! + 1 : move(+r2!);
    return `${pre ?? ""}${c1}${move(+r1)}:${c2}${end}`;
  });
}
