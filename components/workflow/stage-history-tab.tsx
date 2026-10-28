"use client"

import React, { useState, useMemo, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Eye, Search, ChevronDown, ChevronUp, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, ClipboardList, Copy, Check, User, Package, IndianRupee, CalendarDays, Warehouse, Truck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useQuery } from "@tanstack/react-query"
import { FIELD_GROUPS, STAGE_NAMES, FIELD_LABELS, fieldOrderPriority } from "./workflow-stage-shell"
import { fmtDateTime, fmtNum, fmtAmount, isAmountCol } from "@/lib/table-format"
import { fmtWeight } from "@/lib/weight-format"
import { useWeightDecimals } from "@/hooks/use-weight-decimals"
import { isTimestamp } from "@/lib/date-utils"
import { LOSS_CAUSES, BORNE_BY_LABEL, type BorneBy } from "@/lib/loss-causes"
import { useStageTable, type StageColDef } from "@/hooks/use-stage-table"
import { usePersistedFilters } from "@/hooks/use-persisted-filters"
import { StageListHeader, StageToolbar, StageSegmented, StageHeadCell, StageTotalsRow, StagePagination } from "@/components/stage-list"
import { ColumnDragProvider } from "@/components/ui/column-drag-provider"

const HISTORY_COLS: StageColDef<any>[] = [
  { id: "date", label: "Date", type: "date", accessor: (r) => r.timestamp },
  { id: "orderNo", label: "Order No.", type: "text", accessor: (r) => r.orderNo },
  { id: "customerName", label: "Party Name", type: "text", accessor: (r) => r.customerName },
  { id: "status", label: "Status", type: "text", accessor: (r) => r.status },
  { id: "remarks", label: "Remarks", type: "text", accessor: (r) => r.remarks },
]
const HISTORY_COL_IDS = HISTORY_COLS.map((c) => c.id)
const HISTORY_WIDTHS: Record<string, string> = { date: "w-[12%]", orderNo: "w-[16%]", customerName: "w-[24%]", status: "w-[12%]", remarks: "w-[21%]" }
const noopReorder = () => {}

interface StageHistoryTabProps {
  // Query configurations
  queryKeyPrefix: string
  getHistoryApi: (params: Record<string, any>) => Promise<any>

  // Filters and active tab state from parent
  filterValues: {
    search: string
    partyName: string
    startDate: string
    endDate: string
    [key: string]: any
  }
  activeTab: "pending" | "history"

  // Presentational customizability
  stageName: string
  remarksColName?: string
  groupBySiblingDo?: boolean
  stageLevel?: number
  limit?: number

  // Key used to read the list from the API response (default: "orders")
  orderListKey?: string

  // Extra fixed params to pass to getHistoryApi (e.g. depo_names, manual_sauda_no)
  extraApiParams?: Record<string, any>

  // Custom getters for status, date, remarks, customer name, and order number mapping
  mapStatus?: (order: any) => string
  getDate?: (order: any) => string | null
  mapRemarks?: (order: any) => string
  mapCustomerName?: (order: any) => string
  mapOrderNo?: (order: any) => string
}

// Weight (KGS) fields get the Units Master KG decimals (not qty / MT / text fields)
const isWeightKey = (k: string) => /weight(?!ment)|gvw|(^|_)kgs?($|_)/i.test(k) && !/_mt|reason|remark|image|copy|status|user/i.test(k)

