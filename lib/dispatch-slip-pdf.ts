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

export function generateDispatchSlipPdf(parties: SlipPartyData[], filename = "dispatch-slip.pdf", opts?: { print?: boolean }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 10
  const contentW = pageW - margin * 2

  parties.forEach((party, partyIdx) => {
    if (partyIdx > 0) doc.addPage()

    // Group products by oil (only oils present)
    const byOil: Record<string, SlipProduct[]> = { rice: [], soya: [], palm: [], other: [] }
    party.products.forEach((p) => byOil[oilKey(p.productName)].push(p))

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
        q += it.qty; net += it.weight; gross += it.grossWeight
        push([it.productName, String(it.qty), it.uom, wt(it.weight), "KGS", wt(it.grossWeight), "KGS"], { type: "item" })
      })
      grandQty += q; grandNet += net; grandGross += gross
      push([{ content: `Total ${OIL_LABEL[k]}`, styles: { halign: "right", fontStyle: "bold" } }, String(q), "", wt(net), "KGS", wt(gross), "KGS"], { type: "total", oil: k })
    })
    push([{ content: "Grand Total", styles: { halign: "center", fontStyle: "bold" } }, String(grandQty), "", wt(grandNet), "KGS", wt(grandGross), "KGS"], { type: "grand" })

    // Footer: signature blocks (stage pages have no punch/approve trail)
    push([
      { content: "Receiver's Signature", colSpan: 4, styles: { halign: "center", valign: "bottom", fontStyle: "bold", fontSize: 8, minCellHeight: 16 } },
      { content: "Authorized Signatory", colSpan: 3, styles: { halign: "center", valign: "bottom", fontStyle: "bold", fontSize: 8, minCellHeight: 16 } },
    ], { type: "footer" })

    const head = [
      [{ content: "SHRI SHYAM OIL EXTRACTIONS PVT LTD", colSpan: 7, styles: { halign: "center", valign: "middle", fontStyle: "bold", fontSize: 15, fillColor: WHITE } }],
      [{ content: "Vill: Banari, PO: Banari, Dist: Janjgir-Champa (CG)", colSpan: 7, styles: { halign: "center", fontStyle: "normal", fontSize: 8, textColor: [90, 90, 90], fillColor: WHITE } }],
      [{ content: "Oil Dispatch Voucher", colSpan: 7, styles: { halign: "center", fontStyle: "bold", fontSize: 12, fillColor: WHITE } }],
      [
        { content: `DO no.: ${party.commitmentNo}`, colSpan: 4, styles: { halign: "left", fontStyle: "bold", fontSize: 9, fillColor: WHITE } },
        { content: `DO Date: ${party.date}`, colSpan: 3, styles: { halign: "left", fontStyle: "bold", fontSize: 9, fillColor: WHITE } },
      ],
      [
        { content: `Customer: ${party.party}`, colSpan: 4, styles: { halign: "left", fontStyle: "bold", fontSize: 9, fillColor: WHITE } },
        { content: `Broker: ${party.brokerName}`, colSpan: 3, styles: { halign: "left", fontStyle: "bold", fontSize: 9, fillColor: WHITE } },
      ],
      [
        { content: `Address: ${party.place}`, colSpan: 4, styles: { halign: "left", fontStyle: "normal", fontSize: 8, fillColor: WHITE } },
        { content: `Mob.: ${party.partyMo}\nManual Sauda No.: ${party.processId}`, colSpan: 3, styles: { halign: "left", fontStyle: "bold", fontSize: 9, fillColor: WHITE } },
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
    })
  })

  if (opts?.print) {
    doc.autoPrint()
    window.open(doc.output("bloburl") as unknown as string, "_blank")
  } else {
    doc.save(filename)
  }
}
