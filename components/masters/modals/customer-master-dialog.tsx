"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, Users } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { CustomerForm } from "@/components/masters/forms/CustomerForm"
import {
  type Customer, type CustomerAddress, type CustomerBankAccount,
  blankCustomerAddress, blankCustomerBankAccount,
  PAN_REGEX, GSTIN_REGEX, PINCODE_REGEX, IFSC_REGEX, normalizeGstField,
} from "@/components/masters/types"
import { customerApi, commonApi, orderApi, stateApi, lookupApi, ledgerGroupApi, depotApi, type LookupType } from "@/lib/api-service"

// Add / Edit Customer dialog that reuses the Master page's CustomerForm.
// Submitting goes through the normal approval flow (non-admin => pending).
interface CustomerMasterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingCustomer: any | null
  onSaved: () => void | Promise<void>
}

type FormErrors = { pan?: string; gstin?: string; pincode?: string; contact?: string; email?: string }

const initialCustomerForm = (): Partial<Customer> => ({
  customer_id: "",
  customer_name: "",
  status: "Active",
  contact_person: "",
  contact: "",
  email: "",
  address_line_1: "",
  address_line_2: "",
  state: "",
  pincode: "",
  pan: "",
  gstin: "",
  gst_registered: "",
  gst_registration_type: "",
  gst_registration_wef: "",
  msme_registration_no: "",
  msme_registration_type: "",
  msme_registration_wef: "",
  fssai_no: "",
  fssai_registration_wef: "",
  fssai_valid_upto: "",
  fssai_licence_type: "",
  aadhaar_upload: "",
  pan_upload: "",
  gst_certificate_upload: "",
  msme_certificate_upload: "",
  fssai_certificate_upload: "",
  addresses: [],
  godown_ids: [],
  is_required_for_commitment: "No",
  bank_accounts: [blankCustomerBankAccount()],
})

const lookupQuery = (key: LookupType) => ({
  queryKey: [`lookup-${key}`],
  queryFn: async () => {
    const res = await lookupApi.getAll(key, { page: 1, limit: 1000, all: "true" })
    return res.success ? (res.data.items || []) : []
  },
  staleTime: 5 * 60 * 1000,
})

