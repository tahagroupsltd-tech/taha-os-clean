const fs = require('fs');
const file = 'e:\\\\chrome downloads ]\\\\taha-os-clean\\\\taha-os-clean\\\\src\\\\app\\\\(dashboard)\\\\tasks\\\\page.tsx';
const lines = fs.readFileSync(file, 'utf8').split('\n');
// Remove lines 534-627 (indices 533-626) - the old duplicate ListView body
// Keep lines 0-532 and 627+ (indices 0-532 and 627+)
const clean = [...lines.slice(0, 533), ...lines.slice(627)];
fs.writeFileSync(file, clean.join('\n'), 'utf8');
console.log('Removed duplicate ListView body. File now has', clean.length, 'lines');
