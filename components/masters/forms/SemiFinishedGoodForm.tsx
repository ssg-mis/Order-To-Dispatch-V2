"use client"
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";

import React from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Boxes, Scale, Receipt, Landmark, Plus, Lock } from "lucide-react"
import { STATUS_OPTIONS } from "../types"
import { SemiFinishedGoodSectionalHistoryTable } from "@/components/semi-finished-good-sectional-history-table"
import { getWeightDecimals } from "@/lib/weight-format"

type SemiFinishedGoodSectionType = "basic" | "weight_conversion" | "tax_compliance" | "accounting"

function AutoCalculatedBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
      <Lock className="h-2.5 w-2.5" /> Auto-calculated
    </span>
  )
}

export interface SemiFinishedGoodFormProps {
  semiFinishedGoodForm: any
  setSemiFinishedGoodForm: React.Dispatch<React.SetStateAction<any>>
  unitOptions: any[]
  stockGroupOptions: any[]
  activeGstRates: any[]
  activeSacCodes: any[]
  activeHsnCodes: any[]
  ledgerOptions: any[]
  openQuickAdd: (type: 'unit' | 'hsn_code' | 'sac_code' | 'ledger', callback: (id: number) => void) => void
  editingItem?: any | null
  handleSemiFinishedGoodFieldChangeAttempt?: (fieldName: string, section: SemiFinishedGoodSectionType, applyChange: () => void) => void
  setSemiFinishedGoodEffectiveDatesSection?: (section: SemiFinishedGoodSectionType | null) => void
}

