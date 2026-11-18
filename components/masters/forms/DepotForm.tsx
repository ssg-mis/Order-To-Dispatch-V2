"use client"
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Combobox } from "@/components/ui/combobox"
import { AgentTagsPicker, AgentTag } from "@/components/masters/forms/AgentTagsPicker"
import { FileUploadField } from "@/components/file-upload-field"
import { Warehouse, Users, FileText, MapPin, UserCheck } from "lucide-react"
import { AddressLocationFields } from "@/components/masters/forms/AddressLocationFields"
import { DepotSectionalHistoryTable } from "@/components/depot-sectional-history-table"
import { Depot, STATUS_OPTIONS } from "@/components/masters/types"

export interface DepotFormProps {
  editingItem: any | null
  depotForm: Partial<Depot>
  setDepotForm: React.Dispatch<React.SetStateAction<Partial<Depot>>>
  handleDepotFieldChangeAttempt: (
    fieldName: string,
    section: 'basic' | 'tags' | 'assigned' | 'documents',
    applyChange: () => void
  ) => void
  setDepotEffectiveDatesSection: (sec: any) => void
  activeStates: any[]
  brokerOptions?: any[]
  salespersonOptions?: any[]
  customerOptions?: any[]
  ledgerGroupOptions?: any[]
  activeGstRegStatuses?: any[]
  activeGstRegTypes?: any[]
  activeMsmeRegTypes?: any[]
  activeFssaiLicenceTypes?: any[]
  handlePartyPanBlur?: (val?: any) => void
  handlePartyGstinBlur?: (val?: any) => void
  partyFormErrors?: any
  handleFileUpload: (file: File, fieldName: any) => Promise<void> | void
  handleFileRemove: (fieldName: any) => Promise<void> | void
}

