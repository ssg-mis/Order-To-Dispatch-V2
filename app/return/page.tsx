"use client"

import { useRouter } from "next/navigation"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StageDataCard, type StageDataCol } from "@/components/stage-list-extra/stage-data-card"
import { returnApi } from "@/lib/api-service"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeftRight, Printer, Undo2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { fmtDate, fmtNum } from "@/lib/table-format"

const statusClass = (s: string) =>
  cn(
    s === "Received" || s === "Documents Issued" ? "bg-emerald-100 text-emerald-700" : "",
    s === "In Transit" ? "bg-blue-100 text-blue-700" : "",
    s === "Dispatched" ? "bg-sky-100 text-sky-700" : "",
    s === "Planned" ? "bg-amber-100 text-amber-700" : "",
    s?.startsWith("Awaiting Unloading") || s?.startsWith("Awaiting Documents") ? "bg-violet-100 text-violet-700" : "",
    s === "Awaiting Approval" ? "bg-slate-100 text-slate-700" : "",
  )


const txt = (v: any) => (v === null || v === undefined || v === "" ? "—" : String(v))
const qtyCol = (): StageDataCol<any> => ({
  id: "qty", label: "Qty", type: "number", align: "right", cellClassName: "min-w-[110px]", accessor: (s) => Number(s.qty) || 0, tone: "blue",
  render: (s) => <span className="font-mono tabular-nums">{fmtNum(Number(s.qty) || 0, 4)}</span>,
})
const statusCol = (): StageDataCol<any> => ({
  id: "status", label: "Status", align: "left", accessor: (s) => s.status,
  render: (s) => <Badge className={statusClass(s.status)}>{s.status}</Badge>,
})
const productsCol = (): StageDataCol<any> => ({
  id: "products", label: "Products", align: "left", accessor: (s) => s.products,
  render: (s) => <span className="block max-w-[220px] truncate" title={s.products || ""}>{txt(s.products)}</span>,
})
const dateCol = (): StageDataCol<any> => ({
  id: "do_date", label: "DO Date", type: "date", align: "right", cellClassName: "min-w-[110px] font-mono tabular-nums", accessor: (s) => s.party_so_date || s.created_at,
  render: (s) => fmtDate(s.party_so_date || s.created_at),
})
const doCol = (): StageDataCol<any> => ({
  id: "order_no", label: "Return DO", align: "left", accessor: (s) => s.order_no,
  render: (s) => <span className="font-bold text-slate-700">{s.order_no}</span>,
})
const reasonCol = (): StageDataCol<any> => ({ id: "reason", label: "Reason", align: "left", accessor: (s) => s.return_reason, render: (s) => txt(s.return_reason) })

const SALES_COLUMNS: StageDataCol<any>[] = [
  dateCol(), doCol(),
  { id: "customer", label: "Customer", align: "left", accessor: (s) => s.customer_name, cellClassName: "font-medium", render: (s) => txt(s.customer_name) },
  { id: "invoice", label: "Original Invoice", align: "left", accessor: (s) => s.invoice_no, render: (s) => txt(s.invoice_no) },
  productsCol(), qtyCol(), reasonCol(), statusCol(),
]

const STOCK_COLUMNS: StageDataCol<any>[] = [
  dateCol(), doCol(),
  { id: "original", label: "Original Transfer", align: "left", accessor: (s) => s.original_order_no, render: (s) => s.original_order_no },
  { id: "from_depot", label: "From Depot", align: "left", accessor: (s) => s.from_depot, render: (s) => txt(s.from_depot) },
  { id: "returned_to", label: "Returned To", align: "left", accessor: (s) => s.to_depot || s.to_customer, render: (s) => txt(s.to_depot || s.to_customer) },
  productsCol(), qtyCol(), reasonCol(), statusCol(),
]
const fmtQty = (n: number) => n.toFixed(4)

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
      <StageDataCard
        storageKey="return-sales"
        title="Sales Returns"
        description="Customer returns and where each one is in the pipeline."
        rows={salesReturns}
        columns={SALES_COLUMNS}
        rowKey={(s: any) => s.id}
        loading={loadingSales}
        emptyText="No sales returns yet."
        statusOf={(s: any) => s.status}
        format={fmtQty}
      />

      {/* Stock returns */}
      <StageDataCard
        storageKey="return-stock"
        title="Stock Returns"
        description="Depot-to-Banari / depot-to-depot returns, raised as a Stock Transfer against the original transfer."
        rows={stockReturns}
        columns={STOCK_COLUMNS}
        rowKey={(s: any) => s.id}
        loading={loadingStock}
        emptyText="No stock returns yet."
        statusOf={(s: any) => s.status}
        selects={[{ id: "from", allLabel: "All From Depots", getValue: (s: any) => s.from_depot }]}
        format={fmtQty}
      />
    </div>
  )
}
