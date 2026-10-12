"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { matchesSearch } from "@/lib/search-utils"
import { calculateSkuSellingPriceDerived } from "@/lib/utils"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Checkbox } from "@/components/ui/checkbox"
import { Combobox } from "@/components/ui/combobox"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { FileUploadField } from "@/components/file-upload-field"
import { useToast } from "@/hooks/use-toast"
import { customerApi, depotApi, brokerApi, skuDetailsApi, commonApi, skuSellingPriceApi, varCalcApi, salespersonApi, ledgerGroupApi, stockGroupApi, unitApi, ledgerApi, rawMaterialApi, semiFinishedGoodApi, insuranceDetailApi, conversionFormulaApi, priceLevelApi, petrolPumpApi, cdRuleApi, tdsRuleApi, oilTagApi, bhadaRateApi, vehicleMasterApi, driverMasterApi, transportMasterApi, orderApi, inventoryApi, setMasterTabContext, stateApi, districtApi, subDistrictApi, lookupApi, masterHistoryApi } from "@/lib/api-service"
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query"
import { useInView } from "react-intersection-observer"

import { useAuth } from "@/hooks/use-auth"
import { UserPlus, UserMinus, Search, RefreshCw, FileText, Download, Filter, ArrowUpDown, ArrowUp, ArrowDown, Package, Warehouse, Briefcase, Plus, Loader2, Save, Trash2, Edit2, AlertCircle, CheckCircle2, MoreVertical, X, Settings, Calendar, Clock, MapPin, Phone, Mail, User, Users, Info, Check, Eye, Trash, LayoutGrid, ChevronRight, ChevronDown, Upload, EyeOff, Layout, Pencil, UserCircle, ArrowLeft, Truck, Factory, BookOpen, Layers, Ruler, Landmark, FlaskConical, Shield, Calculator, Tag, Fuel, Percent, Route, Droplet, List, FileSpreadsheet,
} from 'lucide-react'
import { PageHeader } from "@/components/page-header"
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
import { ReferenceDataTab } from "@/components/reference-data-tab"
import { MasterEditHistoryTable } from "@/components/master-edit-history-table"
import { CustomerSectionalHistoryTable } from "@/components/customer-sectional-history-table"
import { CustomerEffectiveDatesModalView } from "@/components/customer-effective-dates-modal-view"
import { DepotEffectiveDatesModalView } from "@/components/depot-effective-dates-modal-view"
import { BrokerEffectiveDatesModalView } from "@/components/broker-effective-dates-modal-view"
import { PetrolPumpEffectiveDatesModalView } from "@/components/petrol-pump-effective-dates-modal-view"
import { SalespersonEffectiveDatesModalView } from "@/components/salesperson-effective-dates-modal-view"
import { UnitEffectiveDatesModalView } from "@/components/unit-effective-dates-modal-view"
import { RawMaterialEffectiveDatesModalView } from "@/components/raw-material-effective-dates-modal-view"
import { SemiFinishedGoodEffectiveDatesModalView } from "@/components/semi-finished-good-effective-dates-modal-view"
import { InsuranceDetailEffectiveDatesModalView } from "@/components/insurance-detail-effective-dates-modal-view"
import { CdRuleEffectiveDatesModalView } from "@/components/cd-rule-effective-dates-modal-view"
import { TdsRuleEffectiveDatesModalView } from "@/components/tds-rule-effective-dates-modal-view"
import { OilTagEffectiveDatesModalView } from "@/components/oil-tag-effective-dates-modal-view"
import { BhadaRateEffectiveDatesModalView } from "@/components/bhada-rate-effective-dates-modal-view"
import { ConversionFormulaEffectiveDatesModalView } from "@/components/conversion-formula-effective-dates-modal-view"
import { SkuEffectiveDatesModalView } from "@/components/sku-effective-dates-modal-view"
import { PriceLevelEffectiveDatesModalView } from "@/components/price-level-effective-dates-modal-view"
import { SkuSellingPriceEffectiveDatesModalView } from "@/components/sku-selling-price-effective-dates-modal-view"
import { VehicleEffectiveDatesModalView } from "@/components/vehicle-effective-dates-modal-view"
import { DriverEffectiveDatesModalView } from "@/components/driver-effective-dates-modal-view"
import { TransportEffectiveDatesModalView } from "@/components/transport-effective-dates-modal-view"
import { LedgerGroupEffectiveDatesModalView } from "@/components/ledger-group-effective-dates-modal-view"
import { StockGroupEffectiveDatesModalView } from "@/components/stock-group-effective-dates-modal-view"
import { CustomerMasterTable } from "@/components/masters/tables/CustomerMasterTable"
import { DepotMasterTable } from "@/components/masters/tables/DepotMasterTable"
import { BrokerMasterTable } from "@/components/masters/tables/BrokerMasterTable"
import { SalespersonMasterTable } from "@/components/masters/tables/SalespersonMasterTable"
import { SimpleMasterTable } from "@/components/masters/tables/SimpleMasterTable"
import { RawMaterialMasterTable } from "@/components/masters/tables/RawMaterialMasterTable"
import { SemiFinishedGoodMasterTable } from "@/components/masters/tables/SemiFinishedGoodMasterTable"
import { CdRuleMasterTable } from "@/components/masters/tables/CdRuleMasterTable"
import { TdsRuleMasterTable } from "@/components/masters/tables/TdsRuleMasterTable"
import { InsuranceDetailMasterTable } from "@/components/masters/tables/InsuranceDetailMasterTable"
import { ConversionFormulaMasterTable } from "@/components/masters/tables/ConversionFormulaMasterTable"
import { PriceLevelMasterTable } from "@/components/masters/tables/PriceLevelMasterTable"
import { SkuDetailsMasterTable } from "@/components/masters/tables/SkuDetailsMasterTable"
import { SkuSellingPriceMasterTable } from "@/components/masters/tables/SkuSellingPriceMasterTable"
import { VehicleMasterTable } from "@/components/masters/tables/VehicleMasterTable"
import { DriverMasterTable } from "@/components/masters/tables/DriverMasterTable"
import { TransportMasterTable } from "@/components/masters/tables/TransportMasterTable"
import { MasterCardWrapper } from "@/components/masters/MasterCardWrapper"
import { CustomerForm } from "@/components/masters/forms/CustomerForm"
import { DepotForm } from "@/components/masters/forms/DepotForm"
import { BrokerForm } from "@/components/masters/forms/BrokerForm"
import { SalespersonForm } from "@/components/masters/forms/SalespersonForm"
import { PetrolPumpForm } from "@/components/masters/forms/PetrolPumpForm"
import { FinishedGoodsForm } from "@/components/masters/forms/FinishedGoodsForm"
import { MasterFieldChangeConfirmModal, SkuFieldChangeConfirmModal } from "@/components/masters/modals/MasterFieldChangeConfirmModal"
import { VehicleForm } from "@/components/masters/forms/VehicleForm"
import { DriverForm } from "@/components/masters/forms/DriverForm"
import { TransportForm } from "@/components/masters/forms/TransportForm"
import { RawMaterialForm } from "@/components/masters/forms/RawMaterialForm"
import { SemiFinishedGoodForm } from "@/components/masters/forms/SemiFinishedGoodForm"
import { ConversionFormulaForm } from "@/components/masters/forms/ConversionFormulaForm"
import { InsuranceDetailForm } from "@/components/masters/forms/InsuranceDetailForm"
import { PriceLevelForm } from "@/components/masters/forms/PriceLevelForm"
import { SkuSellingPriceForm } from "@/components/masters/forms/SkuSellingPriceForm"
import { PartyParityFields as PartyParityFieldsUI } from "@/components/masters/forms/PartyParityFields"
import { CdRuleForm } from "@/components/masters/forms/CdRuleForm"
import { TdsRuleForm } from "@/components/masters/forms/TdsRuleForm"
import { OilTagForm } from "@/components/masters/forms/OilTagForm"
import { BhadaRateForm } from "@/components/masters/forms/BhadaRateForm"
import {
  LedgerGroupForm,
  StockGroupForm,
  UnitForm,
} from "@/components/masters/forms/SimpleMastersForms"
import { CustomerBulkImportModal } from "@/components/masters/modals/customer-bulk-import-modal"
import { CustomerGodownTagModal } from "@/components/masters/modals/customer-godown-tag-modal"
import { DepotBulkImportModal } from "@/components/masters/modals/depot-bulk-import-modal"
import { BrokerBulkImportModal } from "@/components/masters/modals/broker-bulk-import-modal"
import { SalespersonBulkImportModal } from "@/components/masters/modals/salesperson-bulk-import-modal"
import { FinishedGoodsBulkImportModal } from "@/components/masters/modals/finished-goods-bulk-import-modal"
import { PricingBulkImportModal } from "@/components/masters/modals/pricing-bulk-import-modal"
import { VehicleBulkImportModal } from "@/components/masters/modals/vehicle-bulk-import-modal"
import { DriverBulkImportModal } from "@/components/masters/modals/driver-bulk-import-modal"
import { TransporterBulkImportModal } from "@/components/masters/modals/transporter-bulk-import-modal"
import { LedgerGroupBulkImportModal } from "@/components/masters/modals/ledger-group-bulk-import-modal"
import { StockGroupBulkImportModal } from "@/components/masters/modals/stock-group-bulk-import-modal"
import { UnitBulkImportModal } from "@/components/masters/modals/unit-bulk-import-modal"
import { RawMaterialBulkImportModal } from "@/components/masters/modals/raw-material-bulk-import-modal"
import { SemiFinishedGoodBulkImportModal } from "@/components/masters/modals/semi-finished-good-bulk-import-modal"
import { InsuranceDetailBulkImportModal } from "@/components/masters/modals/insurance-detail-bulk-import-modal"
import { ConversionFormulaBulkImportModal } from "@/components/masters/modals/conversion-formula-bulk-import-modal"
import { PriceLevelBulkImportModal } from "@/components/masters/modals/price-level-bulk-import-modal"
import { PetrolPumpBulkImportModal } from "@/components/masters/modals/petrol-pump-bulk-import-modal"
import { CdRuleBulkImportModal } from "@/components/masters/modals/cd-rule-bulk-import-modal"
import { TdsRuleBulkImportModal } from "@/components/masters/modals/tds-rule-bulk-import-modal"
import { OilTagBulkImportModal } from "@/components/masters/modals/oil-tag-bulk-import-modal"
import { BhadaRateBulkImportModal } from "@/components/masters/modals/bhada-rate-bulk-import-modal"




// --- Types (extracted to @/types/master.types) ---

import type {
  Customer, CustomerAddress, CustomerBankAccount,
  PartyParityFields, Depot, Broker, Salesperson,
  LedgerGroup, StockGroup, Unit, Ledger,
  RawMaterial, RawMaterialAdditionalUom,
  SkuDetail, SkuSellingPrice,
  Vehicle, Driver, Transport,
} from "@/types/master.types"

// --- Config & Utilities (extracted to @/lib/masterTabConfig) ---
import {
  STATUS_OPTIONS, PAN_REGEX, GSTIN_REGEX, PINCODE_REGEX, IFSC_REGEX, GODOWN_NAMES,
  normalizeGstField,
  blankCustomerAddress, blankCustomerBankAccount, blankPartyParityFields,
  ALL_MASTER_TABS, TAB_META,
  formatDocDate, renderDocBadge, renderDocCell,
} from "@/lib/masterTabConfig"

export default function MasterPage() {

  // Global scroll restoration for all master forms
  useEffect(() => {
    const savedScroll = sessionStorage.getItem('masterFormScrollTop');
    if (savedScroll) {
      setTimeout(() => {
        const container = document.querySelector('[data-slot="dialog-content"]') || document.querySelector('.overflow-y-auto');
        if (container) {
          container.scrollTop = parseInt(savedScroll, 10);
        }
      }, 50);
      sessionStorage.removeItem('masterFormScrollTop');
    }
  }); // Runs on every render, but only does something if savedScroll exists

  const { toast } = useToast()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState("customers")
  const visibleTabs = useMemo(() => {
    if (!user || user.role === 'super_admin') return ALL_MASTER_TABS
    const masterTabsConfig = (user.features as any)?.master_tabs
    if (!masterTabsConfig || typeof masterTabsConfig !== 'object') return ALL_MASTER_TABS
    return ALL_MASTER_TABS.filter(tab => {
      const val = masterTabsConfig[tab]
      // Support old boolean format (true) and new string format ('modify' | 'view_only')
      return val === true || val === 'modify' || val === 'view_only'
    })
  }, [user])

  // Per-tab master_tabs access is authoritative here. The page-level "Master"
  // view/modify setting no longer locks the page — access is granted by the key's
  // presence in page_access (the sidebar gates that). Only the 'pc' role is a hard
  // global read-only.
  const isMasterTabReadOnly = useMemo(() => {
    if (user?.role === 'pc') return true // 'pc' role is always read-only
    if (!user || user.role === 'super_admin' || user.role === 'admin') return false
    const masterTabsConfig = (user.features as any)?.master_tabs
    if (!masterTabsConfig || typeof masterTabsConfig !== 'object') return false
    const val = masterTabsConfig[activeTab]
    // old boolean true or new 'modify' → can modify; 'view_only' → read only
    if (val === 'view_only') return true
    return false
  }, [user, activeTab])

  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.includes(activeTab)) {
      setActiveTab(visibleTabs[0])
    }
  }, [visibleTabs, activeTab])

  // Sync active tab with backend header context so API calls carry X-Master-Tab
  useEffect(() => {
    setMasterTabContext(activeTab)
    setCustomerSubTab('active'); setDepotSubTab('active'); setBrokerSubTab('active')
    setSalespersonSubTab('active'); setSkuSubTab('active'); setVehicleSubTab('active')
    setDriverSubTab('active'); setTransportSubTab('active')
    setLedgerGroupSubTab('active'); setStockGroupSubTab('active'); setUnitSubTab('active')
    setRawMaterialSubTab('active'); setSemiFinishedGoodSubTab('active')
    setInsuranceDetailSubTab('active'); setConversionFormulaSubTab('active')
    setPriceLevelSubTab('active'); setPetrolPumpSubTab('active')
    setCdRuleSubTab('active')
    setTdsRuleSubTab('active'); setBhadaRateSubTab('active')
    setSelectedVehicleType('all')
    setSearchTerm("")
    return () => { setMasterTabContext(null) }
  }, [activeTab])

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [customerBulkImportOpen, setCustomerBulkImportOpen] = useState(false)
  const [customerGodownTagOpen, setCustomerGodownTagOpen] = useState(false)
  const [isExportingCustomers, setIsExportingCustomers] = useState(false)
  const [depotBulkImportOpen, setDepotBulkImportOpen] = useState(false)
  const [isExportingDepots, setIsExportingDepots] = useState(false)
  const [brokerBulkImportOpen, setBrokerBulkImportOpen] = useState(false)
  const [isExportingBrokers, setIsExportingBrokers] = useState(false)
  const [salespersonBulkImportOpen, setSalespersonBulkImportOpen] = useState(false)
  const [isExportingSalespersons, setIsExportingSalespersons] = useState(false)
  const [finishedGoodsBulkImportOpen, setFinishedGoodsBulkImportOpen] = useState(false)
  const [isExportingFinishedGoods, setIsExportingFinishedGoods] = useState(false)
  const [pricingBulkImportOpen, setPricingBulkImportOpen] = useState(false)
  const [isExportingPricing, setIsExportingPricing] = useState(false)
  const [vehicleBulkImportOpen, setVehicleBulkImportOpen] = useState(false)
  const [isExportingVehicles, setIsExportingVehicles] = useState(false)
  const [driverBulkImportOpen, setDriverBulkImportOpen] = useState(false)
  const [isExportingDrivers, setIsExportingDrivers] = useState(false)
  const [transporterBulkImportOpen, setTransporterBulkImportOpen] = useState(false)
  const [isExportingTransporters, setIsExportingTransporters] = useState(false)
  const [ledgerGroupBulkImportOpen, setLedgerGroupBulkImportOpen] = useState(false)
  const [isExportingLedgerGroups, setIsExportingLedgerGroups] = useState(false)
  const [stockGroupBulkImportOpen, setStockGroupBulkImportOpen] = useState(false)
  const [isExportingStockGroups, setIsExportingStockGroups] = useState(false)
  const [unitBulkImportOpen, setUnitBulkImportOpen] = useState(false)
  const [isExportingUnits, setIsExportingUnits] = useState(false)
  const [rawMaterialBulkImportOpen, setRawMaterialBulkImportOpen] = useState(false)
  const [isExportingRawMaterials, setIsExportingRawMaterials] = useState(false)
  const [semiFinishedGoodBulkImportOpen, setSemiFinishedGoodBulkImportOpen] = useState(false)
  const [isExportingSemiFinishedGoods, setIsExportingSemiFinishedGoods] = useState(false)
  const [insuranceDetailBulkImportOpen, setInsuranceDetailBulkImportOpen] = useState(false)
  const [isExportingInsuranceDetails, setIsExportingInsuranceDetails] = useState(false)
  const [conversionFormulaBulkImportOpen, setConversionFormulaBulkImportOpen] = useState(false)
  const [isExportingConversionFormulas, setIsExportingConversionFormulas] = useState(false)
  const [priceLevelBulkImportOpen, setPriceLevelBulkImportOpen] = useState(false)
  const [isExportingPriceLevels, setIsExportingPriceLevels] = useState(false)
  const [petrolPumpBulkImportOpen, setPetrolPumpBulkImportOpen] = useState(false)
  const [isExportingPetrolPumps, setIsExportingPetrolPumps] = useState(false)
  const [cdRuleBulkImportOpen, setCdRuleBulkImportOpen] = useState(false)
  const [isExportingCdRules, setIsExportingCdRules] = useState(false)
  const [tdsRuleBulkImportOpen, setTdsRuleBulkImportOpen] = useState(false)
  const [isExportingTdsRules, setIsExportingTdsRules] = useState(false)
  const [oilTagBulkImportOpen, setOilTagBulkImportOpen] = useState(false)
  const [isExportingOilTags, setIsExportingOilTags] = useState(false)
  const [bhadaRateBulkImportOpen, setBhadaRateBulkImportOpen] = useState(false)
  const [isExportingBhadaRates, setIsExportingBhadaRates] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  const handleExportBhadaRatesCsv = async () => {
    try {
      setIsExportingBhadaRates(true)
      let list: any[] = []
      try {
        const res = await bhadaRateApi.getAll({ all: 'true' })
        if (res?.success && Array.isArray(res.data?.bhada_rates)) {
          list = res.data.bhada_rates
        } else if (res?.success && Array.isArray(res.data)) {
          list = res.data
        }
      } catch (e) {
        console.warn("API export failed, falling back to loaded Bhada rates state", e)
      }

      if (list.length === 0 && Array.isArray(bhadaRatesList) && bhadaRatesList.length > 0) {
        list = bhadaRatesList
      }

      if (!list || list.length === 0) {
        toast({ title: "Export Failed", description: "No Bhada Rate records found to export.", variant: "destructive" })
        return
      }

      const headers = [
        "Bhada Rate Code",
        "Bhada Rate Name / Route",
        "Rate (₹)",
        "W.E.F. Date",
        "Status",
      ]

      const csvRows = [headers.join(",")]

      for (const item of list) {
        const row = [
          `"${item.bhada_rate_code || item.bhadaRateCode || item.id || ''}"`,
          `"${(item.name || item.routeName || '').replace(/"/g, '""')}"`,
          `"${item.rate || '0'}"`,
          `"${item.wef_date || item.wefDate || ''}"`,
          `"${item.status || 'Active'}"`,
        ]
        csvRows.push(row.join(","))
      }

      const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(csvRows.join("\n"))
      const link = document.createElement("a")
      link.setAttribute("href", csvContent)
      link.setAttribute("download", `bhada_rates_master_export_${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({ title: "Export Successful", description: `Exported ${list.length} Bhada rate records.` })
    } catch (err: any) {
      console.error("Bhada Rates CSV Export error:", err)
      toast({ title: "Export Failed", description: err.message || "Failed to export Bhada rates CSV.", variant: "destructive" })
    } finally {
      setIsExportingBhadaRates(false)
    }
  }

  const handleExportOilTagsCsv = async () => {
    try {
      setIsExportingOilTags(true)
      let list: any[] = []
      try {
        const res = await lookupApi.getAll('oil_type', { all: 'true' })
        if (res?.success && Array.isArray(res.data?.items)) {
          list = res.data.items
        } else if (res?.success && Array.isArray(res.data)) {
          list = res.data
        }
      } catch (e) {
        console.warn("API export failed for oil tags", e)
      }

      if (list.length === 0) {
        try {
          const res = await oilTagApi.getAll({ all: 'true' })
          if (res?.success && Array.isArray(res.data?.items)) {
            list = res.data.items
          } else if (res?.success && Array.isArray(res.data)) {
            list = res.data
          }
        } catch (e) {
          console.warn("oilTagApi fallback export failed", e)
        }
      }

      if (!list || list.length === 0) {
        toast({ title: "Export Failed", description: "No Oil Tag records found to export.", variant: "destructive" })
        return
      }

      const headers = [
        "Oil Tag ID",
        "Oil Tag Name",
        "Status",
      ]

      const csvRows = [headers.join(",")]

      for (const item of list) {
        const row = [
          `"${item.id || ''}"`,
          `"${(item.name || '').replace(/"/g, '""')}"`,
          `"${item.status || 'Active'}"`,
        ]
        csvRows.push(row.join(","))
      }

      const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(csvRows.join("\n"))
      const link = document.createElement("a")
      link.setAttribute("href", csvContent)
      link.setAttribute("download", `oil_tags_master_export_${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({ title: "Export Successful", description: `Exported ${list.length} oil tag records.` })
    } catch (err: any) {
      console.error("Oil Tags CSV Export error:", err)
      toast({ title: "Export Failed", description: err.message || "Failed to export oil tags CSV.", variant: "destructive" })
    } finally {
      setIsExportingOilTags(false)
    }
  }


  const handleExportTdsRulesCsv = async () => {
    try {
      setIsExportingTdsRules(true)
      let list: any[] = []
      try {
        const res = await tdsRuleApi.getAll({ all: 'true' })
        if (res?.success && Array.isArray(res.data?.tds_rules)) {
          list = res.data.tds_rules
        } else if (res?.success && Array.isArray(res.data)) {
          list = res.data
        }
      } catch (e) {
        console.warn("API export failed, falling back to loaded TDS rules state", e)
      }

      if (list.length === 0 && Array.isArray(tdsRulesList) && tdsRulesList.length > 0) {
        list = tdsRulesList
      }

      if (!list || list.length === 0) {
        toast({ title: "Export Failed", description: "No TDS Rule records found to export.", variant: "destructive" })
        return
      }

      const headers = [
        "TDS Rule Code",
        "TDS Rule Name",
        "Guiding Rule / Section",
        "Threshold Limit (₹)",
        "TDS Rate (%)",
        "Applicable Amount Type",
        "WEF Date",
        "Status",
      ]

      const csvRows = [headers.join(",")]

      for (const item of list) {
        const row = [
          `"${item.tds_rule_code || item.tdsRuleCode || item.id || ''}"`,
          `"${(item.name || '').replace(/"/g, '""')}"`,
          `"${(item.guiding_rule || item.guidingRule || '').replace(/"/g, '""')}"`,
          `"${item.threshold_limit || item.thresholdLimit || '0'}"`,
          `"${item.rate || '0'}"`,
          `"${(item.applicable_amount_type || item.applicableAmountType || 'Total Invoice Amount').replace(/"/g, '""')}"`,
          `"${item.wef_date || item.wefDate || ''}"`,
          `"${item.status || 'Active'}"`,
        ]
        csvRows.push(row.join(","))
      }

      const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n")
      const encodedUri = encodeURI(csvContent)
      const link = document.createElement("a")
      link.setAttribute("href", encodedUri)
      link.setAttribute("download", `tds_rules_master_export_${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({ title: "Export Successful", description: `Exported ${list.length} TDS rule records.` })
    } catch (err: any) {
      console.error("TDS Rules CSV Export error:", err)
      toast({ title: "Export Failed", description: err.message || "Failed to export TDS rules CSV.", variant: "destructive" })
    } finally {
      setIsExportingTdsRules(false)
    }
  }


  const handleExportCdRulesCsv = async () => {
    try {
      setIsExportingCdRules(true)
      let list: any[] = []
      try {
        const res = await cdRuleApi.getAll({ all: 'true' })
        if (res?.success && Array.isArray(res.data?.cd_rules)) {
          list = res.data.cd_rules
        } else if (res?.success && Array.isArray(res.data)) {
          list = res.data
        }
      } catch (e) {
        console.warn("API export failed, falling back to loaded CD rules state", e)
      }

      if (list.length === 0 && Array.isArray(cdRulesList) && cdRulesList.length > 0) {
        list = cdRulesList
      }

      if (!list || list.length === 0) {
        toast({ title: "Export Failed", description: "No Cash Discount records found to export.", variant: "destructive" })
        return
      }

      const headers = [
        "CD Rule Code",
        "WEF Date",
        "Stock Category",
        "Discount Rate (Per Main UOM)",
        "Payment Condition (Days)",
        "Status",
      ]

      const csvRows = [headers.join(",")]

      for (const item of list) {
        const categoryName = stockCategoryData?.find((sc: any) => String(sc.id) === String(item.stock_category_id || item.stockCategoryId))?.group_name || item.stock_category || item.stock_category_id || ''

        const row = [
          `"${item.cd_rule_code || item.cdRuleCode || item.id || ''}"`,
          `"${item.wef_date || item.wefDate || ''}"`,
          `"${String(categoryName).replace(/"/g, '""')}"`,
          `"${item.discount_rate_per_main_uom || item.discountRatePerMainUom || '0'}"`,
          `"${item.payment_condition_days || item.paymentConditionDays || '0'}"`,
          `"${item.status || 'Active'}"`,
        ]
        csvRows.push(row.join(","))
      }

      const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n")
      const encodedUri = encodeURI(csvContent)
      const link = document.createElement("a")
      link.setAttribute("href", encodedUri)
      link.setAttribute("download", `cash_discount_rules_master_export_${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({ title: "Export Successful", description: `Exported ${list.length} cash discount records.` })
    } catch (err: any) {
      console.error("CD Rules CSV Export error:", err)
      toast({ title: "Export Failed", description: err.message || "Failed to export cash discount rules CSV.", variant: "destructive" })
    } finally {
      setIsExportingCdRules(false)
    }
  }


  const handleExportPetrolPumpsCsv = async () => {
    try {
      setIsExportingPetrolPumps(true)
      let list: any[] = []
      try {
        const res = await petrolPumpApi.getAll({ all: 'true' })
        if (res?.success && Array.isArray(res.data?.petrol_pumps)) {
          list = res.data.petrol_pumps
        } else if (res?.success && Array.isArray(res.data)) {
          list = res.data
        }
      } catch (e) {
        console.warn("API export failed, falling back to loaded petrol pumps state", e)
      }



      if (!list || list.length === 0) {
        toast({ title: "Export Failed", description: "No Petrol Pump records found to export.", variant: "destructive" })
        return
      }

      const headers = [
        "Petrol Pump Code",
        "Petrol Pump Name",
        "Mobile Number",
        "Email ID",
        "Ledger Group",
        "State",
        "PAN",
        "GSTIN",
        "GST Registered",
        "GST Reg Type",
        "GST Reg WEF",
        "MSME Reg No",
        "MSME Reg Type",
        "MSME Reg WEF",
        "FSSAI No",
        "FSSAI Licence Type",
        "FSSAI Valid Upto",
        "Status",
      ]

      const csvRows = [headers.join(",")]

      for (const item of list) {
        const row = [
          `"${item.petrol_pump_code || item.petrolPumpCode || item.id || ''}"`,
          `"${(item.petrol_pump_name || item.petrolPumpName || '').replace(/"/g, '""')}"`,
          `"${item.mobile_no || item.mobileNo || ''}"`,
          `"${(item.email_id || item.emailId || '').replace(/"/g, '""')}"`,
          `"${(item.ledger_group_name || item.ledgerGroupName || item.ledger_group_id || '').toString().replace(/"/g, '""')}"`,
          `"${(item.state || '').replace(/"/g, '""')}"`,
          `"${item.pan || ''}"`,
          `"${item.gstin || ''}"`,
          `"${item.gst_registered || item.gstRegistered || 'Unregistered'}"`,
          `"${item.gst_registration_type || item.gstRegistrationType || ''}"`,
          `"${item.gst_registration_wef || item.gstRegistrationWef || ''}"`,
          `"${item.msme_registration_no || item.msmeRegistrationNo || ''}"`,
          `"${item.msme_registration_type || item.msmeRegistrationType || ''}"`,
          `"${item.msme_registration_wef || item.msmeRegistrationWef || ''}"`,
          `"${item.fssai_no || item.fssaiNo || ''}"`,
          `"${item.fssai_licence_type || item.fssaiLicenceType || ''}"`,
          `"${item.fssai_valid_upto || item.fssaiValidUpto || ''}"`,
          `"${item.status || 'Active'}"`,
        ]
        csvRows.push(row.join(","))
      }

      const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n")
      const encodedUri = encodeURI(csvContent)
      const link = document.createElement("a")
      link.setAttribute("href", encodedUri)
      link.setAttribute("download", `petrol_pumps_master_export_${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({ title: "Export Successful", description: `Exported ${list.length} petrol pump records.` })
    } catch (err: any) {
      console.error("Petrol Pumps CSV Export error:", err)
      toast({ title: "Export Failed", description: err.message || "Failed to export petrol pumps CSV.", variant: "destructive" })
    } finally {
      setIsExportingPetrolPumps(false)
    }
  }

  const handleExportPriceLevelsCsv = async () => {
    try {
      setIsExportingPriceLevels(true)
      let list: any[] = []
      try {
        const res = await priceLevelApi.getAll({ all: 'true' })
        if (res?.success && Array.isArray(res.data?.price_levels)) {
          list = res.data.price_levels
        } else if (res?.success && Array.isArray(res.data)) {
          list = res.data
        }
      } catch (e) {
        console.warn("API export failed, falling back to loaded price levels state", e)
      }

      if (list.length === 0 && Array.isArray(priceLevelsList) && priceLevelsList.length > 0) {
        list = priceLevelsList
      }

      if (!list || list.length === 0) {
        toast({ title: "Export Failed", description: "No Price Level records found to export.", variant: "destructive" })
        return
      }

      const headers = [
        "Price Level Code",
        "Effective Date",
        "Finished Goods Prices",
        "Status",
      ]

      const csvRows = [headers.join(",")]

      for (const item of list) {
        let itemsStr = ""
        if (Array.isArray(item.items) && item.items.length > 0) {
          itemsStr = item.items
            .map((it: any) => `${it.sku_name || it.skuName || it.sku_id || ''}: ${it.price || 0}`)
            .join("; ")
        }

        const row = [
          `"${item.price_level_code || item.priceLevelCode || item.id || ''}"`,
          `"${item.effective_date || item.effectiveDate || ''}"`,
          `"${itemsStr.replace(/"/g, '""')}"`,
          `"${item.status || 'Active'}"`,
        ]
        csvRows.push(row.join(","))
      }

      const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n")
      const encodedUri = encodeURI(csvContent)
      const link = document.createElement("a")
      link.setAttribute("href", encodedUri)
      link.setAttribute("download", `price_levels_master_export_${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({ title: "Export Successful", description: `Exported ${list.length} price level records.` })
    } catch (err: any) {
      console.error("Price Levels CSV Export error:", err)
      toast({ title: "Export Failed", description: err.message || "Failed to export price levels CSV.", variant: "destructive" })
    } finally {
      setIsExportingPriceLevels(false)
    }
  }

  const handleExportConversionFormulasCsv = async () => {
    try {
      setIsExportingConversionFormulas(true)
      let list: any[] = []
      try {
        const res = await conversionFormulaApi.getAll({ all: 'true', include_steps: 'true' })
        if (res?.success && Array.isArray(res.data?.conversion_formulas)) {
          list = res.data.conversion_formulas
        } else if (res?.success && Array.isArray(res.data)) {
          list = res.data
        }
      } catch (e) {
        console.warn("API export failed, falling back to loaded conversion formulas state", e)
      }

      if (list.length === 0 && Array.isArray(conversionFormulasList) && conversionFormulasList.length > 0) {
        list = conversionFormulasList
      }

      if (!list || list.length === 0) {
        toast({ title: "Export Failed", description: "No Conversion Formula records found to export.", variant: "destructive" })
        return
      }

      const headers = [
        "Base SKU Name or Code",
        "Child SKU Name or Code",
        "Formula Code",
        "Steps",
        "Status",
      ]

      const csvRows = [headers.join(",")]

      for (const item of list) {
        let stepsStr = ""
        if (Array.isArray(item.steps) && item.steps.length > 0) {
          stepsStr = item.steps
            .map((s: any) => `${s.operation || 'add'} ${s.operand_type || 'literal'}${s.operand_value ? ' ' + s.operand_value : ''}`)
            .join("; ")
        }

        const row = [
          `"${(item.base_sku_name || item.baseSkuName || item.base_item_id || '').replace(/"/g, '""')}"`,
          `"${(item.child_sku_name || item.childSkuName || item.child_item_id || '').replace(/"/g, '""')}"`,
          `"${item.conversion_formula_code || item.conversionFormulaCode || item.id || ''}"`,
          `"${stepsStr.replace(/"/g, '""')}"`,
          `"${item.status || 'Active'}"`,
        ]
        csvRows.push(row.join(","))
      }

      const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n")
      const encodedUri = encodeURI(csvContent)
      const link = document.createElement("a")
      link.setAttribute("href", encodedUri)
      link.setAttribute("download", `conversion_formulas_master_export_${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({ title: "Export Successful", description: `Exported ${list.length} conversion formula records.` })
    } catch (err: any) {
      console.error("Conversion Formula CSV Export error:", err)
      toast({ title: "Export Failed", description: err.message || "Failed to export conversion formulas CSV.", variant: "destructive" })
    } finally {
      setIsExportingConversionFormulas(false)
    }
  }

  const handleExportInsuranceDetailsCsv = async () => {
    try {
      setIsExportingInsuranceDetails(true)
      let list: any[] = []
      try {
        const res = await insuranceDetailApi.getAll({ all: 'true' })
        if (res?.success && Array.isArray(res.data?.insurance_details)) {
          list = res.data.insurance_details
        } else if (res?.success && Array.isArray(res.data)) {
          list = res.data
        }
      } catch (e) {
        console.warn("API export failed, falling back to loaded insurance details state", e)
      }



      if (!list || list.length === 0) {
        toast({ title: "Export Failed", description: "No Insurance Detail records found to export.", variant: "destructive" })
        return
      }

      const headers = [
        "Insurance Code",
        "Insurance Company Name",
        "Short Name",
        "Policy Number",
        "Valid From",
        "Valid Upto",
        "Type of Policy",
        "Sum Insured",
        "Owner Type",
        "Linked Customers",
        "Status",
      ]

      const csvRows = [headers.join(",")]

      for (const item of list) {
        let linkedCustomerNames = ""
        if (Array.isArray(item.customer_ids) && item.customer_ids.length > 0) {
          linkedCustomerNames = item.customer_ids
            .map((cid: number) => customerOptions.find((c: any) => c.id === cid)?.customer_name)
            .filter(Boolean)
            .join("; ")
        }

        const row = [
          `"${item.insurance_code || item.insuranceCode || item.id || ''}"`,
          `"${(item.insurance_company_name || item.insuranceCompanyName || '').replace(/"/g, '""')}"`,
          `"${(item.short_name || item.shortName || '').replace(/"/g, '""')}"`,
          `"${(item.policy_number || item.policyNumber || '').replace(/"/g, '""')}"`,
          `"${item.valid_from || item.validFrom || ''}"`,
          `"${item.valid_upto || item.validUpto || ''}"`,
          `"${item.type_of_policy || item.typeOfPolicy || 'Open Policy'}"`,
          `"${item.sum_insured || item.sumInsured || ''}"`,
          `"${item.owner_type || item.ownerType || 'Company'}"`,
          `"${linkedCustomerNames.replace(/"/g, '""')}"`,
          `"${item.status || 'Active'}"`,
        ]
        csvRows.push(row.join(","))
      }

      const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n")
      const encodedUri = encodeURI(csvContent)
      const link = document.createElement("a")
      link.setAttribute("href", encodedUri)
      link.setAttribute("download", `insurance_details_master_export_${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({ title: "Export Successful", description: `Exported ${list.length} insurance detail records.` })
    } catch (err: any) {
      console.error("Insurance Details CSV Export error:", err)
      toast({ title: "Export Failed", description: err.message || "Failed to export insurance details CSV.", variant: "destructive" })
    } finally {
      setIsExportingInsuranceDetails(false)
    }
  }

  const handleExportSemiFinishedGoodsCsv = async () => {
    try {
      setIsExportingSemiFinishedGoods(true)
      let list: any[] = []
      try {
        const res = await semiFinishedGoodApi.getAll({ all: 'true' })
        if (res?.success && Array.isArray(res.data?.semi_finished_goods)) {
          list = res.data.semi_finished_goods
        } else if (res?.success && Array.isArray(res.data)) {
          list = res.data
        }
      } catch (e) {
        console.warn("API export failed, falling back to loaded semi-finished goods state", e)
      }



      if (!list || list.length === 0) {
        toast({ title: "Export Failed", description: "No Semi-Finished Good records found to export.", variant: "destructive" })
        return
      }

      const headers = [
        "Semi-Finished Good ID / Code",
        "Semi Finished Good Name",
        "Main UOM",
        "Stock Group",
        "Oil Tag",
        "Type of Supply",
        "GST Rate",
        "HSN Code",
        "SAC Code",
        "Default Accounting Ledger",
        "Batch Tracking Enabled",
        "Oil Filling Per Unit",
        "Filling Unit",
        "Converted Kg",
        "Packing Weight Per Main Unit",
        "Packing Weight Unit",
        "Standard Weight",
        "Standard Weight Unit",
        "Status",
      ]

      const csvRows = [headers.join(",")]

      for (const item of list) {
        const uom = unitOptions.find((u: any) => String(u.id) === String(item.main_uom_id || item.mainUomId))?.unit_name || ''
        const stockGroup = stockGroupOptions.find((sg: any) => String(sg.id) === String(item.stock_group_id || item.stockGroupId))?.group_name || ''
        const oilTag = (oilTypeData || activeOilTypes || []).find((ot: any) => String(ot.id) === String(item.oil_tag_id || item.oilTagId))?.name || ''
        const gstRate = activeGstRates.find((g: any) => String(g.id) === String(item.gst_rate_id || item.gstRateId))?.name || activeGstRates.find((g: any) => String(g.id) === String(item.gst_rate_id || item.gstRateId))?.rate || ''
        const hsnCode = activeHsnCodes.find((h: any) => String(h.id) === String(item.hsn_code_id || item.hsnCodeId))?.code || ''
        const sacCode = activeSacCodes.find((s: any) => String(s.id) === String(item.sac_code_id || item.sacCodeId))?.code || ''
        const ledger = ledgerOptions.find((l: any) => String(l.id) === String(item.default_accounting_ledger_id || item.defaultAccountingLedgerId))?.ledger_name || ''
        const fillingUnit = unitOptions.find((u: any) => String(u.id) === String(item.filling_unit_id || item.fillingUnitId))?.unit_name || ''
        const packingWeightUnit = unitOptions.find((u: any) => String(u.id) === String(item.packing_weight_unit_id || item.packingWeightUnitId))?.unit_name || ''
        const standardWeightUnit = unitOptions.find((u: any) => String(u.id) === String(item.standard_weight_unit_id || item.standardWeightUnitId))?.unit_name || ''

        const row = [
          `"${item.semi_finished_good_code || item.semiFinishedGoodCode || item.id || ''}"`,
          `"${(item.name || '').replace(/"/g, '""')}"`,
          `"${uom.replace(/"/g, '""')}"`,
          `"${stockGroup.replace(/"/g, '""')}"`,
          `"${oilTag.replace(/"/g, '""')}"`,
          `"${item.type_of_supply || item.typeOfSupply || 'Goods'}"`,
          `"${gstRate}"`,
          `"${hsnCode}"`,
          `"${sacCode}"`,
          `"${ledger.replace(/"/g, '""')}"`,
          `"${item.batch_tracking_enabled || item.batchTrackingEnabled ? 'Yes' : 'No'}"`,
          `"${item.oil_filling_per_unit || item.oilFillingPerUnit || ''}"`,
          `"${fillingUnit.replace(/"/g, '""')}"`,
          `"${item.converted_kg || item.convertedKg || ''}"`,
          `"${item.packing_weight_per_main_unit || item.packingWeightPerMainUnit || ''}"`,
          `"${packingWeightUnit.replace(/"/g, '""')}"`,
          `"${item.standard_weight || item.standardWeight || ''}"`,
          `"${standardWeightUnit.replace(/"/g, '""')}"`,
          `"${item.status || 'Active'}"`,
        ]
        csvRows.push(row.join(","))
      }

      const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n")
      const encodedUri = encodeURI(csvContent)
      const link = document.createElement("a")
      link.setAttribute("href", encodedUri)
      link.setAttribute("download", `semi_finished_goods_master_export_${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({ title: "Export Successful", description: `Exported ${list.length} semi-finished good records.` })
    } catch (err: any) {
      console.error("Semi-Finished Good CSV Export error:", err)
      toast({ title: "Export Failed", description: err.message || "Failed to export semi-finished goods CSV.", variant: "destructive" })
    } finally {
      setIsExportingSemiFinishedGoods(false)
    }
  }

  const handleExportRawMaterialsCsv = async () => {
    try {
      setIsExportingRawMaterials(true)
      let list: any[] = []
      try {
        const res = await rawMaterialApi.getAll({ all: 'true' })
        if (res?.success && Array.isArray(res.data?.raw_materials)) {
          list = res.data.raw_materials
        } else if (res?.success && Array.isArray(res.data)) {
          list = res.data
        }
      } catch (e) {
        console.warn("API export failed, falling back to loaded raw materials state", e)
      }



      if (!list || list.length === 0) {
        toast({ title: "Export Failed", description: "No Raw Material records found to export.", variant: "destructive" })
        return
      }

      const headers = [
        "Raw Material ID / Code",
        "Raw Material Name",
        "Main UOM",
        "Stock Group",
        "Type of Supply",
        "GST Rate",
        "HSN Code",
        "SAC Code",
        "Default Accounting Ledger",
        "Batch Tracking Enabled",
        "Status",
      ]

      const csvRows = [headers.join(",")]

      for (const item of list) {
        const uom = unitOptions.find((u: any) => String(u.id) === String(item.main_uom_id || item.mainUomId))?.unit_name || ''
        const stockGroup = stockGroupOptions.find((sg: any) => String(sg.id) === String(item.stock_group_id || item.stockGroupId))?.group_name || ''
        const gstRate = activeGstRates.find((g: any) => String(g.id) === String(item.gst_rate_id || item.gstRateId))?.name || activeGstRates.find((g: any) => String(g.id) === String(item.gst_rate_id || item.gstRateId))?.rate || ''
        const hsnCode = activeHsnCodes.find((h: any) => String(h.id) === String(item.hsn_code_id || item.hsnCodeId))?.code || ''
        const sacCode = activeSacCodes.find((s: any) => String(s.id) === String(item.sac_code_id || item.sacCodeId))?.code || ''
        const ledger = ledgerOptions.find((l: any) => String(l.id) === String(item.default_accounting_ledger_id || item.defaultAccountingLedgerId))?.ledger_name || ''

        const row = [
          `"${item.raw_material_code || item.rawMaterialCode || item.id || ''}"`,
          `"${(item.raw_material_name || item.rawMaterialName || item.name || '').replace(/"/g, '""')}"`,
          `"${(uom).replace(/"/g, '""')}"`,
          `"${(stockGroup).replace(/"/g, '""')}"`,
          `"${item.type_of_supply || item.typeOfSupply || 'Goods'}"`,
          `"${gstRate}"`,
          `"${hsnCode}"`,
          `"${sacCode}"`,
          `"${(ledger).replace(/"/g, '""')}"`,
          `"${item.batch_tracking_enabled || item.batchTrackingEnabled ? 'Yes' : 'No'}"`,
          `"${item.status || 'Active'}"`,
        ]
        csvRows.push(row.join(","))
      }

      const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n")
      const encodedUri = encodeURI(csvContent)
      const link = document.createElement("a")
      link.setAttribute("href", encodedUri)
      link.setAttribute("download", `raw_materials_master_export_${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({ title: "Export Successful", description: `Exported ${list.length} raw material records.` })
    } catch (err: any) {
      console.error("Raw Material CSV Export error:", err)
      toast({ title: "Export Failed", description: err.message || "Failed to export raw materials CSV.", variant: "destructive" })
    } finally {
      setIsExportingRawMaterials(false)
    }
  }

  const handleExportUnitsCsv = async () => {
    try {
      setIsExportingUnits(true)
      let list: any[] = []
      try {
        const res = await unitApi.getAll({ all: 'true' })
        if (res?.success && Array.isArray(res.data?.units)) {
          list = res.data.units
        } else if (res?.success && Array.isArray(res.data)) {
          list = res.data
        }
      } catch (e) {
        console.warn("API export failed, falling back to loaded units state", e)
      }

      if (!list || list.length === 0) {
        toast({ title: "Export Failed", description: "No Unit records found to export.", variant: "destructive" })
        return
      }

      const headers = [
        "Unit ID / Code",
        "Unit Name",
        "Status",
      ]

      const csvRows = [headers.join(",")]

      for (const item of list) {
        const row = [
          `"${item.unit_code || item.unitCode || item.id || ''}"`,
          `"${(item.unit_name || item.unitName || '').replace(/"/g, '""')}"`,
          `"${item.status || 'Active'}"`,
        ]
        csvRows.push(row.join(","))
      }

      const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n")
      const encodedUri = encodeURI(csvContent)
      const link = document.createElement("a")
      link.setAttribute("href", encodedUri)
      link.setAttribute("download", `units_master_export_${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({ title: "Export Successful", description: `Exported ${list.length} unit records.` })
    } catch (err: any) {
      console.error("Unit CSV Export error:", err)
      toast({ title: "Export Failed", description: err.message || "Failed to export units CSV.", variant: "destructive" })
    } finally {
      setIsExportingUnits(false)
    }
  }

  const handleExportStockGroupsCsv = async () => {
    try {
      setIsExportingStockGroups(true)
      let list: any[] = []
      try {
        const res = await stockGroupApi.getAll({ all: 'true' })
        if (res?.success && Array.isArray(res.data?.stock_groups)) {
          list = res.data.stock_groups
        } else if (res?.success && Array.isArray(res.data)) {
          list = res.data
        }
      } catch (e) {
        console.warn("API export failed, falling back to loaded stock groups state", e)
      }

      if (!list || list.length === 0) {
        toast({ title: "Export Failed", description: "No Stock Group records found to export.", variant: "destructive" })
        return
      }

      const headers = [
        "Group ID / Code",
        "Group Name",
        "Status",
      ]

      const csvRows = [headers.join(",")]

      for (const item of list) {
        const row = [
          `"${item.group_code || item.groupCode || item.id || ''}"`,
          `"${(item.group_name || item.groupName || '').replace(/"/g, '""')}"`,
          `"${item.status || 'Active'}"`,
        ]
        csvRows.push(row.join(","))
      }

      const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n")
      const encodedUri = encodeURI(csvContent)
      const link = document.createElement("a")
      link.setAttribute("href", encodedUri)
      link.setAttribute("download", `stock_groups_export_${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({ title: "Export Successful", description: `Exported ${list.length} stock group records.` })
    } catch (err: any) {
      console.error("Stock Group CSV Export error:", err)
      toast({ title: "Export Failed", description: err.message || "Failed to export stock groups CSV.", variant: "destructive" })
    } finally {
      setIsExportingStockGroups(false)
    }
  }

  const handleExportLedgerGroupsCsv = async () => {
    try {
      setIsExportingLedgerGroups(true)
      let list: any[] = []
      try {
        const res = await ledgerGroupApi.getAll({ all: 'true' })
        if (res?.success && Array.isArray(res.data?.ledger_groups)) {
          list = res.data.ledger_groups
        } else if (res?.success && Array.isArray(res.data)) {
          list = res.data
        }
      } catch (e) {
        console.warn("API export failed, falling back to loaded ledger groups state", e)
      }

      if (!list || list.length === 0) {
        toast({ title: "Export Failed", description: "No Ledger Group records found to export.", variant: "destructive" })
        return
      }

      const headers = [
        "Group ID / Code",
        "Group Name",
        "Nature of Group",
        "Status",
      ]

      const csvRows = [headers.join(",")]

      for (const item of list) {
        const row = [
          `"${item.group_code || item.groupCode || item.id || ''}"`,
          `"${(item.group_name || item.groupName || '').replace(/"/g, '""')}"`,
          `"${item.nature_of_group || item.natureOfGroup || ''}"`,
          `"${item.status || 'Active'}"`,
        ]
        csvRows.push(row.join(","))
      }

      const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n")
      const encodedUri = encodeURI(csvContent)
      const link = document.createElement("a")
      link.setAttribute("href", encodedUri)
      link.setAttribute("download", `ledger_groups_export_${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({ title: "Export Successful", description: `Exported ${list.length} ledger group records.` })
    } catch (err: any) {
      console.error("Ledger Group CSV Export error:", err)
      toast({ title: "Export Failed", description: err.message || "Failed to export ledger groups CSV.", variant: "destructive" })
    } finally {
      setIsExportingLedgerGroups(false)
    }
  }

  const handleExportTransportersCsv = async () => {
    try {
      setIsExportingTransporters(true)
      let list: any[] = []
      try {
        const res = await transportMasterApi.getAll({ all: 'true' })
        if (res?.success && Array.isArray(res.data?.transporters)) {
          list = res.data.transporters
        } else if (res?.success && Array.isArray(res.data)) {
          list = res.data
        }
      } catch (e) {
        console.warn("API export failed, falling back to loaded transporters state", e)
      }

      if (list.length === 0 && Array.isArray(transporters) && transporters.length > 0) {
        list = transporters
      }

      if (!list || list.length === 0) {
        toast({ title: "Export Failed", description: "No Transporter records found to export.", variant: "destructive" })
        return
      }

      const headers = [
        "Transporter ID",
        "Transporter Name",
        "Contact Person",
        "Contact Number",
        "Email ID",
        "Address",
        "State",
        "Pincode",
        "PAN",
        "GSTIN",
        "GST Registered",
        "GST Registration Type",
        "GST W.E.F. Date",
        "MSME Reg No",
        "MSME Reg Type",
        "MSME W.E.F. Date",
        "FSSAI No",
        "FSSAI Licence Type",
        "FSSAI Valid Upto",
        "Ledger Group ID",
        "Status",
      ]

      const csvRows = [headers.join(",")]

      for (const item of list) {
        const row = [
          `"${item.transport_master_id || item.transporterCode || item.id || ''}"`,
          `"${(item.transporter_name || item.transporterName || '').replace(/"/g, '""')}"`,
          `"${(item.contact_person || item.contactPerson || '').replace(/"/g, '""')}"`,
          `"${item.contact_number || item.contactNumber || ''}"`,
          `"${item.email_id || item.emailId || ''}"`,
          `"${(item.address_line1 || item.addressLine1 || '').replace(/"/g, '""')}"`,
          `"${item.state || ''}"`,
          `"${item.pincode || ''}"`,
          `"${item.pan || ''}"`,
          `"${item.gstin || ''}"`,
          `"${item.gst_registered || (item.gstin ? 'Registered' : 'Unregistered')}"`,
          `"${item.gst_registration_type || ''}"`,
          `"${item.gst_registration_wef ? String(item.gst_registration_wef).split('T')[0] : ''}"`,
          `"${item.msme_registration_no || ''}"`,
          `"${item.msme_registration_type || ''}"`,
          `"${item.msme_registration_wef ? String(item.msme_registration_wef).split('T')[0] : ''}"`,
          `"${item.fssai_no || ''}"`,
          `"${item.fssai_licence_type || ''}"`,
          `"${item.fssai_valid_upto ? String(item.fssai_valid_upto).split('T')[0] : ''}"`,
          `"${item.ledger_group_id || ''}"`,
          `"${item.status || 'Active'}"`,
        ]
        csvRows.push(row.join(","))
      }

      const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n")
      const encodedUri = encodeURI(csvContent)
      const link = document.createElement("a")
      link.setAttribute("href", encodedUri)
      link.setAttribute("download", `transporters_export_${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({ title: "Export Successful", description: `Exported ${list.length} transporter records.` })
    } catch (err: any) {
      console.error("Transporter CSV Export error:", err)
      toast({ title: "Export Failed", description: err.message || "Failed to export transporters CSV.", variant: "destructive" })
    } finally {
      setIsExportingTransporters(false)
    }
  }

  const handleExportPricingCsv = async () => {
    try {
      setIsExportingPricing(true)
      let list: any[] = []
      try {
        const res = await skuSellingPriceApi.getAll({ all: 'true' })
        if (res?.success && Array.isArray(res.data?.skus)) {
          list = res.data.skus
        } else if (res?.success && Array.isArray(res.data)) {
          list = res.data
        }
      } catch (e) {
        console.warn("API export failed, falling back to loaded skuSellingPrices state", e)
      }

      if (list.length === 0 && Array.isArray(skuSellingPrices) && skuSellingPrices.length > 0) {
        list = skuSellingPrices
      }

      if (!list || list.length === 0) {
        toast({ title: "Export Failed", description: "No Pricing records found to export.", variant: "destructive" })
        return
      }

      const headers = [
        "Packing Material",
        "SKU Weight",
        "SKU Unit",
        "Conversion Formula",
        "SKU Weight (gm)",
        "Packing Weight (gm)",
        "Packing Cost",
        "VAR",
        "Margin",
        "Landing Cost",
        "Selling Cost",
        "Status",
      ]

      const csvRows = [headers.join(",")]

      for (const item of list) {
        const row = [
          `"${(item.packing_material || '').replace(/"/g, '""')}"`,
          `"${item.sku_weight || ''}"`,
          `"${item.sku_unit || ''}"`,
          `"${item.conversion_formula || ''}"`,
          `"${item.sku_weight_in_gm || ''}"`,
          `"${item.packing_material_weight_in_gm || ''}"`,
          `"${item.packing_cost || ''}"`,
          `"${item.var || ''}"`,
          `"${item.margin || ''}"`,
          `"${item.landing_cost || ''}"`,
          `"${item.selling_cost || ''}"`,
          `"${item.status || 'Active'}"`,
        ]
        csvRows.push(row.join(","))
      }

      const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(csvRows.join("\n"))
      const link = document.createElement("a")
      link.setAttribute("href", csvContent)
      link.setAttribute("download", `Pricing_Master_Export_${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({ title: "Export Successful", description: `Exported ${list.length} pricing records.` })
    } catch (err: any) {
      toast({ title: "Export Error", description: err.message || "Failed to export CSV.", variant: "destructive" })
    } finally {
      setIsExportingPricing(false)
    }
  }

  const handleExportVehiclesCsv = async () => {
    try {
      setIsExportingVehicles(true)
      let list: any[] = []
      try {
        const res = await vehicleMasterApi.getAll({ all: 'true' })
        if (res?.success && Array.isArray(res.data?.vehicles)) {
          list = res.data.vehicles
        } else if (res?.success && Array.isArray(res.data)) {
          list = res.data
        }
      } catch (e) {
        console.warn("API export failed, falling back to loaded vehicles state", e)
      }

      if (list.length === 0 && Array.isArray(vehicles) && vehicles.length > 0) {
        list = vehicles
      }

      if (!list || list.length === 0) {
        toast({ title: "Export Failed", description: "No Vehicle records found to export.", variant: "destructive" })
        return
      }

      const headers = [
        "Vehicle ID",
        "Registration No",
        "Vehicle Type",
        "Transporter",
        "GVW",
        "ULW",
        "Passing Capacity",
        "Fuel Type",
        "RTO",
        "Road Tax Date",
        "Pollution Date",
        "Insurance Date",
        "Fitness Date",
        "State Permit Date",
        "State Permit Type",
        "National Permit Date",
        "Life Time Tax Date",
        "GPS Company",
        "GPS Tracking Link",
        "GPS Valid Upto",
        "GPS Type",
        "GPS Installed By",
        "Status",
      ]

      const csvRows = [headers.join(",")]

      for (const item of list) {
        const row = [
          `"${item.vehicle_master_id || item.vehicleCode || item.id || ''}"`,
          `"${item.registration_no || item.registrationNo || ''}"`,
          `"${item.vehicle_type || item.vehicleType || ''}"`,
          `"${(item.transporter || '').replace(/"/g, '""')}"`,
          `"${item.gvw ?? ''}"`,
          `"${item.ulw ?? ''}"`,
          `"${item.passing ?? ''}"`,
          `"${item.fuel_type || item.fuelType || ''}"`,
          `"${item.rto || ''}"`,
          `"${item.road_tax || item.roadTax ? String(item.road_tax || item.roadTax).split('T')[0] : ''}"`,
          `"${item.pollution ? String(item.pollution).split('T')[0] : ''}"`,
          `"${item.insurance ? String(item.insurance).split('T')[0] : ''}"`,
          `"${item.fitness ? String(item.fitness).split('T')[0] : ''}"`,
          `"${item.state_permit || item.statePermit ? String(item.state_permit || item.statePermit).split('T')[0] : ''}"`,
          `"${item.state_permit_type || item.statePermitType || ''}"`,
          `"${item.national_permit || item.nationalPermit ? String(item.national_permit || item.nationalPermit).split('T')[0] : ''}"`,
          `"${item.life_time_tax || item.lifeTimeTax ? String(item.life_time_tax || item.lifeTimeTax).split('T')[0] : ''}"`,
          `"${item.gps_company || item.gpsCompany || ''}"`,
          `"${item.gps_api_tracking_link || item.gpsApiTrackingLink || ''}"`,
          `"${item.gps_valid_upto || item.gpsValidUpto ? String(item.gps_valid_upto || item.gpsValidUpto).split('T')[0] : ''}"`,
          `"${item.gps_type || item.gpsType || ''}"`,
          `"${item.gps_installed_by || item.gpsInstalledBy || ''}"`,
          `"${item.status || 'Active'}"`,
        ]
        csvRows.push(row.join(","))
      }

      const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n")
      const encodedUri = encodeURI(csvContent)
      const link = document.createElement("a")
      link.setAttribute("href", encodedUri)
      link.setAttribute("download", `vehicles_export_${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({ title: "Export Successful", description: `Exported ${list.length} vehicle records.` })
    } catch (err: any) {
      console.error("Vehicle CSV Export error:", err)
      toast({ title: "Export Failed", description: err.message || "Failed to export vehicles CSV.", variant: "destructive" })
    } finally {
      setIsExportingVehicles(false)
    }
  }

  const handleExportDriversCsv = async () => {
    try {
      setIsExportingDrivers(true)
      let list: any[] = []
      try {
        const res = await driverMasterApi.getAll({ all: 'true' })
        if (res?.success && Array.isArray(res.data?.drivers)) {
          list = res.data.drivers
        } else if (res?.success && Array.isArray(res.data)) {
          list = res.data
        }
      } catch (e) {
        console.warn("API export failed, falling back to loaded drivers state", e)
      }

      if (list.length === 0 && Array.isArray(drivers) && drivers.length > 0) {
        list = drivers
      }

      if (!list || list.length === 0) {
        toast({ title: "Export Failed", description: "No Driver records found to export.", variant: "destructive" })
        return
      }

      const headers = [
        "Driver ID",
        "Driver Name",
        "Mobile No",
        "Email ID",
        "PAN No",
        "Driving Licence No",
        "Driving Licence Type",
        "Valid Upto",
        "RTO",
        "Trans Valid Upto",
        "LMV Valid Upto",
        "Address Line 1",
        "State",
        "Pincode",
        "Aadhaar No",
        "Status",
      ]

      const csvRows = [headers.join(",")]

      for (const item of list) {
        const row = [
          `"${item.driver_master_id || item.driverCode || item.id || ''}"`,
          `"${(item.driver_name || item.driverName || '').replace(/"/g, '""')}"`,
          `"${item.mobile_no || item.mobileNo || ''}"`,
          `"${item.email_id || item.emailId || ''}"`,
          `"${item.pan_no || item.panNo || ''}"`,
          `"${item.driving_licence_no || item.drivingLicenceNo || ''}"`,
          `"${item.driving_licence_type || item.drivingLicenceType || ''}"`,
          `"${item.valid_upto || item.validUpto ? String(item.valid_upto || item.validUpto).split('T')[0] : ''}"`,
          `"${(item.rto || '').replace(/"/g, '""')}"`,
          `"${item.trans_valid_upto || item.transValidUpto ? String(item.trans_valid_upto || item.transValidUpto).split('T')[0] : ''}"`,
          `"${item.lmv_valid_upto || item.lmvValidUpto ? String(item.lmv_valid_upto || item.lmvValidUpto).split('T')[0] : ''}"`,
          `"${(item.address_line1 || item.addressLine1 || '').replace(/"/g, '""')}"`,
          `"${item.state || ''}"`,
          `"${item.pincode || ''}"`,
          `"${item.aadhaar_no || item.aadhaarNo || ''}"`,
          `"${item.status || 'Active'}"`,
        ]
        csvRows.push(row.join(","))
      }

      const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n")
      const encodedUri = encodeURI(csvContent)
      const link = document.createElement("a")
      link.setAttribute("href", encodedUri)
      link.setAttribute("download", `drivers_export_${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({ title: "Export Successful", description: `Exported ${list.length} driver records.` })
    } catch (err: any) {
      console.error("Driver CSV Export error:", err)
      toast({ title: "Export Failed", description: err.message || "Failed to export drivers CSV.", variant: "destructive" })
    } finally {
      setIsExportingDrivers(false)
    }
  }

  const handleExportFinishedGoodsCsv = async () => {
    try {
      setIsExportingFinishedGoods(true)
      let list: any[] = []
      try {
        const res = await skuDetailsApi.getAll({ all: 'true' })
        if (res?.success && Array.isArray(res.data?.skus)) {
          list = res.data.skus
        } else if (res?.success && Array.isArray(res.data)) {
          list = res.data
        }
      } catch (e) {
        console.warn("API export failed, falling back to loaded skuDetails state", e)
      }

      if (list.length === 0 && Array.isArray(skuDetails) && skuDetails.length > 0) {
        list = skuDetails
      }

      if (!list || list.length === 0) {
        toast({ title: "Export Failed", description: "No Finished Goods records found to export.", variant: "destructive" })
        return
      }

      const headers = [
        "SKU Code",
        "Finished Good Name",
        "Main UOM",
        "Alternate UOM",
        "Nos Per Main UOM",
        "Units",
        "Tag for Reliance",
        "Oil Filling Per Unit",
        "Filling Units",
        "Converted Kg",
        "Packing Weight Per Main Unit",
        "Weight Difference",
        "SKU Weight",
        "Packing Weight",
        "Gross Weight",
        "Type of Supply",
        "Status",
      ]

      const csvRows = [headers.join(",")]

      for (const item of list) {
        const row = [
          `"${item.sku_code || item.skuCode || ''}"`,
          `"${(item.sku_name || item.skuName || '').replace(/"/g, '""')}"`,
          `"${item.main_uom || item.mainUom || ''}"`,
          `"${item.alternate_uom || item.alternateUom || ''}"`,
          `"${item.nos_per_main_uom || item.nosPerMainUom || ''}"`,
          `"${item.units || ''}"`,
          `"${item.tag_name || item.tagName || item.tag || ''}"`,
          `"${item.oil_filling_per_unit || item.oilFillingPerUnit || ''}"`,
          `"${item.filling_units || item.fillingUnits || ''}"`,
          `"${item.converted_kg || item.convertedKg || ''}"`,
          `"${item.packing_weight_per_main_unit || item.packingWeightPerMainUnit || ''}"`,
          `"${item.weight_difference || item.weightDifference || ''}"`,
          `"${item.sku_weight || item.skuWeight || ''}"`,
          `"${item.packing_weight || item.packingWeight || ''}"`,
          `"${item.gross_weight || item.grossWeight || ''}"`,
          `"${item.type_of_supply || item.typeOfSupply || 'Goods'}"`,
          `"${item.status || 'Active'}"`,
        ]
        csvRows.push(row.join(","))
      }

      const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(csvRows.join("\n"))
      const link = document.createElement("a")
      link.setAttribute("href", csvContent)
      link.setAttribute("download", `Finished_Goods_Master_Export_${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({ title: "Export Successful", description: `Exported ${list.length} finished goods records.` })
    } catch (err: any) {
      toast({ title: "Export Error", description: err.message || "Failed to export CSV.", variant: "destructive" })
    } finally {
      setIsExportingFinishedGoods(false)
    }
  }

  const handleExportSalespersonsCsv = async () => {
    try {
      setIsExportingSalespersons(true)
      let list: Salesperson[] = []
      try {
        const res = await salespersonApi.getAll({ all: 'true' })
        if (res?.success && Array.isArray(res.data?.salespersons)) {
          list = res.data.salespersons
        }
      } catch (e) {
        console.warn("API export failed, falling back to loaded salespersons state", e)
      }

      if (list.length === 0 && Array.isArray(salespersons) && salespersons.length > 0) {
        list = salespersons
      }

      if (!list || list.length === 0) {
        toast({ title: "Export Failed", description: "No salesperson records found to export.", variant: "destructive" })
        return
      }

      const headers = [
        "Salesperson Code",
        "Salesperson Name",
        "Mobile Number",
        "Email",
        "Employee ID",
        "State",
        "PAN",
        "GSTIN",
        "GST Registered",
        "GST Registration Type",
        "GST W.E.F. Date",
        "MSME Reg No",
        "MSME Reg Type",
        "MSME W.E.F. Date",
        "FSSAI No",
        "FSSAI Licence Type",
        "FSSAI Valid Upto",
        "Ledger Group ID",
        "Status",
      ]

      const csvRows = [headers.join(",")]

      for (const item of list) {
        const row = [
          `"${item.broker_id || item.employee_id || ''}"`,
          `"${(item.salesman_name || '').replace(/"/g, '""')}"`,
          `"${item.mobile_no || ''}"`,
          `"${item.email_id || ''}"`,
          `"${item.employee_id || ''}"`,
          `"${(item.state || '').replace(/"/g, '""')}"`,
          `"${item.pan || ''}"`,
          `"${item.gstin || ''}"`,
          `"${item.gst_registered || (item.gstin ? 'Registered' : 'Unregistered')}"`,
          `"${item.gst_registration_type || ''}"`,
          `"${item.gst_registration_wef ? String(item.gst_registration_wef).split('T')[0] : ''}"`,
          `"${item.msme_registration_no || ''}"`,
          `"${item.msme_registration_type || ''}"`,
          `"${item.msme_registration_wef ? String(item.msme_registration_wef).split('T')[0] : ''}"`,
          `"${item.fssai_no || ''}"`,
          `"${item.fssai_licence_type || ''}"`,
          `"${item.fssai_valid_upto ? String(item.fssai_valid_upto).split('T')[0] : ''}"`,
          `"${item.ledger_group_id || ''}"`,
          `"${item.status || 'Active'}"`,
        ]
        csvRows.push(row.join(","))
      }

      const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(csvRows.join("\n"))
      const link = document.createElement("a")
      link.setAttribute("href", csvContent)
      link.setAttribute("download", `Salesperson_Master_Export_${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({ title: "Export Successful", description: `Exported ${list.length} salesperson records.` })
    } catch (err: any) {
      toast({ title: "Export Error", description: err.message || "Failed to export CSV.", variant: "destructive" })
    } finally {
      setIsExportingSalespersons(false)
    }
  }

  const handleExportBrokersCsv = async () => {
    try {
      setIsExportingBrokers(true)
      let list: Broker[] = []
      try {
        const res = await brokerApi.getAll({ all: 'true' })
        if (res?.success && Array.isArray(res.data?.brokers)) {
          list = res.data.brokers
        }
      } catch (e) {
        console.warn("API export failed, falling back to loaded brokers state", e)
      }

      if (list.length === 0 && Array.isArray(brokers) && brokers.length > 0) {
        list = brokers
      }

      if (!list || list.length === 0) {
        toast({ title: "Export Failed", description: "No broker records found to export.", variant: "destructive" })
        return
      }

      const headers = [
        "Broker Code",
        "Broker Name",
        "Mobile Number",
        "Email",
        "State",
        "PAN",
        "GSTIN",
        "GST Registered",
        "GST Registration Type",
        "GST W.E.F. Date",
        "MSME Reg No",
        "MSME Reg Type",
        "MSME W.E.F. Date",
        "FSSAI No",
        "FSSAI Licence Type",
        "FSSAI Valid Upto",
        "Ledger Group ID",
        "Brokerage Rate (%)",
        "Status",
      ]

      const csvRows = [headers.join(",")]

      for (const item of list) {
        const row = [
          `"${item.broker_id || ''}"`,
          `"${(item.salesman_name || '').replace(/"/g, '""')}"`,
          `"${item.mobile_no || ''}"`,
          `"${item.email_id || ''}"`,
          `"${(item.state || '').replace(/"/g, '""')}"`,
          `"${item.pan || ''}"`,
          `"${item.gstin || ''}"`,
          `"${item.gst_registered || (item.gstin ? 'Registered' : 'Unregistered')}"`,
          `"${item.gst_registration_type || ''}"`,
          `"${item.gst_registration_wef ? String(item.gst_registration_wef).split('T')[0] : ''}"`,
          `"${item.msme_registration_no || ''}"`,
          `"${item.msme_registration_type || ''}"`,
          `"${item.msme_registration_wef ? String(item.msme_registration_wef).split('T')[0] : ''}"`,
          `"${item.fssai_no || ''}"`,
          `"${item.fssai_licence_type || ''}"`,
          `"${item.fssai_valid_upto ? String(item.fssai_valid_upto).split('T')[0] : ''}"`,
          `"${item.ledger_group_id || ''}"`,
          `"${(item as any).brokerage_rate || (item as any).brokerageRate || ''}"`,
          `"${item.status || 'Active'}"`,
        ]
        csvRows.push(row.join(","))
      }

      const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(csvRows.join("\n"))
      const link = document.createElement("a")
      link.setAttribute("href", csvContent)
      link.setAttribute("download", `Broker_Master_Export_${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({ title: "Export Complete", description: `Successfully exported ${list.length} broker records to CSV.` })
    } catch (err: any) {
      toast({ title: "Export Error", description: err?.message || "Failed to export broker records", variant: "destructive" })
    } finally {
      setIsExportingBrokers(false)
    }
  }

  const handleExportDepotsCsv = async () => {
    try {
      setIsExportingDepots(true)
      let list: Depot[] = []
      try {
        const res = await depotApi.getAll({ all: 'true' })
        if (res?.success && Array.isArray(res.data?.depots)) {
          list = res.data.depots
        }
      } catch (e) {
        console.warn("API export failed, falling back to loaded depots state", e)
      }

      if (list.length === 0 && Array.isArray(depots) && depots.length > 0) {
        list = depots
      }

      if (!list || list.length === 0) {
        toast({ title: "Export Failed", description: "No depot records found to export.", variant: "destructive" })
        return
      }

      const headers = [
        "Depot Code",
        "Depot Name",
        "State",
        "Depot Address",
        "Status",
      ]

      const csvRows = [headers.join(",")]

      for (const item of list) {
        const row = [
          `"${item.depot_id || ''}"`,
          `"${(item.depot_name || '').replace(/"/g, '""')}"`,
          `"${(item.state || '').replace(/"/g, '""')}"`,
          `"${(item.depot_address || '').replace(/"/g, '""')}"`,
          `"${item.status || 'Active'}"`,
        ]
        csvRows.push(row.join(","))
      }

      const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(csvRows.join("\n"))
      const link = document.createElement("a")
      link.setAttribute("href", csvContent)
      link.setAttribute("download", `Depot_Master_Export_${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({ title: "Export Complete", description: `Successfully exported ${list.length} depot records to CSV.` })
    } catch (err: any) {
      toast({ title: "Export Error", description: err?.message || "Failed to export depot records", variant: "destructive" })
    } finally {
      setIsExportingDepots(false)
    }
  }

  const handleExportCustomersCsv = async () => {
    try {
      setIsExportingCustomers(true)
      let list: Customer[] = []
      try {
        const res = await customerApi.getAll({ all: 'true' })
        if (res?.success && Array.isArray(res.data?.customers)) {
          list = res.data.customers
        }
      } catch (e) {
        console.warn("API export failed, falling back to loaded customers state", e)
      }

      if (list.length === 0 && Array.isArray(customers) && customers.length > 0) {
        list = customers
      }

      if (!list || list.length === 0) {
        toast({ title: "Export Failed", description: "No customer records found to export.", variant: "destructive" })
        return
      }

      const headers = [
        "Customer Code",
        "Customer Name",
        "Contact Person",
        "Contact Number",
        "Email",
        "Address Line 1",
        "Address Line 2",
        "State",
        "Pincode",
        "PAN",
        "GSTIN",
        "GST Registered",
        "GST Registration Type",
        "GST W.E.F. Date",
        "MSME Reg No",
        "MSME Reg Type",
        "MSME W.E.F. Date",
        "FSSAI No",
        "FSSAI Licence Type",
        "FSSAI Valid Upto",
        "Ledger Group ID",
        "Is Required for Commitment",
        "Status",
      ]

      const csvRows = [headers.join(",")]

      for (const item of list) {
        const row = [
          `"${item.customer_id || ''}"`,
          `"${(item.customer_name || '').replace(/"/g, '""')}"`,
          `"${(item.contact_person || '').replace(/"/g, '""')}"`,
          `"${item.contact || ''}"`,
          `"${item.email || ''}"`,
          `"${(item.address_line_1 || '').replace(/"/g, '""')}"`,
          `"${(item.address_line_2 || '').replace(/"/g, '""')}"`,
          `"${item.state || ''}"`,
          `"${item.pincode || ''}"`,
          `"${item.pan || ''}"`,
          `"${item.gstin || ''}"`,
          `"${item.gst_registered || ''}"`,
          `"${item.gst_registration_type || ''}"`,
          `"${item.gst_registration_wef ? String(item.gst_registration_wef).split('T')[0] : ''}"`,
          `"${item.msme_registration_no || ''}"`,
          `"${item.msme_registration_type || ''}"`,
          `"${item.msme_registration_wef ? String(item.msme_registration_wef).split('T')[0] : ''}"`,
          `"${item.fssai_no || ''}"`,
          `"${item.fssai_licence_type || ''}"`,
          `"${item.fssai_valid_upto ? String(item.fssai_valid_upto).split('T')[0] : ''}"`,
          `"${item.ledger_group_id || ''}"`,
          `"${item.is_required_for_commitment || 'No'}"`,
          `"${item.status || 'Active'}"`,
        ]
        csvRows.push(row.join(","))
      }

      const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(csvRows.join("\n"))
      const link = document.createElement("a")
      link.setAttribute("href", csvContent)
      link.setAttribute("download", `Customer_Master_Export_${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({ title: "Export Complete", description: `Successfully exported ${list.length} customer records to CSV.` })
    } catch (err: any) {
      toast({ title: "Export Error", description: err?.message || "Failed to export customer records", variant: "destructive" })
    } finally {
      setIsExportingCustomers(false)
    }
  }
  const [openingStockByDepot, setOpeningStockByDepot] = useState<Record<string, string>>({})
const { ref: customerEndRef, inView: customerInView } = useInView()
  const { ref: depotEndRef, inView: depotInView } = useInView()
  const { ref: brokerEndRef, inView: brokerInView } = useInView()
  const { ref: salespersonEndRef, inView: salespersonInView } = useInView()
  const { ref: ledgerGroupEndRef, inView: ledgerGroupInView } = useInView()
  const { ref: stockGroupEndRef, inView: stockGroupInView } = useInView()
  const { ref: unitEndRef, inView: unitInView } = useInView()
  const { ref: rawMaterialEndRef, inView: rawMaterialInView } = useInView()
  const { ref: semiFinishedGoodEndRef, inView: semiFinishedGoodInView } = useInView()
  const { ref: insuranceDetailEndRef, inView: insuranceDetailInView } = useInView()
  const { ref: conversionFormulaEndRef, inView: conversionFormulaInView } = useInView()
  const { ref: priceLevelEndRef, inView: priceLevelInView } = useInView()
  const { ref: petrolPumpEndRef, inView: petrolPumpInView } = useInView()
  const { ref: cdRuleEndRef, inView: cdRuleInView } = useInView()
  const { ref: tdsRuleEndRef, inView: tdsRuleInView } = useInView()
  const { ref: bhadaRateEndRef, inView: bhadaRateInView } = useInView()
  const { ref: vehicleEndRef, inView: vehicleInView } = useInView()
  const { ref: driverEndRef, inView: driverInView } = useInView()
  const { ref: skuEndRef, inView: skuInView } = useInView()
  const { ref: skuSellingPriceEndRef, inView: skuSellingPriceInView } = useInView()
  const { ref: transportEndRef, inView: transportInView } = useInView()
  // --- Queries ---

  // Customers
  const {
    data: customerData,
    fetchNextPage: fetchNextCustomer,
    hasNextPage: hasNextCustomer,
    isFetchingNextPage: isFetchingNextCustomer,
    isLoading: isCustomerLoading,
    refetch: refetchCustomer,
  } = useInfiniteQuery({
    queryKey: ["master-customers", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await customerApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" })
      return res.success ? res.data : { customers: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.customers?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  const { data: pendingCustomersData, refetch: refetchPendingCustomers } = useQuery({
    queryKey: ['pending-customers'],
    queryFn: async () => {
      const res = await customerApi.getPending()
      return res.success ? (res.data as any[]) : []
    },
    enabled: (user?.role === 'admin' || user?.role === 'super_admin') && activeTab === 'customers',
  })
  const pendingCustomers: any[] = pendingCustomersData || []

  const isAdminOrSuper = user?.role === 'admin' || user?.role === 'super_admin'
  const canEditExisting = isAdminOrSuper && !isMasterTabReadOnly // non-admins can add but not edit existing records; view-only tab access also blocks edits
  // Customers (pilot): users with 'modify' access can also edit existing records.
  // Admins write directly; non-admin edits are staged and routed through the pending-approval flow.
  // Deletes remain admin-only (no pending flow for deletes yet).
  const canEditActiveTab = !isMasterTabReadOnly

  const { data: pendingDepotsData, refetch: refetchPendingDepots } = useQuery({ queryKey: ['pending-depots'], queryFn: async () => { const res = await depotApi.getPending(); return res.success ? (res.data as any[]) : [] }, enabled: isAdminOrSuper && activeTab === 'depots' })
  const { data: pendingBrokersData, refetch: refetchPendingBrokers } = useQuery({ queryKey: ['pending-brokers'], queryFn: async () => { const res = await brokerApi.getPending(); return res.success ? (res.data as any[]) : [] }, enabled: isAdminOrSuper && activeTab === 'brokers' })
  const { data: pendingSalespersonsData, refetch: refetchPendingSalespersons } = useQuery({ queryKey: ['pending-salespersons'], queryFn: async () => { const res = await salespersonApi.getPending(); return res.success ? (res.data as any[]) : [] }, enabled: isAdminOrSuper && activeTab === 'salespersons' })
  const { data: pendingLedgerGroupsData, refetch: refetchPendingLedgerGroups } = useQuery({ queryKey: ['pending-ledger-groups'], queryFn: async () => { const res = await ledgerGroupApi.getPending(); return res.success ? (res.data as any[]) : [] }, enabled: isAdminOrSuper && activeTab === 'ledger_groups' })
  const { data: pendingStockGroupsData, refetch: refetchPendingStockGroups } = useQuery({ queryKey: ['pending-stock-groups'], queryFn: async () => { const res = await stockGroupApi.getPending(); return res.success ? (res.data as any[]) : [] }, enabled: isAdminOrSuper && activeTab === 'stock_groups' })
  const { data: pendingUnitsData, refetch: refetchPendingUnits } = useQuery({ queryKey: ['pending-units'], queryFn: async () => { const res = await unitApi.getPending(); return res.success ? (res.data as any[]) : [] }, enabled: isAdminOrSuper && activeTab === 'units' })
  const { data: pendingRawMaterialsData, refetch: refetchPendingRawMaterials } = useQuery({ queryKey: ['pending-raw-materials'], queryFn: async () => { const res = await rawMaterialApi.getPending(); return res.success ? (res.data as any[]) : [] }, enabled: isAdminOrSuper && activeTab === 'raw_materials' })
  const { data: pendingSemiFinishedGoodsData, refetch: refetchPendingSemiFinishedGoods } = useQuery({ queryKey: ['pending-semi-finished-goods'], queryFn: async () => { const res = await semiFinishedGoodApi.getPending(); return res.success ? (res.data as any[]) : [] }, enabled: isAdminOrSuper && activeTab === 'semi_finished_goods' })
  const { data: pendingSkuData, refetch: refetchPendingSku } = useQuery({ queryKey: ['pending-sku-details'], queryFn: async () => { const res = await skuDetailsApi.getPending(); return res.success ? (res.data as any[]) : [] }, enabled: isAdminOrSuper && activeTab === 'sku_details' })
  const { data: pendingVehiclesData, refetch: refetchPendingVehicles } = useQuery({ queryKey: ['pending-vehicles'], queryFn: async () => { const res = await vehicleMasterApi.getPending(); return res.success ? (res.data as any[]) : [] }, enabled: isAdminOrSuper && activeTab === 'vehicle_master' })
  const { data: pendingDriversData, refetch: refetchPendingDrivers } = useQuery({ queryKey: ['pending-drivers'], queryFn: async () => { const res = await driverMasterApi.getPending(); return res.success ? (res.data as any[]) : [] }, enabled: isAdminOrSuper && activeTab === 'driver_master' })
  const { data: pendingTransportData, refetch: refetchPendingTransport } = useQuery({ queryKey: ['pending-transport'], queryFn: async () => { const res = await transportMasterApi.getPending(); return res.success ? (res.data as any[]) : [] }, enabled: isAdminOrSuper && activeTab === 'transport_master' })

  const pendingDepots: any[] = pendingDepotsData || []
  const pendingBrokers: any[] = pendingBrokersData || []
  const pendingSalespersons: any[] = pendingSalespersonsData || []
  const pendingLedgerGroups: any[] = pendingLedgerGroupsData || []
  const pendingStockGroups: any[] = pendingStockGroupsData || []
  const pendingUnits: any[] = pendingUnitsData || []
  const pendingRawMaterials: any[] = pendingRawMaterialsData || []
  const pendingSemiFinishedGoods: any[] = pendingSemiFinishedGoodsData || []
  const { data: pendingInsuranceDetailsData, refetch: refetchPendingInsuranceDetails } = useQuery({ queryKey: ['pending-insurance-details'], queryFn: async () => { const res = await insuranceDetailApi.getPending(); return res.success ? (res.data as any[]) : [] }, enabled: isAdminOrSuper && activeTab === 'insurance_details' })
  const pendingInsuranceDetails: any[] = pendingInsuranceDetailsData || []
  const { data: pendingConversionFormulasData, refetch: refetchPendingConversionFormulas } = useQuery({ queryKey: ['pending-conversion-formulas'], queryFn: async () => { const res = await conversionFormulaApi.getPending(); return res.success ? (res.data as any[]) : [] }, enabled: isAdminOrSuper && activeTab === 'conversion_formulas' })
  const pendingConversionFormulas: any[] = pendingConversionFormulasData || []
  const { data: pendingPriceLevelsData, refetch: refetchPendingPriceLevels } = useQuery({ queryKey: ['pending-price-levels'], queryFn: async () => { const res = await priceLevelApi.getPending(); return res.success ? (res.data as any[]) : [] }, enabled: isAdminOrSuper && activeTab === 'price_levels' })
  const pendingPriceLevels: any[] = pendingPriceLevelsData || []
  const { data: pendingPetrolPumpsData, refetch: refetchPendingPetrolPumps } = useQuery({ queryKey: ['pending-petrol-pumps'], queryFn: async () => { const res = await petrolPumpApi.getPending(); return res.success ? (res.data as any[]) : [] }, enabled: isAdminOrSuper && activeTab === 'petrol_pumps' })
  const pendingPetrolPumps: any[] = pendingPetrolPumpsData || []
  const { data: pendingCdRulesData, refetch: refetchPendingCdRules } = useQuery({ queryKey: ['pending-cd-rules'], queryFn: async () => { const res = await cdRuleApi.getPending(); return res.success ? (res.data as any[]) : [] }, enabled: isAdminOrSuper && activeTab === 'cd_rules' })
  const pendingCdRules: any[] = pendingCdRulesData || []
  const { data: pendingTdsRulesData, refetch: refetchPendingTdsRules } = useQuery({ queryKey: ['pending-tds-rules'], queryFn: async () => { const res = await tdsRuleApi.getPending(); return res.success ? (res.data as any[]) : [] }, enabled: isAdminOrSuper && activeTab === 'tds_rules' })
  const pendingTdsRules: any[] = pendingTdsRulesData || []
  const { data: pendingBhadaRatesData, refetch: refetchPendingBhadaRates } = useQuery({ queryKey: ['pending-bhada-rates'], queryFn: async () => { const res = await bhadaRateApi.getPending(); return res.success ? (res.data as any[]) : [] }, enabled: isAdminOrSuper && activeTab === 'bhada_rates' })
  const pendingBhadaRates: any[] = pendingBhadaRatesData || []

  // Lightweight, unpaginated Ledger Group list for the "Ledger Group" picker on
  // Customer/Broker/Salesperson/Transporter forms (Phase 8) - independent of the
  // Ledger Groups tab's own paginated/search-filtered list above.
  const { data: ledgerGroupOptionsData } = useQuery({
    queryKey: ['ledger-group-options'],
    queryFn: async () => {
      const res = await ledgerGroupApi.getAll({ all: 'true' })
      return res.success ? (res.data?.ledger_groups || []) : []
    },
  })
  const ledgerGroupOptions: any[] = ledgerGroupOptionsData || []

  // Lightweight, unpaginated Customers list for the selector on Insurance Details form
  const { data: customerOptionsData } = useQuery({
    queryKey: ['customer-options'],
    queryFn: async () => {
      const res = await customerApi.getAll({ all: 'true' })
      return res.success ? (res.data?.customers || []) : []
    },
    staleTime: 5 * 60 * 1000,
  })
  const customerOptions = useMemo(() => customerOptionsData || [], [customerOptionsData])


  // Lightweight, unpaginated Units / Ledgers lists for the pickers on the
  // Raw Materials form (Phase 16) - independent of those tabs' own
  // paginated/search-filtered lists.
  const { data: unitOptionsData } = useQuery({
    queryKey: ['unit-options'],
    queryFn: async () => {
      const res = await unitApi.getAll({ all: 'true' })
      return res.success ? (res.data?.units || []) : []
    },
  })
  const unitOptions: any[] = unitOptionsData || []

  const { data: ledgerOptionsData } = useQuery({
    queryKey: ['ledger-options'],
    queryFn: async () => {
      const res = await ledgerApi.getAll({ all: 'true' })
      return res.success ? (res.data?.ledgers || []) : []
    },
  })
  const ledgerOptions: any[] = ledgerOptionsData || []

  // Lightweight, unpaginated Semi-Finished Goods list for the Finished Goods
  // (SKU) form's SFG-link picker (Phase 18) - independent of the SFG tab's
  // own paginated/search-filtered list.
  const { data: semiFinishedGoodOptionsData } = useQuery({
    queryKey: ['semi-finished-good-options'],
    queryFn: async () => {
      const res = await semiFinishedGoodApi.getAll({ all: 'true' })
      return res.success ? (res.data?.semi_finished_goods || []) : []
    },
  })
  const semiFinishedGoodOptions: any[] = semiFinishedGoodOptionsData || []

  // Lightweight, unpaginated Stock Group list for the picker on the Raw
  // Materials / Semi-Finished Goods forms (Phase 17 - also retrofit onto
  // Raw Materials, see that schema's stockGroupId comment).
  const { data: stockGroupOptionsData } = useQuery({
    queryKey: ['stock-group-options'],
    queryFn: async () => {
      const res = await stockGroupApi.getAll({ all: 'true' })
      return res.success ? (res.data?.stock_groups || []) : []
    },
  })
  const stockGroupOptions: any[] = stockGroupOptionsData || []

  // Lightweight, unpaginated Transporter list for the multi-transporter
  // tagging checklist on the Vehicle form (Phase 13) - independent of the
  // Transporters tab's own paginated/search-filtered list.
  const { data: transporterOptionsData } = useQuery({
    queryKey: ['transporter-options'],
    queryFn: async () => {
      const res = await transportMasterApi.getAll({ all: 'true' })
      return res.success ? (res.data?.transporters || []) : []
    },
  })
  const transporterOptions: any[] = transporterOptionsData || []

  // Lightweight, unpaginated Broker/Salesperson lists for the combined
  // "Salesman / Broker Name" checklist on the Depot form (Phase 9).
  const { data: brokerOptionsData } = useQuery({
    queryKey: ['broker-options'],
    queryFn: async () => {
      const res = await brokerApi.getAll({ all: 'true' })
      return res.success ? (res.data?.brokers || []) : []
    },
  })
  const brokerOptions: any[] = brokerOptionsData || []

  const { data: salespersonOptionsData } = useQuery({
    queryKey: ['salesperson-options'],
    queryFn: async () => {
      const res = await salespersonApi.getAll({ all: 'true' })
      return res.success ? (res.data?.salespersons || []) : []
    },
  })
  const salespersonOptions: any[] = salespersonOptionsData || []

  // Lightweight, unpaginated Finished Goods (skus) list for the item pickers
  // on Conversion Formula / Price Levels forms (Phase 20a/20b).
  const { data: skuOptionsData } = useQuery({
    queryKey: ['sku-options'],
    queryFn: async () => {
      const res = await skuDetailsApi.getAll({ all: 'true' })
      return res.success ? (res.data?.skuDetails || []) : []
    },
  })
  const skuOptions: any[] = skuOptionsData || []

  // RTO Code Reference Data options for the Vehicle form's rto_id picker (Phase 13).
  const { data: rtoCodeData } = useQuery({
    queryKey: ["lookup-rto_code"],
    queryFn: async () => {
      const res = await lookupApi.getAll('rto_code', { page: 1, limit: 1000, all: "true" })
      return res.success ? (res.data.items || []).map((item: any) => ({ ...item, id: item.id ?? item.lookup_id })) : []
    },
    staleTime: 5 * 60 * 1000,
  })
  const activeRtoCodes = useMemo(() => (rtoCodeData || []).filter((r: any) => r.status === 'Active'), [rtoCodeData])

  // GST Rate / HSN Code / SAC Code dropdown options for Raw Materials (Phase
  // 16) - same Reference Data pattern as the UQC dropdown above.
  const { data: gstRateData } = useQuery({
    queryKey: ["lookup-gst_rate"],
    queryFn: async () => {
      const res = await lookupApi.getAll('gst_rate', { page: 1, limit: 1000, all: "true" })
      return res.success ? (res.data.items || []).map((item: any) => ({ ...item, id: item.id ?? item.lookup_id })) : []
    },
    staleTime: 5 * 60 * 1000,
  })
  const activeGstRates = useMemo(() => (gstRateData || []).filter((r: any) => r.status === 'Active'), [gstRateData])

  const { data: hsnCodeData } = useQuery({
    queryKey: ["lookup-hsn_code"],
    queryFn: async () => {
      const res = await lookupApi.getAll('hsn_code', { page: 1, limit: 1000, all: "true" })
      return res.success ? (res.data.items || []).map((item: any) => ({ ...item, id: item.id ?? item.lookup_id })) : []
    },
    staleTime: 5 * 60 * 1000,
  })
  const activeHsnCodes = useMemo(() => (hsnCodeData || []).filter((r: any) => r.status === 'Active'), [hsnCodeData])

  const { data: sacCodeData } = useQuery({
    queryKey: ["lookup-sac_code"],
    queryFn: async () => {
      const res = await lookupApi.getAll('sac_code', { page: 1, limit: 1000, all: "true" })
      return res.success ? (res.data.items || []).map((item: any) => ({ ...item, id: item.id ?? item.lookup_id })) : []
    },
    staleTime: 5 * 60 * 1000,
  })
  const activeSacCodes = useMemo(() => (sacCodeData || []).filter((r: any) => r.status === 'Active'), [sacCodeData])

  // Stock Category Reference Data options for the CD (Cash Discount) Rule
  // form's stock_category_id picker (Phase 22) - same Reference Data pattern
  // as GST Rate/HSN/SAC above.
  const { data: stockCategoryData } = useQuery({
    queryKey: ["lookup-stock_category"],
    queryFn: async () => {
      const res = await lookupApi.getAll('stock_category', { page: 1, limit: 1000, all: "true" })
      return res.success ? (res.data.items || []).map((item: any) => ({ ...item, id: item.id ?? item.lookup_id })) : []
    },
    staleTime: 5 * 60 * 1000,
  })
  const activeStockCategories = useMemo(() => (stockCategoryData || []).filter((r: any) => r.status === 'Active'), [stockCategoryData])

  // Oil Type / UQC Reference Data options for the Finished Goods (SKU) form
  // (Phase 18 + Phase 3 fold-in) - same Reference Data pattern as above.
  const { data: oilTypeData } = useQuery({
    queryKey: ["lookup-oil_type"],
    queryFn: async () => {
      const res = await lookupApi.getAll('oil_type', { page: 1, limit: 1000, all: "true" })
      return res.success ? (res.data.items || []).map((item: any) => ({ ...item, id: item.id ?? item.lookup_id })) : []
    },
    staleTime: 5 * 60 * 1000,
  })
  const activeOilTypes = useMemo(() => (oilTypeData || []).filter((r: any) => r.status === 'Active'), [oilTypeData])

  const { data: uqcData } = useQuery({
    queryKey: ["lookup-uqc"],
    queryFn: async () => {
      const res = await lookupApi.getAll('uqc', { page: 1, limit: 1000, all: "true" })
      return res.success ? (res.data.items || []).map((item: any) => ({ ...item, id: item.id ?? item.lookup_id })) : []
    },
    staleTime: 5 * 60 * 1000,
  })
  const activeUqcCodes = useMemo(() => (uqcData || []).filter((r: any) => r.status === 'Active'), [uqcData])
  const pendingSkus: any[] = pendingSkuData || []
  const pendingSkuSellingPrices: any[] = []
  const pendingVehicles: any[] = pendingVehiclesData || []
  const pendingDrivers: any[] = pendingDriversData || []
  const pendingTransporters: any[] = pendingTransportData || []

  // Depots
  const {
    data: depotData,
    fetchNextPage: fetchNextDepot,
    hasNextPage: hasNextDepot,
    isFetchingNextPage: isFetchingNextDepot,
    isLoading: isDepotLoading,
    refetch: refetchDepot,
  } = useInfiniteQuery({
    queryKey: ["master-depots", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await depotApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" })
      return res.success ? res.data : { depots: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.depots?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  // All active depots for SKU form (not filtered by searchTerm)
  const { data: allActiveDepotsData } = useQuery({
    queryKey: ["all-active-depots"],
    queryFn: async () => {
      const res = await depotApi.getAll({ page: 1, limit: 1000, all: "true" })
      return res.success ? (res.data.depots || []) : []
    },
    staleTime: 5 * 60 * 1000,
  })
  const activeDepots = useMemo(
    () => (allActiveDepotsData || []).filter((d: Depot) => d.status === 'Active'),
    [allActiveDepotsData]
  )
  // "Belongs to Which Godown" options - sourced from all active Depot records
  const godownDepots = useMemo(
    () => activeDepots,
    [activeDepots]
  )

  // States list - always fetched (backs dropdowns everywhere)
  const {
    data: statesData,
    isLoading: isStatesLoading,
    refetch: refetchStates,
  } = useQuery({
    queryKey: ["master-states"],
    queryFn: async () => {
      const res = await stateApi.getAll({ page: 1, limit: 1000, all: "true" })
      return res.success ? (res.data.states || []) : []
    },
  })
  const states = useMemo(() => statesData || [], [statesData])
  const activeStates = useMemo(() => states.filter((s: any) => s.status === 'Active'), [states])

  const { data: districtsData } = useQuery({
    queryKey: ["master-districts"],
    queryFn: async () => {
      const res = await districtApi.getAll({ page: 1, limit: 1000, all: "true" })
      return res.success ? (res.data.districts || []) : []
    }
  })
  const activeDistricts = useMemo(() => (districtsData || []).filter((d: any) => d.status === 'Active'), [districtsData])

  const { data: subDistrictsData } = useQuery({
    queryKey: ["master-sub_districts"],
    queryFn: async () => {
      const res = await subDistrictApi.getAll({ page: 1, limit: 1000, all: "true" })
      return res.success ? (res.data.sub_districts || res.data.subDistricts || []) : []
    }
  })
  const activeSubDistricts = useMemo(() => (subDistrictsData || []).filter((sd: any) => sd.status === 'Active'), [subDistrictsData])



  // GST Registration Status/Type dropdown options - sourced from Reference Data
  // (simple_lookups), never hardcoded, same pattern as activeStates above.
  const { data: gstRegStatusData } = useQuery({
    queryKey: ["lookup-is_gst_registered"],
    queryFn: async () => {
      const res = await lookupApi.getAll('is_gst_registered', { page: 1, limit: 1000, all: "true" })
      return res.success ? (res.data.items || []) : []
    },
    staleTime: 5 * 60 * 1000,
  })
  const activeGstRegStatuses = useMemo(
    () => (gstRegStatusData || []).filter((r: any) => r.status === 'Active'),
    [gstRegStatusData]
  )
  const { data: gstRegTypeData } = useQuery({
    queryKey: ["lookup-gst_registration_type"],
    queryFn: async () => {
      const res = await lookupApi.getAll('gst_registration_type', { page: 1, limit: 1000, all: "true" })
      return res.success ? (res.data.items || []) : []
    },
    staleTime: 5 * 60 * 1000,
  })
  const activeGstRegTypes = useMemo(
    () => (gstRegTypeData || []).filter((r: any) => r.status === 'Active'),
    [gstRegTypeData]
  )

  // MSME Registration Type / FSSAI Licence Type dropdown options - same
  // Reference Data pattern as the GST dropdowns above.
  const { data: msmeRegTypeData } = useQuery({
    queryKey: ["lookup-msme_registration_type"],
    queryFn: async () => {
      const res = await lookupApi.getAll('msme_registration_type', { page: 1, limit: 1000, all: "true" })
      return res.success ? (res.data.items || []) : []
    },
    staleTime: 5 * 60 * 1000,
  })
  const activeMsmeRegTypes = useMemo(() => {
    const filtered = (msmeRegTypeData || []).filter((r: any) => r.status === 'Active')
    const orderMap: Record<string, number> = { "Micro": 1, "Small": 2, "Medium": 3 }
    return filtered.sort((a: any, b: any) => (orderMap[a.name] || 99) - (orderMap[b.name] || 99))
  }, [msmeRegTypeData])
  const { data: fssaiLicenceTypeData } = useQuery({
    queryKey: ["lookup-fssai_licence_type"],
    queryFn: async () => {
      const res = await lookupApi.getAll('fssai_licence_type', { page: 1, limit: 1000, all: "true" })
      return res.success ? (res.data.items || []) : []
    },
    staleTime: 5 * 60 * 1000,
  })
  const activeFssaiLicenceTypes = useMemo(
    () => (fssaiLicenceTypeData || []).filter((r: any) => r.status === 'Active'),
    [fssaiLicenceTypeData]
  )

  // Bank Name dropdown options - Reference Data only, free text is deliberately
  // not allowed (same pattern as every other Reference-Data-sourced dropdown).
  const { data: bankNameData } = useQuery({
    queryKey: ["lookup-bank_name"],
    queryFn: async () => { const res = await lookupApi.getAll('bank_name', { page: 1, limit: 1000, all: "true" }); return res.success ? (res.data.items || []) : [] },
    staleTime: 5 * 60 * 1000,
  })
  const activeBankNames = useMemo(() => (bankNameData || []).filter((r: any) => r.status === 'Active'), [bankNameData])







  // All active transporters for Vehicle form (not filtered by searchTerm)
  const { data: allActiveTransportersData } = useQuery({
    queryKey: ["all-active-transporters"],
    queryFn: async () => {
      const res = await transportMasterApi.getAll({ page: 1, limit: 1000, all: "true" })
      return res.success ? (res.data.transporters || []) : []
    },
    staleTime: 5 * 60 * 1000,
  })
  const activeTransporters = useMemo(
    () => (allActiveTransportersData || []).filter((t: any) => t.status === 'Active'),
    [allActiveTransportersData]
  )
  const sortedVehicleTransporters = useMemo<string[]>(
    () => {
      const names: string[] = (activeTransporters || [])
        .map((t: any) => t.transporter_name?.trim())
        .filter((name: any): name is string => typeof name === "string" && name.length > 0)

      const sorted = Array.from(new Set<string>(names)).sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base", numeric: true })
      )

      // Always offer the two built-in options at the top, ahead of the transporter
      // master list (matches the Transporter dropdown on the Actual Dispatch stage).
      const builtIns = ["Company Vehicle", "Party Vehicle"]
      const rest = sorted.filter((n) => !builtIns.includes(n))
      return [...builtIns, ...rest]
    },
    [activeTransporters]
  )

  // Brokers
  const {
    data: brokerData,
    fetchNextPage: fetchNextBroker,
    hasNextPage: hasNextBroker,
    isFetchingNextPage: isFetchingNextBroker,
    isLoading: isBrokerLoading,
    refetch: refetchBroker,
  } = useInfiniteQuery({
    queryKey: ["master-brokers", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await brokerApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" })
      return res.success ? res.data : { brokers: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.brokers?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  // Salespersons
  const {
    data: salespersonData,
    fetchNextPage: fetchNextSalesperson,
    hasNextPage: hasNextSalesperson,
    isFetchingNextPage: isFetchingNextSalesperson,
    isLoading: isSalespersonLoading,
    refetch: refetchSalesperson,
  } = useInfiniteQuery({
    queryKey: ["master-salespersons", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await salespersonApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" })
      return res.success ? res.data : { salespersons: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.salespersons?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  // Ledger Groups
  const {
    data: ledgerGroupData,
    fetchNextPage: fetchNextLedgerGroup,
    hasNextPage: hasNextLedgerGroup,
    isFetchingNextPage: isFetchingNextLedgerGroup,
    isLoading: isLedgerGroupLoading,
    refetch: refetchLedgerGroup,
  } = useInfiniteQuery({
    queryKey: ["master-ledger-groups", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await ledgerGroupApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" })
      return res.success ? res.data : { ledger_groups: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.ledger_groups?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  // Stock Groups
  const {
    data: stockGroupData,
    fetchNextPage: fetchNextStockGroup,
    hasNextPage: hasNextStockGroup,
    isFetchingNextPage: isFetchingNextStockGroup,
    isLoading: isStockGroupLoading,
    refetch: refetchStockGroup,
  } = useInfiniteQuery({
    queryKey: ["master-stock-groups", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await stockGroupApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" })
      return res.success ? res.data : { stock_groups: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.stock_groups?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  // Units
  const {
    data: unitData,
    fetchNextPage: fetchNextUnit,
    hasNextPage: hasNextUnit,
    isFetchingNextPage: isFetchingNextUnit,
    isLoading: isUnitLoading,
    refetch: refetchUnit,
  } = useInfiniteQuery({
    queryKey: ["master-units", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await unitApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" })
      return res.success ? res.data : { units: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.units?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  // Raw Materials
  const {
    data: rawMaterialData,
    fetchNextPage: fetchNextRawMaterial,
    hasNextPage: hasNextRawMaterial,
    isFetchingNextPage: isFetchingNextRawMaterial,
    isLoading: isRawMaterialLoading,
    refetch: refetchRawMaterial,
  } = useInfiniteQuery({
    queryKey: ["master-raw-materials", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await rawMaterialApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" })
      return res.success ? res.data : { raw_materials: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.raw_materials?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  // Semi-Finished Goods
  const {
    data: semiFinishedGoodData,
    fetchNextPage: fetchNextSemiFinishedGood,
    hasNextPage: hasNextSemiFinishedGood,
    isFetchingNextPage: isFetchingNextSemiFinishedGood,
    isLoading: isSemiFinishedGoodLoading,
    refetch: refetchSemiFinishedGood,
  } = useInfiniteQuery({
    queryKey: ["master-semi-finished-goods", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await semiFinishedGoodApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" })
      return res.success ? res.data : { semi_finished_goods: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.semi_finished_goods?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  // Insurance Details
  const {
    data: insuranceDetailData,
    fetchNextPage: fetchNextInsuranceDetail,
    hasNextPage: hasNextInsuranceDetail,
    isFetchingNextPage: isFetchingNextInsuranceDetail,
    isLoading: isInsuranceDetailLoading,
    refetch: refetchInsuranceDetail,
  } = useInfiniteQuery({
    queryKey: ["master-insurance-details", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await insuranceDetailApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" })
      return res.success ? res.data : { insurance_details: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.insurance_details?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  // Conversion Formulas
  const {
    data: conversionFormulaData,
    fetchNextPage: fetchNextConversionFormula,
    hasNextPage: hasNextConversionFormula,
    isFetchingNextPage: isFetchingNextConversionFormula,
    isLoading: isConversionFormulaLoading,
    refetch: refetchConversionFormula,
  } = useInfiniteQuery({
    queryKey: ["master-conversion-formulas", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await conversionFormulaApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" })
      return res.success ? res.data : { conversion_formulas: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.conversion_formulas?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  // Price Levels
  const {
    data: priceLevelData,
    fetchNextPage: fetchNextPriceLevel,
    hasNextPage: hasNextPriceLevel,
    isFetchingNextPage: isFetchingNextPriceLevel,
    isLoading: isPriceLevelLoading,
    refetch: refetchPriceLevel,
  } = useInfiniteQuery({
    queryKey: ["master-price-levels", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await priceLevelApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" })
      return res.success ? res.data : { price_levels: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.price_levels?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  // Petrol Pumps
  const {
    data: petrolPumpData,
    fetchNextPage: fetchNextPetrolPump,
    hasNextPage: hasNextPetrolPump,
    isFetchingNextPage: isFetchingNextPetrolPump,
    isLoading: isPetrolPumpLoading,
    refetch: refetchPetrolPump,
  } = useInfiniteQuery({
    queryKey: ["master-petrol-pumps", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await petrolPumpApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" })
      return res.success ? res.data : { petrol_pumps: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.petrol_pumps?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  // CD (Cash Discount) Rules
  const {
    data: cdRuleData,
    fetchNextPage: fetchNextCdRule,
    hasNextPage: hasNextCdRule,
    isFetchingNextPage: isFetchingNextCdRule,
    isLoading: isCdRuleLoading,
    refetch: refetchCdRule,
  } = useInfiniteQuery({
    queryKey: ["master-cd-rules", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await cdRuleApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" })
      return res.success ? res.data : { cd_rules: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.cd_rules?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  // TDS Rules (Phase 23 - bare-minimum placeholder)
  const {
    data: tdsRuleData,
    fetchNextPage: fetchNextTdsRule,
    hasNextPage: hasNextTdsRule,
    isFetchingNextPage: isFetchingNextTdsRule,
    isLoading: isTdsRuleLoading,
    refetch: refetchTdsRule,
  } = useInfiniteQuery({
    queryKey: ["master-tds-rules", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await tdsRuleApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" })
      return res.success ? res.data : { tds_rules: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.tds_rules?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  // Bhada Rates (Phase 24 - bare-minimum placeholder)
  const {
    data: bhadaRateData,
    fetchNextPage: fetchNextBhadaRate,
    hasNextPage: hasNextBhadaRate,
    isFetchingNextPage: isFetchingNextBhadaRate,
    isLoading: isBhadaRateLoading,
    refetch: refetchBhadaRate,
  } = useInfiniteQuery({
    queryKey: ["master-bhada-rates", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await bhadaRateApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" })
      return res.success ? res.data : { bhada_rates: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.bhada_rates?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  // SKU Details
  const {
    data: skuData,
    fetchNextPage: fetchNextSku,
    hasNextPage: hasNextSku,
    isFetchingNextPage: isFetchingNextSku,
    isLoading: isSkuLoading,
    refetch: refetchSku,
  } = useInfiniteQuery({
    queryKey: ["master-sku-details", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await skuDetailsApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" })
      return res.success ? res.data : { skuDetails: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.skuDetails?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  // SKU Selling Price
  const {
    data: skuSellingPriceData,
    fetchNextPage: fetchNextSkuSellingPrice,
    hasNextPage: hasNextSkuSellingPrice,
    isFetchingNextPage: isFetchingNextSkuSellingPrice,
    isLoading: isSkuSellingPriceLoading,
    refetch: refetchSkuSellingPrice,
  } = useInfiniteQuery({
    queryKey: ["master-sku-selling-price", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await skuSellingPriceApi.getAll({ page: pageParam, limit: 20, search: searchTerm })
      return res.success ? res.data : { skus: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.skus?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  // 7. Driver Data (Infinite Query)
  const {
    data: driverData,
    fetchNextPage: fetchNextDriver,
    hasNextPage: hasNextDriver,
    isFetchingNextPage: isFetchingNextDriver,
    isLoading: isDriverLoading,
    refetch: refetchDriver,
  } = useInfiniteQuery({
    queryKey: ["master-drivers", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await driverMasterApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" })
      return res.success ? res.data : { drivers: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.drivers?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  // 8. Transport Data (Infinite Query)
  const {
    data: transportData,
    fetchNextPage: fetchNextTransport,
    hasNextPage: hasNextTransport,
    isFetchingNextPage: isFetchingNextTransport,
    isLoading: isTransportLoading,
    refetch: refetchTransport,
  } = useInfiniteQuery({
    queryKey: ["master-transporters", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await transportMasterApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" })
      return res.success ? res.data : { transporters: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.transporters?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  const [latestVarCalc, setLatestVarCalc] = useState<any>(null)

  // Memoized data lists
  const customers = useMemo(() => customerData?.pages.flatMap(p => p?.customers || []) || [], [customerData])
  const depots = useMemo(() => depotData?.pages.flatMap(p => p?.depots || []) || [], [depotData])
  const brokers = useMemo(() => brokerData?.pages.flatMap(p => p?.brokers || []) || [], [brokerData])
  const salespersons = useMemo(() => salespersonData?.pages.flatMap(p => p?.salespersons || []) || [], [salespersonData])
  const ledgerGroupsList = useMemo(() => ledgerGroupData?.pages.flatMap(p => p?.ledger_groups || []) || [], [ledgerGroupData])
  const stockGroupsList = useMemo(() => stockGroupData?.pages.flatMap(p => p?.stock_groups || []) || [], [stockGroupData])
  const unitsList = useMemo(() => unitData?.pages.flatMap(p => p?.units || []) || [], [unitData])
  const rawMaterialsList = useMemo(() => rawMaterialData?.pages.flatMap(p => p?.raw_materials || []) || [], [rawMaterialData])
  const semiFinishedGoodsList = useMemo(() => semiFinishedGoodData?.pages.flatMap(p => p?.semi_finished_goods || []) || [], [semiFinishedGoodData])
  const insuranceDetailsList = useMemo(() => insuranceDetailData?.pages.flatMap(p => p?.insurance_details || []) || [], [insuranceDetailData])
  const conversionFormulasList = useMemo(() => conversionFormulaData?.pages.flatMap(p => p?.conversion_formulas || []) || [], [conversionFormulaData])
  const priceLevelsList = useMemo(() => priceLevelData?.pages.flatMap(p => p?.price_levels || []) || [], [priceLevelData])
  const petrolPumpsList = useMemo(() => petrolPumpData?.pages.flatMap(p => p?.petrol_pumps || []) || [], [petrolPumpData])
  const cdRulesList = useMemo(() => cdRuleData?.pages.flatMap(p => p?.cd_rules || []) || [], [cdRuleData])
  const tdsRulesList = useMemo(() => tdsRuleData?.pages.flatMap(p => p?.tds_rules || []) || [], [tdsRuleData])
  const bhadaRatesList = useMemo(() => bhadaRateData?.pages.flatMap(p => p?.bhada_rates || []) || [], [bhadaRateData])
  const transporters = useMemo(() => transportData?.pages.flatMap(p => p?.transporters || []) || [], [transportData])
  const skuDetails = useMemo(() => skuData?.pages.flatMap(p => p?.skuDetails || []) || [], [skuData])
  const skuSellingPrices = useMemo(() => skuSellingPriceData?.pages.flatMap(p => p?.skus || []) || [], [skuSellingPriceData])
  const drivers = useMemo(() => driverData?.pages.flatMap(p => p?.drivers || []) || [], [driverData])

  // Infinite Scroll Observers
  useEffect(() => { if (customerInView && hasNextCustomer && !isFetchingNextCustomer) fetchNextCustomer() }, [customerInView, hasNextCustomer, isFetchingNextCustomer, fetchNextCustomer])
  useEffect(() => { if (depotInView && hasNextDepot && !isFetchingNextDepot) fetchNextDepot() }, [depotInView, hasNextDepot, isFetchingNextDepot, fetchNextDepot])
  useEffect(() => { if (brokerInView && hasNextBroker && !isFetchingNextBroker) fetchNextBroker() }, [brokerInView, hasNextBroker, isFetchingNextBroker, fetchNextBroker])
  useEffect(() => { if (salespersonInView && hasNextSalesperson && !isFetchingNextSalesperson) fetchNextSalesperson() }, [salespersonInView, hasNextSalesperson, isFetchingNextSalesperson, fetchNextSalesperson])
  useEffect(() => { if (ledgerGroupInView && hasNextLedgerGroup && !isFetchingNextLedgerGroup) fetchNextLedgerGroup() }, [ledgerGroupInView, hasNextLedgerGroup, isFetchingNextLedgerGroup, fetchNextLedgerGroup])
  useEffect(() => { if (stockGroupInView && hasNextStockGroup && !isFetchingNextStockGroup) fetchNextStockGroup() }, [stockGroupInView, hasNextStockGroup, isFetchingNextStockGroup, fetchNextStockGroup])
  useEffect(() => { if (unitInView && hasNextUnit && !isFetchingNextUnit) fetchNextUnit() }, [unitInView, hasNextUnit, isFetchingNextUnit, fetchNextUnit])
  useEffect(() => { if (rawMaterialInView && hasNextRawMaterial && !isFetchingNextRawMaterial) fetchNextRawMaterial() }, [rawMaterialInView, hasNextRawMaterial, isFetchingNextRawMaterial, fetchNextRawMaterial])
  useEffect(() => { if (semiFinishedGoodInView && hasNextSemiFinishedGood && !isFetchingNextSemiFinishedGood) fetchNextSemiFinishedGood() }, [semiFinishedGoodInView, hasNextSemiFinishedGood, isFetchingNextSemiFinishedGood, fetchNextSemiFinishedGood])
  useEffect(() => { if (insuranceDetailInView && hasNextInsuranceDetail && !isFetchingNextInsuranceDetail) fetchNextInsuranceDetail() }, [insuranceDetailInView, hasNextInsuranceDetail, isFetchingNextInsuranceDetail, fetchNextInsuranceDetail])
  useEffect(() => { if (conversionFormulaInView && hasNextConversionFormula && !isFetchingNextConversionFormula) fetchNextConversionFormula() }, [conversionFormulaInView, hasNextConversionFormula, isFetchingNextConversionFormula, fetchNextConversionFormula])
  useEffect(() => { if (priceLevelInView && hasNextPriceLevel && !isFetchingNextPriceLevel) fetchNextPriceLevel() }, [priceLevelInView, hasNextPriceLevel, isFetchingNextPriceLevel, fetchNextPriceLevel])
  useEffect(() => { if (petrolPumpInView && hasNextPetrolPump && !isFetchingNextPetrolPump) fetchNextPetrolPump() }, [petrolPumpInView, hasNextPetrolPump, isFetchingNextPetrolPump, fetchNextPetrolPump])
  useEffect(() => { if (cdRuleInView && hasNextCdRule && !isFetchingNextCdRule) fetchNextCdRule() }, [cdRuleInView, hasNextCdRule, isFetchingNextCdRule, fetchNextCdRule])
  useEffect(() => { if (tdsRuleInView && hasNextTdsRule && !isFetchingNextTdsRule) fetchNextTdsRule() }, [tdsRuleInView, hasNextTdsRule, isFetchingNextTdsRule, fetchNextTdsRule])
  useEffect(() => { if (bhadaRateInView && hasNextBhadaRate && !isFetchingNextBhadaRate) fetchNextBhadaRate() }, [bhadaRateInView, hasNextBhadaRate, isFetchingNextBhadaRate, fetchNextBhadaRate])
  useEffect(() => { if (skuInView && hasNextSku && !isFetchingNextSku) fetchNextSku() }, [skuInView, hasNextSku, isFetchingNextSku, fetchNextSku])
  useEffect(() => { if (skuSellingPriceInView && hasNextSkuSellingPrice && !isFetchingNextSkuSellingPrice) fetchNextSkuSellingPrice() }, [skuSellingPriceInView, hasNextSkuSellingPrice, isFetchingNextSkuSellingPrice, fetchNextSkuSellingPrice])

  // 7. Vehicle Data (Infinite Query)
  const {
    data: vehicleData,
    fetchNextPage: fetchNextVehicle,
    hasNextPage: hasNextVehicle,
    isFetchingNextPage: isFetchingNextVehicle,
    isLoading: isVehicleLoading,
    refetch: refetchVehicle,
  } = useInfiniteQuery({
    queryKey: ["vehicle_master", searchTerm],
    queryFn: ({ pageParam = 1 }) => vehicleMasterApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" }),
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.data?.vehicles?.length || 0), 0)
      return currentCount < (lastPage.data?.pagination?.total || 0) ? allPages.length + 1 : undefined
    },
    initialPageParam: 1,
  })

  const vehicles = useMemo(() => vehicleData?.pages.flatMap(p => p.data.vehicles) || [], [vehicleData])

  const uniqueVehicleTypes = useMemo(() => {
    const types = vehicles
      .map((v: any) => v?.vehicle_type?.trim())
      .filter((type: string): type is string => Boolean(type))
    return Array.from(new Set(types)).sort()
  }, [vehicles])

  useEffect(() => {
    if (vehicleInView && hasNextVehicle && !isFetchingNextVehicle) fetchNextVehicle()
  }, [vehicleInView, hasNextVehicle, isFetchingNextVehicle, fetchNextVehicle])

  useEffect(() => {
    if (driverInView && hasNextDriver && !isFetchingNextDriver) fetchNextDriver()
  }, [driverInView, hasNextDriver, isFetchingNextDriver, fetchNextDriver])

  useEffect(() => {
    if (transportInView && hasNextTransport && !isFetchingNextTransport) fetchNextTransport()
  }, [transportInView, hasNextTransport, isFetchingNextTransport, fetchNextTransport])

  const isLoading = isCustomerLoading || isDepotLoading || isBrokerLoading || isSalespersonLoading || isSkuLoading || isSkuSellingPriceLoading || isVehicleLoading || isDriverLoading || isTransportLoading || isLedgerGroupLoading || isStockGroupLoading || isUnitLoading || isRawMaterialLoading || isSemiFinishedGoodLoading || isInsuranceDetailLoading || isConversionFormulaLoading || isPriceLevelLoading || isPetrolPumpLoading || isCdRuleLoading || isTdsRuleLoading || isBhadaRateLoading

  // Sort states
  const [customerSort, setCustomerSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'customer_id', dir: 'asc' })
  const [depotSort, setDepotSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'depot_id', dir: 'asc' })
  const [brokerSort, setBrokerSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'broker_id', dir: 'asc' })
  const [salespersonSort, setSalespersonSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'broker_id', dir: 'asc' })
  const [vehicleSort, setVehicleSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'vehicle_master_id', dir: 'asc' })
  const [selectedVehicleType, setSelectedVehicleType] = useState<string>("all")
  const [roadTaxType, setRoadTaxType] = useState<'expiry' | 'lifetime'>('expiry')
  const [skuSort, setSkuSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'sku_code', dir: 'asc' })
  const [skuSellingPriceSort, setSkuSellingPriceSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'packing_material', dir: 'asc' })
  const [driverSort, setDriverSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'driver_master_id', dir: 'asc' })
  const [transportSort, setTransportSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'transport_master_id', dir: 'asc' })
  const [ledgerGroupSort, setLedgerGroupSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'group_code', dir: 'asc' })
  const [stockGroupSort, setStockGroupSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'group_code', dir: 'asc' })
  const [unitSort, setUnitSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'unit_code', dir: 'asc' })
  const [rawMaterialSort, setRawMaterialSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'raw_material_code', dir: 'asc' })
  const [semiFinishedGoodSort, setSemiFinishedGoodSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'semi_finished_good_code', dir: 'asc' })
  const [insuranceDetailSort, setInsuranceDetailSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'insurance_code', dir: 'asc' })
  const [conversionFormulaSort, setConversionFormulaSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'conversion_formula_code', dir: 'asc' })
  const [priceLevelSort, setPriceLevelSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'effective_date', dir: 'desc' })
  const [petrolPumpSort, setPetrolPumpSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'petrol_pump_code', dir: 'asc' })
  const [cdRuleSort, setCdRuleSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'cd_rule_code', dir: 'asc' })
  const [tdsRuleSort, setTdsRuleSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'tds_rule_code', dir: 'asc' })
    const [oilTagSort, setOilTagSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'name', dir: 'asc' })
  const [bhadaRateSort, setBhadaRateSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'bhada_rate_code', dir: 'asc' })



  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any | null>(null)
  const [deletingItem, setDeletingItem] = useState<any | null>(null)
  const [customerEffectiveDatesSection, setCustomerEffectiveDatesSection] = useState<'basic' | 'mailing' | 'gst' | 'msme' | 'fssai' | 'godown' | 'bank' | 'ledger' | 'documents' | null>(null)
  const [customerEffectiveDatesTargetField, setCustomerEffectiveDatesTargetField] = useState<string | null>(null)
  const [pendingFieldChangeConfirm, setPendingFieldChangeConfirm] = useState<{
    fieldName: string
    section: 'basic' | 'mailing' | 'gst' | 'msme' | 'fssai' | 'godown' | 'bank' | 'ledger' | 'documents'
    applyChange: () => void
  } | null>(null)

  const handleCustomerFieldChangeAttempt = (
    fieldName: string,
    section: 'basic' | 'mailing' | 'gst' | 'msme' | 'fssai' | 'godown' | 'bank' | 'ledger' | 'documents',
    applyChange: () => void
  ) => {
    if (editingItem?.id) {
      setPendingFieldChangeConfirm({
        fieldName,
        section,
        applyChange,
      })
    } else {
      applyChange()
    }
  }

  // --- SKU (Finished Goods) field change trigger + audit trail ---
  // Mirrors the Customer Master flow exactly: attempting to change a field on an
  // existing record shows a confirm dialog, and confirming redirects to the
  // Effective Dates manager for that section (no inline apply) - the new value
  // and W.E.F. date are set there, which is what actually applies + logs the change.
  const [skuEffectiveDatesSection, setSkuEffectiveDatesSection] = useState<'basic' | 'uom' | 'weights' | 'tax' | 'depots' | null>(null)
  const [skuEffectiveDatesTargetField, setSkuEffectiveDatesTargetField] = useState<string | null>(null)
  const [pendingSkuFieldChangeConfirm, setPendingSkuFieldChangeConfirm] = useState<{
    fieldName: string
    section: 'basic' | 'uom' | 'weights' | 'tax' | 'depots'
    applyChange: () => void
  } | null>(null)
  const [skuHistorySection, setSkuHistorySection] = useState<'basic' | 'uom' | 'weights' | 'tax' | 'depots'>('basic')
  const [skuHistoryModalOpen, setSkuHistoryModalOpen] = useState(false)

  const handleSkuFieldChangeAttempt = (
    fieldName: string,
    section: 'basic' | 'uom' | 'weights' | 'tax' | 'depots',
    applyChange: () => void
  ) => {
    if (editingItem?.id) {
      setPendingSkuFieldChangeConfirm({ fieldName, section, applyChange })
    } else {
      applyChange()
    }
  }

  // --- Price Level field change trigger + audit trail (mirrors Customer/SKU) ---
  const [priceLevelEffectiveDatesSection, setPriceLevelEffectiveDatesSection] = useState<'header' | 'items' | null>(null)
  const [priceLevelEffectiveDatesTargetField, setPriceLevelEffectiveDatesTargetField] = useState<string | null>(null)
  const [pendingPriceLevelFieldChangeConfirm, setPendingPriceLevelFieldChangeConfirm] = useState<{
    fieldName: string
    section: 'header' | 'items'
    applyChange: () => void
  } | null>(null)

  const handlePriceLevelFieldChangeAttempt = (
    fieldName: string,
    section: 'header' | 'items',
    applyChange: () => void
  ) => {
    if (editingItem?.id) {
      setPendingPriceLevelFieldChangeConfirm({ fieldName, section, applyChange })
    } else {
      applyChange()
    }
  }

  // --- SKU Selling Price ("Pricing") field change trigger + audit trail ---
  // This form has no natural sub-sections, so it's a single flat section.
  const [skuSellingPriceEffectiveDatesOpen, setSkuSellingPriceEffectiveDatesOpen] = useState(false)
  const [skuSellingPriceTargetField, setSkuSellingPriceTargetField] = useState<string | null>(null)
  const [pendingSkuSellingPriceFieldChangeConfirm, setPendingSkuSellingPriceFieldChangeConfirm] = useState<{
    fieldName: string
    section: string
    applyChange: () => void
  } | null>(null)

  const handleSkuSellingPriceFieldChangeAttempt = (fieldName: string, applyChange: () => void) => {
    if (editingItem?.id) {
      setPendingSkuSellingPriceFieldChangeConfirm({ fieldName, section: 'pricing', applyChange })
    } else {
      applyChange()
    }
  }

  // --- Vehicle Master field change trigger + audit trail (mirrors Customer/SKU/Price Level) ---
  const [vehicleEffectiveDatesSection, setVehicleEffectiveDatesSection] = useState<'basic' | 'weights' | 'tax_compliance' | 'permits' | 'gps' | 'documents' | null>(null)
  const [vehicleEffectiveDatesTargetField, setVehicleEffectiveDatesTargetField] = useState<string | null>(null)
  const [pendingVehicleFieldChangeConfirm, setPendingVehicleFieldChangeConfirm] = useState<{
    fieldName: string
    section: 'basic' | 'weights' | 'tax_compliance' | 'permits' | 'gps' | 'documents'
    applyChange: () => void
  } | null>(null)

  const handleVehicleFieldChangeAttempt = (
    fieldName: string,
    section: 'basic' | 'weights' | 'tax_compliance' | 'permits' | 'gps' | 'documents',
    applyChange: () => void
  ) => {
    if (editingItem?.id) {
      setPendingVehicleFieldChangeConfirm({ fieldName, section, applyChange })
    } else {
      applyChange()
    }
  }

  // --- Driver Master field change trigger + audit trail (mirrors Vehicle Master) ---
  const [driverEffectiveDatesSection, setDriverEffectiveDatesSection] = useState<'basic' | 'license_rto' | 'identity_address' | null>(null)
  const [driverEffectiveDatesTargetField, setDriverEffectiveDatesTargetField] = useState<string | null>(null)
  const [pendingDriverFieldChangeConfirm, setPendingDriverFieldChangeConfirm] = useState<{
    fieldName: string
    section: 'basic' | 'license_rto' | 'identity_address'
    applyChange: () => void
  } | null>(null)

  const handleDriverFieldChangeAttempt = (
    fieldName: string,
    section: 'basic' | 'license_rto' | 'identity_address',
    applyChange: () => void
  ) => {
    if (editingItem?.id) {
      setPendingDriverFieldChangeConfirm({ fieldName, section, applyChange })
    } else {
      applyChange()
    }
  }

  // --- Transport Master field change trigger + audit trail (mirrors Vehicle/Driver Master) ---
  const [transportEffectiveDatesSection, setTransportEffectiveDatesSection] = useState<'basic' | 'gst' | 'msme' | 'fssai' | 'documents' | null>(null)
  const [transportEffectiveDatesTargetField, setTransportEffectiveDatesTargetField] = useState<string | null>(null)
  const [pendingTransportFieldChangeConfirm, setPendingTransportFieldChangeConfirm] = useState<{
    fieldName: string
    section: 'basic' | 'gst' | 'msme' | 'fssai' | 'documents'
    applyChange: () => void
  } | null>(null)

  const handleTransportFieldChangeAttempt = (
    fieldName: string,
    section: 'basic' | 'gst' | 'msme' | 'fssai' | 'documents',
    applyChange: () => void
  ) => {
    if (editingItem?.id) {
      setPendingTransportFieldChangeConfirm({ fieldName, section, applyChange })
    } else {
      applyChange()
    }
  }

  // --- Ledger Group field change trigger + audit trail (single-section, mirrors SKU Selling Price/Pricing) ---
  const [ledgerGroupEffectiveDatesOpen, setLedgerGroupEffectiveDatesOpen] = useState(false)
  const [ledgerGroupTargetField, setLedgerGroupTargetField] = useState<string | null>(null)
  const [pendingLedgerGroupFieldChangeConfirm, setPendingLedgerGroupFieldChangeConfirm] = useState<{
    fieldName: string
    section: string
    applyChange: () => void
  } | null>(null)

  const handleLedgerGroupFieldChangeAttempt = (fieldName: string, applyChange: () => void) => {
    if (editingItem?.id) {
      setPendingLedgerGroupFieldChangeConfirm({ fieldName, section: 'basic', applyChange })
    } else {
      applyChange()
    }
  }

  // --- Stock Group field change trigger + audit trail (single-section, mirrors Ledger Group Master) ---
  const [stockGroupEffectiveDatesOpen, setStockGroupEffectiveDatesOpen] = useState(false)
  const [stockGroupTargetField, setStockGroupTargetField] = useState<string | null>(null)
  const [pendingStockGroupFieldChangeConfirm, setPendingStockGroupFieldChangeConfirm] = useState<{
    fieldName: string
    section: string
    applyChange: () => void
  } | null>(null)

  const handleStockGroupFieldChangeAttempt = (fieldName: string, applyChange: () => void) => {
    if (editingItem?.id) {
      setPendingStockGroupFieldChangeConfirm({ fieldName, section: 'basic', applyChange })
    } else {
      applyChange()
    }
  }

  // --- Depot field change trigger + audit trail (mirrors Vehicle/Driver/Transport Master) ---
  const [depotEffectiveDatesSection, setDepotEffectiveDatesSection] = useState<'basic' | 'tags' | 'documents' | null>(null)
  const [depotEffectiveDatesTargetField, setDepotEffectiveDatesTargetField] = useState<string | null>(null)
  const [pendingDepotFieldChangeConfirm, setPendingDepotFieldChangeConfirm] = useState<{
    fieldName: string
    section: 'basic' | 'tags' | 'documents'
    applyChange: () => void
  } | null>(null)

  const handleDepotFieldChangeAttempt = (
    fieldName: string,
    section: 'basic' | 'tags' | 'documents',
    applyChange: () => void
  ) => {
    if (editingItem?.id) {
      setPendingDepotFieldChangeConfirm({ fieldName, section, applyChange })
    } else {
      applyChange()
    }
  }

  // --- Broker field change trigger + audit trail (mirrors Vehicle/Driver/Transport Master) ---
  const [brokerEffectiveDatesSection, setBrokerEffectiveDatesSection] = useState<'basic' | 'gst' | 'msme' | 'fssai' | 'documents' | null>(null)
  const [brokerEffectiveDatesTargetField, setBrokerEffectiveDatesTargetField] = useState<string | null>(null)
  const [pendingBrokerFieldChangeConfirm, setPendingBrokerFieldChangeConfirm] = useState<{
    fieldName: string
    section: 'basic' | 'gst' | 'msme' | 'fssai' | 'documents'
    applyChange: () => void
  } | null>(null)

  const handleBrokerFieldChangeAttempt = (
    fieldName: string,
    section: 'basic' | 'gst' | 'msme' | 'fssai' | 'documents',
    applyChange: () => void
  ) => {
    if (editingItem?.id) {
      setPendingBrokerFieldChangeConfirm({ fieldName, section, applyChange })
    } else {
      applyChange()
    }
  }

  // --- Salesperson field change trigger + audit trail (mirrors Vehicle/Driver/Transport Master) ---
  const [salespersonEffectiveDatesSection, setSalespersonEffectiveDatesSection] = useState<'basic' | 'gst' | 'msme' | 'fssai' | 'documents' | null>(null)
  const [salespersonEffectiveDatesTargetField, setSalespersonEffectiveDatesTargetField] = useState<string | null>(null)
  const [pendingSalespersonFieldChangeConfirm, setPendingSalespersonFieldChangeConfirm] = useState<{
    fieldName: string
    section: 'basic' | 'gst' | 'msme' | 'fssai' | 'documents'
    applyChange: () => void
  } | null>(null)

  const handleSalespersonFieldChangeAttempt = (
    fieldName: string,
    section: 'basic' | 'gst' | 'msme' | 'fssai' | 'documents',
    applyChange: () => void
  ) => {
    if (editingItem?.id) {
      setPendingSalespersonFieldChangeConfirm({ fieldName, section, applyChange })
    } else {
      applyChange()
    }
  }

  // --- Petrol Pump field change trigger + audit trail (mirrors Broker/Salesperson Master) ---
  const [petrolPumpEffectiveDatesSection, setPetrolPumpEffectiveDatesSection] = useState<'basic' | 'gst' | 'msme' | 'fssai' | 'documents' | null>(null)
  const [petrolPumpEffectiveDatesTargetField, setPetrolPumpEffectiveDatesTargetField] = useState<string | null>(null)
  const [pendingPetrolPumpFieldChangeConfirm, setPendingPetrolPumpFieldChangeConfirm] = useState<{
    fieldName: string
    section: 'basic' | 'gst' | 'msme' | 'fssai' | 'documents'
    applyChange: () => void
  } | null>(null)

  const handlePetrolPumpFieldChangeAttempt = (
    fieldName: string,
    section: 'basic' | 'gst' | 'msme' | 'fssai' | 'documents',
    applyChange: () => void
  ) => {
    if (editingItem?.id) {
      setPendingPetrolPumpFieldChangeConfirm({ fieldName, section, applyChange })
    } else {
      applyChange()
    }
  }

  // --- Unit field change trigger + audit trail (single-section, mirrors Ledger/Stock Group Master) ---
  const [unitEffectiveDatesOpen, setUnitEffectiveDatesOpen] = useState(false)
  const [unitTargetField, setUnitTargetField] = useState<string | null>(null)
  const [pendingUnitFieldChangeConfirm, setPendingUnitFieldChangeConfirm] = useState<{
    fieldName: string
    section: string
    applyChange: () => void
  } | null>(null)

  const handleUnitFieldChangeAttempt = (fieldName: string, applyChange: () => void) => {
    if (editingItem?.id) {
      setPendingUnitFieldChangeConfirm({ fieldName, section: 'basic', applyChange })
    } else {
      applyChange()
    }
  }

  // --- Raw Material field change trigger + audit trail (mirrors Vehicle/Driver/Transport Master) ---
  const [rawMaterialEffectiveDatesSection, setRawMaterialEffectiveDatesSection] = useState<'basic' | 'tax_compliance' | 'accounting' | null>(null)
  const [rawMaterialEffectiveDatesTargetField, setRawMaterialEffectiveDatesTargetField] = useState<string | null>(null)
  const [pendingRawMaterialFieldChangeConfirm, setPendingRawMaterialFieldChangeConfirm] = useState<{
    fieldName: string
    section: 'basic' | 'tax_compliance' | 'accounting'
    applyChange: () => void
  } | null>(null)

  const handleRawMaterialFieldChangeAttempt = (
    fieldName: string,
    section: 'basic' | 'tax_compliance' | 'accounting',
    applyChange: () => void
  ) => {
    if (editingItem?.id) {
      setPendingRawMaterialFieldChangeConfirm({ fieldName, section, applyChange })
    } else {
      applyChange()
    }
  }

  // --- Semi-Finished Good field change trigger + audit trail (mirrors Raw Material Master) ---
  const [semiFinishedGoodEffectiveDatesSection, setSemiFinishedGoodEffectiveDatesSection] = useState<'basic' | 'weight_conversion' | 'tax_compliance' | 'accounting' | null>(null)
  const [semiFinishedGoodEffectiveDatesTargetField, setSemiFinishedGoodEffectiveDatesTargetField] = useState<string | null>(null)
  const [pendingSemiFinishedGoodFieldChangeConfirm, setPendingSemiFinishedGoodFieldChangeConfirm] = useState<{
    fieldName: string
    section: 'basic' | 'weight_conversion' | 'tax_compliance' | 'accounting'
    applyChange: () => void
  } | null>(null)

  const handleSemiFinishedGoodFieldChangeAttempt = (
    fieldName: string,
    section: 'basic' | 'weight_conversion' | 'tax_compliance' | 'accounting',
    applyChange: () => void
  ) => {
    if (editingItem?.id) {
      setPendingSemiFinishedGoodFieldChangeConfirm({ fieldName, section, applyChange })
    } else {
      applyChange()
    }
  }

  // --- Insurance Detail field change trigger + audit trail (single-section, mirrors Ledger/Stock Group Master) ---
  const [insuranceDetailEffectiveDatesOpen, setInsuranceDetailEffectiveDatesOpen] = useState(false)
  const [insuranceDetailTargetField, setInsuranceDetailTargetField] = useState<string | null>(null)
  const [pendingInsuranceDetailFieldChangeConfirm, setPendingInsuranceDetailFieldChangeConfirm] = useState<{
    fieldName: string
    section: string
    applyChange: () => void
  } | null>(null)

  const handleInsuranceDetailFieldChangeAttempt = (fieldName: string, applyChange: () => void) => {
    if (editingItem?.id) {
      setPendingInsuranceDetailFieldChangeConfirm({ fieldName, section: 'basic', applyChange })
    } else {
      applyChange()
    }
  }

  // --- Conversion Formula field change trigger + audit trail (single-section, mirrors Ledger/Stock Group Master) ---
  const [conversionFormulaEffectiveDatesOpen, setConversionFormulaEffectiveDatesOpen] = useState(false)
  const [conversionFormulaTargetField, setConversionFormulaTargetField] = useState<string | null>(null)
  const [pendingConversionFormulaFieldChangeConfirm, setPendingConversionFormulaFieldChangeConfirm] = useState<{
    fieldName: string
    section: string
    applyChange: () => void
  } | null>(null)

  const handleConversionFormulaFieldChangeAttempt = (fieldName: string, applyChange: () => void) => {
    if (editingItem?.id) {
      setPendingConversionFormulaFieldChangeConfirm({ fieldName, section: 'basic', applyChange })
    } else {
      applyChange()
    }
  }

  // --- Cash Discount (CD Rule) field change trigger + audit trail (single-section, mirrors Insurance Detail/Conversion Formula Master) ---
  const [cdRuleEffectiveDatesOpen, setCdRuleEffectiveDatesOpen] = useState(false)
  const [cdRuleTargetField, setCdRuleTargetField] = useState<string | null>(null)
  const [pendingCdRuleFieldChangeConfirm, setPendingCdRuleFieldChangeConfirm] = useState<{
    fieldName: string
    section: string
    applyChange: () => void
  } | null>(null)

  const handleCdRuleFieldChangeAttempt = (fieldName: string, applyChange: () => void) => {
    if (editingItem?.id) {
      setPendingCdRuleFieldChangeConfirm({ fieldName, section: 'basic', applyChange })
    } else {
      applyChange()
    }
  }

  // --- TDS Rule field change trigger + audit trail ---
  const [tdsRuleEffectiveDatesOpen, setTdsRuleEffectiveDatesOpen] = useState(false)
  const [tdsRuleTargetField, setTdsRuleTargetField] = useState<string | null>(null)
  const [pendingTdsRuleFieldChangeConfirm, setPendingTdsRuleFieldChangeConfirm] = useState<{
    fieldName: string
    section: string
    applyChange: () => void
  } | null>(null)

  const handleTdsRuleFieldChangeAttempt = (fieldName: string, applyChange: () => void) => {
    if (editingItem?.id) {
      setPendingTdsRuleFieldChangeConfirm({ fieldName, section: 'basic', applyChange })
    } else {
      applyChange()
    }
  }

  // --- Oil Tag field change trigger + audit trail ---
  const [oilTagEffectiveDatesOpen, setOilTagEffectiveDatesOpen] = useState(false)
  const [oilTagTargetField, setOilTagTargetField] = useState<string | null>(null)
  const [pendingOilTagFieldChangeConfirm, setPendingOilTagFieldChangeConfirm] = useState<{
    fieldName: string
    section: string
    applyChange: () => void
  } | null>(null)

  const handleOilTagFieldChangeAttempt = (fieldName: string, applyChange: () => void) => {
    if (editingItem?.id) {
      setPendingOilTagFieldChangeConfirm({ fieldName, section: 'basic', applyChange })
    } else {
      applyChange()
    }
  }

  // --- Bhada Rate field change trigger + audit trail ---
  const [bhadaRateEffectiveDatesOpen, setBhadaRateEffectiveDatesOpen] = useState(false)
  const [bhadaRateTargetField, setBhadaRateTargetField] = useState<string | null>(null)
  const [pendingBhadaRateFieldChangeConfirm, setPendingBhadaRateFieldChangeConfirm] = useState<{
    fieldName: string
    section: string
    applyChange: () => void
  } | null>(null)

  const handleBhadaRateFieldChangeAttempt = (fieldName: string, applyChange: () => void) => {
    if (editingItem?.id) {
      setPendingBhadaRateFieldChangeConfirm({ fieldName, section: 'basic', applyChange })
    } else {
      applyChange()
    }
  }

  const [showAuditTrailView, setShowAuditTrailView] = useState<boolean>(false)
  const [customerSubTab, setCustomerSubTab] = useState<'active' | 'pending'>('active')
  const [depotSubTab, setDepotSubTab] = useState<'active' | 'pending'>('active')
  const [brokerSubTab, setBrokerSubTab] = useState<'active' | 'pending'>('active')
  const [salespersonSubTab, setSalespersonSubTab] = useState<'active' | 'pending'>('active')
  const [ledgerGroupSubTab, setLedgerGroupSubTab] = useState<'active' | 'pending'>('active')
  const [stockGroupSubTab, setStockGroupSubTab] = useState<'active' | 'pending'>('active')
  const [unitSubTab, setUnitSubTab] = useState<'active' | 'pending'>('active')
  const [rawMaterialSubTab, setRawMaterialSubTab] = useState<'active' | 'pending'>('active')
  const [semiFinishedGoodSubTab, setSemiFinishedGoodSubTab] = useState<'active' | 'pending'>('active')
  const [insuranceDetailSubTab, setInsuranceDetailSubTab] = useState<'active' | 'pending'>('active')
  const [conversionFormulaSubTab, setConversionFormulaSubTab] = useState<'active' | 'pending'>('active')
  const [priceLevelSubTab, setPriceLevelSubTab] = useState<'active' | 'pending'>('active')
  const [petrolPumpSubTab, setPetrolPumpSubTab] = useState<'active' | 'pending'>('active')
  const [cdRuleSubTab, setCdRuleSubTab] = useState<'active' | 'pending'>('active')
  const [tdsRuleSubTab, setTdsRuleSubTab] = useState<'active' | 'pending'>('active')
  const [bhadaRateSubTab, setBhadaRateSubTab] = useState<'active' | 'pending'>('active')
  const [skuSubTab, setSkuSubTab] = useState<'active' | 'pending'>('active')
  const [skuSellingPriceSubTab, setSkuSellingPriceSubTab] = useState<'active' | 'pending'>('active')
  const [vehicleSubTab, setVehicleSubTab] = useState<'active' | 'pending'>('active')
  const [driverSubTab, setDriverSubTab] = useState<'active' | 'pending'>('active')
  const [transportSubTab, setTransportSubTab] = useState<'active' | 'pending'>('active')

  const [rejectDialogContext, setRejectDialogContext] = useState<{ tab: string; id: any } | null>(null)
  const [rejectionReason, setRejectionReason] = useState("")
  const [isReviewing, setIsReviewing] = useState(false)
  const [approvalReviewModal, setApprovalReviewModal] = useState<{ tab: string; item: any } | null>(null)
  const [approvalEditData, setApprovalEditData] = useState<Record<string, any>>({})

  // Generic inline "quick add" popover for Select fields (UOM, Additional
  // UOM, Default Accounting Ledger on the Raw Materials form) - lets the
  // user create a Unit/Ledger without leaving the current dialog.
  const [quickAddDialog, setQuickAddDialog] = useState<{ type: 'unit' | 'ledger' | 'hsn_code' | 'sac_code'; onCreated: (id: number, label: string) => void } | null>(null)
  const [quickAddForm, setQuickAddForm] = useState<any>({})
  const [isQuickAdding, setIsQuickAdding] = useState(false)

  // Inline "add row" inputs for the Raw Materials form's repeatable
  // Additional UOM list (rawMaterialForm.additional_uoms) - not part of that
  // form state itself since it's just the pending entry being composed.
  const [newAdditionalUom, setNewAdditionalUom] = useState<{ uom_id: string; conversion_ratio: string }>({ uom_id: '', conversion_ratio: '' })
  // Additional UOM card starts collapsed (behind an "+ Add Additional UOM"
  // button) unless the record already has rows - a raw material with none is
  // a fully valid save, this is purely a reveal toggle.
  const [showAdditionalUomSection, setShowAdditionalUomSection] = useState(false)

  // Inline "add row" inputs for the Conversion Formula form's repeatable
  // steps list and the Price Levels form's repeatable items list - same
  // pattern as newAdditionalUom.
  const [newFormulaStep, setNewFormulaStep] = useState<{ operation: string; operand_type: string; operand_value: string }>({ operation: 'subtract', operand_type: 'literal', operand_value: '' })
  const [newPriceLevelItem, setNewPriceLevelItem] = useState<{ sku_id: string; price: string }>({ sku_id: '', price: '' })

  const openQuickAdd = async (type: 'unit' | 'ledger' | 'hsn_code' | 'sac_code', onCreated: (id: number, label: string) => void) => {
    if (type === 'hsn_code' || type === 'sac_code') {
      setQuickAddForm({ code: '', name: '', status: 'Active' })
    } else {
      const nextId = await fetchNextId(type)
      setQuickAddForm(
        type === 'unit'
          ? { unit_code: nextId, unit_name: '', status: 'Active' }
          : { ledger_code: nextId, ledger_name: '', ledger_group_id: '', status: 'Active' }
      )
    }
    setQuickAddDialog({ type, onCreated })
  }

  const submitQuickAdd = async () => {
    if (!quickAddDialog) return
    if (quickAddDialog.type === 'unit' && !quickAddForm.unit_name?.trim()) {
      toast({ title: "Error", description: "Unit Name is required", variant: "destructive" })
      return
    }
    if (quickAddDialog.type === 'ledger' && !quickAddForm.ledger_name?.trim()) {
      toast({ title: "Error", description: "Ledger Name is required", variant: "destructive" })
      return
    }
    if (quickAddDialog.type === 'sac_code') {
      if (!/^[0-9]{6}$/.test(String(quickAddForm.code || '').trim())) {
        toast({ title: "Error", description: "SAC Code must be exactly 6 numeric digits (e.g. 996511)", variant: "destructive" })
        return
      }
      if (!quickAddForm.name?.trim()) {
        toast({ title: "Error", description: "Description is required", variant: "destructive" })
        return
      }
    }
    if (quickAddDialog.type === 'hsn_code') {
      if (!/^[0-9]{8}$/.test(String(quickAddForm.code || '').trim())) {
        toast({ title: "Error", description: "HSN Code must be exactly 8 numeric digits (e.g. 73269099)", variant: "destructive" })
        return
      }
      if (!quickAddForm.name?.trim()) {
        toast({ title: "Error", description: "Description is required", variant: "destructive" })
        return
      }
    }
    setIsQuickAdding(true)
    try {
      const res = quickAddDialog.type === 'unit'
        ? await unitApi.create(quickAddForm)
        : quickAddDialog.type === 'ledger'
        ? await ledgerApi.create(quickAddForm)
        : await lookupApi.create(quickAddDialog.type, quickAddForm)
      if (res?.success) {
        const created = res.data
        const label = quickAddDialog.type === 'unit' ? created.unit_name : quickAddDialog.type === 'ledger' ? created.ledger_name : created.name
        const queryKey = quickAddDialog.type === 'unit' ? ['unit-options'] : quickAddDialog.type === 'ledger' ? ['ledger-options'] : [`lookup-${quickAddDialog.type}`]
        // Patch the cache directly (rather than just invalidating) so the new
        // row's label renders immediately even if it's pending approval and
        // wouldn't otherwise pass the options query's approved-only filter.
        queryClient.setQueryData(queryKey, (old: any[] | undefined) => [...(old || []), created])
        toast({ title: "Success", description: res.message || "Created successfully" })
        quickAddDialog.onCreated(created.id, label)
        setQuickAddDialog(null)
      } else {
        toast({ title: "Error", description: res?.message || "Failed to create", variant: "destructive" })
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to create", variant: "destructive" })
    } finally {
      setIsQuickAdding(false)
    }
  }

  // Read-only edit history for the customer currently open in the Add/Edit dialog
  // (only meaningful for an existing customer, i.e. editingItem is set).
  const { data: customerEditHistoryData } = useQuery({
    queryKey: ["customer-edit-history", editingItem?.id],
    queryFn: async () => {
      const res = await customerApi.getGstHistory(editingItem.id) // Endpoint repurposed on backend to return general edit history
      return res.success ? (res.data || []) : []
    },
    enabled: activeTab === 'customers' && (isDialogOpen || !!approvalReviewModal) && !!editingItem?.id,
  })

  // Form states
  const [customerForm, setCustomerForm] = useState<Partial<Customer>>({
    customer_id: "",
    customer_name: "",
    status: "Active",
    contact_person: "",
    contact: "",
    email: "",
    address_line_1: "",
    address_line_2: "",
    state: "",
    pincode: "",
    pan: "",
    gstin: "",
    gst_registered: "",
    gst_registration_type: "",
    gst_registration_wef: "",
    msme_registration_no: "",
    msme_registration_type: "",
    msme_registration_wef: "",
    fssai_no: "",
    fssai_valid_upto: "",
    fssai_licence_type: "",
    aadhaar_upload: "",
    pan_upload: "",
    gst_certificate_upload: "",
    msme_certificate_upload: "",
    fssai_certificate_upload: "",
    addresses: [],
    godown_ids: [],
    is_required_for_commitment: "No",
    bank_accounts: [blankCustomerBankAccount()]
  })

  const [depotForm, setDepotForm] = useState<Partial<Depot>>({
    depot_id: "",
    status: "Active",
    depot_name: "",
    depot_address: "",
    state: "",
    salesman_broker_name: "",
    agent_tags: [],
    agreement_paper_upload: "",
    depot_owner_gst_certificate_upload: "",
    pan_card_upload: "",
    aadhaar_card_upload: "",
  })


  const [brokerForm, setBrokerForm] = useState<Partial<Broker>>({
    broker_id: "",
    status: "Active",
    salesman_name: "",
    email_id: "",
    mobile_no: "",
    depot_name: "",
    depot_id: "",
    ledger_group_id: "",
    ...blankPartyParityFields(),
  })

  const [salespersonForm, setSalespersonForm] = useState<any>({
    broker_id: '',
    salesman_name: '',
    status: 'Active',
    mobile_no: '',
    email_id: '',
    ledger_group_id: '',
    employee_id: '',
    ...blankPartyParityFields(),
  })

  const [ledgerGroupForm, setLedgerGroupForm] = useState<any>({
    group_code: '',
    group_name: '',
    status: 'Active',
  })

  const [stockGroupForm, setStockGroupForm] = useState<any>({
    group_code: '',
    group_name: '',
    status: 'Active',
  })

  const [unitForm, setUnitForm] = useState<any>({
    unit_code: '',
    unit_name: '',
    status: 'Active',
  })

  const [rawMaterialForm, setRawMaterialForm] = useState<any>({
    raw_material_code: '',
    name: '',
    main_uom_id: '',
    stock_group_id: '',
    additional_uoms: [] as RawMaterialAdditionalUom[],
    type_of_supply: '',
    gst_rate_id: '',
    hsn_code_id: '',
    sac_code_id: '',
    default_accounting_ledger_id: '',
    batch_tracking_enabled: false,
    status: 'Active',
  })

  const [semiFinishedGoodForm, setSemiFinishedGoodForm] = useState<any>({
    semi_finished_good_code: '',
    name: '',
    main_uom_id: '',
    stock_group_id: '',
    type_of_supply: '',
    gst_rate_id: '',
    hsn_code_id: '',
    sac_code_id: '',
    default_accounting_ledger_id: '',
    batch_tracking_enabled: false,
    oil_filling_per_unit: '',
    filling_unit_id: '',
    converted_kg: '',
    packing_weight_per_main_unit: '',
    packing_weight_unit_id: '',
    weight_difference: '',
    standard_weight: '',
    standard_weight_unit_id: '',
    status: 'Active',
  })

  const [insuranceCustomerSearch, setInsuranceCustomerSearch] = useState("");
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [insuranceDetailForm, setInsuranceDetailForm] = useState<any>({
    insurance_code: '',
    status: 'Active',
    insurance_company_name: '',
    short_name: '',
    policy_number: '',
    valid_from: '',
    valid_upto: '',
    type_of_policy: '',
    sum_insured: '',
    owner_type: 'Company',
    customer_ids: [] as number[],
  })

  const [conversionFormulaForm, setConversionFormulaForm] = useState<any>({
    conversion_formula_code: '',
    base_item_id: '',
    child_item_id: '',
    status: 'Active',
    steps: [] as { step_order: number; operation: string; operand_type: string; operand_value: string }[],
  })

  const [priceLevelForm, setPriceLevelForm] = useState<any>({
    price_level_code: '',
    effective_date: '',
    status: 'Active',
    items: [] as { sku_id: string; price: string }[],
  })

  const [petrolPumpForm, setPetrolPumpForm] = useState<any>({
    petrol_pump_code: '',
    petrol_pump_name: '',
    email_id: '',
    mobile_no: '',
    ledger_group_id: '',
    status: 'Active',
    ...blankPartyParityFields(),
  })

  const [cdRuleForm, setCdRuleForm] = useState<any>({
    cd_rule_code: '',
    wef_date: '',
    stock_category_id: '',
    discount_rate_per_main_uom: '',
    payment_condition_days: '',
    status: 'Active',
  })

  
    const { data: oilTagsData, isLoading: isOilTagsLoading, refetch: refetchOilTag } = useQuery({
      queryKey: ["oil_tags", searchTerm],
      queryFn: async () => {
        const res = await oilTagApi.getAll({ page: 1, limit: 1000, search: searchTerm })
        return res.success ? (res.data.items || []) : []
      },
      enabled: activeTab === 'oil_tags',
    })
    const oilTagsList = useMemo(() => oilTagsData || [], [oilTagsData])

    const { data: pendingOilTagsData, refetch: refetchPendingOilTags } = useQuery({
      queryKey: ["oil_tags_pending"],
      queryFn: async () => {
        const res = await oilTagApi.getPending()
        return res.success ? (res.data.items || []) : []
      },
      enabled: activeTab === 'oil_tags',
    })
    const pendingOilTags = useMemo(() => pendingOilTagsData || [], [pendingOilTagsData])

    const sortedOilTags = useMemo(() => {
      let sortable = [...oilTagsList]
      if (oilTagSort.col) {
        sortable.sort((a, b) => {
          if (a[oilTagSort.col] < b[oilTagSort.col]) return oilTagSort.dir === 'asc' ? -1 : 1
          if (a[oilTagSort.col] > b[oilTagSort.col]) return oilTagSort.dir === 'asc' ? 1 : -1
          return 0
        })
      }
      return sortable
    }, [oilTagsList, oilTagSort])

    const [oilTagForm, setOilTagForm] = useState<any>({ name: "", status: "Active" })

    const [tdsRuleForm, setTdsRuleForm] = useState<any>({
    tds_rule_code: '',
    name: '',
    guiding_rule: '',
    threshold_limit: '',
    rate: '',
    applicable_amount_type: 'Amount Exceeding Threshold',
    wef_date: '',
    status: 'Active',
  })

  const [bhadaRateForm, setBhadaRateForm] = useState<any>({
    bhada_rate_code: '',
    name: '',
    rate: '',
    status: 'Active',
  })

  const [vehicleForm, setVehicleForm] = useState<any>({
    vehicle_master_id: '',
    registration_no: '',
    vehicle_type: '',
    transporter: '',
    rto: '',
    rto_id: '',
    additional_transporter_ids: [] as number[],
    gps_company: '',
    gps_api_tracking_link: '',
    gps_valid_upto: '',
    gps_type: '',
    gps_installed_by: '',
    status: 'Active',
    rc_image: '',
    road_tax: '',
    road_tax_image: '',
    pollution: '',
    pollution_image: '',
    insurance: '',
    insurance_image: '',
    fitness: '',
    fitness_image: '',
    state_permit: '',
    state_permit_image: '',
    state_permit_type: '',
    national_permit: '',
    national_permit_image: '',
    fuel_type: 'Diesel',
    gvw: '',
    ulw: '',
    passing: '',
    life_time_tax: '',
    life_time_tax_image: ''
  })
  const [vehicleFormErrors, setVehicleFormErrors] = useState<{ registration_no?: string; vehicle_type?: string; transporter?: string; state_permit_image?: string }>({})
  const [customerFormErrors, setCustomerFormErrors] = useState<{ pan?: string; gstin?: string; pincode?: string; contact?: string; email?: string }>({})
  // Shared PAN/GSTIN error state for the Broker/Salesperson/Transport/Petrol
  // Pump forms (Customer-Master field parity) - only one of these forms is
  // ever open at a time, so one error object covers all four.
  const [partyFormErrors, setPartyFormErrors] = useState<{ pan?: string; gstin?: string }>({})
  const [addressErrors, setAddressErrors] = useState<Record<number, string | undefined>>({})
  const [bankAccountErrors, setBankAccountErrors] = useState<Record<number, string | undefined>>({})

  const [driverForm, setDriverForm] = useState<Partial<Driver>>({
    driver_master_id: "",
    status: "Active",
    driving_licence_no: "",
    driving_licence_type: "",
    valid_upto: "",
    rto: "",
    rto_id: null,
    trans_valid_upto: "",
    lmv_valid_upto: "",
    driver_name: "",
    mobile_no: "",
    email_id: "",
    address_line1: "",
    state: "",
    pincode: "",
    aadhaar_no: "",
    pan_no: "",
    aadhaar_upload: "",
    dl_upload: ""
  })

  const [transportForm, setTransportForm] = useState<Partial<Transport>>({
    ...blankPartyParityFields(),
    transport_master_id: "",
    status: "Active",
    transporter_name: "",
    contact_person: "",
    contact_number: "",
    email_id: "",
    address_line1: "",
    state_id: null,
    pincode: "",
    ledger_group_id: "",
    bilty_copy_upload: "",
    linked_customer_id: "",
  })

  const [skuDetailsForm, setSkuDetailsForm] = useState<Partial<SkuDetail>>({
    status: "Active",
    sku_code: "",
    sku_name: "",
    main_uom: "",
    alternate_uom: "",
    nos_per_main_uom: "",
    units: "",
    oil_filling_per_unit: "",
    filling_units: "",
    converted_kg: "",
    packing_weight_per_main_unit: "",
    weight_difference: "",
    sku_weight: "",
    packing_weight: "",
    gross_weight: "",
    tag_name: "",
    semi_finished_good_id: "",
    oil_tag_id: "",
        oil_type_id: "",
    stock_category_id: "",
    main_uom_id: "",
    alternate_uom_id: "",
    type_of_supply: "",
    gst_rate_id: "",
    hsn_code_id: "",
    sac_code_id: "",
    uqc_id: "",
  })

  const [skuSellingPriceForm, setSkuSellingPrice] = useState<Partial<SkuSellingPrice>>({
    id: 0,
    packing_material: "",
    sku_weight: "",
    sku_unit: "",
    conversion_formula: "",
    sku_weight_in_gm: "",
    packing_material_weight_in_gm: "",
    net_oil_in_gm: "",
    packing_cost: "",
    var: "",
    landing_cost: "",
    selling_cost: "",
    margin: "",
    actual_margin: ""
  })

  // --- Data Fetching ---

  const fetchVarCalc = useCallback(async () => {
    try {
      const varRes = await varCalcApi.getLatest()
      if (varRes?.success && varRes?.data) {
        setLatestVarCalc(varRes.data)
      }
    } catch (e) {
      console.warn("Var calc fetch notice:", e)
    }
  }, [])

  useEffect(() => {
    if (activeTab === "sku_selling_price") fetchVarCalc()
  }, [activeTab, fetchVarCalc])

  // Live recalculation for SKU Selling Price: landing_cost -> selling_cost ->
  // actual_margin, driven by the latest var_calc rate. Direct edits to
  // landing_cost/selling_cost/actual_margin themselves bypass this (manual
  // override), matching the backend's "auto unless overridden" behavior.
  const recalculateSkuSellingPrice = useCallback((form: any) => ({
    ...form,
    ...calculateSkuSellingPriceDerived(form, parseFloat(latestVarCalc?.gt) || 0),
  }), [latestVarCalc])

  // --- Handlers ---

  const resetForms = () => {
    setCustomerEffectiveDatesSection(null)
    setSkuEffectiveDatesSection(null)
    setPriceLevelEffectiveDatesSection(null)
    setSkuSellingPriceEffectiveDatesOpen(false)
    setVehicleEffectiveDatesSection(null)
    setDriverEffectiveDatesSection(null)
    setTransportEffectiveDatesSection(null)
    setLedgerGroupEffectiveDatesOpen(false)
    setStockGroupEffectiveDatesOpen(false)
    setDepotEffectiveDatesSection(null)
    setBrokerEffectiveDatesSection(null)
    setPetrolPumpEffectiveDatesSection(null)
    setSalespersonEffectiveDatesSection(null)
    setUnitEffectiveDatesOpen(false)
    setRawMaterialEffectiveDatesSection(null)
    setSemiFinishedGoodEffectiveDatesSection(null)
    setInsuranceDetailEffectiveDatesOpen(false)
    setConversionFormulaEffectiveDatesOpen(false)
    setCdRuleEffectiveDatesOpen(false)
    setTdsRuleEffectiveDatesOpen(false)
    setOilTagEffectiveDatesOpen(false)
    setBhadaRateEffectiveDatesOpen(false)
    setSkuHistoryModalOpen(false)
    setShowAuditTrailView(false)
    setCustomerForm({
      customer_id: "",
      customer_name: "",
      status: "Active",
      contact_person: "",
      contact: "",
      email: "",
      address_line_1: "",
      address_line_2: "",
      state: "",
      pincode: "",
      pan: "",
      gstin: "",
      gst_registered: "",
      gst_registration_type: "",
      gst_registration_wef: "",
      msme_registration_no: "",
      msme_registration_type: "",
      msme_registration_wef: "",
      fssai_no: "",
      fssai_valid_upto: "",
      fssai_licence_type: "",
      aadhaar_upload: "",
      pan_upload: "",
      gst_certificate_upload: "",
      msme_certificate_upload: "",
      fssai_certificate_upload: "",
      addresses: [],
      godown_ids: [],
      is_required_for_commitment: "No",
      bank_accounts: [blankCustomerBankAccount()]
    })
    setAddressErrors({})
    setBankAccountErrors({})
    setDepotForm({
      depot_id: "",
      status: "Active",
      depot_name: "",
      depot_address: "",
      state: "",
      salesman_broker_name: "",
      agent_tags: [],
      agreement_paper_upload: "",
      depot_owner_gst_certificate_upload: "",
      pan_card_upload: "",
      aadhaar_card_upload: "",
    })
    setBrokerForm({
      broker_id: "",
      status: "Active",
      salesman_name: "",
      email_id: "",
      mobile_no: "",
      depot_name: "",
      depot_id: "",
      ledger_group_id: "",
      ...blankPartyParityFields(),
    })
    setSalespersonForm({
      broker_id: "",
      status: "Active",
      salesman_name: "",
      email_id: "",
      mobile_no: "",
      depot_name: "",
      depot_id: "",
      ledger_group_id: "",
      employee_id: "",
      ...blankPartyParityFields(),
    })
    setLedgerGroupForm({ group_code: "", group_name: "", status: "Active" })
    setStockGroupForm({ group_code: "", group_name: "", status: "Active" })
    setUnitForm({ unit_code: "", unit_name: "", status: "Active" })
    setRawMaterialForm({ raw_material_code: "", name: "", main_uom_id: "", stock_group_id: "", additional_uoms: [], type_of_supply: "", gst_rate_id: "", hsn_code_id: "", sac_code_id: "", default_accounting_ledger_id: "", batch_tracking_enabled: false, status: "Active" })
    setNewAdditionalUom({ uom_id: '', conversion_ratio: '' })
    setShowAdditionalUomSection(false)
    setSemiFinishedGoodForm({ semi_finished_good_code: "", name: "", main_uom_id: "", stock_group_id: "", type_of_supply: "", gst_rate_id: "", hsn_code_id: "", sac_code_id: "", default_accounting_ledger_id: "", batch_tracking_enabled: false, oil_tag_id: "", oil_filling_per_unit: "", filling_unit_id: "", converted_kg: "", packing_weight_per_main_unit: "", packing_weight_unit_id: "", weight_difference: "", standard_weight: "", standard_weight_unit_id: "", status: "Active" })
    setInsuranceDetailForm({ insurance_code: "", status: "Active", insurance_company_name: "", short_name: "", policy_number: "", valid_from: "", valid_upto: "", type_of_policy: "", sum_insured: "", owner_type: "Company", customer_ids: [] })
    setConversionFormulaForm({ conversion_formula_code: "", base_item_id: "", child_item_id: "", status: "Active", steps: [] })
    setNewFormulaStep({ operation: 'subtract', operand_type: 'literal', operand_value: '' })
    setPriceLevelForm({ price_level_code: "", effective_date: "", status: "Active", items: [] })
    setNewPriceLevelItem({ sku_id: '', price: '' })
    setPetrolPumpForm({ petrol_pump_code: "", petrol_pump_name: "", email_id: "", mobile_no: "", ledger_group_id: "", status: "Active", ...blankPartyParityFields() })
    setCdRuleForm({ cd_rule_code: "", wef_date: "", stock_category_id: "", discount_rate_per_main_uom: "", payment_condition_days: "", status: "Active" })
    setTdsRuleForm({ tds_rule_code: "", name: "", guiding_rule: "", threshold_limit: "", rate: "", applicable_amount_type: "Amount Exceeding Threshold", wef_date: "", status: "Active" })
      setOilTagForm({ name: "", status: "Active" })
    setBhadaRateForm({ bhada_rate_code: "", name: "", rate: "", status: "Active" })
    setSkuDetailsForm({
      status: "Active",
      sku_code: "",
      sku_name: "",
      main_uom: "",
      alternate_uom: "",
      nos_per_main_uom: "",
      units: "",
      oil_filling_per_unit: "",
      filling_units: "",
      converted_kg: "",
      packing_weight_per_main_unit: "",
      weight_difference: "",
      sku_weight: "",
      packing_weight: "",
      gross_weight: "",
      semi_finished_good_id: "",
      oil_type_id: "",
      stock_category_id: "",
      main_uom_id: "",
      alternate_uom_id: "",
      type_of_supply: "",
      gst_rate_id: "",
      hsn_code_id: "",
      sac_code_id: "",
      uqc_id: "",
    })
    setVehicleForm({
      vehicle_master_id: '',
      registration_no: '',
      vehicle_type: '',
      transporter: '',
      rto: '',
      rto_id: '',
      additional_transporter_ids: [],
      gps_company: '',
      gps_api_tracking_link: '',
      gps_valid_upto: '',
      gps_type: '',
      gps_installed_by: '',
      status: 'Active',
      rc_image: '',
      road_tax: '',
      road_tax_image: '',
      pollution: '',
      pollution_image: '',
      insurance: '',
      insurance_image: '',
      fitness: '',
      fitness_image: '',
      state_permit: '',
      state_permit_image: '',
      state_permit_type: '',
      national_permit: '',
      national_permit_image: '',
      fuel_type: 'Diesel',
      gvw: '',
      ulw: '',
      passing: '',
      life_time_tax: '',
      life_time_tax_image: ''
    })
    setVehicleFormErrors({})
    setRoadTaxType('expiry')
    setDriverForm({
      driver_master_id: "",
      status: "Active",
      driving_licence_no: "",
      driving_licence_type: "",
      valid_upto: "",
      rto: "",
      rto_id: null,
      trans_valid_upto: "",
      lmv_valid_upto: "",
      driver_name: "",
      mobile_no: "",
      email_id: "",
      address_line1: "",
      state: "",
      pincode: "",
      aadhaar_no: "",
      pan_no: "",
      aadhaar_upload: ""
    })
    setTransportForm({
      ...blankPartyParityFields(),
      transport_master_id: "",
      status: "Active",
      transporter_name: "",
      contact_person: "",
      contact_number: "",
      email_id: "",
      address_line1: "",
      state_id: null,
      pincode: "",
      ledger_group_id: "",
      bilty_copy_upload: "",
      linked_customer_id: "",
    })
    setSkuSellingPrice({
      id: 0,
      packing_material: "",
      sku_weight: "",
      sku_unit: "",
      conversion_formula: "",
      sku_weight_in_gm: "",
      packing_material_weight_in_gm: "",
      net_oil_in_gm: "",
      packing_cost: "",
      var: "",
      landing_cost: "",
      selling_cost: "",
      margin: "",
      actual_margin: ""
    })
    setEditingItem(null)
    setOpeningStockByDepot({})
  }

  // Re-runs PAN/GSTIN validation at submit time (not just on blur) so a pasted
  // value or a value set via populateFormFromData that was never blurred still
  // gets caught client-side before hitting the (still-authoritative) backend.
  const validateCustomerFormForSubmit = (): boolean => {
    const errors: { pan?: string; gstin?: string; pincode?: string; contact?: string; email?: string } = {}
    const email = (customerForm.email || '').toString().trim()
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Please enter a valid email address (e.g. user@domain.com)'
    const contact = (customerForm.contact || '').toString().trim()
    if (contact && !/^[0-9]{10}$/.test(contact)) errors.contact = 'Contact Number must be exactly 10 digits'
    const pan = (customerForm.pan || '').toString().trim().toUpperCase()
    if (pan && !PAN_REGEX.test(pan)) errors.pan = 'Invalid PAN format. Expected: ABCDE1234F'
    const gstin = (customerForm.gstin || '').toString().trim().toUpperCase()
    if (gstin) {
      if (!GSTIN_REGEX.test(gstin)) {
        errors.gstin = 'Invalid GSTIN format. Expected 15 characters, e.g. 22ABCDE1234F1Z5'
      } else {
        const selectedState = activeStates.find((s: any) => String(s.id) === String(customerForm.state_id))
        const gstStateCode = selectedState?.gst_state_code
        if (gstStateCode && gstin.slice(0, 2) !== gstStateCode) {
          errors.gstin = `GSTIN state code (${gstin.slice(0, 2)}) does not match the selected State's GST state code (${gstStateCode})`
        }
      }
    }
    const pincode = (customerForm.pincode || '').toString()
    if (pincode && !PINCODE_REGEX.test(pincode)) errors.pincode = 'PIN Code must be exactly 6 digits'
    setCustomerFormErrors(errors)

    const addrErrors: Record<number, string | undefined> = {}
    ;(customerForm.addresses || []).forEach((addr, i) => {
      const addrPincode = (addr.pincode || '').toString()
      if (addrPincode && !PINCODE_REGEX.test(addrPincode)) addrErrors[i] = 'PIN Code must be exactly 6 digits'
    })
    setAddressErrors(addrErrors)

    const bankErrors: Record<number, string | undefined> = {}
    ;(customerForm.bank_accounts || []).forEach((bank, i) => {
      const ifsc = (bank.ifsc_code || '').toString().trim().toUpperCase()
      if (ifsc && !IFSC_REGEX.test(ifsc)) bankErrors[i] = 'Invalid IFSC format. Expected 11 characters, e.g. SBIN0001234'
    })
    setBankAccountErrors(bankErrors)

    const firstAddrError = Object.values(addrErrors).find(Boolean)
    const firstBankError = Object.values(bankErrors).find(Boolean)
    if (errors.pan || errors.gstin || errors.pincode || firstAddrError || firstBankError) {
      toast({ title: "Validation error", description: errors.pan || errors.gstin || errors.pincode || firstAddrError || firstBankError, variant: "destructive" })
      return false
    }
    if (pan !== customerForm.pan || gstin !== customerForm.gstin) {
      setCustomerForm(prev => ({ ...prev, pan, gstin }))
    }
    if ((customerForm.bank_accounts || []).some(b => (b.ifsc_code || '') !== (b.ifsc_code || '').toString().trim().toUpperCase())) {
      setCustomerForm(prev => ({
        ...prev,
        bank_accounts: (prev.bank_accounts || []).map(b => ({ ...b, ifsc_code: (b.ifsc_code || '').toString().trim().toUpperCase() })),
      }))
    }
    return true
  }

  const handleCreateOrUpdate = async () => {
    if (activeTab === "customers" && !validateCustomerFormForSubmit()) return
    if (activeTab === "petrol_pumps") {
      const mobileVal = (petrolPumpForm.mobile_no || "").toString().trim()
      if (mobileVal && !/^[0-9]{10}$/.test(mobileVal)) {
        toast({ title: "Invalid Mobile Number", description: "Mobile Number must be exactly 10 digits", variant: "destructive" })
        return
      }
    }
    setIsSubmitting(true)
    try {
      let res
      if (activeTab === "customers") {
        if (editingItem) {
          res = await customerApi.update(editingItem.id, customerForm)
        } else {
          res = await customerApi.create(customerForm)
        }
      } else if (activeTab === "depots") {
        if (editingItem) {
          // v2 keys mutations off the real serial id — depot_id is the legacy text business code
          res = await depotApi.update(editingItem.id, depotForm)
        } else {
          res = await depotApi.create(depotForm)
        }
      } else if (activeTab === "brokers") {
        if (editingItem) {
          res = await brokerApi.update(editingItem.id, brokerForm)
        } else {
          res = await brokerApi.create(brokerForm)
        }
      } else if (activeTab === "salespersons") {
        if (editingItem) {
          res = await salespersonApi.update(editingItem.id, salespersonForm)
        } else {
          res = await salespersonApi.create(salespersonForm)
        }
      } else if (activeTab === "ledger_groups") {
        if (editingItem) {
          res = await ledgerGroupApi.update(editingItem.id, ledgerGroupForm)
        } else {
          res = await ledgerGroupApi.create(ledgerGroupForm)
        }
      } else if (activeTab === "stock_groups") {
        if (editingItem) {
          res = await stockGroupApi.update(editingItem.id, stockGroupForm)
        } else {
          res = await stockGroupApi.create(stockGroupForm)
        }
      } else if (activeTab === "units") {
        if (editingItem) {
          res = await unitApi.update(editingItem.id, unitForm)
        } else {
          res = await unitApi.create(unitForm)
        }
      } else if (activeTab === "raw_materials") {
        if (editingItem) {
          res = await rawMaterialApi.update(editingItem.id, rawMaterialForm)
        } else {
          res = await rawMaterialApi.create(rawMaterialForm)
        }
      } else if (activeTab === "semi_finished_goods") {
        if (editingItem) {
          res = await semiFinishedGoodApi.update(editingItem.id, semiFinishedGoodForm)
        } else {
          res = await semiFinishedGoodApi.create(semiFinishedGoodForm)
        }
      } else if (activeTab === "insurance_details") {
        if (editingItem) {
          res = await insuranceDetailApi.update(editingItem.id, insuranceDetailForm)
        } else {
          res = await insuranceDetailApi.create(insuranceDetailForm)
        }
      } else if (activeTab === "conversion_formulas") {
        if (editingItem) {
          res = await conversionFormulaApi.update(editingItem.id, conversionFormulaForm)
        } else {
          res = await conversionFormulaApi.create(conversionFormulaForm)
        }
      } else if (activeTab === "price_levels") {
        if (editingItem) {
          res = await priceLevelApi.update(editingItem.id, priceLevelForm)
        } else {
          res = await priceLevelApi.create(priceLevelForm)
        }
      } else if (activeTab === "petrol_pumps") {
        if (editingItem) {
          res = await petrolPumpApi.update(editingItem.id, petrolPumpForm)
        } else {
          res = await petrolPumpApi.create(petrolPumpForm)
        }
      } else if (activeTab === "cd_rules") {
        if (editingItem) {
          res = await cdRuleApi.update(editingItem.id, cdRuleForm)
        } else {
          res = await cdRuleApi.create(cdRuleForm)
        }
      } 
      else if (activeTab === "tds_rules") {
        if (editingItem) {
          res = await tdsRuleApi.update(editingItem.id, tdsRuleForm)
        } else {
          res = await tdsRuleApi.create(tdsRuleForm)
        }
      }

      else if (activeTab === "oil_tags") {
        if (editingItem) {
          res = await oilTagApi.update(editingItem.id, oilTagForm)
        } else {
          res = await oilTagApi.create(oilTagForm)
        }
      }
 else if (activeTab === "bhada_rates") {
        if (editingItem) {
          res = await bhadaRateApi.update(editingItem.id, bhadaRateForm)
        } else {
          res = await bhadaRateApi.create(bhadaRateForm)
        }
      } else if (activeTab === "sku_details") {
        if (editingItem) {
          res = await skuDetailsApi.update(editingItem.id, skuDetailsForm)
        } else {
          res = await skuDetailsApi.create(skuDetailsForm)
        }
        if (res?.success && skuDetailsForm.sku_name) {
          const isStaged = !isAdminOrSuper || res?.data?.staged === true;
          await Promise.allSettled(
            Object.entries(openingStockByDepot)
              .filter(([_, qty]) => qty !== '')
              .map(([depotName, qty]) =>
                inventoryApi.upsertOpeningQty({
                  depo_name: depotName,
                  product_name: skuDetailsForm.sku_name as string,
                  opening_qty: parseInt(qty) || 0,
                  is_staged: isStaged,
                })
              )
          )
        }
      } else if (activeTab === "sku_selling_price") {
        if (editingItem) {
          res = await skuSellingPriceApi.update(editingItem.id, skuSellingPriceForm)
        } else {
          res = await skuSellingPriceApi.create(skuSellingPriceForm)
        }
      } else if (activeTab === "vehicle_master") {
        // --- Mandatory field validation ---
        const vErrors: { registration_no?: string; vehicle_type?: string; transporter?: string; state_permit_image?: string } = {}
        if (!vehicleForm.registration_no?.trim()) vErrors.registration_no = 'Registration Number is required'
        if (!vehicleForm.vehicle_type?.trim()) vErrors.vehicle_type = 'Vehicle Type is required'
        if (!vehicleForm.transporter?.trim()) vErrors.transporter = 'Transporter is required'
        // State permit document is compulsory when the permit section applies (GVW > 3000)
        const permitApplies = vehicleForm.gvw !== '' && Number(vehicleForm.gvw) > 3000
        if (permitApplies && !vehicleForm.state_permit_image) vErrors.state_permit_image = 'State Permit document is required'
        // --- Duplicate registration number check (against already-loaded list) ---
        const regNo = vehicleForm.registration_no?.trim().toUpperCase()
        const duplicate = vehicles.find((v: any) =>
          v.registration_no?.trim().toUpperCase() === regNo &&
          v.id !== editingItem?.id   // exclude current record when editing
        )
        if (duplicate) vErrors.registration_no = `Registration Number "${regNo}" already exists (${duplicate.vehicle_master_id})`
        if (Object.keys(vErrors).length > 0) {
          setVehicleFormErrors(vErrors)
          setIsSubmitting(false)

          const errList = Object.values(vErrors).filter(Boolean)
          toast({
            title: "Validation Error",
            description: `Please fill in required fields: ${errList.join(", ")}`,
            variant: "destructive",
          })

          setTimeout(() => {
            const firstErrorElem = document.querySelector('.border-red-500, .text-red-500')
            if (firstErrorElem) {
              firstErrorElem.scrollIntoView({ behavior: 'smooth', block: 'center' })
              if (firstErrorElem instanceof HTMLInputElement || firstErrorElem instanceof HTMLButtonElement) {
                firstErrorElem.focus()
              }
            }
          }, 100)

          return
        }
        setVehicleFormErrors({})
        const payload = { ...vehicleForm }
        if (roadTaxType === 'expiry') {
          payload.life_time_tax = null
          payload.life_time_tax_image = null
        } else {
          payload.road_tax = null
          payload.road_tax_image = null
        }
        const isPermitEnabled = payload.gvw !== '' && Number(payload.gvw) > 3000;
        if (!isPermitEnabled) {
          payload.state_permit = null;
          payload.state_permit_image = null;
          payload.state_permit_type = null;
          payload.national_permit = null;
          payload.national_permit_image = null;
        }
        const dateFields = ['rto', 'road_tax', 'life_time_tax', 'pollution', 'insurance', 'fitness', 'state_permit', 'national_permit'] as const;
        dateFields.forEach(f => { if (payload[f] === '') payload[f] = null; });
        if (editingItem) {
          res = await vehicleMasterApi.update(editingItem.id, payload)
        } else {
          res = await vehicleMasterApi.create(payload)
        }
      } else if (activeTab === "driver_master") {
        const dErrors: string[] = []
        if (!driverForm.driver_name?.trim()) dErrors.push('Driver Name is required')
        if (!driverForm.mobile_no?.trim()) dErrors.push('Mobile Number is required')
        if (!driverForm.driving_licence_no?.trim()) dErrors.push('Driving Licence Number is required')

        if (dErrors.length > 0) {
          setIsSubmitting(false)
          toast({
            title: "Validation Error",
            description: `Please fill in required fields: ${dErrors.join(", ")}`,
            variant: "destructive",
          })
          setTimeout(() => {
            const firstErrorElem = document.querySelector('.border-red-500, .text-red-500') || document.querySelector('input[placeholder="Full Name"], input[placeholder="10-digit number"], input[placeholder="DL Number"]')
            if (firstErrorElem) {
              firstErrorElem.scrollIntoView({ behavior: 'smooth', block: 'center' })
              if (firstErrorElem instanceof HTMLInputElement) firstErrorElem.focus()
            }
          }, 100)
          return
        }

        if (editingItem) {
          res = await driverMasterApi.update(editingItem.id, driverForm)
        } else {
          res = await driverMasterApi.create(driverForm)
        }
      } else if (activeTab === "transport_master") {
        const tErrors: string[] = []
        if (!transportForm.transporter_name?.trim()) tErrors.push('Transporter Name is required')
        if (!transportForm.contact_person?.trim()) tErrors.push('Contact Person is required')
        if (!transportForm.contact_number?.trim()) tErrors.push('Contact Number is required')

        if (tErrors.length > 0) {
          setIsSubmitting(false)
          toast({
            title: "Validation Error",
            description: `Please fill in required fields: ${tErrors.join(", ")}`,
            variant: "destructive",
          })
          setTimeout(() => {
            const firstErrorElem = document.querySelector('.border-red-500, .text-red-500') || document.querySelector('input[placeholder="Company Name"], input[placeholder="Full Name"], input[placeholder="Mobile/Phone"]')
            if (firstErrorElem) {
              firstErrorElem.scrollIntoView({ behavior: 'smooth', block: 'center' })
              if (firstErrorElem instanceof HTMLInputElement) firstErrorElem.focus()
            }
          }, 100)
          return
        }

        if (editingItem) {
          res = await transportMasterApi.update(editingItem.id, transportForm)
        } else {
          res = await transportMasterApi.create(transportForm)
        }
      }
      if (res?.success) {
        toast({ title: "Success", description: res.message || (editingItem ? "Updated successfully" : "Created successfully") })
        setIsDialogOpen(false)
        resetForms()
        queryClient.invalidateQueries({ queryKey: ["master-edit-history"] })
        // Refetch appropriate query (also refresh pending list so admin sees new/edited record immediately)
        if (activeTab === "customers") { refetchCustomer(); refetchPendingCustomers() }
        else if (activeTab === "depots") { refetchDepot(); refetchPendingDepots() }
        else if (activeTab === "brokers") { refetchBroker(); refetchPendingBrokers() }
        else if (activeTab === "salespersons") { refetchSalesperson(); refetchPendingSalespersons() }
        else if (activeTab === "ledger_groups") { refetchLedgerGroup(); refetchPendingLedgerGroups() }
        else if (activeTab === "stock_groups") { refetchStockGroup(); refetchPendingStockGroups() }
        else if (activeTab === "units") { refetchUnit(); refetchPendingUnits() }
        else if (activeTab === "raw_materials") { refetchRawMaterial(); refetchPendingRawMaterials() }
        else if (activeTab === "semi_finished_goods") { refetchSemiFinishedGood(); refetchPendingSemiFinishedGoods() }
        else if (activeTab === "insurance_details") { refetchInsuranceDetail(); refetchPendingInsuranceDetails() }
        else if (activeTab === "conversion_formulas") { refetchConversionFormula(); refetchPendingConversionFormulas() }
        else if (activeTab === "price_levels") { refetchPriceLevel(); refetchPendingPriceLevels() }
        else if (activeTab === "petrol_pumps") { refetchPetrolPump(); refetchPendingPetrolPumps() }
        else if (activeTab === "cd_rules") { refetchCdRule(); refetchPendingCdRules() }
        else if (activeTab === "tds_rules") { refetchTdsRule(); refetchPendingTdsRules() }
              else if (activeTab === "oil_tags") { refetchOilTag(); refetchPendingOilTags() }
        else if (activeTab === "bhada_rates") { refetchBhadaRate(); refetchPendingBhadaRates() }
        else if (activeTab === "sku_details") { refetchSku(); refetchPendingSku() }
        else if (activeTab === "sku_selling_price") refetchSkuSellingPrice()
        else if (activeTab === "vehicle_master") { refetchVehicle(); refetchPendingVehicles() }
        else if (activeTab === "driver_master") { refetchDriver(); refetchPendingDrivers() }
        else if (activeTab === "transport_master") { refetchTransport(); refetchPendingTransport() }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save data",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingItem) return
    setIsSubmitting(true)
    try {
      let res
      if (activeTab === "customers") {
        res = await customerApi.delete(deletingItem.id)
      } else if (activeTab === "depots") {
        // v2 keys mutations off the real serial id — depot_id/broker_id are legacy text business codes
        res = await depotApi.delete(deletingItem.id)
      } else if (activeTab === "brokers") {
        res = await brokerApi.delete(deletingItem.id)
      } else if (activeTab === "salespersons") {
        res = await salespersonApi.delete(deletingItem.id)
      } else if (activeTab === "ledger_groups") {
        res = await ledgerGroupApi.delete(deletingItem.id)
      } else if (activeTab === "stock_groups") {
        res = await stockGroupApi.delete(deletingItem.id)
      } else if (activeTab === "units") {
        res = await unitApi.delete(deletingItem.id)
      } else if (activeTab === "raw_materials") {
        res = await rawMaterialApi.delete(deletingItem.id)
      } else if (activeTab === "semi_finished_goods") {
        res = await semiFinishedGoodApi.delete(deletingItem.id)
      } else if (activeTab === "insurance_details") {
        res = await insuranceDetailApi.delete(deletingItem.id)
      } else if (activeTab === "conversion_formulas") {
        res = await conversionFormulaApi.delete(deletingItem.id)
      } else if (activeTab === "price_levels") {
        res = await priceLevelApi.delete(deletingItem.id)
      } else if (activeTab === "petrol_pumps") {
        res = await petrolPumpApi.delete(deletingItem.id)
      } else if (activeTab === "cd_rules") {
        res = await cdRuleApi.delete(deletingItem.id)
      } else if (activeTab === "tds_rules") {
        res = await tdsRuleApi.delete(deletingItem.id)
      } else if (activeTab === "oil_tags") {
        res = await oilTagApi.delete(deletingItem.id)
      } else if (activeTab === "bhada_rates") {
        res = await bhadaRateApi.delete(deletingItem.id)
      } else if (activeTab === "sku_details") {
        res = await skuDetailsApi.delete(deletingItem.id)
      } else if (activeTab === "sku_selling_price") {
        res = await skuSellingPriceApi.delete(deletingItem.id)
      } else if (activeTab === "vehicle_master") {
        res = await vehicleMasterApi.delete(deletingItem.id)
      } else if (activeTab === "driver_master") {
        res = await driverMasterApi.delete(deletingItem.id)
      } else if (activeTab === "transport_master") {
        res = await transportMasterApi.delete(deletingItem.id)
      }
      if (res?.success) {
        toast({ title: "Success", description: "Deleted successfully" })
        setIsDeleteDialogOpen(false)
        setDeletingItem(null)
        // Refetch appropriate query
        if (activeTab === "customers") refetchCustomer()
        else if (activeTab === "depots") refetchDepot()
        else if (activeTab === "brokers") refetchBroker()
        else if (activeTab === "salespersons") refetchSalesperson()
        else if (activeTab === "ledger_groups") refetchLedgerGroup()
        else if (activeTab === "stock_groups") refetchStockGroup()
        else if (activeTab === "units") refetchUnit()
        else if (activeTab === "raw_materials") refetchRawMaterial()
        else if (activeTab === "semi_finished_goods") refetchSemiFinishedGood()
        else if (activeTab === "insurance_details") refetchInsuranceDetail()
        else if (activeTab === "conversion_formulas") refetchConversionFormula()
        else if (activeTab === "price_levels") refetchPriceLevel()
        else if (activeTab === "petrol_pumps") refetchPetrolPump()
        else if (activeTab === "cd_rules") refetchCdRule()
        else if (activeTab === "tds_rules") refetchTdsRule()
        else if (activeTab === "oil_tags") refetchOilTag()
        else if (activeTab === "bhada_rates") refetchBhadaRate()
        else if (activeTab === "sku_details") refetchSku()
        else if (activeTab === "sku_selling_price") refetchSkuSellingPrice()
        else if (activeTab === "vehicle_master") refetchVehicle()
        else if (activeTab === "driver_master") refetchDriver()
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete item",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const openApprovalModal = (tab: string, item: any) => {
    setApprovalReviewModal({ tab, item })
    // Pre-fill the SAME Add/Edit form used on the main tab with the proposed values
    // (pending_changes layered over the live row for edits), so the review modal is
    // identical to the original add/edit modal. editingItem keeps IDs read-only.
    let pc = item?.pending_changes
    if (typeof pc === 'string') { try { pc = JSON.parse(pc) } catch { pc = null } }
    const proposed = pc && item?.request_type === 'edit' ? { ...item, ...pc } : { ...item }
    setEditingItem(item)
    populateFormFromData(tab, proposed)
  }

  const handleReviewRecord = async (tab: string, id: any, action: 'approve' | 'reject', reason?: string, overrides?: Record<string, any>) => {
    setIsReviewing(true)
    try {
      let res: any
      const payload = { action, reason, ...(action === 'approve' ? overrides : {}) }
      if (tab === 'customers') res = await customerApi.review(id, payload)
      else if (tab === 'depots') res = await depotApi.review(id, payload)
      else if (tab === 'brokers') res = await brokerApi.review(id, payload)
      else if (tab === 'salespersons') res = await salespersonApi.review(id, payload)
      else if (tab === 'ledger_groups') res = await ledgerGroupApi.review(id, payload)
      else if (tab === 'stock_groups') res = await stockGroupApi.review(id, payload)
      else if (tab === 'units') res = await unitApi.review(id, payload)
      else if (tab === 'raw_materials') res = await rawMaterialApi.review(id, payload)
      else if (tab === 'semi_finished_goods') res = await semiFinishedGoodApi.review(id, payload)
      else if (tab === 'insurance_details') res = await insuranceDetailApi.review(id, payload)
      else if (tab === 'conversion_formulas') res = await conversionFormulaApi.review(id, payload)
      else if (tab === 'price_levels') res = await priceLevelApi.review(id, payload)
      else if (tab === 'petrol_pumps') res = await petrolPumpApi.review(id, payload)
      else if (tab === 'cd_rules') res = await cdRuleApi.review(id, payload)
      else if (tab === 'oil_tags') res = await oilTagApi.review(id, payload)
        else if (tab === 'tds_rules') res = await tdsRuleApi.review(id, payload)
      else if (tab === 'bhada_rates') res = await bhadaRateApi.review(id, payload)
      else if (tab === 'sku_details') res = await skuDetailsApi.review(id, payload)
      else if (tab === 'vehicle_master') res = await vehicleMasterApi.review(id, payload)
      else if (tab === 'driver_master') res = await driverMasterApi.review(id, payload)
      else if (tab === 'transport_master') res = await transportMasterApi.review(id, payload)
      if (res?.success) {
        toast({ title: "Success", description: res.message || `Record ${action}d successfully` })
        if (tab === 'customers') { refetchPendingCustomers(); refetchCustomer() }
        else if (tab === 'depots') { refetchPendingDepots(); refetchDepot() }
        else if (tab === 'brokers') { refetchPendingBrokers(); refetchBroker() }
        else if (tab === 'salespersons') { refetchPendingSalespersons(); refetchSalesperson() }
        else if (tab === 'ledger_groups') { refetchPendingLedgerGroups(); refetchLedgerGroup() }
        else if (tab === 'stock_groups') { refetchPendingStockGroups(); refetchStockGroup() }
        else if (tab === 'units') { refetchPendingUnits(); refetchUnit() }
        else if (tab === 'raw_materials') { refetchPendingRawMaterials(); refetchRawMaterial() }
        else if (tab === 'semi_finished_goods') { refetchPendingSemiFinishedGoods(); refetchSemiFinishedGood() }
        else if (tab === 'insurance_details') { refetchPendingInsuranceDetails(); refetchInsuranceDetail() }
        else if (tab === 'conversion_formulas') { refetchPendingConversionFormulas(); refetchConversionFormula() }
        else if (tab === 'price_levels') { refetchPendingPriceLevels(); refetchPriceLevel() }
        else if (tab === 'petrol_pumps') { refetchPendingPetrolPumps(); refetchPetrolPump() }
        else if (tab === 'cd_rules') { refetchPendingCdRules(); refetchCdRule() }
        else if (tab === 'tds_rules') { refetchPendingTdsRules(); refetchTdsRule() }
        else if (tab === 'bhada_rates') { refetchPendingBhadaRates(); refetchBhadaRate() }
        else if (tab === 'sku_details') { refetchPendingSku(); refetchSku(); queryClient.invalidateQueries({ queryKey: ['inventory-data'] }) }
        else if (tab === 'vehicle_master') { refetchPendingVehicles(); refetchVehicle() }
        else if (tab === 'driver_master') { refetchPendingDrivers(); refetchDriver() }
        else if (tab === 'transport_master') { refetchPendingTransport(); refetchTransport() }
        queryClient.invalidateQueries({ queryKey: ["master-edit-history"] })
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to review record", variant: "destructive" })
    } finally {
      setIsReviewing(false)
      setRejectDialogContext(null)
      setRejectionReason("")
      setApprovalReviewModal(null)
      setApprovalEditData({})

      resetForms()
    }
  }




  const fetchNextId = async (type: 'customer' | 'depot' | 'broker' | 'sku' | 'salesperson' | 'vehicle' | 'driver' | 'transport' | 'ledger_group' | 'stock_group' | 'unit' | 'ledger' | 'raw_material' | 'semi_finished_good' | 'insurance_detail' | 'conversion_formula' | 'price_level' | 'petrol_pump' | 'cd_rule' | 'tds_rule' | 'bhada_rate') => {
    try {
      const res = await commonApi.getNextId(type)
      if (res.success) {
        return res.data.nextId
      }
    } catch (error) {
      console.error("Failed to fetch next ID", error)
    }
    return ""
  }

  const handleOpenAddDialog = async () => {
    resetForms()
    setIsDialogOpen(true)
    
    // Fetch next ID based on active tab
    let nextId = ""
    if (activeTab === "customers") {
      nextId = await fetchNextId('customer')
      setCustomerForm((prev: any) => ({ ...prev, customer_id: nextId }))
    } else if (activeTab === "depots") {
      nextId = await fetchNextId('depot')
      setDepotForm((prev: any) => ({ ...prev, depot_id: nextId }))
    } else if (activeTab === "brokers") {
      nextId = await fetchNextId('broker')
      setBrokerForm((prev: any) => ({ ...prev, broker_id: nextId }))
    } else if (activeTab === "salespersons") {
      nextId = await fetchNextId('salesperson')
      setSalespersonForm((prev: any) => ({ ...prev, broker_id: nextId }))
    } else if (activeTab === "ledger_groups") {
      nextId = await fetchNextId('ledger_group')
      setLedgerGroupForm((prev: any) => ({ ...prev, group_code: nextId }))
    } else if (activeTab === "stock_groups") {
      nextId = await fetchNextId('stock_group')
      setStockGroupForm((prev: any) => ({ ...prev, group_code: nextId }))
    } else if (activeTab === "units") {
      nextId = await fetchNextId('unit')
      setUnitForm((prev: any) => ({ ...prev, unit_code: nextId }))
    } else if (activeTab === "raw_materials") {
      nextId = await fetchNextId('raw_material')
      setRawMaterialForm((prev: any) => ({ ...prev, raw_material_code: nextId }))
    } else if (activeTab === "semi_finished_goods") {
      nextId = await fetchNextId('semi_finished_good')
      setSemiFinishedGoodForm((prev: any) => ({ ...prev, semi_finished_good_code: nextId }))
    } else if (activeTab === "insurance_details") {
      nextId = await fetchNextId('insurance_detail')
      setInsuranceDetailForm((prev: any) => ({ ...prev, insurance_code: nextId }))
    } else if (activeTab === "conversion_formulas") {
      nextId = await fetchNextId('conversion_formula')
      setConversionFormulaForm((prev: any) => ({ ...prev, conversion_formula_code: nextId }))
    } else if (activeTab === "price_levels") {
      nextId = await fetchNextId('price_level')
      setPriceLevelForm((prev: any) => ({ ...prev, price_level_code: nextId }))
    } else if (activeTab === "petrol_pumps") {
      nextId = await fetchNextId('petrol_pump')
      setPetrolPumpForm((prev: any) => ({ ...prev, petrol_pump_code: nextId }))
    } else if (activeTab === "cd_rules") {
      nextId = await fetchNextId('cd_rule')
      setCdRuleForm((prev: any) => ({ ...prev, cd_rule_code: nextId }))
    } else if (activeTab === "tds_rules") {
      nextId = await fetchNextId('tds_rule')
      setTdsRuleForm((prev: any) => ({ ...prev, tds_rule_code: nextId }))
    } else if (activeTab === "bhada_rates") {
      nextId = await fetchNextId('bhada_rate')
      setBhadaRateForm((prev: any) => ({ ...prev, bhada_rate_code: nextId }))
    } else if (activeTab === "sku_details") {
      nextId = await fetchNextId('sku')
      setSkuDetailsForm((prev: any) => ({ ...prev, sku_code: nextId }))
    } else if (activeTab === "vehicle_master") {
      nextId = await fetchNextId('vehicle')
      setVehicleForm((prev: any) => ({ ...prev, vehicle_master_id: nextId }))
    } else if (activeTab === "driver_master") {
      nextId = await fetchNextId('driver')
      setDriverForm((prev: any) => ({ ...prev, driver_master_id: nextId }))
    } else if (activeTab === "sku_selling_price") {
      // No ID fetching for selling price as it usually depends on existing SKUs or is auto-id
      setSkuSellingPrice({
        id: 0,
        packing_material: "",
        sku_weight: "",
        sku_unit: "",
        conversion_formula: "",
        sku_weight_in_gm: "",
        packing_material_weight_in_gm: "",
        net_oil_in_gm: "",
        packing_cost: "",
        var: "",
        landing_cost: "",
        selling_cost: "",
        margin: "",
        actual_margin: ""
      })
    } else if (activeTab === "transport_master") {
      nextId = await fetchNextId('transport')
    }
  }

  // Populate the per-tab Add/Edit form state from a record. Shared by the Edit
  // dialog and the pending-approval review modal so both render the identical form.
  const populateFormFromData = async (tab: string, data: any) => {
    if (tab === "customers") {
      const bankAccs = Array.isArray(data.bank_accounts) && data.bank_accounts.length > 0
        ? data.bank_accounts
        : [blankCustomerBankAccount()]
      setCustomerForm({ ...data, bank_accounts: bankAccs })
      if (typeof window !== 'undefined') (window as any).setCustomerFormGlobal = (custData: any) => setCustomerForm({ ...custData, bank_accounts: Array.isArray(custData.bank_accounts) && custData.bank_accounts.length > 0 ? custData.bank_accounts : [blankCustomerBankAccount()] })
    } else if (tab === "depots") {
      setDepotForm({ ...data })
    } else if (tab === "brokers") {
      setBrokerForm({ ...data })
    } else if (tab === "salespersons") {
      setSalespersonForm({ ...data })
    } else if (tab === "ledger_groups") {
      setLedgerGroupForm({ ...data })
    } else if (tab === "stock_groups") {
      setStockGroupForm({ ...data })
    } else if (tab === "units") {
      setUnitForm({ ...data })
    } else if (tab === "raw_materials") {
      setRawMaterialForm({ ...data })
    } else if (tab === "semi_finished_goods") {
      setSemiFinishedGoodForm({ ...data })
    } else if (tab === "insurance_details") {
      setInsuranceDetailForm({ ...data })
    } else if (tab === "conversion_formulas") {
      setConversionFormulaForm({ ...data })
    } else if (tab === "price_levels") {
      setPriceLevelForm({ ...data })
    } else if (tab === "petrol_pumps") {
      setPetrolPumpForm({ ...data })
    } else if (tab === "cd_rules") {
      setCdRuleForm({ ...data })
    } else if (tab === "oil_tags") {
      setOilTagForm({ ...data })
    } else if (tab === "tds_rules") {
      setTdsRuleForm({ ...data, name: data.name || data.nature_of_transaction || "" })
    } else if (tab === "bhada_rates") {
      setBhadaRateForm({ ...data })
    } else if (tab === "sku_details") {
      setSkuDetailsForm({ ...data })
      setOpeningStockByDepot({})
      const stockMap: Record<string, string> = {}
      if (data.pending_opening_stock && Object.keys(data.pending_opening_stock).length > 0) {
        Object.entries(data.pending_opening_stock).forEach(([depot, qty]) => {
          stockMap[depot] = String(qty)
        })
        setOpeningStockByDepot(stockMap)
      } else {
        try {
          const res = await inventoryApi.getData()
          if (res.success) {
            res.data
              .filter((row: any) => row.product_name?.toLowerCase() === data.sku_name?.toLowerCase())
              .forEach((row: any) => {
                if (row.opening_qty !== null && row.opening_qty !== undefined) stockMap[row.depot_name] = String(row.opening_qty)
              })
            setOpeningStockByDepot(stockMap)
          }
        } catch (_) {}
      }
    } else if (tab === "sku_selling_price") {
      setSkuSellingPrice({ ...data })
    } else if (tab === "vehicle_master") {
      setVehicleForm({
        state_permit_type: '',
        fuel_type: 'Diesel',
        ...data
      })
      setRoadTaxType(data.life_time_tax || data.life_time_tax_image ? 'lifetime' : 'expiry')
    } else if (tab === "driver_master") {
      setDriverForm({ ...data })
    } else if (tab === "transport_master") {
      setTransportForm({ ...data })
    }
  }

  const openEditDialog = async (item: any) => {
    setEditingItem(item)
    // Customers / Raw Materials: the list row doesn't carry the child-table
    // rows (kept out of the list query for performance) - fetch full detail
    // so the addresses / Additional UOM section has something to populate
    // when the dialog opens.
    if (activeTab === 'customers') {
      const res = await customerApi.getById(item.id)
      await populateFormFromData(activeTab, res.success ? res.data : item)
    } else if (activeTab === 'raw_materials') {
      const res = await rawMaterialApi.getById(item.id)
      await populateFormFromData(activeTab, res.success ? res.data : item)
    } else if (activeTab === 'vehicle_master') {
      // The list row doesn't carry additional_transporter_ids (kept out of
      // the list query for performance) - fetch full detail so the
      // multi-transporter checklist has something to populate.
      const res = await vehicleMasterApi.getById(item.id)
      await populateFormFromData(activeTab, res.success ? res.data : item)
    } else if (activeTab === 'depots') {
      // The list row doesn't carry agent_tags (kept out of the list query
      // for performance) - fetch full detail so the Broker/Salesperson
      // checklist has something to populate.
      const res = await depotApi.getById(item.id)
      await populateFormFromData(activeTab, res.success ? res.data : item)
    } else if (activeTab === 'insurance_details') {
      const res = await insuranceDetailApi.getById(item.id)
      await populateFormFromData(activeTab, res.success ? res.data : item)
    } else if (activeTab === 'conversion_formulas') {
      const res = await conversionFormulaApi.getById(item.id)
      await populateFormFromData(activeTab, res.success ? res.data : item)
    } else if (activeTab === 'price_levels') {
      const res = await priceLevelApi.getById(item.id)
      await populateFormFromData(activeTab, res.success ? res.data : item)
    } else {
      await populateFormFromData(activeTab, item)
    }
    setIsDialogOpen(true)
  }

  // Returns the current per-tab Add/Edit form state object (used when approving).
  const getFormForTab = (tab: string): any => {
    switch (tab) {
      case 'customers': return customerForm
      case 'depots': return depotForm
      case 'brokers': return brokerForm
      case 'salespersons': return salespersonForm
      case 'ledger_groups': return ledgerGroupForm
      case 'stock_groups': return stockGroupForm
      case 'units': return unitForm
      case 'raw_materials': return rawMaterialForm
      case 'semi_finished_goods': return semiFinishedGoodForm
      case 'insurance_details': return insuranceDetailForm
      case 'conversion_formulas': return conversionFormulaForm
      case 'price_levels': return priceLevelForm
      case 'petrol_pumps': return petrolPumpForm
      case 'cd_rules': return cdRuleForm
      case 'oil_tags': return oilTagForm
        case 'tds_rules': return tdsRuleForm
      case 'bhada_rates': return bhadaRateForm
      case 'sku_details': return skuDetailsForm
      case 'vehicle_master': {
        const payload = { ...vehicleForm }
        if (roadTaxType === 'expiry') {
          payload.life_time_tax = null
          payload.life_time_tax_image = null
        } else {
          payload.road_tax = null
          payload.road_tax_image = null
        }
        const isPermitEnabled = payload.gvw !== '' && Number(payload.gvw) > 3000
        if (!isPermitEnabled) {
          payload.state_permit = null
          payload.state_permit_image = null
          payload.state_permit_type = null
          payload.national_permit = null
          payload.national_permit_image = null
        }
        const dateFields = ['rto', 'road_tax', 'life_time_tax', 'pollution', 'insurance', 'fitness', 'state_permit', 'national_permit'] as const;
        dateFields.forEach(f => { if (payload[f] === '') payload[f] = null; });
        return payload
      }
      case 'driver_master': return driverForm
      case 'transport_master': return transportForm
      default: return {}
    }
  }

  // Renders the exact same Add/Edit form used on the main tab, by tab key.
  // Renders the exact same Add/Edit form used on the main tab, by tab key.
  // Renders the exact same Add/Edit form used on the main tab, by tab key.
  const renderFormForTab = (tab: string) => {
    switch (tab) {
      case 'customers': return (
        <CustomerForm
          editingItem={editingItem}
          customerForm={customerForm}
          setCustomerForm={setCustomerForm}
          customerFormErrors={customerFormErrors}
          addressErrors={addressErrors}
          bankAccountErrors={bankAccountErrors}
          handleCustomerFieldChangeAttempt={handleCustomerFieldChangeAttempt}
          setCustomerEffectiveDatesSection={setCustomerEffectiveDatesSection}
          activeStates={activeStates}
          activeDistricts={activeDistricts}
          activeSubDistricts={activeSubDistricts}
          activeGstRegStatuses={activeGstRegStatuses}
          activeGstRegTypes={activeGstRegTypes}
          activeMsmeRegTypes={activeMsmeRegTypes}
          activeFssaiLicenceTypes={activeFssaiLicenceTypes}
          activeBankNames={activeBankNames}
          godownDepots={godownDepots}
          ledgerGroupOptions={ledgerGroupOptions}
          brokerOptions={brokerOptions}
          salespersonOptions={salespersonOptions}
          depotOptions={depots}
          priceLevelOptions={priceLevelsList}
          cdRuleOptions={cdRulesList}
          tdsRuleOptions={tdsRulesList}
          handlePartyPanBlur={handlePartyPanBlur}
          handlePartyGstinBlur={handlePartyGstinBlur}
          partyFormErrors={partyFormErrors}
          handlePanBlur={handlePanBlur}
          handleGstinBlur={handleGstinBlur}
          handlePincodeBlur={handlePincodeBlur}
          handleAddressPincodeBlur={handleAddressPincodeBlur}
          handleBankAccountIfscBlur={handleBankAccountIfscBlur}
          handleAddressStateChange={handleAddressStateChange}
          updateAddressRow={updateAddressRow}
          addAddressRow={addAddressRow}
          removeAddressRow={removeAddressRow}
          updateBankAccountRow={updateBankAccountRow}
          addBankAccountRow={addBankAccountRow}
          removeBankAccountRow={removeBankAccountRow}
          handleFileUpload={handleFileUpload}
          handleFileRemove={handleFileRemove}
        />
      )
      case 'depots': return (
        <DepotForm
          editingItem={editingItem}
          depotForm={depotForm}
          setDepotForm={setDepotForm}
          handleDepotFieldChangeAttempt={handleDepotFieldChangeAttempt}
          setDepotEffectiveDatesSection={setDepotEffectiveDatesSection}
          activeStates={activeStates}
          brokerOptions={brokerOptions}
          salespersonOptions={salespersonOptions}
          ledgerGroupOptions={ledgerGroupOptions}
          activeGstRegStatuses={activeGstRegStatuses}
          activeGstRegTypes={activeGstRegTypes}
          activeMsmeRegTypes={activeMsmeRegTypes}
          activeFssaiLicenceTypes={activeFssaiLicenceTypes}
          handlePartyPanBlur={handlePartyPanBlur}
          handlePartyGstinBlur={handlePartyGstinBlur}
          partyFormErrors={partyFormErrors}
          handleFileUpload={handleFileUpload}
          handleFileRemove={handleFileRemove}
        />
      )
      case 'brokers': return (
        <BrokerForm
          brokerForm={brokerForm}
          setBrokerForm={setBrokerForm}
          editingItem={editingItem}
          handleBrokerFieldChangeAttempt={handleBrokerFieldChangeAttempt}
          setBrokerEffectiveDatesSection={setBrokerEffectiveDatesSection}
          ledgerGroupOptions={ledgerGroupOptions}
          activeStates={activeStates}
          activeGstRegStatuses={activeGstRegStatuses}
          activeGstRegTypes={activeGstRegTypes}
          activeMsmeRegTypes={activeMsmeRegTypes}
          activeFssaiLicenceTypes={activeFssaiLicenceTypes}
          handlePartyPanBlur={handlePartyPanBlur}
          handlePartyGstinBlur={handlePartyGstinBlur}
          partyFormErrors={partyFormErrors}
          handleFileUpload={handleFileUpload}
          handleFileRemove={handleFileRemove}
        />
      )
      case 'salespersons': return (
        <SalespersonForm
          salespersonForm={salespersonForm}
          setSalespersonForm={setSalespersonForm}
          editingItem={editingItem}
          handleSalespersonFieldChangeAttempt={handleSalespersonFieldChangeAttempt}
          setSalespersonEffectiveDatesSection={setSalespersonEffectiveDatesSection}
          ledgerGroupOptions={ledgerGroupOptions}
          activeStates={activeStates}
          activeGstRegStatuses={activeGstRegStatuses}
          activeGstRegTypes={activeGstRegTypes}
          activeMsmeRegTypes={activeMsmeRegTypes}
          activeFssaiLicenceTypes={activeFssaiLicenceTypes}
          handlePartyPanBlur={handlePartyPanBlur}
          handlePartyGstinBlur={handlePartyGstinBlur}
          partyFormErrors={partyFormErrors}
          handleFileUpload={handleFileUpload}
          handleFileRemove={handleFileRemove}
        />
      )
      case 'ledger_groups': return <LedgerGroupForm ledgerGroupForm={ledgerGroupForm} setLedgerGroupForm={setLedgerGroupForm} ledgerGroupOptionsData={ledgerGroupOptionsData} editingItem={editingItem} handleLedgerGroupFieldChangeAttempt={handleLedgerGroupFieldChangeAttempt} setLedgerGroupEffectiveDatesOpen={setLedgerGroupEffectiveDatesOpen} />
      case 'stock_groups': return <StockGroupForm stockGroupForm={stockGroupForm} setStockGroupForm={setStockGroupForm} stockGroupOptionsData={stockGroupOptionsData} editingItem={editingItem} handleStockGroupFieldChangeAttempt={handleStockGroupFieldChangeAttempt} setStockGroupEffectiveDatesOpen={setStockGroupEffectiveDatesOpen} />
      case 'units': return <UnitForm unitForm={unitForm} setUnitForm={setUnitForm} editingItem={editingItem} handleUnitFieldChangeAttempt={handleUnitFieldChangeAttempt} setUnitEffectiveDatesOpen={setUnitEffectiveDatesOpen} />
      case 'raw_materials': return (
        <RawMaterialForm
          rawMaterialForm={rawMaterialForm}
          setRawMaterialForm={setRawMaterialForm}
          unitOptions={unitsList}
          stockGroupOptions={stockGroupsList}
          activeGstRates={activeGstRates}
          activeSacCodes={activeSacCodes}
          activeHsnCodes={activeHsnCodes}
          ledgerOptions={ledgerOptions}
          openQuickAdd={(type, cb) => openQuickAdd(type, cb)}
          showAdditionalUomSection={showAdditionalUomSection}
          setShowAdditionalUomSection={setShowAdditionalUomSection}
          newAdditionalUom={newAdditionalUom}
          setNewAdditionalUom={setNewAdditionalUom}
          editingItem={editingItem}
          handleRawMaterialFieldChangeAttempt={handleRawMaterialFieldChangeAttempt}
          setRawMaterialEffectiveDatesSection={setRawMaterialEffectiveDatesSection}
        />
      )
      case 'semi_finished_goods': return (
        <SemiFinishedGoodForm
          semiFinishedGoodForm={semiFinishedGoodForm}
          setSemiFinishedGoodForm={setSemiFinishedGoodForm}
          unitOptions={unitsList}
          stockGroupOptions={stockGroupsList}
          activeGstRates={activeGstRates}
          activeSacCodes={activeSacCodes}
          activeHsnCodes={activeHsnCodes}
          ledgerOptions={ledgerOptions}
          openQuickAdd={(type, cb) => openQuickAdd(type, cb)}
          editingItem={editingItem}
          handleSemiFinishedGoodFieldChangeAttempt={handleSemiFinishedGoodFieldChangeAttempt}
          setSemiFinishedGoodEffectiveDatesSection={setSemiFinishedGoodEffectiveDatesSection}
        />
      )
      case 'insurance_details': return <InsuranceDetailForm insuranceDetailForm={insuranceDetailForm} setInsuranceDetailForm={setInsuranceDetailForm} customerOptions={customerOptions} editingItem={editingItem} handleInsuranceDetailFieldChangeAttempt={handleInsuranceDetailFieldChangeAttempt} setInsuranceDetailEffectiveDatesOpen={setInsuranceDetailEffectiveDatesOpen} />
      case 'conversion_formulas': return <ConversionFormulaForm conversionFormulaForm={conversionFormulaForm} setConversionFormulaForm={setConversionFormulaForm} skuOptions={skuDetails} newFormulaStep={newFormulaStep} setNewFormulaStep={setNewFormulaStep} editingItem={editingItem} handleConversionFormulaFieldChangeAttempt={handleConversionFormulaFieldChangeAttempt} setConversionFormulaEffectiveDatesOpen={setConversionFormulaEffectiveDatesOpen} />
      case 'price_levels': return <PriceLevelForm priceLevelForm={priceLevelForm} setPriceLevelForm={setPriceLevelForm} skuOptions={skuDetails} newPriceLevelItem={newPriceLevelItem} setNewPriceLevelItem={setNewPriceLevelItem} editingItem={editingItem} handlePriceLevelFieldChangeAttempt={handlePriceLevelFieldChangeAttempt} setPriceLevelEffectiveDatesSection={setPriceLevelEffectiveDatesSection} />
      case 'petrol_pumps': return <PetrolPumpForm petrolPumpForm={petrolPumpForm} setPetrolPumpForm={setPetrolPumpForm} editingItem={editingItem} handlePetrolPumpFieldChangeAttempt={handlePetrolPumpFieldChangeAttempt} setPetrolPumpEffectiveDatesSection={setPetrolPumpEffectiveDatesSection} ledgerGroupOptions={ledgerGroupOptions} activeStates={activeStates} activeGstRegStatuses={activeGstRegStatuses} activeGstRegTypes={activeGstRegTypes} activeMsmeRegTypes={activeMsmeRegTypes} activeFssaiLicenceTypes={activeFssaiLicenceTypes} handlePartyPanBlur={handlePartyPanBlur} handlePartyGstinBlur={handlePartyGstinBlur} partyFormErrors={partyFormErrors} handleFileUpload={handleFileUpload} handleFileRemove={handleFileRemove} />
      case 'cd_rules': return <CdRuleForm cdRuleForm={cdRuleForm} setCdRuleForm={setCdRuleForm} activeStockCategories={activeStockCategories} editingItem={editingItem} handleCdRuleFieldChangeAttempt={handleCdRuleFieldChangeAttempt} setCdRuleEffectiveDatesOpen={setCdRuleEffectiveDatesOpen} />
      case 'tds_rules': return <TdsRuleForm tdsRuleForm={tdsRuleForm} setTdsRuleForm={setTdsRuleForm} editingItem={editingItem} handleTdsRuleFieldChangeAttempt={handleTdsRuleFieldChangeAttempt} setTdsRuleEffectiveDatesOpen={setTdsRuleEffectiveDatesOpen} />
      case 'oil_tags': return <OilTagForm oilTagForm={oilTagForm} setOilTagForm={setOilTagForm} editingItem={editingItem} handleOilTagFieldChangeAttempt={handleOilTagFieldChangeAttempt} setOilTagEffectiveDatesOpen={setOilTagEffectiveDatesOpen} />
      case 'bhada_rates': return <BhadaRateForm bhadaRateForm={bhadaRateForm} setBhadaRateForm={setBhadaRateForm} editingItem={editingItem} handleBhadaRateFieldChangeAttempt={handleBhadaRateFieldChangeAttempt} setBhadaRateEffectiveDatesOpen={setBhadaRateEffectiveDatesOpen} />
      case 'sku_details': return (
        <FinishedGoodsForm
          editingItem={editingItem}
          skuDetailsForm={skuDetailsForm}
          setSkuDetailsForm={setSkuDetailsForm}
          handleSkuFieldChangeAttempt={handleSkuFieldChangeAttempt}
          setSkuHistorySection={setSkuHistorySection}
          setSkuHistoryModalOpen={setSkuHistoryModalOpen}
          setSkuEffectiveDatesSection={setSkuEffectiveDatesSection}
          unitOptions={unitsList}
          semiFinishedGoodOptions={semiFinishedGoodsList}
          oilTagsList={oilTagsList}
          activeStockCategories={activeStockCategories}
          activeGstRates={activeGstRates}
          activeSacCodes={activeSacCodes}
          activeHsnCodes={activeHsnCodes}
          activeUqcCodes={activeUqcCodes}
          activeDepots={activeDepots}
          openingStockByDepot={openingStockByDepot}
          setOpeningStockByDepot={setOpeningStockByDepot}
        />
      )
      case 'sku_selling_price': return <SkuSellingPriceForm skuSellingPriceForm={skuSellingPriceForm} setSkuSellingPrice={setSkuSellingPrice} skuDetails={skuDetails} recalculateSkuSellingPrice={recalculateSkuSellingPrice} editingItem={editingItem} handleSkuSellingPriceFieldChangeAttempt={handleSkuSellingPriceFieldChangeAttempt} onOpenSkuSellingPriceHistory={() => setSkuSellingPriceEffectiveDatesOpen(true)} />
      case 'vehicle_master': return <VehicleForm vehicleForm={vehicleForm} setVehicleForm={setVehicleForm} vehicleFormErrors={vehicleFormErrors} setVehicleFormErrors={setVehicleFormErrors} roadTaxType={roadTaxType} setRoadTaxType={setRoadTaxType} sortedVehicleTransporters={sortedVehicleTransporters} transporterOptions={transporterOptions} activeRtoCodes={activeRtoCodes} handleFileUpload={handleFileUpload} handleFileRemove={handleFileRemove} editingItem={editingItem} handleVehicleFieldChangeAttempt={handleVehicleFieldChangeAttempt} setVehicleEffectiveDatesSection={setVehicleEffectiveDatesSection} />
      case 'driver_master': return <DriverForm driverForm={driverForm} setDriverForm={setDriverForm} activeRtoCodes={activeRtoCodes} activeStates={activeStates} handleFileUpload={handleFileUpload} handleFileRemove={handleFileRemove} editingItem={editingItem} handleDriverFieldChangeAttempt={handleDriverFieldChangeAttempt} setDriverEffectiveDatesSection={setDriverEffectiveDatesSection} />
      case 'transport_master': return <TransportForm transportForm={transportForm} setTransportForm={setTransportForm} ledgerGroupOptions={ledgerGroupOptions} customers={customers} activeStates={activeStates} activeGstRegStatuses={activeGstRegStatuses} activeGstRegTypes={activeGstRegTypes} activeMsmeRegTypes={activeMsmeRegTypes} activeFssaiLicenceTypes={activeFssaiLicenceTypes} handlePartyPanBlur={handlePartyPanBlur} handlePartyGstinBlur={handlePartyGstinBlur} partyFormErrors={partyFormErrors} handleFileUpload={handleFileUpload} handleFileRemove={handleFileRemove} editingItem={editingItem} handleTransportFieldChangeAttempt={handleTransportFieldChangeAttempt} setTransportEffectiveDatesSection={setTransportEffectiveDatesSection} />
      case 'states': return null
      case 'districts': return null
      case 'sub_districts': return null
      default: return null
    }
  }

  const APPROVAL_FIELD_LABELS: Record<string, string> = {
    customer_name: 'Customer Name', status: 'Status', contact_person: 'Contact Person', contact: 'Mobile',
    email: 'Email', email_id: 'Email', address_line_1: 'Address', address_line_2: 'Address 2', state: 'State',
    pincode: 'Pincode', pan: 'PAN', gstin: 'GSTIN', gst_registered: 'GST Registration Status',
    gst_registration_type: 'GST Registration Type', gst_registration_wef: 'GST W.E.F. Date',
    msme_registration_no: 'MSME Registration No', msme_registration_type: 'MSME Registration Type',
    msme_registration_wef: 'MSME W.E.F. Date', fssai_no: 'FSSAI No', fssai_valid_upto: 'FSSAI Valid Upto',
    fssai_licence_type: 'FSSAI Licence Type', pan_upload: 'PAN Card',
    // aadhaar_upload's label is defined once below (shared with the Driver Master field of
    // the same name - both are literally "Aadhaar Upload", no need for a second entry).
    gst_certificate_upload: 'GST Certificate', msme_certificate_upload: 'MSME Certificate',
    fssai_certificate_upload: 'FSSAI Certificate', is_required_for_commitment: 'Is Required for Commitment',
    depot_name: 'Depot Name', depot_address: 'Depot Address', salesman_broker_name: 'Salesman / Broker',
    salesman_name: 'Name', mobile_no: 'Mobile', sku_name: 'SKU Name', sku_code: 'SKU Code', main_uom: 'Main UOM',
    hsn_code: 'HSN Code', gst_rate: 'GST Rate', registration_no: 'Registration No', vehicle_type: 'Vehicle Type',
    transporter: 'Transporter', rto: 'RTO', rc_image: 'RC (Registration Certificate)', fuel_type: 'Fuel Type', gvw: 'GVW', ulw: 'ULW', passing: 'Passing Weight',
    road_tax: 'Road Tax Expiry', road_tax_image: 'Road Tax Certificate',
    life_time_tax: 'Lifetime Tax', life_time_tax_image: 'Lifetime Tax Certificate',
    pollution: 'Pollution Expiry', pollution_image: 'Pollution Certificate',
    insurance: 'Insurance Expiry', insurance_image: 'Insurance Certificate',
    fitness: 'Fitness Expiry', fitness_image: 'Fitness Certificate',
    state_permit_type: 'Permit Type', state_permit: 'State Permit Expiry', state_permit_image: 'State Permit Certificate',
    national_permit: 'National Permit Expiry', national_permit_image: 'National Permit Certificate',
    driver_name: 'Driver Name', driving_licence_no: 'DL Number', driving_licence_type: 'DL Type', valid_upto: 'Valid Upto',
    transporter_name: 'Transporter Name', contact_number: 'Contact Number',
    dl_upload: 'Driving Licence Upload', aadhaar_upload: 'Aadhaar Upload',
  }


  // Compact diff summary shown above the form for an "edit" approval request.
  const renderProposedChanges = () => {
    if (!approvalReviewModal || approvalReviewModal.item?.request_type !== 'edit') return null
    let pc = approvalReviewModal.item.pending_changes
    if (typeof pc === 'string') { try { pc = JSON.parse(pc) } catch { pc = null } }
    if (!pc) return null
    // 'addresses' is an array of objects, not a scalar - stringifying it here would
    // just show "[object Object],[object Object]". The full form below already
    // renders the proposed address list properly, so skip it in this summary.
    const changed = Object.keys(pc).filter(k => k !== 'addresses' && k !== 'godown_ids' && k !== 'bank_accounts' && String(pc[k] ?? '') !== String(approvalReviewModal.item[k] ?? ''))
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 space-y-1.5">
        <p className="text-xs font-semibold text-blue-800">Proposed changes to an existing record</p>
        {changed.length === 0 ? (
          <p className="text-xs text-blue-600">No field differs from the current record.</p>
        ) : (
          <div className="space-y-1">
            {changed.map(k => (
              <div key={k} className="text-xs flex flex-wrap gap-1">
                <span className="font-medium text-slate-600">{APPROVAL_FIELD_LABELS[k] || k}:</span>
                <span className="text-red-600 line-through">{String(approvalReviewModal.item[k] ?? '—') || '—'}</span>
                <span className="text-slate-400">→</span>
                <span className="text-emerald-700 font-medium">{String(pc[k] ?? '—') || '—'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // --- Filter Logic ---

  const filteredCustomers = customers.filter(c =>
    matchesSearch(c?.customer_name, searchTerm) ||
    matchesSearch(c?.customer_id, searchTerm)
  )

  const filteredDepots = depots.filter(d =>
    matchesSearch(d?.depot_name, searchTerm) ||
    matchesSearch(d?.depot_id, searchTerm)
  )

  const filteredBrokers = brokers.filter(b =>
    matchesSearch(b?.salesman_name, searchTerm) ||
    matchesSearch(b?.broker_id, searchTerm)
  )

  const filteredSkuDetails = skuDetails.filter(s =>
    matchesSearch(s?.sku_name, searchTerm) ||
    matchesSearch(s?.sku_code, searchTerm)
  )

  const filteredSalespersons = salespersons.filter(s =>
    matchesSearch(s?.salesman_name, searchTerm) ||
    matchesSearch(s?.broker_id, searchTerm)
  )

  const filteredLedgerGroups = ledgerGroupsList.filter((g: any) =>
    matchesSearch(g?.group_name, searchTerm) ||
    matchesSearch(g?.group_code, searchTerm)
  )

  const filteredStockGroups = stockGroupsList.filter((g: any) =>
    matchesSearch(g?.group_name, searchTerm) ||
    matchesSearch(g?.group_code, searchTerm)
  )

  const filteredUnits = unitsList.filter((u: any) =>
    matchesSearch(u?.unit_name, searchTerm) ||
    matchesSearch(u?.unit_code, searchTerm)
  )

  const filteredRawMaterials = rawMaterialsList.filter((r: any) =>
    matchesSearch(r?.name, searchTerm) ||
    matchesSearch(r?.raw_material_code, searchTerm)
  )

  const filteredSemiFinishedGoods = semiFinishedGoodsList.filter((r: any) =>
    matchesSearch(r?.name, searchTerm) ||
    matchesSearch(r?.semi_finished_good_code, searchTerm)
  )

  const filteredInsuranceDetails = insuranceDetailsList.filter((r: any) =>
    matchesSearch(r?.insurance_company_name, searchTerm) ||
    matchesSearch(r?.insurance_code, searchTerm) ||
    matchesSearch(r?.policy_number, searchTerm)
  )

  const filteredConversionFormulas = conversionFormulasList.filter((r: any) =>
    matchesSearch(r?.conversion_formula_code, searchTerm)
  )

  const filteredPriceLevels = priceLevelsList.filter((r: any) =>
    matchesSearch(r?.price_level_code, searchTerm)
  )

  const filteredPetrolPumps = petrolPumpsList.filter((r: any) =>
    matchesSearch(r?.petrol_pump_name, searchTerm) ||
    matchesSearch(r?.petrol_pump_code, searchTerm)
  )

  const filteredCdRules = cdRulesList.filter((r: any) =>
    matchesSearch(r?.cd_rule_code, searchTerm)
  )

  const filteredTdsRules = tdsRulesList.filter((r: any) =>
    matchesSearch(r?.name, searchTerm) || matchesSearch(r?.tds_rule_code, searchTerm)
  )

  const filteredBhadaRates = bhadaRatesList.filter((r: any) =>
    matchesSearch(r?.name, searchTerm) || matchesSearch(r?.bhada_rate_code, searchTerm)
  )

  const filteredSkuSellingPrices = skuSellingPrices.filter(s =>
    matchesSearch(s?.packing_material, searchTerm)
  )

  const filteredVehicles = vehicles.filter(v => {
    const matchesSearchTerm = matchesSearch(v?.registration_no, searchTerm) ||
      matchesSearch(v?.vehicle_master_id, searchTerm) ||
      matchesSearch(v?.transporter, searchTerm)
    const matchesType = selectedVehicleType === "all" || v?.vehicle_type === selectedVehicleType
    return matchesSearchTerm && matchesType
  })

  const filteredDrivers = drivers.filter(dr =>
    matchesSearch(dr?.driver_name, searchTerm) ||
    matchesSearch(dr?.driver_master_id, searchTerm) ||
    matchesSearch(dr?.mobile_no, searchTerm) ||
    matchesSearch(dr?.driving_licence_no, searchTerm)
  )

  const filteredTransporters = transporters.filter(t =>
    matchesSearch(t?.transporter_name, searchTerm) ||
    matchesSearch(t?.transport_master_id, searchTerm) ||
    matchesSearch(t?.contact_person, searchTerm) ||
    matchesSearch(t?.contact_number, searchTerm)
  )

  // --- Sort helpers ---
  type SortDir = 'asc' | 'desc'

  const sortData = <T extends Record<string, any>>(data: T[], col: string, dir: SortDir): T[] => {
    return [...data].sort((a, b) => {
      const av = (a && a[col]) ?? ''
      const bv = (b && b[col]) ?? ''
      return dir === 'asc'
        ? String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' })
        : String(bv).localeCompare(String(av), undefined, { numeric: true, sensitivity: 'base' })
    })
  }

  const toggleSort = (
    col: string,
    current: { col: string; dir: SortDir },
    setter: React.Dispatch<React.SetStateAction<{ col: string; dir: SortDir }>>
  ) => {
    setter(current.col === col ? { col, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })
  }

  const SortIcon = ({ col, sort }: { col: string; sort: { col: string; dir: SortDir } }) => {
    if (sort.col !== col) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-40 inline" />
    return sort.dir === 'asc'
      ? <ArrowUp className="ml-1 h-3 w-3 text-blue-600 inline" />
      : <ArrowDown className="ml-1 h-3 w-3 text-blue-600 inline" />
  }

  const sortedCustomers = sortData(filteredCustomers, customerSort.col, customerSort.dir)
  const sortedDepots = sortData(filteredDepots, depotSort.col, depotSort.dir)


  const sortedBrokers = sortData(filteredBrokers, brokerSort.col, brokerSort.dir)
  const sortedSalespersons = sortData(filteredSalespersons, salespersonSort.col, salespersonSort.dir)
  const sortedLedgerGroups = sortData(filteredLedgerGroups, ledgerGroupSort.col, ledgerGroupSort.dir)
  const sortedStockGroups = sortData(filteredStockGroups, stockGroupSort.col, stockGroupSort.dir)
  const sortedUnits = sortData(filteredUnits, unitSort.col, unitSort.dir)
  const sortedRawMaterials = sortData(filteredRawMaterials, rawMaterialSort.col, rawMaterialSort.dir)
  const sortedSemiFinishedGoods = sortData(filteredSemiFinishedGoods, semiFinishedGoodSort.col, semiFinishedGoodSort.dir)
  const sortedInsuranceDetails = sortData(filteredInsuranceDetails, insuranceDetailSort.col, insuranceDetailSort.dir)
  const sortedConversionFormulas = sortData(filteredConversionFormulas, conversionFormulaSort.col, conversionFormulaSort.dir)
  const sortedPriceLevels = sortData(filteredPriceLevels, priceLevelSort.col, priceLevelSort.dir)
  const sortedPetrolPumps = sortData(filteredPetrolPumps, petrolPumpSort.col, petrolPumpSort.dir)
  const sortedCdRules = sortData(filteredCdRules, cdRuleSort.col, cdRuleSort.dir)
  const sortedTdsRules = sortData(filteredTdsRules, tdsRuleSort.col, tdsRuleSort.dir)
  const sortedBhadaRates = sortData(filteredBhadaRates, bhadaRateSort.col, bhadaRateSort.dir)
  const sortedSkuDetails = sortData(filteredSkuDetails, skuSort.col, skuSort.dir)
  const sortedSkuSellingPrices = sortData(filteredSkuSellingPrices, skuSellingPriceSort.col, skuSellingPriceSort.dir)
  const sortedVehicles = sortData(filteredVehicles, vehicleSort.col, vehicleSort.dir)
  const sortedDrivers = sortData(filteredDrivers, driverSort.col, driverSort.dir)
  const sortedTransporters = sortData(filteredTransporters, transportSort.col, transportSort.dir)

  // --- Shared Helpers ---
  const formatDocDate = (dateStr?: string) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const renderDocCell = (expiry?: string, image?: string, type?: string) => {
    const formatted = formatDocDate(expiry)
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs">{type ? `${type} - ${formatted}` : formatted}</span>
        {image && (
          <a href={image} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
            <Eye className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    )
  }

  const handleFileUpload = async (file: File, field: string) => {

    try {
      const res = await orderApi.uploadFile(file)
      if (res.success) {
        if (activeTab === 'vehicle_master') {
          setVehicleForm((prev: any) => ({ ...prev, [field]: res.data.url }))
        } else if (activeTab === 'driver_master') {
          setDriverForm((prev: any) => ({ ...prev, [field]: res.data.url }))
        } else if (activeTab === 'customers') {
          setCustomerForm((prev: any) => ({ ...prev, [field]: res.data.url }))
        } else if (activeTab === 'depots') {
          setDepotForm((prev: any) => ({ ...prev, [field]: res.data.url }))
        } else if (activeTab === 'brokers' || activeTab === 'salespersons' || activeTab === 'transport_master' || activeTab === 'petrol_pumps') {
          setPartyForm({ [field]: res.data.url })
        }
        toast({ title: "Success", description: "Image uploaded successfully" })
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to upload image", variant: "destructive" })
    }
  }

  // Clears an uploaded file field to null. Submitted like any other edit -
  // for an approved record this stages as a pending edit an admin must
  // approve before the file is actually removed live; for a pending record
  // being reviewed, this is how an admin strips just the upload while
  // approving everything else (renderFormForTab reuses these same render
  // functions for the approval-review dialog).
  const handleFileRemove = (field: string) => {
    if (activeTab === 'vehicle_master') {
      setVehicleForm((prev: any) => ({ ...prev, [field]: '' }))
    } else if (activeTab === 'driver_master') {
      setDriverForm((prev: any) => ({ ...prev, [field]: '' }))
    } else if (activeTab === 'customers') {
      setCustomerForm((prev: any) => ({ ...prev, [field]: '' }))
    } else if (activeTab === 'depots') {
      setDepotForm((prev: any) => ({ ...prev, [field]: '' }))
    } else if (activeTab === 'brokers' || activeTab === 'salespersons' || activeTab === 'transport_master' || activeTab === 'petrol_pumps') {
      setPartyForm({ [field]: '' })
    }
  }

  // Normalizes (trim + uppercase) and format-validates PAN/GSTIN on blur, and
  // cross-checks the GSTIN's state code against the selected State's GST state
  // code. Mirrors the backend's authoritative check (validators/customerValidator.js)
  // for immediate feedback - the backend still re-validates on submit.
  const handlePanBlur = () => {
    const raw = (customerForm.pan || '').toString()
    if (!raw) { setCustomerFormErrors(prev => ({ ...prev, pan: undefined })); return }
    const normalized = normalizeGstField(raw)
    if (normalized !== raw) setCustomerForm(prev => ({ ...prev, pan: normalized }))
    setCustomerFormErrors(prev => ({
      ...prev,
      pan: PAN_REGEX.test(normalized) ? undefined : 'Invalid PAN format. Expected: ABCDE1234F'
    }))
  }

  const handleGstinBlur = () => {
    const raw = (customerForm.gstin || '').toString()
    if (!raw) { setCustomerFormErrors(prev => ({ ...prev, gstin: undefined })); return }
    const normalized = normalizeGstField(raw)
    if (normalized !== raw) setCustomerForm(prev => ({ ...prev, gstin: normalized }))
    if (!GSTIN_REGEX.test(normalized)) {
      setCustomerFormErrors(prev => ({ ...prev, gstin: 'Invalid GSTIN format. Expected 15 characters, e.g. 22ABCDE1234F1Z5' }))
      return
    }
    const selectedState = activeStates.find((s: any) => String(s.id) === String(customerForm.state_id))
    const gstStateCode = selectedState?.gst_state_code
    if (gstStateCode && normalized.slice(0, 2) !== gstStateCode) {
      setCustomerFormErrors(prev => ({ ...prev, gstin: `GSTIN state code (${normalized.slice(0, 2)}) does not match the selected State's GST state code (${gstStateCode})` }))
      return
    }
    setCustomerFormErrors(prev => ({ ...prev, gstin: undefined }))
  }

  const handlePincodeBlur = () => {
    const value = (customerForm.pincode || '').toString()
    if (!value) { setCustomerFormErrors(prev => ({ ...prev, pincode: undefined })); return }
    setCustomerFormErrors(prev => ({ ...prev, pincode: PINCODE_REGEX.test(value) ? undefined : 'PIN Code must be exactly 6 digits' }))
  }

  // Same PAN/GSTIN validation as Customer's, generalized across the four
  // Customer-Master-field-parity forms (Broker/Salesperson/Transport/Petrol
  // Pump) - only one of these tabs is ever open at a time.
  const getPartyForm = (): any => {
    if (activeTab === 'brokers') return brokerForm
    if (activeTab === 'salespersons') return salespersonForm
    if (activeTab === 'transport_master') return transportForm
    if (activeTab === 'petrol_pumps') return petrolPumpForm
    return {}
  }
  const setPartyForm = (patch: any) => {
    if (activeTab === 'brokers') setBrokerForm((prev: any) => ({ ...prev, ...patch }))
    else if (activeTab === 'salespersons') setSalespersonForm((prev: any) => ({ ...prev, ...patch }))
    else if (activeTab === 'transport_master') setTransportForm((prev: any) => ({ ...prev, ...patch }))
    else if (activeTab === 'petrol_pumps') setPetrolPumpForm((prev: any) => ({ ...prev, ...patch }))
  }
  const handlePartyPanBlur = () => {
    const raw = (getPartyForm().pan || '').toString()
    if (!raw) { setPartyFormErrors(prev => ({ ...prev, pan: undefined })); return }
    const normalized = normalizeGstField(raw)
    if (normalized !== raw) setPartyForm({ pan: normalized })
    setPartyFormErrors(prev => ({ ...prev, pan: PAN_REGEX.test(normalized) ? undefined : 'Invalid PAN format. Expected: ABCDE1234F' }))
  }
  const handlePartyGstinBlur = () => {
    const form = getPartyForm()
    const raw = (form.gstin || '').toString()
    if (!raw) { setPartyFormErrors(prev => ({ ...prev, gstin: undefined })); return }
    const normalized = normalizeGstField(raw)
    if (normalized !== raw) setPartyForm({ gstin: normalized })
    if (!GSTIN_REGEX.test(normalized)) {
      setPartyFormErrors(prev => ({ ...prev, gstin: 'Invalid GSTIN format. Expected 15 characters, e.g. 22ABCDE1234F1Z5' }))
      return
    }
    const selectedState = activeStates.find((s: any) => String(s.id) === String(form.state_id))
    const gstStateCode = selectedState?.gst_state_code
    if (gstStateCode && normalized.slice(0, 2) !== gstStateCode) {
      setPartyFormErrors(prev => ({ ...prev, gstin: `GSTIN state code (${normalized.slice(0, 2)}) does not match the selected State's GST state code (${gstStateCode})` }))
      return
    }
    setPartyFormErrors(prev => ({ ...prev, gstin: undefined }))
  }

  // Additional-address row management (customer_addresses child table). Cascading
  // reset: changing State clears District+Sub-District, changing District clears
  // Sub-District - mirrors the reference-data-tab.tsx parent-picker convention.
  const addAddressRow = () => {
    setCustomerForm(prev => ({ ...prev, addresses: [...(prev.addresses || []), blankCustomerAddress()] }))
  }
  const removeAddressRow = (index: number) => {
    setCustomerForm(prev => ({ ...prev, addresses: (prev.addresses || []).filter((_, i) => i !== index) }))
    setAddressErrors(prev => { const next = { ...prev }; delete next[index]; return next })
  }
  const updateAddressRow = (index: number, patch: Partial<CustomerAddress>) => {
    setCustomerForm(prev => ({
      ...prev,
      addresses: (prev.addresses || []).map((a, i) => (i === index ? { ...a, ...patch } : a)),
    }))
  }
  const handleAddressStateChange = (index: number, stateId: string) => {
    updateAddressRow(index, { state_id: stateId ? parseInt(stateId, 10) : null })
  }
  const handleAddressPincodeBlur = (index: number, value: string) => {
    if (!value) { setAddressErrors(prev => ({ ...prev, [index]: undefined })); return }
    setAddressErrors(prev => ({ ...prev, [index]: PINCODE_REGEX.test(value) ? undefined : 'PIN Code must be exactly 6 digits' }))
  }

  // Bank-account row management (customer_bank_accounts child table).
  const addBankAccountRow = () => {
    setCustomerForm(prev => ({ ...prev, bank_accounts: [...(prev.bank_accounts || []), blankCustomerBankAccount()] }))
  }
  const removeBankAccountRow = (index: number) => {
    setCustomerForm(prev => ({ ...prev, bank_accounts: (prev.bank_accounts || []).filter((_, i) => i !== index) }))
    setBankAccountErrors(prev => { const next = { ...prev }; delete next[index]; return next })
  }
  const updateBankAccountRow = (index: number, patch: Partial<CustomerBankAccount>) => {
    setCustomerForm(prev => ({
      ...prev,
      bank_accounts: (prev.bank_accounts || []).map((b, i) => (i === index ? { ...b, ...patch } : b)),
    }))
  }
  const handleBankAccountIfscBlur = (index: number, value: string) => {
    const normalized = value.trim().toUpperCase()
    if (normalized !== value) updateBankAccountRow(index, { ifsc_code: normalized })
    if (!normalized) { setBankAccountErrors(prev => ({ ...prev, [index]: undefined })); return }
    setBankAccountErrors(prev => ({ ...prev, [index]: IFSC_REGEX.test(normalized) ? undefined : 'Invalid IFSC format. Expected 11 characters, e.g. SBIN0001234' }))
  }

  // Units' edit form is just 2-3 fields, so the shared 1250px-wide dialog
  // leaves too much empty space. Trim it modestly (not down to a tiny popup)
  // for just that plain edit form - its own "Add Effective Date Version"
  // history view still needs the full-width table layout.
  const isUnitCompactForm = activeTab === 'units' && !unitEffectiveDatesOpen && !showAuditTrailView

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto min-h-screen space-y-4 md:space-y-6 animate-in fade-in duration-700">
      <PageHeader
        title="Master Data"
        description={TAB_META[activeTab]?.desc || "Manage your master data records"}
      >
        <div className="flex flex-wrap items-center gap-2 md:gap-4 w-full lg:w-auto">
          <div className="relative flex-1 min-w-[140px] max-w-full md:max-w-xs transition-all duration-300 focus-within:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder={`Search...`}
              className="pl-10 h-9 md:h-10 border-slate-200 focus:border-primary/30 focus:ring-primary/10 transition-all rounded-xl"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {activeTab === "vehicle_master" && (
            <div className="w-[180px]">
              <Select value={selectedVehicleType} onValueChange={setSelectedVehicleType}>
                <SelectTrigger className="h-9 md:h-10 border-slate-200 rounded-xl bg-white shadow-sm">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {uniqueVehicleTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-9 md:h-10 rounded-xl px-3 md:px-4 border-slate-200 hover:bg-slate-50 transition-all"
            onClick={() => {
              if (activeTab === "customers") { refetchCustomer(); refetchPendingCustomers() }
              else if (activeTab === "depots") { refetchDepot(); refetchPendingDepots() }
              else if (activeTab === "brokers") { refetchBroker(); refetchPendingBrokers() }
              else if (activeTab === "salespersons") { refetchSalesperson(); refetchPendingSalespersons() }
              else if (activeTab === "ledger_groups") { refetchLedgerGroup(); refetchPendingLedgerGroups() }
              else if (activeTab === "stock_groups") { refetchStockGroup(); refetchPendingStockGroups() }
              else if (activeTab === "units") { refetchUnit(); refetchPendingUnits() }
              else if (activeTab === "raw_materials") { refetchRawMaterial(); refetchPendingRawMaterials() }
              else if (activeTab === "semi_finished_goods") { refetchSemiFinishedGood(); refetchPendingSemiFinishedGoods() }
              else if (activeTab === "insurance_details") { refetchInsuranceDetail(); refetchPendingInsuranceDetails() }
              else if (activeTab === "conversion_formulas") { refetchConversionFormula(); refetchPendingConversionFormulas() }
              else if (activeTab === "price_levels") { refetchPriceLevel(); refetchPendingPriceLevels() }
              else if (activeTab === "petrol_pumps") { refetchPetrolPump(); refetchPendingPetrolPumps() }
              else if (activeTab === "cd_rules") { refetchCdRule(); refetchPendingCdRules() }
              else if (activeTab === "tds_rules") { refetchTdsRule(); refetchPendingTdsRules() }
              else if (activeTab === "bhada_rates") { refetchBhadaRate(); refetchPendingBhadaRates() }
              else if (activeTab === "sku_details") { refetchSku(); refetchPendingSku() }
              else if (activeTab === "sku_selling_price") refetchSkuSellingPrice()
              else if (activeTab === "vehicle_master") { refetchVehicle(); refetchPendingVehicles() }
              else if (activeTab === "driver_master") { refetchDriver(); refetchPendingDrivers() }
              else if (activeTab === "transport_master") { refetchTransport(); refetchPendingTransport() }
            }}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''} md:mr-2`} />
            <span className="hidden md:inline">Refresh</span>
          </Button>

          <MasterFieldChangeConfirmModal
            pendingFieldChangeConfirm={pendingFieldChangeConfirm}
            setPendingFieldChangeConfirm={setPendingFieldChangeConfirm}
            onConfirmEffectiveDates={(section, fieldName) => {
              setCustomerEffectiveDatesSection(section as any)
              setCustomerEffectiveDatesTargetField(fieldName)
            }}
          />



          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open)
            if (!open) resetForms()
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-9 md:h-10 bg-primary hover:bg-primary/90 shadow-lg px-3 md:px-4 rounded-xl transition-all" disabled={isMasterTabReadOnly} onClick={handleOpenAddDialog} title={isMasterTabReadOnly ? "View Only Access" : `Add New ${activeTab === 'customers' ? 'Customer' : activeTab === 'depots' ? 'Depot' : activeTab === 'brokers' ? 'Broker' : activeTab === 'salespersons' ? 'Salesperson' : activeTab === 'sku_details' ? 'Finished Good' : activeTab === 'sku_selling_price' ? 'SKU Pricing' : activeTab === 'transport_master' ? 'Transporter' : activeTab === 'ledger_groups' ? 'Ledger Group' : activeTab === 'stock_groups' ? 'Stock Group' : activeTab === 'units' ? 'Unit' : activeTab === 'raw_materials' ? 'Raw Material' : activeTab === 'semi_finished_goods' ? 'Semi Finished Good' : activeTab === 'conversion_formulas' ? 'Conversion Formula' : activeTab === 'price_levels' ? 'Price Level' : activeTab === 'petrol_pumps' ? 'Petrol Pump' : activeTab === 'cd_rules' ? 'Cash Discount Rule' : activeTab === 'tds_rules' ? 'TDS Rule' : activeTab === 'oil_tags' ? 'Oil Tag' : activeTab === 'bhada_rates' ? 'Bhada Rate' : activeTab.replace('_', ' ')}`}>
                <Plus className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Add {activeTab === 'customers' ? 'Customer' : activeTab === 'depots' ? 'Depot' : activeTab === 'brokers' ? 'Broker' : activeTab === 'salespersons' ? 'Salesperson' : activeTab === 'sku_details' ? 'Finished Good' : activeTab === 'sku_selling_price' ? 'SKU Pricing' : activeTab === 'transport_master' ? 'Transporter' : activeTab === 'ledger_groups' ? 'Ledger Group' : activeTab === 'stock_groups' ? 'Stock Group' : activeTab === 'units' ? 'Unit' : activeTab === 'raw_materials' ? 'Raw Material' : activeTab === 'semi_finished_goods' ? 'Semi Finished Good' : activeTab === 'conversion_formulas' ? 'Conversion Formula' : activeTab === 'price_levels' ? 'Price Level' : activeTab === 'petrol_pumps' ? 'Petrol Pump' : activeTab === 'cd_rules' ? 'Cash Discount Rule' : activeTab === 'tds_rules' ? 'TDS Rule' : activeTab === 'oil_tags' ? 'Oil Tag' : activeTab === 'bhada_rates' ? 'Bhada Rate' : activeTab.split('_')[0].charAt(0).toUpperCase() + activeTab.split('_')[0].slice(1)}</span>
              </Button>
            </DialogTrigger>
            <DialogContent className={`w-[95vw] ${isUnitCompactForm ? 'min-h-[440px]' : 'min-h-[580px]'} max-h-[90vh] overflow-y-auto`} style={{ maxWidth: isUnitCompactForm ? '820px' : '1250px' }}>
              <DialogTitle className="sr-only">
                {editingItem ? "Edit" : "Add New"} {activeTab.replace(/_/g, ' ')}
              </DialogTitle>
              {activeTab === 'customers' && customerEffectiveDatesSection !== null && editingItem?.id ? (
                <CustomerEffectiveDatesModalView
                  customerId={editingItem.id}
                  customerName={customerForm.customer_name || ""}
                  customerForm={customerForm}
                  initialSection={customerEffectiveDatesSection}
                  targetFieldName={customerEffectiveDatesTargetField || undefined}
                  onBack={async () => {
                    setCustomerEffectiveDatesSection(null)
                    setCustomerEffectiveDatesTargetField(null)
                    setShowAuditTrailView(false)
                    setSkuHistoryModalOpen(false)
                    setPriceLevelEffectiveDatesSection(null)
                    setSkuSellingPriceEffectiveDatesOpen(false)
                    setVehicleEffectiveDatesSection(null)
                    setDriverEffectiveDatesSection(null)
                    setTransportEffectiveDatesSection(null)
                    setLedgerGroupEffectiveDatesOpen(false)
                    setStockGroupEffectiveDatesOpen(false)
                    setDepotEffectiveDatesSection(null)
                    setBrokerEffectiveDatesSection(null)
                    setPetrolPumpEffectiveDatesSection(null)
                    setSalespersonEffectiveDatesSection(null)
                    setUnitEffectiveDatesOpen(false)
                    setRawMaterialEffectiveDatesSection(null)
                    setSemiFinishedGoodEffectiveDatesSection(null)
                    setInsuranceDetailEffectiveDatesOpen(false)
                    setConversionFormulaEffectiveDatesOpen(false)
                    setCdRuleEffectiveDatesOpen(false)
                    if (editingItem?.id) {
                      const res = await customerApi.getById(editingItem.id)
                      if (res?.success && res.data) {
                        populateFormFromData('customers', res.data)
                      }
                    }
                  }}
                />
              ) : activeTab === 'sku_details' && skuEffectiveDatesSection !== null && editingItem?.id ? (
                <SkuEffectiveDatesModalView
                  skuId={editingItem.id}
                  skuName={skuDetailsForm.sku_name || ''}
                  skuForm={skuDetailsForm}
                  initialSection={skuEffectiveDatesSection}
                  targetFieldName={skuEffectiveDatesTargetField || undefined}
                  unitOptions={unitsList}
                  semiFinishedGoodOptions={semiFinishedGoodsList}
                  oilTagsList={oilTagsList}
                  activeStockCategories={activeStockCategories}
                  activeGstRates={activeGstRates}
                  activeSacCodes={activeSacCodes}
                  activeHsnCodes={activeHsnCodes}
                  activeUqcCodes={activeUqcCodes}
                  activeDepots={activeDepots}
                  openingStockByDepot={openingStockByDepot}
                  onSkuUpdated={(data) => populateFormFromData('sku_details', data)}
                  onBack={async () => {
                    setSkuEffectiveDatesSection(null)
                    setSkuEffectiveDatesTargetField(null)
                    setShowAuditTrailView(false)
                    setSkuHistoryModalOpen(false)
                    setPriceLevelEffectiveDatesSection(null)
                    setSkuSellingPriceEffectiveDatesOpen(false)
                    setVehicleEffectiveDatesSection(null)
                    setDriverEffectiveDatesSection(null)
                    setTransportEffectiveDatesSection(null)
                    setLedgerGroupEffectiveDatesOpen(false)
                    setStockGroupEffectiveDatesOpen(false)
                    setDepotEffectiveDatesSection(null)
                    setBrokerEffectiveDatesSection(null)
                    setPetrolPumpEffectiveDatesSection(null)
                    setSalespersonEffectiveDatesSection(null)
                    setUnitEffectiveDatesOpen(false)
                    setRawMaterialEffectiveDatesSection(null)
                    setSemiFinishedGoodEffectiveDatesSection(null)
                    setInsuranceDetailEffectiveDatesOpen(false)
                    setConversionFormulaEffectiveDatesOpen(false)
                    setCdRuleEffectiveDatesOpen(false)
                    if (editingItem?.id) {
                      const res = await skuDetailsApi.getById(editingItem.id)
                      if (res?.success && res.data) {
                        populateFormFromData('sku_details', res.data)
                      }
                    }
                  }}
                />
              ) : activeTab === 'price_levels' && priceLevelEffectiveDatesSection !== null && editingItem?.id ? (
                <PriceLevelEffectiveDatesModalView
                  priceLevelId={editingItem.id}
                  priceLevelCode={priceLevelForm.price_level_code || ''}
                  priceLevelForm={priceLevelForm}
                  initialSection={priceLevelEffectiveDatesSection}
                  targetFieldName={priceLevelEffectiveDatesTargetField || undefined}
                  skuOptions={skuDetails}
                  onPriceLevelUpdated={(data) => { populateFormFromData('price_levels', data); refetchPriceLevel() }}
                  onBack={async () => {
                    setPriceLevelEffectiveDatesSection(null)
                    setSkuSellingPriceEffectiveDatesOpen(false)
                    setVehicleEffectiveDatesSection(null)
                    setDriverEffectiveDatesSection(null)
                    setTransportEffectiveDatesSection(null)
                    setLedgerGroupEffectiveDatesOpen(false)
                    setStockGroupEffectiveDatesOpen(false)
                    setDepotEffectiveDatesSection(null)
                    setBrokerEffectiveDatesSection(null)
                    setPetrolPumpEffectiveDatesSection(null)
                    setSalespersonEffectiveDatesSection(null)
                    setUnitEffectiveDatesOpen(false)
                    setRawMaterialEffectiveDatesSection(null)
                    setSemiFinishedGoodEffectiveDatesSection(null)
                    setInsuranceDetailEffectiveDatesOpen(false)
                    setConversionFormulaEffectiveDatesOpen(false)
                    setCdRuleEffectiveDatesOpen(false)
                    setPriceLevelEffectiveDatesTargetField(null)
                    setShowAuditTrailView(false)
                    setSkuHistoryModalOpen(false)
                    setCustomerEffectiveDatesSection(null)
                    setSkuEffectiveDatesSection(null)
                    if (editingItem?.id) {
                      const res = await priceLevelApi.getById(String(editingItem.id))
                      if (res?.success && res.data) {
                        populateFormFromData('price_levels', res.data)
                      }
                    }
                  }}
                />
              ) : activeTab === 'sku_selling_price' && skuSellingPriceEffectiveDatesOpen && editingItem?.id ? (
                <SkuSellingPriceEffectiveDatesModalView
                  skuSellingPriceId={editingItem.id}
                  packingMaterial={skuSellingPriceForm.packing_material || ''}
                  skuSellingPriceForm={skuSellingPriceForm}
                  targetFieldName={skuSellingPriceTargetField || undefined}
                  gt={parseFloat(latestVarCalc?.gt) || 0}
                  onSkuSellingPriceUpdated={(data) => {
                    populateFormFromData('sku_selling_price', data)
                    refetchSkuSellingPrice()
                  }}
                  onBack={() => {
                    setSkuSellingPriceEffectiveDatesOpen(false)
                    setVehicleEffectiveDatesSection(null)
                    setDriverEffectiveDatesSection(null)
                    setTransportEffectiveDatesSection(null)
                    setLedgerGroupEffectiveDatesOpen(false)
                    setStockGroupEffectiveDatesOpen(false)
                    setDepotEffectiveDatesSection(null)
                    setBrokerEffectiveDatesSection(null)
                    setPetrolPumpEffectiveDatesSection(null)
                    setSalespersonEffectiveDatesSection(null)
                    setUnitEffectiveDatesOpen(false)
                    setRawMaterialEffectiveDatesSection(null)
                    setSemiFinishedGoodEffectiveDatesSection(null)
                    setInsuranceDetailEffectiveDatesOpen(false)
                    setConversionFormulaEffectiveDatesOpen(false)
                    setCdRuleEffectiveDatesOpen(false)
                    setSkuSellingPriceTargetField(null)
                    setShowAuditTrailView(false)
                    setSkuHistoryModalOpen(false)
                    setCustomerEffectiveDatesSection(null)
                    setSkuEffectiveDatesSection(null)
                    setPriceLevelEffectiveDatesSection(null)
                    setVehicleEffectiveDatesSection(null)
                    setDriverEffectiveDatesSection(null)
                    setTransportEffectiveDatesSection(null)
                    setLedgerGroupEffectiveDatesOpen(false)
                    setStockGroupEffectiveDatesOpen(false)
                    setDepotEffectiveDatesSection(null)
                    setBrokerEffectiveDatesSection(null)
                    setPetrolPumpEffectiveDatesSection(null)
                    setSalespersonEffectiveDatesSection(null)
                    setUnitEffectiveDatesOpen(false)
                    setRawMaterialEffectiveDatesSection(null)
                    setSemiFinishedGoodEffectiveDatesSection(null)
                    setInsuranceDetailEffectiveDatesOpen(false)
                    setConversionFormulaEffectiveDatesOpen(false)
                    setCdRuleEffectiveDatesOpen(false)
                  }}
                />
              ) : activeTab === 'vehicle_master' && vehicleEffectiveDatesSection !== null && editingItem?.id ? (
                <VehicleEffectiveDatesModalView
                  vehicleId={editingItem.id}
                  registrationNo={vehicleForm.registration_no || ''}
                  vehicleForm={vehicleForm}
                  initialSection={vehicleEffectiveDatesSection}
                  targetFieldName={vehicleEffectiveDatesTargetField || undefined}
                  transporterOptions={transporterOptions}
                  activeRtoCodes={activeRtoCodes}
                  onVehicleUpdated={(data) => { populateFormFromData('vehicle_master', data); refetchVehicle() }}
                  onBack={async () => {
                    setVehicleEffectiveDatesSection(null)
                    setDriverEffectiveDatesSection(null)
                    setTransportEffectiveDatesSection(null)
                    setLedgerGroupEffectiveDatesOpen(false)
                    setStockGroupEffectiveDatesOpen(false)
                    setDepotEffectiveDatesSection(null)
                    setBrokerEffectiveDatesSection(null)
                    setPetrolPumpEffectiveDatesSection(null)
                    setSalespersonEffectiveDatesSection(null)
                    setUnitEffectiveDatesOpen(false)
                    setRawMaterialEffectiveDatesSection(null)
                    setSemiFinishedGoodEffectiveDatesSection(null)
                    setInsuranceDetailEffectiveDatesOpen(false)
                    setConversionFormulaEffectiveDatesOpen(false)
                    setCdRuleEffectiveDatesOpen(false)
                    setVehicleEffectiveDatesTargetField(null)
                    setShowAuditTrailView(false)
                    setSkuHistoryModalOpen(false)
                    setCustomerEffectiveDatesSection(null)
                    setSkuEffectiveDatesSection(null)
                    setPriceLevelEffectiveDatesSection(null)
                    setSkuSellingPriceEffectiveDatesOpen(false)
                    setVehicleEffectiveDatesSection(null)
                    setDriverEffectiveDatesSection(null)
                    setTransportEffectiveDatesSection(null)
                    setLedgerGroupEffectiveDatesOpen(false)
                    setStockGroupEffectiveDatesOpen(false)
                    setDepotEffectiveDatesSection(null)
                    setBrokerEffectiveDatesSection(null)
                    setPetrolPumpEffectiveDatesSection(null)
                    setSalespersonEffectiveDatesSection(null)
                    setUnitEffectiveDatesOpen(false)
                    setRawMaterialEffectiveDatesSection(null)
                    setSemiFinishedGoodEffectiveDatesSection(null)
                    setInsuranceDetailEffectiveDatesOpen(false)
                    setConversionFormulaEffectiveDatesOpen(false)
                    setCdRuleEffectiveDatesOpen(false)
                    if (editingItem?.id) {
                      const res = await vehicleMasterApi.getById(editingItem.id)
                      if (res?.success && res.data) {
                        populateFormFromData('vehicle_master', res.data)
                      }
                    }
                  }}
                />
              ) : activeTab === 'driver_master' && driverEffectiveDatesSection !== null && editingItem?.id ? (
                <DriverEffectiveDatesModalView
                  driverId={editingItem.id}
                  driverName={driverForm.driver_name || ''}
                  driverForm={driverForm}
                  initialSection={driverEffectiveDatesSection}
                  targetFieldName={driverEffectiveDatesTargetField || undefined}
                  activeRtoCodes={activeRtoCodes}
                  activeStates={activeStates}
                  onDriverUpdated={(data) => { populateFormFromData('driver_master', data); refetchDriver() }}
                  onBack={async () => {
                    setDriverEffectiveDatesSection(null)
                    setTransportEffectiveDatesSection(null)
                    setLedgerGroupEffectiveDatesOpen(false)
                    setStockGroupEffectiveDatesOpen(false)
                    setDepotEffectiveDatesSection(null)
                    setBrokerEffectiveDatesSection(null)
                    setPetrolPumpEffectiveDatesSection(null)
                    setSalespersonEffectiveDatesSection(null)
                    setUnitEffectiveDatesOpen(false)
                    setRawMaterialEffectiveDatesSection(null)
                    setSemiFinishedGoodEffectiveDatesSection(null)
                    setInsuranceDetailEffectiveDatesOpen(false)
                    setConversionFormulaEffectiveDatesOpen(false)
                    setCdRuleEffectiveDatesOpen(false)
                    setDriverEffectiveDatesTargetField(null)
                    setShowAuditTrailView(false)
                    setSkuHistoryModalOpen(false)
                    setCustomerEffectiveDatesSection(null)
                    setSkuEffectiveDatesSection(null)
                    setPriceLevelEffectiveDatesSection(null)
                    setSkuSellingPriceEffectiveDatesOpen(false)
                    setVehicleEffectiveDatesSection(null)
                    setDriverEffectiveDatesSection(null)
                    setTransportEffectiveDatesSection(null)
                    setLedgerGroupEffectiveDatesOpen(false)
                    setStockGroupEffectiveDatesOpen(false)
                    setDepotEffectiveDatesSection(null)
                    setBrokerEffectiveDatesSection(null)
                    setPetrolPumpEffectiveDatesSection(null)
                    setSalespersonEffectiveDatesSection(null)
                    setUnitEffectiveDatesOpen(false)
                    setRawMaterialEffectiveDatesSection(null)
                    setSemiFinishedGoodEffectiveDatesSection(null)
                    setInsuranceDetailEffectiveDatesOpen(false)
                    setConversionFormulaEffectiveDatesOpen(false)
                    setCdRuleEffectiveDatesOpen(false)
                    setDriverEffectiveDatesSection(null)
                    setTransportEffectiveDatesSection(null)
                    setLedgerGroupEffectiveDatesOpen(false)
                    setStockGroupEffectiveDatesOpen(false)
                    setDepotEffectiveDatesSection(null)
                    setBrokerEffectiveDatesSection(null)
                    setPetrolPumpEffectiveDatesSection(null)
                    setSalespersonEffectiveDatesSection(null)
                    setUnitEffectiveDatesOpen(false)
                    setRawMaterialEffectiveDatesSection(null)
                    setSemiFinishedGoodEffectiveDatesSection(null)
                    setInsuranceDetailEffectiveDatesOpen(false)
                    setConversionFormulaEffectiveDatesOpen(false)
                    setCdRuleEffectiveDatesOpen(false)
                    if (editingItem?.id) {
                      const res = await driverMasterApi.getById(editingItem.id)
                      if (res?.success && res.data) {
                        populateFormFromData('driver_master', res.data)
                      }
                    }
                  }}
                />
              ) : activeTab === 'transport_master' && transportEffectiveDatesSection !== null && editingItem?.id ? (
                <TransportEffectiveDatesModalView
                  transportId={editingItem.id}
                  transporterName={transportForm.transporter_name || ''}
                  transportForm={transportForm}
                  initialSection={transportEffectiveDatesSection}
                  targetFieldName={transportEffectiveDatesTargetField || undefined}
                  ledgerGroupOptions={ledgerGroupOptions}
                  customers={customers}
                  activeStates={activeStates}
                  activeGstRegStatuses={activeGstRegStatuses}
                  activeGstRegTypes={activeGstRegTypes}
                  activeMsmeRegTypes={activeMsmeRegTypes}
                  activeFssaiLicenceTypes={activeFssaiLicenceTypes}
                  onTransportUpdated={(data) => { populateFormFromData('transport_master', data); refetchTransport() }}
                  onBack={async () => {
                    setTransportEffectiveDatesSection(null)
                    setLedgerGroupEffectiveDatesOpen(false)
                    setStockGroupEffectiveDatesOpen(false)
                    setDepotEffectiveDatesSection(null)
                    setBrokerEffectiveDatesSection(null)
                    setPetrolPumpEffectiveDatesSection(null)
                    setSalespersonEffectiveDatesSection(null)
                    setUnitEffectiveDatesOpen(false)
                    setRawMaterialEffectiveDatesSection(null)
                    setSemiFinishedGoodEffectiveDatesSection(null)
                    setInsuranceDetailEffectiveDatesOpen(false)
                    setConversionFormulaEffectiveDatesOpen(false)
                    setCdRuleEffectiveDatesOpen(false)
                    setTransportEffectiveDatesTargetField(null)
                    setShowAuditTrailView(false)
                    setSkuHistoryModalOpen(false)
                    setCustomerEffectiveDatesSection(null)
                    setSkuEffectiveDatesSection(null)
                    setPriceLevelEffectiveDatesSection(null)
                    setSkuSellingPriceEffectiveDatesOpen(false)
                    setVehicleEffectiveDatesSection(null)
                    setDriverEffectiveDatesSection(null)
                    setTransportEffectiveDatesSection(null)
                    setLedgerGroupEffectiveDatesOpen(false)
                    setStockGroupEffectiveDatesOpen(false)
                    setDepotEffectiveDatesSection(null)
                    setBrokerEffectiveDatesSection(null)
                    setPetrolPumpEffectiveDatesSection(null)
                    setSalespersonEffectiveDatesSection(null)
                    setUnitEffectiveDatesOpen(false)
                    setRawMaterialEffectiveDatesSection(null)
                    setSemiFinishedGoodEffectiveDatesSection(null)
                    setInsuranceDetailEffectiveDatesOpen(false)
                    setConversionFormulaEffectiveDatesOpen(false)
                    setCdRuleEffectiveDatesOpen(false)
                    setTransportEffectiveDatesSection(null)
                    setLedgerGroupEffectiveDatesOpen(false)
                    setStockGroupEffectiveDatesOpen(false)
                    setDepotEffectiveDatesSection(null)
                    setBrokerEffectiveDatesSection(null)
                    setPetrolPumpEffectiveDatesSection(null)
                    setSalespersonEffectiveDatesSection(null)
                    setUnitEffectiveDatesOpen(false)
                    setRawMaterialEffectiveDatesSection(null)
                    setSemiFinishedGoodEffectiveDatesSection(null)
                    setInsuranceDetailEffectiveDatesOpen(false)
                    setConversionFormulaEffectiveDatesOpen(false)
                    setCdRuleEffectiveDatesOpen(false)
                    if (editingItem?.id) {
                      const res = await transportMasterApi.getById(editingItem.id)
                      if (res?.success && res.data) {
                        populateFormFromData('transport_master', res.data)
                      }
                    }
                  }}
                />
              ) : activeTab === 'ledger_groups' && ledgerGroupEffectiveDatesOpen && editingItem?.id ? (
                <LedgerGroupEffectiveDatesModalView
                  ledgerGroupId={editingItem.id}
                  groupName={ledgerGroupForm.group_name || ''}
                  ledgerGroupForm={ledgerGroupForm}
                  ledgerGroupOptionsData={ledgerGroupOptionsData}
                  targetFieldName={ledgerGroupTargetField || undefined}
                  onLedgerGroupUpdated={(data) => { populateFormFromData('ledger_groups', data); refetchLedgerGroup() }}
                  onBack={async () => {
                    setLedgerGroupEffectiveDatesOpen(false)
                    setStockGroupEffectiveDatesOpen(false)
                    setDepotEffectiveDatesSection(null)
                    setBrokerEffectiveDatesSection(null)
                    setPetrolPumpEffectiveDatesSection(null)
                    setSalespersonEffectiveDatesSection(null)
                    setUnitEffectiveDatesOpen(false)
                    setRawMaterialEffectiveDatesSection(null)
                    setSemiFinishedGoodEffectiveDatesSection(null)
                    setInsuranceDetailEffectiveDatesOpen(false)
                    setConversionFormulaEffectiveDatesOpen(false)
                    setCdRuleEffectiveDatesOpen(false)
                    setLedgerGroupTargetField(null)
                    setShowAuditTrailView(false)
                    setSkuHistoryModalOpen(false)
                    setCustomerEffectiveDatesSection(null)
                    setSkuEffectiveDatesSection(null)
                    setPriceLevelEffectiveDatesSection(null)
                    setSkuSellingPriceEffectiveDatesOpen(false)
                    setVehicleEffectiveDatesSection(null)
                    setDriverEffectiveDatesSection(null)
                    setTransportEffectiveDatesSection(null)
                    setLedgerGroupEffectiveDatesOpen(false)
                    setStockGroupEffectiveDatesOpen(false)
                    setDepotEffectiveDatesSection(null)
                    setBrokerEffectiveDatesSection(null)
                    setPetrolPumpEffectiveDatesSection(null)
                    setSalespersonEffectiveDatesSection(null)
                    setUnitEffectiveDatesOpen(false)
                    setRawMaterialEffectiveDatesSection(null)
                    setSemiFinishedGoodEffectiveDatesSection(null)
                    setInsuranceDetailEffectiveDatesOpen(false)
                    setConversionFormulaEffectiveDatesOpen(false)
                    setCdRuleEffectiveDatesOpen(false)
                    setLedgerGroupEffectiveDatesOpen(false)
                    setStockGroupEffectiveDatesOpen(false)
                    setDepotEffectiveDatesSection(null)
                    setBrokerEffectiveDatesSection(null)
                    setPetrolPumpEffectiveDatesSection(null)
                    setSalespersonEffectiveDatesSection(null)
                    setUnitEffectiveDatesOpen(false)
                    setRawMaterialEffectiveDatesSection(null)
                    setSemiFinishedGoodEffectiveDatesSection(null)
                    setInsuranceDetailEffectiveDatesOpen(false)
                    setConversionFormulaEffectiveDatesOpen(false)
                    setCdRuleEffectiveDatesOpen(false)
                    if (editingItem?.id) {
                      const res = await ledgerGroupApi.getById(String(editingItem.id))
                      if (res?.success && res.data) {
                        populateFormFromData('ledger_groups', res.data)
                      }
                    }
                  }}
                />
              ) : activeTab === 'stock_groups' && stockGroupEffectiveDatesOpen && editingItem?.id ? (
                <StockGroupEffectiveDatesModalView
                  stockGroupId={editingItem.id}
                  groupName={stockGroupForm.group_name || ''}
                  stockGroupForm={stockGroupForm}
                  stockGroupOptionsData={stockGroupOptionsData}
                  targetFieldName={stockGroupTargetField || undefined}
                  onStockGroupUpdated={(data) => { populateFormFromData('stock_groups', data); refetchStockGroup() }}
                  onBack={async () => {
                    setStockGroupEffectiveDatesOpen(false)
                    setDepotEffectiveDatesSection(null)
                    setBrokerEffectiveDatesSection(null)
                    setPetrolPumpEffectiveDatesSection(null)
                    setSalespersonEffectiveDatesSection(null)
                    setUnitEffectiveDatesOpen(false)
                    setRawMaterialEffectiveDatesSection(null)
                    setSemiFinishedGoodEffectiveDatesSection(null)
                    setInsuranceDetailEffectiveDatesOpen(false)
                    setConversionFormulaEffectiveDatesOpen(false)
                    setCdRuleEffectiveDatesOpen(false)
                    setStockGroupTargetField(null)
                    setShowAuditTrailView(false)
                    setSkuHistoryModalOpen(false)
                    setCustomerEffectiveDatesSection(null)
                    setSkuEffectiveDatesSection(null)
                    setPriceLevelEffectiveDatesSection(null)
                    setSkuSellingPriceEffectiveDatesOpen(false)
                    setVehicleEffectiveDatesSection(null)
                    setDriverEffectiveDatesSection(null)
                    setTransportEffectiveDatesSection(null)
                    setLedgerGroupEffectiveDatesOpen(false)
                    setStockGroupEffectiveDatesOpen(false)
                    setDepotEffectiveDatesSection(null)
                    setBrokerEffectiveDatesSection(null)
                    setPetrolPumpEffectiveDatesSection(null)
                    setSalespersonEffectiveDatesSection(null)
                    setUnitEffectiveDatesOpen(false)
                    setRawMaterialEffectiveDatesSection(null)
                    setSemiFinishedGoodEffectiveDatesSection(null)
                    setInsuranceDetailEffectiveDatesOpen(false)
                    setConversionFormulaEffectiveDatesOpen(false)
                    setCdRuleEffectiveDatesOpen(false)
                    setStockGroupEffectiveDatesOpen(false)
                    setDepotEffectiveDatesSection(null)
                    setBrokerEffectiveDatesSection(null)
                    setPetrolPumpEffectiveDatesSection(null)
                    setSalespersonEffectiveDatesSection(null)
                    setUnitEffectiveDatesOpen(false)
                    setRawMaterialEffectiveDatesSection(null)
                    setSemiFinishedGoodEffectiveDatesSection(null)
                    setInsuranceDetailEffectiveDatesOpen(false)
                    setConversionFormulaEffectiveDatesOpen(false)
                    setCdRuleEffectiveDatesOpen(false)
                    if (editingItem?.id) {
                      const res = await stockGroupApi.getById(String(editingItem.id))
                      if (res?.success && res.data) {
                        populateFormFromData('stock_groups', res.data)
                      }
                    }
                  }}
                />
              ) : activeTab === 'depots' && depotEffectiveDatesSection !== null && editingItem?.id ? (
                <DepotEffectiveDatesModalView
                  depotId={editingItem.id}
                  depotName={depotForm.depot_name || ''}
                  depotForm={depotForm}
                  initialSection={depotEffectiveDatesSection}
                  targetFieldName={depotEffectiveDatesTargetField || undefined}
                  brokerOptions={brokerOptions}
                  salespersonOptions={salespersonOptions}
                  activeStates={activeStates}
                  onDepotUpdated={(data) => { populateFormFromData('depots', data); refetchDepot() }}
                  onBack={async () => {
                    setDepotEffectiveDatesSection(null)
                    setDepotEffectiveDatesTargetField(null)
                    setShowAuditTrailView(false)
                    setSkuHistoryModalOpen(false)
                    setCustomerEffectiveDatesSection(null)
                    setSkuEffectiveDatesSection(null)
                    setPriceLevelEffectiveDatesSection(null)
                    setSkuSellingPriceEffectiveDatesOpen(false)
                    setVehicleEffectiveDatesSection(null)
                    setDriverEffectiveDatesSection(null)
                    setTransportEffectiveDatesSection(null)
                    setLedgerGroupEffectiveDatesOpen(false)
                    setStockGroupEffectiveDatesOpen(false)
                    setDepotEffectiveDatesSection(null)
                    setBrokerEffectiveDatesSection(null)
                    setPetrolPumpEffectiveDatesSection(null)
                    setSalespersonEffectiveDatesSection(null)
                    setUnitEffectiveDatesOpen(false)
                    setRawMaterialEffectiveDatesSection(null)
                    setSemiFinishedGoodEffectiveDatesSection(null)
                    setInsuranceDetailEffectiveDatesOpen(false)
                    setConversionFormulaEffectiveDatesOpen(false)
                    setCdRuleEffectiveDatesOpen(false)
                    setDepotEffectiveDatesSection(null)
                    if (editingItem?.id) {
                      const res = await depotApi.getById(String(editingItem.id))
                      if (res?.success && res.data) {
                        populateFormFromData('depots', res.data)
                      }
                    }
                  }}
                />
              ) : activeTab === 'brokers' && brokerEffectiveDatesSection !== null && editingItem?.id ? (
                <BrokerEffectiveDatesModalView
                  brokerId={editingItem.id}
                  brokerName={brokerForm.salesman_name || ''}
                  brokerForm={brokerForm}
                  initialSection={brokerEffectiveDatesSection}
                  targetFieldName={brokerEffectiveDatesTargetField || undefined}
                  ledgerGroupOptions={ledgerGroupOptions}
                  activeStates={activeStates}
                  activeGstRegStatuses={activeGstRegStatuses}
                  activeGstRegTypes={activeGstRegTypes}
                  activeMsmeRegTypes={activeMsmeRegTypes}
                  activeFssaiLicenceTypes={activeFssaiLicenceTypes}
                  onBrokerUpdated={(data) => { populateFormFromData('brokers', data); refetchBroker() }}
                  onBack={async () => {
                    setBrokerEffectiveDatesSection(null)
                    setPetrolPumpEffectiveDatesSection(null)
                    setBrokerEffectiveDatesTargetField(null)
                    setShowAuditTrailView(false)
                    setSkuHistoryModalOpen(false)
                    setCustomerEffectiveDatesSection(null)
                    setSkuEffectiveDatesSection(null)
                    setPriceLevelEffectiveDatesSection(null)
                    setSkuSellingPriceEffectiveDatesOpen(false)
                    setVehicleEffectiveDatesSection(null)
                    setDriverEffectiveDatesSection(null)
                    setTransportEffectiveDatesSection(null)
                    setLedgerGroupEffectiveDatesOpen(false)
                    setStockGroupEffectiveDatesOpen(false)
                    setDepotEffectiveDatesSection(null)
                    setBrokerEffectiveDatesSection(null)
                    setPetrolPumpEffectiveDatesSection(null)
                    setSalespersonEffectiveDatesSection(null)
                    setUnitEffectiveDatesOpen(false)
                    setRawMaterialEffectiveDatesSection(null)
                    setSemiFinishedGoodEffectiveDatesSection(null)
                    setInsuranceDetailEffectiveDatesOpen(false)
                    setConversionFormulaEffectiveDatesOpen(false)
                    setCdRuleEffectiveDatesOpen(false)
                    setDepotEffectiveDatesSection(null)
                    setBrokerEffectiveDatesSection(null)
                    setPetrolPumpEffectiveDatesSection(null)
                    if (editingItem?.id) {
                      const res = await brokerApi.getById(String(editingItem.id))
                      if (res?.success && res.data) {
                        populateFormFromData('brokers', res.data)
                      }
                    }
                  }}
                />
              ) : activeTab === 'salespersons' && salespersonEffectiveDatesSection !== null && editingItem?.id ? (
                <SalespersonEffectiveDatesModalView
                  salespersonId={editingItem.id}
                  salespersonName={salespersonForm.salesman_name || ''}
                  salespersonForm={salespersonForm}
                  initialSection={salespersonEffectiveDatesSection}
                  targetFieldName={salespersonEffectiveDatesTargetField || undefined}
                  ledgerGroupOptions={ledgerGroupOptions}
                  activeStates={activeStates}
                  activeGstRegStatuses={activeGstRegStatuses}
                  activeGstRegTypes={activeGstRegTypes}
                  activeMsmeRegTypes={activeMsmeRegTypes}
                  activeFssaiLicenceTypes={activeFssaiLicenceTypes}
                  onSalespersonUpdated={(data) => { populateFormFromData('salespersons', data); refetchSalesperson() }}
                  onBack={async () => {
                    setSalespersonEffectiveDatesSection(null)
                    setUnitEffectiveDatesOpen(false)
                    setRawMaterialEffectiveDatesSection(null)
                    setSemiFinishedGoodEffectiveDatesSection(null)
                    setInsuranceDetailEffectiveDatesOpen(false)
                    setConversionFormulaEffectiveDatesOpen(false)
                    setCdRuleEffectiveDatesOpen(false)
                    setSalespersonEffectiveDatesTargetField(null)
                    setShowAuditTrailView(false)
                    setSkuHistoryModalOpen(false)
                    setCustomerEffectiveDatesSection(null)
                    setSkuEffectiveDatesSection(null)
                    setPriceLevelEffectiveDatesSection(null)
                    setSkuSellingPriceEffectiveDatesOpen(false)
                    setVehicleEffectiveDatesSection(null)
                    setDriverEffectiveDatesSection(null)
                    setTransportEffectiveDatesSection(null)
                    setLedgerGroupEffectiveDatesOpen(false)
                    setStockGroupEffectiveDatesOpen(false)
                    setDepotEffectiveDatesSection(null)
                    setBrokerEffectiveDatesSection(null)
                    setPetrolPumpEffectiveDatesSection(null)
                    setSalespersonEffectiveDatesSection(null)
                    setUnitEffectiveDatesOpen(false)
                    setRawMaterialEffectiveDatesSection(null)
                    setSemiFinishedGoodEffectiveDatesSection(null)
                    setInsuranceDetailEffectiveDatesOpen(false)
                    setConversionFormulaEffectiveDatesOpen(false)
                    setCdRuleEffectiveDatesOpen(false)
                    setDepotEffectiveDatesSection(null)
                    setBrokerEffectiveDatesSection(null)
                    setPetrolPumpEffectiveDatesSection(null)
                    setSalespersonEffectiveDatesSection(null)
                    setUnitEffectiveDatesOpen(false)
                    setRawMaterialEffectiveDatesSection(null)
                    setSemiFinishedGoodEffectiveDatesSection(null)
                    setInsuranceDetailEffectiveDatesOpen(false)
                    setConversionFormulaEffectiveDatesOpen(false)
                    setCdRuleEffectiveDatesOpen(false)
                    if (editingItem?.id) {
                      const res = await salespersonApi.getById(String(editingItem.id))
                      if (res?.success && res.data) {
                        populateFormFromData('salespersons', res.data)
                      }
                    }
                  }}
                />
              ) : activeTab === 'petrol_pumps' && petrolPumpEffectiveDatesSection !== null && editingItem?.id ? (
                <PetrolPumpEffectiveDatesModalView
                  petrolPumpId={editingItem.id}
                  petrolPumpName={petrolPumpForm.petrol_pump_name || ''}
                  petrolPumpForm={petrolPumpForm}
                  initialSection={petrolPumpEffectiveDatesSection}
                  targetFieldName={petrolPumpEffectiveDatesTargetField || undefined}
                  ledgerGroupOptions={ledgerGroupOptions}
                  activeStates={activeStates}
                  activeGstRegStatuses={activeGstRegStatuses}
                  activeGstRegTypes={activeGstRegTypes}
                  activeMsmeRegTypes={activeMsmeRegTypes}
                  activeFssaiLicenceTypes={activeFssaiLicenceTypes}
                  onPetrolPumpUpdated={(data) => { populateFormFromData('petrol_pumps', data); refetchPetrolPump() }}
                  onBack={async () => {
                    setPetrolPumpEffectiveDatesSection(null)
                    setPetrolPumpEffectiveDatesTargetField(null)
                    setShowAuditTrailView(false)
                    setSkuHistoryModalOpen(false)
                    setCustomerEffectiveDatesSection(null)
                    setSkuEffectiveDatesSection(null)
                    setPriceLevelEffectiveDatesSection(null)
                    setSkuSellingPriceEffectiveDatesOpen(false)
                    setVehicleEffectiveDatesSection(null)
                    setDriverEffectiveDatesSection(null)
                    setTransportEffectiveDatesSection(null)
                    setLedgerGroupEffectiveDatesOpen(false)
                    setStockGroupEffectiveDatesOpen(false)
                    setDepotEffectiveDatesSection(null)
                    setBrokerEffectiveDatesSection(null)
                    setSalespersonEffectiveDatesSection(null)
                    setUnitEffectiveDatesOpen(false)
                    setRawMaterialEffectiveDatesSection(null)
                    setSemiFinishedGoodEffectiveDatesSection(null)
                    setInsuranceDetailEffectiveDatesOpen(false)
                    setConversionFormulaEffectiveDatesOpen(false)
                    setCdRuleEffectiveDatesOpen(false)
                    if (editingItem?.id) {
                      const res = await petrolPumpApi.getById(String(editingItem.id))
                      if (res?.success && res.data) {
                        populateFormFromData('petrol_pumps', res.data)
                      }
                    }
                  }}
                />
              ) : activeTab === 'units' && unitEffectiveDatesOpen && editingItem?.id ? (
                <UnitEffectiveDatesModalView
                  unitId={editingItem.id}
                  unitName={unitForm.unit_name || ''}
                  unitForm={unitForm}
                  targetFieldName={unitTargetField || undefined}
                  onUnitUpdated={(data) => { populateFormFromData('units', data); refetchUnit() }}
                  onBack={async () => {
                    setUnitEffectiveDatesOpen(false)
                    setRawMaterialEffectiveDatesSection(null)
                    setSemiFinishedGoodEffectiveDatesSection(null)
                    setInsuranceDetailEffectiveDatesOpen(false)
                    setConversionFormulaEffectiveDatesOpen(false)
                    setCdRuleEffectiveDatesOpen(false)
                    setUnitTargetField(null)
                    setShowAuditTrailView(false)
                    setSkuHistoryModalOpen(false)
                    setCustomerEffectiveDatesSection(null)
                    setSkuEffectiveDatesSection(null)
                    setPriceLevelEffectiveDatesSection(null)
                    setSkuSellingPriceEffectiveDatesOpen(false)
                    setVehicleEffectiveDatesSection(null)
                    setDriverEffectiveDatesSection(null)
                    setTransportEffectiveDatesSection(null)
                    setLedgerGroupEffectiveDatesOpen(false)
                    setStockGroupEffectiveDatesOpen(false)
                    setDepotEffectiveDatesSection(null)
                    setBrokerEffectiveDatesSection(null)
                    setPetrolPumpEffectiveDatesSection(null)
                    setSalespersonEffectiveDatesSection(null)
                    setUnitEffectiveDatesOpen(false)
                    setRawMaterialEffectiveDatesSection(null)
                    setSemiFinishedGoodEffectiveDatesSection(null)
                    setInsuranceDetailEffectiveDatesOpen(false)
                    setConversionFormulaEffectiveDatesOpen(false)
                    setCdRuleEffectiveDatesOpen(false)
                    setUnitEffectiveDatesOpen(false)
                    setRawMaterialEffectiveDatesSection(null)
                    setSemiFinishedGoodEffectiveDatesSection(null)
                    setInsuranceDetailEffectiveDatesOpen(false)
                    setConversionFormulaEffectiveDatesOpen(false)
                    setCdRuleEffectiveDatesOpen(false)
                    if (editingItem?.id) {
                      const res = await unitApi.getById(String(editingItem.id))
                      if (res?.success && res.data) {
                        populateFormFromData('units', res.data)
                      }
                    }
                  }}
                />
              ) : activeTab === 'raw_materials' && rawMaterialEffectiveDatesSection !== null && editingItem?.id ? (
                <RawMaterialEffectiveDatesModalView
                  rawMaterialId={editingItem.id}
                  rawMaterialName={rawMaterialForm.name || ''}
                  rawMaterialForm={rawMaterialForm}
                  initialSection={rawMaterialEffectiveDatesSection}
                  targetFieldName={rawMaterialEffectiveDatesTargetField || undefined}
                  unitOptions={unitsList}
                  stockGroupOptions={stockGroupsList}
                  activeGstRates={activeGstRates}
                  activeHsnCodes={activeHsnCodes}
                  activeSacCodes={activeSacCodes}
                  ledgerOptions={ledgerOptions}
                  onRawMaterialUpdated={(data) => { populateFormFromData('raw_materials', data); refetchRawMaterial() }}
                  onBack={async () => {
                    setRawMaterialEffectiveDatesSection(null)
                    setSemiFinishedGoodEffectiveDatesSection(null)
                    setInsuranceDetailEffectiveDatesOpen(false)
                    setConversionFormulaEffectiveDatesOpen(false)
                    setCdRuleEffectiveDatesOpen(false)
                    setRawMaterialEffectiveDatesTargetField(null)
                    setShowAuditTrailView(false)
                    setSkuHistoryModalOpen(false)
                    setCustomerEffectiveDatesSection(null)
                    setSkuEffectiveDatesSection(null)
                    setPriceLevelEffectiveDatesSection(null)
                    setSkuSellingPriceEffectiveDatesOpen(false)
                    setVehicleEffectiveDatesSection(null)
                    setDriverEffectiveDatesSection(null)
                    setTransportEffectiveDatesSection(null)
                    setLedgerGroupEffectiveDatesOpen(false)
                    setStockGroupEffectiveDatesOpen(false)
                    setDepotEffectiveDatesSection(null)
                    setBrokerEffectiveDatesSection(null)
                    setPetrolPumpEffectiveDatesSection(null)
                    setSalespersonEffectiveDatesSection(null)
                    setUnitEffectiveDatesOpen(false)
                    setRawMaterialEffectiveDatesSection(null)
                    setSemiFinishedGoodEffectiveDatesSection(null)
                    setInsuranceDetailEffectiveDatesOpen(false)
                    setConversionFormulaEffectiveDatesOpen(false)
                    setCdRuleEffectiveDatesOpen(false)
                    setRawMaterialEffectiveDatesSection(null)
                    setSemiFinishedGoodEffectiveDatesSection(null)
                    setInsuranceDetailEffectiveDatesOpen(false)
                    setConversionFormulaEffectiveDatesOpen(false)
                    setCdRuleEffectiveDatesOpen(false)
                    if (editingItem?.id) {
                      const res = await rawMaterialApi.getById(String(editingItem.id))
                      if (res?.success && res.data) {
                        populateFormFromData('raw_materials', res.data)
                      }
                    }
                  }}
                />
              ) : activeTab === 'semi_finished_goods' && semiFinishedGoodEffectiveDatesSection !== null && editingItem?.id ? (
                <SemiFinishedGoodEffectiveDatesModalView
                  semiFinishedGoodId={editingItem.id}
                  semiFinishedGoodName={semiFinishedGoodForm.name || ''}
                  semiFinishedGoodForm={semiFinishedGoodForm}
                  initialSection={semiFinishedGoodEffectiveDatesSection}
                  targetFieldName={semiFinishedGoodEffectiveDatesTargetField || undefined}
                  unitOptions={unitsList}
                  stockGroupOptions={stockGroupsList}
                  activeGstRates={activeGstRates}
                  activeHsnCodes={activeHsnCodes}
                  activeSacCodes={activeSacCodes}
                  ledgerOptions={ledgerOptions}
                  onSemiFinishedGoodUpdated={(data) => { populateFormFromData('semi_finished_goods', data); refetchSemiFinishedGood() }}
                  onBack={async () => {
                    setSemiFinishedGoodEffectiveDatesSection(null)
                    setInsuranceDetailEffectiveDatesOpen(false)
                    setConversionFormulaEffectiveDatesOpen(false)
                    setCdRuleEffectiveDatesOpen(false)
                    setSemiFinishedGoodEffectiveDatesTargetField(null)
                    setShowAuditTrailView(false)
                    setSkuHistoryModalOpen(false)
                    setCustomerEffectiveDatesSection(null)
                    setSkuEffectiveDatesSection(null)
                    setPriceLevelEffectiveDatesSection(null)
                    setSkuSellingPriceEffectiveDatesOpen(false)
                    setVehicleEffectiveDatesSection(null)
                    setDriverEffectiveDatesSection(null)
                    setTransportEffectiveDatesSection(null)
                    setLedgerGroupEffectiveDatesOpen(false)
                    setStockGroupEffectiveDatesOpen(false)
                    setDepotEffectiveDatesSection(null)
                    setBrokerEffectiveDatesSection(null)
                    setPetrolPumpEffectiveDatesSection(null)
                    setSalespersonEffectiveDatesSection(null)
                    setUnitEffectiveDatesOpen(false)
                    setRawMaterialEffectiveDatesSection(null)
                    setSemiFinishedGoodEffectiveDatesSection(null)
                    setInsuranceDetailEffectiveDatesOpen(false)
                    setConversionFormulaEffectiveDatesOpen(false)
                    setCdRuleEffectiveDatesOpen(false)
                    setSemiFinishedGoodEffectiveDatesSection(null)
                    setInsuranceDetailEffectiveDatesOpen(false)
                    setConversionFormulaEffectiveDatesOpen(false)
                    setCdRuleEffectiveDatesOpen(false)
                    if (editingItem?.id) {
                      const res = await semiFinishedGoodApi.getById(String(editingItem.id))
                      if (res?.success && res.data) {
                        populateFormFromData('semi_finished_goods', res.data)
                      }
                    }
                  }}
                />
              ) : activeTab === 'insurance_details' && insuranceDetailEffectiveDatesOpen && editingItem?.id ? (
                <InsuranceDetailEffectiveDatesModalView
                  insuranceDetailId={editingItem.id}
                  insuranceCompanyName={insuranceDetailForm.insurance_company_name || ''}
                  insuranceDetailForm={insuranceDetailForm}
                  targetFieldName={insuranceDetailTargetField || undefined}
                  customerOptions={customerOptions}
                  onInsuranceDetailUpdated={(data) => { populateFormFromData('insurance_details', data); refetchInsuranceDetail() }}
                  onBack={async () => {
                    setInsuranceDetailEffectiveDatesOpen(false)
                    setConversionFormulaEffectiveDatesOpen(false)
                    setCdRuleEffectiveDatesOpen(false)
                    setInsuranceDetailTargetField(null)
                    setShowAuditTrailView(false)
                    setSkuHistoryModalOpen(false)
                    setCustomerEffectiveDatesSection(null)
                    setSkuEffectiveDatesSection(null)
                    setPriceLevelEffectiveDatesSection(null)
                    setSkuSellingPriceEffectiveDatesOpen(false)
                    setVehicleEffectiveDatesSection(null)
                    setDriverEffectiveDatesSection(null)
                    setTransportEffectiveDatesSection(null)
                    setLedgerGroupEffectiveDatesOpen(false)
                    setStockGroupEffectiveDatesOpen(false)
                    setDepotEffectiveDatesSection(null)
                    setBrokerEffectiveDatesSection(null)
                    setPetrolPumpEffectiveDatesSection(null)
                    setSalespersonEffectiveDatesSection(null)
                    setUnitEffectiveDatesOpen(false)
                    setRawMaterialEffectiveDatesSection(null)
                    setSemiFinishedGoodEffectiveDatesSection(null)
                    setInsuranceDetailEffectiveDatesOpen(false)
                    setConversionFormulaEffectiveDatesOpen(false)
                    setCdRuleEffectiveDatesOpen(false)
                    setInsuranceDetailEffectiveDatesOpen(false)
                    setConversionFormulaEffectiveDatesOpen(false)
                    setCdRuleEffectiveDatesOpen(false)
                    if (editingItem?.id) {
                      const res = await insuranceDetailApi.getById(String(editingItem.id))
                      if (res?.success && res.data) {
                        populateFormFromData('insurance_details', res.data)
                      }
                    }
                  }}
                />
              ) : activeTab === 'conversion_formulas' && conversionFormulaEffectiveDatesOpen && editingItem?.id ? (
                <ConversionFormulaEffectiveDatesModalView
                  conversionFormulaId={editingItem.id}
                  conversionFormulaCode={conversionFormulaForm.conversion_formula_code || ''}
                  conversionFormulaForm={conversionFormulaForm}
                  targetFieldName={conversionFormulaTargetField || undefined}
                  skuOptions={skuDetails}
                  onConversionFormulaUpdated={(data) => { populateFormFromData('conversion_formulas', data); refetchConversionFormula() }}
                  onBack={async () => {
                    setConversionFormulaEffectiveDatesOpen(false)
                    setCdRuleEffectiveDatesOpen(false)
                    setConversionFormulaTargetField(null)
                    setShowAuditTrailView(false)
                    setSkuHistoryModalOpen(false)
                    setCustomerEffectiveDatesSection(null)
                    setSkuEffectiveDatesSection(null)
                    setPriceLevelEffectiveDatesSection(null)
                    setSkuSellingPriceEffectiveDatesOpen(false)
                    setVehicleEffectiveDatesSection(null)
                    setDriverEffectiveDatesSection(null)
                    setTransportEffectiveDatesSection(null)
                    setLedgerGroupEffectiveDatesOpen(false)
                    setStockGroupEffectiveDatesOpen(false)
                    setDepotEffectiveDatesSection(null)
                    setBrokerEffectiveDatesSection(null)
                    setPetrolPumpEffectiveDatesSection(null)
                    setSalespersonEffectiveDatesSection(null)
                    setUnitEffectiveDatesOpen(false)
                    setRawMaterialEffectiveDatesSection(null)
                    setSemiFinishedGoodEffectiveDatesSection(null)
                    setInsuranceDetailEffectiveDatesOpen(false)
                    setConversionFormulaEffectiveDatesOpen(false)
                    setCdRuleEffectiveDatesOpen(false)
                    setConversionFormulaEffectiveDatesOpen(false)
                    setCdRuleEffectiveDatesOpen(false)
                    if (editingItem?.id) {
                      const res = await conversionFormulaApi.getById(String(editingItem.id))
                      if (res?.success && res.data) {
                        populateFormFromData('conversion_formulas', res.data)
                      }
                    }
                  }}
                />
              ) : activeTab === 'cd_rules' && cdRuleEffectiveDatesOpen && editingItem?.id ? (
                <CdRuleEffectiveDatesModalView
                  cdRuleId={editingItem.id}
                  cdRuleCode={cdRuleForm.cd_rule_code || ''}
                  cdRuleForm={cdRuleForm}
                  targetFieldName={cdRuleTargetField || undefined}
                  stockCategoryOptions={activeStockCategories}
                  onCdRuleUpdated={(data) => { populateFormFromData('cd_rules', data); refetchCdRule() }}
                  onBack={async () => {
                    setCdRuleEffectiveDatesOpen(false)
                    setCdRuleTargetField(null)
                    setShowAuditTrailView(false)
                    setSkuHistoryModalOpen(false)
                    setCustomerEffectiveDatesSection(null)
                    setSkuEffectiveDatesSection(null)
                    setPriceLevelEffectiveDatesSection(null)
                    setSkuSellingPriceEffectiveDatesOpen(false)
                    setVehicleEffectiveDatesSection(null)
                    setDriverEffectiveDatesSection(null)
                    setTransportEffectiveDatesSection(null)
                    setLedgerGroupEffectiveDatesOpen(false)
                    setStockGroupEffectiveDatesOpen(false)
                    setDepotEffectiveDatesSection(null)
                    setBrokerEffectiveDatesSection(null)
                    setPetrolPumpEffectiveDatesSection(null)
                    setSalespersonEffectiveDatesSection(null)
                    setUnitEffectiveDatesOpen(false)
                    setRawMaterialEffectiveDatesSection(null)
                    setSemiFinishedGoodEffectiveDatesSection(null)
                    setInsuranceDetailEffectiveDatesOpen(false)
                    setConversionFormulaEffectiveDatesOpen(false)
                    if (editingItem?.id) {
                      const res = await cdRuleApi.getById(String(editingItem.id))
                      if (res?.success && res.data) {
                        populateFormFromData('cd_rules', res.data)
                      }
                    }
                  }}
                />
              ) : activeTab === 'tds_rules' && tdsRuleEffectiveDatesOpen && editingItem?.id ? (
                <TdsRuleEffectiveDatesModalView
                  tdsRuleId={editingItem.id}
                  tdsRuleCode={tdsRuleForm.tds_rule_code || ''}
                  tdsRuleForm={tdsRuleForm}
                  targetFieldName={tdsRuleTargetField || undefined}
                  onTdsRuleUpdated={(data) => { populateFormFromData('tds_rules', data); refetchTdsRule() }}
                  onBack={async () => {
                    setTdsRuleEffectiveDatesOpen(false)
                    setTdsRuleTargetField(null)
                    setShowAuditTrailView(false)
                    setSkuHistoryModalOpen(false)
                    setCustomerEffectiveDatesSection(null)
                    setSkuEffectiveDatesSection(null)
                    setPriceLevelEffectiveDatesSection(null)
                    setSkuSellingPriceEffectiveDatesOpen(false)
                    setVehicleEffectiveDatesSection(null)
                    setDriverEffectiveDatesSection(null)
                    setTransportEffectiveDatesSection(null)
                    setLedgerGroupEffectiveDatesOpen(false)
                    setStockGroupEffectiveDatesOpen(false)
                    setDepotEffectiveDatesSection(null)
                    setBrokerEffectiveDatesSection(null)
                    setPetrolPumpEffectiveDatesSection(null)
                    setSalespersonEffectiveDatesSection(null)
                    setUnitEffectiveDatesOpen(false)
                    setRawMaterialEffectiveDatesSection(null)
                    setSemiFinishedGoodEffectiveDatesSection(null)
                    setInsuranceDetailEffectiveDatesOpen(false)
                    setConversionFormulaEffectiveDatesOpen(false)
                    setCdRuleEffectiveDatesOpen(false)
                    if (editingItem?.id) {
                      const res = await tdsRuleApi.getById(String(editingItem.id))
                      if (res?.success && res.data) {
                        populateFormFromData('tds_rules', res.data)
                      }
                    }
                  }}
                />
              ) : activeTab === 'oil_tags' && oilTagEffectiveDatesOpen && editingItem?.id ? (
                <OilTagEffectiveDatesModalView
                  oilTagId={editingItem.id}
                  oilTagName={oilTagForm.name || ''}
                  oilTagForm={oilTagForm}
                  targetFieldName={oilTagTargetField || undefined}
                  onOilTagUpdated={(data) => { populateFormFromData('oil_tags', data); refetchOilTag() }}
                  onBack={async () => {
                    setOilTagEffectiveDatesOpen(false)
                    setOilTagTargetField(null)
                    setShowAuditTrailView(false)
                    setSkuHistoryModalOpen(false)
                    setCustomerEffectiveDatesSection(null)
                    setSkuEffectiveDatesSection(null)
                    setPriceLevelEffectiveDatesSection(null)
                    setSkuSellingPriceEffectiveDatesOpen(false)
                    setVehicleEffectiveDatesSection(null)
                    setDriverEffectiveDatesSection(null)
                    setTransportEffectiveDatesSection(null)
                    setLedgerGroupEffectiveDatesOpen(false)
                    setStockGroupEffectiveDatesOpen(false)
                    setDepotEffectiveDatesSection(null)
                    setBrokerEffectiveDatesSection(null)
                    setPetrolPumpEffectiveDatesSection(null)
                    setSalespersonEffectiveDatesSection(null)
                    setUnitEffectiveDatesOpen(false)
                    setRawMaterialEffectiveDatesSection(null)
                    setSemiFinishedGoodEffectiveDatesSection(null)
                    setInsuranceDetailEffectiveDatesOpen(false)
                    setConversionFormulaEffectiveDatesOpen(false)
                    setCdRuleEffectiveDatesOpen(false)
                    setTdsRuleEffectiveDatesOpen(false)
                    if (editingItem?.id) {
                      const res = await oilTagApi.getById(String(editingItem.id))
                      if (res?.success && res.data) {
                        populateFormFromData('oil_tags', res.data)
                      }
                    }
                  }}
                />
              ) : activeTab === 'bhada_rates' && bhadaRateEffectiveDatesOpen && editingItem?.id ? (
                <BhadaRateEffectiveDatesModalView
                  bhadaRateId={editingItem.id}
                  bhadaRateCode={bhadaRateForm.bhada_rate_code || ''}
                  bhadaRateForm={bhadaRateForm}
                  targetFieldName={bhadaRateTargetField || undefined}
                  onBhadaRateUpdated={(data) => { populateFormFromData('bhada_rates', data); refetchBhadaRate() }}
                  onBack={async () => {
                    setBhadaRateEffectiveDatesOpen(false)
                    setBhadaRateTargetField(null)
                    setShowAuditTrailView(false)
                    setSkuHistoryModalOpen(false)
                    setCustomerEffectiveDatesSection(null)
                    setSkuEffectiveDatesSection(null)
                    setPriceLevelEffectiveDatesSection(null)
                    setSkuSellingPriceEffectiveDatesOpen(false)
                    setVehicleEffectiveDatesSection(null)
                    setDriverEffectiveDatesSection(null)
                    setTransportEffectiveDatesSection(null)
                    setLedgerGroupEffectiveDatesOpen(false)
                    setStockGroupEffectiveDatesOpen(false)
                    setDepotEffectiveDatesSection(null)
                    setBrokerEffectiveDatesSection(null)
                    setPetrolPumpEffectiveDatesSection(null)
                    setSalespersonEffectiveDatesSection(null)
                    setUnitEffectiveDatesOpen(false)
                    setRawMaterialEffectiveDatesSection(null)
                    setSemiFinishedGoodEffectiveDatesSection(null)
                    setInsuranceDetailEffectiveDatesOpen(false)
                    setConversionFormulaEffectiveDatesOpen(false)
                    setCdRuleEffectiveDatesOpen(false)
                    setTdsRuleEffectiveDatesOpen(false)
                    setOilTagEffectiveDatesOpen(false)
                    if (editingItem?.id) {
                      const res = await bhadaRateApi.getById(String(editingItem.id))
                      if (res?.success && res.data) {
                        populateFormFromData('bhada_rates', res.data)
                      }
                    }
                  }}
                />
              ) : showAuditTrailView && editingItem?.id ? (
                <div className="space-y-4 py-2 min-h-[480px] flex flex-col justify-between">
                  <div className="space-y-3">
                    {/* Standalone Top Back Button */}
                    <div className="sticky -top-6 z-50 -mt-8 -mx-6 px-6 pt-4 pb-2.5 mb-2 rounded-t-lg bg-slate-50 border-b border-slate-200 flex items-center justify-between [&>button]:bg-white [&>button]:shadow-sm">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-[11px] font-semibold bg-white border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 flex items-center gap-1 shadow-2xs rounded-md"
                        onClick={() => {
                          setShowAuditTrailView(false)
                          setSkuHistoryModalOpen(false)
                          setSkuEffectiveDatesSection(null)
                          setCustomerEffectiveDatesSection(null)
                          setPriceLevelEffectiveDatesSection(null)
                          setSkuSellingPriceEffectiveDatesOpen(false)
                          setVehicleEffectiveDatesSection(null)
                          setDriverEffectiveDatesSection(null)
                          setTransportEffectiveDatesSection(null)
                          setLedgerGroupEffectiveDatesOpen(false)
                          setStockGroupEffectiveDatesOpen(false)
                          setDepotEffectiveDatesSection(null)
                          setBrokerEffectiveDatesSection(null)
                          setPetrolPumpEffectiveDatesSection(null)
                          setSalespersonEffectiveDatesSection(null)
                          setUnitEffectiveDatesOpen(false)
                          setRawMaterialEffectiveDatesSection(null)
                          setSemiFinishedGoodEffectiveDatesSection(null)
                          setInsuranceDetailEffectiveDatesOpen(false)
                          setConversionFormulaEffectiveDatesOpen(false)
                          setCdRuleEffectiveDatesOpen(false)
                        }}
                      >
                        <ArrowLeft className="h-3 w-3 text-slate-500" />
                        <span>Back to Form</span>
                      </Button>
                    </div>

                    {/* Sub-view Section Title Header Box Below Button */}
                    <div className="flex items-center justify-between border-b pb-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                      <div>
                        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                          <Clock className="h-4 w-4 text-blue-600" />
                          Audit Trail Log History
                        </h2>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                          Record: <span className="font-bold text-slate-800">{editingItem.customer_name || editingItem.name || editingItem.sku_name || editingItem.registration_no || `#${editingItem.id}`}</span> ({activeTab.replace('_', ' ')})
                        </p>
                      </div>

                      <Badge variant="outline" className="bg-white text-slate-700 border-slate-300 font-bold text-xs">
                        {activeTab.toUpperCase()}
                      </Badge>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-4 bg-white min-h-[360px] space-y-3">
                      <Label className="text-slate-700 font-semibold flex items-center gap-1.5 text-xs uppercase tracking-wider">
                        <Clock className="h-3.5 w-3.5 text-slate-500" />
                        AUDIT TRAIL LOG
                      </Label>
                      <MasterEditHistoryTable masterType={activeTab} recordId={editingItem.id} />
                    </div>
                  </div>
                </div>
              ) : activeTab === 'sku_details' && skuHistoryModalOpen && editingItem?.id ? (
                <div className="space-y-4 py-2 min-h-[480px] flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="sticky -top-6 z-50 -mt-8 -mx-6 px-6 pt-4 pb-2.5 mb-2 rounded-t-lg bg-slate-50 border-b border-slate-200 flex items-center justify-between [&>button]:bg-white [&>button]:shadow-sm">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-[11px] font-semibold bg-white border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 flex items-center gap-1 shadow-2xs rounded-md"
                        onClick={() => {
                          setSkuHistoryModalOpen(false)
                          setShowAuditTrailView(false)
                          setSkuEffectiveDatesSection(null)
                          setCustomerEffectiveDatesSection(null)
                          setPriceLevelEffectiveDatesSection(null)
                          setSkuSellingPriceEffectiveDatesOpen(false)
                          setVehicleEffectiveDatesSection(null)
                          setDriverEffectiveDatesSection(null)
                          setTransportEffectiveDatesSection(null)
                          setLedgerGroupEffectiveDatesOpen(false)
                          setStockGroupEffectiveDatesOpen(false)
                          setDepotEffectiveDatesSection(null)
                          setBrokerEffectiveDatesSection(null)
                          setPetrolPumpEffectiveDatesSection(null)
                          setSalespersonEffectiveDatesSection(null)
                          setUnitEffectiveDatesOpen(false)
                          setRawMaterialEffectiveDatesSection(null)
                          setSemiFinishedGoodEffectiveDatesSection(null)
                          setInsuranceDetailEffectiveDatesOpen(false)
                          setConversionFormulaEffectiveDatesOpen(false)
                          setCdRuleEffectiveDatesOpen(false)
                        }}
                      >
                        <ArrowLeft className="h-3 w-3 text-slate-500" />
                        <span>Back to Form</span>
                      </Button>
                    </div>
                    <div className="flex items-center justify-between border-b pb-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                      <div>
                        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                          <Clock className="h-4 w-4 text-blue-600" />
                          Finished Goods History — {skuHistorySection.charAt(0).toUpperCase() + skuHistorySection.slice(1)} Section
                        </h2>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                          Record: <span className="font-bold text-slate-800">{skuDetailsForm.sku_name || `#${editingItem.id}`}</span>
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-white text-slate-700 border-slate-300 font-bold text-xs">
                        FINISHED GOODS
                      </Badge>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-4 bg-white min-h-[360px] space-y-3">
                      <Label className="text-slate-700 font-semibold flex items-center gap-1.5 text-xs uppercase tracking-wider">
                        <Clock className="h-3.5 w-3.5 text-slate-500" />
                        AUDIT TRAIL LOG — {skuHistorySection.toUpperCase()}
                      </Label>
                      <MasterEditHistoryTable masterType="sku_details" recordId={editingItem.id} />
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div>
                      <DialogTitle>{editingItem ? "Edit" : "Add New"} {activeTab === "sku_details" ? "Finished Good" : activeTab === "sku_selling_price" ? "SKU Selling Price" : activeTab === "salespersons" ? "Salesperson" : activeTab === "vehicle_master" ? "Vehicle" : activeTab === "driver_master" ? "Driver" : activeTab === "transport_master" ? "Transporter" : activeTab === "ledger_groups" ? "Ledger Group" : activeTab === "stock_groups" ? "Stock Group" : activeTab === "units" ? "Unit" : activeTab === "raw_materials" ? "Raw Material" : activeTab === "semi_finished_goods" ? "Semi-Finished Good" : activeTab === "insurance_details" ? "Insurance Detail" : activeTab === "conversion_formulas" ? "Conversion Formula" : activeTab === "price_levels" ? "Price Level" : activeTab === "petrol_pumps" ? "Petrol Pump" : activeTab === "cd_rules" ? "CD Rule" : activeTab === "tds_rules" ? "TDS Rule" : activeTab === "bhada_rates" ? "Bhada Rate" : activeTab.slice(0, -1)}</DialogTitle>
                      <DialogDescription>
                        Enter the details for the {activeTab === "sku_details" ? "Finished Good" : activeTab === "sku_selling_price" ? "SKU Selling Price" : activeTab === "salespersons" ? "Salesperson" : activeTab === "vehicle_master" ? "Vehicle" : activeTab === "driver_master" ? "Driver" : activeTab === "transport_master" ? "Transporter" : activeTab === "ledger_groups" ? "Ledger Group" : activeTab === "stock_groups" ? "Stock Group" : activeTab === "units" ? "Unit" : activeTab === "raw_materials" ? "Raw Material" : activeTab === "semi_finished_goods" ? "Semi-Finished Good" : activeTab === "insurance_details" ? "Insurance Detail" : activeTab === "conversion_formulas" ? "Conversion Formula" : activeTab === "price_levels" ? "Price Level" : activeTab === "petrol_pumps" ? "Petrol Pump" : activeTab === "cd_rules" ? "CD Rule" : activeTab === "tds_rules" ? "TDS Rule" : activeTab === "bhada_rates" ? "Bhada Rate" : activeTab.slice(0, -1)} record.
                      </DialogDescription>
                    </div>
                    {editingItem?.id && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2.5 text-xs font-semibold border-slate-300 hover:bg-slate-100 text-slate-700 flex items-center gap-1.5 shadow-2xs mr-6"
                        onClick={() => {
                          const container = document.querySelector('[data-slot="dialog-content"]') || document.querySelector('.overflow-y-auto');
                          if (container) {
                            sessionStorage.setItem('masterFormScrollTop', container.scrollTop.toString());
                          }
                          setShowAuditTrailView(true);
                        }}
                      >
                        <Clock className="h-3.5 w-3.5 text-blue-600" />
                        <span>Audit Trail Log</span>
                      </Button>
                    )}
                  </DialogHeader>
                  {renderFormForTab(activeTab)}
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreateOrUpdate} disabled={isSubmitting}>
                      {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {editingItem ? "Update" : "Save"} Details
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </PageHeader>

      <Tabs value={activeTab} className="w-full space-y-6" onValueChange={setActiveTab}>
        <div className="flex items-center">
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger className="w-full sm:w-72 h-12 rounded-xl bg-white shadow-sm border-slate-200 px-4 font-medium data-[state=open]:ring-2 data-[state=open]:ring-primary/20">
              <SelectValue placeholder="Select master" />
            </SelectTrigger>
            <SelectContent className="rounded-xl max-h-[300px]">
              {visibleTabs.map((tab) => {
                const meta = TAB_META[tab]
                if (!meta) return null
                const Icon = meta.icon
                return (
                  <SelectItem key={tab} value={tab} className="rounded-lg cursor-pointer">
                    <span className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-slate-500" />
                      {meta.label}
                    </span>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>



                        {visibleTabs.includes("customers") && (
          <TabsContent value="customers">
            <MasterCardWrapper
              icon={Users}
              title="Customers List"
              description="Manage your customer database"
              isAdminOrSuper={isAdminOrSuper}
              subTab={customerSubTab}
              setSubTab={setCustomerSubTab}
              pendingCount={pendingCustomers.length}
              headerActions={
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 md:h-9 border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/80 text-emerald-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                    disabled={isMasterTabReadOnly}
                    onClick={() => setCustomerBulkImportOpen(true)}
                    title={isMasterTabReadOnly ? "View Only Access" : "Import Customers via CSV/Excel"}
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Import CSV</span>
                  </Button>

                  {isAdminOrSuper && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 md:h-9 border-violet-200 bg-violet-50/60 hover:bg-violet-100/80 text-violet-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5"
                      disabled={isMasterTabReadOnly}
                      onClick={() => setCustomerGodownTagOpen(true)}
                      title="Tag many existing customers to a godown (depot) at once"
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5 text-violet-600" />
                      <span>Tag Godown</span>
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 md:h-9 border-blue-200 bg-blue-50/60 hover:bg-blue-100/80 text-blue-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                    disabled={isExportingCustomers}
                    onClick={handleExportCustomersCsv}
                    title="Export all Customer records as CSV"
                  >
                    {isExportingCustomers ? (
                      <Loader2 className="h-3.5 w-3.5 text-blue-600 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5 text-blue-600" />
                    )}
                    <span>Export CSV</span>
                  </Button>
                </div>
              }
            >
              <CustomerMasterTable
                customerSubTab={customerSubTab}
                isCustomerLoading={isCustomerLoading}
                customers={customers}
                sortedCustomers={sortedCustomers}
                pendingCustomers={pendingCustomers}
                customerSort={customerSort}
                toggleSort={toggleSort}
                setCustomerSort={setCustomerSort}
                customerEndRef={customerEndRef}
                isFetchingNextCustomer={isFetchingNextCustomer}
                canEditActiveTab={canEditActiveTab}
                canEditExisting={canEditExisting}
                openEditDialog={openEditDialog}
                setDeletingItem={setDeletingItem}
                setIsDeleteDialogOpen={setIsDeleteDialogOpen}
                openApprovalModal={(type, item) => openApprovalModal(type, item)}
                setRejectDialogContext={setRejectDialogContext}
              />
            </MasterCardWrapper>
          </TabsContent>
        )}

        {visibleTabs.includes("depots") && (
          <TabsContent value="depots">
            <MasterCardWrapper
              icon={Warehouse}
              title="Depots List"
              description="Manage your warehouse and depots"
              isAdminOrSuper={isAdminOrSuper}
              subTab={depotSubTab}
              setSubTab={setDepotSubTab}
              pendingCount={pendingDepots.length}
              headerActions={
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 md:h-9 border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/80 text-emerald-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                    disabled={isMasterTabReadOnly}
                    onClick={() => setDepotBulkImportOpen(true)}
                    title={isMasterTabReadOnly ? "View Only Access" : "Import Depots via CSV/Excel"}
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Import CSV</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 md:h-9 border-blue-200 bg-blue-50/60 hover:bg-blue-100/80 text-blue-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                    disabled={isExportingDepots}
                    onClick={handleExportDepotsCsv}
                    title="Export all Depot records as CSV"
                  >
                    {isExportingDepots ? (
                      <Loader2 className="h-3.5 w-3.5 text-blue-600 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5 text-blue-600" />
                    )}
                    <span>Export CSV</span>
                  </Button>
                </div>
              }
            >
              <DepotMasterTable
                depotSubTab={depotSubTab}
                isDepotLoading={isDepotLoading}
                depots={depots}
                sortedDepots={sortedDepots}
                pendingDepots={pendingDepots}
                depotSort={depotSort}
                toggleSort={toggleSort}
                setDepotSort={setDepotSort}
                depotEndRef={depotEndRef}
                isFetchingNextDepot={isFetchingNextDepot}
                canEditActiveTab={canEditActiveTab}
                canEditExisting={canEditExisting}
                isReviewing={isReviewing}
                openEditDialog={openEditDialog}
                setDeletingItem={setDeletingItem}
                setIsDeleteDialogOpen={setIsDeleteDialogOpen}
                openApprovalModal={(tab, item) => openApprovalModal(tab, item)}
                setRejectDialogContext={setRejectDialogContext}
              />
            </MasterCardWrapper>
          </TabsContent>
        )}

        {visibleTabs.includes("brokers") && (
          <TabsContent value="brokers">
            <MasterCardWrapper
              icon={Briefcase}
              title="Brokers List"
              description="Manage your broker database"
              isAdminOrSuper={isAdminOrSuper}
              subTab={brokerSubTab}
              setSubTab={setBrokerSubTab}
              pendingCount={pendingBrokers.length}
              headerActions={
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 md:h-9 border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/80 text-emerald-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                    disabled={isMasterTabReadOnly}
                    onClick={() => setBrokerBulkImportOpen(true)}
                    title={isMasterTabReadOnly ? "View Only Access" : "Import Brokers via CSV/Excel"}
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Import CSV</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 md:h-9 border-blue-200 bg-blue-50/60 hover:bg-blue-100/80 text-blue-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                    disabled={isExportingBrokers}
                    onClick={handleExportBrokersCsv}
                    title="Export all Broker records as CSV"
                  >
                    {isExportingBrokers ? (
                      <Loader2 className="h-3.5 w-3.5 text-blue-600 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5 text-blue-600" />
                    )}
                    <span>Export CSV</span>
                  </Button>
                </div>
              }
            >
              <BrokerMasterTable
                brokerSubTab={brokerSubTab}
                isBrokerLoading={isBrokerLoading}
                brokers={brokers}
                sortedBrokers={sortedBrokers}
                pendingBrokers={pendingBrokers}
                brokerSort={brokerSort}
                toggleSort={toggleSort}
                setBrokerSort={setBrokerSort}
                brokerEndRef={brokerEndRef}
                isFetchingNextBroker={isFetchingNextBroker}
                canEditActiveTab={canEditActiveTab}
                canEditExisting={canEditExisting}
                isReviewing={isReviewing}
                openEditDialog={openEditDialog}
                setDeletingItem={setDeletingItem}
                setIsDeleteDialogOpen={setIsDeleteDialogOpen}
                openApprovalModal={(tab, item) => openApprovalModal(tab, item)}
                setRejectDialogContext={setRejectDialogContext}
              />
            </MasterCardWrapper>
          </TabsContent>
        )}

        {visibleTabs.includes("salespersons") && (
          <TabsContent value="salespersons">
            <MasterCardWrapper
              icon={Users}
              title="Salespersons List"
              description="Manage your sales team database"
              isAdminOrSuper={isAdminOrSuper}
              subTab={salespersonSubTab}
              setSubTab={setSalespersonSubTab}
              pendingCount={pendingSalespersons.length}
              headerActions={
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 md:h-9 border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/80 text-emerald-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                    disabled={isMasterTabReadOnly}
                    onClick={() => setSalespersonBulkImportOpen(true)}
                    title={isMasterTabReadOnly ? "View Only Access" : "Import Salespersons via CSV/Excel"}
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Import CSV</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 md:h-9 border-blue-200 bg-blue-50/60 hover:bg-blue-100/80 text-blue-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                    disabled={isExportingSalespersons}
                    onClick={handleExportSalespersonsCsv}
                    title="Export all Salesperson records as CSV"
                  >
                    {isExportingSalespersons ? (
                      <Loader2 className="h-3.5 w-3.5 text-blue-600 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5 text-blue-600" />
                    )}
                    <span>Export CSV</span>
                  </Button>
                </div>
              }
            >
              <SalespersonMasterTable
                salespersonSubTab={salespersonSubTab}
                isSalespersonLoading={isSalespersonLoading}
                salespersons={salespersons}
                sortedSalespersons={sortedSalespersons}
                pendingSalespersons={pendingSalespersons}
                salespersonSort={salespersonSort}
                toggleSort={toggleSort}
                setSalespersonSort={setSalespersonSort}
                salespersonEndRef={salespersonEndRef}
                isFetchingNextSalesperson={isFetchingNextSalesperson}
                canEditActiveTab={canEditActiveTab}
                canEditExisting={canEditExisting}
                isReviewing={isReviewing}
                openEditDialog={openEditDialog}
                setDeletingItem={setDeletingItem}
                setIsDeleteDialogOpen={setIsDeleteDialogOpen}
                openApprovalModal={(tab, item) => openApprovalModal(tab, item)}
                setRejectDialogContext={setRejectDialogContext}
              />
            </MasterCardWrapper>
          </TabsContent>
        )}

        {visibleTabs.includes("ledger_groups") && (
          <TabsContent value="ledger_groups">
            <MasterCardWrapper
              icon={BookOpen}
              title="Ledger Groups"
              description="Manage chart of accounts and ledger group hierarchy"
              isAdminOrSuper={isAdminOrSuper}
              subTab={ledgerGroupSubTab}
              setSubTab={setLedgerGroupSubTab}
              pendingCount={pendingLedgerGroups.length}
              headerActions={
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 md:h-9 border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/80 text-emerald-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                    disabled={isMasterTabReadOnly}
                    onClick={() => setLedgerGroupBulkImportOpen(true)}
                    title={isMasterTabReadOnly ? "View Only Access" : "Import Ledger Groups via CSV/Excel"}
                  >
                    <Upload className="w-3.5 h-3.5 mr-1" />
                    Import CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 md:h-9 border-blue-200 bg-blue-50/60 hover:bg-blue-100/80 text-blue-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                    disabled={isExportingLedgerGroups}
                    onClick={handleExportLedgerGroupsCsv}
                    title="Export Ledger Groups to CSV"
                  >
                    {isExportingLedgerGroups ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                    ) : (
                      <Download className="w-3.5 h-3.5 mr-1" />
                    )}
                    Export CSV
                  </Button>
                </div>
              }
            >
              <SimpleMasterTable
                subTab={ledgerGroupSubTab}
                isLoading={isLedgerGroupLoading}
                items={ledgerGroupsList}
                sortedItems={sortedLedgerGroups}
                pendingItems={pendingLedgerGroups}
                sortState={ledgerGroupSort}
                toggleSort={toggleSort}
                setSortState={setLedgerGroupSort}
                endRef={ledgerGroupEndRef}
                isFetchingNext={isFetchingNextLedgerGroup}
                canEditActiveTab={canEditActiveTab}
                canEditExisting={canEditExisting}
                isReviewing={isReviewing}
                openEditDialog={openEditDialog}
                setDeletingItem={setDeletingItem}
                setIsDeleteDialogOpen={setIsDeleteDialogOpen}
                openApprovalModal={(tab, item) => openApprovalModal(tab, item)}
                setRejectDialogContext={setRejectDialogContext}
                tabName="ledger_groups"
                codeKey="group_code"
                nameKey="group_name"
              />
            </MasterCardWrapper>
          </TabsContent>
        )}

        {visibleTabs.includes("stock_groups") && (
          <TabsContent value="stock_groups">
            <MasterCardWrapper
              icon={Layers}
              title="Stock Groups"
              description="Manage inventory stock classification categories"
              isAdminOrSuper={isAdminOrSuper}
              subTab={stockGroupSubTab}
              setSubTab={setStockGroupSubTab}
              pendingCount={pendingStockGroups.length}
              headerActions={
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 md:h-9 border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/80 text-emerald-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                    disabled={isMasterTabReadOnly}
                    onClick={() => setStockGroupBulkImportOpen(true)}
                    title={isMasterTabReadOnly ? "View Only Access" : "Import Stock Groups via CSV/Excel"}
                  >
                    <Upload className="w-3.5 h-3.5 mr-1" />
                    Import CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 md:h-9 border-blue-200 bg-blue-50/60 hover:bg-blue-100/80 text-blue-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                    disabled={isExportingStockGroups}
                    onClick={handleExportStockGroupsCsv}
                    title="Export Stock Groups to CSV"
                  >
                    {isExportingStockGroups ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                    ) : (
                      <Download className="w-3.5 h-3.5 mr-1" />
                    )}
                    Export CSV
                  </Button>
                </div>
              }
            >
              <SimpleMasterTable
                subTab={stockGroupSubTab}
                isLoading={isStockGroupLoading}
                items={stockGroupsList}
                sortedItems={sortedStockGroups}
                pendingItems={pendingStockGroups}
                sortState={stockGroupSort}
                toggleSort={toggleSort}
                setSortState={setStockGroupSort}
                endRef={stockGroupEndRef}
                isFetchingNext={isFetchingNextStockGroup}
                canEditActiveTab={canEditActiveTab}
                canEditExisting={canEditExisting}
                isReviewing={isReviewing}
                openEditDialog={openEditDialog}
                setDeletingItem={setDeletingItem}
                setIsDeleteDialogOpen={setIsDeleteDialogOpen}
                openApprovalModal={(tab, item) => openApprovalModal(tab, item)}
                setRejectDialogContext={setRejectDialogContext}
                tabName="stock_groups"
                codeKey="group_code"
                nameKey="group_name"
              />
            </MasterCardWrapper>
          </TabsContent>
        )}

        {visibleTabs.includes("units") && (
          <TabsContent value="units">
            <MasterCardWrapper
              icon={Ruler}
              title="Units of Measure"
              description="Manage measurement units and GST UQC codes"
              isAdminOrSuper={isAdminOrSuper}
              subTab={unitSubTab}
              setSubTab={setUnitSubTab}
              pendingCount={pendingUnits.length}
              headerActions={
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 md:h-9 border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/80 text-emerald-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                    disabled={isMasterTabReadOnly}
                    onClick={() => setUnitBulkImportOpen(true)}
                    title={isMasterTabReadOnly ? "View Only Access" : "Import Units via CSV/Excel"}
                  >
                    <Upload className="w-3.5 h-3.5 mr-1" />
                    Import CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 md:h-9 border-blue-200 bg-blue-50/60 hover:bg-blue-100/80 text-blue-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                    disabled={isExportingUnits}
                    onClick={handleExportUnitsCsv}
                    title="Export Units to CSV"
                  >
                    {isExportingUnits ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                    ) : (
                      <Download className="w-3.5 h-3.5 mr-1" />
                    )}
                    Export CSV
                  </Button>
                </div>
              }
            >
              <SimpleMasterTable
                subTab={unitSubTab}
                isLoading={isUnitLoading}
                items={unitsList}
                sortedItems={sortedUnits}
                pendingItems={pendingUnits}
                sortState={unitSort}
                toggleSort={toggleSort}
                setSortState={setUnitSort}
                endRef={unitEndRef}
                isFetchingNext={isFetchingNextUnit}
                canEditActiveTab={canEditActiveTab}
                canEditExisting={canEditExisting}
                isReviewing={isReviewing}
                openEditDialog={openEditDialog}
                setDeletingItem={setDeletingItem}
                setIsDeleteDialogOpen={setIsDeleteDialogOpen}
                openApprovalModal={(tab, item) => openApprovalModal(tab, item)}
                setRejectDialogContext={setRejectDialogContext}
                tabName="units"
                codeKey="unit_code"
                nameKey="unit_name"
              />
            </MasterCardWrapper>
          </TabsContent>
        )}

        {visibleTabs.includes("raw_materials") && (
          <TabsContent value="raw_materials">
            <MasterCardWrapper
              icon={Landmark}
              title="Raw Materials"
              description="Manage raw material inventory items"
              isAdminOrSuper={isAdminOrSuper}
              subTab={rawMaterialSubTab}
              setSubTab={setRawMaterialSubTab}
              pendingCount={pendingRawMaterials.length}
              headerActions={
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 md:h-9 border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/80 text-emerald-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                    disabled={isMasterTabReadOnly}
                    onClick={() => setRawMaterialBulkImportOpen(true)}
                    title={isMasterTabReadOnly ? "View Only Access" : "Import Raw Materials via CSV/Excel"}
                  >
                    <Upload className="w-3.5 h-3.5 mr-1" />
                    Import CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 md:h-9 border-blue-200 bg-blue-50/60 hover:bg-blue-100/80 text-blue-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                    disabled={isExportingRawMaterials}
                    onClick={handleExportRawMaterialsCsv}
                    title="Export Raw Materials to CSV"
                  >
                    {isExportingRawMaterials ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                    ) : (
                      <Download className="w-3.5 h-3.5 mr-1" />
                    )}
                    Export CSV
                  </Button>
                </div>
              }
            >
              <RawMaterialMasterTable
                subTab={rawMaterialSubTab}
                isLoading={isRawMaterialLoading}
                items={rawMaterialsList}
                sortedItems={sortedRawMaterials}
                pendingItems={pendingRawMaterials}
                sortState={rawMaterialSort}
                toggleSort={toggleSort}
                setSortState={setRawMaterialSort}
                endRef={rawMaterialEndRef}
                isFetchingNext={isFetchingNextRawMaterial}
                canEditActiveTab={canEditActiveTab}
                canEditExisting={canEditExisting}
                isReviewing={isReviewing}
                openEditDialog={openEditDialog}
                setDeletingItem={setDeletingItem}
                setIsDeleteDialogOpen={setIsDeleteDialogOpen}
                openApprovalModal={(tab, item) => openApprovalModal(tab, item)}
                setRejectDialogContext={setRejectDialogContext}
              />
            </MasterCardWrapper>
          </TabsContent>
        )}

        {visibleTabs.includes("semi_finished_goods") && (
          <TabsContent value="semi_finished_goods">
            <MasterCardWrapper
              icon={FlaskConical}
              title="Semi-Finished Goods"
              description="Manage intermediate production goods"
              isAdminOrSuper={isAdminOrSuper}
              subTab={semiFinishedGoodSubTab}
              setSubTab={setSemiFinishedGoodSubTab}
              headerActions={
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 md:h-9 border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/80 text-emerald-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                    disabled={isMasterTabReadOnly}
                    onClick={() => setSemiFinishedGoodBulkImportOpen(true)}
                    title={isMasterTabReadOnly ? "View Only Access" : "Import Semi-Finished Goods via CSV/Excel"}
                  >
                    <Upload className="w-3.5 h-3.5 mr-1" />
                    Import CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 md:h-9 border-blue-200 bg-blue-50/60 hover:bg-blue-100/80 text-blue-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                    disabled={isExportingSemiFinishedGoods}
                    onClick={handleExportSemiFinishedGoodsCsv}
                    title="Export Semi-Finished Goods to CSV"
                  >
                    {isExportingSemiFinishedGoods ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                    ) : (
                      <Download className="w-3.5 h-3.5 mr-1" />
                    )}
                    Export CSV
                  </Button>
                </div>
              }
            >
              <SemiFinishedGoodMasterTable
                subTab={semiFinishedGoodSubTab}
                isLoading={isSemiFinishedGoodLoading}
                items={semiFinishedGoodsList}
                sortedItems={sortedSemiFinishedGoods}
                pendingItems={pendingSemiFinishedGoods}
                sortState={semiFinishedGoodSort}
                toggleSort={toggleSort}
                setSortState={setSemiFinishedGoodSort}
                endRef={semiFinishedGoodEndRef}
                isFetchingNext={isFetchingNextSemiFinishedGood}
                canEditActiveTab={canEditActiveTab}
                canEditExisting={canEditExisting}
                isReviewing={isReviewing}
                openEditDialog={openEditDialog}
                setDeletingItem={setDeletingItem}
                setIsDeleteDialogOpen={setIsDeleteDialogOpen}
                openApprovalModal={(tab, item) => openApprovalModal(tab, item)}
                setRejectDialogContext={setRejectDialogContext}
              />
            </MasterCardWrapper>
          </TabsContent>
        )}

        {visibleTabs.includes("petrol_pumps") && (
          <TabsContent value="petrol_pumps">
            <MasterCardWrapper
              icon={Fuel}
              title="Petrol Pumps"
              description="Manage fuel pump vendors"
              isAdminOrSuper={isAdminOrSuper}
              subTab={petrolPumpSubTab}
              setSubTab={setPetrolPumpSubTab}
              pendingCount={pendingPetrolPumps.length}
              headerActions={
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 md:h-9 border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/80 text-emerald-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                    disabled={isMasterTabReadOnly}
                    onClick={() => setPetrolPumpBulkImportOpen(true)}
                    title={isMasterTabReadOnly ? "View Only Access" : "Import Petrol Pumps via CSV/Excel"}
                  >
                    <Upload className="w-3.5 h-3.5 mr-1" />
                    Import CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 md:h-9 border-blue-200 bg-blue-50/60 hover:bg-blue-100/80 text-blue-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                    disabled={isExportingPetrolPumps}
                    onClick={handleExportPetrolPumpsCsv}
                    title="Export Petrol Pumps to CSV"
                  >
                    {isExportingPetrolPumps ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                    ) : (
                      <Download className="w-3.5 h-3.5 mr-1" />
                    )}
                    Export CSV
                  </Button>
                </div>
              }
            >
              <SimpleMasterTable
                subTab={petrolPumpSubTab}
                isLoading={isPetrolPumpLoading}
                items={petrolPumpsList}
                sortedItems={sortedPetrolPumps}
                pendingItems={pendingPetrolPumps}
                sortState={petrolPumpSort}
                toggleSort={toggleSort}
                setSortState={setPetrolPumpSort}
                endRef={petrolPumpEndRef}
                isFetchingNext={isFetchingNextPetrolPump}
                canEditActiveTab={canEditActiveTab}
                canEditExisting={canEditExisting}
                isReviewing={isReviewing}
                openEditDialog={openEditDialog}
                setDeletingItem={setDeletingItem}
                setIsDeleteDialogOpen={setIsDeleteDialogOpen}
                openApprovalModal={(tab, item) => openApprovalModal(tab, item)}
                setRejectDialogContext={setRejectDialogContext}
                tabName="petrol_pumps"
                codeKey="pump_code"
                nameKey="pump_name"
              />
            </MasterCardWrapper>
          </TabsContent>
        )}

        {visibleTabs.includes("cd_rules") && (
          <TabsContent value="cd_rules">
            <MasterCardWrapper
              icon={Percent}
              title="Cash Discount Rules"
              description="Manage cash discount terms and conditions"
              isAdminOrSuper={isAdminOrSuper}
              subTab={cdRuleSubTab}
              setSubTab={setCdRuleSubTab}
              pendingCount={pendingCdRules.length}
              headerActions={
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 md:h-9 border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/80 text-emerald-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                    disabled={isMasterTabReadOnly}
                    onClick={() => setCdRuleBulkImportOpen(true)}
                    title={isMasterTabReadOnly ? "View Only Access" : "Import Cash Discount Rules via CSV/Excel"}
                  >
                    <Upload className="w-3.5 h-3.5 mr-1" />
                    Import CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 md:h-9 border-blue-200 bg-blue-50/60 hover:bg-blue-100/80 text-blue-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                    disabled={isExportingCdRules}
                    onClick={handleExportCdRulesCsv}
                    title="Export Cash Discount Rules to CSV"
                  >
                    {isExportingCdRules ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                    ) : (
                      <Download className="w-3.5 h-3.5 mr-1" />
                    )}
                    Export CSV
                  </Button>
                </div>
              }
            >

              <CdRuleMasterTable
                subTab={cdRuleSubTab}
                isLoading={isCdRuleLoading}
                items={cdRulesList}
                sortedItems={sortedCdRules}
                pendingItems={pendingCdRules}
                stockCategoryData={stockCategoryData}
                sortState={cdRuleSort}
                toggleSort={toggleSort}
                setSortState={setCdRuleSort}
                endRef={cdRuleEndRef}
                isFetchingNext={isFetchingNextCdRule}
                canEditActiveTab={canEditActiveTab}
                canEditExisting={canEditExisting}
                isReviewing={isReviewing}
                openEditDialog={openEditDialog}
                setDeletingItem={setDeletingItem}
                setIsDeleteDialogOpen={setIsDeleteDialogOpen}
                openApprovalModal={(tab, item) => openApprovalModal(tab, item)}
                setRejectDialogContext={setRejectDialogContext}
              />
            </MasterCardWrapper>
          </TabsContent>
        )}

        {visibleTabs.includes("tds_rules") && (
          <TabsContent value="tds_rules">
            <MasterCardWrapper
              icon={Calculator}
              title="TDS Rules"
              description="Manage Tax Deducted at Source rules and thresholds"
              isAdminOrSuper={isAdminOrSuper}
              subTab={tdsRuleSubTab}
              setSubTab={setTdsRuleSubTab}
              pendingCount={pendingTdsRules.length}
              headerActions={
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 md:h-9 border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/80 text-emerald-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                    disabled={isMasterTabReadOnly}
                    onClick={() => setTdsRuleBulkImportOpen(true)}
                    title={isMasterTabReadOnly ? "View Only Access" : "Import TDS Rules via CSV/Excel"}
                  >
                    <Upload className="w-3.5 h-3.5 mr-1" />
                    Import CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 md:h-9 border-blue-200 bg-blue-50/60 hover:bg-blue-100/80 text-blue-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                    disabled={isExportingTdsRules}
                    onClick={handleExportTdsRulesCsv}
                    title="Export TDS Rules to CSV"
                  >
                    {isExportingTdsRules ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                    ) : (
                      <Download className="w-3.5 h-3.5 mr-1" />
                    )}
                    Export CSV
                  </Button>
                </div>
              }
            >

              <TdsRuleMasterTable
                subTab={tdsRuleSubTab}
                isLoading={isTdsRuleLoading}
                items={tdsRulesList}
                sortedItems={sortedTdsRules}
                pendingItems={pendingTdsRules}
                sortState={tdsRuleSort}
                toggleSort={toggleSort}
                setSortState={setTdsRuleSort}
                endRef={tdsRuleEndRef}
                isFetchingNext={isFetchingNextTdsRule}
                canEditActiveTab={canEditActiveTab}
                canEditExisting={canEditExisting}
                isReviewing={isReviewing}
                openEditDialog={openEditDialog}
                setDeletingItem={setDeletingItem}
                setIsDeleteDialogOpen={setIsDeleteDialogOpen}
                openApprovalModal={(tab, item) => openApprovalModal(tab, item)}
                setRejectDialogContext={setRejectDialogContext}
              />
            </MasterCardWrapper>
          </TabsContent>
        )}

        {visibleTabs.includes("oil_tags") && (
          <TabsContent value="oil_tags">
            <MasterCardWrapper
              icon={Tag}
              title="Oil Type Tags"
              description="Manage oil type classifications"
              hideSubTabs
              headerActions={
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 md:h-9 border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/80 text-emerald-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                    disabled={isMasterTabReadOnly}
                    onClick={() => setOilTagBulkImportOpen(true)}
                    title={isMasterTabReadOnly ? "View Only Access" : "Import Oil Tags via CSV/Excel"}
                  >
                    <Upload className="w-3.5 h-3.5 mr-1" />
                    Import CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 md:h-9 border-blue-200 bg-blue-50/60 hover:bg-blue-100/80 text-blue-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                    disabled={isExportingOilTags}
                    onClick={handleExportOilTagsCsv}
                    title="Export Oil Tags to CSV"
                  >
                    {isExportingOilTags ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                    ) : (
                      <Download className="w-3.5 h-3.5 mr-1" />
                    )}
                    Export CSV
                  </Button>
                </div>
              }
            >
              <SimpleMasterTable
                subTab="active"
                isLoading={isOilTagsLoading}
                items={oilTagsList}
                sortedItems={oilTagsList}
                pendingItems={[]}
                sortState={{ col: 'name', dir: 'asc' }}
                toggleSort={() => {}}
                setSortState={() => {}}
                endRef={() => {}}
                isFetchingNext={false}
                canEditActiveTab={canEditActiveTab}
                canEditExisting={canEditExisting}
                isReviewing={false}
                openEditDialog={openEditDialog}
                setDeletingItem={setDeletingItem}
                setIsDeleteDialogOpen={setIsDeleteDialogOpen}
                openApprovalModal={() => {}}
                setRejectDialogContext={setRejectDialogContext}
                tabName="oil_tags"
                codeKey="id"
                nameKey="name"
              />
            </MasterCardWrapper>
          </TabsContent>
        )}

        {visibleTabs.includes("bhada_rates") && (
          <TabsContent value="bhada_rates">
            <MasterCardWrapper
              icon={Route}
              title="Bhada (Freight) Rates"
              description="Manage freight rates per destination"
              isAdminOrSuper={isAdminOrSuper}
              subTab={bhadaRateSubTab}
              setSubTab={setBhadaRateSubTab}
              pendingCount={pendingBhadaRates.length}
              headerActions={
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 md:h-9 border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/80 text-emerald-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                    disabled={isMasterTabReadOnly}
                    onClick={() => setBhadaRateBulkImportOpen(true)}
                    title={isMasterTabReadOnly ? "View Only Access" : "Import Bhada Rates via CSV/Excel"}
                  >
                    <Upload className="w-3.5 h-3.5 mr-1" />
                    Import CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 md:h-9 border-blue-200 bg-blue-50/60 hover:bg-blue-100/80 text-blue-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                    disabled={isExportingBhadaRates}
                    onClick={handleExportBhadaRatesCsv}
                    title="Export Bhada Rates to CSV"
                  >
                    {isExportingBhadaRates ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                    ) : (
                      <Download className="w-3.5 h-3.5 mr-1" />
                    )}
                    Export CSV
                  </Button>
                </div>
              }
            >
              <SimpleMasterTable
                subTab={bhadaRateSubTab}
                isLoading={isBhadaRateLoading}
                items={bhadaRatesList}
                sortedItems={sortedBhadaRates}
                pendingItems={pendingBhadaRates}
                sortState={bhadaRateSort}
                toggleSort={toggleSort}
                setSortState={setBhadaRateSort}
                endRef={bhadaRateEndRef}
                isFetchingNext={isFetchingNextBhadaRate}
                canEditActiveTab={canEditActiveTab}
                canEditExisting={canEditExisting}
                isReviewing={isReviewing}
                openEditDialog={openEditDialog}
                setDeletingItem={setDeletingItem}
                setIsDeleteDialogOpen={setIsDeleteDialogOpen}
                openApprovalModal={(tab, item) => openApprovalModal(tab, item)}
                setRejectDialogContext={setRejectDialogContext}
                tabName="bhada_rates"
                codeKey="bhada_rate_code"
                nameKey="name"
              />
            </MasterCardWrapper>
          </TabsContent>
        )}

        {visibleTabs.includes("insurance_details") && (
          <TabsContent value="insurance_details">
            <MasterCardWrapper
              icon={Shield}
              title="Vehicle Insurance"
              description="Manage vehicle policy details"
              isAdminOrSuper={isAdminOrSuper}
              subTab={insuranceDetailSubTab}
              setSubTab={setInsuranceDetailSubTab}
              headerActions={
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 md:h-9 border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/80 text-emerald-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                    disabled={isMasterTabReadOnly}
                    onClick={() => setInsuranceDetailBulkImportOpen(true)}
                    title={isMasterTabReadOnly ? "View Only Access" : "Import Insurance Details via CSV/Excel"}
                  >
                    <Upload className="w-3.5 h-3.5 mr-1" />
                    Import CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 md:h-9 border-blue-200 bg-blue-50/60 hover:bg-blue-100/80 text-blue-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                    disabled={isExportingInsuranceDetails}
                    onClick={handleExportInsuranceDetailsCsv}
                    title="Export Insurance Details to CSV"
                  >
                    {isExportingInsuranceDetails ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                    ) : (
                      <Download className="w-3.5 h-3.5 mr-1" />
                    )}
                    Export CSV
                  </Button>
                </div>
              }
            >
              <InsuranceDetailMasterTable
                subTab={insuranceDetailSubTab}
                isLoading={isInsuranceDetailLoading}
                items={insuranceDetailsList}
                sortedItems={sortedInsuranceDetails}
                pendingItems={pendingInsuranceDetails}
                sortState={insuranceDetailSort}
                toggleSort={toggleSort}
                setSortState={setInsuranceDetailSort}
                endRef={insuranceDetailEndRef}
                isFetchingNext={isFetchingNextInsuranceDetail}
                canEditActiveTab={canEditActiveTab}
                canEditExisting={canEditExisting}
                isReviewing={isReviewing}
                openEditDialog={openEditDialog}
                setDeletingItem={setDeletingItem}
                setIsDeleteDialogOpen={setIsDeleteDialogOpen}
                openApprovalModal={(tab, item) => openApprovalModal(tab, item)}
                setRejectDialogContext={setRejectDialogContext}
              />
            </MasterCardWrapper>
          </TabsContent>
        )}

        {visibleTabs.includes("conversion_formulas") && (
          <TabsContent value="conversion_formulas">
            <MasterCardWrapper
              icon={Calculator}
              title="Conversion Formulas"
              description="Manage oil extraction yield conversion formulas"
              isAdminOrSuper={isAdminOrSuper}
              subTab={conversionFormulaSubTab}
              setSubTab={setConversionFormulaSubTab}
              pendingCount={pendingConversionFormulas.length}
              headerActions={
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 md:h-9 border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/80 text-emerald-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                    disabled={isMasterTabReadOnly}
                    onClick={() => setConversionFormulaBulkImportOpen(true)}
                    title={isMasterTabReadOnly ? "View Only Access" : "Import Conversion Formulas via CSV/Excel"}
                  >
                    <Upload className="w-3.5 h-3.5 mr-1" />
                    Import CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 md:h-9 border-blue-200 bg-blue-50/60 hover:bg-blue-100/80 text-blue-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                    disabled={isExportingConversionFormulas}
                    onClick={handleExportConversionFormulasCsv}
                    title="Export Conversion Formulas to CSV"
                  >
                    {isExportingConversionFormulas ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                    ) : (
                      <Download className="w-3.5 h-3.5 mr-1" />
                    )}
                    Export CSV
                  </Button>
                </div>
              }
            >
              <ConversionFormulaMasterTable
                subTab={conversionFormulaSubTab}
                isLoading={isConversionFormulaLoading}
                items={conversionFormulasList}
                sortedItems={sortedConversionFormulas}
                pendingItems={pendingConversionFormulas}
                sortState={conversionFormulaSort}
                toggleSort={toggleSort}
                setSortState={setConversionFormulaSort}
                endRef={conversionFormulaEndRef}
                isFetchingNext={isFetchingNextConversionFormula}
                canEditActiveTab={canEditActiveTab}
                canEditExisting={canEditExisting}
                isReviewing={isReviewing}
                openEditDialog={openEditDialog}
                setDeletingItem={setDeletingItem}
                setIsDeleteDialogOpen={setIsDeleteDialogOpen}
                openApprovalModal={(tab, item) => openApprovalModal(tab, item)}
                setRejectDialogContext={setRejectDialogContext}
              />
            </MasterCardWrapper>
          </TabsContent>
        )}

        {visibleTabs.includes("price_levels") && (
          <TabsContent value="price_levels">
            <MasterCardWrapper
              icon={Tag}
              title="Price Levels"
              description="Manage pricing tiers and customer price levels"
              isAdminOrSuper={isAdminOrSuper}
              subTab={priceLevelSubTab}
              setSubTab={setPriceLevelSubTab}
              pendingCount={pendingPriceLevels.length}
              headerActions={
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 md:h-9 border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/80 text-emerald-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                    disabled={isMasterTabReadOnly}
                    onClick={() => setPriceLevelBulkImportOpen(true)}
                    title={isMasterTabReadOnly ? "View Only Access" : "Import Price Levels via CSV/Excel"}
                  >
                    <Upload className="w-3.5 h-3.5 mr-1" />
                    Import CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 md:h-9 border-blue-200 bg-blue-50/60 hover:bg-blue-100/80 text-blue-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                    disabled={isExportingPriceLevels}
                    onClick={handleExportPriceLevelsCsv}
                    title="Export Price Levels to CSV"
                  >
                    {isExportingPriceLevels ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                    ) : (
                      <Download className="w-3.5 h-3.5 mr-1" />
                    )}
                    Export CSV
                  </Button>
                </div>
              }
            >
              <PriceLevelMasterTable
                subTab={priceLevelSubTab}
                isLoading={isPriceLevelLoading}
                items={priceLevelsList}
                sortedItems={sortedPriceLevels}
                pendingItems={pendingPriceLevels}
                sortState={priceLevelSort}
                toggleSort={toggleSort}
                setSortState={setPriceLevelSort}
                endRef={priceLevelEndRef}
                isFetchingNext={isFetchingNextPriceLevel}
                canEditActiveTab={canEditActiveTab}
                canEditExisting={canEditExisting}
                isReviewing={isReviewing}
                openEditDialog={openEditDialog}
                setDeletingItem={setDeletingItem}
                setIsDeleteDialogOpen={setIsDeleteDialogOpen}
                openApprovalModal={(tab, item) => openApprovalModal(tab, item)}
                setRejectDialogContext={setRejectDialogContext}
              />
            </MasterCardWrapper>
          </TabsContent>
        )}

        {visibleTabs.includes("sku_details") && (
          <TabsContent value="sku_details">
            <MasterCardWrapper
              icon={Package}
              title="Finished Goods (SKUs)"
              description="Manage oil products and finished goods"
              isAdminOrSuper={isAdminOrSuper}
              subTab={skuSubTab}
              setSubTab={setSkuSubTab}
              pendingCount={pendingSkus.length}
              headerActions={
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 md:h-9 border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/80 text-emerald-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                    disabled={isMasterTabReadOnly}
                    onClick={() => setFinishedGoodsBulkImportOpen(true)}
                    title={isMasterTabReadOnly ? "View Only Access" : "Import Finished Goods via CSV/Excel"}
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Import CSV</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 md:h-9 border-blue-200 bg-blue-50/60 hover:bg-blue-100/80 text-blue-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                    disabled={isExportingFinishedGoods}
                    onClick={handleExportFinishedGoodsCsv}
                    title="Export all Finished Goods records as CSV"
                  >
                    {isExportingFinishedGoods ? (
                      <Loader2 className="h-3.5 w-3.5 text-blue-600 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5 text-blue-600" />
                    )}
                    <span>Export CSV</span>
                  </Button>
                </div>
              }
            >
              <SkuDetailsMasterTable
                subTab={skuSubTab}
                isLoading={isSkuLoading}
                items={skuDetails}
                sortedItems={sortedSkuDetails}
                pendingItems={pendingSkus}
                sortState={skuSort}
                toggleSort={toggleSort}
                setSortState={setSkuSort}
                endRef={skuEndRef}
                isFetchingNext={isFetchingNextSku}
                canEditActiveTab={canEditActiveTab}
                canEditExisting={canEditExisting}
                isReviewing={isReviewing}
                openEditDialog={openEditDialog}
                setDeletingItem={setDeletingItem}
                setIsDeleteDialogOpen={setIsDeleteDialogOpen}
                openApprovalModal={(tab, item) => openApprovalModal(tab, item)}
                setRejectDialogContext={setRejectDialogContext}
              />
            </MasterCardWrapper>
          </TabsContent>
        )}

        {visibleTabs.includes("sku_selling_price") && (
          <TabsContent value="sku_selling_price">
            <MasterCardWrapper
              icon={Tag}
              title="SKU Selling Prices"
              description="Manage SKU selling pricing records"
              isAdminOrSuper={isAdminOrSuper}
              subTab={skuSellingPriceSubTab}
              setSubTab={setSkuSellingPriceSubTab}
              pendingCount={pendingSkuSellingPrices.length}
              headerActions={
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 md:h-9 border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/80 text-emerald-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                    disabled={isMasterTabReadOnly}
                    onClick={() => setPricingBulkImportOpen(true)}
                    title={isMasterTabReadOnly ? "View Only Access" : "Import SKU Selling Prices via CSV/Excel"}
                  >
                    <Upload className="w-3.5 h-3.5 mr-1" />
                    Import CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 md:h-9 border-blue-200 bg-blue-50/60 hover:bg-blue-100/80 text-blue-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                    disabled={isExportingPricing}
                    onClick={handleExportPricingCsv}
                    title="Export SKU Selling Prices to CSV"
                  >
                    {isExportingPricing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                    ) : (
                      <Download className="w-3.5 h-3.5 mr-1" />
                    )}
                    Export CSV
                  </Button>
                </div>
              }
            >
              <SkuSellingPriceMasterTable
                isLoading={isSkuSellingPriceLoading}
                items={skuSellingPrices}
                sortedItems={sortedSkuSellingPrices}
                sortState={skuSellingPriceSort}
                toggleSort={toggleSort}
                setSortState={setSkuSellingPriceSort}
                endRef={skuSellingPriceEndRef}
                isFetchingNext={isFetchingNextSkuSellingPrice}
                canEditExisting={canEditExisting}
                openEditDialog={openEditDialog}
                setDeletingItem={setDeletingItem}
                setIsDeleteDialogOpen={setIsDeleteDialogOpen}
              />
            </MasterCardWrapper>
          </TabsContent>
        )}

        {visibleTabs.includes("vehicle_master") && (
          <TabsContent value="vehicle_master">
            <MasterCardWrapper
              icon={Truck}
              title="Vehicles"
              description="Manage company and contractor vehicle records"
              isAdminOrSuper={isAdminOrSuper}
              subTab={vehicleSubTab}
              setSubTab={setVehicleSubTab}
              pendingCount={pendingVehicles.length}
              headerActions={
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 md:h-9 border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/80 text-emerald-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                    disabled={isMasterTabReadOnly}
                    onClick={() => setVehicleBulkImportOpen(true)}
                    title={isMasterTabReadOnly ? "View Only Access" : "Import Vehicles via CSV/Excel"}
                  >
                    <Upload className="w-3.5 h-3.5 mr-1" />
                    Import CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 md:h-9 border-blue-200 bg-blue-50/60 hover:bg-blue-100/80 text-blue-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                    disabled={isExportingVehicles}
                    onClick={handleExportVehiclesCsv}
                    title="Export Vehicles to CSV"
                  >
                    {isExportingVehicles ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                    ) : (
                      <Download className="w-3.5 h-3.5 mr-1" />
                    )}
                    Export CSV
                  </Button>
                </div>
              }
            >
              <VehicleMasterTable
                subTab={vehicleSubTab}
                isLoading={isVehicleLoading}
                items={vehicles}
                sortedItems={sortedVehicles}
                pendingItems={pendingVehicles}
                sortState={vehicleSort}
                toggleSort={toggleSort}
                setSortState={setVehicleSort}
                endRef={vehicleEndRef}
                isFetchingNext={isFetchingNextVehicle}
                canEditActiveTab={canEditActiveTab}
                canEditExisting={canEditExisting}
                isReviewing={isReviewing}
                openEditDialog={openEditDialog}
                setDeletingItem={setDeletingItem}
                setIsDeleteDialogOpen={setIsDeleteDialogOpen}
                openApprovalModal={(tab, item) => openApprovalModal(tab, item)}
                setRejectDialogContext={setRejectDialogContext}
                formatDocDate={formatDocDate}
                renderDocCell={renderDocCell}
              />
            </MasterCardWrapper>
          </TabsContent>
        )}

        {visibleTabs.includes("driver_master") && (
          <TabsContent value="driver_master">
            <MasterCardWrapper
              icon={User}
              title="Drivers"
              description="Manage vehicle drivers"
              isAdminOrSuper={isAdminOrSuper}
              subTab={driverSubTab}
              setSubTab={setDriverSubTab}
              pendingCount={pendingDrivers.length}
              headerActions={
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 md:h-9 border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/80 text-emerald-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                    disabled={isMasterTabReadOnly}
                    onClick={() => setDriverBulkImportOpen(true)}
                    title={isMasterTabReadOnly ? "View Only Access" : "Import Drivers via CSV/Excel"}
                  >
                    <Upload className="w-3.5 h-3.5 mr-1" />
                    Import CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 md:h-9 border-blue-200 bg-blue-50/60 hover:bg-blue-100/80 text-blue-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                    disabled={isExportingDrivers}
                    onClick={handleExportDriversCsv}
                    title="Export Drivers to CSV"
                  >
                    {isExportingDrivers ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                    ) : (
                      <Download className="w-3.5 h-3.5 mr-1" />
                    )}
                    Export CSV
                  </Button>
                </div>
              }
            >
              <DriverMasterTable
                subTab={driverSubTab}
                isLoading={isDriverLoading}
                items={drivers}
                sortedItems={sortedDrivers}
                pendingItems={pendingDrivers}
                sortState={driverSort}
                toggleSort={toggleSort}
                setSortState={setDriverSort}
                endRef={driverEndRef}
                isFetchingNext={isFetchingNextDriver}
                canEditActiveTab={canEditActiveTab}
                canEditExisting={canEditExisting}
                isReviewing={isReviewing}
                openEditDialog={openEditDialog}
                setDeletingItem={setDeletingItem}
                setIsDeleteDialogOpen={setIsDeleteDialogOpen}
                openApprovalModal={(tab, item) => openApprovalModal(tab, item)}
                setRejectDialogContext={setRejectDialogContext}
              />
            </MasterCardWrapper>
          </TabsContent>
        )}

        {visibleTabs.includes("transport_master") && (
          <TabsContent value="transport_master">
            <MasterCardWrapper
              icon={Truck}
              title="Transporters"
              description="Manage transport partners and logistics"
              isAdminOrSuper={isAdminOrSuper}
              subTab={transportSubTab}
              setSubTab={setTransportSubTab}
              pendingCount={pendingTransporters.length}
              headerActions={
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 md:h-9 border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/80 text-emerald-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                    disabled={isMasterTabReadOnly}
                    onClick={() => setTransporterBulkImportOpen(true)}
                    title={isMasterTabReadOnly ? "View Only Access" : "Import Transporters via CSV/Excel"}
                  >
                    <Upload className="w-3.5 h-3.5 mr-1" />
                    Import CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 md:h-9 border-blue-200 bg-blue-50/60 hover:bg-blue-100/80 text-blue-800 shadow-2xs px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                    disabled={isExportingTransporters}
                    onClick={handleExportTransportersCsv}
                    title="Export Transporters to CSV"
                  >
                    {isExportingTransporters ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                    ) : (
                      <Download className="w-3.5 h-3.5 mr-1" />
                    )}
                    Export CSV
                  </Button>
                </div>
              }
            >
              <TransportMasterTable
                subTab={transportSubTab}
                isLoading={isTransportLoading}
                items={transporters}
                sortedItems={sortedTransporters}
                pendingItems={pendingTransporters}
                sortState={transportSort}
                toggleSort={toggleSort}
                setSortState={setTransportSort}
                endRef={transportEndRef}
                isFetchingNext={isFetchingNextTransport}
                canEditActiveTab={canEditActiveTab}
                canEditExisting={canEditExisting}
                isReviewing={isReviewing}
                openEditDialog={openEditDialog}
                setDeletingItem={setDeletingItem}
                setIsDeleteDialogOpen={setIsDeleteDialogOpen}
                openApprovalModal={(tab, item) => openApprovalModal(tab, item)}
                setRejectDialogContext={setRejectDialogContext}
              />
            </MasterCardWrapper>
          </TabsContent>
        )}

        {visibleTabs.includes("reference_data") && (
        <TabsContent value="reference_data">
          <ReferenceDataTab
            activeStates={activeStates}
            isMasterTabReadOnly={isMasterTabReadOnly}
            onImportOilTags={() => setOilTagBulkImportOpen(true)}
            onExportOilTags={handleExportOilTagsCsv}
            isExportingOilTags={isExportingOilTags}
          />
        </TabsContent>
        )}


      </Tabs>

      <SkuFieldChangeConfirmModal
        pendingSkuFieldChangeConfirm={pendingSkuFieldChangeConfirm}
        setPendingSkuFieldChangeConfirm={setPendingSkuFieldChangeConfirm}
        onConfirmEffectiveDates={(section, fieldName) => {
          setSkuEffectiveDatesSection(section as any)
          setSkuEffectiveDatesTargetField(fieldName)
        }}
      />

      <MasterFieldChangeConfirmModal
        pendingFieldChangeConfirm={pendingPriceLevelFieldChangeConfirm}
        setPendingFieldChangeConfirm={setPendingPriceLevelFieldChangeConfirm}
        entityName="price level"
        onConfirmEffectiveDates={(section, fieldName) => {
          setPriceLevelEffectiveDatesSection(section as any)
          setPriceLevelEffectiveDatesTargetField(fieldName)
        }}
      />

      <MasterFieldChangeConfirmModal
        pendingFieldChangeConfirm={pendingSkuSellingPriceFieldChangeConfirm}
        setPendingFieldChangeConfirm={setPendingSkuSellingPriceFieldChangeConfirm}
        entityName="pricing"
        onConfirmEffectiveDates={(_section, fieldName) => {
          setSkuSellingPriceEffectiveDatesOpen(true)
          setSkuSellingPriceTargetField(fieldName)
        }}
      />

      <MasterFieldChangeConfirmModal
        pendingFieldChangeConfirm={pendingVehicleFieldChangeConfirm}
        setPendingFieldChangeConfirm={setPendingVehicleFieldChangeConfirm}
        entityName="vehicle"
        onConfirmEffectiveDates={(section, fieldName) => {
          setVehicleEffectiveDatesSection(section as any)
          setVehicleEffectiveDatesTargetField(fieldName)
        }}
      />

      <MasterFieldChangeConfirmModal
        pendingFieldChangeConfirm={pendingDriverFieldChangeConfirm}
        setPendingFieldChangeConfirm={setPendingDriverFieldChangeConfirm}
        entityName="driver"
        onConfirmEffectiveDates={(section, fieldName) => {
          setDriverEffectiveDatesSection(section as any)
          setDriverEffectiveDatesTargetField(fieldName)
        }}
      />

      <MasterFieldChangeConfirmModal
        pendingFieldChangeConfirm={pendingTransportFieldChangeConfirm}
        setPendingFieldChangeConfirm={setPendingTransportFieldChangeConfirm}
        entityName="transporter"
        onConfirmEffectiveDates={(section, fieldName) => {
          setTransportEffectiveDatesSection(section as any)
          setTransportEffectiveDatesTargetField(fieldName)
        }}
      />

      <MasterFieldChangeConfirmModal
        pendingFieldChangeConfirm={pendingLedgerGroupFieldChangeConfirm}
        setPendingFieldChangeConfirm={setPendingLedgerGroupFieldChangeConfirm}
        entityName="ledger group"
        onConfirmEffectiveDates={(_section, fieldName) => {
          setLedgerGroupEffectiveDatesOpen(true)
          setLedgerGroupTargetField(fieldName)
        }}
      />

      <MasterFieldChangeConfirmModal
        pendingFieldChangeConfirm={pendingStockGroupFieldChangeConfirm}
        setPendingFieldChangeConfirm={setPendingStockGroupFieldChangeConfirm}
        entityName="stock group"
        onConfirmEffectiveDates={(_section, fieldName) => {
          setStockGroupEffectiveDatesOpen(true)
          setStockGroupTargetField(fieldName)
        }}
      />

      <MasterFieldChangeConfirmModal
        pendingFieldChangeConfirm={pendingDepotFieldChangeConfirm}
        setPendingFieldChangeConfirm={setPendingDepotFieldChangeConfirm}
        entityName="depot"
        onConfirmEffectiveDates={(section, fieldName) => {
          setDepotEffectiveDatesSection(section as any)
          setDepotEffectiveDatesTargetField(fieldName)
        }}
      />

      <MasterFieldChangeConfirmModal
        pendingFieldChangeConfirm={pendingBrokerFieldChangeConfirm}
        setPendingFieldChangeConfirm={setPendingBrokerFieldChangeConfirm}
        entityName="broker"
        onConfirmEffectiveDates={(section, fieldName) => {
          setBrokerEffectiveDatesSection(section as any)
          setBrokerEffectiveDatesTargetField(fieldName)
        }}
      />

      <MasterFieldChangeConfirmModal
        pendingFieldChangeConfirm={pendingSalespersonFieldChangeConfirm}
        setPendingFieldChangeConfirm={setPendingSalespersonFieldChangeConfirm}
        entityName="salesperson"
        onConfirmEffectiveDates={(section, fieldName) => {
          setSalespersonEffectiveDatesSection(section as any)
          setSalespersonEffectiveDatesTargetField(fieldName)
        }}
      />

      <MasterFieldChangeConfirmModal
        pendingFieldChangeConfirm={pendingPetrolPumpFieldChangeConfirm}
        setPendingFieldChangeConfirm={setPendingPetrolPumpFieldChangeConfirm}
        entityName="petrol pump"
        onConfirmEffectiveDates={(section, fieldName) => {
          setPetrolPumpEffectiveDatesSection(section as any)
          setPetrolPumpEffectiveDatesTargetField(fieldName)
        }}
      />

      <MasterFieldChangeConfirmModal
        pendingFieldChangeConfirm={pendingUnitFieldChangeConfirm}
        setPendingFieldChangeConfirm={setPendingUnitFieldChangeConfirm}
        entityName="unit"
        onConfirmEffectiveDates={(_section, fieldName) => {
          setUnitEffectiveDatesOpen(true)
          setUnitTargetField(fieldName)
        }}
      />

      <MasterFieldChangeConfirmModal
        pendingFieldChangeConfirm={pendingRawMaterialFieldChangeConfirm}
        setPendingFieldChangeConfirm={setPendingRawMaterialFieldChangeConfirm}
        entityName="raw material"
        onConfirmEffectiveDates={(section, fieldName) => {
          setRawMaterialEffectiveDatesSection(section as any)
          setRawMaterialEffectiveDatesTargetField(fieldName)
        }}
      />

      <MasterFieldChangeConfirmModal
        pendingFieldChangeConfirm={pendingSemiFinishedGoodFieldChangeConfirm}
        setPendingFieldChangeConfirm={setPendingSemiFinishedGoodFieldChangeConfirm}
        entityName="semi-finished good"
        onConfirmEffectiveDates={(section, fieldName) => {
          setSemiFinishedGoodEffectiveDatesSection(section as any)
          setSemiFinishedGoodEffectiveDatesTargetField(fieldName)
        }}
      />

      <MasterFieldChangeConfirmModal
        pendingFieldChangeConfirm={pendingInsuranceDetailFieldChangeConfirm}
        setPendingFieldChangeConfirm={setPendingInsuranceDetailFieldChangeConfirm}
        entityName="insurance policy"
        onConfirmEffectiveDates={(_section, fieldName) => {
          setInsuranceDetailEffectiveDatesOpen(true)
          setInsuranceDetailTargetField(fieldName)
        }}
      />

      <MasterFieldChangeConfirmModal
        pendingFieldChangeConfirm={pendingConversionFormulaFieldChangeConfirm}
        setPendingFieldChangeConfirm={setPendingConversionFormulaFieldChangeConfirm}
        entityName="conversion formula"
        onConfirmEffectiveDates={(_section, fieldName) => {
          setConversionFormulaEffectiveDatesOpen(true)
          setConversionFormulaTargetField(fieldName)
        }}
      />

      <MasterFieldChangeConfirmModal
        pendingFieldChangeConfirm={pendingCdRuleFieldChangeConfirm}
        setPendingFieldChangeConfirm={setPendingCdRuleFieldChangeConfirm}
        entityName="cash discount rule"
        onConfirmEffectiveDates={(_section, fieldName) => {
          setCdRuleEffectiveDatesOpen(true)
          setCdRuleTargetField(fieldName)
        }}
      />

      <MasterFieldChangeConfirmModal
        pendingFieldChangeConfirm={pendingTdsRuleFieldChangeConfirm}
        setPendingFieldChangeConfirm={setPendingTdsRuleFieldChangeConfirm}
        entityName="TDS rule"
        onConfirmEffectiveDates={(_section, fieldName) => {
          setTdsRuleEffectiveDatesOpen(true)
          setTdsRuleTargetField(fieldName)
        }}
      />

      <MasterFieldChangeConfirmModal
        pendingFieldChangeConfirm={pendingOilTagFieldChangeConfirm}
        setPendingFieldChangeConfirm={setPendingOilTagFieldChangeConfirm}
        entityName="oil tag"
        onConfirmEffectiveDates={(_section, fieldName) => {
          setOilTagEffectiveDatesOpen(true)
          setOilTagTargetField(fieldName)
        }}
      />

      <MasterFieldChangeConfirmModal
        pendingFieldChangeConfirm={pendingBhadaRateFieldChangeConfirm}
        setPendingFieldChangeConfirm={setPendingBhadaRateFieldChangeConfirm}
        entityName="bhada rate"
        onConfirmEffectiveDates={(_section, fieldName) => {
          setBhadaRateEffectiveDatesOpen(true)
          setBhadaRateTargetField(fieldName)
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {activeTab === 'sku_details'
                ? "This action cannot be undone. This will permanently delete the record from the database."
                : "This action cannot be undone. This will mark the record as Inactive and it will no longer appear in active lists."
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setIsDeleteDialogOpen(false); setDeletingItem(null); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90 transition-all shadow-md">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Record
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Approve with Review Dialog (shared for all tabs) */}
      <Dialog open={!!approvalReviewModal} onOpenChange={(open) => { if (!open) { setApprovalReviewModal(null); setApprovalEditData({}); resetForms() } }}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto" style={{ maxWidth: '750px' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-emerald-600" />
              Review & Approve
            </DialogTitle>
            <DialogDescription>
              Review the submitted values below. You can edit any field before approving. The final approved record will use these values.
            </DialogDescription>
          </DialogHeader>

          {approvalReviewModal && (
            <div className="grid gap-3 py-2">
              {renderProposedChanges()}
              {renderFormForTab(approvalReviewModal.tab)}
              {approvalReviewModal.item?.id && approvalReviewModal.tab !== "customers" && (
                <div className="space-y-2 border-t pt-4 mt-2">
                  <Label className="text-slate-600 font-semibold flex items-center gap-1.5 text-xs">
                    <Clock className="h-3.5 w-3.5 text-slate-500" />
                    {(TAB_META[approvalReviewModal.tab]?.label || approvalReviewModal.tab.replace('_', ' '))} History Table
                  </Label>
                  <MasterEditHistoryTable masterType={approvalReviewModal.tab} recordId={approvalReviewModal.item.id} />
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setApprovalReviewModal(null); setApprovalEditData({}); resetForms() }}>Cancel</Button>
            <Button
              onClick={() => {
                if (!approvalReviewModal) return
                // Every master reviews by the real serial id in v2 (the legacy
                // depot_id/broker_id text business codes are display-only now).
                const idMap: Record<string, any> = {
                  customers: approvalReviewModal.item.id,
                  depots: approvalReviewModal.item.id,
                  brokers: approvalReviewModal.item.id,
                  salespersons: approvalReviewModal.item.id,
                  ledger_groups: approvalReviewModal.item.id,
                  stock_groups: approvalReviewModal.item.id,
                  units: approvalReviewModal.item.id,
                  raw_materials: approvalReviewModal.item.id,
                  semi_finished_goods: approvalReviewModal.item.id,
                  insurance_details: approvalReviewModal.item.id,
                  conversion_formulas: approvalReviewModal.item.id,
                  price_levels: approvalReviewModal.item.id,
                  petrol_pumps: approvalReviewModal.item.id,
                  cd_rules: approvalReviewModal.item.id,
                  tds_rules: approvalReviewModal.item.id,
                  bhada_rates: approvalReviewModal.item.id,
                  sku_details: approvalReviewModal.item.id,
                  vehicle_master: approvalReviewModal.item.id,
                  driver_master: approvalReviewModal.item.id,
                  transport_master: approvalReviewModal.item.id,
                }
                // Submit the SAME per-tab Add/Edit form state the modal is bound to.
                handleReviewRecord(approvalReviewModal.tab, idMap[approvalReviewModal.tab], 'approve', undefined, getFormForTab(approvalReviewModal.tab))
              }}
              disabled={isReviewing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isReviewing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Record Dialog (shared for all tabs) */}
      <AlertDialog open={!!rejectDialogContext} onOpenChange={(open) => { if (!open) { setRejectDialogContext(null); setRejectionReason("") } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Record</AlertDialogTitle>
            <AlertDialogDescription>
              Optionally provide a reason. The record will not be used anywhere once rejected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-1 pb-2">
            <Input placeholder="Rejection reason (optional)" value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setRejectDialogContext(null); setRejectionReason("") }}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => rejectDialogContext && handleReviewRecord(rejectDialogContext.tab, rejectDialogContext.id, 'reject', rejectionReason)}
              className="bg-destructive text-white hover:bg-destructive/90 transition-all shadow-md"
              disabled={isReviewing}
            >
              {isReviewing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {/* Quick Add Dialog (shared: inline "+" next to Unit/Ledger/SAC Code fields) */}
      <Dialog open={!!quickAddDialog} onOpenChange={(open) => { if (!open) setQuickAddDialog(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{quickAddDialog?.type === 'unit' ? 'Add Unit' : quickAddDialog?.type === 'ledger' ? 'Add Ledger' : quickAddDialog?.type === 'hsn_code' ? 'Add HSN Code' : 'Add SAC Code'}</DialogTitle>
            <DialogDescription>
              {quickAddDialog?.type === 'unit' ? 'Create a new Unit without leaving this form.' : quickAddDialog?.type === 'ledger' ? 'Create a new Ledger without leaving this form.' : quickAddDialog?.type === 'hsn_code' ? 'Create a new HSN Code without leaving this form.' : 'Create a new SAC Code without leaving this form.'}
            </DialogDescription>
          </DialogHeader>
          {quickAddDialog?.type === 'unit' ? (
            <div className="grid gap-4 py-2 px-1">
              <div className="space-y-2">
                <Label htmlFor="qa_unit_name">UOM *</Label>
                <Input id="qa_unit_name" value={quickAddForm.unit_name || ''} onChange={e => setQuickAddForm({ ...quickAddForm, unit_name: e.target.value })} placeholder="e.g. Kilograms" />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="qa_unit_is_active" checked={quickAddForm.status === 'Active'} onCheckedChange={checked => setQuickAddForm({ ...quickAddForm, status: checked === true ? 'Active' : 'Inactive' })} />
                <Label htmlFor="qa_unit_is_active" className="cursor-pointer">Is Active?</Label>
              </div>
            </div>
          ) : quickAddDialog?.type === 'ledger' ? (
            <div className="grid gap-4 py-2 px-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="qa_ledger_code">Ledger Code</Label>
                  <Input id="qa_ledger_code" value={quickAddForm.ledger_code || ''} readOnly className="bg-slate-100" placeholder="Auto-generated" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="qa_ledger_name">Ledger Name *</Label>
                  <Input id="qa_ledger_name" value={quickAddForm.ledger_name || ''} onChange={e => setQuickAddForm({ ...quickAddForm, ledger_name: e.target.value })} placeholder="e.g. Freight Charges" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="qa_ledger_group_id">Ledger Group</Label>
                <Select value={quickAddForm.ledger_group_id ? String(quickAddForm.ledger_group_id) : ''} onValueChange={val => setQuickAddForm({ ...quickAddForm, ledger_group_id: val })}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select ledger group" /></SelectTrigger>
                  <SelectContent>
                    {ledgerGroupOptions.map((g: any) => <SelectItem key={g.id} value={String(g.id)}>{g.group_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : quickAddDialog?.type === 'hsn_code' ? (
            <div className="grid gap-4 py-2 px-1">
              <div className="space-y-2">
                <Label htmlFor="qa_hsn_code">HSN Code (8 digits) *</Label>
                <Input id="qa_hsn_code" value={quickAddForm.code || ''} maxLength={8} onChange={e => setQuickAddForm({ ...quickAddForm, code: e.target.value.replace(/\D/g, '') })} placeholder="e.g. 73269099" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="qa_hsn_name">Description *</Label>
                <Input id="qa_hsn_name" value={quickAddForm.name || ''} onChange={e => setQuickAddForm({ ...quickAddForm, name: e.target.value })} placeholder="e.g. Test raw material" />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="qa_hsn_is_active" checked={quickAddForm.status === 'Active'} onCheckedChange={checked => setQuickAddForm({ ...quickAddForm, status: checked === true ? 'Active' : 'Inactive' })} />
                <Label htmlFor="qa_hsn_is_active" className="cursor-pointer">Is Active?</Label>
              </div>
            </div>
          ) : quickAddDialog?.type === 'sac_code' ? (
            <div className="grid gap-4 py-2 px-1">
              <div className="space-y-2">
                <Label htmlFor="qa_sac_code">SAC Code (6 digits) *</Label>
                <Input id="qa_sac_code" value={quickAddForm.code || ''} maxLength={6} onChange={e => setQuickAddForm({ ...quickAddForm, code: e.target.value.replace(/\D/g, '') })} placeholder="e.g. 996511" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="qa_sac_name">Description *</Label>
                <Input id="qa_sac_name" value={quickAddForm.name || ''} onChange={e => setQuickAddForm({ ...quickAddForm, name: e.target.value })} placeholder="e.g. Construction services" />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="qa_sac_is_active" checked={quickAddForm.status === 'Active'} onCheckedChange={checked => setQuickAddForm({ ...quickAddForm, status: checked === true ? 'Active' : 'Inactive' })} />
                <Label htmlFor="qa_sac_is_active" className="cursor-pointer">Is Active?</Label>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickAddDialog(null)} disabled={isQuickAdding}>Cancel</Button>
            <Button onClick={submitQuickAdd} disabled={isQuickAdding}>
              {isQuickAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CustomerGodownTagModal
        open={customerGodownTagOpen}
        onOpenChange={setCustomerGodownTagOpen}
        onSuccess={() => {
          refetchCustomer()
        }}
      />

      <CustomerBulkImportModal
        open={customerBulkImportOpen}
        onOpenChange={setCustomerBulkImportOpen}
        onSuccess={() => {
          refetchCustomer()
          refetchPendingCustomers()
        }}
      />

      <DepotBulkImportModal
        open={depotBulkImportOpen}
        onOpenChange={setDepotBulkImportOpen}
        onSuccess={() => {
          refetchDepot()
          refetchPendingDepots()
        }}
      />

      <BrokerBulkImportModal
        open={brokerBulkImportOpen}
        onOpenChange={setBrokerBulkImportOpen}
        onSuccess={() => {
          refetchBroker()
          refetchPendingBrokers()
        }}
      />

      <SalespersonBulkImportModal
        open={salespersonBulkImportOpen}
        onOpenChange={setSalespersonBulkImportOpen}
        onSuccess={() => {
          refetchSalesperson()
          refetchPendingSalespersons()
        }}
      />

      <FinishedGoodsBulkImportModal
        open={finishedGoodsBulkImportOpen}
        onOpenChange={setFinishedGoodsBulkImportOpen}
        onSuccess={() => {
          refetchSku()
          refetchPendingSku()
        }}
      />

      <PricingBulkImportModal
        open={pricingBulkImportOpen}
        onOpenChange={setPricingBulkImportOpen}
        onSuccess={() => {
          refetchSkuSellingPrice()
        }}
      />

      <VehicleBulkImportModal
        open={vehicleBulkImportOpen}
        onOpenChange={setVehicleBulkImportOpen}
        onSuccess={() => {
          refetchVehicle()
          refetchPendingVehicles()
        }}
      />

      <DriverBulkImportModal
        open={driverBulkImportOpen}
        onOpenChange={setDriverBulkImportOpen}
        onSuccess={() => {
          refetchDriver()
          refetchPendingDrivers()
        }}
      />

      <TransporterBulkImportModal
        open={transporterBulkImportOpen}
        onOpenChange={setTransporterBulkImportOpen}
        onSuccess={() => {
          refetchTransport()
          refetchPendingTransport()
        }}
      />

      <LedgerGroupBulkImportModal
        open={ledgerGroupBulkImportOpen}
        onOpenChange={setLedgerGroupBulkImportOpen}
        onSuccess={() => {
          refetchLedgerGroup()
          refetchPendingLedgerGroups()
        }}
      />

      <StockGroupBulkImportModal
        open={stockGroupBulkImportOpen}
        onOpenChange={setStockGroupBulkImportOpen}
        onSuccess={() => {
          refetchStockGroup()
          refetchPendingStockGroups()
        }}
      />

      <UnitBulkImportModal
        open={unitBulkImportOpen}
        onOpenChange={setUnitBulkImportOpen}
        onSuccess={() => {
          refetchUnit()
          refetchPendingUnits()
        }}
      />

      <RawMaterialBulkImportModal
        open={rawMaterialBulkImportOpen}
        onOpenChange={setRawMaterialBulkImportOpen}
        onSuccess={() => {
          refetchRawMaterial()
          refetchPendingRawMaterials()
        }}
      />

      <SemiFinishedGoodBulkImportModal
        open={semiFinishedGoodBulkImportOpen}
        onOpenChange={setSemiFinishedGoodBulkImportOpen}
        onSuccess={() => {
          refetchSemiFinishedGood()
          refetchPendingSemiFinishedGoods()
        }}
      />

      <InsuranceDetailBulkImportModal
        open={insuranceDetailBulkImportOpen}
        onOpenChange={setInsuranceDetailBulkImportOpen}
        onSuccess={() => {
          refetchInsuranceDetail()
          refetchPendingInsuranceDetails()
        }}
      />

      <ConversionFormulaBulkImportModal
        open={conversionFormulaBulkImportOpen}
        onOpenChange={setConversionFormulaBulkImportOpen}
        onSuccess={() => {
          refetchConversionFormula()
          refetchPendingConversionFormulas()
        }}
      />

      <PriceLevelBulkImportModal
        open={priceLevelBulkImportOpen}
        onOpenChange={setPriceLevelBulkImportOpen}
        onSuccess={() => {
          refetchPriceLevel()
          refetchPendingPriceLevels()
        }}
      />

      <PetrolPumpBulkImportModal
        open={petrolPumpBulkImportOpen}
        onOpenChange={setPetrolPumpBulkImportOpen}
        onSuccess={() => {
          refetchPetrolPump()
          refetchPendingPetrolPumps()
        }}
      />

      <CdRuleBulkImportModal
        open={cdRuleBulkImportOpen}
        onOpenChange={setCdRuleBulkImportOpen}
        onSuccess={() => {
          refetchCdRule()
          refetchPendingCdRules()
        }}
      />

      <TdsRuleBulkImportModal
        open={tdsRuleBulkImportOpen}
        onOpenChange={setTdsRuleBulkImportOpen}
        onSuccess={() => {
          refetchTdsRule()
          refetchPendingTdsRules()
        }}
      />

      <OilTagBulkImportModal
        open={oilTagBulkImportOpen}
        onOpenChange={setOilTagBulkImportOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["small-masters", "oil_tag"] })
        }}
      />

      <BhadaRateBulkImportModal
        open={bhadaRateBulkImportOpen}
        onOpenChange={setBhadaRateBulkImportOpen}
        onSuccess={() => {
          refetchBhadaRate()
          refetchPendingBhadaRates()
        }}
      />




      {/* Footer */}
      <div className="flex items-center justify-center pt-12 border-t border-slate-100 opacity-100">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em] hover:text-primary transition-colors cursor-default">
          Powered by Botivate
        </p>
      </div>
    </div>
  )
}


