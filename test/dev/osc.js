const {loadEngine}=require('../load.js');
const E=loadEngine();const {IN,cfg,AP,step,reset,apStep,DT,KT,FPM,RAD}=E;
const mode=process.argv[2]||'vs';
reset('high');AP.on=true;AP.mode='hover';AP.hdg=0;
if(mode==='vs'){AP.alt=null;AP.vs=0;}else AP.alt=-E.S.pos[2];
let n=0;
for(let t=0;t<60;t+=DT){const o=apStep(DT);
  if(mode==='nocol'){if(t<8)IN.col=o.col;}else IN.col=o.col;
  if(mode==='noped'){if(t<8)IN.ped=o.ped;}else IN.ped=o.ped;
  IN.lon=o.lon;IN.lat=o.lat;step(DT);
  if(++n%1440===0){const S=E.S;console.log(`t=${S.t.toFixed(0).padStart(3)} alt=${S.alt.toFixed(1)} vs=${(S.vs/FPM).toFixed(0).padStart(5)} NR=${S.NR.toFixed(1)} P=${(S.Pload/1e3).toFixed(0)} col=${S.ctl.col.toFixed(3)} ped=${S.ctl.ped.toFixed(3)} psi=${(S.eul[2]*RAD).toFixed(1)} r=${(S.om[2]*RAD).toFixed(1)} fen=${S.fen.T.toFixed(0)} Pfen=${(S.fen.P/1e3).toFixed(0)} int=${S.eng.int.toFixed(0)} lam0=${S.rot.lam0.toFixed(4)}`);}}
