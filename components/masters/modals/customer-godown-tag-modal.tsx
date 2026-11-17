"use client"

import React, { useRef, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Download, FileSpreadsheet, Loader2, Upload, CheckCircle2, AlertCircle } from "lucide-react"
import * as XLSX from "xlsx"
import { customerApi } from "@/lib/api-service"

interface CustomerGodownTagModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

interface TagRow {
  customer_code: string
  customer_name: string
  gstin: string
  godown: string
}

const csvEscape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`

// Splits one CSV line honouring double-quoted fields ("" = escaped quote).
function parseCSVLine(line: string): string[] {
  const out: string[] = []
  let cur = ""
  let q = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (q) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else q = false
      } else cur += ch
    } else if (ch === '"') q = true
    else if (ch === ",") {
      out.push(cur.trim())
      cur = ""
    } else cur += ch
  }
  out.push(cur.trim())
  return out
}

function mapRows(headers: string[], data: string[][]): TagRow[] {
  const h = headers.map((x) => String(x ?? "").trim().toLowerCase())
  const idx = (...names: string[]) => h.findIndex((x) => names.some((n) => x === n || x.includes(n)))
  const iCode = idx("customer code", "customer_code", "code")
  const iName = idx("customer name", "customer_name", "name")
  const iGst = idx("gstin")
  const iGodown = idx("godown", "depot")
  const get = (row: string[], i: number) => (i >= 0 ? String(row[i] ?? "").trim() : "")
  return data
    .map((r) => ({
      customer_code: get(r, iCode),
      customer_name: get(r, iName),
      gstin: get(r, iGst).toUpperCase(),
      godown: get(r, iGodown),
    }))
    .filter((r) => r.customer_code || r.customer_name || r.gstin)
}

export function CustomerGodownTagModal({ open, onOpenChange, onSuccess }: CustomerGodownTagModalProps) {
  const [rows, setRows] = useState<TagRow[]>([])
  const [fileName, setFileName] = useState("")
  const [mode, setMode] = useState<"add" | "replace">("add")
  const [isExporting, setIsExporting] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState("")
  const [sheetStats, setSheetStats] = useState<{ tagged: number; total: number } | null>(null)
  const [preview, setPreview] = useState<any>(null)
  const [isChecking, setIsChecking] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setRows([])
    setFileName("")
    setResult(null)
    setError("")
    setMode("add")
    setPreview(null)
    setSheetStats(null)
  }
  const close = () => {
    reset()
    onOpenChange(false)
  }

  // Sheet of every customer with its CURRENT godown prefilled - edit the Godown column and upload it back.
  const handleDownloadSheet = async () => {
    setIsExporting(true)
    setError("")
    try {
      const res = await customerApi.getGodownTagSheet()
      if (!res?.success) throw new Error(res?.message || "Could not load customers")
      const list: any[] = res.data?.customers || []
      setSheetStats({ tagged: res.data?.taggedCount ?? 0, total: res.data?.totalCount ?? list.length })
      const header = ["Customer Code", "Customer Name", "GSTIN", "State", "Godown"]
      const lines = list.map((c) => [c.customer_code, c.customer_name, c.gstin, c.state, c.godown].map(csvEscape).join(","))
      const csv = "data:text/csv;charset=utf-8," + encodeURIComponent(`${header.map(csvEscape).join(",")}\n${lines.join("\n")}\n`)
      const a = document.createElement("a")
      a.href = csv
      a.download = "Customer_Godown_Tagging_Sheet.csv"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (e: any) {
      setError(e?.message || "Could not download the customer sheet")
    } finally {
      setIsExporting(false)
    }
  }

  // Server-side dry run: matches customers and checks depot names WITHOUT writing anything.
  const runCheck = async (list: TagRow[]) => {
    const withG = list.filter((r) => r.godown)
    setPreview(null)
    if (withG.length === 0) return
    setIsChecking(true)
    try {
      const res = await customerApi.bulkTagGodowns(withG, "add", true)
      if (res?.success) setPreview(res.data)
      else setError(res?.message || "Could not check the file")
    } catch (e: any) {
      setError(e?.message || "Could not check the file")
    } finally {
      setIsChecking(false)
    }
  }

  const handleFile = (file: File) => {
    setFileName(file.name)
    setResult(null)
    setError("")
    const isExcel = /\.(xlsx|xls)$/i.test(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        let headers: string[] = []
        let data: string[][] = []
        if (isExcel) {
          const wb = XLSX.read(e.target?.result as ArrayBuffer, { type: "array" })
          const sheet = wb.Sheets[wb.SheetNames[0]]
          const all = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" })
          headers = (all[0] || []).map((x) => String(x ?? ""))
          data = all.slice(1).map((r) => (r || []).map((c) => String(c ?? "")))
        } else {
          const lines = String(e.target?.result || "").split(/\r\n|\n/).filter((l) => l.trim())
          headers = parseCSVLine(lines[0] || "")
          data = lines.slice(1).map(parseCSVLine)
        }
        const parsed = mapRows(headers, data)
        setRows(parsed)
        runCheck(parsed)
      } catch {
        setError("Could not read this file. Use the downloaded sheet (CSV or Excel).")
        setRows([])
      }
    }
    if (isExcel) reader.readAsArrayBuffer(file)
    else reader.readAsText(file)
  }

  const withGodown = rows.filter((r) => r.godown)
  const withoutGodown = rows.length - withGodown.length

  const handleApply = async () => {
    if (withGodown.length === 0) return
    setIsSubmitting(true)
    setError("")
    try {
      const res = await customerApi.bulkTagGodowns(withGodown, mode)
      if (res?.success) {
        setResult(res.data)
        onSuccess()
      } else {
        setError(res?.message || "Tagging failed")
      }
    } catch (e: any) {
      setError(e?.message || "Tagging failed")
    } finally {
      setIsSubmitting(false)
    }
  }

  const failed: any[] = (result?.results || []).filter((r: any) => r.status === "failed")

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="flex max-h-[88vh] w-full max-w-2xl flex-col gap-0 overflow-hidden rounded-xl border border-slate-200 p-0 shadow-2xl">
        <DialogHeader className="border-b border-slate-200 bg-white px-6 py-4 text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold tracking-tight text-slate-900">Tag customers to godown</DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Set the godown (depot) of many existing customers at once. Order Punch then shows a depot only its own customers.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 px-6 py-5">
          {!result && (
            <>
              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step 1</p>
                <p className="mt-1 text-sm text-slate-700">
                  Download the sheet with every customer, then fill the <b>Godown</b> column (current godowns are already filled in; e.g. <code className="rounded bg-slate-100 px-1">Banari</code>,
                  or several: <code className="rounded bg-slate-100 px-1">Banari, Raigarh</code>). Leave it empty to skip a customer.
                </p>
                <Button variant="outline" size="sm" className="mt-3 h-8 gap-2 bg-white" onClick={handleDownloadSheet} disabled={isExporting}>
                  {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Download customer sheet
                </Button>
                {sheetStats && (
                  <span className="ml-3 text-xs text-slate-500">
                    <b className="text-slate-800">{sheetStats.tagged}</b> of {sheetStats.total} customers already have a godown
                  </span>
                )}
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step 2</p>
                <p className="mt-1 text-sm text-slate-700">Upload the filled sheet (CSV or Excel). Customers are matched by Customer Code, then GSTIN, then exact name.</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                <Button variant="outline" size="sm" className="mt-3 h-8 gap-2 bg-white" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-4 w-4" />
                  {fileName ? "Choose another file" : "Choose file"}
                </Button>
                {fileName && <span className="ml-3 text-xs text-slate-500">{fileName}</span>}

                {rows.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-md border border-slate-200 bg-slate-50 py-2">
                      <div className="text-lg font-bold text-slate-900">{rows.length}</div>
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Rows read</div>
                    </div>
                    <div className="rounded-md border border-emerald-200 bg-emerald-50 py-2">
                      <div className="text-lg font-bold text-emerald-700">{withGodown.length}</div>
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Will be tagged</div>
                    </div>
                    <div className="rounded-md border border-slate-200 bg-slate-50 py-2">
                      <div className="text-lg font-bold text-slate-500">{withoutGodown}</div>
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">No godown (skipped)</div>
                    </div>
                  </div>
                )}

                {isChecking && (
                  <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking customers and godown names...
                  </p>
                )}
                {preview && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-slate-600">
                      <b className="text-emerald-700">{preview.taggedCount}</b> matched and ready
                      {preview.failedCount ? <>, <b className="text-red-600">{preview.failedCount}</b> have a problem (fix them or they will be skipped)</> : null}.
                    </p>
                    {(preview.results || []).filter((r: any) => r.status === "failed").length > 0 && (
                      <ul className="max-h-40 divide-y divide-slate-100 overflow-y-auto rounded-md border border-red-100 bg-red-50/40 text-xs">
                        {(preview.results || []).filter((r: any) => r.status === "failed").map((f: any) => (
                          <li key={f.index} className="flex items-start justify-between gap-3 px-3 py-1.5">
                            <span className="font-medium text-slate-800">{f.customer_name}</span>
                            <span className="text-right text-red-600">{f.error}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step 3</p>
                <div className="mt-2 space-y-2 text-sm text-slate-700">
                  <label className="flex cursor-pointer items-start gap-2">
                    <input type="radio" name="tag-mode" checked={mode === "add"} onChange={() => setMode("add")} className="mt-1 accent-blue-600" />
                    <span>
                      <b>Add</b> to the customer&apos;s existing godowns <span className="text-xs text-slate-500">(safe, nothing is removed)</span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-2">
                    <input type="radio" name="tag-mode" checked={mode === "replace"} onChange={() => setMode("replace")} className="mt-1 accent-blue-600" />
                    <span>
                      <b>Replace</b> the customer&apos;s godowns with the ones in the sheet
                    </span>
                  </label>
                </div>
              </section>
            </>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {result && (
            <section className="space-y-3">
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>
                  <b>{result.taggedCount}</b> customer{result.taggedCount === 1 ? "" : "s"} tagged
                  {result.skippedCount ? `, ${result.skippedCount} skipped` : ""}
                  {result.failedCount ? `, ${result.failedCount} failed` : ""}.
                </span>
              </div>
              {failed.length > 0 && (
                <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                  <p className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Not tagged ({failed.length})
                  </p>
                  <ul className="divide-y divide-slate-100 text-xs">
                    {failed.map((f: any) => (
                      <li key={f.index} className="flex items-start justify-between gap-3 px-3 py-2">
                        <span className="font-medium text-slate-800">
                          Row {f.index} · {f.customer_name}
                        </span>
                        <span className="text-right text-red-600">{f.error}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-6 py-3">
          <Button variant="outline" size="sm" className="h-8" onClick={close}>
            {result ? "Close" : "Cancel"}
          </Button>
          {!result && (
            <Button size="sm" className="h-8 bg-blue-600 hover:bg-blue-700" onClick={handleApply} disabled={withGodown.length === 0 || isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Tag {withGodown.length || ""} customer{withGodown.length === 1 ? "" : "s"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
