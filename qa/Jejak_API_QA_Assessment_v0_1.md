# Jejak: API Quality Assessment v0.1

**Date:** 2 November 2026 · **System under test:** Jejak engine services (`web/lib/engine`) and the store that calls them (`web/lib/store.tsx`) · **Contract:** `Jejak_Business_Service_Technical_Specification_v0_1.docx`

**Evidence:** `qa/probe.mjs`, `qa/probe2.mjs`, `qa/brick.mjs`, `qa/results.jsonl`. Rerun from `web/` with `node ../qa/probe.mjs "$PWD"`. Existing unit suite: `npm test`, 19 of 19 passing.


**Fix log (2 Nov 2026):** BUG-01, BUG-02, BUG-03 and BUG-04 are **fixed**. BUG-12 is fixed by the same change as BUG-01. Each fix has a regression test in `npm test`, which now passes 23 of 23.

| Bug | Fix | Re-test |
|---|---|---|
| BUG-01 | `toIsoDate` only accepts real calendar dates. Unreadable date cells are returned as `skipped` and named on Impor. `reconcile` is wrapped in a guard in the store (`recError`). | IMP-007/008/019 → null; REC-012/013/014 no throw. REC-B01: all 4 pages render, and Cocokkan says "Pencocokan gagal untuk file ini". |
| BUG-02 | `reconciledMonths` counts only months with a `cocok` day. Impor blocks matching when the statement has 0 business lines or there are 0 sales rows. | REC-004 → 0 months, gate **hati** |
| BUG-03 | `readBankCsv` reads `;` when the header line uses it | IMP-031 → 1 line |
| BUG-04 | `toAmount` returns null when a cell has no digit | IMP-012 → null; IMP-042 → 2 blank flags |

The sample flow (template A) still shows 17/31 days matched and the 3 planted errors.

---

## 1. Executive Summary

**Verdict:** the engine is correct on its designed path. Both sample files give the expected results and every gate boundary behaves as specified. It is fragile on real owner files. One malformed date bricks the whole app. An empty or unreadable statement counts as bank evidence. Several readers fail silently and read Rp0 or "non-business" where they should say "I could not read this". None of the validation the spec defines (status codes 20001 to 22001) is implemented.

**Top 5 risks**

| # | Risk | Bug |
|---|---|---|
| 1 | A text date in mm/dd order, such as `10/31/2026`, throws inside `reconcile()`. The app then shows "This page couldn't load" on every page, and the error survives reloads because the state is saved in localStorage. There is no reset path in the UI. | BUG-01 |
| 2 | The "Bukti penjualan" gate reaches **lulus** with no bank evidence at all: 3 months of Excel plus a statement with no deposits gives zero flags. | BUG-02 |
| 3 | A semicolon CSV (the Indonesian Excel locale default) is read as 0 lines without any error. Combined with risk 2, the owner gets a false "cocok". | BUG-03 |
| 4 | Text in a sales cell ("libur", "tutup") becomes Rp0 and suppresses the blank-cell flag. | BUG-04 |
| 5 | Supplier transfers are filed as non-business when the payee's name contains BUNGA or KELUARGA, for example `TRF KE TOKO BUNGA MAWAR`. They disappear from matching. | BUG-05 |

**Release recommendation: Go with fixes.**
- **Capstone demo on the sample data:** Go. Every sample-path case passes.
- **Real owner files:** No-Go until BUG-01 to BUG-04 are fixed. Together they are about 30 lines of change.

---

## 2. Endpoint Inventory & Coverage Matrix

The MVP has **no HTTP server**. Each spec endpoint is an in-browser function call, so the functions are the system under test. Transport, headers, auth and rate limiting exist only on paper and are reviewed as design.

| Endpoint (spec) | Method | Implemented by | Auth (spec) | Request | Response |
|---|---|---|---|---|---|
| `/jejak/v1/records/import` | POST multipart | `readExcel()`, `readBankCsv()` | api_key + x-signature | recap_file ≤5 MB, statement_file ≤1 MB | sheet_mappings, ledger_rows, statement_lines, summary |
| `/jejak/v1/reconciliations` | POST JSON | `reconcile()` | same | mapping_confirmed, ledger_rows, statement_lines | days, flags, pending_dates, excluded_lines |
| `/jejak/v1/readiness/evaluate` | POST JSON | `evaluate()`, `actionPlan()` | same | 16 answer fields | overall, gates[11], percent, action_plan |
| `/jejak/v1/receipt-packs` | POST JSON | Paket screen and `businessProfile()` | same | profile, reconciliation, resolutions | pack |

