const fs = require('fs');
const file = 'c:/Users/yuvra/Desktop/New Folder/shree shyam oil extractions/Order-To-Dispatch-V2/app/commitment-punch/page.tsx';
let code = fs.readFileSync(file, 'utf8');

const tableBlockStart = code.indexOf('<table className="w-full text-sm border-collapse">');
const tableBlockEnd = code.indexOf('</table>', tableBlockStart) + '</table>'.length;

const replacementTable = `
<table className="w-full text-sm border-collapse">
  <thead className="bg-slate-100/90 border-b border-slate-200">
    {/* Column Headings and Filters */}
    {detailsType === "delivered" ? (
      <tr>
        <th className="py-2.5 px-3 align-top whitespace-nowrap w-8">
          <div className="flex flex-col gap-1.5 w-full">
            <div className="flex items-center justify-start h-4 text-xs font-bold text-slate-600 uppercase tracking-wider">#</div>
          </div>
        </th>
        {[
          { id: "invoice_no", label: "Invoice No.", w: "min-w-[120px]" },
          { id: "invoice_date", label: "Invoice Date", w: "min-w-[100px]" },
          { id: "order_no", label: "DO No.", w: "min-w-[130px]" },
          { id: "do_date", label: "DO Date", w: "min-w-[100px]" },
          { id: "manual_sauda_no", label: "Manual Sauda No.", w: "min-w-[140px]" },
          { id: "po_no", label: "PO No.", w: "min-w-[110px]" },
          { id: "po_date", label: "PO Date", w: "min-w-[100px]" },
          { id: "customer_name", label: "Customer Name", w: "min-w-[180px]" },
          { id: "sku", label: "Item Name", w: "min-w-[160px]" },
          { id: "sku_quantity", label: "Qty (Box)", w: "min-w-[90px]", right: true },
          { id: "delivered_mt", label: "Qty (MT)", w: "min-w-[110px]", right: true },
          { id: "invoice_amount", label: "Invoice Amount", w: "min-w-[120px]", right: true },
        ].map(col => (
          <th key={col.id} className={\`py-2.5 px-3 align-top whitespace-nowrap \${col.w}\`}>
            <div className="flex flex-col gap-1.5 w-full">
              <div className="w-full mt-0.5">
                <Input
                  placeholder="Search..."
                  value={detailsColumnFilters[col.id] || ""}
                  onChange={(e) => setDetailsColumnFilters(prev => ({ ...prev, [col.id]: e.target.value }))}
                  className={cn(
                    "h-7 text-[10px] w-full px-2.5 py-0 bg-slate-50 hover:bg-slate-100 focus:bg-white border-slate-200/70 focus:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-100/50 shadow-2xs rounded-md transition-all placeholder:text-slate-400/80 font-medium text-slate-700",
                    col.right ? "text-right" : "text-left"
                  )}
                />
              </div>
              <div className={cn("flex items-center gap-1 cursor-pointer select-none text-xs font-bold uppercase tracking-wider w-full", col.right ? "justify-end text-slate-800" : "justify-start text-slate-600")}>
                {col.label}
              </div>
            </div>
          </th>
        ))}
      </tr>
    ) : detailsType === "pending" ? (
      <tr>
        <th className="py-2.5 px-3 align-top whitespace-nowrap w-8">
          <div className="flex flex-col gap-1.5 w-full">
            <div className="flex items-center justify-start h-4 text-xs font-bold text-slate-600 uppercase tracking-wider">#</div>
          </div>
        </th>
        {[
          { id: "po_no", label: "PO No.", w: "min-w-[110px]" },
          { id: "po_date", label: "PO Date", w: "min-w-[100px]" },
          { id: "order_no", label: "DO No.", w: "min-w-[130px]" },
          { id: "do_date", label: "DO Date", w: "min-w-[100px]" },
          { id: "manual_sauda_no", label: "Manual Sauda No.", w: "min-w-[140px]" },
          { id: "customer_name", label: "Customer Name", w: "min-w-[180px]" },
          { id: "sku", label: "Item Name", w: "min-w-[160px]" },
          { id: "sku_quantity", label: "Total Qty (Box)", w: "min-w-[100px]", right: true },
          { id: "delivered_box", label: "Delivered (Box)", w: "min-w-[120px]", right: true },
          { id: "pending_box", label: "Pending (Box)", w: "min-w-[120px]", right: true, amber: true },
          { id: "sku_weight_mt", label: "Total Qty (MT)", w: "min-w-[100px]", right: true },
          { id: "delivered_mt", label: "Delivered (MT)", w: "min-w-[120px]", right: true },
          { id: "pending_mt", label: "Pending (MT)", w: "min-w-[120px]", right: true, amber: true },
        ].map(col => (
          <th key={col.id} className={\`py-2.5 px-3 align-top whitespace-nowrap \${col.w}\`}>
            <div className="flex flex-col gap-1.5 w-full">
              <div className="w-full mt-0.5">
                <Input
                  placeholder="Search..."
                  value={detailsColumnFilters[col.id] || ""}
                  onChange={(e) => setDetailsColumnFilters(prev => ({ ...prev, [col.id]: e.target.value }))}
                  className={cn(
                    "h-7 text-[10px] w-full px-2.5 py-0 bg-slate-50 hover:bg-slate-100 focus:bg-white border-slate-200/70 focus:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-100/50 shadow-2xs rounded-md transition-all placeholder:text-slate-400/80 font-medium text-slate-700",
                    col.right ? "text-right" : "text-left"
                  )}
                />
              </div>
              <div className={cn("flex items-center gap-1 cursor-pointer select-none text-xs font-bold uppercase tracking-wider w-full", col.right ? "justify-end text-slate-800" : "justify-start", col.amber ? "text-amber-700" : "text-slate-600")}>
                {col.label}
              </div>
            </div>
          </th>
        ))}
      </tr>
    ) : (
      <tr>
        <th className="py-2.5 px-3 align-top whitespace-nowrap w-8">
          <div className="flex flex-col gap-1.5 w-full">
            <div className="flex items-center justify-start h-4 text-xs font-bold text-slate-600 uppercase tracking-wider">#</div>
          </div>
        </th>
        {[
          { id: "raised_at", label: "Raised On", w: "min-w-[100px]" },
          { id: "order_no", label: "DO No.", w: "min-w-[130px]" },
          { id: "po_no", label: "PO No.", w: "min-w-[110px]" },
          { id: "po_date", label: "PO Date", w: "min-w-[100px]" },
          { id: "sku", label: "SKU", w: "min-w-[160px]" },
          { id: "sku_quantity", label: "Qty (Box)", w: "min-w-[90px]", right: true },
          { id: "sku_weight_mt", label: "Weight (MT)", w: "min-w-[110px]", right: true },
          { id: "sku_rate", label: "Rate", w: "min-w-[100px]", right: true },
          { id: "order_category", label: "Category", w: "min-w-[100px]" },
          { id: "order_type", label: "Order Type", w: "min-w-[110px]" },
          { id: "actual_depot_name", label: "Depo", w: "min-w-[110px]" },
          { id: "payment_terms", label: "Payment Terms", w: "min-w-[130px]" },
          { id: "remarks", label: "Remarks", w: "min-w-[140px]" },
        ].map(col => (
          <th key={col.id} className={\`py-2.5 px-3 align-top whitespace-nowrap \${col.w}\`}>
            <div className="flex flex-col gap-1.5 w-full">
              <div className="w-full mt-0.5">
                <Input
                  placeholder="Search..."
                  value={detailsColumnFilters[col.id] || ""}
                  onChange={(e) => setDetailsColumnFilters(prev => ({ ...prev, [col.id]: e.target.value }))}
                  className={cn(
                    "h-7 text-[10px] w-full px-2.5 py-0 bg-slate-50 hover:bg-slate-100 focus:bg-white border-slate-200/70 focus:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-100/50 shadow-2xs rounded-md transition-all placeholder:text-slate-400/80 font-medium text-slate-700",
                    col.right ? "text-right" : "text-left"
                  )}
                />
              </div>
              <div className={cn("flex items-center gap-1 cursor-pointer select-none text-xs font-bold uppercase tracking-wider w-full", col.right ? "justify-end text-slate-800" : "justify-start text-slate-600")}>
                {col.label}
              </div>
            </div>
          </th>
        ))}
      </tr>
    )}
  </thead>
  <tbody className="divide-y divide-slate-200 bg-white">
    {/* Totals Row */}
    {detailsType === "raised" && (() => {
      const totalBox = filteredDetailsData.reduce((sum: number, d: any) => sum + (Number(d.sku_quantity) || 0), 0)
      const totalMt = filteredDetailsData.reduce((sum: number, d: any) => sum + (Number(d.sku_weight_mt) || 0), 0)
      return (
        <tr className="bg-slate-50/80 text-xs font-bold border-b-2 border-slate-200">
          <td colSpan={6} className="py-2.5 px-3 text-right text-slate-600 whitespace-nowrap uppercase tracking-wider">Total PO Raised:</td>
          <td className="py-2.5 px-3 text-right font-mono text-slate-800 whitespace-nowrap">{totalBox.toLocaleString("en-IN")}</td>
          <td className="py-2.5 px-3 text-right font-mono text-slate-900 whitespace-nowrap">{totalMt.toFixed(4)} MT</td>
          <td colSpan={6} />
        </tr>
      )
    })()}
    {detailsType === "delivered" && (() => {
      const totalBox = filteredDetailsData.reduce((sum: number, d: any) => sum + (Number(d.sku_quantity) || 0), 0)
      const totalMt = filteredDetailsData.reduce((sum: number, d: any) => sum + (Number(d.delivered_mt) || 0), 0)
      const totalInvoice = filteredDetailsData.reduce((sum: number, d: any) => sum + (Number(d.invoice_amount) || 0), 0)
      return (
        <tr className="bg-slate-50/80 text-xs font-bold border-b-2 border-slate-200">
          <td colSpan={10} className="py-2.5 px-3 text-right text-slate-600 whitespace-nowrap uppercase tracking-wider">Total Delivered:</td>
          <td className="py-2.5 px-3 text-right font-mono text-slate-800 whitespace-nowrap">{totalBox.toLocaleString("en-IN")}</td>
          <td className="py-2.5 px-3 text-right font-mono text-slate-900 whitespace-nowrap">{totalMt.toFixed(4)} MT</td>
          <td className="py-2.5 px-3 text-right font-mono text-emerald-700 whitespace-nowrap">₹{totalInvoice.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>
      )
    })()}
    {detailsType === "pending" && (() => {
      const totalBox = filteredDetailsData.reduce((sum: number, d: any) => sum + (Number(d.sku_quantity) || 0), 0)
      const totalDeliveredBox = filteredDetailsData.reduce((sum: number, d: any) => sum + (Number(d.delivered_box) || 0), 0)
      const totalPendingBox = filteredDetailsData.reduce((sum: number, d: any) => sum + (Number(d.pending_box) || 0), 0)
      const totalMt = filteredDetailsData.reduce((sum: number, d: any) => sum + (Number(d.sku_weight_mt) || 0), 0)
      const totalDeliveredMt = filteredDetailsData.reduce((sum: number, d: any) => sum + (Number(d.delivered_mt) || 0), 0)
      const totalPendingMt = filteredDetailsData.reduce((sum: number, d: any) => sum + (Number(d.pending_mt) || 0), 0)
      return (
        <tr className="bg-slate-50/80 text-xs font-bold border-b-2 border-slate-200">
          <td colSpan={8} className="py-2.5 px-3 text-right text-slate-600 whitespace-nowrap uppercase tracking-wider">Total PO Pending:</td>
          <td className="py-2.5 px-3 text-right font-mono text-slate-800 whitespace-nowrap">{totalBox.toLocaleString("en-IN")}</td>
          <td className="py-2.5 px-3 text-right font-mono text-slate-600 whitespace-nowrap">{totalDeliveredBox.toLocaleString("en-IN")}</td>
          <td className="py-2.5 px-3 text-right font-mono text-amber-700 whitespace-nowrap">{totalPendingBox.toLocaleString("en-IN")}</td>
          <td className="py-2.5 px-3 text-right font-mono text-slate-800 whitespace-nowrap">{totalMt.toFixed(4)}</td>
          <td className="py-2.5 px-3 text-right font-mono text-slate-600 whitespace-nowrap">{totalDeliveredMt.toFixed(4)}</td>
          <td className="py-2.5 px-3 text-right font-mono text-amber-700 whitespace-nowrap">{totalPendingMt.toFixed(4)} MT</td>
        </tr>
      )
    })()}

    {filteredDetailsData.length === 0 ? (
      <tr>
        <td colSpan={14} className="py-8 text-center text-slate-400 font-medium">No results found</td>
      </tr>
    ) : (
      filteredDetailsData.map((d: any, idx: number) => {
        const custName = d.customer_name || detailsData.commitment?.customer?.customer_name || detailsRow?.party_name || "—"
        const doDateFormatted = d.do_date ? new Date(d.do_date).toLocaleDateString("en-IN") : (d.raised_at ? new Date(d.raised_at).toLocaleDateString("en-IN") : "—")
        const saudaNo = d.manual_sauda_no || detailsRow?.commitment_no || "—"

        if (detailsType === "delivered") {
          return (
            <tr key={d.id} className="hover:bg-slate-50 transition-colors">
              <td className="py-2.5 px-3 text-xs text-slate-400 font-bold whitespace-nowrap">{idx + 1}</td>
              <td className="py-2.5 px-3 whitespace-nowrap">
                {d.invoice_copy ? (
                  <a href={d.invoice_copy} target="_blank" rel="noopener noreferrer" className="font-mono text-xs font-semibold text-blue-600 hover:underline">
                    {d.invoice_no || "View Invoice"}
                  </a>
                ) : (
                  <span className="font-mono text-xs text-slate-700">{d.invoice_no || "—"}</span>
                )}
              </td>
              <td className="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">{d.invoice_date ? new Date(d.invoice_date).toLocaleDateString("en-IN") : "—"}</td>
              <td className="py-2.5 px-3 whitespace-nowrap">
                {Array.isArray(d.invoice_do_nos) && d.invoice_do_nos.length > 1 ? (
                  <div className="flex flex-col gap-0.5">
                    {d.invoice_do_nos.map((no: string) => (
                      <Link key={no} href={\`/approval-of-order?search=\${no}\`} className="font-mono text-xs font-bold text-slate-800 hover:text-blue-600 hover:underline">
                        {no}
                      </Link>
                    ))}
                  </div>
                ) : d.order_no ? (
                  <Link href={\`/approval-of-order?search=\${d.order_no}\`} className="font-mono text-xs font-bold text-slate-800 hover:text-blue-600 hover:underline">
                    {d.order_no}
                  </Link>
                ) : <span className="text-slate-400">—</span>}
              </td>
              <td className="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">{doDateFormatted}</td>
              <td className="py-2.5 px-3 text-xs font-mono text-slate-700 whitespace-nowrap">{saudaNo}</td>
              <td className="py-2.5 px-3 whitespace-nowrap">
                {d.po_upload_copy ? (
                  <a href={d.po_upload_copy} target="_blank" rel="noopener noreferrer" className="font-mono text-xs font-semibold text-blue-600 hover:underline">
                    {d.po_no || "View PO"}
                  </a>
                ) : (
                  <span className="font-mono text-xs text-slate-700">{d.po_no || "—"}</span>
                )}
              </td>
              <td className="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">{d.po_date ? new Date(d.po_date).toLocaleDateString("en-IN") : "—"}</td>
              <td className="py-2.5 px-3 text-xs text-slate-800 font-medium whitespace-nowrap">{custName}</td>
              <td className="py-2.5 px-3 text-xs text-slate-800 font-medium whitespace-nowrap">{d.sku || "—"}</td>
              <td className="py-2.5 px-3 font-mono text-xs text-slate-800 text-right whitespace-nowrap">{d.sku_quantity != null ? Number(d.sku_quantity).toLocaleString("en-IN") : "—"}</td>
              <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono text-xs font-bold text-slate-900">
                {d.delivered_mt != null ? Number(d.delivered_mt).toFixed(4) : "—"}
              </td>
              <td className="py-2.5 px-3 font-mono text-xs text-slate-800 text-right whitespace-nowrap font-semibold">{d.invoice_amount ? \`₹\${Number(d.invoice_amount).toLocaleString("en-IN")}\` : "—"}</td>
            </tr>
          )
        }

        if (detailsType === "pending") {
          return (
            <tr key={d.id} className="hover:bg-slate-50 transition-colors">
              <td className="py-2.5 px-3 text-xs text-slate-400 font-bold whitespace-nowrap">{idx + 1}</td>
              <td className="py-2.5 px-3 whitespace-nowrap">
                {d.po_upload_copy ? (
                  <a href={d.po_upload_copy} target="_blank" rel="noopener noreferrer" className="font-mono text-xs font-semibold text-blue-600 hover:underline">
                    {d.po_no || "View PO"}
                  </a>
                ) : (
                  <span className="font-mono text-xs text-slate-700">{d.po_no || "—"}</span>
                )}
              </td>
              <td className="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">{d.po_date ? new Date(d.po_date).toLocaleDateString("en-IN") : "—"}</td>
              <td className="py-2.5 px-3 whitespace-nowrap">
                {d.order_no ? (
                  <Link href={\`/approval-of-order?search=\${d.order_no}\`} className="font-mono text-xs font-bold text-slate-800 hover:text-blue-600 hover:underline">
                    {d.order_no}
                  </Link>
                ) : <span className="text-slate-400">—</span>}
              </td>
              <td className="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">{doDateFormatted}</td>
              <td className="py-2.5 px-3 text-xs font-mono text-slate-700 whitespace-nowrap">{saudaNo}</td>
              <td className="py-2.5 px-3 text-xs text-slate-800 font-medium whitespace-nowrap">{custName}</td>
              <td className="py-2.5 px-3 text-xs text-slate-800 font-medium whitespace-nowrap">{d.sku || "—"}</td>
              <td className="py-2.5 px-3 font-mono text-xs text-slate-800 text-right whitespace-nowrap">{d.sku_quantity != null ? Number(d.sku_quantity).toLocaleString("en-IN") : "—"}</td>
              <td className="py-2.5 px-3 font-mono text-xs text-slate-600 text-right whitespace-nowrap">{d.delivered_box != null ? Number(d.delivered_box).toLocaleString("en-IN") : "0"}</td>
              <td className="py-2.5 px-3 font-mono text-xs font-bold text-amber-700 text-right whitespace-nowrap">{d.pending_box != null ? Number(d.pending_box).toLocaleString("en-IN") : "0"}</td>
              <td className="py-2.5 px-3 font-mono text-xs text-slate-800 text-right whitespace-nowrap">{d.sku_weight_mt != null ? Number(d.sku_weight_mt).toFixed(4) : "—"}</td>
              <td className="py-2.5 px-3 font-mono text-xs text-slate-600 text-right whitespace-nowrap">{d.delivered_mt != null ? Number(d.delivered_mt).toFixed(4) : "0.0000"}</td>
              <td className="py-2.5 px-3 font-mono text-xs font-bold text-amber-700 text-right whitespace-nowrap">{d.pending_mt != null ? Number(d.pending_mt).toFixed(4) : "0.0000"}</td>
            </tr>
          )
        }

        const mt = d.sku_weight_mt
        return (
          <tr key={d.id} className="hover:bg-slate-50 transition-colors">
            <td className="py-2.5 px-3 text-xs text-slate-400 font-bold whitespace-nowrap">{idx + 1}</td>
            <td className="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">{d.raised_at ? new Date(d.raised_at).toLocaleDateString("en-IN") : "—"}</td>
            <td className="py-2.5 px-3 whitespace-nowrap">
              {d.order_no ? (
                <Link
                  href={\`/approval-of-order?search=\${d.order_no}\`}
                  className="font-mono text-xs font-bold text-slate-800 hover:text-blue-600 hover:underline"
                >
                  {d.order_no}
                </Link>
              ) : (
                <span className="text-slate-400">—</span>
              )}
            </td>
            <td className="py-2.5 px-3 whitespace-nowrap">
              {d.po_upload_copy ? (
                <a href={d.po_upload_copy} target="_blank" rel="noopener noreferrer" className="font-mono text-xs font-semibold text-blue-600 hover:underline">
                  {d.po_no || "View PO"}
                </a>
              ) : (
                <span className="font-mono text-xs text-slate-700">{d.po_no || "—"}</span>
              )}
            </td>
            <td className="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">{d.po_date ? new Date(d.po_date).toLocaleDateString("en-IN") : "—"}</td>
            <td className="py-2.5 px-3 text-xs text-slate-800 font-medium whitespace-nowrap">{d.sku || "—"}</td>
            <td className="py-2.5 px-3 font-mono text-xs text-slate-800 text-right whitespace-nowrap">{d.sku_quantity != null ? Number(d.sku_quantity).toLocaleString("en-IN") : "—"}</td>
            <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono text-xs font-bold text-slate-900 min-w-[110px]">
              {mt != null ? Number(mt).toFixed(4) : "—"}
            </td>
            <td className="py-2.5 px-3 font-mono text-xs text-slate-800 text-right whitespace-nowrap font-semibold">{d.sku_rate ? \`₹\${Number(d.sku_rate).toLocaleString("en-IN")}\` : "—"}</td>
            <td className="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">{d.order_category || "—"}</td>
            <td className="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">{d.order_type || "—"}</td>
            <td className="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">{d.actual_depot_name || "—"}</td>
            <td className="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">{formatPaymentTerms(d.payment_terms)}</td>
            <td className="py-2.5 px-3 text-xs text-slate-500 font-normal italic whitespace-nowrap max-w-[160px] truncate" title={d.remarks}>{d.remarks || "—"}</td>
          </tr>
        )
      })
    )}
  </tbody>
</table>
`;

const newCode = code.substring(0, tableBlockStart) + replacementTable + code.substring(tableBlockEnd);
fs.writeFileSync(file, newCode);
console.log('Table structure rewritten successfully!');
