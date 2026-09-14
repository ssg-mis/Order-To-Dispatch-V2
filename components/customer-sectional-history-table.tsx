"use client"

import { useQuery } from "@tanstack/react-query"
import { History } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { customerApi, masterHistoryApi } from "@/lib/api-service"

interface SectionalHistoryTableProps {
  section: "basic" | "mailing" | "gst" | "msme" | "fssai" | "godown" | "bank" | "ledger" | "documents"
  customerId?: number | string
  customerName?: string
  title?: string
  onOpenView?: (section: "basic" | "mailing" | "gst" | "msme" | "fssai" | "godown" | "bank" | "ledger" | "documents") => void
}

export function CustomerSectionalHistoryTable({ section, customerId, title, onOpenView }: SectionalHistoryTableProps) {
  const { data: historyData } = useQuery({
    queryKey: ["customer-sectional-history", section, customerId],
    queryFn: async () => {
      if (!customerId) return []
      const numId = Number(customerId)
      let res
      if (section === "basic") {
        res = await masterHistoryApi.getHistory("customers", numId)
        if (res?.success && Array.isArray(res.data)) {
          return res.data.filter((h: any) =>
            ["customer_name", "status", "email", "contact_person", "contact"].includes(h.fieldName)
          )
        }
        return []
      }
      else if (section === "mailing") res = await customerApi.getMailingHistory(numId)
      else if (section === "gst") res = await customerApi.getStructuredGstHistory(numId)
      else if (section === "msme") res = await customerApi.getMsmeHistory(numId)
      else if (section === "fssai") res = await customerApi.getFssaiHistory(numId)
      else {
        res = await masterHistoryApi.getHistory("customers", numId)
        if (res?.success && Array.isArray(res.data)) {
          if (section === "godown") {
            return res.data.filter((h: any) => h.fieldName === "Belongs to Godown" || h.fieldName === "godown_ids")
          } else if (section === "bank") {
            return res.data.filter((h: any) => h.fieldName === "Bank Accounts" || h.fieldName === "bank_accounts")
          } else if (section === "ledger") {
            return res.data.filter((h: any) => h.fieldName === "Ledger Group ID" || h.fieldName === "ledger_group_id")
          } else if (section === "documents") {
            return res.data.filter((h: any) =>
              ["gst_certificate_upload", "msme_certificate_upload", "fssai_certificate_upload", "aadhaar_upload", "pan_upload", "Document Uploads"].includes(h.fieldName)
            )
          }
          return res.data
        }
        return []
      }

      return res?.success ? (res.data || []) : []
    },
    enabled: !!customerId,
    staleTime: 30 * 1000,
  })

  if (!customerId) return null
  const uniqueVersionDates = new Set(
    (historyData || []).map((h: any) => {
      const rawDateStr = h.applicableFrom || h.wef_date || h.wefDate || h.effective_from || h.createdAt
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
          (section === "mailing"
            ? "Mailing History"
            : section === "gst"
            ? "GST History"
            : section === "msme"
            ? "MSME History"
            : section === "fssai"
            ? "FSSAI History"
            : section === "godown"
            ? "Godowns History"
            : section === "bank"
            ? "Bank Details History"
            : section === "ledger"
            ? "Ledger Group History"
            : "Document Uploads History")}
      </span>
      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-blue-50 text-blue-700 font-bold border border-blue-200">
        {count}
      </Badge>
    </Button>
  )
}

