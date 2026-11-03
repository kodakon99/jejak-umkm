"use client";
import Link from "next/link";
import { useState } from "react";
import { rp, useStore, type Resolution } from "@/lib/store";
import type { T } from "@/lib/i18n";
import type { Flag, Reconciliation } from "@/lib/engine/reconcile";
import { Icon } from "../ui";

type Day = Reconciliation["days"][number];
type CellState = Day["status"] | "dijelaskan" | "none";

const STATE_TEXT = (t: T): Record<CellState, string> => ({
  cocok: t("cocok dengan bank", "matches the bank"), selisih: t("ada selisih", "has a difference"), cek: t("perlu dicek", "worth a look"),
  menunggu: t("belum bisa dicek", "can't be checked yet"), dijelaskan: t("sudah kamu jelaskan", "explained by you"), none: t("tidak ada catatan", "no records"),
});
const DOW = (t: T) => [t("Sen", "Mon"), t("Sel", "Tue"), t("Rab", "Wed"), t("Kam", "Thu"), t("Jum", "Fri"), t("Sab", "Sat"), t("Min", "Sun")];

export default function Cocokkan() {
  const { rec, recError, resolutions, openFlags, imported, t, fmtDate } = useStore();
  const stateText = STATE_TEXT(t);
  const [picked, setPicked] = useState<string | null>(null);

  if (!rec || rec.days.length === 0) {
    return (
      <>
        <h1 className="title">{t("Cocokkan Excel dengan bank", "Match Excel with the bank")}</h1>
        <div className="empty-state">
          <b>{recError ? t("Pencocokan gagal untuk file ini", "Matching failed for this file") : t("Belum ada catatan yang diimpor", "No records imported yet")}</b>
          <p>{t(
            "Impor rekap Excel dan mutasi rekening dulu. Kami cocokkan setiap hari penjualan dengan uang yang benar-benar masuk ke bank.",
            "Import your Excel recap and bank statement first. We match every sales day with the money that actually reached the bank.")}</p>
          <div className="btn-row"><Link className="btn" href="/impor"><Icon name="upload" />{t("Impor sekarang", "Import now")}</Link></div>
        </div>
      </>
    );
  }

  const flagById = new Map(rec.flags.map((f) => [f.id, f]));
  const state = (d: Day): CellState =>
    d.flags.length && d.flags.every((id) => resolutions[id]) ? "dijelaskan" : d.status;
  const byDate = new Map(rec.days.map((d) => [d.date, d]));
  const cocok = rec.days.filter((d) => d.status === "cocok").length;
  const firstOpen = rec.days.find((d) => d.flags.some((id) => !resolutions[id]))?.date;
  const selected = byDate.get(picked ?? firstOpen ?? rec.days[0].date)!;
  const months = [...new Set(rec.days.map((d) => d.date.slice(0, 7)))];

  return (
    <>
      <div className="lead"><b>{cocok}/{rec.days.length}</b><span>{t("hari cocok dengan bank", "days match the bank")}</span></div>
      <p className="sub">
        {openFlags ? t(`${openFlags} catatan perlu kamu cek.`, `${openFlags} items need your check.`) : t("Semua catatan sudah kamu cek. Paket bukti siap dibuat.", "You've checked every item. The evidence pack is ready to make.")}
      </p>

      {months.map((m) => {
        const first = new Date(m + "-01T00:00:00Z");
        const lead = (first.getUTCDay() + 6) % 7;
        const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
        return (
          <section key={m} aria-label={fmtDate(m + "-01", { month: "long", year: "numeric" })} style={{ marginTop: 8 }}>
            <h2 className="small" style={{ fontWeight: 700, marginBottom: 6 }}>{fmtDate(m + "-01", { month: "long", year: "numeric" })}</h2>
            <div className="month">
              {DOW(t).map((d) => <div className="dow" key={d}>{d}</div>)}
              {Array.from({ length: lead }, (_, i) => <span className="cell empty" key={`e${i}`} />)}
              {Array.from({ length: count }, (_, i) => {
                const iso = `${m}-${String(i + 1).padStart(2, "0")}`;
                const d = byDate.get(iso);
                const s: CellState = d ? state(d) : "none";
                return (
                  <button key={iso} className={`cell ${s}`} disabled={!d} aria-pressed={d === selected}
                    aria-label={`${fmtDate(iso, { day: "numeric", month: "long" })}, ${stateText[s]}`} onClick={() => setPicked(iso)}>
                    {i + 1}
                    {d && s === "selisih" && d.flags.length > 1 && <small>{d.flags.length}</small>}
                    {s === "dijelaskan" && <Icon name="check" />}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      <div className="legend" aria-hidden>
        <span><i className="mark cocok" />{t("Cocok", "Matches")}</span>
        <span><i className="mark selisih" />{t("Selisih", "Difference")}</span>
        <span><i className="mark cek" />{t("Perlu dicek", "Worth a look")}</span>
        <span><i className="mark dijelaskan" />{t("Sudah dijelaskan", "Explained")}</span>
        <span><i className="mark menunggu" />{t("Belum bisa dicek", "Can't check yet")}</span>
      </div>

      <DayDetail key={selected.date} day={selected} flags={selected.flags.map((id) => flagById.get(id)!)} pending={rec.pending.includes(selected.date)} />

      <div className="btn-row">
        <Link className="btn" href="/paket"><Icon name="print" />{t("Buat paket bukti", "Make the evidence pack")}</Link>
        <Link className="btn ghost" href="/impor">{t("Impor ulang", "Import again")}</Link>
      </div>
      <p className="small" style={{ marginTop: 16 }}>{t(
        `Sumber: ${imported?.excelFile} dan ${imported?.bankFile}. Tidak ada yang kami ubah di Excel kamu; kamu yang memutuskan.`,
        `Sources: ${imported?.excelFile} and ${imported?.bankFile}. We changed nothing in your Excel; you decide.`)}</p>
    </>
  );
}

function DayDetail({ day, flags, pending }: { day: Day; flags: Flag[]; pending: boolean }) {
  const { resolutions, t, fmtDate } = useStore();
  const stateText = STATE_TEXT(t);
  const qrisLine = day.bank.find((b) => b.kind === "qris");
  const cashLine = day.bank.find((b) => b.kind === "cash_deposit");
  const resolvedAll = flags.length > 0 && flags.every((f) => resolutions[f.id]);

  return (
    <article className="day" aria-live="polite">
      <div className="day-head">
        <h2>{fmtDate(day.date, { weekday: "long", day: "numeric", month: "long" })}</h2>
        <span className="small">{resolvedAll ? stateText.dijelaskan : stateText[day.status]}</span>
      </div>
      {flags.map((f) => <FlagItem key={f.id} flag={f} />)}
      <div className="amounts">
        <div><small>{t("Tunai di Excel", "Cash in Excel")}</small><b>{rp(day.cash)}</b></div>
        <div><small>{t("QRIS di Excel", "QRIS in Excel")}</small><b>{rp(day.qris)}</b></div>
      </div>
      <div className="src">
        {qrisLine && <span><Icon name="bank" />{t("QRIS cair", "QRIS paid out")} {fmtDate(qrisLine.date)} · {rp(qrisLine.amount)} · {t("baris", "line")} {qrisLine.line}</span>}
        {cashLine && <span><Icon name="bank" />{t("Setoran tunai", "Cash deposit")} {fmtDate(cashLine.date)} · {rp(cashLine.amount)} · {t("baris", "line")} {cashLine.line}</span>}
      </div>
      {flags.length === 0 && day.status === "cocok" && <p style={{ marginTop: 12 }}>{t("QRIS hari ini sudah cair di bank sesuai catatan, dan tunainya masuk setoran minggu itu.", "This day's QRIS was paid out by the bank as recorded, and its cash is in that week's deposit.")}</p>}
      {flags.length === 0 && day.status === "menunggu" && (
        <p style={{ marginTop: 12 }}>{pending
          ? t("QRIS hari ini baru cair setelah periode mutasi ini. Impor mutasi bulan berikutnya untuk mengeceknya.", "This day's QRIS is paid out after this statement ends. Import next month's statement to check it.")
          : t("Tunai hari ini belum disetor ke bank, jadi belum bisa dicocokkan.", "This day's cash hasn't been deposited yet, so it can't be matched.")}</p>
      )}
    </article>
  );
}

function FlagItem({ flag }: { flag: Flag }) {
  const { resolutions, resolve, t, fmtStamp } = useStore();
  const done = resolutions[flag.id];
  const [mode, setMode] = useState<Resolution["kind"] | null>(null);
  const [note, setNote] = useState("");

  return (
    <div className={`flag ${done ? "done" : flag.severity}`}>
      <h3><Icon name={done ? "check" : "alert"} />{flag.title}</h3>
      <p>{flag.detail}</p>
      <div className="src">
        {flag.excel.slice(0, 4).map((s) => <span key={s.cell}><Icon name="file" />{s.sheet} {s.cell}</span>)}
        {flag.excel.length > 4 && <span>{t(`+${flag.excel.length - 4} sel lagi`, `+${flag.excel.length - 4} more cells`)}</span>}
        {flag.bank && <span><Icon name="bank" />{t("Mutasi baris", "Statement line")} {flag.bank.line}</span>}
      </div>
      {done ? (
        <div className="resolved">
          <b>{done.kind === "betulkan" ? t("Akan kamu betulkan di Excel", "You'll fix this in Excel") : t("Penjelasan kamu", "Your explanation")}:</b> {done.note || t("(tanpa catatan)", "(no note)")}
          <br /><span>{t("Dicatat", "Recorded")} {fmtStamp(done.at)}. </span>
          <button className="linkish" onClick={() => resolve(flag.id, null)}>{t("Batalkan", "Undo")}</button>
        </div>
      ) : mode ? (
        <div>
          <label className="field">
            <span>{mode === "betulkan" ? t("Apa yang salah di Excel?", "What's wrong in the Excel?") : t("Jelaskan untuk petugas bank", "Explain it for the bank officer")}</span>
            <textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} autoFocus
              placeholder={mode === "betulkan" ? t("Contoh: salah ketik, harusnya Rp175.000", "e.g. a typo, it should be Rp175.000") : t("Contoh: ada pembeli bayar QRIS ke rekening suami", "e.g. a customer paid by QRIS into my husband's account")} />
          </label>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button className="btn" onClick={() => resolve(flag.id, { kind: mode, note: note.trim() })}>{t("Simpan", "Save")}</button>
            <button className="btn quiet" onClick={() => setMode(null)}>{t("Batal", "Cancel")}</button>
          </div>
        </div>
      ) : (
        <>
          <p className="ask">{flag.question}</p>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button className="btn" onClick={() => setMode("betulkan")}>{t("Excel salah, betulkan", "Excel is wrong, fix it")}</button>
            <button className="btn ghost" onClick={() => setMode("jelaskan")}>{t("Jelaskan", "Explain")}</button>
          </div>
        </>
      )}
    </div>
  );
}
