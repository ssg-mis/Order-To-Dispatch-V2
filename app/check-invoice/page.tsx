"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { WorkflowStageShell } from "@/components/workflow/workflow-stage-shell"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CheckCircle, Settings2, Eye, FileText, ExternalLink, ArrowUpDown, ArrowUp, ArrowDown, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Printer } from "lucide-react"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { WORKFLOW_STAGE_COLUMNS as ALL_COLUMNS } from "@/lib/workflow-columns"
import { ColumnToggleContent } from "@/components/ui/column-toggle-content"
import { checkInvoiceApi, skuApi, depotApi } from "@/lib/api-service"
import { isStaleWriteError } from "@/lib/stale-write"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { fmtNum, fmtDate } from "@/lib/table-format"
import { useAuth } from "@/hooks/use-auth"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { StageHistoryTab } from "@/components/workflow/stage-history-tab"
import { usePersistedColumns } from "@/hooks/use-persisted-columns"
import { useColumnOrder } from "@/hooks/use-column-order"
import { SortableTableHead } from "@/components/ui/sortable-table-head"
import { ColumnDragProvider } from "@/components/ui/column-drag-provider"
import { usePersistedFilters } from "@/hooks/use-persisted-filters"
import { useStageTable, type StageColDef } from "@/hooks/use-stage-table"
import { StageListHeader, StageToolbar, StageSegmented, StageFilterSelect, StageColumnsMenu, StageDivider, StageActiveChips, StageHeadCell, StageTotalsRow, StageActionBar, StagePagination } from "@/components/stage-list"

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Chandigarh", "Puducherry",
  "Andaman and Nicobar Islands", "Dadra and Nagar Haveli", "Daman and Diu", "Lakshadweep",
]

function extractState(addr: string): string | null {
  if (!addr) return null
  const lower = addr.toLowerCase()
  for (const s of INDIAN_STATES) {
    if (lower.includes(s.toLowerCase())) return s
  }
  return null
}

