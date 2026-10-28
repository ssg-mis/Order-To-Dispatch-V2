"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { CardContent } from "@/components/ui/card"
import { usePersistedFilters } from "@/hooks/use-persisted-filters"
import { useStageTable, type StageColDef } from "@/hooks/use-stage-table"
import { StageListHeader, StageToolbar, StageSegmented, StageFilterSelect, StageColumnsMenu, StageDivider, StageActiveChips, StageHeadCell, StageTotalsRow, StageActionBar, StagePagination, StageActionFooter } from "@/components/stage-list"
import { matchesSearch } from "@/lib/search-utils"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
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
import { FileUploadField } from "@/components/file-upload-field"
import { Upload, Settings2, FileText, Plus, X, Truck, ExternalLink, ArrowUpDown, ArrowUp, ArrowDown, Printer } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { WORKFLOW_STAGE_COLUMNS as ALL_COLUMNS } from "@/lib/workflow-columns"
import { ColumnToggleContent } from "@/components/ui/column-toggle-content"
import { makeInvoiceApi, orderApi, skuApi, petrolPumpApi, insuranceDetailApi } from "@/lib/api-service"
import { Combobox } from "@/components/ui/combobox"
import { isStaleWriteError } from "@/lib/stale-write"
import { cn } from "@/lib/utils"
import { OrderChargesPanel, useOrderCharges } from "@/components/order-punch/order-charges-panel"
import { useWeightDecimals } from "@/hooks/use-weight-decimals"
import { fmtNum, fmtDate, fmtAmount, isAmountCol } from "@/lib/table-format"
import { useAuth } from "@/hooks/use-auth"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { StageHistoryTab } from "@/components/workflow/stage-history-tab"
import { Loader2 } from "lucide-react"
import { usePersistedColumns } from "@/hooks/use-persisted-columns"
import { useColumnOrder } from "@/hooks/use-column-order"
import { SortableTableHead } from "@/components/ui/sortable-table-head"
import { ColumnDragProvider } from "@/components/ui/column-drag-provider"
import { RateInclusiveTaxPopover } from "@/components/workflow/rate-inclusive-tax-popover"
import { RateWithoutGstHeading } from "@/components/workflow/rate-without-gst-heading"
import { GstTaxRows } from "@/components/workflow/gst-tax-rows"
import { rateWithoutGstText, summarizeGst, sumTaxable, taxableOf } from "@/lib/gst"

/**
 * The invoice total shown in the GST Breakdown (taxable + GST + ledger charges, rounded). Make Invoice's
 * Bill Amount uses this same figure so every later stage (Check / Final Invoice) shows the same amount.
 * invoiceTotal is null when a GST rate or the state split is missing: no honest total, so don't guess.
 */
function calcInvoiceAmounts(
  selectedGroups: any[],
  selectedProducts: string[],
  productCdData: Record<string, { isCd: string; cdAmount: string }>,
  chargesBillable = 0,
) {
  const selProds = selectedGroups.flatMap((g) => g._allProducts)
    .filter((p) => selectedProducts.includes(p._rowKey))

  const lines = selProds.map((p) => ({
    taxable: taxableOf((Number(p.rate) || 0) - (productCdData[p.id]?.isCd === "yes" ? parseFloat(productCdData[p.id]?.cdAmount || "0") : 0), parseFloat(p.qtyToDispatch) || 0, p),
    product: p,
  }))
  // GST % per product and the same-state / other-state split come from the masters, carried from Dispatch Planning.
  const firstProd = selProds[0]
  const gst = summarizeGst(lines, firstProd?.depot_gst_state_code, firstProd?.customer_gst_state_code)
  const totalTaxable = gst.totalTaxable

  const rawTotal = gst.complete && totalTaxable !== null ? totalTaxable + chargesBillable + gst.cgst + gst.sgst + gst.igst : null
  const invoiceTotal = rawTotal === null ? null : Math.round(rawTotal)
  const roundOff = rawTotal === null || invoiceTotal === null ? null : parseFloat((invoiceTotal - rawTotal).toFixed(2))
  return { gst, totalTaxable, invoiceTotal, roundOff }
}

