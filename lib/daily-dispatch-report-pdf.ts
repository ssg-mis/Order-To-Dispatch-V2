"use client"

import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

interface DDItem { item_name: string; qty: number; uom: string; rate: number; net: number; gross: number }
interface DDOil { oil: "rice" | "soya" | "palm" | "other"; label: string; items: DDItem[]; total: { qty: number; net: number; gross: number } }
interface DDTransport {
  leg: number
  bill_case: string
  transporter: string
  planned_rate: number | null
  planned_rate_type: string | null
  rate_type: string | null
  rate: number | null
  to_be: { cash: number; bank: number; diesel: number }
  actual: { cash: number; bank: number; diesel: number }
}
interface DDChange {
  type: "vehicle_change" | "accident"
  reason: string | null
  accident_date: string | null
  accident_location: string | null
  accident_description: string | null
  accident_loss: string | null
  route: string | null
  return_depot: string | null
  new_vehicle: string | null
  new_driver: string | null
  new_transporter: string | null
}
interface DDBlock {
  sn: number
  customer_name: string
  customer_address: string
  doc_no: string
  doc_date: string | null
  vehicle_no: string
  transport?: DDTransport[]
  change?: DDChange | null
  oils: DDOil[]
  grand: { qty: number; net: number; gross: number }
}
interface QNG { qty: number; net: number; gross: number }
export interface DailyDispatchReport {
  date: string
  blocks: DDBlock[]
  dayTotals: { rice: QNG; soya: QNG; palm: QNG; grand: QNG }
  packing_wt: number
  rst_wt: number
  diff: number
  count: number
}

const WHITE: [number, number, number] = [255, 255, 255]
const BLACK: [number, number, number] = [0, 0, 0]
const GRAY_HEAD: [number, number, number] = [166, 166, 166]
const GRAY_DATA: [number, number, number] = [217, 217, 217]
const OIL_FILL: Record<string, [number, number, number]> = {
  rice: [252, 228, 214], soya: [226, 239, 218], palm: [197, 217, 241], other: [229, 231, 235],
}

