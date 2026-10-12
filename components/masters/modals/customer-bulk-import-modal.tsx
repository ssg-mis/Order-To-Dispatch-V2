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
} from "lucide-react"
import * as XLSX from "xlsx"
import { customerApi } from "@/lib/api-service"

interface CustomerBulkImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

type Step = 1 | 2 | 3 | 4

interface ParsedRow {
  index: number
  customer_name: string
  state: string
  contact_person: string
  contact: string
  email: string
  address_line_1: string
  address_line_2: string
  pincode: string
  pan: string
  gstin: string
  gst_registered: string
  gst_registration_type: string
  gst_registration_wef: string
  msme_registration_no: string
  msme_registration_type: string
  msme_registration_wef: string
  fssai_no: string
  fssai_licence_type: string
  fssai_valid_upto: string
  ledger_group_name: string
  is_required_for_commitment: string
  godown: string
  status: string
}

interface ValidationResult {
  row: ParsedRow
  isValid: boolean
  errors: string[]
}

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
const PINCODE_REGEX = /^[0-9]{6}$/
const CONTACT_REGEX = /^[0-9]{10}$/

export function CustomerBulkImportModal({
  open,
  onOpenChange,
  onSuccess,
}: CustomerBulkImportModalProps) {
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

  // Download CSV Template — one unified template; GSTIN is just an optional
  // column, so a single file can mix GST-registered and non-registered rows.
  const handleDownloadTemplate = () => {
    const headers = "Customer Name,State,PAN,GSTIN,GST Registration Type,GST W.E.F. Date,Contact Person,Contact Number,Email,Address Line 1,Address Line 2,Pincode,MSME Reg No,MSME Reg Type,MSME W.E.F. Date,FSSAI No,FSSAI Licence Type,FSSAI Valid Upto,Ledger Group,Is Required For Commitment,Godown,Status"
    const registeredSample = `"Shree Balaji Traders","Chhattisgarh","ABCDE1234F","22ABCDE1234F1Z5","Regular","2024-04-01","Ramesh Kumar","9876543210","balaji@gmail.com","Main Road Sector 1","Near Railway Station","492001","UDYAM-CG-01-0012345","Micro","2024-01-01","10019011000123","State","2028-12-31","Sundry Debtors","No","Banari","Active"`
    const unregisteredSample = `"Gupta Kirana Store","Chhattisgarh","ABCDE5678G","","","","Suresh Gupta","9812345678","gupta@gmail.com","Bazaar Para","Opposite Bank","492001","","","","10019011000999","Central","2027-06-30","Sundry Debtors","No","Banari, Raigarh","Active"`

    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(`${headers}\n${registeredSample}\n${unregisteredSample}\n`)
    const link = document.createElement("a")
    link.setAttribute("href", csvContent)
    link.setAttribute("download", "Customer_Bulk_Import_Template.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Escape a value for safe CSV embedding (wraps in quotes, doubles internal quotes)
  const csvEscape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`

  // Export only the rows that failed validation, in the same column order as the
  // import template, plus a Row # and Errors column — so users can fix the flagged
  // fields and re-upload the same file for import.
  const handleExportErrors = () => {
    const errorRows = validationResults.filter((v) => !v.isValid)
    if (errorRows.length === 0) return

    const headers = [
      "Row #",
      "Customer Name",
      "State",
      "PAN",
      "GSTIN",
      "GST Registration Type",
      "GST W.E.F. Date",
      "Contact Person",
      "Contact Number",
      "Email",
      "Address Line 1",
      "Address Line 2",
      "Pincode",
      "MSME Reg No",
      "MSME Reg Type",
      "MSME W.E.F. Date",
      "FSSAI No",
      "FSSAI Licence Type",
      "FSSAI Valid Upto",
      "Ledger Group",
      "Is Required For Commitment",
      "Godown",
      "Status",
      "Errors",
    ]

    const lines = errorRows.map(({ row, errors }) =>
      [
        row.index,
        row.customer_name,
        row.state,
        row.pan,
        row.gstin,
        row.gst_registration_type,
        row.gst_registration_wef,
        row.contact_person,
        row.contact,
        row.email,
        row.address_line_1,
        row.address_line_2,
        row.pincode,
        row.msme_registration_no,
        row.msme_registration_type,
        row.msme_registration_wef,
        row.fssai_no,
        row.fssai_licence_type,
        row.fssai_valid_upto,
        row.ledger_group_name,
        row.is_required_for_commitment,
        row.godown,
        row.status,
        errors.join("; "),
      ]
        .map(csvEscape)
        .join(",")
    )

    const csvContent =
      "data:text/csv;charset=utf-8," +
      encodeURIComponent(`${headers.map(csvEscape).join(",")}\n${lines.join("\n")}\n`)
    const link = document.createElement("a")
    link.setAttribute("href", csvContent)
    link.setAttribute("download", "Customer_Import_Errors.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Map header row + raw data rows into ParsedRow[]
  const mapRowsToParsedRows = (headers: string[], dataRows: string[][]): ParsedRow[] => {
    const normalizedHeaders = headers.map((h) => (h || "").trim().replace(/^["']|["']$/g, "").toLowerCase())

    const getVal = (rowArr: string[], headName: string, excludeContains: string[] = []) => {
      const idx = normalizedHeaders.findIndex(
        (h) => h.includes(headName) && !excludeContains.some((ex) => h.includes(ex))
      )
      if (idx === -1 || !rowArr[idx]) return ""
      return String(rowArr[idx]).trim().replace(/^["']|["']$/g, "")
    }

    const rows: ParsedRow[] = []

    for (let i = 0; i < dataRows.length; i++) {
      const cleanArr = dataRows[i].map((cell) => String(cell ?? "").replace(/^["']|["']$/g, "").trim())
      if (cleanArr.every((cell) => !cell)) continue

      const customer_name = getVal(cleanArr, "customer name") || cleanArr[0] || ""
      const state = getVal(cleanArr, "state") || ""
      const pan = getVal(cleanArr, "pan")
      const gstin = getVal(cleanArr, "gstin")
      const gst_registered = getVal(cleanArr, "gst registration status") || getVal(cleanArr, "gst registered") || (gstin ? "Registered" : "Unregistered")
      const gst_registration_type = getVal(cleanArr, "gst registration type") || (gstin ? "Regular" : "")
      const gst_registration_wef = getVal(cleanArr, "gst w.e.f") || getVal(cleanArr, "gst wef")
      const contact_person = getVal(cleanArr, "contact person")
      const contact =
        getVal(cleanArr, "contact number") ||
        getVal(cleanArr, "mobile") ||
        getVal(cleanArr, "phone") ||
        getVal(cleanArr, "contact", ["contact person"])
      const email = getVal(cleanArr, "email")
      const address_line_1 = getVal(cleanArr, "address line 1") || getVal(cleanArr, "address")
      const address_line_2 = getVal(cleanArr, "address line 2")
      const pincode = getVal(cleanArr, "pincode") || getVal(cleanArr, "pin")
      const msme_registration_no = getVal(cleanArr, "msme reg") || getVal(cleanArr, "msme registration no") || getVal(cleanArr, "msme no")
      const msme_registration_type = getVal(cleanArr, "msme reg type") || getVal(cleanArr, "msme registration type") || getVal(cleanArr, "msme type")
      const msme_registration_wef = getVal(cleanArr, "msme w.e.f") || getVal(cleanArr, "msme wef")
      const fssai_no = getVal(cleanArr, "fssai no") || getVal(cleanArr, "fssai number")
      const fssai_licence_type = getVal(cleanArr, "fssai licence type") || getVal(cleanArr, "fssai type")
      const fssai_valid_upto = getVal(cleanArr, "fssai valid") || getVal(cleanArr, "fssai valid upto")
      const ledger_group_name = getVal(cleanArr, "ledger group") || getVal(cleanArr, "ledger")
      const is_required_for_commitment = getVal(cleanArr, "commitment") || getVal(cleanArr, "is required for commitment") || "No"
      const godown = getVal(cleanArr, "godown") || getVal(cleanArr, "depot")
      const status = getVal(cleanArr, "status") || "Active"

      if (!customer_name && !state) continue

      rows.push({
        index: i + 1,
        customer_name,
        state,
        contact_person,
        contact,
        email,
        address_line_1,
        address_line_2,
        pincode,
        pan: pan ? pan.toUpperCase() : "",
        gstin: gstin ? gstin.toUpperCase() : "",
        gst_registered,
        gst_registration_type,
        gst_registration_wef,
        msme_registration_no,
        msme_registration_type,
        msme_registration_wef,
        fssai_no,
        fssai_licence_type,
        fssai_valid_upto,
        ledger_group_name,
        is_required_for_commitment: is_required_for_commitment ? (is_required_for_commitment.toLowerCase().startsWith('y') ? 'Yes' : 'No') : 'No',
        godown,
        status: status ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() : "Active",
      })
    }

    return rows
  }

  // Splits one CSV line into cells, honoring double-quoted fields (with "" as an
  // escaped quote) so commas/spaces inside quotes and plain unquoted multi-word
  // values are both preserved intact.
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = []
    let current = ""
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (inQuotes) {
        if (char === '"') {
          if (line[i + 1] === '"') {
            current += '"'
            i++
          } else {
            inQuotes = false
          }
        } else {
          current += char
        }
      } else if (char === '"') {
        inQuotes = true
      } else if (char === ",") {
        result.push(current.trim())
        current = ""
      } else {
        current += char
      }
    }
    result.push(current.trim())
    return result
  }

  // Parse CSV Content
  const parseCSV = (text: string): ParsedRow[] => {
    const lines = text.split(/\r\n|\n/).filter((l) => l.trim().length > 0)
    if (lines.length <= 1) return []

    const headers = parseCSVLine(lines[0])
    const dataRows = lines.slice(1).map((line) => parseCSVLine(line))

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

      if (!row.customer_name) {
        errors.push("Customer Name is required")
      }
      if (!row.state) {
        errors.push("State is required")
      }

      // GSTIN is optional — a bulk file can freely mix GST-registered and
      // non-registered customers. When present, it's still validated for format.
      if (row.gstin && !GSTIN_REGEX.test(row.gstin)) {
        errors.push("Invalid GSTIN format (15 characters alphanumeric)")
      }

      if (row.pan && !PAN_REGEX.test(row.pan)) {
        errors.push("Invalid PAN format (e.g. ABCDE1234F)")
      } else if (row.gstin && row.gstin.length === 15) {
        const panFromGst = row.gstin.substring(2, 12)
        if (row.pan && row.pan !== panFromGst) {
          errors.push(`PAN (${row.pan}) does not match GSTIN PAN part (${panFromGst})`)
        }
      }

      if (row.contact && !CONTACT_REGEX.test(row.contact)) {
        errors.push("Contact number must be exactly 10 digits")
      }

      if (row.pincode && !PINCODE_REGEX.test(row.pincode)) {
        errors.push("Pincode must be exactly 6 digits")
      }

      return {
        row,
        isValid: errors.length === 0,
        errors,
      }
    })
  }

  // File Upload Handler
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
      const res = await customerApi.bulkImport(validRowsToImport)
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
              <FileSpreadsheet className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900 tracking-tight">
                Bulk Import Customers
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Import multiple customer records at once using a CSV or Excel file
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

        {/* Modal Body (scrollable content only — footer buttons are fixed below) */}
        <div className="px-6 py-4 flex-1 min-h-0 overflow-y-auto space-y-3.5">
          {/* STEP 1: FORMAT GUIDE */}
          {step === 1 && (
            <div className="space-y-3.5">
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl flex items-center gap-3">
                <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="h-4 w-4" />
                </div>
                <div className="text-xs">
                  <p className="font-bold text-slate-900">One Template for All Customers</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">GST-registered and non-registered customers can go in the same file — GSTIN is optional and only validated when filled in.</p>
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
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-[11px] font-semibold border border-slate-200/60">customer_name</span>
                        <span className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-[10px] font-semibold border border-red-200/60 shrink-0">Required</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">Full legal entity name or business title</div>
                      <div className="text-slate-800 text-xs font-medium shrink-0">Shree Balaji Traders</div>
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

                  <div className="divide-y divide-slate-100">
                    <div className="px-3.5 py-2 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                      <div className="flex items-center gap-2 shrink-0 min-w-[200px]">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-mono text-[11px] border border-slate-200/60">gstin</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium border border-slate-200/60 shrink-0">Optional</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">Leave blank for non-GST customers; validated for format only when provided</div>
                      <div className="text-slate-400 text-xs italic shrink-0">22ABCDE1234F1Z5</div>
                    </div>
                    <div className="px-3.5 py-2 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                      <div className="flex items-center gap-2 shrink-0 min-w-[200px]">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-mono text-[11px] border border-slate-200/60">pan, contact, email, pincode</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium border border-slate-200/60 shrink-0">Optional</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">PAN Number, Contact Number, Email ID, 6-digit Pincode</div>
                      <div className="text-slate-400 text-xs italic shrink-0">ABCDE1234F, 9876543210</div>
                    </div>
                    <div className="px-3.5 py-2 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                      <div className="flex items-center gap-2 shrink-0 min-w-[200px]">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-mono text-[11px] border border-slate-200/60">address_line_1, address_line_2</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium border border-slate-200/60 shrink-0">Optional</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">Street address line 1 and line 2</div>
                      <div className="text-slate-400 text-xs italic shrink-0">Main Road, Sector 1</div>
                    </div>
                    <div className="px-3.5 py-2 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                      <div className="flex items-center gap-2 shrink-0 min-w-[200px]">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-mono text-[11px] border border-slate-200/60">msme_reg_no, msme_type, msme_wef</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium border border-slate-200/60 shrink-0">Optional</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">MSME Registration Number, Type (Micro/Small/Medium), W.E.F. Date</div>
                      <div className="text-slate-400 text-xs italic shrink-0">UDYAM-CG-01-0012345, Micro</div>
                    </div>
                    <div className="px-3.5 py-2 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                      <div className="flex items-center gap-2 shrink-0 min-w-[200px]">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-mono text-[11px] border border-slate-200/60">fssai_no, fssai_type, fssai_valid_upto</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium border border-slate-200/60 shrink-0">Optional</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">FSSAI Licence No, Type (Central/State/Registration), Valid Upto Date</div>
                      <div className="text-slate-400 text-xs italic shrink-0">10019011000123, State</div>
                    </div>
                    <div className="px-3.5 py-2 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                      <div className="flex items-center gap-2 shrink-0 min-w-[200px]">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-mono text-[11px] border border-slate-200/60">ledger_group, commitment, godown, status</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium border border-slate-200/60 shrink-0">Optional</span>
                      </div>
                      <div className="text-slate-500 text-xs flex-1">Ledger Group Name, Is Required for Commitment (Yes/No), Godown (depot name, several separated by comma), Status (Active/Inactive)</div>
                      <div className="text-slate-400 text-xs italic shrink-0">Sundry Debtors, No, Banari, Active</div>
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
                  <li>Empty optional columns are fine — leave them blank</li>
                  <li>Maximum 500 rows per import batch</li>
                </ul>
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
                <span className="font-semibold text-slate-800">{file?.name || "Customer_Import.csv"}</span>
                <span>— {validationResults.length} rows detected</span>
              </div>

              {errorCount > 0 && (
                <div className="p-3 bg-red-50/80 border border-red-200 rounded-xl space-y-2 text-xs text-red-900">
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5 text-red-700">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{errorCount} row(s) failed validation</span>
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleExportErrors}
                        className="h-6.5 px-2.5 rounded-lg border-red-300 bg-white text-red-700 hover:bg-red-100 font-bold text-[10px] gap-1"
                      >
                        <Download className="h-3 w-3" />
                        Export Errors as CSV
                      </Button>
                      <Badge variant="outline" className="bg-white text-amber-800 border-amber-300 font-bold text-[10px]">
                        {validCount} will be imported
                      </Badge>
                    </div>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] text-red-700 bg-white/70 p-2 rounded-lg border border-red-100 font-medium max-h-24 overflow-y-auto">
                    {validationResults.filter(v => !v.isValid).map((v, idx) => (
                      <li key={idx}>
                        Row #{v.row.index} ({v.row.customer_name || "Row"}): <strong className="font-semibold">{v.errors.join("; ")}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="border border-slate-200/80 rounded-xl overflow-hidden max-h-[220px] overflow-y-auto bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 bg-slate-50 z-10">
                    <tr>
                      <th className="py-2 px-3 text-center">#</th>
                      <th className="py-2 px-3">CUSTOMER NAME *</th>
                      <th className="py-2 px-3">STATE *</th>
                      <th className="py-2 px-3">CONTACT</th>
                      <th className="py-2 px-3">GSTIN</th>
                      <th className="py-2 px-3">STATUS & ERROR DETAILS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {validationResults.map((v, i) => (
                      <tr
                        key={i}
                        className={!v.isValid ? "bg-red-50/40 text-red-900" : "hover:bg-slate-50/50"}
                      >
                        <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">{i + 1}</td>
                        <td className="py-2 px-3 font-semibold text-slate-900">{v.row.customer_name || <span className="text-red-500 italic">empty</span>}</td>
                        <td className="py-2 px-3 text-slate-600">{v.row.state || <span className="text-red-500 italic">empty</span>}</td>
                        <td className="py-2 px-3 text-slate-500">{v.row.contact || "empty"}</td>
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-700">{v.row.gstin || <span className="text-slate-400 italic">—</span>}</td>
                        <td className="py-2 px-3">
                          {v.isValid ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                              <Check className="h-3 w-3" /> Valid
                            </span>
                          ) : (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 text-red-600 font-bold text-[11px]">
                                <AlertCircle className="h-3.5 w-3.5 shrink-0" /> Error
                              </span>
                              <p className="text-[10px] text-red-700 font-semibold bg-red-100/80 px-1.5 py-0.5 rounded border border-red-200">
                                {v.errors.join(", ")}
                              </p>
                            </div>
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
                  Customer records have been processed and added to Customer Master.
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

              {importResponse.importedCustomerCodes && importResponse.importedCustomerCodes.length > 0 && (
                <div className="max-w-md mx-auto p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 text-left space-y-1.5">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    GENERATED CUSTOMER CODES ({importResponse.importedCustomerCodes.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto p-1">
                    {importResponse.importedCustomerCodes.map((code: string, idx: number) => (
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
          )}

          {step === 4 && importResponse && (
            <div className="flex justify-center">
              <Button
                size="sm"
                onClick={handleClose}
                className="h-8.5 px-5 rounded-xl font-bold bg-primary hover:bg-primary/90 text-white text-xs shadow-sm shadow-primary/20"
              >
                Close & Refresh Customer List
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
