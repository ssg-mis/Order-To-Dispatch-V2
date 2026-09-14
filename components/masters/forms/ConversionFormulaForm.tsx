"use client"

import React from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sigma, Plus, X } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { STATUS_OPTIONS } from "../types"
import { ConversionFormulaSectionalHistoryTable } from "@/components/conversion-formula-sectional-history-table"

export interface ConversionFormulaFormProps {
  conversionFormulaForm: any
  setConversionFormulaForm: React.Dispatch<React.SetStateAction<any>>
  skuOptions: any[]
  newFormulaStep: { operation: string; operand_type: string; operand_value: string }
  setNewFormulaStep: React.Dispatch<React.SetStateAction<{ operation: string; operand_type: string; operand_value: string }>>
  editingItem?: any | null
  handleConversionFormulaFieldChangeAttempt?: (fieldName: string, applyChange: () => void) => void
  setConversionFormulaEffectiveDatesOpen?: (open: boolean) => void
}

export function ConversionFormulaForm({
  conversionFormulaForm,
  setConversionFormulaForm,
  skuOptions,
  newFormulaStep,
  setNewFormulaStep,
  editingItem,
  handleConversionFormulaFieldChangeAttempt,
  setConversionFormulaEffectiveDatesOpen,
}: ConversionFormulaFormProps) {
  const { toast } = useToast()

  const attemptChange = (fieldName: string, applyChange: () => void) => {
    if (handleConversionFormulaFieldChangeAttempt) {
      handleConversionFormulaFieldChangeAttempt(fieldName, applyChange)
    } else {
      applyChange()
    }
  }

  return (
    <div className="space-y-5 py-2">
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
        <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
          <Sigma className="h-4.5 w-4.5 text-blue-600" />
          <span>Conversion Formula Details</span>
        </Label>
        {editingItem?.id && (
          <ConversionFormulaSectionalHistoryTable
            conversionFormulaId={editingItem.id}
            onOpenView={() => setConversionFormulaEffectiveDatesOpen?.(true)}
          />
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="conversion_formula_code" className="text-xs font-semibold text-slate-800">Formula Code *</Label>
          <Input id="conversion_formula_code" value={conversionFormulaForm.conversion_formula_code} readOnly className="bg-slate-100 font-mono text-xs cursor-not-allowed" placeholder="Auto-generated" />
        </div>
        <div className="space-y-1.5 min-w-0">
          <Label htmlFor="cf_status" className="text-xs font-semibold text-slate-800">Status</Label>
          <Select
            value={conversionFormulaForm.status}
            onValueChange={val => attemptChange("Status", () => setConversionFormulaForm((prev: any) => ({...prev, status: val})))}
          >
            <SelectTrigger className="w-full text-xs"><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="space-y-1.5 min-w-0">
          <Label htmlFor="base_item_id" className="text-xs font-semibold text-slate-800">Base / Parent Item</Label>
          <Select
            value={conversionFormulaForm.base_item_id ? String(conversionFormulaForm.base_item_id) : ''}
            onValueChange={val => attemptChange("Base/Parent Item", () => setConversionFormulaForm((prev: any) => ({...prev, base_item_id: val})))}
          >
            <SelectTrigger className="w-full text-xs"><SelectValue placeholder="Select base item" /></SelectTrigger>
            <SelectContent>
              {skuOptions.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.sku_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 min-w-0">
          <Label htmlFor="child_item_id" className="text-xs font-semibold text-slate-800">Child Item</Label>
          <Select
            value={conversionFormulaForm.child_item_id ? String(conversionFormulaForm.child_item_id) : ''}
            onValueChange={val => attemptChange("Child Item", () => setConversionFormulaForm((prev: any) => ({...prev, child_item_id: val})))}
          >
            <SelectTrigger className="w-full text-xs"><SelectValue placeholder="Select child item" /></SelectTrigger>
            <SelectContent>
              {skuOptions.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.sku_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 p-3.5 bg-slate-50/50 space-y-3.5">
        <p className="text-xs font-semibold text-slate-700">Formula Steps</p>
        {(conversionFormulaForm.steps || []).length > 0 && (
          <div className="space-y-2">
            {(conversionFormulaForm.steps || []).map((s: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between gap-2 bg-white rounded-md px-3 py-2 text-xs border border-slate-200">
                <span className="text-slate-700 font-medium">Step {idx + 1}: <span className="font-semibold">{s.operation}</span> — {s.operand_type === 'literal' ? s.operand_value : s.operand_type.replace(/_/g, ' ')}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:bg-red-50"
                  onClick={() => attemptChange("Formula Steps", () => setConversionFormulaForm((prev: any) => ({ ...prev, steps: prev.steps.filter((_: any, i: number) => i !== idx).map((s: any, i: number) => ({ ...s, step_order: i + 1 })) })))}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="bg-white rounded-lg p-3.5 border border-slate-200 space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5 min-w-0">
              <Label className="text-xs font-semibold text-slate-800">Operation</Label>
              <Select value={newFormulaStep.operation} onValueChange={val => setNewFormulaStep((prev: any) => ({...prev, operation: val}))}>
                <SelectTrigger className="w-full text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Add</SelectItem>
                  <SelectItem value="subtract">Subtract</SelectItem>
                  <SelectItem value="multiply">Multiply</SelectItem>
                  <SelectItem value="divide">Divide</SelectItem>
                  <SelectItem value="round_up">Round Up (2 decimals)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 min-w-0">
              <Label className="text-xs font-semibold text-slate-800">Operand</Label>
              <Select value={newFormulaStep.operand_type} onValueChange={val => setNewFormulaStep((prev: any) => ({...prev, operand_type: val}))}>
                <SelectTrigger className="w-full text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="literal">A number</SelectItem>
                  <SelectItem value="rate_of_base_item">Rate of Base Item</SelectItem>
                  <SelectItem value="converted_kg_of_base_item">Converted KGS of Base Item</SelectItem>
                  <SelectItem value="converted_kg_of_child_item">Converted KGS of Child Item</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {newFormulaStep.operand_type === 'literal' && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-800">Value</Label>
              <Input type="number" className="text-xs" value={newFormulaStep.operand_value} onChange={e => setNewFormulaStep((prev: any) => ({...prev, operand_value: e.target.value}))} placeholder="e.g. 6.5" />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              className="text-xs"
              onClick={() => {
                if (newFormulaStep.operand_type === 'literal' && !newFormulaStep.operand_value) {
                  toast({ title: "Error", description: "Enter a value for this step", variant: "destructive" })
                  return
                }
                attemptChange("Formula Steps", () => setConversionFormulaForm((prev: any) => ({
                  ...prev,
                  steps: [...(prev.steps || []), { step_order: (prev.steps || []).length + 1, operation: newFormulaStep.operation, operand_type: newFormulaStep.operand_type, operand_value: newFormulaStep.operand_type === 'literal' ? newFormulaStep.operand_value : null }],
                })))
                setNewFormulaStep({ operation: 'subtract', operand_type: 'literal', operand_value: '' })
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Step
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
