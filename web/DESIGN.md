---
name: Jejak
description: KUR readiness and Excel-to-bank reconciliation for warung owners, in natural-dye flat colour.
colors:
  nila: "#1e2a4a"
  nila-soft: "#3a4a75"
  nila-tint: "#dfe2ec"
  soga: "#7a4a28"
  soga-deep: "#5a3418"
  merah: "#a8302a"
  merah-tint: "#f6dcd6"
  kunyit: "#8a5d00"
  kunyit-line: "#c38a1c"
  mori: "#f3ead6"
  mori-sunk: "#ebe0c7"
  paper: "#fffbf2"
  ink: "#2a1a0e"
  muted: "#65523f"
  line: "#dccdae"
typography:
  display:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "44px"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  headline:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 800
  body:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
  label:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 700
  caption:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 700
rounded:
  mark: "4px"
  sm: "6px"
  md: "10px"
  pill: "999px"
spacing:
  s1: "4px"
  s2: "8px"
  s3: "12px"
  s4: "16px"
  s5: "24px"
  s6: "32px"
  s7: "48px"
components:
  button-primary:
    backgroundColor: "{colors.nila}"
    textColor: "{colors.mori}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.nila-soft}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.nila}"
    rounded: "{rounded.sm}"
    height: "48px"
  button-ghost-hover:
    backgroundColor: "{colors.nila-tint}"
  button-quiet:
    backgroundColor: "{colors.mori-sunk}"
    textColor: "{colors.nila}"
    rounded: "{rounded.sm}"
    height: "48px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "12px"
    height: "48px"
  choice:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "44px"
  choice-on:
    backgroundColor: "{colors.nila}"
    textColor: "{colors.mori}"
  step-tab-current:
    backgroundColor: "{colors.mori}"
    textColor: "{colors.nila}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
  day-cell-cocok:
    backgroundColor: "{colors.soga}"
    textColor: "{colors.mori}"
    rounded: "{rounded.sm}"
  day-cell-dijelaskan:
    backgroundColor: "{colors.nila-tint}"
    textColor: "{colors.nila}"
    rounded: "{rounded.sm}"
  day-cell-open:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.sm}"
  source-chip:
    backgroundColor: "{colors.mori}"
    textColor: "{colors.soga-deep}"
    typography: "{typography.caption}"
    rounded: "{rounded.mark}"
    padding: "4px 8px"
  card:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "16px"
  next-step:
    backgroundColor: "{colors.nila}"
    textColor: "{colors.mori}"
    rounded: "{rounded.md}"
    padding: "24px 16px"
---

# Design System: Jejak

## Overview

**Creative North Star: "Colour Taking Hold"**

Jejak is a working tool for warung owners on low-end Android phones, written in informal Bahasa Indonesia ("kamu"). The system reads like cloth dyed in stages: a cream mori ground, an indigo (nila) shell that holds the app, and soga brown that only appears where the bank has confirmed something. Verification is shown as colour taking hold. A confirmed day is a solid fill. A day that isn't confirmed stays as an open outline until the owner fixes or explains it.

Everything is flat. The natural-dye colours are used only as plain fills and strokes. There is no textile pattern, motif or texture anywhere: the user rejected batik ornament outright, so the dye heritage lives in the colour alone. The density suits an Operate tool: one leading number per screen, a single 640px column, 48px touch targets, and tabular figures on every rupiah.

Trust comes from showing sources. Every number points back to where it came from (an Excel cell or a bank statement line), and the owner makes every decision. The interface never suggests the bank has approved anything.

**Key Characteristics:**
- Mori cream ground, nila shell and primary actions, soga reserved for bank-confirmed states.
- Status is carried by fill versus outline, never by colour alone.
- One 44px soga lead number per screen. Rupiah figures always tabular.
- Source chips under every figure. Flat surfaces, bordered rather than shadowed.
- Informal Bahasa ("kamu"), sentence case, no uppercase labels.
- No raster assets ship. The only image-like elements are a 20px hand-drawn line icon set and the favicon, so there is no image provenance to record.

