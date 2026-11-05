// Trading partners: finds each supplier or buyer the owner names in the bank statement and
// the Excel expenses, so the owner and the bank officer can see who was paid (or paid in),
// on which day, and where each transaction sits in the records.
import type { BankLine, LedgerRow, Source } from "./read.ts";

export type Partner = { name: string; role: "supplier" | "buyer"; phone: string };

export type PartnerTxn = {
  date: string;
  amount: number;
  dir: "in" | "out";
  desc: string;
  bank?: BankLine;
  excel?: Source;
  found: "both" | "bank" | "excel"; // both = the bank line and an Excel row agree
};

export type PartnerActivity = { partner: Partner; txns: PartnerTxn[]; totalIn: number; totalOut: number };

const LEGAL = new Set(["PT", "CV", "UD", "PD", "TOKO", "TBK", "KOPERASI"]);
const words = (s: string) => s.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean);

// Every word of the name (minus PT, CV, …) must appear in the text. A text word may be the
// cut-off start of a name word, because banks truncate names ("PT SUMBER PANGAN JAY").
// ponytail: word match, not fuzzy; add edit distance if owners' spellings differ from the bank's.
export function mentions(text: string, name: string): boolean {
  const need = words(name).filter((w) => !LEGAL.has(w));
  if (!need.length) return false;
  const have = words(text);
  return need.every((n) => have.some((h) => h === n || (h.length >= 3 && n.startsWith(h))));
}

const within3Days = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) <= 3 * 864e5;

export function partnerActivity(partners: Partner[], bank: BankLine[], rows: LedgerRow[]): PartnerActivity[] {
  const expenses = rows.filter((r) => r.channel === "expense" && r.amount != null);
  const paired = new Set<LedgerRow>();
  return partners.map((partner) => { // same order as given; a blank name finds nothing
    const namesOther = (e: LedgerRow) => partners.some((o) => o !== partner && mentions(e.item, o.name));
    const txns: PartnerTxn[] = bank
      .filter((b) => b.dir && b.kind !== "opening" && mentions(b.desc, partner.name))
      .map((b) => {
        // A payment out should have its expense row: same amount within 3 days, preferring one that names the partner.
        const candidates = b.dir === "DB" ? expenses.filter((e) => !paired.has(e) && e.amount === b.amount && within3Days(e.date, b.date)) : [];
        const e = candidates.find((c) => mentions(c.item, partner.name)) ?? candidates.find((c) => !namesOther(c));
        if (e) paired.add(e);
        return { date: b.date, amount: b.amount, dir: b.dir === "CR" ? "in" : "out", desc: b.desc, bank: b, excel: e?.source, found: e ? "both" : "bank" } as PartnerTxn;
      });
    for (const e of expenses) {
      if (!paired.has(e) && mentions(e.item, partner.name))
        txns.push({ date: e.date, amount: e.amount!, dir: "out", desc: e.item, excel: e.source, found: "excel" });
    }
    txns.sort((a, b) => a.date.localeCompare(b.date));
    const total = (dir: PartnerTxn["dir"]) => txns.filter((x) => x.dir === dir).reduce((s, x) => s + x.amount, 0);
    return { partner, txns, totalIn: total("in"), totalOut: total("out") };
  });
}
