"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StageDataCard, type StageDataCol } from "@/components/stage-list-extra/stage-data-card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AsyncCombobox } from "@/components/ui/async-combobox"
import { fetchCustomerDropdownOptions } from "@/components/order-punch/customer-dropdown"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { depotApi, returnApi } from "@/lib/api-service"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, FileText, Loader2, Printer, Truck } from "lucide-react"

const COMPANY = "Shree Shyam Oil Extractions"
const TYPES = ["Customer Return", "Depot Return"]

const fmtDateTime = (d: any) =>
  d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"

const esc = (v: any) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string))

/**
 * Fill-in-the-blank gate pass: everything the system knows is pre-printed, the rest is left as ruled blanks
 * for the guard / driver to complete by hand.
 */
function printGatePass(p: any) {
  const blank = (label: string, value?: string, wide = false) =>
    `<tr><th>${esc(label)}</th><td colspan="${wide ? 3 : 1}">${value ? esc(value) : "&nbsp;"}</td>${wide ? "" : "<th></th><td></td>"}</tr>`
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(p.pass_no)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 13px; }
  .head { text-align: center; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 14px; }
  .head h1 { margin: 0; font-size: 20px; letter-spacing: .5px; }
  .head h2 { margin: 6px 0 0; font-size: 15px; text-transform: uppercase; letter-spacing: 2px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  th, td { border: 1px solid #111; padding: 9px 8px; text-align: left; vertical-align: top; }
  th { width: 22%; background: #f1f1f1; font-weight: 700; }
  td { height: 34px; }
  .two th { width: 18%; } .two td { width: 32%; }
  .note { border: 1px dashed #111; padding: 8px; margin: 10px 0 18px; font-size: 12px; }
  .sign { display: flex; gap: 18px; margin-top: 46px; }
  .sign div { flex: 1; border-top: 1px solid #111; padding-top: 6px; text-align: center; font-size: 12px; }
  .foot { margin-top: 24px; font-size: 11px; color: #555; text-align: center; }
</style></head><body>
  <div class="head"><h1>${esc(COMPANY)}</h1><h2>Stock Return Gate Pass</h2></div>
  <table class="two">
    <tr><th>Pass No.</th><td><b>${esc(p.pass_no)}</b></td><th>Date &amp; Time</th><td>${esc(fmtDateTime(p.issued_at))}</td></tr>
    <tr><th>Return Type</th><td>${esc(p.return_type)}</td><th>Vehicle No.</th><td><b>${esc(p.vehicle_no)}</b></td></tr>
    <tr><th>Customer / Depot</th><td colspan="3">${esc(p.customer_name)}${p.customer_address ? " — " + esc(p.customer_address) : ""}</td></tr>
    <tr><th>Proceed To</th><td colspan="3"><b>${esc(p.destination_depot)}</b> — loading area</td></tr>
    <tr><th>Reference (Invoice / DO)</th><td>${p.reference_no ? esc(p.reference_no) : "&nbsp;"}</td><th>Issued By</th><td>${esc(p.issued_by || "")}</td></tr>
  </table>
  <table>
    ${blank("Driver Name", p.driver_name || "", true)}
    ${blank("Driver Mobile / DL No.", "", true)}
    ${blank("Material / SKU Description", "", true)}
    ${blank("Quantity (Box / Tin) & Weight", "", true)}
    ${blank("Customer DN / Challan No.", "", true)}
    ${blank("Reason for Return", "", true)}
    ${blank("Remarks", p.remarks || "", true)}
  </table>
  <div class="note">${p.return_type === "Depot Return"
    ? "Depot return — the vehicle proceeds directly to the loading area; the Gate-In stage is skipped."
    : "Customer return — the vehicle proceeds to the loading area of the destination above for unloading."}</div>
  <div class="sign"><div>Security Guard</div><div>Driver</div><div>Store In-charge (Receiving)</div></div>
  <div class="foot">Handwritten entries above are verified at the loading area. Pass ${esc(p.pass_no)}</div>
  <script>window.onload = function () { window.focus(); window.print(); };</script>
</body></html>`
  const w = window.open("", "_blank", "width=900,height=1000")
  if (!w) return false
  w.document.open()
  w.document.write(html)
  w.document.close()
  return true
}

export default function ReturnGatePassPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { user, isReadOnly } = useAuth()
  const queryClient = useQueryClient()

  const [returnType, setReturnType] = useState("Customer Return")
  const [vehicleNo, setVehicleNo] = useState("")
  const [customerValue, setCustomerValue] = useState("")
  const [customerRec, setCustomerRec] = useState<any>(null)
  const [destinationDepotId, setDestinationDepotId] = useState("")
  const [referenceNo, setReferenceNo] = useState("")
  const [driverName, setDriverName] = useState("")
  const [remarks, setRemarks] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const search = ""

  const { data: depots = [] } = useQuery({
    queryKey: ["depots-all"],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const res = await depotApi.getAll({ all: "true" })
      const list = res.success ? (res.data?.depots || (Array.isArray(res.data) ? res.data : [])) : []
      return list
    },
  })

  // Default the destination to Banari once the depots are known.
  useEffect(() => {
    if (destinationDepotId) return
    const banari = depots.find((d: any) => String(d.depot_name).toLowerCase() === "banari")
    if (banari) setDestinationDepotId(String(banari.id))
  }, [depots, destinationDepotId])

  const { data: passes = [], isLoading } = useQuery({
    queryKey: ["return-gate-passes", search],
    queryFn: async () => {
      const res = await returnApi.getGatePasses({ search: search || undefined, limit: 50 })
      return res.success ? (res.data?.passes || []) : []
    },
  })

  const PASS_COLUMNS: StageDataCol<any>[] = [
    { id: "pass_no", label: "Pass No.", accessor: (p) => p.pass_no, render: (p) => <span className="font-bold text-slate-700">{p.pass_no}</span> },
    { id: "issued_at", label: "Date & Time", type: "date", accessor: (p) => p.issued_at, render: (p) => fmtDateTime(p.issued_at) },
    {
      id: "return_type", label: "Type", accessor: (p) => p.return_type,
      render: (p) => <Badge className={p.return_type === "Depot Return" ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700"}>{p.return_type}</Badge>,
    },
    { id: "vehicle_no", label: "Vehicle", accessor: (p) => p.vehicle_no, render: (p) => <span className="font-semibold">{p.vehicle_no}</span> },
    { id: "customer", label: "Customer / Depot", accessor: (p) => p.customer_name, render: (p) => p.customer_name || "—" },
    { id: "destination", label: "Proceeds To", accessor: (p) => p.destination_depot, render: (p) => p.destination_depot || "—" },
    { id: "reference_no", label: "Reference", accessor: (p) => p.reference_no, render: (p) => p.reference_no || "—" },
    {
      id: "print", label: "", noSort: true, noFilter: true,
      render: (p) => (
        <Button variant="outline" size="sm" onClick={() => reprint(p)}>
          <Printer className="mr-1.5 h-3.5 w-3.5" />Print
        </Button>
      ),
    },
  ]

  const canSave = !isSaving && !isReadOnly && vehicleNo.trim() && customerRec?.id && destinationDepotId

  const handleIssue = async () => {
    if (!canSave) return
    setIsSaving(true)
    try {
      const res = await returnApi.createGatePass({
        returnType,
        vehicleNo,
        customerId: customerRec.id,
        destinationDepotId: Number(destinationDepotId),
        referenceNo: referenceNo || null,
        driverName: driverName || null,
        remarks: remarks || null,
        userId: user?.id ?? null,
      })
      if (res.success) {
        toast({ title: "Gate Pass Issued", description: res.data?.pass_no })
        if (!printGatePass(res.data)) {
          toast({ title: "Pop-up blocked", description: "Allow pop-ups to print the pass, or use Print in the list below.", variant: "destructive" })
        }
        setVehicleNo("")
        setReferenceNo("")
        setDriverName("")
        setRemarks("")
        queryClient.invalidateQueries({ queryKey: ["return-gate-passes"] })
      } else {
        toast({ title: "Error", description: res.message || "Could not issue the pass", variant: "destructive" })
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "An unexpected error occurred", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const reprint = async (p: any) => {
    // The list rows carry the essentials; the printout reuses them as-is.
    const customer = customerRec && customerRec.id === p.customer_id ? customerRec : null
    printGatePass({ ...p, customer_address: customer?.address_line_1 || "" })
  }

  return (
    <div className="p-3 sm:px-6 sm:py-3 max-w-full space-y-2 sm:space-y-3" suppressHydrationWarning>
      <div className="flex items-center gap-3">
        <SidebarTrigger className="-ml-1" />
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Stock Return Gate Pass</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Main Gate: issue a fill-in-the-blank pass for a vehicle bringing returned stock.</p>
        </div>
        <Button variant="outline" className="ml-auto" onClick={() => router.push("/return")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Return
        </Button>
      </div>

      <div className="space-y-6 rounded-lg border bg-white p-4 shadow-sm sm:p-6">
        <h3 className="flex items-center gap-2 border-b pb-2 text-sm font-bold text-slate-800">
          <Truck className="h-4 w-4 text-blue-600" />
          Issue Gate Pass
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>Return Type <span className="text-red-500">*</span></Label>
            <Select value={returnType} onValueChange={setReturnType}>
              <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Vehicle No. <span className="text-red-500">*</span></Label>
            <Input className="h-10 uppercase" placeholder="e.g. CG04AB1234" value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value.toUpperCase())} />
          </div>
          <div className="space-y-2 md:col-span-2 lg:col-span-1">
            <Label>{returnType === "Depot Return" ? "Returning Depot (as customer)" : "Customer Name"} <span className="text-red-500">*</span></Label>
            <AsyncCombobox
              placeholder="Select customer"
              searchPlaceholder="Search by name, city, GST, mobile..."
              value={customerValue}
              onValueChange={setCustomerValue}
              onSelectOption={(opt: any) => setCustomerRec(opt?.original || null)}
              fetchOptions={(s: string, page: number) => fetchCustomerDropdownOptions(s, page, null)}
            />
          </div>
          <div className="space-y-2">
            <Label>Vehicle Proceeds To (loading area) <span className="text-red-500">*</span></Label>
            <Select value={destinationDepotId} onValueChange={setDestinationDepotId}>
              <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Banari / depot" /></SelectTrigger>
              <SelectContent>
                {depots.map((d: any) => (<SelectItem key={d.id} value={String(d.id)}>{d.depot_name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Reference (Invoice / DO)</Label>
            <Input className="h-10" placeholder="Optional" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Driver Name</Label>
            <Input className="h-10" placeholder="Optional - can be handwritten on the pass" value={driverName} onChange={(e) => setDriverName(e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2 lg:col-span-3">
            <Label>Remarks</Label>
            <Input className="h-10" placeholder="Optional" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
        </div>
        <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Material, quantity, driver mobile and the customer&apos;s DN number are left blank on the printed pass for handwritten entry.
          {returnType === "Depot Return" && " A depot return skips the Gate-In stage."}
        </p>
        <div className="flex justify-end">
          <Button onClick={handleIssue} disabled={!canSave} className="min-w-[170px] bg-blue-600 hover:bg-blue-700">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
            Issue &amp; Print Pass
          </Button>
        </div>
      </div>

      <StageDataCard
        storageKey="return-gate-pass"
        title="Issued Passes"
        description="Gate passes issued for returns."
        rows={passes}
        columns={PASS_COLUMNS}
        rowKey={(p: any) => p.id}
        loading={isLoading}
        emptyText="No gate passes issued yet."
        searchPlaceholder="Search pass no / vehicle / customer"
        statusOf={(p: any) => p.return_type}
      />
    </div>
  )
}
