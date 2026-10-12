"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { usePersistedFilters } from "@/hooks/use-persisted-filters"
import { useStageTable, type StageColDef } from "@/hooks/use-stage-table"
import { StageListHeader, StageToolbar, StageSegmented, StageFilterSelect, StageDivider, StageColumnsMenu, StageActiveChips, StageActionBar, StagePagination } from "@/components/stage-list"
import { stageColumnChips } from "@/components/stage-list-extras"
import { StageTableHeaderRows, bodyCellClass } from "@/components/stage-table-header-rows"
import { WorkflowStageShell } from "@/components/workflow/workflow-stage-shell"
import { StageHistoryTab } from "@/components/workflow/stage-history-tab"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { WORKFLOW_STAGE_COLUMNS as ALL_COLUMNS } from "@/lib/workflow-columns"
import { unloadingApi, orderApi } from "@/lib/api-service"
import { isStaleWriteError } from "@/lib/stale-write"
import { useAuth } from "@/hooks/use-auth"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight, CheckCircle, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { fmtNum, fmtDate } from "@/lib/table-format"
import { usePersistedColumns } from "@/hooks/use-persisted-columns"
import { useColumnOrder } from "@/hooks/use-column-order"
import { ColumnDragProvider } from "@/components/ui/column-drag-provider"
import { UnloadingForm, UnloadingFormData } from "@/components/unloading-form"
import { LossApprovalsDialog } from "@/components/loss-approvals-dialog"

const PAGE_COLUMNS = [
  { id: "partySoDate",       label: "DO Date" },
  { id: "doNumber",          label: "DO Number" },
  { id: "processId",         label: "Manual Sauda No." },
  { id: "customerName",      label: "Customer Name" },
  { id: "products",          label: "Products" },
  { id: "invoiceNo",         label: "Invoice No." },
  { id: "vehicleNo",         label: "Vehicle No." },
  { id: "orderPunchRemarks", label: "Order Punch Remarks" },
] as const
type ColId = typeof PAGE_COLUMNS[number]["id"]

const CORE_COLUMN_IDS: string[] = PAGE_COLUMNS.map(c => c.id)

// Toggle-able dynamic columns: typed so they right-align and format consistently.
const NUMERIC_DYN_COLS = new Set(["orderQty", "altQty", "rate", "ratePerLtr", "ratePer15Kg", "rateOfMaterial", "totalWithGst", "advanceAmount", "qtyToDispatch", "actual_approval_qty", "gross_weight", "tare_weight", "net_weight", "actual_qty", "actual_qty_dispatch", "extra_weight", "bill_amount", "damage_qty"])
const DATE_DYN_COLS = new Set(["deliveryDate", "dispatch_date_confirmed", "invoice_date"])
const DYN_LABEL_OVERRIDES: Record<string, string> = {
  rate: "Rate (₹)",
  ratePerLtr: "Rate Per Ltr (₹)",
  ratePer15Kg: "Rate Per 15 kg (₹)",
  rateOfMaterial: "Rate Of Material (₹)",
  totalWithGst: "Total Amount With Gst (₹)",
  advanceAmount: "Advance Amount (₹)",
  bill_amount: "Bill Amount (₹)",
}
const NUM_DECIMALS: Record<string, number> = { rate: 2, ratePerLtr: 2, ratePer15Kg: 2, rateOfMaterial: 2, totalWithGst: 2, advanceAmount: 2, bill_amount: 2 }

