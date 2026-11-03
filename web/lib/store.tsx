"use client";
// One session store for the owner's data. Lives in the browser only; nothing is sent anywhere.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { readBankCsv, readExcel, type BankLine, type LedgerRow, type SheetMapping, type Source } from "./engine/read.ts";
import { reconcile, type Reconciliation } from "./engine/reconcile.ts";
import { evaluate, type Answers, type Readiness } from "./engine/gates.ts";
import { locale, pick, type Lang, type T } from "./i18n.ts";

export type Profile = {
  ownerName: string;
  businessName: string;
  businessType: string;
  monthsOperating: number;
  loanAmount: number;
  records: "excel" | "buku" | "keduanya";
  supplier: string;
  supplierPhone: string;
};

export type Resolution = { kind: "betulkan" | "jelaskan"; note: string; at: string };

export type Imported = {
  excelFile: string;
  bankFile: string;
  rows: LedgerRow[];
  mappings: SheetMapping[];
  bank: BankLine[];
  skipped?: Source[]; // date cells we could not read; missing in drafts saved before it existed
  confirmed: boolean;
};

type GateAnswers = Omit<Answers, "monthsOperating" | "loanAmount" | "reconciledMonths" | "openFlags">;

type State = { lang: Lang; profile: Profile; gates: GateAnswers; imported: Imported | null; resolutions: Record<string, Resolution> };

const EMPTY: State = {
  lang: "id",
  profile: { ownerName: "", businessName: "", businessType: "Warung kelontong", monthsOperating: 12, loanAmount: 25_000_000, records: "keduanya", supplier: "", supplierPhone: "" },
  gates: {
    slikOwner: "belum_cek", hasSpouse: true, slikSpouse: "belum_cek", onlineLoans: "tidak_ada", productiveLoans: "tidak_ada",
    dhn: false, sipp: false, nib: true, statementMonths: 6, hasFixedAsset: false,
  },
  imported: null,
  resolutions: {},
};

const KEY = "jejak-draft-v1";

type Store = State & {
  rec: Reconciliation | null;
  recError: boolean; // reconcile threw on this import (e.g. a draft saved by an older version)
  readiness: Readiness;
  openFlags: number;
  now: string | null; // ISO timestamp, null until mounted
  t: T;
  fmtDate: (iso: string, opts?: Intl.DateTimeFormatOptions) => string;
  fmtStamp: (ts: string, opts?: Intl.DateTimeFormatOptions) => string;
  setLang: (lang: Lang) => void;
  setProfile: (p: Partial<Profile>) => void;
  setGates: (g: Partial<GateAnswers>) => void;
  importFiles: (excel: { name: string; data: ArrayBuffer }, bank: { name: string; text: string }) => void;
  confirmMapping: () => void;
  resolve: (flagId: string, r: Omit<Resolution, "at"> | null) => void;
  reset: () => void;
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  // Set after mount: Next prerenders pages and must not read the clock at build time.
  const [now, setNow] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      // First visit: follow the browser, so an Indonesian phone opens in Bahasa and a reviewer's browser in English.
      const lang: Lang = navigator.language.toLowerCase().startsWith("id") ? "id" : "en";
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydrate from browser storage
      setState(saved ? { ...EMPTY, lang, ...JSON.parse(saved) } : { ...EMPTY, lang });
    } catch {}
    setLoaded(true);
    setNow(new Date().toISOString());
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  }, [state, loaded]);
  useEffect(() => { document.documentElement.lang = state.lang; }, [state.lang]);

  const { rec, recError } = useMemo(() => {
    if (!state.imported?.confirmed) return { rec: null, recError: false };
    try {
      return { rec: reconcile(state.imported.rows, state.imported.bank, state.lang), recError: false };
    } catch {
      return { rec: null, recError: true };
    }
  }, [state.imported, state.lang]);
  const openFlags = rec ? rec.flags.filter((f) => !state.resolutions[f.id]).length : 0;
  // Only months the bank actually confirms count as evidence, not every month typed into Excel.
  const reconciledMonths = rec ? new Set(rec.days.filter((d) => d.status === "cocok").map((d) => d.date.slice(0, 7))).size : 0;
  const readiness = evaluate(
    { ...state.gates, monthsOperating: state.profile.monthsOperating, loanAmount: state.profile.loanAmount, reconciledMonths, openFlags },
    (now ?? "2000-01-01").slice(0, 10),
    state.lang,
  );

  const store: Store = {
    ...state, rec, recError, readiness, openFlags, now,
    t: pick(state.lang),
    fmtDate: (iso, opts) => fmtDate(iso, opts, state.lang),
    fmtStamp: (ts, opts = { dateStyle: "medium", timeStyle: "short" }) => new Date(ts).toLocaleString(locale(state.lang), opts),
    setLang: (lang) => setState((s) => ({ ...s, lang })),
    setProfile: (p) => setState((s) => ({ ...s, profile: { ...s.profile, ...p } })),
    setGates: (g) => setState((s) => ({ ...s, gates: { ...s.gates, ...g } })),
    importFiles: (excel, bank) => {
      const x = readExcel(excel.name, excel.data);
      setState((s) => ({
        ...s,
        resolutions: {},
        imported: { excelFile: excel.name, bankFile: bank.name, rows: x.rows, mappings: x.mappings, skipped: x.skipped, bank: readBankCsv(bank.name, bank.text), confirmed: false },
      }));
    },
    confirmMapping: () => setState((s) => (s.imported ? { ...s, imported: { ...s.imported, confirmed: true } } : s)),
    resolve: (id, r) =>
      setState((s) => {
        const resolutions = { ...s.resolutions };
        if (r) resolutions[id] = { ...r, at: new Date().toISOString() };
        else delete resolutions[id];
        return { ...s, resolutions };
      }),
    reset: () => setState((s) => ({ ...EMPTY, lang: s.lang })),
  };
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
}

export const rp = (n: number) => "Rp" + Math.round(n).toLocaleString("id-ID");
export const fmtDate = (iso: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }, lang: Lang = "id") =>
  new Date(iso + "T00:00:00Z").toLocaleDateString(locale(lang), { ...opts, timeZone: "UTC" });