## Colors

A natural-dye palette in flat fills: indigo, soga brown, madder red and turmeric on undyed cream.

### Primary
- **Nila Indigo** (nila): the app shell header, primary buttons, the selected Choice pill, focus rings, links, the plan's next-step block, and text selection. It belongs to the owner's actions and the app's frame, never to a status.
- **Nila Soft** (nila-soft): hover state for primary buttons and Choice borders.
- **Nila Tint** (nila-tint): the "owner explained" state (day cells, legend mark, resolved note), the ghost-button hover, and the input focus halo.

### Secondary
- **Soga Brown** (soga): the bank-confirmed fill (cocok day cells, lulus gate marks, the "siap" verdict) and the lead number. Bullet markers use it too.
- **Soga Deep** (soga-deep): text on source chips.

### Tertiary (status strokes)
- **Merah Madder** (merah): a solid 2.5px outline for selisih days and blocked gates, the "belum siap" verdict border, urgent plan steps, and error text. Red is always an outline or text, never a fill area.
- **Merah Tint** (merah-tint): defined on :root but not currently used by any screen. Leave it in reserve.
- **Kunyit Turmeric** (kunyit): text for "perlu dicek" and "hati-hati" states.
- **Kunyit Line** (kunyit-line): the 2px dashed outline for "perlu dicek" cells and "hati" marks.

### Neutral
- **Mori Cream** (mori): the page ground, the background of amount tiles and source chips, and text on indigo or soga.
- **Mori Sunk** (mori-sunk): quiet buttons, the note callout, and plan step-number discs.
- **Paper** (paper): cards, inputs, Choice pills, and the inside of outlined status cells.
- **Ink** (ink): body text. Also the 1.5px rule under table headers and the print checklist boxes.
- **Muted** (muted): secondary copy, captions, day-of-week labels, and the context line beside the lead number.
- **Line** (line): 1–1.5px borders, dividers, the faint outline of "belum bisa dicek" cells, and the dashed empty-state border.

### Named Rules
**The Earned Fill Rule.** Solid soga means the bank confirms it. Nothing else may be filled soga. Anything not yet confirmed is an outline: solid merah = selisih, dashed kunyit = perlu dicek, faint line = belum bisa dicek. A nila-tint fill (with a check icon in the cell) means the owner explained it.

**The Nila Is Action Rule.** Indigo frames the app and marks what the owner can do. It never stands for a verification state, so a button can never be mistaken for a status.

## Typography

**Display Font:** Figtree (via next/font, with system-ui, sans-serif)
**Body Font:** Figtree (the same family across every role)

**Character:** A single friendly geometric grotesque, used heavy (800) for numbers and headings and regular for reading. It feels approachable without being playful, and it is far from the look of a bank or a pinjol app.

### Hierarchy
- **Display** (800, 44px, 1.05, -0.02em): the lead number only, in soga (or merah on Cek when something is blocked). It sits on the baseline next to a 600-weight muted context phrase. One per screen.
- **Headline** (800, 24px, 1.2, -0.01em): the screen title and verdict headings. Text is balanced.
- **Title** (800, 18px): section headings, the day-detail date, the next-step heading, and amount figures.
- **Body** (400, 15px, 1.5): reading text, capped at 60–62ch. Inputs use 16px so phones don't zoom on focus.
- **Label** (700, 13px): step tabs, gate state words, the month name, and `.small` captions (in muted at 400).
- **Caption** (700, 12px): source chips, amount and total labels, table headers.

The plan screen's next-step date runs at 34px/800. It is the one sanctioned exception, because a date at scale is that screen's lead figure.

### Named Rules
**The Tabular Rupiah Rule.** `font-variant-numeric: tabular-nums` is set on the body, so every figure lines up. Never turn it off.

**The One Number Rule.** Each screen leads with at most one display-size figure. Everything else steps down to title size or smaller.

## Layout

