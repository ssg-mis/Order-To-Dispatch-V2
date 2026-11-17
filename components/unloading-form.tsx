"use client"

import { useMemo, useState } from "react"
import { fmtAmount, fmtNum } from "@/lib/table-format"
import { fmtWeight } from "@/lib/weight-format"
import { useWeightDecimals } from "@/hooks/use-weight-decimals"
import { rateWithoutGst, summarizeGst, taxableOf } from "@/lib/gst"
import { GstTaxRows } from "@/components/workflow/gst-tax-rows"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileUploadField } from "@/components/file-upload-field"
import { DateTime12hField } from "@/components/ui/datetime-12h-field"
import { useObjectUrl, useObjectUrls } from "@/hooks/use-object-urls"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Box, Package, CheckCircle, ReceiptText } from "lucide-react"
import { LOSS_CAUSES, SHORTAGE_CAUSES, DAMAGE_CAUSES, BORNE_BY_LABEL, BORNE_BY_STYLE } from "@/lib/loss-causes"

export type UnloadingDamagedItem = {
  sfgSerialNumber: string
  lossType: "complete" | "partial"
  oilWeightLost?: number | null
}

export type UnloadingDamagedContainer = {
  containerSerialNumber: string
  damageType: "whole" | "partial"
  cause: string
  items: UnloadingDamagedItem[]
}

/** What is reported for ONE product line of the invoice (each line is its own unloading record). */
export type UnloadingLineReport = {
  shortageQty: number
  shortageCause: string
  damagedContainers: UnloadingDamagedContainer[]
}

export type UnloadingFormData = {
  receivedDate: string
  receivedTime: string // 24-hour HH:mm; the field shows it as 12-hour AM / PM
  receivedProofFile: File | null
  remarks: string
  damagePhotoFiles: File[]
  /** keyed by the unloading id of the product line */
  lines: Record<string, UnloadingLineReport>
}

type Entry = {
  shortageQty: string
  shortageCause: string
  completeQty: string // whole TIN / Box lost
  damageCause: string
  partial: string[] // one entry per partly damaged TIN (KGS lost) / Box (pouches lost)
}

const emptyEntry = (): Entry => ({ shortageQty: "", shortageCause: "", completeQty: "", damageCause: "transit_damage", partial: [] })

const pad2 = (n: number) => String(n).padStart(2, "0")
// Local (Indian) date / time now - toISOString() would give the UTC date, which is the previous day before 5:30 AM IST.
const today = () => { const n = new Date(); return `${n.getFullYear()}-${pad2(n.getMonth() + 1)}-${pad2(n.getDate())}` }
const nowTime = () => { const n = new Date(); return `${pad2(n.getHours())}:${pad2(n.getMinutes())}` }

const num = (v: any) => { const x = parseFloat(v); return Number.isFinite(x) ? x : 0 }
const ordinal = (i: number) => { const n = i + 1; const s = ["th", "st", "nd", "rd"]; const v = n % 100; return `${n}${s[(v - 20) % 10] || s[v] || s[0]}` }

/** Everything the valuation needs about one invoice line. */
function lineInfo(line: any) {
  const qty = num(line.actualQty)
  const unitKg = num(line.sku_weight) // net weight of one TIN / Box
  const nos = num(line.nos_per_main_uom) || 1 // pouches (nos) in one main unit
  // Invoice rate per main unit incl. taxes, same as the invoice stages: rate x nos + freight - CD.
  const rate = num(line.rate_of_material) * nos + num(line.freight_rate) - num(line.cd_amount)
  const uom = String(line.uom || "Unit")
  const pouchMode = uom.trim().toLowerCase() === "box" // boxes: pouches lost; tins / jars / buckets: KGS lost
  const sfgKg = num(line.sfg_oil_kg) || unitKg
  return { qty, unitKg, nos, rate, uom, pouchMode, sfgKg }
}

const unitLabel = (uom: string) => uom.toUpperCase()

type SectionRow = { line: any; units: number }

