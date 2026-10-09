"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Loader2,
  FileText,
  Mail,
  ShieldAlert,
  Award,
  Plus,
  Save,
  X,
  Warehouse,
  Landmark,
  Layers,
  Upload,
  ExternalLink,
  Edit,
  Trash2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Combobox } from "@/components/ui/combobox"
import { customerApi, masterHistoryApi, depotApi, lookupApi, orderApi, ledgerGroupApi } from "@/lib/api-service"
import { FileUploadField } from "@/components/file-upload-field"
import { useToast } from "@/hooks/use-toast"

type SectionType = "basic" | "mailing" | "gst" | "msme" | "fssai" | "godown" | "bank" | "ledger" | "documents"

interface CustomerEffectiveDatesModalViewProps {
  customerId: number
  customerName: string
  customerForm?: Record<string, any>
  initialSection: SectionType
  targetFieldName?: string
  onBack: () => void
}

export function CustomerEffectiveDatesModalView({
  customerId,
  customerName,
  customerForm,
  initialSection,
  targetFieldName,
  onBack,
}: CustomerEffectiveDatesModalViewProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Always scroll to top when the history view opens
  const topRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Use scrollIntoView on our own ref - most reliable across all dialog structures
    setTimeout(() => {
      topRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
      // Also reset any scrollable ancestor containers
      const container = document.querySelector('[data-slot="dialog-content"]') || document.querySelector('.overflow-y-auto');
      if (container) container.scrollTop = 0;
    }, 30);
  }, []);

  const [activeSection, setActiveSection] = useState<SectionType>(initialSection)
  const [isAdding, setIsAdding] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [newVersionForm, setNewVersionForm] = useState<Record<string, any>>({
    wefDate: new Date().toISOString().split("T")[0],
  })
  // Tracks the version currently loaded via "Edit" (its row ids + original
  // W.E.F date) so that saving under a CHANGED date can delete the original
  // rows instead of leaving a stale duplicate version behind at the old date.
  const [editingVersion, setEditingVersion] = useState<{ ids: (number | string)[]; wefDate: string } | null>(null)
  const wefDateInputRef = useRef<HTMLInputElement>(null)

  // Fetch depots for Godown section checkboxes (all active depots)
  const { data: godownsData } = useQuery({
    queryKey: ["depots-for-customer-godown-history"],
    queryFn: async () => {
      const res = await depotApi.getAll({ all: "true" })
      return res.success ? res.data?.depots || [] : []
    },
    staleTime: 5 * 60 * 1000,
  })
  const godownDepots = useMemo(
    () => (godownsData || []).filter((d: any) => d.status === "Active"),
    [godownsData]
  )

  // Fetch bank names for Bank section dropdown
  const { data: bankNamesRes } = useQuery({
    queryKey: ["bank-names-lookup"],
    queryFn: () => lookupApi.getAll("bank_name"),
    staleTime: 5 * 60 * 1000,
  })
  const activeBankNames = useMemo(() => {
    const raw = bankNamesRes?.data?.items || bankNamesRes?.data || []
    const list = Array.isArray(raw) ? raw : []
    return list.filter((b: any) => b.status === "Active")
  }, [bankNamesRes])

  // Fetch FSSAI licence types for FSSAI section dropdown
  const { data: fssaiLicenceTypesRes } = useQuery({
    queryKey: ["fssai-licence-types-lookup"],
    queryFn: () => lookupApi.getAll("fssai_licence_type"),
    staleTime: 5 * 60 * 1000,
  })
  const activeFssaiLicenceTypes = useMemo(() => {
    const raw = fssaiLicenceTypesRes?.data?.items || fssaiLicenceTypesRes?.data || []
    const list = Array.isArray(raw) ? raw : []
    return list.filter((b: any) => b.status === "Active")
  }, [fssaiLicenceTypesRes])

  // Fetch MSME registration types for MSME section dropdown
  const { data: msmeRegTypesRes } = useQuery({
    queryKey: ["msme-reg-types-lookup"],
    queryFn: () => lookupApi.getAll("msme_registration_type"),
    staleTime: 5 * 60 * 1000,
  })
  const activeMsmeRegTypes = useMemo(() => {
    const raw = msmeRegTypesRes?.data?.items || msmeRegTypesRes?.data || []
    const list = Array.isArray(raw) ? raw : []
    const filtered = list.filter((b: any) => b.status === "Active")
    const orderMap: Record<string, number> = { "Micro": 1, "Small": 2, "Medium": 3 }
    return filtered.sort((a: any, b: any) => (orderMap[a.name] || 99) - (orderMap[b.name] || 99))
  }, [msmeRegTypesRes])

  // Fetch ledger group options for Ledger section dropdown
  const { data: ledgerGroupOptionsData } = useQuery({
    queryKey: ["ledger-group-options"],
    queryFn: async () => {
      const res = await ledgerGroupApi.getAll({ all: "true" })
      return res.success ? res.data?.ledger_groups || [] : []
    },
    staleTime: 5 * 60 * 1000,
  })
  const ledgerGroupOptions: any[] = ledgerGroupOptionsData || []

  // Fetch history data for active section
  const { data: historyData, isLoading, refetch } = useQuery({
    queryKey: ["customer-sectional-history", activeSection, customerId],
    queryFn: async () => {
      if (!customerId) return []
      let res
      if (activeSection === "basic") {
        res = await masterHistoryApi.getHistory("customers", customerId)
        if (res?.success && Array.isArray(res.data)) {
          const filtered = res.data.filter((h: any) =>
            ["customer_name", "status", "email", "contact_person", "contact", "Customer Info"].includes(h.fieldName)
          )
          return filtered.map((item: any) => ({
            ...item,
            wefDate: item.applicableFrom || item.createdAt,
          }))
        }
        return []
      }
      else if (activeSection === "mailing") res = await customerApi.getMailingHistory(customerId)
      else if (activeSection === "gst") res = await customerApi.getStructuredGstHistory(customerId)
      else if (activeSection === "msme") res = await customerApi.getMsmeHistory(customerId)
      else if (activeSection === "fssai") res = await customerApi.getFssaiHistory(customerId)
      else {
        // For godown, bank, ledger, documents — fetch from master_edit_history audit log
        res = await masterHistoryApi.getHistory("customers", customerId)
        if (res?.success && Array.isArray(res.data)) {
          let filtered = res.data
          if (activeSection === "godown") {
            filtered = res.data.filter((h: any) => h.fieldName === "Belongs to Godown" || h.fieldName === "godown_ids")
          } else if (activeSection === "bank") {
            filtered = res.data.filter((h: any) => h.fieldName === "Bank Accounts" || h.fieldName === "bank_accounts")
          } else if (activeSection === "ledger") {
            filtered = res.data.filter((h: any) => h.fieldName === "Ledger Group ID" || h.fieldName === "ledger_group_id")
          } else if (activeSection === "documents") {
            filtered = res.data.filter((h: any) =>
              ["gst_certificate_upload", "msme_certificate_upload", "fssai_certificate_upload", "aadhaar_upload", "pan_upload", "Document Uploads"].includes(h.fieldName)
            )
          }
          return filtered.map((item: any) => ({
            ...item,
            wefDate: item.applicableFrom || item.createdAt,
          }))
        }
        return []
      }

      return res?.success ? res.data || [] : []
    },
    enabled: !!customerId,
    staleTime: 0,
    refetchOnMount: "always",
  })

  const rawItems = historyData || []

  // Sort items descending by WEF date, tie-breaking by createdAt timestamp & ID, then deduplicate by date (1 per date)
  const items = useMemo(() => {
    const sorted = [...rawItems].sort((a: any, b: any) => {
      const dateA = new Date(a.wefDate || a.wef_date || a.createdAt || 0).getTime()
      const dateB = new Date(b.wefDate || b.wef_date || b.createdAt || 0).getTime()
      if (dateB !== dateA) return dateB - dateA
      const createA = new Date(a.createdAt || 0).getTime()
      const createB = new Date(b.createdAt || 0).getTime()
      if (createB !== createA) return createB - createA
      return Number(b.id || 0) - Number(a.id || 0)
    })

    const dateMap = new Map<string, any>()
    for (const item of sorted) {
      const rawDateStr = item.wefDate || item.wef_date || item.createdAt
      let key = "unknown"
      if (rawDateStr) {
        try {
          const parsed = new Date(rawDateStr)
          key = !isNaN(parsed.getTime()) ? parsed.toISOString().split("T")[0] : String(rawDateStr).slice(0, 10)
        } catch {
          key = String(rawDateStr).slice(0, 10)
        }
      }

      if (!dateMap.has(key)) {
        dateMap.set(key, {
          ...item,
          wefDate: key,
          allIds: item.id && !String(item.id).startsWith("baseline") ? [item.id] : [],
        })
      } else {
        const existing = dateMap.get(key)
        if (item.id && !String(item.id).startsWith("baseline") && !existing.allIds.includes(item.id)) {
          existing.allIds.push(item.id)
        }
      }
    }
    return Array.from(dateMap.values())
  }, [rawItems])

  // Determine which record is strictly ACTIVE today (WEF date <= Today, most recent)
  const activeRecordId = useMemo(() => {
    if (!items || items.length === 0) return null
    const todayStr = new Date().toISOString().split("T")[0]

    // Find the first row in descending order where WEF date <= today
    const activeItem = items.find((item: any) => {
      const wefStr = item.wefDate || item.wef_date || item.createdAt
      const itemDateStr = new Date(wefStr).toISOString().split("T")[0]
      return itemDateStr <= todayStr
    })

    // If no row is <= today, fall back to the oldest record or first record
    return activeItem ? activeItem.id : items[items.length - 1]?.id
  }, [items])

  const activeRecord = useMemo(() => {
    if (!items || items.length === 0) return {}
    const todayStr = new Date().toISOString().split("T")[0]

    // Find the first row in descending order where WEF date <= today
    const found = items.find((item: any) => {
      const wefStr = item.wefDate || item.wef_date || item.createdAt
      const itemDateStr = new Date(wefStr).toISOString().split("T")[0]
      return itemDateStr <= todayStr
    })

    return found || items[0] || {}
  }, [items])

  const parseBankAccountsFromRow = (r: any) => {
    if (!r) return [{ bank_name_id: null, account_holder_name: "", account_number: "", ifsc_code: "" }]
    if (Array.isArray(r.bank_accounts) && r.bank_accounts.length > 0) return r.bank_accounts
    if (Array.isArray(r.bankAccounts) && r.bankAccounts.length > 0) return r.bankAccounts
    if (r.newValue && typeof r.newValue === 'string') {
      const itemsStr = r.newValue.split(/;|\n/)
      const parsed = itemsStr.map((itemStr: string) => {
        const trimStr = itemStr.trim()
        if (!trimStr || trimStr.includes('bank account(s)') || trimStr === 'None' || trimStr === 'Updated Bank Accounts') return null
        const ifscMatch = trimStr.match(/\(([^)]+)\)/)
        const ifsc = ifscMatch ? ifscMatch[1].trim() : ""
        const rest = trimStr.replace(/\([^)]+\)/, "").trim()
        const parts = rest.split('-').map(s => s.trim())
        let bank_name_id = null
        let bank_name = ""
        let account_holder_name = ""
        let account_number = ""
        if (parts.length >= 3) {
          account_holder_name = parts[0]
          bank_name = parts[1]
          account_number = parts[2]
        } else if (parts.length === 2) {
          bank_name = parts[0]
          account_number = parts[1]
        } else {
          account_number = rest
        }
        if (bank_name && activeBankNames.length > 0) {
          const found = activeBankNames.find((b: any) => b.name?.toLowerCase() === bank_name.toLowerCase())
          if (found) bank_name_id = found.id
        }
        return { bank_name_id, bank_name, account_holder_name, account_number, ifsc_code: ifsc }
      }).filter(Boolean)
      if (parsed.length > 0) return parsed
    }
    if (Array.isArray(customerForm?.bank_accounts) && customerForm.bank_accounts.length > 0) {
      return customerForm.bank_accounts
    }
    return [{ bank_name_id: null, account_holder_name: "", account_number: "", ifsc_code: "" }]
  }

  useEffect(() => {
    const latest = activeRecord
    if (activeSection === "basic") {
      setNewVersionForm({
        wefDate: new Date().toISOString().split("T")[0],
        customer_name: latest.customer_name || latest.customerName || customerForm?.customer_name || customerName || "",
        email: latest.email || customerForm?.email || "",
        contact_person: latest.contact_person || latest.contactPerson || customerForm?.contact_person || "",
        contact: latest.contact || customerForm?.contact || "",
        status: latest.status || customerForm?.status || "Active",
      })
    } else if (activeSection === "mailing") {
      setNewVersionForm({
        wefDate: new Date().toISOString().split("T")[0],
        customer_name: latest.customerName || latest.customer_name || customerForm?.customer_name || customerName || "",
        address_line_1: latest.addressLine1 || latest.address_line_1 || customerForm?.address_line_1 || "",
        address_line_2: latest.addressLine2 || latest.address_line_2 || customerForm?.address_line_2 || "",
        pincode: latest.pincode || customerForm?.pincode || "",
        state: latest.stateName || latest.state || customerForm?.state || "",
        country: latest.country || "India",
      })
    } else if (activeSection === "gst") {
      const liveGstin = latest.gstin || customerForm?.gstin || ""
      const livePan = latest.pan || customerForm?.pan || (liveGstin.length === 15 ? liveGstin.slice(2, 12) : "")
      setNewVersionForm({
        wefDate: new Date().toISOString().split("T")[0],
        gstin: liveGstin,
        pan: livePan,
        gst_registration_type: latest.gstRegistrationType || latest.gst_registration_type || customerForm?.gst_registration_type || "Regular",
        is_gst_registered: latest.isGstRegistered || latest.is_gst_registered || customerForm?.gst_registered || "Registered",
        place_of_supply: latest.placeOfSupply || latest.place_of_supply || customerForm?.place_of_supply || "",
        gst_status: latest.gstStatus || latest.gst_status || customerForm?.gst_status || "Active",
      })
    } else if (activeSection === "msme") {
      setNewVersionForm({
        wefDate: new Date().toISOString().split("T")[0],
        msme_registration_no: latest.msmeRegistrationNo || latest.msme_registration_no || customerForm?.msme_registration_no || "",
        msme_registration_type: latest.msmeRegistrationType || latest.msme_registration_type || customerForm?.msme_registration_type || "",
        msme_activity_type: latest.msmeActivityType || latest.msme_activity_type || customerForm?.msme_activity_type || "",
        msme_status: latest.msmeStatus || latest.msme_status || customerForm?.msme_status || "Active",
      })
    } else if (activeSection === "fssai") {
      setNewVersionForm({
        wefDate: new Date().toISOString().split("T")[0],
        fssai_no: latest.fssaiNo || latest.fssai_no || customerForm?.fssai_no || "",
        fssai_licence_type: latest.fssaiLicenceType || latest.fssai_licence_type || customerForm?.fssai_licence_type || "",
        fssai_valid_upto: latest.fssaiValidUpto || latest.fssai_valid_upto || customerForm?.fssai_valid_upto || "",
        fssai_certificate_upload: latest.fssaiCertificateUpload || latest.fssai_certificate_upload || customerForm?.fssai_certificate_upload || "",
      })
    } else if (activeSection === "godown") {
      const initialIds = Array.isArray(customerForm?.godown_ids) ? [...customerForm.godown_ids] : []
      const initialNames = godownDepots.filter((d: any) => initialIds.includes(d.id)).map((d: any) => d.depot_name).join(", ")
      setNewVersionForm({
        wefDate: new Date().toISOString().split("T")[0],
        godown_ids: initialIds,
        newValue: initialNames || latest.newValue || "None",
        is_required_for_commitment: customerForm?.is_required_for_commitment || "No",
      })
    } else if (activeSection === "bank") {
      const activeBanks = parseBankAccountsFromRow(latest)
      setNewVersionForm({
        wefDate: new Date().toISOString().split("T")[0],
        bank_accounts: JSON.parse(JSON.stringify(activeBanks)),
      })
    } else if (activeSection === "ledger") {
      setNewVersionForm({
        wefDate: new Date().toISOString().split("T")[0],
        newValue: customerForm?.ledger_group_id || latest.newValue || "",
      })
    } else if (activeSection === "documents") {
      setNewVersionForm({
        wefDate: new Date().toISOString().split("T")[0],
        aadhaar_upload: customerForm?.aadhaar_upload || "",
        pan_upload: customerForm?.pan_upload || "",
        gst_certificate_upload: customerForm?.gst_certificate_upload || "",
        msme_certificate_upload: customerForm?.msme_certificate_upload || "",
        fssai_certificate_upload: customerForm?.fssai_certificate_upload || "",
      })
    }

    const timer = setTimeout(() => {
      if (targetFieldName) {
        const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-field-name]'))
        const match = elements.find((el) => {
          const field = el.getAttribute('data-field-name')?.toLowerCase() || ''
          const target = targetFieldName.toLowerCase()
          return field === target || field.includes(target) || target.includes(field)
        })
        if (match) {
          match.focus({ preventScroll: true })
          return
        }
      }
      if (wefDateInputRef.current) {
        wefDateInputRef.current.focus({ preventScroll: true })
      }
    }, 150)
    return () => clearTimeout(timer)
  }, [activeSection, activeRecordId, customerId, targetFieldName])

  const handleToggleAdd = () => {
    if (!isAdding) {
      // Opening a fresh blank form (not via Edit) - clear any stale edit-tracking state.
      setEditingVersion(null)
      const latest = activeRecord
      if (activeSection === "basic") {
        setNewVersionForm({
          wefDate: new Date().toISOString().split("T")[0],
          customer_name: latest.customer_name || latest.customerName || customerName || customerForm?.customer_name || "",
          email: latest.email || customerForm?.email || "",
          contact_person: latest.contact_person || latest.contactPerson || customerForm?.contact_person || "",
          contact: latest.contact || customerForm?.contact || "",
          status: latest.status || customerForm?.status || "Active",
        })
      } else if (activeSection === "mailing") {
        setNewVersionForm({
          wefDate: new Date().toISOString().split("T")[0],
          customer_name: latest.customerName || latest.customer_name || customerName || customerForm?.customer_name || "",
          address_line_1: latest.addressLine1 || latest.address_line_1 || customerForm?.address_line_1 || "",
          address_line_2: latest.addressLine2 || latest.address_line_2 || customerForm?.address_line_2 || "",
          pincode: latest.pincode || customerForm?.pincode || "",
          state: latest.stateName || latest.state || customerForm?.state || "",
          country: latest.country || "India",
        })
      } else if (activeSection === "gst") {
        const liveGstin = latest.gstin || customerForm?.gstin || ""
        const livePan = latest.pan || customerForm?.pan || (liveGstin.length === 15 ? liveGstin.slice(2, 12) : "")
        setNewVersionForm({
          wefDate: new Date().toISOString().split("T")[0],
          gstin: liveGstin,
          pan: livePan,
          gst_registration_type: latest.gstRegistrationType || latest.gst_registration_type || customerForm?.gst_registration_type || "Regular",
          is_gst_registered: latest.isGstRegistered || latest.is_gst_registered || customerForm?.gst_registered || "Registered",
          place_of_supply: latest.placeOfSupply || latest.place_of_supply || "",
          gst_status: latest.gstStatus || latest.gst_status || customerForm?.gst_status || "Active",
        })
      } else if (activeSection === "msme") {
        setNewVersionForm({
          wefDate: new Date().toISOString().split("T")[0],
          msme_registration_no: latest.msmeRegistrationNo || latest.msme_registration_no || customerForm?.msme_registration_no || "",
          msme_registration_type: latest.msmeRegistrationType || latest.msme_registration_type || customerForm?.msme_registration_type || "",
          msme_activity_type: latest.msmeActivityType || latest.msme_activity_type || customerForm?.msme_activity_type || "",
          msme_status: latest.msmeStatus || latest.msme_status || customerForm?.msme_status || "Active",
        })
      } else if (activeSection === "fssai") {
        setNewVersionForm({
          wefDate: new Date().toISOString().split("T")[0],
          fssai_no: latest.fssaiNo || latest.fssai_no || customerForm?.fssai_no || "",
          fssai_licence_type: latest.fssaiLicenceType || latest.fssai_licence_type || customerForm?.fssai_licence_type || "",
          fssai_valid_upto: latest.fssaiValidUpto || latest.fssai_valid_upto || customerForm?.fssai_valid_upto || "",
          fssai_certificate_upload: latest.fssaiCertificateUpload || latest.fssai_certificate_upload || customerForm?.fssai_certificate_upload || "",
        })
      } else if (activeSection === "godown") {
        let initialIds = Array.isArray(customerForm?.godown_ids) && customerForm.godown_ids.length > 0 ? [...customerForm.godown_ids] : []
        if (initialIds.length === 0) {
           const banariId = godownDepots.find((d: any) => d.depot_name?.toLowerCase() === 'banari')?.id
           if (banariId) {
              initialIds = [banariId]
           }
        }
        const initialNames = godownDepots.filter((d: any) => initialIds.includes(d.id)).map((d: any) => d.depot_name).join(", ")
        setNewVersionForm({
          wefDate: new Date().toISOString().split("T")[0],
          godown_ids: initialIds,
          newValue: latest.newValue || initialNames || "None",
          is_required_for_commitment: customerForm?.is_required_for_commitment || "No",
        })
      } else if (activeSection === "bank") {
        const activeBanks = (Array.isArray(latest.bank_accounts) && latest.bank_accounts.length > 0)
          ? latest.bank_accounts
          : (Array.isArray(latest.bankAccounts) && latest.bankAccounts.length > 0)
            ? latest.bankAccounts
            : (Array.isArray(customerForm?.bank_accounts) && customerForm.bank_accounts.length > 0)
              ? customerForm.bank_accounts
              : [{ bank_name_id: null, account_holder_name: "", account_number: "", ifsc_code: "" }]
        setNewVersionForm({
          wefDate: new Date().toISOString().split("T")[0],
          bank_accounts: JSON.parse(JSON.stringify(activeBanks)),
        })
      } else if (activeSection === "ledger") {
        setNewVersionForm({
          wefDate: new Date().toISOString().split("T")[0],
          newValue: latest.newValue || customerForm?.ledger_group_id || "",
        })
      } else if (activeSection === "documents") {
        setNewVersionForm({
          wefDate: new Date().toISOString().split("T")[0],
          aadhaar_upload: customerForm?.aadhaar_upload || "",
          pan_upload: customerForm?.pan_upload || "",
          gst_certificate_upload: customerForm?.gst_certificate_upload || "",
          msme_certificate_upload: customerForm?.msme_certificate_upload || "",
          fssai_certificate_upload: customerForm?.fssai_certificate_upload || "",
        })
      }
    }
    setIsAdding(!isAdding)
  }

  const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
  const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
  const PINCODE_REGEX = /^[1-9][0-9]{5}$/

  const handleSaveNewVersion = async () => {
    if (!customerId) return
    if (!newVersionForm.wefDate) {
      toast({ title: "Validation Error", description: "Applicable From Date (W.E.F.) is required", variant: "destructive" })
      return
    }

    if (activeSection === "gst") {
      const gstinVal = (newVersionForm.gstin || "").trim().toUpperCase()
      const panVal = (newVersionForm.pan || "").trim().toUpperCase()

      if (gstinVal) {
        if (gstinVal.length !== 15) {
          toast({
            title: "Invalid GSTIN Format",
            description: "GSTIN must be exactly 15 characters (e.g. 22ABCDE1234F1Z5)",
            variant: "destructive",
          })
          return
        }
        if (!GSTIN_REGEX.test(gstinVal)) {
          toast({
            title: "Invalid GSTIN Format",
            description: "GSTIN does not match standard 15-character format (e.g. 22ABCDE1234F1Z5)",
            variant: "destructive",
          })
          return
        }
      }

      if (panVal) {
        if (panVal.length !== 10 || !PAN_REGEX.test(panVal)) {
          toast({
            title: "Invalid PAN Format",
            description: "PAN must be exactly 10 characters (e.g. ABCDE1234F)",
            variant: "destructive",
          })
          return
        }
      }
    }

    if (activeSection === "basic") {
      const emailVal = (newVersionForm.email || "").trim()
      if (emailVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
        toast({
          title: "Invalid Email Address",
          description: "Please enter a valid email address (e.g. user@domain.com)",
          variant: "destructive",
        })
        return
      }
      const contactVal = (newVersionForm.contact || "").trim()
      if (contactVal && !/^[0-9]{10}$/.test(contactVal)) {
        toast({
          title: "Invalid Contact Number",
          description: "Contact Number must be exactly 10 digits",
          variant: "destructive",
        })
        return
      }
    }

    if (activeSection === "bank") {
      const bankAccounts = newVersionForm.bank_accounts || []
      const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/
      for (let i = 0; i < bankAccounts.length; i++) {
        const ifsc = (bankAccounts[i].ifsc_code || "").trim().toUpperCase()
        if (ifsc && !IFSC_REGEX.test(ifsc)) {
          toast({
            title: "Invalid IFSC Code",
            description: `Bank Account ${i + 1}: Expected 11 characters, e.g. SBIN0001234`,
            variant: "destructive",
          })
          return
        }
      }
    }

    if (activeSection === "mailing") {
      const pincodeVal = (newVersionForm.pincode || "").trim()
      if (pincodeVal && (pincodeVal.length !== 6 || !PINCODE_REGEX.test(pincodeVal))) {
        toast({
          title: "Invalid Pincode",
          description: "Pincode must be exactly 6 digits",
          variant: "destructive",
        })
        return
      }
    }

    try {
      setIsSaving(true)
      await customerApi.addSectionHistory(customerId, {
        section: activeSection,
        ...newVersionForm,
      })
      toast({
        title: "Version Added Successfully",
        description: `New ${activeSection.toUpperCase()} version logged with W.E.F. date ${newVersionForm.wefDate}`,
      })

      // If this save was editing an existing version (via "Edit") and its
      // W.E.F date was changed, the fields were just re-logged under the NEW
      // date above - delete the original rows at the OLD date so the version
      // "moves" instead of leaving a stale duplicate behind at the old date.
      if (editingVersion && editingVersion.wefDate !== newVersionForm.wefDate && editingVersion.ids.length > 0) {
        for (const oldId of editingVersion.ids) {
          await masterHistoryApi.deleteSectionHistory(activeSection, oldId)
        }
      }
      setEditingVersion(null)

      setIsAdding(false)
      setNewVersionForm({ wefDate: new Date().toISOString().split("T")[0] })
      await queryClient.invalidateQueries({ queryKey: ["customer-sectional-history", activeSection, customerId] })
      await queryClient.invalidateQueries({ queryKey: ["master-edit-history"] })
      await queryClient.invalidateQueries({ queryKey: ["master-customers"] })

      // Refetch latest customer data from server to keep main Customer Edit Form in sync
      const updatedCust = await customerApi.getById(customerId)
      if (updatedCust?.success && updatedCust.data) {
        if (typeof (window as any).setCustomerFormGlobal === 'function') {
          (window as any).setCustomerFormGlobal(updatedCust.data)
        }
      }
      refetch()
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

  return (
    <div ref={topRef} className="space-y-4 py-2 min-h-[480px] flex flex-col justify-between">
      {/* Standalone Top Back Button */}
      <div className="flex items-center justify-between pb-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-6 px-2 text-[11px] font-semibold bg-white border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 flex items-center gap-1 shadow-2xs rounded-md"
          onClick={onBack}
        >
          <ArrowLeft className="h-3 w-3 text-slate-500" />
          <span>Back to Form</span>
        </Button>
      </div>

      {/* Sub-view Section Title Header */}
      <div className="border-b pb-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-600" />
          {activeSection === "basic"
            ? "Customer Details History"
            : activeSection === "mailing"
              ? "Mailing Address History"
              : activeSection === "gst"
                ? "GST Registration History"
                : activeSection === "msme"
                  ? "MSME Registration History"
                  : activeSection === "fssai"
                    ? "FSSAI License History"
                    : activeSection === "godown"
                      ? "Belongs to Godown History"
                      : activeSection === "bank"
                        ? "Bank Details History"
                        : "Ledger Group History"}
        </h2>
        <p className="text-xs text-slate-500 font-medium mt-0.5">
          Customer: <span className="font-bold text-slate-800">{customerName || `#${customerId}`}</span>
        </p>
      </div>

      {/* Navigation Tabs (Strict Form Order Sequence) */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setActiveSection("basic")
            setIsAdding(false)
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeSection === "basic"
            ? "bg-slate-900 text-white shadow-xs"
            : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
            }`}
        >
          <User className="h-3.5 w-3.5" />
          Customer History
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveSection("mailing")
            setIsAdding(false)
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeSection === "mailing"
            ? "bg-blue-600 text-white shadow-xs"
            : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
            }`}
        >
          <Mail className="h-3.5 w-3.5" />
          Mailing History
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveSection("gst")
            setIsAdding(false)
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeSection === "gst"
            ? "bg-emerald-600 text-white shadow-xs"
            : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
            }`}
        >
          <FileText className="h-3.5 w-3.5" />
          GST History
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveSection("msme")
            setIsAdding(false)
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeSection === "msme"
            ? "bg-amber-600 text-white shadow-xs"
            : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
            }`}
        >
          <Award className="h-3.5 w-3.5" />
          MSME History
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveSection("fssai")
            setIsAdding(false)
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeSection === "fssai"
            ? "bg-purple-600 text-white shadow-xs"
            : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
            }`}
        >
          <ShieldAlert className="h-3.5 w-3.5" />
          FSSAI History
        </button>


        <button
          type="button"
          onClick={() => {
            setActiveSection("godown")
            setIsAdding(false)
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeSection === "godown"
            ? "bg-indigo-600 text-white shadow-xs"
            : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
            }`}
        >
          <Warehouse className="h-3.5 w-3.5" />
          Godowns History
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveSection("bank")
            setIsAdding(false)
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeSection === "bank"
            ? "bg-cyan-600 text-white shadow-xs"
            : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
            }`}
        >
          <Landmark className="h-3.5 w-3.5" />
          Bank Details History
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveSection("ledger")
            setIsAdding(false)
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeSection === "ledger"
            ? "bg-teal-600 text-white shadow-xs"
            : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
            }`}
        >
          <Layers className="h-3.5 w-3.5" />
          Ledger Group History
        </button>
      </div>

      {/* Section Action Bar */}
      <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200">
        <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
          {activeSection === "basic" && <User className="h-3.5 w-3.5 text-slate-900" />}
          {activeSection === "mailing" && <Mail className="h-3.5 w-3.5 text-blue-600" />}
          {activeSection === "gst" && <FileText className="h-3.5 w-3.5 text-emerald-600" />}
          {activeSection === "msme" && <Award className="h-3.5 w-3.5 text-amber-600" />}
          {activeSection === "fssai" && <ShieldAlert className="h-3.5 w-3.5 text-purple-600" />}
          {activeSection === "godown" && <Warehouse className="h-3.5 w-3.5 text-indigo-600" />}
          {activeSection === "bank" && <Landmark className="h-3.5 w-3.5 text-cyan-600" />}
          {activeSection === "ledger" && <Layers className="h-3.5 w-3.5 text-teal-600" />}
          {activeSection === "basic"
            ? "Customer Details History Table"
            : activeSection === "mailing"
              ? "Mailing History Table"
              : activeSection === "gst"
                ? "GST History Table"
                : activeSection === "msme"
                  ? "MSME History Table"
                  : activeSection === "fssai"
                    ? "FSSAI History Table"
                    : activeSection === "godown"
                      ? "Godowns History Table"
                      : activeSection === "bank"
                        ? "Bank Details History Table"
                        : "Ledger Group History Table"}
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] bg-white text-slate-700 border-slate-300">
            {items.length} {items.length === 1 ? "Version" : "Versions"}
          </Badge>
          <Button
            type="button"
            size="sm"
            className={`h-7 px-2.5 text-xs font-semibold shadow-xs flex items-center gap-1 border-none ${isAdding
              ? "bg-slate-600 hover:bg-slate-700 text-white"
              : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }`}
            onClick={handleToggleAdd}
          >
            {isAdding ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {isAdding ? "Cancel Form" : "Add Effective Date Version"}
          </Button>
        </div>
      </div>

      {/* Add New Version Form Panel */}
      {isAdding && (
        <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-300 shadow-xs space-y-3 animate-in fade-in-50">
          <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
            <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-emerald-600" />
              Log New {activeSection === "basic" ? "CUSTOMER DETAILS" : activeSection.toUpperCase()} Version (Applicable From Date)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-slate-700">Applicable From (W.E.F Date) *</Label>
              <Input
                ref={wefDateInputRef}
                type="date"
                autoFocus
                className={`h-8 text-xs font-semibold border-emerald-300 focus-visible:ring-emerald-400 bg-white ${!newVersionForm.wefDate ? 'text-slate-500' : ''}`}
                value={newVersionForm.wefDate || ""}
                onChange={(e) => setNewVersionForm({ ...newVersionForm, wefDate: e.target.value })}
              />
            </div>

            {activeSection === "basic" && (
              <>
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">Customer Name</Label>
                  <Input
                    data-field-name="Customer Name"
                    className="h-8 text-xs bg-white"
                    placeholder="Customer Name"
                    value={newVersionForm.customer_name || ""}
                    onChange={(e) => setNewVersionForm({ ...newVersionForm, customer_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">Email</Label>
                  <Input
                    data-field-name="Email"
                    type="email"
                    className="h-8 text-xs bg-white"
                    placeholder="email@example.com"
                    value={newVersionForm.email || ""}
                    onChange={(e) => setNewVersionForm({ ...newVersionForm, email: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">Contact Person</Label>
                  <Input
                    data-field-name="Contact Person"
                    className="h-8 text-xs bg-white"
                    placeholder="Contact Person"
                    value={newVersionForm.contact_person || ""}
                    onChange={(e) => setNewVersionForm({ ...newVersionForm, contact_person: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">Contact Number</Label>
                  <Input
                    data-field-name="Contact Number"
                    className="h-8 text-xs bg-white"
                    placeholder="10-digit Mobile Number"
                    maxLength={10}
                    value={newVersionForm.contact || ""}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 10)
                      setNewVersionForm({ ...newVersionForm, contact: val })
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">Status</Label>
                  <Select
                    value={newVersionForm.status || "Active"}
                    onValueChange={(val: string) => setNewVersionForm({ ...newVersionForm, status: val })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">Aadhaar Card</Label>
                  <FileUploadField
                    accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
                    value={newVersionForm.aadhaar_upload || ""}
                    helperText="Max file size: 20 MB"
                    uploading={false}
                    triggerClassName="h-8 bg-white text-xs"
                    onFilesSelected={async (files) => {
                      if (files[0]) {
                        try {
                          const res = await orderApi.uploadFile(files[0])
                          if (res.success && res.data?.url) {
                            setNewVersionForm(prev => ({ ...prev, aadhaar_upload: res.data.url }))
                            toast({ title: "Success", description: "Aadhaar Card uploaded successfully" })
                          }
                        } catch (err: any) {
                          toast({ title: "Upload Failed", description: err.message || "Failed to upload file", variant: "destructive" })
                        }
                      }
                    }}
                    onRemove={() => setNewVersionForm(prev => ({ ...prev, aadhaar_upload: "" }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">PAN Card</Label>
                  <FileUploadField
                    accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
                    value={newVersionForm.pan_upload || ""}
                    helperText="Max file size: 20 MB"
                    uploading={false}
                    triggerClassName="h-8 bg-white text-xs"
                    onFilesSelected={async (files) => {
                      if (files[0]) {
                        try {
                          const res = await orderApi.uploadFile(files[0])
                          if (res.success && res.data?.url) {
                            setNewVersionForm(prev => ({ ...prev, pan_upload: res.data.url }))
                            toast({ title: "Success", description: "PAN Card uploaded successfully" })
                          }
                        } catch (err: any) {
                          toast({ title: "Upload Failed", description: err.message || "Failed to upload file", variant: "destructive" })
                        }
                      }
                    }}
                    onRemove={() => setNewVersionForm(prev => ({ ...prev, pan_upload: "" }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">GST Certificate</Label>
                  <FileUploadField
                    accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
                    value={newVersionForm.gst_certificate_upload || ""}
                    helperText="Max file size: 20 MB"
                    uploading={false}
                    triggerClassName="h-8 bg-white text-xs"
                    onFilesSelected={async (files) => {
                      if (files[0]) {
                        try {
                          const res = await orderApi.uploadFile(files[0])
                          if (res.success && res.data?.url) {
                            setNewVersionForm(prev => ({ ...prev, gst_certificate_upload: res.data.url }))
                            toast({ title: "Success", description: "GST Certificate uploaded successfully" })
                          }
                        } catch (err: any) {
                          toast({ title: "Upload Failed", description: err.message || "Failed to upload file", variant: "destructive" })
                        }
                      }
                    }}
                    onRemove={() => setNewVersionForm(prev => ({ ...prev, gst_certificate_upload: "" }))}
                  />
                </div>
              </>
            )}

            {activeSection === "mailing" && (
              <>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-[11px] font-semibold text-slate-700">Address Line 1</Label>
                  <Input
                    data-field-name="Address Line 1"
                    className="h-8 text-xs bg-white"
                    placeholder="Street / Office Address"
                    value={newVersionForm.address_line_1 || ""}
                    onChange={(e) => setNewVersionForm({ ...newVersionForm, address_line_1: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">Pincode</Label>
                  <Input
                    data-field-name="Pincode"
                    className="h-8 text-xs font-mono bg-white"
                    placeholder="6-digit PIN"
                    maxLength={6}
                    value={newVersionForm.pincode || ""}
                    onChange={(e) => setNewVersionForm({ ...newVersionForm, pincode: e.target.value })}
                  />
                </div>
              </>
            )}

            {activeSection === "gst" && (
              <>
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">GSTIN / UIN *</Label>
                  <Input
                    data-field-name="GSTIN"
                    className="h-8 text-xs font-mono uppercase bg-white"
                    placeholder="Enter GSTIN / UIN"
                    maxLength={15}
                    value={newVersionForm.gstin || ""}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase()
                      const autoPan = val.length === 15 ? val.slice(2, 12) : (newVersionForm.pan || "")
                      setNewVersionForm({ ...newVersionForm, gstin: val, pan: autoPan })
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">PAN Number</Label>
                  <Input
                    data-field-name="PAN"
                    className="h-8 text-xs font-mono uppercase bg-white"
                    placeholder="ABCDE1234F"
                    maxLength={10}
                    value={newVersionForm.pan || ""}
                    onChange={(e) => setNewVersionForm({ ...newVersionForm, pan: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">GST Registration Status</Label>
                  <Select
                    value={newVersionForm.is_gst_registered || "Registered"}
                    onValueChange={(val) => setNewVersionForm({ ...newVersionForm, is_gst_registered: val })}
                  >
                    <SelectTrigger className="h-8 bg-white text-xs">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Registered">Registered</SelectItem>
                      <SelectItem value="Unregistered">Unregistered</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">Registration Type</Label>
                  <Input
                    data-field-name="GST Registration Type"
                    className="h-8 text-xs bg-white"
                    placeholder="Regular / Composition"
                    value={newVersionForm.gst_registration_type || ""}
                    onChange={(e) => setNewVersionForm({ ...newVersionForm, gst_registration_type: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">Status</Label>
                  <Select
                    value={newVersionForm.gst_status || "Active"}
                    onValueChange={(val) => setNewVersionForm({ ...newVersionForm, gst_status: val })}
                  >
                    <SelectTrigger className="h-8 bg-white text-xs">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {activeSection === "msme" && (
              <>
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">MSME Registration No</Label>
                  <Input
                    data-field-name="MSME Registration No"
                    className="h-8 text-xs font-mono bg-white"
                    placeholder="UDYAM-XX-00-0000000"
                    value={newVersionForm.msme_registration_no || ""}
                    onChange={(e) => setNewVersionForm({ ...newVersionForm, msme_registration_no: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">MSME Registration Type</Label>
                  <Combobox
                    options={activeMsmeRegTypes.map((r: any) => ({ value: r.name, label: r.name }))}
                    value={newVersionForm.msme_registration_type || ""}
                    onValueChange={(val) => setNewVersionForm({ ...newVersionForm, msme_registration_type: val })}
                    placeholder="Select type"
                    searchPlaceholder="Search..."
                    className="h-8 bg-white text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">Activity Type</Label>
                  <Select
                    value={newVersionForm.msme_activity_type || ""}
                    onValueChange={(val) => setNewVersionForm({ ...newVersionForm, msme_activity_type: val })}
                  >
                    <SelectTrigger className="h-8 bg-white text-xs">
                      <SelectValue placeholder="Select activity type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Unknown">Unknown</SelectItem>
                      <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                      <SelectItem value="Services">Services</SelectItem>
                      <SelectItem value="Trades">Trades</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">MSME Status</Label>
                  <Select
                    value={newVersionForm.msme_status || "Active"}
                    onValueChange={(val) => setNewVersionForm({ ...newVersionForm, msme_status: val })}
                  >
                    <SelectTrigger className="h-8 bg-white text-xs">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">MSME Certificate</Label>
                  <FileUploadField
                    accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
                    value={newVersionForm.msme_certificate_upload || ""}
                    helperText="Max file size: 20 MB"
                    uploading={false}
                    triggerClassName="h-8 bg-white text-xs"
                    onFilesSelected={async (files) => {
                      if (files[0]) {
                        try {
                          const res = await orderApi.uploadFile(files[0])
                          if (res.success && res.data?.url) {
                            setNewVersionForm(prev => ({ ...prev, msme_certificate_upload: res.data.url }))
                            toast({ title: "Success", description: "MSME Certificate uploaded successfully" })
                          }
                        } catch (err: any) {
                          toast({ title: "Upload Failed", description: err.message || "Failed to upload file", variant: "destructive" })
                        }
                      }
                    }}
                    onRemove={() => setNewVersionForm(prev => ({ ...prev, msme_certificate_upload: "" }))}
                  />
                </div>
              </>
            )}

            {activeSection === "fssai" && (
              <>
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">FSSAI Licence No</Label>
                  <Input
                    data-field-name="FSSAI No"
                    className="h-8 text-xs font-mono bg-white"
                    placeholder="14-digit FSSAI No"
                    value={newVersionForm.fssai_no || ""}
                    onChange={(e) => setNewVersionForm({ ...newVersionForm, fssai_no: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">FSSAI Licence Type</Label>
                  <Combobox
                    options={[...activeFssaiLicenceTypes]
                      .sort((a: any, b: any) => {
                        const order = ["Registration", "State Licence", "National Licence"]
                        const aIdx = order.indexOf(a.name)
                        const bIdx = order.indexOf(b.name)
                        return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx)
                      })
                      .map((r: any) => ({ value: r.name, label: r.name }))}
                    value={newVersionForm.fssai_licence_type || ""}
                    onValueChange={(val) => setNewVersionForm({ ...newVersionForm, fssai_licence_type: val })}
                    placeholder="Select licence type"
                    searchPlaceholder="Search..."
                    className="h-8 bg-white text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">Valid Upto Date</Label>
                  <Input
                    data-field-name="FSSAI Valid Upto"
                    type="date"
                    className={`h-8 text-xs bg-white ${!newVersionForm.fssai_valid_upto ? 'text-slate-500' : ''}`}
                    value={newVersionForm.fssai_valid_upto || ""}
                    onChange={(e) => setNewVersionForm({ ...newVersionForm, fssai_valid_upto: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">FSSAI Certificate</Label>
                  <FileUploadField
                    accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
                    value={newVersionForm.fssai_certificate_upload || ""}
                    helperText="Max file size: 20 MB"
                    uploading={false}
                    triggerClassName="h-8 bg-white text-xs"
                    onFilesSelected={async (files) => {
                      if (files[0]) {
                        try {
                          const res = await orderApi.uploadFile(files[0])
                          if (res.success && res.data?.url) {
                            setNewVersionForm(prev => ({ ...prev, fssai_certificate_upload: res.data.url }))
                            toast({ title: "Success", description: "FSSAI Certificate uploaded successfully" })
                          }
                        } catch (err: any) {
                          toast({ title: "Upload Failed", description: err.message || "Failed to upload file", variant: "destructive" })
                        }
                      }
                    }}
                    onRemove={() => setNewVersionForm(prev => ({ ...prev, fssai_certificate_upload: "" }))}
                  />
                </div>
              </>
            )}

            {activeSection === "godown" && (
              <>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-[11px] font-semibold text-slate-700">Belongs to Which Godown *</Label>
                  <Select 
                    value={
                      (newVersionForm.godown_ids !== undefined ? newVersionForm.godown_ids?.[0]?.toString() : customerForm?.godown_ids?.[0]?.toString()) 
                      || godownDepots?.find((d: any) => d.depot_name?.toLowerCase() === 'banari')?.id?.toString() 
                      || ""
                    }
                    onValueChange={(val) => {
                      const nextIds = val ? [parseInt(val, 10)] : []
                      const selectedNames = godownDepots?.find((dep: any) => String(dep.id) === val)?.depot_name
                      setNewVersionForm({
                        ...newVersionForm,
                        godown_ids: nextIds,
                        newValue: selectedNames || "None",
                      })
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs w-full"><SelectValue placeholder="Select godown" /></SelectTrigger>
                    <SelectContent>
                      {[...(godownDepots || [])].sort((a: any, b: any) => (a.depot_name || "").localeCompare(b.depot_name || "")).map((d: any) => (
                        <SelectItem key={d.id} value={d.id.toString()}>{d.depot_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

              </>
            )}

            {activeSection === "bank" && (
              <div className="space-y-3 sm:col-span-3 border-t border-emerald-200 pt-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-800">Bank Accounts Details</Label>
                </div>

                {(newVersionForm.bank_accounts || []).map((bank: any, idx: number) => (
                  <div key={idx} className="rounded-lg border border-emerald-200 p-3 space-y-3 bg-emerald-50/50 shadow-2xs">
                    <div className="flex items-center justify-between border-b pb-1.5">
                      <span className="text-xs font-bold text-slate-700">
                        {idx === 0 ? "Primary Bank Account" : `Additional Bank Account ${idx}`}
                      </span>
                      {idx > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            const next = (newVersionForm.bank_accounts || []).filter((_: any, i: number) => i !== idx)
                            setNewVersionForm({ ...newVersionForm, bank_accounts: next })
                          }}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-600">Bank Name</Label>
                        <Combobox
                          options={activeBankNames.map((b: any) => ({ value: String(b.id), label: b.name }))}
                          value={bank.bank_name_id ? String(bank.bank_name_id) : ""}
                          onValueChange={(val) => {
                            const next = (newVersionForm.bank_accounts || []).map((b: any, i: number) =>
                              i === idx ? { ...b, bank_name_id: val ? parseInt(val, 10) : null } : b
                            )
                            setNewVersionForm({ ...newVersionForm, bank_accounts: next })
                          }}
                          placeholder="Select Bank"
                          searchPlaceholder="Search bank..."
                          className="h-8 bg-white text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-600">Account Holder Name</Label>
                        <Input
                          className="h-8 text-xs bg-white"
                          placeholder="Account Holder Name"
                          value={bank.account_holder_name || ""}
                          onChange={(e) => {
                            const next = (newVersionForm.bank_accounts || []).map((b: any, i: number) =>
                              i === idx ? { ...b, account_holder_name: e.target.value } : b
                            )
                            setNewVersionForm({ ...newVersionForm, bank_accounts: next })
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-600">Account Number</Label>
                        <Input
                          className="h-8 text-xs font-mono bg-white"
                          placeholder="Account Number"
                          value={bank.account_number || ""}
                          onChange={(e) => {
                            const next = (newVersionForm.bank_accounts || []).map((b: any, i: number) =>
                              i === idx ? { ...b, account_number: e.target.value } : b
                            )
                            setNewVersionForm({ ...newVersionForm, bank_accounts: next })
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-600">IFSC Code</Label>
                        <Input
                          className="h-8 text-xs font-mono uppercase bg-white"
                          placeholder="SBIN0001234"
                          maxLength={11}
                          value={bank.ifsc_code || ""}
                          onChange={(e) => {
                            const next = (newVersionForm.bank_accounts || []).map((b: any, i: number) =>
                              i === idx ? { ...b, ifsc_code: e.target.value.toUpperCase() } : b
                            )
                            setNewVersionForm({ ...newVersionForm, bank_accounts: next })
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-600">Status</Label>
                        <Select
                          value={bank.status || "Active"}
                          onValueChange={(val: "Active" | "Inactive") => {
                            const next = (newVersionForm.bank_accounts || []).map((b: any, i: number) =>
                              i === idx ? { ...b, status: val } : b
                            )
                            setNewVersionForm({ ...newVersionForm, bank_accounts: next })
                          }}
                        >
                          <SelectTrigger className="h-8 bg-white border-slate-200">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Active">Active</SelectItem>
                            <SelectItem value="Inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeSection === "ledger" && (
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-[11px] font-semibold text-slate-700">Ledger Group</Label>
                <Combobox
                  options={ledgerGroupOptions.map((g: any) => ({ value: String(g.id), label: g.group_name }))}
                  value={newVersionForm.ledger_group_id ? String(newVersionForm.ledger_group_id) : (newVersionForm.newValue || "")}
                  onValueChange={(val) => {
                    const sel = ledgerGroupOptions.find((g: any) => String(g.id) === val)
                    setNewVersionForm({ ...newVersionForm, ledger_group_id: val, newValue: sel?.group_name || val })
                  }}
                  placeholder="Select ledger group"
                  searchPlaceholder="Search ledger group..."
                  className="h-8 bg-white text-xs"
                />
              </div>
            )}


          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-emerald-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs bg-white"
              onClick={() => { setIsAdding(false); setEditingVersion(null) }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1"
              disabled={isSaving}
              onClick={handleSaveNewVersion}
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save Applicable Version
            </Button>
          </div>
        </div>
      )}

      {/* History Table */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[280px] text-xs text-slate-400 gap-2 bg-white rounded-lg border border-slate-200">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          <span>Loading {activeSection.toUpperCase()} versions...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400 bg-white min-h-[280px] flex items-center justify-center">
          <div>
            No effective-dated {activeSection.toUpperCase()} versions recorded yet. Click{" "}
            <strong className="text-emerald-700">Add Effective Date Version</strong> above to create one.
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 overflow-x-auto shadow-2xs bg-white min-h-[280px]">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/90 text-slate-800 font-semibold border-b border-slate-300 text-xs text-center">
                <th className="py-2.5 px-3 whitespace-nowrap bg-amber-50/80 text-slate-900 border-r border-slate-300 w-32 font-bold">
                  Applicable From (W.E.F)
                </th>

                {activeSection === "basic" && (
                  <>
                    <th className="py-2.5 px-3 border-r border-slate-300">Customer Name</th>
                    <th className="py-2.5 px-3 border-r border-slate-300">Email</th>
                    <th className="py-2.5 px-3 border-r border-slate-300">Contact Person</th>
                    <th className="py-2.5 px-3 border-r border-slate-300 font-mono">Contact Number</th>
                    <th className="py-2.5 px-3 border-r border-slate-300">Status</th>
                  </>
                )}

                {activeSection === "mailing" && (
                  <>
                    <th className="py-2.5 px-3 border-r border-slate-300">Address Line 1</th>
                    <th className="py-2.5 px-3 border-r border-slate-300">State</th>
                    <th className="py-2.5 px-3 border-r border-slate-300">Country</th>
                    <th className="py-2.5 px-3 border-r border-slate-300">Pincode</th>
                  </>
                )}

                {activeSection === "gst" && (
                  <>
                    <th className="py-2.5 px-3 border-r border-slate-300">Registration Type</th>
                    <th className="py-2.5 px-3 border-r border-slate-300 font-mono">GSTIN/UIN</th>
                    <th className="py-2.5 px-3 border-r border-slate-300 font-mono">PAN No</th>
                    <th className="py-2.5 px-3 border-r border-slate-300">GST Registration Status</th>
                    <th className="py-2.5 px-3 border-r border-slate-300">Status</th>
                    <th className="py-2.5 px-3 border-r border-slate-300">Place of Supply</th>
                    <th className="py-2.5 px-3 border-r border-slate-300">Aadhaar Card</th>
                    <th className="py-2.5 px-3 border-r border-slate-300">PAN Card</th>
                    <th className="py-2.5 px-3 border-r border-slate-300">GST Certificate</th>
                  </>
                )}

                {activeSection === "msme" && (
                  <>
                    <th className="py-2.5 px-3 border-r border-slate-300">MSME Reg No</th>
                    <th className="py-2.5 px-3 border-r border-slate-300">MSME Registration Type</th>
                    <th className="py-2.5 px-3 border-r border-slate-300">Activity Type</th>
                    <th className="py-2.5 px-3 border-r border-slate-300">MSME Status</th>
                    <th className="py-2.5 px-3 border-r border-slate-300">MSME Certificate</th>
                  </>
                )}

                {activeSection === "fssai" && (
                  <>
                    <th className="py-2.5 px-3 border-r border-slate-300">FSSAI Licence No</th>
                    <th className="py-2.5 px-3 border-r border-slate-300">Licence Type</th>
                    <th className="py-2.5 px-3 border-r border-slate-300">Valid Upto</th>
                    <th className="py-2.5 px-3 border-r border-slate-300">FSSAI Certificate</th>
                  </>
                )}

                {activeSection === "godown" && (
                  <>
                    <th className="py-2.5 px-3 border-r border-slate-300">Belongs to Which Godown</th>
                  </>
                )}

                {activeSection === "bank" && (
                  <>
                    <th className="py-2.5 px-3 border-r border-slate-300">Bank Name</th>
                    <th className="py-2.5 px-3 border-r border-slate-300">Account Holder Name</th>
                    <th className="py-2.5 px-3 border-r border-slate-300 font-mono">Account Number</th>
                    <th className="py-2.5 px-3 border-r border-slate-300 font-mono">IFSC Code</th>
                  </>
                )}

                {activeSection === "ledger" && (
                  <>
                    <th className="py-2.5 px-3 border-r border-slate-300 text-left w-full">Ledger Group</th>
                  </>
                )}



                <th className="py-2.5 px-3 text-right whitespace-nowrap border-r border-slate-300">Updated By</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap min-w-[90px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.map((row: any, idx: number) => {
                const rowId = row.id || idx
                const wefStr = row.wefDate || row.wef_date || row.createdAt
                const todayStr = new Date().toISOString().split("T")[0]
                const itemDateStr = new Date(wefStr).toISOString().split("T")[0]
                const isFuture = itemDateStr > todayStr
                const isActive = row.id ? row.id === activeRecordId : idx === 0

                const formattedWef = wefStr
                  ? new Date(wefStr)
                    .toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                    .replace(/ /g, "-")
                  : "—"

                const renderFileLink = (url: string | null) => {
                  if (!url || url === "—") return <span className="text-slate-400">—</span>
                  return (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-800 underline text-[11px]"
                    >
                      <span>View File</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )
                }

                const handleDeleteRow = async () => {
                  if (!confirm("Are you sure you want to delete this history version?")) return
                  try {
                    const idsToDelete = (row.allIds && row.allIds.length > 0)
                      ? row.allIds
                      : (row.id && !String(row.id).startsWith("baseline") ? [row.id] : [])

                    if (idsToDelete.length === 0) {
                      toast({
                        title: "Notice",
                        description: "Initial baseline versions cannot be deleted directly.",
                        variant: "default",
                      })
                      return
                    }

                    for (const singleId of idsToDelete) {
                      await masterHistoryApi.deleteSectionHistory(activeSection, singleId)
                    }

                    toast({
                      title: "Success",
                      description: "History version deleted successfully.",
                    })

                    await queryClient.invalidateQueries({ queryKey: ["customer-sectional-history"] })
                    await queryClient.invalidateQueries({ queryKey: ["master-edit-history"] })
                    await queryClient.invalidateQueries({ queryKey: ["master-customers"] })

                    // Refetch latest customer data from server to keep parent Customer Edit Form in sync
                    if (customerId) {
                      const updatedCust = await customerApi.getById(customerId)
                      if (updatedCust?.success && updatedCust.data) {
                        if (typeof (window as any).setCustomerFormGlobal === 'function') {
                          (window as any).setCustomerFormGlobal(updatedCust.data)
                        }
                      }
                    }

                    await refetch()
                  } catch (err: any) {
                    toast({
                      title: "Error",
                      description: err?.message || "Failed to delete history record",
                      variant: "destructive",
                    })
                  }
                }

                const handleEditRow = () => {
                  let formState: Record<string, any> = { ...row, wefDate: itemDateStr }
                  if (activeSection === "bank") {
                    formState.bank_accounts = parseBankAccountsFromRow(row)
                  }
                  setNewVersionForm(formState)
                  setEditingVersion({ ids: row.allIds || [], wefDate: itemDateStr })
                  setIsAdding(true)
                  toast({
                    title: "Editing Version",
                    description: `Loaded version from ${formattedWef} into creation form. Make changes and click 'Save Effective Version'.`,
                  })
                }

                return (
                  <tr key={rowId} className={`hover:bg-amber-50/30 transition-colors text-xs text-slate-800 ${isActive ? "bg-emerald-50/20" : ""}`}>
                    <td className="py-2 px-3 font-bold text-slate-900 bg-amber-50/50 border-r border-slate-300 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                        <span>{formattedWef}</span>
                        
                        
                      </div>
                    </td>

                    {activeSection === "basic" && (() => {
                      let custName = row.customer_name || row.customerName || ""
                      let emailVal = row.email || ""
                      let contactPersonVal = row.contact_person || row.contactPerson || ""
                      let contactNumVal = row.contact || ""
                      let statusVal = row.status || "Active"

                      if (row.newValue && typeof row.newValue === 'string' && row.newValue.includes('Name:')) {
                        const parts = row.newValue.split(' | ')
                        parts.forEach((p: string) => {
                          if (p.startsWith('Name: ')) custName = p.replace('Name: ', '')
                          else if (p.startsWith('Email: ')) emailVal = p.replace('Email: ', '')
                          else if (p.startsWith('Contact Person: ')) contactPersonVal = p.replace('Contact Person: ', '')
                          else if (p.startsWith('Contact: ')) contactNumVal = p.replace('Contact: ', '')
                          else if (p.startsWith('Status: ')) statusVal = p.replace('Status: ', '')
                        })
                      } else if (!custName && row.newValue && typeof row.newValue === 'string' && row.newValue !== 'Updated Customer Details') {
                        custName = row.newValue
                      }

                      return (
                        <>
                          <td className="py-2 px-3 border-r border-slate-200 font-semibold text-slate-900">
                            {custName || customerName || "—"}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 text-slate-600 font-mono">
                            {emailVal || "—"}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 text-slate-700">
                            {contactPersonVal || "—"}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 font-mono font-medium text-emerald-800">
                            {contactNumVal || "—"}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200">
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-2 py-0.5 font-bold ${statusVal === "Inactive"
                                ? "bg-red-50 text-red-700 border-red-200"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                }`}
                            >
                              {statusVal}
                            </Badge>
                          </td>
                        </>
                      )
                    })()}

                    {activeSection === "mailing" && (
                      <>
                        <td className="py-2 px-3 border-r border-slate-200 font-medium text-slate-900">
                          {row.addressLine1 || row.address_line_1 || "—"}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 text-slate-700">
                          {row.stateName || row.state_name || "—"}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 text-slate-600">India</td>
                        <td className="py-2 px-3 border-r border-slate-200 text-slate-600 font-mono">
                          {row.pincode || "—"}
                        </td>
                      </>
                    )}

                    {activeSection === "gst" && (
                      <>
                        <td className="py-2 px-3 border-r border-slate-200 text-slate-700">
                          {row.gstRegistrationType || "—"}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 font-mono font-semibold text-slate-900">
                          {row.gstin || "—"}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 font-mono text-slate-600">
                          {row.pan || (row.gstin && row.gstin.length === 15 ? row.gstin.slice(2, 12) : "—")}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200">
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
                            {row.isGstRegistered || "Registered"}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200">
                          <Badge variant="outline" className={`text-[10px] px-2 py-0.5 font-bold ${
                            (row.gstStatus || row.gst_status || "Active") === "Inactive" ? "bg-red-50 text-red-700 border-red-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }`}>
                            {row.gstStatus || row.gst_status || "Active"}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 text-slate-600">
                          {row.gstin ? row.gstin.slice(0, 2) : "—"}
                        </td>
                      </>
                    )}

                    {activeSection === "msme" && (
                      <>
                        <td className="py-2 px-3 border-r border-slate-200 font-mono font-semibold text-slate-900">
                          {row.msmeRegistrationNo || "—"}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 text-slate-700">
                          {row.msmeRegistrationType || "—"}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 text-slate-700">
                          {row.msmeActivityType || row.msme_activity_type || customerForm?.msme_activity_type || "—"}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200">
                          <Badge variant="outline" className={`text-[10px] px-2 py-0.5 font-bold ${
                            (row.msmeStatus || row.msme_status || "Active") === "Inactive" ? "bg-red-50 text-red-700 border-red-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }`}>
                            {row.msmeStatus || row.msme_status || "Active"}
                          </Badge>
                        </td>
                      </>
                    )}

                    {activeSection === "fssai" && (
                      <>
                        <td className="py-2 px-3 border-r border-slate-200 font-mono font-semibold text-slate-900">
                          {row.fssaiNo || "—"}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 text-slate-700">
                          {row.fssaiLicenceType || row.fssai_licence_type || customerForm?.fssai_licence_type || "—"}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 text-slate-600 font-mono">
                          {row.fssaiValidUpto ? new Date(row.fssaiValidUpto).toLocaleDateString("en-IN") : "—"}
                        </td>
                      </>
                    )}

                    {activeSection === "godown" && (
                      <>
                        <td className="py-2 px-3 border-r border-slate-200 font-medium text-emerald-800 bg-emerald-50/40">
                          {row.newValue || "—"}
                        </td>
                      </>
                    )}

                    {activeSection === "bank" && (() => {
                      let bankAccounts: any[] = []
                      if (Array.isArray(row.bank_accounts) && row.bank_accounts.length > 0) {
                        bankAccounts = row.bank_accounts
                      } else if (Array.isArray(row.bankAccounts) && row.bankAccounts.length > 0) {
                        bankAccounts = row.bankAccounts
                      } else if (row.newValue && typeof row.newValue === 'string') {
                        const itemsStr = row.newValue.split(/;|\n/)
                        bankAccounts = itemsStr.map((itemStr: string) => {
                          const trimStr = itemStr.trim()
                          if (!trimStr) return null
                          // If it's just a summary string like "1 bank account(s)" or "None"
                          if (trimStr.includes('bank account(s)') || trimStr === 'None' || trimStr === 'Updated Bank Accounts') {
                            return null
                          }
                          const ifscMatch = trimStr.match(/\(([^)]+)\)/)
                          const ifsc = ifscMatch ? ifscMatch[1].trim() : ""
                          const rest = trimStr.replace(/\([^)]+\)/, "").trim()
                          const parts = rest.split('-').map(s => s.trim())
                          if (parts.length >= 3) {
                            return { account_holder_name: parts[0], bank_name: parts[1], account_number: parts[2], ifsc_code: ifsc }
                          } else if (parts.length === 2) {
                            return { bank_name: parts[0], account_number: parts[1], ifsc_code: ifsc }
                          }
                          return { account_number: rest, ifsc_code: ifsc }
                        }).filter(Boolean)
                      }

                      // Fallback if parsed bank accounts list is empty: pull from customerForm or show dash
                      if (bankAccounts.length === 0) {
                        if (Array.isArray(customerForm?.bank_accounts) && customerForm.bank_accounts.length > 0) {
                          bankAccounts = customerForm.bank_accounts
                        } else {
                          bankAccounts = [{ bank_name: "—", account_holder_name: "—", account_number: "—", ifsc_code: "—" }]
                        }
                      }

                      return (
                        <>
                          <td className="py-2 px-3 border-r border-slate-200 font-semibold text-slate-900">
                            {bankAccounts.map((b: any, i: number) => (
                              <div key={i} className={`flex items-center gap-1.5 ${i > 0 ? "mt-1.5 pt-1.5 border-t border-slate-100" : ""}`}>
                                {bankAccounts.length > 1 && (
                                  <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-1 py-0.5 rounded border border-slate-200 shrink-0">
                                    Acc {i + 1}
                                  </span>
                                )}
                                <span>{b.bank_name || b.bankName || (b.bank_name_id ? (activeBankNames.find((x: any) => String(x.id) === String(b.bank_name_id))?.name || `Bank #${b.bank_name_id}`) : "—")}</span>
                              </div>
                            ))}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 text-slate-700 font-medium">
                            {bankAccounts.map((b: any, i: number) => (
                              <div key={i} className={`flex items-center gap-1.5 ${i > 0 ? "mt-1.5 pt-1.5 border-t border-slate-100" : ""}`}>
                                {bankAccounts.length > 1 && (
                                  <span className="text-[10px] text-slate-400 font-semibold shrink-0">#{i + 1}</span>
                                )}
                                <span>{b.account_holder_name || b.accountHolderName || "—"}</span>
                              </div>
                            ))}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 font-mono font-semibold text-cyan-900">
                            {bankAccounts.map((b: any, i: number) => (
                              <div key={i} className={`flex items-center gap-1.5 ${i > 0 ? "mt-1.5 pt-1.5 border-t border-slate-100" : ""}`}>
                                {bankAccounts.length > 1 && (
                                  <span className="text-[10px] text-slate-400 font-semibold shrink-0">#{i + 1}</span>
                                )}
                                <span>{b.account_number || b.accountNumber || "—"}</span>
                              </div>
                            ))}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 font-mono font-bold text-slate-800">
                            {bankAccounts.map((b: any, i: number) => (
                              <div key={i} className={`flex items-center gap-1.5 ${i > 0 ? "mt-1.5 pt-1.5 border-t border-slate-100" : ""}`}>
                                {bankAccounts.length > 1 && (
                                  <span className="text-[10px] text-slate-400 font-semibold shrink-0">#{i + 1}</span>
                                )}
                                <span>{b.ifsc_code || b.ifscCode || "—"}</span>
                              </div>
                            ))}
                          </td>
                        </>
                      )
                    })()}

                    {activeSection === "ledger" && (
                      <>
                        <td className="py-2 px-3 border-r border-slate-200 font-medium text-teal-800 bg-teal-50/40">
                          {row.newValue || "—"}
                        </td>
                      </>
                    )}



                    <td className="py-2 px-3 text-right text-slate-500 whitespace-nowrap border-r border-slate-200">
                      <div className="flex flex-col items-end gap-0.5 text-[11px]">
                        <div className="flex items-center justify-end gap-1 text-[11px]">
                        <User className="h-3 w-3 text-slate-400" />
                        <span>{row.changedByName || "Admin"}</span>
                      </div>
                        <span className="text-[9px] text-slate-400 mr-1">
                          {row.createdAt ? new Date(row.createdAt).toLocaleString("en-IN", {
                            day: 'numeric', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          }).replace(',', '') : "—"}
                        </span>
                      </div>
                    </td>

                    <td className="py-2 px-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-600 hover:text-blue-600 hover:bg-blue-50"
                          onClick={handleEditRow}
                          title="Edit this version"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-600 hover:text-rose-600 hover:bg-rose-50"
                          onClick={handleDeleteRow}
                          title="Delete this version"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
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
