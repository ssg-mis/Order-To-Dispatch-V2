/**
 * v2 response adapter.
 *
 * The v2 backend returns each workflow-stage row as NESTED objects
 * ({ order, orderItem, customer, depot, sku, dispatch, <gate> … }) with camelCase
 * keys. The existing stage pages were built against the old flat snake_case rows
 * (order_no, party_name, product_name, rate_of_material, …). Rather than rewrite
 * ~25k lines of page/table/modal/PDF code (untestable right now), this module
 * flattens each v2 row back into the flat snake_case shape the pages already
 * render, and maps submit payloads the other way.
 *
 * The read path is a generic merge of the nested objects (snake-cased) plus an
 * explicit alias table for the handful of names that don't convert mechanically
 * (rate_per_15kg, depo_name, remaining_dispatch_qty, so_no, party_name, …). Every
 * `id` used by a page to submit is set to the correct v2 key per stage.
 */

// camelCase → snake_case (does NOT split digit boundaries, so ratePer15kg →
// rate_per15kg — those cases are fixed by the alias table below).
function snakeify(obj: any): Record<string, any> {
  if (!obj || typeof obj !== 'object') return {};
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k.replace(/([A-Z])/g, '_$1').toLowerCase()] = v;
  }
  return out;
}

// Merge every nested sub-object present on a v2 row into one flat row. Earlier
// assignments win over later nulls; per-stage id/planned/actual are set by the
// callers, so sub-object `id`/`planned_at` collisions here are harmless.
function mergeNested(row: any): Record<string, any> {
  const merged: Record<string, any> = {};
  const assign = (o: any) => {
    for (const [k, v] of Object.entries(snakeify(o))) {
      if (merged[k] === undefined || merged[k] === null) merged[k] = v;
    }
  };
  // Order the "identity" objects first so their fields aren't shadowed.
  assign(row.orderItem);
  assign(row.order);
  assign(row.customer);
  assign(row.depot);
  assign(row.sku);
  assign(row.broker);
  assign(row.salesperson);
  assign(row.vehicle);
  assign(row.driver);
  assign(row.transporter);
  // Gate objects (only one is present per stage).
  assign(row.dispatch);
  assign(row.securityCheck);
  assign(row.invoice);
  assign(row.gateOut);
  assign(row.materialReceipt);
  assign(row.damageAdjustment);
  return merged;
}

