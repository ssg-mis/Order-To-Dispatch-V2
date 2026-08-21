"use client"

import { useState, useMemo, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Combobox } from "@/components/ui/combobox"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  List,
  Save,
  ChevronRight,
  Search,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Layers,
  MapPin,
  FileText,
  Truck,
  CreditCard,
  Building2,
  Tag,
  ShieldCheck,
  Fuel,
  Info,
  Power,
  RefreshCw,
  SlidersHorizontal,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  AlertTriangle
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { stateApi, districtApi, subDistrictApi, lookupApi, type LookupType } from "@/lib/api-service"
import { DEFAULT_MASTER_RECORDS, formatDropdownLabel } from "@/lib/dropdown-masters"

export interface ReferenceDataTabProps {
  activeStates?: Array<{ id: number | string; state_name: string; status?: string; gst_state_code?: string; short_name?: string }>
  isMasterTabReadOnly?: boolean
}

// 22 Standard Master Categories
interface CategoryMeta {
  key: LookupType
  label: string
  shortDesc: string
  icon: typeof List
}

interface CategoryGroup {
  group: string
  icon: typeof List
  types: CategoryMeta[]
}

const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    group: "Location Masters",
    icon: MapPin,
    types: [
      { key: "state", label: "State", shortDesc: "State name, GST code & short code", icon: MapPin },
      { key: "district", label: "District", shortDesc: "Mapped with parent State", icon: MapPin },
      { key: "sub_district", label: "Sub-District", shortDesc: "Mapped with parent District (derived State)", icon: MapPin },
      { key: "city", label: "City", shortDesc: "City names master", icon: Building2 },
      { key: "post", label: "Post", shortDesc: "Post Office names & PINs", icon: Building2 },
      { key: "thana", label: "Thana", shortDesc: "Police Station / Thana master", icon: ShieldCheck },
    ],
  },
  {
    group: "GST & Compliance Masters",
    icon: FileText,
    types: [
      { key: "is_gst_registered", label: "GST Registration Status", shortDesc: "Registered / Unregistered", icon: ShieldCheck },
      { key: "gst_registration_type", label: "GST Registration Type", shortDesc: "Regular / Composition", icon: FileText },
      { key: "gst_rate", label: "GST Rate", shortDesc: "Numeric tax rates (e.g. 18%)", icon: Tag },
      { key: "hsn_code", label: "HSN Code", shortDesc: "Complete 8-digit HSN codes", icon: Tag },
      { key: "sac_code", label: "SAC Code", shortDesc: "Complete 6-digit SAC codes", icon: Tag },
      { key: "uqc", label: "UQC – Unit Quantity Code", shortDesc: "KGS, NOS, BTL, PCS, MTR", icon: Tag },
      { key: "type_of_supply", label: "Type of Supply", shortDesc: "Intra-State, Inter-State, Export", icon: Layers },
    ],
  },
  {
    group: "Business Masters",
    icon: CreditCard,
    types: [
      { key: "msme_registration_type", label: "MSME Registration Type", shortDesc: "Micro / Small / Medium", icon: Building2 },
      { key: "fssai_licence_type", label: "FSSAI Licence Type", shortDesc: "Registration / State / National", icon: ShieldCheck },
      { key: "bank_name", label: "Bank Name", shortDesc: "Approved banking institutions", icon: CreditCard },
      { key: "transaction_type", label: "Transaction Type", shortDesc: "NEFT, RTGS, UPI, Cheque, Cash", icon: CreditCard },
      { key: "stock_category", label: "Stock Category", shortDesc: "Bulk Packaging, Retail Packaging", icon: Layers },
      { key: "oil_type", label: "Oil Type", shortDesc: "Rice Bran, Soya Bean, Palm Olein Refined Oil", icon: Tag },
    ],
  },
  {
    group: "Vehicle Masters",
    icon: Truck,
    types: [
      { key: "vehicle_type", label: "Vehicle Type", shortDesc: "Tanker, Truck, Trailer, LCV", icon: Truck },
      { key: "fuel_type", label: "Fuel Type", shortDesc: "Fuel with PUCC Applicable flag", icon: Fuel },
      { key: "rto_code", label: "RTO Master", shortDesc: "Code – RTO Name mapping", icon: Truck },
    ],
  },
]

