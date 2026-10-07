// Shared table display helpers (Commitment Punch table standard).
// Numbers: plain fixed decimals, no thousand separators, no currency/unit suffix (units go in the column heading).
// Dates: dd/mm/yyyy.

export const fmtNum = (v: unknown, d = 4): string => {
  if (v === null || v === undefined || v === "") return "—"
  const n = Number(v)
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
