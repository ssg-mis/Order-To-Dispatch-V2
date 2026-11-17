"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, History, Loader2, User, XCircle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { masterHistoryApi } from "@/lib/api-service"
import { useToast } from "@/hooks/use-toast"

interface PendingGroup {
  groupKey: string
  masterType: string | null
  recordId: number | null
  requestedByName: string
  requestedAt: string
  items: { id: number; kind: string; summary: string }[]
}

const fmtDateTime = (v: string) =>
  new Date(v)
    .toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    .replace(",", "")

/**
 * Admin-only: history changes (add / edit / delete of a history version) made by non-admins wait here.
 * Approve = the change is applied (history + master), with the admin recorded as approver. Reject = nothing changes.
 */
export function HistoryApprovalsDialog({ masterLabels }: { masterLabels?: Record<string, { label: string }> }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [rejecting, setRejecting] = React.useState<string | null>(null)
  const [reason, setReason] = React.useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["history-change-requests"],
    queryFn: async () => {
      const res = await masterHistoryApi.getPendingRequests()
      return res.success ? ((res.data as PendingGroup[]) || []) : []
    },
    refetchInterval: 60 * 1000,
  })
  const groups: PendingGroup[] = data || []

  const review = useMutation({
    mutationFn: (vars: { groupKey: string; action: "approve" | "reject"; reason?: string }) =>
      masterHistoryApi.reviewRequest(vars.groupKey, vars.action, vars.reason),
    onSuccess: (res: any) => {
      toast({ title: res?.message || "Done" })
      setRejecting(null)
      setReason("")
      queryClient.invalidateQueries({ queryKey: ["history-change-requests"] })
      queryClient.invalidateQueries() // history / master data may have changed
    },
    onError: (err: any) => {
      toast({ title: "Could not review", description: err?.message || "Failed", variant: "destructive" })
    },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-12 gap-2 rounded-xl border-slate-200 bg-white px-4 shadow-sm">
          <History className="h-4 w-4 text-blue-600" />
          History Approvals
          {groups.length > 0 && (
            <Badge className="h-5 min-w-5 rounded-full bg-amber-500 px-1.5 text-[10px] text-white hover:bg-amber-500">
              {groups.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>History Approvals</DialogTitle>
          <DialogDescription>
            Add / edit / delete changes to a master&apos;s history table made by non-admin users. Nothing is applied until
            you approve.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : groups.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">No history changes are waiting for approval.</p>
        ) : (
          <div className="space-y-3">
            {groups.map((g) => (
              <div key={g.groupKey} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <Badge variant="outline" className="bg-slate-50 text-slate-600">
                      {(g.masterType && masterLabels?.[g.masterType]?.label) || g.masterType || "Master"}
                    </Badge>
                    {g.recordId != null && <span className="text-xs font-normal text-slate-500">Record #{g.recordId}</span>}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <User className="h-3 w-3" />
                    {g.requestedByName} · {fmtDateTime(g.requestedAt)}
                  </div>
                </div>

                <ul className="mt-2 space-y-1 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700">
                  {g.items.map((it) => (
                    <li key={it.id} className="flex gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                      <span className="break-words">{it.summary}</span>
                    </li>
                  ))}
                </ul>

                {rejecting === g.groupKey ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Reason for rejecting (optional)"
                      className="h-8 max-w-xs flex-1 text-xs"
                    />
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={review.isPending}
                      onClick={() => review.mutate({ groupKey: g.groupKey, action: "reject", reason })}
                    >
                      Confirm Reject
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setRejecting(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="mt-3 flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700"
                      disabled={review.isPending}
                      onClick={() => {
                        setRejecting(g.groupKey)
                        setReason("")
                      }}
                    >
                      <XCircle className="h-3.5 w-3.5" /> Reject
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                      disabled={review.isPending}
                      onClick={() => review.mutate({ groupKey: g.groupKey, action: "approve" })}
                    >
                      {review.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      Approve
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
