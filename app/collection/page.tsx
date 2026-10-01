"use client"

import { useEffect, useState, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { WorkflowStageShell } from "@/components/workflow/workflow-stage-shell"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CheckCircle, FileText, IndianRupee, Loader2, ReceiptText, ShieldAlert, ShieldCheck } from "lucide-react"
import { collectionApi } from "@/lib/api-service"
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query"
import { useInView } from "react-intersection-observer"
import { cn } from "@/lib/utils"

type View = "receivable" | "disputed" | "all"

const money = (v: any) => `₹${(parseFloat(v || 0) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString("en-IN") : "—")
const today = () => new Date().toISOString().split("T")[0]
const pendingOf = (inv: any) =>
  (parseFloat(inv.bill_amount || 0) || 0) -
  ((parseFloat(inv.total_received || 0) || 0) + (parseFloat(inv.total_tds || 0) || 0) + (parseFloat(inv.total_cd || 0) || 0) + (parseFloat(inv.total_credit_note || 0) || 0))

const emptyForm = () => ({
  receiptDate: today(),
  amountReceived: "",
  tdsDeducted: "",
  cdGiven: "",
  paymentMode: "NEFT",
  referenceNo: "",
  remarks: "",
})

function CalcRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 border-b border-dashed py-2 text-xs last:border-b-0",
        strong && "mt-1 rounded-md border-0 bg-slate-100 px-3 py-2.5 text-sm",
      )}
    >
      <span className={cn("text-slate-500", strong && "font-semibold text-slate-700")}>{label}</span>
      <span className={cn("text-right font-medium tabular-nums text-slate-800", strong && "font-bold text-slate-900")}>{value}</span>
    </div>
  )
}

function StatusBadge({ status }: { status?: string }) {
  return (
    <Badge
      className={cn(
        status === "Disputed" && "bg-red-100 text-red-700",
        status === "Partial" && "bg-amber-100 text-amber-700",
        status === "Cleared" && "bg-emerald-100 text-emerald-700",
        (!status || status === "Pending") && "bg-slate-100 text-slate-700",
      )}
    >
      {status || "Pending"}
    </Badge>
  )
}

export default function CollectionPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending")
  const [view, setView] = useState<View>("receivable")
  const [historyEntry, setHistoryEntry] = useState<"all" | "receipts" | "disputes" | "cleared">("all")
  const { ref: pendingEndRef, inView: pendingInView } = useInView()
  const { ref: historyEndRef, inView: historyInView } = useInView()

  const [filterValues, setFilterValues] = useState({
    status: "",
    startDate: "",
    endDate: "",
    partyName: "",
    search: "",
    manualSaudaNo: "",
  })

  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedItems, setSelectedItems] = useState<number[]>([])

  // Receipt dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState(emptyForm())
  const [tdsRuleId, setTdsRuleId] = useState<number | undefined>(undefined)
  const [touched, setTouched] = useState({ tds: false, cd: false })
  // GST% used to back out taxable value when the SKU master has none (applied on blur/Enter)
  const [gstInput, setGstInput] = useState("")
  const [gstPercent, setGstPercent] = useState<number | undefined>(undefined)

  // Receipts view dialog
  const [receiptsFor, setReceiptsFor] = useState<any | null>(null)

  // Dispute dialog
  const [disputeFor, setDisputeFor] = useState<any | null>(null)
  const [disputeRemarks, setDisputeRemarks] = useState("")

  const commonFilters = {
    search: filterValues.search,
    customer_name: filterValues.partyName === "all" ? undefined : filterValues.partyName,
  }

  // ---- Pending / receivable list ----
  const {
    data: pendingData,
    fetchNextPage: fetchNextPending,
    hasNextPage: hasNextPending,
    isFetchingNextPage: isFetchingNextPending,
    isLoading: isPendingLoading,
    refetch: refetchPending,
  } = useInfiniteQuery({
    queryKey: ["collections-pending", filterValues, view],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await collectionApi.getPending({
        page: pageParam,
        limit: 20,
        view,
        ...commonFilters,
        do_date_from: filterValues.startDate || undefined,
        do_date_to: filterValues.endDate || undefined,
      })
      return response.success ? response.data : { invoices: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.invoices?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    },
  })

  const pendingInvoices = useMemo(() => pendingData?.pages.flatMap((page) => page.invoices) || [], [pendingData])
  const summary = pendingData?.pages?.[0]?.summary

  useEffect(() => {
    if (pendingInView && hasNextPending) fetchNextPending()
  }, [pendingInView, hasNextPending, fetchNextPending])

  // ---- History ----
  const {
    data: historyData,
    fetchNextPage: fetchNextHistory,
    hasNextPage: hasNextHistory,
    isFetchingNextPage: isFetchingNextHistory,
    isLoading: isHistoryLoading,
  } = useInfiniteQuery({
    queryKey: ["collections-history", filterValues, historyEntry],
    enabled: activeTab === "history",
    queryFn: async ({ pageParam = 1 }) => {
      const response = await collectionApi.getHistory({
        page: pageParam,
        limit: 25,
        ...commonFilters,
        from: filterValues.startDate || undefined,
        to: filterValues.endDate || undefined,
        entry: historyEntry === "all" ? undefined : historyEntry,
      })
      return response.success ? response.data : { entries: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.entries?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    },
  })
  const historyEntries = useMemo(() => historyData?.pages.flatMap((p) => p.entries) || [], [historyData])

  useEffect(() => {
    if (historyInView && hasNextHistory) fetchNextHistory()
  }, [historyInView, hasNextHistory, fetchNextHistory])

  // ---- Selected invoice + master-driven TDS / CD suggestion ----
  const selectedInvoice = pendingInvoices.find((inv: any) => inv.id === selectedItems[0])
  const selectedPending = selectedInvoice ? pendingOf(selectedInvoice) : 0

  const { data: suggestion, isFetching: isSuggesting } = useQuery({
    queryKey: ["collections-suggestion", selectedItems[0], formData.receiptDate, tdsRuleId, gstPercent],
    enabled: isDialogOpen && !!selectedItems[0] && !!formData.receiptDate,
    queryFn: async () => {
      const res = await collectionApi.getSuggestion({
        invoiceId: selectedItems[0],
        receiptDate: formData.receiptDate,
        tdsRuleId,
        gstPercent,
      })
      return res.success ? res.data : null
    },
  })

  // Auto-fill TDS / CD from the suggestion until the user types their own value.
  useEffect(() => {
    if (!suggestion) return
    setFormData((p) => ({
      ...p,
      tdsDeducted: touched.tds ? p.tdsDeducted : suggestion.tds?.suggested_tds > 0 ? String(suggestion.tds.suggested_tds) : "",
      cdGiven: touched.cd ? p.cdGiven : suggestion.cd?.suggested_cd > 0 ? String(suggestion.cd.suggested_cd) : "",
    }))
    if (suggestion.tds && tdsRuleId === undefined) setTdsRuleId(suggestion.tds.rule_id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestion])

  const entryTotal =
    (parseFloat(formData.amountReceived) || 0) + (parseFloat(formData.tdsDeducted) || 0) + (parseFloat(formData.cdGiven) || 0)
  const hasNegative = [formData.amountReceived, formData.tdsDeducted, formData.cdGiven].some((v) => v !== "" && parseFloat(v) < 0)
  const overPayment = entryTotal > selectedPending + 0.01
  const canSave = !isProcessing && !hasNegative && !overPayment && entryTotal > 0 && formData.amountReceived !== ""

  const toggleSelectItem = (id: number) => {
    setSelectedItems((prev) => (prev.includes(id) ? [] : [id])) // single select: one bill at a time
  }

  const handleOpenDialog = () => {
    if (selectedItems.length === 0) return
    setFormData(emptyForm())
    setTdsRuleId(undefined)
    setGstInput("")
    setGstPercent(undefined)
    setTouched({ tds: false, cd: false })
    setIsDialogOpen(true)
  }

  const refreshAll = async () => {
    await refetchPending()
    queryClient.invalidateQueries({ queryKey: ["collections-history"] })
  }

  const handleSubmit = async () => {
    if (selectedItems.length === 0) return
    if (!canSave) {
      toast({ title: "Validation Error", description: "Check the amounts entered.", variant: "destructive" })
      return
    }
    setIsProcessing(true)
    try {
      const response = await collectionApi.addReceipt({
        invoiceId: selectedItems[0],
        ...formData,
        tdsRuleId,
        cdRuleId: suggestion?.cd?.rule_id ?? undefined,
      })
      if (response.success) {
        toast({ title: "Receipt Added", description: "Successfully processed collection." })
        await refreshAll()
        setIsDialogOpen(false)
        setSelectedItems([])
      } else {
        toast({ title: "Error", description: response.message || "Could not save receipt", variant: "destructive" })
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "An unexpected error occurred", variant: "destructive" })
    } finally {
      setIsProcessing(false)
    }
  }

  // ---- Receipts view ----
  const { data: receiptsData, isLoading: isReceiptsLoading } = useQuery({
    queryKey: ["collections-receipts", receiptsFor?.id],
    enabled: !!receiptsFor,
    queryFn: async () => {
      const res = await collectionApi.getInvoiceReceipts(receiptsFor.id)
      return res.success ? res.data : null
    },
  })

  // ---- Dispute ----
  const handleDispute = async () => {
    if (!disputeFor) return
    const resolving = disputeFor.collection_status === "Disputed"
    if (!disputeRemarks.trim()) {
      toast({ title: "Validation Error", description: "Remarks are required.", variant: "destructive" })
      return
    }
    setIsProcessing(true)
    try {
      const res = await collectionApi.setDispute({
        invoiceId: disputeFor.id,
        disputed: !resolving,
        remarks: disputeRemarks.trim(),
      })
      if (res.success) {
        toast({ title: resolving ? "Dispute Resolved" : "Marked as Disputed", description: disputeFor.invoice_no })
        setDisputeFor(null)
        setDisputeRemarks("")
        setSelectedItems([])
        await refreshAll()
      } else {
        toast({ title: "Error", description: res.message || "Could not update dispute", variant: "destructive" })
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "An unexpected error occurred", variant: "destructive" })
    } finally {
      setIsProcessing(false)
    }
  }

  const COLS = 12

  return (
    <WorkflowStageShell
      partyNames={[]}
      title="Stage 16: Collection"
      description="Daily receivables tracking, TDS master and cash discount."
      pendingCount={summary ? summary.receivable.count + summary.disputed.count : pendingInvoices.length}
      historyData={[]}
      onFilterChange={setFilterValues}
      showStatusFilter={false}
      stageLevel={11}
      onTabChange={setActiveTab}
      showDateFilters={true}
      showSaudaFilter={false}
      dateLabel="Invoice / Receipt Date"
      searchPlaceholder="Search Invoice Number / Party / UTR..."
      isHistoryLoading={isHistoryLoading}
      historyContent={
        <div className="space-y-3">
        <div className="inline-flex rounded-lg bg-muted/50 p-1">
          {([
            ["all", "All Entries"],
            ["receipts", "Receipts"],
            ["disputes", "Disputes"],
            ["cleared", "Cleared Bills"],
          ] as [typeof historyEntry, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setHistoryEntry(key)}
              className={cn(
                "px-3 py-1 text-xs rounded-md font-medium transition-colors",
                historyEntry === key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Card className="border-none shadow-sm overflow-hidden py-0 gap-0">
          <div className="max-h-[600px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                <TableRow className="bg-slate-50">
                  {["Receipt Date", "Invoice No", "Customer Name", "Entry", "Received", "TDS Receivable", "CD", "Mode", "UTR / Ref", "TDS Rule", "Remarks", "Bill Status"].map((h) => (
                    <TableHead key={h} className="whitespace-nowrap text-center">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isHistoryLoading && historyEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={COLS} className="text-center py-10 text-slate-500">
                      <Loader2 className="inline h-4 w-4 animate-spin mr-2" /> Loading history...
                    </TableCell>
                  </TableRow>
                ) : historyEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={COLS} className="text-center py-10 text-slate-500">No collection history found.</TableCell>
                  </TableRow>
                ) : (
                  historyEntries.map((e: any) => {
                    const isDisputeEvent = e.payment_mode === "Dispute Raised" || e.payment_mode === "Dispute Resolved"
                    return (
                      <TableRow key={e.id} className={isDisputeEvent ? "bg-red-50/40" : ""}>
                        <TableCell className="text-center text-xs">{fmtDate(e.receipt_date)}</TableCell>
                        <TableCell className="text-center text-xs font-bold text-slate-700">{e.invoice_no}</TableCell>
                        <TableCell className="text-center text-xs font-medium">{e.party_name || "—"}</TableCell>
                        <TableCell className="text-center text-xs">
                          {isDisputeEvent ? (
                            <Badge className={e.payment_mode === "Dispute Raised" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}>{e.payment_mode}</Badge>
                          ) : (
                            <Badge className="bg-blue-100 text-blue-700">Receipt</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center text-xs font-medium text-emerald-600">{isDisputeEvent ? "—" : money(e.amount_received)}</TableCell>
                        <TableCell className="text-center text-xs text-orange-600">{isDisputeEvent ? "—" : money(e.tds_deducted)}</TableCell>
                        <TableCell className="text-center text-xs text-blue-600">{isDisputeEvent ? "—" : money(e.cd_given)}</TableCell>
                        <TableCell className="text-center text-xs">{isDisputeEvent ? "—" : e.payment_mode || "—"}</TableCell>
                        <TableCell className="text-center text-xs">{e.reference_no || "—"}</TableCell>
                        <TableCell className="text-center text-xs">{e.tds_rule_name || "—"}</TableCell>
                        <TableCell className="text-xs max-w-[220px] truncate" title={e.remarks || ""}>{e.remarks || "—"}</TableCell>
                        <TableCell className="text-center"><StatusBadge status={e.collection_status} /></TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <div ref={historyEndRef} className="py-2 flex justify-center">
            {isFetchingNextHistory && (
              <div className="flex items-center gap-2 text-blue-600 font-bold animate-pulse text-[10px]">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>LOADING MORE...</span>
              </div>
            )}
          </div>
        </Card>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="p-3 gap-1 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Receivable Outstanding</p>
            <p className="text-lg font-bold text-red-600">{money(summary?.receivable.outstanding)}</p>
            <p className="text-[11px] text-slate-500">{summary?.receivable.count ?? 0} bills</p>
          </Card>
          <Card className="p-3 gap-1 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Disputed Outstanding</p>
            <p className="text-lg font-bold text-amber-600">{money(summary?.disputed.outstanding)}</p>
            <p className="text-[11px] text-slate-500">{summary?.disputed.count ?? 0} bills</p>
          </Card>
          <Card className="p-3 gap-1 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">TDS Receivable (open bills)</p>
            <p className="text-lg font-bold text-orange-600">{money(summary?.total_tds_receivable)}</p>
          </Card>
          <Card className="p-3 gap-1 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Cash Discount (open bills)</p>
            <p className="text-lg font-bold text-blue-600">{money(summary?.total_cd_given)}</p>
          </Card>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="inline-flex rounded-lg bg-muted/50 p-1">
            {([
              ["receivable", "Bills Receivable"],
              ["disputed", "Disputed Bills"],
              ["all", "All"],
            ] as [View, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => { setView(key); setSelectedItems([]) }}
                className={cn(
                  "px-3 py-1 text-xs rounded-md font-medium transition-colors",
                  view === key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => selectedInvoice && setReceiptsFor(selectedInvoice)}
              disabled={selectedItems.length !== 1}
            >
              <ReceiptText className="mr-2 h-4 w-4" />
              View Receipts
            </Button>
            {selectedInvoice?.collection_status === "Disputed" ? (
              <Button
                variant="outline"
                className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                onClick={() => { setDisputeRemarks(""); setDisputeFor(selectedInvoice) }}
              >
                <ShieldCheck className="mr-2 h-4 w-4" />
                Resolve Dispute
              </Button>
            ) : (
              <Button
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-50"
                onClick={() => { setDisputeRemarks(""); setDisputeFor(selectedInvoice) }}
                disabled={selectedItems.length !== 1}
              >
                <ShieldAlert className="mr-2 h-4 w-4" />
                Mark Disputed
              </Button>
            )}
            <Button
              onClick={handleOpenDialog}
              disabled={selectedItems.length !== 1}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Add Receipt
            </Button>
          </div>
        </div>

        <Card className="border-none shadow-sm overflow-hidden py-0 gap-0">
          <div className="max-h-[600px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                <TableRow className="bg-slate-50">
                  <TableHead className="w-10 text-center"></TableHead>
                  <TableHead className="whitespace-nowrap text-center">DO Number</TableHead>
                  <TableHead className="whitespace-nowrap text-center">Customer Name</TableHead>
                  <TableHead className="whitespace-nowrap text-center">Invoice No</TableHead>
                  <TableHead className="whitespace-nowrap text-center">Date</TableHead>
                  <TableHead className="whitespace-nowrap text-center">Bill Amount</TableHead>
                  <TableHead className="whitespace-nowrap text-center">Received</TableHead>
                  <TableHead className="whitespace-nowrap text-center">TDS</TableHead>
                  <TableHead className="whitespace-nowrap text-center">CD</TableHead>
                  <TableHead className="whitespace-nowrap text-center">Credit Note</TableHead>
                  <TableHead className="whitespace-nowrap text-center">Pending Balance</TableHead>
                  <TableHead className="whitespace-nowrap text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isPendingLoading && pendingInvoices.length === 0 ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i} className="opacity-40 border-b border-slate-50">
                      {[...Array(12)].map((__, c) => (
                        <TableCell key={c} className="text-center py-4"><div className="h-3 w-20 bg-slate-200 animate-pulse rounded-full mx-auto" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : pendingInvoices.length > 0 ? (
                  pendingInvoices.map((inv: any) => {
                    const billAmount = parseFloat(inv.bill_amount || 0)
                    const received = parseFloat(inv.total_received || 0)
                    const tds = parseFloat(inv.total_tds || 0)
                    const cd = parseFloat(inv.total_cd || 0)
                    const pendingBal = pendingOf(inv)

                    return (
                      <TableRow key={inv.id} className={cn(selectedItems.includes(inv.id) && "bg-blue-50/50", inv.collection_status === "Disputed" && "bg-red-50/30")}>
                        <TableCell className="text-center">
                          <Checkbox checked={selectedItems.includes(inv.id)} onCheckedChange={() => toggleSelectItem(inv.id)} />
                        </TableCell>
                        <TableCell className="text-center text-xs font-bold text-slate-700">{inv.so_no || inv.d_sr_number || "—"}</TableCell>
                        <TableCell className="text-center text-xs font-medium">{inv.party_name || "—"}</TableCell>
                        <TableCell className="text-center text-xs font-bold text-slate-700">{inv.invoice_no}</TableCell>
                        <TableCell className="text-center text-xs">{fmtDate(inv.invoice_date)}</TableCell>
                        <TableCell className="text-center text-xs font-medium">₹{billAmount.toFixed(2)}</TableCell>
                        <TableCell className="text-center text-xs font-medium text-emerald-600">₹{received.toFixed(2)}</TableCell>
                        <TableCell className="text-center text-xs text-orange-600">₹{tds.toFixed(2)}</TableCell>
                        <TableCell className="text-center text-xs text-blue-600">₹{cd.toFixed(2)}</TableCell>
                        <TableCell className="text-center text-xs text-violet-600">₹{(parseFloat(inv.total_credit_note || 0) || 0).toFixed(2)}</TableCell>
                        <TableCell className="text-center text-xs font-bold text-red-600">₹{pendingBal.toFixed(2)}</TableCell>
                        <TableCell className="text-center"><StatusBadge status={inv.collection_status} /></TableCell>
                      </TableRow>
                    )
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-10 text-slate-500">
                      {view === "disputed" ? "No disputed bills." : "No pending collections found."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div ref={pendingEndRef} className="py-2 flex justify-center">
            {isFetchingNextPending && (
              <div className="flex items-center gap-2 text-blue-600 font-bold animate-pulse text-[10px]">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>LOADING MORE...</span>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Add Receipt Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[calc(100vw-0.75rem)] max-w-[calc(100vw-0.75rem)] sm:max-w-4xl max-h-[95vh] overflow-x-hidden overflow-y-auto p-0 [overflow-wrap:anywhere]">
          <div className="p-3 sm:p-6">
            <DialogHeader className="min-w-0">
              <DialogTitle className="text-lg sm:text-xl font-bold text-slate-900 break-words">
                Add Collection Receipt - {selectedInvoice?.invoice_no}
              </DialogTitle>
              <DialogDescription className="sr-only">Record a payment receipt against this invoice</DialogDescription>
            </DialogHeader>

            {selectedInvoice && (
              <div className="space-y-6 mt-6 min-w-0">
                {/* Party bar + bill summary */}
                <div className="border-2 border-slate-100 rounded-xl sm:rounded-3xl overflow-hidden bg-white shadow-sm min-w-0">
                  <div className="bg-blue-600 px-3 sm:px-5 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                      <Badge className="max-w-full bg-white text-blue-800 hover:bg-white px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-black tracking-tight rounded-full shadow-sm uppercase whitespace-normal break-words">
                        DETAILS FOR {selectedInvoice.party_name || "—"}
                      </Badge>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-blue-100 font-black uppercase tracking-widest leading-none mb-1">
                          INVOICE {selectedInvoice.invoice_no}
                        </span>
                        <span className="text-xs text-blue-100 font-bold leading-none">DO {selectedInvoice.so_no || selectedInvoice.d_sr_number || "—"}</span>
                      </div>
                    </div>
                    <StatusBadge status={selectedInvoice.collection_status} />
                  </div>

                  <div className="px-3 sm:px-5 py-5 bg-slate-50 border-t border-slate-100">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-4 sm:gap-6 bg-white border border-slate-100 rounded-2xl p-4 sm:p-6 shadow-sm">
                      <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">Bill Amount</p>
                        <p className="text-sm font-semibold text-slate-900">{money(selectedInvoice.bill_amount)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">Invoice Date</p>
                        <p className="text-sm font-semibold text-slate-900">{fmtDate(selectedInvoice.invoice_date)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">Received</p>
                        <p className="text-sm font-semibold text-emerald-600">{money(selectedInvoice.total_received)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">TDS</p>
                        <p className="text-sm font-semibold text-orange-600">{money(selectedInvoice.total_tds)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">CD</p>
                        <p className="text-sm font-semibold text-blue-600">{money(selectedInvoice.total_cd)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">Credit Note</p>
                        <p className="text-sm font-semibold text-violet-600">{money(selectedInvoice.total_credit_note)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">Pending Balance</p>
                        <p className="text-base font-bold text-red-600">{money(selectedPending)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payment details */}
                <div className="space-y-6 border rounded-lg p-4 sm:p-6 bg-white shadow-sm">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b pb-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    Payment Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    <div className="space-y-2">
                      <Label>Receipt Date <span className="text-red-500">*</span></Label>
                      <Input
                        type="date"
                        className="h-10"
                        value={formData.receiptDate}
                        onChange={(e) => setFormData((p) => ({ ...p, receiptDate: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Payment Mode</Label>
                      <Select value={formData.paymentMode} onValueChange={(v) => setFormData((p) => ({ ...p, paymentMode: v }))}>
                        <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NEFT">NEFT</SelectItem>
                          <SelectItem value="RTGS">RTGS</SelectItem>
                          <SelectItem value="Cheque">Cheque</SelectItem>
                          <SelectItem value="UPI">UPI</SelectItem>
                          <SelectItem value="Cash">Cash</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Reference / UTR No.</Label>
                      <Input
                        className="h-10"
                        value={formData.referenceNo}
                        onChange={(e) => setFormData((p) => ({ ...p, referenceNo: e.target.value }))}
                        placeholder="Enter UTR / Cheque No"
                      />
                    </div>
                  </div>
                </div>

                {/* Settlement */}
                <div className="space-y-6 border rounded-lg p-4 sm:p-6 bg-white shadow-sm">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center justify-between gap-2 border-b pb-2">
                    <span className="flex items-center gap-2">
                      <IndianRupee className="h-4 w-4 text-emerald-600" />
                      Settlement
                    </span>
                    <button
                      type="button"
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                      onClick={() =>
                        setFormData((p) => ({
                          ...p,
                          amountReceived: String(
                            Math.max(0, +(selectedPending - (parseFloat(p.tdsDeducted) || 0) - (parseFloat(p.cdGiven) || 0)).toFixed(2)),
                          ),
                        }))
                      }
                    >
                      Fill remaining balance
                    </button>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    <div className="space-y-2">
                      <Label>Amount Received in Bank (₹) <span className="text-red-500">*</span></Label>
                      <Input
                        type="number"
                        min={0}
                        className="h-10"
                        placeholder="0.00"
                        value={formData.amountReceived}
                        onChange={(e) => setFormData((p) => ({ ...p, amountReceived: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>TDS Deducted (₹)</Label>
                      <Input
                        type="number"
                        min={0}
                        className="h-10"
                        placeholder="0.00"
                        value={formData.tdsDeducted}
                        onChange={(e) => { setTouched((t) => ({ ...t, tds: true })); setFormData((p) => ({ ...p, tdsDeducted: e.target.value })) }}
                      />
                      {suggestion?.tds && (
                        <p className="text-[11px] text-slate-500">
                          {isSuggesting ? "Calculating…" : <>As per TDS master: <span className="font-semibold text-slate-700">{money(suggestion.tds.suggested_tds)}</span></>}
                          {touched.tds && (
                            <button
                              type="button"
                              className="ml-2 font-semibold text-blue-600 hover:text-blue-800"
                              onClick={() => {
                                setTouched((t) => ({ ...t, tds: false }))
                                setFormData((p) => ({ ...p, tdsDeducted: suggestion.tds.suggested_tds > 0 ? String(suggestion.tds.suggested_tds) : "" }))
                              }}
                            >
                              Use
                            </button>
                          )}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Cash Discount (₹)</Label>
                      <Input
                        type="number"
                        min={0}
                        className="h-10"
                        placeholder="0.00"
                        value={formData.cdGiven}
                        onChange={(e) => { setTouched((t) => ({ ...t, cd: true })); setFormData((p) => ({ ...p, cdGiven: e.target.value })) }}
                      />
                      {suggestion?.cd && (
                        <p className="text-[11px] text-slate-500">
                          {suggestion.cd.lines.length === 0 ? (
                            "No CD rule matches this item"
                          ) : (
                            <>As per CD master: <span className="font-semibold text-slate-700">{money(suggestion.cd.suggested_cd)}</span></>
                          )}
                          {suggestion.cd.lines.length > 0 && touched.cd && (
                            <button
                              type="button"
                              className="ml-2 font-semibold text-blue-600 hover:text-blue-800"
                              onClick={() => {
                                setTouched((t) => ({ ...t, cd: false }))
                                setFormData((p) => ({ ...p, cdGiven: suggestion.cd.suggested_cd > 0 ? String(suggestion.cd.suggested_cd) : "" }))
                              }}
                            >
                              Use
                            </button>
                          )}
                        </p>
                      )}
                    </div>
                  </div>

                  {suggestion && (
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 sm:p-5 space-y-5">
                      <div className="max-w-md space-y-2">
                        <Label>TDS Rule (Nature of Transaction)</Label>
                        {suggestion.tds_rules?.length > 0 ? (
                          <Select
                            value={tdsRuleId !== undefined ? String(tdsRuleId) : undefined}
                            onValueChange={(v) => { setTdsRuleId(Number(v)); setTouched((t) => ({ ...t, tds: false })) }}
                          >
                            <SelectTrigger className="h-10 w-full bg-white"><SelectValue placeholder="Select TDS rule" /></SelectTrigger>
                            <SelectContent>
                              {suggestion.tds_rules.map((r: any) => (
                                <SelectItem key={r.id} value={String(r.id)}>
                                  {r.name}{r.guiding_rule ? ` — ${r.guiding_rule}` : ""} ({parseFloat(r.rate || 0)}%)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="text-xs text-slate-500">No active TDS rule is effective on this date.</p>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
                        {/* TDS */}
                        <div className="rounded-lg border bg-white p-4">
                          <p className="mb-2 border-b pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">TDS Calculation</p>
                          {suggestion.tds ? (
                            <>
                              <CalcRow label="Rate of deduction" value={`${suggestion.tds.rate}%`} />
                              <CalcRow label="Threshold limit" value={money(suggestion.tds.threshold_limit)} />
                              <CalcRow label="Rule effective from" value={fmtDate(suggestion.tds.wef_date)} />
                              <CalcRow label="Rate applies on" value={suggestion.tds.applicable_amount_type || "Total Invoice Amount"} />
                              {suggestion.tds.cumulative_before !== null && (
                                <CalcRow label="Sales to customer this FY (before this bill)" value={money(suggestion.tds.cumulative_before)} />
                              )}
                              {suggestion.tds.gst_source && suggestion.tds.gst_source !== "sku" && (
                                <div className="mb-1 rounded-md border border-amber-200 bg-amber-50 p-3">
                                  <Label className="text-xs text-amber-900">
                                    GST % {suggestion.tds.gst_source === "manual" ? "(entered by you)" : "is not set in the SKU master. Enter it"}
                                  </Label>
                                  <div className="mt-1.5 flex items-center gap-2">
                                    <Input
                                      type="number"
                                      min={0}
                                      max={100}
                                      step="0.01"
                                      className="h-9 w-28 bg-white"
                                      placeholder={String(suggestion.tds.gst_percent ?? 5)}
                                      value={gstInput}
                                      onChange={(e) => setGstInput(e.target.value)}
                                      onBlur={() => {
                                        const v = parseFloat(gstInput)
                                        setGstPercent(Number.isFinite(v) && v >= 0 && v <= 100 ? v : undefined)
                                        setTouched((t) => ({ ...t, tds: false }))
                                      }}
                                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
                                    />
                                    <span className="text-xs text-amber-900">%  (using {suggestion.tds.gst_percent}% until you enter one)</span>
                                  </div>
                                </div>
                              )}
                              {suggestion.tds.taxable_value !== null && suggestion.tds.taxable_value !== undefined && (
                                <CalcRow label="Taxable value of this bill (excl. GST)" value={money(suggestion.tds.taxable_value)} />
                              )}
                              <CalcRow label="Amount TDS is charged on" value={money(suggestion.tds.base_amount)} />
                              <CalcRow label="TDS on this bill" value={money(suggestion.tds.total_tds)} />
                              <CalcRow label="Already deducted earlier" value={`− ${money(suggestion.tds.already_deducted)}`} />
                              <CalcRow label="Suggested TDS now" value={money(suggestion.tds.suggested_tds)} strong />
                              {suggestion.tds.note && (
                                <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">{suggestion.tds.note}</p>
                              )}
                            </>
                          ) : (
                            <p className="py-2 text-xs text-slate-500">No TDS rule applies.</p>
                          )}
                        </div>

                        {/* CD */}
                        <div className="rounded-lg border bg-white p-4">
                          <p className="mb-2 border-b pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">CD Calculation</p>
                          <CalcRow label="Days since invoice date" value={`${suggestion.cd.days_elapsed} day(s)`} />
                          {suggestion.cd.lines.map((l: any, i: number) => (
                            <div key={i} className="border-b border-dashed py-2 last:border-b-0">
                              <div className="flex items-start justify-between gap-3 text-xs">
                                <span className="font-medium text-slate-700">{l.rule_code || `CD Rule ${l.rule_id}`}</span>
                                <span className={cn(
                                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                  l.eligible ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
                                )}>
                                  {l.eligible ? `Within ${l.payment_condition_days} days` : `Over ${l.payment_condition_days}-day limit`}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-slate-500">
                                {l.qty} qty × {money(l.rate_per_main_uom)} = <span className="font-semibold text-slate-700">{money(l.eligible ? l.amount : 0)}</span>
                              </p>
                            </div>
                          ))}
                          <CalcRow label="CD allowed per master" value={money(suggestion.cd.total_cd)} />
                          {suggestion.cd.invoice_cd > 0 && (
                            <CalcRow label="Already allowed on invoice (Make Invoice)" value={`− ${money(suggestion.cd.invoice_cd)}`} />
                          )}
                          <CalcRow label="Already given earlier" value={`− ${money(suggestion.cd.already_given)}`} />
                          <CalcRow label="Suggested CD now" value={money(suggestion.cd.suggested_cd)} strong />
                          {suggestion.cd.note && (
                            <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">{suggestion.cd.note}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-1 border-t pt-4 sm:flex-row sm:items-center sm:justify-between text-sm">
                    <span className="text-slate-600">
                      Received + TDS + CD: <span className="font-bold text-slate-900">{money(entryTotal)}</span>
                    </span>
                    {hasNegative ? (
                      <span className="font-semibold text-red-600">Amounts cannot be negative</span>
                    ) : overPayment ? (
                      <span className="font-semibold text-red-600">Exceeds pending balance by {money(entryTotal - selectedPending)}</span>
                    ) : (
                      <span className="text-slate-600">
                        Balance after this receipt: <span className="font-bold text-slate-900">{money(selectedPending - entryTotal)}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Remarks */}
                <div className="space-y-6 border rounded-lg p-4 sm:p-6 bg-white shadow-sm">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b pb-2">
                    <FileText className="h-4 w-4 text-purple-600" />
                    Remarks
                  </h3>
                  <Input
                    className="h-10"
                    value={formData.remarks}
                    onChange={(e) => setFormData((p) => ({ ...p, remarks: e.target.value }))}
                    placeholder="Enter remarks (optional)"
                  />
                </div>
              </div>
            )}

            <DialogFooter className="mt-8 border-t pt-4 bg-gray-50 -mx-3 sm:-mx-6 -mb-3 sm:-mb-6 px-3 sm:px-6 py-4 gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isProcessing} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!canSave}
                className="w-full bg-blue-600 hover:bg-blue-700 min-w-[150px] sm:w-auto"
              >
                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isProcessing ? "Processing..." : "Save Receipt"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipts of one bill */}
      <Dialog open={!!receiptsFor} onOpenChange={(o) => !o && setReceiptsFor(null)}>
        <DialogContent className="w-[calc(100vw-0.75rem)] max-w-[calc(100vw-0.75rem)] sm:max-w-5xl max-h-[95vh] overflow-x-hidden overflow-y-auto p-0 [overflow-wrap:anywhere]">
          <div className="p-3 sm:p-6">
            <DialogHeader className="min-w-0">
              <DialogTitle className="text-lg sm:text-xl font-bold text-slate-900 break-words">
                Receipts - {receiptsFor?.invoice_no}
              </DialogTitle>
              <DialogDescription className="sr-only">All receipts, TDS and CD entries recorded against this invoice</DialogDescription>
            </DialogHeader>

            <div className="space-y-6 mt-6 min-w-0">
              <div className="border-2 border-slate-100 rounded-xl sm:rounded-3xl overflow-hidden bg-white shadow-sm min-w-0">
                <div className="bg-blue-600 px-3 sm:px-5 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                    <Badge className="max-w-full bg-white text-blue-800 hover:bg-white px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-black tracking-tight rounded-full shadow-sm uppercase whitespace-normal break-words">
                      DETAILS FOR {receiptsFor?.party_name || "—"}
                    </Badge>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-blue-100 font-black uppercase tracking-widest leading-none mb-1">
                        INVOICE {receiptsFor?.invoice_no}
                      </span>
                      <span className="text-xs text-blue-100 font-bold leading-none">DO {receiptsFor?.so_no || receiptsFor?.d_sr_number || "—"}</span>
                    </div>
                  </div>
                  {receiptsData && <StatusBadge status={receiptsData.collection_status} />}
                </div>

                <div className="px-3 sm:px-5 py-5 bg-slate-50 border-t border-slate-100">
                  {isReceiptsLoading ? (
                    <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
                  ) : receiptsData ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 sm:gap-6 bg-white border border-slate-100 rounded-2xl p-4 sm:p-6 shadow-sm">
                      <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">Bill Amount</p>
                        <p className="text-sm font-semibold text-slate-900">{money(receiptsData.bill_amount)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">Received</p>
                        <p className="text-sm font-semibold text-emerald-600">{money(receiptsData.total_received)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">TDS</p>
                        <p className="text-sm font-semibold text-orange-600">{money(receiptsData.total_tds)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">CD</p>
                        <p className="text-sm font-semibold text-blue-600">{money(receiptsData.total_cd)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">Credit Note</p>
                        <p className="text-sm font-semibold text-violet-600">{money(receiptsData.total_credit_note)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">Pending Balance</p>
                        <p className="text-base font-bold text-red-600">
                          {money(
                            (parseFloat(receiptsData.bill_amount || 0) || 0) -
                              ((parseFloat(receiptsData.total_received || 0) || 0) +
                                (parseFloat(receiptsData.total_tds || 0) || 0) +
                                (parseFloat(receiptsData.total_cd || 0) || 0) +
                                (parseFloat(receiptsData.total_credit_note || 0) || 0)),
                          )}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-center text-sm text-slate-500 py-4">Could not load receipts.</p>
                  )}
                </div>
              </div>

              {receiptsData && (
                <div className="space-y-6 border rounded-lg p-4 sm:p-6 bg-white shadow-sm">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b pb-2">
                    <ReceiptText className="h-4 w-4 text-blue-600" />
                    Receipt History
                  </h3>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          {["Date", "Entry", "Received", "TDS", "CD", "UTR / Ref", "TDS Rule", "Remarks"].map((h) => (
                            <TableHead key={h} className="text-center whitespace-nowrap">{h}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {receiptsData.receipts.length === 0 ? (
                          <TableRow><TableCell colSpan={8} className="text-center py-8 text-slate-500">No receipts recorded yet.</TableCell></TableRow>
                        ) : (
                          receiptsData.receipts.map((r: any) => {
                            const ev = r.payment_mode === "Dispute Raised" || r.payment_mode === "Dispute Resolved"
                            return (
                              <TableRow key={r.id} className={ev ? "bg-red-50/40" : ""}>
                                <TableCell className="text-center text-xs">{fmtDate(r.receipt_date)}</TableCell>
                                <TableCell className="text-center text-xs">
                                  {ev ? (
                                    <Badge className={r.payment_mode === "Dispute Raised" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}>{r.payment_mode}</Badge>
                                  ) : (
                                    r.payment_mode || "—"
                                  )}
                                </TableCell>
                                <TableCell className="text-center text-xs font-medium text-emerald-600">{ev ? "—" : money(r.amount_received)}</TableCell>
                                <TableCell className="text-center text-xs text-orange-600">{ev ? "—" : money(r.tds_deducted)}</TableCell>
                                <TableCell className="text-center text-xs text-blue-600">{ev ? "—" : money(r.cd_given)}</TableCell>
                                <TableCell className="text-center text-xs">{r.reference_no || "—"}</TableCell>
                                <TableCell className="text-center text-xs">{r.tds_rule_name || "—"}</TableCell>
                                <TableCell className="text-xs">{r.remarks || "—"}</TableCell>
                              </TableRow>
                            )
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="mt-8 border-t pt-4 bg-gray-50 -mx-3 sm:-mx-6 -mb-3 sm:-mb-6 px-3 sm:px-6 py-4 gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setReceiptsFor(null)} className="w-full sm:w-auto">
                Close
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dispute raise / resolve */}
      <Dialog open={!!disputeFor} onOpenChange={(o) => !o && setDisputeFor(null)}>
        <DialogContent className="w-[calc(100vw-0.75rem)] max-w-[calc(100vw-0.75rem)] sm:max-w-2xl max-h-[95vh] overflow-x-hidden overflow-y-auto p-0 [overflow-wrap:anywhere]">
          <div className="p-3 sm:p-6">
            <DialogHeader className="min-w-0">
              <DialogTitle className="text-lg sm:text-xl font-bold text-slate-900 break-words">
                {disputeFor?.collection_status === "Disputed" ? "Resolve Dispute" : "Mark Bill as Disputed"} - {disputeFor?.invoice_no}
              </DialogTitle>
              <DialogDescription className="sr-only">Record the reason for changing the dispute status of this bill</DialogDescription>
            </DialogHeader>

            {disputeFor && (
              <div className="space-y-6 mt-6 min-w-0">
                <div className="border-2 border-slate-100 rounded-xl sm:rounded-3xl overflow-hidden bg-white shadow-sm min-w-0">
                  <div className="bg-blue-600 px-3 sm:px-5 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Badge className="max-w-full bg-white text-blue-800 hover:bg-white px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-black tracking-tight rounded-full shadow-sm uppercase whitespace-normal break-words w-fit">
                      DETAILS FOR {disputeFor.party_name || "—"}
                    </Badge>
                    <StatusBadge status={disputeFor.collection_status} />
                  </div>
                  <div className="px-3 sm:px-5 py-5 bg-slate-50 border-t border-slate-100">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6 bg-white border border-slate-100 rounded-2xl p-4 sm:p-6 shadow-sm">
                      <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">Invoice No</p>
                        <p className="text-sm font-semibold text-slate-900">{disputeFor.invoice_no}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">Bill Amount</p>
                        <p className="text-sm font-semibold text-slate-900">{money(disputeFor.bill_amount)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">Pending Balance</p>
                        <p className="text-base font-bold text-red-600">{money(pendingOf(disputeFor))}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6 border rounded-lg p-4 sm:p-6 bg-white shadow-sm">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b pb-2">
                    {disputeFor.collection_status === "Disputed" ? (
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <ShieldAlert className="h-4 w-4 text-red-600" />
                    )}
                    {disputeFor.collection_status === "Disputed" ? "Resolution Details" : "Dispute Details"}
                  </h3>
                  <div className="space-y-2">
                    <Label>
                      {disputeFor.collection_status === "Disputed" ? "Resolution Remarks" : "Dispute Reason"} <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      className="h-10"
                      value={disputeRemarks}
                      onChange={(e) => setDisputeRemarks(e.target.value)}
                      placeholder={disputeFor.collection_status === "Disputed" ? "How was the dispute settled?" : "Why is this bill disputed?"}
                    />
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="mt-8 border-t pt-4 bg-gray-50 -mx-3 sm:-mx-6 -mb-3 sm:-mb-6 px-3 sm:px-6 py-4 gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setDisputeFor(null)} disabled={isProcessing} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button
                onClick={handleDispute}
                disabled={isProcessing || !disputeRemarks.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 min-w-[150px] sm:w-auto"
              >
                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isProcessing ? "Processing..." : disputeFor?.collection_status === "Disputed" ? "Resolve Dispute" : "Mark Disputed"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </WorkflowStageShell>
  )
}
