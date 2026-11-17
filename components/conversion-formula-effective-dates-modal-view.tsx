"use client"

import {useState, useMemo, useEffect, useRef} from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Loader2,
  Sigma,
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
import { masterHistoryApi, conversionFormulaApi } from "@/lib/api-service"
import { fmtDate, fmtDateTime } from "@/lib/table-format"
import { useToast } from "@/hooks/use-toast"

// This form has no natural sub-sections (Base/Child Item, Status, and the
// Formula Steps list all describe the one formula), so it's treated as one
// flat section - same pattern used for Ledger Group, Stock Group, Units, and
// Insurance Details Master.
const DEDICATED_COLUMNS = ["Status", "Base/Parent Item", "Child Item", "Formula Steps"]

const FIELD_LABEL_TO_KEY: Record<string, string> = {
  "Status": "status",
  "Base/Parent Item": "base_item_id",
  "Child Item": "child_item_id",
  "Formula Steps": "steps",
}

const OPERATION_LABELS: Record<string, string> = {
  add: "Add",
  subtract: "Subtract",
  multiply: "Multiply",
  divide: "Divide",
  round_up: "Round Up (2 decimals)",
}

const OPERAND_TYPE_LABELS: Record<string, string> = {
  literal: "a number",
  rate_of_base_item: "Rate of Base Item",
  converted_kg_of_base_item: "Converted KGS of Base Item",
  converted_kg_of_child_item: "Converted KGS of Child Item",
}

interface ConversionFormulaEffectiveDatesModalViewProps {
  conversionFormulaId: number
  conversionFormulaCode: string
  conversionFormulaForm?: Record<string, any>
  targetFieldName?: string
  skuOptions?: any[]
  onBack: () => void
  onConversionFormulaUpdated?: (data: any) => void
}

