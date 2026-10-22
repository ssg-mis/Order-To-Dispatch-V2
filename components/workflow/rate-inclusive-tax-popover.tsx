"use client"

import React, { useMemo } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Calculator } from "lucide-react"
import { cn } from "@/lib/utils"

export interface RateInclusiveTaxPopoverProps {
  product: any
  cdAmount?: number | string | null
  skus?: any[]
  displayRate?: number | string | null
  className?: string
  align?: "start" | "center" | "end"
}

/**
 * Extracts the number of units per main UOM (e.g. 12 for 1*12, 8 for 1*08, 1 for 1 tin).
 */
export function getNosPerMainUom(product: any, skus?: any[]): number {
  const raw = product?.nos_per_main_uom ?? product?.nosPerMainUom
  if (raw != null && !isNaN(parseFloat(raw)) && parseFloat(raw) > 0) {
    return parseFloat(raw)
  }

  const name = String(product?.productName || product?.product_name || product?.sku_name || "")
  // Match standard packaging notation like (1*08), (1*12), (1*16), (1*1), 1*8 etc.
  const match = name.match(/1\*0*(\d+)/i)
  if (match && match[1]) {
    const val = parseInt(match[1], 10)
    if (val > 0) return val
  }

  if (skus && skus.length > 0 && name) {
    const clean = name.trim().toLowerCase()
    const found = skus.find((s: any) => (s.sku_name || "").trim().toLowerCase() === clean)
    if (found?.nos_per_main_uom && parseFloat(found.nos_per_main_uom) > 0) {
      return parseFloat(found.nos_per_main_uom)
    }
  }

  return 1
}

/**
 * Extracts order punch rate per unit.
 */
export function getOrderPunchRate(product: any, nos: number): number {
  const rawRate = parseFloat(product?.rate_of_material ?? product?.rateOfMaterial ?? 0)
  if (rawRate > 0) return rawRate

  // The stage tables build `rate` from rate_of_material only, so don't fall back to
  // rate_per_ltr / rate_per_15kg here: the breakdown would stop adding up to that rate.
  // Fallback: If base rate was compiled into product.rate, back-calculate base punch rate
  const totalRate = parseFloat(product?.rate ?? 0)
  const freight = parseFloat(product?.freight_rate ?? product?.freightRate ?? 0)
  if (totalRate > 0 && nos > 0) {
    const baseMaterialRate = Math.max(0, totalRate - freight)
    return baseMaterialRate / nos
  }

  return 0
}

/**
 * Hyperlink Popover displaying the exact Rate Inclusive of Taxes formula breakdown:
 * Formula: (Order punch rate per unit * Nos per main UOM) + Additional Freight - CD
 */
export function RateInclusiveTaxPopover({
  product,
  cdAmount,
  skus,
  displayRate,
  className,
  align = "end",
}: RateInclusiveTaxPopoverProps) {
  const nos = useMemo(() => getNosPerMainUom(product, skus), [product, skus])
  const punchRate = useMemo(() => getOrderPunchRate(product, nos), [product, nos])
  const baseRate = punchRate * nos

  const freight = parseFloat(product?.freight_rate ?? product?.freightRate ?? 0) || 0

  // CD is per main UOM (tax inclusive) and is subtracted once from the main-UOM rate.
  const cd = cdAmount !== undefined && cdAmount !== null && cdAmount !== ""
    ? (parseFloat(String(cdAmount)) || 0)
    : (parseFloat(product?.cd_amount ?? product?.cdAmount ?? 0) || 0)

  const calculatedRate = baseRate + freight - cd
  const finalRate = displayRate !== undefined && displayRate !== null
    ? (typeof displayRate === "number" ? displayRate : parseFloat(displayRate) || calculatedRate)
    : calculatedRate

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 cursor-pointer font-mono font-bold text-primary hover:text-primary/80 underline underline-offset-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-0.5",
            className
          )}
          title="Click to view Rate Inc. Taxes formula breakdown"
        >
          <span>{finalRate ? finalRate.toFixed(2) : "—"}</span>
        </button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md p-0 gap-0 overflow-hidden text-left">
        <div className="h-1 w-full bg-gradient-to-r from-primary via-primary/60 to-primary/10" />

        <DialogHeader className="flex-row items-center gap-3 space-y-0 px-6 pt-5 pb-4 pr-12 text-left">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Calculator className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-base font-semibold leading-tight text-slate-900">Rate Inc. Taxes Breakdown</DialogTitle>
            <DialogDescription className="mt-0.5 text-xs">All components are inclusive of taxes</DialogDescription>
          </div>
        </DialogHeader>

        <div className="px-6">
          <div className="rounded-xl border border-slate-200/80 bg-white/70">
            {[
              { op: "", label: "Order Punch Rate / Unit", tag: "Order Punch", hint: "Rate of 1 piece / bottle / tin", value: `₹${punchRate.toFixed(2)}` },
              { op: "×", label: "Nos per Main UOM", tag: "SKU", hint: nos > 1 ? `${nos} pcs per box` : "1 tin (1*1)", value: `${nos}` },
              { op: "=", label: "Base Rate per Main UOM", hint: "Order Punch Rate × Nos", value: `₹${baseRate.toFixed(2)}`, subtotal: true },
              { op: "+", label: "Additional Freight", tag: "Dispatch Plan", hint: "Tax inclusive, per main UOM", value: `₹${freight.toFixed(2)}` },
              {
                op: "−", label: "CD per Main UOM", tag: "Make Invoice",
                hint: "Tax inclusive, per main UOM",
                value: `₹${cd.toFixed(2)}`,
              },
            ].map((row, i) => (
              <div
                key={row.label}
                className={cn(
                  "flex items-center gap-3 px-4 py-3",
                  i > 0 && "border-t border-slate-200/70",
                  row.subtotal && "border-dashed bg-slate-50/80"
                )}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 font-mono text-xs font-semibold text-slate-500">
                  {row.op || "₹"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <p className={cn("text-sm text-slate-900", row.subtotal ? "font-semibold" : "font-medium")}>{row.label}</p>
                    {row.tag && (
                      <span className="rounded-full bg-primary/10 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-primary">
                        {row.tag}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{row.hint}</p>
                </div>
                <span className={cn("font-mono tabular-nums text-sm text-slate-900", row.subtotal ? "font-bold" : "font-semibold")}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-primary/20 border-l-4 border-l-primary bg-primary/5 px-4 py-3.5">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">Rate Inc. Taxes</p>
              <p className="mt-0.5 font-mono tabular-nums text-[11px] text-muted-foreground">
                ({punchRate.toFixed(2)} × {nos}) + {freight.toFixed(2)} − {cd.toFixed(2)}
              </p>
            </div>
            <span className="font-mono tabular-nums text-2xl font-bold tracking-tight text-primary">₹{finalRate.toFixed(2)}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
