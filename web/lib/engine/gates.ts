// Gatekeeper: the readiness gates from the PRD, as data. Deterministic: no model
// ever decides "siap" or "belum siap". Each gate cites the banker it came from.
import { pick, type Lang, type T } from "../i18n.ts";

export const RULES_VERSION = "2026-11-05";

export type Answers = {
  slikOwner: "bersih" | "kol2" | "belum_cek";
  slikOwnerBadUntil?: string; // last month with kol 2+, ISO date
  hasSpouse: boolean;
  slikSpouse: "bersih" | "kol2" | "belum_cek";
  slikSpouseBadUntil?: string;
  onlineLoans: "tidak_ada" | "lancar" | "telat";
  productiveLoans: "tidak_ada" | "beberapa_kecil" | "aktif_bank";
  dhn: boolean;
  sipp: boolean;
  nib: boolean;
  monthsOperating: number;
  statementMonths: number;
  loanAmount: number;
  hasFixedAsset: boolean;
  // from the reconciler
  reconciledMonths: number;
  openFlags: number;
};

export type GateStatus = "lulus" | "hati" | "blokir";

export type GateResult = {
  id: string;
  label: string;
  status: GateStatus;
  reason: string;
  advice: string;
  source: string;
  readyDate: string | null; // earliest date this gate can pass, if it is time-bound
  note?: string; // e.g. "rule varies by bank"
};

type Pair = [id: string, en: string];

type Gate = {
  id: string;
  label: Pair;
  source: Pair;
  advice: Pair;
  note?: Pair;
  check: (a: Answers, today: string, t: T) => { status: GateStatus; reason: string; readyDate?: string | null; advice?: string } | null;
};

// What the owner sees as the basis for each rule: a public rule where one exists, otherwise
// common bank practice (and we say it varies by bank). Interview evidence behind each rule
// (Mandiri banker 24 Sep & 1 Oct, BNI credit analyst 21-22 Oct, KUR officer 26 Oct 2026) lives
// in the PRD, not in the UI: interviewees are named by role only and did not agree to be quoted.
const KUR: Pair = ["Aturan KUR pemerintah (Permenko Perekonomian tentang KUR), berlaku di semua bank penyalur KUR", "Government KUR rules (Coordinating Ministry for Economic Affairs regulation on KUR), applied by every KUR bank"];
const OJK_SLIK: Pair = ["Semua bank wajib memeriksa riwayat kredit di SLIK OJK sebelum memberi pinjaman", "Every bank checks your credit history in OJK's SLIK before lending"];
const PINJOL_SLIK: Pair = ["Sejak 31 Juli 2025, pinjol resmi wajib melapor ke SLIK OJK, jadi bank bisa melihatnya", "Since 31 July 2025, licensed online lenders must report to OJK's SLIK, so banks can see them"];
const BI_DHN: Pair = ["Daftar Hitam Nasional dikelola Bank Indonesia dan dipakai semua bank", "The National Blacklist is run by Bank Indonesia and used by every bank"];
const PRACTICE: Pair = ["Praktik umum bank saat menilai kredit usaha. Tiap bank bisa sedikit berbeda; kami pakai yang paling ketat", "Common bank practice for business loans. Banks differ a little; we use the strictest version"];
const both = (a: Pair, b: Pair): Pair => [`${a[0]}. ${b[0]}`, `${a[1]}. ${b[1]}`];
const pass = (reason: string) => ({ status: "lulus" as const, reason });

export const addMonths = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
};

const slik = (spouse: boolean, status: Answers["slikOwner"], badUntil: string | undefined, today: string, t: T) => {
  const who = spouse ? t("pasangan", "your spouse's") : t("kamu", "your");
  if (status === "kol2") {
    const ready = addMonths(badUntil ?? today, 6);
    if (ready <= today) return pass(t("Kol 2 terakhir sudah lewat 6 bulan.", "The last kol 2 was more than 6 months ago."));
    return { status: "blokir" as const, reason: t(`SLIK ${who} ada kol 2 atau lebih buruk dalam 6 bulan terakhir.`, `${who[0].toUpperCase() + who.slice(1)} SLIK shows kol 2 or worse in the last 6 months.`), readyDate: ready };
  }
  if (status === "belum_cek")
    return {
      status: "hati" as const,
      reason: t(`SLIK ${who} belum dicek.`, `${who[0].toUpperCase() + who.slice(1)} SLIK has not been checked yet.`),
      advice: t(`Ambil laporan SLIK ${who} gratis di idebku.ojk.go.id, lalu isi hasilnya di langkah Cek.`, `Get ${who} SLIK report for free at idebku.ojk.go.id, then enter the result on the Check step.`),
    };
  return pass(t(`SLIK ${who} bersih.`, `${who[0].toUpperCase() + who.slice(1)} SLIK is clean.`));
};