| Endpoint | Auth | Functional | Validation | Security | Flow | Performance | Coverage % |
|---|---|---|---|---|---|---|---|
| records/import | N/A (no server) | Executed | Executed | Executed (file name, type) | Code review | Not executed | 75% |
| reconciliations | N/A | Executed | Executed | Design review | Executed + browser | Executed | 85% |
| readiness/evaluate | N/A | Executed | Executed | Executed (mass assignment) | Executed | Executed | 90% |
| receipt-packs | N/A | Partial (narrative only) | Code review | Executed (HTML injection) | Code review | Not executed | 55% |

Coverage % is the share of the 12 assessment layers with an executed case. Auth is counted as not coverable.

---

## 3. Test Cases

All "Actual" values are real engine output from 2 November 2026 (Node 26, Apple Silicon) unless the row says *code inspection* or *NOT EXECUTED*. The default precondition is the sample files loaded, and "today" is 2026-11-02 for gates. Steps are "call the function with the data and read the result" unless stated otherwise.

### 3.1 Import Records (IMP)

| ID | Category | P | Test Data / Request | Expected | Actual | Status |
|---|---|---|---|---|---|---|
| API-IMP-001 | Positive | P0 | Template A | sales + expense sheets mapped | `Penjualan Harian:sales:1`, `Pengeluaran:expense:1` | Pass |
| API-IMP-002 | Positive | P0 | Template B (kas book, header row 4) | kas sheet mapped | `Kas:kas:4` | Pass |
| API-IMP-003 | Negative | P1 | Sheet without a Tanggal column | 21002, 0 mappings | 0 mappings (UI shows message, confirm disabled) | Pass |
| API-IMP-004 | Negative | P2 | Header row only, no data | 0 rows, owner told | 0 rows; confirm still enabled; pack prints NaN (see PKG-002) | Pass (reader) |
| API-IMP-005 | Boundary | P2 | Header at row 15 (max) | detected | 1 row | Pass |
| API-IMP-006 | Boundary | P2 | Header at row 16 (max+1) | not detected | 0 mappings | Pass |
| API-IMP-007 | Validation | P1 | Text date `31/02/2026` | rejected (null) | `"2026-02-31"` | **Fail** BUG-12 |
| API-IMP-008 | Validation | P0 | Text date `13/13/2026` | rejected | `"2026-13-13"` → crash downstream | **Fail** BUG-01 |
| API-IMP-019 | Validation | P0 | US text date `10/31/2026` | rejected or flagged | `"2026-31-10"` → crash downstream | **Fail** BUG-01 |
| API-IMP-020 | Positive | P1 | `05-10-2026`, `2026-10-05`, serial 46300 | all `2026-10-05` | all `2026-10-05` | Pass |
| API-IMP-010 | Validation | P2 | Sales cell `-500000` | rejected or flagged | `-500000` accepted | **Fail** BUG-09 |
| API-IMP-011 | Positive | P1 | Sales cell text `Rp175.000` | 175000 | 175000 | Pass |
| API-IMP-012 | Validation | P0 | Sales cell `abc` | null (blank flag) | `0` | **Fail** BUG-04 |
| API-IMP-042 | Validation | P0 | Sales cells `libur`, `tutup` | 2 blank flags | amounts `[0, 0]`, 0 blank flags | **Fail** BUG-04 |
| API-IMP-013 | Logic | P2 | Headers `Tanggal, Cashback, Penjualan Tunai` | cash = Penjualan Tunai | cash = `Cashback` | **Fail** BUG-14 |
| API-IMP-014 | Unicode | P2 | Sheet `Kas 💰`, desc `Jual kopi ☕ — Bu Ñ` | preserved | preserved, cell C2 | Pass |
| API-IMP-015 | Type | P2 | CSV text renamed `.xlsx` | 21001 | parsed, 1 row (SheetJS is lenient; mapping preview still gates it) | Pass (deviation from spec noted) |
| API-IMP-016 | Corrupt file | P1 | 4 KB random bytes as `.xlsx` | 21001 | 0 rows, no error raised | Pass (reader); UI shows no reason |
| API-IMP-017 | Empty file | P1 | 0-byte `.xlsx` | 21001 | 0 rows, no error | Pass (reader) |
| API-IMP-018 | Security | P1 | File name `../../etc/passwd.xlsx` | treated as data only | kept verbatim in `source.file`; never used as a path (no fs access in app) | Pass |
| API-IMP-043 | Max size + 1 | P1 | 5 MB + 1 byte recap | 21001 | *code inspection:* no size check in `app/impor/page.tsx` | **Fail** GAP |
| API-IMP-030 | Positive | P0 | Sample CSV | lines parsed and classified | 34 lines, 29 business, 4 excluded | Pass |
| API-IMP-031 | Negative | P0 | Semicolon-delimited CSV | parsed or 21003 | 0 lines, no error | **Fail** BUG-03 |
| API-IMP-032 | Negative | P1 | Line with 2 fields | line skipped, reported | `TypeError: Cannot read properties of undefined (reading 'replace')`, raw text shown to owner | **Fail** BUG-07 |
| API-IMP-033 | Negative | P1 | Header only | 21003 | 0 lines, no error | **Fail** BUG-03 |
| API-IMP-034 | Logic | P0 | `TRF KE TOKO BUNGA MAWAR` DB | supplier | `interest` (excluded) | **Fail** BUG-05 |
| API-IMP-035 | Logic | P0 | `TRF KE UD KELUARGA JAYA` DB | supplier | `personal` (excluded) | **Fail** BUG-05 |
| API-IMP-036 | Boundary | P1 | `02/01/2027 SETTLEMENT QRIS 31/12-01/01` | covers 2026-12-31, 2027-01-01 | `[]` | **Fail** BUG-06 |
| API-IMP-037 | Negative | P2 | `QRIS MERCHANT` with no date range | covers empty, flagged clearly | covers `[]` (see REC-006) | Pass (reader) |
| API-IMP-038 | Edge | P2 | UTF-8 BOM at start | parsed | 1 line | Pass |
| API-IMP-039 | Edge | P3 | `"TRF ""BU RINA"""` | desc `TRF "BU RINA"` | desc keeps the doubled quotes | **Fail** BUG-16 |
| API-IMP-040 | Edge | P2 | Mutasi `1.000,50` | 1000.5 | 1000.5 | Pass |
| API-IMP-041 | Validation | P2 | Direction `cr` lowercase | CR | `""`, so the credit is ignored | **Fail** BUG-13 |
| API-IMP-A01 | Auth | P1 | No `x-signature` | 401 30001 | — | NOT EXECUTED: no server |

