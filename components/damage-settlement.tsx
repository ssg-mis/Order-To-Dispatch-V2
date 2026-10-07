"use client"

import * as React from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { FileUploadField } from "@/components/file-upload-field"
import { cn } from "@/lib/utils"
import { fmtNum } from "@/lib/table-format"
import { AlertTriangle, FileText, IndianRupee, Landmark, Package, Undo2, Truck, type LucideIcon } from "lucide-react"

export type SettlementDocs = {
  creditNoteNo: string
  creditNoteDate: string
  creditNoteGstPercent: string
  creditNoteCopy: File | null
  debitNoteNo: string
  debitNoteDate: string
  debitNoteCopy: File | null
  reverseTransferNo: string
  reverseTransferDate: string
  reverseTransferCopy: File | null
  settlementRemarks: string
}

export const EMPTY_SETTLEMENT_DOCS: SettlementDocs = {
  creditNoteNo: "", creditNoteDate: "", creditNoteGstPercent: "", creditNoteCopy: null,
  debitNoteNo: "", debitNoteDate: "", debitNoteCopy: null,
  reverseTransferNo: "", reverseTransferDate: "", reverseTransferCopy: null,
  settlementRemarks: "",
}

export const COMPANY_LOSS_HEAD = "Transit Damage / Shortage Written Off"

