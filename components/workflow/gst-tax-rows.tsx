"use client"

import React from "react"
import type { GstSummary } from "@/lib/gst"

const pctText = (n: number) => `${+n.toFixed(2)}%`

/**
 * The GST lines of an invoice summary: either CGST + SGST (same state) or IGST only (other state),
 * never all three, each at the rate carried from the earlier stages (SKU master). When an invoice
 * mixes GST rates, every rate gets its own lines.
 *
 * Nothing is assumed: if the master has no GST rate, or no state for the depot / customer, the tax
 * lines show "—" with a note saying what is missing.
 */
export function GstTaxRows({ summary }: { summary: GstSummary }) {
  const { stateKnown, isIgst, groups, missingRate, complete } = summary

  const line = (key: string, label: string, amount: number | null) => (
    <div key={key} className="flex justify-between items-center text-xs">
      <span className="font-black uppercase text-slate-500 text-[10px]">{label}</span>
      <span className="font-mono font-bold text-slate-700">{amount === null ? "—" : `₹${amount.toFixed(2)}`}</span>
    </div>
  )

  const notes: string[] = []
  if (missingRate) notes.push("GST rate not set in SKU master")
  if (!stateKnown) notes.push("State not set in master")

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5 pb-1">
        {notes.map((n) => (
          <span key={n} className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
            {n}
          </span>
        ))}
        {stateKnown && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
            {isIgst ? "Other state · IGST" : "Same state · CGST + SGST"}
          </span>
        )}
      </div>

      {!complete
        ? line("gst", "GST", null)
        : groups.flatMap((g) =>
            isIgst
              ? [line(`igst-${g.pct}`, `IGST (${pctText(g.pct)})`, g.tax)]
              : [
                  line(`cgst-${g.pct}`, `CGST (${pctText(g.pct / 2)})`, g.half),
                  line(`sgst-${g.pct}`, `SGST (${pctText(g.pct / 2)})`, g.half),
                ],
          )}
    </>
  )
}
