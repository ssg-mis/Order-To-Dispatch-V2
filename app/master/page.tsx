"use client"

import { useState, useEffect, useMemo, useCallback, type ComponentType } from "react"
import { matchesSearch } from "@/lib/search-utils"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Checkbox } from "@/components/ui/checkbox"
import { Combobox } from "@/components/ui/combobox"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { FileUploadField } from "@/components/file-upload-field"
import { useToast } from "@/hooks/use-toast"
import { customerApi, depotApi, brokerApi, skuDetailsApi, commonApi, skuSellingPriceApi, varCalcApi, salespersonApi, ledgerGroupApi, stockGroupApi, unitApi, ledgerApi, rawMaterialApi, semiFinishedGoodApi, insuranceDetailApi, conversionFormulaApi, priceLevelApi, petrolPumpApi, cdRuleApi, tdsRuleApi, oilTagApi, bhadaRateApi, vehicleMasterApi, driverMasterApi, transportMasterApi, orderApi, inventoryApi, setMasterTabContext, stateApi, lookupApi } from "@/lib/api-service"
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query"
import { useInView } from "react-intersection-observer"

import { useAuth } from "@/hooks/use-auth"
import {   Droplet, UserPlus, UserMinus, Search, RefreshCw, FileText, Download, Filter, ArrowUpDown, ArrowUp, ArrowDown, Package, Warehouse, Briefcase, Plus, Loader2, Save, Trash2, Edit2, AlertCircle, CheckCircle2, MoreVertical, X, Settings, Calendar, Clock, MapPin, Phone, Mail, User, Users, Info, Check, Eye, Trash, LayoutGrid, ChevronRight, ChevronDown, List, Upload, EyeOff, Layout, Truck, Pencil, UserCircle, Factory, BookOpen, Layers, Ruler, Landmark, FlaskConical, Shield, Calculator, Tag, Fuel, Percent, Route,
} from 'lucide-react'
import { PageHeader } from "@/components/page-header"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ReferenceDataTab } from "@/components/reference-data-tab"

// --- Types ---

interface Customer {
  id: number
  customer_id: string
  customer_name: string
  status: string
  contact_person: string
  contact: string
  email: string
  address_line_1: string
  address_line_2: string
  state: string
  state_id?: number | null
  pincode: string
  pan: string
  gstin: string
  gst_registered: string
  gst_registration_type?: string | null
  gst_registration_wef?: string | null
  msme_registration_no?: string | null
  msme_registration_type?: string | null
  msme_registration_wef?: string | null
  fssai_no?: string | null
  fssai_valid_upto?: string | null
  fssai_licence_type?: string | null
  aadhaar_upload?: string | null
  pan_upload?: string | null
  gst_certificate_upload?: string | null
  msme_certificate_upload?: string | null
  fssai_certificate_upload?: string | null
  addresses?: CustomerAddress[]
  godown_ids?: number[]
  is_required_for_commitment?: string
  bank_accounts?: CustomerBankAccount[]
  ledger_group_id?: number | string | null
}

// Customer-Master field parity fields (Phases 10/11/12/21, review Sections
// 6/7/8/19) - the exact same set as Customer's GST/MSME/FSSAI/uploads block,
// mixed into Broker/Salesperson/Transport/PetrolPump below.
interface PartyParityFields {
  state?: string
  state_id?: number | string | null
  pan?: string
  gstin?: string
  gst_registered?: string | null
  gst_registration_type?: string | null
  gst_registration_wef?: string | null
  msme_registration_no?: string | null
  msme_registration_type?: string | null
  msme_registration_wef?: string | null
  fssai_no?: string | null
  fssai_valid_upto?: string | null
  fssai_licence_type?: string | null
  aadhaar_upload?: string | null
  pan_upload?: string | null
  gst_certificate_upload?: string | null
  msme_certificate_upload?: string | null
  fssai_certificate_upload?: string | null
}

interface Depot {
  id: number // real serial PK (v2) — all mutations key off this
  depot_id: string // legacy text business code, display-only
  status: string
  depot_name: string
  depot_address: string
  state: string
  state_id?: number | null
  salesman_broker_name: string
  agent_tags?: { agent_type: 'broker' | 'salesperson'; agent_id: number }[]
  agreement_paper_upload?: string
  depot_owner_gst_certificate_upload?: string
  pan_card_upload?: string
  aadhaar_card_upload?: string
}

interface Broker extends PartyParityFields {
  id: number // real serial PK (v2) — all mutations key off this
  broker_id: string // legacy text business code, display-only
  status: string
  salesman_name: string
  email_id: string
  mobile_no: string
  depot_name: string
  depot_id: string
  ledger_group_id?: number | string | null
}

interface Salesperson extends PartyParityFields {
  id: number // real serial PK (v2) — all mutations key off this
  broker_id: string // legacy text business code, display-only
  status: string
  salesman_name: string
  email_id: string
  mobile_no: string
  depot_name: string
  depot_id: string
  ledger_group_id?: number | string | null
  employee_id?: string | null
}

interface LedgerGroup {
  id: number
  group_code: string
  group_name: string
  status: string
  is_system: boolean
}

interface StockGroup {
  id: number
  group_code: string
  group_name: string
  status: string
  is_system: boolean
}

interface Unit {
  id: number
  unit_code: string
  unit_name: string
  status: string
}

interface Ledger {
  id: number
  ledger_code: string
  ledger_name: string
  ledger_group_id: number | null
  status: string
}

interface RawMaterialAdditionalUom {
  id?: number
  uom_id: number | string
  conversion_ratio: number | string
}

interface RawMaterial {
  id: number
  raw_material_code: string
  name: string
  main_uom_id: number | null
  additional_uoms?: RawMaterialAdditionalUom[]
  type_of_supply: string | null
  gst_rate_id: number | null
  hsn_code_id: number | null
  sac_code_id: number | null
  default_accounting_ledger_id: number | null
  batch_tracking_enabled: boolean
  status: string
}

interface SkuDetail {
  id: number
  status: string
  sku_code: string
  sku_name: string
  main_uom: string
  alternate_uom: string
  nos_per_main_uom: number | string
  units: string
  oil_filling_per_unit: number | string
  filling_units: string
  converted_kg: number | string
  packing_weight_per_main_unit: number | string
  weight_difference: number | string
  sku_weight: number | string
  packing_weight: number | string
  gross_weight: number | string
  tag_name: string
  // Phase 18 (Finished Goods Master) + Phase 3 fold-in (SKU GST extension).
  semi_finished_good_id?: number | string | null
  oil_tag_id?: number | string | null
    oil_type_id?: number | string | null
  stock_category_id?: number | string | null
  main_uom_id?: number | string | null
  alternate_uom_id?: number | string | null
  type_of_supply?: string | null
  gst_rate_id?: number | string | null
  hsn_code_id?: number | string | null
  sac_code_id?: number | string | null
  uqc_id?: number | string | null
}

interface SkuSellingPrice {
  id: number
  packing_material: string
  sku_weight: number | string
  sku_unit: string
  conversion_formula: number | string
  sku_weight_in_gm: number | string
  packing_material_weight_in_gm: number | string
  net_oil_in_gm: number | string
  packing_cost: number | string
  var: string
  landing_cost: number | string
  selling_cost: number | string
  margin: string
  actual_margin: number | string
}

interface Vehicle {
  id: number
  vehicle_master_id: string
  status: string
  registration_no: string
  vehicle_type: string
  transporter: string
  rto: string
  rc_image?: string
  road_tax?: string
  road_tax_image?: string
  pollution?: string
  pollution_image?: string
  insurance?: string
  insurance_image?: string
  fitness?: string
  fitness_image?: string
  state_permit?: string
  state_permit_image?: string
  state_permit_type?: string
  national_permit?: string
  national_permit_image?: string
  fuel_type?: string
  gvw?: number
  ulw?: number
  passing?: number
  life_time_tax?: string
  life_time_tax_image?: string
}

interface Driver {
  id: number
  driver_master_id: string
  status: string
  driver_name: string
  mobile_no: string
  email_id: string
  driving_licence_no: string
  driving_licence_type: string
  valid_upto: string
  rto: string
  rto_id?: number | null
  trans_valid_upto?: string
  lmv_valid_upto?: string
  address_line1: string
  state: string
  state_id?: number | null
  pincode: string
  aadhaar_no: string
  pan_no: string
  aadhaar_upload: string
  dl_upload: string
}

interface Transport extends PartyParityFields {
  id: number
  transport_master_id: string
  status: string
  transporter_name: string
  contact_person: string
  contact_number: string
  email_id: string
  address_line1: string
  state: string
  state_id?: number | null
  pincode: string
  pan: string
  gstin: string
  ledger_group_id?: number | string | null
  bilty_copy_upload?: string | null
  linked_customer_id?: number | string | null
}

// --- Constants ---

const STATUS_OPTIONS = ["Active", "Inactive"]

// Mirrors validators/customerValidator.js on the backend - the backend is the
// authoritative gate, this is purely for immediate UX feedback.
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const PINCODE_REGEX = /^[0-9]{6}$/
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/
// Mirrors GODOWN_NAMES in services/customerService.js - the only 5 valid
// "Belongs to Which Godown" options.
const GODOWN_NAMES = ['Banari', 'Ambikapur', 'Dallirajhara', 'Raigarh', 'Rajnandgaon']
const normalizeGstField = (v: string) => v.trim().toUpperCase()

interface CustomerAddress {
  id?: number
  address_line_1?: string
  address_line_2?: string
  city?: string
  post?: string
  thana?: string
  sub_district?: string
  district?: string
  state_id?: number | null
  pincode?: string
}
const blankCustomerAddress = (): CustomerAddress => ({
  address_line_1: "", address_line_2: "", city: "", post: "", thana: "",
  sub_district: "", district: "", state_id: null, pincode: "",
})

interface CustomerBankAccount {
  id?: number
  bank_name_id?: number | null
  account_holder_name?: string
  account_number?: string
  ifsc_code?: string
}
const blankCustomerBankAccount = (): CustomerBankAccount => ({
  bank_name_id: null, account_holder_name: "", account_number: "", ifsc_code: "",
})

// Customer-Master field parity block (Phases 10/11/12/21) - the same blank
// defaults spread into Broker/Salesperson/Transport/PetrolPump form state.
const blankPartyParityFields = (): PartyParityFields => ({
  state: "", state_id: null, pan: "", gstin: "",
  gst_registered: "", gst_registration_type: "", gst_registration_wef: "",
  msme_registration_no: "", msme_registration_type: "", msme_registration_wef: "",
  fssai_no: "", fssai_valid_upto: "", fssai_licence_type: "",
  aadhaar_upload: "", pan_upload: "", gst_certificate_upload: "", msme_certificate_upload: "", fssai_certificate_upload: "",
})

const ALL_MASTER_TABS = [
  "customers", "depots", "brokers", "salespersons",
  "sku_details", "sku_selling_price", "vehicle_master", "driver_master", "transport_master",
  "ledger_groups", "stock_groups", "units", "raw_materials", "semi_finished_goods",
  "insurance_details", "conversion_formulas", "price_levels", "petrol_pumps", "cd_rules",
  "tds_rules", "oil_tags", "bhada_rates",
  "reference_data"
]

const TAB_META: Record<string, { label: string; icon: ComponentType<{ className?: string }>; desc: string }> = {
  customers: { label: "Customer", icon: Users, desc: "Manage your customer records and details" },
  depots: { label: "Depots", icon: Warehouse, desc: "Manage your depot locations and details" },
  brokers: { label: "Brokers", icon: Briefcase, desc: "Manage your broker records and details" },
  salespersons: { label: "Salesperson", icon: Users, desc: "Manage your salesperson records and details" },
  ledger_groups: { label: "Ledger Groups", icon: BookOpen, desc: "Categorize party masters under Ledger Groups" },
  stock_groups: { label: "Stock Groups", icon: Layers, desc: "Categorize stock item masters under Stock Groups" },
  units: { label: "Units", icon: Ruler, desc: "Manage units of measurement (UOM)" },
  raw_materials: { label: "Raw Materials", icon: FlaskConical, desc: "Manage your raw material records and details" },
  semi_finished_goods: { label: "Semi-Finished Goods", icon: Factory, desc: "Manage your semi-finished goods records and details" },
  insurance_details: { label: "Insurance Details", icon: Shield, desc: "Manage vehicle/cargo insurance policies" },
  conversion_formulas: { label: "Conversion Formulas", icon: Calculator, desc: "Define price conversion formulas between Finished Goods" },
  price_levels: { label: "Price Levels", icon: Tag, desc: "Maintain dated Finished Goods price lists" },
  petrol_pumps: { label: "Petrol Pumps", icon: Fuel, desc: "Manage your petrol pump records and details" },
  cd_rules: { label: "Cash Discount", icon: Percent, desc: "Maintain Cash Discount rules by Stock Category" },
  tds_rules: { label: "TDS", icon: Landmark, desc: "TDS rate placeholder — minimum fields only, pending client scoping" },
    oil_tags: { label: "Oil Tags", icon: Droplet, desc: "Manage dynamic oil types and tags" },
  bhada_rates: { label: "Bhada Rate", icon: Route, desc: "Freight/Bhada rate placeholder — minimum fields only, pending client scoping" },
  sku_details: { label: "Finished Goods", icon: Package, desc: "Manage your Finished Goods list and product details" },
  sku_selling_price: { label: "Pricing", icon: Package, desc: "Manage SKU selling prices and rates" },
  vehicle_master: { label: "Vehicles", icon: Truck, desc: "Manage your vehicle database and documents" },
  driver_master: { label: "Drivers", icon: User, desc: "Manage your driver records and documents" },
  transport_master: { label: "Transporters", icon: Truck, desc: "Manage your transporter records and details" },
  reference_data: { label: "Reference Data", icon: List, desc: "Manage lookup references for master records" },
}







const formatDocDate = (dateStr?: string) => {
  if (!dateStr) return "—"
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

const renderDocBadge = (label: string, image?: string, expiry?: string) => {
  if (!image && !expiry) return null;

  const badgeEl = (
    <Badge 
      variant="outline" 
      className={`text-[10px] ${image ? 'bg-blue-50 cursor-pointer hover:bg-blue-100 text-blue-700 border-blue-200' : 'bg-slate-50 border-slate-200 text-slate-500'} transition-all`}
      onClick={image ? (e) => { e.stopPropagation(); window.open(image, '_blank'); } : undefined}
    >
      {label}
    </Badge>
  );

  return (
    <Tooltip key={label}>
      <TooltipTrigger asChild>
        {badgeEl}
      </TooltipTrigger>
      <TooltipContent className="bg-slate-900 text-white p-2.5 rounded-xl shadow-xl border border-slate-800 z-[100] max-w-xs">
        <div className="space-y-1">
          <p className="font-semibold text-xs text-slate-200">{label} Details</p>
          <p className="text-[10px] text-slate-300">
            Expiry: <span className="text-white font-medium">{formatDocDate(expiry)}</span>
          </p>
          <p className="text-[10px] text-slate-400">
            {image ? "Click to view document image" : "No image uploaded"}
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

const renderDocCell = (expiry?: string, image?: string, type?: string) => {
  if (!expiry && !image && !type) return <TableCell className="text-slate-400 text-xs">—</TableCell>;
  return (
    <TableCell className="text-xs">
      <div className="flex flex-col gap-0.5 min-w-[100px]">
        {type && (
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            {type} Permit
          </span>
        )}
        {image ? (
          <button
            onClick={() => window.open(image, '_blank')}
            className="text-blue-600 hover:text-blue-800 hover:underline font-medium text-left w-fit"
          >
            {formatDocDate(expiry)}
          </button>
        ) : (
          <span className="text-slate-700 font-medium">{formatDocDate(expiry)}</span>
        )}
      </div>
    </TableCell>
  );
};

export default function MasterPage() {
  const { toast } = useToast()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState("customers")
  const visibleTabs = useMemo(() => {
    if (!user || user.role === 'super_admin') return ALL_MASTER_TABS
    const masterTabsConfig = (user.features as any)?.master_tabs
    if (!masterTabsConfig || typeof masterTabsConfig !== 'object') return ALL_MASTER_TABS
    return ALL_MASTER_TABS.filter(tab => {
      const val = masterTabsConfig[tab]
      // Support old boolean format (true) and new string format ('modify' | 'view_only')
      return val === true || val === 'modify' || val === 'view_only'
    })
  }, [user])

  // Per-tab master_tabs access is authoritative here. The page-level "Master"
  // view/modify setting no longer locks the page — access is granted by the key's
  // presence in page_access (the sidebar gates that). Only the 'pc' role is a hard
  // global read-only.
  const isMasterTabReadOnly = useMemo(() => {
    if (user?.role === 'pc') return true // 'pc' role is always read-only
    if (!user || user.role === 'super_admin' || user.role === 'admin') return false
    const masterTabsConfig = (user.features as any)?.master_tabs
    if (!masterTabsConfig || typeof masterTabsConfig !== 'object') return false
    const val = masterTabsConfig[activeTab]
    // old boolean true or new 'modify' → can modify; 'view_only' → read only
    if (val === 'view_only') return true
    return false
  }, [user, activeTab])

  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.includes(activeTab)) {
      setActiveTab(visibleTabs[0])
    }
  }, [visibleTabs, activeTab])

  // Sync active tab with backend header context so API calls carry X-Master-Tab
  useEffect(() => {
    setMasterTabContext(activeTab)
    setCustomerSubTab('active'); setDepotSubTab('active'); setBrokerSubTab('active')
    setSalespersonSubTab('active'); setSkuSubTab('active'); setVehicleSubTab('active')
    setDriverSubTab('active'); setTransportSubTab('active')
    setLedgerGroupSubTab('active'); setStockGroupSubTab('active'); setUnitSubTab('active')
    setRawMaterialSubTab('active'); setSemiFinishedGoodSubTab('active')
    setInsuranceDetailSubTab('active'); setConversionFormulaSubTab('active')
    setPriceLevelSubTab('active'); setPetrolPumpSubTab('active')
    setCdRuleSubTab('active')
    setTdsRuleSubTab('active'); setBhadaRateSubTab('active')
    setSelectedVehicleType('all')
    return () => { setMasterTabContext(null) }
  }, [activeTab])

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [openingStockByDepot, setOpeningStockByDepot] = useState<Record<string, string>>({})
const { ref: customerEndRef, inView: customerInView } = useInView()
  const { ref: depotEndRef, inView: depotInView } = useInView()
  const { ref: brokerEndRef, inView: brokerInView } = useInView()
  const { ref: salespersonEndRef, inView: salespersonInView } = useInView()
  const { ref: ledgerGroupEndRef, inView: ledgerGroupInView } = useInView()
  const { ref: stockGroupEndRef, inView: stockGroupInView } = useInView()
  const { ref: unitEndRef, inView: unitInView } = useInView()
  const { ref: rawMaterialEndRef, inView: rawMaterialInView } = useInView()
  const { ref: semiFinishedGoodEndRef, inView: semiFinishedGoodInView } = useInView()
  const { ref: insuranceDetailEndRef, inView: insuranceDetailInView } = useInView()
  const { ref: conversionFormulaEndRef, inView: conversionFormulaInView } = useInView()
  const { ref: priceLevelEndRef, inView: priceLevelInView } = useInView()
  const { ref: petrolPumpEndRef, inView: petrolPumpInView } = useInView()
  const { ref: cdRuleEndRef, inView: cdRuleInView } = useInView()
  const { ref: tdsRuleEndRef, inView: tdsRuleInView } = useInView()
  const { ref: bhadaRateEndRef, inView: bhadaRateInView } = useInView()
  const { ref: vehicleEndRef, inView: vehicleInView } = useInView()
  const { ref: driverEndRef, inView: driverInView } = useInView()
  const { ref: skuEndRef, inView: skuInView } = useInView()
  const { ref: skuSellingPriceEndRef, inView: skuSellingPriceInView } = useInView()
  // --- Queries ---

  // Customers
  const {
    data: customerData,
    fetchNextPage: fetchNextCustomer,
    hasNextPage: hasNextCustomer,
    isFetchingNextPage: isFetchingNextCustomer,
    isLoading: isCustomerLoading,
    refetch: refetchCustomer,
  } = useInfiniteQuery({
    queryKey: ["master-customers", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await customerApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" })
      return res.success ? res.data : { customers: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.customers?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  const { data: pendingCustomersData, refetch: refetchPendingCustomers } = useQuery({
    queryKey: ['pending-customers'],
    queryFn: async () => {
      const res = await customerApi.getPending()
      return res.success ? (res.data as any[]) : []
    },
    enabled: (user?.role === 'admin' || user?.role === 'super_admin') && activeTab === 'customers',
  })
  const pendingCustomers: any[] = pendingCustomersData || []

  const isAdminOrSuper = user?.role === 'admin' || user?.role === 'super_admin'
  const canEditExisting = isAdminOrSuper && !isMasterTabReadOnly // non-admins can add but not edit existing records; view-only tab access also blocks edits
  // Customers (pilot): users with 'modify' access can also edit existing records.
  // Admins write directly; non-admin edits are staged and routed through the pending-approval flow.
  // Deletes remain admin-only (no pending flow for deletes yet).
  const canEditActiveTab = !isMasterTabReadOnly

  const { data: pendingDepotsData, refetch: refetchPendingDepots } = useQuery({ queryKey: ['pending-depots'], queryFn: async () => { const res = await depotApi.getPending(); return res.success ? (res.data as any[]) : [] }, enabled: isAdminOrSuper && activeTab === 'depots' })
  const { data: pendingBrokersData, refetch: refetchPendingBrokers } = useQuery({ queryKey: ['pending-brokers'], queryFn: async () => { const res = await brokerApi.getPending(); return res.success ? (res.data as any[]) : [] }, enabled: isAdminOrSuper && activeTab === 'brokers' })
  const { data: pendingSalespersonsData, refetch: refetchPendingSalespersons } = useQuery({ queryKey: ['pending-salespersons'], queryFn: async () => { const res = await salespersonApi.getPending(); return res.success ? (res.data as any[]) : [] }, enabled: isAdminOrSuper && activeTab === 'salespersons' })
  const { data: pendingLedgerGroupsData, refetch: refetchPendingLedgerGroups } = useQuery({ queryKey: ['pending-ledger-groups'], queryFn: async () => { const res = await ledgerGroupApi.getPending(); return res.success ? (res.data as any[]) : [] }, enabled: isAdminOrSuper && activeTab === 'ledger_groups' })
  const { data: pendingStockGroupsData, refetch: refetchPendingStockGroups } = useQuery({ queryKey: ['pending-stock-groups'], queryFn: async () => { const res = await stockGroupApi.getPending(); return res.success ? (res.data as any[]) : [] }, enabled: isAdminOrSuper && activeTab === 'stock_groups' })
  const { data: pendingUnitsData, refetch: refetchPendingUnits } = useQuery({ queryKey: ['pending-units'], queryFn: async () => { const res = await unitApi.getPending(); return res.success ? (res.data as any[]) : [] }, enabled: isAdminOrSuper && activeTab === 'units' })
  const { data: pendingRawMaterialsData, refetch: refetchPendingRawMaterials } = useQuery({ queryKey: ['pending-raw-materials'], queryFn: async () => { const res = await rawMaterialApi.getPending(); return res.success ? (res.data as any[]) : [] }, enabled: isAdminOrSuper && activeTab === 'raw_materials' })
  const { data: pendingSemiFinishedGoodsData, refetch: refetchPendingSemiFinishedGoods } = useQuery({ queryKey: ['pending-semi-finished-goods'], queryFn: async () => { const res = await semiFinishedGoodApi.getPending(); return res.success ? (res.data as any[]) : [] }, enabled: isAdminOrSuper && activeTab === 'semi_finished_goods' })
  const { data: pendingSkuData, refetch: refetchPendingSku } = useQuery({ queryKey: ['pending-sku-details'], queryFn: async () => { const res = await skuDetailsApi.getPending(); return res.success ? (res.data as any[]) : [] }, enabled: isAdminOrSuper && activeTab === 'sku_details' })
  const { data: pendingVehiclesData, refetch: refetchPendingVehicles } = useQuery({ queryKey: ['pending-vehicles'], queryFn: async () => { const res = await vehicleMasterApi.getPending(); return res.success ? (res.data as any[]) : [] }, enabled: isAdminOrSuper && activeTab === 'vehicle_master' })
  const { data: pendingDriversData, refetch: refetchPendingDrivers } = useQuery({ queryKey: ['pending-drivers'], queryFn: async () => { const res = await driverMasterApi.getPending(); return res.success ? (res.data as any[]) : [] }, enabled: isAdminOrSuper && activeTab === 'driver_master' })
  const { data: pendingTransportData, refetch: refetchPendingTransport } = useQuery({ queryKey: ['pending-transport'], queryFn: async () => { const res = await transportMasterApi.getPending(); return res.success ? (res.data as any[]) : [] }, enabled: isAdminOrSuper && activeTab === 'transport_master' })

  const pendingDepots: any[] = pendingDepotsData || []
  const pendingBrokers: any[] = pendingBrokersData || []
  const pendingSalespersons: any[] = pendingSalespersonsData || []
  const pendingLedgerGroups: any[] = pendingLedgerGroupsData || []
  const pendingStockGroups: any[] = pendingStockGroupsData || []
  const pendingUnits: any[] = pendingUnitsData || []
  const pendingRawMaterials: any[] = pendingRawMaterialsData || []
  const pendingSemiFinishedGoods: any[] = pendingSemiFinishedGoodsData || []
  const { data: pendingInsuranceDetailsData, refetch: refetchPendingInsuranceDetails } = useQuery({ queryKey: ['pending-insurance-details'], queryFn: async () => { const res = await insuranceDetailApi.getPending(); return res.success ? (res.data as any[]) : [] }, enabled: isAdminOrSuper && activeTab === 'insurance_details' })
  const pendingInsuranceDetails: any[] = pendingInsuranceDetailsData || []
  const { data: pendingConversionFormulasData, refetch: refetchPendingConversionFormulas } = useQuery({ queryKey: ['pending-conversion-formulas'], queryFn: async () => { const res = await conversionFormulaApi.getPending(); return res.success ? (res.data as any[]) : [] }, enabled: isAdminOrSuper && activeTab === 'conversion_formulas' })
  const pendingConversionFormulas: any[] = pendingConversionFormulasData || []
  const { data: pendingPriceLevelsData, refetch: refetchPendingPriceLevels } = useQuery({ queryKey: ['pending-price-levels'], queryFn: async () => { const res = await priceLevelApi.getPending(); return res.success ? (res.data as any[]) : [] }, enabled: isAdminOrSuper && activeTab === 'price_levels' })
  const pendingPriceLevels: any[] = pendingPriceLevelsData || []
  const { data: pendingPetrolPumpsData, refetch: refetchPendingPetrolPumps } = useQuery({ queryKey: ['pending-petrol-pumps'], queryFn: async () => { const res = await petrolPumpApi.getPending(); return res.success ? (res.data as any[]) : [] }, enabled: isAdminOrSuper && activeTab === 'petrol_pumps' })
  const pendingPetrolPumps: any[] = pendingPetrolPumpsData || []
  const { data: pendingCdRulesData, refetch: refetchPendingCdRules } = useQuery({ queryKey: ['pending-cd-rules'], queryFn: async () => { const res = await cdRuleApi.getPending(); return res.success ? (res.data as any[]) : [] }, enabled: isAdminOrSuper && activeTab === 'cd_rules' })
  const pendingCdRules: any[] = pendingCdRulesData || []
  const { data: pendingTdsRulesData, refetch: refetchPendingTdsRules } = useQuery({ queryKey: ['pending-tds-rules'], queryFn: async () => { const res = await tdsRuleApi.getPending(); return res.success ? (res.data as any[]) : [] }, enabled: isAdminOrSuper && activeTab === 'tds_rules' })
  const pendingTdsRules: any[] = pendingTdsRulesData || []
  const { data: pendingBhadaRatesData, refetch: refetchPendingBhadaRates } = useQuery({ queryKey: ['pending-bhada-rates'], queryFn: async () => { const res = await bhadaRateApi.getPending(); return res.success ? (res.data as any[]) : [] }, enabled: isAdminOrSuper && activeTab === 'bhada_rates' })
  const pendingBhadaRates: any[] = pendingBhadaRatesData || []

  // Lightweight, unpaginated Ledger Group list for the "Ledger Group" picker on
  // Customer/Broker/Salesperson/Transporter forms (Phase 8) - independent of the
  // Ledger Groups tab's own paginated/search-filtered list above.
  const { data: ledgerGroupOptionsData } = useQuery({
    queryKey: ['ledger-group-options'],
    queryFn: async () => {
      const res = await ledgerGroupApi.getAll({ all: 'true' })
      return res.success ? (res.data?.ledger_groups || []) : []
    },
  })
  const ledgerGroupOptions: any[] = ledgerGroupOptionsData || []

  // Lightweight, unpaginated Units / Ledgers lists for the pickers on the
  // Raw Materials form (Phase 16) - independent of those tabs' own
  // paginated/search-filtered lists.
  const { data: unitOptionsData } = useQuery({
    queryKey: ['unit-options'],
    queryFn: async () => {
      const res = await unitApi.getAll({ all: 'true' })
      return res.success ? (res.data?.units || []) : []
    },
  })
  const unitOptions: any[] = unitOptionsData || []

  const { data: ledgerOptionsData } = useQuery({
    queryKey: ['ledger-options'],
    queryFn: async () => {
      const res = await ledgerApi.getAll({ all: 'true' })
      return res.success ? (res.data?.ledgers || []) : []
    },
  })
  const ledgerOptions: any[] = ledgerOptionsData || []

  // Lightweight, unpaginated Semi-Finished Goods list for the Finished Goods
  // (SKU) form's SFG-link picker (Phase 18) - independent of the SFG tab's
  // own paginated/search-filtered list.
  const { data: semiFinishedGoodOptionsData } = useQuery({
    queryKey: ['semi-finished-good-options'],
    queryFn: async () => {
      const res = await semiFinishedGoodApi.getAll({ all: 'true' })
      return res.success ? (res.data?.semi_finished_goods || []) : []
    },
  })
  const semiFinishedGoodOptions: any[] = semiFinishedGoodOptionsData || []

  // Lightweight, unpaginated Stock Group list for the picker on the Raw
  // Materials / Semi-Finished Goods forms (Phase 17 - also retrofit onto
  // Raw Materials, see that schema's stockGroupId comment).
  const { data: stockGroupOptionsData } = useQuery({
    queryKey: ['stock-group-options'],
    queryFn: async () => {
      const res = await stockGroupApi.getAll({ all: 'true' })
      return res.success ? (res.data?.stock_groups || []) : []
    },
  })
  const stockGroupOptions: any[] = stockGroupOptionsData || []

  // Lightweight, unpaginated Transporter list for the multi-transporter
  // tagging checklist on the Vehicle form (Phase 13) - independent of the
  // Transporters tab's own paginated/search-filtered list.
  const { data: transporterOptionsData } = useQuery({
    queryKey: ['transporter-options'],
    queryFn: async () => {
      const res = await transportMasterApi.getAll({ all: 'true' })
      return res.success ? (res.data?.transporters || []) : []
    },
  })
  const transporterOptions: any[] = transporterOptionsData || []

  // Lightweight, unpaginated Broker/Salesperson lists for the combined
  // "Salesman / Broker Name" checklist on the Depot form (Phase 9).
  const { data: brokerOptionsData } = useQuery({
    queryKey: ['broker-options'],
    queryFn: async () => {
      const res = await brokerApi.getAll({ all: 'true' })
      return res.success ? (res.data?.brokers || []) : []
    },
  })
  const brokerOptions: any[] = brokerOptionsData || []

  const { data: salespersonOptionsData } = useQuery({
    queryKey: ['salesperson-options'],
    queryFn: async () => {
      const res = await salespersonApi.getAll({ all: 'true' })
      return res.success ? (res.data?.salespersons || []) : []
    },
  })
  const salespersonOptions: any[] = salespersonOptionsData || []

  // Lightweight, unpaginated Finished Goods (skus) list for the item pickers
  // on Conversion Formula / Price Levels forms (Phase 20a/20b).
  const { data: skuOptionsData } = useQuery({
    queryKey: ['sku-options'],
    queryFn: async () => {
      const res = await skuDetailsApi.getAll({ all: 'true' })
      return res.success ? (res.data?.skuDetails || []) : []
    },
  })
  const skuOptions: any[] = skuOptionsData || []

  // RTO Code Reference Data options for the Vehicle form's rto_id picker (Phase 13).
  const { data: rtoCodeData } = useQuery({
    queryKey: ["lookup-rto_code"],
    queryFn: async () => {
      const res = await lookupApi.getAll('rto_code', { page: 1, limit: 1000, all: "true" })
      return res.success ? (res.data.items || []).map((item: any) => ({ ...item, id: item.id ?? item.lookup_id })) : []
    },
    staleTime: 5 * 60 * 1000,
  })
  const activeRtoCodes = useMemo(() => (rtoCodeData || []).filter((r: any) => r.status === 'Active'), [rtoCodeData])

  // GST Rate / HSN Code / SAC Code dropdown options for Raw Materials (Phase
  // 16) - same Reference Data pattern as the UQC dropdown above.
  const { data: gstRateData } = useQuery({
    queryKey: ["lookup-gst_rate"],
    queryFn: async () => {
      const res = await lookupApi.getAll('gst_rate', { page: 1, limit: 1000, all: "true" })
      return res.success ? (res.data.items || []).map((item: any) => ({ ...item, id: item.id ?? item.lookup_id })) : []
    },
    staleTime: 5 * 60 * 1000,
  })
  const activeGstRates = useMemo(() => (gstRateData || []).filter((r: any) => r.status === 'Active'), [gstRateData])

  const { data: hsnCodeData } = useQuery({
    queryKey: ["lookup-hsn_code"],
    queryFn: async () => {
      const res = await lookupApi.getAll('hsn_code', { page: 1, limit: 1000, all: "true" })
      return res.success ? (res.data.items || []).map((item: any) => ({ ...item, id: item.id ?? item.lookup_id })) : []
    },
    staleTime: 5 * 60 * 1000,
  })
  const activeHsnCodes = useMemo(() => (hsnCodeData || []).filter((r: any) => r.status === 'Active'), [hsnCodeData])

  const { data: sacCodeData } = useQuery({
    queryKey: ["lookup-sac_code"],
    queryFn: async () => {
      const res = await lookupApi.getAll('sac_code', { page: 1, limit: 1000, all: "true" })
      return res.success ? (res.data.items || []).map((item: any) => ({ ...item, id: item.id ?? item.lookup_id })) : []
    },
    staleTime: 5 * 60 * 1000,
  })
  const activeSacCodes = useMemo(() => (sacCodeData || []).filter((r: any) => r.status === 'Active'), [sacCodeData])

  // Stock Category Reference Data options for the CD (Cash Discount) Rule
  // form's stock_category_id picker (Phase 22) - same Reference Data pattern
  // as GST Rate/HSN/SAC above.
  const { data: stockCategoryData } = useQuery({
    queryKey: ["lookup-stock_category"],
    queryFn: async () => {
      const res = await lookupApi.getAll('stock_category', { page: 1, limit: 1000, all: "true" })
      return res.success ? (res.data.items || []).map((item: any) => ({ ...item, id: item.id ?? item.lookup_id })) : []
    },
    staleTime: 5 * 60 * 1000,
  })
  const activeStockCategories = useMemo(() => (stockCategoryData || []).filter((r: any) => r.status === 'Active'), [stockCategoryData])

  // Oil Type / UQC Reference Data options for the Finished Goods (SKU) form
  // (Phase 18 + Phase 3 fold-in) - same Reference Data pattern as above.
  const { data: oilTypeData } = useQuery({
    queryKey: ["lookup-oil_type"],
    queryFn: async () => {
      const res = await lookupApi.getAll('oil_type', { page: 1, limit: 1000, all: "true" })
      return res.success ? (res.data.items || []).map((item: any) => ({ ...item, id: item.id ?? item.lookup_id })) : []
    },
    staleTime: 5 * 60 * 1000,
  })
  const activeOilTypes = useMemo(() => (oilTypeData || []).filter((r: any) => r.status === 'Active'), [oilTypeData])

  const { data: uqcData } = useQuery({
    queryKey: ["lookup-uqc"],
    queryFn: async () => {
      const res = await lookupApi.getAll('uqc', { page: 1, limit: 1000, all: "true" })
      return res.success ? (res.data.items || []).map((item: any) => ({ ...item, id: item.id ?? item.lookup_id })) : []
    },
    staleTime: 5 * 60 * 1000,
  })
  const activeUqcCodes = useMemo(() => (uqcData || []).filter((r: any) => r.status === 'Active'), [uqcData])
  const pendingSkus: any[] = pendingSkuData || []
  const pendingVehicles: any[] = pendingVehiclesData || []
  const pendingDrivers: any[] = pendingDriversData || []
  const pendingTransporters: any[] = pendingTransportData || []

  // Depots
  const {
    data: depotData,
    fetchNextPage: fetchNextDepot,
    hasNextPage: hasNextDepot,
    isFetchingNextPage: isFetchingNextDepot,
    isLoading: isDepotLoading,
    refetch: refetchDepot,
  } = useInfiniteQuery({
    queryKey: ["master-depots", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await depotApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" })
      return res.success ? res.data : { depots: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.depots?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  // All active depots for SKU form (not filtered by searchTerm)
  const { data: allActiveDepotsData } = useQuery({
    queryKey: ["all-active-depots"],
    queryFn: async () => {
      const res = await depotApi.getAll({ page: 1, limit: 1000, all: "true" })
      return res.success ? (res.data.depots || []) : []
    },
    staleTime: 5 * 60 * 1000,
  })
  const activeDepots = useMemo(
    () => (allActiveDepotsData || []).filter((d: Depot) => d.status === 'Active'),
    [allActiveDepotsData]
  )
  // "Belongs to Which Godown" options - exactly these 5, sourced from the real
  // Depot records (never a hardcoded id list, in case they get re-seeded).
  const godownDepots = useMemo(
    () => activeDepots.filter((d: any) => GODOWN_NAMES.includes(d.depot_name)),
    [activeDepots]
  )

  // States list - always fetched (backs dropdowns everywhere)
  const {
    data: statesData,
    isLoading: isStatesLoading,
    refetch: refetchStates,
  } = useQuery({
    queryKey: ["master-states"],
    queryFn: async () => {
      const res = await stateApi.getAll({ page: 1, limit: 1000, all: "true" })
      return res.success ? (res.data.states || []) : []
    },
  })
  const states = useMemo(() => statesData || [], [statesData])
  const activeStates = useMemo(() => states.filter((s: any) => s.status === 'Active'), [states])

  // GST Registration Status/Type dropdown options - sourced from Reference Data
  // (simple_lookups), never hardcoded, same pattern as activeStates above.
  const { data: gstRegStatusData } = useQuery({
    queryKey: ["lookup-is_gst_registered"],
    queryFn: async () => {
      const res = await lookupApi.getAll('is_gst_registered', { page: 1, limit: 1000, all: "true" })
      return res.success ? (res.data.items || []) : []
    },
    staleTime: 5 * 60 * 1000,
  })
  const activeGstRegStatuses = useMemo(
    () => (gstRegStatusData || []).filter((r: any) => r.status === 'Active'),
    [gstRegStatusData]
  )
  const { data: gstRegTypeData } = useQuery({
    queryKey: ["lookup-gst_registration_type"],
    queryFn: async () => {
      const res = await lookupApi.getAll('gst_registration_type', { page: 1, limit: 1000, all: "true" })
      return res.success ? (res.data.items || []) : []
    },
    staleTime: 5 * 60 * 1000,
  })
  const activeGstRegTypes = useMemo(
    () => (gstRegTypeData || []).filter((r: any) => r.status === 'Active'),
    [gstRegTypeData]
  )

  // MSME Registration Type / FSSAI Licence Type dropdown options - same
  // Reference Data pattern as the GST dropdowns above.
  const { data: msmeRegTypeData } = useQuery({
    queryKey: ["lookup-msme_registration_type"],
    queryFn: async () => {
      const res = await lookupApi.getAll('msme_registration_type', { page: 1, limit: 1000, all: "true" })
      return res.success ? (res.data.items || []) : []
    },
    staleTime: 5 * 60 * 1000,
  })
  const activeMsmeRegTypes = useMemo(
    () => (msmeRegTypeData || []).filter((r: any) => r.status === 'Active'),
    [msmeRegTypeData]
  )
  const { data: fssaiLicenceTypeData } = useQuery({
    queryKey: ["lookup-fssai_licence_type"],
    queryFn: async () => {
      const res = await lookupApi.getAll('fssai_licence_type', { page: 1, limit: 1000, all: "true" })
      return res.success ? (res.data.items || []) : []
    },
    staleTime: 5 * 60 * 1000,
  })
  const activeFssaiLicenceTypes = useMemo(
    () => (fssaiLicenceTypeData || []).filter((r: any) => r.status === 'Active'),
    [fssaiLicenceTypeData]
  )

  // Bank Name dropdown options - Reference Data only, free text is deliberately
  // not allowed (same pattern as every other Reference-Data-sourced dropdown).
  const { data: bankNameData } = useQuery({
    queryKey: ["lookup-bank_name"],
    queryFn: async () => { const res = await lookupApi.getAll('bank_name', { page: 1, limit: 1000, all: "true" }); return res.success ? (res.data.items || []) : [] },
    staleTime: 5 * 60 * 1000,
  })
  const activeBankNames = useMemo(() => (bankNameData || []).filter((r: any) => r.status === 'Active'), [bankNameData])







  // All active transporters for Vehicle form (not filtered by searchTerm)
  const { data: allActiveTransportersData } = useQuery({
    queryKey: ["all-active-transporters"],
    queryFn: async () => {
      const res = await transportMasterApi.getAll({ page: 1, limit: 1000, all: "true" })
      return res.success ? (res.data.transporters || []) : []
    },
    staleTime: 5 * 60 * 1000,
  })
  const activeTransporters = useMemo(
    () => (allActiveTransportersData || []).filter((t: any) => t.status === 'Active'),
    [allActiveTransportersData]
  )
  const sortedVehicleTransporters = useMemo<string[]>(
    () => {
      const names: string[] = (activeTransporters || [])
        .map((t: any) => t.transporter_name?.trim())
        .filter((name: any): name is string => typeof name === "string" && name.length > 0)

      const sorted = Array.from(new Set<string>(names)).sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base", numeric: true })
      )

      // Always offer the two built-in options at the top, ahead of the transporter
      // master list (matches the Transporter dropdown on the Actual Dispatch stage).
      const builtIns = ["Company Vehicle", "Party Vehicle"]
      const rest = sorted.filter((n) => !builtIns.includes(n))
      return [...builtIns, ...rest]
    },
    [activeTransporters]
  )

  // Brokers
  const {
    data: brokerData,
    fetchNextPage: fetchNextBroker,
    hasNextPage: hasNextBroker,
    isFetchingNextPage: isFetchingNextBroker,
    isLoading: isBrokerLoading,
    refetch: refetchBroker,
  } = useInfiniteQuery({
    queryKey: ["master-brokers", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await brokerApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" })
      return res.success ? res.data : { brokers: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.brokers?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  // Salespersons
  const {
    data: salespersonData,
    fetchNextPage: fetchNextSalesperson,
    hasNextPage: hasNextSalesperson,
    isFetchingNextPage: isFetchingNextSalesperson,
    isLoading: isSalespersonLoading,
    refetch: refetchSalesperson,
  } = useInfiniteQuery({
    queryKey: ["master-salespersons", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await salespersonApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" })
      return res.success ? res.data : { salespersons: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.salespersons?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  // Ledger Groups
  const {
    data: ledgerGroupData,
    fetchNextPage: fetchNextLedgerGroup,
    hasNextPage: hasNextLedgerGroup,
    isFetchingNextPage: isFetchingNextLedgerGroup,
    isLoading: isLedgerGroupLoading,
    refetch: refetchLedgerGroup,
  } = useInfiniteQuery({
    queryKey: ["master-ledger-groups", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await ledgerGroupApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" })
      return res.success ? res.data : { ledger_groups: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.ledger_groups?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  // Stock Groups
  const {
    data: stockGroupData,
    fetchNextPage: fetchNextStockGroup,
    hasNextPage: hasNextStockGroup,
    isFetchingNextPage: isFetchingNextStockGroup,
    isLoading: isStockGroupLoading,
    refetch: refetchStockGroup,
  } = useInfiniteQuery({
    queryKey: ["master-stock-groups", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await stockGroupApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" })
      return res.success ? res.data : { stock_groups: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.stock_groups?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  // Units
  const {
    data: unitData,
    fetchNextPage: fetchNextUnit,
    hasNextPage: hasNextUnit,
    isFetchingNextPage: isFetchingNextUnit,
    isLoading: isUnitLoading,
    refetch: refetchUnit,
  } = useInfiniteQuery({
    queryKey: ["master-units", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await unitApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" })
      return res.success ? res.data : { units: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.units?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  // Raw Materials
  const {
    data: rawMaterialData,
    fetchNextPage: fetchNextRawMaterial,
    hasNextPage: hasNextRawMaterial,
    isFetchingNextPage: isFetchingNextRawMaterial,
    isLoading: isRawMaterialLoading,
    refetch: refetchRawMaterial,
  } = useInfiniteQuery({
    queryKey: ["master-raw-materials", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await rawMaterialApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" })
      return res.success ? res.data : { raw_materials: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.raw_materials?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  // Semi-Finished Goods
  const {
    data: semiFinishedGoodData,
    fetchNextPage: fetchNextSemiFinishedGood,
    hasNextPage: hasNextSemiFinishedGood,
    isFetchingNextPage: isFetchingNextSemiFinishedGood,
    isLoading: isSemiFinishedGoodLoading,
    refetch: refetchSemiFinishedGood,
  } = useInfiniteQuery({
    queryKey: ["master-semi-finished-goods", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await semiFinishedGoodApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" })
      return res.success ? res.data : { semi_finished_goods: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.semi_finished_goods?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  // Insurance Details
  const {
    data: insuranceDetailData,
    fetchNextPage: fetchNextInsuranceDetail,
    hasNextPage: hasNextInsuranceDetail,
    isFetchingNextPage: isFetchingNextInsuranceDetail,
    isLoading: isInsuranceDetailLoading,
    refetch: refetchInsuranceDetail,
  } = useInfiniteQuery({
    queryKey: ["master-insurance-details", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await insuranceDetailApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" })
      return res.success ? res.data : { insurance_details: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.insurance_details?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  // Conversion Formulas
  const {
    data: conversionFormulaData,
    fetchNextPage: fetchNextConversionFormula,
    hasNextPage: hasNextConversionFormula,
    isFetchingNextPage: isFetchingNextConversionFormula,
    isLoading: isConversionFormulaLoading,
    refetch: refetchConversionFormula,
  } = useInfiniteQuery({
    queryKey: ["master-conversion-formulas", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await conversionFormulaApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" })
      return res.success ? res.data : { conversion_formulas: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.conversion_formulas?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  // Price Levels
  const {
    data: priceLevelData,
    fetchNextPage: fetchNextPriceLevel,
    hasNextPage: hasNextPriceLevel,
    isFetchingNextPage: isFetchingNextPriceLevel,
    isLoading: isPriceLevelLoading,
    refetch: refetchPriceLevel,
  } = useInfiniteQuery({
    queryKey: ["master-price-levels", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await priceLevelApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" })
      return res.success ? res.data : { price_levels: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.price_levels?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  // Petrol Pumps
  const {
    data: petrolPumpData,
    fetchNextPage: fetchNextPetrolPump,
    hasNextPage: hasNextPetrolPump,
    isFetchingNextPage: isFetchingNextPetrolPump,
    isLoading: isPetrolPumpLoading,
    refetch: refetchPetrolPump,
  } = useInfiniteQuery({
    queryKey: ["master-petrol-pumps", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await petrolPumpApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" })
      return res.success ? res.data : { petrol_pumps: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.petrol_pumps?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  // CD (Cash Discount) Rules
  const {
    data: cdRuleData,
    fetchNextPage: fetchNextCdRule,
    hasNextPage: hasNextCdRule,
    isFetchingNextPage: isFetchingNextCdRule,
    isLoading: isCdRuleLoading,
    refetch: refetchCdRule,
  } = useInfiniteQuery({
    queryKey: ["master-cd-rules", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await cdRuleApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" })
      return res.success ? res.data : { cd_rules: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.cd_rules?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  // TDS Rules (Phase 23 - bare-minimum placeholder)
  const {
    data: tdsRuleData,
    fetchNextPage: fetchNextTdsRule,
    hasNextPage: hasNextTdsRule,
    isFetchingNextPage: isFetchingNextTdsRule,
    isLoading: isTdsRuleLoading,
    refetch: refetchTdsRule,
  } = useInfiniteQuery({
    queryKey: ["master-tds-rules", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await tdsRuleApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" })
      return res.success ? res.data : { tds_rules: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.tds_rules?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  // Bhada Rates (Phase 24 - bare-minimum placeholder)
  const {
    data: bhadaRateData,
    fetchNextPage: fetchNextBhadaRate,
    hasNextPage: hasNextBhadaRate,
    isFetchingNextPage: isFetchingNextBhadaRate,
    isLoading: isBhadaRateLoading,
    refetch: refetchBhadaRate,
  } = useInfiniteQuery({
    queryKey: ["master-bhada-rates", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await bhadaRateApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" })
      return res.success ? res.data : { bhada_rates: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.bhada_rates?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  // SKU Details
  const {
    data: skuData,
    fetchNextPage: fetchNextSku,
    hasNextPage: hasNextSku,
    isFetchingNextPage: isFetchingNextSku,
    isLoading: isSkuLoading,
    refetch: refetchSku,
  } = useInfiniteQuery({
    queryKey: ["master-sku-details", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await skuDetailsApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" })
      return res.success ? res.data : { skuDetails: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.skuDetails?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  // SKU Selling Price
  const {
    data: skuSellingPriceData,
    fetchNextPage: fetchNextSkuSellingPrice,
    hasNextPage: hasNextSkuSellingPrice,
    isFetchingNextPage: isFetchingNextSkuSellingPrice,
    isLoading: isSkuSellingPriceLoading,
    refetch: refetchSkuSellingPrice,
  } = useInfiniteQuery({
    queryKey: ["master-sku-selling-price", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await skuSellingPriceApi.getAll({ page: pageParam, limit: 20, search: searchTerm })
      return res.success ? res.data : { skus: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.skus?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  // 7. Driver Data (Infinite Query)
  const {
    data: driverData,
    fetchNextPage: fetchNextDriver,
    hasNextPage: hasNextDriver,
    isFetchingNextPage: isFetchingNextDriver,
    isLoading: isDriverLoading,
    refetch: refetchDriver,
  } = useInfiniteQuery({
    queryKey: ["master-drivers", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await driverMasterApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" })
      return res.success ? res.data : { drivers: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.drivers?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  // 8. Transport Data (Infinite Query)
  const {
    data: transportData,
    fetchNextPage: fetchNextTransport,
    hasNextPage: hasNextTransport,
    isFetchingNextPage: isFetchingNextTransport,
    isLoading: isTransportLoading,
    refetch: refetchTransport,
  } = useInfiniteQuery({
    queryKey: ["master-transporters", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await transportMasterApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" })
      return res.success ? res.data : { transporters: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.transporters?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  const [latestVarCalc, setLatestVarCalc] = useState<any>(null)

  // Memoized data lists
  const customers = useMemo(() => customerData?.pages.flatMap(p => p?.customers || []) || [], [customerData])
  const depots = useMemo(() => depotData?.pages.flatMap(p => p?.depots || []) || [], [depotData])
  const brokers = useMemo(() => brokerData?.pages.flatMap(p => p?.brokers || []) || [], [brokerData])
  const salespersons = useMemo(() => salespersonData?.pages.flatMap(p => p?.salespersons || []) || [], [salespersonData])
  const ledgerGroupsList = useMemo(() => ledgerGroupData?.pages.flatMap(p => p?.ledger_groups || []) || [], [ledgerGroupData])
  const stockGroupsList = useMemo(() => stockGroupData?.pages.flatMap(p => p?.stock_groups || []) || [], [stockGroupData])
  const unitsList = useMemo(() => unitData?.pages.flatMap(p => p?.units || []) || [], [unitData])
  const rawMaterialsList = useMemo(() => rawMaterialData?.pages.flatMap(p => p?.raw_materials || []) || [], [rawMaterialData])
  const semiFinishedGoodsList = useMemo(() => semiFinishedGoodData?.pages.flatMap(p => p?.semi_finished_goods || []) || [], [semiFinishedGoodData])
  const insuranceDetailsList = useMemo(() => insuranceDetailData?.pages.flatMap(p => p?.insurance_details || []) || [], [insuranceDetailData])
  const conversionFormulasList = useMemo(() => conversionFormulaData?.pages.flatMap(p => p?.conversion_formulas || []) || [], [conversionFormulaData])
  const priceLevelsList = useMemo(() => priceLevelData?.pages.flatMap(p => p?.price_levels || []) || [], [priceLevelData])
  const petrolPumpsList = useMemo(() => petrolPumpData?.pages.flatMap(p => p?.petrol_pumps || []) || [], [petrolPumpData])
  const cdRulesList = useMemo(() => cdRuleData?.pages.flatMap(p => p?.cd_rules || []) || [], [cdRuleData])
  const tdsRulesList = useMemo(() => tdsRuleData?.pages.flatMap(p => p?.tds_rules || []) || [], [tdsRuleData])
  const bhadaRatesList = useMemo(() => bhadaRateData?.pages.flatMap(p => p?.bhada_rates || []) || [], [bhadaRateData])
  const transporters = useMemo(() => transportData?.pages.flatMap(p => p?.transporters || []) || [], [transportData])
  const skuDetails = useMemo(() => skuData?.pages.flatMap(p => p?.skuDetails || []) || [], [skuData])
  const skuSellingPrices = useMemo(() => skuSellingPriceData?.pages.flatMap(p => p?.skus || []) || [], [skuSellingPriceData])
  const drivers = useMemo(() => driverData?.pages.flatMap(p => p?.drivers || []) || [], [driverData])

  // Infinite Scroll Observers
  useEffect(() => { if (customerInView && hasNextCustomer) fetchNextCustomer() }, [customerInView, hasNextCustomer, fetchNextCustomer])
  useEffect(() => { if (depotInView && hasNextDepot) fetchNextDepot() }, [depotInView, hasNextDepot, fetchNextDepot])
  useEffect(() => { if (brokerInView && hasNextBroker) fetchNextBroker() }, [brokerInView, hasNextBroker, fetchNextBroker])
  useEffect(() => { if (salespersonInView && hasNextSalesperson) fetchNextSalesperson() }, [salespersonInView, hasNextSalesperson, fetchNextSalesperson])
  useEffect(() => { if (ledgerGroupInView && hasNextLedgerGroup) fetchNextLedgerGroup() }, [ledgerGroupInView, hasNextLedgerGroup, fetchNextLedgerGroup])
  useEffect(() => { if (stockGroupInView && hasNextStockGroup) fetchNextStockGroup() }, [stockGroupInView, hasNextStockGroup, fetchNextStockGroup])
  useEffect(() => { if (unitInView && hasNextUnit) fetchNextUnit() }, [unitInView, hasNextUnit, fetchNextUnit])
  useEffect(() => { if (rawMaterialInView && hasNextRawMaterial) fetchNextRawMaterial() }, [rawMaterialInView, hasNextRawMaterial, fetchNextRawMaterial])
  useEffect(() => { if (semiFinishedGoodInView && hasNextSemiFinishedGood) fetchNextSemiFinishedGood() }, [semiFinishedGoodInView, hasNextSemiFinishedGood, fetchNextSemiFinishedGood])
  useEffect(() => { if (insuranceDetailInView && hasNextInsuranceDetail) fetchNextInsuranceDetail() }, [insuranceDetailInView, hasNextInsuranceDetail, fetchNextInsuranceDetail])
  useEffect(() => { if (conversionFormulaInView && hasNextConversionFormula) fetchNextConversionFormula() }, [conversionFormulaInView, hasNextConversionFormula, fetchNextConversionFormula])
  useEffect(() => { if (priceLevelInView && hasNextPriceLevel) fetchNextPriceLevel() }, [priceLevelInView, hasNextPriceLevel, fetchNextPriceLevel])
  useEffect(() => { if (petrolPumpInView && hasNextPetrolPump) fetchNextPetrolPump() }, [petrolPumpInView, hasNextPetrolPump, fetchNextPetrolPump])
  useEffect(() => { if (cdRuleInView && hasNextCdRule) fetchNextCdRule() }, [cdRuleInView, hasNextCdRule, fetchNextCdRule])
  useEffect(() => { if (tdsRuleInView && hasNextTdsRule) fetchNextTdsRule() }, [tdsRuleInView, hasNextTdsRule, fetchNextTdsRule])
  useEffect(() => { if (bhadaRateInView && hasNextBhadaRate) fetchNextBhadaRate() }, [bhadaRateInView, hasNextBhadaRate, fetchNextBhadaRate])
  useEffect(() => { if (skuInView && hasNextSku) fetchNextSku() }, [skuInView, hasNextSku, fetchNextSku])
  useEffect(() => { if (skuSellingPriceInView && hasNextSkuSellingPrice) fetchNextSkuSellingPrice() }, [skuSellingPriceInView, hasNextSkuSellingPrice, fetchNextSkuSellingPrice])
  useEffect(() => { if (driverInView && hasNextDriver) fetchNextDriver() }, [driverInView, hasNextDriver, fetchNextDriver])

  // 7. Vehicle Data (Infinite Query)
  const {
    data: vehicleData,
    fetchNextPage: fetchNextVehicle,
    hasNextPage: hasNextVehicle,
    isFetchingNextPage: isFetchingNextVehicle,
    isLoading: isVehicleLoading,
    refetch: refetchVehicle,
  } = useInfiniteQuery({
    queryKey: ["vehicle_master", searchTerm],
    queryFn: ({ pageParam = 1 }) => vehicleMasterApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" }),
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.data?.vehicles?.length || 0), 0)
      return currentCount < (lastPage.data?.pagination?.total || 0) ? allPages.length + 1 : undefined
    },
    initialPageParam: 1,
  })

  const vehicles = useMemo(() => vehicleData?.pages.flatMap(p => p.data.vehicles) || [], [vehicleData])

  const uniqueVehicleTypes = useMemo(() => {
    const types = vehicles
      .map((v: any) => v?.vehicle_type?.trim())
      .filter((type: string): type is string => Boolean(type))
    return Array.from(new Set(types)).sort()
  }, [vehicles])

  useEffect(() => {
    if (vehicleInView && hasNextVehicle && !isFetchingNextVehicle) fetchNextVehicle()
  }, [vehicleInView, hasNextVehicle, isFetchingNextVehicle, fetchNextVehicle])

  useEffect(() => {
    if (driverInView && hasNextDriver && !isFetchingNextDriver) fetchNextDriver()
  }, [driverInView, hasNextDriver, isFetchingNextDriver, fetchNextDriver])

  const isLoading = isCustomerLoading || isDepotLoading || isBrokerLoading || isSalespersonLoading || isSkuLoading || isSkuSellingPriceLoading || isVehicleLoading || isDriverLoading || isTransportLoading || isLedgerGroupLoading || isStockGroupLoading || isUnitLoading || isRawMaterialLoading || isSemiFinishedGoodLoading || isInsuranceDetailLoading || isConversionFormulaLoading || isPriceLevelLoading || isPetrolPumpLoading || isCdRuleLoading || isTdsRuleLoading || isBhadaRateLoading

  // Sort states
  const [customerSort, setCustomerSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'customer_id', dir: 'asc' })
  const [depotSort, setDepotSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'depot_id', dir: 'asc' })
  const [brokerSort, setBrokerSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'broker_id', dir: 'asc' })
  const [salespersonSort, setSalespersonSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'broker_id', dir: 'asc' })
  const [vehicleSort, setVehicleSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'vehicle_master_id', dir: 'asc' })
  const [selectedVehicleType, setSelectedVehicleType] = useState<string>("all")
  const [roadTaxType, setRoadTaxType] = useState<'expiry' | 'lifetime'>('expiry')
  const [skuSort, setSkuSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'sku_code', dir: 'asc' })
  const [skuSellingPriceSort, setSkuSellingPriceSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'packing_material', dir: 'asc' })
  const [driverSort, setDriverSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'driver_master_id', dir: 'asc' })
  const [transportSort, setTransportSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'transport_master_id', dir: 'asc' })
  const [ledgerGroupSort, setLedgerGroupSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'group_code', dir: 'asc' })
  const [stockGroupSort, setStockGroupSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'group_code', dir: 'asc' })
  const [unitSort, setUnitSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'unit_code', dir: 'asc' })
  const [rawMaterialSort, setRawMaterialSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'raw_material_code', dir: 'asc' })
  const [semiFinishedGoodSort, setSemiFinishedGoodSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'semi_finished_good_code', dir: 'asc' })
  const [insuranceDetailSort, setInsuranceDetailSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'insurance_code', dir: 'asc' })
  const [conversionFormulaSort, setConversionFormulaSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'conversion_formula_code', dir: 'asc' })
  const [priceLevelSort, setPriceLevelSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'effective_date', dir: 'desc' })
  const [petrolPumpSort, setPetrolPumpSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'petrol_pump_code', dir: 'asc' })
  const [cdRuleSort, setCdRuleSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'cd_rule_code', dir: 'asc' })
  const [tdsRuleSort, setTdsRuleSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'tds_rule_code', dir: 'asc' })
    const [oilTagSort, setOilTagSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'name', dir: 'asc' })
  const [bhadaRateSort, setBhadaRateSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'bhada_rate_code', dir: 'asc' })



  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any | null>(null)
  const [deletingItem, setDeletingItem] = useState<any | null>(null)
  const [customerSubTab, setCustomerSubTab] = useState<'active' | 'pending'>('active')
  const [depotSubTab, setDepotSubTab] = useState<'active' | 'pending'>('active')
  const [brokerSubTab, setBrokerSubTab] = useState<'active' | 'pending'>('active')
  const [salespersonSubTab, setSalespersonSubTab] = useState<'active' | 'pending'>('active')
  const [ledgerGroupSubTab, setLedgerGroupSubTab] = useState<'active' | 'pending'>('active')
  const [stockGroupSubTab, setStockGroupSubTab] = useState<'active' | 'pending'>('active')
  const [unitSubTab, setUnitSubTab] = useState<'active' | 'pending'>('active')
  const [rawMaterialSubTab, setRawMaterialSubTab] = useState<'active' | 'pending'>('active')
  const [semiFinishedGoodSubTab, setSemiFinishedGoodSubTab] = useState<'active' | 'pending'>('active')
  const [insuranceDetailSubTab, setInsuranceDetailSubTab] = useState<'active' | 'pending'>('active')
  const [conversionFormulaSubTab, setConversionFormulaSubTab] = useState<'active' | 'pending'>('active')
  const [priceLevelSubTab, setPriceLevelSubTab] = useState<'active' | 'pending'>('active')
  const [petrolPumpSubTab, setPetrolPumpSubTab] = useState<'active' | 'pending'>('active')
  const [cdRuleSubTab, setCdRuleSubTab] = useState<'active' | 'pending'>('active')
  const [tdsRuleSubTab, setTdsRuleSubTab] = useState<'active' | 'pending'>('active')
  const [bhadaRateSubTab, setBhadaRateSubTab] = useState<'active' | 'pending'>('active')
  const [skuSubTab, setSkuSubTab] = useState<'active' | 'pending'>('active')
  const [vehicleSubTab, setVehicleSubTab] = useState<'active' | 'pending'>('active')
  const [driverSubTab, setDriverSubTab] = useState<'active' | 'pending'>('active')
  const [transportSubTab, setTransportSubTab] = useState<'active' | 'pending'>('active')

  const [rejectDialogContext, setRejectDialogContext] = useState<{ tab: string; id: any } | null>(null)
  const [rejectionReason, setRejectionReason] = useState("")
  const [isReviewing, setIsReviewing] = useState(false)
  const [approvalReviewModal, setApprovalReviewModal] = useState<{ tab: string; item: any } | null>(null)
  const [approvalEditData, setApprovalEditData] = useState<Record<string, any>>({})

  // Generic inline "quick add" popover for Select fields (UOM, Additional
  // UOM, Default Accounting Ledger on the Raw Materials form) - lets the
  // user create a Unit/Ledger without leaving the current dialog.
  const [quickAddDialog, setQuickAddDialog] = useState<{ type: 'unit' | 'ledger' | 'hsn_code' | 'sac_code'; onCreated: (id: number, label: string) => void } | null>(null)
  const [quickAddForm, setQuickAddForm] = useState<any>({})
  const [isQuickAdding, setIsQuickAdding] = useState(false)

  // Inline "add row" inputs for the Raw Materials form's repeatable
  // Additional UOM list (rawMaterialForm.additional_uoms) - not part of that
  // form state itself since it's just the pending entry being composed.
  const [newAdditionalUom, setNewAdditionalUom] = useState<{ uom_id: string; conversion_ratio: string }>({ uom_id: '', conversion_ratio: '' })
  // Additional UOM card starts collapsed (behind an "+ Add Additional UOM"
  // button) unless the record already has rows - a raw material with none is
  // a fully valid save, this is purely a reveal toggle.
  const [showAdditionalUomSection, setShowAdditionalUomSection] = useState(false)

  // Inline "add row" inputs for the Conversion Formula form's repeatable
  // steps list and the Price Levels form's repeatable items list - same
  // pattern as newAdditionalUom.
  const [newFormulaStep, setNewFormulaStep] = useState<{ operation: string; operand_type: string; operand_value: string }>({ operation: 'subtract', operand_type: 'literal', operand_value: '' })
  const [newPriceLevelItem, setNewPriceLevelItem] = useState<{ sku_id: string; price: string }>({ sku_id: '', price: '' })

  const openQuickAdd = async (type: 'unit' | 'ledger' | 'hsn_code' | 'sac_code', onCreated: (id: number, label: string) => void) => {
    if (type === 'hsn_code' || type === 'sac_code') {
      setQuickAddForm({ code: '', name: '', status: 'Active' })
    } else {
      const nextId = await fetchNextId(type)
      setQuickAddForm(
        type === 'unit'
          ? { unit_code: nextId, unit_name: '', status: 'Active' }
          : { ledger_code: nextId, ledger_name: '', ledger_group_id: '', status: 'Active' }
      )
    }
    setQuickAddDialog({ type, onCreated })
  }

  const submitQuickAdd = async () => {
    if (!quickAddDialog) return
    if (quickAddDialog.type === 'unit' && !quickAddForm.unit_name?.trim()) {
      toast({ title: "Error", description: "Unit Name is required", variant: "destructive" })
      return
    }
    if (quickAddDialog.type === 'ledger' && !quickAddForm.ledger_name?.trim()) {
      toast({ title: "Error", description: "Ledger Name is required", variant: "destructive" })
      return
    }
    if (quickAddDialog.type === 'sac_code') {
      if (!/^[0-9]{6}$/.test(String(quickAddForm.code || '').trim())) {
        toast({ title: "Error", description: "SAC Code must be exactly 6 numeric digits (e.g. 996511)", variant: "destructive" })
        return
      }
      if (!quickAddForm.name?.trim()) {
        toast({ title: "Error", description: "Description is required", variant: "destructive" })
        return
      }
    }
    if (quickAddDialog.type === 'hsn_code') {
      if (!/^[0-9]{8}$/.test(String(quickAddForm.code || '').trim())) {
        toast({ title: "Error", description: "HSN Code must be exactly 8 numeric digits (e.g. 73269099)", variant: "destructive" })
        return
      }
      if (!quickAddForm.name?.trim()) {
        toast({ title: "Error", description: "Description is required", variant: "destructive" })
        return
      }
    }
    setIsQuickAdding(true)
    try {
      const res = quickAddDialog.type === 'unit'
        ? await unitApi.create(quickAddForm)
        : quickAddDialog.type === 'ledger'
        ? await ledgerApi.create(quickAddForm)
        : await lookupApi.create(quickAddDialog.type, quickAddForm)
      if (res?.success) {
        const created = res.data
        const label = quickAddDialog.type === 'unit' ? created.unit_name : quickAddDialog.type === 'ledger' ? created.ledger_name : created.name
        const queryKey = quickAddDialog.type === 'unit' ? ['unit-options'] : quickAddDialog.type === 'ledger' ? ['ledger-options'] : [`lookup-${quickAddDialog.type}`]
        // Patch the cache directly (rather than just invalidating) so the new
        // row's label renders immediately even if it's pending approval and
        // wouldn't otherwise pass the options query's approved-only filter.
        queryClient.setQueryData(queryKey, (old: any[] | undefined) => [...(old || []), created])
        toast({ title: "Success", description: res.message || "Created successfully" })
        quickAddDialog.onCreated(created.id, label)
        setQuickAddDialog(null)
      } else {
        toast({ title: "Error", description: res?.message || "Failed to create", variant: "destructive" })
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to create", variant: "destructive" })
    } finally {
      setIsQuickAdding(false)
    }
  }

  // Read-only GST history for the customer currently open in the Add/Edit dialog
  // (only meaningful for an existing customer, i.e. editingItem is set).
  const { data: customerGstHistoryData } = useQuery({
    queryKey: ["customer-gst-history", editingItem?.id],
    queryFn: async () => {
      const res = await customerApi.getGstHistory(editingItem.id)
      return res.success ? (res.data || []) : []
    },
    enabled: activeTab === 'customers' && (isDialogOpen || !!approvalReviewModal) && !!editingItem?.id,
  })

  // Form states
  const [customerForm, setCustomerForm] = useState<Partial<Customer>>({
    customer_id: "",
    customer_name: "",
    status: "Active",
    contact_person: "",
    contact: "",
    email: "",
    address_line_1: "",
    address_line_2: "",
    state: "",
    pincode: "",
    pan: "",
    gstin: "",
    gst_registered: "",
    gst_registration_type: "",
    gst_registration_wef: "",
    msme_registration_no: "",
    msme_registration_type: "",
    msme_registration_wef: "",
    fssai_no: "",
    fssai_valid_upto: "",
    fssai_licence_type: "",
    aadhaar_upload: "",
    pan_upload: "",
    gst_certificate_upload: "",
    msme_certificate_upload: "",
    fssai_certificate_upload: "",
    addresses: [],
    godown_ids: [],
    is_required_for_commitment: "No",
    bank_accounts: []
  })

  const [depotForm, setDepotForm] = useState<Partial<Depot>>({
    depot_id: "",
    status: "Active",
    depot_name: "",
    depot_address: "",
    state: "",
    salesman_broker_name: "",
    agent_tags: [],
    agreement_paper_upload: "",
    depot_owner_gst_certificate_upload: "",
    pan_card_upload: "",
    aadhaar_card_upload: "",
  })


  const [brokerForm, setBrokerForm] = useState<Partial<Broker>>({
    broker_id: "",
    status: "Active",
    salesman_name: "",
    email_id: "",
    mobile_no: "",
    depot_name: "",
    depot_id: "",
    ledger_group_id: "",
    ...blankPartyParityFields(),
  })

  const [salespersonForm, setSalespersonForm] = useState<any>({
    broker_id: '',
    salesman_name: '',
    status: 'Active',
    mobile_no: '',
    email_id: '',
    ledger_group_id: '',
    employee_id: '',
    ...blankPartyParityFields(),
  })

  const [ledgerGroupForm, setLedgerGroupForm] = useState<any>({
    group_code: '',
    group_name: '',
    status: 'Active',
  })

  const [stockGroupForm, setStockGroupForm] = useState<any>({
    group_code: '',
    group_name: '',
    status: 'Active',
  })

  const [unitForm, setUnitForm] = useState<any>({
    unit_code: '',
    unit_name: '',
    status: 'Active',
  })

  const [rawMaterialForm, setRawMaterialForm] = useState<any>({
    raw_material_code: '',
    name: '',
    main_uom_id: '',
    stock_group_id: '',
    additional_uoms: [] as RawMaterialAdditionalUom[],
    type_of_supply: '',
    gst_rate_id: '',
    hsn_code_id: '',
    sac_code_id: '',
    default_accounting_ledger_id: '',
    batch_tracking_enabled: false,
    status: 'Active',
  })

  const [semiFinishedGoodForm, setSemiFinishedGoodForm] = useState<any>({
    semi_finished_good_code: '',
    name: '',
    main_uom_id: '',
    stock_group_id: '',
    type_of_supply: '',
    gst_rate_id: '',
    hsn_code_id: '',
    sac_code_id: '',
    default_accounting_ledger_id: '',
    batch_tracking_enabled: false,
    oil_filling_per_unit: '',
    filling_unit_id: '',
    converted_kg: '',
    packing_weight_per_main_unit: '',
    packing_weight_unit_id: '',
    weight_difference: '',
    standard_weight: '',
    standard_weight_unit_id: '',
    status: 'Active',
  })

  const [insuranceCustomerSearch, setInsuranceCustomerSearch] = useState("");
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [insuranceDetailForm, setInsuranceDetailForm] = useState<any>({
    insurance_code: '',
    status: 'Active',
    insurance_company_name: '',
    short_name: '',
    policy_number: '',
    valid_from: '',
    valid_upto: '',
    type_of_policy: '',
    sum_insured: '',
    owner_type: 'Company',
    customer_ids: [] as number[],
  })

  const [conversionFormulaForm, setConversionFormulaForm] = useState<any>({
    conversion_formula_code: '',
    base_item_id: '',
    child_item_id: '',
    status: 'Active',
    steps: [] as { step_order: number; operation: string; operand_type: string; operand_value: string }[],
  })

  const [priceLevelForm, setPriceLevelForm] = useState<any>({
    price_level_code: '',
    effective_date: '',
    status: 'Active',
    items: [] as { sku_id: string; price: string }[],
  })

  const [petrolPumpForm, setPetrolPumpForm] = useState<any>({
    petrol_pump_code: '',
    petrol_pump_name: '',
    email_id: '',
    mobile_no: '',
    ledger_group_id: '',
    status: 'Active',
    ...blankPartyParityFields(),
  })

  const [cdRuleForm, setCdRuleForm] = useState<any>({
    cd_rule_code: '',
    wef_date: '',
    stock_category_id: '',
    discount_rate_per_main_uom: '',
    payment_condition_days: '',
    status: 'Active',
  })

  
    const { data: oilTagsData, isLoading: isOilTagsLoading, refetch: refetchOilTag } = useQuery({
      queryKey: ["oil_tags", searchTerm],
      queryFn: async () => {
        const res = await oilTagApi.getAll({ page: 1, limit: 1000, search: searchTerm })
        return res.success ? (res.data.items || []) : []
      },
      enabled: activeTab === 'oil_tags',
    })
    const oilTagsList = useMemo(() => oilTagsData || [], [oilTagsData])

    const { data: pendingOilTagsData, refetch: refetchPendingOilTags } = useQuery({
      queryKey: ["oil_tags_pending"],
      queryFn: async () => {
        const res = await oilTagApi.getPending()
        return res.success ? (res.data.items || []) : []
      },
      enabled: activeTab === 'oil_tags',
    })
    const pendingOilTags = useMemo(() => pendingOilTagsData || [], [pendingOilTagsData])

    const sortedOilTags = useMemo(() => {
      let sortable = [...oilTagsList]
      if (oilTagSort.col) {
        sortable.sort((a, b) => {
          if (a[oilTagSort.col] < b[oilTagSort.col]) return oilTagSort.dir === 'asc' ? -1 : 1
          if (a[oilTagSort.col] > b[oilTagSort.col]) return oilTagSort.dir === 'asc' ? 1 : -1
          return 0
        })
      }
      return sortable
    }, [oilTagsList, oilTagSort])

    const [oilTagForm, setOilTagForm] = useState<any>({ name: "", status: "Active" })

    const [tdsRuleForm, setTdsRuleForm] = useState<any>({
    tds_rule_code: '',
    name: '',
    rate: '',
    status: 'Active',
  })

  const [bhadaRateForm, setBhadaRateForm] = useState<any>({
    bhada_rate_code: '',
    name: '',
    rate: '',
    status: 'Active',
  })

  const [vehicleForm, setVehicleForm] = useState<any>({
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
    life_time_tax_image: ''
  })
  const [vehicleFormErrors, setVehicleFormErrors] = useState<{ registration_no?: string; vehicle_type?: string; transporter?: string; state_permit_image?: string }>({})
  const [customerFormErrors, setCustomerFormErrors] = useState<{ pan?: string; gstin?: string; pincode?: string }>({})
  // Shared PAN/GSTIN error state for the Broker/Salesperson/Transport/Petrol
  // Pump forms (Customer-Master field parity) - only one of these forms is
  // ever open at a time, so one error object covers all four.
  const [partyFormErrors, setPartyFormErrors] = useState<{ pan?: string; gstin?: string }>({})
  const [addressErrors, setAddressErrors] = useState<Record<number, string | undefined>>({})
  const [bankAccountErrors, setBankAccountErrors] = useState<Record<number, string | undefined>>({})

  const [driverForm, setDriverForm] = useState<Partial<Driver>>({
    driver_master_id: "",
    status: "Active",
    driving_licence_no: "",
    driving_licence_type: "",
    valid_upto: "",
    rto: "",
    rto_id: null,
    trans_valid_upto: "",
    lmv_valid_upto: "",
    driver_name: "",
    mobile_no: "",
    email_id: "",
    address_line1: "",
    state: "",
    pincode: "",
    aadhaar_no: "",
    pan_no: "",
    aadhaar_upload: "",
    dl_upload: ""
  })

  const [transportForm, setTransportForm] = useState<Partial<Transport>>({
    ...blankPartyParityFields(),
    transport_master_id: "",
    status: "Active",
    transporter_name: "",
    contact_person: "",
    contact_number: "",
    email_id: "",
    address_line1: "",
    state_id: null,
    pincode: "",
    ledger_group_id: "",
    bilty_copy_upload: "",
    linked_customer_id: "",
  })

  const [skuDetailsForm, setSkuDetailsForm] = useState<Partial<SkuDetail>>({
    status: "Active",
    sku_code: "",
    sku_name: "",
    main_uom: "",
    alternate_uom: "",
    nos_per_main_uom: "",
    units: "",
    oil_filling_per_unit: "",
    filling_units: "",
    converted_kg: "",
    packing_weight_per_main_unit: "",
    weight_difference: "",
    sku_weight: "",
    packing_weight: "",
    gross_weight: "",
    tag_name: "",
    semi_finished_good_id: "",
    oil_tag_id: "",
      oil_tag_id: "",
        oil_type_id: "",
    stock_category_id: "",
    main_uom_id: "",
    alternate_uom_id: "",
    type_of_supply: "",
    gst_rate_id: "",
    hsn_code_id: "",
    sac_code_id: "",
    uqc_id: "",
  })

  const [skuSellingPriceForm, setSkuSellingPrice] = useState<Partial<SkuSellingPrice>>({
    id: 0,
    packing_material: "",
    sku_weight: 0,
    sku_unit: "",
    conversion_formula: 0,
    sku_weight_in_gm: 0,
    packing_material_weight_in_gm: 0,
    net_oil_in_gm: 0,
    packing_cost: 0,
    var: "",
    landing_cost: 0,
    selling_cost: 0,
    margin: "",
    actual_margin: 0
  })

  // --- Data Fetching ---

  const fetchVarCalc = useCallback(async () => {
    try {
      const varRes = await varCalcApi.getLatest()
      if (varRes.success) setLatestVarCalc(varRes.data)
    } catch (e) { console.error("Var calc fetch failed") }
  }, [])

  useEffect(() => {
    if (activeTab === "sku_selling_price") fetchVarCalc()
  }, [activeTab, fetchVarCalc])

  // --- Handlers ---

  const resetForms = () => {
    setCustomerForm({
      customer_id: "",
      customer_name: "",
      status: "Active",
      contact_person: "",
      contact: "",
      email: "",
      address_line_1: "",
      address_line_2: "",
      state: "",
      pincode: "",
      pan: "",
      gstin: "",
      gst_registered: "",
      gst_registration_type: "",
      gst_registration_wef: "",
      msme_registration_no: "",
      msme_registration_type: "",
      msme_registration_wef: "",
      fssai_no: "",
      fssai_valid_upto: "",
      fssai_licence_type: "",
      aadhaar_upload: "",
      pan_upload: "",
      gst_certificate_upload: "",
      msme_certificate_upload: "",
      fssai_certificate_upload: "",
      addresses: [],
      godown_ids: [],
      is_required_for_commitment: "No",
      bank_accounts: []
    })
    setAddressErrors({})
    setBankAccountErrors({})
    setDepotForm({
      depot_id: "",
      status: "Active",
      depot_name: "",
      depot_address: "",
      state: "",
      salesman_broker_name: "",
      agent_tags: [],
      agreement_paper_upload: "",
      depot_owner_gst_certificate_upload: "",
      pan_card_upload: "",
      aadhaar_card_upload: "",
    })
    setBrokerForm({
      broker_id: "",
      status: "Active",
      salesman_name: "",
      email_id: "",
      mobile_no: "",
      depot_name: "",
      depot_id: "",
      ledger_group_id: "",
      ...blankPartyParityFields(),
    })
    setSalespersonForm({
      broker_id: "",
      status: "Active",
      salesman_name: "",
      email_id: "",
      mobile_no: "",
      depot_name: "",
      depot_id: "",
      ledger_group_id: "",
      employee_id: "",
      ...blankPartyParityFields(),
    })
    setLedgerGroupForm({ group_code: "", group_name: "", status: "Active" })
    setStockGroupForm({ group_code: "", group_name: "", status: "Active" })
    setUnitForm({ unit_code: "", unit_name: "", status: "Active" })
    setRawMaterialForm({ raw_material_code: "", name: "", main_uom_id: "", stock_group_id: "", additional_uoms: [], type_of_supply: "", gst_rate_id: "", hsn_code_id: "", sac_code_id: "", default_accounting_ledger_id: "", batch_tracking_enabled: false, status: "Active" })
    setNewAdditionalUom({ uom_id: '', conversion_ratio: '' })
    setShowAdditionalUomSection(false)
    setSemiFinishedGoodForm({ semi_finished_good_code: "", name: "", main_uom_id: "", stock_group_id: "", type_of_supply: "", gst_rate_id: "", hsn_code_id: "", sac_code_id: "", default_accounting_ledger_id: "", batch_tracking_enabled: false, oil_tag_id: "", oil_filling_per_unit: "", filling_unit_id: "", converted_kg: "", packing_weight_per_main_unit: "", packing_weight_unit_id: "", weight_difference: "", standard_weight: "", standard_weight_unit_id: "", status: "Active" })
    setInsuranceDetailForm({ insurance_code: "", status: "Active", insurance_company_name: "", short_name: "", policy_number: "", valid_from: "", valid_upto: "", type_of_policy: "", sum_insured: "", owner_type: "Company", customer_ids: [] })
    setConversionFormulaForm({ conversion_formula_code: "", base_item_id: "", child_item_id: "", status: "Active", steps: [] })
    setNewFormulaStep({ operation: 'subtract', operand_type: 'literal', operand_value: '' })
    setPriceLevelForm({ price_level_code: "", effective_date: "", status: "Active", items: [] })
    setNewPriceLevelItem({ sku_id: '', price: '' })
    setPetrolPumpForm({ petrol_pump_code: "", petrol_pump_name: "", email_id: "", mobile_no: "", ledger_group_id: "", status: "Active", ...blankPartyParityFields() })
    setCdRuleForm({ cd_rule_code: "", wef_date: "", stock_category_id: "", discount_rate_per_main_uom: "", payment_condition_days: "", status: "Active" })
    setTdsRuleForm({ tds_rule_code: "", name: "", rate: "", status: "Active" })
      setOilTagForm({ name: "", status: "Active" })
    setBhadaRateForm({ bhada_rate_code: "", name: "", rate: "", status: "Active" })
    setSkuDetailsForm({
      status: "Active",
      sku_code: "",
      sku_name: "",
      main_uom: "",
      alternate_uom: "",
      nos_per_main_uom: "",
      units: "",
      oil_filling_per_unit: "",
      filling_units: "",
      converted_kg: "",
      packing_weight_per_main_unit: "",
      weight_difference: "",
      sku_weight: "",
      packing_weight: "",
      gross_weight: "",
      semi_finished_good_id: "",
      oil_type_id: "",
      stock_category_id: "",
      main_uom_id: "",
      alternate_uom_id: "",
      type_of_supply: "",
      gst_rate_id: "",
      hsn_code_id: "",
      sac_code_id: "",
      uqc_id: "",
    })
    setVehicleForm({
      vehicle_master_id: '',
      registration_no: '',
      vehicle_type: '',
      transporter: '',
      rto: '',
      rto_id: '',
      additional_transporter_ids: [],
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
      life_time_tax_image: ''
    })
    setVehicleFormErrors({})
    setRoadTaxType('expiry')
    setDriverForm({
      driver_master_id: "",
      status: "Active",
      driving_licence_no: "",
      driving_licence_type: "",
      valid_upto: "",
      rto: "",
      rto_id: null,
      trans_valid_upto: "",
      lmv_valid_upto: "",
      driver_name: "",
      mobile_no: "",
      email_id: "",
      address_line1: "",
      state: "",
      pincode: "",
      aadhaar_no: "",
      pan_no: "",
      aadhaar_upload: ""
    })
    setTransportForm({
      ...blankPartyParityFields(),
      transport_master_id: "",
      status: "Active",
      transporter_name: "",
      contact_person: "",
      contact_number: "",
      email_id: "",
      address_line1: "",
      state_id: null,
      pincode: "",
      ledger_group_id: "",
      bilty_copy_upload: "",
      linked_customer_id: "",
    })
    setEditingItem(null)
    setOpeningStockByDepot({})
  }

  // Re-runs PAN/GSTIN validation at submit time (not just on blur) so a pasted
  // value or a value set via populateFormFromData that was never blurred still
  // gets caught client-side before hitting the (still-authoritative) backend.
  const validateCustomerFormForSubmit = (): boolean => {
    const errors: { pan?: string; gstin?: string; pincode?: string } = {}
    const pan = (customerForm.pan || '').toString().trim().toUpperCase()
    if (pan && !PAN_REGEX.test(pan)) errors.pan = 'Invalid PAN format. Expected: ABCDE1234F'
    const gstin = (customerForm.gstin || '').toString().trim().toUpperCase()
    if (gstin) {
      if (!GSTIN_REGEX.test(gstin)) {
        errors.gstin = 'Invalid GSTIN format. Expected 15 characters, e.g. 22ABCDE1234F1Z5'
      } else {
        const selectedState = activeStates.find((s: any) => String(s.id) === String(customerForm.state_id))
        const gstStateCode = selectedState?.gst_state_code
        if (gstStateCode && gstin.slice(0, 2) !== gstStateCode) {
          errors.gstin = `GSTIN state code (${gstin.slice(0, 2)}) does not match the selected State's GST state code (${gstStateCode})`
        }
      }
    }
    const pincode = (customerForm.pincode || '').toString()
    if (pincode && !PINCODE_REGEX.test(pincode)) errors.pincode = 'PIN Code must be exactly 6 digits'
    setCustomerFormErrors(errors)

    const addrErrors: Record<number, string | undefined> = {}
    ;(customerForm.addresses || []).forEach((addr, i) => {
      const addrPincode = (addr.pincode || '').toString()
      if (addrPincode && !PINCODE_REGEX.test(addrPincode)) addrErrors[i] = 'PIN Code must be exactly 6 digits'
    })
    setAddressErrors(addrErrors)

    const bankErrors: Record<number, string | undefined> = {}
    ;(customerForm.bank_accounts || []).forEach((bank, i) => {
      const ifsc = (bank.ifsc_code || '').toString().trim().toUpperCase()
      if (ifsc && !IFSC_REGEX.test(ifsc)) bankErrors[i] = 'Invalid IFSC format. Expected 11 characters, e.g. SBIN0001234'
    })
    setBankAccountErrors(bankErrors)

    const firstAddrError = Object.values(addrErrors).find(Boolean)
    const firstBankError = Object.values(bankErrors).find(Boolean)
    if (errors.pan || errors.gstin || errors.pincode || firstAddrError || firstBankError) {
      toast({ title: "Validation error", description: errors.pan || errors.gstin || errors.pincode || firstAddrError || firstBankError, variant: "destructive" })
      return false
    }
    if (pan !== customerForm.pan || gstin !== customerForm.gstin) {
      setCustomerForm(prev => ({ ...prev, pan, gstin }))
    }
    if ((customerForm.bank_accounts || []).some(b => (b.ifsc_code || '') !== (b.ifsc_code || '').toString().trim().toUpperCase())) {
      setCustomerForm(prev => ({
        ...prev,
        bank_accounts: (prev.bank_accounts || []).map(b => ({ ...b, ifsc_code: (b.ifsc_code || '').toString().trim().toUpperCase() })),
      }))
    }
    return true
  }

  const handleCreateOrUpdate = async () => {
    if (activeTab === "customers" && !validateCustomerFormForSubmit()) return
    setIsSubmitting(true)
    try {
      let res
      if (activeTab === "customers") {
        if (editingItem) {
          res = await customerApi.update(editingItem.id, customerForm)
        } else {
          res = await customerApi.create(customerForm)
        }
      } else if (activeTab === "depots") {
        if (editingItem) {
          // v2 keys mutations off the real serial id — depot_id is the legacy text business code
          res = await depotApi.update(editingItem.id, depotForm)
        } else {
          res = await depotApi.create(depotForm)
        }
      } else if (activeTab === "brokers") {
        if (editingItem) {
          res = await brokerApi.update(editingItem.id, brokerForm)
        } else {
          res = await brokerApi.create(brokerForm)
        }
      } else if (activeTab === "salespersons") {
        if (editingItem) {
          res = await salespersonApi.update(editingItem.id, salespersonForm)
        } else {
          res = await salespersonApi.create(salespersonForm)
        }
      } else if (activeTab === "ledger_groups") {
        if (editingItem) {
          res = await ledgerGroupApi.update(editingItem.id, ledgerGroupForm)
        } else {
          res = await ledgerGroupApi.create(ledgerGroupForm)
        }
      } else if (activeTab === "stock_groups") {
        if (editingItem) {
          res = await stockGroupApi.update(editingItem.id, stockGroupForm)
        } else {
          res = await stockGroupApi.create(stockGroupForm)
        }
      } else if (activeTab === "units") {
        if (editingItem) {
          res = await unitApi.update(editingItem.id, unitForm)
        } else {
          res = await unitApi.create(unitForm)
        }
      } else if (activeTab === "raw_materials") {
        if (editingItem) {
          res = await rawMaterialApi.update(editingItem.id, rawMaterialForm)
        } else {
          res = await rawMaterialApi.create(rawMaterialForm)
        }
      } else if (activeTab === "semi_finished_goods") {
        if (editingItem) {
          res = await semiFinishedGoodApi.update(editingItem.id, semiFinishedGoodForm)
        } else {
          res = await semiFinishedGoodApi.create(semiFinishedGoodForm)
        }
      } else if (activeTab === "insurance_details") {
        if (editingItem) {
          res = await insuranceDetailApi.update(editingItem.id, insuranceDetailForm)
        } else {
          res = await insuranceDetailApi.create(insuranceDetailForm)
        }
      } else if (activeTab === "conversion_formulas") {
        if (editingItem) {
          res = await conversionFormulaApi.update(editingItem.id, conversionFormulaForm)
        } else {
          res = await conversionFormulaApi.create(conversionFormulaForm)
        }
      } else if (activeTab === "price_levels") {
        if (editingItem) {
          res = await priceLevelApi.update(editingItem.id, priceLevelForm)
        } else {
          res = await priceLevelApi.create(priceLevelForm)
        }
      } else if (activeTab === "petrol_pumps") {
        if (editingItem) {
          res = await petrolPumpApi.update(editingItem.id, petrolPumpForm)
        } else {
          res = await petrolPumpApi.create(petrolPumpForm)
        }
      } else if (activeTab === "cd_rules") {
        if (editingItem) {
          res = await cdRuleApi.update(editingItem.id, cdRuleForm)
        } else {
          res = await cdRuleApi.create(cdRuleForm)
        }
      } 
      else if (activeTab === "tds_rules") {
        if (editingItem) {
          res = await tdsRuleApi.update(editingItem.id, tdsRuleForm)
        } else {
          res = await tdsRuleApi.create(tdsRuleForm)
        }
      }

      else if (activeTab === "oil_tags") {
        if (editingItem) {
          res = await oilTagApi.update(editingItem.id, oilTagForm)
        } else {
          res = await oilTagApi.create(oilTagForm)
        }
      }
 else if (activeTab === "bhada_rates") {
        if (editingItem) {
          res = await bhadaRateApi.update(editingItem.id, bhadaRateForm)
        } else {
          res = await bhadaRateApi.create(bhadaRateForm)
        }
      } else if (activeTab === "sku_details") {
        if (editingItem) {
          res = await skuDetailsApi.update(editingItem.id, skuDetailsForm)
        } else {
          res = await skuDetailsApi.create(skuDetailsForm)
        }
        if (res?.success && skuDetailsForm.sku_name) {
          const isStaged = !isAdminOrSuper || res?.data?.staged === true;
          await Promise.allSettled(
            Object.entries(openingStockByDepot)
              .filter(([_, qty]) => qty !== '')
              .map(([depotName, qty]) =>
                inventoryApi.upsertOpeningQty({
                  depo_name: depotName,
                  product_name: skuDetailsForm.sku_name as string,
                  opening_qty: parseInt(qty) || 0,
                  is_staged: isStaged,
                })
              )
          )
        }
      } else if (activeTab === "sku_selling_price") {
        if (editingItem) {
          res = await skuSellingPriceApi.update(editingItem.id, skuSellingPriceForm)
        } else {
          res = await skuSellingPriceApi.create(skuSellingPriceForm)
        }
      } else if (activeTab === "vehicle_master") {
        // --- Mandatory field validation ---
        const vErrors: { registration_no?: string; vehicle_type?: string; transporter?: string; state_permit_image?: string } = {}
        if (!vehicleForm.registration_no?.trim()) vErrors.registration_no = 'Registration Number is required'
        if (!vehicleForm.vehicle_type?.trim()) vErrors.vehicle_type = 'Vehicle Type is required'
        if (!vehicleForm.transporter?.trim()) vErrors.transporter = 'Transporter is required'
        // State permit document is compulsory when the permit section applies (GVW > 3000)
        const permitApplies = vehicleForm.gvw !== '' && Number(vehicleForm.gvw) > 3000
        if (permitApplies && !vehicleForm.state_permit_image) vErrors.state_permit_image = 'State Permit document is required'
        // --- Duplicate registration number check (against already-loaded list) ---
        const regNo = vehicleForm.registration_no?.trim().toUpperCase()
        const duplicate = vehicles.find((v: any) =>
          v.registration_no?.trim().toUpperCase() === regNo &&
          v.id !== editingItem?.id   // exclude current record when editing
        )
        if (duplicate) vErrors.registration_no = `Registration Number "${regNo}" already exists (${duplicate.vehicle_master_id})`
        if (Object.keys(vErrors).length > 0) {
          setVehicleFormErrors(vErrors)
          setIsSubmitting(false)
          return
        }
        setVehicleFormErrors({})
        const payload = { ...vehicleForm }
        if (roadTaxType === 'expiry') {
          payload.life_time_tax = null
          payload.life_time_tax_image = null
        } else {
          payload.road_tax = null
          payload.road_tax_image = null
        }
        const isPermitEnabled = payload.gvw !== '' && Number(payload.gvw) > 3000;
        if (!isPermitEnabled) {
          payload.state_permit = null;
          payload.state_permit_image = null;
          payload.state_permit_type = null;
          payload.national_permit = null;
          payload.national_permit_image = null;
        }
        const dateFields = ['rto', 'road_tax', 'life_time_tax', 'pollution', 'insurance', 'fitness', 'state_permit', 'national_permit'] as const;
        dateFields.forEach(f => { if (payload[f] === '') payload[f] = null; });
        if (editingItem) {
          res = await vehicleMasterApi.update(editingItem.id, payload)
        } else {
          res = await vehicleMasterApi.create(payload)
        }
      } else if (activeTab === "driver_master") {
        if (editingItem) {
          res = await driverMasterApi.update(editingItem.id, driverForm)
        } else {
          res = await driverMasterApi.create(driverForm)
        }
      } else if (activeTab === "transport_master") {
        if (editingItem) {
          res = await transportMasterApi.update(editingItem.id, transportForm)
        } else {
          res = await transportMasterApi.create(transportForm)
        }
      }
      if (res?.success) {
        toast({ title: "Success", description: res.message || (editingItem ? "Updated successfully" : "Created successfully") })
        setIsDialogOpen(false)
        resetForms()
        // Refetch appropriate query (also refresh pending list so admin sees new/edited record immediately)
        if (activeTab === "customers") { refetchCustomer(); refetchPendingCustomers() }
        else if (activeTab === "depots") { refetchDepot(); refetchPendingDepots() }
        else if (activeTab === "brokers") { refetchBroker(); refetchPendingBrokers() }
        else if (activeTab === "salespersons") { refetchSalesperson(); refetchPendingSalespersons() }
        else if (activeTab === "ledger_groups") { refetchLedgerGroup(); refetchPendingLedgerGroups() }
        else if (activeTab === "stock_groups") { refetchStockGroup(); refetchPendingStockGroups() }
        else if (activeTab === "units") { refetchUnit(); refetchPendingUnits() }
        else if (activeTab === "raw_materials") { refetchRawMaterial(); refetchPendingRawMaterials() }
        else if (activeTab === "semi_finished_goods") { refetchSemiFinishedGood(); refetchPendingSemiFinishedGoods() }
        else if (activeTab === "insurance_details") { refetchInsuranceDetail(); refetchPendingInsuranceDetails() }
        else if (activeTab === "conversion_formulas") { refetchConversionFormula(); refetchPendingConversionFormulas() }
        else if (activeTab === "price_levels") { refetchPriceLevel(); refetchPendingPriceLevels() }
        else if (activeTab === "petrol_pumps") { refetchPetrolPump(); refetchPendingPetrolPumps() }
        else if (activeTab === "cd_rules") { refetchCdRule(); refetchPendingCdRules() }
        else if (activeTab === "tds_rules") { refetchTdsRule(); refetchPendingTdsRules() }
              else if (activeTab === "oil_tags") { refetchOilTag(); refetchPendingOilTags() }
        else if (activeTab === "bhada_rates") { refetchBhadaRate(); refetchPendingBhadaRates() }
        else if (activeTab === "sku_details") { refetchSku(); refetchPendingSku() }
        else if (activeTab === "sku_selling_price") refetchSkuSellingPrice()
        else if (activeTab === "vehicle_master") { refetchVehicle(); refetchPendingVehicles() }
        else if (activeTab === "driver_master") { refetchDriver(); refetchPendingDrivers() }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save data",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingItem) return
    setIsSubmitting(true)
    try {
      let res
      if (activeTab === "customers") {
        res = await customerApi.delete(deletingItem.id)
      } else if (activeTab === "depots") {
        // v2 keys mutations off the real serial id — depot_id/broker_id are legacy text business codes
        res = await depotApi.delete(deletingItem.id)
      } else if (activeTab === "brokers") {
        res = await brokerApi.delete(deletingItem.id)
      } else if (activeTab === "salespersons") {
        res = await salespersonApi.delete(deletingItem.id)
      } else if (activeTab === "ledger_groups") {
        res = await ledgerGroupApi.delete(deletingItem.id)
      } else if (activeTab === "stock_groups") {
        res = await stockGroupApi.delete(deletingItem.id)
      } else if (activeTab === "units") {
        res = await unitApi.delete(deletingItem.id)
      } else if (activeTab === "raw_materials") {
        res = await rawMaterialApi.delete(deletingItem.id)
      } else if (activeTab === "semi_finished_goods") {
        res = await semiFinishedGoodApi.delete(deletingItem.id)
      } else if (activeTab === "insurance_details") {
        res = await insuranceDetailApi.delete(deletingItem.id)
      } else if (activeTab === "conversion_formulas") {
        res = await conversionFormulaApi.delete(deletingItem.id)
      } else if (activeTab === "price_levels") {
        res = await priceLevelApi.delete(deletingItem.id)
      } else if (activeTab === "petrol_pumps") {
        res = await petrolPumpApi.delete(deletingItem.id)
      } else if (activeTab === "cd_rules") {
        res = await cdRuleApi.delete(deletingItem.id)
      } else if (activeTab === "oil_tags") {
          res = await oilTagApi.delete(deletingItem.id)
        } else if (activeTab === "tds_rules") {
        res = await tdsRuleApi.delete(deletingItem.id)
      } else if (activeTab === "bhada_rates") {
        res = await bhadaRateApi.delete(deletingItem.id)
      } else if (activeTab === "sku_details") {
        res = await skuDetailsApi.delete(deletingItem.id)
      } else if (activeTab === "sku_selling_price") {
        res = await skuSellingPriceApi.delete(deletingItem.id)
      } else if (activeTab === "vehicle_master") {
        res = await vehicleMasterApi.delete(deletingItem.id)
      } else if (activeTab === "driver_master") {
        res = await driverMasterApi.delete(deletingItem.id)
      } else if (activeTab === "transport_master") {
        res = await transportMasterApi.delete(deletingItem.id)
      }
      if (res?.success) {
        toast({ title: "Success", description: "Deleted successfully" })
        setIsDeleteDialogOpen(false)
        setDeletingItem(null)
        // Refetch appropriate query
        if (activeTab === "customers") refetchCustomer()
        else if (activeTab === "depots") refetchDepot()
        else if (activeTab === "brokers") refetchBroker()
        else if (activeTab === "salespersons") refetchSalesperson()
        else if (activeTab === "ledger_groups") refetchLedgerGroup()
        else if (activeTab === "stock_groups") refetchStockGroup()
        else if (activeTab === "units") refetchUnit()
        else if (activeTab === "raw_materials") refetchRawMaterial()
        else if (activeTab === "semi_finished_goods") refetchSemiFinishedGood()
        else if (activeTab === "insurance_details") refetchInsuranceDetail()
        else if (activeTab === "conversion_formulas") refetchConversionFormula()
        else if (activeTab === "price_levels") refetchPriceLevel()
        else if (activeTab === "petrol_pumps") refetchPetrolPump()
        else if (activeTab === "cd_rules") refetchCdRule()
        else if (activeTab === "tds_rules") refetchTdsRule()
        else if (activeTab === "oil_tags") refetchOilTag()
        else if (activeTab === "bhada_rates") refetchBhadaRate()
        else if (activeTab === "sku_details") refetchSku()
        else if (activeTab === "sku_selling_price") refetchSkuSellingPrice()
        else if (activeTab === "vehicle_master") refetchVehicle()
        else if (activeTab === "driver_master") refetchDriver()
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete item",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const openApprovalModal = (tab: string, item: any) => {
    setApprovalReviewModal({ tab, item })
    // Pre-fill the SAME Add/Edit form used on the main tab with the proposed values
    // (pending_changes layered over the live row for edits), so the review modal is
    // identical to the original add/edit modal. editingItem keeps IDs read-only.
    let pc = item?.pending_changes
    if (typeof pc === 'string') { try { pc = JSON.parse(pc) } catch { pc = null } }
    const proposed = pc && item?.request_type === 'edit' ? { ...item, ...pc } : { ...item }
    setEditingItem(item)
    populateFormFromData(tab, proposed)
  }

  const handleReviewRecord = async (tab: string, id: any, action: 'approve' | 'reject', reason?: string, overrides?: Record<string, any>) => {
    setIsReviewing(true)
    try {
      let res: any
      const payload = { action, reason, ...(action === 'approve' ? overrides : {}) }
      if (tab === 'customers') res = await customerApi.review(id, payload)
      else if (tab === 'depots') res = await depotApi.review(id, payload)
      else if (tab === 'brokers') res = await brokerApi.review(id, payload)
      else if (tab === 'salespersons') res = await salespersonApi.review(id, payload)
      else if (tab === 'ledger_groups') res = await ledgerGroupApi.review(id, payload)
      else if (tab === 'stock_groups') res = await stockGroupApi.review(id, payload)
      else if (tab === 'units') res = await unitApi.review(id, payload)
      else if (tab === 'raw_materials') res = await rawMaterialApi.review(id, payload)
      else if (tab === 'semi_finished_goods') res = await semiFinishedGoodApi.review(id, payload)
      else if (tab === 'insurance_details') res = await insuranceDetailApi.review(id, payload)
      else if (tab === 'conversion_formulas') res = await conversionFormulaApi.review(id, payload)
      else if (tab === 'price_levels') res = await priceLevelApi.review(id, payload)
      else if (tab === 'petrol_pumps') res = await petrolPumpApi.review(id, payload)
      else if (tab === 'cd_rules') res = await cdRuleApi.review(id, payload)
      else if (tab === 'oil_tags') res = await oilTagApi.review(id, payload)
        else if (tab === 'tds_rules') res = await tdsRuleApi.review(id, payload)
      else if (tab === 'bhada_rates') res = await bhadaRateApi.review(id, payload)
      else if (tab === 'sku_details') res = await skuDetailsApi.review(id, payload)
      else if (tab === 'vehicle_master') res = await vehicleMasterApi.review(id, payload)
      else if (tab === 'driver_master') res = await driverMasterApi.review(id, payload)
      else if (tab === 'transport_master') res = await transportMasterApi.review(id, payload)
      if (res?.success) {
        toast({ title: "Success", description: res.message || `Record ${action}d successfully` })
        if (tab === 'customers') { refetchPendingCustomers(); refetchCustomer() }
        else if (tab === 'depots') { refetchPendingDepots(); refetchDepot() }
        else if (tab === 'brokers') { refetchPendingBrokers(); refetchBroker() }
        else if (tab === 'salespersons') { refetchPendingSalespersons(); refetchSalesperson() }
        else if (tab === 'ledger_groups') { refetchPendingLedgerGroups(); refetchLedgerGroup() }
        else if (tab === 'stock_groups') { refetchPendingStockGroups(); refetchStockGroup() }
        else if (tab === 'units') { refetchPendingUnits(); refetchUnit() }
        else if (tab === 'raw_materials') { refetchPendingRawMaterials(); refetchRawMaterial() }
        else if (tab === 'semi_finished_goods') { refetchPendingSemiFinishedGoods(); refetchSemiFinishedGood() }
        else if (tab === 'insurance_details') { refetchPendingInsuranceDetails(); refetchInsuranceDetail() }
        else if (tab === 'conversion_formulas') { refetchPendingConversionFormulas(); refetchConversionFormula() }
        else if (tab === 'price_levels') { refetchPendingPriceLevels(); refetchPriceLevel() }
        else if (tab === 'petrol_pumps') { refetchPendingPetrolPumps(); refetchPetrolPump() }
        else if (tab === 'cd_rules') { refetchPendingCdRules(); refetchCdRule() }
        else if (tab === 'tds_rules') { refetchPendingTdsRules(); refetchTdsRule() }
        else if (tab === 'bhada_rates') { refetchPendingBhadaRates(); refetchBhadaRate() }
        else if (tab === 'sku_details') { refetchPendingSku(); refetchSku(); queryClient.invalidateQueries({ queryKey: ['inventory-data'] }) }
        else if (tab === 'vehicle_master') { refetchPendingVehicles(); refetchVehicle() }
        else if (tab === 'driver_master') { refetchPendingDrivers(); refetchDriver() }
        else if (tab === 'transport_master') { refetchPendingTransport(); refetchTransport() }
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to review record", variant: "destructive" })
    } finally {
      setIsReviewing(false)
      setRejectDialogContext(null)
      setRejectionReason("")
      setApprovalReviewModal(null)
      setApprovalEditData({})

      resetForms()
    }
  }




  const fetchNextId = async (type: 'customer' | 'depot' | 'broker' | 'sku' | 'salesperson' | 'vehicle' | 'driver' | 'transport' | 'ledger_group' | 'stock_group' | 'unit' | 'ledger' | 'raw_material' | 'semi_finished_good' | 'insurance_detail' | 'conversion_formula' | 'price_level' | 'petrol_pump' | 'cd_rule' | 'tds_rule' | 'bhada_rate') => {
    try {
      const res = await commonApi.getNextId(type)
      if (res.success) {
        return res.data.nextId
      }
    } catch (error) {
      console.error("Failed to fetch next ID", error)
    }
    return ""
  }

  const handleOpenAddDialog = async () => {
    resetForms()
    setIsDialogOpen(true)
    
    // Fetch next ID based on active tab
    let nextId = ""
    if (activeTab === "customers") {
      nextId = await fetchNextId('customer')
      setCustomerForm((prev: any) => ({ ...prev, customer_id: nextId }))
    } else if (activeTab === "depots") {
      nextId = await fetchNextId('depot')
      setDepotForm((prev: any) => ({ ...prev, depot_id: nextId }))
    } else if (activeTab === "brokers") {
      nextId = await fetchNextId('broker')
      setBrokerForm((prev: any) => ({ ...prev, broker_id: nextId }))
    } else if (activeTab === "salespersons") {
      nextId = await fetchNextId('salesperson')
      setSalespersonForm((prev: any) => ({ ...prev, broker_id: nextId }))
    } else if (activeTab === "ledger_groups") {
      nextId = await fetchNextId('ledger_group')
      setLedgerGroupForm((prev: any) => ({ ...prev, group_code: nextId }))
    } else if (activeTab === "stock_groups") {
      nextId = await fetchNextId('stock_group')
      setStockGroupForm((prev: any) => ({ ...prev, group_code: nextId }))
    } else if (activeTab === "units") {
      nextId = await fetchNextId('unit')
      setUnitForm((prev: any) => ({ ...prev, unit_code: nextId }))
    } else if (activeTab === "raw_materials") {
      nextId = await fetchNextId('raw_material')
      setRawMaterialForm((prev: any) => ({ ...prev, raw_material_code: nextId }))
    } else if (activeTab === "semi_finished_goods") {
      nextId = await fetchNextId('semi_finished_good')
      setSemiFinishedGoodForm((prev: any) => ({ ...prev, semi_finished_good_code: nextId }))
    } else if (activeTab === "insurance_details") {
      nextId = await fetchNextId('insurance_detail')
      setInsuranceDetailForm((prev: any) => ({ ...prev, insurance_code: nextId }))
    } else if (activeTab === "conversion_formulas") {
      nextId = await fetchNextId('conversion_formula')
      setConversionFormulaForm((prev: any) => ({ ...prev, conversion_formula_code: nextId }))
    } else if (activeTab === "price_levels") {
      nextId = await fetchNextId('price_level')
      setPriceLevelForm((prev: any) => ({ ...prev, price_level_code: nextId }))
    } else if (activeTab === "petrol_pumps") {
      nextId = await fetchNextId('petrol_pump')
      setPetrolPumpForm((prev: any) => ({ ...prev, petrol_pump_code: nextId }))
    } else if (activeTab === "cd_rules") {
      nextId = await fetchNextId('cd_rule')
      setCdRuleForm((prev: any) => ({ ...prev, cd_rule_code: nextId }))
    } else if (activeTab === "tds_rules") {
      nextId = await fetchNextId('tds_rule')
      setTdsRuleForm((prev: any) => ({ ...prev, tds_rule_code: nextId }))
    } else if (activeTab === "bhada_rates") {
      nextId = await fetchNextId('bhada_rate')
      setBhadaRateForm((prev: any) => ({ ...prev, bhada_rate_code: nextId }))
    } else if (activeTab === "sku_details") {
      nextId = await fetchNextId('sku')
      setSkuDetailsForm((prev: any) => ({ ...prev, sku_code: nextId }))
    } else if (activeTab === "vehicle_master") {
      nextId = await fetchNextId('vehicle')
      setVehicleForm((prev: any) => ({ ...prev, vehicle_master_id: nextId }))
    } else if (activeTab === "driver_master") {
      nextId = await fetchNextId('driver')
      setDriverForm((prev: any) => ({ ...prev, driver_master_id: nextId }))
    } else if (activeTab === "sku_selling_price") {
      // No ID fetching for selling price as it usually depends on existing SKUs or is auto-id
      setSkuSellingPrice({
        id: 0,
        packing_material: "",
        sku_weight: 0,
        sku_unit: "",
        conversion_formula: 0,
        sku_weight_in_gm: 0,
        packing_material_weight_in_gm: 0,
        net_oil_in_gm: 0,
        packing_cost: 0,
        var: "",
        landing_cost: 0,
        selling_cost: 0,
        margin: "",
        actual_margin: 0
      })
    } else if (activeTab === "transport_master") {
      nextId = await fetchNextId('transport')
    }
  }

  // Populate the per-tab Add/Edit form state from a record. Shared by the Edit
  // dialog and the pending-approval review modal so both render the identical form.
  const populateFormFromData = async (tab: string, data: any) => {
    if (tab === "customers") {
      setCustomerForm({ ...data })
    } else if (tab === "depots") {
      setDepotForm({ ...data })
    } else if (tab === "brokers") {
      setBrokerForm({ ...data })
    } else if (tab === "salespersons") {
      setSalespersonForm({ ...data })
    } else if (tab === "ledger_groups") {
      setLedgerGroupForm({ ...data })
    } else if (tab === "stock_groups") {
      setStockGroupForm({ ...data })
    } else if (tab === "units") {
      setUnitForm({ ...data })
    } else if (tab === "raw_materials") {
      setRawMaterialForm({ ...data })
    } else if (tab === "semi_finished_goods") {
      setSemiFinishedGoodForm({ ...data })
    } else if (tab === "insurance_details") {
      setInsuranceDetailForm({ ...data })
    } else if (tab === "conversion_formulas") {
      setConversionFormulaForm({ ...data })
    } else if (tab === "price_levels") {
      setPriceLevelForm({ ...data })
    } else if (tab === "petrol_pumps") {
      setPetrolPumpForm({ ...data })
    } else if (tab === "cd_rules") {
      setCdRuleForm({ ...data })
    } else if (tab === "oil_tags") {
      setOilTagForm({ ...data })
    } else if (tab === "tds_rules") {
      setTdsRuleForm({ ...data })
    } else if (tab === "bhada_rates") {
      setBhadaRateForm({ ...data })
    } else if (tab === "sku_details") {
      setSkuDetailsForm({ ...data })
      setOpeningStockByDepot({})
      const stockMap: Record<string, string> = {}
      if (data.pending_opening_stock && Object.keys(data.pending_opening_stock).length > 0) {
        Object.entries(data.pending_opening_stock).forEach(([depot, qty]) => {
          stockMap[depot] = String(qty)
        })
        setOpeningStockByDepot(stockMap)
      } else {
        try {
          const res = await inventoryApi.getData()
          if (res.success) {
            res.data
              .filter((row: any) => row.product_name?.toLowerCase() === data.sku_name?.toLowerCase())
              .forEach((row: any) => {
                if (row.opening_qty !== null && row.opening_qty !== undefined) stockMap[row.depot_name] = String(row.opening_qty)
              })
            setOpeningStockByDepot(stockMap)
          }
        } catch (_) {}
      }
    } else if (tab === "sku_selling_price") {
      setSkuSellingPrice({ ...data })
    } else if (tab === "vehicle_master") {
      setVehicleForm({
        state_permit_type: '',
        fuel_type: 'Diesel',
        ...data
      })
      setRoadTaxType(data.life_time_tax || data.life_time_tax_image ? 'lifetime' : 'expiry')
    } else if (tab === "driver_master") {
      setDriverForm({ ...data })
    } else if (tab === "transport_master") {
      setTransportForm({ ...data })
    }
  }

  const openEditDialog = async (item: any) => {
    setEditingItem(item)
    // Customers / Raw Materials: the list row doesn't carry the child-table
    // rows (kept out of the list query for performance) - fetch full detail
    // so the addresses / Additional UOM section has something to populate
    // when the dialog opens.
    if (activeTab === 'customers') {
      const res = await customerApi.getById(item.id)
      await populateFormFromData(activeTab, res.success ? res.data : item)
    } else if (activeTab === 'raw_materials') {
      const res = await rawMaterialApi.getById(item.id)
      await populateFormFromData(activeTab, res.success ? res.data : item)
    } else if (activeTab === 'vehicle_master') {
      // The list row doesn't carry additional_transporter_ids (kept out of
      // the list query for performance) - fetch full detail so the
      // multi-transporter checklist has something to populate.
      const res = await vehicleMasterApi.getById(item.id)
      await populateFormFromData(activeTab, res.success ? res.data : item)
    } else if (activeTab === 'depots') {
      // The list row doesn't carry agent_tags (kept out of the list query
      // for performance) - fetch full detail so the Broker/Salesperson
      // checklist has something to populate.
      const res = await depotApi.getById(item.id)
      await populateFormFromData(activeTab, res.success ? res.data : item)
    } else if (activeTab === 'insurance_details') {
      const res = await insuranceDetailApi.getById(item.id)
      await populateFormFromData(activeTab, res.success ? res.data : item)
    } else if (activeTab === 'conversion_formulas') {
      const res = await conversionFormulaApi.getById(item.id)
      await populateFormFromData(activeTab, res.success ? res.data : item)
    } else if (activeTab === 'price_levels') {
      const res = await priceLevelApi.getById(item.id)
      await populateFormFromData(activeTab, res.success ? res.data : item)
    } else {
      await populateFormFromData(activeTab, item)
    }
    setIsDialogOpen(true)
  }

  // Returns the current per-tab Add/Edit form state object (used when approving).
  const getFormForTab = (tab: string): any => {
    switch (tab) {
      case 'customers': return customerForm
      case 'depots': return depotForm
      case 'brokers': return brokerForm
      case 'salespersons': return salespersonForm
      case 'ledger_groups': return ledgerGroupForm
      case 'stock_groups': return stockGroupForm
      case 'units': return unitForm
      case 'raw_materials': return rawMaterialForm
      case 'semi_finished_goods': return semiFinishedGoodForm
      case 'insurance_details': return insuranceDetailForm
      case 'conversion_formulas': return conversionFormulaForm
      case 'price_levels': return priceLevelForm
      case 'petrol_pumps': return petrolPumpForm
      case 'cd_rules': return cdRuleForm
      case 'oil_tags': return oilTagForm
        case 'tds_rules': return tdsRuleForm
      case 'bhada_rates': return bhadaRateForm
      case 'sku_details': return skuDetailsForm
      case 'vehicle_master': {
        const payload = { ...vehicleForm }
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
        const dateFields = ['rto', 'road_tax', 'life_time_tax', 'pollution', 'insurance', 'fitness', 'state_permit', 'national_permit'] as const;
        dateFields.forEach(f => { if (payload[f] === '') payload[f] = null; });
        return payload
      }
      case 'driver_master': return driverForm
      case 'transport_master': return transportForm
      default: return {}
    }
  }

  // Renders the exact same Add/Edit form used on the main tab, by tab key.
  const renderFormForTab = (tab: string) => {
    switch (tab) {
      case 'customers': return renderCustomerForm()
      case 'depots': return renderDepotForm()
      case 'brokers': return renderBrokerForm()
      case 'salespersons': return renderSalespersonForm()
      case 'ledger_groups': return renderLedgerGroupForm()
      case 'stock_groups': return renderStockGroupForm()
      case 'units': return renderUnitForm()
      case 'raw_materials': return renderRawMaterialForm()
      case 'semi_finished_goods': return renderSemiFinishedGoodForm()
      case 'insurance_details': return renderInsuranceDetailForm()
      case 'conversion_formulas': return renderConversionFormulaForm()
      case 'price_levels': return renderPriceLevelForm()
      case 'petrol_pumps': return renderPetrolPumpForm()
      case 'cd_rules': return renderCdRuleForm()
      case 'tds_rules': return renderTdsRuleForm()
      case 'oil_tags': return renderOilTagForm()
      case 'bhada_rates': return renderBhadaRateForm()
      case 'sku_details': return renderSkuDetailsForm()
      case 'vehicle_master': return renderVehicleForm()
      case 'driver_master': return renderDriverForm()
      case 'transport_master': return renderTransportForm()
      case 'states': return null
      case 'districts': return null
      case 'sub_districts': return null
      default: return null
    }
  }

  const APPROVAL_FIELD_LABELS: Record<string, string> = {
    customer_name: 'Customer Name', status: 'Status', contact_person: 'Contact Person', contact: 'Mobile',
    email: 'Email', email_id: 'Email', address_line_1: 'Address', address_line_2: 'Address 2', state: 'State',
    pincode: 'Pincode', pan: 'PAN', gstin: 'GSTIN', gst_registered: 'GST Registration Status',
    gst_registration_type: 'GST Registration Type', gst_registration_wef: 'GST W.E.F. Date',
    msme_registration_no: 'MSME Registration No', msme_registration_type: 'MSME Registration Type',
    msme_registration_wef: 'MSME W.E.F. Date', fssai_no: 'FSSAI No', fssai_valid_upto: 'FSSAI Valid Upto',
    fssai_licence_type: 'FSSAI Licence Type', pan_upload: 'PAN Card',
    // aadhaar_upload's label is defined once below (shared with the Driver Master field of
    // the same name - both are literally "Aadhaar Upload", no need for a second entry).
    gst_certificate_upload: 'GST Certificate', msme_certificate_upload: 'MSME Certificate',
    fssai_certificate_upload: 'FSSAI Certificate', is_required_for_commitment: 'Is Required for Commitment',
    depot_name: 'Depot Name', depot_address: 'Depot Address', salesman_broker_name: 'Salesman / Broker',
    salesman_name: 'Name', mobile_no: 'Mobile', sku_name: 'SKU Name', sku_code: 'SKU Code', main_uom: 'Main UOM',
    hsn_code: 'HSN Code', gst_rate: 'GST Rate', registration_no: 'Registration No', vehicle_type: 'Vehicle Type',
    transporter: 'Transporter', rto: 'RTO', rc_image: 'RC (Registration Certificate)', fuel_type: 'Fuel Type', gvw: 'GVW', ulw: 'ULW', passing: 'Passing Weight',
    road_tax: 'Road Tax Expiry', road_tax_image: 'Road Tax Certificate',
    life_time_tax: 'Lifetime Tax', life_time_tax_image: 'Lifetime Tax Certificate',
    pollution: 'Pollution Expiry', pollution_image: 'Pollution Certificate',
    insurance: 'Insurance Expiry', insurance_image: 'Insurance Certificate',
    fitness: 'Fitness Expiry', fitness_image: 'Fitness Certificate',
    state_permit_type: 'Permit Type', state_permit: 'State Permit Expiry', state_permit_image: 'State Permit Certificate',
    national_permit: 'National Permit Expiry', national_permit_image: 'National Permit Certificate',
    driver_name: 'Driver Name', driving_licence_no: 'DL Number', driving_licence_type: 'DL Type', valid_upto: 'Valid Upto',
    transporter_name: 'Transporter Name', contact_number: 'Contact Number',
    dl_upload: 'Driving Licence Upload', aadhaar_upload: 'Aadhaar Upload',
  }


  // Compact diff summary shown above the form for an "edit" approval request.
  const renderProposedChanges = () => {
    if (!approvalReviewModal || approvalReviewModal.item?.request_type !== 'edit') return null
    let pc = approvalReviewModal.item.pending_changes
    if (typeof pc === 'string') { try { pc = JSON.parse(pc) } catch { pc = null } }
    if (!pc) return null
    // 'addresses' is an array of objects, not a scalar - stringifying it here would
    // just show "[object Object],[object Object]". The full form below already
    // renders the proposed address list properly, so skip it in this summary.
    const changed = Object.keys(pc).filter(k => k !== 'addresses' && k !== 'godown_ids' && k !== 'bank_accounts' && String(pc[k] ?? '') !== String(approvalReviewModal.item[k] ?? ''))
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 space-y-1.5">
        <p className="text-xs font-semibold text-blue-800">Proposed changes to an existing record</p>
        {changed.length === 0 ? (
          <p className="text-xs text-blue-600">No field differs from the current record.</p>
        ) : (
          <div className="space-y-1">
            {changed.map(k => (
              <div key={k} className="text-xs flex flex-wrap gap-1">
                <span className="font-medium text-slate-600">{APPROVAL_FIELD_LABELS[k] || k}:</span>
                <span className="text-red-600 line-through">{String(approvalReviewModal.item[k] ?? '—') || '—'}</span>
                <span className="text-slate-400">→</span>
                <span className="text-emerald-700 font-medium">{String(pc[k] ?? '—') || '—'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // --- Filter Logic ---

  const filteredCustomers = customers.filter(c =>
    matchesSearch(c?.customer_name, searchTerm) ||
    matchesSearch(c?.customer_id, searchTerm)
  )

  const filteredDepots = depots.filter(d =>
    matchesSearch(d?.depot_name, searchTerm) ||
    matchesSearch(d?.depot_id, searchTerm)
  )

  const filteredBrokers = brokers.filter(b =>
    matchesSearch(b?.salesman_name, searchTerm) ||
    matchesSearch(b?.broker_id, searchTerm)
  )

  const filteredSkuDetails = skuDetails.filter(s =>
    matchesSearch(s?.sku_name, searchTerm) ||
    matchesSearch(s?.sku_code, searchTerm)
  )

  const filteredSalespersons = salespersons.filter(s =>
    matchesSearch(s?.salesman_name, searchTerm) ||
    matchesSearch(s?.broker_id, searchTerm)
  )

  const filteredLedgerGroups = ledgerGroupsList.filter((g: any) =>
    matchesSearch(g?.group_name, searchTerm) ||
    matchesSearch(g?.group_code, searchTerm)
  )

  const filteredStockGroups = stockGroupsList.filter((g: any) =>
    matchesSearch(g?.group_name, searchTerm) ||
    matchesSearch(g?.group_code, searchTerm)
  )

  const filteredUnits = unitsList.filter((u: any) =>
    matchesSearch(u?.unit_name, searchTerm) ||
    matchesSearch(u?.unit_code, searchTerm)
  )

  const filteredRawMaterials = rawMaterialsList.filter((r: any) =>
    matchesSearch(r?.name, searchTerm) ||
    matchesSearch(r?.raw_material_code, searchTerm)
  )

  const filteredSemiFinishedGoods = semiFinishedGoodsList.filter((r: any) =>
    matchesSearch(r?.name, searchTerm) ||
    matchesSearch(r?.semi_finished_good_code, searchTerm)
  )

  const filteredInsuranceDetails = insuranceDetailsList.filter((r: any) =>
    matchesSearch(r?.insurance_company_name, searchTerm) ||
    matchesSearch(r?.insurance_code, searchTerm) ||
    matchesSearch(r?.policy_number, searchTerm)
  )

  const filteredConversionFormulas = conversionFormulasList.filter((r: any) =>
    matchesSearch(r?.conversion_formula_code, searchTerm)
  )

  const filteredPriceLevels = priceLevelsList.filter((r: any) =>
    matchesSearch(r?.price_level_code, searchTerm)
  )

  const filteredPetrolPumps = petrolPumpsList.filter((r: any) =>
    matchesSearch(r?.petrol_pump_name, searchTerm) ||
    matchesSearch(r?.petrol_pump_code, searchTerm)
  )

  const filteredCdRules = cdRulesList.filter((r: any) =>
    matchesSearch(r?.cd_rule_code, searchTerm)
  )

  const filteredTdsRules = tdsRulesList.filter((r: any) =>
    matchesSearch(r?.name, searchTerm) || matchesSearch(r?.tds_rule_code, searchTerm)
  )

  const filteredBhadaRates = bhadaRatesList.filter((r: any) =>
    matchesSearch(r?.name, searchTerm) || matchesSearch(r?.bhada_rate_code, searchTerm)
  )

  const filteredSkuSellingPrices = skuSellingPrices.filter(s =>
    matchesSearch(s?.packing_material, searchTerm)
  )

  const filteredVehicles = vehicles.filter(v => {
    const matchesSearchTerm = matchesSearch(v?.registration_no, searchTerm) ||
      matchesSearch(v?.vehicle_master_id, searchTerm) ||
      matchesSearch(v?.transporter, searchTerm)
    const matchesType = selectedVehicleType === "all" || v?.vehicle_type === selectedVehicleType
    return matchesSearchTerm && matchesType
  })

  const filteredDrivers = drivers.filter(dr =>
    matchesSearch(dr?.driver_name, searchTerm) ||
    matchesSearch(dr?.driver_master_id, searchTerm) ||
    matchesSearch(dr?.mobile_no, searchTerm) ||
    matchesSearch(dr?.driving_licence_no, searchTerm)
  )

  const filteredTransporters = transporters.filter(t =>
    matchesSearch(t?.transporter_name, searchTerm) ||
    matchesSearch(t?.transport_master_id, searchTerm) ||
    matchesSearch(t?.contact_person, searchTerm) ||
    matchesSearch(t?.contact_number, searchTerm)
  )

  // --- Sort helpers ---
  type SortDir = 'asc' | 'desc'

  const sortData = <T extends Record<string, any>>(data: T[], col: string, dir: SortDir): T[] => {
    return [...data].sort((a, b) => {
      const av = (a && a[col]) ?? ''
      const bv = (b && b[col]) ?? ''
      return dir === 'asc'
        ? String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' })
        : String(bv).localeCompare(String(av), undefined, { numeric: true, sensitivity: 'base' })
    })
  }

  const toggleSort = (
    col: string,
    current: { col: string; dir: SortDir },
    setter: React.Dispatch<React.SetStateAction<{ col: string; dir: SortDir }>>
  ) => {
    setter(current.col === col ? { col, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })
  }

  const SortIcon = ({ col, sort }: { col: string; sort: { col: string; dir: SortDir } }) => {
    if (sort.col !== col) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-40 inline" />
    return sort.dir === 'asc'
      ? <ArrowUp className="ml-1 h-3 w-3 text-blue-600 inline" />
      : <ArrowDown className="ml-1 h-3 w-3 text-blue-600 inline" />
  }

  const sortedCustomers = sortData(filteredCustomers, customerSort.col, customerSort.dir)
  const sortedDepots = sortData(filteredDepots, depotSort.col, depotSort.dir)


  const sortedBrokers = sortData(filteredBrokers, brokerSort.col, brokerSort.dir)
  const sortedSalespersons = sortData(filteredSalespersons, salespersonSort.col, salespersonSort.dir)
  const sortedLedgerGroups = sortData(filteredLedgerGroups, ledgerGroupSort.col, ledgerGroupSort.dir)
  const sortedStockGroups = sortData(filteredStockGroups, stockGroupSort.col, stockGroupSort.dir)
  const sortedUnits = sortData(filteredUnits, unitSort.col, unitSort.dir)
  const sortedRawMaterials = sortData(filteredRawMaterials, rawMaterialSort.col, rawMaterialSort.dir)
  const sortedSemiFinishedGoods = sortData(filteredSemiFinishedGoods, semiFinishedGoodSort.col, semiFinishedGoodSort.dir)
  const sortedInsuranceDetails = sortData(filteredInsuranceDetails, insuranceDetailSort.col, insuranceDetailSort.dir)
  const sortedConversionFormulas = sortData(filteredConversionFormulas, conversionFormulaSort.col, conversionFormulaSort.dir)
  const sortedPriceLevels = sortData(filteredPriceLevels, priceLevelSort.col, priceLevelSort.dir)
  const sortedPetrolPumps = sortData(filteredPetrolPumps, petrolPumpSort.col, petrolPumpSort.dir)
  const sortedCdRules = sortData(filteredCdRules, cdRuleSort.col, cdRuleSort.dir)
  const sortedTdsRules = sortData(filteredTdsRules, tdsRuleSort.col, tdsRuleSort.dir)
  const sortedBhadaRates = sortData(filteredBhadaRates, bhadaRateSort.col, bhadaRateSort.dir)
  const sortedSkuDetails = sortData(filteredSkuDetails, skuSort.col, skuSort.dir)
  const sortedSkuSellingPrices = sortData(filteredSkuSellingPrices, skuSellingPriceSort.col, skuSellingPriceSort.dir)
  const sortedVehicles = sortData(filteredVehicles, vehicleSort.col, vehicleSort.dir)
  const sortedDrivers = sortData(filteredDrivers, driverSort.col, driverSort.dir)
  const sortedTransporters = sortData(filteredTransporters, transportSort.col, transportSort.dir)

  // --- Shared Helpers ---
  const handleFileUpload = async (file: File, field: string) => {

    try {
      const res = await orderApi.uploadFile(file)
      if (res.success) {
        if (activeTab === 'vehicle_master') {
          setVehicleForm((prev: any) => ({ ...prev, [field]: res.data.url }))
        } else if (activeTab === 'driver_master') {
          setDriverForm((prev: any) => ({ ...prev, [field]: res.data.url }))
        } else if (activeTab === 'customers') {
          setCustomerForm((prev: any) => ({ ...prev, [field]: res.data.url }))
        } else if (activeTab === 'depots') {
          setDepotForm((prev: any) => ({ ...prev, [field]: res.data.url }))
        } else if (activeTab === 'brokers' || activeTab === 'salespersons' || activeTab === 'transport_master' || activeTab === 'petrol_pumps') {
          setPartyForm({ [field]: res.data.url })
        }
        toast({ title: "Success", description: "Image uploaded successfully" })
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to upload image", variant: "destructive" })
    }
  }

  // Clears an uploaded file field to null. Submitted like any other edit -
  // for an approved record this stages as a pending edit an admin must
  // approve before the file is actually removed live; for a pending record
  // being reviewed, this is how an admin strips just the upload while
  // approving everything else (renderFormForTab reuses these same render
  // functions for the approval-review dialog).
  const handleFileRemove = (field: string) => {
    if (activeTab === 'vehicle_master') {
      setVehicleForm((prev: any) => ({ ...prev, [field]: '' }))
    } else if (activeTab === 'driver_master') {
      setDriverForm((prev: any) => ({ ...prev, [field]: '' }))
    } else if (activeTab === 'customers') {
      setCustomerForm((prev: any) => ({ ...prev, [field]: '' }))
    } else if (activeTab === 'depots') {
      setDepotForm((prev: any) => ({ ...prev, [field]: '' }))
    } else if (activeTab === 'brokers' || activeTab === 'salespersons' || activeTab === 'transport_master' || activeTab === 'petrol_pumps') {
      setPartyForm({ [field]: '' })
    }
  }

  // Normalizes (trim + uppercase) and format-validates PAN/GSTIN on blur, and
  // cross-checks the GSTIN's state code against the selected State's GST state
  // code. Mirrors the backend's authoritative check (validators/customerValidator.js)
  // for immediate feedback - the backend still re-validates on submit.
  const handlePanBlur = () => {
    const raw = (customerForm.pan || '').toString()
    if (!raw) { setCustomerFormErrors(prev => ({ ...prev, pan: undefined })); return }
    const normalized = normalizeGstField(raw)
    if (normalized !== raw) setCustomerForm(prev => ({ ...prev, pan: normalized }))
    setCustomerFormErrors(prev => ({
      ...prev,
      pan: PAN_REGEX.test(normalized) ? undefined : 'Invalid PAN format. Expected: ABCDE1234F'
    }))
  }

  const handleGstinBlur = () => {
    const raw = (customerForm.gstin || '').toString()
    if (!raw) { setCustomerFormErrors(prev => ({ ...prev, gstin: undefined })); return }
    const normalized = normalizeGstField(raw)
    if (normalized !== raw) setCustomerForm(prev => ({ ...prev, gstin: normalized }))
    if (!GSTIN_REGEX.test(normalized)) {
      setCustomerFormErrors(prev => ({ ...prev, gstin: 'Invalid GSTIN format. Expected 15 characters, e.g. 22ABCDE1234F1Z5' }))
      return
    }
    const selectedState = activeStates.find((s: any) => String(s.id) === String(customerForm.state_id))
    const gstStateCode = selectedState?.gst_state_code
    if (gstStateCode && normalized.slice(0, 2) !== gstStateCode) {
      setCustomerFormErrors(prev => ({ ...prev, gstin: `GSTIN state code (${normalized.slice(0, 2)}) does not match the selected State's GST state code (${gstStateCode})` }))
      return
    }
    setCustomerFormErrors(prev => ({ ...prev, gstin: undefined }))
  }

  const handlePincodeBlur = () => {
    const value = (customerForm.pincode || '').toString()
    if (!value) { setCustomerFormErrors(prev => ({ ...prev, pincode: undefined })); return }
    setCustomerFormErrors(prev => ({ ...prev, pincode: PINCODE_REGEX.test(value) ? undefined : 'PIN Code must be exactly 6 digits' }))
  }

  // Same PAN/GSTIN validation as Customer's, generalized across the four
  // Customer-Master-field-parity forms (Broker/Salesperson/Transport/Petrol
  // Pump) - only one of these tabs is ever open at a time.
  const getPartyForm = (): any => {
    if (activeTab === 'brokers') return brokerForm
    if (activeTab === 'salespersons') return salespersonForm
    if (activeTab === 'transport_master') return transportForm
    if (activeTab === 'petrol_pumps') return petrolPumpForm
    return {}
  }
  const setPartyForm = (patch: any) => {
    if (activeTab === 'brokers') setBrokerForm((prev: any) => ({ ...prev, ...patch }))
    else if (activeTab === 'salespersons') setSalespersonForm((prev: any) => ({ ...prev, ...patch }))
    else if (activeTab === 'transport_master') setTransportForm((prev: any) => ({ ...prev, ...patch }))
    else if (activeTab === 'petrol_pumps') setPetrolPumpForm((prev: any) => ({ ...prev, ...patch }))
  }
  const handlePartyPanBlur = () => {
    const raw = (getPartyForm().pan || '').toString()
    if (!raw) { setPartyFormErrors(prev => ({ ...prev, pan: undefined })); return }
    const normalized = normalizeGstField(raw)
    if (normalized !== raw) setPartyForm({ pan: normalized })
    setPartyFormErrors(prev => ({ ...prev, pan: PAN_REGEX.test(normalized) ? undefined : 'Invalid PAN format. Expected: ABCDE1234F' }))
  }
  const handlePartyGstinBlur = () => {
    const form = getPartyForm()
    const raw = (form.gstin || '').toString()
    if (!raw) { setPartyFormErrors(prev => ({ ...prev, gstin: undefined })); return }
    const normalized = normalizeGstField(raw)
    if (normalized !== raw) setPartyForm({ gstin: normalized })
    if (!GSTIN_REGEX.test(normalized)) {
      setPartyFormErrors(prev => ({ ...prev, gstin: 'Invalid GSTIN format. Expected 15 characters, e.g. 22ABCDE1234F1Z5' }))
      return
    }
    const selectedState = activeStates.find((s: any) => String(s.id) === String(form.state_id))
    const gstStateCode = selectedState?.gst_state_code
    if (gstStateCode && normalized.slice(0, 2) !== gstStateCode) {
      setPartyFormErrors(prev => ({ ...prev, gstin: `GSTIN state code (${normalized.slice(0, 2)}) does not match the selected State's GST state code (${gstStateCode})` }))
      return
    }
    setPartyFormErrors(prev => ({ ...prev, gstin: undefined }))
  }

  // Additional-address row management (customer_addresses child table). Cascading
  // reset: changing State clears District+Sub-District, changing District clears
  // Sub-District - mirrors the reference-data-tab.tsx parent-picker convention.
  const addAddressRow = () => {
    setCustomerForm(prev => ({ ...prev, addresses: [...(prev.addresses || []), blankCustomerAddress()] }))
  }
  const removeAddressRow = (index: number) => {
    setCustomerForm(prev => ({ ...prev, addresses: (prev.addresses || []).filter((_, i) => i !== index) }))
    setAddressErrors(prev => { const next = { ...prev }; delete next[index]; return next })
  }
  const updateAddressRow = (index: number, patch: Partial<CustomerAddress>) => {
    setCustomerForm(prev => ({
      ...prev,
      addresses: (prev.addresses || []).map((a, i) => (i === index ? { ...a, ...patch } : a)),
    }))
  }
  const handleAddressStateChange = (index: number, stateId: string) => {
    updateAddressRow(index, { state_id: stateId ? parseInt(stateId, 10) : null })
  }
  const handleAddressPincodeBlur = (index: number, value: string) => {
    if (!value) { setAddressErrors(prev => ({ ...prev, [index]: undefined })); return }
    setAddressErrors(prev => ({ ...prev, [index]: PINCODE_REGEX.test(value) ? undefined : 'PIN Code must be exactly 6 digits' }))
  }

  // Bank-account row management (customer_bank_accounts child table).
  const addBankAccountRow = () => {
    setCustomerForm(prev => ({ ...prev, bank_accounts: [...(prev.bank_accounts || []), blankCustomerBankAccount()] }))
  }
  const removeBankAccountRow = (index: number) => {
    setCustomerForm(prev => ({ ...prev, bank_accounts: (prev.bank_accounts || []).filter((_, i) => i !== index) }))
    setBankAccountErrors(prev => { const next = { ...prev }; delete next[index]; return next })
  }
  const updateBankAccountRow = (index: number, patch: Partial<CustomerBankAccount>) => {
    setCustomerForm(prev => ({
      ...prev,
      bank_accounts: (prev.bank_accounts || []).map((b, i) => (i === index ? { ...b, ...patch } : b)),
    }))
  }
  const handleBankAccountIfscBlur = (index: number, value: string) => {
    const normalized = value.trim().toUpperCase()
    if (normalized !== value) updateBankAccountRow(index, { ifsc_code: normalized })
    if (!normalized) { setBankAccountErrors(prev => ({ ...prev, [index]: undefined })); return }
    setBankAccountErrors(prev => ({ ...prev, [index]: IFSC_REGEX.test(normalized) ? undefined : 'Invalid IFSC format. Expected 11 characters, e.g. SBIN0001234' }))
  }

  // --- Render Helpers ---


  const renderCustomerForm = () => (
    <div className="grid gap-4 py-4 px-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="customer_id">Customer ID *</Label>
          <Input id="customer_id" value={customerForm.customer_id} readOnly className="bg-slate-100" placeholder="Auto-generated" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="customer_name">Customer Name *</Label>
          <Input id="customer_name" value={customerForm.customer_name} onChange={e => setCustomerForm({...customerForm, customer_name: e.target.value})} placeholder="Enter name" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select value={customerForm.status} onValueChange={val => setCustomerForm({...customerForm, status: val})}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={customerForm.email} onChange={e => setCustomerForm({...customerForm, email: e.target.value})} placeholder="email@example.com" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="contact_person">Contact Person</Label>
          <Input id="contact_person" value={customerForm.contact_person} onChange={e => setCustomerForm({...customerForm, contact_person: e.target.value})} placeholder="Enter name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact">Contact Number</Label>
          <Input id="contact" value={customerForm.contact} onChange={e => setCustomerForm({...customerForm, contact: e.target.value})} placeholder="Enter number" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="address_line_1">Address Line 1</Label>
        <Input id="address_line_1" value={customerForm.address_line_1} onChange={e => setCustomerForm({...customerForm, address_line_1: e.target.value})} placeholder="Street address" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="state">State</Label>
          <Combobox
            options={activeStates.map((s: any) => ({ value: String(s.id), label: s.state_name }))}
            value={customerForm.state_id ? String(customerForm.state_id) : ""}
            onValueChange={val => {
              const selected = activeStates.find((s: any) => String(s.id) === val)
              setCustomerForm({...customerForm, state_id: val ? parseInt(val, 10) : null, state: selected?.state_name || customerForm.state })
            }}
            placeholder="Select state"
            searchPlaceholder="Search state..."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pincode">Pincode</Label>
          <Input
            id="pincode"
            value={customerForm.pincode}
            onChange={e => setCustomerForm({...customerForm, pincode: e.target.value.replace(/[^0-9]/g, '').slice(0, 6)})}
            onBlur={handlePincodeBlur}
            placeholder="6-digit PIN code"
            className={customerFormErrors.pincode ? 'border-red-500 focus-visible:ring-red-400' : ''}
          />
          {customerFormErrors.pincode && <p className="text-xs text-red-500 mt-1">{customerFormErrors.pincode}</p>}
        </div>
      </div>


      <div className="border-t pt-4 mt-2 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-slate-600">Additional Addresses</Label>
          <Button type="button" variant="outline" size="sm" onClick={addAddressRow}>+ Add Address</Button>
        </div>
        {(!customerForm.addresses || customerForm.addresses.length === 0) && (
          <p className="text-xs text-slate-400">No additional addresses added. The address fields above remain the customer's primary address.</p>
        )}
        {(customerForm.addresses || []).map((addr, index) => {
          const rowState = activeStates.find((s: any) => String(s.id) === String(addr.state_id))
          return (
            <div key={index} className="rounded-lg border border-slate-200 p-3 space-y-3 relative">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Address {index + 1}</span>
                <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-red-600 hover:text-red-700" onClick={() => removeAddressRow(index)}>Remove</Button>
              </div>
              <Input value={addr.address_line_1 || ''} onChange={e => updateAddressRow(index, { address_line_1: e.target.value })} placeholder="Address" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input value={addr.city || ''} onChange={e => updateAddressRow(index, { city: e.target.value })} placeholder="City" />
                <Input value={addr.post || ''} onChange={e => updateAddressRow(index, { post: e.target.value })} placeholder="Post" />
                <Input value={addr.thana || ''} onChange={e => updateAddressRow(index, { thana: e.target.value })} placeholder="Thana" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Combobox
                  options={activeStates.map((s: any) => ({ value: String(s.id), label: `${s.state_name} (${s.gst_state_code} / ${s.short_name || '—'})` }))}
                  value={addr.state_id ? String(addr.state_id) : ""}
                  onValueChange={val => handleAddressStateChange(index, val)}
                  placeholder="State" searchPlaceholder="Search state..."
                />
                <Input value={addr.district || ''} onChange={e => updateAddressRow(index, { district: e.target.value })} placeholder="District" />
                <Input value={addr.sub_district || ''} onChange={e => updateAddressRow(index, { sub_district: e.target.value })} placeholder="Sub-District" />
              </div>
              {rowState && (
                <p className="text-[11px] text-slate-400">
                  State Code: <span className="font-medium text-slate-600">{rowState.gst_state_code}</span>
                  {" · "}Short Name: <span className="font-medium text-slate-600">{rowState.short_name || '—'}</span>
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Input
                    value={addr.pincode || ''}
                    onChange={e => updateAddressRow(index, { pincode: e.target.value.replace(/[^0-9]/g, '').slice(0, 6) })}
                    onBlur={e => handleAddressPincodeBlur(index, e.target.value)}
                    placeholder="PIN Code (6 digits)"
                    className={addressErrors[index] ? 'border-red-500 focus-visible:ring-red-400' : ''}
                  />
                  {addressErrors[index] && <p className="text-xs text-red-500 mt-1">{addressErrors[index]}</p>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="pan">PAN</Label>
          <Input
            id="pan"
            value={customerForm.pan}
            onChange={e => setCustomerForm({...customerForm, pan: e.target.value})}
            onBlur={handlePanBlur}
            placeholder="ABCDE1234F"
            className={customerFormErrors.pan ? 'border-red-500 focus-visible:ring-red-400' : ''}
          />
          {customerFormErrors.pan && <p className="text-xs text-red-500 mt-1">{customerFormErrors.pan}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="gstin">GSTIN</Label>
          <Input
            id="gstin"
            value={customerForm.gstin}
            onChange={e => setCustomerForm({...customerForm, gstin: e.target.value})}
            onBlur={handleGstinBlur}
            placeholder="22ABCDE1234F1Z5"
            className={customerFormErrors.gstin ? 'border-red-500 focus-visible:ring-red-400' : ''}
          />
          {customerFormErrors.gstin && <p className="text-xs text-red-500 mt-1">{customerFormErrors.gstin}</p>}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="gst_registered">GST Registration Status</Label>
          <Combobox
            options={activeGstRegStatuses.map((r: any) => ({ value: r.name, label: r.name }))}
            value={customerForm.gst_registered || ""}
            onValueChange={val => setCustomerForm({
              ...customerForm,
              gst_registered: val,
              // Unregistered has no meaningful type/wef - clear them so stale values
              // from a prior "Registered" state don't linger.
              ...(val !== 'Registered' ? { gst_registration_type: '', gst_registration_wef: '' } : {})
            })}
            placeholder="Select status"
            searchPlaceholder="Search..."
          />
        </div>
        {customerForm.gst_registered === 'Registered' && (
          <div className="space-y-2">
            <Label htmlFor="gst_registration_type">GST Registration Type</Label>
            <Combobox
              options={activeGstRegTypes.map((r: any) => ({ value: r.name, label: r.name }))}
              value={customerForm.gst_registration_type || ""}
              onValueChange={val => setCustomerForm({...customerForm, gst_registration_type: val})}
              placeholder="Select type"
              searchPlaceholder="Search..."
            />
          </div>
        )}
      </div>
      {customerForm.gst_registered === 'Registered' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="gst_registration_wef">GST W.E.F. Date</Label>
            <Input
              id="gst_registration_wef"
              type="date"
              value={customerForm.gst_registration_wef?.split('T')[0] || ''}
              onChange={e => setCustomerForm({...customerForm, gst_registration_wef: e.target.value})}
            />
            {customerForm.gst_registration_wef && (
              <p className="text-xs text-slate-500">{formatDocDate(customerForm.gst_registration_wef)}</p>
            )}
          </div>
        </div>
      )}
      <div className="border-t pt-4 mt-2 space-y-4">
        <Label className="text-slate-600">MSME Details</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="msme_registration_no">MSME Registration No</Label>
            <Input
              id="msme_registration_no"
              value={customerForm.msme_registration_no || ''}
              onChange={e => setCustomerForm({...customerForm, msme_registration_no: e.target.value})}
              placeholder="Enter MSME registration no"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="msme_registration_type">MSME Registration Type</Label>
            <Combobox
              options={activeMsmeRegTypes.map((r: any) => ({ value: r.name, label: r.name }))}
              value={customerForm.msme_registration_type || ""}
              onValueChange={val => setCustomerForm({...customerForm, msme_registration_type: val})}
              placeholder="Select type"
              searchPlaceholder="Search..."
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="msme_registration_wef">MSME W.E.F. Date</Label>
            <Input
              id="msme_registration_wef"
              type="date"
              value={customerForm.msme_registration_wef?.split('T')[0] || ''}
              onChange={e => setCustomerForm({...customerForm, msme_registration_wef: e.target.value})}
            />
            {customerForm.msme_registration_wef && (
              <p className="text-xs text-slate-500">{formatDocDate(customerForm.msme_registration_wef)}</p>
            )}
          </div>
        </div>
      </div>

      <div className="border-t pt-4 mt-2 space-y-4">
        <Label className="text-slate-600">FSSAI Details</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="fssai_no">FSSAI No</Label>
            <Input
              id="fssai_no"
              value={customerForm.fssai_no || ''}
              onChange={e => setCustomerForm({...customerForm, fssai_no: e.target.value})}
              placeholder="Enter FSSAI no"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fssai_licence_type">FSSAI Licence Type</Label>
            <Combobox
              options={activeFssaiLicenceTypes.map((r: any) => ({ value: r.name, label: r.name }))}
              value={customerForm.fssai_licence_type || ""}
              onValueChange={val => setCustomerForm({...customerForm, fssai_licence_type: val})}
              placeholder="Select licence type"
              searchPlaceholder="Search..."
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="fssai_valid_upto">FSSAI Valid Upto Date</Label>
            <Input
              id="fssai_valid_upto"
              type="date"
              value={customerForm.fssai_valid_upto?.split('T')[0] || ''}
              onChange={e => setCustomerForm({...customerForm, fssai_valid_upto: e.target.value})}
            />
            {customerForm.fssai_valid_upto && (
              <p className="text-xs text-slate-500">{formatDocDate(customerForm.fssai_valid_upto)}</p>
            )}
          </div>
        </div>
      </div>

      <div className="border-t pt-4 mt-2 space-y-4">
        <Label className="text-slate-600">Document Uploads</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FileUploadField
            label="Aadhaar Card"
            accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
            value={customerForm.aadhaar_upload || ""}
            helperText="Max file size: 20 MB"
            uploading={false}
            onFilesSelected={(files) => files[0] && handleFileUpload(files[0], "aadhaar_upload")}
            onRemove={() => handleFileRemove("aadhaar_upload")}
          />
          <FileUploadField
            label="PAN Card"
            accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
            value={customerForm.pan_upload || ""}
            helperText="Max file size: 20 MB"
            uploading={false}
            onFilesSelected={(files) => files[0] && handleFileUpload(files[0], "pan_upload")}
            onRemove={() => handleFileRemove("pan_upload")}
          />
          <FileUploadField
            label="GST Certificate"
            accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
            value={customerForm.gst_certificate_upload || ""}
            helperText="Max file size: 20 MB"
            uploading={false}
            onFilesSelected={(files) => files[0] && handleFileUpload(files[0], "gst_certificate_upload")}
            onRemove={() => handleFileRemove("gst_certificate_upload")}
          />
          <FileUploadField
            label="MSME Certificate"
            accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
            value={customerForm.msme_certificate_upload || ""}
            helperText="Max file size: 20 MB"
            uploading={false}
            onFilesSelected={(files) => files[0] && handleFileUpload(files[0], "msme_certificate_upload")}
            onRemove={() => handleFileRemove("msme_certificate_upload")}
          />
          <FileUploadField
            label="FSSAI Certificate"
            accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
            value={customerForm.fssai_certificate_upload || ""}
            helperText="Max file size: 20 MB"
            uploading={false}
            onFilesSelected={(files) => files[0] && handleFileUpload(files[0], "fssai_certificate_upload")}
            onRemove={() => handleFileRemove("fssai_certificate_upload")}
          />
        </div>
      </div>

      <div className="border-t pt-4 mt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Belongs to Which Godown</Label>
          <div className="grid grid-cols-2 gap-2 rounded-md border border-slate-200 p-2">
            {godownDepots.map((d: any) => {
              const checked = (customerForm.godown_ids || []).includes(d.id)
              return (
                <label key={d.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(val) => {
                      const current = customerForm.godown_ids || []
                      setCustomerForm({
                        ...customerForm,
                        godown_ids: val ? [...current, d.id] : current.filter((id: number) => id !== d.id),
                      })
                    }}
                  />
                  {d.depot_name}
                </label>
              )
            })}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="is_required_for_commitment">Is Required for Commitment</Label>
          <Select value={customerForm.is_required_for_commitment || "No"} onValueChange={val => setCustomerForm({...customerForm, is_required_for_commitment: val})}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Yes">Yes</SelectItem>
              <SelectItem value="No">No</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border-t pt-4 mt-2 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-slate-600">Bank Details</Label>
          <Button type="button" variant="outline" size="sm" onClick={addBankAccountRow}>+ Add Bank Account</Button>
        </div>
        {(!customerForm.bank_accounts || customerForm.bank_accounts.length === 0) && (
          <p className="text-xs text-slate-400">No bank details added.</p>
        )}
        {(customerForm.bank_accounts || []).map((bank, index) => (
          <div key={index} className="rounded-lg border border-slate-200 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Bank Account {index + 1}</span>
              <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-red-600 hover:text-red-700" onClick={() => removeBankAccountRow(index)}>Remove</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Combobox
                  options={activeBankNames.map((b: any) => ({ value: String(b.id), label: b.name }))}
                  value={bank.bank_name_id ? String(bank.bank_name_id) : ""}
                  onValueChange={val => updateBankAccountRow(index, { bank_name_id: val ? parseInt(val, 10) : null })}
                  placeholder="Bank Name"
                  searchPlaceholder="Search bank..."
                />
                <Input
                  value={bank.account_holder_name || ''}
                  onChange={e => updateBankAccountRow(index, { account_holder_name: e.target.value })}
                  placeholder="Account Holder Name"
                />
                <Input
                  value={bank.account_number || ''}
                  onChange={e => updateBankAccountRow(index, { account_number: e.target.value })}
                  placeholder="Account Number"
                />
                <div>
                  <Input
                    value={bank.ifsc_code || ''}
                    onChange={e => updateBankAccountRow(index, { ifsc_code: e.target.value.toUpperCase() })}
                    onBlur={e => handleBankAccountIfscBlur(index, e.target.value)}
                    placeholder="IFSC Code"
                    className={bankAccountErrors[index] ? 'border-red-500 focus-visible:ring-red-400' : ''}
                  />
                  {bankAccountErrors[index] && <p className="text-xs text-red-500 mt-1">{bankAccountErrors[index]}</p>}
                </div>
              </div>
          </div>
        ))}
      </div>

      <div className="space-y-2 border-t pt-4 mt-2">
        <Label htmlFor="ledger_group_id">Ledger Group</Label>
        <Select value={customerForm.ledger_group_id ? String(customerForm.ledger_group_id) : ''} onValueChange={val => setCustomerForm({...customerForm, ledger_group_id: val})}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Select ledger group" /></SelectTrigger>
          <SelectContent>
            {ledgerGroupOptions.map((g: any) => <SelectItem key={g.id} value={String(g.id)}>{g.group_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {editingItem?.id && (
        <div className="space-y-2 border-t pt-4 mt-2">
          <Label className="text-slate-600">GST History</Label>
          {!customerGstHistoryData || customerGstHistoryData.length === 0 ? (
            <p className="text-xs text-slate-400">No GST history recorded yet.</p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left p-2 font-medium text-slate-600">W.E.F. Date</th>
                    <th className="text-left p-2 font-medium text-slate-600">Status</th>
                    <th className="text-left p-2 font-medium text-slate-600">Type</th>
                    <th className="text-left p-2 font-medium text-slate-600">GSTIN</th>
                  </tr>
                </thead>
                <tbody>
                  {customerGstHistoryData.map((h: any) => (
                    <tr key={h.id} className="border-t">
                      <td className="p-2">{formatDocDate(h.wefDate)}</td>
                      <td className="p-2">{h.isGstRegistered || '—'}</td>
                      <td className="p-2">{h.gstRegistrationType || '—'}</td>
                      <td className="p-2">{h.gstin || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )

  const renderDepotForm = () => (
    <div className="grid gap-4 py-4 px-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="depot_id">Depot ID *</Label>
          <Input id="depot_id" value={depotForm.depot_id} readOnly className="bg-slate-100" placeholder="Auto-generated" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="depot_name">Depot Name *</Label>
          <Input id="depot_name" value={depotForm.depot_name} onChange={e => setDepotForm({...depotForm, depot_name: e.target.value})} placeholder="Enter name" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select value={depotForm.status} onValueChange={val => setDepotForm({...depotForm, status: val})}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">State</Label>
          <Combobox
            options={activeStates.map((s: any) => ({ value: String(s.id), label: s.state_name }))}
            value={depotForm.state_id ? String(depotForm.state_id) : ""}
            onValueChange={val => {
              const selected = activeStates.find((s: any) => String(s.id) === val)
              setDepotForm({...depotForm, state_id: val ? parseInt(val, 10) : null, state: selected?.state_name || depotForm.state })
            }}
            placeholder="Select state"
            searchPlaceholder="Search state..."
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="depot_address">Depot Address</Label>
        <Input id="depot_address" value={depotForm.depot_address} onChange={e => setDepotForm({...depotForm, depot_address: e.target.value})} placeholder="Full address" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="salesman_ref">Salesman/Broker Name</Label>
        <Input id="salesman_ref" value={depotForm.salesman_broker_name} onChange={e => setDepotForm({...depotForm, salesman_broker_name: e.target.value})} placeholder="Enter name" />
      </div>

      <div className="space-y-2 border-t pt-4 mt-2">
        <Label>Salesman / Broker Tags</Label>
        <p className="text-xs text-slate-400">Tag brokers and/or salespersons assigned to this depot (combined list, multi-select).</p>
        <div className="grid grid-cols-2 gap-2 rounded-md border border-slate-200 p-2 max-h-40 overflow-y-auto">
          {brokerOptions.map((b: any) => {
            const checked = (depotForm.agent_tags || []).some(t => t.agent_type === 'broker' && t.agent_id === b.id)
            return (
              <label key={`broker-${b.id}`} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(val) => {
                    const current = depotForm.agent_tags || []
                    setDepotForm({
                      ...depotForm,
                      agent_tags: val
                        ? [...current, { agent_type: 'broker', agent_id: b.id }]
                        : current.filter(t => !(t.agent_type === 'broker' && t.agent_id === b.id)),
                    })
                  }}
                />
                {b.salesman_name} <span className="text-slate-400">(Broker)</span>
              </label>
            )
          })}
          {salespersonOptions.map((s: any) => {
            const checked = (depotForm.agent_tags || []).some(t => t.agent_type === 'salesperson' && t.agent_id === s.id)
            return (
              <label key={`salesperson-${s.id}`} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(val) => {
                    const current = depotForm.agent_tags || []
                    setDepotForm({
                      ...depotForm,
                      agent_tags: val
                        ? [...current, { agent_type: 'salesperson', agent_id: s.id }]
                        : current.filter(t => !(t.agent_type === 'salesperson' && t.agent_id === s.id)),
                    })
                  }}
                />
                {s.salesman_name} <span className="text-slate-400">(Salesperson)</span>
              </label>
            )
          })}
        </div>
      </div>

      <div className="border-t pt-4 mt-2 space-y-4">
        <Label className="text-slate-600">Document Uploads</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FileUploadField
            label="Agreement Paper"
            accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
            value={depotForm.agreement_paper_upload || ""}
            helperText="Max file size: 20 MB"
            uploading={false}
            onFilesSelected={(files) => files[0] && handleFileUpload(files[0], "agreement_paper_upload")}
            onRemove={() => handleFileRemove("agreement_paper_upload")}
          />
          <FileUploadField
            label="Depot Owner GST Certificate"
            accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
            value={depotForm.depot_owner_gst_certificate_upload || ""}
            helperText="Max file size: 20 MB"
            uploading={false}
            onFilesSelected={(files) => files[0] && handleFileUpload(files[0], "depot_owner_gst_certificate_upload")}
            onRemove={() => handleFileRemove("depot_owner_gst_certificate_upload")}
          />
          <FileUploadField
            label="PAN Card"
            accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
            value={depotForm.pan_card_upload || ""}
            helperText="Max file size: 20 MB"
            uploading={false}
            onFilesSelected={(files) => files[0] && handleFileUpload(files[0], "pan_card_upload")}
            onRemove={() => handleFileRemove("pan_card_upload")}
          />
          <FileUploadField
            label="Aadhaar Card"
            accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
            value={depotForm.aadhaar_card_upload || ""}
            helperText="Max file size: 20 MB"
            uploading={false}
            onFilesSelected={(files) => files[0] && handleFileUpload(files[0], "aadhaar_card_upload")}
            onRemove={() => handleFileRemove("aadhaar_card_upload")}
          />
        </div>
      </div>
    </div>
  )


  // Customer-Master field parity block (Phases 10/11/12/21, review Sections
  // 6/7/8/19) - "include the same applicable fields as Customer Master
  // because some [brokers/salespersons/transporters/petrol pumps] may have
  // GST registration." Shared across all four forms since the field set and
  // behavior (PAN/GSTIN format + state-code validation) is identical.
  const renderPartyParityFields = (form: any) => {
    const setForm = setPartyForm
    return (
    <>
      <div className="border-t pt-4 mt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>State</Label>
          <Combobox
            options={activeStates.map((s: any) => ({ value: String(s.id), label: s.state_name }))}
            value={form.state_id ? String(form.state_id) : ""}
            onValueChange={val => {
              const selected = activeStates.find((s: any) => String(s.id) === val)
              setForm({ state_id: val ? parseInt(val, 10) : null, state: selected?.state_name || form.state })
            }}
            placeholder="Select state"
            searchPlaceholder="Search state..."
          />
        </div>
        <div className="space-y-2">
          <Label>PAN</Label>
          <Input
            value={form.pan || ''}
            onChange={e => setForm({ pan: e.target.value })}
            onBlur={handlePartyPanBlur}
            placeholder="ABCDE1234F"
            className={partyFormErrors.pan ? 'border-red-500 focus-visible:ring-red-400' : ''}
          />
          {partyFormErrors.pan && <p className="text-xs text-red-500 mt-1">{partyFormErrors.pan}</p>}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>GSTIN</Label>
          <Input
            value={form.gstin || ''}
            onChange={e => setForm({ gstin: e.target.value })}
            onBlur={handlePartyGstinBlur}
            placeholder="22ABCDE1234F1Z5"
            className={partyFormErrors.gstin ? 'border-red-500 focus-visible:ring-red-400' : ''}
          />
          {partyFormErrors.gstin && <p className="text-xs text-red-500 mt-1">{partyFormErrors.gstin}</p>}
        </div>
        <div className="space-y-2">
          <Label>GST Registration Status</Label>
          <Combobox
            options={activeGstRegStatuses.map((r: any) => ({ value: r.name, label: r.name }))}
            value={form.gst_registered || ""}
            onValueChange={val => setForm({
              gst_registered: val,
              ...(val !== 'Registered' ? { gst_registration_type: '', gst_registration_wef: '' } : {})
            })}
            placeholder="Select status"
            searchPlaceholder="Search..."
          />
        </div>
      </div>
      {form.gst_registered === 'Registered' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>GST Registration Type</Label>
            <Combobox
              options={activeGstRegTypes.map((r: any) => ({ value: r.name, label: r.name }))}
              value={form.gst_registration_type || ""}
              onValueChange={val => setForm({ gst_registration_type: val })}
              placeholder="Select type"
              searchPlaceholder="Search..."
            />
          </div>
          <div className="space-y-2">
            <Label>GST W.E.F. Date</Label>
            <Input type="date" value={form.gst_registration_wef?.split('T')[0] || ''} onChange={e => setForm({ gst_registration_wef: e.target.value })} />
          </div>
        </div>
      )}
      <div className="border-t pt-4 mt-2 space-y-4">
        <Label className="text-slate-600">MSME Details</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>MSME Registration No</Label>
            <Input value={form.msme_registration_no || ''} onChange={e => setForm({ msme_registration_no: e.target.value })} placeholder="Enter MSME registration no" />
          </div>
          <div className="space-y-2">
            <Label>MSME Registration Type</Label>
            <Combobox
              options={activeMsmeRegTypes.map((r: any) => ({ value: r.name, label: r.name }))}
              value={form.msme_registration_type || ""}
              onValueChange={val => setForm({ msme_registration_type: val })}
              placeholder="Select type"
              searchPlaceholder="Search..."
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>MSME W.E.F. Date</Label>
          <Input type="date" value={form.msme_registration_wef?.split('T')[0] || ''} onChange={e => setForm({ msme_registration_wef: e.target.value })} />
        </div>
      </div>
      <div className="border-t pt-4 mt-2 space-y-4">
        <Label className="text-slate-600">FSSAI Details</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>FSSAI No</Label>
            <Input value={form.fssai_no || ''} onChange={e => setForm({ fssai_no: e.target.value })} placeholder="Enter FSSAI no" />
          </div>
          <div className="space-y-2">
            <Label>FSSAI Licence Type</Label>
            <Combobox
              options={activeFssaiLicenceTypes.map((r: any) => ({ value: r.name, label: r.name }))}
              value={form.fssai_licence_type || ""}
              onValueChange={val => setForm({ fssai_licence_type: val })}
              placeholder="Select licence type"
              searchPlaceholder="Search..."
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>FSSAI Valid Upto Date</Label>
          <Input type="date" value={form.fssai_valid_upto?.split('T')[0] || ''} onChange={e => setForm({ fssai_valid_upto: e.target.value })} />
        </div>
      </div>
      <div className="border-t pt-4 mt-2 space-y-4">
        <Label className="text-slate-600">Document Uploads</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FileUploadField
            label="Aadhaar Card"
            accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
            value={form.aadhaar_upload || ""}
            helperText="Max file size: 20 MB"
            uploading={false}
            onFilesSelected={(files) => files[0] && handleFileUpload(files[0], "aadhaar_upload")}
            onRemove={() => handleFileRemove("aadhaar_upload")}
          />
          <FileUploadField
            label="PAN Card"
            accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
            value={form.pan_upload || ""}
            helperText="Max file size: 20 MB"
            uploading={false}
            onFilesSelected={(files) => files[0] && handleFileUpload(files[0], "pan_upload")}
            onRemove={() => handleFileRemove("pan_upload")}
          />
          <FileUploadField
            label="GST Certificate"
            accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
            value={form.gst_certificate_upload || ""}
            helperText="Max file size: 20 MB"
            uploading={false}
            onFilesSelected={(files) => files[0] && handleFileUpload(files[0], "gst_certificate_upload")}
            onRemove={() => handleFileRemove("gst_certificate_upload")}
          />
          <FileUploadField
            label="MSME Certificate"
            accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
            value={form.msme_certificate_upload || ""}
            helperText="Max file size: 20 MB"
            uploading={false}
            onFilesSelected={(files) => files[0] && handleFileUpload(files[0], "msme_certificate_upload")}
            onRemove={() => handleFileRemove("msme_certificate_upload")}
          />
          <FileUploadField
            label="FSSAI Certificate"
            accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
            value={form.fssai_certificate_upload || ""}
            helperText="Max file size: 20 MB"
            uploading={false}
            onFilesSelected={(files) => files[0] && handleFileUpload(files[0], "fssai_certificate_upload")}
            onRemove={() => handleFileRemove("fssai_certificate_upload")}
          />
        </div>
      </div>
    </>
  )
  }

  const renderBrokerForm = () => (
    <div className="grid gap-4 py-4 px-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="broker_id">Broker ID *</Label>
          <Input id="broker_id" value={brokerForm.broker_id} readOnly className="bg-slate-100" placeholder="Auto-generated" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="salesman_name">Broker Name *</Label>
          <Input id="salesman_name" value={brokerForm.salesman_name} onChange={e => setBrokerForm({...brokerForm, salesman_name: e.target.value})} placeholder="Enter name" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select value={brokerForm.status} onValueChange={val => setBrokerForm({...brokerForm, status: val})}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="mobile_no">Mobile Number</Label>
          <Input id="mobile_no" value={brokerForm.mobile_no} onChange={e => setBrokerForm({...brokerForm, mobile_no: e.target.value})} placeholder="Enter number" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="email_id">Email ID</Label>
          <Input id="email_id" value={brokerForm.email_id} onChange={e => setBrokerForm({...brokerForm, email_id: e.target.value})} placeholder="email@example.com" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ledger_group_id">Ledger Group</Label>
          <Select value={brokerForm.ledger_group_id ? String(brokerForm.ledger_group_id) : ''} onValueChange={val => setBrokerForm({...brokerForm, ledger_group_id: val})}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select ledger group" /></SelectTrigger>
            <SelectContent>
              {ledgerGroupOptions.map((g: any) => <SelectItem key={g.id} value={String(g.id)}>{g.group_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      {renderPartyParityFields(brokerForm)}
    </div>
  )

  const renderSalespersonForm = () => (
    <div className="grid gap-4 py-4 px-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="broker_id">Salesperson ID *</Label>
          <Input id="broker_id" value={salespersonForm.broker_id} readOnly className="bg-slate-100" placeholder="Auto-generated" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="salesman_name">Salesman Name *</Label>
          <Input id="salesman_name" value={salespersonForm.salesman_name} onChange={e => setSalespersonForm({...salespersonForm, salesman_name: e.target.value})} placeholder="Enter name" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select value={salespersonForm.status} onValueChange={val => setSalespersonForm({...salespersonForm, status: val})}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="mobile_no">Mobile Number</Label>
          <Input id="mobile_no" value={salespersonForm.mobile_no} onChange={e => setSalespersonForm({...salespersonForm, mobile_no: e.target.value})} placeholder="Enter number" />
        </div>
      </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="email_id">Email ID</Label>
            <Input id="email_id" value={salespersonForm.email_id} onChange={e => setSalespersonForm({...salespersonForm, email_id: e.target.value})} placeholder="email@example.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="employee_id">Employee ID</Label>
            <Input id="employee_id" value={salespersonForm.employee_id || ''} onChange={e => setSalespersonForm({...salespersonForm, employee_id: e.target.value})} placeholder="Enter employee ID" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="ledger_group_id">Ledger Group</Label>
            <Select value={salespersonForm.ledger_group_id ? String(salespersonForm.ledger_group_id) : ''} onValueChange={val => setSalespersonForm({...salespersonForm, ledger_group_id: val})}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select ledger group" /></SelectTrigger>
              <SelectContent>
                {ledgerGroupOptions.map((g: any) => <SelectItem key={g.id} value={String(g.id)}>{g.group_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      {renderPartyParityFields(salespersonForm)}
    </div>
  )

  const renderLedgerGroupForm = () => (
    <div className="grid gap-4 py-4 px-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="group_code">Group Code *</Label>
          <Input id="group_code" value={ledgerGroupForm.group_code} readOnly className="bg-slate-100" placeholder="Auto-generated" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="group_name">Group Name *</Label>
          <Input id="group_name" value={ledgerGroupForm.group_name} onChange={e => setLedgerGroupForm({...ledgerGroupForm, group_name: e.target.value})} placeholder="Enter ledger group name" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Under (Parent Group)</Label>
          <Combobox
            options={(ledgerGroupOptionsData || []).map((g: any) => ({ value: String(g.id), label: g.group_name }))}
            value={ledgerGroupForm.parent_id ? String(ledgerGroupForm.parent_id) : ""}
            onValueChange={val => setLedgerGroupForm({...ledgerGroupForm, parent_id: val ? parseInt(val, 10) : null, nature_of_group: ""})}
            placeholder="Select parent group"
            searchPlaceholder="Search groups..."
          />
        </div>
        
        {/* TALLY LOGIC: Show Nature of Group ONLY if Under is Primary */}
        {ledgerGroupForm.parent_id === ledgerGroupOptionsData?.find((g: any) => g.group_name === 'Primary')?.id && (
          <div className="space-y-2">
            <Label>Nature of Group</Label>
            <Select value={ledgerGroupForm.nature_of_group} onValueChange={val => setLedgerGroupForm({...ledgerGroupForm, nature_of_group: val})}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select Nature" /></SelectTrigger>
              <SelectContent>
                {['Assets', 'Liabilities', 'Income', 'Expenses'].map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select value={ledgerGroupForm.status} onValueChange={val => setLedgerGroupForm({...ledgerGroupForm, status: val})}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )

  const renderStockGroupForm = () => (
    <div className="grid gap-4 py-4 px-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="group_code">Group Code *</Label>
          <Input id="group_code" value={stockGroupForm.group_code} readOnly className="bg-slate-100" placeholder="Auto-generated" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="group_name">Group Name *</Label>
          <Input id="group_name" value={stockGroupForm.group_name} onChange={e => setStockGroupForm({...stockGroupForm, group_name: e.target.value})} placeholder="Enter stock group name" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Under (Parent Group)</Label>
          <Combobox
            options={(stockGroupOptionsData || []).map((g: any) => ({ value: String(g.id), label: g.group_name }))}
            value={stockGroupForm.parent_id ? String(stockGroupForm.parent_id) : ""}
            onValueChange={val => setStockGroupForm({...stockGroupForm, parent_id: val ? parseInt(val, 10) : null})}
            placeholder="Select parent group"
            searchPlaceholder="Search groups..."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select value={stockGroupForm.status} onValueChange={val => setStockGroupForm({...stockGroupForm, status: val})}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )

  const renderUnitForm = () => (
    <div className="grid gap-4 py-4 px-1">
      <div className="space-y-2">
        <Label htmlFor="unit_code">Unit Code *</Label>
        <Input id="unit_code" value={unitForm.unit_code} readOnly className="bg-slate-100" placeholder="Auto-generated" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="unit_name">UOM *</Label>
        <Input id="unit_name" value={unitForm.unit_name} onChange={e => setUnitForm({...unitForm, unit_name: e.target.value})} placeholder="e.g. Kilograms" />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="unit_is_active" checked={unitForm.status === 'Active'} onCheckedChange={checked => setUnitForm({...unitForm, status: checked === true ? 'Active' : 'Inactive'})} />
        <Label htmlFor="unit_is_active" className="cursor-pointer">Is Active?</Label>
      </div>
    </div>
  )

  const renderRawMaterialForm = () => (
    <div className="grid gap-4 py-4 px-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="raw_material_code">Raw Material Code *</Label>
          <Input id="raw_material_code" value={rawMaterialForm.raw_material_code} readOnly className="bg-slate-100" placeholder="Auto-generated" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Name *</Label>
          <Input id="name" value={rawMaterialForm.name} onChange={e => setRawMaterialForm({...rawMaterialForm, name: e.target.value})} placeholder="Enter raw material name" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2 min-w-0">
          <Label htmlFor="main_uom_id">UOM</Label>
          <div className="flex items-center gap-2">
            <Select value={rawMaterialForm.main_uom_id ? String(rawMaterialForm.main_uom_id) : ''} onValueChange={val => setRawMaterialForm({...rawMaterialForm, main_uom_id: val})}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select UOM" /></SelectTrigger>
              <SelectContent>
                {unitOptions.map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.unit_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => openQuickAdd('unit', (id) => setRawMaterialForm((prev: any) => ({ ...prev, main_uom_id: String(id) })))}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="space-y-2 min-w-0">
          <Label htmlFor="stock_group_id">Stock Group</Label>
          <Select value={rawMaterialForm.stock_group_id ? String(rawMaterialForm.stock_group_id) : ''} onValueChange={val => setRawMaterialForm({...rawMaterialForm, stock_group_id: val})}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select stock group" /></SelectTrigger>
            <SelectContent>
              {stockGroupOptions.map((g: any) => <SelectItem key={g.id} value={String(g.id)}>{g.group_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      {(showAdditionalUomSection || (rawMaterialForm.additional_uoms || []).length > 0) ? (
        <div className="rounded-lg border border-slate-200 p-4 space-y-4">
          <p className="font-semibold text-sm text-slate-800">Additional UOM</p>
          {(rawMaterialForm.additional_uoms || []).length > 0 && (
            <div className="space-y-2">
              {(rawMaterialForm.additional_uoms || []).map((row: RawMaterialAdditionalUom, idx: number) => {
                const uom = unitOptions.find((u: any) => String(u.id) === String(row.uom_id))
                return (
                  <div key={idx} className="flex items-center justify-between gap-2 bg-slate-50 rounded-md px-3 py-2 text-sm">
                    <span>{uom?.unit_name || `UOM #${row.uom_id}`} — 1 = {row.conversion_ratio} base UOM</span>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-red-50" onClick={() => setRawMaterialForm((prev: any) => ({ ...prev, additional_uoms: prev.additional_uoms.filter((_: any, i: number) => i !== idx) }))}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
          {showAdditionalUomSection ? (
          <div className="bg-slate-50/60 rounded-lg p-4 space-y-4">
            <div className="space-y-2 min-w-0">
              <Label htmlFor="new_additional_uom_id">Additional UOM</Label>
              <div className="flex items-center gap-2">
                <Select value={newAdditionalUom.uom_id} onValueChange={val => setNewAdditionalUom({...newAdditionalUom, uom_id: val})}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select UOM" /></SelectTrigger>
                  <SelectContent>
                    {unitOptions.map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.unit_name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => openQuickAdd('unit', (id) => setNewAdditionalUom(prev => ({ ...prev, uom_id: String(id) })))}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_additional_uom_ratio">How many base UOM in 1 additional UOM?</Label>
              <Input id="new_additional_uom_ratio" type="number" min={0} value={newAdditionalUom.conversion_ratio} onChange={e => setNewAdditionalUom({...newAdditionalUom, conversion_ratio: e.target.value})} placeholder="e.g. 10" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => {
                setNewAdditionalUom({ uom_id: '', conversion_ratio: '' })
                setShowAdditionalUomSection(false)
              }}>Cancel</Button>
              <Button
                type="button"
                onClick={() => {
                  if (!newAdditionalUom.uom_id || !newAdditionalUom.conversion_ratio) {
                    toast({ title: "Error", description: "Select a UOM and enter the conversion ratio", variant: "destructive" })
                    return
                  }
                  setRawMaterialForm((prev: any) => ({ ...prev, additional_uoms: [...(prev.additional_uoms || []), { uom_id: newAdditionalUom.uom_id, conversion_ratio: newAdditionalUom.conversion_ratio }] }))
                  setNewAdditionalUom({ uom_id: '', conversion_ratio: '' })
                  setShowAdditionalUomSection(false)
                }}
              >
                Add
              </Button>
            </div>
          </div>
          ) : (
            <Button type="button" variant="outline" className="w-fit" onClick={() => setShowAdditionalUomSection(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Another UOM
            </Button>
          )}
        </div>
      ) : (
        <Button type="button" variant="outline" className="w-fit" onClick={() => setShowAdditionalUomSection(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Additional UOM
        </Button>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2 min-w-0">
          <Label htmlFor="type_of_supply">Type of Supply</Label>
          <Select value={rawMaterialForm.type_of_supply || ''} onValueChange={val => setRawMaterialForm({...rawMaterialForm, type_of_supply: val})}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Goods">Goods</SelectItem>
              <SelectItem value="Services">Services</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2 min-w-0">
          <Label htmlFor="gst_rate_id">GST Rate</Label>
          <Select value={rawMaterialForm.gst_rate_id ? String(rawMaterialForm.gst_rate_id) : ''} onValueChange={val => setRawMaterialForm({...rawMaterialForm, gst_rate_id: val})}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select GST rate" /></SelectTrigger>
            <SelectContent>
              {activeGstRates.map((r: any) => <SelectItem key={r.id} value={String(r.id)}>{r.rate != null ? `${r.rate}%` : r.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {rawMaterialForm.type_of_supply === 'Services' ? (
          <div className="space-y-2 min-w-0">
            <div className="flex items-center justify-between">
              <Label htmlFor="sac_code_id">SAC Code</Label>
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => openQuickAdd('sac_code', (id) => setRawMaterialForm((prev: any) => ({ ...prev, sac_code_id: String(id) })))}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Select value={rawMaterialForm.sac_code_id ? String(rawMaterialForm.sac_code_id) : ''} onValueChange={val => setRawMaterialForm({...rawMaterialForm, sac_code_id: val})}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select SAC code" /></SelectTrigger>
              <SelectContent>
                {activeSacCodes.map((r: any) => <SelectItem key={r.id} value={String(r.id)}>{r.code} - {r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-2 min-w-0">
            <div className="flex items-center justify-between">
              <Label htmlFor="hsn_code_id">HSN Code</Label>
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => openQuickAdd('hsn_code', (id) => setRawMaterialForm((prev: any) => ({ ...prev, hsn_code_id: String(id) })))}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Select value={rawMaterialForm.hsn_code_id ? String(rawMaterialForm.hsn_code_id) : ''} onValueChange={val => setRawMaterialForm({...rawMaterialForm, hsn_code_id: val})}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select HSN code" /></SelectTrigger>
              <SelectContent>
                {activeHsnCodes.map((r: any) => <SelectItem key={r.id} value={String(r.id)}>{r.code} - {r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2 min-w-0">
          <Label htmlFor="default_accounting_ledger_id">Default Accounting Ledger</Label>
          <div className="flex items-center gap-2">
            <Select value={rawMaterialForm.default_accounting_ledger_id ? String(rawMaterialForm.default_accounting_ledger_id) : ''} onValueChange={val => setRawMaterialForm({...rawMaterialForm, default_accounting_ledger_id: val})}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select ledger" /></SelectTrigger>
              <SelectContent>
                {ledgerOptions.map((l: any) => <SelectItem key={l.id} value={String(l.id)}>{l.ledger_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => openQuickAdd('ledger', (id) => setRawMaterialForm((prev: any) => ({ ...prev, default_accounting_ledger_id: String(id) })))}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="space-y-2 min-w-0">
          <Label htmlFor="status">Status</Label>
          <Select value={rawMaterialForm.status} onValueChange={val => setRawMaterialForm({...rawMaterialForm, status: val})}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="batch_tracking_enabled" checked={!!rawMaterialForm.batch_tracking_enabled} onCheckedChange={checked => setRawMaterialForm({...rawMaterialForm, batch_tracking_enabled: checked === true})} />
        <Label htmlFor="batch_tracking_enabled" className="cursor-pointer">Enable batch tracking for this item</Label>
      </div>
    </div>
  )

  // weightDifference is server-computed (converted_kg - packing_weight_per_main_unit,
  // see semiFinishedGoodService.js) - this local recompute is display-only, purely so
  // the form preview updates live as the user types, before the record is saved.
  const setSfgFieldRecomputeWeightDiff = (patch: Partial<typeof semiFinishedGoodForm>) => {
    setSemiFinishedGoodForm((prev: any) => {
      const next = { ...prev, ...patch }
      const ck = parseFloat(next.converted_kg)
      const pw = parseFloat(next.packing_weight_per_main_unit)
      next.weight_difference = !isNaN(ck) && !isNaN(pw) ? (ck - pw).toFixed(4) : ''
      return next
    })
  }

  const renderSemiFinishedGoodForm = () => (
    <div className="grid gap-4 py-4 px-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="semi_finished_good_code">SFG Code *</Label>
          <Input id="semi_finished_good_code" value={semiFinishedGoodForm.semi_finished_good_code} readOnly className="bg-slate-100" placeholder="Auto-generated" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sfg_name">Name *</Label>
          <Input id="sfg_name" value={semiFinishedGoodForm.name} onChange={e => setSemiFinishedGoodForm({...semiFinishedGoodForm, name: e.target.value})} placeholder="e.g. HK RBO 700 MLT PP (1x12)" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2 min-w-0">
          <Label htmlFor="sfg_main_uom_id">UOM</Label>
          <div className="flex items-center gap-2">
            <Select value={semiFinishedGoodForm.main_uom_id ? String(semiFinishedGoodForm.main_uom_id) : ''} onValueChange={val => setSemiFinishedGoodForm({...semiFinishedGoodForm, main_uom_id: val})}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select UOM" /></SelectTrigger>
              <SelectContent>
                {unitOptions.map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.unit_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => openQuickAdd('unit', (id) => setSemiFinishedGoodForm((prev: any) => ({ ...prev, main_uom_id: String(id) })))}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="space-y-2 min-w-0">
          <Label htmlFor="sfg_stock_group_id">Stock Group</Label>
          <Select value={semiFinishedGoodForm.stock_group_id ? String(semiFinishedGoodForm.stock_group_id) : ''} onValueChange={val => setSemiFinishedGoodForm({...semiFinishedGoodForm, stock_group_id: val})}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select stock group" /></SelectTrigger>
            <SelectContent>
              {stockGroupOptions.map((g: any) => <SelectItem key={g.id} value={String(g.id)}>{g.group_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 p-4 space-y-4">
        <p className="font-semibold text-sm text-slate-800">Weight Conversion (review Section 13)</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="oil_filling_per_unit">Oil Filling per Unit</Label>
            <Input id="oil_filling_per_unit" type="number" value={semiFinishedGoodForm.oil_filling_per_unit} onChange={e => setSemiFinishedGoodForm({...semiFinishedGoodForm, oil_filling_per_unit: e.target.value})} placeholder="0.00" />
          </div>
          <div className="space-y-2 min-w-0">
            <Label htmlFor="filling_unit_id">Filling Unit</Label>
            <Select value={semiFinishedGoodForm.filling_unit_id ? String(semiFinishedGoodForm.filling_unit_id) : ''} onValueChange={val => setSemiFinishedGoodForm({...semiFinishedGoodForm, filling_unit_id: val})}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select unit" /></SelectTrigger>
              <SelectContent>
                {unitOptions.map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.unit_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="converted_kg">Converted Kg</Label>
            <Input id="converted_kg" type="number" value={semiFinishedGoodForm.converted_kg} onChange={e => setSfgFieldRecomputeWeightDiff({ converted_kg: e.target.value })} placeholder="0.00" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="packing_weight_per_main_unit">Packing Weight per Main Unit</Label>
            <Input id="packing_weight_per_main_unit" type="number" value={semiFinishedGoodForm.packing_weight_per_main_unit} onChange={e => setSfgFieldRecomputeWeightDiff({ packing_weight_per_main_unit: e.target.value })} placeholder="0.00" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 min-w-0">
            <Label htmlFor="packing_weight_unit_id">Packing Weight Unit</Label>
            <Select value={semiFinishedGoodForm.packing_weight_unit_id ? String(semiFinishedGoodForm.packing_weight_unit_id) : ''} onValueChange={val => setSemiFinishedGoodForm({...semiFinishedGoodForm, packing_weight_unit_id: val})}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select unit" /></SelectTrigger>
              <SelectContent>
                {unitOptions.map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.unit_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="weight_difference">Weight Difference</Label>
            <Input id="weight_difference" value={semiFinishedGoodForm.weight_difference} readOnly className="bg-slate-100" placeholder="Auto-calculated" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="standard_weight">Standard Weight</Label>
            <Input id="standard_weight" type="number" value={semiFinishedGoodForm.standard_weight} onChange={e => setSemiFinishedGoodForm({...semiFinishedGoodForm, standard_weight: e.target.value})} placeholder="0.00" />
          </div>
          <div className="space-y-2 min-w-0">
            <Label htmlFor="standard_weight_unit_id">Standard Weight Unit</Label>
            <Select value={semiFinishedGoodForm.standard_weight_unit_id ? String(semiFinishedGoodForm.standard_weight_unit_id) : ''} onValueChange={val => setSemiFinishedGoodForm({...semiFinishedGoodForm, standard_weight_unit_id: val})}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select unit" /></SelectTrigger>
              <SelectContent>
                {unitOptions.map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.unit_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2 min-w-0">
          <Label htmlFor="sfg_type_of_supply">Type of Supply</Label>
          <Select value={semiFinishedGoodForm.type_of_supply || ''} onValueChange={val => setSemiFinishedGoodForm({...semiFinishedGoodForm, type_of_supply: val})}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Goods">Goods</SelectItem>
              <SelectItem value="Services">Services</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2 min-w-0">
          <Label htmlFor="sfg_gst_rate_id">GST Rate</Label>
          <Select value={semiFinishedGoodForm.gst_rate_id ? String(semiFinishedGoodForm.gst_rate_id) : ''} onValueChange={val => setSemiFinishedGoodForm({...semiFinishedGoodForm, gst_rate_id: val})}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select GST rate" /></SelectTrigger>
            <SelectContent>
              {activeGstRates.map((r: any) => <SelectItem key={r.id} value={String(r.id)}>{r.rate != null ? `${r.rate}%` : r.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {semiFinishedGoodForm.type_of_supply === 'Services' ? (
          <div className="space-y-2 min-w-0">
            <div className="flex items-center justify-between">
              <Label htmlFor="sfg_sac_code_id">SAC Code</Label>
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => openQuickAdd('sac_code', (id) => setSemiFinishedGoodForm((prev: any) => ({ ...prev, sac_code_id: String(id) })))}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Select value={semiFinishedGoodForm.sac_code_id ? String(semiFinishedGoodForm.sac_code_id) : ''} onValueChange={val => setSemiFinishedGoodForm({...semiFinishedGoodForm, sac_code_id: val})}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select SAC code" /></SelectTrigger>
              <SelectContent>
                {activeSacCodes.map((r: any) => <SelectItem key={r.id} value={String(r.id)}>{r.code} - {r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-2 min-w-0">
            <Label htmlFor="sfg_hsn_code_id">HSN Code</Label>
            <Select value={semiFinishedGoodForm.hsn_code_id ? String(semiFinishedGoodForm.hsn_code_id) : ''} onValueChange={val => setSemiFinishedGoodForm({...semiFinishedGoodForm, hsn_code_id: val})}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select HSN code" /></SelectTrigger>
              <SelectContent>
                {activeHsnCodes.map((r: any) => <SelectItem key={r.id} value={String(r.id)}>{r.code} - {r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2 min-w-0">
          <Label htmlFor="sfg_default_accounting_ledger_id">Default Accounting Ledger</Label>
          <div className="flex items-center gap-2">
            <Select value={semiFinishedGoodForm.default_accounting_ledger_id ? String(semiFinishedGoodForm.default_accounting_ledger_id) : ''} onValueChange={val => setSemiFinishedGoodForm({...semiFinishedGoodForm, default_accounting_ledger_id: val})}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select ledger" /></SelectTrigger>
              <SelectContent>
                {ledgerOptions.map((l: any) => <SelectItem key={l.id} value={String(l.id)}>{l.ledger_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => openQuickAdd('ledger', (id) => setSemiFinishedGoodForm((prev: any) => ({ ...prev, default_accounting_ledger_id: String(id) })))}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="space-y-2 min-w-0">
          <Label htmlFor="sfg_status">Status</Label>
          <Select value={semiFinishedGoodForm.status} onValueChange={val => setSemiFinishedGoodForm({...semiFinishedGoodForm, status: val})}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="sfg_batch_tracking_enabled" checked={!!semiFinishedGoodForm.batch_tracking_enabled} onCheckedChange={checked => setSemiFinishedGoodForm({...semiFinishedGoodForm, batch_tracking_enabled: checked === true})} />
        <Label htmlFor="sfg_batch_tracking_enabled" className="cursor-pointer">Enable batch tracking for this item</Label>
      </div>
    </div>
  )

  const renderPetrolPumpForm = () => (
    <div className="grid gap-4 py-4 px-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="petrol_pump_code">Petrol Pump Code *</Label>
          <Input id="petrol_pump_code" value={petrolPumpForm.petrol_pump_code} readOnly className="bg-slate-100" placeholder="Auto-generated" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="petrol_pump_name">Name *</Label>
          <Input id="petrol_pump_name" value={petrolPumpForm.petrol_pump_name} onChange={e => setPetrolPumpForm({...petrolPumpForm, petrol_pump_name: e.target.value})} placeholder="Enter name" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="pp_status">Status</Label>
          <Select value={petrolPumpForm.status} onValueChange={val => setPetrolPumpForm({...petrolPumpForm, status: val})}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="pp_mobile_no">Mobile Number</Label>
          <Input id="pp_mobile_no" value={petrolPumpForm.mobile_no} onChange={e => setPetrolPumpForm({...petrolPumpForm, mobile_no: e.target.value})} placeholder="Enter number" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="pp_email_id">Email ID</Label>
          <Input id="pp_email_id" value={petrolPumpForm.email_id} onChange={e => setPetrolPumpForm({...petrolPumpForm, email_id: e.target.value})} placeholder="email@example.com" />
        </div>
        <div className="space-y-2 min-w-0">
          <Label htmlFor="pp_ledger_group_id">Ledger Group</Label>
          <Select value={petrolPumpForm.ledger_group_id ? String(petrolPumpForm.ledger_group_id) : ''} onValueChange={val => setPetrolPumpForm({...petrolPumpForm, ledger_group_id: val})}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select ledger group" /></SelectTrigger>
            <SelectContent>
              {ledgerGroupOptions.map((g: any) => <SelectItem key={g.id} value={String(g.id)}>{g.group_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      {renderPartyParityFields(petrolPumpForm)}
    </div>
  )

  const renderCdRuleForm = () => (
    <div className="grid gap-4 py-4 px-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="cd_rule_code">CD Rule Code *</Label>
          <Input id="cd_rule_code" value={cdRuleForm.cd_rule_code} readOnly className="bg-slate-100" placeholder="Auto-generated" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cd_wef_date">W.E.F. Date *</Label>
          <Input id="cd_wef_date" type="date" value={cdRuleForm.wef_date?.split('T')[0] || ''} onChange={e => setCdRuleForm({...cdRuleForm, wef_date: e.target.value})} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2 min-w-0">
          <Label htmlFor="cd_stock_category_id">Stock Category *</Label>
          <Select value={cdRuleForm.stock_category_id ? String(cdRuleForm.stock_category_id) : ''} onValueChange={val => setCdRuleForm({...cdRuleForm, stock_category_id: val})}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select stock category" /></SelectTrigger>
            <SelectContent>
              {activeStockCategories.map((r: any) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cd_status">Status</Label>
          <Select value={cdRuleForm.status} onValueChange={val => setCdRuleForm({...cdRuleForm, status: val})}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="cd_discount_rate_per_main_uom">Discount Rate (per Main UOM) *</Label>
          <Input id="cd_discount_rate_per_main_uom" type="number" step="0.01" value={cdRuleForm.discount_rate_per_main_uom} onChange={e => setCdRuleForm({...cdRuleForm, discount_rate_per_main_uom: e.target.value})} placeholder="0.00" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cd_payment_condition_days">Payment Condition (Days) *</Label>
          <Input id="cd_payment_condition_days" type="number" step="1" value={cdRuleForm.payment_condition_days} onChange={e => setCdRuleForm({...cdRuleForm, payment_condition_days: e.target.value})} placeholder="e.g. 30" />
        </div>
      </div>
    </div>
  )

  // Phase 23 - TDS Master. Bare-minimum placeholder per explicit user
  // decision (the source review gives zero fields/rules for this master) -
  // no calculation logic, just a name+rate picklist for a future scoping
  // conversation to extend.
  
  const renderOilTagForm = () => (
    <div className="grid gap-4 py-4 px-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="ot_name">Oil Tag Name *</Label>
          <Input id="ot_name" value={oilTagForm.name} onChange={e => setOilTagForm({...oilTagForm, name: e.target.value})} placeholder="e.g. Rice Bran Refined Oil" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ot_status">Status</Label>
          <Select value={oilTagForm.status} onValueChange={val => setOilTagForm({...oilTagForm, status: val})}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )

  const renderTdsRuleForm = () => (
    <div className="grid gap-4 py-4 px-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="tds_rule_code">TDS Rule Code *</Label>
          <Input id="tds_rule_code" value={tdsRuleForm.tds_rule_code} readOnly className="bg-slate-100" placeholder="Auto-generated" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tds_name">Nature of Transaction *</Label>
          <Input id="tds_name" value={tdsRuleForm.name} onChange={e => setTdsRuleForm({...tdsRuleForm, name: e.target.value})} placeholder="Enter nature of transaction..." />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="tds_rate">Rate (%)</Label>
          <Input id="tds_rate" type="number" step="0.01" value={tdsRuleForm.rate} onChange={e => setTdsRuleForm({...tdsRuleForm, rate: e.target.value})} placeholder="0.00" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tds_status">Status</Label>
          <Select value={tdsRuleForm.status} onValueChange={val => setTdsRuleForm({...tdsRuleForm, status: val})}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )

  // Phase 24 - Bhada Rate Master. Same bare-minimum placeholder situation as
  // Phase 23 - see that render function's comment.
  const renderBhadaRateForm = () => (
    <div className="grid gap-4 py-4 px-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="bhada_rate_code">Bhada Rate Code *</Label>
          <Input id="bhada_rate_code" value={bhadaRateForm.bhada_rate_code} readOnly className="bg-slate-100" placeholder="Auto-generated" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bhada_name">Name *</Label>
          <Input id="bhada_name" value={bhadaRateForm.name} onChange={e => setBhadaRateForm({...bhadaRateForm, name: e.target.value})} placeholder="e.g. Local Route Rate" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="bhada_rate">Rate</Label>
          <Input id="bhada_rate" type="number" step="0.01" value={bhadaRateForm.rate} onChange={e => setBhadaRateForm({...bhadaRateForm, rate: e.target.value})} placeholder="0.00" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bhada_status">Status</Label>
          <Select value={bhadaRateForm.status} onValueChange={val => setBhadaRateForm({...bhadaRateForm, status: val})}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )

  const renderInsuranceDetailForm = () => (
    <div className="grid gap-4 py-4 px-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="insurance_code">Insurance Code *</Label>
          <Input id="insurance_code" value={insuranceDetailForm.insurance_code} readOnly className="bg-slate-100" placeholder="Auto-generated" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="insurance_company_name">Insurance Company Name *</Label>
          <Input id="insurance_company_name" value={insuranceDetailForm.insurance_company_name} onChange={e => setInsuranceDetailForm({...insuranceDetailForm, insurance_company_name: e.target.value})} placeholder="Enter company name" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="short_name">Short Name</Label>
          <Input id="short_name" value={insuranceDetailForm.short_name} onChange={e => setInsuranceDetailForm({...insuranceDetailForm, short_name: e.target.value})} placeholder="e.g. ICICI" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="policy_number">Policy Number</Label>
          <Input id="policy_number" value={insuranceDetailForm.policy_number} onChange={e => setInsuranceDetailForm({...insuranceDetailForm, policy_number: e.target.value})} placeholder="Enter policy number" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="valid_from">Valid From</Label>
          <Input id="valid_from" type="date" value={insuranceDetailForm.valid_from?.split('T')[0] || ''} onChange={e => setInsuranceDetailForm({...insuranceDetailForm, valid_from: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="insurance_valid_upto">Valid Upto</Label>
          <Input id="insurance_valid_upto" type="date" value={insuranceDetailForm.valid_upto?.split('T')[0] || ''} onChange={e => setInsuranceDetailForm({...insuranceDetailForm, valid_upto: e.target.value})} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2 min-w-0">
          <Label htmlFor="type_of_policy">Type of Policy</Label>
          <Select value={insuranceDetailForm.type_of_policy || ''} onValueChange={val => setInsuranceDetailForm({...insuranceDetailForm, type_of_policy: val})}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Marine Cargo">Marine Cargo</SelectItem>
              <SelectItem value="Open Policy">Open Policy</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sum_insured">Sum Insured (₹)</Label>
          <Input id="sum_insured" type="number" value={insuranceDetailForm.sum_insured} onChange={e => setInsuranceDetailForm({...insuranceDetailForm, sum_insured: e.target.value})} placeholder="0.00" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2 min-w-0">
          <Label htmlFor="owner_type">Owner of Policy</Label>
          <Select value={insuranceDetailForm.owner_type || 'Company'} onValueChange={val => setInsuranceDetailForm({...insuranceDetailForm, owner_type: val})}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select owner" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Company">Company</SelectItem>
              <SelectItem value="Customer">Customer</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 min-w-0">
          <Label htmlFor="insurance_status">Status</Label>
          <Select value={insuranceDetailForm.status} onValueChange={val => setInsuranceDetailForm({...insuranceDetailForm, status: val})}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {insuranceDetailForm.owner_type === 'Customer' && (
          <div className="space-y-2 flex flex-col">
            <Label>Linked Customers</Label>
            <p className="text-xs text-slate-400 mb-1">Search and tick the checkboxes of the customers who own this policy.</p>
            {!showCustomerSearch ? (
              <Button 
                type="button" 
                variant="outline" 
                className="w-full justify-start text-slate-500 bg-transparent font-normal h-10 hover:bg-slate-50"
                onClick={() => setShowCustomerSearch(true)}
              >
                <Search className="mr-2 h-4 w-4" />
                Select customers
              </Button>
            ) : (
              <div className="border border-slate-200 rounded-lg overflow-hidden flex flex-col bg-white shadow-sm mt-1">
                <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <Input 
                      placeholder="Search..." 
                      value={insuranceCustomerSearch} 
                      onChange={(e) => setInsuranceCustomerSearch(e.target.value)} 
                      className="pl-9 h-9 bg-white"
                      autoFocus
                    />
                  </div>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    className="ml-2 text-slate-500 hover:text-slate-700"
                    onClick={() => setShowCustomerSearch(false)}
                  >
                    Done
                  </Button>
                </div>
                <div className="max-h-52 overflow-y-auto p-1.5">
                  {customers.filter((c: any) => c.customer_name.toLowerCase().includes(insuranceCustomerSearch.toLowerCase())).length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-6">No customer found matching your search.</p>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      {customers
                        .filter((c: any) => c.customer_name.toLowerCase().includes(insuranceCustomerSearch.toLowerCase()))
                        .map((c: any) => {
                          const checked = (insuranceDetailForm.customer_ids || []).includes(c.id)
                          return (
                            <label 
                              key={c.id} 
                              className={`flex items-center gap-3 p-2.5 rounded-md cursor-pointer transition-colors ${checked ? 'bg-primary/5 border border-primary/20' : 'hover:bg-slate-50 border border-transparent'}`}
                            >
                              <Checkbox 
                                checked={checked} 
                                onCheckedChange={() => {
                                  const current = insuranceDetailForm.customer_ids || []
                                  setInsuranceDetailForm({
                                    ...insuranceDetailForm,
                                    customer_ids: !checked ? [...current, c.id] : current.filter((id: number) => id !== c.id),
                                  })
                                }}
                              />
                              <span className={`text-sm ${checked ? 'text-primary font-medium' : 'text-slate-700'}`}>
                                {c.customer_name}
                              </span>
                            </label>
                          )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {(insuranceDetailForm.customer_ids || []).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {customers
                  .filter((c: any) => (insuranceDetailForm.customer_ids || []).includes(c.id))
                  .map((c: any) => (
                    <Badge key={c.id} variant="secondary" className="text-xs font-normal flex items-center">
                      {c.customer_name}
                      <button
                        type="button"
                        className="ml-1.5 rounded-full hover:bg-slate-200 p-0.5"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setInsuranceDetailForm({
                            ...insuranceDetailForm,
                            customer_ids: (insuranceDetailForm.customer_ids || []).filter((id: number) => id !== c.id),
                          });
                        }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))
                }
              </div>
            )}
          </div>
        )}
    </div>
  )

  const renderConversionFormulaForm = () => (
    <div className="grid gap-4 py-4 px-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="conversion_formula_code">Formula Code *</Label>
          <Input id="conversion_formula_code" value={conversionFormulaForm.conversion_formula_code} readOnly className="bg-slate-100" placeholder="Auto-generated" />
        </div>
        <div className="space-y-2 min-w-0">
          <Label htmlFor="cf_status">Status</Label>
          <Select value={conversionFormulaForm.status} onValueChange={val => setConversionFormulaForm({...conversionFormulaForm, status: val})}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2 min-w-0">
          <Label htmlFor="base_item_id">Base / Parent Item</Label>
          <Select value={conversionFormulaForm.base_item_id ? String(conversionFormulaForm.base_item_id) : ''} onValueChange={val => setConversionFormulaForm({...conversionFormulaForm, base_item_id: val})}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select base item" /></SelectTrigger>
            <SelectContent>
              {skuOptions.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.sku_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 min-w-0">
          <Label htmlFor="child_item_id">Child Item</Label>
          <Select value={conversionFormulaForm.child_item_id ? String(conversionFormulaForm.child_item_id) : ''} onValueChange={val => setConversionFormulaForm({...conversionFormulaForm, child_item_id: val})}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select child item" /></SelectTrigger>
            <SelectContent>
              {skuOptions.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.sku_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 p-4 space-y-4">
        <p className="font-semibold text-sm text-slate-800">Formula Steps</p>
        {(conversionFormulaForm.steps || []).length > 0 && (
          <div className="space-y-2">
            {(conversionFormulaForm.steps || []).map((s: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between gap-2 bg-slate-50 rounded-md px-3 py-2 text-sm">
                <span>Step {idx + 1}: <span className="font-medium">{s.operation}</span> — {s.operand_type === 'literal' ? s.operand_value : s.operand_type.replace(/_/g, ' ')}</span>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-red-50" onClick={() => setConversionFormulaForm((prev: any) => ({ ...prev, steps: prev.steps.filter((_: any, i: number) => i !== idx) }))}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="bg-slate-50/60 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 min-w-0">
              <Label>Operation</Label>
              <Select value={newFormulaStep.operation} onValueChange={val => setNewFormulaStep({...newFormulaStep, operation: val})}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Add</SelectItem>
                  <SelectItem value="subtract">Subtract</SelectItem>
                  <SelectItem value="multiply">Multiply</SelectItem>
                  <SelectItem value="divide">Divide</SelectItem>
                  <SelectItem value="round_up">Round Up (2 decimals)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 min-w-0">
              <Label>Operand</Label>
              <Select value={newFormulaStep.operand_type} onValueChange={val => setNewFormulaStep({...newFormulaStep, operand_type: val})}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="literal">A number</SelectItem>
                  <SelectItem value="rate_of_base_item">Rate of Base Item</SelectItem>
                  <SelectItem value="converted_kg_of_base_item">Converted KGS of Base Item</SelectItem>
                  <SelectItem value="converted_kg_of_child_item">Converted KGS of Child Item</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {newFormulaStep.operand_type === 'literal' && (
            <div className="space-y-2">
              <Label>Value</Label>
              <Input type="number" value={newFormulaStep.operand_value} onChange={e => setNewFormulaStep({...newFormulaStep, operand_value: e.target.value})} placeholder="e.g. 6.5" />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              onClick={() => {
                if (newFormulaStep.operand_type === 'literal' && !newFormulaStep.operand_value) {
                  toast({ title: "Error", description: "Enter a value for this step", variant: "destructive" })
                  return
                }
                setConversionFormulaForm((prev: any) => ({
                  ...prev,
                  steps: [...(prev.steps || []), { step_order: (prev.steps || []).length + 1, operation: newFormulaStep.operation, operand_type: newFormulaStep.operand_type, operand_value: newFormulaStep.operand_type === 'literal' ? newFormulaStep.operand_value : null }],
                }))
                setNewFormulaStep({ operation: 'subtract', operand_type: 'literal', operand_value: '' })
              }}
            >
              <Plus className="h-4 w-4 mr-1" /> Add Step
            </Button>
          </div>
        </div>
      </div>
    </div>
  )

  const renderPriceLevelForm = () => (
    <div className="grid gap-4 py-4 px-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="price_level_code">Price Level Code *</Label>
          <Input id="price_level_code" value={priceLevelForm.price_level_code} readOnly className="bg-slate-100" placeholder="Auto-generated" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="effective_date">Effective Date *</Label>
          <Input id="effective_date" type="date" value={priceLevelForm.effective_date?.split('T')[0] || ''} onChange={e => setPriceLevelForm({...priceLevelForm, effective_date: e.target.value})} />
        </div>
      </div>
      <div className="space-y-2 min-w-0">
        <Label htmlFor="pl_status">Status</Label>
        <Select value={priceLevelForm.status} onValueChange={val => setPriceLevelForm({...priceLevelForm, status: val})}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Select status" /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="rounded-lg border border-slate-200 p-4 space-y-4">
        <p className="font-semibold text-sm text-slate-800">Finished Goods Prices</p>
        {(priceLevelForm.items || []).length > 0 && (
          <div className="space-y-2">
            {(priceLevelForm.items || []).map((it: any, idx: number) => {
              const sku = skuOptions.find((s: any) => String(s.id) === String(it.sku_id))
              return (
                <div key={idx} className="flex items-center justify-between gap-2 bg-slate-50 rounded-md px-3 py-2 text-sm">
                  <span>{sku?.sku_name || `SKU #${it.sku_id}`} — ₹{it.price}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-red-50" onClick={() => setPriceLevelForm((prev: any) => ({ ...prev, items: prev.items.filter((_: any, i: number) => i !== idx) }))}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}
        <div className="bg-slate-50/60 rounded-lg p-4 space-y-4">
          <div className="space-y-2 min-w-0">
            <Label>Finished Good</Label>
            <Select value={newPriceLevelItem.sku_id} onValueChange={val => setNewPriceLevelItem({...newPriceLevelItem, sku_id: val})}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select Finished Good" /></SelectTrigger>
              <SelectContent>
                {skuOptions.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.sku_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Price (₹)</Label>
            <Input type="number" min={0} value={newPriceLevelItem.price} onChange={e => setNewPriceLevelItem({...newPriceLevelItem, price: e.target.value})} placeholder="e.g. 120.50" />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              onClick={() => {
                if (!newPriceLevelItem.sku_id || !newPriceLevelItem.price) {
                  toast({ title: "Error", description: "Select a Finished Good and enter a price", variant: "destructive" })
                  return
                }
                setPriceLevelForm((prev: any) => ({ ...prev, items: [...(prev.items || []), { sku_id: newPriceLevelItem.sku_id, price: newPriceLevelItem.price }] }))
                setNewPriceLevelItem({ sku_id: '', price: '' })
              }}
            >
              <Plus className="h-4 w-4 mr-1" /> Add Price
            </Button>
          </div>
        </div>
      </div>
    </div>
  )

  const renderSkuDetailsForm = () => (
    <div className="grid gap-4 py-4 px-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sku_code">Finished Goods Code *</Label>
          <Input id="sku_code" value={skuDetailsForm.sku_code} readOnly className="bg-slate-100" placeholder="Auto-generated" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sku_name">Finished Goods Name *</Label>
          <Input id="sku_name" value={skuDetailsForm.sku_name} onChange={e => setSkuDetailsForm({...skuDetailsForm, sku_name: e.target.value})} placeholder="Enter name" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select value={skuDetailsForm.status} onValueChange={val => setSkuDetailsForm({...skuDetailsForm, status: val})}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tag_name">Tag for Reliance</Label>
          <Select value={skuDetailsForm.tag_name || ""} onValueChange={val => setSkuDetailsForm({...skuDetailsForm, tag_name: val})}>
            <SelectTrigger id="tag_name" className="w-full"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Yes">Yes</SelectItem>
              <SelectItem value="No">No</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="main_uom">Main UOM</Label>
          <Input id="main_uom" value={skuDetailsForm.main_uom} onChange={e => setSkuDetailsForm({...skuDetailsForm, main_uom: e.target.value})} placeholder="e.g. Box" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="alternate_uom">Alternate UOM</Label>
          <Input id="alternate_uom" value={skuDetailsForm.alternate_uom} onChange={e => setSkuDetailsForm({...skuDetailsForm, alternate_uom: e.target.value})} placeholder="e.g. Pcs" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2 min-w-0">
          <Label htmlFor="main_uom_id">Main UOM (Reference Data)</Label>
          <Select value={skuDetailsForm.main_uom_id ? String(skuDetailsForm.main_uom_id) : ''} onValueChange={val => setSkuDetailsForm({...skuDetailsForm, main_uom_id: val})}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select unit (optional)" /></SelectTrigger>
            <SelectContent>
              {unitOptions.map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.unit_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 min-w-0">
          <Label htmlFor="alternate_uom_id">Alternate UOM (Reference Data)</Label>
          <Select value={skuDetailsForm.alternate_uom_id ? String(skuDetailsForm.alternate_uom_id) : ''} onValueChange={val => setSkuDetailsForm({...skuDetailsForm, alternate_uom_id: val})}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select unit (optional)" /></SelectTrigger>
            <SelectContent>
              {unitOptions.map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.unit_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-xs text-slate-400 -mt-2">The Reference Data pickers above are additive - the free-text Main/Alternate UOM fields keep working unchanged.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="nos_per_main_uom">Nos per Main UOM</Label>
          <Input id="nos_per_main_uom" type="number" value={skuDetailsForm.nos_per_main_uom} onChange={e => setSkuDetailsForm({...skuDetailsForm, nos_per_main_uom: e.target.value})} placeholder="0" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="units">Units</Label>
          <Input id="units" value={skuDetailsForm.units} onChange={e => setSkuDetailsForm({...skuDetailsForm, units: e.target.value})} placeholder="e.g. Kg" />
        </div>
      </div>

      <Separator />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2 min-w-0">
          <Label htmlFor="semi_finished_good_id">Semi-Finished Good (link)</Label>
          <p className="text-xs text-slate-400 mb-1">When linked (nos per main UOM &gt; 1), the weight fields below auto-fill from this SFG on save.</p>
          <Combobox
            options={semiFinishedGoodOptions.map((s: any) => ({ value: String(s.id), label: s.name }))}
            value={skuDetailsForm.semi_finished_good_id ? String(skuDetailsForm.semi_finished_good_id) : ""}
            onValueChange={val => setSkuDetailsForm({...skuDetailsForm, semi_finished_good_id: val ? parseInt(val, 10) : null})}
            placeholder="Select Semi-Finished Good (optional)"
            searchPlaceholder="Search Semi-Finished Goods..."
          />
        </div>
        <div className="space-y-2 min-w-0">
          <Label htmlFor="oil_tag_id">Oil Tag</Label>
          <Select value={skuDetailsForm.oil_tag_id ? String(skuDetailsForm.oil_tag_id) : ''} onValueChange={val => setSkuDetailsForm({...skuDetailsForm, oil_tag_id: val})}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select oil tag" /></SelectTrigger>
            <SelectContent>
              {oilTagsList.filter((t: any) => t.status === "Active").map((r: any) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="oil_filling_per_unit">Oil Filling per Unit</Label>
          <Input id="oil_filling_per_unit" type="number" value={skuDetailsForm.oil_filling_per_unit} onChange={e => setSkuDetailsForm({...skuDetailsForm, oil_filling_per_unit: e.target.value})} placeholder="0.00" readOnly={!!skuDetailsForm.semi_finished_good_id} className={skuDetailsForm.semi_finished_good_id ? "bg-slate-100" : ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="filling_units">Filling Units</Label>
          <Input id="filling_units" value={skuDetailsForm.filling_units} onChange={e => setSkuDetailsForm({...skuDetailsForm, filling_units: e.target.value})} placeholder="e.g. Ltr" readOnly={!!skuDetailsForm.semi_finished_good_id} className={skuDetailsForm.semi_finished_good_id ? "bg-slate-100" : ""} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="converted_kg">Converted Kg</Label>
          <Input id="converted_kg" type="number" value={skuDetailsForm.converted_kg} onChange={e => setSkuDetailsForm({...skuDetailsForm, converted_kg: e.target.value})} placeholder="0.00" readOnly={!!skuDetailsForm.semi_finished_good_id} className={skuDetailsForm.semi_finished_good_id ? "bg-slate-100" : ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="packing_weight_per_main_unit">Packing Weight/Main Unit</Label>
          <Input id="packing_weight_per_main_unit" type="number" value={skuDetailsForm.packing_weight_per_main_unit} onChange={e => setSkuDetailsForm({...skuDetailsForm, packing_weight_per_main_unit: e.target.value})} placeholder="0.00" readOnly={!!skuDetailsForm.semi_finished_good_id} className={skuDetailsForm.semi_finished_good_id ? "bg-slate-100" : ""} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="weight_difference">Weight Difference</Label>
          <Input id="weight_difference" type="number" value={skuDetailsForm.weight_difference} onChange={e => setSkuDetailsForm({...skuDetailsForm, weight_difference: e.target.value})} placeholder="0.00" readOnly={!!skuDetailsForm.semi_finished_good_id} className={skuDetailsForm.semi_finished_good_id ? "bg-slate-100" : ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sku_weight">SKU Weight</Label>
          <Input id="sku_weight" type="number" value={skuDetailsForm.sku_weight} onChange={e => setSkuDetailsForm({...skuDetailsForm, sku_weight: e.target.value})} placeholder="0.00" readOnly={!!skuDetailsForm.semi_finished_good_id} className={skuDetailsForm.semi_finished_good_id ? "bg-slate-100" : ""} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="packing_weight">Packing Weight</Label>
          <Input id="packing_weight" type="number" value={skuDetailsForm.packing_weight} onChange={e => setSkuDetailsForm({...skuDetailsForm, packing_weight: e.target.value})} placeholder="0.00" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="gross_weight">Gross Weight</Label>
          <Input id="gross_weight" type="number" value={skuDetailsForm.gross_weight} onChange={e => setSkuDetailsForm({...skuDetailsForm, gross_weight: e.target.value})} placeholder="0.00" />
        </div>
      </div>
      <p className="text-xs text-slate-400 -mt-2">Packing Weight and Gross Weight always stay manual entry - not derived from the linked Semi-Finished Good.</p>

      <Separator />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2 min-w-0">
          <Label htmlFor="stock_category_id">Stock Category</Label>
          <Select value={skuDetailsForm.stock_category_id ? String(skuDetailsForm.stock_category_id) : ''} onValueChange={val => setSkuDetailsForm({...skuDetailsForm, stock_category_id: val})}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select stock category" /></SelectTrigger>
            <SelectContent>
              {activeStockCategories.map((r: any) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 min-w-0">
          <Label htmlFor="type_of_supply">Type of Supply</Label>
          <Select value={skuDetailsForm.type_of_supply || ''} onValueChange={val => setSkuDetailsForm({...skuDetailsForm, type_of_supply: val})}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Goods">Goods</SelectItem>
              <SelectItem value="Services">Services</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2 min-w-0">
          <Label htmlFor="gst_rate_id">GST Rate</Label>
          <Select value={skuDetailsForm.gst_rate_id ? String(skuDetailsForm.gst_rate_id) : ''} onValueChange={val => setSkuDetailsForm({...skuDetailsForm, gst_rate_id: val})}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select GST rate" /></SelectTrigger>
            <SelectContent>
              {activeGstRates.map((r: any) => <SelectItem key={r.id} value={String(r.id)}>{r.rate != null ? `${r.rate}%` : r.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {skuDetailsForm.type_of_supply === 'Services' ? (
          <div className="space-y-2 min-w-0">
            <Label htmlFor="sac_code_id">SAC Code</Label>
            <Select value={skuDetailsForm.sac_code_id ? String(skuDetailsForm.sac_code_id) : ''} onValueChange={val => setSkuDetailsForm({...skuDetailsForm, sac_code_id: val})}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select SAC code" /></SelectTrigger>
              <SelectContent>
                {activeSacCodes.map((r: any) => <SelectItem key={r.id} value={String(r.id)}>{r.code} – {r.description || r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-2 min-w-0">
            <Label htmlFor="hsn_code_id">HSN Code</Label>
            <Select value={skuDetailsForm.hsn_code_id ? String(skuDetailsForm.hsn_code_id) : ''} onValueChange={val => setSkuDetailsForm({...skuDetailsForm, hsn_code_id: val})}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select HSN code" /></SelectTrigger>
              <SelectContent>
                {activeHsnCodes.map((r: any) => <SelectItem key={r.id} value={String(r.id)}>{r.code} – {r.description || r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2 min-w-0">
          <Label htmlFor="uqc_id">UQC – Unit Quantity Code</Label>
          <Select value={skuDetailsForm.uqc_id ? String(skuDetailsForm.uqc_id) : ''} onValueChange={val => setSkuDetailsForm({...skuDetailsForm, uqc_id: val})}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select UQC" /></SelectTrigger>
            <SelectContent>
              {activeUqcCodes.map((r: any) => <SelectItem key={r.id} value={String(r.id)}>{r.code} – {r.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {activeDepots.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Warehouse className="h-4 w-4" />
                  Opening Stock by Depot
                </Label>
                <p className="text-xs text-slate-500 mt-0.5 ml-6">(wef date 01/04/2026)</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Opening Qty</p>
                <p className="text-sm font-bold text-blue-700">
                  {Object.values(openingStockByDepot).reduce((sum, v) => sum + (parseFloat(v as string) || 0), 0)}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {activeDepots.map((depot: any) => (
                <div key={depot.depot_id} className="flex items-center gap-3 px-1">
                  <span className="flex-1 text-sm text-slate-700">{depot.depot_name}</span>
                  <Input
                    type="number"
                    className="w-28 text-right"
                    placeholder="0"
                    min="0"
                    value={openingStockByDepot[depot.depot_name] ?? ''}
                    onChange={e => setOpeningStockByDepot(prev => ({ ...prev, [depot.depot_name]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          </div>

        </>
      )}
    </div>
  )

  const renderSkuSellingPriceForm = () => (
    <div className="grid gap-4 py-4 px-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="packing_material">Packing Material *</Label>
          <Input id="packing_material" value={skuSellingPriceForm.packing_material} onChange={e => setSkuSellingPrice({...skuSellingPriceForm, packing_material: e.target.value})} placeholder="Enter material name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sku_unit">SKU Unit</Label>
          <Input id="sku_unit" value={skuSellingPriceForm.sku_unit} readOnly className="bg-slate-100" placeholder="e.g. Ltr" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sku_weight_sp">SKU Weight</Label>
          <Input id="sku_weight_sp" type="number" value={skuSellingPriceForm.sku_weight} onChange={e => setSkuSellingPrice({...skuSellingPriceForm, sku_weight: e.target.value})} placeholder="0.00" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="conversion_formula">Conversion Formula</Label>
          <Input id="conversion_formula" type="number" value={skuSellingPriceForm.conversion_formula} onChange={e => setSkuSellingPrice({...skuSellingPriceForm, conversion_formula: e.target.value})} placeholder="0.00" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sku_weight_in_gm">SKU Weight (gm)</Label>
          <Input id="sku_weight_in_gm" type="number" value={skuSellingPriceForm.sku_weight_in_gm} onChange={e => {
            const rawVal = e.target.value;
            const val = parseFloat(rawVal) || 0;
            const pmWeight = parseFloat(skuSellingPriceForm.packing_material_weight_in_gm?.toString() || "0");
            const netOilInGm = val - pmWeight;
            
            // Recalculate landing cost: (GT / 1000) * netOilInGm + packingCost
            let newLandingCost = skuSellingPriceForm.landing_cost || 0;
            if (latestVarCalc?.gt) {
              const gt = parseFloat(latestVarCalc.gt) || 0;
              const pCost = parseFloat(skuSellingPriceForm.packing_cost?.toString() || "0");
              newLandingCost = ((gt / 1000) * netOilInGm + pCost).toFixed(2);
            }

            setSkuSellingPrice({
              ...skuSellingPriceForm, 
              sku_weight_in_gm: rawVal,
              net_oil_in_gm: netOilInGm.toFixed(2),
              landing_cost: newLandingCost
            });
          }} placeholder="0.00" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="packing_material_weight_in_gm">Packing Mat. Wt (gm)</Label>
          <Input id="packing_material_weight_in_gm" type="number" value={skuSellingPriceForm.packing_material_weight_in_gm} onChange={e => {
            const rawVal = e.target.value;
            const val = parseFloat(rawVal) || 0;
            const skuWt = parseFloat(skuSellingPriceForm.sku_weight_in_gm?.toString() || "0");
            const netOilInGm = skuWt - val;

            // Recalculate landing cost: (GT / 1000) * netOilInGm + packingCost
            let newLandingCost = skuSellingPriceForm.landing_cost || 0;
            if (latestVarCalc?.gt) {
              const gt = parseFloat(latestVarCalc.gt) || 0;
              const pCost = parseFloat(skuSellingPriceForm.packing_cost?.toString() || "0");
              newLandingCost = ((gt / 1000) * netOilInGm + pCost).toFixed(2);
            }

            setSkuSellingPrice({
              ...skuSellingPriceForm, 
              packing_material_weight_in_gm: rawVal,
              net_oil_in_gm: netOilInGm.toFixed(2),
              landing_cost: newLandingCost
            });
          }} placeholder="0.00" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="net_oil_in_gm">Net Oil (gm)</Label>
          <Input id="net_oil_in_gm" type="number" value={skuSellingPriceForm.net_oil_in_gm} readOnly className="bg-slate-100" placeholder="Auto-calculated" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="packing_cost">Packing Cost</Label>
          <Input id="packing_cost" type="number" value={skuSellingPriceForm.packing_cost} onChange={e => {
            const rawVal = e.target.value;
            const val = parseFloat(rawVal) || 0;
            
            // Recalculate landing cost when packing cost changes as well
            let newLandingCost = skuSellingPriceForm.landing_cost || 0;
            if (latestVarCalc?.gt) {
              const gt = parseFloat(latestVarCalc.gt) || 0;
              const netOilInGm = parseFloat(skuSellingPriceForm.net_oil_in_gm?.toString() || "0");
              newLandingCost = ((gt / 1000) * netOilInGm + val).toFixed(2);
            }

            setSkuSellingPrice({
              ...skuSellingPriceForm, 
              packing_cost: rawVal,
              landing_cost: newLandingCost
            });
          }} placeholder="0.00" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="landing_cost">Landing Cost</Label>
          <Input id="landing_cost" type="number" value={skuSellingPriceForm.landing_cost} readOnly className="bg-slate-100" placeholder="Auto-calculated" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="var">Var</Label>
          <Input id="var" value={skuSellingPriceForm.var} onChange={e => setSkuSellingPrice({...skuSellingPriceForm, var: e.target.value})} placeholder="e.g. 1" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="margin">Margin</Label>
          <Input id="margin" value={skuSellingPriceForm.margin} onChange={e => setSkuSellingPrice({...skuSellingPriceForm, margin: e.target.value})} placeholder="e.g. 10%" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="landing_cost">Landing Cost</Label>
          <Input id="landing_cost" type="number" value={skuSellingPriceForm.landing_cost} readOnly className="bg-slate-100" placeholder="Auto" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="actual_margin">Actual Margin</Label>
          <Input id="actual_margin" type="number" value={skuSellingPriceForm.actual_margin} readOnly className="bg-slate-100" placeholder="Auto" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="selling_cost">Selling Cost</Label>
          <Input id="selling_cost" type="number" value={skuSellingPriceForm.selling_cost} readOnly className="bg-slate-100" placeholder="Auto" />
        </div>
      </div>
    </div>
  )

  const renderVehicleForm = () => {
    return (
      <div className="grid gap-4 py-4 px-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Vehicle ID *</Label>
            <Input value={vehicleForm.vehicle_master_id} readOnly className="bg-slate-100" />
          </div>
          <div className="space-y-2">
            <Label>Registration No <span className="text-red-500">*</span></Label>
            <Input
              value={vehicleForm.registration_no}
              onChange={e => { setVehicleForm({...vehicleForm, registration_no: e.target.value}); setVehicleFormErrors(prev => ({...prev, registration_no: undefined})) }}
              placeholder="e.g. CG04JD1234"
              className={vehicleFormErrors.registration_no ? 'border-red-500 focus-visible:ring-red-400' : ''}
            />
            {vehicleFormErrors.registration_no && <p className="text-xs text-red-500 mt-1">{vehicleFormErrors.registration_no}</p>}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Vehicle Type <span className="text-red-500">*</span></Label>
            <Input
              value={vehicleForm.vehicle_type}
              onChange={e => { setVehicleForm({...vehicleForm, vehicle_type: e.target.value}); setVehicleFormErrors(prev => ({...prev, vehicle_type: undefined})) }}
              placeholder="e.g. Truck"
              className={vehicleFormErrors.vehicle_type ? 'border-red-500 focus-visible:ring-red-400' : ''}
            />
            {vehicleFormErrors.vehicle_type && <p className="text-xs text-red-500 mt-1">{vehicleFormErrors.vehicle_type}</p>}
          </div>
          <div className="space-y-2">
            <Label>Transporter <span className="text-red-500">*</span></Label>
            <Combobox
              options={sortedVehicleTransporters.map(name => ({ value: name, label: name }))}
              value={vehicleForm.transporter}
              onValueChange={val => { setVehicleForm({...vehicleForm, transporter: val}); setVehicleFormErrors(prev => ({...prev, transporter: undefined})) }}
              placeholder="Select transporter"
              searchPlaceholder="Search transporter..."
              className={vehicleFormErrors.transporter ? 'border-red-500' : ''}
            />
            {vehicleFormErrors.transporter && <p className="text-xs text-red-500 mt-1">{vehicleFormErrors.transporter}</p>}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={vehicleForm.status} onValueChange={val => setVehicleForm({...vehicleForm, status: val})}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Fuel Type</Label>
            <Select value={vehicleForm.fuel_type || 'Diesel'} onValueChange={val => setVehicleForm((prev: any) => ({...prev, fuel_type: val, ...(val === 'Electrical' ? { pollution: '' } : {})}))}>
              <SelectTrigger className="w-full bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Diesel">Diesel</SelectItem>
                <SelectItem value="Petrol">Petrol</SelectItem>
                <SelectItem value="Electrical">Electrical</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>RTO</Label>
            <Input value={vehicleForm.rto || ''} onChange={e => setVehicleForm({...vehicleForm, rto: e.target.value})} placeholder="RTO" />
          </div>
          <div className="space-y-2">
            <FileUploadField
              label="RC (Registration Certificate)"
              accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif"
              value={vehicleForm.rc_image}
              helperText="Max file size: 20 MB"
              uploading={false}
              onFilesSelected={(files) => files[0] && handleFileUpload(files[0], "rc_image")}
              onRemove={() => handleFileRemove("rc_image")}
            />
          </div>
        </div>

        <Separator className="my-2" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>GVW (KGS)</Label>
            <Input type="number" value={vehicleForm.gvw} onChange={e => {
              const gvw = e.target.value
              const ulw = vehicleForm.ulw
              const passing = gvw !== '' && ulw !== '' ? String(Number(gvw) - Number(ulw)) : ''
              const clearPermit = gvw === '' || Number(gvw) <= 3000
              setVehicleForm((prev: any) => ({
                ...prev,
                gvw,
                passing,
                ...(clearPermit
                  ? { state_permit: '', state_permit_image: '', state_permit_type: '', national_permit: '', national_permit_image: '' }
                  : {})
              }))
            }} />
          </div>
          <div className="space-y-2">
            <Label>ULW (KGS)</Label>
            <Input type="number" value={vehicleForm.ulw} onChange={e => {
              const ulw = e.target.value
              const gvw = vehicleForm.gvw
              const passing = gvw !== '' && ulw !== '' ? String(Number(gvw) - Number(ulw)) : ''
              setVehicleForm({...vehicleForm, ulw, passing})
            }} />
          </div>
          <div className="space-y-2">
            <Label>Passing (KGS)</Label>
            <Input type="number" value={vehicleForm.passing} readOnly className="bg-slate-100" />
          </div>
        </div>

        <Separator className="my-2" />
        <h3 className="text-sm font-semibold text-slate-500">Document Details & Images</h3>
        
        <div className="border p-4 rounded-xl bg-slate-50/50 space-y-4">
          <div className="space-y-2">
            <Label>Road Tax Option</Label>
            <Select value={roadTaxType} onValueChange={(val: 'expiry' | 'lifetime') => setRoadTaxType(val)}>
              <SelectTrigger className="w-full bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="expiry">Expiry Date</SelectItem>
                <SelectItem value="lifetime">Life time tax</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {roadTaxType === 'expiry' ? (
              <>
                <div className="space-y-2">
                  <Label>Road Tax Expiry</Label>
                  <Input type="date" value={vehicleForm.road_tax?.split('T')[0] || ''} onChange={e => setVehicleForm({...vehicleForm, road_tax: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <FileUploadField
                    label="Road Tax Image"
                    accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif"
                    value={vehicleForm.road_tax_image}
                    helperText="Max file size: 20 MB"
                    uploading={false}
                    onFilesSelected={(files) => files[0] && handleFileUpload(files[0], "road_tax_image")}
                    onRemove={() => handleFileRemove("road_tax_image")}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Life time tax Date</Label>
                  <Input type="date" value="" disabled placeholder="No expiry for lifetime tax" />
                </div>
                <div className="space-y-2">
                  <FileUploadField
                    label="Life time tax Image"
                    accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif"
                    value={vehicleForm.life_time_tax_image}
                    helperText="Max file size: 20 MB"
                    uploading={false}
                    onFilesSelected={(files) => files[0] && handleFileUpload(files[0], "life_time_tax_image")}
                    onRemove={() => handleFileRemove("life_time_tax_image")}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border p-3 rounded-lg bg-slate-50/50">
          <div className="space-y-2">
            <Label className="flex justify-between items-center">
              <span>Pollution Expiry</span>
              {vehicleForm.fuel_type === 'Electrical' && (
                <span className="text-[10px] text-slate-400 font-normal">Not applicable (Electrical vehicle)</span>
              )}
            </Label>
            <Input
              type="date"
              disabled={vehicleForm.fuel_type === 'Electrical'}
              value={vehicleForm.pollution?.split('T')[0] || ''}
              onChange={e => setVehicleForm({...vehicleForm, pollution: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <FileUploadField
              label="Pollution Image"
              accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif"
              value={vehicleForm.pollution_image}
              helperText="Max file size: 20 MB"
              uploading={false}
              onFilesSelected={(files) => files[0] && handleFileUpload(files[0], "pollution_image")}
              onRemove={() => handleFileRemove("pollution_image")}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border p-3 rounded-lg bg-slate-50/50">
          <div className="space-y-2">
            <Label>Insurance Expiry</Label>
            <Input type="date" value={vehicleForm.insurance?.split('T')[0] || ''} onChange={e => setVehicleForm({...vehicleForm, insurance: e.target.value})} />
          </div>
          <div className="space-y-2">
            <FileUploadField
              label="Insurance Image"
              accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif"
              value={vehicleForm.insurance_image}
              helperText="Max file size: 20 MB"
              uploading={false}
              onFilesSelected={(files) => files[0] && handleFileUpload(files[0], "insurance_image")}
              onRemove={() => handleFileRemove("insurance_image")}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border p-3 rounded-lg bg-slate-50/50">
          <div className="space-y-2">
            <Label>Fitness Expiry</Label>
            <Input type="date" value={vehicleForm.fitness?.split('T')[0] || ''} onChange={e => setVehicleForm({...vehicleForm, fitness: e.target.value})} />
          </div>
          <div className="space-y-2">
            <FileUploadField
              label="Fitness Image"
              accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif"
              value={vehicleForm.fitness_image}
              helperText="Max file size: 20 MB"
              uploading={false}
              onFilesSelected={(files) => files[0] && handleFileUpload(files[0], "fitness_image")}
              onRemove={() => handleFileRemove("fitness_image")}
            />
          </div>
        </div>

        <div className="border p-4 rounded-xl bg-slate-50/50 space-y-4">
          <Label className="flex justify-between items-center">
            <span>Permits</span>
            {!(vehicleForm.gvw !== '' && Number(vehicleForm.gvw) > 3000) && (
              <span className="text-[10px] text-slate-400 font-normal">Disabled (GVW must be &gt; 3000 KGS)</span>
            )}
          </Label>

          {/* State Permit (document compulsory) */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-600">State Permit <span className="text-red-500">*</span></p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>State Permit Expiry Date</Label>
                <Input
                  type="date"
                  disabled={!(vehicleForm.gvw !== '' && Number(vehicleForm.gvw) > 3000)}
                  value={vehicleForm.state_permit?.split('T')[0] || ''}
                  onChange={e => setVehicleForm({...vehicleForm, state_permit: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <FileUploadField
                  label="State Permit Image"
                  disabled={!(vehicleForm.gvw !== '' && Number(vehicleForm.gvw) > 3000)}
                  accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif"
                  value={vehicleForm.state_permit_image}
                  helperText="Max file size: 20 MB"
                  uploading={false}
                  onFilesSelected={(files) => {
                    if (files[0]) { handleFileUpload(files[0], "state_permit_image"); setVehicleFormErrors(prev => ({ ...prev, state_permit_image: undefined })) }
                  }}
                  onRemove={() => handleFileRemove("state_permit_image")}
                />
                {vehicleFormErrors.state_permit_image && (
                  <p className="text-[11px] text-red-500">{vehicleFormErrors.state_permit_image}</p>
                )}
              </div>
            </div>
          </div>

          {/* National Permit (optional) */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-600">National Permit</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>National Permit Expiry Date</Label>
                <Input
                  type="date"
                  disabled={!(vehicleForm.gvw !== '' && Number(vehicleForm.gvw) > 3000)}
                  value={vehicleForm.national_permit?.split('T')[0] || ''}
                  onChange={e => setVehicleForm({...vehicleForm, national_permit: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <FileUploadField
                  label="National Permit Image"
                  disabled={!(vehicleForm.gvw !== '' && Number(vehicleForm.gvw) > 3000)}
                  accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif"
                  value={vehicleForm.national_permit_image}
                  helperText="Max file size: 20 MB"
                  uploading={false}
                  onFilesSelected={(files) => files[0] && handleFileUpload(files[0], "national_permit_image")}
                  onRemove={() => handleFileRemove("national_permit_image")}
                />
              </div>
            </div>
          </div>
        </div>

        <Separator className="my-2" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 min-w-0">
            <Label>RTO Code</Label>
            <Select value={vehicleForm.rto_id ? String(vehicleForm.rto_id) : ''} onValueChange={val => setVehicleForm({...vehicleForm, rto_id: val})}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select RTO code" /></SelectTrigger>
              <SelectContent>
                {activeRtoCodes.map((r: any) => <SelectItem key={r.id} value={String(r.id)}>{r.code} - {r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Additional Transporters</Label>
          <p className="text-xs text-slate-400">Tag more transporters this vehicle can be associated with, alongside the primary Transporter above.</p>
          <div className="grid grid-cols-2 gap-2 rounded-md border border-slate-200 p-2 max-h-40 overflow-y-auto">
            {transporterOptions.map((t: any) => {
              const checked = (vehicleForm.additional_transporter_ids || []).includes(t.id)
              return (
                <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(val) => {
                      const current = vehicleForm.additional_transporter_ids || []
                      setVehicleForm({
                        ...vehicleForm,
                        additional_transporter_ids: val ? [...current, t.id] : current.filter((id: number) => id !== t.id),
                      })
                    }}
                  />
                  {t.transporter_name}
                </label>
              )
            })}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 p-4 space-y-4">
          <p className="font-semibold text-sm text-slate-800">GPS Tracking</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>GPS Company</Label>
              <Input value={vehicleForm.gps_company || ''} onChange={e => setVehicleForm({...vehicleForm, gps_company: e.target.value})} placeholder="e.g. Trackwell" />
            </div>
            <div className="space-y-2">
              <Label>GPS Type</Label>
              <Input value={vehicleForm.gps_type || ''} onChange={e => setVehicleForm({...vehicleForm, gps_type: e.target.value})} placeholder="e.g. OBD, hardwired" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>GPS API / Tracking Link</Label>
            <Input value={vehicleForm.gps_api_tracking_link || ''} onChange={e => setVehicleForm({...vehicleForm, gps_api_tracking_link: e.target.value})} placeholder="https://..." />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>GPS Valid Upto</Label>
              <Input type="date" value={vehicleForm.gps_valid_upto?.split('T')[0] || ''} onChange={e => setVehicleForm({...vehicleForm, gps_valid_upto: e.target.value})} />
            </div>
            <div className="space-y-2 min-w-0">
              <Label>GPS Installed By</Label>
              <Select value={vehicleForm.gps_installed_by || ''} onValueChange={val => setVehicleForm({...vehicleForm, gps_installed_by: val})}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Company">Company</SelectItem>
                  <SelectItem value="Vehicle Owner">Vehicle Owner</SelectItem>
                  <SelectItem value="Transporter">Transporter</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderDriverForm = () => (
    <div className="grid gap-4 py-4 px-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Driver ID *</Label>
          <Input value={driverForm.driver_master_id} readOnly className="bg-slate-100" />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={driverForm.status} onValueChange={val => setDriverForm({...driverForm, status: val})}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Driver Name *</Label>
          <Input value={driverForm.driver_name} onChange={e => setDriverForm({...driverForm, driver_name: e.target.value})} placeholder="Full Name" />
        </div>
        <div className="space-y-2">
          <Label>Mobile No *</Label>
          <Input value={driverForm.mobile_no} onChange={e => setDriverForm({...driverForm, mobile_no: e.target.value})} placeholder="10-digit number" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Email ID</Label>
          <Input type="email" value={driverForm.email_id} onChange={e => setDriverForm({...driverForm, email_id: e.target.value})} placeholder="email@example.com" />
        </div>
        <div className="space-y-2">
          <Label>PAN No</Label>
          <Input value={driverForm.pan_no} onChange={e => setDriverForm({...driverForm, pan_no: e.target.value})} placeholder="Permanent Account Number" />
        </div>
      </div>

      <Separator className="my-2" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Driving Licence No *</Label>
          <Input value={driverForm.driving_licence_no} onChange={e => setDriverForm({...driverForm, driving_licence_no: e.target.value})} placeholder="DL Number" />
        </div>
        <div className="space-y-2">
          <Label>DL Type</Label>
          <Input value={driverForm.driving_licence_type} onChange={e => setDriverForm({...driverForm, driving_licence_type: e.target.value})} placeholder="e.g. LMV/HMV" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>DL Valid Upto</Label>
          <Input type="date" value={driverForm.valid_upto?.split('T')[0] || ''} onChange={e => setDriverForm({...driverForm, valid_upto: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>RTO</Label>
          <Input value={driverForm.rto} onChange={e => setDriverForm({...driverForm, rto: e.target.value})} placeholder="RTO" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Trans Valid Upto</Label>
          <Input type="date" value={driverForm.trans_valid_upto?.split('T')[0] || ''} onChange={e => setDriverForm({...driverForm, trans_valid_upto: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>LMV Valid Upto</Label>
          <Input type="date" value={driverForm.lmv_valid_upto?.split('T')[0] || ''} onChange={e => setDriverForm({...driverForm, lmv_valid_upto: e.target.value})} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2 min-w-0">
          <Label>RTO Code</Label>
          <Select value={driverForm.rto_id ? String(driverForm.rto_id) : ''} onValueChange={val => setDriverForm({...driverForm, rto_id: val ? parseInt(val, 10) : null})}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select RTO code" /></SelectTrigger>
            <SelectContent>
              {activeRtoCodes.map((r: any) => <SelectItem key={r.id} value={String(r.id)}>{r.code} - {r.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

        <FileUploadField
          label="Driving Licence Upload"
          accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
          value={driverForm.dl_upload || ""}
          helperText="Max file size: 20 MB"
          uploading={false}
          onFilesSelected={(files) => files[0] && handleFileUpload(files[0], "dl_upload")}
          onRemove={() => handleFileRemove("dl_upload")}
        />

      <Separator className="my-2" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Aadhaar No</Label>
          <Input value={driverForm.aadhaar_no} onChange={e => setDriverForm({...driverForm, aadhaar_no: e.target.value})} placeholder="12-digit number" />
        </div>
        <FileUploadField
          label="Aadhaar Upload"
          accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
          value={driverForm.aadhaar_upload || ""}
          helperText="Max file size: 20 MB"
          uploading={false}
          onFilesSelected={(files) => files[0] && handleFileUpload(files[0], "aadhaar_upload")}
          onRemove={() => handleFileRemove("aadhaar_upload")}
        />
      </div>

      <div className="space-y-2">
        <Label>Address</Label>
        <Input value={driverForm.address_line1} onChange={e => setDriverForm({...driverForm, address_line1: e.target.value})} placeholder="Full address" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>State</Label>
          <Combobox
            options={activeStates.map((s: any) => ({ value: String(s.id), label: s.state_name }))}
            value={driverForm.state_id ? String(driverForm.state_id) : ""}
            onValueChange={val => {
              const selected = activeStates.find((s: any) => String(s.id) === val)
              setDriverForm({...driverForm, state_id: val ? parseInt(val, 10) : null, state: selected?.state_name || driverForm.state })
            }}
            placeholder="Select state"
            searchPlaceholder="Search state..."
          />
        </div>
        <div className="space-y-2">
          <Label>Pincode</Label>
          <Input value={driverForm.pincode} onChange={e => setDriverForm({...driverForm, pincode: e.target.value})} placeholder="Pincode" />
        </div>
      </div>
    </div>
  )

  const renderTransportForm = () => (
    <div className="grid gap-4 py-4 px-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Transport ID *</Label>
          <Input value={transportForm.transport_master_id} readOnly className="bg-slate-100" />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={transportForm.status} onValueChange={val => setTransportForm({...transportForm, status: val})}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-2">
          <Label>Transporter Name *</Label>
          <Input value={transportForm.transporter_name} onChange={e => setTransportForm({...transportForm, transporter_name: e.target.value})} placeholder="Company Name" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Contact Person *</Label>
          <Input value={transportForm.contact_person} onChange={e => setTransportForm({...transportForm, contact_person: e.target.value})} placeholder="Full Name" />
        </div>
        <div className="space-y-2">
          <Label>Contact Number *</Label>
          <Input value={transportForm.contact_number} onChange={e => setTransportForm({...transportForm, contact_number: e.target.value})} placeholder="Mobile/Phone" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Email ID</Label>
          <Input type="email" value={transportForm.email_id} onChange={e => setTransportForm({...transportForm, email_id: e.target.value})} placeholder="email@example.com" />
        </div>
        <div className="space-y-2">
          <Label>Address</Label>
          <Input value={transportForm.address_line1} onChange={e => setTransportForm({...transportForm, address_line1: e.target.value})} placeholder="Office address" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Pincode</Label>
          <Input value={transportForm.pincode} onChange={e => setTransportForm({...transportForm, pincode: e.target.value})} placeholder="6-digit PIN" />
        </div>
        <div className="space-y-2">
          <Label>Ledger Group</Label>
          <Select value={transportForm.ledger_group_id ? String(transportForm.ledger_group_id) : ''} onValueChange={val => setTransportForm({...transportForm, ledger_group_id: val})}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select ledger group" /></SelectTrigger>
            <SelectContent>
              {ledgerGroupOptions.map((g: any) => <SelectItem key={g.id} value={String(g.id)}>{g.group_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2 min-w-0">
          <Label>Linked Customer</Label>
          <p className="text-xs text-slate-400 mb-1">If this transporter is also a customer, link them so they don't need a separate ledger.</p>
          <Combobox
            options={customers.map((c: any) => ({ value: String(c.id), label: c.customer_name }))}
            value={transportForm.linked_customer_id ? String(transportForm.linked_customer_id) : ""}
            onValueChange={val => setTransportForm({...transportForm, linked_customer_id: val ? parseInt(val, 10) : null})}
            placeholder="Select customer (optional)"
            searchPlaceholder="Search customer..."
          />
        </div>
        <div className="space-y-2">
          <FileUploadField
            label="Bilty Copy"
            accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
            value={transportForm.bilty_copy_upload || ""}
            helperText="Max file size: 20 MB"
            uploading={false}
            onFilesSelected={(files) => files[0] && handleFileUpload(files[0], "bilty_copy_upload")}
            onRemove={() => handleFileRemove("bilty_copy_upload")}
          />
        </div>
      </div>
      {renderPartyParityFields(transportForm)}
    </div>
  )

  return (

    <div className="p-4 md:p-6 max-w-7xl mx-auto min-h-screen space-y-4 md:space-y-6 animate-in fade-in duration-700">
      <PageHeader
        title="Master Data"
        description={TAB_META[activeTab]?.desc || "Manage your master data records"}
      >
        <div className="flex flex-wrap items-center gap-2 md:gap-4 w-full lg:w-auto">
          <div className="relative flex-1 min-w-[140px] max-w-full md:max-w-xs transition-all duration-300 focus-within:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder={`Search...`} 
              className="pl-10 h-9 md:h-10 border-slate-200 focus:border-primary/30 focus:ring-primary/10 transition-all rounded-xl" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {activeTab === "vehicle_master" && (
            <div className="w-[180px]">
              <Select value={selectedVehicleType} onValueChange={setSelectedVehicleType}>
                <SelectTrigger className="h-9 md:h-10 border-slate-200 rounded-xl bg-white shadow-sm">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {uniqueVehicleTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button 
            variant="outline" 
            size="sm"
            className="h-9 md:h-10 rounded-xl px-3 md:px-4 border-slate-200 hover:bg-slate-50 transition-all"
            onClick={() => {
              if (activeTab === "customers") { refetchCustomer(); refetchPendingCustomers() }
              else if (activeTab === "depots") { refetchDepot(); refetchPendingDepots() }
              else if (activeTab === "brokers") { refetchBroker(); refetchPendingBrokers() }
              else if (activeTab === "salespersons") { refetchSalesperson(); refetchPendingSalespersons() }
              else if (activeTab === "ledger_groups") { refetchLedgerGroup(); refetchPendingLedgerGroups() }
              else if (activeTab === "stock_groups") { refetchStockGroup(); refetchPendingStockGroups() }
              else if (activeTab === "units") { refetchUnit(); refetchPendingUnits() }
              else if (activeTab === "raw_materials") { refetchRawMaterial(); refetchPendingRawMaterials() }
              else if (activeTab === "semi_finished_goods") { refetchSemiFinishedGood(); refetchPendingSemiFinishedGoods() }
              else if (activeTab === "insurance_details") { refetchInsuranceDetail(); refetchPendingInsuranceDetails() }
              else if (activeTab === "conversion_formulas") { refetchConversionFormula(); refetchPendingConversionFormulas() }
              else if (activeTab === "price_levels") { refetchPriceLevel(); refetchPendingPriceLevels() }
              else if (activeTab === "petrol_pumps") { refetchPetrolPump(); refetchPendingPetrolPumps() }
              else if (activeTab === "cd_rules") { refetchCdRule(); refetchPendingCdRules() }
        else if (activeTab === "tds_rules") { refetchTdsRule(); refetchPendingTdsRules() }
        else if (activeTab === "bhada_rates") { refetchBhadaRate(); refetchPendingBhadaRates() }
              else if (activeTab === "sku_details") { refetchSku(); refetchPendingSku() }
              else if (activeTab === "sku_selling_price") refetchSkuSellingPrice()
              else if (activeTab === "vehicle_master") { refetchVehicle(); refetchPendingVehicles() }
              else if (activeTab === "driver_master") { refetchDriver(); refetchPendingDrivers() }
              else if (activeTab === "transport_master") { refetchTransport(); refetchPendingTransport() }
            }}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''} md:mr-2`} />
            <span className="hidden md:inline">Refresh</span>
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open)
            if (!open) resetForms()
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-9 md:h-10 bg-primary hover:bg-primary/90 shadow-lg px-3 md:px-4 rounded-xl transition-all" disabled={isMasterTabReadOnly} onClick={handleOpenAddDialog} title={isMasterTabReadOnly ? "View Only Access" : `Add New ${activeTab.replace('_', ' ')}`}>
                <Plus className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Add {activeTab.split('_')[0].charAt(0).toUpperCase() + activeTab.split('_')[0].slice(1)}</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-h-[90vh] overflow-y-auto" style={{ maxWidth: '1250px' }}>
              <DialogHeader>
                <DialogTitle>{editingItem ? "Edit" : "Add New"} {activeTab === "sku_details" ? "Finished Good" : activeTab === "sku_selling_price" ? "SKU Selling Price" : activeTab === "salespersons" ? "Salesperson" : activeTab === "vehicle_master" ? "Vehicle" : activeTab === "driver_master" ? "Driver" : activeTab === "transport_master" ? "Transporter" : activeTab === "ledger_groups" ? "Ledger Group" : activeTab === "stock_groups" ? "Stock Group" : activeTab === "units" ? "Unit" : activeTab === "raw_materials" ? "Raw Material" : activeTab === "semi_finished_goods" ? "Semi-Finished Good" : activeTab === "insurance_details" ? "Insurance Detail" : activeTab === "conversion_formulas" ? "Conversion Formula" : activeTab === "price_levels" ? "Price Level" : activeTab === "petrol_pumps" ? "Petrol Pump" : activeTab === "cd_rules" ? "CD Rule" : activeTab === "tds_rules" ? "TDS Rule" : activeTab === "bhada_rates" ? "Bhada Rate" : activeTab.slice(0, -1)}</DialogTitle>
                <DialogDescription>
                  Enter the details for the {activeTab === "sku_details" ? "Finished Good" : activeTab === "sku_selling_price" ? "SKU Selling Price" : activeTab === "salespersons" ? "Salesperson" : activeTab === "vehicle_master" ? "Vehicle" : activeTab === "driver_master" ? "Driver" : activeTab === "transport_master" ? "Transporter" : activeTab === "ledger_groups" ? "Ledger Group" : activeTab === "stock_groups" ? "Stock Group" : activeTab === "units" ? "Unit" : activeTab === "raw_materials" ? "Raw Material" : activeTab === "semi_finished_goods" ? "Semi-Finished Good" : activeTab === "insurance_details" ? "Insurance Detail" : activeTab === "conversion_formulas" ? "Conversion Formula" : activeTab === "price_levels" ? "Price Level" : activeTab === "petrol_pumps" ? "Petrol Pump" : activeTab === "cd_rules" ? "CD Rule" : activeTab === "tds_rules" ? "TDS Rule" : activeTab === "bhada_rates" ? "Bhada Rate" : activeTab.slice(0, -1)} record.
                </DialogDescription>
              </DialogHeader>
              {renderFormForTab(activeTab)}
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateOrUpdate} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingItem ? "Update" : "Save"} Details
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </PageHeader>

      <Tabs value={activeTab} className="w-full space-y-6" onValueChange={setActiveTab}>
        <div className="flex items-center">
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger className="w-full sm:w-72 h-12 rounded-xl bg-white shadow-sm border-slate-200 px-4 font-medium data-[state=open]:ring-2 data-[state=open]:ring-primary/20">
              <SelectValue placeholder="Select master" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {visibleTabs.map((tab) => {
                const meta = TAB_META[tab]
                if (!meta) return null
                const Icon = meta.icon
                return (
                  <SelectItem key={tab} value={tab} className="rounded-lg cursor-pointer">
                    <span className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-slate-500" />
                      {meta.label}
                    </span>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>



        {visibleTabs.includes("customers") && (
        <TabsContent value="customers">
          <Card className="shadow-xl border-none rounded-2xl bg-white">
            <CardHeader className="bg-slate-50/50 border-b p-6">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Customers List
                  </CardTitle>
                  <CardDescription className="mt-1">Manage your customer database</CardDescription>
                </div>
              </div>
              {(user?.role === 'admin' || user?.role === 'super_admin') && (
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => setCustomerSubTab('active')}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${customerSubTab === 'active' ? 'bg-primary text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    Active Records
                  </button>
                  <button
                    onClick={() => setCustomerSubTab('pending')}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${customerSubTab === 'pending' ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    Pending Approval
                    {pendingCustomers.length > 0 && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${customerSubTab === 'pending' ? 'bg-white text-amber-600' : 'bg-amber-500 text-white'}`}>
                        {pendingCustomers.length}
                      </span>
                    )}
                  </button>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {customerSubTab === 'active' ? (
                <>
                  {/* Mobile card view */}
                  <div className="md:hidden">
                    {isCustomerLoading && customers.length === 0 ? (
                      <div className="p-4 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="border border-slate-100 rounded-xl p-4 space-y-2 animate-pulse"><div className="h-4 w-32 bg-slate-200 rounded" /><div className="h-3 w-48 bg-slate-200 rounded" /><div className="h-3 w-24 bg-slate-200 rounded" /></div>)}</div>
                    ) : customers.length === 0 ? (
                      <div className="text-center py-16 text-slate-400">No customers found</div>
                    ) : (
                      <div className="p-3 space-y-3 overflow-auto" style={{ maxHeight: 600 }}>
                        {sortedCustomers.map(item => (
                          <div key={item.id} className="border border-slate-100 rounded-xl p-4 bg-white shadow-sm space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-800 truncate">{item.customer_name}</p>
                                <p className="text-xs text-slate-500">{item.customer_id}</p>
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={!canEditActiveTab} title={!canEditActiveTab ? "View Only" : "Edit"}><Pencil className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50" disabled={!canEditExisting} title={!canEditExisting ? "Admin Only" : "Delete"}><Trash2 className="h-4 w-4" /></Button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
                              <div><span className="font-medium text-slate-600">Contact: </span>{item.contact_person || "—"}</div>
                              <div><span className="font-medium text-slate-600">Location: </span>{item.state ? `${item.state} (${item.pincode})` : "—"}</div>
                              <div className="col-span-2"><span className="font-medium text-slate-600">Email: </span>{item.email || "—"}</div>
                              <div><span className="font-medium text-slate-600">Phone: </span>{item.contact || "—"}</div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant={item.status === 'Active' ? 'default' : 'secondary'} className={item.status === 'Active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none' : ''}>{item.status}</Badge>
                              {item.has_pending_edit && <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">Edit pending approval</Badge>}
                            </div>
                          </div>
                        ))}
                        {isFetchingNextCustomer && <div className="flex items-center justify-center py-4 gap-2 text-slate-400 text-xs"><div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.3s]" /><div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.15s]" /><div className="h-1.5 w-1.5 bg-primary animate-bounce" /><span className="ml-2">Loading more customers...</span></div>}
                      </div>
                    )}
                  </div>
                  {/* Desktop table */}
                  <div className="hidden md:flex flex-col h-[600px]">
                    <div className="flex-1 overflow-auto rounded-b-2xl">
                      <table className="w-full caption-bottom text-sm">
                        <TableHeader className="sticky top-0 z-20 bg-slate-50 shadow-sm">
                          <TableRow className="hover:bg-transparent border-b">
                            <TableHead className="pl-6 cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('customer_id', customerSort, setCustomerSort)}>ID <SortIcon col="customer_id" sort={customerSort} /></TableHead>
                            <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('customer_name', customerSort, setCustomerSort)}>Customer Name <SortIcon col="customer_name" sort={customerSort} /></TableHead>
                            <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('contact_person', customerSort, setCustomerSort)}>Contact Person <SortIcon col="contact_person" sort={customerSort} /></TableHead>
                            <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('email', customerSort, setCustomerSort)}>Email/Contact <SortIcon col="email" sort={customerSort} /></TableHead>
                            <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('state', customerSort, setCustomerSort)}>Location <SortIcon col="state" sort={customerSort} /></TableHead>
                            <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('status', customerSort, setCustomerSort)}>Status <SortIcon col="status" sort={customerSort} /></TableHead>
                            <TableHead className="text-right pr-6">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {isCustomerLoading && customers.length === 0 ? (
                            [...Array(8)].map((_, i) => (
                              <TableRow key={i} className="opacity-40 border-b border-slate-50 h-16">
                                <TableCell className="pl-6"><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                                <TableCell><div className="h-4 w-32 bg-slate-200 animate-pulse rounded" /></TableCell>
                                <TableCell><div className="h-4 w-24 bg-slate-200 animate-pulse rounded" /></TableCell>
                                <TableCell><div className="h-8 w-40 bg-slate-200 animate-pulse rounded" /></TableCell>
                                <TableCell><div className="h-4 w-28 bg-slate-200 animate-pulse rounded" /></TableCell>
                                <TableCell><div className="h-6 w-20 bg-slate-200 animate-pulse rounded-full" /></TableCell>
                                <TableCell className="pr-6"><div className="h-8 w-16 bg-slate-100 animate-pulse rounded ml-auto" /></TableCell>
                              </TableRow>
                            ))
                          ) : customers.length === 0 ? (
                            <TableRow><TableCell colSpan={7} className="text-center py-20 text-slate-400">No customers found</TableCell></TableRow>
                          ) : (
                            <>
                              {sortedCustomers.map(item => (
                                <TableRow key={item.id} className="hover:bg-slate-50/30 transition-colors border-b border-slate-50 h-16">
                                  <TableCell className="font-medium pl-6">{item.customer_id}</TableCell>
                                  <TableCell className="font-semibold text-slate-900">{item.customer_name}</TableCell>
                                  <TableCell>{item.contact_person || "—"}</TableCell>
                                  <TableCell>
                                    <div className="text-sm">
                                      <p className="text-slate-600 font-medium">{item.email || "—"}</p>
                                      <p className="text-slate-400 text-xs">{item.contact || "—"}</p>
                                    </div>
                                  </TableCell>
                                  <TableCell>{item.state ? `${item.state} (${item.pincode})` : "—"}</TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <Badge variant={item.status === 'Active' ? 'default' : 'secondary'} className={item.status === 'Active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none' : ''}>
                                        {item.status}
                                      </Badge>
                                      {item.has_pending_edit && (
                                        <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50 whitespace-nowrap" title="An edit to this record is awaiting admin approval">
                                          Edit pending
                                        </Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right pr-6">
                                    <div className="flex justify-end gap-2">
                                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={!canEditActiveTab} title={!canEditActiveTab ? "View Only" : "Edit Customer"}>
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50" disabled={!canEditExisting} title={!canEditExisting ? "Admin Only" : "Delete Customer"}>
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                              {/* Infinite Scroll Sentinel */}
                              <TableRow ref={customerEndRef}>
                                <TableCell colSpan={7} className="p-0 h-12 border-none">
                                  {isFetchingNextCustomer && (
                                    <div className="flex items-center justify-center py-4 text-slate-400 bg-slate-50/20">
                                      <div className="flex gap-1.5 items-center bg-white px-4 py-1.5 rounded-full shadow-sm border border-slate-100">
                                        <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.3s]"></div>
                                        <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.15s]"></div>
                                        <div className="h-1.5 w-1.5 bg-primary animate-bounce"></div>
                                        <span className="text-xs font-medium ml-2 text-slate-500">Loading more customers...</span>
                                      </div>
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                            </>
                          )}
                        </TableBody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                /* Pending Approval */
                <div className="flex flex-col h-[600px]">
                  <div className="flex-1 overflow-auto rounded-b-2xl">
                    {pendingCustomers.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
                        <CheckCircle2 className="h-10 w-10 text-emerald-300" />
                        <p className="text-sm font-medium">No pending approvals</p>
                      </div>
                    ) : (
                    <>
                      {/* Mobile card view */}
                      <div className="md:hidden p-3 space-y-3">
                        {pendingCustomers.map(item => {
                          const isEdit = item.request_type === 'edit'
                          const submittedBy = isEdit ? (item.pending_edit_by_name || item.created_by_name) : item.created_by_name
                          const submittedOn = isEdit ? item.pending_edit_at : item.created_at
                          return (
                            <div key={item.id} className="border border-slate-100 rounded-xl p-4 bg-white shadow-sm space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-800 truncate">{item.customer_name}</p>
                                  <p className="text-xs text-slate-500">{item.customer_id}</p>
                                </div>
                                <Badge variant="outline" className={isEdit ? "border-blue-300 text-blue-700 bg-blue-50 shrink-0" : "border-emerald-300 text-emerald-700 bg-emerald-50 shrink-0"}>
                                  {isEdit ? "Edit" : "New"}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
                                <div className="col-span-2"><span className="font-medium text-slate-600">GSTIN: </span>{item.gstin || "—"}</div>
                                <div className="col-span-2"><span className="font-medium text-slate-600">Location: </span>{item.state ? `${item.state} (${item.pincode})` : "—"}</div>
                                <div className="col-span-2"><span className="font-medium text-slate-600">Submitted By: </span>{submittedBy || "—"}</div>
                                <div className="col-span-2"><span className="font-medium text-slate-600">Submitted On: </span>{submittedOn ? new Date(submittedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "—"}</div>
                              </div>
                              <div className="pt-2 border-t border-slate-50 flex gap-2 w-full justify-end">
                                <Button size="sm" onClick={() => openApprovalModal('customers', item)} disabled={isReviewing} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white px-3 rounded-lg text-xs flex-1"><Check className="h-3.5 w-3.5 mr-1" />Approve</Button>
                                <Button size="sm" variant="outline" onClick={() => setRejectDialogContext({ tab: 'customers', id: item.id })} disabled={isReviewing} className="h-8 border-red-200 text-red-600 hover:bg-red-50 px-3 rounded-lg text-xs flex-1"><X className="h-3.5 w-3.5 mr-1" />Reject</Button>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Desktop Table View */}
                      <table className="hidden md:table w-full caption-bottom text-sm">
                        <TableHeader className="sticky top-0 z-20 bg-amber-50 shadow-sm">
                          <TableRow className="hover:bg-transparent border-b">
                            <TableHead className="pl-6">ID</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Customer Name</TableHead>
                            <TableHead>GSTIN</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead>Submitted By</TableHead>
                            <TableHead>Submitted On</TableHead>
                            <TableHead className="text-right pr-6">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pendingCustomers.map(item => {
                            const isEdit = item.request_type === 'edit'
                            const submittedBy = isEdit ? (item.pending_edit_by_name || item.created_by_name) : item.created_by_name
                            const submittedOn = isEdit ? item.pending_edit_at : item.created_at
                            return (
                            <TableRow key={item.id} className="hover:bg-amber-50/30 transition-colors border-b border-slate-50 h-16">
                              <TableCell className="font-medium pl-6 text-slate-500">{item.customer_id}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={isEdit ? "border-blue-300 text-blue-700 bg-blue-50" : "border-emerald-300 text-emerald-700 bg-emerald-50"}>
                                  {isEdit ? "Edit" : "New"}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-semibold text-slate-900">{item.customer_name}</TableCell>
                              <TableCell>{item.gstin || "—"}</TableCell>
                              <TableCell>{item.state ? `${item.state} (${item.pincode})` : "—"}</TableCell>
                              <TableCell>{submittedBy || "—"}</TableCell>
                              <TableCell className="text-slate-500 text-xs">{submittedOn ? new Date(submittedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "—"}</TableCell>
                              <TableCell className="text-right pr-6">
                                <div className="flex justify-end gap-2">
                                  <Button size="sm" onClick={() => openApprovalModal('customers', item)} disabled={isReviewing} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white px-3 rounded-lg">
                                    <Check className="h-3.5 w-3.5 mr-1" /> Approve
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => setRejectDialogContext({ tab: 'customers', id: item.id })} disabled={isReviewing} className="h-8 border-red-200 text-red-600 hover:bg-red-50 px-3 rounded-lg">
                                    <X className="h-3.5 w-3.5 mr-1" /> Reject
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )})}
                        </TableBody>
                      </table>
                    </>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {visibleTabs.includes("depots") && (
        <TabsContent value="depots">
          <Card className="shadow-xl border-none rounded-2xl bg-white">
            <CardHeader className="bg-slate-50/50 border-b p-6">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Warehouse className="h-5 w-5 text-primary" />
                    Depots List
                  </CardTitle>
                  <CardDescription className="mt-1">Manage your warehouse and depots</CardDescription>
                </div>
              </div>
              {isAdminOrSuper && (
                <div className="flex gap-2 mt-4">
                  <button onClick={() => setDepotSubTab('active')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${depotSubTab === 'active' ? 'bg-primary text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Active Records</button>
                  <button onClick={() => setDepotSubTab('pending')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${depotSubTab === 'pending' ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    Pending Approval {pendingDepots.length > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${depotSubTab === 'pending' ? 'bg-white text-amber-600' : 'bg-amber-500 text-white'}`}>{pendingDepots.length}</span>}
                  </button>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {depotSubTab === 'pending' ? (
                <div className="flex flex-col h-[600px]"><div className="flex-1 overflow-auto rounded-b-2xl">
                  {pendingDepots.length === 0 ? <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400"><CheckCircle2 className="h-10 w-10 text-emerald-300" /><p className="text-sm font-medium">No pending approvals</p></div> : (
                    <>
                      {/* Mobile card view */}
                      <div className="md:hidden p-3 space-y-3">
                        {pendingDepots.map(item => {
                          const isEdit = item.request_type === 'edit'
                          const submittedBy = isEdit ? (item.pending_edit_by_name || item.created_by_name) : item.created_by_name
                          const submittedOn = isEdit ? item.pending_edit_at : item.created_at
                          return (
                            <div key={item.depot_id} className="border border-slate-100 rounded-xl p-4 bg-white shadow-sm space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-800 truncate">{item.depot_name}</p>
                                  <p className="text-xs text-slate-500">{item.depot_id}</p>
                                </div>
                                <Badge variant="outline" className={isEdit ? "border-blue-300 text-blue-700 bg-blue-50 shrink-0" : "border-emerald-300 text-emerald-700 bg-emerald-50 shrink-0"}>
                                  {isEdit ? "Edit" : "New"}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
                                <div className="col-span-2"><span className="font-medium text-slate-600">State: </span>{item.state || "—"}</div>
                                <div className="col-span-2"><span className="font-medium text-slate-600">Salesman/Broker: </span>{item.salesman_broker_name || "—"}</div>
                                <div className="col-span-2"><span className="font-medium text-slate-600">Submitted By: </span>{submittedBy || "—"}</div>
                                <div className="col-span-2"><span className="font-medium text-slate-600">Submitted On: </span>{submittedOn ? new Date(submittedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "—"}</div>
                              </div>
                              <div className="pt-2 border-t border-slate-50 flex gap-2 w-full justify-end">
                                <Button size="sm" onClick={() => openApprovalModal('depots', item)} disabled={isReviewing} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white px-3 rounded-lg text-xs flex-1"><Check className="h-3.5 w-3.5 mr-1" />Approve</Button>
                                <Button size="sm" variant="outline" onClick={() => setRejectDialogContext({ tab: 'depots', id: item.id })} disabled={isReviewing} className="h-8 border-red-200 text-red-600 hover:bg-red-50 px-3 rounded-lg text-xs flex-1"><X className="h-3.5 w-3.5 mr-1" />Reject</Button>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Desktop Table View */}
                      <table className="hidden md:table w-full caption-bottom text-sm">
                        <TableHeader className="sticky top-0 z-20 bg-amber-50 shadow-sm">
                          <TableRow className="hover:bg-transparent border-b">
                            <TableHead className="pl-6">ID</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Depot Name</TableHead>
                            <TableHead>State</TableHead>
                            <TableHead>Salesman/Broker</TableHead>
                            <TableHead>Submitted By</TableHead>
                            <TableHead>Submitted On</TableHead>
                            <TableHead className="text-right pr-6">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pendingDepots.map(item => {
                            const isEdit = item.request_type === 'edit'
                            const submittedBy = isEdit ? (item.pending_edit_by_name || item.created_by_name) : item.created_by_name
                            const submittedOn = isEdit ? item.pending_edit_at : item.created_at
                            return (
                            <TableRow key={item.depot_id} className="hover:bg-amber-50/30 border-b border-slate-50 h-16">
                              <TableCell className="font-medium pl-6 text-slate-500">{item.depot_id}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={isEdit ? "border-blue-300 text-blue-700 bg-blue-50" : "border-emerald-300 text-emerald-700 bg-emerald-50"}>
                                  {isEdit ? "Edit" : "New"}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-semibold text-slate-900">{item.depot_name}</TableCell>
                              <TableCell>{item.state || "—"}</TableCell>
                              <TableCell>{item.salesman_broker_name || "—"}</TableCell>
                              <TableCell>{submittedBy || "—"}</TableCell>
                              <TableCell className="text-slate-500 text-xs">{submittedOn ? new Date(submittedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "—"}</TableCell>
                              <TableCell className="text-right pr-6">
                                <div className="flex justify-end gap-2">
                                  <Button size="sm" onClick={() => openApprovalModal('depots', item)} disabled={isReviewing} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white px-3 rounded-lg">
                                    <Check className="h-3.5 w-3.5 mr-1" /> Approve
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => setRejectDialogContext({ tab: 'depots', id: item.id })} disabled={isReviewing} className="h-8 border-red-200 text-red-600 hover:bg-red-50 px-3 rounded-lg">
                                    <X className="h-3.5 w-3.5 mr-1" /> Reject
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )})}
                        </TableBody>
                      </table>
                    </>
                  )}
                </div></div>
              ) : (
              <>
              {/* Mobile card view */}
              <div className="md:hidden">
                {isDepotLoading && depots.length === 0 ? (
                  <div className="p-4 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="border border-slate-100 rounded-xl p-4 space-y-2 animate-pulse"><div className="h-4 w-32 bg-slate-200 rounded" /><div className="h-3 w-48 bg-slate-200 rounded" /></div>)}</div>
                ) : depots.length === 0 ? (
                  <div className="text-center py-16 text-slate-400">No depots found</div>
                ) : (
                  <div className="p-3 space-y-3 overflow-auto" style={{ maxHeight: 600 }}>
                    {sortedDepots.map(item => (
                      <div key={item.depot_id} className="border border-slate-100 rounded-xl p-4 bg-white shadow-sm space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 truncate">{item.depot_name}</p>
                            <p className="text-xs text-slate-500">{item.depot_id}</p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={!canEditActiveTab} title={!canEditActiveTab ? "View Only" : "Edit"}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50" disabled={!canEditExisting} title={!canEditExisting ? "Admin Only" : "Delete"}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
                          <div className="col-span-2"><span className="font-medium text-slate-600">Address: </span>{item.depot_address || "—"}</div>
                          <div><span className="font-medium text-slate-600">State: </span>{item.state || "—"}</div>
                          <div><span className="font-medium text-slate-600">Salesman: </span>{item.salesman_broker_name || "—"}</div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={item.status === 'Active' ? 'default' : 'secondary'} className={item.status === 'Active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none' : ''}>{item.status}</Badge>
                          {item.has_pending_edit && <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">Edit pending approval</Badge>}
                        </div>
                      </div>
                    ))}
                    {isFetchingNextDepot && <div className="flex items-center justify-center py-4 gap-2 text-slate-400 text-xs"><div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.3s]" /><div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.15s]" /><div className="h-1.5 w-1.5 bg-primary animate-bounce" /><span className="ml-2">Loading more depots...</span></div>}
                  </div>
                )}
              </div>
              {/* Desktop table */}
              <div className="hidden md:flex flex-col h-[600px]">
                <div className="flex-1 overflow-auto rounded-b-2xl">
                  <table className="w-full caption-bottom text-sm">
                    <TableHeader className="sticky top-0 z-20 bg-slate-50 shadow-sm">
                      <TableRow className="hover:bg-transparent border-b">
                        <TableHead className="pl-6 cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('depot_id', depotSort, setDepotSort)}>ID <SortIcon col="depot_id" sort={depotSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('depot_name', depotSort, setDepotSort)}>Depot Name <SortIcon col="depot_name" sort={depotSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('depot_address', depotSort, setDepotSort)}>Address <SortIcon col="depot_address" sort={depotSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('state', depotSort, setDepotSort)}>State <SortIcon col="state" sort={depotSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('salesman_broker_name', depotSort, setDepotSort)}>Salesman/Broker <SortIcon col="salesman_broker_name" sort={depotSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('status', depotSort, setDepotSort)}>Status <SortIcon col="status" sort={depotSort} /></TableHead>
                        <TableHead className="text-right pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isDepotLoading && depots.length === 0 ? (
                        [...Array(8)].map((_, i) => (
                          <TableRow key={i} className="opacity-40 border-b border-slate-50 h-16">
                            <TableCell className="pl-6"><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-32 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-48 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-24 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-28 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-6 w-20 bg-slate-200 animate-pulse rounded-full" /></TableCell>
                            <TableCell className="pr-6"><div className="h-8 w-16 bg-slate-100 animate-pulse rounded ml-auto" /></TableCell>
                          </TableRow>
                        ))
                      ) : depots.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-20 text-slate-400">No depots found</TableCell></TableRow>
                      ) : (
                        <>
                          {sortedDepots.map(item => (
                            <TableRow key={item.depot_id} className="hover:bg-slate-50/30 transition-colors border-b border-slate-50 h-16">
                              <TableCell className="font-medium pl-6">{item.depot_id}</TableCell>
                              <TableCell className="font-semibold text-slate-900">{item.depot_name}</TableCell>
                              <TableCell className="max-w-xs truncate text-slate-600">{item.depot_address || "—"}</TableCell>
                              <TableCell className="text-slate-600">{item.state || "—"}</TableCell>
                              <TableCell className="text-slate-600">{item.salesman_broker_name || "—"}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Badge variant={item.status === 'Active' ? 'default' : 'secondary'} className={item.status === 'Active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none' : ''}>
                                    {item.status}
                                  </Badge>
                                  {item.has_pending_edit && (
                                    <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50 whitespace-nowrap" title="An edit to this record is awaiting admin approval">
                                      Edit pending
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right pr-6">
                                <div className="flex justify-end gap-2">
                                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={!canEditActiveTab} title={!canEditActiveTab ? "View Only" : "Edit Depot"}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50" disabled={!canEditExisting} title={!canEditExisting ? "Admin Only" : "Delete Depot"}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {/* Infinite Scroll Sentinel */}
                          <TableRow ref={depotEndRef}>
                            <TableCell colSpan={7} className="p-0 h-12 border-none">
                              {isFetchingNextDepot && (
                                <div className="flex items-center justify-center py-4 text-slate-400 bg-slate-50/20">
                                  <div className="flex gap-1.5 items-center bg-white px-4 py-1.5 rounded-full shadow-sm border border-slate-100">
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.3s]"></div>
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.15s]"></div>
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce"></div>
                                    <span className="text-xs font-medium ml-2 text-slate-500">Loading more depots...</span>
                                  </div>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </table>
                </div>
              </div>
              </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}


        {visibleTabs.includes("brokers") && (
        <TabsContent value="brokers">
          <Card className="shadow-xl border-none rounded-2xl bg-white">
            <CardHeader className="bg-slate-50/50 border-b p-6">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-primary" />
                    Brokers List
                  </CardTitle>
                  <CardDescription className="mt-1">Manage your broker database</CardDescription>
                </div>
              </div>
              {isAdminOrSuper && (
                <div className="flex gap-2 mt-4">
                  <button onClick={() => setBrokerSubTab('active')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${brokerSubTab === 'active' ? 'bg-primary text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Active Records</button>
                  <button onClick={() => setBrokerSubTab('pending')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${brokerSubTab === 'pending' ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    Pending Approval {pendingBrokers.length > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${brokerSubTab === 'pending' ? 'bg-white text-amber-600' : 'bg-amber-500 text-white'}`}>{pendingBrokers.length}</span>}
                  </button>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {brokerSubTab === 'pending' ? (
                <div className="flex flex-col h-[600px]"><div className="flex-1 overflow-auto rounded-b-2xl">
                  {pendingBrokers.length === 0 ? <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400"><CheckCircle2 className="h-10 w-10 text-emerald-300" /><p className="text-sm font-medium">No pending approvals</p></div> : (
                    <>
                      {/* Mobile card view */}
                      <div className="md:hidden p-3 space-y-3">
                        {pendingBrokers.map(item => {
                          const isEdit = item.request_type === 'edit'
                          const submittedBy = isEdit ? (item.pending_edit_by_name || item.created_by_name) : item.created_by_name
                          const submittedOn = isEdit ? item.pending_edit_at : item.created_at
                          return (
                            <div key={item.broker_id} className="border border-slate-100 rounded-xl p-4 bg-white shadow-sm space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-800 truncate">{item.salesman_name}</p>
                                  <p className="text-xs text-slate-500">{item.broker_id}</p>
                                </div>
                                <Badge variant="outline" className={isEdit ? "border-blue-300 text-blue-700 bg-blue-50 shrink-0" : "border-emerald-300 text-emerald-700 bg-emerald-50 shrink-0"}>
                                  {isEdit ? "Edit" : "New"}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
                                <div className="col-span-2"><span className="font-medium text-slate-600">Depot: </span>{item.depot_name || "—"}</div>
                                <div className="col-span-2"><span className="font-medium text-slate-600">Mobile: </span>{item.mobile_no || "—"}</div>
                                <div className="col-span-2"><span className="font-medium text-slate-600">Submitted By: </span>{submittedBy || "—"}</div>
                                <div className="col-span-2"><span className="font-medium text-slate-600">Submitted On: </span>{submittedOn ? new Date(submittedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "—"}</div>
                              </div>
                              <div className="pt-2 border-t border-slate-50 flex gap-2 w-full justify-end">
                                <Button size="sm" onClick={() => openApprovalModal('brokers', item)} disabled={isReviewing} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white px-3 rounded-lg text-xs flex-1"><Check className="h-3.5 w-3.5 mr-1" />Approve</Button>
                                <Button size="sm" variant="outline" onClick={() => setRejectDialogContext({ tab: 'brokers', id: item.id })} disabled={isReviewing} className="h-8 border-red-200 text-red-600 hover:bg-red-50 px-3 rounded-lg text-xs flex-1"><X className="h-3.5 w-3.5 mr-1" />Reject</Button>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Desktop Table View */}
                      <table className="hidden md:table w-full caption-bottom text-sm">
                        <TableHeader className="sticky top-0 z-20 bg-amber-50 shadow-sm">
                          <TableRow className="hover:bg-transparent border-b">
                            <TableHead className="pl-6">ID</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Depot</TableHead>
                            <TableHead>Mobile</TableHead>
                            <TableHead>Submitted By</TableHead>
                            <TableHead>Submitted On</TableHead>
                            <TableHead className="text-right pr-6">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pendingBrokers.map(item => {
                            const isEdit = item.request_type === 'edit'
                            const submittedBy = isEdit ? (item.pending_edit_by_name || item.created_by_name) : item.created_by_name
                            const submittedOn = isEdit ? item.pending_edit_at : item.created_at
                            return (
                            <TableRow key={item.broker_id} className="hover:bg-amber-50/30 border-b border-slate-50 h-16">
                              <TableCell className="font-medium pl-6 text-slate-500">{item.broker_id}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={isEdit ? "border-blue-300 text-blue-700 bg-blue-50" : "border-emerald-300 text-emerald-700 bg-emerald-50"}>
                                  {isEdit ? "Edit" : "New"}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-semibold text-slate-900">{item.salesman_name}</TableCell>
                              <TableCell>{item.depot_name || "—"}</TableCell>
                              <TableCell>{item.mobile_no || "—"}</TableCell>
                              <TableCell>{submittedBy || "—"}</TableCell>
                              <TableCell className="text-slate-500 text-xs">{submittedOn ? new Date(submittedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "—"}</TableCell>
                              <TableCell className="text-right pr-6">
                                <div className="flex justify-end gap-2">
                                  <Button size="sm" onClick={() => openApprovalModal('brokers', item)} disabled={isReviewing} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white px-3 rounded-lg">
                                    <Check className="h-3.5 w-3.5 mr-1" /> Approve
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => setRejectDialogContext({ tab: 'brokers', id: item.id })} disabled={isReviewing} className="h-8 border-red-200 text-red-600 hover:bg-red-50 px-3 rounded-lg">
                                    <X className="h-3.5 w-3.5 mr-1" /> Reject
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )})}
                        </TableBody>
                      </table>
                    </>
                  )}
                </div></div>
              ) : (
              <>
              {/* Mobile card view */}
              <div className="md:hidden">
                {isBrokerLoading && brokers.length === 0 ? (
                  <div className="p-4 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="border border-slate-100 rounded-xl p-4 space-y-2 animate-pulse"><div className="h-4 w-32 bg-slate-200 rounded" /><div className="h-3 w-40 bg-slate-200 rounded" /></div>)}</div>
                ) : brokers.length === 0 ? (
                  <div className="text-center py-16 text-slate-400">No brokers found</div>
                ) : (
                  <div className="p-3 space-y-3 overflow-auto" style={{ maxHeight: 600 }}>
                    {sortedBrokers.map(item => (
                      <div key={item.broker_id} className="border border-slate-100 rounded-xl p-4 bg-white shadow-sm space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 truncate">{item.salesman_name}</p>
                            <p className="text-xs text-slate-500">{item.broker_id}</p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={!canEditActiveTab} title={!canEditActiveTab ? "View Only" : "Edit"}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50" disabled={!canEditExisting} title={!canEditExisting ? "Admin Only" : "Delete"}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </div>
                        <div className="text-xs text-slate-500 space-y-0.5">
                          <div><span className="font-medium text-slate-600">Mobile: </span>{item.mobile_no || "—"}</div>
                          <div><span className="font-medium text-slate-600">Email: </span>{item.email_id || "—"}</div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={item.status === 'Active' ? 'default' : 'secondary'} className={item.status === 'Active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none' : ''}>{item.status}</Badge>
                          {item.has_pending_edit && <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">Edit pending approval</Badge>}
                        </div>
                      </div>
                    ))}
                    {isFetchingNextBroker && <div className="flex items-center justify-center py-4 gap-2 text-slate-400 text-xs"><div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.3s]" /><div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.15s]" /><div className="h-1.5 w-1.5 bg-primary animate-bounce" /><span className="ml-2">Loading more brokers...</span></div>}
                  </div>
                )}
              </div>
              {/* Desktop table */}
              <div className="hidden md:flex flex-col h-[600px]">
                <div className="flex-1 overflow-auto rounded-b-2xl">
                  <table className="w-full caption-bottom text-sm">
                    <TableHeader className="sticky top-0 z-20 bg-slate-50 shadow-sm">
                      <TableRow className="hover:bg-transparent border-b">
                        <TableHead className="pl-6 cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('broker_id', brokerSort, setBrokerSort)}>ID <SortIcon col="broker_id" sort={brokerSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('salesman_name', brokerSort, setBrokerSort)}>Broker Name <SortIcon col="salesman_name" sort={brokerSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('mobile_no', brokerSort, setBrokerSort)}>Contact (Mobile/Email) <SortIcon col="mobile_no" sort={brokerSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('status', brokerSort, setBrokerSort)}>Status <SortIcon col="status" sort={brokerSort} /></TableHead>
                        <TableHead className="text-right pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isBrokerLoading && brokers.length === 0 ? (
                        [...Array(8)].map((_, i) => (
                          <TableRow key={i} className="opacity-40 border-b border-slate-50 h-16">
                            <TableCell className="pl-6"><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-32 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-8 w-40 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-6 w-20 bg-slate-200 animate-pulse rounded-full" /></TableCell>
                            <TableCell className="pr-6"><div className="h-8 w-16 bg-slate-100 animate-pulse rounded ml-auto" /></TableCell>
                          </TableRow>
                        ))
                      ) : brokers.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-20 text-slate-400">No brokers found</TableCell></TableRow>
                      ) : (
                        <>
                          {sortedBrokers.map(item => (
                            <TableRow key={item.broker_id} className="hover:bg-slate-50/30 transition-colors border-b border-slate-50 h-16">
                              <TableCell className="font-medium pl-6">{item.broker_id}</TableCell>
                              <TableCell className="font-semibold text-slate-900">{item.salesman_name}</TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  <p className="text-slate-600 font-medium">{item.mobile_no || "—"}</p>
                                  <p className="text-slate-400 text-xs">{item.email_id || "—"}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Badge variant={item.status === 'Active' ? 'default' : 'secondary'} className={item.status === 'Active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none' : ''}>
                                    {item.status}
                                  </Badge>
                                  {item.has_pending_edit && (
                                    <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50 whitespace-nowrap" title="An edit to this record is awaiting admin approval">
                                      Edit pending
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right pr-6">
                                <div className="flex justify-end gap-2">
                                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={!canEditActiveTab} title={!canEditActiveTab ? "View Only" : "Edit Broker"}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50" disabled={!canEditExisting} title={!canEditExisting ? "Admin Only" : "Delete Broker"}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {/* Infinite Scroll Sentinel */}
                          <TableRow ref={brokerEndRef}>
                            <TableCell colSpan={5} className="p-0 h-12 border-none">
                              {isFetchingNextBroker && (
                                <div className="flex items-center justify-center py-4 text-slate-400 bg-slate-50/20">
                                  <div className="flex gap-1.5 items-center bg-white px-4 py-1.5 rounded-full shadow-sm border border-slate-100">
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.3s]"></div>
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.15s]"></div>
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce"></div>
                                    <span className="text-xs font-medium ml-2 text-slate-500">Loading more brokers...</span>
                                  </div>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </table>
                </div>
              </div>
              </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {visibleTabs.includes("salespersons") && (
        <TabsContent value="salespersons">
          <Card className="shadow-xl border-none rounded-2xl bg-white">
            <CardHeader className="bg-slate-50/50 border-b p-6">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Salespersons List
                  </CardTitle>
                  <CardDescription className="mt-1">Manage your salesperson database</CardDescription>
                </div>
              </div>
              {isAdminOrSuper && (
                <div className="flex gap-2 mt-4">
                  <button onClick={() => setSalespersonSubTab('active')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${salespersonSubTab === 'active' ? 'bg-primary text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Active Records</button>
                  <button onClick={() => setSalespersonSubTab('pending')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${salespersonSubTab === 'pending' ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    Pending Approval {pendingSalespersons.length > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${salespersonSubTab === 'pending' ? 'bg-white text-amber-600' : 'bg-amber-500 text-white'}`}>{pendingSalespersons.length}</span>}
                  </button>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {salespersonSubTab === 'pending' ? (
                <div className="flex flex-col h-[600px]"><div className="flex-1 overflow-auto rounded-b-2xl">
                  {pendingSalespersons.length === 0 ? <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400"><CheckCircle2 className="h-10 w-10 text-emerald-300" /><p className="text-sm font-medium">No pending approvals</p></div> : (
                    <>
                      {/* Mobile card view */}
                      <div className="md:hidden p-3 space-y-3">
                        {pendingSalespersons.map(item => {
                          const isEdit = item.request_type === 'edit'
                          const submittedBy = isEdit ? (item.pending_edit_by_name || item.created_by_name) : item.created_by_name
                          const submittedOn = isEdit ? item.pending_edit_at : item.created_at
                          return (
                            <div key={item.broker_id} className="border border-slate-100 rounded-xl p-4 bg-white shadow-sm space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-800 truncate">{item.salesman_name}</p>
                                  <p className="text-xs text-slate-500">{item.broker_id}</p>
                                </div>
                                <Badge variant="outline" className={isEdit ? "border-blue-300 text-blue-700 bg-blue-50 shrink-0" : "border-emerald-300 text-emerald-700 bg-emerald-50 shrink-0"}>
                                  {isEdit ? "Edit" : "New"}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
                                <div className="col-span-2"><span className="font-medium text-slate-600">Mobile: </span>{item.mobile_no || "—"}</div>
                                <div className="col-span-2"><span className="font-medium text-slate-600">Email: </span>{item.email_id || "—"}</div>
                                <div className="col-span-2"><span className="font-medium text-slate-600">Submitted By: </span>{submittedBy || "—"}</div>
                                <div className="col-span-2"><span className="font-medium text-slate-600">Submitted On: </span>{submittedOn ? new Date(submittedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "—"}</div>
                              </div>
                              <div className="pt-2 border-t border-slate-50 flex gap-2 w-full justify-end">
                                <Button size="sm" onClick={() => openApprovalModal('salespersons', item)} disabled={isReviewing} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white px-3 rounded-lg text-xs flex-1"><Check className="h-3.5 w-3.5 mr-1" />Approve</Button>
                                <Button size="sm" variant="outline" onClick={() => setRejectDialogContext({ tab: 'salespersons', id: item.id })} disabled={isReviewing} className="h-8 border-red-200 text-red-600 hover:bg-red-50 px-3 rounded-lg text-xs flex-1"><X className="h-3.5 w-3.5 mr-1" />Reject</Button>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Desktop Table View */}
                      <table className="hidden md:table w-full caption-bottom text-sm">
                        <TableHeader className="sticky top-0 z-20 bg-amber-50 shadow-sm">
                          <TableRow className="hover:bg-transparent border-b">
                            <TableHead className="pl-6">ID</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Mobile</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Submitted By</TableHead>
                            <TableHead>Submitted On</TableHead>
                            <TableHead className="text-right pr-6">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pendingSalespersons.map(item => {
                            const isEdit = item.request_type === 'edit'
                            const submittedBy = isEdit ? (item.pending_edit_by_name || item.created_by_name) : item.created_by_name
                            const submittedOn = isEdit ? item.pending_edit_at : item.created_at
                            return (
                            <TableRow key={item.broker_id} className="hover:bg-amber-50/30 border-b border-slate-50 h-16">
                              <TableCell className="font-medium pl-6 text-slate-500">{item.broker_id}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={isEdit ? "border-blue-300 text-blue-700 bg-blue-50" : "border-emerald-300 text-emerald-700 bg-emerald-50"}>
                                  {isEdit ? "Edit" : "New"}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-semibold text-slate-900">{item.salesman_name}</TableCell>
                              <TableCell>{item.mobile_no || "—"}</TableCell>
                              <TableCell>{item.email_id || "—"}</TableCell>
                              <TableCell>{submittedBy || "—"}</TableCell>
                              <TableCell className="text-slate-500 text-xs">{submittedOn ? new Date(submittedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "—"}</TableCell>
                              <TableCell className="text-right pr-6">
                                <div className="flex justify-end gap-2">
                                  <Button size="sm" onClick={() => openApprovalModal('salespersons', item)} disabled={isReviewing} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white px-3 rounded-lg">
                                    <Check className="h-3.5 w-3.5 mr-1" /> Approve
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => setRejectDialogContext({ tab: 'salespersons', id: item.id })} disabled={isReviewing} className="h-8 border-red-200 text-red-600 hover:bg-red-50 px-3 rounded-lg">
                                    <X className="h-3.5 w-3.5 mr-1" /> Reject
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )})}
                        </TableBody>
                      </table>
                    </>
                  )}
                </div></div>
              ) : (
              <>
              {/* Mobile card view */}
              <div className="md:hidden">
                {isSalespersonLoading && salespersons.length === 0 ? (
                  <div className="p-4 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="border border-slate-100 rounded-xl p-4 space-y-2 animate-pulse"><div className="h-4 w-32 bg-slate-200 rounded" /><div className="h-3 w-40 bg-slate-200 rounded" /></div>)}</div>
                ) : salespersons.length === 0 ? (
                  <div className="text-center py-16 text-slate-400">No salespersons found</div>
                ) : (
                  <div className="p-3 space-y-3 overflow-auto" style={{ maxHeight: 600 }}>
                    {sortedSalespersons.map(item => (
                      <div key={item.broker_id} className="border border-slate-100 rounded-xl p-4 bg-white shadow-sm space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 truncate">{item.salesman_name}</p>
                            <p className="text-xs text-slate-500">{item.broker_id}</p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={!canEditActiveTab} title={!canEditActiveTab ? "View Only" : "Edit"}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50" disabled={!canEditExisting} title={!canEditExisting ? "Admin Only" : "Delete"}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </div>
                        <div className="text-xs text-slate-500 space-y-0.5">
                          <div><span className="font-medium text-slate-600">Mobile: </span>{item.mobile_no || "—"}</div>
                          <div><span className="font-medium text-slate-600">Email: </span>{item.email_id || "—"}</div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={item.status === 'Active' ? 'default' : 'secondary'} className={item.status === 'Active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none' : ''}>{item.status}</Badge>
                          {item.has_pending_edit && <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">Edit pending approval</Badge>}
                        </div>
                      </div>
                    ))}
                    {isFetchingNextSalesperson && <div className="flex items-center justify-center py-4 gap-2 text-slate-400 text-xs"><div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.3s]" /><div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.15s]" /><div className="h-1.5 w-1.5 bg-primary animate-bounce" /><span className="ml-2">Loading more salespersons...</span></div>}
                  </div>
                )}
              </div>
              {/* Desktop table */}
              <div className="hidden md:flex flex-col h-[600px]">
                <div className="flex-1 overflow-auto rounded-b-2xl">
                  <table className="w-full caption-bottom text-sm">
                    <TableHeader className="sticky top-0 z-20 bg-slate-50 shadow-sm">
                      <TableRow className="hover:bg-transparent border-b">
                        <TableHead className="pl-6 cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('broker_id', salespersonSort, setSalespersonSort)}>ID <SortIcon col="broker_id" sort={salespersonSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('salesman_name', salespersonSort, setSalespersonSort)}>Salesman Name <SortIcon col="salesman_name" sort={salespersonSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('mobile_no', salespersonSort, setSalespersonSort)}>Contact (Mobile/Email) <SortIcon col="mobile_no" sort={salespersonSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('status', salespersonSort, setSalespersonSort)}>Status <SortIcon col="status" sort={salespersonSort} /></TableHead>
                        <TableHead className="text-right pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isSalespersonLoading && salespersons.length === 0 ? (
                        [...Array(8)].map((_, i) => (
                          <TableRow key={i} className="opacity-40 border-b border-slate-50 h-16">
                            <TableCell className="pl-6"><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-32 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-8 w-40 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-6 w-20 bg-slate-200 animate-pulse rounded-full" /></TableCell>
                            <TableCell className="pr-6"><div className="h-8 w-16 bg-slate-100 animate-pulse rounded ml-auto" /></TableCell>
                          </TableRow>
                        ))
                      ) : salespersons.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-20 text-slate-400">No salespersons found</TableCell></TableRow>
                      ) : (
                        <>
                          {sortedSalespersons.map(item => (
                            <TableRow key={item.broker_id} className="hover:bg-slate-50/30 transition-colors border-b border-slate-50 h-16">
                              <TableCell className="font-medium pl-6">{item.broker_id}</TableCell>
                              <TableCell className="font-semibold text-slate-900">{item.salesman_name}</TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  <p className="text-slate-600 font-medium">{item.mobile_no || "—"}</p>
                                  <p className="text-slate-400 text-xs">{item.email_id || "—"}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Badge variant={item.status === 'Active' ? 'default' : 'secondary'} className={item.status === 'Active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none' : ''}>
                                    {item.status}
                                  </Badge>
                                  {item.has_pending_edit && (
                                    <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50 whitespace-nowrap" title="An edit to this record is awaiting admin approval">
                                      Edit pending
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right pr-6">
                                <div className="flex justify-end gap-2">
                                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={!canEditActiveTab} title={!canEditActiveTab ? "View Only" : "Edit Salesperson"}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50" disabled={!canEditExisting} title={!canEditExisting ? "Admin Only" : "Delete Salesperson"}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {/* Infinite Scroll Sentinel */}
                          <TableRow ref={salespersonEndRef}>
                            <TableCell colSpan={5} className="p-0 h-12 border-none">
                              {isFetchingNextSalesperson && (
                                <div className="flex items-center justify-center py-4 text-slate-400 bg-slate-50/20">
                                  <div className="flex gap-1.5 items-center bg-white px-4 py-1.5 rounded-full shadow-sm border border-slate-100">
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.3s]"></div>
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.15s]"></div>
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce"></div>
                                    <span className="text-xs font-medium ml-2 text-slate-500">Loading more salespersons...</span>
                                  </div>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </table>
                </div>
              </div>
              </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {visibleTabs.includes("ledger_groups") && (
        <TabsContent value="ledger_groups">
          <Card className="shadow-xl border-none rounded-2xl bg-white">
            <CardHeader className="bg-slate-50/50 border-b p-6">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    Ledger Groups List
                  </CardTitle>
                  <CardDescription className="mt-1">Manage your ledger group categories</CardDescription>
                </div>
              </div>
              {isAdminOrSuper && (
                <div className="flex gap-2 mt-4">
                  <button onClick={() => setLedgerGroupSubTab('active')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${ledgerGroupSubTab === 'active' ? 'bg-primary text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Active Records</button>
                  <button onClick={() => setLedgerGroupSubTab('pending')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${ledgerGroupSubTab === 'pending' ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    Pending Approval {pendingLedgerGroups.length > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${ledgerGroupSubTab === 'pending' ? 'bg-white text-amber-600' : 'bg-amber-500 text-white'}`}>{pendingLedgerGroups.length}</span>}
                  </button>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {ledgerGroupSubTab === 'pending' ? (
                <div className="flex flex-col h-[600px]"><div className="flex-1 overflow-auto rounded-b-2xl">
                  {pendingLedgerGroups.length === 0 ? <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400"><CheckCircle2 className="h-10 w-10 text-emerald-300" /><p className="text-sm font-medium">No pending approvals</p></div> : (
                    <>
                      {/* Mobile card view */}
                      <div className="md:hidden p-3 space-y-3">
                        {pendingLedgerGroups.map(item => {
                          const isEdit = item.request_type === 'edit'
                          const submittedBy = isEdit ? (item.pending_edit_by_name || item.created_by_name) : item.created_by_name
                          const submittedOn = isEdit ? item.pending_edit_at : item.created_at
                          return (
                            <div key={item.group_code} className="border border-slate-100 rounded-xl p-4 bg-white shadow-sm space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-800 truncate">{item.group_name}</p>
                                  <p className="text-xs text-slate-500">{item.group_code}</p>
                                </div>
                                <Badge variant="outline" className={isEdit ? "border-blue-300 text-blue-700 bg-blue-50 shrink-0" : "border-emerald-300 text-emerald-700 bg-emerald-50 shrink-0"}>
                                  {isEdit ? "Edit" : "New"}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
                                <div className="col-span-2"><span className="font-medium text-slate-600">Submitted By: </span>{submittedBy || "—"}</div>
                                <div className="col-span-2"><span className="font-medium text-slate-600">Submitted On: </span>{submittedOn ? new Date(submittedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "—"}</div>
                              </div>
                              <div className="pt-2 border-t border-slate-50 flex gap-2 w-full justify-end">
                                <Button size="sm" onClick={() => openApprovalModal('ledger_groups', item)} disabled={isReviewing} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white px-3 rounded-lg text-xs flex-1"><Check className="h-3.5 w-3.5 mr-1" />Approve</Button>
                                <Button size="sm" variant="outline" onClick={() => setRejectDialogContext({ tab: 'ledger_groups', id: item.id })} disabled={isReviewing} className="h-8 border-red-200 text-red-600 hover:bg-red-50 px-3 rounded-lg text-xs flex-1"><X className="h-3.5 w-3.5 mr-1" />Reject</Button>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Desktop Table View */}
                      <table className="hidden md:table w-full caption-bottom text-sm">
                        <TableHeader className="sticky top-0 z-20 bg-amber-50 shadow-sm">
                          <TableRow className="hover:bg-transparent border-b">
                            <TableHead className="pl-6">Code</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Submitted By</TableHead>
                            <TableHead>Submitted On</TableHead>
                            <TableHead className="text-right pr-6">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pendingLedgerGroups.map(item => {
                            const isEdit = item.request_type === 'edit'
                            const submittedBy = isEdit ? (item.pending_edit_by_name || item.created_by_name) : item.created_by_name
                            const submittedOn = isEdit ? item.pending_edit_at : item.created_at
                            return (
                            <TableRow key={item.group_code} className="hover:bg-amber-50/30 border-b border-slate-50 h-16">
                              <TableCell className="font-medium pl-6 text-slate-500">{item.group_code}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={isEdit ? "border-blue-300 text-blue-700 bg-blue-50" : "border-emerald-300 text-emerald-700 bg-emerald-50"}>
                                  {isEdit ? "Edit" : "New"}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-semibold text-slate-900">{item.group_name}</TableCell>
                              <TableCell>{submittedBy || "—"}</TableCell>
                              <TableCell className="text-slate-500 text-xs">{submittedOn ? new Date(submittedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "—"}</TableCell>
                              <TableCell className="text-right pr-6">
                                <div className="flex justify-end gap-2">
                                  <Button size="sm" onClick={() => openApprovalModal('ledger_groups', item)} disabled={isReviewing} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white px-3 rounded-lg">
                                    <Check className="h-3.5 w-3.5 mr-1" /> Approve
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => setRejectDialogContext({ tab: 'ledger_groups', id: item.id })} disabled={isReviewing} className="h-8 border-red-200 text-red-600 hover:bg-red-50 px-3 rounded-lg">
                                    <X className="h-3.5 w-3.5 mr-1" /> Reject
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )})}
                        </TableBody>
                      </table>
                    </>
                  )}
                </div></div>
              ) : (
              <>
              {/* Mobile card view */}
              <div className="md:hidden">
                {isLedgerGroupLoading && ledgerGroupsList.length === 0 ? (
                  <div className="p-4 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="border border-slate-100 rounded-xl p-4 space-y-2 animate-pulse"><div className="h-4 w-32 bg-slate-200 rounded" /><div className="h-3 w-40 bg-slate-200 rounded" /></div>)}</div>
                ) : ledgerGroupsList.length === 0 ? (
                  <div className="text-center py-16 text-slate-400">No ledger groups found</div>
                ) : (
                  <div className="p-3 space-y-3 overflow-auto" style={{ maxHeight: 600 }}>
                    {sortedLedgerGroups.map((item: any) => (
                      <div key={item.group_code} className="border border-slate-100 rounded-xl p-4 bg-white shadow-sm space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 truncate">{item.group_name}</p>
                            <p className="text-xs text-slate-500">{item.group_code}</p>
                          </div>
                          {!item.is_system && (
                            <div className="flex gap-1 shrink-0">
                              <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={!canEditActiveTab} title={!canEditActiveTab ? "View Only" : "Edit"}><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50" disabled={!canEditExisting} title={!canEditExisting ? "Admin Only" : "Delete"}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={item.status === 'Active' ? 'default' : 'secondary'} className={item.status === 'Active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none' : ''}>{item.status}</Badge>
                          {item.is_system && <Badge variant="outline" className="border-slate-300 text-slate-600 bg-slate-50">Primary (system)</Badge>}
                        </div>
                      </div>
                    ))}
                    {isFetchingNextLedgerGroup && <div className="flex items-center justify-center py-4 gap-2 text-slate-400 text-xs"><div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.3s]" /><div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.15s]" /><div className="h-1.5 w-1.5 bg-primary animate-bounce" /><span className="ml-2">Loading more ledger groups...</span></div>}
                  </div>
                )}
              </div>
              {/* Desktop table */}
              <div className="hidden md:flex flex-col h-[600px]">
                <div className="flex-1 overflow-auto rounded-b-2xl">
                  <table className="w-full caption-bottom text-sm">
                    <TableHeader className="sticky top-0 z-20 bg-slate-50 shadow-sm">
                      <TableRow className="hover:bg-transparent border-b">
                        <TableHead className="pl-6 cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('group_code', ledgerGroupSort, setLedgerGroupSort)}>Code <SortIcon col="group_code" sort={ledgerGroupSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('group_name', ledgerGroupSort, setLedgerGroupSort)}>Group Name <SortIcon col="group_name" sort={ledgerGroupSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('status', ledgerGroupSort, setLedgerGroupSort)}>Status <SortIcon col="status" sort={ledgerGroupSort} /></TableHead>
                        <TableHead className="text-right pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLedgerGroupLoading && ledgerGroupsList.length === 0 ? (
                        [...Array(8)].map((_, i) => (
                          <TableRow key={i} className="opacity-40 border-b border-slate-50 h-16">
                            <TableCell className="pl-6"><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-32 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-6 w-20 bg-slate-200 animate-pulse rounded-full" /></TableCell>
                            <TableCell className="pr-6"><div className="h-8 w-16 bg-slate-100 animate-pulse rounded ml-auto" /></TableCell>
                          </TableRow>
                        ))
                      ) : ledgerGroupsList.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center py-20 text-slate-400">No ledger groups found</TableCell></TableRow>
                      ) : (
                        <>
                          {sortedLedgerGroups.map((item: any) => (
                            <TableRow key={item.group_code} className="hover:bg-slate-50/30 transition-colors border-b border-slate-50 h-16">
                              <TableCell className="font-medium pl-6">{item.group_code}</TableCell>
                              <TableCell className="font-semibold text-slate-900">
                                {item.group_name}
                                {item.is_system && <Badge variant="outline" className="ml-2 border-slate-300 text-slate-600 bg-slate-50">Primary</Badge>}
                              </TableCell>
                              <TableCell>
                                <Badge variant={item.status === 'Active' ? 'default' : 'secondary'} className={item.status === 'Active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none' : ''}>
                                  {item.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right pr-6">
                                {!item.is_system && (
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={!canEditActiveTab} title={!canEditActiveTab ? "View Only" : "Edit Ledger Group"}>
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50" disabled={!canEditExisting} title={!canEditExisting ? "Admin Only" : "Delete Ledger Group"}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                          {/* Infinite Scroll Sentinel */}
                          <TableRow ref={ledgerGroupEndRef}>
                            <TableCell colSpan={4} className="p-0 h-12 border-none">
                              {isFetchingNextLedgerGroup && (
                                <div className="flex items-center justify-center py-4 text-slate-400 bg-slate-50/20">
                                  <div className="flex gap-1.5 items-center bg-white px-4 py-1.5 rounded-full shadow-sm border border-slate-100">
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.3s]"></div>
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.15s]"></div>
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce"></div>
                                    <span className="text-xs font-medium ml-2 text-slate-500">Loading more ledger groups...</span>
                                  </div>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </table>
                </div>
              </div>
              </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {visibleTabs.includes("stock_groups") && (
        <TabsContent value="stock_groups">
          <Card className="shadow-xl border-none rounded-2xl bg-white">
            <CardHeader className="bg-slate-50/50 border-b p-6">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Layers className="h-5 w-5 text-primary" />
                    Stock Groups List
                  </CardTitle>
                  <CardDescription className="mt-1">Manage your stock group categories</CardDescription>
                </div>
              </div>
              {isAdminOrSuper && (
                <div className="flex gap-2 mt-4">
                  <button onClick={() => setStockGroupSubTab('active')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${stockGroupSubTab === 'active' ? 'bg-primary text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Active Records</button>
                  <button onClick={() => setStockGroupSubTab('pending')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${stockGroupSubTab === 'pending' ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    Pending Approval {pendingStockGroups.length > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${stockGroupSubTab === 'pending' ? 'bg-white text-amber-600' : 'bg-amber-500 text-white'}`}>{pendingStockGroups.length}</span>}
                  </button>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {stockGroupSubTab === 'pending' ? (
                <div className="flex flex-col h-[600px]"><div className="flex-1 overflow-auto rounded-b-2xl">
                  {pendingStockGroups.length === 0 ? <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400"><CheckCircle2 className="h-10 w-10 text-emerald-300" /><p className="text-sm font-medium">No pending approvals</p></div> : (
                    <>
                      {/* Mobile card view */}
                      <div className="md:hidden p-3 space-y-3">
                        {pendingStockGroups.map(item => {
                          const isEdit = item.request_type === 'edit'
                          const submittedBy = isEdit ? (item.pending_edit_by_name || item.created_by_name) : item.created_by_name
                          const submittedOn = isEdit ? item.pending_edit_at : item.created_at
                          return (
                            <div key={item.group_code} className="border border-slate-100 rounded-xl p-4 bg-white shadow-sm space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-800 truncate">{item.group_name}</p>
                                  <p className="text-xs text-slate-500">{item.group_code}</p>
                                </div>
                                <Badge variant="outline" className={isEdit ? "border-blue-300 text-blue-700 bg-blue-50 shrink-0" : "border-emerald-300 text-emerald-700 bg-emerald-50 shrink-0"}>
                                  {isEdit ? "Edit" : "New"}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
                                <div className="col-span-2"><span className="font-medium text-slate-600">Submitted By: </span>{submittedBy || "—"}</div>
                                <div className="col-span-2"><span className="font-medium text-slate-600">Submitted On: </span>{submittedOn ? new Date(submittedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "—"}</div>
                              </div>
                              <div className="pt-2 border-t border-slate-50 flex gap-2 w-full justify-end">
                                <Button size="sm" onClick={() => openApprovalModal('stock_groups', item)} disabled={isReviewing} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white px-3 rounded-lg text-xs flex-1"><Check className="h-3.5 w-3.5 mr-1" />Approve</Button>
                                <Button size="sm" variant="outline" onClick={() => setRejectDialogContext({ tab: 'stock_groups', id: item.id })} disabled={isReviewing} className="h-8 border-red-200 text-red-600 hover:bg-red-50 px-3 rounded-lg text-xs flex-1"><X className="h-3.5 w-3.5 mr-1" />Reject</Button>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Desktop Table View */}
                      <table className="hidden md:table w-full caption-bottom text-sm">
                        <TableHeader className="sticky top-0 z-20 bg-amber-50 shadow-sm">
                          <TableRow className="hover:bg-transparent border-b">
                            <TableHead className="pl-6">Code</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Submitted By</TableHead>
                            <TableHead>Submitted On</TableHead>
                            <TableHead className="text-right pr-6">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pendingStockGroups.map(item => {
                            const isEdit = item.request_type === 'edit'
                            const submittedBy = isEdit ? (item.pending_edit_by_name || item.created_by_name) : item.created_by_name
                            const submittedOn = isEdit ? item.pending_edit_at : item.created_at
                            return (
                            <TableRow key={item.group_code} className="hover:bg-amber-50/30 border-b border-slate-50 h-16">
                              <TableCell className="font-medium pl-6 text-slate-500">{item.group_code}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={isEdit ? "border-blue-300 text-blue-700 bg-blue-50" : "border-emerald-300 text-emerald-700 bg-emerald-50"}>
                                  {isEdit ? "Edit" : "New"}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-semibold text-slate-900">{item.group_name}</TableCell>
                              <TableCell>{submittedBy || "—"}</TableCell>
                              <TableCell className="text-slate-500 text-xs">{submittedOn ? new Date(submittedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "—"}</TableCell>
                              <TableCell className="text-right pr-6">
                                <div className="flex justify-end gap-2">
                                  <Button size="sm" onClick={() => openApprovalModal('stock_groups', item)} disabled={isReviewing} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white px-3 rounded-lg">
                                    <Check className="h-3.5 w-3.5 mr-1" /> Approve
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => setRejectDialogContext({ tab: 'stock_groups', id: item.id })} disabled={isReviewing} className="h-8 border-red-200 text-red-600 hover:bg-red-50 px-3 rounded-lg">
                                    <X className="h-3.5 w-3.5 mr-1" /> Reject
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )})}
                        </TableBody>
                      </table>
                    </>
                  )}
                </div></div>
              ) : (
              <>
              {/* Mobile card view */}
              <div className="md:hidden">
                {isStockGroupLoading && stockGroupsList.length === 0 ? (
                  <div className="p-4 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="border border-slate-100 rounded-xl p-4 space-y-2 animate-pulse"><div className="h-4 w-32 bg-slate-200 rounded" /><div className="h-3 w-40 bg-slate-200 rounded" /></div>)}</div>
                ) : stockGroupsList.length === 0 ? (
                  <div className="text-center py-16 text-slate-400">No stock groups found</div>
                ) : (
                  <div className="p-3 space-y-3 overflow-auto" style={{ maxHeight: 600 }}>
                    {sortedStockGroups.map((item: any) => (
                      <div key={item.group_code} className="border border-slate-100 rounded-xl p-4 bg-white shadow-sm space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 truncate">{item.group_name}</p>
                            <p className="text-xs text-slate-500">{item.group_code}</p>
                          </div>
                          {!item.is_system && (
                            <div className="flex gap-1 shrink-0">
                              <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={!canEditActiveTab} title={!canEditActiveTab ? "View Only" : "Edit"}><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50" disabled={!canEditExisting} title={!canEditExisting ? "Admin Only" : "Delete"}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={item.status === 'Active' ? 'default' : 'secondary'} className={item.status === 'Active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none' : ''}>{item.status}</Badge>
                          {item.is_system && <Badge variant="outline" className="border-slate-300 text-slate-600 bg-slate-50">Primary (system)</Badge>}
                        </div>
                      </div>
                    ))}
                    {isFetchingNextStockGroup && <div className="flex items-center justify-center py-4 gap-2 text-slate-400 text-xs"><div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.3s]" /><div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.15s]" /><div className="h-1.5 w-1.5 bg-primary animate-bounce" /><span className="ml-2">Loading more stock groups...</span></div>}
                  </div>
                )}
              </div>
              {/* Desktop table */}
              <div className="hidden md:flex flex-col h-[600px]">
                <div className="flex-1 overflow-auto rounded-b-2xl">
                  <table className="w-full caption-bottom text-sm">
                    <TableHeader className="sticky top-0 z-20 bg-slate-50 shadow-sm">
                      <TableRow className="hover:bg-transparent border-b">
                        <TableHead className="pl-6 cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('group_code', stockGroupSort, setStockGroupSort)}>Code <SortIcon col="group_code" sort={stockGroupSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('group_name', stockGroupSort, setStockGroupSort)}>Group Name <SortIcon col="group_name" sort={stockGroupSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('status', stockGroupSort, setStockGroupSort)}>Status <SortIcon col="status" sort={stockGroupSort} /></TableHead>
                        <TableHead className="text-right pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isStockGroupLoading && stockGroupsList.length === 0 ? (
                        [...Array(8)].map((_, i) => (
                          <TableRow key={i} className="opacity-40 border-b border-slate-50 h-16">
                            <TableCell className="pl-6"><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-32 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-6 w-20 bg-slate-200 animate-pulse rounded-full" /></TableCell>
                            <TableCell className="pr-6"><div className="h-8 w-16 bg-slate-100 animate-pulse rounded ml-auto" /></TableCell>
                          </TableRow>
                        ))
                      ) : stockGroupsList.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center py-20 text-slate-400">No stock groups found</TableCell></TableRow>
                      ) : (
                        <>
                          {sortedStockGroups.map((item: any) => (
                            <TableRow key={item.group_code} className="hover:bg-slate-50/30 transition-colors border-b border-slate-50 h-16">
                              <TableCell className="font-medium pl-6">{item.group_code}</TableCell>
                              <TableCell className="font-semibold text-slate-900">
                                {item.group_name}
                                {item.is_system && <Badge variant="outline" className="ml-2 border-slate-300 text-slate-600 bg-slate-50">Primary</Badge>}
                              </TableCell>
                              <TableCell>
                                <Badge variant={item.status === 'Active' ? 'default' : 'secondary'} className={item.status === 'Active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none' : ''}>
                                  {item.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right pr-6">
                                {!item.is_system && (
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={!canEditActiveTab} title={!canEditActiveTab ? "View Only" : "Edit Stock Group"}>
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50" disabled={!canEditExisting} title={!canEditExisting ? "Admin Only" : "Delete Stock Group"}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                          {/* Infinite Scroll Sentinel */}
                          <TableRow ref={stockGroupEndRef}>
                            <TableCell colSpan={4} className="p-0 h-12 border-none">
                              {isFetchingNextStockGroup && (
                                <div className="flex items-center justify-center py-4 text-slate-400 bg-slate-50/20">
                                  <div className="flex gap-1.5 items-center bg-white px-4 py-1.5 rounded-full shadow-sm border border-slate-100">
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.3s]"></div>
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.15s]"></div>
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce"></div>
                                    <span className="text-xs font-medium ml-2 text-slate-500">Loading more stock groups...</span>
                                  </div>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </table>
                </div>
              </div>
              </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {visibleTabs.includes("units") && (
        <TabsContent value="units">
          <Card className="shadow-xl border-none rounded-2xl bg-white">
            <CardHeader className="bg-slate-50/50 border-b p-6">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Ruler className="h-5 w-5 text-primary" />
                    Units List
                  </CardTitle>
                  <CardDescription className="mt-1">Manage your units of measurement (UOM)</CardDescription>
                </div>
              </div>
              {isAdminOrSuper && (
                <div className="flex gap-2 mt-4">
                  <button onClick={() => setUnitSubTab('active')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${unitSubTab === 'active' ? 'bg-primary text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Active Records</button>
                  <button onClick={() => setUnitSubTab('pending')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${unitSubTab === 'pending' ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    Pending Approval {pendingUnits.length > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${unitSubTab === 'pending' ? 'bg-white text-amber-600' : 'bg-amber-500 text-white'}`}>{pendingUnits.length}</span>}
                  </button>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {unitSubTab === 'pending' ? (
                <div className="flex flex-col h-[600px]"><div className="flex-1 overflow-auto rounded-b-2xl">
                  {pendingUnits.length === 0 ? <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400"><CheckCircle2 className="h-10 w-10 text-emerald-300" /><p className="text-sm font-medium">No pending approvals</p></div> : (
                    <>
                      {/* Mobile card view */}
                      <div className="md:hidden p-3 space-y-3">
                        {pendingUnits.map(item => {
                          const isEdit = item.request_type === 'edit'
                          const submittedBy = isEdit ? (item.pending_edit_by_name || item.created_by_name) : item.created_by_name
                          const submittedOn = isEdit ? item.pending_edit_at : item.created_at
                          return (
                            <div key={item.unit_code} className="border border-slate-100 rounded-xl p-4 bg-white shadow-sm space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-800 truncate">{item.unit_name}</p>
                                  <p className="text-xs text-slate-500">{item.unit_code}</p>
                                </div>
                                <Badge variant="outline" className={isEdit ? "border-blue-300 text-blue-700 bg-blue-50 shrink-0" : "border-emerald-300 text-emerald-700 bg-emerald-50 shrink-0"}>
                                  {isEdit ? "Edit" : "New"}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
                                <div className="col-span-2"><span className="font-medium text-slate-600">Submitted By: </span>{submittedBy || "—"}</div>
                                <div className="col-span-2"><span className="font-medium text-slate-600">Submitted On: </span>{submittedOn ? new Date(submittedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "—"}</div>
                              </div>
                              <div className="pt-2 border-t border-slate-50 flex gap-2 w-full justify-end">
                                <Button size="sm" onClick={() => openApprovalModal('units', item)} disabled={isReviewing} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white px-3 rounded-lg text-xs flex-1"><Check className="h-3.5 w-3.5 mr-1" />Approve</Button>
                                <Button size="sm" variant="outline" onClick={() => setRejectDialogContext({ tab: 'units', id: item.id })} disabled={isReviewing} className="h-8 border-red-200 text-red-600 hover:bg-red-50 px-3 rounded-lg text-xs flex-1"><X className="h-3.5 w-3.5 mr-1" />Reject</Button>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Desktop Table View */}
                      <table className="hidden md:table w-full caption-bottom text-sm">
                        <TableHeader className="sticky top-0 z-20 bg-amber-50 shadow-sm">
                          <TableRow className="hover:bg-transparent border-b">
                            <TableHead className="pl-6">Code</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Submitted By</TableHead>
                            <TableHead>Submitted On</TableHead>
                            <TableHead className="text-right pr-6">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pendingUnits.map(item => {
                            const isEdit = item.request_type === 'edit'
                            const submittedBy = isEdit ? (item.pending_edit_by_name || item.created_by_name) : item.created_by_name
                            const submittedOn = isEdit ? item.pending_edit_at : item.created_at
                            return (
                            <TableRow key={item.unit_code} className="hover:bg-amber-50/30 border-b border-slate-50 h-16">
                              <TableCell className="font-medium pl-6 text-slate-500">{item.unit_code}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={isEdit ? "border-blue-300 text-blue-700 bg-blue-50" : "border-emerald-300 text-emerald-700 bg-emerald-50"}>
                                  {isEdit ? "Edit" : "New"}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-semibold text-slate-900">{item.unit_name}</TableCell>
                              <TableCell>{submittedBy || "—"}</TableCell>
                              <TableCell className="text-slate-500 text-xs">{submittedOn ? new Date(submittedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "—"}</TableCell>
                              <TableCell className="text-right pr-6">
                                <div className="flex justify-end gap-2">
                                  <Button size="sm" onClick={() => openApprovalModal('units', item)} disabled={isReviewing} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white px-3 rounded-lg">
                                    <Check className="h-3.5 w-3.5 mr-1" /> Approve
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => setRejectDialogContext({ tab: 'units', id: item.id })} disabled={isReviewing} className="h-8 border-red-200 text-red-600 hover:bg-red-50 px-3 rounded-lg">
                                    <X className="h-3.5 w-3.5 mr-1" /> Reject
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )})}
                        </TableBody>
                      </table>
                    </>
                  )}
                </div></div>
              ) : (
              <>
              {/* Mobile card view */}
              <div className="md:hidden">
                {isUnitLoading && unitsList.length === 0 ? (
                  <div className="p-4 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="border border-slate-100 rounded-xl p-4 space-y-2 animate-pulse"><div className="h-4 w-32 bg-slate-200 rounded" /><div className="h-3 w-40 bg-slate-200 rounded" /></div>)}</div>
                ) : unitsList.length === 0 ? (
                  <div className="text-center py-16 text-slate-400">No units found</div>
                ) : (
                  <div className="p-3 space-y-3 overflow-auto" style={{ maxHeight: 600 }}>
                    {sortedUnits.map((item: any) => (
                      <div key={item.unit_code} className="border border-slate-100 rounded-xl p-4 bg-white shadow-sm space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 truncate">{item.unit_name}</p>
                            <p className="text-xs text-slate-500">{item.unit_code}</p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={!canEditActiveTab} title={!canEditActiveTab ? "View Only" : "Edit"}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50" disabled={!canEditExisting} title={!canEditExisting ? "Admin Only" : "Delete"}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={item.status === 'Active' ? 'default' : 'secondary'} className={item.status === 'Active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none' : ''}>{item.status}</Badge>
                        </div>
                      </div>
                    ))}
                    {isFetchingNextUnit && <div className="flex items-center justify-center py-4 gap-2 text-slate-400 text-xs"><div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.3s]" /><div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.15s]" /><div className="h-1.5 w-1.5 bg-primary animate-bounce" /><span className="ml-2">Loading more units...</span></div>}
                  </div>
                )}
              </div>
              {/* Desktop table */}
              <div className="hidden md:flex flex-col h-[600px]">
                <div className="flex-1 overflow-auto rounded-b-2xl">
                  <table className="w-full caption-bottom text-sm">
                    <TableHeader className="sticky top-0 z-20 bg-slate-50 shadow-sm">
                      <TableRow className="hover:bg-transparent border-b">
                        <TableHead className="pl-6 cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('unit_code', unitSort, setUnitSort)}>Code <SortIcon col="unit_code" sort={unitSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('unit_name', unitSort, setUnitSort)}>UOM <SortIcon col="unit_name" sort={unitSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('status', unitSort, setUnitSort)}>Status <SortIcon col="status" sort={unitSort} /></TableHead>
                        <TableHead className="text-right pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isUnitLoading && unitsList.length === 0 ? (
                        [...Array(8)].map((_, i) => (
                          <TableRow key={i} className="opacity-40 border-b border-slate-50 h-16">
                            <TableCell className="pl-6"><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-32 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-6 w-20 bg-slate-200 animate-pulse rounded-full" /></TableCell>
                            <TableCell className="pr-6"><div className="h-8 w-16 bg-slate-100 animate-pulse rounded ml-auto" /></TableCell>
                          </TableRow>
                        ))
                      ) : unitsList.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center py-20 text-slate-400">No units found</TableCell></TableRow>
                      ) : (
                        <>
                          {sortedUnits.map((item: any) => (
                            <TableRow key={item.unit_code} className="hover:bg-slate-50/30 transition-colors border-b border-slate-50 h-16">
                              <TableCell className="font-medium pl-6">{item.unit_code}</TableCell>
                              <TableCell className="font-semibold text-slate-900">{item.unit_name}</TableCell>
                              <TableCell>
                                <Badge variant={item.status === 'Active' ? 'default' : 'secondary'} className={item.status === 'Active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none' : ''}>
                                  {item.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right pr-6">
                                <div className="flex justify-end gap-2">
                                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={!canEditActiveTab} title={!canEditActiveTab ? "View Only" : "Edit Unit"}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50" disabled={!canEditExisting} title={!canEditExisting ? "Admin Only" : "Delete Unit"}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {/* Infinite Scroll Sentinel */}
                          <TableRow ref={unitEndRef}>
                            <TableCell colSpan={6} className="p-0 h-12 border-none">
                              {isFetchingNextUnit && (
                                <div className="flex items-center justify-center py-4 text-slate-400 bg-slate-50/20">
                                  <div className="flex gap-1.5 items-center bg-white px-4 py-1.5 rounded-full shadow-sm border border-slate-100">
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.3s]"></div>
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.15s]"></div>
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce"></div>
                                    <span className="text-xs font-medium ml-2 text-slate-500">Loading more units...</span>
                                  </div>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </table>
                </div>
              </div>
              </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {visibleTabs.includes("raw_materials") && (
        <TabsContent value="raw_materials">
          <Card className="shadow-xl border-none rounded-2xl bg-white">
            <CardHeader className="bg-slate-50/50 border-b p-6">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <FlaskConical className="h-5 w-5 text-primary" />
                    Raw Materials List
                  </CardTitle>
                  <CardDescription className="mt-1">Manage your raw material database</CardDescription>
                </div>
              </div>
              {isAdminOrSuper && (
                <div className="flex gap-2 mt-4">
                  <button onClick={() => setRawMaterialSubTab('active')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${rawMaterialSubTab === 'active' ? 'bg-primary text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Active Records</button>
                  <button onClick={() => setRawMaterialSubTab('pending')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${rawMaterialSubTab === 'pending' ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    Pending Approval {pendingRawMaterials.length > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${rawMaterialSubTab === 'pending' ? 'bg-white text-amber-600' : 'bg-amber-500 text-white'}`}>{pendingRawMaterials.length}</span>}
                  </button>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {rawMaterialSubTab === 'pending' ? (
                <div className="flex flex-col h-[600px]"><div className="flex-1 overflow-auto rounded-b-2xl">
                  {pendingRawMaterials.length === 0 ? <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400"><CheckCircle2 className="h-10 w-10 text-emerald-300" /><p className="text-sm font-medium">No pending approvals</p></div> : (
                    <table className="w-full caption-bottom text-sm">
                      <TableHeader className="sticky top-0 z-20 bg-amber-50 shadow-sm">
                        <TableRow className="hover:bg-transparent border-b">
                          <TableHead className="pl-6">Code</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Submitted By</TableHead>
                          <TableHead>Submitted On</TableHead>
                          <TableHead className="text-right pr-6">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingRawMaterials.map(item => {
                          const isEdit = item.request_type === 'edit'
                          const submittedBy = isEdit ? (item.pending_edit_by_name || item.created_by_name) : item.created_by_name
                          const submittedOn = isEdit ? item.pending_edit_at : item.created_at
                          return (
                          <TableRow key={item.raw_material_code} className="hover:bg-amber-50/30 border-b border-slate-50 h-16">
                            <TableCell className="font-medium pl-6 text-slate-500">{item.raw_material_code}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={isEdit ? "border-blue-300 text-blue-700 bg-blue-50" : "border-emerald-300 text-emerald-700 bg-emerald-50"}>
                                {isEdit ? "Edit" : "New"}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-semibold text-slate-900">{item.name}</TableCell>
                            <TableCell>{submittedBy || "—"}</TableCell>
                            <TableCell className="text-slate-500 text-xs">{submittedOn ? new Date(submittedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "—"}</TableCell>
                            <TableCell className="text-right pr-6">
                              <div className="flex justify-end gap-2">
                                <Button size="sm" onClick={() => openApprovalModal('raw_materials', item)} disabled={isReviewing} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white px-3 rounded-lg">
                                  <Check className="h-3.5 w-3.5 mr-1" /> Approve
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setRejectDialogContext({ tab: 'raw_materials', id: item.id })} disabled={isReviewing} className="h-8 border-red-200 text-red-600 hover:bg-red-50 px-3 rounded-lg">
                                  <X className="h-3.5 w-3.5 mr-1" /> Reject
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )})}
                      </TableBody>
                    </table>
                  )}
                </div></div>
              ) : (
                <div className="flex flex-col h-[600px]">
                  <div className="flex-1 overflow-auto rounded-b-2xl">
                    <table className="w-full caption-bottom text-sm">
                      <TableHeader className="sticky top-0 z-20 bg-slate-50 shadow-sm">
                        <TableRow className="hover:bg-transparent border-b">
                          <TableHead className="pl-6 cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('raw_material_code', rawMaterialSort, setRawMaterialSort)}>Code <SortIcon col="raw_material_code" sort={rawMaterialSort} /></TableHead>
                          <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('name', rawMaterialSort, setRawMaterialSort)}>Name <SortIcon col="name" sort={rawMaterialSort} /></TableHead>
                          <TableHead>Main UOM</TableHead>
                          <TableHead>Type of Supply</TableHead>
                          <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('status', rawMaterialSort, setRawMaterialSort)}>Status <SortIcon col="status" sort={rawMaterialSort} /></TableHead>
                          <TableHead className="text-right pr-6">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isRawMaterialLoading && rawMaterialsList.length === 0 ? (
                          [...Array(8)].map((_, i) => (
                            <TableRow key={i} className="opacity-40 border-b border-slate-50 h-16">
                              <TableCell className="pl-6"><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                              <TableCell><div className="h-4 w-32 bg-slate-200 animate-pulse rounded" /></TableCell>
                              <TableCell><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                              <TableCell><div className="h-4 w-20 bg-slate-200 animate-pulse rounded" /></TableCell>
                              <TableCell><div className="h-6 w-20 bg-slate-200 animate-pulse rounded-full" /></TableCell>
                              <TableCell className="pr-6"><div className="h-8 w-16 bg-slate-100 animate-pulse rounded ml-auto" /></TableCell>
                            </TableRow>
                          ))
                        ) : rawMaterialsList.length === 0 ? (
                          <TableRow><TableCell colSpan={6} className="text-center py-20 text-slate-400">No raw materials found</TableCell></TableRow>
                        ) : (
                          <>
                            {sortedRawMaterials.map((item: any) => (
                              <TableRow key={item.raw_material_code} className="hover:bg-slate-50/30 transition-colors border-b border-slate-50 h-16">
                                <TableCell className="font-medium pl-6">{item.raw_material_code}</TableCell>
                                <TableCell className="font-semibold text-slate-900">{item.name}</TableCell>
                                <TableCell>{unitOptions.find((u: any) => u.id === item.main_uom_id)?.unit_name || "—"}</TableCell>
                                <TableCell>{item.type_of_supply || "—"}</TableCell>
                                <TableCell>
                                  <Badge variant={item.status === 'Active' ? 'default' : 'secondary'} className={item.status === 'Active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none' : ''}>
                                    {item.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right pr-6">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={!canEditActiveTab} title={!canEditActiveTab ? "View Only" : "Edit Raw Material"}>
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50" disabled={!canEditExisting} title={!canEditExisting ? "Admin Only" : "Delete Raw Material"}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow ref={rawMaterialEndRef}>
                              <TableCell colSpan={6} className="p-0 h-12 border-none">
                                {isFetchingNextRawMaterial && <div className="flex items-center justify-center py-4 text-slate-400 text-xs">Loading more raw materials...</div>}
                              </TableCell>
                            </TableRow>
                          </>
                        )}
                      </TableBody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {visibleTabs.includes("semi_finished_goods") && (
        <TabsContent value="semi_finished_goods">
          <Card className="shadow-xl border-none rounded-2xl bg-white">
            <CardHeader className="bg-slate-50/50 border-b p-6">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Factory className="h-5 w-5 text-primary" />
                    Semi-Finished Goods List
                  </CardTitle>
                  <CardDescription className="mt-1">Manage your semi-finished goods database</CardDescription>
                </div>
              </div>
              {isAdminOrSuper && (
                <div className="flex gap-2 mt-4">
                  <button onClick={() => setSemiFinishedGoodSubTab('active')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${semiFinishedGoodSubTab === 'active' ? 'bg-primary text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Active Records</button>
                  <button onClick={() => setSemiFinishedGoodSubTab('pending')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${semiFinishedGoodSubTab === 'pending' ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    Pending Approval {pendingSemiFinishedGoods.length > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${semiFinishedGoodSubTab === 'pending' ? 'bg-white text-amber-600' : 'bg-amber-500 text-white'}`}>{pendingSemiFinishedGoods.length}</span>}
                  </button>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {semiFinishedGoodSubTab === 'pending' ? (
                <div className="flex flex-col h-[600px]"><div className="flex-1 overflow-auto rounded-b-2xl">
                  {pendingSemiFinishedGoods.length === 0 ? <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400"><CheckCircle2 className="h-10 w-10 text-emerald-300" /><p className="text-sm font-medium">No pending approvals</p></div> : (
                    <table className="w-full caption-bottom text-sm">
                      <TableHeader className="sticky top-0 z-20 bg-amber-50 shadow-sm">
                        <TableRow className="hover:bg-transparent border-b">
                          <TableHead className="pl-6">Code</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Submitted By</TableHead>
                          <TableHead>Submitted On</TableHead>
                          <TableHead className="text-right pr-6">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingSemiFinishedGoods.map(item => {
                          const isEdit = item.request_type === 'edit'
                          const submittedBy = isEdit ? (item.pending_edit_by_name || item.created_by_name) : item.created_by_name
                          const submittedOn = isEdit ? item.pending_edit_at : item.created_at
                          return (
                          <TableRow key={item.semi_finished_good_code} className="hover:bg-amber-50/30 border-b border-slate-50 h-16">
                            <TableCell className="font-medium pl-6 text-slate-500">{item.semi_finished_good_code}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={isEdit ? "border-blue-300 text-blue-700 bg-blue-50" : "border-emerald-300 text-emerald-700 bg-emerald-50"}>
                                {isEdit ? "Edit" : "New"}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-semibold text-slate-900">{item.name}</TableCell>
                            <TableCell>{submittedBy || "—"}</TableCell>
                            <TableCell className="text-slate-500 text-xs">{submittedOn ? new Date(submittedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "—"}</TableCell>
                            <TableCell className="text-right pr-6">
                              <div className="flex justify-end gap-2">
                                <Button size="sm" onClick={() => openApprovalModal('semi_finished_goods', item)} disabled={isReviewing} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white px-3 rounded-lg">
                                  <Check className="h-3.5 w-3.5 mr-1" /> Approve
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setRejectDialogContext({ tab: 'semi_finished_goods', id: item.id })} disabled={isReviewing} className="h-8 border-red-200 text-red-600 hover:bg-red-50 px-3 rounded-lg">
                                  <X className="h-3.5 w-3.5 mr-1" /> Reject
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )})}
                      </TableBody>
                    </table>
                  )}
                </div></div>
              ) : (
                <div className="flex flex-col h-[600px]">
                  <div className="flex-1 overflow-auto rounded-b-2xl">
                    <table className="w-full caption-bottom text-sm">
                      <TableHeader className="sticky top-0 z-20 bg-slate-50 shadow-sm">
                        <TableRow className="hover:bg-transparent border-b">
                          <TableHead className="pl-6 cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('semi_finished_good_code', semiFinishedGoodSort, setSemiFinishedGoodSort)}>Code <SortIcon col="semi_finished_good_code" sort={semiFinishedGoodSort} /></TableHead>
                          <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('name', semiFinishedGoodSort, setSemiFinishedGoodSort)}>Name <SortIcon col="name" sort={semiFinishedGoodSort} /></TableHead>
                          <TableHead>Main UOM</TableHead>
                          <TableHead>Converted Kg</TableHead>
                          <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('status', semiFinishedGoodSort, setSemiFinishedGoodSort)}>Status <SortIcon col="status" sort={semiFinishedGoodSort} /></TableHead>
                          <TableHead className="text-right pr-6">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isSemiFinishedGoodLoading && semiFinishedGoodsList.length === 0 ? (
                          [...Array(8)].map((_, i) => (
                            <TableRow key={i} className="opacity-40 border-b border-slate-50 h-16">
                              <TableCell className="pl-6"><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                              <TableCell><div className="h-4 w-32 bg-slate-200 animate-pulse rounded" /></TableCell>
                              <TableCell><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                              <TableCell><div className="h-4 w-20 bg-slate-200 animate-pulse rounded" /></TableCell>
                              <TableCell><div className="h-6 w-20 bg-slate-200 animate-pulse rounded-full" /></TableCell>
                              <TableCell className="pr-6"><div className="h-8 w-16 bg-slate-100 animate-pulse rounded ml-auto" /></TableCell>
                            </TableRow>
                          ))
                        ) : semiFinishedGoodsList.length === 0 ? (
                          <TableRow><TableCell colSpan={6} className="text-center py-20 text-slate-400">No semi-finished goods found</TableCell></TableRow>
                        ) : (
                          <>
                            {sortedSemiFinishedGoods.map((item: any) => (
                              <TableRow key={item.semi_finished_good_code} className="hover:bg-slate-50/30 transition-colors border-b border-slate-50 h-16">
                                <TableCell className="font-medium pl-6">{item.semi_finished_good_code}</TableCell>
                                <TableCell className="font-semibold text-slate-900">{item.name}</TableCell>
                                <TableCell>{unitOptions.find((u: any) => u.id === item.main_uom_id)?.unit_name || "—"}</TableCell>
                                <TableCell>{item.converted_kg ?? "—"}</TableCell>
                                <TableCell>
                                  <Badge variant={item.status === 'Active' ? 'default' : 'secondary'} className={item.status === 'Active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none' : ''}>
                                    {item.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right pr-6">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={!canEditActiveTab} title={!canEditActiveTab ? "View Only" : "Edit Semi-Finished Good"}>
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50" disabled={!canEditExisting} title={!canEditExisting ? "Admin Only" : "Delete Semi-Finished Good"}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow ref={semiFinishedGoodEndRef}>
                              <TableCell colSpan={6} className="p-0 h-12 border-none">
                                {isFetchingNextSemiFinishedGood && <div className="flex items-center justify-center py-4 text-slate-400 text-xs">Loading more semi-finished goods...</div>}
                              </TableCell>
                            </TableRow>
                          </>
                        )}
                      </TableBody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {visibleTabs.includes("petrol_pumps") && (
        <TabsContent value="petrol_pumps">
          <Card className="shadow-xl border-none rounded-2xl bg-white">
            <CardHeader className="bg-slate-50/50 border-b p-6">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Fuel className="h-5 w-5 text-primary" />
                    Petrol Pumps List
                  </CardTitle>
                  <CardDescription className="mt-1">Manage your petrol pump database</CardDescription>
                </div>
              </div>
              {isAdminOrSuper && (
                <div className="flex gap-2 mt-4">
                  <button onClick={() => setPetrolPumpSubTab('active')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${petrolPumpSubTab === 'active' ? 'bg-primary text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Active Records</button>
                  <button onClick={() => setPetrolPumpSubTab('pending')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${petrolPumpSubTab === 'pending' ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    Pending Approval {pendingPetrolPumps.length > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${petrolPumpSubTab === 'pending' ? 'bg-white text-amber-600' : 'bg-amber-500 text-white'}`}>{pendingPetrolPumps.length}</span>}
                  </button>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {petrolPumpSubTab === 'pending' ? (
                <div className="flex flex-col h-[600px]"><div className="flex-1 overflow-auto rounded-b-2xl">
                  {pendingPetrolPumps.length === 0 ? <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400"><CheckCircle2 className="h-10 w-10 text-emerald-300" /><p className="text-sm font-medium">No pending approvals</p></div> : (
                    <table className="w-full caption-bottom text-sm">
                      <TableHeader className="sticky top-0 z-20 bg-amber-50 shadow-sm">
                        <TableRow className="hover:bg-transparent border-b">
                          <TableHead className="pl-6">Code</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Submitted By</TableHead>
                          <TableHead>Submitted On</TableHead>
                          <TableHead className="text-right pr-6">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingPetrolPumps.map(item => {
                          const isEdit = item.request_type === 'edit'
                          const submittedBy = isEdit ? (item.pending_edit_by_name || item.created_by_name) : item.created_by_name
                          const submittedOn = isEdit ? item.pending_edit_at : item.created_at
                          return (
                          <TableRow key={item.petrol_pump_code} className="hover:bg-amber-50/30 border-b border-slate-50 h-16">
                            <TableCell className="font-medium pl-6 text-slate-500">{item.petrol_pump_code}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={isEdit ? "border-blue-300 text-blue-700 bg-blue-50" : "border-emerald-300 text-emerald-700 bg-emerald-50"}>
                                {isEdit ? "Edit" : "New"}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-semibold text-slate-900">{item.petrol_pump_name}</TableCell>
                            <TableCell>{submittedBy || "—"}</TableCell>
                            <TableCell className="text-slate-500 text-xs">{submittedOn ? new Date(submittedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "—"}</TableCell>
                            <TableCell className="text-right pr-6">
                              <div className="flex justify-end gap-2">
                                <Button size="sm" onClick={() => openApprovalModal('petrol_pumps', item)} disabled={isReviewing} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white px-3 rounded-lg">
                                  <Check className="h-3.5 w-3.5 mr-1" /> Approve
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setRejectDialogContext({ tab: 'petrol_pumps', id: item.id })} disabled={isReviewing} className="h-8 border-red-200 text-red-600 hover:bg-red-50 px-3 rounded-lg">
                                  <X className="h-3.5 w-3.5 mr-1" /> Reject
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )})}
                      </TableBody>
                    </table>
                  )}
                </div></div>
              ) : (
                <div className="flex flex-col h-[600px]">
                  <div className="flex-1 overflow-auto rounded-b-2xl">
                    <table className="w-full caption-bottom text-sm">
                      <TableHeader className="sticky top-0 z-20 bg-slate-50 shadow-sm">
                        <TableRow className="hover:bg-transparent border-b">
                          <TableHead className="pl-6 cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('petrol_pump_code', petrolPumpSort, setPetrolPumpSort)}>Code <SortIcon col="petrol_pump_code" sort={petrolPumpSort} /></TableHead>
                          <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('petrol_pump_name', petrolPumpSort, setPetrolPumpSort)}>Name <SortIcon col="petrol_pump_name" sort={petrolPumpSort} /></TableHead>
                          <TableHead>Mobile</TableHead>
                          <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('status', petrolPumpSort, setPetrolPumpSort)}>Status <SortIcon col="status" sort={petrolPumpSort} /></TableHead>
                          <TableHead className="text-right pr-6">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isPetrolPumpLoading && petrolPumpsList.length === 0 ? (
                          [...Array(8)].map((_, i) => (
                            <TableRow key={i} className="opacity-40 border-b border-slate-50 h-16">
                              <TableCell className="pl-6"><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                              <TableCell><div className="h-4 w-32 bg-slate-200 animate-pulse rounded" /></TableCell>
                              <TableCell><div className="h-4 w-20 bg-slate-200 animate-pulse rounded" /></TableCell>
                              <TableCell><div className="h-6 w-20 bg-slate-200 animate-pulse rounded-full" /></TableCell>
                              <TableCell className="pr-6"><div className="h-8 w-16 bg-slate-100 animate-pulse rounded ml-auto" /></TableCell>
                            </TableRow>
                          ))
                        ) : petrolPumpsList.length === 0 ? (
                          <TableRow><TableCell colSpan={5} className="text-center py-20 text-slate-400">No petrol pumps found</TableCell></TableRow>
                        ) : (
                          <>
                            {sortedPetrolPumps.map((item: any) => (
                              <TableRow key={item.petrol_pump_code} className="hover:bg-slate-50/30 transition-colors border-b border-slate-50 h-16">
                                <TableCell className="font-medium pl-6">{item.petrol_pump_code}</TableCell>
                                <TableCell className="font-semibold text-slate-900">{item.petrol_pump_name}</TableCell>
                                <TableCell>{item.mobile_no || "—"}</TableCell>
                                <TableCell>
                                  <Badge variant={item.status === 'Active' ? 'default' : 'secondary'} className={item.status === 'Active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none' : ''}>
                                    {item.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right pr-6">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={!canEditActiveTab} title={!canEditActiveTab ? "View Only" : "Edit Petrol Pump"}>
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50" disabled={!canEditExisting} title={!canEditExisting ? "Admin Only" : "Delete Petrol Pump"}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow ref={petrolPumpEndRef}>
                              <TableCell colSpan={5} className="p-0 h-12 border-none">
                                {isFetchingNextPetrolPump && <div className="flex items-center justify-center py-4 text-slate-400 text-xs">Loading more petrol pumps...</div>}
                              </TableCell>
                            </TableRow>
                          </>
                        )}
                      </TableBody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {visibleTabs.includes("cd_rules") && (
        <TabsContent value="cd_rules">
          <Card className="shadow-xl border-none rounded-2xl bg-white">
            <CardHeader className="bg-slate-50/50 border-b p-6">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Percent className="h-5 w-5 text-primary" />
                    Cash Discount Rules
                  </CardTitle>
                  <CardDescription className="mt-1">Maintain Cash Discount rules by Stock Category, rate, and payment condition</CardDescription>
                </div>
              </div>
              {isAdminOrSuper && (
                <div className="flex gap-2 mt-4">
                  <button onClick={() => setCdRuleSubTab('active')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${cdRuleSubTab === 'active' ? 'bg-primary text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Active Records</button>
                  <button onClick={() => setCdRuleSubTab('pending')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${cdRuleSubTab === 'pending' ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    Pending Approval {pendingCdRules.length > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${cdRuleSubTab === 'pending' ? 'bg-white text-amber-600' : 'bg-amber-500 text-white'}`}>{pendingCdRules.length}</span>}
                  </button>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {cdRuleSubTab === 'pending' ? (
                <div className="flex flex-col h-[600px]"><div className="flex-1 overflow-auto rounded-b-2xl">
                  {pendingCdRules.length === 0 ? <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400"><CheckCircle2 className="h-10 w-10 text-emerald-300" /><p className="text-sm font-medium">No pending approvals</p></div> : (
                    <table className="w-full caption-bottom text-sm">
                      <TableHeader className="sticky top-0 z-20 bg-amber-50 shadow-sm">
                        <TableRow className="hover:bg-transparent border-b">
                          <TableHead className="pl-6">Code</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Stock Category</TableHead>
                          <TableHead>Submitted By</TableHead>
                          <TableHead>Submitted On</TableHead>
                          <TableHead className="text-right pr-6">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingCdRules.map(item => {
                          const isEdit = item.request_type === 'edit'
                          const submittedBy = isEdit ? (item.pending_edit_by_name || item.created_by_name) : item.created_by_name
                          const submittedOn = isEdit ? item.pending_edit_at : item.created_at
                          const categoryName = (stockCategoryData || []).find((c: any) => String(c.id) === String(item.stock_category_id))?.name
                          return (
                          <TableRow key={item.cd_rule_code} className="hover:bg-amber-50/30 border-b border-slate-50 h-16">
                            <TableCell className="font-medium pl-6 text-slate-500">{item.cd_rule_code}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={isEdit ? "border-blue-300 text-blue-700 bg-blue-50" : "border-emerald-300 text-emerald-700 bg-emerald-50"}>
                                {isEdit ? "Edit" : "New"}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-semibold text-slate-900">{categoryName || "—"}</TableCell>
                            <TableCell>{submittedBy || "—"}</TableCell>
                            <TableCell className="text-slate-500 text-xs">{submittedOn ? new Date(submittedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "—"}</TableCell>
                            <TableCell className="text-right pr-6">
                              <div className="flex justify-end gap-2">
                                <Button size="sm" onClick={() => openApprovalModal('cd_rules', item)} disabled={isReviewing} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white px-3 rounded-lg">
                                  <Check className="h-3.5 w-3.5 mr-1" /> Approve
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setRejectDialogContext({ tab: 'cd_rules', id: item.id })} disabled={isReviewing} className="h-8 border-red-200 text-red-600 hover:bg-red-50 px-3 rounded-lg">
                                  <X className="h-3.5 w-3.5 mr-1" /> Reject
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )})}
                      </TableBody>
                    </table>
                  )}
                </div></div>
              ) : (
                <div className="flex flex-col h-[600px]">
                  <div className="flex-1 overflow-auto rounded-b-2xl">
                    <table className="w-full caption-bottom text-sm">
                      <TableHeader className="sticky top-0 z-20 bg-slate-50 shadow-sm">
                        <TableRow className="hover:bg-transparent border-b">
                          <TableHead className="pl-6 cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('cd_rule_code', cdRuleSort, setCdRuleSort)}>Code <SortIcon col="cd_rule_code" sort={cdRuleSort} /></TableHead>
                          <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('wef_date', cdRuleSort, setCdRuleSort)}>W.E.F. Date <SortIcon col="wef_date" sort={cdRuleSort} /></TableHead>
                          <TableHead>Stock Category</TableHead>
                          <TableHead>Discount Rate</TableHead>
                          <TableHead>Payment Days</TableHead>
                          <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('status', cdRuleSort, setCdRuleSort)}>Status <SortIcon col="status" sort={cdRuleSort} /></TableHead>
                          <TableHead className="text-right pr-6">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isCdRuleLoading && cdRulesList.length === 0 ? (
                          [...Array(8)].map((_, i) => (
                            <TableRow key={i} className="opacity-40 border-b border-slate-50 h-16">
                              <TableCell className="pl-6"><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                              <TableCell><div className="h-4 w-24 bg-slate-200 animate-pulse rounded" /></TableCell>
                              <TableCell><div className="h-4 w-28 bg-slate-200 animate-pulse rounded" /></TableCell>
                              <TableCell><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                              <TableCell><div className="h-4 w-12 bg-slate-200 animate-pulse rounded" /></TableCell>
                              <TableCell><div className="h-6 w-20 bg-slate-200 animate-pulse rounded-full" /></TableCell>
                              <TableCell className="pr-6"><div className="h-8 w-16 bg-slate-100 animate-pulse rounded ml-auto" /></TableCell>
                            </TableRow>
                          ))
                        ) : cdRulesList.length === 0 ? (
                          <TableRow><TableCell colSpan={7} className="text-center py-20 text-slate-400">No CD rules found</TableCell></TableRow>
                        ) : (
                          <>
                            {sortedCdRules.map((item: any) => {
                              const categoryName = (stockCategoryData || []).find((c: any) => String(c.id) === String(item.stock_category_id))?.name
                              return (
                              <TableRow key={item.cd_rule_code} className="hover:bg-slate-50/30 transition-colors border-b border-slate-50 h-16">
                                <TableCell className="font-medium pl-6">{item.cd_rule_code}</TableCell>
                                <TableCell>{item.wef_date ? new Date(item.wef_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "—"}</TableCell>
                                <TableCell className="font-semibold text-slate-900">{categoryName || "—"}</TableCell>
                                <TableCell>{item.discount_rate_per_main_uom != null ? `₹${item.discount_rate_per_main_uom}` : "—"}</TableCell>
                                <TableCell>{item.payment_condition_days != null ? `${item.payment_condition_days} days` : "—"}</TableCell>
                                <TableCell>
                                  <Badge variant={item.status === 'Active' ? 'default' : 'secondary'} className={item.status === 'Active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none' : ''}>
                                    {item.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right pr-6">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={!canEditActiveTab} title={!canEditActiveTab ? "View Only" : "Edit CD Rule"}>
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50" disabled={!canEditExisting} title={!canEditExisting ? "Admin Only" : "Delete CD Rule"}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )})}
                            <TableRow ref={cdRuleEndRef}>
                              <TableCell colSpan={7} className="p-0 h-12 border-none">
                                {isFetchingNextCdRule && <div className="flex items-center justify-center py-4 text-slate-400 text-xs">Loading more CD rules...</div>}
                              </TableCell>
                            </TableRow>
                          </>
                        )}
                      </TableBody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {visibleTabs.includes("tds_rules") && (
        <TabsContent value="tds_rules">
          <Card className="shadow-xl border-none rounded-2xl bg-white">
            <CardHeader className="bg-slate-50/50 border-b p-6">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Landmark className="h-5 w-5 text-primary" />
                    TDS Rules
                  </CardTitle>
                  <CardDescription className="mt-1">Placeholder master — pending client scoping (Section 21 has no specified fields/rules)</CardDescription>
                </div>
              </div>
              {isAdminOrSuper && (
                <div className="flex gap-2 mt-4">
                  <button onClick={() => setTdsRuleSubTab('active')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tdsRuleSubTab === 'active' ? 'bg-primary text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Active Records</button>
                  <button onClick={() => setTdsRuleSubTab('pending')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${tdsRuleSubTab === 'pending' ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    Pending Approval {pendingTdsRules.length > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${tdsRuleSubTab === 'pending' ? 'bg-white text-amber-600' : 'bg-amber-500 text-white'}`}>{pendingTdsRules.length}</span>}
                  </button>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {tdsRuleSubTab === 'pending' ? (
                <div className="flex flex-col h-[600px]"><div className="flex-1 overflow-auto rounded-b-2xl">
                  {pendingTdsRules.length === 0 ? <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400"><CheckCircle2 className="h-10 w-10 text-emerald-300" /><p className="text-sm font-medium">No pending approvals</p></div> : (
                    <table className="w-full caption-bottom text-sm">
                      <TableHeader className="sticky top-0 z-20 bg-amber-50 shadow-sm">
                        <TableRow className="hover:bg-transparent border-b">
                          <TableHead className="pl-6">Code</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Submitted By</TableHead>
                          <TableHead>Submitted On</TableHead>
                          <TableHead className="text-right pr-6">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingTdsRules.map(item => {
                          const isEdit = item.request_type === 'edit'
                          const submittedBy = isEdit ? (item.pending_edit_by_name || item.created_by_name) : item.created_by_name
                          const submittedOn = isEdit ? item.pending_edit_at : item.created_at
                          return (
                          <TableRow key={item.tds_rule_code} className="hover:bg-amber-50/30 border-b border-slate-50 h-16">
                            <TableCell className="font-medium pl-6 text-slate-500">{item.tds_rule_code}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={isEdit ? "border-blue-300 text-blue-700 bg-blue-50" : "border-emerald-300 text-emerald-700 bg-emerald-50"}>
                                {isEdit ? "Edit" : "New"}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-semibold text-slate-900">{item.name}</TableCell>
                            <TableCell>{submittedBy || "—"}</TableCell>
                            <TableCell className="text-slate-500 text-xs">{submittedOn ? new Date(submittedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "—"}</TableCell>
                            <TableCell className="text-right pr-6">
                              <div className="flex justify-end gap-2">
                                <Button size="sm" onClick={() => openApprovalModal('tds_rules', item)} disabled={isReviewing} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white px-3 rounded-lg">
                                  <Check className="h-3.5 w-3.5 mr-1" /> Approve
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setRejectDialogContext({ tab: 'tds_rules', id: item.id })} disabled={isReviewing} className="h-8 border-red-200 text-red-600 hover:bg-red-50 px-3 rounded-lg">
                                  <X className="h-3.5 w-3.5 mr-1" /> Reject
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )})}
                      </TableBody>
                    </table>
                  )}
                </div></div>
              ) : (
                <div className="flex flex-col h-[600px]">
                  <div className="flex-1 overflow-auto rounded-b-2xl">
                    <table className="w-full caption-bottom text-sm">
                      <TableHeader className="sticky top-0 z-20 bg-slate-50 shadow-sm">
                        <TableRow className="hover:bg-transparent border-b">
                          <TableHead className="pl-6 cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('tds_rule_code', tdsRuleSort, setTdsRuleSort)}>Code <SortIcon col="tds_rule_code" sort={tdsRuleSort} /></TableHead>
                          <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('name', tdsRuleSort, setTdsRuleSort)}>Nature of Transaction <SortIcon col="name" sort={tdsRuleSort} /></TableHead>
                          <TableHead>Rate</TableHead>
                          <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('status', tdsRuleSort, setTdsRuleSort)}>Status <SortIcon col="status" sort={tdsRuleSort} /></TableHead>
                          <TableHead className="text-right pr-6">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isTdsRuleLoading && tdsRulesList.length === 0 ? (
                          [...Array(8)].map((_, i) => (
                            <TableRow key={i} className="opacity-40 border-b border-slate-50 h-16">
                              <TableCell className="pl-6"><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                              <TableCell><div className="h-4 w-32 bg-slate-200 animate-pulse rounded" /></TableCell>
                              <TableCell><div className="h-4 w-12 bg-slate-200 animate-pulse rounded" /></TableCell>
                              <TableCell><div className="h-6 w-20 bg-slate-200 animate-pulse rounded-full" /></TableCell>
                              <TableCell className="pr-6"><div className="h-8 w-16 bg-slate-100 animate-pulse rounded ml-auto" /></TableCell>
                            </TableRow>
                          ))
                        ) : tdsRulesList.length === 0 ? (
                          <TableRow><TableCell colSpan={5} className="text-center py-20 text-slate-400">No TDS rules found</TableCell></TableRow>
                        ) : (
                          <>
                            {sortedTdsRules.map((item: any) => (
                              <TableRow key={item.tds_rule_code} className="hover:bg-slate-50/30 transition-colors border-b border-slate-50 h-16">
                                <TableCell className="font-medium pl-6">{item.tds_rule_code}</TableCell>
                                <TableCell className="font-semibold text-slate-900">{item.name}</TableCell>
                                <TableCell>{item.rate != null && item.rate !== '' ? `${item.rate}%` : "—"}</TableCell>
                                <TableCell>
                                  <Badge variant={item.status === 'Active' ? 'default' : 'secondary'} className={item.status === 'Active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none' : ''}>
                                    {item.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right pr-6">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={!canEditActiveTab} title={!canEditActiveTab ? "View Only" : "Edit TDS Rule"}>
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50" disabled={!canEditExisting} title={!canEditExisting ? "Admin Only" : "Delete TDS Rule"}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow ref={tdsRuleEndRef}>
                              <TableCell colSpan={5} className="p-0 h-12 border-none">
                                {isFetchingNextTdsRule && <div className="flex items-center justify-center py-4 text-slate-400 text-xs">Loading more TDS rules...</div>}
                              </TableCell>
                            </TableRow>
                          </>
                        )}
                      </TableBody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        
        {visibleTabs.includes("oil_tags") && (
        <TabsContent value="oil_tags">
          <Card className="shadow-xl border-none rounded-2xl bg-white">
            <CardHeader className="bg-slate-50/50 border-b p-6">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Droplet className="h-6 w-6 text-primary" />
                    Oil Tags
                  </CardTitle>
                  <CardDescription className="text-slate-500 mt-1 text-base">Manage dynamic oil types and tags</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="flex flex-col h-[600px]"><div className="flex-1 overflow-auto rounded-b-2xl">
                <table className="w-full caption-bottom text-sm">
                  <TableHeader className="sticky top-0 z-20 bg-slate-50 shadow-sm">
                    <TableRow className="hover:bg-transparent border-b">
                      <TableHead className="pl-6 cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('name', oilTagSort, setOilTagSort)}>Tag Name <SortIcon col="name" sort={oilTagSort} /></TableHead>
                      <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('status', oilTagSort, setOilTagSort)}>Status <SortIcon col="status" sort={oilTagSort} /></TableHead>
                      <TableHead className="text-right pr-6">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isOilTagsLoading && oilTagsList.length === 0 ? (
                      [...Array(5)].map((_, i) => (
                        <TableRow key={i} className="opacity-40 border-b border-slate-50 h-16">
                          <TableCell className="pl-6"><div className="h-4 w-32 bg-slate-200 animate-pulse rounded" /></TableCell>
                          <TableCell><div className="h-6 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                          <TableCell><div className="h-8 w-16 bg-slate-100 animate-pulse rounded ml-auto" /></TableCell>
                        </TableRow>
                      ))
                    ) : oilTagsList.length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="text-center py-20 text-slate-400">No oil tags found</TableCell></TableRow>
                    ) : (
                      sortedOilTags.map((item: any) => (
                        <TableRow key={item.id} className="hover:bg-slate-50/30 transition-colors border-b border-slate-50 h-16">
                          <TableCell className="font-semibold text-slate-900 pl-6">{item.name}</TableCell>
                          <TableCell>
                            <Badge variant={item.status === 'Active' ? 'default' : 'secondary'} className={item.status === 'Active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none' : ''}>
                              {item.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={!canEditActiveTab} title={!canEditActiveTab ? "View Only" : "Edit Tag"}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50" disabled={!canEditExisting} title={!canEditExisting ? "Admin Only" : "Delete Tag"}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </table>
              </div></div>
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {visibleTabs.includes("bhada_rates") && (
        <TabsContent value="bhada_rates">
          <Card className="shadow-xl border-none rounded-2xl bg-white">
            <CardHeader className="bg-slate-50/50 border-b p-6">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Route className="h-5 w-5 text-primary" />
                    Bhada Rates
                  </CardTitle>
                  <CardDescription className="mt-1">Placeholder master — pending client scoping (Section 22 has no specified fields/rules)</CardDescription>
                </div>
              </div>
              {isAdminOrSuper && (
                <div className="flex gap-2 mt-4">
                  <button onClick={() => setBhadaRateSubTab('active')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${bhadaRateSubTab === 'active' ? 'bg-primary text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Active Records</button>
                  <button onClick={() => setBhadaRateSubTab('pending')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${bhadaRateSubTab === 'pending' ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    Pending Approval {pendingBhadaRates.length > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${bhadaRateSubTab === 'pending' ? 'bg-white text-amber-600' : 'bg-amber-500 text-white'}`}>{pendingBhadaRates.length}</span>}
                  </button>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {bhadaRateSubTab === 'pending' ? (
                <div className="flex flex-col h-[600px]"><div className="flex-1 overflow-auto rounded-b-2xl">
                  {pendingBhadaRates.length === 0 ? <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400"><CheckCircle2 className="h-10 w-10 text-emerald-300" /><p className="text-sm font-medium">No pending approvals</p></div> : (
                    <table className="w-full caption-bottom text-sm">
                      <TableHeader className="sticky top-0 z-20 bg-amber-50 shadow-sm">
                        <TableRow className="hover:bg-transparent border-b">
                          <TableHead className="pl-6">Code</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Submitted By</TableHead>
                          <TableHead>Submitted On</TableHead>
                          <TableHead className="text-right pr-6">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingBhadaRates.map(item => {
                          const isEdit = item.request_type === 'edit'
                          const submittedBy = isEdit ? (item.pending_edit_by_name || item.created_by_name) : item.created_by_name
                          const submittedOn = isEdit ? item.pending_edit_at : item.created_at
                          return (
                          <TableRow key={item.bhada_rate_code} className="hover:bg-amber-50/30 border-b border-slate-50 h-16">
                            <TableCell className="font-medium pl-6 text-slate-500">{item.bhada_rate_code}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={isEdit ? "border-blue-300 text-blue-700 bg-blue-50" : "border-emerald-300 text-emerald-700 bg-emerald-50"}>
                                {isEdit ? "Edit" : "New"}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-semibold text-slate-900">{item.name}</TableCell>
                            <TableCell>{submittedBy || "—"}</TableCell>
                            <TableCell className="text-slate-500 text-xs">{submittedOn ? new Date(submittedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "—"}</TableCell>
                            <TableCell className="text-right pr-6">
                              <div className="flex justify-end gap-2">
                                <Button size="sm" onClick={() => openApprovalModal('bhada_rates', item)} disabled={isReviewing} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white px-3 rounded-lg">
                                  <Check className="h-3.5 w-3.5 mr-1" /> Approve
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setRejectDialogContext({ tab: 'bhada_rates', id: item.id })} disabled={isReviewing} className="h-8 border-red-200 text-red-600 hover:bg-red-50 px-3 rounded-lg">
                                  <X className="h-3.5 w-3.5 mr-1" /> Reject
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )})}
                      </TableBody>
                    </table>
                  )}
                </div></div>
              ) : (
                <div className="flex flex-col h-[600px]">
                  <div className="flex-1 overflow-auto rounded-b-2xl">
                    <table className="w-full caption-bottom text-sm">
                      <TableHeader className="sticky top-0 z-20 bg-slate-50 shadow-sm">
                        <TableRow className="hover:bg-transparent border-b">
                          <TableHead className="pl-6 cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('bhada_rate_code', bhadaRateSort, setBhadaRateSort)}>Code <SortIcon col="bhada_rate_code" sort={bhadaRateSort} /></TableHead>
                          <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('name', bhadaRateSort, setBhadaRateSort)}>Name <SortIcon col="name" sort={bhadaRateSort} /></TableHead>
                          <TableHead>Rate</TableHead>
                          <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('status', bhadaRateSort, setBhadaRateSort)}>Status <SortIcon col="status" sort={bhadaRateSort} /></TableHead>
                          <TableHead className="text-right pr-6">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isBhadaRateLoading && bhadaRatesList.length === 0 ? (
                          [...Array(8)].map((_, i) => (
                            <TableRow key={i} className="opacity-40 border-b border-slate-50 h-16">
                              <TableCell className="pl-6"><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                              <TableCell><div className="h-4 w-32 bg-slate-200 animate-pulse rounded" /></TableCell>
                              <TableCell><div className="h-4 w-12 bg-slate-200 animate-pulse rounded" /></TableCell>
                              <TableCell><div className="h-6 w-20 bg-slate-200 animate-pulse rounded-full" /></TableCell>
                              <TableCell className="pr-6"><div className="h-8 w-16 bg-slate-100 animate-pulse rounded ml-auto" /></TableCell>
                            </TableRow>
                          ))
                        ) : bhadaRatesList.length === 0 ? (
                          <TableRow><TableCell colSpan={5} className="text-center py-20 text-slate-400">No Bhada rates found</TableCell></TableRow>
                        ) : (
                          <>
                            {sortedBhadaRates.map((item: any) => (
                              <TableRow key={item.bhada_rate_code} className="hover:bg-slate-50/30 transition-colors border-b border-slate-50 h-16">
                                <TableCell className="font-medium pl-6">{item.bhada_rate_code}</TableCell>
                                <TableCell className="font-semibold text-slate-900">{item.name}</TableCell>
                                <TableCell>{item.rate != null && item.rate !== '' ? item.rate : "—"}</TableCell>
                                <TableCell>
                                  <Badge variant={item.status === 'Active' ? 'default' : 'secondary'} className={item.status === 'Active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none' : ''}>
                                    {item.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right pr-6">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={!canEditActiveTab} title={!canEditActiveTab ? "View Only" : "Edit Bhada Rate"}>
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50" disabled={!canEditExisting} title={!canEditExisting ? "Admin Only" : "Delete Bhada Rate"}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow ref={bhadaRateEndRef}>
                              <TableCell colSpan={5} className="p-0 h-12 border-none">
                                {isFetchingNextBhadaRate && <div className="flex items-center justify-center py-4 text-slate-400 text-xs">Loading more Bhada rates...</div>}
                              </TableCell>
                            </TableRow>
                          </>
                        )}
                      </TableBody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {visibleTabs.includes("insurance_details") && (
        <TabsContent value="insurance_details">
          <Card className="shadow-xl border-none rounded-2xl bg-white">
            <CardHeader className="bg-slate-50/50 border-b p-6">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Insurance Details List
                  </CardTitle>
                  <CardDescription className="mt-1">Manage your insurance policies</CardDescription>
                </div>
              </div>
              {isAdminOrSuper && (
                <div className="flex gap-2 mt-4">
                  <button onClick={() => setInsuranceDetailSubTab('active')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${insuranceDetailSubTab === 'active' ? 'bg-primary text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Active Records</button>
                  <button onClick={() => setInsuranceDetailSubTab('pending')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${insuranceDetailSubTab === 'pending' ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    Pending Approval {pendingInsuranceDetails.length > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${insuranceDetailSubTab === 'pending' ? 'bg-white text-amber-600' : 'bg-amber-500 text-white'}`}>{pendingInsuranceDetails.length}</span>}
                  </button>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {insuranceDetailSubTab === 'pending' ? (
                <div className="flex flex-col h-[600px]"><div className="flex-1 overflow-auto rounded-b-2xl">
                  {pendingInsuranceDetails.length === 0 ? <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400"><CheckCircle2 className="h-10 w-10 text-emerald-300" /><p className="text-sm font-medium">No pending approvals</p></div> : (
                    <table className="w-full caption-bottom text-sm">
                      <TableHeader className="sticky top-0 z-20 bg-amber-50 shadow-sm">
                        <TableRow className="hover:bg-transparent border-b">
                          <TableHead className="pl-6">Code</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Company</TableHead>
                          <TableHead>Submitted By</TableHead>
                          <TableHead>Submitted On</TableHead>
                          <TableHead className="text-right pr-6">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingInsuranceDetails.map(item => {
                          const isEdit = item.request_type === 'edit'
                          const submittedBy = isEdit ? (item.pending_edit_by_name || item.created_by_name) : item.created_by_name
                          const submittedOn = isEdit ? item.pending_edit_at : item.created_at
                          return (
                          <TableRow key={item.insurance_code} className="hover:bg-amber-50/30 border-b border-slate-50 h-16">
                            <TableCell className="font-medium pl-6 text-slate-500">{item.insurance_code}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={isEdit ? "border-blue-300 text-blue-700 bg-blue-50" : "border-emerald-300 text-emerald-700 bg-emerald-50"}>
                                {isEdit ? "Edit" : "New"}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-semibold text-slate-900">{item.insurance_company_name}</TableCell>
                            <TableCell>{submittedBy || "—"}</TableCell>
                            <TableCell className="text-slate-500 text-xs">{submittedOn ? new Date(submittedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "—"}</TableCell>
                            <TableCell className="text-right pr-6">
                              <div className="flex justify-end gap-2">
                                <Button size="sm" onClick={() => openApprovalModal('insurance_details', item)} disabled={isReviewing} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white px-3 rounded-lg">
                                  <Check className="h-3.5 w-3.5 mr-1" /> Approve
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setRejectDialogContext({ tab: 'insurance_details', id: item.id })} disabled={isReviewing} className="h-8 border-red-200 text-red-600 hover:bg-red-50 px-3 rounded-lg">
                                  <X className="h-3.5 w-3.5 mr-1" /> Reject
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )})}
                      </TableBody>
                    </table>
                  )}
                </div></div>
              ) : (
                <div className="flex flex-col h-[600px]">
                  <div className="flex-1 overflow-auto rounded-b-2xl">
                    <table className="w-full caption-bottom text-sm">
                      <TableHeader className="sticky top-0 z-20 bg-slate-50 shadow-sm">
                        <TableRow className="hover:bg-transparent border-b">
                          <TableHead className="pl-6 cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('insurance_code', insuranceDetailSort, setInsuranceDetailSort)}>Code <SortIcon col="insurance_code" sort={insuranceDetailSort} /></TableHead>
                          <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('insurance_company_name', insuranceDetailSort, setInsuranceDetailSort)}>Company <SortIcon col="insurance_company_name" sort={insuranceDetailSort} /></TableHead>
                          <TableHead>Policy No.</TableHead>
                          <TableHead>Valid Upto</TableHead>
                          <TableHead>Sum Insured</TableHead>
                          <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('status', insuranceDetailSort, setInsuranceDetailSort)}>Status <SortIcon col="status" sort={insuranceDetailSort} /></TableHead>
                          <TableHead className="text-right pr-6">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isInsuranceDetailLoading && insuranceDetailsList.length === 0 ? (
                          [...Array(8)].map((_, i) => (
                            <TableRow key={i} className="opacity-40 border-b border-slate-50 h-16">
                              <TableCell className="pl-6"><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                              <TableCell><div className="h-4 w-32 bg-slate-200 animate-pulse rounded" /></TableCell>
                              <TableCell><div className="h-4 w-20 bg-slate-200 animate-pulse rounded" /></TableCell>
                              <TableCell><div className="h-4 w-20 bg-slate-200 animate-pulse rounded" /></TableCell>
                              <TableCell><div className="h-4 w-20 bg-slate-200 animate-pulse rounded" /></TableCell>
                              <TableCell><div className="h-6 w-20 bg-slate-200 animate-pulse rounded-full" /></TableCell>
                              <TableCell className="pr-6"><div className="h-8 w-16 bg-slate-100 animate-pulse rounded ml-auto" /></TableCell>
                            </TableRow>
                          ))
                        ) : insuranceDetailsList.length === 0 ? (
                          <TableRow><TableCell colSpan={7} className="text-center py-20 text-slate-400">No insurance details found</TableCell></TableRow>
                        ) : (
                          <>
                            {sortedInsuranceDetails.map((item: any) => (
                              <TableRow key={item.insurance_code} className="hover:bg-slate-50/30 transition-colors border-b border-slate-50 h-16">
                                <TableCell className="font-medium pl-6">{item.insurance_code}</TableCell>
                                <TableCell className="font-semibold text-slate-900">{item.insurance_company_name}</TableCell>
                                <TableCell>{item.policy_number || "—"}</TableCell>
                                <TableCell>{formatDocDate(item.valid_upto)}</TableCell>
                                <TableCell>{item.sum_insured ? `₹${item.sum_insured}` : "—"}</TableCell>
                                <TableCell>
                                  <Badge variant={item.status === 'Active' ? 'default' : 'secondary'} className={item.status === 'Active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none' : ''}>
                                    {item.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right pr-6">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={!canEditActiveTab} title={!canEditActiveTab ? "View Only" : "Edit Insurance Detail"}>
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50" disabled={!canEditExisting} title={!canEditExisting ? "Admin Only" : "Delete Insurance Detail"}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow ref={insuranceDetailEndRef}>
                              <TableCell colSpan={7} className="p-0 h-12 border-none">
                                {isFetchingNextInsuranceDetail && <div className="flex items-center justify-center py-4 text-slate-400 text-xs">Loading more insurance details...</div>}
                              </TableCell>
                            </TableRow>
                          </>
                        )}
                      </TableBody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {visibleTabs.includes("conversion_formulas") && (
        <TabsContent value="conversion_formulas">
          <Card className="shadow-xl border-none rounded-2xl bg-white">
            <CardHeader className="bg-slate-50/50 border-b p-6">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-primary" />
                    Conversion Formulas List
                  </CardTitle>
                  <CardDescription className="mt-1">Define price conversion formulas between Finished Goods</CardDescription>
                </div>
              </div>
              {isAdminOrSuper && (
                <div className="flex gap-2 mt-4">
                  <button onClick={() => setConversionFormulaSubTab('active')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${conversionFormulaSubTab === 'active' ? 'bg-primary text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Active Records</button>
                  <button onClick={() => setConversionFormulaSubTab('pending')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${conversionFormulaSubTab === 'pending' ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    Pending Approval {pendingConversionFormulas.length > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${conversionFormulaSubTab === 'pending' ? 'bg-white text-amber-600' : 'bg-amber-500 text-white'}`}>{pendingConversionFormulas.length}</span>}
                  </button>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {conversionFormulaSubTab === 'pending' ? (
                <div className="flex flex-col h-[600px]"><div className="flex-1 overflow-auto rounded-b-2xl">
                  {pendingConversionFormulas.length === 0 ? <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400"><CheckCircle2 className="h-10 w-10 text-emerald-300" /><p className="text-sm font-medium">No pending approvals</p></div> : (
                    <table className="w-full caption-bottom text-sm">
                      <TableHeader className="sticky top-0 z-20 bg-amber-50 shadow-sm">
                        <TableRow className="hover:bg-transparent border-b">
                          <TableHead className="pl-6">Code</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Base Item</TableHead>
                          <TableHead>Submitted By</TableHead>
                          <TableHead>Submitted On</TableHead>
                          <TableHead className="text-right pr-6">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingConversionFormulas.map(item => {
                          const isEdit = item.request_type === 'edit'
                          const submittedBy = isEdit ? (item.pending_edit_by_name || item.created_by_name) : item.created_by_name
                          const submittedOn = isEdit ? item.pending_edit_at : item.created_at
                          const baseItem = skuOptions.find((s: any) => s.id === item.base_item_id)
                          return (
                          <TableRow key={item.conversion_formula_code} className="hover:bg-amber-50/30 border-b border-slate-50 h-16">
                            <TableCell className="font-medium pl-6 text-slate-500">{item.conversion_formula_code}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={isEdit ? "border-blue-300 text-blue-700 bg-blue-50" : "border-emerald-300 text-emerald-700 bg-emerald-50"}>
                                {isEdit ? "Edit" : "New"}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-semibold text-slate-900">{baseItem?.sku_name || `#${item.base_item_id}`}</TableCell>
                            <TableCell>{submittedBy || "—"}</TableCell>
                            <TableCell className="text-slate-500 text-xs">{submittedOn ? new Date(submittedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "—"}</TableCell>
                            <TableCell className="text-right pr-6">
                              <div className="flex justify-end gap-2">
                                <Button size="sm" onClick={() => openApprovalModal('conversion_formulas', item)} disabled={isReviewing} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white px-3 rounded-lg">
                                  <Check className="h-3.5 w-3.5 mr-1" /> Approve
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setRejectDialogContext({ tab: 'conversion_formulas', id: item.id })} disabled={isReviewing} className="h-8 border-red-200 text-red-600 hover:bg-red-50 px-3 rounded-lg">
                                  <X className="h-3.5 w-3.5 mr-1" /> Reject
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )})}
                      </TableBody>
                    </table>
                  )}
                </div></div>
              ) : (
                <div className="flex flex-col h-[600px]">
                  <div className="flex-1 overflow-auto rounded-b-2xl">
                    <table className="w-full caption-bottom text-sm">
                      <TableHeader className="sticky top-0 z-20 bg-slate-50 shadow-sm">
                        <TableRow className="hover:bg-transparent border-b">
                          <TableHead className="pl-6 cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('conversion_formula_code', conversionFormulaSort, setConversionFormulaSort)}>Code <SortIcon col="conversion_formula_code" sort={conversionFormulaSort} /></TableHead>
                          <TableHead>Base Item</TableHead>
                          <TableHead>Child Item</TableHead>
                          <TableHead>Steps</TableHead>
                          <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('status', conversionFormulaSort, setConversionFormulaSort)}>Status <SortIcon col="status" sort={conversionFormulaSort} /></TableHead>
                          <TableHead className="text-right pr-6">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isConversionFormulaLoading && conversionFormulasList.length === 0 ? (
                          [...Array(8)].map((_, i) => (
                            <TableRow key={i} className="opacity-40 border-b border-slate-50 h-16">
                              <TableCell className="pl-6"><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                              <TableCell><div className="h-4 w-32 bg-slate-200 animate-pulse rounded" /></TableCell>
                              <TableCell><div className="h-4 w-32 bg-slate-200 animate-pulse rounded" /></TableCell>
                              <TableCell><div className="h-4 w-12 bg-slate-200 animate-pulse rounded" /></TableCell>
                              <TableCell><div className="h-6 w-20 bg-slate-200 animate-pulse rounded-full" /></TableCell>
                              <TableCell className="pr-6"><div className="h-8 w-16 bg-slate-100 animate-pulse rounded ml-auto" /></TableCell>
                            </TableRow>
                          ))
                        ) : conversionFormulasList.length === 0 ? (
                          <TableRow><TableCell colSpan={6} className="text-center py-20 text-slate-400">No conversion formulas found</TableCell></TableRow>
                        ) : (
                          <>
                            {sortedConversionFormulas.map((item: any) => {
                              const baseItem = skuOptions.find((s: any) => s.id === item.base_item_id)
                              const childItem = skuOptions.find((s: any) => s.id === item.child_item_id)
                              return (
                              <TableRow key={item.conversion_formula_code} className="hover:bg-slate-50/30 transition-colors border-b border-slate-50 h-16">
                                <TableCell className="font-medium pl-6">{item.conversion_formula_code}</TableCell>
                                <TableCell className="font-semibold text-slate-900">{baseItem?.sku_name || `#${item.base_item_id}`}</TableCell>
                                <TableCell>{childItem?.sku_name || `#${item.child_item_id}`}</TableCell>
                                <TableCell>{(item.steps || []).length}</TableCell>
                                <TableCell>
                                  <Badge variant={item.status === 'Active' ? 'default' : 'secondary'} className={item.status === 'Active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none' : ''}>
                                    {item.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right pr-6">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={!canEditActiveTab} title={!canEditActiveTab ? "View Only" : "Edit Conversion Formula"}>
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50" disabled={!canEditExisting} title={!canEditExisting ? "Admin Only" : "Delete Conversion Formula"}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )})}
                            <TableRow ref={conversionFormulaEndRef}>
                              <TableCell colSpan={6} className="p-0 h-12 border-none">
                                {isFetchingNextConversionFormula && <div className="flex items-center justify-center py-4 text-slate-400 text-xs">Loading more conversion formulas...</div>}
                              </TableCell>
                            </TableRow>
                          </>
                        )}
                      </TableBody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {visibleTabs.includes("price_levels") && (
        <TabsContent value="price_levels">
          <Card className="shadow-xl border-none rounded-2xl bg-white">
            <CardHeader className="bg-slate-50/50 border-b p-6">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Tag className="h-5 w-5 text-primary" />
                    Price Levels List
                  </CardTitle>
                  <CardDescription className="mt-1">Maintain dated Finished Goods price lists</CardDescription>
                </div>
              </div>
              {isAdminOrSuper && (
                <div className="flex gap-2 mt-4">
                  <button onClick={() => setPriceLevelSubTab('active')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${priceLevelSubTab === 'active' ? 'bg-primary text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Active Records</button>
                  <button onClick={() => setPriceLevelSubTab('pending')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${priceLevelSubTab === 'pending' ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    Pending Approval {pendingPriceLevels.length > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${priceLevelSubTab === 'pending' ? 'bg-white text-amber-600' : 'bg-amber-500 text-white'}`}>{pendingPriceLevels.length}</span>}
                  </button>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {priceLevelSubTab === 'pending' ? (
                <div className="flex flex-col h-[600px]"><div className="flex-1 overflow-auto rounded-b-2xl">
                  {pendingPriceLevels.length === 0 ? <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400"><CheckCircle2 className="h-10 w-10 text-emerald-300" /><p className="text-sm font-medium">No pending approvals</p></div> : (
                    <table className="w-full caption-bottom text-sm">
                      <TableHeader className="sticky top-0 z-20 bg-amber-50 shadow-sm">
                        <TableRow className="hover:bg-transparent border-b">
                          <TableHead className="pl-6">Code</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Effective Date</TableHead>
                          <TableHead>Submitted By</TableHead>
                          <TableHead>Submitted On</TableHead>
                          <TableHead className="text-right pr-6">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingPriceLevels.map(item => {
                          const isEdit = item.request_type === 'edit'
                          const submittedBy = isEdit ? (item.pending_edit_by_name || item.created_by_name) : item.created_by_name
                          const submittedOn = isEdit ? item.pending_edit_at : item.created_at
                          return (
                          <TableRow key={item.price_level_code} className="hover:bg-amber-50/30 border-b border-slate-50 h-16">
                            <TableCell className="font-medium pl-6 text-slate-500">{item.price_level_code}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={isEdit ? "border-blue-300 text-blue-700 bg-blue-50" : "border-emerald-300 text-emerald-700 bg-emerald-50"}>
                                {isEdit ? "Edit" : "New"}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-semibold text-slate-900">{formatDocDate(item.effective_date)}</TableCell>
                            <TableCell>{submittedBy || "—"}</TableCell>
                            <TableCell className="text-slate-500 text-xs">{submittedOn ? new Date(submittedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "—"}</TableCell>
                            <TableCell className="text-right pr-6">
                              <div className="flex justify-end gap-2">
                                <Button size="sm" onClick={() => openApprovalModal('price_levels', item)} disabled={isReviewing} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white px-3 rounded-lg">
                                  <Check className="h-3.5 w-3.5 mr-1" /> Approve
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setRejectDialogContext({ tab: 'price_levels', id: item.id })} disabled={isReviewing} className="h-8 border-red-200 text-red-600 hover:bg-red-50 px-3 rounded-lg">
                                  <X className="h-3.5 w-3.5 mr-1" /> Reject
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )})}
                      </TableBody>
                    </table>
                  )}
                </div></div>
              ) : (
                <div className="flex flex-col h-[600px]">
                  <div className="flex-1 overflow-auto rounded-b-2xl">
                    <table className="w-full caption-bottom text-sm">
                      <TableHeader className="sticky top-0 z-20 bg-slate-50 shadow-sm">
                        <TableRow className="hover:bg-transparent border-b">
                          <TableHead className="pl-6 cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('price_level_code', priceLevelSort, setPriceLevelSort)}>Code <SortIcon col="price_level_code" sort={priceLevelSort} /></TableHead>
                          <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('effective_date', priceLevelSort, setPriceLevelSort)}>Effective Date <SortIcon col="effective_date" sort={priceLevelSort} /></TableHead>
                          <TableHead>Items Priced</TableHead>
                          <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('status', priceLevelSort, setPriceLevelSort)}>Status <SortIcon col="status" sort={priceLevelSort} /></TableHead>
                          <TableHead className="text-right pr-6">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isPriceLevelLoading && priceLevelsList.length === 0 ? (
                          [...Array(8)].map((_, i) => (
                            <TableRow key={i} className="opacity-40 border-b border-slate-50 h-16">
                              <TableCell className="pl-6"><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                              <TableCell><div className="h-4 w-24 bg-slate-200 animate-pulse rounded" /></TableCell>
                              <TableCell><div className="h-4 w-12 bg-slate-200 animate-pulse rounded" /></TableCell>
                              <TableCell><div className="h-6 w-20 bg-slate-200 animate-pulse rounded-full" /></TableCell>
                              <TableCell className="pr-6"><div className="h-8 w-16 bg-slate-100 animate-pulse rounded ml-auto" /></TableCell>
                            </TableRow>
                          ))
                        ) : priceLevelsList.length === 0 ? (
                          <TableRow><TableCell colSpan={5} className="text-center py-20 text-slate-400">No price levels found</TableCell></TableRow>
                        ) : (
                          <>
                            {sortedPriceLevels.map((item: any) => (
                              <TableRow key={item.price_level_code} className="hover:bg-slate-50/30 transition-colors border-b border-slate-50 h-16">
                                <TableCell className="font-medium pl-6">{item.price_level_code}</TableCell>
                                <TableCell className="font-semibold text-slate-900">{formatDocDate(item.effective_date)}</TableCell>
                                <TableCell>{(item.items || []).length}</TableCell>
                                <TableCell>
                                  <Badge variant={item.status === 'Active' ? 'default' : 'secondary'} className={item.status === 'Active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none' : ''}>
                                    {item.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right pr-6">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={!canEditActiveTab} title={!canEditActiveTab ? "View Only" : "Edit Price Level"}>
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50" disabled={!canEditExisting} title={!canEditExisting ? "Admin Only" : "Delete Price Level"}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow ref={priceLevelEndRef}>
                              <TableCell colSpan={5} className="p-0 h-12 border-none">
                                {isFetchingNextPriceLevel && <div className="flex items-center justify-center py-4 text-slate-400 text-xs">Loading more price levels...</div>}
                              </TableCell>
                            </TableRow>
                          </>
                        )}
                      </TableBody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {visibleTabs.includes("sku_details") && (
        <TabsContent value="sku_details">
          <Card className="shadow-xl border-none rounded-2xl bg-white">
            <CardHeader className="bg-slate-50/50 border-b p-6">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    Finished Goods List
                  </CardTitle>
                  <CardDescription className="mt-1">Manage your Finished Goods database</CardDescription>
                </div>
              </div>
              {isAdminOrSuper && (
                <div className="flex gap-2 mt-4">
                  <button onClick={() => setSkuSubTab('active')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${skuSubTab === 'active' ? 'bg-primary text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Active Records</button>
                  <button onClick={() => setSkuSubTab('pending')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${skuSubTab === 'pending' ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    Pending Approval {pendingSkus.length > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${skuSubTab === 'pending' ? 'bg-white text-amber-600' : 'bg-amber-500 text-white'}`}>{pendingSkus.length}</span>}
                  </button>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {skuSubTab === 'pending' ? (
                <div className="flex flex-col h-[600px]"><div className="flex-1 overflow-auto rounded-b-2xl">
                  {pendingSkus.length === 0 ? <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400"><CheckCircle2 className="h-10 w-10 text-emerald-300" /><p className="text-sm font-medium">No pending approvals</p></div> : (
                    <>
                      {/* Mobile card view */}
                      <div className="md:hidden p-3 space-y-3">
                        {pendingSkus.map(item => {
                          const isEdit = item.request_type === 'edit'
                          const submittedBy = isEdit ? (item.pending_edit_by_name || item.created_by_name) : item.created_by_name
                          const submittedOn = isEdit ? item.pending_edit_at : item.created_at
                          return (
                            <div key={item.id} className="border border-slate-100 rounded-xl p-4 bg-white shadow-sm space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-800 truncate">{item.sku_name}</p>
                                  <p className="text-xs text-slate-500">{item.sku_code}</p>
                                </div>
                                <Badge variant="outline" className={isEdit ? "border-blue-300 text-blue-700 bg-blue-50 shrink-0" : "border-emerald-300 text-emerald-700 bg-emerald-50 shrink-0"}>
                                  {isEdit ? "Edit" : "New"}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
                                <div className="col-span-2"><span className="font-medium text-slate-600">Main UOM: </span>{item.main_uom || "—"}</div>
                                <div className="col-span-2"><span className="font-medium text-slate-600">Submitted By: </span>{submittedBy || "—"}</div>
                                <div className="col-span-2"><span className="font-medium text-slate-600">Submitted On: </span>{submittedOn ? new Date(submittedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "—"}</div>
                              </div>
                              <div className="pt-2 border-t border-slate-50 flex gap-2 w-full justify-end">
                                <Button size="sm" onClick={() => openApprovalModal('sku_details', item)} disabled={isReviewing} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white px-3 rounded-lg text-xs flex-1"><Check className="h-3.5 w-3.5 mr-1" />Approve</Button>
                                <Button size="sm" variant="outline" onClick={() => setRejectDialogContext({ tab: 'sku_details', id: item.id })} disabled={isReviewing} className="h-8 border-red-200 text-red-600 hover:bg-red-50 px-3 rounded-lg text-xs flex-1"><X className="h-3.5 w-3.5 mr-1" />Reject</Button>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Desktop Table View */}
                      <table className="hidden md:table w-full caption-bottom text-sm">
                        <TableHeader className="sticky top-0 z-20 bg-amber-50 shadow-sm">
                          <TableRow className="hover:bg-transparent border-b">
                            <TableHead className="pl-6">FG Code</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Finished Goods Name</TableHead>
                            <TableHead>Main UOM</TableHead>
                            <TableHead>Submitted By</TableHead>
                            <TableHead>Submitted On</TableHead>
                            <TableHead className="text-right pr-6">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pendingSkus.map(item => {
                            const isEdit = item.request_type === 'edit'
                            const submittedBy = isEdit ? (item.pending_edit_by_name || item.created_by_name) : item.created_by_name
                            const submittedOn = isEdit ? item.pending_edit_at : item.created_at
                            return (
                            <TableRow key={item.id} className="hover:bg-amber-50/30 border-b border-slate-50 h-16">
                              <TableCell className="font-medium pl-6 text-slate-500">{item.sku_code}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={isEdit ? "border-blue-300 text-blue-700 bg-blue-50" : "border-emerald-300 text-emerald-700 bg-emerald-50"}>
                                  {isEdit ? "Edit" : "New"}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-semibold text-slate-900">{item.sku_name}</TableCell>
                              <TableCell>{item.main_uom || "—"}</TableCell>
                              <TableCell>{submittedBy || "—"}</TableCell>
                              <TableCell className="text-slate-500 text-xs">{submittedOn ? new Date(submittedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "—"}</TableCell>
                              <TableCell className="text-right pr-6">
                                <div className="flex justify-end gap-2">
                                  <Button size="sm" onClick={() => openApprovalModal('sku_details', item)} disabled={isReviewing} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white px-3 rounded-lg">
                                    <Check className="h-3.5 w-3.5 mr-1" /> Approve
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => setRejectDialogContext({ tab: 'sku_details', id: item.id })} disabled={isReviewing} className="h-8 border-red-200 text-red-600 hover:bg-red-50 px-3 rounded-lg">
                                    <X className="h-3.5 w-3.5 mr-1" /> Reject
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )})}
                        </TableBody>
                      </table>
                    </>
                  )}
                </div></div>
              ) : (
              <>
              {/* Mobile card view */}
              <div className="md:hidden">
                {isSkuLoading && skuDetails.length === 0 ? (
                  <div className="p-4 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="border border-slate-100 rounded-xl p-4 space-y-2 animate-pulse"><div className="h-4 w-32 bg-slate-200 rounded" /><div className="h-3 w-48 bg-slate-200 rounded" /></div>)}</div>
                ) : skuDetails.length === 0 ? (
                  <div className="text-center py-16 text-slate-400">No Finished Goods found</div>
                ) : (
                  <div className="p-3 space-y-3 overflow-auto" style={{ maxHeight: 600 }}>
                    {sortedSkuDetails.map(item => (
                      <div key={item.id} className="border border-slate-100 rounded-xl p-4 bg-white shadow-sm space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 truncate">{item.sku_name}</p>
                            <p className="text-xs text-slate-500">{item.sku_code}</p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={!canEditActiveTab} title={!canEditActiveTab ? "View Only" : "Edit"}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50" disabled={!canEditExisting} title={!canEditExisting ? "Admin Only" : "Delete"}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
                          <div><span className="font-medium text-slate-600">Main UOM: </span>{item.main_uom}</div>
                          <div><span className="font-medium text-slate-600">Alt. UOM: </span>{item.alternate_uom}</div>
                          <div><span className="font-medium text-slate-600">Pack Wt: </span>{item.packing_weight}</div>
                          <div><span className="font-medium text-slate-600">Gross Wt: </span>{item.gross_weight}</div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={item.status === 'Active' ? 'default' : 'secondary'} className={item.status === 'Active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none' : ''}>{item.status}</Badge>
                          {item.has_pending_edit && <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">Edit pending approval</Badge>}
                        </div>
                      </div>
                    ))}
                    {isFetchingNextSku && <div className="flex items-center justify-center py-4 gap-2 text-slate-400 text-xs"><div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.3s]" /><div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.15s]" /><div className="h-1.5 w-1.5 bg-primary animate-bounce" /><span className="ml-2">Loading more Finished Goods...</span></div>}
                  </div>
                )}
              </div>
              {/* Desktop table */}
              <div className="hidden md:flex flex-col h-[600px]">
                <div className="flex-1 overflow-auto rounded-b-2xl">
                  <table className="w-full caption-bottom text-sm">
                    <TableHeader className="sticky top-0 z-20 bg-slate-50 shadow-sm">
                      <TableRow className="hover:bg-transparent border-b">
                        <TableHead className="pl-6 cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('sku_code', skuSort, setSkuSort)}>ID <SortIcon col="sku_code" sort={skuSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('sku_name', skuSort, setSkuSort)}>Finished Goods Name <SortIcon col="sku_name" sort={skuSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('main_uom', skuSort, setSkuSort)}>Main UOM <SortIcon col="main_uom" sort={skuSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('alternate_uom', skuSort, setSkuSort)}>Alt. UOM <SortIcon col="alternate_uom" sort={skuSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('packing_weight', skuSort, setSkuSort)}>Packing Wt <SortIcon col="packing_weight" sort={skuSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('gross_weight', skuSort, setSkuSort)}>Gross Wt <SortIcon col="gross_weight" sort={skuSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('status', skuSort, setSkuSort)}>Status <SortIcon col="status" sort={skuSort} /></TableHead>
                        <TableHead className="text-right pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isSkuLoading && skuDetails.length === 0 ? (
                        [...Array(8)].map((_, i) => (
                          <TableRow key={i} className="opacity-40 border-b border-slate-50 h-16">
                            <TableCell className="pl-6"><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-40 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-12 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-12 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-6 w-20 bg-slate-200 animate-pulse rounded-full" /></TableCell>
                            <TableCell className="pr-6"><div className="h-8 w-16 bg-slate-100 animate-pulse rounded ml-auto" /></TableCell>
                          </TableRow>
                        ))
                      ) : skuDetails.length === 0 ? (
                        <TableRow><TableCell colSpan={8} className="text-center py-20 text-slate-400">No Finished Goods found</TableCell></TableRow>
                      ) : (
                        <>
                          {sortedSkuDetails.map(item => (
                            <TableRow key={item.id} className="hover:bg-slate-50/30 transition-colors border-b border-slate-50 h-16">
                              <TableCell className="font-semibold text-slate-900 pl-6">{item.sku_code}</TableCell>
                              <TableCell className="text-slate-700">{item.sku_name}</TableCell>
                              <TableCell className="text-slate-600">{item.main_uom}</TableCell>
                              <TableCell className="text-slate-600">{item.alternate_uom}</TableCell>
                              <TableCell className="text-slate-600 font-medium">{item.packing_weight}</TableCell>
                              <TableCell className="text-slate-600 font-medium">{item.gross_weight}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Badge variant={item.status === 'Active' ? 'default' : 'secondary'} className={item.status === 'Active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none' : ''}>
                                    {item.status}
                                  </Badge>
                                  {item.has_pending_edit && (
                                    <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50 whitespace-nowrap" title="An edit to this record is awaiting admin approval">
                                      Edit pending
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right pr-6">
                                <div className="flex justify-end gap-2">
                                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={!canEditActiveTab} title={!canEditActiveTab ? "View Only" : "Edit Finished Good"}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50" disabled={!canEditExisting} title={!canEditExisting ? "Admin Only" : "Delete Finished Good"}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {/* Infinite Scroll Sentinel */}
                          <TableRow ref={skuEndRef}>
                            <TableCell colSpan={8} className="p-0 h-12 border-none">
                              {isFetchingNextSku && (
                                <div className="flex items-center justify-center py-4 text-slate-400 bg-slate-50/20">
                                  <div className="flex gap-1.5 items-center bg-white px-4 py-1.5 rounded-full shadow-sm border border-slate-100">
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.3s]"></div>
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.15s]"></div>
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce"></div>
                                    <span className="text-xs font-medium ml-2 text-slate-500">Loading more Finished Goods...</span>
                                  </div>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </table>
                </div>
              </div>
              </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {visibleTabs.includes("sku_selling_price") && (
        <TabsContent value="sku_selling_price">
          <Card className="shadow-xl border-none rounded-2xl bg-white">
            <CardHeader className="bg-slate-50/50 border-b p-6">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    SKU Selling Price List
                  </CardTitle>
                  <CardDescription className="mt-1">Manage your SKU prices</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Mobile card view */}
              <div className="md:hidden">
                {isSkuSellingPriceLoading && skuSellingPrices.length === 0 ? (
                  <div className="p-4 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="border border-slate-100 rounded-xl p-4 space-y-2 animate-pulse"><div className="h-4 w-40 bg-slate-200 rounded" /><div className="h-3 w-32 bg-slate-200 rounded" /></div>)}</div>
                ) : skuSellingPrices.length === 0 ? (
                  <div className="text-center py-16 text-slate-400">No SKU Prices found</div>
                ) : (
                  <div className="p-3 space-y-3 overflow-auto" style={{ maxHeight: 600 }}>
                    {sortedSkuSellingPrices.map(item => (
                      <div key={item.id} className="border border-slate-100 rounded-xl p-4 bg-white shadow-sm space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 truncate">{item.packing_material}</p>
                            <p className="text-xs text-emerald-600 font-bold">Selling: {item.selling_cost}</p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={!canEditExisting} title={!canEditExisting ? "Admin Only" : "Edit"}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50" disabled={!canEditExisting} title={!canEditExisting ? "Admin Only" : "Delete"}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
                          <div><span className="font-medium text-slate-600">Weight: </span>{item.sku_weight} {item.sku_unit}</div>
                          <div><span className="font-medium text-slate-600">Landing Cost: </span>{item.landing_cost}</div>
                          <div><span className="font-medium text-slate-600">Pack Cost: </span>{item.packing_cost}</div>
                          <div><span className="font-medium text-slate-600">Margin: </span>{item.margin}</div>
                          <div><span className="font-medium text-slate-600">Net Oil(gm): </span>{item.net_oil_in_gm}</div>
                          <div><span className="font-medium text-slate-600">VAR: </span>{item.var}</div>
                        </div>
                      </div>
                    ))}
                    {isFetchingNextSkuSellingPrice && <div className="flex items-center justify-center py-4 gap-2 text-slate-400 text-xs"><div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.3s]" /><div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.15s]" /><div className="h-1.5 w-1.5 bg-primary animate-bounce" /><span className="ml-2">Loading more prices...</span></div>}
                  </div>
                )}
              </div>
              {/* Desktop table */}
              <div className="hidden md:flex flex-col h-[600px]">
                <div className="flex-1 overflow-auto rounded-b-2xl">
                  <table className="w-full caption-bottom text-sm">
                    <TableHeader className="sticky top-0 z-20 bg-slate-50 shadow-sm">
                      <TableRow className="hover:bg-transparent border-b">
                        <TableHead className="pl-6 cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('packing_material', skuSellingPriceSort, setSkuSellingPriceSort)}>Packing Material <SortIcon col="packing_material" sort={skuSellingPriceSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('sku_weight', skuSellingPriceSort, setSkuSellingPriceSort)}>Weight <SortIcon col="sku_weight" sort={skuSellingPriceSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('sku_unit', skuSellingPriceSort, setSkuSellingPriceSort)}>Unit <SortIcon col="sku_unit" sort={skuSellingPriceSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('conversion_formula', skuSellingPriceSort, setSkuSellingPriceSort)}>Conv. Form <SortIcon col="conversion_formula" sort={skuSellingPriceSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('sku_weight_in_gm', skuSellingPriceSort, setSkuSellingPriceSort)}>SKU Wght(gm) <SortIcon col="sku_weight_in_gm" sort={skuSellingPriceSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('packing_material_weight_in_gm', skuSellingPriceSort, setSkuSellingPriceSort)}>Pack Mat. Wght <SortIcon col="packing_material_weight_in_gm" sort={skuSellingPriceSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('net_oil_in_gm', skuSellingPriceSort, setSkuSellingPriceSort)}>Net Oil(gm) <SortIcon col="net_oil_in_gm" sort={skuSellingPriceSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('packing_cost', skuSellingPriceSort, setSkuSellingPriceSort)}>Pack Cost <SortIcon col="packing_cost" sort={skuSellingPriceSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('var', skuSellingPriceSort, setSkuSellingPriceSort)}>VAR <SortIcon col="var" sort={skuSellingPriceSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('landing_cost', skuSellingPriceSort, setSkuSellingPriceSort)}>Landing Cost <SortIcon col="landing_cost" sort={skuSellingPriceSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('margin', skuSellingPriceSort, setSkuSellingPriceSort)}>Margin <SortIcon col="margin" sort={skuSellingPriceSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('actual_margin', skuSellingPriceSort, setSkuSellingPriceSort)}>Actual Margin <SortIcon col="actual_margin" sort={skuSellingPriceSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('selling_cost', skuSellingPriceSort, setSkuSellingPriceSort)}>Selling Cost <SortIcon col="selling_cost" sort={skuSellingPriceSort} /></TableHead>
                        <TableHead className="text-right pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isSkuSellingPriceLoading && skuSellingPrices.length === 0 ? (
                        [...Array(8)].map((_, i) => (
                          <TableRow key={i} className="opacity-40 border-b border-slate-50 h-16">
                            <TableCell className="pl-6"><div className="h-4 w-32 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-12 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-12 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-12 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-20 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-20 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-24 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell className="pr-6"><div className="h-8 w-16 bg-slate-100 animate-pulse rounded ml-auto" /></TableCell>
                          </TableRow>
                        ))
                      ) : skuSellingPrices.length === 0 ? (
                        <TableRow><TableCell colSpan={14} className="text-center py-20 text-slate-400">No SKU Prices found</TableCell></TableRow>
                      ) : (
                        <>
                          {sortedSkuSellingPrices.map(item => (
                            <TableRow key={item.id} className="hover:bg-slate-50/30 transition-colors border-b border-slate-50 h-16">
                              <TableCell className="font-semibold text-slate-900 pl-6">{item.packing_material}</TableCell>
                              <TableCell className="text-slate-600 font-medium">{item.sku_weight}</TableCell>
                              <TableCell className="text-slate-500">{item.sku_unit}</TableCell>
                              <TableCell className="text-slate-500">{item.conversion_formula}</TableCell>
                              <TableCell className="text-slate-500">{item.sku_weight_in_gm}</TableCell>
                              <TableCell className="text-slate-500">{item.packing_material_weight_in_gm}</TableCell>
                              <TableCell className="text-slate-500">{item.net_oil_in_gm}</TableCell>
                              <TableCell className="text-slate-500">{item.packing_cost}</TableCell>
                              <TableCell className="text-slate-500">{item.var}</TableCell>
                              <TableCell className="font-bold text-slate-700 underline decoration-slate-200 decoration-2 underline-offset-4">{item.landing_cost}</TableCell>
                              <TableCell className="text-slate-600">{item.margin}</TableCell>
                              <TableCell className="text-slate-600 font-medium">{item.actual_margin}</TableCell>
                              <TableCell className="font-bold text-emerald-600 bg-emerald-50/50 rounded-lg px-2 py-1 inline-block mt-2 ml-4 mb-2">{item.selling_cost}</TableCell>
                              <TableCell className="text-right pr-6">
                                <div className="flex justify-end gap-2">
                                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={!canEditExisting} title={!canEditExisting ? "Admin Only" : "Edit SKU Price"}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50" disabled={!canEditExisting} title={!canEditExisting ? "Admin Only" : "Delete SKU Price"}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {/* Infinite Scroll Sentinel */}
                          <TableRow ref={skuSellingPriceEndRef}>
                            <TableCell colSpan={14} className="p-0 h-12 border-none">
                              {isFetchingNextSkuSellingPrice && (
                                <div className="flex items-center justify-center py-4 text-slate-400 bg-slate-50/20">
                                  <div className="flex gap-1.5 items-center bg-white px-4 py-1.5 rounded-full shadow-sm border border-slate-100">
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.3s]"></div>
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.15s]"></div>
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce"></div>
                                    <span className="text-xs font-medium ml-2 text-slate-500">Loading more prices...</span>
                                  </div>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {visibleTabs.includes("vehicle_master") && (
        <TabsContent value="vehicle_master">
          <Card className="shadow-xl border-none rounded-2xl bg-white">
            <CardHeader className="bg-slate-50/50 border-b p-6">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Truck className="h-5 w-5 text-primary" />
                    Vehicles List
                  </CardTitle>
                  <CardDescription className="mt-1">Manage your vehicle database and documents</CardDescription>
                </div>
              </div>
              {isAdminOrSuper && (
                <div className="flex gap-2 mt-4">
                  <button onClick={() => setVehicleSubTab('active')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${vehicleSubTab === 'active' ? 'bg-primary text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Active Records</button>
                  <button onClick={() => setVehicleSubTab('pending')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${vehicleSubTab === 'pending' ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    Pending Approval {pendingVehicles.length > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${vehicleSubTab === 'pending' ? 'bg-white text-amber-600' : 'bg-amber-500 text-white'}`}>{pendingVehicles.length}</span>}
                  </button>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {vehicleSubTab === 'pending' ? (
                <div className="flex flex-col h-[600px]"><div className="flex-1 overflow-auto rounded-b-2xl">
                  {pendingVehicles.length === 0 ? <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400"><CheckCircle2 className="h-10 w-10 text-emerald-300" /><p className="text-sm font-medium">No pending approvals</p></div> : (
                    <>
                      {/* Mobile card view */}
                      <div className="md:hidden p-3 space-y-3">
                        {pendingVehicles.map(item => {
                          const isEdit = item.request_type === 'edit'
                          const submittedBy = isEdit ? (item.pending_edit_by_name || item.created_by_name) : item.created_by_name
                          const submittedOn = isEdit ? item.pending_edit_at : item.created_at
                          return (
                            <div key={item.id} className="border border-slate-100 rounded-xl p-4 bg-white shadow-sm space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-800 truncate">{item.registration_no}</p>
                                  <p className="text-xs text-slate-500">{item.vehicle_master_id}</p>
                                </div>
                                <Badge variant="outline" className={isEdit ? "border-blue-300 text-blue-700 bg-blue-50 shrink-0" : "border-emerald-300 text-emerald-700 bg-emerald-50 shrink-0"}>
                                  {isEdit ? "Edit" : "New"}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
                                <div className="col-span-2"><span className="font-medium text-slate-600">Type: </span>{item.vehicle_type || "—"}</div>
                                <div className="col-span-2"><span className="font-medium text-slate-600">Transporter: </span>{item.transporter || "—"}</div>
                                <div className="col-span-2"><span className="font-medium text-slate-600">Submitted By: </span>{submittedBy || "—"}</div>
                                <div className="col-span-2"><span className="font-medium text-slate-600">Submitted On: </span>{submittedOn ? new Date(submittedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "—"}</div>
                              </div>
                              <div className="pt-2 border-t border-slate-50 flex gap-2 w-full justify-end">
                                <Button size="sm" onClick={() => openApprovalModal('vehicle_master', item)} disabled={isReviewing} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white px-3 rounded-lg text-xs flex-1"><Check className="h-3.5 w-3.5 mr-1" />Approve</Button>
                                <Button size="sm" variant="outline" onClick={() => setRejectDialogContext({ tab: 'vehicle_master', id: item.id })} disabled={isReviewing} className="h-8 border-red-200 text-red-600 hover:bg-red-50 px-3 rounded-lg text-xs flex-1"><X className="h-3.5 w-3.5 mr-1" />Reject</Button>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Desktop Table View */}
                      <table className="hidden md:table w-full caption-bottom text-sm">
                        <TableHeader className="sticky top-0 z-20 bg-amber-50 shadow-sm">
                          <TableRow className="hover:bg-transparent border-b">
                            <TableHead className="pl-6">Reg No</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Vehicle ID</TableHead>
                            <TableHead>Vehicle Type</TableHead>
                            <TableHead>Transporter</TableHead>
                            <TableHead>Submitted By</TableHead>
                            <TableHead>Submitted On</TableHead>
                            <TableHead className="text-right pr-6">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pendingVehicles.map(item => {
                            const isEdit = item.request_type === 'edit'
                            const submittedBy = isEdit ? (item.pending_edit_by_name || item.created_by_name) : item.created_by_name
                            const submittedOn = isEdit ? item.pending_edit_at : item.created_at
                            return (
                            <TableRow key={item.id} className="hover:bg-amber-50/30 border-b border-slate-50 h-16">
                              <TableCell className="font-semibold text-slate-900 pl-6">{item.registration_no}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={isEdit ? "border-blue-300 text-blue-700 bg-blue-50" : "border-emerald-300 text-emerald-700 bg-emerald-50"}>
                                  {isEdit ? "Edit" : "New"}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-medium text-slate-500">{item.vehicle_master_id}</TableCell>
                              <TableCell>{item.vehicle_type || "—"}</TableCell>
                              <TableCell>{item.transporter || "—"}</TableCell>
                              <TableCell>{submittedBy || "—"}</TableCell>
                              <TableCell className="text-slate-500 text-xs">{submittedOn ? new Date(submittedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "—"}</TableCell>
                              <TableCell className="text-right pr-6">
                                <div className="flex justify-end gap-2">
                                  <Button size="sm" onClick={() => openApprovalModal('vehicle_master', item)} disabled={isReviewing} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white px-3 rounded-lg">
                                    <Check className="h-3.5 w-3.5 mr-1" /> Approve
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => setRejectDialogContext({ tab: 'vehicle_master', id: item.id })} disabled={isReviewing} className="h-8 border-red-200 text-red-600 hover:bg-red-50 px-3 rounded-lg">
                                    <X className="h-3.5 w-3.5 mr-1" /> Reject
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )})}
                        </TableBody>
                      </table>
                    </>
                  )}
                </div></div>
              ) : (
              <>
              {/* Mobile card view */}
              <div className="md:hidden">
                {isVehicleLoading && vehicles.length === 0 ? (
                  <div className="p-4 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="border border-slate-100 rounded-xl p-4 space-y-2 animate-pulse"><div className="h-4 w-32 bg-slate-200 rounded" /><div className="h-3 w-40 bg-slate-200 rounded" /></div>)}</div>
                ) : vehicles.length === 0 ? (
                  <div className="text-center py-16 text-slate-400">No vehicles found</div>
                ) : (
                  <div className="p-3 space-y-3 overflow-auto" style={{ maxHeight: 600 }}>
                    {sortedVehicles.map(item => (
                      <div key={item.id} className="border border-slate-100 rounded-xl p-4 bg-white shadow-sm space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 truncate">{item.registration_no}</p>
                            <p className="text-xs text-slate-500">{item.vehicle_master_id}</p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={!canEditActiveTab} title={!canEditActiveTab ? "View Only" : "Edit"}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50" disabled={!canEditExisting} title={!canEditExisting ? "Admin Only" : "Delete"}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
                          <div><span className="font-medium text-slate-600">Transporter: </span>{item.transporter || "—"}</div>
                          <div><span className="font-medium text-slate-600">Type: </span>{item.vehicle_type || "—"}</div>
                        </div>
                        <div className="mt-2 pt-2 border-t border-slate-100 space-y-1.5">
                          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Document Expiry Details</p>
                          <div className="grid grid-cols-1 gap-1.5 text-xs">
                            {(item.road_tax || item.road_tax_image) && (
                              <div className="flex items-center justify-between py-0.5 border-b border-slate-50">
                                <span className="font-medium text-slate-500">Road Tax Expiry</span>
                                {item.road_tax_image ? (
                                  <button onClick={(e) => { e.stopPropagation(); window.open(item.road_tax_image, '_blank'); }} className="text-blue-600 hover:text-blue-800 hover:underline font-medium">
                                    {formatDocDate(item.road_tax)}
                                  </button>
                                ) : (
                                  <span className="text-slate-700">{formatDocDate(item.road_tax)}</span>
                                )}
                              </div>
                            )}
                            {(item.life_time_tax || item.life_time_tax_image) && (
                              <div className="flex items-center justify-between py-0.5 border-b border-slate-50">
                                <span className="font-medium text-slate-500">Lifetime Tax</span>
                                {item.life_time_tax_image ? (
                                  <button onClick={(e) => { e.stopPropagation(); window.open(item.life_time_tax_image, '_blank'); }} className="text-blue-600 hover:text-blue-800 hover:underline font-semibold">
                                    LTT
                                  </button>
                                ) : (
                                  <span className="text-slate-700 font-semibold">LTT</span>
                                )}
                              </div>
                            )}
                            {(item.pollution || item.pollution_image || item.fuel_type === 'Electrical') && (
                              <div className="flex items-center justify-between py-0.5 border-b border-slate-50">
                                <span className="font-medium text-slate-500">Pollution Expiry</span>
                                {item.fuel_type === 'Electrical' ? (
                                  item.pollution_image ? (
                                    <button onClick={(e) => { e.stopPropagation(); window.open(item.pollution_image, '_blank'); }} className="text-blue-600 hover:text-blue-800 hover:underline font-medium">
                                      N/A
                                    </button>
                                  ) : (
                                    <span className="text-slate-700">N/A</span>
                                  )
                                ) : item.pollution_image ? (
                                  <button onClick={(e) => { e.stopPropagation(); window.open(item.pollution_image, '_blank'); }} className="text-blue-600 hover:text-blue-800 hover:underline font-medium">
                                    {formatDocDate(item.pollution)}
                                  </button>
                                ) : (
                                  <span className="text-slate-700">{formatDocDate(item.pollution)}</span>
                                )}
                              </div>
                            )}
                            {(item.insurance || item.insurance_image) && (
                              <div className="flex items-center justify-between py-0.5 border-b border-slate-50">
                                <span className="font-medium text-slate-500">Insurance Expiry</span>
                                {item.insurance_image ? (
                                  <button onClick={(e) => { e.stopPropagation(); window.open(item.insurance_image, '_blank'); }} className="text-blue-600 hover:text-blue-800 hover:underline font-medium">
                                    {formatDocDate(item.insurance)}
                                  </button>
                                ) : (
                                  <span className="text-slate-700">{formatDocDate(item.insurance)}</span>
                                )}
                              </div>
                            )}
                            {(item.fitness || item.fitness_image) && (
                              <div className="flex items-center justify-between py-0.5 border-b border-slate-50">
                                <span className="font-medium text-slate-500">Fitness Expiry</span>
                                {item.fitness_image ? (
                                  <button onClick={(e) => { e.stopPropagation(); window.open(item.fitness_image, '_blank'); }} className="text-blue-600 hover:text-blue-800 hover:underline font-medium">
                                    {formatDocDate(item.fitness)}
                                  </button>
                                ) : (
                                  <span className="text-slate-700">{formatDocDate(item.fitness)}</span>
                                )}
                              </div>
                            )}
                            {(item.state_permit || item.state_permit_image) && (
                              <div className="flex items-center justify-between py-0.5">
                                <span className="font-medium text-slate-500">State Permit Expiry</span>
                                {item.state_permit_image ? (
                                  <button onClick={(e) => { e.stopPropagation(); window.open(item.state_permit_image, '_blank'); }} className="text-blue-600 hover:text-blue-800 hover:underline font-medium">
                                    {formatDocDate(item.state_permit)}
                                  </button>
                                ) : (
                                  <span className="text-slate-700">{formatDocDate(item.state_permit)}</span>
                                )}
                              </div>
                            )}
                            {(item.national_permit || item.national_permit_image) && (
                              <div className="flex items-center justify-between py-0.5">
                                <span className="font-medium text-slate-500">National Permit Expiry</span>
                                {item.national_permit_image ? (
                                  <button onClick={(e) => { e.stopPropagation(); window.open(item.national_permit_image, '_blank'); }} className="text-blue-600 hover:text-blue-800 hover:underline font-medium">
                                    {formatDocDate(item.national_permit)}
                                  </button>
                                ) : (
                                  <span className="text-slate-700">{formatDocDate(item.national_permit)}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={item.status === 'Active' ? 'default' : 'secondary'} className={item.status === 'Active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none' : ''}>{item.status}</Badge>
                          {item.has_pending_edit && <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">Edit pending approval</Badge>}
                        </div>
                      </div>
                    ))}
                    {isFetchingNextVehicle && <div className="flex items-center justify-center py-4 gap-2 text-slate-400 text-xs"><div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.3s]" /><div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.15s]" /><div className="h-1.5 w-1.5 bg-primary animate-bounce" /><span className="ml-2">Loading more vehicles...</span></div>}
                  </div>
                )}
              </div>
              {/* Desktop table */}
              <div className="hidden md:flex flex-col h-[600px]">
                <div className="flex-1 overflow-auto rounded-b-2xl">
                  <table className="w-full caption-bottom text-sm">
                    <TableHeader className="sticky top-0 z-20 bg-slate-50 shadow-sm">
                      <TableRow className="hover:bg-transparent border-b">
                        <TableHead className="pl-6 cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('vehicle_master_id', vehicleSort, setVehicleSort)}>ID <SortIcon col="vehicle_master_id" sort={vehicleSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('registration_no', vehicleSort, setVehicleSort)}>Reg No <SortIcon col="registration_no" sort={vehicleSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('transporter', vehicleSort, setVehicleSort)}>Transporter <SortIcon col="transporter" sort={vehicleSort} /></TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('road_tax', vehicleSort, setVehicleSort)}>Road Tax <SortIcon col="road_tax" sort={vehicleSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('pollution', vehicleSort, setVehicleSort)}>Pollution <SortIcon col="pollution" sort={vehicleSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('insurance', vehicleSort, setVehicleSort)}>Insurance <SortIcon col="insurance" sort={vehicleSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('fitness', vehicleSort, setVehicleSort)}>Fitness <SortIcon col="fitness" sort={vehicleSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('state_permit', vehicleSort, setVehicleSort)}>State Permit <SortIcon col="state_permit" sort={vehicleSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('national_permit', vehicleSort, setVehicleSort)}>National Permit <SortIcon col="national_permit" sort={vehicleSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('status', vehicleSort, setVehicleSort)}>Status <SortIcon col="status" sort={vehicleSort} /></TableHead>
                        <TableHead className="text-right pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isVehicleLoading && vehicles.length === 0 ? (
                        [...Array(8)].map((_, i) => (
                          <TableRow key={i} className="opacity-40 border-b border-slate-50 h-16">
                            <TableCell className="pl-6"><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-32 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-40 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-24 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-20 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-20 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-20 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-20 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-20 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-20 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-6 w-20 bg-slate-200 animate-pulse rounded-full" /></TableCell>
                            <TableCell className="pr-6"><div className="h-8 w-16 bg-slate-100 animate-pulse rounded ml-auto" /></TableCell>
                          </TableRow>
                        ))
                      ) : vehicles.length === 0 ? (
                        <TableRow><TableCell colSpan={13} className="text-center py-20 text-slate-400">No vehicles found</TableCell></TableRow>
                      ) : (
                        <>
                          {sortedVehicles.map(item => (
                            <TableRow key={item.id} className="hover:bg-slate-50/30 transition-colors border-b border-slate-50 h-16">
                              <TableCell className="font-medium pl-6">{item.vehicle_master_id}</TableCell>
                              <TableCell className="font-semibold text-slate-900">{item.registration_no}</TableCell>
                              <TableCell className="text-slate-600">{item.transporter || "—"}</TableCell>
                              <TableCell>
                                <span className="font-medium text-slate-700 text-sm">{item.vehicle_type || "—"}</span>
                              </TableCell>
                              {(item.life_time_tax || item.life_time_tax_image) ? (
                                <TableCell className="text-xs">
                                  {item.life_time_tax_image ? (
                                    <button onClick={() => window.open(item.life_time_tax_image, '_blank')} className="text-blue-600 hover:text-blue-800 hover:underline font-semibold text-left w-fit" title="Lifetime Tax — open certificate">LTT</button>
                                  ) : (
                                    <span className="text-slate-700 font-semibold" title="Lifetime Tax">LTT</span>
                                  )}
                                </TableCell>
                              ) : (
                                renderDocCell(item.road_tax, item.road_tax_image)
                              )}
                              {item.fuel_type === 'Electrical' ? (
                                <TableCell className="text-xs">
                                  {item.pollution_image ? (
                                    <button onClick={() => window.open(item.pollution_image, '_blank')} className="text-blue-600 hover:text-blue-800 hover:underline font-medium text-left w-fit">N/A</button>
                                  ) : (
                                    <span className="text-slate-700 font-medium">N/A</span>
                                  )}
                                </TableCell>
                              ) : (
                                renderDocCell(item.pollution, item.pollution_image)
                              )}
                              {renderDocCell(item.insurance, item.insurance_image)}
                              {renderDocCell(item.fitness, item.fitness_image)}
                              {renderDocCell(item.state_permit, item.state_permit_image)}
                              {renderDocCell(item.national_permit, item.national_permit_image)}
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Badge variant={item.status === 'Active' ? 'default' : 'secondary'} className={item.status === 'Active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none' : ''}>
                                    {item.status}
                                  </Badge>
                                  {item.has_pending_edit && (
                                    <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50 whitespace-nowrap" title="An edit to this record is awaiting admin approval">
                                      Edit pending
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right pr-6">
                                <div className="flex justify-end gap-2">
                                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={!canEditActiveTab} title={!canEditActiveTab ? "View Only" : "Edit Vehicle"}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50" disabled={!canEditExisting} title={!canEditExisting ? "Admin Only" : "Delete Vehicle"}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {/* Infinite Scroll Sentinel */}
                          <TableRow ref={vehicleEndRef}>
                            <TableCell colSpan={7} className="p-0 h-12 border-none">
                              {isFetchingNextVehicle && (
                                <div className="flex items-center justify-center py-4 text-slate-400 bg-slate-50/20">
                                  <div className="flex gap-1.5 items-center bg-white px-4 py-1.5 rounded-full shadow-sm border border-slate-100">
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.3s]"></div>
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.15s]"></div>
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce"></div>
                                    <span className="text-xs font-medium ml-2 text-slate-500">Loading more vehicles...</span>
                                  </div>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </table>
                </div>
              </div>
              </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {visibleTabs.includes("driver_master") && (
        <TabsContent value="driver_master">
          <Card className="shadow-xl border-none rounded-2xl bg-white">
            <CardHeader className="bg-slate-50/50 border-b p-6">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    Drivers List
                  </CardTitle>
                  <CardDescription className="mt-1">Manage your driver database and licences</CardDescription>
                </div>
              </div>
              {isAdminOrSuper && (
                <div className="flex gap-2 mt-4">
                  <button onClick={() => setDriverSubTab('active')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${driverSubTab === 'active' ? 'bg-primary text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Active Records</button>
                  <button onClick={() => setDriverSubTab('pending')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${driverSubTab === 'pending' ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    Pending Approval {pendingDrivers.length > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${driverSubTab === 'pending' ? 'bg-white text-amber-600' : 'bg-amber-500 text-white'}`}>{pendingDrivers.length}</span>}
                  </button>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {driverSubTab === 'pending' ? (
                <div className="flex flex-col h-[600px]"><div className="flex-1 overflow-auto rounded-b-2xl">
                  {pendingDrivers.length === 0 ? <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400"><CheckCircle2 className="h-10 w-10 text-emerald-300" /><p className="text-sm font-medium">No pending approvals</p></div> : (
                    <>
                      {/* Mobile card view */}
                      <div className="md:hidden p-3 space-y-3">
                        {pendingDrivers.map(item => {
                          const isEdit = item.request_type === 'edit'
                          const submittedBy = isEdit ? (item.pending_edit_by_name || item.created_by_name) : item.created_by_name
                          const submittedOn = isEdit ? item.pending_edit_at : item.created_at
                          return (
                            <div key={item.id} className="border border-slate-100 rounded-xl p-4 bg-white shadow-sm space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-800 truncate">{item.driver_name}</p>
                                  <p className="text-xs text-slate-500">{item.driver_master_id}</p>
                                </div>
                                <Badge variant="outline" className={isEdit ? "border-blue-300 text-blue-700 bg-blue-50 shrink-0" : "border-emerald-300 text-emerald-700 bg-emerald-50 shrink-0"}>
                                  {isEdit ? "Edit" : "New"}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
                                <div className="col-span-2"><span className="font-medium text-slate-600">Mobile: </span>{item.mobile_no || "—"}</div>
                                <div className="col-span-2"><span className="font-medium text-slate-600">DL No: </span>{item.driving_licence_no || "—"}</div>
                                <div className="col-span-2"><span className="font-medium text-slate-600">Submitted By: </span>{submittedBy || "—"}</div>
                                <div className="col-span-2"><span className="font-medium text-slate-600">Submitted On: </span>{submittedOn ? new Date(submittedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "—"}</div>
                              </div>
                              <div className="pt-2 border-t border-slate-50 flex gap-2 w-full justify-end">
                                <Button size="sm" onClick={() => openApprovalModal('driver_master', item)} disabled={isReviewing} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white px-3 rounded-lg text-xs flex-1"><Check className="h-3.5 w-3.5 mr-1" />Approve</Button>
                                <Button size="sm" variant="outline" onClick={() => setRejectDialogContext({ tab: 'driver_master', id: item.id })} disabled={isReviewing} className="h-8 border-red-200 text-red-600 hover:bg-red-50 px-3 rounded-lg text-xs flex-1"><X className="h-3.5 w-3.5 mr-1" />Reject</Button>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Desktop Table View */}
                      <table className="hidden md:table w-full caption-bottom text-sm">
                        <TableHeader className="sticky top-0 z-20 bg-amber-50 shadow-sm">
                          <TableRow className="hover:bg-transparent border-b">
                            <TableHead className="pl-6">Driver ID</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Mobile</TableHead>
                            <TableHead>DL No</TableHead>
                            <TableHead>Submitted By</TableHead>
                            <TableHead>Submitted On</TableHead>
                            <TableHead className="text-right pr-6">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pendingDrivers.map(item => {
                            const isEdit = item.request_type === 'edit'
                            const submittedBy = isEdit ? (item.pending_edit_by_name || item.created_by_name) : item.created_by_name
                            const submittedOn = isEdit ? item.pending_edit_at : item.created_at
                            return (
                            <TableRow key={item.id} className="hover:bg-amber-50/30 border-b border-slate-50 h-16">
                              <TableCell className="font-medium pl-6 text-slate-500">{item.driver_master_id}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={isEdit ? "border-blue-300 text-blue-700 bg-blue-50" : "border-emerald-300 text-emerald-700 bg-emerald-50"}>
                                  {isEdit ? "Edit" : "New"}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-semibold text-slate-900">{item.driver_name}</TableCell>
                              <TableCell>{item.mobile_no || "—"}</TableCell>
                              <TableCell>{item.driving_licence_no || "—"}</TableCell>
                              <TableCell>{submittedBy || "—"}</TableCell>
                              <TableCell className="text-slate-500 text-xs">{submittedOn ? new Date(submittedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "—"}</TableCell>
                              <TableCell className="text-right pr-6">
                                <div className="flex justify-end gap-2">
                                  <Button size="sm" onClick={() => openApprovalModal('driver_master', item)} disabled={isReviewing} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white px-3 rounded-lg">
                                    <Check className="h-3.5 w-3.5 mr-1" /> Approve
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => setRejectDialogContext({ tab: 'driver_master', id: item.id })} disabled={isReviewing} className="h-8 border-red-200 text-red-600 hover:bg-red-50 px-3 rounded-lg">
                                    <X className="h-3.5 w-3.5 mr-1" /> Reject
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )})}
                        </TableBody>
                      </table>
                    </>
                  )}
                </div></div>
              ) : (
              <>
              {/* Mobile card view */}
              <div className="md:hidden">
                {isDriverLoading && drivers.length === 0 ? (
                  <div className="p-4 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="border border-slate-100 rounded-xl p-4 space-y-2 animate-pulse"><div className="h-4 w-32 bg-slate-200 rounded" /><div className="h-3 w-40 bg-slate-200 rounded" /></div>)}</div>
                ) : drivers.length === 0 ? (
                  <div className="text-center py-16 text-slate-400">No drivers found</div>
                ) : (
                  <div className="p-3 space-y-3 overflow-auto" style={{ maxHeight: 600 }}>
                    {sortedDrivers.map(item => (
                      <div key={item.id} className="border border-slate-100 rounded-xl p-4 bg-white shadow-sm space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 truncate">{item.driver_name}</p>
                            <p className="text-xs text-slate-500">{item.driver_master_id}</p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={!canEditActiveTab} title={!canEditActiveTab ? "View Only" : "Edit"}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50" disabled={!canEditExisting} title={!canEditExisting ? "Admin Only" : "Delete"}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
                          <div><span className="font-medium text-slate-600">Mobile: </span>{item.mobile_no || "—"}</div>
                          <div><span className="font-medium text-slate-600">Licence No: </span>{item.driving_licence_no || "—"}</div>
                          <div><span className="font-medium text-slate-600">Licence Type: </span>{item.driving_licence_type || "—"}</div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1 text-xs">
                          <span className="font-medium text-slate-600">DL Upto: </span>
                          {item.valid_upto ? (
                            item.dl_upload ? (
                              <button
                                onClick={() => window.open(item.dl_upload, '_blank')}
                                className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                                title="View Driving Licence document"
                              >
                                {new Date(item.valid_upto.split('T')[0]).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </button>
                            ) : (
                              <span className="text-slate-700">{new Date(item.valid_upto.split('T')[0]).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                            )
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={item.status === 'Active' ? 'default' : 'secondary'} className={item.status === 'Active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none' : ''}>{item.status}</Badge>
                          {item.has_pending_edit && <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">Edit pending approval</Badge>}
                        </div>
                      </div>
                    ))}
                    {isFetchingNextDriver && <div className="flex items-center justify-center py-4 gap-2 text-slate-400 text-xs"><div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.3s]" /><div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.15s]" /><div className="h-1.5 w-1.5 bg-primary animate-bounce" /><span className="ml-2">Loading more drivers...</span></div>}
                  </div>
                )}
              </div>
              {/* Desktop table */}
              <div className="hidden md:flex flex-col h-[600px]">
                <div className="flex-1 overflow-auto rounded-b-2xl">
                  <table className="w-full caption-bottom text-sm">
                    <TableHeader className="sticky top-0 z-20 bg-slate-50 shadow-sm">
                      <TableRow className="hover:bg-transparent border-b">
                        <TableHead className="pl-6 cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('driver_master_id', driverSort, setDriverSort)}>ID <SortIcon col="driver_master_id" sort={driverSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('driver_name', driverSort, setDriverSort)}>Driver Name <SortIcon col="driver_name" sort={driverSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('mobile_no', driverSort, setDriverSort)}>Mobile <SortIcon col="mobile_no" sort={driverSort} /></TableHead>
                        <TableHead>Licence No.</TableHead>
                        <TableHead>DL Upto</TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('status', driverSort, setDriverSort)}>Status <SortIcon col="status" sort={driverSort} /></TableHead>
                        <TableHead className="text-right pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isDriverLoading && drivers.length === 0 ? (
                        [...Array(8)].map((_, i) => (
                          <TableRow key={i} className="opacity-40 border-b border-slate-50 h-16">
                            <TableCell className="pl-6"><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-32 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-24 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-32 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-32 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-6 w-20 bg-slate-200 animate-pulse rounded-full" /></TableCell>
                            <TableCell className="pr-6"><div className="h-8 w-16 bg-slate-100 animate-pulse rounded ml-auto" /></TableCell>
                          </TableRow>
                        ))
                      ) : drivers.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-20 text-slate-400">No drivers found</TableCell></TableRow>
                      ) : (
                        <>
                          {sortedDrivers.map(item => (
                            <TableRow key={item.id} className="hover:bg-slate-50/30 transition-colors border-b border-slate-50 h-16">
                              <TableCell className="font-medium pl-6">{item.driver_master_id}</TableCell>
                              <TableCell className="font-semibold text-slate-900">{item.driver_name}</TableCell>
                              <TableCell className="text-slate-600">{item.mobile_no || "—"}</TableCell>
                              <TableCell>
                                <div className="text-xs">
                                  <p className="font-medium text-slate-700">{item.driving_licence_no || "—"}</p>
                                  <p className="text-slate-400">{item.driving_licence_type || "—"}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                {item.valid_upto ? (
                                  item.dl_upload ? (
                                    <button
                                      onClick={() => window.open(item.dl_upload, '_blank')}
                                      className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
                                      title="View Driving Licence document"
                                    >
                                      {new Date(item.valid_upto.split('T')[0]).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </button>
                                  ) : (
                                    <span className="text-xs text-slate-700">{new Date(item.valid_upto.split('T')[0]).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                  )
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Badge variant={item.status === 'Active' ? 'default' : 'secondary'} className={item.status === 'Active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none' : ''}>
                                    {item.status}
                                  </Badge>
                                  {item.has_pending_edit && (
                                    <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50 whitespace-nowrap" title="An edit to this record is awaiting admin approval">
                                      Edit pending
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right pr-6">
                                <div className="flex justify-end gap-2">
                                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={!canEditActiveTab} title={!canEditActiveTab ? "View Only" : "Edit Driver"}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50" disabled={!canEditExisting} title={!canEditExisting ? "Admin Only" : "Delete Driver"}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {/* Infinite Scroll Sentinel */}
                          <TableRow ref={driverEndRef}>
                            <TableCell colSpan={7} className="p-0 h-12 border-none">
                              {isFetchingNextDriver && (
                                <div className="flex items-center justify-center py-4 text-slate-400 bg-slate-50/20">
                                  <div className="flex gap-1.5 items-center bg-white px-4 py-1.5 rounded-full shadow-sm border border-slate-100">
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.3s]"></div>
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.15s]"></div>
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce"></div>
                                    <span className="text-xs font-medium ml-2 text-slate-500">Loading more drivers...</span>
                                  </div>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </table>
                </div>
              </div>
              </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {visibleTabs.includes("transport_master") && (
        <TabsContent value="transport_master">
          <Card className="shadow-xl border-none rounded-2xl bg-white">
            <CardHeader className="bg-slate-50/50 border-b p-6">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Truck className="h-5 w-5 text-primary" />
                    Transporters List
                  </CardTitle>
                  <CardDescription className="mt-1">Manage your transporter and logistics partners</CardDescription>
                </div>
              </div>
              {isAdminOrSuper && (
                <div className="flex gap-2 mt-4">
                  <button onClick={() => setTransportSubTab('active')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${transportSubTab === 'active' ? 'bg-primary text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Active Records</button>
                  <button onClick={() => setTransportSubTab('pending')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${transportSubTab === 'pending' ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    Pending Approval {pendingTransporters.length > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${transportSubTab === 'pending' ? 'bg-white text-amber-600' : 'bg-amber-500 text-white'}`}>{pendingTransporters.length}</span>}
                  </button>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {transportSubTab === 'pending' ? (
                <div className="flex flex-col h-[600px]"><div className="flex-1 overflow-auto rounded-b-2xl">
                  {pendingTransporters.length === 0 ? <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400"><CheckCircle2 className="h-10 w-10 text-emerald-300" /><p className="text-sm font-medium">No pending approvals</p></div> : (
                    <>
                      {/* Mobile card view */}
                      <div className="md:hidden p-3 space-y-3">
                        {pendingTransporters.map(item => {
                          const isEdit = item.request_type === 'edit'
                          const submittedBy = isEdit ? (item.pending_edit_by_name || item.created_by_name) : item.created_by_name
                          const submittedOn = isEdit ? item.pending_edit_at : item.created_at
                          return (
                            <div key={item.id} className="border border-slate-100 rounded-xl p-4 bg-white shadow-sm space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-800 truncate">{item.transporter_name}</p>
                                  <p className="text-xs text-slate-500">{item.transport_master_id}</p>
                                </div>
                                <Badge variant="outline" className={isEdit ? "border-blue-300 text-blue-700 bg-blue-50 shrink-0" : "border-emerald-300 text-emerald-700 bg-emerald-50 shrink-0"}>
                                  {isEdit ? "Edit" : "New"}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
                                <div className="col-span-2"><span className="font-medium text-slate-600">Contact: </span>{item.contact_number || "—"}</div>
                                <div className="col-span-2"><span className="font-medium text-slate-600">GSTIN: </span>{item.gstin || "—"}</div>
                                <div className="col-span-2"><span className="font-medium text-slate-600">Submitted By: </span>{submittedBy || "—"}</div>
                                <div className="col-span-2"><span className="font-medium text-slate-600">Submitted On: </span>{submittedOn ? new Date(submittedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "—"}</div>
                              </div>
                              <div className="pt-2 border-t border-slate-50 flex gap-2 w-full justify-end">
                                <Button size="sm" onClick={() => openApprovalModal('transport_master', item)} disabled={isReviewing} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white px-3 rounded-lg text-xs flex-1"><Check className="h-3.5 w-3.5 mr-1" />Approve</Button>
                                <Button size="sm" variant="outline" onClick={() => setRejectDialogContext({ tab: 'transport_master', id: item.id })} disabled={isReviewing} className="h-8 border-red-200 text-red-600 hover:bg-red-50 px-3 rounded-lg text-xs flex-1"><X className="h-3.5 w-3.5 mr-1" />Reject</Button>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Desktop Table View */}
                      <table className="hidden md:table w-full caption-bottom text-sm">
                        <TableHeader className="sticky top-0 z-20 bg-amber-50 shadow-sm">
                          <TableRow className="hover:bg-transparent border-b">
                            <TableHead className="pl-6">ID</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Contact</TableHead>
                            <TableHead>GSTIN</TableHead>
                            <TableHead>Submitted By</TableHead>
                            <TableHead>Submitted On</TableHead>
                            <TableHead className="text-right pr-6">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pendingTransporters.map(item => {
                            const isEdit = item.request_type === 'edit'
                            const submittedBy = isEdit ? (item.pending_edit_by_name || item.created_by_name) : item.created_by_name
                            const submittedOn = isEdit ? item.pending_edit_at : item.created_at
                            return (
                              <TableRow key={item.id} className="hover:bg-amber-50/30 border-b border-slate-50 h-16">
                                <TableCell className="font-medium pl-6 text-slate-500">{item.transport_master_id}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={isEdit ? "border-blue-300 text-blue-700 bg-blue-50" : "border-emerald-300 text-emerald-700 bg-emerald-50"}>
                                    {isEdit ? "Edit" : "New"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-semibold text-slate-900">{item.transporter_name}</TableCell>
                                <TableCell>{item.contact_number || "—"}</TableCell>
                                <TableCell>{item.gstin || "—"}</TableCell>
                                <TableCell>{submittedBy || "—"}</TableCell>
                                <TableCell className="text-slate-500 text-xs">{submittedOn ? new Date(submittedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "—"}</TableCell>
                                <TableCell className="text-right pr-6">
                                  <div className="flex justify-end gap-2">
                                    <Button size="sm" onClick={() => openApprovalModal('transport_master', item)} disabled={isReviewing} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white px-3 rounded-lg">
                                      <Check className="h-3.5 w-3.5 mr-1" /> Approve
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => setRejectDialogContext({ tab: 'transport_master', id: item.id })} disabled={isReviewing} className="h-8 border-red-200 text-red-600 hover:bg-red-50 px-3 rounded-lg">
                                      <X className="h-3.5 w-3.5 mr-1" /> Reject
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </table>
                    </>
                  )}
                </div></div>
              ) : (
              <>
              {/* Mobile card view */}
              <div className="md:hidden">
                {isTransportLoading && transporters.length === 0 ? (
                  <div className="p-4 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="border border-slate-100 rounded-xl p-4 space-y-2 animate-pulse"><div className="h-4 w-32 bg-slate-200 rounded" /><div className="h-3 w-40 bg-slate-200 rounded" /></div>)}</div>
                ) : transporters.length === 0 ? (
                  <div className="text-center py-16 text-slate-400">No transporters found</div>
                ) : (
                  <div className="p-3 space-y-3 overflow-auto" style={{ maxHeight: 600 }}>
                    {sortedTransporters.map(item => (
                      <div key={item.id} className="border border-slate-100 rounded-xl p-4 bg-white shadow-sm space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 truncate">{item.transporter_name}</p>
                            <p className="text-xs text-slate-500">{item.transport_master_id}</p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={!canEditActiveTab} title={!canEditActiveTab ? "View Only" : "Edit"}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50" disabled={!canEditExisting} title={!canEditExisting ? "Admin Only" : "Delete"}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
                          <div><span className="font-medium text-slate-600">Contact: </span>{item.contact_person || "—"}</div>
                          <div><span className="font-medium text-slate-600">Phone: </span>{item.contact_number || "—"}</div>
                          <div className="col-span-2"><span className="font-medium text-slate-600">Email: </span>{item.email_id || "—"}</div>
                          {item.pan && <div><span className="font-medium text-slate-600">PAN: </span>{item.pan}</div>}
                          {item.gstin && <div><span className="font-medium text-slate-600">GST: </span>{item.gstin}</div>}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={item.status === 'Active' ? 'default' : 'secondary'} className={item.status === 'Active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none' : ''}>{item.status}</Badge>
                          {item.has_pending_edit && <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">Edit pending approval</Badge>}
                        </div>
                      </div>
                    ))}
                    {isFetchingNextTransport && <div className="flex items-center justify-center py-4 gap-2 text-slate-400 text-xs"><div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.3s]" /><div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.15s]" /><div className="h-1.5 w-1.5 bg-primary animate-bounce" /><span className="ml-2">Loading more transporters...</span></div>}
                  </div>
                )}
              </div>
              {/* Desktop table */}
              <div className="hidden md:flex flex-col h-[600px]">
                <div className="flex-1 overflow-auto rounded-b-2xl">
                  <table className="w-full caption-bottom text-sm">
                    <TableHeader className="sticky top-0 z-20 bg-slate-50 shadow-sm">
                      <TableRow className="hover:bg-transparent border-b">
                        <TableHead className="pl-6 cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('transport_master_id', transportSort, setTransportSort)}>ID <SortIcon col="transport_master_id" sort={transportSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('transporter_name', transportSort, setTransportSort)}>Transporter Name <SortIcon col="transporter_name" sort={transportSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('contact_person', transportSort, setTransportSort)}>Contact Person <SortIcon col="contact_person" sort={transportSort} /></TableHead>
                        <TableHead>Contact Details</TableHead>
                        <TableHead>Credentials</TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('status', transportSort, setTransportSort)}>Status <SortIcon col="status" sort={transportSort} /></TableHead>
                        <TableHead className="text-right pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isTransportLoading && transporters.length === 0 ? (
                        [...Array(8)].map((_, i) => (
                          <TableRow key={i} className="opacity-40 border-b border-slate-50 h-16">
                            <TableCell className="pl-6"><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-32 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-24 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-8 w-40 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-8 w-32 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-6 w-20 bg-slate-200 animate-pulse rounded-full" /></TableCell>
                            <TableCell className="pr-6"><div className="h-8 w-16 bg-slate-100 animate-pulse rounded ml-auto" /></TableCell>
                          </TableRow>
                        ))
                      ) : transporters.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-20 text-slate-400">No transporters found</TableCell></TableRow>
                      ) : (
                        <>
                          {sortedTransporters.map(item => (
                            <TableRow key={item.id} className="hover:bg-slate-50/30 transition-colors border-b border-slate-50 h-16">
                              <TableCell className="font-medium pl-6">{item.transport_master_id}</TableCell>
                              <TableCell className="font-semibold text-slate-900">{item.transporter_name}</TableCell>
                              <TableCell className="text-slate-600">{item.contact_person || "—"}</TableCell>
                              <TableCell>
                                <div className="text-xs">
                                  <p className="font-medium text-slate-700">{item.contact_number || "—"}</p>
                                  <p className="text-slate-400">{item.email_id || "—"}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-[10px] space-y-1">
                                  {item.pan && <div className="flex items-center gap-1"><span className="text-slate-400 uppercase">PAN:</span> <span className="font-bold">{item.pan}</span></div>}
                                  {item.gstin && <div className="flex items-center gap-1"><span className="text-slate-400 uppercase">GST:</span> <span className="font-bold">{item.gstin}</span></div>}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Badge variant={item.status === 'Active' ? 'default' : 'secondary'} className={item.status === 'Active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none' : ''}>
                                    {item.status}
                                  </Badge>
                                  {item.has_pending_edit && (
                                    <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50 whitespace-nowrap" title="An edit to this record is awaiting admin approval">
                                      Edit pending
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right pr-6">
                                <div className="flex justify-end gap-2">
                                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={!canEditActiveTab} title={!canEditActiveTab ? "View Only" : "Edit Transporter"}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50" disabled={!canEditExisting} title={!canEditExisting ? "Admin Only" : "Delete Transporter"}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {/* Infinite Scroll Sentinel */}
                          <TableRow ref={driverEndRef}>
                            <TableCell colSpan={7} className="p-0 h-12 border-none">
                              {isFetchingNextTransport && (
                                <div className="flex items-center justify-center py-4 text-slate-400 bg-slate-50/20">
                                  <div className="flex gap-1.5 items-center bg-white px-4 py-1.5 rounded-full shadow-sm border border-slate-100">
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.3s]"></div>
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.15s]"></div>
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce"></div>
                                    <span className="text-xs font-medium ml-2 text-slate-500">Loading more transporters...</span>
                                  </div>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </table>
                </div>
              </div>
              </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {visibleTabs.includes("reference_data") && (
        <TabsContent value="reference_data">
          <ReferenceDataTab activeStates={activeStates} isMasterTabReadOnly={isMasterTabReadOnly} />
        </TabsContent>
        )}


      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {activeTab === 'sku_details'
                ? "This action cannot be undone. This will permanently delete the record from the database."
                : "This action cannot be undone. This will mark the record as Inactive and it will no longer appear in active lists."
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setIsDeleteDialogOpen(false); setDeletingItem(null); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90 transition-all shadow-md">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Record
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Approve with Review Dialog (shared for all tabs) */}
      <Dialog open={!!approvalReviewModal} onOpenChange={(open) => { if (!open) { setApprovalReviewModal(null); setApprovalEditData({}); resetForms() } }}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto" style={{ maxWidth: '750px' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-emerald-600" />
              Review & Approve
            </DialogTitle>
            <DialogDescription>
              Review the submitted values below. You can edit any field before approving. The final approved record will use these values.
            </DialogDescription>
          </DialogHeader>

          {approvalReviewModal && (
            <div className="grid gap-3 py-2">
              {renderProposedChanges()}
              {renderFormForTab(approvalReviewModal.tab)}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setApprovalReviewModal(null); setApprovalEditData({}); resetForms() }}>Cancel</Button>
            <Button
              onClick={() => {
                if (!approvalReviewModal) return
                // Every master reviews by the real serial id in v2 (the legacy
                // depot_id/broker_id text business codes are display-only now).
                const idMap: Record<string, any> = {
                  customers: approvalReviewModal.item.id,
                  depots: approvalReviewModal.item.id,
                  brokers: approvalReviewModal.item.id,
                  salespersons: approvalReviewModal.item.id,
                  ledger_groups: approvalReviewModal.item.id,
                  stock_groups: approvalReviewModal.item.id,
                  units: approvalReviewModal.item.id,
                  raw_materials: approvalReviewModal.item.id,
                  semi_finished_goods: approvalReviewModal.item.id,
                  insurance_details: approvalReviewModal.item.id,
                  conversion_formulas: approvalReviewModal.item.id,
                  price_levels: approvalReviewModal.item.id,
                  petrol_pumps: approvalReviewModal.item.id,
                  cd_rules: approvalReviewModal.item.id,
                  tds_rules: approvalReviewModal.item.id,
                  bhada_rates: approvalReviewModal.item.id,
                  sku_details: approvalReviewModal.item.id,
                  vehicle_master: approvalReviewModal.item.id,
                  driver_master: approvalReviewModal.item.id,
                  transport_master: approvalReviewModal.item.id,
                }
                // Submit the SAME per-tab Add/Edit form state the modal is bound to.
                handleReviewRecord(approvalReviewModal.tab, idMap[approvalReviewModal.tab], 'approve', undefined, getFormForTab(approvalReviewModal.tab))
              }}
              disabled={isReviewing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isReviewing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Record Dialog (shared for all tabs) */}
      <AlertDialog open={!!rejectDialogContext} onOpenChange={(open) => { if (!open) { setRejectDialogContext(null); setRejectionReason("") } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Record</AlertDialogTitle>
            <AlertDialogDescription>
              Optionally provide a reason. The record will not be used anywhere once rejected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-1 pb-2">
            <Input placeholder="Rejection reason (optional)" value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setRejectDialogContext(null); setRejectionReason("") }}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => rejectDialogContext && handleReviewRecord(rejectDialogContext.tab, rejectDialogContext.id, 'reject', rejectionReason)}
              className="bg-destructive text-white hover:bg-destructive/90 transition-all shadow-md"
              disabled={isReviewing}
            >
              {isReviewing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Quick Add Dialog (shared: inline "+" next to Unit/Ledger/SAC Code fields) */}
      <Dialog open={!!quickAddDialog} onOpenChange={(open) => { if (!open) setQuickAddDialog(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{quickAddDialog?.type === 'unit' ? 'Add Unit' : quickAddDialog?.type === 'ledger' ? 'Add Ledger' : quickAddDialog?.type === 'hsn_code' ? 'Add HSN Code' : 'Add SAC Code'}</DialogTitle>
            <DialogDescription>
              {quickAddDialog?.type === 'unit' ? 'Create a new Unit without leaving this form.' : quickAddDialog?.type === 'ledger' ? 'Create a new Ledger without leaving this form.' : quickAddDialog?.type === 'hsn_code' ? 'Create a new HSN Code without leaving this form.' : 'Create a new SAC Code without leaving this form.'}
            </DialogDescription>
          </DialogHeader>
          {quickAddDialog?.type === 'unit' ? (
            <div className="grid gap-4 py-2 px-1">
              <div className="space-y-2">
                <Label htmlFor="qa_unit_name">UOM *</Label>
                <Input id="qa_unit_name" value={quickAddForm.unit_name || ''} onChange={e => setQuickAddForm({ ...quickAddForm, unit_name: e.target.value })} placeholder="e.g. Kilograms" />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="qa_unit_is_active" checked={quickAddForm.status === 'Active'} onCheckedChange={checked => setQuickAddForm({ ...quickAddForm, status: checked === true ? 'Active' : 'Inactive' })} />
                <Label htmlFor="qa_unit_is_active" className="cursor-pointer">Is Active?</Label>
              </div>
            </div>
          ) : quickAddDialog?.type === 'ledger' ? (
            <div className="grid gap-4 py-2 px-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="qa_ledger_code">Ledger Code</Label>
                  <Input id="qa_ledger_code" value={quickAddForm.ledger_code || ''} readOnly className="bg-slate-100" placeholder="Auto-generated" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="qa_ledger_name">Ledger Name *</Label>
                  <Input id="qa_ledger_name" value={quickAddForm.ledger_name || ''} onChange={e => setQuickAddForm({ ...quickAddForm, ledger_name: e.target.value })} placeholder="e.g. Freight Charges" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="qa_ledger_group_id">Ledger Group</Label>
                <Select value={quickAddForm.ledger_group_id ? String(quickAddForm.ledger_group_id) : ''} onValueChange={val => setQuickAddForm({ ...quickAddForm, ledger_group_id: val })}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select ledger group" /></SelectTrigger>
                  <SelectContent>
                    {ledgerGroupOptions.map((g: any) => <SelectItem key={g.id} value={String(g.id)}>{g.group_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : quickAddDialog?.type === 'hsn_code' ? (
            <div className="grid gap-4 py-2 px-1">
              <div className="space-y-2">
                <Label htmlFor="qa_hsn_code">HSN Code (8 digits) *</Label>
                <Input id="qa_hsn_code" value={quickAddForm.code || ''} maxLength={8} onChange={e => setQuickAddForm({ ...quickAddForm, code: e.target.value.replace(/\D/g, '') })} placeholder="e.g. 73269099" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="qa_hsn_name">Description *</Label>
                <Input id="qa_hsn_name" value={quickAddForm.name || ''} onChange={e => setQuickAddForm({ ...quickAddForm, name: e.target.value })} placeholder="e.g. Test raw material" />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="qa_hsn_is_active" checked={quickAddForm.status === 'Active'} onCheckedChange={checked => setQuickAddForm({ ...quickAddForm, status: checked === true ? 'Active' : 'Inactive' })} />
                <Label htmlFor="qa_hsn_is_active" className="cursor-pointer">Is Active?</Label>
              </div>
            </div>
          ) : quickAddDialog?.type === 'sac_code' ? (
            <div className="grid gap-4 py-2 px-1">
              <div className="space-y-2">
                <Label htmlFor="qa_sac_code">SAC Code (6 digits) *</Label>
                <Input id="qa_sac_code" value={quickAddForm.code || ''} maxLength={6} onChange={e => setQuickAddForm({ ...quickAddForm, code: e.target.value.replace(/\D/g, '') })} placeholder="e.g. 996511" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="qa_sac_name">Description *</Label>
                <Input id="qa_sac_name" value={quickAddForm.name || ''} onChange={e => setQuickAddForm({ ...quickAddForm, name: e.target.value })} placeholder="e.g. Construction services" />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="qa_sac_is_active" checked={quickAddForm.status === 'Active'} onCheckedChange={checked => setQuickAddForm({ ...quickAddForm, status: checked === true ? 'Active' : 'Inactive' })} />
                <Label htmlFor="qa_sac_is_active" className="cursor-pointer">Is Active?</Label>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickAddDialog(null)} disabled={isQuickAdding}>Cancel</Button>
            <Button onClick={submitQuickAdd} disabled={isQuickAdding}>
              {isQuickAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <div className="flex items-center justify-center pt-12 border-t border-slate-100 opacity-100">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em] hover:text-primary transition-colors cursor-default">
          Powered by Botivate
        </p>
      </div>
    </div>
  )
}


