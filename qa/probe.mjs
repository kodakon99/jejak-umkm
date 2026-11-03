// QA probes against the Jejak engine (the MVP implementation of the 4 business services).
// usage: node probe.mjs <web dir>  → prints one JSON line per case: {id, actual, ok}
import { readFileSync } from "node:fs";
const WEB = process.argv[2];
const E = (f) => import(`${WEB}/lib/engine/${f}`);
const { readExcel, readBankCsv, toIsoDate, mapColumns } = await E("read.ts");
const { reconcile } = await E("reconcile.ts");
const { evaluate, addMonths } = await E("gates.ts");
const { actionPlan, businessProfile } = await E("coach.ts");
const XLSX = (await import(`${WEB}/node_modules/xlsx/xlsx.mjs`));

const root = `${WEB}/..`;
const csv = readFileSync(`${root}/bank_statement_sample.csv`, "utf8");
const xa = readFileSync(`${root}/owner_recap_templateA.xlsx`);
const xb = readFileSync(`${root}/owner_recap_templateB.xlsx`);
const bank = readBankCsv("b.csv", csv);
const A = readExcel("a.xlsx", xa), B = readExcel("b.xlsx", xb);
const HEAD = "Tanggal,Keterangan,Mutasi,DB/CR,Saldo\n";
const book = (sheets) => {
  const wb = XLSX.utils.book_new();
  for (const [name, aoa] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name);
  return XLSX.write(wb, { type: "array", bookType: "xlsx" });
};
const BASE = {
  slikOwner: "bersih", hasSpouse: false, slikSpouse: "bersih", onlineLoans: "tidak_ada", productiveLoans: "tidak_ada",
  dhn: false, sipp: false, nib: true, monthsOperating: 24, statementMonths: 6, loanAmount: 25_000_000, hasFixedAsset: false,
  reconciledMonths: 3, openFlags: 0,
};
const T = "2026-11-02";
const gate = (a, id, t = T) => evaluate({ ...BASE, ...a }, t).gates.find((g) => g.id === id);
const short = (g) => g && { status: g.status, readyDate: g.readyDate, reason: g.reason };

const cases = [];
const c = (id, fn, check) => cases.push({ id, fn, check });
const run = (fn) => { try { return { v: fn() }; } catch (e) { return { err: `${e.constructor.name}: ${e.message}` }; } };

