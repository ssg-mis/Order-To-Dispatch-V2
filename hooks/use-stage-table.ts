"use client"

import { useCallback, useMemo } from "react"
import { usePersistedFilters } from "@/hooks/use-persisted-filters"

/**
 * useStageTable - shared client-side column search / date filter / sort / totals
 * for every stage list table (look & behaviour copied from Commitment Punch).
 *
 * Pass `persistKey` (the stage key) to remember sort permanently and column searches /
 * date ranges for the session (see usePersistedFilters for the two scopes).
 *
 * Pair it with the components in `@/components/stage-list`.
 */

export type StageColType = "text" | "number" | "date"

export interface StageColDef<T> {
  id: string
  label: string
  type?: StageColType
  /** Value used for the per-column search box and (by default) sorting. */
  accessor?: (row: T) => string | number | null | undefined
  /** Disable header sorting for this column. */
  noSort?: boolean
  /** Disable the per-column search box for this column (e.g. action columns). */
  noFilter?: boolean
  /** Show a total for this column in the TOTAL row (numeric accessor required). */
  total?: boolean
  /** Fixed decimals for this column's total in the totals row (default 4). */
  decimals?: number
}

export type DateRange = { from?: string; to?: string }

function toYmd(v: unknown): string {
  if (!v) return ""
  const d = new Date(v as any)
  if (isNaN(d.getTime())) return ""
  // local date parts so IST dates don't shift by a day
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function displayText(v: unknown, type: StageColType | undefined): string {
  if (v === null || v === undefined) return ""
  if (type === "date") {
    const d = new Date(v as any)
    return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("en-GB")
  }
  return String(v)
}

export function useStageTable<T>(opts: {
  rows: T[]
  columns: StageColDef<T>[]
  /** Optional page-level predicate (status / oil / customer / global search...). */
  baseFilter?: (row: T) => boolean
  defaultSort?: { field: string; dir: "asc" | "desc" }
  /** Stage key; when set, column filters / date ranges / sort persist (per user). */
  persistKey?: string
}) {
  const { rows, columns, baseFilter, defaultSort, persistKey } = opts
  const [view, patchView] = usePersistedFilters<{
    columnFilters: Record<string, string>
    dateRanges: Record<string, DateRange>
    sortField: string
    sortDir: "asc" | "desc"
  }>(persistKey ? `${persistKey}:table` : null, {
    columnFilters: {},
    dateRanges: {},
    sortField: defaultSort?.field ?? "",
    sortDir: defaultSort?.dir ?? "asc",
  }, { permanentKeys: ["sortField", "sortDir"] }) // sort = layout (permanent); searches/dates = session only
  const { columnFilters, dateRanges, sortField, sortDir } = view

  const setColumnFilter = useCallback((id: string, v: string) => patchView((p) => ({ columnFilters: { ...p.columnFilters, [id]: v } })), [patchView])
  const setDateRange = useCallback((id: string, r: DateRange) => patchView((p) => ({ dateRanges: { ...p.dateRanges, [id]: r } })), [patchView])
  const toggleSort = useCallback(
    (id: string) =>
      patchView((p) => (p.sortField === id ? { sortDir: p.sortDir === "asc" ? "desc" : "asc" } : { sortField: id, sortDir: "asc" })),
    [patchView]
  )
  /** Clears column searches + date ranges and restores the default sort (toolbar Reset). */
  const clearColumnFilters = useCallback(
    () =>
      patchView({
        columnFilters: {},
        dateRanges: {},
        sortField: defaultSort?.field ?? "",
        sortDir: defaultSort?.dir ?? "asc",
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [patchView]
  )

  const activeColumnFilterCount =
    Object.values(columnFilters).filter((v) => v && v.trim()).length +
    Object.values(dateRanges).filter((r) => r.from || r.to).length

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (baseFilter && !baseFilter(row)) return false
      for (const col of columns) {
        const acc = col.accessor
        if (!acc) continue
        if (col.type === "date") {
          const r = dateRanges[col.id]
          if (r && (r.from || r.to)) {
            const ymd = toYmd(acc(row))
            if (!ymd) return false
            if (r.from && ymd < r.from) return false
            if (r.to && ymd > r.to) return false
          }
        }
        const f = columnFilters[col.id]
        if (f && f.trim()) {
          const raw = acc(row)
          let hay = displayText(raw, col.type).toLowerCase()
          // number columns also match their fixed-decimal displayed value (e.g. "145000.0000")
          if (col.type === "number" && col.decimals !== undefined && raw !== null && raw !== undefined && raw !== "" && Number.isFinite(Number(raw))) {
            hay += " " + Number(raw).toFixed(col.decimals)
          }
          if (!hay.includes(f.toLowerCase().trim())) return false
        }
      }
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, columns, baseFilter, columnFilters, dateRanges])

  const sorted = useMemo(() => {
    if (!sortField) return filtered
    const col = columns.find((c) => c.id === sortField)
    if (!col?.accessor) return filtered
    const acc = col.accessor
    const dir = sortDir === "asc" ? 1 : -1
    return [...filtered].sort((a, b) => {
      const av = acc(a)
      const bv = acc(b)
      if (col.type === "number") return (Number(av ?? 0) - Number(bv ?? 0)) * dir
      if (col.type === "date") return ((new Date(av as any).getTime() || 0) - (new Date(bv as any).getTime() || 0)) * dir
      const as = String(av ?? "").toLowerCase()
      const bs = String(bv ?? "").toLowerCase()
      return as < bs ? -dir : as > bs ? dir : 0
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sortField, sortDir, columns])

  const totals = useMemo(() => {
    const t: Record<string, number> = {}
    for (const col of columns) {
      if (!col.total || !col.accessor) continue
      t[col.id] = sorted.reduce((s, r) => s + (Number(col.accessor!(r)) || 0), 0)
    }
    return t
  }, [sorted, columns])

  return {
    rows: sorted,
    totals,
    columnFilters,
    dateRanges,
    setColumnFilter,
    setDateRange,
    sortField,
    sortDir,
    toggleSort,
    clearColumnFilters,
    activeColumnFilterCount,
  }
}

export type StageTableState = ReturnType<typeof useStageTable<any>>
