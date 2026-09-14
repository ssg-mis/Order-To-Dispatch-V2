"use client"

import { useQuery } from "@tanstack/react-query"
import { History } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { masterHistoryApi } from "@/lib/api-service"

type PriceLevelSectionType = "header" | "items"

const SECTION_LABELS: Record<PriceLevelSectionType, string> = {
  header: "Header Details History",
  items: "Price Items History",
}

interface PriceLevelSectionalHistoryTableProps {
  section: PriceLevelSectionType
  priceLevelId?: number | string
  title?: string
  onOpenView?: (section: PriceLevelSectionType) => void
}

export function PriceLevelSectionalHistoryTable({
  section,
  priceLevelId,
  title,
  onOpenView,
}: PriceLevelSectionalHistoryTableProps) {
  const { data: historyData } = useQuery({
    queryKey: ["price-level-sectional-history", section, priceLevelId],
    queryFn: async () => {
      if (!priceLevelId) return []
      const res = await masterHistoryApi.getHistory("price_levels", Number(priceLevelId))
      if (!res?.success || !Array.isArray(res.data)) return []
      if (section === "items") {
        return res.data.filter((h: any) => typeof h.fieldName === "string" && h.fieldName.startsWith("Price - "))
      }
      return res.data.filter((h: any) => h.fieldName === "Status" || h.fieldName === "Effective Date" || h.fieldName === "Price Level Code")
    },
    enabled: !!priceLevelId,
    staleTime: 30 * 1000,
  })

  if (!priceLevelId) return null

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
