"use client"

import { useMemo, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Download, Landmark, Loader2 } from "lucide-react"
import { reportsApi } from "@/lib/api-service"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { fmtDate, fmtNum, fmtAmount } from "@/lib/table-format"

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

const SEARCH_CLS = "h-7 text-[10px] w-full px-2.5 py-0 bg-slate-50 hover:bg-slate-100 focus:bg-white border-slate-200/70 focus:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-100/50 shadow-2xs rounded-md transition-all placeholder:text-slate-400/80 font-medium text-slate-700"
const docsOf = (r: LossRow) =>
  [r.credit_note_no && `CN ${r.credit_note_no}`, r.debit_note_no && `DN ${r.debit_note_no}`, r.reverse_transfer_no && `RST ${r.reverse_transfer_no}`].filter(Boolean).join(" · ")
const LOSS_COLS: { id: string; label: string; right?: boolean; text: (r: LossRow) => string }[] = [
  { id: "date", label: "Booked on", right: true, text: (r) => fmtDate(r.booked_at) },
  { id: "order", label: "Order", text: (r) => `${r.order_no || ""} ${r.order_category || ""} ${r.invoice_no || ""}` },
  { id: "customer", label: "Customer", text: (r) => r.customer_name || "" },
  { id: "depot", label: "Depot", text: (r) => r.depot_name || "" },
  { id: "product", label: "Product", text: (r) => r.product_name || "" },
  { id: "docs", label: "Documents", text: (r) => docsOf(r) },
  { id: "loss", label: "Loss (₹)", right: true, text: (r) => fmtAmount(r.amount, 2) },
]
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
  const [filters, setFilters] = useState<Record<string, string>>({})
  const shownRows = useMemo(
    () => (report?.rows || []).filter((r) => LOSS_COLS.every((c) => {
      const q = (filters[c.id] || "").trim().toLowerCase()
      return !q || c.text(r).toLowerCase().includes(q)
    })),
    [report, filters]
  )
  const shownTotal = shownRows.reduce((t, r) => t + (Number(r.amount) || 0), 0)

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
                    <p className="text-xs font-medium text-slate-500">Total company loss (₹)</p>
                    <p className="text-xl font-semibold text-slate-900">{fmtAmount(report.total, 2)}</p>
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
                      <TableHeader className="bg-slate-50 border-b">
                        <TableRow className="bg-slate-100/90 border-b-2 border-slate-300 font-bold text-xs text-slate-800 hover:bg-slate-100/90 shadow-sm">
                          <TableCell className="px-4 text-left font-black text-slate-900 uppercase tracking-wider text-[11px]">Total ({report.months.length})</TableCell>
                          <TableCell className="px-4 text-right font-mono tabular-nums font-black text-slate-900">{report.months.reduce((t, m) => t + (Number(m.count) || 0), 0)}</TableCell>
                          <TableCell className="px-4 text-right font-mono tabular-nums font-black text-slate-900">{fmtAmount(report.months.reduce((t, m) => t + (Number(m.amount) || 0), 0), 2)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableHead className="px-4 text-left whitespace-nowrap">Month</TableHead>
                          <TableHead className="px-4 text-right whitespace-nowrap min-w-[110px]">Shipments</TableHead>
                          <TableHead className="px-4 text-right whitespace-nowrap min-w-[120px]">Loss (₹)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.months.map(m => (
                          <TableRow key={m.month}>
                            <TableCell className="px-4 text-left text-sm">{monthLabel(m.month)}</TableCell>
                            <TableCell className="px-4 text-right text-sm font-mono tabular-nums">{fmtNum(m.count, 0)}</TableCell>
                            <TableCell className="px-4 text-right text-sm font-mono tabular-nums font-medium">{fmtAmount(m.amount, 2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <div className="max-h-[360px] overflow-auto rounded-lg border">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-slate-50 border-b">
                      <TableRow>
                        {LOSS_COLS.map((c) => (
                          <TableHead key={`search-${c.id}`} className="whitespace-nowrap align-top pt-2.5 pb-1 px-4">
                            <Input
                              placeholder="Search..."
                              value={filters[c.id] || ""}
                              onChange={(e) => setFilters((prev) => ({ ...prev, [c.id]: e.target.value }))}
                              className={cn(SEARCH_CLS, c.right ? "text-right" : "text-left")}
                            />
                          </TableHead>
                        ))}
                      </TableRow>
                      {shownRows.length > 0 && (
                        <TableRow className="bg-slate-100/90 border-b-2 border-slate-300 font-bold text-xs text-slate-800 hover:bg-slate-100/90 shadow-sm">
                          {LOSS_COLS.map((c, i) => (
                            <TableCell key={`total-${c.id}`} className={cn("px-4", c.right ? "text-right" : "text-left", i === 0 && "font-black text-slate-900 uppercase tracking-wider text-[11px]", c.id === "loss" && "font-mono tabular-nums font-black text-slate-900")}>
                              {i === 0 ? `Total (${shownRows.length})` : c.id === "loss" ? fmtAmount(shownTotal, 2) : ""}
                            </TableCell>
                          ))}
                        </TableRow>
                      )}
                      <TableRow>
                        {LOSS_COLS.map((c) => (
                          <TableHead key={c.id} className={cn("whitespace-nowrap align-top py-2.5 px-4", c.right ? "text-right min-w-[120px]" : "text-left")}>{c.label}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shownRows.length === 0 ? (
                        <TableRow><TableCell colSpan={LOSS_COLS.length} className="text-center py-8 text-slate-500">No matching records found for the filters.</TableCell></TableRow>
                      ) : shownRows.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="px-4 text-right whitespace-nowrap text-sm">{fmtDate(r.booked_at)}</TableCell>
                          <TableCell className="px-4 text-left text-sm">
                            <p className="font-medium text-slate-900">{r.order_no}</p>
                            <p className="text-xs text-slate-500">{r.order_category}{r.invoice_no ? ` · Inv ${r.invoice_no}` : ""}</p>
                          </TableCell>
                          <TableCell className="px-4 text-left text-sm">{r.customer_name || "—"}</TableCell>
                          <TableCell className="px-4 text-left text-sm">{r.depot_name || "—"}</TableCell>
                          <TableCell className="px-4 text-left text-sm">{r.product_name || "—"}</TableCell>
                          <TableCell className="px-4 text-left text-xs text-slate-600">{docsOf(r) || "—"}</TableCell>
                          <TableCell className="px-4 text-right text-sm font-mono tabular-nums font-medium">{fmtAmount(r.amount, 2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
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
