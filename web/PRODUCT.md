# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Next.js 16 (App Router) + TypeScript, plain CSS (no Tailwind), SheetJS for Excel. Chosen with the user: more screens and APIs are coming, and API routes will keep the Claude key server-side later. No backend or database yet; all data stays in the browser.

## Users
Indonesian micro business owners (UMKM: warung, food stalls, small retail), 6+ months operating, wanting Rp10–50M through KUR Mikro. MVP user is Segment A: owners who write cash sales in a handwritten book, then recap daily in a free Excel template, and take cash and QRIS into one bank account. Confirmed: younger and app-savvy (like the three interviewed owners), so denser screens are fine. Bahasa Indonesia, informal register.

Secondary (not app users): bank micro/KUR officers who sample the receipt pack, and the main supplier or buyer an officer may phone.

## Product Purpose
A coach, not a credit score. It tells the owner whether they would pass KUR prescreening, which gate blocks them and when they can be ready, and turns their existing Excel recap and bank statement into a cross-verified receipt pack an officer can check in minutes. Success: owners find blockers before applying (a rejection means waiting at least 6 months), and officers verify faster.

## Positioning
Reconciliation, not export. Recording apps already export sales; officers still match them by hand against the rekening koran. Jejak does that match, links every number to its source cell or statement line, and models readiness as the bank's pass/fail gates instead of a blended score.

## Operating Context
- Owner flow: onboarding → readiness gate check → action plan if blocked → import Excel + bank statement → reconcile day by day → export receipt pack + KUR document checklist → apply at the bank.
- QRIS settles next business day (Fri–Sun on Monday, net of a fee); cash is deposited weekly, so it can only be checked per week.
- Pack is printed or shared as PDF and read by an officer who samples entries.

## Capabilities and Constraints
- Deterministic rules decide gate results (versioned, each cites its public rule or common bank practice; interview provenance stays in the PRD). AI, now rules-based stand-ins, only reads, matches and explains.
- Guardrails: never say approved/"disetujui"/eligible, only readiness ("kesiapan"); never generate or alter receipts; show every rule's source and say when it varies by bank; don't push new borrowing; owner controls all sharing; always answer "what if I'm still rejected".
- Owner confirms or explains every flag; the engine never edits source data.
- Must work on low-end Android phones.
- Out of scope now: book-page photos (F4), chat onboarding, SLIK reader, PWA/offline, accounts, PDF statements from banks other than the Mandiri-style layout.
- Not yet decided: DSC minimums, collateral rules above Rp100 juta (collateral gate is a caution; each bank decides).

## Brand Commitments
Name: **Jejak** ("trace / track record"), chosen by the user. Bahasa Indonesia UI, informal, no banking jargon without a plain explanation.

## Evidence on Hand
Synthetic sample set only (fictional warung, Oct 2026): `../owner_recap_templateA.xlsx` (3 planted errors), `../owner_recap_templateB.xlsx` (clean), `../bank_statement_sample.csv`, `../ground_truth_ledger.csv`. Banker interviews cited in the PRD (Mandiri, BNI, KUR officer). No real owner data, testimonials, partner banks or approval outcomes exist; never fabricate them.

## Product Principles
1. Gates first, business second: one blocked gate means "belum siap", however good the sales look.
2. Every number shows where it came from.
3. Honest over encouraging: never imply approval; give the date, not false hope.
4. The owner's records, the owner's call: propose, never overwrite; nothing leaves without explicit export.
