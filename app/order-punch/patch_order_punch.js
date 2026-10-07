const fs = require('fs');
const file = 'c:/Users/yuvra/Desktop/New Folder/shree shyam oil extractions/Order-To-Dispatch-V2/app/order-punch/page.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add Imports
if (!code.includes('TableColumnFilter')) {
    code = code.replace(
        'import { formatDate, formatDateTime, formatAmount, formatNumber } from "@/lib/order-punch-format"',
        'import { formatDate, formatDateTime, formatAmount, formatNumber } from "@/lib/order-punch-format"\nimport { TableColumnFilter, filterRowByColumnDates } from "@/components/ui/table-column-filter"'
    );
}
if (!code.includes('Badge')) {
    code = code.replace(
        'import { Button } from "@/components/ui/button"',
        'import { Button } from "@/components/ui/button"\nimport { Badge } from "@/components/ui/badge"'
    );
}

// 2. Add State for Column Filters
const stateAnchor = 'const [customerFilter, setCustomerFilter] = useState("ALL")';
if (code.includes(stateAnchor) && !code.includes('const [columnFilters')) {
    code = code.replace(stateAnchor, stateAnchor + `\n  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})\n  const [columnDateRanges, setColumnDateRanges] = useState<Record<string, {from?: string, to?: string}>>({})`);
}

// 3. Update filteredRows
const filterStart = '  const filteredRows = useMemo(() => {\n    return rows.filter((r) => {\n      if (depotFilter !== "ALL" && r.depot_name !== depotFilter) return false\n      if (customerFilter !== "ALL" && r.customer_name !== customerFilter) return false\n      return true\n    })\n  }, [rows, depotFilter, customerFilter])';
const newFilter = `  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (depotFilter !== "ALL" && r.depot_name !== depotFilter) return false
      if (customerFilter !== "ALL" && r.customer_name !== customerFilter) return false
      
      if (searchQuery) {
        const sq = searchQuery.toLowerCase()
        const matches = (r.order_no && String(r.order_no).toLowerCase().includes(sq)) ||
                        (r.manual_sauda_no && String(r.manual_sauda_no).toLowerCase().includes(sq)) ||
                        (r.customer_name && String(r.customer_name).toLowerCase().includes(sq))
        if (!matches) return false
      }

      for (const col of PAGE_COLUMNS) {
        if (col.type === "date" || col.type === "datetime") {
           if (!filterRowByColumnDates(r[col.id], columnDateRanges[col.id])) return false;
        } else {
           const textFilter = columnFilters[col.id];
           if (textFilter && textFilter.trim()) {
               if (!String(r[col.id] || "").toLowerCase().includes(textFilter.toLowerCase())) return false;
           }
        }
      }

      return true
    })
  }, [rows, depotFilter, customerFilter, searchQuery, columnFilters, columnDateRanges])
  
  const columnTotals = useMemo(() => {
    return sortedRows.reduce(
      (acc, r) => {
        acc.total_qty_box += Number(r.total_qty_box || 0)
        acc.total_qty_kgs += Number(r.total_qty_kgs || 0)
        acc.total_order_amount += Number(r.total_order_amount || 0)
        return acc
      },
      { total_qty_box: 0, total_qty_kgs: 0, total_order_amount: 0 }
    )
  }, [sortedRows])
  `;

if (code.includes(filterStart)) {
    code = code.replace(filterStart, newFilter);
}

// 4. Update TableHead structure
const thStartRegex = /<SortableTableHead\s+key=\{col\.id\}\s+colId=\{col\.id\}\s+currentSort=\{sort\}\s+onSort=\{handleSort\}\s+className=\{col\.width\}\s+>\s+<span className="truncate">\{col\.label\}<\/span>\s+<\/SortableTableHead>/g;
const newTh = `<SortableTableHead
                      key={col.id}
                      colId={col.id}
                      currentSort={sort}
                      onSort={handleSort}
                      className={cn(col.width, "align-top")}
                    >
                      <div className="flex flex-col gap-2 w-full py-1">
                        <div className="flex-1 w-full" onClick={(e) => e.stopPropagation()}>
                          <TableColumnFilter
                            type={col.type}
                            value={columnFilters[col.id]}
                            onChange={(val) => setColumnFilters(prev => ({...prev, [col.id]: val}))}
                            dateRange={columnDateRanges[col.id]}
                            onDateRangeChange={(range) => setColumnDateRanges(prev => ({...prev, [col.id]: range}))}
                          />
                        </div>
                        <span className="truncate">{col.label}</span>
                      </div>
                    </SortableTableHead>`;
code = code.replace(thStartRegex, newTh);

