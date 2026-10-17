"use client"

import * as React from "react"
import { useQueries, useQueryClient } from "@tanstack/react-query"
import { Loader2, Receipt } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { orderApi } from "@/lib/api-service"
import { fmtNum } from "@/lib/table-format"
import { LedgerChargesEditor, incompleteChargeIndex, validCharges, newChargeRow, type ChargeRow } from "@/components/order-punch/ledger-charges-editor"

/**
 * Ledger charges of an order are ONE set, stored on the order (set at Order Punch, editable at Approval of Order).
 * Later stages only SHOW them - or, where an order has none yet, let the user add them once (never a second set).
 * On an invoice they are billed ONCE, with the order's first invoice (`invoiced` tells later stages to skip them).
 */
export type OrderChargesInfo = {
  order_id: number
  charges: { id: number; ledger_id: number; ledger_name: string; amount: string | number }[]
  total: number
  invoiced: boolean
}

const KEY = (no: string) => ["order-charges", no]

/** Charges for every order number given (de-duplicated). `billableTotal` skips orders that were already invoiced. */
export function useOrderCharges(orderNos: string[]) {
  const unique = React.useMemo(() => Array.from(new Set(orderNos.filter(Boolean))), [orderNos.join("|")]) // eslint-disable-line react-hooks/exhaustive-deps
  const results = useQueries({
    queries: unique.map((no) => ({
      queryKey: KEY(no),
      staleTime: 30 * 1000,
      queryFn: async () => {
        const res = await orderApi.getChargesByNo(no)
        return (res?.success ? res.data : null) as OrderChargesInfo | null
      },
    })),
  })
  const infoByNo: Record<string, OrderChargesInfo | null> = {}
  unique.forEach((no, i) => {
    infoByNo[no] = (results[i]?.data as OrderChargesInfo | null | undefined) ?? null
  })
  const total = unique.reduce((n, no) => n + (infoByNo[no]?.total || 0), 0)
  const billableTotal = unique.reduce((n, no) => n + (infoByNo[no] && !infoByNo[no]!.invoiced ? infoByNo[no]!.total : 0), 0)
  return { unique, infoByNo, total, billableTotal, isLoading: results.some((r) => r.isLoading) }
}

export function OrderChargesPanel({
  orderNos,
  editable = false,
  className,
}: {
  orderNos: string[]
  /** Where an order has NO charges yet, allow adding them once (e.g. Dispatch Planning). */
  editable?: boolean
  className?: string
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { unique, infoByNo, isLoading } = useOrderCharges(orderNos)
  const [drafts, setDrafts] = React.useState<Record<string, ChargeRow[]>>({})
  const [saving, setSaving] = React.useState<string | null>(null)

  const save = async (no: string) => {
    const info = infoByNo[no]
    const rows = drafts[no] || []
    if (!info) return
    if (incompleteChargeIndex(rows) !== -1) {
      toast({ title: "Finish the ledger charge", description: "Every row needs a ledger and an amount (or remove it).", variant: "destructive" })
      return
    }
    const list = validCharges(rows).map((r) => ({ ledgerId: r.ledgerId as number, amount: parseFloat(r.amount) }))
    if (list.length === 0) {
      toast({ title: "Nothing to save", description: "Add a ledger with an amount first.", variant: "destructive" })
      return
    }
    setSaving(no)
    try {
      const res = await orderApi.initCharges(info.order_id, list)
      if (res?.success) {
        toast({ title: "Ledger charges saved", description: `${no} now carries these charges.` })
        setDrafts((d) => ({ ...d, [no]: [] }))
        await queryClient.invalidateQueries({ queryKey: KEY(no) })
      } else {
        toast({ title: "Not saved", description: res?.message || "Could not save the charges.", variant: "destructive" })
      }
    } catch (e: any) {
      toast({ title: "Not saved", description: e?.message || "Could not save the charges.", variant: "destructive" })
    } finally {
      setSaving(null)
    }
  }

  if (unique.length === 0) return null
  if (isLoading && Object.values(infoByNo).every((v) => v === null)) {
    return (
      <div className={className}>
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading ledger charges…
        </p>
      </div>
    )
  }

  return (
    <div className={className}>
      {unique.map((no) => {
        const info = infoByNo[no]
        if (!info) return null
        const has = info.charges.length > 0
        if (!has && !editable) return null
        return (
          <div key={no} className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
                <Receipt className="h-3.5 w-3.5 text-blue-600" />
                Ledger Charges{unique.length > 1 ? ` · ${no}` : ""}
              </p>
              {has && info.invoiced && (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Already billed on an earlier invoice</span>
              )}
            </div>
            {has ? (
              <>
                <ul className="divide-y divide-slate-100 text-sm">
                  {info.charges.map((c) => (
                    <li key={c.id} className="flex items-center justify-between py-1.5">
                      <span className="text-slate-700">{c.ledger_name || `Ledger ${c.ledger_id}`}</span>
                      <span className="font-mono font-semibold tabular-nums text-slate-900">₹{fmtNum(Number(c.amount) || 0, 2)}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between border-t border-slate-200 pt-1.5 text-xs">
                  <span className="font-semibold text-slate-600">Charges total (counted once for this order)</span>
                  <span className="font-mono font-bold text-blue-700">₹{fmtNum(info.total, 2)}</span>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <LedgerChargesEditor rows={drafts[no] || []} onChange={(rows) => setDrafts((d) => ({ ...d, [no]: rows }))} />
                {(drafts[no] || []).length > 0 && (
                  <div className="flex justify-end">
                    <Button type="button" size="sm" className="h-8 bg-blue-600 hover:bg-blue-700" disabled={saving === no} onClick={() => save(no)}>
                      {saving === no && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save charges
                    </Button>
                  </div>
                )}
                <p className="text-[11px] text-slate-500">Once saved, these charges stay with the order and are not added again.</p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export { newChargeRow }
