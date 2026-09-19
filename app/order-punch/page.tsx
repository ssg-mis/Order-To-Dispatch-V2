"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { OrderPunchForm } from "@/components/order-punch/order-punch-form"
import { OrderPunchDetailModal } from "@/components/order-punch/order-punch-detail-modal"
import { ModifyOrderDialog } from "@/components/order-punch/modify-order-dialog"
import { Plus, RefreshCw, Search, X, Settings2, Pencil, CheckCircle2 } from "lucide-react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { orderApi } from "@/lib/api-service"
import { usePersistedColumns } from "@/hooks/use-persisted-columns"
import { useColumnOrder } from "@/hooks/use-column-order"
import { usePersistedSort } from "@/hooks/use-persisted-sort"
import { ColumnDragProvider } from "@/components/ui/column-drag-provider"
import { SortableTableHead } from "@/components/ui/sortable-table-head"
import { ColumnToggleContent } from "@/components/ui/column-toggle-content"
import { cn } from "@/lib/utils"
import { formatDate, formatDateTime, formatAmount, formatNumber } from "@/lib/order-punch-format"

const STAGE_KEY = "order-punch"

type ColType = "text" | "number" | "date" | "datetime"

const PAGE_COLUMNS: { id: string; label: string; type: ColType; width: string }[] = [
  { id: "do_date", label: "DO Date", type: "date", width: "w-[120px]" },
  { id: "order_no", label: "DO No.", type: "text", width: "w-[140px]" },
  { id: "manual_sauda_no", label: "Manual Sauda No.", type: "text", width: "w-[150px]" },
  { id: "customer_name", label: "Customer Name", type: "text", width: "w-[220px]" },
  { id: "total_qty_box", label: "Total Qty (Box)", type: "number", width: "w-[130px]" },
  { id: "total_qty_kgs", label: "Total Qty (KGS)", type: "number", width: "w-[130px]" },
  { id: "total_order_amount", label: "Total Order Amount", type: "number", width: "w-[160px]" },
  { id: "depot_name", label: "Dispatch From", type: "text", width: "w-[130px]" },
  { id: "remarks", label: "Remarks", type: "text", width: "w-[200px]" },
  { id: "broker_name", label: "Broker", type: "text", width: "w-[130px]" },
  { id: "order_punch_by", label: "Order Punch By (User)", type: "text", width: "w-[190px]" },
  { id: "actual_datetime", label: "Actual Datetime", type: "datetime", width: "w-[170px]" },
]
const DEFAULT_COLUMN_IDS = PAGE_COLUMNS.map((c) => c.id)
const NUMBER_COLS = new Set(["total_qty_box", "total_qty_kgs", "total_order_amount"])
const PAGE_COL_WIDTH: Record<string, string> = Object.fromEntries(PAGE_COLUMNS.map((c) => [c.id, c.width]))

function compareValues(a: any, b: any, type: ColType): number {
  if (type === "date" || type === "datetime") {
    const at = a ? new Date(a).getTime() : -Infinity
    const bt = b ? new Date(b).getTime() : -Infinity
    return at - bt
  }
  if (type === "number") {
    return (Number(a) || 0) - (Number(b) || 0)
  }
  return String(a ?? "").localeCompare(String(b ?? ""), undefined, { sensitivity: "base" })
}

