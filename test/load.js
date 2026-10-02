/* Loads the physics modules (src/00..70) into a Node vm context with a
   few DOM stubs and returns the simulation API. The browser build and the
   harness run byte-identical physics code. */
const fs=require('fs'),path=require('path'),vm=require('vm');
function loadEngine(opts={}){
  const dir=path.join(__dirname,'..','src');
  const files=fs.readdirSync(dir).filter(f=>/^\d\d_.*\.js$/.test(f)).sort();
  const phys=files.filter(f=>parseInt(f)<=70);
  let js=phys.map(f=>fs.readFileSync(path.join(dir,f),'utf8')).join('\n');
  js+=`
globalThis.__sim={get S(){return S},set S(v){S=v},IN,cfg,H,AP,SAS,TRIM,trimHandover,WIND,step,reset,placeAt,apStep,sasApply,atmo,terrainH,windReset,qtoEuler,qmat,mrot,DT,KT,FT,FPM,DEG,RAD,exportCSV,rotorStep,airfoil};`;
  const sandbox={console,Math,performance:{now:()=>Date.now()},window:{},navigator:{},document:undefined};
  vm.createContext(sandbox);
  new vm.Script(js,{filename:'engine.js'}).runInContext(sandbox);
  return sandbox.__sim;
}
module.exports={loadEngine};
