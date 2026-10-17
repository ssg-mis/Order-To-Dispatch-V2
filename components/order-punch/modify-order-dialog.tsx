"use client"

/**
 * Order Punch's Modify flow (Section 4/9): edits an order's HEADER fields only
 * (customer, depot, broker, manual sauda no, remarks, expected delivery date,
 * address, payment terms, transport) via the existing PUT /orders/update/:id.
 * Line items (SKU/qty/rate) are intentionally not editable here - those are
 * owned by the stage services (Pre-Approval/Approval of Order), not Order
 * Punch's own update endpoint (see UPDATABLE_ORDER_FIELDS on the backend).
 * Only ever opened when the order's Stage 3 rollup is "Required Modification".
 */

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AsyncCombobox } from "@/components/ui/async-combobox"
import { useToast } from "@/hooks/use-toast"
import { orderApi, customerApi, depotApi, brokerApi, skuApi } from "@/lib/api-service"
import { fetchCustomerDropdownOptions, fetchDepotDropdownOptions } from "@/components/order-punch/customer-dropdown"
import { useStatesMap } from "@/hooks/use-states-map"
import { useCustomerAddresses, formatCustomerAddress, type CustomerAddressOption } from "@/hooks/use-customer-addresses"
import { cn } from "@/lib/utils"
import { fmtNum } from "@/lib/table-format"
import { resolveStateName, gstSupplyTypeOf } from "@/lib/gst-state"
import { LedgerChargesEditor, incompleteChargeIndex, validCharges, chargesTotal, newChargeRow, type ChargeRow } from "@/components/order-punch/ledger-charges-editor"
import { FileText, MapPin, Receipt, Loader2, Plus, Trash2 } from "lucide-react"

interface ModifyOrderDialogProps {
  order: any
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

export function ModifyOrderDialog({ order, open, onOpenChange, onSaved }: ModifyOrderDialogProps) {
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)

  const [depotRecord, setDepotRecord] = useState<any>(null)
  const [customerRecord, setCustomerRecord] = useState<any>(null)
  const [customerComboValue, setCustomerComboValue] = useState("")
  const [brokers, setBrokers] = useState<any[]>([])
  const [brokerId, setBrokerId] = useState<string>("")

  const [partySoDate, setPartySoDate] = useState("")
  const [manualSaudaNo, setManualSaudaNo] = useState("")
  const [remarks, setRemarks] = useState("")
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("")
  const [paymentTerms, setPaymentTerms] = useState("")
  const [transportType, setTransportType] = useState("")
  const [advancePaymentTaken, setAdvancePaymentTaken] = useState<"YES" | "NO">("NO")
  const [advanceAmount, setAdvanceAmount] = useState("")
  const [customerAddress, setCustomerAddress] = useState("")
  const [deliveryAddress, setDeliveryAddress] = useState("")
  const [sameAsCustomerAddress, setSameAsCustomerAddress] = useState(true)
  const [selectedAddressId, setSelectedAddressId] = useState<"default" | number>("default")

  // Editable order items. `id` is the order_item id (absent for a line added here).
  type ItemRow = { key: string; id?: number; skuId?: number; skuName: string; qty: string; rate: string }
  const [itemRows, setItemRows] = useState<ItemRow[]>([])
  const [originalItems, setOriginalItems] = useState<string>("")
  const [skuList, setSkuList] = useState<any[]>([])
  const newKey = () => Math.random().toString(36).slice(2, 10)
  const normalizeItems = (rows: ItemRow[]) => JSON.stringify(rows.map((r) => ({ id: r.id ?? null, skuId: r.skuId ?? null, qty: String(r.qty), rate: String(r.rate) })))
  const itemsChanged = itemRows.length > 0 && normalizeItems(itemRows) !== originalItems
  const [chargeRows, setChargeRows] = useState<ChargeRow[]>([])
  const [originalCharges, setOriginalCharges] = useState("")
  const normalizeCharges = (rows: ChargeRow[]) => JSON.stringify(validCharges(rows).map((r) => [r.ledgerId, String(parseFloat(r.amount))]))
  const chargesChanged = normalizeCharges(chargeRows) !== originalCharges