// 5. Update active filters count
const actFilterOld = 'const activeFiltersCount = (searchQuery ? 1 : 0) + (doDateFilter ? 1 : 0) + (depotFilter !== "ALL" ? 1 : 0) + (customerFilter !== "ALL" ? 1 : 0)';
const actFilterNew = `const activeFiltersCount = (searchQuery ? 1 : 0) + (doDateFilter ? 1 : 0) + (depotFilter !== "ALL" ? 1 : 0) + (customerFilter !== "ALL" ? 1 : 0) + Object.values(columnFilters).filter(v => v).length + Object.values(columnDateRanges).filter(v => v.from || v.to).length`;
if (code.includes(actFilterOld)) {
    code = code.replace(actFilterOld, actFilterNew);
}
const clearFilterOld = `  const clearAllFilters = () => {
    setSearchQuery("")
    setDoDateFilter("")
    setDepotFilter("ALL")
    setCustomerFilter("ALL")
  }`;
const clearFilterNew = `  const clearAllFilters = () => {
    setSearchQuery("")
    setDoDateFilter("")
    setDepotFilter("ALL")
    setCustomerFilter("ALL")
    setColumnFilters({})
    setColumnDateRanges({})
  }`;
if (code.includes(clearFilterOld)) {
    code = code.replace(clearFilterOld, clearFilterNew);
}

// 6. Inject the Totals row in TableBody
const tbodyAnchor = '<TableBody>';
const totalsRowJSX = `
                {sortedRows.length > 0 && (
                  <TableRow className="bg-slate-100/90 border-b-2 border-slate-300 font-bold text-xs text-slate-800 hover:bg-slate-100/90 shadow-sm z-10">
                    {orderedVisibleCols.map(col => {
                      const isNumber = NUMBER_COLS.has(col.id)
                      const alignClass = cn(col.width, isNumber && "text-right font-mono")
                      if (col.id === "do_date") return <TableCell key={\`total-\${col.id}\`} className={cn("font-black text-slate-900 uppercase tracking-wider text-[11px]", alignClass)}>Total ({sortedRows.length})</TableCell>
                      if (col.id === "total_qty_box") return <TableCell key={\`total-\${col.id}\`} className={alignClass}>{formatNumber(columnTotals.total_qty_box)}</TableCell>
                      if (col.id === "total_qty_kgs") return <TableCell key={\`total-\${col.id}\`} className={alignClass}>{formatNumber(columnTotals.total_qty_kgs)}</TableCell>
                      if (col.id === "total_order_amount") return <TableCell key={\`total-\${col.id}\`} className={alignClass}>{formatAmount(columnTotals.total_order_amount)}</TableCell>
                      return <TableCell key={\`total-\${col.id}\`} className={alignClass}></TableCell>
                    })}
                    <TableCell className="w-10 px-2"></TableCell>
                  </TableRow>
                )}`;
if (code.includes(tbodyAnchor)) {
    code = code.replace(tbodyAnchor, tbodyAnchor + totalsRowJSX);
}

// 7. Inject top Badges row 
const filterRowAnchor = '{/* ── DO List Table ── */}';
if (code.includes(filterRowAnchor) && !code.includes('Active:')) {
    const badgesJSX = `
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-[11px] font-semibold text-slate-400 mr-1">Active:</span>
          {depotFilter !== "ALL" && (
            <Badge variant="secondary" className="gap-1 text-[10px] font-medium bg-blue-50 text-blue-700 border-blue-200 pl-2 pr-1 py-0.5">
              Depot: {depotFilter}
              <button onClick={() => setDepotFilter("ALL")} className="hover:text-blue-900 cursor-pointer p-0.5 rounded-full hover:bg-blue-100"><X className="h-2.5 w-2.5" /></button>
            </Badge>
          )}
          {customerFilter !== "ALL" && (
            <Badge variant="secondary" className="gap-1 text-[10px] font-medium bg-blue-50 text-blue-700 border-blue-200 pl-2 pr-1 py-0.5">
              Customer: {customerFilter}
              <button onClick={() => setCustomerFilter("ALL")} className="hover:text-blue-900 cursor-pointer p-0.5 rounded-full hover:bg-blue-100"><X className="h-2.5 w-2.5" /></button>
            </Badge>
          )}
          {searchQuery && (
            <Badge variant="secondary" className="gap-1 text-[10px] font-medium bg-blue-50 text-blue-700 border-blue-200 pl-2 pr-1 py-0.5">
              Search: {searchQuery}
              <button onClick={() => setSearchQuery("")} className="hover:text-blue-900 cursor-pointer p-0.5 rounded-full hover:bg-blue-100"><X className="h-2.5 w-2.5" /></button>
            </Badge>
          )}
          <Button variant="ghost" size="sm" className="h-7 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 px-2 rounded transition-colors gap-1 cursor-pointer" onClick={clearAllFilters}>
            <X className="h-3 w-3" /> Reset ({activeFiltersCount})
          </Button>
        </div>
      )}
      `;
    code = code.replace(filterRowAnchor, badgesJSX + filterRowAnchor);
}

fs.writeFileSync(file, code);
console.log('Order Punch patched successfully');
