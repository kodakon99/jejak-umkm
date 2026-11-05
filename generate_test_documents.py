"""Generate two SYNTHETIC upload test sets (owner Excel + bank e-Statement PDF).

Test 1 - Cocok:   Excel and bank statement agree.
Test 2 - Selisih: planted errors (see KUNCI_JAWABAN.md written next to the files).

The PDF copies the LAYOUT of a common Indonesian e-Statement (blue header band,
summary box, No/Tanggal/Keterangan/Nominal/Saldo table). Bank name, people and
numbers are fictional and every page is marked as synthetic test data.
A CSV of the same statement is written too; the app reads both.

Needs: openpyxl, reportlab.  Run: python3 generate_test_documents.py
"""
import csv
import datetime as dt
import random
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import simpleSplit
from reportlab.pdfgen import canvas

OUT = Path(__file__).parent / "sample document"
MDR = 0.007  # QRIS fee, same as the app's QRIS_FEE
D = dt.date
days = [D(2026, 10, 1) + dt.timedelta(i) for i in range(31)]

BUSINESS = "Warung Makan Bu Sari"
HOLDER = "SARI WULANDARI"
ACCOUNT = "1370098812345"
BRANCH = "KCP Contoh Tebet"
BANK = "BANK CONTOH"
ISSUED = "05 Nov 2026"

# ---------------- ground truth ----------------
rng = random.Random(2610)
truth = {}
for d in days:
    cash = rng.randrange(450_000, 900_001, 5_000)
    qris = rng.randrange(250_000, 650_001, 5_000)
    if d.weekday() >= 5:
        cash, qris = int(cash * 1.25) // 5_000 * 5_000, int(qris * 1.25) // 5_000 * 5_000
    truth[d] = {"cash": cash, "qris": qris}

SUPPLIERS = [  # date, payee, bank account, amount, item
    (D(2026, 10, 6), "PT SUMBER PANGAN JAYA", "BCA 5270318842", 1_850_000, "Beras, minyak, gula"),
    (D(2026, 10, 13), "PT SUMBER PANGAN JAYA", "BCA 5270318842", 1_620_000, "Beras, minyak, telur"),
    (D(2026, 10, 20), "CV AYAM SEGAR MAKMUR", "BRI 033101002299507", 2_140_000, "Ayam potong 40 kg"),
    (D(2026, 10, 27), "PT SUMBER PANGAN JAYA", "BCA 5270318842", 1_780_000, "Beras, minyak, bumbu"),
]
CASH_EXP = [  # paid from the till, never on the bank statement
    (D(2026, 10, 2), "Gas elpiji 3 kg (3 tabung)", "Bahan Baku", 66_000),
    (D(2026, 10, 9), "Sayur & bumbu pasar", "Bahan Baku", 245_000),
    (D(2026, 10, 16), "Plastik, styrofoam, sedotan", "Kemasan", 135_000),
    (D(2026, 10, 23), "Gas elpiji 3 kg (3 tabung)", "Bahan Baku", 66_000),
    (D(2026, 10, 30), "Upah harian pembantu", "Gaji", 600_000),
]
PLN = (D(2026, 10, 10), 200_000)  # token listrik, paid from the bank account
MONDAYS = [d for d in days if d.weekday() == 0]


def settlements():
    """QRIS pays out D+1; Fri-Sun sales settle together on Monday."""
    out = {}
    for d in days:
        wd = d.weekday()
        sd = d + dt.timedelta(1 if wd <= 3 else 7 - wd)
        out.setdefault(sd, []).append(d)
    return {sd: src for sd, src in out.items() if sd <= days[-1]}


def t(h, m, s):
    return f"{h:02d}:{m:02d}:{s:02d}"


