c"use client"

import { useState } from "react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Boxes, Download, Loader2, Search } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { reportsApi } from "@/lib/api-service"
import { generateSkuCustomerWisePendingPdf, type SkuCustomer } from "@/lib/sku-customer-wise-pending-pdf"
import { useToast } from "@/hooks/use-toast"

const sanitize = (s: string) => s.replace(/[\\/:*?"<>|]/g, "").trim()

export function SkuCustomerWisePendingModal({ triggerClassName, open: openProp, onOpenChange, hideTrigger }: { triggerClassName?: string; open?: boolean; onOpenChange?: (o: boolean) => void; hideTrigger?: boolean } = {}) {
  const { toast } = useToast()
  const [internalOpen, setInternalOpen] = useState(false)
  const open = openProp !== undefined ? openProp : internalOpen
  const setOpen = onOpenChange || setInternalOpen
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const { data, isLoading } = useQuery({
    queryKey: ["pending-sauda-sku"],
    queryFn: async () => {
      const res = await reportsApi.getPendingSaudaSku()
      return res.success ? ((res.data?.customers as SkuCustomer[]) || []) : []
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  })

  const customers = data || []
  const filtered = customers.filter((c) => c.customer_name.toLowerCase().includes(search.toLowerCase()))

  const toggle = (name: string) =>
    setSelected((prev) => {
      const n = new Set(prev)
      n.has(name) ? n.delete(name) : n.add(name)
      return n
    })
  const selectAll = () => setSelected(new Set(filtered.map((c) => c.customer_name)))
  const clearAll = () => setSelected(new Set())

  const download = () => {
    const chosen = customers.filter((c) => selected.has(c.customer_name))
    if (!chosen.length) {
      toast({ title: "No customer selected", description: "Pick at least one customer to generate the report." })
      return
    }
    const filename =
      chosen.length === 1
        ? `Customer-wise CP Pending Sauda Report - ${sanitize(chosen[0].customer_name)}.pdf`
        : "Customer-wise CP Pending Sauda Report.pdf"
    generateSkuCustomerWisePendingPdf(chosen, filename)
    setSelected(new Set())
    setSearch("")
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={`rounded-xl text-xs font-bold gap-1.5 hover:bg-sky-50 hover:border-sky-400 hover:text-sky-700 transition-colors ${triggerClassName || ""}`}
          >
            <Boxes className="h-3.5 w-3.5" /> SKU &amp; Customer-wise PDF
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="w-[92vw] max-w-md p-0 gap-0 flex flex-col overflow-hidden" style={{ maxHeight: "85vh" }}>
        <DialogHeader className="px-6 py-4 border-b shrink-0" style={{ background: "oklch(0.97 0.012 245)" }}>
          <DialogTitle className="flex items-center gap-2 text-base font-black text-slate-900">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: "oklch(0.42 0.18 265 / 0.12)" }}>
              <Boxes className="h-4 w-4" style={{ color: "oklch(0.42 0.18 265)" }} />
            </div>
            SKU &amp; Customer-wise
            <span className="ml-auto text-xs font-medium text-slate-400 normal-case">{selected.size} selected</span>
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pt-4 pb-2 space-y-3 shrink-0">
          <p className="text-xs text-slate-500">
            Pick one or more customers. Each pending DO prints as a block with one row per SKU — rate, order qty, last dispatch, pending qty, order type, valid-upto, status &amp; broker.
          </p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <Input
              placeholder="Search customer…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm rounded-xl border-slate-200 bg-slate-50"
            />
          </div>
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span className="text-slate-400">{filtered.length} customer{filtered.length !== 1 ? "s" : ""} with pending saudas</span>
            <div className="flex gap-2">
              <button onClick={selectAll} className="px-2 py-1 rounded-lg hover:bg-indigo-50 text-indigo-600 transition-colors">Select all</button>
              <button onClick={clearAll} className="px-2 py-1 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">Clear</button>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-slate-400 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading customers…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm font-bold">No customers with pending saudas</div>
          ) : (
            <div className="space-y-1">
              {filtered.map((c) => {
                const isOn = selected.has(c.customer_name)
                return (
                  <label
                    key={c.customer_name}
                    className="flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors select-none"
                  >
                    <div
                      onClick={() => toggle(c.customer_name)}
                      className="flex items-center justify-center w-4 h-4 rounded border cursor-pointer shrink-0 transition-colors"
                      style={{
                        background: isOn ? "oklch(0.42 0.18 265)" : "white",
                        borderColor: isOn ? "oklch(0.42 0.18 265)" : "oklch(0.80 0.025 245)",
                      }}
                    >
                      {isOn && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <span className={`text-sm font-medium flex-1 ${isOn ? "text-slate-800" : "text-slate-600"}`}>{c.customer_name}</span>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
                      {c.sauda_count} sauda{c.sauda_count !== 1 ? "s" : ""}
                    </span>
                  </label>
                )
              })}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t shrink-0 flex items-center justify-end gap-2 bg-white" style={{ borderColor: "oklch(0.90 0.025 245)" }}>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            size="sm"
            className="rounded-xl gap-1.5 font-bold"
            style={{ background: "oklch(0.42 0.18 265)" }}
            onClick={download}
            disabled={selected.size === 0}
          >
            <Download className="h-3.5 w-3.5" /> Download PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
