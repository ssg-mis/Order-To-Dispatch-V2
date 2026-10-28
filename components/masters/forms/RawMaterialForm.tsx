"use client"
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";

import React from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Boxes, Receipt, Landmark, Plus, X } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { STATUS_OPTIONS, RawMaterialAdditionalUom } from "../types"
import { RawMaterialSectionalHistoryTable } from "@/components/raw-material-sectional-history-table"

type RawMaterialSectionType = "basic" | "tax_compliance" | "accounting"

export interface RawMaterialFormProps {
  rawMaterialForm: any
  setRawMaterialForm: React.Dispatch<React.SetStateAction<any>>
  unitOptions: any[]
  stockGroupOptions: any[]
  activeGstRates: any[]
  activeSacCodes: any[]
  activeHsnCodes: any[]
  ledgerOptions: any[]
  openQuickAdd: (type: 'unit' | 'hsn_code' | 'sac_code' | 'ledger', callback: (id: number) => void) => void
  showAdditionalUomSection: boolean
  setShowAdditionalUomSection: (show: boolean) => void
  newAdditionalUom: { uom_id: string; conversion_ratio: string }
  setNewAdditionalUom: React.Dispatch<React.SetStateAction<{ uom_id: string; conversion_ratio: string }>>
  editingItem?: any | null
  handleRawMaterialFieldChangeAttempt?: (fieldName: string, section: RawMaterialSectionType, applyChange: () => void) => void
  setRawMaterialEffectiveDatesSection?: (section: RawMaterialSectionType | null) => void
}

