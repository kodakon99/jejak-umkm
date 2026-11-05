// Run: npm test. Uses the synthetic sample files in the project root.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { readExcel, readBankCsv, readBankPdf, type PdfText } from "./read.ts";
import { reconcile } from "./reconcile.ts";
import { evaluate, type Answers } from "./gates.ts";
import { actionPlan } from "./coach.ts";
import { mentions, partnerActivity } from "./partners.ts";
import * as XLSX from "xlsx";

const root = new URL("../../../", import.meta.url);
const file = (f: string) => readFileSync(new URL(f, root));
const bank = readBankCsv("bank_statement_sample.csv", file("bank_statement_sample.csv").toString("utf8"));
const A = readExcel("owner_recap_templateA.xlsx", file("owner_recap_templateA.xlsx"));
const B = readExcel("owner_recap_templateB.xlsx", file("owner_recap_templateB.xlsx"));

test("template A: finds exactly the three planted errors", () => {
  const rec = reconcile(A.rows, bank);
  const selisih = rec.flags.filter((f) => f.severity === "selisih").map((f) => `${f.kind}@${f.dates.join(",")}`).sort();
  assert.deepEqual(selisih, ["blank@2026-10-19", "duplicate@2026-10-23", "qris_mismatch@2026-10-12"]);
  const cash = rec.flags.filter((f) => f.kind === "cash_week");
  assert.equal(cash.length, 1);
  assert.ok(cash[0].dates.includes("2026-10-19") && cash[0].dates.includes("2026-10-25"));
  const qris = rec.flags.find((f) => f.kind === "qris_mismatch")!;
  assert.equal(qris.excel[0].cell, "C13");
  assert.equal(qris.bank?.line, 13);
});

test("template B: clean control raises no flags", () => {
  const rec = reconcile(B.rows, bank);
  assert.deepEqual(rec.flags, []);
  assert.deepEqual(rec.pending, ["2026-10-30", "2026-10-31"]);
});

test("template B: extracted daily sales match the ground truth exactly", () => {
  const truth = file("ground_truth_ledger.csv").toString("utf8").trim().split("\n").slice(1).map((l) => l.split(","));
  let hit = 0;
  for (const [date, channel, amount] of truth) {
    const got = B.rows.filter((r) => r.date === date && r.channel === channel).reduce((s, r) => s + (r.amount ?? 0), 0);
    if (got === Number(amount)) hit++;
  }
  assert.equal(hit, truth.length, `accuracy ${hit}/${truth.length}`);
});

test("bank: personal, family, fee and interest lines are excluded from business", () => {
  const rec = reconcile(B.rows, bank);
  assert.deepEqual(rec.excluded.map((b) => b.kind).sort(), ["fee", "interest", "personal", "personal"]);
});

// ---------- one test per gate ----------
const TODAY = "2026-10-30";
const clean: Answers = {
  slikOwner: "bersih", hasSpouse: true, slikSpouse: "bersih", onlineLoans: "tidak_ada", productiveLoans: "tidak_ada",
  dhn: false, sipp: false, nib: true, monthsOperating: 24, statementMonths: 6, loanAmount: 25_000_000,
  hasFixedAsset: false, reconciledMonths: 3, openFlags: 0,
};
const gate = (over: Partial<Answers>, id: string) => evaluate({ ...clean, ...over }, TODAY).gates.find((g) => g.id === id)!;

test("all clean → siap", () => assert.equal(evaluate(clean, TODAY).overall, "siap"));

