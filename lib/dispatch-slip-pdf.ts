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
  brokerName: string
  place: string
  partyMo: string
  processId: string
  products: SlipProduct[]
}

const CATEGORIES = ["RICE OIL", "SOYA OIL", "PALM OIL", "OTHERS"] as const

function categorize(name: string): typeof CATEGORIES[number] {
  const u = name.toUpperCase()
  if (u.includes("RBO") || u.includes("RICE")) return "RICE OIL"
  if (u.includes("SBO") || u.includes("SOYA")) return "SOYA OIL"
  if (u.includes("PALM")) return "PALM OIL"
  return "OTHERS"
}

export function generateDispatchSlipPdf(parties: SlipPartyData[], filename = "dispatch-slip.pdf") {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 10
  const contentW = pageW - margin * 2

  parties.forEach((party, partyIdx) => {
    if (partyIdx > 0) doc.addPage()

    let y = margin

    // ── Header ───────────────────────────────────────────────────────────────
    doc.setFontSize(16)
    doc.setFont("helvetica", "bold")
    doc.text("SHRI SHYAM OIL EXTRACTION PVT LTD.", pageW / 2, y + 7, { align: "center" })
    y += 10

    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.text("VILL- BANARI, POST-BANARI, DISTT.- JANJGIR-CHAMPA", pageW / 2, y + 4, { align: "center" })
    y += 7

    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text("OIL DISPATCH VOUCHER", pageW / 2, y + 5, { align: "center" })
    // underline
    const titleW = doc.getTextWidth("OIL DISPATCH VOUCHER")
    doc.line(pageW / 2 - titleW / 2, y + 6, pageW / 2 + titleW / 2, y + 6)
    y += 10

    // double border under header
    doc.setLineWidth(0.5)
    doc.line(margin, y, margin + contentW, y)
    doc.line(margin, y + 1, margin + contentW, y + 1)
    y += 4

    // ── Info grid (2-col, 4 rows) ─────────────────────────────────────────────
    const infoRows = [
      ["Commitment No", party.commitmentNo, "Date", party.date],
      ["Party Name", party.party, "Broker Name", party.brokerName],
      ["Place", party.place, "Party Mo.", party.partyMo],
      ["Manual Sauda No.", party.processId, "", ""],
    ]
    const colW = contentW / 2
    const labelW = 38
    const cellH = 7

    doc.setLineWidth(0.3)
    doc.rect(margin, y, contentW, cellH * infoRows.length)

    infoRows.forEach((row, ri) => {
      const rowY = y + ri * cellH
      // vertical divider between the two halves
      doc.line(margin + colW, rowY, margin + colW, rowY + cellH)
      // horizontal divider (except last row bottom = already drawn by rect)
      if (ri < infoRows.length - 1) doc.line(margin, rowY + cellH, margin + contentW, rowY + cellH)

      // left cell
      doc.setFontSize(7)
      doc.setFont("helvetica", "bold")
      doc.text(row[0].toUpperCase(), margin + 2, rowY + cellH / 2 + 1)
      // inner divider after label
      doc.line(margin + labelW, rowY, margin + labelW, rowY + cellH)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8)
      doc.text(String(row[1]), margin + labelW + 2, rowY + cellH / 2 + 1)

      // right cell
      doc.setFontSize(7)
      doc.setFont("helvetica", "bold")
      doc.text(row[2].toUpperCase(), margin + colW + 2, rowY + cellH / 2 + 1)
      if (row[2]) {
        doc.line(margin + colW + labelW, rowY, margin + colW + labelW, rowY + cellH)
        doc.setFont("helvetica", "normal")
        doc.setFontSize(8)
        doc.text(String(row[3]), margin + colW + labelW + 2, rowY + cellH / 2 + 1)
      }
    })

    y += cellH * infoRows.length + 4

    // ── Products table ────────────────────────────────────────────────────────
    const catMap: Record<string, SlipProduct[]> = { "RICE OIL": [], "SOYA OIL": [], "PALM OIL": [], "OTHERS": [] }
    party.products.forEach(p => catMap[categorize(p.productName)].push(p))

    const tableBody: (string | { content: string; colSpan?: number; styles?: any })[][] = []

    CATEGORIES.forEach(cat => {
      const items = catMap[cat]
      if (items.length === 0) return

      // category header row
      tableBody.push([{
        content: cat,
        colSpan: 5,
        styles: { halign: "center", fillColor: [229, 231, 235], fontStyle: "bold", fontSize: 9 },
      }] as any)

      items.forEach(item => {
        tableBody.push([
          item.productName,
          item.uom,
          String(item.qty),
          `${item.weight.toFixed(4)} KG`,
          `${item.grossWeight.toFixed(4)} KG`,
        ])
      })

      const catQty = items.reduce((s, i) => s + i.qty, 0)
      const catWt = items.reduce((s, i) => s + i.weight, 0)
      const catGross = items.reduce((s, i) => s + i.grossWeight, 0)
      tableBody.push([{
        content: `TOTAL ${cat}`,
        colSpan: 2,
        styles: { fontStyle: "bold", fillColor: [243, 244, 246] },
      }, String(catQty), `${catWt.toFixed(4)} KG`, `${catGross.toFixed(4)} KG`] as any)
    })

    const grandQty = party.products.reduce((s, p) => s + p.qty, 0)
    const grandWt = party.products.reduce((s, p) => s + p.weight, 0)
    const grandGross = party.products.reduce((s, p) => s + p.grossWeight, 0)
    tableBody.push([{
      content: "GRAND TOTAL",
      colSpan: 2,
      styles: { fontStyle: "bold", fillColor: [0, 0, 0], textColor: [255, 255, 255], fontSize: 9 },
    }, {
      content: String(grandQty),
      styles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: "bold" },
    }, {
      content: `${grandWt.toFixed(4)} KG`,
      styles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: "bold" },
    }, {
      content: `${grandGross.toFixed(4)} KG`,
      styles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: "bold" },
    }] as any)

    autoTable(doc, {
      startY: y,
      head: [["Item Name", "Unit", "Qty", "Net Weight", "Gross Weight"]],
      body: tableBody,
      margin: { left: margin, right: margin },
      tableWidth: contentW,
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold", fontSize: 8 },
      bodyStyles: { fontSize: 8, fontStyle: "normal" },
      columnStyles: {
        0: { cellWidth: contentW * 0.35 },
        1: { cellWidth: contentW * 0.10 },
        2: { cellWidth: contentW * 0.15 },
        3: { cellWidth: contentW * 0.20 },
        4: { cellWidth: contentW * 0.20 },
      },
      theme: "grid",
    })

    // @ts-ignore — jspdf-autotable attaches lastAutoTable to the doc instance
    y = (doc as any).lastAutoTable.finalY + 12

    // ── Signatures ────────────────────────────────────────────────────────────
    const sigW = 50
    doc.setLineWidth(0.5)
    doc.line(margin, y, margin + sigW, y)
    doc.line(margin + contentW - sigW, y, margin + contentW, y)
    doc.setFontSize(7)
    doc.setFont("helvetica", "bold")
    doc.text("RECEIVER'S SIGNATURE", margin + sigW / 2, y + 4, { align: "center" })
    doc.text("AUTHORIZED SIGNATORY", margin + contentW - sigW / 2, y + 4, { align: "center" })
  })

  doc.save(filename)
}
