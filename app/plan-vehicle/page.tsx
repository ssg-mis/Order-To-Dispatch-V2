"use client"

import React, { useEffect, useState, useMemo, useCallback, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { WorkflowStageShell } from "@/components/workflow/workflow-stage-shell"
import { cn } from "@/lib/utils"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { FileUploadField } from "@/components/file-upload-field"
import { Truck, Weight, Printer, Download, ChevronLeft, ChevronRight, Calendar as CalendarIconLucide, Pencil, Plus, Search, Clock, Check, ChevronsUpDown, Loader2, Eye, ExternalLink, FileCheck, FileX, FileText, ImageIcon } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { planVehicleApi, actualDispatchApi, customerApi, skuApi, orderApi, depotApi, vehicleMasterApi, transportMasterApi, driverMasterApi, commonApi, lookupApi, stateApi } from "@/lib/api-service"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { VehicleForm } from "@/components/masters/forms/VehicleForm"
import { DriverForm } from "@/components/masters/forms/DriverForm"
import { TransporterMasterDialog } from "@/components/masters/modals/transporter-master-dialog"
import { getVehicleDocFileErrors } from "@/lib/vehicle-doc-validation"
import { VehicleEffectiveDatesModalView } from "@/components/vehicle-effective-dates-modal-view"
import { isStaleWriteError } from "@/lib/stale-write"
import { generateDispatchSlipPdf } from "@/lib/dispatch-slip-pdf-lazy"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Combobox } from "@/components/ui/combobox"
import { useAuth } from "@/hooks/use-auth"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { StageHistoryTab } from "@/components/workflow/stage-history-tab"
import { usePersistedColumns } from "@/hooks/use-persisted-columns"
import { useColumnOrder } from "@/hooks/use-column-order"
import { StageTableHeaderRows } from "@/components/stage-table-header-rows"
import { ColumnDragProvider } from "@/components/ui/column-drag-provider"
import { usePersistedFilters } from "@/hooks/use-persisted-filters"
import { useStageTable, type StageColDef } from "@/hooks/use-stage-table"
import {
  StageListHeader, StageToolbar, StageFilterSelect, StageColumnsMenu, StageDivider,
  StageActiveChips, StageSortIcon, type StageTotalTone, StageActionBar, StagePagination, StageDecisionFooter, StageActionFooter } from "@/components/stage-list"
import { SortableTableHead } from "@/components/ui/sortable-table-head"
import { fmtNum } from "@/lib/table-format"

function formatDate(dateStr: string) {
  if (!dateStr) return "—";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch (e) {
    return dateStr;
  }
}

// Groups raw pending-shipment rows (from the API) by base DO number. Pulled out
// of the component so it can be reused both for the currently-loaded page
// (`displayRows`) and for a targeted, complete re-fetch of one specific DO (see
// `fetchCompleteGroupsForKeys` below) — the two need identical grouping logic.
// Pass `depoFilter` = "" to skip the depot-tab filter (used for the targeted
// fetch, where depot scoping is already enforced server-side).
// Copied verbatim from app/actual-dispatch/page.tsx — generic depot/order
// grouping logic, not specific to any one stage.
function groupOrdersByBaseDo(orders: any[], depoFilter: string): any[] {
  const grouped: { [key: string]: any } = {}

  orders.forEach((order: any) => {
    const custName = (order.transfer === 'yes' && order.bill_company_name) ? order.bill_company_name : (order.party_name || order.customerName || "Unknown")
    const doNumber = order.so_no || order.soNo || "DO/26-27/0001"
    const baseDoMatch = doNumber.match(/^(DO[-\/](?:\d{2}-\d{2}\/)?\d+)/i)
    const baseDo = baseDoMatch ? baseDoMatch[1].toUpperCase() : doNumber

    const groupKey = baseDo;

    if (!grouped[groupKey]) {
      grouped[groupKey] = {
        customerName: custName,
        _rowKey: groupKey,
        _allProducts: [],
        _productCount: 0,
        _ordersMap: {},
        _allBaseDos: new Set()
      }
    }

    grouped[groupKey]._allBaseDos.add(baseDo)

    if (!grouped[groupKey]._ordersMap[baseDo]) {
      const internalOrder = order.data?.orderData || order;

      grouped[groupKey]._ordersMap[baseDo] = {
        ...order,
        baseDo,
        _products: [],
        depoName: internalOrder.depo_name || internalOrder.depoName || "—",
        deliveryDate: internalOrder.delivery_date || internalOrder.deliveryDate || internalOrder.timestamp || "—",
        partySoDate: formatDate(internalOrder.party_so_date || internalOrder.partySoDate),
        address: internalOrder.customer_address || internalOrder.address || "—",
        brokerName: internalOrder.broker_name || internalOrder.brokerName || "—",
        orderPunchRemarks: internalOrder.order_punch_remarks || internalOrder.orderPunchRemarks || "—",
      }
    }

    const productMeta = {
      ...order,
      _rowKey: `${custName}-${baseDo}-${order.d_sr_number || order.id}`,
      orderNo: order.so_no || order.soNo,
      productName: order.product_name || order.productName,
      qtyToDispatch: order.qty_to_be_dispatched || order.qtyToDispatch,
      deliveryFrom: order.dispatch_from || order.deliveryFrom,
      dsrNumber: order.d_sr_number,
      processid: order.processid || null,
      customerName: custName,
      address: order.customer_delivery_address || order.customer_address || order.address || grouped[groupKey]._ordersMap[baseDo]?.address || "—",
      whatsapp: order.customer_contact_person_whatsapp_no || order.whatsapp || "—",
      brokerName: order.broker_name || order.brokerName || grouped[groupKey]._ordersMap[baseDo]?.brokerName || "—"
    }

    grouped[groupKey]._ordersMap[baseDo]._products.push(productMeta)
    grouped[groupKey]._allProducts.push(productMeta)
  })

  return Object.values(grouped).map((group: any) => {
    const firstOrderDetails = Object.values(group._ordersMap)[0] as any || {};
    return {
      ...group,
      ...firstOrderDetails,
      orderNo: Array.from(group._allBaseDos).join(", "),
      processId: group._allProducts[0]?.processid || "—",
      qtyToDispatch: group._allProducts.reduce((sum: number, p: any) => sum + parseFloat(p.qty_to_be_dispatched || p.qtyToDispatch || 0), 0),
      orderPunchRemarks: Array.from(new Set(Object.values(group._ordersMap).map((o: any) => o.orderPunchRemarks))).filter(Boolean).join("; ") || "—",
      _productCount: group._allProducts.length
    };
  }).filter(group => {
    if (group._productCount <= 0) return false;
    if (!depoFilter) return true;
    return (group.depoName || "").trim().toUpperCase() === depoFilter.trim().toUpperCase();
  })
}

const PAGE_COLUMNS = [
  { id: "partySoDate",     label: "DO Date" },
  { id: "orderNo",         label: "DO Number" },
  { id: "processId",       label: "Manual Sauda No." },
  { id: "customerName",    label: "Customer Name" },
  { id: "depoName",        label: "Depot" },
  { id: "qtyToDispatch",   label: "Qty to Dispatch" },
  { id: "deliveryFrom",    label: "Delivery From" },
  { id: "status",          label: "Status" },
] as const
type PlanColId = typeof PAGE_COLUMNS[number]["id"]

