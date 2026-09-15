"use client"

import { useQuery } from "@tanstack/react-query"
import { History } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { masterHistoryApi } from "@/lib/api-service"

type RawMaterialSectionType = "basic" | "tax_compliance" | "accounting"

const SECTION_FIELD_NAMES: Record<RawMaterialSectionType, string[]> = {
  basic: ["Name", "UOM", "Stock Group", "Additional UOMs"],
  tax_compliance: ["Type of Supply", "GST Rate", "HSN Code", "SAC Code"],
  accounting: ["Default Accounting Ledger", "Status", "Batch Tracking Enabled"],
}

const SECTION_LABELS: Record<RawMaterialSectionType, string> = {
  basic: "Basic Details History",
  tax_compliance: "Tax & Compliance History",
  accounting: "Accounting & Settings History",
}

interface RawMaterialSectionalHistoryTableProps {
  section: RawMaterialSectionType
  rawMaterialId?: number | string
  title?: string
  onOpenView?: (section: RawMaterialSectionType) => void
}

export function RawMaterialSectionalHistoryTable({
  section,
  rawMaterialId,
  title,
  onOpenView,
}: RawMaterialSectionalHistoryTableProps) {
  const { data: historyData } = useQuery({
    queryKey: ["raw-material-sectional-history", section, rawMaterialId],
    queryFn: async () => {
      if (!rawMaterialId) return []
      const res = await masterHistoryApi.getHistory("raw_materials", Number(rawMaterialId))
      if (!res?.success || !Array.isArray(res.data)) return []
      const fields = SECTION_FIELD_NAMES[section]
      return res.data.filter((h: any) => fields.includes(h.fieldName))
    },
    enabled: !!rawMaterialId,
    staleTime: 30 * 1000,
  })

  if (!rawMaterialId) return null

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
