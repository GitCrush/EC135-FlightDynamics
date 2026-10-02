const {loadEngine}=require('../load.js');
function fresh(){const E=loadEngine();E.WIND.spd=0;E.WIND.turb=0;E.cfg.mass=2500;return E;}
function fly(E,sec,fn){const {IN,AP,step,apStep,DT}=E;for(let t=0;t<sec;t+=DT){if(fn)fn(t);const o=apStep(DT);IN.col=o.col;IN.lon=o.lon;IN.lat=o.lat;IN.ped=o.ped;step(DT);}}
// 1 autorotation NR with the collective fully down at 65 kt
{const E=fresh();E.reset('cruise');E.S.vb[0]=70*E.KT;E.AP.on=true;E.AP.mode='cruise';E.AP.ias=70;E.AP.alt=-E.S.pos[2];fly(E,15);
 for(const en of E.S.eng.e)en.on=false;E.AP.auto=true;E.AP.ias=65;
 let n=0;for(let t=0;t<25;t+=E.DT){const o=E.apStep(E.DT);E.IN.col=0;E.IN.lon=o.lon;E.IN.lat=o.lat;E.IN.ped=o.ped;E.step(E.DT);if(++n%1800===0)console.log(`auto col=0: t=${t.toFixed(0)} NR=${E.S.NR.toFixed(1)} sink=${(-E.S.vs/E.FPM).toFixed(0)} ias=${(E.S.ias/E.KT).toFixed(0)}`);}}
// 2 sideways and backwards flight at 25 kt (pedal / attitude)
for(const [vN,vE,name] of [[0,12.9,'right 25 kt'],[0,-12.9,'left 25 kt'],[-12.9,0,'backwards 25 kt']]){const E=fresh();E.reset('high');E.AP.on=true;E.AP.mode='hover';E.AP.alt=-E.S.pos[2];E.AP.hdg=0;E.AP.vN=vN;E.AP.vE=vE;fly(E,40);const S=E.S;
 console.log(`${name}: ped=${S.ctl.ped.toFixed(2)} fenStall=${S.fen.stall.toFixed(2)} phi=${(S.eul[0]*E.RAD).toFixed(1)} th=${(S.eul[1]*E.RAD).toFixed(1)} P=${(S.Pload/1e3).toFixed(0)} lon=${S.ctl.lon.toFixed(2)} lat=${S.ctl.lat.toFixed(2)} psi=${(S.eul[2]*E.RAD).toFixed(1)}`);}
// 3 overpitch: full collective in 1 s from hover
{const E=fresh();E.reset('high');E.AP.on=true;E.AP.mode='hover';E.AP.alt=-E.S.pos[2];E.AP.hdg=0;fly(E,30);const c=E.IN.col;let n=0;
 for(let t=0;t<6;t+=E.DT){E.IN.col=Math.min(1,c+t*0.8);E.step(E.DT);if(++n%360===0)console.log(`overpitch: t=${t.toFixed(0)} col=${E.S.ctl.col.toFixed(2)} NR=${E.S.NR.toFixed(1)} fli=${E.S.eng.fli.toFixed(1)} vs=${(E.S.vs/E.FPM).toFixed(0)} inc=${E.S.incident&&E.S.incident.id}`);}}
// 4 hover in ground effect: torque needed at skid height vs OGE, and settling
{const E=fresh();E.reset('pad');E.IN.col=0.05;for(let t=0;t<3;t+=E.DT)E.step(E.DT);
 let n=0;for(let t=0;t<12;t+=E.DT){E.IN.col=Math.min(0.42,0.05+t*0.06);E.IN.ped=0.45;E.step(E.DT);if(++n%720===0)console.log(`liftoff: t=${t.toFixed(0)} col=${E.S.ctl.col.toFixed(2)} agl=${E.S.hAGL.toFixed(2)} contact=${E.S.gear.contact} phi=${(E.S.eul[0]*E.RAD).toFixed(1)} psi=${(E.S.eul[2]*E.RAD).toFixed(0)} fli=${E.S.eng.fli.toFixed(1)}`);}}
