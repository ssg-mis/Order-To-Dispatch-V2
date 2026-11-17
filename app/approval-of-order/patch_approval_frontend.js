const fs = require('fs');
const file = 'c:/Users/yuvra/Desktop/New Folder/shree shyam oil extractions/Order-To-Dispatch-V2/app/approval-of-order/page.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add TableColumnFilter import
if (!code.includes('TableColumnFilter')) {
    code = code.replace(
        'import { SortableTableHead } from "@/components/ui/sortable-table-head"',
        'import { SortableTableHead } from "@/components/ui/sortable-table-head"\nimport { TableColumnFilter } from "@/components/ui/table-column-filter"'
    );
}

// 2. Add columnFilters and columnDateRanges state
const stateAnchor = 'const [filterOptions, setFilterOptions] = useState<{ customerNames: string[] }>({ customerNames: [] })';
if (code.includes(stateAnchor) && !code.includes('const [columnFilters')) {
    code = code.replace(stateAnchor, stateAnchor + `\n  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})\n  const [columnDateRanges, setColumnDateRanges] = useState<Record<string, { from: Date; to: Date } | undefined>>({})`);
}

// 3. Update getPending call
const getPendingAnchor = `const response = await approvalApi.getPending({
        page: pendingPage,
        limit,
        search: filterValues.search,
        customer_name: filterValues.partyName === "all" ? undefined : filterValues.partyName,
        start_date: filterValues.startDate,
        end_date: filterValues.endDate,
      })`;
const getPendingNew = `
      const colFiltersFormatted = Object.fromEntries(Object.entries(columnFilters).filter(([_,v]) => !!v).map(([k,v]) => ['col_'+k, v]));
      const response = await approvalApi.getPending({
        page: pendingPage,
        limit,
        search: filterValues.search,
        customer_name: filterValues.partyName === "all" ? undefined : filterValues.partyName,
        start_date: filterValues.startDate,
        end_date: filterValues.endDate,
        ...colFiltersFormatted
      })`;
if (code.includes(getPendingAnchor)) {
    code = code.replace(getPendingAnchor, getPendingNew);
}

// 4. Update query keys
const queryKeyPendingAnchor = `queryKey: ["approval-pending", filterValues, pendingPage],`;
const queryKeyPendingNew = `queryKey: ["approval-pending", filterValues, pendingPage, columnFilters],`;
if (code.includes(queryKeyPendingAnchor)) {
    code = code.replace(queryKeyPendingAnchor, queryKeyPendingNew);
}

// 5. Replace TableHeader
const thAnchor = `<ColumnDragProvider
                columnIds={orderedVisibleCols.map((c) => c.id)}
                onReorder={handleColumnReorder}
                disabled={!isAdmin && !isFeatureEnabled("can_reorder_columns")}
              >
                {orderedVisibleCols.map((col) => (
                  <SortableTableHead
                    key={col.id}
                    id={col.id}
                    className="whitespace-nowrap text-center cursor-pointer select-none hover:text-blue-600 transition-colors"
                    onClick={() => handleSort(col.id)}
                  >
                    {col.label}
                    <SortIcon field={col.id} />
                    <ColumnFilterPopover
                      columnLabel={col.label}
                      values={distinctValuesByColumn[col.id] || []}
                      searchValue={columnSearch[col.id] || ""}
                      onSearchChange={(v) => setColumnSearch((prev) => ({ ...prev, [col.id]: v }))}
                      selectedValues={columnFilterValues[col.id] ?? null}
                      onSelectedValuesChange={(v) => setColumnFilterValues((prev) => ({ ...prev, [col.id]: v }))}
                    />
                  </SortableTableHead>
                ))}
              </ColumnDragProvider>`;

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
if (code.includes(thAnchor)) {
    code = code.replace(thAnchor, thNew);
}

// 6. Inject top Totals Row and remove bottom Footer
const tbAnchor = `<TableBody>
            {isLoading && currentOrders.length === 0 ? (`;
const tbNew = `<TableBody>
            {displayRows.length > 0 && (
              <TableRow className="bg-slate-100/90 border-b-2 border-slate-300 font-bold text-xs text-slate-800 hover:bg-slate-100/90 shadow-sm z-10">
                {orderedVisibleCols.map((col, idx) => {
                  let cellContent = "";
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
            {isLoading && currentOrders.length === 0 ? (`;

if (code.includes(tbAnchor)) {
    code = code.replace(tbAnchor, tbNew);
}

// Remove TableFooter
const tfOld = `{displayRows.length > 0 && (
            <TableFooter className="sticky bottom-0 z-10 bg-slate-50 shadow-[0_-1px_0_0_theme(colors.slate.200)]">
              <TableRow className="hover:bg-transparent">
                {orderedVisibleCols.map((col, idx) => (
                  <TableCell key={col.id} className="whitespace-nowrap text-center text-xs font-black text-slate-700">
                    {idx === 0 ? "Total" : TOTAL_COLUMN_IDS.has(col.id) ? formatCell(col.id, totals[col.id]) : ""}
                  </TableCell>
                ))}
              </TableRow>
            </TableFooter>
          )}`;
if (code.includes(tfOld)) {
    code = code.replace(tfOld, "");
}


fs.writeFileSync(file, code);
console.log('Approval of Order frontend patched');
