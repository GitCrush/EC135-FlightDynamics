const {loadEngine}=require('../load.js');
const E=loadEngine();
const {IN,cfg,AP,step,reset,apStep,DT,KT,FPM,RAD}=E;
cfg.mass=2500;
reset('high');                       // 1000 ft AGL, still air
AP.on=true;AP.mode='hover';AP.alt=-E.S.pos[2];AP.hdg=0;AP.vN=0;AP.vE=0;
const T=parseFloat(process.argv[2]||'25');
let n=0;
for(let t=0;t<T;t+=DT){
  const o=apStep(DT);IN.col=o.col;IN.lon=o.lon;IN.lat=o.lat;IN.ped=o.ped;
  step(DT);
  if(++n%360===0){const S=E.S,r=S.rot;
    console.log(`t=${S.t.toFixed(0).padStart(3)} alt=${S.alt.toFixed(1)} vs=${(S.vs/FPM).toFixed(0).padStart(5)}fpm ias=${(S.ias/KT).toFixed(1)} NR=${S.NR.toFixed(1)} T=${(r.T/1e3).toFixed(1)}kN P=${(S.Pload/1e3).toFixed(0)}kW fli=${S.eng.fli.toFixed(1)} col=${S.ctl.col.toFixed(3)} lon=${S.ctl.lon.toFixed(3)} lat=${S.ctl.lat.toFixed(3)} ped=${S.ctl.ped.toFixed(3)} phi=${(S.eul[0]*RAD).toFixed(1)} th=${(S.eul[1]*RAD).toFixed(1)} psi=${(S.eul[2]*RAD).toFixed(1)} lam0=${r.lam0.toFixed(4)} b0=${(r.beta.reduce((a,b)=>a+b,0)/4*RAD).toFixed(2)} fenT=${S.fen.T.toFixed(0)} vy=${S.vb[1].toFixed(2)} vx=${S.vb[0].toFixed(2)}`);}
}