export function SemiFinishedGoodForm({
  semiFinishedGoodForm,
  setSemiFinishedGoodForm,
  unitOptions,
  stockGroupOptions,
  activeGstRates,
  activeSacCodes,
  activeHsnCodes,
  ledgerOptions,
  openQuickAdd,
  editingItem,
  handleSemiFinishedGoodFieldChangeAttempt,
  setSemiFinishedGoodEffectiveDatesSection,
}: SemiFinishedGoodFormProps) {
  const handleOpenEffectiveDatesView = useScrollRestoration();

  const attemptChange = (fieldName: string, section: SemiFinishedGoodSectionType, applyChange: () => void) => {
    if (handleSemiFinishedGoodFieldChangeAttempt) {
      handleSemiFinishedGoodFieldChangeAttempt(fieldName, section, applyChange)
    } else {
      applyChange()
    }
  }

  const setSfgFieldRecomputeWeightDiff = (fieldName: string, patch: Partial<typeof semiFinishedGoodForm>) => {
    attemptChange(fieldName, "weight_conversion", () => {
      setSemiFinishedGoodForm((prev: any) => {
        const next = { ...prev, ...patch }
        const ck = parseFloat(next.converted_kg)
        const pw = parseFloat(next.packing_weight_per_main_unit)
        next.weight_difference = !isNaN(ck) && !isNaN(pw) ? (ck - pw).toFixed(getWeightDecimals()) : ''
        return next
      })
    })
  }

  const SectionHeader = ({
    title,
    section,
    icon: Icon,
  }: {
    title: string
    section: SemiFinishedGoodSectionType
    icon: React.ComponentType<{ className?: string }>
  }) => (
    <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
      <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
        <Icon className="h-4.5 w-4.5 text-blue-600" />
        <span>{title}</span>
      </Label>
      {editingItem?.id && (
        <SemiFinishedGoodSectionalHistoryTable
          section={section}
          semiFinishedGoodId={editingItem.id}
          onOpenView={handleOpenEffectiveDatesView((sec: any) => setSemiFinishedGoodEffectiveDatesSection?.(sec))}
        />
      )}
    </div>
  )

  return (
    <div className="space-y-5 py-2">
      {/* 1. Basic Details */}
      <div className="space-y-3">
        <SectionHeader title="Basic Details" section="basic" icon={Boxes} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="semi_finished_good_code" className="text-xs font-semibold text-slate-800">SFG Code *</Label>
            <Input id="semi_finished_good_code" value={semiFinishedGoodForm.semi_finished_good_code} readOnly className="bg-slate-100 font-mono text-xs cursor-not-allowed" placeholder="Auto-generated" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sfg_name" className="text-xs font-semibold text-slate-800">Name *</Label>
            <Input
              id="sfg_name"
              className="text-xs font-medium"
              value={semiFinishedGoodForm.name}
              onChange={e => {
                const val = e.target.value
                attemptChange("Name", "basic", () => setSemiFinishedGoodForm((prev: any) => ({...prev, name: val})))
              }}
              placeholder="e.g. HK RBO 700 MLT PP (1x12)"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5 min-w-0">
            <Label htmlFor="sfg_main_uom_id" className="text-xs font-semibold text-slate-800">UOM</Label>
            <div className="flex items-center gap-2">
              <Select
                value={semiFinishedGoodForm.main_uom_id ? String(semiFinishedGoodForm.main_uom_id) : ''}
                onValueChange={val => attemptChange("UOM", "basic", () => setSemiFinishedGoodForm((prev: any) => ({...prev, main_uom_id: val})))}
              >
                <SelectTrigger className="w-full text-xs"><SelectValue placeholder="Select UOM" /></SelectTrigger>
                <SelectContent>
                  {unitOptions.map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.short_name || u.unit_name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" size="icon" className="shrink-0 h-9 w-9" onClick={() => openQuickAdd('unit', (id) => setSemiFinishedGoodForm((prev: any) => ({ ...prev, main_uom_id: String(id) })))}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label htmlFor="sfg_stock_group_id" className="text-xs font-semibold text-slate-800">Stock Group</Label>
            <Select
              value={semiFinishedGoodForm.stock_group_id ? String(semiFinishedGoodForm.stock_group_id) : ''}
              onValueChange={val => attemptChange("Stock Group", "basic", () => setSemiFinishedGoodForm((prev: any) => ({...prev, stock_group_id: val})))}
            >
              <SelectTrigger className="w-full text-xs"><SelectValue placeholder="Select stock group" /></SelectTrigger>
              <SelectContent>
                {stockGroupOptions.map((g: any) => <SelectItem key={g.id} value={String(g.id)}>{g.group_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* 2. Weight Conversion */}
      <div className="border-t border-slate-200 pt-4 space-y-3">
        <SectionHeader title="Weight Conversion" section="weight_conversion" icon={Scale} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="oil_filling_per_unit" className="text-xs font-semibold text-slate-800">Oil Filling per Unit</Label>
            <Input
              id="oil_filling_per_unit"
              type="number"
              className="text-xs font-medium"
              value={semiFinishedGoodForm.oil_filling_per_unit}
              onChange={e => {
                const val = e.target.value
                attemptChange("Oil Filling per Unit", "weight_conversion", () => setSemiFinishedGoodForm((prev: any) => ({...prev, oil_filling_per_unit: val})))
              }}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label htmlFor="filling_unit_id" className="text-xs font-semibold text-slate-800">Filling Unit</Label>
            <Select
              value={semiFinishedGoodForm.filling_unit_id ? String(semiFinishedGoodForm.filling_unit_id) : ''}
              onValueChange={val => attemptChange("Filling Unit", "weight_conversion", () => setSemiFinishedGoodForm((prev: any) => ({...prev, filling_unit_id: val})))}
            >
              <SelectTrigger className="w-full text-xs"><SelectValue placeholder="Select unit" /></SelectTrigger>
              <SelectContent>
                {unitOptions.map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.short_name || u.unit_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="converted_kg" className="text-xs font-semibold text-slate-800">Converted Kg</Label>
            <Input
              id="converted_kg"
              type="number"
              className="text-xs font-medium"
              value={semiFinishedGoodForm.converted_kg}
              onChange={e => setSfgFieldRecomputeWeightDiff("Converted Kg", { converted_kg: e.target.value })}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="packing_weight_per_main_unit" className="text-xs font-semibold text-slate-800">Packing Weight per Main Unit</Label>
            <Input
              id="packing_weight_per_main_unit"
              type="number"
              className="text-xs font-medium"
              value={semiFinishedGoodForm.packing_weight_per_main_unit}
              onChange={e => setSfgFieldRecomputeWeightDiff("Packing Weight per Main Unit", { packing_weight_per_main_unit: e.target.value })}
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5 min-w-0">
            <Label htmlFor="packing_weight_unit_id" className="text-xs font-semibold text-slate-800">Packing Weight Unit</Label>
            <Select
              value={semiFinishedGoodForm.packing_weight_unit_id ? String(semiFinishedGoodForm.packing_weight_unit_id) : ''}
              onValueChange={val => attemptChange("Packing Weight Unit", "weight_conversion", () => setSemiFinishedGoodForm((prev: any) => ({...prev, packing_weight_unit_id: val})))}
            >
              <SelectTrigger className="w-full text-xs"><SelectValue placeholder="Select unit" /></SelectTrigger>
              <SelectContent>
                {unitOptions.map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.short_name || u.unit_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="weight_difference" className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              Weight Difference
              <AutoCalculatedBadge />
            </Label>
            <Input id="weight_difference" value={semiFinishedGoodForm.weight_difference} readOnly className="bg-slate-100 text-xs font-medium cursor-not-allowed" placeholder="Auto-calculated" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="standard_weight" className="text-xs font-semibold text-slate-800">Standard Weight</Label>
            <Input
              id="standard_weight"
              type="number"
              className="text-xs font-medium"
              value={semiFinishedGoodForm.standard_weight}
              onChange={e => {
                const val = e.target.value
                attemptChange("Standard Weight", "weight_conversion", () => setSemiFinishedGoodForm((prev: any) => ({...prev, standard_weight: val})))
              }}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label htmlFor="standard_weight_unit_id" className="text-xs font-semibold text-slate-800">Standard Weight Unit</Label>
            <Select
              value={semiFinishedGoodForm.standard_weight_unit_id ? String(semiFinishedGoodForm.standard_weight_unit_id) : ''}
              onValueChange={val => attemptChange("Standard Weight Unit", "weight_conversion", () => setSemiFinishedGoodForm((prev: any) => ({...prev, standard_weight_unit_id: val})))}
            >
              <SelectTrigger className="w-full text-xs"><SelectValue placeholder="Select unit" /></SelectTrigger>
              <SelectContent>
                {unitOptions.map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.short_name || u.unit_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* 3. Tax & Compliance */}
      <div className="border-t border-slate-200 pt-4 space-y-3">
        <SectionHeader title="Tax & Compliance" section="tax_compliance" icon={Receipt} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5 min-w-0">
            <Label htmlFor="sfg_type_of_supply" className="text-xs font-semibold text-slate-800">Type of Supply</Label>
            <Select
              value={semiFinishedGoodForm.type_of_supply || ''}
              onValueChange={val => attemptChange("Type of Supply", "tax_compliance", () => setSemiFinishedGoodForm((prev: any) => ({...prev, type_of_supply: val})))}
            >
              <SelectTrigger className="w-full text-xs"><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Goods">Goods</SelectItem>
                <SelectItem value="Services">Services</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5 min-w-0">
            <Label htmlFor="sfg_gst_rate_id" className="text-xs font-semibold text-slate-800">GST Rate</Label>
            <Select
              value={semiFinishedGoodForm.gst_rate_id ? String(semiFinishedGoodForm.gst_rate_id) : ''}
              onValueChange={val => attemptChange("GST Rate", "tax_compliance", () => setSemiFinishedGoodForm((prev: any) => ({...prev, gst_rate_id: val})))}
            >
              <SelectTrigger className="w-full text-xs"><SelectValue placeholder="Select GST rate" /></SelectTrigger>
              <SelectContent>
                {activeGstRates.map((r: any) => <SelectItem key={r.id} value={String(r.id)}>{r.rate != null ? `${r.rate}%` : r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {semiFinishedGoodForm.type_of_supply === 'Services' ? (
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center justify-between">
                <Label htmlFor="sfg_sac_code_id" className="text-xs font-semibold text-slate-800">SAC Code</Label>
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => openQuickAdd('sac_code', (id) => setSemiFinishedGoodForm((prev: any) => ({ ...prev, sac_code_id: String(id) })))}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Select
                value={semiFinishedGoodForm.sac_code_id ? String(semiFinishedGoodForm.sac_code_id) : ''}
                onValueChange={val => attemptChange("SAC Code", "tax_compliance", () => setSemiFinishedGoodForm((prev: any) => ({...prev, sac_code_id: val})))}
              >
                <SelectTrigger className="w-full text-xs"><SelectValue placeholder="Select SAC code" /></SelectTrigger>
                <SelectContent>
                  {activeSacCodes.map((r: any) => <SelectItem key={r.id} value={String(r.id)}>{r.code} - {r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5 min-w-0">
              <Label htmlFor="sfg_hsn_code_id" className="text-xs font-semibold text-slate-800">HSN Code</Label>
              <Select
                value={semiFinishedGoodForm.hsn_code_id ? String(semiFinishedGoodForm.hsn_code_id) : ''}
                onValueChange={val => attemptChange("HSN Code", "tax_compliance", () => setSemiFinishedGoodForm((prev: any) => ({...prev, hsn_code_id: val})))}
              >
                <SelectTrigger className="w-full text-xs"><SelectValue placeholder="Select HSN code" /></SelectTrigger>
                <SelectContent>
                  {activeHsnCodes.map((r: any) => <SelectItem key={r.id} value={String(r.id)}>{r.code} - {r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {/* 4. Accounting & Settings */}
      <div className="border-t border-slate-200 pt-4 space-y-3">
        <SectionHeader title="Accounting & Settings" section="accounting" icon={Landmark} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5 min-w-0">
            <Label htmlFor="sfg_default_accounting_ledger_id" className="text-xs font-semibold text-slate-800">Default Accounting Ledger</Label>
            <div className="flex items-center gap-2">
              <Select
                value={semiFinishedGoodForm.default_accounting_ledger_id ? String(semiFinishedGoodForm.default_accounting_ledger_id) : ''}
                onValueChange={val => attemptChange("Default Accounting Ledger", "accounting", () => setSemiFinishedGoodForm((prev: any) => ({...prev, default_accounting_ledger_id: val})))}
              >
                <SelectTrigger className="w-full text-xs"><SelectValue placeholder="Select ledger" /></SelectTrigger>
                <SelectContent>
                  {ledgerOptions.map((l: any) => <SelectItem key={l.id} value={String(l.id)}>{l.ledger_name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" size="icon" className="shrink-0 h-9 w-9" onClick={() => openQuickAdd('ledger', (id) => setSemiFinishedGoodForm((prev: any) => ({ ...prev, default_accounting_ledger_id: String(id) })))}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label htmlFor="sfg_status" className="text-xs font-semibold text-slate-800">Status</Label>
            <Select
              value={semiFinishedGoodForm.status}
              onValueChange={val => attemptChange("Status", "accounting", () => setSemiFinishedGoodForm((prev: any) => ({...prev, status: val})))}
            >
              <SelectTrigger className="w-full text-xs"><SelectValue placeholder="Select status" /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="sfg_batch_tracking_enabled"
            checked={!!semiFinishedGoodForm.batch_tracking_enabled}
            onCheckedChange={checked => attemptChange("Batch Tracking Enabled", "accounting", () => setSemiFinishedGoodForm((prev: any) => ({...prev, batch_tracking_enabled: checked === true})))}
          />
          <Label htmlFor="sfg_batch_tracking_enabled" className="cursor-pointer text-xs font-semibold text-slate-800">Enable batch tracking for this item</Label>
        </div>
      </div>
    </div>
  )
}