// The shared field contract every stage page reads (customer/order/item/sku/
// depot/broker), regardless of gate. Aliases here cover the non-mechanical name
// differences and legacy names (so_no, party_name, depo_name, …).
function base(row: any): Record<string, any> {
  const r = mergeNested(row);
  const oi = row.orderItem || {};
  const o = row.order || {};
  const c = row.customer || {};
  const d = row.depot || {};
  const s = row.sku || {};
  const b = row.broker || {};
  const sp = row.salesperson || {};
  const dsp = row.dispatch || {};

  // Order header
  r.order_no = o.orderNo ?? r.order_no ?? null;
  r.so_no = o.orderNo ?? null; // legacy lift_receiving_confirmation name
  r.order_type = o.orderType ?? null;
  r.order_category = o.orderCategory ?? null;
  r.customer_type = o.customerType ?? null;
  r.order_type_delivery_purpose = o.deliveryPurpose ?? null;
  r.is_order_through = o.orderThrough ?? null;
  r.is_order_through_broker = o.orderThrough === 'Broker' || o.orderThrough === 'Salesperson';
  r.party_so_date = o.partySoDate ?? null;
  r.start_date = o.startDate ?? null;
  r.end_date = o.endDate ?? null;
  r.delivery_date = o.deliveryDate ?? null;
  r.future_period_date = o.futurePeriodDate ?? null;
  r.customer_contact_person_name = o.customerContactPersonName ?? null;
  r.customer_contact_person_whatsapp_no = o.customerContactPersonWhatsappNo ?? null;
  r.customer_address = o.customerAddress ?? null;
  r.customer_delivery_address = o.customerDeliveryAddress ?? null;
  r.payment_terms = o.paymentTerms ?? null;
  r.advance_payment_to_be_taken = o.advancePaymentToBeTaken ?? null;
  r.advance_amount = o.advanceAmount ?? null;
  r.type_of_transporting = o.typeOfTransporting ?? null;
  r.freight_rate = o.freightRate ?? null;
  r.bill_company_name = o.billCompanyName ?? null;
  r.bill_address = o.billAddress ?? null;
  r.ship_company_name = o.shipCompanyName ?? null;
  r.ship_address = o.shipAddress ?? null;
  // Per-shipment stages carry the real flag on the dispatch row; earlier
  // stages (pre-approval/order-approval/dispatch-planning, no dispatch yet)
  // fall back to the billCompanyName heuristic.
  r.transfer = dsp.isTransfer !== undefined
    ? (dsp.isTransfer ? 'yes' : 'no')
    : (o.billCompanyName ? 'yes' : (r.transfer ?? null));
  r.processid = o.manualSaudaNo ?? null;
  r.manual_sauda_no = o.manualSaudaNo ?? null;
  r.order_punch_remarks = o.orderPunchRemarks ?? null;
  r.upload_so = o.uploadSo ?? null;
  r.upload_copy = o.uploadCopy ?? null;
  r.gst = o.gst ?? null;

  // Customer / depot / broker / salesperson
  r.customer_name = c.customerName ?? null;
  r.party_name = c.customerName ?? null; // legacy name
  r.depo_name = d.depotName ?? null;
  r.depot_name = d.depotName ?? null;
  r.depot_address = d.depotAddress ?? null;
  r.broker_name = b.brokerName ?? null;
  r.salesperson_name = sp.salespersonName ?? null;

  // SKU + line item quantities/rates
  r.sku_name = s.skuName ?? null;
  r.product_name = s.skuName ?? null; // legacy name
  r.nos_per_main_uom = s.nosPerMainUom ?? null;
  r.oil_type = oi.oilType ?? null;
  r.uom = oi.uom ?? s.mainUom ?? null;
  r.alternate_uom = oi.alternateUom ?? s.alternateUom ?? null;
  r.order_quantity = oi.orderQuantity ?? null;
  r.approval_qty = oi.approvedQty ?? null;
  r.approved_qty = oi.approvedQty ?? null;
  r.remaining_dispatch_qty = oi.remainingQty ?? null;
  r.remaining_qty = oi.remainingQty ?? null;
  r.preclose_qty = oi.precloseQty ?? null;
  r.rate_of_material = oi.rateOfMaterial ?? null;
  r.final_rate = oi.finalRate ?? null;
  r.rate_per_15kg = oi.ratePer15kg ?? null;
  r.rate_per_ltr = oi.ratePerLtr ?? null;

  // Useful stable ids (never the ambiguous merged `id`).
  r.order_id = o.id ?? null;
  r.order_item_id = oi.id ?? null;

  // Doer (who performed each stage) — only present when the list query joined
  // `users` for that stage (see orderDispatchService.js/orderApprovalService.js).
  if (row.orderPunchUser !== undefined) r.order_punch_user = row.orderPunchUser;
  // Explicit key (not the generic merged `created_at`, which a split order_item's
  // own created_at would shadow — orderItem merges first in mergeNested above).
  if (row.orderCreatedAt !== undefined) r.order_punch_at = row.orderCreatedAt ?? null;

  return r;
}

/* ─────────────────────────  per-stage read flatteners  ───────────────────── */

