"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileUploadField } from "@/components/file-upload-field"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Box, Package, Droplets, CheckCircle } from "lucide-react"
import { LOSS_CAUSES, SHORTAGE_CAUSES, DAMAGE_CAUSES, BORNE_BY_LABEL, BORNE_BY_STYLE } from "@/lib/loss-causes"

export type UnloadingDamagedItem = {
  sfgSerialNumber: string
  lossType: "complete" | "partial"
  oilWeightLost?: string
}

export type UnloadingDamagedContainer = {
  containerSerialNumber: string
  damageType: "whole" | "partial"
  cause: string
  items: UnloadingDamagedItem[]
}

export type UnloadingFormData = {
  receivedDate: string
  receivedProofFile: File | null
  shortageQty: string
  shortageCause: string
  remarks: string
  damagedContainers: UnloadingDamagedContainer[]
  damagePhotoFiles: File[]
}

const today = () => new Date().toISOString().split("T")[0]

export function UnloadingForm({
  onSubmit,
  onCancel,
  isSubmitting,
  dispatchedQty,
  sfgOilKg,
}: {
  onSubmit: (data: UnloadingFormData) => void
  onCancel: () => void
  isSubmitting: boolean
  /** Total quantity dispatched on this invoice — caps the shortage. */
  dispatchedQty?: number
  /** Oil (kg) in one semi-finished good, from the SFG master; used for complete losses. */
  sfgOilKg?: number | null
}) {
  const [formData, setFormData] = useState<UnloadingFormData>({
    receivedDate: today(),
    receivedProofFile: null,
    shortageQty: "",
    shortageCause: "",
    remarks: "",
    damagedContainers: [],
    damagePhotoFiles: [],
  })

  const addContainer = () => {
    setFormData(prev => ({
      ...prev,
      damagedContainers: [
        ...prev.damagedContainers,
        { containerSerialNumber: "", damageType: "whole", cause: "transit_damage", items: [] }
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
        newContainers[cIdx] = { ...newContainers[cIdx], items: [] } // reset items if changed to whole
      }
      return { ...prev, damagedContainers: newContainers }
    })
  }

  const addItem = (cIdx: number) => {
    setFormData(prev => {
      const newContainers = [...prev.damagedContainers]
      newContainers[cIdx] = {
        ...newContainers[cIdx],
        items: [...newContainers[cIdx].items, { sfgSerialNumber: "", lossType: "complete" }],
      }
      return { ...prev, damagedContainers: newContainers }
    })
  }

  const removeItem = (cIdx: number, iIdx: number) => {
    setFormData(prev => {
      const newContainers = [...prev.damagedContainers]
      newContainers[cIdx] = { ...newContainers[cIdx], items: newContainers[cIdx].items.filter((_, i) => i !== iIdx) }
      return { ...prev, damagedContainers: newContainers }
    })
  }

  const updateItem = (cIdx: number, iIdx: number, field: keyof UnloadingDamagedItem, value: any) => {
    setFormData(prev => {
      const newContainers = [...prev.damagedContainers]
      const newItems = [...newContainers[cIdx].items]
      newItems[iIdx] = { ...newItems[iIdx], [field]: value }
      newContainers[cIdx] = { ...newContainers[cIdx], items: newItems }
      return { ...prev, damagedContainers: newContainers }
    })
  }

  // Total oil lost across every reported item (partial = entered, complete = SFG master).
  const totalOilLost = formData.damagedContainers.reduce((sum, c) => sum + c.items.reduce((s, item) => {
    if (item.lossType === "partial") return s + (Number(item.oilWeightLost) || 0)
    return s + (sfgOilKg || 0)
  }, 0), 0)

  const hasDamage = formData.damagedContainers.length > 0

  return (
    <div className="space-y-8">
      {/* Receipt details */}
      <section className="space-y-4">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b pb-2">
          <CheckCircle className="h-4 w-4 text-blue-600" />
          Receipt Details
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Unloading Completed On <span className="text-red-500">*</span></Label>
            <Input
              type="date"
              max={today()}
              value={formData.receivedDate}
              onChange={(e) => setFormData({ ...formData, receivedDate: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <FileUploadField
              label="Received Proof (optional)"
              accept="image/*,.pdf"
              variant="dropzone"
              helperText="Max file size: 20 MB"
              buttonText="Click to select proof"
              fileName={formData.receivedProofFile?.name || ""}
              onFilesSelected={(files) => files[0] && setFormData(prev => ({ ...prev, receivedProofFile: files[0] }))}
              onRemove={() => setFormData(prev => ({ ...prev, receivedProofFile: null }))}
            />
          </div>
        </div>
      </section>

      {/* Shortage */}
      <section className="space-y-4">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b pb-2">
          <Package className="h-4 w-4 text-blue-600" />
          Shortage & Remarks
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>
              Total Shortage Quantity
              {dispatchedQty ? <span className="ml-1 text-xs font-normal text-slate-500">(dispatched: {dispatchedQty})</span> : null}
            </Label>
            <Input
              type="number"
              min={0}
              max={dispatchedQty || undefined}
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
          {Number(formData.shortageQty) > 0 && (
            <div className="space-y-2 sm:col-span-2">
              <Label>Cause of Shortage <span className="text-red-500">*</span></Label>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <Select value={formData.shortageCause} onValueChange={(val) => setFormData({ ...formData, shortageCause: val })}>
                  <SelectTrigger className="w-full sm:max-w-sm"><SelectValue placeholder="Select cause" /></SelectTrigger>
                  <SelectContent>
                    {SHORTAGE_CAUSES.map(k => <SelectItem key={k} value={k}>{LOSS_CAUSES[k].label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {formData.shortageCause && (
                  <Badge className={`${BORNE_BY_STYLE[LOSS_CAUSES[formData.shortageCause].borneBy]} text-[10px] font-black`}>
                    Borne by: {BORNE_BY_LABEL[LOSS_CAUSES[formData.shortageCause].borneBy]}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Damage */}
      <section className="space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-2 border-b pb-2">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Box className="h-4 w-4 text-red-500" />
            Damage Tracking
          </h3>
          <Button type="button" onClick={addContainer} variant="outline" size="sm" className="border-red-200 text-red-600 hover:bg-red-50">
            <Plus className="h-4 w-4 mr-2" />
            Add Damaged Container (TIN/Box)
          </Button>
        </div>

        {!hasDamage && (
          <div className="text-center p-6 rounded-lg border border-dashed border-slate-300 text-sm text-slate-500">
            No damages reported. Use the button above to add damaged TINs/Boxes.
          </div>
        )}

        <div className="space-y-4">
          {formData.damagedContainers.map((container, cIdx) => (
            <div key={cIdx} className="p-4 rounded-lg border border-red-200 bg-red-50/40 space-y-4 relative">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 text-slate-400 hover:text-red-600"
                onClick={() => removeContainer(cIdx)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pr-10">
                <div className="space-y-2">
                  <Label>Container Serial No. (TIN/Box) <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="Scan or enter barcode..."
                    value={container.containerSerialNumber}
                    onChange={(e) => updateContainer(cIdx, "containerSerialNumber", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Damage Type</Label>
                  <Select value={container.damageType} onValueChange={(val) => updateContainer(cIdx, "damageType", val)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whole">Whole Container Lost/Destroyed</SelectItem>
                      <SelectItem value="partial">Partial Damage (Internal items lost)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Cause of Damage <span className="text-red-500">*</span></Label>
                  <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                    <Select value={container.cause} onValueChange={(val) => updateContainer(cIdx, "cause", val)}>
                      <SelectTrigger className="w-full sm:max-w-sm"><SelectValue placeholder="Select cause" /></SelectTrigger>
                      <SelectContent>
                        {DAMAGE_CAUSES.map(k => <SelectItem key={k} value={k}>{LOSS_CAUSES[k].label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {container.cause && LOSS_CAUSES[container.cause] && (
                      <Badge className={`${BORNE_BY_STYLE[LOSS_CAUSES[container.cause].borneBy]} text-[10px] font-black`}>
                        Borne by: {BORNE_BY_LABEL[LOSS_CAUSES[container.cause].borneBy]}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {container.damageType === "partial" && (
                <div className="pt-4 border-t border-red-200 space-y-3">
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
                    <div key={iIdx} className="flex flex-wrap sm:flex-nowrap items-end gap-3 p-3 rounded-lg border border-red-100 bg-background">
                      <div className="w-full sm:flex-1 space-y-1.5">
                        <Label className="text-[10px] uppercase text-slate-500">SFG Serial No. <span className="text-red-500">*</span></Label>
                        <Input
                          placeholder="Inner bottle/pouch..."
                          value={item.sfgSerialNumber}
                          onChange={(e) => updateItem(cIdx, iIdx, "sfgSerialNumber", e.target.value)}
                        />
                      </div>
                      <div className="w-full sm:flex-1 space-y-1.5">
                        <Label className="text-[10px] uppercase text-slate-500">Loss Type</Label>
                        <Select value={item.lossType} onValueChange={(val) => updateItem(cIdx, iIdx, "lossType", val)}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="complete">Complete Loss (Product Destroyed)</SelectItem>
                            <SelectItem value="partial">Partial Loss (Leakage/Damage)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-full sm:flex-1 space-y-1.5">
                        <Label className="text-[10px] uppercase text-slate-500 flex items-center gap-1">
                          <Droplets className="h-3 w-3 text-amber-500" /> Oil Weight Lost (kg)
                          {item.lossType === "partial" && <span className="text-red-500">*</span>}
                        </Label>
                        {item.lossType === "partial" ? (
                          <Input
                            type="number"
                            min={0}
                            placeholder="e.g. 2.5"
                            value={item.oilWeightLost || ""}
                            onChange={(e) => updateItem(cIdx, iIdx, "oilWeightLost", e.target.value)}
                          />
                        ) : (
                          <div className="h-9 flex items-center px-3 rounded-md border border-dashed border-slate-300 text-sm text-slate-500">
                            {sfgOilKg ? `${sfgOilKg} kg (auto, full item)` : "Auto from SFG master"}
                          </div>
                        )}
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="mb-0.5 text-slate-400 hover:text-red-600 shrink-0" onClick={() => removeItem(cIdx, iIdx)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {hasDamage && (
          <>
            <div className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm">
              <span className="font-semibold text-amber-800 flex items-center gap-2">
                <Droplets className="h-4 w-4" /> Total oil weight lost
              </span>
              <span className="font-black text-amber-900">{totalOilLost.toFixed(3)} kg</span>
            </div>
            <FileUploadField
              label={<>Upload Damage Photos <span className="text-red-500">*</span></>}
              accept="image/*"
              multiple
              variant="dropzone"
              helperText="Max file size: 20 MB"
              buttonText="Click to select photos"
              fileName={formData.damagePhotoFiles.map(f => f.name)}
              onFilesSelected={(files) => setFormData(prev => ({ ...prev, damagePhotoFiles: [...prev.damagePhotoFiles, ...files] }))}
              onRemove={(index) => setFormData(prev => ({ ...prev, damagePhotoFiles: prev.damagePhotoFiles.filter((_, i) => i !== index) }))}
            />
          </>
        )}
      </section>

      <div className="flex flex-col sm:flex-row sm:justify-end gap-3 border-t pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="h-11 sm:h-10">
          Cancel
        </Button>
        <Button
          type="button"
          onClick={() => onSubmit(formData)}
          disabled={isSubmitting}
          className="bg-blue-600 hover:bg-blue-700 min-w-37.5 h-11 sm:h-10"
        >
          {isSubmitting ? "Processing..." : "Submit Unloading Report"}
        </Button>
      </div>
    </div>
  )
}