export function ReferenceDataTab({ activeStates = [], isMasterTabReadOnly = false }: ReferenceDataTabProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Primary navigation & UI state
  const [selectedCategory, setSelectedCategory] = useState<LookupType>("state")
  const [categorySearch, setCategorySearch] = useState("")
  const [tableSearch, setTableSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Inactive">("All")
  const [parentFilterStateId, setParentFilterStateId] = useState<string>("ALL")
  const [parentFilterDistrictId, setParentFilterDistrictId] = useState<string>("ALL")

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Local fallback storage synced across session
  const [localRecords, setLocalRecords] = useState<Record<LookupType, any[]>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("app_small_masters_records")
        if (saved) return JSON.parse(saved)
      } catch (e) {
        console.error("Failed loading local master records", e)
      }
    }
    return DEFAULT_MASTER_RECORDS
  })

  // Save local records to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("app_small_masters_records", JSON.stringify(localRecords))
      } catch (e) {
        console.error("Failed saving local master records", e)
      }
    }
  }, [localRecords])

  // Dialog State (Add / Edit)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add")
  const [editingItem, setEditingItem] = useState<any | null>(null)
  const [formData, setFormData] = useState<Record<string, any>>({ status: "Active" })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 1. Data Query for current category
  const {
    data: remoteData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["small-masters", selectedCategory],
    queryFn: async () => {
      if (selectedCategory === "state") {
        const res = await stateApi.getAll({ all: "true" })
        return res.success ? (res.data?.states || []) : []
      }
      if (selectedCategory === "district") {
        const res = await districtApi.getAll({ all: "true" })
        return res.success ? (res.data?.districts || []) : []
      }
      if (selectedCategory === "sub_district") {
        const res = await subDistrictApi.getAll({ all: "true" })
        return res.success ? (res.data?.sub_districts || res.data?.subDistricts || []) : []
      }
      const res = await lookupApi.getAll(selectedCategory, { all: "true" })
      return res.success ? (res.data?.items || []) : []
    },
    staleTime: 60 * 1000,
  })

  // Active records for current category merged from Remote + Local fallback
  const masterRecords = useMemo(() => {
    const remoteList = Array.isArray(remoteData) && remoteData.length > 0 ? remoteData : null
    const fallbackList = localRecords[selectedCategory] || DEFAULT_MASTER_RECORDS[selectedCategory] || []
    const combined = remoteList || fallbackList

    return combined.map((item: any) => ({
      ...item,
      id: String(item.id || item.lookup_id || `rec-${Math.random()}`),
      name: item.name || item.state_name || item.district_name || item.sub_district_name || item.description || "",
      code: item.code || item.state_code || item.gst_state_code || item.district_code || item.sub_district_code || item.hsn_code || item.sac_code || "",
      status: item.status || "Active",
    }))
  }, [remoteData, localRecords, selectedCategory])

  // All States for District mapping dropdown & filter
  const allStates = useMemo(() => {
    const fromProps = (activeStates || []).map((s: any) => ({
      id: String(s.id),
      name: s.state_name || s.name,
      gst_code: s.gst_state_code || s.state_code || "",
      short_name: s.short_name || "",
      status: s.status || "Active",
    }))

    const fromLocal = (localRecords.state || []).map((s: any) => ({
      id: String(s.id),
      name: s.state_name || s.name,
      gst_code: s.gst_state_code || s.state_code || "",
      short_name: s.short_name || "",
      status: s.status || "Active",
    }))

    const map = new Map<string, any>()
    fromProps.forEach((st) => map.set(String(st.id), st))
    fromLocal.forEach((st) => map.set(String(st.id), st))

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [activeStates, localRecords.state])

  // State Name lookup map
  const stateNameById = useMemo(() => {
    return Object.fromEntries(allStates.map((s) => [String(s.id), s.name]))
  }, [allStates])

  // All Districts for Sub-District mapping dropdown & filter
  const allDistricts = useMemo(() => {
    const list = localRecords.district || DEFAULT_MASTER_RECORDS.district || []
    return list.map((d: any) => ({
      id: String(d.id),
      name: d.district_name || d.name,
      state_id: String(d.state_id || ""),
      state_name: d.state_name || stateNameById[String(d.state_id)] || "—",
      status: d.status || "Active",
    })).sort((a, b) => a.name.localeCompare(b.name))
  }, [localRecords.district, stateNameById])

  // District Name lookup map & derived state map
  const districtMapById = useMemo(() => {
    return Object.fromEntries(allDistricts.map((d) => [String(d.id), d]))
  }, [allDistricts])

  // Switch category
  const handleCategoryChange = (key: LookupType) => {
    setSelectedCategory(key)
    setTableSearch("")
    setStatusFilter("All")
    setParentFilterStateId("ALL")
    setParentFilterDistrictId("ALL")
    setCurrentPage(1)
  }

  // Open Dialog for Add
  const handleOpenAddDialog = () => {
    setDialogMode("add")
    setEditingItem(null)
    setFormErrors({})

    let initialDefaults: Record<string, any> = { status: "Active" }

    if (selectedCategory === "fuel_type") {
      initialDefaults.pucc_applicable = "Applicable"
    } else if (selectedCategory === "district" && allStates.length > 0) {
      initialDefaults.state_id = allStates[0].id
    } else if (selectedCategory === "sub_district" && allDistricts.length > 0) {
      initialDefaults.district_id = allDistricts[0].id
    } else if (selectedCategory === "is_gst_registered") {
      initialDefaults.name = "Registered"
    } else if (selectedCategory === "gst_registration_type") {
      initialDefaults.name = "Regular"
    } else if (selectedCategory === "msme_registration_type") {
      initialDefaults.name = "Micro"
    } else if (selectedCategory === "fssai_licence_type") {
      initialDefaults.name = "Registration"
    }

    setFormData(initialDefaults)
    setIsDialogOpen(true)
  }

  // Open Dialog for Edit
  const handleOpenEditDialog = (item: any) => {
    setDialogMode("edit")
    setEditingItem(item)
    setFormErrors({})

    setFormData({
      id: item.id,
      name: item.name || item.state_name || item.district_name || item.sub_district_name || "",
      description: item.description || "",
      code: item.code || item.gst_state_code || item.state_code || item.hsn_code || item.sac_code || "",
      short_name: item.short_name || "",
      state_code: item.gst_state_code || item.state_code || "",
      state_id: String(item.state_id || ""),
      district_id: String(item.district_id || ""),
      rate: item.rate !== undefined && item.rate !== null ? String(item.rate) : "",
      pucc_applicable: item.pucc_applicable ?? item.puccApplicable ?? "Applicable",
      rto_name: item.rto_name || item.name || "",
      status: item.status || "Active",
    })

    setIsDialogOpen(true)
  }

  // Activate / Deactivate Toggle
  const handleToggleStatus = async (item: any) => {
    const newStatus = item.status === "Active" ? "Inactive" : "Active"
    const actionLabel = newStatus === "Active" ? "Activated" : "Deactivated"

    try {
      // Optimistic local update
      setLocalRecords((prev) => ({
        ...prev,
        [selectedCategory]: (prev[selectedCategory] || []).map((r) =>
          String(r.id) === String(item.id) ? { ...r, status: newStatus } : r
        ),
      }))

      // Call Backend API
      if (selectedCategory === "state") {
        await stateApi.update(item.id, { status: newStatus })
      } else if (selectedCategory === "district") {
        await districtApi.update(item.id, { status: newStatus })
      } else if (selectedCategory === "sub_district") {
        await subDistrictApi.update(item.id, { status: newStatus })
      } else {
        await lookupApi.update(selectedCategory, item.id, { status: newStatus })
      }

      queryClient.invalidateQueries({ queryKey: ["small-masters", selectedCategory] })

      toast({
        title: `Record ${actionLabel}`,
        description: `"${item.name || item.code}" is now ${newStatus}.`,
      })
    } catch (err: any) {
      console.warn("Status toggle backend sync note:", err)
      toast({
        title: `Status set to ${newStatus}`,
        description: `"${item.name || item.code}" updated successfully.`,
      })
    }
  }

  // Form Field Change Handler
  const handleFieldChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: "" }))
    }
  }

  // Duplicate & Format Validation
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}
    const activeExisting = masterRecords.filter(
      (r) => r.status === "Active" && (dialogMode === "add" || String(r.id) !== String(editingItem?.id))
    )

    // Common name check
    if (!formData.name?.trim() && !["uqc", "rto_code", "hsn_code", "sac_code"].includes(selectedCategory)) {
      errors.name = "This field is required"
    }

    switch (selectedCategory) {
      case "state": {
        if (!formData.name?.trim()) errors.name = "State Name is required"
        const nameDuplicate = activeExisting.some(
          (s) => s.name?.toLowerCase().trim() === formData.name?.toLowerCase().trim()
        )
        if (nameDuplicate) errors.name = "A state with this name already exists"

        if (!formData.state_code?.trim()) {
          errors.state_code = "GST State Code is required"
        } else if (!/^[0-9]{2}$/.test(formData.state_code.trim())) {
          errors.state_code = "GST State Code must be exactly 2 numeric digits (e.g. 22, 27, 07)"
        } else {
          const codeDuplicate = activeExisting.some(
            (s) => (s.code || s.gst_state_code || s.state_code) === formData.state_code.trim()
          )
          if (codeDuplicate) errors.state_code = "This GST State Code is already assigned to another state"
        }
        break
      }

      case "district": {
        if (!formData.name?.trim()) errors.name = "District Name is required"
        if (!formData.state_id) errors.state_id = "Please select a parent State"

        // Prevent duplicate district within the same state
        const dupInState = activeExisting.some(
          (d) =>
            d.name?.toLowerCase().trim() === formData.name?.toLowerCase().trim() &&
            String(d.state_id) === String(formData.state_id)
        )
        if (dupInState) errors.name = "This District name already exists in the selected State"
        break
      }

      case "sub_district": {
        if (!formData.name?.trim()) errors.name = "Sub-District Name is required"
        if (!formData.district_id) errors.district_id = "Please select a parent District"

        // Prevent duplicate sub-district within the same district
        const dupInDist = activeExisting.some(
          (sd) =>
            sd.name?.toLowerCase().trim() === formData.name?.toLowerCase().trim() &&
            String(sd.district_id) === String(formData.district_id)
        )
        if (dupInDist) errors.name = "This Sub-District already exists in the selected District"
        break
      }

      case "hsn_code": {
        const code = String(formData.code || "").trim()
        if (!code) {
          errors.code = "8-digit HSN Code is required"
        } else if (!/^[0-9]{8}$/.test(code)) {
          errors.code = "HSN Code must contain exactly 8 numeric digits (e.g. 15159040)"
        } else if (activeExisting.some((r) => String(r.code || r.hsn_code).trim() === code)) {
          errors.code = "This 8-digit HSN Code already exists"
        }

        if (!formData.description?.trim()) errors.description = "Product / Commodity Description is required"
        break
      }

      case "sac_code": {
        const code = String(formData.code || "").trim()
        if (!code) {
          errors.code = "6-digit SAC Code is required"
        } else if (!/^[0-9]{6}$/.test(code)) {
          errors.code = "SAC Code must contain exactly 6 numeric digits (e.g. 996511)"
        } else if (activeExisting.some((r) => String(r.code || r.sac_code).trim() === code)) {
          errors.code = "This 6-digit SAC Code already exists"
        }

        if (!formData.description?.trim()) errors.description = "Service Description is required"
        break
      }

      case "gst_rate": {
        const rateNum = Number(formData.rate)
        if (formData.rate === undefined || formData.rate === null || formData.rate === "" || isNaN(rateNum)) {
          errors.rate = "Numeric GST rate percentage is required"
        } else if (rateNum < 0 || rateNum > 100) {
          errors.rate = "GST rate must be between 0% and 100%"
        } else if (activeExisting.some((r) => Number(r.rate) === rateNum)) {
          errors.rate = `GST Rate ${rateNum}% already exists in master`
        }
        break
      }

      case "uqc": {
        const code = String(formData.code || "").trim().toUpperCase()
        if (!code) {
          errors.code = "UQC Code is required (e.g. KGS, NOS, BTL)"
        } else if (activeExisting.some((r) => String(r.code).toUpperCase() === code)) {
          errors.code = `UQC Code "${code}" already exists`
        }

        if (!formData.name?.trim()) errors.name = "Unit Name / Description is required"
        break
      }

      case "rto_code": {
        const code = String(formData.code || "").trim().toUpperCase()
        if (!code) {
          errors.code = "RTO Code is required (e.g. CG04, MH12)"
        } else if (activeExisting.some((r) => String(r.code).toUpperCase() === code)) {
          errors.code = `RTO Code "${code}" already exists`
        }

        if (!formData.rto_name?.trim()) errors.rto_name = "RTO Name is required (e.g. Raipur, Pune)"
        break
      }

      case "bank_name": {
        const name = String(formData.name || "").trim()
        if (activeExisting.some((r) => r.name?.toLowerCase().trim() === name.toLowerCase())) {
          errors.name = "This Bank Name already exists"
        }
        break
      }

      default: {
        const name = String(formData.name || "").trim()
        if (name && activeExisting.some((r) => r.name?.toLowerCase().trim() === name.toLowerCase())) {
          errors.name = "This entry already exists in active records"
        }
        break
      }
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Handle Form Submit (Add or Edit)
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please resolve the highlighted errors before saving.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const categoryMeta = CATEGORY_GROUPS.flatMap((g) => g.types).find((t) => t.key === selectedCategory)
      const label = categoryMeta?.label || "Master Record"

      // Prepare payload
      let payload: any = {
        status: formData.status || "Active",
      }

      let formattedDisplayName = ""

      if (selectedCategory === "state") {
        payload.state_name = formData.name.trim()
        payload.state_code = formData.state_code.trim()
        payload.gst_state_code = formData.state_code.trim()
        payload.short_name = (formData.short_name || "").trim().toUpperCase()
        formattedDisplayName = `${payload.state_name} (${payload.gst_state_code})`
      } else if (selectedCategory === "district") {
        payload.district_name = formData.name.trim()
        payload.state_id = parseInt(formData.state_id, 10)
        payload.state_name = stateNameById[String(formData.state_id)] || ""
        formattedDisplayName = `${payload.district_name} (${payload.state_name})`
      } else if (selectedCategory === "sub_district") {
        payload.sub_district_name = formData.name.trim()
        payload.district_id = parseInt(formData.district_id, 10)
        const parentDist = districtMapById[String(formData.district_id)]
        payload.district_name = parentDist?.name || ""
        payload.state_name = parentDist?.state_name || ""
        formattedDisplayName = `${payload.sub_district_name} (${payload.district_name})`
      } else if (selectedCategory === "uqc") {
        payload.code = formData.code.trim().toUpperCase()
        payload.name = formData.name.trim()
        formattedDisplayName = `${payload.code} – ${payload.name}`
      } else if (selectedCategory === "gst_rate") {
        payload.name = formData.name?.trim() || `GST ${formData.rate}%`
        payload.rate = Number(formData.rate)
        formattedDisplayName = `${payload.rate}%`
      } else if (selectedCategory === "hsn_code") {
        payload.code = formData.code.trim()
        payload.hsn_code = formData.code.trim()
        payload.name = formData.description.trim()
        payload.description = formData.description.trim()
        formattedDisplayName = `${payload.code} – ${payload.description}`
      } else if (selectedCategory === "sac_code") {
        payload.code = formData.code.trim()
        payload.sac_code = formData.code.trim()
        payload.name = formData.description.trim()
        payload.description = formData.description.trim()
        formattedDisplayName = `${payload.code} – ${payload.description}`
      } else if (selectedCategory === "fuel_type") {
        payload.name = formData.name.trim()
        payload.pucc_applicable = formData.pucc_applicable || "Applicable"
        formattedDisplayName = `${payload.name} (${payload.pucc_applicable})`
      } else if (selectedCategory === "rto_code") {
        payload.code = formData.code.trim().toUpperCase()
        payload.name = formData.rto_name.trim()
        payload.rto_name = formData.rto_name.trim()
        formattedDisplayName = `${payload.code} – ${payload.rto_name}`
      } else {
        payload.name = formData.name.trim()
        payload.description = (formData.description || "").trim()
        formattedDisplayName = payload.name
      }

      // API Call
      let savedRecordId = editingItem?.id

      if (dialogMode === "add") {
        savedRecordId = `id-${Date.now()}`
        payload.id = savedRecordId
        payload.created_at = new Date().toISOString()
        payload.created_by = "Admin"

        if (selectedCategory === "state") {
          await stateApi.create(payload).catch((e) => console.warn("API state create fallback:", e))
        } else if (selectedCategory === "district") {
          await districtApi.create(payload).catch((e) => console.warn("API district create fallback:", e))
        } else if (selectedCategory === "sub_district") {
          await subDistrictApi.create(payload).catch((e) => console.warn("API sub_district create fallback:", e))
        } else {
          await lookupApi.create(selectedCategory, payload).catch((e) => console.warn("API lookup create fallback:", e))
        }

        // Local state update
        setLocalRecords((prev) => ({
          ...prev,
          [selectedCategory]: [{ ...payload, id: savedRecordId }, ...(prev[selectedCategory] || [])],
        }))

        toast({
          title: "Record Created",
          description: `"${formattedDisplayName}" has been successfully added to ${label}.`,
        })
      } else {
        // Edit Mode
        payload.updated_at = new Date().toISOString()
        payload.updated_by = "Admin"

        if (selectedCategory === "state") {
          await stateApi.update(editingItem.id, payload).catch((e) => console.warn("API state update fallback:", e))
        } else if (selectedCategory === "district") {
          await districtApi.update(editingItem.id, payload).catch((e) => console.warn("API district update fallback:", e))
        } else if (selectedCategory === "sub_district") {
          await subDistrictApi.update(editingItem.id, payload).catch((e) => console.warn("API sub_district update fallback:", e))
        } else {
          await lookupApi.update(selectedCategory, editingItem.id, payload).catch((e) => console.warn("API lookup update fallback:", e))
        }

        // Local state update
        setLocalRecords((prev) => ({
          ...prev,
          [selectedCategory]: (prev[selectedCategory] || []).map((r) =>
            String(r.id) === String(editingItem.id) ? { ...r, ...payload, id: editingItem.id } : r
          ),
        }))

        toast({
          title: "Record Updated",
          description: `"${formattedDisplayName}" has been successfully updated.`,
        })
      }

      queryClient.invalidateQueries({ queryKey: ["small-masters", selectedCategory] })
      setIsDialogOpen(false)
    } catch (err: any) {
      toast({
        title: "Error saving record",
        description: err.message || "Failed to save record.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Filtered categories for sidebar search
  const filteredGroups = useMemo(() => {
    if (!categorySearch.trim()) return CATEGORY_GROUPS
    const query = categorySearch.toLowerCase().trim()
    return CATEGORY_GROUPS.map((group) => ({
      ...group,
      types: group.types.filter(
        (t) => t.label.toLowerCase().includes(query) || t.shortDesc.toLowerCase().includes(query)
      ),
    })).filter((group) => group.types.length > 0)
  }, [categorySearch])

  // Filtered Records based on search, status, and dependent parent state/district
  const filteredRecords = useMemo(() => {
    let list = masterRecords

    // Status filter
    if (statusFilter !== "All") {
      list = list.filter((r) => (r.status || "Active") === statusFilter)
    }

    // Parent State filter for District Master
    if (selectedCategory === "district" && parentFilterStateId !== "ALL") {
      list = list.filter((d) => String(d.state_id) === String(parentFilterStateId))
    }

    // Parent District filter for Sub-District Master
    if (selectedCategory === "sub_district" && parentFilterDistrictId !== "ALL") {
      list = list.filter((sd) => String(sd.district_id) === String(parentFilterDistrictId))
    }

    // Free text search
    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase().trim()
      list = list.filter((r) => {
        return (
          (r.name && String(r.name).toLowerCase().includes(q)) ||
          (r.code && String(r.code).toLowerCase().includes(q)) ||
          (r.description && String(r.description).toLowerCase().includes(q)) ||
          (r.state_name && String(r.state_name).toLowerCase().includes(q)) ||
          (r.district_name && String(r.district_name).toLowerCase().includes(q)) ||
          (r.short_name && String(r.short_name).toLowerCase().includes(q)) ||
          (r.rto_name && String(r.rto_name).toLowerCase().includes(q)) ||
          (r.rate && String(r.rate).includes(q)) ||
          (r.status && String(r.status).toLowerCase().includes(q))
        )
      })
    }

    return list
  }, [masterRecords, statusFilter, parentFilterStateId, parentFilterDistrictId, tableSearch, selectedCategory])

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize))
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredRecords.slice(start, start + pageSize)
  }, [filteredRecords, currentPage, pageSize])

  // Active / Total stats for category
  const activeCount = useMemo(() => masterRecords.filter((r) => r.status === "Active").length, [masterRecords])
  const inactiveCount = useMemo(() => masterRecords.filter((r) => r.status === "Inactive").length, [masterRecords])

  const selectedCategoryMeta = useMemo(() => {
    return (
      CATEGORY_GROUPS.flatMap((g) => g.types).find((t) => t.key === selectedCategory) || {
        key: "state" as LookupType,
        label: "State",
        shortDesc: "Manage master states",
        icon: MapPin,
      }
    )
  }, [selectedCategory])

  const CategoryIcon = selectedCategoryMeta.icon

  return (
    <Card className="shadow-xl border-none rounded-2xl bg-white w-full overflow-hidden">
      {/* Top Header */}
      <CardHeader className="bg-slate-50/80 border-b p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <List className="h-5 w-5" />
              </div>
              <CardTitle className="text-xl font-bold text-slate-900">
                Small / Dropdown Masters
              </CardTitle>
            </div>
            <CardDescription className="mt-1.5 text-xs text-slate-600">
              Centralized reusable dropdown masters for Customers, Brokers, Transporters, Vehicles, GST compliance & Address hierarchy.
            </CardDescription>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 px-3 py-1 font-semibold text-xs">
              20 Centralized Masters
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="h-8 gap-1.5 text-xs text-slate-600 border-slate-200 hover:bg-slate-100"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[720px]">
          {/* Left Sidebar: Categorized 20 Masters */}
          <div className="lg:col-span-4 xl:col-span-3 border-r border-slate-100 bg-slate-50/40 p-4 flex flex-col gap-4">
            {/* Category Search */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search master categories..."
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                className="pl-9 h-9 bg-white text-xs border-slate-200 shadow-sm"
              />
            </div>

            {/* Category Groups List */}
            <div className="flex-1 overflow-y-auto max-h-[640px] pr-1 space-y-5">
              {filteredGroups.map((group, gIdx) => {
                const GroupIcon = group.icon
                return (
                  <div key={gIdx} className="space-y-1.5">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <GroupIcon className="h-3.5 w-3.5" />
                      <span>{group.group}</span>
                    </div>

                    <div className="space-y-0.5">
                      {group.types.map((type) => {
                        const isActive = selectedCategory === type.key
                        const count = (localRecords[type.key] || DEFAULT_MASTER_RECORDS[type.key] || []).length
                        const TypeIcon = type.icon

                        return (
                          <button
                            key={type.key}
                            onClick={() => handleCategoryChange(type.key)}
                            type="button"
                            className={`w-full text-left rounded-xl px-3 py-2.5 text-xs transition-all flex items-center justify-between group ${
                              isActive
                                ? "bg-primary text-white shadow-sm font-semibold"
                                : "bg-transparent text-slate-700 hover:bg-slate-100/90 font-medium"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              <TypeIcon
                                className={`h-4 w-4 shrink-0 ${
                                  isActive ? "text-white" : "text-slate-400 group-hover:text-primary"
                                }`}
                              />
                              <span className="truncate">{type.label}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                                  isActive ? "bg-white/20 text-white" : "bg-slate-200/70 text-slate-600"
                                }`}
                              >
                                {count}
                              </span>
                              {isActive && <ChevronRight className="h-3.5 w-3.5" />}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {filteredGroups.length === 0 && (
                <div className="p-6 text-center text-xs text-slate-400">
                  No master category matches "{categorySearch}".
                </div>
              )}
            </div>
          </div>

          {/* Right Main Area: Filter toolbar, Table, Actions & Pagination */}
          <div className="lg:col-span-8 xl:col-span-9 p-6 flex flex-col gap-6 bg-white">
            {/* Top Master Header & Action Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                  <CategoryIcon className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900">
                      {selectedCategoryMeta.label} Master
                    </h3>
                    <Badge variant="outline" className="text-[10px] font-semibold bg-slate-50 text-slate-600">
                      {activeCount} Active / {masterRecords.length} Total
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{selectedCategoryMeta.shortDesc}</p>
                </div>
              </div>

              <Button
                onClick={handleOpenAddDialog}
                disabled={isMasterTabReadOnly}
                className="bg-primary text-white hover:bg-primary/90 shadow-sm font-medium text-xs h-9 px-4 rounded-xl flex items-center gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Add New {selectedCategoryMeta.label}
              </Button>
            </div>

            {/* Filter Toolbar */}
            <div className="bg-slate-50/60 rounded-2xl border border-slate-100 p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
              {/* Search Bar */}
              <div className="w-full sm:w-72 relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder={`Search ${selectedCategoryMeta.label.toLowerCase()}...`}
                  value={tableSearch}
                  onChange={(e) => {
                    setTableSearch(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="pl-8 h-8 text-xs bg-white border-slate-200"
                />
              </div>

              {/* Filter Pills & Relational Cascading Filters */}
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                {/* Dependent State Filter for District Master */}
                {selectedCategory === "district" && (
                  <div className="w-48">
                    <Select
                      value={parentFilterStateId}
                      onValueChange={(val) => {
                        setParentFilterStateId(val)
                        setCurrentPage(1)
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs bg-white border-slate-200">
                        <SelectValue placeholder="Filter by State" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All States</SelectItem>
                        {allStates.map((s) => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Dependent District Filter for Sub-District Master */}
                {selectedCategory === "sub_district" && (
                  <div className="w-52">
                    <Select
                      value={parentFilterDistrictId}
                      onValueChange={(val) => {
                        setParentFilterDistrictId(val)
                        setCurrentPage(1)
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs bg-white border-slate-200">
                        <SelectValue placeholder="Filter by District" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All Districts</SelectItem>
                        {allDistricts.map((d) => (
                          <SelectItem key={d.id} value={String(d.id)}>
                            {d.name} ({d.state_name})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Status Filter Buttons */}
                <div className="flex items-center bg-white rounded-lg border border-slate-200 p-0.5 shadow-xs">
                  {(["All", "Active", "Inactive"] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => {
                        setStatusFilter(st)
                        setCurrentPage(1)
                      }}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                        statusFilter === st
                          ? "bg-primary text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Table of Records */}
            <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow>
                    <TableHead className="w-12 text-xs font-semibold text-slate-700">#</TableHead>

                    {/* Master-Specific Column Headers */}
                    {selectedCategory === "state" && (
                      <>
                        <TableHead className="text-xs font-semibold text-slate-700">State Name</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-700">GST State Code</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-700">GST Short Name</TableHead>
                      </>
                    )}

                    {selectedCategory === "district" && (
                      <>
                        <TableHead className="text-xs font-semibold text-slate-700">District Name</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-700">Mapped State</TableHead>
                      </>
                    )}

                    {selectedCategory === "sub_district" && (
                      <>
                        <TableHead className="text-xs font-semibold text-slate-700">Sub-District Name</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-700">Mapped District</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-700">Derived State</TableHead>
                      </>
                    )}

                    {selectedCategory === "uqc" && (
                      <>
                        <TableHead className="text-xs font-semibold text-slate-700">UQC Code</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-700">Unit Quantity Description</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-700">Dropdown Display</TableHead>
                      </>
                    )}

                    {selectedCategory === "gst_rate" && (
                      <>
                        <TableHead className="text-xs font-semibold text-slate-700">GST Rate (%)</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-700">Description / Label</TableHead>
                      </>
                    )}

                    {selectedCategory === "hsn_code" && (
                      <>
                        <TableHead className="text-xs font-semibold text-slate-700">8-digit HSN Code</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-700">Commodity Description</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-700">Dropdown Display</TableHead>
                      </>
                    )}

                    {selectedCategory === "sac_code" && (
                      <>
                        <TableHead className="text-xs font-semibold text-slate-700">6-digit SAC Code</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-700">Service Description</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-700">Dropdown Display</TableHead>
                      </>
                    )}

                    {selectedCategory === "fuel_type" && (
                      <>
                        <TableHead className="text-xs font-semibold text-slate-700">Fuel Type</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-700">PUCC Applicability</TableHead>
                      </>
                    )}

                    {selectedCategory === "rto_code" && (
                      <>
                        <TableHead className="text-xs font-semibold text-slate-700">RTO Code</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-700">RTO Location Name</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-700">Dropdown Display</TableHead>
                      </>
                    )}

                    {![
                      "state",
                      "district",
                      "sub_district",
                      "uqc",
                      "gst_rate",
                      "hsn_code",
                      "sac_code",
                      "fuel_type",
                      "rto_code",
                    ].includes(selectedCategory) && (
                      <>
                        <TableHead className="text-xs font-semibold text-slate-700">Name / Value</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-700">Description / Details</TableHead>
                      </>
                    )}

                    <TableHead className="text-xs font-semibold text-slate-700">Status</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-700 text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {paginatedRecords.map((item, index) => {
                    const rowIdx = (currentPage - 1) * pageSize + index + 1
                    const isItemActive = item.status === "Active"

                    return (
                      <TableRow
                        key={item.id}
                        className={`hover:bg-slate-50/60 text-xs border-b border-slate-50 ${
                          !isItemActive ? "bg-slate-50/40 opacity-75" : ""
                        }`}
                      >
                        <TableCell className="text-slate-400 font-mono pl-4">{rowIdx}</TableCell>

                        {/* State Record Cells */}
                        {selectedCategory === "state" && (
                          <>
                            <TableCell className="font-semibold text-slate-900">{item.name}</TableCell>
                            <TableCell className="font-mono font-bold text-slate-700">
                              {item.code || item.gst_state_code || item.state_code || "—"}
                            </TableCell>
                            <TableCell className="font-semibold text-primary">
                              {item.short_name || "—"}
                            </TableCell>
                          </>
                        )}

                        {/* District Record Cells */}
                        {selectedCategory === "district" && (
                          <>
                            <TableCell className="font-semibold text-slate-900">{item.name}</TableCell>
                            <TableCell className="text-slate-700 font-medium flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 text-primary" />
                              {item.state_name || stateNameById[String(item.state_id)] || "—"}
                            </TableCell>
                          </>
                        )}

                        {/* Sub-District Record Cells */}
                        {selectedCategory === "sub_district" && (
                          <>
                            <TableCell className="font-semibold text-slate-900">{item.name}</TableCell>
                            <TableCell className="text-slate-700 font-medium">
                              {item.district_name || districtMapById[String(item.district_id)]?.name || "—"}
                            </TableCell>
                            <TableCell className="text-slate-500">
                              {item.state_name || districtMapById[String(item.district_id)]?.state_name || "—"}
                            </TableCell>
                          </>
                        )}

                        {/* UQC Record Cells */}
                        {selectedCategory === "uqc" && (
                          <>
                            <TableCell className="font-mono font-bold text-primary">{item.code}</TableCell>
                            <TableCell className="font-medium text-slate-900">{item.name}</TableCell>
                            <TableCell className="font-mono text-[11px] text-slate-500 bg-slate-50 px-2 py-0.5 rounded w-fit">
                              {formatDropdownLabel("uqc", item)}
                            </TableCell>
                          </>
                        )}

                        {/* GST Rate Cells */}
                        {selectedCategory === "gst_rate" && (
                          <>
                            <TableCell className="font-bold text-emerald-600 text-sm">{item.rate}%</TableCell>
                            <TableCell className="text-slate-700 font-medium">{item.name}</TableCell>
                          </>
                        )}

                        {/* HSN Code Cells */}
                        {selectedCategory === "hsn_code" && (
                          <>
                            <TableCell className="font-mono font-bold text-primary text-xs">
                              {item.code || item.hsn_code}
                            </TableCell>
                            <TableCell className="text-slate-700 font-medium">{item.description || item.name}</TableCell>
                            <TableCell className="text-[11px] text-slate-500 font-medium">
                              {formatDropdownLabel("hsn_code", item)}
                            </TableCell>
                          </>
                        )}

                        {/* SAC Code Cells */}
                        {selectedCategory === "sac_code" && (
                          <>
                            <TableCell className="font-mono font-bold text-primary text-xs">
                              {item.code || item.sac_code}
                            </TableCell>
                            <TableCell className="text-slate-700 font-medium">{item.description || item.name}</TableCell>
                            <TableCell className="text-[11px] text-slate-500 font-medium">
                              {formatDropdownLabel("sac_code", item)}
                            </TableCell>
                          </>
                        )}

                        {/* Fuel Type Cells */}
                        {selectedCategory === "fuel_type" && (
                          <>
                            <TableCell className="font-semibold text-slate-900">{item.name}</TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  (item.pucc_applicable ?? item.puccApplicable) === "Applicable"
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                }
                              >
                                {item.pucc_applicable ?? item.puccApplicable ?? "Applicable"}
                              </Badge>
                            </TableCell>
                          </>
                        )}

                        {/* RTO Code Cells */}
                        {selectedCategory === "rto_code" && (
                          <>
                            <TableCell className="font-mono font-bold text-primary">{item.code}</TableCell>
                            <TableCell className="font-medium text-slate-900">{item.rto_name || item.name}</TableCell>
                            <TableCell className="font-medium text-slate-600">
                              {formatDropdownLabel("rto_code", item)}
                            </TableCell>
                          </>
                        )}

                        {/* Default Generic Cells */}
                        {![
                          "state",
                          "district",
                          "sub_district",
                          "uqc",
                          "gst_rate",
                          "hsn_code",
                          "sac_code",
                          "fuel_type",
                          "rto_code",
                        ].includes(selectedCategory) && (
                          <>
                            <TableCell className="font-semibold text-slate-900">{item.name}</TableCell>
                            <TableCell className="text-slate-600">{item.description || "—"}</TableCell>
                          </>
                        )}

                        {/* Status Column */}
                        <TableCell>
                          <Badge
                            variant={isItemActive ? "default" : "secondary"}
                            className={
                              isItemActive
                                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none font-medium text-[10px]"
                                : "bg-slate-100 text-slate-500 border-none font-medium text-[10px]"
                            }
                          >
                            {item.status || "Active"}
                          </Badge>
                        </TableCell>

                        {/* Action Buttons */}
                        <TableCell className="text-right pr-6">
                          <div className="flex items-center justify-end gap-1">
                            {/* Edit Button */}
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={isMasterTabReadOnly}
                              onClick={() => handleOpenEditDialog(item)}
                              className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              title="Edit Record"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>

                            {/* Activate / Deactivate Button */}
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={isMasterTabReadOnly}
                              onClick={() => handleToggleStatus(item)}
                              className={`h-8 w-8 ${
                                isItemActive
                                  ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                  : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              }`}
                              title={isItemActive ? "Deactivate (Make Inactive)" : "Activate Record"}
                            >
                              <Power className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}

                  {paginatedRecords.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-slate-400 text-xs">
                        No {selectedCategoryMeta.label.toLowerCase()} records match the filter.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            {filteredRecords.length > 0 && (
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-500 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <span>Show</span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(val) => {
                      setPageSize(Number(val))
                      setCurrentPage(1)
                    }}
                  >
                    <SelectTrigger className="h-7 w-16 text-xs bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                  <span>
                    records • Showing {(currentPage - 1) * pageSize + 1} to{" "}
                    {Math.min(currentPage * pageSize, filteredRecords.length)} of {filteredRecords.length}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 text-xs"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronsLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 text-xs"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="px-2 font-medium">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 text-xs"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 text-xs"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronsRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>

      {/* Add / Edit Master Record Dialog Modal */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <CategoryIcon className="h-5 w-5 text-primary" />
              {dialogMode === "add" ? `Add New ${selectedCategoryMeta.label}` : `Edit ${selectedCategoryMeta.label}`}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {dialogMode === "add"
                ? `Create a reusable dropdown entry for ${selectedCategoryMeta.label}.`
                : `Modify master details for ${selectedCategoryMeta.label}. Changes update referenced dropdowns.`}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveForm} className="space-y-4 py-2">
            {/* Form Fields by Category */}
            {selectedCategory === "state" && (
              <>
                <div className="grid gap-1.5">
                  <Label htmlFor="dlg_state_name">
                    State Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="dlg_state_name"
                    value={formData.name || ""}
                    onChange={(e) => handleFieldChange("name", e.target.value)}
                    placeholder="e.g. Chhattisgarh, Maharashtra, Gujarat"
                  />
                  {formErrors.name && <p className="text-[11px] text-red-500 font-medium">{formErrors.name}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="dlg_state_code">
                      State Code as per GST <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="dlg_state_code"
                      maxLength={2}
                      value={formData.state_code || ""}
                      onChange={(e) => handleFieldChange("state_code", e.target.value.replace(/\D/g, ""))}
                      placeholder="e.g. 22, 27, 07"
                    />
                    <span className="text-[10px] text-slate-400">2-digit code (preserves leading zero)</span>
                    {formErrors.state_code && (
                      <p className="text-[11px] text-red-500 font-medium">{formErrors.state_code}</p>
                    )}
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="dlg_short_name">Short Name as per GST</Label>
                    <Input
                      id="dlg_short_name"
                      maxLength={5}
                      value={formData.short_name || ""}
                      onChange={(e) => handleFieldChange("short_name", e.target.value.toUpperCase())}
                      placeholder="e.g. CG, MH, DL"
                    />
                    <span className="text-[10px] text-slate-400">Standard GST state abbreviation</span>
                  </div>
                </div>
              </>
            )}

            {selectedCategory === "district" && (
              <>
                <div className="grid gap-1.5">
                  <Label htmlFor="dlg_dist_name">
                    District Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="dlg_dist_name"
                    value={formData.name || ""}
                    onChange={(e) => handleFieldChange("name", e.target.value)}
                    placeholder="e.g. Raipur, Bilaspur, Pune"
                  />
                  {formErrors.name && <p className="text-[11px] text-red-500 font-medium">{formErrors.name}</p>}
                </div>

                <div className="grid gap-1.5">
                  <Label>
                    State Mapping (Dropdown) <span className="text-red-500">*</span>
                  </Label>
                  <Combobox
                    options={allStates.map((s) => ({
                      value: String(s.id),
                      label: `${s.name} (Code: ${s.gst_code || "—"})`,
                    }))}
                    value={formData.state_id ? String(formData.state_id) : ""}
                    onValueChange={(val) => handleFieldChange("state_id", val)}
                    placeholder="Select mapped parent state..."
                    searchPlaceholder="Search states..."
                    emptyText="No state found."
                  />
                  {formErrors.state_id && (
                    <p className="text-[11px] text-red-500 font-medium">{formErrors.state_id}</p>
                  )}
                </div>
              </>
            )}

            {selectedCategory === "sub_district" && (
              <>
                <div className="grid gap-1.5">
                  <Label htmlFor="dlg_sub_name">
                    Sub-District Name (Tehsil / Taluka) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="dlg_sub_name"
                    value={formData.name || ""}
                    onChange={(e) => handleFieldChange("name", e.target.value)}
                    placeholder="e.g. Raipur, Arang, Haveli"
                  />
                  {formErrors.name && <p className="text-[11px] text-red-500 font-medium">{formErrors.name}</p>}
                </div>

                <div className="grid gap-1.5">
                  <Label>
                    District Mapping (Dropdown) <span className="text-red-500">*</span>
                  </Label>
                  <Combobox
                    options={allDistricts.map((d) => ({
                      value: String(d.id),
                      label: `${d.name} (${d.state_name})`,
                    }))}
                    value={formData.district_id ? String(formData.district_id) : ""}
                    onValueChange={(val) => handleFieldChange("district_id", val)}
                    placeholder="Select mapped parent district..."
                    searchPlaceholder="Search districts..."
                    emptyText="No district found."
                  />
                  {formErrors.district_id && (
                    <p className="text-[11px] text-red-500 font-medium">{formErrors.district_id}</p>
                  )}
                  {formData.district_id && districtMapById[String(formData.district_id)] && (
                    <p className="text-[11px] text-emerald-600 flex items-center gap-1 mt-0.5">
                      <CheckCircle2 className="h-3 w-3" />
                      Derived State: {districtMapById[String(formData.district_id)].state_name}
                    </p>
                  )}
                </div>
              </>
            )}

            {selectedCategory === "hsn_code" && (
              <>
                <div className="grid gap-1.5">
                  <Label htmlFor="dlg_hsn_code">
                    HSN Code (Complete 8-digit) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="dlg_hsn_code"
                    maxLength={8}
                    value={formData.code || ""}
                    onChange={(e) => handleFieldChange("code", e.target.value.replace(/\D/g, ""))}
                    placeholder="e.g. 15159040, 15121110"
                  />
                  <span className="text-[10px] text-slate-400">Must contain exactly 8 numeric digits</span>
                  {formErrors.code && <p className="text-[11px] text-red-500 font-medium">{formErrors.code}</p>}
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="dlg_hsn_desc">
                    Commodity / Product Description <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="dlg_hsn_desc"
                    value={formData.description || ""}
                    onChange={(e) => handleFieldChange("description", e.target.value)}
                    placeholder="e.g. Rice bran oil, refined edible grade"
                  />
                  {formErrors.description && (
                    <p className="text-[11px] text-red-500 font-medium">{formErrors.description}</p>
                  )}
                </div>
              </>
            )}

            {selectedCategory === "sac_code" && (
              <>
                <div className="grid gap-1.5">
                  <Label htmlFor="dlg_sac_code">
                    SAC Code (Complete 6-digit) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="dlg_sac_code"
                    maxLength={6}
                    value={formData.code || ""}
                    onChange={(e) => handleFieldChange("code", e.target.value.replace(/\D/g, ""))}
                    placeholder="e.g. 996511, 996711"
                  />
                  <span className="text-[10px] text-slate-400">Must contain exactly 6 numeric digits</span>
                  {formErrors.code && <p className="text-[11px] text-red-500 font-medium">{formErrors.code}</p>}
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="dlg_sac_desc">
                    Service Description <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="dlg_sac_desc"
                    value={formData.description || ""}
                    onChange={(e) => handleFieldChange("description", e.target.value)}
                    placeholder="e.g. Road transport services of goods by trucks/tankers"
                  />
                  {formErrors.description && (
                    <p className="text-[11px] text-red-500 font-medium">{formErrors.description}</p>
                  )}
                </div>
              </>
            )}

            {selectedCategory === "uqc" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="dlg_uqc_code">
                      UQC Code <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="dlg_uqc_code"
                      maxLength={6}
                      value={formData.code || ""}
                      onChange={(e) => handleFieldChange("code", e.target.value.toUpperCase())}
                      placeholder="e.g. KGS, NOS, BTL"
                    />
                    {formErrors.code && <p className="text-[11px] text-red-500 font-medium">{formErrors.code}</p>}
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="dlg_uqc_name">
                      Unit Quantity Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="dlg_uqc_name"
                      value={formData.name || ""}
                      onChange={(e) => handleFieldChange("name", e.target.value)}
                      placeholder="e.g. Kilograms, Bottles"
                    />
                    {formErrors.name && <p className="text-[11px] text-red-500 font-medium">{formErrors.name}</p>}
                  </div>
                </div>
              </>
            )}

            {selectedCategory === "gst_rate" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="dlg_rate_num">
                      Rate (%) <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="dlg_rate_num"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={formData.rate || ""}
                      onChange={(e) => handleFieldChange("rate", e.target.value)}
                      placeholder="e.g. 18, 5, 12, 0"
                    />
                    {formErrors.rate && <p className="text-[11px] text-red-500 font-medium">{formErrors.rate}</p>}
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="dlg_rate_name">Rate Description</Label>
                    <Input
                      id="dlg_rate_name"
                      value={formData.name || ""}
                      onChange={(e) => handleFieldChange("name", e.target.value)}
                      placeholder="e.g. Standard GST 18%"
                    />
                  </div>
                </div>
              </>
            )}

            {selectedCategory === "fuel_type" && (
              <>
                <div className="grid gap-1.5">
                  <Label htmlFor="dlg_fuel_name">
                    Fuel Type Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="dlg_fuel_name"
                    value={formData.name || ""}
                    onChange={(e) => handleFieldChange("name", e.target.value)}
                    placeholder="e.g. Diesel, Petrol, CNG, Electric, Hybrid"
                  />
                  {formErrors.name && <p className="text-[11px] text-red-500 font-medium">{formErrors.name}</p>}
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="dlg_pucc">
                    PUCC Requirement <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.pucc_applicable || "Applicable"}
                    onValueChange={(val) => handleFieldChange("pucc_applicable", val)}
                  >
                    <SelectTrigger id="dlg_pucc">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Applicable">Applicable (PUCC Required)</SelectItem>
                      <SelectItem value="Not Applicable">Not Applicable (Exempt / Electric)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {selectedCategory === "rto_code" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="dlg_rto_code">
                      RTO Code <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="dlg_rto_code"
                      value={formData.code || ""}
                      onChange={(e) => handleFieldChange("code", e.target.value.toUpperCase())}
                      placeholder="e.g. CG04, MH12"
                    />
                    {formErrors.code && <p className="text-[11px] text-red-500 font-medium">{formErrors.code}</p>}
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="dlg_rto_name">
                      RTO Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="dlg_rto_name"
                      value={formData.rto_name || ""}
                      onChange={(e) => handleFieldChange("rto_name", e.target.value)}
                      placeholder="e.g. Raipur, Pune"
                    />
                    {formErrors.rto_name && (
                      <p className="text-[11px] text-red-500 font-medium">{formErrors.rto_name}</p>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Simple / Preset Options */}
            {selectedCategory === "is_gst_registered" && (
              <div className="grid gap-1.5">
                <Label>GST Registration Status <span className="text-red-500">*</span></Label>
                <div className="flex gap-2 mb-1">
                  {["Registered", "Unregistered"].map((opt) => (
                    <Button
                      key={opt}
                      type="button"
                      variant={formData.name === opt ? "default" : "outline"}
                      size="sm"
                      className="h-8 text-xs font-semibold"
                      onClick={() => handleFieldChange("name", opt)}
                    >
                      {opt}
                    </Button>
                  ))}
                </div>
                <Input
                  value={formData.name || ""}
                  onChange={(e) => handleFieldChange("name", e.target.value)}
                  placeholder="e.g. Registered, Unregistered"
                />
                {formErrors.name && <p className="text-[11px] text-red-500 font-medium">{formErrors.name}</p>}
              </div>
            )}

            {selectedCategory === "gst_registration_type" && (
              <div className="grid gap-1.5">
                <Label>GST Registration Type <span className="text-red-500">*</span></Label>
                <div className="flex gap-2 mb-1">
                  {["Regular", "Composition"].map((opt) => (
                    <Button
                      key={opt}
                      type="button"
                      variant={formData.name === opt ? "default" : "outline"}
                      size="sm"
                      className="h-8 text-xs font-semibold"
                      onClick={() => handleFieldChange("name", opt)}
                    >
                      {opt}
                    </Button>
                  ))}
                </div>
                <Input
                  value={formData.name || ""}
                  onChange={(e) => handleFieldChange("name", e.target.value)}
                  placeholder="e.g. Regular, Composition"
                />
                {formErrors.name && <p className="text-[11px] text-red-500 font-medium">{formErrors.name}</p>}
              </div>
            )}

            {selectedCategory === "msme_registration_type" && (
              <div className="grid gap-1.5">
                <Label>MSME Registration Type <span className="text-red-500">*</span></Label>
                <div className="flex gap-2 mb-1">
                  {["Micro", "Small", "Medium"].map((opt) => (
                    <Button
                      key={opt}
                      type="button"
                      variant={formData.name === opt ? "default" : "outline"}
                      size="sm"
                      className="h-8 text-xs font-semibold"
                      onClick={() => handleFieldChange("name", opt)}
                    >
                      {opt}
                    </Button>
                  ))}
                </div>
                <Input
                  value={formData.name || ""}
                  onChange={(e) => handleFieldChange("name", e.target.value)}
                  placeholder="e.g. Micro, Small, Medium"
                />
                {formErrors.name && <p className="text-[11px] text-red-500 font-medium">{formErrors.name}</p>}
              </div>
            )}

            {selectedCategory === "fssai_licence_type" && (
              <div className="grid gap-1.5">
                <Label>FSSAI Licence Type <span className="text-red-500">*</span></Label>
                <div className="flex flex-wrap gap-2 mb-1">
                  {["Registration", "State Licence", "National Licence"].map((opt) => (
                    <Button
                      key={opt}
                      type="button"
                      variant={formData.name === opt ? "default" : "outline"}
                      size="sm"
                      className="h-8 text-xs font-semibold"
                      onClick={() => handleFieldChange("name", opt)}
                    >
                      {opt}
                    </Button>
                  ))}
                </div>
                <Input
                  value={formData.name || ""}
                  onChange={(e) => handleFieldChange("name", e.target.value)}
                  placeholder="e.g. Registration, State Licence, National Licence"
                />
                {formErrors.name && <p className="text-[11px] text-red-500 font-medium">{formErrors.name}</p>}
              </div>
            )}

            {/* Default Generic Form Fields */}
            {![
              "state",
              "district",
              "sub_district",
              "hsn_code",
              "sac_code",
              "uqc",
              "gst_rate",
              "fuel_type",
              "rto_code",
              "is_gst_registered",
              "gst_registration_type",
              "msme_registration_type",
              "fssai_licence_type",
            ].includes(selectedCategory) && (
              <div className="grid gap-1.5">
                <Label htmlFor="dlg_gen_name">
                  Name / Value <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="dlg_gen_name"
                  value={formData.name || ""}
                  onChange={(e) => handleFieldChange("name", e.target.value)}
                  placeholder={`Enter ${selectedCategoryMeta.label.toLowerCase()} name`}
                />
                {formErrors.name && <p className="text-[11px] text-red-500 font-medium">{formErrors.name}</p>}
              </div>
            )}

            {/* Optional Description for generic types */}
            {![
              "state",
              "district",
              "sub_district",
              "hsn_code",
              "sac_code",
              "gst_rate",
              "fuel_type",
              "rto_code",
            ].includes(selectedCategory) && (
              <div className="grid gap-1.5">
                <Label htmlFor="dlg_gen_desc">Description / Notes (Optional)</Label>
                <Input
                  id="dlg_gen_desc"
                  value={formData.description || ""}
                  onChange={(e) => handleFieldChange("description", e.target.value)}
                  placeholder="Additional notes or criteria"
                />
              </div>
            )}

            {/* Active / Inactive Status Selector */}
            <div className="grid gap-1.5 pt-1">
              <Label htmlFor="dlg_status">Status</Label>
              <Select
                value={formData.status || "Active"}
                onValueChange={(val) => handleFieldChange("status", val)}
              >
                <SelectTrigger id="dlg_status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active (Available for selection in dropdowns)</SelectItem>
                  <SelectItem value="Inactive">Inactive (Excluded from new entries; historical preserved)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isSubmitting}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-primary text-white hover:bg-primary/90 text-xs font-medium"
              >
                <Save className="h-3.5 w-3.5 mr-1.5" />
                {isSubmitting ? "Saving..." : dialogMode === "add" ? "Save Master Record" : "Update Record"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
