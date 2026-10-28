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
  Scale,
} from "lucide-react"
import * as XLSX from "xlsx"
import { unitApi } from "@/lib/api-service"

interface UnitBulkImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

type Step = 1 | 2 | 3 | 4

interface ParsedRow {
  index: number
  unit_name: string
  short_name: string
  decimal_places: string
  uqc: string
  status: string
}

interface ValidationResult {
  row: ParsedRow
  isValid: boolean
  errors: string[]
}

export function UnitBulkImportModal({
  open,
  onOpenChange,
  onSuccess,
}: UnitBulkImportModalProps) {
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

  // Download CSV Template for Units
  const handleDownloadTemplate = () => {
    const headers = "Name of unit,Short name,Decimal places,UQC,Status"
    const sampleRow = "Kilograms,KG,3,KGS,Active"

    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(`${headers}\n${sampleRow}\n`)
    const link = document.createElement("a")
    link.setAttribute("href", csvContent)
    link.setAttribute("download", `Unit_Master_Bulk_Import_Template.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Handle parsing selected CSV/Excel File
  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile)
    const reader = new FileReader()
    const isExcel = selectedFile.name.endsWith(".xlsx") || selectedFile.name.endsWith(".xls")

    reader.onload = (e) => {
      let dataRows: string[][] = []

      if (isExcel) {
        const buffer = e.target?.result as ArrayBuffer
        const workbook = XLSX.read(buffer, { type: "array" })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const rawJson = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" })
        if (rawJson.length > 1) {
          dataRows = rawJson.slice(1).map((r) => r.map((c) => String(c).trim()))
        }
      } else {
        const text = e.target?.result as string
        const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)
        if (lines.length > 1) {
          dataRows = lines.slice(1).map((line) =>
            line.split(",").map((cell) => cell.trim().replace(/^["']|["']$/g, ""))
          )
        }
      }

      // Map rows to structured ParsedRow (support UOM or Unit Name column)
      const mapped: ParsedRow[] = dataRows
        .filter((row) => row.some((cell) => cell.length > 0))
        .map((row, idx) => ({
          index: idx + 1,
          unit_name: row[0] || "",
          short_name: row[1] || "",
          decimal_places: row[2] || "",
          uqc: row[3] || "",
          status: row[4] || "Active",
        }))

      setParsedRows(mapped)

      // Run client-side validation
      const validated: ValidationResult[] = mapped.map((row) => {
        const errors: string[] = []
        if (!row.unit_name) {
          errors.push("Name of unit is required")
        }
        if (!row.short_name) {
          errors.push("Short name is required")
        } else if (row.short_name.length > 20) {
          errors.push("Short name must be 20 characters or fewer")
        } else if (mapped.filter((m) => m.short_name.toLowerCase() === row.short_name.toLowerCase()).length > 1) {
          errors.push("Short name is repeated in this file")
        }
        if (row.decimal_places !== "" && !/^[0-6]$/.test(row.decimal_places)) {
          errors.push("Decimal places must be a whole number from 0 to 6")
        }

        return {
          row,
          isValid: errors.length === 0,
          errors,
        }
      })

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
      const res = await unitApi.bulkImport(validRowsToImport)
      if (res && (res.success || res.data)) {
        setImportResponse(res.data || res)
        setStep(4)
        onSuccess()
      }
    } catch (err: any) {
      console.error("Bulk Import Failed:", err)
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
              <Scale className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900 tracking-tight">
                Bulk Import Units of Measurement
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Import multiple unit-of-measurement records at once using a CSV or Excel file
              </DialogDescription>
            </div>
          </div>

          {/* Stepper Navigation */}
          <div className="mt-3.5 pt-0.5">
            <div className="relative max-w-md mx-auto">
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

        {/* Modal Body (scrollable content only — footer buttons are fixed below) */}
        <div className="px-6 py-4 flex-1 min-h-0 overflow-y-auto space-y-3.5">
          {/* STEP 1: FORMAT GUIDE */}
          {step === 1 && (
            <div className="space-y-3.5">
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl flex items-center gap-3">
                <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Scale className="h-4 w-4" />
                </div>
                <div className="text-xs">
                  <p className="font-bold text-slate-900">Unit Master Import Format Overview</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">Review required and optional columns before uploading your units spreadsheet.</p>
                </div>
              </div>

              {/* COLUMNS SPECIFICATION TABLE */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold text-slate-700 tracking-wider uppercase">
                  Columns Specification
                </p>

                <div className="border border-slate-200/80 rounded-xl overflow-hidden text-xs bg-white shadow-2xs">
                  <div className="px-3.5 py-2 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between">
                    <span className="font-bold text-[11px] text-slate-800 uppercase tracking-wider">
                      Required & Optional Columns <span className="normal-case font-normal text-slate-400 ml-1.5">(must match standard structure)</span>
                    </span>
                  </div>

                  <div className="px-3.5 py-1.5 bg-slate-100/50 border-b border-slate-200/60 flex items-center justify-between gap-4">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider shrink-0 min-w-[180px]">Column Name</span>
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex-1">Description</span>
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider shrink-0">Example Value</span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    <div className="px-3.5 py-2 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                      <div className="flex items-center gap-2 shrink-0 min-w-[180px]">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-[11px] font-semibold border border-slate-200/60">unit_name</span>
                        <span className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-[10px] font-semibold border border-red-200/60 shrink-0">Required</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">Name of unit (formal name)</div>
                      <div className="text-slate-800 text-xs font-medium shrink-0">Kilograms</div>
                    </div>

                    <div className="px-3.5 py-2 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                      <div className="flex items-center gap-2 shrink-0 min-w-[180px]">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-[11px] font-semibold border border-slate-200/60">short_name</span>
                        <span className="px-1.5 py-0.5 bg-red-50 text-red-600 border-red-200/60 rounded text-[10px] font-semibold border shrink-0">Required</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">Short name (symbol), shown everywhere. Must be unique</div>
                      <div className="text-slate-800 text-xs font-medium shrink-0">KG</div>
                    </div>

                    <div className="px-3.5 py-2 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                      <div className="flex items-center gap-2 shrink-0 min-w-[180px]">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-[11px] font-semibold border border-slate-200/60">decimal_places</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 border-slate-200 rounded text-[10px] font-semibold border shrink-0">Optional</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">Decimal places, 0 to 6 (default 2)</div>
                      <div className="text-slate-800 text-xs font-medium shrink-0">3</div>
                    </div>

                    <div className="px-3.5 py-2 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                      <div className="flex items-center gap-2 shrink-0 min-w-[180px]">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-[11px] font-semibold border border-slate-200/60">uqc</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 border-slate-200 rounded text-[10px] font-semibold border shrink-0">Optional</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">UQC code for GST: KGS, NOS, LTR, MTR, BOX, SET</div>
                      <div className="text-slate-800 text-xs font-medium shrink-0">KGS</div>
                    </div>

                    <div className="px-3.5 py-2 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                      <div className="flex items-center gap-2 shrink-0 min-w-[180px]">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-[11px] font-semibold border border-slate-200/60">status</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-semibold border border-slate-200 shrink-0">Optional</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">Status (Active or Inactive)</div>
                      <div className="text-slate-800 text-xs font-medium shrink-0">Active</div>
                    </div>
                  </div>
                </div>
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
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                  isDragging
                    ? "border-primary bg-primary/5 scale-[0.99]"
                    : file
                    ? "border-emerald-400 bg-emerald-50/40"
                    : "border-slate-300 hover:border-slate-400 bg-slate-50/50"
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelect(e.target.files[0])
                    }
                  }}
                />

                {file ? (
                  <div className="space-y-2">
                    <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                      <FileSpreadsheet className="h-6 w-6" />
                    </div>
                    <p className="font-bold text-slate-900 text-sm">{file.name}</p>
                    <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB • Parsed {parsedRows.length} rows</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        setFile(null)
                        setParsedRows([])
                        setValidationResults([])
                      }}
                      className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      Remove File
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                      <Upload className="h-6 w-6" />
                    </div>
                    <p className="font-bold text-slate-800 text-sm">Click to upload or drag and drop</p>
                    <p className="text-xs text-slate-400">Supports .CSV, .XLSX, or .XLS files (up to 5MB)</p>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* STEP 3: PREVIEW & VALIDATE */}
          {step === 3 && (
            <div className="space-y-3.5">
              {/* Validation Summary Pills */}
              <div className="flex items-center gap-3">
                <div className="flex-1 p-2.5 bg-emerald-50 border border-emerald-200/80 rounded-xl flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <div className="text-xs">
                    <span className="font-bold text-emerald-900">{validCount} Valid</span>
                    <span className="text-emerald-700 ml-1">ready for bulk creation</span>
                  </div>
                </div>

                {errorCount > 0 && (
                  <div className="flex-1 p-2.5 bg-red-50 border border-red-200/80 rounded-xl flex items-center gap-2.5">
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                    <div className="text-xs">
                      <span className="font-bold text-red-900">{errorCount} Failed</span>
                      <span className="text-red-700 ml-1">will be skipped</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Data Preview Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs max-h-[280px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 z-10">
                    <tr>
                      <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase">#</th>
                      <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase">Name of unit</th>
                      <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase">Short name</th>
                      <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase">Decimals</th>
                      <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase">UQC</th>
                      <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase">Status</th>
                      <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase text-right">Validation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {validationResults.map((v) => (
                      <tr key={v.row.index} className={v.isValid ? "hover:bg-slate-50/50" : "bg-red-50/30 hover:bg-red-50/50"}>
                        <td className="px-3 py-2 text-slate-400 font-mono text-[11px]">{v.row.index}</td>
                        <td className="px-3 py-2 font-semibold text-slate-800">{v.row.unit_name || "—"}</td>
                        <td className="px-3 py-2 font-mono text-slate-700">{v.row.short_name || "—"}</td>
                        <td className="px-3 py-2 font-mono text-slate-700">{v.row.decimal_places || "—"}</td>
                        <td className="px-3 py-2 text-slate-700">{v.row.uqc || "—"}</td>
                        <td className="px-3 py-2 text-slate-600">{v.row.status}</td>
                        <td className="px-3 py-2 text-right">
                          {v.isValid ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-none text-[10px] font-semibold">Valid</Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800 border-none text-[10px] font-semibold" title={v.errors.join(", ")}>
                              {v.errors[0]}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {/* STEP 4: RESULTS */}
          {step === 4 && importResponse && (
            <div className="space-y-4 py-2 text-center">
              <div className="h-14 w-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-8 w-8" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">Unit Master Bulk Import Complete!</h3>
                <p className="text-xs text-slate-500">
                  Successfully processed {parsedRows.length} record{parsedRows.length > 1 ? "s" : ""}.
                </p>
              </div>

              <div className="flex justify-center gap-4 max-w-sm mx-auto">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex-1 text-center">
                  <p className="text-lg font-extrabold text-emerald-700">{importResponse.importedCount ?? validCount}</p>
                  <p className="text-[11px] font-semibold text-emerald-800">Imported</p>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex-1 text-center">
                  <p className="text-lg font-extrabold text-slate-600">{importResponse.failedCount ?? errorCount}</p>
                  <p className="text-[11px] font-semibold text-slate-600">Failed / Skipped</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Fixed Footer Action Bar — stays visible while the body above scrolls */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-white shrink-0">
          {step === 1 && (
            <div className="flex items-center justify-between">
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
          )}

          {step === 2 && (
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep(1)}
                className="h-8.5 px-3.5 rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs gap-1.5"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </Button>

              <Button
                size="sm"
                disabled={!file || parsedRows.length === 0}
                onClick={() => setStep(3)}
                className="h-8.5 px-4.5 rounded-xl font-bold bg-primary hover:bg-primary/90 text-white text-xs gap-2 shadow-sm shadow-primary/20"
              >
                Next: Preview & Validate ({parsedRows.length} rows)
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep(2)}
                className="h-8.5 px-3.5 rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs gap-1.5"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Upload
              </Button>

              <Button
                size="sm"
                disabled={validCount === 0 || isSubmitting}
                onClick={handlePerformImport}
                className="h-8.5 px-4.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-2 shadow-sm shadow-emerald-600/20"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Importing Records...
                  </>
                ) : (
                  <>
                    Import {validCount} Valid Unit{validCount > 1 ? "s" : ""}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            </div>
          )}

          {step === 4 && importResponse && (
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleClose}
                className="h-8.5 px-5 rounded-xl font-bold bg-slate-900 hover:bg-slate-800 text-white text-xs"
              >
                Done & Close
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
