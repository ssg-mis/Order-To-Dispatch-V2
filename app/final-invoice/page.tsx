"use client"

import * as React from "react"
import { useState, useMemo, useCallback } from "react"
import { WorkflowStageShell } from "@/components/workflow/workflow-stage-shell"
import { OrderChargesPanel } from "@/components/order-punch/order-charges-panel"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { FileUploadField } from "@/components/file-upload-field"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { ColumnDragProvider } from "@/components/ui/column-drag-provider"
import { usePersistedColumns } from "@/hooks/use-persisted-columns"
import { useColumnOrder } from "@/hooks/use-column-order"
import { usePersistedFilters } from "@/hooks/use-persisted-filters"
import { useStageTable, type StageColDef } from "@/hooks/use-stage-table"
import { StageListHeader, StageToolbar, StageFilterSelect, StageColumnsMenu, StageActiveChips, StageHeadCell, StageTotalsRow, StageActionHead, StagePagination, StageActionFooter } from "@/components/stage-list"
import { Printer, CheckCircle, FileText, Receipt, ExternalLink, Package } from "lucide-react"
import { finalInvoiceApi, orderApi } from "@/lib/api-service"
import { useAuth } from "@/hooks/use-auth"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { fmtNum, fmtDate } from "@/lib/table-format"
import { cn } from "@/lib/utils"

const FINAL_INVOICE_COLS: StageColDef<any>[] = [
  { id: "customer_name", label: "Customer", accessor: (r) => r.customer_name || "" },
  { id: "invoice_no", label: "Invoice No.", accessor: (r) => r.invoice_no || "" },
  { id: "vehicle_no", label: "Vehicle No.", accessor: (r) => r.vehicle_no || "" },
  { id: "bill_amount", label: "Bill Amount (₹)", type: "number", accessor: (r) => parseFloat(r.bill_amount || 0) || 0, total: true },
  {
    id: "documents",
    label: "Documents",
    noSort: true,
    accessor: (r) => [r.invoice_copy && "Invoice", r.e_invoice_file && "eInvoice", r.e_way_bill_file && "eWay Bill"].filter(Boolean).join(" "),
  },
]
const FINAL_INVOICE_COL_IDS = FINAL_INVOICE_COLS.map((c) => c.id)

