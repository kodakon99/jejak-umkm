"""Generate SYNTHETIC sample data for the UMKM credit-readiness prototype.

One ground truth (daily cash + QRIS sales for a fictional warung, Oct 2026) is
rendered into three source formats: a bank statement CSV and two owner Excel
templates. Template A has planted errors; template B is a clean control.
All names, amounts and layouts are invented for testing, not real records.
"""
import csv
import datetime as dt
import random
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill

random.seed(2026)
OUT = Path(__file__).parent
FONT = "Arial"
MDR = 0.007  # illustrative QRIS merchant fee; real rate varies by provider

start = dt.date(2026, 10, 1)
days = [start + dt.timedelta(d) for d in range(31)]

# ---------- ground truth ----------
truth = {}
for d in days:
    cash = random.randrange(300_000, 700_001, 5_000)
    qris = random.randrange(150_000, 450_001, 5_000)
    if d.weekday() >= 5:  # weekends are busier
        cash = int(cash * 1.2) // 5_000 * 5_000
        qris = int(qris * 1.2) // 5_000 * 5_000
    truth[d] = {"cash": cash, "qris": qris}

with open(OUT / "ground_truth_ledger.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["date", "channel", "amount_idr"])
    for d in days:
        w.writerow([d.isoformat(), "cash", truth[d]["cash"]])
        w.writerow([d.isoformat(), "qris", truth[d]["qris"]])

# ---------- expenses (shared by bank debits and owner sheets) ----------
supplier = {
    dt.date(2026, 10, 6): 1_450_000,
    dt.date(2026, 10, 13): 1_620_000,
    dt.date(2026, 10, 20): 1_380_000,
    dt.date(2026, 10, 27): 1_710_000,
}
cash_expenses = [
    (dt.date(2026, 10, 3), "Beli gas elpiji 3kg", 22_000),
    (dt.date(2026, 10, 14), "Plastik dan kemasan", 85_000),
    (dt.date(2026, 10, 24), "Beli gas elpiji 3kg", 22_000),
]

# ---------- bank statement ----------
events = []  # (date, description, amount, DB/CR)

settle = {}
for d in days:
    wd = d.weekday()
    sd = d + dt.timedelta(1 if wd <= 3 else 7 - wd)  # Fri-Sun settle Monday
    settle.setdefault(sd, []).append(d)
for sd, srcs in sorted(settle.items()):
    if sd > days[-1]:
        continue  # carries into November
    gross = sum(truth[s]["qris"] for s in srcs)
    label = srcs[0].strftime("%d/%m") if len(srcs) == 1 else f"{srcs[0]:%d/%m}-{srcs[-1]:%d/%m}"
    events.append((sd, f"SETTLEMENT QRIS {label}", round(gross * (1 - MDR)), "CR"))

for d in days:
    if d.weekday() == 0 and d > start:
        window = [d - dt.timedelta(k) for k in range(7, 0, -1)]
        window = [x for x in window if x in truth]
        dep = int(0.7 * sum(truth[x]["cash"] for x in window)) // 10_000 * 10_000
        events.append((d, "SETORAN TUNAI", dep, "CR"))

for d, amt in supplier.items():
    events.append((d, "TRF KE PT SUMBER PANGAN", amt, "DB"))
events.append((dt.date(2026, 10, 15), "TRF KE BU SITI (PRIBADI)", 500_000, "DB"))
events.append((dt.date(2026, 10, 21), "TRF DARI SAUDARA", 1_000_000, "CR"))
events.append((dt.date(2026, 10, 30), "BIAYA ADM", 15_000, "DB"))
events.append((dt.date(2026, 10, 31), "BUNGA", 4_120, "CR"))

events.sort(key=lambda e: e[0])
balance = 2_500_000
with open(OUT / "bank_statement_sample.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["Tanggal", "Keterangan", "Mutasi", "DB/CR", "Saldo"])
    w.writerow(["01/10/2026", "SALDO AWAL", "", "", f"{balance:,.2f}"])
    for d, desc, amt, typ in events:
        balance += amt if typ == "CR" else -amt
        w.writerow([d.strftime("%d/%m/%Y"), desc, f"{amt:,.2f}", typ, f"{balance:,.2f}"])

# ---------- owner Excel, template A (planted errors) ----------
HEAD_FILL = PatternFill("solid", fgColor="D9E1F2")


def style_header(ws, row, ncols):
    for c in range(1, ncols + 1):
        cell = ws.cell(row=row, column=c)
        cell.font = Font(name=FONT, bold=True)
        cell.fill = HEAD_FILL
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)


def set_widths(ws, widths):
    for i, wdt in enumerate(widths, 1):
        ws.column_dimensions[chr(64 + i)].width = wdt


A = Workbook()
ws = A.active
ws.title = "Penjualan Harian"
ws.append(["Tanggal", "Penjualan Tunai", "Penjualan QRIS", "Total", "Keterangan"])
style_header(ws, 1, 5)
OVERSTATED = dt.date(2026, 10, 12)   # QRIS typed 300,000 too high
MISSING_CASH = dt.date(2026, 10, 19)  # cash sale never typed into Excel
DUPLICATED = dt.date(2026, 10, 23)    # row entered twice
for d in days:
    cash, qris = truth[d]["cash"], truth[d]["qris"]
    note = ""
    if d == OVERSTATED:
        qris += 300_000
    if d == MISSING_CASH:
        cash = None
    row = [d, cash, qris, (cash or 0) + qris, note]
    ws.append(row)
    if d == DUPLICATED:
        ws.append(row)
for r in ws.iter_rows(min_row=2):
    r[0].number_format = "DD/MM/YYYY"
    for c in r[1:4]:
        c.number_format = "#,##0"
    for c in r:
        c.font = Font(name=FONT)
set_widths(ws, [14, 18, 18, 16, 28])

ws2 = A.create_sheet("Pengeluaran")
ws2.append(["Tanggal", "Keterangan", "Jumlah"])
style_header(ws2, 1, 3)
exp_rows = [(d, "Belanja PT Sumber Pangan", a) for d, a in supplier.items()] + cash_expenses
for d, desc, amt in sorted(exp_rows):
    ws2.append([d, desc, amt])
for r in ws2.iter_rows(min_row=2):
    r[0].number_format = "DD/MM/YYYY"
    r[2].number_format = "#,##0"
    for c in r:
        c.font = Font(name=FONT)
set_widths(ws2, [14, 32, 16])

ws3 = A.create_sheet("Stok")
ws3.append(["Tanggal", "Kode Barang", "Nama Barang", "Stok Awal", "Barang Masuk", "Barang Keluar", "Stok Akhir", "Keterangan"])
style_header(ws3, 1, 8)
stock = [
    (dt.date(2026, 10, 6), "BRS-5", "Beras 5 kg", 12, 20, 8),
    (dt.date(2026, 10, 6), "MYK-2", "Minyak goreng 2 L", 6, 12, 5),
    (dt.date(2026, 10, 6), "TLR-K", "Telur (kg)", 10, 30, 22),
    (dt.date(2026, 10, 13), "BRS-5", "Beras 5 kg", 24, 20, 14),
    (dt.date(2026, 10, 13), "MYK-2", "Minyak goreng 2 L", 13, 12, 9),
    (dt.date(2026, 10, 13), "TLR-K", "Telur (kg)", 18, 30, 25),
    (dt.date(2026, 10, 20), "BRS-5", "Beras 5 kg", 30, 15, 12),
    (dt.date(2026, 10, 20), "MYK-2", "Minyak goreng 2 L", 16, 12, 10),
]
for d, kode, nama, awal, masuk, keluar in stock:
    ws3.append([d, kode, nama, awal, masuk, keluar, awal + masuk - keluar, "Belanja mingguan"])
for r in ws3.iter_rows(min_row=2):
    r[0].number_format = "DD/MM/YYYY"
    for c in r:
        c.font = Font(name=FONT)
set_widths(ws3, [14, 14, 22, 11, 14, 14, 12, 20])
A.save(OUT / "owner_recap_templateA.xlsx")

# ---------- owner Excel, template B (clean control, different layout) ----------
B = Workbook()
kb = B.active
kb.title = "Kas"
kb.merge_cells("A1:E1")
kb["A1"] = "BUKU KAS HARIAN - WARUNG CONTOH (DATA SINTETIS)"
kb["A1"].font = Font(name=FONT, bold=True, size=13)
kb["A1"].alignment = Alignment(horizontal="center")
kb.append([])
kb.append(["Periode: Oktober 2026"])
kb.append(["Tanggal", "Uraian", "Kas Masuk", "Kas Keluar", "Saldo"])
style_header(kb, 4, 5)
lines = []
for d in days:
    lines.append((d, 0, "Penjualan tunai", truth[d]["cash"], 0))
    lines.append((d, 1, "Penjualan QRIS (cek m-banking)", truth[d]["qris"], 0))
for d, a in supplier.items():
    lines.append((d, 2, "Belanja PT Sumber Pangan", 0, a))
for d, desc, a in cash_expenses:
    lines.append((d, 2, desc, 0, a))
lines.sort(key=lambda x: (x[0], x[1]))
saldo = 0
for d, _, uraian, masuk, keluar in lines:
    saldo += masuk - keluar
    kb.append([d, uraian, masuk or None, keluar or None, saldo])
for r in kb.iter_rows(min_row=5):
    r[0].number_format = "DD/MM/YYYY"
    for c in r[2:5]:
        c.number_format = "#,##0"
    for c in r:
        c.font = Font(name=FONT)
set_widths(kb, [14, 34, 16, 16, 16])
B.save(OUT / "owner_recap_templateB.xlsx")

print("rows bank:", len(events) + 1, "| A sales rows:", ws.max_row - 1, "| B rows:", kb.max_row - 4)
print("truth totals: cash", sum(v["cash"] for v in truth.values()), "qris", sum(v["qris"] for v in truth.values()))
