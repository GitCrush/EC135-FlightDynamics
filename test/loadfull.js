/* Loads ALL src modules (physics + input + coach + tutor + replay + UI)
   into a vm with DOM stubs, so the human control path can be tested the
   way the browser runs it: keys and mouse → pilot models → SAS → physics. */
const fs=require('fs'),path=require('path'),vm=require('vm');
function stubEl(){const el={textContent:'',innerHTML:'',value:'',title:'',dataset:{},style:{},options:[],classList:{add(){},remove(){},toggle(){},contains(){return false;}},
  appendChild(){},addEventListener(){},querySelector(){return stubEl();},getContext(){return null;},blur(){},getBoundingClientRect(){return {left:0,top:0,width:1000,height:800};}};return el;}
function loadFull(opts={}){
  const dir=path.join(__dirname,'..','src');
  const files=fs.readdirSync(dir).filter(f=>/^\d\d_.*\.js$/.test(f)).sort();
  let js=files.map(f=>fs.readFileSync(path.join(dir,f),'utf8')).join('\n');
  js+=`\nglobalThis.__f={get S(){return S},set S(v){S=v},IN,cfg,H,AP,SAS,TRIM,DEV,COACH,TUTOR,UI,WIND,REPLAY,step,reset,inputStep,coachStep,tutorStep,apDemoStep,apDemoToggle,keyAction,uiReset,trimNow,sasApply,trimSet,trimClear,DT,KT,FT,FPM,DEG,RAD,qmat,mrot,windReset,tutorStart,tutorStop,LESSONS,PAD,padPreset,padLearnStart,apStep,apBumpless,engineFailure,INC_RULES,trimNow,wrapPi,clamp,sat,terrainH,tutorNext,trimHandover,vlen};`;
  const pads=[null];
  const doc={getElementById:()=>stubEl(),querySelectorAll:()=>[],createElement:()=>stubEl(),addEventListener(){},pointerLockElement:null,exitPointerLock(){}};
  const sandbox={console,Math,JSON,Float32Array,Uint16Array,Uint32Array,Array,Object,String,Number,Set,Map,performance:{now:()=>Date.now()},
    document:doc,window:undefined,navigator:{language:'en-US',getGamepads:opts.throwPads?()=>{throw new Error('SecurityError: gamepad blocked by permissions policy');}:()=>pads},requestAnimationFrame(){},AudioContext:undefined,speechSynthesis:undefined,localStorage:{getItem:()=>null,setItem(){}}};
  vm.createContext(sandbox);
  new vm.Script(js,{filename:'full.js'}).runInContext(sandbox);
  const F=sandbox.__f;F.pads=pads;return F;
}
module.exports={loadFull};
