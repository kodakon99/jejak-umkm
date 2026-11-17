// Coach stand-in: turns gate results and the reconciled ledger into plain Bahasa (or English).
// Templated text only, citing gates that exist; swap for a grounded Claude call later.
import type { Partner } from "./partners.ts";
import type { Readiness, GateResult } from "./gates.ts";
import type { Reconciliation } from "./reconcile.ts";
import type { T } from "../i18n.ts";

export type Step = { gate: GateResult; urgent: boolean; when: string | null };

// Blockers before cautions; within each, ones the owner can act on today come first.
export function actionPlan(r: Readiness): Step[] {
  const rank = (g: GateResult) => (g.status === "blokir" ? 0 : 2) + (g.readyDate ? 1 : 0);
  return r.gates
    .filter((g) => g.status !== "lulus")
    .sort((a, b) => rank(a) - rank(b))
    .map((gate) => ({ gate, urgent: gate.status === "blokir", when: gate.readyDate }));
}

export const IF_REJECTED = (t: T) => [
  t("Keputusan akhir selalu ada di bank. Aplikasi ini hanya membantu kamu bersiap, bukan menjamin persetujuan.",
    "The final decision is always the bank's. This app only helps you prepare; it does not guarantee a yes."),
  t("Tanyakan alasan penolakan ke petugas. Bank wajib memberi tahu, dan alasannya biasanya salah satu syarat di daftar ini.",
    "Ask the officer why. The bank must tell you, and the reason is usually one of the requirements on this list."),
  t("Setelah ditolak, kamu bisa mengajukan lagi minimal 6 bulan kemudian. Pakai waktu itu untuk memperbaiki alasannya.",
    "After a rejection you can apply again after at least 6 months. Use that time to fix the reason."),
];

export const KUR_DOCUMENTS = (t: T) => [
  t("KTP pemohon (dan pasangan, jika menikah)", "ID card (KTP) of the applicant, and spouse if married"),
  t("Kartu Keluarga", "Family card (Kartu Keluarga)"),
  t("NIB dari OSS", "Business licence (NIB) from OSS"),
  t("Rekening koran 6 bulan terakhir", "Bank statements (rekening koran) for the last 6 months"),
  t("Paket bukti penjualan dari aplikasi ini", "The sales evidence pack from this app"),
];

export const SITE_VISIT = (t: T) => [
  t("Pemilik ada di tempat saat petugas datang", "The owner is on site when the officer visits"),
  t("Buku catatan penjualan asli disiapkan, sesuai halaman di paket bukti", "The original sales book is ready, matching the pages in the evidence pack"),
  t("Kontak supplier atau pembeli utama yang bisa ditelepon petugas", "A main supplier or buyer the officer can phone"),
  t("Alamat usaha dan rumah sesuai KTP atau bisa dijelaskan", "Business and home address match the KTP, or can be explained"),
];

export type Profile = { businessType: string; ownerName: string; monthsOperating: number; partners: Partner[] };

const rp = (n: number) => "Rp" + Math.round(n).toLocaleString("id-ID");

export function businessProfile(p: Profile, rec: Reconciliation, t: T = (id) => id): string {
  const days = rec.days.length;
  const cash = rec.days.reduce((s, d) => s + d.cash, 0);
  const qris = rec.days.reduce((s, d) => s + d.qris, 0);
  const cocok = rec.days.filter((d) => d.status === "cocok").length;
  const share = Math.round((cash / (cash + qris)) * 100);
  return [
    t(`${p.businessType} milik ${p.ownerName}, berjalan ${p.monthsOperating} bulan.`, `${p.businessType} owned by ${p.ownerName}, running for ${p.monthsOperating} months.`),
    t(`Dalam ${days} hari tercatat penjualan ${rp(cash + qris)}: tunai ${rp(cash)} (${share}%) dan QRIS ${rp(qris)}, rata-rata ${rp((cash + qris) / days)} per hari.`,
      `Over ${days} days, recorded sales were ${rp(cash + qris)}: cash ${rp(cash)} (${share}%) and QRIS ${rp(qris)}, an average of ${rp((cash + qris) / days)} per day.`),
    (t(`${cocok} dari ${days} hari sudah cocok dengan mutasi bank.`, `${cocok} of ${days} days match the bank statement.`) +
      (rec.flags.length ? " " + t(`${rec.flags.length} catatan selisih dicantumkan di lampiran.`, `${rec.flags.length} differences are listed in the appendix.`) : "")),
    ...(["supplier", "buyer"] as const).map((role) => {
      const names = p.partners.filter((x) => x.role === role && x.name.trim()).map((x) => x.name.trim()).join(", ");
      return !names ? "" : role === "supplier" ? t(`Supplier: ${names}.`, `Suppliers: ${names}.`) : t(`Pembeli: ${names}.`, `Buyers: ${names}.`);
    }),
  ].filter(Boolean).join(" ");
}
