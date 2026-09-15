"use client"

import { useQuery } from "@tanstack/react-query"
import { History } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { masterHistoryApi } from "@/lib/api-service"

type TransportSectionType = "basic" | "gst" | "msme" | "fssai" | "documents"

const SECTION_FIELD_NAMES: Record<TransportSectionType, string[]> = {
  basic: ["Transporter Name", "Contact Person", "Contact Number", "Email ID", "Address", "Pincode", "Status", "Ledger Group", "Linked Customer", "Bilty Copy"],
  gst: ["State", "PAN", "GSTIN", "GST Registration Status", "GST Registration Type", "GST W.E.F. Date"],
  msme: ["MSME Registration No", "MSME Registration Type", "MSME W.E.F. Date"],
  fssai: ["FSSAI No", "FSSAI Licence Type", "FSSAI Valid Upto Date"],
  documents: ["Aadhaar Card", "PAN Card", "GST Certificate", "MSME Certificate", "FSSAI Certificate"],
}

const SECTION_LABELS: Record<TransportSectionType, string> = {
  basic: "Basic Details History",
  gst: "GST & Tax History",
  msme: "MSME History",
  fssai: "FSSAI History",
  documents: "Document Uploads History",
}

interface TransportSectionalHistoryTableProps {
  section: TransportSectionType
  transportId?: number | string
  title?: string
  onOpenView?: (section: TransportSectionType) => void
}

export function TransportSectionalHistoryTable({
  section,
  transportId,
  title,
  onOpenView,
}: TransportSectionalHistoryTableProps) {
  const { data: historyData } = useQuery({
    queryKey: ["transport-sectional-history", section, transportId],
    queryFn: async () => {
      if (!transportId) return []
      const res = await masterHistoryApi.getHistory("transport_master", Number(transportId))
      if (!res?.success || !Array.isArray(res.data)) return []
      const fields = SECTION_FIELD_NAMES[section]
      return res.data.filter((h: any) => fields.includes(h.fieldName))
    },
    enabled: !!transportId,
    staleTime: 30 * 1000,
  })

  if (!transportId) return null

  const uniqueVersionDates = new Set(
    (historyData || []).map((h: any) => {
      const rawDateStr = h.applicableFrom || h.createdAt
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
      <span>{title || SECTION_LABELS[section]}</span>
      <Badge
        variant="secondary"
        className="text-[10px] px-1.5 py-0 h-4 bg-blue-50 text-blue-700 font-bold border border-blue-200"
      >
        {count}
      </Badge>
    </Button>
  )
}
