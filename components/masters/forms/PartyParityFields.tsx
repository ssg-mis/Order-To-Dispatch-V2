"use client"
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";

import React from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Combobox } from "@/components/ui/combobox"
import { FileUploadField } from "@/components/file-upload-field"
import { Receipt, Building2, ShieldCheck, FileText } from "lucide-react"
import { SalespersonSectionalHistoryTable } from "../tables/MasterHistoryTables"
import { TransportSectionalHistoryTable } from "@/components/transport-sectional-history-table"

export interface PartyParityFieldsProps {
  form: any
  onChange: (patch: any) => void
  onFieldChangeAttempt?: (fieldName: string, section: 'gst' | 'msme' | 'fssai' | 'documents', applyChange: () => void) => void
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
  editingItem?: any
  isSalesperson?: boolean
  salespersonName?: string
  onOpenSalespersonHistory?: (sec: string) => void
  isTransport?: boolean
  transportName?: string
  onOpenTransportHistory?: (sec: string) => void
}

export function PartyParityFields({
  form,
  onChange,
  onFieldChangeAttempt,
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
  isSalesperson,
  salespersonName,
  onOpenSalespersonHistory,
  isTransport,
  transportName,
  onOpenTransportHistory,
}: PartyParityFieldsProps) {
  const handleOpenEffectiveDatesView = useScrollRestoration();


  const updateField = (fieldName: string, section: 'gst' | 'msme' | 'fssai' | 'documents', applyChange: () => void) => {
    if (onFieldChangeAttempt) {
      onFieldChangeAttempt(fieldName, section, applyChange)
    } else {
      applyChange()
    }
  }

  return (
    <>
      {/* GST & Tax Details */}
      <div className="border-t pt-4 mt-2 space-y-3">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
          <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
            <Receipt className="h-4.5 w-4.5 text-blue-600" />
            <span>GST & Tax Details</span>
          </Label>
          {editingItem?.id && isSalesperson && (
            <SalespersonSectionalHistoryTable
              section="gst"
              salespersonId={editingItem.id}
              salespersonName={salespersonName || ""}
              title="GST & Tax History"
              onOpenView={handleOpenEffectiveDatesView((sec) => onOpenSalespersonHistory?.(sec))}
            />
          )}
          {editingItem?.id && isTransport && (
            <TransportSectionalHistoryTable
              section="gst"
              transportId={editingItem.id}
              title="GST & Tax History"
              onOpenView={handleOpenEffectiveDatesView((sec) => onOpenTransportHistory?.(sec))}
            />
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-800">State</Label>
            <Combobox
              options={activeStates.map((s: any) => ({ value: String(s.id), label: s.state_name }))}
              value={form.state_id ? String(form.state_id) : ""}
              onValueChange={val => {
                const selected = activeStates.find((s: any) => String(s.id) === val)
                updateField('State', 'gst', () => {
                  onChange({ state_id: val ? parseInt(val, 10) : null, state: selected?.state_name || form.state })
                })
              }}
              placeholder="Select state"
              searchPlaceholder="Search state..."
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-800">PAN</Label>
            <Input
              value={form.pan ?? ""}
              onChange={e => {
                const val = e.target.value
                updateField('PAN', 'gst', () => onChange({ pan: val }))
              }}
              onBlur={handlePartyPanBlur}
              placeholder="ABCDE1234F"
              className={`text-xs ${partyFormErrors.pan ? 'border-red-500 focus-visible:ring-red-400' : ''}`}
            />
            {partyFormErrors.pan && <p className="text-xs text-red-500 mt-1">{partyFormErrors.pan}</p>}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-800">GSTIN</Label>
            <Input
              value={form.gstin ?? ""}
              onChange={e => {
                const val = e.target.value
                updateField('GSTIN', 'gst', () => onChange({ gstin: val }))
              }}
              onBlur={handlePartyGstinBlur}
              placeholder="22ABCDE1234F1Z5"
              className={`text-xs ${partyFormErrors.gstin ? 'border-red-500 focus-visible:ring-red-400' : ''}`}
            />
            {partyFormErrors.gstin && <p className="text-xs text-red-500 mt-1">{partyFormErrors.gstin}</p>}
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-800">GST Registration Status</Label>
            <Combobox
              options={activeGstRegStatuses.map((r: any) => ({ value: r.name, label: r.name }))}
              value={form.gst_registered ?? ""}
              onValueChange={val => updateField('GST Registration Status', 'gst', () => onChange({
                gst_registered: val,
                ...(val !== 'Registered' ? { gst_registration_type: '', gst_registration_wef: '' } : {})
              }))}
              placeholder="Select status"
              searchPlaceholder="Search..."
            />
          </div>
        </div>
        {form.gst_registered === 'Registered' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-800">GST Registration Type</Label>
              <Combobox
                options={activeGstRegTypes.map((r: any) => ({ value: r.name, label: r.name }))}
                value={form.gst_registration_type ?? ""}
                onValueChange={val => updateField('GST Registration Type', 'gst', () => onChange({ gst_registration_type: val }))}
                placeholder="Select type"
                searchPlaceholder="Search..."
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-800">GST W.E.F. Date</Label>
              <Input type="date" className="text-xs" value={form.gst_registration_wef?.split('T')[0] ?? ""} onChange={e => {
                const val = e.target.value
                updateField('GST W.E.F. Date', 'gst', () => onChange({ gst_registration_wef: val }))
              }} />
            </div>
          </div>
        )}
      </div>

      {/* MSME Details */}
      <div className="border-t pt-4 mt-2 space-y-4">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
          <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
            <Building2 className="h-4.5 w-4.5 text-blue-600" />
            <span>MSME Details</span>
          </Label>
          {editingItem?.id && isSalesperson && (
            <SalespersonSectionalHistoryTable
              section="msme"
              salespersonId={editingItem.id}
              salespersonName={salespersonName || ""}
              title="MSME History"
              onOpenView={handleOpenEffectiveDatesView((sec) => onOpenSalespersonHistory?.(sec))}
            />
          )}
          {editingItem?.id && isTransport && (
            <TransportSectionalHistoryTable
              section="msme"
              transportId={editingItem.id}
              title="MSME History"
              onOpenView={handleOpenEffectiveDatesView((sec) => onOpenTransportHistory?.(sec))}
            />
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-800">MSME Registration No</Label>
            <Input className="text-xs" value={form.msme_registration_no ?? ""} onChange={e => {
              const val = e.target.value
              updateField('MSME Registration No', 'msme', () => onChange({ msme_registration_no: val }))
            }} placeholder="Enter MSME registration no" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-800">MSME Registration Type</Label>
            <Combobox
              options={activeMsmeRegTypes.map((r: any) => ({ value: r.name, label: r.name }))}
              value={form.msme_registration_type ?? ""}
              onValueChange={val => updateField('MSME Registration Type', 'msme', () => onChange({ msme_registration_type: val }))}
              placeholder="Select type"
              searchPlaceholder="Search..."
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-slate-800">MSME W.E.F. Date</Label>
          <Input type="date" className="text-xs" value={form.msme_registration_wef?.split('T')[0] ?? ""} onChange={e => {
            const val = e.target.value
            updateField('MSME W.E.F. Date', 'msme', () => onChange({ msme_registration_wef: val }))
          }} />
        </div>
      </div>

      {/* FSSAI Details */}
      <div className="border-t pt-4 mt-2 space-y-4">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
          <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
            <ShieldCheck className="h-4.5 w-4.5 text-blue-600" />
            <span>FSSAI Details</span>
          </Label>
          {editingItem?.id && isSalesperson && (
            <SalespersonSectionalHistoryTable
              section="fssai"
              salespersonId={editingItem.id}
              salespersonName={salespersonName || ""}
              title="FSSAI History"
              onOpenView={handleOpenEffectiveDatesView((sec) => onOpenSalespersonHistory?.(sec))}
            />
          )}
          {editingItem?.id && isTransport && (
            <TransportSectionalHistoryTable
              section="fssai"
              transportId={editingItem.id}
              title="FSSAI History"
              onOpenView={handleOpenEffectiveDatesView((sec) => onOpenTransportHistory?.(sec))}
            />
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-800">FSSAI No</Label>
            <Input className="text-xs" value={form.fssai_no ?? ""} onChange={e => {
              const val = e.target.value
              updateField('FSSAI No', 'fssai', () => onChange({ fssai_no: val }))
            }} placeholder="Enter FSSAI no" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-800">FSSAI Licence Type</Label>
            <Combobox
              options={activeFssaiLicenceTypes.map((r: any) => ({ value: r.name, label: r.name }))}
              value={form.fssai_licence_type ?? ""}
              onValueChange={val => updateField('FSSAI Licence Type', 'fssai', () => onChange({ fssai_licence_type: val }))}
              placeholder="Select licence type"
              searchPlaceholder="Search..."
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-slate-800">FSSAI Valid Upto Date</Label>
          <Input type="date" className="text-xs" value={form.fssai_valid_upto?.split('T')[0] ?? ""} onChange={e => {
            const val = e.target.value
            updateField('FSSAI Valid Upto Date', 'fssai', () => onChange({ fssai_valid_upto: val }))
          }} />
        </div>
      </div>

      {/* Document Uploads */}
      <div className="border-t pt-4 mt-2 space-y-4">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
          <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
            <FileText className="h-4.5 w-4.5 text-blue-600" />
            <span>Document Uploads</span>
          </Label>
          {editingItem?.id && isSalesperson && (
            <SalespersonSectionalHistoryTable
              section="documents"
              salespersonId={editingItem.id}
              salespersonName={salespersonName || ""}
              title="Document Uploads History"
              onOpenView={handleOpenEffectiveDatesView((sec) => onOpenSalespersonHistory?.(sec))}
            />
          )}
          {editingItem?.id && isTransport && (
            <TransportSectionalHistoryTable
              section="documents"
              transportId={editingItem.id}
              title="Document Uploads History"
              onOpenView={handleOpenEffectiveDatesView((sec) => onOpenTransportHistory?.(sec))}
            />
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FileUploadField
            label="Aadhaar Card"
            accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
            value={form.aadhaar_upload || ""}
            helperText="Max file size: 20 MB"
            uploading={false}
            onFilesSelected={(files) => files[0] && updateField('Aadhaar Card', 'documents', () => handleFileUpload(files[0], "aadhaar_upload"))}
            onRemove={() => updateField('Aadhaar Card', 'documents', () => handleFileRemove("aadhaar_upload"))}
          />
          <FileUploadField
            label="PAN Card"
            accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
            value={form.pan_upload || ""}
            helperText="Max file size: 20 MB"
            uploading={false}
            onFilesSelected={(files) => files[0] && updateField('PAN Card', 'documents', () => handleFileUpload(files[0], "pan_upload"))}
            onRemove={() => updateField('PAN Card', 'documents', () => handleFileRemove("pan_upload"))}
          />
          <FileUploadField
            label="GST Certificate"
            accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
            value={form.gst_certificate_upload || ""}
            helperText="Max file size: 20 MB"
            uploading={false}
            onFilesSelected={(files) => files[0] && updateField('GST Certificate', 'documents', () => handleFileUpload(files[0], "gst_certificate_upload"))}
            onRemove={() => updateField('GST Certificate', 'documents', () => handleFileRemove("gst_certificate_upload"))}
          />
          <FileUploadField
            label="MSME Certificate"
            accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
            value={form.msme_certificate_upload || ""}
            helperText="Max file size: 20 MB"
            uploading={false}
            onFilesSelected={(files) => files[0] && updateField('MSME Certificate', 'documents', () => handleFileUpload(files[0], "msme_certificate_upload"))}
            onRemove={() => updateField('MSME Certificate', 'documents', () => handleFileRemove("msme_certificate_upload"))}
          />
          <FileUploadField
            label="FSSAI Certificate"
            accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
            value={form.fssai_certificate_upload || ""}
            helperText="Max file size: 20 MB"
            uploading={false}
            onFilesSelected={(files) => files[0] && updateField('FSSAI Certificate', 'documents', () => handleFileUpload(files[0], "fssai_certificate_upload"))}
            onRemove={() => updateField('FSSAI Certificate', 'documents', () => handleFileRemove("fssai_certificate_upload"))}
          />
        </div>
      </div>
    </>
  )
}