// partySoDate is pre-formatted dd/mm/yyyy on grouped rows; convert to ISO for the date-range filter.
function planRowIsoDate(row: any): string | null {
  const raw = row.party_so_date ?? row.partySoDate
  if (!raw || raw === "—") return null
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(raw))
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`
  return String(raw)
}

const PLAN_TABLE_COLUMNS: StageColDef<any>[] = [
  { id: "partySoDate", label: "DO Date", type: "date", accessor: planRowIsoDate },
  { id: "orderNo", label: "DO Number", accessor: (r) => r.orderNo || "" },
  { id: "processId", label: "Manual Sauda No.", accessor: (r) => (r.processId && r.processId !== "—" ? r.processId : "") },
  { id: "customerName", label: "Customer Name", accessor: (r) => r.customerName || "" },
  { id: "depoName", label: "Depot", accessor: (r) => (r.depoName && r.depoName !== "—" ? r.depoName : "") },
  { id: "qtyToDispatch", label: "Qty to Dispatch", type: "number", accessor: (r) => Number(r.qtyToDispatch) || 0 },
  { id: "deliveryFrom", label: "Delivery From", accessor: (r) => r._allProducts?.[0]?.deliveryFrom || "" },
  { id: "status", label: "Status", accessor: () => "Ready to Plan" },
]
const PLAN_TOTAL_TONES: Record<string, StageTotalTone> = { qtyToDispatch: "blue" }
const PLAN_RIGHT_COLS = new Set<string>(["partySoDate", "qtyToDispatch"])
const PLAN_MIN_W: Record<string, string> = { partySoDate: "min-w-[120px]", qtyToDispatch: "min-w-[150px]" }

type DriverApprovalState = 'pending' | 'edit_pending' | 'approved'
const driverApprovalState = (d: any): DriverApprovalState =>
  (d.approval_status === 'pending' || d.approvalStatus === 'pending')
    ? 'pending'
    : Boolean(d.has_pending_edit || d.hasPendingEdit || d.pending_changes || d.pendingChanges)
    ? 'edit_pending'
    : 'approved'
const DRIVER_BADGE_LABEL: Record<DriverApprovalState, string> = { pending: 'Pending Approval', edit_pending: 'Edit Pending', approved: 'Approved' }
const DRIVER_BADGE_CLASS: Record<DriverApprovalState, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-300',
  edit_pending: 'bg-blue-50 text-blue-700 border-blue-300',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-300',
}

export default function PlanVehiclePage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { isReadOnly, user, isAdmin, isFeatureEnabled } = useAuth()
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
  const [activeDepots, setActiveDepots] = useState<any[]>([])
  // List view (depot tab / quick search / customer & delivery-from selects): the depot tab is remembered permanently, the
  // rest is session-scoped. Stale depot values are re-validated against availableDepots below.
  const [listView, patchListView] = usePersistedFilters("plan-vehicle", {
    selectedDepoTab: "",
    quickSearch: "",
    customerFilter: "ALL",
    deliveryFromFilter: "ALL",
  }, { permanentKeys: ["selectedDepoTab"] })
  const { selectedDepoTab, quickSearch, customerFilter, deliveryFromFilter } = listView
  const setSelectedDepoTab = (v: string) => patchListView({ selectedDepoTab: v })
  const setQuickSearch = (v: string) => patchListView({ quickSearch: v })
  const setCustomerFilter = (v: string) => patchListView({ customerFilter: v })
  const setDeliveryFromFilter = (v: string) => patchListView({ deliveryFromFilter: v })
  const [isProcessing, setIsProcessing] = useState(false)
  const [skus, setSkus] = useState<any[]>([])
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [docWarningDialog, setDocWarningDialog] = useState<{ open: boolean; messages: string[] }>({ open: false, messages: [] })
  const [selectedGroups, setSelectedGroups] = useState<any[]>([])
  const [dialogSelectedProducts, setDialogSelectedProducts] = useState<string[]>([])
  const [revertRemarks, setRevertRemarks] = useState("")
  const [isSlipDialogOpen, setIsSlipDialogOpen] = useState(false)

  // Vehicle + driver + digital documents ("Stage 5/6" fields on the old page).
  const [vehicleNumber, setVehicleNumber] = useState("")
  const [vehicleData, setVehicleData] = useState({
    checkStatus: "",
    remarks: "",
    fitness: "",
    insurance: "",
    tax_copy: "",
    polution: "",
    permit1: "",
    permit2_out_state: "",
    fitness_file_name: "",
    insurance_file_name: "",
    tax_file_name: "",
    pollution_file_name: "",
    permit1_file_name: "",
    permit2_file_name: "",
    fitness_end_date: "",
    insurance_end_date: "",
    tax_end_date: "",
    pollution_end_date: "",
    permit1_end_date: "",
    permit2_end_date: "",
    registration_no: "",
    vehicle_type: "",
    rto: "",
    passing_weight: "",
    road_tax: "",
    is_lifetime_tax: false,
    fuel_type: "",
    gvw: "",
    ulw: "",
  })

  // Transporter + freight/advance-bhada + overload — these lived inside the OLD
  // page's "Weightment Audit" column even though they have nothing to do with
  // weightment; they belong to vehicle/transport planning, so they live here now.
  const [freightData, setFreightData] = useState({
    transporterName: "",
    vehicleNoPlateImage: "",
    vehicleNoPlateImage_file_name: "",
    overloadRemarks: "",
    freightRateType: "",
    freightAmount: "",
    cdAmount: "",
    finalRate: "",
    cash_bank: "",
    diesel_advance: "",
    bhada: "",
  })

  const [isUploading, setIsUploading] = useState<string | null>(null)
  const [vehicleMaster, setVehicleMaster] = useState<any[]>([])
  const [driverMaster, setDriverMaster] = useState<any[]>([])
  const [transporterMaster, setTransporterMaster] = useState<any[]>([])
  const [transporterAll, setTransporterAll] = useState<any[]>([])
  const [driverName, setDriverName] = useState("")
  const [driverData, setDriverData] = useState({
    contact_no: "",
    license_no: "",
    license_type: "",
    valid_upto: "",
    trans_valid_upto: "",
    lmv_valid_upto: ""
  })

  const vehicleOptions = useMemo(() => (
    vehicleMaster
      .filter(v => v.registration_no && v.status === 'Active')
      .map(v => ({ value: v.registration_no, label: v.registration_no }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base', numeric: true }))
  ), [vehicleMaster])



  // Vehicle dropdown & Master Modal state
  const [vehicleDropdownOpen, setVehicleDropdownOpen] = useState(false)
  const [vehicleSearchTerm, setVehicleSearchTerm] = useState("")
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<any | null>(null)
  const [isSubmittingVehicleModal, setIsSubmittingVehicleModal] = useState(false)
  const [roadTaxType, setRoadTaxType] = useState<'expiry' | 'lifetime'>('expiry')
  const [vehicleEffectiveDatesSection, setVehicleEffectiveDatesSection] = useState<'basic' | 'weights' | 'tax_compliance' | 'permits' | 'gps' | 'documents' | null>(null)

  // Auto-close vehicle dropdown when the page is scrolled vertically
  useEffect(() => {
    if (!vehicleDropdownOpen) return

    const handleScroll = (event: Event) => {
      const target = event.target as HTMLElement | null
      // Do not close if the user is scrolling inside the vehicle dropdown list itself
      if (
        target &&
        target.closest &&
        (target.closest('[data-slot="popover-content"]') ||
          target.closest('[data-radix-popper-content-wrapper]') ||
          target.closest('[cmdk-list]'))
      ) {
        return
      }
      setVehicleDropdownOpen(false)
    }

    window.addEventListener('scroll', handleScroll, { capture: true, passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true })
    }
  }, [vehicleDropdownOpen])

  const initialVehicleForm = useMemo(() => ({
    vehicle_master_id: '',
    registration_no: '',
    vehicle_type: '',
    transporter: '',
    rto: '',
    rto_id: '',
    additional_transporter_ids: [] as number[],
    gps_company: '',
    gps_api_tracking_link: '',
    gps_valid_upto: '',
    gps_type: '',
    gps_installed_by: '',
    status: 'Active',
    rc_image: '',
    road_tax: '',
    road_tax_image: '',
    pollution: '',
    pollution_image: '',
    insurance: '',
    insurance_image: '',
    fitness: '',
    fitness_image: '',
    state_permit: '',
    state_permit_image: '',
    state_permit_type: '',
    national_permit: '',
    national_permit_image: '',
    fuel_type: 'Diesel',
    gvw: '',
    ulw: '',
    passing: '',
    life_time_tax: '',
    life_time_tax_image: '',
  }), [])


  // Driver dropdown & Master Modal state (mirrors the vehicle dropdown above)
  const [driverDropdownOpen, setDriverDropdownOpen] = useState(false)
  const [isDriverModalOpen, setIsDriverModalOpen] = useState(false)
  const [editingDriver, setEditingDriver] = useState<any | null>(null)
  const [isSubmittingDriverModal, setIsSubmittingDriverModal] = useState(false)
  const initialDriverForm = useMemo(() => ({
    driver_master_id: "", status: "Active", driving_licence_no: "", driving_licence_type: "",
    valid_upto: "", rto: "", rto_id: null, trans_valid_upto: "", lmv_valid_upto: "",
    driver_name: "", mobile_no: "", email_id: "", address_line1: "", state: "", pincode: "",
    aadhaar_no: "", pan_no: "", aadhaar_upload: "", dl_upload: "",
  }), [])
  const [driverModalForm, setDriverModalForm] = useState<any>(initialDriverForm)

  const { data: statesData } = useQuery({
    queryKey: ["master-states"],
    queryFn: async () => {
      const res = await stateApi.getAll({ page: 1, limit: 1000, all: "true" })
      return res.success ? (res.data.states || []) : []
    },
    staleTime: 5 * 60 * 1000,
  })
  const activeStates = useMemo(() => (statesData || []).filter((s: any) => s.status === 'Active'), [statesData])

  // Auto-close driver dropdown when the page is scrolled vertically
  useEffect(() => {
    if (!driverDropdownOpen) return
    const handleScroll = (event: Event) => {
      const target = event.target as HTMLElement | null
      if (
        target &&
        target.closest &&
        (target.closest('[data-slot="popover-content"]') ||
          target.closest('[data-radix-popper-content-wrapper]') ||
          target.closest('[cmdk-list]'))
      ) {
        return
      }
      setDriverDropdownOpen(false)
    }
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true })
    }
  }, [driverDropdownOpen])

  // Transporter dropdown & Master Modal state (mirrors the vehicle / driver dropdowns)
  const [transporterDropdownOpen, setTransporterDropdownOpen] = useState(false)
  const [isTransporterModalOpen, setIsTransporterModalOpen] = useState(false)
  const [editingTransporter, setEditingTransporter] = useState<any | null>(null)

  // Auto-close transporter dropdown when the page is scrolled vertically
  useEffect(() => {
    if (!transporterDropdownOpen) return
    const handleScroll = (event: Event) => {
      const target = event.target as HTMLElement | null
      if (
        target &&
        target.closest &&
        (target.closest('[data-slot="popover-content"]') ||
          target.closest('[data-radix-popper-content-wrapper]') ||
          target.closest('[cmdk-list]'))
      ) {
        return
      }
      setTransporterDropdownOpen(false)
    }
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true })
    }
  }, [transporterDropdownOpen])

  const [vehicleModalForm, setVehicleModalForm] = useState<any>(initialVehicleForm)
  const [vehicleModalErrors, setVehicleModalErrors] = useState<Record<string, string>>({})

  // RTO Codes for vehicle modal
  const { data: rtoCodeData } = useQuery({
    queryKey: ["lookup-rto_code"],
    queryFn: async () => {
      const res = await lookupApi.getAll('rto_code', { page: 1, limit: 1000, all: "true" })
      return res.success ? (res.data.items || []).map((item: any) => ({ ...item, id: item.id ?? item.lookup_id })) : []
    },
    staleTime: 5 * 60 * 1000,
  })
  const activeRtoCodes = useMemo(() => (rtoCodeData || []).filter((r: any) => r.status === 'Active'), [rtoCodeData])

  // Sorted vehicle transporters for VehicleForm
  const sortedVehicleTransporters = useMemo<string[]>(() => {
    const names: string[] = (transporterMaster || [])
      .map((t: any) => t.transporter_name?.trim())
      .filter((name: any): name is string => typeof name === "string" && name.length > 0)

    const sorted = Array.from(new Set<string>(names)).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base", numeric: true })
    )

    const builtIns = ["Company Vehicle", "Party Vehicle"]
    const rest = sorted.filter((n) => !builtIns.includes(n))
    return [...builtIns, ...rest]
  }, [transporterMaster])

  const transporterModalOptions = useMemo(() => transporterMaster || [], [transporterMaster])

  // Filtered vehicles for dropdown
  const filteredVehicles = useMemo(() => {
    let list = vehicleMaster.filter(v => v.registration_no && v.status === 'Active')
    if (vehicleSearchTerm.trim()) {
      const q = vehicleSearchTerm.trim().toLowerCase()
      list = list.filter(v =>
        (v.registration_no || '').toLowerCase().includes(q) ||
        (v.vehicle_type || '').toLowerCase().includes(q) ||
        (v.transporter || '').toLowerCase().includes(q)
      )
    }
    return list.sort((a, b) => (a.registration_no || '').localeCompare(b.registration_no || '', undefined, { sensitivity: 'base', numeric: true }))
  }, [vehicleMaster, vehicleSearchTerm])

  const selectedVehicleObj = useMemo(() => {
    return vehicleMaster.find(v => v.registration_no === vehicleNumber)
  }, [vehicleMaster, vehicleNumber])

  // Transporters attached to the selected vehicle in the master: its primary
  // transporter plus any "additional transporters". null = no vehicle selected
  // (or still loading), so the full list is offered (transporter-only flow).
  const [vehicleTransporterNames, setVehicleTransporterNames] = useState<string[] | null>(null)
  useEffect(() => {
    if (!selectedVehicleObj?.id) { setVehicleTransporterNames(null); return }
    let cancelled = false
    setVehicleTransporterNames(null)
    vehicleMasterApi.getById(selectedVehicleObj.id).then((res: any) => {
      if (cancelled) return
      const full = res?.success && res.data ? res.data : selectedVehicleObj
      const extraIds = (full.additional_transporter_ids || []).map((id: any) => String(id))
      const names = [
        full.transporter || selectedVehicleObj.transporter,
        ...transporterMaster.filter(t => extraIds.includes(String(t.id))).map(t => t.transporter_name),
      ].filter((n: any): n is string => typeof n === "string" && n.trim().length > 0)
      setVehicleTransporterNames(Array.from(new Set(names)))
    }).catch(() => { if (!cancelled) setVehicleTransporterNames(null) })
    return () => { cancelled = true }
  }, [selectedVehicleObj?.id, transporterMaster])

  // Rows for the Transporter dropdown: the two built-in ownership options plus
  // every Active / pending-approval transporter, limited to the selected
  // vehicle's attached transporters when a vehicle is chosen.
  const freightTransporterRows = useMemo(() => {
    const rows: { name: string; record: any | null }[] = [
      { name: "Company Vehicle", record: null },
      { name: "Party Vehicle", record: null },
      ...transporterAll
        .filter(t => t.transporter_name && (t.status === 'Active' || t.approval_status === 'pending'))
        .map(t => ({ name: t.transporter_name as string, record: t })),
    ]
    const restricted = vehicleTransporterNames && vehicleTransporterNames.length > 0
    return rows
      .filter(r => !restricted || vehicleTransporterNames!.includes(r.name))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }))
  }, [transporterAll, vehicleTransporterNames])

  // Subtext under each transporter in the dropdown, same shape as the customer
  // dropdown: "Contact Person · Mobile · GST · City (ST)". City isn't its own
  // column, so it is the last comma-separated part of address line 1.
  const transporterMeta = (t: any): string => {
    if (!t) return ""
    const addr1 = String(t.address_line1 || "")
    const city = addr1 ? (addr1.split(",").pop() || "").trim() : ""
    const st = activeStates.find((s: any) => String(s.id) === String(t.state_id))
    const stateShort = st?.short_name || (t.state ? String(t.state).substring(0, 2).toUpperCase() : "")
    const cityState = [city, stateShort ? `(${stateShort})` : ""].filter(Boolean).join(" ")
    return [t.contact_person, t.contact_number, t.gstin, cityState].filter(Boolean).join(" · ")
  }

  const selectedTransporterObj = useMemo(
    () => transporterAll.find(t => t.transporter_name === freightData.transporterName),
    [transporterAll, freightData.transporterName]
  )

  const handleOpenAddVehicleModal = async () => {
    let nextId = ""
    try {
      const res = await commonApi.getNextId('vehicle')
      if (res?.success && res.data?.nextId) {
        nextId = res.data.nextId
      }
    } catch (err) {
      console.error("Failed to fetch next vehicle id:", err)
    }

    setEditingVehicle(null)
    setVehicleModalForm({
      ...initialVehicleForm,
      vehicle_master_id: nextId,
    })
    setRoadTaxType('expiry')
    setVehicleModalErrors({})
    setVehicleEffectiveDatesSection(null)
    setIsVehicleModalOpen(true)
  }

  const handleOpenEditVehicleModal = async (veh: any) => {
    try {
      setEditingVehicle(veh)
      const res = await vehicleMasterApi.getById(veh.id)
      const fullData = res?.success && res.data ? res.data : veh
      setVehicleModalForm({
        ...initialVehicleForm,
        ...fullData,
        fuel_type: fullData.fuel_type || 'Diesel',
        state_permit_type: fullData.state_permit_type || '',
      })
      setRoadTaxType(fullData.life_time_tax || fullData.life_time_tax_image ? 'lifetime' : 'expiry')
      setVehicleModalErrors({})
      setVehicleEffectiveDatesSection(null)
      setIsVehicleModalOpen(true)
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to load vehicle details",
        variant: "destructive"
      })
    }
  }

  const handleVehicleModalFileUpload = async (file: File, fieldName: string) => {
    try {
      const response = await orderApi.uploadFile(file)
      if (response.success) {
        setVehicleModalForm((prev: any) => ({ ...prev, [fieldName]: response.data.url }))
        toast({
          title: "Upload Successful",
          description: `${file.name} has been uploaded.`,
        })
      } else {
        toast({
          title: "Upload Failed",
          description: response.message || "Failed to upload file",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload file",
        variant: "destructive",
      })
    }
  }

  const handleVehicleModalFileRemove = (fieldName: string) => {
    setVehicleModalForm((prev: any) => ({ ...prev, [fieldName]: '' }))
  }

  const handleSubmitVehicleModal = async () => {
    const vErrors: Record<string, string> = {}
    if (!vehicleModalForm.registration_no?.trim()) vErrors.registration_no = 'Registration Number is required'
    if (!vehicleModalForm.vehicle_type?.trim()) vErrors.vehicle_type = 'Vehicle Type is required'
    if (!vehicleModalForm.transporter?.trim()) vErrors.transporter = 'Transporter is required'

    const permitApplies = vehicleModalForm.gvw !== '' && Number(vehicleModalForm.gvw) > 3000
    if (permitApplies && !vehicleModalForm.state_permit_image) {
      vErrors.state_permit_image = 'State Permit document is required'
    }

    Object.assign(vErrors, { ...getVehicleDocFileErrors(vehicleModalForm, roadTaxType), ...vErrors })

    const regNo = vehicleModalForm.registration_no?.trim().toUpperCase()
    const duplicate = vehicleMaster.find((v: any) =>
      v.registration_no?.trim().toUpperCase() === regNo &&
      v.id !== editingVehicle?.id
    )
    if (duplicate) {
      vErrors.registration_no = `Registration Number "${regNo}" already exists (${duplicate.vehicle_master_id || duplicate.registration_no})`
    }

    if (Object.keys(vErrors).length > 0) {
      setVehicleModalErrors(vErrors)
      const errList = Object.values(vErrors).filter(Boolean)
      toast({
        title: "Validation Error",
        description: `Please fill in required fields: ${errList.join(", ")}`,
        variant: "destructive",
      })
      return
    }

    setVehicleModalErrors({})
    setIsSubmittingVehicleModal(true)

    try {
      const payload = { ...vehicleModalForm }
      if (roadTaxType === 'expiry') {
        payload.life_time_tax = null
        payload.life_time_tax_image = null
      } else {
        payload.road_tax = null
        payload.road_tax_image = null
      }
      const isPermitEnabled = payload.gvw !== '' && Number(payload.gvw) > 3000
      if (!isPermitEnabled) {
        payload.state_permit = null
        payload.state_permit_image = null
        payload.state_permit_type = null
        payload.national_permit = null
        payload.national_permit_image = null
      }
      const dateFields = ['rto', 'road_tax', 'life_time_tax', 'pollution', 'insurance', 'fitness', 'state_permit', 'national_permit'] as const
      dateFields.forEach(f => {
        if (payload[f] === '') payload[f] = null
      })

      let res: any
      if (editingVehicle) {
        res = await vehicleMasterApi.update(editingVehicle.id, payload)
      } else {
        res = await vehicleMasterApi.create(payload)
      }

      if (res?.success) {
        toast({
          title: "Submitted Successfully",
          description: res.message || (editingVehicle ? "Vehicle edit submitted for approver review" : "Vehicle submitted for approver approval"),
        })
        setIsVehicleModalOpen(false)
        await fetchMasterData()
      } else {
        toast({
          title: "Submission Failed",
          description: res?.message || "Failed to save vehicle",
          variant: "destructive"
        })
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to save vehicle",
        variant: "destructive"
      })
    } finally {
      setIsSubmittingVehicleModal(false)
    }
  }

  // Documents must be valid at least 5 days from today. (The old Actual Dispatch
  // page had a TEMP manual override for this baseline tied to backfilling old
  // Vehicle Master records — not needed here since this is a brand-new stage.)
  const minDate = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 5)
    return d.toISOString().split("T")[0]
  }, [])

  // Interstate detection. For each selected order the delivery state is taken
  // from the address text (any known state name), else from the Customer Master
  // state; the vehicle state comes from the registration number prefix (the
  // master's `rto` field is a date). Unknown => treated as National (safe side)
  // and flagged so the dispatcher can confirm or override.
  const [customerStateByName, setCustomerStateByName] = useState<Record<string, string>>({})
  const [routeOverride, setRouteOverride] = useState<"auto" | "national" | "within">("auto")

  useEffect(() => {
    const missing = Array.from(new Set(selectedGroups.map(g => String(g.customerName || "").trim()).filter(n => n && n !== "—")))
      .filter(n => customerStateByName[n.toLowerCase()] === undefined)
    if (missing.length === 0) return
    let cancelled = false
    Promise.all(missing.map(async name => {
      try {
        const res: any = await customerApi.getAll({ search: name, limit: 5 })
        const items = res?.success ? (res.data?.customers || (Array.isArray(res.data) ? res.data : [])) : []
        const m = items.find((c: any) => (c.customer_name || "").toLowerCase() === name.toLowerCase())
        return [name.toLowerCase(), String(m?.state || "")] as const
      } catch { return [name.toLowerCase(), ""] as const }
    })).then(entries => {
      if (!cancelled) setCustomerStateByName(prev => ({ ...prev, ...Object.fromEntries(entries) }))
    })
    return () => { cancelled = true }
  }, [selectedGroups, customerStateByName])

  const routeInfo = useMemo(() => {
    const regNo = (vehicleData.registration_no || vehicleNumber || "").replace(/[^A-Za-z0-9]/g, "")
    if (selectedGroups.length === 0 || !regNo) return { auto: false, unknown: false }

    const statePrefixMap: Record<string, string> = {
      "CG": "chhattisgarh", "KA": "karnataka", "MH": "maharashtra", "DL": "delhi",
      "UP": "uttar pradesh", "HR": "haryana", "RJ": "rajasthan", "MP": "madhya pradesh",
      "GJ": "gujarat", "PB": "punjab", "WB": "west bengal", "BR": "bihar",
      "OD": "odisha", "AS": "assam", "TS": "telangana", "AP": "andhra pradesh",
      "TN": "tamil nadu", "KL": "kerala", "UK": "uttarakhand", "UA": "uttarakhand",
      "HP": "himachal pradesh", "JH": "jharkhand", "GA": "goa", "JK": "jammu",
      "PY": "puducherry", "TR": "tripura", "MZ": "mizoram", "NL": "nagaland",
      "MN": "manipur", "ML": "meghalaya", "SK": "sikkim", "AR": "arunachal",
    }
    const aliases: Record<string, string> = { "chattisgarh": "chhattisgarh", "orissa": "odisha", "uttaranchal": "uttarakhand", "pondicherry": "puducherry" }
    const stateNames = Array.from(new Set(Object.values(statePrefixMap)))
    const norm = (t: string) => {
      let x = (t || "").toLowerCase()
      Object.entries(aliases).forEach(([k, v]) => { x = x.split(k).join(v) })
      return x
    }

    const vehicleState = statePrefixMap[regNo.substring(0, 2).toUpperCase()]
    if (!vehicleState) return { auto: true, unknown: true }

    let inter = false
    let unknown = false
    selectedGroups.forEach(group => {
      Object.values(group._ordersMap).forEach((order: any) => {
        const addr = norm(order.address)
        const found = stateNames.filter(n => addr.includes(n))
        const custState = norm(customerStateByName[String(group.customerName || "").trim().toLowerCase()] || "")
        const target = found.length > 0 ? found : stateNames.filter(n => custState.includes(n))
        if (target.length === 0) { unknown = true; inter = true; return }
        if (!target.includes(vehicleState)) inter = true
      })
    })
    return { auto: inter, unknown }
  }, [selectedGroups, vehicleData.registration_no, vehicleNumber, customerStateByName])

  const isInterState = routeOverride === "auto" ? routeInfo.auto : routeOverride === "national"
  // Delivery state could not be detected: the dispatcher must pick the route.
  const routeNeedsConfirm = routeOverride === "auto" && routeInfo.unknown

  const handleFileChange = async (field: string, fileNameField: string, file: File | null, type: 'vehicle' | 'freight' = 'vehicle') => {
    if (!file) return

    setIsUploading(field)
    try {
      const response = await orderApi.uploadFile(file)
      if (response.success) {
        if (type === 'vehicle') {
          setVehicleData(p => ({
            ...p,
            [field]: response.data.url,
            [fileNameField]: file.name
          }))
        } else {
          setFreightData(p => ({
            ...p,
            [field]: response.data.url,
            [fileNameField]: file.name
          }))
        }
        toast({
          title: "Upload Successful",
          description: `${file.name} has been uploaded.`,
        })
      }
    } catch (error: any) {
      console.error("Upload failed:", error)
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload file to S3",
        variant: "destructive",
      })
    } finally {
      setIsUploading(null)
    }
  }

  // --- SKU weight helpers (copied verbatim — generic SKU lookups, not stage-specific) ---

  const getSkuGrossWeight = (productName: string): number => {
    if (!productName || skus.length === 0) return 0
    const normalizeSkuName = (name: string) => name.toUpperCase().replace(/KGS/g, 'KG').replace(/LTRS/g, 'LTR').replace(/\s+/g, ' ').trim()
    const normalizedProductName = normalizeSkuName(productName)
    let matchedSku = skus.find(sku => sku.sku_name?.toUpperCase() === productName.toUpperCase()) ||
      skus.find(sku => normalizeSkuName(sku.sku_name || '') === normalizedProductName) ||
      skus.find(sku => {
        const normalizedSkuName = normalizeSkuName(sku.sku_name || '')
        return normalizedSkuName.includes(normalizedProductName) || normalizedProductName.includes(normalizedSkuName)
      })

    const grossWeight = matchedSku?.gross_weight ? parseFloat(matchedSku.gross_weight) : 0
    const skuWeight = matchedSku?.sku_weight ? parseFloat(matchedSku.sku_weight) : 0

    return grossWeight > 0 ? grossWeight : skuWeight
  }

  const getSkuWeight = (productName: string): number => {
    if (!productName || skus.length === 0) return 0
    let matchedSku = skus.find(sku => sku.sku_name?.toUpperCase() === productName.toUpperCase())
    if (matchedSku) return matchedSku?.sku_weight ? parseFloat(matchedSku.sku_weight) : 0
    const normalizeSkuName = (name: string) => name.toUpperCase().replace(/KGS/g, 'KG').replace(/LTRS/g, 'LTR').replace(/\s+/g, ' ').trim()
    const normalizedProductName = normalizeSkuName(productName)
    matchedSku = skus.find(sku => normalizeSkuName(sku.sku_name || '') === normalizedProductName)
    if (matchedSku) return matchedSku?.sku_weight ? parseFloat(matchedSku.sku_weight) : 0
    matchedSku = skus.find(sku => {
      const normalizedSkuName = normalizeSkuName(sku.sku_name || '')
      return normalizedSkuName.includes(normalizedProductName) || normalizedProductName.includes(normalizedSkuName)
    })
    if (matchedSku) return matchedSku?.sku_weight ? parseFloat(matchedSku.sku_weight) : 0
    return 0
  }

  const calculateWeight = (productName: string, qty: string | number): number => {
    const skuWeight = getSkuWeight(productName)
    const quantity = typeof qty === 'string' ? parseFloat(qty) || 0 : qty
    return skuWeight * quantity
  }

  const calculateGrossWeight = (productName: string, qty: string | number): number => {
    const skuGrossWeight = getSkuGrossWeight(productName)
    const quantity = typeof qty === 'string' ? parseFloat(qty) || 0 : qty
    return skuGrossWeight * quantity
  }

  // --- End helpers ---

  // Pending query with numeric pagination
  const {
    data: pendingResult,
    isLoading: isPendingLoading,
    refetch: refetchPending,
  } = useQuery({
    queryKey: ["plan-vehicle-pending", filterValues, pendingPage, selectedDepoTab, user?.depo_access?.['Plan Vehicle']],
    queryFn: async () => {
      const allowedDepots = user?.depo_access?.['Plan Vehicle'] || []
      const response = await planVehicleApi.getPending({
        page: pendingPage,
        limit,
        search: filterValues.search,
        manual_sauda_no: filterValues.manualSaudaNo,
        do_date_from: filterValues.startDate,
        do_date_to: filterValues.endDate,
        party_name: filterValues.partyName === "all" ? undefined : filterValues.partyName,
        depo_names: selectedDepoTab ? [selectedDepoTab] : allowedDepots
      });
      return response.success ? response.data : { dispatches: [], pagination: { total: 0 } };
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const pendingOrders = useMemo(() => {
    return pendingResult?.dispatches || [];
  }, [pendingResult]);

  useEffect(() => {
    setPendingPage(1);
  }, [filterValues, selectedDepoTab]);

  useEffect(() => {
    if (activeTab === "pending") {
      refetchPending();
    }
  }, [activeTab, selectedDepoTab]);

  // No dedicated /plan-vehicle/filters endpoint exists yet — derive the party
  // filter's option list from the rows already loaded for the current page
  // instead (a reasonable stand-in until such an endpoint is added).
  const customerNameOptions = useMemo(() => {
    const names = new Set<string>();
    pendingOrders.forEach((o: any) => {
      const n = (o.transfer === 'yes' && o.bill_company_name) ? o.bill_company_name : (o.party_name || o.customerName);
      if (n) names.add(n);
    });
    return Array.from(names).sort();
  }, [pendingOrders]);

  const fetchSkus = async () => {
    try {
      const response = await skuApi.getAll({ limit: 1000 })
      if (response.success && response.data) {
        let skuArray = []
        if (Array.isArray(response.data)) {
          skuArray = response.data
        } else if (response.data.skuDetails && Array.isArray(response.data.skuDetails)) {
          skuArray = response.data.skuDetails
        } else if (typeof response.data === 'object') {
          skuArray = response.data.skus || response.data.items || []
        }
        setSkus(skuArray)
      }
    } catch (error: any) {
      console.error("[PLAN VEHICLE] Failed to fetch SKUs:", error)
    }
  }

  const fetchDepots = async () => {
    try {
      const response = await depotApi.getAll({ all: 'false' });
      if (response.success && response.data?.depots) {
        let depots = response.data.depots;

        const allowedDepos = user?.depo_access?.['Plan Vehicle'] || [];
        depots = depots.filter((d: any) =>
          allowedDepos.some((ad: string) => ad.toLowerCase() === d.depot_name.toLowerCase())
        );

        const sortedDepots = [...depots].sort((a, b) => {
          const aIsBanari = a.depot_name.toLowerCase() === 'banari'
          const bIsBanari = b.depot_name.toLowerCase() === 'banari'
          if (aIsBanari && !bIsBanari) return -1
          if (!aIsBanari && bIsBanari) return 1
          return a.depot_name.localeCompare(b.depot_name)
        })
        setActiveDepots(sortedDepots);
        if (sortedDepots.length > 0 && !sortedDepots.some((d: any) => d.depot_name === selectedDepoTab)) {
          const banari = sortedDepots.find((d: any) => d.depot_name.toLowerCase() === 'banari');
          setSelectedDepoTab(banari ? banari.depot_name : sortedDepots[0].depot_name);
        }
      }
    } catch (error) {
      console.error("[PLAN VEHICLE] Failed to fetch depots:", error);
    }
  };

  useEffect(() => {
    fetchSkus();
    fetchDepots();
  }, [user?.depo_access])

  const selectedDriverObj = useMemo(() => {
    return driverMaster.find(d => d.driver_name === driverName)
  }, [driverMaster, driverName])

  const applyDriver = (d: any) => {
    setDriverName(d.driver_name)
    setDriverData({
      contact_no: d.mobile_no || "",
      license_no: d.driving_licence_no || "",
      license_type: d.driving_licence_type || "",
      valid_upto: d.valid_upto ? new Date(d.valid_upto).toISOString().split('T')[0] : "",
      trans_valid_upto: d.trans_valid_upto ? new Date(d.trans_valid_upto).toISOString().split('T')[0] : "",
      lmv_valid_upto: d.lmv_valid_upto ? new Date(d.lmv_valid_upto).toISOString().split('T')[0] : ""
    })
  }

  const clearDriver = () => {
    setDriverName("")
    setDriverData({ contact_no: "", license_no: "", license_type: "", valid_upto: "", trans_valid_upto: "", lmv_valid_upto: "" })
  }

  const handleOpenAddDriverModal = async () => {
    let nextId = ""
    try {
      const res = await commonApi.getNextId('driver')
      if (res?.success && res.data?.nextId) nextId = res.data.nextId
    } catch (err) {
      console.error("Failed to fetch next driver id:", err)
    }
    setEditingDriver(null)
    setDriverModalForm({ ...initialDriverForm, driver_master_id: nextId })
    setIsDriverModalOpen(true)
  }

  const handleOpenEditDriverModal = async (drv: any) => {
    try {
      setEditingDriver(drv)
      const res = await driverMasterApi.getById(drv.id)
      const fullData = res?.success && res.data ? res.data : drv
      setDriverModalForm({ ...initialDriverForm, ...fullData })
      setIsDriverModalOpen(true)
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to load driver details",
        variant: "destructive"
      })
    }
  }

  const handleDriverModalFileUpload = async (file: File, fieldName: string) => {
    try {
      const response = await orderApi.uploadFile(file)
      if (response.success) {
        setDriverModalForm((prev: any) => ({ ...prev, [fieldName]: response.data.url }))
        toast({ title: "Upload Successful", description: `${file.name} has been uploaded.` })
      } else {
        toast({ title: "Upload Failed", description: response.message || "Failed to upload file", variant: "destructive" })
      }
    } catch (error: any) {
      toast({ title: "Upload Failed", description: error.message || "Failed to upload file", variant: "destructive" })
    }
  }

  const handleDriverModalFileRemove = (fieldName: string) => {
    setDriverModalForm((prev: any) => ({ ...prev, [fieldName]: '' }))
  }

  const handleSubmitDriverModal = async () => {
    const dErrors: string[] = []
    if (!driverModalForm.driver_name?.trim()) dErrors.push('Driver Name is required')
    if (!driverModalForm.mobile_no?.trim()) dErrors.push('Mobile Number is required')
    if (!driverModalForm.driving_licence_no?.trim()) dErrors.push('Driving Licence Number is required')
    if (dErrors.length > 0) {
      toast({
        title: "Validation Error",
        description: `Please fill in required fields: ${dErrors.join(", ")}`,
        variant: "destructive",
      })
      return
    }

    setIsSubmittingDriverModal(true)
    try {
      const res: any = editingDriver
        ? await driverMasterApi.update(editingDriver.id, driverModalForm)
        : await driverMasterApi.create(driverModalForm)
      if (res?.success) {
        toast({
          title: "Submitted Successfully",
          description: res.message || (editingDriver ? "Driver edit submitted for approver review" : "Driver submitted for approver approval"),
        })
        setIsDriverModalOpen(false)
        await fetchMasterData()
      } else {
        toast({ title: "Submission Failed", description: res?.message || "Failed to save driver", variant: "destructive" })
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to save driver", variant: "destructive" })
    } finally {
      setIsSubmittingDriverModal(false)
    }
  }

  const handleOpenAddTransporterModal = () => {
    setEditingTransporter(null)
    setIsTransporterModalOpen(true)
  }

  const handleOpenEditTransporterModal = (t: any) => {
    setEditingTransporter(t)
    setIsTransporterModalOpen(true)
  }

  const selectTransporter = (v: string) => {
    const isNormal = !['Company Vehicle', 'Party Vehicle'].includes(v);
    setFreightData(p => ({
      ...p,
      transporterName: v,
      freightRateType: isNormal ? p.freightRateType : "",
      freightAmount: isNormal ? p.freightAmount : "",
      cash_bank: isNormal ? p.cash_bank : "",
      diesel_advance: isNormal ? p.diesel_advance : "",
      bhada: isNormal ? p.bhada : ""
    }));
  }

  const availableDepots = useMemo(() => {
    return activeDepots.map(d => d.depot_name);
  }, [activeDepots]);

  useEffect(() => {
    if (availableDepots.length > 0 && (!selectedDepoTab || !availableDepots.includes(selectedDepoTab))) {
      const banari = availableDepots.find((d: string) => d.toLowerCase() === 'banari');
      setSelectedDepoTab(banari ?? availableDepots[0]);
    }
  }, [availableDepots, selectedDepoTab]);

  const fetchMasterData = async () => {
    try {
      const [vRes, tRes] = await Promise.all([
        vehicleMasterApi.getAll({ all: 'true', includePending: 'true' }),
        transportMasterApi.getAll({ all: 'true', includePending: 'true' })
      ]);
      const vehicles = vRes.success ? (vRes.data.vehicles || []) : [];
      if (vRes.success) setVehicleMaster(vehicles);
      const dRes = await driverMasterApi.getAll({ all: 'true', includePending: 'true' });
      const drivers = dRes.success ? (dRes.data.drivers || []) : [];
      if (dRes.success) setDriverMaster(drivers);
      if (tRes.success) {
        const allTransporters = tRes.data.transporters || [];
        setTransporterAll(allTransporters);
        // Pending transporters are listed in the Transporter dropdown only; the
        // vehicle form pickers keep offering approved ones.
        setTransporterMaster(allTransporters.filter((t: any) => t.approval_status !== 'pending'));
      }
      return { vehicles, drivers };
    } catch (error) {
      console.error("Failed to fetch master data:", error);
      return { vehicles: [], drivers: [] };
    }
  };

  useEffect(() => {
    fetchMasterData();
  }, []);

  // Planned (SKU-derived) gross weight of every currently-selected product —
  // there is no actual weighbridge reading at this stage (that only exists
  // later, at Actual Dispatch), so the overload check below is always against
  // this planned figure, not a measured gross/tare weight.
  const totalPackingWeightFromSku = useMemo(() => {
    return selectedGroups.flatMap(g => g._allProducts)
      .filter((prod: any) => dialogSelectedProducts.includes(prod._rowKey))
      .reduce((total, prod) => total + calculateGrossWeight(prod.productName, prod.qtyToDispatch), 0)
  }, [selectedGroups, dialogSelectedProducts, skus])

  // Payload limit for the overload check: passing weight = GVW - baseline tare, where the
  // baseline is the average tare recorded on this vehicle's earlier dispatches (its ULW on
  // the first trip). Display/check only: the saved passingWeight stays the master value.
  const [vehicleTareStats, setVehicleTareStats] = useState<{ avgTare: number | null; count: number } | null>(null)
  const selectedVehicleId = useMemo(
    () => vehicleMaster.find(v => v.registration_no === vehicleData.registration_no)?.id,
    [vehicleMaster, vehicleData.registration_no],
  )
  useEffect(() => {
    if (!selectedVehicleId) { setVehicleTareStats(null); return }
    let cancelled = false
    actualDispatchApi.getVehicleTareStats(selectedVehicleId).then((res: any) => {
      if (!cancelled && res?.success) setVehicleTareStats({ avgTare: res.data?.avgTare ?? null, count: res.data?.count ?? 0 })
    }).catch(() => { if (!cancelled) setVehicleTareStats(null) })
    return () => { cancelled = true }
  }, [selectedVehicleId])
  const effectivePassing = useMemo(() => {
    const gvw = Number(vehicleData.gvw) || 0
    const avg = vehicleTareStats && vehicleTareStats.count > 0 ? Number(vehicleTareStats.avgTare) || 0 : 0
    const baseTare = avg > 0 ? avg : Number(vehicleData.ulw) || 0
    if (gvw > 0 && baseTare > 0) return gvw - baseTare
    return parseFloat(vehicleData.passing_weight) || 0
  }, [vehicleData.gvw, vehicleData.ulw, vehicleData.passing_weight, vehicleTareStats])

  const filteredPendingOrders = pendingOrders.filter((order: any) => {
    let matches = true

    // Only rows planned but not yet actually dispatched belong on this stage's
    // pending list (a defensive client-side guard — the server already scopes
    // plan-vehicle/pending to rows before vehicle-plan confirmation).
    if (order.planned_1 === null || order.planned_1 === undefined || order.actual_1 !== null) {
      matches = false
    }

    const currentCustName = (order.transfer === 'yes' && order.bill_company_name) ? order.bill_company_name : (order.party_name || order.customerName)
    if (filterValues.partyName && filterValues.partyName !== "all" && currentCustName !== filterValues.partyName) {
      matches = false
    }

    if (filterValues.status) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const targetDateStr = order.deliveryDate || order.timestamp
      if (targetDateStr) {
        const targetDate = new Date(targetDateStr)
        if (filterValues.status === "expire") {
          if (targetDate < today) matches = true
          else matches = false
        } else if (filterValues.status === "on-time") {
          if (targetDate >= today) matches = true
          else matches = false
        }
      }
    }

    return matches
  })

  const displayRows = useMemo(() => {
    return groupOrdersByBaseDo(filteredPendingOrders, selectedDepoTab)
  }, [filteredPendingOrders, selectedDepoTab])

  // ── Shared stage-list table state (column search / sort / totals over the loaded page rows) ──
  const [visibleColumns, setVisibleColumns] = usePersistedColumns("plan-vehicle", PAGE_COLUMNS.map(c => c.id))
  const [columnOrder, setColumnOrder] = useColumnOrder("plan-vehicle", PAGE_COLUMNS.map(c => c.id))
  const orderedVisibleCols = useMemo(() =>
    columnOrder
      .map(id => PAGE_COLUMNS.find(c => c.id === id))
      .filter((c): c is typeof PAGE_COLUMNS[number] => !!c && visibleColumns.includes(c.id as PlanColId)),
    [columnOrder, visibleColumns]
  )
  const handleColumnReorder = useCallback((newVisibleOrder: string[]) => {
    const hiddenCols = columnOrder.filter(id => !visibleColumns.includes(id as PlanColId))
    setColumnOrder([...newVisibleOrder, ...hiddenCols])
  }, [columnOrder, visibleColumns, setColumnOrder])

  const uniqueCustomers = useMemo(() => Array.from(new Set(displayRows.map((r: any) => r.customerName).filter(Boolean))).sort() as string[], [displayRows])
  const uniqueDeliveryFrom = useMemo(() => Array.from(new Set(displayRows.map((r: any) => r._allProducts?.[0]?.deliveryFrom).filter(Boolean))).sort() as string[], [displayRows])

  const baseFilter = useCallback((row: any) => {
    if (customerFilter !== "ALL" && row.customerName !== customerFilter) return false
    if (deliveryFromFilter !== "ALL" && row._allProducts?.[0]?.deliveryFrom !== deliveryFromFilter) return false
    const q = quickSearch.trim().toLowerCase()
    if (q) {
      const hay = [row.orderNo, row.processId, row.customerName, row.depoName, row._allProducts?.[0]?.deliveryFrom].filter(Boolean).join(" ").toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  }, [customerFilter, deliveryFromFilter, quickSearch])

  const table = useStageTable<any>({ rows: displayRows, columns: PLAN_TABLE_COLUMNS, baseFilter, persistKey: "plan-vehicle" })
  const tableRows = table.rows
  const activeFiltersCount =
    (customerFilter !== "ALL" ? 1 : 0) + (deliveryFromFilter !== "ALL" ? 1 : 0) + (quickSearch.trim() ? 1 : 0) + table.activeColumnFilterCount
  const clearAllFilters = () => {
    patchListView({ customerFilter: "ALL", deliveryFromFilter: "ALL", quickSearch: "" })
    table.clearColumnFilters()
  }
  const totalsColumns = useMemo<StageColDef<any>[]>(
    () => [{ id: "__sel", label: "" }, ...orderedVisibleCols.map(c => PLAN_TABLE_COLUMNS.find(t => t.id === c.id)!)],
    [orderedVisibleCols]
  )

  // Accumulates every group ever rendered, keyed by _rowKey — kept only as a
  // fallback; fetchCompleteGroupsForKeys below is the primary source of truth.
  const selectedGroupsCacheRef = useRef<Record<string, any>>({})
  useEffect(() => {
    displayRows.forEach((row: any) => {
      selectedGroupsCacheRef.current[row._rowKey] = row
    })
  }, [displayRows])

  // Fetches a fresh, complete, authoritative set of every pending shipment for
  // each requested base-DO key directly from the server — a DO's pending
  // shipments can be split across pages of the general list, so neither the
  // current page nor the cache above can be trusted to be complete.
  const fetchCompleteGroupsForKeys = useCallback(async (keys: string[]): Promise<Record<string, any>> => {
    const allowedDepots = user?.depo_access?.['Plan Vehicle'] || []
    const byKey: Record<string, any> = {}
    await Promise.all(keys.map(async (key) => {
      try {
        const response = await planVehicleApi.getPending({
          page: 1,
          limit: 200,
          search: key,
          depo_names: allowedDepots,
        })
        if (!response.success) return
        const rows = (response.data?.dispatches || []).filter((order: any) => {
          const doNumber = order.so_no || order.soNo || ""
          const baseDoMatch = doNumber.match(/^(DO[-\/](?:\d{2}-\d{2}\/)?\d+)/i)
          const baseDo = baseDoMatch ? baseDoMatch[1].toUpperCase() : doNumber.toUpperCase()
          return baseDo === key
        })
        const groups = groupOrdersByBaseDo(rows, "")
        const match = groups.find((g: any) => g._rowKey === key)
        if (match) byKey[key] = match
      } catch {
        // Swallow — the caller falls back to the cache/passed-in group below.
      }
    }))
    return byKey
  }, [user?.depo_access])

  const toggleSelectAll = () => {
    const currentPageKeys = tableRows.map((row: any) => row._rowKey)
    const allCurrentSelected = currentPageKeys.length > 0 && currentPageKeys.every((k) => selectedOrders.includes(k))
    if (allCurrentSelected) {
      setSelectedOrders(selectedOrders.filter((k) => !currentPageKeys.includes(k)))
    } else {
      setSelectedOrders(Array.from(new Set([...selectedOrders, ...currentPageKeys])))
    }
  }

  const toggleSelectOrder = (rowKey: string) => {
    if (!rowKey) return
    if (selectedOrders.includes(rowKey)) {
      setSelectedOrders(selectedOrders.filter((id) => id !== rowKey))
    } else {
      setSelectedOrders([...selectedOrders, rowKey])
    }
  }

  const toggleSelectDialogProduct = (key: string) => {
    if (dialogSelectedProducts.includes(key)) {
      setDialogSelectedProducts(prev => prev.filter(k => k !== key))
    } else {
      setDialogSelectedProducts(prev => [...prev, key])
    }
  }

  // Fills vehicleData/driverData from a vehicle_master record. Always call this
  // with a fresh `selectedV` (from a just-refetched vehicleMaster) rather than
  // trusting stale state, since these fields are master-derived.
  const autofillVehicleData = (selectedV: any) => {
    const isLifetimeTax = !!(selectedV.life_time_tax || selectedV.life_time_tax_image);
    setVehicleData(p => ({
      ...p,
      registration_no: selectedV.registration_no || "",
      vehicle_type: selectedV.vehicle_type || "",
      rto: selectedV.rto || "",
      passing_weight: selectedV.passing || "",
      fitness_end_date: selectedV.fitness ? new Date(selectedV.fitness).toISOString().split('T')[0] : "",
      insurance_end_date: selectedV.insurance ? new Date(selectedV.insurance).toISOString().split('T')[0] : "",
      tax_end_date: (!isLifetimeTax && selectedV.road_tax) ? new Date(selectedV.road_tax).toISOString().split('T')[0] : "",
      is_lifetime_tax: isLifetimeTax,
      fuel_type: selectedV.fuel_type || "",
      pollution_end_date: selectedV.fuel_type === 'Electrical' ? "" : (selectedV.pollution ? new Date(selectedV.pollution).toISOString().split('T')[0] : ""),
      permit1_end_date: selectedV.state_permit ? new Date(selectedV.state_permit).toISOString().split('T')[0] : "",
      permit2_end_date: selectedV.national_permit ? new Date(selectedV.national_permit).toISOString().split('T')[0] : "",
      fitness: selectedV.fitness_image || "",
      insurance: selectedV.insurance_image || "",
      tax_copy: (isLifetimeTax ? selectedV.life_time_tax_image : selectedV.road_tax_image) || "",
      polution: selectedV.pollution_image || "",
      permit1: selectedV.state_permit_image || "",
      permit2_out_state: selectedV.national_permit_image || "",
      fitness_file_name: selectedV.fitness_image ? "fitness_doc" : "",
      insurance_file_name: selectedV.insurance_image ? "insurance_doc" : "",
      tax_file_name: (isLifetimeTax ? selectedV.life_time_tax_image : selectedV.road_tax_image) ? "tax_doc" : "",
      pollution_file_name: selectedV.pollution_image ? "pollution_doc" : "",
      permit1_file_name: selectedV.state_permit_image ? "permit1_doc" : "",
      permit2_file_name: selectedV.national_permit_image ? "permit2_doc" : "",
      gvw: selectedV.gvw || "",
      ulw: selectedV.ulw || "",
    }));
    setFreightData(p => ({
      ...p,
      transporterName: selectedV.transporter || p.transporterName
    }));
  };

  const resetDialogForms = (targetGroups: any[]) => {
    setVehicleNumber("")
    setVehicleData({
      checkStatus: "", remarks: "", fitness: "", insurance: "", tax_copy: "", polution: "",
      permit1: "", permit2_out_state: "", fitness_file_name: "", insurance_file_name: "",
      tax_file_name: "", pollution_file_name: "", permit1_file_name: "", permit2_file_name: "",
      fitness_end_date: "", insurance_end_date: "", tax_end_date: "", pollution_end_date: "",
      permit1_end_date: "", permit2_end_date: "", registration_no: "", vehicle_type: "", rto: "",
      passing_weight: "", road_tax: "", is_lifetime_tax: false, fuel_type: "", gvw: "", ulw: "",
    })
    setDriverName("")
    setDriverData({ contact_no: "", license_no: "", license_type: "", valid_upto: "", trans_valid_upto: "", lmv_valid_upto: "" })
    setFreightData({
      transporterName: "", vehicleNoPlateImage: "", vehicleNoPlateImage_file_name: "",
      overloadRemarks: "", freightRateType: "", freightAmount: "", cdAmount: "", finalRate: "",
      cash_bank: "", diesel_advance: "", bhada: "",
    })
  }

  const handleOpenDialog = async (group?: any) => {
    // Resolve selected DOs to a fresh, complete, authoritative set fetched
    // directly from the server — a DO's pending shipments can be split across
    // pages of the general list, so neither the current page nor the
    // cross-page cache can be trusted to be complete.
    const keys = group ? [group._rowKey] : [...selectedOrders]
    const fetchedByKey = await fetchCompleteGroupsForKeys(keys)
    const targetGroups = keys
      .map((key) => fetchedByKey[key] || selectedGroupsCacheRef.current[key] || (group && group._rowKey === key ? group : null))
      .filter(Boolean);

    if (targetGroups.length > 0) {
      // Refresh vehicle/driver/transporter master data so autofill reflects
      // documents uploaded since page load.
      await fetchMasterData();

      setSelectedGroups(targetGroups)
      const allKeys = targetGroups.flatMap(g => g._allProducts.map((p: any) => p._rowKey));
      setDialogSelectedProducts(allKeys)
      setIsDialogOpen(true)
      resetDialogForms(targetGroups)
    }
  }

  const buildSlipParties = () => {
    const productsForSlip = selectedGroups.flatMap((group: any) =>
      group._allProducts.filter((p: any) => dialogSelectedProducts.includes(p._rowKey))
    );
    const partyGroups: Record<string, any[]> = {};
    productsForSlip.forEach((p: any) => {
      const pName = p.customerName || p.party_name || p.partyName || "Unknown Party";
      if (!partyGroups[pName]) partyGroups[pName] = [];
      partyGroups[pName].push(p);
    });
    return Object.entries(partyGroups).map(([party, partyProducts]) => {
      const firstProd = partyProducts[0];
      const orderThrough = firstProd.orderThrough || firstProd.is_order_through || "Direct";
      const referenceLabel = orderThrough === "Broker" ? "Broker" : orderThrough === "Salesperson" ? "Salesperson" : "";
      const referenceValue = orderThrough === "Broker"
        ? (firstProd.brokerName || firstProd.broker_name || "—")
        : orderThrough === "Salesperson"
          ? (firstProd.salespersonName || firstProd.salesperson_name || "—")
          : "Direct";
      return {
        party,
        commitmentNo: firstProd.orderNo || "—",
        date: new Date().toLocaleDateString('en-GB'),
        referenceLabel,
        referenceValue,
        place: firstProd.address || firstProd.customer_delivery_address || firstProd.customer_address || "—",
        partyMo: firstProd.whatsapp || firstProd.customer_contact_person_whatsapp_no || firstProd.party_mo || firstProd.mobile || "—",
        status: firstProd.has_prior_dispatch ? "Pending" : "Original",
        processId: firstProd.processid || firstProd.process_id || firstProd.processId || "—",
        punchBy: firstProd.order_punch_user || "—",
        punchAt: firstProd.order_punch_at || null,
        preApproveBy: firstProd.pre_approval_user || "—",
        preApproveAt: firstProd.pre_approval_at || null,
        approveBy: firstProd.order_approval_user || "—",
        approveAt: firstProd.order_approval_at || null,
        products: partyProducts.map((prod: any) => {
          const qty = parseFloat(prod.qtyToDispatch || "0");
          return {
            productName: prod.productName || "—",
            uom: prod.uom || "PCS",
            qty,
            weight: calculateWeight(prod.productName, qty),
            grossWeight: calculateGrossWeight(prod.productName, qty),
          };
        }),
      };
    });
  };

  const handleDownloadSlip = () => {
    if (selectedGroups.length === 0 || dialogSelectedProducts.length === 0) {
      toast({ title: "Error", description: "Please select products to download slip", variant: "destructive" });
      return;
    }
    generateDispatchSlipPdf(buildSlipParties(), "gate-pass.pdf", { title: "Gate Pass" });
  };

  const handlePrintSlip = () => {
    if (selectedGroups.length === 0 || dialogSelectedProducts.length === 0) {
      toast({ title: "Error", description: "Please select products to print slip", variant: "destructive" });
      return;
    }
    generateDispatchSlipPdf(buildSlipParties(), "gate-pass.pdf", { print: true, title: "Gate Pass" });
  };

  const closeSlipDialog = () => {
    setIsSlipDialogOpen(false)
    setSelectedGroups([])
    setDialogSelectedProducts([])
    setSelectedOrders([])
  }

  const submitPlanVehicle = async () => {
    setIsProcessing(true)
    try {
      if (selectedGroups.length === 0 || dialogSelectedProducts.length === 0) {
        setIsDialogOpen(false);
        return;
      }

      const successfulItems: any[] = []
      const failedItems: any[] = []

      const itemsToProcess = selectedGroups.flatMap(g =>
        g._allProducts.filter((p: any) => dialogSelectedProducts.includes(p._rowKey))
      )

      const numOrUndef = (v: any): number | undefined => {
        if (v === "" || v === null || v === undefined) return undefined;
        const n = parseFloat(v);
        return isNaN(n) ? undefined : n;
      };

      // v2-native camelCase payload (backend: /api/v1/plan-vehicle/submit/:id).
      // Same vehicle-assignment payload submitted for every selected shipment —
      // no weightment/actualQtyDispatch fields belong on this stage.
      const payload = {
        registrationNo: vehicleNumber || vehicleData.registration_no || undefined,
        driverName: driverName || undefined,
        drivingLicenceNo: driverData.license_no || undefined,
        transporterName: freightData.transporterName || undefined,

        checkStatus: vehicleData.checkStatus || undefined,
        remarks: vehicleData.remarks || undefined,

        vehicleNoPlateImage: freightData.vehicleNoPlateImage || undefined,

        fitnessImage: vehicleData.fitness || undefined,
        fitnessEndDate: vehicleData.fitness_end_date || undefined,
        insuranceImage: vehicleData.insurance || undefined,
        insuranceEndDate: vehicleData.insurance_end_date || undefined,
        taxCopyImage: vehicleData.tax_copy || undefined,
        taxEndDate: vehicleData.tax_end_date || undefined,
        pollutionImage: vehicleData.polution || undefined,
        pollutionEndDate: vehicleData.pollution_end_date || undefined,
        permit1Image: vehicleData.permit1 || undefined,
        permit1EndDate: vehicleData.permit1_end_date || undefined,
        permit2OutStateImage: vehicleData.permit2_out_state || undefined,
        permit2EndDate: vehicleData.permit2_end_date || undefined,

        // Snapshot of the payload limit used for this plan (GVW - baseline tare), so later stages show the same number.
        passingWeight: effectivePassing > 0 ? effectivePassing : numOrUndef(vehicleData.passing_weight),
        vehicleOverloadRemarks: freightData.overloadRemarks || undefined,

        freightRateType: freightData.freightRateType || undefined,
        freightAmount: numOrUndef(freightData.freightAmount),
        cdAmount: numOrUndef(freightData.cdAmount),
        advanceBhadaBank: numOrUndef(freightData.cash_bank),
        advanceBhadaDieselAdvance: numOrUndef(freightData.diesel_advance),
        advanceBhadaCash: numOrUndef(freightData.bhada),
        finalRate: numOrUndef(freightData.finalRate),

        userId: user?.id || null,
      };

      for (const item of itemsToProcess) {
        const dispatchId = item.id;
        try {
          const res = await planVehicleApi.submit(dispatchId, payload);
          if (!res.success) throw new Error(res.message);
          successfulItems.push(item);
        } catch (error: any) {
          console.error('[PLAN VEHICLE SUBMISSION ERROR]', { dispatchId, error });
          const fieldErrors = Array.isArray(error?.errors) ? error.errors.map((e: any) => e?.message).filter(Boolean).join('; ') : ''
          failedItems.push({ item, error: [error?.message, fieldErrors].filter(Boolean).join(' — ') || 'Unknown error', code: error?.code });
        }
      }

      if (successfulItems.length > 0) {
        toast({
          title: "Vehicle Plan Confirmed",
          description: `${successfulItems.length} item(s) assigned a vehicle/transporter. Generate the Gate Pass below.`,
        });

        setIsDialogOpen(false);
        // selectedGroups/dialogSelectedProducts intentionally NOT cleared yet —
        // the Gate Pass slip dialog (opened below) still needs them. They're
        // reset when that dialog is closed (see closeSlipDialog).
        setIsSlipDialogOpen(true);

        await refetchPending();
        queryClient.invalidateQueries({ queryKey: ["plan-vehicle-history"] });
      }

      const staleWrites = failedItems.filter((f: any) => isStaleWriteError(f));
      const otherFailures = failedItems.filter((f: any) => !isStaleWriteError(f));

      if (staleWrites.length > 0) {
        toast({
          title: "Already processed",
          description: `${staleWrites.length} item(s) were already planned or moved by another user. Refreshing the list…`,
          variant: "destructive",
        })
        await refetchPending();
        queryClient.invalidateQueries({ queryKey: ["plan-vehicle-history"] });
      }

      if (otherFailures.length > 0) {
        toast({
          title: "Partial Success",
          description: `${otherFailures.length} item(s) failed to save. ${otherFailures[0]?.error || ''}`.trim(),
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false)
    }
  }

  const performPlanVehicleConfirmation = async () => {
    const isBanari = selectedDepoTab?.toUpperCase() === 'BANARI';
    const validationErrors: string[] = [];
    const docWarnings: string[] = [];

    if (isBanari) {
      const hasVehicle = !!vehicleNumber.trim();
      if (!hasVehicle && !freightData.transporterName.trim()) {
        validationErrors.push("Either a Vehicle No. or a Transporter Name is required");
      }

      // Everything below only applies once a specific vehicle has actually been
      // selected — if the user went the "Transporter only" route (vehicle not
      // yet known, to be filled in later at Gate In per spec), there's no
      // vehicle to check documents/overload/permits against yet.
      if (hasVehicle) {
        const vehicleDocs = [
          { key: 'fitness', label: 'Fitness' },
          { key: 'fitness_end_date', label: 'Fitness Expiry' },
          { key: 'insurance', label: 'Insurance' },
          { key: 'insurance_end_date', label: 'Insurance Expiry' },
          { key: 'tax_copy', label: 'Tax' },
          { key: 'tax_end_date', label: 'Tax Expiry' },
          { key: 'polution', label: 'Pollution' },
          { key: 'pollution_end_date', label: 'Pollution Expiry' },
          { key: 'permit1', label: 'Permit 1' },
          { key: 'permit1_end_date', label: 'Permit 1 Expiry' },
          { key: 'permit2_out_state', label: 'Permit 2' },
          { key: 'permit2_end_date', label: 'Permit 2 Expiry' },
        ];

        const isPermitApplicable = vehicleData.gvw !== '' && Number(vehicleData.gvw) > 3000;

        for (const doc of vehicleDocs) {
          const val = vehicleData[doc.key as keyof typeof vehicleData];
          if (doc.key === 'permit2_out_state' || doc.key === 'permit2_end_date') continue;
          if ((doc.key === 'permit1' || doc.key === 'permit1_end_date') && !isPermitApplicable) continue;
          if (doc.key === 'tax_end_date' && vehicleData.is_lifetime_tax) continue;
          if ((doc.key === 'polution' || doc.key === 'pollution_end_date') && vehicleData.fuel_type === 'Electrical') continue;

          if (!val) {
            const message = `${doc.label} is missing for this vehicle. Please upload/fill it before confirming the vehicle plan for BANARI.`;
            if (doc.key === 'tax_copy' || doc.key === 'tax_end_date' || doc.key === 'polution' || doc.key === 'pollution_end_date') {
              docWarnings.push(message);
            } else {
              validationErrors.push(message);
            }
          }
        }

        if (!vehicleData.checkStatus) {
          validationErrors.push("Vehicle Check Status is required");
        }
        if (vehicleData.checkStatus === "Reject" && !vehicleData.remarks.trim()) {
          validationErrors.push("Vehicle Remarks are required for rejection");
        }

        const dateFields = [
          { key: 'fitness_end_date', label: 'Fitness' },
          { key: 'insurance_end_date', label: 'Insurance' },
          { key: 'tax_end_date', label: 'Tax' },
          { key: 'pollution_end_date', label: 'Pollution' },
          { key: 'permit1_end_date', label: 'Permit 1' },
          { key: 'permit2_end_date', label: 'Permit 2' },
        ];

        for (const field of dateFields) {
          const dateVal = vehicleData[field.key as keyof typeof vehicleData];
          if (dateVal && dateVal < minDate) {
            const message = `${field.label} End Date must be at least 5 days from today (Min: ${formatDate(minDate)})`;
            if (field.key === 'tax_end_date' || field.key === 'pollution_end_date') {
              docWarnings.push(message);
            } else {
              validationErrors.push(message);
            }
          }
        }

        const passingWt = effectivePassing;
        const isOverloaded = passingWt > 0 && totalPackingWeightFromSku > passingWt;
        if (isOverloaded && !freightData.overloadRemarks.trim()) {
          validationErrors.push("Overload remarks are mandatory as the vehicle is overloaded.");
        }

        if (isInterState && Number(vehicleData.gvw) > 3000 && (!vehicleData.permit2_end_date || !vehicleData.permit2_out_state || vehicleData.permit2_out_state === 'pending')) {
          validationErrors.push("National / Other State Permit is mandatory for interstate dispatches.");
        }
      }
    }

    // Route must be confirmed on every depot once a vehicle is selected.
    if (vehicleNumber.trim() && routeNeedsConfirm) {
      validationErrors.push("Delivery state could not be detected. Select the Route (National / Within State) before dispatch.");
    }

    // Client spec: warn the user if any of the selected vehicle's documents have
    // expired. BANARI already gets the full check above; for the other depots
    // this is a warning only (never blocks the plan).
    if (!isBanari && vehicleNumber.trim()) {
      const todayStr = new Date().toISOString().split("T")[0];
      const expiryFields = [
        { key: 'fitness_end_date', label: 'Fitness' },
        { key: 'insurance_end_date', label: 'Insurance' },
        { key: 'tax_end_date', label: 'Tax' },
        { key: 'pollution_end_date', label: 'Pollution' },
        { key: 'permit1_end_date', label: 'Permit 1' },
        { key: 'permit2_end_date', label: 'Permit 2' },
      ];
      for (const field of expiryFields) {
        const dateVal = vehicleData[field.key as keyof typeof vehicleData];
        if (dateVal && String(dateVal) < todayStr) {
          docWarnings.push(`${field.label} has expired (valid up to ${formatDate(String(dateVal))}).`);
        }
      }
      if (isInterState && Number(vehicleData.gvw) > 3000 && (!vehicleData.permit2_end_date || !vehicleData.permit2_out_state || vehicleData.permit2_out_state === 'pending')) {
        docWarnings.push("National / Other State Permit is missing for an interstate dispatch.");
      }
    }

    if (validationErrors.length > 0) {
      toast({
        title: `${validationErrors.length} Validation ${validationErrors.length > 1 ? 'Issues' : 'Issue'} Found`,
        description: (
          <ul className="list-disc pl-4 space-y-0.5">
            {validationErrors.map((err, i) => <li key={i}>{err}</li>)}
          </ul>
        ),
        variant: "destructive"
      });
      return;
    }

    if (docWarnings.length > 0) {
      setDocWarningDialog({ open: true, messages: docWarnings });
      return;
    }

    await submitPlanVehicle();
  }

  const handleRevert = async () => {
    if (!revertRemarks.trim()) {
      toast({ title: "Validation Error", description: "Revert remarks are required", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    try {
      const itemsToRevert = selectedGroups.flatMap(g =>
        g._allProducts.filter((p: any) => dialogSelectedProducts.includes(p._rowKey))
      );

      if (itemsToRevert.length === 0) {
        toast({ title: "Error", description: "No products selected to revert", variant: "destructive" });
        setIsProcessing(false);
        return;
      }

      const successfulReverts: any[] = [];
      const failedReverts: any[] = [];

      for (const item of itemsToRevert) {
        const dispatchId = item.id;
        if (!dispatchId) continue;

        try {
          const res = await planVehicleApi.revertToDispatchPlanning(dispatchId, user?.id || null, revertRemarks.trim());
          if (res.success) {
            successfulReverts.push(item);
          } else {
            failedReverts.push({ item, message: res.message });
          }
        } catch (err: any) {
          failedReverts.push({ item, message: err.message });
        }
      }

      if (successfulReverts.length > 0) {
        toast({
          title: "Revert Successful",
          description: `${successfulReverts.length} item(s) sent back to Dispatch Planning.`,
        });

        setIsDialogOpen(false);
        setSelectedOrders([]);
        setDialogSelectedProducts([]);
        setSelectedGroups([]);
        setRevertRemarks("");

        await refetchPending();
        queryClient.invalidateQueries({ queryKey: ["plan-vehicle-history"] });
      }

      if (failedReverts.length > 0) {
        const messages = Array.from(new Set(failedReverts.map((f) => f.message).filter(Boolean)));
        toast({
          title: successfulReverts.length > 0 ? "Partial Revert Failure" : "Revert Failed",
          description: messages[0] || `Failed to revert ${failedReverts.length} item(s).`,
          variant: "destructive",
        });
        if (successfulReverts.length === 0) {
          await refetchPending()
          queryClient.invalidateQueries({ queryKey: ["plan-vehicle-history"] });
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "An unexpected error occurred during revert",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const passingWt = effectivePassing;
  const isOverloaded = passingWt > 0 && totalPackingWeightFromSku > passingWt;

  return (
    <WorkflowStageShell
      persistKey="plan-vehicle"
      title="Stage 5: Plan Vehicle"
      description="Consolidate DOs, assign a vehicle/transporter, and generate the gate pass."
      pendingCount={displayRows.length}
      historyData={[]}
      partyNames={customerNameOptions}
      onFilterChange={setFilterValues}
      remarksColName="Confirmation"
      showStatusFilter={true}
      onTabChange={setActiveTab}
      showDateFilters={true}
      showSaudaFilter={true}
      dateLabel="DO Date"
      searchPlaceholder="Search DO Number..."
      historyContent={
        <StageHistoryTab
          queryKeyPrefix="plan-vehicle-history"
          getHistoryApi={(params: any) => planVehicleApi.getHistory({
            page: params.page,
            limit: params.limit,
            search: params.order_no,
            manual_sauda_no: filterValues.manualSaudaNo || undefined,
            do_date_from: params.start_date,
            do_date_to: params.end_date,
            party_name: params.customer_name,
            depo_names: selectedDepoTab ? [selectedDepoTab] : (user?.depo_access?.['Plan Vehicle'] || undefined),
          })}
          filterValues={filterValues}
          activeTab={activeTab}
          stageName="Plan Vehicle"
          stageLevel={4}
          remarksColName="Vehicle Confirmation"
          orderListKey="dispatches"
          mapOrderNo={(order: any) => order.so_no || "-"}
          mapCustomerName={(order: any) => (order.transfer === 'yes' && order.bill_company_name) ? order.bill_company_name : order.party_name}
          getDate={(order: any) => order.actual_1 || order.timestamp || null}
        />
      }
    >
      <div className="space-y-4">
        <StageActionBar>
          <Button
            onClick={() => handleOpenDialog()}
            disabled={selectedOrders.length === 0}
            className="h-9 text-xs font-black uppercase tracking-tight"
            title={isReadOnly ? "View Vehicle Plan" : "Plan Vehicle"}
          >
            Plan Vehicle ({selectedOrders.length})
          </Button>
                </StageActionBar>

        {availableDepots.length > 0 && (
          <div className="mt-4 mb-2">
            <Tabs value={selectedDepoTab} onValueChange={setSelectedDepoTab} className="w-full overflow-hidden">
              <TabsList className="w-full bg-slate-100/50 p-1 h-auto flex overflow-x-auto justify-start gap-1 border border-slate-200/60 rounded-xl shadow-sm">
                {availableDepots.map((depoName: string) => (
                  <TabsTrigger
                    key={depoName}
                    value={depoName}
                    className="shrink-0 px-4 sm:px-6 py-2.5 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm rounded-lg transition-all"
                  >
                    {depoName}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        )}

        <Card className="border border-slate-200/80 shadow-xs overflow-clip py-0 gap-0 stage-card">
          <StageListHeader
            title="Vehicle Planning List"
            shown={tableRows.length}
            total={displayRows.length}
            description="Orders ready to be consolidated and assigned a vehicle"
            searchValue={quickSearch}
            onSearchChange={setQuickSearch}
            searchPlaceholder="Search DO, Customer, Depot..."
          >
            <StageToolbar
              shown={tableRows.length}
              total={displayRows.length}
              activeCount={activeFiltersCount}
              onReset={clearAllFilters}
              filters={
                <>
                  <StageFilterSelect value={customerFilter} onChange={setCustomerFilter} allLabel="All Customers" options={uniqueCustomers} />
                  <StageFilterSelect value={deliveryFromFilter} onChange={setDeliveryFromFilter} allLabel="All Delivery From" options={uniqueDeliveryFrom} />
                  <StageDivider />
                  <StageColumnsMenu
                    columns={[...PAGE_COLUMNS]}
                    visibleColumns={visibleColumns}
                    setVisibleColumns={setVisibleColumns}
                    show={isAdmin || isFeatureEnabled('can_toggle_columns')}
                  />
                </>
              }
            />
            <StageActiveChips
              chips={[
                ...(customerFilter !== "ALL" ? [{ label: `Customer: ${customerFilter}`, onClear: () => setCustomerFilter("ALL") }] : []),
                ...(deliveryFromFilter !== "ALL" ? [{ label: `Delivery From: ${deliveryFromFilter}`, onClear: () => setDeliveryFromFilter("ALL") }] : []),
                ...(quickSearch.trim() ? [{ label: `Search: ${quickSearch.trim()}`, onClear: () => setQuickSearch("") }] : []),
              ]}
            />
          </StageListHeader>
          <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table>
            <StageTableHeaderRows
              columns={orderedVisibleCols.map(c => PLAN_TABLE_COLUMNS.find(t => t.id === c.id)!)}
              table={table}
              leading={
                <Checkbox
                  checked={tableRows.length > 0 && tableRows.every((row: any) => selectedOrders.includes(row._rowKey))}
                  onCheckedChange={toggleSelectAll}
                />
              }
              alwaysShowTotals
              onReorder={handleColumnReorder}
              dragDisabled={!isAdmin && !isFeatureEnabled('can_reorder_columns')}
            />
            <TableBody>
              {isPendingLoading && pendingOrders.length === 0 ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i} className="opacity-40 border-b border-slate-50">
                    <TableCell className="text-left px-4 py-4"><div className="h-4 w-4 bg-slate-200 animate-pulse rounded" /></TableCell>
                    {[...Array(orderedVisibleCols.length)].map((__, j) => (
                      <TableCell key={j} className="py-4"><div className="h-3 w-16 bg-slate-200 animate-pulse rounded-full mx-auto" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : tableRows.length > 0 ? (
                tableRows.map((row: any) => {
                  const rowKey = row._rowKey;
                  const firstProd = row._allProducts?.[0] || {};
                  return (
                    <TableRow key={rowKey} className={selectedOrders.includes(rowKey) ? "bg-blue-50/50" : ""}>
                      <TableCell className="text-left px-4">
                        <Checkbox
                          checked={selectedOrders.includes(rowKey)}
                          onCheckedChange={() => toggleSelectOrder(rowKey)}
                        />
                      </TableCell>
                      {orderedVisibleCols.map(col => {
                        switch (col.id) {
                          case "partySoDate":
                            return <TableCell key={col.id} className="whitespace-nowrap px-4 text-xs text-slate-600 text-right tabular-nums">{row.partySoDate || "—"}</TableCell>
                          case "orderNo":
                            return <TableCell key={col.id} className="whitespace-nowrap px-4 text-xs text-blue-700 font-bold">{row.orderNo || "—"}</TableCell>
                          case "processId":
                            return <TableCell key={col.id} className="whitespace-nowrap px-4 text-xs text-slate-600">{row.processId || "—"}</TableCell>
                          case "customerName":
                            return <TableCell key={col.id} className="whitespace-nowrap px-4 text-xs text-slate-600">{row.customerName || "—"}</TableCell>
                          case "depoName":
                            return <TableCell key={col.id} className="whitespace-nowrap px-4 text-xs text-slate-600">{row.depoName || "—"}</TableCell>
                          case "qtyToDispatch":
                            return (
                              <TableCell key={col.id} className="whitespace-nowrap px-4 text-xs text-slate-600 text-right font-mono tabular-nums">
                                {row._productCount > 1 && <span className="mr-2 text-[10px] text-slate-400 font-sans">({row._productCount} items)</span>}
                                {fmtNum(row.qtyToDispatch)}
                              </TableCell>
                            )
                          case "deliveryFrom":
                            return <TableCell key={col.id} className="whitespace-nowrap px-4 text-xs text-slate-600">{firstProd.deliveryFrom || "—"}</TableCell>
                          case "status":
                            return (
                              <TableCell key={col.id} className="whitespace-nowrap px-4 text-xs">
                                <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200">Ready to Plan</Badge>
                              </TableCell>
                            )
                        }
                      })}
                    </TableRow>
                  )
                })
              ) : displayRows.length > 0 ? (
                <TableRow>
                  <TableCell colSpan={orderedVisibleCols.length + 1} className="text-center py-12 text-muted-foreground">
                    <p className="font-medium text-slate-500">No matching records found</p>
                    <button onClick={clearAllFilters} className="text-xs text-blue-600 hover:underline mt-1 font-semibold">Clear Filters</button>
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow>
                  <TableCell colSpan={orderedVisibleCols.length + 1} className="text-center py-8 text-muted-foreground">
                    No orders pending vehicle planning
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>

          <StagePagination
            page={displayRows.length > 0 ? pendingPage : 0}
            totalPages={pendingResult?.pagination?.totalPages || 1}
            total={displayRows.length}
            noun="Items"
            onPrev={() => setPendingPage(p => Math.max(1, p - 1))}
            onNext={() => setPendingPage(p => p + 1)}
            prevDisabled={pendingPage === 1 || displayRows.length === 0}
            nextDisabled={displayRows.length === 0 || pendingPage >= (pendingResult?.pagination?.totalPages || 1)}
          />
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:w-[95vw] sm:!max-w-[95vw] max-h-[95dvh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] p-0">
          <div className="p-4 sm:p-6 lg:p-8">
            <DialogHeader className="border-b pb-4 sm:pb-6 mb-4 sm:mb-6 pr-8">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <DialogTitle className="text-lg sm:text-xl lg:text-2xl font-black text-slate-900 tracking-tight flex flex-wrap items-start gap-3 leading-tight">
                  <Truck className="h-6 w-6 sm:h-7 sm:w-7 text-blue-600 shrink-0" />
                  Plan Vehicle - {selectedGroups.length > 1 ? `${selectedGroups.length} Customer Groups` : selectedGroups[0]?.customerName}
                </DialogTitle>
              </div>
              <DialogDescription className="text-slate-500 font-medium text-sm sm:text-base mt-2">
                Consolidate the selected DOs, assign a vehicle/transporter, and confirm to generate the Gate Pass.
              </DialogDescription>
            </DialogHeader>

            {selectedGroups.length > 0 && (
              <div className="space-y-8 mt-6">
                {/* 1. Consolidated DO summary */}
                <div className="space-y-3">
                  {selectedGroups.map((group) => (
                    <div key={group._rowKey} className="flex flex-wrap items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                      <Badge className="bg-blue-600 text-white px-3 py-1 font-black">{group.customerName}</Badge>
                      {Array.from(group._allBaseDos as Set<string>).map((baseDo: string) => (
                        <Badge key={baseDo} variant="outline" className="text-blue-700 border-blue-200 font-bold">{baseDo}</Badge>
                      ))}
                      <span className="text-[11px] text-slate-500 font-bold uppercase tracking-tighter">{group._productCount} product(s) · Depot: {group.depoName}</span>
                    </div>
                  ))}
                </div>

                {/* 2. Consolidated Product List */}
                <div className="space-y-4">
                  <h3 className="text-base sm:text-lg font-black text-slate-800 flex flex-wrap items-center gap-2 uppercase tracking-tight border-b-2 border-slate-100 pb-3">
                    Consolidated Product List
                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">{dialogSelectedProducts.length} / {selectedGroups.reduce((s, g) => s + g._allProducts.length, 0)} Items</Badge>
                  </h3>
                  <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-sm bg-white">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow className="bg-slate-100/90 border-b-2 border-slate-300 font-bold text-xs text-slate-800 hover:bg-slate-100/90">
                          <TableCell className="w-12 px-3" />
                          <TableCell className="px-4 font-black text-slate-900 uppercase tracking-wider text-[11px]">Total ({dialogSelectedProducts.length})</TableCell>
                          <TableCell className="px-4" />
                          <TableCell className="px-4" />
                          <TableCell className="px-4" />
                          <TableCell className="px-4" />
                          <TableCell className="px-4 text-right font-mono tabular-nums font-black text-purple-700">{fmtNum(totalPackingWeightFromSku)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableHead className="w-12 text-left px-4">
                            <Checkbox
                              checked={dialogSelectedProducts.length > 0 && dialogSelectedProducts.length === selectedGroups.reduce((s, g) => s + g._allProducts.length, 0)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setDialogSelectedProducts(selectedGroups.flatMap(g => g._allProducts.map((p: any) => p._rowKey)))
                                } else {
                                  setDialogSelectedProducts([])
                                }
                              }}
                            />
                          </TableHead>
                          <TableHead className="px-4 whitespace-nowrap">Customer / DO</TableHead>
                          <TableHead className="px-4 whitespace-nowrap">Product Name</TableHead>
                          <TableHead className="px-4 whitespace-nowrap text-right min-w-[120px]">Planned Qty</TableHead>
                          <TableHead className="px-4 whitespace-nowrap">UOM</TableHead>
                          <TableHead className="px-4 whitespace-nowrap">Delivery From</TableHead>
                          <TableHead className="px-4 whitespace-nowrap text-right min-w-[170px]">Planned Gross Wt (KG)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedGroups.flatMap(group => group._allProducts).map((prod: any) => {
                          const rowKey = prod._rowKey;
                          return (
                            <TableRow key={rowKey} className={cn(dialogSelectedProducts.includes(rowKey) ? "bg-blue-50/30" : "")}>
                              <TableCell className="text-left px-4">
                                <Checkbox
                                  checked={dialogSelectedProducts.includes(rowKey)}
                                  onCheckedChange={() => toggleSelectDialogProduct(rowKey)}
                                />
                              </TableCell>
                              <TableCell className="px-4">
                                <div className="flex flex-col">
                                  <span className="text-[9px] font-black text-blue-600 uppercase leading-none mb-1">{prod.customerName}</span>
                                  <span className="text-[10px] font-bold text-slate-700">{prod.orderNo || "—"}</span>
                                </div>
                              </TableCell>
                              <TableCell className="px-4 font-bold text-[11px] text-slate-900">{prod.productName || "—"}</TableCell>
                              <TableCell className="px-4 text-[11px] font-black text-right font-mono tabular-nums text-blue-700">{fmtNum(prod.qtyToDispatch)}</TableCell>
                              <TableCell className="px-4 text-[10px] font-bold uppercase text-slate-500">{prod.uom || "—"}</TableCell>
                              <TableCell className="px-4 text-[10px] font-black uppercase text-slate-400 tracking-tighter">{prod.deliveryFrom}</TableCell>
                              <TableCell className="px-4 text-right">
                                <span className="font-black text-sm text-purple-700 font-mono tabular-nums">{fmtNum(calculateGrossWeight(prod.productName, prod.qtyToDispatch))}</span>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* 3. Vehicle & Transport Assignment — unified section (no more artificial
                    two-column vehicle/weightment split; it's all "Plan Vehicle" now). */}
                <div className="space-y-6 pt-6 border-t-4 border-slate-100">
                  <div className="bg-purple-600 px-4 sm:px-6 py-4 rounded-xl sm:rounded-3xl flex flex-wrap items-center justify-between gap-3 shadow-lg">
                    <div className="flex items-center gap-3">
                      <Truck className="h-6 w-6 text-white" />
                      <h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-tighter italic">Vehicle &amp; Transport Assignment</h3>
                    </div>
                    <Badge className="bg-white text-purple-700 font-black">STAGE 5</Badge>
                  </div>

                  <div className="bg-slate-50 border-2 border-slate-200 rounded-xl sm:rounded-3xl p-4 sm:p-6 space-y-6 shadow-md">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">
                          Vehicle Registration Number {selectedDepoTab?.toUpperCase() === 'BANARI' ? <span className="text-red-500">*</span> : <span className="text-slate-400 font-normal normal-case">(Optional)</span>}
                        </Label>
                        <Popover open={vehicleDropdownOpen} onOpenChange={setVehicleDropdownOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={vehicleDropdownOpen}
                              className={cn(
                                "h-12 border-2 border-slate-200 rounded-xl px-3 sm:px-4 font-bold text-sm sm:text-base focus:border-primary transition-colors uppercase bg-white shadow-sm w-full justify-between",
                                !vehicleNumber && "text-muted-foreground",
                                vehicleNumber && "text-slate-900"
                              )}
                            >
                              <div className="flex items-center gap-2 truncate min-w-0 flex-1 text-left">
                                <span className="truncate">{vehicleNumber || "Select Vehicle"}</span>
                                {selectedVehicleObj && (
                                  <Badge variant="outline" className={cn(
                                    "text-[10px] font-semibold px-1.5 py-0 h-4 normal-case shrink-0",
                                    (selectedVehicleObj.approval_status === 'pending' || selectedVehicleObj.approvalStatus === 'pending')
                                      ? "bg-amber-50 text-amber-700 border-amber-300"
                                      : Boolean(selectedVehicleObj.has_pending_edit || selectedVehicleObj.hasPendingEdit || selectedVehicleObj.pending_changes || selectedVehicleObj.pendingChanges)
                                      ? "bg-blue-50 text-blue-700 border-blue-300"
                                      : "bg-emerald-50 text-emerald-700 border-emerald-300"
                                  )}>
                                    {(selectedVehicleObj.approval_status === 'pending' || selectedVehicleObj.approvalStatus === 'pending')
                                      ? 'Pending Approval'
                                      : Boolean(selectedVehicleObj.has_pending_edit || selectedVehicleObj.hasPendingEdit || selectedVehicleObj.pending_changes || selectedVehicleObj.pendingChanges)
                                      ? 'Edit Pending'
                                      : 'Approved'}
                                  </Badge>
                                )}
                              </div>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-[var(--radix-popover-trigger-width)] p-0 shadow-lg border border-slate-200 bg-white rounded-xl overflow-hidden"
                            style={{ width: 'var(--radix-popover-trigger-width)' }}
                            align="start"
                            side="bottom"
                            sideOffset={4}
                            avoidCollisions={false}
                            sticky="always"
                            hideWhenDetached={true}
                            updatePositionStrategy="always"
                            onWheel={(e) => e.stopPropagation()}
                            onTouchMove={(e) => e.stopPropagation()}
                          >
                            <div className="p-2 border-b border-slate-100 bg-slate-50/60">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setVehicleDropdownOpen(false)
                                  handleOpenAddVehicleModal()
                                }}
                                className="w-full justify-center gap-1.5 h-8 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-white border-dashed border-slate-300 bg-white"
                              >
                                <Plus className="h-3.5 w-3.5 text-primary" />
                                <span>Add Vehicle</span>
                              </Button>
                            </div>

                            <Command>
                              <CommandInput placeholder="Search vehicle number, type, transporter..." className="h-9 text-xs" />
                              <CommandList className="max-h-[280px] overflow-y-auto overscroll-contain">
                                <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">No vehicle found.</CommandEmpty>
                                <CommandGroup>
                                  {vehicleMaster
                                    .filter(v => v.registration_no && (v.status === 'Active' || v.approval_status === 'pending' || v.approvalStatus === 'pending'))
                                    .sort((a, b) => (a.registration_no || '').localeCompare(b.registration_no || '', undefined, { sensitivity: 'base', numeric: true }))
                                    .map((veh) => {
                                      const isSelected = veh.registration_no === vehicleNumber;
                                      const isPending = (veh.approval_status === 'pending' || veh.approvalStatus === 'pending');
                                      const hasPendingEdit = Boolean(veh.has_pending_edit || veh.hasPendingEdit || veh.pending_changes || veh.pendingChanges);

                                      return (
                                        <CommandItem
                                          key={veh.id || veh.registration_no}
                                          value={`${veh.registration_no} ${veh.vehicle_type || ''} ${veh.transporter || ''}`}
                                          onSelect={() => {
                                            if (isPending) {
                                              toast({
                                                title: "Pending Approval",
                                                description: `Vehicle ${veh.registration_no} is awaiting approver verification and cannot be assigned yet.`,
                                                variant: "destructive"
                                              });
                                              return;
                                            }
                                            if (isSelected) {
                                              setVehicleNumber("");
                                              setVehicleData(p => ({
                                                ...p, registration_no: "", vehicle_type: "", rto: "", passing_weight: "",
                                                fitness_end_date: "", insurance_end_date: "", tax_end_date: "", is_lifetime_tax: false,
                                                fuel_type: "", pollution_end_date: "", permit1_end_date: "", permit2_end_date: "",
                                                fitness: "", insurance: "", tax_copy: "", polution: "", permit1: "", permit2_out_state: "",
                                                gvw: "", ulw: ""
                                              }));
                                            } else {
                                              setVehicleNumber(veh.registration_no);
                                              autofillVehicleData(veh);
                                            }
                                            setVehicleDropdownOpen(false);
                                          }}
                                          className="flex items-center justify-between py-2 px-2.5 cursor-pointer hover:bg-slate-50 aria-selected:bg-slate-100 group"
                                        >
                                          <div className="flex items-center gap-2 truncate flex-1 min-w-0 pr-2">
                                            <Check
                                              className={cn(
                                                "h-4 w-4 shrink-0 text-primary",
                                                isSelected ? "opacity-100" : "opacity-0"
                                              )}
                                            />
                                            <div className="flex flex-col min-w-0">
                                              <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="font-semibold text-xs text-slate-800">{veh.registration_no}</span>
                                                {isPending ? (
                                                  <Badge variant="outline" className="text-[9px] font-medium text-amber-700 border-amber-300 bg-amber-50 px-1 py-0 h-3.5 shrink-0">
                                                    Pending Approval
                                                  </Badge>
                                                ) : hasPendingEdit ? (
                                                  <Badge variant="outline" className="text-[9px] font-medium text-blue-700 border-blue-300 bg-blue-50 px-1 py-0 h-3.5 shrink-0">
                                                    Edit Pending
                                                  </Badge>
                                                ) : (
                                                  <Badge variant="outline" className="text-[9px] font-medium text-emerald-700 border-emerald-300 bg-emerald-50 px-1 py-0 h-3.5 shrink-0">
                                                    Approved
                                                  </Badge>
                                                )}
                                              </div>
                                              {(veh.vehicle_type || veh.transporter || veh.rto) && (
                                                <span className="text-[10px] text-muted-foreground truncate">
                                                  {[veh.vehicle_type, veh.transporter, veh.rto].filter(Boolean).join(" • ")}
                                                </span>
                                              )}
                                            </div>
                                          </div>

                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            title="Edit / Modify Vehicle"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setVehicleDropdownOpen(false);
                                              handleOpenEditVehicleModal(veh);
                                            }}
                                            className="h-6 px-2 text-[11px] font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 rounded gap-1 shrink-0"
                                          >
                                            <Pencil className="h-3 w-3" />
                                            <span>Edit</span>
                                          </Button>
                                        </CommandItem>
                                      );
                                    })}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">
                          Driver Name <span className="text-slate-400 font-normal normal-case">(Optional)</span>
                        </Label>
                        <Popover open={driverDropdownOpen} onOpenChange={setDriverDropdownOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={driverDropdownOpen}
                              className={cn(
                                "h-12 border-2 border-slate-200 rounded-xl px-3 sm:px-4 font-bold text-sm sm:text-base focus:border-primary transition-colors uppercase bg-white shadow-sm w-full justify-between",
                                !driverName && "text-muted-foreground",
                                driverName && "text-slate-900"
                              )}
                            >
                              <div className="flex items-center gap-2 truncate min-w-0 flex-1 text-left">
                                <span className="truncate">{driverName || "Select Driver"}</span>
                                {selectedDriverObj && (() => {
                                  const st = driverApprovalState(selectedDriverObj)
                                  return (
                                    <Badge variant="outline" className={cn("text-[10px] font-semibold px-1.5 py-0 h-4 normal-case shrink-0", DRIVER_BADGE_CLASS[st])}>
                                      {DRIVER_BADGE_LABEL[st]}
                                    </Badge>
                                  )
                                })()}
                              </div>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-[var(--radix-popover-trigger-width)] p-0 shadow-lg border border-slate-200 bg-white rounded-xl overflow-hidden"
                            style={{ width: 'var(--radix-popover-trigger-width)' }}
                            align="start"
                            side="bottom"
                            sideOffset={4}
                            avoidCollisions={false}
                            sticky="always"
                            hideWhenDetached={true}
                            updatePositionStrategy="always"
                            onWheel={(e) => e.stopPropagation()}
                            onTouchMove={(e) => e.stopPropagation()}
                          >
                            <div className="p-2 border-b border-slate-100 bg-slate-50/60">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setDriverDropdownOpen(false)
                                  handleOpenAddDriverModal()
                                }}
                                className="w-full justify-center gap-1.5 h-8 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-white border-dashed border-slate-300 bg-white"
                              >
                                <Plus className="h-3.5 w-3.5 text-primary" />
                                <span>Add Driver</span>
                              </Button>
                            </div>

                            <Command filter={(value, search) => value.toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0}>
                              <CommandInput placeholder="Search driver name, mobile, licence..." className="h-9 text-xs" />
                              <CommandList className="max-h-[280px] overflow-y-auto overscroll-contain">
                                <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">No driver found.</CommandEmpty>
                                <CommandGroup>
                                  {driverMaster
                                    .filter(d => d.driver_name && (d.status === 'Active' || d.approval_status === 'pending'))
                                    .sort((a, b) => (a.driver_name || '').localeCompare(b.driver_name || '', undefined, { sensitivity: 'base', numeric: true }))
                                    .map((drv) => {
                                      const isSelected = drv.driver_name === driverName
                                      const st = driverApprovalState(drv)
                                      const isPending = st === 'pending'

                                      return (
                                        <CommandItem
                                          key={drv.id || drv.driver_name}
                                          value={`${drv.driver_name} ${drv.mobile_no || ''} ${drv.driving_licence_no || ''}`}
                                          onSelect={() => {
                                            if (isPending) {
                                              toast({
                                                title: "Pending Approval",
                                                description: `Driver ${drv.driver_name} is awaiting approver verification and cannot be assigned yet.`,
                                                variant: "destructive"
                                              })
                                              return
                                            }
                                            if (isSelected) clearDriver()
                                            else applyDriver(drv)
                                            setDriverDropdownOpen(false)
                                          }}
                                          className="flex items-center justify-between py-2 px-2.5 cursor-pointer hover:bg-slate-50 aria-selected:bg-slate-100 group"
                                        >
                                          <div className="flex items-center gap-2 truncate flex-1 min-w-0 pr-2">
                                            <Check className={cn("h-4 w-4 shrink-0 text-primary", isSelected ? "opacity-100" : "opacity-0")} />
                                            <div className="flex flex-col min-w-0">
                                              <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="font-semibold text-xs text-slate-800">{drv.driver_name}</span>
                                                <Badge variant="outline" className={cn("text-[9px] font-medium px-1 py-0 h-3.5 shrink-0", DRIVER_BADGE_CLASS[st])}>
                                                  {DRIVER_BADGE_LABEL[st]}
                                                </Badge>
                                              </div>
                                              {(drv.mobile_no || drv.driving_licence_no) && (
                                                <span className="text-[10px] text-muted-foreground truncate">
                                                  {[drv.mobile_no, drv.driving_licence_no].filter(Boolean).join(" • ")}
                                                </span>
                                              )}
                                            </div>
                                          </div>

                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            title="Edit / Modify Driver"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              setDriverDropdownOpen(false)
                                              handleOpenEditDriverModal(drv)
                                            }}
                                            className="h-6 px-2 text-[11px] font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 rounded gap-1 shrink-0"
                                          >
                                            <Pencil className="h-3 w-3" />
                                            <span>Edit</span>
                                          </Button>
                                        </CommandItem>
                                      )
                                    })}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 lg:gap-x-4 lg:col-span-2">
                        <div className="grid grid-cols-2 gap-2">
                        <div className="bg-white border-2 border-slate-100 rounded-xl px-3 py-1.5 shadow-sm">
                          <p className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1">Type</p>
                          <p className="text-[11px] font-black text-slate-700 uppercase leading-none">{vehicleData.vehicle_type || '---'}</p>
                        </div>
                        <div className="bg-white border-2 border-slate-100 rounded-xl px-3 py-1.5 shadow-sm">
                          <p className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1">RTO</p>
                          <p className="text-[11px] font-black text-slate-700 uppercase leading-none">{vehicleData.rto || '---'}</p>
                        </div>
                        <div className="bg-white border-2 border-slate-100 rounded-xl px-3 py-1.5 shadow-sm">
                          <p className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1">Pass Wt</p>
                          <p className={cn("text-[11px] font-black uppercase leading-none", isOverloaded ? "text-red-600" : "text-primary")}>
                            {passingWt > 0 ? passingWt.toFixed(2) : '0.00'} KG
                          </p>
                        </div>
                        <div className="bg-white border-2 border-slate-100 rounded-xl px-3 py-1.5 shadow-sm">
                          <p className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1">GVW</p>
                          <p className="text-[11px] font-black text-slate-700 uppercase leading-none">{vehicleData.gvw || '---'} KG</p>
                        </div>
                        <div className="bg-white border-2 border-slate-100 rounded-xl px-3 py-1.5 shadow-sm">
                          <p className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1">ULW</p>
                          <p className="text-[11px] font-black text-slate-700 uppercase leading-none">{vehicleData.ulw || '---'} KG</p>
                        </div>
                        <div className="bg-white border-2 border-slate-100 rounded-xl px-3 py-1.5 shadow-sm">
                          <p className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1">Avg Tare Wt</p>
                          <p className="text-[11px] font-black text-slate-700 uppercase leading-none">
                            {vehicleTareStats && vehicleTareStats.count > 0
                              ? <>{Number(vehicleTareStats.avgTare).toFixed(2)} KG <span className="text-[9px] font-semibold text-slate-400 normal-case">({vehicleTareStats.count} trip{vehicleTareStats.count > 1 ? 's' : ''})</span></>
                              : <>--- <span className="text-[9px] font-semibold text-slate-400 normal-case">{vehicleData.registration_no ? '(first trip, ULW used)' : ''}</span></>}
                          </p>
                        </div>
                        </div>
                        <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                        <div className="bg-white border-2 border-slate-100 rounded-xl px-3 py-1.5 shadow-sm">
                          <p className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1">Contact</p>
                          <p className="text-[11px] font-black text-slate-700 uppercase leading-none">{driverData.contact_no || '---'}</p>
                        </div>
                        <div className="bg-white border-2 border-slate-100 rounded-xl px-3 py-1.5 shadow-sm">
                          <p className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1">License No</p>
                          <p className="text-[11px] font-black text-slate-700 uppercase leading-none">{driverData.license_no || '---'}</p>
                        </div>
                        <div className="bg-white border-2 border-slate-100 rounded-xl px-3 py-1.5 shadow-sm">
                          <p className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1">Valid Upto</p>
                          <p className="text-[11px] font-black text-slate-700 uppercase leading-none">{formatDate(driverData.valid_upto) || '---'}</p>
                        </div>
                        <div className="bg-white border-2 border-slate-100 rounded-xl px-3 py-1.5 shadow-sm">
                          <p className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1">
                            {['Truck', 'Tanker', 'Pickup', 'Hiva', 'Trailer'].includes(vehicleData.vehicle_type) ? 'Trans Valid Upto' : 'LMV Valid Upto'}
                          </p>
                          <p className="text-[11px] font-black text-slate-700 uppercase leading-none">
                            {formatDate(['Truck', 'Tanker', 'Pickup', 'Hiva', 'Trailer'].includes(vehicleData.vehicle_type) ? driverData.trans_valid_upto : driverData.lmv_valid_upto) || '---'}
                          </p>
                        </div>
                        </div>
                        {(() => {
                          const dlUrl: string | null = driverName ? (selectedDriverObj?.dl_upload || null) : null
                          const dlIsPdf = !!dlUrl && dlUrl.toLowerCase().split('?')[0].endsWith('.pdf')
                          return (
                            <div
                              onClick={() => dlUrl && window.open(dlUrl, "_blank")}
                              title={dlUrl ? "Click to view Driver Licence" : undefined}
                              className={cn(
                                "h-[72px] bg-white border-2 rounded-xl px-3 flex items-center gap-3 shadow-sm",
                                dlUrl ? "border-slate-100 cursor-pointer hover:border-slate-300 transition-colors" : "border-dashed border-slate-200"
                              )}
                            >
                              <div className="h-12 w-16 shrink-0 rounded-md border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
                                {dlUrl ? (
                                  dlIsPdf ? (
                                    <FileText className="h-6 w-6 text-rose-600" />
                                  ) : (
                                    <img src={dlUrl} alt="Driver Licence" className="h-full w-full object-cover" />
                                  )
                                ) : (
                                  <ImageIcon className="h-5 w-5 text-slate-300" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1">Driver Licence</p>
                                <p className="text-[11px] font-black text-slate-700 uppercase leading-none truncate">
                                  {!driverName ? "Select driver" : dlUrl ? (dlIsPdf ? "PDF Document" : "Licence Image") : "Not Uploaded"}
                                </p>
                              </div>
                              {dlUrl && (
                                <span className="text-[10px] text-slate-500 flex items-center gap-1 font-medium shrink-0">
                                  <Eye className="h-3 w-3 text-primary" /> View <ExternalLink className="h-2.5 w-2.5" />
                                </span>
                              )}
                            </div>
                          )
                        })()}
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-200">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none">
                          Digital Documents<span className="text-slate-400 font-normal lowercase tracking-normal">(Master Derived • View Only)</span>
                        </p>
                        {selectedVehicleObj && (
                          <span className="text-[10px] font-semibold text-slate-500">
                            Vehicle: <strong className="text-slate-800">{selectedVehicleObj.registration_no}</strong>
                          </span>
                        )}
                      </div>
                      {vehicleNumber.trim() && (
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Route</span>
                          <Select value={routeOverride} onValueChange={(v) => setRouteOverride(v as "auto" | "national" | "within")}>
                            <SelectTrigger className="h-8 w-48 text-xs font-bold border-slate-200 bg-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="auto">Auto ({routeInfo.auto ? "National" : "Within State"})</SelectItem>
                              <SelectItem value="national">National</SelectItem>
                              <SelectItem value="within">Within State</SelectItem>
                            </SelectContent>
                          </Select>
                          {routeNeedsConfirm && (
                            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5">
                              <span className="text-[11px] font-semibold text-amber-700">
                                Delivery state could not be detected. Is this trip National or Within State?
                              </span>
                              <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setRouteOverride("national")}>National</Button>
                              <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setRouteOverride("within")}>Within State</Button>
                            </div>
                          )}
                        </div>
                      )}
                      {!vehicleNumber.trim() ? (
                        <div className="bg-slate-50/70 border-2 border-dashed border-slate-200 rounded-xl p-8 text-center flex flex-col items-center justify-center gap-2">
                          <div className="h-10 w-10 rounded-full bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center shadow-2xs">
                            <Truck className="h-5 w-5 text-slate-400" />
                          </div>
                          <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                            No Vehicle Selected
                          </p>
                          <p className="text-[11px] text-slate-500 max-w-sm">
                            Select a vehicle registration number above to view its master-derived digital documents, certificates, and expiry dates.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {([
                            { key: 'fitness', fileKey: 'fitness_file_name', dateKey: 'fitness_end_date', label: 'Fitness', applicable: true },
                            { key: 'insurance', fileKey: 'insurance_file_name', dateKey: 'insurance_end_date', label: 'Insurance', applicable: true },
                            { key: 'tax_copy', fileKey: 'tax_file_name', dateKey: 'tax_end_date', label: 'Tax Copy', applicable: true },
                            { key: 'polution', fileKey: 'pollution_file_name', dateKey: 'pollution_end_date', label: 'Pollution', applicable: vehicleData.fuel_type !== 'Electrical' },
                            { key: 'permit1', fileKey: 'permit1_file_name', dateKey: 'permit1_end_date', label: 'State Permit', applicable: Number(vehicleData.gvw) > 3000 },
                            { key: 'permit2_out_state', fileKey: 'permit2_file_name', dateKey: 'permit2_end_date', label: 'National / Other State Permit', applicable: !routeNeedsConfirm && isInterState && Number(vehicleData.gvw) > 3000 },
                          ] as const).map(doc => {
                            const docUrl = vehicleData[doc.key] && vehicleData[doc.key] !== 'pending' ? vehicleData[doc.key] : null;
                            const dateVal = vehicleData[doc.dateKey];
                            const isLifetime = doc.key === 'tax_copy' && vehicleData.is_lifetime_tax;
                            const todayStr = new Date().toISOString().split("T")[0];
                            const isExpired = !isLifetime && dateVal && dateVal < todayStr;
                            const isExpiringSoon = !isLifetime && dateVal && !isExpired && dateVal < minDate;
                            const isPdf = typeof docUrl === 'string' && docUrl.toLowerCase().split('?')[0].endsWith('.pdf');

                            return (
                              <div key={doc.key} className={cn(
                                "bg-white border rounded-xl p-3 flex flex-col justify-between gap-2.5 min-w-0 shadow-xs",
                                !doc.applicable
                                  ? "opacity-45 grayscale bg-slate-50 border-slate-200"
                                  : docUrl
                                  ? "border-slate-200 hover:border-slate-300 transition-colors"
                                  : "border-dashed border-slate-300"
                              )}>
                                {/* Header: Label + Status Badge */}
                                <div className="flex items-center justify-between gap-1.5">
                                  <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight truncate">
                                    {doc.label}
                                  </span>
                                  {!doc.applicable ? (
                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-slate-100 text-slate-400 border-slate-200 shrink-0 font-medium">
                                      N/A
                                    </Badge>
                                  ) : docUrl ? (
                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-emerald-50 text-emerald-700 border-emerald-300 shrink-0 font-semibold gap-1">
                                      <FileCheck className="h-2.5 w-2.5 text-emerald-600" />
                                      Available
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-amber-50 text-amber-700 border-amber-300 shrink-0 font-medium">
                                      {selectedDepoTab?.toUpperCase() === 'BANARI' && doc.key !== 'permit2_out_state' ? 'Required' : 'Not Uploaded'}
                                    </Badge>
                                  )}
                                </div>

                                {/* Document Thumbnail / View (VIEW ONLY) */}
                                <div>
                                  {!doc.applicable ? (
                                    <div className="w-full h-32 sm:h-36 rounded-lg border border-slate-200/60 bg-slate-100/50 flex flex-col items-center justify-center gap-1 text-slate-400 p-2">
                                      <span className="text-xs font-semibold">Not Applicable</span>
                                    </div>
                                  ) : docUrl ? (
                                    isPdf ? (
                                      <div
                                        onClick={() => window.open(docUrl, "_blank")}
                                        className="w-full h-32 sm:h-36 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100/80 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all group p-2 shadow-2xs"
                                        title={`Click to view ${doc.label} PDF`}
                                      >
                                        <div className="h-11 w-11 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                          <FileText className="h-6 w-6" />
                                        </div>
                                        <span className="text-xs font-bold text-slate-700">PDF Document</span>
                                        <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                                          <Eye className="h-3 w-3 text-primary" /> Click to open <ExternalLink className="h-2.5 w-2.5" />
                                        </span>
                                      </div>
                                    ) : (
                                      <div
                                        onClick={() => window.open(docUrl, "_blank")}
                                        className="relative w-full h-32 sm:h-36 rounded-lg overflow-hidden border border-slate-200/90 bg-slate-100/60 flex items-center justify-center p-1.5 cursor-pointer group shadow-2xs hover:shadow-xs transition-all"
                                        title={`Click to view full ${doc.label} document`}
                                      >
                                        <img
                                          src={docUrl}
                                          alt={doc.label}
                                          className="max-w-full max-h-full object-contain rounded shadow-2xs group-hover:scale-105 transition-transform duration-200"
                                        />
                                        {/* Hover Overlay */}
                                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white font-bold text-xs backdrop-blur-[1px] rounded-lg">
                                          <Eye className="h-4 w-4" />
                                          <span>View Document</span>
                                          <ExternalLink className="h-3 w-3 ml-0.5" />
                                        </div>
                                        {/* Bottom badge overlay */}
                                        <div className="absolute bottom-1.5 right-1.5 bg-slate-900/70 text-white rounded px-2 py-0.5 text-[9px] font-semibold flex items-center gap-1 backdrop-blur-xs group-hover:opacity-0 transition-opacity">
                                          <Eye className="h-2.5 w-2.5" />
                                          <span>Preview</span>
                                        </div>
                                      </div>
                                    )
                                  ) : (
                                    <div className="w-full h-32 sm:h-36 rounded-lg border border-dashed border-amber-300 bg-amber-50/40 flex flex-col items-center justify-center gap-1.5 p-2 text-center">
                                      <div className="h-10 w-10 rounded-full bg-amber-100 border border-amber-200 text-amber-600 flex items-center justify-center">
                                        <FileX className="h-5 w-5" />
                                      </div>
                                      <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">No Document</span>
                                      <span className="text-[10px] font-medium text-amber-700/80">File not uploaded in Vehicle Master</span>
                                    </div>
                                  )}
                                </div>

                                {/* Validity / Expiry Date (VIEW ONLY) */}
                                <div className="pt-1 border-t border-slate-100">
                                  {isLifetime ? (
                                    <div className="flex items-center justify-between bg-slate-50 border border-slate-200/80 rounded-lg px-2.5 py-1.5 text-xs">
                                      <span className="text-[10px] font-bold text-slate-500 uppercase">Valid Upto:</span>
                                      <Badge variant="outline" className="bg-slate-200/80 text-slate-700 font-bold text-[10px] px-1.5 py-0 border-slate-300">
                                        Lifetime (LTT)
                                      </Badge>
                                    </div>
                                  ) : (
                                    <div className={cn(
                                      "flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs border transition-colors",
                                      !dateVal ? "bg-slate-50 border-slate-200/80 text-slate-400" :
                                      isExpired ? "bg-red-50/70 border-red-200 text-red-700" :
                                      isExpiringSoon ? "bg-amber-50/70 border-amber-200 text-amber-700" :
                                      "bg-slate-50 border-slate-200/80 text-slate-800"
                                    )}>
                                      <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                        <CalendarIconLucide className="h-3 w-3 text-slate-400 shrink-0" />
                                        Valid Upto:
                                      </span>
                                      <span className="font-bold text-[11px] truncate flex items-center gap-1">
                                        {dateVal ? formatDate(dateVal) : "—"}
                                        {isExpired && (
                                          <span className="text-[9px] font-black uppercase text-red-600 bg-red-100/80 px-1 rounded">
                                            Expired
                                          </span>
                                        )}
                                        {isExpiringSoon && !isExpired && (
                                          <span className="text-[9px] font-black uppercase text-amber-600 bg-amber-100/80 px-1 rounded">
                                            &lt; 5 Days
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Check Status <span className="text-red-500">*</span></Label>
                        <Select value={vehicleData.checkStatus} onValueChange={(v) => setVehicleData(p => ({ ...p, checkStatus: v }))}>
                          <SelectTrigger className="h-12 data-[size=default]:h-12 w-full border-2 border-slate-200 rounded-xl font-bold bg-white">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Accept">Accept</SelectItem>
                            <SelectItem value="Reject">Reject</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">
                          Remarks {vehicleData.checkStatus === "Reject" ? <span className="text-red-500">*</span> : <span className="text-slate-400 font-normal normal-case">(Optional)</span>}
                        </Label>
                        <Input
                          placeholder="Add notes..."
                          className="h-12 border-2 border-slate-200 rounded-xl bg-white font-medium"
                          value={vehicleData.remarks}
                          onChange={(e) => setVehicleData(p => ({ ...p, remarks: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Transporter <span className="text-red-500">*</span></Label>
                        <Popover open={transporterDropdownOpen} onOpenChange={setTransporterDropdownOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={transporterDropdownOpen}
                              className={cn(
                                "h-12 border-2 border-slate-200 rounded-xl px-3 sm:px-4 font-bold text-sm sm:text-base focus:border-primary transition-colors bg-white shadow-sm w-full justify-between",
                                !freightData.transporterName && "text-muted-foreground",
                                freightData.transporterName && "text-blue-700"
                              )}
                            >
                              <div className="flex items-center gap-2 truncate min-w-0 flex-1 text-left">
                                <span className="truncate">{freightData.transporterName || "Select Transporter"}</span>
                                {selectedTransporterObj && (() => {
                                  const st = driverApprovalState(selectedTransporterObj)
                                  return (
                                    <Badge variant="outline" className={cn("text-[10px] font-semibold px-1.5 py-0 h-4 normal-case shrink-0", DRIVER_BADGE_CLASS[st])}>
                                      {DRIVER_BADGE_LABEL[st]}
                                    </Badge>
                                  )
                                })()}
                              </div>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-[var(--radix-popover-trigger-width)] p-0 shadow-lg border border-slate-200 bg-white rounded-xl overflow-hidden"
                            style={{ width: 'var(--radix-popover-trigger-width)' }}
                            align="start"
                            side="bottom"
                            sideOffset={4}
                            avoidCollisions={false}
                            sticky="always"
                            hideWhenDetached={true}
                            updatePositionStrategy="always"
                            onWheel={(e) => e.stopPropagation()}
                            onTouchMove={(e) => e.stopPropagation()}
                          >
                            <div className="p-2 border-b border-slate-100 bg-slate-50/60">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setTransporterDropdownOpen(false)
                                  handleOpenAddTransporterModal()
                                }}
                                className="w-full justify-center gap-1.5 h-8 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-white border-dashed border-slate-300 bg-white"
                              >
                                <Plus className="h-3.5 w-3.5 text-primary" />
                                <span>Add Transporter</span>
                              </Button>
                            </div>

                            <Command filter={(value, search) => value.toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0}>
                              <CommandInput placeholder="Search by name, city, state, GST, mobile or contact person..." className="h-9 text-xs" />
                              <CommandList className="max-h-[280px] overflow-y-auto overscroll-contain">
                                <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">No transporter found.</CommandEmpty>
                                <CommandGroup>
                                  {freightTransporterRows.map(({ name, record }) => {
                                    const isSelected = name === freightData.transporterName
                                    const st = record ? driverApprovalState(record) : null
                                    const isPending = st === 'pending'

                                    return (
                                      <CommandItem
                                        key={record?.id ?? name}
                                        value={`${name} ${transporterMeta(record)}`}
                                        onSelect={() => {
                                          if (isPending) {
                                            toast({
                                              title: "Pending Approval",
                                              description: `Transporter ${name} is awaiting approver verification and cannot be assigned yet.`,
                                              variant: "destructive"
                                            })
                                            return
                                          }
                                          selectTransporter(name)
                                          setTransporterDropdownOpen(false)
                                        }}
                                        className="flex items-center justify-between py-2 px-2.5 cursor-pointer hover:bg-slate-50 aria-selected:bg-slate-100 group"
                                      >
                                        <div className="flex items-center gap-2 truncate flex-1 min-w-0 pr-2">
                                          <Check className={cn("h-4 w-4 shrink-0 text-primary", isSelected ? "opacity-100" : "opacity-0")} />
                                          <div className="flex flex-col min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span className="font-semibold text-xs text-slate-800">{name}</span>
                                              {st && (
                                                <Badge variant="outline" className={cn("text-[9px] font-medium px-1 py-0 h-3.5 shrink-0", DRIVER_BADGE_CLASS[st])}>
                                                  {DRIVER_BADGE_LABEL[st]}
                                                </Badge>
                                              )}
                                            </div>
                                            {transporterMeta(record) && (
                                              <span className="text-[10px] text-muted-foreground truncate">
                                                {transporterMeta(record)}
                                              </span>
                                            )}
                                          </div>
                                        </div>

                                        {record && (
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            title="Edit / Modify Transporter"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              setTransporterDropdownOpen(false)
                                              handleOpenEditTransporterModal(record)
                                            }}
                                            className="h-6 px-2 text-[11px] font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 rounded gap-1 shrink-0"
                                          >
                                            <Pencil className="h-3 w-3" />
                                            <span>Edit</span>
                                          </Button>
                                        )}
                                      </CommandItem>
                                    )
                                  })}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">No Plate Image <span className="text-slate-400 font-normal normal-case">(Optional)</span></Label>
                        <FileUploadField
                          accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
                          value={freightData.vehicleNoPlateImage && freightData.vehicleNoPlateImage !== 'pending' ? freightData.vehicleNoPlateImage : null}
                          fileName={freightData.vehicleNoPlateImage_file_name}
                          helperText="Max file size: 20 MB"
                          uploading={isUploading === 'vehicleNoPlateImage'}
                          buttonText={freightData.vehicleNoPlateImage_file_name ? 'REPLACE' : 'UPLOAD'}
                          triggerClassName="h-12 rounded-xl"
                          onFilesSelected={(files) => handleFileChange('vehicleNoPlateImage', 'vehicleNoPlateImage_file_name', files[0] || null, 'freight')}
                        />
                      </div>
                    </div>

                    {freightData.transporterName && !['Company Vehicle', 'Party Vehicle'].includes(freightData.transporterName) && (
                      <div className="space-y-6 pt-4 border-t border-slate-200 animate-in fade-in zoom-in-95 duration-300">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Freight Rate Type <span className="text-red-500">*</span></Label>
                            <Select value={freightData.freightRateType} onValueChange={(v) => setFreightData(p => ({ ...p, freightRateType: v }))}>
                              <SelectTrigger className="h-12 data-[size=default]:h-12 w-full border-2 border-slate-200 rounded-xl font-bold bg-white">
                                <SelectValue placeholder="Select Type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Fixed Bhada">Fixed Bhada</SelectItem>
                                <SelectItem value="Bhada Rate">Bhada Rate</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {freightData.freightRateType && (
                            <div className="space-y-1.5">
                              <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">
                                {freightData.freightRateType === 'Bhada Rate' ? 'Bhada Rate (Per MT)' : 'Fixed Bhada Amount'} <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                type="number" step="0.01"
                                className="h-12 border-2 border-slate-200 rounded-xl font-bold bg-white"
                                placeholder="0.00"
                                value={freightData.freightAmount}
                                onChange={(e) => setFreightData(p => ({ ...p, freightAmount: e.target.value }))}
                              />
                            </div>
                          )}
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">CD Amount <span className="text-slate-400 font-normal normal-case">(Optional)</span></Label>
                            <Input
                              type="number" step="0.01"
                              className="h-12 border-2 border-slate-200 rounded-xl font-bold bg-white"
                              placeholder="0.00"
                              value={freightData.cdAmount}
                              onChange={(e) => setFreightData(p => ({ ...p, cdAmount: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Final Rate <span className="text-slate-400 font-normal normal-case">(Optional)</span></Label>
                            <Input
                              type="number" step="0.01"
                              className="h-12 border-2 border-slate-200 rounded-xl font-bold bg-white"
                              placeholder="0.00"
                              value={freightData.finalRate}
                              onChange={(e) => setFreightData(p => ({ ...p, finalRate: e.target.value }))}
                            />
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 font-black px-3">Advance Bhada</Badge>
                            <div className="h-px flex-1 bg-slate-100" />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                              <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Bank</Label>
                              <Input type="number" step="0.01" className="h-12 border-2 border-slate-200 rounded-xl font-bold bg-white" placeholder="0.00"
                                value={freightData.cash_bank} onChange={(e) => setFreightData(p => ({ ...p, cash_bank: e.target.value }))} />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Diesel Advance</Label>
                              <Input type="number" step="0.01" className="h-12 border-2 border-slate-200 rounded-xl font-bold bg-white" placeholder="0.00"
                                value={freightData.diesel_advance} onChange={(e) => setFreightData(p => ({ ...p, diesel_advance: e.target.value }))} />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Cash Advance</Label>
                              <Input type="number" step="0.01" className="h-12 border-2 border-slate-200 rounded-xl font-bold bg-white" placeholder="0.00"
                                value={freightData.bhada} onChange={(e) => setFreightData(p => ({ ...p, bhada: e.target.value }))} />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Overload Alert & Remarks — planned SKU gross weight vs vehicle passing weight */}
                    {isOverloaded && (
                      <div className="p-4 bg-red-50 border-2 border-red-100 rounded-2xl space-y-3">
                        <div className="flex items-center gap-2">
                          <Weight className="h-4 w-4 text-red-500" />
                          <p className="text-sm font-black text-red-600 uppercase tracking-tighter">
                            Vehicle is overload! ({totalPackingWeightFromSku.toFixed(2)} KG planned vs {passingWt.toFixed(2)} KG capacity)
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-red-500 tracking-widest ml-1">
                            Overload Remarks {selectedDepoTab?.toUpperCase() === 'BANARI' && <span className="text-red-500">*</span>}
                          </Label>
                          <Input
                            placeholder={selectedDepoTab?.toUpperCase() === 'BANARI' ? "Why is the vehicle being overloaded? (MANDATORY)" : "Why is the vehicle being overloaded? (Optional)"}
                            className="h-12 border-2 border-red-200 rounded-xl bg-white font-bold text-red-700 placeholder:text-red-300"
                            value={freightData.overloadRemarks}
                            onChange={(e) => setFreightData(p => ({ ...p, overloadRemarks: e.target.value }))}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-4 w-full border-t bg-slate-50/50 p-4 md:p-8 sm:flex-col sm:justify-start">
            <StageDecisionFooter
              remarks={revertRemarks}
              onRemarksChange={setRevertRemarks}
              remarksPlaceholder="Enter reason for reverting to Dispatch Planning..."
              disabled={isReadOnly}
              revertActions={[{
                label: isProcessing ? "Wait..." : `Revert to Dispatch Planning (${dialogSelectedProducts.length})`,
                onClick: handleRevert,
                disabled: isProcessing || dialogSelectedProducts.length === 0 || isReadOnly || !revertRemarks.trim(),
              }]}
              onCancel={() => setIsDialogOpen(false)}
              approve={{
                label: isProcessing ? "Wait..." : `Confirm (${dialogSelectedProducts.length})`,
                onClick: performPlanVehicleConfirmation,
                disabled: isProcessing || dialogSelectedProducts.length === 0 || isReadOnly,
              }}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tax Copy / Pollution Warning Dialog — these docs are optional, so we warn but don't block */}
      <AlertDialog open={docWarningDialog.open} onOpenChange={(open) => setDocWarningDialog(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Missing or Expired Documents</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="mb-2">The following documents are missing or expired. You can still continue with the vehicle plan.</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {docWarningDialog.messages.map((msg, i) => <li key={i}>{msg}</li>)}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDocWarningDialog({ open: false, messages: [] });
                submitPlanVehicle();
              }}
            >
              Continue Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Gate Pass Dialog */}
      <Dialog open={isSlipDialogOpen} onOpenChange={(open) => { if (!open) closeSlipDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gate Pass Ready</DialogTitle>
            <DialogDescription>The vehicle plan was confirmed. Print or download the Gate Pass below.</DialogDescription>
          </DialogHeader>

          <div className="bg-slate-50 p-4 rounded-lg space-y-2">
            {buildSlipParties().map((p) => (
              <div key={p.party} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-2">
                <div>
                  <p className="text-sm font-black text-slate-800">{p.party}</p>
                  <p className="text-[11px] text-slate-500">{p.commitmentNo}</p>
                </div>
                <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">{p.products.length} item(s)</Badge>
              </div>
            ))}
          </div>

          <DialogFooter className="mt-4 w-full border-t bg-slate-50/50 p-4 sm:flex-col sm:justify-start">
            <StageActionFooter
              onCancel={closeSlipDialog}
              cancelLabel="Close"
              actions={[
                {
                  label: <><Printer className="mr-2 h-4 w-4" /> Print Gate Pass</>,
                  onClick: handlePrintSlip,
                  variant: "outline",
                },
                {
                  label: <><Download className="mr-2 h-4 w-4" /> Download Gate Pass</>,
                  onClick: handleDownloadSlip,
                },
              ]}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vehicle Master Add/Edit Dialog */}
      <Dialog open={isVehicleModalOpen} onOpenChange={setIsVehicleModalOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0">
          {vehicleEffectiveDatesSection !== null && editingVehicle?.id ? (
            <VehicleEffectiveDatesModalView
              vehicleId={editingVehicle.id}
              registrationNo={vehicleModalForm.registration_no || ''}
              vehicleForm={vehicleModalForm}
              initialSection={vehicleEffectiveDatesSection}
              transporterOptions={transporterModalOptions}
              activeRtoCodes={activeRtoCodes}
              onVehicleUpdated={async (data) => {
                setVehicleModalForm((prev: any) => ({ ...prev, ...data }));
                await fetchMasterData();
              }}
              onBack={() => setVehicleEffectiveDatesSection(null)}
            />
          ) : (
            <>
              <DialogHeader className="px-6 py-4 border-b shrink-0 bg-slate-50/60">
                <div className="flex items-center gap-2.5">
                  <Truck className="h-5 w-5 text-primary" />
                  <DialogTitle className="text-base font-bold text-slate-900">
                    {editingVehicle ? `Edit Vehicle — ${editingVehicle.registration_no}` : "Add New Vehicle"}
                  </DialogTitle>
                </div>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {editingVehicle
                    ? "Update vehicle specifications and documents. Changes will be submitted for approver review."
                    : "Enter details for the new vehicle. It will be submitted for approver approval."}
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto px-6 py-4">
                <VehicleForm
                  vehicleForm={vehicleModalForm}
                  setVehicleForm={setVehicleModalForm}
                  vehicleFormErrors={vehicleModalErrors}
                  setVehicleFormErrors={setVehicleModalErrors}
                  roadTaxType={roadTaxType}
                  setRoadTaxType={setRoadTaxType}
                  sortedVehicleTransporters={sortedVehicleTransporters}
                  transporterOptions={transporterModalOptions}
                  activeRtoCodes={activeRtoCodes}
                  handleFileUpload={handleVehicleModalFileUpload}
                  handleFileRemove={handleVehicleModalFileRemove}
                  editingItem={editingVehicle}
                  setVehicleEffectiveDatesSection={setVehicleEffectiveDatesSection}
                />
              </div>

              <DialogFooter className="w-full shrink-0 border-t bg-slate-50/50 px-6 py-3 sm:flex-col sm:justify-start">
                <StageActionFooter
                  onCancel={() => setIsVehicleModalOpen(false)}
                  actions={[
                    {
                      label: isSubmittingVehicleModal ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        editingVehicle ? "Submit Edit for Approval" : "Submit for Approval"
                      ),
                      onClick: handleSubmitVehicleModal,
                      disabled: isSubmittingVehicleModal,
                    },
                  ]}
                />
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Driver Master Add/Edit Dialog */}
      <Dialog open={isDriverModalOpen} onOpenChange={setIsDriverModalOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b shrink-0 bg-slate-50/60">
            <DialogTitle className="text-base font-bold text-slate-900">
              {editingDriver ? `Edit Driver — ${editingDriver.driver_name}` : "Add New Driver"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              {editingDriver
                ? "Update driver details and documents. Changes will be submitted for approver review."
                : "Enter details for the new driver. It will be submitted for approver approval."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <DriverForm
              driverForm={driverModalForm}
              setDriverForm={setDriverModalForm}
              activeRtoCodes={activeRtoCodes}
              activeStates={activeStates}
              handleFileUpload={handleDriverModalFileUpload}
              handleFileRemove={handleDriverModalFileRemove}
              editingItem={null}
            />
          </div>

          <DialogFooter className="w-full shrink-0 border-t bg-slate-50/50 px-6 py-3 sm:flex-col sm:justify-start">
            <StageActionFooter
              onCancel={() => setIsDriverModalOpen(false)}
              actions={[
                {
                  label: isSubmittingDriverModal ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    editingDriver ? "Submit Edit for Approval" : "Submit for Approval"
                  ),
                  onClick: handleSubmitDriverModal,
                  disabled: isSubmittingDriverModal,
                },
              ]}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TransporterMasterDialog
        open={isTransporterModalOpen}
        onOpenChange={setIsTransporterModalOpen}
        editingTransporter={editingTransporter}
        onSaved={async () => { await fetchMasterData() }}
      />
    </WorkflowStageShell>
  );
}
