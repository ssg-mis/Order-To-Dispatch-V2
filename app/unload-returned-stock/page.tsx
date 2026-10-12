"use client"

import { useEffect, useMemo, useState } from "react"
import { WorkflowStageShell } from "@/components/workflow/workflow-stage-shell"
import { StageDataCard, type StageDataCol } from "@/components/stage-list-extra/stage-data-card"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { StageActionBar } from "@/components/stage-list"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileUploadField } from "@/components/file-upload-field"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { isStaleWriteError } from "@/lib/stale-write"
import { depotApi, orderApi, returnApi } from "@/lib/api-service"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Boxes, Info, Loader2, PackageOpen, Scale } from "lucide-react"
import { cn } from "@/lib/utils"
import { fmtDate, fmtNum } from "@/lib/table-format"

const today = () => new Date().toISOString().split("T")[0]
const num = (v: any) => parseFloat(v) || 0
const round4 = (n: number) => Math.round((n + Number.EPSILON) * 10000) / 10000

const dash = (v: any) => (v === null || v === undefined || v === "" ? "—" : String(v))
const fmtN = (n: number) => n.toFixed(4)

const NUM = "font-mono tabular-nums min-w-[110px]"
const DT = "font-mono tabular-nums min-w-[110px]"

const PENDING_COLUMNS: StageDataCol<any>[] = [
  { id: "order_no", label: "DO Number", align: "left", accessor: (r) => r.order.orderNo, render: (r) => <span className="font-bold text-slate-700">{r.order.orderNo}</span> },
  { id: "dsr", label: "DSR", align: "left", accessor: (r) => r.dispatch?.dsrNumber, render: (r) => dash(r.dispatch?.dsrNumber) },
  { id: "customer", label: "Customer", align: "left", accessor: (r) => r.customer?.customerName, cellClassName: "font-medium", render: (r) => dash(r.customer?.customerName) },
  { id: "invoice", label: "Original Invoice", align: "left", accessor: (r) => r.order.refInvoiceNo, render: (r) => <span className="font-bold text-slate-700">{dash(r.order.refInvoiceNo)}</span> },
  { id: "product", label: "Product", align: "left", accessor: (r) => r.sku?.skuName, render: (r) => dash(r.sku?.skuName) },
  { id: "qty", label: "Qty Sent Back", type: "number", align: "right", accessor: (r) => num(r.gate.expectedQty), tone: "blue", cellClassName: NUM, render: (r) => fmtNum(num(r.gate.expectedQty), 4) },
  { id: "reason", label: "Reason", align: "left", accessor: (r) => r.order.returnReason, render: (r) => dash(r.order.returnReason) },
  { id: "vehicle", label: "Vehicle", align: "left", accessor: (r) => r.vehicle?.registrationNo, render: (r) => dash(r.vehicle?.registrationNo) },
  { id: "planned", label: "Planned", type: "date", align: "right", accessor: (r) => r.gate.plannedAt, cellClassName: DT, render: (r) => fmtDate(r.gate.plannedAt) },
]

