"use client"

import React from "react"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, RotateCcw, SlidersHorizontal, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { usePersistedFilters } from "@/hooks/use-persisted-filters"
import { ShellFiltersContext } from "@/components/workflow/shell-filters-context"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AsyncCombobox } from "@/components/ui/async-combobox"
import { customerApi } from "@/lib/api-service"
import { cn } from "@/lib/utils"
import { Check, ChevronsUpDown } from "lucide-react"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface WorkflowStageShellProps {
  title: string
  description: string
  pendingCount: number
  children: React.ReactNode
  historyData: any[]
  historyContent?: React.ReactNode
  partyNames?: string[]
  fetchPartyOptions?: (search: string, page: number) => Promise<{ options: any[]; hasMore: boolean }>
  onFilterChange?: (filters: { search: string; status: string; startDate: string; endDate: string; partyName: string; manualSaudaNo: string }) => void
  remarksColName?: string
  showStatusFilter?: boolean
  stageLevel?: number
  onTabChange?: (tab: "pending" | "history") => void
  historyFooter?: React.ReactNode
  isHistoryLoading?: boolean
  searchPlaceholder?: string
  showDateFilters?: boolean
  /** Show the "Manual Sauda No." text filter (contains match). */
  showSaudaFilter?: boolean
  /** Label for the date-range filter. When set (e.g. "DO Date"), inputs read "<label> From"/"<label> To". */
  dateLabel?: string
  groupBySiblingDo?: boolean
  /**
   * Stage key. When set, the active Pending/History tab is remembered permanently (per user) and
   * the filters below (search, status, dates, party, Sauda no.) survive a refresh for the session
   * - see usePersistedFilters. Restored values are pushed to the page via onTabChange/onFilterChange
   * on mount so its server queries use them.
   */
  persistKey?: string
  /**
   * Default true: the last-used Pending / History tab is remembered permanently (per user).
   * false: the tab is only kept for the current browser session, so a fresh open of the
   * stage always starts on Pending Tasks.
   */
  rememberTab?: boolean
  /** Extra controls shown in the page heading, left of the Pending / History tabs. */
  headerActions?: React.ReactNode
}