function InvoiceSummary({ selectedGroups, selectedProducts }: {
  selectedGroups: any[]
  selectedProducts: string[]
}) {
  const selProds = selectedGroups.flatMap((g) => g._allProducts)
    .filter((p) => selectedProducts.includes(p._rowKey))

  const firstProd = selProds[0]
  const firstGroup = selectedGroups[0]
  const firstOrderDetails: any = Object.values(firstGroup?._ordersMap || {})[0] || {}
  const depoName = (firstOrderDetails?.depoName && firstOrderDetails.depoName !== "—")
    ? firstOrderDetails.depoName
    : (firstProd?.depo_name || "")
  const shippingAddr = firstProd?.customer_address || ""

  const shippingState = extractState(shippingAddr) || ""

  // Company/billing state comes from the DEPOT master record's own address (state field)
  const { data: billingRes } = useQuery({
    queryKey: ['billing-depot-state', depoName],
    queryFn: () => depotApi.getAll({ search: depoName, all: "true" }),
    enabled: !!depoName,
    staleTime: 10 * 60 * 1000,
  })
  const billingDepots: any[] = billingRes?.data?.depots || []
  const billingDepot = billingDepots.find((d: any) =>
    d.depot_name?.toLowerCase() === depoName.toLowerCase()
  ) || billingDepots[0]
  const billingState = billingDepot?.state || ""

  const totalTaxable = selProds.reduce((sum, p) => {
    const rate = Number(p.rate) || 0
    const rateWoGst = parseFloat((rate / 1.05).toFixed(2))
    return sum + (rateWoGst * (parseFloat(p.actualQty) || 0))
  }, 0)

  const missingBilling = !billingState
  const missingShipping = !shippingState
  let gstType = "same"
  let cgst = Math.round(totalTaxable * 0.025 * 100) / 100
  let sgst = cgst
  let igst = 0

  if (missingBilling || missingShipping) {
    gstType = "no_address"
    cgst = 0
    sgst = 0
  } else if (billingState.trim().toLowerCase() === shippingState.trim().toLowerCase()) {
    gstType = "same"
  } else {
    gstType = "different"
    cgst = 0
    sgst = 0
    igst = Math.round(totalTaxable * 0.05 * 100) / 100
  }

  const rawTotal = totalTaxable + cgst + sgst + igst
  const invoiceTotal = Math.round(rawTotal)
  const roundOff = parseFloat((invoiceTotal - rawTotal).toFixed(2))

  return (
    <div className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">GST Breakdown</p>
      </div>
      <div className="p-4 max-w-sm ml-auto space-y-2">
        <div className="flex justify-between items-center text-xs">
          <span className="font-black uppercase text-slate-500 text-[10px]">CGST (2.5%)</span>
          <span className="font-mono font-bold text-slate-700">{gstType === "same" ? `₹${cgst.toFixed(2)}` : "—"}</span>
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="font-black uppercase text-slate-500 text-[10px]">SGST (2.5%)</span>
          <span className="font-mono font-bold text-slate-700">{gstType === "same" ? `₹${sgst.toFixed(2)}` : "—"}</span>
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="font-black uppercase text-slate-500 text-[10px]">IGST (5%)</span>
          <span className="font-mono font-bold text-slate-700">{gstType === "different" ? `₹${igst.toFixed(2)}` : "—"}</span>
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="font-black uppercase text-slate-500 text-[10px]">Round Off</span>
          <span className="font-mono font-bold text-slate-500">
            {roundOff > 0 ? `+₹${roundOff.toFixed(2)}` : roundOff < 0 ? `-₹${Math.abs(roundOff).toFixed(2)}` : `₹0.00`}
          </span>
        </div>
        <div className="flex justify-between items-center border-t border-slate-200 pt-2">
          <span className="font-black uppercase text-slate-800 text-[11px]">Total Invoice Amount</span>
          <span className="font-mono font-black text-blue-700 text-sm">₹{invoiceTotal.toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}

// Table standard: numeric + date columns right aligned, units in headings, plain fixed decimals.
const NUM_DECIMALS: Record<string, number> = {
  products: 0,
  actual_qty_dispatch: 4, orderQty: 4, qtyToDispatch: 4, actual_qty: 4, actual_approval_qty: 4, altQty: 4, damage_qty: 4,
  gross_weight: 4, tare_weight: 4, net_weight: 4, extra_weight: 4,
  rate: 2, ratePerLtr: 2, ratePer15Kg: 2, rateOfMaterial: 2, totalWithGst: 2, advanceAmount: 2, bill_amount: 2,
}
const DATE_COL_IDS = new Set(["partySoDate", "actual1Date", "deliveryDate", "invoice_date", "dispatch_date_confirmed", "fitness_end_date", "insurance_end_date", "tax_end_date", "pollution_end_date", "permit1_end_date", "permit2_end_date"])
const MONEY_HEAD_IDS = new Set(["rate", "ratePerLtr", "ratePer15Kg", "rateOfMaterial", "totalWithGst", "advanceAmount", "bill_amount"])
const isRightCol = (id: string) => id in NUM_DECIMALS || DATE_COL_IDS.has(id)
const fmtCell = (id: string, v: any) => {
  if (v === "—" || v === null || v === undefined || v === "") return "—"
  if (id in NUM_DECIMALS) return fmtNum(v, NUM_DECIMALS[id])
  if (DATE_COL_IDS.has(id)) return fmtDate(v)
  return String(v)
}
const colLabel = (id: string, label: string) => (MONEY_HEAD_IDS.has(id) ? `${label} (₹)` : label)

function getDynamicColumnValue(group: any, colId: string) {
  const directValue = group?.[colId]
  if (directValue !== undefined && directValue !== null && directValue !== "") return directValue

  const firstProduct = group?._allProducts?.[0] || {}
  const firstOrder = Object.values(group?._ordersMap || {})[0] || {}

  const orderValue = (firstOrder as any)?.[colId]
  if (orderValue !== undefined && orderValue !== null && orderValue !== "") return orderValue

  const productValue = (firstProduct as any)?.[colId]
  if (productValue !== undefined && productValue !== null && productValue !== "") return productValue

  return "—"
}

export default function CheckInvoicePage() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const { toast } = useToast()
  const { isReadOnly, user, isAdmin, isFeatureEnabled } = useAuth()
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending")

  const [filterValues, setFilterValues] = useState({
    status: "",
    startDate: "",
    endDate: "",
    partyName: "",
    search: "",
    manualSaudaNo: ""
  })
  const [isProcessing, setIsProcessing] = useState(false)
  const formatDate = (dateStr: string) => {
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
  };

  const renderDocumentLink = (value: string) => {
    if (!value || value === "—") return <p className="text-xs font-bold text-slate-400 leading-none">NOT UPLOADED</p>;
    
    // Check if it's a URL
    if (String(value).startsWith('http')) {
      return (
        <a 
          href={value} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1 bg-violet-50 text-violet-700 rounded-lg hover:bg-violet-100 transition-all border border-violet-200 w-fit group shadow-sm mt-0.5"
        >
          <FileText className="h-3 w-3 group-hover:scale-110 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-tight">VIEW PHOTO</span>
        </a>
      );
    }
    
    return <p className="text-xs font-bold text-slate-700 leading-none">{formatDate(value)}</p>;
  };

  const renderPartyDetailLink = (docUrl: string | null | undefined, expiryDate: string | null | undefined) => {
    const formattedDate = formatDate(expiryDate ?? '');

    if (docUrl && String(docUrl).startsWith('http')) {
      return (
        <a 
          href={docUrl} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-xs font-bold text-blue-600 hover:text-blue-800 underline transition-all"
        >
          {formattedDate !== "—" ? formattedDate : "View Document"}
        </a>
      );
    }

    if (formattedDate !== "—") {
      return <span className="text-xs font-bold text-slate-700">{formattedDate}</span>;
    }

    return <span className="text-[10px] text-slate-400">—</span>;
  };

  const [visibleColumns, setVisibleColumns] = usePersistedColumns(
    "check-invoice",
    ["partySoDate", "orderNo", "processid", "customerName", "vehicleNo", "orderPunchRemarks", "invoiceNo", "status", "products"]
  )
  const CHECK_INV_STD_IDS = ["partySoDate", "orderNo", "processid", "customerName", "actual1Date", "invoiceNo", "vehicleNo", "orderPunchRemarks", "status", "products"]
  const [columnOrder, setColumnOrder] = useColumnOrder("check-invoice", [...CHECK_INV_STD_IDS, ...ALL_COLUMNS.map(c => c.id).filter(id => !CHECK_INV_STD_IDS.includes(id))])
  const ALWAYS_VISIBLE_CHECK_INV = new Set<string>([])
  const orderedVisible = columnOrder.filter(id => ALWAYS_VISIBLE_CHECK_INV.has(id) || visibleColumns.includes(id))
  const dynamicColumns = visibleColumns.filter(id => !CHECK_INV_STD_IDS.includes(id))
  const handleColumnReorder = useCallback((newVisibleOrder: string[]) => {
    const newOrderSet = new Set(newVisibleOrder)
    const hiddenCols = columnOrder.filter(id => !newOrderSet.has(id))
    setColumnOrder([...newVisibleOrder, ...hiddenCols])
  }, [columnOrder, setColumnOrder])

  // SKU weight lookup
  const { data: skuDetailsData } = useQuery({
    queryKey: ["sku-details-all"],
    queryFn: async () => {
      const res = await skuApi.getAll({ all: "true" })
      return res.success ? res.data?.skuDetails ?? [] : []
    },
    staleTime: 5 * 60 * 1000,
  })
  const skuWeightMap = useMemo(() => {
    const map = new Map<string, string>()
    if (Array.isArray(skuDetailsData)) {
      for (const sku of skuDetailsData) {
        if (sku.sku_name) {
          const weight = sku.sku_weight ?? ""
          map.set(sku.sku_name.trim().toLowerCase(), weight ? String(weight) : "—")
        }
      }
    }
    return map
  }, [skuDetailsData])

  // Selection & Dialog State
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [selectedGroups, setSelectedGroups] = useState<any[]>([]) // Changed to array for multi-group support
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  // View-only mode: opened for issued/reverted records that are awaiting re-issue
  // from Make Invoice. Details are visible but verification cannot be completed.
  const [viewOnly, setViewOnly] = useState(false)
  const [expandedOrders, setExpandedOrders] = useState<string[]>([]) // State to manage expanded sections

  const [checkData, setCheckData] = useState({
    status: "",
    remarks: "",
  })

  // Pending query with numeric pagination
  const [pendingPage, setPendingPage] = useState(1)
  const limit = 20
  const {
    data: pendingData,
    isLoading: isPendingLoading,
    refetch: refetchPending,
  } = useQuery({
    queryKey: ["check-invoice-pending", filterValues, pendingPage],
    queryFn: async () => {
      const response = await checkInvoiceApi.getPending({
        page: pendingPage,
        limit,
        search: filterValues.search,
        manual_sauda_no: filterValues.manualSaudaNo,
        do_date_from: filterValues.startDate,
        do_date_to: filterValues.endDate,
        party_name: filterValues.partyName === "all" ? undefined : filterValues.partyName,
      });
      return response.success ? response.data : { invoices: [], pagination: { total: 0 } };
    },
  });

  useEffect(() => {
    setPendingPage(1);
  }, [filterValues]);

  const pendingOrders = useMemo(() => {
    return pendingData?.invoices || [];
  }, [pendingData]);

  /* Filter Logic */

  // Search, Manual Sauda No., DO Date range and Party Name are applied
  // server-side (see getPending/getHistory params), so no client-side filtering here.
  const filteredPendingOrders = pendingOrders

  /* Grouping Logic */
  const displayRows = useMemo(() => {
    const grouped: { [key: string]: any } = {}

    filteredPendingOrders.forEach((order: any) => {
      const invoiceNo = order.invoice_no || "No Invoice"
      const partyName = (order.transfer === 'yes' && order.bill_company_name) ? order.bill_company_name : (order.party_name || order.partyName || "Unknown Customer")
      const rawDoNumber = order.so_no || order.soNo || "—"
      const doNumber = rawDoNumber.replace(/(?<=\d)[A-Z].*$/, "")

      if (!grouped[invoiceNo]) {
        grouped[invoiceNo] = {
          _rowKey: invoiceNo,
          customerName: partyName,
          invoiceNo: invoiceNo,
          doNumberList: new Set<string>(),
          _allProducts: [],
          _ordersMap: {}, // Group items by specific DO for interleaved view
          _productCount: 0
        }
      }

      const group = grouped[invoiceNo]
      group.doNumberList.add(doNumber)

      const orderKey = doNumber;

      if (!group._ordersMap[orderKey]) {
        group._ordersMap[orderKey] = {
          _products: [],
          depoName: order.depo_name || order.depoName || "—",
          deliveryPurpose: order.order_type_delivery_purpose || "—",
          orderType: order.order_type || "—",
          startDate: order.start_date,
          endDate: order.end_date,
          deliveryDate: order.delivery_date,
          transportType: order.type_of_transporting || "—",
          contactPerson: order.customer_contact_person_name || "—",
          whatsapp: order.customer_contact_person_whatsapp_no || "—",
          address: order.customer_address || "—",
          paymentTerms: order.payment_terms || "—",
          advanceAmount: order.advance_amount || 0,
          isBroker: order.is_order_through_broker || false,
          isOrderThrough: order.is_order_through || "—",
          brokerName: order.broker_name || "—",
          partyCredit: order.party_credit_status || "Good",
          totalAmount: order.total_amount_with_gst || "—",
          oilType: order.oil_type || "—",
          // Check Invoice specific data
          invoiceNo: order.invoice_no,
          invoiceDate: order.invoice_date,
          biltyNo: order.bilty_no,
          rstNo: order.rst_no,
          grossWeight: order.gross_weight,
          tareWeight: order.tare_weight,
          netWeight: order.net_weight,
          transporterName: order.transporter_name,
          truckNo: order.truck_no,
          diffReason: order.reason_of_difference_in_weight_if_any_speacefic,
          partySoDate: formatDate(order.party_so_date || order.partySoDate),
          uploadSo: order.upload_so || null,
        }
      }

      const product = {
        ...order,
        _rowKey: `${partyName}-${order.id}`,
        id: order.id,
        specificOrderNo: doNumber,
        productName: order.product_name,
        rate: ((parseFloat(order.rate_of_material) || 0) * (parseFloat(order.nos_per_main_uom) || 1)) + (parseFloat(order.freight_rate) || 0),
        amount: (((parseFloat(order.rate_of_material) || 0) * (parseFloat(order.nos_per_main_uom) || 1)) + (parseFloat(order.freight_rate) || 0)) * (parseFloat(order.actual_qty_dispatch || order.actual_qty || order.qty) || 0),
        invoiceNo: order.invoice_no,
        invoiceDate: order.invoice_date,
        billAmount: order.bill_amount,
        qty: order.qty,
        actualQty: order.actual_qty_dispatch || order.actual_qty,
        truckNo: order.truck_no,
        rstNo: order.rst_no,
        grossWeight: order.gross_weight,
        tareWeight: order.tare_weight,
        netWeight: order.net_weight,
        transporterName: order.transporter_name,
        weightDiff: order.difference || 0,
        fitness: order.fitness,
        fitness_end_date: order.fitness_end_date,
        insurance: order.insurance,
        insurance_end_date: order.insurance_end_date,
        tax_copy: order.tax_copy,
        tax_end_date: order.tax_end_date,
        polution: order.polution,
        pollution_end_date: order.pollution_end_date,
        permit1: order.permit1,
        permit1_end_date: order.permit1_end_date,
        permit2_out_state: order.permit2_out_state,
        permit2_end_date: order.permit2_end_date,
        weightment_slip_copy: order.weightment_slip_copy,
        vehicle_no_plate_image: order.vehicle_no_plate_image,
        bilty_image: order.bilty_image,
        vehicle_image_attachemrnt: order.vehicle_image_attachemrnt,
        reason_of_difference_in_weight_if_any_speacefic: order.reason_of_difference_in_weight_if_any_speacefic,
        processid: order.processid || null,
        actual_5: order.actual_5, // Track whether record has been reverted
      }

      group._ordersMap[orderKey]._products.push(product)
      group._allProducts.push(product)
      group._productCount = group._allProducts.length
    })

    // Convert Set to string for display
    return Object.values(grouped).map(group => {
      const actual1DateVal = group._allProducts[0]?.lrc_actual_1 || group._allProducts[0]?.actual_1
      return {
        ...group,
        partySoDate: formatDate(group._allProducts[0]?.party_so_date),
        doNumber: Array.from(group.doNumberList).join(", "),
        orderNo: Array.from(group.doNumberList).join(", "),
        processId: group._allProducts[0]?.processid || "—",
        processid: group._allProducts[0]?.processid || "—",
        vehicleNo: (group._allProducts[0]?.truckNo || "—").toUpperCase(),
        invoiceNo: group._allProducts[0]?.invoice_no || "—",
        freightRate: group._allProducts[0]?.freight_rate || 0,
        orderPunchRemarks: group._allProducts[0]?.order_punch_remarks || "—",
        uploadSo: group._allProducts[0]?.upload_so || group._allProducts[0]?.uploadSo || null,
        isReverted: group._allProducts.every((p: any) => !p.actual_5),
        actual1Date: formatDate(actual1DateVal),
        // actual_qty_dispatch is a PER-PRODUCT line quantity, so the group total must
        // sum across every product — otherwise the dynamic-column fallback shows only
        // the first product's qty instead of the full group total.
        actual_qty_dispatch: group._allProducts.reduce((sum: number, p: any) => sum + (Number(p.actual_qty_dispatch) || 0), 0),
        // One entry per DO in this group, so columns that vary per-DO (DO Number,
        // Dispatched Date, Order Punch Remarks) can be rendered stacked instead of
        // collapsing to the first DO's value.
        doDetails: Object.entries(group._ordersMap as Record<string, any>).map(([doNo, details]) => {
          const firstProd = details._products[0] || {}
          return {
            doNumber: doNo,
            dispatchedDate: formatDate(firstProd.lrc_actual_1 || firstProd.actual_1),
            orderPunchRemarks: firstProd.order_punch_remarks || "—",
          }
        }),
      }
    })
  }, [filteredPendingOrders])

  // ── Stage list table state (column search / date range / sort / totals) ──
  // Status buttons are remembered permanently; quick search / customer filter only for the session.
  // Refresh only reloads data.
  const [listView, patchListView] = usePersistedFilters("check-invoice", {
    quickSearch: "",
    statusFilter: "ALL" as "ALL" | "PENDING" | "ISSUE",
    customerFilter: "ALL",
  }, { permanentKeys: ["statusFilter"] })
  const { quickSearch, statusFilter, customerFilter } = listView
  const setQuickSearch = (v: string) => patchListView({ quickSearch: v })
  const setStatusFilter = (v: "ALL" | "PENDING" | "ISSUE") => patchListView({ statusFilter: v })
  const setCustomerFilter = (v: string) => patchListView({ customerFilter: v })

  const groupStatus = (g: any): string =>
    g.isReverted || g._allProducts?.some((p: any) => p.status_1 === "Issue") ? "Issue Reported" : "Pending Review"

  const stageCols = useMemo<StageColDef<any>[]>(() => {
    const std: StageColDef<any>[] = [
      { id: "partySoDate", label: "DO Date", type: "date", accessor: (g) => g._allProducts?.[0]?.party_so_date },
      { id: "orderNo", label: "DO Number", accessor: (g) => g.orderNo },
      { id: "processid", label: "Manual Sauda No.", accessor: (g) => g.processid },
      { id: "customerName", label: "Customer Name", accessor: (g) => g.customerName },
      { id: "actual1Date", label: "Dispatched Date", type: "date", accessor: (g) => g._allProducts?.[0]?.lrc_actual_1 || g._allProducts?.[0]?.actual_1 },
      { id: "invoiceNo", label: "Invoice No.", accessor: (g) => g.invoiceNo },
      { id: "vehicleNo", label: "Vehicle No.", accessor: (g) => g.vehicleNo },
      { id: "orderPunchRemarks", label: "Order Punch Remarks", accessor: (g) => g.orderPunchRemarks },
      { id: "status", label: "Status", accessor: (g) => groupStatus(g) },
      { id: "products", label: "Items", type: "number", accessor: (g) => g._productCount || 0, total: true },
    ]
    const stdIds = new Set(std.map((c) => c.id))
    const SUMMABLE_DYN = new Set(["bill_amount", "gross_weight", "tare_weight", "net_weight", "extra_weight"])
    const dyn: StageColDef<any>[] = ALL_COLUMNS.filter((c) => !stdIds.has(c.id)).map((c) =>
      c.id in NUM_DECIMALS
        ? { id: c.id, label: colLabel(c.id, c.label), type: "number" as const, accessor: (g: any) => Number(getDynamicColumnValue(g, c.id)) || 0, ...(SUMMABLE_DYN.has(c.id) ? { total: true } : {}) }
        : { id: c.id, label: colLabel(c.id, c.label), type: DATE_COL_IDS.has(c.id) ? ("date" as const) : undefined, accessor: (g: any) => String(getDynamicColumnValue(g, c.id)) }
    )
    return [...std, ...dyn]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const baseFilter = useCallback(
    (g: any) => {
      if (statusFilter === "PENDING" && groupStatus(g) !== "Pending Review") return false
      if (statusFilter === "ISSUE" && groupStatus(g) !== "Issue Reported") return false
      if (customerFilter !== "ALL" && g.customerName !== customerFilter) return false
      const q = quickSearch.trim().toLowerCase()
      if (q) {
        const hay = [g.orderNo, g.customerName, g.invoiceNo, g.vehicleNo, g.processid, g.orderPunchRemarks].join(" ").toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [statusFilter, customerFilter, quickSearch]
  )

  const table = useStageTable<any>({ rows: displayRows, columns: stageCols, baseFilter, persistKey: "check-invoice" })
  const orderedCols = useMemo(
    () => orderedVisible.map((id) => stageCols.find((c) => c.id === id)).filter(Boolean) as StageColDef<any>[],
    [orderedVisible.join("|"), stageCols] // eslint-disable-line react-hooks/exhaustive-deps
  )
  const customerOptions = useMemo(
    () => Array.from(new Set(displayRows.map((g: any) => g.customerName).filter(Boolean))).sort() as string[],
    [displayRows]
  )
  const activeFiltersCount =
    (statusFilter !== "ALL" ? 1 : 0) + (customerFilter !== "ALL" ? 1 : 0) + (quickSearch.trim() ? 1 : 0) + table.activeColumnFilterCount
  const resetAllFilters = () => {
    patchListView({ statusFilter: "ALL", customerFilter: "ALL", quickSearch: "" })
    table.clearColumnFilters()
  }


  const toggleSelectItem = (itemKey: string) => {
    setSelectedItems(prev =>
      prev.includes(itemKey)
        ? prev.filter(k => k !== itemKey)
        : [...prev, itemKey]
    )
  }

  // Issued/reverted records are awaiting re-issue from Make Invoice and cannot be
  // verified, so they are excluded from selection (view-only via the eye action).
  const selectableRows = useMemo(() => table.rows.filter((r: any) => !r.isReverted), [table.rows])
  const allSelectableChecked = selectableRows.length > 0 && selectableRows.every((r: any) => selectedItems.includes(r._rowKey))

  const toggleSelectAll = () => {
    if (allSelectableChecked) {
      const ids = new Set(selectableRows.map((r: any) => r._rowKey))
      setSelectedItems(prev => prev.filter(k => !ids.has(k)))
    } else {
      setSelectedItems(prev => Array.from(new Set([...prev, ...selectableRows.map((r: any) => r._rowKey)])))
    }
  }

  const handleOpenDialog = () => {
    if (selectedItems.length === 0) return

    // Get all selected groups
    const targets = displayRows.filter(r => selectedItems.includes(r._rowKey))
    if (targets.length > 0) {
      setViewOnly(false)
      setSelectedGroups(targets)
      // Select all products by default from all selected groups
      const allProdKeys = targets.flatMap(g => g._allProducts.map((p: any) => p._rowKey))
      setSelectedProducts(allProdKeys)

      // Reset form
      setCheckData({ status: "", remarks: "" })
      setExpandedOrders([]) // Reset expanded state

      setIsDialogOpen(true)
    }
  }

  // Open the details dialog in read-only mode for an issued/reverted record.
  // The record is awaiting re-issue from Make Invoice and must not be re-verified
  // here, but its details should remain viewable.
  const handleViewGroup = (group: any) => {
    setViewOnly(true)
    setSelectedGroups([group])
    setSelectedProducts(group._allProducts.map((p: any) => p._rowKey))
    setCheckData({ status: "", remarks: "" })
    setExpandedOrders([])
    setIsDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (selectedGroups.length === 0 || !checkData.status) {
      toast({
        title: "Validation Error",
        description: "Please select verification status.",
        variant: "destructive"
      })
      return
    }

    if (checkData.status === "Issue" && !checkData.remarks) {
      toast({
        title: "Validation Error",
        description: "Remarks are mandatory when reporting an issue.",
        variant: "destructive"
      })
      return
    }

    // Flatten all selected products from all selected groups
    const productsToSubmit = selectedGroups.flatMap(group =>
      group._allProducts.filter((p: any) => selectedProducts.includes(p._rowKey))
    )

    if (productsToSubmit.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one product to verify",
        variant: "destructive"
      })
      return
    }

    setIsProcessing(true)
    try {
      const successfulSubmissions: any[] = []
      const failedSubmissions: any[] = []

      for (const product of productsToSubmit) {
        const submitData = {
          status: checkData.status,
          remarks: checkData.remarks,
          userId: user?.id || null // Track acting user's login id
        };

        try {
          console.log(`[CHECK] Submitting for ID ${product.id}`, submitData);
          const response = await checkInvoiceApi.submit(product.id, submitData);

          if (response.success) {
            successfulSubmissions.push(product);
          } else {
            failedSubmissions.push({ product, error: response.message });
          }
        } catch (err: any) {
          console.error(`[CHECK] Failed for ID ${product.id}`, err);
          failedSubmissions.push({ product, error: err.message, code: err?.code });
        }
      }

      if (successfulSubmissions.length > 0) {
        toast({
          title: "Invoices Verified",
          description: `Successfully verified ${successfulSubmissions.length} items.`,
        })

        await refetchPending();
        queryClient.invalidateQueries({ queryKey: ["check-invoice-history"] });
        // A record marked "Issue" is sent back to Make Invoice — invalidate its
        // pending list (prefix matches all filter variations) so it shows up there
        // without a full page refresh.
        queryClient.invalidateQueries({ queryKey: ["make-invoice-pending"] });

        setIsDialogOpen(false)
        setSelectedItems([])
      }

      // Stale-write conflicts: the row was already processed/moved by another user.
      // Refetch the pending list even if nothing succeeded so the phantom row vanishes.
      const staleWrites = failedSubmissions.filter((f: any) => isStaleWriteError(f));
      const otherFailures = failedSubmissions.filter((f: any) => !isStaleWriteError(f));

      if (staleWrites.length > 0) {
        toast({
          title: "Already processed",
          description: `${staleWrites.length} item(s) were already processed or moved by another user. Refreshing the list…`,
          variant: "destructive",
        })
        await refetchPending();
        queryClient.invalidateQueries({ queryKey: ["check-invoice-history"] });
        queryClient.invalidateQueries({ queryKey: ["make-invoice-pending"] });
      }

      if (otherFailures.length > 0) {
        toast({
          title: "Partial Failure",
          description: `Failed to process ${otherFailures.length} items.`,
          variant: "destructive"
        })
      }

    } catch (error: any) {
      console.error("Batch submit error:", error);
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }



  const customerNames = Array.from(new Set(pendingOrders.map((order: any) => (order.transfer === 'yes' && order.bill_company_name) ? order.bill_company_name : (order.party_name || order.partyName || "Unknown Customer")))) as string[]

  const buildCheckInvoiceDisplay = (group: any) => ({
    doNumber: group.doNumber || "—",
    orderNo: group.orderNo || group.doNumber || "—",
    partySoDate: group.partySoDate || "—",
    processId: group.processId || "—",
    processid: group.processid || group.processId || "—",
    customerName: group.customerName || "—",
    invoiceNo: group.invoiceNo || "—",
    vehicleNo: group.vehicleNo || "—",
    productCount: group._productCount || group._allProducts?.length || 0,
    productName: group._allProducts?.[0]?.productName || "—",
    orderPunchRemarks: group.orderPunchRemarks || "—",
    qty: group._allProducts?.reduce((sum: number, p: any) => sum + (Number(p.actualQty) || 0), 0) || 0,
    amount: group._allProducts?.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0) || 0,
    invoiceCopy: group._allProducts?.[0]?.invoice_copy,
    statusText: group.isReverted || group._allProducts?.some((p: any) => p.status_1 === "Issue") ? "Issue Reported" : "Pending Review",
    actual1Date: group.actual1Date || formatDate(group._allProducts?.[0]?.lrc_actual_1 || group._allProducts?.[0]?.actual_1),
    doDetails: group.doDetails || [],
  })



  return (
    <WorkflowStageShell
      persistKey="check-invoice"
      partyNames={customerNames}
      title="Stage 10: Check Invoice"
      description="Review and verify invoices grouped by Customer."
      pendingCount={displayRows.length}
      historyData={[]}
      onFilterChange={setFilterValues}
      showStatusFilter={true}
      stageLevel={7}
      onTabChange={setActiveTab}
      showDateFilters={true}
      showSaudaFilter={true}
      dateLabel="DO Date"
      searchPlaceholder="Search DO Number..."
      historyContent={
        <StageHistoryTab
          queryKeyPrefix="check-invoice-history"
          getHistoryApi={(params: any) => checkInvoiceApi.getHistory({
            page: params.page,
            limit: params.limit,
            search: params.order_no,
            manual_sauda_no: filterValues.manualSaudaNo || undefined,
            do_date_from: params.start_date,
            do_date_to: params.end_date,
            party_name: params.customer_name,
          })}
          filterValues={filterValues}
          activeTab={activeTab}
          stageName="Check Invoice"
          stageLevel={7}
          remarksColName="Remarks"
          orderListKey="invoices"
          mapOrderNo={(order: any) => order.so_no || "-"}
          mapCustomerName={(order: any) => (order.transfer === 'yes' && order.bill_company_name) ? order.bill_company_name : order.party_name}
          mapRemarks={(order: any) => `${order.remarks_2 || "-"} ${order.freight_rate ? `| Freight (₹): ${order.freight_rate}` : ""}`}
          getDate={(order: any) => order.actual_6 || order.timestamp || null}
        />
      }
    >
      <div className="space-y-4">
        {/* Action Bar */}
        <StageActionBar>
          <Button
            onClick={handleOpenDialog}
            disabled={selectedItems.length === 0}
            className="w-full bg-blue-600 hover:bg-blue-700 sm:w-auto"
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            Verify Invoice ({selectedItems.length})
          </Button>

                </StageActionBar>

        {/* Main Table (Grouped) */}
        <Card className="border border-slate-200/80 shadow-xs overflow-hidden py-0 gap-0 stage-card">
          <StageListHeader
            title="Invoices List"
            shown={table.rows.length}
            total={displayRows.length}
            description="Invoices pending verification, grouped by invoice"
            searchValue={quickSearch}
            onSearchChange={setQuickSearch}
            searchPlaceholder="Search DO, Customer, Invoice, Vehicle..."
          >
            <StageToolbar
              shown={table.rows.length}
              total={displayRows.length}
              activeCount={activeFiltersCount}
              onReset={resetAllFilters}
              filters={
                <>
                  <StageSegmented
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={[
                      { value: "PENDING", label: "Pending Review" },
                      { value: "ISSUE", label: "Issue Reported" },
                      { value: "ALL", label: "All" },
                    ]}
                  />
                  <StageDivider />
                  <StageFilterSelect value={customerFilter} onChange={setCustomerFilter} allLabel="All Customers" options={customerOptions} />
                  <StageColumnsMenu
                    columns={ALL_COLUMNS}
                    visibleColumns={visibleColumns}
                    setVisibleColumns={setVisibleColumns}
                    show={isAdmin || isFeatureEnabled('can_toggle_columns')}
                  />
                </>
              }
            />
            <StageActiveChips
              chips={[
                ...(statusFilter !== "ALL" ? [{ label: `Status: ${statusFilter === "PENDING" ? "Pending Review" : "Issue Reported"}`, onClear: () => setStatusFilter("ALL") }] : []),
                ...(customerFilter !== "ALL" ? [{ label: `Customer: ${customerFilter}`, onClear: () => setCustomerFilter("ALL") }] : []),
                ...(quickSearch.trim() ? [{ label: `Search: ${quickSearch.trim()}`, onClear: () => setQuickSearch("") }] : []),
              ]}
            />
          </StageListHeader>
          <CardContent className="p-0">
          <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader className="bg-slate-50 border-b">
              <TableRow>
                <TableHead className="w-12 px-4 text-left align-middle">
                  <Checkbox checked={allSelectableChecked} onCheckedChange={toggleSelectAll} />
                </TableHead>
                <ColumnDragProvider columnIds={orderedVisible} onReorder={handleColumnReorder} disabled={!isAdmin && !isFeatureEnabled('can_reorder_columns')}>
                  {orderedCols.map(col => (
                    <StageHeadCell key={col.id} col={col} table={table} align={isRightCol(col.id) ? "right" : "left"} />
                  ))}
                </ColumnDragProvider>
              </TableRow>
            </TableHeader>
            <TableBody>
              <StageTotalsRow
                columns={[{ id: "__sel", label: "" }, ...orderedCols]}
                totals={table.totals}
                count={table.rows.length}
                labelColumnId={orderedCols[0]?.id}
                unit=""
                format={(n, id) => fmtNum(n, NUM_DECIMALS[id] ?? 2)}
                tones={{ products: "blue", actual_qty_dispatch: "purple", bill_amount: "emerald" }}
                align={Object.fromEntries([["__sel", "left"],...orderedCols.map(c => [c.id, isRightCol(c.id) ? "right" : "left"])]) as Record<string, "center" | "left" | "right">}
              />
              {isPendingLoading && pendingOrders.length === 0 ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i} className="opacity-40 border-b border-slate-50">
                    <TableCell className="px-4 text-left py-4"><div className="h-4 w-4 bg-slate-200 animate-pulse rounded" /></TableCell>
                    {orderedVisible.map(id => (
                      <TableCell key={id} className={cn("px-4 py-4", isRightCol(id) ? "text-right" : "text-left")}>
                        <div className={cn("h-3 bg-slate-200 animate-pulse rounded-full", isRightCol(id) && "ml-auto",id === "status" ? "h-5 w-24" : id === "products" ? "w-16" : id === "customerName" ? "w-40" : id === "orderPunchRemarks" ? "w-16" : id === "orderNo" || id === "processid" || id === "invoiceNo" || id === "vehicleNo" || id === "actual1Date" ? "w-24" : "w-20")} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : table.rows.length > 0 ? (
                table.rows.map((group) => (
                  <TableRow
                    key={group._rowKey}
                    className={`${selectedItems.includes(group._rowKey) ? "bg-blue-50/50" : ""} ${group.isReverted ? "opacity-60 bg-amber-50/40" : ""}`}
                  >
                    <TableCell className="px-4 text-left">
                      {group.isReverted ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-amber-600 hover:bg-amber-100"
                          onClick={() => handleViewGroup(group)}
                          title="Awaiting re-issue from Make Invoice — view details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Checkbox
                          checked={selectedItems.includes(group._rowKey)}
                          onCheckedChange={() => toggleSelectItem(group._rowKey)}
                        />
                      )}
                    </TableCell>
                    {orderedVisible.map(id => {
                      if (id === "partySoDate") return <TableCell key={id} className="px-4 text-right text-xs text-slate-600 whitespace-nowrap font-mono tabular-nums min-w-[110px]">{group.partySoDate}</TableCell>
                      if (id === "orderNo") return (
                        <TableCell key={id} className="px-4 text-left text-xs">
                          <div className="flex flex-col gap-1.5">
                            {(group.doDetails && group.doDetails.length > 0 ? group.doDetails : [{ doNumber: group.orderNo }]).map((d: any, idx: number) => (
                              <span key={`${d.doNumber}-${idx}`} className="text-blue-700 font-bold">{d.doNumber}</span>
                            ))}
                          </div>
                        </TableCell>
                      )
                      if (id === "processid") return <TableCell key={id} className="px-4 text-left text-xs text-slate-600">{group.processid}</TableCell>
                      if (id === "customerName") return <TableCell key={id} className="px-4 text-left text-xs text-slate-600">{group.customerName}</TableCell>
                      if (id === "actual1Date") return (
                        <TableCell key={id} className="px-4 text-right text-xs text-slate-600 whitespace-nowrap font-mono tabular-nums min-w-[110px]">
                          <div className="flex flex-col gap-1.5">
                            {(group.doDetails && group.doDetails.length > 0 ? group.doDetails : [{ doNumber: "—", dispatchedDate: group.actual1Date }]).map((d: any, idx: number) => (
                              <span key={`${d.doNumber}-${idx}`}>{d.dispatchedDate}</span>
                            ))}
                          </div>
                        </TableCell>
                      )
                      if (id === "invoiceNo") return (
                        <TableCell key={id} className="px-4 text-left text-xs font-medium">
                          {group._allProducts?.[0]?.invoice_copy ? (
                            <a href={group._allProducts[0].invoice_copy} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-bold">{group.invoiceNo}</a>
                          ) : group.invoiceNo}
                        </TableCell>
                      )
                      if (id === "vehicleNo") return <TableCell key={id} className="px-4 text-left"><span className="text-xs text-slate-600">{group.vehicleNo}</span></TableCell>
                      if (id === "orderPunchRemarks") return (
                        <TableCell key={id} className="px-4 text-left">
                          <div className="flex flex-col gap-1.5">
                            {(group.doDetails && group.doDetails.length > 0 ? group.doDetails : [{ doNumber: "—", orderPunchRemarks: group.orderPunchRemarks }]).map((d: any, idx: number) => (
                              <span key={`${d.doNumber}-${idx}`} className="text-xs text-slate-600">{d.orderPunchRemarks}</span>
                            ))}
                          </div>
                        </TableCell>
                      )
                      if (id === "status") return (
                        <TableCell key={id} className="px-4 text-left">
                          {group.isReverted ? (
                            <Badge className="bg-red-100 text-red-700">Issue Reported</Badge>
                          ) : group._allProducts.some((p: any) => p.status_1 === "Issue") ? (
                            <Badge className="bg-red-100 text-red-700">Issue Reported</Badge>
                          ) : (
                            <Badge className="bg-yellow-100 text-yellow-700">Pending Review</Badge>
                          )}
                        </TableCell>
                      )
                      if (id === "products") return (
                        <TableCell key={id} className="px-4 text-right text-xs font-mono tabular-nums">
                          {fmtNum(group._productCount, 0)}
                        </TableCell>
                      )
                      return isRightCol(id)
                        ? <TableCell key={id} className="px-4 text-right text-xs text-slate-600 whitespace-nowrap font-mono tabular-nums min-w-[110px]">{fmtCell(id, getDynamicColumnValue(group, id))}</TableCell>
                        : <TableCell key={id} className="px-4 text-left text-xs text-slate-600">{String(getDynamicColumnValue(group, id))}</TableCell>
                    })}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={1 + orderedVisible.length} className="text-center py-8 text-muted-foreground">
                    {displayRows.length > 0 ? (
                      <div className="flex flex-col items-center gap-1">
                        <p className="font-medium text-slate-500">No matching records found for the filters</p>
                        <button onClick={resetAllFilters} className="text-xs text-blue-600 hover:underline font-semibold">Clear Filters</button>
                      </div>
                    ) : "No invoices pending for review"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
          <div className="space-y-3 p-3 md:hidden">
            {isPendingLoading && pendingOrders.length === 0 ? (
              [...Array(5)].map((_, i) => (
                <div key={i} className="rounded-lg border p-4 space-y-3 opacity-60">
                  <div className="h-4 w-32 bg-slate-200 animate-pulse rounded" />
                  <div className="grid grid-cols-2 gap-3">
                    {[...Array(6)].map((__, j) => <div key={j} className="h-10 bg-slate-100 animate-pulse rounded" />)}
                  </div>
                </div>
              ))
            ) : table.rows.length > 0 ? (
              table.rows.map((group) => {
                const display = buildCheckInvoiceDisplay(group)
                const selected = selectedItems.includes(group._rowKey)
                return (
                  <div
                    key={group._rowKey}
                    className={cn(
                      "rounded-lg border bg-white p-4 shadow-sm",
                      selected && "border-blue-200 bg-blue-50",
                      group.isReverted && "opacity-60 bg-amber-50/40"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {visibleColumns.includes("orderNo") && (
                          <div className="flex flex-col gap-0.5">
                            {(display.doDetails.length > 0 ? display.doDetails : [{ doNumber: display.doNumber }]).map((d: any, idx: number) => (
                              <p key={`${d.doNumber}-${idx}`} className="font-mono text-sm font-black text-blue-700 break-all">{d.doNumber}</p>
                            ))}
                          </div>
                        )}
                        {visibleColumns.includes("partySoDate") && <p className="mt-1 text-xs font-semibold text-slate-500">{display.partySoDate}</p>}
                      </div>
                      {group.isReverted ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-amber-600 hover:bg-amber-100"
                          onClick={() => handleViewGroup(group)}
                          title="Awaiting re-issue from Make Invoice — view details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Checkbox
                          checked={selected}
                          onCheckedChange={() => toggleSelectItem(group._rowKey)}
                        />
                      )}
                    </div>

                    {visibleColumns.includes("customerName") && (
                      <div className="mt-3">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Customer Name</p>
                        <p className="text-sm font-bold text-slate-900 break-words">{display.customerName}</p>
                      </div>
                    )}

                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                      {visibleColumns.includes("invoiceNo") && (
                        <div className="rounded-md bg-slate-50 p-2">
                          <p className="text-[10px] font-black uppercase text-slate-400">Invoice No.</p>
                          {display.invoiceCopy ? (
                            <a href={display.invoiceCopy} target="_blank" rel="noopener noreferrer" className="mt-1 block font-bold text-blue-600 underline break-words">
                              {display.invoiceNo}
                            </a>
                          ) : (
                            <p className="mt-1 font-bold break-words">{display.invoiceNo}</p>
                          )}
                        </div>
                      )}
                      {visibleColumns.includes("processid") && (
                        <div className="rounded-md bg-slate-50 p-2">
                          <p className="text-[10px] font-black uppercase text-slate-400">Manual Sauda No.</p>
                          <p className="mt-1 font-bold break-words">{display.processId}</p>
                        </div>
                      )}
                      <div className="rounded-md bg-slate-50 p-2">
                        <p className="text-[10px] font-black uppercase text-slate-400">Items</p>
                        <p className="mt-1 font-bold font-mono tabular-nums">{fmtNum(display.productCount, 0)}</p>
                      </div>
                      {visibleColumns.includes("vehicleNo") && (
                        <div className="rounded-md bg-slate-50 p-2">
                          <p className="text-[10px] font-black uppercase text-slate-400">Vehicle</p>
                          <p className="mt-1 font-bold break-words">{display.vehicleNo}</p>
                        </div>
                      )}
                      {visibleColumns.includes("actual1Date") && (
                        <div className="rounded-md bg-slate-50 p-2">
                          <p className="text-[10px] font-black uppercase text-slate-400">Dispatched Date</p>
                          <div className="mt-1 flex flex-col gap-0.5">
                            {(display.doDetails.length > 0 ? display.doDetails : [{ doNumber: "—", dispatchedDate: display.actual1Date }]).map((d: any, idx: number) => (
                              <p key={`${d.doNumber}-${idx}`} className="font-bold break-words">{d.dispatchedDate}</p>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="rounded-md bg-slate-50 p-2">
                        <p className="text-[10px] font-black uppercase text-slate-400">Qty to Dispatch</p>
                        <p className="mt-1 font-mono tabular-nums font-bold">{fmtNum(display.qty, 4)}</p>
                      </div>
                      <div className="rounded-md bg-slate-50 p-2">
                        <p className="text-[10px] font-black uppercase text-slate-400">Amount (₹)</p>
                        <p className="mt-1 font-mono tabular-nums font-bold">{fmtNum(display.amount, 2)}</p>
                      </div>
                    </div>
                    {dynamicColumns.length > 0 && (
                      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                        {dynamicColumns.map((colId) => {
                          const col = ALL_COLUMNS.find((c) => c.id === colId)
                          if (!col) return null
                          return (
                            <div key={colId} className="rounded-md bg-slate-50 p-2">
                              <p className="text-[10px] font-black uppercase text-slate-400">{colLabel(colId, col.label)}</p>
                              <p className="mt-1 font-bold break-words">{fmtCell(colId, getDynamicColumnValue(group, colId))}</p>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {display.orderPunchRemarks !== "—" && (
                      <div className="mt-3 rounded-md bg-amber-50 p-3 text-xs">
                        <span className="font-black text-amber-800">Order Remarks:</span>
                        <div className="mt-1 flex flex-col gap-1">
                          {(display.doDetails.length > 0 ? display.doDetails : [{ doNumber: "—", orderPunchRemarks: display.orderPunchRemarks }]).map((d: any, idx: number) => (
                            <p key={`${d.doNumber}-${idx}`}>{d.orderPunchRemarks}</p>
                          ))}
                        </div>
                      </div>
                    )}
                    <Badge className={cn("mt-3", display.statusText === "Issue Reported" ? "bg-red-100 text-red-700 hover:bg-red-100" : "bg-yellow-100 text-yellow-700 hover:bg-yellow-100")}>
                      {display.statusText}
                    </Badge>
                  </div>
                )
              })
            ) : (
              <div className="py-10 text-center text-muted-foreground">
                {displayRows.length > 0 ? (
                  <div className="flex flex-col items-center gap-1">
                    <p className="font-medium text-slate-500">No matching records found for the filters</p>
                    <button onClick={resetAllFilters} className="text-xs text-blue-600 hover:underline font-semibold">Clear Filters</button>
                  </div>
                ) : "No invoices pending for review"}
              </div>
            )}
          </div>
          </CardContent>
        </Card>

        <StagePagination
          page={pendingPage}
          totalPages={pendingData?.pagination?.totalPages || 1}
          total={pendingData?.pagination?.total || 0}
          noun="Invoices"
          onPrev={() => setPendingPage(p => Math.max(1, p - 1))}
          onNext={() => setPendingPage(p => p + 1)}
          prevDisabled={pendingPage === 1}
          nextDisabled={pendingPage >= (pendingData?.pagination?.totalPages || 1)}
        />
      </div>

      {/* Split-View Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setViewOnly(false) }}>
        <DialogContent className="w-[calc(100vw-0.75rem)] max-w-[calc(100vw-0.75rem)] sm:!max-w-[95vw] max-h-[95vh] overflow-x-hidden overflow-y-auto p-0 [overflow-wrap:anywhere]">
          <div className="p-3 sm:p-6">
            <DialogHeader className="min-w-0">
              <DialogTitle className="text-lg sm:text-xl font-bold text-slate-900 border-b pb-4 mb-4 break-words">
                {viewOnly ? "View Details" : "Verify Invoices"} - {selectedGroups.length > 1 ? `${selectedGroups.length} Invoices Selected` : selectedGroups[0]?.invoiceNo}
              </DialogTitle>
            </DialogHeader>

            {selectedGroups.length > 0 && (
              <div className="space-y-6 sm:space-y-12 mt-6 min-w-0">
                {/* 1. Stacked Company Information Bars */}
                <div className="space-y-4 min-w-0">
                  {selectedGroups.map((group, groupIdx) => {
                    const isExpanded = expandedOrders.includes(group._rowKey);
                    const toggleExpand = () => {
                      setExpandedOrders(prev => isExpanded ? prev.filter(id => id !== group._rowKey) : [...prev, group._rowKey]);
                    };
                    const uniqueOrderDetails = Object.values(group._ordersMap);

                    return (
                      <div key={group._rowKey} className="border-2 border-slate-100 rounded-xl sm:rounded-3xl overflow-hidden bg-white shadow-sm min-w-0">
                        <div className="bg-blue-600 px-3 sm:px-5 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between cursor-pointer" onClick={toggleExpand}>
                          <div className="min-w-0 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                            <Badge className="max-w-full bg-white text-blue-800 hover:bg-white px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-black tracking-tight rounded-full shadow-sm uppercase whitespace-normal break-words">
                              DETAILS FOR INVOICE {group.invoiceNo}
                            </Badge>
                            <div className="flex flex-col">
                              <span className="text-[10px] text-blue-100 font-black uppercase tracking-widest leading-none mb-1">GROUP {groupIdx + 1} | {group.doNumber}</span>
                              <span className="text-xs text-blue-100 font-bold leading-none">
                                {group._productCount} Items Selected
                              </span>
                            </div>
                          </div>
                          <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-start">
                            <div className="text-[10px] sm:text-[11px] text-blue-50 font-bold uppercase tracking-widest sm:mr-2 leading-none cursor-pointer">
                              {isExpanded ? 'HIDE DETAILS ▲' : 'SHOW DETAILS ▼'}
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20 rounded-full">
                              {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                            </Button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="px-3 sm:px-5 pb-5 pt-4 space-y-6 bg-slate-50 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
                            {uniqueOrderDetails.map((orderDetails: any, idx) => {
                              const firstProd = orderDetails._products[0] || {};
                              return (
                                <div key={idx} className="bg-white border border-slate-100 rounded-2xl p-4 sm:p-6 relative shadow-sm">
                                  <div className="absolute -top-3 left-6">
                                    <Badge className="bg-slate-200 text-slate-700 hover:bg-slate-200 text-[10px] font-black uppercase px-3 py-1">
                                      ORDER: {firstProd.specificOrderNo}
                                    </Badge>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
                                    {/* Order Info */}
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Delivery Purpose</p>
                                      <p className="text-xs font-bold text-slate-900 leading-none">{orderDetails.deliveryPurpose}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Start Date / End Date</p>
                                      <p className="text-xs font-bold text-slate-700 leading-none">
                                        {formatDate(orderDetails.startDate)} / {formatDate(orderDetails.endDate)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">DO Date</p>
                                      <p className="text-xs font-bold text-slate-700">{orderDetails.partySoDate || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Transport Type</p>
                                      <p className="text-xs font-bold text-slate-900 leading-none">{orderDetails.transportType}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Credit Status</p>
                                      <Badge className={cn("text-[10px] font-black px-2 py-0.5", orderDetails.partyCredit === 'Good' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                                        {orderDetails.partyCredit}
                                      </Badge>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Customer Address</p>
                                      <p className="text-[10px] font-medium text-slate-600 leading-tight break-words" title={orderDetails.address}>{orderDetails.address}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Contact Person</p>
                                      <p className="text-xs font-bold text-slate-900 leading-tight break-words">{orderDetails.contactPerson} ({orderDetails.whatsapp})</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Broker / Advance</p>
                                      <p className="text-xs font-bold text-slate-900 leading-none">
                                        {(orderDetails.isOrderThrough === "Direct" || (orderDetails.isOrderThrough === "—" && !orderDetails.isBroker)) ? "No" : orderDetails.brokerName} / ₹{orderDetails.advanceAmount}
                                      </p>
                                    </div>

                                    <div className="md:col-span-2">
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Order Punch Remarks</p>
                                      <p className="text-[10px] font-medium text-slate-600 leading-tight italic break-words">"{orderDetails.orderPunchRemarks || "No special instructions provided."}"</p>
                                    </div>
                                    <div className="md:col-span-2">
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">PO Copy (SO Upload)</p>
                                      {group.uploadSo ? (
                                        <a
                                          href={group.uploadSo}
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-all border border-blue-200 w-fit group shadow-sm mt-0.5"
                                        >
                                          <FileText className="h-3 w-3 group-hover:scale-110 transition-transform" />
                                          <span className="text-[10px] font-black uppercase tracking-tight">VIEW PO COPY</span>
                                          <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </a>
                                      ) : (
                                        <p className="text-[10px] font-black text-slate-400 leading-none">NOT UPLOADED</p>
                                      )}
                                    </div>

                                    <div className="md:col-span-4 h-px bg-slate-200 my-1" />

                                    {/* Dispatch Info */}
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Truck No</p>
                                      <p className="text-sm font-black text-blue-800">{(firstProd.truckNo || "—").toUpperCase()}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Bilty No</p>
                                      <p className="text-xs font-black text-blue-600">{firstProd.biltyNo || firstProd.bilty_no || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Transporter</p>
                                      <p className="text-xs font-bold text-slate-700 leading-none">{firstProd.transporterName || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Audit Status</p>
                                      <Badge variant="outline" className={cn("text-[9px] font-black px-2 py-0.5 uppercase", firstProd.check_status === 'Approved' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-orange-50 text-orange-700 border-orange-200')}>
                                        {firstProd.check_status || "Pending"}
                                      </Badge>
                                    </div>

                                    <div className="md:col-span-4 h-px bg-slate-200 my-1" />

                                    {/* Vehicle Info */}
                                    <div className="md:col-span-4 flex items-center gap-2 mb-[-8px]">
                                      <div className="h-3 w-1 bg-blue-600 rounded-full" />
                                      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-blue-900/60">Vehicle Specifications</p>
                                    </div>

                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Vehicle Type</p>
                                      <p className="text-xs font-bold text-slate-900 leading-none">{firstProd.vehicle_type || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">RTO</p>
                                      <p className="text-xs font-bold text-slate-900 leading-none">{firstProd.rto || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Passing Weight</p>
                                      <p className="text-xs font-bold text-slate-900 leading-none">{firstProd.passing_weight || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Road Tax</p>
                                      <p className="text-xs font-bold text-slate-900 leading-none">{firstProd.road_tax || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">GVW</p>
                                      <p className="text-xs font-bold text-slate-900 leading-none">{firstProd.gvw || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">ULW</p>
                                      <p className="text-xs font-bold text-slate-900 leading-none">{firstProd.ulw || "—"}</p>
                                    </div>

                                    {/* Driver Info */}
                                    <div className="md:col-span-4 flex items-center gap-2 mb-[-8px] mt-2">
                                      <div className="h-3 w-1 bg-amber-600 rounded-full" />
                                      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-900/60">Driver Information</p>
                                    </div>

                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Driver Name</p>
                                      <p className="text-xs font-bold text-slate-900 leading-none">{firstProd.driver_name || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Contact No</p>
                                      <p className="text-xs font-bold text-slate-900 leading-none">{firstProd.driver_contact_no || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">License No</p>
                                      <p className="text-xs font-bold text-slate-900 leading-none">{firstProd.driving_license_no || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Valid Upto</p>
                                      <p className="text-xs font-bold text-slate-900 leading-none">{formatDate(firstProd.dl_valid_upto)}</p>
                                    </div>

                                    <div className="md:col-span-4 h-px bg-slate-200 my-1" />

                                    {/* Security Audit Info */}
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Fitness</p>
                                      {renderPartyDetailLink(firstProd.fitness, firstProd.fitness_end_date)}
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Insurance</p>
                                      {renderPartyDetailLink(firstProd.insurance, firstProd.insurance_end_date)}
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Pollution</p>
                                      {renderPartyDetailLink(firstProd.polution, firstProd.pollution_end_date)}
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Tax Copy</p>
                                      {renderPartyDetailLink(firstProd.tax_copy, firstProd.tax_end_date)}
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Permit 1</p>
                                      {renderPartyDetailLink(firstProd.permit1, firstProd.permit1_end_date)}
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Permit 2 (Out State)</p>
                                      {renderPartyDetailLink(firstProd.permit2_out_state, firstProd.permit2_end_date)}
                                    </div>

                                    <div className="md:col-span-4 h-px bg-slate-200 my-1" />

                                    {/* Weight Details */}
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">RST No</p>
                                      {firstProd.weightment_slip_copy ? (
                                        <a href={firstProd.weightment_slip_copy} target="_blank" rel="noopener noreferrer" className="text-sm font-black text-blue-600 hover:text-blue-800 underline">
                                          #{firstProd.rst_no || firstProd.rstNo || "—"}
                                        </a>
                                      ) : (
                                        <p className="text-sm font-black text-slate-900 tracking-tight">#{firstProd.rst_no || firstProd.rstNo || "—"}</p>
                                      )}
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Gross / Tare / Net</p>
                                      <p className="text-xs font-black text-slate-900 leading-tight">
                                        {firstProd.grossWeight || firstProd.gross_weight || "0"} / {firstProd.tareWeight || firstProd.tare_weight || "0"} / <span className="text-blue-600 font-black">{((Number(firstProd.grossWeight || firstProd.gross_weight || 0) - Number(firstProd.tareWeight || firstProd.tare_weight || 0)) || "0").toString()}</span>
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Weight Diff</p>
                                      <p className="text-xs font-black text-amber-600">{firstProd.weightDiff || firstProd.difference || "0"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Extra Weight</p>
                                      <p className="text-xs font-black text-purple-600">{firstProd.extraWeight || firstProd.extra_weight || "0"}</p>
                                    </div>
                                    <div className="md:col-span-2">
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Weight Diff Reason</p>
                                      <p className="text-[10px] font-bold text-red-500 italic">{firstProd.reason_of_difference_in_weight_if_any_speacefic || firstProd.reasonForDiff || "—"}</p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 2. Unified Product Table */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white min-w-0">
                  <Table className="hidden md:table">
                    <TableHeader className="bg-slate-50">
                      <TableRow className="bg-slate-100/90 border-b-2 border-slate-300 font-bold text-xs text-slate-800 hover:bg-slate-100/90 shadow-sm">
                        <TableCell className="px-4" />
                        <TableCell className="px-4 text-left font-black text-slate-900">Total ({selectedProducts.length})</TableCell>
                        <TableCell className="px-4 text-right font-mono tabular-nums">
                          {(() => {
                            const totalSelectedWt = selectedGroups.flatMap(g => g._allProducts)
                              .filter(p => selectedProducts.includes(p._rowKey))
                              .reduce((sum, p) => {
                                const skuWtStr = skuWeightMap.get(p.productName?.trim().toLowerCase());
                                const skuWt = parseFloat(skuWtStr || "") || 0;
                                const q = parseFloat(p.actualQty) || 0;
                                return sum + (skuWt * q);
                              }, 0);
                            return fmtNum(totalSelectedWt, 4);
                          })()}
                        </TableCell>
                        <TableCell className="px-4" />
                        <TableCell className="px-4" />
                        <TableCell className="px-4" />
                        <TableCell className="px-4 text-right font-mono tabular-nums">
                          {fmtNum(selectedGroups.flatMap(g => g._allProducts)
                            .filter(p => selectedProducts.includes(p._rowKey))
                            .reduce((sum, p) => {
                              const r = Number(p.rate) || 0;
                              const rateWoGst = parseFloat((r / 1.05).toFixed(2));
                              const q = parseFloat(p.actualQty) || 0;
                              return sum + (rateWoGst * q);
                            }, 0), 2)}
                        </TableCell>
                        <TableCell colSpan={3} className="px-4" />
                      </TableRow>
                      <TableRow>
                        <TableHead className="w-12 px-4 text-left h-10">
                          <Checkbox
                            checked={selectedGroups.every(g => g._allProducts.every((p: any) => selectedProducts.includes(p._rowKey)))}
                            onCheckedChange={(checked) => {
                              const allKeys = selectedGroups.flatMap(g => g._allProducts.map((p: any) => p._rowKey));
                              if (checked) {
                                setSelectedProducts(prev => Array.from(new Set([...prev, ...allKeys])))
                              } else {
                                setSelectedProducts(prev => prev.filter(k => !allKeys.includes(k)))
                              }
                            }}
                          />
                        </TableHead>
                        <TableHead className="px-4 text-left h-10">Product Info</TableHead>
                        <TableHead className="px-4 text-right h-10 whitespace-nowrap min-w-[110px]">Weight (KGS)</TableHead>
                        <TableHead className="px-4 text-right h-10 whitespace-nowrap min-w-[110px]">Actual Qty</TableHead>
                        <TableHead className="px-4 text-right h-10 whitespace-nowrap min-w-[110px]">Rate Inc. Taxes (₹)</TableHead>
                        <TableHead className="px-4 text-right h-10 whitespace-nowrap min-w-[110px]">Rate (₹)</TableHead>
                        <TableHead className="px-4 text-right h-10 whitespace-nowrap min-w-[110px]">Taxable Amount (₹)</TableHead>
                        <TableHead className="px-4 text-left h-10 whitespace-nowrap">Invoice No</TableHead>
                        <TableHead className="px-4 text-right h-10 whitespace-nowrap min-w-[110px]">Invoice Date</TableHead>
                        <TableHead className="px-4 text-left h-10 whitespace-nowrap">Truck No</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedGroups.flatMap(g => g._allProducts).map((product: any) => {
                        const originalRate = Number(product.rate) || 0;
                        const rateWoGst = parseFloat((originalRate / 1.05).toFixed(2));
                        const qty = parseFloat(product.actualQty) || 0;
                        const taxableAmount = rateWoGst * qty;

                        return (
                          <TableRow key={product._rowKey} className={cn(selectedProducts.includes(product._rowKey) ? "bg-blue-50/20" : "", "h-14")}>
                            <TableCell className="px-4 py-2 text-left">
                              <Checkbox
                                checked={selectedProducts.includes(product._rowKey)}
                                onCheckedChange={() => {
                                  if (selectedProducts.includes(product._rowKey)) {
                                    setSelectedProducts(prev => prev.filter(k => k !== product._rowKey))
                                  } else {
                                    setSelectedProducts(prev => [...prev, product._rowKey])
                                  }
                                }}
                              />
                            </TableCell>
                            <TableCell className="px-4 py-2">
                              <div className="flex flex-col">
                                <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{product.productName}</span>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1 leading-none">{product.specificOrderNo}</span>
                                <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest mt-1 leading-none">{product.party_name || product.partyName}</span>
                              </div>
                            </TableCell>
                            <TableCell className="px-4 py-2 text-right text-xs font-bold text-slate-700 font-mono tabular-nums whitespace-nowrap">
                              {(() => {
                                const skuWtStr = skuWeightMap.get(product.productName?.trim().toLowerCase());
                                const skuWt = parseFloat(skuWtStr || "") || 0;
                                const totalWt = skuWt * qty;
                                if (!totalWt) return "—";
                                return fmtNum(totalWt, 4);
                              })()}
                            </TableCell>
                            <TableCell className="px-4 py-2 text-right text-xs font-bold text-slate-700 font-mono tabular-nums whitespace-nowrap">
                              {fmtNum(product.actualQty || 0, 4)}
                            </TableCell>
                            <TableCell className="px-4 py-2 text-right text-xs font-bold text-slate-700 font-mono tabular-nums whitespace-nowrap">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <span className="cursor-pointer hover:text-blue-600 hover:underline transition-all">
                                    {originalRate ? originalRate.toFixed(2) : "—"}
                                  </span>
                                </PopoverTrigger>
                                <PopoverContent className="w-fit p-3 bg-white border-2 border-blue-100 shadow-xl rounded-xl animate-in zoom-in-95 duration-200">
                                  <div className="space-y-1.5">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Freight Rate</p>
                                    <p className="text-sm font-black text-blue-700 leading-none">
                                      {product.freight_rate ? `Freight Rate (₹): ${product.freight_rate}` : "No Freight Rate Available"}
                                    </p>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            <TableCell className="px-4 py-2 text-right text-xs font-bold text-slate-700 font-mono tabular-nums whitespace-nowrap">
                              {originalRate ? rateWoGst.toFixed(2) : "—"}
                            </TableCell>
                            <TableCell className="px-4 py-2 text-right text-xs font-bold text-slate-700 font-mono tabular-nums whitespace-nowrap">
                              {taxableAmount ? taxableAmount.toFixed(2) : "—"}
                            </TableCell>
                            <TableCell className="px-4 py-2 text-left text-xs font-bold text-green-700">
                              {product.invoice_copy ? (
                                <a href={product.invoice_copy} target="_blank" rel="noopener noreferrer" className="hover:text-green-900 underline">
                                  {product.invoiceNo || "View Invoice"}
                                </a>
                              ) : (
                                <span>{product.invoiceNo || "—"}</span>
                              )}
                            </TableCell>
                            <TableCell className="px-4 py-2 text-right text-xs font-black font-mono tabular-nums whitespace-nowrap">
                              {fmtDate(product.invoiceDate)}
                            </TableCell>
                            <TableCell className="px-4 py-2 text-left text-xs font-bold text-slate-700">
                              {(product.truckNo || "—").toUpperCase()}
                            </TableCell>
                          </TableRow>
                        );
                      })}

                    </TableBody>
                  </Table>

                  {/* Mobile Product List */}
                  <div className="space-y-3 p-3 md:hidden">
                    <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Items</p>
                        <p className="text-xs font-bold text-slate-700">{selectedGroups.flatMap(g => g._allProducts).length} items</p>
                      </div>
                      <Checkbox
                        checked={selectedGroups.every(g => g._allProducts.every((p: any) => selectedProducts.includes(p._rowKey)))}
                        onCheckedChange={(checked) => {
                          const allKeys = selectedGroups.flatMap(g => g._allProducts.map((p: any) => p._rowKey));
                          if (checked) {
                            setSelectedProducts(prev => Array.from(new Set([...prev, ...allKeys])))
                          } else {
                            setSelectedProducts(prev => prev.filter(k => !allKeys.includes(k)))
                          }
                        }}
                      />
                    </div>
                    {selectedGroups.flatMap(g => g._allProducts).map((product: any) => {
                      const selected = selectedProducts.includes(product._rowKey)
                      const originalRate = Number(product.rate) || 0
                      const rateWoGst = parseFloat((originalRate / 1.05).toFixed(2))
                      const qty = parseFloat(product.actualQty) || 0
                      const taxableAmount = rateWoGst * qty

                      return (
                        <div key={product._rowKey} className={cn("rounded-xl border bg-white p-3 space-y-3", selected && "border-blue-200 bg-blue-50/40")}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Product Info</p>
                              <p className="text-sm font-black text-slate-800 uppercase tracking-tight break-words">{product.productName}</p>
                              <div className="mt-1 flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest break-all">{product.specificOrderNo}</span>
                                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest break-words">{product.party_name || product.partyName}</span>
                              </div>
                            </div>
                            <Checkbox
                              checked={selected}
                              onCheckedChange={() => {
                                if (selected) {
                                  setSelectedProducts(prev => prev.filter(k => k !== product._rowKey))
                                } else {
                                  setSelectedProducts(prev => [...prev, product._rowKey])
                                }
                              }}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="rounded-md bg-slate-50 p-2">
                              <p className="text-[10px] font-black uppercase text-slate-400">Weight (KGS)</p>
                              <p className="mt-1 font-mono tabular-nums font-bold text-slate-700">
                                {(() => {
                                  const skuWtStr = skuWeightMap.get(product.productName?.trim().toLowerCase());
                                  const skuWt = parseFloat(skuWtStr || "") || 0;
                                  const totalWt = skuWt * qty;
                                  if (!totalWt) return "—";
                                  return fmtNum(totalWt, 4);
                                })()}
                              </p>
                            </div>
                            <div className="rounded-md bg-slate-50 p-2">
                              <p className="text-[10px] font-black uppercase text-slate-400">Actual Qty</p>
                              <p className="mt-1 font-mono tabular-nums font-bold text-blue-700">{fmtNum(product.actualQty || 0, 4)}</p>
                            </div>
                            <div className="rounded-md bg-slate-50 p-2">
                              <p className="text-[10px] font-black uppercase text-slate-400">Rate Inc. Taxes (₹)</p>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <p className="mt-1 cursor-pointer font-mono tabular-nums font-bold text-slate-700">
                                    {originalRate ? fmtNum(originalRate, 2) : "—"}
                                  </p>
                                </PopoverTrigger>
                                <PopoverContent className="w-fit p-3 bg-white border-2 border-blue-100 shadow-xl rounded-xl">
                                  <div className="space-y-1.5">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Freight Rate</p>
                                    <p className="text-sm font-black text-blue-700 leading-none">
                                      {product.freight_rate ? `Freight Rate (₹): ${product.freight_rate}` : "No Freight Rate Available"}
                                    </p>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                            <div className="rounded-md bg-slate-50 p-2">
                              <p className="text-[10px] font-black uppercase text-slate-400">Rate (₹)</p>
                              <p className="mt-1 font-mono tabular-nums font-bold text-slate-700">
                                {originalRate ? fmtNum(originalRate / 1.05, 2) : "—"}
                              </p>
                            </div>
                            <div className="rounded-md bg-slate-50 p-2">
                              <p className="text-[10px] font-black uppercase text-slate-400">Taxable Amount (₹)</p>
                              <p className="mt-1 font-mono tabular-nums font-bold text-slate-700">{taxableAmount ? fmtNum(taxableAmount, 2) : "—"}</p>
                            </div>
                            <div className="rounded-md bg-green-50 p-2">
                              <p className="text-[10px] font-black uppercase text-green-700">Invoice No</p>
                              {product.invoice_copy ? (
                                <a href={product.invoice_copy} target="_blank" rel="noopener noreferrer" className="mt-1 block font-bold text-green-700 underline break-words">
                                  {product.invoiceNo || "View Invoice"}
                                </a>
                              ) : (
                                <p className="mt-1 font-bold text-green-700 break-words">{product.invoiceNo || "—"}</p>
                              )}
                            </div>
                            <div className="rounded-md bg-slate-50 p-2">
                              <p className="text-[10px] font-black uppercase text-slate-400">Invoice Date</p>
                              <p className="mt-1 font-bold">{product.invoiceDate ? new Date(product.invoiceDate).toLocaleDateString("en-GB") : "—"}</p>
                            </div>
                            <div className="rounded-md bg-slate-50 p-2 col-span-2">
                              <p className="text-[10px] font-black uppercase text-slate-400">Truck No</p>
                              <p className="mt-1 font-bold">{(product.truckNo || "—").toUpperCase()}</p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    <div className="grid grid-cols-2 gap-3 rounded-lg border bg-slate-50 p-3 text-xs">
                      <div>
                        <p className="text-[9px] uppercase font-black text-slate-500">Total Weight</p>
                        <p className="mt-1 font-mono tabular-nums font-black text-blue-700">
                          {(() => {
                            const totalSelectedWt = selectedGroups.flatMap(g => g._allProducts)
                              .filter(p => selectedProducts.includes(p._rowKey))
                              .reduce((sum, p) => {
                                const skuWtStr = skuWeightMap.get(p.productName?.trim().toLowerCase());
                                const skuWt = parseFloat(skuWtStr || "") || 0;
                                const q = parseFloat(p.actualQty) || 0;
                                return sum + (skuWt * q);
                              }, 0);
                            return fmtNum(totalSelectedWt, 4);
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* GST & Invoice Summary */}
                <InvoiceSummary
                  selectedGroups={selectedGroups}
                  selectedProducts={selectedProducts}
                />
              </div>
            )}

            {/* Verification Form (Bottom) — hidden while viewing an issued record */}
            {viewOnly ? (
              <div className="mt-8 space-y-3 border border-amber-200 rounded-lg p-4 sm:p-6 bg-amber-50/60 shadow-sm">
                <h3 className="text-sm font-bold text-amber-800 flex items-center gap-2 border-b border-amber-200 pb-2">
                  <Eye className="h-4 w-4 text-amber-600" />
                  Issue Reported — Awaiting Re-issue from Make Invoice
                </h3>
                <p className="text-xs text-amber-700 font-medium">
                  This invoice was reported as an issue and sent back to the Make Invoice stage.
                  It cannot be verified here until Make Invoice corrects and re-issues it. You can review the details above in the meantime.
                </p>
                {selectedGroups[0]?._allProducts?.[0]?.remarks_2 && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-amber-500 mb-1">Reported Issue Remarks</p>
                    <p className="text-xs font-medium text-amber-800 italic break-words">"{selectedGroups[0]._allProducts[0].remarks_2}"</p>
                  </div>
                )}
              </div>
            ) : (
            <div className="mt-8 space-y-6 border rounded-lg p-4 sm:p-6 bg-white shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b pb-2">
                <CheckCircle className="h-4 w-4 text-blue-600" />
                Final Verification Logic
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Verification Status <span className="text-red-500">*</span></Label>
                  <Select value={checkData.status} onValueChange={(val) => setCheckData({ ...checkData, status: val })}>
                    <SelectTrigger className="h-10 border-2 focus:ring-2 focus:ring-blue-500 transition-all font-bold tracking-tight bg-white">
                      <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Verified" className="font-bold text-green-600">Verified</SelectItem>
                      <SelectItem value="Issue" className="font-bold text-red-600">Issue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Remarks {checkData.status === "Issue" && <span className="text-red-500">*</span>}</Label>
                  <Textarea
                    value={checkData.remarks}
                    onChange={(e) => setCheckData({ ...checkData, remarks: e.target.value })}
                    placeholder="Enter verification remarks..."
                    className="h-[38px] min-h-[38px]"
                  />
                </div>
              </div>
            </div>
            )}

            <DialogFooter className="mt-8 border-t pt-4 bg-gray-50 -mx-3 sm:-mx-6 -mb-3 sm:-mb-6 px-3 sm:px-6 py-4 gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isProcessing} className="w-full sm:w-auto">
                {viewOnly ? "Close" : "Cancel"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const group = selectedGroups[0]
                  if (!group) return
                  const allProducts = selectedGroups.flatMap((g: any) => g._allProducts)
                  const customerName = group.customerName || '—'
                  const vehicleNo = group.vehicleNo || '—'
                  const doNumber = group.doNumber || '—'
                  const invoiceNo = group.invoiceNo || '—'
                  const invoiceCopy = allProducts[0]?.invoice_copy || null
                  const productRows = allProducts.map((p: any) => `
                    <tr>
                      <td style="border:1px solid #ddd;padding:8px">${p.productName || '—'}</td>
                      <td style="border:1px solid #ddd;padding:8px;text-align:center">${p.actualQty || p.qtyToDispatch || '—'} ${p.unit || ''}</td>
                      <td style="border:1px solid #ddd;padding:8px;text-align:right">₹${parseFloat(p.rate || p.final_rate || 0).toFixed(2)}</td>
                      <td style="border:1px solid #ddd;padding:8px;text-align:right">₹${(parseFloat(p.actualQty || p.qtyToDispatch || 0) * parseFloat(p.rate || p.final_rate || 0)).toFixed(2)}</td>
                    </tr>
                  `).join('')
                  const printContent = `
                    <html><head><title>Invoice Verification - ${invoiceNo}</title>
                    <style>
                      body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
                      h1 { font-size: 20px; margin-bottom: 4px; }
                      .subtitle { color: #555; font-size: 13px; margin-bottom: 20px; }
                      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
                      .field { background: #f8f8f8; padding: 10px 14px; border-radius: 6px; }
                      .field label { font-size: 11px; color: #666; text-transform: uppercase; }
                      .field p { font-size: 14px; font-weight: 600; margin: 2px 0 0; }
                      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
                      th { background: #1e293b; color: white; padding: 10px 8px; font-size: 13px; }
                      td { font-size: 13px; }
                      .inv-link { display: block; margin: 16px 0; padding: 12px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; font-size: 14px; }
                      @media print { button { display: none; } }
                    </style></head>
                    <body>
                      <h1>Shree Shyam Oil Extractions</h1>
                      <div class="subtitle">Invoice Verification Sheet — Check Invoice Stage</div>
                      <div class="grid">
                        <div class="field"><label>Customer Name</label><p>${customerName}</p></div>
                        <div class="field"><label>DO Number</label><p>${doNumber}</p></div>
                        <div class="field"><label>Vehicle No.</label><p>${vehicleNo}</p></div>
                        <div class="field"><label>Invoice No.</label><p>${invoiceNo}</p></div>
                        <div class="field"><label>Invoice Date</label><p>${allProducts[0]?.invoice_date || '—'}</p></div>
                        <div class="field"><label>Bill Amount</label><p>₹${parseFloat(allProducts[0]?.bill_amount || 0).toFixed(2)}</p></div>
                        <div class="field"><label>Insurance</label><p>${allProducts[0]?.insurance_details || '—'}</p></div>
                        <div class="field"><label>Driver Advance (Cash)</label><p>₹${allProducts[0]?.driver_advance_cash || 0}</p></div>
                        <div class="field"><label>Driver Advance (Bank)</label><p>₹${allProducts[0]?.driver_advance_bank || 0}</p></div>
                        <div class="field"><label>Diesel Amount</label><p>₹${allProducts[0]?.diesel_amount || 0}</p></div>
                      </div>
                      ${invoiceCopy ? `<div class="inv-link">📎 Invoice Copy attached: <a href="${invoiceCopy}" target="_blank">${invoiceCopy.split('/').pop()}</a></div>` : '<div class="inv-link" style="color:#c00">⚠️ No Invoice Copy attached</div>'}
                      <table>
                        <thead><tr><th>Product</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
                        <tbody>${productRows}</tbody>
                      </table>
                    </body></html>
                  `
                  const win = window.open('', '_blank')
                  if (win) { win.document.write(printContent); win.document.close(); win.focus(); win.print() }
                }}
                className="w-full sm:w-auto gap-2"
                title="Print Verification Sheet"
              >
                <Printer className="h-4 w-4" />
                Print Data
              </Button>
              {!viewOnly && (
                <Button
                  onClick={handleSubmit}
                  disabled={isProcessing || !checkData.status || isReadOnly}
                  className="w-full bg-blue-600 hover:bg-blue-700 min-w-[150px] sm:w-auto"
                  title={isReadOnly ? "View Only Access" : "Complete Verification"}
                >
                  {isProcessing ? "Processing..." : "Complete Verification"}
                </Button>
              )}
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </WorkflowStageShell>
  )
}
