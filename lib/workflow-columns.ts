export const ALL_WORKFLOW_COLUMNS = [
  { id: "products", label: "Items" },
  { id: "orderNo", label: "DO Number" },
  { id: "actual1Date", label: "Dispatched Date" },
  { id: "orderPunchRemarks", label: "Order Punch Remarks" },
  { id: "deliveryPurpose", label: "ORDER TYPE (DELIVERY PURPOSE)" },
  { id: "customerType", label: "Customer Type" },
  { id: "orderType", label: "ORDER TYPE" },
  { id: "partySoDate", label: "DO Date" },
  { id: "customerName", label: "Customer Name" },
  { id: "itemConfirm", label: "Item Confirm" },
  { id: "productName", label: "Product Name" },
  { id: "uom", label: "UOM" },
  { id: "orderQty", label: "Order Quantity" },
  { id: "altUom", label: "Alternate UOM" },
  { id: "altQty", label: "Alternate Qty (Kg)" },
  { id: "rate", label: "Rate" },
  { id: "oilType", label: "Oil Type" },
  { id: "ratePerLtr", label: "Rate Per Ltr" },
  { id: "ratePer15Kg", label: "Rate Per 15 kg" },
  { id: "rateOfMaterial", label: "Rate Of Material" },
  { id: "totalWithGst", label: "Total Amount With Gst" },
  { id: "transportType", label: "Type Of Transporting" },
  { id: "uploadSo", label: "Upload SO" },
  { id: "contactPerson", label: "Customer Contact Person Name" },
  { id: "whatsapp", label: "Customer Contact Person WhatsApp No." },
  { id: "address", label: "Customer Address" },
  { id: "paymentTerms", label: "Payments Terms" },
  { id: "advanceTaken", label: "Advance Payment to Be Taken" },
  { id: "advanceAmount", label: "Advance Amount" },
  { id: "isBroker", label: "Is This Order Through Broker" },
  { id: "brokerName", label: "Broker Name (IF ORDER THROUGH BROKER)" },
  { id: "deliveryDate", label: "Expected Delivery Date" },
  { id: "qtyToDispatch", label: "Qty to Dispatch" },
  { id: "deliveryFrom", label: "Delivery From" },
  { id: "processid", label: "Manual Sauda No." },
  { id: "party_credit_status", label: "Party Credit Status" },
  { id: "dispatch_date_confirmed", label: "Dispatch Date Confirmed" },
  { id: "overall_status_of_order", label: "Overall Status Of Order" },
  { id: "order_confirmation_with_customer", label: "Order Confirmation With Customer" },
  { id: "actual_approval_qty", label: "Actual Approval Qty" },
  { id: "dispatch_from", label: "Dispatch From" },
  { id: "dispatch_planning_user", label: "Dispatch Planning User" },
  { id: "revert_planning_remarks", label: "Revert Planning Remarks" },
  { id: "truck_no", label: "Truck No." },
  { id: "driver_name", label: "Driver Name" },
  { id: "driver_mobile_no", label: "Driver Mobile No." },
  { id: "transporter_name", label: "Transporter Name" },
  { id: "rst_no", label: "RST No." },
  { id: "gross_weight", label: "Gross Weight" },
  { id: "tare_weight", label: "Tare Weight" },
  { id: "net_weight", label: "Net Weight" },
  { id: "actual_qty", label: "Actual Qty" },
  { id: "material_load_user", label: "Material Load User" },
  { id: "weightment_slip_copy", label: "Weightment Slip Copy" },
  { id: "vehicle_no_plate_image", label: "Vehicle No Plate Image" },
  { id: "check_status", label: "Check Status" },
  { id: "vehicle_number", label: "Vehicle Number" },
  { id: "fitness", label: "Fitness" },
  { id: "insurance", label: "Insurance" },
  { id: "tax_copy", label: "Tax Copy" },
  { id: "polution", label: "Polution" },
  { id: "permit1", label: "Permit 1" },
  { id: "permit2_out_state", label: "Permit 2 Out State" },
  { id: "fitness_end_date", label: "Fitness End Date" },
  { id: "insurance_end_date", label: "Insurance End Date" },
  { id: "tax_end_date", label: "Tax End Date" },
  { id: "pollution_end_date", label: "Pollution End Date" },
  { id: "permit1_end_date", label: "Permit 1 End Date" },
  { id: "permit2_end_date", label: "Permit 2 End Date" },
  { id: "actual_qty_dispatch", label: "Actual Qty Dispatch" },
  { id: "actual_dispatch_user", label: "Actual Dispatch User" },
  { id: "extra_weight", label: "Extra Weight" },
  { id: "reason_of_difference_in_weight_if_any_speacefic", label: "Reason Of Difference In Weight" },
  { id: "bilty_no", label: "Bilty No." },
  { id: "bilty_image", label: "Bilty Image" },
  { id: "vehicle_image_attachemrnt", label: "Vehicle Image Attachment" },
  { id: "security_guard_status", label: "Security Guard Status" },
  { id: "security_guard_user", label: "Security Guard User" },
  { id: "revert_security_remarks", label: "Revert Security Remarks" },
  { id: "make_invoice_user", label: "Make Invoice User" },
  { id: "invoice_date", label: "Invoice Date" },
  { id: "invoice_copy", label: "Invoice Copy" },
  { id: "bill_type", label: "Bill Type" },
  { id: "bill_amount", label: "Bill Amount" },
  { id: "verification_status", label: "Verification Status" },
  { id: "gate_pass_copy", label: "Gate Pass Copy" },
  { id: "damage_qty", label: "Damage Qty" },
  { id: "damage_status", label: "Damage Status" },
  { id: "credit_note_no", label: "Credit Note No." },
  { id: "vehicleNo", label: "Vehicle No." },
  { id: "invoiceNo", label: "Invoice No." },
  { id: "status", label: "Status" },
]

