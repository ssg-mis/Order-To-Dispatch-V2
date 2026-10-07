const fs = require('fs');
const file = 'c:/Users/yuvra/Desktop/New Folder/shree shyam oil extractions/Order-To-Dispatch-V2/app/commitment-punch/page.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Update filteredDetailsData to handle date ranges
const filterLogicStart = 'const filters = Object.entries(detailsColumnFilters).filter(([_, v]) => v.trim() !== \'\')';
const filterLogicEnd = 'return filters.every(([col, searchStr]) => getVal(col).includes(searchStr.toLowerCase()))\n    })\n  }, [detailsData, detailsColumnFilters, detailsRow])';

const newFilterLogic = `const filters = Object.entries(detailsColumnFilters).filter(([_, v]) => v.trim() !== '')
      if (filters.length === 0) return true
      
      return filters.every(([col, searchStr]) => {
        if (col.endsWith("_from")) {
          const baseCol = col.replace("_from", "")
          const val = d[baseCol]
          if (!val) return false
          const rowDate = new Date(val)
          const filterDate = new Date(searchStr)
          rowDate.setHours(0,0,0,0)
          filterDate.setHours(0,0,0,0)
          return rowDate >= filterDate
        }
        if (col.endsWith("_to")) {
          const baseCol = col.replace("_to", "")
          const val = d[baseCol]
          if (!val) return false
          const rowDate = new Date(val)
          const filterDate = new Date(searchStr)
          rowDate.setHours(0,0,0,0)
          filterDate.setHours(0,0,0,0)
          return rowDate <= filterDate
        }
        
        let val = d[col]
        if (col === "customer_name" && !val) val = detailsData.commitment?.customer?.customer_name || detailsRow?.party_name
        if (col === "manual_sauda_no" && !val) val = d.manual_sauda_no || detailsRow?.commitment_no
        if (col === "oil_type" && !val) val = d.oil_type || detailsRow?.oil_type
        if (col === "raised_at" || col === "do_date" || col === "invoice_date" || col === "po_date") {
           val = val ? new Date(val).toLocaleDateString("en-IN") : ""
        }
        return String(val || "").toLowerCase().includes(searchStr.toLowerCase())
      })
    })
  }, [detailsData, detailsColumnFilters, detailsRow])`;

const filterStartIdx = code.indexOf(filterLogicStart);
const filterEndIdx = code.indexOf('return filters.every', filterStartIdx);
const filterFinalEndIdx = code.indexOf('}, [detailsData, detailsColumnFilters, detailsRow])', filterEndIdx) + '}, [detailsData, detailsColumnFilters, detailsRow])'.length;

if (filterStartIdx !== -1 && filterFinalEndIdx !== -1) {
    code = code.substring(0, filterStartIdx) + newFilterLogic + code.substring(filterFinalEndIdx);
} else {
    console.log("Could not find filteredDetailsData");
}

// 2. Replace Input with Popover for date columns
// We can use regex to target the `.map(col => ...)` blocks and inject a conditional render for the input.
const inputBlockRegex = /<Input\s+placeholder="Search..."\s+value=\{detailsColumnFilters\[col\.id\] \|\| ""\}\s+onChange=\{\(e\) => setDetailsColumnFilters\(prev => \(\{ \.\.\.prev, \[col\.id\]: e\.target\.value \}\)\)\}\s+className=\{cn\([\s\S]*?text-left"\s*\)\}\s+\/>/g;

const newDateFilterJSX = `
                {["raised_at", "do_date", "invoice_date", "po_date"].includes(col.id) ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("h-7 text-[10px] w-full px-2 py-0 bg-slate-50 border-slate-200/70 font-medium", (detailsColumnFilters[\`\${col.id}_from\`] || detailsColumnFilters[\`\${col.id}_to\`]) ? "text-blue-600 bg-blue-50 border-blue-200" : "text-slate-400 justify-start hover:bg-slate-100")}>
                        {(detailsColumnFilters[\`\${col.id}_from\`] || detailsColumnFilters[\`\${col.id}_to\`]) ? 'Filtered' : 'Filter Date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-3 shadow-lg rounded-xl border-slate-200" align="start">
                      <div className="space-y-3">
                        <div className="space-y-1 text-xs">
                          <label className="font-semibold text-slate-700">From Date</label>
                          <Input type="date" className="h-8 text-xs bg-slate-50" value={detailsColumnFilters[\`\${col.id}_from\`] || ""} onChange={e => setDetailsColumnFilters(prev => ({...prev, [\`\${col.id}_from\`]: e.target.value}))} />
                        </div>
                        <div className="space-y-1 text-xs">
                          <label className="font-semibold text-slate-700">To Date</label>
                          <Input type="date" className="h-8 text-xs bg-slate-50" value={detailsColumnFilters[\`\${col.id}_to\`] || ""} onChange={e => setDetailsColumnFilters(prev => ({...prev, [\`\${col.id}_to\`]: e.target.value}))} />
                        </div>
                        <Button size="sm" className="w-full text-xs h-7 mt-1 font-semibold" variant="outline" onClick={() => {
                          setDetailsColumnFilters(prev => {
                            const next = {...prev}
                            delete next[\`\${col.id}_from\`]
                            delete next[\`\${col.id}_to\`]
                            return next
                          })
                        }}>Clear Filter</Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : (
                  $&
                )}
`;

code = code.replace(inputBlockRegex, newDateFilterJSX.trim());

fs.writeFileSync(file, code);
console.log('Successfully patched date filters');
