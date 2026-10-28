"use client"

/**
 * Shared stage-list UI - the exact look of Commitment Punch, reused by every stage:
 *   1. Card header: title + "x of y" badge + description + quick search
 *   2. Filter toolbar: segmented status buttons, selects, Columns menu, Reset
 *   3. Table header: per-column Search box (or date-range Filter) ABOVE the heading, sortable
 *   4. TOTAL row between the search box and the heading (portalled into the header cells)
 *
 * Use with `useStageTable` from `@/hooks/use-stage-table`.
 */

import * as React from "react"
import { createPortal } from "react-dom"
import { ArrowDown, ArrowUp, ArrowUpDown, Calendar as CalendarIcon, Search, Settings2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ColumnToggleContent } from "@/components/ui/column-toggle-content"
import { SortableTableHead } from "@/components/ui/sortable-table-head"
import { TableCell, TableHead, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { fmtAmount, isAmountCol } from "@/lib/table-format"
import { fmtWeight } from "@/lib/weight-format"
import { isWeightCol } from "@/lib/weight-col"
import { useWeightDecimals } from "@/hooks/use-weight-decimals"
import type { StageColDef, StageTableState } from "@/hooks/use-stage-table"
import { ShellFiltersContext } from "@/components/workflow/shell-filters-context"
import { useCanSortColumns } from "@/hooks/use-can-sort-columns"

// ─── Card header (title, badge, description, quick search) + toolbar slot ───

export function StageListHeader({
  title,
  shown,
  total,
  description,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  actions,
  children,
}: {
  title: string
  shown: number
  total: number
  description?: string
  searchValue?: string
  onSearchChange?: (v: string) => void
  searchPlaceholder?: string
  /** Extra buttons next to the quick search (export etc). */
  actions?: React.ReactNode
  /** Put <StageToolbar/> (and <StageActiveChips/>) here. */
  children?: React.ReactNode
}) {
  // When rendered inside a WorkflowStageShell, pull the shell's filters (search / dates / party) into
  // this strip so there is only one filter section.
  const shell = React.useContext(ShellFiltersContext)
  const claimId = React.useId()
  const claim = shell?.claim
  const release = shell?.release
  useIsoLayoutEffect(() => {
    claim?.(claimId)
    return () => release?.(claimId)
  }, [claim, release, claimId])

  // Compact single-row strip (toolbar + search). Title/description live in the page heading.
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 px-4 py-3 bg-slate-100/80 border-b border-slate-200">
      {shell && shell.claimedBy === claimId && <div className="contents text-xs">{shell.node}</div>}
      {children}
      <div className="order-2 flex w-full items-center gap-2 sm:w-auto sm:ml-auto">
        {actions}
        {shell && shell.claimedBy === claimId && (
          <div
            ref={shell.setActionsEl}
            className="flex items-center gap-2 empty:hidden [&>button]:!h-8 [&>button]:!w-auto [&>button]:px-3 [&>button]:text-xs"
          />
        )}
        {onSearchChange && !(shell && shell.claimedBy === claimId) && (
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder={searchPlaceholder}
              className="pl-8 pr-8 text-xs h-8 bg-white hover:bg-white focus:bg-white border-slate-200 rounded-md transition-all focus-visible:ring-1 focus-visible:ring-blue-600 shadow-2xs"
              value={searchValue ?? ""}
              onChange={(e) => onSearchChange(e.target.value)}
            />
            {searchValue && (
              <button
                onClick={() => onSearchChange("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Filter toolbar ──────────────────────────────────────────────

export function StageSegmented<V extends string>({
  value,
  onChange,
  options,
}: {
  value: V
  onChange: (v: V) => void
  options: { value: V; label: string }[]
}) {
  // Inside a WorkflowStageShell the strip already carries search + party + filters, so the status
  // toggle gets its own row underneath instead of crowding the main one.
  const shell = React.useContext(ShellFiltersContext)
  const toggle = (
    <div className="flex h-8 items-center bg-slate-50 p-0.5 rounded-md border border-slate-200">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "h-full px-2.5 text-xs font-semibold rounded transition-all cursor-pointer",
            value === o.value ? "bg-blue-600 text-white shadow-xs font-bold" : "text-slate-600 hover:text-slate-900 hover:bg-white"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
  if (!shell) return toggle
  return (
    <div className="order-3 flex w-full items-center gap-3 border-t border-slate-200/80 pt-2.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Status</span>
      {toggle}
    </div>
  )
}

export function StageFilterSelect({
  value,
  onChange,
  allLabel,
  options,
  className,
}: {
  value: string
  onChange: (v: string) => void
  /** e.g. "All Oils" - the "ALL" option. */
  allLabel: string
  options: string[]
  className?: string
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn("!h-8 text-xs min-w-[115px] max-w-[190px] bg-white border-slate-200 shadow-2xs truncate px-2.5 py-0", className)}>
        <SelectValue placeholder={allLabel} />
      </SelectTrigger>
      <SelectContent className="max-h-64">
        <SelectItem value="ALL">{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o} className="text-xs truncate">
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function StageColumnsMenu({
  columns,
  visibleColumns,
  setVisibleColumns,
  show = true,
}: {
  columns: { id: string; label: string }[]
  visibleColumns: string[]
  setVisibleColumns: (updater: (prev: string[]) => string[]) => void
  /** Pass `isAdmin || isFeatureEnabled('can_toggle_columns')`. */
  show?: boolean
}) {
  if (!show) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs bg-transparent">
          <Settings2 className="mr-1.5 h-3.5 w-3.5" />
          Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[250px]" collisionPadding={16}>
        <ColumnToggleContent columns={columns} visibleColumns={visibleColumns} setVisibleColumns={setVisibleColumns} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function StageToolbar({
  filters,
  shown,
  total,
  activeCount,
  onReset,
}: {
  /** Segmented control, <StageFilterSelect/>s, <StageColumnsMenu/> ... */
  filters: React.ReactNode
  shown: number
  total: number
  activeCount: number
  onReset: () => void
}) {
  return (
    <div className="order-1 contents text-xs">
      <div className="contents">{filters}</div>
      <div className="contents">
        {activeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 px-2 rounded transition-colors gap-1 cursor-pointer"
            onClick={onReset}
          >
            <X className="h-3 w-3" />
            Reset ({activeCount})
          </Button>
        )}
      </div>
    </div>
  )
}

export function StageDivider() {
  const shell = React.useContext(ShellFiltersContext)
  if (shell) return null
  return <div className="hidden sm:block h-5 w-px bg-slate-200" />
}

export function StageActiveChips({ chips }: { chips: { label: string; onClear: () => void }[] }) {
  if (chips.length === 0) return null
  return (
    <div className="order-3 flex w-full flex-wrap items-center gap-1.5">
      <span className="text-[11px] font-semibold text-slate-400 mr-1">Active:</span>
      {chips.map((c) => (
        <Badge key={c.label} variant="secondary" className="gap-1 text-[10px] font-medium bg-blue-50 text-blue-700 border-blue-200 pl-2 pr-1 py-0.5">
          {c.label}
          <button onClick={c.onClear} className="hover:text-blue-900 cursor-pointer p-0.5 rounded-full hover:bg-blue-100">
            <X className="h-2.5 w-2.5" />
          </button>
        </Badge>
      ))}
    </div>
  )
}

// ─── Table header cell: [search box] above [heading + sort icon] ──────

export function StageSortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ArrowUpDown className="ml-1 h-3 w-3 text-slate-400 inline" />
  return dir === "asc" ? <ArrowUp className="ml-1 h-3 w-3 text-blue-600 inline" /> : <ArrowDown className="ml-1 h-3 w-3 text-blue-600 inline" />
}

/**
 * Column alignment per the table standard: numeric + date columns RIGHT, everything else LEFT
 * (centered cells are not used). `requested` is only honoured when it is "right".
 */
export function resolveStageAlign(col: { type?: string; total?: boolean }, requested?: "left" | "center" | "right"): "left" | "right" {
  if (col.type === "number" || col.type === "date" || col.total) return "right"
  return requested === "right" ? "right" : "left"
}

/**
 * Drop-in replacement for the <SortableTableHead> header cell. Must be rendered inside
 * <ColumnDragProvider>. `width` is a tailwind width class. Renders, top to bottom inside the one
 * header cell: [search / date filter] -> [totals slot, filled by <StageTotalsRow/>] -> [heading + sort].
 * `align` is accepted for backwards compatibility; alignment is derived from `col.type`
 * (number/date/total -> right, otherwise left) unless "right" is passed.
 */
export function StageHeadCell<T>({
  col,
  table,
  width,
  align,
}: {
  col: StageColDef<T>
  table: StageTableState
  width?: string
  align?: "left" | "center" | "right"
}) {
  const canSort = useCanSortColumns()
  const sortable = canSort && !col.noSort && !!col.accessor
  const filterable = !col.noFilter && !!col.accessor
  const range = table.dateRanges[col.id] || {}
  const isRight = resolveStageAlign(col, align) === "right"

  return (
    <SortableTableHead
      id={col.id}
      fill
      className={cn("whitespace-nowrap align-top py-0 px-4 min-w-[120px] group/header", width, isRight && "text-right")}
    >
      <div className="flex flex-col w-full">
        <div onClick={(e) => e.stopPropagation()} className="w-full pt-3 pb-2 min-h-7 box-content">
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
                    <Input
                      type="date"
                      value={range.from || ""}
                      onChange={(e) => table.setDateRange(col.id, { ...range, from: e.target.value })}
                      className="h-8 text-xs bg-slate-50 border-slate-200 shadow-none focus-visible:ring-blue-400"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-medium text-slate-500">To</Label>
                    <Input
                      type="date"
                      value={range.to || ""}
                      onChange={(e) => table.setDateRange(col.id, { ...range, to: e.target.value })}
                      className="h-8 text-xs bg-slate-50 border-slate-200 shadow-none focus-visible:ring-blue-400"
                    />
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
        {/* Totals band: filled by <StageTotalsRow/> (portal). Hidden while empty. */}
        <div data-stage-total-slot={col.id} className="w-full empty:hidden" />
        <div
          className={cn(
            "flex items-center gap-1 select-none transition-colors w-full py-2.5",
            sortable && "cursor-pointer hover:text-blue-600",
            isRight ? "justify-end" : "justify-start"
          )}
          onClick={sortable ? () => table.toggleSort(col.id) : undefined}
        >
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">{col.label}</span>
          {sortable && <StageSortIcon active={table.sortField === col.id} dir={table.sortDir} />}
        </div>
      </div>
    </SortableTableHead>
  )
}

/**
 * Header cell for a non-data column (e.g. "Action") next to <StageHeadCell/>s. It has the same three
 * bands (search gap / totals slot / heading) so the search row, TOTAL band and headings run
 * unbroken across the whole table.
 */
export function StageActionHead({ label = "Action", className }: { label?: React.ReactNode; className?: string }) {
  return (
    <TableHead className={cn("whitespace-nowrap align-top py-0 px-4 text-left", className)}>
      <div className="flex w-full flex-col">
        <div className="box-content min-h-7 w-full pt-3 pb-2" />
        <div data-stage-total-slot="__action" className="w-full empty:hidden" />
        <div className="flex w-full items-center py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">{label}</div>
      </div>
    </TableHead>
  )
}

// ─── TOTAL row ────────────────────────────────────────────────────────

export type StageTotalTone = "default" | "blue" | "purple" | "amber" | "emerald" | "red"
const TONE: Record<StageTotalTone, string> = {
  default: "text-slate-900",
  blue: "text-blue-700",
  purple: "text-purple-700",
  amber: "text-amber-700",
  emerald: "text-emerald-700",
  red: "text-red-700",
}

/** Plain numbers: no currency symbol (preserves comma separators). */
const cleanTotal = (s: string) => s.replace(/₹/g, "").trim()

const useIsoLayoutEffect = typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect

const BAND_CLASS =
  "-mx-4 px-4 min-h-8 flex items-center bg-blue-50/60 border-y border-blue-100 font-bold text-xs text-slate-800 whitespace-nowrap"

/**
 * Totals row. Pages render it as the first child of <TableBody>, but with the table standard the
 * totals must sit between the search row and the heading row, so when the table uses <StageHeadCell/>
 * the content is portalled into each header cell's totals slot (search -> totals -> heading) and the
 * body row itself stays hidden. Without StageHeadCell slots it falls back to a normal body row.
 * Nothing is rendered when there are no rows or no column has a total.
 */
export function StageTotalsRow<T>({
  columns,
  totals,
  count,
  format,
  tones,
  labelColumnId,
  trailingCells = 0,
  leadingCells = 0,
  align,
}: {
  columns: StageColDef<T>[]
  totals: Record<string, number>
  count: number
  /** Number formatter (default: fixed decimals from `col.decimals`, else 4). Any ₹ is stripped, comma separators preserved. */
  format?: (n: number, colId: string) => string
  /** Deprecated and ignored: units belong in the column heading, never in cells. */
  unit?: string | ((colId: string) => string)
  /** Colour per column id; default slate. */
  tones?: Record<string, StageTotalTone>
  /** Which column shows "Total (n)"; defaults to the first column. */
  labelColumnId?: string
  /** Empty cells to append for trailing action columns (fallback body row only). */
  trailingCells?: number
  /** Empty cells to prepend for leading selection columns (fallback body row only). */
  leadingCells?: number
  /** Deprecated: alignment is derived from column type (numbers/dates right, text left). */
  align?: Record<string, "left" | "center" | "right">
}) {
  const wd = useWeightDecimals()
  const sentinel = React.useRef<HTMLTableRowElement>(null)
  const [state, setState] = React.useState<{ checked: boolean; slots: Record<string, HTMLElement> }>({ checked: false, slots: {} })

  useIsoLayoutEffect(() => {
    const tbl = sentinel.current?.closest("table")
    if (!tbl) return
    const slots: Record<string, HTMLElement> = {}
    tbl.querySelectorAll<HTMLElement>("[data-stage-total-slot]").forEach((el) => {
      if (el.closest("table") === tbl && el.dataset.stageTotalSlot) slots[el.dataset.stageTotalSlot] = el
    })
    const prev = state.slots
    const pk = Object.keys(prev)
    const nk = Object.keys(slots)
    const same = state.checked && pk.length === nk.length && nk.every((k) => prev[k] === slots[k])
    if (!same) setState({ checked: true, slots })
  })

  const hasTotals = columns.some((c) => c.total && totals[c.id] !== undefined)
  if (count === 0 || !hasTotals) return null

  const fmt = (n: number, id: string) => {
    const col = columns.find((c) => c.id === id)
    if (isAmountCol(id, col?.label)) {
      return fmtAmount(n, col?.decimals ?? 2)
    }
    if (isWeightCol(id, col?.label)) return fmtWeight(n, wd)
    return cleanTotal(format ? format(n, id) : n.toFixed(col?.decimals ?? 4))
  }
  const slotIds = Object.keys(state.slots)
  const useSlots = state.checked && slotIds.length > 0
  const labelId = useSlots
    ? labelColumnId && state.slots[labelColumnId]
      ? labelColumnId
      : columns.find((c) => state.slots[c.id])?.id
    : labelColumnId ?? columns[0]?.id

  const content = (col: StageColDef<T>) => {
    if (col.id === labelId) return <span className="font-black text-slate-900 uppercase tracking-wider text-[11px]">Total ({count})</span>
    if (col.total && totals[col.id] !== undefined)
      return <span className={cn("font-mono font-black tabular-nums", TONE[tones?.[col.id] ?? "default"])}>{fmt(totals[col.id], col.id)}</span>
    return null
  }

  if (!state.checked) return <tr hidden ref={sentinel} />

  if (useSlots) {
    return (
      <>
        <tr hidden ref={sentinel} />
        {columns.map((col) => {
          const el = state.slots[col.id]
          if (!el) return null
          const a = resolveStageAlign(col, align?.[col.id])
          return createPortal(
            <div className={cn(BAND_CLASS, a === "right" ? "justify-end text-right" : "justify-start text-left")}>{content(col)}</div>,
            el,
            col.id
          )
        })}
        {slotIds
          .filter((id) => !columns.some((c) => c.id === id))
          .map((id) => createPortal(<div className={BAND_CLASS} />, state.slots[id], id))}
      </>
    )
  }

  // Fallback: no StageHeadCell slots in this table -> ordinary body row.
  return (
    <>
      <tr hidden ref={sentinel} />
      <TableRow className="bg-blue-50/60 border-y border-blue-100 font-bold text-xs text-slate-800 hover:bg-blue-50/60 z-10">
        {Array.from({ length: leadingCells }).map((_, i) => (
          <TableCell key={`total-lead-${i}`} className="px-2" />
        ))}
        {columns.map((col) => {
          const a = resolveStageAlign(col, align?.[col.id])
          return (
            <TableCell key={`total-${col.id}`} className={cn("px-4", a === "right" ? "text-right" : "text-left")}>
              {content(col)}
            </TableCell>
          )
        })}
        {Array.from({ length: trailingCells }).map((_, i) => (
          <TableCell key={`total-trail-${i}`} className="px-2" />
        ))}
      </TableRow>
    </>
  )
}

/**
 * Page-level bulk action buttons (e.g. "Process Selected"). Inside a WorkflowStageShell they are
 * portalled into the list strip (right side) so the table starts right under the heading; elsewhere
 * (or until the list has mounted) they render as a plain right-aligned row.
 */
export function StageActionBar({ children }: { children: React.ReactNode }) {
  const shell = React.useContext(ShellFiltersContext)
  if (shell?.actionsEl) return createPortal(children, shell.actionsEl)
  return <div className="flex flex-wrap justify-end gap-2">{children}</div>
}

/**
 * Standard pagination footer for every stage list (replaces the per-page copies):
 * "Page x of y | N <noun>" on the left, Previous / Next on the right.
 */
export function StagePagination({
  page,
  totalPages,
  total,
  noun = "Items",
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
  sticky = true,
  mobileAction,
}: {
  sticky?: boolean
  /** Rendered inside the fixed bar, above Previous/Next, on mobile only (e.g. the stage's main action button). */
  mobileAction?: React.ReactNode
  page: number
  totalPages: number
  total: number
  noun?: string
  onPrev: () => void
  onNext: () => void
  prevDisabled?: boolean
  nextDisabled?: boolean
}) {
  // When `sticky`, the bar is pinned to the bottom of the viewport, aligned to the
  // page's <main> (so it never covers the sidebar). An in-flow spacer of the same
  // height keeps the last table rows from hiding underneath it.
  const spacerRef = React.useRef<HTMLDivElement>(null)
  const [frame, setFrame] = React.useState<{ left: number; width: number } | null>(null)

  React.useEffect(() => {
    if (!sticky) return
    const main = spacerRef.current?.closest("main")
    if (!main) return
    const measure = () => {
      const r = main.getBoundingClientRect()
      setFrame({ left: r.left, width: r.width })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(main)
    window.addEventListener("resize", measure)
    return () => {
      ro.disconnect()
      window.removeEventListener("resize", measure)
    }
  }, [sticky])

  const bar = (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-1 text-xs shadow-xs ${sticky ? "bg-slate-100 shadow-md" : "mt-3 bg-slate-100/80"}`}
    >
      <div className="font-medium text-slate-500">
        Page <strong className="text-slate-800">{page}</strong> of <strong className="text-slate-800">{totalPages}</strong>
        <span className="mx-2 text-slate-300">|</span>
        <strong className="text-slate-800">{total}</strong> {noun}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="h-7 px-3 text-xs bg-white" disabled={prevDisabled ?? page <= 1} onClick={onPrev}>
          Previous
        </Button>
        <Button variant="outline" size="sm" className="h-7 px-3 text-xs bg-white" disabled={nextDisabled ?? page >= totalPages} onClick={onNext}>
          Next
        </Button>
      </div>
    </div>
  )

  if (!sticky) return bar
  return (
    <>
      <div ref={spacerRef} className={`mt-2 ${mobileAction ? "h-10 max-md:h-24" : "h-10"}`} aria-hidden />
      {frame && (
        <div
          className="fixed bottom-0 z-30 px-3 py-1 border-t border-slate-200"
          style={{ left: frame.left, width: frame.width, background: "oklch(0.97 0.012 245)" }}
        >
          {mobileAction && <div className="pb-1 md:hidden">{mobileAction}</div>}
          {bar}
        </div>
      )}
    </>
  )
}

export interface StageFooterAction {
  label: React.ReactNode
  onClick: () => void
  disabled?: boolean
  title?: string
  /** Extra classes merged into the button (e.g. an emerald "Approve & Lock"). When given on a StageActionFooter action, the default blue primary style is not applied. */
  className?: string
}

/**
 * Standard bottom bar of every stage dialog that can send the work back (Revert Remarks + revert buttons).
 * Layout, identical everywhere: Revert Remarks input on the left (takes the free width); on the right, on one
 * baseline and one height: the revert button(s), a divider, optional extra actions (e.g. Save Draft), Cancel,
 * and the primary confirm. Wraps to stacked rows on small screens.
 */
export function StageDecisionFooter({
  remarks,
  onRemarksChange,
  remarksPlaceholder = "Enter reason for reverting...",
  remarksLabel = "Revert Remarks",
  remarksRequired = true,
  disabled,
  revertActions,
  extraActions = [],
  onCancel,
  cancelLabel = "Cancel",
  cancelDisabled,
  approve,
}: {
  remarks: string
  onRemarksChange: (value: string) => void
  remarksPlaceholder?: string
  /** Defaults to "Revert Remarks"; set remarksRequired={false} to drop the red asterisk when the approve path doesn't need remarks. */
  remarksLabel?: string
  remarksRequired?: boolean
  disabled?: boolean
  /** Revert buttons. The last one is destructive red; earlier ones are amber outline. */
  revertActions: StageFooterAction[]
  /** Neutral actions shown next to Cancel (e.g. Save Draft). */
  extraActions?: StageFooterAction[]
  onCancel: () => void
  cancelLabel?: string
  cancelDisabled?: boolean
  approve: StageFooterAction
}) {
  return (
    <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-end lg:gap-6">
      <div className="min-w-0 flex-1 space-y-1.5">
        <Label className="ml-1 text-[10px] font-black uppercase tracking-tighter text-red-500">
          {remarksLabel} {remarksRequired && <span className="text-red-500">*</span>}
        </Label>
        <Input
          className="h-10 w-full rounded-lg border-2 border-red-200 bg-white font-medium transition-colors focus:border-red-400"
          disabled={disabled}
          placeholder={remarksPlaceholder}
          value={remarks}
          onChange={(e) => onRemarksChange(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:shrink-0 lg:flex-nowrap">
        {revertActions.map((r, i) => {
          const isLast = i === revertActions.length - 1
          return (
            <Button
              key={i}
              variant={isLast ? "destructive" : "outline"}
              onClick={r.onClick}
              disabled={r.disabled}
              title={r.title}
              className={cn(
                "h-10 px-5 font-black uppercase tracking-tight",
                !isLast && "border-amber-500 text-amber-600 hover:bg-amber-50"
              )}
            >
              {r.label}
            </Button>
          )
        })}
        <div className="hidden h-8 w-px bg-slate-300 sm:block" aria-hidden />
        <div className="flex flex-wrap items-center gap-3">
          {extraActions.map((x, i) => (
            <Button
              key={i}
              variant="outline"
              onClick={x.onClick}
              disabled={x.disabled}
              title={x.title}
              className="h-10 border-amber-300 font-semibold text-amber-700 hover:bg-amber-50"
            >
              {x.label}
            </Button>
          ))}
          <Button variant="outline" onClick={onCancel} disabled={cancelDisabled} className="h-10">
            {cancelLabel}
          </Button>
          <Button
            onClick={approve.onClick}
            disabled={approve.disabled}
            title={approve.title}
            className={cn("h-10 bg-blue-600 px-6 font-black hover:bg-blue-700", approve.className)}
          >
            {approve.label}
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * Standard bottom bar of every other stage dialog (no revert): actions grouped on the right on one baseline
 * and one height, Cancel first and the primary action last. Pass any secondary actions before the primary one.
 */
export function StageActionFooter({
  onCancel,
  cancelLabel = "Cancel",
  cancelDisabled,
  actions,
}: {
  onCancel: () => void
  cancelLabel?: string
  cancelDisabled?: boolean
  /** Secondary actions first, the primary (blue) action LAST. */
  actions: (StageFooterAction & { variant?: "default" | "destructive" | "outline" })[]
}) {
  return (
    <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
      <Button variant="outline" onClick={onCancel} disabled={cancelDisabled} className="h-10">
        {cancelLabel}
      </Button>
      {actions.map((a, i) => {
        const isPrimary = i === actions.length - 1 && !a.variant && !a.className
        return (
          <Button
            key={i}
            variant={a.variant ?? "default"}
            onClick={a.onClick}
            disabled={a.disabled}
            title={a.title}
            className={cn("h-10 px-6 font-black", isPrimary && "bg-blue-600 hover:bg-blue-700", a.className)}
          >
            {a.label}
          </Button>
        )
      })}
    </div>
  )
}