const VEHICLE_DOC_COLUMN_IDS = new Set([
  "vehicle_number",
  "fitness",
  "insurance",
  "tax_copy",
  "polution",
  "permit1",
  "permit2_out_state",
  "fitness_end_date",
  "insurance_end_date",
  "tax_end_date",
  "pollution_end_date",
  "permit1_end_date",
  "permit2_end_date"
])

export const WORKFLOW_STAGE_COLUMNS = ALL_WORKFLOW_COLUMNS.filter(c => !VEHICLE_DOC_COLUMN_IDS.has(c.id))

/**
 * Workflow stage order (matches the sidebar / dispatch flow).
 * A stage's column toggle shows columns introduced at THIS stage + all earlier
 * stages, and never columns that only become relevant at a later stage.
 */
export const WORKFLOW_STAGE_ORDER = [
  "commitment-punch",
  "order-punch",
  "pre-approval",
  "approval-of-order",
  "dispatch-material",
  "material-load",
  "actual-dispatch",
  "security-approval",
  "make-invoice",
  "check-invoice",
  "gate-out",
  "material-receipt",
  "damage-adjustment",
] as const

export type WorkflowStageKey = typeof WORKFLOW_STAGE_ORDER[number]

/**
 * The stage at which each column first becomes relevant.
 * Columns not listed here are treated as always-available (shown at every stage).
 */
const COLUMN_STAGE: Record<string, WorkflowStageKey> = {
  // Order Punch — order creation, customer & product basics
  products: "order-punch",
  orderNo: "order-punch",
  orderPunchRemarks: "order-punch",
  deliveryPurpose: "order-punch",
  customerType: "order-punch",
  orderType: "order-punch",
  partySoDate: "order-punch",
  customerName: "order-punch",
  productName: "order-punch",
  uom: "order-punch",
  orderQty: "order-punch",
  altUom: "order-punch",
  altQty: "order-punch",
  rate: "order-punch",
  oilType: "order-punch",
  rateOfMaterial: "order-punch",
  transportType: "order-punch",
  uploadSo: "order-punch",
  contactPerson: "order-punch",
  whatsapp: "order-punch",
  address: "order-punch",
  paymentTerms: "order-punch",
  advanceTaken: "order-punch",
  advanceAmount: "order-punch",
  isBroker: "order-punch",
  brokerName: "order-punch",
  deliveryDate: "order-punch",
  status: "order-punch",

  // Pre Approval — approved rates
  ratePerLtr: "pre-approval",
  ratePer15Kg: "pre-approval",

  // Approval of Order
  itemConfirm: "approval-of-order",
  party_credit_status: "approval-of-order",
  dispatch_date_confirmed: "approval-of-order",
  overall_status_of_order: "approval-of-order",
  order_confirmation_with_customer: "approval-of-order",
  actual_approval_qty: "approval-of-order",

  // Dispatch Planning
  qtyToDispatch: "dispatch-material",
  deliveryFrom: "dispatch-material",
  processid: "dispatch-material",
  dispatch_from: "dispatch-material",
  dispatch_planning_user: "dispatch-material",
  revert_planning_remarks: "dispatch-material",

  // Material Load — truck / driver / transporter / RST / weights
  vehicleNo: "material-load",
  truck_no: "material-load",
  driver_name: "material-load",
  driver_mobile_no: "material-load",
  transporter_name: "material-load",
  rst_no: "material-load",
  gross_weight: "material-load",
  tare_weight: "material-load",
  net_weight: "material-load",
  actual_qty: "material-load",
  material_load_user: "material-load",
  weightment_slip_copy: "material-load",
  vehicle_no_plate_image: "material-load",

  // Actual Dispatch
  actual1Date: "actual-dispatch",
  actual_qty_dispatch: "actual-dispatch",
  actual_dispatch_user: "actual-dispatch",
  extra_weight: "actual-dispatch",
  reason_of_difference_in_weight_if_any_speacefic: "actual-dispatch",

  // Security Guard Approval
  bilty_no: "security-approval",
  bilty_image: "security-approval",
  vehicle_image_attachemrnt: "security-approval",
  security_guard_status: "security-approval",
  security_guard_user: "security-approval",
  revert_security_remarks: "security-approval",

  // Make Invoice
  make_invoice_user: "make-invoice",
  invoice_date: "make-invoice",
  invoice_copy: "make-invoice",
  bill_type: "make-invoice",
  bill_amount: "make-invoice",
  invoiceNo: "make-invoice",
  totalWithGst: "make-invoice",

  // Check Invoice
  verification_status: "check-invoice",
  check_status: "check-invoice",

  // Gate Out
  gate_pass_copy: "gate-out",

  // Damage Adjustment
  damage_qty: "damage-adjustment",
  damage_status: "damage-adjustment",
  credit_note_no: "damage-adjustment",
}

/**
 * Returns the columns available at a given workflow stage: every column
 * introduced at this stage or an earlier one, in canonical order, excluding
 * vehicle-doc columns. Unknown stage keys fall back to the full list.
 */
export function getColumnsUpToStage(stageKey: WorkflowStageKey | string) {
  const idx = WORKFLOW_STAGE_ORDER.indexOf(stageKey as WorkflowStageKey)
  if (idx === -1) return WORKFLOW_STAGE_COLUMNS
  const allowedStages = new Set(WORKFLOW_STAGE_ORDER.slice(0, idx + 1))
  return WORKFLOW_STAGE_COLUMNS.filter(c => {
    const stage = COLUMN_STAGE[c.id]
    return stage ? allowedStages.has(stage) : true
  })
}
