// Shared table display helpers (Commitment Punch table standard).
// Amount columns: comma-separated using Indian format (en-IN) with 2 decimals (e.g. 31,005.07).
// Non-amount numbers: plain fixed decimals.
// Dates: dd/mm/yyyy.

/**
 * Detects whether a column represents a monetary amount or currency rate.
 */
export const isAmountCol = (colId?: string, label?: string): boolean => {
  if (!colId && !label) return false
  const id = (colId || "").trim()
  const lbl = (label || "").trim()
  const idLower = id.toLowerCase()
  const lblLower = lbl.toLowerCase()

  // Non-amount suffixes/patterns to exclude unless explicitly an amount keyword
  if (
    /(^|_)(qty|quantity|weight|wt|date|time|no|num|number|count|box|bag|status|user|code|plate|file|copy|image|proof|link|type|percent|percentage)(_|$)/i.test(id) &&
    !/amount|rate|price|val|cost|tax|gst|insured|advance|diesel|bhada|freight|balance|loss|tds|bill_amount/i.test(id)
  ) {
    return false
  }

  // Exact known amount columns
  const knownAmountCols = new Set([
    "rate",
    "rateperltr",
    "rateper15kg",
    "rateofmaterial",
    "rate_of_material",
    "rate_per_ltr",
    "rate_per_15kg",
    "sku_rate",
    "selling_price",
    "selling_cost",
    "landing_cost",
    "packing_cost",
    "totalwithgst",
    "total_with_gst",
    "advanceamount",
    "advance_amount",
    "bill_amount",
    "billamount",
    "total_bill_amount",
    "diesel_amount",
    "driver_advance",
    "driver_advance_cash",
    "driver_advance_bank",
    "bhada_amount",
    "bhadarate",
    "freight",
    "freight_amount",
    "sum_insured",
    "taxableamount",
    "taxable_amount",
    "cgstamount",
    "cgst_amount",
    "cgst",
    "sgstamount",
    "sgst_amount",
    "sgst",
    "igstamount",
    "igst_amount",
    "igst",
    "gst_amount",
    "roundoff",
    "round_off",
    "total_amount",
    "totalamount",
    "total_order_amount",
    "received",
    "receivedamount",
    "received_amount",
    "tds",
    "tdsamount",
    "tds_amount",
    "cd",
    "cd_amount",
    "creditnote",
    "creditnoteamount",
    "credit_note_amount",
    "debitnoteamount",
    "debit_note_amount",
    "cn_amount",
    "settlementamount",
    "settlement_amount",
    "pendingbalance",
    "pendingamount",
    "pending_amount",
    "balance",
    "balanceamount",
    "balance_amount",
    "loss",
    "loss_amount",
    "lossvalue",
    "amount",
    "threshold_limit",
  ])

  const normId = idLower.replace(/[-_]/g, "")
  if (knownAmountCols.has(normId) || knownAmountCols.has(idLower)) {
    return true
  }

  // Symbol or label checks
  if (/₹/.test(lbl) || /\(₹\)/i.test(lbl) || /₹/.test(id)) return true
  if (/amount|advance|diesel|bhada|freight|balance|loss|tds|taxable/i.test(idLower)) return true
  if (/(amount|rate|price|taxable|freight|balance)/i.test(lblLower)) return true

  return false
}

/**
 * Formats a monetary value with comma separation using Indian numbering format (e.g. 1,00,000.00 / 31,005.07).
 */
export const fmtAmount = (v: unknown, d = 2): string => {
  if (v === null || v === undefined || v === "" || v === "—") return "—"
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, "").trim())
  if (!Number.isFinite(n)) return "—"
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })
}

export const fmtNum = (v: unknown, d = 4): string => {
  if (v === null || v === undefined || v === "" || v === "—") return "—"
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, "").trim())
  return Number.isFinite(n) ? n.toFixed(d) : "—"
}

export const fmtDate = (v: unknown): string => {
  if (!v) return "—"
  const dt = new Date(v as any)
  return Number.isNaN(dt.getTime()) ? "—" : dt.toLocaleDateString("en-GB")
}

export const fmtDateTime = (v: unknown): string => {
  if (!v) return "—"
  const dt = new Date(v as any)
  if (Number.isNaN(dt.getTime())) return "—"
  return `${dt.toLocaleDateString("en-GB")} ${dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
}


/**
 * Display-only helper for edit-history old/new value cells: if the changed field is a monetary
 * field (by its label) and the value is a plain number, return it in Indian grouping; else return as-is.
 */
export const fmtHistoryAmount = (fieldName: unknown, v: unknown): string | null => {
  const f = String(fieldName ?? "").trim()
  if (!f || v === null || v === undefined) return null
  const s = String(v).trim().replace(/,/g, "")
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null
  if (/%|percent|gst|tds rate|tax rate|qty|quantity|weight|\bwt\b|date|days|level|code|name|\bid\b|type|basis|applicable|number|\bno\b/i.test(f)) return null
  if (!isAmountCol(f, f) && !/threshold|limit|insured|premium|opening|selling|landing|cost|price|cd\b|discount/i.test(f)) return null
  return fmtAmount(s)
}
