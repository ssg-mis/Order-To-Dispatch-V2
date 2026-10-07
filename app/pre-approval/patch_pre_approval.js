const fs = require('fs');
const file = 'c:/Users/yuvra/Desktop/New Folder/shree shyam oil extractions/Order-To-Dispatch-V2/app/pre-approval/page.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add imports
if (!code.includes('TableColumnFilter')) {
    code = code.replace(
        'import { SortableTableHead } from "@/components/ui/sortable-table-head"',
        'import { SortableTableHead } from "@/components/ui/sortable-table-head"\nimport { TableColumnFilter } from "@/components/ui/table-column-filter"'
    );
}

// 2. Add columnFilters state
const stateAnchor = 'const [expandedOrders, setExpandedOrders] = useState<string[]>([])';
if (code.includes(stateAnchor) && !code.includes('const [columnFilters')) {
    code = code.replace(stateAnchor, stateAnchor + `\n  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})`);
}

// 3. Update getPending call
const getPendingAnchor = `const response = await preApprovalApi.getPending({
        page: pendingPage,
        limit: limit,
        order_no: filterValues.search,
        customer_name: filterValues.partyName !== "all" ? filterValues.partyName : undefined,
        start_date: filterValues.startDate,
        end_date: filterValues.endDate,
      });`;
const getPendingNew = `
      const colFiltersFormatted = Object.fromEntries(Object.entries(columnFilters).filter(([_,v]) => !!v).map(([k,v]) => ['col_'+k, v]));
      const response = await preApprovalApi.getPending({
        page: pendingPage,
        limit: limit,
        order_no: filterValues.search,
        customer_name: filterValues.partyName !== "all" ? filterValues.partyName : undefined,
        start_date: filterValues.startDate,
        end_date: filterValues.endDate,
        ...colFiltersFormatted
      });`;
if (code.includes(getPendingAnchor)) {
    code = code.replace(getPendingAnchor, getPendingNew);
}

// 4. Update query key
const queryKeyAnchor = `queryKey: ["pendingOrders", filterValues, pendingPage],`;
const queryKeyNew = `queryKey: ["pendingOrders", filterValues, pendingPage, columnFilters],`;
if (code.includes(queryKeyAnchor)) {
    code = code.replace(queryKeyAnchor, queryKeyNew);
}

// 5. Update TableHeader
const thAnchor = `<ColumnDragProvider columnIds={orderedVisibleCols.map(c => c.id)} onReorder={handleColumnReorder} disabled={!isAdmin && !isFeatureEnabled('can_reorder_columns')}>
                      {orderedVisibleCols.map((col) => (
                        <SortableTableHead key={col.id} id={col.id} className="whitespace-nowrap text-center cursor-pointer select-none hover:text-blue-600 transition-colors" onClick={() => handlePendingSort(col.id)}>
                          {col.label}<PendingSortIcon field={col.id} />
                        </SortableTableHead>
                      ))}
                    </ColumnDragProvider>`;

const thNew = `<ColumnDragProvider columnIds={orderedVisibleCols.map(c => c.id)} onReorder={handleColumnReorder} disabled={!isAdmin && !isFeatureEnabled('can_reorder_columns')}>
                      {orderedVisibleCols.map((col) => (
                        <SortableTableHead key={col.id} id={col.id} className="whitespace-nowrap align-top">
                          <div className="flex flex-col gap-2 w-full py-1 min-w-[120px]">
                            <div className="flex-1 w-full" onClick={(e) => e.stopPropagation()}>
                              <TableColumnFilter
                                type={col.id.toLowerCase().includes('date') ? 'date' : 'text'}
                                value={columnFilters[col.id]}
                                onChange={(val) => setColumnFilters(prev => ({...prev, [col.id]: val}))}
                              />
                            </div>
                            <div className="flex items-center justify-center gap-1 cursor-pointer select-none hover:text-blue-600 transition-colors" onClick={() => handlePendingSort(col.id)}>
                              <span>{col.label}</span>
                              <PendingSortIcon field={col.id} />
                            </div>
                          </div>
                        </SortableTableHead>
                      ))}
                    </ColumnDragProvider>`;
if (code.includes(thAnchor)) {
    code = code.replace(thAnchor, thNew);
}

fs.writeFileSync(file, code);
console.log('Pre Approval frontend patched');
