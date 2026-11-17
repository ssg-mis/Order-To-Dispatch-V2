"use client"

import {useState, useMemo, useEffect, useRef} from "react"
import { fmtDate, fmtDateTime, fmtHistoryAmount } from "@/lib/table-format"
import { fmtHistoryWeight } from "@/lib/weight-col"
import { getWeightDecimals } from "@/lib/weight-format"
import { useWeightDecimals } from "@/hooks/use-weight-decimals"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Loader2,
  Tag,
  Plus,
  Save,
  X,
  Trash2,
  Edit,
  Lock,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { masterHistoryApi, skuSellingPriceApi } from "@/lib/api-service"
import { useToast } from "@/hooks/use-toast"
import { calculateSkuSellingPriceDerived } from "@/lib/utils"

// Every user-editable field on the form gets its own dedicated table column -
// mirrors Customer/SKU/Price Level Master's per-field history columns. This
// form has no natural sub-sections (unlike Customer/SKU), so it's treated as
// one flat section, same as the "single section" pattern used elsewhere.
const DEDICATED_COLUMNS = [
  "Packing Material",
  "SKU Unit",
  "SKU Weight",
  "Conversion Formula",
  "SKU Weight (gm)",
  "Packing Material Weight (gm)",
  "Packing Cost",
  "Var",
  "Margin",
  "Landing Cost",
  "Actual Margin",
  "Selling Cost",
  "Status",
]

const FIELD_LABEL_TO_KEY: Record<string, string> = {
  "Packing Material": "packing_material",
  "SKU Unit": "sku_unit",
  "SKU Weight": "sku_weight",
  "Conversion Formula": "conversion_formula",
  "SKU Weight (gm)": "sku_weight_in_gm",
  "Packing Material Weight (gm)": "packing_material_weight_in_gm",
  "Packing Cost": "packing_cost",
  "Var": "var",
  "Margin": "margin",
  "Landing Cost": "landing_cost",
  "Actual Margin": "actual_margin",
  "Selling Cost": "selling_cost",
  "Status": "status",
}

interface SkuSellingPriceEffectiveDatesModalViewProps {
  skuSellingPriceId: number
  packingMaterial: string
  skuSellingPriceForm?: Record<string, any>
  targetFieldName?: string
  gt?: number
  onBack: () => void
  onSkuSellingPriceUpdated?: (data: any) => void
}