// Pre-Approval / Order-Approval / Dispatch-Planning are per ORDER ITEM: submit
// key (`id`) = order_item id.
export function flattenOrderItemStage(row: any): Record<string, any> {
  const r = base(row);
  r.id = row.orderItem?.id ?? null;

  // Own-gate timestamps, keyed to whichever gate this row actually belongs to
  // (Pre-Approval / Order-Approval / Dispatch-Planning all reuse `plannedAt`/
  // `actualAt` as generic column names) so they land under the right
  // FIELD_GROUPS level instead of always being labeled "Pre-Approval".
  if (row.dispatchPlanningId !== undefined) {
    r.planned_3 = row.plannedAt ?? null;
    r.actual_3 = row.actualAt ?? null;
  } else if (row.orderApprovalId !== undefined) {
    r.planned_2 = row.plannedAt ?? null;
    r.actual_2 = row.actualAt ?? null;
  } else {
    r.planned_1 = row.plannedAt ?? null;
    r.actual_1 = row.actualAt ?? null;
  }

  // Rolled-up earlier-gate timestamps — present only when the list query for
  // this stage also joined that earlier gate (so downstream history dialogs
  // show the real Pre-Approval / Order-Approval times, not this stage's own).
  if (row.preApprovalPlannedAt !== undefined) r.planned_1 = row.preApprovalPlannedAt ?? null;
  if (row.preApprovalActualAt !== undefined) r.actual_1 = row.preApprovalActualAt ?? null;
  if (row.orderApprovalPlannedAt !== undefined) r.planned_2 = row.orderApprovalPlannedAt ?? null;
  if (row.orderApprovalActualAt !== undefined) r.actual_2 = row.orderApprovalActualAt ?? null;

  // Order-Approval checklist / status passthroughs.
  if (row.overallStatus !== undefined) r.overall_status_of_order = row.overallStatus;
  if (row.rateIsRightlyAsPerCurrentMarketRate !== undefined) r.rate_is_rightly_as_per_current_market_rate = row.rateIsRightlyAsPerCurrentMarketRate;
  if (row.weAreDealingInOrderedSku !== undefined) r.we_are_dealing_in_ordered_sku = row.weAreDealingInOrderedSku;
  if (row.partyCreditStatus !== undefined) r.party_credit_status = row.partyCreditStatus;
  if (row.dispatchDateConfirmed !== undefined) r.dispatch_date_confirmed = row.dispatchDateConfirmed;
  if (row.orderConfirmationWithCustomer !== undefined) r.order_confirmation_with_customer = row.orderConfirmationWithCustomer;
  if (row.revertRemarks !== undefined) r.revert_planning_remarks = row.revertRemarks;
  if (row.hasPriorDispatch !== undefined) r.has_prior_dispatch = row.hasPriorDispatch;
  if (row.preApprovalUser !== undefined) r.pre_approval_user = row.preApprovalUser;
  if (row.orderApprovalUser !== undefined) r.order_approval_user = row.orderApprovalUser;
  if (row.dispatchPlanningUser !== undefined) r.dispatch_planning_user = row.dispatchPlanningUser;
  // Set when this line was reopened by a "revert to Dispatch Planning" split
  // and has no approval row of its own — the names above were resolved from
  // the nearest ancestor it split from (see stageUtils.resolveInheritedApproval).
  if (row.approvalInherited !== undefined) r.approval_inherited = row.approvalInherited;
  return r;
}

// Actual Dispatch is per SHIPMENT: submit key = dispatch id.
export function flattenDispatchStage(row: any): Record<string, any> {
  const r = base(row);
  const dsp = row.dispatch || {};
  r.id = dsp.id ?? null;
  r.dispatch_id = dsp.id ?? null;
  r.d_sr_number = dsp.dsrNumber ?? null;
  r.qty_to_be_dispatched = dsp.qtyToBeDispatched ?? null;
  r.actual_qty_dispatch = dsp.actualQtyDispatch ?? null;
  r.actual_qty = dsp.actualQty ?? null;
  r.planned_1 = dsp.plannedAt ?? null;
  r.actual_1 = dsp.actualAt ?? null;
  if (row.hasPriorDispatch !== undefined) r.has_prior_dispatch = row.hasPriorDispatch;
  // Earlier-gate audit trail — the dispatch slip/voucher printout's
  // Pre-Approve / Approve By block reads these (order_punch_at/_user come
  // through base() already).
  if (row.preApprovalUser !== undefined) r.pre_approval_user = row.preApprovalUser;
  if (row.preApprovalActualAt !== undefined) r.pre_approval_at = row.preApprovalActualAt ?? null;
  if (row.orderApprovalUser !== undefined) r.order_approval_user = row.orderApprovalUser;
  if (row.orderApprovalActualAt !== undefined) r.order_approval_at = row.orderApprovalActualAt ?? null;
  // Set when this line was reopened by a "revert to Dispatch Planning" split
  // and has no approval row of its own — the names above were resolved from
  // the nearest ancestor it split from (see stageUtils.resolveInheritedApproval).
  if (row.approvalInherited !== undefined) r.approval_inherited = row.approvalInherited;
  return r;
}

// Security Guard: submit key = security_guard_checks id.
export function flattenSecurityStage(row: any): Record<string, any> {
  const r = base(row);
  const dsp = row.dispatch || {};
  const chk = row.securityCheck || {};
  r.id = chk.id ?? null;
  r.security_check_id = chk.id ?? null;
  r.dispatch_id = dsp.id ?? null;
  r.d_sr_number = dsp.dsrNumber ?? null;
  r.planned_1 = dsp.plannedAt ?? null;
  r.actual_1 = dsp.actualAt ?? null;
  r.planned_4 = chk.plannedAt ?? null;
  r.actual_4 = chk.actualAt ?? null;
  r.security_guard_status = chk.verdictStatus ?? null;
  r.bilty_no = chk.biltyNo ?? null;
  r.bilty_image = chk.biltyImage ?? null;
  return r;
}

