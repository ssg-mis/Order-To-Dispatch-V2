"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
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
import { Check, Clock, Loader2 } from "lucide-react"
import { TAB_META } from "../types"
import { MasterEditHistoryTable } from "../tables/MasterHistoryTables"

export interface MasterApprovalReviewModalProps {
  approvalReviewModal: { tab: string; item: any } | null
  onClose: () => void
  onApprove: () => void
  isReviewing: boolean
  renderProposedChanges: () => React.ReactNode
  renderFormForTab: (tab: string) => React.ReactNode
}

export function MasterApprovalReviewModal({
  approvalReviewModal,
  onClose,
  onApprove,
  isReviewing,
  renderProposedChanges,
  renderFormForTab,
}: MasterApprovalReviewModalProps) {
  return (
    <Dialog open={!!approvalReviewModal} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto" style={{ maxWidth: '750px' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Check className="h-5 w-5 text-emerald-600" />
            Review & Approve
          </DialogTitle>
          <DialogDescription>
            Review the submitted values below. You can edit any field before approving. The final approved record will use these values.
          </DialogDescription>
        </DialogHeader>

        {approvalReviewModal && (
          <div className="grid gap-3 py-2">
            {renderProposedChanges()}
            {renderFormForTab(approvalReviewModal.tab)}
            {approvalReviewModal.item?.id && approvalReviewModal.tab !== "customers" && (
              <div className="space-y-2 border-t pt-4 mt-2">
                <Label className="text-slate-600 font-semibold flex items-center gap-1.5 text-xs">
                  <Clock className="h-3.5 w-3.5 text-slate-500" />
                  {(TAB_META[approvalReviewModal.tab]?.label || approvalReviewModal.tab.replace('_', ' '))} History Table
                </Label>
                <MasterEditHistoryTable masterType={approvalReviewModal.tab} recordId={approvalReviewModal.item.id} />
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={onApprove}
            disabled={isReviewing}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isReviewing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function MasterRejectModal({
  rejectDialogContext,
  onClose,
  rejectionReason,
  setRejectionReason,
  onReject,
  isReviewing,
}: {
  rejectDialogContext: { tab: string; id: number } | null
  onClose: () => void
  rejectionReason: string
  setRejectionReason: (val: string) => void
  onReject: () => void
  isReviewing: boolean
}) {
  return (
    <AlertDialog open={!!rejectDialogContext} onOpenChange={(open) => { if (!open) onClose() }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reject Record</AlertDialogTitle>
          <AlertDialogDescription>
            Optionally provide a reason. The record will not be used anywhere once rejected.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="px-1 pb-2">
          <Input placeholder="Rejection reason (optional)" value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onReject}
            className="bg-destructive text-white hover:bg-destructive/90 transition-all shadow-md"
            disabled={isReviewing}
          >
            {isReviewing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reject
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
