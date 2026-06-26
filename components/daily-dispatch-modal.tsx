"use client"

import { useState } from "react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CalendarDays, Download, Loader2 } from "lucide-react"
import { reportsApi } from "@/lib/api-service"
import { generateDailyDispatchReportPdf, type DailyDispatchReport } from "@/lib/daily-dispatch-report-pdf"
import { useToast } from "@/hooks/use-toast"

export function DailyDispatchModal({ triggerClassName, open: openProp, onOpenChange, hideTrigger }: { triggerClassName?: string; open?: boolean; onOpenChange?: (o: boolean) => void; hideTrigger?: boolean } = {}) {
  const { toast } = useToast()
  const [internalOpen, setInternalOpen] = useState(false)
  const open = openProp !== undefined ? openProp : internalOpen
  const setOpen = onOpenChange || setInternalOpen
  const [date, setDate] = useState("")
  const [loading, setLoading] = useState(false)

  const generate = async () => {
    if (!date) {
      toast({ title: "Pick a date", description: "Choose the dispatch date to generate the report." })
      return
    }
    setLoading(true)
    try {
      const res = await reportsApi.getDailyDispatch({ date })
      if (!res.success || !res.data) throw new Error(res.message || "Failed to fetch report")
      const data = res.data as DailyDispatchReport
      if (!data.count) {
        toast({ title: "No dispatches", description: `No invoiced dispatches found for ${date}.` })
        return
      }
      const [y, m, d] = date.split("-")
      generateDailyDispatchReportPdf(data, `Daily CP Dispatch Report ${d}-${m}-${y}.pdf`)
      setOpen(false)
    } catch (e: any) {
      toast({ title: "Could not generate", description: e?.message || "An error occurred.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={`rounded-xl text-xs font-bold gap-1.5 hover:bg-teal-50 hover:border-teal-400 hover:text-teal-700 transition-colors ${triggerClassName || ""}`}
          >
            <CalendarDays className="h-3.5 w-3.5" /> Daily Dispatch Report
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="w-[92vw] max-w-sm p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b shrink-0" style={{ background: "oklch(0.97 0.012 245)" }}>
          <DialogTitle className="flex items-center gap-2 text-base font-black text-slate-900">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: "oklch(0.42 0.18 265 / 0.12)" }}>
              <CalendarDays className="h-4 w-4" style={{ color: "oklch(0.42 0.18 265)" }} />
            </div>
            Daily CP Dispatch Report
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-5 space-y-3">
          <p className="text-xs text-slate-500">
            Pick a dispatch (Doc) date. The report lists every invoiced dispatch billed that day, grouped by document and oil, with a day-end summary.
          </p>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Dispatch Date</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="h-10 text-sm rounded-xl border-slate-200 bg-slate-50" />
          </div>
        </div>

        <div className="px-6 py-4 border-t shrink-0 flex items-center justify-end gap-2 bg-white" style={{ borderColor: "oklch(0.90 0.025 245)" }}>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
          <Button size="sm" className="rounded-xl gap-1.5 font-bold" style={{ background: "oklch(0.42 0.18 265)" }}
            onClick={generate} disabled={loading || !date}>
            {loading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…</> : <><Download className="h-3.5 w-3.5" /> Generate</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