/** Stage list card (header + toolbar + per-column search + TOTAL row) shared by the Pending and History tabs. */
function FinalInvoiceTable({
  storageKey,
  title,
  description,
  rows,
  isHistory,
  renderCell,
  renderActions,
  onRowClick,
  page,
  totalPages,
  total,
  onPrev,
  onNext,
}: {
  onRowClick: (row: any) => void
  page: number
  totalPages: number
  total: number
  onPrev: () => void
  onNext: () => void
  storageKey: string
  title: string
  description: string
  rows: any[]
  isHistory: boolean
  renderCell: (row: any, colId: string) => React.ReactNode
  renderActions: (row: any, isHistory: boolean) => React.ReactNode
}) {
  const { isAdmin, isFeatureEnabled } = useAuth()
  const [visibleColumns, setVisibleColumns] = usePersistedColumns(storageKey, FINAL_INVOICE_COL_IDS)
  const [columnOrder, setColumnOrder] = useColumnOrder(storageKey, FINAL_INVOICE_COL_IDS)
  const [listView, patchListView] = usePersistedFilters(storageKey, { quickSearch: "", customerFilter: "ALL" })
  const { quickSearch, customerFilter } = listView
  const setQuickSearch = (v: string) => patchListView({ quickSearch: v })
  const setCustomerFilter = (v: string) => patchListView({ customerFilter: v })

  const baseFilter = useCallback(
    (r: any) => {
      if (customerFilter !== "ALL" && (r.customer_name || "") !== customerFilter) return false
      const q = quickSearch.trim().toLowerCase()
      if (q && ![r.customer_name, r.invoice_no, r.vehicle_no].join(" ").toLowerCase().includes(q)) return false
      return true
    },
    [customerFilter, quickSearch]
  )
  const table = useStageTable<any>({ rows, columns: FINAL_INVOICE_COLS, baseFilter, persistKey: storageKey })

  const orderedVisible = columnOrder.filter((id) => visibleColumns.includes(id))
  const orderedCols = orderedVisible.map((id) => FINAL_INVOICE_COLS.find((c) => c.id === id)).filter(Boolean) as StageColDef<any>[]
  const handleColumnReorder = useCallback(
    (newVisibleOrder: string[]) => {
      const set = new Set(newVisibleOrder)
      setColumnOrder([...newVisibleOrder, ...columnOrder.filter((id) => !set.has(id))])
    },
    [columnOrder, setColumnOrder]
  )
  const customerOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.customer_name).filter(Boolean))).sort() as string[], [rows])
  const activeCount = (customerFilter !== "ALL" ? 1 : 0) + (quickSearch.trim() ? 1 : 0) + table.activeColumnFilterCount
  const reset = () => {
    setCustomerFilter("ALL")
    setQuickSearch("")
    table.clearColumnFilters()
  }

  return (
    <Card className="border border-slate-200/80 shadow-xs overflow-clip py-0 gap-0 stage-card">
      <StageListHeader
        title={title}
        shown={table.rows.length}
        total={rows.length}
        description={description}
        searchValue={quickSearch}
        onSearchChange={setQuickSearch}
        searchPlaceholder="Search Customer, Invoice, Vehicle..."
      >
        <StageToolbar
          shown={table.rows.length}
          total={rows.length}
          activeCount={activeCount}
          onReset={reset}
          filters={
            <>
              <StageFilterSelect value={customerFilter} onChange={setCustomerFilter} allLabel="All Customers" options={customerOptions} />
              <StageColumnsMenu
                columns={FINAL_INVOICE_COLS}
                visibleColumns={visibleColumns}
                setVisibleColumns={setVisibleColumns}
                show={isAdmin || isFeatureEnabled("can_toggle_columns")}
              />
            </>
          }
        />
        <StageActiveChips
          chips={[
            ...(customerFilter !== "ALL" ? [{ label: `Customer: ${customerFilter}`, onClear: () => setCustomerFilter("ALL") }] : []),
            ...(quickSearch.trim() ? [{ label: `Search: ${quickSearch.trim()}`, onClear: () => setQuickSearch("") }] : []),
          ]}
        />
      </StageListHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50 border-b">
              <TableRow>
                <ColumnDragProvider columnIds={orderedVisible} onReorder={handleColumnReorder} disabled={!isAdmin && !isFeatureEnabled("can_reorder_columns")}>
                  {orderedCols.map((col) => (
                    <StageHeadCell key={col.id} col={col} table={table} align={col.id === "bill_amount" ? "right" : "left"} />
                  ))}
                </ColumnDragProvider>
                <StageActionHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              <StageTotalsRow
                columns={orderedCols}
                totals={table.totals}
                count={table.rows.length}
                unit=""
                trailingCells={1}
                format={(n) => fmtNum(n, 2)}
                tones={{ bill_amount: "emerald" }}
                align={{ bill_amount: "right" }}
              />
              {table.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={orderedCols.length + 1} className="text-center py-12 text-muted-foreground">
                    <p className="font-medium text-slate-500">No matching records found for the filters</p>
                    <button onClick={reset} className="text-xs text-blue-600 hover:underline mt-1 font-semibold">
                      Clear Filters
                    </button>
                  </TableCell>
                </TableRow>
              ) : (
                table.rows.map((row, idx) => (
                  <TableRow
                    key={row.invoice_ids?.join("-") || row.invoice_id || idx}
                    onClick={() => onRowClick(row)}
                    title="Click to view details"
                    className="cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    {orderedCols.map((col) => renderCell(row, col.id))}
                    {/* Buttons inside the row must not also trigger the row click. */}
                    <TableCell className="px-4 text-left" onClick={(e) => e.stopPropagation()}>{renderActions(row, isHistory)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <StagePagination
          sticky
          page={page}
          totalPages={totalPages}
          total={total}
          noun="Items"
          onPrev={onPrev}
          onNext={onNext}
          prevDisabled={page <= 1}
          nextDisabled={page >= totalPages}
        />
      </CardContent>
    </Card>
  )
}

/** Label + value tile used in the details modal. */
function DetailTile({ label, children, highlight = false }: { label: string; children: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-3.5", highlight ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-slate-50/60")}>
      <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <div className="break-words text-sm font-bold text-slate-800">{children}</div>
    </div>
  )
}

const PAGE_SIZE = 25

export default function FinalInvoicePage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { user } = useAuth()

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedRow, setSelectedRow] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [viewOnly, setViewOnly] = useState(false)
  const [isUploading, setIsUploading] = useState<Record<string, boolean>>({})
  const [formData, setFormData] = useState({
    eInvoiceFile: "",
    eInvoiceFileName: "",
    eWayBillFile: "",
    eWayBillFileName: "",
  })

  const [pendingPage, setPendingPage] = useState(1)
  const [historyPage, setHistoryPage] = useState(1)

  // Fetch pending
  const { data: pendingRes, isLoading: pendingLoading, refetch: refetchPending } = useQuery({
    queryKey: ["final-invoice-pending", pendingPage],
    queryFn: () => finalInvoiceApi.getPending({ page: pendingPage, limit: PAGE_SIZE }),
    staleTime: 30 * 1000,
  })

  // Fetch history
  const { data: historyRes, isLoading: historyLoading } = useQuery({
    queryKey: ["final-invoice-history", historyPage],
    queryFn: () => finalInvoiceApi.getHistory({ page: historyPage, limit: PAGE_SIZE }),
    staleTime: 30 * 1000,
  })

  const pendingRows: any[] = pendingRes?.data?.rows || []
  const historyRows: any[] = historyRes?.data?.rows || []
  const customerNames = Array.from(new Set(pendingRows.map((r: any) => r.customer_name || "Unknown")))

  // If the last row of a page is submitted, that page empties — step back instead of stranding the user.
  React.useEffect(() => {
    if (!pendingLoading && pendingPage > 1 && pendingRows.length === 0) setPendingPage(p => p - 1)
  }, [pendingLoading, pendingPage, pendingRows.length])
  React.useEffect(() => {
    if (!historyLoading && historyPage > 1 && historyRows.length === 0) setHistoryPage(p => p - 1)
  }, [historyLoading, historyPage, historyRows.length])

  const openDetails = (row: any, readOnly: boolean) => {
    setSelectedRow(row)
    setViewOnly(readOnly)
    setFormData({ eInvoiceFile: "", eInvoiceFileName: "", eWayBillFile: "", eWayBillFileName: "" })
    setIsDialogOpen(true)
  }
  // Pending rows open the upload modal; history rows (already finalized) open the same details read-only.
  const handleOpenDialog = (row: any) => openDetails(row, false)
  const handleViewDetails = (row: any) => openDetails(row, true)

  const handleFileUpload = async (file: File, fileKey: string, nameKey: string) => {
    setIsUploading(prev => ({ ...prev, [fileKey]: true }))
    try {
      const response = await orderApi.uploadFile(file)
      if (response.success && response.data?.url) {
        setFormData(prev => ({ ...prev, [fileKey]: response.data.url, [nameKey]: file.name }))
        toast({ title: "Upload Successful", description: `${file.name} uploaded.` })
      } else {
        throw new Error(response.message || "Upload failed")
      }
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err.message || "Network error", variant: "destructive" })
    } finally {
      setIsUploading(prev => ({ ...prev, [fileKey]: false }))
    }
  }

  const handleSubmit = async () => {
    if (!selectedRow) return
    setIsProcessing(true)
    try {
      const result = await finalInvoiceApi.submit(selectedRow.invoice_id, {
        eInvoiceFile: formData.eInvoiceFile || null,
        eWayBillFile: formData.eWayBillFile || null,
        userId: user?.id || null,
        // One list row = one invoice: the documents apply to every product line of it.
        invoiceIds: selectedRow.invoice_ids,
      })
      if (result.success) {
        toast({ title: "Final Invoice Submitted!", description: "eInvoice and eWay Bill saved successfully." })
        setIsDialogOpen(false)
        refetchPending()
        queryClient.invalidateQueries({ queryKey: ["final-invoice-history"] })
      } else {
        throw new Error(result.message)
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePrint = (row: any) => {
    const printContent = `
      <html><head><title>Final Invoice - ${row.invoice_no}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        .subtitle { color: #555; font-size: 13px; margin-bottom: 20px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
        .field { background: #f8f8f8; padding: 10px 14px; border-radius: 6px; }
        .field label { font-size: 11px; color: #666; text-transform: uppercase; }
        .field p { font-size: 14px; font-weight: 600; margin: 2px 0 0; }
        .badge { display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: bold; background: #dcfce7; color: #166534; }
        .doc-link { display: block; margin: 8px 0; padding: 10px 14px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; }
        @media print { button { display: none; } }
      </style></head>
      <body>
        <h1>Shree Shyam Oil Extractions</h1>
        <div class="subtitle">Final Invoice Sheet — Stage 11</div>
        <div class="grid">
          <div class="field"><label>Customer Name</label><p>${row.customer_name || '—'}</p></div>
          <div class="field"><label>Invoice No.</label><p>${row.invoice_no || '—'}</p></div>
          <div class="field"><label>Vehicle No.</label><p>${row.vehicle_no || '—'}</p></div>
          <div class="field"><label>Bill Amount</label><p>₹${parseFloat(row.bill_amount || 0).toFixed(2)}</p></div>
          <div class="field"><label>Insurance</label><p>${row.insurance_details || '—'}</p></div>
          <div class="field"><label>Diesel Amount</label><p>₹${row.diesel_amount || 0}</p></div>
          <div class="field"><label>Driver Advance (Cash)</label><p>₹${row.driver_advance_cash || 0}</p></div>
          <div class="field"><label>Driver Advance (Bank)</label><p>₹${row.driver_advance_bank || 0}</p></div>
        </div>
        ${row.invoice_copy ? `<div class="doc-link">📎 Proforma Invoice: <a href="${row.invoice_copy}" target="_blank">${row.invoice_copy.split('/').pop()}</a></div>` : ''}
        ${row.e_invoice_file ? `<div class="doc-link">✅ eInvoice: <a href="${row.e_invoice_file}" target="_blank">${row.e_invoice_file.split('/').pop()}</a></div>` : '<div class="doc-link" style="color:#c00">⚠️ eInvoice not uploaded</div>'}
        ${row.e_way_bill_file ? `<div class="doc-link">✅ eWay Bill: <a href="${row.e_way_bill_file}" target="_blank">${row.e_way_bill_file.split('/').pop()}</a></div>` : '<div class="doc-link" style="color:#c00">⚠️ eWay Bill not uploaded</div>'}
      </body></html>
    `
    const win = window.open("", "_blank")
    if (win) { win.document.write(printContent); win.document.close(); win.focus(); win.print() }
  }

  const renderCell = (row: any, colId: string) => {
    switch (colId) {
      case "customer_name":
        return <TableCell key={colId} className="px-4 text-left font-semibold text-slate-800">{row.customer_name || "—"}</TableCell>
      case "invoice_no":
        return <TableCell key={colId} className="px-4 text-left font-mono text-sm">{row.invoice_no || "—"}</TableCell>
      case "vehicle_no":
        return <TableCell key={colId} className="px-4 text-left">{row.vehicle_no || "—"}</TableCell>
      case "bill_amount":
        return <TableCell key={colId} className="px-4 text-right font-semibold font-mono tabular-nums whitespace-nowrap min-w-[110px]">{fmtNum(row.bill_amount || 0, 2)}</TableCell>
      case "documents":
        return (
          <TableCell key={colId} className="px-4 text-left" onClick={(e) => e.stopPropagation()}>
            <div className="flex gap-2">
              {row.invoice_copy && (
                <a href={row.invoice_copy} target="_blank" rel="noopener noreferrer">
                  <Badge variant="outline" className="text-blue-600 border-blue-300 gap-1 cursor-pointer hover:bg-blue-50">
                    <FileText className="h-3 w-3" /> Invoice
                  </Badge>
                </a>
              )}
              {row.e_invoice_file && (
                <a href={row.e_invoice_file} target="_blank" rel="noopener noreferrer">
                  <Badge variant="outline" className="text-green-600 border-green-300 gap-1 cursor-pointer hover:bg-green-50">
                    <CheckCircle className="h-3 w-3" /> eInvoice
                  </Badge>
                </a>
              )}
              {row.e_way_bill_file && (
                <a href={row.e_way_bill_file} target="_blank" rel="noopener noreferrer">
                  <Badge variant="outline" className="text-purple-600 border-purple-300 gap-1 cursor-pointer hover:bg-purple-50">
                    <Receipt className="h-3 w-3" /> eWay Bill
                  </Badge>
                </a>
              )}
            </div>
          </TableCell>
        )
      default:
        return null
    }
  }

  const renderActions = (row: any, isHistory = false) => (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" onClick={() => handlePrint(row)} className="gap-1 h-8">
        <Printer className="h-3 w-3" /> Print
      </Button>
      {!isHistory && (
        <Button size="sm" onClick={() => handleOpenDialog(row)} className="gap-1 h-8 bg-blue-600 hover:bg-blue-700">
          Upload Files
        </Button>
      )}
    </div>
  )

  return (
    <>
      <WorkflowStageShell
        persistKey="final-invoice"
        partyNames={customerNames}
        title="Stage 11: Make Final Invoice"
        description="eInvoice / eWay Bill upload for now, direct generation later"
        pendingCount={pendingRows.length}
        historyContent={
          <div className="space-y-4">
            {historyLoading ? (
              <div className="flex items-center justify-center py-12 gap-2 text-slate-500">
                <Loader2 className="animate-spin h-5 w-5" /> Loading...
              </div>
            ) : historyRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                <p className="font-semibold">No history yet</p>
              </div>
            ) : (
              <FinalInvoiceTable
                storageKey="final-invoice-history"
                title="Final Invoice History"
                description="Invoices with final documents already submitted"
                rows={historyRows}
                isHistory
                page={historyPage}
                totalPages={historyRes?.data?.pagination?.totalPages || 1}
                total={historyRes?.data?.pagination?.total ?? historyRows.length}
                onPrev={() => setHistoryPage(p => Math.max(1, p - 1))}
                onNext={() => setHistoryPage(p => p + 1)}
                renderCell={renderCell}
                renderActions={renderActions}
                onRowClick={handleViewDetails}
              />
            )}
          </div>
        }
      >
        <div className="space-y-4">
          {pendingLoading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-slate-500">
              <Loader2 className="animate-spin h-5 w-5" /> Loading...
            </div>
          ) : pendingRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
              <CheckCircle className="h-10 w-10 text-green-400" />
              <p className="font-semibold">No pending invoices</p>
              <p className="text-sm">All invoices have been finalized</p>
            </div>
          ) : (
            <FinalInvoiceTable
              storageKey="final-invoice"
              title="Final Invoices List"
              description="Invoices awaiting eInvoice / eWay Bill upload"
              rows={pendingRows}
              isHistory={false}
              page={pendingPage}
              totalPages={pendingRes?.data?.pagination?.totalPages || 1}
              total={pendingRes?.data?.pagination?.total ?? pendingRows.length}
              onPrev={() => setPendingPage(p => Math.max(1, p - 1))}
              onNext={() => setPendingPage(p => p + 1)}
              renderCell={renderCell}
              renderActions={renderActions}
              onRowClick={handleOpenDialog}
            />
          )}
        </div>
      </WorkflowStageShell>
      {/* Upload Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        {/* Same dialog size and layout as the earlier stages (Check Invoice, Gate Out, ...). */}
        <DialogContent className="w-[calc(100vw-0.75rem)] max-w-[calc(100vw-0.75rem)] sm:!max-w-[95vw] max-h-[95vh] overflow-x-hidden overflow-y-auto p-0 [overflow-wrap:anywhere]">
          <div className="p-3 sm:p-6">
          <DialogHeader className="min-w-0">
            <DialogTitle className="text-lg sm:text-xl font-bold text-slate-900 border-b pb-4 mb-4 break-words">
              {viewOnly ? "Final Invoice Details" : "Upload Final Documents"} - {selectedRow?.invoice_no}
            </DialogTitle>
          </DialogHeader>

          {selectedRow && (
            <div className="space-y-6 mt-6 min-w-0">
              {/* Summary Block */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2.5 px-5 py-3.5 bg-gradient-to-r from-blue-50 to-white border-b border-slate-200">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-600"><FileText className="h-4 w-4" /></span>
                  <p className="text-sm font-black text-slate-800">Order Summary</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-5">
                  <DetailTile label="Customer">{selectedRow.customer_name}</DetailTile>
                  <DetailTile label="Invoice No"><span className="font-mono font-black text-blue-700">{selectedRow.invoice_no}</span></DetailTile>
                  <DetailTile label="Invoice Date"><span className="font-mono">{selectedRow.invoice_date ? fmtDate(selectedRow.invoice_date) : "—"}</span></DetailTile>
                  <DetailTile label="DO Number">{(selectedRow.order_nos?.length ? selectedRow.order_nos : [selectedRow.order_no]).filter(Boolean).join(", ") || "—"}</DetailTile>
                  <DetailTile label="Vehicle">{selectedRow.vehicle_no || "—"}</DetailTile>
                  <DetailTile label="Invoice Amount" highlight><span className="font-mono text-lg font-black text-emerald-700">₹{fmtNum(selectedRow.bill_amount || 0, 2)}</span></DetailTile>
                  <DetailTile label="Insurance">{selectedRow.insurance_details || "—"}</DetailTile>
                  <DetailTile label={`Diesel${selectedRow.petrol_pump_name ? ` (${selectedRow.petrol_pump_name})` : ""}`}><span className="font-mono">₹{fmtNum(selectedRow.diesel_amount || 0, 2)}</span></DetailTile>
                  <DetailTile label="Driver Advance (Cash / Bank)"><span className="font-mono">₹{fmtNum(selectedRow.driver_advance_cash || 0, 2)} / ₹{fmtNum(selectedRow.driver_advance_bank || 0, 2)}</span></DetailTile>
                </div>
              </div>

              {/* Products on this invoice */}
              {selectedRow.lines?.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-blue-50 to-white border-b border-slate-200">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-600"><Package className="h-4 w-4" /></span>
                      <p className="text-sm font-black text-slate-800">Products</p>
                    </div>
                    <Badge variant="outline" className="border-blue-200 bg-white text-blue-700 font-bold">{selectedRow.lines.length} {selectedRow.lines.length === 1 ? "item" : "items"}</Badge>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 hover:bg-slate-50">
                        <TableHead className="h-12 w-16 px-5 text-center text-xs font-black uppercase tracking-wider text-slate-500">#</TableHead>
                        <TableHead className="h-12 px-5 text-left text-xs font-black uppercase tracking-wider text-slate-500">Product</TableHead>
                        <TableHead className="h-12 px-5 text-left text-xs font-black uppercase tracking-wider text-slate-500">DO Number</TableHead>
                        <TableHead className="h-12 px-5 text-right text-xs font-black uppercase tracking-wider text-slate-500">Quantity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedRow.lines.map((l: any, i: number) => (
                        <TableRow key={l.invoice_id} className="h-16 odd:bg-white even:bg-slate-50/50">
                          <TableCell className="px-5 text-center text-sm font-bold text-slate-400">{i + 1}</TableCell>
                          <TableCell className="px-5 text-left text-base font-bold text-slate-900">{l.product_name || "—"}</TableCell>
                          <TableCell className="px-5 text-left text-sm font-medium text-slate-600">{l.order_no || "—"}</TableCell>
                          <TableCell className="px-5 text-right">
                            <span className="font-mono text-base font-black tabular-nums text-slate-900">{fmtNum(l.qty_to_dispatch || 0, 4)}</span>
                            {l.unit && <span className="ml-2 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">{l.unit}</span>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <OrderChargesPanel orderNos={(selectedRow?.order_nos?.length ? selectedRow.order_nos : selectedRow?.order_no ? [selectedRow.order_no] : []).map(String)} />

              {/* Already-uploaded documents (read-only view) */}
              {viewOnly && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 font-bold text-xs text-slate-700">Documents</div>
                  <div className="flex flex-wrap gap-2 p-4">
                    {selectedRow.e_invoice_file ? (
                      <a href={selectedRow.e_invoice_file} target="_blank" rel="noopener noreferrer">
                        <Badge variant="outline" className="text-green-600 border-green-300 gap-1 cursor-pointer hover:bg-green-50"><CheckCircle className="h-3 w-3" /> eInvoice</Badge>
                      </a>
                    ) : <span className="text-xs text-slate-400">eInvoice not uploaded</span>}
                    {selectedRow.e_way_bill_file ? (
                      <a href={selectedRow.e_way_bill_file} target="_blank" rel="noopener noreferrer">
                        <Badge variant="outline" className="text-purple-600 border-purple-300 gap-1 cursor-pointer hover:bg-purple-50"><Receipt className="h-3 w-3" /> eWay Bill</Badge>
                      </a>
                    ) : <span className="text-xs text-slate-400">eWay Bill not uploaded</span>}
                  </div>
                </div>
              )}

              {/* Uploads */}
              {!viewOnly && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                {/* eInvoice Upload */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm transition-all hover:border-blue-300 flex flex-col">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <h3 className="text-sm font-black text-slate-800">eInvoice Document</h3>
                  </div>
                  <p className="text-[11px] text-slate-500 mb-4 font-medium italic">Generate from Tally or GST Portal first, then upload the PDF here.</p>
                  <div className="flex-1 flex flex-col justify-end">
                    <FileUploadField
                      accept=".pdf,image/*"
                      value={formData.eInvoiceFile}
                      fileName={formData.eInvoiceFileName}
                      uploading={isUploading["eInvoiceFile"] || false}
                      variant="dropzone"
                      buttonText={formData.eInvoiceFileName ? "Replace eInvoice PDF" : "Upload eInvoice PDF"}
                      onFilesSelected={(files) => files[0] && handleFileUpload(files[0], "eInvoiceFile", "eInvoiceFileName")}
                      onRemove={() => setFormData(prev => ({ ...prev, eInvoiceFile: "", eInvoiceFileName: "" }))}
                    />
                  </div>
                </div>

                {/* eWay Bill Upload */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm transition-all hover:border-purple-300 flex flex-col">
                  <div className="flex items-center gap-2 mb-1">
                    <Receipt className="h-4 w-4 text-purple-500" />
                    <h3 className="text-sm font-black text-slate-800">eWay Bill Document</h3>
                  </div>
                  <p className="text-[11px] text-slate-500 mb-4 font-medium italic">Generate eWay Bill from GST Portal, then upload here.</p>
                  <div className="flex-1 flex flex-col justify-end">
                    <FileUploadField
                      accept=".pdf,image/*"
                      value={formData.eWayBillFile}
                      fileName={formData.eWayBillFileName}
                      uploading={isUploading["eWayBillFile"] || false}
                      variant="dropzone"
                      buttonText={formData.eWayBillFileName ? "Replace eWay Bill PDF" : "Upload eWay Bill PDF"}
                      onFilesSelected={(files) => files[0] && handleFileUpload(files[0], "eWayBillFile", "eWayBillFileName")}
                      onRemove={() => setFormData(prev => ({ ...prev, eWayBillFile: "", eWayBillFileName: "" }))}
                    />
                  </div>
                </div>
              </div>
              )}

              {/* Proforma Invoice link */}
              {selectedRow.invoice_copy && (
                <div className="flex items-center gap-2 text-xs font-bold text-blue-600 bg-blue-50 p-3 rounded-lg justify-center border border-blue-100">
                  <FileText className="h-4 w-4" />
                  <a href={selectedRow.invoice_copy} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                    View Original Proforma Invoice <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="mt-8 w-full border-t bg-slate-50/50 -mx-3 sm:-mx-6 -mb-3 sm:-mb-6 px-3 sm:px-6 py-4 sm:flex-col sm:justify-start">
            <StageActionFooter
              // Cancel stays inert while a submit is running (it used to be a disabled button).
              onCancel={() => setIsDialogOpen(false)}
              cancelDisabled={isProcessing}
              cancelLabel={viewOnly ? "Close" : "Cancel"}
              actions={[
                {
                  variant: "outline",
                  label: <><Printer className="h-4 w-4" /> Print</>,
                  onClick: () => selectedRow && handlePrint(selectedRow),
                },
                ...(!viewOnly ? [{
                  label: <>{isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}{isProcessing ? "Submitting..." : "Submit Documents"}</>,
                  onClick: handleSubmit,
                  disabled: isProcessing || !formData.eInvoiceFileName || !formData.eWayBillFileName,
                }] : []),
              ]}
            />
          </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