export function StageHistoryTab({
  queryKeyPrefix,
  getHistoryApi,
  filterValues,
  activeTab,
  stageName,
  remarksColName = "Remarks",
  groupBySiblingDo = true,
  stageLevel = 99,
  limit = 20,
  orderListKey = "orders",
  extraApiParams,
  mapStatus,
  getDate,
  mapRemarks,
  mapCustomerName,
  mapOrderNo,
}: StageHistoryTabProps) {
  const wd = useWeightDecimals()
  const [historyPage, setHistoryPage] = useState(1)
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<any>(null)
  const [historySearch, setHistorySearch] = useState("")
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

  // Reset page when filters change
  React.useEffect(() => {
    setHistoryPage(1)
  }, [filterValues])

  // Fetch History with React Query
  const { data, isLoading } = useQuery({
    queryKey: [queryKeyPrefix, filterValues, historyPage, extraApiParams],
    queryFn: async () => {
      // Ensure we query using the consistent parameters
      const response = await getHistoryApi({
        page: historyPage,
        limit,
        order_no: filterValues.search,
        customer_name: filterValues.partyName === "all" ? undefined : filterValues.partyName,
        start_date: filterValues.startDate,
        end_date: filterValues.endDate,
        ...(extraApiParams || {}),
      })
      return response.success ? response.data : { [orderListKey]: [], pagination: { total: 0 } }
    },
    enabled: activeTab === "history",
    staleTime: 0,
    refetchOnWindowFocus: true,
  })

  const defaultGetDate = useCallback((order: any) => {
    return order.actual_1 || order.actual_2 || order.timestamp_1 || order.timestamp_2 || order.created_at || null
  }, [])

  const defaultMapStatus = useCallback((order: any) => {
    return order.status || "Completed"
  }, [])

  // Normalize backend orders
  const historyItems = useMemo(() => {
    const rawOrders = data?.[orderListKey] || []
    return rawOrders.map((order: any) => {
      const statusValue = mapStatus ? mapStatus(order) : defaultMapStatus(order)
      const dateVal = getDate ? getDate(order) : defaultGetDate(order)

      return {
        ...order,
        rawData: order,
        orderNo: mapOrderNo ? mapOrderNo(order) : (order.order_no || "-"),
        customerName: mapCustomerName ? mapCustomerName(order) : (order.customer_name || "-"),
        stage: stageName,
        status: statusValue,
        processedBy: "System",
        timestamp: dateVal,
        date: dateVal ? new Date(dateVal).toLocaleDateString("en-GB") : "-",
        remarks: mapRemarks ? mapRemarks(order) : (order.remarks || order.remark || "-"),
      }
    })
  }, [data, stageName, mapStatus, getDate, mapRemarks, mapCustomerName, mapOrderNo, defaultMapStatus, defaultGetDate])

  const getBaseOrderNo = (orderNo: string): string => {
    if (!orderNo) return ""
    return orderNo.replace(/[A-Za-z]$/, "")
  }

  const toggleGroup = (baseOrderNo: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [baseOrderNo]: !prev[baseOrderNo],
    }))
  }

  // Status (layout) is remembered permanently; column searches/dates for the session; sort permanently.
  const historyKey = `${queryKeyPrefix}-history`
  const [hv, patchHv] = usePersistedFilters(historyKey, { status: "ALL" }, { permanentKeys: ["status"] })
  const statusOptions = useMemo(
    () => Array.from(new Set<string>((historyItems || []).map((r: any) => String(r.status || "")).filter(Boolean))).sort(),
    [historyItems]
  )
  // A remembered status that isn't on this page of results must not hide everything.
  const effectiveStatus = hv.status !== "ALL" && !statusOptions.includes(hv.status) && historyItems.length > 0 ? "ALL" : hv.status
  const baseFilter = useCallback((r: any) => effectiveStatus === "ALL" || r.status === effectiveStatus, [effectiveStatus])
  const table = useStageTable<any>({
    rows: historyItems,
    columns: HISTORY_COLS,
    baseFilter,
    defaultSort: { field: "date", dir: "desc" },
    persistKey: historyKey,
  })
  const sortedHistoryData = table.rows
  const activeHistoryFilters = (effectiveStatus !== "ALL" ? 1 : 0) + table.activeColumnFilterCount
  const resetHistoryFilters = () => {
    patchHv({ status: "ALL" })
    table.clearColumnFilters()
  }

  // Group history data by base order number if enabled
  const groupedHistoryData = useMemo(() => {
    if (!sortedHistoryData || sortedHistoryData.length === 0) return []
    if (!groupBySiblingDo) return sortedHistoryData

    const groupsMap: Record<string, any[]> = {}
    sortedHistoryData.forEach((item : any) => {
      const base = getBaseOrderNo(item.orderNo) || item.orderNo || "unknown"
      if (!groupsMap[base]) {
        groupsMap[base] = []
      }
      groupsMap[base].push(item)
    })

    return Object.entries(groupsMap).map(([baseOrderNo, items]) => {
      const rep = items[0] || {}
      return {
        isGroup: true,
        baseOrderNo,
        items,
        date: rep.date || "-",
        orderNo: baseOrderNo,
        customerName: rep.customerName || "-",
        status: rep.status || "Completed",
        remarks: rep.remarks || "-",
        rawData: rep.rawData || rep,
      }
    })
  }, [sortedHistoryData, groupBySiblingDo])

  // Group fields of the selected record for the View audit dialog
  const groupedHistoryFields = useMemo(() => {
    if (!selectedHistoryItem) return []
    const s = historySearch.toLowerCase()
    const groups: Record<number, [string, any][]> = {}

    Object.entries(selectedHistoryItem)
      .filter(([key]) => !["rawData", "_rowKey", "id"].includes(key))
      .filter(([key]) => {
        const fieldLevel = FIELD_GROUPS[key]
        return fieldLevel !== undefined && fieldLevel <= stageLevel
      })
      .filter(([key, value]) => {
        if (!historySearch) return true
        return key.toLowerCase().includes(s) || String(value).toLowerCase().includes(s)
      })
      .forEach(([key, value]) => {
        const level = FIELD_GROUPS[key] ?? 999
        if (!groups[level]) groups[level] = []
        groups[level].push([key, value])
      })

    return Object.keys(groups)
      .map(Number)
      .sort((a, b) => a - b)
      .map((level) => ({
        level,
        label: STAGE_NAMES[level] || "Other Details",
        entries: groups[level].sort(([a], [b]) => {
          const pa = fieldOrderPriority(a)
          const pb = fieldOrderPriority(b)
          if (pa !== pb) return pa - pb
          return a.localeCompare(b)
        }),
      }))
  }, [selectedHistoryItem, historySearch, stageLevel])

  const formatKey = (key: string) => {
    if (/^planned_\d+$/.test(key)) return "Planned At"
    if (/^actual_\d+$/.test(key)) return "Actual At"
    if (FIELD_LABELS[key]) return FIELD_LABELS[key]
    return key
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  }

  const renderValue = (value: any, key?: string) => {
    if (value === null || value === undefined) return "—"
    if (key && isWeightKey(key) && (typeof value === "number" || (typeof value === "string" && value.trim() !== "" && /^-?\d+(\.\d+)?$/.test(value.trim())))) return fmtWeight(value, wd)
    if (key === "overall_status_of_order") {
      const v = String(value).toLowerCase()
      return v === "true" || v === "approved" ? "Approved" : "Rejected"
    }
    if (typeof value === "boolean") return value ? "Yes" : "No"
    if (key === "shortage_cause" && LOSS_CAUSES[value]) return LOSS_CAUSES[value].label
    if ((key === "shortage_borne_by") && BORNE_BY_LABEL[value as BorneBy]) return BORNE_BY_LABEL[value as BorneBy]
    if (key === "approval_status" && typeof value === "string") return value.charAt(0).toUpperCase() + value.slice(1)
    if (Array.isArray(value)) {
      if (value.length === 0) return "—"
      return (
        <span className="flex flex-col gap-1">
          {value.map((v, i) => typeof v === "string" && v.startsWith("http") ? (
            <a key={i} href={v} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-bold">View Attachment {i + 1}</a>
          ) : (
            <span key={i}>{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
          ))}
        </span>
      )
    }
    if (typeof value === "string" && (value.startsWith("http") || value.includes("/uploads/"))) {
      return (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-bold">
          View Attachment
        </a>
      )
    }
    if (isTimestamp(value)) return fmtDateTime(value)
    if (typeof value === "number" && Number.isFinite(value) && !/(^|_)(id|no|number|phone|mobile|code)$/i.test(key || "")) return isAmountCol(key) ? fmtAmount(value, 2) : fmtNum(value, 2)
    return String(value)
  }

  const totalPages = data?.pagination?.totalPages || 1
  const totalItems = data?.pagination?.total || 0

  return (
    <Card className="border border-slate-200/80 shadow-xs overflow-clip py-0 gap-0 stage-card">
      <StageListHeader
        title="Stage History"
        shown={table.rows.length}
        total={historyItems.length}
        description="Completed records for this stage (current page of results)"
      >
        <StageToolbar
          filters={
            <StageSegmented
              value={effectiveStatus}
              onChange={(v) => patchHv({ status: v })}
              options={[{ value: "ALL", label: "All" }, ...statusOptions.map((st) => ({ value: st, label: st }))]}
            />
          }
          shown={table.rows.length}
          total={historyItems.length}
          activeCount={activeHistoryFilters}
          onReset={resetHistoryFilters}
        />
      </StageListHeader>
      {isLoading ? (
        <div className="p-0 border-none shadow-none">
          <table className="w-full text-sm table-fixed">
            <thead className="bg-muted/30 border-b text-[10px] uppercase font-black text-slate-500 tracking-wider">
              <tr>
                <th className="px-4 py-3 text-right w-[12%]">Date</th>
                <th className="px-4 py-3 text-left w-[18%]">Order No.</th>
                <th className="px-4 py-3 text-left w-[18%]">Party Name</th>
                <th className="px-4 py-3 text-left w-[12%]">Status</th>
                <th className="px-4 py-3 text-left w-[25%]">Remarks</th>
                <th className="px-4 py-3 text-left w-[15%]">Action</th>
              </tr>
            </thead>
            <tbody>
              {[...Array(5)].map((_, i) => (
                <tr key={i} className="border-b transition-colors opacity-60">
                  <td className="px-4 py-4"><div className="h-3 w-16 bg-slate-200 animate-pulse rounded-full" /></td>
                  <td className="px-4 py-4"><div className="h-3 w-24 bg-blue-100 animate-pulse rounded-full" /></td>
                  <td className="px-4 py-4"><div className="h-3 w-32 bg-slate-200 animate-pulse rounded-full" /></td>
                  <td className="px-4 py-4"><div className="h-4 w-16 bg-slate-200 animate-pulse rounded-full" /></td>
                  <td className="px-4 py-4"><div className="h-3 w-full bg-slate-100 animate-pulse rounded-full" /></td>
                  <td className="px-4 py-4 flex justify-start"><div className="h-7 w-12 bg-slate-200 animate-pulse rounded-full" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : historyItems && historyItems.length > 0 ? (
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto relative">
          {/* Desktop Table View */}
          <table className="w-full text-sm table-auto hidden md:table">
            <thead className="bg-slate-50 border-b sticky top-0 z-10 shadow-sm">
              <tr>
                <ColumnDragProvider columnIds={HISTORY_COL_IDS} onReorder={noopReorder} disabled>
                  {HISTORY_COLS.map((col) => (
                    <StageHeadCell key={col.id} col={col} table={table} width={HISTORY_WIDTHS[col.id]} />
                  ))}
                </ColumnDragProvider>
                <th className="px-4 py-3 text-left w-[15%] align-bottom text-[11px] font-semibold uppercase tracking-wide text-slate-600">Action</th>
              </tr>
            </thead>
            <tbody>
              <StageTotalsRow columns={HISTORY_COLS} totals={table.totals} count={table.rows.length} labelColumnId="orderNo" trailingCells={1} />
              {table.rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    <p className="font-medium text-slate-500">No matching records found</p>
                    <button onClick={resetHistoryFilters} className="text-xs text-blue-600 hover:underline mt-1 font-semibold">Clear Filters</button>
                  </TableCell>
                </TableRow>
              )}
              {groupedHistoryData.map((item: any) => {
                if (item.isGroup && item.items.length > 1) {
                  const isExpanded = !!expandedGroups[item.baseOrderNo]
                  return (
                    <React.Fragment key={item.baseOrderNo}>
                      {/* Main Group Row */}
                      <TableRow className="bg-slate-50/50 hover:bg-slate-100/50 border-b transition-colors font-semibold">
                        <TableCell className="px-4 py-3 text-xs text-right tabular-nums">{item.date}</TableCell>
                        <TableCell className="px-4 py-3 text-xs flex items-center gap-1.5 font-bold text-slate-800">
                          <span>{item.baseOrderNo}</span>
                          <Badge className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase">
                            {item.items.length} Items
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-[10px] capitalize text-slate-600">
                          <div className="whitespace-nowrap" title={item.customerName}>
                            {item.customerName}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-left">
                          <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-black bg-blue-100 text-blue-700 border border-blue-200 uppercase">
                            Grouped
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-[10px] text-muted-foreground font-medium italic">
                          Multiple siblings grouped
                        </TableCell>
                        <TableCell className="px-4 py-3 text-left">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-[10px] font-black bg-white hover:bg-blue-50 hover:text-blue-700 border-2 transition-all uppercase italic tracking-tighter"
                            onClick={() => toggleGroup(item.baseOrderNo)}
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="mr-1 h-3 w-3" /> Collapse
                              </>
                            ) : (
                              <>
                                <ChevronDown className="mr-1 h-3 w-3" /> Expand
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>

                      {/* Child rows when expanded */}
                      {isExpanded &&
                        item.items.map((sibling: any, siblingIdx: number) => (
                          <TableRow key={sibling.id ?? sibling.dsrNumber ?? `${sibling.orderNo}-${siblingIdx}`} className="bg-white hover:bg-blue-50/10 border-b transition-colors">
                            <TableCell className="px-4 py-2.5 text-xs text-slate-400 text-right tabular-nums">{sibling.date || "-"}</TableCell>
                            <TableCell className="px-4 py-2.5 font-bold text-blue-700 text-xs flex items-center gap-1">
                              <span className="text-slate-300 font-normal">↳</span>
                              {sibling.orderNo || "-"}
                            </TableCell>
                            <TableCell className="px-4 py-2.5 text-[10px] text-slate-500 capitalize">
                              <div className="whitespace-nowrap" title={sibling.customerName}>
                                {sibling.customerName || "-"}
                              </div>
                            </TableCell>
                            <TableCell className="px-4 py-2.5 text-left">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tight ${
                                  sibling.status === "Approved" || sibling.status === "Completed" || sibling.status === "Verified"
                                    ? "bg-green-100 text-green-700 border border-green-200"
                                    : sibling.status === "Rejected"
                                    ? "bg-red-100 text-red-700 border border-red-200"
                                    : sibling.status === "Pending Approval"
                                    ? "bg-amber-100 text-amber-800 border border-amber-300"
                                    : "bg-slate-100 text-slate-700 border border-slate-200"
                                }`}
                              >
                                {sibling.status || "Completed"}
                              </span>
                            </TableCell>
                            <TableCell className="px-4 py-2.5 text-[10px] text-muted-foreground font-medium italic">
                              {sibling.remarks || "-"}
                            </TableCell>
                            <TableCell className="px-4 py-2.5 text-left">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-[10px] font-black bg-white hover:bg-blue-50 hover:text-blue-700 border-2 transition-all uppercase italic tracking-tighter"
                                onClick={() => setSelectedHistoryItem(sibling.rawData || sibling)}
                              >
                                <Eye className="mr-1 h-3 w-3" />
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                    </React.Fragment>
                  )
                } else {
                  const rowItem = item.isGroup ? item.items[0] : item
                  return (
                    <TableRow key={rowItem.orderNo} className="border-b hover:bg-muted/20 transition-colors">
                      <TableCell className="px-4 py-3 text-xs text-right tabular-nums">{rowItem.date || "-"}</TableCell>
                      <TableCell className="px-4 py-3 font-bold text-blue-700 text-xs">{rowItem.orderNo || "-"}</TableCell>
                      <TableCell className="px-4 py-3 text-[10px] font-semibold capitalize">
                        <div className="whitespace-nowrap" title={rowItem.customerName}>
                          {rowItem.customerName || "-"}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-left">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tight ${
                            rowItem.status === "Approved" || rowItem.status === "Completed" || rowItem.status === "Verified"
                              ? "bg-green-100 text-green-700 border border-green-200"
                              : rowItem.status === "Rejected"
                              ? "bg-red-100 text-red-700 border border-red-200"
                              : rowItem.status === "Pending Approval"
                              ? "bg-amber-100 text-amber-800 border border-amber-300"
                              : "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}
                        >
                          {rowItem.status || "Completed"}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-[10px] text-muted-foreground font-medium italic">
                        {rowItem.remarks || "-"}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-left">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-[10px] font-black bg-white hover:bg-blue-50 hover:text-blue-700 border-2 transition-all uppercase italic tracking-tighter"
                          onClick={() => setSelectedHistoryItem(rowItem.rawData || rowItem)}
                        >
                          <Eye className="mr-1 h-3 w-3" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                }
              })}
            </tbody>
          </table>

          {/* Mobile Card View */}
          <div className="grid grid-cols-1 gap-4 p-4 md:hidden">
            {groupedHistoryData.map((item: any) => {
              if (item.isGroup && item.items.length > 1) {
                const isExpanded = !!expandedGroups[item.baseOrderNo]
                return (
                  <div key={item.baseOrderNo} className="space-y-2">
                    <Card className="p-4 border-2 border-slate-200 bg-slate-50/50 shadow-sm space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{item.date}</p>
                          <p className="text-sm font-black text-slate-800 font-bold">{item.baseOrderNo}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-blue-100 text-blue-700 border border-blue-200 uppercase">
                          {item.items.length} Items
                        </span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Party Name</p>
                        <p className="text-sm font-bold text-slate-800 capitalize">{item.customerName}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-9 font-black bg-white hover:bg-blue-50 hover:text-blue-700 border-2 transition-all uppercase italic tracking-tighter"
                        onClick={() => toggleGroup(item.baseOrderNo)}
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="mr-2 h-4 w-4" /> Hide Siblings
                          </>
                        ) : (
                          <>
                            <ChevronDown className="mr-2 h-4 w-4" /> Show Siblings ({item.items.length})
                          </>
                        )}
                      </Button>
                    </Card>

                    {isExpanded && (
                      <div className="pl-4 border-l-2 border-slate-200 space-y-2">
                        {item.items.map((sibling: any, siblingIdx: number) => (
                          <Card key={sibling.id ?? sibling.dsrNumber ?? `${sibling.orderNo}-${siblingIdx}`} className="p-3 border border-slate-100 bg-white shadow-sm space-y-3">
                            <div className="flex justify-between items-start">
                              <div className="space-y-1">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">{sibling.date || "-"}</p>
                                <p className="text-xs font-black text-blue-700">{sibling.orderNo || "-"}</p>
                              </div>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tight ${
                                  sibling.status === "Approved" || sibling.status === "Completed" || sibling.status === "Verified"
                                    ? "bg-green-100 text-green-700 border border-green-200"
                                    : sibling.status === "Rejected"
                                    ? "bg-red-100 text-red-700 border border-red-200"
                                    : sibling.status === "Pending Approval"
                                    ? "bg-amber-100 text-amber-800 border border-amber-300"
                                    : "bg-slate-100 text-slate-700 border border-slate-200"
                                }`}
                              >
                                {sibling.status || "Completed"}
                              </span>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-bold">Remarks</p>
                              <p className="text-xs text-slate-600 italic leading-relaxed">{sibling.remarks || "-"}</p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full h-8 font-black bg-white hover:bg-blue-50 hover:text-blue-700 border-2 transition-all uppercase italic tracking-tighter text-[10px]"
                              onClick={() => setSelectedHistoryItem(sibling.rawData || sibling)}
                            >
                              <Eye className="mr-2 h-3.5 w-3.5" /> View Full Details
                            </Button>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                )
              } else {
                const rowItem = item.isGroup ? item.items[0] : item
                return (
                  <Card key={rowItem.orderNo} className="p-4 border-2 border-slate-100 shadow-sm space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{rowItem.date || "-"}</p>
                        <p className="text-sm font-black text-blue-700">{rowItem.orderNo || "-"}</p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tight ${
                          rowItem.status === "Approved" || rowItem.status === "Completed" || rowItem.status === "Verified"
                            ? "bg-green-100 text-green-700 border border-green-200"
                            : rowItem.status === "Rejected"
                            ? "bg-red-100 text-red-700 border border-red-200"
                            : rowItem.status === "Pending Approval"
                            ? "bg-amber-100 text-amber-800 border border-amber-300"
                            : "bg-slate-100 text-slate-700 border border-slate-200"
                        }`}
                      >
                        {rowItem.status || "Completed"}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-bold">Party Name</p>
                      <p className="text-sm font-bold text-slate-800 capitalize">{rowItem.customerName || "-"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-bold">Remarks</p>
                      <p className="text-xs text-slate-600 italic leading-relaxed">{rowItem.remarks || "-"}</p>
                    </div>

                    {/* Show specific remarks if available in data */}
                    {(rowItem.rawData?.order_punch_remarks || rowItem.order_punch_remarks) && (
                      <div className="space-y-1 border-l-2 border-slate-100 pl-3">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Order Punch Remarks</p>
                        <p className="text-xs text-slate-800 font-bold leading-tight">{rowItem.rawData?.order_punch_remarks || rowItem.order_punch_remarks}</p>
                      </div>
                    )}
                    {(rowItem.rawData?.revert_security_remarks || rowItem.revert_security_remarks) && (
                      <div className="space-y-1 border-l-2 border-red-100 pl-3">
                        <p className="text-[9px] font-black text-red-400 uppercase tracking-widest leading-none mb-1">Security Remarks</p>
                        <p className="text-xs text-red-700 font-bold leading-tight">{rowItem.rawData?.revert_security_remarks || rowItem.revert_security_remarks}</p>
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-9 font-black bg-white hover:bg-blue-50 hover:text-blue-700 border-2 transition-all uppercase italic tracking-tighter"
                      onClick={() => setSelectedHistoryItem(rowItem.rawData || rowItem)}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View Full Details
                    </Button>
                  </Card>
                )
              }
            })}
          </div>

          {/* Footer Navigation */}
          <div className="sticky bottom-0 z-20 border-t border-slate-200 bg-slate-100 px-3 pb-2">
            <StagePagination
              page={historyPage}
              totalPages={totalPages}
              total={totalItems}
              noun="Groups"
              onPrev={() => setHistoryPage((p) => Math.max(1, p - 1))}
              onNext={() => setHistoryPage((p) => p + 1)}
              prevDisabled={historyPage === 1}
              nextDisabled={historyPage >= totalPages}
            />
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-muted-foreground">No history records found.</div>
      )}

      {/* History Detail Dialog */}
      <HistoryDetailDialog
        item={selectedHistoryItem}
        onClose={() => setSelectedHistoryItem(null)}
        groups={groupedHistoryFields as any}
        search={historySearch}
        onSearchChange={setHistorySearch}
        renderValue={renderValue}
        formatKey={formatKey}
      />
    </Card>
  )
}

// ─── Record Details dialog ────────────────────────────────────────────────

type DetailGroup = { level: number | string; label: string; entries: [string, any][] }

const SECTION_ACCENTS = [
  { dot: "bg-blue-600", soft: "bg-blue-50", text: "text-blue-700", ring: "ring-blue-200", grad: "from-blue-600 to-blue-600" },
]

const isEmptyVal = (v: any) => v === null || v === undefined || v === ""

function CopyValueButton({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      title="Copy value"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setDone(true)
          setTimeout(() => setDone(false), 1200)
        })
      }}
      className="absolute right-1.5 top-1.5 rounded p-1 text-slate-300 opacity-0 transition hover:bg-white hover:text-blue-600 group-hover:opacity-100"
    >
      {done ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

function statusTone(v: string) {
  const t = v.toLowerCase()
  if (/(approve|pass|complete|done|success|ok|verified|active)/.test(t)) return "bg-emerald-50 text-emerald-700 ring-emerald-200"
  if (/(reject|fail|cancel|expire|damage|revert)/.test(t)) return "bg-rose-50 text-rose-700 ring-rose-200"
  if (/(pending|wait|hold|partial)/.test(t)) return "bg-amber-50 text-amber-700 ring-amber-200"
  return "bg-slate-100 text-slate-700 ring-slate-200"
}

const HERO_TILES: { label: string; keys: string[]; icon: React.ComponentType<{ className?: string }>; tone: string }[] = [
  { label: "Customer", keys: ["party_name", "customer_name", "bill_company_name"], icon: User, tone: "" },
  { label: "Order qty", keys: ["order_quantity", "approved_qty", "actual_qty"], icon: Package, tone: "" },
  { label: "Rate", keys: ["final_rate", "rate", "rate_per_ltr"], icon: IndianRupee, tone: "" },
  { label: "Delivery date", keys: ["delivery_date", "end_date"], icon: CalendarDays, tone: "" },
  { label: "Depot", keys: ["depo_name", "dispatch_from"], icon: Warehouse, tone: "" },
  { label: "Vehicle", keys: ["truck_no", "vehicle_number"], icon: Truck, tone: "" },
]

function HistoryDetailDialog({
  item,
  onClose,
  groups,
  search,
  onSearchChange,
  renderValue,
  formatKey,
}: {
  item: any
  onClose: () => void
  groups: DetailGroup[]
  search: string
  onSearchChange: (v: string) => void
  renderValue: (value: any, key?: string) => React.ReactNode
  formatKey: (key: string) => string
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [showEmpty, setShowEmpty] = useState<Record<string, boolean>>({})

  const doNo = item?.so_no || item?.orderNo || item?.order_no || item?.order_key || "—"
  const all = new Map<string, any>()
  groups.forEach((g) => g.entries.forEach(([k, v]) => !isEmptyVal(v) && !all.has(k) && all.set(k, v)))
  const filled = all.size
  const hero = HERO_TILES.map((t) => {
    const k = t.keys.find((x) => all.has(x))
    return k ? { ...t, key: k, value: all.get(k) } : null
  }).filter(Boolean) as (typeof HERO_TILES[number] & { key: string; value: any })[]
  const allCollapsed = groups.length > 0 && groups.every((g) => collapsed[String(g.level)])

  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[90vh] w-full max-w-5xl! flex-col gap-0 overflow-hidden rounded-xl border border-slate-200 bg-[#eef4fc] p-0 shadow-2xl">
        {/* Header */}
        <DialogHeader className="border-b border-slate-200 bg-white px-6 pb-4 pt-5 text-left">
          <div className="flex flex-wrap items-center gap-3 pr-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">Record Details</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">Complete audit trail for this order, grouped by workflow stage.</DialogDescription>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 font-mono text-xs font-bold text-blue-700">{doNo}</span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                <strong className="text-slate-900">{groups.length}</strong> stages
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                <strong className="text-slate-900">{filled}</strong> data points
              </span>
            </div>
          </div>

          {hero.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
              {hero.map((h) => {
                const Icon = h.icon
                return (
                  <div key={h.label} className="min-w-0 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <Icon className="h-3.5 w-3.5 text-blue-600" />
                      {h.label}
                    </div>
                    <div className="mt-1 truncate text-sm font-semibold text-slate-900" title={String(h.value)}>
                      {renderValue(h.value, h.key)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </DialogHeader>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-100/80 px-6 py-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search fields or values..."
              className="h-8 border-slate-200 bg-white pl-8 text-xs shadow-2xs"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto h-8 bg-white px-3 text-xs"
            onClick={() => setCollapsed(allCollapsed ? {} : Object.fromEntries(groups.map((g) => [String(g.level), true])))}
          >
            {allCollapsed ? "Expand all" : "Collapse all"}
          </Button>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {groups.length > 0 ? (
            <div className="relative space-y-5 pl-10">
              <div className="absolute bottom-2 left-[15px] top-2 w-px bg-slate-300" />
              {groups.map((g, i) => {
                const key = String(g.level)
                const open = !collapsed[key]
                const a = SECTION_ACCENTS[i % SECTION_ACCENTS.length]
                const filledEntries = g.entries.filter(([, v]) => !isEmptyVal(v))
                const emptyEntries = g.entries.filter(([, v]) => isEmptyVal(v))
                const byEntry = filledEntries.find(([k, v]) => /(_user|_by)$/.test(k) && typeof v === "string")
                const atEntry = filledEntries.find(([k]) => /^(actual_\d+|timestamp_\d+|gate_in_at)$/.test(k))
                return (
                  <section key={key} className="relative">
                    <span className={cn("absolute -left-10 top-3 flex h-[30px] w-[30px] items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white shadow-xs ring-4 ring-[#eef4fc]", a.grad)}>
                      {i + 1}
                    </span>
                    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
                      <button
                        type="button"
                        onClick={() => setCollapsed((c) => ({ ...c, [key]: open }))}
                        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 bg-slate-100/80 px-5 py-3 text-left transition hover:bg-slate-100"
                      >
                        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">{g.label}</h3>
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1", a.soft, a.text, a.ring)}>
                          {filledEntries.length} filled
                        </span>
                        {emptyEntries.length > 0 && <span className="text-[11px] font-medium text-slate-400">{emptyEntries.length} empty</span>}
                        {byEntry && (
                          <span className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white py-0.5 pl-0.5 pr-2.5 text-[11px] font-medium text-slate-600">
                            <span className={cn("flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-bold text-white", a.grad)}>
                              {String(byEntry[1]).trim().charAt(0).toUpperCase()}
                            </span>
                            {String(byEntry[1])}
                          </span>
                        )}
                        {atEntry && <span className="text-[11px] font-medium text-slate-500">{renderValue(atEntry[1], atEntry[0])}</span>}
                        <ChevronDown className={cn("ml-auto h-4 w-4 text-slate-400 transition-transform", open && "rotate-180")} />
                      </button>

                      {open && (
                        <div className="border-t border-slate-100 p-4">
                          {filledEntries.length > 0 ? (
                            <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                              {filledEntries.map(([k, v]) => {
                                const long = typeof v === "string" && v.length > 52
                                const isStatus = /status/i.test(k) && typeof v === "string"
                                const isNum = /(qty|quantity|rate|amount|weight|price|value)/i.test(k) && typeof v !== "string"
                                return (
                                  <div
                                    key={k}
                                    className={cn(
                                      "group relative min-w-0 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 transition hover:border-blue-200 hover:bg-white",
                                      long && "sm:col-span-2 xl:col-span-3"
                                    )}
                                  >
                                    <dt className="pr-6 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{formatKey(k)}</dt>
                                    <dd className={cn("mt-0.5 break-words text-sm font-medium text-slate-900", isNum && "font-mono tabular-nums")}>
                                      {isStatus ? (
                                        <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1", statusTone(String(v)))}>{String(v)}</span>
                                      ) : (
                                        renderValue(v, k)
                                      )}
                                    </dd>
                                    {typeof v !== "object" && <CopyValueButton text={String(v)} />}
                                  </div>
                                )
                              })}
                            </dl>
                          ) : (
                            <p className="py-2 text-center text-xs text-slate-400">No data recorded for this stage.</p>
                          )}

                          {emptyEntries.length > 0 && (
                            <div className="mt-3 border-t border-dashed border-slate-200 pt-3">
                              <button
                                type="button"
                                onClick={() => setShowEmpty((s) => ({ ...s, [key]: !s[key] }))}
                                className="text-[11px] font-semibold text-slate-500 hover:text-blue-600"
                              >
                                {showEmpty[key] ? "Hide" : "Show"} {emptyEntries.length} empty field{emptyEntries.length > 1 ? "s" : ""}
                              </button>
                              {showEmpty[key] && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {emptyEntries.map(([k]) => (
                                    <span key={k} className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wide text-slate-400">
                                      {formatKey(k)}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </section>
                )
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-14 text-center text-sm text-slate-500">
              <Search className="mx-auto mb-2 h-6 w-6 text-slate-300" />
              No matching fields found.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-3">
          <span className="text-[11px] text-slate-400">Hover a field to copy its value</span>
          <Button size="sm" className="h-8 bg-blue-600 px-5 text-xs hover:bg-blue-700" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
