"use client"

import { useState, useMemo } from "react"
import { WorkflowStageShell } from "@/components/workflow/workflow-stage-shell"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { FileUploadField } from "@/components/file-upload-field"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Printer, CheckCircle, FileText, Receipt, ExternalLink } from "lucide-react"
import { finalInvoiceApi, orderApi } from "@/lib/api-service"
import { useAuth } from "@/hooks/use-auth"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"

export default function FinalInvoicePage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { user } = useAuth()

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedRow, setSelectedRow] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isUploading, setIsUploading] = useState<Record<string, boolean>>({})
  const [formData, setFormData] = useState({
    eInvoiceFile: "",
    eInvoiceFileName: "",
    eWayBillFile: "",
    eWayBillFileName: "",
  })

  // Fetch pending
  const { data: pendingRes, isLoading: pendingLoading, refetch: refetchPending } = useQuery({
    queryKey: ["final-invoice-pending"],
    queryFn: () => finalInvoiceApi.getPending({ limit: 100 }),
    staleTime: 30 * 1000,
  })

  // Fetch history
  const { data: historyRes, isLoading: historyLoading } = useQuery({
    queryKey: ["final-invoice-history"],
    queryFn: () => finalInvoiceApi.getHistory({ limit: 100 }),
    staleTime: 30 * 1000,
  })

  const pendingRows: any[] = pendingRes?.data?.rows || []
  const historyRows: any[] = historyRes?.data?.rows || []
  const customerNames = Array.from(new Set(pendingRows.map((r: any) => r.customer_name || "Unknown")))

  const handleOpenDialog = (row: any) => {
    setSelectedRow(row)
    setFormData({ eInvoiceFile: "", eInvoiceFileName: "", eWayBillFile: "", eWayBillFileName: "" })
    setIsDialogOpen(true)
  }

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

  const renderRows = (rows: any[], isHistory = false) => rows.map((row, idx) => (
    <TableRow key={row.invoice_id || idx} className="hover:bg-slate-50 transition-colors">
      <TableCell className="font-semibold text-slate-800">{row.customer_name || "—"}</TableCell>
      <TableCell className="font-mono text-sm">{row.invoice_no || "—"}</TableCell>
      <TableCell>{row.vehicle_no || "—"}</TableCell>
      <TableCell className="font-semibold">₹{parseFloat(row.bill_amount || 0).toFixed(2)}</TableCell>
      <TableCell>
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
      <TableCell>
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
      </TableCell>
    </TableRow>
  ))

  return (
    <>
      <WorkflowStageShell
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
              <div className="rounded-xl border overflow-hidden shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Customer</TableHead>
                      <TableHead>Invoice No.</TableHead>
                      <TableHead>Vehicle No.</TableHead>
                      <TableHead>Bill Amount</TableHead>
                      <TableHead>Documents</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>{renderRows(historyRows, true)}</TableBody>
                </Table>
              </div>
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
            <div className="rounded-xl border overflow-hidden shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Customer</TableHead>
                    <TableHead>Invoice No.</TableHead>
                    <TableHead>Vehicle No.</TableHead>
                    <TableHead>Bill Amount</TableHead>
                    <TableHead>Documents</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>{renderRows(pendingRows)}</TableBody>
              </Table>
            </div>
          )}
        </div>
      </WorkflowStageShell>
      {/* Upload Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-4xl p-0 overflow-hidden bg-slate-50 border-0 shadow-2xl rounded-2xl">
          <DialogHeader className="px-6 py-5 bg-white border-b border-slate-100">
            <DialogTitle className="text-lg font-black flex items-center gap-3 text-slate-800">
              <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                <Receipt className="h-5 w-5" />
              </div>
              Upload Final Documents
            </DialogTitle>
          </DialogHeader>

          {selectedRow && (
            <div className="px-6 py-5 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Summary Block */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 font-bold text-xs text-slate-700">
                  Order Summary
                </div>
                <div className="grid grid-cols-2 p-4 gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Customer</p>
                    <p className="text-sm font-bold text-slate-800">{selectedRow.customer_name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Invoice No</p>
                    <p className="text-sm font-black text-blue-700 font-mono bg-blue-50 px-2 py-0.5 rounded-md inline-block">
                      {selectedRow.invoice_no}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Vehicle</p>
                    <p className="text-sm font-bold text-slate-800">{selectedRow.vehicle_no}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Amount</p>
                    <p className="text-sm font-black text-slate-900">₹{parseFloat(selectedRow.bill_amount || 0).toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Uploads */}
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

          <DialogFooter className="px-6 py-4 bg-white border-t border-slate-100 flex flex-row sm:justify-end gap-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isProcessing} className="font-bold">
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => selectedRow && handlePrint(selectedRow)}
              className="gap-2 font-bold"
            >
              <Printer className="h-4 w-4" /> Print
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isProcessing || !formData.eInvoiceFileName || !formData.eWayBillFileName}
              className="bg-blue-600 hover:bg-blue-700 gap-2 font-bold shadow-md shadow-blue-500/20"
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              {isProcessing ? "Submitting..." : "Submit Documents"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
