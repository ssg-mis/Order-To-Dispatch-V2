"use client"

/**
 * "Commitment Punch" table header for useStageTable based lists:
 *   row 1 = per-column search / date filter, row 2 = totals, row 3 = headings (sort + drag).
 * Numeric and date columns are right aligned, everything else left aligned; all rows share px-4.
 */

import * as React from "react"
import { TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SortableTableHead } from "@/components/ui/sortable-table-head"
import { ColumnDragProvider } from "@/components/ui/column-drag-provider"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar as CalendarIcon } from "lucide-react"
import { StageSortIcon } from "@/components/stage-list"
import { cn } from "@/lib/utils"
import { fmtNum } from "@/lib/table-format"
import type { StageColDef, StageTableState } from "@/hooks/use-stage-table"

export const isRightCol = (col: StageColDef<any>) => col.type === "number" || col.type === "date"
export const colWidthClass = (col: StageColDef<any>) => (isRightCol(col) ? "min-w-[110px]" : "")
/** Body-cell classes so a column lines up with its heading. */
export const bodyCellClass = (col: StageColDef<any> | undefined, extra = "") =>
  cn("px-4 text-xs", col && isRightCol(col) ? "text-right font-mono tabular-nums whitespace-nowrap" : "text-left", col && colWidthClass(col), extra)

