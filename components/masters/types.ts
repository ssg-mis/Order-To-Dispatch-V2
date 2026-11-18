import { ComponentType } from "react"
import {
  Users,
  Warehouse,
  Briefcase,
  BookOpen,
  BookText,
  Layers,
  Ruler,
  FlaskConical,
  Factory,
  Shield,
  Calculator,
  Tag,
  Fuel,
  Percent,
  Landmark,
  Droplet,
  Route,
  Package,
  Truck,
  User,
  List
} from "lucide-react"

// --- Types ---

export interface Customer {
  id: number
  customer_id: string
  customer_name: string
  status: string
  contact_person: string
  contact: string
  email: string
  address_line_1: string
  address_line_2: string
  city?: string
  post?: string
  thana?: string
  district?: string
  sub_district?: string
  state: string
  state_id?: number | null
  pincode: string
  pan: string
  gstin: string
  gst_registered: string
  gst_status?: string
  gst_registration_type?: string | null
  gst_registration_wef?: string | null
  msme_registration_no?: string | null
  msme_registration_type?: string | null
  msme_registration_wef?: string | null
  msme_activity_type?: string
  msme_status?: string
  fssai_no?: string | null
  fssai_registration_wef?: string | null
  fssai_valid_upto?: string | null
  fssai_licence_type?: string | null
  aadhaar_number?: string | null
  aadhaar_upload?: string | null
  pan_upload?: string | null
  gst_certificate_upload?: string | null
  msme_certificate_upload?: string | null
  fssai_certificate_upload?: string | null
  addresses?: CustomerAddress[]
  primary_address_status?: string // Active / Inactive status of the Primary Address
  godown_ids?: number[]
  is_required_for_commitment?: string
  bank_accounts?: CustomerBankAccount[]
  ledger_group_id?: number | string | null
}

export interface PartyParityFields {
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
  aadhaar_number?: string | null
  aadhaar_upload?: string | null
  pan_upload?: string | null
  gst_certificate_upload?: string | null
  msme_certificate_upload?: string | null
  fssai_certificate_upload?: string | null
}

export interface Depot {
  id: number
  depot_id: string
  status: string
  depot_name: string
  depot_address: string
  state: string
  state_id?: number | null
  district?: string | null
  sub_district?: string | null
  thana?: string | null
  post?: string | null
  city?: string | null
  pincode?: string | null
  assigned_to?: number | null // customer id this depot is assigned to
  salesman_broker_name: string
  agent_tags?: { agent_type: 'broker' | 'salesperson'; agent_id: number }[]
  agreement_paper_upload?: string
  depot_owner_gst_certificate_upload?: string
  pan_card_upload?: string
  aadhaar_card_upload?: string
}

export interface Broker extends PartyParityFields {
  id: number
  broker_id: string
  status: string
  salesman_name: string
  email_id: string
  mobile_no: string
  depot_name: string
  depot_id: string
  ledger_group_id?: number | string | null
}

export interface Salesperson extends PartyParityFields {
  id: number
  broker_id: string
  status: string
  salesman_name: string
  email_id: string
  mobile_no: string
  depot_name: string
  depot_id: string
  ledger_group_id?: number | string | null
  employee_id?: string | null
}

export interface LedgerGroup {
  id: number
  group_code: string
  group_name: string
  status: string
  is_system: boolean
}

export interface StockGroup {
  id: number
  group_code: string
  group_name: string
  status: string
  is_system: boolean
}

export interface Unit {
  id: number
  unit_code: string
  unit_name: string
  short_name?: string | null
  decimal_places?: number
  uqc_id?: number | null
  uqc_code?: string | null
  uqc_name?: string | null
  status: string
}

export interface Ledger {
  id: number
  ledger_code: string
  ledger_name: string
  ledger_group_id: number | null
  status: string
}

export interface RawMaterialAdditionalUom {
  id?: number
  uom_id: number | string
  conversion_ratio: number | string
}

export interface RawMaterial {
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

export interface SkuDetail {
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

export interface SkuSellingPrice {
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

export interface Vehicle {
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

export interface Driver {
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

export interface Transport extends PartyParityFields {
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

export interface CustomerAddress {
  id?: number
  status?: string // Active / Inactive (Inactive addresses are not offered for new orders)
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

export interface CustomerBankAccount {
  id?: number
  bank_name_id?: number | null
  account_holder_name?: string
  account_number?: string
  ifsc_code?: string
  status?: "Active" | "Inactive"
}

// --- Constants & Defaults ---

export const STATUS_OPTIONS = ["Active", "Inactive"]

export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
export const PINCODE_REGEX = /^[0-9]{6}$/
export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/
export const GODOWN_NAMES = ['Banari', 'Ambikapur', 'Dallirajhara', 'Raigarh', 'Rajnandgaon']

export const normalizeGstField = (v: string) => v.trim().toUpperCase()

export const blankCustomerAddress = (): CustomerAddress => ({
  address_line_1: "", address_line_2: "", city: "", post: "", thana: "",
  sub_district: "", district: "", state_id: null, pincode: "", status: "Active",
})

export const blankCustomerBankAccount = (): CustomerBankAccount => ({
  bank_name_id: null, account_holder_name: "", account_number: "", ifsc_code: "",
})

export const blankPartyParityFields = (): PartyParityFields => ({
  state: "", state_id: null, pan: "", gstin: "",
  gst_registered: "", gst_registration_type: "", gst_registration_wef: "",
  msme_registration_no: "", msme_registration_type: "", msme_registration_wef: "",
  fssai_no: "", fssai_registration_wef: "", fssai_valid_upto: "", fssai_licence_type: "",
  aadhaar_upload: "", pan_upload: "", gst_certificate_upload: "", msme_certificate_upload: "", fssai_certificate_upload: "",
})

export const ALL_MASTER_TABS = [
  "customers", "depots", "brokers", "salespersons",
  "sku_details", "sku_selling_price", "vehicle_master", "driver_master", "transport_master",
  "ledger_groups", "ledgers", "stock_groups", "units", "raw_materials", "semi_finished_goods",
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
  ledgers: { label: "Ledgers", icon: BookText, desc: "Accounting heads for order charges, fuel stations and default ledgers" },
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

export const formatDocDate = (dateStr?: string) => {
  if (!dateStr) return "—"
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}
