const {loadEngine}=require('../load.js');const E=loadEngine();const {IN,step,DT,RAD}=E;
E.reset('cold');IN.col=0.02;E.S.eng.e.forEach(en=>{});
let n=0;console.log('cold on the pad, start engines');
E.S.eng.e.forEach(en=>{en.on=true;en.startT=25;});
for(let t=0;t<90;t+=DT){step(DT);if(++n%1800===0){const S=E.S;console.log(`t=${t.toFixed(0).padStart(3)} NR=${S.NR.toFixed(1).padStart(5)} mode=${S.eng.mode} P=${(S.Pload/1e3).toFixed(0)} Peng=${((S.eng.e[0].P+S.eng.e[1].P)/1e3).toFixed(0)} Q=${S.eng.Qdrive.toFixed(0)} b=${(S.rot.beta[0]*RAD).toFixed(1)} fuel=${S.fuelBurn.toFixed(2)}`);}}
console.log('shutdown');E.S.eng.e.forEach(en=>en.on=false);
for(let t=0;t<120;t+=DT){step(DT);if(++n%3600===0){const S=E.S;console.log(`t=${t.toFixed(0).padStart(3)} NR=${S.NR.toFixed(1).padStart(5)} b=${(S.rot.beta[0]*RAD).toFixed(1)}`);}}
