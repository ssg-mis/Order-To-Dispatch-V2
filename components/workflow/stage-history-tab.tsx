"use client"

import React, { useState, useMemo, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Eye, Search, ChevronDown, ChevronUp, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useQuery } from "@tanstack/react-query"
import { FIELD_GROUPS, STAGE_NAMES, FIELD_LABELS, fieldOrderPriority } from "./workflow-stage-shell"
import { fmtDateTime, fmtNum } from "@/lib/table-format"
import { isTimestamp } from "@/lib/date-utils"
import { LOSS_CAUSES, BORNE_BY_LABEL, type BorneBy } from "@/lib/loss-causes"
import { useStageTable, type StageColDef } from "@/hooks/use-stage-table"
import { usePersistedFilters } from "@/hooks/use-persisted-filters"
import { StageListHeader, StageToolbar, StageSegmented, StageHeadCell, StageTotalsRow } from "@/components/stage-list"
import { ColumnDragProvider } from "@/components/ui/column-drag-provider"

const HISTORY_COLS: StageColDef<any>[] = [
  { id: "date", label: "Date", type: "date", accessor: (r) => r.timestamp },
  { id: "orderNo", label: "Order No.", type: "text", accessor: (r) => r.orderNo },
  { id: "customerName", label: "Party Name", type: "text", accessor: (r) => r.customerName },
  { id: "status", label: "Status", type: "text", accessor: (r) => r.status },
  { id: "remarks", label: "Remarks", type: "text", accessor: (r) => r.remarks },
]
const HISTORY_COL_IDS = HISTORY_COLS.map((c) => c.id)
const HISTORY_WIDTHS: Record<string, string> = { date: "w-[12%]", orderNo: "w-[18%]", customerName: "w-[18%]", status: "w-[12%]", remarks: "w-[25%]" }
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
    if (typeof value === "number" && Number.isFinite(value) && !/(^|_)(id|no|number|phone|mobile|code)$/i.test(key || "")) return fmtNum(value, 2)
    return String(value)
  }

  const totalPages = data?.pagination?.totalPages || 1
  const totalItems = data?.pagination?.total || 0

  return (
    <Card className="border border-slate-200/80 shadow-xs overflow-hidden">
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
          <table className="w-full text-sm table-fixed hidden md:table">
            <thead className="bg-slate-50 border-b sticky top-0 z-10 shadow-sm">
              <tr>
                <ColumnDragProvider columnIds={HISTORY_COL_IDS} onReorder={noopReorder} disabled>
                  {HISTORY_COLS.map((col) => (
                    <StageHeadCell key={col.id} col={col} table={table} width={HISTORY_WIDTHS[col.id]} />
                  ))}
                </ColumnDragProvider>
                <th className="px-4 py-3 text-left w-[15%] align-bottom text-xs font-medium text-foreground">Action</th>
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
                          <div className="break-words whitespace-normal leading-tight" title={item.customerName}>
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
                              <div className="break-words whitespace-normal leading-tight" title={sibling.customerName}>
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
                        <div className="break-words whitespace-normal leading-tight" title={rowItem.customerName}>
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
          <div className="px-3 py-4 border-t bg-slate-50/50 flex flex-col gap-3 sm:px-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-500 font-bold uppercase tracking-tighter">
              Showing Page {historyPage} of {totalPages} ({totalItems} Groups)
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Button
                variant="outline"
                size="sm"
                disabled={historyPage === 1}
                className="font-bold uppercase tracking-widest text-[10px]"
                onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="font-bold uppercase tracking-widest text-[10px]"
                disabled={historyPage >= totalPages}
                onClick={() => setHistoryPage((p) => p + 1)}
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-muted-foreground">No history records found.</div>
      )}

      {/* History Detail Dialog */}
      <Dialog open={!!selectedHistoryItem} onOpenChange={(open) => !open && setSelectedHistoryItem(null)}>
        <DialogContent className="max-w-6xl! w-full max-h-[90vh] overflow-hidden flex flex-col p-0 rounded-3xl border-none shadow-2xl">
          <DialogHeader className="p-6 pb-2 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
            <div className="flex justify-between items-start">
              <div>
                <Badge className="bg-white/15 hover:bg-white/15 text-white border-white/30 text-xs font-black uppercase tracking-widest px-3 py-1 mb-2">
                  DO No: {selectedHistoryItem?.so_no || selectedHistoryItem?.orderNo || selectedHistoryItem?.order_no || selectedHistoryItem?.order_key || "—"}
                </Badge>
                <DialogTitle className="text-2xl font-black uppercase tracking-tight italic">Record Details</DialogTitle>
                <DialogDescription className="text-blue-100 font-bold mt-1 uppercase text-[10px] tracking-widest">
                  Comprehensive audit trail
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 flex-1 overflow-y-auto space-y-6 bg-slate-50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search fields or values..."
                className="pl-9 bg-white border-2 focus:border-blue-400 rounded-xl h-10 shadow-sm"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
              />
            </div>

            {groupedHistoryFields.length > 0 ? (
              <div className="space-y-5">
                {groupedHistoryFields.map((group) => (
                  <div key={group.level} className="border-2 border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-slate-100 to-slate-50 border-b-2 border-slate-200">
                      <div className="w-1.5 h-4 bg-blue-600 rounded-full" />
                      <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-700">{group.label}</h3>
                      <span className="ml-auto text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                        {group.entries.length} {group.entries.length === 1 ? "field" : "fields"}
                      </span>
                    </div>
                    <Table>
                      <TableHeader className="bg-slate-100/50">
                        <TableRow>
                          <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider w-1/3">Field Name</TableHead>
                          <TableHead className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.entries.map(([key, value]) => (
                          <TableRow key={key} className="hover:bg-blue-50/30 transition-colors border-slate-100">
                            <TableCell className="font-black text-slate-500 text-[10px] uppercase tracking-tight py-3">
                              {formatKey(key)}
                            </TableCell>
                            <TableCell className="py-3 text-xs font-bold text-slate-800">
                              {renderValue(value, key)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border-2 border-slate-200 rounded-2xl bg-white shadow-sm p-8 text-center text-muted-foreground text-sm font-medium">
                No matching fields found.
              </div>
            )}
          </div>
          <div className="p-4 bg-white border-t flex justify-end">
            <Button
              onClick={() => setSelectedHistoryItem(null)}
              className="bg-slate-900 hover:bg-black text-white px-8 font-black uppercase italic tracking-tighter"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
