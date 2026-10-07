"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { unloadingApi } from "@/lib/api-service"
import { LOSS_CAUSES, BORNE_BY_LABEL, BORNE_BY_STYLE, type BorneBy } from "@/lib/loss-causes"
import { fmtNum, fmtDate } from "@/lib/table-format"
import { Loader2, CheckCircle, XCircle, ImageIcon } from "lucide-react"

const PARTIES: BorneBy[] = ["company", "transporter", "customer"]
const fmt = (n: any) => fmtNum(n || 0, 2)

/**
 * Company Admin sign-off on losses reported at Unloading. Approving lets the loss
 * flow into inventory ("Damages due to Transit") and queues Damage Adjustment;
 * rejecting sends the shipment back to be re-reported.
 */
export function LossApprovalsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [busyId, setBusyId] = useState<number | null>(null)
  const [rejectingId, setRejectingId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  // per unloading: { shortage?: party, containers: { [containerId]: party } }
  const [overrides, setOverrides] = useState<Record<number, { shortage?: BorneBy; containers: Record<number, BorneBy> }>>({})

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["unloading-approvals"],
    queryFn: async () => {
      const res = await unloadingApi.getApprovals({ page: 1, limit: 50 })
      return res.success ? res.data : { orders: [], pagination: { total: 0 } }
    },
    enabled: open,
  })
  const rows: any[] = data?.orders || []

  const review = async (row: any, decision: "approve" | "reject") => {
    if (decision === "reject" && !rejectReason.trim()) {
      toast({ title: "Reason required", description: "Enter why the loss report is being rejected.", variant: "destructive" })
      return
    }
    const ov = overrides[row.id]
    setBusyId(row.id)
    try {
      const res = await unloadingApi.review(row.id, {
        decision,
        remarks: decision === "reject" ? rejectReason.trim() : undefined,
        shortageBorneBy: ov?.shortage,
        containerBorneBy: ov?.containers && Object.keys(ov.containers).length ? ov.containers : undefined,
      })
      if (!res.success) throw new Error(res.message || "Failed")
      toast({ title: decision === "approve" ? "Loss approved" : "Loss rejected", description: res.message })
      setRejectingId(null)
      setRejectReason("")
      await refetch()
      queryClient.invalidateQueries({ queryKey: ["pending-unloading"] })
      queryClient.invalidateQueries({ queryKey: ["inventory-data"] })
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Could not save the decision", variant: "destructive" })
    } finally {
      setBusyId(null)
    }
  }

  const PartyBadge = ({ party }: { party: BorneBy }) => (
    <Badge className={`${BORNE_BY_STYLE[party]} text-[10px] font-black`}>{BORNE_BY_LABEL[party]}</Badge>
  )

  const PartySelect = ({ value, onChange }: { value: BorneBy; onChange: (p: BorneBy) => void }) => (
    <Select value={value} onValueChange={(v) => onChange(v as BorneBy)}>
      <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>{PARTIES.map(p => <SelectItem key={p} value={p}>{BORNE_BY_LABEL[p]}</SelectItem>)}</SelectContent>
    </Select>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-0.75rem)] max-w-[calc(100vw-0.75rem)] sm:!max-w-[90vw] max-h-[92vh] overflow-y-auto p-0 [overflow-wrap:anywhere]">
        <div className="p-4 sm:p-6">
          <DialogHeader className="pr-8">
            <DialogTitle className="text-lg sm:text-xl font-bold text-slate-900 border-b pb-4 mb-2 leading-tight">
              Loss Approvals ({data?.pagination?.total ?? 0} pending)
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              Approve to include the loss in inventory and queue Damage Adjustment. You can change who bears a loss before approving.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">No losses awaiting approval</div>
          ) : (
            <div className="mt-4 space-y-5">
              {rows.map((row) => {
                const ul = row.id
                const containers: any[] = row.damaged_containers || []
                const shortage = Number(row.shortage_qty) || 0
                const shortageParty = (overrides[ul]?.shortage || row.shortage_borne_by) as BorneBy | undefined
                const photos: string[] = Array.isArray(row.damage_photos) ? row.damage_photos : []
                return (
                  <div key={ul} className="rounded-lg border border-slate-200 p-4 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-black text-blue-700">{row.so_no} <span className="text-slate-400 font-medium">· {row.invoice_no || "No invoice"}</span></p>
                        <p className="text-sm font-medium text-slate-700">{row.party_name}</p>
                        <p className="text-xs text-slate-500">{row.product_name} · Dispatched qty: <span className="font-mono tabular-nums">{fmtNum(row.actual_qty_dispatch || 0, 4)}</span> · Received: <span className="font-mono tabular-nums">{fmtDate(row.received_date)}</span></p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total loss (₹)</p>
                        <p className="text-lg font-black font-mono tabular-nums text-red-600">{fmt(row.total_loss_value)}</p>
                        <p className="text-xs text-slate-500">Loss qty (units): <span className="font-mono tabular-nums">{fmtNum(row.total_loss_qty || 0, 4)}</span></p>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      {shortage > 0 && shortageParty && (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2">
                          <span>Shortage qty: <b className="font-mono tabular-nums">{fmtNum(shortage, 4)}</b> — {LOSS_CAUSES[row.shortage_cause]?.label || row.shortage_cause}</span>
                          <PartySelect value={shortageParty} onChange={(p) => setOverrides(o => ({ ...o, [ul]: { containers: o[ul]?.containers || {}, shortage: p } }))} />
                        </div>
                      )}
                      {containers.map((c: any) => {
                        const party = (overrides[ul]?.containers?.[c.id] || c.borneBy) as BorneBy
                        return (
                          <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2">
                            <span className="min-w-0">
                              <b>{c.containerSerialNumber}</b> — {c.damageType === "whole" ? "whole container" : `${c.items?.length || 0} internal item(s)`} — {LOSS_CAUSES[c.cause]?.label || c.cause}
                              <span className="ml-2 text-slate-500">Loss (₹): <span className="font-mono tabular-nums">{fmt(c.lossValue)}</span></span>
                            </span>
                            <span className="flex items-center gap-2">
                              {party && <PartyBadge party={party} />}
                              <PartySelect value={party} onChange={(p) => setOverrides(o => ({ ...o, [ul]: { ...o[ul], containers: { ...(o[ul]?.containers || {}), [c.id]: p } } }))} />
                            </span>
                          </div>
                        )
                      })}
                    </div>

                    {(photos.length > 0 || row.received_proof) && (
                      <div className="flex flex-wrap gap-3 text-xs">
                        {photos.map((url, i) => (
                          <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                            <ImageIcon className="h-3.5 w-3.5" /> Damage photo {i + 1}
                          </a>
                        ))}
                        {row.received_proof && (
                          <a href={row.received_proof} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                            <ImageIcon className="h-3.5 w-3.5" /> Received proof
                          </a>
                        )}
                      </div>
                    )}

                    {rejectingId === ul ? (
                      <div className="space-y-2 border-t pt-3">
                        <Textarea placeholder="Reason for rejection (sent back to be re-reported)…" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => { setRejectingId(null); setRejectReason("") }} disabled={busyId === ul}>Cancel</Button>
                          <Button size="sm" variant="destructive" onClick={() => review(row, "reject")} disabled={busyId === ul}>
                            {busyId === ul ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Reject"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2 border-t pt-3">
                        <Button variant="outline" size="sm" className="border-red-200 text-red-600 hover:bg-red-50" onClick={() => setRejectingId(ul)} disabled={busyId === ul}>
                          <XCircle className="mr-1.5 h-4 w-4" /> Reject
                        </Button>
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => review(row, "approve")} disabled={busyId === ul}>
                          {busyId === ul ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-1.5 h-4 w-4" />} Approve
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
