"use client"

import { useRef, useState, useMemo, useCallback, useEffect } from "react"
import { WorkflowStageShell } from "@/components/workflow/workflow-stage-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { useAuthContext } from "@/contexts/auth-context"
import { gateInApi, orderApi, vehicleMasterApi, skuDetailsApi, driverMasterApi, draftApi } from "@/lib/api-service"
import { generateDispatchSlipPdf } from "@/lib/dispatch-slip-pdf-lazy"
import { Combobox } from "@/components/ui/combobox"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { StageHistoryTab } from "@/components/workflow/stage-history-tab"
import { Camera, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Truck, X, ArrowUpDown, ArrowUp, ArrowDown, Settings2, Printer, Download, Calendar as CalendarIconLucide } from "lucide-react"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from "@/components/ui/dropdown-menu"
import { ColumnToggleContent } from "@/components/ui/column-toggle-content"
import { usePersistedColumns } from "@/hooks/use-persisted-columns"
import { useColumnOrder } from "@/hooks/use-column-order"
import { SortableTableHead } from "@/components/ui/sortable-table-head"
import { StageTableHeaderRows } from "@/components/stage-table-header-rows"
import { ColumnDragProvider } from "@/components/ui/column-drag-provider"
import { usePersistedFilters } from "@/hooks/use-persisted-filters"
import { useStageTable, type StageColDef } from "@/hooks/use-stage-table"
import {
  StageListHeader, StageToolbar, StageFilterSelect, StageColumnsMenu, StageDivider,
  StageActiveChips, StageSortIcon, type StageTotalTone, StagePagination } from "@/components/stage-list"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { OrderChargesPanel } from "@/components/order-punch/order-charges-panel"
import { fmtNum, fmtDateTime } from "@/lib/table-format"

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  if (!dateStr) return "—"
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
  } catch {
    return dateStr
  }
}

const MAX_COMPRESSED_IMAGE_BYTES = 850 * 1024
const MAX_COMPRESSED_IMAGE_DIMENSION = 1600

async function compressImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file

  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement("canvas")

  const context = canvas.getContext("2d")
  if (!context) {
    bitmap.close()
    return file
  }

  const toBlob = (quality: number) =>
    new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", quality))

  let maxDimension = Math.min(MAX_COMPRESSED_IMAGE_DIMENSION, Math.max(bitmap.width, bitmap.height))
  let blob: Blob | null = null

  while (maxDimension >= 320) {
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    canvas.width = width
    canvas.height = height
    context.clearRect(0, 0, width, height)
    context.drawImage(bitmap, 0, 0, width, height)

    let quality = 0.82
    blob = await toBlob(quality)

    while (blob && blob.size > MAX_COMPRESSED_IMAGE_BYTES && quality > 0.34) {
      quality -= 0.08
      blob = await toBlob(quality)
    }

    if (blob && blob.size <= MAX_COMPRESSED_IMAGE_BYTES) break
    maxDimension -= 250
  }

  bitmap.close()

  if (!blob || blob.size > MAX_COMPRESSED_IMAGE_BYTES) return file

  const cleanName = file.name.replace(/\.[^.]+$/, "")
  return new File([blob], `${cleanName}.jpg`, { type: "image/jpeg", lastModified: Date.now() })
}

// ─── Camera Upload Card ──────────────────────────────────────────────────────

interface ImageUploadCardProps {
  label: string
  capture?: "environment" | "user" // optional camera hint
  value: string
  fileName: string
  isUploading: boolean
  required?: boolean
  onFile: (file: File) => void
  onClear: () => void
}

function ImageUploadCard({ label, capture, value, fileName, isUploading, required, onFile, onClear }: ImageUploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex flex-col items-center gap-3 bg-slate-50 border-2 border-dashed border-slate-200 hover:border-blue-300 rounded-2xl p-4 transition-colors">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</span>
        {required && <span className="text-red-500 font-black text-xs">*</span>}
      </div>

      {value ? (
        <div className="relative w-full">
          <a href={value} target="_blank" rel="noopener noreferrer">
            <img
              src={value}
              alt={label}
              className="w-full h-40 object-cover rounded-xl border border-slate-200 hover:opacity-90 transition-opacity cursor-zoom-in"
            />
          </a>
          <button
            type="button"
            onClick={onClear}
            className="absolute top-1 right-1 bg-red-500 text-white rounded-full h-6 w-6 flex items-center justify-center shadow-md hover:bg-red-600 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
          <p className="text-[10px] text-slate-500 font-semibold mt-1 text-center truncate">{fileName}</p>
        </div>
      ) : (
        <button
          type="button"
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center gap-2 w-full h-40 justify-center rounded-xl border-2 border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-300 transition-colors text-slate-400 hover:text-blue-500"
        >
          {isUploading ? (
            <Loader2 className="h-8 w-8 animate-spin" />
          ) : (
            <>
              <Camera className="h-8 w-8" />
              <span className="text-xs font-bold">Tap to open camera</span>
              <span className="text-[10px] font-medium text-slate-400">or choose from gallery</span>
            </>
          )}
        </button>
      )}

      {/* Hidden file input — capture attribute opens camera on mobile */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture={capture}
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          e.target.value = "" // allow re-selecting same file
        }}
      />
    </div>
  )
}

const PAGE_COLUMNS = [
  { id: "partySoDate",           label: "DO Date" },
  { id: "orderNo",               label: "DO Number" },
  { id: "deliveryPurpose",       label: "Order Type (Delivery Purpose)" },
  { id: "orderType",             label: "Order Type" },
  { id: "customerType",          label: "Customer Type" },
  { id: "customerName",          label: "Customer Name" },
  { id: "startDate",             label: "Start Date" },
  { id: "endDate",               label: "End Date" },
  { id: "deliveryDate",          label: "Delivery Date" },
  { id: "oilType",               label: "Oil Type" },
  { id: "ratePer15Kg",           label: "Rate Per 15 kg (₹)" },
  { id: "ratePerLtr",            label: "Rate Per Ltr. (₹)" },
  { id: "productName",           label: "Product Name" },
  { id: "products",              label: "Products (Items)" },
  { id: "uom",                   label: "UOM" },
  { id: "orderQty",              label: "Order Qty" },
  { id: "altUom",                label: "Alt UOM" },
  { id: "altQty",                label: "Alt Qty (Kg)" },
  { id: "rateOfMaterial",        label: "Rate of Material (₹)" },
  { id: "rate",                  label: "Rate (₹)" },
  { id: "skuName",               label: "SKU Name" },
  { id: "approvalQty",           label: "Approval Qty" },
  { id: "qtyToDispatch",         label: "Qty to Dispatch" },
  { id: "deliveryFrom",          label: "Delivery From" },
  { id: "processId",             label: "Manual Sauda No." },
  { id: "vehicle_no",            label: "Vehicle No." },
  { id: "driver_name",           label: "Driver Name" },
  { id: "totalWithGst",          label: "Total Amount with GST (₹)" },
  { id: "transportType",         label: "Type of Transporting" },
  { id: "contactPerson",         label: "Customer Contact Person Name" },
  { id: "whatsapp",              label: "Customer Contact Person Whatsapp No." },
  { id: "address",               label: "Customer Address" },
  { id: "paymentTerms",          label: "Payment Terms" },
  { id: "advanceTaken",          label: "Advance Payment to be Taken" },
  { id: "advanceAmount",         label: "Advance Amount (₹)" },
  { id: "isBroker",              label: "Is this order Through Broker" },
  { id: "brokerName",            label: "Broker Name (If Order Through Broker)" },
  { id: "orderPunchRemarks",     label: "Order Punch Remarks" },
  { id: "remark",                label: "Remark" },
  { id: "saved_by",              label: "Saved By" },
  { id: "saved_at",              label: "Saved At" },
] as const
type ColId = typeof PAGE_COLUMNS[number]["id"]

