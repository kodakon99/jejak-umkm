"use client";
import Link from "next/link";
import { useStore } from "@/lib/store";
import type { Answers } from "@/lib/engine/gates";
import { Choice, Icon, VERDICT, YES_NO } from "../ui";

export default function Cek() {
  const { gates: g, setGates, readiness, t, fmtDate } = useStore();
  const yn = (v: boolean) => (v ? "ya" : "tidak");
  const blocked = readiness.gates.filter((x) => x.status === "blokir").length;
  const caution = readiness.gates.filter((x) => x.status === "hati").length;
  const STATE_LABEL = { lulus: t("Lulus", "Pass"), hati: t("Hati-hati", "Caution"), blokir: t("Menghalangi", "Blocking") };
  const SLIK: [Answers["slikOwner"], string][] = [["bersih", t("Bersih", "Clean")], ["kol2", t("Pernah telat (kol 2+)", "Paid late (kol 2+)")], ["belum_cek", t("Belum tahu", "Don't know yet")]];
  const yesNo = YES_NO(t);
  const passedLine = t(`${readiness.passed} dari ${readiness.gates.length} syarat lolos`, `${readiness.passed} of ${readiness.gates.length} requirements passed`);

  return (
    <>
      <div className={`lead ${blocked ? "merah" : ""}`}>
        <b>{readiness.percent}%</b>
        <span>{t("persiapan selesai", "of preparation done")}</span>
      </div>
      <p className="progress-line">
        <b>{passedLine}</b>
        {blocked > 0 && <span className="merah"> · {t(`${blocked} menghalangi`, `${blocked} blocking`)}</span>}
        {caution > 0 && <span> · {t(`${caution} perlu diperhatikan`, `${caution} need attention`)}</span>}
      </p>
      <div className="progress" role="img" aria-label={passedLine}>
        {readiness.gates.map((x) => <i key={x.id} className={`mark ${x.status}`} title={x.label} />)}
      </div>
      <p className="sub">{t(
        "Persentase ini menunjukkan persiapan kamu, bukan peluang disetujui. Satu syarat yang menghalangi tetap membuat pengajuan ditolak, sebagus apa pun usahanya.",
        "This percentage shows how far your preparation has come, not your chance of a yes. One blocking requirement still gets an application rejected, however good the business is.")}</p>

      <div className="section">
        <div className="q">
          <fieldset>
            <legend>{t("Status SLIK kamu", "Your SLIK status")}</legend>
            <small>{t(
              "SLIK adalah catatan pinjaman kamu di OJK. Cek gratis di iDebKu (idebku.ojk.go.id). “Kol 2” artinya pernah telat bayar lebih dari 30 hari.",
              "SLIK is your credit record at OJK, Indonesia's financial regulator. Check it for free at iDebKu (idebku.ojk.go.id). “Kol 2” means a payment was more than 30 days late.")}</small>
            <Choice name="slikOwner" value={g.slikOwner} options={SLIK} onChange={(slikOwner) => setGates({ slikOwner })} />
          </fieldset>
          {g.slikOwner === "kol2" && (
            <label className="field">
              <span>{t("Bulan terakhir telat bayar", "Last month you paid late")}</span>
              <input className="input" type="month" value={g.slikOwnerBadUntil?.slice(0, 7) ?? ""} onChange={(e) => setGates({ slikOwnerBadUntil: e.target.value ? e.target.value + "-01" : undefined })} />
            </label>
          )}
        </div>

        <div className="q">
          <fieldset>
            <legend>{t("Sudah menikah?", "Are you married?")}</legend>
            <small>{t("Bank memeriksa SLIK pemohon dan pasangan.", "The bank checks the SLIK of both the applicant and the spouse.")}</small>
            <Choice name="hasSpouse" value={yn(g.hasSpouse)} options={yesNo} onChange={(v) => setGates({ hasSpouse: v === "ya" })} />
          </fieldset>
          {g.hasSpouse && (
            <fieldset className="field">
              <legend>{t("Status SLIK pasangan", "Your spouse's SLIK status")}</legend>
              <Choice name="slikSpouse" value={g.slikSpouse} options={SLIK} onChange={(slikSpouse) => setGates({ slikSpouse })} />
            </fieldset>
          )}
          {g.hasSpouse && g.slikSpouse === "kol2" && (
            <label className="field">
              <span>{t("Bulan terakhir pasangan telat bayar", "Last month your spouse paid late")}</span>
              <input className="input" type="month" value={g.slikSpouseBadUntil?.slice(0, 7) ?? ""} onChange={(e) => setGates({ slikSpouseBadUntil: e.target.value ? e.target.value + "-01" : undefined })} />
            </label>
          )}
        </div>

        <div className="q"><fieldset>
          <legend>{t("Pinjol atau paylater", "Online loans or paylater")}</legend>
          <small>{t("Termasuk Shopee PayLater, Kredivo, Akulaku, dan sejenisnya. Semua tercatat di SLIK.", "Includes Shopee PayLater, Kredivo, Akulaku and similar. All of them show in SLIK.")}</small>
          <Choice name="online" value={g.onlineLoans} onChange={(onlineLoans) => setGates({ onlineLoans })}
            options={[["tidak_ada", t("Tidak ada", "None")], ["lancar", t("Ada, lancar", "Yes, paid on time")], ["telat", t("Ada yang telat", "Yes, some are late")]]} />
        </fieldset></div>

        <div className="q"><fieldset>
          <legend>{t("Pinjaman usaha lain", "Other business loans")}</legend>
          <small>{t("Kredit usaha di bank lain bisa menghalangi KUR. Koperasi tidak tercatat di SLIK.", "A business loan at another bank can block KUR. Cooperative (koperasi) loans don't show in SLIK.")}</small>
          <Choice name="productive" value={g.productiveLoans} onChange={(productiveLoans) => setGates({ productiveLoans })}
            options={[["tidak_ada", t("Tidak ada", "None")], ["beberapa_kecil", t("Beberapa kecil", "A few small ones")], ["aktif_bank", t("Ada di bank", "Yes, at a bank")]]} />
        </fieldset></div>

        <div className="q"><fieldset>
          <legend>{t("Pernah masuk Daftar Hitam Nasional (DHN)?", "Have you been on the National Blacklist (DHN)?")}</legend>
          <small>{t("Biasanya karena cek atau bilyet giro kosong.", "Usually because of a bounced cheque or giro.")}</small>
          <Choice name="dhn" value={yn(g.dhn)} options={yesNo} onChange={(v) => setGates({ dhn: v === "ya" })} />
        </fieldset></div>

        <div className="q"><fieldset>
          <legend>{t("Ada perkara aktif di pengadilan?", "Do you have an active court case?")}</legend>
          <small>{t("Bank mengecek lewat SIPP, sistem informasi perkara pengadilan.", "Banks check SIPP, the courts' case information system.")}</small>
          <Choice name="sipp" value={yn(g.sipp)} options={yesNo} onChange={(v) => setGates({ sipp: v === "ya" })} />
        </fieldset></div>

        <div className="q"><fieldset>
          <legend>{t("Sudah punya NIB?", "Do you have an NIB?")}</legend>
          <small>{t("Nomor Induk Berusaha, izin usaha gratis dari oss.go.id.", "Nomor Induk Berusaha, a free business licence from oss.go.id.")}</small>
          <Choice name="nib" value={g.nib ? "ya" : "tidak"} options={[["ya", t("Sudah", "Yes")], ["tidak", t("Belum", "Not yet")]]} onChange={(v) => setGates({ nib: v === "ya" })} />
        </fieldset></div>

        <div className="q">
          <label className="field" style={{ marginTop: 0 }}>
            <span>{t("Rekening koran tersedia berapa bulan?", "How many months of bank statements do you have?")}</span>
            <small>{t("Riwayat mutasi rekening tempat QRIS dan setoran tunai masuk. KUR minta 6 bulan.", "The statement history (rekening koran) of the account your QRIS income and cash deposits go into. KUR asks for 6 months.")}</small>
            <input className="input" inputMode="numeric" value={g.statementMonths || ""} onChange={(e) => setGates({ statementMonths: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
          </label>
        </div>

        <div className="q"><fieldset>
          <legend>{t("Punya aset tetap untuk jaminan?", "Do you have a fixed asset for collateral?")}</legend>
          <small>{t("Tanah, bangunan, atau kendaraan atas nama kamu. Hanya penting kalau pinjaman di atas Rp100 juta.", "Land, a building or a vehicle in your name. It only matters for loans above Rp100 million.")}</small>
          <Choice name="asset" value={yn(g.hasFixedAsset)} options={yesNo} onChange={(v) => setGates({ hasFixedAsset: v === "ya" })} />
        </fieldset></div>
      </div>

      <div className={`verdict ${readiness.overall}`} aria-live="polite">
        <h2>{VERDICT(t)[readiness.overall]}</h2>
        {readiness.overall === "belum_siap" && (
          <p>
            {readiness.readyDate
              ? <>{t("Paling cepat siap", "Ready at the earliest on")} <b>{fmtDate(readiness.readyDate, { day: "numeric", month: "long", year: "numeric" })}</b>{readiness.undatedBlockers ? t(", setelah syarat lain dibereskan", ", once the other requirements are fixed") : ""}.</>
              : t("Siap setelah syarat yang menghalangi dibereskan.", "Ready once the blocking requirements are fixed.")}
          </p>
        )}
        <p className="small">{t("Ini kesiapan menurut aturan penyaringan bank, bukan persetujuan. Keputusan tetap di bank.", "This is readiness under the banks' screening rules, not a loan decision. The decision stays with the bank.")}</p>
      </div>

      <div className="section">
        <h2>{t("Hasil per syarat", "Result per requirement")}</h2>
        <ul className="gates">
          {readiness.gates.map((x) => (
            <li className="gate" key={x.id}>
              <i className={`mark ${x.status}`} aria-hidden />
              <div><b>{x.label}</b><span className={`state ${x.status}`}>{STATE_LABEL[x.status]}</span></div>
              <p>{x.reason}</p>
              <details>
                <summary>{t("Dasar aturan", "Where this rule comes from")}</summary>
                <div>{x.source}. {x.note}</div>
              </details>
            </li>
          ))}
        </ul>
        <p className="small" style={{ marginTop: 12 }}>{t(
          `Aturan versi ${readiness.rulesVersion}. Kalau aturan beda antar bank, kami pakai yang paling ketat.`,
          `Rules version ${readiness.rulesVersion}. Where banks differ, we use the strictest rule.`)}</p>
      </div>

      <div className="btn-row">
        <Link className="btn" href="/rencana">{t("Lihat rencana", "See your plan")} <Icon name="arrow" /></Link>
        <Link className="btn ghost" href="/impor">{t("Impor catatan penjualan", "Import sales records")}</Link>
      </div>
    </>
  );
}