The layout is one column, mobile-first, with a 640px maximum centred under a sticky indigo shell. Page padding is 24px on top, 16px at the sides and 48px at the bottom. Spacing uses a 4px-based scale (s1–s7). Sections are separated by 32px (s6), button rows by 24px (s5), fields by 16px (s4), and items within a group by 8px (s2). Lists (gates, plan steps, questions, checklists, tables) are divided by 1px line rules rather than spaced cards.

The month grid has 7 equal columns, a 5px gap, square cells, and a 480px maximum width. Every month uses the same scale. The legend sits under the grid. The day-detail card follows below it.

Button rows wrap, and each button flexes from a 160px basis, so two buttons share a row at 360px and stack only when their labels require it.

There is one breakpoint, at 480px. Below it, the step-tab strip scrolls horizontally with a 28px fade mask on the right edge, and the current tab scrolls into view. At 480px and wider the mask is removed.

Print (A4, 14mm margins) hides the shell and anything marked no-print, sets the ground to white at 11pt, and keeps table rows, panels and totals unbroken across pages.

## Elevation & Depth

The system is flat, and borders do the structural work. Cards, panels and inputs sit on a 1.5px line border with no shadow. Depth appears in exactly two places, and both are state responses:

- **Selected day lift**: a 3px mori gap ring, then a 2.5px nila ring, plus a soft indigo drop shadow (0 6px 14px -6px at 50% nila), and a 2px upward shift.
- **Input focus halo**: a 3px nila-tint spread.

No glass, no gradients (the only gradient is the step-strip fade mask), and no decorative shadows.

**The Flat At Rest Rule.** Surfaces never cast shadows at rest. A shadow only means "this is the one you picked."

## Shapes

Corners are gently rounded. 6px (sm) is used for buttons, inputs, day cells, amount tiles and the upper corners of step tabs. 10px (md) is used for cards, panels, the verdict, the next-step block and the empty state. 4px is used for status marks and source chips. Choice controls are full pills (999px), and plan step numbers are circles. Borders are 1.5px on interactive and container edges and 1px for list dividers. Status strokes are heavier: 2.5px solid merah and 2px dashed kunyit.

The current step tab is cut into the cream: it takes the page's mori colour and has only its top corners rounded, so it reads as part of the page beneath it.

## Components

### Buttons
Large, plain and direct.
- **Shape:** gently rounded (6px), at least 48px tall, 16px side padding, 700 weight, with an optional 20px leading icon and an 8px gap.
- **Primary:** mori text on nila. Hover lightens to nila-soft. On press, it scales to 0.98. When disabled, it turns greyed indigo with a not-allowed cursor.
- **Ghost:** nila text with a 1.5px nila inset ring on a transparent background. Hover fills nila-tint. Used for the second choice in a pair ("Jelaskan", "Impor ulang").
- **Quiet:** nila text on mori-sunk. Used for cancel actions and file pickers.
- **File picker:** a quiet button with a transparent native input layered over it. The labels are in Bahasa (for example "Pilih file").

### Choice (radio pills)
Native radios wrapped in pill labels, at least 44px tall, with 1.5px line borders on paper. Hover changes the border to nila-soft. When selected, the pill fills solid nila with mori text. Keyboard focus draws a 3px nila ring around the whole pill.

### Inputs / Fields
- **Style:** paper fill, a 1.5px line border, 6px radius, at least 48px tall (textareas 88px), and 16px text.
- **Focus:** the border turns nila and gains a 3px nila-tint halo. Hover darkens the border slightly.
- **Field label:** a 700-weight label above the input, with a muted 13px hint below it.
- **Error:** 600-weight merah text below the field.

### Cards / Containers
- **Day detail, panel, verdict:** paper fill, a 1.5px line border, 10px radius, 16px padding. The day card rises in over 0.35s.
- **Verdict variants:** siap is filled soga (the bank-backed state). belum siap has a 2.5px merah border.
- **Amount and total tiles:** mori or paper fill, 6px radius, a 12px caption label above an 18px figure.
- **Note:** a mori-sunk band with a nila info or alert icon and 13px text.
- **Empty state:** a 1.5px dashed line border with 10px corners.

