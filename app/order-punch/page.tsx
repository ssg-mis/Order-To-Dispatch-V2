"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { OrderPunchForm } from "@/components/order-punch/order-punch-form"
import { OrderPunchDetailModal } from "@/components/order-punch/order-punch-detail-modal"
import { ModifyOrderDialog } from "@/components/order-punch/modify-order-dialog"
import { Plus, RefreshCw, Pencil, CheckCircle2, Calendar as CalendarIconLucide } from "lucide-react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { orderApi } from "@/lib/api-service"
import { usePersistedColumns } from "@/hooks/use-persisted-columns"
import { useColumnOrder } from "@/hooks/use-column-order"
import { ColumnDragProvider } from "@/components/ui/column-drag-provider"
import { cn } from "@/lib/utils"
import { fmtNum, fmtDate, fmtDateTime } from "@/lib/table-format"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { StageTableHeaderRows } from "@/components/stage-table-header-rows"
import { SortableTableHead } from "@/components/ui/sortable-table-head"
import { usePersistedFilters } from "@/hooks/use-persisted-filters"
import { useStageTable, type StageColDef } from "@/hooks/use-stage-table"
import {
  StageListHeader,
  StageToolbar,
  StageFilterSelect,
  StageColumnsMenu,
  StageDivider,
  StageActiveChips,
  StageSortIcon,
} from "@/components/stage-list"

const STAGE_KEY = "order-punch"

type ColType = "text" | "number" | "date" | "datetime"

const PAGE_COLUMNS: { id: string; label: string; type: ColType; width: string }[] = [
  { id: "do_date", label: "DO Date", type: "date", width: "w-[120px]" },
  { id: "order_no", label: "DO No.", type: "text", width: "w-[140px]" },
  { id: "manual_sauda_no", label: "Manual Sauda No.", type: "text", width: "w-[150px]" },
  { id: "customer_name", label: "Customer Name", type: "text", width: "w-[220px]" },
  { id: "total_qty_box", label: "Total Qty (Box)", type: "number", width: "w-[130px]" },
  { id: "total_qty_kgs", label: "Total Qty (KGS)", type: "number", width: "w-[130px]" },
  { id: "total_order_amount", label: "Total Order Amount (₹)", type: "number", width: "w-[160px]" },
  { id: "depot_name", label: "Dispatch From (Depot)", type: "text", width: "w-[170px]" },
  { id: "remarks", label: "Remarks", type: "text", width: "w-[200px]" },
  { id: "broker_name", label: "Broker", type: "text", width: "w-[130px]" },
  { id: "order_punch_by", label: "Order Punch By (User)", type: "text", width: "w-[190px]" },
  { id: "actual_datetime", label: "Actual Datetime", type: "datetime", width: "w-[170px]" },
]
const DEFAULT_COLUMN_IDS = PAGE_COLUMNS.map((c) => c.id)
const NUMBER_COLS = new Set(["total_qty_box", "total_qty_kgs", "total_order_amount"])
const PAGE_COL_WIDTH: Record<string, string> = Object.fromEntries(PAGE_COLUMNS.map((c) => [c.id, c.width]))

const STAGE_COLS: StageColDef<any>[] = PAGE_COLUMNS.map((c) => ({
  id: c.id,
  label: c.label,
  type: c.type === "number" ? "number" : c.type === "text" ? "text" : "date",
  accessor: (r: any) => r[c.id],
  total: NUMBER_COLS.has(c.id),
}))
const TOTAL_TONES: Record<string, string> = { total_qty_box: "emerald", total_qty_kgs: "blue", total_order_amount: "purple" }
const MODIFY_COL: StageColDef<any> = { id: "__modify", label: "Modify", type: "text", noFilter: true, noSort: true }
const COL_CLASS: Record<string, string> = { ...PAGE_COL_WIDTH, __modify: "w-16" }
const TOTAL_DECIMALS: Record<string, number> = { total_qty_box: 0, total_qty_kgs: 3, total_order_amount: 2 }
// Numeric and date columns are right aligned; everything else left.
const RIGHT_ALIGN_COLS = new Set(["total_qty_box", "total_qty_kgs", "total_order_amount", "do_date", "actual_datetime"])