def bank_events(errors):
    """List of (date, time, [remark lines], signed amount)."""
    ev = []
    for sd, src in sorted(settlements().items()):
        if errors and src == [D(2026, 10, 7)]:
            continue  # T2: Oct 7 QRIS never reached this account
        gross = sum(truth[s]["qris"] for s in src)
        label = f"{src[0]:%d/%m}" if len(src) == 1 else f"{src[0]:%d/%m}-{src[-1]:%d/%m}"
        ev.append((sd, t(rng.randint(3, 5), rng.randint(0, 59), rng.randint(0, 59)),
                   [f"Settlement QRIS {label}", f"MERCHANT {BUSINESS.upper()}", "NMID ID1025398817264"],
                   round(gross * (1 - MDR))))
    prev = days[0]
    for mon in MONDAYS:
        window = [d for d in days if prev <= d < mon]
        ratio = 0.40 if errors and mon == D(2026, 10, 12) else 0.70  # T2: thin deposit week
        amt = int(ratio * sum(truth[d]["cash"] for d in window)) // 10_000 * 10_000
        ev.append((mon, t(rng.randint(10, 13), rng.randint(0, 59), rng.randint(0, 59)),
                   ["Setoran tunai", f"{BANK} {BRANCH.upper()}", f"{HOLDER} {BUSINESS.upper()}"], amt))
        prev = mon
    for d, payee, acct, amt, _ in SUPPLIERS:
        tm = t(rng.randint(8, 16), rng.randint(0, 59), rng.randint(0, 59))
        dest = acct.split()[0]
        ev.append((d, tm, ["Biaya transfer BI Fast"], -2_500))
        ev.append((d, tm, ["Transfer BI Fast", f"Ke {dest}", f"{payee[:20]} {acct.split()[1]}"], -amt))
    ev.append((PLN[0], "19:42:10", ["Pembayaran PLN Prabayar", "ID PEL 531200987711", "TOKEN LISTRIK WARUNG"], -PLN[1]))
    ev.append((D(2026, 10, 15), "20:11:37", ["Transfer BI Fast", "Ke BNI", "SITI RAHMAWATI 0912334501"], -750_000))
    ev.append((D(2026, 10, 15), "20:11:37", ["Biaya transfer BI Fast"], -2_500))
    ev.append((D(2026, 10, 18), "14:03:55", ["Top-up e-money", "6032982811094471"], -100_000))
    ev.append((D(2026, 10, 24), "09:20:44", ["Penarikan tunai di ATM", f"{BANK} JKT PASAR TEBET 01"], -300_000))
    ev.append((D(2026, 10, 13), "23:59:59", ["Biaya administrasi kartu debit"], -5_500))
    if errors:  # T2: unusual bank activity
        ev.append((D(2026, 10, 17), "02:13:48", ["Transfer BI Fast", "Dari BRI", "HENDRA GUNAWAN 0021019988776", "-"], 15_000_000))
        for _ in range(2):  # same QR payment posted twice in the same second
            ev.append((D(2026, 10, 22), "11:26:05", ["Pembayaran QR", "ke TOKO GROSIR MAKMUR", "508812345671"], -487_500))
        ev.append((D(2026, 10, 28), "23:41:19", ["Penarikan tunai di ATM", f"{BANK} JKT SPBU CASABLANCA 02"], -5_000_000))
        ev.append((D(2026, 10, 9), "01:57:30", ["Transaksi e-Commerce", "SHOPEEPAY-TOPUP JAKARTA ID"], -2_350_000))
    ev.append((days[-1], "23:59:00", ["Biaya administrasi rekening"], -12_500))
    ev.append((days[-1], "23:59:00", ["Pajak rekening"], -87.61))
    ev.append((days[-1], "23:59:00", ["Bunga rekening"], 438.05))
    ev.sort(key=lambda e: (e[0], e[1]))
    return ev


# ---------------- PDF (e-Statement layout) ----------------
W, H = A4
L, R = 22, W - 22
BLUE, LIGHT = HexColor("#1479F0"), HexColor("#EAF2FB")
GREEN, NAVY, GREY = HexColor("#12A150"), HexColor("#1F5BD8"), HexColor("#6B7280")
ROW_H, FIRST_ROWS, NEXT_ROWS = 46, 10, 12


