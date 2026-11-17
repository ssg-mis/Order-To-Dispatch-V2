const fs = require('fs');
const file = 'c:/Users/yuvra/Desktop/New Folder/shree shyam oil extractions/Order-To-Dispatch-V2/app/commitment-punch/page.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Restore the main table Customer Select
const asyncComboMainStr = `<AsyncCombobox
                fetchOptions={fetchCustomerOptions}
                value={selectedCustomerFilter === "ALL" ? "" : selectedCustomerFilter}
                onValueChange={(val) => setSelectedCustomerFilter(val || "ALL")}
                placeholder="All Customers"
                searchPlaceholder="Search master customers..."
                className="h-8 text-xs min-w-[140px] max-w-[200px] bg-white border-slate-200 shadow-2xs truncate"
              />`;

const originalMainTableSelect = `<Select value={selectedCustomerFilter} onValueChange={setSelectedCustomerFilter}>
                <SelectTrigger className="h-8 text-xs min-w-[130px] max-w-[180px] bg-white border-slate-200 shadow-2xs truncate">
                  <SelectValue placeholder="All Customers" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="ALL">All Customers</SelectItem>
                  {uniqueCustomers.map((cust: string) => (
                    <SelectItem key={cust} value={cust} className="text-xs truncate">{cust}</SelectItem>
                  ))}
                </SelectContent>
              </Select>`;

if (code.includes(asyncComboMainStr)) {
  code = code.replace(asyncComboMainStr, originalMainTableSelect);
}

// 2. Add useMemos for details unique arrays
if (!code.includes('uniqueDetailsCustomers')) {
  const detailsMemoInsertion = `  const uniqueDetailsCustomers = useMemo(() => {
    if (!detailsData?.details) return []
    const set = new Set<string>()
    detailsData.details.forEach((r: any) => {
      const cust = r.customer_name || detailsData.commitment?.customer?.customer_name || detailsRow?.party_name
      if (cust) set.add(cust)
    })
    return Array.from(set).sort()
  }, [detailsData, detailsRow])

  const uniqueDetailsOilTypes = useMemo(() => {
    if (!detailsData?.details) return []
    const set = new Set<string>()
    detailsData.details.forEach((r: any) => {
      const oil = r.oil_type || detailsRow?.oil_type
      if (oil) set.add(oil)
    })
    return Array.from(set).sort()
  }, [detailsData, detailsRow])

  const filteredDetailsData = useMemo(() => {`;
  code = code.replace('  const filteredDetailsData = useMemo(() => {', detailsMemoInsertion);
}

// 3. Revert and fix Details Popup Dropdowns (Oils and Customers)
const detailsOilDropdownStart = '{/* Oil Type Filter (Visual only for now since it\'s a single commitment) */}';
const detailsOilDropdownEnd = `placeholder="All Customers"
                  searchPlaceholder="Search master customers..."
                  className="h-8 text-xs min-w-[140px] max-w-[200px] bg-white border-slate-200 shadow-2xs truncate"
                />`;

const detailsOilDropdownStartIdx = code.indexOf(detailsOilDropdownStart);
const detailsOilDropdownEndIdx = code.indexOf(detailsOilDropdownEnd, detailsOilDropdownStartIdx);

if (detailsOilDropdownStartIdx !== -1 && detailsOilDropdownEndIdx !== -1) {
  const newDetailsDropdowns = `{/* Oil Type Filter */}
                <Select value={detailsColumnFilters["oil_type"] || "ALL"} onValueChange={val => setDetailsColumnFilters(prev => ({...prev, "oil_type": val === "ALL" ? "" : val}))}>
                  <SelectTrigger className="h-8 text-xs min-w-[115px] bg-white border-slate-200 shadow-2xs">
                    <SelectValue placeholder="All Oils" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Oils</SelectItem>
                    {uniqueDetailsOilTypes.map(oil => (
                      <SelectItem key={oil} value={oil}>{oil}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={detailsColumnFilters["customer_name"] || "ALL"} onValueChange={val => setDetailsColumnFilters(prev => ({...prev, "customer_name": val === "ALL" ? "" : val}))}>
                  <SelectTrigger className="h-8 text-xs min-w-[140px] max-w-[180px] bg-white border-slate-200 shadow-2xs truncate">
                    <SelectValue placeholder="All Customers" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    <SelectItem value="ALL">All Customers</SelectItem>
                    {uniqueDetailsCustomers.map(cust => (
                      <SelectItem key={cust} value={cust} className="text-xs truncate">{cust}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>`;
  
  code = code.substring(0, detailsOilDropdownStartIdx) + newDetailsDropdowns + code.substring(detailsOilDropdownEndIdx + detailsOilDropdownEnd.length);
}

fs.writeFileSync(file, code);
console.log('Successfully reverted dropdowns to extract from table data');
