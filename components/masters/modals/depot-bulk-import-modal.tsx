"use client"

import React, { useState, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  Download,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  X,
  Loader2,
  Check,
  Building2,
} from "lucide-react"
import * as XLSX from "xlsx"
import { depotApi } from "@/lib/api-service"

interface DepotBulkImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

type Step = 1 | 2 | 3 | 4

interface ParsedRow {
  index: number
  depot_name: string
  state: string
  depot_address: string
  status: string
}

interface ValidationResult {
  row: ParsedRow
  isValid: boolean
  errors: string[]
}

export function DepotBulkImportModal({
  open,
  onOpenChange,
  onSuccess,
}: DepotBulkImportModalProps) {
  const [step, setStep] = useState<Step>(1)
  const [file, setFile] = useState<File | null>(null)
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [importResponse, setImportResponse] = useState<any>(null)
  const [isDragging, setIsDragging] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleReset = () => {
    setStep(1)
    setFile(null)
    setParsedRows([])
    setValidationResults([])
    setIsSubmitting(false)
    setImportResponse(null)
  }

  const handleClose = () => {
    handleReset()
    onOpenChange(false)
  }

  // Download CSV Template for Depots
  const handleDownloadTemplate = () => {
    const headers = "Depot Name,State,Depot Address,Status"
    const sampleRow = "Raipur Central Depot,Chhattisgarh,Plot 12 Industrial Area Bhanpuri,Active"

    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(`${headers}\n${sampleRow}\n`)
    const link = document.createElement("a")
    link.setAttribute("href", csvContent)
    link.setAttribute("download", `Depot_Bulk_Import_Template.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Map header row + data rows to ParsedRow[]
  const mapRowsToParsedRows = (headers: string[], dataRows: string[][]): ParsedRow[] => {
    const normalizedHeaders = headers.map((h) => (h || "").trim().replace(/^["']|["']$/g, "").toLowerCase())

    const getVal = (rowArr: string[], headName: string) => {
      const idx = normalizedHeaders.findIndex((h) => h.includes(headName))
      if (idx === -1 || !rowArr[idx]) return ""
      return String(rowArr[idx]).trim().replace(/^["']|["']$/g, "")
    }

    const rows: ParsedRow[] = []

    for (let i = 0; i < dataRows.length; i++) {
      const cleanArr = dataRows[i].map((cell) => String(cell ?? "").replace(/^["']|["']$/g, "").trim())
      if (cleanArr.every((cell) => !cell)) continue

      const depot_name = getVal(cleanArr, "depot name") || getVal(cleanArr, "depot") || cleanArr[0] || ""
      const state = getVal(cleanArr, "state") || ""
      const depot_address = getVal(cleanArr, "depot address") || getVal(cleanArr, "address")
      const status = getVal(cleanArr, "status") || "Active"

      if (!depot_name && !state) continue

      rows.push({
        index: i + 1,
        depot_name,
        state,
        depot_address,
        status: status ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() : "Active",
      })
    }

    return rows
  }

  // Parse CSV Content
  const parseCSV = (text: string): ParsedRow[] => {
    const lines = text.split(/\r\n|\n/).filter((l) => l.trim().length > 0)
    if (lines.length <= 1) return []

    const headers = lines[0].split(",").map((h) => h.trim().replace(/^["']|["']$/g, ""))
    const dataRows = lines.slice(1).map((line) => {
      const rowArr = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(",")
      return rowArr.map((cell) => cell.replace(/^["']|["']$/g, "").trim())
    })

    return mapRowsToParsedRows(headers, dataRows)
  }

  // Parse Excel Content
  const parseExcel = (data: ArrayBuffer): ParsedRow[] => {
    const workbook = XLSX.read(data, { type: "array" })
    const firstSheetName = workbook.SheetNames[0]
    if (!firstSheetName) return []

    const sheet = workbook.Sheets[firstSheetName]
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" })
    if (rows.length <= 1) return []

    const headers = (rows[0] || []).map((h) => String(h ?? ""))
    const dataRows = rows.slice(1).map((row) => (row || []).map((cell) => String(cell ?? "")))

    return mapRowsToParsedRows(headers, dataRows)
  }

  // Validate parsed rows
  const validateRows = (rows: ParsedRow[]): ValidationResult[] => {
    return rows.map((row) => {
      const errors: string[] = []

      if (!row.depot_name) {
        errors.push("Depot Name is required")
      }
      if (!row.state) {
        errors.push("State is required")
      }

      return {
        row,
        isValid: errors.length === 0,
        errors,
      }
    })
  }

  // File Selection Handler
  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile) return
    setFile(selectedFile)

    const isExcel = /\.(xlsx|xls)$/i.test(selectedFile.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const parsed = isExcel
        ? parseExcel(e.target?.result as ArrayBuffer)
        : parseCSV((e.target?.result as string) || "")
      setParsedRows(parsed)
      const validated = validateRows(parsed)
      setValidationResults(validated)
    }
    if (isExcel) {
      reader.readAsArrayBuffer(selectedFile)
    } else {
      reader.readAsText(selectedFile)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  // Execute Bulk Import POST API
  const handlePerformImport = async () => {
    const validRowsToImport = validationResults
      .filter((v) => v.isValid)
      .map((v) => v.row)

    if (validRowsToImport.length === 0) return

    setIsSubmitting(true)
    try {
      const res = await depotApi.bulkImport(validRowsToImport)
      if (res?.success) {
        setImportResponse(res.data)
        setStep(4)
        onSuccess()
      } else {
        alert(res?.message || "Bulk import failed")
      }
    } catch (err: any) {
      alert(err?.message || "An unexpected error occurred during bulk import")
    } finally {
      setIsSubmitting(false)
    }
  }

  const validCount = validationResults.filter((v) => v.isValid).length
  const errorCount = validationResults.filter((v) => !v.isValid).length

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="w-[92vw] sm:max-w-[850px] max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-2xl"
        style={{ maxWidth: "850px", width: "92vw" }}
      >
        {/* Header Bar */}
        <DialogHeader className="px-6 py-3.5 border-b bg-slate-50/60 relative shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
              <Building2 className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900 tracking-tight">
                Bulk Import Depots
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Import multiple depot records at once using a CSV or Excel file
              </DialogDescription>
            </div>
          </div>

          {/* Stepper Navigation (Equal Grid Spacing Line Stepper) */}
          <div className="mt-3.5 pt-0.5">
            <div className="relative max-w-md mx-auto">
              {/* Background Connecting Line */}
              <div className="absolute top-3.5 left-[12.5%] right-[12.5%] h-[2px] bg-slate-200 -z-0" />

              <div className="grid grid-cols-4">
                {[
                  { id: 1, label: "Format Guide" },
                  { id: 2, label: "Upload File" },
                  { id: 3, label: "Preview & Validate" },
                  { id: 4, label: "Results" },
                ].map((s) => {
                  const isActive = step === s.id
                  const isDone = step > s.id
                  return (
                    <div key={s.id} className="relative z-10 flex flex-col items-center gap-1 text-center">
                      <div
                        className={`h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${
                          isActive
                            ? "bg-primary text-white ring-4 ring-primary/20 shadow-sm shadow-primary/30"
                            : isDone
                            ? "bg-emerald-600 text-white"
                            : "bg-white border-2 border-slate-300 text-slate-400"
                        }`}
                      >
                        {isDone ? <Check className="h-3.5 w-3.5" /> : s.id}
                      </div>
                      <span
                        className={`text-[11px] font-semibold tracking-tight whitespace-nowrap ${
                          isActive
                            ? "text-primary font-bold"
                            : isDone
                            ? "text-slate-700 font-semibold"
                            : "text-slate-400 font-medium"
                        }`}
                      >
                        {s.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Modal Body */}
        <div className="px-6 py-4 flex-1 overflow-y-auto max-h-[calc(90vh-130px)] space-y-3.5">
          {/* STEP 1: FORMAT GUIDE */}
          {step === 1 && (
            <div className="space-y-3.5">
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl flex items-center gap-3">
                <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Building2 className="h-4 w-4" />
                </div>
                <div className="text-xs">
                  <p className="font-bold text-slate-900">Depot Import Format Overview</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">Review required and optional columns before uploading your depot spreadsheet.</p>
                </div>
              </div>

              {/* COLUMNS SPECIFICATION TABLE */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold text-slate-700 tracking-wider uppercase">
                  Columns Specification
                </p>

                <div className="border border-slate-200/80 rounded-xl overflow-hidden text-xs bg-white shadow-2xs">
                  {/* Required Columns Subheader */}
                  <div className="px-3.5 py-2 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between">
                    <span className="font-bold text-[11px] text-slate-800 uppercase tracking-wider">
                      Required Columns <span className="normal-case font-normal text-slate-400 ml-1.5">(must be present in your file)</span>
                    </span>
                  </div>

                  {/* Column Spec Header Row */}
                  <div className="px-3.5 py-1.5 bg-slate-100/50 border-b border-slate-200/60 flex items-center justify-between gap-4">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider shrink-0 min-w-[180px]">Column Name</span>
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex-1">Description</span>
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider shrink-0">Example Value</span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    <div className="px-3.5 py-2 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                      <div className="flex items-center gap-2 shrink-0 min-w-[180px]">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-[11px] font-semibold border border-slate-200/60">depot_name</span>
                        <span className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-[10px] font-semibold border border-red-200/60 shrink-0">Required</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">Official depot / warehouse name</div>
                      <div className="text-slate-800 text-xs font-medium shrink-0">Raipur Central Depot</div>
                    </div>

                    <div className="px-3.5 py-2 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                      <div className="flex items-center gap-2 shrink-0 min-w-[180px]">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-[11px] font-semibold border border-slate-200/60">state</span>
                        <span className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-[10px] font-semibold border border-red-200/60 shrink-0">Required</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">Must match official State Master</div>
                      <div className="text-slate-800 text-xs font-medium shrink-0">Chhattisgarh</div>
                    </div>
                  </div>

                  {/* Optional Columns Subheader */}
                  <div className="px-3.5 py-2 bg-slate-50/80 border-t border-b border-slate-200/80 flex items-center justify-between">
                    <span className="font-bold text-[11px] text-slate-800 uppercase tracking-wider">
                      Optional Columns <span className="normal-case font-normal text-slate-400 ml-1.5">(include if available)</span>
                    </span>
                  </div>

                  <div className="px-3.5 py-2 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                    <div className="flex items-center gap-2 shrink-0 min-w-[180px]">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-mono text-[11px] border border-slate-200/60">depot_address, status</span>
                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium border border-slate-200/60 shrink-0">Optional</span>
                    </div>
                    <div className="text-slate-500 text-xs flex-1">Depot street address, status (Active/Inactive)</div>
                    <div className="text-slate-400 text-xs italic shrink-0">Optional details</div>
                  </div>
                </div>
              </div>

              {/* Step 1 Footer Action Bar */}
              <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadTemplate}
                  className="h-8.5 px-3.5 rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs gap-2"
                >
                  <Download className="h-3.5 w-3.5 text-slate-500" />
                  Download Sample CSV
                </Button>

                <Button
                  size="sm"
                  onClick={() => setStep(2)}
                  className="h-8.5 px-4.5 rounded-xl font-bold bg-primary hover:bg-primary/90 text-white text-xs gap-2 shadow-sm shadow-primary/20"
                >
                  Next: Upload File
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: UPLOAD FILE */}
          {step === 2 && (
            <div className="space-y-3.5">
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setIsDragging(true)
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                  isDragging
                    ? "border-primary bg-primary/5 shadow-inner"
                    : file
                    ? "border-emerald-400 bg-emerald-50/20"
                    : "border-slate-200 hover:border-slate-300 bg-slate-50/40"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelect(e.target.files[0])
                    }
                  }}
                />
                <div className="flex flex-col items-center gap-2">
                  <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                    <Upload className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-xs">
                      {file ? file.name : "Drag & drop your file here"}
                    </p>
                    <p className="text-[11px] text-slate-600 font-semibold hover:underline mt-0.5">
                      {file ? `${(file.size / 1024).toFixed(1)} KB — Ready for validation` : "or browse to upload file"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Badge variant="outline" className="text-[9px] bg-white text-slate-500 border-slate-200 px-2 py-0.5">.CSV</Badge>
                    <Badge variant="outline" className="text-[9px] bg-white text-slate-500 border-slate-200 px-2 py-0.5">.XLSX</Badge>
                    <Badge variant="outline" className="text-[9px] bg-white text-slate-500 border-slate-200 px-2 py-0.5">.XLS</Badge>
                  </div>
                </div>
              </div>

              {file && (
                <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                    <div>
                      <p className="font-bold text-slate-900 text-xs">{file.name}</p>
                      <p className="text-[11px] text-slate-500">{parsedRows.length} rows detected for validation</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation()
                      setFile(null)
                      setParsedRows([])
                      setValidationResults([])
                    }}
                    className="h-7 w-7 text-slate-400 hover:text-red-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}

              <div className="p-3 bg-slate-50/80 border border-slate-200/80 rounded-xl text-xs space-y-1">
                <p className="font-bold text-[11px] text-slate-700 uppercase tracking-wider">Helpful Tips</p>
                <ul className="space-y-0.5 text-[11px] text-slate-600 list-disc list-inside leading-relaxed">
                  <li>First row must be the header row with exact column names</li>
                  <li>Save as CSV (UTF-8) or Excel (.xlsx) for best compatibility</li>
                  <li>State name must match active states in State Master</li>
                  <li>Depot Code (DPT101, etc.) will be automatically generated</li>
                </ul>
              </div>

              <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStep(1)}
                  className="h-8.5 px-3.5 rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs gap-1.5"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to Guide
                </Button>

                <Button
                  size="sm"
                  disabled={!file || parsedRows.length === 0}
                  onClick={() => setStep(3)}
                  className="h-8.5 px-4.5 rounded-xl font-bold bg-primary hover:bg-primary/90 text-white text-xs gap-2 shadow-sm shadow-primary/20"
                >
                  Next: Validate Data
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW & VALIDATE */}
          {step === 3 && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-center">
                  <p className="text-xl font-black text-slate-900">{validationResults.length}</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">TOTAL ROWS</p>
                </div>
                <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-center">
                  <p className="text-xl font-black text-emerald-600">{validCount}</p>
                  <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider mt-0.5">VALID</p>
                </div>
                <div className="p-3 bg-red-50/70 border border-red-200/80 rounded-xl text-center">
                  <p className="text-xl font-black text-red-600">{errorCount}</p>
                  <p className="text-[10px] font-bold text-red-800 uppercase tracking-wider mt-0.5">ERRORS</p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500 px-1">
                <FileSpreadsheet className="h-4 w-4 text-slate-400" />
                <span className="font-semibold text-slate-800">{file?.name || "Depot_Import.csv"}</span>
                <span>— {validationResults.length} rows detected</span>
              </div>

              {errorCount > 0 && (
                <div className="p-2.5 bg-amber-50/80 border border-amber-200/80 rounded-xl space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-amber-950">
                      <strong className="font-bold">{errorCount} rows</strong> have validation issues
                    </span>
                    <Badge variant="outline" className="bg-white text-amber-800 border-amber-300 font-bold text-[10px]">
                      {validCount} will be imported
                    </Badge>
                  </div>
                  <div className="h-1.5 w-full bg-amber-200/60 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${(validCount / validationResults.length) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="border border-slate-200/80 rounded-xl overflow-hidden max-h-[200px] overflow-y-auto bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 bg-slate-50 z-10">
                    <tr>
                      <th className="py-2 px-3 text-center">#</th>
                      <th className="py-2 px-3">DEPOT NAME *</th>
                      <th className="py-2 px-3">STATE *</th>
                      <th className="py-2 px-3">DEPOT ADDRESS</th>
                      <th className="py-2 px-3">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {validationResults.map((v, i) => (
                      <tr
                        key={i}
                        className={!v.isValid ? "bg-red-50/30 text-red-900" : "hover:bg-slate-50/50"}
                      >
                        <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">{i + 1}</td>
                        <td className="py-2 px-3 font-semibold text-slate-900">{v.row.depot_name || <span className="text-red-500 italic">empty</span>}</td>
                        <td className="py-2 px-3 text-slate-600">{v.row.state || <span className="text-red-500 italic">empty</span>}</td>
                        <td className="py-2 px-3 text-slate-500">{v.row.depot_address || "empty"}</td>
                        <td className="py-2 px-3">
                          {v.isValid ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                              <Check className="h-3 w-3" /> Valid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-600 font-semibold text-[11px]" title={v.errors.join(", ")}>
                              <AlertCircle className="h-3 w-3" /> Error
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStep(2)}
                  className="h-8.5 px-3.5 rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs gap-1.5"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Re-upload
                </Button>

                <Button
                  size="sm"
                  disabled={validCount === 0 || isSubmitting}
                  onClick={handlePerformImport}
                  className="h-8.5 px-4.5 rounded-xl font-bold bg-primary hover:bg-primary/90 text-white text-xs gap-2 shadow-sm shadow-primary/20 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      Import {validCount} Records
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4: RESULTS */}
          {step === 4 && importResponse && (
            <div className="space-y-3.5 py-2 text-center">
              <div className="h-12 w-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-7 w-7" />
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900">Bulk Import Completed!</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Depot records have been processed and added to Depots Master.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
                <div className="p-3 bg-emerald-50 border border-emerald-200/80 rounded-xl">
                  <p className="text-xl font-black text-emerald-600">{importResponse.importedCount}</p>
                  <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider mt-0.5">CREATED</p>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                  <p className="text-xl font-black text-slate-600">{importResponse.failedCount}</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">FAILED</p>
                </div>
              </div>

              {importResponse.importedDepotCodes && importResponse.importedDepotCodes.length > 0 && (
                <div className="max-w-md mx-auto p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 text-left space-y-1.5">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    GENERATED DEPOT CODES ({importResponse.importedDepotCodes.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto p-1">
                    {importResponse.importedDepotCodes.map((code: string, idx: number) => (
                      <Badge
                        key={idx}
                        variant="outline"
                        className="bg-white text-slate-800 border-slate-300 font-mono font-bold text-[11px]"
                      >
                        {code}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-1">
                <Button
                  size="sm"
                  onClick={handleClose}
                  className="h-8.5 px-5 rounded-xl font-bold bg-primary hover:bg-primary/90 text-white text-xs shadow-sm shadow-primary/20"
                >
                  Close & Refresh Depot List
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

