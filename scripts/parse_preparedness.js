const fs = require('fs');
const parser = require('@babel/parser');
const p = 'emergency-app/src/pages/user/PreparednessScore.jsx';
const s = fs.readFileSync(p,'utf8');
try{
  parser.parse(s,{sourceType:'module',plugins:['jsx','classProperties','optionalChaining']});
  console.log('PARSE OK');
}catch(e){
  console.error('PARSE ERROR:', e.message);
  if(e.loc) console.error('LOC', e.loc);
  process.exit(1);
}