### 3.2 Reconcile Records (REC)

| ID | Category | P | Test Data / Request | Expected | Actual | Status |
|---|---|---|---|---|---|---|
| API-REC-001 | Positive | P0 | Template A + sample CSV | 3 planted errors + 1 cash week | duplicate 23/10, blank 19/10, qris_mismatch 12/10, cash_week 19–25/10 | Pass |
| API-REC-002 | Positive | P0 | Template B + sample CSV | 0 flags | 0 flags, pending 30–31/10 | Pass |
| API-REC-003 | Negative | P0 | Template B + empty statement | 21003, or every day flagged | 0 flags, all days `menunggu` | **Fail** BUG-02/03 |
| API-REC-004 | Logic | P0 | 3 months cash-only Excel + statement with only SALDO AWAL and BIAYA ADM | sales_evidence ≠ lulus | 0 flags, reconciledMonths 3, gate **lulus** | **Fail** BUG-02 |
| API-REC-005 | Logic | P1 | Excel months outside the statement period | flagged | 32 flags (qris_missing, cash_week) | Pass |
| API-REC-006 | Negative | P1 | QRIS credit with no covered dates | readable flag | `qris_mismatch`, dates `[]`, title `"QRIS  beda dengan bank"` | **Fail** BUG-06 |
| API-REC-007 | Boundary | P0 | QRIS 100,000 gross; credit exactly Rp1,000 off / Rp1,001 off | 0 flags / 1 flag | 0 / 1 | Pass |
| API-REC-010 | Boundary | P1 | Supplier debit vs expense 3 days / 4 days apart | matched / flagged | 0 / 1 | Pass |
| API-REC-008 | Edge | P2 | Two cash deposits on one day | no crash | 1 cash_week flag, no crash | Pass |
| API-REC-009 | Data integrity | P1 | Same row typed 3 times | 1 duplicate flag with 3 cells | 1 flag, 3 cells | Pass |
| API-REC-012 | Negative | P0 | Row date `10/31/2026` (text) | row skipped and reported | `RangeError: Invalid time value` | **Fail** BUG-01 |
| API-REC-013 | Negative | P0 | Row date `13/13/2026` | same | `RangeError: Invalid time value` | **Fail** BUG-01 |
| API-REC-014 | Negative | P1 | Row date `31/02/2026` | rejected | day `2026-02-31` shown as selisih | **Fail** BUG-12 |
| API-REC-B01 | Flow / resilience | P0 | Browser: stored import with a `2026-31-10` row, `confirmed: true`. Load `/`, `/cek`, `/cocokkan` | error contained to Cocokkan, with a way to re-import | all 3 pages: "This page couldn't load", and it persists across reload | **Fail** BUG-01 |
| API-REC-015 | Flow | P1 | Re-import after explaining flags | explanations kept for flags that persist | *code inspection* `store.tsx:97` `resolutions: {}` wipes all | **Fail** GAP-F2 |
| API-REC-016 | Logic | P0 | Mark every flag `betulkan`, never fix the Excel | flags stay open until a re-import shows the fix | *code inspection* `store.tsx:82` counts any resolution as closed, so sales_evidence → lulus | **Fail** GAP-L1 |
| API-REC-017 | Validation | P2 | `jelaskan` with an empty note | rejected | *code inspection* accepted; pack prints "(tanpa catatan)" | **Fail** GAP-L2 |
| API-REC-018 | Validation | P1 | `mapping_confirmed: false` | 409 22001 | UI gate only (`confirmMapping`), no check in `reconcile()` | Pass (UI) / NOT EXECUTED (service) |
| API-REC-011 | Performance | P1 | 2,000 rows + 1,000 lines | ≤300 ms | 265 ms on Apple Silicon | Pass, at risk (see §6) |
| API-REC-S01 | Security | P1 | Tampered ledger in request body | server re-derives from files | design: the service trusts client-sent rows | NOT EXECUTED; design finding GAP-S2 |
| API-REC-A01 | Auth | P1 | Expired `x-timestamp` (>300 s) | 401 30002 | — | NOT EXECUTED: no server |

