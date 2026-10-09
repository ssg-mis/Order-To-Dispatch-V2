"use client"

import {useState, useMemo, useEffect, useRef} from "react"
import { fmtDate, fmtDateTime } from "@/lib/table-format"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Loader2,
  Boxes,
  Receipt,
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
import { masterHistoryApi, rawMaterialApi } from "@/lib/api-service"
import { useToast } from "@/hooks/use-toast"

type RawMaterialSectionType = "basic" | "tax_compliance" | "accounting"

interface RawMaterialEffectiveDatesModalViewProps {
  rawMaterialId: number
  rawMaterialName: string
  rawMaterialForm?: Record<string, any>
  initialSection: RawMaterialSectionType
  targetFieldName?: string
  unitOptions?: any[]
  stockGroupOptions?: any[]
  activeGstRates?: any[]
  activeHsnCodes?: any[]
  activeSacCodes?: any[]
  ledgerOptions?: any[]
  onBack: () => void
  onRawMaterialUpdated?: (data: any) => void
}

export function RawMaterialEffectiveDatesModalView({
  rawMaterialId,
  rawMaterialName,
  rawMaterialForm = {},
  initialSection = "basic",
  targetFieldName,
  unitOptions = [],
  stockGroupOptions = [],
  activeGstRates = [],
  activeHsnCodes = [],
  activeSacCodes = [],
  ledgerOptions = [],
  onBack,
  onRawMaterialUpdated,
}: RawMaterialEffectiveDatesModalViewProps) {

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

  const [activeSection, setActiveSection] = useState<RawMaterialSectionType>(initialSection)
  const [isAdding, setIsAdding] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const wefDateInputRef = useRef<HTMLInputElement | null>(null)
  const [uomDraft, setUomDraft] = useState({ uom_id: "", conversion_ratio: "" })
  // Tracks the version currently loaded via "Edit" (its row ids + original
  // W.E.F date) so that saving under a CHANGED date can delete the original
  // rows instead of leaving a stale duplicate version behind at the old date.
  const [editingVersion, setEditingVersion] = useState<{ ids: number[]; wefDate: string } | null>(null)

  const getInitialFormState = () => ({
    wefDate: getTodayStr(),
    name: rawMaterialForm.name || "",
    main_uom_id: rawMaterialForm.main_uom_id ? String(rawMaterialForm.main_uom_id) : "",
    stock_group_id: rawMaterialForm.stock_group_id ? String(rawMaterialForm.stock_group_id) : "",
    additional_uoms: Array.isArray(rawMaterialForm.additional_uoms) ? JSON.parse(JSON.stringify(rawMaterialForm.additional_uoms)) : [],
    type_of_supply: rawMaterialForm.type_of_supply || "",
    gst_rate_id: rawMaterialForm.gst_rate_id ? String(rawMaterialForm.gst_rate_id) : "",
    hsn_code_id: rawMaterialForm.hsn_code_id ? String(rawMaterialForm.hsn_code_id) : "",
    sac_code_id: rawMaterialForm.sac_code_id ? String(rawMaterialForm.sac_code_id) : "",
    default_accounting_ledger_id: rawMaterialForm.default_accounting_ledger_id ? String(rawMaterialForm.default_accounting_ledger_id) : "",
    status: rawMaterialForm.status || "Active",
    batch_tracking_enabled: !!rawMaterialForm.batch_tracking_enabled,
  })

  const [newVersionForm, setNewVersionForm] = useState<Record<string, any>>(getInitialFormState())

  useEffect(() => {
    setNewVersionForm(getInitialFormState())
  }, [rawMaterialForm, activeSection])

  useEffect(() => {
    if (isAdding && wefDateInputRef.current) {
      setTimeout(() => wefDateInputRef.current?.focus(), 100)
    }
  }, [isAdding, activeSection])

  useEffect(() => {
    setActiveSection(initialSection)
    setIsAdding(true)
    setEditingVersion(null)
  }, [initialSection])

  const { data: historyData, isLoading, refetch } = useQuery({
    queryKey: ["raw-material-history-modal", rawMaterialId],
    queryFn: async () => {
      if (!rawMaterialId) return []
      const res = await masterHistoryApi.getHistory("raw_materials", rawMaterialId)
      if (res?.success && Array.isArray(res.data)) {
        return res.data.map((item: any) => ({
          ...item,
          wefDate: item.applicableFrom || item.wef_date || item.createdAt,
        }))
      }
      return []
    },
    enabled: !!rawMaterialId,
    staleTime: 0,
    refetchOnMount: "always",
  })

  const sectionTitles: Record<RawMaterialSectionType, string> = {
    basic: "Basic Details History Table",
    tax_compliance: "Tax & Compliance History Table",
    accounting: "Accounting & Settings History Table",
  }

  const DEDICATED_COLUMNS: Record<RawMaterialSectionType, string[]> = {
    basic: ["Name", "UOM", "Stock Group", "Additional UOMs"],
    tax_compliance: ["Type of Supply", "GST Rate", "HSN Code", "SAC Code"],
    accounting: ["Default Accounting Ledger", "Status", "Batch Tracking Enabled"],
  }

  const FIELD_LABEL_TO_KEY: Record<string, string> = {
    "Name": "name",
    "UOM": "main_uom_id",
    "Stock Group": "stock_group_id",
    "Additional UOMs": "additional_uoms",
    "Type of Supply": "type_of_supply",
    "GST Rate": "gst_rate_id",
    "HSN Code": "hsn_code_id",
    "SAC Code": "sac_code_id",
    "Default Accounting Ledger": "default_accounting_ledger_id",
    "Status": "status",
    "Batch Tracking Enabled": "batch_tracking_enabled",
  }

  const REFERENCE_KEYS = new Set(["main_uom_id", "stock_group_id", "gst_rate_id", "hsn_code_id", "sac_code_id", "default_accounting_ledger_id"])

  // Reference fields are logged as "Readable Label (#id)" - human-readable in
  // the audit table, but the "(#id)" suffix lets handleEditVersion reliably
  // restore the exact original selection instead of re-matching by name.
  const getUomLabel = (id: any) => {
    if (!id) return "—"
    const found = unitOptions.find((u: any) => String(u.id) === String(id))
    return found ? `${found.unit_name} (#${found.id})` : id
  }
  const getStockGroupLabel = (id: any) => {
    if (!id) return "—"
    const found = stockGroupOptions.find((g: any) => String(g.id) === String(id))
    return found ? `${found.group_name} (#${found.id})` : id
  }
  const getGstRateLabel = (id: any) => {
    if (!id) return "—"
    const found = activeGstRates.find((r: any) => String(r.id) === String(id))
    return found ? `${found.rate != null ? `${found.rate}%` : found.name} (#${found.id})` : id
  }
  const getHsnLabel = (id: any) => {
    if (!id) return "—"
    const found = activeHsnCodes.find((r: any) => String(r.id) === String(id))
    return found ? `${found.code} - ${found.name} (#${found.id})` : id
  }
  const getSacLabel = (id: any) => {
    if (!id) return "—"
    const found = activeSacCodes.find((r: any) => String(r.id) === String(id))
    return found ? `${found.code} - ${found.name} (#${found.id})` : id
  }
  const getLedgerLabel = (id: any) => {
    if (!id) return "—"
    const found = ledgerOptions.find((l: any) => String(l.id) === String(id))
    return found ? `${found.ledger_name} (#${found.id})` : id
  }

  const getRefLabel = (key: string, id: any) => {
    if (key === "main_uom_id") return getUomLabel(id)
    if (key === "stock_group_id") return getStockGroupLabel(id)
    if (key === "gst_rate_id") return getGstRateLabel(id)
    if (key === "hsn_code_id") return getHsnLabel(id)
    if (key === "sac_code_id") return getSacLabel(id)
    if (key === "default_accounting_ledger_id") return getLedgerLabel(id)
    return id
  }

  const parseIdFromLabel = (label: string): string | null => {
    if (!label) return null
    const match = label.match(/\(#(\d+)\)/)
    return match ? match[1] : null
  }

  // Additional UOMs mix a uom_id AND its conversion ratio in one array item, so
  // each entry is logged as "Name (1=ratio) (#uomId:ratio)" - the embedded tag
  // lets a historical version be parsed back into the exact {uom_id,
  // conversion_ratio} pairs, not just guessed.
  const getAdditionalUomsLabel = (items: any[]) => {
    if (!items || items.length === 0) return "—"
    return items
      .map((item: any) => {
        const unit = unitOptions.find((u: any) => String(u.id) === String(item.uom_id))
        const name = unit?.unit_name || `#${item.uom_id}`
        return `${name} (1=${item.conversion_ratio}) (#${item.uom_id}:${item.conversion_ratio})`
      })
      .join(", ")
  }

  const parseAdditionalUomsFromLabel = (label: string): { uom_id: string; conversion_ratio: string }[] => {
    if (!label) return []
    const matches = [...label.matchAll(/\(#(\d+):([\d.]+)\)/g)]
    return matches.map((m) => ({ uom_id: m[1], conversion_ratio: m[2] }))
  }

  const getSnapshotValue = (version: any, fieldName: string): string => {
    const raw = version.snapshot?.[fieldName] ?? "—"
    if (typeof raw !== "string") return raw
    if (fieldName === "Additional UOMs") return raw.replace(/\s*\(#[\d.:]+\)/g, "")
    return raw.replace(/\s*\(#\d+\)/g, "")
  }

  const rawItems = (historyData || []).filter((item: any) => DEDICATED_COLUMNS[activeSection].includes(item.fieldName))

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
        dateMap.set(key, { wefDate: key, changedByName: item.changedByName || item.changedBy || "Admin", changedAt: null, changes: [], ids: [] })
      }

      const entry = dateMap.get(key)
      entry.changedAt = item.createdAt || item.updatedAt || item.changedAt || entry.changedAt
      if (item.id && !entry.ids.includes(item.id)) entry.ids.push(item.id)
      if (item.fieldName) {
        entry.changes.push({ id: item.id, fieldName: item.fieldName, oldValue: item.oldValue, newValue: item.newValue })
        if (item.changedByName) entry.changedByName = item.changedByName
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
    if (!rawMaterialId) return
    if (!newVersionForm.wefDate) {
      toast({ title: "Validation Error", description: "Applicable From Date (W.E.F.) is required", variant: "destructive" })
      return
    }

    try {
      setIsSaving(true)

      const logEntries = DEDICATED_COLUMNS[activeSection].map((label) => {
        const key = FIELD_LABEL_TO_KEY[label]
        if (key === "additional_uoms") {
          return { fieldName: label, oldValue: getAdditionalUomsLabel(rawMaterialForm[key] || []), newValue: getAdditionalUomsLabel(newVersionForm[key] || []) }
        }
        if (key === "batch_tracking_enabled") {
          return { fieldName: label, oldValue: rawMaterialForm[key] ? "Yes" : "No", newValue: newVersionForm[key] ? "Yes" : "No" }
        }
        const isRef = REFERENCE_KEYS.has(key)
        const oldValue = isRef ? getRefLabel(key, rawMaterialForm[key]) : (rawMaterialForm[key] ?? "—")
        const newValue = isRef ? getRefLabel(key, newVersionForm[key]) : (newVersionForm[key] || "—")
        return { fieldName: label, oldValue, newValue }
      })

      for (const entry of logEntries) {
        await masterHistoryApi.logHistory({
          masterType: "raw_materials",
          recordId: rawMaterialId,
          fieldName: entry.fieldName,
          oldValue: String(entry.oldValue),
          newValue: String(entry.newValue),
          applicableFrom: newVersionForm.wefDate,
        })
      }

      const todayStr = getTodayStr()
      if (newVersionForm.wefDate <= todayStr) {
        const sectionKeys = DEDICATED_COLUMNS[activeSection].map((label) => FIELD_LABEL_TO_KEY[label])
        const payload: Record<string, any> = {}
        for (const key of sectionKeys) {
          if (key === "additional_uoms") {
            payload[key] = newVersionForm[key]
          } else if (REFERENCE_KEYS.has(key)) {
            payload[key] = newVersionForm[key] ? parseInt(newVersionForm[key], 10) : null
          } else if (key === "batch_tracking_enabled") {
            payload[key] = !!newVersionForm[key]
          } else {
            payload[key] = newVersionForm[key]
          }
        }
        await rawMaterialApi.update(rawMaterialId, payload)

        const updated = await rawMaterialApi.getById(String(rawMaterialId))
        if (updated?.success && updated.data && onRawMaterialUpdated) {
          onRawMaterialUpdated(updated.data)
        }
        await queryClient.invalidateQueries({ queryKey: ["master-raw-materials"] })
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
      await queryClient.invalidateQueries({ queryKey: ["raw-material-history-modal", rawMaterialId] })
      await queryClient.invalidateQueries({ queryKey: ["raw-material-sectional-history"] })
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

    DEDICATED_COLUMNS[activeSection].forEach((label) => {
      const key = FIELD_LABEL_TO_KEY[label]
      const loggedValue = snap[label]
      if (loggedValue === undefined || loggedValue === "—") return

      if (key === "additional_uoms") {
        overrides[key] = parseAdditionalUomsFromLabel(loggedValue)
      } else if (key === "batch_tracking_enabled") {
        overrides[key] = loggedValue === "Yes"
      } else if (REFERENCE_KEYS.has(key)) {
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
      toast({ title: "Info", description: "This is a baseline record and cannot be deleted." })
      return
    }
    try {
      for (const id of ids) await masterHistoryApi.deleteHistory(id)
      toast({ title: "Success", description: "Version deleted successfully." })
      await queryClient.invalidateQueries({ queryKey: ["raw-material-history-modal", rawMaterialId] })
      await queryClient.invalidateQueries({ queryKey: ["raw-material-sectional-history"] })
      await refetch()
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to delete version.", variant: "destructive" })
    }
  }

  const removeUomRow = (idx: number) => {
    setNewVersionForm((prev: any) => ({ ...prev, additional_uoms: (prev.additional_uoms || []).filter((_: any, i: number) => i !== idx) }))
  }

  const addUomRow = () => {
    if (!uomDraft.uom_id || !uomDraft.conversion_ratio) {
      toast({ title: "Error", description: "Select a UOM and enter the conversion ratio", variant: "destructive" })
      return
    }
    setNewVersionForm((prev: any) => ({ ...prev, additional_uoms: [...(prev.additional_uoms || []), { uom_id: uomDraft.uom_id, conversion_ratio: uomDraft.conversion_ratio }] }))
    setUomDraft({ uom_id: "", conversion_ratio: "" })
  }

  const renderField = (label: string) => {
    const key = FIELD_LABEL_TO_KEY[label]

    if (key === "main_uom_id") {
      return (
        <Select value={newVersionForm.main_uom_id} onValueChange={(val) => setNewVersionForm(prev => ({ ...prev, main_uom_id: val }))}>
          <SelectTrigger className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors">
            <SelectValue placeholder="Select UOM" />
          </SelectTrigger>
          <SelectContent>
            {unitOptions.map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.unit_name}</SelectItem>)}
          </SelectContent>
        </Select>
      )
    }
    if (key === "stock_group_id") {
      return (
        <Select value={newVersionForm.stock_group_id} onValueChange={(val) => setNewVersionForm(prev => ({ ...prev, stock_group_id: val }))}>
          <SelectTrigger className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors">
            <SelectValue placeholder="Select stock group" />
          </SelectTrigger>
          <SelectContent>
            {stockGroupOptions.map((g: any) => <SelectItem key={g.id} value={String(g.id)}>{g.group_name}</SelectItem>)}
          </SelectContent>
        </Select>
      )
    }
    if (key === "additional_uoms") {
      const items: any[] = newVersionForm.additional_uoms || []
      const baseUom = unitOptions.find((u: any) => String(u.id) === String(newVersionForm.main_uom_id))
      const baseUomName = baseUom?.unit_name || "base UOM"
      return (
        <div className="space-y-2">
          {items.length > 0 && (
            <div className="space-y-1.5">
              {items.map((row: any, idx: number) => {
                const unit = unitOptions.find((u: any) => String(u.id) === String(row.uom_id))
                return (
                  <div key={idx} className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs">
                    <span className="text-slate-700 font-medium">1 {unit?.unit_name || `UOM #${row.uom_id}`} = {row.conversion_ratio} {baseUomName}</span>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-rose-600 hover:bg-rose-50" onClick={() => removeUomRow(idx)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
          <p className="text-[11px] text-slate-500">
            Add another unit this raw material can be measured in, and how many <span className="font-semibold text-slate-700">{baseUomName}</span> (the main UOM) equal 1 of it.
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 shrink-0">1</span>
            <Select value={uomDraft.uom_id} onValueChange={(val) => setUomDraft(prev => ({ ...prev, uom_id: val }))}>
              <SelectTrigger className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors w-44 shrink-0">
                <SelectValue placeholder="Select UOM" />
              </SelectTrigger>
              <SelectContent>
                {unitOptions.map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.unit_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-xs font-semibold text-slate-400 shrink-0">=</span>
            <Input
              type="number"
              min={0}
              className="h-9 w-20 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors shrink-0"
              value={uomDraft.conversion_ratio}
              onChange={(e) => setUomDraft(prev => ({ ...prev, conversion_ratio: e.target.value }))}
              placeholder="10"
            />
            <span className="text-xs font-semibold text-slate-700 shrink-0 whitespace-nowrap">{baseUomName}</span>
            <Button type="button" size="icon" className="h-8 w-8 shrink-0 bg-emerald-600 hover:bg-emerald-700" onClick={addUomRow}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )
    }
    if (key === "type_of_supply") {
      return (
        <Select value={newVersionForm.type_of_supply} onValueChange={(val) => setNewVersionForm(prev => ({ ...prev, type_of_supply: val }))}>
          <SelectTrigger className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Goods">Goods</SelectItem>
            <SelectItem value="Services">Services</SelectItem>
          </SelectContent>
        </Select>
      )
    }
    if (key === "gst_rate_id") {
      return (
        <Select value={newVersionForm.gst_rate_id} onValueChange={(val) => setNewVersionForm(prev => ({ ...prev, gst_rate_id: val }))}>
          <SelectTrigger className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors">
            <SelectValue placeholder="Select GST rate" />
          </SelectTrigger>
          <SelectContent>
            {activeGstRates.map((r: any) => <SelectItem key={r.id} value={String(r.id)}>{r.rate != null ? `${r.rate}%` : r.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )
    }
    if (key === "hsn_code_id") {
      return (
        <Select value={newVersionForm.hsn_code_id} onValueChange={(val) => setNewVersionForm(prev => ({ ...prev, hsn_code_id: val }))}>
          <SelectTrigger className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors">
            <SelectValue placeholder="Select HSN code" />
          </SelectTrigger>
          <SelectContent>
            {activeHsnCodes.map((r: any) => <SelectItem key={r.id} value={String(r.id)}>{r.code} - {r.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )
    }
    if (key === "sac_code_id") {
      return (
        <Select value={newVersionForm.sac_code_id} onValueChange={(val) => setNewVersionForm(prev => ({ ...prev, sac_code_id: val }))}>
          <SelectTrigger className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors">
            <SelectValue placeholder="Select SAC code" />
          </SelectTrigger>
          <SelectContent>
            {activeSacCodes.map((r: any) => <SelectItem key={r.id} value={String(r.id)}>{r.code} - {r.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )
    }
    if (key === "default_accounting_ledger_id") {
      return (
        <Select value={newVersionForm.default_accounting_ledger_id} onValueChange={(val) => setNewVersionForm(prev => ({ ...prev, default_accounting_ledger_id: val }))}>
          <SelectTrigger className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors">
            <SelectValue placeholder="Select ledger" />
          </SelectTrigger>
          <SelectContent>
            {ledgerOptions.map((l: any) => <SelectItem key={l.id} value={String(l.id)}>{l.ledger_name}</SelectItem>)}
          </SelectContent>
        </Select>
      )
    }
    if (key === "status") {
      return (
        <Select value={newVersionForm.status || "Active"} onValueChange={(val) => setNewVersionForm(prev => ({ ...prev, status: val }))}>
          <SelectTrigger className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors">
            <SelectValue placeholder="Select Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      )
    }
    if (key === "batch_tracking_enabled") {
      return (
        <Select value={newVersionForm.batch_tracking_enabled ? "Yes" : "No"} onValueChange={(val) => setNewVersionForm(prev => ({ ...prev, batch_tracking_enabled: val === "Yes" }))}>
          <SelectTrigger className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors">
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Yes">Yes</SelectItem>
            <SelectItem value="No">No</SelectItem>
          </SelectContent>
        </Select>
      )
    }

    return (
      <Input
        className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors"
        value={newVersionForm[key] ?? ""}
        onChange={(e) => setNewVersionForm(prev => ({ ...prev, [key]: e.target.value }))}
        placeholder={label}
      />
    )
  }

  const visibleColumnsForSection = (section: RawMaterialSectionType) => {
    return DEDICATED_COLUMNS[section].filter((label) => {
      if (label === "HSN Code") return newVersionForm.type_of_supply !== "Services"
      if (label === "SAC Code") return newVersionForm.type_of_supply === "Services"
      return true
    })
  }

  const SECTION_TABS: { key: RawMaterialSectionType; label: string; icon: any; activeClass: string }[] = [
    { key: "basic", label: "Basic Details History", icon: Boxes, activeClass: "bg-slate-900" },
    { key: "tax_compliance", label: "Tax & Compliance History", icon: Receipt, activeClass: "bg-blue-600" },
    { key: "accounting", label: "Accounting & Settings History", icon: Landmark, activeClass: "bg-emerald-600" },
  ]

  return (
    <div className="space-y-4 text-slate-800">
      <div className="sticky -top-6 z-50 -mt-6 -mx-6 px-6 pt-4 pb-2.5 mb-2 rounded-t-lg bg-slate-50 border-b border-slate-200 flex items-center justify-between [&>button]:bg-white [&>button]:shadow-sm">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onBack}
          className="h-8 px-2.5 text-xs font-semibold bg-white border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 flex items-center gap-1.5 shadow-2xs rounded-md"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Raw Material Form
        </Button>
      </div>

      <div className="border-b pb-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-600" />
          Raw Material Effective-Dated Versions & History
        </h2>
        <p className="text-xs text-slate-500 font-medium mt-0.5">
          Raw Material: <span className="font-bold text-slate-800">{rawMaterialName || `#${rawMaterialId}`}</span>
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {SECTION_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => { setActiveSection(tab.key); setIsAdding(false) }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeSection === tab.key
                ? `${tab.activeClass} text-white shadow-xs`
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200">
        <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
          <User className="h-3.5 w-3.5 text-blue-600" />
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
              Log New {sectionTitles[activeSection].replace(" History Table", "").toUpperCase()} Version (Applicable From Date)
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

            {visibleColumnsForSection(activeSection).map((label) => (
              <div key={label} className={`space-y-1.5 ${label === "Additional UOMs" ? "sm:col-span-2 lg:col-span-3" : ""}`}>
                <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">{label}</Label>
                {renderField(label)}
              </div>
            ))}
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
                {DEDICATED_COLUMNS[activeSection].map((label) => (
                  <th key={label} className="py-2.5 px-3 border-r border-slate-300 whitespace-nowrap">{label}</th>
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
                      isActive ? "bg-emerald-50/40 font-medium" : isFuture ? "bg-amber-50/30" : vIdx % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                    } hover:bg-slate-100/80`}
                  >
                    <td className="py-2 px-3 font-bold text-slate-900 bg-amber-50/50 border-r border-slate-300 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Calendar className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                        <span className="font-mono text-[11px]">{formattedWef}</span>
                        
                        
                      </div>
                    </td>

                    {DEDICATED_COLUMNS[activeSection].map((label) => (
                      <td key={label} className="py-2.5 px-3 border-r border-slate-200 text-slate-700 font-medium">
                        {getSnapshotValue(version, label)}
                      </td>
                    ))}

                    <td className="py-2.5 px-3 text-left border-r border-slate-200 whitespace-nowrap text-[11px] text-slate-600">
                      <div className="flex items-center justify-start gap-1">
                        <User className="h-3 w-3 text-slate-400 shrink-0" />
                        <div className="flex flex-col leading-tight">
                          <span className="font-medium">{version.changedByName}</span>
                          <span className="text-[10px] text-slate-400 font-normal">{fmtDateTime(version.changedAt)}</span>
                        </div>
                      </div>
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
