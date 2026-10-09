"use client"
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";

import React from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Landmark } from "lucide-react"
import { STATUS_OPTIONS } from "../types"
import { TdsRuleSectionalHistoryTable } from "@/components/tds-rule-sectional-history-table"

export interface TdsRuleFormProps {
  tdsRuleForm: any
  setTdsRuleForm: React.Dispatch<React.SetStateAction<any>>
  editingItem?: any | null
  handleTdsRuleFieldChangeAttempt?: (fieldName: string, applyChange: () => void) => void
  setTdsRuleEffectiveDatesOpen?: (open: boolean) => void
}

export function TdsRuleForm({
  tdsRuleForm,
  setTdsRuleForm,
  editingItem,
  handleTdsRuleFieldChangeAttempt,
  setTdsRuleEffectiveDatesOpen,
}: TdsRuleFormProps) {
  const handleOpenEffectiveDatesView = useScrollRestoration();

  const attemptChange = (fieldName: string, applyChange: () => void) => {
    if (handleTdsRuleFieldChangeAttempt) {
      handleTdsRuleFieldChangeAttempt(fieldName, applyChange)
    } else {
      applyChange()
    }
  }

  return (
    <div className="space-y-5 py-2">
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
        <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
          <Landmark className="h-4.5 w-4.5 text-blue-600" />
          <span>TDS Rule Details</span>
        </Label>
        {editingItem?.id && (
          <TdsRuleSectionalHistoryTable
            tdsRuleId={editingItem.id}
            onOpenView={handleOpenEffectiveDatesView(() => setTdsRuleEffectiveDatesOpen?.(true))}
          />
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="tds_rule_code" className="text-xs font-semibold text-slate-800">TDS Rule Code *</Label>
          <Input
            id="tds_rule_code"
            value={tdsRuleForm.tds_rule_code || ""}
            readOnly
            className="bg-slate-100 font-mono text-xs cursor-not-allowed"
            placeholder="Auto-generated"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tds_wef_date" className="text-xs font-semibold text-slate-800">W.E.F. Date</Label>
          <Input
            id="tds_wef_date"
            type="date"
            className="text-xs font-medium"
            value={tdsRuleForm.wef_date ? tdsRuleForm.wef_date.split('T')[0] : ""}
            onChange={e => {
              const val = e.target.value
              attemptChange("W.E.F. Date", () => setTdsRuleForm((prev: any) => ({ ...prev, wef_date: val })))
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="tds_name" className="text-xs font-semibold text-slate-800">Nature of Transaction *</Label>
          <Input
            id="tds_name"
            className="text-xs font-medium"
            value={tdsRuleForm.name || tdsRuleForm.nature_of_transaction || ""}
            onChange={e => {
              const val = e.target.value
              attemptChange("Nature of Transaction", () => setTdsRuleForm((prev: any) => ({ ...prev, name: val })))
            }}
            placeholder="e.g. Purchase of Goods - Sec 194Q"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tds_guiding_rule" className="text-xs font-semibold text-slate-800">Guiding Rule</Label>
          <Input
            id="tds_guiding_rule"
            className="text-xs font-medium"
            value={tdsRuleForm.guiding_rule || ""}
            onChange={e => {
              const val = e.target.value
              attemptChange("Guiding Rule", () => setTdsRuleForm((prev: any) => ({ ...prev, guiding_rule: val })))
            }}
            placeholder="e.g. Section 194Q / 206C(1H)"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="tds_threshold_limit" className="text-xs font-semibold text-slate-800">Threshold Limit (₹)</Label>
          <Input
            id="tds_threshold_limit"
            type="number"
            step="0.01"
            className="text-xs font-medium"
            value={tdsRuleForm.threshold_limit ?? ""}
            onChange={e => {
              const val = e.target.value
              attemptChange("Threshold Limit", () => setTdsRuleForm((prev: any) => ({ ...prev, threshold_limit: val })))
            }}
            placeholder="e.g. 5000000"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tds_rate" className="text-xs font-semibold text-slate-800">Rate of Deduction (%)</Label>
          <Input
            id="tds_rate"
            type="number"
            step="0.01"
            className="text-xs font-medium"
            value={tdsRuleForm.rate ?? ""}
            onChange={e => {
              const val = e.target.value
              attemptChange("Rate", () => setTdsRuleForm((prev: any) => ({ ...prev, rate: val })))
            }}
            placeholder="0.10"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="space-y-1.5 min-w-0">
          <Label htmlFor="tds_applicable_amount_type" className="text-xs font-semibold text-slate-800">Amount on Which Rates Apply</Label>
          <Select
            value={tdsRuleForm.applicable_amount_type || "Amount Exceeding Threshold"}
            onValueChange={val => attemptChange("Applicable On", () => setTdsRuleForm((prev: any) => ({ ...prev, applicable_amount_type: val })))}
          >
            <SelectTrigger id="tds_applicable_amount_type" className="w-full text-xs">
              <SelectValue placeholder="Select basis" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Amount Exceeding Threshold">Amount Exceeding Threshold</SelectItem>
              <SelectItem value="Full Taxable Value">Full Taxable Value</SelectItem>
              <SelectItem value="Total Invoice Amount">Total Invoice Amount</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 min-w-0">
          <Label htmlFor="tds_status" className="text-xs font-semibold text-slate-800">Status</Label>
          <Select
            value={tdsRuleForm.status || "Active"}
            onValueChange={val => attemptChange("Status", () => setTdsRuleForm((prev: any) => ({ ...prev, status: val })))}
          >
            <SelectTrigger id="tds_status" className="w-full text-xs">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
