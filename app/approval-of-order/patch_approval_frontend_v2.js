const fs = require('fs');
const file = 'c:/Users/yuvra/Desktop/New Folder/shree shyam oil extractions/Order-To-Dispatch-V2/app/approval-of-order/page.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. TableColumnFilter Import
if (!code.includes('TableColumnFilter')) {
    code = code.replace(
        'import { SortableTableHead } from "@/components/ui/sortable-table-head"',
        'import { SortableTableHead } from "@/components/ui/sortable-table-head"\nimport { TableColumnFilter } from "@/components/ui/table-column-filter"'
    );
}

// 2. State
const stateRegex = /const \[filterValues, setFilterValues\] = useState\(\{[\s\S]*?\}\)/;
if (!code.includes('const [columnFilters, setColumnFilters]')) {
    code = code.replace(stateRegex, match => match + '\n  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})\n  const [columnDateRanges, setColumnDateRanges] = useState<Record<string, { from: Date; to: Date } | undefined>>({})');
}

// 3. API calls
const pendingRegex = /const response = await approvalApi\.getPending\(\{[\s\S]*?end_date: filterValues\.endDate,\s*\}\)/g;
code = code.replace(pendingRegex, match => {
  return `const colFiltersFormatted = Object.fromEntries(Object.entries(columnFilters).filter(([_,v]) => !!v).map(([k,v]) => ['col_'+k, v]));\n      ` + match.replace('}', '...colFiltersFormatted\n      }');
});

// 4. Query Keys
code = code.replace(/queryKey: \["approval-pending", filterValues, pendingPage\],/g, 'queryKey: ["approval-pending", filterValues, pendingPage, columnFilters],');
code = code.replace(/queryKey: \["approval-history", filterValues, historyPage\],/g, 'queryKey: ["approval-history", filterValues, historyPage, columnFilters],');

// 5. TableHeader Replacement
const thRegex = /<ColumnDragProvider[\s\S]*?<\/ColumnDragProvider>/;
const thNew = `<ColumnDragProvider
                columnIds={orderedVisibleCols.map((c) => c.id)}
                onReorder={handleColumnReorder}
                disabled={!isAdmin && !isFeatureEnabled("can_reorder_columns")}
              >
                {orderedVisibleCols.map((col) => (
                  <SortableTableHead
                    key={col.id}
                    id={col.id}
                    className="whitespace-nowrap align-top px-2"
                  >
                    <div className="flex flex-col gap-2 w-full py-1 min-w-[120px]">
                      <div className="flex-1 w-full" onClick={(e) => e.stopPropagation()}>
                        <TableColumnFilter
                          type={col.type}
                          value={columnFilters[col.id]}
                          onChange={(val) => setColumnFilters(prev => ({...prev, [col.id]: val}))}
                          dateRange={columnDateRanges[col.id]}
                          onDateRangeChange={(range) => setColumnDateRanges(prev => ({...prev, [col.id]: range}))}
                        />
                      </div>
                      <div
                        className="flex items-center gap-1 cursor-pointer select-none hover:text-blue-600 transition-colors w-full justify-start"
                        onClick={() => handleSort(col.id)}
                      >
                        <span>{col.label}</span>
                        <SortIcon field={col.id} />
                      </div>
                    </div>
                  </SortableTableHead>
                ))}
              </ColumnDragProvider>`;
code = code.replace(thRegex, thNew);

// 6. Totals Row
const tbRegex = /<TableBody>\s*\{isLoading/m;
const tbNew = `<TableBody>
            {displayRows.length > 0 && (
              <TableRow className="bg-slate-100/90 border-b-2 border-slate-300 font-bold text-xs text-slate-800 hover:bg-slate-100/90 shadow-sm z-10">
                {orderedVisibleCols.map((col, idx) => {
                  let cellContent: any = "";
                  let className = "text-center";
                  if (idx === 0) {
                     cellContent = \`TOTAL (\${displayRows.length})\`;
                     className = "font-black text-slate-900 uppercase tracking-wider text-[11px] text-center";
                  } else if (TOTAL_COLUMN_IDS.has(col.id)) {
                     cellContent = formatCell(col.id, totals[col.id]);
                     if (col.id === 'total_qty_box') className = "font-mono font-black text-emerald-700 text-center";
                     else if (col.id === 'total_qty_kg') className = "font-mono font-black text-blue-700 text-center";
                     else if (col.id === 'total_order_amount') className = "font-mono font-black text-purple-700 text-center";
                  }
                  return (
                    <TableCell key={\`total-\${col.id}\`} className={className}>
                      {cellContent}
                    </TableCell>
                  );
                })}
              </TableRow>
            )}
            {isLoading`;
code = code.replace(tbRegex, tbNew);

// 7. Remove Footer
const tfRegex = /\{displayRows\.length > 0 && \(\s*<TableFooter[\s\S]*?<\/TableFooter>\s*\)\s*\}/;
code = code.replace(tfRegex, '');

fs.writeFileSync(file, code);
console.log('Successfully patched Approval of Order via regex');
