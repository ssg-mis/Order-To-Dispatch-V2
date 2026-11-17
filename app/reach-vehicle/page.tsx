"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { WorkflowStageShell } from "@/components/workflow/workflow-stage-shell"
import { StageHistoryTab } from "@/components/workflow/stage-history-tab"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
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
import { DateTime12hField } from "@/components/ui/datetime-12h-field"
import { useObjectUrls } from "@/hooks/use-object-urls"
import { MapPin, AlertTriangle, RefreshCcw, CheckCircle, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react"
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
import { StageListHeader, StageToolbar, StageFilterSelect, StageDivider, StageColumnsMenu, StageActiveChips, StageActionBar, StagePagination, StageActionFooter } from "@/components/stage-list"
import { stageColumnChips } from "@/components/stage-list-extras"
import { StageTableHeaderRows } from "@/components/stage-table-header-rows"

// One list row per INVOICE: every product line / order of the same invoice reaches together.
const RV_COLUMNS: StageColDef<any>[] = [
  { id: "invoiceNo", label: "Invoice No.", accessor: (r) => r.invoiceNo },
  { id: "orderNo", label: "Order No.", accessor: (r) => r.orderNos.join(", ") },
  { id: "customerName", label: "Customer Name", accessor: (r) => r.customerNames.join(", ") },
  { id: "vehicleNo", label: "Vehicle No.", accessor: (r) => r.vehicleNo },
  { id: "driver", label: "Driver", accessor: (r) => r.driverName },
  { id: "transporter", label: "Transporter", accessor: (r) => r.transporterName },
  { id: "status", label: "Status", accessor: () => "Ready" },
]
const RV_COLUMN_IDS = RV_COLUMNS.map((c) => c.id)

const fmtDocDate = (v?: string | null) => {
  if (!v) return "—"
  const d = new Date(v)
  if (isNaN(d.getTime())) return "—"
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`
}

// Opens the document / link in a new tab; renders plain text when there is nothing to open.
function DocLink({ href, children }: { href?: string | null; children: React.ReactNode }) {
  if (!href) return <span className="text-slate-700">{children}</span>
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900">
      {children}
      <ExternalLink className="h-3 w-3 shrink-0" />
    </a>
  )
}

function PrevField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
      <div className="mt-0.5 break-words text-sm font-medium text-slate-800">{children}</div>
    </div>
  )
}

// Everything captured at the earlier stages for this invoice (Actual Dispatch, Make Invoice, vehicle / driver masters).
function PreviousStageDetails({ group }: { group: any }) {
  const rows: any[] = group?.rows || []
  const first = rows[0] || {}
  const dispatch = first.dispatch || {}
  const invoice = first.invoice || {}
  const vehicle = first.vehicle || first.dispatchVehicle || {}
  const driver = first.driver || first.dispatchDriver || {}
  const transporter = first.transporter || first.dispatchTransporter || {}

  const rstList = Array.from(
    new Map(rows.filter((r) => r.dispatch?.rstNo).map((r) => [r.dispatch.rstNo, r.dispatch.weightmentSlipCopy])).entries()
  )

  const today = new Date().setHours(0, 0, 0, 0)
  // Expiry comes from the Vehicle Master (current), falling back to what was recorded at dispatch.
  const docs = [
    { label: "Fitness", date: vehicle.fitness || dispatch.fitnessEndDate, img: vehicle.fitnessImage || dispatch.fitnessImage },
    { label: "Insurance", date: vehicle.insurance || dispatch.insuranceEndDate, img: vehicle.insuranceImage || dispatch.insuranceImage },
    { label: "Road Tax", date: vehicle.roadTax || vehicle.lifeTimeTax || dispatch.taxEndDate, img: vehicle.roadTaxImage || vehicle.lifeTimeTaxImage || dispatch.taxCopyImage },
    { label: "Pollution", date: vehicle.pollution || dispatch.pollutionEndDate, img: vehicle.pollutionImage || dispatch.pollutionImage },
    { label: "Permit 1 (State)", date: vehicle.statePermit || dispatch.permit1EndDate, img: vehicle.statePermitImage || dispatch.permit1Image },
    { label: "Permit 2 (National / Out State)", date: vehicle.nationalPermit || dispatch.permit2EndDate, img: vehicle.nationalPermitImage || dispatch.permit2OutStateImage },
  ]

  const card = "rounded-lg border border-slate-200 bg-white p-4"
  const title = "mb-3 text-xs font-black uppercase tracking-[0.15em] text-slate-700"
  return (
    <div className="mb-6 space-y-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">From previous stages</p>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className={card}>
          <p className={title}>Vehicle &amp; Driver Details</p>
          <div className="grid grid-cols-2 gap-3">
            <PrevField label="Vehicle No.">{vehicle.registrationNo || "—"}</PrevField>
            <PrevField label="Transporter">{transporter.transporterName || "—"}</PrevField>
            <PrevField label="Driver">{driver.driverName || "—"}</PrevField>
            <PrevField label="Driver Mobile">{driver.mobileNo || "—"}</PrevField>
            <PrevField label="GPS Tracking">
              {vehicle.gpsApiTrackingLink ? <DocLink href={vehicle.gpsApiTrackingLink}>Track vehicle{vehicle.gpsCompany ? ` (${vehicle.gpsCompany})` : ""}</DocLink> : "—"}
            </PrevField>
            <PrevField label="GPS Valid Upto">{fmtDocDate(vehicle.gpsValidUpto)}</PrevField>
          </div>
        </div>

        <div className={card}>
          <p className={title}>Invoice &amp; Details</p>
          <div className="grid grid-cols-2 gap-3">
            <PrevField label="Invoice No.">
              <DocLink href={invoice.invoiceCopy}>{invoice.invoiceNo || group?.invoiceNo || "—"}</DocLink>
            </PrevField>
            <PrevField label="Invoice Date">{fmtDocDate(invoice.invoiceDate)}</PrevField>
            <PrevField label="RST No.">
              {rstList.length > 0
                ? rstList.map(([no, slip]: any) => (
                    <span key={no} className="mr-3 inline-block"><DocLink href={slip}>{no}</DocLink></span>
                  ))
                : "—"}
            </PrevField>
            <PrevField label="E-Invoice / E-Way Bill">
              {invoice.eInvoiceFile || invoice.eWayBillFile ? (
                <span className="flex flex-wrap gap-x-3">
                  {invoice.eInvoiceFile && <DocLink href={invoice.eInvoiceFile}>E-Invoice</DocLink>}
                  {invoice.eWayBillFile && <DocLink href={invoice.eWayBillFile}>E-Way Bill</DocLink>}
                </span>
              ) : "—"}
            </PrevField>
          </div>
        </div>
      </div>

      <div className={card}>
        <p className={title}>Vehicle Expiry</p>
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((d) => {
            const expired = d.date && new Date(d.date).getTime() < today
            return (
              <div key={d.label} className="flex items-center justify-between gap-3 border-b border-slate-100 py-1.5 text-sm">
                <span className="text-slate-600">{d.label}</span>
                <span className="flex items-center gap-2">
                  <span className={expired ? "font-bold text-red-600" : "font-medium text-slate-800"}>{fmtDocDate(d.date)}</span>
                  {d.img ? <DocLink href={d.img}>View</DocLink> : <span className="text-xs text-slate-300">no file</span>}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

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
  const [selectedGroup, setSelectedGroup] = useState<any | null>(null)
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
  const [truckImageFile, setTruckImageFile] = useState<File | null>(null)
  const accidentPhotoPreviews = useObjectUrls(accidentPhotoFiles)
  // Local preview of the chosen truck photo (it is uploaded on Confirm & Save).
  const [truckImagePreview, setTruckImagePreview] = useState<string | undefined>(undefined)
  useEffect(() => {
    if (!truckImageFile || !truckImageFile.type.startsWith("image/") || /hei[cf]/i.test(truckImageFile.type)) {
      setTruckImagePreview(undefined)
      return
    }
    const url = URL.createObjectURL(truckImageFile)
    setTruckImagePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [truckImageFile])
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

  // Group the pending lines by invoice number (a line with no invoice number stays on its own).
  const data = useMemo(() => {
    const groups = new Map<string, any>()
    for (const r of pendingData?.orders || []) {
      const invoiceNo = r.reachVehicle?.invoiceNo || r.invoice?.invoiceNo || ""
      const key = invoiceNo ? `inv:${invoiceNo}` : `rv:${r.reachVehicle?.id}`
      let g = groups.get(key)
      if (!g) {
        g = {
          id: key,
          invoiceNo: invoiceNo || "—",
          rows: [] as any[],
          reachVehicleIds: [] as number[],
          orderNos: [] as string[],
          customerNames: [] as string[],
        }
        groups.set(key, g)
      }
      g.rows.push(r)
      g.reachVehicleIds.push(r.reachVehicle?.id)
      const orderNo = r.order?.orderNo
      if (orderNo && !g.orderNos.includes(orderNo)) g.orderNos.push(orderNo)
      const customer = r.customer?.customerName
      if (customer && !g.customerNames.includes(customer)) g.customerNames.push(customer)
    }
    return Array.from(groups.values()).map((g) => {
      const first = g.rows[0]
      return {
        ...g,
        vehicleNo: first.vehicle?.registrationNo || first.dispatchVehicle?.registrationNo || "",
        driverName: first.driver?.driverName || first.dispatchDriver?.driverName || "",
        transporterName: first.transporter?.transporterName || first.dispatchTransporter?.transporterName || "",
      }
    })
  }, [pendingData])

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
    if (!selectedGroup) return

    const missing: string[] = []
    if (reachMode === 'normal') {
      if (!formData.arrivalDate || !formData.arrivalTime) missing.push("Arrival Date & Time")
    } else {
      if (reachMode === 'accident') {
        if (!formData.accidentDate || !formData.accidentTime) missing.push("Date & Time of Accident")
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
      
      if (truckImageFile) {
        const response = await orderApi.uploadFile(truckImageFile)
        if (!response.success) throw new Error(response.message || "Failed to upload truck image")
        payload.truckImage = response.data.url
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

      // Submit sequentially for every line of the invoice
      for (const id of selectedGroup.reachVehicleIds) {
        await reachVehicleApi.submit(parseInt(id), payload)
      }

      toast({ title: "Success", description: "Reach Vehicle recorded successfully" })
      setIsDialogOpen(false)
      setSelectedGroup(null)
      setAccidentPhotoFiles([])
      setTruckImageFile(null)
      await refetchPending()
      queryClient.invalidateQueries({ queryKey: ["reach-vehicle-history"] })
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setIsProcessing(false)
    }
  }

  const shipAddresses = Array.from(new Set(
    (selectedGroup?.rows || [])
      .map((r: any) => r.order?.shipToAddress || r.order?.shipAddress || [r.customer?.addressLine1, r.customer?.addressLine2].filter(Boolean).join(', '))
      .filter(Boolean)
  )) as string[]

  // Clicking a row opens the Record Reach Vehicle dialog for that invoice.
  const openGroup = (group: any) => {
    setSelectedGroup(group)
    setTruckImageFile(null)
    setReachMode('normal')
    setIsDialogOpen(true)
  }

  const customerNames = Array.from(new Set(data.flatMap((r: any) => r.customerNames))) as string[]
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
      if (customerFilter !== "ALL" && !r.customerNames.includes(customerFilter)) return false
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
      case "invoiceNo":
        return <TableCell key={id} className="px-4 text-left text-xs text-green-700 font-bold font-mono whitespace-nowrap">{item.invoiceNo}</TableCell>
      case "orderNo":
        return <TableCell key={id} className="px-4 text-left text-xs text-blue-700 font-bold">{item.orderNos.join(", ") || "—"}</TableCell>
      case "customerName":
        return <TableCell key={id} className="px-4 text-left text-xs text-slate-600"><span className="font-medium text-slate-700">{item.customerNames.join(", ") || "—"}</span></TableCell>
      case "vehicleNo":
        return <TableCell key={id} className="px-4 text-left text-xs text-slate-600 whitespace-nowrap">{item.vehicleNo || "—"}</TableCell>
      case "driver":
        return <TableCell key={id} className="px-4 text-left text-xs text-slate-600">{item.driverName || "—"}</TableCell>
      case "transporter":
        return <TableCell key={id} className="px-4 text-left text-xs text-slate-600">{item.transporterName || "—"}</TableCell>
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
        <Card className="border border-slate-200/80 shadow-xs overflow-clip py-0 gap-0 stage-card">
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
                  onReorder={handleColumnReorder}
                  dragDisabled={!isAdmin && !isFeatureEnabled("can_reorder_columns")}
                />
                <TableBody>
                  {isPendingLoading && data.length === 0 ? (
                    [...Array(5)].map((_, i) => (
                      <TableRow key={i} className="opacity-40 border-b border-slate-50">
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
                          className="cursor-pointer transition-colors hover:bg-slate-50/60"
                          onClick={() => openGroup(item)}
                        >
                          {orderedVisibleCols.map((c) => renderCell(item, c.id))}
                        </TableRow>
                      )
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={orderedVisibleCols.length} className="text-center py-12 text-muted-foreground">
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
                        className="p-4 border-2 transition-all shadow-sm bg-white cursor-pointer border-slate-100 hover:border-blue-200"
                        onClick={() => openGroup(item)}
                      >
                        <div className="min-w-0 space-y-1">
                          <h3 className="text-sm font-bold text-slate-900 leading-tight break-words">{item.customerNames.join(", ")}</h3>
                        </div>

                        <div className="mt-4 flex flex-col gap-1">
                          <p className="font-mono text-sm font-black text-green-700 break-all">{item.invoiceNo}</p>
                          <p className="font-mono text-xs font-bold text-blue-700 break-all">{item.orderNos.join(", ")}</p>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 border-y border-slate-100 py-3">
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Vehicle No.</p>
                            <p className="text-xs font-bold text-slate-700">{item.vehicleNo || "—"}</p>
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
      </div>

      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setSelectedGroup(null) }}>
        <DialogContent className="w-[calc(100vw-0.75rem)] max-w-[calc(100vw-0.75rem)] sm:!max-w-[95vw] max-h-[95vh] overflow-y-auto p-0 [overflow-wrap:anywhere]">
          <div className="p-4 sm:p-6">
            <DialogHeader className="pr-8">
              <DialogTitle className="text-lg sm:text-xl font-bold text-slate-900 border-b pb-4 mb-4 leading-tight">
                Record Reach Vehicle - Invoice {selectedGroup?.invoiceNo ?? "—"}
                <span className="ml-2 text-xs font-semibold text-slate-500">
                  {selectedGroup?.customerNames?.join(", ")} · {selectedGroup?.reachVehicleIds?.length ?? 0} line(s)
                </span>
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

            {selectedGroup && <PreviousStageDetails group={selectedGroup} />}

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
                <div className="space-y-2">
                  <Label>Arrival Date &amp; Time <span className="text-red-500">*</span></Label>
                  <DateTime12hField
                    date={formData.arrivalDate}
                    time={formData.arrivalTime}
                    onChange={({ date, time }) => setFormData({ ...formData, arrivalDate: date, arrivalTime: time })}
                  />
                </div>
              )}

              <FileUploadField
                label="Upload Truck Image"
                accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif"
                variant="dropzone"
                helperText="Photo of the truck on arrival. Max file size: 20 MB"
                buttonText="Click to select truck image"
                fileName={truckImageFile?.name || ""}
                value={truckImagePreview}
                onFilesSelected={(files) => files[0] && setTruckImageFile(files[0])}
              />

              {reachMode === 'accident' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b pb-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    Accident Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2 space-y-2">
                      <Label>Date &amp; Time of Accident <span className="text-red-500">*</span></Label>
                      <DateTime12hField
                        date={formData.accidentDate}
                        time={formData.accidentTime}
                        onChange={({ date, time }) => setFormData({ ...formData, accidentDate: date, accidentTime: time })}
                      />
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
                        value={accidentPhotoPreviews}
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

            <DialogFooter className="mt-8 w-full border-t bg-slate-50/50 pt-4 sm:flex-col sm:justify-start">
              <StageActionFooter
                onCancel={() => { setIsDialogOpen(false); setSelectedGroup(null) }}
                cancelDisabled={isProcessing}
                actions={[
                  {
                    label: isProcessing ? "Processing..." : "Confirm & Save",
                    onClick: handleSubmit,
                    disabled: isProcessing || isReadOnly,
                  },
                ]}
              />
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </WorkflowStageShell>
  )
}
