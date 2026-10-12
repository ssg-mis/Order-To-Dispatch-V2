"use client"

/**
 * StageDataCard - one-stop "Commitments List" style card built from the shared
 * stage-list blocks (StageListHeader / StageToolbar / StageHeadCell / StageTotalsRow)
 * for simple data-driven tables (Return hub, Unload Returned Stock, Issue Documents,
 * Transport Bills, Diesel Bills). Column toggle + reorder use the same
 * usePersistedColumns / useColumnOrder / ColumnDragProvider machinery as Commitment Punch.
 */

import * as React from "react"
import { Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ColumnDragProvider } from "@/components/ui/column-drag-provider"
import { usePersistedColumns } from "@/hooks/use-persisted-columns"
import { useColumnOrder } from "@/hooks/use-column-order"
import { useAuth } from "@/hooks/use-auth"
import { usePersistedFilters } from "@/hooks/use-persisted-filters"
import { useStageTable, type StageColDef } from "@/hooks/use-stage-table"
import {
  StageActiveChips,
  StageColumnsMenu,
  StageDivider,
  StageFilterSelect,
  StageHeadCell,
  StageListHeader,
  StageSegmented,
  StageToolbar,
  StageTotalsRow,
  resolveStageAlign,
  type StageTotalTone,
} from "@/components/stage-list"
import { cn } from "@/lib/utils"

const TONE_CLASS: Record<StageTotalTone, string> = {
  default: "text-slate-900",
  blue: "text-blue-700",
  purple: "text-purple-700",
  amber: "text-amber-700",
  emerald: "text-emerald-700",
  red: "text-red-700",
}

export interface StageDataCol<T> extends StageColDef<T> {
  /** Cell content (wrapped in a TableCell for you). */
  render: (row: T) => React.ReactNode
  width?: string
  align?: "left" | "center" | "right"
  tone?: StageTotalTone
  cellClassName?: string
}

export interface StageDataCardProps<T> {
  /** Unique key for persisted column visibility/order. */
  storageKey: string
  title: string
  description?: string
  rows: T[]
  columns: StageDataCol<T>[]
  rowKey: (row: T) => string | number
  loading?: boolean
  emptyText?: string
  searchPlaceholder?: string
  /** Segmented status buttons ("All" + each distinct value). */
  statusOf?: (row: T) => string
  /** "All X" dropdown filters built from distinct row values. */
  selects?: { id: string; allLabel: string; getValue: (row: T) => string | null | undefined }[]
  /** Optional cell shown before the data columns (e.g. selection checkbox). */
  leading?: { header?: React.ReactNode; cell: (row: T) => React.ReactNode }
  rowClassName?: (row: T) => string | undefined
  onRowClick?: (row: T) => void
  format?: (n: number, colId: string) => string
  unit?: string
  actions?: React.ReactNode
}

