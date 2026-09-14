"use client"

import React from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Combobox } from "@/components/ui/combobox"
import { FileUploadField } from "@/components/file-upload-field"
import { Fuel, Receipt, Building2, ShieldCheck, FileText } from "lucide-react"
import { STATUS_OPTIONS } from "../types"
import { PetrolPumpSectionalHistoryTable } from "@/components/petrol-pump-sectional-history-table"

export interface PetrolPumpFormProps {
  petrolPumpForm: any
  setPetrolPumpForm: React.Dispatch<React.SetStateAction<any>>
  editingItem: any
  handlePetrolPumpFieldChangeAttempt: (fieldName: string, section: any, applyChange: () => void) => void
  setPetrolPumpEffectiveDatesSection: (section: any) => void
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

export function PetrolPumpForm({
  petrolPumpForm,
  setPetrolPumpForm,
  editingItem,
  handlePetrolPumpFieldChangeAttempt,
  setPetrolPumpEffectiveDatesSection,
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
}: PetrolPumpFormProps) {
  return (
    <div className="space-y-5 py-2">
      {/* Petrol Pump Basic Details */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
          <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
            <Fuel className="h-4.5 w-4.5 text-blue-600" />
            <span>Petrol Pump Basic Details</span>
          </Label>
          {editingItem?.id && (
            <PetrolPumpSectionalHistoryTable
              section="basic"
              petrolPumpId={editingItem.id}
              petrolPumpName={petrolPumpForm.petrol_pump_name}
              title="Petrol Pump History"
              onOpenView={(sec) => setPetrolPumpEffectiveDatesSection(sec)}
            />
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="petrol_pump_code" className="text-xs font-semibold text-slate-800">Petrol Pump Code *</Label>
            <Input
              id="petrol_pump_code"
              value={petrolPumpForm.petrol_pump_code ?? ""}
              readOnly
              className="bg-slate-100 font-mono text-xs cursor-not-allowed"
              placeholder="Auto-generated"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="petrol_pump_name" className="text-xs font-semibold text-slate-800">Name *</Label>
            <Input
              id="petrol_pump_name"
              value={petrolPumpForm.petrol_pump_name || ""}
              readOnly={!!editingItem?.id}
              onFocus={() => { if (editingItem?.id) handlePetrolPumpFieldChangeAttempt('Petrol Pump Name', 'basic', () => {}) }}
              onChange={e => {
                const val = e.target.value
                handlePetrolPumpFieldChangeAttempt('Petrol Pump Name', 'basic', () => setPetrolPumpForm((prev: any) => ({ ...prev, petrol_pump_name: val })))
              }}
              placeholder="Enter name"
              className={`text-xs font-medium ${editingItem?.id ? 'cursor-pointer' : ''}`}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="status" className="text-xs font-semibold text-slate-800">Status</Label>
            <Select
              value={petrolPumpForm.status}
              onValueChange={val => handlePetrolPumpFieldChangeAttempt('Status', 'basic', () => setPetrolPumpForm((prev: any) => ({ ...prev, status: val })))}
            >
              <SelectTrigger className="w-full text-xs"><SelectValue placeholder="Select status" /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mobile_no" className="text-xs font-semibold text-slate-800">Mobile Number</Label>
            <Input
              id="mobile_no"
              value={petrolPumpForm.mobile_no || ""}
              readOnly={!!editingItem?.id}
              maxLength={10}
              onFocus={() => { if (editingItem?.id) handlePetrolPumpFieldChangeAttempt('Mobile Number', 'basic', () => {}) }}
              onChange={e => {
                const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 10)
                handlePetrolPumpFieldChangeAttempt('Mobile Number', 'basic', () => setPetrolPumpForm((prev: any) => ({ ...prev, mobile_no: val })))
              }}
              placeholder="10-digit mobile number"
              className={`text-xs font-mono ${editingItem?.id ? 'cursor-pointer' : ''}`}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email_id" className="text-xs font-semibold text-slate-800">Email ID</Label>
            <Input
              id="email_id"
              value={petrolPumpForm.email_id || ""}
              readOnly={!!editingItem?.id}
              onFocus={() => { if (editingItem?.id) handlePetrolPumpFieldChangeAttempt('Email ID', 'basic', () => {}) }}
              onChange={e => {
                const val = e.target.value
                handlePetrolPumpFieldChangeAttempt('Email ID', 'basic', () => setPetrolPumpForm((prev: any) => ({ ...prev, email_id: val })))
              }}
              placeholder="email@example.com"
              className={`text-xs ${editingItem?.id ? 'cursor-pointer' : ''}`}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ledger_group_id" className="text-xs font-semibold text-slate-800">Ledger Group</Label>
            <Select
              value={petrolPumpForm.ledger_group_id ? String(petrolPumpForm.ledger_group_id) : ''}
              onValueChange={val => handlePetrolPumpFieldChangeAttempt('Ledger Group', 'basic', () => setPetrolPumpForm((prev: any) => ({ ...prev, ledger_group_id: val })))}
            >
              <SelectTrigger className="w-full text-xs"><SelectValue placeholder="Select ledger group" /></SelectTrigger>
              <SelectContent>
                {ledgerGroupOptions.map((g: any) => <SelectItem key={g.id} value={String(g.id)}>{g.group_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* GST & Tax Details */}
      <div className="space-y-3 border-t pt-4">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
          <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
            <Receipt className="h-4.5 w-4.5 text-blue-600" />
            <span>GST & Tax Details</span>
          </Label>
          {editingItem?.id && (
            <PetrolPumpSectionalHistoryTable
              section="gst"
              petrolPumpId={editingItem.id}
              petrolPumpName={petrolPumpForm.petrol_pump_name}
              title="GST & Tax History"
              onOpenView={(sec) => setPetrolPumpEffectiveDatesSection(sec)}
            />
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-800">State</Label>
            <Combobox
              options={activeStates.map((s: any) => ({ value: String(s.id), label: s.state_name }))}
              value={petrolPumpForm.state_id ? String(petrolPumpForm.state_id) : ""}
              onValueChange={val => {
                const selected = activeStates.find((s: any) => String(s.id) === val)
                handlePetrolPumpFieldChangeAttempt('State', 'gst', () => setPetrolPumpForm((prev: any) => ({ ...prev, state_id: val ? parseInt(val, 10) : null, state: selected?.state_name || petrolPumpForm.state })))
              }}
              placeholder="Select state"
              searchPlaceholder="Search state..."
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-800">PAN</Label>
            <Input
              value={petrolPumpForm.pan ?? ""}
              readOnly={!!editingItem?.id}
              onFocus={() => { if (editingItem?.id) handlePetrolPumpFieldChangeAttempt('PAN', 'gst', () => {}) }}
              onChange={e => handlePetrolPumpFieldChangeAttempt('PAN', 'gst', () => setPetrolPumpForm((prev: any) => ({ ...prev, pan: e.target.value })))}
              onBlur={handlePartyPanBlur}
              placeholder="ABCDE1234F"
              className={`text-xs ${editingItem?.id ? 'cursor-pointer' : ''} ${partyFormErrors.pan ? 'border-red-500 focus-visible:ring-red-400' : ''}`}
            />
            {partyFormErrors.pan && <p className="text-xs text-red-500 mt-1">{partyFormErrors.pan}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-800">GSTIN</Label>
            <Input
              value={petrolPumpForm.gstin ?? ""}
              readOnly={!!editingItem?.id}
              onFocus={() => { if (editingItem?.id) handlePetrolPumpFieldChangeAttempt('GSTIN', 'gst', () => {}) }}
              onChange={e => handlePetrolPumpFieldChangeAttempt('GSTIN', 'gst', () => setPetrolPumpForm((prev: any) => ({ ...prev, gstin: e.target.value })))}
              onBlur={handlePartyGstinBlur}
              placeholder="22ABCDE1234F1Z5"
              className={`text-xs ${editingItem?.id ? 'cursor-pointer' : ''} ${partyFormErrors.gstin ? 'border-red-500 focus-visible:ring-red-400' : ''}`}
            />
            {partyFormErrors.gstin && <p className="text-xs text-red-500 mt-1">{partyFormErrors.gstin}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-800">GST Registration Status</Label>
            <Combobox
              options={activeGstRegStatuses.map((r: any) => ({ value: r.name, label: r.name }))}
              value={petrolPumpForm.gst_registered ?? ""}
              onValueChange={val => handlePetrolPumpFieldChangeAttempt('GST Registration Status', 'gst', () => setPetrolPumpForm((prev: any) => ({
                ...prev,
                gst_registered: val,
                ...(val !== 'Registered' ? { gst_registration_type: '', gst_registration_wef: '' } : {})
              })))}
              placeholder="Select status"
              searchPlaceholder="Search..."
            />
          </div>
        </div>
        {petrolPumpForm.gst_registered === 'Registered' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-800">GST Registration Type</Label>
              <Combobox
                options={activeGstRegTypes.map((r: any) => ({ value: r.name, label: r.name }))}
                value={petrolPumpForm.gst_registration_type ?? ""}
                onValueChange={val => handlePetrolPumpFieldChangeAttempt('GST Registration Type', 'gst', () => setPetrolPumpForm((prev: any) => ({ ...prev, gst_registration_type: val })))}
                placeholder="Select type"
                searchPlaceholder="Search..."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-800">GST W.E.F. Date</Label>
              <Input type="date" className="text-xs" value={petrolPumpForm.gst_registration_wef?.split('T')[0] ?? ""} onChange={e => handlePetrolPumpFieldChangeAttempt('GST W.E.F Date', 'gst', () => setPetrolPumpForm((prev: any) => ({ ...prev, gst_registration_wef: e.target.value })))} />
            </div>
          </div>
        )}
      </div>

      {/* MSME Details */}
      <div className="space-y-3 border-t pt-4">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
          <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
            <Building2 className="h-4.5 w-4.5 text-blue-600" />
            <span>MSME Details</span>
          </Label>
          {editingItem?.id && (
            <PetrolPumpSectionalHistoryTable
              section="msme"
              petrolPumpId={editingItem.id}
              petrolPumpName={petrolPumpForm.petrol_pump_name}
              title="MSME History"
              onOpenView={(sec) => setPetrolPumpEffectiveDatesSection(sec)}
            />
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-800">MSME Registration No</Label>
            <Input
              className={`text-xs ${editingItem?.id ? 'cursor-pointer' : ''}`}
              value={petrolPumpForm.msme_registration_no ?? ""}
              readOnly={!!editingItem?.id}
              onFocus={() => { if (editingItem?.id) handlePetrolPumpFieldChangeAttempt('MSME Registration No', 'msme', () => {}) }}
              onChange={e => handlePetrolPumpFieldChangeAttempt('MSME Registration No', 'msme', () => setPetrolPumpForm((prev: any) => ({ ...prev, msme_registration_no: e.target.value })))}
              placeholder="Enter MSME registration no"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-800">MSME Registration Type</Label>
            <Combobox
              options={activeMsmeRegTypes.map((r: any) => ({ value: r.name, label: r.name }))}
              value={petrolPumpForm.msme_registration_type ?? ""}
              onValueChange={val => handlePetrolPumpFieldChangeAttempt('MSME Registration Type', 'msme', () => setPetrolPumpForm((prev: any) => ({ ...prev, msme_registration_type: val })))}
              placeholder="Select type"
              searchPlaceholder="Search..."
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-800">MSME W.E.F. Date</Label>
            <Input type="date" className="text-xs" value={petrolPumpForm.msme_registration_wef?.split('T')[0] ?? ""} onChange={e => handlePetrolPumpFieldChangeAttempt('MSME W.E.F Date', 'msme', () => setPetrolPumpForm((prev: any) => ({ ...prev, msme_registration_wef: e.target.value })))} />
          </div>
        </div>
      </div>

      {/* FSSAI Details */}
      <div className="space-y-3 border-t pt-4">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
          <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
            <ShieldCheck className="h-4.5 w-4.5 text-blue-600" />
            <span>FSSAI Details</span>
          </Label>
          {editingItem?.id && (
            <PetrolPumpSectionalHistoryTable
              section="fssai"
              petrolPumpId={editingItem.id}
              petrolPumpName={petrolPumpForm.petrol_pump_name}
              title="FSSAI History"
              onOpenView={(sec) => setPetrolPumpEffectiveDatesSection(sec)}
            />
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-800">FSSAI No</Label>
            <Input
              className={`text-xs ${editingItem?.id ? 'cursor-pointer' : ''}`}
              value={petrolPumpForm.fssai_no ?? ""}
              readOnly={!!editingItem?.id}
              onFocus={() => { if (editingItem?.id) handlePetrolPumpFieldChangeAttempt('FSSAI No', 'fssai', () => {}) }}
              onChange={e => handlePetrolPumpFieldChangeAttempt('FSSAI No', 'fssai', () => setPetrolPumpForm((prev: any) => ({ ...prev, fssai_no: e.target.value })))}
              placeholder="Enter FSSAI no"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-800">FSSAI Licence Type</Label>
            <Combobox
              options={activeFssaiLicenceTypes.map((r: any) => ({ value: r.name, label: r.name }))}
              value={petrolPumpForm.fssai_licence_type ?? ""}
              onValueChange={val => handlePetrolPumpFieldChangeAttempt('FSSAI Licence Type', 'fssai', () => setPetrolPumpForm((prev: any) => ({ ...prev, fssai_licence_type: val })))}
              placeholder="Select licence type"
              searchPlaceholder="Search..."
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-800">FSSAI Valid Upto Date</Label>
            <Input type="date" className="text-xs" value={petrolPumpForm.fssai_valid_upto?.split('T')[0] ?? ""} onChange={e => handlePetrolPumpFieldChangeAttempt('FSSAI Valid Upto Date', 'fssai', () => setPetrolPumpForm((prev: any) => ({ ...prev, fssai_valid_upto: e.target.value })))} />
          </div>
        </div>
      </div>

      {/* Document Uploads */}
      <div className="space-y-3 border-t pt-4">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
          <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
            <FileText className="h-4.5 w-4.5 text-blue-600" />
            <span>Document Uploads</span>
          </Label>
          {editingItem?.id && (
            <PetrolPumpSectionalHistoryTable
              section="documents"
              petrolPumpId={editingItem.id}
              petrolPumpName={petrolPumpForm.petrol_pump_name}
              title="Document Uploads History"
              onOpenView={(sec) => setPetrolPumpEffectiveDatesSection(sec)}
            />
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <FileUploadField
            label="Aadhaar Card"
            accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
            value={petrolPumpForm.aadhaar_upload || ""}
            helperText="Max file size: 20 MB"
            uploading={false}
            onFilesSelected={(files) => files[0] && handlePetrolPumpFieldChangeAttempt('Aadhaar Card', 'documents', () => handleFileUpload(files[0], "aadhaar_upload"))}
            onRemove={() => handlePetrolPumpFieldChangeAttempt('Aadhaar Card', 'documents', () => handleFileRemove("aadhaar_upload"))}
          />
          <FileUploadField
            label="PAN Card"
            accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
            value={petrolPumpForm.pan_upload || ""}
            helperText="Max file size: 20 MB"
            uploading={false}
            onFilesSelected={(files) => files[0] && handlePetrolPumpFieldChangeAttempt('PAN Card', 'documents', () => handleFileUpload(files[0], "pan_upload"))}
            onRemove={() => handlePetrolPumpFieldChangeAttempt('PAN Card', 'documents', () => handleFileRemove("pan_upload"))}
          />
          <FileUploadField
            label="GST Certificate"
            accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
            value={petrolPumpForm.gst_certificate_upload || ""}
            helperText="Max file size: 20 MB"
            uploading={false}
            onFilesSelected={(files) => files[0] && handlePetrolPumpFieldChangeAttempt('GST Certificate', 'documents', () => handleFileUpload(files[0], "gst_certificate_upload"))}
            onRemove={() => handlePetrolPumpFieldChangeAttempt('GST Certificate', 'documents', () => handleFileRemove("gst_certificate_upload"))}
          />
          <FileUploadField
            label="MSME Certificate"
            accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
            value={petrolPumpForm.msme_certificate_upload || ""}
            helperText="Max file size: 20 MB"
            uploading={false}
            onFilesSelected={(files) => files[0] && handlePetrolPumpFieldChangeAttempt('MSME Certificate', 'documents', () => handleFileUpload(files[0], "msme_certificate_upload"))}
            onRemove={() => handlePetrolPumpFieldChangeAttempt('MSME Certificate', 'documents', () => handleFileRemove("msme_certificate_upload"))}
          />
          <FileUploadField
            label="FSSAI Certificate"
            accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
            value={petrolPumpForm.fssai_certificate_upload || ""}
            helperText="Max file size: 20 MB"
            uploading={false}
            onFilesSelected={(files) => files[0] && handlePetrolPumpFieldChangeAttempt('FSSAI Certificate', 'documents', () => handleFileUpload(files[0], "fssai_certificate_upload"))}
            onRemove={() => handlePetrolPumpFieldChangeAttempt('FSSAI Certificate', 'documents', () => handleFileRemove("fssai_certificate_upload"))}
          />
        </div>
      </div>
    </div>
  )
}
