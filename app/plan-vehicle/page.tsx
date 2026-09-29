"use client"

import React, { useEffect, useState, useMemo, useCallback, useRef } from "react"
import { Card } from "@/components/ui/card"
import { WorkflowStageShell } from "@/components/workflow/workflow-stage-shell"
import { cn } from "@/lib/utils"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { FileUploadField } from "@/components/file-upload-field"
import { Truck, Weight, Printer, Download, ChevronLeft, ChevronRight } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { planVehicleApi, skuApi, orderApi, depotApi, vehicleMasterApi, transportMasterApi, driverMasterApi } from "@/lib/api-service"
import { isStaleWriteError } from "@/lib/stale-write"
import { generateDispatchSlipPdf } from "@/lib/dispatch-slip-pdf"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Combobox } from "@/components/ui/combobox"
import { useAuth } from "@/hooks/use-auth"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { StageHistoryTab } from "@/components/workflow/stage-history-tab"

function formatDate(dateStr: string) {
  if (!dateStr) return "—";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch (e) {
    return dateStr;
  }
}

// Groups raw pending-shipment rows (from the API) by base DO number. Pulled out
// of the component so it can be reused both for the currently-loaded page
// (`displayRows`) and for a targeted, complete re-fetch of one specific DO (see
// `fetchCompleteGroupsForKeys` below) — the two need identical grouping logic.
// Pass `depoFilter` = "" to skip the depot-tab filter (used for the targeted
// fetch, where depot scoping is already enforced server-side).
// Copied verbatim from app/actual-dispatch/page.tsx — generic depot/order
// grouping logic, not specific to any one stage.
function groupOrdersByBaseDo(orders: any[], depoFilter: string): any[] {
  const grouped: { [key: string]: any } = {}

  orders.forEach((order: any) => {
    const custName = (order.transfer === 'yes' && order.bill_company_name) ? order.bill_company_name : (order.party_name || order.customerName || "Unknown")
    const doNumber = order.so_no || order.soNo || "DO/26-27/0001"
    const baseDoMatch = doNumber.match(/^(DO[-\/](?:\d{2}-\d{2}\/)?\d+)/i)
    const baseDo = baseDoMatch ? baseDoMatch[1].toUpperCase() : doNumber

    const groupKey = baseDo;

    if (!grouped[groupKey]) {
      grouped[groupKey] = {
        customerName: custName,
        _rowKey: groupKey,
        _allProducts: [],
        _productCount: 0,
        _ordersMap: {},
        _allBaseDos: new Set()
      }
    }

    grouped[groupKey]._allBaseDos.add(baseDo)

    if (!grouped[groupKey]._ordersMap[baseDo]) {
      const internalOrder = order.data?.orderData || order;

      grouped[groupKey]._ordersMap[baseDo] = {
        ...order,
        baseDo,
        _products: [],
        depoName: internalOrder.depo_name || internalOrder.depoName || "—",
        deliveryDate: internalOrder.delivery_date || internalOrder.deliveryDate || internalOrder.timestamp || "—",
        partySoDate: formatDate(internalOrder.party_so_date || internalOrder.partySoDate),
        address: internalOrder.customer_address || internalOrder.address || "—",
        brokerName: internalOrder.broker_name || internalOrder.brokerName || "—",
        orderPunchRemarks: internalOrder.order_punch_remarks || internalOrder.orderPunchRemarks || "—",
      }
    }

    const productMeta = {
      ...order,
      _rowKey: `${custName}-${baseDo}-${order.d_sr_number || order.id}`,
      orderNo: order.so_no || order.soNo,
      productName: order.product_name || order.productName,
      qtyToDispatch: order.qty_to_be_dispatched || order.qtyToDispatch,
      deliveryFrom: order.dispatch_from || order.deliveryFrom,
      dsrNumber: order.d_sr_number,
      processid: order.processid || null,
      customerName: custName,
      address: order.customer_delivery_address || order.customer_address || order.address || grouped[groupKey]._ordersMap[baseDo]?.address || "—",
      whatsapp: order.customer_contact_person_whatsapp_no || order.whatsapp || "—",
      brokerName: order.broker_name || order.brokerName || grouped[groupKey]._ordersMap[baseDo]?.brokerName || "—"
    }

    grouped[groupKey]._ordersMap[baseDo]._products.push(productMeta)
    grouped[groupKey]._allProducts.push(productMeta)
  })

  return Object.values(grouped).map((group: any) => {
    const firstOrderDetails = Object.values(group._ordersMap)[0] as any || {};
    return {
      ...group,
      ...firstOrderDetails,
      orderNo: Array.from(group._allBaseDos).join(", "),
      processId: group._allProducts[0]?.processid || "—",
      qtyToDispatch: group._allProducts.reduce((sum: number, p: any) => sum + parseFloat(p.qty_to_be_dispatched || p.qtyToDispatch || 0), 0),
      orderPunchRemarks: Array.from(new Set(Object.values(group._ordersMap).map((o: any) => o.orderPunchRemarks))).filter(Boolean).join("; ") || "—",
      _productCount: group._allProducts.length
    };
  }).filter(group => {
    if (group._productCount <= 0) return false;
    if (!depoFilter) return true;
    return (group.depoName || "").trim().toUpperCase() === depoFilter.trim().toUpperCase();
  })
}

