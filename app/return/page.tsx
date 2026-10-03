"use client"

import { useRouter } from "next/navigation"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { returnApi } from "@/lib/api-service"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeftRight, Loader2, Printer, Undo2 } from "lucide-react"
import { cn } from "@/lib/utils"

const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString("en-IN") : "—")

const statusClass = (s: string) =>
  cn(
    s === "Received" || s === "Documents Issued" ? "bg-emerald-100 text-emerald-700" : "",
    s === "In Transit" ? "bg-blue-100 text-blue-700" : "",
    s === "Dispatched" ? "bg-sky-100 text-sky-700" : "",
    s === "Planned" ? "bg-amber-100 text-amber-700" : "",
    s?.startsWith("Awaiting Unloading") || s?.startsWith("Awaiting Documents") ? "bg-violet-100 text-violet-700" : "",
    s === "Awaiting Approval" ? "bg-slate-100 text-slate-700" : "",
  )

// Stage 17 - Return: where a return is raised. The pipeline steps that follow live on their own pages
// (Stage 18 Unload Returned Stock, Stage 19 Issue Documents Against Returned Stock).
export default function ReturnPage() {
  const router = useRouter()

  const { data: salesReturns = [], isLoading: loadingSales } = useQuery({
    queryKey: ["sales-returns"],
    queryFn: async () => {
      const res = await returnApi.getSalesReturns()
      return res.success ? (res.data?.sales_returns || []) : []
    },
  })
  const { data: stockReturns = [], isLoading: loadingStock } = useQuery({
    queryKey: ["stock-returns"],
    queryFn: async () => {
      const res = await returnApi.getStockReturns()
      return res.success ? (res.data?.stock_returns || []) : []
    },
  })

  return (
    <div className="max-w-full space-y-6 p-6" suppressHydrationWarning>
      <div className="flex items-center gap-3">
        <SidebarTrigger className="-ml-1" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Stage 17: Return</h1>
          <p className="text-muted-foreground">Raise a return. The goods are then received at Stage 18 and Billing issues the documents at Stage 19.</p>
        </div>
      </div>

      {/* The three return cases */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card className="gap-1 p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Case I &amp; II · Stock transfer</p>
          <p className="text-sm text-slate-700">Depot → Banari, or depot → depot. Raised as a Stock Transfer order against the original transfer; stock-out and stock-in follow automatically.</p>
          <Button variant="outline" size="sm" className="mt-2 w-fit" onClick={() => router.push("/order-punch/create?category=Stock%20Transfer&stockReturn=1")}>
            <ArrowLeftRight className="mr-2 h-4 w-4" />
            New Stock Return
          </Button>
        </Card>
        <Card className="gap-1 p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Case III · Customer return</p>
          <p className="text-sm text-slate-700">Punch an order in the <b>Sales Return</b> category against the original invoice. After the pickup is dispatched, the goods are unloaded and weighed (Stage 18) and Billing issues the credit note (Stage 19).</p>
          <Button variant="outline" size="sm" className="mt-2 w-fit" onClick={() => router.push("/order-punch/create?category=Sales%20Return")}>
            <Undo2 className="mr-2 h-4 w-4" />
            New Sales Return
          </Button>
        </Card>
        <Card className="gap-1 p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Main Gate · Stock Return gate pass</p>
          <p className="text-sm text-slate-700">A vehicle brings returned stock to the gate: issue a fill-in-the-blank pass for the handwritten entries.</p>
          <Button variant="outline" size="sm" className="mt-2 w-fit" onClick={() => router.push("/return-gate-pass")}>
            <Printer className="mr-2 h-4 w-4" />
            Stock Return Gate Pass
          </Button>
        </Card>
      </div>

      <div className="rounded-lg border bg-white p-4 text-sm text-slate-600 shadow-sm">
        <span className="font-semibold text-slate-800">Sales Return flow: </span>
        Order Punch → Approval → Dispatch Planning → Plan Vehicle → Gate In → Actual Dispatch →{" "}
        <b>Stage 18 Unload Returned Stock</b> (weighment, RST, check, restock) → <b>Stage 19 Issue Documents Against Returned Stock</b> (credit note).
      </div>

      {/* Sales returns */}
      <div className="space-y-2">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Sales Returns</h2>
          <p className="text-xs text-slate-500">Customer returns and where each one is in the pipeline.</p>
        </div>
        <Card className="gap-0 overflow-hidden border-none py-0 shadow-sm">
          <div className="max-h-[360px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                <TableRow className="bg-slate-50">
                  {["DO Date", "Return DO", "Customer", "Original Invoice", "Products", "Qty", "Reason", "Status"].map((h) => (
                    <TableHead key={h} className="whitespace-nowrap text-center">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingSales ? (
                  <TableRow><TableCell colSpan={8} className="py-8 text-center text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading…</TableCell></TableRow>
                ) : salesReturns.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="py-8 text-center text-slate-500">No sales returns yet.</TableCell></TableRow>
                ) : (
                  salesReturns.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-center text-xs">{fmtDate(s.party_so_date || s.created_at)}</TableCell>
                      <TableCell className="text-center text-xs font-bold text-slate-700">{s.order_no}</TableCell>
                      <TableCell className="text-center text-xs font-medium">{s.customer_name || "—"}</TableCell>
                      <TableCell className="text-center text-xs">{s.invoice_no || "—"}</TableCell>
                      <TableCell className="max-w-[220px] truncate text-center text-xs" title={s.products || ""}>{s.products || "—"}</TableCell>
                      <TableCell className="text-center text-xs font-semibold tabular-nums">{Number(s.qty) || 0}</TableCell>
                      <TableCell className="text-center text-xs">{s.return_reason || "—"}</TableCell>
                      <TableCell className="text-center"><Badge className={statusClass(s.status)}>{s.status}</Badge></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* Stock returns */}
      <div className="space-y-2">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Stock Returns</h2>
          <p className="text-xs text-slate-500">Depot-to-Banari / depot-to-depot returns, raised as a Stock Transfer against the original transfer.</p>
        </div>
        <Card className="gap-0 overflow-hidden border-none py-0 shadow-sm">
          <div className="max-h-[360px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                <TableRow className="bg-slate-50">
                  {["DO Date", "Return DO", "Original Transfer", "From Depot", "Returned To", "Products", "Qty", "Reason", "Status"].map((h) => (
                    <TableHead key={h} className="whitespace-nowrap text-center">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingStock ? (
                  <TableRow><TableCell colSpan={9} className="py-8 text-center text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading…</TableCell></TableRow>
                ) : stockReturns.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="py-8 text-center text-slate-500">No stock returns yet.</TableCell></TableRow>
                ) : (
                  stockReturns.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-center text-xs">{fmtDate(s.party_so_date || s.created_at)}</TableCell>
                      <TableCell className="text-center text-xs font-bold text-slate-700">{s.order_no}</TableCell>
                      <TableCell className="text-center text-xs">{s.original_order_no}</TableCell>
                      <TableCell className="text-center text-xs">{s.from_depot || "—"}</TableCell>
                      <TableCell className="text-center text-xs">{s.to_depot || s.to_customer || "—"}</TableCell>
                      <TableCell className="max-w-[220px] truncate text-center text-xs" title={s.products || ""}>{s.products || "—"}</TableCell>
                      <TableCell className="text-center text-xs font-semibold tabular-nums">{Number(s.qty) || 0}</TableCell>
                      <TableCell className="text-center text-xs">{s.return_reason || "—"}</TableCell>
                      <TableCell className="text-center"><Badge className={statusClass(s.status)}>{s.status}</Badge></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  )
}
