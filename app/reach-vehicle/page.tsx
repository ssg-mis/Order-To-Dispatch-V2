"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { WorkflowStageShell } from "@/components/workflow/workflow-stage-shell"
import { StageHistoryTab } from "@/components/workflow/stage-history-tab"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { FileUploadField } from "@/components/file-upload-field"
import { MapPin, AlertTriangle, RefreshCcw, CheckCircle, ChevronLeft, ChevronRight } from "lucide-react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { reachVehicleApi, vehicleMasterApi, transportMasterApi, driverMasterApi, orderApi, depotApi } from "@/lib/api-service"
import { useAuth } from "@/hooks/use-auth"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { usePersistedColumns } from "@/hooks/use-persisted-columns"
import { useColumnOrder } from "@/hooks/use-column-order"
import { ColumnDragProvider } from "@/components/ui/column-drag-provider"
import { usePersistedFilters } from "@/hooks/use-persisted-filters"
import { useStageTable, type StageColDef } from "@/hooks/use-stage-table"
import { StageListHeader, StageToolbar, StageFilterSelect, StageDivider, StageColumnsMenu, StageActiveChips } from "@/components/stage-list"
import { stageColumnChips } from "@/components/stage-list-extras"
import { StageTableHeaderRows } from "@/components/stage-table-header-rows"

const RV_COLUMNS: StageColDef<any>[] = [
  { id: "orderNo", label: "Order No.", accessor: (r) => r.order?.orderNo },
  { id: "customerName", label: "Customer Name", accessor: (r) => r.customer?.customerName },
  { id: "vehicleNo", label: "Vehicle No.", accessor: (r) => r.vehicle?.registrationNo },
  { id: "driver", label: "Driver", accessor: (r) => r.driver?.driverName },
  { id: "transporter", label: "Transporter", accessor: (r) => r.transporter?.transporterName },
  { id: "status", label: "Status", accessor: () => "Ready" },
]
const RV_COLUMN_IDS = RV_COLUMNS.map((c) => c.id)

const FREIGHT_RATE_TYPES = ["PER TON", "PER LTR", "PER TIN", "PER KG", "FIXED"]