test("gate slik_owner", () => {
  const g = gate({ slikOwner: "kol2", slikOwnerBadUntil: "2026-08-15" }, "slik_owner");
  assert.equal(g.status, "blokir");
  assert.equal(g.readyDate, "2027-02-15");
  assert.equal(gate({ slikOwner: "kol2", slikOwnerBadUntil: "2026-03-01" }, "slik_owner").status, "lulus");
  assert.equal(gate({ slikOwner: "belum_cek" }, "slik_owner").status, "hati");
  assert.ok(!gate({ slikOwner: "belum_cek" }, "slik_owner").advice.includes("Lunasi"), "unchecked SLIK must not assume arrears");
});
test("gate slik_spouse", () => {
  assert.equal(gate({ slikSpouse: "kol2", slikSpouseBadUntil: "2026-10-01" }, "slik_spouse").status, "blokir");
  assert.equal(gate({ slikSpouse: "belum_cek" }, "slik_spouse").status, "hati");
  assert.equal(gate({ hasSpouse: false, slikSpouse: "kol2" }, "slik_spouse").status, "lulus");
});
test("gate online_loans", () => {
  assert.equal(gate({ onlineLoans: "telat" }, "online_loans").status, "blokir");
  assert.equal(gate({ onlineLoans: "lancar" }, "online_loans").status, "hati");
});
test("gate productive_loans", () => {
  assert.equal(gate({ productiveLoans: "aktif_bank" }, "productive_loans").status, "blokir");
  assert.equal(gate({ productiveLoans: "beberapa_kecil" }, "productive_loans").status, "hati");
});
test("gate dhn", () => assert.equal(gate({ dhn: true }, "dhn").status, "blokir"));
test("gate sipp", () => assert.equal(gate({ sipp: true }, "sipp").status, "blokir"));
test("gate nib", () => assert.equal(gate({ nib: false }, "nib").status, "blokir"));
test("gate operating", () => {
  const g = gate({ monthsOperating: 4 }, "operating");
  assert.equal(g.status, "blokir");
  assert.equal(g.readyDate, "2026-12-30");
  assert.equal(gate({ monthsOperating: 8 }, "operating").status, "hati");
});
test("gate statements", () => assert.equal(gate({ statementMonths: 1 }, "statements").status, "blokir"));
test("gate sales_evidence", () => {
  assert.equal(gate({ reconciledMonths: 1 }, "sales_evidence").status, "hati");
  assert.equal(gate({ openFlags: 2 }, "sales_evidence").status, "hati");
});
test("gate collateral (provisional caution, never a block)", () => {
  assert.equal(gate({ loanAmount: 150_000_000 }, "collateral").status, "hati");
  assert.equal(gate({ loanAmount: 150_000_000, hasFixedAsset: true }, "collateral").status, "lulus");
});

test("overall: latest dated blocker sets the ready date; plan puts fix-now blockers first", () => {
  const r = evaluate({ ...clean, monthsOperating: 4, slikOwner: "kol2", slikOwnerBadUntil: "2026-09-01", nib: false, onlineLoans: "lancar" }, TODAY);
  assert.equal(r.overall, "belum_siap");
  assert.equal(r.readyDate, "2027-03-01");
  assert.equal(r.undatedBlockers, 1);
  assert.deepEqual(actionPlan(r).map((s) => s.gate.id), ["nib", "slik_owner", "operating", "online_loans"]);
});

test("progress: percent counts passed gates but never overrides a blocker", () => {
  const all = evaluate(clean, TODAY);
  assert.deepEqual([all.passed, all.percent], [11, 100]);
  const r = evaluate({ ...clean, nib: false }, TODAY);
  assert.deepEqual([r.passed, r.percent, r.overall], [10, 91, "belum_siap"]);
});

test("wording guardrail: no gate ever says approved", () => {
  const text = JSON.stringify(evaluate({ ...clean, slikOwner: "kol2" }, TODAY)).toLowerCase();
  for (const banned of ["disetujui", "eligible", "approved", "dijamin lolos"]) assert.ok(!text.includes(banned), banned);
});

// ---------- QA regressions (qa/Jejak_API_QA_Assessment_v0_1.md) ----------
const book = (aoa: unknown[][]) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Penjualan");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" });
};

test("BUG-01: unreadable dates are skipped and reported, never crash reconcile", () => {
  const x = readExcel("x.xlsx", book([["Tanggal", "Tunai", "QRIS"], ["10/31/2026", 1000, 1000], ["13/13/2026", 1, 1], ["31/02/2026", 1, 1], ["TOTAL", 3, 3]]));
  assert.equal(x.rows.length, 0);
  assert.deepEqual(x.skipped.map((s) => s.cell), ["A2", "A3", "A4"]);
  assert.doesNotThrow(() => reconcile(x.rows, bank));
});

