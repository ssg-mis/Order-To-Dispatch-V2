"use client"
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";

import React, { useState } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Search, Shield } from "lucide-react"
import { InsuranceDetailSectionalHistoryTable } from "@/components/insurance-detail-sectional-history-table"

export interface InsuranceDetailFormProps {
  insuranceDetailForm: any
  setInsuranceDetailForm: React.Dispatch<React.SetStateAction<any>>
  customerOptions: any[]
  editingItem?: any | null
  handleInsuranceDetailFieldChangeAttempt?: (fieldName: string, applyChange: () => void) => void
  setInsuranceDetailEffectiveDatesOpen?: (open: boolean) => void
}

export function InsuranceDetailForm({
  insuranceDetailForm,
  setInsuranceDetailForm,
  customerOptions,
  editingItem,
  handleInsuranceDetailFieldChangeAttempt,
  setInsuranceDetailEffectiveDatesOpen,
}: InsuranceDetailFormProps) {
  const handleOpenEffectiveDatesView = useScrollRestoration();

  const [showCustomerSearch, setShowCustomerSearch] = useState(false)
  const [insuranceCustomerSearch, setInsuranceCustomerSearch] = useState("")

  const attemptChange = (fieldName: string, applyChange: () => void) => {
    if (handleInsuranceDetailFieldChangeAttempt) {
      handleInsuranceDetailFieldChangeAttempt(fieldName, applyChange)
    } else {
      applyChange()
    }
  }

  return (
    <div className="space-y-5 py-2">
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
        <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
          <Shield className="h-4.5 w-4.5 text-blue-600" />
          <span>Insurance Policy Details</span>
        </Label>
        {editingItem?.id && (
          <InsuranceDetailSectionalHistoryTable
            insuranceDetailId={editingItem.id}
            onOpenView={handleOpenEffectiveDatesView(() => setInsuranceDetailEffectiveDatesOpen?.(true))}
          />
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="insurance_code" className="text-xs font-semibold text-slate-800">Insurance Code *</Label>
          <Input id="insurance_code" value={insuranceDetailForm.insurance_code || ""} readOnly className="bg-slate-100 font-mono text-xs cursor-not-allowed" placeholder="Auto-generated" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="insurance_company_name" className="text-xs font-semibold text-slate-800">Insurance Company Name *</Label>
          <Input
            id="insurance_company_name"
            className="text-xs font-medium"
            value={insuranceDetailForm.insurance_company_name || ""}
            onChange={e => {
              const val = e.target.value
              attemptChange("Insurance Company Name", () => setInsuranceDetailForm((prev: any) => ({...prev, insurance_company_name: val})))
            }}
            placeholder="Enter company name"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="short_name" className="text-xs font-semibold text-slate-800">Short Name</Label>
          <Input
            id="short_name"
            className="text-xs font-medium"
            value={insuranceDetailForm.short_name || ""}
            onChange={e => {
              const val = e.target.value
              attemptChange("Short Name", () => setInsuranceDetailForm((prev: any) => ({...prev, short_name: val})))
            }}
            placeholder="e.g. ICICI"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="policy_number" className="text-xs font-semibold text-slate-800">Policy Number</Label>
          <Input
            id="policy_number"
            className="text-xs font-medium"
            value={insuranceDetailForm.policy_number || ""}
            onChange={e => {
              const val = e.target.value
              attemptChange("Policy Number", () => setInsuranceDetailForm((prev: any) => ({...prev, policy_number: val})))
            }}
            placeholder="Enter policy number"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="valid_from" className="text-xs font-semibold text-slate-800">Valid From</Label>
          <Input
            id="valid_from"
            type="date"
            className="text-xs font-medium"
            value={insuranceDetailForm.valid_from?.split('T')[0] || ''}
            onChange={e => {
              const val = e.target.value
              attemptChange("Valid From", () => setInsuranceDetailForm((prev: any) => ({...prev, valid_from: val})))
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="insurance_valid_upto" className="text-xs font-semibold text-slate-800">Valid Upto</Label>
          <Input
            id="insurance_valid_upto"
            type="date"
            className="text-xs font-medium"
            value={insuranceDetailForm.valid_upto?.split('T')[0] || ''}
            onChange={e => {
              const val = e.target.value
              attemptChange("Valid Upto", () => setInsuranceDetailForm((prev: any) => ({...prev, valid_upto: val})))
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="space-y-1.5 min-w-0">
          <Label htmlFor="type_of_policy" className="text-xs font-semibold text-slate-800">Type of Policy</Label>
          <Select
            value={insuranceDetailForm.type_of_policy || ''}
            onValueChange={val => attemptChange("Type of Policy", () => setInsuranceDetailForm((prev: any) => ({...prev, type_of_policy: val})))}
          >
            <SelectTrigger className="w-full text-xs"><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Marine Cargo">Marine Cargo</SelectItem>
              <SelectItem value="Open Policy">Open Policy</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sum_insured" className="text-xs font-semibold text-slate-800">Sum Insured (₹)</Label>
          <Input
            id="sum_insured"
            type="number"
            className="text-xs font-medium"
            value={insuranceDetailForm.sum_insured ?? ""}
            onChange={e => {
              const val = e.target.value
              attemptChange("Sum Insured", () => setInsuranceDetailForm((prev: any) => ({...prev, sum_insured: val})))
            }}
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="space-y-1.5 min-w-0">
          <Label htmlFor="owner_type" className="text-xs font-semibold text-slate-800">Owner of Policy</Label>
          <Select
            value={insuranceDetailForm.owner_type || 'Company'}
            onValueChange={val => attemptChange("Owner of Policy", () => setInsuranceDetailForm((prev: any) => ({...prev, owner_type: val})))}
          >
            <SelectTrigger className="w-full text-xs"><SelectValue placeholder="Select owner" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Company">Company</SelectItem>
              <SelectItem value="Customer">Customer</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 min-w-0">
          <Label htmlFor="insurance_status" className="text-xs font-semibold text-slate-800">Status</Label>
          <Select
            value={insuranceDetailForm.status}
            onValueChange={val => attemptChange("Status", () => setInsuranceDetailForm((prev: any) => ({...prev, status: val})))}
          >
            <SelectTrigger className="w-full text-xs"><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {insuranceDetailForm.owner_type === 'Customer' && (
        <div className="space-y-1.5 flex flex-col">
          <Label className="text-xs font-semibold text-slate-800">Linked Customers</Label>
          <p className="text-[11px] text-slate-500">Search and tick the checkboxes of the customers who own this policy.</p>
          {!showCustomerSearch ? (
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start text-slate-500 bg-transparent font-normal h-9 text-xs hover:bg-slate-50"
              onClick={() => setShowCustomerSearch(true)}
            >
              <Search className="mr-2 h-3.5 w-3.5" />
              Select customers
            </Button>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden flex flex-col bg-white shadow-sm mt-1">
              <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    placeholder="Search..."
                    value={insuranceCustomerSearch}
                    onChange={(e) => setInsuranceCustomerSearch(e.target.value)}
                    className="pl-8 h-8 text-xs bg-white"
                    autoFocus
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-2 text-xs text-slate-500 hover:text-slate-700"
                  onClick={() => setShowCustomerSearch(false)}
                >
                  Done
                </Button>
              </div>
              <div className="max-h-52 overflow-y-auto p-1.5">
                {customerOptions.filter((c: any) => c.customer_name.toLowerCase().includes(insuranceCustomerSearch.toLowerCase())).length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No customer found matching your search.</p>
                ) : (
                  <div className="flex flex-col gap-0.5">
                    {customerOptions
                      .filter((c: any) => c.customer_name.toLowerCase().includes(insuranceCustomerSearch.toLowerCase()))
                      .map((c: any) => {
                        const checked = (insuranceDetailForm.customer_ids || []).includes(c.id)
                        return (
                          <label
                            key={c.id}
                            className={`flex items-center gap-3 p-2.5 rounded-md cursor-pointer transition-colors ${checked ? 'bg-primary/5 border border-primary/20' : 'hover:bg-slate-50 border border-transparent'}`}
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => {
                                const current = insuranceDetailForm.customer_ids || []
                                const updated = !checked ? [...current, c.id] : current.filter((id: number) => id !== c.id)
                                attemptChange("Linked Customers", () => setInsuranceDetailForm((prev: any) => ({ ...prev, customer_ids: updated })))
                              }}
                            />
                            <span className={`text-xs ${checked ? 'text-primary font-medium' : 'text-slate-700'}`}>
                              {c.customer_name}
                            </span>
                          </label>
                        )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
