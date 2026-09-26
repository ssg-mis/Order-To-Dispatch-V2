"use client"

import { Filter } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

interface ColumnFilterPopoverProps {
  columnLabel: string
  values: string[] // distinct stringified values for this column, across the currently loaded rows
  searchValue: string
  onSearchChange: (v: string) => void
  selectedValues: string[] | null // null = no filter applied (every value included)
  onSelectedValuesChange: (v: string[] | null) => void
}

// Per-column Search + Filter, as one compact icon (client request) - a single
// popover with a search box on top and an Excel-style distinct-value
// checklist below, so the header row stays one line tall like every other
// stage table instead of growing a second row of icons. Neither persists
// across reload (only column visibility/order/sort do, per the client's spec).
export function ColumnFilterPopover({
  columnLabel,
  values,
  searchValue,
  onSearchChange,
  selectedValues,
  onSelectedValuesChange,
}: ColumnFilterPopoverProps) {
  const isActive = searchValue.trim().length > 0 || (!!selectedValues && selectedValues.length < values.length)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn("ml-1 inline-flex rounded p-0.5 align-middle hover:bg-slate-200 transition-colors", isActive ? "text-blue-600" : "text-slate-400")}
          title={`Search / filter ${columnLabel}`}
          onClick={(e) => e.stopPropagation()}
        >
          <Filter className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="center" onClick={(e) => e.stopPropagation()}>
        <Input
          autoFocus
          placeholder={`Search ${columnLabel}...`}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="mb-2 h-8 text-xs"
        />
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] font-black uppercase text-slate-400">Filter values</span>
          {selectedValues && selectedValues.length < values.length && (
            <button type="button" className="text-[10px] font-bold text-blue-600 hover:underline" onClick={() => onSelectedValuesChange(null)}>
              Clear
            </button>
          )}
        </div>
        <div className="max-h-48 space-y-1 overflow-y-auto">
          {values.length === 0 && <p className="py-2 text-center text-[11px] text-slate-400">No values</p>}
          {values.map((v) => {
            const checked = !selectedValues || selectedValues.includes(v)
            return (
              <label key={v} className="flex cursor-pointer items-center gap-2 py-0.5 text-xs">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(next) => {
                    const base = selectedValues ?? [...values]
                    const nextValues = next ? Array.from(new Set([...base, v])) : base.filter((x) => x !== v)
                    onSelectedValuesChange(nextValues.length === values.length ? null : nextValues)
                  }}
                />
                <span className="truncate">{v || "(blank)"}</span>
              </label>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
