"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useVehicleTareStats } from "@/hooks/use-vehicle-tare-stats"
import { fmtDate } from "@/lib/table-format"
import { fmtWeight } from "@/lib/weight-format"
import { useWeightDecimals } from "@/hooks/use-weight-decimals"

const kg = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }))

/**
 * Read-only "Avg Tare (KGS)" for the Vehicle Master Weights section. The value is a link
 * that lists the actual dispatches the average is computed from.
 */
export function VehicleAvgTareLink({ vehicleId, vehicleNo }: { vehicleId: number | string; vehicleNo?: string }) {
  const wd = useWeightDecimals()
  const kg = (n: number | null | undefined) => (n == null ? "—" : fmtWeight(n, wd))
  const [open, setOpen] = React.useState(false)

  const { data, isLoading, isError } = useVehicleTareStats(vehicleId)

  const hasTrips = !!data && data.count > 0

  return (
    <div className="space-y-1.5">
      <Label className="flex h-6 items-center text-xs font-semibold text-slate-800">Avg Tare (KGS)</Label>
      <div className="flex h-9 items-center rounded-md border border-slate-200 bg-slate-100 px-3 text-xs font-medium">
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
        ) : hasTrips ? (
          <button type="button" onClick={() => setOpen(true)} className="font-semibold text-blue-600 underline underline-offset-2 hover:text-blue-800">
            {kg(data!.avgTare)} <span className="font-normal">({data!.count} trip{data!.count > 1 ? "s" : ""})</span>
          </button>
        ) : isError ? (
          <span className="text-red-500">Could not load tare history</span>
        ) : (
          <span className="text-slate-400">No trips yet (ULW is used)</span>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto" style={{ maxWidth: "720px" }}>
          <DialogHeader>
            <DialogTitle>Average Tare Weight Trips</DialogTitle>
            <DialogDescription>
              {vehicleNo ? `${vehicleNo} · ` : ""}Average {kg(data?.avgTare)} KG over {data?.count ?? 0} dispatch(es)
            </DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Actual Dispatch Date</TableHead>
                <TableHead>Vehicle No</TableHead>
                <TableHead>RST No</TableHead>
                <TableHead className="text-center">Order Items</TableHead>
                <TableHead className="text-right">Gross Wt (KG)</TableHead>
                <TableHead className="text-right">Tare Wt (KG)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.trips || []).map((t) => (
                <TableRow key={t.dispatchId}>
                  <TableCell>{t.actualAt ? fmtDate(t.actualAt) : "—"}</TableCell>
                  <TableCell className="font-mono">{t.vehicleNo || vehicleNo || "—"}</TableCell>
                  <TableCell className="font-mono">{t.rstNo || "—"}</TableCell>
                  <TableCell className="text-center">{t.orderItems ?? 1}</TableCell>
                  <TableCell className="text-right font-mono">{kg(t.grossWeight)}</TableCell>
                  <TableCell className="text-right font-mono">{kg(t.tareWeight)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {hasTrips && (
            <div className="space-y-1 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
              <p>
                <span className="font-semibold text-slate-800">Average tare</span> = sum of tare weights ÷ trips ={" "}
                {kg((data!.trips || []).reduce((sum, t) => sum + (t.tareWeight || 0), 0))} ÷ {data!.trips.length} ={" "}
                <span className="font-semibold text-slate-900">{kg(data!.avgTare)} KG</span>
              </p>
              <p className="text-slate-400">One weighbridge reading (same RST no) split across several order items counts as a single trip.</p>
              {data!.count > data!.trips.length && (
                <p className="text-slate-400">Showing the latest {data!.trips.length} of {data!.count} trips; the average covers all {data!.count}.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