export default function OrderPunchListPage() {
  const { toast } = useToast()
  const { isReadOnly, isAdmin, isFeatureEnabled } = useAuth()
  const router = useRouter()

  const [rows, setRows] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  // Session-scoped (survive refresh, cleared on a new session): search, DO date, customer and
  // depot narrow data, so none are permanent (no layout keys here).
  const [listView, patchListView] = usePersistedFilters(STAGE_KEY, {
    searchQuery: "",
    doDateFilter: "",
    depotFilter: "ALL",
    customerFilter: "ALL",
  }, { permanentKeys: [] })
  const { searchQuery, doDateFilter, depotFilter, customerFilter } = listView
  const setSearchQuery = (v: string) => patchListView({ searchQuery: v })
  const setDoDateFilter = (v: string) => patchListView({ doDateFilter: v })
  const setDepotFilter = (v: string) => patchListView({ depotFilter: v })
  const setCustomerFilter = (v: string) => patchListView({ customerFilter: v })
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [modifyOrder, setModifyOrder] = useState<any>(null)
  const [loadingModifyId, setLoadingModifyId] = useState<number | null>(null)
  const [viewOrderId, setViewOrderId] = useState<number | null>(null)

  const loadList = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await orderApi.getPunchList({
        search: searchQuery || undefined,
        do_date: doDateFilter || undefined,
      })
      if (res.success) setRows(res.data?.orders || [])
    } catch {
      toast({ title: "Error", description: "Failed to load the Order Punch list.", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }, [searchQuery, doDateFilter, toast])

  useEffect(() => { loadList() }, [loadList])

  const uniqueDepots = useMemo(() => {
    const set = new Set<string>()
    rows.forEach((r) => { if (r.depot_name) set.add(r.depot_name) })
    return Array.from(set).sort()
  }, [rows])

  const uniqueCustomers = useMemo(() => {
    const set = new Set<string>()
    rows.forEach((r) => { if (r.customer_name) set.add(r.customer_name) })
    return Array.from(set).sort()
  }, [rows])

  const baseFilter = useCallback(
    (r: any) => {
      if (depotFilter !== "ALL" && r.depot_name !== depotFilter) return false
      if (customerFilter !== "ALL" && r.customer_name !== customerFilter) return false
      if (searchQuery) {
        const sq = searchQuery.toLowerCase()
        const matches = (r.order_no && String(r.order_no).toLowerCase().includes(sq)) ||
                        (r.manual_sauda_no && String(r.manual_sauda_no).toLowerCase().includes(sq)) ||
                        (r.customer_name && String(r.customer_name).toLowerCase().includes(sq))
        if (!matches) return false
      }
      return true
    },
    [depotFilter, customerFilter, searchQuery]
  )

  const table = useStageTable<any>({ rows, columns: STAGE_COLS, baseFilter, defaultSort: { field: "do_date", dir: "desc" }, persistKey: STAGE_KEY })
  const sortedRows = table.rows

  const [visibleColumns, setVisibleColumns] = usePersistedColumns(STAGE_KEY, DEFAULT_COLUMN_IDS)
  const [columnOrder, setColumnOrder] = useColumnOrder(STAGE_KEY, DEFAULT_COLUMN_IDS)
  const orderedVisibleCols = useMemo(
    () =>
      columnOrder
        .map((id) => PAGE_COLUMNS.find((c) => c.id === id))
        .filter((c): c is typeof PAGE_COLUMNS[number] => !!c && visibleColumns.includes(c.id)),
    [columnOrder, visibleColumns]
  )
  const handleColumnReorder = useCallback(
    (newVisibleOrder: string[]) => {
      const hiddenCols = columnOrder.filter((id) => !visibleColumns.includes(id))
      setColumnOrder([...newVisibleOrder, ...hiddenCols])
    },
    [columnOrder, visibleColumns, setColumnOrder]
  )

  const renderCell = (row: any, colId: string) => {
    const widthClass = PAGE_COL_WIDTH[colId] || ""
    const alignClass = cn("px-4", widthClass, RIGHT_ALIGN_COLS.has(colId) && "text-right whitespace-nowrap", NUMBER_COLS.has(colId) && "font-mono tabular-nums")
    switch (colId) {
      case "do_date":
        return <TableCell key={colId} className={alignClass}>{fmtDate(row.do_date)}</TableCell>
      case "order_no":
        return <TableCell key={colId} className={cn("font-mono font-semibold text-blue-700 whitespace-nowrap", alignClass)}>{row.order_no}</TableCell>
      case "manual_sauda_no":
        return <TableCell key={colId} className={cn("truncate", alignClass)}>{row.manual_sauda_no || "—"}</TableCell>
      case "customer_name":
        return <TableCell key={colId} className={cn("font-medium truncate", alignClass)} title={row.customer_name || ""}>{row.customer_name || "—"}</TableCell>
      case "total_qty_box":
        return <TableCell key={colId} className={alignClass}>{fmtNum(row.total_qty_box, 0)}</TableCell>
      case "total_qty_kgs":
        return <TableCell key={colId} className={alignClass}>{fmtNum(row.total_qty_kgs, 3)}</TableCell>
      case "total_order_amount":
        return <TableCell key={colId} className={alignClass}>{fmtNum(row.total_order_amount, 2)}</TableCell>
      case "depot_name":
        return <TableCell key={colId} className={cn("truncate", alignClass)}>{row.depot_name || "—"}</TableCell>
      case "remarks":
        return <TableCell key={colId} className={cn("truncate", alignClass)} title={row.remarks || ""}>{row.remarks || "—"}</TableCell>
      case "broker_name":
        return <TableCell key={colId} className={cn("truncate", alignClass)}>{row.broker_name || "—"}</TableCell>
      case "order_punch_by":
        return <TableCell key={colId} className={cn("truncate", alignClass)}>{row.order_punch_by || "—"}</TableCell>
      case "actual_datetime":
        return <TableCell key={colId} className={cn("whitespace-nowrap", alignClass)}>{fmtDateTime(row.actual_datetime)}</TableCell>
      default:
        return null
    }
  }

  const activeFiltersCount = (searchQuery ? 1 : 0) + (doDateFilter ? 1 : 0) + (depotFilter !== "ALL" ? 1 : 0) + (customerFilter !== "ALL" ? 1 : 0) + table.activeColumnFilterCount
  const clearAllFilters = () => {
    patchListView({ searchQuery: "", doDateFilter: "", depotFilter: "ALL", customerFilter: "ALL" })
    table.clearColumnFilters()
  }

  return (
    <div className="p-3 sm:px-6 sm:py-3 max-w-full space-y-2 sm:space-y-3" suppressHydrationWarning>
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div className="flex items-start gap-3 min-w-0">
          <SidebarTrigger className="-ml-1" />
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Stage 1: Order Punch</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Delivery Order (DO) details punched into the system.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <Button variant="outline" size="sm" onClick={loadList} disabled={isLoading} title="Refresh" aria-label="Refresh" className="w-full sm:w-9 sm:px-0">
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            <span className="sm:hidden ml-1">Refresh</span>
          </Button>
          {!isReadOnly && (
            <Button
              className="w-full gap-2 bg-blue-600 hover:bg-blue-700 sm:w-auto"
              onClick={() => setIsAddOpen(true)}
            >
              <Plus className="h-4 w-4" />
              <span className="truncate">Add Order</span>
            </Button>
          )}
        </div>
      </div>

      {/* ── DO List Table ── */}
      <Card className="border border-slate-200/80 shadow-xs overflow-hidden py-0 gap-0 stage-card">
        <StageListHeader
          title="Order Punch List"
          shown={sortedRows.length}
          total={rows.length}
          description="Orders disappear 48 hours after their Stage 3 Approval/Rejection decision."
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search DO No., Customer, Manual Sauda No..."
        >
          <StageToolbar
            shown={sortedRows.length}
            total={rows.length}
            activeCount={activeFiltersCount}
            onReset={clearAllFilters}
            filters={
              <>
                <Input
                  type="date"
                  value={doDateFilter}
                  onChange={(e) => setDoDateFilter(e.target.value)}
                  className="!h-8 py-0 px-2.5 text-xs md:text-xs w-[150px] bg-white border-slate-200 shadow-2xs"
                />
                <StageDivider />
                <StageFilterSelect value={depotFilter} onChange={setDepotFilter} allLabel="All Depots" options={uniqueDepots} />
                <StageFilterSelect value={customerFilter} onChange={setCustomerFilter} allLabel="All Customers" options={uniqueCustomers} />
                <StageColumnsMenu
                  columns={PAGE_COLUMNS}
                  visibleColumns={visibleColumns}
                  setVisibleColumns={setVisibleColumns}
                  show={isAdmin || isFeatureEnabled("can_toggle_columns")}
                />
              </>
            }
          />
          <StageActiveChips
            chips={[
              ...(doDateFilter ? [{ label: `DO Date: ${doDateFilter}`, onClear: () => setDoDateFilter("") }] : []),
              ...(depotFilter !== "ALL" ? [{ label: `Depot: ${depotFilter}`, onClear: () => setDepotFilter("ALL") }] : []),
              ...(customerFilter !== "ALL" ? [{ label: `Customer: ${customerFilter}`, onClear: () => setCustomerFilter("ALL") }] : []),
              ...(searchQuery ? [{ label: `Search: ${searchQuery}`, onClear: () => setSearchQuery("") }] : []),
            ]}
          />
        </StageListHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto rounded-b-xl">
            <Table className="table-auto">
              <StageTableHeaderRows
                columns={orderedVisibleCols.map((c) => STAGE_COLS.find((s) => s.id === c.id)!)}
                trailingColumns={[MODIFY_COL]}
                table={table}
                decimals={TOTAL_DECIMALS}
                tones={TOTAL_TONES}
                colClassName={COL_CLASS}
                onReorder={handleColumnReorder}
                dragDisabled={!isAdmin && !isFeatureEnabled("can_reorder_columns")}
              />
              <TableBody>
                {isLoading ? (
                  [...Array(4)].map((_, i) => (
                    <TableRow key={i} className="opacity-40">
                      {[...Array(orderedVisibleCols.length + 1)].map((__, j) => (
                        <TableCell key={j} className="px-4"><div className="h-4 w-full bg-slate-200 animate-pulse rounded" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={orderedVisibleCols.length + 1} className="text-center py-16 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <CheckCircle2 className="h-10 w-10 text-slate-300" />
                        <p className="font-medium">No orders to show</p>
                        <p className="text-sm text-slate-400">Click "Add Order" to punch a new one.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : sortedRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={orderedVisibleCols.length + 1} className="text-center py-12 text-muted-foreground">
                      <p className="font-medium text-slate-500">No matching records found for the current filters</p>
                      <button onClick={clearAllFilters} className="text-xs text-blue-600 hover:underline mt-1 font-semibold">
                        Clear Filters
                      </button>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedRows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => setViewOrderId(row.id)}
                    >
                      {orderedVisibleCols.map((col) => renderCell(row, col.id))}
                      <TableCell className="px-4 text-left" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "h-7 w-7 transition-colors",
                            row.stage3_status !== "Required Modification"
                              ? "text-slate-300 hover:bg-transparent cursor-not-allowed"
                              : "text-amber-500 hover:text-amber-700 hover:bg-amber-50 cursor-pointer"
                          )}
                          disabled={row.stage3_status !== "Required Modification" || isReadOnly || loadingModifyId === row.id}
                          title={
                            isReadOnly
                              ? "View Only Access"
                              : row.stage3_status !== "Required Modification"
                              ? "Order must be marked 'Required Modification' at Stage 3 to edit"
                              : "Modify order"
                          }
                          onClick={async (e) => {
                            e.stopPropagation()
                            try {
                              setLoadingModifyId(row.id)
                              const res = await orderApi.getById(row.id)
                              if (res.success && res.data) {
                                setModifyOrder(res.data)
                              } else {
                                toast({
                                  title: "Error",
                                  description: res.message || "Failed to load order details for modification.",
                                  variant: "destructive",
                                })
                              }
                            } catch (err: any) {
                              toast({
                                title: "Error",
                                description: err?.message || "Failed to load order details.",
                                variant: "destructive",
                              })
                            } finally {
                              setLoadingModifyId(null)
                            }
                          }}
                        >
                          {loadingModifyId === row.id ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin text-amber-600" />
                          ) : (
                            <Pencil className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add Order - same dialog footprint as the Plan Vehicle dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:w-[95vw] sm:!max-w-[95vw] max-h-[95dvh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Add Order</DialogTitle>
            <DialogDescription>Create a new order with customer and product details.</DialogDescription>
          </DialogHeader>
          <OrderPunchForm
            onCancel={() => setIsAddOpen(false)}
            onSuccess={() => { setIsAddOpen(false); loadList() }}
          />
        </DialogContent>
      </Dialog>

      {/* Modify Order - directly opens dialog on list page */}
      <ModifyOrderDialog
        order={modifyOrder}
        open={!!modifyOrder}
        onOpenChange={(open) => {
          if (!open) setModifyOrder(null)
        }}
        onSaved={() => {
          setModifyOrder(null)
          loadList()
        }}
      />

      <OrderPunchDetailModal orderId={viewOrderId} onClose={() => setViewOrderId(null)} />
    </div>
  )
}