export const GATES: Gate[] = [
  {
    id: "slik_owner", label: ["SLIK (kamu)", "SLIK (you)"], source: OJK_SLIK,
    advice: ["Ambil laporan SLIK gratis di iDebKu OJK. Lunasi tunggakan, lalu tunggu sampai 6 bulan bersih.", "Get your free SLIK report from OJK's iDebKu. Pay off any arrears, then wait until you have 6 clean months."],
    note: ["Syarat 6 bulan bersih adalah praktik bank yang paling ketat; sebagian bank lebih longgar.", "Waiting for 6 clean months is the strictest bank practice; some banks are more lenient."],
    check: (a, d, t) => slik(false, a.slikOwner, a.slikOwnerBadUntil, d, t),
  },
  {
    id: "slik_spouse", label: ["SLIK (pasangan)", "SLIK (spouse)"], source: both(OJK_SLIK, PRACTICE),
    advice: ["Cek SLIK pasangan juga. Bank memeriksa pemohon dan pasangan.", "Check your spouse's SLIK too. The bank checks both the applicant and the spouse."],
    check: (a, d, t) => (a.hasSpouse ? slik(true, a.slikSpouse, a.slikSpouseBadUntil, d, t) : pass(t("Tidak ada pasangan yang perlu dicek.", "No spouse to check."))),
  },
  {
    id: "online_loans", label: ["Pinjol & paylater", "Online loans & paylater"], source: PINJOL_SLIK,
    advice: ["Bayar cicilan yang telat sampai lancar, atau lunasi sebelum mengajukan.", "Bring late instalments up to date, or pay them off before you apply."],
    check: (a, _, t) =>
      a.onlineLoans === "telat" ? { status: "blokir", reason: t("Ada pinjol atau paylater yang telat bayar. Ini tercatat di SLIK.", "An online loan or paylater payment is late. This shows in SLIK.") }
      : a.onlineLoans === "lancar" ? { status: "hati", reason: t("Ada pinjol atau paylater aktif, tapi lancar.", "You have an active online loan or paylater, paid on time.") }
      : pass(t("Tidak ada pinjol atau paylater.", "No online loans or paylater.")),
  },
  {
    id: "productive_loans", label: ["Pinjaman usaha lain", "Other business loans"], source: KUR,
    advice: ["Lunasi pinjaman usaha di bank lain sebelum mengajukan KUR.", "Pay off business loans at other banks before applying for KUR."],
    check: (a, _, t) =>
      a.productiveLoans === "aktif_bank" ? { status: "blokir", reason: t("Masih ada pinjaman usaha aktif di bank. Ini bisa menghalangi KUR.", "You still have an active business loan at a bank. This can block KUR.") }
      : a.productiveLoans === "beberapa_kecil" ? { status: "hati", reason: t("Beberapa pinjaman kecil bisa membuat cicilan terasa berat bagi bank.", "Several small loans can make the repayments look heavy to the bank.") }
      : pass(t("Tidak ada pinjaman usaha lain.", "No other business loans.")),
  },
  {
    id: "dhn", label: ["Daftar Hitam Nasional (DHN)", "National Blacklist (DHN)"], source: BI_DHN,
    advice: ["Selesaikan dulu dengan bank yang memasukkan kamu ke DHN.", "Settle it first with the bank that listed you in DHN."],
    check: (a, _, t) => (a.dhn ? { status: "blokir", reason: t("Nama kamu ada di DHN (cek kosong).", "Your name is on DHN (bounced cheque).") } : pass(t("Tidak ada di DHN.", "Not on DHN."))),
  },
  {
    id: "sipp", label: ["Perkara pengadilan (SIPP)", "Court cases (SIPP)"], source: PRACTICE,
    advice: ["Tunggu sampai perkaranya selesai.", "Wait until the case is resolved."],
    check: (a, _, t) => (a.sipp ? { status: "blokir", reason: t("Ada perkara aktif di pengadilan.", "You have an active court case.") } : pass(t("Tidak ada perkara aktif.", "No active court case."))),
  },
  {
    id: "nib", label: ["Legalitas usaha (NIB)", "Business licence (NIB)"], source: KUR,
    advice: ["Daftar NIB gratis di oss.go.id. Biasanya selesai dalam sehari.", "Register for an NIB for free at oss.go.id. It usually takes a day."],
    check: (a, _, t) => (a.nib ? pass(t("Sudah punya NIB.", "You have an NIB.")) : { status: "blokir", reason: t("Belum punya NIB.", "You don't have an NIB yet.") }),
  },
  {
    id: "operating", label: ["Lama usaha", "Time in business"], source: KUR,
    advice: ["Terus catat penjualan. Ajukan setelah usaha berjalan minimal 6 bulan.", "Keep recording sales. Apply once the business has run for at least 6 months."],
    check: (a, d, t) =>
      a.monthsOperating < 6 ? { status: "blokir", reason: t(`Usaha baru berjalan ${a.monthsOperating} bulan.`, `The business has only run for ${a.monthsOperating} months.`), readyDate: addMonths(d, 6 - a.monthsOperating) }
      : a.monthsOperating < 12 ? { status: "hati", reason: t(`Usaha berjalan ${a.monthsOperating} bulan. Cukup, tapi masih muda.`, `The business has run for ${a.monthsOperating} months. Enough, but still young.`) }
      : pass(t(`Usaha berjalan ${a.monthsOperating} bulan.`, `The business has run for ${a.monthsOperating} months.`)),
  },
  {
    id: "statements", label: ["Rekening koran 6 bulan", "6 months of bank statements"], source: PRACTICE,
    advice: ["Masukkan semua QRIS dan setoran tunai ke satu rekening supaya riwayatnya utuh.", "Send all QRIS income and cash deposits to one account so the history is complete."],
    check: (a, d, t) =>
      a.statementMonths < 6 ? { status: "blokir", reason: t(`Rekening koran baru ${a.statementMonths} bulan, KUR minta 6 bulan.`, `You have ${a.statementMonths} months of bank statements; KUR asks for 6.`), readyDate: addMonths(d, 6 - a.statementMonths) }
      : pass(t("Rekening koran 6 bulan tersedia.", "6 months of bank statements available.")),
  },
  {
    id: "sales_evidence", label: ["Bukti penjualan", "Sales evidence"], source: PRACTICE,
    advice: ["Impor bulan-bulan sebelumnya dan jelaskan setiap selisih antara Excel dan bank.", "Import earlier months and explain every difference between your Excel and the bank."],
    check: (a, _, t) =>
      a.reconciledMonths < 3 ? { status: "hati", reason: t(`Baru ${a.reconciledMonths} bulan yang dicocokkan dengan bank. Idealnya 3 bulan atau lebih.`, `Only ${a.reconciledMonths} months are matched with the bank. Ideally 3 months or more.`) }
      : a.openFlags > 0 ? { status: "hati", reason: t(`Masih ada ${a.openFlags} selisih Excel dan bank yang belum dijelaskan.`, `${a.openFlags} differences between Excel and the bank are not explained yet.`) }
      : pass(t(`${a.reconciledMonths} bulan penjualan sudah cocok dengan bank.`, `${a.reconciledMonths} months of sales match the bank.`)),
  },
  {
    id: "collateral", label: ["Jaminan", "Collateral"], source: KUR,
    advice: ["Pertimbangkan pinjaman di bawah Rp100 juta, misalnya KUR Mikro tanpa agunan tambahan.", "Consider a loan under Rp100 million, such as KUR Mikro with no extra collateral."],
    note: ["Sampai Rp100 juta, aturan KUR melarang bank meminta agunan tambahan. Di atasnya, jenis dan nilai jaminan ditentukan tiap bank.", "Up to Rp100 million, KUR rules bar banks from asking for extra collateral. Above that, each bank decides what collateral it accepts."],
    check: (a, _, t) =>
      a.loanAmount > 100_000_000 && !a.hasFixedAsset ? { status: "hati", reason: t("Di atas Rp100 juta biasanya perlu jaminan aset tetap, dan kamu belum punya.", "Above Rp100 million usually needs a fixed asset as collateral, and you don't have one yet.") }
      : pass(a.loanAmount > 100_000_000 ? t("Ada aset tetap untuk jaminan.", "You have a fixed asset for collateral.") : t("Jumlah pinjaman dalam rentang KUR Mikro.", "The loan amount is within the KUR Mikro range.")),
  },
];

