"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, Truck } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { TransportForm } from "@/components/masters/forms/TransportForm"
import { blankPartyParityFields, PAN_REGEX, GSTIN_REGEX, normalizeGstField } from "@/components/masters/types"
import { transportMasterApi, commonApi, orderApi, stateApi, lookupApi, ledgerGroupApi, customerApi, type LookupType } from "@/lib/api-service"

// Add / Edit Transporter dialog that reuses the Master page's TransportForm.
// Submitting goes through the normal approval flow (non-admin => pending).
interface TransporterMasterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingTransporter: any | null
  onSaved: () => void | Promise<void>
}

const initialTransportForm = () => ({
  ...blankPartyParityFields(),
  transport_master_id: "",
  status: "Active",
  transporter_name: "",
  contact_person: "",
  contact_number: "",
  email_id: "",
  address_line1: "",
  state_id: null as number | null,
  pincode: "",
  ledger_group_id: "",
  bilty_copy_upload: "",
  linked_customer_id: "",
})

const lookupQuery = (key: LookupType) => ({
  queryKey: [`lookup-${key}`],
  queryFn: async () => {
    const res = await lookupApi.getAll(key, { page: 1, limit: 1000, all: "true" })
    return res.success ? (res.data.items || []) : []
  },
  staleTime: 5 * 60 * 1000,
})

export function TransporterMasterDialog({ open, onOpenChange, editingTransporter, onSaved }: TransporterMasterDialogProps) {
  const { toast } = useToast()
  const [form, setForm] = useState<any>(initialTransportForm)
  const [partyFormErrors, setPartyFormErrors] = useState<{ pan?: string; gstin?: string }>({})
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
  const activeOf = (rows: any[] | undefined) => (rows || []).filter((r: any) => r.status === "Active")
  const activeMsmeRegTypes = useMemo(() => {
    const orderMap: Record<string, number> = { Micro: 1, Small: 2, Medium: 3 }
    return activeOf(msmeRegTypeData).sort((a: any, b: any) => (orderMap[a.name] || 99) - (orderMap[b.name] || 99))
  }, [msmeRegTypeData])

  const { data: ledgerGroupOptions } = useQuery({
    queryKey: ["ledger-group-options"],
    queryFn: async () => {
      const res = await ledgerGroupApi.getAll({ all: "true" })
      return res.success ? (res.data?.ledger_groups || []) : []
    },
    enabled: open,
  })
  const { data: customers } = useQuery({
    queryKey: ["transporter-dialog-customers"],
    queryFn: async () => {
      const res = await customerApi.getAll({ all: "true" })
      return res.success ? (res.data?.customers || []) : []
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  })

  // Load the form each time the dialog opens: full record when editing, a
  // fresh form with the next transporter id when adding.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setPartyFormErrors({})
    if (editingTransporter?.id) {
      setForm({ ...initialTransportForm(), ...editingTransporter })
      transportMasterApi.getById(editingTransporter.id).then((res: any) => {
        if (!cancelled && res?.success && res.data) setForm({ ...initialTransportForm(), ...res.data })
      }).catch(() => {})
    } else {
      setForm(initialTransportForm())
      commonApi.getNextId("transport").then((res: any) => {
        if (!cancelled && res?.success && res.data?.nextId) setForm((prev: any) => ({ ...prev, transport_master_id: res.data.nextId }))
      }).catch(() => {})
    }
    return () => { cancelled = true }
  }, [open, editingTransporter?.id])

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

  const handlePartyPanBlur = () => {
    const raw = (form.pan || "").toString()
    if (!raw) { setPartyFormErrors(prev => ({ ...prev, pan: undefined })); return }
    const normalized = normalizeGstField(raw)
    if (normalized !== raw) setForm((prev: any) => ({ ...prev, pan: normalized }))
    setPartyFormErrors(prev => ({ ...prev, pan: PAN_REGEX.test(normalized) ? undefined : "Invalid PAN format. Expected: ABCDE1234F" }))
  }
  const handlePartyGstinBlur = () => {
    const raw = (form.gstin || "").toString()
    if (!raw) { setPartyFormErrors(prev => ({ ...prev, gstin: undefined })); return }
    const normalized = normalizeGstField(raw)
    if (normalized !== raw) setForm((prev: any) => ({ ...prev, gstin: normalized }))
    if (!GSTIN_REGEX.test(normalized)) {
      setPartyFormErrors(prev => ({ ...prev, gstin: "Invalid GSTIN format. Expected 15 characters, e.g. 22ABCDE1234F1Z5" }))
      return
    }
    const selectedState = activeStates.find((s: any) => String(s.id) === String(form.state_id))
    const gstStateCode = selectedState?.gst_state_code
    if (gstStateCode && normalized.slice(0, 2) !== gstStateCode) {
      setPartyFormErrors(prev => ({ ...prev, gstin: `GSTIN state code (${normalized.slice(0, 2)}) does not match the selected State's GST state code (${gstStateCode})` }))
      return
    }
    setPartyFormErrors(prev => ({ ...prev, gstin: undefined }))
  }

  const handleSubmit = async () => {
    const errors: string[] = []
    if (!form.transporter_name?.trim()) errors.push("Transporter Name is required")
    if (!form.contact_person?.trim()) errors.push("Contact Person is required")
    if (!form.contact_number?.trim()) errors.push("Contact Number is required")
    const pan = (form.pan || "").toString().trim().toUpperCase()
    if (pan && !PAN_REGEX.test(pan)) errors.push("Invalid PAN format")
    const gstin = (form.gstin || "").toString().trim().toUpperCase()
    if (gstin && !GSTIN_REGEX.test(gstin)) errors.push("Invalid GSTIN format")
    if (errors.length > 0) {
      toast({ title: "Validation Error", description: errors.join(", "), variant: "destructive" })
      return
    }

    setIsSubmitting(true)
    try {
      const res: any = editingTransporter
        ? await transportMasterApi.update(editingTransporter.id, form)
        : await transportMasterApi.create(form)
      if (res?.success) {
        toast({
          title: "Submitted Successfully",
          description: res.message || (editingTransporter ? "Transporter edit submitted for approver review" : "Transporter submitted for approver approval"),
        })
        onOpenChange(false)
        await onSaved()
      } else {
        toast({ title: "Submission Failed", description: res?.message || "Failed to save transporter", variant: "destructive" })
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to save transporter", variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0 bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <Truck className="h-5 w-5 text-primary" />
            <DialogTitle className="text-base font-bold text-slate-900">
              {editingTransporter ? `Edit Transporter — ${editingTransporter.transporter_name}` : "Add New Transporter"}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">
            {editingTransporter
              ? "Update transporter details and documents. Changes will be submitted for approver review."
              : "Enter details for the new transporter. It will be submitted for approver approval."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <TransportForm
            transportForm={form}
            setTransportForm={setForm}
            ledgerGroupOptions={ledgerGroupOptions || []}
            customers={customers || []}
            activeStates={activeStates}
            activeGstRegStatuses={activeOf(gstRegStatusData)}
            activeGstRegTypes={activeOf(gstRegTypeData)}
            activeMsmeRegTypes={activeMsmeRegTypes}
            activeFssaiLicenceTypes={activeOf(fssaiLicenceTypeData)}
            handlePartyPanBlur={handlePartyPanBlur}
            handlePartyGstinBlur={handlePartyGstinBlur}
            partyFormErrors={partyFormErrors}
            handleFileUpload={handleFileUpload}
            handleFileRemove={handleFileRemove}
            editingItem={null}
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
              editingTransporter ? "Submit Edit for Approval" : "Submit for Approval"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
