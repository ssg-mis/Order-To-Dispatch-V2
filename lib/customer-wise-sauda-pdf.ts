"use client"

import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

// ── Types (mirror /reports/pending-sauda-customer) ──────────────────────────
interface OilRow { oil_type: string; original_qty: number; pending_qty: number; rate: number }
interface Sauda {
  sauda_no: string
  sauda_date: string | null
  oils: OilRow[]
  total_original: number
  total_pending: number
}
interface QtyPair { original: number; pending: number }
interface CustomerTotals { rice: QtyPair; soya: QtyPair; palm: QtyPair; grand: QtyPair }
export interface CustomerWiseCustomer {
  customer_name: string
  sauda_count: number
  saudas: Sauda[]
  totals: CustomerTotals
}

// ── Colors ──────────────────────────────────────────────────────────────────
const WHITE: [number, number, number] = [255, 255, 255]
const GRAY: [number, number, number] = [217, 217, 217]
const OIL_FILL: Record<string, [number, number, number]> = {
  rice: [252, 228, 214], soya: [226, 239, 218], palm: [197, 217, 241], other: [229, 231, 235],
}

// ── Formatting ──────────────────────────────────────────────────────────────
const SHORT_MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const fmtSaudaDate = (s: string | null): string => {
  if (!s) return ""
  const d = new Date(s)
  if (isNaN(d.getTime())) return ""
  return `${d.getDate()} ${SHORT_MONTH[d.getMonth()]} ${d.getFullYear()}`
}
const num = (n: number) => Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })
const oilKeyOf = (label: string): string => {
  const l = (label || "").toLowerCase()
  if (l.includes("rice")) return "rice"
  if (l.includes("soya") || l.includes("soy")) return "soya"
  if (l.includes("palm")) return "palm"
  return "other"
}

const COL_HEADERS = ["Sauda No.", "Sauda Date", "Oil Type", "Original Qty", "Pending Qty", "Rate (15 KGS Tin)"]

// Columns: Sauda No | Sauda Date | Oil Type | Original Qty | Pending Qty | Rate (15 KGS Tin)
const COL = {
  0: { cellWidth: 32, halign: "center" },
  1: { cellWidth: 28, halign: "center" },
  2: { cellWidth: 42, halign: "left" },
  3: { cellWidth: 28, halign: "right" },
  4: { cellWidth: 28, halign: "right" },
  5: { cellWidth: 32, halign: "right" },
} as const