export function CustomerMasterDialog({ open, onOpenChange, editingCustomer, onSaved }: CustomerMasterDialogProps) {
  const { toast } = useToast()
  const [form, setForm] = useState<Partial<Customer>>(initialCustomerForm)
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [addressErrors, setAddressErrors] = useState<Record<number, string | undefined>>({})
  const [bankAccountErrors, setBankAccountErrors] = useState<Record<number, string | undefined>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data: statesData } = useQuery({
    queryKey: ["master-states"],
    queryFn: async () => {
      const res = await stateApi.getAll({ page: 1, limit: 1000, all: "true" })
      return res.success ? (res.data.states || []) : []
    },
    staleTime: 5 * 60 * 1000,
  })
  const activeStates = useMemo(() => (statesData || []).filter((s: any) => s.status === "Active"), [statesData])

  const { data: gstRegStatusData } = useQuery(lookupQuery("is_gst_registered"))
  const { data: gstRegTypeData } = useQuery(lookupQuery("gst_registration_type"))
  const { data: msmeRegTypeData } = useQuery(lookupQuery("msme_registration_type"))
  const { data: fssaiLicenceTypeData } = useQuery(lookupQuery("fssai_licence_type"))
  const { data: bankNameData } = useQuery(lookupQuery("bank_name"))
  const activeOf = (rows: any[] | undefined) => (rows || []).filter((r: any) => r.status === "Active")
  const activeMsmeRegTypes = useMemo(() => {
    const orderMap: Record<string, number> = { Micro: 1, Small: 2, Medium: 3 }
    return activeOf(msmeRegTypeData).sort((a: any, b: any) => (orderMap[a.name] || 99) - (orderMap[b.name] || 99))
  }, [msmeRegTypeData])

  const { data: godownDepots } = useQuery({
    queryKey: ["all-active-depots"],
    queryFn: async () => {
      const res = await depotApi.getAll({ page: 1, limit: 1000, all: "true" })
      return res.success ? (res.data.depots || []) : []
    },
    staleTime: 5 * 60 * 1000,
    enabled: open,
  })
  const { data: ledgerGroupOptions } = useQuery({
    queryKey: ["ledger-group-options"],
    queryFn: async () => {
      const res = await ledgerGroupApi.getAll({ all: "true" })
      return res.success ? (res.data?.ledger_groups || []) : []
    },
    enabled: open,
  })

  // Load the form each time the dialog opens: full record when editing, a
  // fresh form with the next customer id when adding.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setFormErrors({})
    setAddressErrors({})
    setBankAccountErrors({})
    const withBank = (data: any): Partial<Customer> => ({
      ...initialCustomerForm(),
      ...data,
      bank_accounts: Array.isArray(data?.bank_accounts) && data.bank_accounts.length > 0 ? data.bank_accounts : [blankCustomerBankAccount()],
    })
    if (editingCustomer?.id) {
      setForm(withBank(editingCustomer))
      customerApi.getById(editingCustomer.id).then((res: any) => {
        if (!cancelled && res?.success && res.data) setForm(withBank(res.data))
      }).catch(() => {})
    } else {
      setForm(initialCustomerForm())
      commonApi.getNextId("customer").then((res: any) => {
        if (!cancelled && res?.success && res.data?.nextId) setForm((prev) => ({ ...prev, customer_id: res.data.nextId }))
      }).catch(() => {})
    }
    return () => { cancelled = true }
  }, [open, editingCustomer?.id])

  const handleFileUpload = async (file: File, fieldName: string) => {
    try {
      const res = await orderApi.uploadFile(file)
      if (res.success) {
        setForm((prev: any) => ({ ...prev, [fieldName]: res.data.url }))
        toast({ title: "Upload Successful", description: `${file.name} has been uploaded.` })
      } else {
        toast({ title: "Upload Failed", description: res.message || "Failed to upload file", variant: "destructive" })
      }
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err.message || "Failed to upload file", variant: "destructive" })
    }
  }
  const handleFileRemove = (fieldName: string) => setForm((prev: any) => ({ ...prev, [fieldName]: "" }))

  const handlePanBlur = () => {
    const raw = (form.pan || "").toString()
    if (!raw) { setFormErrors(prev => ({ ...prev, pan: undefined })); return }
    const normalized = normalizeGstField(raw)
    if (normalized !== raw) setForm(prev => ({ ...prev, pan: normalized }))
    setFormErrors(prev => ({ ...prev, pan: PAN_REGEX.test(normalized) ? undefined : "Invalid PAN format. Expected: ABCDE1234F" }))
  }

  const handleGstinBlur = () => {
    const raw = (form.gstin || "").toString()
    if (!raw) { setFormErrors(prev => ({ ...prev, gstin: undefined })); return }
    const normalized = normalizeGstField(raw)
    if (normalized !== raw) setForm(prev => ({ ...prev, gstin: normalized }))
    if (!GSTIN_REGEX.test(normalized)) {
      setFormErrors(prev => ({ ...prev, gstin: "Invalid GSTIN format. Expected 15 characters, e.g. 22ABCDE1234F1Z5" }))
      return
    }
    const selectedState = activeStates.find((s: any) => String(s.id) === String(form.state_id))
    const gstStateCode = selectedState?.gst_state_code
    if (gstStateCode && normalized.slice(0, 2) !== gstStateCode) {
      setFormErrors(prev => ({ ...prev, gstin: `GSTIN state code (${normalized.slice(0, 2)}) does not match the selected State's GST state code (${gstStateCode})` }))
      return
    }
    setFormErrors(prev => ({ ...prev, gstin: undefined }))
  }

  const handlePincodeBlur = () => {
    const value = (form.pincode || "").toString()
    if (!value) { setFormErrors(prev => ({ ...prev, pincode: undefined })); return }
    setFormErrors(prev => ({ ...prev, pincode: PINCODE_REGEX.test(value) ? undefined : "PIN Code must be exactly 6 digits" }))
  }

  // Additional-address rows
  const addAddressRow = () => setForm(prev => ({ ...prev, addresses: [...(prev.addresses || []), blankCustomerAddress()] }))
  const removeAddressRow = (index: number) => {
    setForm(prev => ({ ...prev, addresses: (prev.addresses || []).filter((_, i) => i !== index) }))
    setAddressErrors(prev => { const next = { ...prev }; delete next[index]; return next })
  }
  const updateAddressRow = (index: number, patch: Partial<CustomerAddress>) => {
    setForm(prev => ({ ...prev, addresses: (prev.addresses || []).map((a, i) => (i === index ? { ...a, ...patch } : a)) }))
  }
  const handleAddressStateChange = (index: number, stateId: string) => {
    updateAddressRow(index, { state_id: stateId ? parseInt(stateId, 10) : null })
  }
  const handleAddressPincodeBlur = (index: number, value: string) => {
    if (!value) { setAddressErrors(prev => ({ ...prev, [index]: undefined })); return }
    setAddressErrors(prev => ({ ...prev, [index]: PINCODE_REGEX.test(value) ? undefined : "PIN Code must be exactly 6 digits" }))
  }

  // Bank-account rows
  const addBankAccountRow = () => setForm(prev => ({ ...prev, bank_accounts: [...(prev.bank_accounts || []), blankCustomerBankAccount()] }))
  const removeBankAccountRow = (index: number) => {
    setForm(prev => ({ ...prev, bank_accounts: (prev.bank_accounts || []).filter((_, i) => i !== index) }))
    setBankAccountErrors(prev => { const next = { ...prev }; delete next[index]; return next })
  }
  const updateBankAccountRow = (index: number, patch: Partial<CustomerBankAccount>) => {
    setForm(prev => ({ ...prev, bank_accounts: (prev.bank_accounts || []).map((b, i) => (i === index ? { ...b, ...patch } : b)) }))
  }
  const handleBankAccountIfscBlur = (index: number, value: string) => {
    const normalized = value.trim().toUpperCase()
    if (normalized !== value) updateBankAccountRow(index, { ifsc_code: normalized })
    if (!normalized) { setBankAccountErrors(prev => ({ ...prev, [index]: undefined })); return }
    setBankAccountErrors(prev => ({ ...prev, [index]: IFSC_REGEX.test(normalized) ? undefined : "Invalid IFSC format. Expected 11 characters, e.g. SBIN0001234" }))
  }

  // Same checks as the Master page's submit-time validation.
  const validate = (): { ok: boolean; payload: Partial<Customer> } => {
    const errors: FormErrors = {}
    const email = (form.email || "").toString().trim()
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Please enter a valid email address (e.g. user@domain.com)"
    const contact = (form.contact || "").toString().trim()
    if (contact && !/^[0-9]{10}$/.test(contact)) errors.contact = "Contact Number must be exactly 10 digits"
    const pan = (form.pan || "").toString().trim().toUpperCase()
    if (pan && !PAN_REGEX.test(pan)) errors.pan = "Invalid PAN format. Expected: ABCDE1234F"
    const gstin = (form.gstin || "").toString().trim().toUpperCase()
    if (gstin) {
      if (!GSTIN_REGEX.test(gstin)) {
        errors.gstin = "Invalid GSTIN format. Expected 15 characters, e.g. 22ABCDE1234F1Z5"
      } else {
        const selectedState = activeStates.find((s: any) => String(s.id) === String(form.state_id))
        const gstStateCode = selectedState?.gst_state_code
        if (gstStateCode && gstin.slice(0, 2) !== gstStateCode) {
          errors.gstin = `GSTIN state code (${gstin.slice(0, 2)}) does not match the selected State's GST state code (${gstStateCode})`
        }
      }
    }
    const pincode = (form.pincode || "").toString()
    if (pincode && !PINCODE_REGEX.test(pincode)) errors.pincode = "PIN Code must be exactly 6 digits"
    setFormErrors(errors)

    const addrErrors: Record<number, string | undefined> = {}
    ;(form.addresses || []).forEach((addr, i) => {
      const addrPincode = (addr.pincode || "").toString()
      if (addrPincode && !PINCODE_REGEX.test(addrPincode)) addrErrors[i] = "PIN Code must be exactly 6 digits"
    })
    setAddressErrors(addrErrors)

    const bankErrors: Record<number, string | undefined> = {}
    ;(form.bank_accounts || []).forEach((bank, i) => {
      const ifsc = (bank.ifsc_code || "").toString().trim().toUpperCase()
      if (ifsc && !IFSC_REGEX.test(ifsc)) bankErrors[i] = "Invalid IFSC format. Expected 11 characters, e.g. SBIN0001234"
    })
    setBankAccountErrors(bankErrors)

    const firstError = errors.email || errors.contact || errors.pan || errors.gstin || errors.pincode
      || Object.values(addrErrors).find(Boolean) || Object.values(bankErrors).find(Boolean)
    if (firstError) {
      toast({ title: "Validation error", description: firstError, variant: "destructive" })
      return { ok: false, payload: form }
    }
    if (!form.customer_name?.trim()) {
      toast({ title: "Validation Error", description: "Customer Name is required", variant: "destructive" })
      return { ok: false, payload: form }
    }
    return {
      ok: true,
      payload: {
        ...form,
        pan,
        gstin,
        bank_accounts: (form.bank_accounts || []).map(b => ({ ...b, ifsc_code: (b.ifsc_code || "").toString().trim().toUpperCase() })),
      },
    }
  }

  const handleSubmit = async () => {
    const { ok, payload } = validate()
    if (!ok) return
    setIsSubmitting(true)
    try {
      const res: any = editingCustomer
        ? await customerApi.update(editingCustomer.id, payload)
        : await customerApi.create(payload)
      if (res?.success) {
        toast({
          title: "Submitted Successfully",
          description: res.message || (editingCustomer ? "Customer edit submitted for approver review" : "Customer submitted for approver approval"),
        })
        onOpenChange(false)
        await onSaved()
      } else {
        toast({ title: "Submission Failed", description: res?.message || "Failed to save customer", variant: "destructive" })
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to save customer", variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0 bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <Users className="h-5 w-5 text-primary" />
            <DialogTitle className="text-base font-bold text-slate-900">
              {editingCustomer ? `Edit Customer — ${editingCustomer.customer_name}` : "Add New Customer"}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">
            {editingCustomer
              ? "Update customer details and documents. Changes will be submitted for approver review."
              : "Enter details for the new customer. It will be submitted for approver approval."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <CustomerForm
            editingItem={null}
            customerForm={form}
            setCustomerForm={setForm}
            customerFormErrors={formErrors}
            addressErrors={addressErrors}
            bankAccountErrors={bankAccountErrors}
            handleCustomerFieldChangeAttempt={(_field, _section, applyChange) => applyChange()}
            setCustomerEffectiveDatesSection={() => {}}
            activeStates={activeStates}
            activeGstRegStatuses={activeOf(gstRegStatusData)}
            activeGstRegTypes={activeOf(gstRegTypeData)}
            activeMsmeRegTypes={activeMsmeRegTypes}
            activeFssaiLicenceTypes={activeOf(fssaiLicenceTypeData)}
            activeBankNames={activeOf(bankNameData)}
            godownDepots={(godownDepots || []).filter((d: any) => d.status === "Active")}
            ledgerGroupOptions={ledgerGroupOptions || []}
            handlePanBlur={handlePanBlur}
            handleGstinBlur={handleGstinBlur}
            handlePincodeBlur={handlePincodeBlur}
            handleAddressPincodeBlur={handleAddressPincodeBlur}
            handleBankAccountIfscBlur={handleBankAccountIfscBlur}
            handleAddressStateChange={handleAddressStateChange}
            updateAddressRow={updateAddressRow}
            addAddressRow={addAddressRow}
            removeAddressRow={removeAddressRow}
            updateBankAccountRow={updateBankAccountRow}
            addBankAccountRow={addBankAccountRow}
            removeBankAccountRow={removeBankAccountRow}
            handleFileUpload={handleFileUpload}
            handleFileRemove={handleFileRemove}
          />
        </div>

        <DialogFooter className="px-6 py-3 border-t bg-slate-50 flex items-center justify-end gap-2 shrink-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" disabled={isSubmitting} onClick={handleSubmit}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              editingCustomer ? "Submit Edit for Approval" : "Submit for Approval"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
