"use client"
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";

import React from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Combobox } from "@/components/ui/combobox"
import { MultiCombobox } from "@/components/ui/multi-combobox"
import { FileUploadField } from "@/components/file-upload-field"
import { Truck, Scale, ShieldCheck, FileText, Satellite, Image as ImageIcon, Lock, Info } from "lucide-react"
import { STATUS_OPTIONS } from "../types"
import { VehicleSectionalHistoryTable } from "@/components/vehicle-sectional-history-table"

type VehicleSectionType = "basic" | "weights" | "tax_compliance" | "permits" | "gps" | "documents"

function AutoCalculatedBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
      <Lock className="h-2.5 w-2.5" /> Auto-calculated
    </span>
  )
}

export interface VehicleFormProps {
  vehicleForm: any
  setVehicleForm: React.Dispatch<React.SetStateAction<any>>
  vehicleFormErrors: any
  setVehicleFormErrors: React.Dispatch<React.SetStateAction<any>>
  roadTaxType: 'expiry' | 'lifetime'
  setRoadTaxType: (val: 'expiry' | 'lifetime') => void
  sortedVehicleTransporters: string[]
  transporterOptions: any[]
  activeRtoCodes: any[]
  handleFileUpload: (file: File, fieldName: string) => void
  handleFileRemove: (fieldName: string) => void
  editingItem?: any | null
  handleVehicleFieldChangeAttempt?: (fieldName: string, section: VehicleSectionType, applyChange: () => void) => void
  setVehicleEffectiveDatesSection?: (section: VehicleSectionType | null) => void
}