export type Readiness = {
  overall: "siap" | "siap_dengan_catatan" | "belum_siap";
  readyDate: string | null; // earliest date every time-bound blocker clears
  undatedBlockers: number; // blockers that clear when the owner acts, not by waiting
  passed: number; // gates at "lulus"; caution earns no partial credit
  percent: number; // preparation progress, never a chance of approval
  gates: GateResult[];
  rulesVersion: string;
};

export function evaluate(a: Answers, today: string, lang: Lang = "id"): Readiness {
  const t = pick(lang);
  const tr = (p?: Pair) => p && t(...p);
  const gates = GATES.map((g) => {
    const r = g.check(a, today, t)!;
    return { id: g.id, label: tr(g.label)!, source: tr(g.source)!, advice: r.advice ?? tr(g.advice)!, note: tr(g.note), readyDate: r.readyDate ?? null, status: r.status, reason: r.reason };
  });
  const blocked = gates.filter((g) => g.status === "blokir");
  const dated = blocked.map((g) => g.readyDate).filter((d): d is string => !!d).sort();
  return {
    overall: blocked.length ? "belum_siap" : gates.some((g) => g.status === "hati") ? "siap_dengan_catatan" : "siap",
    readyDate: dated.at(-1) ?? null,
    undatedBlockers: blocked.filter((g) => !g.readyDate).length,
    passed: gates.filter((g) => g.status === "lulus").length,
    percent: Math.round((gates.filter((g) => g.status === "lulus").length / gates.length) * 100),
    gates,
    rulesVersion: RULES_VERSION,
  };
}