// ---------- IMPORT: Excel ----------
c("IMP-001 template A maps sheets", () => A.mappings.map((m) => `${m.sheet}:${m.kind}:${m.headerRow}`), (r) => r.v?.length >= 1);
c("IMP-002 template B maps sheets", () => B.mappings.map((m) => `${m.sheet}:${m.kind}:${m.headerRow}`), (r) => r.v?.length >= 1);
c("IMP-003 no Tanggal column", () => readExcel("x.xlsx", book({ S: [["Hari", "Tunai"], ["01/10/2026", 1000]] })).mappings.length, (r) => r.v === 0);
c("IMP-004 empty workbook (header only)", () => readExcel("x.xlsx", book({ S: [["Tanggal", "Tunai", "QRIS"]] })).rows.length, (r) => r.v === 0);
c("IMP-005 header at row 15 (limit)", () => readExcel("x.xlsx", book({ S: [...Array(14).fill(["x"]), ["Tanggal", "Tunai"], ["01/10/2026", 5]] })).rows.length, (r) => r.v === 1);
c("IMP-006 header at row 16 (limit+1)", () => readExcel("x.xlsx", book({ S: [...Array(15).fill(["x"]), ["Tanggal", "Tunai"], ["01/10/2026", 5]] })).mappings.length, (r) => r.v === 0);
c("IMP-007 impossible date 31/02/2026", () => toIsoDate("31/02/2026"), (r) => r.v === null);
c("IMP-008 month 13 13/13/2026", () => toIsoDate("13/13/2026"), (r) => r.v === null);
c("IMP-009 reconcile survives impossible date", () => {
  const x = readExcel("x.xlsx", book({ S: [["Tanggal", "Tunai", "QRIS"], ["31/02/2026", 1000, 1000]] }));
  return reconcile(x.rows, bank).days.length;
}, (r) => !r.err);
c("IMP-010 negative sales amount accepted", () => readExcel("x.xlsx", book({ S: [["Tanggal", "Tunai"], ["01/10/2026", -500000]] })).rows[0].amount, (r) => r.v >= 0);
c("IMP-011 text amount 'Rp175.000'", () => readExcel("x.xlsx", book({ S: [["Tanggal", "Tunai"], ["01/10/2026", "Rp175.000"]] })).rows[0].amount, (r) => r.v === 175000);
c("IMP-012 text amount 'abc' (non-numeric)", () => readExcel("x.xlsx", book({ S: [["Tanggal", "Tunai"], ["01/10/2026", "abc"]] })).rows[0].amount, (r) => r.v === null);
c("IMP-013 'Cashback' header read as cash", () => {
  const m = mapColumns("S", [["Tanggal", "Cashback", "Penjualan Tunai"]]);
  return m.columns.cash?.header;
}, (r) => r.v === "Penjualan Tunai");
c("IMP-014 unicode/emoji sheet + desc", () => readExcel("x.xlsx", book({ "Kas 💰": [["Tanggal", "Keterangan", "Kas Masuk"], ["01/10/2026", "Jual kopi ☕ — Bu Ñ", 5000]] })).rows[0], (r) => r.v?.item?.includes("☕"));
c("IMP-015 text file renamed .xlsx", () => readExcel("x.xlsx", new TextEncoder().encode("Tanggal,Tunai\n01/10/2026,5000\n")).rows.length, (r) => r.err || r.v === 0);
c("IMP-016 random bytes as .xlsx", () => readExcel("x.xlsx", new Uint8Array(4096).map((_, i) => (i * 7919) % 256)).rows.length, (r) => !!r.err || r.v === 0);
c("IMP-017 zero-byte file", () => readExcel("x.xlsx", new Uint8Array(0)).rows.length, (r) => !!r.err || r.v === 0);
c("IMP-018 path-traversal file name kept verbatim", () => readExcel("../../etc/passwd.xlsx", book({ S: [["Tanggal", "Tunai"], ["01/10/2026", 5]] })).rows[0].source.file, (r) => true);
c("IMP-019 US date 10/31/2026", () => toIsoDate("10/31/2026"), (r) => r.v === null);
c("IMP-020 dd-mm-yyyy and ISO accepted", () => [toIsoDate("05-10-2026"), toIsoDate("2026-10-05"), toIsoDate(46300)], (r) => r.v[0] === "2026-10-05" && r.v[1] === "2026-10-05");

// ---------- IMPORT: bank CSV ----------
c("IMP-030 sample CSV lines", () => ({ lines: bank.length, business: bank.filter((b) => b.business).length, excluded: bank.filter((b) => !b.business && b.kind !== "opening").length }), (r) => r.v.lines > 0);
c("IMP-031 semicolon-delimited CSV", () => readBankCsv("b.csv", "Tanggal;Keterangan;Mutasi;DB/CR;Saldo\n02/10/2026;SETTLEMENT QRIS 01/10;248250;CR;0\n").length, (r) => r.v === 1);
c("IMP-032 short line (2 fields)", () => readBankCsv("b.csv", HEAD + "02/10/2026,SETORAN TUNAI\n").length, (r) => !r.err);
c("IMP-033 header only (no dated lines)", () => readBankCsv("b.csv", HEAD).length, (r) => r.v === 0);
c("IMP-034 'TRF KE TOKO BUNGA MAWAR' (supplier)", () => readBankCsv("b.csv", HEAD + '06/10/2026,TRF KE TOKO BUNGA MAWAR,"500,000.00",DB,0\n')[0].kind, (r) => r.v === "supplier");
c("IMP-035 'TRF KE UD KELUARGA JAYA' (supplier)", () => readBankCsv("b.csv", HEAD + '06/10/2026,TRF KE UD KELUARGA JAYA,"500,000.00",DB,0\n')[0].kind, (r) => r.v === "supplier");
c("IMP-036 QRIS settlement crossing year", () => readBankCsv("b.csv", HEAD + '02/01/2027,SETTLEMENT QRIS 31/12-01/01,"500,000.00",CR,0\n')[0].covers, (r) => r.v?.join() === "2026-12-31,2027-01-01");
c("IMP-037 QRIS credit without date range", () => readBankCsv("b.csv", HEAD + '02/10/2026,QRIS MERCHANT,"500,000.00",CR,0\n')[0].covers, (r) => true);
c("IMP-038 BOM at file start", () => readBankCsv("b.csv", "﻿" + HEAD + '02/10/2026,SETORAN TUNAI,"5,000.00",CR,0\n').length, (r) => r.v === 1);
c("IMP-039 escaped quote in desc", () => readBankCsv("b.csv", HEAD + '02/10/2026,"TRF ""BU RINA""","5,000.00",CR,0\n')[0], (r) => r.v?.amount === 5000);
c("IMP-040 mutasi with Indonesian decimal 1.000,50", () => readBankCsv("b.csv", HEAD + '02/10/2026,SETORAN TUNAI,"1.000,50",CR,0\n')[0].amount, (r) => r.v === 1000 || r.v === 1001 || r.v === 1000.5);
c("IMP-041 lowercase cr/db direction", () => readBankCsv("b.csv", HEAD + '02/10/2026,SETORAN TUNAI,"5,000.00",cr,0\n')[0].dir, (r) => r.v === "CR");