const HISTORY_COLUMNS: StageDataCol<any>[] = [
  { id: "received_on", label: "Received On", type: "date", align: "right", accessor: (r) => r.gate.receivedDate, cellClassName: DT, render: (r) => fmtDate(r.gate.receivedDate) },
  { id: "order_no", label: "DO Number", align: "left", accessor: (r) => r.order.orderNo, render: (r) => <span className="font-bold text-slate-700">{r.order.orderNo}</span> },
  { id: "customer", label: "Customer", align: "left", accessor: (r) => r.customer?.customerName, cellClassName: "font-medium", render: (r) => dash(r.customer?.customerName) },
  { id: "invoice", label: "Original Invoice", align: "left", accessor: (r) => r.order.refInvoiceNo, render: (r) => dash(r.order.refInvoiceNo) },
  { id: "product", label: "Product", align: "left", accessor: (r) => r.sku?.skuName, render: (r) => dash(r.sku?.skuName) },
  { id: "batch", label: "Batch No.", align: "left", accessor: (r) => r.gate.batchNo, render: (r) => dash(r.gate.batchNo) },
  { id: "expiry", label: "Expiry", type: "date", align: "right", accessor: (r) => r.gate.expiryDate, cellClassName: DT, render: (r) => fmtDate(r.gate.expiryDate) },
  { id: "expected", label: "Expected", type: "number", align: "right", accessor: (r) => num(r.gate.expectedQty), tone: "blue", cellClassName: NUM, render: (r) => fmtNum(num(r.gate.expectedQty), 4) },
  { id: "received", label: "Received", type: "number", align: "right", accessor: (r) => num(r.gate.receivedQty), tone: "purple", cellClassName: NUM, render: (r) => fmtNum(num(r.gate.receivedQty), 4) },
  { id: "good", label: "Good (restocked)", type: "number", align: "right", accessor: (r) => num(r.gate.goodQty), tone: "emerald", cellClassName: cn(NUM, "font-semibold text-emerald-600"), render: (r) => fmtNum(num(r.gate.goodQty), 4) },
  {
    id: "damaged", label: "Damaged", type: "number", align: "right", accessor: (r) => num(r.gate.damagedQty), tone: "amber", cellClassName: NUM,
    render: (r) => <span className={cn(num(r.gate.damagedQty) > 0 && "text-amber-700")}>{fmtNum(num(r.gate.damagedQty), 4)}</span>,
  },
  { id: "disposition", label: "Disposition", align: "left", accessor: (r) => r.gate.damagedDisposition, render: (r) => (num(r.gate.damagedQty) > 0 ? dash(r.gate.damagedDisposition) : "—") },
  { id: "shortage", label: "Shortage", type: "number", align: "right", accessor: (r) => num(r.gate.shortageQty), tone: "red", cellClassName: NUM, render: (r) => <span className={cn(num(r.gate.shortageQty) > 0 && "font-semibold text-red-600")}>{fmtNum(num(r.gate.shortageQty), 4)}</span> },
  { id: "depot", label: "Restock Depot", align: "left", accessor: (r) => r.restockDepotName, render: (r) => dash(r.restockDepotName) },
  { id: "rst", label: "RST No.", align: "left", accessor: (r) => r.gate.rstNo, render: (r) => dash(r.gate.rstNo) },
  { id: "net_wt", label: "Net Wt (kg)", type: "number", align: "right", accessor: (r) => (r.gate.netWeight != null ? num(r.gate.netWeight) : null), total: true, tone: "blue", cellClassName: NUM, render: (r) => (r.gate.netWeight != null ? fmtNum(num(r.gate.netWeight), 4) : "—") },
  { id: "wt_diff", label: "Wt Diff (kg)", type: "number", align: "right", accessor: (r) => (r.gate.weightDifference != null ? num(r.gate.weightDifference) : null), total: true, tone: "amber", cellClassName: NUM, render: (r) => <span className={cn(Math.abs(num(r.gate.weightDifference)) > 0.5 && "font-semibold text-amber-700")}>{r.gate.weightDifference != null ? fmtNum(num(r.gate.weightDifference), 4) : "—"}</span> },
  { id: "remarks", label: "Remarks", accessor: (r) => r.gate.remarks, align: "left", render: (r) => <span className="block max-w-[200px] truncate" title={r.gate.remarks || ""}>{dash(r.gate.remarks)}</span> },
]

const emptyForm = () => ({
  receivedDate: today(),
  receivedQty: "",
  goodQty: "",
  damagedQty: "",
  damagedDisposition: "",
  restockDepotId: "",
  batchNo: "",
  expiryDate: "",
  remarks: "",
  receivedProof: "",
  receivedProofName: "",
  rstNo: "",
  weighmentSlip: "",
  weighmentSlipName: "",
  grossWeight: "",
  tareWeight: "",
  weightDifferenceReason: "",
})

