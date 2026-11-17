"use client"
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Combobox } from "@/components/ui/combobox"
import { MultiCombobox } from "@/components/ui/multi-combobox"
import { sortDepotsBanariFirst } from "@/lib/depot-sort"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Users, MapPin, Receipt, Building2, ShieldCheck, FileText, Warehouse, Landmark, BookOpen } from "lucide-react"
import { FileUploadField } from "@/components/file-upload-field"
import { formatBankLabel, bankSearchKeywords } from "@/lib/dropdown-masters"
import { CustomerSectionalHistoryTable } from "@/components/customer-sectional-history-table"
import { AddressLocationFields } from "@/components/masters/forms/AddressLocationFields"
import { Customer, CustomerAddress, STATUS_OPTIONS, formatDocDate } from "@/components/masters/types"

export interface CustomerFormProps {
  editingItem: any | null
  customerForm: Partial<Customer>
  setCustomerForm: React.Dispatch<React.SetStateAction<Partial<Customer>>>
  customerFormErrors?: { pan?: string; gstin?: string; pincode?: string; contact?: string; email?: string }
  addressErrors?: Record<number, string | undefined>
  bankAccountErrors?: Record<number, string | undefined>
  handleCustomerFieldChangeAttempt: (
    fieldName: string,
    section: 'basic' | 'mailing' | 'gst' | 'msme' | 'fssai' | 'godown' | 'bank' | 'ledger' | 'documents',
    applyChange: () => void
  ) => void
  setCustomerEffectiveDatesSection: (sec: any) => void
  activeStates: any[]
  activeDistricts?: any[]
  activeSubDistricts?: any[]
  activeGstRegStatuses?: any[]
  activeGstRegTypes?: any[]
  activeMsmeRegTypes?: any[]
  activeFssaiLicenceTypes?: any[]
  activeBankNames?: any[]
  godownDepots?: any[]
  ledgerGroupOptions?: any[]
  brokerOptions?: any[]
  salespersonOptions?: any[]
  depotOptions?: any[]
  priceLevelOptions?: any[]
  cdRuleOptions?: any[]
  tdsRuleOptions?: any[]
  handlePartyPanBlur?: (val?: any) => void
  handlePartyGstinBlur?: (val?: any) => void
  partyFormErrors?: any
  handlePanBlur?: () => void
  handleGstinBlur?: () => void
  handlePincodeBlur?: () => void
  handleAddressPincodeBlur?: (index: number, value: string) => void
  handleBankAccountIfscBlur?: (index: number, value: string) => void
  handleAddressStateChange?: (index: number, stateIdVal: string) => void
  updateAddressRow?: (index: number, fields: Partial<CustomerAddress>) => void
  addAddressRow?: () => void
  removeAddressRow?: (index: number) => void
  updateBankAccountRow?: (index: number, fields: any) => void
  addBankAccountRow?: () => void
  removeBankAccountRow?: (index: number) => void
  handleFileUpload: (file: File, fieldName: any) => Promise<void> | void
  handleFileRemove: (fieldName: any) => Promise<void> | void
}

