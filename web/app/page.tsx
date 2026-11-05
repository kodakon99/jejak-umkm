"use client";
import Link from "next/link";
import { useStore, type Profile } from "@/lib/store";
import { partnerActivity, type Partner } from "@/lib/engine/partners";
import { BUSINESS_TYPES, Choice, Icon } from "./ui";

export default function Kenalan() {
  const { profile, imported, setProfile, t } = useStore();
  const partners = profile.partners;
  const setPartner = (i: number, p: Partial<Partner>) => setProfile({ partners: partners.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  // Once files are imported, show how many transactions each name finds, so the owner can fix the spelling.
  const found = imported ? partnerActivity(partners, imported.bank, imported.rows) : null;
  const num = (k: "monthsOperating" | "loanAmount") => (e: React.ChangeEvent<HTMLInputElement>) =>
    setProfile({ [k]: Number(e.target.value.replace(/\D/g, "")) || 0 });

  return (
    <>
      <h1 className="title">{t("Kenalan dulu, biar cek kesiapan KUR-nya pas", "First, tell us about your business so the KUR check fits")}</h1>
      <p className="sub">{t("Lima menit. Data kamu disimpan di HP ini saja, tidak dikirim ke bank atau siapa pun.", "Five minutes. Your data stays on this phone and is never sent to a bank or anyone else.")}</p>

      <label className="field">
        <span>{t("Nama kamu", "Your name")}</span>
        <input className="input" value={profile.ownerName} onChange={(e) => setProfile({ ownerName: e.target.value })} placeholder={t("Contoh: Rina Wulandari", "e.g. Rina Wulandari")} autoComplete="name" />
      </label>
      <label className="field">
        <span>{t("Nama usaha", "Business name")}</span>
        <input className="input" value={profile.businessName} onChange={(e) => setProfile({ businessName: e.target.value })} placeholder={t("Contoh: Warung Bu Rina", "e.g. Warung Bu Rina")} />
      </label>
      <label className="field">
        <span>{t("Jenis usaha", "Type of business")}</span>
        <select className="input" value={profile.businessType} onChange={(e) => setProfile({ businessType: e.target.value })}>
          {BUSINESS_TYPES.map(([id, en]) => <option key={id} value={id}>{t(id, en)}</option>)}
        </select>
      </label>
      <label className="field">
        <span>{t("Sudah berjalan berapa bulan?", "How many months has it been running?")}</span>
        <input className="input" inputMode="numeric" value={profile.monthsOperating || ""} onChange={num("monthsOperating")} placeholder="12" />
      </label>
      <label className="field">
        <span>{t("Mau pinjam berapa?", "How much do you want to borrow?")}</span>
        <input className="input" inputMode="numeric" value={profile.loanAmount ? profile.loanAmount.toLocaleString("id-ID") : ""} onChange={num("loanAmount")} placeholder="25.000.000" />
        <small>{t("KUR Mikro biasanya Rp10–50 juta.", "KUR Mikro (government-backed micro loan) is usually Rp10–50 million.")}</small>
      </label>
      <fieldset className="field">
        <legend>{t("Penjualan kamu dicatat di mana?", "Where do you record your sales?")}</legend>
        <Choice<Profile["records"]> name="records" value={profile.records} onChange={(records) => setProfile({ records })}
          options={[["keduanya", t("Buku lalu Excel", "Book, then Excel")], ["excel", t("Excel saja", "Excel only")], ["buku", t("Buku saja", "Book only")]]} />
      </fieldset>
      <fieldset className="field">
        <legend>{t("Supplier dan pembeli", "Suppliers and buyers")}</legend>
        <small>{t(
          "Petugas bank kadang menelepon mereka untuk memastikan usaha kamu jalan. Tulis nama seperti di mutasi bank, supaya transaksinya bisa kami temukan.",
          "Bank officers sometimes phone them to confirm your business is running. Write each name as it appears on your bank statement so we can find its transactions.")}</small>
        {partners.map((p, i) => {
          const hits = found?.[i]?.txns.length;
          return (
            <div className="panel partner" key={i}>
              <input className="input" value={p.name} onChange={(e) => setPartner(i, { name: e.target.value })} aria-label={t("Nama supplier atau pembeli", "Supplier or buyer name")} placeholder={t("Contoh: PT Sumber Pangan Jaya", "e.g. PT Sumber Pangan Jaya")} />
              <div className="partner-row">
                <Choice<Partner["role"]> name={`role-${i}`} value={p.role} onChange={(role) => setPartner(i, { role })}
                  options={[["supplier", "Supplier"], ["buyer", t("Pembeli", "Buyer")]]} />
                <input className="input" type="tel" inputMode="tel" value={p.phone} onChange={(e) => setPartner(i, { phone: e.target.value })} aria-label={t("Nomor HP", "Phone number")} placeholder="08xx" />
                <button type="button" className="btn quiet" onClick={() => setProfile({ partners: partners.filter((_, j) => j !== i) })}>{t("Hapus", "Remove")}</button>
              </div>
              {found && p.name.trim() && (
                <small>{hits
                  ? t(`${hits} transaksi ditemukan di mutasi dan Excel. Lihat rinciannya di Paket bukti.`, `${hits} ${hits === 1 ? "transaction" : "transactions"} found in your statement and Excel. See them in the Evidence pack.`)
                  : t("Belum ditemukan di mutasi atau Excel. Cek ejaannya sesuai mutasi bank.", "Not found in your statement or Excel yet. Check the spelling against your bank statement.")}</small>
              )}
            </div>
          );
        })}
        <div className="btn-row" style={{ marginTop: 0 }}>
          <button type="button" className="btn ghost" onClick={() => setProfile({ partners: [...partners, { name: "", role: "supplier", phone: "" }] })}>
            {t("+ Tambah supplier atau pembeli", "+ Add a supplier or buyer")}
          </button>
        </div>
      </fieldset>

      {profile.records === "buku" && (
        <div className="note"><Icon name="info" /><span>{t("Foto halaman buku belum bisa dibaca di versi ini. Kamu tetap bisa cek kesiapan, tapi pencocokan butuh file Excel.", "This version can't read photos of book pages yet. You can still check your readiness, but matching needs an Excel file.")}</span></div>
      )}

      <div className="btn-row">
        <Link className="btn" href="/cek">{t("Lanjut cek kesiapan", "Continue to readiness check")} <Icon name="arrow" /></Link>
      </div>
    </>
  );
}