def idr(x, sign=False):
    s = f"{abs(x):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return (("+" if x >= 0 else "-") if sign else ("-" if x < 0 else "")) + s


def label(c, x, y, bold, italic, size=7.5):
    c.setFont("Helvetica-Bold", size)
    c.drawString(x, y, bold + "/")
    c.setFont("Helvetica-Oblique", size)
    c.drawString(x + c.stringWidth(bold + "/", "Helvetica-Bold", size), y, italic)


def page_frame(c, page, pages, period):
    c.setFillColor(BLUE)
    c.rect(0, H - 62, W, 62, stroke=0, fill=1)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 20)
    c.drawString(L, H - 34, "e-Statement")
    c.setFont("Helvetica-BoldOblique", 18)
    c.drawRightString(R, H - 30, BANK.lower().replace(" ", ""))
    c.setFont("Helvetica", 7)
    c.drawRightString(R, H - 50, "Jl. Contoh Raya No. 1, Jakarta 12345, Indonesia  -  DATA SINTETIS UNTUK PENGUJIAN")
    c.setFillColor(HexColor("#111111"))
    y = H - 95
    label(c, L, y, "Nama", "Name")
    c.setFont("Helvetica", 7.5)
    c.drawString(L + 88, y, ":")
    c.drawString(L + 98, y, HOLDER)
    label(c, L, y - 22, "Cabang", "Branch")
    c.drawString(L + 88, y - 22, ":")
    c.setFont("Helvetica", 7.5)
    c.drawString(L + 98, y - 22, BRANCH)
    label(c, 222, y, "Periode", "Period")
    label(c, 222, y - 22, "Dicetak pada", "Issued on")
    c.setFont("Helvetica", 7.5)
    for yy, v in ((y, period), (y - 22, ISSUED)):
        c.drawString(305, yy, ":")
        c.drawString(315, yy, v)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawRightString(R, y, f"{page} dari {pages}")
    c.setFont("Helvetica-Oblique", 7)
    c.drawRightString(R, y - 10, f"{page} of {pages}")
    c.setStrokeColor(HexColor("#E5E9F0"))
    c.line(L, 42, R, 42)
    c.setFont("Helvetica", 6.5)
    c.setFillColor(GREY)
    c.drawCentredString(W / 2, 30, f"{BANK} adalah bank fiktif. Dokumen ini dibuat otomatis sebagai data uji untuk aplikasi Jejak,")
    c.drawCentredString(W / 2, 21, "bukan rekening koran asli dan tidak dapat digunakan untuk keperluan apa pun selain pengujian.")


COLS = [(L, 34, "No", "No", "l"), (L + 38, 80, "Tanggal", "Date", "l"), (L + 122, 238, "Keterangan", "Remarks", "l"),
        (L + 364, 108, "Nominal (IDR)", "Amount (IDR)", "r"), (L + 476, R - L - 476, "Saldo (IDR)", "Balance (IDR)", "r")]


def table_header(c, top):
    for x, w, b, i, al in COLS:
        c.setFillColor(LIGHT)
        c.rect(x, top - 38, w, 38, stroke=0, fill=1)
        c.setFillColor(HexColor("#111111"))
        c.setFont("Helvetica-Bold", 7.5)
        (c.drawRightString(x + w - 6, top - 16, b) if al == "r" else c.drawString(x + 6, top - 16, b))
        c.setFont("Helvetica-Oblique", 7)
        (c.drawRightString(x + w - 6, top - 26, i) if al == "r" else c.drawString(x + 6, top - 26, i))
    return top - 38


