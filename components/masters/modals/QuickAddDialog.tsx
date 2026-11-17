"use client"

import React from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"

export interface QuickAddDialogProps {
  quickAddDialog: { type: 'unit' | 'ledger' | 'hsn_code' | 'sac_code'; onCreated: (id: number) => void } | null
  onClose: () => void
  quickAddForm: any
  setQuickAddForm: React.Dispatch<React.SetStateAction<any>>
  ledgerGroupOptions: any[]
  isQuickAdding: boolean
  submitQuickAdd: () => void
}

export function QuickAddDialog({
  quickAddDialog,
  onClose,
  quickAddForm,
  setQuickAddForm,
  ledgerGroupOptions,
  isQuickAdding,
  submitQuickAdd,
}: QuickAddDialogProps) {
  return (
    <Dialog open={!!quickAddDialog} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {quickAddDialog?.type === 'unit'
              ? 'Add Unit'
              : quickAddDialog?.type === 'ledger'
              ? 'Add Ledger'
              : quickAddDialog?.type === 'hsn_code'
              ? 'Add HSN Code'
              : 'Add SAC Code'}
          </DialogTitle>
          <DialogDescription>
            {quickAddDialog?.type === 'unit'
              ? 'Create a new Unit without leaving this form.'
              : quickAddDialog?.type === 'ledger'
              ? 'Create a new Ledger without leaving this form.'
              : quickAddDialog?.type === 'hsn_code'
              ? 'Create a new HSN Code without leaving this form.'
              : 'Create a new SAC Code without leaving this form.'}
          </DialogDescription>
        </DialogHeader>
        {quickAddDialog?.type === 'unit' ? (
          <div className="grid gap-4 py-2 px-1">
            <div className="space-y-2">
              <Label htmlFor="qa_unit_name">UOM *</Label>
              <Input id="qa_unit_name" value={quickAddForm.unit_name || ''} onChange={e => setQuickAddForm((prev: any) => ({ ...prev, unit_name: e.target.value }))} placeholder="e.g. Kilograms" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="qa_unit_short_name">Short name (symbol) *</Label>
                <Input id="qa_unit_short_name" maxLength={20} value={quickAddForm.short_name || ''} onChange={e => setQuickAddForm((prev: any) => ({ ...prev, short_name: e.target.value }))} placeholder="e.g. KG" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="qa_unit_decimals">Number of decimal places</Label>
                <Input id="qa_unit_decimals" type="number" min={0} max={6} step={1} value={quickAddForm.decimal_places ?? 2} onChange={e => setQuickAddForm((prev: any) => ({ ...prev, decimal_places: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="qa_unit_is_active" checked={quickAddForm.status === 'Active'} onCheckedChange={checked => setQuickAddForm((prev: any) => ({ ...prev, status: checked === true ? 'Active' : 'Inactive' }))} />
              <Label htmlFor="qa_unit_is_active" className="cursor-pointer">Is Active?</Label>
            </div>
          </div>
        ) : quickAddDialog?.type === 'ledger' ? (
          <div className="grid gap-4 py-2 px-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="qa_ledger_code">Ledger Code</Label>
                <Input id="qa_ledger_code" value={quickAddForm.ledger_code || ''} readOnly className="bg-slate-100" placeholder="Auto-generated" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="qa_ledger_name">Ledger Name *</Label>
                <Input id="qa_ledger_name" value={quickAddForm.ledger_name || ''} onChange={e => setQuickAddForm((prev: any) => ({ ...prev, ledger_name: e.target.value }))} placeholder="e.g. Freight Charges" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="qa_ledger_group_id">Ledger Group</Label>
              <Select value={quickAddForm.ledger_group_id ? String(quickAddForm.ledger_group_id) : ''} onValueChange={val => setQuickAddForm((prev: any) => ({ ...prev, ledger_group_id: val }))}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select ledger group" /></SelectTrigger>
                <SelectContent>
                  {ledgerGroupOptions.map((g: any) => <SelectItem key={g.id} value={String(g.id)}>{g.group_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : quickAddDialog?.type === 'hsn_code' ? (
          <div className="grid gap-4 py-2 px-1">
            <div className="space-y-2">
              <Label htmlFor="qa_hsn_code">HSN Code (8 digits) *</Label>
              <Input id="qa_hsn_code" value={quickAddForm.code || ''} maxLength={8} onChange={e => setQuickAddForm((prev: any) => ({ ...prev, code: e.target.value.replace(/\D/g, '') }))} placeholder="e.g. 73269099" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qa_hsn_name">Description *</Label>
              <Input id="qa_hsn_name" value={quickAddForm.name || ''} onChange={e => setQuickAddForm((prev: any) => ({ ...prev, name: e.target.value }))} placeholder="e.g. Test raw material" />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="qa_hsn_is_active" checked={quickAddForm.status === 'Active'} onCheckedChange={checked => setQuickAddForm((prev: any) => ({ ...prev, status: checked === true ? 'Active' : 'Inactive' }))} />
              <Label htmlFor="qa_hsn_is_active" className="cursor-pointer">Is Active?</Label>
            </div>
          </div>
        ) : quickAddDialog?.type === 'sac_code' ? (
          <div className="grid gap-4 py-2 px-1">
            <div className="space-y-2">
              <Label htmlFor="qa_sac_code">SAC Code (6 digits) *</Label>
              <Input id="qa_sac_code" value={quickAddForm.code || ''} maxLength={6} onChange={e => setQuickAddForm((prev: any) => ({ ...prev, code: e.target.value.replace(/\D/g, '') }))} placeholder="e.g. 996511" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qa_sac_name">Description *</Label>
              <Input id="qa_sac_name" value={quickAddForm.name || ''} onChange={e => setQuickAddForm((prev: any) => ({ ...prev, name: e.target.value }))} placeholder="e.g. Construction services" />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="qa_sac_is_active" checked={quickAddForm.status === 'Active'} onCheckedChange={checked => setQuickAddForm((prev: any) => ({ ...prev, status: checked === true ? 'Active' : 'Inactive' }))} />
              <Label htmlFor="qa_sac_is_active" className="cursor-pointer">Is Active?</Label>
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isQuickAdding}>Cancel</Button>
          <Button onClick={submitQuickAdd} disabled={isQuickAdding}>
            {isQuickAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
