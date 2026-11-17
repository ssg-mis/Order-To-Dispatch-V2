"use client"
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";

import React from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Combobox } from "@/components/ui/combobox"
import { FileUploadField } from "@/components/file-upload-field"
import { Briefcase, Receipt, Building2, ShieldCheck, FileText } from "lucide-react"
import { STATUS_OPTIONS } from "../types"
import { BrokerSectionalHistoryTable } from "../tables/MasterHistoryTables"

export interface BrokerFormProps {
  brokerForm: any
  setBrokerForm: React.Dispatch<React.SetStateAction<any>>
  editingItem: any
  handleBrokerFieldChangeAttempt: (fieldName: string, section: any, applyChange: () => void) => void
  setBrokerEffectiveDatesSection: (section: any) => void
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

export function BrokerForm({
  brokerForm,
  setBrokerForm,
  editingItem,
  handleBrokerFieldChangeAttempt,
  setBrokerEffectiveDatesSection,
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
}: BrokerFormProps) {
  const handleOpenEffectiveDatesView = useScrollRestoration();

  return (
    <div className="space-y-5 py-2">
      {/* Broker Basic Details */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
          <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
            <Briefcase className="h-4.5 w-4.5 text-blue-600" />
            <span>Broker Basic Details</span>
          </Label>
          {editingItem?.id && (
            <BrokerSectionalHistoryTable
              section="basic"
              brokerId={editingItem.id}
              brokerName={brokerForm.salesman_name}
              title="Broker History"
              onOpenView={handleOpenEffectiveDatesView((sec: any) => setBrokerEffectiveDatesSection(sec))}
            />
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="broker_id" className="text-xs font-semibold text-slate-800">Broker ID *</Label>
            <Input
              id="broker_id"
              value={brokerForm.broker_id || ""}
              onChange={e => {
                const val = e.target.value
                handleBrokerFieldChangeAttempt('Broker ID', 'basic', () => setBrokerForm((prev: any) => ({ ...prev, broker_id: val })))
              }}
              className="bg-slate-100 font-mono text-xs"
              placeholder="Auto-generated / Enter ID"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="salesman_name" className="text-xs font-semibold text-slate-800">Broker Name *</Label>
            <Input
              id="salesman_name"
              value={brokerForm.salesman_name || ""}
              onChange={e => {
                const val = e.target.value
                handleBrokerFieldChangeAttempt('Broker Name', 'basic', () => setBrokerForm((prev: any) => ({ ...prev, salesman_name: val })))
              }}
              placeholder="Enter name"
              className="text-xs font-medium"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="status" className="text-xs font-semibold text-slate-800">Status</Label>
            <Select
              value={brokerForm.status}
              onValueChange={val => handleBrokerFieldChangeAttempt('Status', 'basic', () => setBrokerForm((prev: any) => ({ ...prev, status: val })))}
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
              value={brokerForm.mobile_no || ""}
              onChange={e => {
                const val = e.target.value
                handleBrokerFieldChangeAttempt('Mobile Number', 'basic', () => setBrokerForm((prev: any) => ({ ...prev, mobile_no: val })))
              }}
              placeholder="Enter number"
              className="text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email_id" className="text-xs font-semibold text-slate-800">Email ID</Label>
            <Input
              id="email_id"
              value={brokerForm.email_id || ""}
              onChange={e => {
                const val = e.target.value
                handleBrokerFieldChangeAttempt('Email ID', 'basic', () => setBrokerForm((prev: any) => ({ ...prev, email_id: val })))
              }}
              placeholder="email@example.com"
              className="text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ledger_group_id" className="text-xs font-semibold text-slate-800">Ledger Group</Label>
            <Select
              value={brokerForm.ledger_group_id ? String(brokerForm.ledger_group_id) : ''}
              onValueChange={val => handleBrokerFieldChangeAttempt('Ledger Group', 'basic', () => setBrokerForm((prev: any) => ({ ...prev, ledger_group_id: val })))}
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
            <BrokerSectionalHistoryTable
              section="gst"
              brokerId={editingItem.id}
              brokerName={brokerForm.salesman_name}
              title="GST & Tax History"
              onOpenView={handleOpenEffectiveDatesView((sec: any) => setBrokerEffectiveDatesSection(sec))}
            />
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-800">State</Label>
            <Combobox
              options={activeStates.map((s: any) => ({ value: String(s.id), label: [s.gst_state_code, s.short_name, s.state_name].filter(Boolean).join(" ") }))}
              value={brokerForm.state_id ? String(brokerForm.state_id) : ""}
              onValueChange={val => {
                const selected = activeStates.find((s: any) => String(s.id) === val)
                handleBrokerFieldChangeAttempt('State', 'gst', () => setBrokerForm((prev: any) => ({ ...prev, state_id: val ? parseInt(val, 10) : null, state: selected?.state_name || brokerForm.state })))
              }}
              placeholder="Select state"
              searchPlaceholder="Search state..."
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-800">PAN</Label>
            <Input
              value={brokerForm.pan ?? ""}
              onChange={e => handleBrokerFieldChangeAttempt('PAN', 'gst', () => setBrokerForm((prev: any) => ({ ...prev, pan: e.target.value })))}
              onBlur={handlePartyPanBlur}
              placeholder="ABCDE1234F"
              className={`text-xs ${partyFormErrors.pan ? 'border-red-500 focus-visible:ring-red-400' : ''}`}
            />
            {partyFormErrors.pan && <p className="text-xs text-red-500 mt-1">{partyFormErrors.pan}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-800">GSTIN</Label>
            <Input
              value={brokerForm.gstin ?? ""}
              onChange={e => handleBrokerFieldChangeAttempt('GSTIN', 'gst', () => setBrokerForm((prev: any) => ({ ...prev, gstin: e.target.value })))}
              onBlur={handlePartyGstinBlur}
              placeholder="22ABCDE1234F1Z5"
              className={`text-xs ${partyFormErrors.gstin ? 'border-red-500 focus-visible:ring-red-400' : ''}`}
            />
            {partyFormErrors.gstin && <p className="text-xs text-red-500 mt-1">{partyFormErrors.gstin}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-800">GST Registration Status</Label>
            <Combobox
              options={activeGstRegStatuses.map((r: any) => ({ value: r.name, label: r.name }))}
              value={brokerForm.gst_registered ?? ""}
              onValueChange={val => handleBrokerFieldChangeAttempt('GST Registration Status', 'gst', () => setBrokerForm((prev: any) => ({
                ...prev,
                gst_registered: val,
                ...(val !== 'Registered' ? { gst_registration_type: '', gst_registration_wef: '' } : {})
              })))}
              placeholder="Select status"
              searchPlaceholder="Search..."
            />
          </div>
        </div>
        {brokerForm.gst_registered === 'Registered' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-800">GST Registration Type</Label>
              <Combobox
                options={activeGstRegTypes.map((r: any) => ({ value: r.name, label: r.name }))}
                value={brokerForm.gst_registration_type ?? ""}
                onValueChange={val => handleBrokerFieldChangeAttempt('GST Registration Type', 'gst', () => setBrokerForm((prev: any) => ({ ...prev, gst_registration_type: val })))}
                placeholder="Select type"
                searchPlaceholder="Search..."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-800">GST W.E.F. Date</Label>
              <Input type="date" className="text-xs" value={brokerForm.gst_registration_wef?.split('T')[0] ?? ""} onChange={e => handleBrokerFieldChangeAttempt('GST W.E.F Date', 'gst', () => setBrokerForm((prev: any) => ({ ...prev, gst_registration_wef: e.target.value })))} />
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
            <BrokerSectionalHistoryTable
              section="msme"
              brokerId={editingItem.id}
              brokerName={brokerForm.salesman_name}
              title="MSME History"
              onOpenView={handleOpenEffectiveDatesView((sec: any) => setBrokerEffectiveDatesSection(sec))}
            />
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-800">MSME Registration No</Label>
            <Input className="text-xs" value={brokerForm.msme_registration_no ?? ""} onChange={e => handleBrokerFieldChangeAttempt('MSME Registration No', 'msme', () => setBrokerForm((prev: any) => ({ ...prev, msme_registration_no: e.target.value })))} placeholder="Enter MSME registration no" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-800">MSME Registration Type</Label>
            <Combobox
              options={activeMsmeRegTypes.map((r: any) => ({ value: r.name, label: r.name }))}
              value={brokerForm.msme_registration_type ?? ""}
              onValueChange={val => handleBrokerFieldChangeAttempt('MSME Registration Type', 'msme', () => setBrokerForm((prev: any) => ({ ...prev, msme_registration_type: val })))}
              placeholder="Select type"
              searchPlaceholder="Search..."
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-800">MSME W.E.F. Date</Label>
            <Input type="date" className="text-xs" value={brokerForm.msme_registration_wef?.split('T')[0] ?? ""} onChange={e => handleBrokerFieldChangeAttempt('MSME W.E.F Date', 'msme', () => setBrokerForm((prev: any) => ({ ...prev, msme_registration_wef: e.target.value })))} />
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
            <BrokerSectionalHistoryTable
              section="fssai"
              brokerId={editingItem.id}
              brokerName={brokerForm.salesman_name}
              title="FSSAI History"
              onOpenView={handleOpenEffectiveDatesView((sec: any) => setBrokerEffectiveDatesSection(sec))}
            />
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-800">FSSAI No</Label>
            <Input className="text-xs" value={brokerForm.fssai_no ?? ""} onChange={e => handleBrokerFieldChangeAttempt('FSSAI No', 'fssai', () => setBrokerForm((prev: any) => ({ ...prev, fssai_no: e.target.value })))} placeholder="Enter FSSAI no" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-800">FSSAI Licence Type</Label>
            <Combobox
              options={activeFssaiLicenceTypes.map((r: any) => ({ value: r.name, label: r.name }))}
              value={brokerForm.fssai_licence_type ?? ""}
              onValueChange={val => handleBrokerFieldChangeAttempt('FSSAI Licence Type', 'fssai', () => setBrokerForm((prev: any) => ({ ...prev, fssai_licence_type: val })))}
              placeholder="Select licence type"
              searchPlaceholder="Search..."
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-800">FSSAI Valid Upto Date</Label>
            <Input type="date" className="text-xs" value={brokerForm.fssai_valid_upto?.split('T')[0] ?? ""} onChange={e => handleBrokerFieldChangeAttempt('FSSAI Valid Upto Date', 'fssai', () => setBrokerForm((prev: any) => ({ ...prev, fssai_valid_upto: e.target.value })))} />
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
            <BrokerSectionalHistoryTable
              section="documents"
              brokerId={editingItem.id}
              brokerName={brokerForm.salesman_name}
              title="Document Uploads History"
              onOpenView={handleOpenEffectiveDatesView((sec: any) => setBrokerEffectiveDatesSection(sec))}
            />
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <FileUploadField
            label="Aadhaar Card"
            accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
            value={brokerForm.aadhaar_upload || ""}
            helperText="Max file size: 20 MB"
            uploading={false}
            onFilesSelected={(files) => files[0] && handleBrokerFieldChangeAttempt('Aadhaar Card', 'documents', () => handleFileUpload(files[0], "aadhaar_upload"))}
            onRemove={() => handleBrokerFieldChangeAttempt('Aadhaar Card', 'documents', () => handleFileRemove("aadhaar_upload"))}
          />
          <FileUploadField
            label="PAN Card"
            accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
            value={brokerForm.pan_upload || ""}
            helperText="Max file size: 20 MB"
            uploading={false}
            onFilesSelected={(files) => files[0] && handleBrokerFieldChangeAttempt('PAN Card', 'documents', () => handleFileUpload(files[0], "pan_upload"))}
            onRemove={() => handleBrokerFieldChangeAttempt('PAN Card', 'documents', () => handleFileRemove("pan_upload"))}
          />
          <FileUploadField
            label="GST Certificate"
            accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
            value={brokerForm.gst_certificate_upload || ""}
            helperText="Max file size: 20 MB"
            uploading={false}
            onFilesSelected={(files) => files[0] && handleBrokerFieldChangeAttempt('GST Certificate', 'documents', () => handleFileUpload(files[0], "gst_certificate_upload"))}
            onRemove={() => handleBrokerFieldChangeAttempt('GST Certificate', 'documents', () => handleFileRemove("gst_certificate_upload"))}
          />
          <FileUploadField
            label="MSME Certificate"
            accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
            value={brokerForm.msme_certificate_upload || ""}
            helperText="Max file size: 20 MB"
            uploading={false}
            onFilesSelected={(files) => files[0] && handleBrokerFieldChangeAttempt('MSME Certificate', 'documents', () => handleFileUpload(files[0], "msme_certificate_upload"))}
            onRemove={() => handleBrokerFieldChangeAttempt('MSME Certificate', 'documents', () => handleFileRemove("msme_certificate_upload"))}
          />
          <FileUploadField
            label="FSSAI Certificate"
            accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
            value={brokerForm.fssai_certificate_upload || ""}
            helperText="Max file size: 20 MB"
            uploading={false}
            onFilesSelected={(files) => files[0] && handleBrokerFieldChangeAttempt('FSSAI Certificate', 'documents', () => handleFileUpload(files[0], "fssai_certificate_upload"))}
            onRemove={() => handleBrokerFieldChangeAttempt('FSSAI Certificate', 'documents', () => handleFileRemove("fssai_certificate_upload"))}
          />
        </div>
      </div>
    </div>
  )
}
