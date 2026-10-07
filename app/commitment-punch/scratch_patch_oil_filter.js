const fs = require('fs');
const file = 'c:/Users/yuvra/Desktop/New Folder/shree shyam oil extractions/Order-To-Dispatch-V2/app/commitment-punch/page.tsx';
let code = fs.readFileSync(file, 'utf8');

const anchor = `if (col === "manual_sauda_no" && !val) val = d.manual_sauda_no || detailsRow?.commitment_no`;
if (code.includes(anchor)) {
    code = code.replace(anchor, anchor + `\n        if (col === "oil_type" && !val) val = d.oil_type || detailsRow?.oil_type`);
    fs.writeFileSync(file, code);
    console.log("Patched oil_type in details filter");
}
