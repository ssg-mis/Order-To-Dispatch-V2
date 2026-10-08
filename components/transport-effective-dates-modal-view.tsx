"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Loader2,
  Truck,
  Receipt,
  Building2,
  ShieldCheck,
  FileText,
  Plus,
  Save,
  X,
  Trash2,
  Edit,
  ExternalLink,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Combobox } from "@/components/ui/combobox"
import { FileUploadField } from "@/components/file-upload-field"
import { masterHistoryApi, transportMasterApi, orderApi } from "@/lib/api-service"
import { useToast } from "@/hooks/use-toast"
import { fmtDate, fmtDateTime } from "@/lib/table-format"

// Display-only: render ISO date strings as dd/mm/yyyy (raw values are untouched elsewhere).
const displayVal = (v: any): any =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/.test(v.trim()) ? fmtDate(v.trim()) : v

type TransportSectionType = "basic" | "gst" | "msme" | "fssai" | "documents"

interface TransportEffectiveDatesModalViewProps {
  transportId: number
  transporterName: string
  transportForm?: Record<string, any>
  initialSection: TransportSectionType
  targetFieldName?: string
  ledgerGroupOptions?: any[]
  customers?: any[]
  activeStates?: any[]
  activeGstRegStatuses?: any[]
  activeGstRegTypes?: any[]
  activeMsmeRegTypes?: any[]
  activeFssaiLicenceTypes?: any[]
  onBack: () => void
  onTransportUpdated?: (data: any) => void
}

