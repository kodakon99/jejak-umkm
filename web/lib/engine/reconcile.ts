// Reconciler: matches the owner's Excel against the bank statement and flags
// what doesn't add up. It proposes; the owner confirms or explains. It never
// edits the owner's rows.
import type { BankLine, LedgerRow, Source } from "./read.ts";
import { locale, pick, type Lang } from "../i18n.ts";

// ponytail: fixed QRIS fee, infer per provider from real statements once we have them.
export const QRIS_FEE = 0.007;
const QRIS_TOLERANCE = (expected: number) => Math.max(1_000, expected * 0.003);
const CASH_RATIO_DRIFT = 0.05; // a week whose deposit/cash ratio is 5% off the median gets a caution
// ponytail: fixed thresholds for "unusual"; learn per owner from 6 months of statements later.
const UNUSUAL_SIZE = 3; // amount over 3x the median of the same kind of transaction
const ODD_HOURS = (time: string) => time < "05:00"; // 00:00-04:59, outside any warung's hours
// Lines with their own checks (QRIS, deposits) or posted by the bank itself.
const ROUTINE = (b: BankLine) => ["opening", "qris", "cash_deposit", "fee", "interest"].includes(b.kind) || /^(biaya|pajak|bunga)\b/i.test(b.desc);

export type FlagKind =
  | "duplicate" | "blank" | "qris_mismatch" | "qris_missing" | "cash_week" | "supplier_unmatched"
  | "bank_only" | "bank_duplicate" | "unusual";

export type Flag = {
  id: string;
  kind: FlagKind;
  severity: "selisih" | "cek"; // selisih = numbers disagree; cek = worth a look
  dates: string[];
  title: string;
  detail: string;
  question: string; // what we ask the owner
  excel: Source[];
  bank?: BankLine;
};

export type DayStatus = "cocok" | "selisih" | "cek" | "menunggu";

export type Reconciliation = {
  days: { date: string; cash: number; qris: number; status: DayStatus; flags: string[]; bank: BankLine[] }[];
  flags: Flag[];
  pending: string[]; // QRIS sales that settle after the statement ends
  excluded: BankLine[]; // non-business statement lines
  matchedBank: BankLine[];
  cashRatio: number | null;
};

const rp = (n: number) => "Rp" + Math.round(n).toLocaleString("id-ID");