test("BUG-02: a statement with no deposits confirms no cash day", () => {
  const rows = B.rows.filter((r) => r.channel === "cash");
  const rec = reconcile(rows, bank.filter((b) => b.kind !== "cash_deposit"));
  assert.equal(rec.days.filter((d) => d.status === "cocok").length, 0);
});

test("BUG-03: semicolon CSV reads the same as the comma sample", () => {
  const head = file("bank_statement_sample.csv").toString("utf8").split("\n").slice(0, 4);
  const semi = head.map((l) => l.replace(/"([^"]*)"/g, (_, v) => v.replace(/,/g, "")).replace(/,/g, ";")).join("\n");
  const pick = (b: typeof bank) => b.map((l) => [l.kind, l.amount, l.dir]);
  assert.deepEqual(pick(readBankCsv("s.csv", semi)), pick(bank.slice(0, 3)));
});

test("BUG-04: text in a sales cell is a blank, not Rp0", () => {
  const x = readExcel("x.xlsx", book([["Tanggal", "Tunai", "QRIS"], ["01/10/2026", "libur", 5000]]));
  assert.equal(x.rows.find((r) => r.channel === "cash")!.amount, null);
  assert.ok(reconcile(x.rows, bank).flags.some((f) => f.kind === "blank" && f.dates.includes("2026-10-01")));
});

// ---------- language switch: English changes words, never results ----------
test("English output keeps every status, date and flag id, and never promises approval", () => {
  const answers = { ...clean, monthsOperating: 4, nib: false, onlineLoans: "lancar" as const, slikOwner: "kol2" as const };
  const strip = (r: ReturnType<typeof evaluate>) => r.gates.map((g) => [g.id, g.status, g.readyDate]);
  const id = evaluate(answers, TODAY), en = evaluate(answers, TODAY, "en");
  assert.deepEqual(strip(en), strip(id));
  assert.equal(en.overall, id.overall);
  assert.notEqual(en.gates[0].reason, id.gates[0].reason);
  const recId = reconcile(A.rows, bank), recEn = reconcile(A.rows, bank, "en");
  assert.deepEqual(recEn.flags.map((f) => f.id), recId.flags.map((f) => f.id));
  assert.deepEqual(recEn.days.map((d) => d.status), recId.days.map((d) => d.status));
  const text = JSON.stringify([en, recEn.flags]).toLowerCase();
  for (const banned of ["approved", "eligible", "guaranteed"]) assert.ok(!text.includes(banned), banned);
});

// ---------- PDF e-Statement reads the same as its CSV twin ----------
// The upload test sets live in the local-only "sample document/" folder (gitignored); skip where it's absent, e.g. CI.
const noTestSets = !existsSync(new URL("sample document/Test 2 - Selisih/", root)) && "sample document/ test sets not present";

async function readPdf(path: string) {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await getDocument({ data: new Uint8Array(file(path)) }).promise;
  const pages: PdfText[][] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const { items } = await (await doc.getPage(p)).getTextContent();
    pages.push(items.flatMap((i) => ("str" in i ? [{ str: i.str, x: i.transform[4], y: i.transform[5] }] : [])));
  }
  return readBankPdf(path, pages);
}

test("PDF e-Statement: every transaction matches the CSV export", { skip: noTestSets }, async () => {
  const dir = "sample document/Test 2 - Selisih/";
  // CSV reader drops cents (87.61 -> 87); the PDF keeps them, so compare whole rupiah.
  const pick = (b: ReturnType<typeof readBankCsv>) => b.map((l) => [l.date, l.desc, Math.trunc(l.amount), l.dir, l.kind, l.covers]);
  const csv = readBankCsv("m.csv", file(dir + "mutasi_Okt2026_selisih.csv").toString("utf8")).filter((l) => l.kind !== "opening");
  const pdf = await readPdf(dir + "e-Statement_Okt2026_selisih.pdf");
  assert.deepEqual(pick(pdf), pick(csv));
  assert.deepEqual(pdf.map((l) => l.line), csv.map((_, i) => i + 1)); // line = the statement's No column
});

