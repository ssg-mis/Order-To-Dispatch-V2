"use client"

import { useState, useMemo, useEffect, Fragment, type ReactNode } from "react"
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
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
  RefreshCw,
  SlidersHorizontal,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  AlertTriangle,
  Upload,
  Download,
  Loader2,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  GripVertical
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { COUNTRIES } from "@/lib/countries"
import { stateApi, districtApi, subDistrictApi, lookupApi, oilTagApi, type LookupType } from "@/lib/api-service"
import { DEFAULT_MASTER_RECORDS, formatDropdownLabel, compareMasterRecords, isPrimaryMasterRecord, formatBankLabel } from "@/lib/dropdown-masters"

interface RefColumn {
  key: string
  label: string
  sort: (item: any) => string | number
  cell: (item: any) => ReactNode
}

/** The API stores PUCC applicability as a boolean; the UI works with "Applicable" / "Not Applicable". */
function puccLabel(v: any): "Applicable" | "Not Applicable" {
  if (v === false || v === "false" || v === 0 || v === "Not Applicable") return "Not Applicable"
  return "Applicable"
}

/** Fetch the records of one reference master from the API (same shape for every consumer of the query cache). */
async function fetchMasterRecords(category: LookupType): Promise<any[]> {
  if (category === "state") {
    const res = await stateApi.getAll({ all: "true" })
    return res.success ? (res.data?.states || []) : []
  }
  if (category === "district") {
    const res = await districtApi.getAll({ all: "true" })
    return res.success ? (res.data?.districts || []) : []
  }
  if (category === "sub_district") {
    const res = await subDistrictApi.getAll({ all: "true" })
    return res.success ? (res.data?.sub_districts || res.data?.subDistricts || []) : []
  }
  const res = await lookupApi.getAll(category, { all: "true" })
  return res.success ? (res.data?.items || []) : []
}

