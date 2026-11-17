"use client"

import React from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Pencil, Trash2, CheckCircle2, Check, X, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react"
import { fmtWeight } from "@/lib/weight-format"
import { useWeightDecimals } from "@/hooks/use-weight-decimals"

interface SemiFinishedGoodMasterTableProps {
  subTab: string
  isLoading: boolean
  items: any[]
  sortedItems: any[]
  pendingItems: any[]
  sortState: { col: string; dir: 'asc' | 'desc' }
  toggleSort: (col: string, current: { col: string; dir: 'asc' | 'desc' }, setter: any) => void
  setSortState: any
  endRef: any
  isFetchingNext: boolean
  canEditActiveTab: boolean
  canEditExisting: boolean
  isReviewing: boolean
  openEditDialog: (item: any) => void
  setDeletingItem: (item: any) => void
  setIsDeleteDialogOpen: (open: boolean) => void
  openApprovalModal: (tab: string, item: any) => void
  setRejectDialogContext: (ctx: { tab: string; id: any }) => void
  unitOptions?: any[]
}

const SortIcon = ({ col, sort }: { col: string; sort: { col: string; dir: 'asc' | 'desc' } }) => {
  if (sort.col !== col) return <ArrowUpDown className="h-3 w-3 ml-1 inline text-slate-400" />
  return sort.dir === 'asc' ? <ArrowUp className="h-3 w-3 ml-1 inline text-primary" /> : <ArrowDown className="h-3 w-3 ml-1 inline text-primary" />
}

export const SemiFinishedGoodMasterTable: React.FC<SemiFinishedGoodMasterTableProps> = ({
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
  unitOptions = [],
}) => {
  const wd = useWeightDecimals()
  if (subTab === 'pending') {
    return (
      <div className="flex flex-col h-[600px]">
        <div className="flex-1 overflow-auto rounded-b-2xl">
          {pendingItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
              <CheckCircle2 className="h-10 w-10 text-emerald-300" />
              <p className="text-sm font-medium">No pending approvals</p>
            </div>
          ) : (
            <Table className="w-full caption-bottom text-sm">
              <TableHeader className="sticky top-0 z-20 bg-amber-50 shadow-sm">
                <TableRow className="hover:bg-transparent border-b">
                  <TableHead className="pl-6">Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Submitted By</TableHead>
                  <TableHead>Submitted On</TableHead>
                  <TableHead className="text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingItems.map((item) => {
                  const isEdit = item.request_type === 'edit'
                  const submittedBy = isEdit ? (item.pending_edit_by_name || item.created_by_name) : item.created_by_name
                  const submittedOn = isEdit ? item.pending_edit_at : item.created_at
                  return (
                    <TableRow key={item.semi_finished_good_code} className="hover:bg-amber-50/30 border-b border-slate-50 h-16">
                      <TableCell className="font-medium pl-6 text-slate-500">{item.semi_finished_good_code}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={isEdit ? "border-blue-300 text-blue-700 bg-blue-50" : "border-emerald-300 text-emerald-700 bg-emerald-50"}>
                          {isEdit ? "Edit" : "New"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold text-slate-900">{item.name}</TableCell>
                      <TableCell>{submittedBy || "—"}</TableCell>
                      <TableCell className="text-slate-500 text-xs">
                        {submittedOn ? new Date(submittedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "—"}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" onClick={() => openApprovalModal('semi_finished_goods', item)} disabled={isReviewing} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white px-3 rounded-lg">
                            <Check className="h-3.5 w-3.5 mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setRejectDialogContext({ tab: 'semi_finished_goods', id: item.id })} disabled={isReviewing} className="h-8 border-red-200 text-red-600 hover:bg-red-50 px-3 rounded-lg">
                            <X className="h-3.5 w-3.5 mr-1" /> Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[600px]">
      <div className="flex-1 overflow-auto rounded-b-2xl">
        <Table className="w-full caption-bottom text-sm">
          <TableHeader className="sticky top-0 z-20 bg-slate-50 shadow-sm">
            <TableRow className="hover:bg-transparent border-b">
              <TableHead className="pl-6 cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('semi_finished_good_code', sortState, setSortState)}>
                Code <SortIcon col="semi_finished_good_code" sort={sortState} />
              </TableHead>
              <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('name', sortState, setSortState)}>
                Name <SortIcon col="name" sort={sortState} />
              </TableHead>
              <TableHead>Main UOM</TableHead>
              <TableHead>Converted Kg</TableHead>
              <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('status', sortState, setSortState)}>
                Status <SortIcon col="status" sort={sortState} />
              </TableHead>
              <TableHead className="text-right pr-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && items.length === 0 ? (
              [...Array(8)].map((_, i) => (
                <TableRow key={i} className="opacity-40 border-b border-slate-50 h-16">
                  <TableCell className="pl-6"><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                  <TableCell><div className="h-4 w-32 bg-slate-200 animate-pulse rounded" /></TableCell>
                  <TableCell><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                  <TableCell><div className="h-4 w-20 bg-slate-200 animate-pulse rounded" /></TableCell>
                  <TableCell><div className="h-6 w-20 bg-slate-200 animate-pulse rounded-full" /></TableCell>
                  <TableCell className="pr-6"><div className="h-8 w-16 bg-slate-100 animate-pulse rounded ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-20 text-slate-400">No semi-finished goods found</TableCell></TableRow>
            ) : (
              <>
                {sortedItems.map((item: any) => (
                  <TableRow key={item.semi_finished_good_code} className="hover:bg-slate-50/30 transition-colors border-b border-slate-50 h-16">
                    <TableCell className="font-medium pl-6">{item.semi_finished_good_code}</TableCell>
                    <TableCell className="font-semibold text-slate-900">{item.name}</TableCell>
                    <TableCell>{unitOptions.find((u: any) => u.id === item.main_uom_id)?.unit_name || "—"}</TableCell>
                    <TableCell>{fmtWeight(item.converted_kg, wd)}</TableCell>
                    <TableCell>
                      <Badge variant={item.status === 'Active' ? 'default' : 'secondary'} className={item.status === 'Active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none' : ''}>
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={!canEditActiveTab} title={!canEditActiveTab ? "View Only" : "Edit Semi-Finished Good"}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50" disabled={!canEditExisting} title={!canEditExisting ? "Admin Only" : "Delete Semi-Finished Good"}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow ref={endRef}>
                  <TableCell colSpan={6} className="p-0 h-12 border-none">
                    {isFetchingNext && <div className="flex items-center justify-center py-4 text-slate-400 text-xs">Loading more semi-finished goods...</div>}
                  </TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
