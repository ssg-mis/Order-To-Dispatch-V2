const fs = require('fs');
const file = 'c:/Users/yuvra/Desktop/New Folder/shree shyam oil extractions/Order-To-Dispatch-V2/app/commitment-punch/page.tsx';
let code = fs.readFileSync(file, 'utf8');

const anchor = '<div className="space-y-4 mt-1">';
const insertion = `
          <div className="space-y-4 mt-1">
            {/* View Selector Tabs (Main Table Style) */}
            <div className="flex items-center gap-3">
              <div className="flex items-center p-1 bg-white border border-slate-200 rounded-lg shadow-sm w-fit">
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
                      "px-4 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                      detailsType === tab.id
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
`;

if (!code.includes('View Selector Tabs (Main Table Style)')) {
    code = code.replace(anchor, insertion);
    fs.writeFileSync(file, code);
    console.log('Successfully added detailsType tabs');
} else {
    console.log('Tabs already added');
}
