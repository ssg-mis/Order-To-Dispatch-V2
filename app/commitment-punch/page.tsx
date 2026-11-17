"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import type React from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { FileUploadField } from "@/components/file-upload-field"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Save, Plus, Trash2, CheckCircle2, RefreshCw, ChevronRight, CalendarIcon, ArrowUpDown, ArrowUp, ArrowDown, Search, Info, Calendar as CalendarIconLucide, X, Pencil, ClipboardList, AlertTriangle, Filter, Settings2, Lock } from "lucide-react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { customerApi, commitmentPunchApi, brokerApi, salespersonApi, skuApi, depotApi, orderApi, ledgerApi, oilTagApi, lookupApi } from "@/lib/api-service"
import { usePersistedColumns } from "@/hooks/use-persisted-columns"
import { useColumnOrder } from "@/hooks/use-column-order"
import { usePersistedFilters } from "@/hooks/use-persisted-filters"
import { SortableTableHead } from "@/components/ui/sortable-table-head"
import { ColumnDragProvider } from "@/components/ui/column-drag-provider"
import { ColumnToggleContent } from "@/components/ui/column-toggle-content"
import { StageListHeader, StageToolbar, StageSegmented, StageFilterSelect, StageColumnsMenu, StageDivider, StageActiveChips, StagePagination } from "@/components/stage-list"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { AsyncCombobox } from "@/components/ui/async-combobox"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useStatesMap } from "@/hooks/use-states-map"
import { useCustomerAddresses, formatCustomerAddress } from "@/hooks/use-customer-addresses"
import { formatAddressForPrint } from "@/lib/address"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { fmtAmount } from "@/lib/table-format"

// ─── Types ────────────────────────────────────────────────────

type ProductRow = {
  id: string
  oil_type: string
  quantity: string
  unit: string
  rate: string
}

type PendingCommitment = {
  id: number
  commitment_no: string
  commitment_date: string
  party_name: string
  oil_type: string
  quantity: number
  unit: string
  rate: number
  order_type: string
  transport_type: string
  payment_terms?: string
  order_through?: string
  advance_payment_to_be_taken?: boolean
  broker_id?: number
  broker_name?: string
  salesperson_id?: number
  salesperson_name?: string
  planned1: string
  processed_qty: number
  remaining_qty: number
  delivery_qty?: number
  po_pending_qty?: number
  dispatch_from?: string
  depot_name?: string
}

type SkuRow = {
  id: string
  sku: string
  qty: string
  rate: string
  mt?: number
}

type LedgerRow = {
  id: string
  ledgerId?: number
  ledgerName: string
  amount: string
}

const LEDGER_OPTIONS = [
  "Transportation Charges",
  "Freight Charges",
  "Insurance Charges",
  "Handling Charges",
  "Loading & Unloading Charges",
  "Other Charges",
]

const PAYMENT_TERMS_LABEL: Record<string, string> = {
  advance: "Advance",
  "7days": "7 Days After Delivery",
  delivery: "On Delivery",
}

const formatPaymentTerms = (val?: string | null) =>
  val ? (PAYMENT_TERMS_LABEL[val.toLowerCase()] ?? val) : "—"

// ─── Constants ────────────────────────────────────────────────

const OIL_TYPES = ["Palm Oil", "Soya Oil", "Rice Oil"]
const TRANSPORT_TYPES = ["Self", "Party", "Company", "Ex-Depot"]

const PAGE_COLUMNS = [
  { id: "commitment_no", label: "Commitment No." },
  { id: "commitment_date", label: "Date" },
  { id: "party_name", label: "Customer Name" },
  { id: "dispatch_from", label: "Dispatch From (Depot)" },
  { id: "oil_type", label: "Oil Type" },
  { id: "rate", label: "Rate (PMT)" },
  { id: "quantity", label: "Qty (MT)" },
  { id: "processed_qty", label: "PO Raised (MT)" },
  { id: "delivery_qty", label: "Delivered Qty (MT)" },
  { id: "po_pending_qty", label: "PO Pending Qty (MT)" },
  { id: "remaining_qty", label: "Commitment Pending (MT)" },
] as const
type ColId = typeof PAGE_COLUMNS[number]["id"]

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════

// Plain fixed-decimal number (no thousands separators) so values paste cleanly into Excel
const fmtNum = (v: unknown, d = 4) => Number(v ?? 0).toFixed(d)