export function DepotForm({
  editingItem,
  depotForm,
  setDepotForm,
  handleDepotFieldChangeAttempt,
  setDepotEffectiveDatesSection,
  activeStates,
  brokerOptions,
  salespersonOptions,
  customerOptions,
  handleFileUpload,
  handleFileRemove,
}: DepotFormProps) {
  const handleOpenEffectiveDatesView = useScrollRestoration();

  return (
    <div className="space-y-5 py-2">
      {/* Basic Details */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
          <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
            <Warehouse className="h-4.5 w-4.5 text-blue-600" />
            <span>Depot Basic Details</span>
          </Label>
          {editingItem?.id && (
            <DepotSectionalHistoryTable
              section="basic"
              depotId={editingItem.id}
              depotName={depotForm.depot_name || ''}
              title="Depot History"
              onOpenView={handleOpenEffectiveDatesView((sec: any) => setDepotEffectiveDatesSection(sec))}
            />
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="depot_id" className="text-xs font-semibold text-slate-800">Depot ID *</Label>
            <Input
              id="depot_id"
              value={depotForm.depot_id || ""}
              onChange={e => {
                const val = e.target.value
                handleDepotFieldChangeAttempt('Depot ID', 'basic', () => setDepotForm({ ...depotForm, depot_id: val }))
              }}
              className="bg-white font-mono text-xs"
              placeholder="Auto-generated / Enter ID"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="depot_name" className="text-xs font-semibold text-slate-800">Depot Name *</Label>
            <Input
              id="depot_name"
              value={depotForm.depot_name || ""}
              onChange={e => {
                const val = e.target.value
                handleDepotFieldChangeAttempt('Depot Name', 'basic', () => setDepotForm({...depotForm, depot_name: val}))
              }}
              placeholder="Enter name"
              className="text-xs font-medium"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="status" className="text-xs font-semibold text-slate-800">Status</Label>
            <Select
              value={depotForm.status}
              onValueChange={val => handleDepotFieldChangeAttempt('Status', 'basic', () => setDepotForm({...depotForm, status: val}))}
            >
              <SelectTrigger className="w-full text-xs"><SelectValue placeholder="Select status" /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Depot Address (same fields as the customer Primary Address: address line, state, district, sub-district, thana, post, city, pincode) */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
          <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
            <MapPin className="h-4.5 w-4.5 text-blue-600" />
            <span>Depot Address</span>
          </Label>
        </div>
        <div className="rounded-lg border border-slate-200 p-3 space-y-3 bg-slate-50/40">
          <div className="space-y-1.5">
            <Label htmlFor="depot_address" className="text-xs font-medium text-slate-800">Address Line</Label>
            <Input
              id="depot_address"
              value={depotForm.depot_address || ""}
              onChange={e => {
                const val = e.target.value
                handleDepotFieldChangeAttempt('Depot Address', 'basic', () => setDepotForm({...depotForm, depot_address: val}))
              }}
              placeholder="Address"
              className="text-xs"
            />
          </div>
          <AddressLocationFields
            value={depotForm as any}
            activeStates={activeStates}
            onChange={(patch, label) =>
              handleDepotFieldChangeAttempt(label, 'basic', () => setDepotForm({ ...depotForm, ...patch }))
            }
          />
          <div className="space-y-1.5">
            <Label htmlFor="depot_pincode" className="text-xs font-medium text-slate-800">Pincode</Label>
            <Input
              id="depot_pincode"
              className="font-mono text-xs"
              value={depotForm.pincode || ""}
              onChange={e => {
                const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 6)
                handleDepotFieldChangeAttempt('Pincode', 'basic', () => setDepotForm({ ...depotForm, pincode: val }))
              }}
              placeholder="PIN Code (6 digits)"
            />
          </div>
        </div>
      </div>

      {/* Salesman / Broker Tags */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
          <div>
            <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
              <Users className="h-4.5 w-4.5 text-blue-600" />
              <span>Salesman / Broker Tags</span>
            </Label>
            <p className="text-[11px] text-slate-500">Tag brokers and/or salespersons assigned to this depot (combined list, multi-select).</p>
          </div>
          {editingItem?.id && (
            <DepotSectionalHistoryTable
              section="tags"
              depotId={editingItem.id}
              depotName={depotForm.depot_name || ''}
              title="Salesman / Broker Tags History"
              onOpenView={handleOpenEffectiveDatesView((sec: any) => setDepotEffectiveDatesSection(sec))}
            />
          )}
        </div>
        <AgentTagsPicker
          value={(depotForm.agent_tags || []) as AgentTag[]}
          brokerOptions={brokerOptions}
          salespersonOptions={salespersonOptions}
          onChange={(updated) => handleDepotFieldChangeAttempt('Salesman / Broker Tags', 'tags', () => setDepotForm({ ...depotForm, agent_tags: updated }))}
        />
      </div>

      {/* Document Uploads */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
          <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
            <FileText className="h-4.5 w-4.5 text-blue-600" />
            <span>Document Uploads</span>
          </Label>
          {editingItem?.id && (
            <DepotSectionalHistoryTable
              section="documents"
              depotId={editingItem.id}
              depotName={depotForm.depot_name || ''}
              title="Document Uploads History"
              onOpenView={handleOpenEffectiveDatesView((sec: any) => setDepotEffectiveDatesSection(sec))}
            />
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FileUploadField
            label="Agreement Paper"
            accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
            value={depotForm.agreement_paper_upload || ""}
            helperText="Max file size: 20 MB"
            uploading={false}
            onFilesSelected={(files) => {
              if (files[0]) {
                handleDepotFieldChangeAttempt('Agreement Paper', 'documents', () => handleFileUpload(files[0], "agreement_paper_upload"))
              }
            }}
            onRemove={() => {
              handleDepotFieldChangeAttempt('Agreement Paper', 'documents', () => handleFileRemove("agreement_paper_upload"))
            }}
          />
          <FileUploadField
            label="Depot Owner GST Certificate"
            accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
            value={depotForm.depot_owner_gst_certificate_upload || ""}
            helperText="Max file size: 20 MB"
            uploading={false}
            onFilesSelected={(files) => {
              if (files[0]) {
                handleDepotFieldChangeAttempt('Depot Owner GST Certificate', 'documents', () => handleFileUpload(files[0], "depot_owner_gst_certificate_upload"))
              }
            }}
            onRemove={() => {
              handleDepotFieldChangeAttempt('Depot Owner GST Certificate', 'documents', () => handleFileRemove("depot_owner_gst_certificate_upload"))
            }}
          />
          <FileUploadField
            label="PAN Card"
            accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
            value={depotForm.pan_card_upload || ""}
            helperText="Max file size: 20 MB"
            uploading={false}
            onFilesSelected={(files) => {
              if (files[0]) {
                handleDepotFieldChangeAttempt('PAN Card', 'documents', () => handleFileUpload(files[0], "pan_card_upload"))
              }
            }}
            onRemove={() => {
              handleDepotFieldChangeAttempt('PAN Card', 'documents', () => handleFileRemove("pan_card_upload"))
            }}
          />
          <FileUploadField
            label="Aadhaar Card"
            accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
            value={depotForm.aadhaar_card_upload || ""}
            helperText="Max file size: 20 MB"
            uploading={false}
            onFilesSelected={(files) => {
              if (files[0]) {
                handleDepotFieldChangeAttempt('Aadhaar Card', 'documents', () => handleFileUpload(files[0], "aadhaar_card_upload"))
              }
            }}
            onRemove={() => {
              handleDepotFieldChangeAttempt('Aadhaar Card', 'documents', () => handleFileRemove("aadhaar_card_upload"))
            }}
          />
        </div>
      </div>

      {/* Assigned To (last field) - customer this depot is assigned to */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
          <div>
            <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
              <UserCheck className="h-4.5 w-4.5 text-blue-600" />
              <span>Assigned To</span>
            </Label>
            <p className="text-[11px] text-slate-500">Customer this depot is assigned to (Rent / Freight / Hamali / Royalty / Commission, ledger posting and invoice &amp; payment).</p>
          </div>
          {editingItem?.id && (
            <DepotSectionalHistoryTable
              section="assigned"
              depotId={editingItem.id}
              depotName={depotForm.depot_name || ''}
              title="Assigned To History"
              onOpenView={handleOpenEffectiveDatesView((sec: any) => setDepotEffectiveDatesSection(sec))}
            />
          )}
        </div>
        <div className="space-y-1.5 sm:max-w-md">
          <Label className="text-xs font-semibold text-slate-800">Assigned To</Label>
          <Combobox
            options={(customerOptions || [])
              .filter((c: any) => c.status === 'Active' || c.id === depotForm.assigned_to)
              .map((c: any) => ({ value: String(c.id), label: c.customer_name, subLabel: c.customer_id }))}
            value={depotForm.assigned_to ? String(depotForm.assigned_to) : ""}
            onValueChange={val =>
              handleDepotFieldChangeAttempt('Assigned To', 'assigned', () =>
                setDepotForm({ ...depotForm, assigned_to: val ? parseInt(val, 10) : null }))
            }
            placeholder="Select customer"
            searchPlaceholder="Search customer..."
            emptyText="No customer found."
          />
        </div>
      </div>
    </div>
  )
}
