"use client"

import { Card } from "@/components/ui/card"
import { WorkflowStageShell } from "@/components/workflow/workflow-stage-shell"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ColumnToggleContent } from "@/components/ui/column-toggle-content"
import { ColumnFilterPopover } from "@/components/ui/column-filter-popover"
import { ChevronLeft, ChevronRight, Settings2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { useState, useEffect, useMemo, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { approvalApi } from "@/lib/api-service"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { usePersistedColumns } from "@/hooks/use-persisted-columns"
import { useColumnOrder } from "@/hooks/use-column-order"
import { usePersistedSort } from "@/hooks/use-persisted-sort"
import { SortableTableHead } from "@/components/ui/sortable-table-head"
import { ColumnDragProvider } from "@/components/ui/column-drag-provider"
import { ApprovalDetailDialog } from "@/components/approval-of-order/approval-detail-dialog"

const STAGE_KEY = "approval-of-order"

// Client-specified column set (in the requested order) - a plain map straight
// onto flattenGroupedOrderApproval's flat keys, one row per DO.
const PAGE_COLUMNS = [
  { id: "party_so_date", label: "DO Date", type: "date" as const },
  { id: "order_no", label: "DO No.", type: "text" as const },
  { id: "manual_sauda_no", label: "Manual Sauda No.", type: "text" as const },
  { id: "customer_name", label: "Customer Name", type: "text" as const },
  { id: "total_qty_box", label: "Total Qty (Box)", type: "number" as const },
  { id: "total_qty_kg", label: "Total Qty (KGS)", type: "number" as const },
  { id: "total_order_amount", label: "Total Order Amount", type: "number" as const },
  { id: "dispatch_from", label: "Dispatch from", type: "text" as const },
  { id: "status", label: "Status", type: "text" as const, historyOnly: true },
  { id: "remarks", label: "Remarks", type: "text" as const },
  { id: "broker_name", label: "Broker", type: "text" as const },
  { id: "order_punch_user", label: "Order Punch By (user)", type: "text" as const },
  { id: "order_datetime", label: "Actual Datetime", type: "date" as const },
  { id: "actual_datetime", label: "Action Date", type: "date" as const, historyOnly: true },
]
const TOTAL_COLUMN_IDS = new Set(["total_qty_box", "total_qty_kg", "total_order_amount"])

const fmtDate = (v: string | null | undefined) => {
  if (!v) return "—"
  const d = new Date(v)
  if (isNaN(d.getTime())) return String(v)
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
}
const fmtNumber = (v: number | null | undefined) => {
  const n = Number(v || 0)
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 })
}
const fmtMoney = (v: number | null | undefined) => `₹${fmtNumber(v)}`

const fmtDateTime = (v: string | null | undefined) => {
  if (!v) return "—"
  const d = new Date(v)
  if (isNaN(d.getTime())) return String(v)
  return d.toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })
}

function formatCell(colId: string, value: any) {
  if (colId === "order_datetime") return fmtDateTime(value)
  if (colId === "party_so_date" || colId === "actual_datetime") return fmtDate(value)
  if (colId === "total_order_amount") return fmtMoney(value)
  if (colId === "total_qty_box" || colId === "total_qty_kg") return fmtNumber(value)
  if (colId === "status") {
    if (!value) return "—";
    const status = String(value);
    const badgeClass = "font-black tracking-wider text-[10px] px-2.5 py-0.5 rounded-md border-0";
    if (status === "Approved") return <Badge variant="secondary" className={cn(badgeClass, "bg-emerald-100 text-emerald-700 hover:bg-emerald-200/80")}>APPROVED</Badge>
    if (status === "Rejected") return <Badge variant="secondary" className={cn(badgeClass, "bg-rose-100 text-rose-700 hover:bg-rose-200/80")}>REJECTED</Badge>
    if (status === "Required Modification") return <Badge variant="secondary" className={cn(badgeClass, "bg-amber-100 text-amber-700 hover:bg-amber-200/80")}>MODIFICATION REQUIRED</Badge>
    return <Badge variant="secondary" className={cn(badgeClass, "bg-slate-100 text-slate-700 hover:bg-slate-200/80")}>{status.toUpperCase()}</Badge>
  }
  return value ?? "—"
}