const formatDate = (dateStr: string) => {
  if (!dateStr) return "—"
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return dateStr
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export default function UnloadingPage() {
  const { user, isReadOnly, isAdmin, isFeatureEnabled } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  // List view (tab / filters / quick search) is remembered across refresh, re-login and devices.
  // Refresh/reload only reloads data - never clears it. Reset (resetAllFilters) is the only way to clear.
  const [listView, patchListView] = usePersistedFilters("unloading", {
    activeTab: "pending" as "pending" | "history",
    quickSearch: "",
    customerFilter: "ALL",
    statusFilter: "ALL" as "ALL" | "TRANSIT" | "REJECTED",
  })
  const { activeTab, quickSearch, customerFilter, statusFilter } = listView
  const setActiveTab = (v: "pending" | "history") => patchListView({ activeTab: v })
  const setQuickSearch = (v: string) => patchListView({ quickSearch: v })
  const setCustomerFilter = (v: string) => patchListView({ customerFilter: v })
  const setStatusFilter = (v: "ALL" | "TRANSIT" | "REJECTED") => patchListView({ statusFilter: v })
  const [pendingPage, setPendingPage] = useState(1)
  const limit = 20

  const [filterValues, setFilterValues] = useState({
    status: "",
    startDate: "",
    endDate: "",
    partyName: "",
    search: "",
    manualSaudaNo: ""
  })
  const [isProcessing, setIsProcessing] = useState(false)

  const [visibleColumns, setVisibleColumns] = usePersistedColumns(
    "unloading",
    ["partySoDate", "doNumber", "customerName", "invoiceNo", "vehicleNo", "products"]
  )

  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [selectedGroup, setSelectedGroup] = useState<any>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isApprovalsOpen, setIsApprovalsOpen] = useState(false)

  const depoNames = user?.depo_access?.['Unloading']

  const {
    data: pendingData,
    isLoading: isPendingLoading,
    refetch: refetchPending,
  } = useQuery({
    queryKey: ["pending-unloading", filterValues, depoNames, pendingPage],
    queryFn: async () => {
      const response = await unloadingApi.getPending({
        page: pendingPage,
        limit,
        order_no: filterValues.search,
        manual_sauda_no: filterValues.manualSaudaNo,
        start_date: filterValues.startDate,
        end_date: filterValues.endDate,
        customer_name: filterValues.partyName === "all" ? undefined : filterValues.partyName,
        depo_names: depoNames,
      })
      return response.success ? response.data : { orders: [], pagination: { total: 0, totalPages: 1 } }
    },
  })

  const pendingOrders = useMemo(() => pendingData?.orders || [], [pendingData])

  // Loss approvals are a Company Admin task; the count drives the button badge.
  const { data: approvalsData } = useQuery({
    queryKey: ["unloading-approvals-count"],
    queryFn: async () => {
      const res = await unloadingApi.getApprovals({ page: 1, limit: 1 })
      return res.success ? res.data?.pagination?.total || 0 : 0
    },
    enabled: isAdmin,
    refetchInterval: 60000,
  })
  const totalPages = pendingData?.pagination?.totalPages || 1

  useEffect(() => {
    setPendingPage(1)
  }, [filterValues])

  /* One row per invoice; each product line is its own unloading record. */
  const displayRows = useMemo(() => {
    const grouped: { [key: string]: any } = {}

    pendingOrders.forEach((order: any) => {
      const groupKey = order.invoice_no || `UL-${order.id}`
      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          _rowKey: groupKey,
          doNumber: order.so_no || "—",
          invoiceNo: order.invoice_no || "No Invoice",
          customerName: order.party_name || "—",
          invoiceCopy: order.invoice_copy || null,
          _allProducts: [],
        }
      }
      grouped[groupKey]._allProducts.push({
        ...order,
        productName: order.product_name,
        actualQty: order.actual_qty_dispatch,
      })
    })

    return Object.values(grouped).map((g: any) => ({
      ...g,
      _productCount: g._allProducts.length,
      partySoDate: formatDate(g._allProducts[0]?.party_so_date),
      _doDate: g._allProducts[0]?.party_so_date,
      processId: g._allProducts[0]?.processid || "—",
      vehicleNo: (g._allProducts[0]?.truck_no || "—").toUpperCase(),
      orderPunchRemarks: g._allProducts[0]?.order_punch_remarks || "—",
      rejectionNote: (g._allProducts.find((p: any) => String(p.approval_remarks || "").startsWith("Rejected"))?.approval_remarks as string | undefined) || null,
    }))
  }, [pendingOrders])

  function getDynamicColumnValue(group: any, colId: string) {
    const directValue = group?.[colId]
    if (directValue !== undefined && directValue !== null && directValue !== "") return directValue
    const productValue = group?._allProducts?.[0]?.[colId]
    if (productValue !== undefined && productValue !== null && productValue !== "") return productValue
    return "—"
  }

  const [columnOrder, setColumnOrder] = useColumnOrder("unloading", CORE_COLUMN_IDS)
  const orderedVisibleIds = useMemo(
    () => columnOrder.filter(id => CORE_COLUMN_IDS.includes(id) && visibleColumns.includes(id)),
    [columnOrder, visibleColumns]
  )
  const dynamicColumns = visibleColumns.filter(colId => !CORE_COLUMN_IDS.includes(colId))
  const handleColumnReorder = useCallback((newVisibleOrder: string[]) => {
    const coreInNewOrder = newVisibleOrder.filter(id => CORE_COLUMN_IDS.includes(id))
    const hiddenCols = columnOrder.filter(id => !coreInNewOrder.includes(id))
    setColumnOrder([...coreInNewOrder, ...hiddenCols])
  }, [columnOrder, setColumnOrder])

  // ── Stage list table: per-column search / date filter / sort / totals ──
  const stageColumns = useMemo<StageColDef<any>[]>(() => {
    const core: StageColDef<any>[] = [
      { id: "partySoDate", label: "DO Date", type: "date", accessor: (r) => r._doDate },
      { id: "doNumber", label: "DO Number", accessor: (r) => r.doNumber },
      { id: "processId", label: "Manual Sauda No.", accessor: (r) => r.processId },
      { id: "customerName", label: "Customer Name", accessor: (r) => r.customerName },
      { id: "products", label: "Products", type: "number", total: true, accessor: (r) => r._productCount },
      { id: "invoiceNo", label: "Invoice No.", accessor: (r) => r.invoiceNo },
      { id: "vehicleNo", label: "Vehicle No.", accessor: (r) => r.vehicleNo },
      { id: "orderPunchRemarks", label: "Order Punch Remarks", accessor: (r) => r.orderPunchRemarks },
    ]
    core.push({ id: "status", label: "Status", accessor: (r) => (r.rejectionNote ? "Rejected" : "In Transit") })
    const dyn: StageColDef<any>[] = ALL_COLUMNS
      .filter((c) => !CORE_COLUMN_IDS.includes(c.id))
      .map((c): StageColDef<any> =>
        NUMERIC_DYN_COLS.has(c.id)
          ? { id: c.id, label: DYN_LABEL_OVERRIDES[c.id] || c.label, type: "number", accessor: (r: any) => Number(getDynamicColumnValue(r, c.id)) || 0 }
          : DATE_DYN_COLS.has(c.id)
            ? { id: c.id, label: c.label, type: "date", accessor: (r: any) => { const v = getDynamicColumnValue(r, c.id); return v === "—" ? null : v } }
            : { id: c.id, label: c.label, accessor: (r: any) => String(getDynamicColumnValue(r, c.id)) }
      )
    return [...core, ...dyn]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const visibleStageCols = useMemo(
    () => [...orderedVisibleIds, ...dynamicColumns].map(id => stageColumns.find(c => c.id === id)).filter((c): c is StageColDef<any> => !!c),
    [orderedVisibleIds, dynamicColumns, stageColumns]
  )

  const statusStageCol = useMemo(() => stageColumns.find(c => c.id === "status"), [stageColumns])
  const customerOptions = useMemo(
    () => Array.from(new Set(displayRows.map((r: any) => r.customerName).filter((n: string) => n && n !== "—"))).sort() as string[],
    [displayRows]
  )
  const baseFilter = useCallback((r: any) => {
    if (customerFilter !== "ALL" && r.customerName !== customerFilter) return false
    if (statusFilter === "REJECTED" && !r.rejectionNote) return false
    if (statusFilter === "TRANSIT" && r.rejectionNote) return false
    const q = quickSearch.trim().toLowerCase()
    if (q && !stageColumns.some((c) => String(c.accessor?.(r) ?? "").toLowerCase().includes(q))) return false
    return true
  }, [customerFilter, statusFilter, quickSearch, stageColumns])
  const table = useStageTable({ rows: displayRows, columns: stageColumns, baseFilter, persistKey: "unloading" })
  const sortedDisplayRows = table.rows
  const activeFiltersCount =
    table.activeColumnFilterCount + (customerFilter !== "ALL" ? 1 : 0) + (statusFilter !== "ALL" ? 1 : 0) + (quickSearch.trim() ? 1 : 0)
  const resetAllFilters = () => {
    patchListView({ customerFilter: "ALL", statusFilter: "ALL", quickSearch: "" })
    table.clearColumnFilters()
  }
  const filterChips = [
    ...(statusFilter !== "ALL" ? [{ label: `Status: ${statusFilter === "TRANSIT" ? "In Transit" : "Rejected"}`, onClear: () => setStatusFilter("ALL") }] : []),
    ...(customerFilter !== "ALL" ? [{ label: `Customer: ${customerFilter}`, onClear: () => setCustomerFilter("ALL") }] : []),
    ...(quickSearch.trim() ? [{ label: `Search: ${quickSearch.trim()}`, onClear: () => setQuickSearch("") }] : []),
    ...stageColumnChips(table, stageColumns),
  ]

  const renderCoreCell = (group: any, colId: ColId) => {
    switch (colId) {
      case "partySoDate":
        return <TableCell key={colId} className={bodyCellClass(stageColumns.find(c => c.id === colId), "whitespace-nowrap text-slate-600")}>{group.partySoDate}</TableCell>
      case "doNumber":
        return <TableCell key={colId} className="whitespace-nowrap px-4 text-left text-xs text-blue-700 font-bold">{group.doNumber}</TableCell>
      case "processId":
        return <TableCell key={colId} className="whitespace-nowrap px-4 text-left text-xs text-slate-600">{group.processId}</TableCell>
      case "customerName":
        return <TableCell key={colId} className="whitespace-nowrap px-4 text-left text-xs"><span className="font-medium text-slate-700">{group.customerName}</span></TableCell>
      case "products":
        return (
          <TableCell key={colId} className={bodyCellClass(stageColumns.find(c => c.id === colId), "whitespace-nowrap")}>
            {group._productCount}
          </TableCell>
        )
      case "invoiceNo":
        return (
          <TableCell key={colId} className="whitespace-nowrap px-4 text-left text-xs text-slate-600">
            {group.invoiceCopy ? (
              <a href={group.invoiceCopy} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-blue-600 hover:underline font-bold">
                {group.invoiceNo}
              </a>
            ) : (
              group.invoiceNo
            )}
          </TableCell>
        )
      case "vehicleNo":
        return <TableCell key={colId} className="whitespace-nowrap px-4 text-left text-xs text-slate-600">{group.vehicleNo}</TableCell>
      case "orderPunchRemarks":
        return <TableCell key={colId} className="whitespace-nowrap px-4 text-left text-xs text-slate-600"><span className="truncate max-w-[150px] block">{group.orderPunchRemarks}</span></TableCell>
      default:
        return null
    }
  }

  const toggleSelectItem = (itemKey: string) => {
    setSelectedItems(prev => prev.includes(itemKey) ? prev.filter(k => k !== itemKey) : [...prev, itemKey])
  }

  const toggleSelectAll = () => {
    const visibleKeys = table.rows.map(r => r._rowKey)
    if (visibleKeys.length > 0 && visibleKeys.every(k => selectedItems.includes(k))) setSelectedItems([])
    else setSelectedItems(visibleKeys)
  }

  // The damage report is filed for one invoice at a time.
  const handleOpenDialog = () => {
    if (selectedItems.length === 0) return
    if (selectedItems.length > 1) {
      toast({ title: "Select one invoice", description: "Unloading is reported one invoice at a time.", variant: "destructive" })
      return
    }
    const targetGroup = displayRows.find(r => r._rowKey === selectedItems[0])
    if (targetGroup) {
      setSelectedGroup(targetGroup)
      setIsDialogOpen(true)
    }
  }

  const handleSubmit = async (formData: UnloadingFormData) => {
    if (!selectedGroup) return

    const lines: any[] = selectedGroup._allProducts
    const totalDispatched = lines.reduce((sum, l) => sum + (Number(l.actualQty) || 0), 0)
    const shortage = formData.shortageQty === "" ? 0 : Number(formData.shortageQty)
    if (!formData.receivedDate) {
      toast({ title: "Validation Error", description: "Enter the date unloading was completed.", variant: "destructive" })
      return
    }
    if (!Number.isFinite(shortage) || shortage < 0) {
      toast({ title: "Validation Error", description: "Shortage quantity cannot be negative.", variant: "destructive" })
      return
    }
    if (totalDispatched > 0 && shortage > totalDispatched) {
      toast({ title: "Validation Error", description: `Shortage (${shortage}) cannot exceed the dispatched quantity (${totalDispatched}).`, variant: "destructive" })
      return
    }
    if (shortage > 0 && !formData.shortageCause) {
      toast({ title: "Validation Error", description: "Select the cause of the shortage.", variant: "destructive" })
      return
    }
    if (formData.damagedContainers.length > 0 && formData.damagePhotoFiles.length === 0) {
      toast({ title: "Validation Error", description: "Upload at least one photo of the damage.", variant: "destructive" })
      return
    }
    for (const [i, c] of formData.damagedContainers.entries()) {
      if (!c.containerSerialNumber.trim()) {
        toast({ title: "Validation Error", description: `Damaged container #${i + 1}: serial number is required.`, variant: "destructive" })
        return
      }
      if (!c.cause) {
        toast({ title: "Validation Error", description: `Container ${c.containerSerialNumber}: select the cause of the damage.`, variant: "destructive" })
        return
      }
      if (c.damageType === "partial") {
        if (c.items.length === 0) {
          toast({ title: "Validation Error", description: `Container ${c.containerSerialNumber}: add the affected internal items.`, variant: "destructive" })
          return
        }
        for (const item of c.items) {
          if (!item.sfgSerialNumber.trim()) {
            toast({ title: "Validation Error", description: `Container ${c.containerSerialNumber}: every internal item needs a serial number.`, variant: "destructive" })
            return
          }
          if (item.lossType === "partial" && !(Number(item.oilWeightLost) > 0)) {
            toast({ title: "Validation Error", description: `Item ${item.sfgSerialNumber}: enter the oil weight lost.`, variant: "destructive" })
            return
          }
        }
      }
    }

    // One unloading record exists per product line. The damage report is filed on
    // the first line; the shortage is spread across the lines (each capped at what
    // was dispatched on it); every line gets the received date and proof.
    setIsProcessing(true)
    try {
      const uploadOne = async (file: File) => {
        const res = await orderApi.uploadFile(file)
        if (!res.success) throw new Error(res.message || "File upload failed")
        return res.data.url as string
      }
      const receivedProof = formData.receivedProofFile ? await uploadOne(formData.receivedProofFile) : null
      const damagePhotos: string[] = []
      for (const f of formData.damagePhotoFiles) damagePhotos.push(await uploadOne(f))

      let shortageLeft = shortage
      let succeeded = 0
      let needsApproval = 0
      let stale = 0
      let failed = 0
      for (const [idx, line] of lines.entries()) {
        const lineCap = Number(line.actualQty) || Infinity
        const lineShortage = idx === lines.length - 1 ? shortageLeft : Math.min(shortageLeft, lineCap)
        shortageLeft -= lineShortage
        const common = {
          receivedDate: formData.receivedDate,
          receivedProof,
          shortageCause: formData.shortageCause || null,
          remarks: formData.remarks || null,
          userId: user?.id || null,
        }
        const payload = idx === 0
          ? {
              ...common,
              shortageQty: lineShortage,
              damagePhotos,
              damagedContainers: formData.damagedContainers.map(c => ({
                containerSerialNumber: c.containerSerialNumber.trim(),
                damageType: c.damageType,
                cause: c.cause,
                items: c.damageType === "partial"
                  ? c.items.map(item => ({
                      sfgSerialNumber: item.sfgSerialNumber.trim(),
                      lossType: item.lossType,
                      oilWeightLost: item.lossType === "partial" ? Number(item.oilWeightLost) : null,
                    }))
                  : [],
              })),
            }
          : { ...common, shortageQty: lineShortage, damagePhotos: [], damagedContainers: [] }

        try {
          const response = await unloadingApi.submit(line.id, payload)
          if (response.success) { succeeded++; if (response.data?.needsApproval) needsApproval++ }
          else failed++
        } catch (err: any) {
          if (isStaleWriteError(err)) stale++
          else failed++
        }
      }

      if (succeeded > 0) {
        toast(needsApproval > 0
          ? { title: "Sent for approval", description: `Loss report for ${needsApproval} item(s) is waiting for Company Admin approval. Stock is adjusted once approved - track it in History.` }
          : { title: "Unloading Confirmed", description: `Processed ${succeeded} item(s).` })
      }
      if (stale > 0) {
        toast({ title: "Already processed", description: `${stale} item(s) were already processed by another user. Refreshing the list…`, variant: "destructive" })
      }
      if (failed > 0) {
        toast({ title: "Partial Failure", description: `Failed to process ${failed} item(s).`, variant: "destructive" })
      }
      if (succeeded > 0 || stale > 0) {
        await refetchPending()
        queryClient.invalidateQueries({ queryKey: ["unloading-history"] })
        queryClient.invalidateQueries({ queryKey: ["unloading-approvals-count"] })
        setIsDialogOpen(false)
        setSelectedItems([])
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Submit failed", variant: "destructive" })
    } finally {
      setIsProcessing(false)
    }
  }

  const customerNames = Array.from(new Set(pendingOrders.map((order: any) => order.party_name || "Unknown Customer"))) as string[]

  return (
    <WorkflowStageShell
      partyNames={customerNames}
      title="Stage 14: Unloading"
      description="Customer reports shortage, damage, and drives inventory logic."
      searchPlaceholder="Search DO Number..."
      pendingCount={pendingData?.pagination?.total || 0}
      historyData={[]}
      onFilterChange={setFilterValues}
      showStatusFilter={true}
      stageLevel={9}
      onTabChange={setActiveTab}
      showDateFilters={true}
      showSaudaFilter={true}
      dateLabel="DO Date"
      historyContent={
        <StageHistoryTab
          queryKeyPrefix="unloading-history"
          getHistoryApi={(params: any) => unloadingApi.getHistory({
            ...params,
            manual_sauda_no: filterValues.manualSaudaNo || undefined,
            depo_names: depoNames,
          })}
          filterValues={filterValues}
          activeTab={activeTab}
          stageName="Unloading"
          stageLevel={9}
          remarksColName="Remarks"
          orderListKey="orders"
          mapOrderNo={(order: any) => order.so_no || "-"}
          mapCustomerName={(order: any) => order.party_name || "—"}
          mapStatus={(order: any) =>
            order.approval_status === "pending" ? "Pending Approval"
              : (Number(order.shortage_qty) > 0 || (order.damagedContainers?.length ?? 0) > 0) ? "Approved"
              : "Received OK"}
          mapRemarks={(order: any) => {
            const parts: string[] = []
            if (Number(order.shortage_qty) > 0) parts.push(`Shortage: ${order.shortage_qty}`)
            if (order.damagedContainers?.length) parts.push(`Damaged containers: ${order.damagedContainers.length}`)
            if (order.approval_status === "pending") parts.push("Awaiting Company Admin approval")
            return parts.length ? parts.join(", ") : (order.remarks_3 || "Received OK")
          }}
          getDate={(order: any) => order.actual_8 || null}
        />
      }
    >
      <div className="space-y-4">
        <StageActionBar>
          <Button
            onClick={handleOpenDialog}
            disabled={selectedItems.length === 0}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
            title={isReadOnly ? "View Unloading Details" : "Report Unloading"}
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            Report Unloading ({selectedItems.length})
          </Button>

          {isAdmin && (
            <Button variant="outline" onClick={() => setIsApprovalsOpen(true)} className="w-full sm:w-auto">
              <ShieldCheck className="mr-2 h-4 w-4" />
              Loss Approvals{approvalsData ? ` (${approvalsData})` : ""}
            </Button>
          )}
                </StageActionBar>

        <Card className="border border-slate-200/80 shadow-xs overflow-hidden py-0 gap-0 stage-card">
          <StageListHeader
            title="Unloading List"
            shown={table.rows.length}
            total={displayRows.length}
            description="Invoices dispatched and awaiting unloading confirmation"
            searchValue={quickSearch}
            onSearchChange={setQuickSearch}
            searchPlaceholder="Search DO, Customer, Invoice..."
          >
            <StageToolbar
              shown={table.rows.length}
              total={displayRows.length}
              activeCount={activeFiltersCount}
              onReset={resetAllFilters}
              filters={
                <>
                  <StageSegmented
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={[
                      { value: "ALL", label: "All" },
                      { value: "TRANSIT", label: "In Transit" },
                      { value: "REJECTED", label: "Rejected" },
                    ]}
                  />
                  <StageDivider />
                  <StageFilterSelect value={customerFilter} onChange={setCustomerFilter} allLabel="All Customers" options={customerOptions} className="min-w-[130px]" />
                  <StageColumnsMenu
                    columns={ALL_COLUMNS}
                    visibleColumns={visibleColumns}
                    setVisibleColumns={setVisibleColumns}
                    show={isAdmin || isFeatureEnabled('can_toggle_columns')}
                  />
                </>
              }
            />
            <StageActiveChips chips={filterChips} />
          </StageListHeader>
          <CardContent className="p-0">
          {/* Desktop Table View */}
          <div className="hidden overflow-x-auto rounded-b-xl md:block">
            <Table>
              <StageTableHeaderRows
                columns={visibleStageCols}
                trailingColumns={statusStageCol ? [statusStageCol] : []}
                table={table}
                leading={<Checkbox checked={table.rows.length > 0 && table.rows.every(r => selectedItems.includes(r._rowKey))} onCheckedChange={toggleSelectAll} />}
                onReorder={handleColumnReorder}
                dragDisabled={!isAdmin && !isFeatureEnabled('can_reorder_columns')}
              />
              <TableBody>
                {isPendingLoading && pendingOrders.length === 0 ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i} className="opacity-40 border-b border-slate-50">
                      <TableCell className="text-center py-4"><div className="h-4 w-4 bg-slate-200 animate-pulse rounded mx-auto" /></TableCell>
                      {[...Array(visibleStageCols.length)].map((_, k) => (
                        <TableCell key={k} className="text-center py-4"><div className="h-3 w-24 bg-slate-200 animate-pulse rounded-full mx-auto" /></TableCell>
                      ))}
                      <TableCell className="text-center py-4"><div className="h-5 w-16 bg-slate-200 animate-pulse rounded-full mx-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : sortedDisplayRows.length > 0 ? (
                  sortedDisplayRows.map((group) => (
                    <TableRow
                      key={group._rowKey}
                      className={cn(
                        "cursor-pointer transition-colors",
                        selectedItems.includes(group._rowKey) ? "bg-blue-50/40" : "hover:bg-slate-50/60"
                      )}
                      onClick={() => toggleSelectItem(group._rowKey)}
                    >
                      <TableCell className="px-4 text-left" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={selectedItems.includes(group._rowKey)} onCheckedChange={() => toggleSelectItem(group._rowKey)} />
                      </TableCell>
                      {orderedVisibleIds.map(id => renderCoreCell(group, id as ColId))}
                      {dynamicColumns.map((colId) => (
                        <TableCell key={colId} className={bodyCellClass(stageColumns.find(c => c.id === colId), "whitespace-nowrap text-slate-600")}>
                          {NUMERIC_DYN_COLS.has(colId)
                            ? fmtNum(getDynamicColumnValue(group, colId), NUM_DECIMALS[colId] ?? 4)
                            : DATE_DYN_COLS.has(colId)
                              ? fmtDate(getDynamicColumnValue(group, colId))
                              : String(getDynamicColumnValue(group, colId))}
                        </TableCell>
                      ))}
                      <TableCell className="px-4 text-left">
                        {group.rejectionNote ? (
                          <Badge title={group.rejectionNote} className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200 text-[10px] font-black whitespace-nowrap">Rejected — re-report</Badge>
                        ) : (
                          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200 text-[10px] font-black whitespace-nowrap">In Transit</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={visibleStageCols.length + 2} className="text-center py-12 text-muted-foreground">
                      {displayRows.length === 0 ? "No orders pending for unloading" : "No matching records found for the filters"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden max-h-[600px] overflow-y-auto p-3">
            {isPendingLoading && pendingOrders.length === 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {[...Array(4)].map((_, i) => (
                  <Card key={i} className="p-4 space-y-4 border-slate-100 shadow-sm animate-pulse">
                    <div className="flex justify-between">
                      <div className="h-4 w-32 bg-slate-200 rounded" />
                      <div className="h-5 w-20 bg-slate-200 rounded-full" />
                    </div>
                    <div className="h-5 w-3/4 bg-slate-100 rounded" />
                  </Card>
                ))}
              </div>
            ) : table.rows.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {table.rows.map((group) => (
                  <Card
                    key={group._rowKey}
                    className={cn(
                      "p-4 border-2 transition-all shadow-sm bg-white cursor-pointer",
                      selectedItems.includes(group._rowKey) ? "border-blue-500 bg-blue-50/30 shadow-md" : "border-slate-100 hover:border-blue-200"
                    )}
                    onClick={() => toggleSelectItem(group._rowKey)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{group.partySoDate}</p>
                        <h3 className="text-sm font-bold text-slate-900 leading-tight break-words">{group.customerName}</h3>
                      </div>
                      <Checkbox
                        checked={selectedItems.includes(group._rowKey)}
                        onCheckedChange={() => toggleSelectItem(group._rowKey)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1 h-5 w-5"
                      />
                    </div>
                    <div className="mt-4 flex flex-col gap-1">
                      <p className="font-mono text-sm font-black text-blue-700 break-all">{group.doNumber}</p>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 border-y border-slate-100 py-3">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Vehicle No.</p>
                        <p className="text-xs font-bold text-slate-700">{group.vehicleNo}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Invoice</p>
                        <p className="text-xs font-bold text-slate-700 break-words">{group.invoiceNo}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="font-black text-[10px]">Items: {group._productCount}</Badge>
                      <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200 text-[10px] font-black">In Transit</Badge>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                {displayRows.length === 0 ? "No orders pending for unloading" : "No matching records found for the filters"}
                {displayRows.length > 0 && (
                  <div className="mt-3">
                    <Button variant="outline" size="sm" onClick={resetAllFilters}>Clear Filters</Button>
                  </div>
                )}
              </div>
            )}
          </div>
          </CardContent>
        </Card>

        <StagePagination
          page={pendingPage}
          totalPages={totalPages}
          total={pendingData?.pagination?.total || 0}
          noun="Loads"
          onPrev={() => setPendingPage(p => Math.max(1, p - 1))}
          onNext={() => setPendingPage(p => p + 1)}
          prevDisabled={pendingPage === 1}
          nextDisabled={pendingPage >= totalPages}
        />

        <LossApprovalsDialog open={isApprovalsOpen} onOpenChange={setIsApprovalsOpen} />

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="w-[calc(100vw-0.75rem)] max-w-[calc(100vw-0.75rem)] sm:!max-w-[95vw] max-h-[95vh] overflow-y-auto p-0 [overflow-wrap:anywhere]">
            <div className="p-4 sm:p-6">
              <DialogHeader className="pr-8">
                <DialogTitle className="text-xl sm:text-2xl font-bold text-slate-900 border-b pb-4 mb-4 leading-tight">
                  Unloading Report - Invoice: <span className="text-blue-600">{selectedGroup?.invoiceNo}</span>
                </DialogTitle>
                <DialogDescription className="hidden" />
              </DialogHeader>

              {selectedGroup && (
                <div className="space-y-6">
                  {selectedGroup.rejectionNote && (
                    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      <b>Previous report was rejected.</b> {selectedGroup.rejectionNote.replace(/^Rejected:\s*/, "")}
                    </div>
                  )}
                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 space-y-1.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <p className="text-[15px] font-semibold text-slate-900 leading-snug break-words">
                        {selectedGroup.customerName}
                      </p>
                      <p className="font-mono text-[13px] font-semibold text-blue-700">{selectedGroup.doNumber}</p>
                    </div>
                    <ul className="space-y-1">
                      {selectedGroup._allProducts.map((p: any, i: number) => (
                        <li key={i} className="flex items-baseline justify-between gap-4 text-[13px] text-slate-600">
                          <span className="break-words">{p.productName || "—"}</span>
                          <span className="shrink-0 font-semibold text-slate-900">× {Number(p.actualQty) || 0}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <UnloadingForm
                    onSubmit={handleSubmit}
                    onCancel={() => setIsDialogOpen(false)}
                    isSubmitting={isProcessing || isReadOnly}
                    dispatchedQty={selectedGroup._allProducts.reduce((sum: number, p: any) => sum + (Number(p.actualQty) || 0), 0)}
                    sfgOilKg={Number(selectedGroup._allProducts[0]?.sfg_oil_kg) || null}
                  />
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </WorkflowStageShell>
  )
}
