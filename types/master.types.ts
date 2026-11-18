// --- Master Data Types ---
// Centralised type definitions for all Master module entities.

export interface CustomerAddress {
  id?: number
  status?: string // Active / Inactive
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
  primary_address_status?: string
  godown_ids?: number[]
  is_required_for_commitment?: string
  bank_accounts?: CustomerBankAccount[]
  ledger_group_id?: number | string | null
}

// Customer-Master field parity fields (Phases 10/11/12/21, review Sections
// 6/7/8/19) - the exact same set as Customer's GST/MSME/FSSAI/uploads block,
// mixed into Broker/Salesperson/Transport/PetrolPump below.
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
  id: number // real serial PK (v2) — all mutations key off this
  depot_id: string // legacy text business code, display-only
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

export interface Salesperson extends PartyParityFields {
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