export const FIELD_GROUPS: Record<string, number> = {
  // Level 0: Order Punch (Standard)
  order_no: 0, so_no: 0, party_name: 0, product_name: 0, order_quantity: 0, rate: 0, freight_rate: 0,
  order_type: 0, customer_type: 0, customer_address: 0, payment_terms: 0, advance_amount: 0,
  broker_name: 0, order_punch_remarks: 0, final_rate: 0, transfer: 0, bill_company_name: 0,
  bill_address: 0, ship_company_name: 0, ship_address: 0,
  sku_name: 0, delivery_date: 0, order_type_delivery_purpose: 0,
  rate_per_ltr: 0, rate_per_15kg: 0, rate_of_material: 0, remark: 0,
  party_so_date: 0, start_date: 0, end_date: 0, depo_name: 0, futureperioddate: 0,
  upload_so: 0, customer_contact_person_name: 0, customer_contact_person_whatsapp_no: 0,
  customer_name: 0, order_punch_user: 0,

  // Level 1: Pre-Approval
  d_sr_number: 1, approved_qty: 1, pre_approval_remarks: 1, pre_approval_user: 1, timestamp_1: 1, status_1: 1, planned_1: 1, actual_1: 1,

  // Level 2: Approval of Order
  overall_status_of_order: 2, approval_qty: 2,
  order_approval_user: 2, planned_2: 2, actual_2: 2,

  // Level 3: Dispatch Planning
  dispatch_from: 3, dispatch_planning_user: 3, revert_planning_remarks: 3,
  actual_3: 3, planned_3: 3, delay_3: 3,

  // Level 4: Material Load / Vehicle / Weightment (Stages 5, 6, 7)
  truck_no: 4, driver_name: 4, driver_mobile_no: 4, transporter_name: 4, rst_no: 4,
  gross_weight: 4, tare_weight: 4, net_weight: 4, actual_qty: 4,
  material_load_user: 4, weightment_slip_copy: 4, vehicle_no_plate_image: 4,
  check_status: 4, vehicle_number: 4,
  fitness: 4, insurance: 4, tax_copy: 4, polution: 4, permit1: 4, permit2_out_state: 4,
  fitness_end_date: 4, insurance_end_date: 4, tax_end_date: 4, pollution_end_date: 4,
  permit1_end_date: 4, permit2_end_date: 4, actual_qty_dispatch: 4,
  actual_dispatch_user: 4, extra_weight: 4,
  reason_of_difference_in_weight_if_any_speacefic: 4,

  // Level 5: Security Approval (Stage 8)
  bilty_no: 5, bilty_image: 5, vehicle_image_attachemrnt: 5, security_guard_status: 5,
  security_guard_user: 5, revert_security_remarks: 5, actual_4: 5, planned_4: 5,

  // Level 6: Make Invoice (Stage 9)
  bill_type: 6, invoice_date: 6, invoice_no: 6, invoice_copy: 6, bill_amount: 6,
  make_invoice_user: 6, actual_5: 6, planned_5: 6,

  // Level 7: Check Invoice (Stage 10)
  verification_status: 7, actual_7: 7, planned_7: 7, check_invoice_user: 7,

  // Level 8: Gate Out (Stage 12)
  gate_pass_copy: 8, actual_8: 8, planned_8: 8, gate_out_user: 8,

  // Level 9: Material Receipt (Stage 14)
  damage_qty: 9, damage_status: 9, actual_9: 9, planned_9: 9, material_receipt_user: 9,
  // Unloading (Stage 14) report
  received_date: 9, received_proof: 9, damage_photos: 9, shortage_qty: 9, shortage_cause: 9, shortage_borne_by: 9,
  total_loss_qty: 9, total_loss_value: 9, approval_status: 9, approval_remarks: 9,

  // Level 10: Damage Adjustment (Stage 15)
  credit_note_no: 10, actual_10: 10, planned_10: 10, damage_adjustment_user: 10,
  credit_note_date: 10, credit_note_taxable: 10, credit_note_gst_percent: 10, credit_note_amount: 10, credit_note_copy: 10,
  debit_note_no: 10, debit_note_date: 10, debit_note_amount: 10, debit_note_copy: 10,
  reverse_transfer_no: 10, reverse_transfer_date: 10, reverse_transfer_qty: 10, reverse_transfer_copy: 10,
  company_loss_amount: 10, company_loss_head: 10, settlement_remarks: 10,

  // Level 12: Gate In (Stage 6) - a gate_in_records row
  gate_in_do: 12, gate_in_vehicle_no: 12, gate_in_driver_name: 12, gate_in_by: 12, gate_in_at: 12,
  front_vehicle_image: 12, back_vehicle_image: 12, driver_photo: 12, gatepass_photo: 12,
}

// Human-readable stage name for each FIELD_GROUPS level — drives the
// section headers in the history "View" dialog so users can tell which
// stage each field belongs to. Fields not mapped to any stage are dropped
// from the dialog entirely (no catch-all section).
export const STAGE_NAMES: Record<number, string> = {
  0: "Order Punch",
  1: "Pre-Approval",
  2: "Approval of Order",
  3: "Dispatch Planning",
  4: "Material Load / Vehicle / Weighment",
  5: "Security Approval",
  6: "Make Invoice",
  7: "Check Invoice",
  8: "Gate Out",
  9: "Unloading",
  10: "Damage Adjustment",
  12: "Gate In",
}

