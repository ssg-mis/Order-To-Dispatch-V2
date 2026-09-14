"use client"

import React from "react"
import { TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Pencil, Trash2, CheckCircle2, Eye, SortAsc, SortDesc, Check, X } from "lucide-react"

interface VehicleMasterTableProps {
  subTab: "active" | "pending"
  isLoading: boolean
  items: any[]
  sortedItems: any[]
  pendingItems: any[]
  sortState: { col: string; dir: "asc" | "desc" }
  toggleSort: (col: string, current: { col: string; dir: "asc" | "desc" }, setter: any) => void
  setSortState: any
  endRef: (node?: Element | null) => void
  isFetchingNext: boolean
  canEditActiveTab: boolean
  canEditExisting: boolean
  isReviewing?: boolean
  openEditDialog: (item: any) => void
  setDeletingItem: (item: any) => void
  setIsDeleteDialogOpen: (open: boolean) => void
  openApprovalModal?: (tab: string, item: any) => void
  setRejectDialogContext?: (context: any) => void
  formatDocDate: (dateStr?: string) => string
  renderDocCell: (expiry?: string, image?: string, type?: string) => React.ReactNode
}

const SortIcon = ({ col, sort }: { col: string; sort: { col: string; dir: "asc" | "desc" } }) => {
  if (sort.col !== col) return null
  return sort.dir === "asc" ? (
    <SortAsc className="inline h-3.5 w-3.5 ml-1 text-primary" />
  ) : (
    <SortDesc className="inline h-3.5 w-3.5 ml-1 text-primary" />
  )
}

