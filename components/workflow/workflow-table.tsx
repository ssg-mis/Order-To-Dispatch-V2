"use client"

import * as React from "react"
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { fmtAmount, isAmountCol } from "@/lib/table-format"
import { fmtWeight } from "@/lib/weight-format"
import { isWeightCol } from "@/lib/weight-col"
import { useWeightDecimals } from "@/hooks/use-weight-decimals"
import { Input } from "@/components/ui/input"
import { ChevronLeft, ChevronRight, ChevronsUpDown, Search } from "lucide-react"

/**
 * Optional per-column metadata (set via `meta` on a ColumnDef):
 *  - type: "number" | "date" | "text"  (number/date are right aligned, text left)
 *  - total: show a sum in the totals row (numeric columns only)
 *  - decimals: fixed decimals for the total (default 4)
 *  - search: set false to hide the per-column search box
 */
type WorkflowColMeta = { type?: "number" | "date" | "text"; total?: boolean; decimals?: number; search?: boolean }
const metaOf = (c: { columnDef: { meta?: unknown } }) => (c.columnDef.meta || {}) as WorkflowColMeta
const isRightCol = (m: WorkflowColMeta) => m.type === "number" || m.type === "date"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  searchKey: string
}

export function WorkflowTable<TData, TValue>({ columns, data, searchKey }: DataTableProps<TData, TValue>) {
  const wd = useWeightDecimals()
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    defaultColumn: { filterFn: "includesString" },
    state: {
      sorting,
      columnFilters,
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 bg-card p-4 rounded-xl border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`Search by ${searchKey}...`}
            value={(table.getColumn(searchKey)?.getFilterValue() as string) ?? ""}
            onChange={(event) => table.getColumn(searchKey)?.setFilterValue(event.target.value)}
            className="pl-9 bg-transparent"
          />
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            {/* 1) per-column search row */}
            <TableRow>
              {table.getVisibleLeafColumns().map((col) => {
                const m = metaOf(col)
                return (
                  <TableHead key={`search-${col.id}`} className={`align-top pt-2.5 pb-1 px-4 ${isRightCol(m) ? "text-right" : ""}`}>
                    {col.getCanFilter() && m.search !== false && m.type !== "date" ? (
                      <Input
                        placeholder="Search..."
                        value={(col.getFilterValue() as string) ?? ""}
                        onChange={(e) => col.setFilterValue(e.target.value)}
                        className={`h-7 text-[10px] w-full px-2.5 py-0 bg-slate-50 border-slate-200/70 rounded-md ${isRightCol(m) ? "text-right" : "text-left"}`}
                      />
                    ) : null}
                  </TableHead>
                )
              })}
            </TableRow>
            {/* 2) totals row (only when a column declares meta.total) */}
            {table.getVisibleLeafColumns().some((c) => metaOf(c).total) && table.getFilteredRowModel().rows.length > 0 && (
              <TableRow className="bg-slate-100/90 border-b-2 border-slate-300 font-bold text-xs text-slate-800 hover:bg-slate-100/90 shadow-sm">
                {table.getVisibleLeafColumns().map((col, i) => {
                  const m = metaOf(col)
                  const rows = table.getFilteredRowModel().rows
                  return (
                    <TableCell key={`total-${col.id}`} className={`px-4 ${isRightCol(m) ? "text-right font-mono tabular-nums" : ""}`}>
                      {i === 0
                        ? `Total (${rows.length})`
                        : m.total
                          ? (() => {
                              const t = rows.reduce((sum, r) => sum + (Number(r.getValue(col.id)) || 0), 0)
                              return isAmountCol(col.id, typeof col.columnDef.header === "string" ? col.columnDef.header : undefined)
                                ? fmtAmount(t, m.decimals ?? 2)
                                : isWeightCol(col.id, typeof col.columnDef.header === "string" ? col.columnDef.header : undefined)
                                  ? fmtWeight(t, wd)
                                  : t.toFixed(m.decimals ?? 4)
                            })()
                          : ""}
                    </TableCell>
                  )
                })}
              </TableRow>
            )}
            {/* 3) heading row */}
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className={`px-4 ${isRightCol(metaOf(header.column)) ? "text-right" : ""}`}>
                    {header.isPlaceholder ? null : (
                      <div
                        className={`${isRightCol(metaOf(header.column)) ? "justify-end " : ""}${
                          header.column.getCanSort() ? "flex items-center gap-2 cursor-pointer select-none" : ""
                        }`}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && <ChevronsUpDown className="h-4 w-4" />}
                      </div>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={`px-4 ${isRightCol(metaOf(cell.column)) ? "text-right font-mono tabular-nums" : ""}`}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between px-2">
        <div className="text-sm text-muted-foreground">
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="bg-transparent"
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="bg-transparent"
          >
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  )
}
