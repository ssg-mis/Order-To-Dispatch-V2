"use client"
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";

import React from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Combobox } from "@/components/ui/combobox"
import { Warehouse, Package, Scale, Receipt, Info } from "lucide-react"
import { SkuSectionalHistoryTable } from "@/components/sku-sectional-history-table"
import { SkuDetail, STATUS_OPTIONS } from "@/components/masters/types"

export interface FinishedGoodsFormProps {
  editingItem: any | null
  skuDetailsForm: Partial<SkuDetail>
  setSkuDetailsForm: React.Dispatch<React.SetStateAction<Partial<SkuDetail>>>
  handleSkuFieldChangeAttempt: (
    fieldName: string,
    section: 'basic' | 'uom' | 'weights' | 'tax' | 'depots',
    applyChange: () => void
  ) => void
  setSkuHistorySection: (section: 'basic' | 'uom' | 'weights' | 'tax' | 'depots') => void
  setSkuHistoryModalOpen: (open: boolean) => void
  setSkuEffectiveDatesSection?: (section: 'basic' | 'uom' | 'weights' | 'tax' | 'depots' | null) => void
  unitOptions: any[]
  semiFinishedGoodOptions: any[]
  oilTagsList: any[]
  activeStockCategories: any[]
  activeGstRates: any[]
  activeSacCodes: any[]
  activeHsnCodes: any[]
  activeUqcCodes: any[]
  activeDepots: any[]
  openingStockByDepot: Record<string, string>
  setOpeningStockByDepot: React.Dispatch<React.SetStateAction<Record<string, string>>>
}

