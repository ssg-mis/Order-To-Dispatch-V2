"use client"

import React from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Route } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { depotApi, transportMasterApi } from "@/lib/api-service"
import { STATUS_OPTIONS } from "../types"
import { BhadaRateSectionalHistoryTable } from "@/components/bhada-rate-sectional-history-table"

export interface BhadaRateFormProps {
  bhadaRateForm: any
  setBhadaRateForm: React.Dispatch<React.SetStateAction<any>>
  editingItem?: any | null
  handleBhadaRateFieldChangeAttempt?: (fieldName: string, applyChange: () => void) => void
  setBhadaRateEffectiveDatesOpen?: (open: boolean) => void
}

export function BhadaRateForm({
  bhadaRateForm,
  setBhadaRateForm,
  editingItem,
  handleBhadaRateFieldChangeAttempt,
  setBhadaRateEffectiveDatesOpen,
}: BhadaRateFormProps) {
  const attemptChange = (fieldName: string, applyChange: () => void) => {
    if (handleBhadaRateFieldChangeAttempt) {
      handleBhadaRateFieldChangeAttempt(fieldName, applyChange)
    } else {
      applyChange()
    }
  }

  // Where the rate applies (all optional): from-depot and transporter come from their masters
  const { data: depots = [] } = useQuery({
    queryKey: ["bhada-form-depots"],
    queryFn: async () => {
      const res = await depotApi.getAll({ all: "true" })
      return res.success ? (res.data?.depots || []) : []
    },
  })
  const { data: transporters = [] } = useQuery({
    queryKey: ["bhada-form-transporters"],
    queryFn: async () => {
      const res = await transportMasterApi.getAll({ all: "true" })
      return res.success ? (res.data?.transporters || []) : []
    },
  })
  const NONE = "__any__"

  return (
    <div className="space-y-5 py-2">
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
        <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
          <Route className="h-4.5 w-4.5 text-blue-600" />
          <span>Bhada Rate Details</span>
        </Label>
        {editingItem?.id && (
          <BhadaRateSectionalHistoryTable
            bhadaRateId={editingItem.id}
            onOpenView={() => setBhadaRateEffectiveDatesOpen?.(true)}
          />
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="br_code" className="text-xs font-semibold text-slate-800">Bhada Rate Code *</Label>
          <Input
            id="br_code"
            value={bhadaRateForm.bhada_rate_code || ""}
            readOnly
            className="bg-slate-100 font-mono text-xs cursor-not-allowed"
            placeholder="Auto-generated"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="br_wef_date" className="text-xs font-semibold text-slate-800">W.E.F. Date</Label>
          <Input
            id="br_wef_date"
            type="date"
            className="text-xs font-medium"
            value={bhadaRateForm.wef_date ? bhadaRateForm.wef_date.split('T')[0] : ""}
            onChange={e => {
              const val = e.target.value
              attemptChange("W.E.F. Date", () => setBhadaRateForm((prev: any) => ({ ...prev, wef_date: val })))
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="br_name" className="text-xs font-semibold text-slate-800">Bhada Rate Name / Route *</Label>
          <Input
            id="br_name"
            className="text-xs font-medium"
            value={bhadaRateForm.name || ""}
            onChange={e => {
              const val = e.target.value
              attemptChange("Bhada Rate Name", () => setBhadaRateForm((prev: any) => ({ ...prev, name: val })))
            }}
            placeholder="e.g. Raipur to Bilaspur Route"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="br_rate" className="text-xs font-semibold text-slate-800">Rate (₹)</Label>
          <Input
            id="br_rate"
            type="number"
            step="0.01"
            className="text-xs font-medium"
            value={bhadaRateForm.rate ?? ""}
            onChange={e => {
              const val = e.target.value
              attemptChange("Rate", () => setBhadaRateForm((prev: any) => ({ ...prev, rate: val })))
            }}
            placeholder="e.g. 1500.00"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="br_rate_type" className="text-xs font-semibold text-slate-800">Rate Type</Label>
          <Select
            value={bhadaRateForm.rate_type || "Bhada Rate"}
            onValueChange={val => attemptChange("Rate Type", () => setBhadaRateForm((prev: any) => ({ ...prev, rate_type: val })))}
          >
            <SelectTrigger id="br_rate_type" className="w-full text-xs">
              <SelectValue placeholder="Select rate type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Bhada Rate">Bhada Rate (₹ per MT)</SelectItem>
              <SelectItem value="Fixed Bhada">Fixed Bhada (₹ per trip)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="br_destination" className="text-xs font-semibold text-slate-800">Destination</Label>
          <Input
            id="br_destination"
            className="text-xs font-medium"
            value={bhadaRateForm.destination || ""}
            onChange={e => {
              const val = e.target.value
              attemptChange("Destination", () => setBhadaRateForm((prev: any) => ({ ...prev, destination: val })))
            }}
            placeholder="Town / district / state in the delivery address (optional)"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="br_depot" className="text-xs font-semibold text-slate-800">From Depot</Label>
          <Select
            value={bhadaRateForm.depot_id ? String(bhadaRateForm.depot_id) : NONE}
            onValueChange={val => attemptChange("From Depot", () => setBhadaRateForm((prev: any) => ({ ...prev, depot_id: val === NONE ? null : Number(val) })))}
          >
            <SelectTrigger id="br_depot" className="w-full text-xs">
              <SelectValue placeholder="Any depot" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Any depot</SelectItem>
              {depots.map((d: any) => (
                <SelectItem key={d.id} value={String(d.id)}>{d.depot_name || d.depotName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="br_transporter" className="text-xs font-semibold text-slate-800">Transporter</Label>
          <Select
            value={bhadaRateForm.transporter_id ? String(bhadaRateForm.transporter_id) : NONE}
            onValueChange={val => attemptChange("Transporter", () => setBhadaRateForm((prev: any) => ({ ...prev, transporter_id: val === NONE ? null : Number(val) })))}
          >
            <SelectTrigger id="br_transporter" className="w-full text-xs">
              <SelectValue placeholder="Any transporter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Any transporter</SelectItem>
              {transporters.map((t: any) => (
                <SelectItem key={t.id} value={String(t.id)}>{t.transporter_name || t.transporterName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-[11px] text-slate-500 -mt-2">
        Leave a field empty to match anything. When a transport bill is made, the most specific matching rate in force on the dispatch date is shown as its Planned Bhada Rate.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="br_status" className="text-xs font-semibold text-slate-800">Status</Label>
          <Select
            value={bhadaRateForm.status || "Active"}
            onValueChange={val => attemptChange("Status", () => setBhadaRateForm((prev: any) => ({ ...prev, status: val })))}
          >
            <SelectTrigger id="br_status" className="w-full text-xs">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(opt => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
