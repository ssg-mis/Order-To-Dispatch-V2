"use client"

import { useQuery } from "@tanstack/react-query"
import { History } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { masterHistoryApi } from "@/lib/api-service"

type VehicleSectionType = "basic" | "weights" | "tax_compliance" | "permits" | "gps" | "documents"

const SECTION_FIELD_NAMES: Record<VehicleSectionType, string[]> = {
  basic: ["Registration No", "Vehicle Type", "Transporter", "Status", "Fuel Type", "RTO", "RTO Code", "Additional Transporters"],
  weights: ["GVW (KGS)", "ULW (KGS)", "Passing (KGS)"],
  tax_compliance: ["Road Tax Expiry", "Life Time Tax", "Pollution Expiry", "Insurance Expiry", "Fitness Expiry"],
  permits: ["State Permit Expiry", "State Permit Type", "National Permit Expiry"],
  gps: ["GPS Company", "GPS Type", "GPS API/Tracking Link", "GPS Valid Upto", "GPS Installed By"],
  documents: ["RC Image", "Road Tax Image", "Life Time Tax Image", "Pollution Image", "Insurance Image", "Fitness Image", "State Permit Image", "National Permit Image"],
}

const SECTION_LABELS: Record<VehicleSectionType, string> = {
  basic: "Basic Details History",
  weights: "Weights History",
  tax_compliance: "Tax & Compliance History",
  permits: "Permits History",
  gps: "GPS Tracking History",
  documents: "Documents History",
}

interface VehicleSectionalHistoryTableProps {
  section: VehicleSectionType
  vehicleId?: number | string
  title?: string
  onOpenView?: (section: VehicleSectionType) => void
}

export function VehicleSectionalHistoryTable({
  section,
  vehicleId,
  title,
  onOpenView,
}: VehicleSectionalHistoryTableProps) {
  const { data: historyData } = useQuery({
    queryKey: ["vehicle-sectional-history", section, vehicleId],
    queryFn: async () => {
      if (!vehicleId) return []
      const res = await masterHistoryApi.getHistory("vehicle_master", Number(vehicleId))
      if (!res?.success || !Array.isArray(res.data)) return []
      const fields = SECTION_FIELD_NAMES[section]
      return res.data.filter((h: any) => fields.includes(h.fieldName))
    },
    enabled: !!vehicleId,
    staleTime: 30 * 1000,
  })

  if (!vehicleId) return null

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