// Maps camelCase column IDs to the snake_case backend field names returned by the
// gate-in pending API (via the LATERAL join with lrc + order_dispatch).
const COL_FIELD_MAP: Partial<Record<ColId, string>> = {
  partySoDate:           "party_so_date",
  orderNo:               "so_no",
  processId:             "processid",
  deliveryPurpose:       "order_type_delivery_purpose",
  orderType:             "order_type",
  customerType:          "customer_type",
  startDate:             "start_date",
  endDate:               "end_date",
  deliveryDate:          "delivery_date",
  customerName:          "party_name",
  oilType:               "oil_type",
  ratePer15Kg:           "rate_per_15kg",
  ratePerLtr:            "rate_per_ltr",
  rateOfMaterial:        "rate_of_material",
  rate:                  "final_rate",
  productName:           "product_name",
  uom:                   "uom",
  orderQty:              "order_quantity",
  altUom:                "alternate_uom",
  altQty:                "alternate_qty_kg",
  skuName:               "sku_name",
  approvalQty:           "approval_qty",
  qtyToDispatch:         "qty_to_be_dispatched",
  deliveryFrom:          "dispatch_from",
  totalWithGst:          "total_amount_with_gst",
  transportType:         "type_of_transporting",
  contactPerson:         "customer_contact_person_name",
  whatsapp:              "customer_contact_person_whatsapp_no",
  address:               "customer_address",
  paymentTerms:          "payment_terms",
  advanceTaken:          "advance_payment_to_be_taken",
  advanceAmount:         "advance_amount",
  isBroker:              "is_order_through_broker",
  brokerName:            "broker_name",
  orderPunchRemarks:     "order_punch_remarks",
  remark:                "remarks",
}
const DATE_COL_IDS = new Set<ColId>(["partySoDate", "startDate", "endDate", "deliveryDate"])
const BOOL_COL_IDS = new Set<ColId>(["advanceTaken", "isBroker"])
const NUMBER_COL_IDS = new Set<ColId>(["ratePer15Kg", "ratePerLtr", "rateOfMaterial", "rate", "orderQty", "altQty", "approvalQty", "qtyToDispatch", "totalWithGst", "advanceAmount"])
const GATE_RIGHT_COLS = new Set<string>([...DATE_COL_IDS, ...NUMBER_COL_IDS, "saved_at", "products"])
const GATE_DECIMALS: Record<string, number> = {
  ratePer15Kg: 2, ratePerLtr: 2, rateOfMaterial: 2, rate: 2, totalWithGst: 2, advanceAmount: 2,
  orderQty: 4, altQty: 4, approvalQty: 4, qtyToDispatch: 4, products: 0,
}
const gateMinW = (id: string) => (GATE_RIGHT_COLS.has(id) ? "min-w-[130px]" : "")
const TOTAL_COL_TONES: Record<string, StageTotalTone> = {
  altQty: "blue",
  totalWithGst: "emerald", advanceAmount: "emerald",
}

// One table row = one vehicle/date group of gate-in records.
interface GateGroup {
  key: string
  vehicleNumber: string
  date: string
  records: any[]
  first: any
  orderKeys: string[]
}

const gateAccessor = (colId: ColId) => (g: GateGroup): string | number | null => {
  const first = g.first
  switch (colId) {
    case "orderNo": return g.orderKeys.join(", ")
    case "vehicle_no": return first.draft_data?.vehicleNumber || ""
    case "driver_name": return first.draft_data?.driverName || ""
    case "saved_by": return first.username || ""
    case "saved_at": return first.saved_at || null
    case "products": return first.draft_data?.dialogSelectedProducts?.length || 0
    default: {
      const f = COL_FIELD_MAP[colId]
      if (!f) return null
      const v = first[f]
      if (BOOL_COL_IDS.has(colId)) return v ? "Yes" : "No"
      if (v === undefined || v === null) return null
      if (NUMBER_COL_IDS.has(colId)) return parseFloat(v) || 0
      return v
    }
  }
}

const GATE_TABLE_COLUMNS: StageColDef<GateGroup>[] = PAGE_COLUMNS.map(c => ({
  id: c.id,
  label: c.label,
  type: DATE_COL_IDS.has(c.id) || c.id === "saved_at" ? "date" : (NUMBER_COL_IDS.has(c.id) || c.id === "products") ? "number" : "text",
  accessor: gateAccessor(c.id),
  total: TOTAL_COL_TONES[c.id] !== undefined,
}))