export function RawMaterialForm({
  rawMaterialForm,
  setRawMaterialForm,
  unitOptions,
  stockGroupOptions,
  activeGstRates,
  activeSacCodes,
  activeHsnCodes,
  ledgerOptions,
  openQuickAdd,
  showAdditionalUomSection,
  setShowAdditionalUomSection,
  newAdditionalUom,
  setNewAdditionalUom,
  editingItem,
  handleRawMaterialFieldChangeAttempt,
  setRawMaterialEffectiveDatesSection,
}: RawMaterialFormProps) {
  const handleOpenEffectiveDatesView = useScrollRestoration();

  const { toast } = useToast()

  const attemptChange = (fieldName: string, section: RawMaterialSectionType, applyChange: () => void) => {
    if (handleRawMaterialFieldChangeAttempt) {
      handleRawMaterialFieldChangeAttempt(fieldName, section, applyChange)
    } else {
      applyChange()
    }
  }

  const SectionHeader = ({
    title,
    section,
    icon: Icon,
  }: {
    title: string
    section: RawMaterialSectionType
    icon: React.ComponentType<{ className?: string }>
  }) => (
    <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
      <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
        <Icon className="h-4.5 w-4.5 text-blue-600" />
        <span>{title}</span>
      </Label>
      {editingItem?.id && (
        <RawMaterialSectionalHistoryTable
          section={section}
          rawMaterialId={editingItem.id}
          onOpenView={handleOpenEffectiveDatesView((sec: any) => setRawMaterialEffectiveDatesSection?.(sec))}
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
            <Label htmlFor="raw_material_code" className="text-xs font-semibold text-slate-800">Raw Material Code *</Label>
            <Input id="raw_material_code" value={rawMaterialForm.raw_material_code} readOnly className="bg-slate-100 font-mono text-xs cursor-not-allowed" placeholder="Auto-generated" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs font-semibold text-slate-800">Name *</Label>
            <Input
              id="name"
              className="text-xs font-medium"
              value={rawMaterialForm.name}
              onChange={e => {
                const val = e.target.value
                attemptChange("Name", "basic", () => setRawMaterialForm((prev: any) => ({...prev, name: val})))
              }}
              placeholder="Enter raw material name"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5 min-w-0">
            <Label htmlFor="main_uom_id" className="text-xs font-semibold text-slate-800">UOM</Label>
            <div className="flex items-center gap-2">
              <Select
                value={rawMaterialForm.main_uom_id ? String(rawMaterialForm.main_uom_id) : ''}
                onValueChange={val => attemptChange("UOM", "basic", () => setRawMaterialForm((prev: any) => ({...prev, main_uom_id: val})))}
              >
                <SelectTrigger className="w-full text-xs"><SelectValue placeholder="Select UOM" /></SelectTrigger>
                <SelectContent>
                  {unitOptions.map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.short_name || u.unit_name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" size="icon" className="shrink-0 h-9 w-9" onClick={() => openQuickAdd('unit', (id) => setRawMaterialForm((prev: any) => ({ ...prev, main_uom_id: String(id) })))}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label htmlFor="stock_group_id" className="text-xs font-semibold text-slate-800">Stock Group</Label>
            <Select
              value={rawMaterialForm.stock_group_id ? String(rawMaterialForm.stock_group_id) : ''}
              onValueChange={val => attemptChange("Stock Group", "basic", () => setRawMaterialForm((prev: any) => ({...prev, stock_group_id: val})))}
            >
              <SelectTrigger className="w-full text-xs"><SelectValue placeholder="Select stock group" /></SelectTrigger>
              <SelectContent>
                {stockGroupOptions.map((g: any) => <SelectItem key={g.id} value={String(g.id)}>{g.group_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {(showAdditionalUomSection || (rawMaterialForm.additional_uoms || []).length > 0) ? (
          <div className="rounded-lg border border-slate-200 p-3.5 bg-slate-50/50 space-y-3.5">
            <p className="text-xs font-semibold text-slate-700">Additional UOM</p>
            {(rawMaterialForm.additional_uoms || []).length > 0 && (
              <div className="space-y-2">
                {(rawMaterialForm.additional_uoms || []).map((row: RawMaterialAdditionalUom, idx: number) => {
                  const uom = unitOptions.find((u: any) => String(u.id) === String(row.uom_id))
                  return (
                    <div key={idx} className="flex items-center justify-between gap-2 bg-white rounded-md px-3 py-2 text-xs border border-slate-200">
                      <span className="text-slate-700 font-medium">{uom?.short_name || uom?.unit_name || `UOM #${row.uom_id}`} — 1 = {row.conversion_ratio} base UOM</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:bg-red-50"
                        onClick={() => attemptChange("Additional UOMs", "basic", () => setRawMaterialForm((prev: any) => ({ ...prev, additional_uoms: prev.additional_uoms.filter((_: any, i: number) => i !== idx) })))}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
            {showAdditionalUomSection ? (
              <div className="bg-white rounded-lg p-3.5 border border-slate-200 space-y-3.5">
                <div className="space-y-1.5 min-w-0">
                  <Label htmlFor="new_additional_uom_id" className="text-xs font-semibold text-slate-800">Additional UOM</Label>
                  <div className="flex items-center gap-2">
                    <Select value={newAdditionalUom.uom_id} onValueChange={val => setNewAdditionalUom((prev: any) => ({...prev, uom_id: val}))}>
                      <SelectTrigger className="w-full text-xs"><SelectValue placeholder="Select UOM" /></SelectTrigger>
                      <SelectContent>
                        {unitOptions.map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.short_name || u.unit_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" size="icon" className="shrink-0 h-9 w-9" onClick={() => openQuickAdd('unit', (id) => setNewAdditionalUom(prev => ({ ...prev, uom_id: String(id) })))}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new_additional_uom_ratio" className="text-xs font-semibold text-slate-800">How many base UOM in 1 additional UOM?</Label>
                  <Input id="new_additional_uom_ratio" type="number" min={0} className="text-xs" value={newAdditionalUom.conversion_ratio} onChange={e => setNewAdditionalUom((prev: any) => ({...prev, conversion_ratio: e.target.value}))} placeholder="e.g. 10" />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => {
                    setNewAdditionalUom({ uom_id: '', conversion_ratio: '' })
                    setShowAdditionalUomSection(false)
                  }}>Cancel</Button>
                  <Button
                    type="button"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      if (!newAdditionalUom.uom_id || !newAdditionalUom.conversion_ratio) {
                        toast({ title: "Error", description: "Select a UOM and enter the conversion ratio", variant: "destructive" })
                        return
                      }
                      attemptChange("Additional UOMs", "basic", () => setRawMaterialForm((prev: any) => ({ ...prev, additional_uoms: [...(prev.additional_uoms || []), { uom_id: newAdditionalUom.uom_id, conversion_ratio: newAdditionalUom.conversion_ratio }] })))
                      setNewAdditionalUom({ uom_id: '', conversion_ratio: '' })
                      setShowAdditionalUomSection(false)
                    }}
                  >
                    Add
                  </Button>
                </div>
              </div>
            ) : (
              <Button type="button" variant="outline" size="sm" className="w-fit text-xs" onClick={() => setShowAdditionalUomSection(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Another UOM
              </Button>
            )}
          </div>
        ) : (
          <Button type="button" variant="outline" size="sm" className="w-fit text-xs" onClick={() => setShowAdditionalUomSection(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Additional UOM
          </Button>
        )}
      </div>

      {/* 2. Tax & Compliance */}
      <div className="border-t border-slate-200 pt-4 space-y-3">
        <SectionHeader title="Tax & Compliance" section="tax_compliance" icon={Receipt} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5 min-w-0">
            <Label htmlFor="type_of_supply" className="text-xs font-semibold text-slate-800">Type of Supply</Label>
            <Select
              value={rawMaterialForm.type_of_supply || ''}
              onValueChange={val => attemptChange("Type of Supply", "tax_compliance", () => setRawMaterialForm((prev: any) => ({...prev, type_of_supply: val})))}
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
            <Label htmlFor="gst_rate_id" className="text-xs font-semibold text-slate-800">GST Rate</Label>
            <Select
              value={rawMaterialForm.gst_rate_id ? String(rawMaterialForm.gst_rate_id) : ''}
              onValueChange={val => attemptChange("GST Rate", "tax_compliance", () => setRawMaterialForm((prev: any) => ({...prev, gst_rate_id: val})))}
            >
              <SelectTrigger className="w-full text-xs"><SelectValue placeholder="Select GST rate" /></SelectTrigger>
              <SelectContent>
                {activeGstRates.map((r: any) => <SelectItem key={r.id} value={String(r.id)}>{r.rate != null ? `${r.rate}%` : r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {rawMaterialForm.type_of_supply === 'Services' ? (
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center justify-between">
                <Label htmlFor="sac_code_id" className="text-xs font-semibold text-slate-800">SAC Code</Label>
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => openQuickAdd('sac_code', (id) => setRawMaterialForm((prev: any) => ({ ...prev, sac_code_id: String(id) })))}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Select
                value={rawMaterialForm.sac_code_id ? String(rawMaterialForm.sac_code_id) : ''}
                onValueChange={val => attemptChange("SAC Code", "tax_compliance", () => setRawMaterialForm((prev: any) => ({...prev, sac_code_id: val})))}
              >
                <SelectTrigger className="w-full text-xs"><SelectValue placeholder="Select SAC code" /></SelectTrigger>
                <SelectContent>
                  {activeSacCodes.map((r: any) => <SelectItem key={r.id} value={String(r.id)}>{r.code} - {r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center justify-between">
                <Label htmlFor="hsn_code_id" className="text-xs font-semibold text-slate-800">HSN Code</Label>
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => openQuickAdd('hsn_code', (id) => setRawMaterialForm((prev: any) => ({ ...prev, hsn_code_id: String(id) })))}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Select
                value={rawMaterialForm.hsn_code_id ? String(rawMaterialForm.hsn_code_id) : ''}
                onValueChange={val => attemptChange("HSN Code", "tax_compliance", () => setRawMaterialForm((prev: any) => ({...prev, hsn_code_id: val})))}
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

      {/* 3. Accounting & Settings */}
      <div className="border-t border-slate-200 pt-4 space-y-3">
        <SectionHeader title="Accounting & Settings" section="accounting" icon={Landmark} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5 min-w-0">
            <Label htmlFor="default_accounting_ledger_id" className="text-xs font-semibold text-slate-800">Default Accounting Ledger</Label>
            <div className="flex items-center gap-2">
              <Select
                value={rawMaterialForm.default_accounting_ledger_id ? String(rawMaterialForm.default_accounting_ledger_id) : ''}
                onValueChange={val => attemptChange("Default Accounting Ledger", "accounting", () => setRawMaterialForm((prev: any) => ({...prev, default_accounting_ledger_id: val})))}
              >
                <SelectTrigger className="w-full text-xs"><SelectValue placeholder="Select ledger" /></SelectTrigger>
                <SelectContent>
                  {ledgerOptions.map((l: any) => <SelectItem key={l.id} value={String(l.id)}>{l.ledger_name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" size="icon" className="shrink-0 h-9 w-9" onClick={() => openQuickAdd('ledger', (id) => setRawMaterialForm((prev: any) => ({ ...prev, default_accounting_ledger_id: String(id) })))}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label htmlFor="status" className="text-xs font-semibold text-slate-800">Status</Label>
            <Select
              value={rawMaterialForm.status}
              onValueChange={val => attemptChange("Status", "accounting", () => setRawMaterialForm((prev: any) => ({...prev, status: val})))}
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
            id="batch_tracking_enabled"
            checked={!!rawMaterialForm.batch_tracking_enabled}
            onCheckedChange={checked => attemptChange("Batch Tracking Enabled", "accounting", () => setRawMaterialForm((prev: any) => ({...prev, batch_tracking_enabled: checked === true})))}
          />
          <Label htmlFor="batch_tracking_enabled" className="cursor-pointer text-xs font-semibold text-slate-800">Enable batch tracking for this item</Label>
        </div>
      </div>
    </div>
  )
}
