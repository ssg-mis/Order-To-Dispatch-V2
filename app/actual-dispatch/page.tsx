"use client"

import React, { useEffect, useState, useMemo, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { WorkflowStageShell } from "@/components/workflow/workflow-stage-shell"
import { CardContent } from "@/components/ui/card"
import { usePersistedFilters } from "@/hooks/use-persisted-filters"
import { useStageTable, type StageColDef } from "@/hooks/use-stage-table"
import { StageListHeader, StageToolbar, StageSegmented, StageFilterSelect, StageColumnsMenu, StageDivider, StageActiveChips, StageHeadCell, StageTotalsRow, StageActionBar, StagePagination } from "@/components/stage-list"
import { cn } from "@/lib/utils"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { ColumnToggleContent } from "@/components/ui/column-toggle-content"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { FileUploadField } from "@/components/file-upload-field"
import { Separator } from "@/components/ui/separator"
import { Settings2, ChevronDown, ChevronUp, Truck, Weight, CheckCircle2, XCircle, FileText, ExternalLink, Printer, Download, ArrowUpDown, ArrowUp, ArrowDown, Info } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { actualDispatchApi, skuApi, orderApi, depotApi, vehicleMasterApi, transportMasterApi, driverMasterApi, draftApi, gateInApi } from "@/lib/api-service"
import { isStaleWriteError } from "@/lib/stale-write"
import { generateDispatchSlipPdf } from "@/lib/dispatch-slip-pdf-lazy"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Combobox } from "@/components/ui/combobox"
import { useAuth } from "@/hooks/use-auth"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { StageHistoryTab } from "@/components/workflow/stage-history-tab"
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react"
import { usePersistedColumns } from "@/hooks/use-persisted-columns"
import { useColumnOrder } from "@/hooks/use-column-order"
import { SortableTableHead } from "@/components/ui/sortable-table-head"
import { ColumnDragProvider } from "@/components/ui/column-drag-provider"
import { fmtNum } from "@/lib/table-format"

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

// Groups raw pending-dispatch rows (from the API) by base DO number. Pulled out
// of the component so it can be reused both for the currently-loaded page
// (`displayRows`) and for a targeted, complete re-fetch of one specific DO (see
// `fetchCompleteGroupsForKeys` below) — the two need identical grouping logic.
// Pass `depoFilter` = "" to skip the depot-tab filter (used for the targeted
// fetch, where depot scoping is already enforced server-side).
function groupOrdersByBaseDo(orders: any[], depoFilter: string): any[] {
  const grouped: { [key: string]: any } = {}

  orders.forEach((order: any) => {
    const custName = (order.transfer === 'yes' && order.bill_company_name) ? order.bill_company_name : (order.party_name || order.customerName || "Unknown")
    const doNumber = order.so_no || order.soNo || "DO/26-27/0001"
    // Group by Base DO (e.g. DO/26-27/0001 from DO/26-27/0001A)
    const baseDoMatch = doNumber.match(/^(DO[-\/](?:\d{2}-\d{2}\/)?\d+)/i)
    const baseDo = baseDoMatch ? baseDoMatch[1].toUpperCase() : doNumber

    // Group by DO Date (party_so_date)
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
      const checklist = order.data?.checklistResults || {};

      grouped[groupKey]._ordersMap[baseDo] = {
        ...order,
        baseDo,
        _products: [],
        // Detailed Fields (Robust Mapping)
        deliveryPurpose: internalOrder.order_type_delivery_purpose || internalOrder.orderPurpose || "—",
        startDate: internalOrder.start_date || internalOrder.startDate || "—",
        endDate: internalOrder.end_date || internalOrder.endDate || "—",
        deliveryDate: internalOrder.delivery_date || internalOrder.deliveryDate || internalOrder.timestamp || "—",
        orderType: internalOrder.order_type || internalOrder.orderType || "—",
        customerType: internalOrder.customer_type || internalOrder.customerType || "—",
        partySoDate: formatDate(internalOrder.party_so_date || internalOrder.partySoDate),
        totalWithGst: internalOrder.total_amount_with_gst || internalOrder.totalWithGst || "—",
        transportType: internalOrder.type_of_transporting || internalOrder.transportType || "—",
        contactPerson: internalOrder.customer_contact_person_name || internalOrder.contactPerson || "—",
        whatsapp: internalOrder.customer_contact_person_whatsapp_no || internalOrder.whatsapp || "—",
        address: internalOrder.customer_address || internalOrder.address || "—",
        paymentTerms: internalOrder.payment_terms || internalOrder.paymentTerms || "—",
        advanceTaken: internalOrder.advance_payment_to_be_taken || internalOrder.advanceTaken || false,
        advanceAmount: internalOrder.advance_amount || internalOrder.advanceAmount || "—",
        isBroker: internalOrder.is_order_through_broker || internalOrder.isBroker || false,
        brokerName: internalOrder.broker_name || internalOrder.brokerName || "—",
        depoName: internalOrder.depo_name || internalOrder.depoName || "—",
        orderPunchRemarks: internalOrder.order_punch_remarks || internalOrder.orderPunchRemarks || "—",
        uploadSo: internalOrder.upload_so || internalOrder.uploadSo || null,
        rateRightly: internalOrder.rate_is_rightly_as_per_current_market_rate || checklist.rate || "—",
        dealingInOrder: internalOrder.we_are_dealing_in_ordered_sku || checklist.sku || "—",
        partyCredit: internalOrder.party_credit_status || checklist.credit || "—",
        dispatchConfirmed: internalOrder.dispatch_date_confirmed || checklist.dispatch || "—",
        overallStatus: internalOrder.overall_status_of_order || checklist.overall || "—",
        orderConfirmation: internalOrder.order_confirmation_with_customer || checklist.confirm || "—",
        revertSecurityRemarks: order.revert_security_remarks || internalOrder.revert_security_remarks || order.revertSecurityRemarks || "—",
        grossWeight: internalOrder.gross_weight || "—",
        tareWeight: internalOrder.tare_weight || "—",
        netWeight: internalOrder.net_weight || "—",
        weightDiff: internalOrder.weight_diff || "—",
        extraWeight: internalOrder.extra_weight || "—",
        weightmentSlip: internalOrder.weightment_slip_copy || null,
        rstNo: internalOrder.rst_no || "—",
        weightDiffReason: internalOrder.reason_of_difference_in_weight_if_any_speacefic || "—",
        // Read-only reference from Plan Vehicle (Stage 5) — vehicle/transporter/
        // driver/freight are decided there, not re-entered/re-validated here.
        plan_vehicle_confirmed: order.plan_vehicle_confirmed ?? internalOrder.plan_vehicle_confirmed ?? false,
        plan_vehicle_registration_no: order.plan_vehicle_registration_no ?? internalOrder.plan_vehicle_registration_no ?? null,
        plan_vehicle_transporter_name: order.plan_vehicle_transporter_name ?? internalOrder.plan_vehicle_transporter_name ?? null,
        plan_vehicle_driver_name: order.plan_vehicle_driver_name ?? internalOrder.plan_vehicle_driver_name ?? null,
        plan_vehicle_freight_rate_type: order.plan_vehicle_freight_rate_type ?? internalOrder.plan_vehicle_freight_rate_type ?? null,
        plan_vehicle_freight_amount: order.plan_vehicle_freight_amount ?? internalOrder.plan_vehicle_freight_amount ?? null,
        plan_vehicle_advance_bank: order.plan_vehicle_advance_bank ?? internalOrder.plan_vehicle_advance_bank ?? null,
        plan_vehicle_advance_diesel: order.plan_vehicle_advance_diesel ?? internalOrder.plan_vehicle_advance_diesel ?? null,
        plan_vehicle_advance_cash: order.plan_vehicle_advance_cash ?? internalOrder.plan_vehicle_advance_cash ?? null,
      }
    }

    // Add individual product to the group
    const productQty = parseFloat(order.qty_to_be_dispatched || order.qtyToDispatch || 0);
    const productMeta = {
      ...order,
      _rowKey: `${custName}-${baseDo}-${order.d_sr_number || order.id}`,
      orderNo: order.so_no || order.soNo,
      productName: order.product_name || order.productName,
      qtyToDispatch: order.qty_to_be_dispatched || order.qtyToDispatch,
      deliveryFrom: order.dispatch_from || order.deliveryFrom,
      dsrNumber: order.d_sr_number,
      rate: order.final_rate || order.rate_of_material,
      processid: order.processid || null,
      uploadSo: order.upload_so || order.uploadSo || null,
      // Ensure party details are present on each product for the slip generator
      customerName: custName,
      address: order.customer_delivery_address || order.customer_address || order.address || grouped[groupKey]._ordersMap[baseDo]?.address || "—",
      whatsapp: order.customer_contact_person_whatsapp_no || order.whatsapp || grouped[groupKey]._ordersMap[baseDo]?.whatsapp || "—",
      brokerName: order.broker_name || order.brokerName || grouped[groupKey]._ordersMap[baseDo]?.brokerName || "—"
    }

    grouped[groupKey]._ordersMap[baseDo]._products.push(productMeta)
    grouped[groupKey]._allProducts.push(productMeta)
  })

  return Object.values(grouped).map((group: any) => {
    const firstOrderDetails = Object.values(group._ordersMap)[0] as any || {};
    return {
      ...group,
      ...firstOrderDetails, // Flatten all detail fields into the group object
      orderNo: Array.from(group._allBaseDos).join(", "),
      processId: group._allProducts[0]?.processid || "—",
      uploadSo: group._allProducts[0]?.uploadSo || group._allProducts[0]?.upload_so || null,
      qtyToDispatch: group._allProducts.reduce((sum: number, p: any) => sum + parseFloat(p.qty_to_be_dispatched || p.qtyToDispatch || 0), 0),
      orderQty: group._allProducts.reduce((sum: number, p: any) => sum + parseFloat(p.order_qty || p.orderQty || 0), 0),
      approvalQty: group._allProducts.reduce((sum: number, p: any) => sum + parseFloat(p.approval_qty || p.approvalQty || 0), 0),
      altQty: group._allProducts.reduce((sum: number, p: any) => sum + parseFloat(p.alt_qty || p.altQty || 0), 0),
      totalWithGst: group._allProducts.reduce((sum: number, p: any) => {
        const val = String(p.total_amount_with_gst || p.totalWithGst || p.data?.orderData?.total_amount_with_gst || "0").replace(/[^0-9.-]+/g, "");
        return sum + (parseFloat(val) || 0);
      }, 0),
      orderPunchRemarks: Array.from(new Set(Object.values(group._ordersMap).map((o: any) => o.orderPunchRemarks))).filter(Boolean).join("; ") || "—",
      _productCount: group._allProducts.length
    };
  }).filter(group => {
    if (group._productCount <= 0) return false;
    if (!depoFilter) return true;
    return (group.depoName || "").trim().toUpperCase() === depoFilter.trim().toUpperCase();
  })
}