export default function CommitmentPunchPage() {
  const { toast } = useToast()
  const { user, isAdmin, isFeatureEnabled } = useAuth()
  const canSortColumns = isAdmin || isFeatureEnabled('can_sort_columns')

  // ── Pending table state ─────────────────────────────────────
  const [pendingList, setPendingList] = useState<PendingCommitment[]>([])
  const [isLoadingPending, setIsLoadingPending] = useState(false)
  const [pendingPage, setPendingPage] = useState(1)
  const [pendingTotalPages, setPendingTotalPages] = useState(1)
  const [pendingTotal, setPendingTotal] = useState(0)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  // Status + sort are remembered permanently (per user); oil/customer/searches/dates survive a
  // refresh but reset on a new session - see usePersistedFilters. Refresh button only reloads data.
  const [listView, patchListView] = usePersistedFilters("commitment-punch", {
    searchQuery: "",
    commitmentDateFilter: "",
    dateFromFilter: "",
    dateToFilter: "",
    selectedOilFilter: "ALL",
    selectedCustomerFilter: "ALL",
    selectedStatusFilter: "PENDING" as "ALL" | "PENDING" | "COMPLETED",
    columnFilters: {} as Record<string, string>,
    pendingSortField: "",
    pendingSortDir: "asc" as "asc" | "desc",
  }, { permanentKeys: ["selectedStatusFilter", "pendingSortField", "pendingSortDir"] })
  const { searchQuery, commitmentDateFilter, dateFromFilter, dateToFilter, selectedOilFilter, selectedCustomerFilter, selectedStatusFilter, columnFilters, pendingSortField, pendingSortDir } = listView
  const setSearchQuery = (v: string) => patchListView({ searchQuery: v })
  const setCommitmentDateFilter = (v: string) => patchListView({ commitmentDateFilter: v })
  const setDateFromFilter = (v: string) => patchListView({ dateFromFilter: v })
  const setDateToFilter = (v: string) => patchListView({ dateToFilter: v })
  const setSelectedOilFilter = (v: string) => patchListView({ selectedOilFilter: v })
  const setSelectedCustomerFilter = (v: string) => patchListView({ selectedCustomerFilter: v })
  const setSelectedStatusFilter = (v: "ALL" | "PENDING" | "COMPLETED") => patchListView({ selectedStatusFilter: v })
  const setColumnFilters = (v: Record<string, string>) => patchListView({ columnFilters: v })

  // ── Add Commitment dialog ───────────────────────────────────
  const [isAddOpen, setIsAddOpen] = useState(false)

  // ── Process dialog ──────────────────────────────────────────
  const [isProcessOpen, setIsProcessOpen] = useState(false)
  const [processPoNo, setProcessPoNo] = useState("")
  const [processPoDate, setProcessPoDate] = useState("")
  const [processDeliveryPurpose, setProcessDeliveryPurpose] = useState("week-on-week")
  const [processDepoName, setProcessDepoName] = useState("Banari")
  const [processCustomerName, setProcessCustomerName] = useState("")
  const [processAdvancePaymentTaken, setProcessAdvancePaymentTaken] = useState("NO")
  const [processAdvancePayment, setProcessAdvancePayment] = useState("")
  const [processPaymentTerms, setProcessPaymentTerms] = useState("7days")
  const [processOrderTypeThrough, setProcessOrderTypeThrough] = useState("")
  const [processOrderType, setProcessOrderType] = useState("regular")
  // ⚠️ FIX: Dedicated transport type state for the Process dialog.
  // Previously shared with the Add form's transportType, causing cross-contamination.
  const [processTransportType, setProcessTransportType] = useState("self")
  const [processStartDate, setProcessStartDate] = useState("")
  const [processEndDate, setProcessEndDate] = useState("")
  const [processActualDeliveryDate, setProcessActualDeliveryDate] = useState("")
  const [processUploadCopy, setProcessUploadCopy] = useState<File | null>(null)
  const [processRemarks, setProcessRemarks] = useState("")
  const [processDeliveryDateError, setProcessDeliveryDateError] = useState("")
  const [processFuturePeriodDate, setProcessFuturePeriodDate] = useState("")
  const [processOrderCategory, setProcessOrderCategory] = useState("Sales")
  const [isFuturePeriodDatePickerOpen, setIsFuturePeriodDatePickerOpen] = useState(false)
  const [isActualDeliveryPickerOpen, setIsActualDeliveryPickerOpen] = useState(false)
  // Stores the full commitment row (with planned names) that the Process dialog is acting on.
  const [processSelectedCommitment, setProcessSelectedCommitment] = useState<PendingCommitment | null>(null)
  const [skuRows, setSkuRows] = useState<SkuRow[]>([
    { id: "1", sku: "", qty: "", rate: "" },
  ])
  const [ledgerRows, setLedgerRows] = useState<LedgerRow[]>([])
  // GST is NOT typed by the user: each SKU's GST % comes from the Finished Good master
  // (skus.gst_rate_id -> gst_rate lookup) and Same/Other State is detected from the
  // depot's state vs the customer's state.
  const [gstRateById, setGstRateById] = useState<Record<string, number>>({})
  const [depotState, setDepotState] = useState<string>("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [skuRegistry, setSkuRegistry] = useState<Record<string, any>>({})

  // ── Ledger row helpers ──────────────────────────────────────
  const addLedgerRow = () =>
    setLedgerRows(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), ledgerName: "", amount: "" }])

  const removeLedgerRow = (id: string) =>
    setLedgerRows(prev => prev.filter(r => r.id !== id))

  const updateLedgerRow = (id: string, field: keyof LedgerRow, value: string) =>
    setLedgerRows(prev => prev.map(r => (r.id === id ? { ...r, [field]: value } : r)))

  // ── Edit Commitment mode ────────────────────────────────────
  // When isEditMode = true, handleAddSubmit calls updateCommitment instead of createCommitment.
  const [isEditMode, setIsEditMode] = useState(false)
  const [editCommitmentId, setEditCommitmentId] = useState<number | null>(null)
  // ── PO Raised Details popup ────────────────────────────────────────
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [detailsRow, setDetailsRow] = useState<PendingCommitment | null>(null)
  const [detailsData, setDetailsData] = useState<any>(null)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [detailsType, setDetailsType] = useState<"raised" | "delivered" | "pending">("raised")
  const [detailsColumnFilters, setDetailsColumnFilters] = useState<Record<string, string>>({})
  const [detailsHiddenCols, setDetailsHiddenCols] = useState<Record<string, boolean>>({})

  // ── Add Commitment form state ───────────────────────────────
  const [commitmentDate, setCommitmentDate] = useState(new Date().toISOString().split("T")[0])
  const [partyName, setPartyName] = useState("")
  const [contactPerson, setContactPerson] = useState("")
  const [whatsappNo, setWhatsappNo] = useState("")
  const [customerAddress, setCustomerAddress] = useState("")
  const [shipToAddress, setShipToAddress] = useState("")
  // Ship to = dropdown of the customer's Customer Master addresses (same as Order Punch)
  const statesById = useStatesMap()
  const [addCustomerId, setAddCustomerId] = useState<number | null>(null)
  const { addresses: shipToOptions, hasMultiple: hasMultipleShipTo } = useCustomerAddresses(addCustomerId, statesById)
  const [customerList, setCustomerList] = useState<any[]>([])

  // GST rate lookup (id -> %), same source the Finished Good master uses for its GST Rate dropdown
  useEffect(() => {
    let cancelled = false
    lookupApi.getAll("gst_rate", { page: 1, limit: 1000, all: "true" }).then((res: any) => {
      if (cancelled || !res?.success) return
      const items = res.data?.items || []
      const map: Record<string, number> = {}
      items.forEach((it: any) => {
        const id = it.id ?? it.lookup_id
        const pct = parseFloat(it.rate)
        if (id != null && Number.isFinite(pct)) map[String(id)] = pct
      })
      setGstRateById(map)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Dispatch-from depot's state (Depot master)
  useEffect(() => {
    let cancelled = false
    if (!processDepoName) { setDepotState(""); return }
    depotApi.getAll({ search: processDepoName, all: "true" }).then((res: any) => {
      if (cancelled) return
      const list = res?.data?.depots || []
      const depot = list.find((d: any) => (d.depot_name || "").toLowerCase() === processDepoName.toLowerCase()) || list[0]
      setDepotState((depot?.state || "").toString())
    }).catch(() => { if (!cancelled) setDepotState("") })
    return () => { cancelled = true }
  }, [processDepoName])

  // Customer's state (Customer master) -> Same State / Other State is detected, never typed
  const customerState = (customerList.find((c: any) => (c.customer_name || "").toLowerCase() === processCustomerName.toLowerCase())?.state || "").toString()
  const stateDetected = !!depotState.trim() && !!customerState.trim()
  const gstSupplyType: "INTRA" | "INTER" =
    stateDetected && depotState.trim().toLowerCase() !== customerState.trim().toLowerCase() ? "INTER" : "INTRA"

  // GST % of a SKU row = the GST Rate set on that Finished Good in the master (0 when not set)
  const skuGstPercent = (skuName: string): number => {
    const d = skuRegistry[skuName]
    const id = d?.gst_rate_id ?? d?.gstRateId
    return id != null && gstRateById[String(id)] != null ? gstRateById[String(id)] : 0
  }
  const rateWithoutGst = (skuName: string, rate: string | number): number =>
    (parseFloat(String(rate)) || 0) / (1 + skuGstPercent(skuName) / 100)

  const [orderType, setOrderType] = useState("")
  const [transportType, setTransportType] = useState("self")
  const [brokerName, setBrokerName] = useState("")
  const [salespersonName, setSalespersonName] = useState("")
  const [orderThrough, setOrderThrough] = useState("Direct")
  const [depotName, setDepotName] = useState("Banari")
  const [advancePayment, setAdvancePayment] = useState("No")
  const [paymentTerms, setPaymentTerms] = useState("7days")
  const [remarks, setRemarks] = useState("")
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [rows, setRows] = useState<ProductRow[]>([
    { id: "1", oil_type: "Rice Oil", quantity: "", unit: "Metric Ton", rate: "" },
  ])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ── Load pending commitments ────────────────────────────────
  const uniqueDetailsCustomers = useMemo(() => {
    if (!detailsData?.details) return []
    const set = new Set<string>()
    detailsData.details.forEach((r: any) => {
      const cust = r.customer_name || detailsData.commitment?.customer?.customer_name || detailsRow?.party_name
      if (cust) set.add(cust)
    })
    return Array.from(set).sort()
  }, [detailsData, detailsRow])

  const uniqueDetailsOilTypes = useMemo(() => {
    if (!detailsData?.details) return []
    const set = new Set<string>()
    detailsData.details.forEach((r: any) => {
      const oil = r.oil_type || detailsRow?.oil_type
      if (oil) set.add(oil)
    })
    return Array.from(set).sort()
  }, [detailsData, detailsRow])

  const filteredDetailsData = useMemo(() => {
    if (!detailsData?.details) return []
    return detailsData.details.filter((d: any) => {
      const filters = Object.entries(detailsColumnFilters).filter(([_, v]) => v.trim() !== '')
      if (filters.length === 0) return true
      
      return filters.every(([col, searchStr]) => {
        if (col.endsWith("_from")) {
          const baseCol = col.replace("_from", "")
          const val = d[baseCol]
          if (!val) return false
          const rowDate = new Date(val)
          const filterDate = new Date(searchStr)
          rowDate.setHours(0,0,0,0)
          filterDate.setHours(0,0,0,0)
          return rowDate >= filterDate
        }
        if (col.endsWith("_to")) {
          const baseCol = col.replace("_to", "")
          const val = d[baseCol]
          if (!val) return false
          const rowDate = new Date(val)
          const filterDate = new Date(searchStr)
          rowDate.setHours(0,0,0,0)
          filterDate.setHours(0,0,0,0)
          return rowDate <= filterDate
        }
        
        let val = d[col]
        if (col === "customer_name" && !val) val = detailsData.commitment?.customer?.customer_name || detailsRow?.party_name
        if (col === "manual_sauda_no" && !val) val = d.manual_sauda_no || detailsRow?.commitment_no
        if (col === "oil_type" && !val) val = d.oil_type || detailsRow?.oil_type
        if (col === "raised_at" || col === "do_date" || col === "invoice_date" || col === "po_date") {
           val = val ? new Date(val).toLocaleDateString("en-GB") : ""
        }
        return String(val || "").toLowerCase().includes(searchStr.toLowerCase())
      })
    })
  }, [detailsData, detailsColumnFilters, detailsRow])

  const loadPending = useCallback(async () => {
    setIsLoadingPending(true)
    try {
      const res = await commitmentPunchApi.getPending({
        search: searchQuery || undefined,
        commitment_date: commitmentDateFilter || undefined,
        page: pendingPage,
        limit: 50,
      })
      if (res.success) {
        setPendingList(res.data?.commitments || [])
        setPendingTotalPages(res.data?.pagination?.totalPages || 1)
        setPendingTotal(res.data?.pagination?.total ?? (res.data?.commitments || []).length)
      }
    } catch {
      toast({ title: "Error", description: "Failed to load pending commitments.", variant: "destructive" })
    } finally {
      setIsLoadingPending(false)
    }
  }, [searchQuery, commitmentDateFilter, pendingPage, toast])

  // A new search/date narrows the result set, so go back to page 1.
  useEffect(() => { setPendingPage(1) }, [searchQuery, commitmentDateFilter])

  useEffect(() => { loadPending() }, [loadPending])

  // ── Fetch commitment details for popup ─────────────────────────────────────
  const openDetails = async (row: PendingCommitment, e: React.MouseEvent, type: "raised" | "delivered" | "pending" = "raised") => {
    e.stopPropagation()
    setDetailsType(type)
    setDetailsRow(row)
    setDetailsData(null)
    setIsDetailsOpen(true)
    setIsLoadingDetails(true)
    try {
      const res = await commitmentPunchApi.getDetails(row.id)
      if (res.success) setDetailsData(res.data)
    } catch {
      toast({ title: "Error", description: "Failed to load commitment details.", variant: "destructive" })
    } finally {
      setIsLoadingDetails(false)
    }
  }

  // Start Date defaults to today and End Date to +7 days. Set when the Process dialog is opened
  // (see openProcessForCommitment) and again here as a safety net, so both dates are always filled.
  const localISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  const defaultProcessDates = () => {
    const start = new Date()
    const end = new Date()
    end.setDate(end.getDate() + 7)
    return { start: localISO(start), end: localISO(end) }
  }
  useEffect(() => {
    if (isProcessOpen && (!processStartDate || !processEndDate)) {
      const { start, end } = defaultProcessDates()
      setProcessStartDate(processStartDate || start)
      setProcessEndDate(end)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProcessOpen])

  // ── Customer / Broker / Salesperson fetch callbacks ─────────
  // Only customers flagged "Is Required for Commitment" = Yes appear here,
  // filtered server-side - never by matching a name substring. The dialog opens
  // blank (no auto-selected default customer); the user picks one every time.
  const fetchCustomerOptions = useCallback(async (search: string, page: number) => {
    try {
      const res = await customerApi.getAll({ search, page, limit: 30, is_required_for_commitment: "Yes" })
      const items = res.success ? (res.data.customers || (Array.isArray(res.data) ? res.data : [])) : []
      const seen = new Map<string, boolean>()

      const STATE_SHORT_MAP: Record<string, string> = {
        "Chhattisgarh": "CG",
        "Maharashtra": "MH",
        "Madhya Pradesh": "MP",
        "Uttar Pradesh": "UP",
        "Delhi": "DL",
        "Gujarat": "GJ",
        "Rajasthan": "RJ",
        "Punjab": "PB",
        "Haryana": "HR",
        "West Bengal": "WB",
        "Bihar": "BR",
        "Jharkhand": "JH",
        "Odisha": "OR",
        "Karnataka": "KA",
        "Tamil Nadu": "TN",
        "Andhra Pradesh": "AP",
        "Telangana": "TS",
        "Kerala": "KL"
      }

      const options = items
        .map((c: any) => {
          const addr1 = c.address_line_1 || ""
          const city = addr1 ? addr1.split(",").pop().trim() : ""
          // Prefer the real GST short name from the States master (joined server-side).
          const stateShort = c.state_short_name || (c.state ? (STATE_SHORT_MAP[c.state] || c.state.substring(0, 2).toUpperCase()) : "")
          const locationPart = [city, stateShort ? `(${stateShort})` : ""].filter(Boolean).join(" ")

          // Spec format: Customer Name, City (State short name), GST No. – Mobile No. – Contact Person Name
          const idPart = [c.gstin, c.contact, c.contact_person].filter(Boolean).join(" – ")

          const fullSearchLabel = [c.customer_name, locationPart, c.gstin, c.contact, c.contact_person].filter(Boolean).join(" ")

          const formattedDropdownLabel = (
            <div className="text-xs whitespace-normal break-words py-1 w-full text-left font-normal text-slate-700 max-w-[500px]">
              <span className="font-semibold text-slate-900">{c.customer_name}</span>
              {[`, ${locationPart}`, idPart].filter(Boolean).join(", ")}
            </div>
          )

          return {
            value: c.customer_name,
            label: fullSearchLabel,
            dropdownLabel: formattedDropdownLabel,
            original: c
          }
        })
        .filter((o: any) => {
          if (!o.value || seen.has(o.value)) return false
          seen.set(o.value, true)
          return true
        })
      // Update customer list for auto-fill
      setCustomerList((prev: any[]) => {
        const newItems = items.filter((c: any) => !prev.find((p: any) => p.id === c.id))
        return newItems.length ? [...prev, ...newItems] : prev
      })
      return { options, hasMore: false }
    } catch { return { options: [], hasMore: false } }
  }, [])

  // Fetch live Ledgers from Master DB (`ledgers` table)
  const fetchLedgerOptions = useCallback(async (search: string, page: number) => {
    try {
      const res = await ledgerApi.getAll({ search, page, limit: 50 })
      const items = res.success ? (res.data.ledgers || (Array.isArray(res.data) ? res.data : [])) : []
      const options = items
        .filter((l: any) => !l.status || l.status === "Active")
        .map((l: any) => {
          const n = l.ledger_name || l.ledgerName || l.name || ""
          return { value: n, label: n, original: l }
        })
        .filter((o: any) => o.value)

      return { options, hasMore: false }
    } catch {
      return { options: [], hasMore: false }
    }
  }, [])


  const fetchBrokerOptions = useCallback(async (search: string, page: number) => {
    try {
      const res = await brokerApi.getAll({ search, page, limit: 30 })
      const items = res.success ? (res.data.brokers || (Array.isArray(res.data) ? res.data : [])) : []
      const options = items
        .map((b: any) => { const n = b.salesman_name || b.broker_name || b.name || ""; return { value: n, label: n } })
        .filter((o: any) => o.value)
      return { options, hasMore: options.length === 30 }
    } catch { return { options: [], hasMore: false } }
  }, [])

  const fetchSalespersonOptions = useCallback(async (search: string, page: number) => {
    try {
      const res = await salespersonApi.getAll({ search, page, limit: 30 })
      const items = res.success ? (res.data.salespersons || res.data.brokers || (Array.isArray(res.data) ? res.data : [])) : []
      const options = items
        .map((s: any) => { const n = s.salesman_name || s.salesperson_name || s.name || ""; return { value: n, label: n } })
        .filter((o: any) => o.value)
      return { options, hasMore: options.length === 30 }
    } catch { return { options: [], hasMore: false } }
  }, [])

  const fetchDepoOptions = useCallback(async (search: string, page: number) => {
    try {
      const res = await depotApi.getAll({ search, page, limit: 30 })
      const items = res.success ? (res.data.depots || (Array.isArray(res.data) ? res.data : [])) : []
      const options = items
        .map((d: any) => ({ value: d.depot_name, label: d.depot_name }))
        .filter((o: any) => o.value)
      return { options, hasMore: options.length === 30 }
    } catch { return { options: [], hasMore: false } }
  }, [])

  // Oil Tag master (id + name) — used to match SKUs to the commitment's oil type
  const [oilTags, setOilTags] = useState<any[]>([])
  useEffect(() => {
    let cancelled = false
    oilTagApi.getAll({ all: "true" }).then((res: any) => {
      if (cancelled || !res?.success) return
      const list = Array.isArray(res.data?.items) ? res.data.items : (Array.isArray(res.data) ? res.data : [])
      setOilTags(list)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Fetch SKU options — only show SKUs with tag = "Yes" and matching commitment's oil_type if present
  const fetchSkuOptions = useCallback(async (search: string, _page: number) => {
    try {
      const res = await skuApi.getAll({ search: search || "", limit: 100 })
      const items = res.success
        ? (res.data.skuDetails || res.data.skus || res.data.sku_details || (Array.isArray(res.data) ? res.data : []))
        : []
      // Filter SKUs with tag_name = "Yes"
      let goodLifeItems = items.filter((s: any) =>
        (s.tag_name || "").toLowerCase() === "yes"
      )

      // Filter by commitment's oil_type if processing a commitment
      if (processSelectedCommitment?.oil_type) {
        const oilTypeLower = processSelectedCommitment.oil_type.toLowerCase()
        let keywords: string[] = []
        if (oilTypeLower.includes("rice")) keywords = ["rice", "r.o.", " ro ", "rbo"]
        else if (oilTypeLower.includes("palm")) keywords = ["palm", "p.o.", " po "]
        else if (oilTypeLower.includes("soya")) keywords = ["soya", "s.o.", " so ", "sbo"]

        // Preferred: the Oil Tag master (skus.oil_tag_id -> oil_tags.name). Falls
        // back to the name keywords below only when no tagged SKU matches.
        const family = ["rice", "palm", "soya"].find(f => oilTypeLower.includes(f))
        const matchingTagIds = new Set(
          oilTags
            .filter((t: any) => { const n = String(t.name || "").toLowerCase().trim(); return n === oilTypeLower.trim() || (!!family && n.includes(family)) })
            .map((t: any) => Number(t.id))
        )
        const taggedItems = matchingTagIds.size > 0
          ? goodLifeItems.filter((s: any) => s.oil_tag_id != null && matchingTagIds.has(Number(s.oil_tag_id)))
          : []

        if (taggedItems.length > 0) {
          goodLifeItems = taggedItems
        } else if (keywords.length > 0) {
          goodLifeItems = goodLifeItems.filter((s: any) => {
            const nameLower = (s.sku_name || s.name || "").toLowerCase()
            return keywords.some(kw => nameLower.includes(kw))
          })
        }
      }

      const seen = new Set<string>()
      const newlyFetched: Record<string, any> = {}
      const options = goodLifeItems
        .map((s: any) => {
          const n = s.sku_name || s.name || ""
          newlyFetched[n] = s
          return { value: n, label: n }
        })
        .filter((o: any) => { if (!o.value || seen.has(o.value)) return false; seen.add(o.value); return true })

      setSkuRegistry(prev => ({ ...prev, ...newlyFetched }))
      return { options, hasMore: false }
    } catch { return { options: [], hasMore: false } }
  }, [processSelectedCommitment, oilTags])

  // ── Checkbox selection ──────────────────────────────────────
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === pendingList.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(pendingList.map(r => r.id)))
    }
  }

  // ── Add Commitment helpers ──────────────────────────────────
  const resetAddForm = () => {
    setCommitmentDate(new Date().toISOString().split("T")[0])
    setPartyName("")
    setContactPerson("")
    setWhatsappNo("")
    setCustomerAddress("")
    setShipToAddress("")
    setAddCustomerId(null)
    setBrokerName("")
    setSalespersonName("")
    setOrderThrough("Direct")
    setDepotName("Banari")
    setAdvancePayment("No")
    setPaymentTerms("7days")
    setRemarks("")
    setPdfFile(null)
    setOrderType("")
    setTransportType("self")
    setRows([{ id: "1", oil_type: "Rice Oil", quantity: "", unit: "Metric Ton", rate: "" }])
    // Reset edit mode
    setIsEditMode(false)
    setEditCommitmentId(null)
  }

  // Opens the Add/Edit dialog pre-filled with an existing commitment's planned values.
  const openEditCommitment = async (row: PendingCommitment, e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditMode(true)
    setEditCommitmentId(row.id)
    // Pre-fill from the list row data (depot_name, payment_terms, etc. are already joined)
    setCommitmentDate(row.commitment_date ? new Date(row.commitment_date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0])
    setPartyName(row.party_name || "")
    setOrderThrough(row.order_through || "Direct")
    setDepotName(row.depot_name || "Banari")
    setPaymentTerms(row.payment_terms || "7days")
    setTransportType(row.transport_type || "self")
    setAdvancePayment(row.advance_payment_to_be_taken ? "Yes" : "No")
    // Broker / Salesperson
    if (row.order_through === "Broker" && row.broker_name) {
      setBrokerName(row.broker_name)
    } else {
      setBrokerName("")
    }
    if (row.order_through === "Salesperson" && row.salesperson_name) {
      setSalespersonName(row.salesperson_name)
    } else {
      setSalespersonName("")
    }
    // Fetch full details for contact person / address fields that aren’t in the list row
    try {
      const res = await commitmentPunchApi.getById(row.id)
      if (res.success && res.data) {
        const d = res.data
        setContactPerson(d.customer_contact_person_name || "")
        setWhatsappNo(d.whatsapp_no || "")
        setCustomerAddress(d.address || "")
        setShipToAddress(d.ship_to_address || "")
        setRemarks(d.remarks || "")
      }
    } catch { /* non-critical: form still opens with list data */ }
    // Oil / qty / rate are fixed after creation (the update API ignores them): show the real values, locked.
    setRows([{ id: "edit-row", oil_type: row.oil_type || "", quantity: row.quantity != null ? String(row.quantity) : "", unit: "Metric Ton", rate: row.rate != null ? String(row.rate) : "" }])
    setIsAddOpen(true)
  }

  const addRow = () =>
    setRows(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), oil_type: "Rice Oil", quantity: "", unit: "Metric Ton", rate: "" }])

  const removeRow = (id: string) => {
    if (rows.length > 1) setRows(prev => prev.filter(r => r.id !== id))
  }

  const updateRow = (id: string, field: keyof ProductRow, value: string) => {
    setRows(prev => prev.map(r => {
      if (r.id === id) {
        const updated = { ...r, [field]: value };
        // Auto-select unit to Metric Ton when oil type is selected
        if (field === "oil_type" && value) {
          updated.unit = "Metric Ton";
        }
        return updated;
      }
      return r;
    }))
  }

  const handleOrderTypeChange = (val: string) => {
    setOrderType(val)
    setBrokerName("")
    setSalespersonName("")
  }

  // Every validation problem in ONE toast (a bulleted list) so the user can fix them all in one go.
  const showProblems = (problems: string[], title = "Please fix the following") => {
    toast({
      title: problems.length > 1 ? `${title} (${problems.length})` : title,
      description: (
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          {problems.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      ),
      variant: "destructive",
      duration: Math.min(3000 + problems.length * 1000, 8000), // more problems -> more time to read
    })
  }

  // ── Submit Add Commitment ───────────────────────────────────
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const problems: string[] = []
    if (!partyName) problems.push("Customer name is required.")
    if (!commitmentDate) problems.push("Commitment date is required.")
    if (orderThrough === "Broker" && !brokerName) problems.push("Broker name is required.")
    if (orderThrough === "Salesperson" && !salespersonName) problems.push("Salesperson is required.")
    // Client spec: the user must upload the Commitment PDF (when creating).
    if (!isEditMode && !pdfFile) problems.push("Commitment PDF is required.")
    // Oil row validation only applies when creating - edits don't change oil details
    if (!isEditMode && rows.some(r => !r.oil_type || !r.quantity || !r.rate)) problems.push("Fill Oil Type, Quantity and Rate for all rows.")
    if (problems.length) { showProblems(problems); return }

    setIsSubmitting(true)
    try {
      // 1. Resolve Customer ID (only needed for create)
      let customerId: number | null = null
      if (!isEditMode) {
        customerId = customerList.find((c: any) => (c.customer_name || "").toLowerCase() === partyName.toLowerCase())?.id
        if (!customerId) {
          const res = await customerApi.getAll({ search: partyName, limit: 5 })
          const items = res.success ? (res.data.customers || (Array.isArray(res.data) ? res.data : [])) : []
          customerId = items.find((c: any) => (c.customer_name || "").toLowerCase() === partyName.toLowerCase())?.id
        }
        if (!customerId) {
          toast({ title: "Unknown Customer", description: `Could not match "${partyName}" to a known customer. Please pick one from the list.`, variant: "destructive" })
          setIsSubmitting(false)
          return
        }
      }

      // 2. Resolve Depot ID
      let depotId: number | null = null
      if (depotName) {
        const depotRes = await depotApi.getAll({ search: depotName, all: "true" })
        const depotItems = depotRes.success ? (depotRes.data.depots || (Array.isArray(depotRes.data) ? depotRes.data : [])) : []
        depotId = depotItems.find((d: any) => (d.depot_name || "").toLowerCase() === depotName.toLowerCase())?.id ?? null
      }

      // 3. Resolve Broker ID
      let brokerId: number | null = null
      if (orderThrough === "Broker" && brokerName) {
        const brokerRes = await brokerApi.getAll({ search: brokerName, limit: 30 })
        const brokerItems = brokerRes.success ? (brokerRes.data.brokers || (Array.isArray(brokerRes.data) ? brokerRes.data : [])) : []
        brokerId = brokerItems.find((b: any) => {
          const n = b.salesman_name || b.broker_name || b.name || ""
          return n.toLowerCase() === brokerName.toLowerCase()
        })?.id ?? null
      }

      // 4. Resolve Salesperson ID
      let salespersonId: number | null = null
      if (orderThrough === "Salesperson" && salespersonName) {
        const spRes = await salespersonApi.getAll({ search: salespersonName, limit: 30 })
        const spItems = spRes.success ? (spRes.data.salespersons || (Array.isArray(spRes.data) ? spRes.data : [])) : []
        salespersonId = spItems.find((s: any) => {
          const n = s.salesman_name || s.name || ""
          return n.toLowerCase() === salespersonName.toLowerCase()
        })?.id ?? null
      }

      // 5. Upload PDF file
      let uploadCopy: string | null = null
      if (pdfFile) {
        const uploadRes = await orderApi.uploadFile(pdfFile)
        if (uploadRes.success) {
          uploadCopy = uploadRes.data.url
        }
      }

      if (isEditMode && editCommitmentId != null) {
        // ── UPDATE MODE ─────────────────────────────────────────
        const updatePayload = {
          commitmentDate,
          customerContactPersonName: contactPerson || null,
          whatsappNo: whatsappNo || null,
          address: customerAddress || null,
          shipToAddress: shipToAddress || null,
          depotId,
          advancePaymentToBeTaken: advancePayment === "Yes",
          paymentTerms,
          transportType,
          orderThrough,
          brokerId,
          salespersonId,
          uploadCopy: uploadCopy || undefined,
          remarks: remarks || null,
        }
        const res = await commitmentPunchApi.updateCommitment(editCommitmentId, updatePayload)
        if (res.success) {
          toast({ title: "✅ Commitment Updated!", description: "Planned values have been saved." })
          resetAddForm()
          setIsAddOpen(false)
          loadPending()
        } else {
          throw new Error(res.message || "Failed to update commitment")
        }
      } else {
        // ── CREATE MODE ─────────────────────────────────────────
        const payload = {
          commitmentDate,
          customerId,
          customerContactPersonName: contactPerson || null,
          whatsappNo: whatsappNo || null,
          address: customerAddress || null,
          shipToAddress: shipToAddress || null,
          depotId,
          advancePaymentToBeTaken: advancePayment === "Yes",
          paymentTerms,
          transportType,
          orderThrough,
          brokerId,
          salespersonId,
          uploadCopy,
          remarks: remarks || null,
          rows: rows.map(r => ({
            oilType: r.oil_type,
            quantity: parseFloat(r.quantity),
            unit: r.unit || null,
            rate: parseFloat(r.rate),
          })),
        }
        const res = await commitmentPunchApi.create(payload)
        if (res.success) {
          toast({ title: "✅ Commitment Created!", description: `Commitment No: ${res.data?.commitment_no}` })
          resetAddForm()
          setIsAddOpen(false)
          loadPending()
        } else {
          throw new Error(res.message || "Failed to create commitment")
        }
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Could not save commitment.", variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── SKU row helpers ─────────────────────────────────────────
  const addSkuRow = () =>
    setSkuRows(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), sku: "", qty: "", rate: "" }])

  const removeSkuRow = (id: string) => {
    if (skuRows.length > 1) {
      setSkuRows(prev => prev.filter(r => r.id !== id))
    } else {
      // If it's the only row, clear its values back to initial empty state
      setSkuRows([{ id: "1", sku: "", qty: "", rate: "", mt: 0 }])
    }
  }

  const updateSkuRow = (id: string, field: keyof SkuRow, value: string) => {
    setSkuRows(prev => prev.map(r => {
      if (r.id === id) {
        const updated = { ...r, [field]: value }

        // Recalculate MT
        const skuData = skuRegistry[field === "sku" ? value : updated.sku]
        if (skuData) {
          const qty = parseFloat(field === "qty" ? value : updated.qty) || 0
          const skuWeight = parseFloat(skuData.sku_weight || 0)
          updated.mt = (skuWeight / 1000) * qty
        }
        return updated
      }
      return r
    }))
  }



  const openProcessForCommitment = (row: PendingCommitment) => {
    setSelectedIds(new Set([row.id]))
    // Store the full commitment row so the Process dialog can show the Planned Values panel
    setProcessSelectedCommitment(row)

    // Pre-fill fields from commitment planned data (if specified on commitment)
    if (row.party_name) setProcessCustomerName(row.party_name)
    else setProcessCustomerName("")

    if (row.depot_name) setProcessDepoName(row.depot_name)
    else setProcessDepoName("Banari")

    if (row.payment_terms) setProcessPaymentTerms(row.payment_terms)
    else setProcessPaymentTerms("7days")

    if (row.transport_type) setProcessTransportType(row.transport_type)
    else setProcessTransportType("self")

    setProcessAdvancePaymentTaken(row.advance_payment_to_be_taken ? "YES" : "NO")

    if (row.order_through) {
      const throughMap: Record<string, string> = { Direct: "direct", Broker: "broker", Salesperson: "salesperson" }
      const throughVal = throughMap[row.order_through] || row.order_through.toLowerCase()
      setProcessOrderTypeThrough(throughVal)
      setBrokerName(throughVal === "broker" && row.broker_name ? row.broker_name : "")
      setSalespersonName(throughVal === "salesperson" && row.salesperson_name ? row.salesperson_name : "")
    } else {
      setProcessOrderTypeThrough("")
      setBrokerName("")
      setSalespersonName("")
    }

    const { start, end } = defaultProcessDates()
    setProcessStartDate(start)
    setProcessEndDate(end)
    setIsProcessOpen(true)
  }

  const resetProcess = () => {
    setProcessPoNo("")
    setProcessPoDate("")
    setProcessDeliveryPurpose("week-on-week")
    setProcessDepoName("Banari")
    setProcessCustomerName("")
    setProcessAdvancePaymentTaken("NO")
    setProcessAdvancePayment("")
    setProcessPaymentTerms("7days")
    setProcessOrderTypeThrough("")
    setProcessOrderType("regular")
    setProcessTransportType("self")
    setProcessSelectedCommitment(null)
    setProcessStartDate("")
    setProcessEndDate("")
    setProcessActualDeliveryDate("")
    setProcessFuturePeriodDate("")
    setProcessUploadCopy(null)
    setProcessRemarks("")
    setProcessDeliveryDateError("")
    setIsActualDeliveryPickerOpen(false)
    setIsFuturePeriodDatePickerOpen(false)
    setProcessOrderCategory("Sales")
    setSkuRows([{ id: "1", sku: "", qty: "", rate: "", mt: 0 }])
    setLedgerRows([])
  }

  // ── Submit Process ──────────────────────────────────────────
  const handleProcessSubmit = async () => {
    const problems: string[] = []
    if (!processPoNo) problems.push("PO No. is required.")
    if (!processPoDate) problems.push("PO Date is required.")
    if (skuRows.some(r => !r.sku || !r.qty || !r.rate)) problems.push("Fill SKU, Qty and Rate for all rows.")

    // MT Validation
    const totalReqMt = skuRows.reduce((sum, r) => sum + (r.mt || 0), 0)
    const selectedCm = pendingList.find(p => selectedIds.has(p.id))
    const remainingMt = selectedCm ? (selectedCm.remaining_qty ?? selectedCm.quantity) : 0
    if (totalReqMt > remainingMt + 0.0001) {
      problems.push(`Total weight (${totalReqMt.toFixed(4)} MT) exceeds remaining balance (${remainingMt.toFixed(4)} MT).`)
    }

    const unfinishedLedger = ledgerRows.findIndex(r => (r.ledgerName || r.amount) && (!r.ledgerId || !(parseFloat(r.amount) > 0)))
    if (unfinishedLedger !== -1) {
      problems.push(`Additional ledger ${unfinishedLedger + 1} needs a ledger picked from the list and an amount (or remove it).`)
    }
    if (problems.length) { showProblems(problems); return }

    setIsProcessing(true)
    try {
      const ids = Array.from(selectedIds)
      let successCount = 0
      let errorMsgs: string[] = []
      let generatedOrderNos: string[] = []

      // Handle SO copy upload if selected
      let uploadedCopyUrl: string | null = null
      if (processUploadCopy) {
        try {
          // @ts-ignore
          const uploadRes = await (await import("@/lib/api-service")).orderApi.uploadFile(processUploadCopy)
          if (uploadRes.success) uploadedCopyUrl = uploadRes.data.url
        } catch { /* ignore upload error */ }
      }

      // The backend links depot/broker/salesperson via real FKs (depotId/
      // brokerId/salespersonId), not the name strings these comboboxes track -
      // resolve them once up front, same pattern as the customerId resolution
      // above. Broker/salesperson are gated on processOrderTypeThrough (the
      // combobox that actually drives their visibility in this dialog) - NOT
      // the unrelated top-level `orderType` state, which has no control bound
      // to it in this dialog and can never be "broker"/"salesperson" here.
      // Resolve Customer ID if overridden in Process Dialog
      let overrideCustomerId: number | null = null
      let overrideContactPerson: string | null = null
      let overrideWhatsappNo: string | null = null
      let overrideAddress: string | null = null

      if (processCustomerName) {
        const foundCustomer = customerList.find((c: any) => (c.customer_name || "").toLowerCase() === processCustomerName.toLowerCase())
        if (foundCustomer) {
          overrideCustomerId = foundCustomer.id
          overrideContactPerson = foundCustomer.contact_person || null
          overrideWhatsappNo = foundCustomer.contact || null
          overrideAddress = formatAddressForPrint(foundCustomer) || null
        } else {
          const res = await customerApi.getAll({ search: processCustomerName, limit: 5, is_required_for_commitment: "Yes" })
          const items = res.success ? (res.data.customers || (Array.isArray(res.data) ? res.data : [])) : []
          const matched = items.find((c: any) => (c.customer_name || "").toLowerCase() === processCustomerName.toLowerCase())
          if (matched) {
            overrideCustomerId = matched.id
            overrideContactPerson = matched.contact_person || null
            overrideWhatsappNo = matched.contact || null
            overrideAddress = formatAddressForPrint(matched) || null
          }
        }
      }

      const depotRes = await depotApi.getAll({ search: processDepoName, all: "true" })
      const depotItems = depotRes.success ? (depotRes.data.depots || (Array.isArray(depotRes.data) ? depotRes.data : [])) : []
      const depotId = depotItems.find((d: any) => (d.depot_name || "").toLowerCase() === processDepoName.toLowerCase())?.id ?? null

      let brokerId: number | null = null
      if (processOrderTypeThrough === "broker" && brokerName) {
        const brokerRes = await brokerApi.getAll({ search: brokerName, limit: 30 })
        const brokerItems = brokerRes.success ? (brokerRes.data.brokers || (Array.isArray(brokerRes.data) ? brokerRes.data : [])) : []
        brokerId = brokerItems.find((b: any) => (b.salesman_name || b.broker_name || "").toLowerCase() === brokerName.toLowerCase())?.id ?? null
      }
      let salespersonId: number | null = null
      if (processOrderTypeThrough === "salesperson" && salespersonName) {
        const spRes = await salespersonApi.getAll({ search: salespersonName, limit: 30 })
        const spItems = spRes.success ? (spRes.data.salespersons || spRes.data.brokers || (Array.isArray(spRes.data) ? spRes.data : [])) : []
        salespersonId = spItems.find((s: any) => (s.salesman_name || s.salesperson_name || "").toLowerCase() === salespersonName.toLowerCase())?.id ?? null
      }

      const orderThroughMap: Record<string, string> = { direct: "Direct", broker: "Broker", salesperson: "Salesperson" }

      // Ledger charges belong to ONE order: they are sent with the first order raised and never again.
      const ledgerCharges = ledgerRows
        .filter(r => r.ledgerId && (parseFloat(r.amount) || 0) > 0)
        .map(r => ({ ledgerId: r.ledgerId as number, amount: parseFloat(r.amount) }))
      let chargesPending = ledgerCharges.length > 0

      for (const id of ids) {
        // For each selected commitment, submit each SKU row as a separate detail record
        for (const skuRow of skuRows) {
          const skuId = skuRegistry[skuRow.sku]?.id ?? null
          if (!skuId) {
            errorMsgs.push(`Could not match "${skuRow.sku}" to a known SKU. Please pick one from the list.`)
            continue
          }
          const payload = {
            customerId: overrideCustomerId,
            customerContactPersonName: overrideContactPerson,
            whatsappNo: overrideWhatsappNo,
            customerAddress: overrideAddress,
            poNo: processPoNo,
            poDate: processPoDate,
            skuId,
            skuQuantity: parseFloat(skuRow.qty),
            skuRate: parseFloat(skuRow.rate),
            orderType: processOrderType || null,
            typeOfTransporting: processTransportType || null,
            brokerId,
            salespersonId,
            deliveryPurpose: processDeliveryPurpose,
            depotId,
            advanceAmount: processAdvancePayment ? parseFloat(processAdvancePayment) : null,
            advancePaymentToBeTaken: processAdvancePaymentTaken === "YES",
            paymentTerms: processPaymentTerms,
            orderThrough: orderThroughMap[processOrderTypeThrough] ?? null,
            startDate: processStartDate || null,
            endDate: processEndDate || null,
            deliveryDate: processActualDeliveryDate || null,
            futurePeriodDate: processFuturePeriodDate || null,
            uploadCopy: uploadedCopyUrl,
            remarks: processRemarks || null,
            orderCategory: processOrderCategory,
            userId: user?.id || null, // Track acting user's login id (stamps order_punch_user)
            ...(chargesPending ? { charges: ledgerCharges } : {}),
          }
          const sentCharges = chargesPending
          const res = await commitmentPunchApi.processCommitment(id, payload)
          if (res.success) {
            if (sentCharges) chargesPending = false
            successCount++
            if (res.data?.order_no) generatedOrderNos.push(res.data.order_no)
          } else {
            errorMsgs.push(res.message || `Failed for commitment ID ${id}`)
          }
        }
      }

      if (errorMsgs.length > 0) {
        showProblems(Array.from(new Set(errorMsgs)), "Some orders could not be created")
      } else {
        const orderList = generatedOrderNos.length > 0 ? ` Orders: ${generatedOrderNos.join(", ")}` : ""
        toast({ title: "✅ Processed!", description: `${successCount} order(s) created.${orderList}` })
      }
      setIsProcessOpen(false)
      setSelectedIds(new Set())
      resetProcess()
      loadPending()
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Could not process commitments.", variant: "destructive" })
    } finally {
      setIsProcessing(false)
    }
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════


  // ── Pending Table Sorting ─────────────────────────────────────
  const handlePendingSort = (field: string) => {
    patchListView(prev => prev.pendingSortField === field
      ? { pendingSortDir: prev.pendingSortDir === "asc" ? "desc" : "asc" }
      : { pendingSortField: field, pendingSortDir: "asc" })
  }

  const PendingSortIcon = ({ field }: { field: string }) => {
    if (pendingSortField !== field) return <ArrowUpDown className="ml-1 h-3 w-3 text-slate-400 inline" />
    return pendingSortDir === "asc"
      ? <ArrowUp className="ml-1 h-3 w-3 text-blue-600 inline" />
      : <ArrowDown className="ml-1 h-3 w-3 text-blue-600 inline" />
  }

  // ── Top Filter States ─────────────────────────────────────────
  const handleColumnFilterChange = (colId: string, val: string) => {
    patchListView(prev => ({ columnFilters: { ...prev.columnFilters, [colId]: val } }))
  }

  // Extract unique oil types and customers dynamically from loaded pendingList
  const uniqueOilTypes = useMemo(() => {
    const set = new Set<string>()
    pendingList.forEach(r => { if (r.oil_type) set.add(r.oil_type) })
    return Array.from(set).sort()
  }, [pendingList])

  const uniqueCustomers = useMemo(() => {
    const set = new Set<string>()
    pendingList.forEach(r => { if (r.party_name) set.add(r.party_name) })
    return Array.from(set).sort()
  }, [pendingList])

  // Count active filters for badge and clear button
  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (selectedOilFilter && selectedOilFilter !== "ALL") count++
    if (selectedCustomerFilter && selectedCustomerFilter !== "ALL") count++
    if (selectedStatusFilter !== "ALL") count++
    if (commitmentDateFilter) count++
    if (searchQuery) count++
    count += Object.values(columnFilters).filter(v => v && v.trim()).length
    return count
  }, [selectedOilFilter, selectedCustomerFilter, selectedStatusFilter, commitmentDateFilter, searchQuery, columnFilters])

  const clearAllFilters = () => {
    patchListView({
      selectedOilFilter: "ALL",
      selectedCustomerFilter: "ALL",
      selectedStatusFilter: "ALL",
      commitmentDateFilter: "",
      dateFromFilter: "",
      dateToFilter: "",
      searchQuery: "",
      columnFilters: {},
      pendingSortField: "",
      pendingSortDir: "asc",
    })
  }

  // Filter pendingList by top filter buttons & per-column search inputs
  const filteredPendingList = useMemo(() => {
    if (!pendingList || pendingList.length === 0) return []
    return pendingList.filter((row: any) => {
      // 1. Top Oil Type Filter
      if (selectedOilFilter && selectedOilFilter !== "ALL") {
        if (String(row.oil_type || "").toLowerCase() !== selectedOilFilter.toLowerCase()) {
          return false
        }
      }
      // 2. Top Customer Filter
      if (selectedCustomerFilter && selectedCustomerFilter !== "ALL") {
        if (String(row.party_name || "").toLowerCase() !== selectedCustomerFilter.toLowerCase()) {
          return false
        }
      }
      // 3. Top Status Filter
      if (selectedStatusFilter === "PENDING") {
        if (Number(row.po_pending_qty || 0) <= 0) return false
      } else if (selectedStatusFilter === "COMPLETED") {
        if (Number(row.po_pending_qty || 0) > 0) return false
      }
      // 4. Date Range Filter
      if (dateFromFilter) {
        if (!row.commitment_date) return false
        const d = new Date(row.commitment_date)
        if (!isNaN(d.getTime())) {
          const rowDate = d.toISOString().split('T')[0]
          if (rowDate < dateFromFilter) return false
        }
      }
      if (dateToFilter) {
        if (!row.commitment_date) return false
        const d = new Date(row.commitment_date)
        if (!isNaN(d.getTime())) {
          const rowDate = d.toISOString().split('T')[0]
          if (rowDate > dateToFilter) return false
        }
      }
      // 5. Per-column filters
      return Object.entries(columnFilters).every(([colId, filterVal]) => {
        if (!filterVal || !filterVal.trim()) return true
        const search = filterVal.toLowerCase().trim()
        let cellVal = ""
        switch (colId) {
          case "commitment_no": cellVal = String(row.commitment_no ?? ""); break
          case "commitment_date": cellVal = row.commitment_date ? new Date(row.commitment_date).toLocaleDateString("en-GB") : ""; break
          case "party_name": cellVal = String(row.party_name ?? ""); break
          case "dispatch_from": cellVal = String(row.depot_name || "Banari"); break
          case "oil_type": cellVal = String(row.oil_type ?? ""); break
          case "rate": cellVal = String(row.rate ?? ""); break
          case "quantity": cellVal = String(row.quantity ?? ""); break
          case "processed_qty": cellVal = String(row.processed_qty ?? ""); break
          case "delivery_qty": cellVal = String(row.delivery_qty ?? ""); break
          case "po_pending_qty": cellVal = String(row.po_pending_qty ?? ""); break
          case "remaining_qty": cellVal = String(row.remaining_qty ?? row.quantity ?? ""); break
          default: cellVal = String(row[colId] ?? "")
        }
        return cellVal.toLowerCase().includes(search)
      })
    })
  }, [pendingList, columnFilters, selectedOilFilter, selectedCustomerFilter, selectedStatusFilter, dateFromFilter, dateToFilter])

  // Sorts filteredPendingList by selected sort field
  const sortedPendingList = useMemo(() => {
    if (!pendingSortField || !filteredPendingList || filteredPendingList.length === 0) return filteredPendingList
    return [...filteredPendingList].sort((a: any, b: any) => {
      const aVal = String(a[pendingSortField] ?? "").toLowerCase()
      const bVal = String(b[pendingSortField] ?? "").toLowerCase()
      if (aVal < bVal) return pendingSortDir === "asc" ? -1 : 1
      if (aVal > bVal) return pendingSortDir === "asc" ? 1 : -1
      return 0
    })
  }, [filteredPendingList, pendingSortField, pendingSortDir])

  // Compute per-column totals for MT metrics
  const columnTotals = useMemo(() => {
    return sortedPendingList.reduce(
      (acc, r) => {
        acc.quantity += Number(r.quantity || 0)
        acc.processed_qty += Number(r.processed_qty || 0)
        acc.delivery_qty += Number(r.delivery_qty || 0)
        acc.po_pending_qty += Number(r.po_pending_qty || 0)
        acc.remaining_qty += Number(r.remaining_qty ?? r.quantity ?? 0)
        return acc
      },
      { quantity: 0, processed_qty: 0, delivery_qty: 0, po_pending_qty: 0, remaining_qty: 0 }
    )
  }, [sortedPendingList])

  const [visibleColumns, setVisibleColumns] = usePersistedColumns("commitment-punch", PAGE_COLUMNS.map(c => c.id))
  const [columnOrder, setColumnOrder] = useColumnOrder("commitment-punch", PAGE_COLUMNS.map(c => c.id))
  const orderedVisibleCols = useMemo(() =>
    columnOrder
      .map(id => PAGE_COLUMNS.find(c => c.id === id))
      .filter((c): c is typeof PAGE_COLUMNS[number] => !!c && visibleColumns.includes(c.id as ColId)),
    [columnOrder, visibleColumns]
  )
  const handleColumnReorder = useCallback((newVisibleOrder: string[]) => {
    const hiddenCols = columnOrder.filter(id => !visibleColumns.includes(id as ColId))
    setColumnOrder([...newVisibleOrder, ...hiddenCols])
  }, [columnOrder, visibleColumns, setColumnOrder])

  // Sort-field mapping: column id → pending sort key
  const COL_SORT_FIELD: Partial<Record<ColId, string>> = {
    commitment_no: "commitment_no",
    commitment_date: "date",
    party_name: "customer_name",
    oil_type: "oil_type",
    rate: "rate",
    quantity: "qty",
  }
  const RIGHT_ALIGN_COLS: ColId[] = ["commitment_date", "rate", "quantity", "processed_qty", "delivery_qty", "po_pending_qty", "remaining_qty"]
  const CENTER_ALIGN_COLS: ColId[] = []
  const COL_WIDTHS: Record<ColId, string> = {
    commitment_no: "min-w-[140px] w-[140px]",
    commitment_date: "min-w-[115px] w-[115px]",
    party_name: "min-w-[240px]",
    dispatch_from: "min-w-[190px] w-[190px]",
    oil_type: "min-w-[110px] w-[110px]",
    rate: "min-w-[135px] w-[135px]",
    quantity: "min-w-[120px] w-[120px]",
    processed_qty: "min-w-[120px] w-[120px]",
    delivery_qty: "min-w-[130px] w-[130px]",
    po_pending_qty: "min-w-[145px] w-[145px]",
    remaining_qty: "min-w-[180px] w-[180px]",
  }

  const renderCell = (row: PendingCommitment, colId: ColId) => {
    const widthClass = COL_WIDTHS[colId] || ""
    const isCenter = CENTER_ALIGN_COLS.includes(colId)
    const isRight = RIGHT_ALIGN_COLS.includes(colId)
    const alignClass = isCenter ? "text-center" : isRight ? "text-right px-4 tabular-nums" : "px-4"

    switch (colId) {
      case "commitment_no":
        return <TableCell key={colId} className={cn("font-mono font-semibold text-blue-700", alignClass, widthClass)}>{row.commitment_no}</TableCell>
      case "commitment_date":
        return <TableCell key={colId} className={cn(alignClass, widthClass)}>{row.commitment_date ? new Date(row.commitment_date).toLocaleDateString("en-GB") : "—"}</TableCell>
      case "party_name":
        return <TableCell key={colId} className={cn("font-medium", alignClass, widthClass)}>{row.party_name}</TableCell>
      case "dispatch_from":
        return <TableCell key={colId} className={cn(alignClass, widthClass)}>{row.depot_name || "Banari"}</TableCell>
      case "oil_type":
        return <TableCell key={colId} className={cn(alignClass, widthClass)}><Badge variant="outline" className="text-xs">{row.oil_type || "—"}</Badge></TableCell>
      case "rate":
        return <TableCell key={colId} className={cn("font-mono", alignClass, widthClass)}>{row.rate != null ? fmtAmount(row.rate, 4) : "—"}</TableCell>
      case "quantity":
        return <TableCell key={colId} className={cn("font-mono", alignClass, widthClass)}>{row.quantity != null ? fmtNum(row.quantity) : "—"}</TableCell>
      case "processed_qty":
        return (
          <TableCell key={colId} className={cn("font-mono text-blue-600 font-semibold", alignClass, widthClass)}>
            {Number(row.processed_qty || 0) > 0 ? (
              <button onClick={(e) => openDetails(row, e, "raised")} className="text-blue-600 underline hover:text-blue-800 font-semibold font-mono cursor-pointer bg-transparent border-none p-0">
                {fmtNum(row.processed_qty || 0)}
              </button>
            ) : (
              <span className="text-slate-400">0.0000</span>
            )}
          </TableCell>
        )
      case "delivery_qty":
        return (
          <TableCell key={colId} className={cn("font-mono text-purple-600 font-semibold", alignClass, widthClass)}>
            {Number(row.delivery_qty || 0) > 0 ? (
              <button onClick={(e) => openDetails(row, e, "delivered")} className="text-purple-600 underline hover:text-purple-800 font-semibold font-mono cursor-pointer bg-transparent border-none p-0">
                {fmtNum(row.delivery_qty || 0)}
              </button>
            ) : (
              <span className="text-slate-400">0.0000</span>
            )}
          </TableCell>
        )
      case "po_pending_qty":
        return (
          <TableCell key={colId} className={cn("font-mono text-amber-600 font-semibold", alignClass, widthClass)}>
            {Number(row.po_pending_qty || 0) > 0 ? (
              <button onClick={(e) => openDetails(row, e, "pending")} className="text-amber-600 underline hover:text-amber-800 font-semibold font-mono cursor-pointer bg-transparent border-none p-0">
                {fmtNum(row.po_pending_qty || 0)}
              </button>
            ) : (
              <span className="text-slate-400">0.0000</span>
            )}
          </TableCell>
        )
      case "remaining_qty":
        return <TableCell key={colId} className={cn("font-mono text-emerald-600 font-bold", alignClass, widthClass)}>{fmtNum(row.remaining_qty ?? row.quantity)}</TableCell>
      default:
        return null
    }
  }

  return (
    <div className="p-3 sm:px-6 sm:py-3 max-w-full space-y-2 sm:space-y-3" suppressHydrationWarning>

      {/* ── Page Header (title + filters + actions in one row) ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 min-w-0 shrink-0">
          <SidebarTrigger className="-ml-1" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Stage 0: Commitment Punch</h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                {sortedPendingList.length} of {pendingList.length}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">Manage and process customer oil commitments.</p>
          </div>
        </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center shrink-0">
          <Button variant="outline" size="sm" onClick={loadPending} disabled={isLoadingPending} title="Refresh" aria-label="Refresh" className="w-full sm:w-9 sm:px-0">
            <RefreshCw className={`h-4 w-4 ${isLoadingPending ? "animate-spin" : ""}`} />
            <span className="sm:hidden ml-1">Refresh</span>
          </Button>
          <Button
            className="w-full gap-2 bg-blue-600 hover:bg-blue-700 sm:w-auto"
            onClick={() => { resetAddForm(); setIsAddOpen(true) }}
          >
            <Plus className="h-4 w-4" />
            <span className="truncate">Add Commitment</span>
          </Button>
        </div>
      </div>

      {/* ── Pending Commitments Table ── */}
      <Card className="border border-slate-200/80 shadow-xs overflow-clip py-0 gap-0 min-h-[60vh] stage-card">
        <StageListHeader
          title="Commitments List"
          shown={sortedPendingList.length}
          total={pendingList.length}
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search PO, Customer, Oil..."
        >
          <StageToolbar
            shown={sortedPendingList.length}
            total={pendingList.length}
            activeCount={activeFiltersCount}
            onReset={clearAllFilters}
            filters={
              <>
                <StageSegmented
                  value={selectedStatusFilter}
                  onChange={setSelectedStatusFilter}
                  options={[
                    { value: "PENDING", label: "PO Pending" },
                    { value: "COMPLETED", label: "Fully Raised" },
                    { value: "ALL", label: "All" },
                  ]}
                />
                <StageDivider />
                <StageFilterSelect value={selectedOilFilter} onChange={setSelectedOilFilter} allLabel="All Oils" options={uniqueOilTypes} />
                <StageFilterSelect value={selectedCustomerFilter} onChange={setSelectedCustomerFilter} allLabel="All Customers" options={uniqueCustomers} />
                <StageColumnsMenu
                  columns={[...PAGE_COLUMNS]}
                  visibleColumns={visibleColumns}
                  setVisibleColumns={setVisibleColumns}
                  show={isAdmin || isFeatureEnabled("can_toggle_columns")}
                />
              </>
            }
          />
          <StageActiveChips
            chips={[
              ...(selectedStatusFilter !== "ALL" ? [{ label: `Status: ${selectedStatusFilter === "PENDING" ? "PO Pending" : "Fully Raised"}`, onClear: () => setSelectedStatusFilter("ALL") }] : []),
              ...(selectedOilFilter !== "ALL" ? [{ label: `Oil: ${selectedOilFilter}`, onClear: () => setSelectedOilFilter("ALL") }] : []),
              ...(selectedCustomerFilter !== "ALL" ? [{ label: `Customer: ${selectedCustomerFilter}`, onClear: () => setSelectedCustomerFilter("ALL") }] : []),
              ...(commitmentDateFilter ? [{ label: `Comm Date: ${commitmentDateFilter}`, onClear: () => setCommitmentDateFilter("") }] : []),
              ...(dateFromFilter ? [{ label: `From: ${dateFromFilter}`, onClear: () => setDateFromFilter("") }] : []),
              ...(dateToFilter ? [{ label: `To: ${dateToFilter}`, onClear: () => setDateToFilter("") }] : []),
            ]}
          />
        </StageListHeader>
        <CardContent className="p-0">
          <div className="hidden overflow-x-auto rounded-b-xl md:block">
            <Table>
              <TableHeader className="bg-slate-50/70 border-b border-slate-200">
                <TableRow>
                  {orderedVisibleCols.map(col => {
                    const isRight = RIGHT_ALIGN_COLS.includes(col.id)
                    const isCenter = CENTER_ALIGN_COLS.includes(col.id)
                    return (
                      <TableHead key={`search-${col.id}`} className={`whitespace-nowrap align-top pt-3 pb-1.5 px-4 min-w-[120px] ${COL_WIDTHS[col.id] || ""}${isRight ? " text-right" : isCenter ? " text-center" : ""}`}>
                            <div onClick={(e) => e.stopPropagation()} className="w-full mb-0.5">
                              {col.id === "commitment_date" ? (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button className="flex items-center justify-between w-full h-7 px-2.5 text-[10px] text-slate-500 bg-white hover:bg-slate-50 border border-slate-200/70 hover:border-slate-300 rounded-md transition-all shadow-2xs">
                                      <span className="truncate font-medium">{dateFromFilter || dateToFilter ? "Filtered" : "Filter..."}</span>
                                      <CalendarIconLucide className="h-3 w-3 opacity-60 ml-1 shrink-0" />
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-48 p-3" align="start">
                                    <div className="flex flex-col gap-3">
                                      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                                        <Label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Date Range</Label>
                                        {(dateFromFilter || dateToFilter) && (
                                          <button
                                            onClick={() => { setDateFromFilter(""); setDateToFilter("") }}
                                            className="text-[10px] text-red-600 hover:underline font-semibold"
                                          >
                                            Clear
                                          </button>
                                        )}
                                      </div>
                                      <div className="space-y-1.5">
                                        <Label className="text-[10px] font-medium text-slate-500">From</Label>
                                        <Input
                                          type="date"
                                          value={dateFromFilter}
                                          onChange={(e) => setDateFromFilter(e.target.value)}
                                          className="h-8 text-xs bg-slate-50 border-slate-200 shadow-none focus-visible:ring-blue-400"
                                        />
                                      </div>
                                      <div className="space-y-1.5">
                                        <Label className="text-[10px] font-medium text-slate-500">To</Label>
                                        <Input
                                          type="date"
                                          value={dateToFilter}
                                          onChange={(e) => setDateToFilter(e.target.value)}
                                          className="h-8 text-xs bg-slate-50 border-slate-200 shadow-none focus-visible:ring-blue-400"
                                        />
                                      </div>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              ) : (
                                <Input
                                  placeholder="Search..."
                                  value={columnFilters[col.id] || ""}
                                  onChange={(e) => handleColumnFilterChange(col.id, e.target.value)}
                                  className={cn(
                                    "h-7 text-[10px] w-full px-2.5 py-0 bg-white hover:bg-slate-50 focus:bg-white border-slate-200/70 focus:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-100/50 shadow-2xs rounded-md transition-all placeholder:text-slate-400/80 font-medium text-slate-700",
                                    "text-left"
                                  )}
                                />
                              )}
                            </div>
                      </TableHead>
                    )
                  })}
                  <TableHead className="w-10 px-2 pt-2.5 pb-1"></TableHead>
                </TableRow>
                {/* ── Per-Column Totals ── */}
                {sortedPendingList.length > 0 && (
                  <TableRow className="bg-blue-50/60 border-y border-blue-100 font-bold text-xs text-slate-800 hover:bg-blue-50/60 z-10">
                    {orderedVisibleCols.map(col => {
                      const isCenter = CENTER_ALIGN_COLS.includes(col.id)
                      const isRight = RIGHT_ALIGN_COLS.includes(col.id)
                      const alignClass = isCenter ? "text-center" : isRight ? "text-right px-4 tabular-nums" : "px-4"

                      switch (col.id) {
                        case "commitment_no":
                          return (
                            <TableCell key={`total-${col.id}`} className={cn("font-black text-slate-900 uppercase tracking-wider text-[11px]", alignClass)}>
                              Total ({sortedPendingList.length})
                            </TableCell>
                          )
                        case "quantity":
                          return (
                            <TableCell key={`total-${col.id}`} className={cn("font-mono font-black text-slate-900", alignClass)}>
                              {fmtNum(columnTotals.quantity)}
                            </TableCell>
                          )
                        case "processed_qty":
                          return (
                            <TableCell key={`total-${col.id}`} className={cn("font-mono font-black text-blue-700", alignClass)}>
                              {fmtNum(columnTotals.processed_qty)}
                            </TableCell>
                          )
                        case "delivery_qty":
                          return (
                            <TableCell key={`total-${col.id}`} className={cn("font-mono font-black text-purple-700", alignClass)}>
                              {fmtNum(columnTotals.delivery_qty)}
                            </TableCell>
                          )
                        case "po_pending_qty":
                          return (
                            <TableCell key={`total-${col.id}`} className={cn("font-mono font-black text-amber-700", alignClass)}>
                              {fmtNum(columnTotals.po_pending_qty)}
                            </TableCell>
                          )
                        case "remaining_qty":
                          return (
                            <TableCell key={`total-${col.id}`} className={cn("font-mono font-black text-emerald-700", alignClass)}>
                              {fmtNum(columnTotals.remaining_qty)}
                            </TableCell>
                          )
                        default:
                          return <TableCell key={`total-${col.id}`} className={cn("text-slate-400 font-normal", alignClass)}></TableCell>
                      }
                    })}
                    <TableCell className="px-2"></TableCell>
                  </TableRow>
                )}
                <TableRow>
                  <ColumnDragProvider columnIds={orderedVisibleCols.map(c => c.id)} onReorder={handleColumnReorder} disabled={!isAdmin && !isFeatureEnabled('can_reorder_columns')}>
                    {orderedVisibleCols.map(col => {
                      const sf = canSortColumns ? COL_SORT_FIELD[col.id] : undefined
                      const isRight = RIGHT_ALIGN_COLS.includes(col.id)
                      const isCenter = CENTER_ALIGN_COLS.includes(col.id)

                      return (
                        <SortableTableHead
                          key={col.id}
                          id={col.id}
                          className={`whitespace-nowrap align-top py-2.5 px-4 group/header ${COL_WIDTHS[col.id] || ""}${isRight ? " text-right" : isCenter ? " text-center" : ""}`}
                        >
                          <div className="flex flex-col gap-1.5 w-full">
                            {/* Column Heading */}
                            <div
                              className={cn(
                                "flex items-center gap-1 cursor-pointer select-none hover:text-blue-600 transition-colors w-full",
                                isCenter ? "justify-center" : isRight ? "justify-end" : "justify-start"
                              )}
                              onClick={sf ? () => handlePendingSort(sf) : undefined}
                            >
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">{col.label}</span>
                              {sf && <PendingSortIcon field={sf} />}
                            </div>
                          </div>
                        </SortableTableHead>
                      )
                    })}
                  </ColumnDragProvider>
                  <TableHead className="w-10 px-2"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingPending ? (
                  [...Array(4)].map((_, i) => (
                    <TableRow key={i} className="opacity-40">
                      {[...Array(orderedVisibleCols.length + 1)].map((__, j) => (
                        <TableCell key={j}><div className="h-4 w-full bg-slate-200 animate-pulse rounded" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : pendingList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={orderedVisibleCols.length + 1} className="text-center py-16 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <CheckCircle2 className="h-10 w-10 text-slate-300" />
                        <p className="font-medium">No pending commitments</p>
                        <p className="text-sm text-slate-400">Click "Add Commitment" to create one.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : sortedPendingList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={orderedVisibleCols.length + 1} className="text-center py-12 text-muted-foreground">
                      <p className="font-medium text-slate-500">No matching records found for column filters</p>
                      <button
                        onClick={() => setColumnFilters({})}
                        className="text-xs text-blue-600 hover:underline mt-1 font-semibold"
                      >
                        Clear Column Filters
                      </button>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedPendingList.map(row => (
                    <TableRow
                      key={row.id}
                      className="even:bg-slate-50/50 hover:bg-blue-50/60 cursor-pointer transition-colors"
                      onClick={() => openProcessForCommitment(row)}
                    >
                      {orderedVisibleCols.map(col => renderCell(row, col.id))}
                      <TableCell className="px-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                          title="Edit planned values"
                          onClick={(e) => openEditCommitment(row, e)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 p-3 md:hidden">
            {isLoadingPending ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="rounded-lg border p-4 space-y-3 opacity-60">
                  <div className="h-4 w-32 bg-slate-200 animate-pulse rounded" />
                  <div className="grid grid-cols-2 gap-3">
                    {[...Array(6)].map((__, j) => (
                      <div key={j} className="h-10 bg-slate-100 animate-pulse rounded" />
                    ))}
                  </div>
                </div>
              ))
            ) : pendingList.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <div className="flex flex-col items-center gap-2">
                  <CheckCircle2 className="h-10 w-10 text-slate-300" />
                  <p className="font-medium">No pending commitments</p>
                  <p className="text-sm text-slate-400">Click "Add Commitment" to create one.</p>
                </div>
              </div>
            ) : (
              pendingList.map(row => (
                <div
                  key={row.id}
                  className="rounded-lg border p-4 transition-colors bg-white hover:bg-slate-50 cursor-pointer"
                  onClick={() => openProcessForCommitment(row)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-bold text-blue-700 break-words">{row.commitment_no}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {row.commitment_date ? new Date(row.commitment_date).toLocaleDateString("en-GB") : "—"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                      title="Edit planned values"
                      onClick={(e) => openEditCommitment(row, e)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="mt-3 space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Customer Name</p>
                    <p className="text-sm font-semibold text-slate-800 break-words">{row.party_name || "—"}</p>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-md bg-slate-50 p-2">
                      <p className="text-[10px] font-bold uppercase text-slate-400">Dispatch from</p>
                      <p className="mt-1 font-semibold">{row.depot_name || "Banari"}</p>
                    </div>
                    <div className="rounded-md bg-slate-50 p-2">
                      <p className="text-[10px] font-bold uppercase text-slate-400">Oil Type</p>
                      <Badge variant="outline" className="mt-1 text-[10px]">{row.oil_type || "—"}</Badge>
                    </div>
                    <div className="rounded-md bg-slate-50 p-2">
                      <p className="text-[10px] font-bold uppercase text-slate-400">Rate (PMT)</p>
                      <p className="mt-1 font-mono font-semibold">{row.rate != null ? fmtAmount(row.rate, 4) : "—"}</p>
                    </div>
                    <div className="rounded-md bg-slate-50 p-2">
                      <p className="text-[10px] font-bold uppercase text-slate-400">Qty (MT)</p>
                      <p className="mt-1 font-mono font-semibold">{row.quantity != null ? fmtNum(row.quantity) : "—"}</p>
                    </div>
                    <div className="rounded-md bg-slate-50 p-2">
                      <p className="text-[10px] font-bold uppercase text-slate-400">PO Raised (MT)</p>
                      {Number(row.processed_qty || 0) > 0 ? (
                        <button
                          onClick={(e) => openDetails(row, e, "raised")}
                          className="mt-1 text-blue-600 underline hover:text-blue-800 font-semibold font-mono bg-transparent border-none p-0"
                        >
                          {fmtNum(row.processed_qty || 0)}
                        </button>
                      ) : (
                        <p className="mt-1 font-mono text-slate-400">0.0000</p>
                      )}
                    </div>
                    <div className="rounded-md bg-slate-50 p-2">
                      <p className="text-[10px] font-bold uppercase text-slate-400">Delivered Qty (MT)</p>
                      {Number(row.delivery_qty || 0) > 0 ? (
                        <button onClick={(e) => openDetails(row, e, "delivered")} className="mt-1 text-purple-600 underline hover:text-purple-800 font-semibold font-mono bg-transparent border-none p-0">
                          {fmtNum(row.delivery_qty || 0)}
                        </button>
                      ) : (
                        <p className="mt-1 font-mono text-slate-400">0.0000</p>
                      )}
                    </div>
                    <div className="rounded-md bg-slate-50 p-2">
                      <p className="text-[10px] font-bold uppercase text-slate-400">PO Pending (MT)</p>
                      {Number(row.po_pending_qty || 0) > 0 ? (
                        <button onClick={(e) => openDetails(row, e, "pending")} className="mt-1 text-amber-600 underline hover:text-amber-800 font-semibold font-mono bg-transparent border-none p-0">
                          {fmtNum(row.po_pending_qty || 0)}
                        </button>
                      ) : (
                        <p className="mt-1 font-mono text-slate-400">0.0000</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 rounded-md bg-emerald-50 p-2">
                    <p className="text-[10px] font-bold uppercase text-emerald-700">Commitment Pending (MT)</p>
                    <p className="mt-1 font-mono text-base font-bold text-emerald-700">{fmtNum(row.remaining_qty ?? row.quantity)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          <StagePagination
            sticky
            page={pendingPage}
            totalPages={pendingTotalPages}
            total={pendingTotal}
            noun="Commitments"
            onPrev={() => setPendingPage(p => Math.max(1, p - 1))}
            onNext={() => setPendingPage(p => p + 1)}
            prevDisabled={pendingPage === 1 || pendingList.length === 0}
            nextDisabled={pendingList.length === 0 || pendingPage >= pendingTotalPages}
          />
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════
          ADD COMMITMENT DIALOG
      ═══════════════════════════════════════════════════════ */}
      <Dialog open={isAddOpen} onOpenChange={open => { setIsAddOpen(open); if (!open) resetAddForm() }}>
        <DialogContent className="w-[95vw] min-h-[580px] max-h-[90vh] overflow-y-auto p-4 sm:p-6" style={{ maxWidth: '1250px' }}>
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? (
                <span className="flex items-center gap-2">
                  <Pencil className="h-4 w-4 text-amber-600" />
                  Edit Commitment
                </span>
              ) : "Add Commitment"}
            </DialogTitle>
            <DialogDescription>
              {isEditMode
                ? "Update planned values for this commitment. Customer, oil type and quantity cannot be changed after creation."
                : "Enter commitment details. A unique Commitment No. will be auto-generated."
              }
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddSubmit} className="space-y-5" suppressHydrationWarning>
            {/* Row 1 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="d-commitmentDate">Commitment Date <span className="text-red-500">*</span></Label>
                <Input id="d-commitmentDate" type="date" value={commitmentDate} onChange={e => setCommitmentDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Customer Name <span className="text-red-500">*</span></Label>
                <AsyncCombobox
                  fetchOptions={fetchCustomerOptions}
                  value={partyName}
                  onValueChange={setPartyName}
                  onSelectOption={(opt: any) => {
                    if (opt?.original) {
                      setCustomerList((prev: any[]) => {
                        const exists = prev.find((c: any) => c.id === opt.original.id)
                        return exists ? prev : [...prev, opt.original]
                      })
                      const c = opt.original
                      setContactPerson(c.contact_person || "")
                      setWhatsappNo(c.contact || "")
                      const fullAddr = formatAddressForPrint(c)
                      setCustomerAddress(fullAddr)
                      setShipToAddress(fullAddr)
                      setAddCustomerId(typeof c.id === "number" ? c.id : null)
                    }
                  }}
                  placeholder="Select customer"
                  searchPlaceholder="Search customer..."
                  disabled={isEditMode}
                  lockedHint="Customer is fixed by the commitment and cannot be changed."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-contactPerson">Contact Person Name</Label>
                <Input id="d-contactPerson" disabled placeholder="Enter contact person" value={contactPerson} onChange={e => setContactPerson(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-whatsapp">WhatsApp No.</Label>
                <Input id="d-whatsapp" disabled placeholder="Enter WhatsApp number" value={whatsappNo} onChange={e => setWhatsappNo(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-address">Bill to</Label>
                <Input id="d-address" disabled placeholder="Enter billing address" value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-shipTo">Ship to</Label>
                {hasMultipleShipTo ? (
                  <Select
                    value={shipToOptions.find(a => formatCustomerAddress(a) === shipToAddress)?.id?.toString() ?? ""}
                    onValueChange={(v) => {
                      const picked = shipToOptions.find(a => String(a.id) === v)
                      if (picked) setShipToAddress(formatCustomerAddress(picked))
                    }}
                  >
                    <SelectTrigger id="d-shipTo"><SelectValue placeholder="Select ship to address" /></SelectTrigger>
                    <SelectContent>
                      {shipToOptions.map(a => (
                        <SelectItem key={String(a.id)} value={String(a.id)}>{a.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input id="d-shipTo" placeholder="Enter shipping address" value={shipToAddress} onChange={e => setShipToAddress(e.target.value)} />
                )}
              </div>
              <div className="space-y-2">
                <Label>Dispatch from <span className="text-red-500">*</span></Label>
                <AsyncCombobox
                  fetchOptions={fetchDepoOptions}
                  value={depotName}
                  onValueChange={setDepotName}
                  placeholder="Select Godown"
                  searchPlaceholder="Search godowns..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="transportType">Transport Type <span className="text-red-500">*</span></Label>
                <Select value={transportType} onValueChange={setTransportType}>
                  <SelectTrigger id="transportType">
                    <SelectValue placeholder="Select transport" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="self">FOR</SelectItem>
                    <SelectItem value="others">Ex</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentTerms">Payment Terms</Label>
                <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                  <SelectTrigger id="paymentTerms">
                    <SelectValue placeholder="Select terms" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="advance">Advance</SelectItem>
                    <SelectItem value="7days">7 Days After Delivery</SelectItem>
                    <SelectItem value="delivery">On Delivery</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Advance Payment to be Taken <span className="text-red-500">*</span></Label>
                <Select value={advancePayment} onValueChange={setAdvancePayment}>
                  <SelectTrigger><SelectValue placeholder="Advance Payment?" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="No">No</SelectItem>
                    <SelectItem value="Yes">Yes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Is this order through <span className="text-red-500">*</span></Label>
                <Select value={orderThrough} onValueChange={setOrderThrough}>
                  <SelectTrigger><SelectValue placeholder="Select channel" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Direct">Direct</SelectItem>
                    <SelectItem value="Broker">Broker</SelectItem>
                    <SelectItem value="Salesperson">Salesperson</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                {orderThrough === "Broker" && (
                  <>
                    <Label>Broker Name <span className="text-red-500">*</span></Label>
                    <AsyncCombobox
                      fetchOptions={fetchBrokerOptions}
                      value={brokerName}
                      onValueChange={setBrokerName}
                      placeholder="Select Broker"
                      searchPlaceholder="Search brokers..."
                    />
                  </>
                )}
                {orderThrough === "Salesperson" && (
                  <>
                    <Label>Salesperson Name <span className="text-red-500">*</span></Label>
                    <AsyncCombobox
                      fetchOptions={fetchSalespersonOptions}
                      value={salespersonName}
                      onValueChange={setSalespersonName}
                      placeholder="Select Salesperson"
                      searchPlaceholder="Search salesperson..."
                    />
                  </>
                )}
                {orderThrough === "Direct" && null}
              </div>
              <div className="space-y-2">
                <Label>Upload Commitment PDF{!isEditMode && <span className="text-red-500"> *</span>}</Label>
                <FileUploadField
                  label=""
                  accept=".pdf"
                  fileName={pdfFile?.name || ""}
                  helperText="Max file size: 20 MB"
                  buttonText="Select PDF"
                  onFilesSelected={(files) => {
                    if (files[0]) {
                      setPdfFile(files[0])
                    }
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-remarks">Remarks</Label>
                <Input id="d-remarks" placeholder="Enter optional remarks" value={remarks} onChange={e => setRemarks(e.target.value)} />
              </div>
            </div>

            {/* Product rows */}
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Label className="text-base font-semibold flex items-center gap-1.5">
                  Oil / Product Details
                  {isEditMode && <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500" title="Oil type, quantity and rate are fixed after creation."><Lock className="h-3.5 w-3.5" /> Fixed after creation</span>}
                </Label>
                {!isEditMode && (
                  <Button type="button" variant="outline" size="sm" onClick={addRow} className="w-full gap-1 sm:w-auto">
                    <Plus className="h-3 w-3" /> Add Row
                  </Button>
                )}
              </div>

              <div className="hidden rounded-lg border overflow-hidden sm:block">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="w-8 text-center py-2 px-2 font-medium text-slate-600">#</th>
                      <th className="py-2 px-3 text-left font-medium text-slate-600">Oil Type *</th>
                      <th className="py-2 px-3 text-left font-medium text-slate-600">Quantity *</th>
                      <th className="py-2 px-3 text-left font-medium text-slate-600">Unit</th>
                      <th className="py-2 px-3 text-left font-medium text-slate-600">Rate (PMT) *</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr key={row.id} className="border-b last:border-0">
                        <td className="text-center py-2 px-2 text-xs font-bold text-slate-400">{String.fromCharCode(65 + idx)}</td>
                        <td className="py-1.5 px-2">
                          <Select value={row.oil_type} onValueChange={v => updateRow(row.id, "oil_type", v)} disabled={isEditMode}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select oil" /></SelectTrigger>
                            <SelectContent>
                              {OIL_TYPES.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-1.5 px-2">
                          <Input type="number" min="0" step="0.0001" value={row.quantity} onChange={e => updateRow(row.id, "quantity", e.target.value)} placeholder="0.0000" className="h-8 text-sm" disabled={isEditMode} />
                        </td>
                        <td className="py-1.5 px-2">
                          <Input type="text" disabled value={row.unit} placeholder="e.g. Ltr" className="h-8 text-sm" />
                        </td>
                        <td className="py-1.5 px-2">
                          <Input type="number" min="0" step="0.01" value={row.rate} onChange={e => updateRow(row.id, "rate", e.target.value)} placeholder="₹ 0.00" className="h-8 text-sm" disabled={isEditMode} />
                        </td>
                        <td className="py-1.5 px-2 text-center">
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => removeRow(row.id)} disabled={rows.length === 1}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 sm:hidden">
                {rows.map((row, idx) => (
                  <div key={row.id} className="rounded-lg border p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Row {String.fromCharCode(65 + idx)}</p>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => removeRow(row.id)} disabled={rows.length === 1}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <Label>Oil Type *</Label>
                      <Select value={row.oil_type} onValueChange={v => updateRow(row.id, "oil_type", v)} disabled={isEditMode}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Select oil" /></SelectTrigger>
                        <SelectContent>
                          {OIL_TYPES.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="space-y-2">
                        <Label>Quantity *</Label>
                        <Input type="number" min="0" step="0.0001" value={row.quantity} onChange={e => updateRow(row.id, "quantity", e.target.value)} placeholder="0.0000" disabled={isEditMode} />
                      </div>
                      <div className="space-y-2">
                        <Label>Unit</Label>
                        <Input type="text" disabled value={row.unit} placeholder="e.g. Ltr" />
                      </div>
                      <div className="space-y-2">
                        <Label>Rate (PMT) *</Label>
                        <Input type="number" min="0" step="0.01" value={row.rate} onChange={e => updateRow(row.id, "rate", e.target.value)} placeholder="₹ 0.00" disabled={isEditMode} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)} disabled={isSubmitting} className="w-full sm:w-auto">Cancel</Button>
              <Button type="submit" disabled={isSubmitting} className="w-full gap-2 bg-blue-600 hover:bg-blue-700 min-w-[140px] sm:w-auto">
                <Save className="h-4 w-4" />
                {isSubmitting ? (isEditMode ? "Saving..." : "Saving...") : (isEditMode ? "Save Changes" : "Save Commitment")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════
          PROCESS DIALOG
      ═══════════════════════════════════════════════════════ */}
      <Dialog open={isProcessOpen} onOpenChange={open => { setIsProcessOpen(open); if (!open) resetProcess() }}>
        <DialogContent className="w-[95vw] min-h-[580px] max-h-[90vh] overflow-y-auto p-4 sm:p-6" style={{ maxWidth: '1250px' }}>
          <DialogHeader>
            <DialogTitle>
              Process Commitment
              {processSelectedCommitment && (
                <span className="ml-2 font-mono text-sm font-normal text-slate-500">
                  {processSelectedCommitment.commitment_no} — {processSelectedCommitment.party_name}
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              Processing {selectedIds.size} commitment{selectedIds.size !== 1 ? "s" : ""}. Fill PO details and SKU allocation.
            </DialogDescription>
          </DialogHeader>

          {/* —— Planned Values Panel —— */}
          {processSelectedCommitment && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3 text-xs">
              <p className="flex items-center gap-1.5 font-bold text-amber-800 mb-2">
                <ClipboardList className="h-3.5 w-3.5" />
                Commitment Planned Values — for reference
              </p>
              <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-amber-900">
                <span><span className="font-semibold">Order Through:</span> {processSelectedCommitment.order_through || '—'}</span>
                <span><span className="font-semibold">Payment Terms:</span> {formatPaymentTerms(processSelectedCommitment.payment_terms)}</span>
                <span><span className="font-semibold">Transport:</span> {processSelectedCommitment.transport_type === 'others' ? 'Ex-Depot' : processSelectedCommitment.transport_type === 'self' ? 'FOR' : (processSelectedCommitment.transport_type || '—')}</span>
                <span><span className="font-semibold">Depot:</span> {processSelectedCommitment.depot_name || '—'}</span>
                {processSelectedCommitment.broker_name && <span><span className="font-semibold">Broker:</span> {processSelectedCommitment.broker_name}</span>}
                {processSelectedCommitment.salesperson_name && <span><span className="font-semibold">Salesperson:</span> {processSelectedCommitment.salesperson_name}</span>}
                <span><span className="font-semibold">Advance:</span> {processSelectedCommitment.advance_payment_to_be_taken ? 'Yes' : 'No'}</span>
              </div>
            </div>
          )}

          <div className="space-y-7 py-2">

            {/* ── Selected Commitment Info ── */}
            {Array.from(selectedIds).map(id => {
              const c = pendingList.find(p => p.id === id)
              if (!c) return null
              const totalReqMt = skuRows.reduce((sum, r) => sum + (r.mt || 0), 0)
              const isOverLimit = totalReqMt > (c.remaining_qty ?? c.quantity) + 0.0001

              return (
                <div key={id} className={`rounded-lg border transition-all px-5 py-4 grid grid-cols-1 gap-3 text-sm sm:flex sm:flex-wrap sm:gap-10 ${isOverLimit ? "border-red-200 bg-red-50" : "border-blue-100 bg-blue-50/60"}`}>
                  <div>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Company Name</p>
                    <p className="font-semibold text-slate-800 mt-1.5">{c.party_name || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">DO Date</p>
                    <p className="font-semibold text-slate-800 mt-1.5">{c.commitment_date ? new Date(c.commitment_date).toLocaleDateString("en-GB") : "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Oil Type</p>
                    <p className="font-semibold text-slate-800 mt-1.5">{c.oil_type || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Total Qty (MT)</p>
                    <p className="font-semibold text-slate-800 mt-1.5">{c.quantity ?? "—"} {c.unit || ""}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Remaining Balance</p>
                    <p className={`font-semibold mt-1.5 ${isOverLimit ? "text-red-600" : "text-emerald-700"}`}>
                      {Number(c.remaining_qty ?? c.quantity).toFixed(4)} MT
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Requested Total</p>
                    <p className={`font-bold mt-1.5 ${isOverLimit ? "text-red-700" : "text-blue-700"}`}>
                      {totalReqMt.toFixed(4)} MT
                    </p>
                  </div>
                </div>
              )
            })}

            {/* ── Order Submission Details ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-b pb-6">
              {/* Order Type is Through (is_order_through) */}
              <div className="space-y-3">
                <Label htmlFor="p-orderTypeThrough">Order Type is Through <span className="text-red-500">*</span></Label>
                <Select value={processOrderTypeThrough} onValueChange={(val) => {
                  setProcessOrderTypeThrough(val)
                  setBrokerName("")
                  setSalespersonName("")
                }}>
                  <SelectTrigger id="p-orderTypeThrough"><SelectValue placeholder="Select order type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="direct">Direct</SelectItem>
                    <SelectItem value="broker">Broker</SelectItem>
                    <SelectItem value="salesperson">Salesperson</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Order Type: Regular / Pre-Approval */}
              <div className="space-y-3">
                <Label htmlFor="p-orderType">Order Type</Label>
                <Select value={processOrderType} onValueChange={setProcessOrderType}>
                  <SelectTrigger id="p-orderType"><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular">Regular</SelectItem>
                    <SelectItem value="pre-approval">Pre-Approval</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label htmlFor="p-transportType">
                  Transport Type <span className="text-red-500">*</span>
                  {processSelectedCommitment && processTransportType && processSelectedCommitment.transport_type &&
                    processTransportType.toLowerCase() !== processSelectedCommitment.transport_type.toLowerCase() && (
                      <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                        <AlertTriangle className="h-3 w-3" /> Different from planned
                      </span>
                    )}
                </Label>
                <Select value={processTransportType} onValueChange={setProcessTransportType}>
                  <SelectTrigger id="p-transportType"><SelectValue placeholder="Select transport type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="self">FOR</SelectItem>
                    <SelectItem value="others">Ex-Depot</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Conditional Broker / Salesperson */}
              {processOrderTypeThrough === "broker" && (
                <div className="space-y-2 col-span-full">
                  <Label>Broker Name <span className="text-red-500">*</span></Label>
                  <AsyncCombobox fetchOptions={fetchBrokerOptions} value={brokerName} onValueChange={setBrokerName} placeholder="Select broker" searchPlaceholder="Search broker..." />
                </div>
              )}
              {processOrderTypeThrough === "salesperson" && (
                <div className="space-y-2 col-span-full">
                  <Label>Salesperson <span className="text-red-500">*</span></Label>
                  <AsyncCombobox fetchOptions={fetchSalespersonOptions} value={salespersonName} onValueChange={setSalespersonName} placeholder="Select salesperson" searchPlaceholder="Search salesperson..." />
                </div>
              )}

              {/* Delivery Purpose & Depot */}
              <div className="space-y-3">
                <Label>Delivery Purpose</Label>
                <Select value={processDeliveryPurpose} onValueChange={setProcessDeliveryPurpose}>
                  <SelectTrigger><SelectValue placeholder="Select purpose" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week-on-week">Week On Week</SelectItem>
                    <SelectItem value="future-period">Future Period</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {processDeliveryPurpose === "future-period" && (
                <div className="space-y-2">
                  <Label>Future Period Date</Label>
                  <Popover open={isFuturePeriodDatePickerOpen} onOpenChange={setIsFuturePeriodDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !processFuturePeriodDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {processFuturePeriodDate
                          ? format(new Date(processFuturePeriodDate), "dd-MM-yyyy")
                          : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={processFuturePeriodDate ? new Date(processFuturePeriodDate) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            setProcessFuturePeriodDate(format(date, "yyyy-MM-dd"))
                            setIsFuturePeriodDatePickerOpen(false)
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <p className="text-[10px] text-blue-600 font-medium">ℹ️ Date for future delivery scheduling</p>
                </div>
              )}
              <div className="space-y-3">
                <Label>Depo Name (Dispatch From)</Label>
                <AsyncCombobox fetchOptions={fetchDepoOptions} value={processDepoName} onValueChange={setProcessDepoName} placeholder="Select Depo" searchPlaceholder="Search depots..." />
              </div>

              {/* Customer Name Override at PO raise */}
              <div className="space-y-3 col-span-full">
                <Label>Customer Name</Label>
                {/* Locked: the customer is fixed by the commitment and cannot be changed while processing it. */}
                <AsyncCombobox
                  fetchOptions={fetchCustomerOptions}
                  value={processCustomerName}
                  onValueChange={setProcessCustomerName}
                  placeholder="Select Customer (filtered by commitment required)"
                  searchPlaceholder="Search Customer Name, City, State, GST, Mobile..."
                  disabled
                  lockedHint="Customer is fixed by the commitment and cannot be changed."
                />
              </div>

              {/* Start Date / End Date */}
              <div className="space-y-3">
                <Label htmlFor="p-startDate">Start Date</Label>
                <Input
                  id="p-startDate"
                  type="date"
                  value={processStartDate}
                  onChange={e => {
                    const val = e.target.value
                    setProcessStartDate(val)
                    setProcessDeliveryDateError("")
                    if (val) {
                      const d = new Date(`${val}T00:00:00`)
                      d.setDate(d.getDate() + 7)
                      setProcessEndDate(localISO(d))
                    } else {
                      setProcessEndDate("")
                    }
                  }}
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="p-endDate">End Date</Label>
                <Input
                  id="p-endDate"
                  type="date"
                  value={processEndDate}
                  readOnly
                  className="bg-muted cursor-not-allowed"
                />
              </div>

              {/* Expected Delivery Date - Calendar with in-range highlight */}
              <div className="space-y-3">
                <Label>Expected Delivery Date</Label>
                <Popover open={isActualDeliveryPickerOpen} onOpenChange={setIsActualDeliveryPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !processActualDeliveryDate && "text-muted-foreground",
                        processDeliveryDateError && "border-red-500"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {processActualDeliveryDate
                        ? format(new Date(processActualDeliveryDate), "dd-MM-yyyy")
                        : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={processActualDeliveryDate ? new Date(processActualDeliveryDate) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          const val = format(date, "yyyy-MM-dd")
                          setProcessActualDeliveryDate(val)
                          setIsActualDeliveryPickerOpen(false)
                          // Validate within start-end range
                          if (processStartDate && processEndDate) {
                            const d = new Date(val)
                            const start = new Date(processStartDate)
                            const end = new Date(processEndDate)
                            if (d < start || d > end) {
                              setProcessDeliveryDateError(`Date must be between ${processStartDate} and ${processEndDate}`)
                            } else {
                              setProcessDeliveryDateError("")
                            }
                          } else {
                            setProcessDeliveryDateError("")
                          }
                        }
                      }}
                      initialFocus
                      modifiers={{
                        inRange: (date) => {
                          if (!processStartDate || !processEndDate) return false
                          const start = new Date(processStartDate)
                          const end = new Date(processEndDate)
                          return date >= start && date <= end
                        }
                      }}
                      modifiersClassNames={{
                        inRange: "bg-blue-100 text-blue-900 hover:bg-blue-200"
                      }}
                    />
                  </PopoverContent>
                </Popover>
                {processDeliveryDateError && (
                  <p className="text-xs text-red-600 font-medium">{processDeliveryDateError}</p>
                )}
              </div>

              {/* Advance Payment & Payment Terms */}
              <div className="space-y-3">
                <Label>Advance Payment to Be Taken</Label>
                <Select value={processAdvancePaymentTaken} onValueChange={setProcessAdvancePaymentTaken}>
                  <SelectTrigger><SelectValue placeholder="Select YES/NO" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NO">NO</SelectItem>
                    <SelectItem value="YES">YES</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                {processAdvancePaymentTaken === "YES" ? (
                  <>
                    <Label>Advance Amount (₹)</Label>
                    <Input type="number" value={processAdvancePayment} onChange={e => setProcessAdvancePayment(e.target.value)} placeholder="0.00" />
                  </>
                ) : (
                  <div className="opacity-50 pointer-events-none">
                    <Label>Advance Amount (₹)</Label>
                    <Input disabled placeholder="0.00" />
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <Label>
                  Payment Terms
                  {processSelectedCommitment && processPaymentTerms && processSelectedCommitment.payment_terms &&
                    processPaymentTerms.toLowerCase() !== processSelectedCommitment.payment_terms.toLowerCase() && (
                      <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                        <AlertTriangle className="h-3 w-3" /> Different from planned
                      </span>
                    )}
                </Label>
                <Select value={processPaymentTerms} onValueChange={setProcessPaymentTerms}>
                  <SelectTrigger><SelectValue placeholder="Select terms" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="advance">Advance</SelectItem>
                    <SelectItem value="7days">7 Days After Delivery</SelectItem>
                    <SelectItem value="delivery">On Delivery</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Order Category</Label>
                <Select value={processOrderCategory} onValueChange={setProcessOrderCategory}>
                  <SelectTrigger><SelectValue placeholder="Select Category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sales">Sales</SelectItem>
                    <SelectItem value="Stock Transfer">Stock Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Upload SO Copy */}
              <div className="space-y-3">
                <FileUploadField
                  label="Upload SO Copy"
                  accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
                  fileName={processUploadCopy?.name || ""}
                  helperText="Max file size: 20 MB"
                  buttonText="Select SO Copy"
                  onFilesSelected={(files) => setProcessUploadCopy(files[0] || null)}
                />
              </div>

              {/* Remarks */}
              <div className="space-y-3 sm:col-span-2">
                <Label htmlFor="p-remarks">Remarks</Label>
                <Input id="p-remarks" placeholder="Enter any remarks..." value={processRemarks} onChange={e => setProcessRemarks(e.target.value)} />
              </div>
            </div>

            {/* ── PO Details ── */}
            <div className="space-y-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b pb-2">PO Details</p>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="space-y-3">
                  <Label htmlFor="po_no">PO No. <span className="text-red-500">*</span></Label>
                  <Input
                    id="po_no"
                    value={processPoNo}
                    onChange={e => setProcessPoNo(e.target.value)}
                    placeholder="Enter PO number"
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="po_date">PO Date <span className="text-red-500">*</span></Label>
                  <Input
                    id="po_date"
                    type="date"
                    value={processPoDate}
                    onChange={e => setProcessPoDate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* ── SKU Rows ── */}
            <div className="space-y-3">
              <div className="flex flex-col gap-2 border-b pb-2 sm:flex-row sm:items-center sm:justify-between sm:pb-1">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">SKU Details</p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSkuRows([{ id: "1", sku: "", qty: "", rate: "", mt: 0 }])}
                    className="h-7 text-xs text-slate-500 hover:text-red-600 hover:bg-red-50 gap-1"
                    title="Reset SKU rows to initial state"
                  >
                    <RefreshCw className="h-3 w-3" /> Reset SKUs
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={addSkuRow} className="w-full gap-1 h-8 text-xs sm:h-7 sm:w-auto">
                    <Plus className="h-3 w-3" /> Add Sku
                  </Button>
                </div>
              </div>

              <div className="hidden rounded-lg border overflow-hidden sm:block">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="w-7 text-center py-2 px-1 font-medium text-slate-500 text-xs">#</th>
                      <th className="py-2 px-2 text-left font-medium text-slate-600 text-xs text-nowrap">SKU Name *</th>
                      <th className="py-2 px-2 text-left font-medium text-slate-600 text-xs w-[110px]">Qty (Box) *</th>
                      <th className="py-2 px-2 text-left font-medium text-slate-600 text-xs w-[130px]">Nos per Main UOM</th>
                      <th className="py-2 px-2 text-left font-medium text-slate-600 text-xs w-[120px]">Weight (MT)</th>
                      <th className="py-2 px-2 text-left font-medium text-slate-600 text-xs w-[130px]">Rate *</th>
                      <th className="py-2 px-2 text-left font-medium text-slate-600 text-xs w-[140px]">
                        <div className="flex items-center gap-1">
                          <span>Rate w/o GST</span>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-4 w-4 p-0 text-slate-400 hover:text-blue-600">
                                <Info className="h-3.5 w-3.5" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-3 text-xs space-y-1" align="start">
                              <p className="font-bold text-slate-800">Rate w/o GST Formula:</p>
                              <p className="font-mono text-blue-700 bg-blue-50 p-1.5 rounded border border-blue-100">
                                Rate ÷ (1 + GST Rate)
                              </p>
                              <p className="text-slate-500 text-[11px] pt-1">
                                Calculated automatically. GST % is taken from the Finished Good (SKU) master.
                              </p>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </th>
                      <th className="py-2 px-2 text-left font-medium text-slate-600 text-xs w-[140px]">
                        <div className="flex items-center gap-1">
                          <span>Taxable Amount</span>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-4 w-4 p-0 text-slate-400 hover:text-blue-600">
                                <Info className="h-3.5 w-3.5" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-3 text-xs space-y-1" align="start">
                              <p className="font-bold text-slate-800">Taxable Amount Formula:</p>
                              <p className="font-mono text-blue-700 bg-blue-50 p-1.5 rounded border border-blue-100">
                                Rate w/o GST × Qty (Box) × Nos per Main UOM
                              </p>
                              <p className="text-slate-500 text-[11px] pt-1">
                                Nos per Main UOM is fetched from the SKU master data.
                              </p>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {skuRows.map((row, idx) => {
                      const packType = (() => {
                        if (!row.sku) return "";
                        const u = row.sku.toUpperCase();
                        if (u.includes("JAR")) return "JAR";
                        if (u.includes("PP") || u.includes("POUCH")) return "PP";
                        if (u.includes("TIN")) return "TIN";
                        if (u.includes("CAN")) return "CAN";
                        if (u.includes("PKT") || u.includes("PACKET")) return "PKT";
                        return "";
                      })();

                      const skuData = skuRegistry[row.sku];
                      const nosPerMainUom = parseFloat(skuData?.nos_per_main_uom || skuData?.items_per_box || 1);
                      const qtyBox = parseFloat(row.qty) || 0;
                      const rate = parseFloat(row.rate) || 0;
                      const gstPct = skuGstPercent(row.sku);
                      const rateExGst = rateWithoutGst(row.sku, row.rate);
                      const taxableAmount = rateExGst * qtyBox * nosPerMainUom;

                      return (
                        <tr key={row.id} className="border-b last:border-0">
                          <td className="text-center py-1.5 px-1 text-xs font-bold text-slate-400">{idx + 1}</td>
                          <td className="py-1 px-2">
                            <AsyncCombobox
                              fetchOptions={fetchSkuOptions}
                              value={row.sku}
                              onValueChange={v => updateSkuRow(row.id, "sku", v)}
                              placeholder="Select Good Life SKU"
                              searchPlaceholder="Search SKU..."
                              className="h-8 text-sm"
                            />
                          </td>
                          <td className="py-1 px-2">
                            <Input
                              type="number" min="0" step="0.0001"
                              value={row.qty}
                              onChange={e => updateSkuRow(row.id, "qty", e.target.value)}
                              placeholder="0.0000"
                              className="h-8 text-sm w-full"
                            />
                          </td>
                          <td className="py-1 px-2">
                            <div className="h-8 flex items-center px-2 bg-slate-50 border rounded text-xs font-mono text-slate-600">
                              {nosPerMainUom}
                            </div>
                          </td>
                          <td className="py-1 px-2">
                            <div className="h-8 flex items-center px-2 bg-slate-50 border rounded text-xs font-mono text-slate-600">
                              {row.mt ? row.mt.toFixed(4) : "0.0000"}
                            </div>
                          </td>
                          <td className="py-1 px-2">
                            <div className="flex items-center gap-1.5">
                              <Input
                                type="number" min="0" step="0.01"
                                value={row.rate}
                                onChange={e => updateSkuRow(row.id, "rate", e.target.value)}
                                placeholder="0.00"
                                className="h-8 text-sm flex-1"
                              />
                              {packType && (
                                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1 py-0.5 rounded border border-blue-100 whitespace-nowrap">
                                  {packType}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-1 px-2">
                            <div
                              className="h-8 flex items-center justify-end px-2 bg-slate-50 border rounded text-xs font-mono tabular-nums text-slate-700 cursor-not-allowed"
                              title={row.sku ? `Rate ÷ (1 + ${gstPct}% GST from Finished Good master)` : "Select a SKU"}
                            >
                              {fmtAmount(rateExGst, 4)}
                            </div>
                          </td>
                          <td className="py-1 px-2">
                            <div className="h-8 flex items-center px-2 bg-slate-50 border rounded text-xs font-mono font-bold text-emerald-700">
                              ₹{taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </td>
                          <td className="py-1 px-1 text-center">
                            <Button
                              type="button" variant="ghost" size="icon"
                              className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title={skuRows.length > 1 ? "Delete this SKU row" : "Clear this SKU row"}
                              onClick={() => removeSkuRow(row.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 sm:hidden">
                {skuRows.map((row, idx) => {
                  const packType = (() => {
                    if (!row.sku) return "";
                    const u = row.sku.toUpperCase();
                    if (u.includes("JAR")) return "JAR";
                    if (u.includes("PP") || u.includes("POUCH")) return "PP";
                    if (u.includes("TIN")) return "TIN";
                    if (u.includes("CAN")) return "CAN";
                    if (u.includes("PKT") || u.includes("PACKET")) return "PKT";
                    return "";
                  })();

                  return (
                    <div key={row.id} className="rounded-lg border p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">SKU {idx + 1}</p>
                        <Button
                          type="button" variant="ghost" size="icon"
                          className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => removeSkuRow(row.id)}
                          disabled={skuRows.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <Label>SKU Name *</Label>
                        <AsyncCombobox
                          fetchOptions={fetchSkuOptions}
                          value={row.sku}
                          onValueChange={v => updateSkuRow(row.id, "sku", v)}
                          placeholder="Select Good Life SKU"
                          searchPlaceholder="Search SKU..."
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        <div className="space-y-2">
                          <Label>Qty (Box) *</Label>
                          <Input
                            type="number" min="0" step="0.0001"
                            value={row.qty}
                            onChange={e => updateSkuRow(row.id, "qty", e.target.value)}
                            placeholder="0.0000"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Nos per Main UOM</Label>
                          <div className="h-10 flex items-center px-3 bg-slate-50 border rounded text-sm font-mono text-slate-600">
                            {(() => {
                              const skuData = skuRegistry[row.sku];
                              return parseFloat(skuData?.nos_per_main_uom || skuData?.items_per_box || 1);
                            })()}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Weight (MT)</Label>
                          <div className="h-10 flex items-center px-3 bg-slate-50 border rounded text-sm font-mono text-slate-600">
                            {row.mt ? row.mt.toFixed(4) : "0.0000"}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Rate *</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number" min="0" step="0.01"
                              value={row.rate}
                              onChange={e => updateSkuRow(row.id, "rate", e.target.value)}
                              placeholder="0.00"
                              className="min-w-0 flex-1"
                            />
                            {packType && (
                              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-1 rounded border border-blue-100 whitespace-nowrap">
                                {packType}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Rate w/o GST</Label>
                          <div className="h-10 flex items-center justify-end px-3 bg-slate-50 border rounded text-sm font-mono tabular-nums text-slate-700">
                            {fmtAmount(rateWithoutGst(row.sku, row.rate), 4)}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-1">
                            <Label>Taxable Amount</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-4 w-4 p-0 text-slate-400 hover:text-blue-600">
                                  <Info className="h-3.5 w-3.5" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-64 p-3 text-xs space-y-1" align="start">
                                <p className="font-bold text-slate-800">Taxable Amount Formula:</p>
                                <p className="font-mono text-blue-700 bg-blue-50 p-1.5 rounded border border-blue-100">
                                  Rate w/o GST × Qty (Box) × Nos per Main UOM
                                </p>
                                <p className="text-slate-500 text-[11px] pt-1">
                                  Nos per Main UOM is fetched from the SKU master data.
                                </p>
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div className="h-10 flex items-center px-3 bg-slate-50 border rounded text-sm font-mono font-bold text-emerald-700">
                            ₹{(() => {
                              const skuData = skuRegistry[row.sku];
                              const nosPerMainUom = parseFloat(skuData?.nos_per_main_uom || skuData?.items_per_box || 1);
                              const qtyBox = parseFloat(row.qty) || 0;
                              const rate = rateWithoutGst(row.sku, row.rate);
                              return (rate * qtyBox * nosPerMainUom).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Additional Ledgers (ERP Style) ── */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b pb-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Additional Ledger / Charges</p>
                  <p className="text-[11px] text-slate-400">Add freight, insurance, discounts, or handling charges</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addLedgerRow} className="gap-1 h-7 text-xs border-dashed text-blue-600 border-blue-200 hover:bg-blue-50">
                  <Plus className="h-3 w-3" /> Add Ledger
                </Button>
              </div>

              {ledgerRows.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-center text-xs text-slate-400 bg-slate-50/50">
                  No additional ledgers added. Click <span className="font-semibold text-blue-600">"+ Add Ledger"</span> if transportation, freight, or insurance charges apply.
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden bg-white shadow-sm">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 border-b text-slate-600 font-semibold">
                      <tr>
                        <th className="w-8 text-center py-2 px-1">#</th>
                        <th className="py-2 px-3 text-left">Ledger Name *</th>
                        <th className="py-2 px-3 text-right w-44">Amount (₹)</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ledgerRows.map((lRow, lIdx) => (
                        <tr key={lRow.id} className="hover:bg-slate-50 transition-colors">
                          <td className="text-center py-2 px-1 text-slate-400 font-bold">{lIdx + 1}</td>
                          <td className="py-1.5 px-3">
                            <AsyncCombobox
                              fetchOptions={fetchLedgerOptions}
                              value={lRow.ledgerName}
                              onValueChange={(val) => updateLedgerRow(lRow.id, "ledgerName", val)}
                              onSelectOption={(opt: any) => {
                                if (opt?.original) setLedgerRows(prev => prev.map(r => (r.id === lRow.id ? { ...r, ledgerId: opt.original.id, ledgerName: opt.value } : r)))
                              }}
                              placeholder="Select or Search Ledger"
                              searchPlaceholder="Search ledgers..."
                              className="h-8 text-xs bg-white border-slate-200"
                            />
                          </td>
                          <td className="py-1.5 px-3">
                            <Input
                              type="number" min="0" step="0.01"
                              value={lRow.amount}
                              onChange={e => updateLedgerRow(lRow.id, "amount", e.target.value)}
                              placeholder="0.00"
                              className="h-8 text-xs font-mono text-right font-semibold border-slate-200"
                            />
                          </td>
                          <td className="py-1.5 px-1 text-center">
                            <Button
                              type="button" variant="ghost" size="icon"
                              className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                              onClick={() => removeLedgerRow(lRow.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ── Total Taxable Value & GST Breakdown ── */}
            {(() => {
              // Per-SKU taxable value and GST (GST % comes from each Finished Good's master record)
              const skuLines = skuRows.map(r => {
                const skuData = skuRegistry[r.sku];
                const nos = parseFloat(skuData?.nos_per_main_uom || skuData?.items_per_box || 1);
                const q = parseFloat(r.qty) || 0;
                const taxable = rateWithoutGst(r.sku, r.rate) * q * nos;
                return { taxable, pct: skuGstPercent(r.sku) };
              });
              const skuTaxableTotal = skuLines.reduce((sum, l) => sum + l.taxable, 0);

              const ledgerTotal = ledgerRows.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);
              const totalTaxableValue = skuTaxableTotal + ledgerTotal;

              // GST on SKU lines only (additional ledger charges add to taxable value, same as Order Approval).
              // Same State => CGST + SGST (half each); Other State => IGST.
              const igst = skuLines.reduce((sum, l) => sum + l.taxable * (l.pct / 100), 0);
              const cgst = igst / 2;
              const sgst = igst / 2;
              const distinctRates = Array.from(new Set(skuLines.filter(l => l.taxable > 0).map(l => l.pct)));
              const numericGstRate = distinctRates.length === 1 ? distinctRates[0] : 0;
              const halfRate = numericGstRate / 2;
              const rateLabel = (pct: number) => distinctRates.length === 1 ? ` (${pct.toFixed(1)}%)` : distinctRates.length > 1 ? " (mixed rates)" : "";
              const totalGstAmount = gstSupplyType === "INTRA" ? (cgst + sgst) : igst;
              const totalOrderValue = totalTaxableValue + totalGstAmount;

              return (
                <div className="space-y-4">
                  {/* Total Taxable Card */}
                  <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50/80 via-indigo-50/40 to-slate-50 p-4 shadow-sm">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs">
                      <div className="flex items-center gap-6 text-slate-600">
                        <div>
                          <span className="text-slate-400 font-medium">SKU Taxable Subtotal:</span>{" "}
                          <span className="font-mono font-bold text-slate-700">₹{skuTaxableTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        {ledgerRows.length > 0 && (
                          <div>
                            <span className="text-slate-400 font-medium">Additional Ledgers:</span>{" "}
                            <span className="font-mono font-bold text-indigo-600">+₹{ledgerTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        )}
                      </div>
                      <div className="text-right border-t pt-2 sm:border-t-0 sm:pt-0">
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Total Taxable Value</p>
                        <p className="text-xl font-mono font-black text-blue-700">
                          ₹{totalTaxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* GST Breakdown Table (Indicative - Order Punch Form Style) */}
                  <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-xs">
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">GST Breakdown (Indicative)</p>
                      <p className="text-[10px] font-bold text-slate-500">
                        GST % from Finished Good master
                      </p>
                    </div>
                    <div className="p-4 max-w-sm ml-auto space-y-2 text-xs">
                      {/* Same / Other State is auto-detected from Depot state vs Customer state (no manual toggle) */}
                      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] mb-3">
                        <span className={cn("font-black uppercase tracking-wide", !stateDetected ? "text-amber-700" : gstSupplyType === "INTRA" ? "text-emerald-700" : "text-blue-700")}>
                          {!stateDetected ? "State not detected" : gstSupplyType === "INTRA" ? "Same State" : "Other State"}
                        </span>
                        <span className="text-slate-500 font-medium text-right">
                          {stateDetected ? `${depotState} → ${customerState}` : "Select Depo & Customer (state taken from masters)"}
                        </span>
                      </div>

                      {gstSupplyType === "INTRA" ? (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="font-black uppercase text-slate-500 text-[10px]">CGST{rateLabel(halfRate)}</span>
                            <span className="font-mono font-bold text-slate-700">
                              ₹{cgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="font-black uppercase text-slate-500 text-[10px]">SGST{rateLabel(halfRate)}</span>
                            <span className="font-mono font-bold text-slate-700">
                              ₹{sgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between items-center">
                          <span className="font-black uppercase text-slate-500 text-[10px]">IGST{rateLabel(numericGstRate)}</span>
                          <span className="font-mono font-bold text-slate-700">
                            ₹{igst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between items-center border-t border-slate-200 pt-2 mt-1">
                        <span className="font-black uppercase text-slate-800 text-[11px]">Total Order Value</span>
                        <span className="font-mono font-black text-blue-700 text-sm">
                          ₹{totalOrderValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsProcessOpen(false)} disabled={isProcessing} className="w-full sm:w-auto">Cancel</Button>
            <Button
              onClick={handleProcessSubmit}
              disabled={isProcessing}
              className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 min-w-[130px] sm:w-auto"
            >
              <ChevronRight className="h-4 w-4" />
              {isProcessing ? "Processing..." : "Confirm Process"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════
          DETAILS POPUP (PO Raised / Delivery / PO Pending)
      ═══════════════════════════════════════════════════════ */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-[1250px] max-h-[95vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="pr-8 pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2.5 flex-wrap">
              <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
                {detailsType === "raised" ? "PO Raised Details" : detailsType === "delivered" ? "Delivery Details" : "PO Pending Details"}
              </DialogTitle>
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                {detailsRow?.commitment_no}
              </span>
              {detailsRow?.commitment_date && (
                <span className="text-xs font-medium text-slate-500">
                  {new Date(detailsRow.commitment_date).toLocaleDateString("en-GB")}
                </span>
              )}
            </div>
            <DialogDescription className="text-xs text-slate-500 mt-0.5">
              Breakdown of purchase orders and dispatches linked to this commitment.
            </DialogDescription>
          </DialogHeader>

          {/* ── Compact Metadata & Metric Summary Strip ── */}
          <div className="flex flex-wrap items-center gap-x-5 sm:gap-x-7 gap-y-2 p-2.5 px-3.5 rounded-lg border border-slate-200/90 bg-slate-50/70 text-xs w-fit max-w-full">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Customer</p>
              <p className="text-xs font-bold text-slate-800 mt-0.5" title={detailsRow?.party_name}>
                {detailsRow?.party_name || "—"}
              </p>
            </div>

            <div className="h-6 w-px bg-slate-200 hidden sm:block" />

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Oil Type</p>
              <div className="mt-0.5">
                <Badge variant="outline" className="text-[11px] font-semibold bg-white border-slate-200 text-slate-700 py-0 h-5">
                  {detailsRow?.oil_type || "—"}
                </Badge>
              </div>
            </div>

            <div className="h-6 w-px bg-slate-200 hidden sm:block" />

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Qty</p>
              <p className="font-mono text-xs font-bold text-slate-900 mt-0.5">
                {fmtNum(detailsData?.commitment?.commitment?.quantity ?? detailsRow?.quantity ?? 0)}
              </p>
            </div>

            <div className="h-6 w-px bg-slate-200 hidden sm:block" />

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                {detailsType === "raised" ? "PO Raised (MT)" : detailsType === "delivered" ? "Delivered (MT)" : "PO Pending (MT)"}
              </p>
              <p className="font-mono text-xs font-bold text-blue-700 mt-0.5">
                {isLoadingDetails ? "..." : fmtNum(
                  detailsType === "raised" ? detailsData?.total_processed_mt :
                  detailsType === "delivered" ? detailsData?.total_delivered_mt :
                  detailsData?.total_pending_mt || 0
                )}
              </p>
            </div>

            <div className="h-6 w-px bg-slate-200 hidden sm:block" />

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Pending Qty (MT)</p>
              <p className="font-mono text-xs font-bold text-amber-800 mt-0.5">
                {fmtNum(detailsRow?.remaining_qty || 0)}
              </p>
            </div>
          </div>

          
          <div className="space-y-4 mt-1">
            {/* View Selector Tabs (Main Table Style) */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 p-2 rounded-lg bg-slate-50/90 border border-slate-200/80 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center p-0.5 bg-white border border-slate-200 rounded-md shadow-2xs">
                  {[
                    { id: "pending", label: "PO Pending" },
                    { id: "raised", label: "PO Raised" },
                    { id: "delivered", label: "Delivered" },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setDetailsType(tab.id as any);
                        setDetailsColumnFilters({});
                      }}
                      className={cn(
                        "px-3 py-1.5 text-xs font-semibold rounded transition-all whitespace-nowrap outline-none",
                        detailsType === tab.id
                          ? "bg-blue-600 text-white shadow-xs font-bold"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="hidden sm:block h-4 w-px bg-slate-200 mx-0.5" />

                {/* Oil Type Filter */}
                <Select value={detailsColumnFilters["oil_type"] || "ALL"} onValueChange={val => setDetailsColumnFilters(prev => ({...prev, "oil_type": val === "ALL" ? "" : val}))}>
                  <SelectTrigger className="h-8 text-xs min-w-[115px] bg-white border-slate-200 shadow-2xs">
                    <SelectValue placeholder="All Oils" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Oils</SelectItem>
                    {uniqueDetailsOilTypes.map(oil => (
                      <SelectItem key={oil} value={oil}>{oil}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={detailsColumnFilters["customer_name"] || "ALL"} onValueChange={val => setDetailsColumnFilters(prev => ({...prev, "customer_name": val === "ALL" ? "" : val}))}>
                  <SelectTrigger className="h-8 text-xs min-w-[140px] max-w-[180px] bg-white border-slate-200 shadow-2xs truncate">
                    <SelectValue placeholder="All Customers" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    <SelectItem value="ALL">All Customers</SelectItem>
                    {uniqueDetailsCustomers.map(cust => (
                      <SelectItem key={cust} value={cust} className="text-xs truncate">{cust}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="hidden sm:block h-4 w-px bg-slate-200 mx-0.5" />

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs bg-white border-slate-200 shadow-2xs gap-1.5" type="button">
                      <Settings2 className="h-3.5 w-3.5 text-slate-500" />
                      <span>Columns</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[200px] max-h-[300px] overflow-y-auto">
                    <div className="p-2 font-semibold text-xs text-slate-500 uppercase tracking-wider mb-1">
                      Toggle Columns
                    </div>
                    {(() => {
                       let cols = [];
                       if (detailsType === "delivered") {
                         cols = [
                           { id: "invoice_no", label: "Invoice No." }, { id: "invoice_date", label: "Invoice Date" },
                           { id: "order_no", label: "DO No." }, { id: "do_date", label: "DO Date" },
                           { id: "manual_sauda_no", label: "Manual Sauda No." }, { id: "po_no", label: "PO No." },
                           { id: "po_date", label: "PO Date" }, { id: "customer_name", label: "Customer Name" },
                           { id: "sku", label: "Item Name" }, { id: "sku_quantity", label: "Qty (Box)" },
                           { id: "delivered_mt", label: "Qty (MT)" }, { id: "invoice_amount", label: "Invoice Amount" }
                         ];
                       } else if (detailsType === "pending") {
                         cols = [
                           { id: "po_no", label: "PO No." }, { id: "po_date", label: "PO Date" },
                           { id: "order_no", label: "DO No." }, { id: "do_date", label: "DO Date" },
                           { id: "manual_sauda_no", label: "Manual Sauda No." }, { id: "customer_name", label: "Customer Name" },
                           { id: "sku", label: "Item Name" }, { id: "sku_quantity", label: "Total (Box)" },
                           { id: "delivered_box", label: "Deliv (Box)" }, { id: "pending_box", label: "Pend (Box)" },
                           { id: "sku_weight_mt", label: "Total (MT)" }, { id: "delivered_mt", label: "Deliv (MT)" },
                           { id: "pending_mt", label: "Pend (MT)" }
                         ];
                       } else {
                         cols = [
                           { id: "raised_at", label: "Raised On" }, { id: "order_no", label: "DO No." },
                           { id: "po_no", label: "PO No." }, { id: "po_date", label: "PO Date" },
                           { id: "sku", label: "SKU" }, { id: "sku_quantity", label: "Qty (Box)" },
                           { id: "sku_weight_mt", label: "Weight (MT)" }, { id: "sku_rate", label: "Rate" },
                           { id: "order_category", label: "Category" }, { id: "order_type", label: "Order Type" },
                           { id: "actual_depot_name", label: "Depo" }, { id: "payment_terms", label: "Payment Terms" },
                           { id: "remarks", label: "Remarks" }
                         ];
                       }
                       return cols.map(c => (
                         <div key={c.id} className="flex items-center space-x-2 px-2 py-1.5 hover:bg-slate-50 cursor-pointer rounded-md" 
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetailsHiddenCols(prev => ({...prev, [c.id]: !prev[c.id]}))
                              }}>
                           <Checkbox checked={!detailsHiddenCols[c.id]} />
                           <label className="text-sm font-medium leading-none cursor-pointer">{c.label}</label>
                         </div>
                       ))
                    })()}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>



            {/* Orders Breakdown Table */}
            {isLoadingDetails ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading details...
              </div>
            ) : detailsData?.details?.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No orders found for this commitment.</p>
            ) : detailsData ? (
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b pb-1">Order Breakdown</p>

                {/* Desktop Table */}
                <div className="hidden rounded-lg border border-slate-200 overflow-x-auto sm:block">
                  


{(() => {
  type DCol = { id: string; label: string; w: string; right?: boolean; date?: boolean; dec?: number }
  const DETAIL_COLS: Record<string, DCol[]> = {
    delivered: [
      { id: "invoice_no", label: "Invoice No.", w: "min-w-[130px]" },
      { id: "invoice_date", label: "Invoice Date", w: "min-w-[120px]", right: true, date: true },
      { id: "order_no", label: "DO No.", w: "min-w-[140px]" },
      { id: "do_date", label: "DO Date", w: "min-w-[115px]", right: true, date: true },
      { id: "manual_sauda_no", label: "Manual Sauda No.", w: "min-w-[150px]" },
      { id: "po_no", label: "PO No.", w: "min-w-[120px]" },
      { id: "po_date", label: "PO Date", w: "min-w-[115px]", right: true, date: true },
      { id: "customer_name", label: "Customer Name", w: "min-w-[200px]" },
      { id: "sku", label: "Item Name", w: "min-w-[170px]" },
      { id: "sku_quantity", label: "Qty (Box)", w: "min-w-[110px]", right: true, dec: 0 },
      { id: "delivered_mt", label: "Qty (MT)", w: "min-w-[120px]", right: true, dec: 4 },
      { id: "invoice_amount", label: "Invoice Amount", w: "min-w-[140px]", right: true, dec: 2 },
    ],
    pending: [
      { id: "po_no", label: "PO No.", w: "min-w-[120px]" },
      { id: "po_date", label: "PO Date", w: "min-w-[115px]", right: true, date: true },
      { id: "order_no", label: "DO No.", w: "min-w-[140px]" },
      { id: "do_date", label: "DO Date", w: "min-w-[115px]", right: true, date: true },
      { id: "manual_sauda_no", label: "Manual Sauda No.", w: "min-w-[150px]" },
      { id: "customer_name", label: "Customer Name", w: "min-w-[200px]" },
      { id: "sku", label: "Item Name", w: "min-w-[170px]" },
      { id: "sku_quantity", label: "Total (Box)", w: "min-w-[115px]", right: true, dec: 0 },
      { id: "delivered_box", label: "Deliv (Box)", w: "min-w-[115px]", right: true, dec: 0 },
      { id: "pending_box", label: "Pend (Box)", w: "min-w-[115px]", right: true, dec: 0 },
      { id: "sku_weight_mt", label: "Total (MT)", w: "min-w-[120px]", right: true, dec: 4 },
      { id: "delivered_mt", label: "Deliv (MT)", w: "min-w-[120px]", right: true, dec: 4 },
      { id: "pending_mt", label: "Pend (MT)", w: "min-w-[120px]", right: true, dec: 4 },
    ],
    raised: [
      { id: "raised_at", label: "Raised On", w: "min-w-[115px]", right: true, date: true },
      { id: "order_no", label: "DO No.", w: "min-w-[140px]" },
      { id: "po_no", label: "PO No.", w: "min-w-[120px]" },
      { id: "po_date", label: "PO Date", w: "min-w-[115px]", right: true, date: true },
      { id: "sku", label: "SKU", w: "min-w-[170px]" },
      { id: "sku_quantity", label: "Qty (Box)", w: "min-w-[110px]", right: true, dec: 0 },
      { id: "sku_weight_mt", label: "Weight (MT)", w: "min-w-[125px]", right: true, dec: 4 },
      { id: "sku_rate", label: "Rate (PMT)", w: "min-w-[135px]", right: true, dec: 4 },
      { id: "order_category", label: "Category", w: "min-w-[110px]" },
      { id: "order_type", label: "Order Type", w: "min-w-[120px]" },
      { id: "actual_depot_name", label: "Depo", w: "min-w-[120px]" },
      { id: "payment_terms", label: "Payment Terms", w: "min-w-[140px]" },
      { id: "remarks", label: "Remarks", w: "min-w-[150px]" },
    ],
  }
  const TOTAL_COLS = ["sku_quantity", "delivered_box", "pending_box", "sku_weight_mt", "delivered_mt", "pending_mt", "invoice_amount"]
  const cols = (DETAIL_COLS[detailsType] || []).filter(c => !detailsHiddenCols[c.id])
  const detailsActiveFiltersCount = Object.values(detailsColumnFilters).filter(v => v.trim()).length
  const fmtDate = (v: any) => (v ? new Date(v).toLocaleDateString("en-GB") : "—")
  const numTxt = (v: any, dec: number, empty = "—", amt = false) => (v == null || v === "" ? empty : amt ? fmtAmount(v, dec) : Number(v).toFixed(dec))
  const alignCls = (c: DCol) => (c.right ? "text-right px-4 tabular-nums" : "px-4")
  const hoverCls = detailsType === "delivered" ? "hover:bg-purple-50/30" : detailsType === "pending" ? "hover:bg-amber-50/30" : "hover:bg-blue-50/30"

  const numColor = (id: string) =>
    id === "delivered_mt" || id === "delivered_box" ? (detailsType === "delivered" ? "text-purple-700" : "text-emerald-700")
    : id === "pending_mt" || id === "pending_box" ? "text-amber-700"
    : id === "sku_weight_mt" && detailsType === "raised" ? "text-blue-700"
    : id === "invoice_amount" ? "text-emerald-700"
    : "text-slate-800"

  const totalFor = (c: DCol) => {
    const sum = filteredDetailsData.reduce((s: number, d: any) => s + (Number(d[c.id]) || 0), 0)
    return numTxt(sum, c.dec ?? 0, "—", c.id === "invoice_amount" || c.id === "sku_rate")
  }

  const renderDetailCell = (d: any, c: DCol) => {
    const custName = d.customer_name || detailsData.commitment?.customer?.customer_name || detailsRow?.party_name || "—"
    const base = cn(alignCls(c), c.w)
    switch (c.id) {
      case "invoice_no":
        return <TableCell key={c.id} className={cn("font-mono font-semibold", base)}>
          {d.invoice_copy ? <a href={d.invoice_copy} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">{d.invoice_no || "View Invoice"}</a> : (d.invoice_no || "—")}
        </TableCell>
      case "order_no":
        return <TableCell key={c.id} className={cn("font-mono font-semibold", base)}>
          {detailsType === "delivered" && Array.isArray(d.invoice_do_nos) && d.invoice_do_nos.length > 1 ? (
            <div className="flex flex-col gap-0.5">
              {d.invoice_do_nos.map((no: string) => (
                <Link key={no} href={`/approval-of-order?search=${no}`} className="text-emerald-700 hover:underline">{no}</Link>
              ))}
            </div>
          ) : d.order_no ? <Link href={`/approval-of-order?search=${d.order_no}`} className="text-emerald-700 hover:underline">{d.order_no}</Link> : <span className="text-slate-300">—</span>}
        </TableCell>
      case "po_no":
        return <TableCell key={c.id} className={cn("font-mono font-semibold", base)}>
          {d.po_upload_copy ? <a href={d.po_upload_copy} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{d.po_no || "View PO"}</a> : (d.po_no || "—")}
        </TableCell>
      case "do_date":
        return <TableCell key={c.id} className={base}>{d.do_date ? fmtDate(d.do_date) : fmtDate(d.raised_at)}</TableCell>
      case "invoice_date":
      case "po_date":
      case "raised_at":
        return <TableCell key={c.id} className={base}>{fmtDate(d[c.id])}</TableCell>
      case "manual_sauda_no":
        return <TableCell key={c.id} className={cn("font-mono", base)}>{d.manual_sauda_no || detailsRow?.commitment_no || "—"}</TableCell>
      case "customer_name":
        return <TableCell key={c.id} className={cn("font-medium", base)}>{custName}</TableCell>
      case "payment_terms":
        return <TableCell key={c.id} className={base}>{formatPaymentTerms(d.payment_terms)}</TableCell>
      case "remarks":
        return <TableCell key={c.id} className={cn("max-w-[200px] truncate text-slate-500", base)} title={d.remarks}>{d.remarks || "—"}</TableCell>
      case "sku_quantity":
      case "delivered_box":
      case "pending_box":
      case "sku_weight_mt":
      case "delivered_mt":
      case "pending_mt":
      case "invoice_amount":
      case "sku_rate": {
        const empty = ["delivered_box", "pending_box", "delivered_mt", "pending_mt"].includes(c.id) ? numTxt(0, c.dec ?? 0) : "—"
        return <TableCell key={c.id} className={cn("font-mono font-semibold", numColor(c.id), base)}>{numTxt(d[c.id], c.dec ?? 0, empty, c.id === "invoice_amount" || c.id === "sku_rate")}</TableCell>
      }
      default:
        return <TableCell key={c.id} className={base}>{d[c.id] || "—"}</TableCell>
    }
  }

  return (
    <>
      {detailsActiveFiltersCount > 0 && (
        <div className="flex items-center gap-2 mb-3 bg-blue-50/50 p-2 rounded-lg border border-blue-100">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-100/50 px-2.5 py-1 rounded-md">
            <Filter className="w-3.5 h-3.5" />
            <span>{detailsActiveFiltersCount} Active Filter{detailsActiveFiltersCount !== 1 ? 's' : ''}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-2.5 text-slate-500 hover:text-red-600 hover:bg-red-50 ml-auto"
            onClick={() => setDetailsColumnFilters({})}
          >
            Clear All Filters
          </Button>
        </div>
      )}

      <Table>
        <TableHeader className="bg-slate-50 border-b">
          {/* 1. Search / filter inputs */}
          <TableRow>
            {cols.map(c => (
              <TableHead key={`search-${c.id}`} className={cn("whitespace-nowrap align-top pt-2.5 pb-1", alignCls(c), c.w)}>
                <div className="w-full mb-0.5">
                  {c.date ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="flex items-center justify-between w-full h-7 px-2.5 text-[10px] text-slate-500 bg-slate-50 hover:bg-slate-100 border border-slate-200/70 hover:border-slate-300 rounded-md transition-all shadow-2xs">
                          <span className="truncate font-medium">{detailsColumnFilters[`${c.id}_from`] || detailsColumnFilters[`${c.id}_to`] ? "Filtered" : "Filter..."}</span>
                          <CalendarIconLucide className="h-3 w-3 opacity-60 ml-1 shrink-0" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-48 p-3" align="start">
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                            <Label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Date Range</Label>
                            {(detailsColumnFilters[`${c.id}_from`] || detailsColumnFilters[`${c.id}_to`]) && (
                              <button
                                onClick={() => setDetailsColumnFilters(prev => { const next = { ...prev }; delete next[`${c.id}_from`]; delete next[`${c.id}_to`]; return next })}
                                className="text-[10px] text-red-600 hover:underline font-semibold"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-medium text-slate-500">From</Label>
                            <Input type="date" value={detailsColumnFilters[`${c.id}_from`] || ""} onChange={e => setDetailsColumnFilters(prev => ({ ...prev, [`${c.id}_from`]: e.target.value }))} className="h-8 text-xs bg-slate-50 border-slate-200 shadow-none focus-visible:ring-blue-400" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-medium text-slate-500">To</Label>
                            <Input type="date" value={detailsColumnFilters[`${c.id}_to`] || ""} onChange={e => setDetailsColumnFilters(prev => ({ ...prev, [`${c.id}_to`]: e.target.value }))} className="h-8 text-xs bg-slate-50 border-slate-200 shadow-none focus-visible:ring-blue-400" />
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <Input
                      placeholder="Search..."
                      value={detailsColumnFilters[c.id] || ""}
                      onChange={(e) => setDetailsColumnFilters(prev => ({ ...prev, [c.id]: e.target.value }))}
                      className={cn(
                        "h-7 text-[10px] w-full px-2.5 py-0 bg-slate-50 hover:bg-slate-100 focus:bg-white border-slate-200/70 focus:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-100/50 shadow-2xs rounded-md transition-all placeholder:text-slate-400/80 font-medium text-slate-700",
                        c.right ? "text-right" : "text-left"
                      )}
                    />
                  )}
                </div>
              </TableHead>
            ))}
          </TableRow>

          {/* 2. Totals */}
          {filteredDetailsData.length > 0 && (
            <TableRow className="bg-slate-100/90 border-b-2 border-slate-300 font-bold text-xs text-slate-800 hover:bg-slate-100/90 shadow-sm">
              {cols.map((c, i) => (
                <TableCell
                  key={`total-${c.id}`}
                  className={cn(
                    i === 0 ? "font-black text-slate-900 uppercase tracking-wider text-[11px]" : "font-mono font-black",
                    TOTAL_COLS.includes(c.id) ? numColor(c.id) : "",
                    alignCls(c)
                  )}
                >
                  {i === 0 ? `Total (${filteredDetailsData.length})` : TOTAL_COLS.includes(c.id) ? totalFor(c) : ""}
                </TableCell>
              ))}
            </TableRow>
          )}

          {/* 3. Column headings */}
          <TableRow>
            {cols.map(c => (
              <TableHead key={c.id} className={cn("whitespace-nowrap align-top py-2.5", alignCls(c), c.w)}>
                <div className={cn("flex items-center gap-1 w-full", c.right ? "justify-end" : "justify-start")}>
                  <span>{c.label}</span>
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {filteredDetailsData.length === 0 ? (
            <TableRow>
              <TableCell colSpan={Math.max(cols.length, 1)} className="py-12 text-center text-slate-400 font-medium bg-slate-50/50">No results found for your search filters</TableCell>
            </TableRow>
          ) : (
            filteredDetailsData.map((d: any) => (
              <TableRow key={d.id} className={cn("transition-colors", hoverCls)}>
                {cols.map(c => renderDetailCell(d, c))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </>
  )
})()}



                </div>

                {/* Mobile Cards */}
                <div className="space-y-3 sm:hidden">
                  {detailsData.details.map((d: any, idx: number) => {
                    const mt = detailsType === "raised" ? d.sku_weight_mt : detailsType === "delivered" ? d.delivered_mt : d.pending_mt
                    const mtLabel = detailsType === "raised" ? "PO Raised (MT)" : detailsType === "delivered" ? "Delivered (MT)" : "PO Pending (MT)"
                    const mtColor = detailsType === "raised" ? "text-blue-700" : detailsType === "delivered" ? "text-purple-700" : "text-amber-700"
                    return (
                      <div key={d.id} className="rounded-lg border px-4 py-3 bg-white grid grid-cols-1 gap-3 text-sm shadow-sm">
                        <div className="flex items-start justify-between gap-3 border-b pb-2">
                          <div>
                            {detailsType === "delivered" ? (
                              <>
                                <p className="text-[11px] font-bold uppercase tracking-wider text-purple-600">Invoice No.</p>
                                {d.invoice_copy ? (
                                  <a href={d.invoice_copy} target="_blank" rel="noopener noreferrer" className="font-mono text-sm font-bold text-purple-800 underline">
                                    {d.invoice_no || "View Invoice"}
                                  </a>
                                ) : (
                                  <p className="font-mono text-sm font-bold text-purple-900">{d.invoice_no || "—"}</p>
                                )}
                              </>
                            ) : (
                              <>
                                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">DO No.</p>
                                {d.order_no ? (
                                  <Link href={`/approval-of-order?search=${d.order_no}`} className="font-mono text-sm font-bold text-emerald-800">
                                    {d.order_no}
                                  </Link>
                                ) : (
                                  <p className="font-mono text-sm text-slate-400">—</p>
                                )}
                              </>
                            )}
                          </div>
                          <div className="text-right">
                            <p className={cn("text-[11px] font-bold uppercase tracking-wider", detailsType === "raised" ? "text-blue-500" : detailsType === "delivered" ? "text-purple-500" : "text-amber-500")}>{mtLabel}</p>
                            <p className={cn("font-mono font-bold text-sm", mtColor)}>{mt != null ? fmtNum(mt) : "—"}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {detailsType === "delivered" && (
                            <>
                              <div>
                                <p className="text-[10px] font-bold uppercase text-slate-400">Invoice Date</p>
                                <p className="font-semibold text-slate-800">{d.invoice_date ? new Date(d.invoice_date).toLocaleDateString("en-GB") : "—"}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold uppercase text-slate-400">DO No.</p>
                                <p className="font-mono font-bold text-emerald-800">{d.order_no || "—"}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold uppercase text-slate-400">DO Date</p>
                                <p className="font-semibold text-slate-800">{d.do_date ? new Date(d.do_date).toLocaleDateString("en-GB") : "—"}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold uppercase text-slate-400">Manual Sauda No.</p>
                                <p className="font-mono font-semibold text-slate-700">{d.manual_sauda_no || "—"}</p>
                              </div>
                            </>
                          )}
                          <div>
                            <p className="text-[10px] font-bold uppercase text-slate-400">PO No.</p>
                            {d.po_upload_copy ? (
                              <a href={d.po_upload_copy} target="_blank" rel="noopener noreferrer" className="font-mono font-semibold text-blue-700 underline">
                                {d.po_no || "View PO"}
                              </a>
                            ) : (
                              <p className="font-mono font-semibold text-blue-700">{d.po_no || "—"}</p>
                            )}
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase text-slate-400">PO Date</p>
                            <p className="font-semibold text-slate-800">{d.po_date ? new Date(d.po_date).toLocaleDateString("en-GB") : "—"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase text-slate-400">Qty (Box)</p>
                            <p className="font-mono font-semibold text-slate-800">{d.sku_quantity != null ? fmtNum(d.sku_quantity, 0) : "—"}</p>
                          </div>
                          {detailsType === "delivered" && (
                            <div>
                              <p className="text-[10px] font-bold uppercase text-slate-400">Invoice Amount</p>
                              <p className="font-mono font-bold text-slate-800">{d.invoice_amount != null ? fmtAmount(d.invoice_amount, 2) : "—"}</p>
                            </div>
                          )}
                        </div>

                        <div>
                          <p className="text-[10px] font-bold uppercase text-slate-400">Customer Name</p>
                          <p className="text-xs font-semibold text-slate-800 break-words">{d.customer_name || detailsData.commitment?.customer?.customer_name || "—"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase text-slate-400">Item Name</p>
                          <p className="text-xs font-semibold text-slate-800 break-words">{d.sku || "—"}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No data available.</p>
            )}

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailsOpen(false)} className="w-full sm:w-auto">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
