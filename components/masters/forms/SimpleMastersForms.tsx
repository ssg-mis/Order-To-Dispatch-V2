"use client"
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";

import React from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Combobox } from "@/components/ui/combobox"
import { BookOpen, Layers, Ruler } from "lucide-react"
import { STATUS_OPTIONS } from "../types"
import { LedgerGroupSectionalHistoryTable } from "@/components/ledger-group-sectional-history-table"
import { StockGroupSectionalHistoryTable } from "@/components/stock-group-sectional-history-table"
import { UnitSectionalHistoryTable } from "@/components/unit-sectional-history-table"

export function LedgerGroupForm({
  ledgerGroupForm,
  setLedgerGroupForm,
  ledgerGroupOptionsData,
  editingItem,
  handleLedgerGroupFieldChangeAttempt,
  setLedgerGroupEffectiveDatesOpen,
}: {
  ledgerGroupForm: any
  setLedgerGroupForm: React.Dispatch<React.SetStateAction<any>>
  ledgerGroupOptionsData: any[]
  editingItem?: any | null
  handleLedgerGroupFieldChangeAttempt?: (fieldName: string, applyChange: () => void) => void
  setLedgerGroupEffectiveDatesOpen?: (open: boolean) => void
}) {
  const handleOpenEffectiveDatesView = useScrollRestoration();
  const attemptChange = (fieldName: string, applyChange: () => void) => {
    if (handleLedgerGroupFieldChangeAttempt) {
      handleLedgerGroupFieldChangeAttempt(fieldName, applyChange)
    } else {
      applyChange()
    }
  }

  const isSystemRow = !!ledgerGroupForm.is_system

  return (
    <div className="space-y-5 py-2">
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
        <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
          <BookOpen className="h-4.5 w-4.5 text-blue-600" />
          <span>Ledger Group Details</span>
        </Label>
        {editingItem?.id && (
          <LedgerGroupSectionalHistoryTable
            ledgerGroupId={editingItem.id}
            onOpenView={handleOpenEffectiveDatesView(() => setLedgerGroupEffectiveDatesOpen?.(true))}
          />
        )}
      </div>

      {isSystemRow && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
          This is the system "Primary" ledger group and cannot be renamed, disabled, or reparented.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="group_code" className="text-xs font-semibold text-slate-800">Group Code *</Label>
          <Input id="group_code" value={ledgerGroupForm.group_code || ""} readOnly className="bg-slate-100 font-mono text-xs cursor-not-allowed" placeholder="Auto-generated" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="group_name" className="text-xs font-semibold text-slate-800">Group Name *</Label>
          <Input
            id="group_name"
            className="text-xs font-medium"
            disabled={isSystemRow}
            value={ledgerGroupForm.group_name || ""}
            onChange={e => {
              const val = e.target.value
              attemptChange("Group Name", () => setLedgerGroupForm((prev: any) => ({...prev, group_name: val})))
            }}
            placeholder="Enter ledger group name"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="space-y-1.5 min-w-0">
          <Label className="text-xs font-semibold text-slate-800">Under (Parent Group)</Label>
          <Combobox
            options={(ledgerGroupOptionsData || []).filter((g: any) => g.id !== editingItem?.id).map((g: any) => ({ value: String(g.id), label: g.group_name }))}
            value={ledgerGroupForm.parent_id ? String(ledgerGroupForm.parent_id) : ""}
            onValueChange={val => attemptChange("Under (Parent Group)", () => setLedgerGroupForm((prev: any) => ({...prev, parent_id: val ? parseInt(val, 10) : null, nature_of_group: ""})))}
            placeholder="Select parent group"
            searchPlaceholder="Search groups..."
            disabled={isSystemRow}
          />
        </div>

        {/* TALLY LOGIC: Show Nature of Group ONLY if Under is Primary */}
        {ledgerGroupForm.parent_id === ledgerGroupOptionsData?.find((g: any) => g.group_name === 'Primary')?.id && (
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-800">Nature of Group</Label>
            <Select
              value={ledgerGroupForm.nature_of_group}
              onValueChange={val => attemptChange("Nature of Group", () => setLedgerGroupForm((prev: any) => ({...prev, nature_of_group: val})))}
            >
              <SelectTrigger className="w-full text-xs"><SelectValue placeholder="Select Nature" /></SelectTrigger>
              <SelectContent>
                {['Assets', 'Liabilities', 'Income', 'Expenses'].map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="status" className="text-xs font-semibold text-slate-800">Status</Label>
          <Select
            value={ledgerGroupForm.status}
            onValueChange={val => attemptChange("Status", () => setLedgerGroupForm((prev: any) => ({...prev, status: val})))}
            disabled={isSystemRow}
          >
            <SelectTrigger className="w-full text-xs"><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}

export function StockGroupForm({
  stockGroupForm,
  setStockGroupForm,
  stockGroupOptionsData,
  editingItem,
  handleStockGroupFieldChangeAttempt,
  setStockGroupEffectiveDatesOpen,
}: {
  stockGroupForm: any
  setStockGroupForm: React.Dispatch<React.SetStateAction<any>>
  stockGroupOptionsData: any[]
  editingItem?: any | null
  handleStockGroupFieldChangeAttempt?: (fieldName: string, applyChange: () => void) => void
  setStockGroupEffectiveDatesOpen?: (open: boolean) => void
}) {
  const handleOpenEffectiveDatesView = useScrollRestoration();
  const attemptChange = (fieldName: string, applyChange: () => void) => {
    if (handleStockGroupFieldChangeAttempt) {
      handleStockGroupFieldChangeAttempt(fieldName, applyChange)
    } else {
      applyChange()
    }
  }

  const isSystemRow = !!stockGroupForm.is_system

  return (
    <div className="space-y-5 py-2">
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
        <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
          <Layers className="h-4.5 w-4.5 text-blue-600" />
          <span>Stock Group Details</span>
        </Label>
        {editingItem?.id && (
          <StockGroupSectionalHistoryTable
            stockGroupId={editingItem.id}
            onOpenView={handleOpenEffectiveDatesView(() => setStockGroupEffectiveDatesOpen?.(true))}
          />
        )}
      </div>

      {isSystemRow && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
          This is the system "Primary" stock group and cannot be renamed, disabled, or reparented.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="group_code" className="text-xs font-semibold text-slate-800">Group Code *</Label>
          <Input id="group_code" value={stockGroupForm.group_code} readOnly className="bg-slate-100 font-mono text-xs cursor-not-allowed" placeholder="Auto-generated" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="group_name" className="text-xs font-semibold text-slate-800">Group Name *</Label>
          <Input
            id="group_name"
            className="text-xs font-medium"
            disabled={isSystemRow}
            value={stockGroupForm.group_name}
            onChange={e => {
              const val = e.target.value
              attemptChange("Group Name", () => setStockGroupForm((prev: any) => ({...prev, group_name: val})))
            }}
            placeholder="Enter stock group name"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="space-y-1.5 min-w-0">
          <Label className="text-xs font-semibold text-slate-800">Under (Parent Group)</Label>
          <Combobox
            options={(stockGroupOptionsData || []).filter((g: any) => g.id !== editingItem?.id).map((g: any) => ({ value: String(g.id), label: g.group_name }))}
            value={stockGroupForm.parent_id ? String(stockGroupForm.parent_id) : ""}
            onValueChange={val => attemptChange("Under (Parent Group)", () => setStockGroupForm((prev: any) => ({...prev, parent_id: val ? parseInt(val, 10) : null})))}
            placeholder="Select parent group"
            searchPlaceholder="Search groups..."
            disabled={isSystemRow}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="status" className="text-xs font-semibold text-slate-800">Status</Label>
          <Select
            value={stockGroupForm.status}
            onValueChange={val => attemptChange("Status", () => setStockGroupForm((prev: any) => ({...prev, status: val})))}
            disabled={isSystemRow}
          >
            <SelectTrigger className="w-full text-xs"><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}

export function UnitForm({
  unitForm,
  setUnitForm,
  editingItem,
  handleUnitFieldChangeAttempt,
  setUnitEffectiveDatesOpen,
}: {
  unitForm: any
  setUnitForm: React.Dispatch<React.SetStateAction<any>>
  editingItem?: any | null
  handleUnitFieldChangeAttempt?: (fieldName: string, applyChange: () => void) => void
  setUnitEffectiveDatesOpen?: (open: boolean) => void
}) {
  const handleOpenEffectiveDatesView = useScrollRestoration();
  const attemptChange = (fieldName: string, applyChange: () => void) => {
    if (handleUnitFieldChangeAttempt) {
      handleUnitFieldChangeAttempt(fieldName, applyChange)
    } else {
      applyChange()
    }
  }

  return (
    <div className="space-y-5 py-2">
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
        <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
          <Ruler className="h-4.5 w-4.5 text-blue-600" />
          <span>Unit Details</span>
        </Label>
        {editingItem?.id && (
          <UnitSectionalHistoryTable
            unitId={editingItem.id}
            onOpenView={handleOpenEffectiveDatesView(() => setUnitEffectiveDatesOpen?.(true))}
          />
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="unit_code" className="text-xs font-semibold text-slate-800">Unit Code *</Label>
          <Input id="unit_code" value={unitForm.unit_code} readOnly className="bg-slate-100 font-mono text-xs cursor-not-allowed" placeholder="Auto-generated" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="unit_name" className="text-xs font-semibold text-slate-800">UOM *</Label>
          <Input
            id="unit_name"
            className="text-xs font-medium"
            value={unitForm.unit_name}
            onChange={e => {
              const val = e.target.value
              attemptChange("UOM", () => setUnitForm((prev: any) => ({...prev, unit_name: val})))
            }}
            placeholder="e.g. Kilograms"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="unit_status" className="text-xs font-semibold text-slate-800">Status</Label>
          <Select
            value={unitForm.status}
            onValueChange={val => attemptChange("Status", () => setUnitForm((prev: any) => ({...prev, status: val})))}
          >
            <SelectTrigger id="unit_status" className="w-full text-xs"><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}

// TdsRuleForm has been moved to its own file: forms/TdsRuleForm.tsx
// (same dedicated-file pattern as CdRuleForm)

export function OilTagForm({
  oilTagForm,
  setOilTagForm,
}: {
  oilTagForm: any
  setOilTagForm: React.Dispatch<React.SetStateAction<any>>
}) {
  const handleOpenEffectiveDatesView = useScrollRestoration();

  return (
    <div className="grid gap-4 py-4 px-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="ot_name">Oil Tag Name *</Label>
          <Input id="ot_name" value={oilTagForm.name} onChange={e => setOilTagForm((prev: any) => ({...prev, name: e.target.value}))} placeholder="e.g. Rice Bran Refined Oil" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ot_status">Status</Label>
          <Select value={oilTagForm.status} onValueChange={val => setOilTagForm((prev: any) => ({...prev, status: val}))}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}

export function BhadaRateForm({
  bhadaRateForm,
  setBhadaRateForm,
}: {
  bhadaRateForm: any
  setBhadaRateForm: React.Dispatch<React.SetStateAction<any>>
}) {
  const handleOpenEffectiveDatesView = useScrollRestoration();

  return (
    <div className="grid gap-4 py-4 px-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="bhada_rate_code">Bhada Rate Code *</Label>
          <Input id="bhada_rate_code" value={bhadaRateForm.bhada_rate_code} readOnly className="bg-slate-100" placeholder="Auto-generated" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bhada_name">Name *</Label>
          <Input id="bhada_name" value={bhadaRateForm.name} onChange={e => setBhadaRateForm((prev: any) => ({...prev, name: e.target.value}))} placeholder="e.g. Local Route Rate" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="bhada_rate">Rate</Label>
          <Input id="bhada_rate" type="number" step="0.01" value={bhadaRateForm.rate} onChange={e => setBhadaRateForm((prev: any) => ({...prev, rate: e.target.value}))} placeholder="0.00" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bhada_status">Status</Label>
          <Select value={bhadaRateForm.status} onValueChange={val => setBhadaRateForm((prev: any) => ({...prev, status: val}))}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
