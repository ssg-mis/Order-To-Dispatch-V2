const fs = require('fs');
const file = 'c:/Users/yuvra/Desktop/New Folder/shree shyam oil extractions/Order-To-Dispatch-V2/app/commitment-punch/page.tsx';
let code = fs.readFileSync(file, 'utf8');

const tableBlockStart = code.indexOf('<table className="w-full text-sm border-collapse">');
const tableBlockEnd = code.indexOf('</table>', tableBlockStart) + '</table>'.length;

const replacementTable = `
<table className="w-full text-sm border-collapse">
  <thead className="bg-slate-50 border-b border-slate-200">
    {/* Column Headings and Filters */}
    {detailsType === "delivered" ? (
      <tr>
        <th className="py-2.5 px-3 align-top whitespace-nowrap w-8">
          <div className="flex flex-col gap-1.5 w-full">
            <div className="w-full mb-0.5 opacity-0"><Input className="h-7" /></div>
            <div className="flex items-center justify-start gap-1 select-none text-[11px] font-bold text-slate-400 uppercase tracking-wider w-full">#</div>
          </div>
        </th>
        {[
          { id: "invoice_no", label: "Invoice No.", w: "min-w-[120px]", color: "text-purple-600" },
          { id: "invoice_date", label: "Invoice Date", w: "min-w-[100px]", color: "text-slate-500" },
          { id: "order_no", label: "DO No.", w: "min-w-[130px]", color: "text-emerald-600" },
          { id: "do_date", label: "DO Date", w: "min-w-[100px]", color: "text-slate-500" },
          { id: "manual_sauda_no", label: "Manual Sauda No.", w: "min-w-[140px]", color: "text-slate-500" },
          { id: "po_no", label: "PO No.", w: "min-w-[110px]", color: "text-blue-600" },
          { id: "po_date", label: "PO Date", w: "min-w-[100px]", color: "text-slate-500" },
          { id: "customer_name", label: "Customer Name", w: "min-w-[180px]", color: "text-slate-600" },
          { id: "sku", label: "Item Name", w: "min-w-[160px]", color: "text-slate-600" },
          { id: "sku_quantity", label: "Qty (Box)", w: "min-w-[90px]", right: true, color: "text-slate-600" },
          { id: "delivered_mt", label: "Qty (MT)", w: "min-w-[110px]", right: true, color: "text-purple-700" },
          { id: "invoice_amount", label: "Invoice Amount", w: "min-w-[120px]", right: true, color: "text-emerald-700" },
        ].filter(col => !detailsHiddenCols[col.id]).map(col => (
          <th key={col.id} className={\`py-2.5 px-3 align-top whitespace-nowrap \${col.w}\`}>
            <div className="flex flex-col gap-1.5 w-full">
              <div className="w-full mb-0.5">
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
              <div className={cn("flex items-center gap-1 select-none text-[11px] font-bold uppercase tracking-wider w-full", col.right ? "justify-end" : "justify-start", col.color)}>
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
            <div className="w-full mb-0.5 opacity-0"><Input className="h-7" /></div>
            <div className="flex items-center justify-start gap-1 select-none text-[11px] font-bold text-slate-400 uppercase tracking-wider w-full">#</div>
          </div>
        </th>
        {[
          { id: "po_no", label: "PO No.", w: "min-w-[110px]", color: "text-blue-600" },
          { id: "po_date", label: "PO Date", w: "min-w-[100px]", color: "text-slate-500" },
          { id: "order_no", label: "DO No.", w: "min-w-[130px]", color: "text-emerald-600" },
          { id: "do_date", label: "DO Date", w: "min-w-[100px]", color: "text-slate-500" },
          { id: "manual_sauda_no", label: "Manual Sauda No.", w: "min-w-[140px]", color: "text-slate-500" },
          { id: "customer_name", label: "Customer Name", w: "min-w-[180px]", color: "text-slate-600" },
          { id: "sku", label: "Item Name", w: "min-w-[160px]", color: "text-slate-600" },
          { id: "sku_quantity", label: "Total (Box)", w: "min-w-[100px]", right: true, color: "text-slate-600" },
          { id: "delivered_box", label: "Deliv (Box)", w: "min-w-[100px]", right: true, color: "text-emerald-600" },
          { id: "pending_box", label: "Pend (Box)", w: "min-w-[100px]", right: true, color: "text-amber-600" },
          { id: "sku_weight_mt", label: "Total (MT)", w: "min-w-[100px]", right: true, color: "text-slate-700" },
          { id: "delivered_mt", label: "Deliv (MT)", w: "min-w-[100px]", right: true, color: "text-emerald-700" },
          { id: "pending_mt", label: "Pend (MT)", w: "min-w-[100px]", right: true, color: "text-amber-700" },
        ].filter(col => !detailsHiddenCols[col.id]).map(col => (
          <th key={col.id} className={\`py-2.5 px-3 align-top whitespace-nowrap \${col.w}\`}>
            <div className="flex flex-col gap-1.5 w-full">
              <div className="w-full mb-0.5">
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
              <div className={cn("flex items-center gap-1 select-none text-[11px] font-bold uppercase tracking-wider w-full", col.right ? "justify-end" : "justify-start", col.color)}>
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
            <div className="w-full mb-0.5 opacity-0"><Input className="h-7" /></div>
            <div className="flex items-center justify-start gap-1 select-none text-[11px] font-bold text-slate-400 uppercase tracking-wider w-full">#</div>
          </div>
        </th>
        {[
          { id: "raised_at", label: "Raised On", w: "min-w-[100px]", color: "text-slate-500" },
          { id: "order_no", label: "DO No.", w: "min-w-[130px]", color: "text-emerald-600" },
          { id: "po_no", label: "PO No.", w: "min-w-[110px]", color: "text-blue-600" },
          { id: "po_date", label: "PO Date", w: "min-w-[100px]", color: "text-slate-500" },
          { id: "sku", label: "SKU", w: "min-w-[160px]", color: "text-slate-600" },
          { id: "sku_quantity", label: "Qty (Box)", w: "min-w-[90px]", right: true, color: "text-slate-600" },
          { id: "sku_weight_mt", label: "Weight (MT)", w: "min-w-[110px]", right: true, color: "text-blue-700" },
          { id: "sku_rate", label: "Rate", w: "min-w-[100px]", right: true, color: "text-emerald-700" },
          { id: "order_category", label: "Category", w: "min-w-[100px]", color: "text-slate-500" },
          { id: "order_type", label: "Order Type", w: "min-w-[110px]", color: "text-slate-500" },
          { id: "actual_depot_name", label: "Depo", w: "min-w-[110px]", color: "text-slate-500" },
          { id: "payment_terms", label: "Payment Terms", w: "min-w-[130px]", color: "text-slate-500" },
          { id: "remarks", label: "Remarks", w: "min-w-[140px]", color: "text-slate-500" },
        ].filter(col => !detailsHiddenCols[col.id]).map(col => (
          <th key={col.id} className={\`py-2.5 px-3 align-top whitespace-nowrap \${col.w}\`}>
            <div className="flex flex-col gap-1.5 w-full">
              <div className="w-full mb-0.5">
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
              <div className={cn("flex items-center gap-1 select-none text-[11px] font-bold uppercase tracking-wider w-full", col.right ? "justify-end" : "justify-start", col.color)}>
                {col.label}
              </div>
            </div>
          </th>
        ))}
      </tr>
    )}
  </thead>
  <tbody className="divide-y divide-slate-100 bg-white">
    {/* Totals Row */}
    {detailsType === "raised" && (() => {
      const totalBox = filteredDetailsData.reduce((sum: number, d: any) => sum + (Number(d.sku_quantity) || 0), 0)
      const totalMt = filteredDetailsData.reduce((sum: number, d: any) => sum + (Number(d.sku_weight_mt) || 0), 0)
      const vis = (id: string) => !detailsHiddenCols[id];
      return (
        <tr className="bg-blue-50/40 border-b-2 border-blue-100 hover:bg-blue-50/60 transition-colors z-10">
          <td className="py-2.5 px-3"></td>
          <td className="py-2.5 px-3 text-left font-black text-slate-800 whitespace-nowrap uppercase tracking-wider text-[11px]" colSpan={13}>Total PO Raised: 
            {vis("sku_quantity") && <span className="ml-4 font-mono text-slate-700">{totalBox.toLocaleString("en-IN")} BOX</span>}
            {vis("sku_weight_mt") && <span className="ml-4 font-mono text-blue-700">{totalMt.toFixed(4)} MT</span>}
          </td>
        </tr>
      )
    })()}
    {detailsType === "delivered" && (() => {
      const totalBox = filteredDetailsData.reduce((sum: number, d: any) => sum + (Number(d.sku_quantity) || 0), 0)
      const totalMt = filteredDetailsData.reduce((sum: number, d: any) => sum + (Number(d.delivered_mt) || 0), 0)
      const totalInvoice = filteredDetailsData.reduce((sum: number, d: any) => sum + (Number(d.invoice_amount) || 0), 0)
      const vis = (id: string) => !detailsHiddenCols[id];
      return (
        <tr className="bg-purple-50/40 border-b-2 border-purple-100 hover:bg-purple-50/60 transition-colors z-10">
          <td className="py-2.5 px-3"></td>
          <td className="py-2.5 px-3 text-left font-black text-slate-800 whitespace-nowrap uppercase tracking-wider text-[11px]" colSpan={12}>Total Delivered:
            {vis("sku_quantity") && <span className="ml-4 font-mono text-slate-700">{totalBox.toLocaleString("en-IN")} BOX</span>}
            {vis("delivered_mt") && <span className="ml-4 font-mono text-purple-700">{totalMt.toFixed(4)} MT</span>}
            {vis("invoice_amount") && <span className="ml-4 font-mono text-emerald-700">₹{totalInvoice.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
          </td>
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
      const vis = (id: string) => !detailsHiddenCols[id];
      return (
        <tr className="bg-amber-50/40 border-b-2 border-amber-100 hover:bg-amber-50/60 transition-colors z-10">
          <td className="py-2.5 px-3"></td>
          <td className="py-2.5 px-3 text-left font-black text-slate-800 whitespace-nowrap uppercase tracking-wider text-[11px]" colSpan={13}>Total PO Pending:
            {vis("sku_quantity") && <span className="ml-4 font-mono text-slate-700">T: {totalBox.toLocaleString("en-IN")} BOX</span>}
            {vis("delivered_box") && <span className="ml-4 font-mono text-emerald-700">D: {totalDeliveredBox.toLocaleString("en-IN")} BOX</span>}
            {vis("pending_box") && <span className="ml-4 font-mono text-amber-600">P: {totalPendingBox.toLocaleString("en-IN")} BOX</span>}
            {vis("sku_weight_mt") && <span className="ml-6 font-mono text-slate-800">T: {totalMt.toFixed(4)} MT</span>}
            {vis("delivered_mt") && <span className="ml-4 font-mono text-emerald-700">D: {totalDeliveredMt.toFixed(4)} MT</span>}
            {vis("pending_mt") && <span className="ml-4 font-mono text-amber-700">P: {totalPendingMt.toFixed(4)} MT</span>}
          </td>
        </tr>
      )
    })()}

    {filteredDetailsData.length === 0 ? (
      <tr>
        <td colSpan={14} className="py-12 text-center text-slate-400 font-medium bg-slate-50/50">No results found for your search filters</td>
      </tr>
    ) : (
      filteredDetailsData.map((d: any, idx: number) => {
        const custName = d.customer_name || detailsData.commitment?.customer?.customer_name || detailsRow?.party_name || "—"
        const doDateFormatted = d.do_date ? new Date(d.do_date).toLocaleDateString("en-IN") : (d.raised_at ? new Date(d.raised_at).toLocaleDateString("en-IN") : "—")
        const saudaNo = d.manual_sauda_no || detailsRow?.commitment_no || "—"
        const vis = (id: string) => !detailsHiddenCols[id];

        if (detailsType === "delivered") {
          return (
            <tr key={d.id} className="hover:bg-purple-50/30 transition-colors group">
              <td className="py-2.5 px-3 text-xs text-slate-400 font-bold whitespace-nowrap group-hover:text-purple-400 transition-colors">{idx + 1}</td>
              {vis("invoice_no") && (
              <td className="py-2.5 px-3 whitespace-nowrap">
                {d.invoice_copy ? (
                  <a href={d.invoice_copy} target="_blank" rel="noopener noreferrer" className="font-mono text-xs font-semibold text-purple-600 hover:text-purple-700 hover:underline">
                    {d.invoice_no || "View Invoice"}
                  </a>
                ) : (
                  <span className="font-mono text-xs text-slate-700 font-semibold">{d.invoice_no || "—"}</span>
                )}
              </td>
              )}
              {vis("invoice_date") && <td className="py-2.5 px-3 text-xs text-slate-500 whitespace-nowrap">{d.invoice_date ? new Date(d.invoice_date).toLocaleDateString("en-IN") : "—"}</td>}
              {vis("order_no") && (
              <td className="py-2.5 px-3 whitespace-nowrap">
                {Array.isArray(d.invoice_do_nos) && d.invoice_do_nos.length > 1 ? (
                  <div className="flex flex-col gap-0.5">
                    {d.invoice_do_nos.map((no: string) => (
                      <Link key={no} href={\`/approval-of-order?search=\${no}\`} className="font-mono text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline">
                        {no}
                      </Link>
                    ))}
                  </div>
                ) : d.order_no ? (
                  <Link href={\`/approval-of-order?search=\${d.order_no}\`} className="font-mono text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline">
                    {d.order_no}
                  </Link>
                ) : <span className="text-slate-300">—</span>}
              </td>
              )}
              {vis("do_date") && <td className="py-2.5 px-3 text-xs text-slate-500 whitespace-nowrap">{doDateFormatted}</td>}
              {vis("manual_sauda_no") && <td className="py-2.5 px-3 text-xs font-mono text-slate-600 whitespace-nowrap font-medium">{saudaNo}</td>}
              {vis("po_no") && (
              <td className="py-2.5 px-3 whitespace-nowrap">
                {d.po_upload_copy ? (
                  <a href={d.po_upload_copy} target="_blank" rel="noopener noreferrer" className="font-mono text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline">
                    {d.po_no || "View PO"}
                  </a>
                ) : (
                  <span className="font-mono text-xs text-slate-600 font-medium">{d.po_no || "—"}</span>
                )}
              </td>
              )}
              {vis("po_date") && <td className="py-2.5 px-3 text-xs text-slate-500 whitespace-nowrap">{d.po_date ? new Date(d.po_date).toLocaleDateString("en-IN") : "—"}</td>}
              {vis("customer_name") && <td className="py-2.5 px-3 text-xs text-slate-700 font-medium whitespace-nowrap">{custName}</td>}
              {vis("sku") && <td className="py-2.5 px-3 text-xs text-slate-700 font-medium whitespace-nowrap">{d.sku || "—"}</td>}
              {vis("sku_quantity") && <td className="py-2.5 px-3 font-mono text-xs text-slate-700 text-right whitespace-nowrap">{d.sku_quantity != null ? Number(d.sku_quantity).toLocaleString("en-IN") : "—"}</td>}
              {vis("delivered_mt") && <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono text-[13px] font-bold text-purple-800">
                {d.delivered_mt != null ? Number(d.delivered_mt).toFixed(4) : "—"}
              </td>}
              {vis("invoice_amount") && <td className="py-2.5 px-3 font-mono text-[13px] text-emerald-700 text-right whitespace-nowrap font-bold">{d.invoice_amount ? \`₹\${Number(d.invoice_amount).toLocaleString("en-IN")}\` : "—"}</td>}
            </tr>
          )
        }

        if (detailsType === "pending") {
          return (
            <tr key={d.id} className="hover:bg-amber-50/30 transition-colors group">
              <td className="py-2.5 px-3 text-xs text-slate-400 font-bold whitespace-nowrap group-hover:text-amber-400 transition-colors">{idx + 1}</td>
              {vis("po_no") && (
              <td className="py-2.5 px-3 whitespace-nowrap">
                {d.po_upload_copy ? (
                  <a href={d.po_upload_copy} target="_blank" rel="noopener noreferrer" className="font-mono text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline">
                    {d.po_no || "View PO"}
                  </a>
                ) : (
                  <span className="font-mono text-xs text-slate-700 font-semibold">{d.po_no || "—"}</span>
                )}
              </td>
              )}
              {vis("po_date") && <td className="py-2.5 px-3 text-xs text-slate-500 whitespace-nowrap">{d.po_date ? new Date(d.po_date).toLocaleDateString("en-IN") : "—"}</td>}
              {vis("order_no") && (
              <td className="py-2.5 px-3 whitespace-nowrap">
                {d.order_no ? (
                  <Link href={\`/approval-of-order?search=\${d.order_no}\`} className="font-mono text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline">
                    {d.order_no}
                  </Link>
                ) : <span className="text-slate-300">—</span>}
              </td>
              )}
              {vis("do_date") && <td className="py-2.5 px-3 text-xs text-slate-500 whitespace-nowrap">{doDateFormatted}</td>}
              {vis("manual_sauda_no") && <td className="py-2.5 px-3 text-xs font-mono text-slate-600 whitespace-nowrap font-medium">{saudaNo}</td>}
              {vis("customer_name") && <td className="py-2.5 px-3 text-xs text-slate-700 font-medium whitespace-nowrap">{custName}</td>}
              {vis("sku") && <td className="py-2.5 px-3 text-xs text-slate-700 font-medium whitespace-nowrap">{d.sku || "—"}</td>}
              {vis("sku_quantity") && <td className="py-2.5 px-3 font-mono text-xs text-slate-600 text-right whitespace-nowrap">{d.sku_quantity != null ? Number(d.sku_quantity).toLocaleString("en-IN") : "—"}</td>}
              {vis("delivered_box") && <td className="py-2.5 px-3 font-mono text-xs text-emerald-600 text-right whitespace-nowrap font-medium">{d.delivered_box != null ? Number(d.delivered_box).toLocaleString("en-IN") : "0"}</td>}
              {vis("pending_box") && <td className="py-2.5 px-3 font-mono text-xs font-bold text-amber-600 text-right whitespace-nowrap">{d.pending_box != null ? Number(d.pending_box).toLocaleString("en-IN") : "0"}</td>}
              {vis("sku_weight_mt") && <td className="py-2.5 px-3 font-mono text-xs text-slate-700 text-right whitespace-nowrap font-medium">{d.sku_weight_mt != null ? Number(d.sku_weight_mt).toFixed(4) : "—"}</td>}
              {vis("delivered_mt") && <td className="py-2.5 px-3 font-mono text-[13px] font-semibold text-emerald-700 text-right whitespace-nowrap">{d.delivered_mt != null ? Number(d.delivered_mt).toFixed(4) : "0.0000"}</td>}
              {vis("pending_mt") && <td className="py-2.5 px-3 font-mono text-[13px] font-bold text-amber-700 text-right whitespace-nowrap">{d.pending_mt != null ? Number(d.pending_mt).toFixed(4) : "0.0000"}</td>}
            </tr>
          )
        }

        const mt = d.sku_weight_mt
        return (
          <tr key={d.id} className="hover:bg-blue-50/30 transition-colors group">
            <td className="py-2.5 px-3 text-xs text-slate-400 font-bold whitespace-nowrap group-hover:text-blue-400 transition-colors">{idx + 1}</td>
            {vis("raised_at") && <td className="py-2.5 px-3 text-xs text-slate-500 whitespace-nowrap">{d.raised_at ? new Date(d.raised_at).toLocaleDateString("en-IN") : "—"}</td>}
            {vis("order_no") && (
            <td className="py-2.5 px-3 whitespace-nowrap">
              {d.order_no ? (
                <Link
                  href={\`/approval-of-order?search=\${d.order_no}\`}
                  className="font-mono text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
                >
                  {d.order_no}
                </Link>
              ) : (
                <span className="text-slate-300">—</span>
              )}
            </td>
            )}
            {vis("po_no") && (
            <td className="py-2.5 px-3 whitespace-nowrap">
              {d.po_upload_copy ? (
                <a href={d.po_upload_copy} target="_blank" rel="noopener noreferrer" className="font-mono text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline">
                  {d.po_no || "View PO"}
                </a>
              ) : (
                <span className="font-mono text-xs text-slate-700 font-semibold">{d.po_no || "—"}</span>
              )}
            </td>
            )}
            {vis("po_date") && <td className="py-2.5 px-3 text-xs text-slate-500 whitespace-nowrap">{d.po_date ? new Date(d.po_date).toLocaleDateString("en-IN") : "—"}</td>}
            {vis("sku") && <td className="py-2.5 px-3 text-xs text-slate-700 font-medium whitespace-nowrap">{d.sku || "—"}</td>}
            {vis("sku_quantity") && <td className="py-2.5 px-3 font-mono text-xs text-slate-600 text-right whitespace-nowrap">{d.sku_quantity != null ? Number(d.sku_quantity).toLocaleString("en-IN") : "—"}</td>}
            {vis("sku_weight_mt") && <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono text-[13px] font-bold text-blue-800 min-w-[110px]">
              {mt != null ? Number(mt).toFixed(4) : "—"}
            </td>}
            {vis("sku_rate") && <td className="py-2.5 px-3 font-mono text-xs text-emerald-700 text-right whitespace-nowrap font-semibold">{d.sku_rate ? \`₹\${Number(d.sku_rate).toLocaleString("en-IN")}\` : "—"}</td>}
            {vis("order_category") && <td className="py-2.5 px-3 text-xs text-slate-500 whitespace-nowrap">{d.order_category || "—"}</td>}
            {vis("order_type") && <td className="py-2.5 px-3 text-xs text-slate-500 whitespace-nowrap">{d.order_type || "—"}</td>}
            {vis("actual_depot_name") && <td className="py-2.5 px-3 text-xs text-slate-500 whitespace-nowrap">{d.actual_depot_name || "—"}</td>}
            {vis("payment_terms") && <td className="py-2.5 px-3 text-xs text-slate-500 whitespace-nowrap">{formatPaymentTerms(d.payment_terms)}</td>}
            {vis("remarks") && <td className="py-2.5 px-3 text-xs text-slate-400 font-normal italic whitespace-nowrap max-w-[160px] truncate" title={d.remarks}>{d.remarks || "—"}</td>}
          </tr>
        )
      })
    )}
  </tbody>
</table>
`;

const newCode = code.substring(0, tableBlockStart) + replacementTable + code.substring(tableBlockEnd);
fs.writeFileSync(file, newCode);
console.log('Applied details body checks for cols');
