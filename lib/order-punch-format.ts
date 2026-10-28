/** Shared display formatting for the Order Punch list and detail screens. */
import { fmtDate, fmtDateTime, fmtNum, fmtAmount } from "@/lib/table-format"

export function formatDate(v: any): string {
  return fmtDate(v)
}

export function formatDateTime(v: any): string {
  return fmtDateTime(v)
}

/** Comma-separated 2 decimals Indian format (en-IN). */
export function formatAmount(v: any): string {
  return fmtAmount(v ?? 0, 2)
}

/** Plain fixed 3 decimals, no separators. */
export function formatNumber(v: any): string {
  return fmtNum(v ?? 0, 3)
}
