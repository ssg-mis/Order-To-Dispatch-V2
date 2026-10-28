"use client"

import {useState, useMemo, useEffect, useRef} from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Loader2,
  Truck,
  Scale,
  ShieldCheck,
  FileText,
  Satellite,
  Image as ImageIcon,
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
import { Combobox } from "@/components/ui/combobox"
import { MultiCombobox } from "@/components/ui/multi-combobox"
import { masterHistoryApi, vehicleMasterApi } from "@/lib/api-service"
import { useToast } from "@/hooks/use-toast"
import { fmtDate, fmtDateTime, fmtHistoryAmount } from "@/lib/table-format"
import { fmtHistoryWeight } from "@/lib/weight-col"
import { getWeightDecimals } from "@/lib/weight-format"
import { useWeightDecimals } from "@/hooks/use-weight-decimals"

// Display-only: render ISO date strings as dd/mm/yyyy (raw values are untouched elsewhere).
const displayVal = (v: any): any =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/.test(v.trim()) ? fmtDate(v.trim()) : v

type VehicleSectionType = "basic" | "weights" | "tax_compliance" | "permits" | "gps" | "documents"

interface VehicleEffectiveDatesModalViewProps {
  vehicleId: number
  registrationNo: string
  vehicleForm?: Record<string, any>
  initialSection: VehicleSectionType
  targetFieldName?: string
  transporterOptions?: any[]
  activeRtoCodes?: any[]
  onBack: () => void
  onVehicleUpdated?: (data: any) => void
}

