# Sample data for the UMKM prototype (synthetic)

All data is invented for testing: a fictional warung, October 2026. Layouts are illustrative. Real bank statements and owner templates differ, so replace or extend these with real, redacted files from your owners and banks.

## Files

| File | What it is |
| --- | --- |
| `ground_truth_ledger.csv` | Answer key: true daily cash and QRIS sales (date, channel, amount_idr) |
| `bank_statement_sample.csv` | Bank statement: Tanggal, Keterangan, Mutasi, DB/CR, Saldo. QRIS settlements (net of an illustrative 0.7% fee), weekly cash deposits, supplier debits, personal transfers, fees |
| `owner_recap_templateA.xlsx` | Owner Excel, 3 sheets: Penjualan Harian, Pengeluaran, Stok. Contains planted errors |
| `owner_recap_templateB.xlsx` | Same business in a different layout: one "Kas" sheet, merged title row, header on row 4, running Saldo. Clean control |
| `generate_samples.py` | Regenerates everything (seeded, so output is repeatable) |

## Planted errors in template A (what the Reconciler should find)

| Date | Error | Truth | In Excel |
| --- | --- | --- | --- |
| 12 Oct 2026 | QRIS overstated by Rp300,000 | Rp175,000 | Rp475,000 |
| 19 Oct 2026 | Cash sale never typed in | Rp520,000 | blank |
| 23 Oct 2026 | Row entered twice | one row | two identical rows |

## Things that make reconciliation realistic

- QRIS settles the next business day; Friday to Sunday sales settle together on Monday as one credit. Sales on 30 and 31 Oct settle in November, so they are not on this statement.
- Cash is deposited weekly as about 70% of the prior week's cash sales, so cash can only be matched in aggregate.
- Two non-business items sit in the statement: a personal transfer out (15 Oct) and a transfer in from a relative (21 Oct).
- Template B shows layout variety only: merged cells, a title above the header, mixed entries per day.

## Format sources

- Stock sheet columns follow a common free Indonesian template: Tanggal, Kode Barang, Nama Barang, Stok Awal, Barang Masuk, Barang Keluar, Stok Akhir, Keterangan.
- BCA e-Statement and internet banking downloads (PDF; CSV, HTML or MT940 on business banking) are described in public bank guides; exact column layouts here are approximate.

## Not in this repository

The PRD (`PRD — UMKM Credit Readiness Coach (MVP).pdf`) is shared on request only, because it names interviewees.