  const statesById = useStatesMap()
  const { addresses: addressOptions, hasMultiple: hasMultipleAddresses } = useCustomerAddresses(customerRecord?.id ?? null, statesById)

  // GST breakdown (indicative, same maths as Add Order): taxable = rate x nos-per-main-uom x qty.
  const [gstRatePercent, setGstRatePercent] = useState("5")
  const skuOf = (skuId?: number) => skuList.find((s: any) => s.id === skuId)
  const billingState = resolveStateName(depotRecord, statesById)
  // ship-to state from the MASTER (selected saved address, else the customer record) - not parsed from text
  const pickedShipAddress = addressOptions.find((a: CustomerAddressOption) => a.id === selectedAddressId)
  const shippingState = pickedShipAddress?.stateName || resolveStateName(customerRecord, statesById)
  // Same / Other State comes only from the masters; null (a state is missing) means nothing is assumed.
  const gstSupplyType = gstSupplyTypeOf(billingState, shippingState)
  // Nothing to detect yet (no customer / depot picked) is not a master-data problem.
  const gstWaitingFor = !(customerRecord) ? "customer" : !(depotRecord) ? "depot" : null
  const numericGstRate = parseFloat(gstRatePercent) || 0
  const halfRate = numericGstRate / 2
  const totalQty = itemRows.reduce((n, r) => n + (parseFloat(r.qty) || 0), 0)
  const totalWeight = itemRows.reduce((n, r) => n + (parseFloat(skuOf(r.skuId)?.sku_weight) || 0) * (parseFloat(r.qty) || 0), 0)
  const totalTaxable = itemRows.reduce(
    (n, r) => n + (parseFloat(r.rate) || 0) * (parseFloat(skuOf(r.skuId)?.nos_per_main_uom) || 0) * (parseFloat(r.qty) || 0),
    0
  )
  const taxableWithCharges = totalTaxable + chargesTotal(chargeRows)
  // Ledger charges add to the taxable value but carry no GST of their own - same rule as Approval of Order.
  const orderCgst = totalTaxable * (halfRate / 100)
  const orderSgst = totalTaxable * (halfRate / 100)
  const orderIgst = totalTaxable * (numericGstRate / 100)
  const totalGstAmount = gstSupplyType === null ? 0 : gstSupplyType === "INTRA" ? orderCgst + orderSgst : orderIgst
  const orderRawTotal = taxableWithCharges + totalGstAmount
  const orderRoundedTotal = Math.round(orderRawTotal)
  const orderRoundOff = orderRoundedTotal - orderRawTotal