const isTransfer = (category: any) => String(category ?? "").toLowerCase().trim() === "stock transfer"
const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * What must be settled for the selected shipment lines. Mirrors the backend rule
 * (damageAdjustmentService.js#_computeSettlement) - the backend is the source of truth.
 *   Sales          : credit note = company + transporter share; company share -> P&L
 *   Stock Transfer : reverse stock transfer for the lost qty; company + depot share -> P&L
 *   Transporter    : debit note for its share (both)
 */
export function computeSettlement(lines: any[]) {
  let creditNoteTaxable = 0, debitNote = 0, reverseQty = 0, companyLoss = 0, customerShare = 0
  let gstKnown = 0, taxableUnknownRate = 0
  const rates = new Set<number>()
  for (const p of lines) {
    const company = Number(p.lossCompany) || 0
    const transporter = Number(p.lossTransporter) || 0
    const customer = Number(p.lossCustomer) || 0
    debitNote += transporter
    if (isTransfer(p.orderCategory)) {
      reverseQty += Number(p.lossQty) || 0
      companyLoss += company + customer
    } else {
      const taxable = company + transporter
      creditNoteTaxable += taxable
      // GST comes from the product's SKU master rate; lines without one need a manual %.
      const rate = p.gstRate === null || p.gstRate === undefined || p.gstRate === "" ? null : Number(p.gstRate)
      if (taxable > 0) {
        if (rate === null || !Number.isFinite(rate)) taxableUnknownRate += taxable
        else { gstKnown += taxable * rate / 100; rates.add(rate) }
      }
      companyLoss += company
      customerShare += customer
    }
  }
  return {
    creditNoteTaxable: round2(creditNoteTaxable),
    debitNote: round2(debitNote),
    reverseQty: Math.round(reverseQty * 10000) / 10000,
    companyLoss: round2(companyLoss),
    customerShare: round2(customerShare),
    gstKnown: round2(gstKnown),
    taxableUnknownRate: round2(taxableUnknownRate),
    rates: [...rates].sort((a, b) => a - b),
  }
}

export type Settlement = ReturnType<typeof computeSettlement>

/** True when every document that applies has its number and date. */
export function settlementComplete(st: Settlement, docs: SettlementDocs) {
  if (st.creditNoteTaxable > 0 && st.taxableUnknownRate > 0) {
    // Some product has no GST rate in the SKU master - the manual % is mandatory.
    const manual = docs.creditNoteGstPercent === "" ? NaN : Number(docs.creditNoteGstPercent)
    if (!Number.isFinite(manual) || manual < 0 || manual > 100) return false
  }
  if (st.creditNoteTaxable > 0 && !(docs.creditNoteNo.trim() && docs.creditNoteDate)) return false
  if (st.debitNote > 0 && !(docs.debitNoteNo.trim() && docs.debitNoteDate)) return false
  if (st.reverseQty > 0 && !(docs.reverseTransferNo.trim() && docs.reverseTransferDate)) return false
  return true
}

const inr = (n: number) => fmtNum(n, 2)

const ACCENTS = {
  blue: "bg-blue-50 text-blue-600",
  amber: "bg-amber-50 text-amber-600",
  violet: "bg-violet-50 text-violet-600",
  slate: "bg-slate-100 text-slate-600",
  red: "bg-red-50 text-red-600",
} as const
type Accent = keyof typeof ACCENTS

export function IconTile({ icon: Icon, accent = "blue", className }: { icon: LucideIcon; accent?: Accent; className?: string }) {
  return (
    <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", ACCENTS[accent], className)}>
      <Icon className="h-5 w-5" />
    </div>
  )
}

/** Modal section heading: tinted icon + title + optional hint, over a divider. */
export function SectionHeading({ icon, accent = "blue", title, hint }: { icon: LucideIcon; accent?: Accent; title: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b pb-3">
      <IconTile icon={icon} accent={accent} />
      <div className="min-w-0">
        <h3 className="text-lg font-bold leading-tight text-slate-900">{title}</h3>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  )
}

function Section({ icon, accent, title, summary, children }: { icon: LucideIcon; accent: Accent; title: string; summary: React.ReactNode; children?: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50 px-4 py-3">
        <div className="flex items-center gap-3">
          <IconTile icon={icon} accent={accent} />
          <h4 className="text-base font-semibold text-slate-900">{title}</h4>
        </div>
        <p className="rounded-full border bg-white px-3 py-1 text-sm font-semibold text-slate-900">{summary}</p>
      </div>
      <div className="space-y-4 p-4">{children}</div>
    </section>
  )
}

function Stat({ icon, accent, label, value }: { icon: LucideIcon; accent: Accent; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-white p-4 shadow-sm">
      <IconTile icon={icon} accent={accent} className="h-11 w-11" />
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="truncate text-xl font-semibold text-slate-900">{value}</p>
      </div>
    </div>
  )
}

/** Key numbers for the selected lines + a plain table of who bears the loss and what happens next. */
export function LossOverview({ invoiceQty, damageQty, company, transporter, customer, isStockTransfer }: {
  invoiceQty: number; damageQty: number; company: number; transporter: number; customer: number; isStockTransfer: boolean
}) {
  const total = company + transporter + customer
  // A percentage only helps when the loss is shared; "100%" on a single party adds nothing.
  const showPct = [company, transporter, customer].filter(v => v > 0).length > 1
  const rows = [
    {
      key: "company", label: "Company", value: company, dot: "bg-blue-600",
      action: "Booked as the company's own loss (P&L)",
    },
    {
      key: "transporter", label: "Transporter", value: transporter, dot: "bg-amber-500",
      action: "Recovered from the transporter with a Debit Note",
    },
    {
      key: "customer", label: isStockTransfer ? "Depot" : "Customer", value: customer, dot: "bg-violet-500",
      action: isStockTransfer ? "Depot belongs to the company - booked as company loss" : "Customer pays for this - no document needed",
    },
  ]
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat icon={Package} accent="blue" label="Invoice quantity" value={<span className="font-mono tabular-nums">{fmtNum(invoiceQty, 4)}</span>} />
        <Stat icon={AlertTriangle} accent="red" label="Damaged / short quantity" value={<span className="font-mono tabular-nums">{fmtNum(damageQty, 4)}</span>} />
        <Stat icon={IndianRupee} accent="amber" label="Total loss value (₹)" value={<span className="font-mono tabular-nums">{inr(total)}</span>} />
      </div>
      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <div className="border-b bg-slate-50 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">Who bears the loss (₹)</p>
          <p className="text-xs text-slate-500">As decided in the Unloading report</p>
        </div>
        <div className="divide-y">
          {rows.map(r => (
            <div key={r.key} className={cn("grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-0.5 px-4 py-3 sm:grid-cols-[180px_200px_1fr]", r.value <= 0 && "opacity-50")}>
              <div className="flex items-center gap-2">
                <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", r.dot)} />
                <span className="text-sm font-medium text-slate-900">{r.label}</span>
              </div>
              <p className="flex items-center justify-end gap-2 font-mono tabular-nums text-sm font-semibold text-slate-900 sm:justify-start">
                {inr(r.value)}
                {showPct && r.value > 0 && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {Math.round((r.value / total) * 100)}%
                  </span>
                )}
              </p>
              <p className="col-span-2 text-xs text-slate-500 sm:col-span-1 sm:text-sm">{r.value > 0 ? r.action : "Nothing to settle"}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function DocRow({ noLabel, no, onNo, date, onDate, noPlaceholder, copy, onCopy, uploading, children }: {
  noLabel: string; no: string; onNo: (v: string) => void; date: string; onDate: (v: string) => void
  noPlaceholder: string; copy: File | null; onCopy: (f: File | null) => void; uploading?: boolean; children?: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-3 items-start">
      <div className="space-y-2">
        <Label className="min-h-5">{noLabel} <span className="text-red-500">*</span></Label>
        <Input value={no} onChange={(e) => onNo(e.target.value)} placeholder={noPlaceholder} />
      </div>
      <div className="space-y-2">
        <Label className="min-h-5">Date <span className="text-red-500">*</span></Label>
        <Input type="date" value={date} onChange={(e) => onDate(e.target.value)} />
      </div>
      <FileUploadField
        label={<Label className="min-h-5 flex items-center">Copy <span className="text-xs font-normal text-slate-500 ml-1">(optional)</span></Label>}
        accept="image/*,.pdf"
        variant="dropzone"
        helperText="Max 20 MB"
        buttonText="Click to select copy"
        uploading={uploading}
        fileName={copy?.name || ""}
        onFilesSelected={(files) => files[0] && onCopy(files[0])}
        onRemove={() => onCopy(null)}
      />
      {children}
    </div>
  )
}

export function DamageSettlement({
  isStockTransfer, settlement, docs, onChange, transporterName, isUploading,
}: {
  isStockTransfer: boolean
  settlement: Settlement
  docs: SettlementDocs
  onChange: (patch: Partial<SettlementDocs>) => void
  transporterName?: string
  isUploading?: boolean
}) {
  const manualGst = docs.creditNoteGstPercent === "" ? 0 : Number(docs.creditNoteGstPercent) || 0
  const gstAmount = round2(settlement.gstKnown + settlement.taxableUnknownRate * manualGst / 100)
  const nothing = settlement.creditNoteTaxable <= 0 && settlement.debitNote <= 0 && settlement.reverseQty <= 0 && settlement.companyLoss <= 0

  return (
    <div className="space-y-4">
      <SectionHeading
        icon={FileText}
        title={<>Settlement - {isStockTransfer ? "Stock Transfer" : "Sales"}</>}
        hint="Documents to raise for each party's share of the loss"
      />

      {nothing && (
        <div className="rounded-lg border border-dashed p-4 text-sm text-slate-600">
          Nothing to settle - no loss falls on the Company or the Transporter. Complete the adjustment to close this shipment.
        </div>
      )}

      {settlement.creditNoteTaxable > 0 && (
        <Section icon={FileText} accent="blue" title="Credit Note to Customer" summary={<>Taxable (₹) <span className="font-mono tabular-nums">{inr(settlement.creditNoteTaxable)}</span></>}>
          <p className="text-xs text-slate-500">
            Loss not caused by the customer (Company + Transporter share) is credited against the original invoice.
          </p>
          <DocRow
            noLabel="Credit Note No" no={docs.creditNoteNo} onNo={(v) => onChange({ creditNoteNo: v })}
            date={docs.creditNoteDate} onDate={(v) => onChange({ creditNoteDate: v })}
            noPlaceholder="e.g. CN-2026-001"
            copy={docs.creditNoteCopy} onCopy={(f) => onChange({ creditNoteCopy: f })} uploading={isUploading}
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 items-start">
            {settlement.taxableUnknownRate > 0 ? (
              <div className="space-y-2">
                <Label className="min-h-5">GST % <span className="text-red-500">*</span></Label>
                <Input
                  type="number" min={0} max={100} step="0.01" placeholder="e.g. 5"
                  value={docs.creditNoteGstPercent} onChange={(e) => onChange({ creditNoteGstPercent: e.target.value })}
                />
                <p className="text-xs text-amber-700">GST rate is not set for this product in the SKU master. Enter the % used on the invoice.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="min-h-5">GST rate</Label>
                <div className="flex h-9 items-center rounded-md border bg-slate-50 px-3 text-sm font-medium text-slate-900">
                  {settlement.rates.map(r => `${r}%`).join(" / ") || "0%"}
                </div>
                <p className="text-xs text-slate-500">Taken from the product's SKU master, same as the invoice.</p>
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3 rounded-md border bg-slate-50 px-4 py-2 text-sm">
            <div><p className="text-xs text-slate-500">Taxable (₹)</p><p className="font-mono tabular-nums font-medium text-slate-900">{inr(settlement.creditNoteTaxable)}</p></div>
            <div><p className="text-xs text-slate-500">GST (₹)</p><p className="font-mono tabular-nums font-medium text-slate-900">{inr(gstAmount)}</p></div>
            <div><p className="text-xs text-slate-500">Credit Note Total (₹)</p><p className="font-mono tabular-nums font-semibold text-slate-900">{inr(round2(settlement.creditNoteTaxable + gstAmount))}</p></div>
          </div>
        </Section>
      )}

      {settlement.reverseQty > 0 && (
        <Section icon={Undo2} accent="violet" title="Reverse Stock Transfer" summary={<>Qty (units) <span className="font-mono tabular-nums">{fmtNum(settlement.reverseQty, 4)}</span></>}>
          <p className="text-xs text-slate-500">
            A stock transfer has no customer invoice, so no credit note. Reverse the lost quantity out of the destination depot.
            Stock-in is already reduced by the approved loss.
          </p>
          <DocRow
            noLabel="Reverse Transfer No" no={docs.reverseTransferNo} onNo={(v) => onChange({ reverseTransferNo: v })}
            date={docs.reverseTransferDate} onDate={(v) => onChange({ reverseTransferDate: v })}
            noPlaceholder="e.g. RST-2026-001"
            copy={docs.reverseTransferCopy} onCopy={(f) => onChange({ reverseTransferCopy: f })} uploading={isUploading}
          />
        </Section>
      )}

      {settlement.debitNote > 0 && (
        <Section icon={Truck} accent="amber" title="Debit Note to Transporter" summary={<>Amount (₹) <span className="font-mono tabular-nums">{inr(settlement.debitNote)}</span></>}>
          <p className="text-xs text-slate-500">
            Claim for the Transporter's share of the loss (compensation for goods lost or damaged, so no GST){transporterName && transporterName !== "—" ? <> from <b>{transporterName}</b></> : null}.
          </p>
          <DocRow
            noLabel="Debit Note No" no={docs.debitNoteNo} onNo={(v) => onChange({ debitNoteNo: v })}
            date={docs.debitNoteDate} onDate={(v) => onChange({ debitNoteDate: v })}
            noPlaceholder="e.g. DN-2026-001"
            copy={docs.debitNoteCopy} onCopy={(f) => onChange({ debitNoteCopy: f })} uploading={isUploading}
          />
          <div className="grid grid-cols-3 gap-3 rounded-md border bg-slate-50 px-4 py-2 text-sm">
            <div><p className="text-xs text-slate-500">Goods value (claim) (₹)</p><p className="font-mono tabular-nums font-medium text-slate-900">{inr(settlement.debitNote)}</p></div>
            <div><p className="text-xs text-slate-500">GST</p><p className="font-medium text-slate-500">Not applicable</p></div>
            <div><p className="text-xs text-slate-500">Debit Note Total (₹)</p><p className="font-mono tabular-nums font-semibold text-slate-900">{inr(settlement.debitNote)}</p></div>
          </div>
        </Section>
      )}

      {settlement.companyLoss > 0 && (
        <Section icon={Landmark} accent="slate" title="Company Loss (P&L)" summary={<>Amount (₹) <span className="font-mono tabular-nums">{inr(settlement.companyLoss)}</span></>}>
          <p className="text-sm text-slate-600">
            Booked automatically on completion under <b>{COMPANY_LOSS_HEAD}</b>, separate from other expenses.
            {isStockTransfer && settlement.customerShare === 0 ? " Includes the depot's share, as the depot belongs to the company." : null}
          </p>
        </Section>
      )}

      {!isStockTransfer && settlement.customerShare > 0 && (
        <div className="rounded-lg border bg-slate-50 p-3 text-sm text-slate-700">
          Customer bears (₹) <b className="font-mono tabular-nums">{inr(settlement.customerShare)}</b> (loss caused by the customer). No document is raised for it.
        </div>
      )}

      <div className="space-y-2">
        <Label className="min-h-5">Remarks <span className="text-xs font-normal text-slate-500">(optional)</span></Label>
        <Textarea
          rows={2} placeholder="Any note for this settlement..."
          value={docs.settlementRemarks} onChange={(e) => onChange({ settlementRemarks: e.target.value })}
        />
      </div>
    </div>
  )
}
