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
  ShieldCheck,
} from "lucide-react"
import * as XLSX from "xlsx"
import { insuranceDetailApi } from "@/lib/api-service"

interface InsuranceDetailBulkImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

type Step = 1 | 2 | 3 | 4

interface ParsedRow {
  index: number
  insurance_company_name: string
  short_name?: string
  policy_number?: string
  valid_from?: string
  valid_upto?: string
  type_of_policy?: string
  sum_insured?: string
  owner_type?: string
  linked_customers?: string
  status?: string
}

interface ValidationResult {
  row: ParsedRow
  isValid: boolean
  errors: string[]
}

export function InsuranceDetailBulkImportModal({
  open,
  onOpenChange,
  onSuccess,
}: InsuranceDetailBulkImportModalProps) {
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

  // Download CSV Template for Insurance Details
  const handleDownloadTemplate = () => {
    const headers = "Insurance Company Name,Short Name,Policy Number,Valid From,Valid Upto,Type of Policy,Sum Insured,Owner Type,Linked Customers,Status"
    const sampleRow = "National Insurance Co. Ltd,NICL,POL-88492042,2025-01-01,2026-12-31,Open Policy,5000000.00,Customer,Shree Traders; Gupta Agro,Active"

    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(`${headers}\n${sampleRow}\n`)
    const link = document.createElement("a")
    link.setAttribute("href", csvContent)
    link.setAttribute("download", `Insurance_Details_Bulk_Import_Template.csv`)
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
          insurance_company_name: row[0] || "",
          short_name: row[1] || "",
          policy_number: row[2] || "",
          valid_from: row[3] || "",
          valid_upto: row[4] || "",
          type_of_policy: row[5] || "Open Policy",
          sum_insured: row[6] || "",
          owner_type: row[7] || "Company",
          linked_customers: row[8] || "",
          status: row[9] || (row.length >= 9 ? row[8] : "Active"),
        }))

      setParsedRows(mapped)

      // Run client-side validation
      const validated: ValidationResult[] = mapped.map((row) => {
        const errors: string[] = []
        if (!row.insurance_company_name) {
          errors.push("Insurance Company Name is required")
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
        insurance_company_name: v.row.insurance_company_name,
        short_name: v.row.short_name,
        policy_number: v.row.policy_number,
        valid_from: v.row.valid_from,
        valid_upto: v.row.valid_upto,
        type_of_policy: v.row.type_of_policy,
        sum_insured: v.row.sum_insured,
        owner_type: v.row.owner_type,
        linked_customers: v.row.linked_customers,
        status: v.row.status,
      }))

    if (validRowsToImport.length === 0) return

    setIsSubmitting(true)
    try {
      const res = await insuranceDetailApi.bulkImport(validRowsToImport)
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
              <ShieldCheck className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900 tracking-tight">
                Bulk Import Insurance Details
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Import multiple insurance policies and sum insured values using a CSV or Excel file
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
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div className="text-xs">
                  <p className="font-bold text-slate-900">Insurance Details Import Format Overview</p>
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
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-[11px] font-semibold border border-slate-200/60">insurance_company_name</span>
                        <span className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-[10px] font-semibold border border-red-200/60 shrink-0">Required</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">Name of the Insurance Provider</div>
                      <div className="text-slate-800 text-xs font-medium shrink-0">National Insurance Co.</div>
                    </div>

                    <div className="px-3.5 py-2 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                      <div className="flex items-center gap-2 shrink-0 min-w-[180px]">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-[11px] font-semibold border border-slate-200/60">short_name</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-semibold border border-slate-200 shrink-0">Optional</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">Short Name / Code</div>
                      <div className="text-slate-800 text-xs font-medium shrink-0">NICL</div>
                    </div>

                    <div className="px-3.5 py-2 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                      <div className="flex items-center gap-2 shrink-0 min-w-[180px]">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-[11px] font-semibold border border-slate-200/60">policy_number</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-semibold border border-slate-200 shrink-0">Optional</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">Insurance Policy Number</div>
                      <div className="text-slate-800 text-xs font-medium shrink-0">POL-88492042</div>
                    </div>

                    <div className="px-3.5 py-2 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                      <div className="flex items-center gap-2 shrink-0 min-w-[180px]">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-[11px] font-semibold border border-slate-200/60">valid_from</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-semibold border border-slate-200 shrink-0">Optional</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">Policy Start Date (YYYY-MM-DD)</div>
                      <div className="text-slate-800 text-xs font-medium shrink-0">2025-01-01</div>
                    </div>

                    <div className="px-3.5 py-2 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                      <div className="flex items-center gap-2 shrink-0 min-w-[180px]">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-[11px] font-semibold border border-slate-200/60">valid_upto</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-semibold border border-slate-200 shrink-0">Optional</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">Policy Expiry Date (YYYY-MM-DD)</div>
                      <div className="text-slate-800 text-xs font-medium shrink-0">2026-12-31</div>
                    </div>

                    <div className="px-3.5 py-2 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                      <div className="flex items-center gap-2 shrink-0 min-w-[180px]">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-[11px] font-semibold border border-slate-200/60">type_of_policy</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-semibold border border-slate-200 shrink-0">Optional</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">Policy Type (Marine Cargo / Open Policy)</div>
                      <div className="text-slate-800 text-xs font-medium shrink-0">Open Policy</div>
                    </div>

                    <div className="px-3.5 py-2 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                      <div className="flex items-center gap-2 shrink-0 min-w-[180px]">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-[11px] font-semibold border border-slate-200/60">sum_insured</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-semibold border border-slate-200 shrink-0">Optional</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">Total Sum Insured Amount (INR)</div>
                      <div className="text-slate-800 text-xs font-medium shrink-0">5000000.00</div>
                    </div>

                    <div className="px-3.5 py-2 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                      <div className="flex items-center gap-2 shrink-0 min-w-[180px]">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-[11px] font-semibold border border-slate-200/60">owner_type</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-semibold border border-slate-200 shrink-0">Optional</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">Owner of Policy (Company / Customer)</div>
                      <div className="text-slate-800 text-xs font-medium shrink-0">Customer</div>
                    </div>

                    <div className="px-3.5 py-2 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                      <div className="flex items-center gap-2 shrink-0 min-w-[180px]">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-[11px] font-semibold border border-slate-200/60">linked_customers</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-semibold border border-slate-200 shrink-0">Optional</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">Linked Customer Names (semicolon separated)</div>
                      <div className="text-slate-800 text-xs font-medium shrink-0">Shree Traders; Gupta Agro</div>
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
                      <th className="py-2.5 px-3">Company Name</th>
                      <th className="py-2.5 px-3">Policy No</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Sum Insured</th>
                      <th className="py-2.5 px-3">Owner</th>
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
                        <td className="py-2 px-3 font-semibold text-slate-900">{res.row.insurance_company_name}</td>
                        <td className="py-2 px-3 text-slate-600 font-mono">{res.row.policy_number || "-"}</td>
                        <td className="py-2 px-3 text-slate-600">{res.row.type_of_policy || "Open Policy"}</td>
                        <td className="py-2 px-3 text-slate-600 font-mono">{res.row.sum_insured || "-"}</td>
                        <td className="py-2 px-3 text-slate-600">{res.row.owner_type || "Company"}</td>
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
                  Imported {importResponse?.importedCount || validCount} insurance details into master database.
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
