const fs = require('fs');
const file = 'c:/Users/yuvra/Desktop/New Folder/shree shyam oil extractions/Order-To-Dispatch-V2/app/order-punch/page.tsx';
let code = fs.readFileSync(file, 'utf8');

const columnTotalsStr = `  const columnTotals = useMemo(() => {
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

// Remove it from its current position
code = code.replace(columnTotalsStr, '');

// Find where sortedRows ends
const sortedRowsEndStr = `    return [...filteredRows].sort((a, b) => {
      const cmp = compareValues(a[sort.field], b[sort.field], type)
      return sort.dir === "asc" ? cmp : -cmp
    })
  }, [filteredRows, sort])`;

if (code.includes(sortedRowsEndStr)) {
    code = code.replace(sortedRowsEndStr, sortedRowsEndStr + '\n\n' + columnTotalsStr);
}

fs.writeFileSync(file, code);
console.log('Fixed sortedRows initialization error');