// ---------- RECONCILE ----------
c("REC-001 template A planted errors", () => reconcile(A.rows, bank).flags.map((f) => `${f.kind}@${f.dates.join("+")}`), (r) => r.v.length >= 3);
c("REC-002 template B clean", () => reconcile(B.rows, bank).flags.length, (r) => r.v === 0);
c("REC-003 empty statement → evidence still 'cocok'?", () => {
  const rec = reconcile(B.rows, []);
  return { flags: rec.flags.length, statuses: [...new Set(rec.days.map((d) => d.status))], months: new Set(rec.days.map((d) => d.date.slice(0, 7))).size };
}, (r) => r.v.flags > 0);
c("REC-004 cash-only Excel, 3 months, statement with no deposits → sales_evidence", () => {
  const rows = [];
  for (const m of ["08", "09", "10"]) for (let d = 1; d <= 28; d++) rows.push({ date: `2026-${m}-${String(d).padStart(2, "0")}`, channel: "cash", amount: 500000, item: "x", sig: `${m}${d}`, confidence: 0.9, source: { file: "x", sheet: "S", cell: "B" + d } });
  const b = readBankCsv("b.csv", HEAD + "01/08/2026,SALDO AWAL,,,0\n31/10/2026,BIAYA ADM,\"5,000.00\",DB,0\n");
  const rec = reconcile(rows, b);
  const months = new Set(rec.days.map((d) => d.date.slice(0, 7))).size; // same as store.tsx
  return { flags: rec.flags.length, months, gate: evaluate({ ...BASE, reconciledMonths: months, openFlags: rec.flags.length }, T).gates.find((g) => g.id === "sales_evidence").status };
}, (r) => r.v.gate !== "lulus");
c("REC-005 Excel months outside statement period", () => {
  const extra = B.rows.map((r) => ({ ...r, date: r.date.replace("2026-10", "2026-07"), sig: r.sig + "j" }));
  const rec = reconcile([...extra, ...B.rows], bank);
  return { kinds: [...new Set(rec.flags.map((f) => f.kind))], n: rec.flags.length };
}, (r) => r.v.n > 0);
c("REC-006 QRIS credit with no covers → flag with empty dates", () => {
  const b = readBankCsv("b.csv", HEAD + '02/10/2026,QRIS MERCHANT,"500,000.00",CR,0\n');
  const f = reconcile(B.rows, [...bank, ...b.map((x) => ({ ...x, line: 99 }))]).flags.find((f) => f.id === "qris-99");
  return f && { dates: f.dates, title: f.title };
}, (r) => !r.v || r.v.dates.length > 0);
c("REC-007 QRIS tolerance boundary (exactly Rp1,000 off)", () => {
  const rows = [{ date: "2026-10-01", channel: "qris", amount: 100000, item: "q", sig: "1", confidence: 0.9, source: { sheet: "S" } }];
  const mk = (amt) => reconcile(rows, [{ line: 2, date: "2026-10-02", desc: "SETTLEMENT QRIS 01/10", amount: amt, dir: "CR", kind: "qris", business: true, covers: ["2026-10-01"], source: {} }]).flags.length;
  return { at: mk(99300 - 1000), over: mk(99300 - 1001) };
}, (r) => r.v.at === 0 && r.v.over === 1);
c("REC-008 two cash deposits same day", () => {
  const b = [...bank, { ...bank.find((x) => x.kind === "cash_deposit"), line: 98 }];
  return run(() => reconcile(B.rows, b).flags.map((f) => f.id)).v ?? "err";
}, (r) => Array.isArray(r.v));
c("REC-009 duplicate row typed 3 times", () => {
  const r0 = B.rows.find((r) => r.channel === "cash");
  const rec = reconcile([...B.rows, r0, r0], bank);
  return rec.flags.filter((f) => f.kind === "duplicate").map((f) => f.excel.length);
}, (r) => r.v[0] === 3);
c("REC-010 supplier matched by expense ±3 days", () => {
  const sup = bank.find((b) => b.kind === "supplier");
  const exp = (days) => ({ date: new Date(Date.parse(sup.date) + days * 864e5).toISOString().slice(0, 10), channel: "expense", amount: sup.amount, item: "x", sig: "e" + days, confidence: 0.9, source: {} });
  const n = (d) => reconcile([...B.rows.filter((r) => r.channel !== "expense"), exp(d)], [sup]).flags.filter((f) => f.id === `sup-${sup.line}`).length;
  return { d3: n(3), d4: n(4) };
}, (r) => r.v.d3 === 0 && r.v.d4 === 1);
c("REC-011 2,000 rows / 1,000 lines latency (spec ≤300 ms)", () => {
  const rows = [], lines = [];
  for (let i = 0; i < 1000; i++) {
    const d = new Date(Date.UTC(2026, 4, 1) + i * 864e5 / 6).toISOString().slice(0, 10);
    rows.push({ date: d, channel: "cash", amount: 1000 + i, item: "", sig: "c" + i, confidence: 0.9, source: { sheet: "S" } });
    rows.push({ date: d, channel: "qris", amount: 1000 + i, item: "", sig: "q" + i, confidence: 0.9, source: { sheet: "S" } });
    lines.push({ line: i + 2, date: d, desc: "SETTLEMENT QRIS", amount: 990, dir: "CR", kind: i % 3 ? "qris" : "cash_deposit", business: true, covers: [d], source: {} });
  }
  const t = performance.now(); reconcile(rows, lines); return Math.round(performance.now() - t);
}, (r) => r.v <= 300);

