"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
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
import { RefreshCw, Settings2, Pencil, X, FileText } from "lucide-react"
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
import { formatDate, formatDateTime } from "@/lib/order-punch-format"
import { fmtNum } from "@/lib/table-format"
import { Input } from "@/components/ui/input"

const STAGE_KEY = "order-punch-detail-items"

type ColType = "text" | "number"

const ITEM_COLUMNS: { id: string; label: string; type: ColType; width?: string }[] = [
  { id: "sku_name", label: "SKU / Product", type: "text", width: "w-[260px]" },
  { id: "uom", label: "UOM", type: "text", width: "w-[90px]" },
  { id: "order_quantity", label: "Order Qty", type: "number", width: "w-[110px]" },
  { id: "alternate_qty_kg", label: "Qty (KG)", type: "number", width: "w-[110px]" },
  { id: "rate_of_material", label: "Rate (₹)", type: "number", width: "w-[120px]" },
  { id: "oil_type", label: "Oil Type", type: "text", width: "w-[110px]" },
  { id: "approval_status", label: "Approval Status", type: "text", width: "w-[150px]" },
]
const DEFAULT_ITEM_COLUMN_IDS = ITEM_COLUMNS.map((c) => c.id)
const NUMBER_ITEM_COLS = new Set(["order_quantity", "alternate_qty_kg", "rate_of_material"])
// Only the KG quantity is summed (order qty is in mixed UOMs, rate is not summable).
const TOTAL_ITEM_COLS = ["alternate_qty_kg"]
const DECIMALS: Record<string, number> = { order_quantity: 3, alternate_qty_kg: 3, rate_of_material: 2 }
const ITEM_COL_WIDTH: Record<string, string> = Object.fromEntries(ITEM_COLUMNS.map((c) => [c.id, c.width || ""]))

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

