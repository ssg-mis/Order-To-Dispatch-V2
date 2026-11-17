"use client"

import React, { useRef, useState } from "react"
import * as XLSX from "xlsx"
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ledgerApi } from "@/lib/api-service"
import { cn } from "@/lib/utils"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** lower-cased names of every existing (and pending) ledger */
  existingNames: string[]
  groupNames: { name: string; active: boolean }[]
  onSuccess: () => void
}

interface Row {
  index: number
  ledger_name: string
  ledger_group: string
  status: string
}

const csvEscape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`

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

function toRows(headers: string[], data: string[][]): Row[] {
  const h = headers.map((x) => String(x ?? "").trim().toLowerCase())
  const find = (...names: string[]) => h.findIndex((x) => names.some((n) => x.includes(n)))
  const iName = find("ledger name", "name")
  const iGroup = find("ledger group", "group")
  const iStatus = find("status")
  const get = (r: string[], i: number) => (i >= 0 ? String(r[i] ?? "").trim() : "")
  return data
    .map((r, i) => ({ index: i + 2, ledger_name: get(r, iName), ledger_group: get(r, iGroup), status: get(r, iStatus) }))
    .filter((r) => r.ledger_name || r.ledger_group)
}

export function LedgerBulkImportModal({ open, onOpenChange, existingNames, groupNames, onSuccess }: Props) {
  const [rows, setRows] = useState<Row[]>([])
  const [fileName, setFileName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setRows([])
    setFileName("")
    setResult(null)
    setError("")
  }
  const close = () => {
    reset()
    onOpenChange(false)
  }

  const template = () => {
    const csv =
      "data:text/csv;charset=utf-8," +
      encodeURIComponent(`"Ledger Name","Ledger Group","Status"\n"Transporting Expenses","Primary","Active"\n"Loading Charges","Primary","Active"\n`)
    const a = document.createElement("a")
    a.href = csv
    a.download = "Ledger_Bulk_Import_Template.csv"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
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
          const all = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: "" })
          headers = (all[0] || []).map((x) => String(x ?? ""))
          data = all.slice(1).map((r) => (r || []).map((c) => String(c ?? "")))
        } else {
          const lines = String(e.target?.result || "").split(/\r\n|\n/).filter((l) => l.trim())
          headers = parseCSVLine(lines[0] || "")
          data = lines.slice(1).map(parseCSVLine)
        }
        setRows(toRows(headers, data))
      } catch {
        setError("Could not read this file. Use the downloaded template (CSV or Excel).")
        setRows([])
      }
    }
    if (isExcel) reader.readAsArrayBuffer(file)
    else reader.readAsText(file)
  }

  // Row problems found before anything is sent (the server checks again and is the final word).
  const seen = new Set<string>()
  const checked = rows.map((r) => {
    const errors: string[] = []
    const key = r.ledger_name.trim().toLowerCase()
    if (!key) errors.push("Ledger Name is required")
    else if (existingNames.includes(key)) errors.push("A ledger with this name already exists")
    else if (seen.has(key)) errors.push("Duplicate name inside the file")
    if (key) seen.add(key)
    const g = groupNames.find((x) => x.name.trim().toLowerCase() === r.ledger_group.trim().toLowerCase())
    if (!r.ledger_group.trim()) errors.push("Ledger Group is required")
    else if (!g) errors.push(`Ledger Group "${r.ledger_group}" was not found`)
    else if (!g.active) errors.push(`Ledger Group "${g.name}" is not Active`)
    if (r.status && !["active", "inactive"].includes(r.status.trim().toLowerCase())) errors.push("Status must be Active or Inactive")
    return { row: r, errors }
  })
  const valid = checked.filter((c) => c.errors.length === 0)
  const invalid = checked.length - valid.length

  const doImport = async () => {
    if (valid.length === 0) return
    setIsSubmitting(true)
    setError("")
    try {
      const res = await ledgerApi.bulkImport(valid.map((c) => ({ ledger_name: c.row.ledger_name, ledger_group: c.row.ledger_group, status: c.row.status || "Active" })))
      if (res?.success) {
        setResult(res.data)
        onSuccess()
      } else {
        setError(res?.message || "Import failed")
      }
    } catch (e: any) {
      setError(e?.message || "Import failed")
    } finally {
      setIsSubmitting(false)
    }
  }

  const failed: any[] = (result?.results || []).filter((r: any) => r.status === "failed")

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="flex max-h-[88vh] w-full max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b bg-white px-6 py-4 text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Bulk Import Ledgers</DialogTitle>
              <DialogDescription className="text-xs">Upload a CSV / Excel with Ledger Name, Ledger Group and Status.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 px-6 py-5">
          {!result && (
            <section className="rounded-lg border bg-white p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" size="sm" className="h-8 gap-2 bg-white" onClick={template}>
                  <Download className="h-4 w-4" />
                  Download template
                </Button>
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
                <Button variant="outline" size="sm" className="h-8 gap-2 bg-white" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-4 w-4" />
                  {fileName ? "Choose another file" : "Choose file"}
                </Button>
                {fileName && <span className="text-xs text-slate-500">{fileName}</span>}
              </div>
              <p className="mt-2 text-[11px] text-slate-500">Ledger Group must match an existing Ledger Group name. Status defaults to Active.</p>
            </section>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {!result && rows.length > 0 && (
            <section className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md border bg-white py-2">
                  <div className="text-lg font-bold text-slate-900">{rows.length}</div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Rows read</div>
                </div>
                <div className="rounded-md border border-emerald-200 bg-emerald-50 py-2">
                  <div className="text-lg font-bold text-emerald-700">{valid.length}</div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Ready to import</div>
                </div>
                <div className={cn("rounded-md border py-2", invalid ? "border-red-200 bg-red-50" : "bg-white")}>
                  <div className={cn("text-lg font-bold", invalid ? "text-red-600" : "text-slate-400")}>{invalid}</div>
                  <div className={cn("text-[10px] font-semibold uppercase tracking-wide", invalid ? "text-red-600" : "text-slate-500")}>Have a problem</div>
                </div>
              </div>

              <div className="max-h-72 overflow-y-auto rounded-lg border bg-white">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-3 py-2 text-left">Row</th>
                      <th className="px-3 py-2 text-left">Ledger Name</th>
                      <th className="px-3 py-2 text-left">Group</th>
                      <th className="px-3 py-2 text-left">Check</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checked.map(({ row, errors }) => (
                      <tr key={row.index} className={cn("border-t", errors.length && "bg-red-50/50")}>
                        <td className="px-3 py-1.5 text-slate-500">{row.index}</td>
                        <td className="px-3 py-1.5 font-medium">{row.ledger_name || "—"}</td>
                        <td className="px-3 py-1.5 text-slate-600">{row.ledger_group || "—"}</td>
                        <td className="px-3 py-1.5 text-xs">
                          {errors.length ? <span className="text-red-600">{errors.join("; ")}</span> : <span className="text-emerald-700">OK</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {invalid > 0 && <p className="text-xs text-slate-500">Rows with a problem are skipped; the rest are imported.</p>}
            </section>
          )}

          {result && (
            <section className="space-y-3">
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>
                  <b>{result.importedCount}</b> ledger{result.importedCount === 1 ? "" : "s"} imported{result.failedCount ? `, ${result.failedCount} failed` : ""}.
                </span>
              </div>
              {failed.length > 0 && (
                <ul className="max-h-56 divide-y overflow-y-auto rounded-lg border bg-white text-xs">
                  {failed.map((f: any) => (
                    <li key={f.index} className="flex items-start justify-between gap-3 px-3 py-2">
                      <span className="font-medium">
                        Row {f.index} · {f.ledger_name}
                      </span>
                      <span className="text-right text-red-600">{f.error}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t bg-white px-6 py-3">
          <Button variant="outline" size="sm" className="h-8" onClick={close}>
            {result ? "Close" : "Cancel"}
          </Button>
          {!result && (
            <Button size="sm" className="h-8 bg-blue-600 hover:bg-blue-700" disabled={valid.length === 0 || isSubmitting} onClick={doImport}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Import {valid.length || ""} ledger{valid.length === 1 ? "" : "s"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