/** Taxable / GST / invoice total for a set of (line, units) the same way an invoice is totalled. */
function sectionTotals(rows: SectionRow[]) {
  const used = rows.filter((r) => r.units > 0)
  if (used.length === 0) return null
  const lines = used.map((r) => ({ taxable: taxableOf(lineInfo(r.line).rate, r.units, r.line), product: r.line }))
  const first = used[0].line
  const gst = summarizeGst(lines, first?.depot_gst_state_code, first?.customer_gst_state_code)
  const rawTotal = gst.complete && gst.totalTaxable !== null ? gst.totalTaxable + gst.cgst + gst.sgst + gst.igst : null
  return { gst, totalTaxable: gst.totalTaxable, invoiceTotal: rawTotal === null ? null : Math.round(rawTotal) }
}

function Totals({ rows, label }: { rows: SectionRow[]; label: string }) {
  const t = sectionTotals(rows)
  if (!t) return null
  return (
    <div className="ml-auto max-w-sm space-y-2 rounded-lg border border-slate-200 bg-white py-3 pl-4 pr-5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[10px] font-black uppercase text-slate-500">Total Taxable</span>
        <span className="font-mono font-bold text-slate-700">{t.totalTaxable === null ? "—" : `₹${fmtAmount(t.totalTaxable)}`}</span>
      </div>
      <GstTaxRows summary={t.gst} />
      <div className="flex items-center justify-between border-t border-slate-200 pt-2">
        <span className="text-[11px] font-black uppercase text-slate-800">{label}</span>
        <span className="font-mono text-sm font-black text-blue-700">{t.invoiceTotal === null ? "—" : `₹${fmtAmount(t.invoiceTotal)}`}</span>
      </div>
    </div>
  )
}

const SectionTitle = ({ icon, children, tone = "text-blue-600" }: { icon: React.ReactNode; children: React.ReactNode; tone?: string }) => (
  <h3 className="flex items-center gap-2.5 border-b pb-3 text-lg font-bold text-slate-900">
    <span className={tone}>{icon}</span>
    {children}
  </h3>
)

const Th = ({ children, right }: { children?: React.ReactNode; right?: boolean }) => (
  <th className={`px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500 ${right ? "text-right" : "text-left"}`}>{children}</th>
)

