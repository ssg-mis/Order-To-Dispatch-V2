"use client"

import jsPDF from "jspdf"
import type { SlipPartyData } from "@/lib/dispatch-slip-pdf"
import { getWeightDecimals } from "@/lib/weight-format"

// "OUT GOING GATE PASS" - the client's pre-printed yellow slip, reproduced field for field. Whatever the system
// knows is filled in; everything else stays a dotted blank for the guard / weighbridge / office to write by hand.
// One page per party, same as the old slip.

const OIL_LABEL: Record<string, string> = { rice: "Rice Oil", soya: "Soya Oil", palm: "Palm Oil", other: "Oil" }
function oilLabel(name: string): string {
  const u = (name || "").toUpperCase()
  if (u.includes("RBO") || u.includes("RICE")) return OIL_LABEL.rice
  if (u.includes("SBO") || u.includes("SOYA")) return OIL_LABEL.soya
  if (u.includes("PALM")) return OIL_LABEL.palm
  return OIL_LABEL.other
}

const num = (v: any) => {
  const n = Number(String(v ?? "").replace(/,/g, ""))
  return Number.isFinite(n) && String(v ?? "").trim() !== "" ? n : null
}
const wt = (n: number) => { const d = getWeightDecimals(); return n.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d }) }

export function generateGatePassPdf(parties: SlipPartyData[], filename = "gate-pass.pdf", opts?: { print?: boolean }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageW = doc.internal.pageSize.getWidth()
  const L = 14
  const R = pageW - 14
  const FS = 10.5
  const ROW = 11

  // Label (bold) followed by a dotted rule up to x+w, with the value written on the rule.
  const field = (label: string, x: number, y: number, w: number, value?: string) => {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(FS)
    doc.setTextColor(0, 0, 0)
    doc.text(label, x, y)
    const lx = x + doc.getTextWidth(label) + 1.5
    doc.setLineDashPattern([0.4, 0.8], 0)
    doc.setLineWidth(0.25)
    doc.line(lx, y + 0.8, x + w, y + 0.8)
    doc.setLineDashPattern([], 0)
    if (value) {
      doc.setFont("helvetica", "normal")
      doc.setFontSize(FS)
      const maxW = x + w - lx - 1
      const fit = doc.splitTextToSize(value, maxW)[0] ?? ""
      doc.text(fit, lx + 1, y - 0.4)
    }
  }

  parties.forEach((p, idx) => {
    if (idx > 0) doc.addPage()

    // ---- header: logo ellipse, address, boxed title ----
    const cx = pageW / 2
    doc.setFillColor(0, 0, 0)
    doc.ellipse(cx, 24, 34, 9, "F")
    doc.setTextColor(255, 255, 255)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(15)
    doc.text("SHRI SHYAM", cx, 23, { align: "center" })
    doc.setFontSize(8.5)
    doc.text("OIL EXTRACTIONS", cx, 28, { align: "center" })
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(8.5)
    doc.setFont("helvetica", "bold")
    doc.text("Vill. BANARI (Janjgir) 495 668, Distt. Janjgir-Champa (C.G.)", cx, 37, { align: "center" })
    doc.setLineWidth(0.9)
    doc.rect(cx - 42, 40, 84, 9)
    doc.setFontSize(15)
    doc.text("OUT GOING GATE PASS", cx, 46.7, { align: "center" })

    // ---- derived values ----
    const totalQty = p.products.reduce((s, x) => s + (x.qty || 0), 0)
    const material = Array.from(new Set(p.products.map((x) => oilLabel(x.productName)))).join(", ")
    const tare = num(p.tareWt)
    const gross = num(p.grossWt)
    const net = tare !== null && gross !== null && gross >= tare ? gross - tare : null
    const driver = [p.driverName, p.driverMobile].filter(Boolean).join("  ")

    let y = 60
    const next = () => { y += ROW }

    // S. No. | Date | Time In | Date | Time Out
    field("S. No.", L, y, 30, p.serialNo)
    field("Date", L + 33, y, 36, p.date)
    field("Time In.", L + 72, y, 34, p.inTime)
    field("Date", L + 109, y, 32, p.outDate)
    field("Time Out", L + 144, y, R - L - 144, p.outTime)
    next()

    field("Party Name", L, y, R - L, p.party)
    next()
    field("Address", L, y, R - L, p.place)
    next()
    field("Vehicle No.", L, y, 100, p.vehicleNo)
    field("Mob. No.", L + 104, y, R - L - 104, driver)
    next()
    field("Material", L, y, 80, material)
    field("Bags", L + 84, y, 40)
    field("Qty.", L + 128, y, R - L - 128, totalQty ? String(totalQty) : "")
    next()
    field("Moist", L, y, 90)
    field("GCV", L + 94, y, R - L - 94)
    next()
    field("RST No.", L, y, 44, p.rstNo)
    field("Tare Wt.", L + 48, y, 44, tare !== null ? wt(tare) : "")
    field("Gross Wt.", L + 96, y, 44, gross !== null ? wt(gross) : "")
    field("Net Wt.", L + 144, y, R - L - 144, net !== null ? wt(net) : "")
    next()
    field("Weight Short", L, y, 88)
    field("Weight Bridge Supervisor Name/Sign.", L + 92, y, R - L - 92)
    next()
    field("Sauda No.", L, y, 88, p.saudaNo)
    field("Freight", L + 92, y, R - L - 92)
    next()
    field("Order No.", L, y, 88, p.commitmentNo && p.commitmentNo !== "—" ? p.commitmentNo : "")
    field("Person", L + 92, y, R - L - 92)
    next()
    field("Sampling No.", L, y, 88)
    field("Person", L + 92, y, R - L - 92)
    next()
    field("Loading Person", L, y, 88)
    field("Hamai Gr", L + 92, y, R - L - 92)
    next()
    field("Bill No.", L, y, 62, p.billNo)
    field("Diff. Dharamkanta", L + 66, y, 56)
    field("Supervisor/Sign.", L + 126, y, R - L - 126)
    next()
    field("Gate Person Name/Sign.", L, y, R - L)
    next()
    // OFFICE block
    doc.setFont("helvetica", "bold")
    doc.setFontSize(FS)
    doc.text("OFFICE :-", L, y)
    field("Time out", L + 30, y, 80)
    field("Date", L + 114, y, R - L - 114)
    next()
    field("Note", L, y, R - L)
    next()
    doc.setLineDashPattern([0.4, 0.8], 0)
    doc.setLineWidth(0.25)
    doc.line(L, y + 0.8, R, y + 0.8)
    doc.setLineDashPattern([], 0)
    y += ROW + 8
    doc.setFont("helvetica", "bold")
    doc.setFontSize(FS)
    doc.text("Office", R - 8, y, { align: "right" })
  })

  if (opts?.print) {
    doc.autoPrint()
    window.open(doc.output("bloburl") as unknown as string, "_blank")
  } else {
    doc.save(filename)
  }
}