export function ConversionFormulaEffectiveDatesModalView({
  conversionFormulaId,
  conversionFormulaCode,
  conversionFormulaForm = {},
  targetFieldName,
  skuOptions = [],
  onBack,
  onConversionFormulaUpdated,
}: ConversionFormulaEffectiveDatesModalViewProps) {

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
  const [stepDraft, setStepDraft] = useState({ operation: "subtract", operand_type: "literal", operand_value: "" })
  // Tracks the version currently loaded via "Edit" (its row ids + original
  // W.E.F date) so that saving under a CHANGED date can delete the original
  // rows instead of leaving a stale duplicate version behind at the old date.
  const [editingVersion, setEditingVersion] = useState<{ ids: number[]; wefDate: string } | null>(null)
  const wefDateInputRef = useRef<HTMLInputElement | null>(null)

  const getInitialFormState = () => ({
    wefDate: getTodayStr(),
    status: conversionFormulaForm.status || "Active",
    base_item_id: conversionFormulaForm.base_item_id ? String(conversionFormulaForm.base_item_id) : "",
    child_item_id: conversionFormulaForm.child_item_id ? String(conversionFormulaForm.child_item_id) : "",
    steps: Array.isArray(conversionFormulaForm.steps) ? conversionFormulaForm.steps.map((s: any) => ({ ...s })) : [],
  })

  const [newVersionForm, setNewVersionForm] = useState<Record<string, any>>(getInitialFormState())

  useEffect(() => {
    setNewVersionForm(getInitialFormState())
  }, [conversionFormulaForm])

  useEffect(() => {
    if (isAdding && wefDateInputRef.current) {
      setTimeout(() => wefDateInputRef.current?.focus(), 100)
    }
  }, [isAdding])

  const { data: historyData, isLoading, refetch } = useQuery({
    queryKey: ["conversion-formula-history-modal", conversionFormulaId],
    queryFn: async () => {
      if (!conversionFormulaId) return []
      const res = await masterHistoryApi.getHistory("conversion_formulas", conversionFormulaId)
      if (res?.success && Array.isArray(res.data)) {
        return res.data.map((item: any) => ({
          ...item,
          wefDate: item.applicableFrom || item.wef_date || item.createdAt,
        }))
      }
      return []
    },
    enabled: !!conversionFormulaId,
    staleTime: 0,
    refetchOnMount: "always",
  })

  // "Base/Parent Item" and "Child Item" are logged as "Readable Label (#id)" -
  // human-readable in the audit table, but the "(#id)" suffix lets
  // handleEditVersion reliably restore the exact original selection instead
  // of re-matching by name.
  const getSkuLabel = (id: any) => {
    if (!id) return "—"
    const found = skuOptions.find((s: any) => String(s.id) === String(id))
    return found ? `${found.sku_name} (#${found.id})` : id
  }

  const parseIdFromLabel = (label: string): string | null => {
    if (!label) return null
    const match = label.match(/\(#(\d+)\)/)
    return match ? match[1] : null
  }

  // Formula Steps is an ORDERED list where each entry has 3 parts (operation /
  // operand_type / operand_value), so each step is logged as a readable
  // description with an embedded "(#operation|operand_type|operand_value)"
  // tag - lets a historical version be parsed back into the exact ordered
  // step list, not just guessed from the display text.
  const getStepsLabel = (steps: any[]) => {
    if (!steps || steps.length === 0) return "—"
    return steps
      .map((s: any, idx: number) => {
        const opLabel = OPERATION_LABELS[s.operation] || s.operation
        const operandDisplay = s.operand_type === "literal" ? s.operand_value : (OPERAND_TYPE_LABELS[s.operand_type] || s.operand_type)
        return `Step ${idx + 1}: ${opLabel} ${operandDisplay ?? ""} (#${s.operation}|${s.operand_type}|${s.operand_value ?? ""})`
      })
      .join(", ")
  }

  const parseStepsFromLabel = (label: string): { step_order: number; operation: string; operand_type: string; operand_value: string | null }[] => {
    if (!label) return []
    const matches = [...label.matchAll(/\(#([a-z_]+)\|([a-z_]+)\|([^)]*)\)/g)]
    return matches.map((m, idx) => ({ step_order: idx + 1, operation: m[1], operand_type: m[2], operand_value: m[3] || null }))
  }

  const getSnapshotValue = (version: any, fieldName: string): string => {
    const raw = version.snapshot?.[fieldName] ?? "—"
    if (typeof raw !== "string") return raw
    if (fieldName === "Formula Steps") return raw.replace(/\s*\(#[a-z_]+\|[a-z_]+\|[^)]*\)/g, "")
    return raw.replace(/\s*\(#\d+\)/g, "")
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
        dateMap.set(key, { wefDate: key, changedByName: item.changedByName || item.changedBy || "Admin", approvedByName: item.approvedByName || null, approvedAt: item.approvedAt || null, changedAt: null, changes: [], ids: [] })
      }

      const entry = dateMap.get(key)
      entry.changedAt = item.createdAt || item.updatedAt || item.changedAt || entry.changedAt
      if (item.id && !entry.ids.includes(item.id)) entry.ids.push(item.id)
      if (item.fieldName) {
        entry.changes.push({ id: item.id, fieldName: item.fieldName, oldValue: item.oldValue, newValue: item.newValue })
        if (item.changedByName) entry.changedByName = item.changedByName
        if (item.approvedByName) { entry.approvedByName = item.approvedByName; entry.approvedAt = item.approvedAt }
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
    if (!conversionFormulaId) return
    if (!newVersionForm.wefDate) {
      toast({ title: "Validation Error", description: "Applicable From Date (W.E.F.) is required", variant: "destructive" })
      return
    }

    try {
      setIsSaving(true)

      const logEntries = DEDICATED_COLUMNS.map((label) => {
        const key = FIELD_LABEL_TO_KEY[label]
        if (key === "steps") {
          return { fieldName: label, oldValue: getStepsLabel(conversionFormulaForm[key] || []), newValue: getStepsLabel(newVersionForm[key] || []) }
        }
        if (key === "base_item_id" || key === "child_item_id") {
          return { fieldName: label, oldValue: getSkuLabel(conversionFormulaForm[key]), newValue: getSkuLabel(newVersionForm[key]) }
        }
        return { fieldName: label, oldValue: conversionFormulaForm[key] ?? "—", newValue: newVersionForm[key] || "—" }
      })

      for (const entry of logEntries) {
        await masterHistoryApi.logHistory({
          masterType: "conversion_formulas",
          recordId: conversionFormulaId,
          fieldName: entry.fieldName,
          oldValue: String(entry.oldValue),
          newValue: String(entry.newValue),
          applicableFrom: newVersionForm.wefDate,
        })
      }

      const todayStr = getTodayStr()
      if (newVersionForm.wefDate <= todayStr) {
        const payload: Record<string, any> = {
          status: newVersionForm.status,
          base_item_id: newVersionForm.base_item_id ? parseInt(newVersionForm.base_item_id, 10) : null,
          child_item_id: newVersionForm.child_item_id ? parseInt(newVersionForm.child_item_id, 10) : null,
          steps: newVersionForm.steps,
        }
        await conversionFormulaApi.update(conversionFormulaId, payload)

        const updated = await conversionFormulaApi.getById(String(conversionFormulaId))
        if (updated?.success && updated.data && onConversionFormulaUpdated) {
          onConversionFormulaUpdated(updated.data)
        }
        await queryClient.invalidateQueries({ queryKey: ["master-conversion-formulas"] })
      }

      toast({
        title: "Effective Version Saved",
        description: `New Conversion Formula version logged with W.E.F. date ${newVersionForm.wefDate}`,
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
      await queryClient.invalidateQueries({ queryKey: ["conversion-formula-history-modal", conversionFormulaId] })
      await queryClient.invalidateQueries({ queryKey: ["conversion-formula-sectional-history"] })
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

      if (key === "steps") {
        overrides[key] = parseStepsFromLabel(loggedValue)
      } else if (key === "base_item_id" || key === "child_item_id") {
        const id = parseIdFromLabel(loggedValue)
        if (id) overrides[key] = id
      } else {
        overrides[key] = loggedValue
      }
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
      await queryClient.invalidateQueries({ queryKey: ["conversion-formula-history-modal", conversionFormulaId] })
      await queryClient.invalidateQueries({ queryKey: ["conversion-formula-sectional-history"] })
      await refetch()
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to delete version.", variant: "destructive" })
    }
  }

  const removeStepRow = (idx: number) => {
    setNewVersionForm((prev: any) => ({
      ...prev,
      steps: (prev.steps || []).filter((_: any, i: number) => i !== idx).map((s: any, i: number) => ({ ...s, step_order: i + 1 })),
    }))
  }

  const addStepRow = () => {
    if (stepDraft.operand_type === "literal" && !stepDraft.operand_value) {
      toast({ title: "Error", description: "Enter a value for this step", variant: "destructive" })
      return
    }
    setNewVersionForm((prev: any) => ({
      ...prev,
      steps: [
        ...(prev.steps || []),
        {
          step_order: (prev.steps || []).length + 1,
          operation: stepDraft.operation,
          operand_type: stepDraft.operand_type,
          operand_value: stepDraft.operand_type === "literal" ? stepDraft.operand_value : null,
        },
      ],
    }))
    setStepDraft({ operation: "subtract", operand_type: "literal", operand_value: "" })
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
          <ArrowLeft className="h-4 w-4" /> Back to Conversion Formula Form
        </Button>
      </div>

      <div className="border-b pb-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-600" />
          Conversion Formula Effective-Dated Versions & History
        </h2>
        <p className="text-xs text-slate-500 font-medium mt-0.5">
          Formula: <span className="font-bold text-slate-800">{conversionFormulaCode || `#${conversionFormulaId}`}</span>
        </p>
      </div>
      </div>

      <div className="mb-4 flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200">
        <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
          <Sigma className="h-3.5 w-3.5 text-blue-600" />
          Conversion Formula History Table
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

      {isAdding && (
        <div className="p-4 bg-gradient-to-br from-emerald-50 to-white rounded-2xl border border-emerald-200 shadow-sm space-y-4 animate-in fade-in-50">
          <div className="flex items-center gap-2 border-b border-emerald-200/80 pb-3">
            <span className="flex items-center justify-center h-6 w-6 rounded-full bg-emerald-100 shrink-0">
              <Calendar className="h-3.5 w-3.5 text-emerald-700" />
            </span>
            <span className="text-xs font-bold text-emerald-900 tracking-wide">
              Log New CONVERSION FORMULA Version (Applicable From Date)
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

            <div className="space-y-1.5 min-w-0">
              <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Base/Parent Item</Label>
              <Select value={newVersionForm.base_item_id} onValueChange={(val) => setNewVersionForm(prev => ({ ...prev, base_item_id: val }))}>
                <SelectTrigger className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors">
                  <SelectValue placeholder="Select base item" />
                </SelectTrigger>
                <SelectContent>
                  {skuOptions.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.sku_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 min-w-0">
              <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Child Item</Label>
              <Select value={newVersionForm.child_item_id} onValueChange={(val) => setNewVersionForm(prev => ({ ...prev, child_item_id: val }))}>
                <SelectTrigger className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors">
                  <SelectValue placeholder="Select child item" />
                </SelectTrigger>
                <SelectContent>
                  {skuOptions.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.sku_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2 lg:col-span-3 space-y-1.5">
              <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Formula Steps</Label>
              <div className="space-y-2">
                {(newVersionForm.steps || []).length > 0 && (
                  <div className="space-y-1.5">
                    {(newVersionForm.steps || []).map((s: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs">
                        <span className="text-slate-700 font-medium">
                          Step {idx + 1}: <span className="font-semibold">{OPERATION_LABELS[s.operation] || s.operation}</span>{" "}
                          {s.operand_type === "literal" ? s.operand_value : (OPERAND_TYPE_LABELS[s.operand_type] || s.operand_type)}
                        </span>
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-rose-600 hover:bg-rose-50" onClick={() => removeStepRow(idx)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="rounded-lg border border-slate-200 bg-white p-2.5 grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-semibold text-slate-500 uppercase">Operation</Label>
                    <Select value={stepDraft.operation} onValueChange={(val) => setStepDraft(prev => ({ ...prev, operation: val }))}>
                      <SelectTrigger className="h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="add">Add</SelectItem>
                        <SelectItem value="subtract">Subtract</SelectItem>
                        <SelectItem value="multiply">Multiply</SelectItem>
                        <SelectItem value="divide">Divide</SelectItem>
                        <SelectItem value="round_up">Round Up (2 decimals)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-semibold text-slate-500 uppercase">Operand</Label>
                    <Select value={stepDraft.operand_type} onValueChange={(val) => setStepDraft(prev => ({ ...prev, operand_type: val }))}>
                      <SelectTrigger className="h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="literal">A number</SelectItem>
                        <SelectItem value="rate_of_base_item">Rate of Base Item</SelectItem>
                        <SelectItem value="converted_kg_of_base_item">Converted KGS of Base Item</SelectItem>
                        <SelectItem value="converted_kg_of_child_item">Converted KGS of Child Item</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {stepDraft.operand_type === "literal" ? (
                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold text-slate-500 uppercase">Value</Label>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          className="h-8 text-xs bg-white"
                          value={stepDraft.operand_value}
                          onChange={(e) => setStepDraft(prev => ({ ...prev, operand_value: e.target.value }))}
                          placeholder="e.g. 6.5"
                        />
                        <Button type="button" size="icon" className="h-8 w-8 shrink-0 bg-emerald-600 hover:bg-emerald-700" onClick={addStepRow}>
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-end">
                      <Button type="button" size="sm" className="h-8 text-xs w-full bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1" onClick={addStepRow}>
                        <Plus className="h-3.5 w-3.5" /> Add Step
                      </Button>
                    </div>
                  )}
                </div>
              </div>
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
                        {getSnapshotValue(version, label)}
                      </td>
                    ))}

                    <td className="py-2.5 px-3 text-left border-r border-slate-200 whitespace-nowrap text-[11px] text-slate-600">
                      <div className="flex items-center justify-start gap-1 font-medium">
                        <User className="h-3 w-3 text-slate-400" />
                        <span>{version.changedByName}</span>
                      </div>
                      {version.changedAt && <div className="text-[10px] text-slate-400 font-normal pl-4">{fmtDateTime(version.changedAt)}</div>}
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
