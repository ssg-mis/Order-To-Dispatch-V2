const fs = require('fs');

// 1. Fix page.tsx duplicate keys
let page = fs.readFileSync('app/master/page.tsx', 'utf8');
page = page.replace(
  'oil_tag_id: "",\n      oil_tag_id: "",\n        oil_type_id: "",',
  'oil_tag_id: "",\n      oil_type_id: "",'
);
fs.writeFileSync('app/master/page.tsx', page);

// 2. Fix api-service.ts missing getPending
let api = fs.readFileSync('lib/api-service.ts', 'utf8');
api = api.replace(
  'getById: async (id: number | string): Promise<ApiResponse> => request(`/oil-tags/${id}`),',
  'getById: async (id: number | string): Promise<ApiResponse> => request(`/oil-tags/${id}`),\n    getPending: async (): Promise<ApiResponse> => request(`/oil-tags/pending`),'
);
fs.writeFileSync('lib/api-service.ts', api);

console.log('TS ERRORS FIXED');
