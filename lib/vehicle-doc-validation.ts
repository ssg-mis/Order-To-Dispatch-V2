// A vehicle document's expiry date must come with its file: a date without an
// uploaded document is what shows up as "Not Uploaded" + a Valid Upto date in
// Plan Vehicle. Returns errors keyed by the image field name.
export type VehicleDocFileErrors = Record<string, string>

const DOC_PAIRS: { date: string; file: string; label: string }[] = [
  { date: "fitness", file: "fitness_image", label: "Fitness" },
  { date: "insurance", file: "insurance_image", label: "Insurance" },
  { date: "pollution", file: "pollution_image", label: "Pollution" },
  { date: "road_tax", file: "road_tax_image", label: "Road Tax" },
  { date: "state_permit", file: "state_permit_image", label: "State Permit" },
  { date: "national_permit", file: "national_permit_image", label: "National Permit" },
]

export function getVehicleDocFileErrors(form: any, roadTaxType: "expiry" | "lifetime"): VehicleDocFileErrors {
  const errors: VehicleDocFileErrors = {}
  for (const { date, file, label } of DOC_PAIRS) {
    if (date === "road_tax" && roadTaxType !== "expiry") continue
    const hasDate = String(form?.[date] ?? "").trim() !== ""
    const hasFile = String(form?.[file] ?? "").trim() !== ""
    if (hasDate && !hasFile) errors[file] = `${label} document is required when an expiry date is entered`
  }
  return errors
}
