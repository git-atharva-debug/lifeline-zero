const fs = require('fs');
const p = 'emergency-app/src/pages/user/PreparednessScore.jsx';
try {
  const s = fs.readFileSync(p, 'utf8');
  console.log('path:', p);
  console.log('length:', s.length);
  console.log('lines:', s.split('\n').length);
  console.log('lastCharCode:', s.charCodeAt(s.length - 1));
  console.log('last40:', JSON.stringify(s.slice(-40)));
  const ticks = (s.match(/`/g) || []).length;
  console.log('backtick_count:', ticks);
} catch (e) { console.error('ERR', e.message); process.exit(1); }