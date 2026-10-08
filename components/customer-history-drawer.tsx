"use client"

import { useQuery } from "@tanstack/react-query"
import { Clock, Loader2, History, Copy, Check } from "lucide-react"
import { useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { customerApi } from "@/lib/api-service"
import { fmtDate, fmtDateTime } from "@/lib/table-format"

interface CustomerHistoryDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  section: "mailing" | "gst" | "msme" | "fssai" | null
  customerId?: number | string
  customerName?: string
}

export function CustomerHistoryDrawer({ open, onOpenChange, section, customerId, customerName }: CustomerHistoryDrawerProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const { data: historyData, isLoading } = useQuery({
    queryKey: ["customer-history-drawer", section, customerId],
    queryFn: async () => {
      if (!customerId || !section) return []
      const numId = Number(customerId)
      let res
      if (section === "mailing") res = await customerApi.getMailingHistory(numId)
      else if (section === "gst") res = await customerApi.getStructuredGstHistory(numId)
      else if (section === "msme") res = await customerApi.getMsmeHistory(numId)
      else if (section === "fssai") res = await customerApi.getFssaiHistory(numId)

      return res?.success ? (res.data || []) : []
    },
    enabled: open && !!customerId && !!section,
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  if (!section) return null

  const getSectionTitle = () => {
    if (section === "mailing") return "Mailing & Address History"
    if (section === "gst") return "GST Details History"
    if (section === "msme") return "MSME Details History"
    if (section === "fssai") return "FSSAI Details History"
    return "Effective History"
  }

  const items = historyData || []

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col bg-white">
        {/* Minimal Header */}
        <SheetHeader className="p-4 border-b border-slate-100">
          <SheetTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <History className="h-4 w-4 text-slate-500" />
            {getSectionTitle()}
          </SheetTitle>
          <SheetDescription className="text-xs text-slate-500">
            {customerName || `Customer #${customerId}`}
          </SheetDescription>
        </SheetHeader>

        {/* Minimal Content Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-slate-600" />
              <span className="text-xs">Loading history...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 border border-dashed rounded-lg">
              No previous versions recorded.
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((row: any, idx: number) => {
                const isLatest = idx === 0
                const formattedWef = row.wefDate
                  ? fmtDate(row.wefDate)
                  : 'Initial Version'

                return (
                  <div
                    key={row.id || idx}
                    className={`rounded-lg border p-3 text-xs transition-all ${
                      isLatest ? "border-emerald-200 bg-emerald-50/30" : "border-slate-200 bg-slate-50/50"
                    }`}
                  >
                    {/* Date & Badge Header */}
                    <div className="flex items-center justify-between font-medium text-slate-700 pb-2 mb-2 border-b border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        <span>Applicable From: <strong>{formattedWef}</strong></span>
                      </div>
                      {isLatest ? (
                        <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] py-0 h-5">
                          Active
                        </Badge>
                      ) : (
                        <span className="text-[10px] text-slate-400">v{items.length - idx}</span>
                      )}
                    </div>

                    {/* Minimal Field Grid */}
                    {section === "mailing" && (
                      <div className="space-y-1 text-slate-700">
                        <div><span className="text-slate-400">Address: </span>{[row.addressLine1, row.addressLine2].filter(Boolean).join(', ') || '—'}</div>
                        <div className="flex gap-4">
                          <div><span className="text-slate-400">State: </span>{row.stateName || '—'}</div>
                          <div><span className="text-slate-400">Pincode: </span>{row.pincode || '—'}</div>
                        </div>
                      </div>
                    )}

                    {section === "gst" && (
                      <div className="space-y-1 text-slate-700">
                        <div className="flex items-center justify-between">
                          <div><span className="text-slate-400">GSTIN: </span><span className="font-mono font-medium">{row.gstin || '—'}</span></div>
                          {row.gstin && (
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleCopy(row.gstin, `gst-${idx}`)}>
                              {copiedId === `gst-${idx}` ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3 text-slate-400" />}
                            </Button>
                          )}
                        </div>
                        <div><span className="text-slate-400">Registration Type: </span>{row.gstRegistrationType || 'Regular'}</div>
                      </div>
                    )}

                    {section === "msme" && (
                      <div className="space-y-1 text-slate-700">
                        <div><span className="text-slate-400">MSME No: </span><span className="font-mono font-medium">{row.msmeRegistrationNo || '—'}</span></div>
                        <div><span className="text-slate-400">Category: </span>{row.msmeRegistrationType || '—'}</div>
                      </div>
                    )}

                    {section === "fssai" && (
                      <div className="space-y-1 text-slate-700">
                        <div><span className="text-slate-400">FSSAI No: </span><span className="font-mono font-medium">{row.fssaiNo || '—'}</span></div>
                        <div className="flex gap-4">
                          <div><span className="text-slate-400">Licence: </span>{row.fssaiLicenceType || '—'}</div>
                          <div><span className="text-slate-400">Valid Upto: </span>{fmtDate(row.fssaiValidUpto)}</div>
                        </div>
                      </div>
                    )}

                    <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                      <div className="flex flex-col items-start leading-tight text-left">
                        <span>By: {row.changedByName || 'System'}</span>
                        <span className="text-[10px] text-slate-400">{fmtDateTime(row.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

