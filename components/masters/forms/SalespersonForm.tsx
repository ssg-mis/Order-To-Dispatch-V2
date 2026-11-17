"use client"
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";

import React from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Users } from "lucide-react"
import { STATUS_OPTIONS } from "../types"
import { SalespersonSectionalHistoryTable } from "../tables/MasterHistoryTables"
import { PartyParityFields } from "./PartyParityFields"

export interface SalespersonFormProps {
  salespersonForm: any
  setSalespersonForm: React.Dispatch<React.SetStateAction<any>>
  editingItem: any
  handleSalespersonFieldChangeAttempt: (fieldName: string, section: any, applyChange: () => void) => void
  setSalespersonEffectiveDatesSection: (section: any) => void
  ledgerGroupOptions: any[]
  activeStates: any[]
  activeGstRegStatuses: any[]
  activeGstRegTypes: any[]
  activeMsmeRegTypes: any[]
  activeFssaiLicenceTypes: any[]
  handlePartyPanBlur?: (val?: any) => void
  handlePartyGstinBlur?: (val?: any) => void
  partyFormErrors?: any
  handleFileUpload: (file: File, fieldName: any) => Promise<void> | void
  handleFileRemove: (fieldName: any) => Promise<void> | void
}

export function SalespersonForm({
  salespersonForm,
  setSalespersonForm,
  editingItem,
  handleSalespersonFieldChangeAttempt,
  setSalespersonEffectiveDatesSection,
  ledgerGroupOptions,
  activeStates,
  activeGstRegStatuses,
  activeGstRegTypes,
  activeMsmeRegTypes,
  activeFssaiLicenceTypes,
  handlePartyPanBlur,
  handlePartyGstinBlur,
  partyFormErrors = {},
  handleFileUpload,
  handleFileRemove,
}: SalespersonFormProps) {
  const handleOpenEffectiveDatesView = useScrollRestoration();

  return (
    <div className="space-y-5 py-2">
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
        <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
          <Users className="h-4.5 w-4.5 text-blue-600" />
          <span>Salesperson Basic Details</span>
        </Label>
        {editingItem?.id && (
          <SalespersonSectionalHistoryTable
            section="basic"
            salespersonId={editingItem.id}
            salespersonName={salespersonForm.salesman_name}
            title="Salesperson History"
            onOpenView={handleOpenEffectiveDatesView((sec: any) => setSalespersonEffectiveDatesSection(sec))}
          />
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="broker_id">Salesperson ID *</Label>
          <Input id="broker_id" value={salespersonForm.broker_id || ""} readOnly className="bg-slate-100" placeholder="Auto-generated" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="salesman_name">Salesman Name *</Label>
          <Input
            id="salesman_name"
            value={salespersonForm.salesman_name || ""}
            onChange={e => {
              const val = e.target.value
              handleSalespersonFieldChangeAttempt('Salesman Name', 'basic', () => setSalespersonForm((prev: any) => ({ ...prev, salesman_name: val })))
            }}
            placeholder="Enter name"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select
            value={salespersonForm.status}
            onValueChange={val => handleSalespersonFieldChangeAttempt('Status', 'basic', () => setSalespersonForm((prev: any) => ({ ...prev, status: val })))}
          >
            <SelectTrigger className="w-full"><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="mobile_no">Mobile Number</Label>
          <Input
            id="mobile_no"
            value={salespersonForm.mobile_no || ""}
            onChange={e => {
              const val = e.target.value
              handleSalespersonFieldChangeAttempt('Mobile Number', 'basic', () => setSalespersonForm((prev: any) => ({ ...prev, mobile_no: val })))
            }}
            placeholder="Enter number"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="email_id">Email ID</Label>
          <Input
            id="email_id"
            value={salespersonForm.email_id || ""}
            onChange={e => {
              const val = e.target.value
              handleSalespersonFieldChangeAttempt('Email ID', 'basic', () => setSalespersonForm((prev: any) => ({ ...prev, email_id: val })))
            }}
            placeholder="email@example.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="employee_id">Employee ID</Label>
          <Input
            id="employee_id"
            value={salespersonForm.employee_id || ''}
            onChange={e => {
              const val = e.target.value
              handleSalespersonFieldChangeAttempt('Employee ID', 'basic', () => setSalespersonForm((prev: any) => ({ ...prev, employee_id: val })))
            }}
            placeholder="Enter employee ID"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="ledger_group_id">Ledger Group</Label>
          <Select
            value={salespersonForm.ledger_group_id ? String(salespersonForm.ledger_group_id) : ''}
            onValueChange={val => handleSalespersonFieldChangeAttempt('Ledger Group', 'basic', () => setSalespersonForm((prev: any) => ({ ...prev, ledger_group_id: val })))}
          >
            <SelectTrigger className="w-full"><SelectValue placeholder="Select ledger group" /></SelectTrigger>
            <SelectContent>
              {ledgerGroupOptions.map((g: any) => <SelectItem key={g.id} value={String(g.id)}>{g.group_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <PartyParityFields
        form={salespersonForm}
        onChange={(patch) => setSalespersonForm((prev: any) => ({ ...prev, ...patch }))}
        onFieldChangeAttempt={(fieldName, section, applyChange) => handleSalespersonFieldChangeAttempt(fieldName, section, applyChange)}
        activeStates={activeStates}
        activeGstRegStatuses={activeGstRegStatuses}
        activeGstRegTypes={activeGstRegTypes}
        activeMsmeRegTypes={activeMsmeRegTypes}
        activeFssaiLicenceTypes={activeFssaiLicenceTypes}
        handlePartyPanBlur={handlePartyPanBlur}
        handlePartyGstinBlur={handlePartyGstinBlur}
        partyFormErrors={partyFormErrors}
        handleFileUpload={handleFileUpload}
        handleFileRemove={handleFileRemove}
        editingItem={editingItem}
        isSalesperson={true}
        salespersonName={salespersonForm.salesman_name}
        onOpenSalespersonHistory={setSalespersonEffectiveDatesSection}
      />
    </div>
  )
}
