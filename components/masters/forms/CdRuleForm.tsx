"use client"

import React from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Percent } from "lucide-react"
import { STATUS_OPTIONS } from "../types"
import { CdRuleSectionalHistoryTable } from "@/components/cd-rule-sectional-history-table"

export interface CdRuleFormProps {
  cdRuleForm: any
  setCdRuleForm: React.Dispatch<React.SetStateAction<any>>
  activeStockCategories: any[]
  editingItem?: any | null
  handleCdRuleFieldChangeAttempt?: (fieldName: string, applyChange: () => void) => void
  setCdRuleEffectiveDatesOpen?: (open: boolean) => void
}

export function CdRuleForm({
  cdRuleForm,
  setCdRuleForm,
  activeStockCategories,
  editingItem,
  handleCdRuleFieldChangeAttempt,
  setCdRuleEffectiveDatesOpen,
}: CdRuleFormProps) {
  const attemptChange = (fieldName: string, applyChange: () => void) => {
    if (handleCdRuleFieldChangeAttempt) {
      handleCdRuleFieldChangeAttempt(fieldName, applyChange)
    } else {
      applyChange()
    }
  }

  return (
    <div className="space-y-5 py-2">
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
        <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
          <Percent className="h-4.5 w-4.5 text-blue-600" />
          <span>Cash Discount Rule Details</span>
        </Label>
        {editingItem?.id && (
          <CdRuleSectionalHistoryTable
            cdRuleId={editingItem.id}
            onOpenView={() => setCdRuleEffectiveDatesOpen?.(true)}
          />
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="cd_rule_code" className="text-xs font-semibold text-slate-800">CD Rule Code *</Label>
          <Input id="cd_rule_code" value={cdRuleForm.cd_rule_code || ""} readOnly className="bg-slate-100 font-mono text-xs cursor-not-allowed" placeholder="Auto-generated" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cd_wef_date" className="text-xs font-semibold text-slate-800">W.E.F. Date *</Label>
          <Input
            id="cd_wef_date"
            type="date"
            className="text-xs font-medium"
            value={cdRuleForm.wef_date?.split('T')[0] || ''}
            onChange={e => {
              const val = e.target.value
              attemptChange("W.E.F. Date", () => setCdRuleForm((prev: any) => ({...prev, wef_date: val})))
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="space-y-1.5 min-w-0">
          <Label htmlFor="cd_stock_category_id" className="text-xs font-semibold text-slate-800">Stock Category *</Label>
          <Select
            value={cdRuleForm.stock_category_id ? String(cdRuleForm.stock_category_id) : ''}
            onValueChange={val => attemptChange("Stock Category", () => setCdRuleForm((prev: any) => ({...prev, stock_category_id: val})))}
          >
            <SelectTrigger className="w-full text-xs"><SelectValue placeholder="Select stock category" /></SelectTrigger>
            <SelectContent>
              {activeStockCategories.map((r: any) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 min-w-0">
          <Label htmlFor="cd_status" className="text-xs font-semibold text-slate-800">Status</Label>
          <Select
            value={cdRuleForm.status}
            onValueChange={val => attemptChange("Status", () => setCdRuleForm((prev: any) => ({...prev, status: val})))}
          >
            <SelectTrigger className="w-full text-xs"><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="cd_discount_rate_per_main_uom" className="text-xs font-semibold text-slate-800">Discount Rate (per Main UOM) *</Label>
          <Input
            id="cd_discount_rate_per_main_uom"
            type="number"
            step="0.01"
            className="text-xs font-medium"
            value={cdRuleForm.discount_rate_per_main_uom ?? ""}
            onChange={e => {
              const val = e.target.value
              attemptChange("Discount Rate (per Main UOM)", () => setCdRuleForm((prev: any) => ({...prev, discount_rate_per_main_uom: val})))
            }}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cd_payment_condition_days" className="text-xs font-semibold text-slate-800">Payment Condition (Days) *</Label>
          <Input
            id="cd_payment_condition_days"
            type="number"
            step="1"
            className="text-xs font-medium"
            value={cdRuleForm.payment_condition_days ?? ""}
            onChange={e => {
              const val = e.target.value
              attemptChange("Payment Condition (Days)", () => setCdRuleForm((prev: any) => ({...prev, payment_condition_days: val})))
            }}
            placeholder="e.g. 30"
          />
        </div>
      </div>
    </div>
  )
}
