"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2, Box, Package, Droplets } from "lucide-react"

export type UnloadingDamagedItem = {
  sfgSerialNumber: string
  lossType: "complete" | "partial"
  oilWeightLost?: string
}

export type UnloadingDamagedContainer = {
  containerSerialNumber: string
  damageType: "whole" | "partial"
  items: UnloadingDamagedItem[]
}

export type UnloadingFormData = {
  shortageQty: string
  remarks: string
  damagedContainers: UnloadingDamagedContainer[]
}

export function UnloadingForm({
  onSubmit,
  isSubmitting
}: {
  onSubmit: (data: UnloadingFormData) => void
  isSubmitting: boolean
}) {
  const [formData, setFormData] = useState<UnloadingFormData>({
    shortageQty: "",
    remarks: "",
    damagedContainers: []
  })

  const addContainer = () => {
    setFormData(prev => ({
      ...prev,
      damagedContainers: [
        ...prev.damagedContainers,
        { containerSerialNumber: "", damageType: "whole", items: [] }
      ]
    }))
  }

  const removeContainer = (cIdx: number) => {
    setFormData(prev => ({
      ...prev,
      damagedContainers: prev.damagedContainers.filter((_, i) => i !== cIdx)
    }))
  }

  const updateContainer = (cIdx: number, field: keyof UnloadingDamagedContainer, value: any) => {
    setFormData(prev => {
      const newContainers = [...prev.damagedContainers]
      newContainers[cIdx] = { ...newContainers[cIdx], [field]: value }
      if (field === "damageType" && value === "whole") {
        newContainers[cIdx].items = [] // reset items if changed to whole
      }
      return { ...prev, damagedContainers: newContainers }
    })
  }

  const addItem = (cIdx: number) => {
    setFormData(prev => {
      const newContainers = [...prev.damagedContainers]
      newContainers[cIdx].items.push({ sfgSerialNumber: "", lossType: "complete" })
      return { ...prev, damagedContainers: newContainers }
    })
  }

  const removeItem = (cIdx: number, iIdx: number) => {
    setFormData(prev => {
      const newContainers = [...prev.damagedContainers]
      newContainers[cIdx].items = newContainers[cIdx].items.filter((_, i) => i !== iIdx)
      return { ...prev, damagedContainers: newContainers }
    })
  }

  const updateItem = (cIdx: number, iIdx: number, field: keyof UnloadingDamagedItem, value: any) => {
    setFormData(prev => {
      const newContainers = [...prev.damagedContainers]
      newContainers[cIdx].items[iIdx] = { ...newContainers[cIdx].items[iIdx], [field]: value }
      return { ...prev, damagedContainers: newContainers }
    })
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
          <Package className="h-5 w-5 text-blue-600" />
          Shortage & General Remarks
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Total Shortage Quantity</Label>
            <Input
              type="number"
              placeholder="e.g. 5"
              value={formData.shortageQty}
              onChange={(e) => setFormData({ ...formData, shortageQty: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Remarks</Label>
            <Textarea
              placeholder="Any additional notes..."
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              className="h-10"
            />
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <Box className="h-5 w-5 text-red-500" />
            Damage Tracking
          </h3>
          <Button type="button" onClick={addContainer} variant="outline" className="border-red-200 text-red-600 hover:bg-red-50">
            <Plus className="h-4 w-4 mr-2" />
            Add Damaged Container (TIN/Box)
          </Button>
        </div>

        {formData.damagedContainers.length === 0 && (
          <div className="text-center p-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500">
            No damages reported. Click the button above to add damaged TINs/Boxes.
          </div>
        )}

        <div className="space-y-6">
          {formData.damagedContainers.map((container, cIdx) => (
            <div key={cIdx} className="p-5 rounded-xl border border-red-100 bg-red-50/30 space-y-4 relative">
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute top-2 right-2 text-slate-400 hover:text-red-600"
                onClick={() => removeContainer(cIdx)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pr-10">
                <div className="space-y-2">
                  <Label>Container Serial No. (TIN/Box)</Label>
                  <Input
                    placeholder="Scan or enter barcode..."
                    value={container.containerSerialNumber}
                    onChange={(e) => updateContainer(cIdx, "containerSerialNumber", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Damage Type</Label>
                  <Select value={container.damageType} onValueChange={(val) => updateContainer(cIdx, "damageType", val)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whole">Whole Container Lost/Destroyed</SelectItem>
                      <SelectItem value="partial">Partial Damage (Internal items lost)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {container.damageType === "partial" && (
                <div className="pl-4 sm:pl-8 pt-4 mt-4 border-t border-red-100 space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-red-800 font-bold">Internal Items (Semi-Finished Goods)</Label>
                    <Button type="button" size="sm" variant="secondary" onClick={() => addItem(cIdx)}>
                      <Plus className="h-3 w-3 mr-1" /> Add Item
                    </Button>
                  </div>
                  
                  {container.items.length === 0 && (
                    <div className="text-xs text-slate-500 italic">Please add the affected items inside this container.</div>
                  )}

                  {container.items.map((item, iIdx) => (
                    <div key={iIdx} className="flex flex-wrap sm:flex-nowrap items-end gap-3 p-3 bg-white rounded-lg border border-red-50">
                      <div className="w-full sm:flex-1 space-y-1.5">
                        <Label className="text-[10px] uppercase text-slate-500">SFG Serial No.</Label>
                        <Input 
                          placeholder="Inner bottle/pouch..." 
                          value={item.sfgSerialNumber}
                          onChange={(e) => updateItem(cIdx, iIdx, "sfgSerialNumber", e.target.value)}
                        />
                      </div>
                      <div className="w-full sm:flex-1 space-y-1.5">
                        <Label className="text-[10px] uppercase text-slate-500">Loss Type</Label>
                        <Select value={item.lossType} onValueChange={(val) => updateItem(cIdx, iIdx, "lossType", val)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="complete">Complete Loss (Product Destroyed)</SelectItem>
                            <SelectItem value="partial">Partial Loss (Leakage/Damage)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {item.lossType === "partial" && (
                         <div className="w-full sm:flex-1 space-y-1.5">
                         <Label className="text-[10px] uppercase text-slate-500 flex items-center gap-1">
                           <Droplets className="h-3 w-3 text-amber-500" /> Oil Weight Lost
                         </Label>
                         <Input 
                           type="number"
                           placeholder="e.g. 2.5 kg" 
                           value={item.oilWeightLost || ""}
                           onChange={(e) => updateItem(cIdx, iIdx, "oilWeightLost", e.target.value)}
                         />
                       </div>
                      )}
                      <Button variant="ghost" size="icon" className="mb-0.5 text-slate-400 hover:text-red-600 shrink-0" onClick={() => removeItem(cIdx, iIdx)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <Button onClick={() => onSubmit(formData)} disabled={isSubmitting} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
        Submit Unloading Report
      </Button>
    </div>
  )
}
