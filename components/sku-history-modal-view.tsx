"use client"

import {useState, useMemo, useEffect} from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Loader2,
  X,
  Package,
  ExternalLink,
  Edit,
  Trash2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { masterHistoryApi } from "@/lib/api-service"
import { useToast } from "@/hooks/use-toast"
import { fmtDate, fmtDateTime, fmtHistoryAmount } from "@/lib/table-format"
import { fmtHistoryWeight } from "@/lib/weight-col"
import { getWeightDecimals } from "@/lib/weight-format"
import { useWeightDecimals } from "@/hooks/use-weight-decimals"

// Display-only: render ISO date strings as dd/mm/yyyy (raw values are untouched elsewhere).
const displayVal = (v: any, fieldName?: string): any =>
  fmtHistoryWeight(fieldName, v, getWeightDecimals()) ??
  fmtHistoryAmount(fieldName, v) ??
  (typeof v === "string" && /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/.test(v.trim()) ? fmtDate(v.trim()) : v)

interface SkuHistoryModalViewProps {
  skuId: number
  skuName: string
  initialSection?: "basic" | "uom" | "weights" | "tax" | "depots"
  onBack: () => void
}

export function SkuHistoryModalView({
  skuId,
  skuName,
  initialSection = "basic",
  onBack,
}: SkuHistoryModalViewProps) {
  useWeightDecimals() // re-render when the KG decimals load from the Units Master

  // Scroll to top on mount for history view
  useEffect(() => {
    const container = document.querySelector('[data-slot="dialog-content"]') || document.querySelector('.overflow-y-auto');
    if (container) {
      setTimeout(() => { container.scrollTop = 0; }, 10);
    }
  }, []);

  const queryClient = useQueryClient()
  const { toast } = useToast()

  const getTodayStr = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  }

  const [activeSection, setActiveSection] = useState<"basic" | "uom" | "weights" | "tax" | "depots">(initialSection)
  const [isAdding, setIsAdding] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [newVersionForm, setNewVersionForm] = useState<Record<string, any>>({
    wefDate: getTodayStr(),
  })

  const { data: historyData, isLoading, refetch } = useQuery({
    queryKey: ["sku-history-modal", skuId],
    queryFn: async () => {
      if (!skuId) return []
      const res = await masterHistoryApi.getHistory("sku_details", skuId)
      if (res?.success && Array.isArray(res.data)) {
        return res.data.map((item: any) => ({
          ...item,
          wefDate: item.applicableFrom || item.wef_date || item.createdAt,
        }))
      }
      return []
    },
    enabled: !!skuId,
    staleTime: 0,
    refetchOnMount: "always",
  })

  const sectionFields: Record<string, string[]> = {
    basic: ["Sku Name", "Status", "Tag Name", "Tag for Reliance"],
    uom: ["Main Uom", "Alternate Uom", "Nos Per Main Uom", "Units", "Main Uom Id", "Alternate Uom Id"],
    weights: ["Semi Finished Good Id", "Oil Tag Id", "Oil Filling Per Unit", "Filling Units", "Converted Kg", "Packing Weight Per Main Unit", "Weight Difference", "Sku Weight", "Packing Weight", "Gross Weight"],
    tax: ["Stock Category Id", "Type Of Supply", "Gst Rate Id", "Hsn Code Id", "Sac Code Id", "Uqc Id"],
    depots: ["Depot", "Opening Stock", "Godown"],
  }
  const rawItems = (historyData || []).filter((item: any) => {
    if (activeSection === "basic") return sectionFields.basic.includes(item.fieldName) || item.fieldName === "SKU Info"
    const names = sectionFields[activeSection] || []
    return names.some(name => item.fieldName === name || item.fieldName.toLowerCase() === name.toLowerCase())
  })
  const sectionTitles = {
    basic: "Finished Goods Basic Details",
    uom: "UOM & Units Details",
    weights: "Weights & Filling Details",
    tax: "Tax & Classification Details",
    depots: "Depot Opening Stock Details",
  }

  // Group changes by their effective date (applicableFrom / wef_date / createdAt)
  const groupedVersions = useMemo(() => {
    if (rawItems.length === 0) return []

    const dateMap = new Map<string, any>()

    const sorted = [...rawItems].sort((a: any, b: any) => {
      const dateA = new Date(a.wefDate || 0).getTime()
      const dateB = new Date(b.wefDate || 0).getTime()
      if (dateA !== dateB) return dateA - dateB
      return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
    })

    for (const item of sorted) {
      const rawDateStr = item.wefDate
      let key = "unknown"
      if (rawDateStr) {
        if (typeof rawDateStr === "string" && /^\d{4}-\d{2}-\d{2}/.test(rawDateStr)) {
          key = rawDateStr.slice(0, 10)
        } else {
          const d = new Date(rawDateStr)
          key = !isNaN(d.getTime())
            ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
            : String(rawDateStr).slice(0, 10)
        }
      }

      if (!dateMap.has(key)) {
        dateMap.set(key, {
          wefDate: key,
          changedByName: item.changedByName || item.changedBy || "Admin",
          approvedByName: item.approvedByName || null,
          approvedAt: item.approvedAt || null,
          changedAt: item.createdAt || item.updatedAt || item.changedAt,
          changes: [],
          ids: [],
        })
      }

      const entry = dateMap.get(key)
      if (item.id && !entry.ids.includes(item.id)) {
        entry.ids.push(item.id)
      }
      if (item.fieldName) {
        entry.changes.push({
          id: item.id,
          fieldName: item.fieldName,
          oldValue: item.oldValue,
          newValue: item.newValue,
          changedByName: item.changedByName || item.changedBy || "Admin",
        })
        if (item.changedByName) entry.changedByName = item.changedByName
        if (item.approvedByName) { entry.approvedByName = item.approvedByName; entry.approvedAt = item.approvedAt }
        { const ts = item.createdAt || item.updatedAt || item.changedAt; if (ts) entry.changedAt = ts }
      }
    }

    const rows = Array.from(dateMap.values())
    rows.sort((a: any, b: any) => new Date(b.wefDate).getTime() - new Date(a.wefDate).getTime())
    return rows
  }, [rawItems])

  const todayStr = getTodayStr()

  const handleSaveNewVersion = async () => {
    if (!skuId) return
    if (!newVersionForm.wefDate) {
      toast({ title: "Validation Error", description: "Applicable From Date (W.E.F.) is required", variant: "destructive" })
      return
    }

    try {
      setIsSaving(true)
      const changeKey = activeSection === "basic" ? "Sku Name" : activeSection === "uom" ? "Main Uom" : activeSection === "weights" ? "Oil Filling Per Unit" : activeSection === "tax" ? "Type Of Supply" : "Depot"
      const changeValue = newVersionForm.value || newVersionForm.wefDate

      await (masterHistoryApi as any).logHistory({
        masterType: "sku_details",
        recordId: skuId,
        fieldName: changeKey,
        oldValue: "—",
        newValue: String(changeValue),
        applicableFrom: newVersionForm.wefDate,
      })

      toast({
        title: "Version Added Successfully",
        description: `New ${activeSection.toUpperCase()} effective version logged with W.E.F. date ${newVersionForm.wefDate}`,
      })
      setIsAdding(false)
      setNewVersionForm({ wefDate: getTodayStr() })
      await queryClient.invalidateQueries({ queryKey: ["sku-history-modal", skuId] })
      await queryClient.invalidateQueries({ queryKey: ["sku-sectional-history"] })
      refetch()
    } catch (err: any) {
      toast({
        title: "Failed to Save Version",
        description: err.message || "Something went wrong",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr === "unknown") return "—"
    const [y, m, d] = dateStr.split("-")
    return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`
  }

  const renderFileLink = (url: string | null) => {
    if (!url || url === "—") return <span className="text-slate-400">—</span>
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-800 underline text-[11px]"
      >
        <span>View File</span>
        <ExternalLink className="h-3 w-3" />
      </a>
    )
  }

  const handleDeleteVersion = async (ids: number[]) => {
    if (!confirm("Delete this version? This action cannot be undone.")) return
    if (ids.length === 0) {
      toast({ title: "Removed", description: "Version removed." })
      await refetch()
      return
    }
    try {
      for (const id of ids) {
        await masterHistoryApi.deleteHistory(id)
      }
      toast({ title: "Success", description: "Version deleted successfully." })
      await queryClient.invalidateQueries({ queryKey: ["sku-history-modal", skuId] })
      await queryClient.invalidateQueries({ queryKey: ["sku-sectional-history"] })
      await refetch()
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to delete version.", variant: "destructive" })
    }
  }

  const isUrl = (val: string) => typeof val === "string" && (val.startsWith("http://") || val.startsWith("https://"))

  return (
    <div className="w-full min-w-0 max-w-full pb-8 space-y-4 text-slate-800">
      {/* Back Button */}
      <div className="sticky -top-6 z-10 -mx-6 -mt-6 space-y-4 border-b border-slate-200 bg-background px-6 pb-4 pt-2">
      <div className="flex items-center justify-between [&>button]:bg-white [&>button]:shadow-sm">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="text-slate-600 hover:text-slate-900 flex items-center gap-1.5 font-semibold text-xs h-8 px-2"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Finished Good Form
        </Button>
      </div>

      {/* Header */}
      <div className="border-b pb-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-600" />
          Effective-Date Versions & History
        </h2>
        <p className="text-xs text-slate-500 font-medium mt-0.5">
          Finished Good: <span className="font-bold text-slate-800">{skuName || `#${skuId}`}</span>
        </p>
      </div>

      {/* Section Navigation Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b pb-2">
        <button
          type="button"
          onClick={() => { setActiveSection("basic"); setIsAdding(false) }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeSection === "basic"
              ? "bg-blue-600 text-white shadow-xs"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Package className="h-3.5 w-3.5" />
          Basic Details
        </button>

        <button
          type="button"
          onClick={() => { setActiveSection("uom"); setIsAdding(false) }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeSection === "uom"
              ? "bg-blue-600 text-white shadow-xs"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          UOM & Units
        </button>

        <button
          type="button"
          onClick={() => { setActiveSection("weights"); setIsAdding(false) }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeSection === "weights"
              ? "bg-blue-600 text-white shadow-xs"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          Weights & Filling
        </button>

        <button
          type="button"
          onClick={() => { setActiveSection("tax"); setIsAdding(false) }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeSection === "tax"
              ? "bg-blue-600 text-white shadow-xs"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          Tax & Compliance
        </button>

        <button
          type="button"
          onClick={() => { setActiveSection("depots"); setIsAdding(false) }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeSection === "depots"
              ? "bg-blue-600 text-white shadow-xs"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          Depot Stocks
        </button>
      </div>
      </div>

      {/* Action Bar */}
      <div className="mb-4 flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200">
        <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
          <Package className="h-3.5 w-3.5 text-blue-600" />
          {sectionTitles[activeSection]}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] bg-white text-slate-700 border-slate-300">
            {groupedVersions.length} {groupedVersions.length === 1 ? "Version" : "Versions"}
          </Badge>
          <Button
            type="button"
            size="sm"
            className="h-7 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1"
            onClick={() => setIsAdding(!isAdding)}
          >
            {isAdding ? "Cancel" : "+ Add Effective Version"}
          </Button>
        </div>
      </div>

      {/* Add New Effective Version Form Card */}
      {isAdding && (
        <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-4 space-y-3">
          <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider">
            Create New Effective Version ({activeSection.toUpperCase()})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Applicable From (W.E.F. Date) *</label>
              <input
                type="date"
                value={newVersionForm.wefDate || ""}
                onChange={(e) => setNewVersionForm(prev => ({ ...prev, wefDate: e.target.value }))}
                className="w-full h-8 px-2.5 text-xs bg-white border border-slate-300 rounded-md font-medium"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Version Change Details / Notes</label>
              <input
                type="text"
                placeholder="Enter version change description"
                value={newVersionForm.value || ""}
                onChange={(e) => setNewVersionForm(prev => ({ ...prev, value: e.target.value }))}
                className="w-full h-8 px-2.5 text-xs bg-white border border-slate-300 rounded-md font-medium"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs font-semibold"
              onClick={() => setIsAdding(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isSaving}
              className="h-7 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleSaveNewVersion}
            >
              {isSaving ? "Saving..." : "Save Effective Version"}
            </Button>
          </div>
        </div>
      )}

      {/* History Table */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[240px] text-xs text-slate-400 gap-2 bg-white rounded-lg border border-slate-200">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          <span>Loading history...</span>
        </div>
      ) : groupedVersions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400 bg-white min-h-[240px] flex items-center justify-center">
          <div>
            No effective-dated versions recorded yet for this section.
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {groupedVersions.map((version: any, vIdx: number) => {
            const isFuture = version.wefDate > todayStr
            const isActive = vIdx === 0 && !isFuture

            return (
              <div
                key={version.wefDate}
                className={`rounded-xl border shadow-xs overflow-hidden ${
                  isActive
                    ? "border-emerald-300 bg-emerald-50/30"
                    : isFuture
                    ? "border-amber-200 bg-amber-50/20"
                    : "border-slate-200 bg-white"
                }`}
              >
                {/* Version Header */}
                <div
                  className={`flex items-center justify-between px-4 py-2.5 border-b ${
                    isActive
                      ? "bg-emerald-100/60 border-emerald-200"
                      : isFuture
                      ? "bg-amber-100/50 border-amber-200"
                      : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Calendar
                      className={`h-3.5 w-3.5 ${
                        isActive ? "text-emerald-600" : isFuture ? "text-amber-600" : "text-slate-500"
                      }`}
                    />
                    <span className="font-bold text-sm text-slate-900">
                      {formatDate(version.wefDate)}
                    </span>
                    {isActive && (
                      <Badge className="bg-emerald-600 text-white text-[9px] px-1.5 py-0 uppercase font-bold">
                        Active
                      </Badge>
                    )}
                    {isFuture && (
                      <Badge className="bg-amber-500 text-white text-[9px] px-1.5 py-0 uppercase font-bold">
                        Scheduled
                      </Badge>
                    )}
                    <span className="text-[11px] text-slate-500 flex items-center gap-1 ml-1 text-left">
                      <User className="h-3 w-3 shrink-0" />
                      <span className="flex flex-col leading-tight">
                        <span>{version.changedByName || "Admin"}</span>
                        <span className="text-[10px] text-slate-400">{fmtDateTime(version.changedAt)}</span>
                      </span>
                    </span>
                    <span className="text-[11px] text-slate-500 flex items-center gap-1 ml-3 text-left border-l border-slate-300 pl-3">
                      <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Approved By</span>
                      {version.approvedByName ? (
                        <span className="flex flex-col leading-tight">
                          <span>{version.approvedByName}</span>
                          {version.approvedAt && (
                            <span className="text-[10px] text-slate-400">{fmtDateTime(version.approvedAt)}</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-[10px] text-slate-600 border-slate-300 bg-white">
                      {version.changes.length} {version.changes.length === 1 ? "change" : "changes"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      onClick={() => handleDeleteVersion(version.ids)}
                      title="Delete this version"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Changes Table */}
                {version.changes.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-semibold">
                          <th className="py-2 px-4 w-1/3">Field Changed</th>
                          <th className="py-2 px-4 w-1/3">Old Value</th>
                          <th className="py-2 px-4 w-1/3 text-emerald-800">New Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {version.changes.map((change: any, cIdx: number) => {
                          const oldIsUrl = isUrl(change.oldValue)
                          const newIsUrl = isUrl(change.newValue)
                          return (
                            <tr key={cIdx} className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-2 px-4 font-semibold text-slate-800">
                                {change.fieldName || "—"}
                              </td>
                              <td className="py-2 px-4 text-slate-500">
                                {oldIsUrl
                                  ? renderFileLink(change.oldValue)
                                  : displayVal(change.oldValue, change.fieldName) || <span className="text-slate-300">—</span>}
                              </td>
                              <td className="py-2 px-4 font-semibold text-emerald-700 bg-emerald-50/40">
                                {newIsUrl
                                  ? renderFileLink(change.newValue)
                                  : displayVal(change.newValue, change.fieldName) || <span className="text-slate-300">—</span>}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="px-4 py-3 text-xs text-slate-400 italic">
                    No field changes recorded for this version.
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
