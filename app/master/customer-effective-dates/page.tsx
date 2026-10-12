"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Loader2,
  FileText,
  Mail,
  ShieldAlert,
  Award,
  Plus,
  Save,
  X,
  CheckCircle2,
  Building2,
  RefreshCw,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/page-header"
import { customerApi, stateApi } from "@/lib/api-service"
import { useToast } from "@/hooks/use-toast"

type SectionType = "mailing" | "gst" | "msme" | "fssai"

function CustomerEffectiveDatesContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const rawCustomerId = searchParams.get("customerId") || searchParams.get("id") || ""
  const customerId = rawCustomerId ? Number(rawCustomerId) : null
  const customerName = searchParams.get("customerName") || searchParams.get("name") || ""
  const initialSection = (searchParams.get("section") as SectionType) || "mailing"

  const [activeSection, setActiveSection] = useState<SectionType>(initialSection)
  const [isAdding, setIsAdding] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [newVersionForm, setNewVersionForm] = useState<Record<string, any>>({
    wefDate: new Date().toISOString().split("T")[0],
  })

  // Fetch active states for state names if needed
  const { data: statesRes } = useQuery({
    queryKey: ["states"],
    queryFn: () => stateApi.getAll(),
    staleTime: 5 * 60 * 1000,
  })
  const activeStates = (statesRes as any)?.data || []

  // Fetch history data for active section
  const { data: historyData, isLoading, refetch } = useQuery({
    queryKey: ["customer-sectional-history", activeSection, customerId],
    queryFn: async () => {
      if (!customerId) return []
      let res
      if (activeSection === "mailing") res = await customerApi.getMailingHistory(customerId)
      else if (activeSection === "gst") res = await customerApi.getStructuredGstHistory(customerId)
      else if (activeSection === "msme") res = await customerApi.getMsmeHistory(customerId)
      else if (activeSection === "fssai") res = await customerApi.getFssaiHistory(customerId)

      return res?.success ? res.data || [] : []
    },
    enabled: !!customerId,
    staleTime: 0,
    refetchOnMount: "always",
  })

  const items = historyData || []

  const handleToggleAdd = () => {
    if (!isAdding) {
      const latest = items.length > 0 ? items[0] : {}
      if (activeSection === "mailing") {
        setNewVersionForm({
          wefDate: new Date().toISOString().split("T")[0],
          customer_name: latest.customer_name || customerName || "",
          address_line_1: latest.address_line_1 || "",
          address_line_2: latest.address_line_2 || "",
          pincode: latest.pincode || "",
          state: latest.state || "",
          country: latest.country || "India",
        })
      } else if (activeSection === "gst") {
        setNewVersionForm({
          wefDate: new Date().toISOString().split("T")[0],
          gstin: latest.gstin || "",
          gst_registration_type: latest.gstRegistrationType || latest.gst_registration_type || "Regular",
          is_gst_registered: latest.isGstRegistered || latest.is_gst_registered || "Registered",
          place_of_supply: latest.placeOfSupply || latest.place_of_supply || "",
        })
      } else if (activeSection === "msme") {
        setNewVersionForm({
          wefDate: new Date().toISOString().split("T")[0],
          msme_registration_no: latest.msme_registration_no || "",
          msme_registration_type: latest.msme_registration_type || "",
        })
      } else if (activeSection === "fssai") {
        setNewVersionForm({
          wefDate: new Date().toISOString().split("T")[0],
          fssai_no: latest.fssai_no || "",
          fssai_valid_upto: latest.fssai_valid_upto || "",
        })
      }
    }
    setIsAdding(!isAdding)
  }

  const handleSaveNewVersion = async () => {
    if (!customerId) {
      toast({ title: "Error", description: "Invalid Customer ID", variant: "destructive" })
      return
    }
    if (!newVersionForm.wefDate) {
      toast({ title: "Validation Error", description: "Applicable From Date (W.E.F.) is required", variant: "destructive" })
      return
    }

    try {
      setIsSaving(true)
      await customerApi.addSectionHistory(customerId, {
        section: activeSection,
        ...newVersionForm,
      })
      toast({
        title: "Version Added Successfully",
        description: `New ${activeSection.toUpperCase()} version logged with W.E.F. date ${newVersionForm.wefDate}`,
      })
      setIsAdding(false)
      setNewVersionForm({ wefDate: new Date().toISOString().split("T")[0] })
      await queryClient.invalidateQueries({ queryKey: ["customer-sectional-history", activeSection, customerId] })
      await queryClient.invalidateQueries({ queryKey: ["master-edit-history"] })
      await queryClient.invalidateQueries({ queryKey: ["master-customers"] })
      refetch()
    } catch (err: any) {
      toast({
        title: "Failed to Save Version",
        description: err.message || "Something went wrong",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (!customerId) {
    return (
      <div className="container mx-auto p-6 max-w-5xl space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.push("/master")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Master
        </Button>
        <Card className="p-8 text-center border-dashed">
          <CardTitle className="text-red-600 font-bold mb-2">Customer Not Selected</CardTitle>
          <CardDescription>
            Please navigate from Customer Master by selecting a customer to view and add effective-date versions.
          </CardDescription>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-6xl space-y-6">
      {/* Top Header */}
      <div className="sticky top-0 z-40 bg-slate-50 -mx-4 md:-mx-6 px-4 md:px-6 pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 text-slate-600 hover:text-slate-900"
            onClick={() => router.push("/master")}
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Customer Master
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Clock className="h-6 w-6 text-blue-600" />
            Effective-Date Versions & History
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Applicable From (W.E.F.) version management
          </p>
        </div>

        {/* Customer Badge info */}
        <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-lg">
            {customerName ? customerName.charAt(0).toUpperCase() : "C"}
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Customer</p>
            <p className="text-sm font-bold text-slate-900">{customerName || `ID: #${customerId}`}</p>
          </div>
        </div>
      </div>

      {/* Section Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b pb-2">
        <button
          onClick={() => {
            setActiveSection("mailing")
            setIsAdding(false)
          }}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
            activeSection === "mailing"
              ? "bg-blue-600 text-white shadow-md"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Mail className="h-4 w-4" />
          Mailing Details
        </button>

        <button
          onClick={() => {
            setActiveSection("gst")
            setIsAdding(false)
          }}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
            activeSection === "gst"
              ? "bg-emerald-600 text-white shadow-md"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <FileText className="h-4 w-4" />
          GST Registration Details
        </button>

        <button
          onClick={() => {
            setActiveSection("msme")
            setIsAdding(false)
          }}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
            activeSection === "msme"
              ? "bg-amber-600 text-white shadow-md"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Award className="h-4 w-4" />
          MSME Details
        </button>

        <button
          onClick={() => {
            setActiveSection("fssai")
            setIsAdding(false)
          }}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
            activeSection === "fssai"
              ? "bg-purple-600 text-white shadow-md"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <ShieldAlert className="h-4 w-4" />
          FSSAI Details
        </button>
      </div>

      {/* Main Section Content Card */}
      <Card className="shadow-lg border-slate-200 rounded-2xl bg-white overflow-hidden">
        <CardHeader className="bg-slate-50 border-b p-5 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              {activeSection === "mailing" && <Mail className="h-5 w-5 text-blue-600" />}
              {activeSection === "gst" && <FileText className="h-5 w-5 text-emerald-600" />}
              {activeSection === "msme" && <Award className="h-5 w-5 text-amber-600" />}
              {activeSection === "fssai" && <ShieldAlert className="h-5 w-5 text-purple-600" />}
              {activeSection.toUpperCase()} Effective-Date History Table
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              List of all historical and active versions with W.E.F. dates
            </CardDescription>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-white text-slate-700 font-bold">
              {items.length} {items.length === 1 ? "Version" : "Versions"}
            </Badge>

            <Button
              type="button"
              size="sm"
              className={`h-9 px-4 text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 ${
                isAdding
                  ? "bg-slate-600 hover:bg-slate-700 text-white"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }`}
              onClick={handleToggleAdd}
            >
              {isAdding ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {isAdding ? "Cancel Form" : "Add Effective Date Version"}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Add New Version Form Panel */}
          {isAdding && (
            <div className="p-5 bg-emerald-50/60 rounded-xl border border-emerald-300 shadow-sm space-y-4 animate-in fade-in-50">
              <div className="flex items-center justify-between border-b border-emerald-200 pb-2.5">
                <span className="text-sm font-bold text-emerald-900 flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-emerald-600" />
                  Log New {String(activeSection).toUpperCase()} Version (Applicable From Date)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Applicable From (W.E.F Date) *</Label>
                  <Input
                    type="date"
                    className="h-9 text-xs font-semibold border-emerald-300 focus-visible:ring-emerald-500 bg-white"
                    value={newVersionForm.wefDate || ""}
                    onChange={(e) => setNewVersionForm({ ...newVersionForm, wefDate: e.target.value })}
                  />
                </div>

                {activeSection === "mailing" && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-700">Customer Name</Label>
                      <Input
                        className="h-9 text-xs bg-white"
                        placeholder="Effective Customer Name"
                        value={newVersionForm.customer_name || ""}
                        onChange={(e) => setNewVersionForm({ ...newVersionForm, customer_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-3">
                      <Label className="text-xs font-semibold text-slate-700">Address Line 1</Label>
                      <Input
                        className="h-9 text-xs bg-white"
                        placeholder="Street / Office Address"
                        value={newVersionForm.address_line_1 || ""}
                        onChange={(e) => setNewVersionForm({ ...newVersionForm, address_line_1: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-700">Pincode</Label>
                      <Input
                        className="h-9 text-xs font-mono bg-white"
                        placeholder="6-digit PIN"
                        maxLength={6}
                        value={newVersionForm.pincode || ""}
                        onChange={(e) => setNewVersionForm({ ...newVersionForm, pincode: e.target.value })}
                      />
                    </div>
                  </>
                )}

                {activeSection === "gst" && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-700">GSTIN / UIN *</Label>
                      <Input
                        className="h-9 text-xs font-mono uppercase bg-white"
                        placeholder="22ABCDE1234F1Z5"
                        value={newVersionForm.gstin || ""}
                        onChange={(e) => setNewVersionForm({ ...newVersionForm, gstin: e.target.value.toUpperCase() })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-700">GST Registration Status</Label>
                      <Input
                        className="h-9 text-xs bg-white"
                        placeholder="Registered / Unregistered"
                        value={newVersionForm.is_gst_registered || "Registered"}
                        onChange={(e) => setNewVersionForm({ ...newVersionForm, is_gst_registered: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-700">Registration Type</Label>
                      <Input
                        className="h-9 text-xs bg-white"
                        placeholder="Regular / Composition"
                        value={newVersionForm.gst_registration_type || ""}
                        onChange={(e) => setNewVersionForm({ ...newVersionForm, gst_registration_type: e.target.value })}
                      />
                    </div>
                  </>
                )}

                {activeSection === "msme" && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-700">MSME Registration No</Label>
                      <Input
                        className="h-9 text-xs font-mono bg-white"
                        placeholder="UDYAM-XX-00-0000000"
                        value={newVersionForm.msme_registration_no || ""}
                        onChange={(e) => setNewVersionForm({ ...newVersionForm, msme_registration_no: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-700">MSME Registration Type</Label>
                      <Input
                        className="h-9 text-xs bg-white"
                        placeholder="Micro / Small / Medium"
                        value={newVersionForm.msme_registration_type || ""}
                        onChange={(e) => setNewVersionForm({ ...newVersionForm, msme_registration_type: e.target.value })}
                      />
                    </div>
                  </>
                )}

                {activeSection === "fssai" && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-700">FSSAI Licence No</Label>
                      <Input
                        className="h-9 text-xs font-mono bg-white"
                        placeholder="14-digit FSSAI No"
                        value={newVersionForm.fssai_no || ""}
                        onChange={(e) => setNewVersionForm({ ...newVersionForm, fssai_no: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-700">Valid Upto Date</Label>
                      <Input
                        type="date"
                        className="h-9 text-xs bg-white"
                        value={newVersionForm.fssai_valid_upto || ""}
                        onChange={(e) => setNewVersionForm({ ...newVersionForm, fssai_valid_upto: e.target.value })}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-emerald-200">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs bg-white"
                  onClick={() => setIsAdding(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
                  disabled={isSaving}
                  onClick={handleSaveNewVersion}
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Version
                </Button>
              </div>
            </div>
          )}

          {/* History Table */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <span className="text-xs">Loading {activeSection.toUpperCase()} versions...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 bg-slate-50">
              No effective-dated {activeSection.toUpperCase()} versions recorded yet. Click{" "}
              <strong className="text-emerald-700 font-bold">Add Effective Date Version</strong> above to create one.
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 text-xs text-center">
                    <th className="py-3 px-4 whitespace-nowrap bg-amber-100/80 text-amber-900 border-r border-slate-300 w-36 font-bold text-center">
                      Applicable From (W.E.F)
                    </th>

                    {activeSection === "mailing" && (
                      <>
                        <th className="py-3 px-4 border-r border-slate-300">Name</th>
                        <th className="py-3 px-4 border-r border-slate-300">Address Line 1</th>
                        <th className="py-3 px-4 border-r border-slate-300">State</th>
                        <th className="py-3 px-4 border-r border-slate-300">Country</th>
                        <th className="py-3 px-4 border-r border-slate-300">Pincode</th>
                      </>
                    )}

                    {activeSection === "gst" && (
                      <>
                        <th className="py-3 px-4 border-r border-slate-300">Registration Type</th>
                        <th className="py-3 px-4 border-r border-slate-300 font-mono">GSTIN / UIN</th>
                        <th className="py-3 px-4 border-r border-slate-300">GST Status</th>
                        <th className="py-3 px-4 border-r border-slate-300">Place of Supply</th>
                      </>
                    )}

                    {activeSection === "msme" && (
                      <>
                        <th className="py-3 px-4 border-r border-slate-300">MSME Reg No</th>
                        <th className="py-3 px-4 border-r border-slate-300">MSME Type</th>
                      </>
                    )}

                    {activeSection === "fssai" && (
                      <>
                        <th className="py-3 px-4 border-r border-slate-300">FSSAI Licence No</th>
                        <th className="py-3 px-4 border-r border-slate-300">Licence Type</th>
                        <th className="py-3 px-4 border-r border-slate-300">Valid Upto</th>
                      </>
                    )}

                    <th className="py-3 px-4 text-right whitespace-nowrap">Logged By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {items.map((row: any, idx: number) => {
                    const rowId = row.id || idx
                    const isLatest = idx === 0
                    const formattedWef = row.wefDate
                      ? new Date(row.wefDate)
                          .toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                          .replace(/ /g, "-")
                      : "—"

                    return (
                      <tr key={rowId} className="hover:bg-amber-50/40 transition-colors text-xs text-slate-800">
                        <td className="py-3 px-4 font-bold text-slate-900 bg-amber-50/60 border-r border-slate-300 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <span>{formattedWef}</span>
                            {isLatest && (
                              <Badge className="bg-emerald-600 text-white text-[9px] px-1 py-0 h-4">Active</Badge>
                            )}
                          </div>
                        </td>

                        {activeSection === "mailing" && (
                          <>
                            <td className="py-3 px-4 border-r border-slate-200 font-bold text-slate-900">
                              {row.customerName || customerName || "—"}
                            </td>
                            <td className="py-3 px-4 border-r border-slate-200 text-slate-700">
                              {row.addressLine1 || row.address_line_1 || "—"}
                            </td>
                            <td className="py-3 px-4 border-r border-slate-200">
                              {row.stateName || row.state || "Chhattisgarh"}
                            </td>
                            <td className="py-3 px-4 border-r border-slate-200 text-center">India</td>
                            <td className="py-3 px-4 border-r border-slate-200 font-mono text-center">
                              {row.pincode || "—"}
                            </td>
                          </>
                        )}

                        {activeSection === "gst" && (
                          <>
                            <td className="py-3 px-4 border-r border-slate-200 font-medium text-slate-900">
                              {row.gstRegistrationType || row.gst_registration_type || "Regular"}
                            </td>
                            <td className="py-3 px-4 border-r border-slate-200 font-mono font-bold text-slate-900">
                              {row.gstin || "—"}
                            </td>
                            <td className="py-3 px-4 border-r border-slate-200 text-center">
                              <Badge variant="outline" className="bg-slate-50 text-slate-700">
                                {row.isGstRegistered || row.is_gst_registered || "Registered"}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 border-r border-slate-200 text-center">
                              {row.stateName || row.placeOfSupply || "Chhattisgarh"}
                            </td>
                          </>
                        )}

                        {activeSection === "msme" && (
                          <>
                            <td className="py-3 px-4 border-r border-slate-200 font-mono font-bold text-slate-900">
                              {row.msmeRegistrationNo || row.msme_registration_no || "—"}
                            </td>
                            <td className="py-3 px-4 border-r border-slate-200 text-slate-700">
                              {row.msmeRegistrationType || row.msme_registration_type || "—"}
                            </td>
                          </>
                        )}

                        {activeSection === "fssai" && (
                          <>
                            <td className="py-3 px-4 border-r border-slate-200 font-mono font-bold text-slate-900">
                              {row.fssaiNo || row.fssai_no || "—"}
                            </td>
                            <td className="py-3 px-4 border-r border-slate-200 text-slate-700">
                              {row.fssaiLicenceType || row.fssai_licence_type || "—"}
                            </td>
                            <td className="py-3 px-4 border-r border-slate-200 text-slate-600 text-center font-medium">
                              {row.fssaiValidUpto
                                ? new Date(row.fssaiValidUpto).toLocaleDateString("en-IN", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  })
                                : "—"}
                            </td>
                          </>
                        )}

                        <td className="py-3 px-4 text-right text-slate-500 whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5 text-[11px]">
                            <User className="h-3.5 w-3.5 text-slate-400" />
                            <span className="font-medium text-slate-700">{row.changedByName || "Admin"}</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function CustomerEffectiveDatesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <CustomerEffectiveDatesContent />
    </Suspense>
  )
}
