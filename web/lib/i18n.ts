// Two languages, kept side by side at each call site: t("Kenalan", "About you").
export type Lang = "id" | "en";
export type T = (id: string, en: string) => string;

export const pick = (lang: Lang): T => (id, en) => (lang === "en" ? en : id);

// Dates follow the language; Rupiah stays in id-ID format (Rp1.000) in both.
export const locale = (lang: Lang) => (lang === "en" ? "en-GB" : "id-ID");
