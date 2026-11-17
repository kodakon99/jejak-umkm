"use client";
// One session store for the owner's data. Lives in the browser only; nothing is sent anywhere.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { readExcel, type BankLine, type LedgerRow, type SheetMapping, type Source } from "./engine/read.ts";
import { reconcile, type Reconciliation } from "./engine/reconcile.ts";
import { evaluate, type Answers, type Readiness } from "./engine/gates.ts";
import type { Partner } from "./engine/partners.ts";
import { applyFixes, writeWorkbook, type Fix } from "./engine/fix.ts";
import { locale, pick, type Lang, type T } from "./i18n.ts";

export type Profile = {
  ownerName: string;
  businessName: string;
  businessType: string;
  monthsOperating: number;
  loanAmount: number;
  records: "excel" | "buku" | "keduanya";
  partners: Partner[]; // suppliers and buyers the officer can phone
};

export type Resolution = { kind: "betulkan" | "jelaskan"; note: string; at: string };

export type Imported = {
  excelFile: string;
  bankFile: string;
  rows: LedgerRow[];
  mappings: SheetMapping[];
  bank: BankLine[];
  skipped?: Source[]; // date cells we could not read; missing in drafts saved before it existed
  // The uploaded Excel (base64), so fixes can be applied to it. Missing in older drafts.
  // ponytail: kept in localStorage (~5 MB cap); move to IndexedDB if owners upload big workbooks.
  excelData?: string;
  confirmed: boolean;
};

type GateAnswers = Omit<Answers, "monthsOperating" | "loanAmount" | "reconciledMonths" | "openFlags">;

type State = { lang: Lang; profile: Profile; gates: GateAnswers; imported: Imported | null; resolutions: Record<string, Resolution>; fixes: Fix[] };

const EMPTY: State = {
  lang: "id",
  profile: { ownerName: "", businessName: "", businessType: "Warung kelontong", monthsOperating: 12, loanAmount: 25_000_000, records: "keduanya", partners: [] },
  gates: {
    slikOwner: "belum_cek", hasSpouse: true, slikSpouse: "belum_cek", onlineLoans: "tidak_ada", productiveLoans: "tidak_ada",
    dhn: false, sipp: false, nib: true, statementMonths: 6, hasFixedAsset: false,
  },
  imported: null,
  resolutions: {},
  fixes: [],
};

const KEY = "jejak-draft-v1";

// Drafts saved before partners existed had one supplier + phone; keep it as the first partner.
function migrate(s: State): State {
  const old = s.profile as Profile & { supplier?: string; supplierPhone?: string };
  if (Array.isArray(old.partners)) return s;
  const { supplier, supplierPhone, ...rest } = old;
  return { ...s, profile: { ...EMPTY.profile, ...rest, partners: supplier ? [{ name: supplier, role: "supplier", phone: supplierPhone ?? "" }] : [] } };
}

type Store = State & {
  rows: LedgerRow[]; // the Excel rows after the owner's fixes
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
  importFiles: (excel: { name: string; data: ArrayBuffer }, bank: { name: string; lines: BankLine[] }) => void;
  confirmMapping: () => void;
  resolve: (flagId: string, r: Omit<Resolution, "at"> | null) => void;
  addFix: (f: DistributiveOmit<Fix, "at">) => void;
  undoFix: () => void; // last one only: later fixes point at cells an earlier one may have moved
  fixedExcel: () => Blob | null;
  reset: () => void;
};

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

const toB64 = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

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
      setState(saved ? migrate({ ...EMPTY, lang, ...JSON.parse(saved) }) : { ...EMPTY, lang });
    } catch {}
    setLoaded(true);
    setNow(new Date().toISOString());
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  }, [state, loaded]);
  useEffect(() => { document.documentElement.lang = state.lang; }, [state.lang]);

  // Re-read the fixed file rather than patching rows, so the app sees exactly what the download holds.
  const rows = useMemo(() => {
    const im = state.imported;
    if (!im?.excelData || !state.fixes.length) return im?.rows ?? [];
    try {
      return readExcel(im.excelFile, new Uint8Array(writeWorkbook(applyFixes(fromB64(im.excelData), state.fixes)))).rows;
    } catch {
      return im.rows; // a fix that no longer applies must not lock the owner out; undo still works
    }
  }, [state.imported, state.fixes]);
  const { rec, recError } = useMemo(() => {
    if (!state.imported?.confirmed) return { rec: null, recError: false };
    try {
      return { rec: reconcile(rows, state.imported.bank, state.lang), recError: false };
    } catch {
      return { rec: null, recError: true };
    }
  }, [rows, state.imported, state.lang]);
  const openFlags = rec ? rec.flags.filter((f) => !state.resolutions[f.id]).length : 0;
  // Only months the bank actually confirms count as evidence, not every month typed into Excel.
  const reconciledMonths = rec ? new Set(rec.days.filter((d) => d.status === "cocok").map((d) => d.date.slice(0, 7))).size : 0;
  const readiness = evaluate(
    { ...state.gates, monthsOperating: state.profile.monthsOperating, loanAmount: state.profile.loanAmount, reconciledMonths, openFlags },
    (now ?? "2000-01-01").slice(0, 10),
    state.lang,
  );

  const store: Store = {
    ...state, rows, rec, recError, readiness, openFlags, now,
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
        fixes: [],
        imported: {
          excelFile: excel.name, bankFile: bank.name, rows: x.rows, mappings: x.mappings, skipped: x.skipped, bank: bank.lines, confirmed: false,
          excelData: toB64(excel.data),
        },
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
    addFix: (f) => setState((s) => ({ ...s, fixes: [...s.fixes, { ...f, at: new Date().toISOString() } as Fix] })),
    undoFix: () => setState((s) => ({ ...s, fixes: s.fixes.slice(0, -1) })),
    fixedExcel: () => {
      const im = state.imported;
      if (!im?.excelData) return null;
      const data = writeWorkbook(applyFixes(fromB64(im.excelData), state.fixes));
      return new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    },
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
