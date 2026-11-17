"use client"

import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { getWeightDecimals } from "@/lib/weight-format"

interface VoucherProduct {
  product_name: string
  uom: string
  qty: number
  oil: "rice" | "soya" | "palm" | "other"
  net_wt: number
  gross_wt: number
}
export interface OilDispatchVoucher {
  do_no: string
  do_date: string | null
  customer_name: string
  agent_name: string
  agent_label: string
  address: string
  mobile: string
  status: string
  products: VoucherProduct[]
  punch_by: string
  punch_at: string | null
  pre_approve_by: string
  pre_approve_at: string | null
  approve_by: string
  approve_at: string | null
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

const pad = (n: number) => String(n).padStart(2, "0")
const fmtDate = (s: string | null) => {
  if (!s) return ""
  const d = new Date(s)
  if (isNaN(d.getTime())) return ""
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`
}
const fmtDateTime = (s: string | null) => {
  if (!s) return ""
  const d = new Date(s)
  if (isNaN(d.getTime())) return ""
  let h = d.getHours()
  const ampm = h >= 12 ? "PM" : "AM"
  h = h % 12 || 12
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${String(d.getFullYear()).slice(2)} ${pad(h)}:${pad(d.getMinutes())} ${ampm}`
}
const wt = (n: number) => { const d = getWeightDecimals(); return Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d }) }