export default function ActualDispatchPage() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const { toast } = useToast()
  const { isReadOnly, user, isAdmin, isFeatureEnabled } = useAuth()
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
  // Pending/History tab, depot tab and status buttons are remembered permanently; quick search / customer / oil
  // filters only for the session (usePersistedFilters). Refresh only reloads data.
  const [listView, patchListView] = usePersistedFilters("actual-dispatch", {
    selectedDepoTab: "",
    quickSearch: "",
    statusFilter: "ALL" as "ALL" | "GATE_IN" | "READY" | "DRAFT",
    customerFilter: "ALL",
    oilFilter: "ALL",
  }, { permanentKeys: ["selectedDepoTab", "statusFilter"] })
  const { selectedDepoTab, quickSearch, statusFilter, customerFilter, oilFilter } = listView
  const setSelectedDepoTab = (v: string) => patchListView({ selectedDepoTab: v })
  const setQuickSearch = (v: string) => patchListView({ quickSearch: v })
  const setStatusFilter = (v: "ALL" | "GATE_IN" | "READY" | "DRAFT") => patchListView({ statusFilter: v })
  const setCustomerFilter = (v: string) => patchListView({ customerFilter: v })
  const setOilFilter = (v: string) => patchListView({ oilFilter: v })
  const [isProcessing, setIsProcessing] = useState(false)
  const [skus, setSkus] = useState<any[]>([])
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [docWarningDialog, setDocWarningDialog] = useState<{ open: boolean; messages: string[] }>({ open: false, messages: [] })
  const [confirmDetails, setConfirmDetails] = useState<Record<string, { qty: string }>>({})
  const [expandedOrders, setExpandedOrders] = useState<string[]>([])
  const [selectedGroups, setSelectedGroups] = useState<any[]>([])
  const [dialogSelectedProducts, setDialogSelectedProducts] = useState<string[]>([])
  const [revertRemarks, setRevertRemarks] = useState("")
  const [filterOptions, setFilterOptions] = useState<{ customerNames: string[] }>({ customerNames: [] })
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [isSlipDialogOpen, setIsSlipDialogOpen] = useState(false)
  const [gateInData, setGateInData] = useState<any>(null)
  const [isGateInPopupOpen, setIsGateInPopupOpen] = useState(false)

  // Consolidated State for Stage 7 (Weightment Audit). Vehicle/transporter/
  // documents/overload/freight are no longer collected here — they're confirmed
  // upstream at Plan Vehicle (Stage 5) and surfaced read-only via planVehicleInfo
  // below. Driver and the 3 advance amounts stay editable at this stage.
  const [loadData, setLoadData] = useState({
    actualQty: "",
    weightmentSlip: "",
    rstNo: "",
    grossWeight: "",
    tareWeight: "",
    netWeight: "",
    grossWeightPacking: "",
    netWeightPacking: "",
    otherItemWeight: "",
    dharamkataWeight: "",
    differanceWeight: "",
    reason: "",
    truckNo: "",
    vehicleNoPlateImage: "",
    vehicleNoPlateImage_file_name: "",
    checkStatus: "",
    remarks: "",
    extraWeight: "0",
    weightmentSlip_file_name: "",
    cash_bank: "",
    diesel_advance: "",
    bhada: ""
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

  const driverOptions = useMemo(() => (
    driverMaster
      .filter(d => d.driver_name && d.status === 'Active')
      .map(d => ({ value: d.driver_name, label: d.driver_name }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base', numeric: true }))
  ), [driverMaster])

  // TEMP: manual override for the Actual Dispatch Date while historical dates get
  // backfilled — remove this and docRefDate once no longer needed.
  const [docRefDate, setDocRefDate] = useState<string>(() => new Date().toISOString().split("T")[0])

  // Read-only reference to the vehicle/transporter/freight already confirmed at
  // Plan Vehicle (Stage 5) — Actual Dispatch no longer re-collects or re-validates
  // any of this, it just displays what was decided upstream. Derived from the
  // first selected group; every group in one dialog shares the same vehicle.
  const planVehicleInfo = useMemo(() => {
    const g: any = selectedGroups[0] || {};
    return {
      confirmed: !!g.plan_vehicle_confirmed,
      registrationNo: g.plan_vehicle_registration_no || null,
      transporterName: g.plan_vehicle_transporter_name || null,
      driverName: g.plan_vehicle_driver_name || null,
      freightRateType: g.plan_vehicle_freight_rate_type || null,
      freightAmount: g.plan_vehicle_freight_amount ?? null,
    };
  }, [selectedGroups]);

  // Vehicle type for the confirmed registration, used only to choose which
  // driver-license validity badge applies below (Trans vs LMV) — the vehicle
  // itself is fixed at Plan Vehicle and isn't selected/edited here anymore.
  const planVehicleType = useMemo(() => {
    if (!planVehicleInfo.registrationNo) return "";
    return vehicleMaster.find(v => v.registration_no === planVehicleInfo.registrationNo)?.vehicle_type || "";
  }, [vehicleMaster, planVehicleInfo.registrationNo]);

  const handleFileChange = async (field: string, fileNameField: string, file: File | null) => {
    if (!file) return

    setIsUploading(field)
    try {
      const response = await orderApi.uploadFile(file)
      if (response.success) {
        setLoadData(p => ({
          ...p,
          [field]: response.data.url,
          [fileNameField]: file.name
        }))
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

  // --- Helper Functions ---

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

  // --- End Helpers ---

  const PAGE_COLUMNS = [
    { id: "partySoDate", label: "DO Date" },
    { id: "orderNo", label: "DO Number" },
    { id: "processId", label: "Manual Sauda No." },
    { id: "deliveryPurpose", label: "Order Type (Delivery Purpose)" },
    { id: "orderType", label: "Order Type" },
    { id: "customerType", label: "Customer Type" },
    { id: "startDate", label: "Start Date" },
    { id: "endDate", label: "End Date" },
    { id: "deliveryDate", label: "Delivery Date" },
    { id: "customerName", label: "Customer Name" },
    { id: "oilType", label: "Oil Type" },
    { id: "ratePer15Kg", label: "Rate Per 15 kg (₹)" },
    { id: "ratePerLtr", label: "Rate Per Ltr. (₹)" },
    { id: "rateOfMaterial", label: "Rate of Material (₹)" },
    { id: "rate", label: "Rate (₹)" },
    { id: "productName", label: "Product Name" },
    { id: "uom", label: "UOM" },
    { id: "orderQty", label: "Order Qty" },
    { id: "altUom", label: "Alt UOM" },
    { id: "altQty", label: "Alt Qty (Kg)" },
    { id: "skuName", label: "SKU Name" },
    { id: "approvalQty", label: "Approval Qty" },
    { id: "qtyToDispatch", label: "Qty to Dispatch" },
    { id: "deliveryFrom", label: "Delivery From" },
    { id: "totalWithGst", label: "Total Amount with GST (₹)" },
    { id: "transportType", label: "Type of Transporting" },
    { id: "contactPerson", label: "Customer Contact Person Name" },
    { id: "whatsapp", label: "Customer Contact Person Whatsapp No." },
    { id: "address", label: "Customer Address" },
    { id: "paymentTerms", label: "Payment Terms" },
    { id: "advanceTaken", label: "Advance Payment to be Taken" },
    { id: "advanceAmount", label: "Advance Amount (₹)" },
    { id: "isBroker", label: "Is this order Through Broker" },
    { id: "brokerName", label: "Broker Name (If Order Through Broker)" },
    { id: "uploadSo", label: "Upload DO" },
    { id: "orderPunchRemarks", label: "Order Punch Remarks" },
    { id: "remark", label: "Remark" },
    { id: "revertSecurityRemarks", label: "Revert(Security-Guard) Remarks" },
    { id: "revertDispatchRemarks", label: "Revert(Dispatch-Planning) Remarks" },
    { id: "revertPlanningRemarks", label: "Revert(Pre-Approval) Remarks" },
    { id: "status", label: "Status" },
  ]

  const [visibleColumns, setVisibleColumns] = usePersistedColumns(
    "actual-dispatch",
    ["partySoDate", "orderNo", "processId", "customerName", "qtyToDispatch", "deliveryFrom", "orderPunchRemarks", "status", "revertSecurityRemarks"]
  )
  const [columnOrder, setColumnOrder] = useColumnOrder("actual-dispatch", PAGE_COLUMNS.map(c => c.id))
  const orderedVisibleCols = columnOrder
    .map(id => PAGE_COLUMNS.find(c => c.id === id))
    .filter((col): col is typeof PAGE_COLUMNS[0] => !!col && visibleColumns.includes(col.id))
  const handleColumnReorder = useCallback((newVisibleOrder: string[]) => {
    const hiddenCols = columnOrder.filter(id => !visibleColumns.includes(id))
    setColumnOrder([...newVisibleOrder, ...hiddenCols])
  }, [columnOrder, visibleColumns, setColumnOrder])

  // Pending query with numeric pagination
  const {
    data: pendingResult,
    isLoading: isPendingLoading,
    refetch: refetchPending,
  } = useQuery({
    queryKey: ["actual-dispatch-pending", filterValues, pendingPage, selectedDepoTab, user?.depo_access?.['Actual Dispatch']],
    queryFn: async () => {
      // Paginate within the selected depot tab so a depot's rows aren't pushed off
      // the page by newer rows from other accessible depots. Falls back to the full
      // access list before a tab is chosen. selectedDepoTab is always within the
      // allowed set, so this still respects permissions.
      const allowedDepots = user?.depo_access?.['Actual Dispatch'] || []
      const response = await actualDispatchApi.getPending({
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
    staleTime: 0,               // always consider data stale → refetch when navigating back
    refetchOnWindowFocus: true, // refetch when user switches browser tab back
  });

  const pendingOrders = useMemo(() => {
    return pendingResult?.dispatches || [];
  }, [pendingResult]);

  // Reset page when filters or depot tab changes
  useEffect(() => {
    setPendingPage(1);
  }, [filterValues, selectedDepoTab]);

  // ── Refetch fresh data from DB whenever stage tab or depot tab changes ──
  useEffect(() => {
    if (activeTab === "pending") {
      refetchPending();
    }
  }, [activeTab, selectedDepoTab]);

  // Fetch SKU details for weight calculations
  const fetchSkus = async () => {
    try {
      console.log('[ACTUAL DISPATCH] Fetching SKUs for weight calculation...')
      const response = await skuApi.getAll({ limit: 1000 })
      console.log('[ACTUAL DISPATCH] SKU API Response:', response)

      if (response.success && response.data) {
        // Backend returns either an array (old) or an object with skuDetails (new)
        let skuArray = []
        if (Array.isArray(response.data)) {
          skuArray = response.data
        } else if (response.data.skuDetails && Array.isArray(response.data.skuDetails)) {
          skuArray = response.data.skuDetails
        } else if (typeof response.data === 'object') {
          // Robust fallback
          skuArray = response.data.skus || response.data.items || []
        }

        console.log(`[ACTUAL DISPATCH] Loaded ${skuArray.length} SKUs`)
        setSkus(skuArray)
      } else {
        console.error('[ACTUAL DISPATCH] SKU API returned no data:', response)
      }
    } catch (error: any) {
      console.error("[ACTUAL DISPATCH] Failed to fetch SKUs:", error)
    }
  }

  const fetchDepots = async () => {
    try {
      const response = await depotApi.getAll({ all: 'false' });
      if (response.success && response.data?.depots) {
        let depots = response.data.depots;

        // Filter by user permissions: strict deny-by-default even for admins.
        const allowedDepos = user?.depo_access?.['Actual Dispatch'] || [];
        depots = depots.filter((d: any) =>
          allowedDepos.some(ad => ad.toLowerCase() === d.depot_name.toLowerCase())
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
      console.error("[ACTUAL DISPATCH] Failed to fetch depots:", error);
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

  // Fetch dynamic filters
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const response = await actualDispatchApi.getFilters();
        if (response.success) {
          setFilterOptions(response.data);
        }
      } catch (error) {
        console.error("Failed to fetch filter options:", error);
      }
    };
    fetchFilters();
  }, []);

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
      // Returned directly (not read back off state) so callers avoid the stale-closure
      // trap of reading `vehicleMaster`/`driverMaster` in the same tick they were set.
      return { vehicles, drivers };
    } catch (error) {
      console.error("Failed to fetch master data:", error);
      return { vehicles: [], drivers: [] };
    }
  };

  useEffect(() => {
    fetchMasterData();
  }, []);



  // Auto-calculate Net Weight (Gross - Tare)
  useEffect(() => {
    const gross = parseFloat(loadData.grossWeight) || 0
    const tare = parseFloat(loadData.tareWeight) || 0
    const net = gross - tare

    setLoadData(prev => ({
      ...prev,
      netWeightPacking: (loadData.grossWeight || loadData.tareWeight) ? net.toFixed(2) : prev.netWeightPacking
    }))
  }, [loadData.grossWeight, loadData.tareWeight])

  // Calculate Expected SKU Weight for calculations
  const totalPackingWeightFromSku = useMemo(() => {
    return selectedGroups.flatMap(g => g._allProducts)
      .filter((prod: any) => dialogSelectedProducts.includes(prod._rowKey))
      .reduce((total, prod) => {
        const rowKey = prod._rowKey
        return total + calculateGrossWeight(prod.productName, confirmDetails[rowKey]?.qty || prod.qtyToDispatch)
      }, 0)
  }, [selectedGroups, confirmDetails, skus, dialogSelectedProducts])

  // Gross Weight is NOT pre-filled: per the spec the user enters the weighbridge
  // Gross (loaded vehicle) and Tare (empty vehicle) weights; the goods' expected
  // weight is only used below to compute the Difference.

  // Auto-calculate Total Weight and Difference
  const totalCombinedWeight = useMemo(() => {
    const packingWeight = totalPackingWeightFromSku || 0
    const extraWeight = parseFloat(loadData.extraWeight) || 0
    return packingWeight + extraWeight
  }, [totalPackingWeightFromSku, loadData.extraWeight])

  useEffect(() => {
    const net = parseFloat(loadData.netWeightPacking) || 0
    const diff = net - totalCombinedWeight

    setLoadData(prev => ({
      ...prev,
      // Only once Gross/Tare have been entered (Net is computed) — otherwise the
      // Difference would show a meaningless negative before the user types anything.
      differanceWeight: loadData.netWeightPacking ? diff.toFixed(4) : ""
    }))
  }, [loadData.netWeightPacking, totalCombinedWeight])

  // Auto-update Actual Qty when selected products or their confirmed quantities change
  useEffect(() => {
    if (selectedGroups.length === 0) return;
    const totalQty = selectedGroups.flatMap(g => g._allProducts)
      .filter((p: any) => dialogSelectedProducts.includes(p._rowKey))
      .reduce((sum, p) => sum + parseFloat(confirmDetails[p._rowKey]?.qty || p.qtyToDispatch || "0"), 0);

    setLoadData(prev => ({
      ...prev,
      actualQty: String(totalQty)
    }));
  }, [dialogSelectedProducts, confirmDetails, selectedGroups]);


  /* Extract unique customer names */


  const filteredPendingOrders = pendingOrders.filter((order: any) => {
    let matches = true

    // Filter by Planned/Actual Status (Must have planned_1, must not have actual_1)
    if (order.planned_1 === null || order.planned_1 === undefined || order.actual_1 !== null) {
      matches = false
    }

    // Filter by Party Name
    const currentCustName = (order.transfer === 'yes' && order.bill_company_name) ? order.bill_company_name : (order.party_name || order.customerName)
    if (filterValues.partyName && filterValues.partyName !== "all" && currentCustName !== filterValues.partyName) {
      matches = false
    }

    // DO Date range is applied server-side (do_date_from/do_date_to), not here.

    // Filter by Status (On Time / Expire)
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

  // Accumulates every group ever rendered, keyed by _rowKey, across page/search
  // changes — displayRows only reflects the current server page, but a DO
  // selected on an earlier page/search still needs to be resolvable here so
  // Confirm Dispatch can include it. Kept only as a fallback now — see
  // fetchCompleteGroupsForKeys below, which is the primary source of truth.
  const selectedGroupsCacheRef = useRef<Record<string, any>>({})
  useEffect(() => {
    displayRows.forEach((row: any) => {
      selectedGroupsCacheRef.current[row._rowKey] = row
    })
  }, [displayRows])

  // A single DO's pending shipments can be split across pages of the general
  // list (one shipment planned weeks ago, a sibling created just now after a
  // revert/re-plan cycle) — the page you happen to be viewing, or the cache
  // above, may only hold PART of that DO. Before confirming dispatch, fetch a
  // fresh, complete, authoritative set of every pending shipment for each
  // requested base-DO key directly from the server, so a sibling shipment can
  // never be silently left out just because it's not on the current page.
  const fetchCompleteGroupsForKeys = useCallback(async (keys: string[]): Promise<Record<string, any>> => {
    const allowedDepots = user?.depo_access?.['Actual Dispatch'] || []
    const byKey: Record<string, any> = {}
    await Promise.all(keys.map(async (key) => {
      try {
        const response = await actualDispatchApi.getPending({
          page: 1,
          limit: 200,
          search: key,
          depo_names: allowedDepots,
        })
        if (!response.success) return
        // The search above is a fuzzy match server-side — filter down to rows
        // whose base DO is an EXACT match for `key`, so a longer DO number that
        // happens to contain this one as a substring can't sneak in.
        const rows = (response.data?.dispatches || []).filter((order: any) => {
          const doNumber = order.so_no || order.soNo || ""
          const baseDoMatch = doNumber.match(/^(DO[-\/](?:\d{2}-\d{2}\/)?\d+)/i)
          const baseDo = baseDoMatch ? baseDoMatch[1].toUpperCase() : doNumber.toUpperCase()
          return baseDo === key
        })
        const groups = groupOrdersByBaseDo(rows, "") // depot already scoped server-side above
        const match = groups.find((g: any) => g._rowKey === key)
        if (match) byKey[key] = match
      } catch {
        // Swallow — the caller falls back to the cache/passed-in group below.
      }
    }))
    return byKey
  }, [user?.depo_access])

  // Product-level columns (Product Name, Oil Type, Rate, UOM, etc.) only exist on
  // individual line items inside _allProducts — the flattened group row never carries
  // them — so any renderer reading row[colId] directly for these gets blank. Read from
  // the first product instead. Shared by the sort comparator and both table/card cell renderers.
  const getColumnDisplayValue = (row: any, colId: string): string => {
    const firstProd = row._allProducts?.[0] || {}
    if (colId === "oilType") return String(firstProd.oilType || firstProd.oil_type || "—")
    if (colId === "productName") return String(firstProd.productName || firstProd.product_name || "—")
    if (colId === "ratePer15Kg") return String(firstProd.ratePer15Kg || firstProd.rate_per_15kg || "—")
    if (colId === "ratePerLtr") return String(firstProd.ratePerLtr || firstProd.rate_per_ltr || "—")
    if (colId === "rateOfMaterial") return String(firstProd.rateOfMaterial || firstProd.rate_of_material || "—")
    if (colId === "rate") return String(firstProd.rate || firstProd.final_rate || "—")
    if (colId === "uom") return String(firstProd.uom || "—")
    if (colId === "orderQty") return String(firstProd.orderQty || firstProd.order_quantity || "—")
    if (colId === "altUom") return String(firstProd.altUom || firstProd.alternate_uom || "—")
    if (colId === "altQty") return String(firstProd.altQty || firstProd.alternate_qty_kg || "—")
    if (colId === "skuName") return String(firstProd.skuName || firstProd.sku_name || "—")
    if (colId === "approvalQty") return String(firstProd.approvalQty || firstProd.approval_qty || "—")
    if (colId === "deliveryFrom") return String(firstProd.deliveryFrom || firstProd.dispatch_from || "—")

    // Standard fields
    const directVal = row[colId]
    if (directVal !== undefined && directVal !== null && directVal !== "") return String(directVal)

    return "—"
  }

  // ── Stage table (column search / date range / sort / totals) ──

  const rowStatusText = (row: any) => (row.has_draft ? "Draft Saved" : row.has_gate_in ? "Ready for Dispatch" : "Ready for Gate In")

  const NUMERIC_COLS = ["qtyToDispatch", "orderQty", "approvalQty", "altQty", "totalWithGst"]
  const DATE_COLS = ["partySoDate", "startDate", "endDate", "deliveryDate"]
  const parseAmount = (v: any) => parseFloat(String(v ?? "0").replace(/[^0-9.-]+/g, "")) || 0

  const RATE_COLS = ["ratePer15Kg", "ratePerLtr", "rateOfMaterial", "rate", "advanceAmount"]
  const RIGHT_COLS = [...NUMERIC_COLS, ...DATE_COLS, ...RATE_COLS]
  const colWidth = (id: string) => (RIGHT_COLS.includes(id) ? "min-w-[125px]" : undefined)
  // Display formatting for table cells + mobile cards (plain numbers, dd/mm/yyyy dates, no units).
  const formatCellValue = (row: any, colId: string): string => {
    const v = getColumnDisplayValue(row, colId)
    if (v === "—") return v
    if (colId === "partySoDate") return v
    if (DATE_COLS.includes(colId)) return formatDate(v)
    if (NUMERIC_COLS.includes(colId)) return fmtNum(parseAmount(v), colId === "totalWithGst" ? 2 : 4)
    if (RATE_COLS.includes(colId)) return Number.isFinite(Number(v)) ? fmtNum(v, 2) : v
    return v
  }

  const tableCols = useMemo<StageColDef<any>[]>(() => {
    return orderedVisibleCols.map((col): StageColDef<any> => {
      if (col.id === "status") return { id: col.id, label: col.label, accessor: (r: any) => rowStatusText(r) }
      if (NUMERIC_COLS.includes(col.id)) {
        return { id: col.id, label: col.label, type: "number", total: !["qtyToDispatch", "orderQty", "approvalQty"].includes(col.id), accessor: (r: any) => parseAmount(getColumnDisplayValue(r, col.id)) }
      }
      if (DATE_COLS.includes(col.id)) {
        return {
          id: col.id,
          label: col.label,
          type: "date",
          accessor: (r: any) => (col.id === "partySoDate" ? r._allProducts?.[0]?.party_so_date || r._allProducts?.[0]?.partySoDate : r[col.id]),
        }
      }
      return { id: col.id, label: col.label, accessor: (r: any) => getColumnDisplayValue(r, col.id) }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedVisibleCols.map(c => c.id).join("|")])

  const baseFilter = useCallback((row: any) => {
    if (statusFilter === "DRAFT" && !row.has_draft) return false
    if (statusFilter === "READY" && (row.has_draft || !row.has_gate_in)) return false
    if (statusFilter === "GATE_IN" && (row.has_draft || row.has_gate_in)) return false
    if (customerFilter !== "ALL" && row.customerName !== customerFilter) return false
    if (oilFilter !== "ALL" && getColumnDisplayValue(row, "oilType") !== oilFilter) return false
    const q = quickSearch.trim().toLowerCase()
    if (q) {
      const hay = [row.orderNo, row.processId, row.customerName, getColumnDisplayValue(row, "productName"), row.orderPunchRemarks].join(" ").toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, customerFilter, oilFilter, quickSearch])

  const table = useStageTable<any>({ rows: displayRows, columns: tableCols, baseFilter, persistKey: "actual-dispatch" })
  const sortedDisplayRows = table.rows
  const uniqueCustomerNames = useMemo(
    () => Array.from(new Set(displayRows.map((r: any) => String(r.customerName || "")).filter(Boolean))).sort() as string[],
    [displayRows]
  )
  const uniqueOilTypes = useMemo(
    () => Array.from(new Set(displayRows.map((r: any) => getColumnDisplayValue(r, "oilType")).filter((v: string) => v && v !== "—"))).sort() as string[],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [displayRows]
  )
  const activeFiltersCount =
    (statusFilter !== "ALL" ? 1 : 0) + (customerFilter !== "ALL" ? 1 : 0) + (oilFilter !== "ALL" ? 1 : 0) +
    (quickSearch.trim() ? 1 : 0) + table.activeColumnFilterCount
  const clearAllTableFilters = () => {
    patchListView({ statusFilter: "ALL", customerFilter: "ALL", oilFilter: "ALL", quickSearch: "" })
    table.clearColumnFilters()
  }
  const statusLabel = (s: string) => (s === "GATE_IN" ? "Ready for Gate In" : s === "READY" ? "Ready for Dispatch" : "Draft Saved")


  const toggleSelectAll = () => {
    const currentPageKeys = sortedDisplayRows.map((row) => row._rowKey)
    const allCurrentSelected = currentPageKeys.length > 0 && currentPageKeys.every((k) => selectedOrders.includes(k))
    if (allCurrentSelected) {
      // Only drop this page's keys — leave selections made on other pages/searches intact
      setSelectedOrders(selectedOrders.filter((k) => !currentPageKeys.includes(k)))
    } else {
      // Merge this page's keys into the existing cross-page selection
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


  const handleOpenDialog = async (group?: any) => {
    // Resolve selected DOs to a fresh, complete, authoritative set fetched
    // directly from the server (see fetchCompleteGroupsForKeys) — a DO's
    // pending shipments can be split across pages of the general list, so
    // neither the current page nor the cross-page cache can be trusted to be
    // complete. Fall back to the cache (or the passed-in group) only if that
    // fetch comes back empty for a given key, e.g. a transient network error.
    const keys = group ? [group._rowKey] : [...selectedOrders]
    const fetchedByKey = await fetchCompleteGroupsForKeys(keys)
    const targetGroups = keys
      .map((key) => fetchedByKey[key] || selectedGroupsCacheRef.current[key] || (group && group._rowKey === key ? group : null))
      .filter(Boolean);

    if (targetGroups.length > 0) {
      // Refresh driver master data so the driver combobox/badges reflect records
      // updated since page load. Awaited so the draft-restore step below can
      // re-derive driver data from current master data instead of trusting a
      // possibly stale saved draft.
      const { drivers: freshDrivers } = await fetchMasterData();

      // TEMP: reset the manual expiry-check reference date to today on every
      // dialog open, so a backdated value doesn't leak into an unrelated dispatch.
      setDocRefDate(new Date().toISOString().split("T")[0])

      setSelectedGroups(targetGroups)
      // Default: Select ALL products in all selected groups
      const allKeys = targetGroups.flatMap(g => g._allProducts.map((p: any) => p._rowKey));
      setDialogSelectedProducts(allKeys)

      // Pre-fill confirmation details
      const newDetails: Record<string, { qty: string }> = {};
      targetGroups.forEach(g => {
        g._allProducts.forEach((prod: any) => {
          newDetails[prod._rowKey] = {
            qty: String(prod.qtyToDispatch)
          };
        });
      });
      setConfirmDetails(newDetails);

      setIsDialogOpen(true)

      // Reset consolidated forms. Vehicle/transporter/documents/freight are no
      // longer collected here — they were confirmed at Plan Vehicle (Stage 5)
      // and are read straight off the row's plan_vehicle_* fields (see
      // planVehicleInfo above). Driver and the 3 advance amounts stay editable
      // at this stage, so pre-fill them from Plan Vehicle's values below.
      const planInfo: any = targetGroups[0] || {};

      setDriverName(planInfo.plan_vehicle_driver_name || "")
      const planDriver = planInfo.plan_vehicle_driver_name
        ? freshDrivers.find((drv: any) => drv.driver_name === planInfo.plan_vehicle_driver_name)
        : null;
      setDriverData(planDriver ? {
        contact_no: planDriver.mobile_no || "",
        license_no: planDriver.driving_licence_no || "",
        license_type: planDriver.driving_licence_type || "",
        valid_upto: planDriver.valid_upto ? new Date(planDriver.valid_upto).toISOString().split('T')[0] : "",
        trans_valid_upto: planDriver.trans_valid_upto ? new Date(planDriver.trans_valid_upto).toISOString().split('T')[0] : "",
        lmv_valid_upto: planDriver.lmv_valid_upto ? new Date(planDriver.lmv_valid_upto).toISOString().split('T')[0] : ""
      } : {
        contact_no: "",
        license_no: "",
        license_type: "",
        valid_upto: "",
        trans_valid_upto: "",
        lmv_valid_upto: ""
      })
      setLoadData({
        actualQty: String(targetGroups.flatMap(g => g._allProducts).reduce((sum, p) => sum + parseFloat(p.qtyToDispatch || "0"), 0)),
        weightmentSlip: "",
        rstNo: "",
        grossWeight: "",
        tareWeight: "",
        netWeight: "",
        grossWeightPacking: "",
        netWeightPacking: "",
        otherItemWeight: "",
        dharamkataWeight: "",
        differanceWeight: "",
        reason: "",
        truckNo: planInfo.plan_vehicle_registration_no || "",
        vehicleNoPlateImage: "",
        checkStatus: "",
        remarks: "",
        extraWeight: "0",
        weightmentSlip_file_name: "",
        vehicleNoPlateImage_file_name: "",
        cash_bank: planInfo.plan_vehicle_advance_bank != null ? String(planInfo.plan_vehicle_advance_bank) : "",
        diesel_advance: planInfo.plan_vehicle_advance_diesel != null ? String(planInfo.plan_vehicle_advance_diesel) : "",
        bhada: planInfo.plan_vehicle_advance_cash != null ? String(planInfo.plan_vehicle_advance_cash) : ""
      })

      // Silently restore saved draft if one exists — shared per order, so this
      // restores drafts saved by any user, not just the current one. Restoring
      // (below) intentionally happens after the Plan Vehicle-derived defaults
      // above, so an in-progress draft for THIS stage wins over those defaults.
      if (targetGroups.length > 0) {
        const orderKey = targetGroups[0]._rowKey;
        try {
          const res = await draftApi.get(orderKey);
          if (res.success && res.data?.draft_data) {
            const d = res.data.draft_data;
            if (d.loadData) setLoadData(prev => ({ ...prev, ...d.loadData }));
            // Driver fields are entirely master-derived (license no/type/expiry, contact) —
            // re-fetch fresh from driverMaster rather than trusting the draft snapshot.
            if (d.driverName) {
              setDriverName(d.driverName);
              const draftDriver = freshDrivers.find((drv: any) => drv.driver_name === d.driverName);
              if (draftDriver) {
                setDriverData({
                  contact_no: draftDriver.mobile_no || "",
                  license_no: draftDriver.driving_licence_no || "",
                  license_type: draftDriver.driving_licence_type || "",
                  valid_upto: draftDriver.valid_upto ? new Date(draftDriver.valid_upto).toISOString().split('T')[0] : "",
                  trans_valid_upto: draftDriver.trans_valid_upto ? new Date(draftDriver.trans_valid_upto).toISOString().split('T')[0] : "",
                  lmv_valid_upto: draftDriver.lmv_valid_upto ? new Date(draftDriver.lmv_valid_upto).toISOString().split('T')[0] : ""
                });
              }
            }
            if (d.confirmDetails) setConfirmDetails(prev => ({ ...prev, ...d.confirmDetails }));
            if (d.dialogSelectedProducts) setDialogSelectedProducts(d.dialogSelectedProducts);
            if (d.docRefDate) setDocRefDate(d.docRefDate);
            toast({ title: "Draft Restored", description: "Your saved draft has been loaded." });
          }
        } catch {
          // Draft load failure is non-critical — silently ignore
        }
      }

      // Fetch gate-in status for this order
      setGateInData(null);
      if (targetGroups.length > 0) {
        const orderKey = targetGroups[0]._rowKey;
        try {
          const giRes = await gateInApi.check(orderKey);
          if (giRes.success && giRes.data) {
            setGateInData(giRes.data);
          }
        } catch {
          // Non-critical
        }
      }
    }
  }


  const toggleSelectDialogProduct = (key: string) => {
    if (dialogSelectedProducts.includes(key)) {
      setDialogSelectedProducts(prev => prev.filter(k => k !== key))
    } else {
      setDialogSelectedProducts(prev => [...prev, key])
    }
  }

  const renderSlipContent = () => {
    if (selectedGroups.length === 0 || dialogSelectedProducts.length === 0) return null;

    const productsForSlip = selectedGroups.flatMap(group =>
      group._allProducts.filter((p: any) => dialogSelectedProducts.includes(p._rowKey))
    );

    const partyGroups: Record<string, any[]> = {};
    productsForSlip.forEach(p => {
      const pName = p.customerName || p.party_name || p.partyName || "Unknown Party";
      if (!partyGroups[pName]) partyGroups[pName] = [];
      partyGroups[pName].push(p);
    });

    const OIL_COLORS: Record<string, string> = { "RICE OIL": "#FCE4D6", "SOYA OIL": "#E2EFDA", "PALM OIL": "#C5D9F1", "OTHERS": "#E5E7EB" };
    const OIL_TITLES: Record<string, string> = { "RICE OIL": "Rice Oil", "SOYA OIL": "Soya Oil", "PALM OIL": "Palm Oil", "OTHERS": "Other" };
    const fmtWt = (n: number) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    const fmtDT = (s: any) => {
      if (!s) return "";
      const d = new Date(s);
      if (isNaN(d.getTime())) return "";
      const pad = (n: number) => String(n).padStart(2, "0");
      let h = d.getHours();
      const ampm = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${String(d.getFullYear()).slice(2)} ${pad(h)}:${pad(d.getMinutes())} ${ampm}`;
    };

    return (
      <div className="space-y-8">
        {Object.entries(partyGroups).map(([party, partyProducts]) => {
          const firstProd = partyProducts[0];
          const date = new Date().toLocaleDateString('en-GB');
          const commitmentNo = firstProd.orderNo || "—";
          const orderThrough = firstProd.orderThrough || firstProd.is_order_through || "Direct";
          const referenceLabel = orderThrough === "Broker" ? "Broker" : orderThrough === "Salesperson" ? "Salesperson" : "";
          const referenceValue = orderThrough === "Broker"
            ? (firstProd.brokerName || firstProd.broker_name || "—")
            : orderThrough === "Salesperson"
              ? (firstProd.salespersonName || firstProd.salesperson_name || "—")
              : "Direct";
          const rawAddress = firstProd.address || firstProd.customer_delivery_address || firstProd.customer_address || "";
          const place = rawAddress || "—";
          const partyMo = firstProd.whatsapp || firstProd.customer_contact_person_whatsapp_no || firstProd.party_mo || firstProd.mobile || "—";
          const processId = firstProd.processid || firstProd.process_id || firstProd.processId || "—";
          const punchBy = firstProd.order_punch_user || "—";
          const punchAt = firstProd.order_punch_at || null;
          const preApproveBy = firstProd.pre_approval_user || "—";
          const preApproveAt = firstProd.pre_approval_at || null;
          const approveBy = firstProd.order_approval_user || "—";
          const approveAt = firstProd.order_approval_at || null;
          const status = firstProd.has_prior_dispatch ? "Pending" : "Original";

          const categories: Record<string, any[]> = {
            "RICE OIL": [],
            "SOYA OIL": [],
            "PALM OIL": [],
            "OTHERS": []
          };

          partyProducts.forEach(prod => {
            const name = (prod.productName || "").toUpperCase();
            const qty = parseFloat(confirmDetails[prod._rowKey]?.qty || prod.qtyToDispatch || "0");
            const unit = prod.uom || "PCS";
            const weight = calculateWeight(prod.productName, qty);
            const grossWeight = calculateGrossWeight(prod.productName, qty);

            const item = { name: prod.productName, unit, qty, weight, grossWeight };

            if (name.includes("RBO") || name.includes("RICE")) categories["RICE OIL"].push(item);
            else if (name.includes("SBO") || name.includes("SOYA")) categories["SOYA OIL"].push(item);
            else if (name.includes("PALM")) categories["PALM OIL"].push(item);
            else categories["OTHERS"].push(item);
          });

          return (
            <div key={party} className="border border-black bg-white text-black mb-8 last:mb-0 max-w-[600px] mx-auto">
              <div className="text-center px-2 pt-3 pb-2">
                <h1 className="text-xl font-black">SHRI SHYAM OIL EXTRACTIONS PVT LTD</h1>
                <p className="text-[11px] text-gray-500">Vill: Banari, PO: Banari, Dist: Janjgir-Champa (CG)</p>
                <div className="text-base font-bold mt-1">Oil Dispatch Voucher</div>
              </div>

              <div className="grid grid-cols-2 text-xs border-t border-black">
                <div className="border-b border-r border-black p-1.5"><span className="font-bold">DO no.:</span> {commitmentNo}</div>
                <div className="border-b border-black p-1.5"><span className="font-bold">DO Date:</span> {date}</div>
                <div className="border-b border-r border-black p-1.5"><span className="font-bold">Customer:</span> {party}</div>
                <div className="border-b border-black p-1.5">{referenceLabel ? <><span className="font-bold">{referenceLabel}:</span> {referenceValue}</> : referenceValue}</div>
                <div className="border-b border-r border-black p-1.5 break-words min-w-0"><span className="font-bold">Address:</span> <span className="break-all">{place}</span></div>
                <div className="border-b border-black p-1.5">
                  <span className="font-bold">Mob.:</span> {partyMo}<br />
                  <span className="font-bold">Status:</span> {status}
                </div>
              </div>

              <table className="w-full border-collapse">
                <thead>
                  <tr style={{ background: "#A6A6A6" }}>
                    <th className="border border-black border-t-0 p-1.5 text-left text-xs w-full">Item Name</th>
                    <th className="border border-black border-t-0 p-1.5 text-center text-xs whitespace-nowrap">QTY</th>
                    <th className="border border-black border-t-0 p-1.5 text-center text-xs whitespace-nowrap">UOM</th>
                    <th className="border border-black border-t-0 p-1.5 text-center text-xs whitespace-nowrap">Net Wt.</th>
                    <th className="border border-black border-t-0 p-1.5 text-center text-xs whitespace-nowrap">Gross Wt.</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(categories).map(([category, items]) => {
                    if (items.length === 0) return null;
                    const catQty = items.reduce((s, i) => s + i.qty, 0);
                    const catWeight = items.reduce((s, i) => s + i.weight, 0);
                    const catGrossWeight = items.reduce((s, i) => s + i.grossWeight, 0);
                    return (
                      <React.Fragment key={category}>
                        <tr style={{ background: OIL_COLORS[category] }} className="font-bold text-center"><td colSpan={5} className="border border-black p-1 text-sm">{OIL_TITLES[category]}</td></tr>
                        {items.map((item, idx) => (
                          <tr key={idx}>
                            <td className="border border-black p-1.5 text-xs">{item.name}</td>
                            <td className="border border-black p-1.5 text-xs text-center">{item.qty}</td>
                            <td className="border border-black p-1.5 text-xs text-center">{item.unit}</td>
                            <td className="border border-black p-1.5 text-xs text-right whitespace-nowrap">{fmtWt(item.weight)} KGS</td>
                            <td className="border border-black p-1.5 text-xs text-right whitespace-nowrap">{fmtWt(item.grossWeight)} KGS</td>
                          </tr>
                        ))}
                        <tr style={{ background: OIL_COLORS[category] }} className="font-bold">
                          <td className="border border-black p-1.5 text-xs text-right whitespace-nowrap">Total {OIL_TITLES[category]}</td>
                          <td className="border border-black p-1.5 text-xs text-center">{catQty}</td>
                          <td className="border border-black p-1.5 text-xs"></td>
                          <td className="border border-black p-1.5 text-xs text-right whitespace-nowrap">{fmtWt(catWeight)} KGS</td>
                          <td className="border border-black p-1.5 text-xs text-right whitespace-nowrap">{fmtWt(catGrossWeight)} KGS</td>
                        </tr>
                      </React.Fragment>
                    )
                  })}
                  <tr className="bg-black text-white font-bold">
                    <td className="border border-black p-1.5 text-xs text-center">Grand Total</td>
                    <td className="border border-black p-1.5 text-xs text-center">{partyProducts.reduce((s, p) => s + parseFloat(confirmDetails[p._rowKey]?.qty || p.qtyToDispatch || "0"), 0)}</td>
                    <td className="border border-black p-1.5 text-xs"></td>
                    <td className="border border-black p-1.5 text-xs text-right whitespace-nowrap">{fmtWt(partyProducts.reduce((s, p) => s + calculateWeight(p.productName, confirmDetails[p._rowKey]?.qty || p.qtyToDispatch), 0))} KGS</td>
                    <td className="border border-black p-1.5 text-xs text-right whitespace-nowrap">{fmtWt(partyProducts.reduce((s, p) => s + calculateGrossWeight(p.productName, confirmDetails[p._rowKey]?.qty || p.qtyToDispatch), 0))} KGS</td>
                  </tr>
                  <tr>
                    <td colSpan={5} className="border border-black p-2 align-top">
                      <div className="flex justify-between gap-2 text-[11px]">
                        <div className="text-center flex-1"><span className="underline">Order Punch By: {punchBy}</span><br />({fmtDT(punchAt)})</div>
                        <div className="text-center flex-1"><span className="underline">Pre-Approve By: {preApproveBy}</span><br />({fmtDT(preApproveAt)})</div>
                        <div className="text-center flex-1"><span className="underline">Approve By: {approveBy}</span><br />({fmtDT(approveAt)})</div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )
        })}
      </div>
    );
  };

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
          const qty = parseFloat(confirmDetails[prod._rowKey]?.qty || prod.qtyToDispatch || "0");
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
    generateDispatchSlipPdf(buildSlipParties(), "dispatch-slip.pdf");
  };

  const handlePrintSlip = () => {
    if (selectedGroups.length === 0 || dialogSelectedProducts.length === 0) {
      toast({ title: "Error", description: "Please select products to print slip", variant: "destructive" });
      return;
    }
    generateDispatchSlipPdf(buildSlipParties(), "dispatch-slip.pdf", { print: true });
  };

  const handleSaveDraft = async () => {
    if (!user?.username) {
      toast({ title: "User Error", description: "You must be logged in with a username to save drafts.", variant: "destructive" });
      return;
    }
    if (selectedGroups.length === 0) {
      toast({ title: "No Items Selected", description: "Please select at least one order group to save a draft.", variant: "destructive" });
      return;
    }
    const draftData = {
      loadData,
      confirmDetails,
      dialogSelectedProducts,
      driverName,
      driverData,
      totalPackingWeight: totalPackingWeightFromSku,
      combinedGroupKeys: selectedGroups.map((g: any) => g._rowKey),
      docRefDate,
    };

    setIsSavingDraft(true);
    try {
      // Save the same combined draft data under every selected group's key so
      // each order's draft is up to date, and any pre-existing individual drafts
      // are updated rather than left stale.
      const results = await Promise.all(
        selectedGroups.map((g: any) => draftApi.save(user.username, g._rowKey, draftData))
      );
      const allSuccess = results.every((r: any) => r.success);
      if (allSuccess) {
        toast({ title: "Draft Saved", description: "Your progress has been saved. You can resume later." });
      } else {
        toast({ title: "Save Failed", description: "Could not save draft.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Save Failed", description: error?.message || "Could not save draft.", variant: "destructive" });
    } finally {
      setIsSavingDraft(false);
    }
  };

  const performDispatchConfirmation = async () => {
    // ONLY IF DEPO IS BANARI — the Stage 7 weightment requirements below are optional for other depots
    const isBanari = selectedDepoTab?.toUpperCase() === 'BANARI';

    // Collect every validation issue up front so the user sees them all in one toast,
    // instead of fixing them one at a time across repeated submit attempts.
    const validationErrors: string[] = [];

    // Vehicle/transporter/documents/overload/interstate-permit are validated and
    // confirmed upstream at Plan Vehicle (Stage 5) — this stage only re-validates
    // what it actually collects: the Stage 7 weightment audit, the (still-editable)
    // driver, and the (still-editable) advance amounts.
    // Client spec (Stage 7): Actual Qty Loaded, Weighment Slip, Gross/Tare Weight and
    // Driver are required at EVERY depot (the spec names no depot).
    if (!loadData.actualQty || parseFloat(loadData.actualQty) <= 0) {
      validationErrors.push("Valid Actual Qty is required");
    }
    if (!loadData.weightmentSlip) {
      validationErrors.push("Weighment Slip upload is required");
    }
    // No Plate Image stays optional — not part of the Stage 7 spec's task list.
    if (!loadData.grossWeight || parseFloat(loadData.grossWeight) <= 0) {
      validationErrors.push("Valid Gross Weight is required");
    }
    if (!loadData.tareWeight || parseFloat(loadData.tareWeight) <= 0) {
      validationErrors.push("Valid Tare Weight is required");
    }
    if (!driverName.trim()) {
      validationErrors.push("Driver selection is required");
    }

    if (isBanari) {
      // Not in the spec — kept as-is for BANARI only.
      if (!loadData.rstNo.trim()) {
        validationErrors.push("RST No is required");
      }
      if (!loadData.checkStatus) {
        validationErrors.push("Quality Status (STG 7) is required");
      }
      // Reason mandatory ONLY if status is Reject
      if (loadData.checkStatus === "Reject" && !loadData.reason.trim()) {
        validationErrors.push("Weight Difference Reason is required for load rejection");
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

    await submitDispatch();
  }

  const submitDispatch = async () => {
    setIsProcessing(true)
    try {
      if (selectedGroups.length === 0 || dialogSelectedProducts.length === 0) {
        setIsDialogOpen(false);
        return;
      }

      const successfulDispatches: any[] = []
      const failedDispatches: any[] = []

      const itemsToProcess = selectedGroups.flatMap(g =>
        g._allProducts.filter((p: any) => dialogSelectedProducts.includes(p._rowKey))
      )

      // Empty string / NaN → undefined, so a sparse field is simply omitted
      // from the patch (never sent as a literal NaN, which Postgres rejects).
      const numOrUndef = (v: any): number | undefined => {
        if (v === "" || v === null || v === undefined) return undefined;
        const n = parseFloat(v);
        return isNaN(n) ? undefined : n;
      };

      // Submit each item as a single consolidated request
      for (const item of itemsToProcess) {
        const dispatchId = item.id;
        const dsrNumber = item.d_sr_number || item.dsrNumber; // display only
        const rowKey = item._rowKey;
        const confirmedQty = confirmDetails[rowKey]?.qty || item.qtyToDispatch;

        try {
          // v2-native camelCase payload (backend: services/actualDispatchService.js#submitActualDispatch)
          const payload = {
            actualQtyDispatch: numOrUndef(confirmedQty ?? item.qtyToDispatch),
            actualQty: numOrUndef(loadData.actualQty) ?? numOrUndef(confirmedQty),
            // Manually-entered Actual Dispatch Date (docRefDate, "YYYY-MM-DD").
            // Persisted as the source-of-truth dispatch date. Temporary until
            // historical dates are fully backfilled.
            actualDispatchDate: docRefDate || null,

            // Vehicle/transporter/documents/overload are no longer entered here —
            // they were confirmed at Plan Vehicle (Stage 5) and are left untouched
            // by this (sparse) patch. Driver stays editable at this stage.
            driverName: driverName || undefined,
            drivingLicenceNo: driverData.license_no || undefined,

            checkStatus: loadData.checkStatus || undefined,
            remarks: loadData.remarks || undefined,

            vehicleNoPlateImage: loadData.vehicleNoPlateImage || undefined,

            weightmentSlipCopy: loadData.weightmentSlip || undefined,
            rstNo: loadData.rstNo || undefined,
            grossWeight: numOrUndef(loadData.grossWeight),
            tareWeight: numOrUndef(loadData.tareWeight),
            netWeight: numOrUndef(loadData.netWeightPacking),
            extraWeight: numOrUndef(loadData.extraWeight),
            difference: numOrUndef(loadData.differanceWeight),

            reasonOfWeightDifference: loadData.reason || undefined,

            // Freight Rate Type/Amount are read-only reference at this stage —
            // omitted so this sparse patch leaves Plan Vehicle's values in place.
            // The 3 advance amounts stay editable and are always sent.
            advanceBhadaBank: numOrUndef(loadData.cash_bank),
            advanceBhadaDieselAdvance: numOrUndef(loadData.diesel_advance),
            advanceBhadaCash: numOrUndef(loadData.bhada),

            userId: user?.id || null, // Track acting user's login id
          };

          const res = await actualDispatchApi.submit(dispatchId, payload);

          if (!res.success) throw new Error(res.message);

          successfulDispatches.push({ item, dsrNumber });
        } catch (error: any) {
          console.error('[SUBMISSION ERROR] Details:', {
            dsrNumber,
            error: error,
            message: error?.message || (error?.response?.data?.message) || 'Unknown error'
          });
          failedDispatches.push({ item, error: error?.message || 'Unknown error', code: error?.code });
        }
      }

      // Show results
      if (successfulDispatches.length > 0) {
        toast({
          title: "Dispatch, Vehicle & Load Confirmed",
          description: `${successfulDispatches.length} item(s) processed through all stages successfully.`,
        });

        // Stock Transfer DOs are dispatched in one go — any sibling SKU left
        // unselected should vanish rather than stay pending for a later partial
        // dispatch (that behavior is only valid for regular Sales orders).
        const deselectedStockTransferDispatchIds = selectedGroups.flatMap((g: any) =>
          g._allProducts
            .filter((p: any) => !dialogSelectedProducts.includes(p._rowKey))
            .filter((p: any) => (p.order_category || "").toUpperCase() === "STOCK TRANSFER")
            .map((p: any) => p.id)
        ).filter(Boolean);

        if (deselectedStockTransferDispatchIds.length > 0) {
          try {
            await actualDispatchApi.cancelUnselected(deselectedStockTransferDispatchIds);
          } catch (error) {
            console.error('Failed to cancel unselected Stock Transfer SKUs', error);
          }
        }

        // Clean up drafts for all selected groups after successful submission
        if (selectedGroups.length > 0) {
          await Promise.all(
            selectedGroups.map((g: any) =>
              draftApi.delete(g._rowKey).catch(() => { })
            )
          );
        }

        setSelectedOrders([]);
        setIsDialogOpen(false);
        setConfirmDetails({});
        setSelectedGroups([]);
        setDialogSelectedProducts([]);

        await refetchPending();
        queryClient.invalidateQueries({ queryKey: ["actual-dispatch-history"] });

        // setTimeout(() => {
        //   router.push("/security-approval")
        // }, 1500)
      }

      // Stale-write conflicts: the row was already dispatched/moved by another user.
      // Refetch the pending list even if nothing succeeded so the phantom row vanishes.
      const staleWrites = failedDispatches.filter((f: any) => isStaleWriteError(f));
      const otherFailures = failedDispatches.filter((f: any) => !isStaleWriteError(f));

      if (staleWrites.length > 0) {
        toast({
          title: "Already processed",
          description: `${staleWrites.length} item(s) were already dispatched or moved by another user. Refreshing the list…`,
          variant: "destructive",
        })
        await refetchPending();
        queryClient.invalidateQueries({ queryKey: ["actual-dispatch-history"] });
      }

      if (otherFailures.length > 0) {
        toast({
          title: "Partial Success",
          description: `${otherFailures.length} item(s) failed during one of the stages.`,
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

      const successfulReverts = [];
      const failedReverts = [];

      for (const item of itemsToRevert) {
        const dispatchId = item.id;
        const dsrNumber = item.d_sr_number || item.dsrNumber; // display only
        if (!dispatchId) continue;

        try {
          const res = await actualDispatchApi.revert(dispatchId, user?.id || null, revertRemarks.trim());
          if (res.success) {
            successfulReverts.push(dsrNumber);
          } else {
            failedReverts.push({ dsrNumber, message: res.message });
          }
        } catch (err: any) {
          failedReverts.push({ dsrNumber, message: err.message });
        }
      }

      if (successfulReverts.length > 0) {
        toast({
          title: "Revert Successful",
          description: `${successfulReverts.length} item(s) reverted to Pre-Approval.`,
        });

        // Reset and refresh
        setIsDialogOpen(false);
        setSelectedOrders([]);
        setDialogSelectedProducts([]);
        setConfirmDetails({});
        setSelectedGroups([]);
        setRevertRemarks("");

        await refetchPending();
        queryClient.invalidateQueries({ queryKey: ["actual-dispatch-history"] });
      }

      if (failedReverts.length > 0) {
        // Surface the real reason (e.g. a stale-write conflict from another user)
        // instead of a generic count, so the user knows to refresh.
        const messages = Array.from(new Set(failedReverts.map((f) => f.message).filter(Boolean)));
        toast({
          title: successfulReverts.length > 0 ? "Partial Revert Failure" : "Revert Failed",
          description: messages[0] || `Failed to revert ${failedReverts.length} item(s).`,
          variant: "destructive",
        });
        // Refresh so rows already reverted/moved by another user drop off the stale list.
        if (successfulReverts.length === 0) {
          await refetchPending()
          queryClient.invalidateQueries({ queryKey: ["actual-dispatch-history"] });
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

  const handleRevertToDispatchPlanning = async () => {
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

      const successfulReverts = [];
      const failedReverts = [];

      for (const item of itemsToRevert) {
        const dispatchId = item.id;
        const dsrNumber = item.d_sr_number || item.dsrNumber; // display only
        if (!dispatchId) continue;

        try {
          const res = await actualDispatchApi.revertToDispatchPlanning(dispatchId, user?.id || null, revertRemarks.trim());
          if (res.success) {
            successfulReverts.push(dsrNumber);
          } else {
            failedReverts.push({ dsrNumber, message: res.message });
          }
        } catch (err: any) {
          failedReverts.push({ dsrNumber, message: err.message });
        }
      }

      if (successfulReverts.length > 0) {
        toast({
          title: "Revert Successful",
          description: `${successfulReverts.length} item(s) reverted to Dispatch Planning.`,
        });

        // Reset and refresh
        setIsDialogOpen(false);
        setSelectedOrders([]);
        setDialogSelectedProducts([]);
        setConfirmDetails({});
        setSelectedGroups([]);
        setRevertRemarks("");

        await refetchPending();
        queryClient.invalidateQueries({ queryKey: ["actual-dispatch-history"] });
      }

      if (failedReverts.length > 0) {
        // Surface the real reason (e.g. a stale-write conflict from another user)
        // instead of a generic count, so the user knows to refresh.
        const messages = Array.from(new Set(failedReverts.map((f) => f.message).filter(Boolean)));
        toast({
          title: successfulReverts.length > 0 ? "Partial Revert Failure" : "Revert Failed",
          description: messages[0] || `Failed to revert ${failedReverts.length} item(s).`,
          variant: "destructive",
        });
        // Refresh so rows already reverted/moved by another user drop off the stale list.
        if (successfulReverts.length === 0) {
          await refetchPending();
          queryClient.invalidateQueries({ queryKey: ["actual-dispatch-history"] });
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

  return (
    <WorkflowStageShell
      persistKey="actual-dispatch"
      title="Stage 7: Actual Dispatch"
      description="Confirm actual dispatch details before vehicle assignment."
      pendingCount={displayRows.length}
      historyData={[]}
      partyNames={filterOptions.customerNames}
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
          queryKeyPrefix="actual-dispatch-history"
          getHistoryApi={(params: any) => actualDispatchApi.getHistory({
            page: params.page,
            limit: params.limit,
            search: params.order_no,
            manual_sauda_no: filterValues.manualSaudaNo || undefined,
            do_date_from: params.start_date,
            do_date_to: params.end_date,
            party_name: params.customer_name,
            depo_names: selectedDepoTab ? [selectedDepoTab] : (user?.depo_access?.['Actual Dispatch'] || undefined),
          })}
          filterValues={filterValues}
          activeTab={activeTab}
          stageName="Actual Dispatch"
          stageLevel={4}
          remarksColName="Dispatch Confirmation"
          orderListKey="dispatches"
          mapOrderNo={(order: any) => order.so_no || "-"}
          mapCustomerName={(order: any) => (order.transfer === 'yes' && order.bill_company_name) ? order.bill_company_name : order.party_name}
          getDate={(order: any) => order.actual_1 || order.timestamp || null}
        />
      }
    >
      <div className="space-y-4">
        <StageActionBar>
          <Button
            onClick={() => handleOpenDialog()}
            disabled={selectedOrders.length === 0}
            className="h-9 text-xs font-black uppercase tracking-tight"
            title={isReadOnly ? "View Dispatch Details" : "Confirm Dispatch"}
          >
            Confirm Dispatch ({selectedOrders.length})
          </Button>
                </StageActionBar>

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

        <Card className="border border-slate-200/80 shadow-xs overflow-hidden py-0 gap-0 stage-card">
          <StageListHeader
            title="Pending Dispatches"
            shown={sortedDisplayRows.length}
            total={displayRows.length}
            description="Confirm actual dispatch details before vehicle assignment"
            searchValue={quickSearch}
            onSearchChange={setQuickSearch}
            searchPlaceholder="Search DO, Customer, Product..."
          >
            <StageToolbar
              shown={sortedDisplayRows.length}
              total={displayRows.length}
              activeCount={activeFiltersCount}
              onReset={clearAllTableFilters}
              filters={
                <>
                  <StageSegmented
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={[
                      { value: "ALL", label: "All" },
                      { value: "GATE_IN", label: "Gate In" },
                      { value: "READY", label: "Ready" },
                      { value: "DRAFT", label: "Draft" },
                    ]}
                  />
                  <StageFilterSelect value={oilFilter} onChange={setOilFilter} allLabel="All Oils" options={uniqueOilTypes} />
                  <StageFilterSelect value={customerFilter} onChange={setCustomerFilter} allLabel="All Customers" options={uniqueCustomerNames} />
                  <StageColumnsMenu
                    columns={PAGE_COLUMNS}
                    visibleColumns={visibleColumns}
                    setVisibleColumns={setVisibleColumns}
                    show={isAdmin || isFeatureEnabled('can_toggle_columns')}
                  />
                </>
              }
            />
            <StageActiveChips
              chips={[
                ...(statusFilter !== "ALL" ? [{ label: `Status: ${statusLabel(statusFilter)}`, onClear: () => setStatusFilter("ALL") }] : []),
                ...(oilFilter !== "ALL" ? [{ label: `Oil: ${oilFilter}`, onClear: () => setOilFilter("ALL") }] : []),
                ...(customerFilter !== "ALL" ? [{ label: `Customer: ${customerFilter}`, onClear: () => setCustomerFilter("ALL") }] : []),
                ...(quickSearch.trim() ? [{ label: `Search: ${quickSearch.trim()}`, onClear: () => setQuickSearch("") }] : []),
              ]}
            />
          </StageListHeader>
          <CardContent className="p-0">
          {/* Desktop Table View */}
          <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader className="bg-slate-50 border-b">
              <TableRow>
                <TableHead className="w-12 text-left align-top py-2.5 px-4">
                  <div className="mt-8 flex justify-start">
                    <Checkbox
                      checked={sortedDisplayRows.length > 0 && sortedDisplayRows.every((row) => selectedOrders.includes(row._rowKey))}
                      onCheckedChange={toggleSelectAll}
                    />
                  </div>
                </TableHead>
                <ColumnDragProvider columnIds={orderedVisibleCols.map(c => c.id)} onReorder={handleColumnReorder} disabled={!isAdmin && !isFeatureEnabled('can_reorder_columns')}>
                  {tableCols.map((col) => (
                    <StageHeadCell key={col.id} col={col} table={table} align={RIGHT_COLS.includes(col.id) ? "right" : "left"} width={colWidth(col.id)} />
                  ))}
                </ColumnDragProvider>

              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedDisplayRows.length > 0 && (
                <StageTotalsRow
                  columns={[{ id: "__select", label: "" }, ...tableCols]}
                  totals={table.totals}
                  count={sortedDisplayRows.length}
                  labelColumnId={tableCols[0]?.id}
                  unit=""
                  format={(n, id) => n.toFixed(id === "totalWithGst" ? 2 : 4)}
                  tones={{ qtyToDispatch: "blue", orderQty: "purple", approvalQty: "emerald", altQty: "amber", totalWithGst: "default" }}
                  align={Object.fromEntries([["__select", "center" as const], ...tableCols.map(c => [c.id, (RIGHT_COLS.includes(c.id) ? "right" : "left") as "right" | "left"])])}
                />
              )}
              {isPendingLoading && pendingOrders.length === 0 ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i} className="opacity-40 border-b border-slate-50">
                    <TableCell className="px-4 text-left py-4"><div className="h-4 w-4 bg-slate-200 animate-pulse rounded" /></TableCell>
                    {orderedVisibleCols.map(col => (
                      <TableCell key={col.id} className="py-4">
                        <div className={cn(
                          "h-3 bg-slate-200 animate-pulse rounded-full",
                          col.id === 'customerName' ? "w-32" : col.id === 'orderNo' ? "w-24" : "w-16"
                        )} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : sortedDisplayRows.length > 0 ? (
                sortedDisplayRows.map((row) => {
                  const rowKey = row._rowKey;
                  return (
                    <TableRow key={rowKey} className={selectedOrders.includes(rowKey) ? "bg-blue-50/50" : ""}>
                      <TableCell className="px-4 text-left">
                        <Checkbox
                          checked={selectedOrders.includes(rowKey)}
                          onCheckedChange={() => toggleSelectOrder(rowKey)}
                        />
                      </TableCell>
                      {orderedVisibleCols.map((col) => (
                        <TableCell key={col.id} className={cn(
                          "whitespace-nowrap text-xs px-4",
                          RIGHT_COLS.includes(col.id) ? "text-right tabular-nums" : "text-left",
                          [...NUMERIC_COLS, ...RATE_COLS].includes(col.id) && "font-mono",
                          colWidth(col.id),
                          col.id === 'orderNo' ? "text-blue-700 font-bold" : "text-slate-600"
                        )}>
                          {col.id === "status" ? (
                            <div className="flex items-center gap-2">
                              {row.has_draft ? (
                                <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200">Draft Saved</Badge>
                              ) : row.has_gate_in ? (
                                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">Ready for Dispatch</Badge>
                              ) : (
                                <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200">Ready for Gate In</Badge>
                              )}
                              {row._productCount > 1 && (
                                <span className="text-[10px] text-slate-500 font-medium">({row._productCount} Items)</span>
                              )}
                            </div>
                          ) : col.id === "qtyToDispatch" ? (
                            <span title={row._productCount > 1 ? "Total across products" : undefined}>{fmtNum(parseAmount(row.qtyToDispatch))}</span>
                          ) : (
                            formatCellValue(row, col.id)
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={tableCols.length + 1} className="text-center py-8 text-muted-foreground">
                    {displayRows.length > 0 ? "No matching records found for the applied filters" : "No orders pending for actual dispatch"}
                    {displayRows.length > 0 && (
                      <button onClick={clearAllTableFilters} className="block mx-auto text-xs text-blue-600 hover:underline mt-1 font-semibold">Clear Filters</button>
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden grid grid-cols-1 gap-4 p-4">
            {sortedDisplayRows.length > 0 ? (
              sortedDisplayRows.map((row) => {
                const rowKey = row._rowKey;
                return (
                  <Card key={rowKey} className={cn(
                    "p-4 border-2 transition-all shadow-sm flex flex-col gap-3",
                    selectedOrders.includes(rowKey) ? "border-blue-500 bg-blue-50/30" : "border-slate-100 bg-white"
                  )}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedOrders.includes(rowKey)}
                          onCheckedChange={() => toggleSelectOrder(rowKey)}
                          className="h-5 w-5"
                        />
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{row.partySoDate || row.date || "—"}</p>
                          <p className="font-mono text-sm font-black text-blue-700 break-all">{row.orderNo || "—"}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        {row.has_draft ? (
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[9px] uppercase font-black">Draft</Badge>
                        ) : row.has_gate_in ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[9px] uppercase font-black">Ready</Badge>
                        ) : (
                          <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[9px] uppercase font-black">Gate-In</Badge>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3 border-t pt-3 border-slate-100">
                      <div className="flex justify-between items-end">
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</p>
                          <p className="text-sm font-bold text-slate-800 capitalize leading-tight">{row.customerName || "—"}</p>
                        </div>
                        <div className="text-right space-y-1">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Qty to Dispatch</p>
                          <p className="text-sm font-black text-blue-600 font-mono tabular-nums">
                            {fmtNum(parseAmount(row.qtyToDispatch))}
                            {row._productCount > 1 && <span className="ml-1 text-[10px] text-slate-500">(Total {row._productCount})</span>}
                          </p>
                        </div>
                      </div>

                      {/* Dynamic columns selected by user */}
                      <div className="grid grid-cols-1 gap-y-3 pt-2">
                        {orderedVisibleCols.filter(col =>
                          !['orderNo', 'partySoDate', 'status', 'customerName', 'qtyToDispatch'].includes(col.id)
                        ).map(col => {
                          let val = formatCellValue(row, col.id);
                          if (col.id === 'revertSecurityRemarks') val = row.revertSecurityRemarks || row.revert_security_remarks || "—";
                          if (col.id === 'orderPunchRemarks') val = row.orderPunchRemarks || row.order_punch_remarks || "—";

                          return (
                            <div key={col.id} className="space-y-0.5 border-l-2 border-slate-100 pl-3">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{col.label}</p>
                              <p className="text-xs font-bold text-slate-700 leading-relaxed whitespace-pre-line">{val}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </Card>
                )
              })
            ) : (
              <div className="text-center py-12 text-slate-400 font-bold uppercase tracking-widest text-xs italic">
                {displayRows.length > 0 ? "No matching records found" : "No pending items available"}
                {displayRows.length > 0 && (
                  <button onClick={clearAllTableFilters} className="block mx-auto text-xs text-blue-600 hover:underline mt-2 font-semibold normal-case not-italic tracking-normal">Clear Filters</button>
                )}
              </div>
            )}
          </div>
          <StagePagination
            page={pendingPage}
            totalPages={pendingResult?.pagination?.totalPages || 1}
            total={displayRows.length}
            noun="Items"
            onPrev={() => setPendingPage(p => Math.max(1, p - 1))}
            onNext={() => setPendingPage(p => p + 1)}
            prevDisabled={pendingPage === 1 || displayRows.length === 0}
            nextDisabled={displayRows.length === 0 || pendingPage >= (pendingResult?.pagination?.totalPages || 1)}
          />
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:w-[95vw] sm:!max-w-[95vw] max-h-[95dvh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] p-0">
          <div className="p-4 sm:p-6 lg:p-8">
            <DialogHeader className="border-b pb-4 sm:pb-6 mb-4 sm:mb-6 pr-8">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <DialogTitle className="text-lg sm:text-xl lg:text-2xl font-black text-slate-900 tracking-tight flex flex-wrap items-start gap-3 leading-tight">
                  <Truck className="h-6 w-6 sm:h-7 sm:w-7 text-blue-600 shrink-0" />
                  Actual Dispatch Confirmation - {selectedGroups.length > 1 ? `${selectedGroups.length} Customer Groups` : selectedGroups[0]?.customerName}
                </DialogTitle>
                <Button
                  variant="outline"
                  onClick={() => setIsSlipDialogOpen(true)}
                  disabled={dialogSelectedProducts.length === 0}
                  className="border-blue-600 text-blue-600 hover:bg-blue-50 font-black h-9 shrink-0"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Slip
                </Button>
              </div>
              <DialogDescription className="text-slate-500 font-medium text-sm sm:text-base mt-2">
                Review and confirm dispatch quantities for selected customers.
              </DialogDescription>
            </DialogHeader>

            {/* Gate-In Status Banner */}
            <div className={`flex items-start sm:items-center gap-3 px-3 sm:px-5 py-3 rounded-xl mb-4 border-2 ${gateInData ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
              <button
                type="button"
                onClick={() => { if (gateInData) setIsGateInPopupOpen(true); }}
                className={`flex items-start sm:items-center gap-2 text-left font-black text-xs sm:text-sm uppercase tracking-tight ${gateInData ? 'text-emerald-700 cursor-pointer hover:underline' : 'text-slate-500 cursor-default'}`}
              >
                {gateInData
                  ? <><CheckCircle2 className="h-5 w-5 text-emerald-500" /> Gate-In Verified — Click to View Images</>
                  : <><Info className="h-5 w-5 text-slate-400" /> Gate-In Pending (After Slip Generation)</>
                }
              </button>
            </div>

            {/* TEMP: manual override for the expiry check while old Vehicle Master records
                get backfilled — remove this input and the docRefDate state once done. */}
            <div className="flex justify-end mb-4">
              <div className="flex items-center gap-2">
                <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest leading-none whitespace-nowrap">Actual Dispatch Date</Label>
                <Input
                  type="date"
                  className="h-8 text-[11px] border-slate-200 rounded-lg px-2 font-bold focus:border-purple-500 transition-colors bg-white"
                  value={docRefDate}
                  onChange={(e) => setDocRefDate(e.target.value)}
                />
              </div>
            </div>

            {/* Gate-In Images Popup */}
            {isGateInPopupOpen && gateInData && (
              <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60" onClick={() => setIsGateInPopupOpen(false)}>
                <div className="bg-white rounded-2xl shadow-2xl p-4 sm:p-8 max-w-2xl max-h-[90vh] overflow-y-auto w-full mx-4" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                      <CheckCircle2 className="h-6 w-6 text-emerald-500" /> Gate-In Images
                    </h3>
                    <button type="button" onClick={() => setIsGateInPopupOpen(false)} className="text-slate-400 hover:text-slate-700 text-2xl font-black">✕</button>
                  </div>
                  <div className="text-xs text-slate-500 font-semibold mb-4">
                    Submitted by <span className="text-slate-800">{gateInData.username}</span> on{" "}
                    {gateInData.submitted_at ? new Date(gateInData.submitted_at).toLocaleString("en-GB") : "—"}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: "Front Vehicle", url: gateInData.front_vehicle_image },
                      { label: "Back Vehicle", url: gateInData.back_vehicle_image },
                      { label: "Driver Photo", url: gateInData.driver_photo },
                      { label: "Gatepass Photo", url: gateInData.gatepass_photo },
                    ].map(img => (
                      <div key={img.label} className="flex flex-col items-center gap-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{img.label}</span>
                        {img.url ? (
                          <a href={img.url} target="_blank" rel="noopener noreferrer" className="w-full">
                            <img src={img.url} alt={img.label} className="w-full h-32 md:h-40 object-cover rounded-xl border-2 border-slate-200 hover:opacity-90 transition-opacity cursor-zoom-in shadow" />
                          </a>
                        ) : (
                          <div className="w-full h-32 md:h-40 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center text-xs text-slate-400 font-bold uppercase tracking-tighter">NO IMAGE</div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end mt-6">
                    <Button onClick={() => setIsGateInPopupOpen(false)} className="bg-emerald-600 hover:bg-emerald-700 font-black">
                      <CheckCircle2 className="h-4 w-4 mr-2" /> Confirm & Close
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {selectedGroups.length > 0 && (
              <div className="space-y-8 lg:space-y-12 mt-6">
                {/* 1. Multi-Customer Interleaved Details */}
                {selectedGroups.map((group, groupIdx) => {
                  return (
                    <div key={group._rowKey} className="space-y-6">
                      <h2 className="text-base sm:text-xl font-black text-blue-900 border-b-4 border-blue-100 pb-2 mt-4 uppercase tracking-tight flex flex-col sm:flex-row sm:items-center justify-between gap-2 break-words">
                        {group.customerName}
                        <Badge className="bg-blue-600 text-white ml-3 px-3 py-1 font-black">
                          {group._productCount} PRODUCTS
                        </Badge>
                      </h2>

                      {Object.entries(group._ordersMap).map(([baseDo, orderDetails]: [string, any], orderIdx) => {
                        const isExpanded = expandedOrders.includes(baseDo);
                        const toggleExpand = () => {
                          setExpandedOrders(prev => isExpanded ? prev.filter(id => id !== baseDo) : [...prev, baseDo]);
                        };

                        return (
                          <div key={baseDo} className="space-y-4 border-2 border-slate-100 rounded-xl sm:rounded-3xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
                            <div className="bg-blue-600 px-3 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer" onClick={toggleExpand}>
                              <div className="flex flex-wrap items-center gap-3 sm:gap-4 min-w-0">
                                <Badge className="bg-white text-blue-800 hover:bg-white px-3 sm:px-4 py-1.5 text-xs sm:text-base font-black tracking-tight rounded-full shadow-sm max-w-full whitespace-normal">
                                  ORDER: {baseDo}
                                </Badge>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-[10px] text-blue-100 font-black uppercase tracking-widest leading-none mb-1">Customer Group {groupIdx + 1} | Section {orderIdx + 1}</span>
                                  <span className="text-xs text-blue-100 font-bold leading-none">{orderDetails._products.length} Items Selected</span>
                                </div>
                              </div>
                              <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                                <div className="text-[10px] sm:text-[11px] text-blue-50 font-bold uppercase tracking-widest sm:mr-2">Click to {isExpanded ? 'Hide' : 'Show'} Details</div>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20 rounded-full">
                                  {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                                </Button>
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="px-3 sm:px-5 pb-5 animate-in slide-in-from-top-2 duration-200">
                                <div className="bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-inner">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Depo Name</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight">{orderDetails.depoName || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Delivery Purpose</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight">{orderDetails.deliveryPurpose}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Order Type</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight">{orderDetails.orderType}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Dates</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight">S: {formatDate(orderDetails.startDate)} | E: {formatDate(orderDetails.endDate)}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Delivery Date</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight">{formatDate(orderDetails.deliveryDate)}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">DO Date</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight">{orderDetails.partySoDate || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">RST No</p>
                                      {orderDetails.weightmentSlip || orderDetails.weightment_slip_copy ? (
                                        <a href={orderDetails.weightmentSlip || orderDetails.weightment_slip_copy} target="_blank" rel="noopener noreferrer" className="text-sm font-black text-blue-600 hover:text-blue-800 underline leading-tight">
                                          #{orderDetails.rstNo || orderDetails.rst_no || "—"}
                                        </a>
                                      ) : (
                                        <p className="text-sm font-bold text-slate-900 leading-tight">#{orderDetails.rstNo || orderDetails.rst_no || "—"}</p>
                                      )}
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Gross / Tare / Net</p>
                                      <p className="text-sm font-black text-slate-900 leading-tight">
                                        {orderDetails.grossWeight} / {orderDetails.tareWeight} / <span className="text-blue-600 font-black">{((Number(orderDetails.grossWeight || 0) - Number(orderDetails.tareWeight || 0)) || "0").toString()}</span>
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Weight Diff</p>
                                      <p className="text-sm font-black text-amber-600 leading-tight">{orderDetails.weightDiff}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Extra Weight</p>
                                      <p className="text-sm font-black text-purple-600 leading-tight">{orderDetails.extraWeight || orderDetails.extra_weight || "0"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Transport</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight">{orderDetails.transportType}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Contact Person</p>
                                      <p className="text-sm font-bold text-slate-900 truncate">{orderDetails.contactPerson || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">WhatsApp No.</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight">{orderDetails.whatsapp || "—"}</p>
                                    </div>
                                    <div className="col-span-1 sm:col-span-2">
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Address</p>
                                      <p className="text-sm font-bold text-slate-900 break-words" title={orderDetails.address}>{orderDetails.address}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Payment Terms</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight">{orderDetails.paymentTerms}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Advance Amount</p>
                                      <p className="text-base font-black text-blue-700 leading-tight">₹{orderDetails.advanceAmount || 0} {orderDetails.advanceTaken ? "(REQ)" : "(NO)"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Broker</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight">{orderDetails.isBroker ? orderDetails.brokerName : "No"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Credit Status</p>
                                      <Badge className={cn("text-[10px] font-bold px-2 py-0.5", orderDetails.partyCredit === 'Good' ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-red-100 text-red-700 hover:bg-red-100')}>
                                        {orderDetails.partyCredit}
                                      </Badge>
                                    </div>
                                    <div className="col-span-1 sm:col-span-2 bg-amber-50 p-4 rounded-xl border border-amber-100 flex items-start gap-4">
                                      <div className="bg-amber-100 p-2 rounded-lg">
                                        <Settings2 className="h-5 w-5 text-amber-600" />
                                      </div>
                                      <div>
                                        <p className="text-[11px] text-amber-800 font-black uppercase tracking-widest mb-1 leading-none">Order Punch Remarks</p>
                                        <p className="text-sm font-medium text-slate-700 italic leading-snug">"{group.orderPunchRemarks || "No special instructions provided."}"</p>
                                      </div>
                                    </div>
                                    <div className={cn(
                                      "col-span-1 sm:col-span-2 p-4 rounded-xl border flex items-start gap-4 transition-all duration-300",
                                      group.uploadSo
                                        ? "bg-blue-50 border-blue-100 hover:bg-blue-100 cursor-pointer group"
                                        : "bg-slate-50 border-slate-100 opacity-60"
                                    )}
                                      onClick={() => {
                                        if (group.uploadSo) {
                                          window.open(group.uploadSo, '_blank');
                                        }
                                      }}>
                                      <div className={cn(
                                        "p-2 rounded-lg",
                                        group.uploadSo ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-400"
                                      )}>
                                        <FileText className="h-5 w-5" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className={cn(
                                          "text-[11px] font-black uppercase tracking-widest mb-1 leading-none",
                                          group.uploadSo ? "text-blue-800" : "text-slate-500"
                                        )}>PO Copy (SO Upload)</p>
                                        {group.uploadSo ? (
                                          <div className="flex items-center gap-1">
                                            <p className="text-sm font-bold text-blue-700 truncate">View Attachment</p>
                                            <ExternalLink className="h-3 w-3 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                          </div>
                                        ) : (
                                          <p className="text-sm font-medium text-slate-400 italic">No attachment</p>
                                        )}
                                      </div>
                                    </div>

                                    <div className="col-span-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-200 mt-2">
                                      <div className="flex items-center gap-2">
                                        <div className={cn("w-2 h-2 rounded-full", orderDetails.weDealInSku ? 'bg-green-500' : 'bg-red-500')} />
                                        <span className="text-[10px] text-slate-600 font-bold uppercase tracking-tighter">We Deal SKU?</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <div className={cn("w-2 h-2 rounded-full", orderDetails.dispatchConfirmed ? 'bg-green-500' : 'bg-red-500')} />
                                        <span className="text-[10px] text-slate-600 font-bold uppercase tracking-tighter">Dispatch Confirmed?</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <div className={cn("w-2 h-2 rounded-full", orderDetails.overallStatus === 'Approved' ? 'bg-green-500' : 'bg-red-500')} />
                                        <span className="text-[10px] text-slate-600 font-bold uppercase tracking-tighter">Status: {orderDetails.overallStatus}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <div className={cn("w-2 h-2 rounded-full", orderDetails.orderConfirmation ? 'bg-green-500' : 'bg-red-500')} />
                                        <span className="text-[10px] text-slate-600 font-bold uppercase tracking-tighter">Cust. Confirmed?</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                {/* 2. Consolidated Product Table */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-slate-100 pb-4 gap-2">
                    <h3 className="text-base sm:text-xl font-black text-slate-800 flex flex-wrap items-center gap-2 uppercase tracking-tight">
                      Consolidated Product List
                      <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-sm px-3">{dialogSelectedProducts.length} / {selectedGroups.reduce((s, g) => s + g._allProducts.length, 0)} Items</Badge>
                    </h3>
                  </div>

                  <div className="border border-slate-200 rounded-xl sm:rounded-3xl overflow-hidden shadow-sm bg-white">
                    {/* Desktop Table View */}
                    <Table className="hidden xl:table">
                      <TableHeader className="bg-slate-50 sticky top-0 z-10 border-b">
                        <TableRow className="bg-slate-100/90 border-b-2 border-slate-300 font-bold text-xs text-slate-800 hover:bg-slate-100/90">
                          <TableCell className="px-4"></TableCell>
                          <TableCell className="px-4 text-left font-black text-slate-900 uppercase tracking-wider text-[11px]">
                            Total ({dialogSelectedProducts.length})
                          </TableCell>
                          <TableCell className="px-4"></TableCell>
                          <TableCell className="px-4"></TableCell>
                          <TableCell className="px-4"></TableCell>
                          <TableCell className="px-4"></TableCell>
                          <TableCell className="px-4"></TableCell>
                          <TableCell className="px-4 text-right font-mono tabular-nums font-black text-blue-700">
                            {fmtNum(selectedGroups.flatMap(g => g._allProducts)
                              .filter((p: any) => dialogSelectedProducts.includes(p._rowKey))
                              .reduce((sum: number, p: any) => sum + calculateGrossWeight(p.productName, confirmDetails[p._rowKey]?.qty || 0), 0))}
                          </TableCell>
                          <TableCell className="px-4"></TableCell>
                        </TableRow>
                        <TableRow className="bg-slate-50">
                          <TableHead className="w-12.5 text-left px-4">
                            <Checkbox
                              checked={dialogSelectedProducts.length > 0 && dialogSelectedProducts.length === selectedGroups.reduce((s, g) => s + g._allProducts.length, 0)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  const allKeys = selectedGroups.flatMap(g => g._allProducts.map((p: any) => p._rowKey));
                                  setDialogSelectedProducts(allKeys)
                                } else {
                                  setDialogSelectedProducts([])
                                }
                              }}
                            />
                          </TableHead>
                          <TableHead className="px-4 text-left">Customer / DO</TableHead>
                          <TableHead className="px-4 text-left">Product Name</TableHead>
                          <TableHead className="px-4 text-right min-w-[120px]">Planned Qty</TableHead>
                          <TableHead className="px-4 text-left">UOM</TableHead>
                          <TableHead className="px-4 text-left">Delivery From</TableHead>
                          <TableHead className="w-45 px-4 text-right min-w-[160px]">Actual Qty Dispatched</TableHead>
                          <TableHead className="w-30 px-4 text-right min-w-[130px]">Gross Weight (kg)</TableHead>
                          <TableHead className="px-4 text-left">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedGroups.flatMap(group => group._allProducts).map((prod: any) => {
                          const rowKey = prod._rowKey;
                          return (
                            <TableRow key={rowKey} className={cn(dialogSelectedProducts.includes(rowKey) ? "bg-blue-50/30" : "")}>
                              <TableCell className="text-left px-4 py-3">
                                <Checkbox
                                  checked={dialogSelectedProducts.includes(rowKey)}
                                  onCheckedChange={() => toggleSelectDialogProduct(rowKey)}
                                />
                              </TableCell>
                              <TableCell className="px-4 py-3 text-left">
                                <div className="flex flex-col">
                                  <span className="text-[9px] font-black text-blue-600 uppercase leading-none mb-1">{prod.customerName}</span>
                                  <span className="text-[10px] font-bold text-slate-700">{prod.orderNo || "—"}</span>
                                </div>
                              </TableCell>
                              <TableCell className="font-bold text-[11px] px-4 py-3 text-left text-slate-900">{prod.productName || "—"}</TableCell>
                              <TableCell className="text-[11px] font-black px-4 py-3 text-right font-mono tabular-nums text-blue-700 min-w-[120px]">
                                {fmtNum(prod.qtyToDispatch)}
                              </TableCell>
                              <TableCell className="text-[10px] font-bold px-4 py-3 text-left uppercase text-slate-500">{prod.uom || "—"}</TableCell>
                              <TableCell className="text-[10px] font-black px-4 py-3 uppercase text-slate-400 tracking-tighter text-left">{prod.deliveryFrom}</TableCell>
                              <TableCell className="px-4 py-3 min-w-[160px]">
                                <Input
                                  type="number"
                                  className="h-10 text-right font-mono tabular-nums text-xs font-black border-2 border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 transition-colors shadow-sm"
                                  placeholder="Actual Qty"
                                  value={confirmDetails[rowKey]?.qty || ""}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const planned = parseFloat(prod.qtyToDispatch || 0);
                                    if (parseFloat(val) > planned) {
                                      const isStockTransfer = (prod.order_category || "").toUpperCase() === "STOCK TRANSFER";
                                      if (isStockTransfer) {
                                        toast({
                                          title: "Warning",
                                          description: `Actual qty exceeds planned qty (${planned}). Allowed for Stock Transfer.`,
                                        });
                                      } else {
                                        toast({
                                          title: "Limit Exceeded",
                                          description: `Actual qty cannot be more than planned qty (${planned})`,
                                          variant: "destructive"
                                        });
                                        return;
                                      }
                                    }
                                    setConfirmDetails((prev) => ({
                                      ...prev,
                                      [rowKey]: {
                                        ...prev[rowKey],
                                        qty: val
                                      }
                                    }))
                                  }}
                                />
                              </TableCell>
                              <TableCell className="px-4 py-3 text-right min-w-[130px]">
                                <div className="font-mono tabular-nums font-black text-sm text-purple-700">
                                  {calculateGrossWeight(prod.productName, confirmDetails[rowKey]?.qty || prod.qtyToDispatch).toFixed(4)}
                                </div>
                              </TableCell>
                              <TableCell className="px-4 py-3 text-left">
                                <Badge variant="outline" className="text-[9px] bg-orange-50 text-orange-700 border-orange-200 uppercase font-black px-2 py-0.5">Pending</Badge>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>

                    {/* Mobile Card View for Products */}
                    <div className="xl:hidden divide-y divide-slate-100">
                      {selectedGroups.flatMap(group => group._allProducts).map((prod: any) => {
                        const rowKey = prod._rowKey;
                        const isSelected = dialogSelectedProducts.includes(rowKey);
                        const currentQty = confirmDetails[rowKey]?.qty || prod.qtyToDispatch || 0;
                        const weight = calculateGrossWeight(prod.productName, currentQty);

                        return (
                          <div key={rowKey} className={cn("p-4 space-y-4", isSelected ? "bg-blue-50/30" : "bg-white")}>
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleSelectDialogProduct(rowKey)}
                                className="mt-1"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest leading-none mb-1">{prod.customerName}</p>
                                <p className="text-[10px] font-bold text-slate-500 mb-2">{prod.orderNo || "—"}</p>
                                <p className="text-sm font-black text-slate-900 leading-tight">{prod.productName || "—"}</p>
                              </div>
                              <Badge variant="outline" className="text-[8px] bg-orange-50 text-orange-700 border-orange-200 uppercase font-black">Pending</Badge>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Planned Qty ({prod.uom || "UOM"})</p>
                                <p className="text-sm font-black text-blue-700 font-mono tabular-nums">{fmtNum(prod.qtyToDispatch)}</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Delivery From</p>
                                <p className="text-sm font-bold text-slate-600 uppercase tracking-tighter">{prod.deliveryFrom}</p>
                              </div>
                            </div>

                            <div className="space-y-1.5 pt-2 border-t border-slate-50">
                              <Label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Actual Qty Dispatched</Label>
                              <Input
                                type="number"
                                className="h-10 text-xs font-black border-2 border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500"
                                placeholder="Enter Qty"
                                value={confirmDetails[rowKey]?.qty || ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const planned = parseFloat(prod.qtyToDispatch || 0);
                                  if (parseFloat(val) > planned) {
                                    const isStockTransfer = (prod.order_category || "").toUpperCase() === "STOCK TRANSFER";
                                    if (isStockTransfer) {
                                      toast({
                                        title: "Warning",
                                        description: `Actual qty exceeds planned qty (${planned}). Allowed for Stock Transfer.`,
                                      });
                                    } else {
                                      toast({
                                        title: "Limit Exceeded",
                                        description: `Actual qty cannot be more than planned qty (${planned})`,
                                        variant: "destructive"
                                      });
                                      return;
                                    }
                                  }
                                  setConfirmDetails(prev => ({ ...prev, [rowKey]: { ...prev[rowKey], qty: val } }));
                                }}
                              />
                            </div>

                            <div className="grid grid-cols-1 gap-2 pt-2">
                              <div className="bg-purple-50 p-2 rounded-lg">
                                <p className="text-[8px] font-black text-purple-400 uppercase tracking-widest mb-0.5 text-left">Weight (kg)</p>
                                <p className="text-[10px] font-black text-purple-700 text-left font-mono tabular-nums">{weight.toFixed(4)}</p>
                              </div>
                            </div>
                          </div>
                        )
                      })}

                      {/* Mobile Totals Summary */}
                      <div className="p-4 bg-purple-50 border-t-2 border-purple-200 space-y-4">
                        <p className="text-xs font-black text-purple-900 uppercase tracking-widest text-left">Consolidated Totals</p>
                        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3">
                          <div className="bg-white/60 p-3 rounded-2xl border border-purple-100">
                            <p className="text-[9px] font-black text-purple-400 uppercase tracking-widest mb-1">Total Weight (kg)</p>
                            <p className="text-base font-black text-purple-700 leading-none font-mono tabular-nums">
                              {selectedGroups.flatMap(g => g._allProducts)
                                .filter((prod: any) => dialogSelectedProducts.includes(prod._rowKey))
                                .reduce((total, prod) => {
                                  const rowKey = prod._rowKey
                                  return total + calculateGrossWeight(prod.productName, confirmDetails[rowKey]?.qty || prod.qtyToDispatch)
                                }, 0).toFixed(4)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Consolidated Vehicle & Load Forms */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8 pt-6 lg:pt-8 border-t-4 border-slate-100">
                  {/* Column A: Vehicle Information */}
                  <div className="space-y-6">
                    <div className="bg-purple-600 px-4 sm:px-6 py-4 rounded-xl sm:rounded-3xl flex flex-wrap items-center justify-between gap-3 shadow-lg">
                      <div className="flex items-center gap-3">
                        <Truck className="h-6 w-6 text-white" />
                        <h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-tighter italic">Vehicle Setup</h3>
                      </div>
                      <Badge className="bg-white text-purple-700 font-black">STAGE 5</Badge>
                    </div>

                    <div className="bg-slate-50 border-2 border-slate-200 rounded-xl sm:rounded-3xl p-4 sm:p-6 space-y-6 shadow-md transition-all hover:shadow-lg">
                      <div className="grid grid-cols-1 gap-5 sm:gap-6">
                        {/* Read-only reference confirmed at Plan Vehicle (Stage 5) — vehicle,
                            transporter and documents are no longer re-entered/re-validated here. */}
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">
                            Vehicle &amp; Transporter (Confirmed at Plan Vehicle)
                          </Label>
                          {planVehicleInfo.confirmed ? (
                            <div className="space-y-2">
                              <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3">
                                <div className="bg-white border-2 border-slate-200 rounded-xl px-3 py-2 shadow-sm">
                                  <p className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1">Vehicle No.</p>
                                  <p className="text-sm font-black text-slate-800 uppercase leading-none">{planVehicleInfo.registrationNo || '---'}</p>
                                </div>
                                <div className="bg-white border-2 border-slate-200 rounded-xl px-3 py-2 shadow-sm">
                                  <p className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1">Transporter</p>
                                  <p className="text-sm font-black text-slate-800 uppercase leading-none">{planVehicleInfo.transporterName || '---'}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                                <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-tight">Documents verified at Plan Vehicle</p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 bg-amber-50 border-2 border-amber-200 rounded-xl px-3 py-3">
                              <XCircle className="h-4 w-4 text-amber-600 shrink-0" />
                              <p className="text-[11px] font-bold text-amber-700 uppercase tracking-tight">Vehicle plan not yet confirmed for this dispatch</p>
                            </div>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">
                            Driver Name <span className="text-red-500">*</span>
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
                                setDriverData({
                                  contact_no: "",
                                  license_no: "",
                                  license_type: "",
                                  valid_upto: "",
                                  trans_valid_upto: "",
                                  lmv_valid_upto: ""
                                });
                              }
                            }}
                            options={driverOptions}
                            placeholder="Select Driver"
                            searchPlaceholder="Search driver..."
                            emptyText="No driver found."
                            className="h-12 border-2 border-slate-200 rounded-xl px-3 sm:px-4 font-black text-sm sm:text-lg focus:border-purple-500 transition-colors uppercase bg-white shadow-sm"
                          />
                        </div>

                        {/* Driver Details Badges */}
                        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-2 mt-2">
                          <div className="bg-white border-2 border-slate-100 rounded-xl px-3 py-1.5 shadow-sm">
                            <p className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1">Contact</p>
                            <p className="text-[11px] font-black text-slate-700 uppercase leading-none">{driverData.contact_no || '---'}</p>
                          </div>
                          <div className="bg-white border-2 border-slate-100 rounded-xl px-3 py-1.5 shadow-sm">
                            <p className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1">License No</p>
                            <p className="text-[11px] font-black text-slate-700 uppercase leading-none">{driverData.license_no || '---'}</p>
                          </div>
                          <div className="bg-white border-2 border-slate-100 rounded-xl px-3 py-1.5 shadow-sm">
                            <p className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1">License Type</p>
                            <p className="text-[11px] font-black text-slate-700 uppercase leading-none">{driverData.license_type || '---'}</p>
                          </div>
                          <div className="bg-white border-2 border-slate-100 rounded-xl px-3 py-1.5 shadow-sm">
                            <p className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1">Valid Upto</p>
                            <p className="text-[11px] font-black text-slate-700 uppercase leading-none">{formatDate(driverData.valid_upto) || '---'}</p>
                          </div>
                          {/* Trans Valid Upto for Truck/Tanker/Pickup/Hiva/Trailer, LMV Valid Upto otherwise (review Section 10) */}
                          <div className="bg-white border-2 border-slate-100 rounded-xl px-3 py-1.5 shadow-sm">
                            <p className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1">
                              {['Truck', 'Tanker', 'Pickup', 'Hiva', 'Trailer'].includes(planVehicleType) ? 'Trans Valid Upto' : 'LMV Valid Upto'}
                            </p>
                            <p className="text-[11px] font-black text-slate-700 uppercase leading-none">
                              {formatDate(['Truck', 'Tanker', 'Pickup', 'Hiva', 'Trailer'].includes(planVehicleType) ? driverData.trans_valid_upto : driverData.lmv_valid_upto) || '---'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* --- REMOVED: Digital Documents (Stage 6) upload/expiry fields and the
                          vehicle-condition Check Status/Remarks below — all vehicle document
                          verification now happens exclusively at Plan Vehicle (Stage 5); see
                          the read-only summary card above. --- */}
                    </div>
                  </div>

                  {/* Column B: Material Load Details */}
                  <div className="space-y-6">
                    <div className="bg-blue-800 px-4 sm:px-6 py-4 rounded-xl sm:rounded-3xl flex flex-wrap items-center justify-between gap-3 shadow-lg">
                      <div className="flex items-center gap-3">
                        <Weight className="h-6 w-6 text-white" />
                        <h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-tighter italic">Weightment Audit</h3>
                      </div>
                      <Badge className="bg-white text-blue-800 font-black">STAGE 7</Badge>
                    </div>

                    <div className="bg-white border-2 border-slate-200 rounded-xl sm:rounded-3xl p-4 sm:p-6 space-y-5 shadow-md overflow-hidden relative group hover:shadow-lg transition-all">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter ml-1">Actual Qty <span className="text-red-500">*</span></Label>
                          <Input type="number" step="0.01" className="h-10 border-2 border-slate-200 rounded-lg font-bold bg-white focus:border-blue-500 transition-colors"
                            value={loadData.actualQty} onChange={(e) => setLoadData(p => ({ ...p, actualQty: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter ml-1">RST No <span className="text-red-500">*</span></Label>
                          <Input className="h-10 border-slate-200 rounded-lg font-bold"
                            value={loadData.rstNo} onChange={(e) => setLoadData(p => ({ ...p, rstNo: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter ml-1">Truck No</Label>
                          <Input className="h-10 border-slate-200 rounded-lg font-bold bg-slate-50 font-mono uppercase" value={loadData.truckNo || planVehicleInfo.registrationNo || ''} readOnly />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter ml-1 flex flex-col min-[380px]:flex-row min-[380px]:items-center justify-between gap-1">
                            Weightment Slip <span className="text-red-500">*</span> {loadData.weightmentSlip_file_name && <span className="text-blue-600 text-[8px] truncate max-w-20">({loadData.weightmentSlip_file_name})</span>}
                          </Label>
                          <FileUploadField
                            accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
                            value={loadData.weightmentSlip && loadData.weightmentSlip !== 'pending' ? loadData.weightmentSlip : null}
                            fileName={loadData.weightmentSlip_file_name}
                            helperText="Max file size: 20 MB"
                            uploading={isUploading === 'weightmentSlip'}
                            buttonText={loadData.weightmentSlip_file_name ? 'REPLACE' : 'UPLOAD'}
                            onRemove={() => setLoadData(p => ({ ...p, weightmentSlip: "", weightmentSlip_file_name: "" }))}
                            onFilesSelected={(files) => handleFileChange('weightmentSlip', 'weightmentSlip_file_name', files[0] || null)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter ml-1 flex flex-col min-[380px]:flex-row min-[380px]:items-center justify-between gap-1">
                            No Plate Image <span className="text-slate-400 font-normal normal-case">(Optional)</span> {loadData.vehicleNoPlateImage_file_name && <span className="text-blue-600 text-[8px] truncate max-w-20">({loadData.vehicleNoPlateImage_file_name})</span>}
                          </Label>
                          <FileUploadField
                            accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
                            value={loadData.vehicleNoPlateImage && loadData.vehicleNoPlateImage !== 'pending' ? loadData.vehicleNoPlateImage : null}
                            fileName={loadData.vehicleNoPlateImage_file_name}
                            helperText="Max file size: 20 MB"
                            uploading={isUploading === 'vehicleNoPlateImage'}
                            buttonText={loadData.vehicleNoPlateImage_file_name ? 'REPLACE' : 'UPLOAD'}
                            onRemove={() => setLoadData(p => ({ ...p, vehicleNoPlateImage: "", vehicleNoPlateImage_file_name: "" }))}
                            onFilesSelected={(files) => handleFileChange('vehicleNoPlateImage', 'vehicleNoPlateImage_file_name', files[0] || null)}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter ml-1">Gross Wt <span className="text-red-500">*</span></Label>
                          <Input type="number" step="0.01" className="h-10 border-slate-200 rounded-lg font-bold text-blue-600"
                            value={loadData.grossWeight} onChange={(e) => setLoadData(p => ({ ...p, grossWeight: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-500 tracking-tighter ml-1">Tare Wt <span className="text-red-500">*</span></Label>
                          <Input type="number" step="0.01" className="h-10 border-slate-200 rounded-lg font-bold"
                            value={loadData.tareWeight} onChange={(e) => setLoadData(p => ({ ...p, tareWeight: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-500 tracking-tighter ml-1">Net Weight</Label>
                          <Input type="number" step="0.01" readOnly className="h-10 border-2 border-slate-200 rounded-lg font-bold bg-slate-50"
                            value={loadData.netWeightPacking} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-500 tracking-tighter ml-1">Difference</Label>
                          <Input type="number" readOnly className={`h-10 border-2 rounded-lg font-bold ${Math.abs(parseFloat(loadData.differanceWeight) || 0) > 20 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}
                            value={loadData.differanceWeight} />
                        </div>
                      </div>

                      <div className="pt-4 border-t-2 border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-500 tracking-tighter ml-1">Total Items Gross Weight</Label>
                          <Input readOnly className="h-10 border-slate-200 rounded-lg font-bold bg-slate-50" value={totalPackingWeightFromSku.toFixed(4)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-500 tracking-tighter ml-1">Extra packing material weight</Label>
                          <Input type="number" step="0.001" className="h-10 border-2 border-slate-200 rounded-lg font-bold bg-white focus:border-blue-500 transition-colors"
                            placeholder="0.000"
                            value={loadData.extraWeight} onChange={(e) => setLoadData(p => ({ ...p, extraWeight: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-500 tracking-tighter ml-1">Total Weight</Label>
                          <Input readOnly className="h-10 border-slate-200 rounded-lg font-bold bg-blue-50 text-blue-700" value={totalCombinedWeight.toFixed(4)} />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1 italic font-serif leading-none">Status (STG 7) <span className="text-red-500">*</span></Label>
                          <Select value={loadData.checkStatus} onValueChange={(v) => setLoadData(p => ({ ...p, checkStatus: v }))}>
                            <SelectTrigger className="h-10 border-2 border-slate-200 rounded-xl font-bold bg-white">
                              <SelectValue placeholder="Decision" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Accept">Approved Quality</SelectItem>
                              <SelectItem value="Reject">Reject Load</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Freight Rate Type/Amount: read-only reference confirmed at Plan
                          Vehicle — not editable here, only the advance amounts below are. */}
                      {planVehicleInfo.transporterName && !['Company Vehicle', 'Party Vehicle'].includes(planVehicleInfo.transporterName) && (
                        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1 italic font-serif leading-none">Freight Rate Type</Label>
                              <div className="h-10 flex items-center px-3 border-2 border-slate-200 rounded-xl font-bold bg-slate-50 text-slate-700">
                                {planVehicleInfo.freightRateType || '---'}
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1 italic font-serif leading-none">
                                {planVehicleInfo.freightRateType === 'Bhada Rate' ? 'Bhada Rate (Per MT)' : 'Fixed Bhada Amount'}
                              </Label>
                              <div className="h-10 flex items-center px-3 border-2 border-slate-200 rounded-xl font-bold bg-slate-50 text-slate-700">
                                {planVehicleInfo.freightAmount != null ? `₹${planVehicleInfo.freightAmount}` : '---'}
                              </div>
                            </div>
                          </div>

                          {/* Advance Bhada Section */}
                          <div className="space-y-4 pt-4 border-t-2 border-slate-100">
                            <div className="flex items-center gap-2">
                              <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 font-black px-3">Advance Bhada</Badge>
                              <div className="h-px flex-1 bg-slate-100" />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Bank</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  className="h-10 border-2 border-slate-200 rounded-lg font-bold bg-white focus:border-blue-500 transition-all"
                                  placeholder="0.00"
                                  value={loadData.cash_bank}
                                  onChange={(e) => setLoadData(p => ({ ...p, cash_bank: e.target.value }))}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Diesel Advance</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  className="h-10 border-2 border-slate-200 rounded-lg font-bold bg-white focus:border-blue-500 transition-all"
                                  placeholder="0.00"
                                  value={loadData.diesel_advance}
                                  onChange={(e) => setLoadData(p => ({ ...p, diesel_advance: e.target.value }))}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Cash Advance</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  className="h-10 border-2 border-slate-200 rounded-lg font-bold bg-white focus:border-blue-500 transition-all"
                                  placeholder="0.00"
                                  value={loadData.bhada}
                                  onChange={(e) => setLoadData(p => ({ ...p, bhada: e.target.value }))}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1 italic font-serif leading-none">
                            Weight Difference Reason {Math.abs(parseFloat(loadData.differanceWeight) || 0) > 20 ? <span className="text-red-500">* (Required)</span> : <span className="text-slate-400 font-normal normal-case">(Optional)</span>}
                          </Label>
                          <Input
                            className={`h-10 rounded-lg font-medium bg-white ${Math.abs(parseFloat(loadData.differanceWeight) || 0) > 20 ? 'border-2 border-red-400 focus:border-red-500' : 'border-slate-200'}`}
                            placeholder={Math.abs(parseFloat(loadData.differanceWeight) || 0) > 20 ? "Required: explain weight difference..." : "Specify reason..."}
                            value={loadData.reason} onChange={(e) => setLoadData(p => ({ ...p, reason: e.target.value }))} />
                        </div>
                        {/* Overload is validated exclusively at Plan Vehicle (Stage 5) now — no
                            re-check/alert here. */}
                      </div>
                    </div>
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
                  className="h-10 border-2 border-red-200 rounded-lg font-medium bg-white focus:border-red-400 transition-colors"
                  disabled={isReadOnly}
                  placeholder="Enter reason for reverting..."
                  value={revertRemarks}
                  onChange={(e) => setRevertRemarks(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                onClick={handleRevertToDispatchPlanning}
                disabled={isProcessing || dialogSelectedProducts.length === 0 || isReadOnly || !revertRemarks.trim()}
                className="font-black uppercase tracking-tight h-10 px-6 border-amber-500 text-amber-600 hover:bg-amber-50"
              >
                {isProcessing ? "Wait..." : `Revert to Dispatch Planning (${dialogSelectedProducts.length})`}
              </Button>
              <Button
                variant="destructive"
                onClick={handleRevert}
                disabled={isProcessing || dialogSelectedProducts.length === 0 || isReadOnly || !revertRemarks.trim()}
                className="font-black uppercase tracking-tight h-10 px-6"
              >
                {isProcessing ? "Wait..." : `Revert to Pre-Approval (${dialogSelectedProducts.length})`}
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:flex sm:justify-end gap-3 w-full">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="order-last sm:order-none">Cancel</Button>
              <Button
                variant="outline"
                onClick={handleSaveDraft}
                disabled={isSavingDraft || isProcessing || (selectedDepoTab?.toUpperCase() === 'BANARI' && (!planVehicleInfo.confirmed || !driverName.trim()))}
                className="border-amber-300 text-amber-700 hover:bg-amber-50 font-semibold h-11 sm:h-10"
              >
                {isSavingDraft ? "Saving..." : "Save Draft"}
              </Button>
              <Button
                onClick={performDispatchConfirmation}
                disabled={isProcessing || dialogSelectedProducts.length === 0 || isReadOnly}
                className="h-11 sm:h-10 font-black bg-blue-600 hover:bg-blue-700"
              >
                {isProcessing ? "Wait..." : `Confirm Dispatch (${dialogSelectedProducts.length})`}
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
                <p className="mb-2">The following documents are missing or expired. You can still continue with the dispatch.</p>
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
                submitDispatch();
              }}
            >
              Continue Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Slip Dialog */}
      <Dialog open={isSlipDialogOpen} onOpenChange={setIsSlipDialogOpen}>
        <DialogContent className="max-w-4xl sm:max-w-4xl md:max-w-5xl lg:max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dispatch Slip Preview</DialogTitle>
            <DialogDescription>Review the dispatch slip details below.</DialogDescription>
          </DialogHeader>

          <div className="bg-slate-50 p-4 rounded-lg overflow-x-auto">
            {renderSlipContent()}
          </div>

          <DialogFooter className="flex flex-col sm:flex-row justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setIsSlipDialogOpen(false)} className="sm:order-first">Close</Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handlePrintSlip}
                className="border-blue-600 text-blue-600 hover:bg-blue-50"
              >
                <Printer className="mr-2 h-4 w-4" /> Print Slip
              </Button>
              <Button
                onClick={handleDownloadSlip}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Download className="mr-2 h-4 w-4" /> Download PDF
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkflowStageShell>
  );
}