// ---------- EVALUATE ----------
c("EVA-001 all clear → siap 100%", () => { const r = evaluate(BASE, T); return { overall: r.overall, passed: r.passed, percent: r.percent }; }, (r) => r.v.overall === "siap" && r.v.percent === 100);
c("EVA-002 kol2 bad until 2026-05-01 (6 months back)", () => short(gate({ slikOwner: "kol2", slikOwnerBadUntil: "2026-05-01" }, "slik_owner")), (r) => true);
c("EVA-003 kol2 bad until 2026-06-01 (5 months back)", () => short(gate({ slikOwner: "kol2", slikOwnerBadUntil: "2026-06-01" }, "slik_owner")), (r) => r.v.status === "blokir");
c("EVA-004 kol2 with no bad-until date", () => short(gate({ slikOwner: "kol2" }, "slik_owner")), (r) => r.v.status === "blokir");
c("EVA-005 kol2 bad-until malformed '2026-08' (raw month input)", () => short(gate({ slikOwner: "kol2", slikOwnerBadUntil: "2026-08" }, "slik_owner")), (r) => !r.err);
c("EVA-006 kol2 bad-until in the future", () => short(gate({ slikOwner: "kol2", slikOwnerBadUntil: "2027-03-01" }, "slik_owner")), (r) => r.v.status === "blokir");
c("EVA-007 statementMonths NaN", () => short(gate({ statementMonths: NaN }, "statements")), (r) => r.v.status !== "lulus");
c("EVA-008 monthsOperating NaN", () => short(gate({ monthsOperating: NaN }, "operating")), (r) => r.v.status !== "lulus");
c("EVA-009 monthsOperating negative -3", () => short(gate({ monthsOperating: -3 }, "operating")), (r) => true);
c("EVA-010 monthsOperating 5.5 (fractional)", () => short(gate({ monthsOperating: 5.5 }, "operating")), (r) => r.v.readyDate > T);
c("EVA-011 operating 5/6/11/12 boundary", () => [5, 6, 11, 12].map((n) => gate({ monthsOperating: n }, "operating").status), (r) => r.v.join() === "blokir,hati,hati,lulus");
c("EVA-012 statements 5/6 boundary", () => [5, 6].map((n) => gate({ statementMonths: n }, "statements").status), (r) => r.v.join() === "blokir,lulus");
c("EVA-013 loan 100,000,000 / 100,000,001 no asset", () => [100_000_000, 100_000_001].map((n) => gate({ loanAmount: n }, "collateral").status), (r) => r.v.join() === "lulus,hati");
c("EVA-014 loanAmount 0 and negative", () => [0, -5].map((n) => gate({ loanAmount: n }, "collateral").reason), (r) => true);
c("EVA-015 unknown enum slikOwner 'macet'", () => short(gate({ slikOwner: "macet" }, "slik_owner")), (r) => r.v.status !== "lulus");
c("EVA-016 unknown enum onlineLoans 'TELAT' (case)", () => short(gate({ onlineLoans: "TELAT" }, "online_loans")), (r) => r.v.status !== "lulus");
c("EVA-017 dhn as string 'false'", () => short(gate({ dhn: "false" }, "dhn")), (r) => r.v.status === "lulus");
c("EVA-018 end-of-month: operating 3 months on 2026-08-31", () => gate({ monthsOperating: 3 }, "operating", "2026-08-31").readyDate, (r) => r.v === "2026-11-30");
c("EVA-019 reconciled 3, openFlags 0 vs 1", () => [0, 1].map((n) => gate({ openFlags: n }, "sales_evidence").status), (r) => r.v.join() === "lulus,hati");
c("EVA-020 openFlags negative -1", () => short(gate({ openFlags: -1 }, "sales_evidence")), (r) => true);
c("EVA-021 as_of malformed '02/11/2026'", () => short(gate({ monthsOperating: 2 }, "operating", "02/11/2026")), (r) => !r.err);
c("EVA-022 extra unknown field ignored", () => evaluate({ ...BASE, isAdmin: true, overall: "siap" }, T).overall, (r) => r.v === "siap");
c("EVA-023 undated + dated blockers → readyDate", () => { const r = evaluate({ ...BASE, nib: false, statementMonths: 3 }, T); return { overall: r.overall, readyDate: r.readyDate, undated: r.undatedBlockers }; }, (r) => r.v.undated === 1);
c("EVA-024 action plan order", () => actionPlan(evaluate({ ...BASE, nib: false, statementMonths: 3, onlineLoans: "lancar" }, T)).map((s) => s.gate.id), (r) => r.v[0] === "nib");
c("EVA-025 latency 10,000 evaluations", () => { const t = performance.now(); for (let i = 0; i < 1e4; i++) evaluate(BASE, T); return +((performance.now() - t) / 1e4).toFixed(4); }, (r) => r.v <= 20);
c("EVA-026 deterministic (same input twice)", () => JSON.stringify(evaluate(BASE, T)) === JSON.stringify(evaluate(BASE, T)), (r) => r.v === true);

