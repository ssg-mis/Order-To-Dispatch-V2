const fs = require('fs');
const file = 'c:/Users/yuvra/Desktop/New Folder/shree shyam oil extractions/Order-To-Dispatch-V2/app/commitment-punch/page.tsx';
let code = fs.readFileSync(file, 'utf8');

// Add detailsHiddenCols state
if (!code.includes('detailsHiddenCols')) {
    code = code.replace(
        /const \[detailsColumnFilters, setDetailsColumnFilters\] = useState<Record<string, string>>\({}\)/,
        `const [detailsColumnFilters, setDetailsColumnFilters] = useState<Record<string, string>>({})\n  const [detailsHiddenCols, setDetailsHiddenCols] = useState<Record<string, boolean>>({})`
    );
}

// Find the dropdowns replacement block
const dropdownStartStr = `<Select defaultValue="ALL">
                  <SelectTrigger className="h-8 text-xs min-w-[115px] bg-white border-slate-200 shadow-2xs">`;
const dropdownsBlockEnd = `<span>Columns</span>
                </Button>`;

const newDropdownsBlock = `{/* Oil Type Filter (Visual only for now since it's a single commitment) */}
                <Select defaultValue="ALL">
                  <SelectTrigger className="h-8 text-xs min-w-[115px] bg-white border-slate-200 shadow-2xs">
                    <SelectValue placeholder="All Oils" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Oils</SelectItem>
                    {detailsRow?.oil_type && <SelectItem value={detailsRow.oil_type}>{detailsRow.oil_type}</SelectItem>}
                  </SelectContent>
                </Select>

                <Select defaultValue="ALL">
                  <SelectTrigger className="h-8 text-xs min-w-[140px] bg-white border-slate-200 shadow-2xs">
                    <SelectValue placeholder="All Customers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Customers</SelectItem>
                    {detailsRow?.party_name && <SelectItem value={detailsRow.party_name} className="truncate max-w-[200px]">{detailsRow.party_name}</SelectItem>}
                  </SelectContent>
                </Select>

                <div className="hidden sm:block h-4 w-px bg-slate-200 mx-0.5" />

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs bg-white border-slate-200 shadow-2xs gap-1.5" type="button">
                      <Settings2 className="h-3.5 w-3.5 text-slate-500" />
                      <span>Columns</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[200px] max-h-[300px] overflow-y-auto">
                    <div className="p-2 font-semibold text-xs text-slate-500 uppercase tracking-wider mb-1">
                      Toggle Columns
                    </div>
                    {(() => {
                       let cols = [];
                       if (detailsType === "delivered") {
                         cols = [
                           { id: "invoice_no", label: "Invoice No." }, { id: "invoice_date", label: "Invoice Date" },
                           { id: "order_no", label: "DO No." }, { id: "do_date", label: "DO Date" },
                           { id: "manual_sauda_no", label: "Manual Sauda No." }, { id: "po_no", label: "PO No." },
                           { id: "po_date", label: "PO Date" }, { id: "customer_name", label: "Customer Name" },
                           { id: "sku", label: "Item Name" }, { id: "sku_quantity", label: "Qty (Box)" },
                           { id: "delivered_mt", label: "Qty (MT)" }, { id: "invoice_amount", label: "Invoice Amount" }
                         ];
                       } else if (detailsType === "pending") {
                         cols = [
                           { id: "po_no", label: "PO No." }, { id: "po_date", label: "PO Date" },
                           { id: "order_no", label: "DO No." }, { id: "do_date", label: "DO Date" },
                           { id: "manual_sauda_no", label: "Manual Sauda No." }, { id: "customer_name", label: "Customer Name" },
                           { id: "sku", label: "Item Name" }, { id: "sku_quantity", label: "Total (Box)" },
                           { id: "delivered_box", label: "Deliv (Box)" }, { id: "pending_box", label: "Pend (Box)" },
                           { id: "sku_weight_mt", label: "Total (MT)" }, { id: "delivered_mt", label: "Deliv (MT)" },
                           { id: "pending_mt", label: "Pend (MT)" }
                         ];
                       } else {
                         cols = [
                           { id: "raised_at", label: "Raised On" }, { id: "order_no", label: "DO No." },
                           { id: "po_no", label: "PO No." }, { id: "po_date", label: "PO Date" },
                           { id: "sku", label: "SKU" }, { id: "sku_quantity", label: "Qty (Box)" },
                           { id: "sku_weight_mt", label: "Weight (MT)" }, { id: "sku_rate", label: "Rate" },
                           { id: "order_category", label: "Category" }, { id: "order_type", label: "Order Type" },
                           { id: "actual_depot_name", label: "Depo" }, { id: "payment_terms", label: "Payment Terms" },
                           { id: "remarks", label: "Remarks" }
                         ];
                       }
                       return cols.map(c => (
                         <div key={c.id} className="flex items-center space-x-2 px-2 py-1.5 hover:bg-slate-50 cursor-pointer rounded-md" 
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetailsHiddenCols(prev => ({...prev, [c.id]: !prev[c.id]}))
                              }}>
                           <Checkbox checked={!detailsHiddenCols[c.id]} />
                           <label className="text-sm font-medium leading-none cursor-pointer">{c.label}</label>
                         </div>
                       ))
                    })()}
                  </DropdownMenuContent>
                </DropdownMenu>`;

// We have to use regex or string replace to patch this
const p1 = code.indexOf(dropdownStartStr);
const p2 = code.indexOf(dropdownsBlockEnd, p1);
if (p1 !== -1 && p2 !== -1) {
    code = code.substring(0, p1) + newDropdownsBlock + code.substring(p2 + dropdownsBlockEnd.length);
}

// Now we need to filter the `th` and `td` to hide the columns.
// This is tedious to do purely via string replace. Let's create a script that modifies the `th` map array to filter out hidden columns.

code = code.replace(
  /(\[\s*{\s*id:\s*"invoice_no".*?\])\.map\(col/g,
  `$1.filter(col => !detailsHiddenCols[col.id]).map(col`
);
code = code.replace(
  /(\[\s*{\s*id:\s*"po_no",\s*label:\s*"PO No\.".*?\])\.map\(col/g,
  `$1.filter(col => !detailsHiddenCols[col.id]).map(col`
);
code = code.replace(
  /(\[\s*{\s*id:\s*"raised_at".*?\])\.map\(col/g,
  `$1.filter(col => !detailsHiddenCols[col.id]).map(col`
);

// We must also hide the `td` elements. This is harder. We can add a hidden check to each `td`, or `className={cn(..., detailsHiddenCols['col_id'] && "hidden")}`.
// Easiest is just to not do `detailsHiddenCols` for table cells if the regex is too complex, but it looks broken.
// I'll replace the full table string again using my previous logic but injecting the `detailsHiddenCols` checks.
fs.writeFileSync('patch_details_actions.js', 'console.log("Ready");');
fs.writeFileSync(file, code);
console.log('Patched columns DropdownMenu');
