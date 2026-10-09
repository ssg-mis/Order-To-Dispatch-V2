"use client"
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";

import React from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Combobox } from "@/components/ui/combobox"
import { FileUploadField } from "@/components/file-upload-field"
import { Truck } from "lucide-react"
import { STATUS_OPTIONS } from "../types"
import { PartyParityFields } from "./PartyParityFields"
import { TransportSectionalHistoryTable } from "@/components/transport-sectional-history-table"

type TransportSectionType = "basic" | "gst" | "msme" | "fssai" | "documents"

export interface TransportFormProps {
  transportForm: any
  setTransportForm: React.Dispatch<React.SetStateAction<any>>
  ledgerGroupOptions: any[]
  customers: any[]
  activeStates: any[]
  activeGstRegStatuses: any[]
  activeGstRegTypes: any[]
  activeMsmeRegTypes: any[]
  activeFssaiLicenceTypes: any[]
  handlePartyPanBlur?: () => void
  handlePartyGstinBlur?: () => void
  partyFormErrors?: { pan?: string; gstin?: string }
  handleFileUpload: (file: File, fieldName: string) => void
  handleFileRemove: (fieldName: string) => void
  editingItem?: any | null
  handleTransportFieldChangeAttempt?: (fieldName: string, section: TransportSectionType, applyChange: () => void) => void
  setTransportEffectiveDatesSection?: (section: TransportSectionType | null) => void
}

