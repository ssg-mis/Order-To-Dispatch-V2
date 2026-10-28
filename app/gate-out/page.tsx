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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { FileUploadField } from "@/components/file-upload-field"
import { Upload, CheckCircle, Settings2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, CheckSquare, Eye, FileText, ExternalLink, ArrowUpDown, ArrowUp, ArrowDown, Printer, Download } from "lucide-react"
import { generateGatePassPdf } from "@/lib/gate-pass-pdf-lazy"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { WORKFLOW_STAGE_COLUMNS as ALL_COLUMNS } from "@/lib/workflow-columns"
import { ColumnToggleContent } from "@/components/ui/column-toggle-content"
import { gateOutApi, orderApi, skuApi } from "@/lib/api-service"
import { isStaleWriteError } from "@/lib/stale-write"
import { cn } from "@/lib/utils"
import { OrderChargesPanel } from "@/components/order-punch/order-charges-panel"
import { useAuth } from "@/hooks/use-auth"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { StageHistoryTab } from "@/components/workflow/stage-history-tab"
import { usePersistedColumns } from "@/hooks/use-persisted-columns"
import { useColumnOrder } from "@/hooks/use-column-order"
import { SortableTableHead } from "@/components/ui/sortable-table-head"
import { ColumnDragProvider } from "@/components/ui/column-drag-provider"
import { RateInclusiveTaxPopover } from "@/components/workflow/rate-inclusive-tax-popover"
import { RateWithoutGstHeading } from "@/components/workflow/rate-without-gst-heading"
import { GstTaxRows } from "@/components/workflow/gst-tax-rows"
import { rateWithoutGstText, summarizeGst, sumTaxable, taxableOf } from "@/lib/gst"
import { usePersistedFilters } from "@/hooks/use-persisted-filters"
import { useStageTable, type StageColDef } from "@/hooks/use-stage-table"
import { StageListHeader, StageToolbar, StageFilterSelect, StageColumnsMenu, StageActiveChips, StagePagination, StageActionFooter } from "@/components/stage-list"
import { StageTableHeaderRows, bodyCellClass } from "@/components/stage-table-header-rows"
import { fmtNum, fmtDate, fmtAmount, isAmountCol } from "@/lib/table-format"
import { fmtWeight } from "@/lib/weight-format"
import { useWeightDecimals } from "@/hooks/use-weight-decimals"

const MAX_COMPRESSED_IMAGE_BYTES = 850 * 1024
const MAX_COMPRESSED_IMAGE_DIMENSION = 1600

async function compressImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file

  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement("canvas")
  const context = canvas.getContext("2d")

  if (!context) {
    bitmap.close()
    return file
  }

  const toBlob = (quality: number) =>
    new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", quality))

  let maxDimension = Math.min(MAX_COMPRESSED_IMAGE_DIMENSION, Math.max(bitmap.width, bitmap.height))
  let blob: Blob | null = null

  while (maxDimension >= 320) {
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    canvas.width = width
    canvas.height = height
    context.clearRect(0, 0, width, height)
    context.drawImage(bitmap, 0, 0, width, height)

    let quality = 0.82
    blob = await toBlob(quality)

    while (blob && blob.size > MAX_COMPRESSED_IMAGE_BYTES && quality > 0.34) {
      quality -= 0.08
      blob = await toBlob(quality)
    }

    if (blob && blob.size <= MAX_COMPRESSED_IMAGE_BYTES) break
    maxDimension -= 250
  }

  bitmap.close()

  if (!blob || blob.size > MAX_COMPRESSED_IMAGE_BYTES) return file

  const cleanName = file.name.replace(/\.[^.]+$/, "")
  return new File([blob], `${cleanName}.jpg`, { type: "image/jpeg", lastModified: Date.now() })
}

// GST + invoice total of a set of products (one party / invoice). GST % per product and the same-state /
// other-state split come from the masters, carried from Dispatch Planning.
function computeInvoice(selProds: any[]) {
  const lines = selProds.map((p) => ({
    taxable: taxableOf(Number(p.rate) || 0, parseFloat(p.actualQty) || 0, p),
    product: p,
  }))
  const firstProd = selProds[0]
  const gst = summarizeGst(lines, firstProd?.depot_gst_state_code, firstProd?.customer_gst_state_code)
  const totalTaxable = gst.totalTaxable

  // Without every GST rate and the state split there is no honest total: show "—" rather than guess.
  const rawTotal = gst.complete && totalTaxable !== null ? totalTaxable + gst.cgst + gst.sgst + gst.igst : null
  const invoiceTotal = rawTotal === null ? null : Math.round(rawTotal)
  const roundOff = rawTotal === null || invoiceTotal === null ? null : parseFloat((invoiceTotal - rawTotal).toFixed(2))
  return { gst, totalTaxable, invoiceTotal, roundOff }
}

function InvoiceSummary({ selectedGroups, selectedProducts, title = "Invoice Summary" }: {
  selectedGroups: any[]
  selectedProducts: string[]
  title?: string
}) {
  const selProds = selectedGroups.flatMap((g) => g._allProducts)
    .filter((p) => selectedProducts.includes(p._rowKey))
  const { gst, totalTaxable, invoiceTotal, roundOff } = computeInvoice(selProds)

  return (
    <div className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{title}</p>
      </div>
      <div className="py-4 pl-4 pr-6 max-w-sm ml-auto space-y-2">
        <div className="flex justify-between items-center text-xs">
          <span className="font-black uppercase text-slate-500 text-[10px]">Total Taxable Amount</span>
          <span className="font-mono font-bold text-slate-700">{totalTaxable === null ? "—" : `₹${fmtAmount(totalTaxable)}`}</span>
        </div>
        <GstTaxRows summary={gst} />
        <div className="flex justify-between items-center text-xs">
          <span className="font-black uppercase text-slate-500 text-[10px]">Round Off</span>
          <span className="font-mono font-bold text-slate-500">
            {roundOff === null ? "—" : roundOff > 0 ? `+₹${fmtAmount(roundOff)}` : roundOff < 0 ? `-₹${fmtAmount(Math.abs(roundOff))}` : `₹0.00`}
          </span>
        </div>
        <div className="flex justify-between items-center border-t border-slate-200 pt-2">
          <span className="font-black uppercase text-slate-800 text-[11px]">Total Invoice Amount</span>
          <span className="font-mono font-black text-blue-700 text-sm">{invoiceTotal === null ? "—" : `₹${fmtAmount(invoiceTotal)}`}</span>
        </div>
      </div>
    </div>
  )
}