export function VehicleForm({
  vehicleForm,
  setVehicleForm,
  vehicleFormErrors,
  setVehicleFormErrors,
  roadTaxType,
  setRoadTaxType,
  sortedVehicleTransporters,
  transporterOptions,
  activeRtoCodes,
  handleFileUpload,
  handleFileRemove,
  editingItem,
  handleVehicleFieldChangeAttempt,
  setVehicleEffectiveDatesSection,
}: VehicleFormProps) {
  const handleOpenEffectiveDatesView = useScrollRestoration();

  const attemptChange = (fieldName: string, section: VehicleSectionType, applyChange: () => void) => {
    if (handleVehicleFieldChangeAttempt) {
      handleVehicleFieldChangeAttempt(fieldName, section, applyChange)
    } else {
      applyChange()
    }
  }

  const isPermitEnabled = vehicleForm.gvw !== '' && Number(vehicleForm.gvw) > 3000

  const SectionHeader = ({
    title,
    section,
    icon: Icon,
  }: {
    title: string
    section: VehicleSectionType
    icon: React.ComponentType<{ className?: string }>
  }) => (
    <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
      <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
        <Icon className="h-4.5 w-4.5 text-blue-600" />
        <span>{title}</span>
      </Label>
      {editingItem?.id && (
        <VehicleSectionalHistoryTable
          section={section}
          vehicleId={editingItem.id}
          onOpenView={handleOpenEffectiveDatesView((sec: any) => setVehicleEffectiveDatesSection?.(sec))}
        />
      )}
    </div>
  )

  return (
    <div className="space-y-5 py-2">
      {/* 1. Basic Details */}
      <div className="space-y-3">
        <SectionHeader title="Basic Details" section="basic" icon={Truck} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="vehicle_master_id" className="text-xs font-semibold text-slate-800">Vehicle ID *</Label>
            <Input id="vehicle_master_id" value={vehicleForm.vehicle_master_id} readOnly className="bg-slate-100 font-mono text-xs cursor-not-allowed" placeholder="Auto-generated" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="registration_no" className="text-xs font-semibold text-slate-800">
              Registration No <span className="text-red-500">*</span>
            </Label>
            <Input
              id="registration_no"
              value={vehicleForm.registration_no}
              onChange={e => {
                const val = e.target.value
                attemptChange("Registration No", "basic", () => setVehicleForm((prev: any) => ({...prev, registration_no: val})))
                setVehicleFormErrors((prev: any) => ({...prev, registration_no: undefined}))
              }}
              placeholder="e.g. CG04JD1234"
              className={`text-xs font-medium ${vehicleFormErrors.registration_no ? 'border-red-500 focus-visible:ring-red-400' : ''}`}
            />
            {vehicleFormErrors.registration_no && <p className="text-[11px] text-red-500">{vehicleFormErrors.registration_no}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="vehicle_type" className="text-xs font-semibold text-slate-800">
              Vehicle Type <span className="text-red-500">*</span>
            </Label>
            <Input
              id="vehicle_type"
              className={`text-xs font-medium ${vehicleFormErrors.vehicle_type ? 'border-red-500 focus-visible:ring-red-400' : ''}`}
              value={vehicleForm.vehicle_type}
              onChange={e => {
                const val = e.target.value
                attemptChange("Vehicle Type", "basic", () => setVehicleForm((prev: any) => ({...prev, vehicle_type: val})))
                setVehicleFormErrors((prev: any) => ({...prev, vehicle_type: undefined}))
              }}
              placeholder="e.g. Truck"
            />
            {vehicleFormErrors.vehicle_type && <p className="text-[11px] text-red-500">{vehicleFormErrors.vehicle_type}</p>}
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label htmlFor="transporter" className="text-xs font-semibold text-slate-800">
              Transporter <span className="text-red-500">*</span>
            </Label>
            <Combobox
              options={sortedVehicleTransporters.map(name => ({ value: name, label: name }))}
              value={vehicleForm.transporter}
              onValueChange={val => {
                attemptChange("Transporter", "basic", () => setVehicleForm((prev: any) => ({...prev, transporter: val})))
                setVehicleFormErrors((prev: any) => ({...prev, transporter: undefined}))
              }}
              placeholder="Select transporter"
              searchPlaceholder="Search transporter..."
              className={vehicleFormErrors.transporter ? 'border-red-500' : ''}
            />
            {vehicleFormErrors.transporter && <p className="text-[11px] text-red-500">{vehicleFormErrors.transporter}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="status" className="text-xs font-semibold text-slate-800">Status</Label>
            <Select
              value={vehicleForm.status}
              onValueChange={val => attemptChange("Status", "basic", () => setVehicleForm((prev: any) => ({...prev, status: val})))}
            >
              <SelectTrigger className="w-full text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fuel_type" className="text-xs font-semibold text-slate-800">Fuel Type</Label>
            <Select
              value={vehicleForm.fuel_type || 'Diesel'}
              onValueChange={val => attemptChange("Fuel Type", "basic", () => setVehicleForm((prev: any) => ({...prev, fuel_type: val, ...(val === 'Electrical' ? { pollution: '' } : {})})))}
            >
              <SelectTrigger className="w-full text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Diesel">Diesel</SelectItem>
                <SelectItem value="Petrol">Petrol</SelectItem>
                <SelectItem value="Electrical">Electrical</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="rto" className="text-xs font-semibold text-slate-800">RTO</Label>
            <Input
              id="rto"
              className="text-xs font-medium"
              value={vehicleForm.rto || ''}
              onChange={e => {
                const val = e.target.value
                attemptChange("RTO", "basic", () => setVehicleForm((prev: any) => ({...prev, rto: val})))
              }}
              placeholder="RTO"
            />
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label htmlFor="rto_id" className="text-xs font-semibold text-slate-800">RTO Code (Reference)</Label>
            <Select
              value={vehicleForm.rto_id ? String(vehicleForm.rto_id) : ''}
              onValueChange={val => attemptChange("RTO Code", "basic", () => setVehicleForm((prev: any) => ({...prev, rto_id: val})))}
            >
              <SelectTrigger className="w-full text-xs"><SelectValue placeholder="Select RTO code" /></SelectTrigger>
              <SelectContent>
                {activeRtoCodes.map((r: any) => <SelectItem key={r.id} value={String(r.id)}>{r.code} - {r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <FileUploadField
            label="RC (Registration Certificate)"
            accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif"
            value={vehicleForm.rc_image}
            helperText="Max file size: 20 MB"
            uploading={false}
            onFilesSelected={(files) => files[0] && handleFileUpload(files[0], "rc_image")}
            onRemove={() => handleFileRemove("rc_image")}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-800">Additional Transporters</Label>
          <p className="text-[11px] text-slate-500 flex items-center gap-1">
            <Info className="h-3 w-3 text-slate-400 shrink-0" />
            <span>Tag more transporters this vehicle can be associated with, alongside the primary Transporter above.</span>
          </p>
          <MultiCombobox
            options={transporterOptions.map((t: any) => ({ value: String(t.id), label: t.transporter_name }))}
            values={(vehicleForm.additional_transporter_ids || []).map((id: number) => String(id))}
            onValuesChange={(vals) => {
              const ids = vals.map((v) => parseInt(v, 10))
              attemptChange("Additional Transporters", "basic", () => setVehicleForm((prev: any) => ({ ...prev, additional_transporter_ids: ids })))
            }}
            placeholder="Select additional transporters"
            searchPlaceholder="Search transporters..."
          />
        </div>
      </div>

      {/* 2. Weights */}
      <div className="border-t border-slate-200 pt-4 space-y-3">
        <SectionHeader title="Weights" section="weights" icon={Scale} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="gvw" className="text-xs font-semibold text-slate-800">GVW (KGS)</Label>
            <Input
              id="gvw"
              type="number"
              className="text-xs font-medium"
              value={vehicleForm.gvw}
              onChange={e => {
                const gvw = e.target.value
                attemptChange("GVW (KGS)", "weights", () => {
                  const ulw = vehicleForm.ulw
                  const passing = gvw !== '' && ulw !== '' ? String(Number(gvw) - Number(ulw)) : ''
                  const clearPermit = gvw === '' || Number(gvw) <= 3000
                  setVehicleForm((prev: any) => ({
                    ...prev,
                    gvw,
                    passing,
                    ...(clearPermit
                      ? { state_permit: '', state_permit_image: '', state_permit_type: '', national_permit: '', national_permit_image: '' }
                      : {})
                  }))
                })
              }}
              placeholder="0"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ulw" className="text-xs font-semibold text-slate-800">ULW (KGS)</Label>
            <Input
              id="ulw"
              type="number"
              className="text-xs font-medium"
              value={vehicleForm.ulw}
              onChange={e => {
                const ulw = e.target.value
                attemptChange("ULW (KGS)", "weights", () => {
                  const gvw = vehicleForm.gvw
                  const passing = gvw !== '' && ulw !== '' ? String(Number(gvw) - Number(ulw)) : ''
                  setVehicleForm((prev: any) => ({...prev, ulw, passing}))
                })
              }}
              placeholder="0"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="passing" className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              Passing (KGS)
              <AutoCalculatedBadge />
            </Label>
            <Input id="passing" type="number" value={vehicleForm.passing} readOnly className="bg-slate-100 text-xs font-medium cursor-not-allowed" placeholder="Auto" />
          </div>
        </div>
      </div>

      {/* 3. Tax & Compliance */}
      <div className="border-t border-slate-200 pt-4 space-y-3">
        <SectionHeader title="Tax & Compliance" section="tax_compliance" icon={ShieldCheck} />

        <div className="rounded-lg border border-slate-200 p-3.5 bg-slate-50/50 space-y-3.5">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-800">Road Tax Option</Label>
            <Select value={roadTaxType} onValueChange={(val: 'expiry' | 'lifetime') => setRoadTaxType(val)}>
              <SelectTrigger className="w-full text-xs bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="expiry">Expiry Date</SelectItem>
                <SelectItem value="lifetime">Life time tax</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {roadTaxType === 'expiry' ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="road_tax" className="text-xs font-semibold text-slate-800">Road Tax Expiry</Label>
                  <Input
                    id="road_tax"
                    type="date"
                    className="text-xs font-medium"
                    value={vehicleForm.road_tax?.split('T')[0] || ''}
                    onChange={e => {
                      const val = e.target.value
                      attemptChange("Road Tax Expiry", "tax_compliance", () => setVehicleForm((prev: any) => ({...prev, road_tax: val})))
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <FileUploadField
                    label="Road Tax Image"
                    accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif"
                    value={vehicleForm.road_tax_image}
                    helperText="Max file size: 20 MB"
                    uploading={false}
                    onFilesSelected={(files) => { if (files[0]) { handleFileUpload(files[0], "road_tax_image"); setVehicleFormErrors((prev: any) => ({ ...prev, road_tax_image: undefined })) } }}
                    onRemove={() => handleFileRemove("road_tax_image")}
                  />
                  {vehicleFormErrors.road_tax_image && (
                    <p className="text-[11px] text-red-500">{vehicleFormErrors.road_tax_image}</p>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-800">Life time tax Date</Label>
                  <Input type="date" value="" disabled className="text-xs" placeholder="No expiry for lifetime tax" />
                </div>
                <div className="space-y-1.5">
                  <FileUploadField
                    label="Life time tax Image"
                    accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif"
                    value={vehicleForm.life_time_tax_image}
                    helperText="Max file size: 20 MB"
                    uploading={false}
                    onFilesSelected={(files) => { if (files[0]) { handleFileUpload(files[0], "life_time_tax_image"); setVehicleFormErrors((prev: any) => ({ ...prev, life_time_tax_image: undefined })) } }}
                    onRemove={() => handleFileRemove("life_time_tax_image")}
                  />
                  {vehicleFormErrors.life_time_tax_image && (
                    <p className="text-[11px] text-red-500">{vehicleFormErrors.life_time_tax_image}</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 p-3.5 bg-slate-50/50 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-800 flex items-center justify-between">
              <span>Pollution Expiry</span>
              {vehicleForm.fuel_type === 'Electrical' && (
                <span className="text-[10px] text-slate-400 font-normal">Not applicable</span>
              )}
            </Label>
            <Input
              type="date"
              className="text-xs font-medium"
              disabled={vehicleForm.fuel_type === 'Electrical'}
              value={vehicleForm.pollution?.split('T')[0] || ''}
              onChange={e => {
                const val = e.target.value
                attemptChange("Pollution Expiry", "tax_compliance", () => setVehicleForm((prev: any) => ({...prev, pollution: val})))
              }}
            />
          </div>
          <div className="space-y-1.5">
            <FileUploadField
              label="Pollution Image"
              accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif"
              value={vehicleForm.pollution_image}
              helperText="Max file size: 20 MB"
              uploading={false}
              onFilesSelected={(files) => { if (files[0]) { handleFileUpload(files[0], "pollution_image"); setVehicleFormErrors((prev: any) => ({ ...prev, pollution_image: undefined })) } }}
              onRemove={() => handleFileRemove("pollution_image")}
            />
            {vehicleFormErrors.pollution_image && (
              <p className="text-[11px] text-red-500">{vehicleFormErrors.pollution_image}</p>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 p-3.5 bg-slate-50/50 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="insurance" className="text-xs font-semibold text-slate-800">Insurance Expiry</Label>
            <Input
              id="insurance"
              type="date"
              className="text-xs font-medium"
              value={vehicleForm.insurance?.split('T')[0] || ''}
              onChange={e => {
                const val = e.target.value
                attemptChange("Insurance Expiry", "tax_compliance", () => setVehicleForm((prev: any) => ({...prev, insurance: val})))
              }}
            />
          </div>
          <div className="space-y-1.5">
            <FileUploadField
              label="Insurance Image"
              accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif"
              value={vehicleForm.insurance_image}
              helperText="Max file size: 20 MB"
              uploading={false}
              onFilesSelected={(files) => { if (files[0]) { handleFileUpload(files[0], "insurance_image"); setVehicleFormErrors((prev: any) => ({ ...prev, insurance_image: undefined })) } }}
              onRemove={() => handleFileRemove("insurance_image")}
            />
            {vehicleFormErrors.insurance_image && (
              <p className="text-[11px] text-red-500">{vehicleFormErrors.insurance_image}</p>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 p-3.5 bg-slate-50/50 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="fitness" className="text-xs font-semibold text-slate-800">Fitness Expiry</Label>
            <Input
              id="fitness"
              type="date"
              className="text-xs font-medium"
              value={vehicleForm.fitness?.split('T')[0] || ''}
              onChange={e => {
                const val = e.target.value
                attemptChange("Fitness Expiry", "tax_compliance", () => setVehicleForm((prev: any) => ({...prev, fitness: val})))
              }}
            />
          </div>
          <div className="space-y-1.5">
            <FileUploadField
              label="Fitness Image"
              accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif"
              value={vehicleForm.fitness_image}
              helperText="Max file size: 20 MB"
              uploading={false}
              onFilesSelected={(files) => { if (files[0]) { handleFileUpload(files[0], "fitness_image"); setVehicleFormErrors((prev: any) => ({ ...prev, fitness_image: undefined })) } }}
              onRemove={() => handleFileRemove("fitness_image")}
            />
            {vehicleFormErrors.fitness_image && (
              <p className="text-[11px] text-red-500">{vehicleFormErrors.fitness_image}</p>
            )}
          </div>
        </div>
      </div>

      {/* 4. Permits */}
      <div className="border-t border-slate-200 pt-4 space-y-3">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
          <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
            <FileText className="h-4.5 w-4.5 text-blue-600" />
            <span>Permits</span>
            {!isPermitEnabled && (
              <span className="text-[10px] text-slate-400 font-normal">(Disabled - GVW must be &gt; 3000 KGS)</span>
            )}
          </Label>
          {editingItem?.id && (
            <VehicleSectionalHistoryTable
              section="permits"
              vehicleId={editingItem.id}
              onOpenView={handleOpenEffectiveDatesView((sec: any) => setVehicleEffectiveDatesSection?.(sec))}
            />
          )}
        </div>

        <div className="rounded-lg border border-slate-200 p-3.5 bg-slate-50/50 space-y-3.5">
          <p className="text-xs font-semibold text-slate-700">State Permit <span className="text-red-500">*</span></p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-800">State Permit Expiry Date</Label>
              <Input
                type="date"
                className="text-xs font-medium"
                disabled={!isPermitEnabled}
                value={vehicleForm.state_permit?.split('T')[0] || ''}
                onChange={e => {
                  const val = e.target.value
                  attemptChange("State Permit Expiry", "permits", () => setVehicleForm((prev: any) => ({...prev, state_permit: val})))
                }}
              />
            </div>
            <div className="space-y-1.5">
              <FileUploadField
                label="State Permit Image"
                disabled={!isPermitEnabled}
                accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif"
                value={vehicleForm.state_permit_image}
                helperText="Max file size: 20 MB"
                uploading={false}
                onFilesSelected={(files) => {
                  if (files[0]) { handleFileUpload(files[0], "state_permit_image"); setVehicleFormErrors((prev: any) => ({ ...prev, state_permit_image: undefined })) }
                }}
                onRemove={() => handleFileRemove("state_permit_image")}
              />
              {vehicleFormErrors.state_permit_image && (
                <p className="text-[11px] text-red-500">{vehicleFormErrors.state_permit_image}</p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 p-3.5 bg-slate-50/50 space-y-3.5">
          <p className="text-xs font-semibold text-slate-700">National Permit</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-800">National Permit Expiry Date</Label>
              <Input
                type="date"
                className="text-xs font-medium"
                disabled={!isPermitEnabled}
                value={vehicleForm.national_permit?.split('T')[0] || ''}
                onChange={e => {
                  const val = e.target.value
                  attemptChange("National Permit Expiry", "permits", () => setVehicleForm((prev: any) => ({...prev, national_permit: val})))
                }}
              />
            </div>
            <div className="space-y-1.5">
              <FileUploadField
                label="National Permit Image"
                disabled={!isPermitEnabled}
                accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif"
                value={vehicleForm.national_permit_image}
                helperText="Max file size: 20 MB"
                uploading={false}
                onFilesSelected={(files) => { if (files[0]) { handleFileUpload(files[0], "national_permit_image"); setVehicleFormErrors((prev: any) => ({ ...prev, national_permit_image: undefined })) } }}
                onRemove={() => handleFileRemove("national_permit_image")}
              />
              {vehicleFormErrors.national_permit_image && (
                <p className="text-[11px] text-red-500">{vehicleFormErrors.national_permit_image}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 5. GPS Tracking */}
      <div className="border-t border-slate-200 pt-4 space-y-3">
        <SectionHeader title="GPS Tracking" section="gps" icon={Satellite} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="gps_company" className="text-xs font-semibold text-slate-800">GPS Company</Label>
            <Input
              id="gps_company"
              className="text-xs font-medium"
              value={vehicleForm.gps_company || ''}
              onChange={e => {
                const val = e.target.value
                attemptChange("GPS Company", "gps", () => setVehicleForm((prev: any) => ({...prev, gps_company: val})))
              }}
              placeholder="e.g. Trackwell"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gps_type" className="text-xs font-semibold text-slate-800">GPS Type</Label>
            <Input
              id="gps_type"
              className="text-xs font-medium"
              value={vehicleForm.gps_type || ''}
              onChange={e => {
                const val = e.target.value
                attemptChange("GPS Type", "gps", () => setVehicleForm((prev: any) => ({...prev, gps_type: val})))
              }}
              placeholder="e.g. OBD, hardwired"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gps_api_tracking_link" className="text-xs font-semibold text-slate-800">GPS API / Tracking Link</Label>
          <Input
            id="gps_api_tracking_link"
            className="text-xs font-medium"
            value={vehicleForm.gps_api_tracking_link || ''}
            onChange={e => {
              const val = e.target.value
              attemptChange("GPS API/Tracking Link", "gps", () => setVehicleForm((prev: any) => ({...prev, gps_api_tracking_link: val})))
            }}
            placeholder="https://..."
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="gps_valid_upto" className="text-xs font-semibold text-slate-800">GPS Valid Upto</Label>
            <Input
              id="gps_valid_upto"
              type="date"
              className="text-xs font-medium"
              value={vehicleForm.gps_valid_upto?.split('T')[0] || ''}
              onChange={e => {
                const val = e.target.value
                attemptChange("GPS Valid Upto", "gps", () => setVehicleForm((prev: any) => ({...prev, gps_valid_upto: val})))
              }}
            />
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label htmlFor="gps_installed_by" className="text-xs font-semibold text-slate-800">GPS Installed By</Label>
            <Select
              value={vehicleForm.gps_installed_by || ''}
              onValueChange={val => attemptChange("GPS Installed By", "gps", () => setVehicleForm((prev: any) => ({...prev, gps_installed_by: val})))}
            >
              <SelectTrigger className="w-full text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Company">Company</SelectItem>
                <SelectItem value="Vehicle Owner">Vehicle Owner</SelectItem>
                <SelectItem value="Transporter">Transporter</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* 6. Documents */}
      {editingItem?.id && (
        <div className="border-t border-slate-200 pt-4 space-y-3">
          <SectionHeader title="Documents" section="documents" icon={ImageIcon} />
          <p className="text-[11px] text-slate-500 flex items-center gap-1">
            <Info className="h-3 w-3 text-slate-400 shrink-0" />
            <span>Every document uploaded above (RC, Road Tax, Pollution, Insurance, Fitness, Permits) is tracked here - use the badge to view upload history.</span>
          </p>
        </div>
      )}
    </div>
  )
}
