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
  Truck,
} from "lucide-react"
import * as XLSX from "xlsx"
import { vehicleMasterApi } from "@/lib/api-service"

interface VehicleBulkImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

type Step = 1 | 2 | 3 | 4

interface ParsedRow {
  index: number
  registration_no: string
  vehicle_type: string
  transporter: string
  gvw: string
  ulw: string
  passing: string
  fuel_type: string
  rto: string
  road_tax: string
  pollution: string
  insurance: string
  fitness: string
  state_permit: string
  state_permit_type: string
  national_permit: string
  life_time_tax: string
  gps_company: string
  gps_api_tracking_link?: string
  gps_valid_upto: string
  gps_type: string
  gps_installed_by: string
  status: string
}

interface ValidationResult {
  row: ParsedRow
  isValid: boolean
  errors: string[]
}

export function VehicleBulkImportModal({
  open,
  onOpenChange,
  onSuccess,
}: VehicleBulkImportModalProps) {
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

  // Download CSV Template for Vehicles
  const handleDownloadTemplate = () => {
    const headers = "Vehicle Registration No,Vehicle Type,Transporter,GVW (kg),ULW (kg),Passing Capacity (kg),Fuel Type,RTO,Road Tax Date,Pollution Date,Insurance Date,Fitness Date,State Permit Date,State Permit Type,National Permit Date,Life Time Tax Date,GPS Company,GPS Tracking Link,GPS Valid Upto,GPS Type,GPS Installed By,Status"
    const sampleRow = "RJ14GB1234,Truck,Company Vehicle,25000,8000,17000,Diesel,RJ14,2026-12-31,2025-06-30,2026-03-31,2027-01-15,2028-05-20,State Permit,2029-08-10,2030-12-31,MapmyIndia,https://gps.example.com/track/1234,2027-12-31,Wired,Vendor,Active"

    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(`${headers}\n${sampleRow}\n`)
    const link = document.createElement("a")
    link.setAttribute("href", csvContent)
    link.setAttribute("download", `Vehicle_Bulk_Import_Template.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Map header row + data rows to ParsedRow[]
  const mapRowsToParsedRows = (headers: string[], dataRows: string[][]): ParsedRow[] => {
    const normalizedHeaders = headers.map((h) => (h || "").trim().replace(/^["']|["']$/g, "").toLowerCase())

    const getColValue = (row: string[], candidateNames: string[]) => {
      for (const name of candidateNames) {
        const idx = normalizedHeaders.findIndex((h) => h === name || h.includes(name))
        if (idx !== -1 && row[idx] !== undefined) {
          return (row[idx] || "").trim()
        }
      }
      return ""
    }

    return dataRows
      .filter((r) => r.some((cell) => cell && cell.trim() !== ""))
      .map((row, index) => {
        return {
          index: index + 1,
          registration_no: getColValue(row, ["vehicle registration no", "registration_no", "registration no", "vehicle no", "reg no"]),
          vehicle_type: getColValue(row, ["vehicle type", "vehicle_type", "type"]),
          transporter: getColValue(row, ["transporter", "transporter_name"]),
          gvw: getColValue(row, ["gvw (kg)", "gvw", "gross vehicle weight"]),
          ulw: getColValue(row, ["ulw (kg)", "ulw", "unladen weight"]),
          passing: getColValue(row, ["passing capacity (kg)", "passing capacity", "passing"]),
          fuel_type: getColValue(row, ["fuel type", "fuel_type", "fuel"]),
          rto: getColValue(row, ["rto"]),
          road_tax: getColValue(row, ["road tax date", "road tax", "road_tax"]),
          pollution: getColValue(row, ["pollution date", "pollution"]),
          insurance: getColValue(row, ["insurance date", "insurance"]),
          fitness: getColValue(row, ["fitness date", "fitness"]),
          state_permit: getColValue(row, ["state permit date", "state permit"]),
          state_permit_type: getColValue(row, ["state permit type"]),
          national_permit: getColValue(row, ["national permit date", "national permit"]),
          life_time_tax: getColValue(row, ["life time tax date", "life time tax"]),
          gps_company: getColValue(row, ["gps company"]),
          gps_api_tracking_link: getColValue(row, ["gps tracking link", "gps_api_tracking_link", "gps link"]),
          gps_valid_upto: getColValue(row, ["gps valid upto", "gps valid"]),
          gps_type: getColValue(row, ["gps type"]),
          gps_installed_by: getColValue(row, ["gps installed by"]),
          status: getColValue(row, ["status"]) || "Active",
        }
      })
  }

  const validateRows = (rows: ParsedRow[]): ValidationResult[] => {
    return rows.map((row) => {
      const errors: string[] = []

      if (!row.registration_no) {
        errors.push("Registration Number is required")
      } else if (!/^[A-Z0-9-]{4,15}$/i.test(row.registration_no.replace(/\s+/g, ""))) {
        errors.push("Invalid vehicle registration format")
      }

      return {
        row,
        isValid: errors.length === 0,
        errors,
      }
    })
  }

  const handleFileSelect = (selectedFile: File) => {
    const isExcel =
      selectedFile.name.endsWith(".xlsx") ||
      selectedFile.name.endsWith(".xls") ||
      selectedFile.type.includes("sheet") ||
      selectedFile.type.includes("excel")

    const isCsv = selectedFile.name.endsWith(".csv") || selectedFile.type.includes("csv")

    if (!isExcel && !isCsv) {
      alert("Please select a valid CSV or Excel file (.csv, .xlsx, .xls).")
      return
    }

    setFile(selectedFile)

    const reader = new FileReader()
    reader.onload = (e) => {
      let headers: string[] = []
      let dataRows: string[][] = []

      if (isExcel) {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: "array" })
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]
        const jsonRows = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1 })

        if (jsonRows.length > 0) {
          headers = (jsonRows[0] || []).map((cell) => String(cell || ""))
          dataRows = jsonRows.slice(1).map((r) => (r || []).map((cell) => String(cell ?? "")))
        }
      } else {
        const text = e.target?.result as string
        const lines = text.split(/\r?\n/)
        if (lines.length > 0) {
          headers = lines[0].split(",").map((cell) => cell.trim())
          dataRows = lines.slice(1).map((line) => line.split(",").map((cell) => cell.trim()))
        }
      }

      const parsed = mapRowsToParsedRows(headers, dataRows)
      const validated = validateRows(parsed)

      setParsedRows(parsed)
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
      const res = await vehicleMasterApi.bulkImport(validRowsToImport)
      if (res && (res.success || res.data)) {
        setImportResponse(res.data || res)
        setStep(4)
        onSuccess()
      }
    } catch (err: any) {
      console.error("Vehicle Bulk Import Failed:", err)
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
              <Truck className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900 tracking-tight">
                Bulk Import Vehicles
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Import multiple vehicle records at once using a CSV or Excel file
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
                  <Truck className="h-4 w-4" />
                </div>
                <div className="text-xs">
                  <p className="font-bold text-slate-900">Vehicle Import Format Overview</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">Review required and optional columns before uploading your vehicle spreadsheet.</p>
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
                      <div className="flex items-center gap-2 shrink-0 min-w-[200px]">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-[11px] font-semibold border border-slate-200/60">registration_no</span>
                        <span className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-[10px] font-semibold border border-red-200/60 shrink-0">Required</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">Vehicle Registration / Plate Number</div>
                      <div className="text-slate-800 text-xs font-medium shrink-0">RJ14GB1234</div>
                    </div>

                    <div className="px-3.5 py-2 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                      <div className="flex items-center gap-2 shrink-0 min-w-[200px]">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-[11px] font-semibold border border-slate-200/60">vehicle_type, transporter</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-semibold border border-slate-200 shrink-0">Optional</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">Vehicle Type (Truck, Tanker) & Transporter / Ownership</div>
                      <div className="text-slate-800 text-xs font-medium shrink-0">Truck, Company Vehicle</div>
                    </div>

                    <div className="px-3.5 py-2 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                      <div className="flex items-center gap-2 shrink-0 min-w-[200px]">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-[11px] font-semibold border border-slate-200/60">gvw / ulw / passing</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-semibold border border-slate-200 shrink-0">Optional</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">Gross / Unladen / Passing Weight capacity in KG</div>
                      <div className="text-slate-800 text-xs font-medium shrink-0">25000, 8000, 17000</div>
                    </div>

                    <div className="px-3.5 py-2 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                      <div className="flex items-center gap-2 shrink-0 min-w-[200px]">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-[11px] font-semibold border border-slate-200/60">fuel_type, rto</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-semibold border border-slate-200 shrink-0">Optional</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">Fuel Type & RTO Office Code</div>
                      <div className="text-slate-800 text-xs font-medium shrink-0">Diesel, RJ14</div>
                    </div>

                    <div className="px-3.5 py-2 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                      <div className="flex items-center gap-2 shrink-0 min-w-[200px]">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-[11px] font-semibold border border-slate-200/60">road_tax, pollution, insurance, fitness</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-semibold border border-slate-200 shrink-0">Optional</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">Validity dates (YYYY-MM-DD) for Tax, Pollution, Insurance & Fitness</div>
                      <div className="text-slate-800 text-xs font-medium shrink-0">2026-12-31</div>
                    </div>

                    <div className="px-3.5 py-2 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                      <div className="flex items-center gap-2 shrink-0 min-w-[200px]">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-[11px] font-semibold border border-slate-200/60">permits, lifetime_tax</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-semibold border border-slate-200 shrink-0">Optional</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">State Permit Date & Type, National Permit Date, Lifetime Tax Date</div>
                      <div className="text-slate-800 text-xs font-medium shrink-0">2028-05-20, State Permit</div>
                    </div>

                    <div className="px-3.5 py-2 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                      <div className="flex items-center gap-2 shrink-0 min-w-[200px]">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-[11px] font-semibold border border-slate-200/60">gps_company, gps_valid_upto</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-semibold border border-slate-200 shrink-0">Optional</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">GPS Company, Valid Upto Date, Type & Installed By</div>
                      <div className="text-slate-800 text-xs font-medium shrink-0">MapmyIndia, 2027-12-31</div>
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
                      <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase">Registration No</th>
                      <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase">Type</th>
                      <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase">Fuel</th>
                      <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase">Status</th>
                      <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase text-right">Validation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {validationResults.map((v) => (
                      <tr key={v.row.index} className={v.isValid ? "hover:bg-slate-50/50" : "bg-red-50/30 hover:bg-red-50/50"}>
                        <td className="px-3 py-2 text-slate-400 font-mono text-[11px]">{v.row.index}</td>
                        <td className="px-3 py-2 font-semibold text-slate-800">{v.row.registration_no || "—"}</td>
                        <td className="px-3 py-2 text-slate-600">{v.row.vehicle_type || "—"}</td>
                        <td className="px-3 py-2 text-slate-600">{v.row.fuel_type || "—"}</td>
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
                <h3 className="text-base font-bold text-slate-900">Vehicle Bulk Import Complete!</h3>
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
                    Import {validCount} Valid Vehicle{validCount > 1 ? "s" : ""}
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
