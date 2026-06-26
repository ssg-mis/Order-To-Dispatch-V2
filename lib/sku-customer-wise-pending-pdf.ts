"use client"

import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

// ── Types (mirror /reports/pending-sauda-sku) ───────────────────────────────
interface SkuItem { item_name: string; rate: number; order_qty: number; pending_qty: number }
interface SkuDO {
  do_no: string
  do_date: string | null
  valid_upto: string | null
  order_type: string
  broker_name: string
  last_disp_qty: number
  last_disp_date: string | null
  items: SkuItem[]
}
export interface SkuCustomer { customer_name: string; sauda_count: number; dos: SkuDO[] }

// ── Colors ──────────────────────────────────────────────────────────────────
const WHITE: [number, number, number] = [255, 255, 255]
const BLACK: [number, number, number] = [0, 0, 0]

// ── Formatting ──────────────────────────────────────────────────────────────
const SHORT_MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const fmtDate = (s: string | null): string => {
  if (!s) return ""
  const d = new Date(s)
  if (isNaN(d.getTime())) return ""
  return `${d.getDate()} ${SHORT_MONTH[d.getMonth()]} ${d.getFullYear()}`
}
const fmtDayMon = (s: string | null): string => {
  if (!s) return ""
  const d = new Date(s)
  if (isNaN(d.getTime())) return ""
  return `${d.getDate()} ${SHORT_MONTH[d.getMonth()]}`
}
const qInt = (n: number) => Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })
const qOrDash = (n: number) => (n && n > 0 ? qInt(n) : "-")
const rate = (n: number) =>
  n && n > 0 ? Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"

// Status from Valid Upto vs the download date.
const statusOf = (validUpto: string | null): string => {
  if (!validUpto) return ""
  const v = new Date(validUpto)
  if (isNaN(v.getTime())) return ""
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  v.setHours(0, 0, 0, 0)
  const days = Math.round((v.getTime() - today.getTime()) / 86_400_000)
  if (days < 0) return "Expired"
  return `${days} Day${days === 1 ? "" : "s"}`
}

// Columns: SN | DO no. | DO Date | Customer | Item | Rate | Order Qty | Last Disp. | Pending Qty | Order Type | Valid upto | Status | Broker
const HEADERS = [
  "SN", "DO\nno.", "DO\nDate", "Customer", "Item", "Rate\n(per pcs wala)",
  "Order\nQty", "Last\nDisp.", "Pending\nQty", "Order\nType", "Valid\nupto", "Status", "Broker",
]
const WEIGHTS = [0.5, 1.4, 1.2, 1.6, 2.6, 1.2, 1.0, 1.1, 1.0, 1.2, 1.2, 1.1, 1.4]

export function generateSkuCustomerWisePendingPdf(customers: SkuCustomer[], filename?: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 8
  const contentW = pageW - margin * 2
  const sumW = WEIGHTS.reduce((s, w) => s + w, 0)
  const colW = WEIGHTS.map((w) => (w / sumW) * contentW)

  const body: any[] = []
  const rowMeta: string[] = []
  const push = (cells: any[], type: string) => { body.push(cells); rowMeta.push(type) }

  let sn = 0
  customers.forEach((cust) => {
    cust.dos.forEach((d) => {
      sn += 1
      const H = Math.max(1, d.items.length)
      const lastDisp = `${qOrDash(d.last_disp_qty)}${d.last_disp_date ? "\n" + fmtDayMon(d.last_disp_date) : ""}`
      const span = (content: any, halign: "center" | "left" = "center") =>
        ({ content, rowSpan: H, styles: { valign: "middle", halign } })

      const items = d.items.length ? d.items : [{ item_name: "—", rate: 0, order_qty: 0, pending_qty: 0 }]
      items.forEach((it, idx) => {
        if (idx === 0) {
          push([
            span(String(sn)),
            span(d.do_no),
            span(fmtDate(d.do_date)),
            span(cust.customer_name, "left"),
            it.item_name, rate(it.rate), qOrDash(it.order_qty),
            span(lastDisp),
            qOrDash(it.pending_qty),
            span(d.order_type),
            span(fmtDate(d.valid_upto)),
            span(statusOf(d.valid_upto)),
            span(d.broker_name || "-", "left"),
          ], "first")
        } else {
          // Only the 4 non-spanned columns: Item, Rate, Order Qty, Pending Qty.
          push([it.item_name, rate(it.rate), qOrDash(it.order_qty), qOrDash(it.pending_qty)], "item")
        }
      })
    })
  })

  const head = [
    [{ content: "SHRI SHYAM OIL EXTRACTIONS PVT LTD", colSpan: 13, styles: { fontSize: 14, halign: "center", valign: "middle", fontStyle: "bold" } }],
    [{ content: "SKU & Customer-Wise CP Pending Sauda Report", colSpan: 13, styles: { fontSize: 11, halign: "center", valign: "middle", fontStyle: "bold" } }],
    HEADERS.map((h) => ({ content: h })),
  ]

  const columnStyles: Record<number, any> = {}
  colW.forEach((w, i) => {
    // 3 = Customer, 4 = Item, 12 = Broker → left; 5/6/8 numbers → right; rest center.
    columnStyles[i] = { cellWidth: w, halign: i === 3 || i === 4 || i === 12 ? "left" : i === 5 || i === 6 || i === 8 ? "right" : "center" }
  })

  autoTable(doc, {
    head: head as any,
    body,
    startY: margin,
    margin: { top: margin, left: margin, right: margin, bottom: margin },
    tableWidth: contentW,
    theme: "grid",
    styles: { font: "helvetica", fontSize: 7.5, cellPadding: 1.4, lineColor: BLACK, lineWidth: 0.2, textColor: BLACK, overflow: "linebreak", valign: "middle" },
    headStyles: { fontStyle: "bold", fillColor: WHITE, textColor: BLACK, halign: "center", valign: "middle", lineColor: BLACK, lineWidth: 0.2 },
    columnStyles,
    didParseCell: (data: any) => {
      if (data.section === "head") {
        data.cell.styles.fillColor = WHITE
        if (data.row.index === 2) data.cell.styles.halign = "center"
        return
      }
      data.cell.styles.fillColor = WHITE
    },
  })

  doc.setProperties({ title: (filename || "Customer-wise CP Pending Sauda Report").replace(/\.pdf$/i, "") })
  window.open(doc.output("bloburl") as unknown as string, "_blank")
}
