const fs = require('fs');
const file = 'c:/Users/yuvra/Desktop/New Folder/shree shyam oil extractions/Order-To-Dispatch-V2/app/commitment-punch/page.tsx';
let code = fs.readFileSync(file, 'utf8');

const popupStartIdx = code.indexOf('<Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>');

if (popupStartIdx !== -1) {
    let beforePopup = code.substring(0, popupStartIdx);
    let popupContent = code.substring(popupStartIdx);

    // Bump the 10px labels in the metadata block
    popupContent = popupContent.replace(/text-\[10px\] font-bold uppercase tracking-wider/g, 'text-[11px] font-bold uppercase tracking-wider');
    
    // Bump the search inputs
    popupContent = popupContent.replace(/h-7 text-\[10px\] w-full px-2\.5/g, 'h-7 text-[11px] w-full px-2.5');
    
    // Bump the Filter Date button
    popupContent = popupContent.replace(/h-7 text-\[10px\] w-full px-2 /g, 'h-7 text-[11px] w-full px-2 ');

    // Bump the Total label in the table
    popupContent = popupContent.replace(/text-\[11px\]" colSpan=\{13\}>Total/g, 'text-xs" colSpan={13}>Total');
    popupContent = popupContent.replace(/text-\[11px\]" colSpan=\{12\}>Total/g, 'text-xs" colSpan={12}>Total');

    code = beforePopup + popupContent;
    fs.writeFileSync(file, code);
    console.log('Successfully bumped fonts');
} else {
    console.log('Could not find popup string');
}
