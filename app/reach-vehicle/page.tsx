"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { WorkflowStageShell } from "@/components/workflow/workflow-stage-shell"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { FileUploadField } from "@/components/file-upload-field"
import { MapPin, Truck, AlertTriangle, RefreshCcw } from "lucide-react"
import { reachVehicleApi, vehicleMasterApi, transportMasterApi, driverMasterApi, orderApi } from "@/lib/api-service"
import { useAuth } from "@/hooks/use-auth"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

const FREIGHT_RATE_TYPES = ["PER TON", "PER LTR", "PER TIN", "PER KG", "FIXED"]

export default function ReachVehiclePage() {
  const { user } = useAuth()
  const { toast } = useToast()
  
  const [data, setData] = useState<any[]>([])
  const [historyData, setHistoryData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Master Data
  const [vehicles, setVehicles] = useState<any[]>([])
  const [transporters, setTransporters] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])

  // Modal State
  const [reachMode, setReachMode] = useState<'normal' | 'accident' | 'change_vehicle'>('normal')
  const [accidentPhotoFiles, setAccidentPhotoFiles] = useState<File[]>([])
  const [formData, setFormData] = useState({
    arrivalDate: new Date().toISOString().split('T')[0],
    arrivalTime: new Date().toTimeString().split(' ')[0].substring(0, 5),
    accidentDate: new Date().toISOString().split('T')[0],
    accidentTime: new Date().toTimeString().split(' ')[0].substring(0, 5),
    accidentLocation: "",
    accidentDescription: "",
    accidentCause: "",
    accidentLoss: "",
    vehicleChangeReason: "",
    vehicleId: "",
    transporterId: "",
    driverId: "",
    freightRateType: "",
    freightAmount: "",
    advanceBhadaBank: "",
    advanceBhadaDieselAdvance: "",
    advanceBhadaCash: "",
    routeDecision: "resume_delivery"
  })

  useEffect(() => {
    fetchData()
    fetchMasterData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const pendingRes = await reachVehicleApi.getPending({ limit: 100 })
      const historyRes = await reachVehicleApi.getHistory({ limit: 100 })
      
      if (pendingRes.success) {
        const pData = pendingRes.data.orders || []
        setData(pData.map((r: any) => ({ ...r, id: r.reachVehicle?.id })))
      }
      if (historyRes.success) {
        const hData = historyRes.data.orders || []
        setHistoryData(hData.map((r: any) => ({ ...r, id: r.reachVehicle?.id })))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchMasterData = async () => {
    try {
      const [vRes, tRes, dRes] = await Promise.all([
        vehicleMasterApi.getAll({ all: 'true' }),
        transportMasterApi.getAll({ all: 'true' }),
        driverMasterApi.getAll({ all: 'true' })
      ])
      if (vRes.success) setVehicles(vRes.data.vehicles || [])
      if (tRes.success) setTransporters(tRes.data.transporters || [])
      if (dRes.success) setDrivers(dRes.data.drivers || [])
    } catch (err) {
      console.error(err)
    }
  }

  const handleSubmit = async () => {
    if (selectedItems.length === 0) return

    setIsProcessing(true)
    try {
      const payload: any = {
        recordType: reachMode,
        userId: user?.id
      }
      
      if (reachMode === 'normal') {
        payload.arrivalDate = formData.arrivalDate
        payload.arrivalTime = formData.arrivalTime
      } else if (reachMode === 'accident') {
        const uploadedPhotoUrls: string[] = []
        for (const file of accidentPhotoFiles) {
          const response = await orderApi.uploadFile(file)
          if (response.success) uploadedPhotoUrls.push(response.data.url)
        }
        payload.accidentDate = formData.accidentDate
        payload.accidentTime = formData.accidentTime
        payload.accidentLocation = formData.accidentLocation
        payload.accidentPhotos = uploadedPhotoUrls
        payload.accidentDescription = formData.accidentDescription
        payload.accidentCause = formData.accidentCause
        payload.accidentLoss = formData.accidentLoss
      } else if (reachMode === 'change_vehicle') {
        payload.vehicleChangeReason = formData.vehicleChangeReason
      }

      if (reachMode === 'accident' || reachMode === 'change_vehicle') {
        payload.vehicleId = formData.vehicleId || null
        payload.transporterId = formData.transporterId || null
        payload.driverId = formData.driverId || null
        payload.freightRateType = formData.freightRateType || null
        payload.freightAmount = formData.freightAmount || 0
        payload.advanceBhadaBank = formData.advanceBhadaBank || 0
        payload.advanceBhadaDieselAdvance = formData.advanceBhadaDieselAdvance || 0
        payload.advanceBhadaCash = formData.advanceBhadaCash || 0
        payload.routeDecision = formData.routeDecision
      }

      // Submit sequentially for all selected records
      for (const id of selectedItems) {
        await reachVehicleApi.submit(parseInt(id), payload)
      }

      toast({ title: "Success", description: "Reach Vehicle recorded successfully" })
      setIsDialogOpen(false)
      setSelectedItems([])
      setAccidentPhotoFiles([])
      fetchData()
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setIsProcessing(false)
    }
  }

  const pendingColumns = [
    {
      id: "select",
      header: ({ table }: any) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(val) => table.toggleAllPageRowsSelected(!!val)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }: any) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(val) => row.toggleSelected(!!val)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    { accessorKey: "orderNo", header: "Order No.", cell: ({ row }: any) => row.original?.order?.orderNo },
    { accessorKey: "partyName", header: "Customer Name", cell: ({ row }: any) => row.original?.customer?.customerName },
    { accessorKey: "vehicleNo", header: "Vehicle No", cell: ({ row }: any) => row.original?.vehicle?.registrationNo },
    { accessorKey: "driverName", header: "Driver", cell: ({ row }: any) => row.original?.driver?.driverName },
    { accessorKey: "transporterName", header: "Transporter", cell: ({ row }: any) => row.original?.transporter?.transporterName },
  ]

  const historyColumns = [
    { accessorKey: "orderNo", header: "Order No.", cell: ({ row }: any) => row.original?.order?.orderNo },
    { accessorKey: "partyName", header: "Customer Name", cell: ({ row }: any) => row.original?.customer?.customerName },
    { accessorKey: "vehicleNo", header: "Vehicle No", cell: ({ row }: any) => row.original?.vehicle?.registrationNo },
    { 
      accessorKey: "status", 
      header: "Status",
      cell: ({ row }: any) => {
        const type = row.original?.reachVehicle?.recordType
        return type === 'accident' ? (
          <Badge variant="destructive">Accident</Badge>
        ) : type === 'change_vehicle' ? (
          <Badge className="bg-orange-500">Vehicle Changed</Badge>
        ) : (
          <Badge className="bg-emerald-500">Reached</Badge>
        )
      }
    },
  ]

  const selectedRows = data.filter(d => selectedItems.includes(d.id?.toString()))

  return (
    <WorkflowStageShell
      stageName="Reach Vehicle"
      title="Stage 13: Reach Vehicle"
      description="Record vehicle arrival, accidents, or vehicle changes during transit."
      icon={<MapPin className="h-5 w-5 text-cyan-600" />}
      pendingData={data}
      historyData={historyData}
      loading={loading}
      onRefresh={fetchData}
      pendingColumns={pendingColumns}
      historyColumns={historyColumns}
      selectedItems={selectedItems}
      onSelectionChange={setSelectedItems}
      customActionBar={
        selectedItems.length > 0 && (
          <div className="flex w-full justify-between items-center bg-cyan-50 border border-cyan-200 p-3 rounded-md shadow-sm">
            <span className="text-sm font-semibold text-cyan-800">
              {selectedItems.length} vehicles selected
            </span>
            <Button onClick={() => setIsDialogOpen(true)} className="bg-cyan-600 hover:bg-cyan-700">
              Record Reach Vehicle
            </Button>
          </div>
        )
      }
    >
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Reach Vehicle</DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-lg mb-6">
            <Button 
              variant={reachMode === 'normal' ? 'default' : 'ghost'} 
              className={reachMode === 'normal' ? 'bg-cyan-600' : ''}
              onClick={() => setReachMode('normal')}
            >
              <MapPin className="h-4 w-4 mr-2" /> Normal Arrival
            </Button>
            <Button 
              variant={reachMode === 'accident' ? 'default' : 'ghost'}
              className={reachMode === 'accident' ? 'bg-destructive' : ''}
              onClick={() => setReachMode('accident')}
            >
              <AlertTriangle className="h-4 w-4 mr-2" /> Accident
            </Button>
            <Button 
              variant={reachMode === 'change_vehicle' ? 'default' : 'ghost'}
              className={reachMode === 'change_vehicle' ? 'bg-orange-600 hover:bg-orange-700' : ''}
              onClick={() => setReachMode('change_vehicle')}
            >
              <RefreshCcw className="h-4 w-4 mr-2" /> Change of Vehicle
            </Button>
          </div>

          <div className="space-y-6">
            {reachMode === 'normal' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Arrival Date</Label>
                  <Input type="date" value={formData.arrivalDate} onChange={e => setFormData({ ...formData, arrivalDate: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Arrival Time</Label>
                  <Input type="time" value={formData.arrivalTime} onChange={e => setFormData({ ...formData, arrivalTime: e.target.value })} />
                </div>
              </div>
            )}

            {reachMode === 'accident' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date of Accident</Label>
                  <Input type="date" value={formData.accidentDate} onChange={e => setFormData({ ...formData, accidentDate: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Time of Accident</Label>
                  <Input type="time" value={formData.accidentTime} onChange={e => setFormData({ ...formData, accidentTime: e.target.value })} />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Location of Accident</Label>
                  <Input value={formData.accidentLocation} onChange={e => setFormData({ ...formData, accidentLocation: e.target.value })} />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Accident Description</Label>
                  <Textarea value={formData.accidentDescription} onChange={e => setFormData({ ...formData, accidentDescription: e.target.value })} />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Cause of Accident</Label>
                  <Input value={formData.accidentCause} onChange={e => setFormData({ ...formData, accidentCause: e.target.value })} />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Loss Occurred</Label>
                  <Input value={formData.accidentLoss} onChange={e => setFormData({ ...formData, accidentLoss: e.target.value })} />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Upload Photos</Label>
                  <FileUploadField
                    label="Accident Spot Photos"
                    accept="image/*"
                    multiple
                    fileName={accidentPhotoFiles.map(f => f.name)}
                    onFilesSelected={(files) => setAccidentPhotoFiles(prev => [...prev, ...files])}
                    onRemove={(index) => setAccidentPhotoFiles(prev => prev.filter((_, i) => i !== index))}
                  />
                </div>
              </div>
            )}

            {reachMode === 'change_vehicle' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Reason for Change of Vehicle</Label>
                  <Textarea value={formData.vehicleChangeReason} onChange={e => setFormData({ ...formData, vehicleChangeReason: e.target.value })} />
                </div>
              </div>
            )}

            {(reachMode === 'accident' || reachMode === 'change_vehicle') && (
              <div className="pt-6 border-t space-y-4">
                <h3 className="font-bold text-lg">New Transit Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>New Vehicle</Label>
                    <Select value={formData.vehicleId} onValueChange={v => setFormData({ ...formData, vehicleId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                      <SelectContent>{vehicles.map(v => <SelectItem key={v.id} value={v.id.toString()}>{v.registration_no}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>New Transporter</Label>
                    <Select value={formData.transporterId} onValueChange={v => setFormData({ ...formData, transporterId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select transporter" /></SelectTrigger>
                      <SelectContent>{transporters.map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.transporter_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Driver (Optional)</Label>
                    <Select value={formData.driverId} onValueChange={v => setFormData({ ...formData, driverId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select driver" /></SelectTrigger>
                      <SelectContent>{drivers.map(d => <SelectItem key={d.id} value={d.id.toString()}>{d.driver_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Freight Rate Type</Label>
                    <Select value={formData.freightRateType} onValueChange={v => setFormData({ ...formData, freightRateType: v })}>
                      <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>{FREIGHT_RATE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Freight Amount</Label>
                    <Input type="number" value={formData.freightAmount} onChange={e => setFormData({ ...formData, freightAmount: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Advance (Bank)</Label>
                    <Input type="number" value={formData.advanceBhadaBank} onChange={e => setFormData({ ...formData, advanceBhadaBank: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Advance (Cash)</Label>
                    <Input type="number" value={formData.advanceBhadaCash} onChange={e => setFormData({ ...formData, advanceBhadaCash: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Diesel Advance</Label>
                    <Input type="number" value={formData.advanceBhadaDieselAdvance} onChange={e => setFormData({ ...formData, advanceBhadaDieselAdvance: e.target.value })} />
                  </div>
                  <div className="col-span-2 space-y-4 pt-2">
                    <Label className="text-base font-semibold text-slate-800">Route Decision</Label>
                    <RadioGroup value={formData.routeDecision} onValueChange={v => setFormData({ ...formData, routeDecision: v })} className="flex gap-6">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="resume_delivery" id="r1" />
                        <Label htmlFor="r1" className="text-emerald-700 font-semibold cursor-pointer">Resume Delivery to Destination</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="return_to_factory" id="r2" />
                        <Label htmlFor="r2" className="text-rose-700 font-semibold cursor-pointer">Return Stock to Factory</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isProcessing} className="bg-cyan-600 hover:bg-cyan-700">
              {isProcessing ? "Saving..." : "Confirm & Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </WorkflowStageShell>
  )
}
