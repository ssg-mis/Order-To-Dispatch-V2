"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CheckCircle2, ChevronDown, ChevronUp, ClipboardList, ExternalLink, FileText, Loader2, Package, RotateCcw, ShieldCheck, XCircle } from "lucide-react"
import { approvalApi } from "@/lib/api-service"
import { isStaleWriteError } from "@/lib/stale-write"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { fmtNum, fmtAmount } from "@/lib/table-format"
import { fmtWeight } from "@/lib/weight-format"
import { useWeightDecimals } from "@/hooks/use-weight-decimals"

type ApprovalAction = "approve" | "reject" | "modify"

interface ApprovalDetailDialogProps {
  orderId: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmitted: () => void
}

const CHECK_ITEMS = [
  { id: "rate", label: "Rate Right?" },
  { id: "sku", label: "We Deal in SKU?" },
  { id: "credit", label: "Credit OK?" },
  { id: "dispatch", label: "Dispatch Confirmed?" },
  { id: "confirm", label: "Customer Confirmation?" },
] as const

const fmtMoney = (v: number | null | undefined) => {
  const n = Number(v || 0)
  return fmtAmount(n, 2)
}
const fmtDate = (v: string | null | undefined) => {
  if (!v) return "—"
  const d = new Date(v)
  if (isNaN(d.getTime())) return String(v)
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export function ApprovalDetailDialog({ orderId, open, onOpenChange, onSubmitted }: ApprovalDetailDialogProps) {
  const wd = useWeightDecimals()
  const { toast } = useToast()
  const { user, isReadOnly } = useAuth()
  const queryClient = useQueryClient()

  const [detailsExpanded, setDetailsExpanded] = useState(true)
  const [remarks, setRemarks] = useState("")
  const [manualSaudaNo, setManualSaudaNo] = useState("")
  const [dispatchFrom, setDispatchFrom] = useState("in-stock")
  const [checklist, setChecklist] = useState<Record<string, "approve" | "reject">>({
    rate: "approve", sku: "approve", credit: "approve", dispatch: "approve", confirm: "approve",
  })
  const [charges, setCharges] = useState<Array<{ ledgerId: number | null; ledgerName: string; amount: string }>>([])
  const [deselected, setDeselected] = useState<Set<number>>(new Set())
  const [submittingAction, setSubmittingAction] = useState<ApprovalAction | null>(null)

  const { data: detail, isLoading } = useQuery({
    queryKey: ["approval-order-detail", orderId],
    queryFn: async () => {
      const res = await approvalApi.getByOrderId(orderId as number)
      return res.success ? res.data : null
    },
    enabled: open && orderId != null,
    staleTime: 0,
  })

  // Reset form state whenever a different order is opened.
  useEffect(() => {
    if (!open) return
    setDetailsExpanded(true)
    setRemarks("")
    setDeselected(new Set())
    setManualSaudaNo(detail?.order?.manualSaudaNo || "")
    setDispatchFrom(detail?.dispatchFrom || "in-stock")
    setChecklist({ rate: "approve", sku: "approve", credit: "approve", dispatch: "approve", confirm: "approve" })
    setCharges(
      (detail?.charges || []).map((c: any) => ({ ledgerId: c.ledgerId, ledgerName: c.ledgerName || "", amount: String(c.amount ?? "") }))
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orderId, detail?.order?.id])

  const tax = detail?.tax
  const items = detail?.items || []
  // KGF = SKU master net weight per main unit x ordered qty (same rule as the Order Punch form); unknown weight -> null
  const kgs: (number | null)[] = items.map((it: any) => {
    const w = Number(it.sku?.skuWeight)
    const q = Number(it.orderItem?.orderQuantity)
    return w > 0 && q > 0 ? w * q : null
  })
  const totalKgs = kgs.reduce((n: number, k, i) => n + (!deselected.has(items[i]?.orderItem?.id) ? k || 0 : 0), 0)
  // One rate across all items -> show it next to the tax label (e.g. CGST @ 2.5%); mixed rates -> label only.
  const gstRates = Array.from(new Set<number>((tax?.itemLines || []).map((l: any) => Number(l.gstPercent) || 0)))
  const gstRate = gstRates.length === 1 ? gstRates[0] : null
  const rateTag = (divisor: number) => (gstRate == null ? "" : ` @ ${fmtNum(gstRate / divisor, 2)}%`)

  // Live preview combining the server-computed item tax lines with whatever
  // charge rows are currently being edited (not yet saved) - so the totals
  // footer updates as the approver adds/edits a charge, without a round trip.
  const isSelected = (idx: number) => !deselected.has(items[idx]?.orderItem?.id)
  const selectedCount = items.filter((_: any, i: number) => isSelected(i)).length
  const toggleItem = (id: number) =>
    setDeselected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const toggleAll = () => setDeselected(selectedCount === items.length ? new Set(items.map((it: any) => it.orderItem.id)) : new Set())

  // Totals follow the ticked items; ledger charges belong to the order and always count.
  const previewTotals = useMemo(() => {
    if (!tax) return null
    const lines = (tax.itemLines || []).filter((_: any, i: number) => !deselected.has(items[i]?.orderItem?.id))
    const sum = (k: string) => lines.reduce((s: number, l: any) => s + (Number(l[k]) || 0), 0)
    const itemsTaxable = sum("taxableValue")
    const chargesTaxable = charges.reduce((s, c) => s + (Number(c.amount) || 0), 0)
    const totalTaxableValue = itemsTaxable + chargesTaxable
    const cgst = sum("cgst")
    const sgst = sum("sgst")
    const igst = sum("igst")
    const preRound = totalTaxableValue + cgst + sgst + igst
    const grandTotal = Math.round(preRound)
    const roundingOff = +(grandTotal - preRound).toFixed(2)
    return { totalTaxableValue, cgst, sgst, igst, roundingOff, grandTotal }
  }, [tax, charges, deselected, items])

  const handleSubmit = async (action: ApprovalAction) => {
    if (!detail || !orderId) return
    if (action !== "approve" && remarks.trim().length === 0) {
      toast({ title: "Remarks required", description: "Remarks are mandatory when rejecting or requesting modification.", variant: "destructive" })
      return
    }

    setSubmittingAction(action)
    try {
      const overallStatus = action === "approve" ? true : action === "modify" ? "Required Modification" : false
      const approvalData = {
        overallStatus,
        rateIsRightlyAsPerCurrentMarketRate: checklist.rate === "approve",
        weAreDealingInOrderedSku: checklist.sku === "approve",
        partyCreditStatus: checklist.credit === "approve",
        dispatchDateConfirmed: checklist.dispatch === "approve",
        orderConfirmationWithCustomer: checklist.confirm === "approve",
        manualSaudaNo: manualSaudaNo || null,
        remarks: remarks.trim() || null,
        dispatchFrom,
        userId: user?.id || null,
      }

      // Ledger charges come from Order Punch and are not edited here, so nothing is re-saved.

      const chosen = items.filter((it: any) => !deselected.has(it.orderItem.id))
      if (chosen.length === 0) {
        toast({ title: "No item selected", description: "Tick at least one item to continue.", variant: "destructive" })
        return
      }
      const results = await Promise.allSettled(
        chosen.map((it: any) => approvalApi.submit(it.orderItem.id, approvalData))
      )
      const failed = results.filter((r) => r.status === "rejected")
      if (failed.length > 0) {
        const first = (failed[0] as PromiseRejectedResult).reason
        if (isStaleWriteError(first)) {
          toast({ title: "Already processed", description: "This order was already updated elsewhere. Refreshing the list.", variant: "destructive" })
        } else {
          toast({ title: "Some items failed", description: first?.message || "Please retry.", variant: "destructive" })
        }
      } else {
        toast({
          title: action === "approve" ? "Approved" : action === "modify" ? "Sent for modification" : "Rejected",
          description: action === "approve" ? "Order approved — moved to Dispatch Planning." : undefined,
        })
      }

      queryClient.invalidateQueries({ queryKey: ["approval-pending"] })
      onSubmitted()
      onOpenChange(false)
    } catch (error: any) {
      toast({ title: "Submit failed", description: error?.message || "Please try again.", variant: "destructive" })
    } finally {
      setSubmittingAction(null)
    }
  }

  const order = detail?.order
  const customer = detail?.customer
  const depot = detail?.depot
  const broker = detail?.broker

  return (
    <Dialog open={open} onOpenChange={(v) => !submittingAction && onOpenChange(v)}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-0.75rem)] max-w-[calc(100vw-0.75rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl lg:max-w-6xl">
        {/* Header: order number, who it is for, and what it is worth */}
        <DialogHeader className="min-w-0 flex-row items-center justify-between gap-4 space-y-0 border-b bg-linear-to-r from-primary/10 via-primary/5 to-transparent px-5 py-4 text-left sm:px-6">
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/25">
              <ClipboardList className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="break-words text-lg font-extrabold leading-tight tracking-tight text-slate-900 sm:text-xl">
                {order?.orderNo || "Order Approval"}
              </DialogTitle>
              <DialogDescription className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-slate-500">
                <span className="font-semibold text-slate-700">{customer?.customerName || "Review order & item details"}</span>
                {order?.orderType && <span className="rounded-full bg-primary/10 px-2 py-px text-[10px] font-bold uppercase tracking-wide text-primary">{order.orderType}</span>}
                {depot?.depotName && <span>· {depot.depotName}</span>}
              </DialogDescription>
            </div>
          </div>
          {detail && (
            <div className="mr-8 hidden shrink-0 text-right sm:block">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Order value</p>
              <p className="font-mono text-xl font-black tabular-nums text-primary">₹ {fmtMoney(previewTotals?.grandTotal)}</p>
            </div>
          )}
        </DialogHeader>

        {isLoading || !detail ? (
          <div className="flex flex-1 items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {/* Order details - collapsible */}
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setDetailsExpanded((v) => !v)}
                className="flex w-full items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-left"
                aria-label={detailsExpanded ? "Collapse order details" : "Expand order details"}
              >
                <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary"><FileText className="h-3.5 w-3.5" /></span>
                  Order Details
                </span>
                {detailsExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </button>
              {detailsExpanded && (
                <div className="grid grid-cols-2 gap-x-6 gap-y-3.5 p-4 text-sm sm:grid-cols-3 lg:grid-cols-4">
                  <Field label="Customer Name" value={customer?.customerName} />
                  <Field label="Dispatch From (Depot)" value={depot?.depotName} />
                  <Field label="Delivery Purpose" value={order?.deliveryPurpose} />
                  <Field label="Order Category" value={order?.orderCategory} />
                  <Field label="Order Type" value={order?.orderType} />
                  <Field label="DO Date" value={fmtDate(order?.partySoDate)} />
                  <Field label="Start Date" value={fmtDate(order?.startDate)} />
                  <Field label="End Date" value={fmtDate(order?.endDate)} />
                  <Field label="Delivery Date" value={fmtDate(order?.deliveryDate)} />
                  <Field label="Transport Type" value={order?.typeOfTransporting} />
                  <Field label="Contact Person" value={order?.customerContactPersonName} />
                  <Field label="WhatsApp No." value={order?.customerContactPersonWhatsappNo} />
                  <Field label="Payment Terms" value={order?.paymentTerms} />
                  <Field label="Advance Amount (₹)" value={fmtMoney(order?.advanceAmount)} />
                  <Field label="Broker" value={broker?.brokerName || "—"} />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Dispatch From</p>
                    <Select value={dispatchFrom} onValueChange={setDispatchFrom}>
                      <SelectTrigger className="mt-1 h-9 w-full bg-white text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="in-stock">In Stock</SelectItem>
                        <SelectItem value="production">Production</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Manual Sauda No.</p>
                    <Input value={manualSaudaNo} onChange={(e) => setManualSaudaNo(e.target.value)} className="mt-1 h-9 bg-white text-sm" placeholder="Enter manual sauda no..." />
                  </div>
                  <div className="col-span-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Order Punch Remarks</p>
                    <p className="mt-0.5 font-medium text-slate-900">{order?.orderPunchRemarks || "—"}</p>
                  </div>
                  {order?.uploadSo && (
                    <div className="col-span-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">PO Copy Attachment</p>
                      <a href={order.uploadSo} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-1 font-medium text-primary hover:underline">
                        <FileText className="h-3.5 w-3.5" /> View Attachment <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Items, ledger charges and totals - each item is shown once */}
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary"><Package className="h-3.5 w-3.5" /></span>
                  Order Items &amp; Invoice
                </span>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                  {selectedCount === items.length ? `${items.length} item${items.length === 1 ? "" : "s"}` : `${selectedCount} of ${items.length} items`}{totalKgs > 0 ? ` · ${fmtWeight(totalKgs, wd)} KGF` : ""}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-primary/5 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                      <th className="w-10 py-2.5 pl-4 pr-0">
                        <Checkbox
                          checked={selectedCount === items.length ? true : selectedCount === 0 ? false : "indeterminate"}
                          onCheckedChange={toggleAll}
                          aria-label="Select all items"
                        />
                      </th>
                      <th className="px-3 py-2.5 text-left">Product / SKU</th>
                      <th className="px-3 py-2.5 text-right">Qty<span className="ml-1 inline-block w-10" /></th>
                      <th className="px-3 py-2.5 text-right">KGF</th>
                      <th className="px-3 py-2.5 text-right">Rate (₹)</th>
                      <th className="px-3 py-2.5 text-right">GST (%)</th>
                      <th className="px-3 py-2.5 text-right">GST Amt (₹)</th>
                      <th className="px-4 py-2.5 text-right">Taxable Value (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it: any, idx: number) => {
                      const line = tax?.itemLines?.[idx]
                      return (
                        <tr key={it.orderItem.id} className={`h-11 border-b border-slate-100 even:bg-slate-50/60 hover:bg-primary/5 ${isSelected(idx) ? "" : "opacity-45"}`}>
                          <td className="w-10 pl-4 pr-0">
                            <Checkbox
                              checked={isSelected(idx)}
                              onCheckedChange={() => toggleItem(it.orderItem.id)}
                              aria-label={`Select ${it.sku?.skuName || "item"}`}
                            />
                          </td>
                          <td className="px-3 font-semibold text-slate-900">{it.sku?.skuName || it.orderItem?.oilType || "—"}</td>
                          <td className="px-3 text-right font-mono tabular-nums">
                            {it.orderItem?.orderQuantity != null && it.orderItem?.orderQuantity !== "" ? fmtNum(Number(it.orderItem.orderQuantity), 3) : "—"}
                            {(it.sku?.mainUom || it.orderItem?.uom) && <span className="ml-1 inline-block w-10 text-left font-sans text-xs text-slate-500">{it.sku?.mainUom || it.orderItem?.uom}</span>}
                          </td>
                          <td className="px-3 text-right font-mono font-semibold tabular-nums text-slate-800">{kgs[idx] != null ? fmtWeight(kgs[idx] as number, wd) : "—"}</td>
                          <td className="px-3 text-right font-mono tabular-nums">{fmtMoney(line?.rate)}</td>
                          <td className="px-3 text-right font-mono tabular-nums text-slate-600">{fmtNum(Number(line?.gstPercent) || 0, 2)}</td>
                          <td className="px-3 text-right font-mono tabular-nums text-slate-800">{fmtMoney((line?.cgst || 0) + (line?.sgst || 0) + (line?.igst || 0))}</td>
                          <td className="px-4 text-right font-mono font-bold tabular-nums text-slate-900">{fmtMoney(line?.taxableValue)}</td>
                        </tr>
                      )
                    })}
                    {charges.map((c, idx) => (
                      <tr key={`charge-${idx}`} className="h-11 border-b border-amber-100 bg-amber-50/70">
                        {/* Read-only: charges are entered at Order Punch and only shown here. */}
                        <td colSpan={7} className="px-4 font-medium text-slate-800">
                          {c.ledgerName || `Ledger ${c.ledgerId ?? ""}`}
                          <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-amber-700">Ledger charge · no GST</span>
                        </td>
                        <td className="px-4 text-right font-mono font-bold tabular-nums text-slate-900">{fmtMoney(Number(c.amount) || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <SumRow label="Total Taxable Value (₹)" value={previewTotals?.totalTaxableValue} />
                    {tax?.isInterState ? (
                      <SumRow label={`IGST${rateTag(1)} (₹)`} value={previewTotals?.igst} />
                    ) : (
                      <>
                        <SumRow label={`CGST${rateTag(2)} (₹)`} value={previewTotals?.cgst} />
                        <SumRow label={`SGST${rateTag(2)} (₹)`} value={previewTotals?.sgst} />
                      </>
                    )}
                    <SumRow label="Rounding Off (₹)" value={previewTotals?.roundingOff} />
                    <tr className="border-t border-primary/20 bg-primary/10">
                      <td colSpan={7} className="px-4 py-3 text-right text-sm font-extrabold uppercase tracking-wide text-primary">Total Order Amount (₹)</td>
                      <td className="px-4 py-3 text-right text-base font-extrabold tabular-nums text-primary">{fmtAmount(previewTotals?.grandTotal || 0, 2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            {/* Verification */}
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary"><ShieldCheck className="h-3.5 w-3.5" /></span>
                  Verification
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2">
                {CHECK_ITEMS.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg border border-slate-200/80 bg-white p-3">
                    <Label className="text-sm font-medium">{item.label}</Label>
                    <RadioGroup
                      value={checklist[item.id]}
                      onValueChange={(v) => setChecklist((prev) => ({ ...prev, [item.id]: v as "approve" | "reject" }))}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="approve" id={`${item.id}-ok`} />
                        <Label htmlFor={`${item.id}-ok`} className="cursor-pointer text-xs font-medium text-green-600">Approve</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="reject" id={`${item.id}-no`} />
                        <Label htmlFor={`${item.id}-no`} className="cursor-pointer text-xs font-medium text-red-600">Reject</Label>
                      </div>
                    </RadioGroup>
                  </div>
                ))}
              </div>
            </section>

            {/* Remarks */}
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <Label className="mb-1.5 flex items-center gap-1 text-sm font-bold text-slate-900">
                Remarks
                <span className="text-[10px] font-bold uppercase text-red-500">(required for Reject / Modify)</span>
              </Label>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter remarks..."
                className="min-h-20 bg-white text-sm"
              />
            </section>
          </div>
        )}

        <DialogFooter className="border-t bg-white px-5 py-3 sm:px-6">
          <div className="grid grid-cols-1 gap-2 sm:flex sm:justify-end">
            <Button
              onClick={() => handleSubmit("reject")}
              disabled={!!submittingAction || isReadOnly || isLoading || selectedCount === 0}
              variant="destructive"
              className="w-full gap-1.5 sm:w-auto"
            >
              {submittingAction === "reject" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              Reject
            </Button>
            <Button
              onClick={() => handleSubmit("modify")}
              disabled={!!submittingAction || isReadOnly || isLoading || selectedCount === 0}
              variant="outline"
              className="w-full gap-1.5 border-2 border-amber-500 text-amber-600 hover:bg-amber-50 sm:w-auto"
            >
              {submittingAction === "modify" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Modify
            </Button>
            <Button
              onClick={() => handleSubmit("approve")}
              disabled={!!submittingAction || isReadOnly || isLoading || selectedCount === 0}
              className="w-full gap-1.5 sm:w-auto"
            >
              {submittingAction === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Approve
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 break-words font-semibold text-slate-900">{value || "—"}</p>
    </div>
  )
}

function SumRow({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <tr className="border-t border-slate-100 bg-slate-50/60">
      <td colSpan={7} className="px-4 py-2 text-right text-xs text-slate-500">{label}</td>
      <td className="px-4 py-2 text-right text-sm font-semibold tabular-nums text-slate-900">{fmtAmount(Number(value) || 0, 2)}</td>
    </tr>
  )
}