def draw_row(c, top, no, d, tm, lines, amt, bal):
    mid = top - ROW_H / 2
    c.setFillColor(HexColor("#111111"))
    c.setFont("Helvetica", 7.5)
    c.drawString(COLS[0][0] + 6, mid - 3, str(no))
    c.drawString(COLS[1][0] + 6, mid + 2, d.strftime("%d %b %Y"))
    c.drawString(COLS[1][0] + 6, mid - 7, f"{tm} WIB")
    y0 = mid + (len(lines) - 1) * 4.5 - 3
    for k, ln in enumerate(lines):
        c.drawString(COLS[2][0] + 6, y0 - k * 9, ln)
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(GREEN if amt > 0 else HexColor("#111111"))
    c.drawRightString(COLS[3][0] + COLS[3][1] - 6, mid - 3, idr(amt, sign=amt > 0))
    c.setFillColor(NAVY)
    c.drawRightString(R - 6, mid - 3, idr(bal))


def write_pdf(path, events, opening):
    period = f"{days[0]:%d %b %Y} - {days[-1]:%d %b %Y}"
    chunks = [events[:FIRST_ROWS]] + [events[i:i + NEXT_ROWS] for i in range(FIRST_ROWS, len(events), NEXT_ROWS)]
    extra = len(chunks[-1]) > 7  # disclaimer needs room; give it its own page
    pages = len(chunks) + extra
    inc = sum(e[3] for e in events if e[3] > 0)
    out = -sum(e[3] for e in events if e[3] < 0)
    c = canvas.Canvas(str(path), pagesize=A4)
    c.setTitle(f"e-Statement {period} (DATA SINTETIS)")
    bal, no = opening, 0
    for p, chunk in enumerate(chunks, 1):
        page_frame(c, p, pages, period)
        top = H - 140
        if p == 1:
            c.setFont("Helvetica-Bold", 12)
            c.drawString(L, H - 158, "Tabungan Bisnis IDR")
            label(c, L, H - 190, "Nomor Rekening", "Account Number")
            label(c, L, H - 212, "Mata Uang", "Currency")
            c.setFont("Helvetica", 7.5)
            c.drawString(L + 125, H - 190, f":   {ACCOUNT}")
            c.drawString(L + 125, H - 212, ":   IDR")
            c.setStrokeColor(HexColor("#E5E9F0"))
            c.roundRect(300, H - 255, R - 300, 115, 8, stroke=1, fill=0)
            rows = [("Saldo Awal", "Initial Balance", idr(opening), HexColor("#555555")),
                    ("Dana Masuk", "Incoming Transactions", "+ " + idr(inc), GREEN),
                    ("Dana Keluar", "Outgoing Transactions", "- " + idr(out), HexColor("#111111")),
                    ("Saldo Akhir", "Closing Balance", idr(opening + inc - out), NAVY)]
            for k, (b, i, v, col) in enumerate(rows):
                yy = H - 162 - k * 25
                c.setFillColor(HexColor("#111111"))
                label(c, 312, yy, b, i)
                c.drawString(460, yy, ":")
                c.setFillColor(col)
                c.setFont("Helvetica-Bold", 8)
                c.drawRightString(R - 10, yy, v)
            top = H - 268
        y = table_header(c, top)
        for d, tm, lines, amt in chunk:
            no += 1
            bal += amt
            draw_row(c, y, no, d, tm, lines, amt, bal)
            y -= ROW_H
        if p == len(chunks):
            if extra:
                c.showPage()
                page_frame(c, pages, pages, period)
                y = H - 140
            disclaimer(c, y - 18)
        c.showPage()
    c.save()
    return opening + inc - out