export const VehicleMasterTable: React.FC<VehicleMasterTableProps> = ({
  subTab,
  isLoading,
  items,
  sortedItems,
  pendingItems,
  sortState,
  toggleSort,
  setSortState,
  endRef,
  isFetchingNext,
  canEditActiveTab,
  canEditExisting,
  isReviewing,
  openEditDialog,
  setDeletingItem,
  setIsDeleteDialogOpen,
  openApprovalModal,
  setRejectDialogContext,
  formatDocDate,
  renderDocCell,
}) => {
  if (subTab === "pending") {
    return (
      <div className="flex flex-col h-[600px]">
        <div className="flex-1 overflow-auto rounded-b-2xl">
          {pendingItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
              <CheckCircle2 className="h-10 w-10 text-emerald-300" />
              <p className="text-sm font-medium">No pending approvals</p>
            </div>
          ) : (
            <>
              {/* Mobile card view */}
              <div className="md:hidden p-3 space-y-3">
                {pendingItems.map((item) => {
                  const isEdit = item.request_type === "edit"
                  const submittedBy = isEdit ? item.pending_edit_by_name || item.created_by_name : item.created_by_name
                  const submittedOn = isEdit ? item.pending_edit_at : item.created_at
                  return (
                    <div key={item.id} className="border border-slate-100 rounded-xl p-4 bg-white shadow-sm space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate">{item.registration_no}</p>
                          <p className="text-xs text-slate-500">{item.vehicle_master_id}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            isEdit
                              ? "border-blue-300 text-blue-700 bg-blue-50 shrink-0"
                              : "border-emerald-300 text-emerald-700 bg-emerald-50 shrink-0"
                          }
                        >
                          {isEdit ? "Edit" : "New"}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
                        <div className="col-span-2">
                          <span className="font-medium text-slate-600">Type: </span>
                          {item.vehicle_type || "—"}
                        </div>
                        <div className="col-span-2">
                          <span className="font-medium text-slate-600">Transporter: </span>
                          {item.transporter || "—"}
                        </div>
                        <div className="col-span-2">
                          <span className="font-medium text-slate-600">Submitted By: </span>
                          {submittedBy || "—"}
                        </div>
                        <div className="col-span-2">
                          <span className="font-medium text-slate-600">Submitted On: </span>
                          {submittedOn
                            ? new Date(submittedOn).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : "—"}
                        </div>
                      </div>
                      <div className="pt-2 border-t border-slate-50 flex gap-2 w-full justify-end">
                        <Button
                          size="sm"
                          onClick={() => openApprovalModal && openApprovalModal("vehicle_master", item)}
                          disabled={isReviewing}
                          className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white px-3 rounded-lg text-xs flex-1"
                        >
                          <Check className="h-3.5 w-3.5 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setRejectDialogContext && setRejectDialogContext({ tab: "vehicle_master", id: item.id })}
                          disabled={isReviewing}
                          className="h-8 border-red-200 text-red-600 hover:bg-red-50 px-3 rounded-lg text-xs flex-1"
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Desktop Table View */}
              <table className="hidden md:table w-full caption-bottom text-sm">
                <TableHeader className="sticky top-0 z-20 bg-amber-50 shadow-sm">
                  <TableRow className="hover:bg-transparent border-b">
                    <TableHead className="pl-6">Reg No</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Vehicle ID</TableHead>
                    <TableHead>Vehicle Type</TableHead>
                    <TableHead>Transporter</TableHead>
                    <TableHead>Submitted By</TableHead>
                    <TableHead>Submitted On</TableHead>
                    <TableHead className="text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingItems.map((item) => {
                    const isEdit = item.request_type === "edit"
                    const submittedBy = isEdit ? item.pending_edit_by_name || item.created_by_name : item.created_by_name
                    const submittedOn = isEdit ? item.pending_edit_at : item.created_at
                    return (
                      <TableRow key={item.id} className="hover:bg-amber-50/30 border-b border-slate-50 h-16">
                        <TableCell className="font-semibold text-slate-900 pl-6">{item.registration_no}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              isEdit
                                ? "border-blue-300 text-blue-700 bg-blue-50"
                                : "border-emerald-300 text-emerald-700 bg-emerald-50"
                            }
                          >
                            {isEdit ? "Edit" : "New"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium text-slate-500">{item.vehicle_master_id}</TableCell>
                        <TableCell>{item.vehicle_type || "—"}</TableCell>
                        <TableCell>{item.transporter || "—"}</TableCell>
                        <TableCell>{submittedBy || "—"}</TableCell>
                        <TableCell className="text-slate-500 text-xs">
                          {submittedOn
                            ? new Date(submittedOn).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => openApprovalModal && openApprovalModal("vehicle_master", item)}
                              disabled={isReviewing}
                              className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white px-3 rounded-lg"
                            >
                              <Check className="h-3.5 w-3.5 mr-1" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setRejectDialogContext && setRejectDialogContext({ tab: "vehicle_master", id: item.id })}
                              disabled={isReviewing}
                              className="h-8 border-red-200 text-red-600 hover:bg-red-50 px-3 rounded-lg"
                            >
                              <X className="h-3.5 w-3.5 mr-1" /> Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </table>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Mobile card view */}
      <div className="md:hidden">
        {isLoading && items.length === 0 ? (
          <div className="p-4 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="border border-slate-100 rounded-xl p-4 space-y-2 animate-pulse">
                <div className="h-4 w-32 bg-slate-200 rounded" />
                <div className="h-3 w-40 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-slate-400">No vehicles found</div>
        ) : (
          <div className="p-3 space-y-3 overflow-auto" style={{ maxHeight: 600 }}>
            {sortedItems.map((item) => (
              <div key={item.id} className="border border-slate-100 rounded-xl p-4 bg-white shadow-sm space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{item.registration_no}</p>
                    <p className="text-xs text-slate-500">{item.vehicle_master_id}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(item)}
                      className="h-8 w-8 text-blue-600 hover:bg-blue-50"
                      disabled={!canEditActiveTab}
                      title={!canEditActiveTab ? "View Only" : "Edit"}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setDeletingItem(item)
                        setIsDeleteDialogOpen(true)
                      }}
                      className="h-8 w-8 text-destructive hover:bg-red-50"
                      disabled={!canEditExisting}
                      title={!canEditExisting ? "Admin Only" : "Delete"}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
                  <div>
                    <span className="font-medium text-slate-600">Transporter: </span>
                    {item.transporter || "—"}
                  </div>
                  <div>
                    <span className="font-medium text-slate-600">Type: </span>
                    {item.vehicle_type || "—"}
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 space-y-1.5">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Document Expiry Details</p>
                  <div className="grid grid-cols-1 gap-1.5 text-xs">
                    {(item.road_tax || item.road_tax_image) && (
                      <div className="flex items-center justify-between py-0.5 border-b border-slate-50">
                        <span className="font-medium text-slate-500">Road Tax Expiry</span>
                        {item.road_tax_image ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              window.open(item.road_tax_image, "_blank")
                            }}
                            className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                          >
                            {formatDocDate(item.road_tax)}
                          </button>
                        ) : (
                          <span className="text-slate-700">{formatDocDate(item.road_tax)}</span>
                        )}
                      </div>
                    )}
                    {(item.life_time_tax || item.life_time_tax_image) && (
                      <div className="flex items-center justify-between py-0.5 border-b border-slate-50">
                        <span className="font-medium text-slate-500">Lifetime Tax</span>
                        {item.life_time_tax_image ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              window.open(item.life_time_tax_image, "_blank")
                            }}
                            className="text-blue-600 hover:text-blue-800 hover:underline font-semibold"
                          >
                            LTT
                          </button>
                        ) : (
                          <span className="text-slate-700 font-semibold">LTT</span>
                        )}
                      </div>
                    )}
                    {(item.pollution || item.pollution_image || item.fuel_type === "Electrical") && (
                      <div className="flex items-center justify-between py-0.5 border-b border-slate-50">
                        <span className="font-medium text-slate-500">Pollution Expiry</span>
                        {item.fuel_type === "Electrical" ? (
                          item.pollution_image ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                window.open(item.pollution_image, "_blank")
                              }}
                              className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                            >
                              N/A
                            </button>
                          ) : (
                            <span className="text-slate-700">N/A</span>
                          )
                        ) : item.pollution_image ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              window.open(item.pollution_image, "_blank")
                            }}
                            className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                          >
                            {formatDocDate(item.pollution)}
                          </button>
                        ) : (
                          <span className="text-slate-700">{formatDocDate(item.pollution)}</span>
                        )}
                      </div>
                    )}
                    {(item.insurance || item.insurance_image) && (
                      <div className="flex items-center justify-between py-0.5 border-b border-slate-50">
                        <span className="font-medium text-slate-500">Insurance Expiry</span>
                        {item.insurance_image ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              window.open(item.insurance_image, "_blank")
                            }}
                            className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                          >
                            {formatDocDate(item.insurance)}
                          </button>
                        ) : (
                          <span className="text-slate-700">{formatDocDate(item.insurance)}</span>
                        )}
                      </div>
                    )}
                    {(item.fitness || item.fitness_image) && (
                      <div className="flex items-center justify-between py-0.5 border-b border-slate-50">
                        <span className="font-medium text-slate-500">Fitness Expiry</span>
                        {item.fitness_image ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              window.open(item.fitness_image, "_blank")
                            }}
                            className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                          >
                            {formatDocDate(item.fitness)}
                          </button>
                        ) : (
                          <span className="text-slate-700">{formatDocDate(item.fitness)}</span>
                        )}
                      </div>
                    )}
                    {(item.state_permit || item.state_permit_image) && (
                      <div className="flex items-center justify-between py-0.5">
                        <span className="font-medium text-slate-500">State Permit Expiry</span>
                        {item.state_permit_image ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              window.open(item.state_permit_image, "_blank")
                            }}
                            className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                          >
                            {formatDocDate(item.state_permit)}
                          </button>
                        ) : (
                          <span className="text-slate-700">{formatDocDate(item.state_permit)}</span>
                        )}
                      </div>
                    )}
                    {(item.national_permit || item.national_permit_image) && (
                      <div className="flex items-center justify-between py-0.5">
                        <span className="font-medium text-slate-500">National Permit Expiry</span>
                        {item.national_permit_image ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              window.open(item.national_permit_image, "_blank")
                            }}
                            className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                          >
                            {formatDocDate(item.national_permit)}
                          </button>
                        ) : (
                          <span className="text-slate-700">{formatDocDate(item.national_permit)}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant={item.status === "Active" ? "default" : "secondary"}
                    className={item.status === "Active" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none" : ""}
                  >
                    {item.status}
                  </Badge>
                  {item.has_pending_edit && (
                    <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">
                      Edit pending approval
                    </Badge>
                  )}
                </div>
              </div>
            ))}
            {isFetchingNext && (
              <div className="flex items-center justify-center py-4 gap-2 text-slate-400 text-xs">
                <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.3s]" />
                <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.15s]" />
                <div className="h-1.5 w-1.5 bg-primary animate-bounce" />
                <span className="ml-2">Loading more vehicles...</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:flex flex-col h-[600px]">
        <div className="flex-1 overflow-auto rounded-b-2xl">
          <table className="w-full caption-bottom text-sm">
            <TableHeader className="sticky top-0 z-20 bg-slate-50 shadow-sm">
              <TableRow className="hover:bg-transparent border-b">
                <TableHead
                  className="pl-6 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                  onClick={() => toggleSort("vehicle_master_id", sortState, setSortState)}
                >
                  ID <SortIcon col="vehicle_master_id" sort={sortState} />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-slate-100 transition-colors"
                  onClick={() => toggleSort("registration_no", sortState, setSortState)}
                >
                  Reg No <SortIcon col="registration_no" sort={sortState} />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-slate-100 transition-colors"
                  onClick={() => toggleSort("transporter", sortState, setSortState)}
                >
                  Transporter <SortIcon col="transporter" sort={sortState} />
                </TableHead>
                <TableHead>Type</TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-slate-100 transition-colors"
                  onClick={() => toggleSort("road_tax", sortState, setSortState)}
                >
                  Road Tax <SortIcon col="road_tax" sort={sortState} />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-slate-100 transition-colors"
                  onClick={() => toggleSort("pollution", sortState, setSortState)}
                >
                  Pollution <SortIcon col="pollution" sort={sortState} />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-slate-100 transition-colors"
                  onClick={() => toggleSort("insurance", sortState, setSortState)}
                >
                  Insurance <SortIcon col="insurance" sort={sortState} />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-slate-100 transition-colors"
                  onClick={() => toggleSort("fitness", sortState, setSortState)}
                >
                  Fitness <SortIcon col="fitness" sort={sortState} />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-slate-100 transition-colors"
                  onClick={() => toggleSort("state_permit", sortState, setSortState)}
                >
                  State Permit <SortIcon col="state_permit" sort={sortState} />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-slate-100 transition-colors"
                  onClick={() => toggleSort("national_permit", sortState, setSortState)}
                >
                  National Permit <SortIcon col="national_permit" sort={sortState} />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-slate-100 transition-colors"
                  onClick={() => toggleSort("status", sortState, setSortState)}
                >
                  Status <SortIcon col="status" sort={sortState} />
                </TableHead>
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && items.length === 0 ? (
                [...Array(8)].map((_, i) => (
                  <TableRow key={i} className="opacity-40 border-b border-slate-50 h-16">
                    <TableCell className="pl-6">
                      <div className="h-4 w-16 bg-slate-200 animate-pulse rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-32 bg-slate-200 animate-pulse rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-40 bg-slate-200 animate-pulse rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-24 bg-slate-200 animate-pulse rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-20 bg-slate-200 animate-pulse rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-20 bg-slate-200 animate-pulse rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-20 bg-slate-200 animate-pulse rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-20 bg-slate-200 animate-pulse rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-20 bg-slate-200 animate-pulse rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-20 bg-slate-200 animate-pulse rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-6 w-20 bg-slate-200 animate-pulse rounded-full" />
                    </TableCell>
                    <TableCell className="pr-6">
                      <div className="h-8 w-16 bg-slate-100 animate-pulse rounded ml-auto" />
                    </TableCell>
                  </TableRow>
                ))
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="text-center py-20 text-slate-400">
                    No vehicles found
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {sortedItems.map((item) => (
                    <TableRow key={item.id} className="hover:bg-slate-50/30 transition-colors border-b border-slate-50 h-16">
                      <TableCell className="font-medium pl-6">{item.vehicle_master_id}</TableCell>
                      <TableCell className="font-semibold text-slate-900">{item.registration_no}</TableCell>
                      <TableCell className="text-slate-600">{item.transporter || "—"}</TableCell>
                      <TableCell>
                        <span className="font-medium text-slate-700 text-sm">{item.vehicle_type || "—"}</span>
                      </TableCell>
                      {item.life_time_tax || item.life_time_tax_image ? (
                        <TableCell className="text-xs">
                          {item.life_time_tax_image ? (
                            <button
                              onClick={() => window.open(item.life_time_tax_image, "_blank")}
                              className="text-blue-600 hover:text-blue-800 hover:underline font-semibold text-left w-fit"
                              title="Lifetime Tax — open certificate"
                            >
                              LTT
                            </button>
                          ) : (
                            <span className="text-slate-700 font-semibold" title="Lifetime Tax">
                              LTT
                            </span>
                          )}
                        </TableCell>
                      ) : (
                        <TableCell className="text-xs">{renderDocCell(item.road_tax, item.road_tax_image)}</TableCell>
                      )}
                      {item.fuel_type === "Electrical" ? (
                        <TableCell className="text-xs">
                          {item.pollution_image ? (
                            <button
                              onClick={() => window.open(item.pollution_image, "_blank")}
                              className="text-blue-600 hover:text-blue-800 hover:underline font-medium text-left w-fit"
                            >
                              N/A
                            </button>
                          ) : (
                            <span className="text-slate-700 font-medium">N/A</span>
                          )}
                        </TableCell>
                      ) : (
                        <TableCell className="text-xs">{renderDocCell(item.pollution, item.pollution_image)}</TableCell>
                      )}
                      <TableCell className="text-xs">{renderDocCell(item.insurance, item.insurance_image)}</TableCell>
                      <TableCell className="text-xs">{renderDocCell(item.fitness, item.fitness_image)}</TableCell>
                      <TableCell className="text-xs">{renderDocCell(item.state_permit, item.state_permit_image)}</TableCell>
                      <TableCell className="text-xs">{renderDocCell(item.national_permit, item.national_permit_image)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={item.status === "Active" ? "default" : "secondary"}
                            className={item.status === "Active" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none" : ""}
                          >
                            {item.status}
                          </Badge>
                          {item.has_pending_edit && (
                            <Badge
                              variant="outline"
                              className="border-amber-300 text-amber-700 bg-amber-50 whitespace-nowrap"
                              title="An edit to this record is awaiting admin approval"
                            >
                              Edit pending
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(item)}
                            className="h-8 w-8 text-blue-600 hover:bg-blue-50"
                            disabled={!canEditActiveTab}
                            title={!canEditActiveTab ? "View Only" : "Edit Vehicle"}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setDeletingItem(item)
                              setIsDeleteDialogOpen(true)
                            }}
                            className="h-8 w-8 text-destructive hover:bg-red-50"
                            disabled={!canEditExisting}
                            title={!canEditExisting ? "Admin Only" : "Delete Vehicle"}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Infinite Scroll Sentinel */}
                  <TableRow ref={endRef}>
                    <TableCell colSpan={13} className="p-0 h-12 border-none">
                      {isFetchingNext && (
                        <div className="flex items-center justify-center py-4 text-slate-400 bg-slate-50/20">
                          <div className="flex gap-1.5 items-center bg-white px-4 py-1.5 rounded-full shadow-sm border border-slate-100">
                            <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.3s]"></div>
                            <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.15s]"></div>
                            <div className="h-1.5 w-1.5 bg-primary animate-bounce"></div>
                            <span className="text-xs font-medium ml-2 text-slate-500">Loading more vehicles...</span>
                          </div>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </table>
        </div>
      </div>
    </>
  )
}