export default function GateInPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { isReadOnly, user, isAdmin, isFeatureEnabled } = useAuth()
  const { refreshUser } = useAuthContext()

  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending")
  const [pendingPage, setPendingPage] = useState(1)
  const limit = 20

  const [filterValues, setFilterValues] = useState({
    search: "",
    status: "",
    startDate: "",
    endDate: "",
    partyName: "",
    manualSaudaNo: ""
  })

  useEffect(() => {
    setPendingPage(1)
  }, [filterValues])

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<any>(null)
  const [selectedGroupKeys, setSelectedGroupKeys] = useState<string[]>([])
  const [selectedGroupRecords, setSelectedGroupRecords] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [revertRemarks, setRevertRemarks] = useState("")

  // Vehicle master state
  const [vehicleData, setVehicleData] = useState<any>(null)
  const [isLoadingVehicle, setIsLoadingVehicle] = useState(false)

  // Image state
  const [frontVehicleImage, setFrontVehicleImage] = useState("")
  const [frontVehicleFileName, setFrontVehicleFileName] = useState("")
  const [frontVehicleFile, setFrontVehicleFile] = useState<File | null>(null)
  const [backVehicleImage, setBackVehicleImage] = useState("")
  const [backVehicleFileName, setBackVehicleFileName] = useState("")
  const [backVehicleFile, setBackVehicleFile] = useState<File | null>(null)
  const [driverPhoto, setDriverPhoto] = useState("")
  const [driverPhotoFileName, setDriverPhotoFileName] = useState("")
  const [driverPhotoFile, setDriverPhotoFile] = useState<File | null>(null)
  const [gatepassPhoto, setGatepassPhoto] = useState("")
  const [gatepassPhotoFileName, setGatepassPhotoFileName] = useState("")
  const [gatepassPhotoFile, setGatepassPhotoFile] = useState<File | null>(null)
  const [uploadingField, setUploadingField] = useState<string | null>(null)

  // Check if photos are mandatory for the current user (configured in Settings -> Edit User Access -> Features)
  const isPhotosMandatory = Boolean(user?.features?.gate_in_photos_mandatory)

  // Masters for editing vehicle/driver
  const [vehicleMasterList, setVehicleMasterList] = useState<any[]>([])
  const [driverMasterList, setDriverMasterList] = useState<any[]>([])
  const [editableVehicle, setEditableVehicle] = useState("")
  const [editableDriver, setEditableDriver] = useState("")

  useEffect(() => {
    vehicleMasterApi.getAll({ all: "true" }).then(res => {
      const data = res?.data?.vehicles || res?.vehicles || res?.data || res;
      setVehicleMasterList(Array.isArray(data) ? data : [])
    }).catch(() => setVehicleMasterList([]))
    
    driverMasterApi.getAll({ all: "true" }).then(res => {
      const data = res?.data?.drivers || res?.drivers || res?.data || res;
      setDriverMasterList(Array.isArray(data) ? data : [])
    }).catch(() => setDriverMasterList([]))
  }, [])

  // Vehicle dropdown: only the vehicles attached to the DO's transporter (primary
  // or additional). With no transporter on the DO, or while it loads, all vehicles.
  const doTransporterName: string = selectedRecord?.draft_data?.transporterName || ""
  const [transporterVehicles, setTransporterVehicles] = useState<any[] | null>(null)
  useEffect(() => {
    if (!isDialogOpen || !doTransporterName) { setTransporterVehicles(null); return }
    let cancelled = false
    setTransporterVehicles(null)
    vehicleMasterApi.getAll({ all: "true", transporter_name: doTransporterName }).then(res => {
      if (cancelled) return
      const list = res?.data?.vehicles
      setTransporterVehicles(Array.isArray(list) ? list : null)
    }).catch(() => { if (!cancelled) setTransporterVehicles(null) })
    return () => { cancelled = true }
  }, [isDialogOpen, doTransporterName])

  const vehicleOptions = useMemo(() => {
    const source = transporterVehicles ?? (Array.isArray(vehicleMasterList) ? vehicleMasterList : [])
    const options = source
      .filter(v => v.registration_no && v.status === "Active")
      .map(v => ({ value: v.registration_no, label: v.registration_no }))
    // keep the currently chosen vehicle selectable even if it isn't in the filtered set
    if (editableVehicle && !options.some(o => o.value === editableVehicle)) {
      options.push({ value: editableVehicle, label: editableVehicle })
    }
    return options.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base", numeric: true }))
  }, [transporterVehicles, vehicleMasterList, editableVehicle])

  const driverOptions = useMemo(() => (
    (Array.isArray(driverMasterList) ? driverMasterList : [])
      .filter(d => d.driver_name && d.status === "Active")
      .map(d => ({ value: d.driver_name, label: d.driver_name, subLabel: [d.mobile_no, d.driving_licence_no].filter(Boolean).join(" · ") }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base", numeric: true }))
  ), [driverMasterList])

  // ── Pending ────────────────────────────────────────────────────────────────
  const {
    data: pendingResult,
    isLoading: isPendingLoading,
    refetch: refetchPending,
  } = useQuery({
    queryKey: ["gate-in-pending", pendingPage, filterValues.search],
    queryFn: async () => {
      const res = await gateInApi.getPending({ page: pendingPage, limit, search: filterValues.search })
      return res.success ? res.data : { records: [], pagination: { total: 0 } }
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  })

  const pendingRecords: any[] = pendingResult?.records || []

  // ── SKU weight lookup ──────────────────────────────────────────────────────
  const { data: skuDetailsData } = useQuery({
    queryKey: ["sku-details-all"],
    queryFn: async () => {
      const res = await skuDetailsApi.getAll({ all: "true" })
      return res.success ? res.data?.skuDetails ?? [] : []
    },
    staleTime: 5 * 60 * 1000,
  })
  const skuWeightMap = useMemo(() => {
    const map = new Map<string, string>()
    if (Array.isArray(skuDetailsData)) {
      for (const sku of skuDetailsData) {
        if (sku.sku_name) {
          map.set(sku.sku_name.trim().toLowerCase(), sku.sku_weight ? String(sku.sku_weight) : "")
        }
      }
    }
    return map
  }, [skuDetailsData])

  const skuGrossWeightMap = useMemo(() => {
    const map = new Map<string, string>()
    if (Array.isArray(skuDetailsData)) {
      for (const sku of skuDetailsData) {
        if (sku.sku_name) {
          // Same rule as Plan Vehicle: the SKU's gross weight, else its plain weight when gross isn't set.
          const gross = parseFloat(sku.gross_weight) > 0 ? sku.gross_weight : sku.sku_weight
          map.set(sku.sku_name.trim().toLowerCase(), gross ? String(gross) : "")
        }
      }
    }
    return map
  }, [skuDetailsData])



  // ── Select helpers ─────────────────────────────────────────────────────────

  // ── Pending table: one row per vehicle/date group, with shared column search / sort / totals ──
  // Session-scoped (usePersistedFilters): survives refresh, cleared on a new session. Refresh only reloads data.
  const [listView, patchListView] = usePersistedFilters("gate-in", {
    quickSearch: "",
    vehicleFilter: "ALL",
    driverFilter: "ALL",
    customerFilter: "ALL",
  })
  const { quickSearch, vehicleFilter, driverFilter, customerFilter } = listView
  const setQuickSearch = (v: string) => patchListView({ quickSearch: v })
  const setVehicleFilter = (v: string) => patchListView({ vehicleFilter: v })
  const setDriverFilter = (v: string) => patchListView({ driverFilter: v })
  const setCustomerFilter = (v: string) => patchListView({ customerFilter: v })

  const allGroups = useMemo<GateGroup[]>(() => {
    const groups = new Map<string, GateGroup>()
    for (const record of pendingRecords) {
      const vehicleNo = record.draft_data?.vehicleNumber || "—"
      const dateOnly = record.saved_at
        ? new Date(record.saved_at).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
        : "—"
      const key = `${vehicleNo}|${dateOnly}`
      if (!groups.has(key)) groups.set(key, { key, vehicleNumber: vehicleNo, date: dateOnly, records: [], first: record, orderKeys: [] })
      const g = groups.get(key)!
      g.records.push(record)
      g.orderKeys.push(record.order_key)
    }
    return Array.from(groups.values())
  }, [pendingRecords])

  const uniqueVehicles = useMemo(() => Array.from(new Set(allGroups.map(g => g.first.draft_data?.vehicleNumber).filter(Boolean))).sort() as string[], [allGroups])
  const uniqueDrivers = useMemo(() => Array.from(new Set(allGroups.map(g => g.first.draft_data?.driverName).filter(Boolean))).sort() as string[], [allGroups])
  const uniqueCustomers = useMemo(() => Array.from(new Set(allGroups.flatMap(g => g.records.map((r: any) => r.party_name)).filter(Boolean))).sort() as string[], [allGroups])

  const baseFilter = useCallback((g: GateGroup) => {
    if (vehicleFilter !== "ALL" && g.first.draft_data?.vehicleNumber !== vehicleFilter) return false
    if (driverFilter !== "ALL" && g.first.draft_data?.driverName !== driverFilter) return false
    if (customerFilter !== "ALL" && !g.records.some((r: any) => r.party_name === customerFilter)) return false
    const q = quickSearch.trim().toLowerCase()
    if (q) {
      const hay = [
        ...g.orderKeys,
        g.first.draft_data?.vehicleNumber,
        g.first.draft_data?.driverName,
        g.first.username,
        ...g.records.map((r: any) => r.party_name),
      ].filter(Boolean).join(" ").toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  }, [vehicleFilter, driverFilter, customerFilter, quickSearch])

  const table = useStageTable<GateGroup>({ rows: allGroups, columns: GATE_TABLE_COLUMNS, baseFilter, persistKey: "gate-in" })
  const groupedPendingRecords = table.rows
  const filteredRecords = useMemo(() => groupedPendingRecords.flatMap(g => g.records), [groupedPendingRecords])

  const activeFiltersCount =
    (vehicleFilter !== "ALL" ? 1 : 0) + (driverFilter !== "ALL" ? 1 : 0) + (customerFilter !== "ALL" ? 1 : 0) +
    (quickSearch.trim() ? 1 : 0) + table.activeColumnFilterCount
  const clearAllFilters = () => {
    patchListView({ vehicleFilter: "ALL", driverFilter: "ALL", customerFilter: "ALL", quickSearch: "" })
    table.clearColumnFilters()
  }

  const [visibleColumns, setVisibleColumns] = usePersistedColumns("gate-in", ["partySoDate", "orderNo", "vehicle_no", "driver_name", "saved_by", "saved_at", "products"])
  const [columnOrder, setColumnOrder] = useColumnOrder("gate-in", PAGE_COLUMNS.map(c => c.id))
  const orderedVisibleCols = useMemo(() =>
    columnOrder
      .map(id => PAGE_COLUMNS.find(c => c.id === id))
      .filter((c): c is typeof PAGE_COLUMNS[number] => !!c && visibleColumns.includes(c.id as ColId)),
    [columnOrder, visibleColumns]
  )
  const totalsColumns = useMemo<StageColDef<GateGroup>[]>(
    () => [{ id: "__sel", label: "" }, ...orderedVisibleCols.map(c => GATE_TABLE_COLUMNS.find(t => t.id === c.id)!)],
    [orderedVisibleCols]
  )
  const handleColumnReorder = useCallback((newVisibleOrder: string[]) => {
    const hiddenCols = columnOrder.filter(id => !visibleColumns.includes(id as ColId))
    setColumnOrder([...newVisibleOrder, ...hiddenCols])
  }, [columnOrder, visibleColumns, setColumnOrder])

  // ── Open the Gate In form for a clicked row (its whole DO group) ──────────
  const openGateInGroup = (group: { records: any[] }) => {
    if (isReadOnly) return
    const groupRecs = group.records
    if (groupRecs.length === 0) return
    handleOpenDialog(groupRecs[0], groupRecs.map((r: any) => r.order_key), groupRecs)
    setEditableVehicle(groupRecs[0]?.draft_data?.vehicleNumber || "")
    setEditableDriver(groupRecs[0]?.draft_data?.driverName || "")
  }

  // ── Open dialog ────────────────────────────────────────────────────────────
  const handleOpenDialog = (record: any, groupKeys: string[] = [record.order_key], groupRecords: any[] = [record]) => {
    refreshUser?.()
    setRevertRemarks("")
    setSelectedRecord(record)
    setSelectedGroupKeys(groupKeys)
    setSelectedGroupRecords(groupRecords)
    setFrontVehicleImage("")
    setFrontVehicleFileName("")
    setFrontVehicleFile(null)
    setBackVehicleImage("")
    setBackVehicleFileName("")
    setBackVehicleFile(null)
    setDriverPhoto("")
    setDriverPhotoFileName("")
    setDriverPhotoFile(null)
    setGatepassPhoto("")
    setGatepassPhotoFileName("")
    setGatepassPhotoFile(null)
    setVehicleData(null)
    setIsDialogOpen(true)

    const vehicleNo = record?.draft_data?.vehicleNumber
    if (vehicleNo) {
      setIsLoadingVehicle(true)
      vehicleMasterApi.getAll({ search: vehicleNo, all: "true" })
        .then(res => {
          if (res.success && res.data?.vehicles?.length > 0) {
            const match = res.data.vehicles.find((v: any) =>
              v.registration_no?.toUpperCase() === vehicleNo.toUpperCase()
            ) || res.data.vehicles[0]
            setVehicleData(match)
          } else {
            setVehicleData(null)
          }
        })
        .catch(() => setVehicleData(null))
        .finally(() => setIsLoadingVehicle(false))
    }
  }

  // ── Image helpers ──────────────────────────────────────────────────────────
  const selectImage = (
    file: File,
    currentPreview: string,
    setPreview: (u: string) => void,
    setName: (n: string) => void,
    setFile: (f: File | null) => void
  ) => {
    if (currentPreview.startsWith("blob:")) URL.revokeObjectURL(currentPreview)
    const previewUrl = URL.createObjectURL(file)
    setPreview(previewUrl)
    setName(file.name)
    setFile(file)
  }

  const clearImage = (
    previewUrl: string,
    setPreview: (u: string) => void,
    setName: (n: string) => void,
    setFile: (f: File | null) => void
  ) => {
    if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl)
    setPreview("")
    setName("")
    setFile(null)
  }

  const uploadSelectedImage = async (file: File | null, fieldKey: string) => {
    if (!file) return undefined

    setUploadingField(fieldKey)
    try {
      const uploadFile = await compressImageForUpload(file)
      const res = await orderApi.uploadFile(uploadFile)
      if (res.success) {
        return res.data.url
      } else {
        throw new Error(res.message)
      }
    } catch (err: any) {
      throw new Error(err?.message || "Failed to upload image.")
    } finally {
      setUploadingField(null)
    }
  }



  
const buildSlipParties = () => {
    const partyGroups: Record<string, any[]> = {}
    selectedGroupRecords.forEach(r => {
      const pName = r.party_name || "Unknown Party"
      if (!partyGroups[pName]) partyGroups[pName] = []
      partyGroups[pName].push(r)
    })

    return Object.entries(partyGroups).map(([party, partyRecords]) => {
      const firstRec = partyRecords[0]
      const draft = firstRec.draft_data || {}
      
      const referenceLabel = firstRec.order_through === "Broker" ? "Broker" : firstRec.order_through === "Salesperson" ? "Salesperson" : ""
      const referenceValue = firstRec.order_through === "Broker" 
        ? (firstRec.broker_name || "—") 
        : firstRec.order_through === "Salesperson" 
          ? (firstRec.salesperson_name || "—") 
          : "Direct"

      return {
        party,
        commitmentNo: firstRec.base_do_no || firstRec.order_key || "—",
        date: new Date().toLocaleDateString('en-GB'),
        referenceLabel,
        referenceValue,
        place: firstRec.delivery_address || "—",
        partyMo: firstRec.whatsapp_no || "—",
        status: "Original",
        processId: firstRec.process_id || "—",
        punchBy: draft.order_punch_user || "—",
        punchAt: draft.order_punch_at || null,
        preApproveBy: draft.pre_approval_user || "—",
        preApproveAt: draft.pre_approval_at || null,
        approveBy: draft.order_approval_user || "—",
        approveAt: draft.order_approval_at || null,
        products: partyRecords.map(r => {
          const qty = parseFloat(r.qty_to_be_dispatched) || 0
          const skuWt = parseFloat(skuWeightMap.get(r.product_name?.trim().toLowerCase()) || "") || 0
          const skuGrossWt = parseFloat(skuGrossWeightMap.get(r.product_name?.trim().toLowerCase()) || "") || 0
          
          return {
            productName: r.product_name || "—",
            uom: r.uom || "PCS",
            qty,
            weight: skuWt * qty,
            grossWeight: (skuGrossWt > 0 ? skuGrossWt : skuWt) * qty
          }
        })
      }
    })
  }

  const handleDownloadSlip = () => {
    if (!selectedRecord) return
    generateDispatchSlipPdf(buildSlipParties(), "gate-pass.pdf", { title: "Gate Pass" })
  }

  const handlePrintSlip = () => {
    if (!selectedRecord) return
    generateDispatchSlipPdf(buildSlipParties(), "gate-pass.pdf", { print: true, title: "Gate Pass" })
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!selectedRecord) return

    if (!editableVehicle.trim()) {
      toast({
        title: "Vehicle No. is required",
        description: "Select a Vehicle No. before completing Gate In (mandatory when only a Transporter was chosen at Plan Vehicle).",
        variant: "destructive",
      })
      return
    }

    if (isPhotosMandatory) {
      const missing: string[] = []
      if (!frontVehicleFile && !frontVehicleImage) missing.push("Front Vehicle Image")
      if (!backVehicleFile && !backVehicleImage) missing.push("Back Vehicle Image")
      if (!driverPhotoFile && !driverPhoto) missing.push("Driver Photo")
      if (!gatepassPhotoFile && !gatepassPhoto) missing.push("Vehicle Gate Pass")

      if (missing.length > 0) {
        toast({
          title: "Photos are Compulsory",
          description: `Please upload all required photos before confirming Gate In: ${missing.join(", ")}.`,
          variant: "destructive"
        })
        return
      }
    }

    setIsProcessing(true)
    try {
      const [
        uploadedFrontVehicleImage,
        uploadedBackVehicleImage,
        uploadedDriverPhoto,
        uploadedGatepassPhoto,
      ] = await Promise.all([
        uploadSelectedImage(frontVehicleFile, "front"),
        uploadSelectedImage(backVehicleFile, "back"),
        uploadSelectedImage(driverPhotoFile, "driver"),
        uploadSelectedImage(gatepassPhotoFile, "gatepass"),
      ])


      // First update draft with new vehicle/driver
      if (editableVehicle || editableDriver) {
        await Promise.all(selectedGroupKeys.map(orderKey => {
          const rec = selectedGroupRecords.find(r => r.order_key === orderKey)
          const newDraft = { ...(rec?.draft_data || {}), vehicleNumber: editableVehicle, driverName: editableDriver }
          return draftApi.save(user?.username || "system", orderKey, newDraft)
        }))
      }

      const results = await Promise.allSettled(

        selectedGroupKeys.map(orderKey =>
          gateInApi.submit({
            orderKey,
            username: user?.username || "system",
            frontVehicleImage: uploadedFrontVehicleImage,
            backVehicleImage: uploadedBackVehicleImage,
            driverPhoto: uploadedDriverPhoto,
            gatepassPhoto: uploadedGatepassPhoto,
            vehicleNumber: editableVehicle,
            driverName: editableDriver,
          }).then(res => {
            if (!res.success) throw new Error(res.message)
            return orderKey
          })
        )
      )

      const failed = results
        .map((r, i) => r.status === "rejected" ? selectedGroupKeys[i] : null)
        .filter(Boolean) as string[]
      const succeeded = results
        .map((r, i) => r.status === "fulfilled" ? selectedGroupKeys[i] : null)
        .filter(Boolean) as string[]

      await refetchPending()
      queryClient.invalidateQueries({ queryKey: ["gate-in-history"] })

      if (failed.length > 0) {
        const failMsg = failed.length === selectedGroupKeys.length
          ? "All gate-in submissions failed. Please try again."
          : `Partial failure — submitted: ${succeeded.join(", ")}. Failed: ${failed.join(", ")}. Please retry the failed orders.`
        toast({ title: "Gate-In Incomplete", description: failMsg, variant: "destructive" })
        return
      }

      toast({ title: "Gate-In Submitted", description: `${succeeded.length > 1 ? `Orders ${succeeded.join(", ")}` : `Order ${succeeded[0]}`} gate-in recorded.` })
      setIsDialogOpen(false)
    } catch (err: any) {
      await refetchPending()
      toast({ title: "Submission Failed", description: err?.message || "Could not submit gate-in.", variant: "destructive" })
    } finally {
      setIsProcessing(false)
    }
  }

  // ── Revert to Plan Vehicle (one stage back), remarks mandatory ────────────
  const handleRevert = async () => {
    if (!revertRemarks.trim()) {
      toast({ title: "Validation Error", description: "Revert remarks are required", variant: "destructive" })
      return
    }
    setIsProcessing(true)
    try {
      const results = await Promise.allSettled(
        selectedGroupKeys.map(orderKey =>
          gateInApi.revertToPlanVehicle(orderKey, revertRemarks.trim()).then(res => {
            if (!res.success) throw new Error(res.message)
            return orderKey
          })
        )
      )
      const failed = results.map((r, i) => (r.status === "rejected" ? selectedGroupKeys[i] : null)).filter(Boolean) as string[]
      const succeeded = results.map((r, i) => (r.status === "fulfilled" ? selectedGroupKeys[i] : null)).filter(Boolean) as string[]

      await refetchPending()
      queryClient.invalidateQueries({ queryKey: ["plan-vehicle-pending"] })

      if (failed.length > 0) {
        const firstError = results.find(r => r.status === "rejected") as PromiseRejectedResult | undefined
        toast({
          title: "Revert Incomplete",
          description: failed.length === selectedGroupKeys.length
            ? (firstError?.reason?.message || "Could not revert to Plan Vehicle.")
            : `Reverted: ${succeeded.join(", ")}. Failed: ${failed.join(", ")}.`,
          variant: "destructive",
        })
        return
      }
      toast({ title: "Revert Successful", description: `${succeeded.length > 1 ? `Orders ${succeeded.join(", ")}` : `Order ${succeeded[0]}`} sent back to Plan Vehicle.` })
      setRevertRemarks("")
      setIsDialogOpen(false)
    } catch (err: any) {
      toast({ title: "Revert Failed", description: err?.message || "Could not revert to Plan Vehicle.", variant: "destructive" })
    } finally {
      setIsProcessing(false)
    }
  }

  // ── Draft data helpers ─────────────────────────────────────────────────────
  const getDraftField = (record: any, path: string) => {
    try {
      const parts = path.split(".")
      let val: any = record?.draft_data
      for (const p of parts) val = val?.[p]
      return val ?? "—"
    } catch {
      return "—"
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <WorkflowStageShell
      persistKey="gate-in"
      rememberTab={false}
      title="Stage 6: Gate In"
      description="Record vehicle gate-in photos before Actual Dispatch confirmation."
      pendingCount={pendingRecords.length}
      historyData={[]}
      onFilterChange={setFilterValues}
      onTabChange={setActiveTab}
      showDateFilters={false}
      historyContent={
        <StageHistoryTab
          queryKeyPrefix="gate-in-history"
          getHistoryApi={async (params: any) => {
            const res = await gateInApi.getHistory({ page: params.page, limit: params.limit })
            const list = res?.data?.records
            if (!Array.isArray(list)) return res
            // Shape each record for the "View" audit dialog (draft_data carries the vehicle / driver chosen at Gate In).
            return {
              ...res,
              data: {
                ...res.data,
                records: list.map((r: any) => ({
                  ...r,
                  gate_in_do: r.order_key,
                  gate_in_vehicle_no: r.draft_data?.vehicleNumber ?? null,
                  gate_in_driver_name: r.draft_data?.driverName ?? null,
                  gate_in_by: r.username,
                  gate_in_at: r.submitted_at,
                })),
              },
            }
          }}
          filterValues={{
            search: "",
            partyName: "all",
            startDate: "",
            endDate: "",
          }}
          activeTab={activeTab}
          stageName="Gate In"
          stageLevel={12}
          remarksColName="Remarks"
          orderListKey="records"
          mapOrderNo={(r: any) => r.order_key}
          mapCustomerName={(r: any) => r.draft_data?.vehicleNumber || r.order_key}
          mapRemarks={(r: any) => `Gate-In by ${r.username}`}
          getDate={(r: any) => r.submitted_at || null}
        />
      }
    >
      <div className="space-y-4">
        <Card className="border border-slate-200/80 shadow-xs overflow-hidden py-0 gap-0 stage-card">
          <StageListHeader
            title="Gate In List"
            shown={groupedPendingRecords.length}
            total={allGroups.length}
            description="Vehicles waiting for gate-in photos"
            searchValue={quickSearch}
            onSearchChange={setQuickSearch}
            searchPlaceholder="Search DO, Vehicle, Driver..."
          >
            <StageToolbar
              shown={groupedPendingRecords.length}
              total={allGroups.length}
              activeCount={activeFiltersCount}
              onReset={clearAllFilters}
              filters={
                <>
                  <StageFilterSelect value={vehicleFilter} onChange={setVehicleFilter} allLabel="All Vehicles" options={uniqueVehicles} />
                  <StageFilterSelect value={driverFilter} onChange={setDriverFilter} allLabel="All Drivers" options={uniqueDrivers} />
                  <StageFilterSelect value={customerFilter} onChange={setCustomerFilter} allLabel="All Customers" options={uniqueCustomers} />
                  <StageDivider />
                  <StageColumnsMenu
                    columns={[...PAGE_COLUMNS]}
                    visibleColumns={visibleColumns}
                    setVisibleColumns={setVisibleColumns}
                    show={(isAdmin || isFeatureEnabled('can_toggle_columns'))}
                  />
                </>
              }
            />
            <StageActiveChips
              chips={[
                ...(vehicleFilter !== "ALL" ? [{ label: `Vehicle: ${vehicleFilter}`, onClear: () => setVehicleFilter("ALL") }] : []),
                ...(driverFilter !== "ALL" ? [{ label: `Driver: ${driverFilter}`, onClear: () => setDriverFilter("ALL") }] : []),
                ...(customerFilter !== "ALL" ? [{ label: `Customer: ${customerFilter}`, onClear: () => setCustomerFilter("ALL") }] : []),
                ...(quickSearch.trim() ? [{ label: `Search: ${quickSearch.trim()}`, onClear: () => setQuickSearch("") }] : []),
              ]}
            />
          </StageListHeader>
          <CardContent className="p-0">
            <div className="hidden overflow-x-auto md:block">
              <Table>
              <StageTableHeaderRows
                columns={orderedVisibleCols.map(c => GATE_TABLE_COLUMNS.find(t => t.id === c.id)!)}
                table={table}
                alwaysShowTotals
                decimals={GATE_DECIMALS}
                tones={TOTAL_COL_TONES}
                onReorder={handleColumnReorder}
                dragDisabled={!isAdmin && !isFeatureEnabled('can_reorder_columns')}
              />
            <TableBody>
              {isPendingLoading && pendingRecords.length === 0 ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i} className="opacity-40">
                    {[...Array(orderedVisibleCols.length + 1)].map((_, j) => (
                      <TableCell key={j} className="py-4">
                        <div className="h-4 w-full bg-slate-200 animate-pulse rounded" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : pendingRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={orderedVisibleCols.length + 1} className="text-center py-8 text-muted-foreground">
                    No pending gate-ins. Orders saved as draft in Actual Dispatch will appear here.
                  </TableCell>
                </TableRow>
              ) : groupedPendingRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={orderedVisibleCols.length + 1} className="text-center py-12 text-muted-foreground">
                    <p className="font-medium text-slate-500">No matching records found</p>
                    <button onClick={clearAllFilters} className="text-xs text-blue-600 hover:underline mt-1 font-semibold">
                      Clear Filters
                    </button>
                  </TableCell>
                </TableRow>
              ) : (
                groupedPendingRecords.map(group => {
                  const first = group.records[0]
                  const draft = first.draft_data || {}
                  const totalProducts = first.draft_data?.dialogSelectedProducts?.length || 0
                  const orderKeys = group.records.map((r: any) => r.order_key)
                  return (
                    <TableRow
                      key={orderKeys.join(",")}
                      className="transition-colors cursor-pointer hover:bg-blue-50/50"
                      onClick={() => openGateInGroup(group)}
                    >
                      {orderedVisibleCols.map(col => {
                        switch (col.id) {
                          case "orderNo":
                            return (
                              <TableCell key={col.id} className="px-4 text-xs text-blue-700 font-bold">
                                {orderKeys.map(k => <div key={k} className="whitespace-nowrap">{k}</div>)}
                              </TableCell>
                            )
                          case "vehicle_no":
                            return <TableCell key={col.id} className="whitespace-nowrap px-4 text-xs text-slate-600">{draft.vehicleNumber || "—"}</TableCell>
                          case "driver_name":
                            return <TableCell key={col.id} className="whitespace-nowrap px-4 text-xs text-slate-600">{draft.driverName || "—"}</TableCell>
                          case "saved_by":
                            return <TableCell key={col.id} className="whitespace-nowrap px-4 text-xs text-slate-600">{first.username}</TableCell>
                          case "saved_at":
                            return <TableCell key={col.id} className="whitespace-nowrap px-4 text-xs text-slate-600 text-right tabular-nums">{group.date}</TableCell>
                          case "products":
                            return <TableCell key={col.id} className="whitespace-nowrap px-4 text-xs text-slate-600 text-right font-mono tabular-nums">{fmtNum(totalProducts, 0)}</TableCell>
                          default: {
                            const fieldName = COL_FIELD_MAP[col.id as ColId]
                            if (!fieldName) return null
                            const val = first[fieldName]
                            if (DATE_COL_IDS.has(col.id as ColId)) {
                              return <TableCell key={col.id} className="whitespace-nowrap px-4 text-xs text-slate-600 text-right tabular-nums">{formatDate(val)}</TableCell>
                            }
                            if (BOOL_COL_IDS.has(col.id as ColId)) {
                              return <TableCell key={col.id} className="whitespace-nowrap px-4 text-xs text-slate-600">{val ? "Yes" : "No"}</TableCell>
                            }
                            if (NUMBER_COL_IDS.has(col.id as ColId)) {
                              return <TableCell key={col.id} className="whitespace-nowrap px-4 text-xs text-slate-600 text-right font-mono tabular-nums">{fmtNum(val, GATE_DECIMALS[col.id] ?? 2)}</TableCell>
                            }
                            return <TableCell key={col.id} className="whitespace-nowrap px-4 text-xs text-slate-600">{val ?? "—"}</TableCell>
                          }
                        }
                      })}
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
            </div>

            <div className="space-y-3 p-3 md:hidden">
          {isPendingLoading && pendingRecords.length === 0 ? (
            [...Array(3)].map((_, i) => (
              <Card key={i} className="border-slate-200 p-4 shadow-sm">
                <div className="space-y-3 opacity-50">
                  <div className="h-4 w-32 bg-slate-200 animate-pulse rounded" />
                  <div className="h-3 w-full bg-slate-200 animate-pulse rounded" />
                  <div className="h-3 w-2/3 bg-slate-200 animate-pulse rounded" />
                </div>
              </Card>
            ))
          ) : pendingRecords.length === 0 ? (
            <Card className="border-slate-200 p-6 text-center text-muted-foreground shadow-sm">
              No pending gate-ins. Orders saved as draft in Actual Dispatch will appear here.
            </Card>
          ) : (
            groupedPendingRecords.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <p className="font-medium text-slate-500">No matching records found</p>
              <button onClick={clearAllFilters} className="text-xs text-blue-600 hover:underline mt-1 font-semibold">Clear Filters</button>
            </div>
          ) : groupedPendingRecords.map(group => {
              const first = group.records[0]
              const draft = first.draft_data || {}
              const totalProducts = first.draft_data?.dialogSelectedProducts?.length || 0
              const orderKeys = group.records.map((r: any) => r.order_key)
              return (
                <Card
                  key={orderKeys.join(",")}
                  className="gap-0 border-slate-200 p-4 shadow-sm bg-white cursor-pointer hover:bg-blue-50/50"
                  onClick={() => openGateInGroup(group)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">DO Number(s)</div>
                      <div className="mt-1 font-black text-blue-700">{orderKeys.join(", ")}</div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vehicle</div>
                      <div className="mt-1 truncate font-semibold text-slate-700">{draft.vehicleNumber || "—"}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Driver</div>
                      <div className="mt-1 truncate font-semibold italic text-slate-700">{draft.driverName || "—"}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Saved By</div>
                      <div className="mt-1 truncate font-medium text-slate-600">{first.username || "—"}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date</div>
                      <div className="mt-1 truncate text-xs font-medium text-slate-500">{group.date}</div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                    <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-700 border-slate-200 uppercase font-black tracking-tighter">{totalProducts} item(s)</Badge>
                  </div>
                </Card>
              )
            })
          )}
        </div>
          </CardContent>
        </Card>

        {/* Pagination */}
        <StagePagination
          page={pendingPage}
          totalPages={pendingResult?.pagination?.totalPages || 1}
          total={pendingResult?.pagination?.total || 0}
          noun="Items"
          onPrev={() => setPendingPage(p => Math.max(1, p - 1))}
          onNext={() => setPendingPage(p => p + 1)}
          prevDisabled={pendingPage === 1}
          nextDisabled={pendingPage >= (pendingResult?.pagination?.totalPages || 1)}
        />
      </div>

      {/* ── Gate-In Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[90vw] max-w-[95vw]! max-h-[95vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] p-0">
          <div className="p-8">
            <DialogHeader className="border-b pb-6 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:pr-10">
                <div className="min-w-0">
                  <DialogTitle className="text-lg sm:text-xl font-bold text-slate-900 leading-tight break-words flex items-center gap-3">
                    <Truck className="h-6 w-6 text-blue-600 shrink-0" />
                    Gate In — {selectedGroupKeys.join(", ")}
                  </DialogTitle>
                  <DialogDescription className="text-slate-500 mt-1.5">
                    Upload vehicle photos for this order. Saved draft details are shown below.
                  </DialogDescription>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button type="button" variant="outline" onClick={handlePrintSlip} className="border-blue-600 text-blue-600 hover:bg-blue-50">
                    <Printer className="mr-2 h-4 w-4" /> Print Slip
                  </Button>
                  <Button type="button" onClick={handleDownloadSlip} className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Download className="mr-2 h-4 w-4" /> Download PDF
                  </Button>
                </div>
              </div>
            </DialogHeader>

            {selectedRecord && (
              <div className="space-y-8">

                {/* ── Order & Draft Details ── */}
                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6">
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4">Order Details (from Draft)</h3>

                  {/* Combined load banner — shown when multiple orders share this vehicle */}
                  {(() => {
                    const keys: string[] = selectedRecord?.draft_data?.combinedGroupKeys || []
                    if (keys.length <= 1) return null
                    return (
                      <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex flex-wrap gap-2 items-center">
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">Combined Load — All DO Nos.</span>
                        {keys.map((k: string) => (
                          <span key={k} className={`text-xs font-bold px-2 py-0.5 rounded-md ${k === selectedRecord.order_key ? "bg-amber-400 text-white" : "bg-white border border-amber-300 text-amber-800"}`}>
                            {k}
                          </span>
                        ))}
                      </div>
                    )
                  })()}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: "DO No.", value: selectedRecord.order_key },
                    ].map(f => (
                      <div key={f.label} className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{f.label}</span>
                        <span className="text-sm font-bold text-slate-800 mt-0.5">{f.value || "—"}</span>
                      </div>
                    ))}
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Vehicle No. <span className="text-red-500">*</span></span>
                      <Combobox options={vehicleOptions} value={editableVehicle} onValueChange={setEditableVehicle} placeholder="Select Vehicle..." />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Driver Name (Optional)</span>
                      <Combobox options={driverOptions} value={editableDriver} onValueChange={setEditableDriver} placeholder="Select Driver..." />
                    </div>
                    {[

                      { label: "Saved By", value: selectedRecord.username },
                      { label: "Saved At", value: fmtDateTime(selectedRecord.saved_at) },
                      {
                        label: "Transporter",
                        value: getDraftField(selectedRecord, "transporterName") !== "—"
                          ? getDraftField(selectedRecord, "transporterName")
                          : getDraftField(selectedRecord, "loadData.transporterName"),
                      },
                      {
                        label: "Gross Weight",
                        value: getDraftField(selectedRecord, "totalPackingWeight") !== "—"
                          ? getDraftField(selectedRecord, "totalPackingWeight")
                          : getDraftField(selectedRecord, "loadData.grossWeight")
                      },
                      { label: "Tare Weight", value: getDraftField(selectedRecord, "loadData.tareWeight") },
                      { label: "RST No.", value: getDraftField(selectedRecord, "loadData.rstNo") },
                    ].map(f => (
                      <div key={f.label} className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{f.label}</span>
                        <span className="text-sm font-bold text-slate-800 mt-0.5">{f.value || "—"}</span>
                      </div>
                    ))}
                  </div>

                </div>

                {/* ── Product Table & GST Breakdown ── */}
                {selectedGroupRecords.length > 0 && (
                  <div className="space-y-4">
                    <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Products</p>
                      </div>

                      {/* Desktop table */}
                      <Table className="hidden md:table">
                        <TableHeader className="bg-slate-50">
                          <TableRow className="bg-slate-100/90 border-b-2 border-slate-300 font-bold text-xs text-slate-800 hover:bg-slate-100/90">
                            <TableCell className="px-4 font-black text-slate-900 uppercase tracking-wider text-[11px]">Total ({selectedGroupRecords.length})</TableCell>
                            <TableCell className="px-4 text-right font-mono tabular-nums font-black text-blue-700">
                              {fmtNum(selectedGroupRecords.reduce((sum, r) => {
                                    const grossWt = parseFloat(skuGrossWeightMap.get(r.product_name?.trim().toLowerCase()) || "") || 0
                                    const qty = parseFloat(r.qty_to_be_dispatched) || 0
                                    return sum + grossWt * qty
                                  }, 0))}
                            </TableCell>
                            <TableCell className="px-4 text-right font-mono tabular-nums font-black text-blue-700">
                              {fmtNum(selectedGroupRecords.reduce((sum, r) => {
                                    const skuWt = parseFloat(skuWeightMap.get(r.product_name?.trim().toLowerCase()) || "") || 0
                                    const qty = parseFloat(r.qty_to_be_dispatched) || 0
                                    return sum + skuWt * qty
                                  }, 0))}
                            </TableCell>
                            <TableCell className="px-4 text-right font-mono tabular-nums font-black text-blue-700">
                              {fmtNum(selectedGroupRecords.reduce((sum, r) => sum + (parseFloat(r.qty_to_be_dispatched) || 0), 0))}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableHead className="px-4 whitespace-nowrap">Product Name</TableHead>
                            <TableHead className="px-4 whitespace-nowrap text-right min-w-[130px]">Gross Weight (KGS)</TableHead>
                            <TableHead className="px-4 whitespace-nowrap text-right min-w-[130px]">Weight (KGS)</TableHead>
                            <TableHead className="px-4 whitespace-nowrap text-right min-w-[150px]">Actual Qty Dispatch</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedGroupRecords.map((record: any, idx: number) => {
                            const qty = parseFloat(record.qty_to_be_dispatched) || 0
                            const skuWt = parseFloat(skuWeightMap.get(record.product_name?.trim().toLowerCase()) || "") || 0
                            const totalWt = skuWt * qty
                            const grossWtRow = (parseFloat(skuGrossWeightMap.get(record.product_name?.trim().toLowerCase()) || "") || 0) * qty
                            return (
                              <TableRow key={idx} className="h-14">
                                <TableCell className="px-4 py-2">
                                  <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{record.product_name || "—"}</span>
                                </TableCell>
                                <TableCell className="px-4 py-2 text-right text-xs font-mono tabular-nums font-bold text-slate-700">
                                  {grossWtRow ? fmtNum(grossWtRow) : "—"}
                                </TableCell>
                                <TableCell className="px-4 py-2 text-right text-xs font-mono tabular-nums font-bold text-slate-700">
                                  {totalWt ? fmtNum(totalWt) : "—"}
                                </TableCell>
                                <TableCell className="px-4 py-2 text-right text-xs font-mono tabular-nums font-bold text-slate-900">
                                  {qty ? fmtNum(qty) : "—"}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>

                      {/* Mobile cards */}
                      <div className="space-y-3 p-3 md:hidden">
                        {selectedGroupRecords.map((record: any, idx: number) => {
                          const qty = parseFloat(record.qty_to_be_dispatched) || 0
                          const skuWt = parseFloat(skuWeightMap.get(record.product_name?.trim().toLowerCase()) || "") || 0
                          const totalWt = skuWt * qty
                          const grossWtRow = (parseFloat(skuGrossWeightMap.get(record.product_name?.trim().toLowerCase()) || "") || 0) * qty
                          return (
                            <div key={idx} className="rounded-xl border bg-white p-3 space-y-3">
                              <p className="text-sm font-black text-slate-800 uppercase tracking-tight">{record.product_name || "—"}</p>
                              <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="rounded-md bg-slate-50 p-2">
                                  <p className="text-[10px] font-black uppercase text-slate-400">Gross Weight (KGS)</p>
                                  <p className="mt-1 font-mono tabular-nums font-bold text-slate-700">{grossWtRow ? fmtNum(grossWtRow) : "—"}</p>
                                </div>
                                <div className="rounded-md bg-slate-50 p-2">
                                  <p className="text-[10px] font-black uppercase text-slate-400">Weight (KGS)</p>
                                  <p className="mt-1 font-mono tabular-nums font-bold text-slate-700">{totalWt ? fmtNum(totalWt) : "—"}</p>
                                </div>
                                <div className="rounded-md bg-slate-50 p-2">
                                  <p className="text-[10px] font-black uppercase text-slate-400">Actual Qty</p>
                                  <p className="mt-1 font-mono tabular-nums font-bold text-slate-900">{qty ? fmtNum(qty) : "—"}</p>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                        <div className="grid grid-cols-2 gap-3 rounded-lg border bg-slate-50 p-3 text-xs">
                          <div>
                            <p className="text-[9px] uppercase font-black text-slate-500">Total Weight (KGS)</p>
                            <p className="mt-1 font-mono tabular-nums font-black text-blue-700">
                              {(() => {
                                const total = selectedGroupRecords.reduce((sum, r) => {
                                  const skuWt = parseFloat(skuWeightMap.get(r.product_name?.trim().toLowerCase()) || "") || 0
                                  const qty = parseFloat(r.qty_to_be_dispatched) || 0
                                  return sum + skuWt * qty
                                }, 0)
                                return fmtNum(total)
                              })()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <OrderChargesPanel orderNos={Array.from(new Set(selectedGroupRecords.map((r: any) => String(r.so_no || "").replace(/(?<=\d)[A-Z].*$/, "")).filter(Boolean))) as string[]} />
                  </div>
                )}

                {/* ── Vehicle Master Details ── */}
                <div className="bg-blue-50 rounded-2xl border border-blue-200 p-6">
                  <h3 className="text-sm font-black uppercase tracking-widest text-blue-600 mb-4 flex items-center gap-2">
                    <Truck className="h-4 w-4" /> Vehicle Master Details
                    {isLoadingVehicle && <Loader2 className="h-4 w-4 animate-spin ml-2 text-blue-400" />}
                  </h3>
                  {!isLoadingVehicle && !vehicleData && (
                    <p className="text-xs text-slate-400 font-medium">No vehicle master record found for this vehicle number.</p>
                  )}
                  {vehicleData && (
                    <div className="space-y-5">
                      {/* Basic info */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                          { label: "Registration No.", value: vehicleData.registration_no },
                          { label: "Vehicle Type", value: vehicleData.vehicle_type },
                          { label: "RTO", value: vehicleData.rto },
                          { label: "Transporter", value: vehicleData.transporter },
                          { label: "GVW", value: vehicleData.gvw },
                          { label: "ULW", value: vehicleData.ulw },
                          { label: "Passing", value: vehicleData.passing },
                          // { 
                          //   label: "Total Product Gross Weight", 
                          //   value: getDraftField(selectedRecord, "totalPackingWeight") !== "—" 
                          //     ? getDraftField(selectedRecord, "totalPackingWeight") 
                          //     : getDraftField(selectedRecord, "loadData.grossWeight") 
                          // },
                          { label: "Status", value: vehicleData.status },
                        ].map(f => (
                          <div key={f.label} className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{f.label}</span>
                            <span className="text-sm font-bold text-slate-800 mt-0.5">{f.value || "—"}</span>
                          </div>
                        ))}
                      </div>

                      {/* Document dates + images */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                          { label: "Fitness Date", date: vehicleData.fitness, image: vehicleData.fitness_image },
                          { label: "Pollution Date", date: vehicleData.pollution, image: vehicleData.pollution_image },
                          { label: "Insurance Date", date: vehicleData.insurance, image: vehicleData.insurance_image },
                          { label: "Road Tax Date", date: vehicleData.road_tax, image: vehicleData.road_tax_image },
                          { label: "State Permit Date", date: vehicleData.state_permit, image: vehicleData.state_permit_image },
                        ].map(doc => (
                          <div key={doc.label} className="flex items-center gap-4 bg-white rounded-xl border border-slate-200 p-3">
                            <div className="flex-1 min-w-0">
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">{doc.label}</span>
                              <span className="text-sm font-bold text-slate-800">{doc.date ? formatDate(doc.date) : "—"}</span>
                            </div>
                            {doc.image ? (
                              <a href={doc.image} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                <img
                                  src={doc.image}
                                  alt={doc.label}
                                  className="h-14 w-20 object-cover rounded-lg border border-slate-200 hover:opacity-80 transition-opacity cursor-zoom-in"
                                />
                              </a>
                            ) : (
                              <div className="h-14 w-20 shrink-0 rounded-lg border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center">
                                <span className="text-[9px] text-slate-300 font-bold uppercase">No Image</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Image Upload ── */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Vehicle & Driver Photos</h3>
                    {isPhotosMandatory ? (
                      <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border-amber-300">
                        Compulsory *
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 border-slate-200">
                        Optional
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <ImageUploadCard
                      label="Front Vehicle Image"
                      capture="environment"
                      value={frontVehicleImage}
                      fileName={frontVehicleFileName}
                      isUploading={uploadingField === "front"}
                      required={isPhotosMandatory}
                      onFile={f => selectImage(f, frontVehicleImage, setFrontVehicleImage, setFrontVehicleFileName, setFrontVehicleFile)}
                      onClear={() => clearImage(frontVehicleImage, setFrontVehicleImage, setFrontVehicleFileName, setFrontVehicleFile)}
                    />
                    <ImageUploadCard
                      label="Back Vehicle Image"
                      capture="environment"
                      value={backVehicleImage}
                      fileName={backVehicleFileName}
                      isUploading={uploadingField === "back"}
                      required={isPhotosMandatory}
                      onFile={f => selectImage(f, backVehicleImage, setBackVehicleImage, setBackVehicleFileName, setBackVehicleFile)}
                      onClear={() => clearImage(backVehicleImage, setBackVehicleImage, setBackVehicleFileName, setBackVehicleFile)}
                    />
                    <ImageUploadCard
                      label="Driver Photo"
                      capture="environment"
                      value={driverPhoto}
                      fileName={driverPhotoFileName}
                      isUploading={uploadingField === "driver"}
                      required={isPhotosMandatory}
                      onFile={f => selectImage(f, driverPhoto, setDriverPhoto, setDriverPhotoFileName, setDriverPhotoFile)}
                      onClear={() => clearImage(driverPhoto, setDriverPhoto, setDriverPhotoFileName, setDriverPhotoFile)}
                    />
                    <ImageUploadCard
                      label="Vehicle Gate Pass"
                      capture="environment"
                      value={gatepassPhoto}
                      fileName={gatepassPhotoFileName}
                      isUploading={uploadingField === "gatepass"}
                      required={isPhotosMandatory}
                      onFile={f => selectImage(f, gatepassPhoto, setGatepassPhoto, setGatepassPhotoFileName, setGatepassPhotoFile)}
                      onClear={() => clearImage(gatepassPhoto, setGatepassPhoto, setGatepassPhotoFileName, setGatepassPhotoFile)}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium mt-3">
                    On mobile, tapping a card opens your camera directly. On desktop, it opens the file picker.{" "}
                    {isPhotosMandatory ? (
                      <span className="font-bold text-amber-700">
                        All 4 photos are compulsory for your user account and required before confirming Gate In.
                      </span>
                    ) : (
                      <span>All images are optional but recommended for complete gate-in records.</span>
                    )}{" "}
                    Images are compressed and uploaded only when you confirm gate-in.
                  </p>
                </div>

              </div>
            )}
          </div>

          <DialogFooter className="mt-4 border-t pt-4 px-8 pb-8 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 w-full lg:w-auto lg:flex-1 lg:max-w-xl lg:mr-auto">
              <div className="flex-1 space-y-1.5 min-w-0">
                <Label className="text-[10px] font-black uppercase text-red-500 tracking-tighter ml-1">Revert Remarks <span className="text-red-500">*</span></Label>
                <Input
                  className="h-10 border-2 border-red-200 rounded-lg font-medium bg-white"
                  disabled={isReadOnly}
                  placeholder="Enter reason for reverting to Plan Vehicle..."
                  value={revertRemarks}
                  onChange={(e) => setRevertRemarks(e.target.value)}
                />
              </div>
              <Button
                variant="destructive"
                onClick={handleRevert}
                disabled={isProcessing || isReadOnly || !revertRemarks.trim()}
                className="font-black uppercase tracking-tight h-10 px-6"
              >
                {isProcessing ? "Wait..." : "Revert to Plan Vehicle"}
              </Button>
            </div>
            <div className="flex gap-3 w-full lg:w-auto justify-end">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button
              onClick={handleSubmit}
              disabled={isProcessing || isReadOnly}
              className="bg-emerald-600 hover:bg-emerald-700 font-bold"
            >
              {isProcessing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</>
              ) : (
                <><CheckCircle2 className="h-4 w-4 mr-2" /> Confirm Gate In</>
              )}
            </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkflowStageShell>
  )
}