function InvoiceSummary({ selectedGroups, selectedProducts, productCdData, chargesBillable = 0 }: {
  selectedGroups: any[]
  selectedProducts: string[]
  productCdData: Record<string, { isCd: string; cdAmount: string }>
  /** Ledger charges still to be billed (an order's charges ride on its FIRST invoice only). No GST on them. */
  chargesBillable?: number
}) {
  const { gst, invoiceTotal, roundOff } = calcInvoiceAmounts(selectedGroups, selectedProducts, productCdData, chargesBillable)

  return (
    <div className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">GST Breakdown</p>
      </div>
      {/* pr-6 matches the Taxable Amount column's right padding so both right edges line up. */}
      <div className="py-4 pl-4 pr-6 max-w-sm ml-auto space-y-2">
        {chargesBillable > 0 && (
          <div className="flex justify-between items-center text-xs">
            <span className="font-black uppercase text-slate-500 text-[10px]">Ledger Charges (no GST)</span>
            <span className="font-mono font-bold text-slate-700">₹{fmtAmount(chargesBillable)}</span>
          </div>
        )}
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

export default function MakeInvoicePage() {
  const queryClient = useQueryClient()
  const wd = useWeightDecimals()
  const router = useRouter()
  const { toast } = useToast()
  const { isReadOnly, user, isAdmin, isFeatureEnabled } = useAuth()
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending")
  const [pendingPage, setPendingPage] = useState(1)

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
    "make-invoice",
    ["partySoDate", "actual1Date", "orderNo", "processid", "customerName", "vehicleNo", "orderPunchRemarks", "status", "products"]
  )
  const MAKE_INV_STD_IDS = ["partySoDate", "actual1Date", "orderNo", "processid", "customerName", "vehicleNo", "orderPunchRemarks", "status", "products"]
  // Include all ALL_COLUMNS after standard IDs so every toggleable column participates in drag ordering
  const [columnOrder, setColumnOrder] = useColumnOrder("make-invoice", [...MAKE_INV_STD_IDS, ...ALL_COLUMNS.map(c => c.id).filter(id => !MAKE_INV_STD_IDS.includes(id))])
  const ALWAYS_VISIBLE_MAKE_INV = new Set<string>([])
  const orderedVisible = columnOrder.filter(id => ALWAYS_VISIBLE_MAKE_INV.has(id) || visibleColumns.includes(id))
  // Dynamic columns for mobile card view (visible columns not in the standard set)
  const dynamicColumns = visibleColumns.filter(id => !MAKE_INV_STD_IDS.includes(id))
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
  const [selectedGroups, setSelectedGroups] = useState<any[]>([])
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])

  // Ledger charges: one set per order, billed ONCE (on the order's first invoice).
  const invoiceOrderNos = useMemo(
    () =>
      Array.from(
        new Set(
          selectedGroups
            .flatMap((g: any) => g._allProducts || [])
            .filter((p: any) => selectedProducts.includes(p._rowKey))
            .map((p: any) => String(p.so_no || p.soNo || "").replace(/(?<=\d)[A-Z].*$/, ""))
            .filter((n: string) => n && n !== "—")
        )
      ) as string[],
    [selectedGroups, selectedProducts]
  )
  const invoiceCharges = useOrderCharges(invoiceOrderNos)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  // Form State
  const [invoiceType, setInvoiceType] = useState<"independent" | "common" | "">("independent")
  const [invoiceData, setInvoiceData] = useState({
    invoiceNo: "",
    invoiceDate: new Date().toISOString().split('T')[0], // Default to today
    qty: "",
    billAmount: "",
    invoiceFile: "" as string,
    invoiceFileName: "",
    driverAdvanceCash: "",
    driverAdvanceBank: "",
    dieselParchiFile: "" as string,
    dieselParchiFileName: "",
    petrolPumpName: "",
    dieselAmount: "",
    insuranceDetails: ""
  })

  // CD Amount State for products
  const [productCdData, setProductCdData] = useState<{[key: string]: {isCd: string, cdAmount: string}}>({})


  // Fetch Petrol Pumps
  const { data: petrolPumpsRes } = useQuery({
    queryKey: ['petrol-pumps'],
    queryFn: () => petrolPumpApi.getAll({ all: "true" }),
    staleTime: 5 * 60 * 1000,
  })
  const petrolPumpOptions = useMemo(() => {
    return (petrolPumpsRes?.data?.petrol_pumps || []).map((p: any) => ({
      value: p.petrol_pump_name,
      label: p.petrol_pump_name
    }))
  }, [petrolPumpsRes])

  // Fetch Insurance Details
  const { data: insuranceRes } = useQuery({
    queryKey: ['insurance-details'],
    queryFn: () => insuranceDetailApi.getAll({ all: "true" }),
    staleTime: 5 * 60 * 1000,
  })
  const insuranceOptions = useMemo(() => {
    return (insuranceRes?.data?.insurance_details || [])
      .filter((ins: any) =>
        String(ins.status || '').toLowerCase() === 'active' ||
        ins.insurance_company_name === invoiceData.insuranceDetails
      )
      .map((ins: any) => ({
        value: ins.insurance_company_name,
        label: ins.insurance_company_name,
        subLabel: `${ins.short_name ? `${ins.short_name}  •  ` : ''}Policy No: ${ins.policy_number || '—'}  •  Expires: ${ins.valid_upto ? formatDate(ins.valid_upto) : '—'}  •  Sum Insured: ${ins.sum_insured != null && ins.sum_insured !== '' ? `₹${fmtAmount(ins.sum_insured, 2)}` : '—'}`
      }))
  }, [insuranceRes, invoiceData.insuranceDetails])

  // Fetch pending invoices
  const [isUploadingObj, setIsUploadingObj] = useState<Record<string, boolean>>({})

  const handleFileUpload = async (file: File, keyName: string = 'invoiceFile', fileNameKey: string = 'invoiceFileName') => {
    if (!file) return;

    // 1. File Size Validation (Max 20 MB)
    const MAX_SIZE_BYTES = 20 * 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
      toast({
        title: "File Too Large",
        description: `Selected file is ${(file.size / (1024 * 1024)).toFixed(2)} MB. Maximum allowed size is 20 MB.`,
        variant: "destructive",
      });
      return;
    }

    // 2. File Type Validation (PDF & Images only)
    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.heic', '.heif'];
    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
    if (!allowedExtensions.includes(ext) && !file.type.startsWith('image/')) {
      toast({
        title: "Unsupported File Format",
        description: `Only PDF and image files (JPG, PNG, WEBP, etc.) are supported.`,
        variant: "destructive",
      });
      return;
    }

    setIsUploadingObj(prev => ({ ...prev, [keyName]: true }));
    try {
      const response = await orderApi.uploadFile(file);
      if (response.success) {
        setInvoiceData(p => ({
          ...p,
          [keyName]: response.data.url,
          [fileNameKey]: file.name
        }));
        toast({
          title: "Upload Successful",
          description: `${file.name} uploaded successfully.`
        });
      }
    } catch (error: any) {
      console.error("Upload failed:", error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload file to S3",
        variant: "destructive",
      });
    } finally {
      setIsUploadingObj(prev => ({ ...prev, [keyName]: false }));
    }
  };

  // Pending query (numbered pages)
  const {
    data: pendingData,
    isLoading: isPendingLoading,
    refetch: refetchPending,
  } = useQuery({
    queryKey: ["make-invoice-pending", filterValues, pendingPage],
    queryFn: async () => {
      const response = await makeInvoiceApi.getPending({
        page: pendingPage,
        limit: 20,
        search: filterValues.search,
        manual_sauda_no: filterValues.manualSaudaNo,
        do_date_from: filterValues.startDate,
        do_date_to: filterValues.endDate,
        party_name: filterValues.partyName === "all" ? undefined : filterValues.partyName,
      });
      return response.success ? response.data : { invoices: [], pagination: { total: 0, totalPages: 1 } };
    },
  });

  const pendingOrders: any[] = useMemo(() => pendingData?.invoices || [], [pendingData]);
  const pendingTotalPages: number = pendingData?.pagination?.totalPages || 1;
  const pendingTotal: number = pendingData?.pagination?.total ?? pendingOrders.length;

  // New filters narrow the result set, so go back to page 1.
  useEffect(() => { setPendingPage(1) }, [filterValues]);

  /* Filter Logic */

  // Search, Manual Sauda No., DO Date range and Party Name are applied
  // server-side (see getPending/getHistory params), so no client-side filtering here.
  const filteredPendingOrders = pendingOrders

  /* Grouping Logic */
  const displayRows = useMemo(() => {
    const grouped: { [key: string]: any } = {}

    filteredPendingOrders.forEach((order: any) => {
      // Normalize party name robustly: trim, uppercase, and collapse spaces
      const partyEntry = (order.transfer === 'yes' && order.bill_company_name) ? order.bill_company_name : (order.party_name || order.partyName || "Unknown Customer")
      const partyName = String(partyEntry).trim().toUpperCase().replace(/\s+/g, ' ')
      
      const rawDoNumber = order.so_no || order.soNo || "—"
      const doNumber = rawDoNumber.replace(/(?<=\d)[A-Z].*$/, "")
      
      // Extract only date part (YYYY-MM-DD) robustly from LRC actual_1
      const actualDateVal = order.lrc_actual_1 || order.actual_1
      const actual1Str = actualDateVal ? (() => {
        const d = new Date(actualDateVal);
        if (isNaN(d.getTime())) return String(actualDateVal).split(/[T ]/)[0].trim();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })() : "no-date";

      // Normalize vehicle no: trim, uppercase, and remove ALL spaces for consistent grouping
      const vehicleNo = (order.truck_no || "—").trim().toUpperCase().replace(/\s+/g, '')

      // Stage 9 grouping: Vehicle No. + Actual Dispatch date + Customer ID + Address.
      // Orders keep no address ID (the address is stored as text on the order), so the delivery address
      // (falling back to ship / billing address), normalised, identifies the address. The party name only
      // stands in for the Customer ID when an order has none.
      const customerKey = order.customer_id != null && order.customer_id !== "" ? `C${order.customer_id}` : `N${partyName}`
      const addressKey = String(order.customer_delivery_address || order.ship_address || order.customer_address || "—")
        .trim().toUpperCase().replace(/\s+/g, ' ')
      const groupKey = `${vehicleNo}|${actual1Str}|${customerKey}|${addressKey}`;

      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          _rowKey: groupKey,
          customerName: partyName,
          doNumberList: new Set<string>(),
          _allProducts: [],
          _ordersMap: {}, // Still keep map structure for compatibility with existing dialog logic
          _productCount: 0
        }
      }

      const group = grouped[groupKey]
      group.doNumberList.add(doNumber)

      // Use base DO (stripping A, B, C suffixes) as the key to prevent duplicate detail blocks
      const orderKey = doNumber;
      if (!grouped[groupKey]._ordersMap[orderKey]) {
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
        amount: (((parseFloat(order.rate_of_material) || 0) * (parseFloat(order.nos_per_main_uom) || 1)) + (parseFloat(order.freight_rate) || 0)) * (parseFloat(order.actual_qty_dispatch) || 0),
        qtyToDispatch: order.actual_qty_dispatch || 0,
        truckNo: order.truck_no,
        rstNo: order.rst_no,
        grossWeight: order.gross_weight,
        tareWeight: order.tare_weight,
        netWeight: order.net_weight,
        extraWeight: order.extra_weight,
        weightDiff: order.difference || 0,
        transporterName: order.transporter_name,
        driverName: order.driver_name,
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
        processid: order.processid || null,
        driver_advance_cash: order.driver_advance_cash ?? order.advance_bhada_cash ?? null,
        driver_advance_bank: order.driver_advance_bank ?? order.advance_bhada_bank ?? null,
        diesel_amount: order.diesel_amount ?? order.advance_bhada_diesel_advance ?? null,
        petrol_pump_name: order.petrol_pump_name ?? null,
        advance_bhada_cash: order.advance_bhada_cash ?? null,
        advance_bhada_bank: order.advance_bhada_bank ?? null,
        advance_bhada_diesel_advance: order.advance_bhada_diesel_advance ?? null,
      }

      grouped[groupKey]._ordersMap[orderKey]._products.push(product)
      grouped[groupKey]._allProducts.push(product)
      group._productCount = group._allProducts.length
    })

    // Finalize groups
    return Object.values(grouped).map(group => ({
      ...group,
      partySoDate: formatDate(group._allProducts[0]?.party_so_date),
      doNumber: Array.from(group.doNumberList as Set<string>).join(", "),
      processId: group._allProducts[0]?.processid || "—",
      vehicleNo: (group._allProducts[0]?.truckNo || "—").toUpperCase(),
      actual1Date: formatDate(group._allProducts[0]?.lrc_actual_1 || group._allProducts[0]?.actual_1),
      uploadSo: group._allProducts[0]?.upload_so || group._allProducts[0]?.uploadSo || null,
      freightRate: group._allProducts[0]?.freight_rate || 0,
      orderPunchRemarks: group._allProducts[0]?.order_punch_remarks || "—",
      // Record sent back from Check Invoice with a reported issue (status_1='Issue').
      // Surface the reviewer's remarks (remarks_2) so it can be corrected here.
      isReverted: group._allProducts.some((p: any) => p.status_1 === "Issue"),
      issueRemarks: group._allProducts.find((p: any) => p.status_1 === "Issue" && p.remarks_2)?.remarks_2 || "",
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
          processId: firstProd.processid || "—",
        }
      }),
    }))
  }, [filteredPendingOrders])

  // ── Stage table (column search / date range / sort / totals) ──
  // Status is remembered permanently; the rest is session-scoped (usePersistedFilters). Refresh only reloads data.
  const [listView, patchListView] = usePersistedFilters("make-invoice", {
    quickSearch: "",
    statusFilter: "ALL" as "ALL" | "PENDING" | "ISSUE",
    customerFilter: "ALL",
  }, { permanentKeys: ["statusFilter"] })
  const { quickSearch, statusFilter, customerFilter } = listView
  const setQuickSearch = (v: string) => patchListView({ quickSearch: v })
  const setStatusFilter = (v: "ALL" | "PENDING" | "ISSUE") => patchListView({ statusFilter: v })
  const setCustomerFilter = (v: string) => patchListView({ customerFilter: v })
  const NUMERIC_TOTAL_COLS = new Set(["actual_qty_dispatch"])
  // Table standard: numeric + date columns right aligned, units in headings, plain fixed decimals.
  const NUM_DECIMALS: Record<string, number> = {
    actual_qty_dispatch: 0, orderQty: 4, qtyToDispatch: 4, actual_qty: 0, actual_approval_qty: 4, altQty: 4, damage_qty: 4,
    gross_weight: wd, tare_weight: wd, net_weight: wd, extra_weight: wd,
    rate: 2, ratePerLtr: 2, ratePer15Kg: 2, rateOfMaterial: 2, totalWithGst: 2, advanceAmount: 2, bill_amount: 2,
  }
  // Summable columns (quantities, weights, bill amount). Rates are never totalled.
  const SUM_COL_IDS = new Set([
    "altQty", "gross_weight", "tare_weight", "net_weight", "extra_weight", "bill_amount",
  ])
  const DATE_COL_IDS = new Set(["partySoDate","actual1Date", "deliveryDate", "invoice_date"])
  const MONEY_HEAD_IDS = new Set(["rate", "ratePerLtr", "ratePer15Kg", "rateOfMaterial", "totalWithGst", "advanceAmount", "bill_amount"])
  const isRightCol = (id: string) => id in NUM_DECIMALS || DATE_COL_IDS.has(id)
  const fmtCell = (id: string, v: any) => {
    if (v === "—" || v === null || v === undefined || v === "") return "—"
    if (isAmountCol(id)) return fmtAmount(v, NUM_DECIMALS[id] ?? 2)
    if (id in NUM_DECIMALS) return fmtNum(v, NUM_DECIMALS[id])
    if (DATE_COL_IDS.has(id)) return fmtDate(v)
    return String(v)
  }
  const joinDo = (g: any, key: string) =>
    (g.doDetails || []).map((d: any) => d[key]).filter((v: any) => v && v !== "—").join(" ") || ""

  const tableCols = useMemo<StageColDef<any>[]>(() => {
    const out: StageColDef<any>[] = []
    for (const id of orderedVisible) {
      switch (id) {
        case "partySoDate":
          out.push({ id, label: "DO Date", type: "date", accessor: g => g._allProducts[0]?.party_so_date || g._allProducts[0]?.partySoDate })
          break
        case "actual1Date":
          out.push({ id, label: "Dispatched Date", type: "date", accessor: g => g._allProducts[0]?.lrc_actual_1 || g._allProducts[0]?.actual_1 })
          break
        case "orderNo":
          out.push({ id, label: "DO Number", accessor: g => joinDo(g, "doNumber") || g.doNumber })
          break
        case "processid":
          out.push({ id, label: "Manual Sauda No.", accessor: g => joinDo(g, "processId") || g.processId })
          break
        case "customerName":
          out.push({ id, label: "Customer Name", accessor: g => g.customerName })
          break
        case "vehicleNo":
          out.push({ id, label: "Vehicle No.", accessor: g => g.vehicleNo })
          break
        case "orderPunchRemarks":
          out.push({ id, label: "Order Punch Remarks", accessor: g => joinDo(g, "orderPunchRemarks") || g.orderPunchRemarks })
          break
        case "status":
          out.push({ id, label: "Status", accessor: g => (g.isReverted ? "Issue Reported" : "Pending Invoice") })
          break
        case "products":
          out.push({ id, label: "Items", accessor: g => g._allProducts[0]?.productName || "" })
          break
        default: {
          const dyn = ALL_COLUMNS.find(c => c.id === id)
          if (!dyn) break
          const numeric = id in NUM_DECIMALS
          out.push({
            id,
            label: MONEY_HEAD_IDS.has(id) ? `${dyn.label} (₹)` : dyn.label,
            type: numeric ? "number" : DATE_COL_IDS.has(id) ? "date" : "text",
            total: numeric && SUM_COL_IDS.has(id),
            accessor: (g: any) => {
              const v = getDynamicColumnValue(g, id)
              return numeric ? Number(v) || 0 : String(v)
            },
          })
        }
      }
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedVisible.join("|")])

  const baseFilter = useCallback((g: any) => {
    if (statusFilter === "ISSUE" && !g.isReverted) return false
    if (statusFilter === "PENDING" && g.isReverted) return false
    if (customerFilter !== "ALL" && g.customerName !== customerFilter) return false
    const q = quickSearch.trim().toLowerCase()
    if (q) {
      const hay = [joinDo(g, "doNumber"), g.doNumber, joinDo(g, "processId"), g.customerName, g.vehicleNo, joinDo(g, "orderPunchRemarks")].join(" ").toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  }, [statusFilter, customerFilter, quickSearch])

  const table = useStageTable<any>({ rows: displayRows, columns: tableCols, baseFilter, persistKey: "make-invoice" })
  const sortedDisplayRows = table.rows
  const uniqueCustomerNames = useMemo(
    () => Array.from(new Set(displayRows.map((g: any) => g.customerName as string))).sort(),
    [displayRows]
  )
  const activeFiltersCount =
    (statusFilter !== "ALL" ? 1 : 0) + (customerFilter !== "ALL" ? 1 : 0) + (quickSearch.trim() ? 1 : 0) + table.activeColumnFilterCount
  const clearAllTableFilters = () => {
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

  const toggleSelectAll = () => {
    const keys = sortedDisplayRows.map(r => r._rowKey)
    if (keys.length > 0 && keys.every(k => selectedItems.includes(k))) {
      setSelectedItems(prev => prev.filter(k => !keys.includes(k)))
    } else {
      setSelectedItems(prev => Array.from(new Set([...prev, ...keys])))
    }
  }

  const handleOpenDialog = (targetGroup?: any) => {
    const targetGroups = targetGroup
      ? [targetGroup]
      : displayRows.filter(r => selectedItems.includes(r._rowKey))
    if (targetGroups.length === 0) return
    if (targetGroups.length > 0) {
      // Consolidate targetGroups by company
      const consolidatedMap: { [key: string]: any } = {}
      targetGroups.forEach(group => {
        const company = group.customerName
        if (!consolidatedMap[company]) {
          consolidatedMap[company] = {
            ...group,
            _allProducts: [...group._allProducts],
            _ordersMap: JSON.parse(JSON.stringify(group._ordersMap)), // Deep copy to avoid mutation
            doNumber: group.doNumber,
            _rowKey: `consolidated-${company}`
          }
        } else {
          const existing = consolidatedMap[company]
          existing._allProducts.push(...group._allProducts)
          existing._productCount = existing._allProducts.length
          // Merge unique DO numbers
          const existingDos = existing.doNumber.split(", ").map((s: string) => s.trim())
          const newDos = group.doNumber.split(", ").map((s: string) => s.trim())
          existing.doNumber = Array.from(new Set([...existingDos, ...newDos])).join(", ")
          
          // Merge ordersMap content
          Object.entries(group._ordersMap).forEach(([orderKey, orderData]: [string, any]) => {
            if (!existing._ordersMap[orderKey]) {
              existing._ordersMap[orderKey] = JSON.parse(JSON.stringify(orderData))
            } else {
              existing._ordersMap[orderKey]._products.push(...orderData._products)
            }
          })
        }
      })
      
      setSelectedItems(targetGroups.map(g => g._rowKey))
      setSelectedGroups(Object.values(consolidatedMap))
      
      // Select all products for all selected groups by default
      const allProdKeys = targetGroups.flatMap(g => g._allProducts.map((p: any) => p._rowKey))
      setSelectedProducts(allProdKeys)

      // Pre-fill advances from previous stages (Actual Dispatch / Plan Vehicle)
      const allProds = targetGroups.flatMap(g => g._allProducts || [])
      const foundCash = allProds.find((p: any) => p.driver_advance_cash != null || p.advance_bhada_cash != null)
      const prefillCash = foundCash
        ? String(foundCash.driver_advance_cash ?? foundCash.advance_bhada_cash ?? "")
        : ""

      const foundBank = allProds.find((p: any) => p.driver_advance_bank != null || p.advance_bhada_bank != null)
      const prefillBank = foundBank
        ? String(foundBank.driver_advance_bank ?? foundBank.advance_bhada_bank ?? "")
        : ""

      const foundDiesel = allProds.find((p: any) => p.diesel_amount != null || p.advance_bhada_diesel_advance != null)
      const prefillDiesel = foundDiesel
        ? String(foundDiesel.diesel_amount ?? foundDiesel.advance_bhada_diesel_advance ?? "")
        : ""

      const foundPump = allProds.find((p: any) => p.petrol_pump_name)
      const prefillPetrolPump = foundPump?.petrol_pump_name || ""

      const foundIns = allProds.find((p: any) => p.insurance_details)
      const prefillInsurance = foundIns?.insurance_details || ""

      // Pre-fill form (values can still be freely edited before confirmation)
      setInvoiceData({
        invoiceNo: "",
        invoiceDate: new Date().toISOString().split('T')[0],
        qty: "",
        billAmount: "",
        invoiceFile: "",
        invoiceFileName: "",
        driverAdvanceCash: prefillCash,
        driverAdvanceBank: prefillBank,
        dieselParchiFile: "",
        dieselParchiFileName: "",
        petrolPumpName: prefillPetrolPump,
        dieselAmount: prefillDiesel,
        insuranceDetails: prefillInsurance,
      })
      setInvoiceType("independent")

      setIsDialogOpen(true)
    }
  }

  // Auto-fill Qty and Bill Amount based on selected products
  useEffect(() => {
    if (!isDialogOpen || selectedGroups.length === 0) return;

    let totalQty = 0;
    selectedGroups.forEach(group => {
      group._allProducts.forEach((product: any) => {
        if (selectedProducts.includes(product._rowKey)) {
          totalQty += parseFloat(product.qtyToDispatch) || 0;
        }
      });
    });

    // Bill Amount = the Total Invoice Amount of the GST Breakdown (ledger charges ride on the order's first
    // invoice only), so Check / Final Invoice show the same figure the user saw here.
    const { invoiceTotal } = calcInvoiceAmounts(selectedGroups, selectedProducts, productCdData, invoiceCharges.billableTotal)

    setInvoiceData(prev => ({
      ...prev,
      qty: totalQty.toString(),
      billAmount: invoiceTotal === null ? "" : invoiceTotal.toFixed(2)
    }));
  }, [selectedProducts, isDialogOpen, selectedGroups, productCdData, invoiceCharges.billableTotal]);

  const handlePrint = () => {
    const group = selectedGroups[0]
    if (!group) return

    const allProducts = selectedGroups.flatMap((g: any) => g._allProducts)
    const customerName = group.customerName || "—"
    const vehicleNo = group.vehicleNo || "—"
    const doNumber = group.doNumber || "—"
    const date = invoiceData.invoiceDate || new Date().toLocaleDateString('en-GB')

    const productRows = allProducts.map((p: any) => `
      <tr>
        <td style="border:1px solid #ddd;padding:8px">${p.productName || '—'}</td>
        <td style="border:1px solid #ddd;padding:8px;text-align:center">${p.qtyToDispatch || '—'} ${p.unit || ''}</td>
        <td style="border:1px solid #ddd;padding:8px;text-align:right">₹${fmtAmount(parseFloat(p.final_rate || p.rate_per_ltr || p.rate_per_15kg || p.rate_of_material || 0), 2)}</td>
        <td style="border:1px solid #ddd;padding:8px;text-align:right">₹${fmtAmount((parseFloat(p.qtyToDispatch||0)) * parseFloat(p.final_rate || p.rate_per_ltr || p.rate_per_15kg || p.rate_of_material || 0), 2)}</td>
      </tr>
    `).join('')

    const printContent = `
      <html>
      <head>
        <title>Invoice Data - ${doNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          .subtitle { color: #555; font-size: 13px; margin-bottom: 20px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
          .field { background: #f8f8f8; padding: 10px 14px; border-radius: 6px; }
          .field label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
          .field p { font-size: 14px; font-weight: 600; margin: 2px 0 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th { background: #1e293b; color: white; padding: 10px 8px; text-align: left; font-size: 13px; }
          td { font-size: 13px; }
          .total-row td { font-weight: bold; background: #f1f5f9; }
          .footer { margin-top: 32px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }
          .sig-box { border-top: 2px solid #333; padding-top: 8px; text-align: center; font-size: 12px; color: #444; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <h1>Shree Shyam Oil Extractions</h1>
        <div class="subtitle">Invoice Data Sheet — For Tally Entry</div>
        <div class="grid">
          <div class="field"><label>Customer Name</label><p>${customerName}</p></div>
          <div class="field"><label>DO Number</label><p>${doNumber}</p></div>
          <div class="field"><label>Vehicle No.</label><p>${vehicleNo}</p></div>
          <div class="field"><label>Invoice Date</label><p>${date}</p></div>
          <div class="field"><label>Invoice No.</label><p>${invoiceData.invoiceNo || '—'}</p></div>
          <div class="field"><label>Total Bill Amount</label><p>₹${fmtAmount(parseFloat(invoiceData.billAmount || '0'), 2)}</p></div>
          <div class="field"><label>Driver Advance (Cash)</label><p>₹${fmtAmount(invoiceData.driverAdvanceCash || 0, 2)}</p></div>
          <div class="field"><label>Driver Advance (Bank)</label><p>₹${fmtAmount(invoiceData.driverAdvanceBank || 0, 2)}</p></div>
          <div class="field"><label>Petrol Pump</label><p>${invoiceData.petrolPumpName || '—'}</p></div>
          <div class="field"><label>Diesel Amount</label><p>₹${fmtAmount(invoiceData.dieselAmount || 0, 2)}</p></div>
          <div class="field"><label>Insurance Details</label><p>${invoiceData.insuranceDetails || '—'}</p></div>
        </div>
        <table>
          <thead><tr>
            <th>Product</th><th>Qty</th><th>Rate</th><th>Amount</th>
          </tr></thead>
          <tbody>${productRows}</tbody>
          <tfoot><tr class="total-row">
            <td style="border:1px solid #ddd;padding:8px" colspan="3">Total</td>
            <td style="border:1px solid #ddd;padding:8px;text-align:right">₹${fmtAmount(parseFloat(invoiceData.billAmount || '0'), 2)}</td>
          </tr></tfoot>
        </table>
        <div class="footer">
          <div class="sig-box">Driver Signature</div>
          <div class="sig-box">Accounts Signature</div>
          <div class="sig-box">Authorised Signature</div>
        </div>
      </body>
      </html>
    `

    const win = window.open('', '_blank')
    if (win) {
      win.document.write(printContent)
      win.document.close()
      win.focus()
      win.print()
    }
  }

  const handleSubmit = async () => {
    const validationErrors = [];
    if (selectedGroups.length === 0) validationErrors.push("No order selected for invoice generation");
    if (!invoiceData.invoiceNo) validationErrors.push("Invoice Number is missing");
    if (!invoiceData.invoiceFile) validationErrors.push("Invoice Copy is not uploaded");
    if (!invoiceData.dieselParchiFile) validationErrors.push("Diesel Parchi is not uploaded");

    if (validationErrors.length > 0) {
      toast({
        title: "Validation Error",
        description: (
          <div className="flex flex-col gap-1 mt-1">
            <p className="font-semibold text-sm">Please resolve the following before submitting:</p>
            <ul className="list-disc pl-5 text-xs space-y-0.5 font-medium">
              {validationErrors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        ),
        variant: "destructive",
        duration: 8000, // Increased duration so user has time to read
      })
      return
    }

    // Filter selected products across all selected groups
    const allProductsToSubmit = selectedGroups.flatMap(g =>
      g._allProducts.filter((p: any) => selectedProducts.includes(p._rowKey))
    )

    if (allProductsToSubmit.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one product to invoice",
        variant: "destructive"
      })
      return
    }

    setIsProcessing(true)
    try {
      const successfulSubmissions: any[] = []
      const failedSubmissions: any[] = []

      // Submit each selected product
      for (const product of allProductsToSubmit) {
        const submitData = {
          billType: invoiceType,
          invoiceNo: invoiceData.invoiceNo,
          invoiceDate: invoiceType === 'independent' ? invoiceData.invoiceDate : null,
          qty: invoiceData.qty || null,
          billAmount: invoiceType === 'independent' ? invoiceData.billAmount : null,
          invoiceCopy: invoiceData.invoiceFile || null,
          userId: user?.id || null, // Track acting user's login id
          cdAmount: productCdData[product.id]?.isCd === 'yes' ? parseFloat(productCdData[product.id]?.cdAmount || '0') : 0,
          driverAdvanceCash: invoiceData.driverAdvanceCash ? parseFloat(invoiceData.driverAdvanceCash) : null,
          driverAdvanceBank: invoiceData.driverAdvanceBank ? parseFloat(invoiceData.driverAdvanceBank) : null,
          dieselParchiFile: invoiceData.dieselParchiFile || null,
          petrolPumpName: invoiceData.petrolPumpName || null,
          dieselAmount: invoiceData.dieselAmount ? parseFloat(invoiceData.dieselAmount) : null,
          insuranceDetails: invoiceData.insuranceDetails || null
        };

        try {
          console.log(`[INVOICE] Submitting for ID ${product.id}`, submitData);
          const response = await makeInvoiceApi.submit(product.id, submitData);

          if (response.success) {
            successfulSubmissions.push(product);
          } else {
            failedSubmissions.push({ product, error: response.message });
          }
        } catch (err: any) {
          console.error(`[INVOICE] Failed for ID ${product.id}`, err);
          failedSubmissions.push({ product, error: err.message, code: err?.code });
        }
      }

      // Handle results
      if (successfulSubmissions.length > 0) {
        toast({
          title: "Invoices Created",
          description: `Successfully created invoice for ${successfulSubmissions.length} items.`,
        })

        // Refresh Data
        await refetchPending();
        queryClient.invalidateQueries({ queryKey: ["make-invoice-history"] });
        // A submitted invoice moves forward to Check Invoice — invalidate its pending
        // list (prefix matches all filter variations) so it appears there without a
        // full page refresh.
        queryClient.invalidateQueries({ queryKey: ["check-invoice-pending"] });

        setIsDialogOpen(false)
        setSelectedItems([]) // Clear root selection
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
        queryClient.invalidateQueries({ queryKey: ["make-invoice-history"] });
        queryClient.invalidateQueries({ queryKey: ["check-invoice-pending"] });
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
        description: "An unexpected error occurred during submission.",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }



  const customerNames = Array.from(new Set(pendingOrders.map(order => (order.transfer === 'yes' && order.bill_company_name) ? order.bill_company_name : (order.party_name || "Unknown Customer"))))

  const buildInvoiceGroupDisplay = (group: any) => ({
    doNumber: group.doNumber || "—",
    partySoDate: group.partySoDate || "—",
    actual1Date: formatDate(group._allProducts?.[0]?.lrc_actual_1 || group._allProducts?.[0]?.actual_1),
    processId: group.processId || "—",
    customerName: group.customerName || "—",
    productName: group._allProducts?.[0]?.productName || "—",
    productCount: group._productCount || group._allProducts?.length || 0,
    vehicleNo: group.vehicleNo || "—",
    orderPunchRemarks: group.orderPunchRemarks || "—",
    qty: group._allProducts?.reduce((sum: number, p: any) => sum + (Number(p.qtyToDispatch) || 0), 0) || 0,
    amount: group._allProducts?.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0) || 0,
    doDetails: group.doDetails || [],
  })


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

  return (
    <WorkflowStageShell
      persistKey="make-invoice"
      partyNames={customerNames}
      title="Stage 9: Make Invoice (Proforma)"
      description="Create proforma invoice grouped by DO Number."
      pendingCount={displayRows.length} // Count groups
      historyData={[]}
      onFilterChange={setFilterValues}
      showStatusFilter={true}
      stageLevel={6}
      onTabChange={setActiveTab}
      showDateFilters={true}
      showSaudaFilter={true}
      dateLabel="DO Date"
      searchPlaceholder="Search DO Number..."
      historyContent={
        <StageHistoryTab
          queryKeyPrefix="make-invoice-history"
          getHistoryApi={(params: any) => makeInvoiceApi.getHistory({
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
          stageName="Make Invoice"
          stageLevel={6}
          remarksColName="Invoice No"
          orderListKey="invoices"
          mapOrderNo={(order: any) => order.so_no || "-"}
          mapCustomerName={(order: any) => (order.transfer === 'yes' && order.bill_company_name) ? order.bill_company_name : order.party_name}
          mapRemarks={(order: any) => `${order.invoice_no || "Generated"} ${order.freight_rate ? `| Freight (₹): ${fmtAmount(order.freight_rate, 2)}` : ""}`}
          getDate={(order: any) => order.actual_5 || order.timestamp || null}
        />
      }
    >
      <div className="space-y-4">
        {/* Main Table (Grouped) */}
        <Card className="border border-slate-200/80 shadow-xs overflow-clip py-0 gap-0 stage-card">
          <StageListHeader
            title="Invoice Queue"
            shown={sortedDisplayRows.length}
            total={displayRows.length}
            description="Dispatched loads ready for proforma invoice creation"
            searchValue={quickSearch}
            onSearchChange={setQuickSearch}
            searchPlaceholder="Search DO, Customer, Vehicle..."
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
                      { value: "PENDING", label: "Pending Invoice" },
                      { value: "ISSUE", label: "Issue Reported" },
                    ]}
                  />
                  <StageDivider />
                  <StageFilterSelect value={customerFilter} onChange={setCustomerFilter} allLabel="All Customers" options={uniqueCustomerNames} />
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
                ...(statusFilter !== "ALL" ? [{ label: `Status: ${statusFilter === "PENDING" ? "Pending Invoice" : "Issue Reported"}`, onClear: () => setStatusFilter("ALL") }] : []),
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
                <ColumnDragProvider columnIds={orderedVisible} onReorder={handleColumnReorder} disabled={!isAdmin && !isFeatureEnabled('can_reorder_columns')}>
                  {tableCols.map(col => (
                    <StageHeadCell key={col.id} col={col} table={table} align={isRightCol(col.id) ? "right" : "left"} />
                  ))}
                </ColumnDragProvider>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedDisplayRows.length > 0 && (
                <StageTotalsRow
                  columns={tableCols}
                  totals={table.totals}
                  count={sortedDisplayRows.length}
                  labelColumnId={tableCols[0]?.id}
                  unit=""
                  format={(n, id) => isAmountCol(id) ? fmtAmount(n, NUM_DECIMALS[id] ?? 2) : fmtNum(n, NUM_DECIMALS[id] ?? 4)}
                  tones={{ actual_qty_dispatch: "blue" }}
                  align={Object.fromEntries(tableCols.map(c => [c.id, isRightCol(c.id) ? "right" as const : "left" as const]))}
                />
              )}
              {isPendingLoading && pendingOrders.length === 0 ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i} className="opacity-40 border-b border-slate-50">
                    {orderedVisible.map(id => (
                      <TableCell key={id} className="px-4 text-left py-4">
                        <div className={cn("h-3 bg-slate-200 animate-pulse rounded-full", id === "status" ? "h-5 w-24" : id === "products" ? "w-32" : id === "customerName" ? "w-40" : id === "orderPunchRemarks" ? "w-32" : id === "orderNo" || id === "processid" ? "w-24" : "w-20")} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : sortedDisplayRows.length > 0 ? (
                sortedDisplayRows.map((group) => (
                  <TableRow
                    key={group._rowKey}
                    className="cursor-pointer transition-colors hover:bg-blue-50/50 select-none"
                    onClick={() => handleOpenDialog(group)}
                  >
                    {orderedVisible.map(id => {
                      if (id === "partySoDate") return <TableCell key={id} className="px-4 text-right text-xs text-slate-600 whitespace-nowrap font-mono tabular-nums min-w-[110px]">{group.partySoDate}</TableCell>
                      if (id === "actual1Date") {
                        const dispatchedDates = group.doDetails && group.doDetails.length > 0
                          ? Array.from(new Set(group.doDetails.map((d: any) => d.dispatchedDate)))
                          : [group.actual1Date]
                        return (
                          <TableCell key={id} className="px-4 text-right text-xs text-slate-600 whitespace-nowrap font-mono tabular-nums min-w-[110px]">
                            <div className="flex flex-col gap-1.5">
                              {dispatchedDates.map((date: any, idx: number) => (
                                <span key={`${date}-${idx}`}>{date}</span>
                              ))}
                            </div>
                          </TableCell>
                        )
                      }
                      if (id === "orderNo") return (
                        <TableCell key={id} className="px-4 text-left text-xs">
                          <div className="flex flex-col gap-1.5">
                            {(group.doDetails && group.doDetails.length > 0 ? group.doDetails : [{ doNumber: group.doNumber }]).map((d: any, idx: number) => (
                              <span key={`${d.doNumber}-${idx}`} className="text-blue-700 font-bold">{d.doNumber}</span>
                            ))}
                          </div>
                        </TableCell>
                      )
                      if (id === "processid") return (
                        <TableCell key={id} className="px-4 text-left text-xs">
                          <div className="flex flex-col gap-1.5">
                            {(group.doDetails && group.doDetails.length > 0 ? group.doDetails : [{ doNumber: "—", processId: group.processId }]).map((d: any, idx: number) => (
                              <span key={`${d.doNumber}-${idx}`} className="text-slate-600">{d.processId}</span>
                            ))}
                          </div>
                        </TableCell>
                      )
                      if (id === "customerName") return <TableCell key={id} className="px-4 text-left text-xs text-slate-600">{group.customerName}</TableCell>
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
                            <div className="flex flex-col items-start gap-1">
                              <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Issue Reported</Badge>
                              {group.issueRemarks && (
                                <span className="text-[10px] text-red-600 font-medium italic max-w-[180px] leading-tight" title={group.issueRemarks}>
                                  "{group.issueRemarks}"
                                </span>
                              )}
                            </div>
                          ) : (
                            <Badge className="bg-cyan-100 text-cyan-700">Pending Invoice</Badge>
                          )}
                        </TableCell>
                      )
                      if (id === "products") return (
                        <TableCell key={id} className="px-4 text-left">
                          <span className="text-xs font-medium text-slate-700 leading-tight block max-w-[150px]">
                            {group._allProducts[0]?.productName || "—"}
                          </span>
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
                  <TableCell colSpan={orderedVisible.length} className="text-center py-8 text-muted-foreground">
                    {displayRows.length > 0 ? "No matching records found for the applied filters" : "No orders pending for invoice creation"}
                    {displayRows.length > 0 && (
                      <button onClick={clearAllTableFilters} className="block mx-auto text-xs text-blue-600 hover:underline mt-1 font-semibold">Clear Filters</button>
                    )}
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
            ) : sortedDisplayRows.length > 0 ? (
              sortedDisplayRows.map((group) => {
                const display = buildInvoiceGroupDisplay(group)
                return (
                  <div
                    key={group._rowKey}
                    className="rounded-lg border bg-white p-4 shadow-sm cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
                    onClick={() => handleOpenDialog(group)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-col gap-0.5">
                          {(display.doDetails.length > 0 ? display.doDetails : [{ doNumber: display.doNumber }]).map((d: any, idx: number) => (
                            <p key={`${d.doNumber}-${idx}`} className="font-mono text-sm font-black text-blue-700 break-all">{d.doNumber}</p>
                          ))}
                        </div>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{display.partySoDate}</p>
                      </div>
                    </div>

                    <div className="mt-3">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Customer Name</p>
                      <p className="text-sm font-bold text-slate-900 break-words">{display.customerName}</p>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-md bg-slate-50 p-2">
                        <p className="text-[10px] font-black uppercase text-slate-400">Dispatched Date</p>
                        <div className="mt-1 flex flex-col gap-0.5">
                          {(display.doDetails.length > 0
                            ? Array.from(new Set(display.doDetails.map((d: any) => d.dispatchedDate)))
                            : [display.actual1Date]
                          ).map((date: any, idx: number) => (
                            <p key={`${date}-${idx}`} className="font-bold">{date}</p>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-md bg-slate-50 p-2">
                        <p className="text-[10px] font-black uppercase text-slate-400">Manual Sauda No.</p>
                        <div className="mt-1 flex flex-col gap-0.5">
                          {(display.doDetails.length > 0 ? display.doDetails : [{ doNumber: "—", processId: display.processId }]).map((d: any, idx: number) => (
                            <p key={`${d.doNumber}-${idx}`} className="font-bold break-words">{d.processId}</p>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-md bg-slate-50 p-2">
                        <p className="text-[10px] font-black uppercase text-slate-400">Product</p>
                        <p className="mt-1 font-semibold break-words">{display.productName}</p>
                      </div>
                      <div className="rounded-md bg-slate-50 p-2">
                        <p className="text-[10px] font-black uppercase text-slate-400">Items</p>
                        <p className="mt-1 font-bold">{display.productCount}</p>
                      </div>
                      <div className="rounded-md bg-slate-50 p-2">
                        <p className="text-[10px] font-black uppercase text-slate-400">Vehicle No.</p>
                        <p className="mt-1 font-bold break-words">{display.vehicleNo}</p>
                      </div>
                      <div className="rounded-md bg-slate-50 p-2">
                        <p className="text-[10px] font-black uppercase text-slate-400">Qty to Dispatch</p>
                        <p className="mt-1 font-mono tabular-nums font-bold">{fmtNum(display.qty, 4)}</p>
                      </div>
                    </div>

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
                    {dynamicColumns.length > 0 && (
                      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                        {dynamicColumns.map((colId) => {
                          const col = ALL_COLUMNS.find((c) => c.id === colId)
                          if (!col) return null
                          return (
                            <div key={colId} className="rounded-md bg-slate-50 p-2">
                              <p className="text-[10px] font-black uppercase text-slate-400">{MONEY_HEAD_IDS.has(colId) ? `${col.label} (₹)` : col.label}</p>
                              <p className="mt-1 font-bold break-words">{fmtCell(colId, getDynamicColumnValue(group, colId))}</p>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {group.isReverted ? (
                      <div className="mt-3">
                        <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Issue Reported</Badge>
                        {group.issueRemarks && (
                          <p className="mt-1 text-[11px] text-red-600 font-medium italic break-words">"{group.issueRemarks}"</p>
                        )}
                      </div>
                    ) : (
                      <Badge className="mt-3 bg-cyan-100 text-cyan-700 hover:bg-cyan-100">Pending Invoice</Badge>
                    )}
                  </div>
                )
              })
            ) : (
              <div className="py-10 text-center text-muted-foreground">
                {displayRows.length > 0 ? (
                  <div className="flex flex-col items-center gap-1">
                    <p className="font-medium text-slate-500">No matching records found for the applied filters</p>
                    <button onClick={clearAllTableFilters} className="text-xs text-blue-600 hover:underline font-semibold">Clear Filters</button>
                  </div>
                ) : "No orders pending for invoice creation"}
              </div>
            )}
          </div>
          <StagePagination
            page={pendingPage}
            totalPages={pendingTotalPages}
            total={pendingTotal}
            noun="Invoices"
            onPrev={() => setPendingPage(p => Math.max(1, p - 1))}
            onNext={() => setPendingPage(p => p + 1)}
            prevDisabled={pendingPage === 1 || pendingOrders.length === 0}
            nextDisabled={pendingOrders.length === 0 || pendingPage >= pendingTotalPages}
          />
          </CardContent>
        </Card>
      </div>

      {/* Split-View Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[calc(100vw-0.75rem)] max-w-[calc(100vw-0.75rem)] sm:!max-w-[95vw] max-h-[95vh] overflow-x-hidden overflow-y-auto p-0 [overflow-wrap:anywhere]">
          <div className="p-3 sm:p-6">
            <DialogHeader className="min-w-0">
              <DialogTitle className="text-lg sm:text-xl font-bold text-slate-900 break-words">
                Create Invoice - {selectedGroups.length > 1 ? `${selectedGroups.length} Parties` : selectedGroups[0]?.customerName}
              </DialogTitle>
            </DialogHeader>

            {selectedGroups.length > 0 && (
              <div className="space-y-6 mt-6 min-w-0">
                {/* 1. Stacked Company Information Bars */}
                <div className="space-y-4 min-w-0">
                  {selectedGroups.map((group, groupIdx) => {
                    const uniqueOrderDetails = Object.values(group._ordersMap);
                    const doCount = String(group.doNumber || "").split(",").map((s: string) => s.trim()).filter(Boolean).length;

                    return (
                      <div key={group._rowKey} className="border-2 border-slate-100 rounded-xl sm:rounded-3xl overflow-hidden bg-white shadow-sm min-w-0">
                        <div className="bg-blue-600 px-3 sm:px-5 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                            <Badge className="max-w-full bg-white text-blue-800 hover:bg-white px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-black tracking-tight rounded-full shadow-sm uppercase whitespace-normal break-words">
                              DETAILS FOR {group.customerName}
                            </Badge>
                            <div className="flex flex-col">
                              <span className="text-[10px] text-blue-100 font-black uppercase tracking-widest leading-none mb-1">PARTY {groupIdx + 1} | {group.doNumber}</span>
                              <span className="text-xs text-blue-100 font-bold leading-none">
                                {doCount} DO{doCount !== 1 ? 's' : ''} · {group._productCount} Items Selected
                              </span>
                            </div>
                          </div>
                        </div>

                        {group.isReverted && (
                          <div className="bg-red-50 border-b border-red-200 px-3 sm:px-5 py-3">
                            <p className="text-[10px] font-black uppercase tracking-wider text-red-600 mb-0.5">⚠ Issue Reported by Check Invoice</p>
                            <p className="text-xs font-medium text-red-800 italic break-words">
                              {group.issueRemarks ? `"${group.issueRemarks}"` : "No remarks were provided."}
                            </p>
                          </div>
                        )}

                        <div className="px-3 sm:px-5 pb-5 pt-4 space-y-6 bg-slate-50 border-t border-slate-100">
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
                                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">Delivery Purpose</p>
                                      <p className="text-sm font-semibold text-slate-900 leading-none">{orderDetails.deliveryPurpose || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">Start Date / End Date</p>
                                      <p className="text-sm font-semibold text-slate-800 leading-none">
                                        {formatDate(orderDetails.startDate)} / {formatDate(orderDetails.endDate)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">DO Date</p>
                                      <p className="text-sm font-semibold text-slate-800">{orderDetails.partySoDate || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">Actual Dispatch Date</p>
                                      <p className="text-sm font-semibold text-blue-700 leading-none">{formatDate(firstProd.lrc_actual_1 || firstProd.actual_1)}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">Transport Type</p>
                                      <p className="text-sm font-semibold text-slate-900 leading-none">{orderDetails.transportType || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">Credit Status</p>
                                      <Badge className={cn("text-[11px] font-bold px-2.5 py-0.5", orderDetails.partyCredit === 'Good' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                                        {orderDetails.partyCredit || "—"}
                                      </Badge>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">Customer Address</p>
                                      <p className="text-xs font-medium text-slate-600 leading-tight break-words" title={orderDetails.address}>{orderDetails.address || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">Contact Person</p>
                                      <p className="text-sm font-semibold text-slate-900 leading-tight break-words">{orderDetails.contactPerson || "—"} ({orderDetails.whatsapp || "—"})</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">Broker / Advance</p>
                                      <p className="text-sm font-semibold text-slate-900 leading-none">{orderDetails.brokerName || "—"} / ₹{fmtAmount(orderDetails.advanceAmount || 0, 2)}</p>
                                    </div>

                                    <div className="md:col-span-2">
                                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">Order Punch Remarks</p>
                                      <p className="text-xs font-medium text-slate-600 leading-tight italic break-words">"{orderDetails.orderPunchRemarks || "No special instructions provided."}"</p>
                                    </div>
                                    <div className="md:col-span-2">
                                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">PO Copy (SO Upload)</p>
                                      {orderDetails.uploadSo ? (
                                        <a
                                          href={orderDetails.uploadSo}
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-all border border-blue-200 w-fit group shadow-sm mt-0.5"
                                        >
                                          <FileText className="h-3.5 w-3.5 group-hover:scale-110 transition-transform" />
                                          <span className="text-xs font-bold uppercase tracking-tight">VIEW PO COPY</span>
                                          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </a>
                                      ) : (
                                        <p className="text-xs font-bold text-slate-400 leading-none mt-1">NOT UPLOADED</p>
                                      )}
                                    </div>

                                    <div className="md:col-span-4 h-px bg-slate-200 my-2" />

                                    {/* Dispatch Info */}
                                    <div>
                                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">Truck No</p>
                                      <p className="text-base font-bold text-blue-800">{(firstProd.truckNo || "—").toUpperCase()}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">Bilty No</p>
                                      <p className="text-sm font-bold text-blue-600">{firstProd.bilty_no || firstProd.biltyNo || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">Transporter</p>
                                      <p className="text-sm font-semibold text-slate-800 leading-none">{firstProd.transporterName || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">Audit Status</p>
                                      <Badge variant="outline" className={cn("text-[10px] font-bold px-2 py-0.5 uppercase", firstProd.check_status === 'Approved' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-orange-50 text-orange-700 border-orange-200')}>
                                        {firstProd.check_status || "Pending"}
                                      </Badge>
                                    </div>

                                    <div className="md:col-span-4 h-px bg-slate-200 my-2" />

                                    {/* Vehicle Info */}
                                    <div className="md:col-span-4 flex items-center gap-2 mb-[-4px]">
                                      <div className="h-3.5 w-1 bg-blue-600 rounded-full" />
                                      <p className="text-xs font-bold uppercase tracking-[0.15em] text-blue-900/60">Vehicle Specifications</p>
                                    </div>

                                    <div>
                                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">Vehicle Type</p>
                                      <p className="text-sm font-semibold text-slate-900 leading-none">{firstProd.vehicle_type || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">RTO</p>
                                      <p className="text-sm font-semibold text-slate-900 leading-none">{firstProd.rto || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">Passing Weight</p>
                                      <p className="text-sm font-semibold text-slate-900 leading-none">{firstProd.passing_weight != null && firstProd.passing_weight !== "" ? fmtNum(firstProd.passing_weight, wd) : "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">Road Tax</p>
                                      <p className="text-sm font-semibold text-slate-900 leading-none">{firstProd.road_tax || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">GVW</p>
                                      <p className="text-sm font-semibold text-slate-900 leading-none">{firstProd.gvw || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">ULW</p>
                                      <p className="text-sm font-semibold text-slate-900 leading-none">{firstProd.ulw || "—"}</p>
                                    </div>

                                    {/* Driver Info */}
                                    <div className="md:col-span-4 flex items-center gap-2 mb-[-4px] mt-2">
                                      <div className="h-3.5 w-1 bg-amber-600 rounded-full" />
                                      <p className="text-xs font-bold uppercase tracking-[0.15em] text-amber-900/60">Driver Information</p>
                                    </div>

                                    <div>
                                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">Driver Name</p>
                                      <p className="text-sm font-semibold text-slate-900 leading-none">{firstProd.driver_name || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">Contact No</p>
                                      <p className="text-sm font-semibold text-slate-900 leading-none">{firstProd.driver_contact_no || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">License No</p>
                                      <p className="text-sm font-semibold text-slate-900 leading-none">{firstProd.driving_license_no || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">Valid Upto</p>
                                      <p className="text-sm font-semibold text-slate-900 leading-none">{formatDate(firstProd.dl_valid_upto)}</p>
                                    </div>

                                    <div className="md:col-span-4 h-px bg-slate-200 my-2" />

                                    {/* Security Audit Info */}
                                    <div>
                                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">Fitness</p>
                                      {renderPartyDetailLink(firstProd.fitness, firstProd.fitness_end_date)}
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">Insurance</p>
                                      {renderPartyDetailLink(firstProd.insurance, firstProd.insurance_end_date)}
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">Pollution</p>
                                      {renderPartyDetailLink(firstProd.polution, firstProd.pollution_end_date)}
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">Tax Copy</p>
                                      {renderPartyDetailLink(firstProd.tax_copy, firstProd.tax_end_date)}
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">Permit 1</p>
                                      {renderPartyDetailLink(firstProd.permit1, firstProd.permit1_end_date)}
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">Permit 2 (Out State)</p>
                                      {renderPartyDetailLink(firstProd.permit2_out_state, firstProd.permit2_end_date)}
                                    </div>

                                    <div className="md:col-span-4 h-px bg-slate-200 my-2" />

                                    {/* Weight Details */}
                                    <div>
                                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">RST No</p>
                                      {firstProd.weightment_slip_copy ? (
                                        <a href={firstProd.weightment_slip_copy} target="_blank" rel="noopener noreferrer" className="text-base font-bold text-blue-600 hover:text-blue-800 underline">
                                          #{firstProd.rst_no || firstProd.rstNo || "—"}
                                        </a>
                                      ) : (
                                        <p className="text-base font-bold text-slate-900 tracking-tight">#{firstProd.rst_no || firstProd.rstNo || "—"}</p>
                                      )}
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">Gross / Tare / Net</p>
                                      <p className="text-sm font-bold text-slate-900 leading-tight">
                                        {fmtNum(firstProd.grossWeight || firstProd.gross_weight || 0, wd)} / {fmtNum(firstProd.tareWeight || firstProd.tare_weight || 0, wd)} / <span className="text-blue-600 font-bold">{fmtNum(Number(firstProd.grossWeight || firstProd.gross_weight || 0) - Number(firstProd.tareWeight || firstProd.tare_weight || 0), wd)}</span>
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">Weight Diff</p>
                                      <p className="text-sm font-bold text-amber-600">{fmtNum(firstProd.weightDiff || firstProd.difference || 0, wd)}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">Extra Weight</p>
                                      <p className="text-sm font-bold text-purple-600">{fmtNum(firstProd.extraWeight || firstProd.extra_weight || 0, wd)}</p>
                                    </div>
                                    <div className="md:col-span-2">
                                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">Weight Diff Reason</p>
                                      <p className="text-xs font-medium text-red-600 italic">{firstProd.reason_of_difference_in_weight_if_any_speacefic || firstProd.reasonForDiff || "—"}</p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                      </div>
                    );
                  })}
                </div>

                {/* 2. Unified Product Table (Shows ALL selected groups products) */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white min-w-0">
                  <Table className="hidden md:table">
                    <TableHeader className="bg-slate-50">
                      <TableRow className="bg-slate-100/90 hover:bg-slate-100/90 border-b-2 border-slate-300">
                        <TableHead className="px-4 h-10" />
                        <TableHead className="px-4 text-left h-10 text-xs font-black text-slate-900 uppercase tracking-wider">Total ({selectedProducts.length})</TableHead>
                        <TableHead className="px-4 h-10" />
                        <TableHead className="px-4 h-10" />
                        <TableHead className="px-4 text-right h-10 font-mono tabular-nums font-black text-blue-700">
                          {(() => {
                            const totalSelectedWt = selectedGroups.flatMap(g => g._allProducts)
                              .filter(p => selectedProducts.includes(p._rowKey))
                              .reduce((sum, p) => {
                                const skuWtStr = skuWeightMap.get(p.productName?.trim().toLowerCase());
                                const skuWt = parseFloat(skuWtStr || "") || 0;
                                const qty = parseFloat(p.qtyToDispatch) || 0;
                                return sum + (skuWt * qty);
                              }, 0);
                            return totalSelectedWt.toFixed(wd);
                          })()}
                        </TableHead>
                        <TableHead className="px-4 h-10" />
                        <TableHead className="px-4 h-10" />
                        <TableHead className="px-4 h-10" />
                        <TableHead className="pl-4 pr-6 text-right h-10 font-mono tabular-nums font-black text-blue-700">
                          {(() => {
                            const total = sumTaxable(selectedGroups.flatMap(g => g._allProducts)
                              .filter(p => selectedProducts.includes(p._rowKey))
                              .map(p => {
                                const cdAmt = productCdData[p.id]?.isCd === 'yes' ? parseFloat(productCdData[p.id]?.cdAmount || '0') : 0;
                                return { rate: (Number(p.rate) || 0) - cdAmt, qty: parseFloat(p.qtyToDispatch) || 0, product: p };
                              }));
                            return total === null ? "—" : fmtAmount(total);
                          })()}
                        </TableHead>
                      </TableRow>
                      <TableRow>
                        <TableHead className="w-12 text-left px-4 h-10">
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
                        <TableHead className="px-4 text-left h-10">Is CD</TableHead>
                        <TableHead className="px-4 text-right h-10 whitespace-nowrap">CD Amount (₹)</TableHead>
                        <TableHead className="px-4 text-right h-10 whitespace-nowrap min-w-[110px]">Weight (KGS)</TableHead>
                        <TableHead className="px-4 text-right h-10 whitespace-nowrap min-w-[110px]">Actual Qty Dispatch</TableHead>
                        <TableHead className="px-4 text-right h-10 whitespace-nowrap min-w-[110px]">Rate Inc. Taxes (₹)</TableHead>
                        <TableHead className="px-4 text-right h-10 whitespace-nowrap min-w-[110px]"><RateWithoutGstHeading /></TableHead>
                        <TableHead className="pl-4 pr-6 text-right h-10 whitespace-nowrap min-w-[110px]">Taxable Amount (₹)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedGroups.flatMap(g => g._allProducts).map((product: any) => (
                        <TableRow key={product._rowKey} className={cn(selectedProducts.includes(product._rowKey) ? "bg-blue-50/20" : "", "h-14")}>
                          <TableCell className="text-left px-4 py-2">
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
                          <TableCell className="px-4 py-2 text-left">
                            <Select
                              value={productCdData[product.id]?.isCd || "no"}
                              onValueChange={(val) => setProductCdData(prev => ({
                                ...prev,
                                [product.id]: { ...(prev[product.id] || { cdAmount: "0" }), isCd: val }
                              }))}
                            >
                              <SelectTrigger className="h-8 text-[10px] font-bold">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="no">No</SelectItem>
                                <SelectItem value="yes">Yes</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="px-4 py-2 text-right">
                            {productCdData[product.id]?.isCd === 'yes' && (
                              <Input
                                type="number"
                                className="h-8 text-[10px] font-bold w-20 ml-auto text-right font-mono tabular-nums"
                                value={productCdData[product.id]?.cdAmount || ""}
                                onChange={(e) => setProductCdData(prev => ({
                                  ...prev,
                                  [product.id]: { ...(prev[product.id] || { isCd: "yes" }), cdAmount: e.target.value }
                                }))}
                                placeholder="Amount"
                              />
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-2 text-right text-xs font-bold text-slate-700 font-mono tabular-nums whitespace-nowrap">
                            {(() => {
                              const skuWtStr = skuWeightMap.get(product.productName?.trim().toLowerCase());
                              const skuWt = parseFloat(skuWtStr || "") || 0;
                              const qty = parseFloat(product.qtyToDispatch) || 0;
                              const totalWt = skuWt * qty;
                              if (!totalWt) return "—";
                              return totalWt.toFixed(wd);
                            })()}
                          </TableCell>
                          <TableCell className="px-4 py-2 text-right font-mono tabular-nums whitespace-nowrap">
                            <span className="text-xs font-bold text-slate-700 font-mono tabular-nums">{fmtNum(product.qtyToDispatch || 0, 0)}</span>
                          </TableCell>
                          <TableCell className="px-4 py-2 text-right text-xs font-bold text-slate-700 font-mono tabular-nums whitespace-nowrap">
                            {(() => {
                              const originalRate = Number(product.rate) || 0;
                              const cdAmt = productCdData[product.id]?.isCd === 'yes' ? parseFloat(productCdData[product.id]?.cdAmount || '0') : 0;
                              const adjustedRate = originalRate - cdAmt;
                              return (
                                <RateInclusiveTaxPopover
                                  product={product}
                                  cdAmount={cdAmt}
                                  displayRate={adjustedRate}
                                  align="end"
                                />
                              );
                            })()}
                          </TableCell>
                          <TableCell className="px-4 py-2 text-right text-xs font-bold text-slate-700 font-mono tabular-nums whitespace-nowrap">
                            {(() => {
                              const originalRate = Number(product.rate) || 0;
                              const cdAmt = productCdData[product.id]?.isCd === 'yes' ? parseFloat(productCdData[product.id]?.cdAmount || '0') : 0;
                              const adjustedRate = originalRate - cdAmt;
                              return rateWithoutGstText(adjustedRate, product);
                            })()}
                          </TableCell>
                          <TableCell className="pl-4 pr-6 py-2 text-right text-xs font-bold text-slate-700 font-mono tabular-nums whitespace-nowrap">
                            {(() => {
                              const originalRate = Number(product.rate) || 0;
                              const cdAmt = productCdData[product.id]?.isCd === 'yes' ? parseFloat(productCdData[product.id]?.cdAmount || '0') : 0;
                              const adjustedRate = originalRate - cdAmt;
                              const qty = parseFloat(product.qtyToDispatch) || 0;
                              const taxableAmount = taxableOf(adjustedRate, qty, product);
                              return taxableAmount ? fmtAmount(taxableAmount) : "—";
                            })()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
                      const cdAmt = productCdData[product.id]?.isCd === 'yes' ? parseFloat(productCdData[product.id]?.cdAmount || '0') : 0
                      const adjustedRate = originalRate - cdAmt
                      const qty = parseFloat(product.qtyToDispatch) || 0
                      const taxableAmount = taxableOf(adjustedRate, qty, product)

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
                              <p className="mt-1 font-mono font-bold text-slate-700">
                                {(() => {
                                  const skuWtStr = skuWeightMap.get(product.productName?.trim().toLowerCase());
                                  const skuWt = parseFloat(skuWtStr || "") || 0;
                                  const qty = parseFloat(product.qtyToDispatch) || 0;
                                  const totalWt = skuWt * qty;
                                  if (!totalWt) return "—";
                                  return totalWt.toFixed(wd);
                                })()}
                              </p>
                            </div>
                            <div className="rounded-md bg-slate-50 p-2">
                              <p className="text-[10px] font-black uppercase text-slate-400">Actual Qty Dispatch</p>
                              <p className="mt-1 font-mono font-bold text-blue-700">{fmtNum(product.qtyToDispatch || 0, 0)}</p>
                            </div>
                            <div className="rounded-md bg-slate-50 p-2">
                              <p className="text-[10px] font-black uppercase text-slate-400">Rate Inc. Taxes (₹)</p>
                              <div className="mt-1">
                                <RateInclusiveTaxPopover
                                  product={product}
                                  cdAmount={productCdData[product.id]?.isCd === 'yes' ? productCdData[product.id]?.cdAmount : 0}
                                  displayRate={adjustedRate}
                                  align="center"
                                />
                              </div>
                            </div>
                            <div className="rounded-md bg-slate-50 p-2">
                              <p className="text-[10px] font-black uppercase text-slate-400"><RateWithoutGstHeading /></p>
                              <p className="mt-1 font-mono font-bold text-slate-700">
                                {rateWithoutGstText(adjustedRate, product)}
                              </p>
                            </div>
                            <div className="rounded-md bg-slate-50 p-2">
                              <p className="text-[10px] font-black uppercase text-slate-400">Taxable Amount (₹)</p>
                              <p className="mt-1 font-mono font-bold text-slate-700">{taxableAmount ? fmtAmount(taxableAmount) : "—"}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-3">
                            <div className="space-y-2">
                              <Label className="text-[10px] font-black uppercase text-slate-400">Is CD</Label>
                              <Select
                                value={productCdData[product.id]?.isCd || "no"}
                                onValueChange={(val) => setProductCdData(prev => ({
                                  ...prev,
                                  [product.id]: { ...(prev[product.id] || { cdAmount: "0" }), isCd: val }
                                }))}
                              >
                                <SelectTrigger className="h-9 text-xs font-bold">
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="no">No</SelectItem>
                                  <SelectItem value="yes">Yes</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {productCdData[product.id]?.isCd === 'yes' && (
                              <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400">CD Amount</Label>
                                <Input
                                  type="number"
                                  className="h-9 text-xs font-bold"
                                  value={productCdData[product.id]?.cdAmount || ""}
                                  onChange={(e) => setProductCdData(prev => ({
                                    ...prev,
                                    [product.id]: { ...(prev[product.id] || { isCd: "yes" }), cdAmount: e.target.value }
                                  }))}
                                  placeholder="Amount"
                                />
                              </div>
                            )}
                          </div>

                        </div>
                      )
                    })}
                    <div className="grid grid-cols-2 gap-3 rounded-lg border bg-slate-50 p-3 text-xs">
                      <div>
                        <p className="text-[9px] uppercase font-black text-slate-500">Total Weight</p>
                        <p className="mt-1 font-black text-blue-700 font-mono tabular-nums">
                          {(() => {
                            const totalSelectedWt = selectedGroups.flatMap(g => g._allProducts)
                              .filter(p => selectedProducts.includes(p._rowKey))
                              .reduce((sum, p) => {
                                const skuWtStr = skuWeightMap.get(p.productName?.trim().toLowerCase());
                                const skuWt = parseFloat(skuWtStr || "") || 0;
                                const qty = parseFloat(p.qtyToDispatch) || 0;
                                return sum + (skuWt * qty);
                              }, 0);
                            return totalSelectedWt.toFixed(wd);
                          })()}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase font-black text-slate-500">Total Amount (₹)</p>
                        <p className="mt-1 font-black text-blue-700 font-mono tabular-nums">
                          {fmtAmount(selectedGroups.flatMap(g => g._allProducts)
                            .filter(p => selectedProducts.includes(p._rowKey))
                            .reduce((sum, p) => {
                              const originalRate = Number(p.rate) || 0;
                              const cdAmt = productCdData[p.id]?.isCd === 'yes' ? parseFloat(productCdData[p.id]?.cdAmount || '0') : 0;
                              const adjustedRate = originalRate - cdAmt;
                              const qty = parseFloat(p.qtyToDispatch) || 0;
                              return sum + (adjustedRate * qty);
                            }, 0), 2)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* GST & Invoice Summary */}
                <InvoiceSummary
                  selectedGroups={selectedGroups}
                  selectedProducts={selectedProducts}
                  productCdData={productCdData}
                  chargesBillable={invoiceCharges.billableTotal}
                />

                <OrderChargesPanel orderNos={invoiceOrderNos} />

                {/* 3. Invoice Form */}
                <div className="space-y-6 border rounded-lg p-4 sm:p-6 bg-white shadow-sm">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b pb-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    Invoice Details
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    <div className="space-y-2">
                      <Label>Invoice Number <span className="text-red-500">*</span></Label>
                      <Input
                        className="h-10"
                        value={invoiceData.invoiceNo}
                        onChange={(e) => setInvoiceData({ ...invoiceData, invoiceNo: e.target.value })}
                        placeholder="Enter Invoice No"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Invoice Date <span className="text-red-500">*</span></Label>
                      <Input
                        type="date"
                        className="h-10"
                        value={invoiceData.invoiceDate}
                        onChange={(e) => setInvoiceData({ ...invoiceData, invoiceDate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <FileUploadField
                        label={<Label>Upload Invoice Copy <span className="text-red-500">*</span></Label>}
                        accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
                        helperText="Supported: PDF, JPG, PNG, WEBP · Max size: 20 MB"
                        value={invoiceData.invoiceFile}
                        fileName={invoiceData.invoiceFileName}
                        uploading={isUploadingObj['invoiceFile'] || false}
                        buttonText={invoiceData.invoiceFileName ? 'REPLACE' : 'UPLOAD'}
                        onFilesSelected={(files) => files[0] && handleFileUpload(files[0], 'invoiceFile', 'invoiceFileName')}
                        onRemove={() => setInvoiceData(p => ({ ...p, invoiceFile: "", invoiceFileName: "" }))}
                        capture="environment"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Driver Advance & Diesel Form */}
                <div className="space-y-6 border rounded-lg p-4 sm:p-6 bg-white shadow-sm mt-4">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b pb-2">
                    <Truck className="h-4 w-4 text-purple-600" />
                    Driver Advance & Diesel Details
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5 text-slate-700">
                        Driver Advance (Cash)
                        <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">From Actual Dispatch</span>
                      </Label>
                      <Input
                        type="number"
                        className="h-10 bg-slate-50 text-slate-700 font-semibold cursor-not-allowed border-slate-200"
                        value={invoiceData.driverAdvanceCash}
                        readOnly
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5 text-slate-700">
                        Driver Advance (Bank)
                        <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">From Actual Dispatch</span>
                      </Label>
                      <Input
                        type="number"
                        className="h-10 bg-slate-50 text-slate-700 font-semibold cursor-not-allowed border-slate-200"
                        value={invoiceData.driverAdvanceBank}
                        readOnly
                        placeholder="0.00"
                      />
                    </div>
                    {/* Empty div to force Diesel fields to a new row on large screens */}
                    <div className="hidden lg:block"></div>
                    <div className="space-y-2">
                      <Label>Petrol Pump Name</Label>
                      <Combobox
                        value={invoiceData.petrolPumpName}
                        onValueChange={(v) => setInvoiceData({ ...invoiceData, petrolPumpName: v })}
                        options={petrolPumpOptions}
                        placeholder="Select Petrol Pump"
                        searchPlaceholder="Search pump..."
                        emptyText="No pump found."
                        className="h-10 w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5 text-slate-700">
                        Diesel Amount
                        <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">From Actual Dispatch</span>
                      </Label>
                      <Input
                        type="number"
                        className="h-10 bg-slate-50 text-slate-700 font-semibold cursor-not-allowed border-slate-200"
                        value={invoiceData.dieselAmount}
                        readOnly
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <FileUploadField
                        label={<Label>Upload Diesel Parchi <span className="text-red-500">*</span></Label>}
                        accept="image/*,.jpg,.jpeg,.png,.webp,.pdf"
                        helperText="Supported: PDF, JPG, PNG, WEBP · Max size: 20 MB"
                        value={invoiceData.dieselParchiFile}
                        fileName={invoiceData.dieselParchiFileName}
                        uploading={isUploadingObj['dieselParchiFile'] || false}
                        buttonText={invoiceData.dieselParchiFileName ? 'REPLACE' : 'UPLOAD'}
                        onFilesSelected={(files) => files[0] && handleFileUpload(files[0], 'dieselParchiFile', 'dieselParchiFileName')}
                        onRemove={() => setInvoiceData(p => ({ ...p, dieselParchiFile: "", dieselParchiFileName: "" }))}
                        capture="environment"
                      />
                    </div>
                  </div>
                </div>

                {/* 5. Insurance Details Form */}
                <div className="space-y-6 border rounded-lg p-4 sm:p-6 bg-white shadow-sm mt-4">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b pb-2">
                    <FileText className="h-4 w-4 text-emerald-600" />
                    Insurance Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-2">
                      <Label>Select Insurance Company</Label>
                      <Combobox
                        value={invoiceData.insuranceDetails}
                        onValueChange={(v) => setInvoiceData({ ...invoiceData, insuranceDetails: v })}
                        options={insuranceOptions}
                        placeholder="Select Insurance Details"
                        searchPlaceholder="Search insurance..."
                        emptyText="No insurance found."
                        className="h-10 w-full bg-white border-2 rounded-xl"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="mt-8 w-full border-t bg-slate-50/50 -mx-3 sm:-mx-6 -mb-3 sm:-mb-6 px-3 sm:px-6 py-4 sm:flex-col sm:justify-start">
              <StageActionFooter
                // Cancel stays inert while a submit is running (it used to be a disabled button).
                onCancel={() => setIsDialogOpen(false)}
                cancelDisabled={isProcessing}
                actions={[
                  {
                    variant: "outline",
                    label: <><Printer className="h-4 w-4" />Print Data</>,
                    title: "Print Invoice Data Sheet",
                    onClick: handlePrint,
                  },
                  {
                    label: isProcessing ? "Processing..." : "Generate Invoice",
                    onClick: handleSubmit,
                    disabled: isProcessing || !invoiceData.invoiceNo || isReadOnly,
                    title: isReadOnly ? "View Only Access" : "Generate Invoice",
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
