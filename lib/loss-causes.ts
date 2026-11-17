// Mirrors order-to-dispatch-backend-v2/utils/lossLiability.js. The reporter picks a
// cause; the party that bears the loss follows from it (custody-based liability).
export type BorneBy = "transporter" | "customer" | "company"

export const LOSS_CAUSES: Record<string, { label: string; borneBy: BorneBy }> = {
  transit_damage:     { label: "Damaged in transit",               borneBy: "transporter" },
  accident:           { label: "Vehicle accident",                 borneBy: "transporter" },
  pilferage_shortage: { label: "Short delivery / pilferage",       borneBy: "transporter" },
  unloading_handling: { label: "Damaged while unloading",          borneBy: "customer" },
  loading_error:      { label: "Short loaded at dispatch",         borneBy: "company" },
  packaging_defect:   { label: "Packaging / manufacturing defect", borneBy: "company" },
  other:              { label: "Other",                            borneBy: "company" },
}

export const SHORTAGE_CAUSES = ["pilferage_shortage", "loading_error", "other"]
export const DAMAGE_CAUSES = ["transit_damage", "accident", "unloading_handling", "packaging_defect", "other"]

export const BORNE_BY_LABEL: Record<BorneBy, string> = {
  transporter: "Transporter",
  customer: "Customer / Depot",
  company: "Company",
}

export const BORNE_BY_STYLE: Record<BorneBy, string> = {
  transporter: "bg-orange-100 text-orange-700 border-orange-200",
  customer: "bg-purple-100 text-purple-700 border-purple-200",
  company: "bg-blue-100 text-blue-700 border-blue-200",
}