export function TransportForm({
  transportForm,
  setTransportForm,
  ledgerGroupOptions,
  customers,
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
  editingItem,
  handleTransportFieldChangeAttempt,
  setTransportEffectiveDatesSection,
}: TransportFormProps) {
  const handleOpenEffectiveDatesView = useScrollRestoration();

  const attemptChange = (fieldName: string, section: TransportSectionType, applyChange: () => void) => {
    if (handleTransportFieldChangeAttempt) {
      handleTransportFieldChangeAttempt(fieldName, section, applyChange)
    } else {
      applyChange()
    }
  }

  return (
    <div className="space-y-5 py-2">
      {/* Basic Details */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
          <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
            <Truck className="h-4.5 w-4.5 text-blue-600" />
            <span>Basic Details</span>
          </Label>
          {editingItem?.id && (
            <TransportSectionalHistoryTable
              section="basic"
              transportId={editingItem.id}
              onOpenView={handleOpenEffectiveDatesView((sec) => setTransportEffectiveDatesSection?.(sec))}
            />
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="transport_master_id" className="text-xs font-semibold text-slate-800">Transport ID *</Label>
            <Input id="transport_master_id" value={transportForm.transport_master_id ?? ""} readOnly className="bg-slate-100 font-mono text-xs cursor-not-allowed" placeholder="Auto-generated" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="status" className="text-xs font-semibold text-slate-800">Status</Label>
            <Select
              value={transportForm.status}
              onValueChange={val => attemptChange("Status", "basic", () => setTransportForm((prev: any) => ({...prev, status: val})))}
            >
              <SelectTrigger className="w-full text-xs"><SelectValue placeholder="Select status" /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="transporter_name" className="text-xs font-semibold text-slate-800">Transporter Name *</Label>
          <Input
            id="transporter_name"
            className="text-xs font-medium"
            value={transportForm.transporter_name ?? ""}
            onChange={e => {
              const val = e.target.value
              attemptChange("Transporter Name", "basic", () => setTransportForm((prev: any) => ({...prev, transporter_name: val})))
            }}
            placeholder="Company Name"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="contact_person" className="text-xs font-semibold text-slate-800">Contact Person *</Label>
            <Input
              id="contact_person"
              className="text-xs font-medium"
              value={transportForm.contact_person ?? ""}
              onChange={e => {
                const val = e.target.value
                attemptChange("Contact Person", "basic", () => setTransportForm((prev: any) => ({...prev, contact_person: val})))
              }}
              placeholder="Full Name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact_number" className="text-xs font-semibold text-slate-800">Contact Number *</Label>
            <Input
              id="contact_number"
              className="text-xs font-medium"
              value={transportForm.contact_number ?? ""}
              onChange={e => {
                const val = e.target.value
                attemptChange("Contact Number", "basic", () => setTransportForm((prev: any) => ({...prev, contact_number: val})))
              }}
              placeholder="Mobile/Phone"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="email_id" className="text-xs font-semibold text-slate-800">Email ID</Label>
            <Input
              id="email_id"
              type="email"
              className="text-xs font-medium"
              value={transportForm.email_id ?? ""}
              onChange={e => {
                const val = e.target.value
                attemptChange("Email ID", "basic", () => setTransportForm((prev: any) => ({...prev, email_id: val})))
              }}
              placeholder="email@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address_line1" className="text-xs font-semibold text-slate-800">Address</Label>
            <Input
              id="address_line1"
              className="text-xs font-medium"
              value={transportForm.address_line1 ?? ""}
              onChange={e => {
                const val = e.target.value
                attemptChange("Address", "basic", () => setTransportForm((prev: any) => ({...prev, address_line1: val})))
              }}
              placeholder="Office address"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="pincode" className="text-xs font-semibold text-slate-800">Pincode</Label>
            <Input
              id="pincode"
              className="text-xs font-medium"
              value={transportForm.pincode ?? ""}
              onChange={e => {
                const val = e.target.value
                attemptChange("Pincode", "basic", () => setTransportForm((prev: any) => ({...prev, pincode: val})))
              }}
              placeholder="6-digit PIN"
            />
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label htmlFor="ledger_group_id" className="text-xs font-semibold text-slate-800">Ledger Group</Label>
            <Select
              value={transportForm.ledger_group_id ? String(transportForm.ledger_group_id) : ''}
              onValueChange={val => attemptChange("Ledger Group", "basic", () => setTransportForm((prev: any) => ({...prev, ledger_group_id: val})))}
            >
              <SelectTrigger className="w-full text-xs"><SelectValue placeholder="Select ledger group" /></SelectTrigger>
              <SelectContent>
                {ledgerGroupOptions.map((g: any) => <SelectItem key={g.id} value={String(g.id)}>{g.group_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5 min-w-0">
            <Label htmlFor="linked_customer_id" className="text-xs font-semibold text-slate-800">Linked Customer</Label>
            <p className="text-[11px] text-slate-500 mb-1">If this transporter is also a customer, link them so they don't need a separate ledger.</p>
            <Combobox
              options={customers.map((c: any) => ({ value: String(c.id), label: c.customer_name }))}
              value={transportForm.linked_customer_id ? String(transportForm.linked_customer_id) : ""}
              onValueChange={val => attemptChange("Linked Customer", "basic", () => setTransportForm((prev: any) => ({...prev, linked_customer_id: val ? parseInt(val, 10) : null})))}
              placeholder="Select customer (optional)"
              searchPlaceholder="Search customer..."
            />
          </div>
          <div className="space-y-1.5">
            <FileUploadField
              label="Bilty Copy"
              accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
              value={transportForm.bilty_copy_upload || ""}
              helperText="Max file size: 20 MB"
              uploading={false}
              onFilesSelected={(files) => {
                if (files[0]) {
                  const file = files[0]
                  attemptChange("Bilty Copy", "basic", () => handleFileUpload(file, "bilty_copy_upload"))
                }
              }}
              onRemove={() => attemptChange("Bilty Copy", "basic", () => handleFileRemove("bilty_copy_upload"))}
            />
          </div>
        </div>
      </div>

      <PartyParityFields
        form={transportForm}
        onChange={(patch) => setTransportForm((prev: any) => ({ ...prev, ...patch }))}
        onFieldChangeAttempt={(fieldName, section, applyChange) => attemptChange(fieldName, section, applyChange)}
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
        isTransport={true}
        transportName={transportForm.transporter_name}
        onOpenTransportHistory={(sec) => setTransportEffectiveDatesSection?.(sec as TransportSectionType)}
      />
    </div>
  )
}