export function FinishedGoodsForm({
  editingItem,
  skuDetailsForm,
  setSkuDetailsForm,
  handleSkuFieldChangeAttempt,
  setSkuHistorySection,
  setSkuHistoryModalOpen,
  setSkuEffectiveDatesSection,
  unitOptions = [],
  semiFinishedGoodOptions = [],
  oilTagsList = [],
  activeStockCategories = [],
  activeGstRates = [],
  activeSacCodes = [],
  activeHsnCodes = [],
  activeUqcCodes = [],
  activeDepots = [],
  openingStockByDepot = {},
  setOpeningStockByDepot,
}: FinishedGoodsFormProps) {
  const handleOpenEffectiveDatesView = useScrollRestoration();

  const openHistoryView = (section: 'basic' | 'uom' | 'weights' | 'tax' | 'depots') => {
    if (setSkuEffectiveDatesSection) {
      setSkuEffectiveDatesSection(section)
    }
    setSkuHistorySection(section)
    setSkuHistoryModalOpen(true)
  }

  const totalOpeningQty = Object.values(openingStockByDepot).reduce(
    (sum, v) => sum + (parseFloat(v as string) || 0),
    0
  )

  return (
    <div className="space-y-5 py-2">
      {/* 1. Basic Details */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
          <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
            <Package className="h-4.5 w-4.5 text-blue-600" />
            <span>Finished Goods Basic Details</span>
          </Label>
          {editingItem?.id && (
            <SkuSectionalHistoryTable
              section="basic"
              skuId={editingItem.id}
              skuName={skuDetailsForm.sku_name}
              title="Basic Details History"
              onOpenView={handleOpenEffectiveDatesView(openHistoryView)}
            />
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="sku_code" className="text-xs font-semibold text-slate-800">
              Finished Goods Code *
            </Label>
            <Input
              id="sku_code"
              value={skuDetailsForm.sku_code || ''}
              readOnly
              className="bg-slate-100 font-mono text-xs cursor-not-allowed"
              placeholder="Auto-generated"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sku_name" className="text-xs font-semibold text-slate-800">
              Finished Goods Name *
            </Label>
            <Input
              id="sku_name"
              className="text-xs font-medium"
              value={skuDetailsForm.sku_name || ''}
              onChange={(e) => {
                const val = e.target.value
                handleSkuFieldChangeAttempt("Finished Goods Name", "basic", () =>
                  setSkuDetailsForm((prev) => ({ ...prev, sku_name: val }))
                )
              }}
              placeholder="Enter finished goods name"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="status" className="text-xs font-semibold text-slate-800">
              Status
            </Label>
            <Select
              value={skuDetailsForm.status || 'Active'}
              onValueChange={(val) =>
                handleSkuFieldChangeAttempt("Status", "basic", () =>
                  setSkuDetailsForm((prev) => ({ ...prev, status: val }))
                )
              }
            >
              <SelectTrigger className="w-full text-xs">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tag_name" className="text-xs font-semibold text-slate-800">
              Tag for Reliance
            </Label>
            <Select
              value={skuDetailsForm.tag_name || ''}
              onValueChange={(val) =>
                handleSkuFieldChangeAttempt("Tag for Reliance", "basic", () =>
                  setSkuDetailsForm((prev) => ({ ...prev, tag_name: val }))
                )
              }
            >
              <SelectTrigger id="tag_name" className="w-full text-xs">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Yes">Yes</SelectItem>
                <SelectItem value="No">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* 2. UOM & Units */}
      <div className="border-t border-slate-200 pt-4 space-y-3">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
          <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
            <Scale className="h-4.5 w-4.5 text-blue-600" />
            <span>UOM & Units</span>
          </Label>
          {editingItem?.id && (
            <SkuSectionalHistoryTable
              section="uom"
              skuId={editingItem.id}
              skuName={skuDetailsForm.sku_name}
              title="UOM & Units History"
              onOpenView={handleOpenEffectiveDatesView(openHistoryView)}
            />
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="main_uom" className="text-xs font-semibold text-slate-800">
              Main UOM
            </Label>
            <Input
              id="main_uom"
              className="text-xs font-medium"
              value={skuDetailsForm.main_uom || ''}
              onChange={(e) =>
                handleSkuFieldChangeAttempt("Main UOM", "uom", () =>
                  setSkuDetailsForm((prev) => ({ ...prev, main_uom: e.target.value }))
                )
              }
              placeholder="e.g. Box"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="alternate_uom" className="text-xs font-semibold text-slate-800">
              Alternate UOM
            </Label>
            <Input
              id="alternate_uom"
              className="text-xs font-medium"
              value={skuDetailsForm.alternate_uom || ''}
              onChange={(e) =>
                handleSkuFieldChangeAttempt("Alternate UOM", "uom", () =>
                  setSkuDetailsForm((prev) => ({ ...prev, alternate_uom: e.target.value }))
                )
              }
              placeholder="e.g. Pcs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5 min-w-0">
            <Label htmlFor="main_uom_id" className="text-xs font-semibold text-slate-800">
              Main UOM (Reference Data)
            </Label>
            <Select
              value={skuDetailsForm.main_uom_id ? String(skuDetailsForm.main_uom_id) : ''}
              onValueChange={(val) =>
                handleSkuFieldChangeAttempt("Main UOM Reference", "uom", () =>
                  setSkuDetailsForm((prev) => ({ ...prev, main_uom_id: val }))
                )
              }
            >
              <SelectTrigger className="w-full text-xs">
                <SelectValue placeholder="Select unit (optional)" />
              </SelectTrigger>
              <SelectContent>
                {unitOptions.map((u: any) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.unit_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label htmlFor="alternate_uom_id" className="text-xs font-semibold text-slate-800">
              Alternate UOM (Reference Data)
            </Label>
            <Select
              value={skuDetailsForm.alternate_uom_id ? String(skuDetailsForm.alternate_uom_id) : ''}
              onValueChange={(val) =>
                handleSkuFieldChangeAttempt("Alternate UOM Reference", "uom", () =>
                  setSkuDetailsForm((prev) => ({ ...prev, alternate_uom_id: val }))
                )
              }
            >
              <SelectTrigger className="w-full text-xs">
                <SelectValue placeholder="Select unit (optional)" />
              </SelectTrigger>
              <SelectContent>
                {unitOptions.map((u: any) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.unit_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-[11px] text-slate-500 flex items-center gap-1 -mt-1">
          <Info className="h-3 w-3 text-slate-400 shrink-0" />
          <span>The Reference Data pickers above are additive - free-text Main/Alternate UOM fields remain fully active.</span>
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="nos_per_main_uom" className="text-xs font-semibold text-slate-800">
              Nos per Main UOM
            </Label>
            <Input
              id="nos_per_main_uom"
              type="number"
              className="text-xs font-medium"
              value={skuDetailsForm.nos_per_main_uom || ''}
              onChange={(e) =>
                handleSkuFieldChangeAttempt("Nos per Main UOM", "uom", () =>
                  setSkuDetailsForm((prev) => ({ ...prev, nos_per_main_uom: e.target.value }))
                )
              }
              placeholder="0"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="units" className="text-xs font-semibold text-slate-800">
              Units
            </Label>
            <Input
              id="units"
              className="text-xs font-medium"
              value={skuDetailsForm.units || ''}
              onChange={(e) =>
                handleSkuFieldChangeAttempt("Units", "uom", () =>
                  setSkuDetailsForm((prev) => ({ ...prev, units: e.target.value }))
                )
              }
              placeholder="e.g. Kg"
            />
          </div>
        </div>
      </div>

      {/* 3. Manufacturing & Weights */}
      <div className="border-t border-slate-200 pt-4 space-y-3">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
          <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
            <Scale className="h-4.5 w-4.5 text-blue-600" />
            <span>Manufacturing & Weights</span>
          </Label>
          {editingItem?.id && (
            <SkuSectionalHistoryTable
              section="weights"
              skuId={editingItem.id}
              skuName={skuDetailsForm.sku_name}
              title="Weights & Filling History"
              onOpenView={handleOpenEffectiveDatesView(openHistoryView)}
            />
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5 min-w-0">
            <Label htmlFor="semi_finished_good_id" className="text-xs font-semibold text-slate-800">
              Semi-Finished Good (link)
            </Label>
            <Combobox
              options={semiFinishedGoodOptions.map((s: any) => ({ value: String(s.id), label: s.name }))}
              value={skuDetailsForm.semi_finished_good_id ? String(skuDetailsForm.semi_finished_good_id) : ""}
              onValueChange={(val) =>
                handleSkuFieldChangeAttempt("Semi-Finished Good", "weights", () =>
                  setSkuDetailsForm((prev) => ({ ...prev, semi_finished_good_id: val ? parseInt(val, 10) : null }))
                )
              }
              placeholder="Select Semi-Finished Good (optional)"
              searchPlaceholder="Search Semi-Finished Goods..."
            />
            <p className="text-[11px] text-slate-500 mt-1">
              When linked (nos per main UOM &gt; 1), weight fields auto-fill from this SFG on save.
            </p>
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label htmlFor="oil_tag_id" className="text-xs font-semibold text-slate-800">
              Oil Tag
            </Label>
            <Select
              value={skuDetailsForm.oil_tag_id ? String(skuDetailsForm.oil_tag_id) : ''}
              onValueChange={(val) =>
                handleSkuFieldChangeAttempt("Oil Tag", "weights", () =>
                  setSkuDetailsForm((prev) => ({ ...prev, oil_tag_id: val }))
                )
              }
            >
              <SelectTrigger className="w-full text-xs">
                <SelectValue placeholder="Select oil tag" />
              </SelectTrigger>
              <SelectContent>
                {oilTagsList
                  .filter((t: any) => t.status === "Active")
                  .map((r: any) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="oil_filling_per_unit" className="text-xs font-semibold text-slate-800">
              Oil Filling per Unit
            </Label>
            <Input
              id="oil_filling_per_unit"
              type="number"
              value={skuDetailsForm.oil_filling_per_unit || ''}
              onChange={(e) =>
                handleSkuFieldChangeAttempt("Oil Filling per Unit", "weights", () =>
                  setSkuDetailsForm((prev) => ({ ...prev, oil_filling_per_unit: e.target.value }))
                )
              }
              placeholder="0.00"
              readOnly={!!skuDetailsForm.semi_finished_good_id}
              className={`text-xs font-medium ${
                skuDetailsForm.semi_finished_good_id ? "bg-slate-100 text-slate-500 cursor-not-allowed" : ""
              }`}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filling_units" className="text-xs font-semibold text-slate-800">
              Filling Units
            </Label>
            <Input
              id="filling_units"
              value={skuDetailsForm.filling_units || ''}
              onChange={(e) =>
                handleSkuFieldChangeAttempt("Filling Units", "weights", () =>
                  setSkuDetailsForm((prev) => ({ ...prev, filling_units: e.target.value }))
                )
              }
              placeholder="e.g. Ltr"
              readOnly={!!skuDetailsForm.semi_finished_good_id}
              className={`text-xs font-medium ${
                skuDetailsForm.semi_finished_good_id ? "bg-slate-100 text-slate-500 cursor-not-allowed" : ""
              }`}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="converted_kg" className="text-xs font-semibold text-slate-800">
              Converted Kg
            </Label>
            <Input
              id="converted_kg"
              type="number"
              value={skuDetailsForm.converted_kg || ''}
              onChange={(e) =>
                handleSkuFieldChangeAttempt("Converted Kg", "weights", () =>
                  setSkuDetailsForm((prev) => ({ ...prev, converted_kg: e.target.value }))
                )
              }
              placeholder="0.00"
              readOnly={!!skuDetailsForm.semi_finished_good_id}
              className={`text-xs font-medium ${
                skuDetailsForm.semi_finished_good_id ? "bg-slate-100 text-slate-500 cursor-not-allowed" : ""
              }`}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="packing_weight_per_main_unit" className="text-xs font-semibold text-slate-800">
              Packing Weight/Main Unit
            </Label>
            <Input
              id="packing_weight_per_main_unit"
              type="number"
              value={skuDetailsForm.packing_weight_per_main_unit || ''}
              onChange={(e) =>
                handleSkuFieldChangeAttempt("Packing Weight per Main Unit", "weights", () =>
                  setSkuDetailsForm((prev) => ({ ...prev, packing_weight_per_main_unit: e.target.value }))
                )
              }
              placeholder="0.00"
              readOnly={!!skuDetailsForm.semi_finished_good_id}
              className={`text-xs font-medium ${
                skuDetailsForm.semi_finished_good_id ? "bg-slate-100 text-slate-500 cursor-not-allowed" : ""
              }`}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="weight_difference" className="text-xs font-semibold text-slate-800">
              Weight Difference
            </Label>
            <Input
              id="weight_difference"
              type="number"
              value={skuDetailsForm.weight_difference || ''}
              onChange={(e) =>
                handleSkuFieldChangeAttempt("Weight Difference", "weights", () =>
                  setSkuDetailsForm((prev) => ({ ...prev, weight_difference: e.target.value }))
                )
              }
              placeholder="0.00"
              readOnly={!!skuDetailsForm.semi_finished_good_id}
              className={`text-xs font-medium ${
                skuDetailsForm.semi_finished_good_id ? "bg-slate-100 text-slate-500 cursor-not-allowed" : ""
              }`}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sku_weight" className="text-xs font-semibold text-slate-800">
              SKU Weight
            </Label>
            <Input
              id="sku_weight"
              type="number"
              value={skuDetailsForm.sku_weight || ''}
              onChange={(e) =>
                handleSkuFieldChangeAttempt("SKU Weight", "weights", () =>
                  setSkuDetailsForm((prev) => ({ ...prev, sku_weight: e.target.value }))
                )
              }
              placeholder="0.00"
              readOnly={!!skuDetailsForm.semi_finished_good_id}
              className={`text-xs font-medium ${
                skuDetailsForm.semi_finished_good_id ? "bg-slate-100 text-slate-500 cursor-not-allowed" : ""
              }`}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="packing_weight" className="text-xs font-semibold text-slate-800">
              Packing Weight
            </Label>
            <Input
              id="packing_weight"
              type="number"
              className="text-xs font-medium"
              value={skuDetailsForm.packing_weight || ''}
              onChange={(e) =>
                handleSkuFieldChangeAttempt("Packing Weight", "weights", () =>
                  setSkuDetailsForm((prev) => ({ ...prev, packing_weight: e.target.value }))
                )
              }
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gross_weight" className="text-xs font-semibold text-slate-800">
              Gross Weight
            </Label>
            <Input
              id="gross_weight"
              type="number"
              className="text-xs font-medium"
              value={skuDetailsForm.gross_weight || ''}
              onChange={(e) =>
                handleSkuFieldChangeAttempt("Gross Weight", "weights", () =>
                  setSkuDetailsForm((prev) => ({ ...prev, gross_weight: e.target.value }))
                )
              }
              placeholder="0.00"
            />
          </div>
        </div>
        <p className="text-[11px] text-slate-500 flex items-center gap-1 -mt-1">
          <Info className="h-3 w-3 text-slate-400 shrink-0" />
          <span>Packing Weight and Gross Weight are always manually entered (not derived from linked SFG).</span>
        </p>
      </div>

      {/* 4. Tax & Classification */}
      <div className="border-t border-slate-200 pt-4 space-y-3">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
          <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
            <Receipt className="h-4.5 w-4.5 text-blue-600" />
            <span>Tax & Classification</span>
          </Label>
          {editingItem?.id && (
            <SkuSectionalHistoryTable
              section="tax"
              skuId={editingItem.id}
              skuName={skuDetailsForm.sku_name}
              title="Tax Details History"
              onOpenView={handleOpenEffectiveDatesView(openHistoryView)}
            />
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5 min-w-0">
            <Label htmlFor="stock_category_id" className="text-xs font-semibold text-slate-800">
              Stock Category
            </Label>
            <Select
              value={skuDetailsForm.stock_category_id ? String(skuDetailsForm.stock_category_id) : ''}
              onValueChange={(val) =>
                handleSkuFieldChangeAttempt("Stock Category", "tax", () =>
                  setSkuDetailsForm((prev) => ({ ...prev, stock_category_id: val }))
                )
              }
            >
              <SelectTrigger className="w-full text-xs">
                <SelectValue placeholder="Select stock category" />
              </SelectTrigger>
              <SelectContent>
                {activeStockCategories.map((r: any) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label htmlFor="type_of_supply" className="text-xs font-semibold text-slate-800">
              Type of Supply
            </Label>
            <Select
              value={skuDetailsForm.type_of_supply || ''}
              onValueChange={(val) =>
                handleSkuFieldChangeAttempt("Type of Supply", "tax", () =>
                  setSkuDetailsForm((prev) => ({ ...prev, type_of_supply: val }))
                )
              }
            >
              <SelectTrigger className="w-full text-xs">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Goods">Goods</SelectItem>
                <SelectItem value="Services">Services</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5 min-w-0">
            <Label htmlFor="gst_rate_id" className="text-xs font-semibold text-slate-800">
              GST Rate
            </Label>
            <Select
              value={skuDetailsForm.gst_rate_id ? String(skuDetailsForm.gst_rate_id) : ''}
              onValueChange={(val) =>
                handleSkuFieldChangeAttempt("GST Rate", "tax", () =>
                  setSkuDetailsForm((prev) => ({ ...prev, gst_rate_id: val }))
                )
              }
            >
              <SelectTrigger className="w-full text-xs">
                <SelectValue placeholder="Select GST rate" />
              </SelectTrigger>
              <SelectContent>
                {activeGstRates.map((r: any) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {r.rate != null ? `${r.rate}%` : r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {skuDetailsForm.type_of_supply === 'Services' ? (
            <div className="space-y-1.5 min-w-0">
              <Label htmlFor="sac_code_id" className="text-xs font-semibold text-slate-800">
                SAC Code
              </Label>
              <Select
                value={skuDetailsForm.sac_code_id ? String(skuDetailsForm.sac_code_id) : ''}
                onValueChange={(val) =>
                  handleSkuFieldChangeAttempt("SAC Code", "tax", () =>
                    setSkuDetailsForm((prev) => ({ ...prev, sac_code_id: val }))
                  )
                }
              >
                <SelectTrigger className="w-full text-xs">
                  <SelectValue placeholder="Select SAC code" />
                </SelectTrigger>
                <SelectContent>
                  {activeSacCodes.map((r: any) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.code} – {r.description || r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5 min-w-0">
              <Label htmlFor="hsn_code_id" className="text-xs font-semibold text-slate-800">
                HSN Code
              </Label>
              <Select
                value={skuDetailsForm.hsn_code_id ? String(skuDetailsForm.hsn_code_id) : ''}
                onValueChange={(val) =>
                  handleSkuFieldChangeAttempt("HSN Code", "tax", () =>
                    setSkuDetailsForm((prev) => ({ ...prev, hsn_code_id: val }))
                  )
                }
              >
                <SelectTrigger className="w-full text-xs">
                  <SelectValue placeholder="Select HSN code" />
                </SelectTrigger>
                <SelectContent>
                  {activeHsnCodes.map((r: any) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.code} – {r.description || r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5 min-w-0">
            <Label htmlFor="uqc_id" className="text-xs font-semibold text-slate-800">
              UQC – Unit Quantity Code
            </Label>
            <Select
              value={skuDetailsForm.uqc_id ? String(skuDetailsForm.uqc_id) : ''}
              onValueChange={(val) =>
                handleSkuFieldChangeAttempt("UQC", "tax", () =>
                  setSkuDetailsForm((prev) => ({ ...prev, uqc_id: val }))
                )
              }
            >
              <SelectTrigger className="w-full text-xs">
                <SelectValue placeholder="Select UQC" />
              </SelectTrigger>
              <SelectContent>
                {activeUqcCodes.map((r: any) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {r.code} – {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* 5. Opening Stock by Depot */}
      {activeDepots.length > 0 && (
        <div className="border-t border-slate-200 pt-4 space-y-3">
          <div className="pb-2 border-b border-slate-200 space-y-1.5">
            {/* Top row: Heading + W.E.F on left, Depot History button on right (Exact same line & baseline) */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label className="text-slate-900 font-bold text-base flex items-center gap-2 leading-none">
                  <Warehouse className="h-4.5 w-4.5 text-blue-600 shrink-0" />
                  <span>Opening Stock by Depot</span>
                </Label>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                  W.E.F: 01/04/2026
                </span>
              </div>

              {editingItem?.id && (
                <SkuSectionalHistoryTable
                  section="depots"
                  skuId={editingItem.id}
                  skuName={skuDetailsForm.sku_name}
                  title="Depot History"
                  onOpenView={handleOpenEffectiveDatesView(openHistoryView)}
                />
              )}
            </div>

            {/* Sub-row: Total Opening Qty positioned neatly underneath */}
            <div className="flex justify-end">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-blue-50/80 border border-blue-200/80">
                <span className="text-[11px] font-medium text-slate-600">Total Opening Qty:</span>
                <span className="text-xs font-bold text-blue-700">{totalOpeningQty.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            {activeDepots.map((depot: any) => {
              const qtyVal = openingStockByDepot[depot.depot_name] ?? ''

              return (
                <div key={depot.depot_id || depot.id} className="space-y-1.5 min-w-0">
                  <Label htmlFor={`depot_${depot.depot_id || depot.id}`} className="text-xs font-semibold text-slate-800 truncate block">
                    {depot.depot_name}
                  </Label>
                  <Input
                    id={`depot_${depot.depot_id || depot.id}`}
                    type="number"
                    className="text-xs font-medium"
                    placeholder="0"
                    min="0"
                    value={qtyVal}
                    onChange={(e) => {
                      const val = e.target.value
                      handleSkuFieldChangeAttempt(
                        `Opening Stock - ${depot.depot_name}`,
                        "depots",
                        () => setOpeningStockByDepot((prev) => ({ ...prev, [depot.depot_name]: val }))
                      )
                    }}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
