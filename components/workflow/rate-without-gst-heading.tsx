"use client"

import React from "react"
import { Info } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

/**
 * "Rate w/o GST (₹)" heading with an info icon that explains how the value is derived from
 * Rate Inc. Taxes. The GST % is each product's rate from the SKU master (carried from Dispatch
 * Planning), so the divisor is not fixed: 5% -> 1.05, 10% -> 1.10 and so on.
 */
export function RateWithoutGstHeading() {
  return (
    <span className="inline-flex items-center gap-1">
      Rate w/o GST (₹)
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="How Rate w/o GST is calculated"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 space-y-2 p-3 text-left normal-case tracking-normal">
          <p className="text-sm font-semibold text-slate-900">Rate w/o GST</p>
          <p className="rounded-md border bg-slate-50/50 px-2.5 py-1.5 font-mono text-xs text-slate-800">
            Rate Inc. Taxes ÷ (1 + GST% ÷ 100)
          </p>
          <p className="text-xs font-normal text-muted-foreground">
            GST% is the product&apos;s rate from the SKU master, as set in the earlier stages: 5% → ÷ 1.05, 10% → ÷ 1.10.
            Taxable Amount = Rate w/o GST × Actual Qty Dispatch.
          </p>
        </PopoverContent>
      </Popover>
    </span>
  )
}
