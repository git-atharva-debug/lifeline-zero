const fs = require('fs');
const p = 'emergency-app/src/pages/user/PreparednessScore.jsx';
const s = fs.readFileSync(p,'utf8');
function count(re){return (s.match(re)||[]).length}
console.log('curly_open',count(/{/g),'curly_close',count(/}/g),'diff',count(/{/g)-count(/}/g));
console.log('paren_open',count(/\(/g),'paren_close',count(/\)/g),'diff',count(/\(/g)-count(/\)/g));
console.log('brack_open',count(/\[/g),'brack_close',count(/\]/g),'diff',count(/\[/g)-count(/\]/g));
console.log('backticks',count(/`/g));
