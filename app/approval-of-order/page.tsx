"use client"

import { Card, CardContent } from "@/components/ui/card"
import { WorkflowStageShell } from "@/components/workflow/workflow-stage-shell"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { approvalApi } from "@/lib/api-service"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { usePersistedColumns } from "@/hooks/use-persisted-columns"
import { useColumnOrder } from "@/hooks/use-column-order"
import { usePersistedFilters } from "@/hooks/use-persisted-filters"
import { useStageTable, type StageColDef } from "@/hooks/use-stage-table"
import {
  StageListHeader,
  StageToolbar,
  StageFilterSelect,
  StageColumnsMenu,
  StageDivider,
  StageActiveChips,
  StageHeadCell,
  StageTotalsRow,
  type StageTotalTone, StagePagination } from "@/components/stage-list"
import { ColumnDragProvider } from "@/components/ui/column-drag-provider"
import { fmtNum, fmtDate, fmtDateTime } from "@/lib/table-format"
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
  { id: "total_order_amount", label: "Total Order Amount (₹)", type: "number" as const },
  { id: "dispatch_from", label: "Dispatch from", type: "text" as const },
  { id: "status", label: "Status", type: "text" as const, historyOnly: true },
  { id: "remarks", label: "Remarks", type: "text" as const },
  { id: "broker_name", label: "Broker", type: "text" as const },
  { id: "order_punch_user", label: "Order Punch By (user)", type: "text" as const },
  { id: "order_datetime", label: "Actual Datetime", type: "date" as const },
  { id: "actual_datetime", label: "Action Date", type: "date" as const, historyOnly: true },
]
const TOTAL_COLUMN_IDS = new Set(["total_qty_box", "total_qty_kg", "total_order_amount"])
const STAGE_COLS: StageColDef<any>[] = PAGE_COLUMNS.map((c) => ({
  id: c.id,
  label: c.label,
  type: c.type,
  accessor: (r: any) => r[c.id],
  total: TOTAL_COLUMN_IDS.has(c.id),
}))
const TOTAL_TONES: Record<string, StageTotalTone> = { total_qty_box: "emerald", total_qty_kg: "blue", total_order_amount: "purple" }
const RIGHT_ALIGN_COLS = new Set(["total_qty_box", "total_qty_kg", "total_order_amount", "party_so_date", "order_datetime", "actual_datetime"])
const NUMBER_ALIGN: Record<string, "right"> = Object.fromEntries([...RIGHT_ALIGN_COLS].map((id) => [id, "right" as const]))
const DECIMALS: Record<string, number> = { total_qty_box: 0, total_qty_kg: 3, total_order_amount: 2 }

const fmtNumber = (colId: string, v: unknown) => fmtNum(v ?? 0, DECIMALS[colId] ?? 4)

