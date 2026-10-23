/**
 * GST helpers for the invoice stages (Make Invoice, Check Invoice, Gate Out).
 *
 * Nothing here is assumed. The GST % is the SKU master's rate (frozen on the order line) that Dispatch
 * Planning already shows, delivered on each stage row as `gst_rate_percent`. Whether the tax is
 * CGST + SGST or IGST is decided the way Dispatch Planning does it: by comparing the depot's and the
 * customer's GST state codes (same state -> CGST + SGST, other state -> IGST).
 *
 * When the master has no GST rate (or a state code) the value is unknown: every helper returns
 * null / "—" instead of guessing a rate.
 */

const parsePercent = (p: any): number | null => {
  const n = parseFloat(p?.gst_rate_percent ?? p?.gstRatePercent)
  return Number.isFinite(n) ? n : null
}

/** GST % of a stage row from the master, or null when the master has none. */
export const gstPercentOf = (p: any): number | null => parsePercent(p)

export const hasMasterGst = (p: any): boolean => parsePercent(p) !== null

/** Tax-inclusive rate -> rate without GST (5% -> / 1.05, 10% -> / 1.10), or null when the GST % is unknown. */
export const rateWithoutGst = (rateIncTaxes: number, p: any): number | null => {
  const pct = parsePercent(p)
  return pct === null ? null : parseFloat((rateIncTaxes / (1 + pct / 100)).toFixed(2))
}

/** Rate w/o GST as display text; "—" when there is no rate or no GST % to take out of it. */
export const rateWithoutGstText = (
  rateIncTaxes: number,
  p: any,
  fmt: (n: number) => string = (n) => n.toFixed(2),
): string => {
  const v = rateWithoutGst(rateIncTaxes, p)
  return rateIncTaxes && v !== null ? fmt(v) : "—"
}

/** Taxable amount of a line (rate w/o GST x qty), or null when the GST % is unknown. */
export const taxableOf = (rateIncTaxes: number, qty: number, p: any): number | null => {
  const v = rateWithoutGst(rateIncTaxes, p)
  return v === null ? null : v * qty
}

/** Sum of taxable amounts; null as soon as one line has no GST %, so a partial total is never shown. */
export const sumTaxable = (rows: { rate: number; qty: number; product: any }[]): number | null => {
  let total = 0
  for (const r of rows) {
    const t = taxableOf(r.rate, r.qty, r.product)
    if (t === null) return null
    total += t
  }
  return total
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export interface GstRateGroup {
  pct: number
  taxable: number
  /** Total GST at this rate (CGST + SGST, or IGST). */
  tax: number
  /** Half of `tax`, i.e. each of CGST and SGST. */
  half: number
}

export interface GstSummary {
  /** Both state codes are known, so the CGST + SGST / IGST split is certain. */
  stateKnown: boolean
  isIgst: boolean
  groups: GstRateGroup[]
  /** At least one product has no GST rate in the master. */
  missingRate: boolean
  /** null when any product has no GST rate. */
  totalTaxable: number | null
  /** True only when every rate and the state split are known; tax figures below are valid only then. */
  complete: boolean
  cgst: number
  sgst: number
  igst: number
}

/**
 * @param lines one entry per invoiced product: its taxable amount (null if unknown) and its row.
 * @param depotCode / customerCode GST state codes, taken from the first product of the invoice.
 */
export function summarizeGst(
  lines: { taxable: number | null; product: any }[],
  depotCode?: string | null,
  customerCode?: string | null,
): GstSummary {
  const stateKnown = !!depotCode && !!customerCode
  const isIgst = stateKnown && depotCode !== customerCode
  const missingRate = lines.some((l) => !hasMasterGst(l.product))

  const byRate = new Map<number, number>()
  for (const l of lines) {
    const pct = parsePercent(l.product)
    if (pct === null || l.taxable === null) continue
    byRate.set(pct, (byRate.get(pct) || 0) + l.taxable)
  }
  const groups: GstRateGroup[] = [...byRate.entries()]
    .sort(([a], [b]) => a - b)
    .map(([pct, taxable]) => {
      const tax = round2((taxable * pct) / 100)
      return { pct, taxable, tax, half: round2(tax / 2) }
    })

  const totalTaxable = missingRate ? null : groups.reduce((n, g) => n + g.taxable, 0)
  const complete = lines.length > 0 && !missingRate && stateKnown
  const cgst = complete && !isIgst ? groups.reduce((n, g) => n + g.half, 0) : 0
  const igst = complete && isIgst ? groups.reduce((n, g) => n + g.tax, 0) : 0
  return { stateKnown, isIgst, groups, missingRate, totalTaxable, complete, cgst, sgst: cgst, igst }
}
