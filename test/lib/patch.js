/* Source mutation for test/mutation.js: when EC135_PATCH names a JSON file
   with [{from, to}], every loader applies those replacements to the
   concatenated source before running it. A replacement that does not
   match is an error (a mutant that changes nothing would pass for free). */
const fs=require('fs');
function applyPatch(js,extra){
  const f=process.env.EC135_PATCH;
  const list=(f?JSON.parse(fs.readFileSync(f,'utf8')):[]).concat(extra||[]);   // extra: patches a test applies on purpose (e.g. the mirror test)
  for(const {from,to} of list){
    const i=js.indexOf(from);if(i<0)throw new Error('EC135_PATCH: pattern not found: '+from.slice(0,80));
    js=js.slice(0,i)+to+js.slice(i+from.length);}
  return js;}
module.exports={applyPatch};