// Make/Check Invoice: submit key = invoices id.
export function flattenInvoiceStage(row: any): Record<string, any> {
  const r = base(row);
  const dsp = row.dispatch || {};
  const inv = row.invoice || {};
  r.id = inv.id ?? null;
  r.invoice_id = inv.id ?? null;
  r.dispatch_id = dsp.id ?? null;
  r.d_sr_number = dsp.dsrNumber ?? null;
  r.planned_1 = dsp.plannedAt ?? null;
  r.actual_1 = dsp.actualAt ?? null;
  r.lrc_actual_1 = dsp.actualAt ?? null;
  r.bill_type = inv.billType ?? null;
  r.invoice_no = inv.invoiceNo ?? null;
  r.invoice_date = inv.invoiceDate ?? null;
  r.invoice_copy = inv.invoiceCopy ?? null;
  r.qty = inv.qty ?? null;
  r.bill_amount = inv.billAmount ?? null;
  r.status_1 = inv.status ?? null;
  r.remarks_2 = inv.checkRemarks ?? null;
  r.planned_5 = inv.plannedMadeAt ?? null;
  r.actual_5 = inv.madeAt ?? null;
  r.planned_6 = inv.plannedCheckedAt ?? null;
  r.actual_6 = inv.checkedAt ?? null;
  return r;
}

// Gate Out: submit key = gate_outs id.
export function flattenGateOutStage(row: any): Record<string, any> {
  const r = base(row);
  const dsp = row.dispatch || {};
  const g = row.gateOut || {};
  r.id = g.id ?? null;
  r.gate_out_id = g.id ?? null;
  r.dispatch_id = dsp.id ?? null;
  r.d_sr_number = dsp.dsrNumber ?? null;
  r.planned_1 = dsp.plannedAt ?? null;
  r.actual_1 = dsp.actualAt ?? null;
  r.lrc_actual_1 = dsp.actualAt ?? null;
  r.gate_pass_copy = g.gatePassCopy ?? null;
  r.vehicle_loaded_image = g.vehicleLoadedImage ?? null;
  r.planned_7 = g.plannedAt ?? null;
  r.actual_7 = g.actualAt ?? null;
  return r;
}

// Confirm Material Receipt: submit key = material_receipts id.
export function flattenMaterialReceiptStage(row: any): Record<string, any> {
  const r = base(row);
  const dsp = row.dispatch || {};
  const mr = row.materialReceipt || {};
  r.id = mr.id ?? null;
  r.material_receipt_id = mr.id ?? null;
  r.dispatch_id = dsp.id ?? null;
  r.d_sr_number = dsp.dsrNumber ?? null;
  r.planned_1 = dsp.plannedAt ?? null;
  r.actual_1 = dsp.actualAt ?? null;
  r.material_received_date = mr.materialReceivedDate ?? null;
  r.received_image_proof = mr.receivedImageProof ?? null;
  r.damage_status = mr.damageStatus ?? null;
  r.damage_qty = mr.damageQty ?? null;
  r.damage_image = mr.damageImage ?? null;
  r.remarks_3 = mr.remarks ?? null;
  r.planned_8 = mr.plannedAt ?? null;
  r.actual_8 = mr.actualAt ?? null;
  return r;
}

// Damage Adjustment: submit key = damage_adjustments id.
export function flattenDamageStage(row: any): Record<string, any> {
  const r = base(row);
  const dsp = row.dispatch || {};
  const da = row.damageAdjustment || {};
  r.id = da.id ?? null;
  r.damage_adjustment_id = da.id ?? null;
  r.dispatch_id = dsp.id ?? null;
  r.d_sr_number = dsp.dsrNumber ?? null;
  r.planned_1 = dsp.plannedAt ?? null;
  r.actual_1 = dsp.actualAt ?? null;
  r.status_2 = da.status ?? null;
  r.credit_note_date = da.creditNoteDate ?? null;
  r.credit_note_no = da.creditNoteNo ?? null;
  r.credit_note_copy = da.creditNoteCopy ?? null;
  r.credit_note_qty = da.creditNoteQty ?? null;
  r.credit_note_amount = da.creditNoteAmount ?? null;
  r.net_banalce = da.netBalance ?? null; // legacy misspelling kept for the page
  r.net_balance = da.netBalance ?? null;
  r.planned_9 = da.plannedAt ?? null;
  r.actual_9 = da.actualAt ?? null;
  return r;
}

// Apply a flattener to a { data: { <listKey>: [...] } } response in place,
// leaving pagination and everything else untouched.
export function adaptList(res: any, listKey: string, flatten: (row: any) => any): any {
  const arr = res?.data?.[listKey];
  if (Array.isArray(arr)) {
    res.data[listKey] = arr.map(flatten);
  }
  return res;
}
