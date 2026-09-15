"use client"

import React from "react"
import { AlertCircle } from "lucide-react"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog"

export interface MasterFieldChangeConfirmModalProps {
  pendingFieldChangeConfirm: { fieldName: string; section: string; applyChange: () => void } | null
  setPendingFieldChangeConfirm: (val: any) => void
  onConfirmEffectiveDates: (section: string, fieldName: string) => void
  entityName?: string
}

export function MasterFieldChangeConfirmModal({
  pendingFieldChangeConfirm,
  setPendingFieldChangeConfirm,
  onConfirmEffectiveDates,
  entityName = "customer",
}: MasterFieldChangeConfirmModalProps) {
  return (
    <AlertDialog
      open={!!pendingFieldChangeConfirm}
      onOpenChange={(open) => {
        if (!open) setPendingFieldChangeConfirm(null)
      }}
    >
      <AlertDialogContent className="max-w-md bg-white p-6 rounded-xl shadow-2xl border border-slate-200">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            <span>Confirm Field Change</span>
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-xs text-slate-600 mt-2 space-y-2">
              <div>
                Are you sure you want to change <strong className="text-slate-900 font-semibold">{pendingFieldChangeConfirm?.fieldName}</strong>?
              </div>
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-2.5 rounded-lg text-[11px] leading-relaxed">
                Changing {entityName} details requires logging an effective-dated version. You will be redirected to set the W.E.F. date.
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-4 flex items-center justify-end gap-2">
          <AlertDialogCancel
            className="h-8 text-xs px-3 font-semibold"
            onClick={() => setPendingFieldChangeConfirm(null)}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="h-8 text-xs px-3 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => {
              if (pendingFieldChangeConfirm) {
                onConfirmEffectiveDates(pendingFieldChangeConfirm.section, pendingFieldChangeConfirm.fieldName)
                setPendingFieldChangeConfirm(null)
              }
            }}
          >
            Yes, Proceed to Effective Dates
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function SkuFieldChangeConfirmModal({
  pendingSkuFieldChangeConfirm,
  setPendingSkuFieldChangeConfirm,
  onConfirmEffectiveDates,
}: {
  pendingSkuFieldChangeConfirm: { fieldName: string; section: string; applyChange: () => void } | null
  setPendingSkuFieldChangeConfirm: (val: any) => void
  onConfirmEffectiveDates: (section: string, fieldName: string) => void
}) {
  return (
    <AlertDialog
      open={!!pendingSkuFieldChangeConfirm}
      onOpenChange={(open) => {
        if (!open) setPendingSkuFieldChangeConfirm(null)
      }}
    >
      <AlertDialogContent className="max-w-md bg-white p-6 rounded-xl shadow-2xl border border-slate-200">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            <span>Confirm Field Change</span>
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-xs text-slate-600 mt-2 space-y-2">
              <div>
                Are you sure you want to change <strong className="text-slate-900 font-semibold">{pendingSkuFieldChangeConfirm?.fieldName}</strong>?
              </div>
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-2.5 rounded-lg text-[11px] leading-relaxed">
                Changing SKU details requires logging an effective-dated version. You will be redirected to the Effective Dates manager to set the W.E.F. date.
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-4 flex items-center justify-end gap-2">
          <AlertDialogCancel className="h-8 text-xs px-3 font-semibold" onClick={() => setPendingSkuFieldChangeConfirm(null)}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="h-8 text-xs px-3 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => {
              if (pendingSkuFieldChangeConfirm) {
                onConfirmEffectiveDates(pendingSkuFieldChangeConfirm.section, pendingSkuFieldChangeConfirm.fieldName)
                setPendingSkuFieldChangeConfirm(null)
              }
            }}
          >
            Yes, Proceed to Effective Dates
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
