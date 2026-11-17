"use client"
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";

import React from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tag } from "lucide-react"
import { STATUS_OPTIONS } from "../types"
import { OilTagSectionalHistoryTable } from "@/components/oil-tag-sectional-history-table"

export interface OilTagFormProps {
  oilTagForm: any
  setOilTagForm: React.Dispatch<React.SetStateAction<any>>
  editingItem?: any | null
  handleOilTagFieldChangeAttempt?: (fieldName: string, applyChange: () => void) => void
  setOilTagEffectiveDatesOpen?: (open: boolean) => void
}

export function OilTagForm({
  oilTagForm,
  setOilTagForm,
  editingItem,
  handleOilTagFieldChangeAttempt,
  setOilTagEffectiveDatesOpen,
}: OilTagFormProps) {
  const handleOpenEffectiveDatesView = useScrollRestoration();

  const attemptChange = (fieldName: string, applyChange: () => void) => {
    if (handleOilTagFieldChangeAttempt) {
      handleOilTagFieldChangeAttempt(fieldName, applyChange)
    } else {
      applyChange()
    }
  }

  return (
    <div className="space-y-5 py-2">
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
        <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
          <Tag className="h-4.5 w-4.5 text-blue-600" />
          <span>Oil Tag Details</span>
        </Label>
        {editingItem?.id && (
          <OilTagSectionalHistoryTable
            oilTagId={editingItem.id}
            onOpenView={handleOpenEffectiveDatesView(() => setOilTagEffectiveDatesOpen?.(true))}
          />
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="ot_wef_date" className="text-xs font-semibold text-slate-800">W.E.F. Date</Label>
          <Input
            id="ot_wef_date"
            type="date"
            className="text-xs font-medium"
            value={oilTagForm.wef_date ? oilTagForm.wef_date.split('T')[0] : ""}
            onChange={e => {
              const val = e.target.value
              attemptChange("W.E.F. Date", () => setOilTagForm((prev: any) => ({ ...prev, wef_date: val })))
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ot_name" className="text-xs font-semibold text-slate-800">Oil Tag Name *</Label>
          <Input
            id="ot_name"
            className="text-xs font-medium"
            value={oilTagForm.name || ""}
            onChange={e => {
              const val = e.target.value
              attemptChange("Tag Name", () => setOilTagForm((prev: any) => ({ ...prev, name: val })))
            }}
            placeholder="e.g. Rice Bran Refined Oil"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="ot_status" className="text-xs font-semibold text-slate-800">Status</Label>
          <Select
            value={oilTagForm.status || "Active"}
            onValueChange={val => attemptChange("Status", () => setOilTagForm((prev: any) => ({ ...prev, status: val })))}
          >
            <SelectTrigger id="ot_status" className="w-full text-xs">
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