export function SkuSellingPriceEffectiveDatesModalView({
  skuSellingPriceId,
  packingMaterial,
  skuSellingPriceForm = {},
  targetFieldName,
  gt = 0,
  onBack,
  onSkuSellingPriceUpdated,
}: SkuSellingPriceEffectiveDatesModalViewProps) {
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

  const [isAdding, setIsAdding] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  // Tracks the version currently loaded via "Edit" (its row ids + original
  // W.E.F date) so that saving under a CHANGED date can delete the original
  // rows instead of leaving a stale duplicate version behind at the old date.
  const [editingVersion, setEditingVersion] = useState<{ ids: number[]; wefDate: string } | null>(null)
  const wefDateInputRef = useRef<HTMLInputElement | null>(null)

  const getInitialFormState = () => ({
    wefDate: getTodayStr(),
    packing_material: skuSellingPriceForm.packing_material || "",
    sku_unit: skuSellingPriceForm.sku_unit || "",
    sku_weight: skuSellingPriceForm.sku_weight ?? "",
    conversion_formula: skuSellingPriceForm.conversion_formula ?? "",
    sku_weight_in_gm: skuSellingPriceForm.sku_weight_in_gm ?? "",
    packing_material_weight_in_gm: skuSellingPriceForm.packing_material_weight_in_gm ?? "",
    packing_cost: skuSellingPriceForm.packing_cost ?? "",
    var: skuSellingPriceForm.var ?? "",
    margin: skuSellingPriceForm.margin ?? "",
    landing_cost: skuSellingPriceForm.landing_cost ?? "",
    actual_margin: skuSellingPriceForm.actual_margin ?? "",
    selling_cost: skuSellingPriceForm.selling_cost ?? "",
    status: skuSellingPriceForm.status || "Active",
  })

  const [newVersionForm, setNewVersionForm] = useState<Record<string, any>>(getInitialFormState())

  useEffect(() => {
    setNewVersionForm(getInitialFormState())
  }, [skuSellingPriceForm])

  useEffect(() => {
    if (isAdding && wefDateInputRef.current) {
      setTimeout(() => {
        wefDateInputRef.current?.focus()
      }, 100)
    }
  }, [isAdding])

  const { data: historyData, isLoading, refetch } = useQuery({
    queryKey: ["sku-selling-price-history-modal", skuSellingPriceId],
    queryFn: async () => {
      if (!skuSellingPriceId) return []
      const res = await masterHistoryApi.getHistory("sku_selling_price", skuSellingPriceId)
      if (res?.success && Array.isArray(res.data)) {
        return res.data.map((item: any) => ({
          ...item,
          wefDate: item.applicableFrom || item.wef_date || item.createdAt,
        }))
      }
      return []
    },
    enabled: !!skuSellingPriceId,
    staleTime: 0,
    refetchOnMount: "always",
  })

  const getSnapshotValue = (version: any, fieldName: string): string => {
    return version.snapshot?.[fieldName] ?? "—"
  }

  const rawItems = (historyData || []).filter((item: any) => DEDICATED_COLUMNS.includes(item.fieldName))

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
          changedByName: item.changedByName || item.changedBy || "Admin", approvedByName: item.approvedByName || null, approvedAt: item.approvedAt || null,
          changedAt: null,
          changes: [],
          ids: [],
        })
      }

      const entry = dateMap.get(key)
      entry.changedAt = item.createdAt || item.updatedAt || item.changedAt || entry.changedAt
      if (item.id && !entry.ids.includes(item.id)) {
        entry.ids.push(item.id)
      }
      if (item.fieldName) {
        entry.changes.push({
          id: item.id,
          fieldName: item.fieldName,
          oldValue: item.oldValue,
          newValue: item.newValue,
          changedByName: item.changedByName || item.changedBy || "Admin", approvedByName: item.approvedByName || null, approvedAt: item.approvedAt || null,
        })
        if (item.changedByName) entry.changedByName = item.changedByName
        if (item.approvedByName) { entry.approvedByName = item.approvedByName; entry.approvedAt = item.approvedAt }
      }
    }

    const rows = Array.from(dateMap.values())
    const fieldSnapshot: Record<string, string> = {}
    for (const row of rows) {
      for (const change of row.changes) {
        fieldSnapshot[change.fieldName] = change.newValue || "—"
      }
      row.snapshot = { ...fieldSnapshot }
    }

    rows.sort((a: any, b: any) => new Date(b.wefDate).getTime() - new Date(a.wefDate).getTime())
    return rows
  }, [rawItems])

  const activeRecordId = useMemo(() => {
    if (!groupedVersions || groupedVersions.length === 0) return null
    const todayStr = getTodayStr()
    const activeItem = groupedVersions.find((item: any) => item.wefDate <= todayStr)
    return activeItem ? activeItem.wefDate : groupedVersions[groupedVersions.length - 1]?.wefDate
  }, [groupedVersions])

  const handleSaveNewVersion = async () => {
    if (!skuSellingPriceId) return
    if (!newVersionForm.wefDate) {
      toast({ title: "Validation Error", description: "Applicable From Date (W.E.F.) is required", variant: "destructive" })
      return
    }

    try {
      setIsSaving(true)

      // Always log every field (not just the ones that changed) so each W.E.F
      // version carries a complete snapshot - otherwise the history table shows
      // "—" for fields that were already correct and simply weren't touched.
      const logEntries = DEDICATED_COLUMNS.map((label) => {
        const key = FIELD_LABEL_TO_KEY[label]
        return {
          fieldName: label,
          oldValue: skuSellingPriceForm[key] ?? "—",
          newValue: newVersionForm[key] ?? "—",
        }
      })

      for (const entry of logEntries) {
        await masterHistoryApi.logHistory({
          masterType: "sku_selling_price",
          recordId: skuSellingPriceId,
          fieldName: entry.fieldName,
          oldValue: String(entry.oldValue),
          newValue: String(entry.newValue),
          applicableFrom: newVersionForm.wefDate,
        })
      }

      // If this version is effective today or in the past, apply it to the live
      // record now (same rule Customer/SKU/Price Level Master's use) - otherwise
      // saving a version only ever logs history and the record itself never updates.
      const todayStr = getTodayStr()
      if (newVersionForm.wefDate <= todayStr) {
        const payload = { ...newVersionForm }
        delete payload.wefDate
        await skuSellingPriceApi.update(skuSellingPriceId, payload)

        if (onSkuSellingPriceUpdated) {
          onSkuSellingPriceUpdated({ ...skuSellingPriceForm, ...payload })
        }
        await queryClient.invalidateQueries({ queryKey: ["master-sku-selling-price"] })
      }

      toast({
        title: "Effective Version Saved",
        description: `New Pricing version logged with W.E.F. date ${newVersionForm.wefDate}`,
      })

      // If this save was editing an existing version (via "Edit") and its
      // W.E.F date was changed, the fields were just re-logged under the NEW
      // date above - delete the original rows at the OLD date so the version
      // "moves" instead of leaving a stale duplicate behind at the old date.
      if (editingVersion && editingVersion.wefDate !== newVersionForm.wefDate && editingVersion.ids.length > 0) {
        for (const oldId of editingVersion.ids) {
          await masterHistoryApi.deleteHistory(oldId)
        }
      }
      setEditingVersion(null)

      setIsAdding(false)
      await queryClient.invalidateQueries({ queryKey: ["sku-selling-price-history-modal", skuSellingPriceId] })
      await queryClient.invalidateQueries({ queryKey: ["sku-selling-price-sectional-history"] })
      await refetch()
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

  const handleEditVersion = (version: any) => {
    const base = getInitialFormState()
    const overrides: Record<string, any> = {}
    const snap = version.snapshot || {}

    Object.entries(FIELD_LABEL_TO_KEY).forEach(([label, key]) => {
      if (snap[label] !== undefined && snap[label] !== "—") overrides[key] = snap[label]
    })

    setNewVersionForm({ ...base, ...overrides, wefDate: version.wefDate })
    setEditingVersion({ ids: version.ids || [], wefDate: version.wefDate })
    setIsAdding(true)
    toast({
      title: "Editing Version",
      description: `Loaded the ${version.wefDate} version into the form.`,
    })
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
      await queryClient.invalidateQueries({ queryKey: ["sku-selling-price-history-modal", skuSellingPriceId] })
      await queryClient.invalidateQueries({ queryKey: ["sku-selling-price-sectional-history"] })
      await refetch()
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to delete version.", variant: "destructive" })
    }
  }

  return (
    <div className="w-full min-w-0 max-w-full pb-8 space-y-4 text-slate-800">
      {/* Back Button */}
      <div className="sticky -top-6 z-10 -mx-6 -mt-6 space-y-4 border-b border-slate-200 bg-background px-6 pb-4 pt-2">
      <div className="flex items-center justify-between [&>button]:bg-white [&>button]:shadow-sm">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onBack}
          className="h-8 px-2.5 text-xs font-semibold bg-white border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 flex items-center gap-1.5 shadow-2xs rounded-md"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Pricing Form
        </Button>
      </div>

      {/* Header */}
      <div className="border-b pb-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-600" />
          Pricing Effective-Dated Versions & History
        </h2>
        <p className="text-xs text-slate-500 font-medium mt-0.5">
          Packing Material: <span className="font-bold text-slate-800">{packingMaterial || `#${skuSellingPriceId}`}</span>
        </p>
      </div>
      </div>

      {/* Action Bar */}
      <div className="mb-4 flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200">
        <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
          <Tag className="h-3.5 w-3.5 text-blue-600" />
          Pricing History Table
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] bg-white text-slate-700 border-slate-300">
            {groupedVersions.length} {groupedVersions.length === 1 ? "Version" : "Versions"}
          </Badge>
          <Button
            type="button"
            size="sm"
            className={`h-7 px-2.5 text-xs font-semibold shadow-xs flex items-center gap-1 border-none ${
              isAdding
                ? "bg-slate-600 hover:bg-slate-700 text-white"
                : "bg-emerald-600 hover:bg-emerald-700 text-white"
            }`}
            onClick={() => {
              if (!isAdding) {
                // Opening a fresh blank form (not via Edit) - clear any stale edit-tracking state.
                setEditingVersion(null)
                setNewVersionForm(getInitialFormState())
              }
              setIsAdding(!isAdding)
            }}
          >
            {isAdding ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {isAdding ? "Cancel Form" : "Add Effective Date Version"}
          </Button>
        </div>
      </div>

      {/* Add New Version Form Panel */}
      {isAdding && (
        <div className="p-4 bg-gradient-to-br from-emerald-50 to-white rounded-2xl border border-emerald-200 shadow-sm space-y-4 animate-in fade-in-50">
          <div className="flex items-center gap-2 border-b border-emerald-200/80 pb-3">
            <span className="flex items-center justify-center h-6 w-6 rounded-full bg-emerald-100 shrink-0">
              <Calendar className="h-3.5 w-3.5 text-emerald-700" />
            </span>
            <span className="text-xs font-bold text-emerald-900 tracking-wide">
              Log New PRICING Version (Applicable From Date)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-4 text-xs items-start">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide">Applicable From (W.E.F Date) *</Label>
              <Input
                ref={wefDateInputRef}
                type="date"
                autoFocus
                className="h-9 text-xs font-semibold rounded-lg border-emerald-300 shadow-xs bg-white focus-visible:ring-2 focus-visible:ring-emerald-500/30"
                value={newVersionForm.wefDate || ""}
                onChange={(e) => setNewVersionForm(prev => ({ ...prev, wefDate: e.target.value }))}
              />
            </div>

            {DEDICATED_COLUMNS.map((label) => {
              const key = FIELD_LABEL_TO_KEY[label]
              if (key === "status") {
                return (
                  <div key={key} className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                      {label}
                    </Label>
                    <Select
                      value={newVersionForm.status || "Active"}
                      onValueChange={(val: string) => setNewVersionForm(prev => ({ ...prev, status: val }))}
                    >
                      <SelectTrigger className="h-9 text-xs rounded-lg border-slate-200 shadow-xs bg-white">
                        <SelectValue placeholder="Select Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )
              }
              const isNumeric = key !== "packing_material" && key !== "sku_unit" && key !== "var"
              // These four drive landing_cost -> selling_cost -> actual_margin;
              // editing them recalculates the chain live. Landing Cost and
              // Actual Margin are pure derived values (never directly editable,
              // same as the main form) - Selling Cost is the one overridable
              // result field, matching its original "Auto / Custom" design.
              const RECALC_TRIGGER_KEYS = ["sku_weight_in_gm", "packing_material_weight_in_gm", "packing_cost", "margin"]
              const isReadOnly = key === "landing_cost" || key === "actual_margin"
              return (
                <div key={key} className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                    {label}
                    {isReadOnly && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-slate-400 bg-slate-100 px-1 py-0.5 rounded border border-slate-200 normal-case tracking-normal">
                        <Lock className="h-2.5 w-2.5" /> Auto
                      </span>
                    )}
                  </Label>
                  <Input
                    type={isNumeric ? "number" : "text"}
                    step={isNumeric ? "any" : undefined}
                    readOnly={isReadOnly}
                    className={`h-9 text-xs rounded-lg border-slate-200 shadow-xs transition-colors ${
                      isReadOnly
                        ? "bg-slate-100 cursor-not-allowed"
                        : "bg-white hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30"
                    }`}
                    value={newVersionForm[key] ?? ""}
                    onChange={(e) => {
                      if (isReadOnly) return
                      const val = e.target.value
                      setNewVersionForm(prev => {
                        const next = { ...prev, [key]: val }
                        return RECALC_TRIGGER_KEYS.includes(key) ? { ...next, ...calculateSkuSellingPriceDerived(next, gt) } : next
                      })
                    }}
                    placeholder={isNumeric ? (isReadOnly ? "Auto" : "0.00") : label}
                  />
                </div>
              )
            })}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-emerald-200/80">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs font-semibold rounded-lg bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs"
              onClick={() => { setIsAdding(false); setEditingVersion(null) }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isSaving}
              className="h-8 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm transition-colors"
              onClick={handleSaveNewVersion}
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              <span>{isSaving ? "Saving..." : "Save Effective Version"}</span>
            </Button>
          </div>
        </div>
      )}

      {/* History Table (100% Identical Layout to Customer Master Table) */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[280px] text-xs text-slate-400 gap-2 bg-white rounded-lg border border-slate-200">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          <span>Loading history versions...</span>
        </div>
      ) : groupedVersions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400 bg-white min-h-[280px] flex items-center justify-center">
          <div>
            No effective-dated versions recorded yet. Click{" "}
            <strong className="text-emerald-700">Add Effective Date Version</strong> above to create one.
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 overflow-x-auto shadow-2xs bg-white min-h-[280px]">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/90 text-slate-800 font-semibold border-b border-slate-300 text-xs text-center">
                <th className="py-2.5 px-3 whitespace-nowrap bg-amber-50/80 text-slate-900 text-right border-r border-slate-300 w-36 font-bold">
                  Applicable From (W.E.F)
                </th>

                {DEDICATED_COLUMNS.map((fieldName) => (
                  <th key={fieldName} className="py-2.5 px-3 border-r border-slate-300 whitespace-nowrap">{fieldName}</th>
                ))}

                <th className="py-2.5 px-3 text-left whitespace-nowrap border-r border-slate-300 w-36">Updated By</th>
                <th className="py-2.5 px-3 text-left whitespace-nowrap border-r border-slate-300 w-36">Approved By</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {groupedVersions.map((version: any, vIdx: number) => {
                const todayStr = getTodayStr()
                const isFuture = version.wefDate > todayStr
                const isActive = version.wefDate === activeRecordId

                const formattedWef = version.wefDate
                  ? fmtDate(version.wefDate)
                  : "—"

                return (
                  <tr
                    key={version.wefDate}
                    className={`transition-colors ${
                      isActive
                        ? "bg-emerald-50/40 font-medium"
                        : isFuture
                        ? "bg-amber-50/30"
                        : vIdx % 2 === 0
                        ? "bg-white"
                        : "bg-slate-50/50"
                    } hover:bg-slate-100/80`}
                  >
                    <td className="py-2 px-3 font-bold text-slate-900 bg-amber-50/50 border-r border-slate-300 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Calendar className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                        <span className="font-mono text-[11px]">{formattedWef}</span>
                        
                        
                      </div>
                    </td>

                    {DEDICATED_COLUMNS.map((fieldName) => {
                      const val = (fmtHistoryWeight(fieldName, getSnapshotValue(version, fieldName), getWeightDecimals()) ?? fmtHistoryAmount(fieldName, getSnapshotValue(version, fieldName)) ?? getSnapshotValue(version, fieldName))
                      if (fieldName === "Status") {
                        return (
                          <td key={fieldName} className="py-2.5 px-3 border-r border-slate-200">
                            <Badge variant="outline" className={val === 'Inactive' ? 'bg-red-50 text-red-700 border-red-200 text-[10px]' : 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]'}>
                              {val || 'Active'}
                            </Badge>
                          </td>
                        )
                      }
                      return (
                        <td key={fieldName} className="py-2.5 px-3 border-r border-slate-200 text-slate-700 font-medium">
                          {val}
                        </td>
                      )
                    })}

                    <td className="py-2.5 px-3 text-left border-r border-slate-200 whitespace-nowrap text-[11px] text-slate-600">
                      <div className="flex items-center justify-start gap-1">
                        <User className="h-3 w-3 text-slate-400 shrink-0" />
                        <div className="flex flex-col leading-tight">
                          <span className="font-medium">{version.changedByName}</span>
                          <span className="text-[10px] text-slate-400 font-normal">{fmtDateTime(version.changedAt)}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-2.5 px-3 text-left border-r border-slate-200 whitespace-nowrap text-[11px] text-slate-600">
                      {version.approvedByName ? (
                        <>
                          <div className="flex items-center justify-start gap-1 font-medium">
                            <User className="h-3 w-3 text-slate-400" />
                            <span>{version.approvedByName}</span>
                          </div>
                          {version.approvedAt && (
                            <div className="text-[10px] text-slate-400 font-normal pl-4">
                              {new Date(version.approvedAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", "")}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-600 hover:text-blue-600 hover:bg-blue-50"
                          onClick={() => handleEditVersion(version)}
                          title="Edit this version"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        {version.ids && version.ids.length > 0 ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-600 hover:text-rose-600 hover:bg-rose-50"
                            onClick={() => handleDeleteVersion(version.ids)}
                            title="Delete this version"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
