"use client";
import Link from "next/link";
import { useState } from "react";
import { rp, useStore, type Resolution } from "@/lib/store";
import type { T } from "@/lib/i18n";
import { QRIS_FEE, type Flag, type Reconciliation } from "@/lib/engine/reconcile";
import { fixText, Icon } from "../ui";

type Day = Reconciliation["days"][number];
type CellState = Day["status"] | "dijelaskan" | "none";

const STATE_TEXT = (t: T): Record<CellState, string> => ({
  cocok: t("cocok dengan bank", "matches the bank"), selisih: t("ada selisih", "has a difference"), cek: t("perlu dicek", "worth a look"),
  menunggu: t("belum bisa dicek", "can't be checked yet"), dijelaskan: t("sudah kamu jelaskan", "explained by you"), none: t("tidak ada catatan", "no records"),
});
const DOW = (t: T) => [t("Sen", "Mon"), t("Sel", "Tue"), t("Rab", "Wed"), t("Kam", "Thu"), t("Jum", "Fri"), t("Sab", "Sat"), t("Min", "Sun")];

export default function Cocokkan() {
  const { rec, recError, resolutions, openFlags, imported, fixes, undoFix, fixedExcel, t, fmtDate } = useStore();
  const stateText = STATE_TEXT(t);
  const [picked, setPicked] = useState<string | null>(null);

  if (!rec || rec.days.length === 0) {
    return (
      <>
        <h1 className="title">{t("Cocokkan Excel dengan bank", "Match Excel with the bank")}</h1>
        <div className="empty-state">
          <b>{recError ? t("Pencocokan gagal untuk file ini", "Matching failed for this file") : t("Belum ada catatan yang diimpor", "No records imported yet")}</b>
          <p>{t(
            "Impor rekap Excel dan mutasi rekening dulu. Kami cocokkan setiap hari penjualan dengan uang yang benar-benar masuk ke bank.",
            "Import your Excel recap and bank statement first. We match every sales day with the money that actually reached the bank.")}</p>
          <div className="btn-row"><Link className="btn" href="/impor"><Icon name="upload" />{t("Impor sekarang", "Import now")}</Link></div>
        </div>
      </>
    );
  }

  const flagById = new Map(rec.flags.map((f) => [f.id, f]));
  const state = (d: Day): CellState =>
    d.flags.length && d.flags.every((id) => resolutions[id]) ? "dijelaskan" : d.status;
  const byDate = new Map(rec.days.map((d) => [d.date, d]));
  const cocok = rec.days.filter((d) => d.status === "cocok").length;
  const firstOpen = rec.days.find((d) => d.flags.some((id) => !resolutions[id]))?.date;
  const selected = byDate.get(picked ?? firstOpen ?? rec.days[0].date)!;
  const months = [...new Set(rec.days.map((d) => d.date.slice(0, 7)))];

  return (
    <>
      <div className="lead"><b>{cocok}/{rec.days.length}</b><span>{t("hari cocok dengan bank", "days match the bank")}</span></div>
      <p className="sub">
        {openFlags ? t(`${openFlags} catatan perlu kamu cek.`, `${openFlags} items need your check.`) : t("Semua catatan sudah kamu cek. Paket bukti siap dibuat.", "You've checked every item. The evidence pack is ready to make.")}
      </p>

      {months.map((m) => {
        const first = new Date(m + "-01T00:00:00Z");
        const lead = (first.getUTCDay() + 6) % 7;
        const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
        return (
          <section key={m} aria-label={fmtDate(m + "-01", { month: "long", year: "numeric" })} style={{ marginTop: 8 }}>
            <h2 className="small" style={{ fontWeight: 700, marginBottom: 6 }}>{fmtDate(m + "-01", { month: "long", year: "numeric" })}</h2>
            <div className="month">
              {DOW(t).map((d) => <div className="dow" key={d}>{d}</div>)}
              {Array.from({ length: lead }, (_, i) => <span className="cell empty" key={`e${i}`} />)}
              {Array.from({ length: count }, (_, i) => {
                const iso = `${m}-${String(i + 1).padStart(2, "0")}`;
                const d = byDate.get(iso);
                const s: CellState = d ? state(d) : "none";
                return (
                  <button key={iso} className={`cell ${s}`} disabled={!d} aria-pressed={d === selected}
                    aria-label={`${fmtDate(iso, { day: "numeric", month: "long" })}, ${stateText[s]}`} onClick={() => setPicked(iso)}>
                    {i + 1}
                    {d && s === "selisih" && d.flags.length > 1 && <small>{d.flags.length}</small>}
                    {s === "dijelaskan" && <Icon name="check" />}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      <div className="legend" aria-hidden>
        <span><i className="mark cocok" />{t("Cocok", "Matches")}</span>
        <span><i className="mark selisih" />{t("Selisih", "Difference")}</span>
        <span><i className="mark cek" />{t("Perlu dicek", "Worth a look")}</span>
        <span><i className="mark dijelaskan" />{t("Sudah dijelaskan", "Explained")}</span>
        <span><i className="mark menunggu" />{t("Belum bisa dicek", "Can't check yet")}</span>
      </div>

      <DayDetail key={selected.date} day={selected} flags={selected.flags.map((id) => flagById.get(id)!)} pending={rec.pending.includes(selected.date)} />

      {fixes.length > 0 && (
        <section className="panel" style={{ marginTop: 16 }}>
          <h2 className="small" style={{ fontWeight: 700 }}>{t(`Perubahan di Excel kamu (${fixes.length})`, `Changes to your Excel (${fixes.length})`)}</h2>
          <ul className="small" style={{ margin: "8px 0 0", paddingLeft: 18 }}>{fixes.map((f, i) => <li key={i}>{fixText(t, f)}</li>)}</ul>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button className="btn" onClick={() => {
              const blob = fixedExcel();
              if (!blob) return;
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = imported!.excelFile.replace(/(\.xlsx?)?$/i, "_dibetulkan.xlsx");
              a.click();
              URL.revokeObjectURL(a.href);
            }}><Icon name="file" />{t("Unduh Excel yang sudah dibetulkan", "Download the fixed Excel")}</button>
            <button className="btn quiet" onClick={undoFix}>{t("Batalkan perubahan terakhir", "Undo the last change")}</button>
          </div>
          <p className="small" style={{ marginTop: 8 }}>{t(
            "File aslimu tidak diubah. Yang diunduh adalah salinan dengan perubahan di atas; rumus TOTAL ikut menyesuaikan.",
            "Your original file is untouched. The download is a copy with the changes above; TOTAL formulas adjust with it.")}</p>
        </section>
      )}

      <div className="btn-row">
        <Link className="btn" href="/paket"><Icon name="print" />{t("Buat paket bukti", "Make the evidence pack")}</Link>
        <Link className="btn ghost" href="/impor">{t("Impor ulang", "Import again")}</Link>
      </div>
      <p className="small" style={{ marginTop: 16 }}>{t(
        `Sumber: ${imported?.excelFile} dan ${imported?.bankFile}. Kami hanya mengubah sel yang kamu pilih, di salinan; kamu yang memutuskan.`,
        `Sources: ${imported?.excelFile} and ${imported?.bankFile}. We only change the cells you choose, in a copy; you decide.`)}</p>
    </>
  );
}

function DayDetail({ day, flags, pending }: { day: Day; flags: Flag[]; pending: boolean }) {
  const { resolutions, t, fmtDate } = useStore();
  const stateText = STATE_TEXT(t);
  const qrisLine = day.bank.find((b) => b.kind === "qris");
  const cashLine = day.bank.find((b) => b.kind === "cash_deposit");
  const resolvedAll = flags.length > 0 && flags.every((f) => resolutions[f.id]);

  return (
    <article className="day" aria-live="polite">
      <div className="day-head">
        <h2>{fmtDate(day.date, { weekday: "long", day: "numeric", month: "long" })}</h2>
        <span className="small">{resolvedAll ? stateText.dijelaskan : stateText[day.status]}</span>
      </div>
      {flags.map((f) => <FlagItem key={f.id} flag={f} />)}
      <div className="amounts">
        <div><small>{t("Tunai di Excel", "Cash in Excel")}</small><b>{rp(day.cash)}</b></div>
        <div><small>{t("QRIS di Excel", "QRIS in Excel")}</small><b>{rp(day.qris)}</b></div>
      </div>
      <div className="src">
        {qrisLine && <span><Icon name="bank" />{t("QRIS cair", "QRIS paid out")} {fmtDate(qrisLine.date)} · {rp(qrisLine.amount)} · {t("baris", "line")} {qrisLine.line}</span>}
        {cashLine && <span><Icon name="bank" />{t("Setoran tunai", "Cash deposit")} {fmtDate(cashLine.date)} · {rp(cashLine.amount)} · {t("baris", "line")} {cashLine.line}</span>}
      </div>
      {flags.length === 0 && day.status === "cocok" && <p style={{ marginTop: 12 }}>{t("QRIS hari ini sudah cair di bank sesuai catatan, dan tunainya masuk setoran minggu itu.", "This day's QRIS was paid out by the bank as recorded, and its cash is in that week's deposit.")}</p>}
      {flags.length === 0 && day.status === "menunggu" && (
        <p style={{ marginTop: 12 }}>{pending
          ? t("QRIS hari ini baru cair setelah periode mutasi ini. Impor mutasi bulan berikutnya untuk mengeceknya.", "This day's QRIS is paid out after this statement ends. Import next month's statement to check it.")
          : t("Tunai hari ini belum disetor ke bank, jadi belum bisa dicocokkan.", "This day's cash hasn't been deposited yet, so it can't be matched.")}</p>
      )}
    </article>
  );
}

// Flags about the bank's side (money in, a double posting, an odd hour) have nothing to fix in the Excel.
const EXCEL_SIDE = new Set<Flag["kind"]>(["duplicate", "blank", "qris_mismatch", "qris_missing", "cash_week", "supplier_unmatched"]);

function FlagItem({ flag }: { flag: Flag }) {
  const { resolutions, resolve, imported, t, fmtStamp } = useStore();
  const done = resolutions[flag.id];
  const [mode, setMode] = useState<Resolution["kind"] | null>(null);
  const [note, setNote] = useState("");
  const canEdit = !!imported?.excelData; // drafts saved before fixes existed only have the parsed rows

  return (
    <div className={`flag ${done ? "done" : flag.severity}`}>
      <h3><Icon name={done ? "check" : "alert"} />{flag.title}</h3>
      <p>{flag.detail}</p>
      <div className="src">
        {flag.excel.slice(0, 4).map((s) => <span key={s.cell}><Icon name="file" />{s.sheet} {s.cell}</span>)}
        {flag.excel.length > 4 && <span>{t(`+${flag.excel.length - 4} sel lagi`, `+${flag.excel.length - 4} more cells`)}</span>}
        {flag.bank && <span><Icon name="bank" />{t("Mutasi baris", "Statement line")} {flag.bank.line}</span>}
      </div>
      {done ? (
        <div className="resolved">
          <b>{done.kind === "betulkan" ? t("Akan kamu betulkan di Excel", "You'll fix this in Excel") : t("Penjelasan kamu", "Your explanation")}:</b> {done.note || t("(tanpa catatan)", "(no note)")}
          <br /><span>{t("Dicatat", "Recorded")} {fmtStamp(done.at)}. </span>
          <button className="linkish" onClick={() => resolve(flag.id, null)}>{t("Batalkan", "Undo")}</button>
        </div>
      ) : mode === "betulkan" && canEdit ? (
        <FixForm flag={flag} onCancel={() => setMode(null)} />
      ) : mode ? (
        <div>
          <label className="field">
            <span>{mode === "betulkan" ? t("Apa yang salah di Excel?", "What's wrong in the Excel?") : t("Jelaskan untuk petugas bank", "Explain it for the bank officer")}</span>
            <textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} autoFocus
              placeholder={mode === "betulkan" ? t("Contoh: salah ketik, harusnya Rp175.000", "e.g. a typo, it should be Rp175.000") : t("Contoh: ada pembeli bayar QRIS ke rekening suami", "e.g. a customer paid by QRIS into my husband's account")} />
          </label>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button className="btn" disabled={mode === "jelaskan" && !note.trim()} onClick={() => resolve(flag.id, { kind: mode, note: note.trim() })}>{t("Simpan", "Save")}</button>
            <button className="btn quiet" onClick={() => setMode(null)}>{t("Batal", "Cancel")}</button>
          </div>
        </div>
      ) : (
        <>
          <p className="ask">{flag.question}</p>
          <div className="btn-row" style={{ marginTop: 12 }}>
            {EXCEL_SIDE.has(flag.kind) && <button className="btn" onClick={() => setMode("betulkan")}>{t("Excel salah, betulkan", "Excel is wrong, fix it")}</button>}
            <button className="btn ghost" onClick={() => setMode("jelaskan")}>{t("Jelaskan", "Explain")}</button>
          </div>
        </>
      )}
    </div>
  );
}

// Edits the owner's Excel copy. The flag disappears only if the fixed numbers really match the bank.
function FixForm({ flag, onCancel }: { flag: Flag; onCancel: () => void }) {
  const { rows, imported, addFix, t, fmtDate } = useStore();
  const at = (cell?: string) => rows.find((r) => r.source.sheet === flag.excel[0]?.sheet && r.source.cell === cell);
  // Best guess for a single wrong cell: what the bank says it should be.
  const guess = flag.excel.length !== 1 || !flag.bank ? null
    : flag.kind === "qris_mismatch" ? Math.round(flag.bank.amount / (1 - QRIS_FEE))
    : flag.kind === "supplier_unmatched" ? flag.bank.amount : null;
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(flag.excel.map((s) => [s.cell!, String(guess ?? at(s.cell)?.amount ?? "")])));
  const b = flag.bank;
  const book = imported?.mappings.find((m) => m.kind === "expense") ?? imported?.mappings.find((m) => m.kind === "kas");
  const [desc, setDesc] = useState(b?.desc ?? "");
  const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(/\D/g, "")));

  if (flag.kind === "duplicate") {
    const rowsOf = [...new Set(flag.excel.map((s) => Number(s.cell!.replace(/\D/g, ""))))].sort((x, y) => x - y);
    const [keep, ...extra] = rowsOf;
    return (
      <div>
        <p>{t(`Baris ${keep} kami simpan. Baris ${extra.join(", ")} kami hapus dari salinan Excel kamu.`, `We keep row ${keep} and delete row ${extra.join(", ")} from your Excel copy.`)}</p>
        <div className="btn-row" style={{ marginTop: 12 }}>
          {/* bottom row first, so the other row numbers don't move */}
          <button className="btn" onClick={() => extra.reverse().forEach((r) => addFix({ flag: flag.id, sheet: flag.excel[0].sheet!, dropRow: r }))}>{t("Hapus baris dobel", "Delete the extra row")}</button>
          <button className="btn quiet" onClick={onCancel}>{t("Batal", "Cancel")}</button>
        </div>
      </div>
    );
  }

  if (flag.excel.length === 0) { // a supplier payment with no expense row: add one
    if (!b || !book) return <p className="small">{t("Tidak ada sheet pengeluaran di Excel ini untuk ditambah baris.", "This Excel has no expense sheet to add a row to.")}</p>;
    const amtCol = (book.columns.amount ?? book.columns.out)!.col;
    const save = () => addFix({
      flag: flag.id, sheet: book.sheet,
      addRow: { label: `${fmtDate(b.date)} · ${desc} · ${rp(b.amount)}`, cols: { [book.columns.date!.col]: b.date, ...(book.columns.desc && { [book.columns.desc.col]: desc }), [amtCol]: b.amount } },
    });
    return (
      <div>
        <p>{t(`Kami tambahkan baris di sheet "${book.sheet}": ${fmtDate(b.date)}, ${rp(b.amount)}.`, `We'll add a row to the "${book.sheet}" sheet: ${fmtDate(b.date)}, ${rp(b.amount)}.`)}</p>
        {book.columns.desc && (
          <label className="field"><span>{t("Keterangan", "Description")}</span>
            <input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} /></label>
        )}
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="btn" disabled={!desc.trim()} onClick={save}>{t("Tambahkan ke Excel", "Add to the Excel")}</button>
          <button className="btn quiet" onClick={onCancel}>{t("Batal", "Cancel")}</button>
        </div>
      </div>
    );
  }

  const changed = flag.excel.filter((s) => num(vals[s.cell!]) !== (at(s.cell)?.amount ?? null));
  return (
    <div>
      {guess != null && <p className="small">{t("Sudah kami isi dengan angka dari bank. Ubah kalau catatanmu bilang lain.", "We filled in the bank's figure. Change it if your notes say otherwise.")}</p>}
      {flag.excel.map((s) => (
        <label className="field" key={s.cell}>
          <span>{s.sheet} {s.cell}{at(s.cell) && ` · ${fmtDate(at(s.cell)!.date)}`}</span>
          <input className="input" inputMode="numeric" value={vals[s.cell!] ? Number(num(vals[s.cell!])).toLocaleString("id-ID") : ""}
            onChange={(e) => setVals({ ...vals, [s.cell!]: e.target.value })} placeholder={t("kosong", "blank")} />
        </label>
      ))}
      <div className="btn-row" style={{ marginTop: 12 }}>
        <button className="btn" disabled={!changed.length} onClick={() => changed.forEach((s) =>
          addFix({ flag: flag.id, sheet: s.sheet!, set: { cell: s.cell!, from: at(s.cell)?.amount ?? null, to: num(vals[s.cell!]) } }))}>
          {t("Simpan ke Excel", "Save to the Excel")}
        </button>
        <button className="btn quiet" onClick={onCancel}>{t("Batal", "Cancel")}</button>
      </div>
    </div>
  );
}
