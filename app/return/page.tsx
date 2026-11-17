"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StageDataCard, type StageDataCol } from "@/components/stage-list-extra/stage-data-card"
import { returnApi } from "@/lib/api-service"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeftRight, ChevronDown, Info, Plus, Printer, Undo2 } from "lucide-react"
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

  const [tab, setTab] = useState<"sales" | "stock">("sales")

  return (
    <div className="p-3 sm:px-6 sm:py-3 max-w-full space-y-2 sm:space-y-3" suppressHydrationWarning>
      <Tabs value={tab} onValueChange={(v) => setTab(v as "sales" | "stock")} className="w-full">
        {/* Heading: title left, tabs + actions right (same pattern as the other stages) */}
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <SidebarTrigger className="-ml-1" />
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Stage 17: Return</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">Raise customer and stock returns, then track them to documents.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap xl:shrink-0">
            <TabsList className="grid h-9 w-[300px] grid-cols-2 rounded-lg bg-muted/50 p-1">
              <TabsTrigger value="sales" className="rounded-md py-1 text-xs">
                Sales Returns
                <span className="ml-1.5 rounded-full bg-white px-1.5 text-[10px] font-bold text-slate-600 ring-1 ring-slate-200">{salesReturns.length}</span>
              </TabsTrigger>
              <TabsTrigger value="stock" className="rounded-md py-1 text-xs">
                Stock Returns
                <span className="ml-1.5 rounded-full bg-white px-1.5 text-[10px] font-bold text-slate-600 ring-1 ring-slate-200">{stockReturns.length}</span>
              </TabsTrigger>
            </TabsList>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9" title="How returns work" aria-label="How returns work">
                  <Info className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[420px] space-y-3 p-4">
                <p className="text-sm font-semibold text-slate-900">How returns work</p>
                <p className="-mt-1.5 text-xs text-muted-foreground">Goods are received at Stage 18 and Billing issues the documents at Stage 19.</p>
                <div className="space-y-2.5 text-xs text-slate-600">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Case I &amp; II · Stock transfer</p>
                    <p>Depot → Banari, or depot → depot. Raised as a Stock Transfer order against the original transfer; stock-out and stock-in follow automatically.</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Case III · Customer return</p>
                    <p>Punch an order in the <b>Sales Return</b> category against the original invoice. After the pickup is dispatched, the goods are unloaded and weighed (Stage 18) and Billing issues the credit note (Stage 19).</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Main gate · Stock return gate pass</p>
                    <p>A vehicle brings returned stock to the gate: issue a fill-in-the-blank pass for the handwritten entries.</p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Sales return flow</p>
                    <p>Order Punch → Approval → Dispatch Planning → Plan Vehicle → Gate In → Actual Dispatch → <b>Stage 18 Unload Returned Stock</b> → <b>Stage 19 Issue Documents</b> (credit note).</p>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Button variant="outline" className="h-9" title="Stock Return Gate Pass" onClick={() => router.push("/return-gate-pass")}>
              <Printer className="mr-2 h-4 w-4" />
              Gate Pass
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="h-9 gap-2 bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4" />
                  New Return
                  <ChevronDown className="h-4 w-4 opacity-80" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8} className="w-[340px] rounded-xl p-1.5 shadow-xl">
                <DropdownMenuLabel className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Raise a return
                </DropdownMenuLabel>
                <DropdownMenuItem
                  className="group cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2.5 focus:bg-blue-50"
                  onClick={() => router.push("/order-punch/create?category=Sales%20Return")}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-100 group-focus:bg-white">
                    <Undo2 className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-900">Sales Return</span>
                    <span className="block truncate text-xs text-muted-foreground">Customer sends goods back</span>
                  </span>
                  <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">Case III</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="group cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2.5 focus:bg-blue-50"
                  onClick={() => router.push("/order-punch/create?category=Stock%20Transfer&stockReturn=1")}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600 ring-1 ring-violet-100 group-focus:bg-white">
                    <ArrowLeftRight className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-900">Stock Return</span>
                    <span className="block truncate text-xs text-muted-foreground">Depot → Banari or depot → depot</span>
                  </span>
                  <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">Case I &amp; II</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <TabsContent value="sales" className="mt-3">
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
        </TabsContent>

        <TabsContent value="stock" className="mt-3">
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
        </TabsContent>
      </Tabs>
    </div>
  )
}
