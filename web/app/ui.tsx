"use client";
// Shared shell and small pieces: the indigo header with step tabs, and a hand-drawn icon set.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import type { Lang, T } from "@/lib/i18n";

export const STEPS: { href: string; label: [string, string] }[] = [
  { href: "/", label: ["Kenalan", "About"] },
  { href: "/cek", label: ["Cek", "Check"] },
  { href: "/rencana", label: ["Rencana", "Plan"] },
  { href: "/impor", label: ["Impor", "Import"] },
  { href: "/cocokkan", label: ["Cocokkan", "Match"] },
  { href: "/paket", label: ["Paket", "Pack"] },
];

// Stored as the Bahasa value (it reads naturally in the bank-facing pack); shown in the chosen language.
export const BUSINESS_TYPES: [string, string][] = [
  ["Warung kelontong", "Corner shop (warung kelontong)"],
  ["Warung makan", "Food stall (warung makan)"],
  ["Toko sembako", "Grocery store (toko sembako)"],
  ["Jualan online", "Online seller"],
  ["Lainnya", "Other"],
];
export const businessTypeLabel = (t: T, v: string) => {
  const hit = BUSINESS_TYPES.find(([id]) => id === v);
  return hit ? t(...hit) : v;
};

const LANGS: [Lang, string, string][] = [["id", "ID", "Bahasa Indonesia"], ["en", "EN", "English"]];

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { profile, lang, setLang, t } = useStore();
  const nav = useRef<HTMLElement>(null);
  // Six tabs overflow a phone; keep the current one in view.
  useEffect(() => { nav.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ inline: "nearest", block: "nearest" }); }, [path]);
  return (
    <>
      <header className="shell">
        <div className="shell-top">
          <Link href="/" className="brand">Jejak</Link>
          <span className="shell-biz">{profile.businessName || t("Usaha kamu", "Your business")}</span>
          <div className="lang" role="group" aria-label={t("Bahasa", "Language")}>
            {LANGS.map(([code, short, name]) => (
              <button key={code} type="button" lang={code} aria-label={name} aria-pressed={lang === code} onClick={() => setLang(code)}>{short}</button>
            ))}
          </div>
        </div>
        <nav className="steps" aria-label={t("Langkah", "Steps")} ref={nav}>
          {STEPS.map((s) => (
            <Link key={s.href} href={s.href} aria-current={path === s.href ? "page" : undefined}>{t(...s.label)}</Link>
          ))}
        </nav>
      </header>
      <main className="page">{children}</main>
    </>
  );
}

// 20px line icons, 1.75 stroke, round caps. Decorative unless labelled.
const paths: Record<string, ReactNode> = {
  check: <path d="M4.5 10.5l3.5 3.5 7.5-8" />,
  alert: <><path d="M10 3.5l7 12.5H3z" /><path d="M10 8.5v3.2M10 14.2v.1" /></>,
  clock: <><circle cx="10" cy="10" r="6.75" /><path d="M10 6.5V10l2.5 1.8" /></>,
  file: <><path d="M5.5 2.75h6l3.75 3.75v10.75h-9.75z" /><path d="M11.5 2.75v3.75h3.75" /></>,
  bank: <><path d="M3 8h14L10 3.5z" /><path d="M5 8v6.5M8.3 8v6.5M11.7 8v6.5M15 8v6.5M3 16.75h14" /></>,
  arrow: <path d="M4 10h11.5M11 5.5l4.5 4.5-4.5 4.5" />,
  print: <><path d="M6 7.5V3h8v4.5M6 14H4V8h12v6h-2" /><path d="M6 11.5h8V17H6z" /></>,
  upload: <><path d="M10 13V3.5M6 7.5l4-4 4 4" /><path d="M3.5 13v3.5h13V13" /></>,
  info: <><circle cx="10" cy="10" r="6.75" /><path d="M10 9v4.5M10 6.5v.1" /></>,
};

export function Icon({ name, label }: { name: keyof typeof paths; label?: string }) {
  return (
    <svg className="icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
      role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {paths[name]}
    </svg>
  );
}

export function Choice<T extends string>({ name, value, options, onChange }: {
  name: string; value: T; options: [T, string][]; onChange: (v: T) => void;
}) {
  return (
    <div className="choice" role="radiogroup">
      {options.map(([v, label]) => (
        <label key={v} className={value === v ? "on" : undefined}>
          <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} />
          {label}
        </label>
      ))}
    </div>
  );
}

export const VERDICT = (t: T) => ({
  siap: t("Siap mengajukan", "Ready to apply"),
  siap_dengan_catatan: t("Siap, dengan catatan", "Ready, with cautions"),
  belum_siap: t("Belum siap", "Not ready yet"),
});

export const YES_NO = (t: T): ["ya" | "tidak", string][] => [["tidak", t("Tidak", "No")], ["ya", t("Ya", "Yes")]];