// ---------- RECEIPT PACK (coach.businessProfile, the pack's narrative) ----------
const P = { businessType: "Warung", ownerName: "Rina Fiktif", monthsOperating: 24, supplier: "PT Contoh" };
c("PKG-001 profile text from template B", () => businessProfile(P, reconcile(B.rows, bank)), (r) => !/NaN|undefined/.test(r.v));
c("PKG-002 profile text with zero days", () => businessProfile(P, reconcile([], bank)), (r) => !/NaN|Infinity/.test(r.v));
c("PKG-003 profile text with all-zero sales", () => businessProfile(P, reconcile([{ date: "2026-10-01", channel: "cash", amount: 0, item: "", sig: "z", confidence: 0.9, source: { sheet: "S" } }], bank)), (r) => !/NaN/.test(r.v));
c("PKG-004 no score or percent in pack narrative", () => businessProfile(P, reconcile(A.rows, bank)), (r) => !/skor|score|peluang|\b\d+% persiapan/i.test(r.v));
c("PKG-005 HTML in owner name rendered as text", () => businessProfile({ ...P, ownerName: "<img src=x onerror=alert(1)>" }, reconcile(B.rows, bank)).slice(0, 60), (r) => true);

for (const k of cases) {
  const r = run(k.fn);
  let ok; try { ok = !!k.check(r); } catch { ok = false; }
  console.log(JSON.stringify({ id: k.id, actual: r.err ? { error: r.err } : r.v, ok }));
}