export function OrderPunchDetailModal({ orderId, onClose }: { orderId: number | null, onClose: () => void }) {
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { isReadOnly, isAdmin, isFeatureEnabled } = useAuth()

  const [order, setOrder] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isModifyOpen, setIsModifyOpen] = useState(false)

  const loadDetail = useCallback(async () => {
    if (!orderId) return
    setIsLoading(true)
    try {
      const res = await orderApi.getById(orderId)
      if (res.success) setOrder(res.data)
      else toast({ title: "Not found", description: "This order could not be found.", variant: "destructive" })
    } catch {
      toast({ title: "Error", description: "Failed to load order details.", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }, [orderId, toast])

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
    if (sort?.field === field) setSort({ field, dir: sort.dir === "asc" ? "desc" : "asc" })
    else setSort({ field, dir: "asc" })
  }
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})
  const filteredItems = useMemo(() => {
    const active = Object.entries(columnFilters).filter(([, v]) => v && v.trim())
    if (active.length === 0) return items
    return items.filter((row) =>
      active.every(([id, v]) => {
        const raw = id === "approval_status"
          ? (row.approval_status === "true" ? "Approved" : row.approval_status === "false" ? "Rejected" : row.approval_status || "Pending")
          : row[id]
        const hay = NUMBER_ITEM_COLS.has(id) ? fmtNum(raw, DECIMALS[id] ?? 3) : String(raw ?? "")
        return hay.toLowerCase().includes(v.toLowerCase().trim())
      })
    )
  }, [items, columnFilters])
  const itemTotals = useMemo(() => {
    const t: Record<string, number> = {}
    TOTAL_ITEM_COLS.forEach((id) => { t[id] = filteredItems.reduce((sum, r) => sum + (Number(r[id]) || 0), 0) })
    return t
  }, [filteredItems])
  const sortedItems = useMemo(() => {
    if (!sort) return filteredItems
    const col = ITEM_COLUMNS.find((c) => c.id === sort.field)
    const type: ColType = col?.type || "text"
    return [...filteredItems].sort((a, b) => {
      const cmp = compareValues(a[sort.field], b[sort.field], type)
      return sort.dir === "asc" ? cmp : -cmp
    })
  }, [filteredItems, sort])

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
    const widthClass = ITEM_COL_WIDTH[colId] || ""
    const alignClass = cn("px-4", widthClass, NUMBER_ITEM_COLS.has(colId) && "text-right font-mono tabular-nums whitespace-nowrap")
    switch (colId) {
      case "sku_name":
        return <TableCell key={colId} className={cn("font-medium whitespace-normal break-words px-4", widthClass)}>{row.sku_name || "—"}</TableCell>
      case "uom":
        return <TableCell key={colId} className={cn("px-4", widthClass)}>{row.uom || "—"}</TableCell>
      case "order_quantity":
        return <TableCell key={colId} className={alignClass}>{fmtNum(row.order_quantity, DECIMALS.order_quantity)}</TableCell>
      case "alternate_qty_kg":
        return <TableCell key={colId} className={alignClass}>{fmtNum(row.alternate_qty_kg, DECIMALS.alternate_qty_kg)}</TableCell>
      case "rate_of_material":
        return <TableCell key={colId} className={alignClass}>{fmtNum(row.rate_of_material, DECIMALS.rate_of_material)}</TableCell>
      case "oil_type":
        return <TableCell key={colId} className={cn("px-4", widthClass)}>{row.oil_type || "—"}</TableCell>
      case "approval_status":
        return <TableCell key={colId} className={cn("px-4", widthClass)}>{row.approval_status ? stage3Badge(row.approval_status === "true" ? "Approved" : row.approval_status === "false" ? "Rejected" : row.approval_status) : <span className="text-slate-400">Pending</span>}</TableCell>
      default:
        return null
    }
  }

  if (!orderId) return null

  return (
    <Dialog open={!!orderId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-[1250px] max-h-[95vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-4 sm:px-6 py-4 pr-10 sm:pr-12 border-b shrink-0" style={{ background: "oklch(0.97 0.012 245)" }}>
          <div className="flex items-center justify-between gap-4 flex-wrap w-full">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl shrink-0" style={{ background: "oklch(0.42 0.18 265 / 0.12)" }}>
                <FileText className="h-4 w-4" style={{ color: "oklch(0.42 0.18 265)" }} />
              </div>
              <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
                {order ? order.order_no : "Loading..."}
              </DialogTitle>
              {order && stage3Badge(order.stage3_status)}
            </div>

            <div className="flex items-center gap-3">
              {order && (
                <>
                  <Button variant="outline" size="sm" onClick={loadDetail} disabled={isLoading} className="h-8 bg-white">
                    <RefreshCw className={cn("h-3.5 w-3.5 mr-1", isLoading && "animate-spin")} /> Refresh
                  </Button>
                  <Button
                    size="sm"
                    className={cn("h-8", order.stage3_status === "Required Modification" ? "bg-amber-500 hover:bg-amber-600 text-white" : "")}
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
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Modify
                  </Button>
                </>
              )}
            </div>
          </div>
          <DialogDescription className="text-xs text-slate-500 mt-0.5 ml-[calc(2rem+0.625rem)] text-left">
            {order ? order.customer_name || "—" : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-6">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="h-8 w-8 animate-spin text-blue-600 rounded-full border-4 border-blue-200 border-t-blue-600" />
            </div>
          ) : !order ? (
            <div className="text-center py-12 text-slate-500">Order not found.</div>
          ) : (
            <>

      {/* ── Order Summary ── */}
      <Card className="border-slate-200/80 shadow-none bg-slate-50/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Order Details</CardTitle>
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
      <Card className="border border-slate-200/80 shadow-none overflow-hidden bg-slate-50/50">
        <CardHeader className="p-4 sm:p-5 flex flex-row items-center justify-between bg-slate-50/80 border-b border-slate-200/80">
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
            <Table className="table-fixed">
              <TableHeader className="bg-slate-50 border-b">
                <TableRow>
                  {orderedVisibleCols.map((col) => (
                    <TableHead key={`search-${col.id}`} className={cn("whitespace-nowrap align-top pt-2.5 pb-1 px-4", ITEM_COL_WIDTH[col.id], NUMBER_ITEM_COLS.has(col.id) && "text-right")}>
                      <Input
                        placeholder="Search..."
                        value={columnFilters[col.id] || ""}
                        onChange={(e) => setColumnFilters((p) => ({ ...p, [col.id]: e.target.value }))}
                        className={cn(
                          "h-7 text-[10px] w-full px-2.5 py-0 bg-slate-50 hover:bg-slate-100 focus:bg-white border-slate-200/70 focus:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-100/50 shadow-2xs rounded-md transition-all placeholder:text-slate-400/80 font-medium text-slate-700",
                          NUMBER_ITEM_COLS.has(col.id) ? "text-right" : "text-left"
                        )}
                      />
                    </TableHead>
                  ))}
                </TableRow>
                {sortedItems.length > 0 && (
                  <TableRow className="bg-slate-100/90 border-b-2 border-slate-300 font-bold text-xs text-slate-800 hover:bg-slate-100/90 shadow-sm z-10">
                    {orderedVisibleCols.map((col, idx) => {
                      const alignClass = cn("px-4", NUMBER_ITEM_COLS.has(col.id) && "text-right tabular-nums")
                      if (idx === 0) {
                        return <TableCell key={`total-${col.id}`} className={cn("font-black text-slate-900 uppercase tracking-wider text-[11px]", alignClass)}>Total ({sortedItems.length})</TableCell>
                      }
                      if (TOTAL_ITEM_COLS.includes(col.id)) {
                        return <TableCell key={`total-${col.id}`} className={cn("font-mono font-black text-blue-700", alignClass)}>{fmtNum(itemTotals[col.id], DECIMALS[col.id] ?? 3)}</TableCell>
                      }
                      return <TableCell key={`total-${col.id}`} className={cn("text-slate-400 font-normal", alignClass)}></TableCell>
                    })}
                  </TableRow>
                )}
                <TableRow>
                  <ColumnDragProvider
                    columnIds={orderedVisibleCols.map((c) => c.id)}
                    onReorder={handleColumnReorder}
                    disabled={!isAdmin && !isFeatureEnabled('can_reorder_columns')}
                  >
                    {orderedVisibleCols.map((col) => (
                      <SortableTableHead key={col.id} id={col.id} className={cn("whitespace-nowrap px-4", ITEM_COL_WIDTH[col.id], NUMBER_ITEM_COLS.has(col.id) && "text-right")}>
                        <div
                          className={cn("flex items-center gap-1 cursor-pointer select-none hover:text-blue-600 w-full", NUMBER_ITEM_COLS.has(col.id) ? "justify-end" : "justify-start")}
                          onClick={() => handleSort(col.id)}
                        >
                          <span>{col.label}</span>
                          {sort?.field === col.id ? <span className="text-blue-600 text-[10px]">{sort.dir === "asc" ? "▲" : "▼"}</span> : null}
                        </div>
                      </SortableTableHead>
                    ))}
                  </ColumnDragProvider>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={orderedVisibleCols.length || 1} className="text-center py-10 text-muted-foreground">No line items</TableCell>
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
      </>
      )}
      </div>

      <ModifyOrderDialog
        open={isModifyOpen}
        onOpenChange={setIsModifyOpen}
        orderId={orderId}
        onSuccess={loadDetail}
      />
      </DialogContent>
    </Dialog>
  )
}