### Navigation (shell)
The sticky nila header holds the "Jejak" wordmark (800, 22px, mori) on the left and the business name on the right (600, 13px, a pale indigo-grey, truncated). Below them sits a strip of six step tabs: 13px/700 labels in pale indigo-grey that turn mori on hover. The current tab fills mori with nila text and has rounded top corners. Tab focus rings are drawn in mori, inset.

### Day Cell and Month Grid (signature)
Each cell is a square button showing the day number at 13px/800, top-left. Its state follows the Earned Fill Rule: cocok is a solid soga fill with mori text. Selisih is a 2.5px inset merah ring on paper, with a small flag count when there is more than one flag. Perlu dicek is a 2px dashed kunyit outline on paper. Belum bisa dicek is a 1.5px line ring on a transparent fill. Dijelaskan is a nila-tint fill with nila text and a 14px check icon. Days with no records are faded and inert. The background colour transitions over 0.4s on the ease-out curve, so a resolved day visibly takes colour. Pressing a cell scales it to 0.94. Each cell's accessible name includes its date and state in words.

### Status Mark and Legend
Marks are 18px squares (14px in the legend) with 4px corners that repeat the cell vocabulary: soga fill; dashed kunyit; solid merah; a 1.5px darker tan outline for menunggu (deliberately stronger than the cell's outline so it shows up at legend size); and a nila-tint fill. Gate rows pair a mark with a 700-weight state word in the matching colour.

### Source Chip (signature)
A small mori tag with soga-deep 12px/700 text, a 14px file or bank icon, 4px×8px padding and 4px corners. It names exactly where a figure came from: "Penjualan Harian C13" or "Mutasi baris 13". Chips wrap in a row with 8px gaps. When a flag cites more than four cells, a "+N sel lagi" chip summarises the rest.

### Flag
A flag sits inside the day card above a 1px divider. Its 15px/800 heading is merah for selisih, kunyit for cek, and nila (with a check icon) once resolved. Below the heading come the detail text, source chips, the question for the owner in 600 weight, and a primary/ghost button pair. A resolved flag shows a nila-tint note recording the owner's words and the time, with a link-style "Batalkan".

### Next Step (plan)
A nila block with 10px corners. It leads with a 34px date and then shows the gate and advice. The remaining steps follow as a ruled list with 28px numbered discs (mori-sunk; merah for urgent steps) and a nila 13px date line.

### Icons
A 20px line set with a 1.75 stroke and round caps and joins, drawn inline in currentColor (check, alert, clock, file, bank, arrow, print, upload, info). Icons are decorative unless they carry a label.

## Do's and Don'ts

### Do:
- **Do** fill soga only where the bank confirms, and show every other status as an outline (merah solid, kunyit dashed, faint line) or the nila-tint "explained" fill.
- **Do** put a source chip (Excel sheet and cell, or statement line) beside every number the owner is asked to trust.
- **Do** lead each screen with at most one 44px figure, paired with a muted phrase on the same baseline.
- **Do** write in informal Bahasa ("kamu"), in sentence case, and phrase outcomes as the owner's decision.
- **Do** keep touch targets at least 44px (48px for buttons and inputs) and inputs at 16px text.
- **Do** carry state in words as well as shape: in accessible names, in the legend, and in gate state labels.

### Don't:
- **Don't** add any batik pattern, motif, texture or ornament. The natural-dye colours appear as flat fills only.
- **Don't** use green/red status chips or a white fintech card list. Status is fill versus outline in the natural-dye palette.
- **Don't** fill an area with merah. Red is an outline or text.
- **Don't** add shadows to surfaces at rest, or add gradients or glass.
- **Don't** use wording or colour that implies the bank has approved the loan.
- **Don't** add uppercase eyebrow or kicker labels above titles.
