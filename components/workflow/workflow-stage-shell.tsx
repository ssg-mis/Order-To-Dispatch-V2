"use client"

import React from "react"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Filter, RotateCcw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"

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

  // Level 7: Check Invoice (Stage 11)
  verification_status: 7, actual_7: 7, planned_7: 7, check_invoice_user: 7,

  // Level 8: Gate Out (Stage 12)
  gate_pass_copy: 8, actual_8: 8, planned_8: 8, gate_out_user: 8,

  // Level 9: Material Receipt (Stage 13)
  damage_qty: 9, damage_status: 9, actual_9: 9, planned_9: 9, material_receipt_user: 9,

  // Level 10: Damage Adjustment
  credit_note_no: 10, actual_10: 10, planned_10: 10, damage_adjustment_user: 10,
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
  9: "Material Receipt",
  10: "Damage Adjustment",
}

// Friendly overrides for field labels in the history "View" dialog, where the
// auto-generated (underscore-split, title-cased) label reads awkwardly.
export const FIELD_LABELS: Record<string, string> = {
  approved_qty: "Pre Approved Quantity",
  approval_qty: "Approval Quantity",
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
}: WorkflowStageShellProps) {
  const [filters, setFilters] = React.useState({
    search: "",
    status: "",
    startDate: "",
    endDate: "",
    partyName: "",
    manualSaudaNo: ""
  })

  const [partySearchOpen, setPartySearchOpen] = React.useState(false)

  const updateFilter = (key: keyof typeof filters, value: string) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    if (onFilterChange) {
      onFilterChange(newFilters)
    }
  }

  return (
    <SidebarInset>
      <div className="p-6 space-y-4 w-full">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="h-6" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
          <Badge variant="outline" className="px-4 py-1 text-sm bg-primary/5 text-primary border-primary/20">
            {pendingCount} Pending Items
          </Badge>
        </div>

        <Tabs
          defaultValue="pending"
          className="w-full"
          onValueChange={(val) => onTabChange?.(val as "pending" | "history")}
        >
          <TabsList className="grid w-full max-w-[400px] grid-cols-2 mb-2 bg-muted/50 p-1 rounded-lg h-9">
            <TabsTrigger value="pending" className="rounded-md text-xs py-1">
              Pending Tasks
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-md text-xs py-1">
              Stage History
            </TabsTrigger>
          </TabsList>

          <div className="flex flex-col gap-3 bg-card p-3 rounded-xl border shadow-sm mb-4">
            {/* Search Block — full width, on its own row */}
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 ml-1">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={searchPlaceholder}
                  className="w-full pl-9 bg-background h-10 text-sm text-foreground block"
                  value={filters.search}
                  onChange={(e) => updateFilter("search", e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-end gap-3">
              {/* Status Select */}
              {showStatusFilter && (
                <div className="space-y-1 w-full md:w-36">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 ml-1">Status</Label>
                  <Select value={filters.status} onValueChange={(val) => updateFilter("status", val)}>
                    <SelectTrigger className="w-full h-10 bg-background px-3 text-sm">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="on-time">On Time</SelectItem>
                      <SelectItem value="expire">Expire</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Manual Sauda No. (contains) */}
              {showSaudaFilter && (
                <div className="space-y-1 w-full md:w-48">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 ml-1">Manual Sauda No.</Label>
                  <Input
                    type="text"
                    placeholder="Manual Sauda No."
                    className="w-full h-10 bg-background px-3 text-sm text-foreground block"
                    value={filters.manualSaudaNo}
                    onChange={(e) => updateFilter("manualSaudaNo", e.target.value)}
                  />
                </div>
              )}

              {/* Start Date */}
              {showDateFilters && (
                <div className="space-y-1 w-full md:w-36">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 ml-1">{dateLabel ? `${dateLabel} From` : "Start Date"}</Label>
                  <Input
                    type="date"
                    className="w-full h-10 bg-background px-3 text-sm text-foreground block"
                    value={filters.startDate}
                    onChange={(e) => updateFilter("startDate", e.target.value)}
                  />
                </div>
              )}

              {/* End Date */}
              {showDateFilters && (
                <div className="space-y-1 w-full md:w-36">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 ml-1">{dateLabel ? `${dateLabel} To` : "End Date"}</Label>
                  <Input
                    type="date"
                    className="w-full h-10 bg-background px-3 text-sm text-foreground block"
                    value={filters.endDate}
                    onChange={(e) => updateFilter("endDate", e.target.value)}
                  />
                </div>
              )}

              {/* Party Name Select */}
              <div className="space-y-1 w-full md:w-64">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 ml-1">Party Name</Label>
                {partyNames && partyNames.length > 0 ? (
                  <Popover open={partySearchOpen} onOpenChange={setPartySearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={partySearchOpen}
                        className="w-full h-10 justify-between bg-background px-3 text-sm font-medium border-slate-200"
                      >
                        <span className="truncate">
                          {filters.partyName === "all" || !filters.partyName
                            ? "All Parties"
                            : filters.partyName}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
                    className="w-full h-9 bg-background text-xs font-medium"
                  />
                )}
              </div>

              <div className="flex items-center gap-2 h-9">
                <Button variant="outline" size="icon" className="bg-transparent h-9 w-9">
                  <Filter className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="bg-transparent h-9 w-9" onClick={() => {
                  const reset = { search: "", status: "", startDate: "", endDate: "", partyName: "", manualSaudaNo: "" };
                  setFilters(reset);
                  if (onFilterChange) onFilterChange(reset);
                }}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

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
      </div>
    </SidebarInset>
  )
}

