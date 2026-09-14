"use client"

import { useQuery } from "@tanstack/react-query"
import { History } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { masterHistoryApi } from "@/lib/api-service"

interface SectionalHistoryTableProps {
  section: "basic" | "gst" | "msme" | "fssai" | "documents"
  petrolPumpId?: number | string
  petrolPumpName?: string
  title?: string
  onOpenView?: (section: "basic" | "gst" | "msme" | "fssai" | "documents") => void
}

export function PetrolPumpSectionalHistoryTable({ section, petrolPumpId, title, onOpenView }: SectionalHistoryTableProps) {
  const { data: historyData } = useQuery({
    queryKey: ["petrol-pump-sectional-history", section, petrolPumpId],
    queryFn: async () => {
      if (!petrolPumpId) return []
      const numId = Number(petrolPumpId)
      const res = await masterHistoryApi.getHistory("petrol_pumps", numId)
      if (res?.success && Array.isArray(res.data)) {
        if (section === "basic") {
          return res.data.filter((h: any) =>
            [
              "petrol_pump_name", "Petrol Pump Name", "Name",
              "status", "Status",
              "mobile_no", "Mobile Number", "Mobile No",
              "email_id", "Email ID", "Email Id",
              "ledger_group_id", "Ledger Group",
              "Petrol Pump Info", "Petrol Pump Details"
            ].includes(h.fieldName)
          )
        } else if (section === "gst") {
          return res.data.filter((h: any) =>
            [
              "state", "State", "state_id", "State Id",
              "pan", "PAN", "PAN No",
              "gstin", "GSTIN", "GST No",
              "gst_registered", "GST Registered",
              "gst_registration_type", "GST Registration Type",
              "gst_registration_wef", "GST Registration W.E.F",
              "GST / Statutory Details", "GST Details"
            ].includes(h.fieldName)
          )
        } else if (section === "msme") {
          return res.data.filter((h: any) =>
            [
              "msme_registration_no", "MSME Registration No",
              "msme_registration_type", "MSME Registration Type",
              "msme_registration_wef", "MSME Registration W.E.F",
              "MSME Details"
            ].includes(h.fieldName)
          )
        } else if (section === "fssai") {
          return res.data.filter((h: any) =>
            [
              "fssai_no", "FSSAI No",
              "fssai_valid_upto", "FSSAI Valid Upto",
              "fssai_licence_type", "FSSAI Licence Type",
              "FSSAI Details"
            ].includes(h.fieldName)
          )
        } else if (section === "documents") {
          return res.data.filter((h: any) =>
            [
              "aadhaar_upload", "Aadhaar Card Upload", "Aadhaar Card",
              "pan_upload", "PAN Card Upload", "PAN Card",
              "gst_certificate_upload", "GST Certificate Upload", "GST Certificate",
              "msme_certificate_upload", "MSME Certificate Upload", "MSME Certificate",
              "fssai_certificate_upload", "FSSAI Certificate Upload", "FSSAI Certificate",
              "Document Uploads"
            ].includes(h.fieldName)
          )
        }
        return res.data
      }
      return []
    },
    enabled: !!petrolPumpId,
    staleTime: 30 * 1000,
  })

  if (!petrolPumpId) return null
  const uniqueVersionDates = new Set(
    (historyData || []).map((h: any) => {
      const rawDateStr = h.applicableFrom || h.wef_date || h.wefDate || h.createdAt
      if (!rawDateStr) return "unknown"
      if (typeof rawDateStr === "string" && /^\d{4}-\d{2}-\d{2}/.test(rawDateStr)) {
        return rawDateStr.slice(0, 10)
      }
      const d = new Date(rawDateStr)
      return !isNaN(d.getTime())
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
        : String(rawDateStr).slice(0, 10)
    })
  )
  const count = uniqueVersionDates.size

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 px-2.5 text-xs font-semibold border-slate-300 hover:bg-slate-100 text-slate-700 flex items-center gap-1.5 shadow-2xs transition-colors"
      onClick={() => onOpenView && onOpenView(section)}
    >
      <History className="h-3.5 w-3.5 text-blue-600" />
      <span>
        {title ||
          (section === "basic"
            ? "Petrol Pump History"
            : section === "gst"
            ? "GST History"
            : section === "msme"
            ? "MSME History"
            : section === "fssai"
            ? "FSSAI History"
            : "Document Uploads History")}
      </span>
      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-blue-50 text-blue-700 font-bold border border-blue-200">
        {count}
      </Badge>
    </Button>
  )
}