export function UnloadingForm({
  lines,
  invoiceNo,
  onSubmit,
  onCancel,
  isSubmitting,
}: {
  /** The invoice's product lines (one unloading record each), straight from the earlier stages / the bill. */
  lines: any[]
  invoiceNo?: string
  onSubmit: (data: UnloadingFormData) => void
  onCancel: () => void
  isSubmitting: boolean
}) {
  const wd = useWeightDecimals()
  const [header, setHeader] = useState({
    receivedDate: today(),
    receivedTime: nowTime(),
    receivedProofFile: null as File | null,
    remarks: "",
    damagePhotoFiles: [] as File[],
  })
  const [entries, setEntries] = useState<Record<string, Entry>>({})
  // Picked files are uploaded on submit, so the thumbnails come from local preview URLs.
  const proofPreview = useObjectUrl(header.receivedProofFile)
  const damagePhotoPreviews = useObjectUrls(header.damagePhotoFiles)

  const keyOf = (line: any) => String(line.id)
  const entryOf = (line: any): Entry => entries[keyOf(line)] || emptyEntry()
  const patch = (line: any, p: Partial<Entry>) =>
    setEntries((prev) => ({ ...prev, [keyOf(line)]: { ...(prev[keyOf(line)] || emptyEntry()), ...p } }))

  // ---- per-line figures ----
  const view = useMemo(() => lines.map((line) => {
    const info = lineInfo(line)
    const e = entries[String(line.id)] || emptyEntry()
    const shortage = num(e.shortageQty)
    const complete = Math.floor(num(e.completeQty))
    const partialSum = e.partial.reduce((s, v) => s + num(v), 0)
    // Partial loss as a fraction of one unit: KGS lost / net KGS of a TIN, or pouches lost / pouches in a Box.
    const partialUnits = info.pouchMode
      ? partialSum / info.nos
      : info.sfgKg > 0 ? partialSum / info.sfgKg : 0
    const partialKg = info.pouchMode ? (partialSum * info.unitKg) / info.nos : partialSum
    const left = info.qty - shortage
    const overDamage = complete + e.partial.length > left
    return { line, info, e, shortage, complete, partialSum, partialUnits, partialKg, overDamage, hasDamage: complete > 0 || e.partial.length > 0 }
  }), [lines, entries])

  const anyDamage = view.some((v) => v.hasDamage)
  const anyShortage = view.some((v) => v.shortage > 0)
  const usesOtherCause = view.some((v) => (v.shortage > 0 && v.e.shortageCause === "other") || (v.hasDamage && v.e.damageCause === "other"))
  const remarksMissing = usesOtherCause && !header.remarks.trim()

  // ---- validation ----
  let error: string | null = null
  for (const v of view) {
    const name = v.line.productName || "Product"
    if (v.shortage < 0 || v.complete < 0) { error = `${name}: quantity cannot be negative.`; break }
    if (v.shortage > v.info.qty) { error = `${name}: shortage (${v.shortage}) cannot exceed the dispatched quantity (${v.info.qty}).`; break }
    if (v.shortage > 0 && !v.e.shortageCause) { error = `${name}: select the cause of the shortage.`; break }
    if (v.overDamage) { error = `${name}: damaged ${v.info.uom}s cannot exceed the quantity received (${v.info.qty - v.shortage}).`; break }
    if (v.hasDamage && !v.e.damageCause) { error = `${name}: select the cause of the damage.`; break }
    if (v.e.partial.some((a) => !(num(a) > 0))) { error = `${name}: enter ${v.info.pouchMode ? "the pouches" : "the KGS"} lost for every partly damaged ${v.info.uom}.`; break }
    if (!v.info.pouchMode && v.e.partial.some((a) => num(a) > v.info.unitKg && v.info.unitKg > 0)) { error = `${name}: KGS lost in one ${v.info.uom} cannot exceed ${fmtWeight(v.info.unitKg, wd)} KGS.`; break }
    if (v.info.pouchMode && v.e.partial.some((a) => num(a) > v.info.nos)) { error = `${name}: pouches lost in one ${v.info.uom} cannot exceed ${v.info.nos}.`; break }
  }
  if (!error && anyDamage && header.damagePhotoFiles.length === 0) error = "Upload at least one photo of the damage."

  const submit = () => {
    const out: Record<string, UnloadingLineReport> = {}
    for (const v of view) {
      const containers: UnloadingDamagedContainer[] = []
      for (let i = 0; i < v.complete; i++) {
        containers.push({ containerSerialNumber: `${v.line.id}-C${i + 1}`, damageType: "whole", cause: v.e.damageCause, items: [] })
      }
      v.e.partial.forEach((amount, i) => {
        const serial = `${v.line.id}-P${i + 1}`
        const items: UnloadingDamagedItem[] = v.info.pouchMode
          ? Array.from({ length: Math.round(num(amount)) }, (_, j) => ({ sfgSerialNumber: `${serial}-${j + 1}`, lossType: "complete" as const, oilWeightLost: null }))
          : [{ sfgSerialNumber: `${serial}-KG`, lossType: "partial" as const, oilWeightLost: num(amount) }]
        containers.push({ containerSerialNumber: serial, damageType: "partial", cause: v.e.damageCause, items })
      })
      out[keyOf(v.line)] = { shortageQty: v.shortage, shortageCause: v.shortage > 0 ? v.e.shortageCause : "", damagedContainers: containers }
    }
    onSubmit({ ...header, lines: out })
  }

  const taxableText = (line: any, units: number) => {
    if (!(units > 0)) return "—"
    const t = taxableOf(lineInfo(line).rate, units, line)
    return t === null ? "—" : fmtAmount(t)
  }
  const rateText = (line: any) => {
    const r = lineInfo(line).rate
    const v = rateWithoutGst(r, line)
    return r && v !== null ? fmtAmount(v) : "—"
  }

  const inputCls = "h-8 w-24 text-right"

  return (
    <div className="space-y-8">
      {/* Receipt details */}
      <section className="space-y-4">
        <SectionTitle icon={<CheckCircle className="h-5 w-5" />}>Receipt Details</SectionTitle>
        <div className="grid grid-cols-1 items-start gap-x-6 gap-y-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Unloading Completed On (Date &amp; Time) <span className="text-red-500">*</span></Label>
            <DateTime12hField
              date={header.receivedDate}
              time={header.receivedTime}
              onChange={({ date, time }) => setHeader((h) => ({ ...h, receivedDate: date, receivedTime: time }))}
            />
          </div>
          <div className="space-y-2">
            <FileUploadField
              label={<Label>Proof of Delivery <span className="text-xs font-normal text-slate-500">(optional)</span></Label>}
              accept="image/*,.pdf"
              variant="dropzone"
              helperText="Photo / scan of the signed challan or invoice copy with the customer's stamp & signature. Max 20 MB."
              buttonText="Click to select proof"
              fileName={header.receivedProofFile?.name || ""}
              value={header.receivedProofFile?.type.startsWith("image/") ? proofPreview : undefined}
              onFilesSelected={(files) => files[0] && setHeader((h) => ({ ...h, receivedProofFile: files[0] }))}
              onRemove={() => setHeader((h) => ({ ...h, receivedProofFile: null }))}
            />
          </div>
        </div>
      </section>

      {/* Invoice (products come from the bill) */}
      <section className="space-y-4">
        <SectionTitle icon={<ReceiptText className="h-5 w-5" />}>Invoice {invoiceNo ? <span className="text-blue-600">{invoiceNo}</span> : null}</SectionTitle>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-xs">
            <thead className="bg-slate-50">
              <tr><Th>#</Th><Th>Product</Th><Th right>Qty</Th><Th>UOM</Th><Th right>KGS</Th><Th right>Rate (₹)</Th><Th right>Taxable Amount (₹)</Th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {view.map((v, i) => (
                <tr key={keyOf(v.line)}>
                  <td className="px-3 py-2 text-slate-500">{i + 1}</td>
                  <td className="px-3 py-2 font-semibold text-slate-800">{v.line.productName || "—"}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtNum(v.info.qty, 0)}</td>
                  <td className="px-3 py-2">{unitLabel(v.info.uom)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtWeight(v.info.qty * v.info.unitKg, wd)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{rateText(v.line)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{taxableText(v.line, v.info.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Totals rows={view.map((v) => ({ line: v.line, units: v.info.qty }))} label="Invoice Amount" />
      </section>

      {/* Shortage - product wise */}
      <section className="space-y-4">
        <SectionTitle icon={<Package className="h-5 w-5" />}>Shortage <span className="text-sm font-medium text-slate-500">(enter the shortage of each product)</span></SectionTitle>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-xs">
            <thead className="bg-slate-50">
              <tr><Th>Product</Th><Th right>Dispatched</Th><Th>UOM</Th><Th right>Shortage Qty</Th><Th right>KGS</Th><Th right>Taxable (₹)</Th><Th>Cause</Th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {view.map((v) => (
                <tr key={keyOf(v.line)}>
                  <td className="px-3 py-2 font-semibold text-slate-800">{v.line.productName || "—"}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-500">{fmtNum(v.info.qty, 0)}</td>
                  <td className="px-3 py-2">{unitLabel(v.info.uom)}</td>
                  <td className="px-3 py-2 text-right">
                    <Input type="number" min={0} max={v.info.qty} className={inputCls} placeholder="0" value={v.e.shortageQty}
                      onChange={(e) => patch(v.line, { shortageQty: e.target.value })} />
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtWeight(v.shortage * v.info.unitKg, wd)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{taxableText(v.line, v.shortage)}</td>
                  <td className="px-3 py-2">
                    {v.shortage > 0 ? (
                      <div className="flex items-center gap-2">
                        <Select value={v.e.shortageCause} onValueChange={(val) => patch(v.line, { shortageCause: val })}>
                          <SelectTrigger className="h-8 w-44"><SelectValue placeholder="Select cause" /></SelectTrigger>
                          <SelectContent>{SHORTAGE_CAUSES.map((k) => <SelectItem key={k} value={k}>{LOSS_CAUSES[k].label}</SelectItem>)}</SelectContent>
                        </Select>
                        {v.e.shortageCause && LOSS_CAUSES[v.e.shortageCause] && (
                          <Badge className={`${BORNE_BY_STYLE[LOSS_CAUSES[v.e.shortageCause].borneBy]} whitespace-nowrap text-[10px] font-black`}>
                            {BORNE_BY_LABEL[LOSS_CAUSES[v.e.shortageCause].borneBy]}
                          </Badge>
                        )}
                      </div>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {anyShortage && <Totals rows={view.map((v) => ({ line: v.line, units: v.shortage }))} label="Shortage Invoice" />}
      </section>

      {/* Damage - product wise */}
      <section className="space-y-6">
        <SectionTitle icon={<Box className="h-5 w-5" />} tone="text-red-500">Damage <span className="text-sm font-medium text-slate-500">(enter the damaged quantity of each product)</span></SectionTitle>

        {/* Complete damage */}
        <div className="space-y-3">
          <p className="text-sm font-bold text-slate-800">Damage (Complete) <span className="font-normal text-slate-500">- whole TIN / Box destroyed</span></p>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr><Th>Product</Th><Th right>Received</Th><Th>UOM</Th><Th right>Damaged Qty</Th><Th right>KGS</Th><Th right>Taxable (₹)</Th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {view.map((v) => (
                  <tr key={keyOf(v.line)}>
                    <td className="px-3 py-2 font-semibold text-slate-800">{v.line.productName || "—"}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-500">{fmtNum(v.info.qty - v.shortage, 0)}</td>
                    <td className="px-3 py-2">{unitLabel(v.info.uom)}</td>
                    <td className="px-3 py-2 text-right">
                      <Input type="number" min={0} step={1} className={inputCls} placeholder="0" value={v.e.completeQty}
                        onChange={(e) => patch(v.line, { completeQty: e.target.value })} />
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtWeight(v.complete * v.info.unitKg, wd)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{taxableText(v.line, v.complete)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Totals rows={view.map((v) => ({ line: v.line, units: v.complete }))} label="Damage Invoice" />
        </div>

        {/* Partial damage */}
        <div className="space-y-3">
          <p className="text-sm font-bold text-slate-800">Damage (Partial) <span className="font-normal text-slate-500">- TIN: KGS lost, Box: pouches lost</span></p>
          <div className="space-y-3">
            {view.map((v) => {
              const what = v.info.pouchMode ? "Pouch" : "KGS"
              return (
                <div key={keyOf(v.line)} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-sm font-semibold text-slate-800">{v.line.productName || "—"}</span>
                      <span className="ml-2 text-xs text-slate-500">
                        {v.e.partial.length} {unitLabel(v.info.uom)} · taxable ₹{taxableText(v.line, v.partialUnits)}
                      </span>
                    </div>
                    <Button type="button" size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => patch(v.line, { partial: [...v.e.partial, ""] })}>
                      <Plus className="mr-1 h-3.5 w-3.5" /> Add damaged {unitLabel(v.info.uom)}
                    </Button>
                  </div>
                  {v.e.partial.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {v.e.partial.map((amount, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="w-28 text-xs font-semibold text-slate-600">{ordinal(i)} {unitLabel(v.info.uom)}</span>
                          <Input type="number" min={0} step={v.info.pouchMode ? 1 : "any"} className="h-8 w-28 text-right" placeholder="0" value={amount}
                            onChange={(e) => patch(v.line, { partial: v.e.partial.map((a, j) => (j === i ? e.target.value : a)) })} />
                          <span className="text-xs font-semibold text-slate-500">{what}</span>
                          <Button type="button" variant="ghost" size="icon" className="ml-auto h-7 w-7 text-slate-400 hover:text-red-600"
                            onClick={() => patch(v.line, { partial: v.e.partial.filter((_, j) => j !== i) })}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <Totals rows={view.map((v) => ({ line: v.line, units: v.partialUnits }))} label="Damage Invoice" />
        </div>

        {/* Cause of damage, per product that has damage */}
        {anyDamage && (
          <div className="space-y-3">
            <p className="text-sm font-bold text-slate-800">Cause of Damage</p>
            <div className="space-y-2">
              {view.filter((v) => v.hasDamage).map((v) => (
                <div key={keyOf(v.line)} className="flex flex-wrap items-center gap-3 rounded-lg border border-red-100 bg-red-50/40 px-3 py-2">
                  <span className="min-w-48 text-sm font-semibold text-slate-800">{v.line.productName || "—"}</span>
                  <Select value={v.e.damageCause} onValueChange={(val) => patch(v.line, { damageCause: val })}>
                    <SelectTrigger className="h-8 w-52"><SelectValue placeholder="Select cause" /></SelectTrigger>
                    <SelectContent>{DAMAGE_CAUSES.map((k) => <SelectItem key={k} value={k}>{LOSS_CAUSES[k].label}</SelectItem>)}</SelectContent>
                  </Select>
                  {v.e.damageCause && LOSS_CAUSES[v.e.damageCause] && (
                    <Badge className={`${BORNE_BY_STYLE[LOSS_CAUSES[v.e.damageCause].borneBy]} text-[10px] font-black`}>
                      Borne by: {BORNE_BY_LABEL[LOSS_CAUSES[v.e.damageCause].borneBy]}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Always available; required only once some damage is reported. */}
        <FileUploadField
          label={<>Upload Damage Photos {anyDamage ? <span className="text-red-500">*</span> : <span className="text-xs font-normal text-slate-500">(required if there is damage)</span>}</>}
          accept="image/*"
          multiple
          variant="dropzone"
          helperText="Max file size: 20 MB"
          buttonText="Click to select photos"
          fileName={header.damagePhotoFiles.map((f) => f.name)}
          value={damagePhotoPreviews}
          onFilesSelected={(files) => setHeader((h) => ({ ...h, damagePhotoFiles: [...h.damagePhotoFiles, ...files] }))}
          onRemove={(index) => setHeader((h) => ({ ...h, damagePhotoFiles: h.damagePhotoFiles.filter((_, i) => i !== index) }))}
        />
      </section>

      {/* Remarks */}
      <section className="space-y-2">
        <Label>Remarks {usesOtherCause && <span className="text-red-500">*</span>}</Label>
        <Textarea
          placeholder={usesOtherCause ? "Explain the 'Other' cause (required)..." : "Any additional notes..."}
          aria-invalid={remarksMissing}
          value={header.remarks}
          onChange={(e) => setHeader((h) => ({ ...h, remarks: e.target.value }))}
          rows={2}
          className={remarksMissing ? "border-red-400 focus-visible:ring-red-300" : ""}
        />
        {remarksMissing && <p className="text-xs font-medium text-red-600">Describe the cause - "Other" needs an explanation.</p>}
      </section>

      {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}

      <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="h-11 sm:h-10">
          Cancel
        </Button>
        <Button
          type="button"
          onClick={submit}
          disabled={isSubmitting || !!error || remarksMissing}
          className="min-w-37.5 bg-blue-600 hover:bg-blue-700 h-11 sm:h-10"
        >
          {isSubmitting ? "Processing..." : "Submit Unloading Report"}
        </Button>
      </div>
    </div>
  )
}
