"use client"

import React, { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  BookText, Check, Download, FileSpreadsheet, Loader2, Pencil, Plus, Search, SortAsc, SortDesc, Trash2, X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { ledgerApi, ledgerGroupApi } from "@/lib/api-service"
import { MasterCardWrapper } from "@/components/masters/MasterCardWrapper"
import { LedgerBulkImportModal } from "@/components/masters/modals/ledger-bulk-import-modal"
import { cn } from "@/lib/utils"

/**
 * Ledgers master: the accounting heads picked for order charges (Add Order / Approval of Order),
 * fuel-station ledgers, and the "Default Accounting Ledger" of raw materials / semi-finished goods.
 * Self-contained (own queries, dialogs and rules) so it does not touch the shared master form machinery.
 */
interface Props {
  isAdminOrSuper: boolean
  isReadOnly: boolean
  canEditExisting: boolean
}

type SortCol = "ledger_code" | "ledger_name" | "group" | "status"

const EMPTY_FORM = { ledger_name: "", ledger_group_id: "", status: "Active" }

// Everything else in the app that lists ledgers reads from one of these keys.
const LEDGER_QUERY_KEYS = [["ledgers-for-order-charges"], ["ledgers-for-approval-charges"], ["ledger-options"]]

export function LedgerMasterTab({ isAdminOrSuper, isReadOnly, canEditExisting }: Props) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [subTab, setSubTab] = useState<"active" | "pending">("active")
  const [search, setSearch] = useState("")
  const [groupFilter, setGroupFilter] = useState("ALL")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [sort, setSort] = useState<{ col: SortCol; dir: "asc" | "desc" }>({ col: "ledger_code", dir: "asc" })

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<any>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const [deleting, setDeleting] = useState<any>(null)
  const [deleteUsage, setDeleteUsage] = useState<{ label: string; n: number }[] | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [rejecting, setRejecting] = useState<any>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [reviewingId, setReviewingId] = useState<number | null>(null)

  const [importOpen, setImportOpen] = useState(false)

  const { data: ledgers = [], isLoading, refetch } = useQuery({
    queryKey: ["ledgers-master"],
    queryFn: async () => {
      const res = await ledgerApi.getAll({ all: "true" })
      return res.success ? ((res.data?.ledgers || []) as any[]) : []
    },
  })

  const { data: pending = [], refetch: refetchPending } = useQuery({
    queryKey: ["ledgers-master-pending"],
    enabled: isAdminOrSuper,
    queryFn: async () => {
      const res = await ledgerApi.getPending()
      return res.success ? ((Array.isArray(res.data) ? res.data : res.data?.ledgers || []) as any[]) : []
    },
  })

  const { data: groups = [] } = useQuery({
    queryKey: ["ledger-group-options-master"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const res = await ledgerGroupApi.getAll({ all: "true" })
      return res.success ? ((res.data?.ledger_groups || []) as any[]) : []
    },
  })
  const activeGroups = useMemo(() => groups.filter((g: any) => !g.status || g.status === "Active"), [groups])
  const groupName = (id: any) => groups.find((g: any) => String(g.id) === String(id))?.group_name || "—"

  const refreshAll = () => {
    refetch()
    refetchPending()
    LEDGER_QUERY_KEYS.forEach((k) => queryClient.invalidateQueries({ queryKey: k }))
  }

  // ---- list: search / group / status / sort ------------------------------------------------
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = ledgers.filter((l: any) => {
      if (groupFilter !== "ALL" && String(l.ledger_group_id) !== groupFilter) return false
      if (statusFilter !== "ALL" && (l.status || "Active") !== statusFilter) return false
      if (!q) return true
      return [l.ledger_code, l.ledger_name, groupName(l.ledger_group_id)].some((v) => String(v || "").toLowerCase().includes(q))
    })
    const val = (l: any) =>
      sort.col === "group" ? groupName(l.ledger_group_id) : sort.col === "status" ? l.status || "Active" : String(l[sort.col] || "")
    return [...list].sort((a, b) => {
      const c = val(a).localeCompare(val(b), undefined, { numeric: true, sensitivity: "base" })
      return sort.dir === "asc" ? c : -c
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ledgers, search, groupFilter, statusFilter, sort, groups])

  const toggleSort = (col: SortCol) => setSort((s) => (s.col === col ? { col, dir: s.dir === "asc" ? "desc" : "asc" } : { col, dir: "asc" }))
  const SortHead = ({ col, children, className }: { col: SortCol; children: React.ReactNode; className?: string }) => (
    <TableHead className={cn("cursor-pointer select-none hover:bg-slate-100 transition-colors", className)} onClick={() => toggleSort(col)}>
      {children}
      {sort.col === col && (sort.dir === "asc" ? <SortAsc className="ml-1 inline h-3.5 w-3.5 text-primary" /> : <SortDesc className="ml-1 inline h-3.5 w-3.5 text-primary" />)}
    </TableHead>
  )

  // ---- add / edit --------------------------------------------------------------------------
  const openAdd = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }
  const openEdit = (l: any) => {
    setEditing(l)
    setForm({ ledger_name: l.ledger_name || "", ledger_group_id: l.ledger_group_id != null ? String(l.ledger_group_id) : "", status: l.status || "Active" })
    setDialogOpen(true)
  }

  const nameTaken = (name: string) => {
    const n = name.trim().toLowerCase()
    return !!n && [...ledgers, ...pending].some((l: any) => String(l.ledger_name || "").trim().toLowerCase() === n && l.id !== editing?.id)
  }

  const save = async () => {
    const name = String(form.ledger_name || "").trim()
    if (!name) return toast({ title: "Ledger Name required", description: "Enter a name for the ledger.", variant: "destructive" })
    if (nameTaken(name)) return toast({ title: "Duplicate ledger", description: `A ledger named "${name}" already exists.`, variant: "destructive" })
    if (!form.ledger_group_id) return toast({ title: "Ledger Group required", description: "Pick the group this ledger belongs to.", variant: "destructive" })
    setSaving(true)
    try {
      const payload = { ledger_name: name, ledger_group_id: Number(form.ledger_group_id), status: form.status }
      const res = editing ? await ledgerApi.update(editing.id, payload) : await ledgerApi.create(payload)
      if (res?.success) {
        toast({ title: editing ? "Ledger updated" : "Ledger created", description: res.message || "Saved." })
        setDialogOpen(false)
        refreshAll()
      } else {
        toast({ title: "Not saved", description: res?.message || "Could not save the ledger.", variant: "destructive" })
      }
    } catch (e: any) {
      toast({ title: "Not saved", description: e?.message || "Could not save the ledger.", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  // ---- delete (blocked while the ledger is in use) ------------------------------------------
  const askDelete = async (l: any) => {
    setDeleting(l)
    setDeleteUsage(null)
    try {
      const res = await ledgerApi.getUsage(l.id)
      setDeleteUsage(res?.success ? (res.data as any[]) : [])
    } catch {
      setDeleteUsage([])
    }
  }
  const confirmDelete = async () => {
    if (!deleting) return
    setIsDeleting(true)
    try {
      const res = await ledgerApi.delete(deleting.id)
      if (res?.success) {
        toast({ title: "Ledger deleted", description: `${deleting.ledger_name} was removed.` })
        setDeleting(null)
        refreshAll()
      } else {
        toast({ title: "Cannot delete", description: res?.message || "This ledger could not be deleted.", variant: "destructive" })
      }
    } catch (e: any) {
      toast({ title: "Cannot delete", description: e?.message || "This ledger could not be deleted.", variant: "destructive" })
    } finally {
      setIsDeleting(false)
    }
  }

  // ---- approvals (admin) --------------------------------------------------------------------
  const review = async (l: any, action: "approve" | "reject", reason?: string) => {
    setReviewingId(l.id)
    try {
      const res = await ledgerApi.review(l.id, { action, reason })
      if (res?.success) {
        toast({ title: action === "approve" ? "Approved" : "Rejected", description: res.message || "Done." })
        setRejecting(null)
        setRejectReason("")
        refreshAll()
      } else {
        toast({ title: "Not done", description: res?.message || "Could not review this ledger.", variant: "destructive" })
      }
    } catch (e: any) {
      toast({ title: "Not done", description: e?.message || "Could not review this ledger.", variant: "destructive" })
    } finally {
      setReviewingId(null)
    }
  }

  // ---- export -------------------------------------------------------------------------------
  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`
    const header = ["Ledger Code", "Ledger Name", "Ledger Group", "Status"]
    const lines = rows.map((l: any) => [l.ledger_code, l.ledger_name, groupName(l.ledger_group_id), l.status || "Active"].map(esc).join(","))
    const csv = "data:text/csv;charset=utf-8," + encodeURIComponent(`${header.map(esc).join(",")}\n${lines.join("\n")}\n`)
    const a = document.createElement("a")
    a.href = csv
    a.download = `ledgers_export_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    toast({ title: "Exported", description: `${rows.length} ledger${rows.length === 1 ? "" : "s"} exported.` })
  }

  const statusBadge = (s: string) => (
    <Badge variant="outline" className={cn("font-medium", (s || "Active") === "Active" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-600")}>
      {s || "Active"}
    </Badge>
  )

  const canDelete = canEditExisting && !isReadOnly

  return (
    <>
      <MasterCardWrapper
        icon={BookText}
        title="Ledgers"
        description="Accounting heads for order charges, fuel stations and default accounting ledgers"
        isAdminOrSuper={isAdminOrSuper}
        subTab={subTab}
        setSubTab={setSubTab}
        pendingCount={pending.length}
        headerActions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-xl border-emerald-200 bg-emerald-50/60 px-3 font-bold text-emerald-800 hover:bg-emerald-100/80 md:h-9"
              disabled={isReadOnly}
              onClick={() => setImportOpen(true)}
              title={isReadOnly ? "View Only Access" : "Import ledgers from CSV / Excel"}
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              Import CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-xl border-blue-200 bg-blue-50/60 px-3 font-bold text-blue-800 hover:bg-blue-100/80 md:h-9"
              onClick={exportCsv}
              title="Export the ledgers shown to CSV"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
            <Button size="sm" className="h-8 gap-1.5 rounded-xl px-3 md:h-9" disabled={isReadOnly} onClick={openAdd} title={isReadOnly ? "View Only Access" : "Add a new ledger"}>
              <Plus className="h-4 w-4" />
              Add Ledger
            </Button>
          </div>
        }
      >
        {subTab === "active" || !isAdminOrSuper ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <Input className="h-9 pl-8 text-sm" placeholder="Search code, name or group..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={groupFilter} onValueChange={setGroupFilter}>
                <SelectTrigger className="!h-9 w-52 text-sm">
                  <SelectValue placeholder="All Groups" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Groups</SelectItem>
                  {groups.map((g: any) => (
                    <SelectItem key={g.id} value={String(g.id)}>
                      {g.group_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="!h-9 w-36 text-sm">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Status</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <span className="ml-auto text-xs text-slate-500">
                Showing <strong className="text-slate-800">{rows.length}</strong> of {ledgers.length}
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <SortHead col="ledger_code" className="w-32">Code</SortHead>
                    <SortHead col="ledger_name">Ledger Name</SortHead>
                    <SortHead col="group">Ledger Group</SortHead>
                    <SortHead col="status" className="w-28">Status</SortHead>
                    <TableHead className="w-28 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-slate-500">
                        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                        Loading…
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-slate-500">
                        {ledgers.length === 0 ? "No ledgers yet. Add the first one." : "No ledgers match the filters."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((l: any) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-mono text-xs text-slate-600">{l.ledger_code}</TableCell>
                        <TableCell className="font-medium text-slate-900">{l.ledger_name}</TableCell>
                        <TableCell className="text-slate-600">{groupName(l.ledger_group_id)}</TableCell>
                        <TableCell>{statusBadge(l.status)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-500 hover:text-blue-600"
                            title={isReadOnly ? "View Only Access" : isAdminOrSuper ? "Edit" : "Edit (needs admin approval)"}
                            disabled={isReadOnly}
                            onClick={() => openEdit(l)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {canDelete && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Delete" onClick={() => askDelete(l)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Ledger Name</TableHead>
                  <TableHead>Ledger Group</TableHead>
                  <TableHead>Request</TableHead>
                  <TableHead className="w-48 text-right">Review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-slate-500">
                      Nothing is waiting for approval.
                    </TableCell>
                  </TableRow>
                ) : (
                  pending.map((l: any) => {
                    const changes = l.pending_changes || null
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium text-slate-900">
                          {changes?.ledger_name ?? l.ledger_name}
                          {changes?.ledger_name && changes.ledger_name !== l.ledger_name && <span className="ml-2 text-xs text-slate-400 line-through">{l.ledger_name}</span>}
                        </TableCell>
                        <TableCell className="text-slate-600">{groupName(changes?.ledger_group_id ?? l.ledger_group_id)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                            {changes ? "Edit" : "New ledger"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" className="mr-2 h-8 gap-1 bg-emerald-600 hover:bg-emerald-700" disabled={reviewingId === l.id} onClick={() => review(l, "approve")}>
                            {reviewingId === l.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 gap-1 border-red-200 text-red-600 hover:bg-red-50" disabled={reviewingId === l.id} onClick={() => setRejecting(l)}>
                            <X className="h-3.5 w-3.5" />
                            Reject
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </MasterCardWrapper>

      {/* Add / Edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Ledger" : "Add Ledger"}</DialogTitle>
            <DialogDescription>
              {editing ? "Change the name, group or status." : "The ledger code is generated automatically."}
              {!isAdminOrSuper && " Your change goes to an admin for approval."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            {editing && (
              <div className="space-y-1.5">
                <Label>Ledger Code</Label>
                <Input value={editing.ledger_code || ""} readOnly className="bg-muted font-mono" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="ledger_name">
                Ledger Name <span className="text-red-500">*</span>
              </Label>
              <Input id="ledger_name" autoFocus placeholder="e.g. Transporting Expenses" value={form.ledger_name} onChange={(e) => setForm({ ...form, ledger_name: e.target.value })} />
              {nameTaken(form.ledger_name) && <p className="text-xs font-medium text-red-600">A ledger with this name already exists.</p>}
            </div>
            <div className="space-y-1.5">
              <Label>
                Ledger Group <span className="text-red-500">*</span>
              </Label>
              <Select value={form.ledger_group_id} onValueChange={(v) => setForm({ ...form, ledger_group_id: v })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select group" />
                </SelectTrigger>
                <SelectContent>
                  {activeGroups.map((g: any) => (
                    <SelectItem key={g.id} value={String(g.id)}>
                      {g.group_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-slate-500">Groups are managed in the Ledger Groups tab.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive (hidden from pickers)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Save Changes" : "Create Ledger"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete ledger</DialogTitle>
            <DialogDescription>
              {deleting?.ledger_name} ({deleting?.ledger_code})
            </DialogDescription>
          </DialogHeader>
          {deleteUsage === null ? (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking where this ledger is used…
            </p>
          ) : deleteUsage.length > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              This ledger is in use and cannot be deleted:
              <ul className="mt-1 list-disc pl-5">
                {deleteUsage.map((u) => (
                  <li key={u.label}>
                    {u.n} {u.label}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs">Edit it and set the status to <b>Inactive</b> instead, so it disappears from the pickers.</p>
            </div>
          ) : (
            <p className="text-sm text-slate-600">This ledger is not used anywhere. Deleting it cannot be undone.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={isDeleting || deleteUsage === null || deleteUsage.length > 0} onClick={confirmDelete}>
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject reason */}
      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject request</DialogTitle>
            <DialogDescription>{rejecting?.ledger_name}</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Reason (optional)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={reviewingId === rejecting?.id} onClick={() => rejecting && review(rejecting, "reject", rejectReason)}>
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LedgerBulkImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        existingNames={[...ledgers, ...pending].map((l: any) => String(l.ledger_name || "").trim().toLowerCase())}
        groupNames={groups.map((g: any) => ({ name: String(g.group_name || ""), active: !g.status || g.status === "Active" }))}
        onSuccess={refreshAll}
      />
    </>
  )
}
