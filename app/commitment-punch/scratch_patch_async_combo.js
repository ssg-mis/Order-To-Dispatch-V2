const fs = require('fs');
const file = 'c:/Users/yuvra/Desktop/New Folder/shree shyam oil extractions/Order-To-Dispatch-V2/app/commitment-punch/page.tsx';
let code = fs.readFileSync(file, 'utf8');

// Main Table filter replace
const mainTableSelectStart = '<Select value={selectedCustomerFilter} onValueChange={setSelectedCustomerFilter}>';
const mainTableSelectEnd = '</Select>';
const mainTableSelectStartIdx = code.indexOf(mainTableSelectStart);
let mainTableSelectEndIdx = code.indexOf(mainTableSelectEnd, mainTableSelectStartIdx);

if (mainTableSelectStartIdx !== -1 && mainTableSelectEndIdx !== -1) {
  const replacement = `<AsyncCombobox
                fetchOptions={fetchCustomerOptions}
                value={selectedCustomerFilter === "ALL" ? "" : selectedCustomerFilter}
                onValueChange={(val) => setSelectedCustomerFilter(val || "ALL")}
                placeholder="All Customers"
                searchPlaceholder="Search master customers..."
                className="h-8 text-xs min-w-[140px] max-w-[200px] bg-white border-slate-200 shadow-2xs truncate"
              />`;
  code = code.substring(0, mainTableSelectStartIdx) + replacement + code.substring(mainTableSelectEndIdx + mainTableSelectEnd.length);
}

// Details popup filter replace
const detailsSelectStart = '<Select defaultValue="ALL">\n                  <SelectTrigger className="h-8 text-xs min-w-[140px] bg-white border-slate-200 shadow-2xs">';
const detailsSelectEndStr = '</SelectContent>\n                </Select>';
const detailsSelectStartIdx = code.indexOf('<Select defaultValue="ALL">', code.indexOf('Select defaultValue="ALL"') + 20); // The second select is customer
const nextDropdown = code.indexOf('<div className="hidden sm:block h-4 w-px bg-slate-200 mx-0.5" />', detailsSelectStartIdx);

if (detailsSelectStartIdx !== -1) {
  const replacement = `<AsyncCombobox
                  fetchOptions={fetchCustomerOptions}
                  value={detailsColumnFilters["customer_name"] || ""}
                  onValueChange={(val) => setDetailsColumnFilters(prev => ({...prev, "customer_name": val}))}
                  placeholder="All Customers"
                  searchPlaceholder="Search master customers..."
                  className="h-8 text-xs min-w-[140px] max-w-[200px] bg-white border-slate-200 shadow-2xs truncate"
                />

                `;
  code = code.substring(0, detailsSelectStartIdx) + replacement + code.substring(nextDropdown);
}

fs.writeFileSync(file, code);
console.log('Successfully updated customer filters to AsyncCombobox');
