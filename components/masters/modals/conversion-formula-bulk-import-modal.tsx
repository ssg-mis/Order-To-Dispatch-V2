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
  Calculator,
} from "lucide-react"
import * as XLSX from "xlsx"
import { conversionFormulaApi } from "@/lib/api-service"

interface ConversionFormulaBulkImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

type Step = 1 | 2 | 3 | 4

interface ParsedRow {
  index: number
  base_sku: string
  child_sku: string
  conversion_formula_code?: string
  steps?: string
  status?: string
}

interface ValidationResult {
  row: ParsedRow
  isValid: boolean
  errors: string[]
}

export function ConversionFormulaBulkImportModal({
  open,
  onOpenChange,
  onSuccess,
}: ConversionFormulaBulkImportModalProps) {
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

  // Download CSV Template for Conversion Formulas
  const handleDownloadTemplate = () => {
    const headers = "Base SKU Name or Code,Child SKU Name or Code,Formula Code,Steps,Status"
    const sampleRow1 = "Refined Soyabean Oil 15L Tin,Refined Soyabean Oil 1L Pouch,CNV-SOY-TIN-POUCH,Add 0.5 literal; Multiply rate_of_base_item,Active"
    const sampleRow2 = "Mustard Oil 15Kg Tin,Mustard Oil 1L Bottle,,Multiply converted_kg_of_base_item,Active"

    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(`${headers}\n${sampleRow1}\n${sampleRow2}\n`)
    const link = document.createElement("a")
    link.setAttribute("href", csvContent)
    link.setAttribute("download", `Conversion_Formulas_Bulk_Import_Template.csv`)
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

      // Map rows to structured ParsedRow
      const mapped: ParsedRow[] = dataRows
        .filter((row) => row.some((cell) => cell.length > 0))
        .map((row, idx) => ({
          index: idx + 1,
          base_sku: row[0] || "",
          child_sku: row[1] || "",
          conversion_formula_code: row[2] || "",
          steps: row[3] || "",
          status: row[4] || "Active",
        }))

      setParsedRows(mapped)

      // Validate
      const validated: ValidationResult[] = mapped.map((row) => {
        const errors: string[] = []
        if (!row.base_sku || !row.base_sku.trim()) {
          errors.push("Base SKU Name or Code is required")
        }
        if (!row.child_sku || !row.child_sku.trim()) {
          errors.push("Child SKU Name or Code is required")
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
      .map((v) => ({
        base_sku: v.row.base_sku,
        child_sku: v.row.child_sku,
        conversion_formula_code: v.row.conversion_formula_code,
        steps: v.row.steps,
        status: v.row.status,
      }))

    if (validRowsToImport.length === 0) return

    setIsSubmitting(true)
    try {
      const res = await conversionFormulaApi.bulkImport(validRowsToImport)
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
              <Calculator className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900 tracking-tight">
                Bulk Import Conversion Formulas
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Import oil extraction conversion formulas using a CSV or Excel file
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

        {/* Modal Body */}
        <div className="px-6 py-4 flex-1 space-y-3.5 overflow-y-auto max-h-[calc(90vh-130px)]">
          {/* STEP 1: FORMAT GUIDE */}
          {step === 1 && (
            <div className="space-y-3.5">
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl flex items-center gap-3">
                <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Calculator className="h-4 w-4" />
                </div>
                <div className="text-xs">
                  <p className="font-bold text-slate-900">Conversion Formulas Import Format Overview</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">Review required and optional columns before uploading your spreadsheet.</p>
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
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-[11px] font-semibold border border-slate-200/60">Base SKU</span>
                        <span className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-[10px] font-semibold border border-red-200/60 shrink-0">Required</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">Base SKU Name or Code</div>
                      <div className="text-slate-800 text-xs font-medium shrink-0">Refined Soyabean Oil 15L Tin</div>
                    </div>

                    <div className="px-3.5 py-2 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                      <div className="flex items-center gap-2 shrink-0 min-w-[180px]">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-[11px] font-semibold border border-slate-200/60">Child SKU</span>
                        <span className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-[10px] font-semibold border border-red-200/60 shrink-0">Required</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">Child SKU Name or Code</div>
                      <div className="text-slate-800 text-xs font-medium shrink-0">Refined Soyabean Oil 1L Pouch</div>
                    </div>

                    <div className="px-3.5 py-2 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                      <div className="flex items-center gap-2 shrink-0 min-w-[180px]">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-[11px] font-semibold border border-slate-200/60">conversion_formula_code</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-semibold border border-slate-200 shrink-0">Optional</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">Unique Formula Code (Auto-generated if empty)</div>
                      <div className="text-slate-800 text-xs font-medium shrink-0">CNV-SOY-TIN-POUCH</div>
                    </div>

                    <div className="px-3.5 py-2 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                      <div className="flex items-center gap-2 shrink-0 min-w-[180px]">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-[11px] font-semibold border border-slate-200/60">steps</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-semibold border border-slate-200 shrink-0">Optional</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">Formula Steps (Semicolon separated instructions)</div>
                      <div className="text-slate-800 text-xs font-medium shrink-0 font-mono">Add 0.5 literal; Multiply rate_of_base_item</div>
                    </div>

                    <div className="px-3.5 py-2 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                      <div className="flex items-center gap-2 shrink-0 min-w-[180px]">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-[11px] font-semibold border border-slate-200/60">status</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-semibold border border-slate-200 shrink-0">Optional</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">Status (Active / Inactive)</div>
                      <div className="text-slate-800 text-xs font-medium shrink-0">Active</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Bar */}
              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
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

              {/* Action Bar */}
              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
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
            </div>
          )}

          {/* STEP 3: PREVIEW & VALIDATE */}
          {step === 3 && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1.5 py-1 px-2.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {validCount} Valid
                  </Badge>
                  {errorCount > 0 && (
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1.5 py-1 px-2.5">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {errorCount} Errors
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-slate-500">Total {parsedRows.length} records ready for processing</span>
              </div>

              {/* Table Preview */}
              <div className="border border-slate-200 rounded-xl overflow-x-auto max-h-[300px]">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-bold sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Base SKU</th>
                      <th className="py-2.5 px-3">Child SKU</th>
                      <th className="py-2.5 px-3">Formula Code</th>
                      <th className="py-2.5 px-3">Steps</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {validationResults.map((res) => (
                      <tr key={res.row.index} className={!res.isValid ? "bg-red-50/50" : "hover:bg-slate-50/50"}>
                        <td className="py-2 px-3 text-slate-500 font-mono">{res.row.index}</td>
                        <td className="py-2 px-3">
                          {res.isValid ? (
                            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-none text-[10px]">Ready</Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-none text-[10px]" title={res.errors.join(", ")}>
                              Error
                            </Badge>
                          )}
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-900">{res.row.base_sku || "-"}</td>
                        <td className="py-2 px-3 font-semibold text-slate-900">{res.row.child_sku || "-"}</td>
                        <td className="py-2 px-3 text-slate-600 font-mono">{res.row.conversion_formula_code || "-"}</td>
                        <td className="py-2 px-3 text-slate-600 max-w-[220px] truncate" title={res.row.steps}>{res.row.steps || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Action Bar */}
              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStep(2)}
                  className="h-8.5 px-3.5 rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs gap-1.5"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </Button>

                <Button
                  size="sm"
                  disabled={validCount === 0 || isSubmitting}
                  onClick={handlePerformImport}
                  className="h-8.5 px-5 rounded-xl font-bold bg-primary hover:bg-primary/90 text-white text-xs gap-2 shadow-sm shadow-primary/20"
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
          {step === 4 && (
            <div className="py-6 text-center space-y-4">
              <div className="h-14 w-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-8 w-8" />
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900">Bulk Import Completed Successfully</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Imported {importResponse?.importedCount || validCount} conversion formulas into master database.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-center">
                <Button
                  size="sm"
                  onClick={handleClose}
                  className="h-9 px-6 rounded-xl font-bold bg-slate-900 hover:bg-slate-800 text-white text-xs"
                >
                  Done & Close
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
