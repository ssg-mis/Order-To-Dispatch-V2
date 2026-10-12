"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { usePersistedFilters } from "@/hooks/use-persisted-filters"
import { useStageTable, type StageColDef } from "@/hooks/use-stage-table"
import { StageListHeader, StageToolbar, StageSegmented, StageFilterSelect, StageColumnsMenu, StageDivider, StageActiveChips, StageHeadCell, StageTotalsRow, StageSortIcon, StageActionBar } from "@/components/stage-list"
import { WorkflowStageShell } from "@/components/workflow/workflow-stage-shell"
import { cn } from "@/lib/utils"
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
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { FileUploadField } from "@/components/file-upload-field"
import { Upload, X, Plus, Settings2, ShieldAlert, ShieldCheck, ChevronDown, ChevronUp, FileText, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { WORKFLOW_STAGE_COLUMNS as ALL_COLUMNS } from "@/lib/workflow-columns"
import { ColumnToggleContent } from "@/components/ui/column-toggle-content"
import { securityGuardApprovalApi, orderApi } from "@/lib/api-service"
import { isStaleWriteError } from "@/lib/stale-write"
import { useAuth } from "@/hooks/use-auth"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { StageHistoryTab } from "@/components/workflow/stage-history-tab"
import { Loader2, ChevronLeft, ChevronRight, Filter, RotateCcw, ExternalLink } from "lucide-react"
import { usePersistedColumns } from "@/hooks/use-persisted-columns"
import { useColumnOrder } from "@/hooks/use-column-order"
import { SortableTableHead } from "@/components/ui/sortable-table-head"
import { ColumnDragProvider } from "@/components/ui/column-drag-provider"
import { fmtNum, fmtDate } from "@/lib/table-format"

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

const PAGE_COLUMNS = [
  { id: "partySoDate",       label: "DO Date" },
  { id: "actualDispatchDate", label: "Actual Dispatch Date" },
  { id: "orderNo",           label: "DO Numbers" },
  { id: "processid",         label: "Manual Sauda No." },
  { id: "customerName",      label: "Customer Name" },
  { id: "vehicleNo",         label: "Vehicle No." },
  { id: "orderPunchRemarks", label: "Order Punch Remarks" },
] as const
type ColId = typeof PAGE_COLUMNS[number]["id"]

export default function SecurityApprovalPage() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const { toast } = useToast()
  const { isReadOnly, user, isAdmin, isFeatureEnabled } = useAuth()
  const [confirmDetails, setConfirmDetails] = useState<Record<string, { qty: string }>>({})
  const [expandedOrders, setExpandedOrders] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending")
  const [pendingPage, setPendingPage] = useState(1);

  const [filterValues, setFilterValues] = useState({
    status: "",
    startDate: "",
    endDate: "",
    partyName: "all",
    search: "",
    manualSaudaNo: ""
  })

  const [filterOptions, setFilterOptions] = useState<{ customerNames: string[], depots: string[] }>({
    customerNames: [],
    depots: []
  });
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
    if (!value || value === "—") return <p className="text-[10px] font-black text-slate-400 leading-none">NOT UPLOADED</p>;

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
        <a href={docUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-600 hover:text-blue-800 underline transition-all">
          {formattedDate !== "—" ? formattedDate : "View Document"}
        </a>
      );
    }
    if (formattedDate !== "—") return <span className="text-xs font-bold text-slate-700">{formattedDate}</span>;
    return <span className="text-[10px] text-slate-400">—</span>;
  };

  const [visibleColumns, setVisibleColumns] = usePersistedColumns(
    "security-approval",
    ["partySoDate", "actualDispatchDate", "orderNo", "processid", "customerName", "vehicleNo", "orderPunchRemarks", "status"]
  )
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [selectedGroups, setSelectedGroups] = useState<any[]>([])
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isUploading, setIsUploading] = useState<string | null>(null)
  const [uploadData, setUploadData] = useState({
    biltyNo: "",
    biltyImage: null as File | null,
    biltyImageName: "",
    biltyImagePreview: "",
    // Segregated vehicle images
    frontImage: null as File | null,
    frontImagePreview: "",
    frontImageName: "",
    backImage: null as File | null,
    backImagePreview: "",
    backImageName: "",
    loadedImage: null as File | null,
    loadedImagePreview: "",
    loadedImageName: "",
    checklist: {
      mallLoad: false,
      qtyMatch: false,
      gaadiCovered: false,
      image: false,
      driverCond: false,
    },
    verdict: "", // Removed default selection to force user intent
    remarks: "", // Added state to track revert remarks
  })

  // Fetch filter options
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const res = await securityGuardApprovalApi.getFilters();
        if (res.success) {
          setFilterOptions(res.data);
        }
      } catch (err) {
        console.error("Failed to fetch filters", err);
      }
    };
    fetchFilters();
  }, []);

  // Pending query with numeric pagination
  const {
    data: pendingResult,
    isLoading: isPendingLoading,
    refetch: refetchPending,
  } = useQuery({
    queryKey: ["security-approval-pending", filterValues, pendingPage],
    queryFn: async () => {
      const response = await securityGuardApprovalApi.getPending({
        page: pendingPage,
        limit: 10,
        search: filterValues.search,
        manual_sauda_no: filterValues.manualSaudaNo,
        do_date_from: filterValues.startDate,
        do_date_to: filterValues.endDate,
        customer_name: !filterValues.partyName || filterValues.partyName === "all" ? undefined : filterValues.partyName,
      });
      return response.success ? response.data : { approvals: [], pagination: { total: 0 } };
    },
  });

  const pendingOrders = useMemo(() => {
    return pendingResult?.approvals || [];
  }, [pendingResult]);

  // Reset pages when filters change
  useEffect(() => {
    setPendingPage(1);
  }, [filterValues]);

  const handleFileUpload = (file: File, type: 'bilty' | 'front' | 'back' | 'loaded') => {
    if (!file) return;
    const preview = URL.createObjectURL(file);
    if (type === 'bilty') {
      const preview = URL.createObjectURL(file);
      setUploadData(p => { if (p.biltyImagePreview) URL.revokeObjectURL(p.biltyImagePreview); return { ...p, biltyImage: file, biltyImageName: file.name, biltyImagePreview: preview }; });
    } else if (type === 'front') {
      setUploadData(p => { if (p.frontImagePreview) URL.revokeObjectURL(p.frontImagePreview); return { ...p, frontImage: file, frontImagePreview: preview, frontImageName: file.name }; });
    } else if (type === 'back') {
      setUploadData(p => { if (p.backImagePreview) URL.revokeObjectURL(p.backImagePreview); return { ...p, backImage: file, backImagePreview: preview, backImageName: file.name }; });
    } else if (type === 'loaded') {
      setUploadData(p => { if (p.loadedImagePreview) URL.revokeObjectURL(p.loadedImagePreview); return { ...p, loadedImage: file, loadedImagePreview: preview, loadedImageName: file.name }; });
    }
  };

  const uploadSelectedFile = async (file: File, uploadId: string) => {
    setIsUploading(uploadId);
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

  useEffect(() => {
    // refetchPending and refetchHistory are already initiated by the queryKey dependency on filterValues
  }, [])

  const handleBulkSubmit = async () => {
    if (selectedGroups.length === 0) return

    // Submit only selected products across all groups
    const allSelectedProducts = selectedGroups.flatMap(group =>
      group._allProducts.filter((p: any) => selectedProducts.includes(p._rowKey))
    )

    if (allSelectedProducts.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one product to process",
        variant: "destructive"
      })
      return
    }

    if (!uploadData.verdict) {
      toast({
        title: "Error",
        description: "Please select a Security Verdict",
        variant: "destructive"
      })
      return
    }

    if (uploadData.verdict === "REJECT" && !uploadData.remarks?.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for rejecting via the Revert Remarks field",
        variant: "destructive"
      })
      return
    }

    setIsProcessing(true)
    try {
      const successfulSubmissions: any[] = []
      const failedSubmissions: any[] = []
      const biltyImageUrl = uploadData.biltyImage
        ? await uploadSelectedFile(uploadData.biltyImage, 'bilty')
        : null
      const frontImageUrl = uploadData.frontImage
        ? await uploadSelectedFile(uploadData.frontImage, 'front')
        : null
      const backImageUrl = uploadData.backImage
        ? await uploadSelectedFile(uploadData.backImage, 'back')
        : null
      const loadedImageUrl = uploadData.loadedImage
        ? await uploadSelectedFile(uploadData.loadedImage, 'loaded')
        : null

      // Submit each selected product to backend API
      for (const product of allSelectedProducts) {
        const recordId = product.id; // Use the lift_receiving_confirmation table ID

        try {
          if (recordId) {
            const submitData = {
              biltyNo: uploadData.biltyNo || null,
              biltyImage: biltyImageUrl,
              frontImage: frontImageUrl,
              backImage: backImageUrl,
              loadedVehicleImage: loadedImageUrl,
              verdictStatus: uploadData.verdict, // Adding verdict to API
              userId: user?.id || null, // Track acting user's login id
              remarks: uploadData.verdict === 'REJECT' ? uploadData.remarks : null // Pass remarks if rejecting
            };

            console.log('[SECURITY] Submitting approval for ID:', recordId, submitData);
            const response = await securityGuardApprovalApi.submit(recordId, submitData);
            console.log('[SECURITY] API Response:', response);

            if (response.success) {
              successfulSubmissions.push({ product, response });
            } else {
              failedSubmissions.push({ product, error: response.message || 'Unknown error' });
            }
          } else {
            console.warn('[SECURITY] Skipping - no record ID found for:', product);
            failedSubmissions.push({ product, error: 'No record ID found' });
          }
        } catch (error: any) {
          console.error('[SECURITY] Failed to submit approval:', error);
          failedSubmissions.push({ product, error: error?.message || error?.toString() || 'Unknown error', code: error?.code });
        }
      }

      // Show results
      if (successfulSubmissions.length > 0) {
        toast({
          title: "Security Approved",
          description: `${successfulSubmissions.length} approval(s) completed successfully.`,
        });

        // Clear selections and form
        setSelectedItems([]);
        setIsDialogOpen(false);
        setUploadData({
          biltyNo: "",
          biltyImage: null,
          biltyImageName: "",
          biltyImagePreview: "",
          frontImage: null,
          frontImagePreview: "",
          frontImageName: "",
          backImage: null,
          backImagePreview: "",
          backImageName: "",
          loadedImage: null,
          loadedImagePreview: "",
          loadedImageName: "",
          checklist: {
            mallLoad: false,
            qtyMatch: false,
            gaadiCovered: false,
            image: false,
            driverCond: false,
          },
          verdict: "",
          remarks: "",
        });

        // Refresh data from backend
        await refetchPending();
        queryClient.invalidateQueries({ queryKey: ["security-approval-history"] });

        // Navigate to next stage after delay
        // setTimeout(() => {
        //   router.push("/make-invoice")
        // }, 1500)
      }

      // Stale-write conflicts: the row was already processed/moved by another user.
      // Refetch the pending list even if nothing succeeded so the phantom row vanishes.
      const staleWrites = failedSubmissions.filter((f: any) => isStaleWriteError(f));
      const otherFailures = failedSubmissions.filter((f: any) => !isStaleWriteError(f));

      if (staleWrites.length > 0) {
        toast({
          title: "Already processed",
          description: `${staleWrites.length} approval(s) were already processed or moved by another user. Refreshing the list…`,
          variant: "destructive",
        })
        await refetchPending();
        queryClient.invalidateQueries({ queryKey: ["security-approval-history"] });
      }

      if (otherFailures.length > 0) {
        console.error('[SECURITY] Failed submissions:', otherFailures);
        toast({
          title: "Some Approvals Failed",
          description: `${otherFailures.length} approval(s) failed. Check console for details.`,
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error('[SECURITY] Unexpected error:', error);
      toast({
        title: "Error",
        description: error?.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false)
    }
  }

  /* Extract unique customer names */
  const customerNames = Array.from(new Set(pendingOrders.map((order: any) => order.party_name || "Unknown")))


  const filteredPendingOrders = pendingOrders;

  // Group orders by actual_1 date and Truck No
  const displayRows = useMemo(() => {
    const grouped: { [key: string]: any } = {}

    filteredPendingOrders.forEach((order: any) => {
      // Step 1: Create a grouping key based on date (YYYY-MM-DD) and truck_no
      const actualDate = order.actual_1 ? String(order.actual_1).split(/[T ]/)[0] : 'NoDate'
      const truckNo = (order.truck_no || order.truckNo || 'NoTruck').toUpperCase().trim()
      const groupKey = `${actualDate}_${truckNo}`

      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          _rowKey: groupKey,
          actualDate: actualDate,
          truckNo: truckNo,
          customerNames: new Set<string>(),
          doNumberList: new Set<string>(),
          _allProducts: [],
          _ordersMap: {}, // Group items by DO for interleaved view
          _productCount: 0
        }
      }

      const group = grouped[groupKey]
      const currentCustName = (order.transfer === 'yes' && order.bill_company_name)
        ? order.bill_company_name
        : (order.party_name || order.partyName || "Unknown Customer")
      group.customerNames.add(currentCustName)

      const rawDoNumber = order.so_no || order.soNo || "—"
      const doNumber = rawDoNumber.replace(/(?<=\d)[A-Z].*$/, '')
      group.doNumberList.add(doNumber)

      // Handle interleaved grouping (by unique DO)
      const baseDo = doNumber
      if (!group._ordersMap[baseDo]) {
        group._ordersMap[baseDo] = {
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
          brokerName: order.broker_name || "—",
          partyCredit: order.party_credit_status || "Good",
          orderPunchRemarks: order.order_punch_remarks || "—",
          partySoDate: formatDate(order.party_so_date || order.partySoDate),
          uploadSo: order.upload_so || null,
        }
      }

      const product = {
        ...order,
        _rowKey: `${groupKey}-${order.d_sr_number || order.id}`,
        id: order.id,
        specificOrderNo: doNumber,
        productName: order.product_name || order.productName,
        qtyToDispatch: order.actual_qty_dispatch || order.qty_to_be_dispatched || 0,
        deliveryFrom: order.dispatch_from || "—",
        actualQty: order.actual_qty_dispatch,
        truckNo: order.truck_no,
        rstNo: order.rst_no,
        grossWeight: order.gross_weight,
        tareWeight: order.tare_weight,
        netWeight: order.net_weight,
        weightDiff: order.difference || 0,
        reason_of_difference_in_weight_if_any_speacefic: order.reason_of_difference_in_weight_if_any_speacefic,
        transporterName: order.transporter_name,
        dsrNumber: order.d_sr_number,
        processid: order.processid || null
      }

      group._ordersMap[baseDo]._products.push(product)
      group._allProducts.push(product)
      group._productCount = group._allProducts.length
    })

    // Finalize groups
    return Object.values(grouped).map((group: any) => {
      const uniqueCustomers = Array.from(group.customerNames as Set<string>)
      const uniqueDos = Array.from(group.doNumberList as Set<string>)
      const uniqueProcessIds = Array.from(new Set<string>(group._allProducts.map((p: any) => (p.processid as string) || "—")))

      const formatLabel = (list: string[]) => {
        if (list.length === 0) return "—"
        if (list.length === 1) return list[0]
        return `${list[0]} & ${list.length - 1} more`
      }

      return {
        ...group,
        partySoDate: formatDate(group._allProducts[0]?.party_so_date),
        // Actual Dispatch Date = the date the group is keyed on (actual_1). group.actualDate
        // is the raw "YYYY-MM-DD" used for grouping; format it for display, "—" if absent.
        actualDispatchDate: (group.actualDate && group.actualDate !== "NoDate") ? formatDate(group.actualDate) : "—",
        doNumber: formatLabel(uniqueDos),
        customerName: formatLabel(uniqueCustomers),
        processId: formatLabel(uniqueProcessIds),
        vehicleNo: group.truckNo !== 'NOTRUCK' ? group.truckNo : "—",
        orderPunchRemarks: group._allProducts[0]?.order_punch_remarks || "—",
        uploadSo: group._allProducts[0]?.upload_so || group._allProducts[0]?.uploadSo || null,
        isDisabled: group._allProducts.some((p: any) => p.actual_1 == null),
        // actual_qty_dispatch is a PER-PRODUCT line quantity, so the group total must
        // sum across every product — otherwise getDynamicColumnValue falls back to
        // only the first product's qty (e.g. showing 10 instead of 435 for 6 products).
        // actual_qty itself is already a whole-load total duplicated on every product
        // row, so it needs no summation and is left to the existing first-product fallback.
        actual_qty_dispatch: group._allProducts.reduce((sum: number, p: any) => sum + (Number(p.actual_qty_dispatch) || 0), 0),
        // One entry per DO in this group, so columns that vary per-DO (DO Number,
        // Dispatched Date, Order Punch Remarks) can be rendered stacked instead of
        // collapsing to a truncated label or the first DO's value.
        doDetails: Object.entries(group._ordersMap as Record<string, any>).map(([doNo, details]) => {
          const firstProd = details._products[0] || {}
          return {
            doNumber: doNo,
            dispatchedDate: formatDate(firstProd.actual_1) || "—",
            orderPunchRemarks: firstProd.order_punch_remarks || details.orderPunchRemarks || "—",
            processId: firstProd.processid || "—",
          }
        }),
      }
    })
  }, [filteredPendingOrders])

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

  // ── Stage table filter state ──
  // Status is remembered permanently; the rest is session-scoped (usePersistedFilters). Refresh only reloads data.
  const [listView, patchListView] = usePersistedFilters("security-approval", {
    quickSearch: "",
    statusFilter: "ALL" as "ALL" | "PENDING" | "REJECTED",
    customerFilter: "ALL",
  }, { permanentKeys: ["statusFilter"] })
  const { quickSearch, statusFilter, customerFilter } = listView
  const setQuickSearch = (v: string) => patchListView({ quickSearch: v })
  const setStatusFilter = (v: "ALL" | "PENDING" | "REJECTED") => patchListView({ statusFilter: v })
  const setCustomerFilter = (v: string) => patchListView({ customerFilter: v })

  const [columnOrder, setColumnOrder] = useColumnOrder("security-approval", PAGE_COLUMNS.map(c => c.id))
  // actualDispatchDate is a computed core column, always shown (it isn't in the toggle
  // registry, so it can't be enabled/disabled from the menu anyway).
  const ALWAYS_VISIBLE_COLS = new Set(["actualDispatchDate"])
  const orderedVisibleCols = useMemo(() =>
    columnOrder
      .map(id => PAGE_COLUMNS.find(c => c.id === id))
      .filter((c): c is typeof PAGE_COLUMNS[number] => !!c)
      .filter(c => ALWAYS_VISIBLE_COLS.has(c.id) || visibleColumns.includes(c.id)),
    [columnOrder, visibleColumns]
  )
  const handleColumnReorder = useCallback((newOrder: string[]) => {
    const coreInNewOrder = newOrder.filter(id => PAGE_COLUMNS.some(c => c.id === id))
    const hiddenCols = columnOrder.filter(id => !coreInNewOrder.includes(id))
    setColumnOrder([...coreInNewOrder, ...hiddenCols])
  }, [columnOrder, setColumnOrder])

  const EXTRA_COLS_EXCLUDED = ['partySoDate', 'actualDispatchDate', 'orderNo', 'customerName', 'vehicleNo', 'processid', 'status', 'orderPunchRemarks', 'products']
  const NUMERIC_TOTAL_COLS = new Set(["actual_qty_dispatch"])
  // Table standard: numeric + date extra columns right aligned, plain fixed decimals / dd/mm/yyyy.
  const NUM_DECIMALS: Record<string, number> = {
    actual_qty_dispatch: 4, orderQty: 4, qtyToDispatch: 4, actual_qty: 4, actual_approval_qty: 4, altQty: 4, damage_qty: 4,
    gross_weight: 4, tare_weight: 4, net_weight: 4, extra_weight: 4,
    rate: 2, ratePerLtr: 2, ratePer15Kg: 2, rateOfMaterial: 2, totalWithGst: 2, advanceAmount: 2, bill_amount: 2,
  }
  const DATE_COL_IDS = new Set([
    "deliveryDate", "invoice_date", "fitness_end_date", "insurance_end_date", "tax_end_date",
    "pollution_end_date", "permit1_end_date", "permit2_end_date",
  ])
  const fmtExtra = (id: string, v: any) => {
    if (v === "—" || v === null || v === undefined || v === "") return "—"
    if (id in NUM_DECIMALS) return fmtNum(v, NUM_DECIMALS[id])
    if (DATE_COL_IDS.has(id)) return fmtDate(v)
    return String(v)
  }
  const joinDo = (g: any, key: string) =>
    (g.doDetails || []).map((d: any) => d[key]).filter((v: any) => v && v !== "—").join(" ") || ""
  const isRejectedGroup = (g: any) => g._allProducts.some((p: any) => p.security_guard_status === "REJECT")

  const extraColIds = useMemo(
    () => visibleColumns.filter(colId => !EXTRA_COLS_EXCLUDED.includes(colId) && ALL_COLUMNS.some(c => c.id === colId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleColumns]
  )

  const tableCols = useMemo<StageColDef<any>[]>(() => {
    const coreAcc: Record<string, StageColDef<any>> = {
      partySoDate: { id: "partySoDate", label: "DO Date", type: "date", accessor: g => g._allProducts[0]?.party_so_date || g._allProducts[0]?.partySoDate },
      actualDispatchDate: { id: "actualDispatchDate", label: "Actual Dispatch Date", type: "date", accessor: g => (g.actualDate && g.actualDate !== "NoDate" ? g.actualDate : "") },
      orderNo: { id: "orderNo", label: "DO Numbers", accessor: g => joinDo(g, "doNumber") || g.doNumber },
      processid: { id: "processid", label: "Manual Sauda No.", accessor: g => joinDo(g, "processId") || g.processId },
      customerName: { id: "customerName", label: "Customer Name", accessor: g => Array.from(g.customerNames as Set<string>).join(", ") },
      vehicleNo: { id: "vehicleNo", label: "Vehicle No.", accessor: g => g.vehicleNo },
      orderPunchRemarks: { id: "orderPunchRemarks", label: "Order Punch Remarks", accessor: g => joinDo(g, "orderPunchRemarks") || g.orderPunchRemarks },
    }
    const core = orderedVisibleCols.map(c => coreAcc[c.id]).filter(Boolean)
    const extra: StageColDef<any>[] = extraColIds.map(colId => {
      const numeric = NUMERIC_TOTAL_COLS.has(colId)
      const isNum = colId in NUM_DECIMALS
      const isDate = DATE_COL_IDS.has(colId)
      return {
        id: colId,
        label: numeric ? "Actual Qty Dispatch (MT)" : (ALL_COLUMNS.find(c => c.id === colId)?.label || colId),
        type: isNum ? "number" : isDate ? "date" : "text",
        total: numeric,
        accessor: (g: any) => {
          const v = getDynamicColumnValue(g, colId)
          if (isNum) return Number(v) || 0
          if (isDate) return v === "—" ? "" : v
          return String(v)
        },
      } as StageColDef<any>
    })
    const status: StageColDef<any> = {
      id: "__status",
      label: "Status",
      accessor: g => (isRejectedGroup(g) ? "Rejected" : "Pending Guard"),
    }
    return [...core, ...extra, status]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedVisibleCols, extraColIds])

  const baseFilter = useCallback((g: any) => {
    if (statusFilter === "REJECTED" && !isRejectedGroup(g)) return false
    if (statusFilter === "PENDING" && isRejectedGroup(g)) return false
    if (customerFilter !== "ALL" && !(g.customerNames as Set<string>).has(customerFilter)) return false
    const q = quickSearch.trim().toLowerCase()
    if (q) {
      const hay = [joinDo(g, "doNumber"), g.doNumber, joinDo(g, "processId"), Array.from(g.customerNames as Set<string>).join(" "), g.vehicleNo, joinDo(g, "orderPunchRemarks")]
        .join(" ")
        .toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, customerFilter, quickSearch])

  const table = useStageTable<any>({ rows: displayRows, columns: tableCols, baseFilter, persistKey: "security-approval" })
  const sortedDisplayRows = table.rows
  const uniqueCustomerNames = useMemo(
    () => Array.from(new Set(displayRows.flatMap((g: any) => Array.from(g.customerNames as Set<string>)))).sort() as string[],
    [displayRows]
  )
  const activeFiltersCount =
    (statusFilter !== "ALL" ? 1 : 0) + (customerFilter !== "ALL" ? 1 : 0) + (quickSearch.trim() ? 1 : 0) + table.activeColumnFilterCount
  const clearAllTableFilters = () => {
    patchListView({ statusFilter: "ALL", customerFilter: "ALL", quickSearch: "" })
    table.clearColumnFilters()
  }
  const statusColDef = tableCols[tableCols.length - 1]
  const statusSortable = true
  const RIGHT_COLS = new Set<string>(["partySoDate", "actualDispatchDate", ...Object.keys(NUM_DECIMALS), ...Array.from(DATE_COL_IDS)])
  const colAlign = (id: string): "left" | "right" => (RIGHT_COLS.has(id) ? "right" : "left")

  const renderCoreCell = (group: any, colId: ColId) => {
    switch (colId) {
      case "partySoDate":
        return <TableCell key={colId} className="p-4 text-right text-xs text-slate-600 font-mono tabular-nums min-w-[115px]">{group.partySoDate}</TableCell>
      case "actualDispatchDate": {
        const dispatchedDates = group.doDetails && group.doDetails.length > 0
          ? Array.from(new Set(group.doDetails.map((d: any) => d.dispatchedDate)))
          : [group.actualDispatchDate]
        return (
          <TableCell key={colId} className="p-4 text-right text-xs text-slate-600 font-mono tabular-nums min-w-[115px]">
            <div className="flex flex-col gap-1.5">
              {dispatchedDates.map((date: any, idx: number) => (
                <span key={`${date}-${idx}`}>{date}</span>
              ))}
            </div>
          </TableCell>
        )
      }
      case "orderNo":
        return (
          <TableCell key={colId} className="p-4 text-left">
            <div className="flex flex-col gap-1.5">
              {(group.doDetails && group.doDetails.length > 0 ? group.doDetails : [{ doNumber: group.doNumber }]).map((d: any, idx: number) => (
                <span key={`${d.doNumber}-${idx}`} className="text-xs font-bold text-blue-700">{d.doNumber}</span>
              ))}
            </div>
          </TableCell>
        )
      case "processid":
        return (
          <TableCell key={colId} className="p-4">
            <div className="flex flex-col gap-1.5">
              {(group.doDetails && group.doDetails.length > 0 ? group.doDetails : [{ doNumber: "—", processId: group.processId }]).map((d: any, idx: number) => (
                <span key={`${d.doNumber}-${idx}`} className="text-xs text-slate-600">{d.processId}</span>
              ))}
            </div>
          </TableCell>
        )
      case "customerName":
        return <TableCell key={colId} className="p-4 text-xs text-slate-600"><span className="font-medium text-slate-700">{group.customerName}</span></TableCell>
      case "vehicleNo":
        return <TableCell key={colId} className="text-left p-4"><span className="text-xs text-slate-600">{group.vehicleNo}</span></TableCell>
      case "orderPunchRemarks":
        return (
          <TableCell key={colId} className="text-left p-4">
            <div className="flex flex-col gap-1.5">
              {(group.doDetails && group.doDetails.length > 0 ? group.doDetails : [{ doNumber: "—", orderPunchRemarks: group.orderPunchRemarks }]).map((d: any, idx: number) => (
                <span key={`${d.doNumber}-${idx}`} className="text-xs text-slate-600">{d.orderPunchRemarks}</span>
              ))}
            </div>
          </TableCell>
        )
      default:
        return null
    }
  }





  const toggleSelectItem = (itemKey: string) => {
    setSelectedItems(prev =>
      prev.includes(itemKey)
        ? prev.filter(k => k !== itemKey)
        : [...prev, itemKey]
    )
  }

  const toggleSelectAll = () => {
    const enabledRows = sortedDisplayRows.filter(r => !r.isDisabled)
    if (selectedItems.length === enabledRows.length && enabledRows.length > 0) {
      setSelectedItems([])
    } else {
      setSelectedItems(enabledRows.map(r => r._rowKey))
    }
  }

  const handleOpenDialog = () => {
    if (selectedItems.length === 0) return

    const targets = displayRows.filter(r => selectedItems.includes(r._rowKey))
    if (targets.length > 0) {
      setSelectedGroups(targets)
      // Select all products for all selected groups by default
      const allRowKeys = targets.flatMap(g => g._allProducts.map((p: any) => p._rowKey))
      setSelectedProducts(allRowKeys)

      setUploadData({
        biltyNo: "",
        biltyImage: null,
        biltyImageName: "",
        frontImage: null,
        frontImagePreview: "",
        frontImageName: "",
        backImage: null,
        backImagePreview: "",
        backImageName: "",
        loadedImage: null,
        loadedImagePreview: "",
        loadedImageName: "",
        checklist: {
          mallLoad: false,
          qtyMatch: false,
          gaadiCovered: false,
          image: false,
          driverCond: false,
        },
        verdict: "",
        remarks: "",
      })
      setIsDialogOpen(true)
    }
  }

  return (
    <WorkflowStageShell
      persistKey="security-approval"
      title="Stage 8: Security Guard Approval"
      description="Upload bilty and vehicle images for security verification."
      pendingCount={pendingResult?.pagination?.total || 0}
      historyData={[]}
      onFilterChange={setFilterValues}
      partyNames={filterOptions.customerNames}
      showStatusFilter={true}
      stageLevel={5}
      onTabChange={setActiveTab}
      showDateFilters={true}
      showSaudaFilter={true}
      dateLabel="DO Date"
      searchPlaceholder="Search DO Number..."
      historyContent={
        <StageHistoryTab
          queryKeyPrefix="security-approval-history"
          getHistoryApi={(params: any) => securityGuardApprovalApi.getHistory({
            page: params.page,
            limit: params.limit,
            search: params.order_no,
            manual_sauda_no: filterValues.manualSaudaNo || undefined,
            do_date_from: params.start_date,
            do_date_to: params.end_date,
            customer_name: params.customer_name,
          })}
          filterValues={filterValues}
          activeTab={activeTab}
          stageName="Security Approval"
          stageLevel={5}
          remarksColName="Bilty No"
          orderListKey="approvals"
          mapOrderNo={(record: any) => record.so_no || "-"}
          mapCustomerName={(record: any) => (record.transfer === 'yes' && record.bill_company_name) ? record.bill_company_name : record.party_name}
          mapRemarks={(record: any) => record.bilty_no || "-"}
          getDate={(record: any) => record.actual_4 || null}
        />
      }
    >
      <div className="space-y-4">
        <StageActionBar>
          <Button
            onClick={handleOpenDialog}
            disabled={selectedItems.length === 0}
            className="bg-blue-600 hover:bg-blue-700 shadow-md transition-all active:scale-95"
          >
            <Upload className="mr-2 h-4 w-4" />
            Process Security ({selectedItems.length})
          </Button>

                </StageActionBar>

        <Card className="border border-slate-200/80 shadow-xs overflow-hidden py-0 gap-0 stage-card">
          <StageListHeader
            title="Pending Security Approvals"
            shown={sortedDisplayRows.length}
            total={displayRows.length}
            description="Vehicles awaiting security guard verification"
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
                      { value: "PENDING", label: "Pending Guard" },
                      { value: "REJECTED", label: "Rejected" },
                    ]}
                  />
                  <StageDivider />
                  <StageFilterSelect value={customerFilter} onChange={setCustomerFilter} allLabel="All Customers" options={uniqueCustomerNames} />
                  {/* "products" ("Items") has no real column here — the product list/count is
                      always shown via the fixed "{n} PRODUCTS" expand header, not a toggleable
                      cell — so it's excluded here to avoid a broken checkbox. */}
                  <StageColumnsMenu
                    columns={ALL_COLUMNS.filter(c => c.id !== "products")}
                    visibleColumns={visibleColumns}
                    setVisibleColumns={setVisibleColumns}
                    show={isAdmin || isFeatureEnabled('can_toggle_columns')}
                  />
                </>
              }
            />
            <StageActiveChips
              chips={[
                ...(statusFilter !== "ALL" ? [{ label: `Status: ${statusFilter === "PENDING" ? "Pending Guard" : "Rejected"}`, onClear: () => setStatusFilter("ALL") }] : []),
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
                <TableHead className="w-12 text-left align-top py-2.5 px-4">
                  <div className="mt-8 flex justify-start">
                    <Checkbox
                      checked={sortedDisplayRows.length > 0 && selectedItems.length === sortedDisplayRows.filter(r => !r.isDisabled).length && sortedDisplayRows.filter(r => !r.isDisabled).length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </div>
                </TableHead>
                <ColumnDragProvider columnIds={[...orderedVisibleCols.map(c => c.id), ...extraColIds]} onReorder={handleColumnReorder} disabled={!isAdmin && !isFeatureEnabled('can_reorder_columns')}>
                  {[...tableCols.slice(0, -1)].map(col => (
                    <StageHeadCell key={col.id} col={col} table={table} align={colAlign(col.id)} width={colAlign(col.id) === "right" ? "min-w-[125px]" : undefined} />
                  ))}
                  <StageHeadCell key={statusColDef.id} col={statusColDef} table={table} align="left" />
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
                  format={(n) => n.toFixed(4)}
                  tones={{ actual_qty_dispatch: "blue" }}
                  align={Object.fromEntries([...tableCols.map(c => [c.id, colAlign(c.id)]), ["__select", "center" as const]])}
                />
              )}
              {isPendingLoading && pendingOrders.length === 0 ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i} className="opacity-40 border-b border-slate-50">
                    <TableCell className="px-4 text-left py-4"><div className="h-4 w-4 bg-slate-200 animate-pulse rounded" /></TableCell>
                    {tableCols.map(c => (
                      <TableCell key={c.id} className="p-4"><div className="h-3 w-20 bg-slate-200 animate-pulse rounded-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : sortedDisplayRows.length > 0 ? (
                sortedDisplayRows.map((group) => (
                  <TableRow key={group._rowKey} className={cn("hover:bg-blue-50/30 transition-colors", selectedItems.includes(group._rowKey) ? "bg-blue-50/50" : "")}>
                    <TableCell className="text-left px-4 py-4">
                      <Checkbox disabled={group.isDisabled} checked={selectedItems.includes(group._rowKey)} onCheckedChange={() => toggleSelectItem(group._rowKey)} />
                    </TableCell>
                    {orderedVisibleCols.map(col => renderCoreCell(group, col.id))}
                    {extraColIds.map(colId => {
                      return (
                        <TableCell key={colId} className={cn("p-4", colAlign(colId) === "right" ? "text-right min-w-[125px]" : "text-left")}>
                          {colId in NUM_DECIMALS
                            ? <span className="text-xs text-slate-600 font-mono tabular-nums">{fmtExtra(colId, getDynamicColumnValue(group, colId))}</span>
                            : DATE_COL_IDS.has(colId)
                              ? <span className="text-xs text-slate-600 font-mono tabular-nums">{fmtExtra(colId, getDynamicColumnValue(group, colId))}</span>
                              : <span className="text-xs text-slate-600">{String(getDynamicColumnValue(group, colId))}</span>}
                        </TableCell>
                      )
                    })}
                    <TableCell className="text-left p-4">
                      {group._allProducts.some((p: any) => p.security_guard_status === 'REJECT') ? (
                        <Badge className="bg-red-100 text-red-700 border-red-200 font-black text-[10px] uppercase">REJECTED</Badge>
                      ) : (
                        <Badge className="bg-orange-100 text-orange-700 border-orange-200 font-black text-[10px] uppercase">Pending Guard</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                  <TableRow>
                  <TableCell colSpan={orderedVisibleCols.length + 2 + extraColIds.length} className="text-center py-20">
                    <div className="flex flex-col items-center gap-2">
                      <ShieldAlert className="w-12 h-12 text-slate-200" />
                      <p className="text-slate-400 font-black uppercase tracking-widest text-xs">{displayRows.length > 0 ? "No matching vehicles for the applied filters" : "No vehicles pending for security check"}</p>
                      {displayRows.length > 0 && (
                        <button onClick={clearAllTableFilters} className="text-xs text-blue-600 hover:underline mt-1 font-semibold normal-case tracking-normal">Clear Filters</button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
          <div className="hidden md:block">
          {/* Pending Pagination Footer */}
          <div className="px-6 py-4 border-t bg-slate-50/50 flex items-center justify-between ">
            <div className="text-xs text-slate-500 font-medium tracking-tight">
              Showing <span className="text-slate-900">{(pendingPage - 1) * 10 + 1}</span> to <span className="text-slate-900">{Math.min(pendingPage * 10, pendingResult?.pagination?.total || 0)}</span> of <span className="text-slate-900">{pendingResult?.pagination?.total || 0}</span> orders
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPendingPage(p => Math.max(1, p - 1))}
                disabled={pendingPage === 1 || isPendingLoading}
                className="h-8 w-8 p-0 border-slate-200 hover:bg-white hover:text-blue-600 disabled:opacity-40 transition-all"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center px-2">
                <span className="text-xs font-semibold text-slate-900">Page {pendingPage}</span>
                <span className="text-[10px] text-slate-400 font-medium mx-1">of</span>
                <span className="text-xs font-semibold text-slate-900">{pendingResult?.pagination?.totalPages || 1}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPendingPage(p => p + 1)}
                disabled={pendingPage >= (pendingResult?.pagination?.totalPages || 1) || isPendingLoading}
                className="h-8 w-8 p-0 border-slate-200 hover:bg-white hover:text-blue-600 disabled:opacity-40 transition-all"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          </div>
          </CardContent>
        </Card>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-4">
          {isPendingLoading && pendingOrders.length === 0 ? (
            [...Array(3)].map((_, i) => (
              <Card key={i} className="p-4 space-y-4 animate-pulse bg-white/50">
                <div className="h-4 w-1/3 bg-slate-200 rounded" />
                <div className="h-8 w-full bg-slate-100 rounded" />
                <div className="h-4 w-1/2 bg-slate-200 rounded" />
              </Card>
            ))
          ) : sortedDisplayRows.length > 0 ? (
            sortedDisplayRows.map((group) => (
              <Card key={group._rowKey} className={cn("p-4 border-2 transition-all relative overflow-hidden", selectedItems.includes(group._rowKey) ? "border-blue-500 bg-blue-50/30 shadow-lg" : "border-slate-100 bg-white shadow-sm")}>
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{group.partySoDate}</span>
                      <Checkbox 
                        disabled={group.isDisabled} 
                        checked={selectedItems.includes(group._rowKey)} 
                        onCheckedChange={() => toggleSelectItem(group._rowKey)}
                        className="h-5 w-5 border-2 border-blue-200 data-[state=checked]:bg-blue-600"
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <h4 className="text-sm font-black text-slate-800 uppercase leading-tight italic">{group.customerName}</h4>
                      <div className="flex flex-col gap-0.5">
                        {(group.doDetails && group.doDetails.length > 0 ? group.doDetails : [{ doNumber: group.doNumber }]).map((d: any, idx: number) => (
                          <p key={`${d.doNumber}-${idx}`} className="font-mono text-sm font-black text-blue-700 break-all">{d.doNumber}</p>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 py-2 border-y border-slate-50">
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Actual Dispatch Date</p>
                        <div className="flex flex-col gap-0.5">
                          {(group.doDetails && group.doDetails.length > 0
                            ? Array.from(new Set(group.doDetails.map((d: any) => d.dispatchedDate)))
                            : [group.actualDispatchDate]
                          ).map((date: any, idx: number) => (
                            <p key={`${date}-${idx}`} className="text-xs font-bold text-slate-700">{date}</p>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Vehicle No</p>
                        <p className="text-xs font-bold text-slate-700">{group.vehicleNo}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Manual Sauda No.</p>
                        <div className="flex flex-col gap-0.5">
                          {(group.doDetails && group.doDetails.length > 0 ? group.doDetails : [{ doNumber: "—", processId: group.processId }]).map((d: any, idx: number) => (
                            <p key={`${d.doNumber}-${idx}`} className="text-xs font-bold text-slate-700">{d.processId}</p>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end">
                      {group._allProducts.some((p: any) => p.security_guard_status === 'REJECT') ? (
                        <Badge className="bg-red-100 text-red-700 font-black text-[9px]">REJECTED</Badge>
                      ) : (
                        <Badge className="bg-orange-100 text-orange-700 font-black text-[9px]">PENDING GUARD</Badge>
                      )}
                    </div>

                    {group.orderPunchRemarks && group.orderPunchRemarks !== "—" && (
                      <div className="mt-2 p-2 bg-slate-50 rounded-lg">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Remarks</p>
                        <div className="flex flex-col gap-1">
                          {(group.doDetails && group.doDetails.length > 0 ? group.doDetails : [{ doNumber: "—", orderPunchRemarks: group.orderPunchRemarks }]).map((d: any, idx: number) => (
                            <p key={`${d.doNumber}-${idx}`} className="text-[10px] font-medium text-slate-600 italic">"{d.orderPunchRemarks}"</p>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Dynamic columns selected by user */}
                    <div className="grid grid-cols-1 gap-y-3 pt-2">
                      {visibleColumns.filter(colId => 
                        !['partySoDate', 'actualDispatchDate', 'orderNo', 'customerName', 'vehicleNo', 'processid', 'status', 'orderPunchRemarks', 'products'].includes(colId)
                      ).map(colId => {
                        const col = ALL_COLUMNS.find(c => c.id === colId);
                        if (!col) return null;
                        const val = getDynamicColumnValue(group, colId);
                        return (
                          <div key={colId} className="space-y-0.5 border-l-2 border-slate-100 pl-3">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{NUMERIC_TOTAL_COLS.has(colId) ? `${col.label} (MT)` : col.label}</p>
                            <p className={cn("text-xs font-bold text-slate-700 leading-relaxed", colAlign(colId) === "right" && "font-mono tabular-nums")}>{fmtExtra(colId, val)}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-100">
              <ShieldAlert className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-400 font-black uppercase tracking-widest text-xs">{displayRows.length > 0 ? "No matching records found" : "No pending vehicles"}</p>
              {displayRows.length > 0 && (
                <button onClick={clearAllTableFilters} className="text-xs text-blue-600 hover:underline mt-2 font-semibold">Clear Filters</button>
              )}
            </div>
          )}

          {/* Mobile Pagination */}
          <div className="flex items-center justify-between px-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setPendingPage(p => Math.max(1, p - 1))} disabled={pendingPage === 1}>Prev</Button>
            <span className="text-xs font-black text-slate-500 uppercase">Page {pendingPage} of {pendingResult?.pagination?.totalPages || 1}</span>
            <Button variant="outline" size="sm" onClick={() => setPendingPage(p => p + 1)} disabled={pendingPage >= (pendingResult?.pagination?.totalPages || 1)}>Next</Button>
          </div>
        </div>
      </div>

      {/* Split-View Dialog (Premium Refactor) */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:w-[95vw] sm:!max-w-[95vw] max-h-[95dvh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] p-0">
          <DialogHeader className="border-b p-4 sm:p-6 md:p-8 pr-10 bg-slate-50/50">
            <DialogTitle className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 leading-tight uppercase tracking-tighter italic">
              Security Verification Audit
            </DialogTitle>
            <DialogDescription className="text-slate-500 mt-2 font-bold uppercase text-[10px] tracking-widest leading-relaxed">
              Reviewing {selectedGroups.length} Batch(es) for final gatepass authorization
            </DialogDescription>
          </DialogHeader>

          {selectedGroups.length > 0 && (
            <div className="space-y-8 lg:space-y-12 mt-4 sm:mt-6">
              {selectedGroups.map((group, groupIdx) => (
                <div key={group._rowKey} className="space-y-4 sm:space-y-6 px-4 sm:px-6 md:px-8">
                  <h2 className="text-base sm:text-xl font-black text-slate-800 border-b-4 border-slate-100 pb-2 mt-4 uppercase tracking-tight flex flex-col sm:flex-row sm:items-center justify-between gap-2 break-words">
                    {group.customerName}
                    <Badge className="bg-blue-600 text-white sm:ml-3 px-3 py-1 font-black w-fit">
                      {group._productCount} PRODUCTS
                    </Badge>
                  </h2>

                  {Object.entries(group._ordersMap).map(([baseDo, orderDetails]: [string, any], orderIdx) => {
                    const orderProducts = orderDetails._products;
                    const enabledOrderProducts = orderProducts;
                    const allOrderSelected = enabledOrderProducts.length > 0 && enabledOrderProducts.every((p: any) => selectedProducts.includes(p._rowKey));
                    const isOrderDisabled = false;
                    const isExpanded = expandedOrders.includes(baseDo);
                    const toggleExpand = () => {
                      setExpandedOrders(prev => isExpanded ? prev.filter(id => id !== baseDo) : [...prev, baseDo]);
                    };

                    // Use details from the first product of the order for the details bar
                    const firstProd = orderProducts[0] || {};

                    return (
                      <div key={`${group._rowKey}-${baseDo}`} className="space-y-4 border-2 border-slate-100 rounded-xl sm:rounded-3xl overflow-hidden bg-white shadow-sm">
                        <div className="bg-blue-600 px-3 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer" onClick={toggleExpand}>
                          <div className="flex flex-wrap items-center gap-3 sm:gap-4 min-w-0">
                            <Badge className="bg-white text-blue-800 hover:bg-white px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-black tracking-tight rounded-full shadow-sm max-w-full whitespace-normal">
                              ORDER: {baseDo}
                            </Badge>
                            <div className="flex flex-col min-w-0">
                              <span className="text-[10px] text-blue-100 font-black uppercase tracking-widest leading-none mb-1">GROUP {groupIdx + 1} | SECTION {orderIdx + 1}</span>
                              <span className="text-xs text-blue-100 font-bold leading-none">
                                {orderProducts.filter((p: any) => selectedProducts.includes(p._rowKey)).length} Items Selected
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                            <div className="text-[10px] sm:text-[11px] text-blue-50 font-bold uppercase tracking-widest sm:mr-2 leading-tight cursor-pointer">
                              {isExpanded ? 'HIDE DISPATCH DETAILS ▲' : 'CLICK TO SHOW DETAILS ▼'}
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20 rounded-full">
                              {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                            </Button>
                          </div>
                        </div>

                        <div className="px-3 sm:px-5 pb-5 space-y-4">
                          {/* Collapsible Dispatch Details Bar */}
                          {isExpanded && (
                            <div className="bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl p-4 md:p-6 relative shadow-inner mt-2 animate-in slide-in-from-top-2 duration-300">
                               <div className="space-y-6">
                                  {/* Section 1: Order Information */}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Purpose</p>
                                      <p className="text-xs font-bold text-slate-900">{orderDetails.deliveryPurpose || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Start/End Date</p>
                                      <p className="text-[10px] md:text-xs font-bold text-slate-700">
                                        {formatDate(orderDetails.startDate)} - {formatDate(orderDetails.endDate)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">DO Date</p>
                                      <p className="text-xs font-bold text-slate-700">{orderDetails.partySoDate || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Transport</p>
                                      <p className="text-xs font-bold text-slate-900">{orderDetails.transportType || "—"}</p>
                                    </div>

                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Credit</p>
                                      <Badge className={cn("text-[10px] font-black px-2 py-0.5", orderDetails.partyCredit === 'Good' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                                        {orderDetails.partyCredit || "Good"}
                                      </Badge>
                                    </div>
                                    <div className="sm:col-span-2 xl:col-span-1">
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Address</p>
                                      <p className="text-[10px] font-medium text-slate-600 leading-tight break-words" title={orderDetails.address}>{orderDetails.address || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Contact</p>
                                      <p className="text-[10px] md:text-xs font-bold text-slate-900">{orderDetails.contactPerson} ({orderDetails.whatsapp || "—"})</p>
                                    </div>

                                    <div className="sm:col-span-2">
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Broker / Advance</p>
                                      <p className="text-xs font-bold text-slate-900 leading-none">{orderDetails.brokerName || "—"} / ₹{orderDetails.advanceAmount || 0}</p>
                                    </div>

                                    <div className="sm:col-span-2">
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Order Punch Remarks</p>
                                      <p className="text-[10px] font-medium text-slate-600 leading-tight italic">"{orderDetails.orderPunchRemarks || "No special instructions."}"</p>
                                    </div>
                                    <div className="sm:col-span-2">
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">PO Copy</p>
                                      {group.uploadSo ? (
                                        <a href={group.uploadSo} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-all border border-blue-200 w-fit group shadow-sm mt-0.5">
                                          <FileText className="h-3 w-3" />
                                          <span className="text-[10px] font-black uppercase tracking-tight">VIEW PO</span>
                                        </a>
                                      ) : <p className="text-[10px] font-black text-slate-400 mt-1">NOT UPLOADED</p>}
                                    </div>
                                  </div>

                                  <div className="h-px bg-slate-200" />

                                  {/* Section 2: Dispatch Details (Documents) */}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Truck No</p>
                                      <p className="text-xs font-black text-blue-700 uppercase">{firstProd.truck_no || firstProd.truckNo || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Bilty No</p>
                                      <p className="text-xs font-black text-blue-600">{firstProd.bilty_no || firstProd.biltyNo || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Transporter</p>
                                      <p className="text-xs font-bold text-slate-700 leading-tight break-words">{firstProd.transporter_name || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Audit Status</p>
                                      <Badge variant="outline" className={cn("text-[9px] font-black px-2 py-0.5 uppercase", firstProd.check_status === 'Approved' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-orange-50 text-orange-700 border-orange-200')}>
                                        {firstProd.check_status || "Pending"}
                                      </Badge>
                                    </div>
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
                                  </div>

                                  <div className="h-px bg-slate-200" />

                                  {/* Section 3: Vehicle & Driver Details */}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-x-6 md:gap-y-8">
                                    <div className="sm:col-span-2 xl:col-span-4 flex items-center gap-2 mb-[-8px]">
                                      <div className="h-3 w-1 bg-blue-600 rounded-full" />
                                      <p className="text-[10px] font-black uppercase tracking-widest text-blue-900/60 italic">Vehicle Specifications</p>
                                    </div>
                                    
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Vehicle Type</p>
                                      <p className="text-xs font-bold text-slate-900">{firstProd.vehicle_type || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">RTO</p>
                                      <p className="text-xs font-bold text-slate-900">{firstProd.rto || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Passing Weight</p>
                                      <p className="text-xs font-bold text-slate-900">{firstProd.passing_weight || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Road Tax</p>
                                      <p className="text-xs font-bold text-slate-900">{firstProd.road_tax || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">GVW</p>
                                      <p className="text-xs font-bold text-slate-900">{firstProd.gvw || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">ULW</p>
                                      <p className="text-xs font-bold text-slate-900">{firstProd.ulw || "—"}</p>
                                    </div>

                                    <div className="sm:col-span-2 xl:col-span-4 flex items-center gap-2 mb-[-8px] mt-2">
                                      <div className="h-3 w-1 bg-amber-600 rounded-full" />
                                      <p className="text-[10px] font-black uppercase tracking-widest text-amber-900/60 italic">Driver Information</p>
                                    </div>

                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Name</p>
                                      <p className="text-xs font-bold text-slate-900">{firstProd.driver_name || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Contact</p>
                                      <p className="text-xs font-bold text-slate-900">{firstProd.driver_contact_no || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">License</p>
                                      <p className="text-xs font-bold text-slate-900">{firstProd.driving_license_no || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Valid Upto</p>
                                      <p className="text-xs font-bold text-slate-900">{formatDate(firstProd.dl_valid_upto)}</p>
                                    </div>
                                  </div>

                                  <div className="h-px bg-slate-200" />

                                  {/* Section 4: Weight Details */}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">RST No</p>
                                      <p className="text-xs font-black text-blue-700 leading-none">#{firstProd.rst_no || firstProd.rstNo || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Gross / Tare / Net</p>
                                      <p className="text-[10px] font-black text-slate-700 leading-none">
                                        {firstProd.gross_weight || 0}/{firstProd.tare_weight || 0}/<span className="text-blue-600">{(Number(firstProd.gross_weight || 0) - Number(firstProd.tare_weight || 0))}</span>
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Diff / Extra</p>
                                      <p className="text-xs font-black text-slate-700 leading-none">
                                        <span className={(parseFloat(firstProd.weight_diff) || 0) < 0 ? "text-red-500" : "text-green-600"}>{firstProd.weight_diff || 0}</span> / {firstProd.extra_weight || 0}
                                      </p>
                                    </div>
                                    <div className="sm:col-span-2 xl:col-span-1">
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 leading-none">Reason</p>
                                      <p className="text-[10px] font-medium text-slate-500 italic mt-1 leading-tight">{firstProd.reason_of_difference_in_weight_if_any_speacefic || "—"}</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                          )}

                          {/* Simple Product Table (Always Visible) */}
                          {/* Responsive Product List */}
                          <div className="border border-slate-200 rounded-xl sm:rounded-2xl overflow-hidden shadow-sm bg-white">
                            {/* Desktop Table */}
                            <div className="hidden lg:block">
                              <Table>
                                <TableHeader className="bg-slate-50 border-b">
                                  <TableRow className="bg-slate-100/90 border-b-2 border-slate-300 font-bold text-xs text-slate-800 hover:bg-slate-100/90">
                                    <TableCell className="w-12 px-4"></TableCell>
                                    <TableCell className="px-4 font-black text-slate-900 uppercase tracking-wider text-[11px]">Total ({orderProducts.length})</TableCell>
                                    <TableCell className="px-4 text-right font-mono tabular-nums font-black text-blue-700 min-w-[120px]">
                                      {fmtNum(orderProducts.reduce((sum: number, p: any) => sum + (Number(p.actual_qty_dispatch || p.actualQty) || 0), 0))}
                                    </TableCell>
                                    <TableCell className="px-4"></TableCell>
                                  </TableRow>
                                  <TableRow>
                                    <TableHead className="w-12 text-left h-10 px-4">
                                      <Checkbox
                                        checked={allOrderSelected}
                                        disabled={isOrderDisabled}
                                        onCheckedChange={(checked) => {
                                          if (checked) {
                                            setSelectedProducts(prev => Array.from(new Set([...prev, ...enabledOrderProducts.map((p: any) => p._rowKey)])))
                                          } else {
                                            setSelectedProducts(prev => prev.filter(k => !enabledOrderProducts.some((p: any) => p._rowKey === k)))
                                          }
                                        }}
                                      />
                                    </TableHead>
                                    <TableHead className="px-4 text-left h-10">Product Info</TableHead>
                                    <TableHead className="px-4 text-right h-10 min-w-[120px]">Qty (MT)</TableHead>
                                    <TableHead className="px-4 text-left h-10">Status</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {orderProducts.map((product: any) => (
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
                                      <TableCell className="px-4 py-2 text-left">
                                        <div className="flex flex-col">
                                          <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{product.productName}</span>
                                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{product.specificOrderNo}</span>
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-right px-4 py-2 font-mono tabular-nums text-xs font-semibold text-blue-700 min-w-[120px]">
                                        {fmtNum(product.actual_qty_dispatch || product.actualQty || 0)}
                                      </TableCell>
                                      <TableCell className="text-left px-4 py-2">
                                        {product.security_guard_status === 'REJECT' ? (
                                          <Badge variant="destructive" className="font-black text-[8px] uppercase">REJECTED BY SECURITY</Badge>
                                        ) : product.actual_1 == null ? (
                                          <Badge variant="destructive" className="font-black text-[8px] uppercase">Pending Data</Badge>
                                        ) : (
                                          <Badge className="bg-green-100 text-green-700 border-green-200 font-black text-[9px] uppercase">Loaded OK</Badge>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>

                            {/* Mobile Card-List for Products */}
                            <div className="lg:hidden divide-y divide-slate-100">
                              <div className="p-3 bg-slate-50 flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase text-slate-500">Products in this Load</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-black text-slate-400">SELECT ALL</span>
                                  <Checkbox
                                    checked={allOrderSelected}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setSelectedProducts(prev => Array.from(new Set([...prev, ...enabledOrderProducts.map((p: any) => p._rowKey)])))
                                      } else {
                                        setSelectedProducts(prev => prev.filter(k => !enabledOrderProducts.some((p: any) => p._rowKey === k)))
                                      }
                                    }}
                                  />
                                </div>
                              </div>
                              {orderProducts.map((product: any) => (
                                <div key={product._rowKey} className={cn("p-4 flex items-start justify-between gap-4", selectedProducts.includes(product._rowKey) ? "bg-blue-50/30" : "bg-white")}>
                                  <div className="flex-1 space-y-1">
                                    <div className="flex flex-col min-[380px]:flex-row min-[380px]:items-center gap-2">
                                      <span className="text-xs font-black text-slate-800 uppercase leading-tight break-words">{product.productName}</span>
                                      <Badge className="bg-blue-600 text-white font-black text-[9px] h-4">Qty (MT): {fmtNum(product.actual_qty_dispatch || 0)}</Badge>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">#{product.specificOrderNo}</p>
                                    {product.security_guard_status === 'REJECT' ? (
                                      <Badge variant="destructive" className="text-[8px] h-4">REJECTED</Badge>
                                    ) : product.actual_1 == null ? (
                                      <Badge variant="destructive" className="text-[8px] h-4">MISSING DATA</Badge>
                                    ) : (
                                      <Badge className="bg-green-100 text-green-700 text-[8px] h-4">LOADED OK</Badge>
                                    )}
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
                                    className="h-6 w-6 rounded-lg"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* 2. Final Verification Form (Bottom Content) */}
              <div className="px-4 sm:px-6 md:px-8 pt-6 sm:pt-8 space-y-6 sm:space-y-8 animate-in fade-in duration-500 border-t-4 border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-blue-600 rounded-full" />
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest italic">Verification Checklist</h3>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-6 space-y-6 shadow-sm">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 items-start">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Bilty/GR No</Label>
                      <Input
                        placeholder="BL-100293"
                        className="h-11 border border-slate-300 rounded-xl px-4 font-bold text-sm text-slate-800 focus:border-blue-600 transition-all uppercase placeholder:text-slate-300 placeholder:font-medium"
                        value={uploadData.biltyNo}
                        onChange={(e) => setUploadData(p => ({ ...p, biltyNo: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Bilty Image</Label>
                      <label className="flex h-11 w-full items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-4 cursor-pointer hover:border-blue-400 hover:bg-blue-50/20 transition-colors">
                        <input
                          type="file"
                          accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
                          className="sr-only"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, 'bilty'); e.target.value = ''; }}
                          disabled={isUploading === 'bilty'}
                        />
                        <svg className="h-4 w-4 shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        <span className="truncate text-xs font-bold text-slate-500 uppercase tracking-wide flex-1">
                          {isUploading === 'bilty' ? 'Uploading…' : uploadData.biltyImageName || 'SCAN COPY — Choose file'}
                        </span>
                        {uploadData.biltyImageName && (
                          <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Uploaded</span>
                        )}
                      </label>
                      {/* Preview card below — same as FileUploadField style */}
                      {uploadData.biltyImagePreview && (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => window.open(uploadData.biltyImagePreview, '_blank', 'noopener,noreferrer')}
                            className="group flex w-full items-center gap-3 rounded-md border border-slate-200 bg-white p-2 text-left transition-colors hover:bg-slate-50"
                          >
                            <img src={uploadData.biltyImagePreview} alt={uploadData.biltyImageName} className="h-12 w-12 rounded-md border border-slate-200 object-cover" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium text-slate-700">{uploadData.biltyImageName}</p>
                              <p className="truncate text-[10px] text-slate-400">Click to open</p>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => { if (uploadData.biltyImagePreview) URL.revokeObjectURL(uploadData.biltyImagePreview); setUploadData(p => ({ ...p, biltyImage: null, biltyImageName: '', biltyImagePreview: '' })); }}
                            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-white shadow-sm transition-colors hover:bg-rose-700"
                          >
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Security Verdict <span className="text-red-500">*</span></Label>
                      <Select value={uploadData.verdict} onValueChange={(v) => {
                        setUploadData(p => ({ ...p, verdict: v, remarks: v === "APPROVE" ? "" : p.remarks }))
                      }}>
                        <SelectTrigger className={cn("h-11 w-full border rounded-xl px-4 font-bold text-sm uppercase transition-all", uploadData.verdict === "APPROVE" ? "border-green-200 bg-green-50 text-green-700" : uploadData.verdict === "REJECT" ? "border-red-200 bg-red-50 text-red-700" : "border-slate-200 bg-white")}>
                          <SelectValue placeholder="Verdict" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="APPROVE" className="font-bold text-green-700 uppercase">APPROVE GATEPASS</SelectItem>
                          <SelectItem value="REJECT" className="font-bold text-red-700 uppercase">REJECT & REVERT</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>


                  {uploadData.verdict === "REJECT" && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-300">
                      <Label className="text-[10px] font-black uppercase text-red-600 tracking-widest ml-1">Reason for Rejection <span className="text-red-500">*</span></Label>
                      <textarea
                        placeholder="Explain why this load is rejected..."
                        className="w-full h-24 border-2 border-red-200 bg-red-50/50 rounded-2xl p-4 font-medium text-sm text-slate-700 focus:border-red-500 focus:ring-4 focus:ring-red-100 transition-all resize-none"
                        value={uploadData.remarks || ""}
                        onChange={(e) => setUploadData(p => ({ ...p, remarks: e.target.value }))}
                      />
                    </div>
                  )}

                  <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Load Checks</span>
                    <span className="text-[10px] font-bold text-slate-500">
                      {Object.values(uploadData.checklist).filter(Boolean).length} / {Object.values(uploadData.checklist).length} checked
                    </span>
                  </div>
                  <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-5 gap-3">
                    {Object.entries(uploadData.checklist).map(([key, val]) => (
                      <div
                        key={key}
                        onClick={() => setUploadData(p => ({ ...p, checklist: { ...p.checklist, [key]: !val } }))}
                        className={cn("flex items-center gap-2.5 px-3 py-3 rounded-xl border transition-all cursor-pointer min-w-0 select-none", val ? "bg-blue-600 border-blue-600 shadow-sm" : "bg-white border-slate-300 hover:border-blue-400 hover:bg-blue-50/40")}
                      >
                        <Checkbox id={key} checked={val} onCheckedChange={(checked) => setUploadData(p => ({ ...p, checklist: { ...p.checklist, [key]: !!checked } }))} className={cn(val ? "border-white bg-white data-[state=checked]:text-blue-600" : "")} />
                        <Label htmlFor={key} className={cn("text-[11px] font-bold uppercase cursor-pointer tracking-wide leading-tight", val ? "text-white" : "text-slate-700")}>
                          {({ mallLoad: "Mal Load", qtyMatch: "Qty Match", gaadiCovered: "Gaadi Covered", image: "Image", driverCond: "Driver Condition" } as Record<string, string>)[key] ?? key.replace(/([A-Z])/g, ' $1')}
                        </Label>
                      </div>
                    ))}
                  </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Proof Images</span>
                    <div className="flex flex-row gap-3 w-full">
                      {/* Front Image */}
                      <div className="flex-1 min-w-0">
                        <FileUploadField
                          label={<span className="text-[10px] font-bold uppercase text-slate-400 tracking-widest flex items-center gap-1.5"><span>🚗</span> Front</span>}
                          accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif"
                          value={uploadData.frontImagePreview ? [uploadData.frontImagePreview] : []}
                          fileName={uploadData.frontImageName ? [uploadData.frontImageName] : []}
                          variant="dropzone"
                          placeholder="Front photo"
                          triggerClassName="flex-col justify-center gap-2 py-4 rounded-xl border-slate-300 bg-white"
                          uploading={isUploading === 'front'}
                          buttonText="Front Image"
                          onFilesSelected={(files) => { if (files[0]) handleFileUpload(files[0], 'front') }}
                          onRemove={() => {
                            if (uploadData.frontImagePreview) URL.revokeObjectURL(uploadData.frontImagePreview)
                            setUploadData(p => ({ ...p, frontImage: null, frontImagePreview: '', frontImageName: '' }))
                          }}
                        />
                      </div>
                      {/* Back Image */}
                      <div className="flex-1 min-w-0">
                        <FileUploadField
                          label={<span className="text-[10px] font-bold uppercase text-slate-400 tracking-widest flex items-center gap-1.5"><span>🔙</span> Back</span>}
                          accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif"
                          value={uploadData.backImagePreview ? [uploadData.backImagePreview] : []}
                          fileName={uploadData.backImageName ? [uploadData.backImageName] : []}
                          variant="dropzone"
                          placeholder="Back photo"
                          triggerClassName="flex-col justify-center gap-2 py-4 rounded-xl border-slate-300 bg-white"
                          uploading={isUploading === 'back'}
                          buttonText="Back Image"
                          onFilesSelected={(files) => { if (files[0]) handleFileUpload(files[0], 'back') }}
                          onRemove={() => {
                            if (uploadData.backImagePreview) URL.revokeObjectURL(uploadData.backImagePreview)
                            setUploadData(p => ({ ...p, backImage: null, backImagePreview: '', backImageName: '' }))
                          }}
                        />
                      </div>
                      {/* Loaded Vehicle Image */}
                      <div className="flex-1 min-w-0">
                        <FileUploadField
                          label={<span className="text-[10px] font-bold uppercase text-slate-400 tracking-widest flex items-center gap-1.5"><span>📦</span> Loaded</span>}
                          accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif"
                          value={uploadData.loadedImagePreview ? [uploadData.loadedImagePreview] : []}
                          fileName={uploadData.loadedImageName ? [uploadData.loadedImageName] : []}
                          variant="dropzone"
                          placeholder="Loaded vehicle"
                          triggerClassName="flex-col justify-center gap-2 py-4 rounded-xl border-slate-300 bg-white"
                          uploading={isUploading === 'loaded'}
                          buttonText="Loaded Image"
                          onFilesSelected={(files) => { if (files[0]) handleFileUpload(files[0], 'loaded') }}
                          onRemove={() => {
                            if (uploadData.loadedImagePreview) URL.revokeObjectURL(uploadData.loadedImagePreview)
                            setUploadData(p => ({ ...p, loadedImage: null, loadedImagePreview: '', loadedImageName: '' }))
                          }}
                        />
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-8 border-t p-4 md:p-8 bg-slate-50/50">
            <div className="flex flex-col gap-2 w-full">
              {/* Buttons row */}
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-end w-full">
                <Button variant="ghost" className="font-bold text-slate-500 uppercase text-xs order-last sm:order-none h-11 sm:h-10" onClick={() => setIsDialogOpen(false)}>Cancel Action</Button>
                <Button
                  onClick={handleBulkSubmit}
                  disabled={isProcessing || selectedProducts.length === 0 || isReadOnly || !uploadData.verdict}
                  className={cn(
                    "h-14 md:h-12 px-10 rounded-2xl md:rounded-xl shadow-lg font-black uppercase tracking-tighter italic text-base md:text-lg flex-1 sm:flex-none transition-colors text-white",
                    uploadData.verdict === "REJECT"
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-blue-600 hover:bg-blue-700"
                  )}
                >
                  {isProcessing
                    ? "WAIT..."
                    : uploadData.verdict === "APPROVE"
                      ? `AUTHORIZE GATEPASS (${selectedProducts.length})`
                      : uploadData.verdict === "REJECT"
                        ? `REJECT & REVERT (${selectedProducts.length})`
                        : `SELECT A VERDICT FIRST`}
                </Button>
              </div>
              {/* Stage hint — below buttons row */}
              {uploadData.verdict && !isProcessing && (
                <p className={cn("text-[10px] font-medium tracking-wide text-right", uploadData.verdict === "APPROVE" ? "text-blue-400" : "text-slate-400")}>
                  {uploadData.verdict === "APPROVE" ? "✓ Next: Make Invoice (Proforma)" : "⚠ Returns to: Actual Dispatch"}
                </p>
              )}
            </div>
          </DialogFooter>






        </DialogContent>
      </Dialog>
    </WorkflowStageShell>
  )
}