// Friendly overrides for field labels in the history "View" dialog, where the
// auto-generated (underscore-split, title-cased) label reads awkwardly.
export const FIELD_LABELS: Record<string, string> = {
  gate_in_do: "DO Number",
  gate_in_vehicle_no: "Vehicle No.",
  gate_in_driver_name: "Driver Name",
  gate_in_by: "Gate-In By",
  gate_in_at: "Gate-In At",
  front_vehicle_image: "Front Vehicle Photo",
  back_vehicle_image: "Back Vehicle Photo",
  driver_photo: "Driver Photo",
  gatepass_photo: "Gate Pass Photo",
  approved_qty: "Pre Approved Quantity",
  received_date: "Unloading Completed On",
  received_proof: "Received Proof",
  damage_photos: "Damage Photos",
  shortage_qty: "Shortage Quantity",
  shortage_cause: "Shortage Cause",
  shortage_borne_by: "Shortage Borne By",
  total_loss_qty: "Total Loss (Units)",
  total_loss_value: "Total Loss Value (₹)",
  approval_status: "Loss Approval",
  approval_remarks: "Approval Remarks",
  approval_qty: "Approval Quantity",
  credit_note_taxable: "Credit Note Taxable Value (₹)",
  credit_note_gst_percent: "Credit Note GST %",
  credit_note_amount: "Credit Note Total (₹)",
  debit_note_no: "Debit Note No.",
  debit_note_date: "Debit Note Date",
  debit_note_amount: "Debit Note Amount (₹)",
  debit_note_copy: "Debit Note Copy",
  reverse_transfer_no: "Reverse Transfer No.",
  reverse_transfer_date: "Reverse Transfer Date",
  reverse_transfer_qty: "Reverse Transfer Qty",
  reverse_transfer_copy: "Reverse Transfer Copy",
  company_loss_amount: "Company Loss - P&L (₹)",
  company_loss_head: "P&L Head",
  settlement_remarks: "Settlement Remarks",
  overall_status_of_order: "Approval Status",
  order_punch_user: "Order Punch Doer",
  pre_approval_user: "Pre-Approval Doer",
  order_approval_user: "Approval Doer",
}

// Within each stage group, order fields alphabetically, except Doer (whoever
// performed the stage, e.g. *_user columns) always sits immediately before
// the scheduling fields, and Planned -> Actual are always the last two.
export const fieldOrderPriority = (key: string): number => {
  if (/^planned_\d+$/.test(key)) return 2
  if (/^actual_\d+$/.test(key)) return 3
  if (/_user$/.test(key)) return 1
  return 0
}

