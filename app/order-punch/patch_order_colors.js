const fs = require('fs');
const file = 'c:/Users/yuvra/Desktop/New Folder/shree shyam oil extractions/Order-To-Dispatch-V2/app/order-punch/page.tsx';
let code = fs.readFileSync(file, 'utf8');

const oldTotalsLine1 = `if (col.id === "total_qty_box") return <TableCell key={\`total-\${col.id}\`} className={alignClass}>{formatNumber(columnTotals.total_qty_box)}</TableCell>`;
const newTotalsLine1 = `if (col.id === "total_qty_box") return <TableCell key={\`total-\${col.id}\`} className={cn("font-mono font-black text-emerald-700", alignClass)}>{formatNumber(columnTotals.total_qty_box)}</TableCell>`;

const oldTotalsLine2 = `if (col.id === "total_qty_kgs") return <TableCell key={\`total-\${col.id}\`} className={alignClass}>{formatNumber(columnTotals.total_qty_kgs)}</TableCell>`;
const newTotalsLine2 = `if (col.id === "total_qty_kgs") return <TableCell key={\`total-\${col.id}\`} className={cn("font-mono font-black text-blue-700", alignClass)}>{formatNumber(columnTotals.total_qty_kgs)}</TableCell>`;

const oldTotalsLine3 = `if (col.id === "total_order_amount") return <TableCell key={\`total-\${col.id}\`} className={alignClass}>{formatAmount(columnTotals.total_order_amount)}</TableCell>`;
const newTotalsLine3 = `if (col.id === "total_order_amount") return <TableCell key={\`total-\${col.id}\`} className={cn("font-mono font-black text-purple-700", alignClass)}>{formatAmount(columnTotals.total_order_amount)}</TableCell>`;

code = code.replace(oldTotalsLine1, newTotalsLine1);
code = code.replace(oldTotalsLine2, newTotalsLine2);
code = code.replace(oldTotalsLine3, newTotalsLine3);

fs.writeFileSync(file, code);
console.log('Colors patched');