const pad = (n: number) => String(n).padStart(2, "0")
const fmtDate = (s: string | null) => {
  if (!s) return ""
  const d = new Date(s)
  if (isNaN(d.getTime())) return ""
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`
}
const n3 = (n: number) => (n ? Number(n).toLocaleString("en-IN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : "-")
const r2 = (n: number) => (n ? Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "")
const qd = (n: number) => (n ? String(n) : "-")
const diffStr = (n: number) => (n < 0 ? `(-)${Math.abs(n).toFixed(3)}` : Number(n || 0).toFixed(3))

// Columns: SN | Customer+Addr | Doc No | Doc Date | Item | Qty | UOM | Rate | Net Wt | Gross Wt | Remarks | Transporter |
// Transportation To Be | Actual Transportation (the last three come from the approved Stage 20 transport bill)
const HEADERS = ["SN", "Customer\nName & Address", "Doc\nNo.", "Doc\nDate", "Item Name", "Qty", "UOM", "Rate\n(per pcs wala)", "Net\nWt.", "Gross\nWt.", "Remarks", "Transporter\nName", "Transportation\nTo Be", "Actual\nTransportation"]
const WEIGHTS = [0.6, 4.2, 2.8, 2.0, 4.8, 1.3, 1.4, 2.2, 2.4, 2.4, 2.0, 2.6, 3.0, 3.0]
const TOTAL_COLS = WEIGHTS.length
const amt = (n: number | null | undefined) => Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })
const rateText = (type: string | null, v: number | null) => (v == null ? "-" : `${amt(v)}${type === "Bhada Rate" ? " /MT" : type === "Fixed Bhada" ? " fixed" : ""}`)
const legTag = (t: DDTransport, many: boolean) => (many ? `Leg ${t.leg}: ` : "")
const transporterText = (ts: DDTransport[]) => ts.map((t) => (ts.length > 1 ? `${t.transporter} (leg ${t.leg})` : t.transporter)).join("\n")
// what happened on the way (Stage 13): vehicle change / accident, and the vehicle that took over
const changeText = (c?: DDChange | null) => {
  if (!c) return ""
  const lines: string[] = []
  if (c.type === "vehicle_change") {
    lines.push("VEHICLE CHANGED")
    if (c.reason) lines.push(`Reason: ${c.reason}`)
  } else {
    lines.push("ACCIDENT")
    if (c.accident_date) lines.push(`On: ${fmtDate(c.accident_date)}${c.accident_location ? ` at ${c.accident_location}` : ""}`)
    if (c.reason) lines.push(`Cause: ${c.reason}`)
    if (c.accident_loss) lines.push(`Loss: ${c.accident_loss}`)
  }
  const nv = [c.new_vehicle, c.new_driver && `(${c.new_driver})`].filter(Boolean).join(" ")
  if (nv) lines.push(`New vehicle: ${nv}`)
  if (c.new_transporter) lines.push(`New transporter: ${c.new_transporter}`)
  if (c.route === "return_to_factory") lines.push(`Stock returned to factory${c.return_depot ? ` (${c.return_depot})` : ""}`)
  return lines.join("\n")
}
const toBeText = (ts: DDTransport[]) =>
  ts.map((t) => `${legTag(t, ts.length > 1)}Cash ${amt(t.to_be.cash)} | Bank ${amt(t.to_be.bank)} | Diesel ${amt(t.to_be.diesel)}\nPlanned rate: ${rateText(t.planned_rate_type, t.planned_rate)}`).join("\n")
const actualText = (ts: DDTransport[]) =>
  ts.map((t) => `${legTag(t, ts.length > 1)}Cash ${amt(t.actual.cash)} | Bank ${amt(t.actual.bank)} | Diesel ${amt(t.actual.diesel)}\nActual rate: ${rateText(t.rate_type, t.rate)}`).join("\n")

export function generateDailyDispatchReportPdf(report: DailyDispatchReport, filename?: string) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 8
  const contentW = pageW - margin * 2
  const sumW = WEIGHTS.reduce((s, w) => s + w, 0)
  const colW = WEIGHTS.map((w) => (w / sumW) * contentW)

  const body: any[] = []
  const rowMeta: { type: string; oil?: string }[] = []
  const push = (cells: any[], meta: { type: string; oil?: string }) => { body.push(cells); rowMeta.push(meta) }

  report.blocks.forEach((b) => {
    const H = b.oils.reduce((s, o) => s + 1 + o.items.length + 1, 0) + 1 // bands + items + oil-totals + grand
    const leftCells = [
      { content: String(b.sn), rowSpan: H, styles: { valign: "middle", halign: "center", fillColor: WHITE } },
      { content: `${b.customer_name}\n${b.customer_address}`, rowSpan: H, styles: { valign: "top", halign: "left", fillColor: WHITE } },
      { content: `${b.doc_no}\n${b.vehicle_no}`, rowSpan: H, styles: { valign: "middle", halign: "center", fillColor: WHITE } },
      { content: fmtDate(b.doc_date), rowSpan: H, styles: { valign: "middle", halign: "center", fillColor: WHITE } },
    ]

    const ts = b.transport || []
    const rightCells = [
      { content: [transporterText(ts), changeText(b.change)].filter(Boolean).join("\n\n"), rowSpan: H, styles: { valign: "top", halign: "left", fillColor: WHITE } },
      { content: toBeText(ts), rowSpan: H, styles: { valign: "top", halign: "left", fillColor: WHITE } },
      { content: actualText(ts), rowSpan: H, styles: { valign: "top", halign: "left", fillColor: WHITE } },
    ]

    let firstRow = true
    const emitRight = (cells: any[], meta: { type: string; oil?: string }) => {
      if (firstRow) { push([...leftCells, ...cells, ...rightCells], meta); firstRow = false }
      else push(cells, meta)
    }

    b.oils.forEach((o) => {
      emitRight([{ content: o.label, colSpan: 7, styles: { halign: "center", fontStyle: "bold" } }], { type: "oilband", oil: o.oil })
      o.items.forEach((it) => {
        emitRight([it.item_name, qd(it.qty), it.uom, r2(it.rate), n3(it.net), n3(it.gross), ""], { type: "item" })
      })
      emitRight([{ content: `Total ${o.label}`, styles: { halign: "right", fontStyle: "bold" } }, qd(o.total.qty), "", "", n3(o.total.net), n3(o.total.gross), ""], { type: "total", oil: o.oil })
    })
    emitRight([{ content: "Grand Total", styles: { halign: "center", fontStyle: "bold" } }, qd(b.grand.qty), "", "", n3(b.grand.net), n3(b.grand.gross), ""], { type: "grand" })
  })

  // ── Day footer: notes + Packing/RST/Diff ──
  const notes = ["", "", ""]
  const wtLabels = [["Packing Wt:", n3(report.packing_wt)], ["RST Wt:", n3(report.rst_wt)], ["Diff:", diffStr(report.diff)]]
  notes.forEach((note, i) => {
    push([
      { content: note, colSpan: 8 + (TOTAL_COLS - 11), styles: { halign: "left", fontStyle: "italic", fontSize: 7.5 } },
      { content: wtLabels[i][0], colSpan: 1, styles: { halign: "right", fontStyle: "bold" } },
      { content: wtLabels[i][1], colSpan: 2, styles: { halign: "right", fontStyle: "bold" } },
    ], { type: "note" })
  })

  // ── Total for a Day ──
  const dt = report.dayTotals
  const dayHeader = { content: `Total for a Day: ${fmtDate(report.date)}`, colSpan: 4, rowSpan: 4, styles: { halign: "center", valign: "middle", fontStyle: "bold", fontSize: 13 } }
  const dayFill = { content: "", colSpan: TOTAL_COLS - 11, styles: { fillColor: WHITE } } // the transport columns have no day total
  push([dayHeader, { content: "Total Rice Oil", styles: { halign: "right", fontStyle: "bold" } }, qd(dt.rice.qty), "", "", n3(dt.rice.net), n3(dt.rice.gross), "", dayFill], { type: "daytotal", oil: "rice" })
  push([{ content: "Total Soya Oil", styles: { halign: "right", fontStyle: "bold" } }, qd(dt.soya.qty), "", "", n3(dt.soya.net), n3(dt.soya.gross), "", dayFill], { type: "daytotal", oil: "soya" })
  push([{ content: "Total Palm Oil", styles: { halign: "right", fontStyle: "bold" } }, qd(dt.palm.qty), "", "", n3(dt.palm.net), n3(dt.palm.gross), "", dayFill], { type: "daytotal", oil: "palm" })
  push([{ content: "Grand Total", styles: { halign: "center", fontStyle: "bold" } }, qd(dt.grand.qty), "", "", n3(dt.grand.net), n3(dt.grand.gross), "", dayFill], { type: "daytotalgrand" })

  const head = [[
    { content: "SHRI SHYAM OIL EXTRACTIONS PVT LTD", colSpan: TOTAL_COLS, styles: { halign: "center", fontStyle: "bold", fontSize: 15, fillColor: WHITE } },
  ], [
    { content: "CP SALE DISPATCH REPORT", colSpan: TOTAL_COLS, styles: { halign: "center", fontStyle: "bold", fontSize: 11, fillColor: WHITE } },
  ], HEADERS.map((h) => ({ content: h }))]

  const columnStyles: Record<number, any> = {}
  colW.forEach((w, i) => {
    columnStyles[i] = { cellWidth: w, halign: i === 1 || i === 4 ? "left" : i >= 5 ? "right" : "center" }
  })
  columnStyles[6].halign = "center" // UOM
  for (let i = 11; i < TOTAL_COLS; i++) columnStyles[i].halign = "left" // transporter + the two Transportation columns

  autoTable(doc, {
    head: head as any,
    body,
    startY: margin,
    margin: { top: margin, left: margin, right: margin, bottom: margin },
    tableWidth: contentW,
    theme: "grid",
    styles: { font: "helvetica", fontSize: 7.5, cellPadding: 1, lineColor: BLACK, lineWidth: 0.2, textColor: BLACK, overflow: "linebreak", valign: "middle" },
    headStyles: { fontStyle: "bold", textColor: BLACK, halign: "center", valign: "middle" },
    columnStyles,
    didParseCell: (data: any) => {
      const ci = data.column.index
      if (data.section === "head") {
        if (data.row.index === 2) data.cell.styles.fillColor = GRAY_HEAD
        else data.cell.styles.fillColor = WHITE
        return
      }
      const meta = rowMeta[data.row.index]
      if (!meta) return
      switch (meta.type) {
        case "oilband":
        case "total":
          data.cell.styles.fillColor = OIL_FILL[meta.oil!]; data.cell.styles.fontStyle = "bold"; break
        case "grand":
        case "daytotalgrand":
          data.cell.styles.fillColor = BLACK; data.cell.styles.textColor = WHITE; data.cell.styles.fontStyle = "bold"; break
        case "item":
          data.cell.styles.fillColor = ci === 5 || ci === 7 || ci === 8 || ci === 9 ? GRAY_DATA : WHITE; break
        case "daytotal":
          data.cell.styles.fillColor = ci === 0 ? WHITE : OIL_FILL[meta.oil!]; if (ci !== 0) data.cell.styles.fontStyle = "bold"; break
        default:
          data.cell.styles.fillColor = WHITE
      }
    },
  })

  // Footer: "Page X of Y" on every page
  const pageH = doc.internal.pageSize.getHeight()
  const pageCount = (doc as any).getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(0, 0, 0)
    doc.text(`Page ${i} of ${pageCount}`, pageW / 2, pageH - 2, { align: "center" })
  }

  doc.setProperties({ title: (filename || `Daily CP Dispatch Report ${fmtDate(report.date)}`).replace(/\.pdf$/i, "") })
  window.open(doc.output("bloburl") as unknown as string, "_blank")
}