export function CustomerForm({
  editingItem,
  customerForm,
  setCustomerForm,
  customerFormErrors = {},
  addressErrors = {},
  bankAccountErrors = {},
  handleCustomerFieldChangeAttempt,
  setCustomerEffectiveDatesSection,
  activeStates = [],
  activeGstRegStatuses = [],
  activeGstRegTypes = [],
  activeMsmeRegTypes = [],
  activeFssaiLicenceTypes = [],
  activeBankNames = [],
  godownDepots = [],
  ledgerGroupOptions = [],
  handlePanBlur = () => {},
  handleGstinBlur = () => {},
  handlePincodeBlur = () => {},
  handleAddressPincodeBlur = () => {},
  handleBankAccountIfscBlur = () => {},
  handleAddressStateChange = () => {},
  updateAddressRow = () => {},
  addAddressRow = () => {},
  removeAddressRow = () => {},
  updateBankAccountRow = () => {},
  addBankAccountRow = () => {},
  removeBankAccountRow = () => {},
  handleFileUpload,
  handleFileRemove,
}: CustomerFormProps) {
  const handleOpenEffectiveDatesView = useScrollRestoration();
  return (
    <div className="space-y-5 py-2">
      {/* Customer Basic Details */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
          <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
            <Users className="h-4.5 w-4.5 text-blue-600" />
            <span>Customer Basic Details</span>
          </Label>
          {editingItem?.id && (
            <CustomerSectionalHistoryTable
              section="basic"
              customerId={editingItem.id}
              customerName={customerForm.customer_name}
              title="Customer History"
              onOpenView={handleOpenEffectiveDatesView((sec: any) => setCustomerEffectiveDatesSection(sec))}
            />
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="customer_id" className="text-xs font-semibold text-slate-800">Customer ID *</Label>
            <Input id="customer_id" value={customerForm.customer_id || ""} readOnly className="bg-slate-100 font-mono" placeholder="Auto-generated" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="customer_name" className="text-xs font-semibold text-slate-800">Customer Name *</Label>
            <Input
              id="customer_name"
              className="font-medium"
              value={customerForm.customer_name || ""}
              onChange={e => {
                const val = e.target.value
                handleCustomerFieldChangeAttempt("Customer Name", "basic", () => {
                  setCustomerForm(prev => ({ ...prev, customer_name: val }))
                })
              }}
              placeholder="Enter customer name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="status" className="text-xs font-semibold text-slate-800">Status</Label>
            <Select
              value={customerForm.status}
              onValueChange={val => {
                handleCustomerFieldChangeAttempt("Status", "basic", () => {
                  setCustomerForm(prev => ({ ...prev, status: val }))
                })
              }}
            >
              <SelectTrigger className="w-full"><SelectValue placeholder="Select status" /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-semibold text-slate-800">Email</Label>
            <Input
              id="email"
              type="email"
              value={customerForm.email || ""}
              onChange={e => {
                const val = e.target.value
                handleCustomerFieldChangeAttempt("Email", "basic", () => {
                  setCustomerForm(prev => ({ ...prev, email: val }))
                })
              }}
              placeholder="email@example.com"
              className={customerFormErrors.email ? 'border-red-500 focus-visible:ring-red-400' : ''}
            />
            {customerFormErrors.email && <p className="text-xs text-red-500 mt-1">{customerFormErrors.email}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact_person" className="text-xs font-semibold text-slate-800">Contact Person</Label>
            <Input
              id="contact_person"
              value={customerForm.contact_person || ""}
              onChange={e => {
                const val = e.target.value
                handleCustomerFieldChangeAttempt("Contact Person", "basic", () => {
                  setCustomerForm(prev => ({ ...prev, contact_person: val }))
                })
              }}
              placeholder="Enter contact person name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact" className="text-xs font-semibold text-slate-800">Contact Number</Label>
            <Input
              id="contact"
              className="font-mono"
              value={customerForm.contact || ""}
              maxLength={10}
              onChange={e => {
                const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 10)
                handleCustomerFieldChangeAttempt("Contact Number", "basic", () => {
                  setCustomerForm(prev => ({ ...prev, contact: val }))
                })
              }}
              placeholder="10-digit mobile number"
            />
          </div>
        </div>
      </div>

      {/* Primary Address */}
      <div className="border-t border-slate-200 pt-4 space-y-3">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
          <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
            <MapPin className="h-4.5 w-4.5 text-blue-600" />
            <span>Primary Address</span>
          </Label>
          {editingItem?.id && (
            <CustomerSectionalHistoryTable
              section="mailing"
              customerId={editingItem.id}
              customerName={customerForm.customer_name}
              title="Primary Address History"
              onOpenView={handleOpenEffectiveDatesView((sec: any) => setCustomerEffectiveDatesSection(sec))}
            />
          )}
        </div>
        {/* Primary Address (stored on the customer record itself: address line, city, post, thana, state, district, sub-district, pincode) */}
        {(() => {
          const primaryState = activeStates.find((s: any) => String(s.id) === String(customerForm.state_id))
          const setMailing = (label: string, patch: Record<string, any>) =>
            handleCustomerFieldChangeAttempt(label, "mailing", () => {
              setCustomerForm(prev => ({ ...prev, ...patch }))
            })
          return (
            <div className="rounded-lg border border-slate-200 p-3 space-y-3 bg-slate-50/40">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                <span className="text-xs font-bold text-slate-900">Primary Address</span>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address_line_1" className="text-xs font-medium text-slate-800">Address Line</Label>
                <Input
                  id="address_line_1"
                  className="text-xs"
                  value={customerForm.address_line_1 || ""}
                  onChange={e => setMailing("Address Line 1", { address_line_1: e.target.value })}
                  placeholder="Address"
                />
              </div>
              <AddressLocationFields
                value={customerForm as any}
                activeStates={activeStates}
                onChange={(patch, label) => setMailing(label, patch)}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pincode" className="text-xs font-medium text-slate-800">Pincode</Label>
                  <Input
                    id="pincode"
                    className={`font-mono text-xs ${customerFormErrors.pincode ? 'border-red-500 focus-visible:ring-red-400' : ''}`}
                    value={customerForm.pincode || ""}
                    onChange={e => setMailing("Pincode", { pincode: e.target.value.replace(/[^0-9]/g, '').slice(0, 6) })}
                    onBlur={handlePincodeBlur}
                    placeholder="PIN Code (6 digits)"
                  />
                  {customerFormErrors.pincode && <p className="text-xs text-red-500 mt-1">{customerFormErrors.pincode}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-800">Status</Label>
                  <Combobox
                    options={[{ value: "Active", label: "Active" }, { value: "Inactive", label: "Inactive" }]}
                    value={customerForm.primary_address_status || "Active"}
                    onValueChange={val => val && setMailing("Primary Address Status", { primary_address_status: val })}
                    placeholder="Select status"
                    searchPlaceholder="Search..."
                  />
                </div>
              </div>
            </div>
          )
        })()}

        <div className="flex justify-end pt-1">
          <Button type="button" variant="outline" size="sm" className="h-8 px-3 text-xs font-semibold border-slate-300 hover:bg-slate-100 text-slate-800 flex items-center gap-1 shadow-2xs" onClick={addAddressRow}>
            <Plus className="h-3.5 w-3.5 text-blue-600" />
            <span>Add Additional Address</span>
          </Button>
        </div>
        {(customerForm.addresses || []).map((addr, index) => {
          const rowState = activeStates.find((s: any) => String(s.id) === String(addr.state_id))
          return (
            <div key={index} className="rounded-lg border border-slate-200 p-3 space-y-3 bg-slate-50/40">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                <span className="text-xs font-bold text-slate-900">
                  {`Additional Address ${index + 1}`}
                </span>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 font-semibold" onClick={() => removeAddressRow(index)}>Remove</Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-800">Address Line</Label>
                <Input className="text-xs" value={addr.address_line_1 || ''} onChange={e => updateAddressRow(index, { address_line_1: e.target.value })} placeholder="Address" />
              </div>
              <AddressLocationFields
                value={addr as any}
                activeStates={activeStates}
                onChange={(patch) => {
                  const { state: _stateName, ...rest } = patch
                  updateAddressRow(index, rest)
                }}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-800">Pincode</Label>
                  <Input
                    value={addr.pincode || ''}
                    onChange={e => updateAddressRow(index, { pincode: e.target.value.replace(/[^0-9]/g, '').slice(0, 6) })}
                    onBlur={e => handleAddressPincodeBlur(index, e.target.value)}
                    placeholder="PIN Code (6 digits)"
                    className={`font-mono text-xs ${addressErrors[index] ? 'border-red-500 focus-visible:ring-red-400' : ''}`}
                  />
                  {addressErrors[index] && <p className="text-xs text-red-500 mt-1">{addressErrors[index]}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-800">Status</Label>
                  <Combobox
                    options={[{ value: "Active", label: "Active" }, { value: "Inactive", label: "Inactive" }]}
                    value={addr.status || "Active"}
                    onValueChange={val => val && updateAddressRow(index, { status: val })}
                    placeholder="Select status"
                    searchPlaceholder="Search..."
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* GST Registration Details */}
      <div className="border-t border-slate-200 pt-4 space-y-3">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
          <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
            <Receipt className="h-4.5 w-4.5 text-blue-600" />
            <span>GST Registration Details</span>
          </Label>
          {editingItem?.id && (
            <CustomerSectionalHistoryTable
              section="gst"
              customerId={editingItem.id}
              customerName={customerForm.customer_name}
              title="GST Registration History"
              onOpenView={handleOpenEffectiveDatesView((sec: any) => setCustomerEffectiveDatesSection(sec))}
            />
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="pan" className="text-xs font-semibold text-slate-800">PAN</Label>
            <Input
              id="pan"
              className={`uppercase font-mono ${customerFormErrors.pan ? 'border-red-500 focus-visible:ring-red-400' : ''}`}
              value={customerForm.pan || ""}
              onChange={e => {
                const val = e.target.value
                handleCustomerFieldChangeAttempt("PAN", "gst", () => {
                  setCustomerForm(prev => ({ ...prev, pan: val }))
                })
              }}
              onBlur={handlePanBlur}
              placeholder="ABCDE1234F"
            />
            {customerFormErrors.pan && <p className="text-xs text-red-500 mt-1">{customerFormErrors.pan}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gstin" className="text-xs font-semibold text-slate-800">GSTIN</Label>
            <Input
              id="gstin"
              className={`uppercase font-mono ${customerFormErrors.gstin ? 'border-red-500 focus-visible:ring-red-400' : ''}`}
              value={customerForm.gstin || ""}
              onChange={e => {
                const val = e.target.value
                handleCustomerFieldChangeAttempt("GSTIN", "gst", () => {
                  setCustomerForm(prev => ({ ...prev, gstin: val }))
                })
              }}
              onBlur={handleGstinBlur}
              placeholder="22ABCDE1234F1Z5"
            />
            {customerFormErrors.gstin && <p className="text-xs text-red-500 mt-1">{customerFormErrors.gstin}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gst_registered" className="text-xs font-semibold text-slate-800">GST Registration Status</Label>
            <Combobox
              options={activeGstRegStatuses.map((r: any) => ({ value: r.name, label: r.name }))}
              value={customerForm.gst_registered || ""}
              onValueChange={val => {
                handleCustomerFieldChangeAttempt("GST Registration Status", "gst", () => {
                  setCustomerForm(prev => ({
                    ...prev,
                    gst_registered: val,
                    ...(val !== 'Registered' ? { gst_registration_type: '', gst_registration_wef: '' } : {})
                  }))
                })
              }}
              placeholder="Select status"
              searchPlaceholder="Search..."
            />
          </div>
          {customerForm.gst_registered === 'Registered' && (
            <div className="space-y-1.5">
              <Label htmlFor="gst_registration_type" className="text-xs font-semibold text-slate-800">GST Registration Type</Label>
              <Combobox
                options={activeGstRegTypes.map((r: any) => ({ value: r.name, label: r.name }))}
                value={customerForm.gst_registration_type || ""}
                onValueChange={val => {
                  handleCustomerFieldChangeAttempt("GST Registration Type", "gst", () => {
                    setCustomerForm(prev => ({ ...prev, gst_registration_type: val }))
                  })
                }}
                placeholder="Select type"
                searchPlaceholder="Search..."
              />
            </div>
          )}
          {customerForm.gst_registered === 'Registered' && (
            <div className="space-y-1.5">
              <Label htmlFor="gst_registration_wef" className="text-xs font-semibold text-slate-800">GST W.E.F. Date (Applicable From)</Label>
              <Input
                id="gst_registration_wef"
                type="date"
                className={`font-medium ${!customerForm.gst_registration_wef ? 'text-slate-500' : ''}`}
                value={customerForm.gst_registration_wef?.split('T')[0] || ''}
                onChange={e => setCustomerForm({...customerForm, gst_registration_wef: e.target.value})}
              />
              {customerForm.gst_registration_wef && (
                <p className="text-xs text-slate-500">{formatDocDate(customerForm.gst_registration_wef)}</p>
              )}
            </div>
          )}
          
          <div className="space-y-1.5">
            <Label htmlFor="gst_status" className="text-xs font-semibold text-slate-800">Status</Label>
            <Select
              value={customerForm.gst_status || "Active"}
              onValueChange={val => {
                handleCustomerFieldChangeAttempt("Status", "gst", () => {
                  setCustomerForm(prev => ({ ...prev, gst_status: val }))
                })
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        
          <div className="space-y-1.5">
            <Label htmlFor="aadhaar_number" className="text-xs font-semibold text-slate-800">Aadhaar Card Number</Label>
            <Input
              id="aadhaar_number"
              className="font-mono"
              placeholder="12-digit Aadhaar"
              inputMode="numeric"
              maxLength={12}
              value={customerForm.aadhaar_number || ""}
              onChange={e => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 12)
                handleCustomerFieldChangeAttempt("Aadhaar Card Number", "gst", () => {
                  setCustomerForm(prev => ({ ...prev, aadhaar_number: val }))
                })
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-800">Aadhaar Card</Label>
            <FileUploadField
            accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
            value={customerForm.aadhaar_upload || ""}
            helperText="Max file size: 20 MB"
            uploading={false}
            onFilesSelected={(files) => {
              if (files[0]) {
                handleCustomerFieldChangeAttempt("Aadhaar Card Upload", "documents", () => {
                  handleFileUpload(files[0], "aadhaar_upload")
                })
              }
            }}
            onRemove={() => {
              handleCustomerFieldChangeAttempt("Aadhaar Card Removal", "documents", () => {
                handleFileRemove("aadhaar_upload")
              })
            }}
          />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-800">PAN Card</Label>
            <FileUploadField
            accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
            value={customerForm.pan_upload || ""}
            helperText="Max file size: 20 MB"
            uploading={false}
            onFilesSelected={(files) => {
              if (files[0]) {
                handleCustomerFieldChangeAttempt("PAN Card Upload", "documents", () => {
                  handleFileUpload(files[0], "pan_upload")
                })
              }
            }}
            onRemove={() => {
              handleCustomerFieldChangeAttempt("PAN Card Removal", "documents", () => {
                handleFileRemove("pan_upload")
              })
            }}
          />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-800">GST Certificate</Label>
            <FileUploadField
            accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
            value={customerForm.gst_certificate_upload || ""}
            helperText="Max file size: 20 MB"
            uploading={false}
            onFilesSelected={(files) => {
              if (files[0]) {
                handleCustomerFieldChangeAttempt("GST Certificate Upload", "documents", () => {
                  handleFileUpload(files[0], "gst_certificate_upload")
                })
              }
            }}
            onRemove={() => {
              handleCustomerFieldChangeAttempt("GST Certificate Removal", "documents", () => {
                handleFileRemove("gst_certificate_upload")
              })
            }}
          />
          </div>
        </div>
      </div>

      {/* MSME Details */}
      <div className="border-t border-slate-200 pt-4 space-y-3">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
          <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
            <Building2 className="h-4.5 w-4.5 text-blue-600" />
            <span>MSME Details</span>
          </Label>
          {editingItem?.id && (
            <CustomerSectionalHistoryTable
              section="msme"
              customerId={editingItem.id}
              customerName={customerForm.customer_name}
              title="MSME Details History"
              onOpenView={handleOpenEffectiveDatesView((sec: any) => setCustomerEffectiveDatesSection(sec))}
            />
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="msme_registration_no" className="text-xs font-semibold text-slate-800">MSME Registration No</Label>
            <Input
              id="msme_registration_no"
              className="font-mono uppercase"
              value={customerForm.msme_registration_no || ''}
              onChange={e => {
                const val = e.target.value
                handleCustomerFieldChangeAttempt("MSME Registration No", "msme", () => {
                  setCustomerForm(prev => ({ ...prev, msme_registration_no: val }))
                })
              }}
              placeholder="UDYAM-XX-00-0000000"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="msme_registration_type" className="text-xs font-semibold text-slate-800">MSME Registration Type</Label>
            <Combobox
              options={activeMsmeRegTypes.map((r: any) => ({ value: r.name, label: r.name }))}
              value={customerForm.msme_registration_type || ""}
              onValueChange={val => {
                handleCustomerFieldChangeAttempt("MSME Registration Type", "msme", () => {
                  setCustomerForm(prev => ({ ...prev, msme_registration_type: val }))
                })
              }}
              placeholder="Select type"
              searchPlaceholder="Search..."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="msme_activity_type" className="text-xs font-semibold text-slate-800">Activity Type</Label>
            <Select
              value={customerForm.msme_activity_type || ""}
              onValueChange={val => {
                handleCustomerFieldChangeAttempt("Activity Type", "msme", () => {
                  setCustomerForm(prev => ({ ...prev, msme_activity_type: val }))
                })
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select activity type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Unknown">Unknown</SelectItem>
                <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                <SelectItem value="Services">Services</SelectItem>
                <SelectItem value="Trades">Trades</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="msme_registration_wef" className="text-xs font-semibold text-slate-800">MSME W.E.F. Date (Applicable From)</Label>
            <Input
              id="msme_registration_wef"
              type="date"
              className={`font-medium ${!customerForm.msme_registration_wef ? 'text-slate-500' : ''}`}
              value={customerForm.msme_registration_wef?.split('T')[0] || ''}
              onChange={e => {
                const val = e.target.value
                handleCustomerFieldChangeAttempt("MSME W.E.F. Date", "msme", () => {
                  setCustomerForm(prev => ({ ...prev, msme_registration_wef: val }))
                })
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="msme_status" className="text-xs font-semibold text-slate-800">MSME Status</Label>
            <Select
              value={customerForm.msme_status || "Active"}
              onValueChange={val => {
                handleCustomerFieldChangeAttempt("MSME Status", "msme", () => {
                  setCustomerForm(prev => ({ ...prev, msme_status: val }))
                })
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-800">MSME Certificate</Label>
            <FileUploadField
            accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
            value={customerForm.msme_certificate_upload || ""}
            helperText="Max file size: 20 MB"
            uploading={false}
            onFilesSelected={(files) => {
              if (files[0]) {
                handleCustomerFieldChangeAttempt("MSME Certificate Upload", "documents", () => {
                  handleFileUpload(files[0], "msme_certificate_upload")
                })
              }
            }}
            onRemove={() => {
              handleCustomerFieldChangeAttempt("MSME Certificate Removal", "documents", () => {
                handleFileRemove("msme_certificate_upload")
              })
            }}
          />
          </div>
        </div>
      </div>

      {/* FSSAI Details */}
      <div className="border-t border-slate-200 pt-4 space-y-3">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
          <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
            <ShieldCheck className="h-4.5 w-4.5 text-blue-600" />
            <span>FSSAI Details</span>
          </Label>
          {editingItem?.id && (
            <CustomerSectionalHistoryTable
              section="fssai"
              customerId={editingItem.id}
              customerName={customerForm.customer_name}
              title="FSSAI Details History"
              onOpenView={handleOpenEffectiveDatesView((sec: any) => setCustomerEffectiveDatesSection(sec))}
            />
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="fssai_no" className="text-xs font-semibold text-slate-800">FSSAI Licence No</Label>
            <Input
              id="fssai_no"
              className="font-mono"
              value={customerForm.fssai_no || ''}
              onChange={e => {
                const val = e.target.value
                handleCustomerFieldChangeAttempt("FSSAI Licence No", "fssai", () => {
                  setCustomerForm(prev => ({ ...prev, fssai_no: val }))
                })
              }}
              placeholder="14-digit FSSAI No"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fssai_licence_type" className="text-xs font-semibold text-slate-800">FSSAI Licence Type</Label>
            <Combobox
              options={[...activeFssaiLicenceTypes]
                .sort((a: any, b: any) => {
                  const order = ["Registration", "State Licence", "National Licence"]
                  const aIdx = order.indexOf(a.name)
                  const bIdx = order.indexOf(b.name)
                  return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx)
                })
                .map((r: any) => ({ value: r.name, label: r.name }))}
              value={customerForm.fssai_licence_type || ""}
              onValueChange={val => {
                handleCustomerFieldChangeAttempt("FSSAI Licence Type", "fssai", () => {
                  setCustomerForm(prev => ({ ...prev, fssai_licence_type: val }))
                })
              }}
              placeholder="Select licence type"
              searchPlaceholder="Search..."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fssai_registration_wef" className="text-xs font-semibold text-slate-800">FSSAI W.E.F. Date (Applicable From)</Label>
            <Input
              id="fssai_registration_wef"
              type="date"
              className={`font-medium ${!customerForm.fssai_registration_wef ? 'text-slate-500' : ''}`}
              value={customerForm.fssai_registration_wef?.split('T')[0] || ''}
              onChange={e => {
                const val = e.target.value
                handleCustomerFieldChangeAttempt("FSSAI W.E.F. Date", "fssai", () => {
                  setCustomerForm(prev => ({ ...prev, fssai_registration_wef: val }))
                })
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fssai_valid_upto" className="text-xs font-semibold text-slate-800">FSSAI Valid Upto Date</Label>
            <Input
              id="fssai_valid_upto"
              type="date"
              className={`font-medium ${!customerForm.fssai_valid_upto ? 'text-slate-500' : ''}`}
              value={customerForm.fssai_valid_upto?.split('T')[0] || ''}
              onChange={e => {
                const val = e.target.value
                handleCustomerFieldChangeAttempt("FSSAI Valid Upto", "fssai", () => {
                  setCustomerForm(prev => ({ ...prev, fssai_valid_upto: val }))
                })
              }}
            />
            {customerForm.fssai_valid_upto && (
              <p className="text-xs text-slate-500">{formatDocDate(customerForm.fssai_valid_upto)}</p>
            )}
          </div>
        
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-800">FSSAI Certificate</Label>
            <FileUploadField
            accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.pdf"
            value={customerForm.fssai_certificate_upload || ""}
            helperText="Max file size: 20 MB"
            uploading={false}
            onFilesSelected={(files) => {
              if (files[0]) {
                handleCustomerFieldChangeAttempt("FSSAI Certificate Upload", "documents", () => {
                  handleFileUpload(files[0], "fssai_certificate_upload")
                })
              }
            }}
            onRemove={() => {
              handleCustomerFieldChangeAttempt("FSSAI Certificate Removal", "documents", () => {
                handleFileRemove("fssai_certificate_upload")
              })
            }}
          />
          </div>
        </div>
      </div>
      {/* Godown Tagging Details */}
      <div className="border-t border-slate-200 pt-4 space-y-3">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
          <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
            <Warehouse className="h-4.5 w-4.5 text-blue-600" />
            <span>Belongs to Which Godown</span>
          </Label>
          {editingItem?.id && (
            <CustomerSectionalHistoryTable
              section="godown"
              customerId={editingItem.id}
              customerName={customerForm.customer_name}
              title="Godown History"
              onOpenView={handleOpenEffectiveDatesView((sec: any) => setCustomerEffectiveDatesSection(sec))}
            />
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-800">Select Godown(s)</Label>
            <MultiCombobox
              options={sortDepotsBanariFirst(godownDepots).map((d: any) => ({ value: d.id.toString(), label: d.depot_name }))}
              values={(customerForm.godown_ids?.length ? customerForm.godown_ids : [godownDepots?.find(d => d.depot_name?.toLowerCase() === 'banari')?.id].filter(Boolean) as number[]).map(id => String(id))}
              onValuesChange={vals => {
                handleCustomerFieldChangeAttempt("Godown", "godown", () => {
                  setCustomerForm(prev => ({
                    ...prev,
                    godown_ids: vals.map(v => parseInt(v, 10)),
                  }))
                })
              }}
              placeholder="Select godown(s)"
              searchPlaceholder="Search godown..."
            />
          </div>

        </div>
      </div>

      {/* Bank Details */}
      <div className="border-t border-slate-200 pt-4 space-y-3">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
          <Label className="text-slate-900 font-bold text-base flex items-center gap-2">
            <Landmark className="h-4.5 w-4.5 text-blue-600" />
            <span>Bank Details</span>
          </Label>
          {editingItem?.id && (
            <CustomerSectionalHistoryTable
              section="bank"
              customerId={editingItem.id}
              customerName={customerForm.customer_name}
              title="Bank Details History"
              onOpenView={handleOpenEffectiveDatesView((sec: any) => setCustomerEffectiveDatesSection(sec))}
            />
          )}
        </div>
        {(!customerForm.bank_accounts || customerForm.bank_accounts.length === 0) && (
          <div className="flex flex-col items-end space-y-2">
            <p className="text-xs text-slate-400 w-full">No bank details added.</p>
            <Button type="button" variant="outline" size="sm" className="h-8 px-3 text-xs font-semibold border-slate-300 hover:bg-slate-100 text-slate-800 shadow-2xs" onClick={() => {
              addBankAccountRow()
            }}>+ Add Bank Account</Button>
          </div>
        )}
        {(customerForm.bank_accounts || []).map((bank, index) => (
          <div key={index} className="space-y-3 pt-1">
            <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
              <span className="text-xs font-bold text-slate-900">
                {index === 0 ? "Primary Bank Account" : `Additional Bank Account ${index}`}
              </span>
              {index > 0 && (
                <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 font-semibold" onClick={() => {
                  removeBankAccountRow(index)
                }}>
                  Remove Account
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-800">Bank Name</Label>
                <Combobox
                  options={activeBankNames.map((b: any) => ({ value: String(b.id), label: formatBankLabel(b), keywords: bankSearchKeywords(b) }))}
                  value={bank.bank_name_id ? String(bank.bank_name_id) : ""}
                  onValueChange={val => {
                    handleCustomerFieldChangeAttempt(`Bank Name (Account ${index + 1})`, "bank", () => {
                      updateBankAccountRow(index, { bank_name_id: val ? parseInt(val, 10) : null })
                    })
                  }}
                  placeholder="Select bank"
                  searchPlaceholder="Search bank..."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-800">Account Holder Name</Label>
                <Input
                  value={bank.account_holder_name || ''}
                  onChange={e => {
                    const val = e.target.value
                    handleCustomerFieldChangeAttempt(`Account Holder Name (Account ${index + 1})`, "bank", () => {
                      updateBankAccountRow(index, { account_holder_name: val })
                    })
                  }}
                  placeholder="Enter account holder name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-800">Account Number</Label>
                <Input
                  className="font-mono"
                  value={bank.account_number || ''}
                  onChange={e => {
                    const val = e.target.value
                    handleCustomerFieldChangeAttempt(`Account Number (Account ${index + 1})`, "bank", () => {
                      updateBankAccountRow(index, { account_number: val })
                    })
                  }}
                  placeholder="Enter account number"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-800">IFSC Code</Label>
                <Input
                  value={bank.ifsc_code || ''}
                  onChange={e => {
                    const val = e.target.value.toUpperCase()
                    handleCustomerFieldChangeAttempt(`IFSC Code (Account ${index + 1})`, "bank", () => {
                      updateBankAccountRow(index, { ifsc_code: val })
                    })
                  }}
                  onBlur={e => handleBankAccountIfscBlur(index, e.target.value)}
                  placeholder="Enter IFSC code"
                  className={`uppercase font-mono ${bankAccountErrors[index] ? 'border-red-500 focus-visible:ring-red-400' : ''}`}
                />
                {bankAccountErrors[index] && <p className="text-xs text-red-500 mt-1">{bankAccountErrors[index]}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-800">Status</Label>
                <Select
                  value={bank.status || "Active"}
                  onValueChange={(val: "Active" | "Inactive") => {
                    handleCustomerFieldChangeAttempt("Status", "bank", () => {
                      updateBankAccountRow(index, { status: val })
                    })
                  }}
                >
                  <SelectTrigger className="w-full h-9 border-slate-200">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {index === (customerForm.bank_accounts || []).length - 1 && (
              <div className="flex justify-end pt-1">
                <Button type="button" variant="outline" size="sm" className="h-8 px-3 text-xs font-semibold border-slate-300 hover:bg-slate-100 text-slate-800 shadow-2xs" onClick={() => {
                  addBankAccountRow()
                }}>+ Add Bank Account</Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Ledger Group Details */}
      <div className="border-t border-slate-200 pt-4 space-y-3">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
          <Label htmlFor="ledger_group_id" className="text-slate-900 font-bold text-base flex items-center gap-2">
            <BookOpen className="h-4.5 w-4.5 text-blue-600" />
            <span>Ledger Group</span>
          </Label>
          {editingItem?.id && (
            <CustomerSectionalHistoryTable
              section="ledger"
              customerId={editingItem.id}
              customerName={customerForm.customer_name}
              title="Ledger Group History"
              onOpenView={handleOpenEffectiveDatesView((sec: any) => setCustomerEffectiveDatesSection(sec))}
            />
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-800">Select Ledger Group</Label>
          <Select
            value={customerForm.ledger_group_id ? String(customerForm.ledger_group_id) : ''}
            onValueChange={val => {
              handleCustomerFieldChangeAttempt("Ledger Group", "ledger", () => {
                setCustomerForm(prev => ({ ...prev, ledger_group_id: val }))
              })
            }}
          >
            <SelectTrigger className="w-full"><SelectValue placeholder="Select ledger group" /></SelectTrigger>
            <SelectContent>
              {(ledgerGroupOptions || []).map((g: any) => <SelectItem key={g.id} value={String(g.id)}>{g.group_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
