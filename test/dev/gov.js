const {loadEngine}=require('../load.js');
const E=loadEngine();const {IN,cfg,AP,step,reset,apStep,DT,KT,FPM,RAD}=E;
reset('high');AP.on=true;AP.mode='hover';AP.alt=-E.S.pos[2];AP.hdg=0;
// 12 s AP to trim, then freeze the controls and step the collective
for(let t=0;t<12;t+=DT){const o=apStep(DT);IN.col=o.col;IN.lon=o.lon;IN.lat=o.lat;IN.ped=o.ped;step(DT);}
const c0=IN.col;let n=0;
for(let t=0;t<8;t+=DT){
  if(t>1)IN.col=c0+0.06;                 // +6 % collective (~0.85° blade)
  step(DT);
  if(++n%36===0){const S=E.S;console.log(`t=${(S.t-12).toFixed(1)} NR=${S.NR.toFixed(2)} P=${(S.Pload/1e3).toFixed(0)} Peng=${(S.eng.e[0].P*2/1e3).toFixed(0)} vs=${(S.vs/FPM).toFixed(0)} col=${S.ctl.col.toFixed(3)} T=${(S.rot.T/1e3).toFixed(1)}`);}
}