function formatCell(colId: string, value: any) {
  if (colId === "order_datetime") return fmtDateTime(value)
  if (colId === "party_so_date" || colId === "actual_datetime") return fmtDate(value)
  if (colId === "total_order_amount" || colId === "total_qty_box" || colId === "total_qty_kg") return fmtNumber(colId, value)
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
  // History status buttons are remembered permanently; quick search / customer / dispatch filters for the
  // session. The Pending/History tab is owned and remembered by WorkflowStageShell (persistKey).
  const [listView, patchListView, resetListView] = usePersistedFilters(STAGE_KEY, {
    quickSearch: "",
    customerSel: "ALL",
    dispatchSel: "ALL",
    statusSel: "ALL",
  }, { permanentKeys: ["statusSel"] })
  const { quickSearch, customerSel, dispatchSel, statusSel } = listView
  const setQuickSearch = (v: string) => patchListView({ quickSearch: v })
  const setCustomerSel = (v: string) => patchListView({ customerSel: v })
  const setDispatchSel = (v: string) => patchListView({ dispatchSel: v })
  const setStatusSel = (v: string) => patchListView({ statusSel: v })
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)

  const [visibleColumns, setVisibleColumns] = usePersistedColumns(STAGE_KEY, PAGE_COLUMNS.filter(c => !c.historyOnly).map((c) => c.id))
  const [columnOrder, setColumnOrder] = useColumnOrder(STAGE_KEY, PAGE_COLUMNS.map((c) => c.id))

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

  const uniqueOf = (key: string) => Array.from(new Set(currentOrders.map((r) => r[key]).filter(Boolean).map(String))).sort()
  const uniqueCustomers = useMemo(() => uniqueOf("customer_name"), [currentOrders])
  const uniqueDispatch = useMemo(() => uniqueOf("dispatch_from"), [currentOrders])

  const baseFilter = useCallback(
    (r: any) => {
      if (customerSel !== "ALL" && r.customer_name !== customerSel) return false
      if (dispatchSel !== "ALL" && r.dispatch_from !== dispatchSel) return false
      if (activeTab === "history" && statusSel !== "ALL" && r.status !== statusSel) return false
      if (quickSearch.trim()) {
        const q = quickSearch.toLowerCase().trim()
        const hit = [r.order_no, r.manual_sauda_no, r.customer_name, r.broker_name].some((v) => v && String(v).toLowerCase().includes(q))
        if (!hit) return false
      }
      return true
    },
    [customerSel, dispatchSel, statusSel, quickSearch, activeTab]
  )

  const table = useStageTable<any>({ rows: currentOrders, columns: STAGE_COLS, baseFilter, defaultSort: { field: "party_so_date", dir: "desc" }, persistKey: STAGE_KEY })
  const displayRows = table.rows
  // history-only column filters would silently hide rows on the other tab
  const tabMountedRef = useRef(false)
  useEffect(() => {
    // skip the initial mount so persisted column filters are not wiped on load
    if (!tabMountedRef.current) { tabMountedRef.current = true; return }
    table.clearColumnFilters()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])
  const totals = table.totals

  const activeFiltersCount =
    (quickSearch.trim() ? 1 : 0) + (customerSel !== "ALL" ? 1 : 0) + (dispatchSel !== "ALL" ? 1 : 0) + (activeTab === "history" && statusSel !== "ALL" ? 1 : 0) + table.activeColumnFilterCount
  const clearAllFilters = () => {
    resetListView()
    table.clearColumnFilters()
  }
  const stageColsFor = (cols: { id: string }[]) => cols.map((c) => STAGE_COLS.find((x) => x.id === c.id)!)

  const currentPage = activeTab === "pending" ? pendingPage : historyPage;
  const currentPagination = activeTab === "pending" ? pendingResult?.pagination : historyResult?.pagination;
  const setPage = activeTab === "pending" ? setPendingPage : setHistoryPage;

  const tableContent = (
    <div className="space-y-4">
      <Card className="border border-slate-200/80 shadow-xs overflow-hidden py-0 gap-0 stage-card">
        <StageListHeader
          title={activeTab === "pending" ? "Approval List" : "Approval History"}
          shown={displayRows.length}
          total={currentOrders.length}
          description={activeTab === "pending" ? "Orders awaiting approval, rejection or modification" : "Orders already actioned at this stage"}
          searchValue={quickSearch}
          onSearchChange={setQuickSearch}
          searchPlaceholder="Search DO No., Customer, Sauda No..."
        >
          <StageToolbar
            shown={displayRows.length}
            total={currentOrders.length}
            activeCount={activeFiltersCount}
            onReset={clearAllFilters}
            filters={
              <>
                {activeTab === "history" && (
                  <>
                    <StageFilterSelect value={statusSel} onChange={setStatusSel} allLabel="All Status" options={["Approved", "Rejected", "Required Modification"]} />
                    <StageDivider />
                  </>
                )}
                <StageFilterSelect value={customerSel} onChange={setCustomerSel} allLabel="All Customers" options={uniqueCustomers} />
                <StageFilterSelect value={dispatchSel} onChange={setDispatchSel} allLabel="All Dispatch From" options={uniqueDispatch} />
                <StageColumnsMenu
                  columns={availableCols.filter((c) => !c.historyOnly)}
                  visibleColumns={visibleColumns}
                  setVisibleColumns={setVisibleColumns}
                  show={isAdmin || isFeatureEnabled("can_toggle_columns")}
                />
              </>
            }
          />
          <StageActiveChips
            chips={[
              ...(activeTab === "history" && statusSel !== "ALL" ? [{ label: `Status: ${statusSel}`, onClear: () => setStatusSel("ALL") }] : []),
              ...(customerSel !== "ALL" ? [{ label: `Customer: ${customerSel}`, onClear: () => setCustomerSel("ALL") }] : []),
              ...(dispatchSel !== "ALL" ? [{ label: `Dispatch: ${dispatchSel}`, onClear: () => setDispatchSel("ALL") }] : []),
              ...(quickSearch.trim() ? [{ label: `Search: ${quickSearch}`, onClear: () => setQuickSearch("") }] : []),
            ]}
          />
        </StageListHeader>
        <CardContent className="p-0">
        <div className="hidden overflow-x-auto rounded-b-xl md:block">
        <Table>
          <TableHeader className="bg-slate-50 border-b">
            <TableRow>
              <ColumnDragProvider
                columnIds={orderedVisibleCols.map((c) => c.id)}
                onReorder={handleColumnReorder}
                disabled={!isAdmin && !isFeatureEnabled("can_reorder_columns")}
              >
                {orderedVisibleCols.map((col) => (
                  <StageHeadCell
                    key={col.id}
                    col={STAGE_COLS.find((c) => c.id === col.id)!}
                    table={table}
                    width="min-w-[120px]"
                    align={RIGHT_ALIGN_COLS.has(col.id) ? "right" : "left"}
                  />
                ))}
              </ColumnDragProvider>
            </TableRow>
          </TableHeader>
          <TableBody>
            <StageTotalsRow
              columns={stageColsFor(orderedVisibleCols)}
              totals={totals}
              count={displayRows.length}
              format={(n, id) => fmtNumber(id, n)}
              tones={TOTAL_TONES}
              align={NUMBER_ALIGN}
            />
            {isLoading && currentOrders.length === 0 ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i} className="border-b border-slate-50 opacity-40">
                  {orderedVisibleCols.map((col) => (
                    <TableCell key={col.id} className="px-4 py-4">
                      <div className="h-3 w-16 animate-pulse rounded-full bg-slate-200" />
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
                        "whitespace-nowrap px-4 text-xs",
                        TOTAL_COLUMN_IDS.has(col.id) && "text-right font-mono tabular-nums",
                        !TOTAL_COLUMN_IDS.has(col.id) && RIGHT_ALIGN_COLS.has(col.id) && "text-right tabular-nums",
                        col.id === "order_no" ? "font-bold text-blue-700" : "text-foreground"
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
                  {currentOrders.length > 0 ? (
                    <>
                      <p className="font-medium text-slate-500">No matching records found for the current filters</p>
                      <button onClick={clearAllFilters} className="text-xs text-blue-600 hover:underline mt-1 font-semibold">
                        Clear Filters
                      </button>
                    </>
                  ) : (
                    <>No orders {activeTab === "pending" ? "pending approval" : "in history"}</>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>

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
                    <p className="mt-1 font-mono font-bold">{fmtNumber("total_qty_box", row.total_qty_box)}</p>
                  </div>
                  <div className="rounded-md bg-slate-50 p-2">
                    <p className="text-[10px] font-black uppercase text-slate-400">Qty (KGS)</p>
                    <p className="mt-1 font-mono font-bold">{fmtNumber("total_qty_kg", row.total_qty_kg)}</p>
                  </div>
                  <div className="rounded-md bg-slate-50 p-2">
                    <p className="text-[10px] font-black uppercase text-slate-400">Total Amount (₹)</p>
                    <p className="mt-1 font-mono font-bold">{fmtNumber("total_order_amount", row.total_order_amount)}</p>
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
            <div className="py-10 text-center text-muted-foreground">
              {currentOrders.length > 0 ? (
                <>
                  <p className="font-medium text-slate-500">No matching records found for the current filters</p>
                  <button onClick={clearAllFilters} className="text-xs text-blue-600 hover:underline mt-1 font-semibold">
                    Clear Filters
                  </button>
                </>
              ) : (
                <>No orders {activeTab === "pending" ? "pending approval" : "in history"}</>
              )}
            </div>
          )}
        </div>
        </CardContent>
      </Card>

      <StagePagination
        page={currentPage}
        totalPages={currentPagination?.totalPages || 1}
        total={currentPagination?.total || 0}
        noun="Orders"
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => p + 1)}
        prevDisabled={currentPage === 1 || isLoading}
        nextDisabled={currentPage >= (currentPagination?.totalPages || 1) || isLoading}
      />
    </div>
  )

  return (
    <WorkflowStageShell
      persistKey={STAGE_KEY}
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