// ---------- upload test sets: Test 1 is clean, Test 2 has every planted case (see KUNCI_JAWABAN.md) ----------
const testSet = async (dir: string, tag: string) =>
  reconcile(readExcel("x.xlsx", file(`sample document/${dir}/Laporan_Keuangan_Warung_Okt2026_${tag}.xlsx`)).rows,
    await readPdf(`sample document/${dir}/e-Statement_Okt2026_${tag}.pdf`));

test("Test 1 - Cocok: Excel and PDF statement agree, no flags", { skip: noTestSets }, async () => {
  assert.deepEqual((await testSet("Test 1 - Cocok", "cocok")).flags, []);
});

test("Test 2 - Selisih: duplicate, blank, unusual, bank-only and Excel-only are all flagged", { skip: noTestSets }, async () => {
  const rec = await testSet("Test 2 - Selisih", "selisih");
  const got = rec.flags.map((f) => `${f.kind}@${f.dates.length > 1 ? f.dates[0] + ".." : f.dates[0]}`).sort();
  assert.deepEqual(got, [
    "bank_duplicate@2026-10-22", // QR payment posted twice
    "bank_only@2026-10-08", // buyer's transfer, noted in Excel but not in sales
    "bank_only@2026-10-17", // Rp15jt in from an unknown sender
    "bank_only@2026-10-29", // buyer's second transfer
    "blank@2026-10-21",
    "cash_week@2026-10-05..", "cash_week@2026-10-19..",
    "duplicate@2026-10-23",
    "qris_mismatch@2026-10-14", // Excel-only: Rp300rb more than the bank
    "qris_missing@2026-10-07", // Excel-only: no settlement at all
    "supplier_unmatched@2026-10-13", "supplier_unmatched@2026-10-20", "supplier_unmatched@2026-10-22",
    "unusual@2026-10-09", "unusual@2026-10-17", "unusual@2026-10-28",
  ]);
  assert.match(rec.flags.find((f) => f.id.startsWith("sup-") && f.dates[0] === "2026-10-13")!.detail, /1\.260\.000/); // points at the typo
});

test("supplier typo hint points at the closest unpaid expense, not the first nearby one", () => {
  const exp = (date: string, item: string, amount: number, cell: string) =>
    ({ date, channel: "expense", amount, item, source: { file: "x.xlsx", sheet: "Pengeluaran", cell }, sig: cell, confidence: 1 }) as const;
  const debit = (line: number, date: string, desc: string, amount: number) =>
    ({ line, date, desc, amount, dir: "DB", kind: "supplier", business: true, source: { file: "s.pdf", line } }) as const;
  const rec = reconcile(
    [exp("2026-10-12", "Ayam", 1_000_000, "C2"), exp("2026-10-14", "Telur", 900_000, "C3"), exp("2026-10-13", "Beras", 1_260_000, "C4")],
    [debit(1, "2026-10-12", "TRF KE PT AYAM JAYA", 1_000_000), debit(2, "2026-10-13", "TRF KE CV BERAS MAKMUR", 1_620_000)],
  );
  const sup = rec.flags.filter((f) => f.kind === "supplier_unmatched");
  assert.deepEqual(sup.map((f) => f.excel.map((s) => s.cell)), [["C4"]]); // Ayam is paid by line 1; Beras is closer than Telur
});

// ---------- suppliers and buyers: who the business traded with, on which day ----------
test("partner names match bank wording, including names the bank cut off", () => {
  assert.ok(mentions("Transfer BI Fast Ke BCA PT SUMBER PANGAN JAY 5270318842", "PT. Sumber Pangan Jaya")); // truncated at 20 chars
  assert.ok(mentions("Transfer BI Fast Ke BCA PT SUMBER PANGAN JAY 5270318842", "sumber pangan jaya")); // no PT, lower case
  assert.ok(!mentions("Transfer BI Fast Ke BCA PT SUMBER REJEKI 111", "PT Sumber Pangan Jaya")); // different company
  assert.ok(!mentions("Biaya transfer BI Fast", "PT")); // a legal form alone is not a name
});

