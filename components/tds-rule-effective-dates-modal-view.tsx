"use client"

import {useState, useMemo, useEffect, useRef} from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Loader2,
  Landmark,
  Plus,
  Save,
  X,
  Trash2,
  Edit,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { masterHistoryApi, tdsRuleApi } from "@/lib/api-service"
import { useToast } from "@/hooks/use-toast"
import { fmtDate, fmtDateTime, fmtHistoryAmount } from "@/lib/table-format"

// Display-only: render ISO date strings as dd/mm/yyyy (raw values are untouched elsewhere).
const displayVal = (v: any): any =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/.test(v.trim()) ? fmtDate(v.trim()) : v

const DEDICATED_COLUMNS = [
  "W.E.F. Date",
  "Nature of Transaction",
  "Guiding Rule",
  "Threshold Limit",
  "Rate",
  "Applicable On",
  "Status",
]

const FIELD_LABEL_TO_KEY: Record<string, string> = {
  "W.E.F. Date": "wef_date",
  "Nature of Transaction": "name",
  "Guiding Rule": "guiding_rule",
  "Threshold Limit": "threshold_limit",
  "Rate": "rate",
  "Applicable On": "applicable_amount_type",
  "Status": "status",
}

interface TdsRuleEffectiveDatesModalViewProps {
  tdsRuleId: number
  tdsRuleCode: string
  tdsRuleForm?: Record<string, any>
  targetFieldName?: string
  onBack: () => void
  onTdsRuleUpdated?: (data: any) => void
}