export function VehicleEffectiveDatesModalView({
  vehicleId,
  registrationNo,
  vehicleForm = {},
  initialSection = "basic",
  targetFieldName,
  transporterOptions = [],
  activeRtoCodes = [],
  onBack,
  onVehicleUpdated,
}: VehicleEffectiveDatesModalViewProps) {
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

  const [activeSection, setActiveSection] = useState<VehicleSectionType>(initialSection)
  const [isAdding, setIsAdding] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  // Tracks the version currently loaded via "Edit" (its row ids + original
  // W.E.F date) so that saving under a CHANGED date can delete the original
  // rows instead of leaving a stale duplicate version behind at the old date.
  const [editingVersion, setEditingVersion] = useState<{ ids: number[]; wefDate: string } | null>(null)
  const wefDateInputRef = useRef<HTMLInputElement | null>(null)

  const getInitialFormState = () => ({
    wefDate: getTodayStr(),
    // Basic
    registration_no: vehicleForm.registration_no || "",
    vehicle_type: vehicleForm.vehicle_type || "",
    transporter: vehicleForm.transporter || "",
    status: vehicleForm.status || "Active",
    fuel_type: vehicleForm.fuel_type || "Diesel",
    rto: vehicleForm.rto || "",
    rto_id: vehicleForm.rto_id ? String(vehicleForm.rto_id) : "",
    additional_transporter_ids: (vehicleForm.additional_transporter_ids || []).map((id: number) => String(id)),
    // Weights
    gvw: vehicleForm.gvw ?? "",
    ulw: vehicleForm.ulw ?? "",
    passing: vehicleForm.passing ?? "",
    // Tax & Compliance
    road_tax: vehicleForm.road_tax?.split("T")[0] || "",
    life_time_tax: vehicleForm.life_time_tax?.split("T")[0] || "",
    pollution: vehicleForm.pollution?.split("T")[0] || "",
    insurance: vehicleForm.insurance?.split("T")[0] || "",
    fitness: vehicleForm.fitness?.split("T")[0] || "",
    // Permits
    state_permit: vehicleForm.state_permit?.split("T")[0] || "",
    state_permit_type: vehicleForm.state_permit_type || "",
    national_permit: vehicleForm.national_permit?.split("T")[0] || "",
    // GPS
    gps_company: vehicleForm.gps_company || "",
    gps_type: vehicleForm.gps_type || "",
    gps_api_tracking_link: vehicleForm.gps_api_tracking_link || "",
    gps_valid_upto: vehicleForm.gps_valid_upto?.split("T")[0] || "",
    gps_installed_by: vehicleForm.gps_installed_by || "",
    // Documents (URLs)
    rc_image: vehicleForm.rc_image || "",
    road_tax_image: vehicleForm.road_tax_image || "",
    life_time_tax_image: vehicleForm.life_time_tax_image || "",
    pollution_image: vehicleForm.pollution_image || "",
    insurance_image: vehicleForm.insurance_image || "",
    fitness_image: vehicleForm.fitness_image || "",
    state_permit_image: vehicleForm.state_permit_image || "",
    national_permit_image: vehicleForm.national_permit_image || "",
  })

  const [newVersionForm, setNewVersionForm] = useState<Record<string, any>>(getInitialFormState())

  useEffect(() => {
    setNewVersionForm(getInitialFormState())
  }, [vehicleForm, activeSection])

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
    queryKey: ["vehicle-history-modal", vehicleId],
    queryFn: async () => {
      if (!vehicleId) return []
      const res = await masterHistoryApi.getHistory("vehicle_master", vehicleId)
      if (res?.success && Array.isArray(res.data)) {
        return res.data.map((item: any) => ({
          ...item,
          wefDate: item.applicableFrom || item.wef_date || item.createdAt,
        }))
      }
      return []
    },
    enabled: !!vehicleId,
    staleTime: 0,
    refetchOnMount: "always",
  })

  const sectionTitles: Record<VehicleSectionType, string> = {
    basic: "Basic Details History Table",
    weights: "Weights History Table",
    tax_compliance: "Tax & Compliance History Table",
    permits: "Permits History Table",
    gps: "GPS Tracking History Table",
    documents: "Documents History Table",
  }

  const DEDICATED_COLUMNS: Record<VehicleSectionType, string[]> = {
    basic: ["Registration No", "Vehicle Type", "Transporter", "Status", "Fuel Type", "RTO", "RTO Code", "Additional Transporters"],
    weights: ["GVW (KGS)", "ULW (KGS)", "Passing (KGS)"],
    tax_compliance: ["Road Tax Expiry", "Life Time Tax", "Pollution Expiry", "Insurance Expiry", "Fitness Expiry"],
    permits: ["State Permit Expiry", "State Permit Type", "National Permit Expiry"],
    gps: ["GPS Company", "GPS Type", "GPS API/Tracking Link", "GPS Valid Upto", "GPS Installed By"],
    documents: ["RC Image", "Road Tax Image", "Life Time Tax Image", "Pollution Image", "Insurance Image", "Fitness Image", "State Permit Image", "National Permit Image"],
  }

  const FIELD_LABEL_TO_KEY: Record<string, string> = {
    "Registration No": "registration_no",
    "Vehicle Type": "vehicle_type",
    "Transporter": "transporter",
    "Status": "status",
    "Fuel Type": "fuel_type",
    "RTO": "rto",
    "RTO Code": "rto_id",
    "Additional Transporters": "additional_transporter_ids",
    "GVW (KGS)": "gvw",
    "ULW (KGS)": "ulw",
    "Passing (KGS)": "passing",
    "Road Tax Expiry": "road_tax",
    "Life Time Tax": "life_time_tax",
    "Pollution Expiry": "pollution",
    "Insurance Expiry": "insurance",
    "Fitness Expiry": "fitness",
    "State Permit Expiry": "state_permit",
    "State Permit Type": "state_permit_type",
    "National Permit Expiry": "national_permit",
    "GPS Company": "gps_company",
    "GPS Type": "gps_type",
    "GPS API/Tracking Link": "gps_api_tracking_link",
    "GPS Valid Upto": "gps_valid_upto",
    "GPS Installed By": "gps_installed_by",
    "RC Image": "rc_image",
    "Road Tax Image": "road_tax_image",
    "Life Time Tax Image": "life_time_tax_image",
    "Pollution Image": "pollution_image",
    "Insurance Image": "insurance_image",
    "Fitness Image": "fitness_image",
    "State Permit Image": "state_permit_image",
    "National Permit Image": "national_permit_image",
  }

  // Reference fields are logged as "Readable Label (#id)" - human-readable in the
  // audit table, but the "(#id)" suffix lets handleEditVersion reliably restore
  // the exact original selection instead of re-matching by name (which breaks if
  // two records ever share a display name).
  const getRtoLabel = (id: any) => {
    if (!id) return "—"
    const found = activeRtoCodes.find((r: any) => String(r.id) === String(id))
    return found ? `${found.code} - ${found.name} (#${found.id})` : id
  }

  const getTransporterListLabel = (ids: any[]) => {
    if (!ids || ids.length === 0) return "—"
    const names = ids.map((id: any) => {
      const found = transporterOptions.find((t: any) => String(t.id) === String(id))
      return found ? `${found.transporter_name} (#${found.id})` : `#${id}`
    })
    return names.join(", ")
  }

  // Pulls every "(#123)" id out of a logged reference string, e.g. turns
  // "Modi Roadways (#12), Sharma Transport (#7)" back into [12, 7]. Returns []
  // for older history rows logged before this format existed (plain names,
  // no "(#id)" suffix) - those fields just fall back to the current live value.
  const parseIdsFromLabel = (label: string): string[] => {
    if (!label) return []
    const matches = [...label.matchAll(/\(#(\d+)\)/g)]
    return matches.map((m) => m[1])
  }

  // The history table shows clean names to the user - the "(#id)" suffix logged
  // alongside them (see getRtoLabel/getTransporterListLabel) is only there for
  // handleEditVersion to parse back reliably, not meant to be visible.
  const getSnapshotValue = (version: any, fieldName: string): string => {
    const raw = version.snapshot?.[fieldName] ?? "—"
    return displayVal(raw.replace(/\s*\(#\d+\)/g, ""))
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
        dateMap.set(key, { wefDate: key, changedByName: item.changedByName || item.changedBy || "Admin", changedAt: item.createdAt || item.updatedAt || item.changedAt, changes: [], ids: [] })
      }

      const entry = dateMap.get(key)
      if (item.id && !entry.ids.includes(item.id)) entry.ids.push(item.id)
      if (item.fieldName) {
        entry.changes.push({ id: item.id, fieldName: item.fieldName, oldValue: item.oldValue, newValue: item.newValue })
        if (item.changedByName) entry.changedByName = item.changedByName
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
    if (!vehicleId) return
    if (!newVersionForm.wefDate) {
      toast({ title: "Validation Error", description: "Applicable From Date (W.E.F.) is required", variant: "destructive" })
      return
    }

    try {
      setIsSaving(true)

      const logEntries = DEDICATED_COLUMNS[activeSection].map((label) => {
        const key = FIELD_LABEL_TO_KEY[label]
        const isRtoRef = key === "rto_id"
        const isTransporterList = key === "additional_transporter_ids"
        const oldValue = isRtoRef
          ? getRtoLabel(vehicleForm[key])
          : isTransporterList
          ? getTransporterListLabel(vehicleForm[key] || [])
          : (vehicleForm[key] ?? "—")
        const newValue = isRtoRef
          ? getRtoLabel(newVersionForm[key])
          : isTransporterList
          ? getTransporterListLabel((newVersionForm[key] || []).map((v: any) => parseInt(v, 10)))
          : (newVersionForm[key] || "—")
        return { fieldName: label, oldValue, newValue }
      })

      for (const entry of logEntries) {
        await masterHistoryApi.logHistory({
          masterType: "vehicle_master",
          recordId: vehicleId,
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
          if (key === "rto_id") {
            payload[key] = newVersionForm[key] || null
          } else if (key === "additional_transporter_ids") {
            payload[key] = (newVersionForm[key] || []).map((v: any) => parseInt(v, 10))
          } else {
            payload[key] = newVersionForm[key]
          }
        }
        await vehicleMasterApi.update(vehicleId, payload)

        const updated = await vehicleMasterApi.getById(vehicleId)
        if (updated?.success && updated.data && onVehicleUpdated) {
          onVehicleUpdated(updated.data)
        }
        await queryClient.invalidateQueries({ queryKey: ["vehicle_master"] })
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
      await queryClient.invalidateQueries({ queryKey: ["vehicle-history-modal", vehicleId] })
      await queryClient.invalidateQueries({ queryKey: ["vehicle-sectional-history"] })
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

      if (key === "rto_id") {
        // Parse the id back out of "MH12 - Mumbai RTO (#5)". Older rows logged
        // before this format existed have no "(#id)" - leave at current value.
        const ids = parseIdsFromLabel(loggedValue)
        if (ids.length > 0) overrides.rto_id = ids[0]
      } else if (key === "additional_transporter_ids") {
        const ids = parseIdsFromLabel(loggedValue)
        if (ids.length > 0) overrides.additional_transporter_ids = ids
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
      await queryClient.invalidateQueries({ queryKey: ["vehicle-history-modal", vehicleId] })
      await queryClient.invalidateQueries({ queryKey: ["vehicle-sectional-history"] })
      await refetch()
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to delete version.", variant: "destructive" })
    }
  }

  const renderField = (label: string) => {
    const key = FIELD_LABEL_TO_KEY[label]
    const isDate = ["road_tax", "life_time_tax", "pollution", "insurance", "fitness", "state_permit", "national_permit", "gps_valid_upto"].includes(key)
    const isNumeric = ["gvw", "ulw", "passing"].includes(key)
    const isImage = key.endsWith("_image")

    if (key === "transporter") {
      return (
        <Combobox
          options={transporterOptions.map((t: any) => ({ value: t.transporter_name, label: t.transporter_name }))}
          value={newVersionForm.transporter}
          onValueChange={(val: string) => setNewVersionForm(prev => ({ ...prev, transporter: val }))}
          placeholder="Select transporter"
          searchPlaceholder="Search transporter..."
          className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors"
        />
      )
    }
    if (key === "additional_transporter_ids") {
      return (
        <MultiCombobox
          options={transporterOptions.map((t: any) => ({ value: String(t.id), label: t.transporter_name }))}
          values={newVersionForm.additional_transporter_ids || []}
          onValuesChange={(vals) => setNewVersionForm(prev => ({ ...prev, additional_transporter_ids: vals }))}
          placeholder="Select additional transporters"
          searchPlaceholder="Search transporters..."
          className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors"
        />
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
    if (key === "fuel_type") {
      return (
        <Select value={newVersionForm.fuel_type || "Diesel"} onValueChange={(val) => setNewVersionForm(prev => ({ ...prev, fuel_type: val }))}>
          <SelectTrigger className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors">
            <SelectValue placeholder="Select Fuel Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Diesel">Diesel</SelectItem>
            <SelectItem value="Petrol">Petrol</SelectItem>
            <SelectItem value="Electrical">Electrical</SelectItem>
          </SelectContent>
        </Select>
      )
    }
    if (key === "rto_id") {
      return (
        <Select value={newVersionForm.rto_id ? String(newVersionForm.rto_id) : ""} onValueChange={(val) => setNewVersionForm(prev => ({ ...prev, rto_id: val }))}>
          <SelectTrigger className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors">
            <SelectValue placeholder="Select RTO Code" />
          </SelectTrigger>
          <SelectContent>
            {activeRtoCodes.map((r: any) => (
              <SelectItem key={r.id} value={String(r.id)}>{r.code} - {r.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    }
    if (key === "gps_installed_by") {
      return (
        <Select value={newVersionForm.gps_installed_by || ""} onValueChange={(val) => setNewVersionForm(prev => ({ ...prev, gps_installed_by: val }))}>
          <SelectTrigger className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors">
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Company">Company</SelectItem>
            <SelectItem value="Vehicle Owner">Vehicle Owner</SelectItem>
            <SelectItem value="Transporter">Transporter</SelectItem>
          </SelectContent>
        </Select>
      )
    }
    if (key === "passing") {
      return (
        <Input
          type="number"
          readOnly
          className="h-9 text-xs bg-slate-100 rounded-lg border-slate-200 shadow-xs cursor-not-allowed"
          value={newVersionForm.passing ?? ""}
          placeholder="0"
        />
      )
    }

    return (
      <Input
        type={isDate ? "date" : isNumeric ? "number" : "text"}
        step={isNumeric ? "any" : undefined}
        className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors"
        value={newVersionForm[key] ?? ""}
        onChange={(e) => {
          const val = e.target.value
          setNewVersionForm(prev => {
            const next = { ...prev, [key]: val }
            if (key === "gvw" || key === "ulw") {
              const gvw = key === "gvw" ? val : prev.gvw
              const ulw = key === "ulw" ? val : prev.ulw
              next.passing = gvw !== "" && ulw !== "" ? String(Number(gvw) - Number(ulw)) : ""
            }
            return next
          })
        }}
        placeholder={isImage ? "Paste file URL" : isNumeric ? "0" : label}
      />
    )
  }

  const SECTION_TABS: { key: VehicleSectionType; label: string; icon: any; activeClass: string }[] = [
    { key: "basic", label: "Basic Details History", icon: Truck, activeClass: "bg-slate-900" },
    { key: "weights", label: "Weights History", icon: Scale, activeClass: "bg-blue-600" },
    { key: "tax_compliance", label: "Tax & Compliance History", icon: ShieldCheck, activeClass: "bg-amber-600" },
    { key: "permits", label: "Permits History", icon: FileText, activeClass: "bg-emerald-600" },
    { key: "gps", label: "GPS Tracking History", icon: Satellite, activeClass: "bg-indigo-600" },
    { key: "documents", label: "Documents History", icon: ImageIcon, activeClass: "bg-rose-600" },
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
          <ArrowLeft className="h-4 w-4" /> Back to Vehicle Form
        </Button>
      </div>

      <div className="border-b pb-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-600" />
          Vehicle Effective-Dated Versions & History
        </h2>
        <p className="text-xs text-slate-500 font-medium mt-0.5">
          Vehicle: <span className="font-bold text-slate-800">{registrationNo || `#${vehicleId}`}</span>
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
          <Truck className="h-3.5 w-3.5 text-blue-600" />
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

            {DEDICATED_COLUMNS[activeSection].map((label) => (
              <div key={label} className="space-y-1.5">
                <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                  {label}
                  {FIELD_LABEL_TO_KEY[label] === "passing" && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-slate-400 bg-slate-100 px-1 py-0.5 rounded border border-slate-200 normal-case tracking-normal">
                      <Lock className="h-2.5 w-2.5" /> Auto
                    </span>
                  )}
                </Label>
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
                        {(fmtHistoryWeight(label, getSnapshotValue(version, label), getWeightDecimals()) ?? fmtHistoryAmount(label, getSnapshotValue(version, label)) ?? getSnapshotValue(version, label))}
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