### 3.3 Evaluate Readiness (EVA)

| ID | Category | P | Test Data / Request | Expected | Actual | Status |
|---|---|---|---|---|---|---|
| API-EVA-001 | Positive | P0 | All answers clean | siap, 11/11, 100% | siap, 11, 100 | Pass |
| API-EVA-011 | Boundary | P0 | months_operating 5 / 6 / 11 / 12 | blokir / hati / hati / lulus | same | Pass |
| API-EVA-012 | Boundary | P0 | statement_months 5 / 6 | blokir / lulus | same | Pass |
| API-EVA-013 | Boundary | P1 | loan 100,000,000 / 100,000,001, no asset | lulus / hati | same | Pass |
| API-EVA-002 | Boundary | P1 | kol2, bad until 2026-05-01 | lulus (6 months) | lulus | Pass (see Q3) |
| API-EVA-003 | Boundary | P1 | kol2, bad until 2026-06-01 | blokir, ready 2026-12-01 | same | Pass |
| API-EVA-004 | Validation | P1 | kol2 without bad-until | 20001 | blokir, ready = today + 6 months (moves daily) | **Fail** (contract) GAP-L3 |
| API-EVA-006 | Edge | P2 | kol2, bad until in the future | blokir | blokir, 2027-09-01 | Pass |
| API-EVA-007 | Validation | P0 | statement_months `NaN` | 20001 / blokir | **lulus** | **Fail** BUG-09 |
| API-EVA-008 | Validation | P0 | months_operating `NaN` | 20001 / blokir | **lulus**, reason "Usaha berjalan NaN bulan." | **Fail** BUG-09 |
| API-EVA-009 | Validation | P2 | months_operating `-3` | 20002 | blokir, "Usaha baru berjalan -3 bulan." | **Fail** BUG-09 |
| API-EVA-010 | Validation | P2 | months_operating 5.5 | ready date after today | blokir, ready = today | **Fail** BUG-09 |
| API-EVA-014 | Validation | P2 | loan 0 / -5 | 20002 | "dalam rentang KUR Mikro" | **Fail** BUG-15 |
| API-EVA-015 | Validation | P0 | slik_owner `macet` (unknown enum) | 20002 / not lulus | **lulus** "SLIK kamu bersih." | **Fail** BUG-09 |
| API-EVA-016 | Validation | P0 | online_loans `TELAT` (case) | 20002 / blokir | **lulus** | **Fail** BUG-09 |
| API-EVA-017 | Validation | P2 | in_dhn `"false"` (string) | 20002 | blokir | **Fail** BUG-09 |
| API-EVA-020 | Validation | P2 | open_flags `-1` | 20002 | lulus | **Fail** BUG-09 |
| API-EVA-021 | Validation | P1 | as_of_date `02/11/2026` | 20002 | `RangeError: Invalid time value` | **Fail** BUG-09 |
| API-EVA-018 | Logic | P2 | months_operating 3 on 2026-08-31 | ready 2026-11-30 | 2026-12-01 | **Fail** BUG-11 |
| API-EVA-027 | Logic | P1 | 05:00 WIB on 2 Nov | as_of 2026-11-02 | `2026-11-01` (UTC date, `store.tsx:86`) | **Fail** BUG-10 |
| API-EVA-019 | Positive | P1 | open_flags 0 / 1 | lulus / hati | same | Pass |
| API-EVA-023 | Logic | P1 | NIB missing + statements 3 | belum_siap, ready 2027-02-02, 1 undated | same | Pass |
| API-EVA-024 | Flow | P1 | Action plan order | blockers you can fix now first | nib, statements, online_loans | Pass |
| API-EVA-022 | Security | P1 | Mass assignment `isAdmin`, `overall: "siap"` | ignored | ignored, verdict computed | Pass |
| API-EVA-026 | Data integrity | P2 | Same input twice | identical | identical | Pass |
| API-EVA-025 | Performance | P2 | 10,000 calls | ≤20 ms each | 0.0018 ms each | Pass |
| API-EVA-028 | Validation | P2 | UI: owner types `5,5` months | 5 or rejected | *code inspection* `app/page.tsx:11` strips non-digits → 55 | **Fail** BUG-15 |
| API-EVA-A01 | Auth | P1 | Wrong api_key | 401 30001 | — | NOT EXECUTED: no server |

