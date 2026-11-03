"use client";
import Link from "next/link";
import { rp, useStore } from "@/lib/store";
import { businessProfile, KUR_DOCUMENTS, SITE_VISIT } from "@/lib/engine/coach";
import { businessTypeLabel, Icon } from "../ui";

export default function Paket() {
  const { rec, profile, imported, resolutions, now, t, fmtDate, fmtStamp } = useStore();
  const STATUS = { cocok: t("Cocok", "Matches"), selisih: t("Selisih", "Difference"), cek: t("Perlu dicek", "Worth a look"), menunggu: t("Belum bisa dicek", "Can't check yet") };

  if (!rec || !imported) {
    return (
      <>
        <h1 className="title">{t("Paket bukti penjualan", "Sales evidence pack")}</h1>
        <div className="empty-state">
          <b>{t("Paket dibuat dari catatan yang sudah dicocokkan", "The pack is built from matched records")}</b>
          <p>{t(
            "Impor Excel dan mutasi rekening dulu, lalu cek setiap selisih. Paket ini hanya menyusun yang kamu catat, tidak menambah atau mengubah angka.",
            "Import your Excel and bank statement first, then check every difference. The pack only organises what you recorded; it never adds or changes a number.")}</p>
          <div className="btn-row"><Link className="btn" href="/impor"><Icon name="upload" />{t("Impor sekarang", "Import now")}</Link></div>
        </div>
      </>
    );
  }

  const cash = rec.days.reduce((s, d) => s + d.cash, 0);
  const qris = rec.days.reduce((s, d) => s + d.qris, 0);
  const months = [...new Set(rec.days.map((d) => d.date.slice(0, 7)))].map((m) => {
    const ds = rec.days.filter((d) => d.date.startsWith(m));
    return { m, cash: ds.reduce((s, d) => s + d.cash, 0), qris: ds.reduce((s, d) => s + d.qris, 0), cocok: ds.filter((d) => d.status === "cocok").length, n: ds.length };
  });
  const cellsFor = (date: string) => imported.rows.filter((r) => r.date === date && r.channel !== "expense").map((r) => r.source.cell);
  const open = rec.flags.filter((f) => !resolutions[f.id]).length;
  const synthetic = /owner_recap_template|bank_statement_sample/.test(imported.excelFile + imported.bankFile);
  const name = profile.businessName || t("Usaha", "Business");
  const type = businessTypeLabel(t, profile.businessType);

  return (
    <>
      <div className="no-print">
        <h1 className="title">{t("Paket bukti penjualan", "Sales evidence pack")}</h1>
        <p className="sub">{t(
          "Ini yang dibaca petugas bank. Setiap angka harian menunjuk ke sel Excel dan baris mutasi rekening, jadi petugas bisa mengambil sampel dalam hitungan menit.",
          "This is what the bank officer reads. Every daily figure points to its Excel cell and bank statement line, so the officer can sample it in minutes.")}</p>
        {open > 0 && (
          <div className="note"><Icon name="alert" /><span>{t(
            `Masih ada ${open} selisih yang belum kamu jelaskan. Paket tetap bisa dicetak, tapi selisihnya akan tertulis “belum dijelaskan”.`,
            `${open} differences are not explained yet. You can still print the pack, but they will show as “not explained”.`)} <Link href="/cocokkan">{t("Cek sekarang", "Check now")}</Link></span></div>
        )}
        <div className="btn-row">
          <button className="btn" onClick={() => window.print()}><Icon name="print" />{t("Cetak atau simpan PDF", "Print or save as PDF")}</button>
        </div>
        <p className="small" style={{ marginTop: 8 }}>{t(
          "Paket hanya keluar dari HP ini kalau kamu sendiri yang menyimpan atau membagikannya.",
          "The pack only leaves this phone if you save or share it yourself.")}</p>
      </div>

      <article className="section" aria-label={t("Isi paket", "Pack contents")}>
        <header className="pack-head">
          <div className="brand-line"><span>Jejak · {t("Paket bukti penjualan", "Sales evidence pack")}</span><span>{fmtDate(rec.days[0].date)}–{fmtDate(rec.days.at(-1)!.date, { day: "numeric", month: "short", year: "numeric" })}</span></div>
          <h2 className="title" style={{ marginTop: 8 }}>{name}</h2>
          <p className="small">{type}{profile.ownerName ? ` · ${t("Pemilik", "Owner")}: ${profile.ownerName}` : ""} · {t(`Berjalan ${profile.monthsOperating} bulan`, `Running for ${profile.monthsOperating} months`)}</p>
          {synthetic && <p className="small" style={{ color: "var(--merah)", fontWeight: 700 }}>{t("Contoh dengan data sintetis, bukan catatan usaha sungguhan.", "A sample with synthetic data, not real business records.")}</p>}
        </header>

        <div className="section">
          <h2>{t("Profil usaha", "Business profile")}</h2>
          <p style={{ maxWidth: "65ch" }}>{businessProfile({ businessType: type, ownerName: profile.ownerName || t("pemilik", "the owner"), monthsOperating: profile.monthsOperating, supplier: profile.supplier }, rec, t)}</p>
          <div className="totals">
            <div><small>{t("Total penjualan", "Total sales")}</small><b>{rp(cash + qris)}</b></div>
            <div><small>{t("Tunai", "Cash")}</small><b>{rp(cash)}</b></div>
            <div><small>QRIS</small><b>{rp(qris)}</b></div>
          </div>
        </div>

        <div className="section">
          <h2>{t("Total per bulan", "Totals per month")}</h2>
          <table className="tbl">
            <thead><tr><th>{t("Bulan", "Month")}</th><th className="num">{t("Tunai", "Cash")}</th><th className="num">QRIS</th><th className="num">{t("Hari cocok", "Days matched")}</th></tr></thead>
            <tbody>{months.map((x) => (
              <tr key={x.m}><td>{fmtDate(x.m + "-01", { month: "long", year: "numeric" })}</td><td className="num">{rp(x.cash)}</td><td className="num">{rp(x.qris)}</td><td className="num">{x.cocok}/{x.n}</td></tr>
            ))}</tbody>
          </table>
        </div>

        <div className="section">
          <h2>{t("Penjualan harian dan buktinya", "Daily sales and their evidence")}</h2>
          <p className="small" style={{ marginBottom: 8 }}>{t(
            "QRIS cair H+1 kerja (Jumat–Minggu cair Senin) setelah potongan. Tunai disetor mingguan, jadi dicocokkan per minggu.",
            "QRIS is paid out the next working day (Friday–Sunday on Monday), net of the fee. Cash is deposited weekly, so it is matched per week.")}</p>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>{t("Tanggal", "Date")}</th><th className="num">{t("Tunai", "Cash")}</th><th className="num">QRIS</th><th>{t("Baris mutasi", "Statement lines")}</th><th>{t("Sel Excel", "Excel cells")}</th><th>Status</th></tr></thead>
            <tbody>{rec.days.map((d) => (
              <tr key={d.date}>
                <td>{fmtDate(d.date)}</td>
                <td className="num">{rp(d.cash)}</td>
                <td className="num">{rp(d.qris)}</td>
                <td>{d.bank.map((b) => b.line).join(", ") || "—"}</td>
                <td>{cellsFor(d.date).join(", ")}</td>
                <td className={`st-${d.status}`}>{d.flags.length && d.flags.every((id) => resolutions[id]) ? t("Dijelaskan", "Explained") : STATUS[d.status]}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </div>

        <div className="section">
          <h2>{t("Selisih dan penjelasan pemilik", "Differences and the owner's explanations")}</h2>
          {rec.flags.length === 0 ? <p>{t("Tidak ada selisih antara Excel dan mutasi rekening.", "No differences between the Excel and the bank statement.")}</p> : (
            <table className="tbl">
              <tbody>{rec.flags.map((f) => {
                const r = resolutions[f.id];
                return (
                  <tr key={f.id}>
                    <td><b>{f.title}</b><br /><span className="small">{f.detail}</span></td>
                    <td style={{ width: "40%" }}>{r
                      ? <>{r.kind === "betulkan" ? t("Excel akan dibetulkan", "Excel will be fixed") : t("Penjelasan", "Explanation")}: {r.note || t("(tanpa catatan)", "(no note)")}<br /><span className="small">{t("Dicatat", "Recorded")} {fmtStamp(r.at)}</span></>
                      : <span style={{ color: "var(--merah)", fontWeight: 700 }}>{t("Belum dijelaskan", "Not explained")}</span>}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          )}
        </div>

        <div className="section">
          <h2>{t("Transaksi bukan usaha (disisihkan)", "Non-business transactions (set aside)")}</h2>
          <table className="tbl"><tbody>{rec.excluded.map((b) => (
            <tr key={b.line}><td>{fmtDate(b.date)}</td><td>{b.desc}</td><td className="num">{b.dir === "DB" ? "−" : ""}{rp(b.amount)}</td><td>{t("baris", "line")} {b.line}</td></tr>
          ))}</tbody></table>
        </div>

        <div className="section">
          <h2>{t("Kontak yang bisa dihubungi", "Contact the officer can call")}</h2>
          <p>{profile.supplier
            ? <>{t("Supplier utama", "Main supplier")}: <b>{profile.supplier}</b>{profile.supplierPhone ? `, ${profile.supplierPhone}` : ""}</>
            : <span className="small">{t("Belum diisi. Tambahkan di langkah Kenalan.", "Not filled in yet. Add it on the About step.")}</span>}</p>
        </div>

        <p className="small section">{t(
          `Disusun dari ${imported.excelFile} dan ${imported.bankFile}. Jejak hanya menyusun catatan pemilik dan tidak membuat atau mengubah angka. Dokumen ini bukan penilaian kredit.`,
          `Built from ${imported.excelFile} and ${imported.bankFile}. Jejak only organises the owner's records and never creates or changes a number. This document is not a credit assessment.`)} {now && <>{t("Dicetak", "Printed")} {fmtStamp(now, { dateStyle: "long", timeStyle: "short" })}.</>}</p>
      </article>

      <div className="no-print">
        <div className="section">
          <h2>{t("Dokumen yang dibawa ke bank", "Documents to bring to the bank")}</h2>
          <ul className="checklist">{KUR_DOCUMENTS(t).map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
        <div className="section">
          <h2>{t("Siap-siap kunjungan petugas", "Getting ready for the officer's visit")}</h2>
          <ul className="checklist">{SITE_VISIT(t).map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      </div>
    </>
  );
}
