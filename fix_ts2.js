const fs = require('fs');
let page = fs.readFileSync('app/master/page.tsx', 'utf8');

// Replace any double occurrences of oil_tag_id
page = page.replace(
  /oil_tag_id:\s*"",\s*oil_tag_id:\s*"",/g,
  'oil_tag_id: "",'
);

fs.writeFileSync('app/master/page.tsx', page);
console.log('TS ERRORS REALLY FIXED');
