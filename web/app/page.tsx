"use client";
import Link from "next/link";
import { useStore, type Profile } from "@/lib/store";
import { BUSINESS_TYPES, Choice, Icon } from "./ui";

export default function Kenalan() {
  const { profile, setProfile, t } = useStore();
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
      <label className="field">
        <span>{t("Supplier atau pembeli utama", "Main supplier or buyer")}</span>
        <input className="input" value={profile.supplier} onChange={(e) => setProfile({ supplier: e.target.value })} placeholder={t("Contoh: PT Sumber Pangan", "e.g. PT Sumber Pangan")} />
        <small>{t("Petugas bank kadang menelepon mereka untuk memastikan usaha kamu jalan.", "Bank officers sometimes phone them to confirm your business is running.")}</small>
      </label>
      <label className="field">
        <span>{t("Nomor HP supplier", "Supplier's phone number")}</span>
        <input className="input" type="tel" inputMode="tel" value={profile.supplierPhone} onChange={(e) => setProfile({ supplierPhone: e.target.value })} placeholder="08xx" />
      </label>

      {profile.records === "buku" && (
        <div className="note"><Icon name="info" /><span>{t("Foto halaman buku belum bisa dibaca di versi ini. Kamu tetap bisa cek kesiapan, tapi pencocokan butuh file Excel.", "This version can't read photos of book pages yet. You can still check your readiness, but matching needs an Excel file.")}</span></div>
      )}

      <div className="btn-row">
        <Link className="btn" href="/cek">{t("Lanjut cek kesiapan", "Continue to readiness check")} <Icon name="arrow" /></Link>
      </div>
    </>
  );
}
