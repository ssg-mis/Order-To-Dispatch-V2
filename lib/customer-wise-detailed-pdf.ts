"use client"

import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

// ── Types (mirror /reports/pending-sauda-detailed) ──────────────────────────
interface DetailedItem { item_name: string; uom: string; rate: number; billed: number[] }
interface DetailedOil {
  oil: "rice" | "soya" | "palm"
  label: string
  sauda_qty: number
  bal_qty: number
  items: DetailedItem[]
  billed_total: number[]
}
interface DetailedDoc { doc_no: string; doc_date: string | null; packing_wt: number; rst_wt: number; diff: number }
interface DetailedGrand { sauda: number; bal: number; billed: number[] }
interface DetailedDO {
  do_date: string | null
  do_no: string
  do_valid_upto: string | null
  broker_name: string
  oils: DetailedOil[]
  docs: DetailedDoc[]
  grand: DetailedGrand
}
export interface DetailedCustomer { customer_name: string; sauda_count: number; dos: DetailedDO[] }

// ── Colors ──────────────────────────────────────────────────────────────────
const WHITE: [number, number, number] = [255, 255, 255]
const BLACK: [number, number, number] = [0, 0, 0]
const GRAY_HEAD: [number, number, number] = [166, 166, 166]
const GRAY_DATA: [number, number, number] = [217, 217, 217]
const OIL_FILL: Record<string, [number, number, number]> = {
  rice: [252, 228, 214],
  soya: [226, 239, 218],
  palm: [197, 217, 241],
}

