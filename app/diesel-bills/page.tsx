"use client"

import { useEffect, useMemo, useState } from "react"
import { WorkflowStageShell } from "@/components/workflow/workflow-stage-shell"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StageDataCard, type StageDataCol } from "@/components/stage-list-extra/stage-data-card"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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
import { orderApi, dieselBillApi } from "@/lib/api-service"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Info, BadgeCheck, Fuel, Loader2, Lock, Plus, Save, Truck } from "lucide-react"
import { cn } from "@/lib/utils"
import { fmtDate, fmtNum } from "@/lib/table-format"

const money = (v: any) =>
  `₹${(parseFloat(v || 0) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const num = (v: any) => parseFloat(v) || 0
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

const statusClass = (s: string) =>
  cn(
    s === "Approved" ? "bg-emerald-100 text-emerald-700" : "",
    s === "Submitted" ? "bg-blue-100 text-blue-700" : "",
    s === "Pending" ? "bg-amber-100 text-amber-700" : "",
  )

const SectionTitle = ({ icon: Icon, children }: { icon: any; children: React.ReactNode }) => (
  <h3 className="flex items-center gap-2 border-b pb-2 text-sm font-bold text-slate-800">
    <Icon className="h-4 w-4 text-blue-600" />
    {children}
  </h3>
)

const Field = ({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) => (
  <div>
    <p className="mb-1 text-[10px] font-bold uppercase leading-none tracking-widest text-slate-500">{label}</p>
    <p className={cn("text-sm font-semibold text-slate-900", className)}>{value || "—"}</p>
  </div>
)

const legText = (kind?: string, leg?: number) => `${kind || "Normal trip"}${leg && leg > 1 ? " · Leg 2" : ""}`

const dash = (v: any) => (v === null || v === undefined || v === "" ? "—" : String(v))
const diffOf = (b: any) => round2(num(b.actual_amount) - num(b.planned_amount))

const baseDieselCols = (): StageDataCol<any>[] => [
  { id: "invoice", label: "Invoice / Trip", align: "left", accessor: (b) => b.invoice_no || b.trip_key, render: (b) => <span className="font-bold text-slate-700">{b.invoice_no || b.trip_key}</span> },
  { id: "trip", label: "Trip", align: "left", accessor: (b) => legText(b.trip_kind, b.leg), cellClassName: "whitespace-nowrap", render: (b) => legText(b.trip_kind, b.leg) },
]
const dieselCustomerCol = (): StageDataCol<any> => ({
  id: "customer", label: "Customer", align: "left", accessor: (b) => b.customer_names, cellClassName: "font-medium",
  render: (b) => <span className="block max-w-[200px] truncate" title={b.customer_names || ""}>{dash(b.customer_names)}</span>,
})
const pumpCol = (): StageDataCol<any> => ({ id: "pump", label: "Fuel Station", align: "left", accessor: (b) => b.pump_name, render: (b) => dash(b.pump_name) })
const amountCols = (): StageDataCol<any>[] => [
  { id: "planned_amt", label: "Planned (₹)", type: "number", align: "right", accessor: (b) => num(b.planned_amount), total: true, tone: "blue", cellClassName: "font-mono tabular-nums min-w-[110px]", render: (b) => fmtNum(b.planned_amount, 2) },
  { id: "actual_amt", label: "Actual (₹)", type: "number", align: "right", accessor: (b) => num(b.actual_amount), total: true, tone: "purple", cellClassName: "font-mono tabular-nums min-w-[110px] font-semibold text-violet-600", render: (b) => fmtNum(b.actual_amount, 2) },
  {
    id: "diff", label: "Difference (₹)", type: "number", align: "right", accessor: (b) => diffOf(b), total: true, tone: "amber", cellClassName: "font-mono tabular-nums min-w-[110px]",
    render: (b) => {
      const d = diffOf(b)
      return <span className={cn(d > 0 && "text-red-600", d < 0 && "text-emerald-600")}>{d > 0 ? "+" : ""}{fmtNum(d, 2)}</span>
    },
  },
]

const HISTORY_COLUMNS: StageDataCol<any>[] = [
  ...baseDieselCols(), dieselCustomerCol(), pumpCol(),
  { id: "ledger", label: "Ledger", align: "left", accessor: (b) => b.ledger_name, render: (b) => dash(b.ledger_name) },
  ...amountCols(),
  { id: "approved", label: "Approved On", type: "date", align: "right", cellClassName: "font-mono tabular-nums min-w-[110px]", accessor: (b) => b.approved_at, render: (b) => fmtDate(b.approved_at) },
]

const PENDING_COLUMNS: StageDataCol<any>[] = [
  ...baseDieselCols(),
  { id: "orders", label: "DO Number(s)", align: "left", accessor: (b) => b.order_nos, render: (b) => <span className="block max-w-[160px] truncate" title={b.order_nos || ""}>{dash(b.order_nos)}</span> },
  dieselCustomerCol(), pumpCol(), ...amountCols(),
  { id: "status", label: "Status", align: "left", accessor: (b) => b.status, render: (b) => <Badge className={statusClass(b.status)}>{b.status}</Badge> },
  { id: "planned_on", label: "Planned On", type: "date", align: "right", cellClassName: "font-mono tabular-nums min-w-[110px]", accessor: (b) => b.planned_at, render: (b) => fmtDate(b.planned_at) },
]

export default function DieselBillsPage() {
  const { toast } = useToast()
  const { isReadOnly } = useAuth()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending")
  const [filterValues, setFilterValues] = useState({
    status: "", startDate: "", endDate: "", partyName: "", search: "", manualSaudaNo: "",
  })
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [openId, setOpenId] = useState<number | null>(null)
  const [form, setForm] = useState({ actual: "", pumpName: "", ledgerId: "", parchi: "", parchiName: "", remarks: "" })
  const [approvalRemarks, setApprovalRemarks] = useState("")
  const [uploading, setUploading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const filters = {
    search: filterValues.search || undefined,
    customer_name: filterValues.partyName && filterValues.partyName !== "all" ? filterValues.partyName : undefined,
    start_date: filterValues.startDate || undefined,
    end_date: filterValues.endDate || undefined,
  }

  const { data: pendingData, isLoading: isPendingLoading } = useQuery({
    queryKey: ["diesel-bills-pending", filterValues],
    queryFn: async () => {
      const res = await dieselBillApi.getPending({ ...filters, limit: 100 })
      return res.success ? res.data : { bills: [], pagination: { total: 0 } }
    },
  })
  const pending: any[] = pendingData?.bills || []

  const { data: historyData, isLoading: isHistoryLoading } = useQuery({
    queryKey: ["diesel-bills-history", filterValues],
    enabled: activeTab === "history",
    queryFn: async () => {
      const res = await dieselBillApi.getHistory({ ...filters, limit: 100 })
      return res.success ? res.data : { bills: [], pagination: { total: 0 } }
    },
  })
  const history: any[] = historyData?.bills || []

  const { data: access } = useQuery({
    queryKey: ["diesel-bills-access"],
    queryFn: async () => {
      const res = await dieselBillApi.getAccess()
      return res.success ? res.data : { canApprove: false }
    },
  })
  const canApprove = !!access?.canApprove

  const { data: detail, isLoading: isDetailLoading } = useQuery({
    queryKey: ["diesel-bill-detail", openId],
    enabled: !!openId,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await dieselBillApi.getDetail(openId as number)
      return res.success ? res.data : null
    },
  })

  const bill = detail?.bill
  const calc = detail?.calc
  const locked = !!bill?.locked

  // Fill the form from the saved / suggested figures whenever a bill is opened or saved
  useEffect(() => {
    if (!detail) return
    setForm({
      actual: String(detail.calc?.actual ?? 0),
      pumpName: detail.calc?.pump || "",
      ledgerId: String(detail.bill?.ledger_id || detail.suggestedLedger?.id || ""),
      parchi: detail.calc?.parchi || "",
      parchiName: detail.calc?.parchi ? "Diesel parchi" : "",
      remarks: detail.bill?.remarks || "",
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.bill?.id, detail?.bill?.status, detail?.bill?.submitted_at])

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["diesel-bills-pending"] })
    queryClient.invalidateQueries({ queryKey: ["diesel-bills-history"] })
    queryClient.invalidateQueries({ queryKey: ["diesel-bill-detail", openId] })
  }

  const run = async (fn: () => Promise<any>, okTitle: string, okDesc?: string) => {
    setIsProcessing(true)
    try {
      const res = await fn()
      if (res.success) {
        toast({ title: okTitle, description: okDesc || res.message })
        refresh()
        return res
      }
      toast({ title: "Error", description: res.message || "Could not complete the action", variant: "destructive" })
    } catch (error: any) {
      toast({
        title: isStaleWriteError(error) ? "Already processed" : "Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      })
      refresh()
    } finally {
      setIsProcessing(false)
    }
    return null
  }

  const actual = num(form.actual)
  const planned = num(calc?.planned)
  const diff = round2(actual - planned)

  const handleSave = () =>
    run(
      () => dieselBillApi.save(openId as number, {
        actual: form.actual,
        pumpName: form.pumpName || null,
        ledgerId: form.ledgerId ? Number(form.ledgerId) : null,
        parchiFile: form.parchi || null,
        remarks: form.remarks || null,
      }),
      "Saved",
      "Diesel bill saved - waiting for approval",
    )

  const handleApprove = async () => {
    const ok = await run(() => dieselBillApi.approve(openId as number, { remarks: approvalRemarks || null }), "Approved")
    if (ok) setSelectedId(null)
  }

  const handleCreateLedger = async () => {
    const name = form.pumpName.trim()
    if (!name) return
    const res = await run(() => dieselBillApi.createLedger({ name }), "Ledger ready", `"${name}" added under ${detail?.ledgerGroup || "Fuel Stations"}`)
    if (res?.data?.id) setForm((f) => ({ ...f, ledgerId: String(res.data.id) }))
  }

  const uploadParchi = async (file: File) => {
    setUploading(true)
    try {
      const res = await orderApi.uploadFile(file)
      if (res.success) setForm((f) => ({ ...f, parchi: res.data.url, parchiName: file.name }))
    } catch (e: any) {
      toast({ title: "Upload Failed", description: e.message || "Could not upload the file", variant: "destructive" })
    } finally {
      setUploading(false)
    }
  }

  const selected = useMemo(() => pending.find((b) => b.id === selectedId), [pending, selectedId])
  const ledgers: any[] = detail?.ledgers || []
  const pumpHasLedger = ledgers.some((l) => String(l.ledger_name).trim().toLowerCase() === form.pumpName.trim().toLowerCase())

  return (
    <WorkflowStageShell
      headerActions={
        activeTab === "pending" ? (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9" title="How diesel bills work" aria-label="How diesel bills work">
                <Info className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[400px] space-y-2 p-4">
              <p className="text-sm font-semibold text-slate-900">How diesel bills work</p>
              <ul className="list-disc space-y-1.5 pl-4 text-xs text-slate-600">
                <li>One diesel bill per trip. It shows the diesel <b>planned</b> (Plan Vehicle) next to the diesel <b>actually given</b> (Make Invoice).</li>
                <li>After approval the figures are locked and the actual diesel is posted to the fuel station&apos;s ledger under the group <b>Fuel Stations</b>.</li>
                <li>Trips with a vehicle change, an accident, or stock returned to the factory are handled here too.</li>
              </ul>
            </PopoverContent>
          </Popover>
        ) : null
      }
      persistKey="diesel-bills"
      partyNames={[]}
      title="Stage 21: Diesel Bills"
      description="Planned vs actual diesel and ledger posting."
      pendingCount={pending.length}
      historyData={[]}
      onFilterChange={setFilterValues}
      showStatusFilter={false}
      stageLevel={12}
      onTabChange={setActiveTab}
      showDateFilters={true}
      showSaudaFilter={false}
      dateLabel="Dispatch Date"
      searchPlaceholder="Search DO / Customer / Invoice / Fuel station..."
      isHistoryLoading={isHistoryLoading}
      historyContent={
        <StageDataCard
          storageKey="diesel-bills-history"
          title="Approved Diesel Bills"
          description="Approved diesel bills posted to the fuel station ledgers."
          rows={history}
          columns={HISTORY_COLUMNS}
          rowKey={(b: any) => b.id}
          loading={isHistoryLoading}
          emptyText="No approved diesel bills yet."
          selects={[{ id: "pump", allLabel: "All Fuel Stations", getValue: (b: any) => b.pump_name }]}
          onRowClick={(b: any) => setOpenId(b.id)}
          format={(n) => n.toFixed(2)}
        />
      }
    >
      <div className="space-y-4">
        <StageActionBar>
          <Button onClick={() => selected && setOpenId(selected.id)} disabled={!selected} className="bg-blue-600 hover:bg-blue-700">
            <Fuel className="mr-2 h-4 w-4" />
            Open Diesel Bill
          </Button>
        </StageActionBar>

        <StageDataCard
          storageKey="diesel-bills"
          title="Diesel Bills"
          description="Trips waiting for diesel finalisation and ledger posting."
          rows={pending}
          columns={PENDING_COLUMNS}
          rowKey={(b: any) => b.id}
          loading={isPendingLoading}
          emptyText="No diesel bills waiting."
          statusOf={(b: any) => b.status}
          selects={[{ id: "pump", allLabel: "All Fuel Stations", getValue: (b: any) => b.pump_name }]}
          leading={{
            cell: (b: any) => <Checkbox checked={selectedId === b.id} onCheckedChange={() => setSelectedId(selectedId === b.id ? null : b.id)} />,
          }}
          rowClassName={(b: any) => (selectedId === b.id ? "bg-blue-50/50" : undefined)}
          format={(n) => n.toFixed(2)}
        />
      </div>

      {/* Trip-wise diesel bill */}
      <Dialog open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-h-[95vh] w-[calc(100vw-0.75rem)] max-w-[calc(100vw-0.75rem)] overflow-x-hidden overflow-y-auto p-0 [overflow-wrap:anywhere] sm:!max-w-[95vw]">
          <div className="p-3 sm:p-6">
            <DialogHeader className="min-w-0">
              <DialogTitle className="flex flex-wrap items-center gap-3 break-words text-lg font-bold text-slate-900 sm:text-xl">
                Diesel Bill - {detail?.trip?.invoiceNo || detail?.trip?.tripKey || ""}
                {bill && <Badge className={statusClass(bill.status)}>{bill.status}</Badge>}
                {bill && <span className="text-xs font-semibold text-slate-500">{legText(bill.trip_kind, bill.leg)}</span>}
                {locked && <span className="flex items-center gap-1 text-xs font-semibold text-slate-500"><Lock className="h-3.5 w-3.5" />Locked</span>}
              </DialogTitle>
              <DialogDescription className="sr-only">Trip-wise diesel bill with planned and actual diesel</DialogDescription>
            </DialogHeader>

            {isDetailLoading || !detail ? (
              <div className="py-16 text-center text-slate-500"><Loader2 className="mr-2 inline h-5 w-5 animate-spin" />Loading…</div>
            ) : (
              <div className="mt-6 min-w-0 space-y-6">
                {/* Vehicle and what happened on the way */}
                <div className="space-y-4 rounded-lg border bg-white p-4 shadow-sm sm:p-6">
                  <SectionTitle icon={Truck}>Vehicle &amp; Trip</SectionTitle>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <Field label="Vehicle No." value={detail.vehicle?.registration_no} />
                    <Field label="Driver" value={detail.vehicle?.driver_name} />
                    <Field label="Driver Mobile" value={detail.vehicle?.driver_mobile} />
                    <Field label="Transporter" value={detail.vehicle?.transporter_name} />
                  </div>
                  {detail.change && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                      <p className="font-bold uppercase tracking-wide">{detail.change.record_type === "vehicle_change" ? "Vehicle changed mid-transportation" : "Accident mid-transportation"}</p>
                      <p>
                        {detail.change.record_type === "vehicle_change"
                          ? `Reason: ${detail.change.vehicle_change_reason || "—"}`
                          : `On ${fmtDate(detail.change.accident_date)}${detail.change.accident_location ? ` at ${detail.change.accident_location}` : ""} · Cause: ${detail.change.accident_cause || "—"}${detail.change.accident_loss ? ` · Loss: ${detail.change.accident_loss}` : ""}`}
                      </p>
                      {(detail.change.new_vehicle || detail.change.new_transporter) && (
                        <p>New vehicle: {detail.change.new_vehicle || "—"}{detail.change.new_driver ? ` (${detail.change.new_driver})` : ""} · Transporter: {detail.change.new_transporter || "—"} · Diesel advance recorded (₹): {fmtNum(detail.change.diesel_advance, 2)}</p>
                      )}
                      {detail.change.route_decision === "return_to_factory" && <p className="font-semibold">Stock was returned to the factory.</p>}
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-blue-50/60">
                          <TableHead className="px-4 text-left text-xs font-bold text-slate-700">Total</TableHead>
                          <TableHead /><TableHead /><TableHead /><TableHead /><TableHead />
                          <TableHead />
                          <TableHead />
                        </TableRow>
                        <TableRow className="bg-slate-50">
                          {["DO No.", "DSR", "Customer", "Invoice No.", "Invoice Date", "Item", "Qty", "Dispatch Date"].map((h) => (
                            <TableHead key={h} className={cn("whitespace-nowrap px-4 text-xs", ["Invoice Date", "Qty", "Dispatch Date"].includes(h) ? "min-w-[110px] text-right" : "text-left")}>{h}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.items.map((it: any) => (
                          <TableRow key={it.dispatch_id}>
                            <TableCell className="px-4 text-left text-xs font-bold text-slate-700">{it.order_no}</TableCell>
                            <TableCell className="px-4 text-left text-xs">{it.dsr_number || "—"}</TableCell>
                            <TableCell className="px-4 text-left text-xs">{it.customer_name || "—"}</TableCell>
                            <TableCell className="px-4 text-left text-xs">{it.invoice_no || "—"}</TableCell>
                            <TableCell className="px-4 text-right font-mono text-xs tabular-nums">{fmtDate(it.invoice_date)}</TableCell>
                            <TableCell className="px-4 text-left text-xs">{it.sku_name || "—"}</TableCell>
                            <TableCell className="px-4 text-right font-mono text-xs tabular-nums">{fmtNum(it.qty, 4)}</TableCell>
                            <TableCell className="px-4 text-right font-mono text-xs tabular-nums">{fmtDate(it.dispatch_date)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Planned vs actual */}
                <div className="space-y-4 rounded-lg border bg-white p-4 shadow-sm sm:p-6">
                  <SectionTitle icon={Fuel}>Diesel - Planned vs Actual</SectionTitle>
                  <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Planned Diesel (₹)</Label>
                      <Input className="h-10 bg-slate-50" readOnly value={fmtNum(calc.planned, 2)} />
                      <p className="text-[11px] text-slate-500">
                        {bill.leg_source === "reach" ? "As recorded at Reach Vehicle (Stage 13)" : bill.leg_source === "dispatch" ? "As filled at Actual Dispatch" : "As filled at Plan Vehicle"}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Actual Diesel (₹) <span className="text-red-500">*</span></Label>
                      {locked ? (
                        <Input className="h-10 bg-slate-50" readOnly value={fmtNum(calc.actual, 2)} />
                      ) : (
                        <Input type="number" min={0} className="h-10" value={form.actual} disabled={isReadOnly || isProcessing} onChange={(e) => setForm((f) => ({ ...f, actual: e.target.value }))} />
                      )}
                      <p className="text-[11px] text-slate-500">
                        {bill.leg_source === "reach" ? "No Make Invoice for this vehicle - starts from the planned amount" : `As filled at Make Invoice (₹ ${fmtNum(calc.invoiceDiesel, 2)})`}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Difference (Actual - Planned) (₹)</Label>
                      <Input className={cn("h-10 bg-slate-50 font-semibold", (locked ? calc.difference : diff) > 0 && "text-red-600", (locked ? calc.difference : diff) < 0 && "text-emerald-600")} readOnly value={`${(locked ? calc.difference : diff) > 0 ? "+" : ""}${fmtNum(locked ? calc.difference : diff, 2)}`} />
                    </div>
                  </div>
                </div>

                {/* Fuel station and ledger */}
                <div className="space-y-4 rounded-lg border bg-white p-4 shadow-sm sm:p-6">
                  <SectionTitle icon={Fuel}>Fuel Station &amp; Ledger ({detail.ledgerGroup})</SectionTitle>
                  <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Fuel Station / Petrol Pump</Label>
                      {locked ? (
                        <Input className="h-10 bg-slate-50" readOnly value={calc.pump || "—"} />
                      ) : (
                        <Input className="h-10" value={form.pumpName} disabled={isReadOnly || isProcessing} onChange={(e) => setForm((f) => ({ ...f, pumpName: e.target.value }))} placeholder="Name of the fuel station" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Ledger (group {detail.ledgerGroup}) {num(form.actual) > 0 && !locked && <span className="text-red-500">*</span>}</Label>
                      {locked ? (
                        <Input className="h-10 bg-slate-50" readOnly value={ledgers.find((l) => l.id === bill.ledger_id)?.ledger_name || detail.posting?.[0]?.ledger_name || "—"} />
                      ) : (
                        <select
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                          value={form.ledgerId}
                          disabled={isReadOnly || isProcessing}
                          onChange={(e) => setForm((f) => ({ ...f, ledgerId: e.target.value }))}
                        >
                          <option value="">{ledgers.length ? "Select the fuel station ledger" : `No ledger under ${detail.ledgerGroup} yet`}</option>
                          {ledgers.map((l) => (
                            <option key={l.id} value={l.id}>{l.ledger_name} ({l.ledger_code})</option>
                          ))}
                        </select>
                      )}
                      {!locked && canApprove && form.pumpName.trim() && !pumpHasLedger && (
                        <Button type="button" variant="outline" size="sm" className="mt-1 h-8 text-xs" onClick={handleCreateLedger} disabled={isProcessing}>
                          <Plus className="mr-1 h-3.5 w-3.5" />
                          Add ledger &quot;{form.pumpName.trim()}&quot; under {detail.ledgerGroup}
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {locked ? (
                        <>
                          <Label>Diesel Parchi</Label>
                          {calc.parchi ? <a href={calc.parchi} target="_blank" rel="noreferrer" className="block pt-2 text-sm font-semibold text-blue-600 hover:underline">View parchi</a> : <p className="pt-2 text-sm text-slate-500">—</p>}
                        </>
                      ) : (
                        <FileUploadField
                          label={<Label>Diesel Parchi</Label>}
                          accept="image/*,.pdf"
                          value={form.parchi}
                          fileName={form.parchiName}
                          uploading={uploading}
                          buttonText={form.parchiName ? "REPLACE" : "UPLOAD"}
                          onFilesSelected={(files) => files[0] && uploadParchi(files[0])}
                          onRemove={() => setForm((f) => ({ ...f, parchi: "", parchiName: "" }))}
                        />
                      )}
                    </div>
                  </div>
                  {!locked && (
                    <div className="space-y-2">
                      <Label>Remarks</Label>
                      <Input className="h-10" value={form.remarks} disabled={isReadOnly || isProcessing} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} placeholder="Optional" />
                    </div>
                  )}
                </div>

                {/* Approval and posting */}
                <div className="space-y-3 rounded-lg border bg-white p-4 shadow-sm sm:p-6">
                  <SectionTitle icon={BadgeCheck}>Approval &amp; Ledger Posting</SectionTitle>
                  {locked ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        <Field label="Approved On" value={fmtDate(bill.approved_at)} />
                        <Field label="Remarks" value={bill.approval_remarks} />
                        <Field label="Status" value="Approved - figures locked" />
                      </div>
                      {detail.posting?.length ? (
                        <div className="overflow-x-auto rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-blue-50/60">
                                <TableHead className="px-4 text-left text-xs font-bold text-slate-700">Total</TableHead>
                                <TableHead /><TableHead />
                                <TableHead className="px-4 text-right font-mono text-xs font-bold tabular-nums text-slate-700">{fmtNum(detail.posting.reduce((s: number, p: any) => s + num(p.debit), 0), 2)}</TableHead>
                                <TableHead className="px-4 text-right font-mono text-xs font-bold tabular-nums text-slate-700">{fmtNum(detail.posting.reduce((s: number, p: any) => s + num(p.credit), 0), 2)}</TableHead>
                                <TableHead />
                              </TableRow>
                              <TableRow className="bg-slate-50">
                                {["Date", "Voucher", "Ledger", "Debit (₹)", "Credit (₹)", "Narration"].map((h) => <TableHead key={h} className={cn("px-4 text-xs", ["Date", "Debit (₹)", "Credit (₹)"].includes(h) ? "min-w-[110px] text-right" : "text-left")}>{h}</TableHead>)}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {detail.posting.map((p: any, i: number) => (
                                <TableRow key={i}>
                                  <TableCell className="px-4 text-right font-mono text-xs tabular-nums">{fmtDate(p.entry_date)}</TableCell>
                                  <TableCell className="px-4 text-left text-xs">{p.voucher_type} · {p.voucher_ref}</TableCell>
                                  <TableCell className="px-4 text-left text-xs font-medium">{p.ledger_name}</TableCell>
                                  <TableCell className="px-4 text-right font-mono text-xs tabular-nums">{fmtNum(p.debit, 2)}</TableCell>
                                  <TableCell className="px-4 text-right font-mono text-xs font-semibold tabular-nums text-violet-600">{fmtNum(p.credit, 2)}</TableCell>
                                  <TableCell className="px-4 text-left text-xs">{p.narration}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500">No diesel was given on this leg, so nothing was posted to a ledger.</p>
                      )}
                    </div>
                  ) : bill.status === "Submitted" ? (
                    canApprove ? (
                      <div className="space-y-2">
                        <p className="text-xs text-slate-600">On approval the figures are locked and ₹ {fmtNum(calc.actual, 2)} is posted as a credit to the selected fuel station ledger.</p>
                        <Input className="h-10" value={approvalRemarks} onChange={(e) => setApprovalRemarks(e.target.value)} placeholder="Approval remarks (optional)" />
                      </div>
                    ) : (
                      <p className="text-xs text-slate-600">Waiting for approval by the Admin, or by a user the Admin has given approval rights.</p>
                    )
                  ) : (
                    <p className="text-xs text-slate-600">Save the actual diesel and the fuel station ledger first; the bill can then be approved.</p>
                  )}
                </div>
              </div>
            )}

            <DialogFooter className="-mx-3 -mb-3 mt-8 gap-2 border-t bg-gray-50 px-3 py-4 pt-4 sm:-mx-6 sm:-mb-6 sm:gap-2 sm:px-6">
              <Button variant="outline" onClick={() => setOpenId(null)} disabled={isProcessing} className="w-full sm:w-auto">Close</Button>
              {detail && !locked && (
                <Button onClick={handleSave} disabled={isProcessing || isReadOnly || form.actual === ""} className="w-full min-w-[150px] bg-blue-600 hover:bg-blue-700 sm:w-auto">
                  {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Diesel Bill
                </Button>
              )}
              {detail && !locked && bill.status === "Submitted" && canApprove && (
                <Button onClick={handleApprove} disabled={isProcessing || isReadOnly} className="w-full min-w-[150px] bg-emerald-600 hover:bg-emerald-700 sm:w-auto">
                  <BadgeCheck className="mr-2 h-4 w-4" />
                  Approve &amp; Lock
                </Button>
              )}
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </WorkflowStageShell>
  )
}