const addDays = (iso: string, n: number) => new Date(Date.parse(iso + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);

export function reconcile(rows: LedgerRow[], bank: BankLine[], lang: Lang = "id"): Reconciliation {
  const t = pick(lang);
  const shortDate = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString(locale(lang), { day: "numeric", month: "short", timeZone: "UTC" });
  const flags: Flag[] = [];
  const sales = rows.filter((r) => r.channel !== "expense");

  // 1. Rows typed twice: same sheet, identical content. Count them once from here on.
  const seen = new Map<string, LedgerRow[]>();
  for (const r of sales) {
    const key = `${r.source.sheet}|${r.sig}|${r.channel}`;
    seen.set(key, [...(seen.get(key) ?? []), r]);
  }
  const unique: LedgerRow[] = [];
  const dupByDate = new Map<string, LedgerRow[]>();
  for (const group of seen.values()) {
    unique.push(group[0]);
    if (group.length > 1) dupByDate.set(group[0].date, [...(dupByDate.get(group[0].date) ?? []), ...group]);
  }
  for (const [date, group] of dupByDate) {
    flags.push({
      id: `dup-${date}`, kind: "duplicate", severity: "selisih", dates: [date],
      title: t(`Baris ${shortDate(date)} tercatat dua kali`, `The ${shortDate(date)} row is recorded twice`),
      detail: t(`Isi barisnya sama persis (${group.map((g) => g.source.cell).join(", ")}). Kalau dihitung sekali, angkanya cocok dengan bank.`,
        `The rows are identical (${group.map((g) => g.source.cell).join(", ")}). Counted once, the numbers match the bank.`),
      question: t("Apakah ini salah ketik dobel, atau memang ada dua transaksi yang sama?", "Was this typed twice by mistake, or were there really two identical sales?"),
      excel: group.map((g) => g.source),
    });
  }

  // 2. Blank sales cells.
  for (const r of unique.filter((r) => r.amount == null)) {
    flags.push({
      id: `blank-${r.date}-${r.channel}`, kind: "blank", severity: "selisih", dates: [r.date],
      title: r.channel === "cash" ? t(`Penjualan tunai ${shortDate(r.date)} kosong`, `Cash sales for ${shortDate(r.date)} are blank`) : t(`Penjualan QRIS ${shortDate(r.date)} kosong`, `QRIS sales for ${shortDate(r.date)} are blank`),
      detail: t(`Sel ${r.source.cell} di sheet "${r.source.sheet}" tidak diisi.`, `Cell ${r.source.cell} on sheet "${r.source.sheet}" is empty.`),
      question: t("Berapa penjualan hari itu? Cek buku catatan atau foto halamannya.", "What were the sales that day? Check your sales book or a photo of the page."),
      excel: [r.source],
    });
  }

  const sum = (date: string, ch: "cash" | "qris") =>
    unique.filter((r) => r.date === date && r.channel === ch).reduce((s, r) => s + (r.amount ?? 0), 0);
  const cellsFor = (dates: string[], ch: "cash" | "qris") =>
    unique.filter((r) => dates.includes(r.date) && r.channel === ch).map((r) => r.source);
  const dates = [...new Set(unique.map((r) => r.date))].sort();
  const lastBankDate = bank.reduce((m, b) => (b.date > m ? b.date : m), "");

  // 3. QRIS: each settlement credit pays out one or more sales days, net of the fee.
  const settled = new Set<string>();
  const qrisLines = bank.filter((b) => b.kind === "qris" && b.dir === "CR");
  for (const b of qrisLines) {
    const covers = b.covers ?? [];
    covers.forEach((d) => settled.add(d));
    const gross = covers.reduce((s, d) => s + sum(d, "qris"), 0);
    const expected = gross * (1 - QRIS_FEE);
    if (Math.abs(expected - b.amount) <= QRIS_TOLERANCE(expected)) continue;
    const grossFromBank = b.amount / (1 - QRIS_FEE);
    flags.push({
      id: `qris-${b.line}`, kind: "qris_mismatch", severity: "selisih", dates: covers,
      title: t(`QRIS ${covers.map(shortDate).join("–")} beda dengan bank`, `QRIS for ${covers.map(shortDate).join("–")} differs from the bank`),
      detail: t(`Di Excel ${rp(gross)}, bank mencairkan ${rp(b.amount)} (setara ${rp(grossFromBank)} sebelum potongan ${(QRIS_FEE * 100).toLocaleString("id-ID")}%). Selisih ${rp(gross - grossFromBank)}.`,
        `Excel shows ${rp(gross)}; the bank paid out ${rp(b.amount)} (${rp(grossFromBank)} before the ${(QRIS_FEE * 100).toLocaleString("en")}% fee). Difference: ${rp(gross - grossFromBank)}.`),
      question: t("Angka di Excel salah ketik, atau ada pembayaran QRIS yang masuk ke rekening lain?", "Is the Excel figure a typo, or did a QRIS payment go to another account?"),
      excel: cellsFor(covers, "qris"),
      bank: b,
    });
  }
  const pending: string[] = [];
  for (const d of dates) {
    if (settled.has(d) || sum(d, "qris") === 0) continue;
    if (addDays(d, 1) >= lastBankDate) { pending.push(d); continue; } // settles after the statement ends
    flags.push({
      id: `qris-missing-${d}`, kind: "qris_missing", severity: "selisih", dates: [d],
      title: t(`QRIS ${shortDate(d)} tidak ada di mutasi bank`, `QRIS for ${shortDate(d)} is not on the bank statement`),
      detail: t(`Excel mencatat ${rp(sum(d, "qris"))}, tapi tidak ada settlement yang mencakup tanggal ini.`, `Excel records ${rp(sum(d, "qris"))}, but no settlement covers this date.`),
      question: t("Apakah QRIS ini masuk ke rekening lain?", "Did this QRIS income go to another account?"),
      excel: cellsFor([d], "qris"),
    });
  }

  // 4. Cash: deposited in bulk, so only weeks can be checked. Each deposit covers
  //    the days since the previous one. Compare its ratio to the owner's usual.
  const deposits = bank.filter((b) => b.kind === "cash_deposit" && b.dir === "CR");
  const weeks = deposits.map((b, i) => {
    const from = i === 0 ? dates[0] : deposits[i - 1].date;
    const window = dates.filter((d) => d >= from && d < b.date);
    const cash = window.reduce((s, d) => s + sum(d, "cash"), 0);
    return { b, window, cash, ratio: cash ? b.amount / cash : 0 };
  });
  const ratios = weeks.map((w) => w.ratio).filter(Boolean).sort((a, b) => a - b);
  const cashRatio = ratios.length ? ratios[Math.floor(ratios.length / 2)] : null;
  if (cashRatio && ratios.length >= 3) {
    for (const w of weeks) {
      if (Math.abs(w.ratio - cashRatio) / cashRatio <= CASH_RATIO_DRIFT) continue;
      flags.push({
        id: `cash-${w.b.line}`, kind: "cash_week", severity: "cek", dates: w.window,
        title: t(`Setoran tunai ${shortDate(w.window[0])}–${shortDate(w.window.at(-1)!)} tidak seperti biasanya`, `Cash deposit for ${shortDate(w.window[0])}–${shortDate(w.window.at(-1)!)} is unusual`),
        detail: t(`Biasanya kamu menyetor sekitar ${Math.round(cashRatio * 100)}% penjualan tunai. Minggu ini setoran ${rp(w.b.amount)} = ${Math.round(w.ratio * 100)}% dari ${rp(w.cash)} di Excel.`,
          `You usually deposit about ${Math.round(cashRatio * 100)}% of cash sales. This week's deposit of ${rp(w.b.amount)} is ${Math.round(w.ratio * 100)}% of the ${rp(w.cash)} in Excel.`),
        question: t("Ada penjualan tunai minggu ini yang belum dicatat, atau setorannya memang beda?", "Are some cash sales this week not recorded, or was the deposit really different?"),
        excel: cellsFor(w.window, "cash"),
        bank: w.b,
      });
    }
  }

  // The bank's second copy of a transaction posted twice: reported once as a duplicate (6), not again below.
  const posted = new Map<string, BankLine>();
  const repeats = new Map<BankLine, BankLine>(); // repeat -> first posting
  for (const b of bank.filter((b) => b.kind !== "opening")) {
    const key = [b.date, b.time ?? "", b.desc, b.amount, b.dir].join("|");
    const first = posted.get(key);
    if (!first) posted.set(key, b);
    else if (b.time || !ROUTINE(b)) repeats.set(b, first); // without times, two same-day fees are normal
  }

  // 5. Bank only, not in Excel.
  //    a. Payments to a company or shop should match an expense row within a few days.
  const expenses = rows.filter((r) => r.channel === "expense");
  const near = (e: LedgerRow, b: BankLine) => Math.abs(Date.parse(e.date) - Date.parse(b.date)) <= 3 * 864e5;
  for (const b of bank.filter((b) => b.kind === "supplier" && b.dir === "DB" && !repeats.has(b))) {
    if (expenses.some((e) => e.amount === b.amount && near(e, b))) continue;
    const typo = expenses.find((e) => near(e, b) && e.amount != null && Math.abs(e.amount - b.amount) / b.amount < 0.5);
    flags.push({
      id: `sup-${b.line}`, kind: "supplier_unmatched", severity: "cek", dates: [b.date],
      title: t(`Pembayaran ke usaha lain ${shortDate(b.date)} tidak ada di Excel`, `Payment to a business on ${shortDate(b.date)} is not in Excel`),
      detail: t(`${b.desc} ${rp(b.amount)} belum tercatat sebagai pengeluaran.`, `${b.desc} ${rp(b.amount)} is not recorded as an expense.`) +
        (typo ? t(` Di Excel ada "${typo.item}" ${rp(typo.amount!)} (${shortDate(typo.date)}, sel ${typo.source.cell}), mungkin salah ketik.`,
          ` Excel has "${typo.item}" for ${rp(typo.amount!)} (${shortDate(typo.date)}, cell ${typo.source.cell}); maybe a typo.`) : ""),
      question: t("Ini belanja usaha? Kalau ya, tambahkan atau betulkan di catatan pengeluaran.", "Was this a business purchase? If so, add or fix it in your expense records."),
      excel: typo ? [typo.source] : [],
      bank: b,
    });
  }
  //    b. Money in that is not QRIS, a cash deposit, interest or a labelled family transfer.
  for (const b of bank.filter((b) => b.dir === "CR" && !ROUTINE(b) && b.kind !== "personal" && !repeats.has(b))) {
    flags.push({
      id: `in-${b.line}`, kind: "bank_only", severity: "cek", dates: [b.date],
      title: t(`Uang masuk ${shortDate(b.date)} tidak ada di Excel`, `Money in on ${shortDate(b.date)} is not in Excel`),
      detail: t(`${b.desc} ${rp(b.amount)} bukan settlement QRIS atau setoran tunai, dan tidak tercatat di Excel.`,
        `${b.desc} ${rp(b.amount)} is not a QRIS settlement or cash deposit, and is not in Excel.`),
      question: t("Uang ini dari mana: penjualan yang belum dicatat, pinjaman, atau uang pribadi? Petugas bank akan menanyakan uang masuk seperti ini.",
        "Where did this money come from: unrecorded sales, a loan, or personal money? A bank officer will ask about money in like this."),
      excel: [],
      bank: b,
    });
  }

  // 6. The same transaction posted twice by the bank (same time when the statement shows it, else same day).
  for (const [b, first] of repeats) {
    flags.push({
      id: `bankdup-${b.line}`, kind: "bank_duplicate", severity: "cek", dates: [b.date],
      title: t(`Mutasi ${shortDate(b.date)} tercatat dua kali di bank`, `A ${shortDate(b.date)} transaction appears twice on the statement`),
      detail: t(`Baris ${first.line} dan ${b.line}: ${b.desc} ${rp(b.amount)}${b.time ? `, jam ${b.time}` : ""}, sama persis.`,
        `Lines ${first.line} and ${b.line}: ${b.desc} ${rp(b.amount)}${b.time ? ` at ${b.time}` : ""}, identical.`),
      question: t("Apakah memang dibayar dua kali? Kalau tidak, minta bank membatalkan salah satunya.", "Was it really paid twice? If not, ask the bank to reverse one."),
      excel: [],
      bank: b,
    });
  }

  // 7. Unusual: far bigger than the same kind of transaction, or at an odd hour.
  const sameKind = (b: BankLine) => `${b.dir}|${b.desc.toLowerCase().split(/\s+/).slice(0, 3).join(" ")}`;
  const groups = new Map<string, BankLine[]>();
  for (const b of bank.filter((b) => !ROUTINE(b))) groups.set(sameKind(b), [...(groups.get(sameKind(b)) ?? []), b]);
  for (const b of bank.filter((b) => !ROUTINE(b) && !repeats.has(b))) {
    const others = groups.get(sameKind(b))!.filter((o) => o !== b).map((o) => o.amount).sort((x, y) => x - y);
    const median = others.length ? others[Math.floor(others.length / 2)] : 0;
    const reasons: [string, string][] = [];
    if (median && b.amount > UNUSUAL_SIZE * median)
      reasons.push([`${Math.round(b.amount / median)}x lebih besar dari biasanya (${rp(median)})`, `${Math.round(b.amount / median)}x the usual amount (${rp(median)})`]);
    if (b.time && ODD_HOURS(b.time)) reasons.push([`terjadi jam ${b.time}, di luar jam usaha`, `made at ${b.time}, outside business hours`]);
    if (!reasons.length) continue;
    flags.push({
      id: `odd-${b.line}`, kind: "unusual", severity: "cek", dates: [b.date],
      title: t(`Transaksi tidak biasa ${shortDate(b.date)}`, `Unusual transaction on ${shortDate(b.date)}`),
      detail: t(`${b.desc} ${rp(b.amount)}: ${reasons.map((r) => r[0]).join("; ")}.`, `${b.desc} ${rp(b.amount)}: ${reasons.map((r) => r[1]).join("; ")}.`),
      question: t("Ini untuk usaha atau keperluan pribadi? Kalau pribadi, sebaiknya pakai rekening terpisah.", "Was this for the business or personal? If personal, keep it in a separate account."),
      excel: [],
      bank: b,
    });
  }

  // Cash after the last deposit can't be checked yet.
  const cashChecked = new Set(weeks.flatMap((w) => w.window));
  const flagsOn = (d: string) => flags.filter((f) => f.dates.includes(d));
  const bankFor = (d: string) =>
    bank.filter((b) => b.covers?.includes(d) || weeks.some((w) => w.b === b && w.window.includes(d)));
  return {
    days: dates.map((date) => {
      const fs = flagsOn(date);
      const status: DayStatus = fs.some((f) => f.severity === "selisih") ? "selisih" : fs.length ? "cek" : pending.includes(date) || !cashChecked.has(date) ? "menunggu" : "cocok";
      return { date, cash: sum(date, "cash"), qris: sum(date, "qris"), status, flags: fs.map((f) => f.id), bank: bankFor(date) };
    }),
    flags,
    pending,
    excluded: bank.filter((b) => !b.business && b.kind !== "opening"),
    matchedBank: bank.filter((b) => b.business),
    cashRatio,
  };
}
