"use client"

import React from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Lock, Tag } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SkuSellingPriceSectionalHistoryTable } from "@/components/sku-selling-price-sectional-history-table"

function AutoCalculatedBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
      <Lock className="h-2.5 w-2.5" /> Auto-calculated
    </span>
  )
}

export interface SkuSellingPriceFormProps {
  skuSellingPriceForm: any
  setSkuSellingPrice: React.Dispatch<React.SetStateAction<any>>
  skuDetails: any[]
  recalculateSkuSellingPrice: (form: any) => any
  editingItem?: any | null
  handleSkuSellingPriceFieldChangeAttempt?: (fieldName: string, applyChange: () => void) => void
  onOpenSkuSellingPriceHistory?: () => void
}

export function SkuSellingPriceForm({
  skuSellingPriceForm,
  setSkuSellingPrice,
  skuDetails,
  recalculateSkuSellingPrice,
  editingItem,
  handleSkuSellingPriceFieldChangeAttempt,
  onOpenSkuSellingPriceHistory,
}: SkuSellingPriceFormProps) {
  const attemptChange = (fieldName: string, applyChange: () => void) => {
    if (handleSkuSellingPriceFieldChangeAttempt) {
      handleSkuSellingPriceFieldChangeAttempt(fieldName, applyChange)
    } else {
      applyChange()
    }
  }

  return (
    <div className="space-y-5 py-2">
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
        <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
          <Tag className="h-4.5 w-4.5 text-blue-600" />
          <span>Pricing Details</span>
        </Label>
        {editingItem?.id && (
          <SkuSellingPriceSectionalHistoryTable
            skuSellingPriceId={editingItem.id}
            title="Pricing History"
            onOpenView={() => onOpenSkuSellingPriceHistory?.()}
          />
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="packing_material">Packing Material *</Label>
          <Input
            id="packing_material"
            value={skuSellingPriceForm.packing_material ?? ""}
            onChange={e => {
              const val = e.target.value;
              const matchedSku = skuDetails.find((s: any) => s.sku_name?.toLowerCase() === val.toLowerCase());
              attemptChange("Packing Material", () => {
                if (matchedSku) {
                  const updated = recalculateSkuSellingPrice({
                    ...skuSellingPriceForm,
                    packing_material: val,
                    sku_unit: matchedSku.main_uom || matchedSku.units || skuSellingPriceForm.sku_unit,
                    sku_weight: matchedSku.sku_weight || skuSellingPriceForm.sku_weight,
                    conversion_formula: matchedSku.nos_per_main_uom || skuSellingPriceForm.conversion_formula,
                    sku_weight_in_gm: matchedSku.converted_kg ? (parseFloat(matchedSku.converted_kg) * 1000) : (matchedSku.oil_filling_per_unit || skuSellingPriceForm.sku_weight_in_gm),
                    packing_material_weight_in_gm: matchedSku.packing_weight_per_main_unit || matchedSku.packing_weight || skuSellingPriceForm.packing_material_weight_in_gm
                  });
                  setSkuSellingPrice(updated);
                } else {
                  setSkuSellingPrice({ ...skuSellingPriceForm, packing_material: val });
                }
              })
            }}
            placeholder="Enter or select material name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sku_unit">SKU Unit</Label>
          <Input
            id="sku_unit"
            value={skuSellingPriceForm.sku_unit ?? ""}
            onChange={e => {
              const val = e.target.value
              attemptChange("SKU Unit", () => setSkuSellingPrice({ ...skuSellingPriceForm, sku_unit: val }))
            }}
            placeholder="e.g. Ltr"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select
            value={skuSellingPriceForm.status || "Active"}
            onValueChange={(val: string) => {
              attemptChange("Status", () => setSkuSellingPrice({ ...skuSellingPriceForm, status: val }))
            }}
          >
            <SelectTrigger id="status" className="w-full">
              <SelectValue placeholder="Select Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sku_weight_sp">SKU Weight</Label>
          <Input
            id="sku_weight_sp"
            type="number"
            value={skuSellingPriceForm.sku_weight ?? ""}
            onChange={e => {
              const val = e.target.value
              attemptChange("SKU Weight", () => setSkuSellingPrice({ ...skuSellingPriceForm, sku_weight: val }))
            }}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="conversion_formula">Conversion Formula</Label>
          <Input
            id="conversion_formula"
            type="number"
            value={skuSellingPriceForm.conversion_formula ?? ""}
            onChange={e => {
              const val = e.target.value
              attemptChange("Conversion Formula", () => setSkuSellingPrice({ ...skuSellingPriceForm, conversion_formula: val }))
            }}
            placeholder="0.00"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sku_weight_in_gm">SKU Weight (gm)</Label>
          <Input
            id="sku_weight_in_gm"
            type="number"
            value={skuSellingPriceForm.sku_weight_in_gm ?? ""}
            onChange={e => {
              const val = e.target.value
              attemptChange("SKU Weight (gm)", () => {
                const updated = recalculateSkuSellingPrice({
                  ...skuSellingPriceForm,
                  sku_weight_in_gm: val
                });
                setSkuSellingPrice(updated);
              })
            }}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="packing_material_weight_in_gm">Packing Mat. Wt (gm)</Label>
          <Input
            id="packing_material_weight_in_gm"
            type="number"
            value={skuSellingPriceForm.packing_material_weight_in_gm ?? ""}
            onChange={e => {
              const val = e.target.value
              attemptChange("Packing Material Weight (gm)", () => {
                const updated = recalculateSkuSellingPrice({
                  ...skuSellingPriceForm,
                  packing_material_weight_in_gm: val
                });
                setSkuSellingPrice(updated);
              })
            }}
            placeholder="0.00"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="net_oil_in_gm" className="flex items-center gap-1.5">
            Net Oil (gm)
            <AutoCalculatedBadge />
          </Label>
          <Input
            id="net_oil_in_gm"
            type="number"
            value={skuSellingPriceForm.net_oil_in_gm ?? ""}
            readOnly
            className="bg-slate-100 font-semibold cursor-not-allowed"
            placeholder="Auto-calculated"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="packing_cost">Packing Cost</Label>
          <Input
            id="packing_cost"
            type="number"
            value={skuSellingPriceForm.packing_cost ?? ""}
            onChange={e => {
              const val = e.target.value
              attemptChange("Packing Cost", () => {
                const updated = recalculateSkuSellingPrice({
                  ...skuSellingPriceForm,
                  packing_cost: val
                });
                setSkuSellingPrice(updated);
              })
            }}
            placeholder="0.00"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="var">Var</Label>
          <Input
            id="var"
            value={skuSellingPriceForm.var ?? ""}
            onChange={e => {
              const val = e.target.value
              attemptChange("Var", () => setSkuSellingPrice({ ...skuSellingPriceForm, var: val }))
            }}
            placeholder="e.g. 1"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="margin">Margin</Label>
          <Input
            id="margin"
            value={skuSellingPriceForm.margin ?? ""}
            onChange={e => {
              const val = e.target.value
              attemptChange("Margin", () => {
                const updated = recalculateSkuSellingPrice({
                  ...skuSellingPriceForm,
                  margin: val
                });
                setSkuSellingPrice(updated);
              })
            }}
            placeholder="e.g. 10%"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t pt-3">
        <div className="space-y-2">
          <Label htmlFor="landing_cost_display" className="flex items-center gap-1.5">
            Landing Cost
            <AutoCalculatedBadge />
          </Label>
          <Input
            id="landing_cost_display"
            type="number"
            value={skuSellingPriceForm.landing_cost ?? ""}
            readOnly
            className="bg-slate-100 font-semibold text-slate-700 cursor-not-allowed"
            placeholder="Auto"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="actual_margin" className="flex items-center gap-1.5">
            Actual Margin
            <AutoCalculatedBadge />
          </Label>
          <Input
            id="actual_margin"
            type="number"
            value={skuSellingPriceForm.actual_margin ?? ""}
            readOnly
            className="bg-slate-100 font-semibold text-emerald-700 cursor-not-allowed"
            placeholder="Auto"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="selling_cost">Selling Cost</Label>
          <Input
            id="selling_cost"
            type="number"
            value={skuSellingPriceForm.selling_cost ?? ""}
            onChange={e => {
              const val = e.target.value
              attemptChange("Selling Cost", () => setSkuSellingPrice({ ...skuSellingPriceForm, selling_cost: val }))
            }}
            className="font-bold text-blue-700"
            placeholder="Auto / Custom"
          />
        </div>
      </div>
    </div>
  )
}