export function StageDataCard<T>({
  storageKey,
  title,
  description,
  rows,
  columns,
  rowKey,
  loading,
  emptyText = "No records found.",
  searchPlaceholder = "Search all columns...",
  statusOf,
  selects = [],
  leading,
  rowClassName,
  onRowClick,
  format,
  unit = "",
  actions,
}: StageDataCardProps<T>) {
  const { isAdmin, isFeatureEnabled } = useAuth()
  const allIds = React.useMemo(() => columns.map((c) => c.id), [columns])
  const [visibleColumns, setVisibleColumns] = usePersistedColumns(storageKey, allIds)
  const [columnOrder, setColumnOrder] = useColumnOrder(storageKey, allIds)

  const orderedVisibleCols = React.useMemo(
    () =>
      columnOrder
        .map((id) => columns.find((c) => c.id === id))
        .filter((c): c is StageDataCol<T> => !!c && visibleColumns.includes(c.id)),
    [columnOrder, visibleColumns, columns]
  )
  const handleColumnReorder = React.useCallback(
    (newVisibleOrder: string[]) => {
      const hidden = columnOrder.filter((id) => !visibleColumns.includes(id))
      setColumnOrder([...newVisibleOrder, ...hidden])
    },
    [columnOrder, visibleColumns, setColumnOrder]
  )

  // Page-level view state: only the status segmented value is permanent (layout-like, per user);
  // quick search and the All-X selects are session-scoped so a stale filter never hides pending work.
  // Column searches / dates are session-scoped and sort permanent in useStageTable.
  const [view, patchView, resetView] = usePersistedFilters<{
    quickSearch: string
    status: string
    selectValues: Record<string, string>
  }>(storageKey, { quickSearch: "", status: "ALL", selectValues: {} }, { permanentKeys: ["status"] })
  const { quickSearch } = view
  const setQuickSearch = React.useCallback((v: string) => patchView({ quickSearch: v }), [patchView])
  const setStatus = React.useCallback((v: string) => patchView({ status: v }), [patchView])
  const setSelectValue = React.useCallback(
    (id: string, v: string) => patchView((prev) => ({ selectValues: { ...prev.selectValues, [id]: v } })),
    [patchView]
  )

  const statusOptions = React.useMemo(() => {
    if (!statusOf) return []
    return Array.from(new Set(rows.map((r) => statusOf(r)).filter(Boolean))).sort()
  }, [rows, statusOf])

  const selectOptions = React.useMemo(() => {
    const out: Record<string, string[]> = {}
    for (const s of selects) {
      out[s.id] = Array.from(new Set(rows.map((r) => s.getValue(r)).filter((v): v is string => !!v))).sort()
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, selects.length])

  // A remembered value that no longer exists in the loaded data is treated as ALL
  // (so it can never silently hide every row). Not applied until rows have loaded.
  const dataReady = !loading && rows.length > 0
  const status = !statusOf || view.status === "ALL" || !dataReady || statusOptions.includes(view.status) ? view.status : "ALL"
  const selectValues = React.useMemo(() => {
    const out: Record<string, string> = {}
    for (const s of selects) {
      const v = view.selectValues[s.id]
      if (!v || v === "ALL") continue
      if (dataReady && !(selectOptions[s.id] || []).includes(v)) continue
      out[s.id] = v
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.selectValues, selectOptions, dataReady, selects.length])

  const baseFilter = React.useCallback(
    (row: T) => {
      if (statusOf && status !== "ALL" && statusOf(row) !== status) return false
      for (const s of selects) {
        const v = selectValues[s.id]
        if (v && v !== "ALL" && (s.getValue(row) || "") !== v) return false
      }
      const q = quickSearch.trim().toLowerCase()
      if (q) {
        const hit = columns.some((c) => {
          const v = c.accessor?.(row)
          return v !== null && v !== undefined && String(v).toLowerCase().includes(q)
        })
        if (!hit) return false
      }
      return true
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status, selectValues, quickSearch, columns, statusOf, selects.length]
  )

  const table = useStageTable<T>({ rows, columns, baseFilter, persistKey: storageKey })

  const activeSelects = selects.filter((s) => selectValues[s.id] && selectValues[s.id] !== "ALL")
  const activeCount =
    table.activeColumnFilterCount + (quickSearch.trim() ? 1 : 0) + (status !== "ALL" ? 1 : 0) + activeSelects.length

  const resetAll = () => {
    table.clearColumnFilters()
    resetView()
  }

  const chips: { label: string; onClear: () => void }[] = []
  if (status !== "ALL") chips.push({ label: `Status: ${status}`, onClear: () => setStatus("ALL") })
  for (const s of activeSelects) {
    chips.push({ label: `${s.allLabel.replace(/^All\s+/i, "")}: ${selectValues[s.id]}`, onClear: () => setSelectValue(s.id, "ALL") })
  }
  if (quickSearch.trim()) chips.push({ label: `Search: "${quickSearch.trim()}"`, onClear: () => setQuickSearch("") })
  for (const c of columns) {
    const f = table.columnFilters[c.id]
    if (f && f.trim()) chips.push({ label: `${c.label}: ${f.trim()}`, onClear: () => table.setColumnFilter(c.id, "") })
    const r = table.dateRanges[c.id]
    if (r && (r.from || r.to)) chips.push({ label: `${c.label}: ${r.from || "..."} to ${r.to || "..."}`, onClear: () => table.setDateRange(c.id, {}) })
  }

  const tones = React.useMemo(() => {
    const t: Record<string, StageTotalTone> = {}
    for (const c of columns) if (c.tone) t[c.id] = c.tone
    return t
  }, [columns])
  const aligns = React.useMemo(() => {
    const a: Record<string, "left" | "center" | "right"> = {}
    for (const c of columns) a[c.id] = c.align ?? "left"
    return a
  }, [columns])

  const colSpan = orderedVisibleCols.length + (leading ? 1 : 0)
  const showColumnsMenu = isAdmin || isFeatureEnabled("can_toggle_columns")

  return (
    <Card className="border border-slate-200/80 shadow-xs overflow-hidden py-0 gap-0 stage-card">
      <StageListHeader
        title={title}
        shown={table.rows.length}
        total={rows.length}
        description={description}
        searchValue={quickSearch}
        onSearchChange={setQuickSearch}
        searchPlaceholder={searchPlaceholder}
        actions={actions}
      >
        <StageToolbar
          shown={table.rows.length}
          total={rows.length}
          activeCount={activeCount}
          onReset={resetAll}
          filters={
            <>
              {statusOf && statusOptions.length > 0 && (
                <StageSegmented
                  value={status}
                  onChange={setStatus}
                  options={[{ value: "ALL", label: "All" }, ...statusOptions.map((s) => ({ value: s, label: s }))]}
                />
              )}
              {selects.map((s) =>
                (selectOptions[s.id] || []).length > 0 ? (
                  <React.Fragment key={s.id}>
                    {(statusOf || s !== selects[0]) && <StageDivider />}
                    <StageFilterSelect
                      value={selectValues[s.id] || "ALL"}
                      onChange={(v) => setSelectValue(s.id, v)}
                      allLabel={s.allLabel}
                      options={selectOptions[s.id]}
                    />
                  </React.Fragment>
                ) : null
              )}
              {(statusOf || selects.length > 0) && <StageDivider />}
              <StageColumnsMenu
                columns={columns.map((c) => ({ id: c.id, label: c.label }))}
                visibleColumns={visibleColumns}
                setVisibleColumns={setVisibleColumns}
                show={showColumnsMenu}
              />
            </>
          }
        />
        <StageActiveChips chips={chips} />
      </StageListHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto rounded-b-xl">
          <Table>
            <TableHeader className="bg-slate-50 border-b">
              <TableRow>
                {leading && <TableHead className="w-10 px-4 text-left align-bottom pb-2.5">{leading.header}</TableHead>}
                <ColumnDragProvider
                  columnIds={orderedVisibleCols.map((c) => c.id)}
                  onReorder={handleColumnReorder}
                  disabled={!isAdmin && !isFeatureEnabled("can_reorder_columns")}
                >
                  {orderedVisibleCols.map((col) => (
                    <StageHeadCell key={col.id} col={col} table={table} width={col.width} align={col.align} />
                  ))}
                </ColumnDragProvider>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && (
                <StageTotalsRow
                  columns={orderedVisibleCols}
                  leadingCells={leading ? 1 : 0}
                  totals={table.totals}
                  count={table.rows.length}
                  format={format}
                  unit={unit}
                  tones={tones}
                  align={aligns}
                />
              )}
              {loading ? (
                <TableRow>
                  <TableCell colSpan={colSpan} className="py-10 text-center text-slate-500">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Loading…
                  </TableCell>
                </TableRow>
              ) : table.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={colSpan} className="py-10 text-center text-slate-500">
                    {rows.length === 0 ? emptyText : "No records match the current filters."}
                  </TableCell>
                </TableRow>
              ) : (
                table.rows.map((row) => (
                  <TableRow
                    key={rowKey(row)}
                    className={cn("even:bg-slate-50/50 hover:bg-blue-50/60 transition-colors", onRowClick && "cursor-pointer", rowClassName?.(row))}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {leading && <TableCell className="px-4 text-left">{leading.cell(row)}</TableCell>}
                    {orderedVisibleCols.map((col) => (
                      <TableCell
                        key={col.id}
                        className={cn(
                          "text-xs px-4",
                          resolveStageAlign(col, col.align) === "right" ? "text-right tabular-nums font-mono" : "text-left",
                          col.cellClassName
                        )}
                      >
                        {col.render(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
