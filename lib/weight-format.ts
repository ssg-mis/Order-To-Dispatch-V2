// Weight display standard: every weight (KGS) column / value shows the number of decimal places set on the
// KG unit in the Units Master. The value is cached here so non-React code (PDF generators, module-level
// column maps) can read it too; `useWeightDecimals` (hooks/use-weight-decimals.ts) keeps it in sync and
// re-renders the components that use it.
import { fmtNum } from "@/lib/table-format"

export const DEFAULT_WEIGHT_DECIMALS = 3

let weightDecimals = DEFAULT_WEIGHT_DECIMALS

export const getWeightDecimals = (): number => weightDecimals

export const setWeightDecimals = (n: number) => {
  if (Number.isInteger(n) && n >= 0 && n <= 6) weightDecimals = n
}

/** Picks the KG unit out of the Units Master list and returns its decimal places (default 3). */
export const weightDecimalsFromUnits = (units: any[] | undefined | null): number => {
  const list = Array.isArray(units) ? units : []
  const norm = (v: any) => String(v ?? "").trim().toLowerCase()
  const kg =
    list.find((u) => norm(u.short_name) === "kg") ||
    list.find((u) => ["kilogram", "kilograms"].includes(norm(u.unit_name)) && norm(u.uqc_code) === "kgs") ||
    list.find((u) => ["kilogram", "kilograms"].includes(norm(u.unit_name)))
  const n = Number(kg?.decimal_places)
  return Number.isInteger(n) && n >= 0 && n <= 6 ? n : DEFAULT_WEIGHT_DECIMALS
}

/** Formats a weight with the Units Master decimals ("—" when empty / not a number). */
export const fmtWeight = (v: unknown, d: number = weightDecimals): string => fmtNum(v, d)
