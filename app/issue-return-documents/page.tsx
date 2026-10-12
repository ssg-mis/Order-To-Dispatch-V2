"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { WorkflowStageShell } from "@/components/workflow/workflow-stage-shell"
import { StageDataCard, type StageDataCol } from "@/components/stage-list-extra/stage-data-card"
import { Button } from "@/components/ui/button"
import { StageActionBar } from "@/components/stage-list"
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
import { fmtDate, fmtNum } from "@/lib/table-format"

const money = (v: any) =>
  `₹${(parseFloat(v || 0) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const today = () => new Date().toISOString().split("T")[0]
const num = (v: any) => parseFloat(v) || 0
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

const dash = (v: any) => (v === null || v === undefined || v === "" ? "—" : String(v))
const fmtQty = (n: number) => n.toFixed(4)
const NUM = "font-mono tabular-nums min-w-[110px]"

const PENDING_COLUMNS: StageDataCol<any>[] = [
  { id: "order_no", label: "DO Number", align: "left", accessor: (r) => r.order.orderNo, render: (r) => <span className="font-bold text-slate-700">{r.order.orderNo}</span> },
  { id: "dsr", label: "DSR", align: "left", accessor: (r) => r.dispatch?.dsrNumber, render: (r) => dash(r.dispatch?.dsrNumber) },
  { id: "customer", label: "Customer", align: "left", accessor: (r) => r.customer?.customerName, cellClassName: "font-medium", render: (r) => dash(r.customer?.customerName) },
  { id: "invoice", label: "Original Invoice", align: "left", accessor: (r) => r.order.refInvoiceNo, render: (r) => <span className="font-bold text-slate-700">{dash(r.order.refInvoiceNo)}</span> },
  { id: "product", label: "Product", align: "left", accessor: (r) => r.sku?.skuName, render: (r) => dash(r.sku?.skuName) },
  { id: "received_qty", label: "Received Qty", type: "number", align: "right", accessor: (r) => num(r.allocation?.received_qty), tone: "purple", cellClassName: NUM, render: (r) => fmtNum(r.allocation?.received_qty, 4) },
  { id: "qty", label: "Qty to Credit", type: "number", align: "right", accessor: (r) => num(r.suggested?.qty), tone: "blue", cellClassName: NUM, render: (r) => fmtNum(r.suggested?.qty, 4) },
  { id: "reason", label: "Reason", align: "left", accessor: (r) => r.order.returnReason, render: (r) => dash(r.order.returnReason) },
  { id: "vehicle", label: "Vehicle", align: "left", accessor: (r) => r.vehicle?.registrationNo, render: (r) => dash(r.vehicle?.registrationNo) },
  { id: "dispatched", label: "Dispatched On", type: "date", align: "right", accessor: (r) => r.dispatch?.actualAt, cellClassName: NUM, render: (r) => fmtDate(r.dispatch?.actualAt) },
  { id: "planned", label: "Planned", type: "date", align: "right", accessor: (r) => r.gate.plannedAt, cellClassName: NUM, render: (r) => fmtDate(r.gate.plannedAt) },
]

const HISTORY_COLUMNS: StageDataCol<any>[] = [
  { id: "cn_date", label: "CN Date", type: "date", align: "right", accessor: (r) => r.gate.cnDate, cellClassName: NUM, render: (r) => fmtDate(r.gate.cnDate) },
  { id: "cn_no", label: "CN No", align: "left", accessor: (r) => r.gate.cnNo, render: (r) => <span className="font-bold text-slate-700">{r.gate.cnNo}</span> },
  { id: "customer", label: "Customer", align: "left", accessor: (r) => r.customer?.customerName, cellClassName: "font-medium", render: (r) => dash(r.customer?.customerName) },
  { id: "invoice", label: "Original Invoice", align: "left", accessor: (r) => r.gate.refInvoiceNo || r.order.refInvoiceNo, render: (r) => r.gate.refInvoiceNo || r.order.refInvoiceNo },
  { id: "dn", label: "Customer DN", align: "left", accessor: (r) => r.gate.customerDnNo, render: (r) => r.gate.customerDnNo },
  { id: "product", label: "Product", align: "left", accessor: (r) => r.sku?.skuName, render: (r) => dash(r.sku?.skuName) },
  { id: "qty", label: "Qty", type: "number", align: "right", accessor: (r) => num(r.gate.qty), tone: "blue", cellClassName: NUM, render: (r) => fmtNum(num(r.gate.qty), 4) },
  { id: "cn_amount", label: "CN Amount (₹)", type: "number", align: "right", accessor: (r) => num(r.gate.cnAmount), total: true, tone: "purple", cellClassName: cn(NUM, "font-semibold text-violet-600"), render: (r) => fmtNum(r.gate.cnAmount, 2) },
  { id: "remarks", label: "Remarks", accessor: (r) => r.gate.remarks, align: "left", render: (r) => <span className="block max-w-[200px] truncate" title={r.gate.remarks || ""}>{dash(r.gate.remarks)}</span> },
]

const emptyForm = () => ({
  invoiceNo: "",
  qty: "",
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

export default function IssueReturnDocumentsPage() {
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

  const selected = useMemo(() => pending.find((r) => r.gate.id === selectedId), [pending, selectedId])

  // Which invoices this return can be credited against (each shows what is still available on it).
  const { data: optionsData, isLoading: isOptionsLoading } = useQuery({
    queryKey: ["return-cn-invoice-options", selectedId],
    enabled: isDialogOpen && !!selectedId,
    queryFn: async () => {
      const res = await returnApi.getCreditNoteInvoiceOptions(selectedId as number)
      return res.success ? res.data : null
    },
  })
  const invoiceOptions: any[] = optionsData?.options || []

  const openDialog = () => {
    if (!selected) return
    setForm({
      ...emptyForm(),
      invoiceNo: selected.order.refInvoiceNo || "",
      qty: selected.suggested?.qty ? String(selected.suggested.qty) : "",
    })
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

  // The chosen invoice drives the rate, the quantity limit and the amount cap.
  const chosen = invoiceOptions.find((o) => o.invoice_no === form.invoiceNo)
  const remainingQty = num(selected?.suggested?.qty)
  const qty = num(form.qty)
  const maxQty = chosen ? Math.min(remainingQty, num(chosen.available_qty)) : remainingQty
  const overQty = qty <= 0 || qty > maxQty + 0.0001
  const rate = chosen?.rate ?? selected?.suggested?.rate ?? 0
  const suggestedAmount = round2(qty * num(rate))
  const amountValue = form.cnAmount !== "" ? form.cnAmount : suggestedAmount ? String(suggestedAmount) : ""
  const leftAfter = Math.max(0, round2(remainingQty - qty))

  // Live CN breakdown
  const gstPercent = selected?.suggested?.gst_percent ?? 5
  const cnAmount = num(amountValue)
  const taxable = round2(cnAmount / (1 + gstPercent / 100))
  const gstAmt = round2(cnAmount - taxable)
  const maxCn = chosen?.max_credit_note ?? selected?.originalBill?.max_credit_note ?? null
  const overCap = maxCn !== null && cnAmount > maxCn + 0.01
  const canSave =
    !isProcessing && !isReadOnly && form.customerDnNo.trim() && form.cnNo.trim() && form.cnDate && cnAmount > 0 && !overCap && form.invoiceNo && !overQty && !isOptionsLoading

  const handleSubmit = async () => {
    if (!selected || !canSave) return
    setIsProcessing(true)
    try {
      const res = await returnApi.submitCreditNote(selected.gate.id, {
        invoiceNo: form.invoiceNo,
        qty,
        customerDnNo: form.customerDnNo,
        customerDnDate: form.customerDnDate || null,
        customerDnCopy: form.customerDnCopy || null,
        cnNo: form.cnNo,
        cnDate: form.cnDate,
        cnCopy: form.cnCopy || null,
        cnAmount: amountValue,
        remarks: form.remarks || null,
      })
      if (res.success) {
        const left = num(res.data?.remainingQty)
        toast({
          title: "Credit Note Recorded",
          description: left > 0
            ? `${form.cnNo} · invoice ${form.invoiceNo} updated · ${left} still to credit against another invoice`
            : `${form.cnNo} · invoice ${form.invoiceNo} updated`,
        })
        setIsDialogOpen(false)
        setSelectedId(null)
        queryClient.invalidateQueries({ queryKey: ["return-credit-notes-pending"] })
        queryClient.invalidateQueries({ queryKey: ["return-credit-notes-history"] })
        queryClient.invalidateQueries({ queryKey: ["return-unloading-pending"] })
        queryClient.invalidateQueries({ queryKey: ["collections-pending"] })
        queryClient.invalidateQueries({ queryKey: ["sales-returns"] })
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
      persistKey="issue-return-documents"
      partyNames={[]}
      title="Stage 19: Issue Documents Against Returned Stock"
      description="Customer debit note and our credit note against the original invoice."
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
        <StageDataCard
          storageKey="issue-return-documents-history"
          title="Credit Notes Issued"
          description="Credit notes issued against returned stock."
          rows={history}
          columns={HISTORY_COLUMNS}
          rowKey={(r: any) => r.gate.id}
          loading={isHistoryLoading}
          emptyText="No credit notes issued yet."
          format={(n, id) => (id === "cn_amount" ? n.toFixed(2) : fmtQty(n))}
        />
      }
    >
      <div className="space-y-4">
        <StageActionBar>
          <Button onClick={openDialog} disabled={!selected || isReadOnly} className="bg-blue-600 hover:bg-blue-700">
            <Receipt className="mr-2 h-4 w-4" />
            Issue Documents
          </Button>
        </StageActionBar>

        <StageDataCard
          storageKey="issue-return-documents"
          title="Returns Awaiting Documents"
          description="Returned stock waiting for the customer DN and our credit note."
          rows={pending}
          columns={PENDING_COLUMNS}
          rowKey={(r: any) => r.gate.id}
          loading={isPendingLoading}
          emptyText="No returns waiting for documents."
          selects={[{ id: "vehicle", allLabel: "All Vehicles", getValue: (r: any) => r.vehicle?.registrationNo }]}
          leading={{
            cell: (r: any) => (
              <Checkbox checked={selectedId === r.gate.id} onCheckedChange={() => setSelectedId(selectedId === r.gate.id ? null : r.gate.id)} />
            ),
          }}
          rowClassName={(r: any) => (selectedId === r.gate.id ? "bg-blue-50/50" : undefined)}
          format={fmtQty}
        />

      </div>

      {/* Credit Note dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[95vh] w-[calc(100vw-0.75rem)] max-w-[calc(100vw-0.75rem)] overflow-x-hidden overflow-y-auto p-0 [overflow-wrap:anywhere] sm:!max-w-[95vw]">
          <div className="p-3 sm:p-6">
            <DialogHeader className="min-w-0">
              <DialogTitle className="break-words text-lg font-bold text-slate-900 sm:text-xl">
                Issue Documents - {form.invoiceNo || selected?.order.refInvoiceNo}
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
                    <div className="grid grid-cols-2 gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:grid-cols-3 sm:gap-6 sm:p-6 md:grid-cols-4">
                      {[
                        ["Original Invoice", form.invoiceNo || selected.order.refInvoiceNo, ""],
                        ["Invoice Date", fmtDate(chosen?.invoice_date ?? selected.originalBill?.invoice_date), ""],
                        ["Invoice Amount (₹)", fmtNum(chosen?.bill_amount ?? selected.originalBill?.bill_amount, 2), ""],
                        ["Credit Notes So Far (₹)", fmtNum(chosen?.credit_notes_so_far ?? selected.originalBill?.credit_notes_so_far, 2), "text-violet-600"],
                        ["Max This CN (₹)", fmtNum(maxCn, 2), "text-red-600"],
                        ["Qty × Invoice Rate (₹)", `${fmtNum(qty, 4)} × ${fmtNum(rate, 2)}`, ""],
                        ["Sent / Received", selected.receipt ? `${fmtNum(selected.receipt.expected_qty, 4)} / ${fmtNum(selected.receipt.received_qty, 4)}` : "—", ""],
                        ["Good / Damaged", selected.receipt ? `${fmtNum(selected.receipt.good_qty, 4)} / ${fmtNum(selected.receipt.damaged_qty, 4)}${selected.receipt.damaged_disposition ? ` (${selected.receipt.damaged_disposition})` : ""}` : "—", ""],
                        ["Batch · Expiry", selected.receipt ? `${selected.receipt.batch_no || "—"} · ${fmtDate(selected.receipt.expiry_date)}` : "—", ""],
                        ["RST No.", selected.receipt?.rst_no || "—", ""],
                        ["Net Wt vs Items Gross Wt (kg)", selected.receipt && selected.receipt.net_weight != null ? `${fmtNum(selected.receipt.net_weight, 4)} / ${fmtNum(selected.receipt.expected_weight, 4)}` : "—", ""],
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
                    <Undo2 className="h-4 w-4 text-blue-600" />
                    Invoice &amp; Quantity
                  </h3>
                  <p className="-mt-3 text-xs text-slate-500">
                    A credit note is raised against one invoice. If this return belongs to more than one invoice, issue it for part of the quantity here; the rest stays open for another invoice.
                  </p>
                  <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Original Invoice No. <span className="text-red-500">*</span></Label>
                      <select
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={form.invoiceNo}
                        onChange={(e) => setForm((f) => ({ ...f, invoiceNo: e.target.value, cnAmount: "" }))}
                      >
                        {isOptionsLoading && <option value="">Loading invoices…</option>}
                        {!isOptionsLoading && invoiceOptions.length === 0 && <option value="">No invoice has this product available</option>}
                        {invoiceOptions.map((o) => (
                          <option key={o.invoice_no} value={o.invoice_no}>
                            {o.invoice_no} · {fmtDate(o.invoice_date)} · {fmtNum(o.available_qty, 4)} available @ {fmtNum(o.rate, 2)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Quantity against this invoice <span className="text-red-500">*</span></Label>
                      <Input
                        type="number" min={0} className="h-10" value={form.qty}
                        onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value, cnAmount: "" }))}
                      />
                      <p className={cn("text-[11px]", overQty && form.qty !== "" ? "text-red-600" : "text-slate-500")}>
                        {overQty && form.qty !== ""
                          ? `Maximum ${maxQty} (${remainingQty} left on this return, ${chosen?.available_qty ?? "—"} available on the invoice)`
                          : `${remainingQty} left on this return · ${chosen?.available_qty ?? "—"} available on the invoice`}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Rate (from this invoice) (₹)</Label>
                      <Input className="h-10 bg-slate-50" value={fmtNum(rate, 2)} readOnly />
                      {leftAfter > 0 && !overQty && (
                        <p className="text-[11px] font-semibold text-amber-600">{leftAfter} will stay open for a credit note against another invoice</p>
                      )}
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
                      <Input type="number" min={0} className="h-10" value={amountValue} onChange={(e) => setForm((f) => ({ ...f, cnAmount: e.target.value }))} placeholder="0.00" />
                      <p className="text-[11px] text-slate-500">
                        Suggested ₹ {fmtNum(suggestedAmount, 2)} (qty × invoice rate)
                        {" · "}
                        <button type="button" className="font-semibold text-blue-600 hover:text-blue-800" onClick={() => setForm((f) => ({ ...f, cnAmount: "" }))}>Use</button>
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
                    <div><p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Taxable Value (₹)</p><p className="font-mono font-semibold tabular-nums">{fmtNum(taxable, 2)}</p></div>
                    <div><p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">GST @ {gstPercent}% (₹)</p><p className="font-mono font-semibold tabular-nums">{fmtNum(gstAmt, 2)}</p></div>
                    <div><p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">CN Total (₹)</p><p className="font-mono font-bold tabular-nums text-violet-600">{fmtNum(cnAmount, 2)}</p></div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Receivable After</p>
                      <p className={cn("font-semibold tabular-nums", overCap && "text-red-600")}>
                        {overCap ? `Exceeds invoice by ₹ ${fmtNum(cnAmount - (maxCn ?? 0), 2)}` : "Invoice balance reduces by this CN"}
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
                {isProcessing ? "Processing..." : "Issue Documents"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </WorkflowStageShell>
  )
}
