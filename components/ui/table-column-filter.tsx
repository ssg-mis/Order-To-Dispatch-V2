import * as React from "react"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface TableColumnFilterProps {
  type: "text" | "number" | "date" | "datetime"
  value?: string
  onChange?: (val: string) => void
  onDateRangeChange?: (range: {from?: string, to?: string}) => void
  dateRange?: {from?: string, to?: string}
}

export function TableColumnFilter({
  type,
  value,
  onChange,
  onDateRangeChange,
  dateRange,
}: TableColumnFilterProps) {
  if (type === "date" || type === "datetime") {
    const isFiltered = !!(dateRange?.from || dateRange?.to)
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn("h-7 text-[11px] w-full px-2 py-0 bg-slate-50 border-slate-200/70 font-medium", isFiltered ? "text-blue-600 bg-blue-50 border-blue-200" : "text-slate-400 justify-start hover:bg-slate-100")}>
            {isFiltered ? 'Filtered' : 'Filter Date'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-3 shadow-lg rounded-xl border-slate-200" align="start">
          <div className="space-y-3">
            <div className="space-y-1 text-xs">
              <label className="font-semibold text-slate-700">From Date</label>
              <Input type="date" className="h-8 text-xs bg-slate-50" value={dateRange?.from || ""} onChange={e => onDateRangeChange?.({...dateRange, from: e.target.value})} />
            </div>
            <div className="space-y-1 text-xs">
              <label className="font-semibold text-slate-700">To Date</label>
              <Input type="date" className="h-8 text-xs bg-slate-50" value={dateRange?.to || ""} onChange={e => onDateRangeChange?.({...dateRange, to: e.target.value})} />
            </div>
            <Button size="sm" className="w-full text-xs h-7 mt-1 font-semibold" variant="outline" onClick={() => onDateRangeChange?.({})}>Clear Filter</Button>
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <Input
      placeholder="Search..."
      value={value || ""}
      onChange={(e) => onChange?.(e.target.value)}
      className="h-7 text-[11px] w-full px-2.5 py-0 bg-slate-50/50 hover:bg-white focus:bg-white border-slate-200/70 transition-colors shadow-none placeholder:text-slate-300"
    />
  )
}

export function filterRowByColumnDates(rowVal: any, dateRange?: {from?: string, to?: string}): boolean {
    if (!dateRange || (!dateRange.from && !dateRange.to)) return true;
    if (!rowVal) return false;
    const rowDate = new Date(rowVal);
    rowDate.setHours(0,0,0,0);
    
    if (dateRange.from) {
        const fromDate = new Date(dateRange.from);
        fromDate.setHours(0,0,0,0);
        if (rowDate < fromDate) return false;
    }
    if (dateRange.to) {
        const toDate = new Date(dateRange.to);
        toDate.setHours(0,0,0,0);
        if (rowDate > toDate) return false;
    }
    return true;
}