export default function ApprovalOfOrderPage() {
  const { isAdmin, isFeatureEnabled } = useAuth()
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending")
  const [filterValues, setFilterValues] = useState({
    search: "",
    status: "",
    startDate: "",
    endDate: "",
    partyName: "",
  })
  
  const [pendingPage, setPendingPage] = useState(1)
  const [historyPage, setHistoryPage] = useState(1)
  const limit = 20
  const [filterOptions, setFilterOptions] = useState<{ customerNames: string[] }>({ customerNames: [] })
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)

  const [visibleColumns, setVisibleColumns] = usePersistedColumns(STAGE_KEY, PAGE_COLUMNS.filter(c => !c.historyOnly).map((c) => c.id))
  const [columnOrder, setColumnOrder] = useColumnOrder(STAGE_KEY, PAGE_COLUMNS.map((c) => c.id))
  const [sort, setSort] = usePersistedSort(STAGE_KEY, { field: "party_so_date", dir: "desc" })

  const availableCols = PAGE_COLUMNS.filter(c => activeTab === "history" || !c.historyOnly)
  
  const orderedVisibleCols = columnOrder
    .map((id) => availableCols.find((c) => c.id === id))
    .filter((col): col is typeof PAGE_COLUMNS[0] => !!col && (visibleColumns.includes(col.id) || (activeTab === "history" && col.historyOnly)))
    
  const handleColumnReorder = useCallback(
    (newVisibleOrder: string[]) => {
      const hiddenCols = columnOrder.filter((id) => !orderedVisibleCols.find(c => c.id === id))
      setColumnOrder([...newVisibleOrder, ...hiddenCols])
    },
    [columnOrder, orderedVisibleCols, setColumnOrder]
  )
  const handleSort = (field: string) => {
    if (sort?.field === field) {
      if (sort.dir === "asc") setSort({ field, dir: "desc" })
      else setSort(null)
    } else {
      setSort({ field, dir: "asc" })
    }
  }
  const SortIcon = ({ field }: { field: string }) => {
    if (sort?.field !== field) return <ArrowUpDown className="ml-1 inline h-3 w-3 text-slate-400" />
    return sort.dir === "asc" ? <ArrowUp className="ml-1 inline h-3 w-3 text-blue-600" /> : <ArrowDown className="ml-1 inline h-3 w-3 text-blue-600" />
  }

  // Per-column Search + Filter
  const [columnSearch, setColumnSearch] = useState<Record<string, string>>({})
  const [columnFilterValues, setColumnFilterValues] = useState<Record<string, string[] | null>>({})

  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const res = await approvalApi.getFilters()
        if (res.success) setFilterOptions({ customerNames: res.data?.customerNames || [] })
      } catch (error) {
        console.error("Failed to fetch filter options:", error)
      }
    }
    fetchFilters()
  }, [])

  useEffect(() => {
    setPendingPage(1)
    setHistoryPage(1)
  }, [filterValues])

  const {
    data: pendingResult,
    isLoading: isPendingLoading,
    refetch: refetchPending,
  } = useQuery({
    queryKey: ["approval-pending", filterValues, pendingPage],
    queryFn: async () => {
      const response = await approvalApi.getPending({
        page: pendingPage,
        limit,
        search: filterValues.search,
        customer_name: filterValues.partyName === "all" ? undefined : filterValues.partyName,
        start_date: filterValues.startDate,
        end_date: filterValues.endDate,
      })
      return response.success ? response.data : { orders: [], pagination: { total: 0 } }
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  })

  const {
    data: historyResult,
    isLoading: isHistoryLoading,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ["approval-history", filterValues, historyPage],
    queryFn: async () => {
      const response = await approvalApi.getHistory({
        page: historyPage,
        limit,
        search: filterValues.search,
        customer_name: filterValues.partyName === "all" ? undefined : filterValues.partyName,
        start_date: filterValues.startDate,
        end_date: filterValues.endDate,
      })
      return response.success ? response.data : { orders: [], pagination: { total: 0 } }
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    if (activeTab === "pending") refetchPending()
    if (activeTab === "history") refetchHistory()
  }, [activeTab])

  const currentOrders: any[] = activeTab === "pending" ? (pendingResult?.orders || []) : (historyResult?.orders || [])
  const isLoading = activeTab === "pending" ? isPendingLoading : isHistoryLoading

  // Distinct values per column
  const distinctValuesByColumn = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const col of PAGE_COLUMNS) {
      map[col.id] = Array.from(new Set(currentOrders.map((r) => String(r[col.id] ?? "")))).sort()
    }
    return map
  }, [currentOrders])

  const getSortValue = (row: any, field: string, type: string) => {
    const v = row[field]
    if (v === null || v === undefined || v === "") return type === "number" ? -Infinity : ""
    if (type === "number") return Number(v) || 0
    if (type === "date") return new Date(v).getTime() || 0
    return String(v).toLowerCase()
  }

  const displayRows = useMemo(() => {
    let out = currentOrders
    for (const col of PAGE_COLUMNS) {
      const search = columnSearch[col.id]
      if (search && search.trim()) {
        const needle = search.toLowerCase()
        out = out.filter((r) => String(r[col.id] ?? "").toLowerCase().includes(needle))
      }
      const filterVals = columnFilterValues[col.id]
      if (filterVals) {
        out = out.filter((r) => filterVals.includes(String(r[col.id] ?? "")))
      }
    }
    if (sort?.field) {
      const col = PAGE_COLUMNS.find((c) => c.id === sort.field)
      const type = col?.type || "text"
      out = [...out].sort((a, b) => {
        const av = getSortValue(a, sort.field, type)
        const bv = getSortValue(b, sort.field, type)
        if (typeof av === "number" && typeof bv === "number") return sort.dir === "asc" ? av - bv : bv - av
        const as = String(av), bs = String(bv)
        if (as < bs) return sort.dir === "asc" ? -1 : 1
        if (as > bs) return sort.dir === "asc" ? 1 : -1
        return 0
      })
    }
    return out
  }, [currentOrders, columnSearch, columnFilterValues, sort])

  const totals = useMemo(() => {
    const t: Record<string, number> = {}
    for (const id of TOTAL_COLUMN_IDS) t[id] = displayRows.reduce((s, r) => s + (Number(r[id]) || 0), 0)
    return t
  }, [displayRows])

  const currentPage = activeTab === "pending" ? pendingPage : historyPage;
  const currentPagination = activeTab === "pending" ? pendingResult?.pagination : historyResult?.pagination;
  const setPage = activeTab === "pending" ? setPendingPage : setHistoryPage;

  const tableContent = (
    <div className="space-y-4">
      <div className="flex justify-end">
        {(isAdmin || isFeatureEnabled("can_toggle_columns")) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full bg-transparent sm:w-auto">
                <Settings2 className="mr-2 h-4 w-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[250px]" collisionPadding={16}>
              <ColumnToggleContent 
                columns={availableCols.filter(c => !c.historyOnly)} 
                visibleColumns={visibleColumns} 
                setVisibleColumns={setVisibleColumns} 
              />
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <Card className="overflow-hidden border-none shadow-sm md:max-h-150 md:overflow-auto">
        <Table className="hidden md:table">
          <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
            <TableRow>
              <ColumnDragProvider
                columnIds={orderedVisibleCols.map((c) => c.id)}
                onReorder={handleColumnReorder}
                disabled={!isAdmin && !isFeatureEnabled("can_reorder_columns")}
              >
                {orderedVisibleCols.map((col) => (
                  <SortableTableHead
                    key={col.id}
                    id={col.id}
                    className="whitespace-nowrap text-center cursor-pointer select-none hover:text-blue-600 transition-colors"
                    onClick={() => handleSort(col.id)}
                  >
                    {col.label}
                    <SortIcon field={col.id} />
                    <ColumnFilterPopover
                      columnLabel={col.label}
                      values={distinctValuesByColumn[col.id] || []}
                      searchValue={columnSearch[col.id] || ""}
                      onSearchChange={(v) => setColumnSearch((prev) => ({ ...prev, [col.id]: v }))}
                      selectedValues={columnFilterValues[col.id] ?? null}
                      onSelectedValuesChange={(v) => setColumnFilterValues((prev) => ({ ...prev, [col.id]: v }))}
                    />
                  </SortableTableHead>
                ))}
              </ColumnDragProvider>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && currentOrders.length === 0 ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i} className="border-b border-slate-50 opacity-40">
                  {orderedVisibleCols.map((col) => (
                    <TableCell key={col.id} className="py-4">
                      <div className="mx-auto h-3 w-16 animate-pulse rounded-full bg-slate-200" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : displayRows.length > 0 ? (
              displayRows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer transition-colors hover:bg-blue-50/50"
                  onClick={() => setSelectedOrderId(row.id)}
                >
                  {orderedVisibleCols.map((col) => (
                    <TableCell
                      key={col.id}
                      className={cn(
                        "whitespace-nowrap text-center text-xs",
                        col.id === "order_no" ? "font-bold text-blue-700" : "text-slate-600"
                      )}
                      title={col.id === "remarks" ? row.remarks || undefined : undefined}
                    >
                      {col.id === "remarks" && row.remarks ? (
                        <span className="inline-block max-w-[160px] truncate align-middle">{row.remarks}</span>
                      ) : (
                        formatCell(col.id, row[col.id])
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={orderedVisibleCols.length || 1} className="py-8 text-center text-muted-foreground">
                  No orders {activeTab === "pending" ? "pending approval" : "in history"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          {displayRows.length > 0 && (
            <TableFooter className="sticky bottom-0 z-10 bg-slate-50 shadow-[0_-1px_0_0_theme(colors.slate.200)]">
              <TableRow className="hover:bg-transparent">
                {orderedVisibleCols.map((col, idx) => (
                  <TableCell key={col.id} className="whitespace-nowrap text-center text-xs font-black text-slate-700">
                    {idx === 0 ? "Total" : TOTAL_COLUMN_IDS.has(col.id) ? formatCell(col.id, totals[col.id]) : ""}
                  </TableCell>
                ))}
              </TableRow>
            </TableFooter>
          )}
        </Table>

        <div className="space-y-3 p-3 md:hidden">
          {isLoading && currentOrders.length === 0 ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="space-y-3 rounded-lg border p-4 opacity-60">
                <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
                <div className="grid grid-cols-2 gap-3">
                  {[...Array(6)].map((__, j) => <div key={j} className="h-10 animate-pulse rounded bg-slate-100" />)}
                </div>
              </div>
            ))
          ) : displayRows.length > 0 ? (
            displayRows.map((row) => (
              <div
                key={row.id}
                onClick={() => setSelectedOrderId(row.id)}
                className="cursor-pointer rounded-lg border bg-white p-4 shadow-sm active:bg-blue-50/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-all font-mono text-sm font-black text-blue-700">{row.order_no}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{fmtDate(row.party_so_date)}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-black uppercase tracking-tighter text-slate-700">
                    {row.item_count} Items
                  </Badge>
                </div>
                <div className="mt-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Customer Name</p>
                  <p className="break-words text-sm font-bold text-slate-900">{row.customer_name || "—"}</p>
                </div>
                {activeTab === "history" && (
                   <div className="mt-3">
                     {formatCell("status", row.status)}
                   </div>
                )}
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-md bg-slate-50 p-2">
                    <p className="text-[10px] font-black uppercase text-slate-400">Qty (Box)</p>
                    <p className="mt-1 font-mono font-bold">{fmtNumber(row.total_qty_box)}</p>
                  </div>
                  <div className="rounded-md bg-slate-50 p-2">
                    <p className="text-[10px] font-black uppercase text-slate-400">Qty (KGS)</p>
                    <p className="mt-1 font-mono font-bold">{fmtNumber(row.total_qty_kg)}</p>
                  </div>
                  <div className="rounded-md bg-slate-50 p-2">
                    <p className="text-[10px] font-black uppercase text-slate-400">Total Amount</p>
                    <p className="mt-1 font-mono font-bold">{fmtMoney(row.total_order_amount)}</p>
                  </div>
                  <div className="rounded-md bg-slate-50 p-2">
                    <p className="text-[10px] font-black uppercase text-slate-400">Broker</p>
                    <p className="mt-1 font-semibold break-words">{row.broker_name || "—"}</p>
                  </div>
                </div>
                {row.remarks && (
                  <div className="mt-3 rounded-md bg-amber-50 p-3 text-xs">
                    <span className="font-black text-amber-800">Remarks:</span> {row.remarks}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="py-10 text-center text-muted-foreground">No orders {activeTab === "pending" ? "pending approval" : "in history"}</div>
          )}
        </div>
      </Card>

      <div className="mt-4 flex w-full flex-col gap-3 rounded-2xl border border-blue-50 bg-white/50 p-4 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="rounded-full border border-slate-200/50 bg-slate-100/50 px-4 py-2 text-xs font-bold text-slate-500">
          Page <span className="px-1 text-blue-600">{currentPage}</span> of <span className="px-1 text-blue-600">{currentPagination?.totalPages || 1}</span>
          <span className="mx-2 text-slate-300">|</span>
          Total <span className="px-1 text-blue-600">{currentPagination?.total || 0}</span> Orders
        </div>
        <div className="grid grid-cols-2 gap-3 sm:flex">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1 || isLoading}
            className="h-9 rounded-xl border-slate-200 transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 active:scale-95 disabled:opacity-30"
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={currentPage >= (currentPagination?.totalPages || 1) || isLoading}
            className="h-9 rounded-xl border-slate-200 text-xs font-bold transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 active:scale-95 disabled:opacity-30"
          >
            Next <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )

  return (
    <WorkflowStageShell
      title="Stage 3: Approval Of Order"
      description="Review each order and Approve, Reject, or request Modification, with full invoice-style detail."
      pendingCount={pendingResult?.pagination?.total || 0}
      historyData={[]}
      partyNames={filterOptions.customerNames}
      onFilterChange={setFilterValues}
      onTabChange={setActiveTab}
      showDateFilters={false}
      historyContent={tableContent}
    >
      {tableContent}

      <ApprovalDetailDialog
        orderId={selectedOrderId}
        open={selectedOrderId !== null}
        onOpenChange={(v) => !v && setSelectedOrderId(null)}
        onSubmitted={() => {
          refetchPending()
          refetchHistory()
        }}
      />
    </WorkflowStageShell>
  )
}