// ── Formatting ──────────────────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, "0")
const fmtDate = (s: string | null): string => {
  if (!s) return ""
  const d = new Date(s)
  if (isNaN(d.getTime())) return ""
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`
}
const inIN = (n: number) => Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })
const q = (n: number) => (n && n > 0 ? inIN(n) : "")
const qT = (n: number) => inIN(n || 0)
const rate = (n: number) =>
  n && n > 0 ? Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""
const wtKg = (n: number) => `${Number(n || 0).toFixed(3)}  KGS`
const diffKg = (n: number) => (n < 0 ? `(-)${Math.abs(n).toFixed(3)}` : `${Number(n || 0).toFixed(3)}`) + "  KGS"

export function generateCustomerWiseDetailedPdf(customers: DetailedCustomer[], filename?: string) {
  const maxDocs = Math.max(0, ...customers.flatMap((c) => c.dos.map((d) => d.docs.length)))
  const orientation = maxDocs >= 3 ? "landscape" : "portrait"
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 8
  const contentW = pageW - margin * 2

  // Title (once at top)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(15)
  doc.text("SHRI SHYAM OIL EXTRACTIONS PVT LTD", pageW / 2, margin + 7, { align: "center" })
  doc.setFontSize(11)
  doc.text("Customer-Wise CP Pending Sauda Report (Detailed)", pageW / 2, margin + 14, { align: "center" })
  doc.setLineWidth(0.2)
  doc.rect(margin, margin, contentW, 18)
  let cursorY = margin + 18

  customers.forEach((cust) => {
    cust.dos.forEach((d) => {
      const nDocs = d.docs.length
      // column kinds left→right
      const colKinds: string[] = ["item", "sauda", "uom", "rate"]
      for (let i = 0; i < nDocs; i++) { colKinds.push("billed", "uom") }
      colKinds.push("bal")
      const C = colKinds.length
      const half = Math.floor(C / 2)

      // column widths (weighted, scaled to content width)
      const weightOf = (k: string) =>
        k === "item" ? 2.6 : k === "uom" ? 0.7 : k === "sauda" ? 1.1 : k === "rate" ? 1.2 : k === "billed" ? 1.1 : 1.1
      const sumW = colKinds.reduce((s, k) => s + weightOf(k), 0)
      const columnStyles: Record<number, any> = {}
      colKinds.forEach((k, i) => {
        columnStyles[i] = {
          cellWidth: (weightOf(k) / sumW) * contentW,
          halign: k === "item" ? "left" : k === "uom" ? "center" : "right",
        }
      })

      // ── head: customer + DO info + column headers ──
      const colHeader: any[] = [
        { content: "Item Name" }, { content: "Sauda Qty" }, { content: "UOM" }, { content: "Rate\n(per pcs wala)" },
      ]
      for (let i = 0; i < nDocs; i++) colHeader.push({ content: "Billed Qty" }, { content: "UOM" })
      colHeader.push({ content: "Bal. Qty" })

      const head: any[] = [
        [{ content: `Customer: ${cust.customer_name}`, colSpan: C, styles: { halign: "center", fontStyle: "bold", fontSize: 11 } }],
        [
          { content: `DO Date: ${fmtDate(d.do_date)}`, colSpan: half, styles: { halign: "left", fontStyle: "bold" } },
          { content: `DO No.: ${d.do_no}`, colSpan: C - half, styles: { halign: "left", fontStyle: "bold" } },
        ],
        [
          { content: `DO Valid Upto: ${fmtDate(d.do_valid_upto)}`, colSpan: half, styles: { halign: "left", fontStyle: "bold" } },
          { content: `Broker: ${d.broker_name || "-"}`, colSpan: C - half, styles: { halign: "left", fontStyle: "bold" } },
        ],
        colHeader,
      ]

      // ── body ──
      const body: any[] = []
      const rowMeta: { type: string; oil?: string }[] = []
      const pushRow = (cells: any[], meta: { type: string; oil?: string }) => { body.push(cells); rowMeta.push(meta) }

      d.oils.forEach((oil) => {
        pushRow([{ content: oil.label, colSpan: C, styles: { halign: "center", fontStyle: "bold", fontSize: 11 } }], { type: "oilband", oil: oil.oil })
        oil.items.forEach((it, idx) => {
          const cells: any[] = [it.item_name, idx === 0 ? q(oil.sauda_qty) : "", it.uom, rate(it.rate)]
          for (let di = 0; di < nDocs; di++) {
            const b = it.billed[di]
            cells.push(b && b > 0 ? q(b) : "", b && b > 0 ? it.uom : "")
          }
          cells.push(idx === 0 ? q(oil.bal_qty) : "")
          pushRow(cells, { type: "item" })
        })
        // per-oil total
        const tCells: any[] = [{ content: `Total ${oil.label}`, styles: { halign: "right" } }, qT(oil.sauda_qty), "", ""]
        for (let di = 0; di < nDocs; di++) { tCells.push(qT(oil.billed_total[di]), "") }
        tCells.push(qT(oil.bal_qty))
        pushRow(tCells, { type: "total", oil: oil.oil })
      })

      // grand total
      const gCells: any[] = ["Grand Total", qT(d.grand.sauda), "", ""]
      for (let di = 0; di < nDocs; di++) { gCells.push(qT(d.grand.billed[di]), "") }
      gCells.push(qT(d.grand.bal))
      pushRow(gCells, { type: "grand" })

      // per-invoice footer
      if (nDocs > 0) {
        const footRow = (label: string, valOf: (doc: DetailedDoc) => string) => {
          const cells: any[] = [{ content: label, colSpan: 4, styles: { halign: "right", fontStyle: "bold" } }]
          d.docs.forEach((dc) => cells.push({ content: valOf(dc), colSpan: 2, styles: { halign: "center" } }))
          cells.push({ content: "", colSpan: 1 })
          pushRow(cells, { type: "footer" })
        }
        footRow("Doc Date:", (dc) => fmtDate(dc.doc_date))
        footRow("Doc No.:", (dc) => dc.doc_no || "")
        footRow("Packing Wt:", (dc) => wtKg(dc.packing_wt))
        footRow("RST Wt:", (dc) => wtKg(dc.rst_wt))
        footRow("Diff:", (dc) => diffKg(dc.diff))
      }

      autoTable(doc, {
        head,
        body,
        startY: cursorY,
        margin: { top: margin, left: margin, right: margin, bottom: margin },
        tableWidth: contentW,
        theme: "grid",
        styles: {
          font: "helvetica",
          fontSize: 8,
          cellPadding: 1.2,
          lineColor: BLACK,
          lineWidth: 0.2,
          textColor: BLACK,
          overflow: "linebreak",
          valign: "middle",
        },
        headStyles: { fontStyle: "bold", fillColor: WHITE, textColor: BLACK, lineColor: BLACK, lineWidth: 0.2 },
        columnStyles,
        didParseCell: (data: any) => {
          const ci = data.column.index
          if (data.section === "head") {
            if (data.row.index < 3) { data.cell.styles.fillColor = WHITE; data.cell.styles.fontStyle = "bold" }
            else { data.cell.styles.fillColor = GRAY_HEAD; data.cell.styles.fontStyle = "bold"; data.cell.styles.halign = "center"; data.cell.styles.valign = "middle" }
            return
          }
          const meta = rowMeta[data.row.index]
          if (!meta) return
          if (meta.type === "oilband") { data.cell.styles.fillColor = OIL_FILL[meta.oil!]; data.cell.styles.fontStyle = "bold"; data.cell.styles.halign = "center" }
          else if (meta.type === "total") { data.cell.styles.fillColor = OIL_FILL[meta.oil!]; data.cell.styles.fontStyle = "bold" }
          else if (meta.type === "grand") { data.cell.styles.fillColor = BLACK; data.cell.styles.textColor = WHITE; data.cell.styles.fontStyle = "bold" }
          else if (meta.type === "footer") { data.cell.styles.fillColor = ci === 0 ? WHITE : GRAY_DATA; if (ci === 0) data.cell.styles.fontStyle = "bold" }
          else if (meta.type === "item") {
            const kind = colKinds[ci]
            data.cell.styles.fillColor = kind === "sauda" || kind === "rate" || kind === "billed" || kind === "bal" ? GRAY_DATA : WHITE
          }
        },
      })

      cursorY = (doc as any).lastAutoTable.finalY + 6
      if (cursorY > pageH - margin - 30) { doc.addPage(); cursorY = margin }
    })
  })

  // Footer: "Page X of Y" on every page
  const pageCount = (doc as any).getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(0, 0, 0)
    doc.text(`Page ${i} of ${pageCount}`, pageW / 2, pageH - 2, { align: "center" })
  }

  doc.setProperties({ title: (filename || "Customer-wise CP Pending Sauda Report (Detailed)").replace(/\.pdf$/i, "") })
  window.open(doc.output("bloburl") as unknown as string, "_blank")
}
