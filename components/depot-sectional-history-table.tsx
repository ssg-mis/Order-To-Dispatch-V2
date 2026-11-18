"use client"

import { useQuery } from "@tanstack/react-query"
import { History } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { masterHistoryApi } from "@/lib/api-service"

interface SectionalHistoryTableProps {
  section: "basic" | "tags" | "assigned" | "documents"
  depotId?: number | string
  depotName?: string
  title?: string
  onOpenView?: (section: "basic" | "tags" | "assigned" | "documents") => void
}

export function DepotSectionalHistoryTable({ section, depotId, title, onOpenView }: SectionalHistoryTableProps) {
  const { data: historyData } = useQuery({
    queryKey: ["depot-sectional-history", section, depotId],
    queryFn: async () => {
      if (!depotId) return []
      const numId = Number(depotId)
      const res = await masterHistoryApi.getHistory("depots", numId)
      if (res?.success && Array.isArray(res.data)) {
        if (section === "basic") {
          return res.data.filter((h: any) =>
            [
              "depot_id", "Depot ID", "Depot Id", "depotCode", "Depot Code",
              "depot_name", "Depot Name",
              "status", "Status",
              "state", "State", "state_id", "State Id",
              "depot_address", "Depot Address",
              "district", "District", "sub_district", "Sub-District", "thana", "Thana", "post", "Post", "city", "City", "pincode", "Pincode",
              "salesman_broker_name", "Salesman/Broker Name", "Salesman Broker Name",
              "Depot Info", "Depot Details"
            ].includes(h.fieldName)
          )
        }
else if (section === "assigned") {
          return res.data.filter((h: any) => h.fieldName === "Assigned To" || h.fieldName === "assigned_to")
        } else if (section === "tags") {
          return res.data.filter((h: any) =>
            h.fieldName === "Salesman / Broker Tags" ||
            h.fieldName === "Salesperson / Broker Tags" ||
            h.fieldName === "agent_tags"
          )
        } else if (section === "documents") {
          return res.data.filter((h: any) =>
            [
              "agreement_paper_upload", "Agreement Paper Upload", "Agreement Paper",
              "depot_owner_gst_certificate_upload", "Depot Owner Gst Certificate Upload", "Depot Owner GST Certificate Upload", "Depot Owner GST Certificate",
              "pan_card_upload", "Pan Card Upload", "PAN Card Upload", "PAN Card",
              "aadhaar_card_upload", "Aadhaar Card Upload", "Aadhaar Card",
              "Document Uploads"
            ].includes(h.fieldName)
          )
        }

        return res.data
      }
      return []
    },
    enabled: !!depotId,
    staleTime: 30 * 1000,
  })

  if (!depotId) return null
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
            ? "Depot History"
            : section === "tags"
            ? "Salesman / Broker Tags History"
            : section === "assigned"
            ? "Assigned To History"
            : "Document Uploads History")}
      </span>
      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-blue-50 text-blue-700 font-bold border border-blue-200">
        {count}
      </Badge>
    </Button>
  )
}
