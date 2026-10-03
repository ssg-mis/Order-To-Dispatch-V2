"use client"

import { useEffect, useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { WorkflowStageShell } from "@/components/workflow/workflow-stage-shell"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
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
import { Boxes, Loader2, PackageOpen } from "lucide-react"
import { cn } from "@/lib/utils"

const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString("en-IN") : "—")
const today = () => new Date().toISOString().split("T")[0]
const num = (v: any) => parseFloat(v) || 0
const round4 = (n: number) => Math.round((n + Number.EPSILON) * 10000) / 10000

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
  const error = !form.receivedDate
    ? "Received date is required"
    : received > 0 && !form.batchNo.trim()
      ? "Batch number of the returned goods is required"
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

  const upload = async (file: File) => {
    setIsUploading(true)
    try {
      const res = await orderApi.uploadFile(file)
      if (res.success) setForm((f) => ({ ...f, receivedProof: res.data.url, receivedProofName: file.name }))
    } catch (e: any) {
      toast({ title: "Upload Failed", description: e.message || "Could not upload the file", variant: "destructive" })
    } finally {
      setIsUploading(false)
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
      })
      if (res.success) {
        const shortVsCn = Number(res.data?.shortAgainstCreditNote) || 0
        toast({
          title: "Returned Stock Recorded",
          description: `${good} restocked${damaged ? `, ${damaged} held (${form.damagedDisposition})` : ""}${shortVsCn > 0 ? `. Note: ${shortVsCn} less than the credit note (${res.data?.creditNoteNo || "CN"}) was received - review the credit note.` : ""}`,
          ...(shortVsCn > 0 ? { variant: "destructive" as const } : {}),
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
      partyNames={[]}
      title="Stage 18: Unload Returned Stock"
      description="Receive the returned goods, check them (batch, condition) and restock the good quantity actually received."
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
        <Card className="border-none shadow-sm overflow-hidden py-0 gap-0">
          <div className="max-h-[600px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                <TableRow className="bg-slate-50">
                  {["Received On", "DO Number", "Customer", "Original Invoice", "Product", "Batch No.", "Expiry", "Expected", "Received", "Good (restocked)", "Damaged", "Shortage", "Restock Depot", "Remarks"].map((h) => (
                    <TableHead key={h} className="whitespace-nowrap text-center">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isHistoryLoading ? (
                  <TableRow><TableCell colSpan={14} className="py-10 text-center text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading…</TableCell></TableRow>
                ) : history.length === 0 ? (
                  <TableRow><TableCell colSpan={14} className="py-10 text-center text-slate-500">No returned stock received yet.</TableCell></TableRow>
                ) : (
                  history.map((r) => (
                    <TableRow key={r.gate.id}>
                      <TableCell className="text-center text-xs">{fmtDate(r.gate.receivedDate)}</TableCell>
                      <TableCell className="text-center text-xs font-bold text-slate-700">{r.order.orderNo}</TableCell>
                      <TableCell className="text-center text-xs font-medium">{r.customer?.customerName || "—"}</TableCell>
                      <TableCell className="text-center text-xs">{r.order.refInvoiceNo || "—"}</TableCell>
                      <TableCell className="text-center text-xs">{r.sku?.skuName || "—"}</TableCell>
                      <TableCell className="text-center text-xs">{r.gate.batchNo || "—"}</TableCell>
                      <TableCell className="text-center text-xs">{fmtDate(r.gate.expiryDate)}</TableCell>
                      <TableCell className="text-center text-xs tabular-nums">{num(r.gate.expectedQty)}</TableCell>
                      <TableCell className="text-center text-xs tabular-nums">{num(r.gate.receivedQty)}</TableCell>
                      <TableCell className="text-center text-xs font-semibold text-emerald-600 tabular-nums">{num(r.gate.goodQty)}</TableCell>
                      <TableCell className="text-center text-xs tabular-nums">
                        {num(r.gate.damagedQty) > 0 ? (
                          <span className="text-amber-700">{num(r.gate.damagedQty)} <Badge className="ml-1 bg-amber-100 text-amber-700">{r.gate.damagedDisposition}</Badge></span>
                        ) : "0"}
                      </TableCell>
                      <TableCell className={cn("text-center text-xs tabular-nums", num(r.gate.shortageQty) > 0 && "font-semibold text-red-600")}>{num(r.gate.shortageQty)}</TableCell>
                      <TableCell className="text-center text-xs">{r.restockDepotName || "—"}</TableCell>
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            <Boxes className="mr-1.5 inline h-4 w-4 align-text-bottom" />
            Good quantity is added to inventory at the depot you choose. Damaged quantity is held for reprocessing or scrap.
          </p>
          <Button onClick={openDialog} disabled={!selected || isReadOnly} className="bg-blue-600 hover:bg-blue-700">
            <PackageOpen className="mr-2 h-4 w-4" />
            Unload Returned Stock
          </Button>
        </div>

        <Card className="gap-0 overflow-hidden border-none py-0 shadow-sm">
          <div className="max-h-[600px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                <TableRow className="bg-slate-50">
                  <TableHead className="w-10" />
                  {["DO Number", "DSR", "Customer", "Original Invoice", "Product", "Qty Sent Back", "Reason", "Vehicle", "Planned"].map((h) => (
                    <TableHead key={h} className="whitespace-nowrap text-center">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isPendingLoading ? (
                  <TableRow><TableCell colSpan={10} className="py-10 text-center text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading…</TableCell></TableRow>
                ) : pending.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="py-10 text-center text-slate-500">No returned stock waiting to be unloaded.</TableCell></TableRow>
                ) : (
                  pending.map((r) => (
                    <TableRow key={r.gate.id} className={cn(selectedId === r.gate.id && "bg-blue-50/50")}>
                      <TableCell className="text-center">
                        <Checkbox checked={selectedId === r.gate.id} onCheckedChange={() => setSelectedId(selectedId === r.gate.id ? null : r.gate.id)} />
                      </TableCell>
                      <TableCell className="text-center text-xs font-bold text-slate-700">{r.order.orderNo}</TableCell>
                      <TableCell className="text-center text-xs">{r.dispatch.dsrNumber || "—"}</TableCell>
                      <TableCell className="text-center text-xs font-medium">{r.customer?.customerName || "—"}</TableCell>
                      <TableCell className="text-center text-xs font-bold text-slate-700">{r.order.refInvoiceNo || "—"}</TableCell>
                      <TableCell className="text-center text-xs">{r.sku?.skuName || "—"}</TableCell>
                      <TableCell className="text-center text-xs font-semibold tabular-nums">{num(r.gate.expectedQty)}</TableCell>
                      <TableCell className="text-center text-xs">{r.order.returnReason || "—"}</TableCell>
                      <TableCell className="text-center text-xs">{r.vehicle?.registrationNo || "—"}</TableCell>
                      <TableCell className="text-center text-xs">{fmtDate(r.gate.plannedAt)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
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
                        ["Qty Sent Back", String(expected)],
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