### 3.4 Generate Receipt Pack (PKG)

| ID | Category | P | Test Data / Request | Expected | Actual | Status |
|---|---|---|---|---|---|---|
| API-PKG-001 | Positive | P0 | Template B | clean narrative | "…31 hari… Rp27.640.000… 25 dari 31 hari sudah cocok…" | Pass |
| API-PKG-004 | Guardrail | P0 | Template A | no score or percentage | none | Pass |
| API-PKG-002 | Boundary | P1 | Reconciliation with 0 days | sensible text | "tunai Rp0 **(NaN%)** … rata-rata **RpNaN** per hari" | **Fail** BUG-08 |
| API-PKG-003 | Boundary | P1 | 1 day, all sales 0 | sensible text | "(NaN%)" | **Fail** BUG-08 |
| API-PKG-005 | Security | P0 | owner_name `<img src=x onerror=alert(1)>` | rendered as text | engine passes it through; React escapes it; no `dangerouslySetInnerHTML` in `app/` | Pass |
| API-PKG-006 | Validation | P1 | Resolution for unknown flag `qris-99` | 20002 | *code inspection:* resolutions are keyed by flag ID, so unknown IDs are never printed | Pass (UI) |
| API-PKG-007 | Integrity | P1 | Edit localStorage, then print | pack shows it was altered | *code inspection:* no integrity marker on the pack | **Fail** GAP-S2 |
| API-PKG-A01 | Auth | P1 | Replay a signed request with a new body within 300 s | rejected | — | NOT EXECUTED; design finding GAP-S1 |

**Totals:** 91 cases: 43 Pass, 43 Fail, 5 Not Executed. All 5 Not Executed cases are auth or design cases with no server to test against. Of the 43 failures, 37 were executed and 6 were confirmed by code inspection.

---

## 4. Bug Report

