"use client"

import React from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Combobox } from "@/components/ui/combobox"
import { FileUploadField } from "@/components/file-upload-field"
import { User, FileText, MapPin } from "lucide-react"
import { STATUS_OPTIONS } from "../types"
import { DriverSectionalHistoryTable } from "@/components/driver-sectional-history-table"

type DriverSectionType = "basic" | "license_rto" | "identity_address"

export interface DriverFormProps {
  driverForm: any
  setDriverForm: React.Dispatch<React.SetStateAction<any>>
  activeRtoCodes: any[]
  activeStates: any[]
  handleFileUpload: (file: File, fieldName: string) => void
  handleFileRemove: (fieldName: string) => void
  editingItem?: any | null
  handleDriverFieldChangeAttempt?: (fieldName: string, section: DriverSectionType, applyChange: () => void) => void
  setDriverEffectiveDatesSection?: (section: DriverSectionType | null) => void
}

export function DriverForm({
  driverForm,
  setDriverForm,
  activeRtoCodes,
  activeStates,
  handleFileUpload,
  handleFileRemove,
  editingItem,
  handleDriverFieldChangeAttempt,
  setDriverEffectiveDatesSection,
}: DriverFormProps) {
  const attemptChange = (fieldName: string, section: DriverSectionType, applyChange: () => void) => {
    if (handleDriverFieldChangeAttempt) {
      handleDriverFieldChangeAttempt(fieldName, section, applyChange)
    } else {
      applyChange()
    }
  }

  const SectionHeader = ({
    title,
    section,
    icon: Icon,
  }: {
    title: string
    section: DriverSectionType
    icon: React.ComponentType<{ className?: string }>
  }) => (
    <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
      <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
        <Icon className="h-4.5 w-4.5 text-blue-600" />
        <span>{title}</span>
      </Label>
      {editingItem?.id && (
        <DriverSectionalHistoryTable
          section={section}
          driverId={editingItem.id}
          onOpenView={(sec) => setDriverEffectiveDatesSection?.(sec)}
        />
      )}
    </div>
  )

  return (
    <div className="space-y-5 py-2">
      {/* 1. Basic Details */}
      <div className="space-y-3">
        <SectionHeader title="Basic Details" section="basic" icon={User} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="driver_master_id" className="text-xs font-semibold text-slate-800">Driver ID *</Label>
            <Input id="driver_master_id" value={driverForm.driver_master_id ?? ""} readOnly className="bg-slate-100 font-mono text-xs cursor-not-allowed" placeholder="Auto-generated" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="status" className="text-xs font-semibold text-slate-800">Status</Label>
            <Select
              value={driverForm.status}
              onValueChange={val => attemptChange("Status", "basic", () => setDriverForm((prev: any) => ({...prev, status: val})))}
            >
              <SelectTrigger className="w-full text-xs"><SelectValue placeholder="Select status" /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="driver_name" className="text-xs font-semibold text-slate-800">Driver Name *</Label>
            <Input
              id="driver_name"
              className="text-xs font-medium"
              value={driverForm.driver_name ?? ""}
              onChange={e => {
                const val = e.target.value
                attemptChange("Driver Name", "basic", () => setDriverForm((prev: any) => ({...prev, driver_name: val})))
              }}
              placeholder="Full Name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mobile_no" className="text-xs font-semibold text-slate-800">Mobile No *</Label>
            <Input
              id="mobile_no"
              className="text-xs font-medium"
              value={driverForm.mobile_no ?? ""}
              onChange={e => {
                const val = e.target.value
                attemptChange("Mobile No", "basic", () => setDriverForm((prev: any) => ({...prev, mobile_no: val})))
              }}
              placeholder="10-digit number"
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
              value={driverForm.email_id ?? ""}
              onChange={e => {
                const val = e.target.value
                attemptChange("Email ID", "basic", () => setDriverForm((prev: any) => ({...prev, email_id: val})))
              }}
              placeholder="email@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pan_no" className="text-xs font-semibold text-slate-800">PAN No</Label>
            <Input
              id="pan_no"
              className="text-xs font-medium"
              value={driverForm.pan_no ?? ""}
              onChange={e => {
                const val = e.target.value
                attemptChange("PAN No", "basic", () => setDriverForm((prev: any) => ({...prev, pan_no: val})))
              }}
              placeholder="Permanent Account Number"
            />
          </div>
        </div>
      </div>

      {/* 2. License & RTO */}
      <div className="border-t border-slate-200 pt-4 space-y-3">
        <SectionHeader title="License & RTO" section="license_rto" icon={FileText} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="driving_licence_no" className="text-xs font-semibold text-slate-800">Driving Licence No *</Label>
            <Input
              id="driving_licence_no"
              className="text-xs font-medium"
              value={driverForm.driving_licence_no ?? ""}
              onChange={e => {
                const val = e.target.value
                attemptChange("Driving Licence No", "license_rto", () => setDriverForm((prev: any) => ({...prev, driving_licence_no: val})))
              }}
              placeholder="DL Number"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="driving_licence_type" className="text-xs font-semibold text-slate-800">DL Type</Label>
            <Input
              id="driving_licence_type"
              className="text-xs font-medium"
              value={driverForm.driving_licence_type ?? ""}
              onChange={e => {
                const val = e.target.value
                attemptChange("DL Type", "license_rto", () => setDriverForm((prev: any) => ({...prev, driving_licence_type: val})))
              }}
              placeholder="e.g. LMV/HMV"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="valid_upto" className="text-xs font-semibold text-slate-800">DL Valid Upto</Label>
            <Input
              id="valid_upto"
              type="date"
              className="text-xs font-medium"
              value={driverForm.valid_upto?.split('T')[0] || ''}
              onChange={e => {
                const val = e.target.value
                attemptChange("DL Valid Upto", "license_rto", () => setDriverForm((prev: any) => ({...prev, valid_upto: val})))
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rto" className="text-xs font-semibold text-slate-800">RTO</Label>
            <Input
              id="rto"
              className="text-xs font-medium"
              value={driverForm.rto ?? ""}
              onChange={e => {
                const val = e.target.value
                attemptChange("RTO", "license_rto", () => setDriverForm((prev: any) => ({...prev, rto: val})))
              }}
              placeholder="RTO"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="trans_valid_upto" className="text-xs font-semibold text-slate-800">Trans Valid Upto</Label>
            <Input
              id="trans_valid_upto"
              type="date"
              className="text-xs font-medium"
              value={driverForm.trans_valid_upto?.split('T')[0] || ''}
              onChange={e => {
                const val = e.target.value
                attemptChange("Trans Valid Upto", "license_rto", () => setDriverForm((prev: any) => ({...prev, trans_valid_upto: val})))
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lmv_valid_upto" className="text-xs font-semibold text-slate-800">LMV Valid Upto</Label>
            <Input
              id="lmv_valid_upto"
              type="date"
              className="text-xs font-medium"
              value={driverForm.lmv_valid_upto?.split('T')[0] || ''}
              onChange={e => {
                const val = e.target.value
                attemptChange("LMV Valid Upto", "license_rto", () => setDriverForm((prev: any) => ({...prev, lmv_valid_upto: val})))
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5 min-w-0">
            <Label htmlFor="rto_id" className="text-xs font-semibold text-slate-800">RTO Code (Reference)</Label>
            <Select
              value={driverForm.rto_id ? String(driverForm.rto_id) : ''}
              onValueChange={val => attemptChange("RTO Code", "license_rto", () => setDriverForm((prev: any) => ({...prev, rto_id: val ? parseInt(val, 10) : null})))}
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
            label="Driving Licence Upload"
            accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
            value={driverForm.dl_upload || ""}
            helperText="Max file size: 20 MB"
            uploading={false}
            onFilesSelected={(files) => {
              if (files[0]) {
                const file = files[0]
                attemptChange("Driving Licence Upload", "license_rto", () => handleFileUpload(file, "dl_upload"))
              }
            }}
            onRemove={() => attemptChange("Driving Licence Upload", "license_rto", () => handleFileRemove("dl_upload"))}
          />
        </div>
      </div>

      {/* 3. Identity & Address */}
      <div className="border-t border-slate-200 pt-4 space-y-3">
        <SectionHeader title="Identity & Address" section="identity_address" icon={MapPin} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="aadhaar_no" className="text-xs font-semibold text-slate-800">Aadhaar No</Label>
            <Input
              id="aadhaar_no"
              className="text-xs font-medium"
              value={driverForm.aadhaar_no ?? ""}
              onChange={e => {
                const val = e.target.value
                attemptChange("Aadhaar No", "identity_address", () => setDriverForm((prev: any) => ({...prev, aadhaar_no: val})))
              }}
              placeholder="12-digit number"
            />
          </div>
          <div className="space-y-1.5">
            <FileUploadField
              label="Aadhaar Upload"
              accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
              value={driverForm.aadhaar_upload || ""}
              helperText="Max file size: 20 MB"
              uploading={false}
              onFilesSelected={(files) => {
                if (files[0]) {
                  const file = files[0]
                  attemptChange("Aadhaar Upload", "identity_address", () => handleFileUpload(file, "aadhaar_upload"))
                }
              }}
              onRemove={() => attemptChange("Aadhaar Upload", "identity_address", () => handleFileRemove("aadhaar_upload"))}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="address_line1" className="text-xs font-semibold text-slate-800">Address</Label>
          <Input
            id="address_line1"
            className="text-xs font-medium"
            value={driverForm.address_line1 ?? ""}
            onChange={e => {
              const val = e.target.value
              attemptChange("Address", "identity_address", () => setDriverForm((prev: any) => ({...prev, address_line1: val})))
            }}
            placeholder="Full address"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5 min-w-0">
            <Label htmlFor="state_id" className="text-xs font-semibold text-slate-800">State</Label>
            <Combobox
              options={activeStates.map((s: any) => ({ value: String(s.id), label: s.state_name }))}
              value={driverForm.state_id ? String(driverForm.state_id) : ""}
              onValueChange={val => {
                const selected = activeStates.find((s: any) => String(s.id) === val)
                attemptChange("State", "identity_address", () => setDriverForm((prev: any) => ({...prev, state_id: val ? parseInt(val, 10) : null, state: selected?.state_name || prev.state })))
              }}
              placeholder="Select state"
              searchPlaceholder="Search state..."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pincode" className="text-xs font-semibold text-slate-800">Pincode</Label>
            <Input
              id="pincode"
              className="text-xs font-medium"
              value={driverForm.pincode ?? ""}
              onChange={e => {
                const val = e.target.value
                attemptChange("Pincode", "identity_address", () => setDriverForm((prev: any) => ({...prev, pincode: val})))
              }}
              placeholder="Pincode"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
