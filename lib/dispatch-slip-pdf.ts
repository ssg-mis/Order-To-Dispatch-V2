"use client"

import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

export interface SlipProduct {
  productName: string
  uom: string
  qty: number
  weight: number
  grossWeight: number
}

export interface SlipPartyData {
  party: string
  commitmentNo: string
  date: string
  referenceLabel?: string
  referenceValue?: string
  place: string
  partyMo: string
  status?: string
  processId: string
  products: SlipProduct[]
  punchBy?: string
  punchAt?: string | null
  preApproveBy?: string
  preApproveAt?: string | null
  approveBy?: string
  approveAt?: string | null
}

const WHITE: [number, number, number] = [255, 255, 255]
const BLACK: [number, number, number] = [0, 0, 0]
const GRAY_HEAD: [number, number, number] = [166, 166, 166]
const OIL_FILL: Record<string, [number, number, number]> = {
  rice: [252, 228, 214],
  soya: [226, 239, 218],
  palm: [197, 217, 241],
  other: [229, 231, 235],
}
const OIL_LABEL: Record<string, string> = { rice: "Rice Oil", soya: "Soya Oil", palm: "Palm Oil", other: "Other" }
const OIL_ORDER = ["rice", "soya", "palm", "other"]

function oilKey(name: string): string {
  const u = (name || "").toUpperCase()
  if (u.includes("RBO") || u.includes("RICE")) return "rice"
  if (u.includes("SBO") || u.includes("SOYA")) return "soya"
  if (u.includes("PALM")) return "palm"
  return "other"
}

const wt = (n: number) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 3, maximumFractionDigits: 3 })

