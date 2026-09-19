/** Shared display formatting for the Order Punch list and detail screens. */

export function formatDate(v: any): string {
  if (!v) return "—"
  const d = new Date(v)
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-IN")
}

export function formatDateTime(v: any): string {
  if (!v) return "—"
  const d = new Date(v)
  return isNaN(d.getTime()) ? "—" : d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
}

export function formatAmount(v: any): string {
  const n = Number(v || 0)
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatNumber(v: any): string {
  const n = Number(v || 0)
  return n.toLocaleString("en-IN", { maximumFractionDigits: 3 })
}