def disclaimer(c, y):
    c.setFillColor(HexColor("#111111"))
    c.setFont("Helvetica-Oblique", 7.5)
    c.drawCentredString(W / 2, y, "ini adalah batas akhir transaksi anda")
    items = [
        "e-Statement ini merupakan dokumen elektronik yang dihasilkan oleh sistem dan sah tanpa tanda tangan pejabat bank./This e-Statement is an electronic document issued by the bank system and is valid without an official signature.",
        "Segala bentuk penggunaan e-Statement ini menjadi tanggung jawab Nasabah sepenuhnya./All forms of usage of this e-Statement are the Customer's sole responsibility.",
        "Nasabah dapat mengajukan keberatan atas ketidaksesuaian informasi di e-Statement dalam batas waktu 14 hari kalender./Customers can submit objections regarding discrepancies within 14 calendar days.",
        "CATATAN: dokumen ini SINTETIS, dibuat untuk menguji aplikasi Jejak. Nama bank, nasabah dan transaksi fiktif./NOTE: synthetic test data; bank, customer and transactions are fictional.",
    ]
    wrapped = [simpleSplit(s, "Helvetica", 7, R - L - 60) for s in items]
    box_h = 40 + sum(len(w) * 9 + 6 for w in wrapped)
    top = y - 20
    c.setStrokeColor(HexColor("#E5E9F0"))
    c.roundRect(L, top - box_h, R - L, box_h, 8, stroke=1, fill=0)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(L + 18, top - 22, "Disclaimer")
    yy = top - 42
    for n, lines in enumerate(wrapped, 1):
        c.setFont("Helvetica", 7)
        c.drawString(L + 18, yy, f"{n}.")
        for ln in lines:
            c.drawString(L + 32, yy, ln)
            yy -= 9
        yy -= 6


def write_csv(path, events, opening):
    """Same statement in the CSV layout the app's reader expects."""
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["Tanggal", "Keterangan", "Mutasi", "DB/CR", "Saldo"])
        w.writerow([f"{days[0]:%d/%m/%Y}", "SALDO AWAL", "", "", f"{opening:,.2f}"])
        bal = opening
        for d, _, lines, amt in events:
            bal += amt
            w.writerow([f"{d:%d/%m/%Y}", " ".join(x for x in lines if x != "-"), f"{abs(amt):,.2f}",
                        "CR" if amt > 0 else "DB", f"{bal:,.2f}"])


# ---------------- Excel (common UMKM "Laporan Keuangan Sederhana" template) ----------------
F = "Calibri"
THIN = Side(style="thin", color="A6A6A6")
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
HEAD = PatternFill("solid", fgColor="1F4E78")
TOTAL = PatternFill("solid", fgColor="DDEBF7")
RP = '"Rp"#,##0;[Red]-"Rp"#,##0;"-"'


def sheet_top(ws, title, ncols):
    last = chr(64 + ncols)
    ws.merge_cells(f"A1:{last}1")
    ws["A1"] = title
    ws["A1"].font = Font(name=F, bold=True, size=14, color="1F4E78")
    ws["A1"].alignment = Alignment(horizontal="center")
    ws["A2"], ws["A3"] = f"Nama Usaha : {BUSINESS}", "Periode    : Oktober 2026"
    for a in ("A2", "A3"):
        ws[a].font = Font(name=F, size=11)


def header(ws, row, names, widths):
    ws.append(names)
    for i, w in enumerate(widths, 1):
        cell = ws.cell(row=row, column=i)
        cell.font = Font(name=F, bold=True, color="FFFFFF")
        cell.fill, cell.border = HEAD, BOX
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        ws.column_dimensions[chr(64 + i)].width = w
    ws.row_dimensions[row].height = 30
    ws.freeze_panes = ws.cell(row=row + 1, column=1)


def body(ws, first, money_cols):
    for r in ws.iter_rows(min_row=first, max_row=ws.max_row):
        for c in r:
            c.border, c.font = BOX, Font(name=F, bold=c.font.bold)
        r[1].number_format = "DD/MM/YYYY"
        r[0].alignment = Alignment(horizontal="center")
        for i in money_cols:
            r[i].number_format = RP