export function WorkflowStageShell({
  title,
  description,
  pendingCount,
  children,
  historyData,
  historyContent,
  partyNames = [],
  onFilterChange,
  remarksColName,
  showStatusFilter = false,
  stageLevel = 99,
  onTabChange,
  historyFooter,
  isHistoryLoading = false,
  fetchPartyOptions,
  searchPlaceholder = "Search DO Number...",
  showDateFilters = true,
  showSaudaFilter = false,
  dateLabel,
  groupBySiblingDo = false,
  persistKey,
  rememberTab = true,
  headerActions,
}: WorkflowStageShellProps) {
  const [view, patchView] = usePersistedFilters<{
    tab: "pending" | "history"
    search: string
    status: string
    startDate: string
    endDate: string
    partyName: string
    manualSaudaNo: string
  }>(
    persistKey ? `${persistKey}:shell` : null,
    { tab: "pending", search: "", status: "", startDate: "", endDate: "", partyName: "", manualSaudaNo: "" },
    { permanentKeys: rememberTab ? ["tab"] : [] }
  )
  const { tab, ...filters } = view

  const [partySearchOpen, setPartySearchOpen] = React.useState(false)

  const updateFilter = (key: keyof typeof filters, value: string) => {
    const newFilters = { ...filters, [key]: value }
    patchView({ [key]: value })
    if (onFilterChange) {
      onFilterChange(newFilters)
    }
  }

  // Push restored (persisted) state up to the page once, so its server queries match what the
  // shell shows. Tab changes (incl. the server-hydrated tab) are forwarded as they happen.
  const notifiedTabRef = React.useRef<"pending" | "history">("pending")
  React.useEffect(() => {
    if (tab !== notifiedTabRef.current) {
      notifiedTabRef.current = tab
      onTabChange?.(tab)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])
  React.useEffect(() => {
    if (persistKey && Object.values(filters).some((v) => v)) onFilterChange?.(filters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const activeFilterCount = Object.values(filters).filter((v) => v && v !== "all").length

  const [claimedBy, setClaimedBy] = React.useState<string | null>(null)
  const [actionsEl, setActionsEl] = React.useState<HTMLElement | null>(null)
  const claim = React.useCallback((id: string) => setClaimedBy((c) => c ?? id), [])
  const release = React.useCallback((id: string) => setClaimedBy((c) => (c === id ? null : c)), [])

  const extraChips: { label: string; clear: () => void }[] = []
  if (showStatusFilter && filters.status && filters.status !== "all") extraChips.push({ label: `Status: ${filters.status}`, clear: () => updateFilter("status", "") })
  if (showSaudaFilter && filters.manualSaudaNo) extraChips.push({ label: `Sauda: ${filters.manualSaudaNo}`, clear: () => updateFilter("manualSaudaNo", "") })
  if (showDateFilters && filters.startDate) extraChips.push({ label: `${dateLabel ? `${dateLabel} from` : "From"}: ${filters.startDate}`, clear: () => updateFilter("startDate", "") })
  if (showDateFilters && filters.endDate) extraChips.push({ label: `${dateLabel ? `${dateLabel} to` : "To"}: ${filters.endDate}`, clear: () => updateFilter("endDate", "") })
  const extraCount = extraChips.length

  const filterControls = (
    <>
      <div className="relative w-full sm:w-64">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder={searchPlaceholder}
          className="h-8 w-full border-slate-200 bg-white pl-8 text-xs shadow-2xs"
          value={filters.search}
          onChange={(e) => updateFilter("search", e.target.value)}
        />
      </div>

      <div className="w-full sm:w-52">
        {partyNames && partyNames.length > 0 ? (
          <Popover open={partySearchOpen} onOpenChange={setPartySearchOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={partySearchOpen}
                className="w-full !h-8 justify-between bg-white px-2.5 text-xs font-medium border-slate-200 shadow-2xs"
              >
                <span className="truncate">
                  {filters.partyName === "all" || !filters.partyName
                    ? "All Parties"
                    : filters.partyName}
                </span>
                <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search parties..." />
                <CommandList>
                  <CommandEmpty>No party found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="__all__"
                      onSelect={() => {
                        updateFilter("partyName", "all")
                        setPartySearchOpen(false)
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          filters.partyName === "all" ? "opacity-100" : "opacity-0"
                        )}
                      />
                      All Parties
                    </CommandItem>
                    {partyNames.map((name, idx) => (
                      <CommandItem
                        key={`party-${idx}-${name}`}
                        value={name}
                        onSelect={(currentValue) => {
                          updateFilter("partyName", currentValue === filters.partyName ? "" : currentValue)
                          setPartySearchOpen(false)
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            filters.partyName === name ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        ) : (
          <AsyncCombobox
            placeholder="Select Party Name"
            searchPlaceholder="Search parties..."
            value={filters.partyName}
            onValueChange={(val) => updateFilter("partyName", val)}
            onSelectOption={(opt: any) => {
              // Optional: handle specific selection if needed
            }}
            fetchOptions={fetchPartyOptions || (async (search: string, page: number) => {
              const res = await customerApi.getAll({ search, page, limit: 20 });
              const list = res.data.customers || [];
              return {
                options: [
                  { value: "all", label: "All Parties" },
                  ...list.map((c: any) => ({ value: c.customer_name, label: c.customer_name }))
                ],
                hasMore: (list.length + (page - 1) * 20) < (res.data.pagination?.total || 0)
              };
            })}
            className="w-full !h-8 bg-white text-xs font-medium"
          />
        )}
      </div>

      {(showStatusFilter || showSaudaFilter || showDateFilters) && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-8 gap-1.5 bg-white px-2.5 text-xs shadow-2xs",
                extraCount > 0 && "border-blue-300 text-blue-700"
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
              {extraCount > 0 && (
                <span className="ml-0.5 rounded-full bg-blue-600 px-1.5 text-[10px] font-bold leading-4 text-white">{extraCount}</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[320px] space-y-3 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900">More filters</span>
              {extraCount > 0 && (
                <button
                  type="button"
                  className="text-[11px] font-semibold text-red-600 hover:underline"
                  onClick={() => {
                    const reset = { ...filters, status: "", startDate: "", endDate: "", manualSaudaNo: "" }
                    patchView({ status: "", startDate: "", endDate: "", manualSaudaNo: "" })
                    onFilterChange?.(reset)
                  }}
                >
                  Clear
                </button>
              )}
            </div>

            {showStatusFilter && (
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Status</Label>
                <Select value={filters.status} onValueChange={(val) => updateFilter("status", val)}>
                  <SelectTrigger className="!h-8 w-full border-slate-200 bg-white px-2.5 py-0 text-xs">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="on-time">On Time</SelectItem>
                    <SelectItem value="expire">Expire</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {showSaudaFilter && (
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Manual Sauda No.</Label>
                <Input
                  type="text"
                  placeholder="Contains..."
                  className="h-8 w-full border-slate-200 bg-white px-2.5 text-xs"
                  value={filters.manualSaudaNo}
                  onChange={(e) => updateFilter("manualSaudaNo", e.target.value)}
                />
              </div>
            )}

            {showDateFilters && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{dateLabel ? `${dateLabel} from` : "From"}</Label>
                  <Input
                    type="date"
                    className="!h-8 w-full border-slate-200 bg-white px-2 py-0 text-xs md:text-xs"
                    value={filters.startDate}
                    onChange={(e) => updateFilter("startDate", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{dateLabel ? `${dateLabel} to` : "To"}</Label>
                  <Input
                    type="date"
                    className="!h-8 w-full border-slate-200 bg-white px-2 py-0 text-xs md:text-xs"
                    value={filters.endDate}
                    onChange={(e) => updateFilter("endDate", e.target.value)}
                  />
                </div>
              </div>
            )}
          </PopoverContent>
        </Popover>
      )}

      {extraChips.map((c) => (
        <span key={c.label} className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 py-0.5 pl-2.5 pr-1 text-[11px] font-medium text-blue-700">
          {c.label}
          <button type="button" onClick={c.clear} className="rounded-full p-0.5 hover:bg-blue-100" title="Remove">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}

      {activeFilterCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 rounded px-2 text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={() => {
            const reset = { search: "", status: "", startDate: "", endDate: "", partyName: "", manualSaudaNo: "" };
            patchView(reset);
            if (onFilterChange) onFilterChange(reset);
          }}
        >
          <RotateCcw className="h-3 w-3" />
          Reset ({activeFilterCount})
        </Button>
      )}
    </>
  )

  return (
    <SidebarInset>
      <div className="p-3 sm:px-6 sm:py-3 space-y-2 sm:space-y-3 w-full">
        <ShellFiltersContext.Provider value={{ claimedBy, claim, release, node: filterControls, actionsEl, setActionsEl }}>
        <Tabs
          value={tab}
          className="w-full"
          onValueChange={(val) => patchView({ tab: val as "pending" | "history" })}
        >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="-ml-1" />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{title}</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
          {headerActions}
          <TabsList className="grid w-[260px] grid-cols-2 bg-muted/50 p-1 rounded-lg h-9">
            <TabsTrigger value="pending" className="rounded-md text-xs py-1">
              Pending Tasks
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-md text-xs py-1">
              Stage History
            </TabsTrigger>
          </TabsList>
          <Badge variant="outline" className="px-3 py-1 text-xs bg-primary/5 text-primary border-primary/20">
            {pendingCount} Pending Items
          </Badge>
          </div>
        </div>


          {!claimedBy && (
            <div className="mb-3 flex flex-wrap items-center gap-x-2.5 gap-y-2 rounded-xl border border-slate-200 bg-slate-100/80 px-4 py-3 text-xs shadow-xs">
              {filterControls}
            </div>
          )}

          <TabsContent value="pending" className="space-y-2">
            {children}
          </TabsContent>

          <TabsContent value="history">
            {historyContent ? (
              <div className="mt-4">{historyContent}</div>
            ) : (
              <Card className="border-none shadow-sm overflow-hidden">
                {isHistoryLoading ? (
                  <div className="p-8 text-center text-muted-foreground">Loading history…</div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground">No history records found.</div>
                )}
              </Card>
            )}
          </TabsContent>
        </Tabs>
        </ShellFiltersContext.Provider>
      </div>
    </SidebarInset>
  )
}