export default function UnloadReturnedStockPage() {
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
  const [isUploading, setIsUploading] = useState(false)
  const [isUploadingSlip, setIsUploadingSlip] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const filters = {
    search: filterValues.search || undefined,
    customer_name: filterValues.partyName && filterValues.partyName !== "all" ? filterValues.partyName : undefined,
    start_date: filterValues.startDate || undefined,
    end_date: filterValues.endDate || undefined,
  }

  const { data: pendingData, isLoading: isPendingLoading } = useQuery({
    queryKey: ["return-unloading-pending", filterValues],
    queryFn: async () => {
      const res = await returnApi.getPendingUnloadings({ ...filters, limit: 100 })
      return res.success ? res.data : { returns: [] }
    },
  })
  const pending: any[] = pendingData?.returns || []

  const { data: historyData, isLoading: isHistoryLoading } = useQuery({
    queryKey: ["return-unloading-history", filterValues],
    enabled: activeTab === "history",
    queryFn: async () => {
      const res = await returnApi.getUnloadingHistory({ ...filters, limit: 100 })
      return res.success ? res.data : { returns: [] }
    },
  })
  const history: any[] = historyData?.returns || []

  const { data: depots = [] } = useQuery({
    queryKey: ["depots-all"],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const res = await depotApi.getAll({ all: "true" })
      return res.success ? (res.data?.depots || (Array.isArray(res.data) ? res.data : [])) : []
    },
  })

  const { data: options } = useQuery({
    queryKey: ["return-options"],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const res = await returnApi.getOptions()
      return res.success ? res.data : { reasons: [], dispositions: ["Reprocess", "Scrap"] }
    },
  })
  const dispositions: string[] = options?.dispositions?.length ? options.dispositions : ["Reprocess", "Scrap"]

  const selected = useMemo(() => pending.find((r) => r.gate.id === selectedId), [pending, selectedId])
  const expected = num(selected?.gate?.expectedQty)

  const openDialog = () => {
    if (!selected) return
    setForm({
      ...emptyForm(),
      receivedQty: String(expected),
      goodQty: String(expected),
      damagedQty: "0",
      restockDepotId: selected.order.depotId ? String(selected.order.depotId) : "",
    })
    setIsDialogOpen(true)
  }

  // Keep good + damaged = received: editing received/damaged re-derives the good qty.
  const setReceived = (v: string) =>
    setForm((f) => ({ ...f, receivedQty: v, goodQty: String(Math.max(0, round4(num(v) - num(f.damagedQty)))) }))
  const setDamaged = (v: string) =>
    setForm((f) => ({ ...f, damagedQty: v, goodQty: String(Math.max(0, round4(num(f.receivedQty) - num(v)))) }))

  const received = num(form.receivedQty)
  const good = num(form.goodQty)
  const damaged = num(form.damagedQty)
  const shortage = Math.max(0, round4(expected - received))
  const splitOk = Math.abs(good + damaged - received) < 0.0001
  const overReceived = received > expected + 0.0001
  const needsDisposition = damaged > 0
  const needsDepot = good > 0

  // Weighment: truck weighed loaded (gross) and empty (tare); net is compared with the items' total gross weight.
  const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000
  const skuGross = num(selected?.sku?.grossWeight)
  const grossWt = num(form.grossWeight)
  const tareWt = num(form.tareWeight)
  const netWt = round3(grossWt - tareWt)
  const expectedWt = round3(skuGross * received)
  const diffWt = round3(netWt - expectedWt)
  const diffTolerance = Math.max(0.5, expectedWt * 0.01)
  const needsDiffReason = received > 0 && expectedWt > 0 && grossWt > 0 && Math.abs(diffWt) > diffTolerance
  const error = !form.receivedDate
    ? "Received date is required"
    : received > 0 && !form.batchNo.trim()
      ? "Batch number of the returned goods is required"
    : received > 0 && !form.rstNo.trim()
      ? "RST No. is required"
    : received > 0 && !form.weighmentSlip
      ? "Upload the weighing slip"
    : received > 0 && !(grossWt > 0 && form.tareWeight !== "" && tareWt >= 0)
      ? "Gross weight and tare weight are required"
    : received > 0 && grossWt <= tareWt
      ? "Gross weight must be more than the tare weight"
    : needsDiffReason && !form.weightDifferenceReason.trim()
      ? "Enter the reason for the weight difference"
    : received < 0 || good < 0 || damaged < 0
      ? "Quantities cannot be negative"
      : overReceived
        ? `Received qty cannot exceed the ${expected} sent back`
        : !splitOk
          ? "Good + damaged must equal the received qty"
          : needsDisposition && !form.damagedDisposition
            ? "Choose what happens to the damaged qty"
            : needsDepot && !form.restockDepotId
              ? "Select the restock depot"
              : ""
  const canSave = !isProcessing && !isReadOnly && !error

  const upload = async (file: File, kind: "proof" | "slip" = "proof") => {
    const setBusy = kind === "slip" ? setIsUploadingSlip : setIsUploading
    setBusy(true)
    try {
      const res = await orderApi.uploadFile(file)
      if (res.success) {
        setForm((f) =>
          kind === "slip"
            ? { ...f, weighmentSlip: res.data.url, weighmentSlipName: file.name }
            : { ...f, receivedProof: res.data.url, receivedProofName: file.name },
        )
      }
    } catch (e: any) {
      toast({ title: "Upload Failed", description: e.message || "Could not upload the file", variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  const handleSubmit = async () => {
    if (!selected || !canSave) return
    setIsProcessing(true)
    try {
      const res = await returnApi.submitUnloading(selected.gate.id, {
        receivedDate: form.receivedDate,
        receivedQty: received,
        goodQty: good,
        damagedQty: damaged,
        damagedDisposition: damaged > 0 ? form.damagedDisposition : null,
        restockDepotId: good > 0 ? Number(form.restockDepotId) : null,
        batchNo: form.batchNo.trim() || null,
        expiryDate: form.expiryDate || null,
        remarks: form.remarks || null,
        receivedProof: form.receivedProof || null,
        rstNo: form.rstNo.trim() || null,
        weighmentSlip: form.weighmentSlip || null,
        grossWeight: grossWt || null,
        tareWeight: form.tareWeight === "" ? null : tareWt,
        weightDifferenceReason: form.weightDifferenceReason.trim() || null,
      })
      if (res.success) {
        toast({
          title: "Returned Stock Recorded",
          description: `${good} restocked (deducted from Sales)${damaged ? `, ${damaged} held (${form.damagedDisposition})` : ""}.${res.data?.documentsQueued ? " Sent to Billing: Stage 19 - Issue Documents Against Returned Stock." : ""}`,
        })
        setIsDialogOpen(false)
        setSelectedId(null)
        queryClient.invalidateQueries({ queryKey: ["return-unloading-pending"] })
        queryClient.invalidateQueries({ queryKey: ["return-unloading-history"] })
        queryClient.invalidateQueries({ queryKey: ["inventory"] })
      } else {
        toast({ title: "Error", description: res.message || "Could not save", variant: "destructive" })
      }
    } catch (e: any) {
      toast({
        title: isStaleWriteError(e) ? "Already processed" : "Error",
        description: e.message || "An unexpected error occurred",
        variant: "destructive",
      })
      queryClient.invalidateQueries({ queryKey: ["return-unloading-pending"] })
    } finally {
      setIsProcessing(false)
    }
  }

  useEffect(() => {
    if (!isDialogOpen) return
    // nothing to sync - kept so the dialog resets cleanly if the row disappears underneath it
    if (!selected) setIsDialogOpen(false)
  }, [isDialogOpen, selected])

  return (
    <WorkflowStageShell
      headerActions={
        activeTab === "pending" ? (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9" title="How unloading works" aria-label="How unloading works">
                <Info className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[380px] space-y-2 p-4">
              <p className="text-sm font-semibold text-slate-900">Unload returned stock</p>
              <ul className="space-y-1.5 text-xs text-slate-600">
                <li>Record weighment and RST for the returned stock: receive, weigh, check and restock.</li>
                <li><b>Good quantity</b> is deducted from Sales at the depot you choose (Inventory tab).</li>
                <li><b>Damaged quantity</b> is held for reprocessing or scrap.</li>
                <li>Billing then issues the documents at Stage 19.</li>
              </ul>
            </PopoverContent>
          </Popover>
        ) : null
      }
      persistKey="unload-returned-stock"
      partyNames={[]}
      title="Stage 18: Unload Returned Stock"
      description="Receive, weigh, check and restock returned stock."
      pendingCount={pending.length}
      historyData={[]}
      onFilterChange={setFilterValues}
      showStatusFilter={false}
      stageLevel={13}
      onTabChange={setActiveTab}
      showDateFilters={true}
      showSaudaFilter={false}
      dateLabel="DO Date"
      searchPlaceholder="Search DO / Customer / Invoice..."
      isHistoryLoading={isHistoryLoading}
      historyContent={
        <StageDataCard
          storageKey="unload-returned-stock-history"
          title="Returned Stock Received"
          description="Returned stock unloaded, weighed and restocked."
          rows={history}
          columns={HISTORY_COLUMNS}
          rowKey={(r: any) => r.gate.id}
          loading={isHistoryLoading}
          emptyText="No returned stock received yet."
          selects={[{ id: "depot", allLabel: "All Depots", getValue: (r: any) => r.restockDepotName }]}
          format={fmtN}
        />
      }
    >
      <div className="space-y-4">
        <StageActionBar>
          <Button onClick={openDialog} disabled={!selected || isReadOnly} className="bg-blue-600 hover:bg-blue-700">
            <PackageOpen className="mr-2 h-4 w-4" />
            Unload Returned Stock
          </Button>
        </StageActionBar>

        <StageDataCard
          storageKey="unload-returned-stock"
          title="Returns To Unload"
          description="Returned stock waiting to be unloaded, weighed and restocked."
          rows={pending}
          columns={PENDING_COLUMNS}
          rowKey={(r: any) => r.gate.id}
          loading={isPendingLoading}
          emptyText="No returned stock waiting to be unloaded."
          selects={[{ id: "vehicle", allLabel: "All Vehicles", getValue: (r: any) => r.vehicle?.registrationNo }]}
          leading={{
            cell: (r: any) => (
              <Checkbox checked={selectedId === r.gate.id} onCheckedChange={() => setSelectedId(selectedId === r.gate.id ? null : r.gate.id)} />
            ),
          }}
          rowClassName={(r: any) => (selectedId === r.gate.id ? "bg-blue-50/50" : undefined)}
          format={fmtN}
        />
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[95vh] w-[calc(100vw-0.75rem)] max-w-[calc(100vw-0.75rem)] overflow-x-hidden overflow-y-auto p-0 [overflow-wrap:anywhere] sm:!max-w-[95vw]">
          <div className="p-3 sm:p-6">
            <DialogHeader className="min-w-0">
              <DialogTitle className="break-words text-lg font-bold text-slate-900 sm:text-xl">
                Unload Returned Stock - {selected?.order.orderNo}
              </DialogTitle>
              <DialogDescription className="sr-only">Confirm the returned quantity received, its condition and where the good stock is restocked</DialogDescription>
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
                        <span className="text-xs font-bold leading-none text-blue-100">{selected.dispatch.dsrNumber} · {selected.vehicle?.registrationNo || "No vehicle"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-slate-100 bg-slate-50 px-3 py-5 sm:px-5">
                    <div className="grid grid-cols-2 gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:grid-cols-4 sm:gap-6 sm:p-6">
                      {[
                        ["Product", selected.sku?.skuName || "—"],
                        ["Original Invoice", selected.order.refInvoiceNo || "—"],
                        ["Return Reason", selected.order.returnReason || "—"],
                        ["Qty Sent Back", fmtNum(expected, 4)],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <p className="mb-1 text-[10px] font-bold uppercase leading-none tracking-widest text-slate-500">{label}</p>
                          <p className="text-sm font-semibold text-slate-900">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-6 rounded-lg border bg-white p-4 shadow-sm sm:p-6">
                  <h3 className="flex items-center gap-2 border-b pb-2 text-sm font-bold text-slate-800">
                    <PackageOpen className="h-4 w-4 text-blue-600" />
                    Goods Received
                  </h3>
                  <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-2">
                      <Label>Received Date <span className="text-red-500">*</span></Label>
                      <Input type="date" className="h-10" value={form.receivedDate} onChange={(e) => setForm((f) => ({ ...f, receivedDate: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Received Qty <span className="text-red-500">*</span></Label>
                      <Input type="number" min={0} className="h-10" value={form.receivedQty} onChange={(e) => setReceived(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Damaged Qty</Label>
                      <Input type="number" min={0} className="h-10" value={form.damagedQty} onChange={(e) => setDamaged(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Good Qty (restock)</Label>
                      <Input type="number" min={0} className="h-10 bg-muted" value={form.goodQty} readOnly />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-2">
                      <Label>Batch No. {received > 0 && <span className="text-red-500">*</span>}</Label>
                      <Input className="h-10" placeholder="Batch of the returned goods" value={form.batchNo} onChange={(e) => setForm((f) => ({ ...f, batchNo: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Expiry / Best Before</Label>
                      <Input type="date" className="h-10" value={form.expiryDate} onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))} />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm">
                    <span className="text-slate-600">
                      Sent back <b className="text-slate-900">{expected}</b> · received <b className="text-slate-900">{received}</b>
                    </span>
                    {shortage > 0 ? (
                      <span className="font-semibold text-red-600">Shortage {shortage}</span>
                    ) : (
                      <span className="text-emerald-600">No shortage</span>
                    )}
                  </div>
                </div>

                <div className="space-y-6 rounded-lg border bg-white p-4 shadow-sm sm:p-6">
                  <h3 className="flex items-center gap-2 border-b pb-2 text-sm font-bold text-slate-800">
                    <Scale className="h-4 w-4 text-amber-600" />
                    Weighment (RST)
                  </h3>
                  <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-2">
                      <Label>RST No. {received > 0 && <span className="text-red-500">*</span>}</Label>
                      <Input className="h-10" placeholder="Weighbridge RST no." value={form.rstNo} onChange={(e) => setForm((f) => ({ ...f, rstNo: e.target.value }))} />
                    </div>
                    <div className="space-y-2 md:col-span-1 lg:col-span-1">
                      <FileUploadField
                        label={<Label>Weighing Slip {received > 0 && <span className="text-red-500">*</span>}</Label>}
                        accept="image/*,.pdf"
                        value={form.weighmentSlip}
                        fileName={form.weighmentSlipName}
                        uploading={isUploadingSlip}
                        buttonText={form.weighmentSlipName ? "REPLACE" : "UPLOAD"}
                        onFilesSelected={(files) => files[0] && upload(files[0], "slip")}
                        onRemove={() => setForm((f) => ({ ...f, weighmentSlip: "", weighmentSlipName: "" }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-2">
                      <Label>Gross Wt (kg) - truck loaded {received > 0 && <span className="text-red-500">*</span>}</Label>
                      <Input type="number" min={0} className="h-10" placeholder="Weighed on arrival" value={form.grossWeight} onChange={(e) => setForm((f) => ({ ...f, grossWeight: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Tare Wt (kg) - truck empty {received > 0 && <span className="text-red-500">*</span>}</Label>
                      <Input type="number" min={0} className="h-10" placeholder="Weighed after unloading" value={form.tareWeight} onChange={(e) => setForm((f) => ({ ...f, tareWeight: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Net Weight (kg)</Label>
                      <Input className="h-10 bg-muted" readOnly value={grossWt > 0 ? String(netWt) : ""} placeholder="Gross − Tare" />
                    </div>
                    <div className="space-y-2">
                      <Label>Total Items Gross Wt (kg)</Label>
                      <Input className="h-10 bg-muted" readOnly value={expectedWt > 0 ? String(expectedWt) : ""} placeholder="SKU gross wt × received qty" />
                    </div>
                  </div>
                  {grossWt > 0 && expectedWt > 0 && (
                    <div className={cn("flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm", needsDiffReason ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-700")}>
                      <span>Net weight vs items' total gross weight</span>
                      <span className="font-semibold tabular-nums">{diffWt > 0 ? "+" : ""}{diffWt} kg {needsDiffReason ? "· reason required" : "· within tolerance"}</span>
                    </div>
                  )}
                  {needsDiffReason && (
                    <div className="space-y-2">
                      <Label>Reason for weight difference <span className="text-red-500">*</span></Label>
                      <Input className="h-10" placeholder="Why does the net weight differ from the items' gross weight?" value={form.weightDifferenceReason} onChange={(e) => setForm((f) => ({ ...f, weightDifferenceReason: e.target.value }))} />
                    </div>
                  )}
                </div>
                
                                <div className="space-y-6 rounded-lg border bg-white p-4 shadow-sm sm:p-6">
                  <h3 className="flex items-center gap-2 border-b pb-2 text-sm font-bold text-slate-800">
                    <Boxes className="h-4 w-4 text-emerald-600" />
                    Disposition
                  </h3>
                  <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Restock Depot {needsDepot && <span className="text-red-500">*</span>}</Label>
                      <Select value={form.restockDepotId} onValueChange={(v) => setForm((f) => ({ ...f, restockDepotId: v }))} disabled={!needsDepot}>
                        <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Select depot" /></SelectTrigger>
                        <SelectContent>
                          {depots.map((d: any) => (
                            <SelectItem key={d.id} value={String(d.id)}>{d.depot_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-slate-500">Good quantity is added to this depot&apos;s stock.</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Damaged Qty Goes To {needsDisposition && <span className="text-red-500">*</span>}</Label>
                      <Select value={form.damagedDisposition} onValueChange={(v) => setForm((f) => ({ ...f, damagedDisposition: v }))} disabled={!needsDisposition}>
                        <SelectTrigger className="h-10 w-full"><SelectValue placeholder={needsDisposition ? "Reprocess / Scrap" : "No damaged qty"} /></SelectTrigger>
                        <SelectContent>
                          {dispositions.map((d) => (<SelectItem key={d} value={d}>{d}</SelectItem>))}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-slate-500">Not added to saleable stock.</p>
                    </div>
                    <div className="space-y-2">
                      <FileUploadField
                        label={<Label>Receiving Proof</Label>}
                        accept="image/*,.pdf"
                        value={form.receivedProof}
                        fileName={form.receivedProofName}
                        uploading={isUploading}
                        buttonText={form.receivedProofName ? "REPLACE" : "UPLOAD"}
                        onFilesSelected={(files) => files[0] && upload(files[0])}
                        onRemove={() => setForm((f) => ({ ...f, receivedProof: "", receivedProofName: "" }))}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2 lg:col-span-3">
                      <Label>Remarks</Label>
                      <Input className="h-10" value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} placeholder="Condition, packaging, anything notable" />
                    </div>
                  </div>
                  {error && <p className="text-sm font-medium text-red-600">{error}</p>}
                </div>
              </div>
            )}

            <DialogFooter className="-mx-3 -mb-3 mt-8 gap-2 border-t bg-gray-50 px-3 py-4 pt-4 sm:-mx-6 sm:-mb-6 sm:gap-0 sm:px-6">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isProcessing} className="w-full sm:w-auto">Cancel</Button>
              <Button onClick={handleSubmit} disabled={!canSave} className="w-full min-w-[150px] bg-blue-600 hover:bg-blue-700 sm:w-auto">
                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isProcessing ? "Processing..." : "Confirm Receipt"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </WorkflowStageShell>
  )
}