export default function OrderPunchListPage() {
  const { toast } = useToast()
  const { isReadOnly, isAdmin, isFeatureEnabled } = useAuth()
  const router = useRouter()

  const [rows, setRows] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [doDateFilter, setDoDateFilter] = useState("")
  const [depotFilter, setDepotFilter] = useState("ALL")
  const [customerFilter, setCustomerFilter] = useState("ALL")
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

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (depotFilter !== "ALL" && r.depot_name !== depotFilter) return false
      if (customerFilter !== "ALL" && r.customer_name !== customerFilter) return false
      return true
    })
  }, [rows, depotFilter, customerFilter])

  const [sort, setSort] = usePersistedSort(STAGE_KEY, { field: "do_date", dir: "desc" })
  const handleSort = (field: string) => {
    if (sort?.field === field) setSort({ field, dir: sort.dir === "asc" ? "desc" : "asc" })
    else setSort({ field, dir: "asc" })
  }

  const sortedRows = useMemo(() => {
    if (!sort) return filteredRows
    const col = PAGE_COLUMNS.find((c) => c.id === sort.field)
    const type: ColType = col?.type || "text"
    return [...filteredRows].sort((a, b) => {
      const cmp = compareValues(a[sort.field], b[sort.field], type)
      return sort.dir === "asc" ? cmp : -cmp
    })
  }, [filteredRows, sort])

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
    const isNumber = NUMBER_COLS.has(colId)
    const widthClass = PAGE_COL_WIDTH[colId] || ""
    const alignClass = cn(widthClass, isNumber && "text-right font-mono")
    switch (colId) {
      case "do_date":
        return <TableCell key={colId} className={widthClass}>{formatDate(row.do_date)}</TableCell>
      case "order_no":
        return <TableCell key={colId} className={cn("font-mono font-semibold text-blue-700 whitespace-nowrap", widthClass)}>{row.order_no}</TableCell>
      case "manual_sauda_no":
        return <TableCell key={colId} className={cn("truncate", widthClass)}>{row.manual_sauda_no || "—"}</TableCell>
      case "customer_name":
        return <TableCell key={colId} className={cn("font-medium truncate", widthClass)} title={row.customer_name || ""}>{row.customer_name || "—"}</TableCell>
      case "total_qty_box":
        return <TableCell key={colId} className={alignClass}>{formatNumber(row.total_qty_box)}</TableCell>
      case "total_qty_kgs":
        return <TableCell key={colId} className={alignClass}>{formatNumber(row.total_qty_kgs)}</TableCell>
      case "total_order_amount":
        return <TableCell key={colId} className={alignClass}>{formatAmount(row.total_order_amount)}</TableCell>
      case "depot_name":
        return <TableCell key={colId} className={cn("truncate", widthClass)}>{row.depot_name || "—"}</TableCell>
      case "remarks":
        return <TableCell key={colId} className={cn("truncate", widthClass)} title={row.remarks || ""}>{row.remarks || "—"}</TableCell>
      case "broker_name":
        return <TableCell key={colId} className={cn("truncate", widthClass)}>{row.broker_name || "—"}</TableCell>
      case "order_punch_by":
        return <TableCell key={colId} className={cn("truncate", widthClass)}>{row.order_punch_by || "—"}</TableCell>
      case "actual_datetime":
        return <TableCell key={colId} className={cn("whitespace-nowrap", widthClass)}>{formatDateTime(row.actual_datetime)}</TableCell>
      default:
        return null
    }
  }

  const activeFiltersCount = (searchQuery ? 1 : 0) + (doDateFilter ? 1 : 0) + (depotFilter !== "ALL" ? 1 : 0) + (customerFilter !== "ALL" ? 1 : 0)
  const clearAllFilters = () => {
    setSearchQuery("")
    setDoDateFilter("")
    setDepotFilter("ALL")
    setCustomerFilter("ALL")
  }

  return (
    <div className="p-3 sm:p-6 max-w-full space-y-4 sm:space-y-6" suppressHydrationWarning>
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div className="flex items-start gap-3 min-w-0">
          <SidebarTrigger className="-ml-1" />
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Order Punch</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Delivery Order (DO) details punched into the system.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <Button variant="outline" size="sm" onClick={loadList} disabled={isLoading} className="w-full sm:w-auto">
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
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
      <Card className="border border-slate-200/80 shadow-xs overflow-hidden">
        <CardHeader className="p-4 sm:p-5 space-y-3 bg-white border-b border-slate-200/80">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">Order Punch List</CardTitle>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                  {sortedRows.length} of {rows.length}
                </span>
              </div>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Orders disappear 48 hours after their Stage 3 Approval/Rejection decision.
              </CardDescription>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search DO No., Customer, Manual Sauda No..."
                className="pl-9 pr-8 text-xs h-8.5 bg-slate-50/70 hover:bg-slate-50 focus:bg-white border-slate-200 rounded-lg transition-all focus-visible:ring-1 focus-visible:ring-blue-600 shadow-2xs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2.5 p-2 rounded-lg bg-slate-50/90 border border-slate-200/80 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="date"
                value={doDateFilter}
                onChange={(e) => setDoDateFilter(e.target.value)}
                className="h-8 text-xs w-[150px] bg-white border-slate-200 shadow-2xs"
              />
              <Select value={depotFilter} onValueChange={setDepotFilter}>
                <SelectTrigger className="h-8 text-xs min-w-[130px] bg-white border-slate-200 shadow-2xs">
                  <SelectValue placeholder="All Depots" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Depots</SelectItem>
                  {uniqueDepots.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={customerFilter} onValueChange={setCustomerFilter}>
                <SelectTrigger className="h-8 text-xs min-w-[150px] bg-white border-slate-200 shadow-2xs">
                  <SelectValue placeholder="All Customers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Customers</SelectItem>
                  {uniqueCustomers.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {activeFiltersCount > 0 && (
                <button onClick={clearAllFilters} className="text-blue-600 hover:underline font-semibold px-1">
                  Clear filters ({activeFiltersCount})
                </button>
              )}
            </div>

            {(isAdmin || isFeatureEnabled('can_toggle_columns')) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 bg-white">
                    <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                    Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[250px]" collisionPadding={16}>
                  <ColumnToggleContent columns={PAGE_COLUMNS} visibleColumns={visibleColumns} setVisibleColumns={setVisibleColumns} />
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto rounded-b-xl">
            <Table className="table-fixed">
              <TableHeader className="bg-slate-50 border-b">
                <TableRow>
                  <ColumnDragProvider
                    columnIds={orderedVisibleCols.map((c) => c.id)}
                    onReorder={handleColumnReorder}
                    disabled={!isAdmin && !isFeatureEnabled('can_reorder_columns')}
                  >
                    {orderedVisibleCols.map((col) => (
                      <SortableTableHead
                        key={col.id}
                        id={col.id}
                        className={cn("whitespace-nowrap", PAGE_COL_WIDTH[col.id], NUMBER_COLS.has(col.id) && "text-right")}
                      >
                        <div
                          className={cn(
                            "flex items-center gap-1 cursor-pointer select-none hover:text-blue-600 transition-colors w-full",
                            NUMBER_COLS.has(col.id) ? "justify-end" : "justify-start"
                          )}
                          onClick={() => handleSort(col.id)}
                        >
                          <span>{col.label}</span>
                          {sort?.field === col.id ? (
                            <span className="text-blue-600 text-[10px]">{sort.dir === "asc" ? "▲" : "▼"}</span>
                          ) : null}
                        </div>
                      </SortableTableHead>
                    ))}
                  </ColumnDragProvider>
                  <TableHead className="w-16 px-2 text-center">Modify</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(4)].map((_, i) => (
                    <TableRow key={i} className="opacity-40">
                      {[...Array(orderedVisibleCols.length + 1)].map((__, j) => (
                        <TableCell key={j}><div className="h-4 w-full bg-slate-200 animate-pulse rounded" /></TableCell>
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
                      <TableCell className="px-2 text-center" onClick={(e) => e.stopPropagation()}>
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

      {/* Add Order - same dialog footprint as Commitment Punch's Add Commitment dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="w-[95vw] min-h-[580px] max-h-[90vh] overflow-y-auto p-4 sm:p-6" style={{ maxWidth: '1250px' }}>
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
      <ModifyOrderDialog open={!!modifyOrder} onOpenChange={(o) => !o && setModifyOrder(null)} orderId={modifyOrder?.id} onSuccess={loadList} />
    </div>
  )
}
