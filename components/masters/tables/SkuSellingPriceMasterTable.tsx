"use client"

import React from "react"
import { TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Pencil, Trash2, SortAsc, SortDesc } from "lucide-react"

interface SkuSellingPriceMasterTableProps {
  isLoading: boolean
  items: any[]
  sortedItems: any[]
  sortState: { col: string; dir: "asc" | "desc" }
  toggleSort: (col: string, current: { col: string; dir: "asc" | "desc" }, setter: any) => void
  setSortState: any
  endRef: (node?: Element | null) => void
  isFetchingNext: boolean
  canEditExisting: boolean
  openEditDialog: (item: any) => void
  setDeletingItem: (item: any) => void
  setIsDeleteDialogOpen: (open: boolean) => void
}

const SortIcon = ({ col, sort }: { col: string; sort: { col: string; dir: "asc" | "desc" } }) => {
  if (sort.col !== col) return null
  return sort.dir === "asc" ? (
    <SortAsc className="inline h-3.5 w-3.5 ml-1 text-primary" />
  ) : (
    <SortDesc className="inline h-3.5 w-3.5 ml-1 text-primary" />
  )
}

export const SkuSellingPriceMasterTable: React.FC<SkuSellingPriceMasterTableProps> = ({
  isLoading,
  items,
  sortedItems,
  sortState,
  toggleSort,
  setSortState,
  endRef,
  isFetchingNext,
  canEditExisting,
  openEditDialog,
  setDeletingItem,
  setIsDeleteDialogOpen,
}) => {
  return (
    <>
      {/* Mobile card view */}
      <div className="md:hidden">
        {isLoading && items.length === 0 ? (
          <div className="p-4 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="border border-slate-100 rounded-xl p-4 space-y-2 animate-pulse">
                <div className="h-4 w-40 bg-slate-200 rounded" />
                <div className="h-3 w-32 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-slate-400">No SKU Prices found</div>
        ) : (
          <div className="p-3 space-y-3 overflow-auto" style={{ maxHeight: 600 }}>
            {sortedItems.map((item) => (
              <div key={item.id} className="border border-slate-100 rounded-xl p-4 bg-white shadow-sm space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{item.packing_material}</p>
                    <p className="text-xs text-emerald-600 font-bold">Selling: {item.selling_cost}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(item)}
                      className="h-8 w-8 text-blue-600 hover:bg-blue-50"
                      disabled={!canEditExisting}
                      title={!canEditExisting ? "Admin Only" : "Edit"}
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
                    <span className="font-medium text-slate-600">Weight: </span>
                    {item.sku_weight} {item.sku_unit}
                  </div>
                  <div>
                    <span className="font-medium text-slate-600">Landing Cost: </span>
                    {item.landing_cost}
                  </div>
                  <div>
                    <span className="font-medium text-slate-600">Pack Cost: </span>
                    {item.packing_cost}
                  </div>
                  <div>
                    <span className="font-medium text-slate-600">Margin: </span>
                    {item.margin}
                  </div>
                  <div>
                    <span className="font-medium text-slate-600">Net Oil(gm): </span>
                    {item.net_oil_in_gm}
                  </div>
                  <div>
                    <span className="font-medium text-slate-600">VAR: </span>
                    {item.var}
                  </div>
                </div>
              </div>
            ))}
            {isFetchingNext && (
              <div className="flex items-center justify-center py-4 gap-2 text-slate-400 text-xs">
                <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.3s]" />
                <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.15s]" />
                <div className="h-1.5 w-1.5 bg-primary animate-bounce" />
                <span className="ml-2">Loading more prices...</span>
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
                  onClick={() => toggleSort("packing_material", sortState, setSortState)}
                >
                  Packing Material <SortIcon col="packing_material" sort={sortState} />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-slate-100 transition-colors"
                  onClick={() => toggleSort("sku_weight", sortState, setSortState)}
                >
                  Weight <SortIcon col="sku_weight" sort={sortState} />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-slate-100 transition-colors"
                  onClick={() => toggleSort("sku_unit", sortState, setSortState)}
                >
                  Unit <SortIcon col="sku_unit" sort={sortState} />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-slate-100 transition-colors"
                  onClick={() => toggleSort("conversion_formula", sortState, setSortState)}
                >
                  Conv. Form <SortIcon col="conversion_formula" sort={sortState} />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-slate-100 transition-colors"
                  onClick={() => toggleSort("sku_weight_in_gm", sortState, setSortState)}
                >
                  SKU Wght(gm) <SortIcon col="sku_weight_in_gm" sort={sortState} />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-slate-100 transition-colors"
                  onClick={() => toggleSort("packing_material_weight_in_gm", sortState, setSortState)}
                >
                  Pack Mat. Wght <SortIcon col="packing_material_weight_in_gm" sort={sortState} />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-slate-100 transition-colors"
                  onClick={() => toggleSort("net_oil_in_gm", sortState, setSortState)}
                >
                  Net Oil(gm) <SortIcon col="net_oil_in_gm" sort={sortState} />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-slate-100 transition-colors"
                  onClick={() => toggleSort("packing_cost", sortState, setSortState)}
                >
                  Pack Cost <SortIcon col="packing_cost" sort={sortState} />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-slate-100 transition-colors"
                  onClick={() => toggleSort("var", sortState, setSortState)}
                >
                  VAR <SortIcon col="var" sort={sortState} />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-slate-100 transition-colors"
                  onClick={() => toggleSort("landing_cost", sortState, setSortState)}
                >
                  Landing Cost <SortIcon col="landing_cost" sort={sortState} />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-slate-100 transition-colors"
                  onClick={() => toggleSort("margin", sortState, setSortState)}
                >
                  Margin <SortIcon col="margin" sort={sortState} />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-slate-100 transition-colors"
                  onClick={() => toggleSort("actual_margin", sortState, setSortState)}
                >
                  Actual Margin <SortIcon col="actual_margin" sort={sortState} />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-slate-100 transition-colors"
                  onClick={() => toggleSort("selling_cost", sortState, setSortState)}
                >
                  Selling Cost <SortIcon col="selling_cost" sort={sortState} />
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
                      <div className="h-4 w-32 bg-slate-200 animate-pulse rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-12 bg-slate-200 animate-pulse rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-12 bg-slate-200 animate-pulse rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-16 bg-slate-200 animate-pulse rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-16 bg-slate-200 animate-pulse rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-16 bg-slate-200 animate-pulse rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-16 bg-slate-200 animate-pulse rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-16 bg-slate-200 animate-pulse rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-12 bg-slate-200 animate-pulse rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-20 bg-slate-200 animate-pulse rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-16 bg-slate-200 animate-pulse rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-20 bg-slate-200 animate-pulse rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-24 bg-slate-200 animate-pulse rounded" />
                    </TableCell>
                    <TableCell className="pr-6">
                      <div className="h-8 w-16 bg-slate-100 animate-pulse rounded ml-auto" />
                    </TableCell>
                  </TableRow>
                ))
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={14} className="text-center py-20 text-slate-400">
                    No SKU Prices found
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {sortedItems.map((item) => (
                    <TableRow key={item.id} className="hover:bg-slate-50/30 transition-colors border-b border-slate-50 h-16">
                      <TableCell className="font-semibold text-slate-900 pl-6">{item.packing_material}</TableCell>
                      <TableCell className="text-slate-600 font-medium">{item.sku_weight}</TableCell>
                      <TableCell className="text-slate-500">{item.sku_unit}</TableCell>
                      <TableCell className="text-slate-500">{item.conversion_formula}</TableCell>
                      <TableCell className="text-slate-500">{item.sku_weight_in_gm}</TableCell>
                      <TableCell className="text-slate-500">{item.packing_material_weight_in_gm}</TableCell>
                      <TableCell className="text-slate-500">{item.net_oil_in_gm}</TableCell>
                      <TableCell className="text-slate-500">{item.packing_cost}</TableCell>
                      <TableCell className="text-slate-500">{item.var}</TableCell>
                      <TableCell className="font-bold text-slate-700 underline decoration-slate-200 decoration-2 underline-offset-4">
                        {item.landing_cost}
                      </TableCell>
                      <TableCell className="text-slate-600">{item.margin}</TableCell>
                      <TableCell className="text-slate-600 font-medium">{item.actual_margin}</TableCell>
                      <TableCell>
                        <span className="font-bold text-emerald-600 bg-emerald-50/50 rounded-lg px-2 py-1 inline-block">
                          {item.selling_cost}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={item.status === 'Inactive' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}>
                          {item.status || 'Active'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(item)}
                            className="h-8 w-8 text-blue-600 hover:bg-blue-50"
                            disabled={!canEditExisting}
                            title={!canEditExisting ? "Admin Only" : "Edit SKU Price"}
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
                            title={!canEditExisting ? "Admin Only" : "Delete SKU Price"}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Infinite Scroll Sentinel */}
                  <TableRow ref={endRef}>
                    <TableCell colSpan={14} className="p-0 h-12 border-none">
                      {isFetchingNext && (
                        <div className="flex items-center justify-center py-4 text-slate-400 bg-slate-50/20">
                          <div className="flex gap-1.5 items-center bg-white px-4 py-1.5 rounded-full shadow-sm border border-slate-100">
                            <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.3s]"></div>
                            <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.15s]"></div>
                            <div className="h-1.5 w-1.5 bg-primary animate-bounce"></div>
                            <span className="text-xs font-medium ml-2 text-slate-500">Loading more prices...</span>
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
