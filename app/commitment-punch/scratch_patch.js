const fs = require('fs');
const file = 'c:/Users/yuvra/Desktop/New Folder/shree shyam oil extractions/Order-To-Dispatch-V2/app/commitment-punch/page.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add state for details filtering
if (!code.includes('detailsColumnFilters')) {
    code = code.replace(
        /const \[detailsType, setDetailsType\] = useState<\s*"raised"\s*\|\s*"delivered"\s*\|\s*"pending"\s*>\("raised"\)/,
        `const [detailsType, setDetailsType] = useState<"raised" | "delivered" | "pending">("raised")\n  const [detailsColumnFilters, setDetailsColumnFilters] = useState<Record<string, string>>({})`
    );
}

// 2. Clear filters on open Details
code = code.replace(
    /setDetailsData\(null\)\n\s*setIsDetailsOpen\(true\)/,
    `setDetailsData(null)\n    setDetailsColumnFilters({})\n    setIsDetailsOpen(true)`
);

// 3. Add filtered details data memo
if (!code.includes('filteredDetailsData')) {
    code = code.replace(
        /const loadPending = useCallback/,
        `const filteredDetailsData = useMemo(() => {
    if (!detailsData?.details) return []
    return detailsData.details.filter((d: any) => {
      const filters = Object.entries(detailsColumnFilters).filter(([_, v]) => v.trim() !== '')
      if (filters.length === 0) return true
      
      const getVal = (col: string) => {
        let val = d[col]
        if (col === "customer_name" && !val) val = detailsData.commitment?.customer?.customer_name || detailsRow?.party_name
        if (col === "manual_sauda_no" && !val) val = d.manual_sauda_no || detailsRow?.commitment_no
        if (col === "raised_at" || col === "do_date" || col === "invoice_date" || col === "po_date") {
           val = val ? new Date(val).toLocaleDateString("en-IN") : ""
        }
        return String(val || "").toLowerCase()
      }

      return filters.every(([col, searchStr]) => getVal(col).includes(searchStr.toLowerCase()))
    })
  }, [detailsData, detailsColumnFilters, detailsRow])

  const loadPending = useCallback`
    );
}

// Write it out
fs.writeFileSync(file, code);
console.log('States added');
