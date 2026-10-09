"use client"
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";

import React from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileText, IndianRupee, Plus, X } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { STATUS_OPTIONS } from "../types"
import { PriceLevelSectionalHistoryTable } from "@/components/price-level-sectional-history-table"

export interface PriceLevelFormProps {
  priceLevelForm: any
  setPriceLevelForm: React.Dispatch<React.SetStateAction<any>>
  skuOptions: any[]
  newPriceLevelItem: { sku_id: string; price: string }
  setNewPriceLevelItem: React.Dispatch<React.SetStateAction<{ sku_id: string; price: string }>>
  editingItem?: any | null
  handlePriceLevelFieldChangeAttempt?: (
    fieldName: string,
    section: 'header' | 'items',
    applyChange: () => void
  ) => void
  setPriceLevelEffectiveDatesSection?: (section: 'header' | 'items' | null) => void
}

export function PriceLevelForm({
  priceLevelForm,
  setPriceLevelForm,
  skuOptions,
  newPriceLevelItem,
  setNewPriceLevelItem,
  editingItem,
  handlePriceLevelFieldChangeAttempt,
  setPriceLevelEffectiveDatesSection,
}: PriceLevelFormProps) {
  const handleOpenEffectiveDatesView = useScrollRestoration();

  const { toast } = useToast()

  const attemptChange = (fieldName: string, section: 'header' | 'items', applyChange: () => void) => {
    if (handlePriceLevelFieldChangeAttempt) {
      handlePriceLevelFieldChangeAttempt(fieldName, section, applyChange)
    } else {
      applyChange()
    }
  }

  return (
    <div className="space-y-5 py-2">
      {/* 1. Header Details */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
          <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
            <FileText className="h-4.5 w-4.5 text-blue-600" />
            <span>Header Details</span>
          </Label>
          {editingItem?.id && (
            <PriceLevelSectionalHistoryTable
              section="header"
              priceLevelId={editingItem.id}
              title="Header Details History"
              onOpenView={handleOpenEffectiveDatesView((section) => setPriceLevelEffectiveDatesSection?.(section))}
            />
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="price_level_code" className="text-xs font-semibold text-slate-800">Price Level Code *</Label>
            <Input id="price_level_code" value={priceLevelForm.price_level_code} readOnly className="bg-slate-100 font-mono text-xs cursor-not-allowed" placeholder="Auto-generated" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="effective_date" className="text-xs font-semibold text-slate-800">Effective Date *</Label>
            <Input
              id="effective_date"
              type="date"
              className="text-xs font-medium"
              value={priceLevelForm.effective_date?.split('T')[0] || ''}
              onChange={e => {
                const val = e.target.value
                attemptChange("Effective Date", "header", () => setPriceLevelForm((prev: any) => ({...prev, effective_date: val})))
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5 min-w-0">
            <Label htmlFor="pl_status" className="text-xs font-semibold text-slate-800">Status</Label>
            <Select
              value={priceLevelForm.status}
              onValueChange={val =>
                attemptChange("Status", "header", () => setPriceLevelForm((prev: any) => ({...prev, status: val})))
              }
            >
              <SelectTrigger className="w-full text-xs"><SelectValue placeholder="Select status" /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* 2. Finished Goods Prices */}
      <div className="border-t border-slate-200 pt-4 space-y-3">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
          <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
            <IndianRupee className="h-4.5 w-4.5 text-blue-600" />
            <span>Finished Goods Prices</span>
          </Label>
          {editingItem?.id && (
            <PriceLevelSectionalHistoryTable
              section="items"
              priceLevelId={editingItem.id}
              title="Price Items History"
              onOpenView={handleOpenEffectiveDatesView((section) => setPriceLevelEffectiveDatesSection?.(section))}
            />
          )}
        </div>

        {(priceLevelForm.items || []).length > 0 && (
          <div className="space-y-2">
            {(priceLevelForm.items || []).map((it: any, idx: number) => {
              const sku = skuOptions.find((s: any) => String(s.id) === String(it.sku_id))
              const skuName = sku?.sku_name || `SKU #${it.sku_id}`
              return (
                <div key={idx} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs">
                  <span className="flex-1 min-w-0 truncate text-slate-700 font-medium">{skuName}</span>
                  <span className="text-slate-500">₹</span>
                  <Input
                    type="number"
                    min={0}
                    className="h-8 w-28 text-xs"
                    value={it.price}
                    onChange={e => {
                      const val = e.target.value
                      attemptChange(`Price - ${skuName}`, "items", () =>
                        setPriceLevelForm((prev: any) => ({
                          ...prev,
                          items: prev.items.map((row: any, i: number) => (i === idx ? { ...row, price: val } : row)),
                        }))
                      )
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:bg-red-50"
                    onClick={() => attemptChange(`Price - ${skuName}`, "items", () => setPriceLevelForm((prev: any) => ({ ...prev, items: prev.items.filter((_: any, i: number) => i !== idx) })))}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}

        <div className="rounded-lg border border-slate-200 p-3.5 bg-slate-50/50 space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5 min-w-0">
              <Label className="text-xs font-semibold text-slate-800">Finished Good</Label>
              <Select
                value={newPriceLevelItem.sku_id}
                onValueChange={val => attemptChange("Finished Good", "items", () => setNewPriceLevelItem((prev: any) => ({...prev, sku_id: val})))}
              >
                <SelectTrigger className="w-full text-xs bg-white"><SelectValue placeholder="Select Finished Good" /></SelectTrigger>
                <SelectContent>
                  {skuOptions.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.sku_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-800">Price (₹)</Label>
              <Input
                type="number"
                min={0}
                className="text-xs bg-white"
                value={newPriceLevelItem.price}
                onChange={e => {
                  const val = e.target.value
                  const draftSku = skuOptions.find((s: any) => String(s.id) === String(newPriceLevelItem.sku_id))
                  const fieldLabel = draftSku ? `Price - ${draftSku.sku_name}` : "Price"
                  attemptChange(fieldLabel, "items", () => setNewPriceLevelItem((prev: any) => ({...prev, price: val})))
                }}
                placeholder="e.g. 120.50"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              className="text-xs"
              onClick={() => {
                if (!newPriceLevelItem.sku_id || !newPriceLevelItem.price) {
                  toast({ title: "Error", description: "Select a Finished Good and enter a price", variant: "destructive" })
                  return
                }
                const addedSku = skuOptions.find((s: any) => String(s.id) === String(newPriceLevelItem.sku_id))
                const addedSkuName = addedSku?.sku_name || `SKU #${newPriceLevelItem.sku_id}`
                attemptChange(`Price - ${addedSkuName}`, "items", () =>
                  setPriceLevelForm((prev: any) => ({ ...prev, items: [...(prev.items || []), { sku_id: newPriceLevelItem.sku_id, price: newPriceLevelItem.price }] }))
                )
                setNewPriceLevelItem({ sku_id: '', price: '' })
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Price
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
