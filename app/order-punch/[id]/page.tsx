"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ArrowLeft, RefreshCw, Settings2, Pencil } from "lucide-react"
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
import { ModifyOrderDialog } from "@/components/order-punch/modify-order-dialog"
import { cn } from "@/lib/utils"
import { formatDate, formatDateTime, formatAmount, formatNumber } from "@/lib/order-punch-format"

const STAGE_KEY = "order-punch-detail-items"

type ColType = "text" | "number"

const ITEM_COLUMNS: { id: string; label: string; type: ColType }[] = [
  { id: "sku_name", label: "SKU / Product", type: "text" },
  { id: "uom", label: "UOM", type: "text" },
  { id: "order_quantity", label: "Order Qty", type: "number" },
  { id: "alternate_qty_kg", label: "Qty (KG)", type: "number" },
  { id: "rate_of_material", label: "Rate", type: "number" },
  { id: "oil_type", label: "Oil Type", type: "text" },
  { id: "approval_status", label: "Approval Status", type: "text" },
]
const DEFAULT_ITEM_COLUMN_IDS = ITEM_COLUMNS.map((c) => c.id)
const NUMBER_ITEM_COLS = new Set(["order_quantity", "alternate_qty_kg", "rate_of_material"])

function compareValues(a: any, b: any, type: ColType): number {
  if (type === "number") return (Number(a) || 0) - (Number(b) || 0)
  return String(a ?? "").localeCompare(String(b ?? ""), undefined, { sensitivity: "base" })
}

function stage3Badge(status: string | null | undefined) {
  const s = status || "Pending"
  const variant =
    s === "Approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
    s === "Rejected" ? "bg-red-50 text-red-700 border-red-200" :
    s === "Required Modification" ? "bg-amber-50 text-amber-700 border-amber-200" :
    "bg-slate-50 text-slate-600 border-slate-200"
  return <Badge variant="outline" className={variant}>{s}</Badge>
}

