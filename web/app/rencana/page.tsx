"use client";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { actionPlan, IF_REJECTED } from "@/lib/engine/coach";
import { Icon, VERDICT } from "../ui";

const long = { day: "numeric", month: "long", year: "numeric" } as const;

export default function Rencana() {
  const { readiness, t, fmtDate } = useStore();
  const steps = actionPlan(readiness);
  const [first, ...rest] = steps;
  const earliest = (iso: string) => t(`Paling cepat ${fmtDate(iso, long)}`, `Earliest ${fmtDate(iso, long)}`);

  return (
    <>
      <h1 className="title">{VERDICT(t)[readiness.overall]}</h1>
      <p className="progress-line">{t(
        `${readiness.passed} dari ${readiness.gates.length} syarat lolos · ${readiness.percent}% persiapan`,
        `${readiness.passed} of ${readiness.gates.length} requirements passed · ${readiness.percent}% prepared`)}</p>
      <p className="sub">
        {steps.length === 0
          ? t("Semua syarat lolos. Siapkan dokumen dan paket bukti penjualan, lalu ajukan.", "Every requirement passes. Prepare your documents and the sales evidence pack, then apply.")
          : t(`${steps.length} hal perlu dibereskan, diurutkan dari yang paling menentukan.`, `${steps.length} things to fix, starting with the one that matters most.`)}
      </p>

      {first && (
        <section className="next" aria-label={t("Langkah berikutnya", "Next step")}>
          <div className="when">{first.when ? earliest(first.when) : t("Mulai hari ini", "Start today")}</div>
          <h2>{first.gate.label}</h2>
          <p>{first.gate.reason} {first.gate.advice}</p>
        </section>
      )}

      {rest.length > 0 && (
        <div className="section">
          <h2>{t("Setelah itu", "After that")}</h2>
          <ol className="steps-list">
            {rest.map((s) => (
              <li key={s.gate.id} className={s.urgent ? "urgent" : undefined}>
                <div>
                  <b>{s.gate.label}</b>
                  <p>{s.gate.advice}</p>
                  <div className="date">{s.when ? earliest(s.when) : s.urgent ? t("Bisa mulai sekarang", "You can start now") : t("Disarankan sebelum mengajukan", "Recommended before you apply")}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {readiness.overall === "belum_siap" && readiness.readyDate && (
        <div className="note"><Icon name="clock" /><span>{t("Kalau semua dibereskan, kamu paling cepat siap", "If you fix everything, you are ready at the earliest on")} <b>{fmtDate(readiness.readyDate, long)}</b>. {t("Cek lagi di tanggal itu sebelum mengajukan.", "Check again on that date before you apply.")}</span></div>
      )}

      <div className="note"><Icon name="info" /><span>{t("Jangan ambil pinjaman baru untuk menutup pinjaman lama. Itu justru menambah catatan di SLIK.", "Don't take a new loan to pay off an old one. It only adds more records to your SLIK.")}</span></div>

      <div className="section">
        <h2>{t("Kalau sudah ikut saran tapi tetap ditolak?", "What if you follow the advice and are still rejected?")}</h2>
        <ul className="bullets">
          {IF_REJECTED(t).map((x) => <li key={x}>{x}</li>)}
        </ul>
      </div>

      <div className="btn-row">
        <Link className="btn" href="/impor">{t("Impor catatan penjualan", "Import sales records")} <Icon name="arrow" /></Link>
        <Link className="btn ghost" href="/cek">{t("Ubah jawaban", "Change answers")}</Link>
      </div>
    </>
  );
}
