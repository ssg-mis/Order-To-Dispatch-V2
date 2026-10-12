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
import { orderApi, transportBillApi } from "@/lib/api-service"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Info, BadgeCheck, FileText, Loader2, Lock, Receipt, Save, Truck } from "lucide-react"
import { cn } from "@/lib/utils"
import { fmtDate, fmtNum } from "@/lib/table-format"

const money = (v: any) =>
  `₹${(parseFloat(v || 0) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const today = () => new Date().toISOString().split("T")[0]
const num = (v: any) => parseFloat(v) || 0
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

const CASE_LABEL: Record<string, string> = {
  IV: "Transporter vehicle",
  V: "Stock return",
  VI: "Vehicle changed",
  VII: "Accident",
  VIII: "Accident - returned via another vehicle",
}
const caseText = (c?: string, leg?: number) => (c ? `Case ${c}${leg && leg > 1 ? " · Leg 2" : ""}` : "")

const statusClass = (s: string) =>
  cn(
    s === "Approved" ? "bg-emerald-100 text-emerald-700" : "",
    s === "Submitted" ? "bg-blue-100 text-blue-700" : "",
    s === "Pending" ? "bg-amber-100 text-amber-700" : "",
  )

const dash = (v: any) => (v === null || v === undefined || v === "" ? "—" : String(v))

const tripCols = (): StageDataCol<any>[] => [
  { id: "invoice", label: "Invoice / Trip", align: "left", accessor: (b) => b.invoice_no || b.trip_key, render: (b) => <span className="font-bold text-slate-700">{b.invoice_no || b.trip_key}</span> },
  { id: "case", label: "Case", align: "left", accessor: (b) => caseText(b.bill_case, b.leg), cellClassName: "whitespace-nowrap", render: (b) => <span title={CASE_LABEL[b.bill_case] || ""}>{caseText(b.bill_case, b.leg)}</span> },
]
const customerCol = (): StageDataCol<any> => ({
  id: "customer", label: "Customer", align: "left", accessor: (b) => b.customer_names, cellClassName: "font-medium",
  render: (b) => <span className="block max-w-[200px] truncate" title={b.customer_names || ""}>{dash(b.customer_names)}</span>,
})
const transporterCol = (): StageDataCol<any> => ({ id: "transporter", label: "Transporter", align: "left", accessor: (b) => b.transporter_name, render: (b) => dash(b.transporter_name) })
const vehicleCol = (): StageDataCol<any> => ({ id: "vehicle", label: "Vehicle", align: "left", accessor: (b) => b.vehicle_no, render: (b) => dash(b.vehicle_no) })
const moneyCol = (id: string, label: string, field: string, tone: StageDataCol<any>["tone"], extra = ""): StageDataCol<any> => ({
  id, label: `${label} (₹)`, type: "number", align: "right", accessor: (b) => num(b[field]), total: true, tone, cellClassName: `font-mono tabular-nums min-w-[110px] ${extra}`, render: (b) => fmtNum(b[field], 2),
})

const HISTORY_BASE_COLUMNS: StageDataCol<any>[] = [
  ...tripCols(), customerCol(), transporterCol(), vehicleCol(),
  moneyCol("bhada", "Total Bhada", "total_bhada", "blue"),
  moneyCol("tds", "TDS", "tds_amount", "amber"),
  moneyCol("loss", "Loss", "loss_deduction", "red"),
  moneyCol("net", "Net Payable", "act_net_payable", "purple", "font-semibold text-violet-600"),
  { id: "approved", label: "Approved On", type: "date", align: "right", cellClassName: "font-mono tabular-nums min-w-[110px]", accessor: (b) => b.approved_at, render: (b) => fmtDate(b.approved_at) },
]

const PENDING_COLUMNS: StageDataCol<any>[] = [
  ...tripCols(),
  { id: "orders", label: "DO Number(s)", align: "left", accessor: (b) => b.order_nos, render: (b) => <span className="block max-w-[180px] truncate" title={b.order_nos || ""}>{dash(b.order_nos)}</span> },
  customerCol(), transporterCol(), vehicleCol(),
  { id: "dispatch_date", label: "Dispatch Date", type: "date", align: "right", cellClassName: "font-mono tabular-nums min-w-[110px]", accessor: (b) => b.dispatch_date, render: (b) => fmtDate(b.dispatch_date) },
  moneyCol("bhada", "Total Bhada", "total_bhada", "blue"),
  moneyCol("net", "Net Payable", "act_net_payable", "purple", "font-semibold text-violet-600"),
  { id: "status", label: "Status", align: "left", accessor: (b) => b.status, render: (b) => <Badge className={statusClass(b.status)}>{b.status}</Badge> },
  { id: "planned", label: "Planned", type: "date", align: "right", cellClassName: "font-mono tabular-nums min-w-[110px]", accessor: (b) => b.planned_at, render: (b) => fmtDate(b.planned_at) },
]

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

export default function TransportBillsPage() {
  const { toast } = useToast()
  const { isReadOnly } = useAuth()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending")
  const [filterValues, setFilterValues] = useState({
    status: "", startDate: "", endDate: "", partyName: "", search: "", manualSaudaNo: "",
  })
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [openId, setOpenId] = useState<number | null>(null)
  const [adv, setAdv] = useState({ cash: "", bank: "", diesel: "", remarks: "" })
  const [approvalRemarks, setApprovalRemarks] = useState("")
  const [voucher, setVoucher] = useState({ no: "", date: today(), amount: "", copy: "", copyName: "", remarks: "" })
  const [uploading, setUploading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const filters = {
    search: filterValues.search || undefined,
    customer_name: filterValues.partyName && filterValues.partyName !== "all" ? filterValues.partyName : undefined,
    start_date: filterValues.startDate || undefined,
    end_date: filterValues.endDate || undefined,
  }

  const { data: pendingData, isLoading: isPendingLoading } = useQuery({
    queryKey: ["transport-bills-pending", filterValues],
    queryFn: async () => {
      const res = await transportBillApi.getPending({ ...filters, limit: 100 })
      return res.success ? res.data : { bills: [], pagination: { total: 0 } }
    },
  })
  const pending: any[] = pendingData?.bills || []

  const { data: historyData, isLoading: isHistoryLoading } = useQuery({
    queryKey: ["transport-bills-history", filterValues],
    enabled: activeTab === "history",
    queryFn: async () => {
      const res = await transportBillApi.getHistory({ ...filters, limit: 100 })
      return res.success ? res.data : { bills: [], pagination: { total: 0 } }
    },
  })
  const history: any[] = historyData?.bills || []

  const { data: access } = useQuery({
    queryKey: ["transport-bills-access"],
    queryFn: async () => {
      const res = await transportBillApi.getAccess()
      return res.success ? res.data : { canApprove: false }
    },
  })
  const canApprove = !!access?.canApprove

  const { data: detail, isLoading: isDetailLoading } = useQuery({
    queryKey: ["transport-bill-detail", openId],
    enabled: !!openId,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await transportBillApi.getDetail(openId as number)
      return res.success ? res.data : null
    },
  })

  // Fill the editable advances from the saved / suggested figures whenever a bill is opened or saved
  useEffect(() => {
    if (!detail) return
    const c = detail.calc
    setAdv({ cash: String(c?.act?.cash ?? 0), bank: String(c?.act?.bank ?? 0), diesel: String(c?.act?.diesel ?? 0), remarks: detail.bill?.remarks || "" })
    setVoucher((v) => ({ ...v, amount: String(Math.max(0, c?.act?.netPayable ?? 0)) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.bill?.id, detail?.bill?.status, detail?.bill?.submitted_at])

  const bill = detail?.bill
  const calc = detail?.calc
  const locked = !!bill?.locked
  const hasVoucher = !!bill?.voucher_no

  const openBill = (id: number) => {
    setApprovalRemarks("")
    setOpenId(id)
  }
  const closeBill = () => setOpenId(null)

  // Live "Actual Transportation" figures while the advances are being edited
  const actTotal = round2(num(adv.cash) + num(adv.bank) + num(adv.diesel))
  const actNet = calc ? round2(num(calc.totalBhada) - num(calc.tdsAmount) - num(calc.lossDeduction) - actTotal) : 0
  const advancesChanged = !!calc && (num(adv.cash) !== num(calc.act.cash) || num(adv.bank) !== num(calc.act.bank) || num(adv.diesel) !== num(calc.act.diesel))

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["transport-bills-pending"] })
    queryClient.invalidateQueries({ queryKey: ["transport-bills-history"] })
    queryClient.invalidateQueries({ queryKey: ["transport-bill-detail", openId] })
  }

  const run = async (fn: () => Promise<any>, okTitle: string, okDesc?: string) => {
    setIsProcessing(true)
    try {
      const res = await fn()
      if (res.success) {
        toast({ title: okTitle, description: okDesc || res.message })
        refresh()
        return true
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
    return false
  }

  const handleSave = () =>
    run(
      () => transportBillApi.saveActuals(openId as number, { cash: num(adv.cash), bank: num(adv.bank), diesel: num(adv.diesel), remarks: adv.remarks || null }),
      "Saved",
      "Actual transportation saved - waiting for approval",
    )

  const handleApprove = async () => {
    const ok = await run(() => transportBillApi.approve(openId as number, { remarks: approvalRemarks || null }), "Approved", "Transport bill approved and locked")
    if (ok) setSelectedId(null)
  }

  const handleVoucher = () =>
    run(
      () => transportBillApi.recordVoucher(openId as number, {
        voucherNo: voucher.no,
        voucherDate: voucher.date,
        voucherAmount: voucher.amount,
        voucherCopy: voucher.copy || null,
        voucherRemarks: voucher.remarks || null,
      }),
      "Payment Voucher recorded",
    )

  const uploadVoucher = async (file: File) => {
    setUploading(true)
    try {
      const res = await orderApi.uploadFile(file)
      if (res.success) setVoucher((v) => ({ ...v, copy: res.data.url, copyName: file.name }))
    } catch (e: any) {
      toast({ title: "Upload Failed", description: e.message || "Could not upload the file", variant: "destructive" })
    } finally {
      setUploading(false)
    }
  }

  const selected = useMemo(() => pending.find((b) => b.id === selectedId), [pending, selectedId])

  const calcRows: { label: string; hint?: string; tb: number; act: number; editKey?: "cash" | "bank" | "diesel"; strong?: boolean; minus?: boolean }[] = calc
    ? [
        { label: "Total Bhada", hint: calc.rateType === "Bhada Rate" ? `Rate (₹ per MT) ${fmtNum(calc.rateOrAmount, 2)} × weight (MT) ${fmtNum(calc.weightMt, 4)}, rounded to the rupee` : calc.rateType === "Fixed Bhada" ? "Fixed Bhada" : "", tb: calc.totalBhada, act: calc.totalBhada, strong: true },
        { label: `TDS${calc.tdsSection ? ` (${calc.tdsSection} @ ${calc.tdsRate}%)` : " u/s 194C"}`, tb: calc.tdsAmount, act: calc.tdsAmount, minus: true },
        { label: "Loss in transit borne by Transporter", hint: "As decided at Stage 14: Unloading", tb: calc.lossDeduction, act: calc.lossDeduction, minus: true },
        { label: "Advance Cash", hint: "Planned at Plan Vehicle / given at Make Invoice", tb: calc.tb.cash, act: num(adv.cash), editKey: "cash", minus: true },
        { label: "Advance Bank", tb: calc.tb.bank, act: num(adv.bank), editKey: "bank", minus: true },
        { label: "Advance Diesel", tb: calc.tb.diesel, act: num(adv.diesel), editKey: "diesel", minus: true },
      ]
    : []

  const historyColumns: StageDataCol<any>[] = [
    ...HISTORY_BASE_COLUMNS,
    {
      id: "voucher", label: "Payment Voucher", align: "left", noSort: true, accessor: (b) => b.voucher_no,
      render: (b) =>
        b.voucher_no ? (
          <button type="button" className="font-semibold text-emerald-700 hover:underline" onClick={() => openBill(b.id)}>{b.voucher_no}</button>
        ) : (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openBill(b.id)}>Record Voucher</Button>
        ),
    },
  ]

  return (
    <WorkflowStageShell
      headerActions={
        activeTab === "pending" ? (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9" title="How transport bills work" aria-label="How transport bills work">
                <Info className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[400px] space-y-2 p-4">
              <p className="text-sm font-semibold text-slate-900">How transport bills work</p>
              <ul className="list-disc space-y-1.5 pl-4 text-xs text-slate-600">
                <li>A bill is created for a trip run by a <b>transporter vehicle</b> once the goods are unloaded (and any loss approved), or once returned stock reaches the factory.</li>
                <li>Company, attached and party vehicles need no transportation-charge calculation, so they do not appear here.</li>
                <li>After a vehicle change or accident the trip can have two bills: <b>Leg 1</b> for the original vehicle and <b>Leg 2</b> for the vehicle that took over.</li>
              </ul>
            </PopoverContent>
          </Popover>
        ) : null
      }
      persistKey="transport-bills"
      partyNames={[]}
      title="Stage 20: Transport Bills"
      description="Bhada settlement, approval and Payment Voucher per trip."
      pendingCount={pending.length}
      historyData={[]}
      onFilterChange={setFilterValues}
      showStatusFilter={false}
      stageLevel={12}
      onTabChange={setActiveTab}
      showDateFilters={true}
      showSaudaFilter={false}
      dateLabel="Dispatch Date"
      searchPlaceholder="Search DO / Customer / Invoice / Transporter..."
      isHistoryLoading={isHistoryLoading}
      historyContent={
        <StageDataCard
          storageKey="transport-bills-history"
          title="Approved Transport Bills"
          description="Approved bhada bills and their payment vouchers."
          rows={history}
          columns={historyColumns}
          rowKey={(b: any) => b.id}
          loading={isHistoryLoading}
          emptyText="No approved transport bills yet."
          selects={[{ id: "transporter", allLabel: "All Transporters", getValue: (b: any) => b.transporter_name }]}
          format={(n) => n.toFixed(2)}
        />
      }
    >
      <div className="space-y-4">
        <StageActionBar>
          <Button onClick={() => selected && openBill(selected.id)} disabled={!selected} className="bg-blue-600 hover:bg-blue-700">
            <Truck className="mr-2 h-4 w-4" />
            Open Transport Bill
          </Button>
        </StageActionBar>

        <StageDataCard
          storageKey="transport-bills"
          title="Transport Bills"
          description="Trips waiting for a bhada bill, approval or payment voucher."
          rows={pending}
          columns={PENDING_COLUMNS}
          rowKey={(b: any) => b.id}
          loading={isPendingLoading}
          emptyText="No transport bills waiting."
          statusOf={(b: any) => b.status}
          selects={[{ id: "transporter", allLabel: "All Transporters", getValue: (b: any) => b.transporter_name }]}
          leading={{
            cell: (b: any) => <Checkbox checked={selectedId === b.id} onCheckedChange={() => setSelectedId(selectedId === b.id ? null : b.id)} />,
          }}
          rowClassName={(b: any) => (selectedId === b.id ? "bg-blue-50/50" : undefined)}
          format={(n) => n.toFixed(2)}
        />
      </div>

      {/* Trip-wise transport bill */}
      <Dialog open={!!openId} onOpenChange={(o) => !o && closeBill()}>
        <DialogContent className="max-h-[95vh] w-[calc(100vw-0.75rem)] max-w-[calc(100vw-0.75rem)] overflow-x-hidden overflow-y-auto p-0 [overflow-wrap:anywhere] sm:!max-w-[95vw]">
          <div className="p-3 sm:p-6">
            <DialogHeader className="min-w-0">
              <DialogTitle className="flex flex-wrap items-center gap-3 break-words text-lg font-bold text-slate-900 sm:text-xl">
                Transport Bill - {detail?.trip?.invoiceNo || detail?.trip?.tripKey || ""}
                {bill && <Badge className={statusClass(bill.status)}>{bill.status}</Badge>}
                {bill && <span className="text-xs font-semibold text-slate-500">{caseText(bill.bill_case, bill.leg)}{CASE_LABEL[bill.bill_case] ? ` · ${CASE_LABEL[bill.bill_case]}` : ""}</span>}
                {locked && <span className="flex items-center gap-1 text-xs font-semibold text-slate-500"><Lock className="h-3.5 w-3.5" />Locked</span>}
              </DialogTitle>
              <DialogDescription className="sr-only">Trip-wise transport bill with planned and actual transportation</DialogDescription>
            </DialogHeader>

            {isDetailLoading || !detail ? (
              <div className="py-16 text-center text-slate-500"><Loader2 className="mr-2 inline h-5 w-5 animate-spin" />Loading…</div>
            ) : (
              <div className="mt-6 min-w-0 space-y-6">
                {calc.warnings?.length > 0 && !locked && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    {calc.warnings.map((w: string) => <p key={w}>• {w}</p>)}
                  </div>
                )}

                {/* Vehicle, driver, transporter */}
                <div className="space-y-4 rounded-lg border bg-white p-4 shadow-sm sm:p-6">
                  <SectionTitle icon={Truck}>Vehicle &amp; Driver</SectionTitle>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <Field label="Vehicle No." value={detail.vehicle?.registration_no} />
                    <Field label="Vehicle Type" value={detail.vehicle?.vehicle_type} />
                    <Field label="Driver" value={detail.vehicle?.driver_name} />
                    <Field label="Driver Mobile" value={detail.vehicle?.driver_mobile} />
                    <Field label="Transporter" value={detail.vehicle?.transporter_name} />
                    <Field label="Transporter PAN" value={detail.vehicle?.transporter_pan} />
                    <Field label="Transporter GSTIN" value={detail.vehicle?.transporter_gstin} />
                    <Field label="Driving Licence" value={detail.vehicle?.driving_licence_no} />
                  </div>
                </div>

                {/* Invoice, items, DO, broker, dates */}
                <div className="space-y-4 rounded-lg border bg-white p-4 shadow-sm sm:p-6">
                  <SectionTitle icon={FileText}>Invoice, Items &amp; Dates</SectionTitle>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-blue-50/60">
                          {Array.from({ length: 8 }).map((_, i) => (i === 0 ? <TableHead key={i} className="px-4 text-left text-xs font-bold text-slate-700">Total</TableHead> : <TableHead key={i} />))}
                          <TableHead />
                          <TableHead /><TableHead /><TableHead />
                        </TableRow>
                        <TableRow className="bg-slate-50">
                          {["DO No.", "DSR", "Customer", "Broker", "Invoice No.", "Invoice Date", "Invoice Amount (₹)", "Item", "Qty", "Dispatch Date", "Vehicle Reached", "Material Received"].map((h) => (
                            <TableHead key={h} className={cn("whitespace-nowrap px-4 text-xs", ["Invoice Date", "Invoice Amount (₹)", "Qty", "Dispatch Date", "Vehicle Reached", "Material Received"].includes(h) ? "min-w-[110px] text-right" : "text-left")}>{h}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.items.map((it: any) => (
                          <TableRow key={it.dispatch_id}>
                            <TableCell className="px-4 text-left text-xs font-bold text-slate-700">{it.order_no}</TableCell>
                            <TableCell className="px-4 text-left text-xs">{it.dsr_number || "—"}</TableCell>
                            <TableCell className="px-4 text-left text-xs">{it.customer_name || "—"}</TableCell>
                            <TableCell className="px-4 text-left text-xs">{it.broker_name || "—"}</TableCell>
                            <TableCell className="px-4 text-left text-xs">{it.invoice_no || "—"}</TableCell>
                            <TableCell className="px-4 text-right font-mono text-xs tabular-nums">{fmtDate(it.invoice_date)}</TableCell>
                            <TableCell className="px-4 text-right font-mono text-xs tabular-nums">{fmtNum(it.bill_amount, 2)}</TableCell>
                            <TableCell className="px-4 text-left text-xs">{it.sku_name || "—"}</TableCell>
                            <TableCell className="px-4 text-right font-mono text-xs tabular-nums">{fmtNum(it.qty, 4)}</TableCell>
                            <TableCell className="px-4 text-right font-mono text-xs tabular-nums">{fmtDate(it.dispatch_date)}</TableCell>
                            <TableCell className="px-4 text-right font-mono text-xs tabular-nums">{fmtDate(it.reach_date || it.reach_recorded_at)}</TableCell>
                            <TableCell className="px-4 text-right font-mono text-xs tabular-nums">{fmtDate(it.material_received_date)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Damage, loss and the CN against it */}
                <div className="space-y-4 rounded-lg border bg-white p-4 shadow-sm sm:p-6">
                  <SectionTitle icon={Receipt}>Damage Reported &amp; Loss in Transit</SectionTitle>
                  <div className="grid grid-cols-3 gap-4">
                    <Field label="Borne by Company (₹)" value={fmtNum(detail.lossTotals.company, 2)} />
                    <Field label="Borne by Transporter (₹)" value={fmtNum(detail.lossTotals.transporter, 2)} className="text-red-600" />
                    <Field label="Borne by Customer (₹)" value={fmtNum(detail.lossTotals.customer, 2)} />
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        {(() => {
                          const sum = (k: string) => detail.damage.reduce((s: number, d: any) => s + num(d[k]), 0)
                          const T = "px-4 text-right font-mono text-xs font-bold tabular-nums text-slate-700"
                          return (
                            <TableRow className="bg-blue-50/60">
                              <TableHead className="px-4 text-left text-xs font-bold text-slate-700">Total</TableHead>
                              <TableHead />
                              <TableHead className={T}>{fmtNum(sum("damaged_containers"), 0)}</TableHead>
                              <TableHead />
                              <TableHead className={T}>{fmtNum(sum("total_loss_value"), 2)}</TableHead>
                              <TableHead />
                              <TableHead />
                              <TableHead className={T}>{fmtNum(sum("credit_note_amount"), 2)}</TableHead>
                              <TableHead />
                              <TableHead className={T}>{fmtNum(sum("debit_note_amount"), 2)}</TableHead>
                            </TableRow>
                          )
                        })()}
                        <TableRow className="bg-slate-50">
                          {["DSR", "Shortage Qty", "Damaged Containers", "Cause", "Total Loss (₹)", "CN No.", "CN Date", "CN Amount (₹)", "Debit Note No.", "Debit Note Amount (₹)"].map((h) => (
                            <TableHead key={h} className={cn("whitespace-nowrap px-4 text-xs", ["Shortage Qty", "Damaged Containers", "Total Loss (₹)", "CN Date", "CN Amount (₹)", "Debit Note Amount (₹)"].includes(h) ? "min-w-[110px] text-right" : "text-left")}>{h}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.damage.map((d: any) => (
                          <TableRow key={d.dispatch_id}>
                            <TableCell className="px-4 text-left text-xs">{d.dsr_number || "—"}</TableCell>
                            <TableCell className="px-4 text-right font-mono text-xs tabular-nums">{fmtNum(d.shortage_qty, 4)}</TableCell>
                            <TableCell className="px-4 text-right font-mono text-xs tabular-nums">{fmtNum(d.damaged_containers, 0)}</TableCell>
                            <TableCell className="px-4 text-left text-xs">{d.shortage_cause || "—"}</TableCell>
                            <TableCell className="px-4 text-right font-mono text-xs tabular-nums">{fmtNum(d.total_loss_value, 2)}</TableCell>
                            <TableCell className="px-4 text-left text-xs">{d.credit_note_no || "—"}</TableCell>
                            <TableCell className="px-4 text-right font-mono text-xs tabular-nums">{d.credit_note_no ? fmtDate(d.credit_note_date) : "—"}</TableCell>
                            <TableCell className="px-4 text-right font-mono text-xs tabular-nums">{d.credit_note_amount ? fmtNum(d.credit_note_amount, 2) : "—"}</TableCell>
                            <TableCell className="px-4 text-left text-xs">{d.debit_note_no || "—"}</TableCell>
                            <TableCell className="px-4 text-right font-mono text-xs tabular-nums">{d.debit_note_no ? fmtNum(d.debit_note_amount, 2) : "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Bhada rates */}
                <div className="space-y-4 rounded-lg border bg-white p-4 shadow-sm sm:p-6">
                  <SectionTitle icon={Truck}>Bhada Rate</SectionTitle>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <Field
                      label={`Planned Bhada Rate (master) (₹${detail.plannedBhadaRate?.rateType === "Fixed Bhada" ? ", fixed" : " per MT"})`}
                      value={detail.plannedBhadaRate
                        ? `${fmtNum(detail.plannedBhadaRate.rate, 2)}${detail.plannedBhadaRate.name ? ` · ${detail.plannedBhadaRate.name}` : ""}`
                        : "No matching rate in the master"}
                      className={!detail.plannedBhadaRate ? "font-normal text-slate-400" : ""}
                    />
                    <Field label="Actual Rate Type (Plan Vehicle)" value={calc.rateType} />
                    <Field label={calc.rateType === "Bhada Rate" ? "Actual Bhada Rate (₹ per MT)" : "Actual Fixed Bhada (₹)"} value={fmtNum(calc.rateOrAmount, 2)} />
                    <Field label="Net Weight (RST) (MT)" value={fmtNum(calc.weightMt, 4)} />
                  </div>
                </div>

                {/* Transportation To Be | Actual Transportation */}
                <div className="space-y-4 rounded-lg border bg-white p-4 shadow-sm sm:p-6">
                  <SectionTitle icon={Receipt}>Transportation To Be / Actual Transportation</SectionTitle>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead className="px-4 text-left text-xs">Particulars</TableHead>
                          <TableHead className="px-4 text-right text-xs">Transportation To Be (₹)<span className="block text-[10px] font-normal text-slate-500">the 6 amounts: Plan Vehicle (Stage 5) and Make Invoice (Stage 9)</span></TableHead>
                          <TableHead className="px-4 text-right text-xs">Actual Transportation (₹)<span className="block text-[10px] font-normal text-slate-500">{locked ? "frozen on approval" : "from Make Invoice (Stage 9) - adjustable until approval"}</span></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {calcRows.map((r) => (
                          <TableRow key={r.label}>
                            <TableCell className="px-4 text-left text-xs">
                              <span className={cn("font-medium", r.strong && "font-bold")}>{r.minus ? "Less: " : ""}{r.label}</span>
                              {r.hint && <span className="block text-[10px] text-slate-500">{r.hint}</span>}
                            </TableCell>
                            <TableCell className="px-4 text-right font-mono text-xs tabular-nums">
                              {r.editKey ? (
                                // the 6 amounts: the advance planned at Plan Vehicle and the one given at Make Invoice
                                <span className="inline-flex flex-col items-end gap-0.5">
                                  <span>{fmtNum(r.tb, 2)}<span className="ml-1 text-[10px] text-slate-500">Plan Vehicle</span></span>
                                  <span className="text-slate-600">{fmtNum(calc.invoiceAdvances?.[r.editKey], 2)}<span className="ml-1 text-[10px] text-slate-500">Make Invoice</span></span>
                                </span>
                              ) : (
                                fmtNum(r.tb, 2)
                              )}
                            </TableCell>
                            <TableCell className="px-4 text-right font-mono text-xs tabular-nums">
                              {r.editKey && !locked ? (
                                <Input
                                  type="number" min={0} className="ml-auto h-8 w-36 text-right text-xs"
                                  value={adv[r.editKey]} disabled={isReadOnly || isProcessing}
                                  onChange={(e) => setAdv((a) => ({ ...a, [r.editKey as string]: e.target.value }))}
                                />
                              ) : (
                                fmtNum(r.act, 2)
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-slate-50">
                          <TableCell className="px-4 text-left text-xs font-bold">Amount to be paid to the Transporter</TableCell>
                          <TableCell className="px-4 text-right font-mono text-sm font-bold tabular-nums">{fmtNum(calc.tb.netPayable, 2)}</TableCell>
                          <TableCell className="px-4 text-right font-mono text-sm font-bold tabular-nums text-violet-600">{fmtNum(locked ? calc.act.netPayable : actNet, 2)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                  {!locked && (
                    <div className="space-y-2">
                      <Label>Remarks</Label>
                      <Input className="h-10" value={adv.remarks} disabled={isReadOnly || isProcessing} onChange={(e) => setAdv((a) => ({ ...a, remarks: e.target.value }))} placeholder="Optional" />
                    </div>
                  )}
                </div>

                {/* Approval */}
                <div className="space-y-3 rounded-lg border bg-white p-4 shadow-sm sm:p-6">
                  <SectionTitle icon={BadgeCheck}>Approval</SectionTitle>
                  {locked ? (
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                      <Field label="Approved On" value={fmtDate(bill.approved_at)} />
                      <Field label="Remarks" value={bill.approval_remarks} />
                      <Field label="Status" value="Approved - no further changes allowed" />
                    </div>
                  ) : bill.status === "Submitted" ? (
                    canApprove ? (
                      <div className="space-y-2">
                        <p className="text-xs text-slate-600">After approval no one can change this bill, not even the Admin.</p>
                        <Input className="h-10" value={approvalRemarks} onChange={(e) => setApprovalRemarks(e.target.value)} placeholder="Approval remarks (optional)" />
                      </div>
                    ) : (
                      <p className="text-xs text-slate-600">Waiting for approval by the Admin, or by a user the Admin has given approval rights.</p>
                    )
                  ) : (
                    <p className="text-xs text-slate-600">Save the actual transportation first; the bill can then be approved.</p>
                  )}
                </div>

                {/* Payment Voucher */}
                {locked && (
                  <div className="space-y-4 rounded-lg border bg-white p-4 shadow-sm sm:p-6">
                    <SectionTitle icon={Receipt}>Payment Voucher</SectionTitle>
                    {hasVoucher ? (
                      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        <Field label="Voucher No." value={bill.voucher_no} />
                        <Field label="Voucher Date" value={fmtDate(bill.voucher_date)} />
                        <Field label="Amount Paid (₹)" value={fmtNum(bill.voucher_amount, 2)} className="text-emerald-700" />
                        <Field label="Remarks" value={bill.voucher_remarks} />
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Payment Voucher No. <span className="text-red-500">*</span></Label>
                          <Input className="h-10" value={voucher.no} onChange={(e) => setVoucher((v) => ({ ...v, no: e.target.value }))} placeholder="Voucher number" />
                        </div>
                        <div className="space-y-2">
                          <Label>Voucher Date <span className="text-red-500">*</span></Label>
                          <Input type="date" className="h-10" value={voucher.date} onChange={(e) => setVoucher((v) => ({ ...v, date: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label>Amount Paid (₹)</Label>
                          <Input type="number" min={0} className="h-10" value={voucher.amount} onChange={(e) => setVoucher((v) => ({ ...v, amount: e.target.value }))} />
                          <p className="text-[11px] text-slate-500">Amount to be paid (₹): {fmtNum(Math.max(0, calc.act.netPayable), 2)}</p>
                        </div>
                        <div className="space-y-2">
                          <FileUploadField
                            label={<Label>Voucher Copy</Label>}
                            accept="image/*,.pdf"
                            value={voucher.copy}
                            fileName={voucher.copyName}
                            uploading={uploading}
                            buttonText={voucher.copyName ? "REPLACE" : "UPLOAD"}
                            onFilesSelected={(files) => files[0] && uploadVoucher(files[0])}
                            onRemove={() => setVoucher((v) => ({ ...v, copy: "", copyName: "" }))}
                          />
                        </div>
                        <div className="space-y-2 md:col-span-1 lg:col-span-2">
                          <Label>Remarks</Label>
                          <Input className="h-10" value={voucher.remarks} onChange={(e) => setVoucher((v) => ({ ...v, remarks: e.target.value }))} placeholder="Optional" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="-mx-3 -mb-3 mt-8 gap-2 border-t bg-gray-50 px-3 py-4 pt-4 sm:-mx-6 sm:-mb-6 sm:gap-2 sm:px-6">
              <Button variant="outline" onClick={closeBill} disabled={isProcessing} className="w-full sm:w-auto">Close</Button>
              {detail && !locked && (
                <Button onClick={handleSave} disabled={isProcessing || isReadOnly} className="w-full min-w-[150px] bg-blue-600 hover:bg-blue-700 sm:w-auto">
                  {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Actual Transportation
                </Button>
              )}
              {detail && !locked && bill.status === "Submitted" && canApprove && (
                <Button onClick={handleApprove} disabled={isProcessing || isReadOnly || advancesChanged} title={advancesChanged ? "Save the changed advances first" : ""} className="w-full min-w-[150px] bg-emerald-600 hover:bg-emerald-700 sm:w-auto">
                  <BadgeCheck className="mr-2 h-4 w-4" />
                  Approve &amp; Lock
                </Button>
              )}
              {detail && locked && !hasVoucher && (
                <Button onClick={handleVoucher} disabled={isProcessing || isReadOnly || !voucher.no.trim() || !voucher.date} className="w-full min-w-[150px] bg-blue-600 hover:bg-blue-700 sm:w-auto">
                  {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Record Payment Voucher
                </Button>
              )}
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </WorkflowStageShell>
  )
}