export default function OrderPunchDetailPage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const { isReadOnly, isAdmin, isFeatureEnabled } = useAuth()
  const canSortColumns = isAdmin || isFeatureEnabled('can_sort_columns')

  const id = Number(params?.id)
  const [order, setOrder] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isModifyOpen, setIsModifyOpen] = useState(false)

  const loadDetail = useCallback(async () => {
    if (!id) return
    setIsLoading(true)
    try {
      const res = await orderApi.getById(id)
      if (res.success) setOrder(res.data)
      else toast({ title: "Not found", description: "This order could not be found.", variant: "destructive" })
    } catch {
      toast({ title: "Error", description: "Failed to load order details.", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }, [id, toast])

  useEffect(() => { loadDetail() }, [loadDetail])

  // Deep-link from the list's Modify column (?modify=1) opens the dialog
  // directly as long as order is marked Required Modification.
  useEffect(() => {
    if (order && searchParams.get("modify") === "1" && order.stage3_status === "Required Modification") {
      setIsModifyOpen(true)
    }
  }, [order, searchParams])

  const items: any[] = order?.items || []

  const [sort, setSort] = usePersistedSort(STAGE_KEY, null)
  const handleSort = (field: string) => {
    if (sort?.field === field) {
      if (sort.dir === "asc") setSort({ field, dir: "desc" })
      else setSort(null)
    } else {
      setSort({ field, dir: "asc" })
    }
  }
  const sortedItems = useMemo(() => {
    if (!sort) return items
    const col = ITEM_COLUMNS.find((c) => c.id === sort.field)
    const type: ColType = col?.type || "text"
    return [...items].sort((a, b) => {
      const cmp = compareValues(a[sort.field], b[sort.field], type)
      return sort.dir === "asc" ? cmp : -cmp
    })
  }, [items, sort])

  const [visibleColumns, setVisibleColumns] = usePersistedColumns(STAGE_KEY, DEFAULT_ITEM_COLUMN_IDS)
  const [columnOrder, setColumnOrder] = useColumnOrder(STAGE_KEY, DEFAULT_ITEM_COLUMN_IDS)
  const orderedVisibleCols = useMemo(
    () =>
      columnOrder
        .map((colId) => ITEM_COLUMNS.find((c) => c.id === colId))
        .filter((c): c is typeof ITEM_COLUMNS[number] => !!c && visibleColumns.includes(c.id)),
    [columnOrder, visibleColumns]
  )
  const handleColumnReorder = useCallback(
    (newVisibleOrder: string[]) => {
      const hiddenCols = columnOrder.filter((cid) => !visibleColumns.includes(cid))
      setColumnOrder([...newVisibleOrder, ...hiddenCols])
    },
    [columnOrder, visibleColumns, setColumnOrder]
  )

  const renderItemCell = (row: any, colId: string) => {
    const alignClass = NUMBER_ITEM_COLS.has(colId) ? "text-right font-mono tabular-nums" : ""
    switch (colId) {
      case "sku_name":
        return <TableCell key={colId} className="px-4 font-medium">{row.sku_name || "—"}</TableCell>
      case "uom":
        return <TableCell key={colId} className="px-4">{row.uom || "—"}</TableCell>
      case "order_quantity":
        return <TableCell key={colId} className={cn("px-4", alignClass)}>{formatNumber(row.order_quantity)}</TableCell>
      case "alternate_qty_kg":
        return <TableCell key={colId} className={cn("px-4", alignClass)}>{formatNumber(row.alternate_qty_kg)}</TableCell>
      case "rate_of_material":
        return <TableCell key={colId} className={cn("px-4", alignClass)}>{formatAmount(row.rate_of_material)}</TableCell>
      case "oil_type":
        return <TableCell key={colId} className="px-4">{row.oil_type || "—"}</TableCell>
      case "approval_status":
        return <TableCell key={colId} className="px-4">{row.approval_status ? stage3Badge(row.approval_status === "true" ? "Approved" : row.approval_status === "false" ? "Rejected" : row.approval_status) : <span className="text-slate-400">Pending</span>}</TableCell>
      default:
        return null
    }
  }

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading order…</div>
  }
  if (!order) {
    return (
      <div className="p-6 space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.push("/order-punch")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Order Punch
        </Button>
        <p className="text-muted-foreground">Order not found.</p>
      </div>
    )
  }

  return (
    <div className="p-3 sm:p-6 max-w-full space-y-4 sm:space-y-6" suppressHydrationWarning>
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div className="flex items-start gap-3 min-w-0">
          <SidebarTrigger className="-ml-1" />
          <Button variant="ghost" size="icon" onClick={() => router.push("/order-punch")} title="Back to Order Punch list">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-mono">{order.order_no}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">{order.customer_name || "—"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadDetail}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button
            size="sm"
            className={cn(order.stage3_status === "Required Modification" ? "bg-amber-500 hover:bg-amber-600 text-white" : "")}
            disabled={order.stage3_status !== "Required Modification" || isReadOnly}
            title={
              isReadOnly
                ? "View only access"
                : order.stage3_status !== "Required Modification"
                ? "Order must be marked 'Required Modification' at Stage 3 to edit"
                : "Modify order"
            }
            onClick={() => setIsModifyOpen(true)}
          >
            <Pencil className="h-4 w-4 mr-1" /> Modify
          </Button>
        </div>
      </div>

      {/* ── Order Summary ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Order Details</CardTitle>
            {stage3Badge(order.stage3_status)}
          </div>
          <CardDescription>Stage 3 (Approval of Order) decision: {order.stage3_actual_at ? formatDateTime(order.stage3_actual_at) : "not yet decided"}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
          <div><p className="text-muted-foreground text-xs">DO Date</p><p className="font-medium">{formatDate(order.party_so_date)}</p></div>
          <div><p className="text-muted-foreground text-xs">Manual Sauda No.</p><p className="font-medium">{order.manual_sauda_no || "—"}</p></div>
          <div><p className="text-muted-foreground text-xs">Dispatch From</p><p className="font-medium">{order.depot_name || "—"}</p></div>
          <div><p className="text-muted-foreground text-xs">Broker</p><p className="font-medium">{order.broker_name || "—"}</p></div>
          <div><p className="text-muted-foreground text-xs">Order Punch By</p><p className="font-medium">{order.order_punch_by || "—"}</p></div>
          <div><p className="text-muted-foreground text-xs">Actual Datetime</p><p className="font-medium">{formatDateTime(order.created_at)}</p></div>
          <div><p className="text-muted-foreground text-xs">Expected Delivery Date</p><p className="font-medium">{formatDate(order.delivery_date)}</p></div>
          <div><p className="text-muted-foreground text-xs">Payment Terms</p><p className="font-medium">{order.payment_terms || "—"}</p></div>
          <div className="col-span-2 sm:col-span-3 lg:col-span-4"><p className="text-muted-foreground text-xs">Remarks</p><p className="font-medium">{order.order_punch_remarks || "—"}</p></div>
          <div className="col-span-2"><p className="text-muted-foreground text-xs">Customer Address</p><p className="font-medium">{order.customer_address || "—"}</p></div>
          <div className="col-span-2"><p className="text-muted-foreground text-xs">Delivery Address</p><p className="font-medium">{order.customer_delivery_address || "—"}</p></div>
        </CardContent>
      </Card>

      {/* ── Line Items (with its own column toggle/reorder/sort, per Section 11) ── */}
      <Card className="border border-slate-200/80 shadow-xs overflow-hidden">
        <CardHeader className="p-4 sm:p-5 flex flex-row items-center justify-between bg-white border-b border-slate-200/80">
          <div>
            <CardTitle className="text-lg font-bold">Line Items</CardTitle>
            <CardDescription className="text-xs">{items.length} SKU line(s) on this order</CardDescription>
          </div>
          {(isAdmin || isFeatureEnabled('can_toggle_columns')) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 bg-white">
                  <Settings2 className="mr-1.5 h-3.5 w-3.5" /> Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[220px]" collisionPadding={16}>
                <ColumnToggleContent columns={ITEM_COLUMNS} visibleColumns={visibleColumns} setVisibleColumns={setVisibleColumns} />
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50 border-b">
                <TableRow>
                  <ColumnDragProvider
                    columnIds={orderedVisibleCols.map((c) => c.id)}
                    onReorder={handleColumnReorder}
                    disabled={!isAdmin && !isFeatureEnabled('can_reorder_columns')}
                  >
                    {orderedVisibleCols.map((col) => (
                      <SortableTableHead key={col.id} id={col.id} className={cn("whitespace-nowrap px-4", NUMBER_ITEM_COLS.has(col.id) && "text-right")}>
                        <div
                          className={cn("flex items-center gap-1 cursor-pointer select-none hover:text-blue-600 w-full", NUMBER_ITEM_COLS.has(col.id) ? "justify-end" : "justify-start")}
                          onClick={canSortColumns ? () => handleSort(col.id) : undefined}
                        >
                          <span>{col.label}</span>
                          {sort?.field === col.id ? <span className="text-blue-600 text-[10px]">{sort.dir === "asc" ? "▲" : "▼"}</span> : null}
                        </div>
                      </SortableTableHead>
                    ))}
                  </ColumnDragProvider>
                </TableRow>
                {sortedItems.length > 0 && (
                  <TableRow className="bg-slate-50/70">
                    {orderedVisibleCols.map((col, idx) => (
                      <TableCell
                        key={`total-${col.id}`}
                        className={cn("px-4 font-black text-slate-900", NUMBER_ITEM_COLS.has(col.id) ? "text-right font-mono tabular-nums" : "text-left")}
                      >
                        {col.id === "alternate_qty_kg"
                          ? formatNumber(sortedItems.reduce((a: number, it: any) => a + (Number(it.alternate_qty_kg) || 0), 0))
                          : idx === 0
                          ? "Total"
                          : ""}
                      </TableCell>
                    ))}
                  </TableRow>
                )}
              </TableHeader>
              <TableBody>
                {sortedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={orderedVisibleCols.length || 1} className="px-4 text-left py-10 text-muted-foreground">No line items</TableCell>
                  </TableRow>
                ) : (
                  sortedItems.map((row: any) => (
                    <TableRow key={row.id}>{orderedVisibleCols.map((col) => renderItemCell(row, col.id))}</TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ModifyOrderDialog order={order} open={isModifyOpen} onOpenChange={setIsModifyOpen} onSaved={loadDetail} />
    </div>
  )
}