  // Initialize every field from the order whenever the dialog opens.
  useEffect(() => {
    if (!open || !order) return
    let cancelled = false
    setIsInitializing(true)
    setPartySoDate(order.party_so_date ? String(order.party_so_date).slice(0, 10) : "")
    setManualSaudaNo(order.manual_sauda_no || "")
    setRemarks(order.order_punch_remarks || "")
    setExpectedDeliveryDate(order.delivery_date ? String(order.delivery_date).slice(0, 10) : "")
    setPaymentTerms(order.payment_terms || "")
    setTransportType(order.type_of_transporting || "")
    setAdvancePaymentTaken(order.advance_payment_to_be_taken ? "YES" : "NO")
    setAdvanceAmount(order.advance_amount != null ? String(order.advance_amount) : "")
    setCustomerAddress(order.customer_address || "")
    const shipSameAsBill = (order.customer_delivery_address || "") === (order.customer_address || "")
    setSameAsCustomerAddress(shipSameAsBill)
    setDeliveryAddress(order.customer_delivery_address || "")
    setSelectedAddressId("default")
    setBrokerId(order.broker_id ? String(order.broker_id) : "")
    const rows: ItemRow[] = (order.items || []).map((it: any) => ({
      key: newKey(),
      id: it.id,
      skuId: it.sku_id,
      skuName: it.sku_name || "",
      qty: it.order_quantity != null ? String(parseFloat(it.order_quantity)) : "",
      rate: it.rate_of_material != null ? String(parseFloat(it.rate_of_material)) : "",
    }))
    setItemRows(rows)
    setOriginalItems(normalizeItems(rows))
    const cRows: ChargeRow[] = (order.charges || []).map((c: any) => ({
      key: newChargeRow().key,
      ledgerId: c.ledger_id,
      ledgerName: c.ledger_name || "",
      amount: c.amount != null ? String(parseFloat(c.amount)) : "",
    }))
    setChargeRows(cRows)
    setOriginalCharges(normalizeCharges(cRows))

    if (order.depot_id) {
      setDepotRecord({ id: order.depot_id, depot_name: order.depot_name })
    }
    if (order.customer_id) {
      setCustomerRecord({ id: order.customer_id, customer_name: order.customer_name })
      setCustomerComboValue(order.customer_name || "")
    }

    Promise.all([
      order.depot_id ? depotApi.getById(order.depot_id).catch(() => null) : Promise.resolve(null),
      order.customer_id ? customerApi.getById(order.customer_id).catch(() => null) : Promise.resolve(null),
      brokerApi.getAll({ all: "true" }).catch(() => null),
    ]).then(([depotRes, customerRes, brokerRes]: any[]) => {
      if (cancelled) return
      if (depotRes?.success && depotRes.data) setDepotRecord(depotRes.data)
      if (customerRes?.success && customerRes.data) {
        setCustomerRecord(customerRes.data)
        setCustomerComboValue(`${customerRes.data.customer_name}|${customerRes.data.gstin || ""}|${customerRes.data.id}`)
      }
      if (brokerRes?.success) setBrokers(brokerRes.data.brokers || brokerRes.data || [])
    }).finally(() => { if (!cancelled) setIsInitializing(false) })

    return () => { cancelled = true }
  }, [open, order])

  useEffect(() => {
    if (!open || skuList.length > 0) return
    skuApi.getAll({ all: "true" }).then((res: any) => {
      if (res?.success) setSkuList(res.data?.skuDetails || res.data?.skus || [])
    }).catch(() => {})
  }, [open, skuList.length])

  useEffect(() => {
    if (sameAsCustomerAddress) setDeliveryAddress(customerAddress)
  }, [sameAsCustomerAddress, customerAddress])

  useEffect(() => {
    const picked = addressOptions.find((a: CustomerAddressOption) => a.id === selectedAddressId)
    if (picked) setCustomerAddress(formatCustomerAddress(picked))
  }, [selectedAddressId, addressOptions])

  const handleDepoChange = async (depotName: string) => {
    const res = await depotApi.getAll({ search: depotName, all: "true", limit: 10 })
    const match = (res?.data?.depots || []).find((d: any) => d.depot_name === depotName)
    setDepotRecord(match || null)
    // Re-validate the currently selected customer against the new depot, same
    // gating rule as the create form.
    if (match && customerRecord) {
      const check = await customerApi.getAll({ search: customerRecord.customer_name, depot_id: match.id, limit: 10 })
      const list = check?.data?.customers || []
      const stillValid = list.some((c: any) => c.id === customerRecord.id)
      if (!stillValid) {
        setCustomerRecord(null)
        setCustomerComboValue("")
        toast({ title: "Customer cleared", description: "The previously selected customer isn't tagged to this Godown.", variant: "destructive" })
      }
    }
  }

