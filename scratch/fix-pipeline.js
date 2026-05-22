const fs = require('fs');
const file = 'e:\\\\chrome downloads ]\\\\taha-os-clean\\\\taha-os-clean\\\\src\\\\app\\\\(dashboard)\\\\crm\\\\pipeline\\\\page.tsx';
const lines = fs.readFileSync(file, 'utf8').split('\n');
// The component closes at line that has just "}" after the "  )" return close
// Find that line specifically - it's line 684 (index 683)
const cutAt = 684; // keep lines 1-684 (indices 0-683)
const clean = lines.slice(0, cutAt).join('\n') + '\n';
fs.writeFileSync(file, clean, 'utf8');
console.log('Done. File now has', cutAt, 'lines');