// Grand totals of everything being gated out: weight (KGS), invoice amount and quantity across every party,
// with a party-wise breakdown above the totals when the load carries more than one party / invoice.
function GrandTotals({ sections, selectedProducts, skuWeightMap, wd }: {
  sections: any[]
  selectedProducts: string[]
  skuWeightMap: Map<string, string>
  wd: number
}) {
  const weightOf = (prods: any[]) =>
    prods.reduce(
      (sum: number, p: any) => sum + (parseFloat(skuWeightMap.get(p.productName?.trim().toLowerCase()) || "") || 0) * (parseFloat(p.actualQty) || 0),
      0
    )
  const qtyOf = (prods: any[]) => prods.reduce((sum: number, p: any) => sum + (parseFloat(p.actualQty) || 0), 0)

  // Each party / invoice has its own GST split, so the grand invoice amount is the sum of the per-party totals.
  const rows = sections
    .map((g) => {
      const prods = g._allProducts.filter((p: any) => selectedProducts.includes(p._rowKey))
      return {
        key: g._rowKey as string,
        party: g.customerName as string,
        invoice: g.invoiceNo as string,
        items: prods.length,
        qty: qtyOf(prods),
        weight: weightOf(prods),
        amount: prods.length > 0 ? computeInvoice(prods).invoiceTotal : null,
      }
    })
    .filter((r) => r.items > 0)

  const totalQty = rows.reduce((a, r) => a + r.qty, 0)
  const totalWeight = rows.reduce((a, r) => a + r.weight, 0)
  const grandInvoice = rows.length > 0 && rows.every((r) => r.amount !== null) ? rows.reduce((a, r) => a + (r.amount as number), 0) : null

  return (
    <div className="border-2 border-blue-200 rounded-2xl sm:rounded-3xl bg-white shadow-md overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-gradient-to-r from-blue-700 to-blue-600">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-white">Grand Total</p>
        <p className="text-[10px] font-bold uppercase tracking-widest text-blue-100">
          {rows.length} {rows.length === 1 ? "party" : "parties"} · {rows.reduce((a, r) => a + r.items, 0)} items
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
              <th className="px-4 sm:px-6 py-2 text-left">Party</th>
              <th className="px-4 py-2 text-left">Invoice</th>
              <th className="px-4 py-2 text-right">Quantity</th>
              <th className="px-4 py-2 text-right">Weight (KGS)</th>
              <th className="px-4 sm:px-6 py-2 text-right">Invoice Amount (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.key} className="hover:bg-slate-50/60">
                <td className="px-4 sm:px-6 py-2 font-bold text-slate-800 uppercase">{r.party}</td>
                <td className="px-4 py-2 font-mono font-semibold text-green-700">{r.invoice}</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-700">{fmtNum(r.qty, 0)}</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-700">{fmtWeight(r.weight, wd)}</td>
                <td className="px-4 sm:px-6 py-2 text-right font-mono tabular-nums font-bold text-slate-900">{r.amount === null ? "—" : fmtAmount(r.amount)}</td>
              </tr>
            ))}
          </tbody>
          {/* Grand totals sit in the same columns they add up */}
          <tfoot>
            <tr className="bg-blue-50 border-t-2 border-blue-200">
              <td className="px-4 sm:px-6 py-4 text-xs font-black uppercase tracking-wider text-blue-800" colSpan={2}>Grand Total</td>
              <td className="px-4 py-4 text-right font-mono tabular-nums text-base font-black text-slate-900">{fmtNum(totalQty, 0)}</td>
              <td className="px-4 py-4 text-right font-mono tabular-nums text-base font-black text-slate-900">{fmtWeight(totalWeight, wd)}</td>
              <td className="px-4 sm:px-6 py-4 text-right font-mono tabular-nums text-lg font-black text-blue-700">{grandInvoice === null ? "—" : fmtAmount(grandInvoice)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

const NUMERIC_DYN_COLS = new Set(["actual_qty_dispatch", "orderQty", "qtyToDispatch", "altQty", "rate", "ratePerLtr", "ratePer15Kg", "rateOfMaterial", "totalWithGst", "advanceAmount", "bill_amount", "actual_qty", "actual_approval_qty", "gross_weight", "tare_weight", "net_weight", "extra_weight", "damage_qty"])
const DATE_DYN_COLS = new Set(["deliveryDate", "dispatch_date_confirmed", "fitness_end_date", "insurance_end_date", "tax_end_date", "pollution_end_date", "permit1_end_date", "permit2_end_date", "invoice_date"])
// Money / rate columns carry the unit in the heading (no ₹ inside cells).
const DYN_LABEL_OVERRIDES: Record<string, string> = {
  rate: "Rate (₹)",
  ratePerLtr: "Rate Per Ltr (₹)",
  ratePer15Kg: "Rate Per 15 kg (₹)",
  rateOfMaterial: "Rate Of Material (₹)",
  totalWithGst: "Total Amount With Gst (₹)",
  advanceAmount: "Advance Amount (₹)",
  bill_amount: "Bill Amount (₹)",
}
// Decimals per numeric column: whole counts = 0, quantities = 4, money = 2.
const NUM_DECIMALS: Record<string, number> = { products: 0, actual_qty_dispatch: 0, orderQty: 4, qtyToDispatch: 4, altQty: 4, rate: 2, ratePerLtr: 2, ratePer15Kg: 2, rateOfMaterial: 2, totalWithGst: 2, advanceAmount: 2, bill_amount: 2, actual_qty: 4, actual_approval_qty: 4, damage_qty: 4 }

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

export default function GateOutPage() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const { toast } = useToast()
  const wd = useWeightDecimals()
  const numDecimals = useMemo<Record<string, number>>(() => ({ ...NUM_DECIMALS, gross_weight: wd, tare_weight: wd, net_weight: wd, extra_weight: wd }), [wd])
  const { isReadOnly, user, isAdmin, isFeatureEnabled } = useAuth()
  // Tab is remembered permanently by the shell (persistKey); filters / quick search are session-scoped.
  // Refresh/reload only reloads data - never clears it. Reset (resetAllFilters) is the only way to clear.
  const [listView, patchListView] = usePersistedFilters("gate-out", {
    quickSearch: "",
    customerFilter: "ALL",
    vehicleFilter: "ALL",
  })
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending")
  const { quickSearch, customerFilter, vehicleFilter } = listView
  const setQuickSearch = (v: string) => patchListView({ quickSearch: v })
  const setCustomerFilter = (v: string) => patchListView({ customerFilter: v })
  const setVehicleFilter = (v: string) => patchListView({ vehicleFilter: v })

  const [filterValues, setFilterValues] = useState({
    status: "",
    startDate: "",
    endDate: "",
    partyName: "",
    search: "",
    manualSaudaNo: ""
  })
  const [isProcessing, setIsProcessing] = useState(false)

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
  const skuGrossWeightMap = useMemo(() => {
    const map = new Map<string, string>()
    if (Array.isArray(skuDetailsData)) {
      for (const sku of skuDetailsData) {
        if (sku.sku_name) {
          const weight = sku.gross_weight ?? ""
          map.set(sku.sku_name.trim().toLowerCase(), weight ? String(weight) : "—")
        }
      }
    }
    return map
  }, [skuDetailsData])

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

  const [visibleColumns, setVisibleColumns] = usePersistedColumns(
    "gate-out",
    ["partySoDate", "orderNo", "customerName", "invoiceNo", "status", "products"]
  )
  const GATE_OUT_STD_IDS = ["partySoDate", "customerName", "orderNo", "actual1Date", "processid", "invoiceNo", "vehicleNo", "orderPunchRemarks", "status", "products"]
  const [columnOrder, setColumnOrder] = useColumnOrder("gate-out", [...GATE_OUT_STD_IDS, ...ALL_COLUMNS.map(c => c.id).filter(id => !GATE_OUT_STD_IDS.includes(id))])
  const ALWAYS_VISIBLE_GATE_OUT = new Set<string>([])
  const orderedVisible = columnOrder.filter(id => ALWAYS_VISIBLE_GATE_OUT.has(id) || visibleColumns.includes(id))
  const dynamicColumns = visibleColumns.filter(id => !GATE_OUT_STD_IDS.includes(id))
  const handleColumnReorder = useCallback((newVisibleOrder: string[]) => {
    const newOrderSet = new Set(newVisibleOrder)
    const hiddenCols = columnOrder.filter(id => !newOrderSet.has(id))
    setColumnOrder([...newVisibleOrder, ...hiddenCols])
  }, [columnOrder, setColumnOrder])

  // Selection & Dialog State
  const [selectedGroups, setSelectedGroups] = useState<any[]>([]) // Changed to array for multi-group support
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [expandedOrders, setExpandedOrders] = useState<string[]>([]) // State to manage expanded sections
  const [commonOpen, setCommonOpen] = useState(false) // Common Details card (vehicle / driver / load) - closed by default

  // Gate Out Form State
  const [isUploading, setIsUploading] = useState<string | null>(null)
  const [gateOutData, setGateOutData] = useState({
    gatePassFile: null as File | null,
    gatePassFileName: "",
    vehicleLoadedImage: null as File | null,
    vehicleLoadedImageName: "",
  })

  // The two evidence files are only uploaded on submit, so preview images come from local blob URLs.
  const useLocalPreview = (file: File | null) => {
    const [url, setUrl] = useState<string | undefined>(undefined)
    useEffect(() => {
      if (!file || !file.type.startsWith("image/") || /hei[cf]/i.test(file.type)) { setUrl(undefined); return }
      const u = URL.createObjectURL(file)
      setUrl(u)
      return () => URL.revokeObjectURL(u)
    }, [file])
    return url
  }
  const gatePassPreview = useLocalPreview(gateOutData.gatePassFile)
  const vehicleImagePreview = useLocalPreview(gateOutData.vehicleLoadedImage)

  // Pending query with numeric pagination
  const [pendingPage, setPendingPage] = useState(1)
  const limit = 20
  const {
    data: pendingData,
    isLoading: isPendingLoading,
    refetch: refetchPending,
  } = useQuery({
    queryKey: ["gate-out-pending", filterValues, pendingPage],
    queryFn: async () => {
      const response = await gateOutApi.getPending({
        page: pendingPage,
        limit,
        search: filterValues.search,
        manual_sauda_no: filterValues.manualSaudaNo,
        do_date_from: filterValues.startDate,
        do_date_to: filterValues.endDate,
        party_name: filterValues.partyName === "all" ? undefined : filterValues.partyName,
      });
      return response.success ? response.data : { orders: [], pagination: { total: 0 } };
    },
  });

  useEffect(() => {
    setPendingPage(1);
  }, [filterValues]);

  const pendingOrders = useMemo(() => {
    return pendingData?.orders || [];
  }, [pendingData]);

  const handleFileUpload = (file: File, type: 'gatePass' | 'vehicleImage') => {
    if (!file) return;

    if (type === 'gatePass') {
      setGateOutData(p => ({
        ...p,
        gatePassFile: file,
        gatePassFileName: file.name
      }));
    } else {
      setGateOutData(p => ({
        ...p,
        vehicleLoadedImage: file,
        vehicleLoadedImageName: file.name
      }));
    }
  };

  const uploadSelectedFile = async (file: File, type: 'gatePass' | 'vehicleImage') => {
    setIsUploading(type);
    try {
      const uploadFile = await compressImageForUpload(file);
      const response = await orderApi.uploadFile(uploadFile);
      if (response.success) {
        return response.data.url;
      }
      throw new Error(response.message || "Failed to upload file to S3");
    } catch (error: any) {
      console.error("Upload failed:", error);
      throw error;
    } finally {
      setIsUploading(null);
    }
  };


  /* Filter Logic */

  // Search, Manual Sauda No., DO Date range and Party Name are all applied
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
      // Extract only date part (YYYY-MM-DD) robustly from LRC actual_1, matched by so_no
      const actualDateVal = order.lrc_actual_1 || order.actual_1
      const actual1Str = actualDateVal ? (() => { 
        const d = new Date(actualDateVal); 
        if (isNaN(d.getTime())) return String(actualDateVal).split(/[T ]/)[0].trim(); 
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; 
      })() : "no-date"
      const vehicleNo = (order.truck_no || "—").trim().toUpperCase().replace(/\s+/g, "")

      // Group by actual_1 date and Vehicle No.
      const groupKey = `${actual1Str}-${vehicleNo}`

      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          _rowKey: groupKey,
          customerName: partyName,
          invoiceNo: invoiceNo,
          actual1Date: actual1Str,
          doNumberList: new Set<string>(),
          _allProducts: [],
          _ordersMap: {}, // Group items by specific DO for interleaved view
          _productCount: 0
        }
      }

      const group = grouped[groupKey]
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
          customerAddress: order.customer_address || "—",
          paymentTerms: order.payment_terms || "—",
          advanceAmount: order.advance_amount || 0,
          isBroker: order.is_order_through_broker || false,
          isOrderThrough: order.is_order_through || "—",
          brokerName: order.broker_name || "—",
          partyCredit: order.party_credit_status || "Good",
          totalAmount: order.total_amount_with_gst || "—",
          oilType: order.oil_type || "—",
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
        rate: (((parseFloat(order.rate_of_material) || 0) * (parseFloat(order.nos_per_main_uom) || 1)) + (parseFloat(order.freight_rate) || 0)) - (parseFloat(order.cd_amount || order.cdAmount) || 0),
        amount: ((((parseFloat(order.rate_of_material) || 0) * (parseFloat(order.nos_per_main_uom) || 1)) + (parseFloat(order.freight_rate) || 0)) - (parseFloat(order.cd_amount || order.cdAmount) || 0)) * (parseFloat(order.actual_qty_dispatch) || 0),
        invoiceNo: order.invoice_no,
        invoiceDate: order.invoice_date,
        billAmount: order.bill_amount,
        actualQty: order.actual_qty_dispatch,
        truckNo: order.truck_no,
        rstNo: order.rst_no,
        grossWeight: order.gross_weight,
        tareWeight: order.tare_weight,
        netWeight: order.net_weight,
        weightDiff: order.difference || 0,
        transporterName: order.transporter_name,
        fitness: order.fitness,
        fitness_end_date: order.fitness_end_date,
        insurance: order.insurance,
        insurance_end_date: order.insurance_end_date,
        polution: order.polution,
        pollution_end_date: order.pollution_end_date,
        tax_copy: order.tax_copy,
        tax_end_date: order.tax_end_date,
        permit1: order.permit1,
        permit1_end_date: order.permit1_end_date,
        permit2_out_state: order.permit2_out_state,
        permit2_end_date: order.permit2_end_date,
        check_status: order.check_status,
        remarks: order.remarks,
        weightment_slip_copy: order.weightment_slip_copy,
        reasonForDiff: order.reason_of_difference_in_weight_if_any_speacefic,
        reason_of_difference_in_weight_if_any_speacefic: order.reason_of_difference_in_weight_if_any_speacefic,
        bilty_no: order.bilty_no,
        processid: order.processid || null
      }

      group._ordersMap[orderKey]._products.push(product)
      group._allProducts.push(product)
      group._productCount = group._allProducts.length
    })

    // Finalize DO numbers string
    const result = Object.values(grouped).map((g: any) => {
      const customers = Array.from(new Set(g._allProducts.map((p: any) => p.party_name || p.partyName))).filter(Boolean)

      return {
        ...g,
        customerName: customers.length > 1 ? `Multiple Parties (${customers.length})` : customers[0] || g.customerName,
        customerNames: customers,
        partySoDate: formatDate(g._allProducts[0]?.party_so_date),
        doNumber: Array.from(g.doNumberList as Set<string>).join(", "),
        orderNo: Array.from(g.doNumberList as Set<string>).join(", "),
        processId: g._allProducts[0]?.processid || "—",
        processid: g._allProducts[0]?.processid || "—",
        vehicleNo: (g._allProducts[0]?.truckNo || "—").toUpperCase(),
        actual1Date: formatDate(g._allProducts[0]?.lrc_actual_1 || g._allProducts[0]?.actual_1),
        // A vehicle can carry several invoices / companies, so list every distinct invoice (each with its own copy link).
        invoiceList: (() => {
          const seen = new Map<string, string | null>()
          g._allProducts.forEach((p: any) => {
            const no = p.invoice_no
            if (no && (!seen.has(no) || !seen.get(no))) seen.set(no, p.invoice_copy || null)
          })
          return Array.from(seen, ([no, copy]) => ({ no, copy }))
        })(),
        invoiceNo: (() => {
          const nos = Array.from(new Set(g._allProducts.map((p: any) => p.invoice_no).filter(Boolean)))
          return nos.length ? nos.join(", ") : "—"
        })(),
        orderPunchRemarks: g._allProducts[0]?.order_punch_remarks || "—",
        uploadSo: g._allProducts[0]?.upload_so || g._allProducts[0]?.uploadSo || null,
        // actual_qty_dispatch is a PER-PRODUCT line quantity, so the group total must
        // sum across every product — otherwise the dynamic-column fallback shows only
        // the first product's qty instead of the full group total.
        actual_qty_dispatch: g._allProducts.reduce((sum: number, p: any) => sum + (Number(p.actual_qty_dispatch) || 0), 0),
      }
    })

    return result
  }, [filteredPendingOrders])

  // ── Stage list table state (column search / date range / sort / totals) ──

  const stageCols = useMemo<StageColDef<any>[]>(() => {
    const std: StageColDef<any>[] = [
      { id: "partySoDate", label: "DO Date", type: "date", accessor: (g) => g._allProducts?.[0]?.party_so_date },
      { id: "customerName", label: "Customer Name", accessor: (g) => (g.customerNames && g.customerNames.length > 0 ? g.customerNames.join(", ") : g.customerName) },
      { id: "orderNo", label: "DO Number", accessor: (g) => g.orderNo },
      { id: "actual1Date", label: "Dispatched Date", type: "date", accessor: (g) => g._allProducts?.[0]?.lrc_actual_1 || g._allProducts?.[0]?.actual_1 },
      { id: "processid", label: "Manual Sauda No.", accessor: (g) => g.processId },
      { id: "invoiceNo", label: "Invoice No.", accessor: (g) => g.invoiceNo },
      { id: "vehicleNo", label: "Vehicle No.", accessor: (g) => g.vehicleNo },
      { id: "orderPunchRemarks", label: "Order Punch Remarks", accessor: (g) => g.orderPunchRemarks },
      { id: "status", label: "Status", accessor: () => "Ready" },
      { id: "products", label: "Items", type: "number", accessor: (g) => g._productCount || 0, total: true },
    ]
    const stdIds = new Set(std.map((c) => c.id))
    const dyn: StageColDef<any>[] = ALL_COLUMNS.filter((c) => !stdIds.has(c.id)).map((c) =>
      NUMERIC_DYN_COLS.has(c.id)
        ? { id: c.id, label: DYN_LABEL_OVERRIDES[c.id] || c.label, type: "number" as const, accessor: (g: any) => Number(getDynamicColumnValue(g, c.id)) || 0, total: ["bill_amount", "gross_weight", "tare_weight", "net_weight", "extra_weight"].includes(c.id) }
        : DATE_DYN_COLS.has(c.id)
          ? { id: c.id, label: c.label, type: "date" as const, accessor: (g: any) => { const v = getDynamicColumnValue(g, c.id); return v === "—" ? null : v } }
          : { id: c.id, label: c.label, accessor: (g: any) => String(getDynamicColumnValue(g, c.id)) }
    )
    return [...std, ...dyn]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const baseFilter = useCallback(
    (g: any) => {
      if (customerFilter !== "ALL") {
        const names: string[] = g.customerNames && g.customerNames.length > 0 ? g.customerNames : [g.customerName]
        if (!names.includes(customerFilter)) return false
      }
      if (vehicleFilter !== "ALL" && g.vehicleNo !== vehicleFilter) return false
      const q = quickSearch.trim().toLowerCase()
      if (q) {
        const hay = [g.orderNo, g.customerName, g.invoiceNo, g.vehicleNo, g.processId, g.orderPunchRemarks].join(" ").toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customerFilter, vehicleFilter, quickSearch]
  )

  const table = useStageTable<any>({ rows: displayRows, columns: stageCols, baseFilter, persistKey: "gate-out" })
  const orderedCols = useMemo(
    () => orderedVisible.map((id) => stageCols.find((c) => c.id === id)).filter(Boolean) as StageColDef<any>[],
    [orderedVisible.join("|"), stageCols] // eslint-disable-line react-hooks/exhaustive-deps
  )
  const colOf = (id: string) => stageCols.find((c) => c.id === id)
  const customerOptions = useMemo(
    () => Array.from(new Set(displayRows.flatMap((g: any) => (g.customerNames && g.customerNames.length > 0 ? g.customerNames : [g.customerName])).filter(Boolean))).sort() as string[],
    [displayRows]
  )
  const vehicleOptions = useMemo(
    () => Array.from(new Set(displayRows.map((g: any) => g.vehicleNo).filter((v: string) => v && v !== "—"))).sort() as string[],
    [displayRows]
  )
  const activeFiltersCount =
    (customerFilter !== "ALL" ? 1 : 0) + (vehicleFilter !== "ALL" ? 1 : 0) + (quickSearch.trim() ? 1 : 0) + table.activeColumnFilterCount
  const resetAllFilters = () => {
    patchListView({ customerFilter: "ALL", vehicleFilter: "ALL", quickSearch: "" })
    table.clearColumnFilters()
  }


  // A vehicle can carry several parties / invoices. The dialog shows each party (and invoice) as its own block,
  // with its own products, GST and amount - so split the vehicle group into one section per party + invoice.
  const splitGroupByParty = (group: any): any[] => {
    const buckets = new Map<string, any[]>()
    group._allProducts.forEach((p: any) => {
      const party = String(p.party_name || p.partyName || "Unknown Customer").trim()
      const key = `${p.customer_id ?? party.toUpperCase()}|${p.invoiceNo || p.invoice_no || ""}`
      if (!buckets.has(key)) buckets.set(key, [])
      buckets.get(key)!.push(p)
    })
    if (buckets.size <= 1) return [group]
    return Array.from(buckets.values()).map((prods, i) => {
      const party = String(prods[0].party_name || prods[0].partyName || "Unknown Customer").trim()
      const doNos = Array.from(new Set(prods.map((p: any) => p.specificOrderNo)))
      const ordersMap: Record<string, any> = {}
      doNos.forEach((d: any) => {
        const orig = group._ordersMap[d]
        if (orig) ordersMap[d] = { ...orig, _products: prods.filter((p: any) => p.specificOrderNo === d) }
      })
      const invNos = Array.from(new Set(prods.map((p: any) => p.invoice_no).filter(Boolean)))
      return {
        ...group,
        _rowKey: `${group._rowKey}#${i}`,
        customerName: party,
        customerNames: [party],
        _allProducts: prods,
        _ordersMap: ordersMap,
        _productCount: prods.length,
        doNumber: doNos.join(", "),
        orderNo: doNos.join(", "),
        invoiceNo: invNos.length ? invNos.join(", ") : "—",
        invoiceList: (group.invoiceList || []).filter((inv: any) => invNos.includes(inv.no)),
        actual_qty_dispatch: prods.reduce((sum: number, p: any) => sum + (Number(p.actual_qty_dispatch) || 0), 0),
      }
    })
  }

  const handleRowClick = (group: any) => {
    const sections = splitGroupByParty(group)
    setSelectedGroups(sections)
    // Select all products by default from the clicked group
    const allProdKeys = group._allProducts.map((p: any) => p._rowKey)
    setSelectedProducts(allProdKeys)

    // Reset form
    setGateOutData({
      gatePassFile: null,
      gatePassFileName: "",
      vehicleLoadedImage: null,
      vehicleLoadedImageName: ""
    })
    setExpandedOrders(sections.map((sec: any) => sec._rowKey)) // every party block starts expanded
    setCommonOpen(false) // common details start collapsed

    setIsDialogOpen(true)
  }

  const buildSlipParties = () => {
    const productsForSlip = selectedGroups.flatMap((group: any) =>
      group._allProducts.filter((p: any) => selectedProducts.includes(p._rowKey))
    );
    const partyGroups: Record<string, any[]> = {};
    productsForSlip.forEach((p: any) => {
      const pName = p.party_name || p.partyName || "Unknown Party";
      if (!partyGroups[pName]) partyGroups[pName] = [];
      partyGroups[pName].push(p);
    });
    return Object.entries(partyGroups).map(([party, partyProducts]) => {
      const firstProd = partyProducts[0];
      const orderThrough = firstProd.is_order_through || firstProd.isOrderThrough || "Direct";
      const referenceLabel = orderThrough === "Broker" ? "Broker" : orderThrough === "Salesperson" ? "Salesperson" : "";
      const referenceValue = orderThrough === "Broker"
        ? (firstProd.broker_name || firstProd.brokerName || "—")
        : orderThrough === "Salesperson"
          ? (firstProd.salesperson_name || "—")
          : "Direct";
      return {
        party,
        commitmentNo: firstProd.so_no || firstProd.soNo || firstProd.specificOrderNo || "—",
        date: new Date().toLocaleDateString('en-GB'),
        referenceLabel,
        referenceValue,
        place: firstProd.customer_address || firstProd.customerAddress || "—",
        partyMo: firstProd.customer_contact_person_whatsapp_no || firstProd.whatsapp || "—",
        status: "Original",
        processId: firstProd.processid || "—",
        punchBy: firstProd.order_punch_user || "—",
        punchAt: firstProd.order_punch_at || null,
        preApproveBy: firstProd.pre_approval_user || "—",
        preApproveAt: firstProd.pre_approval_at || null,
        approveBy: firstProd.order_approval_user || "—",
        approveAt: firstProd.order_approval_at || null,
        vehicleNo: firstProd.vehicle_no || firstProd.truck_no || firstProd.truckNo || firstProd.registration_no || "",
        driverName: firstProd.driver_name || firstProd.driverName || "",
        tareWt: firstProd.tareWeight || firstProd.tare_weight || "",
        grossWt: firstProd.grossWeight || firstProd.gross_weight || "",
        driverMobile: firstProd.driver_mobile_no || firstProd.driverMobile || "",
        rstNo: firstProd.rst_no || firstProd.rstNo || "",
        saudaNo: firstProd.manual_sauda_no || firstProd.sauda_no || "",
        billNo: firstProd.invoice_no || firstProd.invoiceNo || "",
        products: partyProducts.map((prod: any) => {
          const qty = parseFloat(prod.actual_qty_dispatch || prod.qty_to_be_dispatched || "0");
          const skuWt = parseFloat(skuWeightMap.get(prod.productName?.trim().toLowerCase()) || "") || 0;
          const skuGrossWt = parseFloat(skuGrossWeightMap.get(prod.productName?.trim().toLowerCase()) || "") || 0;
          return {
            productName: prod.productName || "—",
            uom: prod.uom || "PCS",
            qty,
            weight: skuWt * qty,
            grossWeight: (skuGrossWt > 0 ? skuGrossWt : skuWt) * qty,
          };
        }),
      };
    });
  };

  const handleDownloadSlip = () => {
    if (selectedGroups.length === 0 || selectedProducts.length === 0) {
      toast({ title: "Error", description: "Please select products to download the gate pass", variant: "destructive" });
      return;
    }
    generateGatePassPdf(buildSlipParties(), "gate-pass.pdf");
  };

  const handlePrintSlip = () => {
    if (selectedGroups.length === 0 || selectedProducts.length === 0) {
      toast({ title: "Error", description: "Please select products to print the gate pass", variant: "destructive" });
      return;
    }
    generateGatePassPdf(buildSlipParties(), "gate-pass.pdf", { print: true });
  };

  const handleSubmit = async () => {
    if (selectedGroups.length === 0) return

    // Flatten all selected products from all selected groups
    const productsToSubmit = selectedGroups.flatMap(group =>
      group._allProducts.filter((p: any) => selectedProducts.includes(p._rowKey))
    )

    if (productsToSubmit.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one product",
        variant: "destructive"
      })
      return
    }

    const selectedGatePassFile = gateOutData.gatePassFile
    const selectedVehicleLoadedImage = gateOutData.vehicleLoadedImage

    // Validate Mandatory Uploads
    if (!selectedGatePassFile || !selectedVehicleLoadedImage) {
      toast({
        title: "Validation Error",
        description: "Please upload both Gate Pass and Vehicle Loaded Image.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true)
    try {
      const successfulSubmissions: any[] = []
      const failedSubmissions: any[] = []
      const gatePassFileUrl = await uploadSelectedFile(selectedGatePassFile, 'gatePass')
      const vehicleLoadedImageUrl = await uploadSelectedFile(selectedVehicleLoadedImage, 'vehicleImage')

      for (const product of productsToSubmit) {
        const submitData = {
          gatePassCopy: gatePassFileUrl || "",
          vehicleLoadedImage: vehicleLoadedImageUrl || "",
          userId: user?.id || null // Track acting user's login id
        };

        try {
          console.log(`[GATE-OUT] Submitting for ID ${product.id}`, submitData);
          const response = await gateOutApi.submit(product.id, submitData);

          if (response.success) {
            successfulSubmissions.push(product);
          } else {
            failedSubmissions.push({ product, error: response.message });
          }
        } catch (err: any) {
          console.error(`[GATE-OUT] Failed for ID ${product.id}`, err);
          failedSubmissions.push({ product, error: err.message, code: err?.code });
        }
      }

      if (successfulSubmissions.length > 0) {
        toast({
          title: "Gate Out Completed",
          description: `Successfully processed ${successfulSubmissions.length} items.`,
        })

        await refetchPending();
        queryClient.invalidateQueries({ queryKey: ["gate-out-history"] });

        setIsDialogOpen(false)
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
        queryClient.invalidateQueries({ queryKey: ["gate-out-history"] });
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

  return (
    <WorkflowStageShell
      persistKey="gate-out"
      partyNames={customerNames}
      title="Stage 12: Gate Out"
      description="Record gate out details and upload gate pass grouped by Customer."
      pendingCount={displayRows.length}
      historyData={[]}
      onFilterChange={setFilterValues}
      showStatusFilter={true}
      stageLevel={8}
      onTabChange={setActiveTab}
      showDateFilters={true}
      showSaudaFilter={true}
      dateLabel="DO Date"
      searchPlaceholder="Search DO Number..."
      historyContent={
        <StageHistoryTab
          queryKeyPrefix="gate-out-history"
          getHistoryApi={(params: any) => gateOutApi.getHistory({
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
          stageName="Gate Out"
          stageLevel={8}
          remarksColName="Remarks"
          orderListKey="orders"
          mapOrderNo={(order: any) => order.so_no || "-"}
          mapCustomerName={(order: any) => (order.transfer === 'yes' && order.bill_company_name) ? order.bill_company_name : order.party_name}
          mapRemarks={(order: any) => order.gate_pass_copy ? "Pass Uploaded" : "-"}
          getDate={(order: any) => order.actual_7 || order.timestamp || null}
        />
      }
    >
      <div className="space-y-4">
        {/* Main Card View (Grouped) */}
        <Card className="border border-slate-200/80 shadow-xs overflow-clip py-0 gap-0 stage-card">
          <StageListHeader
            title="Gate Out List"
            shown={table.rows.length}
            total={displayRows.length}
            description="Dispatches ready for gate out, grouped by dispatch date and vehicle"
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
                  <StageFilterSelect value={customerFilter} onChange={setCustomerFilter} allLabel="All Customers" options={customerOptions} />
                  <StageFilterSelect value={vehicleFilter} onChange={setVehicleFilter} allLabel="All Vehicles" options={vehicleOptions} />
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
                ...(customerFilter !== "ALL" ? [{ label: `Customer: ${customerFilter}`, onClear: () => setCustomerFilter("ALL") }] : []),
                ...(vehicleFilter !== "ALL" ? [{ label: `Vehicle: ${vehicleFilter}`, onClear: () => setVehicleFilter("ALL") }] : []),
                ...(quickSearch.trim() ? [{ label: `Search: ${quickSearch.trim()}`, onClear: () => setQuickSearch("") }] : []),
              ]}
            />
          </StageListHeader>
          <CardContent className="p-0">
          {/* Desktop Table View */}
          <div className="hidden overflow-x-auto md:block">
            <Table>
              <StageTableHeaderRows
                columns={orderedCols}
                table={table}
                decimals={numDecimals}
                onReorder={handleColumnReorder}
                dragDisabled={!isAdmin && !isFeatureEnabled('can_reorder_columns')}
              />
              <TableBody>
                {isPendingLoading && pendingOrders.length === 0 ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i} className="opacity-40 border-b border-slate-50">
                      {orderedVisible.map(id => (
                        <TableCell key={id} className={cn("px-4 py-4", colOf(id)?.type === "number" || colOf(id)?.type === "date" ? "text-right" : "text-left")}>
                          <div className={cn("h-3 bg-slate-200 animate-pulse rounded-full", (colOf(id)?.type === "number" || colOf(id)?.type === "date") && "ml-auto",id === "status" ? "h-5 w-16" : id === "products" ? "w-12" : id === "customerName" ? "w-32" : id === "orderNo" || id === "invoiceNo" || id === "vehicleNo" ? "w-24" : "w-20")} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : table.rows.length > 0 ? (
                  table.rows.map((group) => (
                    <TableRow
                      key={group._rowKey}
                      className="cursor-pointer transition-colors hover:bg-slate-50/60"
                      onClick={() => handleRowClick(group)}
                      title="Click to complete gate out"
                    >
                      {orderedVisible.map(id => {
                        if (id === "partySoDate") return <TableCell key={id} className={bodyCellClass(colOf(id), "text-slate-600 whitespace-nowrap")}>{group.partySoDate}</TableCell>
                        if (id === "customerName") return (
                          <TableCell key={id} className="px-4 text-left text-xs text-slate-600">
                            <div className="flex flex-col gap-1">
                              {(group.customerNames && group.customerNames.length > 0 ? group.customerNames : [group.customerName]).map((name: string, idx: number) => (
                                <span key={`${name}-${idx}`} className="font-medium text-slate-700">{name}</span>
                              ))}
                            </div>
                          </TableCell>
                        )
                        if (id === "orderNo") return (
                          <TableCell key={id} className="px-4 text-left text-xs">
                            <div className="flex flex-col gap-1.5">
                              {String(group.doNumber || "—").split(", ").map((doNo: string) => (
                                <span key={doNo} className="text-blue-700 font-bold whitespace-nowrap">{doNo}</span>
                              ))}
                            </div>
                          </TableCell>
                        )
                        if (id === "actual1Date") return <TableCell key={id} className={bodyCellClass(colOf(id), "text-slate-600 whitespace-nowrap")}>{group.actual1Date}</TableCell>
                        if (id === "processid") return <TableCell key={id} className="px-4 text-left text-xs text-slate-600">{group.processId}</TableCell>
                        if (id === "invoiceNo") return (
                          <TableCell key={id} className="px-4 text-left text-xs text-slate-600">
                            {group.invoiceList?.length ? group.invoiceList.map((inv: any, i: number) => (
                              <span key={inv.no}>
                                {i > 0 && ", "}
                                {inv.copy ? (
                                  <a href={inv.copy} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-blue-600 hover:underline font-bold">{inv.no}</a>
                                ) : inv.no}
                              </span>
                            )) : group.invoiceNo}
                          </TableCell>
                        )
                        if (id === "vehicleNo") return <TableCell key={id} className="px-4 text-left text-xs text-slate-600 whitespace-nowrap">{group.vehicleNo}</TableCell>
                        if (id === "orderPunchRemarks") return <TableCell key={id} className="px-4 text-left text-xs text-slate-600">{group.orderPunchRemarks}</TableCell>
                        if (id === "status") return (
                          <TableCell key={id} className="px-4 text-left">
                            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200 text-[10px] font-black whitespace-nowrap">Ready</Badge>
                          </TableCell>
                        )
                        if (id === "products") return (
                          <TableCell key={id} className={bodyCellClass(colOf(id))}>{fmtNum(group._productCount, 0)}</TableCell>
                        )
                        if (NUMERIC_DYN_COLS.has(id)) {
                          const val = getDynamicColumnValue(group, id)
                          const d = numDecimals[id] ?? 4
                          const formatted = isAmountCol(id, colOf(id)?.label) ? fmtAmount(val, d) : fmtNum(val, d)
                          return <TableCell key={id} className={bodyCellClass(colOf(id), "text-slate-600")}>{formatted}</TableCell>
                        }
                        if (DATE_DYN_COLS.has(id)) return <TableCell key={id} className={bodyCellClass(colOf(id), "text-slate-600 whitespace-nowrap")}>{fmtDate(getDynamicColumnValue(group, id) === "—" ? null : getDynamicColumnValue(group, id))}</TableCell>
                        return <TableCell key={id} className="px-4 text-left text-xs text-slate-600">{String(getDynamicColumnValue(group, id))}</TableCell>
                      })}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={orderedVisible.length} className="text-center py-12 text-muted-foreground">
                      {displayRows.length > 0 ? (
                        <div className="flex flex-col items-center gap-1">
                          <p className="font-medium text-slate-500">No matching records found for the filters</p>
                          <button onClick={resetAllFilters} className="text-xs text-blue-600 hover:underline font-semibold">Clear Filters</button>
                        </div>
                      ) : "No orders pending for gate out"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden max-h-[600px] overflow-y-auto p-3">
            {isPendingLoading && pendingOrders.length === 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {[...Array(4)].map((_, i) => (
                  <Card key={i} className="p-4 space-y-4 border-slate-100 shadow-sm animate-pulse">
                    <div className="flex justify-between">
                      <div className="h-4 w-32 bg-slate-200 rounded" />
                      <div className="h-5 w-20 bg-slate-200 rounded-full" />
                    </div>
                    <div className="h-5 w-3/4 bg-slate-100 rounded" />
                    <div className="grid grid-cols-2 gap-3">
                      <div className="h-12 bg-slate-100 rounded-lg" />
                      <div className="h-12 bg-slate-100 rounded-lg" />
                    </div>
                  </Card>
                ))}
              </div>
            ) : table.rows.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {table.rows.map((group) => (
                  <Card
                    key={group._rowKey}
                    onClick={() => handleRowClick(group)}
                    className="p-4 border transition-all shadow-sm bg-white cursor-pointer border-slate-200 hover:border-blue-400 hover:shadow-md active:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        {visibleColumns.includes("partySoDate") && <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{group.partySoDate}</p>}
                        {visibleColumns.includes("customerName") && (
                          <div className="flex flex-col gap-0.5">
                            {(group.customerNames && group.customerNames.length > 0 ? group.customerNames : [group.customerName]).map((name: string, idx: number) => (
                              <h3 key={`${name}-${idx}`} className="text-sm font-bold text-slate-900 leading-tight break-words">{name}</h3>
                            ))}
                          </div>
                        )}
                      </div>
                      <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200 text-[10px] font-black whitespace-nowrap shrink-0">Ready</Badge>
                    </div>

                    {visibleColumns.includes("orderNo") && (
                      <div className="mt-4 flex flex-col gap-1">
                        {String(group.doNumber || "—").split(", ").map((doNo: string) => (
                          <p key={doNo} className="font-mono text-sm font-black text-blue-700 break-all">{doNo}</p>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 grid grid-cols-2 gap-3 border-y border-slate-100 py-3">
                      {visibleColumns.includes("actual1Date") && (
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Dispatched Date</p>
                          <p className="text-xs font-bold text-slate-700">{group.actual1Date}</p>
                        </div>
                      )}
                      {visibleColumns.includes("processid") && (
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Manual Sauda No.</p>
                          <p className="text-xs font-bold text-slate-700 break-words">{group.processId}</p>
                        </div>
                      )}
                      {visibleColumns.includes("invoiceNo") && (
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Invoice No.</p>
                          {group._allProducts?.[0]?.invoice_copy ? (
                            <a href={group._allProducts[0].invoice_copy} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-xs font-black text-blue-600 hover:underline break-words">
                              {group.invoiceNo}
                            </a>
                          ) : (
                            <p className="text-xs font-bold text-slate-700 break-words">{group.invoiceNo}</p>
                          )}
                        </div>
                      )}
                      {visibleColumns.includes("vehicleNo") && (
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Vehicle No.</p>
                          <p className="text-xs font-bold text-slate-700">{group.vehicleNo}</p>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <Badge variant="secondary" className="font-black">{group._productCount} items</Badge>
                      <span className="text-xs font-semibold text-blue-600">Click to complete gate out →</span>
                    </div>

                    {visibleColumns.includes("orderPunchRemarks") && group.orderPunchRemarks && group.orderPunchRemarks !== "—" && (
                      <div className="mt-3 rounded-lg bg-slate-50 p-3">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Order Punch Remarks</p>
                        <p className="mt-1 text-[11px] font-medium italic text-slate-600 leading-relaxed break-words">"{group.orderPunchRemarks}"</p>
                      </div>
                    )}
                    {dynamicColumns.length > 0 && (
                      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                        {dynamicColumns.map((colId) => {
                          const col = ALL_COLUMNS.find((c) => c.id === colId)
                          if (!col) return null
                          return (
                            <div key={colId} className="rounded-md bg-slate-50 p-2">
                              <p className="text-[10px] font-black uppercase text-slate-400">{col.label}</p>
                              <p className="mt-1 font-bold break-words">{String(getDynamicColumnValue(group, colId))}</p>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                {displayRows.length > 0 ? (
                  <div className="flex flex-col items-center gap-1">
                    <p className="font-medium text-slate-500">No matching records found for the filters</p>
                    <button onClick={resetAllFilters} className="text-xs text-blue-600 hover:underline font-semibold">Clear Filters</button>
                  </div>
                ) : "No orders pending for gate out"}
              </div>
            )}
          </div>
          </CardContent>
        </Card>

        <StagePagination
          page={pendingPage}
          totalPages={pendingData?.pagination?.totalPages || 1}
          total={pendingData?.pagination?.total || 0}
          noun="Loads"
          onPrev={() => setPendingPage(p => Math.max(1, p - 1))}
          onNext={() => setPendingPage(p => p + 1)}
          prevDisabled={pendingPage === 1}
          nextDisabled={pendingPage >= (pendingData?.pagination?.totalPages || 1)}
        />
      </div>

      {/* Split-View Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[calc(100vw-0.75rem)] max-w-[calc(100vw-0.75rem)] sm:!max-w-[95vw] max-h-[95vh] overflow-y-auto p-0 [overflow-wrap:anywhere]">
          <div className="p-4 sm:p-6">
            <DialogHeader className="pr-8">
              <DialogTitle className="text-lg sm:text-xl font-bold text-slate-900 border-b pb-4 mb-4 leading-tight">
                Complete Gate Out - {(() => {
                  const invs = Array.from(new Set(selectedGroups.flatMap((g: any) => (g.invoiceList || []).map((i: any) => i.no))))
                  if (selectedGroups.length > 1 && selectedGroups[0]?.vehicleNo && selectedGroups[0]?.vehicleNo !== "—") return `Vehicle ${selectedGroups[0].vehicleNo} (${selectedGroups.length} parties)`
                  if (invs.length === 1) return `Invoice ${invs[0]}`
                  return selectedGroups[0]?.vehicleNo ? `Vehicle ${selectedGroups[0]?.vehicleNo}` : "Selected Load"
                })()}
              </DialogTitle>
            </DialogHeader>

            {selectedGroups.length > 0 && (
              <div className="space-y-4 mt-6 min-w-0">
                {/* Common details of the load (vehicle, driver, documents, weights) - shown once for all parties */}
                {(() => {
                  const firstProd = selectedGroups[0]?._allProducts?.[0] || {}
                  return (
                    <div className="border-2 border-slate-200 rounded-xl sm:rounded-3xl bg-white shadow-sm p-4 sm:p-6 min-w-0">
                      <div
                        className={cn("flex items-center justify-between gap-2 cursor-pointer select-none", commonOpen && "mb-4")}
                        onClick={() => setCommonOpen((o) => !o)}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-3 w-1 bg-slate-700 rounded-full" />
                          <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-700">Common Details - Vehicle, Driver &amp; Load (all parties)</p>
                          {!commonOpen && firstProd.truckNo ? (
                            <span className="text-xs font-black text-blue-800 whitespace-nowrap">{String(firstProd.truckNo).toUpperCase()}</span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{commonOpen ? "HIDE DETAILS ▲" : "CLICK TO SHOW DETAILS ▼"}</span>
                          {commonOpen ? <ChevronUp className="h-5 w-5 text-slate-500" /> : <ChevronDown className="h-5 w-5 text-slate-500" />}
                        </div>
                      </div>
                      {commonOpen && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Truck No</p>
                                        <p className="text-sm font-black text-blue-800">{firstProd.truckNo || "—"}</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Bilty No</p>
                                        <p className="text-xs font-black text-blue-600">{firstProd.biltyNo || firstProd.bilty_no || "—"}</p>
                                      </div>
                                      <div className="sm:col-span-2 md:col-span-4 h-px bg-slate-200 my-1" />

                                      {/* Vehicle Info */}
                                      <div className="sm:col-span-2 md:col-span-4 flex items-center gap-2 mb-[-8px]">
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
                                        <p className="text-xs font-bold text-slate-900 leading-none">{firstProd.passing_weight ? fmtWeight(firstProd.passing_weight, wd) : "—"}</p>
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
                                      <div className="sm:col-span-2 md:col-span-4 flex items-center gap-2 mb-[-8px] mt-2">
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
                                        <p className="text-xs font-bold text-slate-900 leading-none">{firstProd.dl_valid_upto ? new Date(firstProd.dl_valid_upto).toLocaleDateString("en-GB") : "—"}</p>
                                      </div>

                                      <div className="sm:col-span-2 md:col-span-4 h-px bg-slate-200 my-1" />

                                      {/* Security Audit Info */}
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Fitness</p>
                                        {String(firstProd.fitness).startsWith('http') ? (
                                          <a href={firstProd.fitness} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-600 hover:text-blue-800 underline">
                                            {firstProd.fitness_end_date ? new Date(firstProd.fitness_end_date).toLocaleDateString("en-GB") : "View Document"}
                                          </a>
                                        ) : <span className="text-[10px] text-slate-400">—</span>}
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Insurance</p>
                                        {String(firstProd.insurance).startsWith('http') ? (
                                          <a href={firstProd.insurance} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-600 hover:text-blue-800 underline">
                                            {firstProd.insurance_end_date ? new Date(firstProd.insurance_end_date).toLocaleDateString("en-GB") : "View Document"}
                                          </a>
                                        ) : <span className="text-[10px] text-slate-400">—</span>}
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Pollution</p>
                                        {String(firstProd.polution).startsWith('http') ? (
                                          <a href={firstProd.polution} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-600 hover:text-blue-800 underline">
                                            {firstProd.pollution_end_date ? new Date(firstProd.pollution_end_date).toLocaleDateString("en-GB") : "View Document"}
                                          </a>
                                        ) : <span className="text-[10px] text-slate-400">—</span>}
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Audit Status</p>
                                        <Badge variant="outline" className={cn("text-[9px] font-black", firstProd.check_status === 'OK' ? "text-green-600 border-green-200 bg-green-50" : "text-amber-600 border-amber-200 bg-amber-50")}>
                                          {firstProd.check_status || "—"}
                                        </Badge>
                                      </div>

                                      <div className="sm:col-span-2 md:col-span-4 h-px bg-slate-200 my-1" />

                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Tax Copy</p>
                                        {String(firstProd.tax_copy).startsWith('http') ? (
                                          <a href={firstProd.tax_copy} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-600 hover:text-blue-800 underline">
                                            {firstProd.tax_end_date ? new Date(firstProd.tax_end_date).toLocaleDateString("en-GB") : "View Document"}
                                          </a>
                                        ) : <span className="text-[10px] text-slate-400">—</span>}
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Permit 1</p>
                                        {String(firstProd.permit1).startsWith('http') ? (
                                          <a href={firstProd.permit1} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-600 hover:text-blue-800 underline">
                                            {firstProd.permit1_end_date ? new Date(firstProd.permit1_end_date).toLocaleDateString("en-GB") : "View Document"}
                                          </a>
                                        ) : <span className="text-[10px] text-slate-400">—</span>}
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Permit 2 (Out State)</p>
                                        {String(firstProd.permit2_out_state).startsWith('http') ? (
                                          <a href={firstProd.permit2_out_state} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-600 hover:text-blue-800 underline">
                                            {firstProd.permit2_end_date ? new Date(firstProd.permit2_end_date).toLocaleDateString("en-GB") : "View Document"}
                                          </a>
                                        ) : <span className="text-[10px] text-slate-400">—</span>}
                                      </div>

                                      <div className="sm:col-span-2 md:col-span-4 h-px bg-slate-200 my-1" />

                                      {/* Weightment Info */}
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">RST No</p>
                                        {firstProd.weightment_slip_copy ? (
                                          <a href={firstProd.weightment_slip_copy} target="_blank" rel="noopener noreferrer" className="text-sm font-black text-blue-600 hover:text-blue-800 underline">
                                            #{firstProd.rstNo || "—"}
                                          </a>
                                        ) : (
                                          <p className="text-sm font-black text-slate-900">#{firstProd.rstNo || "—"}</p>
                                        )}
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Gross / Tare / Net</p>
                                        <p className="text-xs font-black text-slate-900 leading-tight">
                                          {fmtWeight(firstProd.grossWeight || 0, wd)} / {fmtWeight(firstProd.tareWeight || 0, wd)} / <span className="text-blue-600 font-black">{fmtWeight(Number(firstProd.grossWeight || 0) - Number(firstProd.tareWeight || 0), wd)}</span>
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Weight Diff</p>
                                        <p className="text-xs font-black text-amber-600">{fmtWeight(firstProd.weightDiff || 0, wd)}</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Extra Weight</p>
                                        <p className="text-xs font-black text-purple-600">{fmtWeight(firstProd.extraWeight || 0, wd)}</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Weight Diff Reason</p>
                                        <p className="text-[10px] font-bold text-red-500 italic">{firstProd.reasonForDiff || firstProd.reason_of_difference_in_weight_if_any_speacefic || "—"}</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Transporter Name</p>
                                        <p className="text-xs font-bold text-slate-700 break-words" title={firstProd.transporterName}>{firstProd.transporterName || "—"}</p>
                                      </div>
                      </div>
                      )}
                    </div>
                  )
                })()}

                {selectedGroups.map((group, groupIdx) => {
                  const allProducts = group._allProducts;
                  const allSelected = allProducts.every((p: any) => selectedProducts.includes(p._rowKey));
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
                              DETAILS FOR {group.invoiceNo && group.invoiceNo !== "—" ? `INVOICE ${group.invoiceNo} — ` : ""}{group.customerName}
                            </Badge>
                            <div className="flex flex-col">
                              <span className="text-[10px] text-blue-100 font-black uppercase tracking-widest leading-none mb-1">GROUP {groupIdx + 1} | {group.doNumber}</span>
                              <span className="text-xs text-blue-100 font-bold leading-none">
                                {allProducts.filter((p: any) => selectedProducts.includes(p._rowKey)).length} Items Checked
                              </span>
                            </div>
                          </div>
                          <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-start">
                            <div className="text-[10px] sm:text-[11px] text-blue-50 font-bold uppercase tracking-widest sm:mr-2 leading-none cursor-pointer">
                              {isExpanded ? 'HIDE DETAILS ▲' : 'CLICK TO SHOW DETAILS ▼'}
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20 rounded-full">
                              {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                            </Button>
                          </div>
                        </div>

                          {/* Consolidated Collapsible Details Bar */}
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
                                      {/* Order Info */}
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Delivery Purpose</p>
                                        <p className="text-xs font-bold text-slate-900 leading-none">{orderDetails.deliveryPurpose}</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Start Date / End Date</p>
                                        <p className="text-xs font-bold text-slate-900 leading-none">
                                          {orderDetails.startDate ? new Date(orderDetails.startDate).toLocaleDateString("en-GB") : "—"} / {orderDetails.endDate ? new Date(orderDetails.endDate).toLocaleDateString("en-GB") : "—"}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">DO Date</p>
                                        <p className="text-xs font-bold text-slate-700">
                                          {orderDetails.partySoDate || "—"}
                                        </p>
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
                                        <p className="text-[10px] font-medium text-slate-600 leading-tight break-words" title={orderDetails.customerAddress}>{orderDetails.customerAddress}</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Contact Person</p>
                                        <p className="text-xs font-bold text-slate-900 leading-none">{orderDetails.contactPerson} ({orderDetails.whatsapp})</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Broker / Advance</p>
                                        <p className="text-xs font-bold text-slate-900 leading-none">
                                          {(orderDetails.isOrderThrough === "Direct" || (orderDetails.isOrderThrough === "—" && !orderDetails.isBroker)) ? "No" : orderDetails.brokerName} / ₹{fmtAmount(orderDetails.advanceAmount)}
                                        </p>
                                      </div>
                                      <div className="sm:col-span-2">
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Order Punch Remarks</p>
                                        <p className="text-[10px] font-medium text-slate-600 leading-tight italic">"{orderDetails.orderPunchRemarks || "No special instructions provided."}"</p>
                                      </div>
                                      <div className="sm:col-span-2">
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

                                      <div className="sm:col-span-2 md:col-span-4 h-px bg-slate-200 my-1" />

                                      {/* Dispatch Info */}
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Invoice No</p>
                                        <p className="text-xs font-black text-green-600">{firstProd.invoiceNo || "—"}</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Invoice Date</p>
                                        <p className="text-xs font-bold text-slate-700">
                                          {firstProd.invoiceDate ? new Date(firstProd.invoiceDate).toLocaleDateString("en-GB") : "—"}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Product List (Responsive) + this party's invoice summary - collapsible with the header */}
                          {isExpanded && (
                          <>
                          <div className="px-3 sm:px-5 pb-5 pt-4 border-t border-slate-100">
                          <div className="border border-slate-200 rounded-xl sm:rounded-2xl overflow-x-auto shadow-sm bg-white">
                            <div className="hidden md:block overflow-x-auto">
                            <Table>
                              <TableHeader className="bg-slate-50">
                                {/* Totals row (above the headings) */}
                                <TableRow className="bg-slate-100/90 border-b-2 border-slate-300 font-bold text-xs text-slate-800 hover:bg-slate-100/90">
                                  <TableCell className="px-2" />
                                  <TableCell className="px-4 text-left font-black text-slate-900 uppercase tracking-wider text-[11px]">Total ({allProducts.length})</TableCell>
                                  <TableCell className="px-4 text-right font-mono tabular-nums font-black text-slate-900">
                                    {fmtNum(allProducts.reduce((sum: number, p: any) => sum + (parseFloat(skuWeightMap.get(p.productName?.trim().toLowerCase()) || "") || 0) * (parseFloat(p.actualQty) || 0), 0), wd)}
                                  </TableCell>
                                  <TableCell />
                                  <TableCell />
                                  <TableCell />
                                  <TableCell className="px-4 text-right font-mono tabular-nums font-black text-slate-900">
                                    {(() => { const total = sumTaxable(allProducts.map((p: any) => ({ rate: p.rate || 0, qty: parseFloat(p.actualQty) || 0, product: p }))); return total === null ? "—" : fmtAmount(total, 2); })()}
                                  </TableCell>
                                </TableRow>
                                <TableRow>
                                  <TableHead className="w-12 text-center align-top py-2.5 px-2">
                                    <Checkbox
                                      checked={allSelected}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          setSelectedProducts(prev => Array.from(new Set([...prev, ...allProducts.map((p: any) => p._rowKey)])))
                                        } else {
                                          setSelectedProducts(prev => prev.filter(k => !allProducts.some((p: any) => p._rowKey === k)))
                                        }
                                      }}
                                    />
                                  </TableHead>
                                  <TableHead className="whitespace-nowrap align-top py-2.5 px-4 text-left">Product Info</TableHead>
                                  <TableHead className="whitespace-nowrap align-top py-2.5 px-4 text-right min-w-[110px]">Weight (KGS)</TableHead>
                                  <TableHead className="whitespace-nowrap align-top py-2.5 px-4 text-right min-w-[110px]">Actual Qty Dispatch</TableHead>
                                  <TableHead className="whitespace-nowrap align-top py-2.5 px-4 text-right min-w-[110px]">Rate Inc. Taxes (₹)</TableHead>
                                  <TableHead className="whitespace-nowrap align-top py-2.5 px-4 text-right min-w-[110px]"><RateWithoutGstHeading /></TableHead>
                                  <TableHead className="whitespace-nowrap align-top py-2.5 px-4 text-right min-w-[110px]">Taxable Amount (₹)</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {allProducts.map((product: any) => (
                                  <TableRow key={product._rowKey} className={cn(selectedProducts.includes(product._rowKey) ? "bg-blue-50/20" : "", "h-14")}>
                                    <TableCell className="text-center px-2 py-2">
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
                                    <TableCell className="px-4 py-2 text-left">
                                      <div className="flex flex-col">
                                        <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{product.productName}</span>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{product.specificOrderNo}</span>
                                        <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest mt-1 leading-none">{product.party_name || product.partyName}</span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="px-4 py-2 text-right text-xs font-mono tabular-nums text-slate-700 min-w-[110px] whitespace-nowrap">
                                      {(() => {
                                        const skuWtStr = skuWeightMap.get(product.productName?.trim().toLowerCase());
                                        const skuWt = parseFloat(skuWtStr || "") || 0;
                                        const qty = parseFloat(product.actualQty) || 0;
                                        const totalWt = skuWt * qty;
                                        if (!totalWt) return "—";
                                        return fmtWeight(totalWt, wd);
                                      })()}
                                    </TableCell>
                                    <TableCell className="px-4 py-2 text-right text-xs font-mono tabular-nums font-bold text-blue-700 min-w-[110px] whitespace-nowrap">
                                      {fmtNum(parseFloat(product.actualQty) || 0, 0)}
                                    </TableCell>
                                    <TableCell className="px-4 py-2 text-right text-xs font-mono tabular-nums text-slate-700 min-w-[110px] whitespace-nowrap">
                                      <RateInclusiveTaxPopover
                                        product={product}
                                        cdAmount={product.cd_amount || product.cdAmount}
                                        displayRate={product.rate}
                                        align="end"
                                      />
                                    </TableCell>
                                    <TableCell className="px-4 py-2 text-right text-xs font-mono tabular-nums text-slate-700 min-w-[110px] whitespace-nowrap">
                                      {rateWithoutGstText(product.rate || 0, product, (n) => fmtAmount(n, 2))}
                                    </TableCell>
                                    <TableCell className="px-4 py-2 text-right text-xs font-mono tabular-nums text-slate-700 min-w-[110px] whitespace-nowrap">
                                      {(() => { const t = taxableOf(product.rate || 0, parseFloat(product.actualQty) || 0, product); return t ? fmtAmount(t) : "—"; })()}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                            </div>

                            <div className="md:hidden divide-y divide-slate-100">
                              <div className="flex items-center justify-between gap-3 bg-slate-50 p-3">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Products</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Select All</span>
                                  <Checkbox
                                    checked={allSelected}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setSelectedProducts(prev => Array.from(new Set([...prev, ...allProducts.map((p: any) => p._rowKey)])))
                                      } else {
                                        setSelectedProducts(prev => prev.filter(k => !allProducts.some((p: any) => p._rowKey === k)))
                                      }
                                    }}
                                  />
                                </div>
                              </div>
                              {allProducts.map((product: any) => (
                                <div key={product._rowKey} className={cn("p-4 space-y-3", selectedProducts.includes(product._rowKey) ? "bg-blue-50/30" : "bg-white")}>
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="text-xs font-black text-slate-800 uppercase leading-tight break-words">{product.productName}</p>
                                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">#{product.specificOrderNo}</p>
                                      <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest break-words">{product.party_name || product.partyName}</p>
                                    </div>
                                    <Checkbox
                                      checked={selectedProducts.includes(product._rowKey)}
                                      onCheckedChange={() => {
                                        if (selectedProducts.includes(product._rowKey)) {
                                          setSelectedProducts(prev => prev.filter(k => k !== product._rowKey))
                                        } else {
                                          setSelectedProducts(prev => [...prev, product._rowKey])
                                        }
                                      }}
                                      className="h-5 w-5"
                                    />
                                  </div>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-md bg-slate-50 p-2">
                                      <p className="text-[10px] font-black uppercase text-slate-400">Weight(KGS)</p>
                                      <p className="mt-1 font-mono font-bold text-slate-700">{(() => {
                                        const skuWtStr = skuWeightMap.get(product.productName?.trim().toLowerCase());
                                        const skuWt = parseFloat(skuWtStr || "") || 0;
                                        const qty = parseFloat(product.actualQty) || 0;
                                        const totalWt = skuWt * qty;
                                        if (!totalWt) return "—";
                                        return fmtWeight(totalWt, wd);
                                      })()}</p>
                                    </div>
                                    <div className="rounded-md bg-slate-50 p-2">
                                      <p className="text-[10px] font-black uppercase text-slate-400">Actual Qty</p>
                                      <p className="mt-1 font-mono font-bold text-blue-700">{fmtNum(parseFloat(product.actualQty) || 0, 0)}</p>
                                    </div>
                                    <div className="rounded-md bg-slate-50 p-2">
                                      <p className="text-[10px] font-black uppercase text-slate-400">Rate (Inc. with taxes) (₹)</p>
                                      <div className="mt-1">
                                        <RateInclusiveTaxPopover
                                          product={product}
                                          cdAmount={product.cd_amount || product.cdAmount}
                                          displayRate={product.rate}
                                          align="center"
                                        />
                                      </div>
                                    </div>
                                    <div className="rounded-md bg-slate-50 p-2">
                                      <p className="text-[10px] font-black uppercase text-slate-400"><RateWithoutGstHeading /></p>
                                      <p className="mt-1 font-mono font-bold text-slate-700">{rateWithoutGstText(product.rate || 0, product, (n) => fmtAmount(n, 2))}</p>
                                    </div>
                                    <div className="rounded-md bg-slate-50 p-2">
                                      <p className="text-[10px] font-black uppercase text-slate-400">Total Taxable Amount (₹)</p>
                                      <p className="mt-1 font-mono font-bold text-slate-700">{(() => { const t = taxableOf(product.rate || 0, parseFloat(product.actualQty) || 0, product); return t ? fmtAmount(t) : "—"; })()}</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          </div>
                          <div className="p-3 sm:p-5 pt-0">
                            <InvoiceSummary
                              selectedGroups={[group]}
                              selectedProducts={selectedProducts}
                              title={`Invoice Summary — ${group.customerName}${group.invoiceNo && group.invoiceNo !== "—" ? ` (Invoice ${group.invoiceNo})` : ""}`}
                            />
                          </div>
                          </>
                          )}
                    </div>
                  );
                })}

                {/* Grand totals across every party in this gate out */}
                <GrandTotals sections={selectedGroups} selectedProducts={selectedProducts} skuWeightMap={skuWeightMap} wd={wd} />

                <OrderChargesPanel orderNos={Array.from(new Set(selectedGroups.flatMap((g: any) => g._allProducts || []).filter((p: any) => selectedProducts.includes(p._rowKey)).map((p: any) => String(p.so_no || p.soNo || "").replace(/(?<=\d)[A-Z].*$/, "")).filter(Boolean))) as string[]} />
              </div>
            )}

            {/* Gate Out Form (Bottom) */}
            <div className="mt-8 space-y-6 border rounded-lg p-4 sm:p-6 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b pb-2 flex-wrap gap-2">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-blue-600" />
                  Gate Pass & Evidence
                </h3>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={handlePrintSlip} className="gap-1.5 h-8">
                    <Printer className="h-3.5 w-3.5" /> Print Gate Pass
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={handleDownloadSlip} className="gap-1.5 h-8">
                    <Download className="h-3.5 w-3.5" /> Download Gate Pass
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
                <div className="space-y-2">
                  <FileUploadField
                    label={<>Upload Gate Pass <span className="text-red-500">*</span></>}
                    accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
                    fileName={gateOutData.gatePassFileName}
                    value={gatePassPreview}
                    variant="dropzone"
                    helperText="Max file size: 20 MB"
                    uploading={isUploading === 'gatePass'}
                    buttonText="Click to select gate pass"
                    onFilesSelected={(files) => files[0] && handleFileUpload(files[0], 'gatePass')}
                  />
                </div>

                <div className="space-y-2">
                  <FileUploadField
                    label={<>Upload Vehicle Loaded Image <span className="text-red-500">*</span></>}
                    accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
                    fileName={gateOutData.vehicleLoadedImageName}
                    value={vehicleImagePreview}
                    variant="dropzone"
                    helperText="Max file size: 20 MB"
                    uploading={isUploading === 'vehicleImage'}
                    buttonText="Click to select vehicle image"
                    onFilesSelected={(files) => files[0] && handleFileUpload(files[0], 'vehicleImage')}
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="mt-8 w-full border-t bg-slate-50/50 -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 px-4 sm:px-6 py-4 sm:flex-col sm:justify-start">
              <StageActionFooter
                onCancel={() => setIsDialogOpen(false)}
                cancelDisabled={isProcessing}
                actions={[
                  {
                    label: isProcessing ? "Processing..." : "Complete Gate Out",
                    onClick: handleSubmit,
                    disabled: isProcessing || isReadOnly || !gateOutData.gatePassFile || !gateOutData.vehicleLoadedImage || selectedProducts.length === 0,
                  },
                ]}
              />
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </WorkflowStageShell>
  )
}