| Bug ID | Title | Severity | Endpoint | Steps to Reproduce | Evidence | Expected vs Actual | Root-cause hypothesis | Suggested fix |
|---|---|---|---|---|---|---|---|---|
| BUG-01 | Unparseable date bricks the app on every page | **Blocker** | reconciliations | 1) Excel with Tanggal `10/31/2026` (text). 2) Impor → "Benar, cocokkan". 3) Open any page and reload | REC-012/013 `RangeError: Invalid time value`; REC-B01 all pages show "This page couldn't load" after reload | Exp: row skipped with its cell named. Act: whole app down and stays down | `toIsoDate` regex accepts any 1–2 digits (`read.ts:66`). `addDays().toISOString()` throws. `reconcile()` runs inside `StoreProvider` with no guard, and the bad state is saved | Validate a date by round-trip (`new Date(iso).toISOString().slice(0,10) === iso`), otherwise return null and count skipped rows. Wrap `reconcile` in try/catch in `store.tsx:81` and offer "Impor ulang" |
| BUG-02 | Sales-evidence gate passes with no bank evidence | **Critical** | reconciliations → evaluate | Cash-only Excel for Aug–Oct + statement without deposits → Cek | REC-004: 0 flags, months 3, gate `lulus` | Exp: hati "belum ada setoran yang bisa dicocokkan". Act: "3 bulan penjualan sudah cocok dengan bank." | `reconciledMonths` counts Excel months (`store.tsx:83`), not matched months. `menunggu` days count as evidence | Count only months with ≥1 `cocok` day. Raise 21003 when a statement has 0 business lines |
| BUG-03 | Semicolon or empty statement read as 0 lines silently | Major | import | Upload a CSV saved by Excel with ID locale (`;`) | IMP-031 0 lines; IMP-033 0 lines; no error | Exp: parsed, or 21003. Act: silent | `parseCsvLine` hard-codes `,` | Pick the delimiter from the header line (`;` vs `,`). Error on 0 dated lines |
| BUG-04 | Text in a sales cell becomes Rp0 | Major | import | Sales cell `libur` | IMP-042 `[0,0]`, 0 blank flags | Exp: null → blank flag. Act: 0, no flag | `toAmount`: stripping non-digits leaves `""`, and `Number("")` = 0 (`read.ts:75`) | Return null when the string has no digit |
| BUG-05 | Supplier transfers misfiled as non-business | Major | import | Statement line `TRF KE TOKO BUNGA MAWAR` | IMP-034 `interest`; IMP-035 `personal` | Exp: supplier. Act: excluded from matching | First-match rules; `personal` and `interest` come before `supplier` and match as substrings (`read.ts:137-140`) | Move `supplier` above `personal`/`interest`. Anchor interest to `^(BUNGA|PAJAK BUNGA)` |
| BUG-06 | QRIS settlement over the year end not matched | Major | import / reconcile | `02/01/2027 SETTLEMENT QRIS 31/12-01/01` | IMP-036 covers `[]`; REC-006 title `"QRIS  beda dengan bank"`, dates `[]` | Exp: covers 31/12–01/01. Act: spurious mismatch + qris_missing | `expandCovers` uses the statement year for both ends | If the start month > the statement month, use year − 1. If covers is empty, raise a `cek` flag with its own wording |
| BUG-07 | Short CSV line crashes the reader and shows a raw JS error | Major | import | Line `02/10/2026,SETORAN TUNAI` | IMP-032 `TypeError … reading 'replace'` | Exp: line skipped and reported. Act: import fails with internals in the message | `mutasi` undefined (`read.ts:162`) | `mutasi = ""` default. Show a Bahasa message and keep the raw error for logs |
| BUG-08 | Bank-facing pack prints NaN | Major | receipt-packs | Recap with header only → Paket | PKG-002/003 "(NaN%)", "RpNaN" | Exp: "Belum ada penjualan tercatat." Act: NaN in a document for the bank | Division by 0 in `businessProfile` (`coach.ts`) | Guard `days === 0` and `cash + qris === 0`. Block Paket when there are no days |
| BUG-09 | Gates fail open on unknown or invalid input | Major | evaluate | `slik_owner: "macet"`, `statement_months: NaN` | EVA-007/008/015/016 → lulus; EVA-021 throws | Exp: 20001/20002, or not lulus. Act: lulus | Each check tests the bad values and falls through to `pass` | Test the pass values explicitly; anything else → hati "jawaban belum lengkap". Add a schema check at the boundary (also guards old localStorage shapes) |
| BUG-10 | "Today" is the UTC date | Minor | evaluate | Open Cek at 00:00–06:59 WIB | EVA-027 `2026-11-01` at 05:00 WIB on 2 Nov | Exp: local date. Act: yesterday | `toISOString().slice(0,10)` (`store.tsx:86`) | `new Date().toLocaleDateString("sv-SE")` (the device's local date) |
| BUG-11 | `addMonths` overflows at month end | Minor | evaluate | operating 3 on 31 Aug | EVA-018 2026-12-01 | Exp: 2026-11-30. Act: 2026-12-01 | `setUTCMonth` rolls over | Clamp to the last day of the target month |
| BUG-12 | Impossible date 31/02 accepted | Minor | import | Tanggal `31/02/2026` | IMP-007, REC-014 | Exp: rejected. Act: day "2026-02-31" | Same as BUG-01 | Same fix as BUG-01 |
| BUG-13 | Lowercase direction ignored | Minor | import | `cr` | IMP-041 `""` | Exp: CR. Act: the credit is dropped | Exact compare | `dir.toUpperCase()` |
| BUG-14 | "Cashback" read as the cash column | Minor | import | Headers `Tanggal, Cashback, Penjualan Tunai` | IMP-013 | Exp: Penjualan Tunai. Act: Cashback | `/tunai|cash/` matches the substring | Exclude `cashback`, or prefer `tunai` |
| BUG-15 | Numeric inputs mangled or unchecked | Minor | evaluate (UI) | Type `5,5` months; leave the loan empty | EVA-028 → 55; EVA-014 loan 0 → "dalam rentang KUR Mikro" | Exp: 5 / prompt. Act: 55 / pass | `replace(/\D/g, "")` | Parse the integer part. Treat loan 0 as "belum diisi" (hati) |
| BUG-16 | CSV `""` escape not decoded | Minor | import | `"TRF ""BU RINA"""` | IMP-039 | Exp: `TRF "BU RINA"`. Act: raw quotes | Regex parser | Handle `""` in `parseCsvLine` |

---

## 5. Gap Analysis

**Logic gaps**
- **GAP-L1.** `betulkan` ("I'll fix the Excel") closes a flag at once. An owner can tap it on every flag and pass sales_evidence without fixing anything. The flag should stay open until a re-import shows the fix.
- **GAP-L2.** `jelaskan` accepts an empty note, so the pack prints "Penjelasan: (tanpa catatan)" to the bank.
- **GAP-L3.** kol2 without a month gives a ready date of today + 6 months, which moves every day. The spec marks the month as Conditional/Mandatory.
- **GAP-L4.** `reconciledMonths` counts any calendar month touched: one row on 31 August counts as a month. Count months with at least about 20 recorded days instead.
- **GAP-L5.** Cash is only checked when there are ≥3 deposits. With 1 or 2 deposits, no cash check runs at all and no flag says so.

**Flow gaps**
- **GAP-F1.** There is no recovery path from a crashed state (BUG-01). Reset exists in the store, but no screen that still renders offers it.
- **GAP-F2.** Re-import wipes every resolution (`store.tsx:97`). This is the expected loop ("fix the Excel, import again"), and it costs the owner every explanation already written.
- **GAP-F3.** No "Hapus semua data" (delete all data) action. On a shared family phone, names, phone numbers and sales stay in localStorage indefinitely.
- **GAP-F4.** A file the reader cannot use (IMP-016/017) gives an empty preview with no reason.

**Missing validations** (the spec defines them; the implementation has none):
- 20001 and 20002 on every Evaluate field.
- 21001 file type and size limits (5 MB / 1 MB).
- 21003 for a statement with no dated lines.
- 22001 in the service, not just the UI.
- A row-level skipped-rows count in the import summary.

**Missing endpoints for the flow** (when a server exists):
- Persist and list resolutions.
- Re-check after a fix, returning the diff against the previous reconciliation.
- Delete my data.

**Doc vs behavior**
- None of the 10 status codes is emitted.
- Spec §6 performance assumes the server. On-device budgets for low-end Android are not stated.
- Spec says a file that cannot be parsed returns 21001; the reader returns 0 rows without error.

**Security (design)**
- **GAP-S1.** `x-signature = sha256(api_key + secret + timestamp)` signs neither the body nor the path. Any captured request can be replayed with a different body for 300 s. Also, a secret shipped in a browser client is public. Use an HMAC over method + path + timestamp + body hash, issued per session by the server, with a nonce cache.
- **GAP-S2.** Receipt Pack trusts the reconciliation the client sends. The printed pack has no integrity marker, so an edited pack looks the same as a genuine one. The mitigation in place is that every number cites its Excel cell or statement line, which the officer can check against the original book. Add a hash of the two source files and the result, printed on the pack.

**Checked and passing**
- XSS: React escapes everything; there's no `dangerouslySetInnerHTML`.
- SheetJS 0.20.3 is past the prototype-pollution fix (0.19.3) and the ReDoS fix (0.20.2).
- The app makes no network calls besides fetching `/samples`.
- Mass assignment is ignored (EVA-022).

---

## 6. Improvement Recommendations

**Quick wins** (≤1 hour each)

| Problem | Impact | Recommendation | Benefit |
|---|---|---|---|
| BUG-01 | Total outage for the owner | Round-trip date check + try/catch around `reconcile` | No crash class left in the reader |
| BUG-02 | False "ready" signal | Count matched months; 0 business lines → flag | The core claim, "cocok dengan bank", is true again |
| BUG-04, BUG-13, BUG-16 | Silent wrong numbers | One-line fixes in `read.ts` | Fewer silent misreads |
| BUG-08 | NaN on a bank document | Zero guard | The pack never embarrasses the owner |
| BUG-10, BUG-11 | Off-by-one dates | Local date; clamp the month end | Correct "paling cepat" dates |

**Medium effort** (half a day)

| Problem | Impact | Recommendation | Benefit |
|---|---|---|---|
| BUG-09, missing validation | Fails open | One `validateAnswers()` returning spec codes; whitelist the enums | Same contract in the browser and on a future server |
| BUG-03, BUG-05, BUG-06 | Real bank exports misread | Delimiter sniffing; reorder and anchor the rules; year rollover | Works on BRI/BNI/Mandiri exports, not just the sample |
| GAP-F2, GAP-L1 | Lost work; flags gamed | Keep resolutions by flag ID across re-imports; `betulkan` stays open until the value changes | The loop the product is built around works |
| REC-011 at 265 ms on a fast laptop | Likely 1–2 s on a low-end Android (suspected, not measured) | Index rows by date once (`Map<date, rows>`) and drop the `filter`-per-day scans | Stays under budget on target phones |

**Strategic**

| Problem | Impact | Recommendation | Benefit |
|---|---|---|---|
| GAP-S1 | Auth on paper is replayable | HMAC over the request, per-session keys, nonce | Production-grade contract |
| GAP-S2 | Pack can be forged | Print a hash of the files and the result; optionally a server-signed QR | Officer can verify in seconds |
| No real-file corpus | All tests use 2 synthetic files | Collect 10 anonymised real exports (3 banks, 2 Excel templates) as fixtures | Catches the BUG-03/05 class before users do |

---

## 7. Automation Plan

| Tier | What | Tool | Where in CI |
|---|---|---|---|
| Smoke (P0, <5 s) | IMP-001/002/030, REC-001/002/004/012, EVA-001/007/015, PKG-002 | `node:test` (already in `npm test`); move `qa/probe.mjs` cases in as asserts | Every push, pre-merge (GitHub Actions `npm test`) |
| Regression | All 91 cases plus one fixture per bug | `node:test` with table-driven cases | Every PR |
| Property / fuzz | Random dates, amounts, CSV lines → never throws, never NaN | `fast-check` (dev dependency only) | Nightly |
| E2E | Impor → Cocokkan → Paket on both samples + the BUG-01 file; assert no error page | Playwright (mobile viewport 360×800, CPU throttle 4×) | Every PR |
| Contract (once a server exists) | Status codes, headers, schema per spec | Postman collection + Newman, generated from the spec tables | Post-deploy to staging |
| Performance | REC-011 at 6 months of data under 4× CPU throttle | Playwright trace, or k6 against the server later | Weekly |

Start with the smoke tier. It reuses the existing runner and costs nothing new.

---

## 8. Assumptions, Risks & Open Questions

**Assumptions**
- The four engine functions are the services; the spec's contract is the expected behaviour.
- "Today" is 2026-11-02.
- All test data is synthetic: the repo samples, workbooks generated in memory by `probe.mjs`, and fictional names ("Rina Fiktif").

**Not tested**
- HTTP transport, auth, rate limiting, CORS and concurrency: there is no server.
- Real bank exports.
- Low-end Android performance.
- The print/PDF output.
- Screen reader behaviour.

**Risks**
- Every result comes from two synthetic files. Real-file variety is the largest untested surface.

**Open questions**
1. **Q1.** Should a `betulkan` flag count as resolved before the owner re-imports? (GAP-L1)
2. **Q2.** Which banks' CSV exports must the MVP support? This decides BUG-03 and BUG-05 scope.
3. **Q3.** For the SLIK rule: kol 2 last seen in May. Is the owner clean on 1 November or 1 December? BNI's wording "6 bulan terakhir" allows both; the engine says 1 November.
4. **Q4.** Should Paket be blocked, or only warn, when the reconciliation has 0 days or 0 business lines?
