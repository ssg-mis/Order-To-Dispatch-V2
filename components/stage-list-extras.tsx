"use client"

/**
 * Small local additions on top of `@/components/stage-list` for tables that have a
 * leading selection-checkbox column:
 *  - StageTotalsRowLead: same look as StageTotalsRow but with empty leading cells
 *  - stageColumnChips: active-filter chips for per-column search / date range
 */

import type { StageColDef, StageTableState } from "@/hooks/use-stage-table"
import { StageTotalsRow, type StageTotalTone } from "@/components/stage-list"

/**
 * Same as StageTotalsRow (totals band between search and heading, portalled into the header cells);
 * `leadingCells` only matters for the fallback body row.
 */
export function StageTotalsRowLead<T>({
  columns,
  totals,
  count,
  format,
  unit,
  tones,
  leadingCells = 0,
  trailingCells = 0,
  align,
}: {
  columns: StageColDef<T>[]
  totals: Record<string, number>
  count: number
  format?: (n: number, colId: string) => string
  /** Deprecated and ignored: units belong in the column heading. */
  unit?: string | ((colId: string) => string)
  tones?: Record<string, StageTotalTone>
  leadingCells?: number
  trailingCells?: number
  align?: Record<string, "left" | "center" | "right">
}) {
  return (
    <StageTotalsRow
      columns={columns}
      totals={totals}
      count={count}
      format={format}
      unit={unit}
      tones={tones}
      leadingCells={leadingCells}
      trailingCells={trailingCells}
      align={align}
    />
  )
}

/** Chips for the per-column search boxes / date ranges of a useStageTable instance. */
export function stageColumnChips<T>(table: StageTableState, columns: StageColDef<T>[]): { label: string; onClear: () => void }[] {
  const chips: { label: string; onClear: () => void }[] = []
  for (const col of columns) {
    const text = table.columnFilters[col.id]
    if (text && text.trim()) chips.push({ label: `${col.label}: ${text.trim()}`, onClear: () => table.setColumnFilter(col.id, "") })
    const r = table.dateRanges[col.id]
    if (r && (r.from || r.to)) {
      chips.push({ label: `${col.label}: ${r.from || "..."} - ${r.to || "..."}`, onClear: () => table.setDateRange(col.id, {}) })
    }
  }
  return chips
}
