// Detects whether a table column (by id / label) holds a weight in KGS (not qty / MT / text columns).
export const isWeightCol = (colId?: string, label?: string): boolean => {
  const t = `${colId ?? ""} ${label ?? ""}`
  return /weight(?!ment)|\bkgs?\b|(^|_)kgs?($|_)|gvw/i.test(t) && !/\(mt\)|_mt\b|reason|remark|image|copy|status|user/i.test(t)
}

/** Weight (KGS) field label in an edit-history / snapshot row (not grams, MT, units or reasons). */
export const isWeightField = (label?: unknown): boolean => {
  const f = String(label ?? "")
  return /weight|\bgvw\b|\bulw\b|passing|converted kg|\bkgs?\b/i.test(f) && !/\(gm\)|in gm|\bunit\b|reason|\(mt\)|weightment/i.test(f)
}

/** Display-only: a plain-number history value of a weight field, in Units Master KG decimals; else null. */
export const fmtHistoryWeight = (label: unknown, v: unknown, d: number): string | null => {
  if (v === null || v === undefined || !isWeightField(label)) return null
  const s = String(v).trim().replace(/,/g, "")
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null
  return Number(s).toFixed(d)
}
