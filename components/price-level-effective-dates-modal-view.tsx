"use client"

import {useState, useMemo, useEffect, useRef} from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Loader2,
  FileText,
  IndianRupee,
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
import { masterHistoryApi, priceLevelApi } from "@/lib/api-service"
import { useToast } from "@/hooks/use-toast"

import { fmtDate, fmtDateTime } from "@/lib/table-format"

// Display-only: ISO dates (yyyy-mm-dd[...]) shown as dd/mm/yyyy; other text untouched.
const dispVal = (v: any): any =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/.test(v.trim()) ? fmtDate(v.trim().slice(0, 10)) : v
const isDateLabel = (l: string) => /(valid|upto|w\.e\.f|effective date|expiry)/i.test(l)

type PriceLevelSectionType = "header" | "items"

interface PriceLevelEffectiveDatesModalViewProps {
  priceLevelId: number
  priceLevelCode: string
  priceLevelForm?: Record<string, any>
  initialSection: PriceLevelSectionType
  targetFieldName?: string
  skuOptions?: any[]
  onBack: () => void
  onPriceLevelUpdated?: (data: any) => void
}

export function PriceLevelEffectiveDatesModalView({
  priceLevelId,
  priceLevelCode,
  priceLevelForm = {},
  initialSection = "header",
  targetFieldName,
  skuOptions = [],
  onBack,
  onPriceLevelUpdated,
}: PriceLevelEffectiveDatesModalViewProps) {

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

  const getSkuLabel = (skuId: any) => {
    if (!skuId) return "—"
    const found = skuOptions.find((s: any) => String(s.id) === String(skuId))
    return found ? (found.sku_name || `SKU #${skuId}`) : `SKU #${skuId}`
  }

  const [activeSection, setActiveSection] = useState<PriceLevelSectionType>(initialSection)
  const [isAdding, setIsAdding] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [itemDraft, setItemDraft] = useState({ sku_id: "", price: "" })
  // Tracks the version currently loaded via "Edit" (its row ids + original
  // W.E.F date) so that saving under a CHANGED date can delete the original
  // rows instead of leaving a stale duplicate version behind at the old date.
  const [editingVersion, setEditingVersion] = useState<{ ids: number[]; wefDate: string } | null>(null)
  const wefDateInputRef = useRef<HTMLInputElement | null>(null)

  // Initialize form state from priceLevelForm
  const getInitialFormState = () => ({
    wefDate: getTodayStr(),
    status: priceLevelForm.status || "Active",
    effective_date: priceLevelForm.effective_date?.split("T")[0] || "",
    items: (priceLevelForm.items || []).map((it: any) => ({ sku_id: it.sku_id, price: String(it.price ?? "") })),
  })

  const [newVersionForm, setNewVersionForm] = useState<Record<string, any>>(getInitialFormState())

  // Keep form fields synced whenever priceLevelForm or activeSection updates
  useEffect(() => {
    setNewVersionForm(getInitialFormState())
    setItemDraft({ sku_id: "", price: "" })
  }, [priceLevelForm, activeSection])

  // Auto focus on WEF Date when form is opened
  useEffect(() => {
    if (isAdding && wefDateInputRef.current) {
      setTimeout(() => {
        wefDateInputRef.current?.focus()
      }, 100)
    }
  }, [isAdding, activeSection])

  useEffect(() => {
    setActiveSection(initialSection)
    setIsAdding(true)
    setEditingVersion(null)
  }, [initialSection])

  // Fetch history for this Price Level
  const { data: historyData, isLoading, refetch } = useQuery({
    queryKey: ["price-level-history-modal", priceLevelId],
    queryFn: async () => {
      if (!priceLevelId) return []
      const res = await masterHistoryApi.getHistory("price_levels", priceLevelId)
      if (res?.success && Array.isArray(res.data)) {
        return res.data.map((item: any) => ({
          ...item,
          wefDate: item.applicableFrom || item.wef_date || item.createdAt,
        }))
      }
      return []
    },
    enabled: !!priceLevelId,
    staleTime: 0,
    refetchOnMount: "always",
  })

  const sectionTitles: Record<PriceLevelSectionType, string> = {
    header: "Header Details History Table",
    items: "Price Items History Table",
  }

  // Every field shown in the "Log New Version" form gets its own dedicated
  // table column - mirrors Customer/SKU Master's per-field history columns.
  // Item columns are generated from the price level's current line items, one
  // column per SKU, same as SKU Master's Depot Stocks section does per depot.
  const DEDICATED_COLUMNS: Record<PriceLevelSectionType, string[]> = {
    header: ["Price Level Code", "Effective Date", "Status"],
    items: (priceLevelForm.items || []).map((it: any) => `Price - ${getSkuLabel(it.sku_id)}`),
  }

  // The column header shows just the SKU name, not the full logged field name.
  const columnLabel = (fieldName: string): string => fieldName.replace(/^Price - /, "")

  // Effective value of a field as of this version's W.E.F date (carried forward
  // from earlier versions, same "snapshot" convention as Customer Master's table -
  // no strikethrough/arrow diffs, just the value that was in effect).
  const getSnapshotValue = (version: any, fieldName: string): string => {
    return version.snapshot?.[fieldName] ?? "—"
  }

  const rawItems = (historyData || []).filter((item: any) => {
    if (activeSection === "header") {
      return item.fieldName === "Status" || item.fieldName === "Effective Date" || item.fieldName === "Price Level Code"
    }
    // Item rows are logged per-SKU as "Price - <SKU Name>", which never
    // exactly equals a fixed name - match by prefix instead.
    return typeof item.fieldName === "string" && item.fieldName.startsWith("Price - ")
  })

  // Group history rows by WEF Date
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
        entry.changedAt = item.createdAt || item.updatedAt || item.changedAt || entry.changedAt
      }
    }

    // dateMap was populated in ascending (chronological) order above - walk it in
    // that order to build a running "effective value" per field, so each row can
    // show a plain snapshot value instead of an old->new diff.
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

  // Helper for saving an effective date version
  const handleSaveNewVersion = async () => {
    if (!priceLevelId) return
    if (!newVersionForm.wefDate) {
      toast({ title: "Validation Error", description: "Applicable From Date (W.E.F.) is required", variant: "destructive" })
      return
    }

    try {
      setIsSaving(true)

      // Always log every field of the active section (not just the ones that
      // changed) so each W.E.F version carries a complete snapshot - otherwise
      // the history table shows "—" for fields that were already correct and
      // simply weren't touched in this particular edit.
      const logEntries: Array<{ fieldName: string; oldValue: any; newValue: any }> = []

      if (activeSection === "header") {
        // Price Level Code is auto-generated and never edited - logged with the
        // same value every time purely so it stays visible as a column in the
        // history table (mirrors the field being shown, read-only, on the main form).
        logEntries.push({ fieldName: "Price Level Code", oldValue: priceLevelForm.price_level_code || "—", newValue: priceLevelForm.price_level_code || "—" })
        logEntries.push({ fieldName: "Status", oldValue: priceLevelForm.status || "Active", newValue: newVersionForm.status || "—" })
        logEntries.push({ fieldName: "Effective Date", oldValue: priceLevelForm.effective_date?.split("T")[0] || "—", newValue: newVersionForm.effective_date || "—" })
      } else if (activeSection === "items") {
        for (const item of newVersionForm.items || []) {
          const existing = (priceLevelForm.items || []).find((it: any) => String(it.sku_id) === String(item.sku_id))
          logEntries.push({
            fieldName: `Price - ${getSkuLabel(item.sku_id)}`,
            oldValue: existing?.price ?? "—",
            newValue: item.price || "—",
          })
        }
      }

      for (const entry of logEntries) {
        await masterHistoryApi.logHistory({
          masterType: "price_levels",
          recordId: priceLevelId,
          fieldName: entry.fieldName,
          oldValue: String(entry.oldValue),
          newValue: String(entry.newValue),
          applicableFrom: newVersionForm.wefDate,
        })
      }

      // If this version is effective today or in the past, apply it to the live
      // record now (same rule Customer Master's backend uses) - otherwise saving
      // a version only ever logs history and the record itself never updates.
      const todayStr = getTodayStr()
      if (newVersionForm.wefDate <= todayStr) {
        if (activeSection === "header") {
          await priceLevelApi.update(priceLevelId, { status: newVersionForm.status, effective_date: newVersionForm.effective_date })
        } else if (activeSection === "items") {
          await priceLevelApi.update(priceLevelId, { items: newVersionForm.items })
        }

        const updated = await priceLevelApi.getById(String(priceLevelId))
        if (updated?.success && updated.data && onPriceLevelUpdated) {
          onPriceLevelUpdated(updated.data)
        }
        await queryClient.invalidateQueries({ queryKey: ["master-price-levels"] })
      }

      toast({
        title: "Effective Version Saved",
        description: `New ${sectionTitles[activeSection]} version logged with W.E.F. date ${newVersionForm.wefDate}`,
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
      await queryClient.invalidateQueries({ queryKey: ["price-level-history-modal", priceLevelId] })
      await queryClient.invalidateQueries({ queryKey: ["price-level-sectional-history"] })
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

  // Loads a logged version back into the "Add Effective Date Version" form so it
  // can be corrected and resaved.
  const handleEditVersion = (version: any) => {
    const base = getInitialFormState()

    if (activeSection === "header") {
      const status = version.snapshot?.["Status"]
      const effectiveDate = version.snapshot?.["Effective Date"]
      setNewVersionForm({
        ...base,
        status: status && status !== "—" ? status : base.status,
        effective_date: effectiveDate && effectiveDate !== "—" ? effectiveDate : base.effective_date,
        wefDate: version.wefDate,
      })
    } else {
      const items = (priceLevelForm.items || []).map((it: any) => {
        const label = `Price - ${getSkuLabel(it.sku_id)}`
        const snapPrice = version.snapshot?.[label]
        return { sku_id: it.sku_id, price: snapPrice && snapPrice !== "—" ? snapPrice : String(it.price ?? "") }
      })
      setNewVersionForm({ ...base, items, wefDate: version.wefDate })
    }

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
      toast({ title: "Info", description: "This is a baseline record and cannot be deleted." })
      return
    }
    try {
      for (const id of ids) {
        await masterHistoryApi.deleteHistory(id)
      }
      toast({ title: "Success", description: "Version deleted successfully." })
      await queryClient.invalidateQueries({ queryKey: ["price-level-history-modal", priceLevelId] })
      await queryClient.invalidateQueries({ queryKey: ["price-level-sectional-history"] })
      await refetch()
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to delete version.", variant: "destructive" })
    }
  }

  return (
    <div className="space-y-4 text-slate-800">
      {/* Back Button */}
      <div className="sticky -top-6 z-50 -mt-6 -mx-6 px-6 pt-4 pb-2.5 mb-2 rounded-t-lg bg-slate-50 border-b border-slate-200 flex items-center justify-between [&>button]:bg-white [&>button]:shadow-sm">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onBack}
          className="h-8 px-2.5 text-xs font-semibold bg-white border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 flex items-center gap-1.5 shadow-2xs rounded-md"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Price Level Form
        </Button>
      </div>

      {/* Header */}
      <div className="border-b pb-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-600" />
          Price Level Effective-Dated Versions & History
        </h2>
        <p className="text-xs text-slate-500 font-medium mt-0.5">
          Price Level: <span className="font-bold text-slate-800">{priceLevelCode || `#${priceLevelId}`}</span>
        </p>
      </div>

      {/* Section Navigation Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => { setActiveSection("header"); setIsAdding(false) }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeSection === "header"
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          Header Details History
        </button>

        <button
          type="button"
          onClick={() => { setActiveSection("items"); setIsAdding(false) }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeSection === "items"
              ? "bg-emerald-600 text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
          }`}
        >
          <IndianRupee className="h-3.5 w-3.5" />
          Price Items History
        </button>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200">
        <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
          <FileText className="h-3.5 w-3.5 text-blue-600" />
          {sectionTitles[activeSection]}
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
              Log New {activeSection === "header" ? "HEADER DETAILS" : "PRICE ITEMS"} Version (Applicable From Date)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-4 text-xs items-start">
            {/* Applicable From (W.E.F Date) */}
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

            {activeSection === "header" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                    <Lock className="h-3 w-3 text-slate-400 cursor-not-allowed" />
                    Price Level Code
                  </Label>
                  <div className="cursor-not-allowed">
                    <Input
                      readOnly
                      disabled
                      className="h-9 text-xs font-mono bg-slate-100 rounded-lg border-slate-200 pointer-events-none"
                      value={priceLevelForm.price_level_code || ""}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Status</Label>
                  <Select
                    value={newVersionForm.status || "Active"}
                    onValueChange={(val) => setNewVersionForm(prev => ({ ...prev, status: val }))}
                  >
                    <SelectTrigger className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors">
                      <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Effective Date</Label>
                  <Input
                    type="date"
                    className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors"
                    value={newVersionForm.effective_date || ""}
                    onChange={(e) => setNewVersionForm(prev => ({ ...prev, effective_date: e.target.value }))}
                  />
                </div>
              </>
            )}

            {activeSection === "items" && (
              <>
                {(newVersionForm.items || []).length > 0 && (
                  <div className="sm:col-span-2 lg:col-span-3 space-y-2">
                    <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Price Items in this Version</Label>
                    {(newVersionForm.items || []).map((item: any, idx: number) => (
                      <div key={item.sku_id} className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-xs">
                        <span className="flex-1 min-w-0 text-xs font-semibold text-slate-700 truncate">
                          {getSkuLabel(item.sku_id)}
                        </span>
                        <span className="text-xs text-slate-400 shrink-0">₹</span>
                        <Input
                          type="number"
                          step="any"
                          className="h-8 w-28 text-xs bg-slate-50 rounded-lg border-slate-200 hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors shrink-0"
                          value={item.price}
                          onChange={(e) => {
                            const val = e.target.value
                            setNewVersionForm(prev => ({
                              ...prev,
                              items: prev.items.map((it: any, i: number) => (i === idx ? { ...it, price: val } : it)),
                            }))
                          }}
                          placeholder="0.00"
                        />
                        <button
                          type="button"
                          className="h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          onClick={() => setNewVersionForm(prev => ({ ...prev, items: prev.items.filter((_: any, i: number) => i !== idx) }))}
                          title="Remove this SKU from the version"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {(newVersionForm.items || []).length === 0 && (
                  <p className="text-[11px] text-slate-400 italic sm:col-span-2 lg:col-span-3">
                    No price items in this version yet - add one below.
                  </p>
                )}

                <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                  <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Add SKU Price to this Version</Label>
                  <div className="flex items-center gap-2">
                    <Select value={itemDraft.sku_id} onValueChange={(val) => setItemDraft(prev => ({ ...prev, sku_id: val }))}>
                      <SelectTrigger className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs flex-1 hover:border-emerald-300">
                        <SelectValue placeholder="Select Finished Good" />
                      </SelectTrigger>
                      <SelectContent>
                        {skuOptions
                          .filter((s: any) => !(newVersionForm.items || []).some((it: any) => String(it.sku_id) === String(s.id)))
                          .map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.sku_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      step="any"
                      className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs w-28 shrink-0 hover:border-emerald-300"
                      placeholder="Price"
                      value={itemDraft.price}
                      onChange={(e) => setItemDraft(prev => ({ ...prev, price: e.target.value }))}
                    />
                    <Button
                      type="button"
                      size="icon"
                      className="h-9 w-9 shrink-0 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                      onClick={() => {
                        if (!itemDraft.sku_id || !itemDraft.price) {
                          toast({ title: "Error", description: "Select a Finished Good and enter a price", variant: "destructive" })
                          return
                        }
                        setNewVersionForm(prev => ({ ...prev, items: [...(prev.items || []), { sku_id: itemDraft.sku_id, price: itemDraft.price }] }))
                        setItemDraft({ sku_id: "", price: "" })
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
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

                {DEDICATED_COLUMNS[activeSection].map((fieldName) => (
                  <th key={fieldName} className={`py-2.5 px-3 border-r border-slate-300 whitespace-nowrap ${isDateLabel(fieldName) ? "text-right" : ""}`}>
                    {activeSection === "header" && fieldName === "Price Level Code" ? (
                      <span className="flex items-center justify-center gap-1">
                        <Lock className="h-3 w-3 text-slate-400 shrink-0" />
                        {columnLabel(fieldName)}
                      </span>
                    ) : (
                      columnLabel(fieldName)
                    )}
                  </th>
                ))}

                <th className="py-2.5 px-3 text-left whitespace-nowrap border-r border-slate-300 w-36">Updated By</th>
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
                    {/* W.E.F Cell with Active/Scheduled Badges */}
                    <td className="py-2 px-3 font-bold text-slate-900 bg-amber-50/50 border-r border-slate-300 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Calendar className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                        <span className="font-mono text-[11px]">{formattedWef}</span>
                        
                        
                      </div>
                    </td>

                    {/* Dedicated per-field columns (Customer Master style: plain effective values, no diffs) */}
                    {DEDICATED_COLUMNS[activeSection].map((fieldName) => (
                      <td key={fieldName} className={`py-2.5 px-3 border-r border-slate-200 text-slate-700 font-medium ${isDateLabel(fieldName) ? "text-right" : ""}`}>
                        {activeSection === "header" && fieldName === "Price Level Code" ? (
                          <span className="flex items-center gap-1.5">
                            <Lock className="h-3 w-3 text-slate-400 shrink-0" />
                            <span className="font-mono text-[11px] text-slate-600">{dispVal(getSnapshotValue(version, fieldName))}</span>
                          </span>
                        ) : (
                          dispVal(getSnapshotValue(version, fieldName))
                        )}
                      </td>
                    ))}

                    {/* Updated By Cell */}
                    <td className="py-2.5 px-3 text-left border-r border-slate-200 whitespace-nowrap text-[11px] text-slate-600">
                      <div className="flex items-center justify-start gap-1 font-medium">
                        <User className="h-3 w-3 text-slate-400" />
                        <span>{version.changedByName}</span>
                      </div>
                      <div className="pl-4 text-[10px] text-slate-400 font-normal">{fmtDateTime(version.changedAt)}</div>
                    </td>

                    {/* Actions Cell */}
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
