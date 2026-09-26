"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardHeader, CardTitle, CardAction, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronDown, ChevronUp, FileText, ExternalLink, Loader2, Plus, X } from "lucide-react"
import { approvalApi, ledgerApi } from "@/lib/api-service"
import { isStaleWriteError } from "@/lib/stale-write"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"

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
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 })
}
const fmtDate = (v: string | null | undefined) => {
  if (!v) return "—"
  const d = new Date(v)
  if (isNaN(d.getTime())) return String(v)
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export function ApprovalDetailDialog({ orderId, open, onOpenChange, onSubmitted }: ApprovalDetailDialogProps) {
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

  const { data: ledgerOptions } = useQuery({
    queryKey: ["ledgers-for-approval-charges"],
    queryFn: async () => {
      const res = await ledgerApi.getAll({ all: "true" })
      const items = res.success ? (res.data?.ledgers || (Array.isArray(res.data) ? res.data : [])) : []
      return items.map((l: any) => ({ id: l.id, name: l.ledger_name || l.ledgerName || l.name || "" })).filter((l: any) => l.name)
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  })

  // Reset form state whenever a different order is opened.
  useEffect(() => {
    if (!open) return
    setDetailsExpanded(true)
    setRemarks("")
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

  // Live preview combining the server-computed item tax lines with whatever
  // charge rows are currently being edited (not yet saved) - so the totals
  // footer updates as the approver adds/edits a charge, without a round trip.
  const previewTotals = useMemo(() => {
    if (!tax) return null
    const itemsTaxable = (tax.itemLines || []).reduce((s: number, l: any) => s + (l.taxableValue || 0), 0)
    const chargesTaxable = charges.reduce((s, c) => s + (Number(c.amount) || 0), 0)
    const totalTaxableValue = itemsTaxable + chargesTaxable
    const cgst = tax.cgst || 0
    const sgst = tax.sgst || 0
    const igst = tax.igst || 0
    const preRound = totalTaxableValue + cgst + sgst + igst
    const grandTotal = Math.round(preRound)
    const roundingOff = +(grandTotal - preRound).toFixed(2)
    return { totalTaxableValue, cgst, sgst, igst, roundingOff, grandTotal }
  }, [tax, charges])

  const addChargeRow = () => setCharges((prev) => [...prev, { ledgerId: null, ledgerName: "", amount: "" }])
  const removeChargeRow = (idx: number) => setCharges((prev) => prev.filter((_, i) => i !== idx))
  const updateChargeRow = (idx: number, patch: Partial<{ ledgerId: number | null; ledgerName: string; amount: string }>) =>
    setCharges((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)))

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

      const validCharges = charges
        .filter((c) => c.ledgerId && Number(c.amount) > 0)
        .map((c) => ({ ledgerId: c.ledgerId as number, amount: Number(c.amount) }))
      await approvalApi.setOrderCharges(orderId, validCharges, user?.id || null)

      const results = await Promise.allSettled(
        items.map((it: any) => approvalApi.submit(it.orderItem.id, approvalData))
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
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-0.75rem)] max-w-[calc(100vw-0.75rem)] flex-col overflow-x-hidden overflow-y-auto p-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] sm:max-w-4xl sm:p-6 lg:max-w-6xl">
        <DialogHeader className="min-w-0 border-b pb-4">
          <DialogTitle className="break-words text-lg font-bold leading-tight text-slate-900 sm:text-xl">
            {order?.orderNo || "Order Approval"}
          </DialogTitle>
          <DialogDescription className="mt-1.5 text-slate-500">
            Review order & item details, then Approve, Reject, or send back for Modification.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !detail ? (
          <div className="flex flex-1 items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="min-w-0 space-y-6">
            {/* Order details panel - open by default, collapsible */}
            <Card className="border-slate-200/80 shadow-none bg-slate-50/50">
              <CardHeader>
                <CardTitle>Order Details</CardTitle>
                <CardAction>
                  <button
                    type="button"
                    onClick={() => setDetailsExpanded((v) => !v)}
                    className="text-slate-400 hover:text-slate-600"
                    aria-label={detailsExpanded ? "Collapse order details" : "Expand order details"}
                  >
                    {detailsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </CardAction>
              </CardHeader>
              {detailsExpanded && (
                <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3 lg:grid-cols-4">
                  <Field label="Customer Name" value={customer?.customerName} />
                  <Field label="Depot" value={depot?.depotName} />
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
                  <Field label="Advance Amount" value={`₹${fmtMoney(order?.advanceAmount)}`} />
                  <Field label="Broker" value={broker?.brokerName || "—"} />
                  <div>
                    <p className="text-xs text-muted-foreground">Dispatch From</p>
                    <Select value={dispatchFrom} onValueChange={setDispatchFrom}>
                      <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="in-stock">In Stock</SelectItem>
                        <SelectItem value="production">Production</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Manual Sauda No.</p>
                    <Input value={manualSaudaNo} onChange={(e) => setManualSaudaNo(e.target.value)} className="mt-1 h-8 text-xs" placeholder="Enter manual sauda no..." />
                  </div>
                  <div className="col-span-2 sm:col-span-3 lg:col-span-4">
                    <p className="text-xs text-muted-foreground">Order Punch Remarks</p>
                    <p className="font-medium">{order?.orderPunchRemarks || "—"}</p>
                  </div>
                  {order?.uploadSo && (
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">PO Copy Attachment</p>
                      <a href={order.uploadSo} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline">
                        <FileText className="h-3.5 w-3.5" /> View Attachment <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>

            {/* Item-level table with sticky header */}
            <Card className="border border-slate-200/80 shadow-none overflow-hidden bg-slate-50/50">
              <CardHeader className="p-4 sm:p-5 border-b border-slate-200/80 bg-slate-50/80">
                <CardTitle className="text-base font-bold">Item Details</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-64 overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-slate-100/70 border-b">
                      <TableRow>
                        <TableHead>Product / SKU</TableHead>
                        <TableHead>Oil Type</TableHead>
                        <TableHead>UOM</TableHead>
                        <TableHead className="text-center">Qty</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((it: any, idx: number) => {
                        const line = tax?.itemLines?.[idx]
                        return (
                          <TableRow key={it.orderItem.id}>
                            <TableCell className="font-medium">{it.sku?.skuName || it.orderItem?.oilType || "—"}</TableCell>
                            <TableCell>{it.orderItem?.oilType || "—"}</TableCell>
                            <TableCell>{it.orderItem?.uom || "—"}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="border-blue-200 text-blue-700 font-black px-2">{it.orderItem?.orderQuantity ?? "—"}</Badge>
                            </TableCell>
                            <TableCell className="text-right">₹{fmtMoney(line?.rate)}</TableCell>
                            <TableCell className="text-right font-bold">₹{fmtMoney(line?.taxableValue)}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Invoice-style detail view */}
            <Card className="border border-slate-200/80 shadow-none overflow-hidden bg-slate-50/50">
              <CardHeader className="p-4 sm:p-5 border-b border-slate-200/80 bg-slate-50/80">
                <CardTitle className="text-base font-bold">Invoice Details</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-100/70 border-b">
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Taxable Value</TableHead>
                      <TableHead className="text-center">GST %</TableHead>
                      <TableHead className="w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(tax?.itemLines || []).map((line: any, idx: number) => (
                      <TableRow key={`item-${idx}`}>
                        <TableCell className="font-medium">{items[idx]?.sku?.skuName || items[idx]?.orderItem?.oilType || "—"}</TableCell>
                        <TableCell className="text-right font-bold">₹{fmtMoney(line.taxableValue)}</TableCell>
                        <TableCell className="text-center">
                          {line.gstPercent ? (
                            <Badge variant="outline" className="border-slate-200 text-slate-600 font-black px-2">{line.gstPercent}%</Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    ))}
                    {charges.map((c, idx) => (
                      <TableRow key={`charge-${idx}`} className="bg-slate-50/60">
                        <TableCell>
                          <Select
                            value={c.ledgerId ? String(c.ledgerId) : ""}
                            onValueChange={(v) => {
                              const opt = (ledgerOptions || []).find((l: any) => String(l.id) === v)
                              updateChargeRow(idx, { ledgerId: opt?.id ?? null, ledgerName: opt?.name ?? "" })
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select ledger (e.g. Transporting Expenses)" /></SelectTrigger>
                            <SelectContent>
                              {(ledgerOptions || []).map((l: any) => (
                                <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            value={c.amount}
                            onChange={(e) => updateChargeRow(idx, { amount: e.target.value })}
                            className="h-8 w-28 text-right text-xs ml-auto"
                            placeholder="0.00"
                          />
                        </TableCell>
                        <TableCell className="text-center text-xs text-slate-400">—</TableCell>
                        <TableCell>
                          <button type="button" onClick={() => removeChargeRow(idx)} className="text-slate-400 hover:text-red-600">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={4} className="py-2">
                        <Button type="button" variant="outline" size="sm" onClick={addChargeRow} className="h-7 text-[11px]">
                          <Plus className="mr-1 h-3 w-3" /> Add Charge (e.g. Transporting Expenses)
                        </Button>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                  <TableFooter>
                    <TotalFooterRow label="Total Taxable Value" value={previewTotals?.totalTaxableValue} />
                    {/* CGST+SGST and IGST are mutually exclusive (intra-state vs inter-state) —
                        only the applicable one is rendered at all, never both. */}
                    {tax?.isInterState ? (
                      <TotalFooterRow label="IGST" value={previewTotals?.igst} />
                    ) : (
                      <>
                        <TotalFooterRow label="CGST" value={previewTotals?.cgst} />
                        <TotalFooterRow label="SGST" value={previewTotals?.sgst} />
                      </>
                    )}
                    <TotalFooterRow label="Rounding Off" value={previewTotals?.roundingOff} />
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={4} className="p-0">
                        <div className="flex items-center justify-between px-4 py-3 text-sm font-black text-slate-900 border-t border-slate-200">
                          <span>Total Order Amount</span>
                          <span>₹{fmtMoney(previewTotals?.grandTotal)}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </CardContent>
            </Card>

            {/* Six-point verification (unchanged, minus the old "Overall Status" item — replaced by the 3 buttons below) */}
            <Card className="border-slate-200/80 shadow-none bg-slate-50/50">
              <CardHeader>
                <CardTitle>Verification</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
              </CardContent>
            </Card>

            {/* Remarks */}
            <div>
              <Label className="mb-1.5 flex items-center gap-1 text-sm font-semibold text-slate-700">
                Remarks
                <span className="text-[10px] font-bold uppercase text-red-500">(required for Reject / Modify)</span>
              </Label>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter remarks..."
                className="min-h-20 text-sm"
              />
            </div>
          </div>
        )}

        <DialogFooter className="mt-4 border-t pt-4">
          <div className="grid grid-cols-1 gap-2 sm:flex sm:justify-end">
            <Button
              onClick={() => handleSubmit("reject")}
              disabled={!!submittingAction || isReadOnly || isLoading}
              variant="destructive"
              className="w-full sm:w-auto"
            >
              {submittingAction === "reject" && <Loader2 className="h-4 w-4 animate-spin" />}
              Reject
            </Button>
            <Button
              onClick={() => handleSubmit("modify")}
              disabled={!!submittingAction || isReadOnly || isLoading}
              variant="outline"
              className="w-full border-2 border-amber-500 text-amber-600 hover:bg-amber-50 sm:w-auto"
            >
              {submittingAction === "modify" && <Loader2 className="h-4 w-4 animate-spin" />}
              Modify
            </Button>
            <Button
              onClick={() => handleSubmit("approve")}
              disabled={!!submittingAction || isReadOnly || isLoading}
              className="w-full sm:w-auto"
            >
              {submittingAction === "approve" && <Loader2 className="h-4 w-4 animate-spin" />}
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
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="break-words font-medium">{value || "—"}</p>
    </div>
  )
}

function TotalFooterRow({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={2} className="text-xs text-slate-600">{label}</TableCell>
      <TableCell colSpan={2} className="text-right text-xs font-semibold text-slate-900">₹{fmtMoney(value)}</TableCell>
    </TableRow>
  )
}