def write_excel(path, errors):
    wb = Workbook()
    ws = wb.active
    ws.title = "Penjualan Harian"
    sheet_top(ws, "LAPORAN PENJUALAN HARIAN", 6)
    ws.append([])
    header(ws, 5, ["No", "Tanggal", "Penjualan Tunai", "Penjualan QRIS", "Total Penjualan", "Keterangan"], [6, 13, 18, 18, 18, 30])
    no = 0
    for d in days:
        no += 1
        cash, qris, note = truth[d]["cash"], truth[d]["qris"], ""
        if d.weekday() == 6:
            note = "Ramai, hari Minggu"
        if errors and d == D(2026, 10, 14):
            qris += 300_000  # T2: typo, 300k too high
        if errors and d == D(2026, 10, 21):
            cash = None  # T2: forgot to fill
        r = ws.max_row + 1
        row = [no, d, cash, qris, f"=SUM(C{r}:D{r})", note]
        ws.append(row)
        if errors and d == D(2026, 10, 23):
            ws.append(row[:4] + [f"=SUM(C{r + 1}:D{r + 1})", note])  # T2: row pasted twice
    end = ws.max_row
    ws.append(["", "TOTAL", f"=SUM(C6:C{end})", f"=SUM(D6:D{end})", f"=SUM(E6:E{end})", ""])
    body(ws, 6, (2, 3, 4))
    for c in ws[ws.max_row]:
        c.font, c.fill = Font(name=F, bold=True), TOTAL

    ex = wb.create_sheet("Pengeluaran")
    sheet_top(ex, "CATATAN PENGELUARAN", 6)
    ex.append([])
    header(ex, 5, ["No", "Tanggal", "Keterangan", "Kategori", "Metode Bayar", "Jumlah"], [6, 13, 34, 14, 14, 16])
    rows = [(d, f"Belanja {payee.title()} - {item}", "Bahan Baku", "Transfer", amt) for d, payee, _, amt, item in SUPPLIERS]
    rows += [(d, desc, cat, "Tunai", amt) for d, desc, cat, amt in CASH_EXP]
    rows.append((PLN[0], "Token listrik PLN", "Utilitas", "Transfer", PLN[1]))
    if errors:
        rows = [r for r in rows if r[0] != D(2026, 10, 20)]  # T2: supplier purchase never recorded
        rows = [(*r[:4], 1_260_000) if r[0] == D(2026, 10, 13) else r for r in rows]  # T2: 1.620.000 typed as 1.260.000
    for n, (d, desc, cat, how, amt) in enumerate(sorted(rows), 1):
        ex.append([n, d, desc, cat, how, amt])
    end_ex = ex.max_row
    ex.append(["", "TOTAL", "", "", "", f"=SUM(F6:F{end_ex})"])
    body(ex, 6, (5,))
    for c in ex[ex.max_row]:
        c.font, c.fill = Font(name=F, bold=True), TOTAL

    lr = wb.create_sheet("Laba Rugi")
    sheet_top(lr, "LAPORAN LABA RUGI SEDERHANA", 2)
    lr.append([])
    lines = [
        ("PENDAPATAN", None),
        ("Penjualan Tunai", f"='Penjualan Harian'!C{end + 1}"),
        ("Penjualan QRIS", f"='Penjualan Harian'!D{end + 1}"),
        ("Total Pendapatan", "=B6+B7"),
        ("", None),
        ("PENGELUARAN", None),
        ("Total Pengeluaran", f"=Pengeluaran!F{end_ex + 1}"),
        ("", None),
        ("LABA BERSIH", "=B8-B11"),
    ]
    for name, f in lines:
        lr.append([name, f])
    for r in lr.iter_rows(min_row=5, max_row=lr.max_row):
        r[0].font = Font(name=F, bold=r[0].value in ("PENDAPATAN", "PENGELUARAN", "LABA BERSIH", "Total Pendapatan"))
        r[1].number_format = RP
    lr["B13"].font = Font(name=F, bold=True)
    lr["B13"].fill = TOTAL
    lr.column_dimensions["A"].width, lr.column_dimensions["B"].width = 24, 20
    wb.save(path)


