"use client"

import { useQuery } from "@tanstack/react-query"
import { History } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { masterHistoryApi } from "@/lib/api-service"

type SkuSection = "basic" | "uom" | "weights" | "tax" | "depots"

// Matches the fieldName values logged by masterHistoryApi.logHistory for SKU details.
// Using both the human-readable label (what the form passes) and raw field key.
const SECTION_FIELD_NAMES: Record<SkuSection, string[]> = {
  basic: [
    "Finished Goods Name", "sku_name",
    "Status", "status",
    "Tag for Reliance", "tag_name",
    "Semi-Finished Good", "semi_finished_good_id",
    "Oil Tag", "oil_tag_id",
    "Oil Type", "oil_type_id",
    "Stock Category", "stock_category_id",
    "SKU Info",
  ],
  uom: [
    "Main UOM", "main_uom",
    "Alternate UOM", "alternate_uom",
    "Nos per Main UOM", "nos_per_main_uom",
    "Units", "units",
    "Main UOM (Ref)", "main_uom_id",
    "Alternate UOM (Ref)", "alternate_uom_id",
    "UOM & Units",
  ],
  weights: [
    "Oil Filling per Unit", "oil_filling_per_unit",
    "Filling Units", "filling_units",
    "Converted KG", "converted_kg",
    "Packing Weight per Main Unit", "packing_weight_per_main_unit",
    "Weight Difference", "weight_difference",
    "SKU Weight", "sku_weight",
    "Packing Weight", "packing_weight",
    "Gross Weight", "gross_weight",
    "Weights & Packing",
  ],
  tax: [
    "Type of Supply", "type_of_supply",
    "GST Rate", "gst_rate_id",
    "HSN Code", "hsn_code_id",
    "SAC Code", "sac_code_id",
    "UQC", "uqc_id",
    "Tax & GST",
  ],
  depots: [
    "Opening Stock", "opening_stock",
    "Depot Opening Stock", "Depot", "Godown",
  ],
}

const SECTION_LABELS: Record<SkuSection, string> = {
  basic: "Finished Goods History",
  uom: "UOM & Units History",
  weights: "Weights & Packing History",
  tax: "Tax & GST History",
  depots: "Depot Stock History",
}

interface SkuSectionalHistoryTableProps {
  section: SkuSection
  skuId?: number | string
  skuName?: string
  title?: string
  onOpenView?: (section: SkuSection) => void
}

export function SkuSectionalHistoryTable({
  section,
  skuId,
  title,
  onOpenView,
}: SkuSectionalHistoryTableProps) {
  const { data: historyData } = useQuery({
    queryKey: ["sku-sectional-history", section, skuId],
    queryFn: async () => {
      if (!skuId) return []
      const res = await masterHistoryApi.getHistory("sku_details", Number(skuId))
      if (!res?.success || !Array.isArray(res.data)) return []
      if (section === "depots") {
        return res.data.filter((h: any) => typeof h.fieldName === "string" && h.fieldName.startsWith("Opening Stock"))
      }
      const fields = SECTION_FIELD_NAMES[section]
      return res.data.filter((h: any) => fields.includes(h.fieldName))
    },
    enabled: !!skuId,
    staleTime: 30 * 1000,
  })

  if (!skuId) return null

  // Count unique change events by date
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
