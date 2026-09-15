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
  Tag,
} from "lucide-react"
import * as XLSX from "xlsx"
import { skuSellingPriceApi } from "@/lib/api-service"

interface PricingBulkImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

type Step = 1 | 2 | 3 | 4

interface ParsedRow {
  index: number
  packing_material: string
  sku_weight: string
  sku_unit: string
  conversion_formula: string
  sku_weight_in_gm: string
  packing_material_weight_in_gm: string
  packing_cost: string
  var: string
  margin: string
  landing_cost: string
  selling_cost: string
  actual_margin: string
  status: string
}

interface ValidationResult {
  row: ParsedRow
  isValid: boolean
  errors: string[]
}

export function PricingBulkImportModal({
  open,
  onOpenChange,
  onSuccess,
}: PricingBulkImportModalProps) {
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

  // Download CSV Template for Pricing / SKU Selling Price
  const handleDownloadTemplate = () => {
    const headers = "Packing Material,SKU Weight,SKU Unit,Conversion Formula,SKU Weight (gm),Packing Weight (gm),Packing Cost,VAR,Margin,Landing Cost,Selling Cost,Actual Margin,Status"
    const sampleRow = "1L Pouch,1,Pouch,15,910,10,2.50,VAR,5%,142.50,145.00,2.50,Active"

    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(`${headers}\n${sampleRow}\n`)
    const link = document.createElement("a")
    link.setAttribute("href", csvContent)
    link.setAttribute("download", `Pricing_Master_Bulk_Import_Template.csv`)
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

      const packing_material = getVal(cleanArr, "packing material") || getVal(cleanArr, "item") || getVal(cleanArr, "sku") || cleanArr[0] || ""
      const sku_weight = getVal(cleanArr, "sku weight") || getVal(cleanArr, "weight") || "1"
      const sku_unit = getVal(cleanArr, "unit") || "Pouch"
      const conversion_formula = getVal(cleanArr, "conversion") || getVal(cleanArr, "formula") || "1"
      const sku_weight_in_gm = getVal(cleanArr, "weight (gm)") || getVal(cleanArr, "weight in gm") || ""
      const packing_material_weight_in_gm = getVal(cleanArr, "packing weight") || ""
      const packing_cost = getVal(cleanArr, "packing cost") || getVal(cleanArr, "cost") || "0"
      const var_val = getVal(cleanArr, "var") || ""
      const margin = getVal(cleanArr, "margin") || ""
      const landing_cost = getVal(cleanArr, "landing") || ""
      const selling_cost = getVal(cleanArr, "selling") || ""
      const actual_margin = getVal(cleanArr, "actual margin") || ""
      const status = getVal(cleanArr, "status") || "Active"

      if (!packing_material) continue

      rows.push({
        index: i + 1,
        packing_material,
        sku_weight,
        sku_unit,
        conversion_formula,
        sku_weight_in_gm,
        packing_material_weight_in_gm,
        packing_cost,
        var: var_val,
        margin,
        landing_cost,
        selling_cost,
        actual_margin,
        status,
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

      if (!row.packing_material) {
        errors.push("Packing Material is required")
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
      const res = await skuSellingPriceApi.bulkImport(validRowsToImport)
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
              <Tag className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900 tracking-tight">
                Bulk Import SKU Selling Prices
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Import multiple pricing & packing cost records at once using a CSV or Excel file
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
                  <Tag className="h-4 w-4" />
                </div>
                <div className="text-xs">
                  <p className="font-bold text-slate-900">Pricing Master Import Format Overview</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">Review required and optional columns before uploading your pricing spreadsheet.</p>
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
                      Required Columns <span className="normal-case font-normal text-slate-400 ml-1.5">(must be present in your file)</span>
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
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-[11px] font-semibold border border-slate-200/60">packing_material</span>
                        <span className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-[10px] font-semibold border border-red-200/60 shrink-0">Required</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">Packing material description</div>
                      <div className="text-slate-800 text-xs font-medium shrink-0">1L Pouch</div>
                    </div>

                    <div className="px-3.5 py-2 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                      <div className="flex items-center gap-2 shrink-0 min-w-[180px]">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-[11px] font-semibold border border-slate-200/60">sku_weight</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-semibold border border-slate-200 shrink-0">Optional</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">SKU Weight</div>
                      <div className="text-slate-800 text-xs font-medium shrink-0">1</div>
                    </div>

                    <div className="px-3.5 py-2 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                      <div className="flex items-center gap-2 shrink-0 min-w-[180px]">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-[11px] font-semibold border border-slate-200/60">sku_unit</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-semibold border border-slate-200 shrink-0">Optional</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">SKU Unit</div>
                      <div className="text-slate-800 text-xs font-medium shrink-0">Pouch</div>
                    </div>

                    <div className="px-3.5 py-2 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                      <div className="flex items-center gap-2 shrink-0 min-w-[180px]">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-[11px] font-semibold border border-slate-200/60">conversion_formula</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-semibold border border-slate-200 shrink-0">Optional</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">Conversion Formula multiplier</div>
                      <div className="text-slate-800 text-xs font-medium shrink-0">15</div>
                    </div>

                    <div className="px-3.5 py-2 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                      <div className="flex items-center gap-2 shrink-0 min-w-[180px]">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-[11px] font-semibold border border-slate-200/60">sku_weight_in_gm</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-semibold border border-slate-200 shrink-0">Optional</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">SKU Gross Weight in Grams</div>
                      <div className="text-slate-800 text-xs font-medium shrink-0">910</div>
                    </div>

                    <div className="px-3.5 py-2 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                      <div className="flex items-center gap-2 shrink-0 min-w-[180px]">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-[11px] font-semibold border border-slate-200/60">packing_weight_in_gm</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-semibold border border-slate-200 shrink-0">Optional</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">Packing material weight in grams</div>
                      <div className="text-slate-800 text-xs font-medium shrink-0">10</div>
                    </div>

                    <div className="px-3.5 py-2 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                      <div className="flex items-center gap-2 shrink-0 min-w-[180px]">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-[11px] font-semibold border border-slate-200/60">packing_cost</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-semibold border border-slate-200 shrink-0">Optional</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">Packing material cost per unit</div>
                      <div className="text-slate-800 text-xs font-medium shrink-0">2.50</div>
                    </div>

                    <div className="px-3.5 py-2 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                      <div className="flex items-center gap-2 shrink-0 min-w-[180px]">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-[11px] font-semibold border border-slate-200/60">var / margin</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-semibold border border-slate-200 shrink-0">Optional</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">VAR category & Margin percentage</div>
                      <div className="text-slate-800 text-xs font-medium shrink-0">VAR / 5%</div>
                    </div>

                    <div className="px-3.5 py-2 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                      <div className="flex items-center gap-2 shrink-0 min-w-[180px]">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-[11px] font-semibold border border-slate-200/60">landing_cost</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-semibold border border-slate-200 shrink-0">Optional</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">Calculated Landing Cost</div>
                      <div className="text-slate-800 text-xs font-medium shrink-0">142.50</div>
                    </div>

                    <div className="px-3.5 py-2 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                      <div className="flex items-center gap-2 shrink-0 min-w-[180px]">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-[11px] font-semibold border border-slate-200/60">selling_cost</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-semibold border border-slate-200 shrink-0">Optional</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">Selling price per unit</div>
                      <div className="text-slate-800 text-xs font-medium shrink-0">145.00</div>
                    </div>

                    <div className="px-3.5 py-2 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                      <div className="flex items-center gap-2 shrink-0 min-w-[180px]">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-[11px] font-semibold border border-slate-200/60">actual_margin</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-semibold border border-slate-200 shrink-0">Optional</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">Actual Margin realized</div>
                      <div className="text-slate-800 text-xs font-medium shrink-0">2.50</div>
                    </div>

                    <div className="px-3.5 py-2 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                      <div className="flex items-center gap-2 shrink-0 min-w-[180px]">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-[11px] font-semibold border border-slate-200/60">status</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-semibold border border-slate-200 shrink-0">Optional</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">Record Status (Active / Inactive)</div>
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
                    <p className="text-sm font-bold text-slate-800">{file.name}</p>
                    <p className="text-xs text-slate-500">
                      {(file.size / 1024).toFixed(1)} KB • {parsedRows.length} rows parsed
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        setFile(null)
                        setParsedRows([])
                        setValidationResults([])
                      }}
                      className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 h-7 px-2"
                    >
                      Remove File
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                      <Upload className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        Drag and drop your spreadsheet here, or <span className="text-primary underline">browse</span>
                      </p>
                      <p className="text-xs text-slate-400 mt-1">Supports CSV, XLSX, XLS files up to 10MB</p>
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* STEP 3: PREVIEW & VALIDATE */}
          {step === 3 && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 font-bold">
                    {validCount} Valid
                  </Badge>
                  {errorCount > 0 && (
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300 font-bold">
                      {errorCount} Invalid
                    </Badge>
                  )}
                </div>

                <span className="text-xs text-slate-500 font-medium">
                  Showing {validationResults.length} records parsed from <span className="font-semibold text-slate-800">{file?.name || "Pricing_Import.csv"}</span>
                </span>
              </div>

              {/* PREVIEW TABLE */}
              <div className="border border-slate-200/80 rounded-xl overflow-hidden max-h-[220px] overflow-y-auto bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="p-2.5 w-12 text-center">#</th>
                      <th className="p-2.5">Packing Material</th>
                      <th className="p-2.5">SKU Weight</th>
                      <th className="p-2.5">Unit</th>
                      <th className="p-2.5">Packing Cost</th>
                      <th className="p-2.5">Selling Cost</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5 text-center">Validation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {validationResults.map((res, idx) => (
                      <tr key={idx} className={!res.isValid ? "bg-red-50/50" : "hover:bg-slate-50/60"}>
                        <td className="p-2.5 text-center font-mono text-[11px] text-slate-400">{res.row.index}</td>
                        <td className="p-2.5 font-semibold text-slate-800">{res.row.packing_material || "—"}</td>
                        <td className="p-2.5 text-slate-600 font-mono">{res.row.sku_weight || "—"}</td>
                        <td className="p-2.5 text-slate-600">{res.row.sku_unit || "—"}</td>
                        <td className="p-2.5 text-slate-600 font-mono">{res.row.packing_cost || "—"}</td>
                        <td className="p-2.5 text-slate-600 font-mono">{res.row.selling_cost || "—"}</td>
                        <td className="p-2.5">
                          <Badge variant="outline" className={res.row.status === 'Inactive' ? 'bg-red-50 text-red-700 border-red-200 text-[10px]' : 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]'}>
                            {res.row.status || 'Active'}
                          </Badge>
                        </td>
                        <td className="p-2.5 text-center">
                          {res.isValid ? (
                            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-none text-[10px]">Valid</Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px]" title={res.errors.join(", ")}>
                              Error
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
            <div className="space-y-3.5 py-2 text-center">
              <div className="h-12 w-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-7 w-7" />
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900">Bulk Import Completed!</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  SKU Selling Price / Pricing records have been processed and added.
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
                className="h-8.5 px-3.5 rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs gap-2"
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
                Next: Preview & Validate ({parsedRows.length} Rows)
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
                className="h-8.5 px-3.5 rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs gap-2"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Upload
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
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Import {validCount} Records
                  </>
                )}
              </Button>
            </div>
          )}

          {step === 4 && importResponse && (
            <div className="flex justify-center">
              <Button
                size="sm"
                onClick={handleClose}
                className="h-8.5 px-5 rounded-xl font-bold bg-primary hover:bg-primary/90 text-white text-xs shadow-sm shadow-primary/20"
              >
                Close & Refresh Pricing List
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