test("Test 2 - Selisih: each supplier's transactions, by day and where they were found", { skip: noTestSets }, async () => {
  const dir = "sample document/Test 2 - Selisih/";
  const x = readExcel("x.xlsx", file(dir + "Laporan_Keuangan_Warung_Okt2026_selisih.xlsx"));
  const bank = await readPdf(dir + "e-Statement_Okt2026_selisih.pdf");
  const [sumber, ayam, grosir, kantor] = partnerActivity([
    { name: "PT Sumber Pangan Jaya", role: "supplier", phone: "" },
    { name: "CV Ayam Segar Makmur", role: "supplier", phone: "" },
    { name: "Toko Grosir Makmur", role: "supplier", phone: "" },
    { name: "PT Kantor Maju Bersama", role: "buyer", phone: "" },
  ], bank, x.rows);
  const view = (a: typeof sumber) => a.txns.map((t) => `${t.date} ${t.dir} ${t.amount} ${t.found}`);
  // Oracle: generate_test_documents.py SUPPLIERS + KUNCI_JAWABAN.md (13 Oct typed 1.260.000; 20 Oct and 22 Oct never recorded).
  assert.deepEqual(view(sumber), [
    "2026-10-06 out 1850000 both",
    "2026-10-13 out 1620000 bank",
    "2026-10-13 out 1260000 excel",
    "2026-10-27 out 1780000 both",
  ]);
  assert.deepEqual(view(ayam), ["2026-10-20 out 2140000 bank"]);
  assert.deepEqual(view(grosir), ["2026-10-22 out 487500 bank", "2026-10-22 out 487500 bank"]); // posted twice by the bank
  assert.equal(sumber.totalOut, 1850000 + 1620000 + 1260000 + 1780000);
  // Oracle: BUYER_ORDERS in the generator; the bank cuts the name to "PT KANTOR MAJU BERSA".
  assert.deepEqual(view(kantor), ["2026-10-08 in 2400000 bank", "2026-10-29 in 1850000 bank"]);
  assert.equal(kantor.totalIn, 2400000 + 1850000);
});

test("a buyer's transfer in is listed as money received", () => {
  const line = { line: 7, date: "2026-10-09", desc: "Transfer BI Fast Dari BCA PT KANTOR MAJU BERSAMA 123", amount: 2_400_000, dir: "CR", kind: "supplier", business: true, source: { file: "s.pdf", line: 7 } } as const;
  const [buyer] = partnerActivity([{ name: "PT Kantor Maju Bersama", role: "buyer", phone: "0812" }], [line], []);
  assert.deepEqual(buyer.txns.map((t) => [t.dir, t.amount, t.found, t.bank?.line]), [["in", 2_400_000, "bank", 7]]);
  assert.equal(buyer.totalIn, 2_400_000);
});

test("a payment is never backed by an Excel row that names another partner", () => {
  const debit = (line: number, date: string, desc: string) => ({ line, date, desc, amount: 500_000, dir: "DB", kind: "supplier", business: true, source: { file: "s.pdf", line } } as const);
  const row = (cell: string, date: string, item: string) => ({ date, channel: "expense", amount: 500_000, item, source: { file: "x.xlsx", sheet: "Okt", cell }, sig: cell, confidence: 1 } as const);
  const partners = [{ name: "Toko Alfa Jaya", role: "supplier", phone: "" }, { name: "Toko Beta Sentosa", role: "supplier", phone: "" }] as const;
  // A's 10 Oct transfer was never typed in Excel; the 11 Oct row is B's, and B has no bank line.
  const [a, b] = partnerActivity([...partners], [debit(1, "2026-10-10", "TRF KE TOKO ALFA JAYA")], [row("E5", "2026-10-11", "Bayar Toko Beta Sentosa")]);
  assert.deepEqual(a.txns.map((t) => t.found), ["bank"]);
  assert.deepEqual(b.txns.map((t) => [t.found, t.excel?.cell]), [["excel", "E5"]]);
  // One unnamed row cannot back two partners' payments.
  const [a2, b2] = partnerActivity([...partners], [debit(1, "2026-10-10", "TRF KE TOKO ALFA JAYA"), debit(2, "2026-10-11", "TRF KE TOKO BETA SENTOSA")], [row("E6", "2026-10-11", "Belanja bahan")]);
  assert.deepEqual([...a2.txns, ...b2.txns].map((t) => t.found), ["both", "bank"]);
});