const pad = (n: number) => String(n).padStart(2, "0")
const fmtDateTime = (s: string | null | undefined) => {
  if (!s) return ""
  const d = new Date(s)
  if (isNaN(d.getTime())) return ""
  let h = d.getHours()
  const ampm = h >= 12 ? "PM" : "AM"
  h = h % 12 || 12
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${String(d.getFullYear()).slice(2)} ${pad(h)}:${pad(d.getMinutes())} ${ampm}`
}

// Lays out one info cell exactly like the on-screen preview: each line is a
// "<bold label> <normal value>" pair, and long values wrap within the cell.
// When draw=false it only measures (returns the number of visual lines) so the
// row height can be reserved; when draw=true it renders at (x0, yTop).
function layoutInfoCell(
  doc: jsPDF,
  x0: number,
  yTop: number,
  availW: number,
  lines: { label: string; value: string }[],
  fs: number,
  draw: boolean,
): number {
  const lineH = fs * 0.3528 * 1.15
  const baselineOffset = fs * 0.3528 * 0.82
  doc.setFontSize(fs)
  if (draw) doc.setTextColor(0, 0, 0)
  let lineNo = 0
  const baselineFor = (n: number) => yTop + n * lineH + baselineOffset
  for (const { label, value } of lines) {
    let curX = x0
    doc.setFont("helvetica", "bold")
    const labelW = doc.getTextWidth(label)
    if (draw) doc.text(label, curX, baselineFor(lineNo))
    doc.setFont("helvetica", "normal")
    const spaceW = doc.getTextWidth(" ")
    curX += labelW + spaceW
    const words = String(value ?? "").split(/\s+/).filter(Boolean)
    for (const w of words) {
      const wW = doc.getTextWidth(w)
      if (curX + wW > x0 + availW && curX > x0) { lineNo++; curX = x0 }
      if (draw) doc.text(w, curX, baselineFor(lineNo))
      curX += wW + spaceW
    }
    lineNo++
  }
  return lineNo
}

export function generateDispatchSlipPdf(parties: SlipPartyData[], filename = "dispatch-slip.pdf", opts?: { print?: boolean }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 10
  const contentW = pageW - margin * 2

  // Slip table geometry (mm). Item Name is kept snug (long names still wrap) and the
  // numeric columns compact, so the voucher no longer stretches the full page width —
  // the freed width becomes a little trailing space to the right.
  const ITEM_COLS = { name: 68, qty: 14, uom: 14, net: 19, netU: 8, gross: 19, grossU: 8 }
  const tableW = Object.values(ITEM_COLS).reduce((a, b) => a + b, 0)
  // Center the voucher horizontally on the page (equal margins left/right).
  const sideMargin = Math.max(margin, (pageW - tableW) / 2)

  parties.forEach((party, partyIdx) => {
    if (partyIdx > 0) doc.addPage()

    // Group products by oil (only oils present)
    const byOil: Record<string, SlipProduct[]> = { rice: [], soya: [], palm: [], other: [] }
    party.products.forEach((p) => byOil[oilKey(p.productName)].push(p))

    // ---- 1) Header: company banner + DO/customer info ----
    // Two equal columns (like the preview's grid-cols-2); each field is a
    // "<bold label> <normal value>" pair drawn inline (custom, wraps).
    const HALF = tableW / 2
    const AVAIL = HALF - 2 * 1.4
    const banner = (text: string, styles: any) => ({ content: text, colSpan: 2, styles: { ...styles, fillColor: WHITE } })
    const info = (lines: { label: string; value: string }[], fs = 9) =>
      ({ content: "", _info: lines, _fs: fs, styles: { fillColor: WHITE, valign: "top" as const } })

    const headerBody = [
      [banner("SHRI SHYAM OIL EXTRACTIONS PVT LTD", { halign: "center", valign: "middle", fontStyle: "bold", fontSize: 15 })],
      [banner("Vill: Banari, PO: Banari, Dist: Janjgir-Champa (CG)", { halign: "center", fontStyle: "normal", fontSize: 8, textColor: [90, 90, 90] })],
      [banner("Oil Dispatch Voucher", { halign: "center", fontStyle: "bold", fontSize: 12 })],
      [info([{ label: "DO no.:", value: party.commitmentNo }]), info([{ label: "DO Date:", value: party.date }])],
      [info([{ label: "Customer:", value: party.party }]), info([{ label: party.referenceLabel ? `${party.referenceLabel}:` : "", value: party.referenceValue || "—" }])],
      [
        info([{ label: "Address:", value: party.place }], 8),
        info([{ label: "Mob.:", value: party.partyMo }, { label: "Status:", value: party.status || "—" }]),
      ],
    ]

    autoTable(doc, {
      body: headerBody as any,
      startY: margin,
      margin: { top: margin, left: sideMargin, right: sideMargin, bottom: margin },
      tableWidth: tableW,
      theme: "grid",
      styles: { font: "helvetica", fontSize: 9, cellPadding: 1.4, lineColor: BLACK, lineWidth: 0.2, textColor: BLACK, overflow: "linebreak", valign: "middle" },
      columnStyles: { 0: { cellWidth: HALF }, 1: { cellWidth: HALF } },
      didParseCell: (data: any) => {
        const raw = data.cell.raw
        if (raw && raw._info) {
          data.cell.text = []
          const n = layoutInfoCell(doc, 0, 0, AVAIL, raw._info, raw._fs, false)
          data.cell.styles.minCellHeight = 2 * 1.4 + n * (raw._fs * 0.3528 * 1.15)
        }
      },
      didDrawCell: (data: any) => {
        const raw = data.cell.raw
        if (raw && raw._info) layoutInfoCell(doc, data.cell.x + 1.4, data.cell.y + 1.4, AVAIL, raw._info, raw._fs, true)
      },
    })

    // ---- 2) Item table: Item Name / QTY / UOM / Net Wt. / Gross Wt. ----
    // Net/Gross show "<value> KGS" in a single cell, exactly like the preview.
    const body: any[] = []
    const rowMeta: { type: string; oil?: string }[] = []
    const push = (cells: any[], meta: { type: string; oil?: string }) => { body.push(cells); rowMeta.push(meta) }

    let grandQty = 0, grandNet = 0, grandGross = 0
    OIL_ORDER.forEach((k) => {
      const items = byOil[k]
      if (!items.length) return
      push([{ content: OIL_LABEL[k], colSpan: 5, styles: { halign: "center", fontStyle: "bold", fontSize: 10 } }], { type: "oilband", oil: k })
      let q = 0, net = 0, gross = 0
      items.forEach((it) => {
        q += it.qty; net += it.weight; gross += it.grossWeight
        push([it.productName, String(it.qty), it.uom, `${wt(it.weight)} KGS`, `${wt(it.grossWeight)} KGS`], { type: "item" })
      })
      grandQty += q; grandNet += net; grandGross += gross
      push([{ content: `Total ${OIL_LABEL[k]}`, styles: { halign: "right", fontStyle: "bold" } }, String(q), "", `${wt(net)} KGS`, `${wt(gross)} KGS`], { type: "total", oil: k })
    })
    push([{ content: "Grand Total", styles: { halign: "center", fontStyle: "bold" } }, String(grandQty), "", `${wt(grandNet)} KGS`, `${wt(grandGross)} KGS`], { type: "grand" })

    const itemHead = [[
      { content: "Item Name", styles: { fillColor: GRAY_HEAD } },
      { content: "QTY", styles: { fillColor: GRAY_HEAD, halign: "center" } },
      { content: "UOM", styles: { fillColor: GRAY_HEAD, halign: "center" } },
      { content: "Net Wt.", styles: { fillColor: GRAY_HEAD, halign: "center" } },
      { content: "Gross Wt.", styles: { fillColor: GRAY_HEAD, halign: "center" } },
    ]]

    autoTable(doc, {
      head: itemHead as any,
      body,
      startY: (doc as any).lastAutoTable.finalY,
      margin: { top: margin, left: sideMargin, right: sideMargin, bottom: margin },
      tableWidth: tableW,
      theme: "grid",
      styles: { font: "helvetica", fontSize: 8.5, cellPadding: 1.4, lineColor: BLACK, lineWidth: 0.2, textColor: BLACK, overflow: "linebreak", valign: "middle" },
      headStyles: { fontStyle: "bold", textColor: BLACK, lineColor: BLACK, lineWidth: 0.2 },
      columnStyles: {
        0: { cellWidth: ITEM_COLS.name, halign: "left" },
        1: { cellWidth: ITEM_COLS.qty, halign: "center" },
        2: { cellWidth: ITEM_COLS.uom, halign: "center" },
        3: { cellWidth: ITEM_COLS.net + ITEM_COLS.netU, halign: "right" },
        4: { cellWidth: ITEM_COLS.gross + ITEM_COLS.grossU, halign: "right" },
      },
      didParseCell: (data: any) => {
        if (data.section !== "body") return
        const meta = rowMeta[data.row.index]
        if (!meta) return
        if (meta.type === "oilband") { data.cell.styles.fillColor = OIL_FILL[meta.oil!]; data.cell.styles.fontStyle = "bold" }
        else if (meta.type === "total") { data.cell.styles.fillColor = OIL_FILL[meta.oil!]; data.cell.styles.fontStyle = "bold" }
        else if (meta.type === "grand") { data.cell.styles.fillColor = BLACK; data.cell.styles.textColor = WHITE; data.cell.styles.fontStyle = "bold" }
        else { data.cell.styles.fillColor = WHITE }
      },
    })

    // ---- 3) Footer: three equal columns (Punch / Pre-Approve / Approve) ----
    const punch = `Order Punch By: ${party.punchBy || "—"}\n(${fmtDateTime(party.punchAt)})`
    const preApp = `Pre-Approve By: ${party.preApproveBy || "—"}\n(${fmtDateTime(party.preApproveAt)})`
    const app = `Approve By: ${party.approveBy || "—"}\n(${fmtDateTime(party.approveAt)})`
    const third = tableW / 3
    autoTable(doc, {
      body: [[
        { content: punch, styles: { halign: "center", valign: "top", fontStyle: "normal", fontSize: 8, minCellHeight: 13 } },
        { content: preApp, styles: { halign: "center", valign: "top", fontStyle: "normal", fontSize: 8, minCellHeight: 13 } },
        { content: app, styles: { halign: "center", valign: "top", fontStyle: "normal", fontSize: 8, minCellHeight: 13 } },
      ]],
      startY: (doc as any).lastAutoTable.finalY,
      margin: { top: margin, left: sideMargin, right: sideMargin, bottom: margin },
      tableWidth: tableW,
      theme: "grid",
      styles: { font: "helvetica", fontSize: 8, cellPadding: 1.4, lineColor: BLACK, lineWidth: 0.2, textColor: BLACK, overflow: "linebreak", valign: "top" },
      columnStyles: { 0: { cellWidth: third }, 1: { cellWidth: third }, 2: { cellWidth: third } },
      didDrawCell: (data: any) => {
        // Underline the first line ("X By: Name") of each footer cell, like the preview.
        const firstLine = String(data.cell.raw?.content ?? "").split("\n")[0]
        if (!firstLine) return
        doc.setFont("helvetica", "normal")
        doc.setFontSize(8)
        const tw = doc.getTextWidth(firstLine)
        const cx = data.cell.x + data.cell.width / 2
        const yLine = data.cell.y + 1.4 + 3.2 // padding-top + first-line height
        doc.setDrawColor(0, 0, 0)
        doc.setLineWidth(0.2)
        doc.line(cx - tw / 2, yLine, cx + tw / 2, yLine)
      },
    })
  })

  if (opts?.print) {
    doc.autoPrint()
    window.open(doc.output("bloburl") as unknown as string, "_blank")
  } else {
    doc.save(filename)
  }
}
