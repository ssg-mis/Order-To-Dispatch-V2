"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Download, Landmark, Loader2 } from "lucide-react"
import { reportsApi } from "@/lib/api-service"
import { useToast } from "@/hooks/use-toast"

type LossRow = {
  booked_at: string
  head: string
  amount: string
  order_no: string
  order_category: string | null
  customer_name: string | null
  depot_name: string | null
  product_name: string | null
  invoice_no: string | null
  credit_note_no: string | null
  debit_note_no: string | null
  reverse_transfer_no: string | null
}
type LossReport = { count: number; total: number; head: string; months: { month: string; count: number; amount: number }[]; rows: LossRow[] }

const inr = (n: number) => `₹${(Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
const monthLabel = (m: string) => {
  const [y, mo] = m.split("-")
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" })
}
const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`

/**
 * Transit Damage Loss (P&L): the company's own share of transit losses, booked at
 * Damage Adjustment under a separate head so it can be reported apart from other expenses.
 */
export function TransitLossModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { toast } = useToast()
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<LossReport | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await reportsApi.getTransitLoss({ ...(from && { from_date: from }), ...(to && { to_date: to }) })
      if (!res.success || !res.data) throw new Error(res.message || "Failed to fetch report")
      setReport(res.data as LossReport)
    } catch (e: any) {
      toast({ title: "Could not load report", description: e?.message || "An error occurred.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const downloadCsv = () => {
    if (!report || report.rows.length === 0) return
    const header = ["Booked On", "P&L Head", "Order No", "Type", "Customer", "Depot", "Product", "Invoice No", "Credit Note", "Debit Note", "Reverse Transfer", "Company Loss (Rs)"]
    const lines = report.rows.map(r => [
      fmtDate(r.booked_at), r.head, r.order_no, r.order_category, r.customer_name, r.depot_name, r.product_name,
      r.invoice_no, r.credit_note_no, r.debit_note_no, r.reverse_transfer_no, Number(r.amount).toFixed(2),
    ].map(csvCell).join(","))
    lines.push(["", "", "", "", "", "", "", "", "", "", "Total", report.total.toFixed(2)].map(csvCell).join(","))
    const blob = new Blob(["﻿" + [header.map(csvCell).join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `Transit Damage Loss ${from || "start"} to ${to || "today"}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-0.75rem)] max-w-[calc(100vw-0.75rem)] sm:!max-w-4xl max-h-[92vh] overflow-y-auto p-0">
        <div className="p-4 sm:p-6 space-y-5">
          <DialogHeader className="pr-8">
            <DialogTitle className="flex items-center gap-3 text-xl sm:text-2xl font-bold text-slate-900 border-b pb-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><Landmark className="h-5 w-5" /></span>
              Transit Damage Loss (P&amp;L)
            </DialogTitle>
            <DialogDescription>
              The company's own share of transit damage and shortage, booked at Damage Adjustment under a separate P&amp;L head.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-2">
              <Label>From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full sm:w-44" />
            </div>
            <div className="space-y-2">
              <Label>To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full sm:w-44" />
            </div>
            <Button onClick={load} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Show report
            </Button>
            {report && report.rows.length > 0 && (
              <Button variant="outline" onClick={downloadCsv} className="sm:ml-auto">
                <Download className="mr-2 h-4 w-4" /> Download CSV
              </Button>
            )}
          </div>

          {report && (
            report.rows.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-600">
                No company loss booked in this period.
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border bg-white p-4 shadow-sm">
                    <p className="text-xs font-medium text-slate-500">Total company loss</p>
                    <p className="text-xl font-semibold text-slate-900">{inr(report.total)}</p>
                  </div>
                  <div className="rounded-lg border bg-white p-4 shadow-sm">
                    <p className="text-xs font-medium text-slate-500">Shipments</p>
                    <p className="text-xl font-semibold text-slate-900">{report.count}</p>
                  </div>
                  <div className="rounded-lg border bg-white p-4 shadow-sm">
                    <p className="text-xs font-medium text-slate-500">P&amp;L head</p>
                    <p className="text-sm font-semibold text-slate-900">{report.head}</p>
                  </div>
                </div>

                {report.months.length > 1 && (
                  <div className="overflow-hidden rounded-lg border">
                    <Table>
                      <TableHeader className="bg-slate-50"><TableRow>
                        <TableHead>Month</TableHead><TableHead className="text-center">Shipments</TableHead><TableHead className="text-right">Loss</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {report.months.map(m => (
                          <TableRow key={m.month}>
                            <TableCell className="text-sm">{monthLabel(m.month)}</TableCell>
                            <TableCell className="text-center text-sm">{m.count}</TableCell>
                            <TableCell className="text-right text-sm font-medium">{inr(m.amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <div className="max-h-[360px] overflow-auto rounded-lg border">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-slate-50"><TableRow>
                      <TableHead className="whitespace-nowrap">Booked on</TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Depot</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="whitespace-nowrap">Documents</TableHead>
                      <TableHead className="text-right">Loss</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {report.rows.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="whitespace-nowrap text-sm">{fmtDate(r.booked_at)}</TableCell>
                          <TableCell className="text-sm">
                            <p className="font-medium text-slate-900">{r.order_no}</p>
                            <p className="text-xs text-slate-500">{r.order_category}{r.invoice_no ? ` · Inv ${r.invoice_no}` : ""}</p>
                          </TableCell>
                          <TableCell className="text-sm">{r.customer_name || "—"}</TableCell>
                          <TableCell className="text-sm">{r.depot_name || "—"}</TableCell>
                          <TableCell className="text-sm">{r.product_name || "—"}</TableCell>
                          <TableCell className="text-xs text-slate-600">
                            {[r.credit_note_no && `CN ${r.credit_note_no}`, r.debit_note_no && `DN ${r.debit_note_no}`, r.reverse_transfer_no && `RST ${r.reverse_transfer_no}`].filter(Boolean).join(" · ") || "—"}
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium">{inr(Number(r.amount))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter className="bg-slate-50">
                      <TableRow>
                        <TableCell colSpan={6} className="text-sm font-semibold text-slate-900">Total</TableCell>
                        <TableCell className="text-right text-sm font-semibold text-slate-900">{inr(report.total)}</TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              </div>
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