ANSWER_KEY = """# Kunci Jawaban - Test 2 (Selisih)

Semua data SINTETIS. Aplikasi harus menampilkan 14 tanda ini (Test 1 - Cocok: 0 tanda).

| Kasus | Tanggal | Yang terjadi | Flag |
|---|---|---|---|
| 1. Duplikat | 23 Okt | Baris penjualan diketik dua kali di Excel | `duplicate` |
| 1. Duplikat | 22 Okt | Bank memposting QR TOKO GROSIR MAKMUR Rp487.500 dua kali di detik yang sama | `bank_duplicate` |
| 2. Kosong | 21 Okt | Sel Penjualan Tunai kosong | `blank` |
| 3. Tidak biasa | 5-11 Okt | Setoran 12 Okt hanya ~40% penjualan tunai (biasanya ~70%) | `cash_week` |
| 3. Tidak biasa | 19-25 Okt | Setoran 26 Okt 78% dari Excel (efek sel kosong 21 Okt) | `cash_week` |
| 3. Tidak biasa | 9 Okt | e-Commerce Rp2.350.000 jam 01:57 | `unusual` (jam) |
| 3. Tidak biasa | 17 Okt | Transfer masuk Rp15.000.000 jam 02:13 | `unusual` (jam) |
| 3. Tidak biasa | 28 Okt | Tarik tunai Rp5.000.000, 17x biasanya (Rp300.000) | `unusual` (ukuran) |
| 4. Hanya di bank | 13 Okt | Bank Rp1.620.000, Excel salah ketik Rp1.260.000 | `supplier_unmatched` (menunjuk sel typo) |
| 4. Hanya di bank | 20 Okt | Transfer ke CV AYAM SEGAR MAKMUR Rp2.140.000 tidak dicatat | `supplier_unmatched` |
| 4. Hanya di bank | 22 Okt | Belanja QR di TOKO GROSIR MAKMUR tidak dicatat | `supplier_unmatched` |
| 4. Hanya di bank | 17 Okt | Uang masuk Rp15.000.000 dari HENDRA GUNAWAN | `bank_only` |
| 5. Hanya di Excel | 7 Okt | QRIS tercatat, settlement tidak ada di bank | `qris_missing` |
| 5. Hanya di Excel | 14 Okt | QRIS di Excel Rp300.000 lebih besar dari yang cair | `qris_mismatch` |

## Definisi "tidak biasa" (semua berstatus "layak dicek", bukan kesalahan)

- Ukuran: lebih dari 3x median transaksi sejenis (arah + 3 kata pertama keterangan) di mutasi yang sama.
- Jam: 00:00-04:59 WIB (hanya dari PDF; CSV tidak punya jam).
- Setoran tunai: rasio setoran/penjualan tunai menyimpang >5% dari kebiasaan.
- Tidak dicek: settlement QRIS, setoran, biaya, pajak dan bunga bank (sudah punya cek sendiri atau diposting bank).
"""


def main():
    opening = 8_450_312.47
    for name, errors in (("Test 1 - Cocok", False), ("Test 2 - Selisih", True)):
        folder = OUT / name
        folder.mkdir(parents=True, exist_ok=True)
        tag = "selisih" if errors else "cocok"
        ev = bank_events(errors)
        closing = write_pdf(folder / f"e-Statement_Okt2026_{tag}.pdf", ev, opening)
        write_csv(folder / f"mutasi_Okt2026_{tag}.csv", ev, opening)
        write_excel(folder / f"Laporan_Keuangan_Warung_Okt2026_{tag}.xlsx", errors)
        if errors:
            (folder / "KUNCI_JAWABAN.md").write_text(ANSWER_KEY, encoding="utf-8")
        print(f"{name}: {len(ev)} mutasi, saldo akhir {idr(closing)}")


if __name__ == "__main__":
    main()
