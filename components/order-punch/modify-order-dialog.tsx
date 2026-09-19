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
import { orderApi, customerApi, depotApi, brokerApi } from "@/lib/api-service"
import { fetchCustomerDropdownOptions, fetchDepotDropdownOptions } from "@/components/order-punch/customer-dropdown"
import { useStatesMap } from "@/hooks/use-states-map"
import { useCustomerAddresses, formatCustomerAddress, type CustomerAddressOption } from "@/hooks/use-customer-addresses"
import { cn } from "@/lib/utils"
import { FileText, MapPin, Receipt, Loader2 } from "lucide-react"

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

  const statesById = useStatesMap()
  const { addresses: addressOptions, hasMultiple: hasMultipleAddresses } = useCustomerAddresses(customerRecord?.id ?? null, statesById)

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
    setIsSaving(true)
    try {
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
        toast({ title: "Order updated", description: `${order.order_no} has been modified.` })
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