export default function ReachVehiclePage() {
  const { user, isReadOnly, isAdmin, isFeatureEnabled } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Tab is remembered permanently by the shell (persistKey); filters / quick search are session-scoped.
  // Refresh/reload only reloads data - never clears it. Reset (resetAllFilters) is the only way to clear.
  const [listView, patchListView] = usePersistedFilters("reach-vehicle", {
    quickSearch: "",
    customerFilter: "ALL",
  })
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending")
  const { quickSearch, customerFilter } = listView
  const setQuickSearch = (v: string) => patchListView({ quickSearch: v })
  const setCustomerFilter = (v: string) => patchListView({ customerFilter: v })
  const [filterValues, setFilterValues] = useState({
    status: "",
    startDate: "",
    endDate: "",
    partyName: "",
    search: "",
    manualSaudaNo: ""
  })
  const [pendingPage, setPendingPage] = useState(1)
  const limit = 20
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Master Data
  const [vehicles, setVehicles] = useState<any[]>([])
  const [transporters, setTransporters] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [depots, setDepots] = useState<any[]>([])

  // Modal State
  const [reachMode, setReachMode] = useState<'normal' | 'accident' | 'change_vehicle'>('normal')
  const [accidentPhotoFiles, setAccidentPhotoFiles] = useState<File[]>([])
  const [formData, setFormData] = useState({
    arrivalDate: new Date().toISOString().split('T')[0],
    arrivalTime: new Date().toTimeString().split(' ')[0].substring(0, 5),
    accidentDate: new Date().toISOString().split('T')[0],
    accidentTime: new Date().toTimeString().split(' ')[0].substring(0, 5),
    accidentLocation: "",
    accidentDescription: "",
    accidentCause: "",
    accidentLoss: "",
    vehicleChangeReason: "",
    vehicleId: "",
    transporterId: "",
    driverId: "",
    freightRateType: "",
    freightAmount: "",
    advanceBhadaBank: "",
    advanceBhadaDieselAdvance: "",
    advanceBhadaCash: "",
    routeDecision: "resume_delivery",
    returnDepotId: ""
  })

  useEffect(() => {
    fetchMasterData()
  }, [])

  useEffect(() => {
    setPendingPage(1)
  }, [filterValues])

  const {
    data: pendingData,
    isLoading: isPendingLoading,
    refetch: refetchPending,
  } = useQuery({
    queryKey: ["reach-vehicle-pending", filterValues, pendingPage],
    queryFn: async () => {
      const response = await reachVehicleApi.getPending({
        page: pendingPage,
        limit,
        order_no: filterValues.search,
        customer_name: filterValues.partyName === "all" ? undefined : filterValues.partyName,
        start_date: filterValues.startDate,
        end_date: filterValues.endDate,
        manual_sauda_no: filterValues.manualSaudaNo,
      })
      return response.success ? response.data : { orders: [], pagination: { total: 0, totalPages: 1 } }
    },
  })

  const data = useMemo(
    () => (pendingData?.orders || []).map((r: any) => ({ ...r, id: r.reachVehicle?.id })),
    [pendingData]
  )

  const fetchMasterData = async () => {
    try {
      const [vRes, tRes, dRes, depRes] = await Promise.all([
        vehicleMasterApi.getAll({ all: 'true' }),
        transportMasterApi.getAll({ all: 'true' }),
        driverMasterApi.getAll({ all: 'true' }),
        depotApi.getAll({ all: 'true' })
      ])
      if (vRes.success) setVehicles(vRes.data.vehicles || [])
      if (tRes.success) setTransporters(tRes.data.transporters || [])
      if (dRes.success) setDrivers(dRes.data.drivers || [])
      if (depRes.success) setDepots(depRes.data.depots || [])
    } catch (err) {
      console.error(err)
    }
  }

  const handleSubmit = async () => {
    if (selectedItems.length === 0) return

    const missing: string[] = []
    if (reachMode === 'normal') {
      if (!formData.arrivalDate) missing.push("Arrival Date")
      if (!formData.arrivalTime) missing.push("Arrival Time")
    } else {
      if (reachMode === 'accident') {
        if (!formData.accidentDate) missing.push("Date of Accident")
        if (!formData.accidentTime) missing.push("Time of Accident")
        if (!formData.accidentLocation.trim()) missing.push("Location of Accident")
        if (!formData.accidentDescription.trim()) missing.push("Accident Description")
        if (!formData.accidentCause.trim()) missing.push("Cause of Accident")
        if (!formData.accidentLoss.trim()) missing.push("Loss Occurred")
        if (accidentPhotoFiles.length === 0) missing.push("Accident Spot Photos")
      } else if (!formData.vehicleChangeReason.trim()) {
        missing.push("Reason for Change of Vehicle")
      }
      if (!formData.vehicleId) missing.push("New Vehicle")
      if (!formData.transporterId) missing.push("New Transporter")
      if (!formData.freightRateType) missing.push("Freight Rate Type")
      if (!formData.freightAmount) missing.push("Freight Amount")
      if (formData.routeDecision === 'return_to_factory' && !formData.returnDepotId) missing.push("Returning To (Depot)")
    }
    if (missing.length > 0) {
      toast({ title: "Validation Error", description: `Please fill: ${missing.join(", ")}`, variant: "destructive" })
      return
    }

    setIsProcessing(true)
    try {
      const payload: any = {
        recordType: reachMode === 'change_vehicle' ? 'vehicle_change' : reachMode,
        userId: user?.id
      }
      
      if (reachMode === 'normal') {
        payload.arrivalDate = formData.arrivalDate
        payload.arrivalTime = formData.arrivalTime
      } else if (reachMode === 'accident') {
        const uploadedPhotoUrls: string[] = []
        for (const file of accidentPhotoFiles) {
          const response = await orderApi.uploadFile(file)
          if (response.success) uploadedPhotoUrls.push(response.data.url)
        }
        payload.accidentDate = formData.accidentDate
        payload.accidentTime = formData.accidentTime
        payload.accidentLocation = formData.accidentLocation
        payload.accidentPhotos = uploadedPhotoUrls
        payload.accidentDescription = formData.accidentDescription
        payload.accidentCause = formData.accidentCause
        payload.accidentLoss = formData.accidentLoss
      } else if (reachMode === 'change_vehicle') {
        payload.vehicleChangeReason = formData.vehicleChangeReason
      }

      if (reachMode === 'accident' || reachMode === 'change_vehicle') {
        payload.vehicleId = formData.vehicleId || null
        payload.transporterId = formData.transporterId || null
        payload.driverId = formData.driverId || null
        payload.freightRateType = formData.freightRateType || null
        payload.freightAmount = formData.freightAmount || 0
        payload.advanceBhadaBank = formData.advanceBhadaBank || 0
        payload.advanceBhadaDieselAdvance = formData.advanceBhadaDieselAdvance || 0
        payload.advanceBhadaCash = formData.advanceBhadaCash || 0
        payload.routeDecision = formData.routeDecision
        payload.returnDepotId = formData.routeDecision === 'return_to_factory' ? (formData.returnDepotId || null) : null
      }

      // Submit sequentially for all selected records
      for (const id of selectedItems) {
        await reachVehicleApi.submit(parseInt(id), payload)
      }

      toast({ title: "Success", description: "Reach Vehicle recorded successfully" })
      setIsDialogOpen(false)
      setSelectedItems([])
      setAccidentPhotoFiles([])
      await refetchPending()
      queryClient.invalidateQueries({ queryKey: ["reach-vehicle-history"] })
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setIsProcessing(false)
    }
  }

  const selectedRows = data.filter((d: any) => selectedItems.includes(d.id?.toString()))
  const shipAddresses = Array.from(new Set(
    selectedRows
      .map((r: any) => r.order?.shipToAddress || r.order?.shipAddress || [r.customer?.addressLine1, r.customer?.addressLine2].filter(Boolean).join(', '))
      .filter(Boolean)
  )) as string[]

  const toggleSelectItem = (id?: string) => {
    if (!id) return
    setSelectedItems(prev => prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id])
  }

  const toggleSelectAll = () => {
    const visibleIds = table.rows.map((r: any) => r.id?.toString()).filter(Boolean) as string[]
    if (visibleIds.length > 0 && visibleIds.every((id) => selectedItems.includes(id))) setSelectedItems([])
    else setSelectedItems(visibleIds)
  }

  const customerNames = Array.from(new Set(data.map((r: any) => r.customer?.customerName).filter(Boolean))) as string[]
  const totalPages = pendingData?.pagination?.totalPages || 1

  // ── Stage list table (search / filters / sort / totals) ──
  const [visibleColumns, setVisibleColumns] = usePersistedColumns("reach-vehicle", RV_COLUMN_IDS)
  const [columnOrder, setColumnOrder] = useColumnOrder("reach-vehicle", RV_COLUMN_IDS)
  const orderedVisibleCols = useMemo(
    () => columnOrder.map((id) => RV_COLUMNS.find((c) => c.id === id)).filter((c): c is StageColDef<any> => !!c && visibleColumns.includes(c.id)),
    [columnOrder, visibleColumns]
  )
  const handleColumnReorder = useCallback(
    (newVisibleOrder: string[]) => {
      const hidden = columnOrder.filter((id) => !visibleColumns.includes(id))
      setColumnOrder([...newVisibleOrder, ...hidden])
    },
    [columnOrder, visibleColumns, setColumnOrder]
  )
  const baseFilter = useCallback(
    (r: any) => {
      if (customerFilter !== "ALL" && r.customer?.customerName !== customerFilter) return false
      const q = quickSearch.trim().toLowerCase()
      if (q && !RV_COLUMNS.some((c) => String(c.accessor?.(r) ?? "").toLowerCase().includes(q))) return false
      return true
    },
    [customerFilter, quickSearch]
  )
  const table = useStageTable({ rows: data, columns: RV_COLUMNS, baseFilter, persistKey: "reach-vehicle" })
  const activeFiltersCount = table.activeColumnFilterCount + (customerFilter !== "ALL" ? 1 : 0) + (quickSearch.trim() ? 1 : 0)
  const resetAllFilters = () => {
    patchListView({ customerFilter: "ALL", quickSearch: "" })
    table.clearColumnFilters()
  }
  const filterChips = [
    ...(customerFilter !== "ALL" ? [{ label: `Customer: ${customerFilter}`, onClear: () => setCustomerFilter("ALL") }] : []),
    ...(quickSearch.trim() ? [{ label: `Search: ${quickSearch.trim()}`, onClear: () => setQuickSearch("") }] : []),
    ...stageColumnChips(table, RV_COLUMNS),
  ]

  const renderCell = (item: any, id: string) => {
    switch (id) {
      case "orderNo":
        return <TableCell key={id} className="px-4 text-left text-xs text-blue-700 font-bold whitespace-nowrap">{item.order?.orderNo}</TableCell>
      case "customerName":
        return <TableCell key={id} className="px-4 text-left text-xs text-slate-600"><span className="font-medium text-slate-700">{item.customer?.customerName}</span></TableCell>
      case "vehicleNo":
        return <TableCell key={id} className="px-4 text-left text-xs text-slate-600 whitespace-nowrap">{item.vehicle?.registrationNo || "—"}</TableCell>
      case "driver":
        return <TableCell key={id} className="px-4 text-left text-xs text-slate-600">{item.driver?.driverName || "—"}</TableCell>
      case "transporter":
        return <TableCell key={id} className="px-4 text-left text-xs text-slate-600">{item.transporter?.transporterName || "—"}</TableCell>
      case "status":
        return (
          <TableCell key={id} className="px-4 text-left">
            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200 text-[10px] font-black whitespace-nowrap">Ready</Badge>
          </TableCell>
        )
      default:
        return null
    }
  }

  return (
    <WorkflowStageShell
      persistKey="reach-vehicle"
      partyNames={customerNames}
      title="Stage 13: Reach Vehicle"
      description="Record vehicle arrival, accidents, or vehicle changes during transit."
      pendingCount={pendingData?.pagination?.total || 0}
      historyData={[]}
      onFilterChange={setFilterValues}
      showStatusFilter={true}
      stageLevel={8}
      onTabChange={setActiveTab}
      showDateFilters={true}
      showSaudaFilter={true}
      dateLabel="DO Date"
      searchPlaceholder="Search DO Number..."
      historyContent={
        <StageHistoryTab
          queryKeyPrefix="reach-vehicle-history"
          getHistoryApi={(params: any) => reachVehicleApi.getHistory(params)}
          filterValues={filterValues}
          activeTab={activeTab}
          stageName="Reach Vehicle"
          stageLevel={8}
          remarksColName="Remarks"
          orderListKey="orders"
          mapOrderNo={(item: any) => item.order?.orderNo || "-"}
          mapCustomerName={(item: any) => item.customer?.customerName || "-"}
          mapStatus={(item: any) => item.reachVehicle?.recordType || "Reached"}
          mapRemarks={(item: any) => item.reachVehicle?.vehicleChangeReason || item.reachVehicle?.accidentDescription || "-"}
          getDate={(item: any) => item.reachVehicle?.actualAt || null}
        />
      }
    >
      <div className="space-y-4">
        {/* Action Bar */}
        <div className="flex justify-end gap-2">
          <Button
            onClick={() => setIsDialogOpen(true)}
            disabled={selectedItems.length === 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            Record Reach Vehicle ({selectedItems.length})
          </Button>
        </div>

        <Card className="border border-slate-200/80 shadow-xs overflow-hidden">
          <StageListHeader
            title="Pending Loads"
            shown={table.rows.length}
            total={data.length}
            description="Vehicles in transit ready to be marked as reached"
            searchValue={quickSearch}
            onSearchChange={setQuickSearch}
            searchPlaceholder="Search DO, Customer, Vehicle..."
          >
            <StageToolbar
              shown={table.rows.length}
              total={data.length}
              activeCount={activeFiltersCount}
              onReset={resetAllFilters}
              filters={
                <>
                  <StageFilterSelect value={customerFilter} onChange={setCustomerFilter} allLabel="All Customers" options={customerNames} className="min-w-[130px]" />
                  <StageDivider />
                  <StageColumnsMenu
                    columns={RV_COLUMNS}
                    visibleColumns={visibleColumns}
                    setVisibleColumns={setVisibleColumns}
                    show={isAdmin || isFeatureEnabled("can_toggle_columns")}
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
                  columns={orderedVisibleCols}
                  table={table}
                  leading={
                    <Checkbox
                      checked={table.rows.length > 0 && table.rows.every((r: any) => selectedItems.includes(r.id?.toString()))}
                      onCheckedChange={toggleSelectAll}
                    />
                  }
                  onReorder={handleColumnReorder}
                  dragDisabled={!isAdmin && !isFeatureEnabled("can_reorder_columns")}
                />
                <TableBody>
                  {isPendingLoading && data.length === 0 ? (
                    [...Array(5)].map((_, i) => (
                      <TableRow key={i} className="opacity-40 border-b border-slate-50">
                        <TableCell className="text-center py-4"><div className="h-4 w-4 bg-slate-200 animate-pulse rounded mx-auto" /></TableCell>
                        {orderedVisibleCols.map((c) => (
                          <TableCell key={c.id} className="text-center py-4"><div className="h-3 w-24 bg-slate-200 animate-pulse rounded-full mx-auto" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : table.rows.length > 0 ? (
                    table.rows.map((item: any) => {
                      const id = item.id?.toString()
                      return (
                        <TableRow
                          key={id}
                          className={cn(
                            "cursor-pointer transition-colors",
                            selectedItems.includes(id) ? "bg-blue-50/40" : "hover:bg-slate-50/60"
                          )}
                          onClick={() => toggleSelectItem(id)}
                        >
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <Checkbox checked={selectedItems.includes(id)} onCheckedChange={() => toggleSelectItem(id)} />
                          </TableCell>
                          {orderedVisibleCols.map((c) => renderCell(item, c.id))}
                        </TableRow>
                      )
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={orderedVisibleCols.length + 1} className="text-center py-12 text-muted-foreground">
                        {data.length === 0 ? "No orders pending for reach vehicle stage" : "No matching records found for the filters"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden max-h-[600px] overflow-y-auto p-3">
              {isPendingLoading && data.length === 0 ? (
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
                  {table.rows.map((item: any) => {
                    const id = item.id?.toString()
                    return (
                      <Card
                        key={id}
                        className={cn(
                          "p-4 border-2 transition-all shadow-sm bg-white cursor-pointer",
                          selectedItems.includes(id) ? "border-blue-500 bg-blue-50/30 shadow-md" : "border-slate-100 hover:border-blue-200"
                        )}
                        onClick={() => toggleSelectItem(id)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <h3 className="text-sm font-bold text-slate-900 leading-tight break-words">{item.customer?.customerName}</h3>
                          </div>
                          <Checkbox
                            checked={selectedItems.includes(id)}
                            onCheckedChange={() => toggleSelectItem(id)}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1 h-5 w-5"
                          />
                        </div>

                        <div className="mt-4 flex flex-col gap-1">
                          <p className="font-mono text-sm font-black text-blue-700 break-all">{item.order?.orderNo}</p>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 border-y border-slate-100 py-3">
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Vehicle No.</p>
                            <p className="text-xs font-bold text-slate-700">{item.vehicle?.registrationNo || "—"}</p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200 text-[10px] font-black">Ready</Badge>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  {data.length === 0 ? "No orders pending for reach vehicle stage" : "No matching records found for the filters"}
                  {data.length > 0 && (
                    <div className="mt-3">
                      <Button variant="outline" size="sm" onClick={resetAllFilters}>Clear Filters</Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between w-full mt-4 bg-white/50 backdrop-blur-sm p-4 rounded-2xl border border-blue-50">
          <div className="text-xs font-bold text-slate-500 bg-slate-100/50 px-4 py-2 rounded-full border border-slate-200/50">
            Page <span className="text-blue-600 px-1">{pendingPage}</span> of <span className="text-blue-600 px-1">{totalPages}</span>
            <span className="mx-2 text-slate-300">|</span>
            Total <span className="text-blue-600 px-1">{pendingData?.pagination?.total || 0}</span> Loads
          </div>
          <div className="grid grid-cols-2 gap-3 sm:flex">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPendingPage(p => Math.max(1, p - 1))}
              disabled={pendingPage === 1}
              className="h-9 rounded-xl border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all active:scale-95 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPendingPage(p => p + 1)}
              disabled={pendingPage >= totalPages}
              className="h-9 rounded-xl border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all active:scale-95 disabled:opacity-30 text-xs font-bold"
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[calc(100vw-0.75rem)] max-w-[calc(100vw-0.75rem)] sm:!max-w-[95vw] max-h-[95vh] overflow-y-auto p-0 [overflow-wrap:anywhere]">
          <div className="p-4 sm:p-6">
            <DialogHeader className="pr-8">
              <DialogTitle className="text-lg sm:text-xl font-bold text-slate-900 border-b pb-4 mb-4 leading-tight">
                Record Reach Vehicle - {selectedItems.length} Selected
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1 bg-slate-100 rounded-lg mb-6">
              <Button
                variant={reachMode === 'normal' ? 'default' : 'ghost'}
                className={reachMode === 'normal' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                onClick={() => setReachMode('normal')}
              >
                <MapPin className="h-4 w-4 mr-2" /> Normal Arrival
              </Button>
              <Button
                variant={reachMode === 'accident' ? 'default' : 'ghost'}
                className={reachMode === 'accident' ? 'bg-destructive hover:bg-destructive/90' : ''}
                onClick={() => setReachMode('accident')}
              >
                <AlertTriangle className="h-4 w-4 mr-2" /> Accident
              </Button>
              <Button
                variant={reachMode === 'change_vehicle' ? 'default' : 'ghost'}
                className={reachMode === 'change_vehicle' ? 'bg-orange-600 hover:bg-orange-700' : ''}
                onClick={() => setReachMode('change_vehicle')}
              >
                <RefreshCcw className="h-4 w-4 mr-2" /> Change of Vehicle
              </Button>
            </div>

            <div className="space-y-6">
              {reachMode === 'normal' && (
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm">
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-700 mb-1">
                    Pre-decided location — Ship-to address (as printed on the eWay Bill)
                  </p>
                  {shipAddresses.length > 0 ? (
                    shipAddresses.map((addr, i) => (
                      <p key={i} className="font-medium text-slate-800">{addr}</p>
                    ))
                  ) : (
                    <p className="text-slate-500">Ship-to address not available for the selected shipment(s).</p>
                  )}
                </div>
              )}

              {reachMode === 'normal' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Arrival Date <span className="text-red-500">*</span></Label>
                    <Input type="date" value={formData.arrivalDate} onChange={e => setFormData({ ...formData, arrivalDate: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Arrival Time <span className="text-red-500">*</span></Label>
                    <Input type="time" value={formData.arrivalTime} onChange={e => setFormData({ ...formData, arrivalTime: e.target.value })} />
                  </div>
                </div>
              )}

              {reachMode === 'accident' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b pb-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    Accident Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Date of Accident <span className="text-red-500">*</span></Label>
                      <Input type="date" value={formData.accidentDate} onChange={e => setFormData({ ...formData, accidentDate: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Time of Accident <span className="text-red-500">*</span></Label>
                      <Input type="time" value={formData.accidentTime} onChange={e => setFormData({ ...formData, accidentTime: e.target.value })} />
                    </div>
                    <div className="sm:col-span-2 space-y-2">
                      <Label>Location of Accident <span className="text-red-500">*</span></Label>
                      <Input value={formData.accidentLocation} onChange={e => setFormData({ ...formData, accidentLocation: e.target.value })} />
                    </div>
                    <div className="sm:col-span-2 space-y-2">
                      <Label>Accident Description <span className="text-red-500">*</span></Label>
                      <Textarea value={formData.accidentDescription} onChange={e => setFormData({ ...formData, accidentDescription: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Cause of Accident <span className="text-red-500">*</span></Label>
                      <Input value={formData.accidentCause} onChange={e => setFormData({ ...formData, accidentCause: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Loss Occurred <span className="text-red-500">*</span></Label>
                      <Input value={formData.accidentLoss} onChange={e => setFormData({ ...formData, accidentLoss: e.target.value })} />
                    </div>
                    <div className="sm:col-span-2 space-y-2">
                      <FileUploadField
                        label={<>Upload Accident Spot Photos <span className="text-red-500">*</span></>}
                        accept="image/*"
                        multiple
                        variant="dropzone"
                        helperText="Max file size: 20 MB"
                        buttonText="Click to select photos"
                        fileName={accidentPhotoFiles.map(f => f.name)}
                        onFilesSelected={(files) => setAccidentPhotoFiles(prev => [...prev, ...files])}
                        onRemove={(index) => setAccidentPhotoFiles(prev => prev.filter((_, i) => i !== index))}
                      />
                    </div>
                  </div>
                </div>
              )}

              {reachMode === 'change_vehicle' && (
                <div className="space-y-2">
                  <Label>Reason for Change of Vehicle <span className="text-red-500">*</span></Label>
                  <Textarea value={formData.vehicleChangeReason} onChange={e => setFormData({ ...formData, vehicleChangeReason: e.target.value })} />
                </div>
              )}

              {(reachMode === 'accident' || reachMode === 'change_vehicle') && (
                <div className="space-y-4 pt-6 border-t">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b pb-2">
                    <CheckCircle className="h-4 w-4 text-blue-600" />
                    New Transit Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>New Vehicle <span className="text-red-500">*</span></Label>
                      <Select value={formData.vehicleId} onValueChange={v => setFormData({ ...formData, vehicleId: v })}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                        <SelectContent>{vehicles.map(v => <SelectItem key={v.id} value={v.id.toString()}>{v.registration_no}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>New Transporter <span className="text-red-500">*</span></Label>
                      <Select value={formData.transporterId} onValueChange={v => setFormData({ ...formData, transporterId: v })}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Select transporter" /></SelectTrigger>
                        <SelectContent>{transporters.map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.transporter_name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Driver (Optional)</Label>
                      <Select value={formData.driverId} onValueChange={v => setFormData({ ...formData, driverId: v })}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Select driver" /></SelectTrigger>
                        <SelectContent>{drivers.map(d => <SelectItem key={d.id} value={d.id.toString()}>{d.driver_name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Freight Rate Type <span className="text-red-500">*</span></Label>
                      <Select value={formData.freightRateType} onValueChange={v => setFormData({ ...formData, freightRateType: v })}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Select type" /></SelectTrigger>
                        <SelectContent>{FREIGHT_RATE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Freight Amount <span className="text-red-500">*</span></Label>
                      <Input type="number" value={formData.freightAmount} onChange={e => setFormData({ ...formData, freightAmount: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Advance (Bank)</Label>
                      <Input type="number" value={formData.advanceBhadaBank} onChange={e => setFormData({ ...formData, advanceBhadaBank: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Advance (Cash)</Label>
                      <Input type="number" value={formData.advanceBhadaCash} onChange={e => setFormData({ ...formData, advanceBhadaCash: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Diesel Advance</Label>
                      <Input type="number" value={formData.advanceBhadaDieselAdvance} onChange={e => setFormData({ ...formData, advanceBhadaDieselAdvance: e.target.value })} />
                    </div>
                    <div className="sm:col-span-2 space-y-3 pt-2 border-t">
                      <Label className="text-sm font-bold text-slate-800">Route Decision</Label>
                      <RadioGroup value={formData.routeDecision} onValueChange={v => setFormData({ ...formData, routeDecision: v })} className="flex flex-col sm:flex-row gap-3 sm:gap-6">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="resume_delivery" id="r1" />
                          <Label htmlFor="r1" className="text-emerald-700 font-semibold cursor-pointer">Resume Delivery to Destination</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="return_to_factory" id="r2" />
                          <Label htmlFor="r2" className="text-rose-700 font-semibold cursor-pointer">Return Stock to Factory</Label>
                        </div>
                      </RadioGroup>
                      {formData.routeDecision === 'return_to_factory' && (
                        <div className="space-y-2 pt-2">
                          <Label>Returning To (Depot) <span className="text-red-500">*</span></Label>
                          <Select value={formData.returnDepotId} onValueChange={v => setFormData({ ...formData, returnDepotId: v })}>
                            <SelectTrigger className="w-full"><SelectValue placeholder="Select depot" /></SelectTrigger>
                            <SelectContent>{depots.map(d => <SelectItem key={d.id} value={d.id.toString()}>{d.depot_name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="mt-8 border-t pt-4 bg-transparent flex flex-col sm:flex-row gap-3">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isProcessing} className="h-11 sm:h-10">
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isProcessing || isReadOnly}
                className="bg-blue-600 hover:bg-blue-700 min-w-37.5 h-11 sm:h-10"
              >
                {isProcessing ? "Processing..." : "Confirm & Save"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </WorkflowStageShell>
  )
}
