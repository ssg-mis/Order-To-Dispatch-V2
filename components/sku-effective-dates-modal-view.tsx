"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Loader2,
  Package,
  Scale,
  Receipt,
  Warehouse,
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
import { Combobox } from "@/components/ui/combobox"
import { masterHistoryApi, skuDetailsApi, inventoryApi } from "@/lib/api-service"
import { useToast } from "@/hooks/use-toast"

type SkuSectionType = "basic" | "uom" | "weights" | "tax" | "depots"

interface SkuEffectiveDatesModalViewProps {
  skuId: number
  skuName: string
  skuForm?: Record<string, any>
  initialSection: SkuSectionType
  targetFieldName?: string
  unitOptions?: any[]
  semiFinishedGoodOptions?: any[]
  oilTagsList?: any[]
  activeStockCategories?: any[]
  activeGstRates?: any[]
  activeSacCodes?: any[]
  activeHsnCodes?: any[]
  activeUqcCodes?: any[]
  activeDepots?: any[]
  openingStockByDepot?: Record<string, string>
  onBack: () => void
  onSkuUpdated?: (data: any) => void
}

export function SkuEffectiveDatesModalView({
  skuId,
  skuName,
  skuForm = {},
  initialSection = "basic",
  targetFieldName,
  unitOptions = [],
  semiFinishedGoodOptions = [],
  oilTagsList = [],
  activeStockCategories = [],
  activeGstRates = [],
  activeSacCodes = [],
  activeHsnCodes = [],
  activeUqcCodes = [],
  activeDepots = [],
  openingStockByDepot = {},
  onBack,
  onSkuUpdated,
}: SkuEffectiveDatesModalViewProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const getTodayStr = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  }

  const [activeSection, setActiveSection] = useState<SkuSectionType>(initialSection)
  const [isAdding, setIsAdding] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  // Tracks the version currently loaded via "Edit" (its row ids + original
  // W.E.F date) so that saving under a CHANGED date can delete the original
  // rows instead of leaving a stale duplicate version behind at the old date.
  const [editingVersion, setEditingVersion] = useState<{ ids: number[]; wefDate: string } | null>(null)
  const wefDateInputRef = useRef<HTMLInputElement | null>(null)

  // Initialize form state from skuForm & openingStockByDepot
  const getInitialFormState = () => ({
    wefDate: getTodayStr(),

    // Basic
    sku_name: skuForm.sku_name || "",
    status: skuForm.status || "Active",
    tag_name: skuForm.tag_name || "",

    // UOM
    main_uom: skuForm.main_uom || "",
    alternate_uom: skuForm.alternate_uom || "",
    main_uom_id: skuForm.main_uom_id ? String(skuForm.main_uom_id) : "",
    alternate_uom_id: skuForm.alternate_uom_id ? String(skuForm.alternate_uom_id) : "",
    nos_per_main_uom: skuForm.nos_per_main_uom !== undefined && skuForm.nos_per_main_uom !== null ? String(skuForm.nos_per_main_uom) : "",
    units: skuForm.units || "",

    // Weights
    semi_finished_good_id: skuForm.semi_finished_good_id ? String(skuForm.semi_finished_good_id) : "",
    oil_tag_id: skuForm.oil_tag_id ? String(skuForm.oil_tag_id) : "",
    oil_filling_per_unit: skuForm.oil_filling_per_unit !== undefined && skuForm.oil_filling_per_unit !== null ? String(skuForm.oil_filling_per_unit) : "",
    filling_units: skuForm.filling_units || "Ltr",
    converted_kg: skuForm.converted_kg !== undefined && skuForm.converted_kg !== null ? String(skuForm.converted_kg) : "",
    packing_weight_per_main_unit: skuForm.packing_weight_per_main_unit !== undefined && skuForm.packing_weight_per_main_unit !== null ? String(skuForm.packing_weight_per_main_unit) : "",
    weight_difference: skuForm.weight_difference !== undefined && skuForm.weight_difference !== null ? String(skuForm.weight_difference) : "",
    sku_weight: skuForm.sku_weight !== undefined && skuForm.sku_weight !== null ? String(skuForm.sku_weight) : "",
    packing_weight: skuForm.packing_weight !== undefined && skuForm.packing_weight !== null ? String(skuForm.packing_weight) : "",
    gross_weight: skuForm.gross_weight !== undefined && skuForm.gross_weight !== null ? String(skuForm.gross_weight) : "",

    // Tax
    stock_category_id: skuForm.stock_category_id ? String(skuForm.stock_category_id) : "",
    type_of_supply: skuForm.type_of_supply || "",
    gst_rate_id: skuForm.gst_rate_id ? String(skuForm.gst_rate_id) : "",
    hsn_code_id: skuForm.hsn_code_id ? String(skuForm.hsn_code_id) : "",
    sac_code_id: skuForm.sac_code_id ? String(skuForm.sac_code_id) : "",
    uqc_id: skuForm.uqc_id ? String(skuForm.uqc_id) : "",

    // Depots
    depot_stocks: { ...openingStockByDepot },
  })

  const [newVersionForm, setNewVersionForm] = useState<Record<string, any>>(getInitialFormState())

  // Keep form fields synced whenever skuForm, openingStockByDepot, or activeSection updates
  useEffect(() => {
    setNewVersionForm(getInitialFormState())
  }, [skuForm, openingStockByDepot, activeSection])

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

  // Fetch history for SKU
  const { data: historyData, isLoading, refetch } = useQuery({
    queryKey: ["sku-history-modal", skuId],
    queryFn: async () => {
      if (!skuId) return []
      const res = await masterHistoryApi.getHistory("sku_details", skuId)
      if (res?.success && Array.isArray(res.data)) {
        return res.data.map((item: any) => ({
          ...item,
          wefDate: item.applicableFrom || item.wef_date || item.createdAt,
        }))
      }
      return []
    },
    enabled: !!skuId,
    staleTime: 0,
    refetchOnMount: "always",
  })

  const sectionFieldsMap: Record<SkuSectionType, string[]> = {
    basic: ["Finished Goods Name", "Sku Name", "Status", "Tag Name", "Tag for Reliance"],
    uom: ["Main UOM", "Main Uom", "Alternate UOM", "Alternate Uom", "Main UOM Reference", "Alternate UOM Reference", "Nos per Main UOM", "Nos Per Main Uom", "Units", "Main Uom Id", "Alternate Uom Id"],
    weights: ["Semi-Finished Good", "Semi Finished Good Id", "Oil Tag", "Oil Tag Id", "Oil Filling per Unit", "Oil Filling Per Unit", "Filling Units", "Converted Kg", "Packing Weight per Main Unit", "Weight Difference", "SKU Weight", "Sku Weight", "Packing Weight", "Gross Weight"],
    tax: ["Stock Category", "Stock Category Id", "Type of Supply", "Type Of Supply", "GST Rate", "Gst Rate Id", "HSN Code", "Hsn Code Id", "SAC Code", "Sac Code Id", "UQC", "Uqc Id"],
    depots: ["Depot", "Opening Stock", "Godown"],
  }

  const sectionTitles: Record<SkuSectionType, string> = {
    basic: "Finished Goods Details History Table",
    uom: "UOM & Units History Table",
    weights: "Weights & Filling History Table",
    tax: "Tax & Compliance History Table",
    depots: "Depot Stocks History Table",
  }

  // Every field shown in the "Log New Version" form gets its own dedicated
  // table column - mirrors Customer Master's per-field history columns exactly.
  // Depot columns are generated from the live depot list, one column per depot,
  // same as every other section gets one column per field - not a special case.
  const DEDICATED_COLUMNS: Record<SkuSectionType, string[]> = {
    basic: ["Finished Goods Name", "Status", "Tag for Reliance"],
    uom: ["Main UOM", "Alternate UOM", "Main UOM Reference", "Alternate UOM Reference", "Nos per Main UOM", "Units"],
    weights: ["Semi-Finished Good", "Oil Tag", "Oil Filling per Unit", "Filling Units", "Converted Kg", "Packing Weight per Main Unit", "Weight Difference", "SKU Weight", "Packing Weight", "Gross Weight"],
    tax: ["Stock Category", "Type of Supply", "GST Rate", "HSN Code", "SAC Code", "UQC"],
    depots: activeDepots.map((depot: any) => `Opening Stock - ${depot.depot_name}`),
  }

  // The column header shows just the depot name, not the full logged field name.
  const columnLabel = (fieldName: string): string => fieldName.replace(/^Opening Stock - /, "")

  // Effective value of a field as of this version's W.E.F date (carried forward
  // from earlier versions, same "snapshot" convention as Customer Master's table -
  // no strikethrough/arrow diffs, just the value that was in effect).
  const getSnapshotValue = (version: any, fieldName: string): string => {
    return version.snapshot?.[fieldName] ?? "—"
  }

  const rawItems = (historyData || []).filter((item: any) => {
    if (activeSection === "basic") return sectionFieldsMap.basic.some(f => f.toLowerCase() === (item.fieldName || "").toLowerCase()) || item.fieldName === "SKU Info"
    // Depot rows are logged per-depot as "Opening Stock - <Depot Name>", which
    // never exactly equals "Opening Stock" - match by prefix instead so they
    // actually show up here (they were always being saved, just filtered out).
    if (activeSection === "depots") return typeof item.fieldName === "string" && item.fieldName.startsWith("Opening Stock")
    const names = sectionFieldsMap[activeSection] || []
    return names.some(name => (item.fieldName || "").toLowerCase() === name.toLowerCase())
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

  // Options helpers
  const getUnitLabel = (id: any) => {
    if (!id) return "—"
    const found = unitOptions.find(u => String(u.id) === String(id))
    return found ? (found.unit_name || found.name || id) : id
  }

  const getSfgLabel = (id: any) => {
    if (!id) return "—"
    const found = semiFinishedGoodOptions.find(s => String(s.id) === String(id))
    return found ? (found.name || found.item_name || id) : id
  }

  const getOilTagLabel = (id: any) => {
    if (!id) return "—"
    const found = oilTagsList.find(o => String(o.id) === String(id))
    return found ? (found.name || found.tag_name || id) : id
  }

  const getStockCategoryLabel = (id: any) => {
    if (!id) return "—"
    const found = activeStockCategories.find(c => String(c.id) === String(id))
    return found ? (found.name || found.category_name || id) : id
  }

  const getGstRateLabel = (id: any) => {
    if (!id) return "—"
    const found = activeGstRates.find(g => String(g.id) === String(id))
    if (!found) return id
    return found.rate != null ? `${found.rate}%` : (found.rate_percentage != null ? `${found.rate_percentage}%` : (found.name || id))
  }

  const getHsnLabel = (id: any) => {
    if (!id) return "—"
    const found = activeHsnCodes.find(h => String(h.id) === String(id))
    if (!found) return id
    return found.code ? `${found.code} – ${found.description || found.name || ''}` : (found.hsn_code || id)
  }

  const getSacLabel = (id: any) => {
    if (!id) return "—"
    const found = activeSacCodes.find(s => String(s.id) === String(id))
    if (!found) return id
    return found.code ? `${found.code} – ${found.description || found.name || ''}` : (found.sac_code || id)
  }

  const getUqcLabel = (id: any) => {
    if (!id) return "—"
    const found = activeUqcCodes.find(u => String(u.id) === String(id))
    if (!found) return id
    return found.code ? `${found.code} – ${found.name || ''}` : (found.uqc_code || id)
  }

  // Helper for saving an effective date version
  const handleSaveNewVersion = async () => {
    if (!skuId) return
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

      if (activeSection === "basic") {
        logEntries.push({ fieldName: "Finished Goods Name", oldValue: skuForm.sku_name || "—", newValue: newVersionForm.sku_name || "—" })
        logEntries.push({ fieldName: "Status", oldValue: skuForm.status || "Active", newValue: newVersionForm.status || "—" })
        logEntries.push({ fieldName: "Tag for Reliance", oldValue: skuForm.tag_name || "—", newValue: newVersionForm.tag_name || "—" })
      } else if (activeSection === "uom") {
        logEntries.push({ fieldName: "Main UOM", oldValue: skuForm.main_uom || "—", newValue: newVersionForm.main_uom || "—" })
        logEntries.push({ fieldName: "Alternate UOM", oldValue: skuForm.alternate_uom || "—", newValue: newVersionForm.alternate_uom || "—" })
        logEntries.push({ fieldName: "Main UOM Reference", oldValue: getUnitLabel(skuForm.main_uom_id), newValue: getUnitLabel(newVersionForm.main_uom_id) })
        logEntries.push({ fieldName: "Alternate UOM Reference", oldValue: getUnitLabel(skuForm.alternate_uom_id), newValue: getUnitLabel(newVersionForm.alternate_uom_id) })
        logEntries.push({ fieldName: "Nos per Main UOM", oldValue: skuForm.nos_per_main_uom ?? "—", newValue: newVersionForm.nos_per_main_uom || "—" })
        logEntries.push({ fieldName: "Units", oldValue: skuForm.units || "—", newValue: newVersionForm.units || "—" })
      } else if (activeSection === "weights") {
        logEntries.push({ fieldName: "Semi-Finished Good", oldValue: getSfgLabel(skuForm.semi_finished_good_id), newValue: getSfgLabel(newVersionForm.semi_finished_good_id) })
        logEntries.push({ fieldName: "Oil Tag", oldValue: getOilTagLabel(skuForm.oil_tag_id), newValue: getOilTagLabel(newVersionForm.oil_tag_id) })
        logEntries.push({ fieldName: "Oil Filling per Unit", oldValue: skuForm.oil_filling_per_unit ?? "—", newValue: newVersionForm.oil_filling_per_unit || "—" })
        logEntries.push({ fieldName: "Filling Units", oldValue: skuForm.filling_units || "Ltr", newValue: newVersionForm.filling_units || "—" })
        logEntries.push({ fieldName: "Converted Kg", oldValue: skuForm.converted_kg ?? "—", newValue: newVersionForm.converted_kg || "—" })
        logEntries.push({ fieldName: "Packing Weight per Main Unit", oldValue: skuForm.packing_weight_per_main_unit ?? "—", newValue: newVersionForm.packing_weight_per_main_unit || "—" })
        logEntries.push({ fieldName: "Weight Difference", oldValue: skuForm.weight_difference ?? "—", newValue: newVersionForm.weight_difference || "—" })
        logEntries.push({ fieldName: "SKU Weight", oldValue: skuForm.sku_weight ?? "—", newValue: newVersionForm.sku_weight || "—" })
        logEntries.push({ fieldName: "Packing Weight", oldValue: skuForm.packing_weight ?? "—", newValue: newVersionForm.packing_weight || "—" })
        logEntries.push({ fieldName: "Gross Weight", oldValue: skuForm.gross_weight ?? "—", newValue: newVersionForm.gross_weight || "—" })
      } else if (activeSection === "tax") {
        logEntries.push({ fieldName: "Stock Category", oldValue: getStockCategoryLabel(skuForm.stock_category_id), newValue: getStockCategoryLabel(newVersionForm.stock_category_id) })
        logEntries.push({ fieldName: "Type of Supply", oldValue: skuForm.type_of_supply || "—", newValue: newVersionForm.type_of_supply || "—" })
        logEntries.push({ fieldName: "GST Rate", oldValue: getGstRateLabel(skuForm.gst_rate_id), newValue: getGstRateLabel(newVersionForm.gst_rate_id) })
        logEntries.push({ fieldName: "HSN Code", oldValue: getHsnLabel(skuForm.hsn_code_id), newValue: getHsnLabel(newVersionForm.hsn_code_id) })
        logEntries.push({ fieldName: "SAC Code", oldValue: getSacLabel(skuForm.sac_code_id), newValue: getSacLabel(newVersionForm.sac_code_id) })
        logEntries.push({ fieldName: "UQC", oldValue: getUqcLabel(skuForm.uqc_id), newValue: getUqcLabel(newVersionForm.uqc_id) })
      } else if (activeSection === "depots") {
        for (const depot of activeDepots) {
          const dKey = depot.depot_name || String(depot.id)
          const oldQty = openingStockByDepot[dKey] ?? openingStockByDepot[String(depot.id)] ?? "0"
          const newQty = (newVersionForm.depot_stocks && newVersionForm.depot_stocks[dKey]) ?? "0"
          logEntries.push({
            fieldName: `Opening Stock - ${depot.depot_name}`,
            oldValue: `${oldQty}`,
            newValue: `${newQty}`,
          })
        }
      }

      for (const entry of logEntries) {
        await masterHistoryApi.logHistory({
          masterType: "sku_details",
          recordId: skuId,
          fieldName: entry.fieldName,
          oldValue: String(entry.oldValue),
          newValue: String(entry.newValue),
          applicableFrom: newVersionForm.wefDate,
        })
      }

      // If this version is effective today or in the past, apply it to the live
      // record now (same rule Customer Master's backend uses) - otherwise saving
      // a version only ever logs history and the SKU record itself never updates.
      const todayStr = getTodayStr()
      if (newVersionForm.wefDate <= todayStr) {
        if (activeSection === "basic") {
          await skuDetailsApi.update(skuId, {
            sku_name: newVersionForm.sku_name,
            status: newVersionForm.status,
            tag_name: newVersionForm.tag_name,
          })
        } else if (activeSection === "uom") {
          await skuDetailsApi.update(skuId, {
            main_uom: newVersionForm.main_uom,
            alternate_uom: newVersionForm.alternate_uom,
            main_uom_id: newVersionForm.main_uom_id || null,
            alternate_uom_id: newVersionForm.alternate_uom_id || null,
            nos_per_main_uom: newVersionForm.nos_per_main_uom,
            units: newVersionForm.units,
          })
        } else if (activeSection === "weights") {
          await skuDetailsApi.update(skuId, {
            semi_finished_good_id: newVersionForm.semi_finished_good_id ? parseInt(newVersionForm.semi_finished_good_id, 10) : null,
            oil_tag_id: newVersionForm.oil_tag_id || null,
            oil_filling_per_unit: newVersionForm.oil_filling_per_unit,
            filling_units: newVersionForm.filling_units,
            converted_kg: newVersionForm.converted_kg,
            packing_weight_per_main_unit: newVersionForm.packing_weight_per_main_unit,
            weight_difference: newVersionForm.weight_difference,
            sku_weight: newVersionForm.sku_weight,
            packing_weight: newVersionForm.packing_weight,
            gross_weight: newVersionForm.gross_weight,
          })
        } else if (activeSection === "tax") {
          await skuDetailsApi.update(skuId, {
            stock_category_id: newVersionForm.stock_category_id || null,
            type_of_supply: newVersionForm.type_of_supply,
            gst_rate_id: newVersionForm.gst_rate_id || null,
            hsn_code_id: newVersionForm.hsn_code_id || null,
            sac_code_id: newVersionForm.sac_code_id || null,
            uqc_id: newVersionForm.uqc_id || null,
          })
        } else if (activeSection === "depots") {
          await Promise.allSettled(
            activeDepots.map((depot: any) => {
              const dKey = depot.depot_name || String(depot.id)
              const qty = (newVersionForm.depot_stocks && newVersionForm.depot_stocks[dKey]) ?? "0"
              return inventoryApi.upsertOpeningQty({
                depo_name: depot.depot_name,
                product_name: skuName,
                opening_qty: parseInt(qty, 10) || 0,
              })
            })
          )
        }

        const updated = await skuDetailsApi.getById(skuId)
        if (updated?.success && updated.data && onSkuUpdated) {
          onSkuUpdated(updated.data)
        }
        await queryClient.invalidateQueries({ queryKey: ["master-sku-details"] })
        await queryClient.invalidateQueries({ queryKey: ["inventory-data"] })
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
      await queryClient.invalidateQueries({ queryKey: ["sku-history-modal", skuId] })
      await queryClient.invalidateQueries({ queryKey: ["sku-sectional-history"] })
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
  // can be corrected and resaved. Snapshot values are stored as human-readable
  // labels (not raw IDs), so reference-linked Select fields (Semi-Finished Good,
  // Oil Tag, UOM/GST/HSN/SAC references, Stock Category) fall back to the SKU's
  // current live selection instead - free-text/number fields restore exactly.
  const EDIT_LABEL_TO_KEY: Record<string, string> = {
    "Finished Goods Name": "sku_name",
    "Status": "status",
    "Tag for Reliance": "tag_name",
    "Main UOM": "main_uom",
    "Alternate UOM": "alternate_uom",
    "Nos per Main UOM": "nos_per_main_uom",
    "Units": "units",
    "Oil Filling per Unit": "oil_filling_per_unit",
    "Filling Units": "filling_units",
    "Converted Kg": "converted_kg",
    "Packing Weight per Main Unit": "packing_weight_per_main_unit",
    "Weight Difference": "weight_difference",
    "SKU Weight": "sku_weight",
    "Packing Weight": "packing_weight",
    "Gross Weight": "gross_weight",
    "Type of Supply": "type_of_supply",
  }

  const handleEditVersion = (version: any) => {
    const base = getInitialFormState()
    const overrides: Record<string, any> = {}
    const snap = version.snapshot || {}

    Object.entries(EDIT_LABEL_TO_KEY).forEach(([label, key]) => {
      if (snap[label] !== undefined && snap[label] !== "—") overrides[key] = snap[label]
    })

    if (activeSection === "depots") {
      const depotStocks: Record<string, string> = { ...base.depot_stocks }
      Object.entries(snap).forEach(([k, v]) => {
        if (k.startsWith("Opening Stock - ")) depotStocks[k.replace("Opening Stock - ", "")] = String(v)
      })
      overrides.depot_stocks = depotStocks
    }

    setNewVersionForm({ ...base, ...overrides, wefDate: version.wefDate })
    setEditingVersion({ ids: version.ids || [], wefDate: version.wefDate })
    setIsAdding(true)
    toast({
      title: "Editing Version",
      description: `Loaded the ${version.wefDate} version into the form. Reference-linked fields default to the current selection - reselect if this version used a different one.`,
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
      await queryClient.invalidateQueries({ queryKey: ["sku-history-modal", skuId] })
      await queryClient.invalidateQueries({ queryKey: ["sku-sectional-history"] })
      await refetch()
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to delete version.", variant: "destructive" })
    }
  }

  return (
    <div className="space-y-4 text-slate-800">
      {/* Back Button */}
      <div className="flex items-center justify-between border-b pb-2.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onBack}
          className="h-8 px-2.5 text-xs font-semibold bg-white border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 flex items-center gap-1.5 shadow-2xs rounded-md"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Finished Goods Form
        </Button>
      </div>

      {/* Header */}
      <div className="border-b pb-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-600" />
          Finished Goods Effective-Dated Versions & History
        </h2>
        <p className="text-xs text-slate-500 font-medium mt-0.5">
          Finished Good: <span className="font-bold text-slate-800">{skuName || `#${skuId}`}</span>
        </p>
      </div>

      {/* Section Navigation Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => { setActiveSection("basic"); setIsAdding(false) }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeSection === "basic"
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
          }`}
        >
          <Package className="h-3.5 w-3.5" />
          Finished Goods History
        </button>

        <button
          type="button"
          onClick={() => { setActiveSection("uom"); setIsAdding(false) }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeSection === "uom"
              ? "bg-blue-600 text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
          }`}
        >
          UOM & Units History
        </button>

        <button
          type="button"
          onClick={() => { setActiveSection("weights"); setIsAdding(false) }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeSection === "weights"
              ? "bg-amber-600 text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
          }`}
        >
          <Scale className="h-3.5 w-3.5" />
          Weights & Filling History
        </button>

        <button
          type="button"
          onClick={() => { setActiveSection("tax"); setIsAdding(false) }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeSection === "tax"
              ? "bg-emerald-600 text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
          }`}
        >
          <Receipt className="h-3.5 w-3.5" />
          Tax & Compliance History
        </button>

        <button
          type="button"
          onClick={() => { setActiveSection("depots"); setIsAdding(false) }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeSection === "depots"
              ? "bg-indigo-600 text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
          }`}
        >
          <Warehouse className="h-3.5 w-3.5" />
          Depot Stocks History
        </button>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200">
        <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
          <Package className="h-3.5 w-3.5 text-blue-600" />
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

      {/* Add New Version Form Panel (100% Identical to Customer Master) */}
      {isAdding && (
        <div className="p-4 bg-gradient-to-br from-emerald-50 to-white rounded-2xl border border-emerald-200 shadow-sm space-y-4 animate-in fade-in-50">
          <div className="flex items-center gap-2 border-b border-emerald-200/80 pb-3">
            <span className="flex items-center justify-center h-6 w-6 rounded-full bg-emerald-100 shrink-0">
              <Calendar className="h-3.5 w-3.5 text-emerald-700" />
            </span>
            <span className="text-xs font-bold text-emerald-900 tracking-wide">
              Log New {activeSection === "basic" ? "FINISHED GOODS DETAILS" : activeSection.toUpperCase()} Version (Applicable From Date)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-4 text-xs items-start">
            {/* Applicable From (W.E.F Date) - Item #1 in Grid */}
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

            {/* Dynamic Section Fields in 3-column Grid - Pre-filled from current Master Form */}
            {activeSection === "basic" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Finished Goods Name</Label>
                  <Input
                    className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors"
                    placeholder="Finished Goods Name"
                    value={newVersionForm.sku_name || ""}
                    onChange={(e) => setNewVersionForm(prev => ({ ...prev, sku_name: e.target.value }))}
                  />
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
                  <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Tag for Reliance</Label>
                  <Select
                    value={newVersionForm.tag_name || "No"}
                    onValueChange={(val) => setNewVersionForm(prev => ({ ...prev, tag_name: val }))}
                  >
                    <SelectTrigger className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors">
                      <SelectValue placeholder="Select Tag" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {activeSection === "uom" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Main UOM</Label>
                  <Input
                    className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors"
                    placeholder="e.g. Box"
                    value={newVersionForm.main_uom || ""}
                    onChange={(e) => setNewVersionForm(prev => ({ ...prev, main_uom: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Alternate UOM</Label>
                  <Input
                    className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors"
                    placeholder="e.g. Pcs"
                    value={newVersionForm.alternate_uom || ""}
                    onChange={(e) => setNewVersionForm(prev => ({ ...prev, alternate_uom: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Main UOM (Reference)</Label>
                  <Select
                    value={newVersionForm.main_uom_id ? String(newVersionForm.main_uom_id) : ""}
                    onValueChange={(val) => setNewVersionForm(prev => ({ ...prev, main_uom_id: val }))}
                  >
                    <SelectTrigger className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors">
                      <SelectValue placeholder="Select Main UOM" />
                    </SelectTrigger>
                    <SelectContent>
                      {unitOptions.map((u: any) => (
                        <SelectItem key={u.id} value={String(u.id)}>
                          {u.unit_name || u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Alternate UOM (Reference)</Label>
                  <Select
                    value={newVersionForm.alternate_uom_id ? String(newVersionForm.alternate_uom_id) : ""}
                    onValueChange={(val) => setNewVersionForm(prev => ({ ...prev, alternate_uom_id: val }))}
                  >
                    <SelectTrigger className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors">
                      <SelectValue placeholder="Select Alternate UOM" />
                    </SelectTrigger>
                    <SelectContent>
                      {unitOptions.map((u: any) => (
                        <SelectItem key={u.id} value={String(u.id)}>
                          {u.unit_name || u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Nos per Main UOM</Label>
                  <Input
                    type="number"
                    className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors"
                    placeholder="Nos per Main UOM"
                    value={newVersionForm.nos_per_main_uom || ""}
                    onChange={(e) => setNewVersionForm(prev => ({ ...prev, nos_per_main_uom: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Units</Label>
                  <Input
                    className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors"
                    placeholder="e.g. Kg"
                    value={newVersionForm.units || ""}
                    onChange={(e) => setNewVersionForm(prev => ({ ...prev, units: e.target.value }))}
                  />
                </div>
              </>
            )}

            {activeSection === "weights" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Semi-Finished Good</Label>
                  <Combobox
                    options={semiFinishedGoodOptions.map((s: any) => ({ label: s.name || s.item_name, value: String(s.id) }))}
                    value={newVersionForm.semi_finished_good_id}
                    onValueChange={(val: string) => setNewVersionForm(prev => ({ ...prev, semi_finished_good_id: val }))}
                    placeholder="Select Semi-Finished Good"
                    className="h-9 text-xs bg-white font-normal rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Oil Tag</Label>
                  <Select
                    value={newVersionForm.oil_tag_id ? String(newVersionForm.oil_tag_id) : ""}
                    onValueChange={(val) => setNewVersionForm(prev => ({ ...prev, oil_tag_id: val }))}
                  >
                    <SelectTrigger className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors">
                      <SelectValue placeholder="Select Oil Tag" />
                    </SelectTrigger>
                    <SelectContent>
                      {oilTagsList.map((o: any) => (
                        <SelectItem key={o.id} value={String(o.id)}>
                          {o.name || o.tag_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Oil Filling per Unit</Label>
                  <Input
                    type="number"
                    step="any"
                    className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors"
                    placeholder="Filling per Unit"
                    value={newVersionForm.oil_filling_per_unit || ""}
                    onChange={(e) => setNewVersionForm(prev => ({ ...prev, oil_filling_per_unit: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Filling Units</Label>
                  <Select
                    value={newVersionForm.filling_units || "Ltr"}
                    onValueChange={(val) => setNewVersionForm(prev => ({ ...prev, filling_units: val }))}
                  >
                    <SelectTrigger className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors">
                      <SelectValue placeholder="Select Units" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ltr">Ltr</SelectItem>
                      <SelectItem value="Kg">Kg</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Converted Kg</Label>
                  <Input
                    type="number"
                    step="any"
                    className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors"
                    placeholder="Converted Kg"
                    value={newVersionForm.converted_kg || ""}
                    onChange={(e) => setNewVersionForm(prev => ({ ...prev, converted_kg: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Packing Weight/Main Unit</Label>
                  <Input
                    type="number"
                    step="any"
                    className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors"
                    placeholder="Packing Weight"
                    value={newVersionForm.packing_weight_per_main_unit || ""}
                    onChange={(e) => setNewVersionForm(prev => ({ ...prev, packing_weight_per_main_unit: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Weight Difference</Label>
                  <Input
                    type="number"
                    step="any"
                    className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors"
                    placeholder="Weight Difference"
                    value={newVersionForm.weight_difference || ""}
                    onChange={(e) => setNewVersionForm(prev => ({ ...prev, weight_difference: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">SKU Weight</Label>
                  <Input
                    type="number"
                    step="any"
                    className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors"
                    placeholder="SKU Weight"
                    value={newVersionForm.sku_weight || ""}
                    onChange={(e) => setNewVersionForm(prev => ({ ...prev, sku_weight: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Packing Weight</Label>
                  <Input
                    type="number"
                    step="any"
                    className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors"
                    placeholder="Packing Weight"
                    value={newVersionForm.packing_weight || ""}
                    onChange={(e) => setNewVersionForm(prev => ({ ...prev, packing_weight: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Gross Weight</Label>
                  <Input
                    type="number"
                    step="any"
                    className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors"
                    placeholder="Gross Weight"
                    value={newVersionForm.gross_weight || ""}
                    onChange={(e) => setNewVersionForm(prev => ({ ...prev, gross_weight: e.target.value }))}
                  />
                </div>
              </>
            )}

            {activeSection === "tax" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Stock Category</Label>
                  <Select
                    value={newVersionForm.stock_category_id ? String(newVersionForm.stock_category_id) : ""}
                    onValueChange={(val) => setNewVersionForm(prev => ({ ...prev, stock_category_id: val }))}
                  >
                    <SelectTrigger className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors">
                      <SelectValue placeholder="Select Stock Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeStockCategories.map((c: any) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name || c.category_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Type of Supply</Label>
                  <Select
                    value={newVersionForm.type_of_supply || ""}
                    onValueChange={(val) => setNewVersionForm(prev => ({ ...prev, type_of_supply: val }))}
                  >
                    <SelectTrigger className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors">
                      <SelectValue placeholder="Select Type of Supply" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Goods">Goods</SelectItem>
                      <SelectItem value="Services">Services</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">GST Rate</Label>
                  <Select
                    value={newVersionForm.gst_rate_id ? String(newVersionForm.gst_rate_id) : ""}
                    onValueChange={(val) => setNewVersionForm(prev => ({ ...prev, gst_rate_id: val }))}
                  >
                    <SelectTrigger className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors">
                      <SelectValue placeholder="Select GST Rate" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeGstRates.map((g: any) => (
                        <SelectItem key={g.id} value={String(g.id)}>
                          {g.rate != null ? `${g.rate}%` : (g.rate_percentage != null ? `${g.rate_percentage}%` : (g.name || ''))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">HSN Code</Label>
                  <Select
                    value={newVersionForm.hsn_code_id ? String(newVersionForm.hsn_code_id) : ""}
                    onValueChange={(val) => setNewVersionForm(prev => ({ ...prev, hsn_code_id: val }))}
                  >
                    <SelectTrigger className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors">
                      <SelectValue placeholder="Select HSN Code" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeHsnCodes.map((h: any) => (
                        <SelectItem key={h.id} value={String(h.id)}>
                          {h.code || h.hsn_code} – {h.description || h.name || ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">SAC Code</Label>
                  <Select
                    value={newVersionForm.sac_code_id ? String(newVersionForm.sac_code_id) : ""}
                    onValueChange={(val) => setNewVersionForm(prev => ({ ...prev, sac_code_id: val }))}
                  >
                    <SelectTrigger className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors">
                      <SelectValue placeholder="Select SAC Code" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeSacCodes.map((s: any) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.code || s.sac_code} – {s.description || s.name || ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">UQC</Label>
                  <Select
                    value={newVersionForm.uqc_id ? String(newVersionForm.uqc_id) : ""}
                    onValueChange={(val) => setNewVersionForm(prev => ({ ...prev, uqc_id: val }))}
                  >
                    <SelectTrigger className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors">
                      <SelectValue placeholder="Select UQC" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeUqcCodes.map((u: any) => (
                        <SelectItem key={u.id} value={String(u.id)}>
                          {u.code || u.uqc_code} – {u.name || u.quantity_description || ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {activeSection === "depots" && (
              <>
                {activeDepots.map((depot: any) => {
                  const dKey = depot.depot_name || String(depot.id)
                  return (
                    <div key={dKey} className="space-y-1.5">
                      <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">{depot.depot_name} Opening Stock</Label>
                      <Input
                        type="number"
                        step="any"
                        className="h-9 text-xs bg-white rounded-lg border-slate-200 shadow-xs hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/30 transition-colors"
                        value={newVersionForm.depot_stocks?.[dKey] ?? ""}
                        onChange={(e) => {
                          const val = e.target.value
                          setNewVersionForm(prev => ({
                            ...prev,
                            depot_stocks: { ...(prev.depot_stocks || {}), [dKey]: val },
                          }))
                        }}
                        placeholder="0"
                      />
                    </div>
                  )
                })}
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
                <th className="py-2.5 px-3 whitespace-nowrap bg-amber-50/80 text-slate-900 border-r border-slate-300 w-36 font-bold">
                  Applicable From (W.E.F)
                </th>

                {DEDICATED_COLUMNS[activeSection as SkuSectionType].map((fieldName) => (
                  <th key={fieldName} className="py-2.5 px-3 border-r border-slate-300 whitespace-nowrap">{columnLabel(fieldName)}</th>
                ))}

                <th className="py-2.5 px-3 text-right whitespace-nowrap border-r border-slate-300 w-36">Updated By</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {groupedVersions.map((version: any, vIdx: number) => {
                const todayStr = getTodayStr()
                const isFuture = version.wefDate > todayStr
                const isActive = version.wefDate === activeRecordId

                const formattedWef = version.wefDate
                  ? new Date(version.wefDate)
                      .toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                      .replace(/ /g, "-")
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
                    <td className="py-2 px-3 font-bold text-slate-900 bg-amber-50/50 border-r border-slate-300 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                        <span className="font-mono text-[11px]">{formattedWef}</span>
                        {isActive && (
                          <Badge className="ml-1 bg-emerald-600 text-white text-[9px] px-1.5 py-0 uppercase tracking-wider font-bold border-none">
                            Active
                          </Badge>
                        )}
                        {isFuture && (
                          <Badge className="ml-1 bg-amber-500 text-white text-[9px] px-1.5 py-0 uppercase tracking-wider font-bold border-none">
                            Scheduled
                          </Badge>
                        )}
                      </div>
                    </td>

                    {/* Dedicated per-field columns (Customer Master style: plain effective values, no diffs) */}
                    {DEDICATED_COLUMNS[activeSection as SkuSectionType].map((fieldName) => (
                      <td key={fieldName} className="py-2.5 px-3 border-r border-slate-200 text-slate-700 font-medium">
                        {getSnapshotValue(version, fieldName)}
                      </td>
                    ))}

                    {/* Updated By Cell */}
                    <td className="py-2.5 px-3 text-right border-r border-slate-200 whitespace-nowrap text-[11px] text-slate-600">
                      <div className="flex items-center justify-end gap-1 font-medium">
                        <User className="h-3 w-3 text-slate-400" />
                        <span>{version.changedByName}</span>
                      </div>
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