export function TdsRuleEffectiveDatesModalView({
  tdsRuleId,
  tdsRuleCode,
  tdsRuleForm = {},
  targetFieldName,
  onBack,
  onTdsRuleUpdated,
}: TdsRuleEffectiveDatesModalViewProps) {

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
  const [editingVersion, setEditingVersion] = useState<{ ids: number[]; wefDate: string } | null>(null)
  const wefDateInputRef = useRef<HTMLInputElement | null>(null)

  const getInitialFormState = () => ({
    wefDate: getTodayStr(),
    wef_date: tdsRuleForm.wef_date?.split("T")[0] || "",
    name: tdsRuleForm.name || "",
    guiding_rule: tdsRuleForm.guiding_rule || "",
    threshold_limit: tdsRuleForm.threshold_limit ?? "",
    rate: tdsRuleForm.rate ?? "",
    applicable_amount_type: tdsRuleForm.applicable_amount_type || "Amount Exceeding Threshold",
    status: tdsRuleForm.status || "Active",
  })

  const [newVersionForm, setNewVersionForm] = useState<Record<string, any>>(getInitialFormState())

  useEffect(() => {
    setNewVersionForm(getInitialFormState())
  }, [tdsRuleForm])

  useEffect(() => {
    if (isAdding && wefDateInputRef.current) {
      setTimeout(() => wefDateInputRef.current?.focus(), 100)
    }
  }, [isAdding])

  const { data: historyData, isLoading, refetch } = useQuery({
    queryKey: ["tds-rule-history-modal", tdsRuleId],
    queryFn: async () => {
      if (!tdsRuleId) return []
      const res = await masterHistoryApi.getHistory("tds_rules", tdsRuleId)
      if (res?.success && Array.isArray(res.data)) {
        return res.data.map((item: any) => ({
          ...item,
          wefDate: item.applicableFrom || item.wef_date || item.createdAt,
        }))
      }
      return []
    },
    enabled: !!tdsRuleId,
    staleTime: 0,
    refetchOnMount: "always",
  })

  const getSnapshotValue = (version: any, fieldName: string): string => {
    const raw = version.snapshot?.[fieldName] ?? "—"
    return displayVal(typeof raw === "string" ? raw : String(raw))
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
        dateMap.set(key, { wefDate: key, changedByName: item.changedByName || item.changedBy || "Admin", approvedByName: item.approvedByName || null, approvedAt: item.approvedAt || null, changedAt: item.createdAt || item.updatedAt || item.changedAt, changes: [], ids: [] })
      }

      const entry = dateMap.get(key)
      if (item.id && !entry.ids.includes(item.id)) entry.ids.push(item.id)
      if (item.fieldName) {
        entry.changes.push({ id: item.id, fieldName: item.fieldName, oldValue: item.oldValue, newValue: item.newValue })
        if (item.changedByName) entry.changedByName = item.changedByName
        if (item.approvedByName) { entry.approvedByName = item.approvedByName; entry.approvedAt = item.approvedAt }
        { const ts = item.createdAt || item.updatedAt || item.changedAt; if (ts) entry.changedAt = ts }
      }
    }

    const rows = Array.from(dateMap.values())
    const fieldSnapshot: Record<string, string> = {}
    for (const row of rows) {
      for (const change of row.changes) fieldSnapshot[change.fieldName] = change.newValue || "—"
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
    if (!tdsRuleId) return
    if (!newVersionForm.wefDate) {
      toast({ title: "Validation Error", description: "Applicable From Date (W.E.F.) is required", variant: "destructive" })
      return
    }
    if (!newVersionForm.name || !String(newVersionForm.name).trim()) {
      toast({ title: "Validation Error", description: "Nature of Transaction is required", variant: "destructive" })
      return
    }

    try {
      setIsSaving(true)

      const finalWefDate = newVersionForm.wef_date || newVersionForm.wefDate

      const logEntries = DEDICATED_COLUMNS.map((label) => {
        const key = FIELD_LABEL_TO_KEY[label]
        const oldValue = tdsRuleForm[key] ?? "—"
        const newValue = key === "wef_date" ? finalWefDate : (newVersionForm[key] || "—")
        return { fieldName: label, oldValue, newValue }
      })

      for (const entry of logEntries) {
        await masterHistoryApi.logHistory({
          masterType: "tds_rules",
          recordId: tdsRuleId,
          fieldName: entry.fieldName,
          oldValue: String(entry.oldValue),
          newValue: String(entry.newValue),
          applicableFrom: newVersionForm.wefDate,
        })
      }

      const todayStr = getTodayStr()
      if (newVersionForm.wefDate <= todayStr) {
        const payload: Record<string, any> = {
          wef_date: finalWefDate,
          name: String(newVersionForm.name).trim(),
          guiding_rule: newVersionForm.guiding_rule || null,
          threshold_limit: newVersionForm.threshold_limit !== "" && newVersionForm.threshold_limit !== null && newVersionForm.threshold_limit !== undefined ? newVersionForm.threshold_limit : null,
          rate: newVersionForm.rate !== "" && newVersionForm.rate !== null && newVersionForm.rate !== undefined ? newVersionForm.rate : null,
          applicable_amount_type: newVersionForm.applicable_amount_type || "Amount Exceeding Threshold",
          status: newVersionForm.status || "Active",
        }
        await tdsRuleApi.update(tdsRuleId, payload)

        const updated = await tdsRuleApi.getById(String(tdsRuleId))
        if (updated?.success && updated.data && onTdsRuleUpdated) {
          onTdsRuleUpdated(updated.data)
        }
        await queryClient.invalidateQueries({ queryKey: ["master-tds-rules"] })
      }

      toast({
        title: "Effective Version Saved",
        description: `New TDS Rule version logged with W.E.F. date ${newVersionForm.wefDate}`,
      })

      // If editing an existing version and wef date changed, delete the old rows to
      // prevent a stale duplicate version remaining at the old date.
      if (editingVersion && editingVersion.wefDate !== newVersionForm.wefDate && editingVersion.ids.length > 0) {
        for (const oldId of editingVersion.ids) {
          await masterHistoryApi.deleteHistory(oldId)
        }
      }
      setEditingVersion(null)

      setIsAdding(false)
      await queryClient.invalidateQueries({ queryKey: ["tds-rule-history-modal", tdsRuleId] })
      await queryClient.invalidateQueries({ queryKey: ["tds-rule-sectional-history"] })
      await refetch()
    } catch (err: any) {
      toast({ title: "Failed to Save Version", description: err.message || "Something went wrong", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleEditVersion = (version: any) => {
    const base = getInitialFormState()
    const overrides: Record<string, any> = {}
    const snap = version.snapshot || {}

    DEDICATED_COLUMNS.forEach((label) => {
      const key = FIELD_LABEL_TO_KEY[label]
      const loggedValue = snap[label]
      if (loggedValue === undefined || loggedValue === "—") return
      overrides[key] = loggedValue
    })

    setNewVersionForm({ ...base, ...overrides, wefDate: version.wefDate })
    setEditingVersion({ ids: version.ids || [], wefDate: version.wefDate })
    setIsAdding(true)
    toast({ title: "Editing Version", description: `Loaded the ${version.wefDate} version into the form.` })
  }

  const handleDeleteVersion = async (ids: number[]) => {
    if (!confirm("Delete this version? This action cannot be undone.")) return
    if (ids.length === 0) {
      toast({ title: "Removed", description: "Version removed." })
      await refetch()
      return
    }
    try {
      for (const id of ids) await masterHistoryApi.deleteHistory(id)
      toast({ title: "Success", description: "Version deleted successfully." })
      await queryClient.invalidateQueries({ queryKey: ["tds-rule-history-modal", tdsRuleId] })
      await queryClient.invalidateQueries({ queryKey: ["tds-rule-sectional-history"] })
      await refetch()
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to delete version.", variant: "destructive" })
    }
  }

  return (
    <div className="w-full min-w-0 max-w-full pb-8 space-y-4 text-slate-800">
      <div className="sticky -top-6 z-10 -mx-6 -mt-6 space-y-4 border-b border-slate-200 bg-background px-6 pb-4 pt-2">
      <div className="flex items-center justify-between [&>button]:bg-white [&>button]:shadow-sm">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onBack}
          className="h-8 px-2.5 text-xs font-semibold bg-white border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 flex items-center gap-1.5 shadow-2xs rounded-md"
        >
          <ArrowLeft className="h-4 w-4" /> Back to TDS Rule Form
        </Button>
      </div>

      <div className="border-b pb-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-600" />
          TDS Rule Effective-Dated Versions &amp; History
        </h2>
        <p className="text-xs text-slate-500 font-medium mt-0.5">
          TDS Rule: <span className="font-bold text-slate-800">{tdsRuleCode || `#${tdsRuleId}`}</span>
        </p>
      </div>
      </div>

      <div className="mb-4 flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200">
        <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
          <Landmark className="h-3.5 w-3.5 text-blue-600" />
          TDS Rule History Table
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] bg-white text-slate-700 border-slate-300">
            {groupedVersions.length} {groupedVersions.length === 1 ? "Version" : "Versions"}
          </Badge>
          <Button
            type="button"
            size="sm"
            className={`h-7 px-2.5 text-xs font-semibold shadow-xs flex items-center gap-1 border-none ${
              isAdding ? "bg-slate-600 hover:bg-slate-700 text-white" : "bg-emerald-600 hover:bg-emerald-700 text-white"
            }`}
            onClick={() => {
              if (!isAdding) {
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

      {isAdding && (
        <div className="p-4 bg-gradient-to-br from-emerald-50 to-white rounded-2xl border border-emerald-200 shadow-sm space-y-4 animate-in fade-in-50">
          <div className="flex items-center gap-2 border-b border-emerald-200/80 pb-3">
            <span className="flex items-center justify-center h-6 w-6 rounded-full bg-emerald-100 shrink-0">
              <Calendar className="h-3.5 w-3.5 text-emerald-700" />
            </span>
            <span className="text-xs font-bold text-emerald-900 tracking-wide">
              Log New TDS Rule Version (Applicable From Date)
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

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">W.E.F. Date</Label>
              <Input
                type="date"
                className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors"
                value={newVersionForm.wef_date || ""}
                onChange={(e) => setNewVersionForm(prev => ({ ...prev, wef_date: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Nature of Transaction</Label>
              <Input
                className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors"
                value={newVersionForm.name || ""}
                onChange={(e) => setNewVersionForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Purchase of Goods - Sec 194Q"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Guiding Rule</Label>
              <Input
                className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors"
                value={newVersionForm.guiding_rule || ""}
                onChange={(e) => setNewVersionForm(prev => ({ ...prev, guiding_rule: e.target.value }))}
                placeholder="e.g. Section 194Q"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Threshold Limit (₹)</Label>
              <Input
                type="number"
                step="0.01"
                className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors"
                value={newVersionForm.threshold_limit ?? ""}
                onChange={(e) => setNewVersionForm(prev => ({ ...prev, threshold_limit: e.target.value }))}
                placeholder="e.g. 5000000"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Rate (%)</Label>
              <Input
                type="number"
                step="0.01"
                className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors"
                value={newVersionForm.rate ?? ""}
                onChange={(e) => setNewVersionForm(prev => ({ ...prev, rate: e.target.value }))}
                placeholder="0.10"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Applicable On</Label>
              <Select value={newVersionForm.applicable_amount_type || "Amount Exceeding Threshold"} onValueChange={(val) => setNewVersionForm(prev => ({ ...prev, applicable_amount_type: val }))}>
                <SelectTrigger className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors">
                  <SelectValue placeholder="Select basis" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Amount Exceeding Threshold">Amount Exceeding Threshold</SelectItem>
                  <SelectItem value="Full Taxable Value">Full Taxable Value</SelectItem>
                  <SelectItem value="Total Invoice Amount">Total Invoice Amount</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Status</Label>
              <Select value={newVersionForm.status || "Active"} onValueChange={(val) => setNewVersionForm(prev => ({ ...prev, status: val }))}>
                <SelectTrigger className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors">
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
                {DEDICATED_COLUMNS.map((label) => (
                  <th key={label} className="py-2.5 px-3 border-r border-slate-300 whitespace-nowrap">{label}</th>
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
                      isActive ? "bg-emerald-50/40 font-medium" : isFuture ? "bg-amber-50/30" : vIdx % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                    } hover:bg-slate-100/80`}
                  >
                    <td className="py-2 px-3 font-bold text-slate-900 bg-amber-50/50 border-r border-slate-300 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Calendar className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                        <span className="font-mono text-[11px]">{formattedWef}</span>
                        
                        
                      </div>
                    </td>

                    {DEDICATED_COLUMNS.map((label) => (
                      <td key={label} className="py-2.5 px-3 border-r border-slate-200 text-slate-700 font-medium">
                        {(fmtHistoryAmount(label, getSnapshotValue(version, label)) ?? getSnapshotValue(version, label))}
                      </td>
                    ))}

                    <td className="py-2.5 px-3 text-left border-r border-slate-200 whitespace-nowrap text-[11px] text-slate-600">
                      <div className="flex items-center justify-start gap-1 font-medium">
                        <User className="h-3 w-3 text-slate-400 shrink-0" />
                        <div className="flex flex-col leading-tight">
                          <span>{version.changedByName}</span>
                          <span className="text-[10px] font-normal text-slate-400">{fmtDateTime(version.changedAt)}</span>
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
