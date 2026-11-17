"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Plus, Trash2, Receipt } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AsyncCombobox } from "@/components/ui/async-combobox"
import { ledgerApi } from "@/lib/api-service"
import { fmtNum, fmtAmount } from "@/lib/table-format"

/**
 * "Add Ledger": extra taxable lines picked from the Ledgers master (e.g. Transporting Expenses),
 * entered at Order Punch and shown pre-filled at Approval of Order, where the approver can still change them.
 */
export type ChargeRow = { key: string; ledgerId?: number; ledgerName: string; amount: string }

export const newChargeRow = (): ChargeRow => ({ key: Math.random().toString(36).slice(2, 10), ledgerName: "", amount: "" })

/** Rows that will actually be saved. */
export const validCharges = (rows: ChargeRow[]) => rows.filter((r) => r.ledgerId && parseFloat(r.amount) > 0)

/** Rows with an amount but no ledger (or a ledger but no amount) - the user must finish or remove them. */
export const incompleteChargeIndex = (rows: ChargeRow[]) =>
  rows.findIndex((r) => (r.ledgerId && !(parseFloat(r.amount) > 0)) || (!r.ledgerId && (r.amount !== "" || r.ledgerName !== "")))

export const chargesTotal = (rows: ChargeRow[]) => validCharges(rows).reduce((n, r) => n + (parseFloat(r.amount) || 0), 0)

export function LedgerChargesEditor({
  rows,
  onChange,
  disabled,
}: {
  rows: ChargeRow[]
  onChange: (rows: ChargeRow[]) => void
  disabled?: boolean
}) {
  const { data: ledgers = [] } = useQuery({
    queryKey: ["ledgers-for-order-charges"],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const res = await ledgerApi.getAll({ all: "true" })
      const items = res.success ? res.data?.ledgers || (Array.isArray(res.data) ? res.data : []) : []
      return items
        .filter((l: any) => !l.status || l.status === "Active") // an Inactive ledger is not offered for new charges
        .map((l: any) => ({ id: l.id, name: l.ledger_name || l.ledgerName || l.name || "" }))
        .filter((l: any) => l.name) as { id: number; name: string }[]
    },
  })

  const patch = (key: string, p: Partial<ChargeRow>) => onChange(rows.map((r) => (r.key === key ? { ...r, ...p } : r)))

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
          <Receipt className="h-4 w-4 text-blue-600" />
          Additional Charges (Ledger)
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-slate-600">
            {validCharges(rows).length}
          </span>
        </p>
        <span className="text-[11px] text-slate-500">Taxable lines like Transporting Expenses. The approver sees them pre-filled.</span>
      </div>

      {rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.key} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_180px_40px]">
              <AsyncCombobox
                placeholder="Select ledger"
                searchPlaceholder="Search ledgers..."
                value={r.ledgerName}
                disabled={disabled}
                onValueChange={() => {}}
                onSelectOption={(opt: any) => {
                  if (opt?.original) patch(r.key, { ledgerId: opt.original.id, ledgerName: opt.original.name })
                }}
                fetchOptions={async (search: string, page: number) => {
                  const q = (search || "").toLowerCase().trim()
                  const list = ledgers.filter((l) => !q || l.name.toLowerCase().includes(q))
                  const size = 20
                  return {
                    options: list.slice((page - 1) * size, page * size).map((l) => ({ value: l.name, label: l.name, original: l })),
                    hasMore: page * size < list.length,
                  }
                }}
              />
              <Input
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                placeholder="Amount (₹)"
                disabled={disabled}
                className="text-right font-mono tabular-nums"
                value={r.amount}
                onChange={(e) => patch(r.key, { amount: e.target.value })}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled}
                className="h-9 w-9 text-slate-400 hover:bg-red-50 hover:text-red-600"
                title="Remove"
                onClick={() => onChange(rows.filter((x) => x.key !== r.key))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="h-8 gap-1.5 border-blue-200 bg-white text-blue-600 hover:bg-blue-50"
          onClick={() => onChange([...rows, newChargeRow()])}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Ledger
        </Button>
        {validCharges(rows).length > 0 && (
          <span className="text-xs text-slate-600">
            Charges total <strong className="font-mono text-blue-700">₹{fmtAmount(chargesTotal(rows), 2)}</strong>
          </span>
        )}
      </div>
    </div>
  )
}
