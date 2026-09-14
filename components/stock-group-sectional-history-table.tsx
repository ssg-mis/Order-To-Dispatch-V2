"use client"

import { useQuery } from "@tanstack/react-query"
import { History } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { masterHistoryApi } from "@/lib/api-service"

interface StockGroupSectionalHistoryTableProps {
  stockGroupId?: number | string
  title?: string
  onOpenView?: () => void
}

export function StockGroupSectionalHistoryTable({
  stockGroupId,
  title,
  onOpenView,
}: StockGroupSectionalHistoryTableProps) {
  const { data: historyData } = useQuery({
    queryKey: ["stock-group-sectional-history", stockGroupId],
    queryFn: async () => {
      if (!stockGroupId) return []
      const res = await masterHistoryApi.getHistory("stock_groups", Number(stockGroupId))
      return res?.success && Array.isArray(res.data) ? res.data : []
    },
    enabled: !!stockGroupId,
    staleTime: 30 * 1000,
  })

  if (!stockGroupId) return null

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
      onClick={() => onOpenView && onOpenView()}
    >
      <History className="h-3.5 w-3.5 text-blue-600" />
      <span>{title || "Stock Group History"}</span>
      <Badge
        variant="secondary"
        className="text-[10px] px-1.5 py-0 h-4 bg-blue-50 text-blue-700 font-bold border border-blue-200"
      >
        {count}
      </Badge>
    </Button>
  )
}