  const handleSave = async () => {
    if (!order) return
    if (!customerRecord) {
      toast({ title: "Customer required", description: "Please select a customer.", variant: "destructive" })
      return
    }
    const unfinishedCharge = incompleteChargeIndex(chargeRows)
    if (unfinishedCharge !== -1) {
      toast({ title: "Finish the ledger charge", description: `Additional charge ${unfinishedCharge + 1} needs both a ledger and an amount (or remove it).`, variant: "destructive" })
      return
    }
    // Item changes are validated and saved first; they send the order back for re-approval.
    if (itemsChanged) {
      for (const [i, r] of itemRows.entries()) {
        if (!r.skuId) { toast({ title: "Product required", description: `Select a product for item ${i + 1}.`, variant: "destructive" }); return }
        if (!(parseFloat(r.qty) > 0)) { toast({ title: "Quantity required", description: `Enter a quantity greater than 0 for item ${i + 1}.`, variant: "destructive" }); return }
        if (!(parseFloat(r.rate) >= 0) || r.rate === "") { toast({ title: "Rate required", description: `Enter a rate for item ${i + 1}.`, variant: "destructive" }); return }
      }
    }
    setIsSaving(true)
    try {
      const chargesPayload = validCharges(chargeRows).map((r) => ({ ledgerId: r.ledgerId, amount: parseFloat(r.amount) }))
      if (!itemsChanged && chargesChanged) {
        // ledger charges only: replace them, nothing else is touched
        const chRes = await orderApi.updateItems(order.id, undefined, chargesPayload)
        if (!chRes?.success) {
          toast({ title: "Charges not saved", description: chRes?.message || "Could not update the ledger charges.", variant: "destructive" })
          setIsSaving(false)
          return
        }
      }
      if (itemsChanged) {
        const itemRes = await orderApi.updateItems(order.id, itemRows.map((r) => ({
          id: r.id,
          sku_id: r.skuId,
          order_quantity: parseFloat(r.qty),
          rate_of_material: parseFloat(r.rate),
        })), chargesChanged ? chargesPayload : undefined)
        if (!itemRes?.success) {
          toast({ title: "Items not saved", description: itemRes?.message || "Could not update the items.", variant: "destructive" })
          setIsSaving(false)
          return
        }
      }
      const patch: Record<string, any> = {
        customerId: customerRecord.id,
        depotId: depotRecord?.id ?? null,
        brokerId: brokerId ? Number(brokerId) : null,
        partySoDate: partySoDate || null,
        manualSaudaNo: manualSaudaNo || null,
        orderPunchRemarks: remarks || null,
        deliveryDate: expectedDeliveryDate || null,
        customerAddress: customerAddress || null,
        customerDeliveryAddress: (sameAsCustomerAddress ? customerAddress : deliveryAddress) || null,
        paymentTerms: paymentTerms || null,
        typeOfTransporting: transportType || null,
        advancePaymentToBeTaken: advancePaymentTaken === "YES",
        advanceAmount: advanceAmount ? parseFloat(advanceAmount) : null,
      }
      const res = await orderApi.update(order.id, patch)
      if (res.success) {
        toast({ title: "Order updated", description: itemsChanged ? `${order.order_no} was modified and sent back to Approval of Order.` : `${order.order_no} has been modified.` })
        onOpenChange(false)
        onSaved()
      } else {
        toast({ title: "Error", description: res.message || "Failed to update order.", variant: "destructive" })
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to update order.", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[95vw] min-h-[580px] max-h-[90vh] overflow-y-auto p-4 sm:p-6"
        style={{ maxWidth: '1250px' }}
      >
        <DialogHeader className="pb-3 border-b border-slate-200">
          <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span>Modify Order</span>
            <span className="font-mono text-blue-600 font-black">{order?.order_no}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 mt-0.5">
            Update customer, delivery details, broker, or commercial terms for this order.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Section 1: Order & Party Details */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
              <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
                <FileText className="h-4.5 w-4.5 text-blue-600" />
                <span>Order &amp; Customer Details</span>
              </Label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {/* Dispatch From */}
              <div className="space-y-1.5">
                <Label htmlFor="modifyDepot" className="text-xs font-semibold text-slate-800">Dispatch From (Depot) *</Label>
                <AsyncCombobox
                  placeholder="Select Depo"
                  searchPlaceholder="Search depots..."
                  value={depotRecord?.depot_name || ""}
                  onValueChange={handleDepoChange}
                  fetchOptions={(search, page) => fetchDepotDropdownOptions(search, page)}
                />
              </div>

              {/* Customer Name */}
              <div className="space-y-1.5">
                <Label htmlFor="modifyCustomer" className="text-xs font-semibold text-slate-800">Customer Name *</Label>
                <AsyncCombobox
                  placeholder={!depotRecord ? "Select a Godown first" : "Select customer"}
                  disabled={!depotRecord}
                  searchPlaceholder="Search by name, city, state, GST, mobile or contact person..."
                  value={customerComboValue}
                  onValueChange={setCustomerComboValue}
                  onSelectOption={(opt: any) => {
                    if (opt?.original) {
                      setCustomerRecord(opt.original)
                      if (opt.original.billing_address) {
                        setCustomerAddress(opt.original.billing_address)
                      }
                    } else if (!opt) {
                      setCustomerRecord(null)
                    }
                  }}
                  fetchOptions={(search, page) => fetchCustomerDropdownOptions(search, page, depotRecord?.id)}
                />
              </div>

              {/* Broker */}
              <div className="space-y-1.5">
                <Label htmlFor="modifyBroker" className="text-xs font-semibold text-slate-800">Broker</Label>
                <Select value={brokerId || "NONE"} onValueChange={(v) => setBrokerId(v === "NONE" ? "" : v)}>
                  <SelectTrigger id="modifyBroker"><SelectValue placeholder="No broker" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">No Broker</SelectItem>
                    {brokers.map((b: any) => (
                      <SelectItem key={b.id} value={String(b.id)}>{b.broker_name || b.salesman_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* DO Date */}
              <div className="space-y-1.5">
                <Label htmlFor="modifyDoDate" className="text-xs font-semibold text-slate-800">DO Date</Label>
                <Input id="modifyDoDate" type="date" value={partySoDate} onChange={(e) => setPartySoDate(e.target.value)} />
              </div>

              {/* Manual Sauda No. */}
              <div className="space-y-1.5">
                <Label htmlFor="modifyManualSauda" className="text-xs font-semibold text-slate-800">Manual Sauda No.</Label>
                <Input id="modifyManualSauda" value={manualSaudaNo} onChange={(e) => setManualSaudaNo(e.target.value)} placeholder="Enter manual sauda no" />
              </div>

              {/* Expected Delivery Date */}
              <div className="space-y-1.5">
                <Label htmlFor="modifyDeliveryDate" className="text-xs font-semibold text-slate-800">Expected Delivery Date</Label>
                <Input id="modifyDeliveryDate" type="date" value={expectedDeliveryDate} onChange={(e) => setExpectedDeliveryDate(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Section 2: Address Details */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
              <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
                <MapPin className="h-4.5 w-4.5 text-blue-600" />
                <span>Address Details</span>
              </Label>
            </div>
            {hasMultipleAddresses && (
              <div className="space-y-1.5">
                <Label htmlFor="modifyAddressSelect" className="text-xs font-semibold text-slate-800">Saved Addresses</Label>
                <Select value={String(selectedAddressId)} onValueChange={(v) => setSelectedAddressId(v === "default" ? "default" : Number(v))}>
                  <SelectTrigger id="modifyAddressSelect">
                    <SelectValue placeholder="Select an address" />
                  </SelectTrigger>
                  <SelectContent>
                    {addressOptions.map((a) => (
                      <SelectItem key={String(a.id)} value={String(a.id)}>{a.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="modifyCustomerAddress" className="text-xs font-semibold text-slate-800">Customer Address</Label>
                <Input
                  id="modifyCustomerAddress"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Enter customer address"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="modifyDeliveryAddress" className="text-xs font-semibold text-slate-800">Delivery Address</Label>
                  <div className="flex items-center space-x-1.5">
                    <Checkbox id="modifySameAsCustomer" checked={sameAsCustomerAddress} onCheckedChange={(c) => setSameAsCustomerAddress(c as boolean)} />
                    <Label htmlFor="modifySameAsCustomer" className="text-xs font-normal cursor-pointer text-slate-600">Same as Customer Address</Label>
                  </div>
                </div>
                <Input
                  id="modifyDeliveryAddress"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  readOnly={sameAsCustomerAddress}
                  className={cn(sameAsCustomerAddress ? "bg-slate-100" : "")}
                  placeholder="Enter delivery address"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Commercial Terms & Remarks */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
              <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
                <Receipt className="h-4.5 w-4.5 text-blue-600" />
                <span>Commercial &amp; Payment Terms</span>
              </Label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="modifyTransportType" className="text-xs font-semibold text-slate-800">Transport Type</Label>
                <Select value={transportType || "self"} onValueChange={setTransportType}>
                  <SelectTrigger id="modifyTransportType"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="self">FOR</SelectItem>
                    <SelectItem value="others">EX-Depot</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="modifyPaymentTerms" className="text-xs font-semibold text-slate-800">Payment Terms</Label>
                <Select value={paymentTerms || "7days"} onValueChange={setPaymentTerms}>
                  <SelectTrigger id="modifyPaymentTerms"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="advance">Advance</SelectItem>
                    <SelectItem value="7days">7 Days After Delivery</SelectItem>
                    <SelectItem value="delivery">On Delivery</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="modifyAdvancePayment" className="text-xs font-semibold text-slate-800">Advance Payment to Be Taken</Label>
                <Select value={advancePaymentTaken} onValueChange={(v) => setAdvancePaymentTaken(v as "YES" | "NO")}>
                  <SelectTrigger id="modifyAdvancePayment"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NO">NO</SelectItem>
                    <SelectItem value="YES">YES</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {advancePaymentTaken === "YES" && (
                <div className="space-y-1.5">
                  <Label htmlFor="modifyAdvanceAmount" className="text-xs font-semibold text-slate-800">Advance Amount (₹)</Label>
                  <Input id="modifyAdvanceAmount" type="number" value={advanceAmount} onChange={(e) => setAdvanceAmount(e.target.value)} placeholder="0.00" />
                </div>
              )}
            </div>

            <div className="space-y-1.5 pt-1">
              <Label htmlFor="modifyRemarks" className="text-xs font-semibold text-slate-800">Remarks</Label>
              <Textarea
                id="modifyRemarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
                placeholder="Enter remarks"
              />
            </div>
          </div>
        </div>

        {/* Order items: editable. Saving item changes sends the order back to Approval of Order. */}
        {itemRows.length > 0 && (
          <div className="mt-2 space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="flex items-center gap-2 text-base font-bold text-slate-900">
                <FileText className="h-4 w-4 text-blue-600" />
                Order Items
                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">{itemRows.length}</span>
              </Label>
              <span className="text-[11px] text-slate-500">
                {itemsChanged ? "Item changes will send this order back to Approval of Order." : "Change a product, quantity or rate, or add / remove items."}
              </span>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-3 py-2.5 text-left">Product</th>
                    <th className="w-36 px-3 py-2.5 text-right">Order Qty</th>
                    <th className="w-36 px-3 py-2.5 text-right">Rate (₹)</th>
                    <th className="w-12 px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {itemRows.map((r) => (
                    <tr key={r.key} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-2 min-w-[280px]">
                        <AsyncCombobox
                          placeholder="Select product"
                          searchPlaceholder="Search products..."
                          value={r.skuName}
                          onValueChange={() => {}}
                          onSelectOption={(opt: any) => {
                            if (opt?.original) {
                              setItemRows((rows) => rows.map((x) => (x.key === r.key ? { ...x, skuId: opt.original.id, skuName: opt.original.sku_name } : x)))
                            }
                          }}
                          fetchOptions={async (search: string, page: number) => {
                            const q = (search || "").toLowerCase().trim()
                            const list = skuList.filter((s: any) => !q || (s.sku_name || "").toLowerCase().includes(q))
                            const size = 20
                            const slice = list.slice((page - 1) * size, page * size)
                            return {
                              options: slice.map((s: any) => ({ value: s.sku_name, label: s.sku_name, original: s })),
                              hasMore: page * size < list.length,
                            }
                          }}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          className="text-right font-mono tabular-nums"
                          value={r.qty}
                          onChange={(e) => setItemRows((rows) => rows.map((x) => (x.key === r.key ? { ...x, qty: e.target.value } : x)))}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          className="text-right font-mono tabular-nums"
                          value={r.rate}
                          onChange={(e) => setItemRows((rows) => rows.map((x) => (x.key === r.key ? { ...x, rate: e.target.value } : x)))}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          title={itemRows.length === 1 ? "An order needs at least one item" : "Remove item"}
                          disabled={itemRows.length === 1}
                          onClick={() => setItemRows((rows) => rows.filter((x) => x.key !== r.key))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 bg-white"
              onClick={() => setItemRows((rows) => [...rows, { key: newKey(), skuName: "", qty: "", rate: "" }])}
            >
              <Plus className="h-3.5 w-3.5" />
              Add item
            </Button>

            <LedgerChargesEditor rows={chargeRows} onChange={setChargeRows} />

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Order Weight (KG)</p>
                <p className="text-sm font-bold text-blue-700">{fmtNum(totalWeight, 3)}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Order Qty</p>
                <p className="text-sm font-bold text-blue-700">{fmtNum(totalQty, 3)}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Taxable Amount (₹)</p>
                <p className="text-sm font-bold text-blue-700">{fmtNum(taxableWithCharges, 2)}</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">GST Breakdown (Indicative)</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-500">GST Rate:</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={gstRatePercent}
                    onChange={(e) => setGstRatePercent(e.target.value)}
                    placeholder="5"
                    className="h-5 w-14 rounded border border-slate-300 bg-white px-1 text-right font-mono text-[11px] font-bold text-blue-700 focus:outline-none"
                  />
                  <span className="text-[10px] font-bold text-slate-600">%</span>
                </div>
              </div>
              <div className="ml-auto max-w-sm space-y-2 p-4 text-xs">
                {/* Same / Other State is auto-detected from the Depot and Customer masters */}
                <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", gstSupplyType === null ? (gstWaitingFor ? "bg-slate-100 text-slate-600" : "bg-red-100 text-red-700") : gstSupplyType === "INTRA" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
  {gstSupplyType === null ? (gstWaitingFor ? `Select ${gstWaitingFor}` : "State unknown") : gstSupplyType === "INTRA" ? "Same State" : "Other State"}
</span>
                    <span className="font-medium text-slate-600">
                      {billingState || "—"} <span className="text-slate-400">→</span> {shippingState || "—"}
                    </span>
                  </div>
                  {(!billingState || !shippingState) && (
  <p className={cn("mt-1 text-[10px] font-medium", gstWaitingFor ? "text-slate-500" : "text-red-600")}>
    {gstWaitingFor ? `Select the ${gstWaitingFor} to detect Same / Other State.` : null}
    {!gstWaitingFor && <>
    {!billingState ? "Depot" : "Customer"} state is not set in Master (no state, State Master link or GSTIN), so GST cannot be calculated. Update it in Master to see the breakdown.</>}
</p>
)}
                </div>
                {gstSupplyType === null ? (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-slate-500">CGST / SGST / IGST (₹)</span>
                    <span className="font-mono font-bold text-slate-400">—</span>
                  </div>
                ) : gstSupplyType === "INTRA" ? (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="font-black uppercase text-slate-500 text-[10px]">CGST ({halfRate.toFixed(1)}%) (₹)</span>
                      <span className="font-mono font-bold text-slate-700">{fmtNum(orderCgst, 2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-black uppercase text-slate-500 text-[10px]">SGST ({halfRate.toFixed(1)}%) (₹)</span>
                      <span className="font-mono font-bold text-slate-700">{fmtNum(orderSgst, 2)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between items-center">
                    <span className="font-black uppercase text-slate-500 text-[10px]">IGST ({numericGstRate.toFixed(1)}%) (₹)</span>
                    <span className="font-mono font-bold text-slate-700">{fmtNum(orderIgst, 2)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="font-black uppercase text-slate-500 text-[10px]">Round Off (₹)</span>
                  <span className="font-mono font-bold text-slate-500">
                    {gstSupplyType === null ? "—" : `${orderRoundOff >= 0 ? "+" : "-"}${fmtNum(Math.abs(orderRoundOff), 2)}`}
                  </span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-200 pt-2 mt-1">
                  <span className="font-black uppercase text-slate-800 text-[11px]">Total Order Value (₹)</span>
                  <span className="font-mono font-black text-blue-700 text-sm">{gstSupplyType === null ? "—" : fmtNum(orderRoundedTotal, 2)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="pt-3 border-t border-slate-200 mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isInitializing} className="bg-primary hover:bg-primary/90 min-w-[130px]">
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSaving ? "Saving..." : "Update Details"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