export function generateCustomerWiseSaudaPdf(customers: CustomerWiseCustomer[], filename?: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })

  const body: any[] = []
  const rowMeta: { type: string; oil?: string }[] = []
  const push = (cells: any[], type: string, oil?: string) => { body.push(cells); rowMeta.push({ type, oil }) }

  customers.forEach((cust) => {
    push([{ content: "Customer:" }, { content: cust.customer_name, colSpan: 5, styles: { halign: "center" } }], "customer")
    push(COL_HEADERS.map((h) => ({ content: h })), "colheader")

    cust.saudas.forEach((s) => {
      const n = Math.max(1, s.oils.length)
      s.oils.forEach((oil, idx) => {
        const cells =
          idx === 0
            ? [
                { content: s.sauda_no, rowSpan: n, styles: { valign: "middle", fillColor: WHITE } },
                { content: fmtSaudaDate(s.sauda_date), rowSpan: n, styles: { valign: "middle", fillColor: WHITE } },
                oil.oil_type, num(oil.original_qty), num(oil.pending_qty), oil.rate ? num(oil.rate) : "",
              ]
            : [oil.oil_type, num(oil.original_qty), num(oil.pending_qty), oil.rate ? num(oil.rate) : ""]
        push(cells, "oil", oilKeyOf(oil.oil_type))
      })
      push(["", "", { content: "Total", styles: { halign: "right" } }, num(s.total_original), num(s.total_pending), ""], "total")
    })
  })

  // Overall summary across the selected customers
  const agg = { rice: { o: 0, p: 0 }, soya: { o: 0, p: 0 }, palm: { o: 0, p: 0 }, grand: { o: 0, p: 0 } }
  let saudaCount = 0
  customers.forEach((c) => {
    saudaCount += c.sauda_count
    agg.rice.o += c.totals.rice.original; agg.rice.p += c.totals.rice.pending
    agg.soya.o += c.totals.soya.original; agg.soya.p += c.totals.soya.pending
    agg.palm.o += c.totals.palm.original; agg.palm.p += c.totals.palm.pending
    agg.grand.o += c.totals.grand.original; agg.grand.p += c.totals.grand.pending
  })

  push([
    { content: `TOTAL ${saudaCount} SAUDA`, rowSpan: 4, colSpan: 2, styles: { halign: "center", valign: "middle", fontStyle: "bold", fillColor: WHITE } },
    "Total Rice Oil", num(agg.rice.o), num(agg.rice.p), "",
  ], "summary-oil", "rice")
  push(["Total Soya Oil", num(agg.soya.o), num(agg.soya.p), ""], "summary-oil", "soya")
  push(["Total Palm Oil", num(agg.palm.o), num(agg.palm.p), ""], "summary-oil", "palm")
  push([{ content: "Grand Total", styles: { halign: "right" } }, num(agg.grand.o), num(agg.grand.p), ""], "grand")

  const head = [
    [{ content: "SHRI SHYAM OIL EXTRACTIONS PVT LTD", colSpan: 6, styles: { fontSize: 15, halign: "center", valign: "middle" } }],
    [{ content: "Customer-Wise CP Pending Sauda Report (Summary)", colSpan: 6, styles: { fontSize: 11, halign: "center", valign: "middle" } }],
  ]

  autoTable(doc, {
    head: head as any,
    body,
    startY: 10,
    margin: { top: 10, left: 10, right: 10, bottom: 10 },
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 1.6,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      textColor: [0, 0, 0],
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: { fontStyle: "bold", fillColor: WHITE, textColor: [0, 0, 0], halign: "center", lineColor: [0, 0, 0], lineWidth: 0.2 },
    columnStyles: COL as any,
    didParseCell: (d: any) => {
      const ci = d.column.index
      if (d.section === "head") {
        d.cell.styles.fillColor = WHITE
        d.cell.styles.halign = "center"
        return
      }
      const meta = rowMeta[d.row.index]
      if (!meta) return
      const t = meta.type
      if (t === "customer") { d.cell.styles.fillColor = WHITE; d.cell.styles.fontStyle = "bold" }
      else if (t === "colheader") { d.cell.styles.fillColor = WHITE; d.cell.styles.fontStyle = "bold"; d.cell.styles.halign = "center" }
      else if (t === "oil") { d.cell.styles.fillColor = ci >= 2 ? (OIL_FILL[meta.oil!] || GRAY) : WHITE }
      else if (t === "total") { d.cell.styles.fillColor = WHITE; d.cell.styles.fontStyle = "bold" }
      else if (t === "summary-oil") { d.cell.styles.fillColor = ci >= 2 && ci <= 4 ? (OIL_FILL[meta.oil!] || GRAY) : WHITE }
      else if (t === "grand") { d.cell.styles.fillColor = WHITE; d.cell.styles.fontStyle = "bold" }
    },
  })

  // Footer: "Page X of Y" on every page
  const pageCount = (doc as any).getNumberOfPages()
  const pageSize = doc.internal.pageSize
  const pageWidth = (pageSize as any).getWidth ? (pageSize as any).getWidth() : (pageSize as any).width
  const pageHeight = (pageSize as any).getHeight ? (pageSize as any).getHeight() : (pageSize as any).height
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(0, 0, 0)
    doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 2, { align: "center" })
  }

  // Open in a new tab for preview; the browser's PDF viewer handles download/print.
  doc.setProperties({ title: (filename || "Customer-wise CP Pending Sauda Report (Summary)").replace(/\.pdf$/i, "") })
  window.open(doc.output("bloburl") as unknown as string, "_blank")
}
