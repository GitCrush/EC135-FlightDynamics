const {loadEngine}=require('../load.js');
const E=loadEngine();const {IN,cfg,AP,step,reset,apStep,DT,KT,FPM,RAD}=E;
function trimHover(sec=15){reset('high');AP.on=true;AP.mode='hover';AP.alt=-E.S.pos[2];AP.hdg=0;AP.vN=0;AP.vE=0;AP.auto=false;
  for(let t=0;t<sec;t+=DT){const o=apStep(DT);IN.col=o.col;IN.lon=o.lon;IN.lat=o.lat;IN.ped=o.ped;step(DT);}}
function run(sec,fn,every=1){let n=0;for(let t=0;t<sec;t+=DT){if(fn)fn(t);step(DT);if(++n%(360*every)===0)pr(t+DT);}}
function pr(t){const S=E.S,r=S.rot;console.log(`  t=${t.toFixed(1).padStart(5)} alt=${S.alt.toFixed(0)} vs=${(S.vs/FPM).toFixed(0).padStart(5)} ias=${(S.ias/KT).toFixed(0).padStart(3)} NR=${S.NR.toFixed(1)} P=${(S.Pload/1e3).toFixed(0)} fli=${S.eng.fli.toFixed(1)} col=${S.ctl.col.toFixed(2)} lon=${S.ctl.lon.toFixed(2)} lat=${S.ctl.lat.toFixed(2)} ped=${S.ctl.ped.toFixed(2)} phi=${(S.eul[0]*RAD).toFixed(1).padStart(6)} th=${(S.eul[1]*RAD).toFixed(1).padStart(6)} psi=${(S.eul[2]*RAD).toFixed(0).padStart(4)} p=${(S.om[0]*RAD).toFixed(1).padStart(6)} q=${(S.om[1]*RAD).toFixed(1).padStart(6)} r=${(S.om[2]*RAD).toFixed(1).padStart(6)} vrs=${r.vrs.toFixed(2)} st=${r.stall.toFixed(2)} mu=${r.mu.toFixed(3)} vy=${S.vb[1].toFixed(1)}`);}
const test=process.argv[2]||'free';
if(test==='free'){console.log('free response from trimmed hover, controls frozen');trimHover(15);run(20,null,2);}
if(test==='lat'){console.log('lateral step +0.2 for 1 s');trimHover(15);const c={...IN};run(3,t=>{IN.lat=c.lat+(t<1?0.2:0);},0.25);}
if(test==='lon'){console.log('longitudinal step +0.2 for 1 s');trimHover(15);const c={...IN};run(3,t=>{IN.lon=c.lon+(t<1?0.2:0);},0.25);}
if(test==='ped'){console.log('pedal step +0.3 for 1 s');trimHover(15);const c={...IN};run(3,t=>{IN.ped=c.ped+(t<1?0.3:0);},0.25);}
if(test==='cruise'){for(const v of [20,40,60,80,100,120,137]){reset('cruise');E.S.vb[0]=v*KT;E.S.rot.lam0=v>40?0.02:0.04;AP.on=true;AP.mode='cruise';AP.ias=v;AP.alt=-E.S.pos[2];
  for(let t=0;t<60;t+=DT){const o=apStep(DT);IN.col=o.col;IN.lon=o.lon;IN.lat=o.lat;IN.ped=o.ped;step(DT);}
  const S=E.S;console.log(`V=${v} kt: ias=${(S.ias/KT).toFixed(1)} vs=${(S.vs/FPM).toFixed(0)} P=${(S.Pload/1e3).toFixed(0)} kW fli=${S.eng.fli.toFixed(1)} col=${S.ctl.col.toFixed(2)} lon=${S.ctl.lon.toFixed(2)} lat=${S.ctl.lat.toFixed(2)} ped=${S.ctl.ped.toFixed(2)} th=${(S.eul[1]*RAD).toFixed(1)} phi=${(S.eul[0]*RAD).toFixed(1)} stall=${S.rot.stall.toFixed(2)} Mtip=${S.rot.Mtip.toFixed(2)} NR=${S.NR.toFixed(1)} lam0=${S.rot.lam0.toFixed(3)} T=${(S.rot.T/1e3).toFixed(1)}`);}}
if(test==='ground'){console.log('at rest on the pad');reset('pad');IN.col=0.05;run(6,null,1);const S=E.S;console.log('pos',S.pos.map(x=>x.toFixed(3)),'contact',S.gear.contact,'phi/th',(S.eul[0]*RAD).toFixed(2),(S.eul[1]*RAD).toFixed(2));}

if(test==='climb'){for(const v of [50,65,80]){reset('cruise');E.S.vb[0]=v*KT;AP.on=true;AP.mode='cruise';AP.ias=v;AP.alt=null;AP.vs=12;
  for(let t=0;t<50;t+=DT){const o=apStep(DT);IN.col=o.col;IN.lon=o.lon;IN.lat=o.lat;IN.ped=o.ped;step(DT);}
  const S=E.S;console.log(`climb at ${v} kt: ias=${(S.ias/KT).toFixed(0)} vs=${(S.vs/FPM).toFixed(0)} fpm P=${(S.Pload/1e3).toFixed(0)} avail=${(S.Pavail/1e3).toFixed(0)} fli=${S.eng.fli.toFixed(1)} NR=${S.NR.toFixed(1)} col=${S.ctl.col.toFixed(2)} lim=${S.eng.limit}`);}}
if(test==='auto'){reset('cruise');E.S.vb[0]=70*KT;AP.on=true;AP.mode='cruise';AP.ias=70;AP.alt=-E.S.pos[2];
  for(let t=0;t<20;t+=DT){const o=apStep(DT);IN.col=o.col;IN.lon=o.lon;IN.lat=o.lat;IN.ped=o.ped;step(DT);}
  console.log('engines off at 70 kt');for(const en of E.S.eng.e)en.on=false;AP.auto=true;AP.ias=65;
  let n=0;for(let t=0;t<25;t+=DT){const o=apStep(DT);IN.col=o.col;IN.lon=o.lon;IN.lat=o.lat;IN.ped=o.ped;step(DT);if(++n%720===0)pr(t);}}
if(test==='oei'){trimHover(15);console.log('engine 1 fails in hover');E.S.eng.e[0].fail=true;run(10,t=>{const o=apStep(DT);IN.col=o.col;IN.lon=o.lon;IN.lat=o.lat;IN.ped=o.ped;},1);}
if(test==='ge'){for(const h of [1,3,8,30]){reset('hover');E.S.pos[2]=-(h+1.3);AP.on=true;AP.mode='hover';AP.alt=h+1.3;AP.hdg=0;
  for(let t=0;t<45;t+=DT){const o=apStep(DT);IN.col=o.col;IN.lon=o.lon;IN.lat=o.lat;IN.ped=o.ped;step(DT);}
  const S=E.S;console.log(`hover at ${h} m skid height: P=${(S.Pload/1e3).toFixed(0)} kW col=${S.ctl.col.toFixed(3)} kG=${S.rot.ge.toFixed(3)} agl=${S.hAGL.toFixed(1)} vs=${(S.vs/FPM).toFixed(0)}`);}}
if(test==='vrs'){reset('high');AP.on=true;AP.mode='hover';AP.alt=null;AP.vs=-8;AP.hdg=0;
  run(30,t=>{const o=apStep(DT);IN.col=o.col;IN.lon=o.lon;IN.lat=o.lat;IN.ped=o.ped;},2);}
