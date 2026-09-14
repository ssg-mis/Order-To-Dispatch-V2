// --- Master Tab Config & Shared Constants ---
// Centralised tab list, tab metadata, validation regex, and shared utility functions.

import { type ComponentType } from "react"
import {
  Users, Warehouse, Briefcase, Package, Truck, User, BookOpen, Layers,
  Ruler, FlaskConical, Factory, Shield, Calculator, Tag, Fuel, Percent,
  Landmark, Route, Droplet, List,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { TableCell } from "@/components/ui/table"
import type { CustomerAddress, CustomerBankAccount, PartyParityFields } from "@/types/master.types"

// --- Constants ---

export const STATUS_OPTIONS = ["Active", "Inactive"]

// Mirrors validators/customerValidator.js on the backend - the backend is the
// authoritative gate, this is purely for immediate UX feedback.
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
export const PINCODE_REGEX = /^[0-9]{6}$/
export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/
// Mirrors GODOWN_NAMES in services/customerService.js - the only 5 valid
// "Belongs to Which Godown" options.
export const GODOWN_NAMES = ['Banari', 'Ambikapur', 'Dallirajhara', 'Raigarh', 'Rajnandgaon']

export const normalizeGstField = (v: string) => v.trim().toUpperCase()

// --- Blank factory functions ---

export const blankCustomerAddress = (): CustomerAddress => ({
  address_line_1: "", address_line_2: "", city: "", post: "", thana: "",
  sub_district: "", district: "", state_id: null, pincode: "",
})

export const blankCustomerBankAccount = (): CustomerBankAccount => ({
  bank_name_id: null, account_holder_name: "", account_number: "", ifsc_code: "",
})

// Customer-Master field parity block (Phases 10/11/12/21) - the same blank
// defaults spread into Broker/Salesperson/Transport/PetrolPump form state.
export const blankPartyParityFields = (): PartyParityFields => ({
  state: "", state_id: null, pan: "", gstin: "",
  gst_registered: "", gst_registration_type: "", gst_registration_wef: "",
  msme_registration_no: "", msme_registration_type: "", msme_registration_wef: "",
  fssai_no: "", fssai_valid_upto: "", fssai_licence_type: "",
  aadhaar_upload: "", pan_upload: "", gst_certificate_upload: "", msme_certificate_upload: "", fssai_certificate_upload: "",
})

// --- Tab Config ---

export const ALL_MASTER_TABS = [
  "customers", "depots", "brokers", "salespersons",
  "sku_details", "sku_selling_price", "vehicle_master", "driver_master", "transport_master",
  "ledger_groups", "stock_groups", "units", "raw_materials", "semi_finished_goods",
  "insurance_details", "conversion_formulas", "price_levels", "petrol_pumps", "cd_rules",
  "tds_rules", "oil_tags", "bhada_rates",
  "reference_data"
]

export const TAB_META: Record<string, { label: string; icon: ComponentType<{ className?: string }>; desc: string }> = {
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
  tds_rules: { label: "TDS", icon: Landmark, desc: "Manage statutory TDS rules, threshold limits, rates, guiding rules, and effective dates" },
  oil_tags: { label: "Oil Tags", icon: Droplet, desc: "Manage dynamic oil types and tags" },
  bhada_rates: { label: "Bhada Rate", icon: Route, desc: "Freight/Bhada rate placeholder — minimum fields only, pending client scoping" },
  sku_details: { label: "Finished Goods", icon: Package, desc: "Manage your Finished Goods list and product details" },
  sku_selling_price: { label: "Pricing", icon: Package, desc: "Manage SKU selling prices and rates" },
  vehicle_master: { label: "Vehicles", icon: Truck, desc: "Manage your vehicle database and documents" },
  driver_master: { label: "Drivers", icon: User, desc: "Manage your driver records and documents" },
  transport_master: { label: "Transporters", icon: Truck, desc: "Manage your transporter records and details" },
  reference_data: { label: "Reference Data", icon: List, desc: "Manage lookup references for master records" },
}

// --- Shared Doc Utility Functions (used by VehicleMasterTable + page.tsx) ---

export const formatDocDate = (dateStr?: string) => {
  if (!dateStr) return "—"
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

export const renderDocBadge = (label: string, image?: string, expiry?: string) => {
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

export const renderDocCell = (expiry?: string, image?: string, type?: string) => {
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
