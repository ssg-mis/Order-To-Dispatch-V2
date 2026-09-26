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
import { finalInvoiceApi } from "@/lib/api-service"
import { useAuth } from "@/hooks/use-auth"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { uploadApi } from "@/lib/api-service"
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
      const formDataUpload = new FormData()
      formDataUpload.append("file", file)
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001/api/v1"}/upload`, {
        method: "POST",
        body: formDataUpload,
        credentials: "include",
      })
      const result = await response.json()
      if (result.success && result.data?.url) {
        setFormData(prev => ({ ...prev, [fileKey]: result.data.url, [nameKey]: file.name }))
        toast({ title: "Upload Successful", description: `${file.name} uploaded.` })
      } else {
        throw new Error(result.message || "Upload failed")
      }
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err.message, variant: "destructive" })
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Receipt className="h-5 w-5 text-blue-600" />
              Upload Final Documents
            </DialogTitle>
          </DialogHeader>

          {selectedRow && (
            <div className="space-y-4 py-2">
              {/* Summary */}
              <div className="bg-blue-50 rounded-lg p-3 grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-slate-500">Customer:</span> <span className="font-semibold">{selectedRow.customer_name}</span></div>
                <div><span className="text-slate-500">Invoice No:</span> <span className="font-semibold font-mono">{selectedRow.invoice_no}</span></div>
                <div><span className="text-slate-500">Vehicle:</span> <span className="font-semibold">{selectedRow.vehicle_no}</span></div>
                <div><span className="text-slate-500">Amount:</span> <span className="font-semibold">₹{parseFloat(selectedRow.bill_amount || 0).toFixed(2)}</span></div>
              </div>

              {/* eInvoice Upload */}
              <div className="space-y-2 border rounded-lg p-4 bg-white">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  eInvoice (from Tally / GST Portal)
                </h3>
                <p className="text-xs text-slate-500 mb-2">Generate from Tally or GST Portal first, then upload the PDF here.</p>
                <FileUploadField
                  label={<Label>Upload eInvoice PDF</Label>}
                  accept=".pdf,image/*"
                  fileName={formData.eInvoiceFileName}
                  uploading={isUploading["eInvoiceFile"] || false}
                  buttonText={formData.eInvoiceFileName ? "REPLACE" : "UPLOAD"}
                  onFilesSelected={(files) => files[0] && handleFileUpload(files[0], "eInvoiceFile", "eInvoiceFileName")}
                  capture="environment"
                />
              </div>

              {/* eWay Bill Upload */}
              <div className="space-y-2 border rounded-lg p-4 bg-white">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-purple-600" />
                  eWay Bill (from GST Portal)
                </h3>
                <p className="text-xs text-slate-500 mb-2">Generate eWay Bill from GST Portal, then upload here.</p>
                <FileUploadField
                  label={<Label>Upload eWay Bill PDF</Label>}
                  accept=".pdf,image/*"
                  fileName={formData.eWayBillFileName}
                  uploading={isUploading["eWayBillFile"] || false}
                  buttonText={formData.eWayBillFileName ? "REPLACE" : "UPLOAD"}
                  onFilesSelected={(files) => files[0] && handleFileUpload(files[0], "eWayBillFile", "eWayBillFileName")}
                  capture="environment"
                />
              </div>

              {/* Proforma Invoice link */}
              {selectedRow.invoice_copy && (
                <div className="flex items-center gap-2 text-sm text-blue-600">
                  <FileText className="h-4 w-4" />
                  <a href={selectedRow.invoice_copy} target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-800">
                    View Proforma Invoice Copy
                  </a>
                  <ExternalLink className="h-3 w-3" />
                </div>
              )}
            </div>
          )}

          <DialogFooter className="mt-4 border-t pt-4 gap-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => selectedRow && handlePrint(selectedRow)}
              className="gap-2"
            >
              <Printer className="h-4 w-4" /> Print
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isProcessing}
              className="bg-blue-600 hover:bg-blue-700 gap-2"
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              {isProcessing ? "Submitting..." : "Submit Final Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