export function TransportEffectiveDatesModalView({
  transportId,
  transporterName,
  transportForm = {},
  initialSection = "basic",
  targetFieldName,
  ledgerGroupOptions = [],
  customers = [],
  activeStates = [],
  activeGstRegStatuses = [],
  activeGstRegTypes = [],
  activeMsmeRegTypes = [],
  activeFssaiLicenceTypes = [],
  onBack,
  onTransportUpdated,
}: TransportEffectiveDatesModalViewProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const getTodayStr = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  }

  const [activeSection, setActiveSection] = useState<TransportSectionType>(initialSection)
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
    transporter_name: transportForm.transporter_name || "",
    contact_person: transportForm.contact_person || "",
    contact_number: transportForm.contact_number || "",
    email_id: transportForm.email_id || "",
    address_line1: transportForm.address_line1 || "",
    pincode: transportForm.pincode || "",
    status: transportForm.status || "Active",
    ledger_group_id: transportForm.ledger_group_id ? String(transportForm.ledger_group_id) : "",
    linked_customer_id: transportForm.linked_customer_id ? String(transportForm.linked_customer_id) : "",
    bilty_copy_upload: transportForm.bilty_copy_upload || "",
    // GST & Tax
    state_id: transportForm.state_id ? String(transportForm.state_id) : "",
    pan: transportForm.pan || "",
    gstin: transportForm.gstin || "",
    gst_registered: transportForm.gst_registered || "",
    gst_registration_type: transportForm.gst_registration_type || "",
    gst_registration_wef: transportForm.gst_registration_wef?.split("T")[0] || "",
    // MSME
    msme_registration_no: transportForm.msme_registration_no || "",
    msme_registration_type: transportForm.msme_registration_type || "",
    msme_registration_wef: transportForm.msme_registration_wef?.split("T")[0] || "",
    // FSSAI
    fssai_no: transportForm.fssai_no || "",
    fssai_licence_type: transportForm.fssai_licence_type || "",
    fssai_valid_upto: transportForm.fssai_valid_upto?.split("T")[0] || "",
    // Documents
    aadhaar_upload: transportForm.aadhaar_upload || "",
    pan_upload: transportForm.pan_upload || "",
    gst_certificate_upload: transportForm.gst_certificate_upload || "",
    msme_certificate_upload: transportForm.msme_certificate_upload || "",
    fssai_certificate_upload: transportForm.fssai_certificate_upload || "",
  })

  const [newVersionForm, setNewVersionForm] = useState<Record<string, any>>(getInitialFormState())

  useEffect(() => {
    setNewVersionForm(getInitialFormState())
  }, [transportForm, activeSection])

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
    queryKey: ["transport-history-modal", transportId],
    queryFn: async () => {
      if (!transportId) return []
      const res = await masterHistoryApi.getHistory("transport_master", transportId)
      if (res?.success && Array.isArray(res.data)) {
        return res.data.map((item: any) => ({
          ...item,
          wefDate: item.applicableFrom || item.wef_date || item.createdAt,
        }))
      }
      return []
    },
    enabled: !!transportId,
    staleTime: 0,
    refetchOnMount: "always",
  })

  const sectionTitles: Record<TransportSectionType, string> = {
    basic: "Basic Details History Table",
    gst: "GST & Tax Details History Table",
    msme: "MSME History Table",
    fssai: "FSSAI History Table",
    documents: "Document Uploads History Table",
  }

  const DEDICATED_COLUMNS: Record<TransportSectionType, string[]> = {
    basic: ["Transporter Name", "Contact Person", "Contact Number", "Email ID", "Address", "Pincode", "Status", "Ledger Group", "Linked Customer", "Bilty Copy"],
    gst: ["State", "PAN", "GSTIN", "GST Registration Status", "GST Registration Type", "GST W.E.F. Date"],
    msme: ["MSME Registration No", "MSME Registration Type", "MSME W.E.F. Date"],
    fssai: ["FSSAI No", "FSSAI Licence Type", "FSSAI Valid Upto Date"],
    documents: ["Aadhaar Card", "PAN Card", "GST Certificate", "MSME Certificate", "FSSAI Certificate"],
  }

  const FIELD_LABEL_TO_KEY: Record<string, string> = {
    "Transporter Name": "transporter_name",
    "Contact Person": "contact_person",
    "Contact Number": "contact_number",
    "Email ID": "email_id",
    "Address": "address_line1",
    "Pincode": "pincode",
    "Status": "status",
    "Ledger Group": "ledger_group_id",
    "Linked Customer": "linked_customer_id",
    "Bilty Copy": "bilty_copy_upload",
    "State": "state_id",
    "PAN": "pan",
    "GSTIN": "gstin",
    "GST Registration Status": "gst_registered",
    "GST Registration Type": "gst_registration_type",
    "GST W.E.F. Date": "gst_registration_wef",
    "MSME Registration No": "msme_registration_no",
    "MSME Registration Type": "msme_registration_type",
    "MSME W.E.F. Date": "msme_registration_wef",
    "FSSAI No": "fssai_no",
    "FSSAI Licence Type": "fssai_licence_type",
    "FSSAI Valid Upto Date": "fssai_valid_upto",
    "Aadhaar Card": "aadhaar_upload",
    "PAN Card": "pan_upload",
    "GST Certificate": "gst_certificate_upload",
    "MSME Certificate": "msme_certificate_upload",
    "FSSAI Certificate": "fssai_certificate_upload",
  }

  const REFERENCE_KEYS = new Set(["ledger_group_id", "linked_customer_id", "state_id"])
  const UPLOAD_KEYS = new Set(["bilty_copy_upload", "aadhaar_upload", "pan_upload", "gst_certificate_upload", "msme_certificate_upload", "fssai_certificate_upload"])

  // Reference fields are logged as "Readable Label (#id)" - human-readable in the
  // audit table, but the "(#id)" suffix lets handleEditVersion reliably restore
  // the exact original selection instead of re-matching by name.
  const getLedgerGroupLabel = (id: any) => {
    if (!id) return "—"
    const found = ledgerGroupOptions.find((g: any) => String(g.id) === String(id))
    return found ? `${found.group_name} (#${found.id})` : id
  }

  const getCustomerLabel = (id: any) => {
    if (!id) return "—"
    const found = customers.find((c: any) => String(c.id) === String(id))
    return found ? `${found.customer_name} (#${found.id})` : id
  }

  const getStateLabel = (id: any) => {
    if (!id) return "—"
    const found = activeStates.find((s: any) => String(s.id) === String(id))
    return found ? `${found.state_name} (#${found.id})` : id
  }

  const getRefLabel = (key: string, id: any) => {
    if (key === "ledger_group_id") return getLedgerGroupLabel(id)
    if (key === "linked_customer_id") return getCustomerLabel(id)
    if (key === "state_id") return getStateLabel(id)
    return id
  }

  const parseIdFromLabel = (label: string): string | null => {
    if (!label) return null
    const match = label.match(/\(#(\d+)\)/)
    return match ? match[1] : null
  }

  // The history table shows clean names/links to the user - the "(#id)" suffix
  // logged alongside reference fields is only there for handleEditVersion to
  // parse back reliably, not meant to be visible.
  const getSnapshotValue = (version: any, fieldName: string): string => {
    const raw = version.snapshot?.[fieldName] ?? "—"
    return displayVal(typeof raw === "string" ? raw.replace(/\s*\(#\d+\)/g, "") : raw)
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
    if (!transportId) return
    if (!newVersionForm.wefDate) {
      toast({ title: "Validation Error", description: "Applicable From Date (W.E.F.) is required", variant: "destructive" })
      return
    }

    try {
      setIsSaving(true)

      const logEntries = DEDICATED_COLUMNS[activeSection].map((label) => {
        const key = FIELD_LABEL_TO_KEY[label]
        const isRef = REFERENCE_KEYS.has(key)
        const oldValue = isRef ? getRefLabel(key, transportForm[key]) : (transportForm[key] ?? "—")
        const newValue = isRef ? getRefLabel(key, newVersionForm[key]) : (newVersionForm[key] || "—")
        return { fieldName: label, oldValue, newValue }
      })

      for (const entry of logEntries) {
        await masterHistoryApi.logHistory({
          masterType: "transport_master",
          recordId: transportId,
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
          if (REFERENCE_KEYS.has(key)) {
            payload[key] = newVersionForm[key] ? parseInt(newVersionForm[key], 10) : null
          } else {
            payload[key] = newVersionForm[key]
          }
        }
        await transportMasterApi.update(transportId, payload)

        const updated = await transportMasterApi.getById(transportId)
        if (updated?.success && updated.data && onTransportUpdated) {
          onTransportUpdated(updated.data)
        }
        await queryClient.invalidateQueries({ queryKey: ["master-transporters"] })
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
      await queryClient.invalidateQueries({ queryKey: ["transport-history-modal", transportId] })
      await queryClient.invalidateQueries({ queryKey: ["transport-sectional-history"] })
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

      if (REFERENCE_KEYS.has(key)) {
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
      await queryClient.invalidateQueries({ queryKey: ["transport-history-modal", transportId] })
      await queryClient.invalidateQueries({ queryKey: ["transport-sectional-history"] })
      await refetch()
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to delete version.", variant: "destructive" })
    }
  }

  const renderFileLink = (url: string) => {
    if (!url || url === "—") return <span className="text-slate-400">—</span>
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-800 underline text-[11px]">
        <span>View File</span>
        <ExternalLink className="h-3 w-3" />
      </a>
    )
  }

  const renderField = (label: string) => {
    const key = FIELD_LABEL_TO_KEY[label]
    const isDate = ["gst_registration_wef", "msme_registration_wef", "fssai_valid_upto"].includes(key)

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
    if (key === "ledger_group_id") {
      return (
        <Select value={newVersionForm.ledger_group_id ? String(newVersionForm.ledger_group_id) : ""} onValueChange={(val) => setNewVersionForm(prev => ({ ...prev, ledger_group_id: val }))}>
          <SelectTrigger className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors">
            <SelectValue placeholder="Select ledger group" />
          </SelectTrigger>
          <SelectContent>
            {ledgerGroupOptions.map((g: any) => <SelectItem key={g.id} value={String(g.id)}>{g.group_name}</SelectItem>)}
          </SelectContent>
        </Select>
      )
    }
    if (key === "linked_customer_id") {
      return (
        <Combobox
          options={customers.map((c: any) => ({ value: String(c.id), label: c.customer_name }))}
          value={newVersionForm.linked_customer_id}
          onValueChange={(val: string) => setNewVersionForm(prev => ({ ...prev, linked_customer_id: val }))}
          placeholder="Select customer (optional)"
          searchPlaceholder="Search customer..."
          className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors"
        />
      )
    }
    if (key === "state_id") {
      return (
        <Combobox
          options={activeStates.map((s: any) => ({ value: String(s.id), label: s.state_name }))}
          value={newVersionForm.state_id}
          onValueChange={(val: string) => setNewVersionForm(prev => ({ ...prev, state_id: val }))}
          placeholder="Select state"
          searchPlaceholder="Search state..."
          className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors"
        />
      )
    }
    if (key === "gst_registered") {
      return (
        <Combobox
          options={activeGstRegStatuses.map((r: any) => ({ value: r.name, label: r.name }))}
          value={newVersionForm.gst_registered}
          onValueChange={(val: string) => setNewVersionForm(prev => ({ ...prev, gst_registered: val }))}
          placeholder="Select status"
          searchPlaceholder="Search..."
          className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors"
        />
      )
    }
    if (key === "gst_registration_type") {
      return (
        <Combobox
          options={activeGstRegTypes.map((r: any) => ({ value: r.name, label: r.name }))}
          value={newVersionForm.gst_registration_type}
          onValueChange={(val: string) => setNewVersionForm(prev => ({ ...prev, gst_registration_type: val }))}
          placeholder="Select type"
          searchPlaceholder="Search..."
          className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors"
        />
      )
    }
    if (key === "msme_registration_type") {
      return (
        <Combobox
          options={activeMsmeRegTypes.map((r: any) => ({ value: r.name, label: r.name }))}
          value={newVersionForm.msme_registration_type}
          onValueChange={(val: string) => setNewVersionForm(prev => ({ ...prev, msme_registration_type: val }))}
          placeholder="Select type"
          searchPlaceholder="Search..."
          className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors"
        />
      )
    }
    if (key === "fssai_licence_type") {
      return (
        <Combobox
          options={activeFssaiLicenceTypes.map((r: any) => ({ value: r.name, label: r.name }))}
          value={newVersionForm.fssai_licence_type}
          onValueChange={(val: string) => setNewVersionForm(prev => ({ ...prev, fssai_licence_type: val }))}
          placeholder="Select licence type"
          searchPlaceholder="Search..."
          className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors"
        />
      )
    }
    if (UPLOAD_KEYS.has(key)) {
      return (
        <FileUploadField
          label=""
          accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
          value={newVersionForm[key] || ""}
          helperText="Max file size: 20 MB"
          uploading={false}
          onFilesSelected={async (files) => {
            if (files[0]) {
              const res = await orderApi.uploadFile(files[0])
              if (res.success && res.data?.url) setNewVersionForm(prev => ({ ...prev, [key]: res.data.url }))
            }
          }}
          onRemove={() => setNewVersionForm(prev => ({ ...prev, [key]: "" }))}
        />
      )
    }

    return (
      <Input
        type={isDate ? "date" : "text"}
        className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors"
        value={newVersionForm[key] ?? ""}
        onChange={(e) => setNewVersionForm(prev => ({ ...prev, [key]: e.target.value }))}
        placeholder={label}
      />
    )
  }

  const SECTION_TABS: { key: TransportSectionType; label: string; icon: any; activeClass: string }[] = [
    { key: "basic", label: "Basic Details History", icon: Truck, activeClass: "bg-slate-900" },
    { key: "gst", label: "GST & Tax History", icon: Receipt, activeClass: "bg-blue-600" },
    { key: "msme", label: "MSME History", icon: Building2, activeClass: "bg-purple-600" },
    { key: "fssai", label: "FSSAI History", icon: ShieldCheck, activeClass: "bg-emerald-600" },
    { key: "documents", label: "Document Uploads History", icon: FileText, activeClass: "bg-rose-600" },
  ]

  const isDocumentsSection = activeSection === "documents"

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
          <ArrowLeft className="h-4 w-4" /> Back to Transporter Form
        </Button>
      </div>

      <div className="border-b pb-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-600" />
          Transporter Effective-Dated Versions & History
        </h2>
        <p className="text-xs text-slate-500 font-medium mt-0.5">
          Transporter: <span className="font-bold text-slate-800">{transporterName || `#${transportId}`}</span>
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

          <div className={`grid grid-cols-1 sm:grid-cols-2 ${isDocumentsSection ? "lg:grid-cols-3" : "lg:grid-cols-3"} gap-x-5 gap-y-4 text-xs items-start`}>
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

                    {DEDICATED_COLUMNS[activeSection].map((label) => {
                      const key = FIELD_LABEL_TO_KEY[label]
                      const isUpload = UPLOAD_KEYS.has(key)
                      return (
                        <td key={label} className="py-2.5 px-3 border-r border-slate-200 text-slate-700 font-medium">
                          {isUpload ? renderFileLink(getSnapshotValue(version, label)) : getSnapshotValue(version, label)}
                        </td>
                      )
                    })}

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