export default function PlanVehiclePage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { isReadOnly, user } = useAuth()
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending")
  const [pendingPage, setPendingPage] = useState(1)
  const limit = 20

  const [filterValues, setFilterValues] = useState({
    search: "",
    status: "",
    startDate: "",
    endDate: "",
    partyName: "",
    manualSaudaNo: ""
  })
  const [activeDepots, setActiveDepots] = useState<any[]>([])
  const [selectedDepoTab, setSelectedDepoTab] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [skus, setSkus] = useState<any[]>([])
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [docWarningDialog, setDocWarningDialog] = useState<{ open: boolean; messages: string[] }>({ open: false, messages: [] })
  const [selectedGroups, setSelectedGroups] = useState<any[]>([])
  const [dialogSelectedProducts, setDialogSelectedProducts] = useState<string[]>([])
  const [revertRemarks, setRevertRemarks] = useState("")
  const [isSlipDialogOpen, setIsSlipDialogOpen] = useState(false)

  // Vehicle + driver + digital documents ("Stage 5/6" fields on the old page).
  const [vehicleNumber, setVehicleNumber] = useState("")
  const [vehicleData, setVehicleData] = useState({
    checkStatus: "",
    remarks: "",
    fitness: "",
    insurance: "",
    tax_copy: "",
    polution: "",
    permit1: "",
    permit2_out_state: "",
    fitness_file_name: "",
    insurance_file_name: "",
    tax_file_name: "",
    pollution_file_name: "",
    permit1_file_name: "",
    permit2_file_name: "",
    fitness_end_date: "",
    insurance_end_date: "",
    tax_end_date: "",
    pollution_end_date: "",
    permit1_end_date: "",
    permit2_end_date: "",
    registration_no: "",
    vehicle_type: "",
    rto: "",
    passing_weight: "",
    road_tax: "",
    is_lifetime_tax: false,
    fuel_type: "",
    gvw: "",
    ulw: "",
  })

  // Transporter + freight/advance-bhada + overload — these lived inside the OLD
  // page's "Weightment Audit" column even though they have nothing to do with
  // weightment; they belong to vehicle/transport planning, so they live here now.
  const [freightData, setFreightData] = useState({
    transporterName: "",
    vehicleNoPlateImage: "",
    vehicleNoPlateImage_file_name: "",
    overloadRemarks: "",
    freightRateType: "",
    freightAmount: "",
    cdAmount: "",
    finalRate: "",
    cash_bank: "",
    diesel_advance: "",
    bhada: "",
  })

  const [isUploading, setIsUploading] = useState<string | null>(null)
  const [vehicleMaster, setVehicleMaster] = useState<any[]>([])
  const [driverMaster, setDriverMaster] = useState<any[]>([])
  const [transporterMaster, setTransporterMaster] = useState<any[]>([])
  const [driverName, setDriverName] = useState("")
  const [driverData, setDriverData] = useState({
    contact_no: "",
    license_no: "",
    license_type: "",
    valid_upto: "",
    trans_valid_upto: "",
    lmv_valid_upto: ""
  })

  const vehicleOptions = useMemo(() => (
    vehicleMaster
      .filter(v => v.registration_no && v.status === 'Active')
      .map(v => ({ value: v.registration_no, label: v.registration_no }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base', numeric: true }))
  ), [vehicleMaster])

  const driverOptions = useMemo(() => (
    driverMaster
      .filter(d => d.driver_name && d.status === 'Active')
      .map(d => ({ value: d.driver_name, label: d.driver_name }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base', numeric: true }))
  ), [driverMaster])

  const transporterOptions = useMemo(() => ([
    { value: "Company Vehicle", label: "Company Vehicle" },
    { value: "Party Vehicle", label: "Party Vehicle" },
    ...transporterMaster
      .filter(t => t.transporter_name)
      .map(t => ({ value: t.transporter_name, label: t.transporter_name }))
  ]), [transporterMaster])

  // Documents must be valid at least 5 days from today. (The old Actual Dispatch
  // page had a TEMP manual override for this baseline tied to backfilling old
  // Vehicle Master records — not needed here since this is a brand-new stage.)
  const minDate = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 5)
    return d.toISOString().split("T")[0]
  }, [])

  // Interstate detection: does any selected order's delivery address fall outside
  // the vehicle's registered (RTO) state?
  const isInterState = useMemo(() => {
    if (selectedGroups.length === 0 || !vehicleData.rto) return false;

    const rtoPrefix = vehicleData.rto.substring(0, 2).toUpperCase();
    const statePrefixMap: Record<string, string> = {
      "CG": "chhattisgarh", "KA": "karnataka", "MH": "maharashtra", "DL": "delhi",
      "UP": "uttar pradesh", "HR": "haryana", "RJ": "rajasthan", "MP": "madhya pradesh",
      "GJ": "gujarat", "PB": "punjab", "WB": "west bengal", "BR": "bihar",
      "OD": "odisha", "AS": "assam", "TS": "telangana", "AP": "andhra pradesh",
      "TN": "tamil nadu", "KL": "kerala", "UK": "uttarakhand", "UA": "uttarakhand",
      "HP": "himachal pradesh", "JH": "jharkhand", "GA": "goa", "JK": "jammu",
      "PY": "puducherry", "TR": "tripura", "MZ": "mizoram", "NL": "nagaland",
      "MN": "manipur", "ML": "meghalaya", "SK": "sikkim", "AR": "arunachal",
    };

    const vehicleState = statePrefixMap[rtoPrefix];
    if (!vehicleState) return true;

    let hasInterStateOrder = false;
    selectedGroups.forEach(group => {
      Object.values(group._ordersMap).forEach((order: any) => {
        const addr = (order.address || "").toLowerCase();
        if (!addr.includes(vehicleState)) {
          hasInterStateOrder = true;
        }
      });
    });

    return hasInterStateOrder;
  }, [selectedGroups, vehicleData.rto]);

  const handleFileChange = async (field: string, fileNameField: string, file: File | null, type: 'vehicle' | 'freight' = 'vehicle') => {
    if (!file) return

    setIsUploading(field)
    try {
      const response = await orderApi.uploadFile(file)
      if (response.success) {
        if (type === 'vehicle') {
          setVehicleData(p => ({
            ...p,
            [field]: response.data.url,
            [fileNameField]: file.name
          }))
        } else {
          setFreightData(p => ({
            ...p,
            [field]: response.data.url,
            [fileNameField]: file.name
          }))
        }
        toast({
          title: "Upload Successful",
          description: `${file.name} has been uploaded.`,
        })
      }
    } catch (error: any) {
      console.error("Upload failed:", error)
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload file to S3",
        variant: "destructive",
      })
    } finally {
      setIsUploading(null)
    }
  }

  // --- SKU weight helpers (copied verbatim — generic SKU lookups, not stage-specific) ---

  const getSkuGrossWeight = (productName: string): number => {
    if (!productName || skus.length === 0) return 0
    const normalizeSkuName = (name: string) => name.toUpperCase().replace(/KGS/g, 'KG').replace(/LTRS/g, 'LTR').replace(/\s+/g, ' ').trim()
    const normalizedProductName = normalizeSkuName(productName)
    let matchedSku = skus.find(sku => sku.sku_name?.toUpperCase() === productName.toUpperCase()) ||
      skus.find(sku => normalizeSkuName(sku.sku_name || '') === normalizedProductName) ||
      skus.find(sku => {
        const normalizedSkuName = normalizeSkuName(sku.sku_name || '')
        return normalizedSkuName.includes(normalizedProductName) || normalizedProductName.includes(normalizedSkuName)
      })

    const grossWeight = matchedSku?.gross_weight ? parseFloat(matchedSku.gross_weight) : 0
    const skuWeight = matchedSku?.sku_weight ? parseFloat(matchedSku.sku_weight) : 0

    return grossWeight > 0 ? grossWeight : skuWeight
  }

  const getSkuWeight = (productName: string): number => {
    if (!productName || skus.length === 0) return 0
    let matchedSku = skus.find(sku => sku.sku_name?.toUpperCase() === productName.toUpperCase())
    if (matchedSku) return matchedSku?.sku_weight ? parseFloat(matchedSku.sku_weight) : 0
    const normalizeSkuName = (name: string) => name.toUpperCase().replace(/KGS/g, 'KG').replace(/LTRS/g, 'LTR').replace(/\s+/g, ' ').trim()
    const normalizedProductName = normalizeSkuName(productName)
    matchedSku = skus.find(sku => normalizeSkuName(sku.sku_name || '') === normalizedProductName)
    if (matchedSku) return matchedSku?.sku_weight ? parseFloat(matchedSku.sku_weight) : 0
    matchedSku = skus.find(sku => {
      const normalizedSkuName = normalizeSkuName(sku.sku_name || '')
      return normalizedSkuName.includes(normalizedProductName) || normalizedProductName.includes(normalizedSkuName)
    })
    if (matchedSku) return matchedSku?.sku_weight ? parseFloat(matchedSku.sku_weight) : 0
    return 0
  }

  const calculateWeight = (productName: string, qty: string | number): number => {
    const skuWeight = getSkuWeight(productName)
    const quantity = typeof qty === 'string' ? parseFloat(qty) || 0 : qty
    return skuWeight * quantity
  }

  const calculateGrossWeight = (productName: string, qty: string | number): number => {
    const skuGrossWeight = getSkuGrossWeight(productName)
    const quantity = typeof qty === 'string' ? parseFloat(qty) || 0 : qty
    return skuGrossWeight * quantity
  }

  // --- End helpers ---

  // Pending query with numeric pagination
  const {
    data: pendingResult,
    isLoading: isPendingLoading,
    refetch: refetchPending,
  } = useQuery({
    queryKey: ["plan-vehicle-pending", filterValues, pendingPage, selectedDepoTab, user?.depo_access?.['Plan Vehicle']],
    queryFn: async () => {
      const allowedDepots = user?.depo_access?.['Plan Vehicle'] || []
      const response = await planVehicleApi.getPending({
        page: pendingPage,
        limit,
        search: filterValues.search,
        manual_sauda_no: filterValues.manualSaudaNo,
        do_date_from: filterValues.startDate,
        do_date_to: filterValues.endDate,
        party_name: filterValues.partyName === "all" ? undefined : filterValues.partyName,
        depo_names: selectedDepoTab ? [selectedDepoTab] : allowedDepots
      });
      return response.success ? response.data : { dispatches: [], pagination: { total: 0 } };
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const pendingOrders = useMemo(() => {
    return pendingResult?.dispatches || [];
  }, [pendingResult]);

  useEffect(() => {
    setPendingPage(1);
  }, [filterValues, selectedDepoTab]);

  useEffect(() => {
    if (activeTab === "pending") {
      refetchPending();
    }
  }, [activeTab, selectedDepoTab]);

  // No dedicated /plan-vehicle/filters endpoint exists yet — derive the party
  // filter's option list from the rows already loaded for the current page
  // instead (a reasonable stand-in until such an endpoint is added).
  const customerNameOptions = useMemo(() => {
    const names = new Set<string>();
    pendingOrders.forEach((o: any) => {
      const n = (o.transfer === 'yes' && o.bill_company_name) ? o.bill_company_name : (o.party_name || o.customerName);
      if (n) names.add(n);
    });
    return Array.from(names).sort();
  }, [pendingOrders]);

  const fetchSkus = async () => {
    try {
      const response = await skuApi.getAll({ limit: 1000 })
      if (response.success && response.data) {
        let skuArray = []
        if (Array.isArray(response.data)) {
          skuArray = response.data
        } else if (response.data.skuDetails && Array.isArray(response.data.skuDetails)) {
          skuArray = response.data.skuDetails
        } else if (typeof response.data === 'object') {
          skuArray = response.data.skus || response.data.items || []
        }
        setSkus(skuArray)
      }
    } catch (error: any) {
      console.error("[PLAN VEHICLE] Failed to fetch SKUs:", error)
    }
  }

  const fetchDepots = async () => {
    try {
      const response = await depotApi.getAll({ all: 'false' });
      if (response.success && response.data?.depots) {
        let depots = response.data.depots;

        const allowedDepos = user?.depo_access?.['Plan Vehicle'] || [];
        depots = depots.filter((d: any) =>
          allowedDepos.some((ad: string) => ad.toLowerCase() === d.depot_name.toLowerCase())
        );

        const sortedDepots = [...depots].sort((a, b) => {
          const aIsBanari = a.depot_name.toLowerCase() === 'banari'
          const bIsBanari = b.depot_name.toLowerCase() === 'banari'
          if (aIsBanari && !bIsBanari) return -1
          if (!aIsBanari && bIsBanari) return 1
          return a.depot_name.localeCompare(b.depot_name)
        })
        setActiveDepots(sortedDepots);
        if (sortedDepots.length > 0 && !sortedDepots.some((d: any) => d.depot_name === selectedDepoTab)) {
          const banari = sortedDepots.find((d: any) => d.depot_name.toLowerCase() === 'banari');
          setSelectedDepoTab(banari ? banari.depot_name : sortedDepots[0].depot_name);
        }
      }
    } catch (error) {
      console.error("[PLAN VEHICLE] Failed to fetch depots:", error);
    }
  };

  useEffect(() => {
    fetchSkus();
    fetchDepots();
  }, [user?.depo_access])

  const availableDepots = useMemo(() => {
    return activeDepots.map(d => d.depot_name);
  }, [activeDepots]);

  useEffect(() => {
    if (availableDepots.length > 0 && (!selectedDepoTab || !availableDepots.includes(selectedDepoTab))) {
      const banari = availableDepots.find((d: string) => d.toLowerCase() === 'banari');
      setSelectedDepoTab(banari ?? availableDepots[0]);
    }
  }, [availableDepots, selectedDepoTab]);

  const fetchMasterData = async () => {
    try {
      const [vRes, tRes] = await Promise.all([
        vehicleMasterApi.getAll({ all: 'true' }),
        transportMasterApi.getAll({ all: 'true' })
      ]);
      const vehicles = vRes.success ? (vRes.data.vehicles || []) : [];
      if (vRes.success) setVehicleMaster(vehicles);
      const dRes = await driverMasterApi.getAll({ all: 'true' });
      const drivers = dRes.success ? (dRes.data.drivers || []) : [];
      if (dRes.success) setDriverMaster(drivers);
      if (tRes.success) setTransporterMaster(tRes.data.transporters || []);
      return { vehicles, drivers };
    } catch (error) {
      console.error("Failed to fetch master data:", error);
      return { vehicles: [], drivers: [] };
    }
  };

  useEffect(() => {
    fetchMasterData();
  }, []);

  // Planned (SKU-derived) gross weight of every currently-selected product —
  // there is no actual weighbridge reading at this stage (that only exists
  // later, at Actual Dispatch), so the overload check below is always against
  // this planned figure, not a measured gross/tare weight.
  const totalPackingWeightFromSku = useMemo(() => {
    return selectedGroups.flatMap(g => g._allProducts)
      .filter((prod: any) => dialogSelectedProducts.includes(prod._rowKey))
      .reduce((total, prod) => total + calculateGrossWeight(prod.productName, prod.qtyToDispatch), 0)
  }, [selectedGroups, dialogSelectedProducts, skus])

  const filteredPendingOrders = pendingOrders.filter((order: any) => {
    let matches = true

    // Only rows planned but not yet actually dispatched belong on this stage's
    // pending list (a defensive client-side guard — the server already scopes
    // plan-vehicle/pending to rows before vehicle-plan confirmation).
    if (order.planned_1 === null || order.planned_1 === undefined || order.actual_1 !== null) {
      matches = false
    }

    const currentCustName = (order.transfer === 'yes' && order.bill_company_name) ? order.bill_company_name : (order.party_name || order.customerName)
    if (filterValues.partyName && filterValues.partyName !== "all" && currentCustName !== filterValues.partyName) {
      matches = false
    }

    if (filterValues.status) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const targetDateStr = order.deliveryDate || order.timestamp
      if (targetDateStr) {
        const targetDate = new Date(targetDateStr)
        if (filterValues.status === "expire") {
          if (targetDate < today) matches = true
          else matches = false
        } else if (filterValues.status === "on-time") {
          if (targetDate >= today) matches = true
          else matches = false
        }
      }
    }

    return matches
  })

  const displayRows = useMemo(() => {
    return groupOrdersByBaseDo(filteredPendingOrders, selectedDepoTab)
  }, [filteredPendingOrders, selectedDepoTab])

  // Accumulates every group ever rendered, keyed by _rowKey — kept only as a
  // fallback; fetchCompleteGroupsForKeys below is the primary source of truth.
  const selectedGroupsCacheRef = useRef<Record<string, any>>({})
  useEffect(() => {
    displayRows.forEach((row: any) => {
      selectedGroupsCacheRef.current[row._rowKey] = row
    })
  }, [displayRows])

  // Fetches a fresh, complete, authoritative set of every pending shipment for
  // each requested base-DO key directly from the server — a DO's pending
  // shipments can be split across pages of the general list, so neither the
  // current page nor the cache above can be trusted to be complete.
  const fetchCompleteGroupsForKeys = useCallback(async (keys: string[]): Promise<Record<string, any>> => {
    const allowedDepots = user?.depo_access?.['Plan Vehicle'] || []
    const byKey: Record<string, any> = {}
    await Promise.all(keys.map(async (key) => {
      try {
        const response = await planVehicleApi.getPending({
          page: 1,
          limit: 200,
          search: key,
          depo_names: allowedDepots,
        })
        if (!response.success) return
        const rows = (response.data?.dispatches || []).filter((order: any) => {
          const doNumber = order.so_no || order.soNo || ""
          const baseDoMatch = doNumber.match(/^(DO[-\/](?:\d{2}-\d{2}\/)?\d+)/i)
          const baseDo = baseDoMatch ? baseDoMatch[1].toUpperCase() : doNumber.toUpperCase()
          return baseDo === key
        })
        const groups = groupOrdersByBaseDo(rows, "")
        const match = groups.find((g: any) => g._rowKey === key)
        if (match) byKey[key] = match
      } catch {
        // Swallow — the caller falls back to the cache/passed-in group below.
      }
    }))
    return byKey
  }, [user?.depo_access])

  const toggleSelectAll = () => {
    const currentPageKeys = displayRows.map((row) => row._rowKey)
    const allCurrentSelected = currentPageKeys.length > 0 && currentPageKeys.every((k) => selectedOrders.includes(k))
    if (allCurrentSelected) {
      setSelectedOrders(selectedOrders.filter((k) => !currentPageKeys.includes(k)))
    } else {
      setSelectedOrders(Array.from(new Set([...selectedOrders, ...currentPageKeys])))
    }
  }

  const toggleSelectOrder = (rowKey: string) => {
    if (!rowKey) return
    if (selectedOrders.includes(rowKey)) {
      setSelectedOrders(selectedOrders.filter((id) => id !== rowKey))
    } else {
      setSelectedOrders([...selectedOrders, rowKey])
    }
  }

  const toggleSelectDialogProduct = (key: string) => {
    if (dialogSelectedProducts.includes(key)) {
      setDialogSelectedProducts(prev => prev.filter(k => k !== key))
    } else {
      setDialogSelectedProducts(prev => [...prev, key])
    }
  }

  // Fills vehicleData/driverData from a vehicle_master record. Always call this
  // with a fresh `selectedV` (from a just-refetched vehicleMaster) rather than
  // trusting stale state, since these fields are master-derived.
  const autofillVehicleData = (selectedV: any) => {
    const isLifetimeTax = !!(selectedV.life_time_tax || selectedV.life_time_tax_image);
    setVehicleData(p => ({
      ...p,
      registration_no: selectedV.registration_no || "",
      vehicle_type: selectedV.vehicle_type || "",
      rto: selectedV.rto || "",
      passing_weight: selectedV.passing || "",
      fitness_end_date: selectedV.fitness ? new Date(selectedV.fitness).toISOString().split('T')[0] : "",
      insurance_end_date: selectedV.insurance ? new Date(selectedV.insurance).toISOString().split('T')[0] : "",
      tax_end_date: (!isLifetimeTax && selectedV.road_tax) ? new Date(selectedV.road_tax).toISOString().split('T')[0] : "",
      is_lifetime_tax: isLifetimeTax,
      fuel_type: selectedV.fuel_type || "",
      pollution_end_date: selectedV.fuel_type === 'Electrical' ? "" : (selectedV.pollution ? new Date(selectedV.pollution).toISOString().split('T')[0] : ""),
      permit1_end_date: selectedV.state_permit ? new Date(selectedV.state_permit).toISOString().split('T')[0] : "",
      permit2_end_date: selectedV.national_permit ? new Date(selectedV.national_permit).toISOString().split('T')[0] : "",
      fitness: selectedV.fitness_image || p.fitness,
      insurance: selectedV.insurance_image || p.insurance,
      tax_copy: (isLifetimeTax ? selectedV.life_time_tax_image : selectedV.road_tax_image) || p.tax_copy,
      polution: selectedV.pollution_image || p.polution,
      permit1: selectedV.state_permit_image || p.permit1,
      permit2_out_state: selectedV.national_permit_image || p.permit2_out_state,
      gvw: selectedV.gvw || "",
      ulw: selectedV.ulw || "",
    }));
    setFreightData(p => ({
      ...p,
      transporterName: selectedV.transporter || p.transporterName
    }));
  };

  const resetDialogForms = (targetGroups: any[]) => {
    setVehicleNumber("")
    setVehicleData({
      checkStatus: "", remarks: "", fitness: "", insurance: "", tax_copy: "", polution: "",
      permit1: "", permit2_out_state: "", fitness_file_name: "", insurance_file_name: "",
      tax_file_name: "", pollution_file_name: "", permit1_file_name: "", permit2_file_name: "",
      fitness_end_date: "", insurance_end_date: "", tax_end_date: "", pollution_end_date: "",
      permit1_end_date: "", permit2_end_date: "", registration_no: "", vehicle_type: "", rto: "",
      passing_weight: "", road_tax: "", is_lifetime_tax: false, fuel_type: "", gvw: "", ulw: "",
    })
    setDriverName("")
    setDriverData({ contact_no: "", license_no: "", license_type: "", valid_upto: "", trans_valid_upto: "", lmv_valid_upto: "" })
    setFreightData({
      transporterName: "", vehicleNoPlateImage: "", vehicleNoPlateImage_file_name: "",
      overloadRemarks: "", freightRateType: "", freightAmount: "", cdAmount: "", finalRate: "",
      cash_bank: "", diesel_advance: "", bhada: "",
    })
  }

  const handleOpenDialog = async (group?: any) => {
    // Resolve selected DOs to a fresh, complete, authoritative set fetched
    // directly from the server — a DO's pending shipments can be split across
    // pages of the general list, so neither the current page nor the
    // cross-page cache can be trusted to be complete.
    const keys = group ? [group._rowKey] : [...selectedOrders]
    const fetchedByKey = await fetchCompleteGroupsForKeys(keys)
    const targetGroups = keys
      .map((key) => fetchedByKey[key] || selectedGroupsCacheRef.current[key] || (group && group._rowKey === key ? group : null))
      .filter(Boolean);

    if (targetGroups.length > 0) {
      // Refresh vehicle/driver/transporter master data so autofill reflects
      // documents uploaded since page load.
      await fetchMasterData();

      setSelectedGroups(targetGroups)
      const allKeys = targetGroups.flatMap(g => g._allProducts.map((p: any) => p._rowKey));
      setDialogSelectedProducts(allKeys)
      setIsDialogOpen(true)
      resetDialogForms(targetGroups)
    }
  }

  const buildSlipParties = () => {
    const productsForSlip = selectedGroups.flatMap((group: any) =>
      group._allProducts.filter((p: any) => dialogSelectedProducts.includes(p._rowKey))
    );
    const partyGroups: Record<string, any[]> = {};
    productsForSlip.forEach((p: any) => {
      const pName = p.customerName || p.party_name || p.partyName || "Unknown Party";
      if (!partyGroups[pName]) partyGroups[pName] = [];
      partyGroups[pName].push(p);
    });
    return Object.entries(partyGroups).map(([party, partyProducts]) => {
      const firstProd = partyProducts[0];
      const orderThrough = firstProd.orderThrough || firstProd.is_order_through || "Direct";
      const referenceLabel = orderThrough === "Broker" ? "Broker" : orderThrough === "Salesperson" ? "Salesperson" : "";
      const referenceValue = orderThrough === "Broker"
        ? (firstProd.brokerName || firstProd.broker_name || "—")
        : orderThrough === "Salesperson"
          ? (firstProd.salespersonName || firstProd.salesperson_name || "—")
          : "Direct";
      return {
        party,
        commitmentNo: firstProd.orderNo || "—",
        date: new Date().toLocaleDateString('en-GB'),
        referenceLabel,
        referenceValue,
        place: firstProd.address || firstProd.customer_delivery_address || firstProd.customer_address || "—",
        partyMo: firstProd.whatsapp || firstProd.customer_contact_person_whatsapp_no || firstProd.party_mo || firstProd.mobile || "—",
        status: firstProd.has_prior_dispatch ? "Pending" : "Original",
        processId: firstProd.processid || firstProd.process_id || firstProd.processId || "—",
        punchBy: firstProd.order_punch_user || "—",
        punchAt: firstProd.order_punch_at || null,
        preApproveBy: firstProd.pre_approval_user || "—",
        preApproveAt: firstProd.pre_approval_at || null,
        approveBy: firstProd.order_approval_user || "—",
        approveAt: firstProd.order_approval_at || null,
        products: partyProducts.map((prod: any) => {
          const qty = parseFloat(prod.qtyToDispatch || "0");
          return {
            productName: prod.productName || "—",
            uom: prod.uom || "PCS",
            qty,
            weight: calculateWeight(prod.productName, qty),
            grossWeight: calculateGrossWeight(prod.productName, qty),
          };
        }),
      };
    });
  };

  const handleDownloadSlip = () => {
    if (selectedGroups.length === 0 || dialogSelectedProducts.length === 0) {
      toast({ title: "Error", description: "Please select products to download slip", variant: "destructive" });
      return;
    }
    generateDispatchSlipPdf(buildSlipParties(), "gate-pass.pdf", { title: "Gate Pass" });
  };

  const handlePrintSlip = () => {
    if (selectedGroups.length === 0 || dialogSelectedProducts.length === 0) {
      toast({ title: "Error", description: "Please select products to print slip", variant: "destructive" });
      return;
    }
    generateDispatchSlipPdf(buildSlipParties(), "gate-pass.pdf", { print: true, title: "Gate Pass" });
  };

  const closeSlipDialog = () => {
    setIsSlipDialogOpen(false)
    setSelectedGroups([])
    setDialogSelectedProducts([])
    setSelectedOrders([])
  }

  const submitPlanVehicle = async () => {
    setIsProcessing(true)
    try {
      if (selectedGroups.length === 0 || dialogSelectedProducts.length === 0) {
        setIsDialogOpen(false);
        return;
      }

      const successfulItems: any[] = []
      const failedItems: any[] = []

      const itemsToProcess = selectedGroups.flatMap(g =>
        g._allProducts.filter((p: any) => dialogSelectedProducts.includes(p._rowKey))
      )

      const numOrUndef = (v: any): number | undefined => {
        if (v === "" || v === null || v === undefined) return undefined;
        const n = parseFloat(v);
        return isNaN(n) ? undefined : n;
      };

      // v2-native camelCase payload (backend: /api/v1/plan-vehicle/submit/:id).
      // Same vehicle-assignment payload submitted for every selected shipment —
      // no weightment/actualQtyDispatch fields belong on this stage.
      const payload = {
        registrationNo: vehicleNumber || vehicleData.registration_no || undefined,
        driverName: driverName || undefined,
        drivingLicenceNo: driverData.license_no || undefined,
        transporterName: freightData.transporterName || undefined,

        checkStatus: vehicleData.checkStatus || undefined,
        remarks: vehicleData.remarks || undefined,

        vehicleNoPlateImage: freightData.vehicleNoPlateImage || undefined,

        fitnessImage: vehicleData.fitness || undefined,
        fitnessEndDate: vehicleData.fitness_end_date || undefined,
        insuranceImage: vehicleData.insurance || undefined,
        insuranceEndDate: vehicleData.insurance_end_date || undefined,
        taxCopyImage: vehicleData.tax_copy || undefined,
        taxEndDate: vehicleData.tax_end_date || undefined,
        pollutionImage: vehicleData.polution || undefined,
        pollutionEndDate: vehicleData.pollution_end_date || undefined,
        permit1Image: vehicleData.permit1 || undefined,
        permit1EndDate: vehicleData.permit1_end_date || undefined,
        permit2OutStateImage: vehicleData.permit2_out_state || undefined,
        permit2EndDate: vehicleData.permit2_end_date || undefined,

        passingWeight: numOrUndef(vehicleData.passing_weight),
        vehicleOverloadRemarks: freightData.overloadRemarks || undefined,

        freightRateType: freightData.freightRateType || undefined,
        freightAmount: numOrUndef(freightData.freightAmount),
        cdAmount: numOrUndef(freightData.cdAmount),
        advanceBhadaBank: numOrUndef(freightData.cash_bank),
        advanceBhadaDieselAdvance: numOrUndef(freightData.diesel_advance),
        advanceBhadaCash: numOrUndef(freightData.bhada),
        finalRate: numOrUndef(freightData.finalRate),

        userId: user?.id || null,
      };

      for (const item of itemsToProcess) {
        const dispatchId = item.id;
        try {
          const res = await planVehicleApi.submit(dispatchId, payload);
          if (!res.success) throw new Error(res.message);
          successfulItems.push(item);
        } catch (error: any) {
          console.error('[PLAN VEHICLE SUBMISSION ERROR]', { dispatchId, error });
          failedItems.push({ item, error: error?.message || 'Unknown error', code: error?.code });
        }
      }

      if (successfulItems.length > 0) {
        toast({
          title: "Vehicle Plan Confirmed",
          description: `${successfulItems.length} item(s) assigned a vehicle/transporter. Generate the Gate Pass below.`,
        });

        setIsDialogOpen(false);
        // selectedGroups/dialogSelectedProducts intentionally NOT cleared yet —
        // the Gate Pass slip dialog (opened below) still needs them. They're
        // reset when that dialog is closed (see closeSlipDialog).
        setIsSlipDialogOpen(true);

        await refetchPending();
        queryClient.invalidateQueries({ queryKey: ["plan-vehicle-history"] });
      }

      const staleWrites = failedItems.filter((f: any) => isStaleWriteError(f));
      const otherFailures = failedItems.filter((f: any) => !isStaleWriteError(f));

      if (staleWrites.length > 0) {
        toast({
          title: "Already processed",
          description: `${staleWrites.length} item(s) were already planned or moved by another user. Refreshing the list…`,
          variant: "destructive",
        })
        await refetchPending();
        queryClient.invalidateQueries({ queryKey: ["plan-vehicle-history"] });
      }

      if (otherFailures.length > 0) {
        toast({
          title: "Partial Success",
          description: `${otherFailures.length} item(s) failed to save.`,
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false)
    }
  }

  const performPlanVehicleConfirmation = async () => {
    const isBanari = selectedDepoTab?.toUpperCase() === 'BANARI';
    const validationErrors: string[] = [];
    const docWarnings: string[] = [];

    if (isBanari) {
      const hasVehicle = !!vehicleNumber.trim();
      if (!hasVehicle && !freightData.transporterName.trim()) {
        validationErrors.push("Either a Vehicle No. or a Transporter Name is required");
      }

      // Everything below only applies once a specific vehicle has actually been
      // selected — if the user went the "Transporter only" route (vehicle not
      // yet known, to be filled in later at Gate In per spec), there's no
      // vehicle to check documents/overload/permits against yet.
      if (hasVehicle) {
        const vehicleDocs = [
          { key: 'fitness', label: 'Fitness' },
          { key: 'fitness_end_date', label: 'Fitness Expiry' },
          { key: 'insurance', label: 'Insurance' },
          { key: 'insurance_end_date', label: 'Insurance Expiry' },
          { key: 'tax_copy', label: 'Tax' },
          { key: 'tax_end_date', label: 'Tax Expiry' },
          { key: 'polution', label: 'Pollution' },
          { key: 'pollution_end_date', label: 'Pollution Expiry' },
          { key: 'permit1', label: 'Permit 1' },
          { key: 'permit1_end_date', label: 'Permit 1 Expiry' },
          { key: 'permit2_out_state', label: 'Permit 2' },
          { key: 'permit2_end_date', label: 'Permit 2 Expiry' },
        ];

        const isPermitApplicable = vehicleData.gvw !== '' && Number(vehicleData.gvw) > 3000;

        for (const doc of vehicleDocs) {
          const val = vehicleData[doc.key as keyof typeof vehicleData];
          if (doc.key === 'permit2_out_state' || doc.key === 'permit2_end_date') continue;
          if ((doc.key === 'permit1' || doc.key === 'permit1_end_date') && !isPermitApplicable) continue;
          if (doc.key === 'tax_end_date' && vehicleData.is_lifetime_tax) continue;
          if ((doc.key === 'polution' || doc.key === 'pollution_end_date') && vehicleData.fuel_type === 'Electrical') continue;

          if (!val) {
            const message = `${doc.label} is missing for this vehicle. Please upload/fill it before confirming the vehicle plan for BANARI.`;
            if (doc.key === 'tax_copy' || doc.key === 'tax_end_date' || doc.key === 'polution' || doc.key === 'pollution_end_date') {
              docWarnings.push(message);
            } else {
              validationErrors.push(message);
            }
          }
        }

        if (!vehicleData.checkStatus) {
          validationErrors.push("Vehicle Check Status is required");
        }
        if (vehicleData.checkStatus === "Reject" && !vehicleData.remarks.trim()) {
          validationErrors.push("Vehicle Remarks are required for rejection");
        }

        const dateFields = [
          { key: 'fitness_end_date', label: 'Fitness' },
          { key: 'insurance_end_date', label: 'Insurance' },
          { key: 'tax_end_date', label: 'Tax' },
          { key: 'pollution_end_date', label: 'Pollution' },
          { key: 'permit1_end_date', label: 'Permit 1' },
          { key: 'permit2_end_date', label: 'Permit 2' },
        ];

        for (const field of dateFields) {
          const dateVal = vehicleData[field.key as keyof typeof vehicleData];
          if (dateVal && dateVal < minDate) {
            const message = `${field.label} End Date must be at least 5 days from today (Min: ${formatDate(minDate)})`;
            if (field.key === 'tax_end_date' || field.key === 'pollution_end_date') {
              docWarnings.push(message);
            } else {
              validationErrors.push(message);
            }
          }
        }

        const passingWt = parseFloat(vehicleData.passing_weight) || 0;
        const isOverloaded = passingWt > 0 && totalPackingWeightFromSku > passingWt;
        if (isOverloaded && !freightData.overloadRemarks.trim()) {
          validationErrors.push("Overload remarks are mandatory as the vehicle is overloaded.");
        }

        if (isInterState && Number(vehicleData.gvw) > 3000 && (!vehicleData.permit2_end_date || !vehicleData.permit2_out_state || vehicleData.permit2_out_state === 'pending')) {
          validationErrors.push("National / Other State Permit is mandatory for interstate dispatches.");
        }
      }
    }

    if (validationErrors.length > 0) {
      toast({
        title: `${validationErrors.length} Validation ${validationErrors.length > 1 ? 'Issues' : 'Issue'} Found`,
        description: (
          <ul className="list-disc pl-4 space-y-0.5">
            {validationErrors.map((err, i) => <li key={i}>{err}</li>)}
          </ul>
        ),
        variant: "destructive"
      });
      return;
    }

    if (docWarnings.length > 0) {
      setDocWarningDialog({ open: true, messages: docWarnings });
      return;
    }

    await submitPlanVehicle();
  }

  const handleRevert = async () => {
    if (!revertRemarks.trim()) {
      toast({ title: "Validation Error", description: "Revert remarks are required", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    try {
      const itemsToRevert = selectedGroups.flatMap(g =>
        g._allProducts.filter((p: any) => dialogSelectedProducts.includes(p._rowKey))
      );

      if (itemsToRevert.length === 0) {
        toast({ title: "Error", description: "No products selected to revert", variant: "destructive" });
        setIsProcessing(false);
        return;
      }

      const successfulReverts: any[] = [];
      const failedReverts: any[] = [];

      for (const item of itemsToRevert) {
        const dispatchId = item.id;
        if (!dispatchId) continue;

        try {
          const res = await planVehicleApi.revert(dispatchId, user?.id || null, revertRemarks.trim());
          if (res.success) {
            successfulReverts.push(item);
          } else {
            failedReverts.push({ item, message: res.message });
          }
        } catch (err: any) {
          failedReverts.push({ item, message: err.message });
        }
      }

      if (successfulReverts.length > 0) {
        toast({
          title: "Revert Successful",
          description: `${successfulReverts.length} item(s) reverted — back to pending in Plan Vehicle.`,
        });

        setIsDialogOpen(false);
        setSelectedOrders([]);
        setDialogSelectedProducts([]);
        setSelectedGroups([]);
        setRevertRemarks("");

        await refetchPending();
        queryClient.invalidateQueries({ queryKey: ["plan-vehicle-history"] });
      }

      if (failedReverts.length > 0) {
        const messages = Array.from(new Set(failedReverts.map((f) => f.message).filter(Boolean)));
        toast({
          title: successfulReverts.length > 0 ? "Partial Revert Failure" : "Revert Failed",
          description: messages[0] || `Failed to revert ${failedReverts.length} item(s).`,
          variant: "destructive",
        });
        if (successfulReverts.length === 0) {
          await refetchPending()
          queryClient.invalidateQueries({ queryKey: ["plan-vehicle-history"] });
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "An unexpected error occurred during revert",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const passingWt = parseFloat(vehicleData.passing_weight) || 0;
  const isOverloaded = passingWt > 0 && totalPackingWeightFromSku > passingWt;

  return (
    <WorkflowStageShell
      title="Stage 5: Plan Vehicle"
      description="Consolidate DOs, assign a vehicle/transporter, and generate the gate pass."
      pendingCount={displayRows.length}
      historyData={[]}
      partyNames={customerNameOptions}
      onFilterChange={setFilterValues}
      remarksColName="Confirmation"
      showStatusFilter={true}
      onTabChange={setActiveTab}
      showDateFilters={true}
      showSaudaFilter={true}
      dateLabel="DO Date"
      searchPlaceholder="Search DO Number..."
      historyContent={
        <StageHistoryTab
          queryKeyPrefix="plan-vehicle-history"
          getHistoryApi={(params: any) => planVehicleApi.getHistory({
            page: params.page,
            limit: params.limit,
            search: params.order_no,
            manual_sauda_no: filterValues.manualSaudaNo || undefined,
            do_date_from: params.start_date,
            do_date_to: params.end_date,
            party_name: params.customer_name,
            depo_names: selectedDepoTab ? [selectedDepoTab] : (user?.depo_access?.['Plan Vehicle'] || undefined),
          })}
          filterValues={filterValues}
          activeTab={activeTab}
          stageName="Plan Vehicle"
          stageLevel={4}
          remarksColName="Vehicle Confirmation"
          orderListKey="dispatches"
          mapOrderNo={(order: any) => order.so_no || "-"}
          mapCustomerName={(order: any) => (order.transfer === 'yes' && order.bill_company_name) ? order.bill_company_name : order.party_name}
          getDate={(order: any) => order.actual_1 || order.timestamp || null}
        />
      }
    >
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-end gap-2">
          <Button
            onClick={() => handleOpenDialog()}
            disabled={selectedOrders.length === 0}
            className="h-9 text-xs font-black uppercase tracking-tight"
            title={isReadOnly ? "View Vehicle Plan" : "Plan Vehicle"}
          >
            Plan Vehicle ({selectedOrders.length})
          </Button>
        </div>

        {availableDepots.length > 0 && (
          <div className="mt-4 mb-2">
            <Tabs value={selectedDepoTab} onValueChange={setSelectedDepoTab} className="w-full overflow-hidden">
              <TabsList className="w-full bg-slate-100/50 p-1 h-auto flex overflow-x-auto justify-start gap-1 border border-slate-200/60 rounded-xl shadow-sm">
                {availableDepots.map((depoName: string) => (
                  <TabsTrigger
                    key={depoName}
                    value={depoName}
                    className="shrink-0 px-4 sm:px-6 py-2.5 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm rounded-lg transition-all"
                  >
                    {depoName}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        )}

        <Card className="border-none shadow-sm overflow-auto max-h-150">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
              <TableRow>
                <TableHead className="w-12 text-center">
                  <Checkbox
                    checked={displayRows.length > 0 && displayRows.every((row) => selectedOrders.includes(row._rowKey))}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="whitespace-nowrap text-center">DO Date</TableHead>
                <TableHead className="whitespace-nowrap text-center">DO Number</TableHead>
                <TableHead className="whitespace-nowrap text-center">Manual Sauda No.</TableHead>
                <TableHead className="whitespace-nowrap text-center">Customer Name</TableHead>
                <TableHead className="whitespace-nowrap text-center">Depot</TableHead>
                <TableHead className="whitespace-nowrap text-center">Qty to Dispatch</TableHead>
                <TableHead className="whitespace-nowrap text-center">Delivery From</TableHead>
                <TableHead className="whitespace-nowrap text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPendingLoading && pendingOrders.length === 0 ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i} className="opacity-40 border-b border-slate-50">
                    <TableCell className="text-center py-4"><div className="h-4 w-4 bg-slate-200 animate-pulse rounded mx-auto" /></TableCell>
                    {[...Array(8)].map((__, j) => (
                      <TableCell key={j} className="py-4"><div className="h-3 w-16 bg-slate-200 animate-pulse rounded-full mx-auto" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : displayRows.length > 0 ? (
                displayRows.map((row) => {
                  const rowKey = row._rowKey;
                  const firstProd = row._allProducts?.[0] || {};
                  return (
                    <TableRow key={rowKey} className={selectedOrders.includes(rowKey) ? "bg-blue-50/50" : ""}>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={selectedOrders.includes(rowKey)}
                          onCheckedChange={() => toggleSelectOrder(rowKey)}
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-center text-xs text-slate-600">{row.partySoDate || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-center text-xs text-blue-700 font-bold">{row.orderNo || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-center text-xs text-slate-600">{row.processId || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-center text-xs text-slate-600">{row.customerName || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-center text-xs text-slate-600">{row.depoName || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-center text-xs text-slate-600">
                        {row.qtyToDispatch}
                        {row._productCount > 1 && <span className="ml-1 text-[10px] text-slate-400">({row._productCount} items)</span>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-center text-xs text-slate-600">{firstProd.deliveryFrom || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-center text-xs">
                        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200">Ready to Plan</Badge>
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No orders pending vehicle planning
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between px-6 py-4 border-t bg-slate-50/50 rounded-b-2xl">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Showing Page <span className="text-slate-900 mx-1">{displayRows.length > 0 ? pendingPage : 0}</span>
              {displayRows.length > 0 && (
                <> of <span className="text-slate-900 mx-1">{pendingResult?.pagination?.totalPages || 1}</span></>
              )}
              <span className="ml-2 text-slate-300">|</span>
              <span className="ml-2 text-[10px] lowercase italic font-normal text-slate-400">{displayRows.length} item{displayRows.length !== 1 ? 's' : ''} in this depot</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPendingPage(p => Math.max(1, p - 1))}
                disabled={pendingPage === 1 || displayRows.length === 0}
                className="h-8 rounded-lg font-bold shadow-sm bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPendingPage(p => p + 1)}
                disabled={displayRows.length === 0 || pendingPage >= (pendingResult?.pagination?.totalPages || 1)}
                className="h-8 rounded-lg font-bold shadow-sm bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:w-[95vw] sm:!max-w-[95vw] max-h-[95dvh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] p-0">
          <div className="p-4 sm:p-6 lg:p-8">
            <DialogHeader className="border-b pb-4 sm:pb-6 mb-4 sm:mb-6 pr-8">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <DialogTitle className="text-lg sm:text-xl lg:text-2xl font-black text-slate-900 tracking-tight flex flex-wrap items-start gap-3 leading-tight">
                  <Truck className="h-6 w-6 sm:h-7 sm:w-7 text-blue-600 shrink-0" />
                  Plan Vehicle - {selectedGroups.length > 1 ? `${selectedGroups.length} Customer Groups` : selectedGroups[0]?.customerName}
                </DialogTitle>
              </div>
              <DialogDescription className="text-slate-500 font-medium text-sm sm:text-base mt-2">
                Consolidate the selected DOs, assign a vehicle/transporter, and confirm to generate the Gate Pass.
              </DialogDescription>
            </DialogHeader>

            {selectedGroups.length > 0 && (
              <div className="space-y-8 mt-6">
                {/* 1. Consolidated DO summary */}
                <div className="space-y-3">
                  {selectedGroups.map((group) => (
                    <div key={group._rowKey} className="flex flex-wrap items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                      <Badge className="bg-blue-600 text-white px-3 py-1 font-black">{group.customerName}</Badge>
                      {Array.from(group._allBaseDos as Set<string>).map((baseDo: string) => (
                        <Badge key={baseDo} variant="outline" className="text-blue-700 border-blue-200 font-bold">{baseDo}</Badge>
                      ))}
                      <span className="text-[11px] text-slate-500 font-bold uppercase tracking-tighter">{group._productCount} product(s) · Depot: {group.depoName}</span>
                    </div>
                  ))}
                </div>

                {/* 2. Consolidated Product List */}
                <div className="space-y-4">
                  <h3 className="text-base sm:text-lg font-black text-slate-800 flex flex-wrap items-center gap-2 uppercase tracking-tight border-b-2 border-slate-100 pb-3">
                    Consolidated Product List
                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">{dialogSelectedProducts.length} / {selectedGroups.reduce((s, g) => s + g._allProducts.length, 0)} Items</Badge>
                  </h3>
                  <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-sm bg-white">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="w-12 text-center">
                            <Checkbox
                              checked={dialogSelectedProducts.length > 0 && dialogSelectedProducts.length === selectedGroups.reduce((s, g) => s + g._allProducts.length, 0)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setDialogSelectedProducts(selectedGroups.flatMap(g => g._allProducts.map((p: any) => p._rowKey)))
                                } else {
                                  setDialogSelectedProducts([])
                                }
                              }}
                            />
                          </TableHead>
                          <TableHead className="text-[10px] uppercase font-black text-slate-500">Customer / DO</TableHead>
                          <TableHead className="text-[10px] uppercase font-black text-slate-500">Product Name</TableHead>
                          <TableHead className="text-[10px] uppercase font-black text-slate-500 text-center">Planned Qty</TableHead>
                          <TableHead className="text-[10px] uppercase font-black text-slate-500">Delivery From</TableHead>
                          <TableHead className="text-[10px] uppercase font-black text-slate-500 text-center">Planned Gross Wt (KG)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedGroups.flatMap(group => group._allProducts).map((prod: any) => {
                          const rowKey = prod._rowKey;
                          return (
                            <TableRow key={rowKey} className={cn(dialogSelectedProducts.includes(rowKey) ? "bg-blue-50/30" : "")}>
                              <TableCell className="text-center">
                                <Checkbox
                                  checked={dialogSelectedProducts.includes(rowKey)}
                                  onCheckedChange={() => toggleSelectDialogProduct(rowKey)}
                                />
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="text-[9px] font-black text-blue-600 uppercase leading-none mb-1">{prod.customerName}</span>
                                  <span className="text-[10px] font-bold text-slate-700">{prod.orderNo || "—"}</span>
                                </div>
                              </TableCell>
                              <TableCell className="font-bold text-[11px] text-slate-900">{prod.productName || "—"}</TableCell>
                              <TableCell className="text-[11px] font-black text-center text-blue-700">
                                {prod.qtyToDispatch} <span className="ml-1 text-[9px] text-slate-400 font-bold uppercase">{prod.uom}</span>
                              </TableCell>
                              <TableCell className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">{prod.deliveryFrom}</TableCell>
                              <TableCell className="text-center">
                                <span className="font-black text-sm text-purple-700">{calculateGrossWeight(prod.productName, prod.qtyToDispatch).toFixed(4)} kg</span>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                        <TableRow className="bg-purple-50 border-t-2 border-purple-200">
                          <TableCell colSpan={3} className="text-right font-black text-xs uppercase text-purple-900 tracking-wider">Totals:</TableCell>
                          <TableCell className="text-center font-black text-sm text-purple-700">
                            {selectedGroups.flatMap(g => g._allProducts).filter((p: any) => dialogSelectedProducts.includes(p._rowKey)).reduce((sum, p) => sum + parseFloat(p.qtyToDispatch || "0"), 0)}
                          </TableCell>
                          <TableCell />
                          <TableCell className="text-center font-black text-sm text-purple-700">{totalPackingWeightFromSku.toFixed(4)} kg</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* 3. Vehicle & Transport Assignment — unified section (no more artificial
                    two-column vehicle/weightment split; it's all "Plan Vehicle" now). */}
                <div className="space-y-6 pt-6 border-t-4 border-slate-100">
                  <div className="bg-purple-600 px-4 sm:px-6 py-4 rounded-xl sm:rounded-3xl flex flex-wrap items-center justify-between gap-3 shadow-lg">
                    <div className="flex items-center gap-3">
                      <Truck className="h-6 w-6 text-white" />
                      <h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-tighter italic">Vehicle &amp; Transport Assignment</h3>
                    </div>
                    <Badge className="bg-white text-purple-700 font-black">STAGE 5</Badge>
                  </div>

                  <div className="bg-slate-50 border-2 border-slate-200 rounded-xl sm:rounded-3xl p-4 sm:p-6 space-y-6 shadow-md">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">
                          Vehicle Registration Number {selectedDepoTab?.toUpperCase() === 'BANARI' ? <span className="text-red-500">*</span> : <span className="text-slate-400 font-normal normal-case">(Optional)</span>}
                        </Label>
                        <Combobox
                          value={vehicleNumber}
                          onValueChange={(v) => {
                            setVehicleNumber(v);
                            const selectedV = vehicleMaster.find(veh => veh.registration_no === v);
                            if (selectedV) {
                              autofillVehicleData(selectedV);
                            } else if (!v) {
                              setVehicleData(p => ({
                                ...p, registration_no: "", vehicle_type: "", rto: "", passing_weight: "",
                                fitness_end_date: "", insurance_end_date: "", tax_end_date: "", is_lifetime_tax: false,
                                fuel_type: "", pollution_end_date: "", permit1_end_date: "", permit2_end_date: "",
                                fitness: "", insurance: "", tax_copy: "", polution: "", permit1: "", permit2_out_state: "",
                                gvw: "", ulw: ""
                              }));
                            }
                          }}
                          options={vehicleOptions}
                          placeholder="Select Vehicle"
                          searchPlaceholder="Search vehicle..."
                          emptyText="No vehicle found."
                          className="h-12 border-2 border-slate-200 rounded-xl px-3 sm:px-4 font-black text-sm sm:text-lg focus:border-purple-500 transition-colors uppercase bg-white shadow-sm"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">
                          Driver Name {selectedDepoTab?.toUpperCase() === 'BANARI' ? <span className="text-red-500">*</span> : <span className="text-slate-400 font-normal normal-case">(Optional)</span>}
                        </Label>
                        <Combobox
                          value={driverName}
                          onValueChange={(v) => {
                            setDriverName(v);
                            const selectedD = driverMaster.find(d => d.driver_name === v);
                            if (selectedD) {
                              setDriverData({
                                contact_no: selectedD.mobile_no || "",
                                license_no: selectedD.driving_licence_no || "",
                                license_type: selectedD.driving_licence_type || "",
                                valid_upto: selectedD.valid_upto ? new Date(selectedD.valid_upto).toISOString().split('T')[0] : "",
                                trans_valid_upto: selectedD.trans_valid_upto ? new Date(selectedD.trans_valid_upto).toISOString().split('T')[0] : "",
                                lmv_valid_upto: selectedD.lmv_valid_upto ? new Date(selectedD.lmv_valid_upto).toISOString().split('T')[0] : ""
                              });
                            } else if (!v) {
                              setDriverData({ contact_no: "", license_no: "", license_type: "", valid_upto: "", trans_valid_upto: "", lmv_valid_upto: "" });
                            }
                          }}
                          options={driverOptions}
                          placeholder="Select Driver"
                          searchPlaceholder="Search driver..."
                          emptyText="No driver found."
                          className="h-12 border-2 border-slate-200 rounded-xl px-3 sm:px-4 font-black text-sm sm:text-lg focus:border-purple-500 transition-colors uppercase bg-white shadow-sm"
                        />
                      </div>

                      <div className="grid grid-cols-2 min-[380px]:grid-cols-4 gap-2 lg:col-span-2">
                        <div className="bg-white border-2 border-slate-100 rounded-xl px-3 py-1.5 shadow-sm">
                          <p className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1">Type</p>
                          <p className="text-[11px] font-black text-slate-700 uppercase leading-none">{vehicleData.vehicle_type || '---'}</p>
                        </div>
                        <div className="bg-white border-2 border-slate-100 rounded-xl px-3 py-1.5 shadow-sm">
                          <p className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1">RTO</p>
                          <p className="text-[11px] font-black text-slate-700 uppercase leading-none">{vehicleData.rto || '---'}</p>
                        </div>
                        <div className="bg-white border-2 border-slate-100 rounded-xl px-3 py-1.5 shadow-sm">
                          <p className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1">Pass Wt</p>
                          <p className={cn("text-[11px] font-black uppercase leading-none", isOverloaded ? "text-red-600" : "text-purple-600")}>
                            {vehicleData.passing_weight || '0.00'} KG
                          </p>
                        </div>
                        <div className="bg-white border-2 border-slate-100 rounded-xl px-3 py-1.5 shadow-sm">
                          <p className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1">GVW</p>
                          <p className="text-[11px] font-black text-slate-700 uppercase leading-none">{vehicleData.gvw || '---'} KG</p>
                        </div>
                        <div className="bg-white border-2 border-slate-100 rounded-xl px-3 py-1.5 shadow-sm">
                          <p className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1">Contact</p>
                          <p className="text-[11px] font-black text-slate-700 uppercase leading-none">{driverData.contact_no || '---'}</p>
                        </div>
                        <div className="bg-white border-2 border-slate-100 rounded-xl px-3 py-1.5 shadow-sm">
                          <p className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1">License No</p>
                          <p className="text-[11px] font-black text-slate-700 uppercase leading-none">{driverData.license_no || '---'}</p>
                        </div>
                        <div className="bg-white border-2 border-slate-100 rounded-xl px-3 py-1.5 shadow-sm">
                          <p className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1">Valid Upto</p>
                          <p className="text-[11px] font-black text-slate-700 uppercase leading-none">{formatDate(driverData.valid_upto) || '---'}</p>
                        </div>
                        <div className="bg-white border-2 border-slate-100 rounded-xl px-3 py-1.5 shadow-sm">
                          <p className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1">
                            {['Truck', 'Tanker', 'Pickup', 'Hiva', 'Trailer'].includes(vehicleData.vehicle_type) ? 'Trans Valid Upto' : 'LMV Valid Upto'}
                          </p>
                          <p className="text-[11px] font-black text-slate-700 uppercase leading-none">
                            {formatDate(['Truck', 'Tanker', 'Pickup', 'Hiva', 'Trailer'].includes(vehicleData.vehicle_type) ? driverData.trans_valid_upto : driverData.lmv_valid_upto) || '---'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-200">
                      <p className="text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest leading-none">Digital Documents</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {([
                          { key: 'fitness', fileKey: 'fitness_file_name', dateKey: 'fitness_end_date', label: 'Fitness', applicable: true },
                          { key: 'insurance', fileKey: 'insurance_file_name', dateKey: 'insurance_end_date', label: 'Insurance', applicable: true },
                          { key: 'tax_copy', fileKey: 'tax_file_name', dateKey: 'tax_end_date', label: 'Tax Copy', applicable: true },
                          { key: 'polution', fileKey: 'pollution_file_name', dateKey: 'pollution_end_date', label: 'Pollution', applicable: vehicleData.fuel_type !== 'Electrical' },
                          { key: 'permit1', fileKey: 'permit1_file_name', dateKey: 'permit1_end_date', label: 'State Permit', applicable: Number(vehicleData.gvw) > 3000 },
                          { key: 'permit2_out_state', fileKey: 'permit2_file_name', dateKey: 'permit2_end_date', label: 'National / Other State Permit', applicable: isInterState && Number(vehicleData.gvw) > 3000 },
                        ] as const).map(doc => (
                          <div key={doc.key} className={cn(
                            "bg-white border border-dashed border-slate-300 rounded-xl p-2.5 flex flex-col gap-2 min-w-0",
                            !doc.applicable && "opacity-40 grayscale bg-slate-50 border-slate-200"
                          )}>
                            <span className="text-[10px] font-black text-slate-500 uppercase break-words">
                              {doc.label} {doc.applicable
                                ? (selectedDepoTab?.toUpperCase() === 'BANARI' && doc.key !== 'permit2_out_state' ? <span className="text-red-500">*</span> : <span className="text-slate-400 normal-case font-medium">(Optional)</span>)
                                : <span className="text-slate-400 normal-case font-medium">(N/A)</span>}
                            </span>
                            <FileUploadField
                              accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
                              value={vehicleData[doc.key] && vehicleData[doc.key] !== 'pending' ? vehicleData[doc.key] : null}
                              fileName={vehicleData[doc.fileKey]}
                              helperText="Max file size: 20 MB"
                              uploading={isUploading === doc.key}
                              buttonText={vehicleData[doc.fileKey] ? 'REPLACE' : 'UPLOAD'}
                              disabled={!doc.applicable}
                              onFilesSelected={(files) => handleFileChange(doc.key, doc.fileKey, files[0] || null)}
                            />
                            {doc.key === 'tax_copy' && vehicleData.is_lifetime_tax ? (
                              <div className="h-7 text-[10px] border border-slate-200 rounded-lg px-2 font-bold bg-slate-100 opacity-80 flex items-center text-slate-500" title="Lifetime Tax">LTT</div>
                            ) : (
                              <Input
                                type="date"
                                className="h-7 text-[10px] border-slate-200 rounded-lg px-2 font-bold bg-white"
                                min={minDate}
                                disabled={!doc.applicable}
                                value={vehicleData[doc.dateKey]}
                                onChange={(e) => setVehicleData(p => ({ ...p, [doc.dateKey]: e.target.value }))}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Check Status <span className="text-red-500">*</span></Label>
                        <Select value={vehicleData.checkStatus} onValueChange={(v) => setVehicleData(p => ({ ...p, checkStatus: v }))}>
                          <SelectTrigger className="h-12 border-2 border-slate-200 rounded-xl font-bold bg-white">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Accept">Accept</SelectItem>
                            <SelectItem value="Reject">Reject</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">
                          Remarks {vehicleData.checkStatus === "Reject" ? <span className="text-red-500">*</span> : <span className="text-slate-400 font-normal normal-case">(Optional)</span>}
                        </Label>
                        <Input
                          placeholder="Add notes..."
                          className="h-12 border-2 border-slate-200 rounded-xl bg-white font-medium"
                          value={vehicleData.remarks}
                          onChange={(e) => setVehicleData(p => ({ ...p, remarks: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Transporter <span className="text-red-500">*</span></Label>
                        <Combobox
                          value={freightData.transporterName}
                          onValueChange={(v) => {
                            const isNormal = !['Company Vehicle', 'Party Vehicle'].includes(v);
                            setFreightData(p => ({
                              ...p,
                              transporterName: v,
                              freightRateType: isNormal ? p.freightRateType : "",
                              freightAmount: isNormal ? p.freightAmount : "",
                              cash_bank: isNormal ? p.cash_bank : "",
                              diesel_advance: isNormal ? p.diesel_advance : "",
                              bhada: isNormal ? p.bhada : ""
                            }));
                          }}
                          options={transporterOptions}
                          placeholder="Select Transporter"
                          searchPlaceholder="Search transporter..."
                          emptyText="No transporter found."
                          className="h-10 border-2 border-slate-200 rounded-xl font-bold bg-white w-full shadow-sm text-blue-700"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">No Plate Image <span className="text-slate-400 font-normal normal-case">(Optional)</span></Label>
                        <FileUploadField
                          accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
                          value={freightData.vehicleNoPlateImage && freightData.vehicleNoPlateImage !== 'pending' ? freightData.vehicleNoPlateImage : null}
                          fileName={freightData.vehicleNoPlateImage_file_name}
                          helperText="Max file size: 20 MB"
                          uploading={isUploading === 'vehicleNoPlateImage'}
                          buttonText={freightData.vehicleNoPlateImage_file_name ? 'REPLACE' : 'UPLOAD'}
                          onFilesSelected={(files) => handleFileChange('vehicleNoPlateImage', 'vehicleNoPlateImage_file_name', files[0] || null, 'freight')}
                        />
                      </div>
                    </div>

                    {freightData.transporterName && !['Company Vehicle', 'Party Vehicle'].includes(freightData.transporterName) && (
                      <div className="space-y-6 pt-4 border-t border-slate-200 animate-in fade-in zoom-in-95 duration-300">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Freight Rate Type <span className="text-red-500">*</span></Label>
                            <Select value={freightData.freightRateType} onValueChange={(v) => setFreightData(p => ({ ...p, freightRateType: v }))}>
                              <SelectTrigger className="h-10 border-2 border-slate-200 rounded-xl font-bold bg-white">
                                <SelectValue placeholder="Select Type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Fixed Bhada">Fixed Bhada</SelectItem>
                                <SelectItem value="Bhada Rate">Bhada Rate</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {freightData.freightRateType && (
                            <div className="space-y-1.5">
                              <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">
                                {freightData.freightRateType === 'Bhada Rate' ? 'Bhada Rate (Per MT)' : 'Fixed Bhada Amount'} <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                type="number" step="0.01"
                                className="h-10 border-2 border-slate-200 rounded-lg font-bold bg-white"
                                placeholder="0.00"
                                value={freightData.freightAmount}
                                onChange={(e) => setFreightData(p => ({ ...p, freightAmount: e.target.value }))}
                              />
                            </div>
                          )}
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">CD Amount <span className="text-slate-400 font-normal normal-case">(Optional)</span></Label>
                            <Input
                              type="number" step="0.01"
                              className="h-10 border-2 border-slate-200 rounded-lg font-bold bg-white"
                              placeholder="0.00"
                              value={freightData.cdAmount}
                              onChange={(e) => setFreightData(p => ({ ...p, cdAmount: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Final Rate <span className="text-slate-400 font-normal normal-case">(Optional)</span></Label>
                            <Input
                              type="number" step="0.01"
                              className="h-10 border-2 border-slate-200 rounded-lg font-bold bg-white"
                              placeholder="0.00"
                              value={freightData.finalRate}
                              onChange={(e) => setFreightData(p => ({ ...p, finalRate: e.target.value }))}
                            />
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 font-black px-3">Advance Bhada</Badge>
                            <div className="h-px flex-1 bg-slate-100" />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                              <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Bank</Label>
                              <Input type="number" step="0.01" className="h-10 border-2 border-slate-200 rounded-lg font-bold bg-white" placeholder="0.00"
                                value={freightData.cash_bank} onChange={(e) => setFreightData(p => ({ ...p, cash_bank: e.target.value }))} />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Diesel Advance</Label>
                              <Input type="number" step="0.01" className="h-10 border-2 border-slate-200 rounded-lg font-bold bg-white" placeholder="0.00"
                                value={freightData.diesel_advance} onChange={(e) => setFreightData(p => ({ ...p, diesel_advance: e.target.value }))} />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Cash Advance</Label>
                              <Input type="number" step="0.01" className="h-10 border-2 border-slate-200 rounded-lg font-bold bg-white" placeholder="0.00"
                                value={freightData.bhada} onChange={(e) => setFreightData(p => ({ ...p, bhada: e.target.value }))} />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Overload Alert & Remarks — planned SKU gross weight vs vehicle passing weight */}
                    {isOverloaded && (
                      <div className="p-4 bg-red-50 border-2 border-red-100 rounded-2xl space-y-3">
                        <div className="flex items-center gap-2">
                          <Weight className="h-4 w-4 text-red-500" />
                          <p className="text-sm font-black text-red-600 uppercase tracking-tighter">
                            Vehicle is overload! ({totalPackingWeightFromSku.toFixed(2)} KG planned vs {passingWt.toFixed(2)} KG capacity)
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-red-500 tracking-widest ml-1">
                            Overload Remarks {selectedDepoTab?.toUpperCase() === 'BANARI' && <span className="text-red-500">*</span>}
                          </Label>
                          <Input
                            placeholder={selectedDepoTab?.toUpperCase() === 'BANARI' ? "Why is the vehicle being overloaded? (MANDATORY)" : "Why is the vehicle being overloaded? (Optional)"}
                            className="h-10 border-2 border-red-200 rounded-xl bg-white font-bold text-red-700 placeholder:text-red-300"
                            value={freightData.overloadRemarks}
                            onChange={(e) => setFreightData(p => ({ ...p, overloadRemarks: e.target.value }))}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-4 border-t pt-4 px-4 md:px-8 pb-8 flex flex-col gap-6 w-full">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 w-full">
              <div className="flex-1 space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-red-500 tracking-tighter ml-1">Revert Remarks <span className="text-red-500">*</span></Label>
                <Input
                  className="h-10 border-2 border-red-200 rounded-lg font-medium bg-white"
                  disabled={isReadOnly}
                  placeholder="Enter reason for reverting..."
                  value={revertRemarks}
                  onChange={(e) => setRevertRemarks(e.target.value)}
                />
              </div>
              <Button
                variant="destructive"
                onClick={handleRevert}
                disabled={isProcessing || dialogSelectedProducts.length === 0 || isReadOnly || !revertRemarks.trim()}
                className="font-black uppercase tracking-tight h-10 px-6"
              >
                {isProcessing ? "Wait..." : `Revert Vehicle Plan (${dialogSelectedProducts.length})`}
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:flex sm:justify-end gap-3 w-full">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="order-last sm:order-none">Cancel</Button>
              <Button
                onClick={performPlanVehicleConfirmation}
                disabled={isProcessing || dialogSelectedProducts.length === 0 || isReadOnly}
                className="h-11 sm:h-10 font-black bg-blue-600 hover:bg-blue-700"
              >
                {isProcessing ? "Wait..." : `Confirm (${dialogSelectedProducts.length})`}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tax Copy / Pollution Warning Dialog — these docs are optional, so we warn but don't block */}
      <AlertDialog open={docWarningDialog.open} onOpenChange={(open) => setDocWarningDialog(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Missing or Expired Documents</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="mb-2">The following documents are missing or expired. You can still continue with the vehicle plan.</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {docWarningDialog.messages.map((msg, i) => <li key={i}>{msg}</li>)}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDocWarningDialog({ open: false, messages: [] });
                submitPlanVehicle();
              }}
            >
              Continue Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Gate Pass Dialog */}
      <Dialog open={isSlipDialogOpen} onOpenChange={(open) => { if (!open) closeSlipDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gate Pass Ready</DialogTitle>
            <DialogDescription>The vehicle plan was confirmed. Print or download the Gate Pass below.</DialogDescription>
          </DialogHeader>

          <div className="bg-slate-50 p-4 rounded-lg space-y-2">
            {buildSlipParties().map((p) => (
              <div key={p.party} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-2">
                <div>
                  <p className="text-sm font-black text-slate-800">{p.party}</p>
                  <p className="text-[11px] text-slate-500">{p.commitmentNo}</p>
                </div>
                <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">{p.products.length} item(s)</Badge>
              </div>
            ))}
          </div>

          <DialogFooter className="flex flex-col sm:flex-row justify-end gap-3 mt-4">
            <Button variant="outline" onClick={closeSlipDialog} className="sm:order-first">Close</Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handlePrintSlip} className="border-blue-600 text-blue-600 hover:bg-blue-50">
                <Printer className="mr-2 h-4 w-4" /> Print Gate Pass
              </Button>
              <Button onClick={handleDownloadSlip} className="bg-blue-600 hover:bg-blue-700">
                <Download className="mr-2 h-4 w-4" /> Download Gate Pass
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkflowStageShell>
  );
}