function SearchCell({ col, table, right = isRightCol(col), extraClass }: { col: StageColDef<any>; table: StageTableState; right?: boolean; extraClass?: string }) {
  const filterable = !col.noFilter && !!col.accessor
  const range = table.dateRanges[col.id] || {}
  return (
    <TableHead className={cn("whitespace-nowrap align-top pt-3 pb-1.5 px-4 min-w-[120px]", colWidthClass(col), extraClass, right && "text-right")}>
      <div onClick={(e) => e.stopPropagation()} className="w-full mb-0.5 min-h-7">
        {!filterable ? null : col.type === "date" ? (
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center justify-between w-full h-7 px-2.5 text-[10px] text-slate-500 bg-white hover:bg-slate-50 border border-slate-200/70 hover:border-slate-300 rounded-md transition-all shadow-2xs">
                <span className="truncate font-medium">{range.from || range.to ? "Filtered" : "Filter..."}</span>
                <CalendarIcon className="h-3 w-3 opacity-60 ml-1 shrink-0" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-3" align="start">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <Label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Date Range</Label>
                  {(range.from || range.to) && (
                    <button onClick={() => table.setDateRange(col.id, {})} className="text-[10px] text-red-600 hover:underline font-semibold">
                      Clear
                    </button>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-medium text-slate-500">From</Label>
                  <Input type="date" value={range.from || ""} onChange={(e) => table.setDateRange(col.id, { ...range, from: e.target.value })} className="h-8 text-xs bg-slate-50 border-slate-200 shadow-none focus-visible:ring-blue-400" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-medium text-slate-500">To</Label>
                  <Input type="date" value={range.to || ""} onChange={(e) => table.setDateRange(col.id, { ...range, to: e.target.value })} className="h-8 text-xs bg-slate-50 border-slate-200 shadow-none focus-visible:ring-blue-400" />
                </div>
              </div>
            </PopoverContent>
          </Popover>
        ) : (
          <Input
            placeholder="Search..."
            value={table.columnFilters[col.id] || ""}
            onChange={(e) => table.setColumnFilter(col.id, e.target.value)}
            className={cn(
              "h-7 text-[10px] w-full px-2.5 py-0 bg-white hover:bg-slate-50 focus:bg-white border-slate-200/70 focus:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-100/50 shadow-2xs rounded-md transition-all placeholder:text-slate-400/80 font-medium text-slate-700",
              "text-left"
            )}
          />
        )}
      </div>
    </TableHead>
  )
}

function HeadingInner({ col, table, right = isRightCol(col) }: { col: StageColDef<any>; table: StageTableState; right?: boolean }) {
  const sortable = !col.noSort && !!col.accessor
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <div
        className={cn(
          "flex items-center gap-1 select-none transition-colors w-full",
          sortable && "cursor-pointer hover:text-blue-600",
          right ? "justify-end" : "justify-start"
        )}
        onClick={sortable ? () => table.toggleSort(col.id) : undefined}
      >
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">{col.label}</span>
        {sortable && <StageSortIcon active={table.sortField === col.id} dir={table.sortDir} />}
      </div>
    </div>
  )
}

const TOTAL_TONE_CLASS: Record<string, string> = {
  default: "text-slate-900", blue: "text-blue-700", purple: "text-purple-700", amber: "text-amber-700", emerald: "text-emerald-700", red: "text-red-700",
}

function TotalCell({ col, table, count, isLabel, decimals, tones, right = isRightCol(col) }: { col: StageColDef<any>; table: StageTableState; count: number; isLabel: boolean; decimals: Record<string, number>; tones?: Record<string, string>; right?: boolean }) {
  const align = right ? "text-right px-4 tabular-nums" : "px-4"
  if (isLabel) {
    return (
      <TableCell className={cn("font-black text-slate-900 uppercase tracking-wider text-[11px]", align)}>
        Total ({count})
      </TableCell>
    )
  }
  if (col.total && table.totals[col.id] !== undefined) {
    return <TableCell className={cn("font-mono font-black", tones?.[col.id] ? (TOTAL_TONE_CLASS[tones[col.id]] ?? "text-slate-900") : "text-slate-900", align)}>{fmtNum(table.totals[col.id], decimals[col.id] ?? 0)}</TableCell>
  }
  return <TableCell className={cn("text-slate-400 font-normal", align)} />
}

export function StageTableHeaderRows({
  columns,
  trailingColumns = [],
  table,
  leading,
  showTotals = true,
  decimals = {},
  onReorder,
  dragDisabled,
  tones,
  alwaysShowTotals = false,
  colClassName,
  rightIds,
}: {
  /** Optional extra class (e.g. width) per column id, applied to search + heading cells. */
  colClassName?: Record<string, string>
  /** Optional ids to right-align in addition to number/date columns. */
  rightIds?: string[]
  /** Draggable columns in display order. */
  columns: StageColDef<any>[]
  /** Fixed (non-draggable) columns after the draggable ones, e.g. Status. */
  trailingColumns?: StageColDef<any>[]
  table: StageTableState
  /** Heading-row content of an optional leading selection column (checkbox). */
  leading?: React.ReactNode
  showTotals?: boolean
  /** Decimals per total column id (default 0). */
  decimals?: Record<string, number>
  onReorder: (ids: string[]) => void
  dragDisabled: boolean
  /** Optional tone per total column id: default | blue | purple | amber | emerald | red. */
  tones?: Record<string, string>
  /** Show the "Total (n)" count row even when no visible column has a numeric total. */
  alwaysShowTotals?: boolean
}) {
  const all = [...columns, ...trailingColumns]
  const rightOf = (col: StageColDef<any>) => isRightCol(col) || !!rightIds?.includes(col.id)
  const hasTotals = showTotals && table.rows.length > 0 && (alwaysShowTotals || all.some((c) => c.total))
  return (
    <TableHeader className="bg-slate-50 border-b">
      <TableRow>
        {leading !== undefined && <TableHead className="w-10 px-2 pt-2.5 pb-1" />}
        {all.map((col) => (
          <SearchCell key={`search-${col.id}`} col={col} table={table} right={rightOf(col)} extraClass={colClassName?.[col.id]} />
        ))}
      </TableRow>
      {hasTotals && (
        <TableRow className="bg-blue-50/60 border-y border-blue-100 font-bold text-xs text-slate-800 hover:bg-blue-50/60 z-10">
          {leading !== undefined && <TableCell className="px-2" />}
          {all.map((col, i) => (
            <TotalCell key={`total-${col.id}`} col={col} table={table} count={table.rows.length} isLabel={i === 0} decimals={decimals} tones={tones} right={rightOf(col)} />
          ))}
        </TableRow>
      )}
      <TableRow>
        {leading !== undefined && <TableHead className="w-10 text-center align-top py-2.5 px-2">{leading}</TableHead>}
        <ColumnDragProvider columnIds={columns.map((c) => c.id)} onReorder={onReorder} disabled={dragDisabled}>
          {columns.map((col) => (
            <SortableTableHead key={col.id} id={col.id} className={cn("whitespace-nowrap align-top py-2.5 px-4 group/header", colWidthClass(col), colClassName?.[col.id], rightOf(col) && "text-right")}>
              <HeadingInner col={col} table={table} right={rightOf(col)} />
            </SortableTableHead>
          ))}
        </ColumnDragProvider>
        {trailingColumns.map((col) => (
          <TableHead key={col.id} className={cn("whitespace-nowrap align-top py-2.5 px-4", colWidthClass(col), colClassName?.[col.id], rightOf(col) && "text-right")}>
            <HeadingInner col={col} table={table} right={rightOf(col)} />
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  )
}