export function generateOilDispatchVoucherPdf(vouchers: OilDispatchVoucher[], filename?: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 10
  const contentW = pageW - margin * 2

  vouchers.forEach((v, vi) => {
    if (vi > 0) doc.addPage()

    // Group products by oil (only oils present)
    const byOil: Record<string, VoucherProduct[]> = { rice: [], soya: [], palm: [], other: [] }
    v.products.forEach((p) => byOil[p.oil].push(p))

    const body: any[] = []
    const rowMeta: { type: string; oil?: string }[] = []
    const push = (cells: any[], meta: { type: string; oil?: string }) => { body.push(cells); rowMeta.push(meta) }

    let grandQty = 0, grandNet = 0, grandGross = 0
    OIL_ORDER.forEach((k) => {
      const items = byOil[k]
      if (!items.length) return
      push([{ content: OIL_LABEL[k], colSpan: 7, styles: { halign: "center", fontStyle: "bold", fontSize: 10 } }], { type: "oilband", oil: k })
      let q = 0, net = 0, gross = 0
      items.forEach((it) => {
        q += it.qty; net += it.net_wt; gross += it.gross_wt
        push([it.product_name, String(it.qty), it.uom, wt(it.net_wt), "KGS", wt(it.gross_wt), "KGS"], { type: "item" })
      })
      grandQty += q; grandNet += net; grandGross += gross
      push([{ content: `Total ${OIL_LABEL[k]}`, styles: { halign: "right", fontStyle: "bold" } }, String(q), "", wt(net), "KGS", wt(gross), "KGS"], { type: "total", oil: k })
    })
    push([{ content: "Grand Total", styles: { halign: "center", fontStyle: "bold" } }, String(grandQty), "", wt(grandNet), "KGS", wt(grandGross), "KGS"], { type: "grand" })

    // Footer: Punch / Pre-Approve / Approve
    const punch = `Order Punch By: ${v.punch_by}\n(${fmtDateTime(v.punch_at)})`
    const preApp = `Pre-Approve By: ${v.pre_approve_by}\n(${fmtDateTime(v.pre_approve_at)})`
    const app = `Approve By: ${v.approve_by}\n(${fmtDateTime(v.approve_at)})`
    push([
      { content: punch, colSpan: 3, styles: { halign: "center", valign: "top", fontStyle: "normal", fontSize: 8, minCellHeight: 13 } },
      { content: preApp, colSpan: 2, styles: { halign: "center", valign: "top", fontStyle: "normal", fontSize: 8, minCellHeight: 13 } },
      { content: app, colSpan: 2, styles: { halign: "center", valign: "top", fontStyle: "normal", fontSize: 8, minCellHeight: 13 } },
    ], { type: "footer" })

    const head = [
      [{ content: "SHRI SHYAM OIL EXTRACTIONS PVT LTD", colSpan: 7, styles: { halign: "center", valign: "middle", fontStyle: "bold", fontSize: 15, fillColor: WHITE } }],
      [{ content: "Vill: Banari, PO: Banari, Dist: Janjgir-Champa (CG)", colSpan: 7, styles: { halign: "center", fontStyle: "normal", fontSize: 8, textColor: [90, 90, 90], fillColor: WHITE } }],
      [{ content: "Oil Dispatch Voucher", colSpan: 7, styles: { halign: "center", fontStyle: "bold", fontSize: 12, fillColor: WHITE } }],
      [
        { content: `DO no.: ${v.do_no}`, colSpan: 4, styles: { halign: "left", fontStyle: "bold", fontSize: 9, fillColor: WHITE } },
        { content: `DO Date: ${fmtDate(v.do_date)}`, colSpan: 3, styles: { halign: "left", fontStyle: "bold", fontSize: 9, fillColor: WHITE } },
      ],
      [
        { content: `Customer: ${v.customer_name}`, colSpan: 4, styles: { halign: "left", fontStyle: "bold", fontSize: 9, fillColor: WHITE } },
        { content: `${v.agent_label}: ${v.agent_name}`, colSpan: 3, styles: { halign: "left", fontStyle: "bold", fontSize: 9, fillColor: WHITE } },
      ],
      [
        { content: `Address: ${v.address}`, colSpan: 4, styles: { halign: "left", fontStyle: "normal", fontSize: 8, fillColor: WHITE } },
        { content: `Mob.: ${v.mobile}\nStatus: ${v.status}`, colSpan: 3, styles: { halign: "left", fontStyle: "bold", fontSize: 9, fillColor: WHITE } },
      ],
      [
        { content: "Item Name", styles: { fillColor: GRAY_HEAD } },
        { content: "QTY", styles: { fillColor: GRAY_HEAD, halign: "center" } },
        { content: "UOM", styles: { fillColor: GRAY_HEAD, halign: "center" } },
        { content: "Net Wt.", colSpan: 2, styles: { fillColor: GRAY_HEAD, halign: "center" } },
        { content: "Gross Wt.", colSpan: 2, styles: { fillColor: GRAY_HEAD, halign: "center" } },
      ],
    ]

    const columnStyles: Record<number, any> = {
      0: { cellWidth: contentW * 0.40, halign: "left" },
      1: { cellWidth: contentW * 0.10, halign: "center" },
      2: { cellWidth: contentW * 0.10, halign: "center" },
      3: { cellWidth: contentW * 0.13, halign: "right" },
      4: { cellWidth: contentW * 0.07, halign: "left" },
      5: { cellWidth: contentW * 0.13, halign: "right" },
      6: { cellWidth: contentW * 0.07, halign: "left" },
    }

    autoTable(doc, {
      head: head as any,
      body,
      startY: margin,
      margin: { top: margin, left: margin, right: margin, bottom: margin },
      tableWidth: contentW,
      theme: "grid",
      styles: { font: "helvetica", fontSize: 8.5, cellPadding: 1.4, lineColor: BLACK, lineWidth: 0.2, textColor: BLACK, overflow: "linebreak", valign: "middle" },
      headStyles: { fontStyle: "bold", textColor: BLACK, lineColor: BLACK, lineWidth: 0.2 },
      columnStyles,
      didParseCell: (data: any) => {
        if (data.section !== "body") return
        const meta = rowMeta[data.row.index]
        if (!meta) return
        if (meta.type === "oilband") { data.cell.styles.fillColor = OIL_FILL[meta.oil!]; data.cell.styles.fontStyle = "bold" }
        else if (meta.type === "total") { data.cell.styles.fillColor = OIL_FILL[meta.oil!]; data.cell.styles.fontStyle = "bold" }
        else if (meta.type === "grand") { data.cell.styles.fillColor = BLACK; data.cell.styles.textColor = WHITE; data.cell.styles.fontStyle = "bold" }
        else { data.cell.styles.fillColor = WHITE }
      },
      didDrawCell: (data: any) => {
        // Underline the first line ("X By: Name") of each footer cell, like the original.
        if (data.section !== "body" || rowMeta[data.row.index]?.type !== "footer") return
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

  doc.setProperties({ title: (filename || "Oil Dispatch Voucher").replace(/\.pdf$/i, "") })
  window.open(doc.output("bloburl") as unknown as string, "_blank")
}
