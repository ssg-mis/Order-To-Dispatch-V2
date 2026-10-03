"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { WorkflowStageShell } from "@/components/workflow/workflow-stage-shell"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FileUploadField } from "@/components/file-upload-field"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { isStaleWriteError } from "@/lib/stale-write"
import { orderApi, returnApi } from "@/lib/api-service"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeftRight, FileText, Loader2, Printer, Receipt, Undo2 } from "lucide-react"
import { cn } from "@/lib/utils"

const money = (v: any) =>
  `₹${(parseFloat(v || 0) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString("en-IN") : "—")
const today = () => new Date().toISOString().split("T")[0]
const num = (v: any) => parseFloat(v) || 0
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

const emptyForm = () => ({
  customerDnNo: "",
  customerDnDate: today(),
  customerDnCopy: "",
  customerDnCopyName: "",
  cnNo: "",
  cnDate: today(),
  cnCopy: "",
  cnCopyName: "",
  cnAmount: "",
  remarks: "",
})

export default function ReturnPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { isReadOnly } = useAuth()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending")
  const [filterValues, setFilterValues] = useState({
    status: "", startDate: "", endDate: "", partyName: "", search: "", manualSaudaNo: "",
  })
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [uploading, setUploading] = useState<Record<string, boolean>>({})
  const [isProcessing, setIsProcessing] = useState(false)

  const filters = {
    search: filterValues.search || undefined,
    customer_name: filterValues.partyName && filterValues.partyName !== "all" ? filterValues.partyName : undefined,
    start_date: filterValues.startDate || undefined,
    end_date: filterValues.endDate || undefined,
  }

  const { data: pendingData, isLoading: isPendingLoading } = useQuery({
    queryKey: ["return-credit-notes-pending", filterValues],
    queryFn: async () => {
      const res = await returnApi.getPendingCreditNotes({ ...filters, limit: 100 })
      return res.success ? res.data : { returns: [], pagination: { total: 0 } }
    },
  })
  const pending: any[] = pendingData?.returns || []

  const { data: historyData, isLoading: isHistoryLoading } = useQuery({
    queryKey: ["return-credit-notes-history", filterValues],
    enabled: activeTab === "history",
    queryFn: async () => {
      const res = await returnApi.getCreditNoteHistory({ ...filters, limit: 100 })
      return res.success ? res.data : { returns: [], pagination: { total: 0 } }
    },
  })
  const history: any[] = historyData?.returns || []

  const { data: stockReturnsData, isLoading: isStockReturnsLoading } = useQuery({
    queryKey: ["stock-returns"],
    queryFn: async () => {
      const res = await returnApi.getStockReturns()
      return res.success ? (res.data?.stock_returns || []) : []
    },
  })
  const stockReturns: any[] = stockReturnsData || []

  const selected = useMemo(() => pending.find((r) => r.gate.id === selectedId), [pending, selectedId])

  const openDialog = () => {
    if (!selected) return
    setForm({ ...emptyForm(), cnAmount: selected.suggested?.amount ? String(selected.suggested.amount) : "" })
    setIsDialogOpen(true)
  }

  const upload = async (file: File, key: "customerDnCopy" | "cnCopy") => {
    setUploading((u) => ({ ...u, [key]: true }))
    try {
      const res = await orderApi.uploadFile(file)
      if (res.success) {
        setForm((f) => ({ ...f, [key]: res.data.url, [`${key}Name`]: file.name }))
      }
    } catch (e: any) {
      toast({ title: "Upload Failed", description: e.message || "Could not upload the file", variant: "destructive" })
    } finally {
      setUploading((u) => ({ ...u, [key]: false }))
    }
  }

  // Live CN breakdown
  const gstPercent = selected?.suggested?.gst_percent ?? 5
  const cnAmount = num(form.cnAmount)
  const taxable = round2(cnAmount / (1 + gstPercent / 100))
  const gstAmt = round2(cnAmount - taxable)
  const maxCn = selected?.originalBill?.max_credit_note ?? null
  const overCap = maxCn !== null && cnAmount > maxCn + 0.01
  const canSave =
    !isProcessing && !isReadOnly && form.customerDnNo.trim() && form.cnNo.trim() && form.cnDate && cnAmount > 0 && !overCap

  const handleSubmit = async () => {
    if (!selected || !canSave) return
    setIsProcessing(true)
    try {
      const res = await returnApi.submitCreditNote(selected.gate.id, {
        customerDnNo: form.customerDnNo,
        customerDnDate: form.customerDnDate || null,
        customerDnCopy: form.customerDnCopy || null,
        cnNo: form.cnNo,
        cnDate: form.cnDate,
        cnCopy: form.cnCopy || null,
        cnAmount: form.cnAmount,
        remarks: form.remarks || null,
      })
      if (res.success) {
        toast({ title: "Credit Note Recorded", description: `${form.cnNo} · invoice ${selected.order.refInvoiceNo} updated` })
        setIsDialogOpen(false)
        setSelectedId(null)
        queryClient.invalidateQueries({ queryKey: ["return-credit-notes-pending"] })
        queryClient.invalidateQueries({ queryKey: ["return-credit-notes-history"] })
        queryClient.invalidateQueries({ queryKey: ["return-unloading-pending"] })
        queryClient.invalidateQueries({ queryKey: ["collections-pending"] })
      } else {
        toast({ title: "Error", description: res.message || "Could not save the credit note", variant: "destructive" })
      }
    } catch (error: any) {
      toast({
        title: isStaleWriteError(error) ? "Already processed" : "Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      })
      queryClient.invalidateQueries({ queryKey: ["return-credit-notes-pending"] })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <WorkflowStageShell
      partyNames={[]}
      title="Stage 17: Return"
      description="Customer sales returns — credit note against the original invoice, plus stock-return transfers."
      pendingCount={pending.length}
      historyData={[]}
      onFilterChange={setFilterValues}
      showStatusFilter={false}
      stageLevel={12}
      onTabChange={setActiveTab}
      showDateFilters={true}
      showSaudaFilter={false}
      dateLabel="DO Date"
      searchPlaceholder="Search DO / Customer / Invoice..."
      isHistoryLoading={isHistoryLoading}
      historyContent={
        <Card className="border-none shadow-sm overflow-hidden py-0 gap-0">
          <div className="max-h-[600px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                <TableRow className="bg-slate-50">
                  {["CN Date", "CN No", "Customer", "Original Invoice", "Customer DN", "Product", "Qty", "CN Amount", "Remarks"].map((h) => (
                    <TableHead key={h} className="whitespace-nowrap text-center">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isHistoryLoading ? (
                  <TableRow><TableCell colSpan={9} className="py-10 text-center text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading…</TableCell></TableRow>
                ) : history.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="py-10 text-center text-slate-500">No credit notes issued yet.</TableCell></TableRow>
                ) : (
                  history.map((r) => (
                    <TableRow key={r.gate.id}>
                      <TableCell className="text-center text-xs">{fmtDate(r.gate.cnDate)}</TableCell>
                      <TableCell className="text-center text-xs font-bold text-slate-700">{r.gate.cnNo}</TableCell>
                      <TableCell className="text-center text-xs font-medium">{r.customer?.customerName || "—"}</TableCell>
                      <TableCell className="text-center text-xs">{r.gate.refInvoiceNo || r.order.refInvoiceNo}</TableCell>
                      <TableCell className="text-center text-xs">{r.gate.customerDnNo}</TableCell>
                      <TableCell className="text-center text-xs">{r.sku?.skuName || "—"}</TableCell>
                      <TableCell className="text-center text-xs tabular-nums">{num(r.gate.qty)}</TableCell>
                      <TableCell className="text-center text-xs font-semibold text-violet-600 tabular-nums">{money(r.gate.cnAmount)}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs" title={r.gate.remarks || ""}>{r.gate.remarks || "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      }
    >
      <div className="space-y-4">
        {/* The three return cases */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Card className="gap-1 p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Case I &amp; II · Stock transfer</p>
            <p className="text-sm text-slate-700">Depot → Banari, or depot → depot. Raised as a Stock Transfer order; stock-out and stock-in follow automatically.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 w-fit"
              onClick={() => router.push("/order-punch/create?category=Stock%20Transfer&stockReturn=1")}
            >
              <ArrowLeftRight className="mr-2 h-4 w-4" />
              New Stock Return
            </Button>
          </Card>
          <Card className="gap-1 p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Case III · Customer return</p>
            <p className="text-sm text-slate-700">Punch an order in the <b>Sales Return</b> category against the original invoice, then issue the credit note here once the pickup is dispatched. Stage 18 then receives and checks the goods.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 w-fit"
              onClick={() => router.push("/order-punch/create?category=Sales%20Return")}
            >
              <Undo2 className="mr-2 h-4 w-4" />
              New Sales Return
            </Button>
          </Card>
          <Card className="gap-1 p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Awaiting credit note</p>
            <p className="text-3xl font-bold tracking-tight text-slate-900">{pending.length}</p>
            <p className="text-sm text-slate-500">return pickups dispatched, credit note not yet issued</p>
          </Card>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => router.push("/return-gate-pass")}>
            <Printer className="mr-2 h-4 w-4" />
            Stock Return Gate Pass
          </Button>
          <Button onClick={openDialog} disabled={!selected || isReadOnly} className="bg-blue-600 hover:bg-blue-700">
            <Receipt className="mr-2 h-4 w-4" />
            Issue Credit Note
          </Button>
        </div>

        <Card className="gap-0 overflow-hidden border-none py-0 shadow-sm">
          <div className="max-h-[600px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                <TableRow className="bg-slate-50">
                  <TableHead className="w-10" />
                  {["DO Number", "DSR", "Customer", "Original Invoice", "Product", "Return Qty", "Reason", "Vehicle", "Dispatched On", "Planned"].map((h) => (
                    <TableHead key={h} className="whitespace-nowrap text-center">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isPendingLoading ? (
                  <TableRow><TableCell colSpan={11} className="py-10 text-center text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading…</TableCell></TableRow>
                ) : pending.length === 0 ? (
                  <TableRow><TableCell colSpan={11} className="py-10 text-center text-slate-500">No returns waiting for a credit note.</TableCell></TableRow>
                ) : (
                  pending.map((r) => (
                    <TableRow key={r.gate.id} className={cn(selectedId === r.gate.id && "bg-blue-50/50")}>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={selectedId === r.gate.id}
                          onCheckedChange={() => setSelectedId(selectedId === r.gate.id ? null : r.gate.id)}
                        />
                      </TableCell>
                      <TableCell className="text-center text-xs font-bold text-slate-700">{r.order.orderNo}</TableCell>
                      <TableCell className="text-center text-xs">{r.dispatch.dsrNumber || "—"}</TableCell>
                      <TableCell className="text-center text-xs font-medium">{r.customer?.customerName || "—"}</TableCell>
                      <TableCell className="text-center text-xs font-bold text-slate-700">{r.order.refInvoiceNo || "—"}</TableCell>
                      <TableCell className="text-center text-xs">{r.sku?.skuName || "—"}</TableCell>
                      <TableCell className="text-center text-xs font-semibold tabular-nums">{r.suggested?.qty}</TableCell>
                      <TableCell className="text-center text-xs">{r.order.returnReason || "—"}</TableCell>
                      <TableCell className="text-center text-xs">{r.vehicle?.registrationNo || "—"}</TableCell>
                      <TableCell className="text-center text-xs">{fmtDate(r.dispatch.actualAt)}</TableCell>
                      <TableCell className="text-center text-xs">{fmtDate(r.gate.plannedAt)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Stock Returns (Cases I / II) */}
        <div className="space-y-2">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Stock Returns</h2>
            <p className="text-xs text-slate-500">Depot-to-Banari / depot-to-depot returns, raised as a Stock Transfer against the original transfer.</p>
          </div>
          <Card className="gap-0 overflow-hidden border-none py-0 shadow-sm">
            <div className="max-h-[360px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                  <TableRow className="bg-slate-50">
                    {["DO Date", "Return DO", "Original Transfer", "From Depot", "Returned To", "Products", "Qty", "Reason", "Status"].map((h) => (
                      <TableHead key={h} className="whitespace-nowrap text-center">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isStockReturnsLoading ? (
                    <TableRow><TableCell colSpan={9} className="py-8 text-center text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading…</TableCell></TableRow>
                  ) : stockReturns.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="py-8 text-center text-slate-500">No stock returns yet.</TableCell></TableRow>
                  ) : (
                    stockReturns.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-center text-xs">{fmtDate(s.party_so_date || s.created_at)}</TableCell>
                        <TableCell className="text-center text-xs font-bold text-slate-700">{s.order_no}</TableCell>
                        <TableCell className="text-center text-xs">{s.original_order_no}</TableCell>
                        <TableCell className="text-center text-xs">{s.from_depot || "—"}</TableCell>
                        <TableCell className="text-center text-xs">{s.to_depot || s.to_customer || "—"}</TableCell>
                        <TableCell className="max-w-[220px] truncate text-center text-xs" title={s.products || ""}>{s.products || "—"}</TableCell>
                        <TableCell className="text-center text-xs font-semibold tabular-nums">{Number(s.qty) || 0}</TableCell>
                        <TableCell className="text-center text-xs">{s.return_reason || "—"}</TableCell>
                        <TableCell className="text-center">
                          <Badge className={cn(
                            s.status === "Received" && "bg-emerald-100 text-emerald-700",
                            s.status === "In Transit" && "bg-blue-100 text-blue-700",
                            s.status === "Dispatched" && "bg-sky-100 text-sky-700",
                            s.status === "Planned" && "bg-amber-100 text-amber-700",
                            s.status === "Awaiting Approval" && "bg-slate-100 text-slate-700",
                          )}>{s.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </div>

      {/* Credit Note dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[95vh] w-[calc(100vw-0.75rem)] max-w-[calc(100vw-0.75rem)] overflow-x-hidden overflow-y-auto p-0 [overflow-wrap:anywhere] sm:!max-w-[95vw]">
          <div className="p-3 sm:p-6">
            <DialogHeader className="min-w-0">
              <DialogTitle className="break-words text-lg font-bold text-slate-900 sm:text-xl">
                Issue Credit Note - {selected?.order.refInvoiceNo}
              </DialogTitle>
              <DialogDescription className="sr-only">Record the customer's debit note and issue a credit note against the original invoice</DialogDescription>
            </DialogHeader>

            {selected && (
              <div className="mt-6 min-w-0 space-y-6">
                <div className="min-w-0 overflow-hidden rounded-xl border-2 border-slate-100 bg-white shadow-sm sm:rounded-3xl">
                  <div className="flex flex-col gap-3 bg-blue-600 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                      <Badge className="max-w-full whitespace-normal break-words rounded-full bg-white px-3 py-1.5 text-xs font-black uppercase tracking-tight text-blue-800 shadow-sm hover:bg-white sm:px-4 sm:text-sm">
                        DETAILS FOR {selected.customer?.customerName || "—"}
                      </Badge>
                      <div className="flex flex-col">
                        <span className="mb-1 text-[10px] font-black uppercase leading-none tracking-widest text-blue-100">RETURN DO {selected.order.orderNo}</span>
                        <span className="text-xs font-bold leading-none text-blue-100">{selected.dispatch.dsrNumber} · {selected.sku?.skuName}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="w-fit border-white/40 bg-white/10 text-white">{selected.order.returnReason || "Return"}</Badge>
                  </div>

                  <div className="border-t border-slate-100 bg-slate-50 px-3 py-5 sm:px-5">
                    <div className="grid grid-cols-2 gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:grid-cols-3 sm:gap-6 sm:p-6 md:grid-cols-6">
                      {[
                        ["Original Invoice", selected.order.refInvoiceNo, ""],
                        ["Invoice Date", fmtDate(selected.originalBill?.invoice_date), ""],
                        ["Invoice Amount", money(selected.originalBill?.bill_amount), ""],
                        ["Credit Notes So Far", money(selected.originalBill?.credit_notes_so_far), "text-violet-600"],
                        ["Max This CN", money(selected.originalBill?.max_credit_note), "text-red-600"],
                        ["Return Qty × Rate", `${selected.suggested?.qty} × ${money(selected.suggested?.rate)}`, ""],
                      ].map(([label, value, cls]) => (
                        <div key={label as string}>
                          <p className="mb-1 text-[10px] font-bold uppercase leading-none tracking-widest text-slate-500">{label}</p>
                          <p className={cn("text-sm font-semibold text-slate-900", cls as string)}>{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-6 rounded-lg border bg-white p-4 shadow-sm sm:p-6">
                  <h3 className="flex items-center gap-2 border-b pb-2 text-sm font-bold text-slate-800">
                    <FileText className="h-4 w-4 text-amber-600" />
                    Customer&apos;s Debit Note
                  </h3>
                  <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Debit Note No. <span className="text-red-500">*</span></Label>
                      <Input className="h-10" value={form.customerDnNo} onChange={(e) => setForm((f) => ({ ...f, customerDnNo: e.target.value }))} placeholder="Customer's DN number" />
                    </div>
                    <div className="space-y-2">
                      <Label>Debit Note Date</Label>
                      <Input type="date" className="h-10" value={form.customerDnDate} onChange={(e) => setForm((f) => ({ ...f, customerDnDate: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <FileUploadField
                        label={<Label>Debit Note Copy</Label>}
                        accept="image/*,.pdf"
                        value={form.customerDnCopy}
                        fileName={form.customerDnCopyName}
                        uploading={uploading.customerDnCopy || false}
                        buttonText={form.customerDnCopyName ? "REPLACE" : "UPLOAD"}
                        onFilesSelected={(files) => files[0] && upload(files[0], "customerDnCopy")}
                        onRemove={() => setForm((f) => ({ ...f, customerDnCopy: "", customerDnCopyName: "" }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-6 rounded-lg border bg-white p-4 shadow-sm sm:p-6">
                  <h3 className="flex items-center gap-2 border-b pb-2 text-sm font-bold text-slate-800">
                    <Receipt className="h-4 w-4 text-violet-600" />
                    Credit Note
                  </h3>
                  <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Credit Note No. <span className="text-red-500">*</span></Label>
                      <Input className="h-10" value={form.cnNo} onChange={(e) => setForm((f) => ({ ...f, cnNo: e.target.value }))} placeholder="Enter CN number" />
                    </div>
                    <div className="space-y-2">
                      <Label>Credit Note Date <span className="text-red-500">*</span></Label>
                      <Input type="date" className="h-10" value={form.cnDate} onChange={(e) => setForm((f) => ({ ...f, cnDate: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>CN Amount incl. GST (₹) <span className="text-red-500">*</span></Label>
                      <Input type="number" min={0} className="h-10" value={form.cnAmount} onChange={(e) => setForm((f) => ({ ...f, cnAmount: e.target.value }))} placeholder="0.00" />
                      <p className="text-[11px] text-slate-500">
                        Suggested {money(selected.suggested?.amount)} (qty × invoice rate)
                        {" · "}
                        <button type="button" className="font-semibold text-blue-600 hover:text-blue-800" onClick={() => setForm((f) => ({ ...f, cnAmount: String(selected.suggested?.amount ?? "") }))}>Use</button>
                      </p>
                    </div>
                    <div className="space-y-2 md:col-span-2 lg:col-span-1">
                      <FileUploadField
                        label={<Label>Credit Note Copy</Label>}
                        accept="image/*,.pdf"
                        value={form.cnCopy}
                        fileName={form.cnCopyName}
                        uploading={uploading.cnCopy || false}
                        buttonText={form.cnCopyName ? "REPLACE" : "UPLOAD"}
                        onFilesSelected={(files) => files[0] && upload(files[0], "cnCopy")}
                        onRemove={() => setForm((f) => ({ ...f, cnCopy: "", cnCopyName: "" }))}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Remarks</Label>
                      <Input className="h-10" value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} placeholder="Optional" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 border-t pt-4 text-sm sm:grid-cols-4">
                    <div><p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Taxable Value</p><p className="font-semibold tabular-nums">{money(taxable)}</p></div>
                    <div><p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">GST @ {gstPercent}%</p><p className="font-semibold tabular-nums">{money(gstAmt)}</p></div>
                    <div><p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">CN Total</p><p className="font-bold tabular-nums text-violet-600">{money(cnAmount)}</p></div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Receivable After</p>
                      <p className={cn("font-semibold tabular-nums", overCap && "text-red-600")}>
                        {overCap ? `Exceeds invoice by ${money(cnAmount - (maxCn ?? 0))}` : "Invoice balance reduces by this CN"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="-mx-3 -mb-3 mt-8 gap-2 border-t bg-gray-50 px-3 py-4 pt-4 sm:-mx-6 sm:-mb-6 sm:gap-0 sm:px-6">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isProcessing} className="w-full sm:w-auto">Cancel</Button>
              <Button onClick={handleSubmit} disabled={!canSave} className="w-full min-w-[150px] bg-blue-600 hover:bg-blue-700 sm:w-auto">
                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isProcessing ? "Processing..." : "Issue Credit Note"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </WorkflowStageShell>
  )
}
