"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { rp, useStore } from "@/lib/store";
import { Icon } from "../ui";

export default function Impor() {
  const { imported, importFiles, confirmMapping, recError, t } = useStore();
  const router = useRouter();
  const excelRef = useRef<HTMLInputElement>(null);
  const bankRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState({ excel: "", bank: "" });

  const FIELD_LABEL: Record<string, string> = {
    date: t("Tanggal", "Date"), cash: t("Penjualan tunai", "Cash sales"), qris: t("Penjualan QRIS", "QRIS sales"), desc: t("Keterangan", "Description"),
    in: t("Uang masuk", "Money in"), out: t("Uang keluar", "Money out"), amount: t("Jumlah", "Amount"),
  };
  const KIND_LABEL = { sales: t("Penjualan harian", "Daily sales"), kas: t("Buku kas", "Cash book"), expense: t("Pengeluaran", "Expenses") };
  const BANK_LABEL: Record<string, string> = {
    qris: t("Settlement QRIS", "QRIS settlement"), cash_deposit: t("Setoran tunai", "Cash deposit"), supplier: t("Bayar supplier", "Supplier payment"),
    personal: t("Transfer pribadi", "Personal transfer"), fee: t("Biaya admin", "Bank fee"), interest: t("Bunga", "Interest"), other: t("Lainnya", "Other"),
  };

  async function load(get: () => Promise<[{ name: string; data: ArrayBuffer }, { name: string; text: string }]>) {
    setError("");
    setBusy(true);
    try {
      const [x, b] = await get();
      importFiles(x, b);
    } catch (e) {
      setError(t(
        `File tidak bisa dibaca: ${(e as Error).message}. Pastikan Excel berformat .xlsx dan mutasi bank berformat .csv.`,
        `The file couldn't be read: ${(e as Error).message}. Make sure the Excel file is .xlsx and the bank statement is .csv.`));
    } finally {
      setBusy(false);
    }
  }

  const fromInputs = () =>
    load(async () => {
      const x = excelRef.current?.files?.[0];
      const b = bankRef.current?.files?.[0];
      if (!x || !b) throw new Error(t("pilih dua file dulu", "pick both files first"));
      return [{ name: x.name, data: await x.arrayBuffer() }, { name: b.name, text: await b.text() }];
    });

  const fromSample = (template: "A" | "B") =>
    load(async () => {
      const name = `owner_recap_template${template}.xlsx`;
      const [x, b] = await Promise.all([fetch(`/samples/${name}`), fetch("/samples/bank_statement_sample.csv")]);
      if (!x.ok || !b.ok) throw new Error(t("data contoh tidak ditemukan", "sample data not found"));
      return [{ name, data: await x.arrayBuffer() }, { name: "bank_statement_sample.csv", text: await b.text() }];
    });

  const salesRows = imported?.rows.filter((r) => r.channel !== "expense") ?? [];
  const business = imported?.bank.filter((b) => b.business) ?? [];
  const excluded = imported?.bank.filter((b) => !b.business && b.kind !== "opening") ?? [];
  const skipped = imported?.skipped ?? [];
  const canMatch = !!imported && imported.mappings.length > 0 && salesRows.length > 0 && business.length > 0;
  const noFile = t("Belum ada file", "No file yet");
  const skippedCells = skipped.slice(0, 3).map((s) => s.cell).join(", ") + (skipped.length > 3 ? ", …" : "");

  return (
    <>
      <h1 className="title">{t("Impor catatan kamu", "Import your records")}</h1>
      <p className="sub">{t(
        "Tidak perlu ketik ulang. Pakai file Excel yang biasa kamu isi dan mutasi rekening dari m-banking. Template apa pun boleh.",
        "No retyping. Use the Excel file you already fill in and the statement from your mobile banking app. Any template works.")}</p>

      <div className="section">
        <div className="panel">
          <div className="file"><Icon name="file" /><span><b>{t("Rekap Excel", "Excel recap")}</b><br /><span className="small">{picked.excel || noFile}</span></span>
            <label className="btn quiet pick">{t("Pilih file", "Choose file")}<input ref={excelRef} type="file" accept=".xlsx,.xls" onChange={(e) => setPicked((p) => ({ ...p, excel: e.target.files?.[0]?.name ?? "" }))} /></label></div>
        </div>
        <div className="panel">
          <div className="file"><Icon name="bank" /><span><b>{t("Mutasi rekening (CSV)", "Bank statement (CSV)")}</b><br /><span className="small">{picked.bank || noFile}</span></span>
            <label className="btn quiet pick">{t("Pilih file", "Choose file")}<input ref={bankRef} type="file" accept=".csv,text/csv" onChange={(e) => setPicked((p) => ({ ...p, bank: e.target.files?.[0]?.name ?? "" }))} /></label></div>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="btn-row">
          <button className="btn" onClick={fromInputs} disabled={busy}><Icon name="upload" />{busy ? t("Membaca…", "Reading…") : t("Baca file", "Read files")}</button>
        </div>
        <p className="small" style={{ marginTop: 16 }}>{t(
          "Belum punya file? Coba data contoh (data sintetis, warung fiktif Oktober 2026):",
          "No files yet? Try the sample data (synthetic data, a fictional warung, October 2026):")}</p>
        <div className="btn-row" style={{ marginTop: 8 }}>
          <button className="btn quiet" onClick={() => fromSample("A")} disabled={busy}>{t("Contoh dengan 3 kesalahan", "Sample with 3 errors")}</button>
          <button className="btn quiet" onClick={() => fromSample("B")} disabled={busy}>{t("Contoh rapi", "Clean sample")}</button>
        </div>
      </div>

      {recError && <p className="error" role="alert">{t("Pencocokan gagal untuk file ini. Impor ulang file kamu.", "Matching failed for this file. Please import your files again.")}</p>}

      {imported && (
        <div className="section" aria-live="polite">
          <h2>{t("Cek dulu cara kami membaca file kamu", "First, check how we read your files")}</h2>
          <p className="small">{t("Dari", "From")} <b>{imported.excelFile}</b>. {t(
            "Kalau ada kolom yang salah tebak, betulkan nama kolomnya di Excel lalu impor ulang.",
            "If a column was read wrongly, fix its header in Excel and import again.")}</p>
          {imported.mappings.length === 0 && <p className="error">{t(
            "Tidak ada sheet dengan kolom Tanggal. Pastikan ada kolom bernama “Tanggal”.",
            "No sheet has a date column. Make sure one column is named “Tanggal” (date).")}</p>}
          {imported.mappings.map((m) => (
            <div className="panel" key={m.sheet} style={{ marginTop: 12 }}>
              <b>Sheet &ldquo;{m.sheet}&rdquo;</b> <span className="small">· {KIND_LABEL[m.kind]}, {t(`judul kolom di baris ${m.headerRow}`, `headers on row ${m.headerRow}`)}</span>
              <div className="tbl-wrap"><table className="tbl" style={{ marginTop: 8 }}>
                <thead><tr><th>{t("Kolom", "Column")}</th><th>{t("Judul di Excel", "Header in Excel")}</th><th>{t("Dibaca sebagai", "Read as")}</th></tr></thead>
                <tbody>
                  {Object.entries(m.columns).map(([f, c]) => (
                    <tr key={f}><td>{c!.col}</td><td>{c!.header}</td><td>{FIELD_LABEL[f]}</td></tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          ))}
          <p className="small" style={{ marginTop: 12 }}>{t(
            `${salesRows.length} angka penjualan terbaca, ${salesRows.filter((r) => r.amount == null).length} sel penjualan kosong.`,
            `${salesRows.length} sales figures read, ${salesRows.filter((r) => r.amount == null).length} sales cells blank.`)}</p>
          {skipped.length > 0 && (
            <p className="error">{t(
              `${skipped.length} baris dilewati karena tanggalnya tidak terbaca (${skippedCells}). Tulis tanggal sebagai hari/bulan/tahun, misalnya 31/10/2026, lalu impor ulang.`,
              `${skipped.length} rows were skipped because their date couldn't be read (${skippedCells}). Write dates as day/month/year, for example 31/10/2026, then import again.`)}</p>
          )}
          {imported.mappings.length > 0 && salesRows.length === 0 && <p className="error">{t("Tidak ada baris penjualan dengan tanggal yang terbaca.", "No sales rows have a readable date.")}</p>}

          <div className="panel" style={{ marginTop: 12 }}>
            <b>{t("Mutasi rekening", "Bank statement")}</b> <span className="small">· {imported.bankFile}</span>
            {business.length === 0 && <p className="error">{t(
              "Tidak ada setoran tunai, settlement QRIS, atau transfer ke supplier yang terbaca. Pastikan ini file mutasi rekening usaha dari m-banking (CSV).",
              "No cash deposits, QRIS settlements or supplier transfers were found. Make sure this is your business account's statement from mobile banking (CSV).")}</p>}
            <p className="small" style={{ marginTop: 4 }}>{t(
              `${business.length} transaksi usaha dipakai untuk pencocokan. ${excluded.length} transaksi bukan usaha disisihkan:`,
              `${business.length} business transactions are used for matching. ${excluded.length} non-business transactions were set aside:`)}</p>
            <div className="tbl-wrap"><table className="tbl" style={{ marginTop: 8 }}>
              <tbody>
                {excluded.map((b) => (
                  <tr key={b.line}><td>{b.desc}<br /><span className="small">{BANK_LABEL[b.kind]} · {t("baris", "line")} {b.line}</span></td><td className="num">{b.dir === "DB" ? "−" : ""}{rp(b.amount)}</td></tr>
                ))}
              </tbody>
            </table></div>
          </div>

          <div className="btn-row">
            <button className="btn" disabled={!canMatch} onClick={() => { confirmMapping(); router.push("/cocokkan"); }}>
              {imported.confirmed ? t("Lihat pencocokan", "See the matching") : t("Benar, cocokkan sekarang", "Looks right, match now")} <Icon name="arrow" />
            </button>
          </div>
        </div>
      )}

      {!imported && (
        <p className="small" style={{ marginTop: 24 }}>{t("Sudah impor sebelumnya?", "Already imported?")} <Link href="/cocokkan">{t("Lihat pencocokan", "See the matching")}</Link></p>
      )}
    </>
  );
}
