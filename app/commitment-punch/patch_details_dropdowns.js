const fs = require('fs');
const file = 'c:/Users/yuvra/Desktop/New Folder/shree shyam oil extractions/Order-To-Dispatch-V2/app/commitment-punch/page.tsx';
let code = fs.readFileSync(file, 'utf8');

const startTag = '{/* View Selector Tabs (Main Table Style) */}';
const endTag = '</div>\n            </div>';
const startIdx = code.indexOf(startTag);
const endIdx = code.indexOf(endTag, startIdx) + endTag.length;

const replacement = `{/* View Selector Tabs (Main Table Style) */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 p-2 rounded-lg bg-slate-50/90 border border-slate-200/80 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center p-0.5 bg-white border border-slate-200 rounded-md shadow-2xs">
                  {[
                    { id: "pending", label: "PO Pending" },
                    { id: "raised", label: "PO Raised" },
                    { id: "delivered", label: "Delivered" },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setDetailsType(tab.id as any);
                        setDetailsColumnFilters({});
                      }}
                      className={cn(
                        "px-3 py-1.5 text-xs font-semibold rounded transition-all whitespace-nowrap outline-none",
                        detailsType === tab.id
                          ? "bg-blue-600 text-white shadow-xs font-bold"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="hidden sm:block h-4 w-px bg-slate-200 mx-0.5" />

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

                <Button variant="outline" size="sm" className="h-8 text-xs bg-white border-slate-200 shadow-2xs gap-1.5" type="button">
                  <Settings2 className="h-3.5 w-3.5 text-slate-500" />
                  <span>Columns</span>
                </Button>
              </div>
            </div>`;

if (startIdx !== -1) {
    code = code.substring(0, startIdx) + replacement + code.substring(endIdx);
    fs.writeFileSync(file, code);
    console.log('Successfully patched dropdowns');
} else {
    console.log('Could not find anchor');
}
