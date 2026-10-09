"use client"

import {useState, useMemo, useEffect, useRef} from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Loader2,
  Shield,
  Plus,
  Save,
  X,
  Trash2,
  Edit,
  Search,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { masterHistoryApi, insuranceDetailApi } from "@/lib/api-service"
import { useToast } from "@/hooks/use-toast"

import { fmtDate, fmtDateTime } from "@/lib/table-format"

// Display-only: ISO dates (yyyy-mm-dd[...]) shown as dd/mm/yyyy; other text untouched.
const dispVal = (v: any): any =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/.test(v.trim()) ? fmtDate(v.trim().slice(0, 10)) : v
const isDateLabel = (l: string) => /(valid|upto|w\.e\.f|effective date|expiry)/i.test(l)

// This form has no natural sub-sections (every field describes the one
// policy), so it's treated as one flat section - same pattern used for
// SKU Selling Price/Pricing, Ledger Group, Stock Group, and Units Master.
const DEDICATED_COLUMNS = ["Insurance Company Name", "Short Name", "Policy Number", "Valid From", "Valid Upto", "Type of Policy", "Sum Insured", "Owner of Policy", "Status", "Linked Customers"]

const FIELD_LABEL_TO_KEY: Record<string, string> = {
  "Insurance Company Name": "insurance_company_name",
  "Short Name": "short_name",
  "Policy Number": "policy_number",
  "Valid From": "valid_from",
  "Valid Upto": "valid_upto",
  "Type of Policy": "type_of_policy",
  "Sum Insured": "sum_insured",
  "Owner of Policy": "owner_type",
  "Status": "status",
  "Linked Customers": "customer_ids",
}

interface InsuranceDetailEffectiveDatesModalViewProps {
  insuranceDetailId: number
  insuranceCompanyName: string
  insuranceDetailForm?: Record<string, any>
  targetFieldName?: string
  customerOptions?: any[]
  onBack: () => void
  onInsuranceDetailUpdated?: (data: any) => void
}

