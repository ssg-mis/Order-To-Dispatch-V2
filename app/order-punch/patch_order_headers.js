const fs = require('fs');
const file = 'c:/Users/yuvra/Desktop/New Folder/shree shyam oil extractions/Order-To-Dispatch-V2/app/order-punch/page.tsx';
let code = fs.readFileSync(file, 'utf8');

const oldHeader = `                    {orderedVisibleCols.map((col) => (
                      <SortableTableHead
                        key={col.id}
                        id={col.id}
                        className={cn("whitespace-nowrap", PAGE_COL_WIDTH[col.id], NUMBER_COLS.has(col.id) && "text-right")}
                      >
                        <div
                          className={cn(
                            "flex items-center gap-1 cursor-pointer select-none hover:text-blue-600 transition-colors w-full",
                            NUMBER_COLS.has(col.id) ? "justify-end" : "justify-start"
                          )}
                          onClick={() => handleSort(col.id)}
                        >
                          <span>{col.label}</span>
                          {sort?.field === col.id ? (
                            <span className="text-blue-600 text-[10px]">{sort.dir === "asc" ? "▲" : "▼"}</span>
                          ) : null}
                        </div>
                      </SortableTableHead>
                    ))}`;

const newHeader = `                    {orderedVisibleCols.map((col) => (
                      <SortableTableHead
                        key={col.id}
                        id={col.id}
                        className={cn("whitespace-nowrap align-top", PAGE_COL_WIDTH[col.id])}
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
                          <div
                            className={cn(
                              "flex items-center gap-1 cursor-pointer select-none hover:text-blue-600 transition-colors w-full",
                              NUMBER_COLS.has(col.id) ? "justify-end" : "justify-start"
                            )}
                            onClick={() => handleSort(col.id)}
                          >
                            <span>{col.label}</span>
                            {sort?.field === col.id ? (
                              <span className="text-blue-600 text-[10px]">{sort.dir === "asc" ? "▲" : "▼"}</span>
                            ) : null}
                          </div>
                        </div>
                      </SortableTableHead>
                    ))}`;

code = code.replace(oldHeader, newHeader);

fs.writeFileSync(file, code);
console.log('Order Punch headers patched properly');