export interface ReferenceDataTabProps {
  activeStates?: Array<{ id: number | string; state_name: string; status?: string; gst_state_code?: string; short_name?: string }>
  isMasterTabReadOnly?: boolean
  onImportOilTags?: () => void
  onExportOilTags?: () => void
  isExportingOilTags?: boolean
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

export function ReferenceDataTab({
  activeStates = [],
  isMasterTabReadOnly = false,
  onImportOilTags,
  onExportOilTags,
  isExportingOilTags = false,
}: ReferenceDataTabProps) {
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
    queryFn: () => fetchMasterRecords(selectedCategory),
    staleTime: 60 * 1000,
  })

  // Sidebar badge counts: the real record count of every master (same query keys as the table, so they
  // share the cache). Falls back to the local list only where the table itself falls back to it.
  const countQueries = useQueries({
    queries: CATEGORY_GROUPS.flatMap((g) => g.types).map((t) => ({
      queryKey: ["small-masters", t.key],
      queryFn: () => fetchMasterRecords(t.key),
      staleTime: 60 * 1000,
    })),
  })

  // Real districts (shares the cache with the District master query) for State -> District cascading
  const { data: remoteDistricts } = useQuery({
    queryKey: ["small-masters", "district"],
    queryFn: async () => {
      const res = await districtApi.getAll({ all: "true" })
      return res.success ? (res.data?.districts || []) : []
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

    // De-duplicate by GST code (fallback: name) so the same state coming from the DB
    // and from local defaults (different ids) doesn't appear twice. DB/props win.
    const dedupeKey = (st: any) =>
      st.gst_code ? `code:${String(st.gst_code).trim()}` : `name:${String(st.name || "").trim().toLowerCase()}`
    const map = new Map<string, any>()
    fromLocal.forEach((st) => map.set(dedupeKey(st), st))
    fromProps.forEach((st) => map.set(dedupeKey(st), st))

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [activeStates, localRecords.state])

  // State Name lookup map
  const stateNameById = useMemo(() => {
    return Object.fromEntries(allStates.map((s) => [String(s.id), s.name]))
  }, [allStates])

  // All Districts for Sub-District mapping dropdown & filter
  const allDistricts = useMemo(() => {
    // Prefer real (DB) districts so ids line up with real State / Sub-District ids;
    // fall back to local defaults only when the DB list is empty.
    const useRemote = Array.isArray(remoteDistricts) && remoteDistricts.length > 0
    const list = useRemote ? remoteDistricts : (localRecords.district || DEFAULT_MASTER_RECORDS.district || [])

    // Local default districts carry local state ids; map them onto the real state ids via GST code.
    const localStateCodeById: Record<string, string> = {}
    ;(localRecords.state || []).forEach((s: any) => {
      localStateCodeById[String(s.id)] = String(s.gst_state_code || s.state_code || "")
    })
    const realStateIdByCode: Record<string, string> = {}
    allStates.forEach((s) => {
      if (s.gst_code) realStateIdByCode[String(s.gst_code)] = String(s.id)
    })
    const resolveStateId = (rawId: any) => {
      const id = String(rawId ?? "")
      if (useRemote) return id
      const code = localStateCodeById[id]
      return (code && realStateIdByCode[code]) || id
    }

    return list.map((d: any) => {
      const stateId = resolveStateId(d.state_id)
      return {
        id: String(d.id),
        name: d.district_name || d.name,
        state_id: stateId,
        state_name: d.state_name || stateNameById[stateId] || "—",
        status: d.status || "Active",
      }
    }).sort((a, b) => a.name.localeCompare(b.name))
  }, [remoteDistricts, localRecords.district, localRecords.state, allStates, stateNameById])

  // Real sub-districts (shares the cache with the Sub-District master query) for District -> Sub-District cascading
  const { data: remoteSubDistricts } = useQuery({
    queryKey: ["small-masters", "sub_district"],
    queryFn: async () => {
      const res = await subDistrictApi.getAll({ all: "true" })
      return res.success ? (res.data?.sub_districts || res.data?.subDistricts || []) : []
    },
    staleTime: 60 * 1000,
  })

  const allSubDistricts = useMemo(() => {
    const useRemote = Array.isArray(remoteSubDistricts) && remoteSubDistricts.length > 0
    const list = useRemote ? remoteSubDistricts : (localRecords.sub_district || DEFAULT_MASTER_RECORDS.sub_district || [])
    return list
      .map((sd: any) => ({
        id: String(sd.id),
        name: sd.sub_district_name || sd.name,
        district_id: String(sd.district_id || ""),
      }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name))
  }, [remoteSubDistricts, localRecords.sub_district])

  // Cities (shares the cache with the City master query) for the Post form's City dropdown
  const { data: remoteCities } = useQuery({
    queryKey: ["small-masters", "city"],
    queryFn: async () => {
      const res = await lookupApi.getAll("city", { all: "true" })
      return res.success ? (res.data?.items || []) : []
    },
    staleTime: 60 * 1000,
  })

  const allCities = useMemo(() => {
    const useRemote = Array.isArray(remoteCities) && remoteCities.length > 0
    const list = useRemote ? remoteCities : (localRecords.city || DEFAULT_MASTER_RECORDS.city || [])
    return list
      .map((c: any) => ({
        id: String(c.id),
        name: c.name,
        state_id: String(c.state_id || ""),
        district_id: String(c.district_id || ""),
        sub_district_id: String(c.sub_district_id || ""),
      }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name))
  }, [remoteCities, localRecords.city])

  // Posts (shares the cache with the Post master query) for the Thana form's Post dropdown
  const { data: remotePosts } = useQuery({
    queryKey: ["small-masters", "post"],
    queryFn: async () => {
      const res = await lookupApi.getAll("post", { all: "true" })
      return res.success ? (res.data?.items || []) : []
    },
    staleTime: 60 * 1000,
  })

  const allPosts = useMemo(() => {
    const useRemote = Array.isArray(remotePosts) && remotePosts.length > 0
    const list = useRemote ? remotePosts : (localRecords.post || DEFAULT_MASTER_RECORDS.post || [])
    return list
      .map((c: any) => ({
        id: String(c.id),
        name: c.name,
        state_id: String(c.state_id || ""),
        district_id: String(c.district_id || ""),
        sub_district_id: String(c.sub_district_id || ""),
        city_id: String(c.city_id || ""),
      }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name))
  }, [remotePosts, localRecords.post])

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
    } else if (selectedCategory === "bank_name") {
      initialDefaults.country = "India"
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
      country: item.country || "",
      state_code: item.gst_state_code || item.state_code || "",
      state_id: String(
        item.state_id || (selectedCategory === "sub_district" ? districtMapById[String(item.district_id)]?.state_id : "") || ""
      ),
      district_id: String(item.district_id || ""),
      sub_district_id: String(item.sub_district_id || ""),
      city_id: String(item.city_id || ""),
      post_id: String(item.post_id || ""),
      rate: item.rate !== undefined && item.rate !== null ? String(item.rate) : "",
      pucc_applicable: puccLabel(item.pucc_applicable ?? item.puccApplicable),
      rto_name: item.rto_name || item.name || "",
      status: item.status || "Active",
    })

    setIsDialogOpen(true)
  }

  // A row coming from the database (as opposed to the built-in demo rows shown while a master is still empty)
  const isRemoteRecord = (item: any) =>
    Array.isArray(remoteData) && remoteData.some((r: any) => String(r.id) === String(item.id))

  // Delete (confirmed in a dialog)
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleConfirmDelete = async () => {
    const item = deleteTarget
    if (!item) return
    setIsDeleting(true)
    try {
      if (isRemoteRecord(item)) {
        let res: any
        if (selectedCategory === "state") {
          res = await stateApi.delete(item.id)
        } else if (selectedCategory === "district") {
          res = await districtApi.delete(item.id)
        } else if (selectedCategory === "sub_district") {
          res = await subDistrictApi.delete(item.id)
        } else {
          res = await lookupApi.delete(selectedCategory, item.id)
        }
        if (res && res.success === false) throw new Error(res.message || "Failed to delete record")
        queryClient.invalidateQueries({ queryKey: ["small-masters", selectedCategory] })
      } else {
        setLocalRecords((prev) => ({
          ...prev,
          [selectedCategory]: (prev[selectedCategory] || []).filter((r) => String(r.id) !== String(item.id)),
        }))
      }
      toast({ title: "Record Deleted", description: `"${item.name || item.code}" has been deleted.` })
      setDeleteTarget(null)
    } catch (err: any) {
      toast({
        title: "Could not delete record",
        description: err?.message || "Failed to delete record.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  // Form Field Change Handler
  const handleFieldChange = (field: string, value: any) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value }
      if (selectedCategory === "sub_district") {
        if (field === "state_id" && String(prev.state_id || "") !== String(value || "")) {
          next.district_id = ""
        }
      }
      if (selectedCategory === "city" || selectedCategory === "post" || selectedCategory === "thana") {
        if (field === "state_id" && String(prev.state_id || "") !== String(value || "")) {
          next.district_id = ""
          next.sub_district_id = ""
          next.city_id = ""
          next.post_id = ""
        }
        if (field === "district_id" && String(prev.district_id || "") !== String(value || "")) {
          next.sub_district_id = ""
          next.city_id = ""
          next.post_id = ""
        }
        if (field === "sub_district_id" && String(prev.sub_district_id || "") !== String(value || "")) {
          next.city_id = ""
          next.post_id = ""
        }
        if (field === "city_id" && String(prev.city_id || "") !== String(value || "")) {
          next.post_id = ""
        }
      }
      return next
    })
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
        if (!formData.state_id) errors.state_id = "Please select a State"
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

      case "bank_name": {
        if (!formData.name?.trim()) errors.name = "Bank Name is required"
        if (!formData.short_name?.trim()) errors.short_name = "Short Name is required (e.g. SBI, PNB, ICICI)"
        if (!formData.country?.trim()) errors.country = "Please select a Country"
        const dupBank = activeExisting.some(
          (b) => b.name?.toLowerCase().trim() === formData.name?.toLowerCase().trim()
        )
        if (dupBank) errors.name = "A bank with this name already exists"
        break
      }

      case "thana": {
        if (!formData.name?.trim()) errors.name = "Thana Name is required"
        if (!formData.state_id) errors.state_id = "Please select a State"
        const dupThana = activeExisting.some(
          (c) => c.name?.toLowerCase().trim() === formData.name?.toLowerCase().trim()
        )
        if (dupThana) errors.name = "A thana with this name already exists"
        break
      }

      case "post": {
        if (!formData.name?.trim()) errors.name = "Post Name is required"
        if (!String(formData.code || "").trim()) {
          errors.code = "Postal Code is required"
        } else if (!/^[0-9]{6}$/.test(String(formData.code).trim())) {
          errors.code = "Postal Code must be exactly 6 digits (e.g. 492001)"
        }
        if (!formData.state_id) errors.state_id = "Please select a State"
        const dupPost = activeExisting.some(
          (c) => c.name?.toLowerCase().trim() === formData.name?.toLowerCase().trim()
        )
        if (dupPost) errors.name = "A post with this name already exists"
        break
      }

      case "city": {
        if (!formData.name?.trim()) errors.name = "City Name is required"
        if (!formData.state_id) errors.state_id = "Please select a State"
        const dupCity = activeExisting.some(
          (c) => c.name?.toLowerCase().trim() === formData.name?.toLowerCase().trim()
        )
        if (dupCity) errors.name = "A city with this name already exists"
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
      } else if (selectedCategory === "city") {
        payload.name = formData.name.trim()
        payload.state_id = parseInt(formData.state_id, 10)
        payload.district_id = formData.district_id ? parseInt(formData.district_id, 10) : null
        payload.sub_district_id = formData.sub_district_id ? parseInt(formData.sub_district_id, 10) : null
        payload.state_name = stateNameById[String(formData.state_id)] || ""
        payload.district_name = formData.district_id ? districtMapById[String(formData.district_id)]?.name || "" : ""
        payload.sub_district_name = formData.sub_district_id
          ? allSubDistricts.find((sd: any) => sd.id === String(formData.sub_district_id))?.name || ""
          : ""
        formattedDisplayName = payload.name
      } else if (selectedCategory === "bank_name") {
        payload.name = formData.name.trim()
        payload.short_name = (formData.short_name || "").trim().toUpperCase()
        payload.country = (formData.country || "").trim()
        formattedDisplayName = formatBankLabel(payload)
      } else if (selectedCategory === "thana") {
        payload.name = formData.name.trim()
        payload.state_id = parseInt(formData.state_id, 10)
        payload.district_id = formData.district_id ? parseInt(formData.district_id, 10) : null
        payload.sub_district_id = formData.sub_district_id ? parseInt(formData.sub_district_id, 10) : null
        payload.city_id = formData.city_id ? parseInt(formData.city_id, 10) : null
        payload.post_id = formData.post_id ? parseInt(formData.post_id, 10) : null
        payload.state_name = stateNameById[String(formData.state_id)] || ""
        payload.district_name = formData.district_id ? districtMapById[String(formData.district_id)]?.name || "" : ""
        payload.sub_district_name = formData.sub_district_id
          ? allSubDistricts.find((sd: any) => sd.id === String(formData.sub_district_id))?.name || ""
          : ""
        payload.city_name = formData.city_id
          ? allCities.find((c: any) => c.id === String(formData.city_id))?.name || ""
          : ""
        payload.post_name = formData.post_id
          ? allPosts.find((c: any) => c.id === String(formData.post_id))?.name || ""
          : ""
        formattedDisplayName = payload.name
      } else if (selectedCategory === "post") {
        payload.name = formData.name.trim()
        payload.code = String(formData.code || "").trim()
        payload.state_id = parseInt(formData.state_id, 10)
        payload.district_id = formData.district_id ? parseInt(formData.district_id, 10) : null
        payload.sub_district_id = formData.sub_district_id ? parseInt(formData.sub_district_id, 10) : null
        payload.city_id = formData.city_id ? parseInt(formData.city_id, 10) : null
        payload.state_name = stateNameById[String(formData.state_id)] || ""
        payload.district_name = formData.district_id ? districtMapById[String(formData.district_id)]?.name || "" : ""
        payload.sub_district_name = formData.sub_district_id
          ? allSubDistricts.find((sd: any) => sd.id === String(formData.sub_district_id))?.name || ""
          : ""
        payload.city_name = formData.city_id
          ? allCities.find((c: any) => c.id === String(formData.city_id))?.name || ""
          : ""
        formattedDisplayName = payload.name
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
        const puccText = puccLabel(formData.pucc_applicable)
        payload.pucc_applicable = puccText === "Applicable" // boolean column in the database
        formattedDisplayName = `${payload.name} (${puccText})`
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
        // Send ONLY real fields to the API (a made-up client id used to be sent here, which the database
        // rejected). API errors are NOT swallowed any more - they surface in the catch below as a toast.
        let res: any
        if (selectedCategory === "state") {
          res = await stateApi.create(payload)
        } else if (selectedCategory === "district") {
          res = await districtApi.create(payload)
        } else if (selectedCategory === "sub_district") {
          res = await subDistrictApi.create(payload)
        } else {
          res = await lookupApi.create(selectedCategory, payload)
        }
        if (res && res.success === false) throw new Error(res.message || "Failed to save record")

        toast({
          title: "Record Created",
          description:
            res?.message && /approval/i.test(res.message)
              ? `"${formattedDisplayName}" was submitted for approval in ${label}.`
              : `"${formattedDisplayName}" has been successfully added to ${label}.`,
        })
      } else {
        // Edit Mode
        let res: any
        if (selectedCategory === "state") {
          res = await stateApi.update(editingItem.id, payload)
        } else if (selectedCategory === "district") {
          res = await districtApi.update(editingItem.id, payload)
        } else if (selectedCategory === "sub_district") {
          res = await subDistrictApi.update(editingItem.id, payload)
        } else {
          res = await lookupApi.update(selectedCategory, editingItem.id, payload)
        }
        if (res && res.success === false) throw new Error(res.message || "Failed to update record")

        toast({
          title: "Record Updated",
          description:
            res?.message && /approval/i.test(res.message)
              ? `"${formattedDisplayName}" edit was submitted for approval.`
              : `"${formattedDisplayName}" has been successfully updated.`,
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

    // Parent State filter for Sub-District Master (via the mapped district's state)
    if (selectedCategory === "sub_district" && parentFilterStateId !== "ALL") {
      list = list.filter(
        (sd) =>
          String(sd.state_id || districtMapById[String(sd.district_id)]?.state_id || "") ===
          String(parentFilterStateId)
      )
    }

    // Parent District filter for Sub-District Master
    if (selectedCategory === "sub_district" && parentFilterDistrictId !== "ALL") {
      list = list.filter((sd) => String(sd.district_id) === String(parentFilterDistrictId))
    }

    // Free text search
    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase().trim()
      list = list.filter((r) => {
        // Sub-District search matches the Sub-District Name column only
        if (selectedCategory === "sub_district") {
          return !!r.name && String(r.name).toLowerCase().includes(q)
        }
        return (
          (r.name && String(r.name).toLowerCase().includes(q)) ||
          (r.code && String(r.code).toLowerCase().includes(q)) ||
          (r.description && String(r.description).toLowerCase().includes(q)) ||
          (r.state_name && String(r.state_name).toLowerCase().includes(q)) ||
          (r.district_name && String(r.district_name).toLowerCase().includes(q)) ||
          (r.sub_district_name && String(r.sub_district_name).toLowerCase().includes(q)) ||
          (r.city_name && String(r.city_name).toLowerCase().includes(q)) ||
          (r.country && String(r.country).toLowerCase().includes(q)) ||
          (r.post_name && String(r.post_name).toLowerCase().includes(q)) ||
          (r.short_name && String(r.short_name).toLowerCase().includes(q)) ||
          (r.rto_name && String(r.rto_name).toLowerCase().includes(q)) ||
          (r.rate && String(r.rate).includes(q)) ||
          (r.status && String(r.status).toLowerCase().includes(q))
        )
      })
    }

    return list
  }, [masterRecords, statusFilter, parentFilterStateId, parentFilterDistrictId, tableSearch, selectedCategory, districtMapById])

  // ---- Column definitions (per master), sorting & drag-reorder ----
  const columnDefs = useMemo<RefColumn[]>(() => {
    const nameCell = (item: any) => (
      <TableCell className="font-semibold text-slate-900">
        <span className="inline-flex items-center gap-2">
          {item.name}
          {isPrimaryMasterRecord(selectedCategory, item) && (
            <Badge className="bg-primary/10 text-primary border-none text-[10px] font-semibold hover:bg-primary/10">
              Primary
            </Badge>
          )}
        </span>
      </TableCell>
    )
    const statusCol: RefColumn = {
      key: "status",
      label: "Status",
      sort: (i) => i.status || "Active",
      cell: (item) => {
        const active = item.status === "Active"
        return (
          <TableCell>
            <Badge
              variant={active ? "default" : "secondary"}
              className={
                active
                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none font-medium text-[10px]"
                  : "bg-slate-100 text-slate-500 border-none font-medium text-[10px]"
              }
            >
              {item.status || "Active"}
            </Badge>
          </TableCell>
        )
      },
    }
    let cols: RefColumn[]
    switch (selectedCategory) {
      case "state":
        cols = [
          { key: "name", label: "State Name", sort: (i) => i.name, cell: nameCell },
          {
            key: "code",
            label: "GST State Code",
            sort: (i) => i.code || i.gst_state_code || i.state_code || "",
            cell: (i) => (
              <TableCell className="font-mono font-bold text-slate-700">
                {i.code || i.gst_state_code || i.state_code || "—"}
              </TableCell>
            ),
          },
          {
            key: "short_name",
            label: "GST Short Name",
            sort: (i) => i.short_name || "",
            cell: (i) => <TableCell className="font-semibold text-primary">{i.short_name || "—"}</TableCell>,
          },
        ]
        break
      case "district":
        cols = [
          { key: "name", label: "District Name", sort: (i) => i.name, cell: nameCell },
          {
            key: "state",
            label: "Mapped State",
            sort: (i) => i.state_name || stateNameById[String(i.state_id)] || "",
            cell: (i) => (
              <TableCell className="text-slate-700 font-medium flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                {i.state_name || stateNameById[String(i.state_id)] || "—"}
              </TableCell>
            ),
          },
        ]
        break
      case "sub_district":
        cols = [
          { key: "name", label: "Sub-District Name", sort: (i) => i.name, cell: nameCell },
          {
            key: "district",
            label: "Mapped District",
            sort: (i) => i.district_name || districtMapById[String(i.district_id)]?.name || "",
            cell: (i) => (
              <TableCell className="text-slate-700 font-medium">
                {i.district_name || districtMapById[String(i.district_id)]?.name || "—"}
              </TableCell>
            ),
          },
          {
            key: "state",
            label: "Derived State",
            sort: (i) => i.state_name || districtMapById[String(i.district_id)]?.state_name || "",
            cell: (i) => (
              <TableCell className="text-slate-500">
                {i.state_name || districtMapById[String(i.district_id)]?.state_name || "—"}
              </TableCell>
            ),
          },
        ]
        break
      case "bank_name":
        cols = [
          { key: "name", label: "Bank Name", sort: (i) => i.name, cell: nameCell },
          {
            key: "short_name",
            label: "Short Name",
            sort: (i) => i.short_name || "",
            cell: (i) => <TableCell className="font-mono font-bold text-primary text-xs">{i.short_name || "—"}</TableCell>,
          },
          {
            key: "country",
            label: "Country",
            sort: (i) => i.country || "",
            cell: (i) => <TableCell className="text-slate-700 font-medium">{i.country || "—"}</TableCell>,
          },
          {
            key: "display",
            label: "Dropdown Display",
            sort: (i) => formatBankLabel(i),
            cell: (i) => <TableCell className="text-[11px] text-slate-500 font-medium">{formatBankLabel(i)}</TableCell>,
          },
        ]
        break
      case "thana":
        cols = [
          { key: "name", label: "Thana Name", sort: (i) => i.name, cell: nameCell },
          {
            key: "state",
            label: "State",
            sort: (i) => i.state_name || stateNameById[String(i.state_id)] || "",
            cell: (i) => (
              <TableCell className="text-slate-700 font-medium">
                {i.state_name || stateNameById[String(i.state_id)] || "—"}
              </TableCell>
            ),
          },
          {
            key: "district",
            label: "District",
            sort: (i) => i.district_name || districtMapById[String(i.district_id)]?.name || "",
            cell: (i) => (
              <TableCell className="text-slate-700 font-medium">
                {i.district_name || districtMapById[String(i.district_id)]?.name || "—"}
              </TableCell>
            ),
          },
          {
            key: "sub_district",
            label: "Sub-District",
            sort: (i) =>
              i.sub_district_name || allSubDistricts.find((sd: any) => sd.id === String(i.sub_district_id))?.name || "",
            cell: (i) => (
              <TableCell className="text-slate-500">
                {i.sub_district_name || allSubDistricts.find((sd: any) => sd.id === String(i.sub_district_id))?.name || "—"}
              </TableCell>
            ),
          },
          {
            key: "city",
            label: "City",
            sort: (i) => i.city_name || allCities.find((c: any) => c.id === String(i.city_id))?.name || "",
            cell: (i) => (
              <TableCell className="text-slate-700 font-medium">
                {i.city_name || allCities.find((c: any) => c.id === String(i.city_id))?.name || "—"}
              </TableCell>
            ),
          },
          {
            key: "post",
            label: "Post",
            sort: (i) => i.post_name || allPosts.find((c: any) => c.id === String(i.post_id))?.name || "",
            cell: (i) => (
              <TableCell className="text-slate-700 font-medium">
                {i.post_name || allPosts.find((c: any) => c.id === String(i.post_id))?.name || "—"}
              </TableCell>
            ),
          },
        ]
        break
      case "post":
        cols = [
          { key: "name", label: "Post Name", sort: (i) => i.name, cell: nameCell },
          {
            key: "code",
            label: "Postal Code",
            sort: (i) => i.code || "",
            cell: (i) => <TableCell className="font-mono font-bold text-primary text-xs">{i.code || "—"}</TableCell>,
          },
          {
            key: "state",
            label: "State",
            sort: (i) => i.state_name || stateNameById[String(i.state_id)] || "",
            cell: (i) => (
              <TableCell className="text-slate-700 font-medium">
                {i.state_name || stateNameById[String(i.state_id)] || "—"}
              </TableCell>
            ),
          },
          {
            key: "district",
            label: "District",
            sort: (i) => i.district_name || districtMapById[String(i.district_id)]?.name || "",
            cell: (i) => (
              <TableCell className="text-slate-700 font-medium">
                {i.district_name || districtMapById[String(i.district_id)]?.name || "—"}
              </TableCell>
            ),
          },
          {
            key: "sub_district",
            label: "Sub-District",
            sort: (i) =>
              i.sub_district_name || allSubDistricts.find((sd: any) => sd.id === String(i.sub_district_id))?.name || "",
            cell: (i) => (
              <TableCell className="text-slate-500">
                {i.sub_district_name || allSubDistricts.find((sd: any) => sd.id === String(i.sub_district_id))?.name || "—"}
              </TableCell>
            ),
          },
          {
            key: "city",
            label: "City",
            sort: (i) => i.city_name || allCities.find((c: any) => c.id === String(i.city_id))?.name || "",
            cell: (i) => (
              <TableCell className="text-slate-700 font-medium">
                {i.city_name || allCities.find((c: any) => c.id === String(i.city_id))?.name || "—"}
              </TableCell>
            ),
          },
        ]
        break
      case "city":
        cols = [
          { key: "name", label: "City Name", sort: (i) => i.name, cell: nameCell },
          {
            key: "state",
            label: "State",
            sort: (i) => i.state_name || stateNameById[String(i.state_id)] || "",
            cell: (i) => (
              <TableCell className="text-slate-700 font-medium">
                {i.state_name || stateNameById[String(i.state_id)] || "—"}
              </TableCell>
            ),
          },
          {
            key: "district",
            label: "District",
            sort: (i) => i.district_name || districtMapById[String(i.district_id)]?.name || "",
            cell: (i) => (
              <TableCell className="text-slate-700 font-medium">
                {i.district_name || districtMapById[String(i.district_id)]?.name || "—"}
              </TableCell>
            ),
          },
          {
            key: "sub_district",
            label: "Sub-District",
            sort: (i) =>
              i.sub_district_name || allSubDistricts.find((sd: any) => sd.id === String(i.sub_district_id))?.name || "",
            cell: (i) => (
              <TableCell className="text-slate-500">
                {i.sub_district_name || allSubDistricts.find((sd: any) => sd.id === String(i.sub_district_id))?.name || "—"}
              </TableCell>
            ),
          },
        ]
        break
      case "uqc":
        cols = [
          {
            key: "code",
            label: "UQC Code",
            sort: (i) => i.code || "",
            cell: (i) => <TableCell className="font-mono font-bold text-primary">{i.code}</TableCell>,
          },
          {
            key: "name",
            label: "Unit Quantity Description",
            sort: (i) => i.name,
            cell: (i) => <TableCell className="font-medium text-slate-900">{i.name}</TableCell>,
          },
          {
            key: "display",
            label: "Dropdown Display",
            sort: (i) => formatDropdownLabel("uqc", i),
            cell: (i) => (
              <TableCell className="font-mono text-[11px] text-slate-500 bg-slate-50 px-2 py-0.5 rounded w-fit">
                {formatDropdownLabel("uqc", i)}
              </TableCell>
            ),
          },
        ]
        break
      case "gst_rate":
        cols = [
          {
            key: "rate",
            label: "GST Rate (%)",
            sort: (i) => Number(i.rate) || 0,
            cell: (i) => <TableCell className="font-bold text-emerald-600 text-sm">{i.rate}%</TableCell>,
          },
          {
            key: "name",
            label: "Description / Label",
            sort: (i) => i.name,
            cell: (i) => <TableCell className="text-slate-700 font-medium">{i.name}</TableCell>,
          },
        ]
        break
      case "hsn_code":
      case "sac_code": {
        const isHsn = selectedCategory === "hsn_code"
        cols = [
          {
            key: "code",
            label: isHsn ? "8-digit HSN Code" : "6-digit SAC Code",
            sort: (i) => i.code || i.hsn_code || i.sac_code || "",
            cell: (i) => (
              <TableCell className="font-mono font-bold text-primary text-xs">
                {i.code || (isHsn ? i.hsn_code : i.sac_code)}
              </TableCell>
            ),
          },
          {
            key: "description",
            label: isHsn ? "Commodity Description" : "Service Description",
            sort: (i) => i.description || i.name || "",
            cell: (i) => <TableCell className="text-slate-700 font-medium">{i.description || i.name}</TableCell>,
          },
          {
            key: "display",
            label: "Dropdown Display",
            sort: (i) => formatDropdownLabel(selectedCategory as any, i),
            cell: (i) => (
              <TableCell className="text-[11px] text-slate-500 font-medium">
                {formatDropdownLabel(selectedCategory as any, i)}
              </TableCell>
            ),
          },
        ]
        break
      }
      case "fuel_type":
        cols = [
          { key: "name", label: "Fuel Type", sort: (i) => i.name, cell: nameCell },
          {
            key: "pucc",
            label: "PUCC Applicability",
            sort: (i) => puccLabel(i.pucc_applicable ?? i.puccApplicable),
            cell: (i) => (
              <TableCell>
                <Badge
                  variant="outline"
                  className={
                    puccLabel(i.pucc_applicable ?? i.puccApplicable) === "Applicable"
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                  }
                >
                  {puccLabel(i.pucc_applicable ?? i.puccApplicable)}
                </Badge>
              </TableCell>
            ),
          },
        ]
        break
      case "rto_code":
        cols = [
          {
            key: "code",
            label: "RTO Code",
            sort: (i) => i.code || "",
            cell: (i) => <TableCell className="font-mono font-bold text-primary">{i.code}</TableCell>,
          },
          {
            key: "name",
            label: "RTO Location Name",
            sort: (i) => i.rto_name || i.name || "",
            cell: (i) => <TableCell className="font-medium text-slate-900">{i.rto_name || i.name}</TableCell>,
          },
          {
            key: "display",
            label: "Dropdown Display",
            sort: (i) => formatDropdownLabel("rto_code", i),
            cell: (i) => (
              <TableCell className="font-medium text-slate-600">{formatDropdownLabel("rto_code", i)}</TableCell>
            ),
          },
        ]
        break
      default:
        cols = [
          { key: "name", label: "Name / Value", sort: (i) => i.name, cell: nameCell },
          {
            key: "description",
            label: "Description / Details",
            sort: (i) => i.description || "",
            cell: (i) => <TableCell className="text-slate-600">{i.description || "—"}</TableCell>,
          },
        ]
    }
    return [...cols, statusCol]
  }, [selectedCategory, stateNameById, districtMapById, allSubDistricts, allCities, allPosts])

  const [columnOrders, setColumnOrders] = useState<Record<string, string[]>>({})
  const [sortConfig, setSortConfig] = useState<{ key: string; dir: "asc" | "desc" } | null>(null)
  const [dragColKey, setDragColKey] = useState<string | null>(null)
  const [dragOverColKey, setDragOverColKey] = useState<string | null>(null)

  // Restore saved column order (client only, avoids SSR hydration mismatch)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("refdata_column_orders")
      if (raw) setColumnOrders(JSON.parse(raw))
    } catch {}
  }, [])

  useEffect(() => {
    setSortConfig(null)
  }, [selectedCategory])

  const orderedColumns = useMemo(() => {
    const saved = columnOrders[selectedCategory] || []
    const byKey = new Map(columnDefs.map((c) => [c.key, c]))
    const ordered = saved.filter((k) => byKey.has(k)).map((k) => byKey.get(k)!)
    columnDefs.forEach((c) => {
      if (!saved.includes(c.key)) ordered.push(c)
    })
    return ordered
  }, [columnDefs, columnOrders, selectedCategory])

  const moveColumn = (from: string, to: string) => {
    if (from === to) return
    const keys = orderedColumns.map((c) => c.key)
    const fromIdx = keys.indexOf(from)
    const toIdx = keys.indexOf(to)
    if (fromIdx < 0 || toIdx < 0) return
    keys.splice(fromIdx, 1)
    keys.splice(toIdx, 0, from)
    setColumnOrders((prev) => {
      const next = { ...prev, [selectedCategory]: keys }
      try {
        localStorage.setItem("refdata_column_orders", JSON.stringify(next))
      } catch {}
      return next
    })
  }

  const toggleSort = (key: string) => {
    setSortConfig((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" }
      if (prev.dir === "asc") return { key, dir: "desc" }
      return null
    })
    setCurrentPage(1)
  }

  const sortedRecords = useMemo(() => {
    // Default order (no column sort chosen): a master's fixed business order, e.g. MSME = Micro, Small, Medium
    if (!sortConfig) {
      return [...filteredRecords].sort((a, b) => compareMasterRecords(selectedCategory, a, b))
    }
    const col = columnDefs.find((c) => c.key === sortConfig.key)
    if (!col) return filteredRecords
    const mul = sortConfig.dir === "asc" ? 1 : -1
    return [...filteredRecords].sort((a, b) => {
      const av = col.sort(a)
      const bv = col.sort(b)
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * mul
      return String(av ?? "").localeCompare(String(bv ?? ""), undefined, { numeric: true, sensitivity: "base" }) * mul
    })
  }, [filteredRecords, columnDefs, sortConfig, selectedCategory])

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(sortedRecords.length / pageSize))
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedRecords.slice(start, start + pageSize)
  }, [sortedRecords, currentPage, pageSize])

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
    <Card className="shadow-xl border-none rounded-2xl bg-white w-full overflow-hidden py-0 gap-0">
      {/* Top Header */}
      <CardHeader className="bg-slate-50/80 border-b px-6 py-3">
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
          <div className="lg:col-span-4 xl:col-span-3 border-r border-slate-100 bg-slate-50/40 px-4 pt-3 pb-4 flex flex-col gap-3">
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
                        const typeIdx = CATEGORY_GROUPS.flatMap((g) => g.types).findIndex((t) => t.key === type.key)
        const remoteForType = countQueries[typeIdx]?.data
        const count =
          Array.isArray(remoteForType) && remoteForType.length > 0
            ? remoteForType.length
            : (localRecords[type.key] || DEFAULT_MASTER_RECORDS[type.key] || []).length
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
          <div className="lg:col-span-8 xl:col-span-9 px-6 pt-3 pb-6 flex flex-col gap-3 bg-white">
            {/* Top Master Header & Action Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-100">
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

              <div className="flex items-center gap-2">
                {selectedCategory === "oil_type" && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/80 text-emerald-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                      disabled={isMasterTabReadOnly}
                      onClick={onImportOilTags}
                      title={isMasterTabReadOnly ? "View Only Access" : "Import Oil Tags via CSV/Excel"}
                    >
                      <Upload className="w-3.5 h-3.5 mr-1" />
                      Import CSV
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 border-blue-200 bg-blue-50/60 hover:bg-blue-100/80 text-blue-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                      disabled={isExportingOilTags}
                      onClick={onExportOilTags}
                      title="Export Oil Tags to CSV"
                    >
                      {isExportingOilTags ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                      ) : (
                        <Download className="w-3.5 h-3.5 mr-1" />
                      )}
                      Export CSV
                    </Button>
                  </>
                )}
                <Button
                  onClick={handleOpenAddDialog}
                  disabled={isMasterTabReadOnly}
                  className="bg-primary text-white hover:bg-primary/90 shadow-sm font-medium text-xs h-9 px-4 rounded-xl flex items-center gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  Add New {selectedCategoryMeta.label}
                </Button>
              </div>
            </div>

            {/* Filter Toolbar */}
            <div className="bg-slate-50/60 rounded-2xl border border-slate-100 p-3 flex flex-col gap-2">
              {/* Row 1: Search + State + District */}
              <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 w-full">
              {/* Search Bar */}
              <div className="w-full sm:w-64 shrink-0 relative">
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

                <div className="flex flex-wrap items-center gap-2 ml-auto">
                {/* State Filter for District & Sub-District Masters */}
                {(selectedCategory === "district" || selectedCategory === "sub_district") && (
                  <div className="w-full sm:w-60 shrink-0">
                    <Combobox
                      options={[
                        { value: "ALL", label: "All States" },
                        ...allStates.map((s) => ({ value: String(s.id), label: [s.gst_code, s.short_name, s.name].filter(Boolean).join(" ") })),
                      ]}
                      value={parentFilterStateId}
                      onValueChange={(val) => {
                        setParentFilterStateId(val || "ALL")
                        // District options depend on the chosen state, so reset the district filter
                        setParentFilterDistrictId("ALL")
                        setCurrentPage(1)
                      }}
                      placeholder="Filter by State"
                      searchPlaceholder="Search states..."
                      className="h-8 text-xs bg-white border-slate-200"
                      popoverClassName="min-w-[18rem]"
                    />
                  </div>
                )}

                {/* Dependent District Filter for Sub-District Master */}
                {selectedCategory === "sub_district" && (
                  <div className="w-full sm:w-60 shrink-0">
                    <Combobox
                      options={[
                        { value: "ALL", label: "All Districts" },
                        ...allDistricts
                          .filter((d) => parentFilterStateId === "ALL" || String(d.state_id) === String(parentFilterStateId))
                          .map((d) => ({
                            value: String(d.id),
                            label: `${d.name} (${d.state_name})`,
                          })),
                      ]}
                      value={parentFilterDistrictId}
                      onValueChange={(val) => {
                        setParentFilterDistrictId(val || "ALL")
                        setCurrentPage(1)
                      }}
                      placeholder="Filter by District"
                      searchPlaceholder="Search districts..."
                      className="h-8 text-xs bg-white border-slate-200"
                      popoverClassName="min-w-[18rem]"
                    />
                  </div>
                )}
                </div>
              </div>

                {/* Row 2: Status Filter Buttons */}
                <div className="flex items-center w-fit bg-white rounded-lg border border-slate-200 p-0.5 shadow-xs">
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

            {/* Table of Records */}
            <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow>
                    <TableHead className="w-12 text-xs font-semibold text-slate-700">#</TableHead>

                    {orderedColumns.map((col) => {
                      const isSorted = sortConfig?.key === col.key
                      return (
                        <TableHead
                          key={col.key}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = "move"
                            e.dataTransfer.setData("text/plain", col.key)
                            setDragColKey(col.key)
                          }}
                          onDragOver={(e) => {
                            e.preventDefault()
                            if (dragOverColKey !== col.key) setDragOverColKey(col.key)
                          }}
                          onDragLeave={() => setDragOverColKey((k) => (k === col.key ? null : k))}
                          onDrop={(e) => {
                            e.preventDefault()
                            if (dragColKey) moveColumn(dragColKey, col.key)
                            setDragColKey(null)
                            setDragOverColKey(null)
                          }}
                          onDragEnd={() => {
                            setDragColKey(null)
                            setDragOverColKey(null)
                          }}
                          className={`text-xs font-semibold text-slate-700 select-none ${
                            dragColKey === col.key ? "opacity-40" : ""
                          } ${dragOverColKey === col.key && dragColKey !== col.key ? "bg-blue-50 shadow-[inset_2px_0_0_0_#2563eb]" : ""}`}
                        >
                          <div className="flex items-center gap-1">
                            <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-slate-300" />
                            <button
                              type="button"
                              onClick={() => toggleSort(col.key)}
                              className="flex items-center gap-1 hover:text-primary"
                              title="Click to sort"
                            >
                              {col.label}
                              {isSorted ? (
                                sortConfig!.dir === "asc" ? (
                                  <ArrowUp className="h-3.5 w-3.5 text-primary" />
                                ) : (
                                  <ArrowDown className="h-3.5 w-3.5 text-primary" />
                                )
                              ) : (
                                <ArrowUpDown className="h-3.5 w-3.5 text-slate-300" />
                              )}
                            </button>
                          </div>
                        </TableHead>
                      )
                    })}
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

                        {orderedColumns.map((col) => (
                          <Fragment key={col.key}>{col.cell(item)}</Fragment>
                        ))}

                        {/* Action Buttons */}
                        <TableCell className="text-right pr-6">
                          <div className="flex items-center justify-end gap-1">
                            {/* Edit Button */}
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={isMasterTabReadOnly || isPrimaryMasterRecord(selectedCategory, item)}
                              onClick={() => handleOpenEditDialog(item)}
                              className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              title="Edit Record"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>

                            {/* Delete Button */}
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={isMasterTabReadOnly || isPrimaryMasterRecord(selectedCategory, item)}
                              onClick={() => setDeleteTarget(item)}
                              className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="Delete Record"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}

                  {paginatedRecords.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={orderedColumns.length + 2} className="text-center py-12 text-slate-400 text-xs">
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
                  <div className="w-20">
                    <Combobox
                      options={[
                        { value: "10", label: "10" },
                        { value: "25", label: "25" },
                        { value: "50", label: "50" },
                      ]}
                      value={String(pageSize)}
                      onValueChange={(val) => {
                        if (!val) return
                        setPageSize(Number(val))
                        setCurrentPage(1)
                      }}
                      searchPlaceholder="Search..."
                      className="h-7 text-xs bg-white px-2"
                    />
                  </div>
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
                      label: [s.gst_code, s.short_name, s.name].filter(Boolean).join(" "),
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
                    State <span className="text-red-500">*</span>
                  </Label>
                  <Combobox
                    options={allStates.map((s) => ({
                      value: String(s.id),
                      label: [s.gst_code, s.short_name, s.name].filter(Boolean).join(" "),
                    }))}
                    value={formData.state_id ? String(formData.state_id) : ""}
                    onValueChange={(val) => handleFieldChange("state_id", val)}
                    placeholder="Select state..."
                    searchPlaceholder="Search states..."
                    emptyText="No state found."
                  />
                  {formErrors.state_id && (
                    <p className="text-[11px] text-red-500 font-medium">{formErrors.state_id}</p>
                  )}
                </div>

                <div className="grid gap-1.5">
                  <Label>
                    District <span className="text-red-500">*</span>
                  </Label>
                  <Combobox
                    options={allDistricts
                      .filter((d) => String(d.state_id) === String(formData.state_id || ""))
                      .map((d) => ({ value: String(d.id), label: d.name }))}
                    value={formData.district_id ? String(formData.district_id) : ""}
                    onValueChange={(val) => handleFieldChange("district_id", val)}
                    placeholder={formData.state_id ? "Select district..." : "Select a state first"}
                    searchPlaceholder="Search districts..."
                    emptyText="No district found for this state."
                    disabled={!formData.state_id}
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
                  <Combobox
                    options={[
                      { value: "Applicable", label: "Applicable (PUCC Required)" },
                      { value: "Not Applicable", label: "Not Applicable (Exempt / Electric)" },
                    ]}
                    value={formData.pucc_applicable || "Applicable"}
                    onValueChange={(val) => val && handleFieldChange("pucc_applicable", val)}
                    searchPlaceholder="Search..."
                  />
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

            {selectedCategory === "bank_name" && (
              <>
                <div className="grid gap-1.5">
                  <Label htmlFor="dlg_bank_name">
                    Bank Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="dlg_bank_name"
                    value={formData.name || ""}
                    onChange={(e) => handleFieldChange("name", e.target.value)}
                    placeholder="e.g. State Bank of India"
                  />
                  {formErrors.name && <p className="text-[11px] text-red-500 font-medium">{formErrors.name}</p>}
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="dlg_bank_short">
                    Short Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="dlg_bank_short"
                    value={formData.short_name || ""}
                    maxLength={20}
                    onChange={(e) => handleFieldChange("short_name", e.target.value.toUpperCase())}
                    placeholder="e.g. SBI, PNB, ICICI"
                  />
                  {formErrors.short_name && (
                    <p className="text-[11px] text-red-500 font-medium">{formErrors.short_name}</p>
                  )}
                </div>

                <div className="grid gap-1.5">
                  <Label>
                    Country <span className="text-red-500">*</span>
                  </Label>
                  <Combobox
                    options={COUNTRIES.map((c) => ({ value: c, label: c }))}
                    value={formData.country || ""}
                    onValueChange={(val) => handleFieldChange("country", val)}
                    placeholder="Select country..."
                    searchPlaceholder="Search countries..."
                    emptyText="No country found."
                  />
                  {formErrors.country && <p className="text-[11px] text-red-500 font-medium">{formErrors.country}</p>}
                </div>

                {formData.name?.trim() && (
                  <p className="text-[11px] text-slate-500">
                    Dropdown display:{" "}
                    <span className="font-semibold text-slate-700">
                      {formatBankLabel({ name: formData.name, country: formData.country })}
                    </span>
                  </p>
                )}
              </>
            )}

            {(selectedCategory === "city" || selectedCategory === "post" || selectedCategory === "thana") && (
              <>
                <div className="grid gap-1.5">
                  <Label htmlFor="dlg_city_name">
                    {selectedCategory === "post" ? "Post Name" : selectedCategory === "thana" ? "Thana Name" : "City Name"}{" "}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="dlg_city_name"
                    value={formData.name || ""}
                    onChange={(e) => handleFieldChange("name", e.target.value)}
                    placeholder={
                      selectedCategory === "post"
                        ? "Enter post name"
                        : selectedCategory === "thana"
                          ? "Enter thana name"
                          : "Enter city name"
                    }
                  />
                  {formErrors.name && <p className="text-[11px] text-red-500 font-medium">{formErrors.name}</p>}
                </div>

                {selectedCategory === "post" && (
                  <div className="grid gap-1.5">
                    <Label htmlFor="dlg_post_code">
                      Postal Code (PIN) <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="dlg_post_code"
                      inputMode="numeric"
                      maxLength={6}
                      value={formData.code || ""}
                      onChange={(e) => handleFieldChange("code", e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="e.g. 492001"
                    />
                    {formErrors.code && <p className="text-[11px] text-red-500 font-medium">{formErrors.code}</p>}
                  </div>
                )}

                <div className="grid gap-1.5">
                  <Label>
                    State <span className="text-red-500">*</span>
                  </Label>
                  <Combobox
                    options={allStates.map((s) => ({
                      value: String(s.id),
                      label: [s.gst_code, s.short_name, s.name].filter(Boolean).join(" "),
                    }))}
                    value={formData.state_id ? String(formData.state_id) : ""}
                    onValueChange={(val) => handleFieldChange("state_id", val)}
                    placeholder="Select state..."
                    searchPlaceholder="Search states..."
                    emptyText="No state found."
                  />
                  {formErrors.state_id && (
                    <p className="text-[11px] text-red-500 font-medium">{formErrors.state_id}</p>
                  )}
                </div>

                <div className="grid gap-1.5">
                  <Label>District</Label>
                  <Combobox
                    options={allDistricts
                      .filter((d) => String(d.state_id) === String(formData.state_id || ""))
                      .map((d) => ({ value: String(d.id), label: d.name }))}
                    value={formData.district_id ? String(formData.district_id) : ""}
                    onValueChange={(val) => handleFieldChange("district_id", val)}
                    placeholder={formData.state_id ? "Select district..." : "Select a state first"}
                    searchPlaceholder="Search districts..."
                    emptyText="No district found for this state."
                    disabled={!formData.state_id}
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label>Sub-District</Label>
                  <Combobox
                    options={allSubDistricts
                      .filter((sd: any) => String(sd.district_id) === String(formData.district_id || ""))
                      .map((sd: any) => ({ value: String(sd.id), label: sd.name }))}
                    value={formData.sub_district_id ? String(formData.sub_district_id) : ""}
                    onValueChange={(val) => handleFieldChange("sub_district_id", val)}
                    placeholder={formData.district_id ? "Select sub-district..." : "Select a district first"}
                    searchPlaceholder="Search sub-districts..."
                    emptyText="No sub-district found for this district."
                    disabled={!formData.district_id}
                  />
                </div>

                {(selectedCategory === "post" || selectedCategory === "thana") && (
                  <div className="grid gap-1.5">
                    <Label>City</Label>
                    <Combobox
                      options={allCities
                        .filter(
                          (c: any) =>
                            String(c.state_id) === String(formData.state_id || "") &&
                            (!c.district_id || !formData.district_id || String(c.district_id) === String(formData.district_id)) &&
                            (!c.sub_district_id ||
                              !formData.sub_district_id ||
                              String(c.sub_district_id) === String(formData.sub_district_id))
                        )
                        .map((c: any) => ({ value: String(c.id), label: c.name }))}
                      value={formData.city_id ? String(formData.city_id) : ""}
                      onValueChange={(val) => handleFieldChange("city_id", val)}
                      placeholder={formData.state_id ? "Select city..." : "Select a state first"}
                      searchPlaceholder="Search cities..."
                      emptyText="No city found for this selection."
                      disabled={!formData.state_id}
                    />
                  </div>
                )}

                {selectedCategory === "thana" && (
                  <div className="grid gap-1.5">
                    <Label>Post</Label>
                    <Combobox
                      options={allPosts
                        .filter(
                          (po: any) =>
                            String(po.state_id) === String(formData.state_id || "") &&
                            (!po.district_id || !formData.district_id || String(po.district_id) === String(formData.district_id)) &&
                            (!po.sub_district_id ||
                              !formData.sub_district_id ||
                              String(po.sub_district_id) === String(formData.sub_district_id)) &&
                            (!po.city_id || !formData.city_id || String(po.city_id) === String(formData.city_id))
                        )
                        .map((po: any) => ({ value: String(po.id), label: po.name }))}
                      value={formData.post_id ? String(formData.post_id) : ""}
                      onValueChange={(val) => handleFieldChange("post_id", val)}
                      placeholder={formData.state_id ? "Select post..." : "Select a state first"}
                      searchPlaceholder="Search posts..."
                      emptyText="No post found for this selection."
                      disabled={!formData.state_id}
                    />
                  </div>
                )}
              </>
            )}

            {/* Default Generic Form Fields */}
            {![
              "city",
              "post",
              "thana",
              "bank_name",
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
              "city",
              "post",
              "thana",
              "bank_name",
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
              <Combobox
                options={[
                  { value: "Active", label: "Active" },
                  { value: "Inactive", label: "Inactive" },
                ]}
                value={formData.status || "Active"}
                onValueChange={(val) => val && handleFieldChange("status", val)}
                searchPlaceholder="Search..."
              />
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
      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && !isDeleting && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this record?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.name || deleteTarget?.code}" will be permanently deleted from {selectedCategoryMeta.label}.
              This cannot be undone. If it is already used elsewhere, deletion will be refused - mark it Inactive
              instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault()
                handleConfirmDelete()
              }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