export function InsuranceDetailEffectiveDatesModalView({
  insuranceDetailId,
  insuranceCompanyName,
  insuranceDetailForm = {},
  targetFieldName,
  customerOptions = [],
  onBack,
  onInsuranceDetailUpdated,
}: InsuranceDetailEffectiveDatesModalViewProps) {

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
  const [customerSearch, setCustomerSearch] = useState("")
  // Tracks the version currently loaded via "Edit" (its row ids + original
  // W.E.F date) so that saving under a CHANGED date can delete the original
  // rows instead of leaving a stale duplicate version behind at the old date.
  const [editingVersion, setEditingVersion] = useState<{ ids: number[]; wefDate: string } | null>(null)
  const wefDateInputRef = useRef<HTMLInputElement | null>(null)

  const getInitialFormState = () => ({
    wefDate: getTodayStr(),
    insurance_company_name: insuranceDetailForm.insurance_company_name || "",
    short_name: insuranceDetailForm.short_name || "",
    policy_number: insuranceDetailForm.policy_number || "",
    valid_from: insuranceDetailForm.valid_from?.split("T")[0] || "",
    valid_upto: insuranceDetailForm.valid_upto?.split("T")[0] || "",
    type_of_policy: insuranceDetailForm.type_of_policy || "",
    sum_insured: insuranceDetailForm.sum_insured ?? "",
    owner_type: insuranceDetailForm.owner_type || "Company",
    status: insuranceDetailForm.status || "Active",
    customer_ids: Array.isArray(insuranceDetailForm.customer_ids) ? [...insuranceDetailForm.customer_ids] : [],
  })

  const [newVersionForm, setNewVersionForm] = useState<Record<string, any>>(getInitialFormState())

  useEffect(() => {
    setNewVersionForm(getInitialFormState())
  }, [insuranceDetailForm])

  useEffect(() => {
    if (isAdding && wefDateInputRef.current) {
      setTimeout(() => wefDateInputRef.current?.focus(), 100)
    }
  }, [isAdding])

  const { data: historyData, isLoading, refetch } = useQuery({
    queryKey: ["insurance-detail-history-modal", insuranceDetailId],
    queryFn: async () => {
      if (!insuranceDetailId) return []
      const res = await masterHistoryApi.getHistory("insurance_details", insuranceDetailId)
      if (res?.success && Array.isArray(res.data)) {
        return res.data.map((item: any) => ({
          ...item,
          wefDate: item.applicableFrom || item.wef_date || item.createdAt,
        }))
      }
      return []
    },
    enabled: !!insuranceDetailId,
    staleTime: 0,
    refetchOnMount: "always",
  })

  // "Linked Customers" mixes multiple customer ids in one array, so it's
  // logged as "Name (#id), Name (#id)" - the embedded tag lets a historical
  // version be parsed back into the exact set of customer ids, not just
  // guessed by name.
  const getLinkedCustomersLabel = (ids: any[]) => {
    if (!ids || ids.length === 0) return "—"
    return ids
      .map((id: any) => {
        const c = customerOptions.find((c: any) => String(c.id) === String(id))
        return `${c?.customer_name || `#${id}`} (#${id})`
      })
      .join(", ")
  }

  const parseLinkedCustomersFromLabel = (label: string): number[] => {
    if (!label) return []
    const matches = [...label.matchAll(/\(#(\d+)\)/g)]
    return matches.map((m) => parseInt(m[1], 10))
  }

  const getSnapshotValue = (version: any, fieldName: string): string => {
    const raw = version.snapshot?.[fieldName] ?? "—"
    if (typeof raw !== "string") return raw
    if (fieldName === "Linked Customers") {
      const ids = parseLinkedCustomersFromLabel(raw)
      // Re-resolve names from the current customer list rather than trusting
      // the stored text - if customerOptions hadn't loaded yet at the moment
      // this version was logged, the stored label falls back to a bare id.
      if (ids.length > 0) {
        return ids
          .map((id) => {
            const c = customerOptions.find((c: any) => String(c.id) === String(id))
            return c?.customer_name || `#${id}`
          })
          .join(", ")
      }
      return raw.replace(/\s*\(#\d+\)/g, "")
    }
    return raw
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
        dateMap.set(key, { wefDate: key, changedByName: item.changedByName || item.changedBy || "Admin", changes: [], ids: [] })
      }

      const entry = dateMap.get(key)
      if (item.id && !entry.ids.includes(item.id)) entry.ids.push(item.id)
      if (item.fieldName) {
        entry.changes.push({ id: item.id, fieldName: item.fieldName, oldValue: item.oldValue, newValue: item.newValue })
        if (item.changedByName) entry.changedByName = item.changedByName
        entry.changedAt = item.createdAt || item.updatedAt || item.changedAt || entry.changedAt
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

  // "Linked Customers" only exists on the main form when Owner of Policy is
  // "Customer" - showing it as a history column for a Company-owned policy
  // would be a column that's always "—" and doesn't correspond to anything
  // on the record, so it's hidden unless the policy is currently Customer-owned.
  const visibleColumns = DEDICATED_COLUMNS.filter((label) => label !== "Linked Customers" || insuranceDetailForm.owner_type === "Customer")

  const handleSaveNewVersion = async () => {
    if (!insuranceDetailId) return
    if (!newVersionForm.wefDate) {
      toast({ title: "Validation Error", description: "Applicable From Date (W.E.F.) is required", variant: "destructive" })
      return
    }
    if (!newVersionForm.insurance_company_name?.trim()) {
      toast({ title: "Validation Error", description: "Insurance Company Name is required", variant: "destructive" })
      return
    }

    try {
      setIsSaving(true)

      const logEntries = DEDICATED_COLUMNS.map((label) => {
        const key = FIELD_LABEL_TO_KEY[label]
        if (key === "customer_ids") {
          return { fieldName: label, oldValue: getLinkedCustomersLabel(insuranceDetailForm[key] || []), newValue: getLinkedCustomersLabel(newVersionForm[key] || []) }
        }
        return { fieldName: label, oldValue: insuranceDetailForm[key] ?? "—", newValue: newVersionForm[key] || "—" }
      })

      for (const entry of logEntries) {
        await masterHistoryApi.logHistory({
          masterType: "insurance_details",
          recordId: insuranceDetailId,
          fieldName: entry.fieldName,
          oldValue: String(entry.oldValue),
          newValue: String(entry.newValue),
          applicableFrom: newVersionForm.wefDate,
        })
      }

      const todayStr = getTodayStr()
      if (newVersionForm.wefDate <= todayStr) {
        const payload: Record<string, any> = {
          insurance_company_name: newVersionForm.insurance_company_name,
          short_name: newVersionForm.short_name,
          policy_number: newVersionForm.policy_number,
          valid_from: newVersionForm.valid_from,
          valid_upto: newVersionForm.valid_upto,
          type_of_policy: newVersionForm.type_of_policy,
          sum_insured: newVersionForm.sum_insured,
          owner_type: newVersionForm.owner_type,
          status: newVersionForm.status,
          customer_ids: newVersionForm.owner_type === "Customer" ? newVersionForm.customer_ids : [],
        }
        await insuranceDetailApi.update(insuranceDetailId, payload)

        const updated = await insuranceDetailApi.getById(String(insuranceDetailId))
        if (updated?.success && updated.data && onInsuranceDetailUpdated) {
          onInsuranceDetailUpdated(updated.data)
        }
        await queryClient.invalidateQueries({ queryKey: ["master-insurance-details"] })
      }

      toast({
        title: "Effective Version Saved",
        description: `New Insurance Policy version logged with W.E.F. date ${newVersionForm.wefDate}`,
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
      await queryClient.invalidateQueries({ queryKey: ["insurance-detail-history-modal", insuranceDetailId] })
      await queryClient.invalidateQueries({ queryKey: ["insurance-detail-sectional-history"] })
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

      if (key === "customer_ids") {
        overrides[key] = parseLinkedCustomersFromLabel(loggedValue)
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
      await queryClient.invalidateQueries({ queryKey: ["insurance-detail-history-modal", insuranceDetailId] })
      await queryClient.invalidateQueries({ queryKey: ["insurance-detail-sectional-history"] })
      await refetch()
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to delete version.", variant: "destructive" })
    }
  }

  const toggleLinkedCustomer = (id: number) => {
    setNewVersionForm((prev: any) => {
      const current: number[] = prev.customer_ids || []
      const updated = current.includes(id) ? current.filter((cid) => cid !== id) : [...current, id]
      return { ...prev, customer_ids: updated }
    })
  }

  const filteredCustomers = customerOptions.filter((c: any) => c.customer_name?.toLowerCase().includes(customerSearch.toLowerCase()))

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
          <ArrowLeft className="h-4 w-4" /> Back to Insurance Detail Form
        </Button>
      </div>

      <div className="border-b pb-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-600" />
          Insurance Policy Effective-Dated Versions & History
        </h2>
        <p className="text-xs text-slate-500 font-medium mt-0.5">
          Policy: <span className="font-bold text-slate-800">{insuranceCompanyName || `#${insuranceDetailId}`}</span>
        </p>
      </div>

      <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200">
        <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
          <Shield className="h-3.5 w-3.5 text-blue-600" />
          Insurance Policy History Table
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
              Log New INSURANCE POLICY Version (Applicable From Date)
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
              <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Insurance Company Name</Label>
              <Input
                className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors"
                value={newVersionForm.insurance_company_name}
                onChange={(e) => setNewVersionForm(prev => ({ ...prev, insurance_company_name: e.target.value }))}
                placeholder="Enter company name"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Short Name</Label>
              <Input
                className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors"
                value={newVersionForm.short_name}
                onChange={(e) => setNewVersionForm(prev => ({ ...prev, short_name: e.target.value }))}
                placeholder="e.g. ICICI"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Policy Number</Label>
              <Input
                className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors"
                value={newVersionForm.policy_number}
                onChange={(e) => setNewVersionForm(prev => ({ ...prev, policy_number: e.target.value }))}
                placeholder="Enter policy number"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Valid From</Label>
              <Input
                type="date"
                className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors"
                value={newVersionForm.valid_from}
                onChange={(e) => setNewVersionForm(prev => ({ ...prev, valid_from: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Valid Upto</Label>
              <Input
                type="date"
                className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors"
                value={newVersionForm.valid_upto}
                onChange={(e) => setNewVersionForm(prev => ({ ...prev, valid_upto: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Type of Policy</Label>
              <Select value={newVersionForm.type_of_policy} onValueChange={(val) => setNewVersionForm(prev => ({ ...prev, type_of_policy: val }))}>
                <SelectTrigger className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Marine Cargo">Marine Cargo</SelectItem>
                  <SelectItem value="Open Policy">Open Policy</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Sum Insured (₹)</Label>
              <Input
                type="number"
                className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors"
                value={newVersionForm.sum_insured}
                onChange={(e) => setNewVersionForm(prev => ({ ...prev, sum_insured: e.target.value }))}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Owner of Policy</Label>
              <Select value={newVersionForm.owner_type} onValueChange={(val) => setNewVersionForm(prev => ({ ...prev, owner_type: val }))}>
                <SelectTrigger className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors">
                  <SelectValue placeholder="Select owner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Company">Company</SelectItem>
                  <SelectItem value="Customer">Customer</SelectItem>
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

            {newVersionForm.owner_type === "Customer" && (
              <div className="sm:col-span-2 lg:col-span-3 space-y-1.5">
                <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Linked Customers</Label>
                <div className="rounded-lg border border-slate-200 bg-white p-2.5 space-y-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      className="h-8 pl-8 text-xs"
                      placeholder="Search customers..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {filteredCustomers.length === 0 ? (
                      <p className="text-[11px] text-slate-400 text-center py-3 col-span-2">No customer found.</p>
                    ) : (
                      filteredCustomers.map((c: any) => {
                        const checked = (newVersionForm.customer_ids || []).includes(c.id)
                        return (
                          <label key={c.id} className="flex items-center gap-2 text-xs cursor-pointer select-none px-1.5 py-1 rounded hover:bg-slate-50">
                            <Checkbox checked={checked} onCheckedChange={() => toggleLinkedCustomer(c.id)} />
                            <span className="text-slate-700 truncate">{c.customer_name}</span>
                          </label>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
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
                {visibleColumns.map((label) => (
                  <th key={label} className={`py-2.5 px-3 border-r border-slate-300 whitespace-nowrap ${isDateLabel(label) ? "text-right" : ""}`}>{label}</th>
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

                    {visibleColumns.map((label) => (
                      <td key={label} className={`py-2.5 px-3 border-r border-slate-200 text-slate-700 font-medium ${isDateLabel(label) ? "text-right" : ""}`}>
                        {dispVal(getSnapshotValue(version, label))}
                      </td>
                    ))}

                    <td className="py-2.5 px-3 text-left border-r border-slate-200 whitespace-nowrap text-[11px] text-slate-600">
                      <div className="flex items-center justify-start gap-1 font-medium">
                        <User className="h-3 w-3 text-slate-400" />
                        <span>{version.changedByName}</span>
                      </div>
                      <div className="pl-4 text-[10px] text-slate-400 font-normal">{fmtDateTime(version.changedAt)}</div>
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
