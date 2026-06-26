"use client"

import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

interface DDItem { item_name: string; qty: number; uom: string; rate: number; net: number; gross: number }
interface DDOil { oil: "rice" | "soya" | "palm" | "other"; label: string; items: DDItem[]; total: { qty: number; net: number; gross: number } }
interface DDBlock {
  sn: number
  customer_name: string
  customer_address: string
  doc_no: string
  doc_date: string | null
  vehicle_no: string
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

// Columns: SN | Customer+Addr | Doc No | Doc Date | Item | Qty | UOM | Rate | Net Wt | Gross Wt | Remarks
const HEADERS = ["SN", "Customer\nName & Address", "Doc\nNo.", "Doc\nDate", "Item Name", "Qty", "UOM", "Rate\n(per pcs wala)", "Net\nWt.", "Gross\nWt.", "Remarks"]
const WEIGHTS = [0.6, 4.2, 2.8, 2.0, 4.8, 1.3, 1.4, 2.2, 2.4, 2.4, 2.6]

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

    let firstRow = true
    const emitRight = (cells: any[], meta: { type: string; oil?: string }) => {
      if (firstRow) { push([...leftCells, ...cells], meta); firstRow = false }
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
      { content: note, colSpan: 8, styles: { halign: "left", fontStyle: "italic", fontSize: 7.5 } },
      { content: wtLabels[i][0], colSpan: 1, styles: { halign: "right", fontStyle: "bold" } },
      { content: wtLabels[i][1], colSpan: 2, styles: { halign: "right", fontStyle: "bold" } },
    ], { type: "note" })
  })

  // ── Total for a Day ──
  const dt = report.dayTotals
  const dayHeader = { content: `Total for a Day: ${fmtDate(report.date)}`, colSpan: 4, rowSpan: 4, styles: { halign: "center", valign: "middle", fontStyle: "bold", fontSize: 13 } }
  push([dayHeader, { content: "Total Rice Oil", styles: { halign: "right", fontStyle: "bold" } }, qd(dt.rice.qty), "", "", n3(dt.rice.net), n3(dt.rice.gross), ""], { type: "daytotal", oil: "rice" })
  push([{ content: "Total Soya Oil", styles: { halign: "right", fontStyle: "bold" } }, qd(dt.soya.qty), "", "", n3(dt.soya.net), n3(dt.soya.gross), ""], { type: "daytotal", oil: "soya" })
  push([{ content: "Total Palm Oil", styles: { halign: "right", fontStyle: "bold" } }, qd(dt.palm.qty), "", "", n3(dt.palm.net), n3(dt.palm.gross), ""], { type: "daytotal", oil: "palm" })
  push([{ content: "Grand Total", styles: { halign: "center", fontStyle: "bold" } }, qd(dt.grand.qty), "", "", n3(dt.grand.net), n3(dt.grand.gross), ""], { type: "daytotalgrand" })

  const head = [[
    { content: "SHRI SHYAM OIL EXTRACTIONS PVT LTD", colSpan: 11, styles: { halign: "center", fontStyle: "bold", fontSize: 15, fillColor: WHITE } },
  ], [
    { content: "CP SALE DISPATCH REPORT", colSpan: 11, styles: { halign: "center", fontStyle: "bold", fontSize: 11, fillColor: WHITE } },
  ], HEADERS.map((h) => ({ content: h }))]

  const columnStyles: Record<number, any> = {}
  colW.forEach((w, i) => {
    columnStyles[i] = { cellWidth: w, halign: i === 1 || i === 4 ? "left" : i >= 5 ? "right" : "center" }
  })
  columnStyles[6].halign = "center" // UOM

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

  doc.setProperties({ title: (filename || `Daily CP Dispatch Report ${fmtDate(report.date)}`).replace(/\.pdf$/i, "") })
  window.open(doc.output("bloburl") as unknown as string, "_blank")
}
