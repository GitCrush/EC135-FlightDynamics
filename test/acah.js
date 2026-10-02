/* Hands-off hover after a trimmed handover with the attitude command
   around trim: how calm is it? Then the same with a 1 m/s drift injected
   and one short counter-nudge. */
const {loadEngine}=require('./load.js');
const E=loadEngine();E.WIND.spd=0;E.WIND.turb=0;E.cfg.mass=2500;
const {IN,AP,step,apStep,sasApply,trimHandover,TRIM,SAS,DT,KT,RAD,DEG}=E;
function trimmed(){E.reset('high');AP.on=true;AP.mode='hover';AP.alt=-E.S.pos[2];AP.hdg=0;AP.posN=E.S.pos[0];AP.posE=E.S.pos[1];for(const k in AP.int)AP.int[k]=0;let o;
  for(let t=0;t<12;t+=DT){o=apStep(DT);IN.col=o.col;IN.lon=o.lon;IN.lat=o.lat;IN.ped=o.ped;step(DT);}AP.on=false;AP.posN=AP.posE=null;trimHandover(o);return o;}
function gs(){const R=E.qmat(E.S.q),v=E.mrot(R,E.S.vb);return Math.hypot(v[0],v[1]);}
E.cfg.sas=true;E.cfg.attHold=true;E.cfg.hdgHold=true;E.cfg.hoverAssist=false;
{const o=trimmed();console.log(`handover: col ${o.col.toFixed(3)} lon ${o.lon.toFixed(3)} lat ${o.lat.toFixed(3)} ped ${o.ped.toFixed(3)} pitch ${(E.S.eul[1]*RAD).toFixed(2)} roll ${(E.S.eul[0]*RAD).toFixed(2)}`);
 const raw={col:o.col,lon:0,lat:0,ped:0,att:false};const out=[];
 for(let t=0;t<40;t+=DT){const s=sasApply(DT,raw);IN.col=s.col;IN.lon=s.lon;IN.lat=s.lat;IN.ped=s.ped;step(DT);if([5,10,20,40].some(tt=>Math.abs(t+DT-tt)<DT/2))out.push(`t=${(t+DT).toFixed(0)}: ${gs().toFixed(2)} m/s, ${Math.hypot(E.S.pos[0]+200,E.S.pos[1]).toFixed(1)} m off, alt ${E.S.hAGL.toFixed(0)} m, hdg ${(E.S.eul[2]*RAD).toFixed(0)}`);}
 console.log('hands off, attitude command around trim:\n   '+out.join('\n   '));}
{const o=trimmed();E.S.vb[0]+=1.0;const raw={col:o.col,lon:0,lat:0,ped:0,att:false};const out=[];
 for(let t=0;t<20;t+=DT){raw.lon=(t>1&&t<1.6)?-0.25:0;const s=sasApply(DT,raw);IN.col=s.col;IN.lon=s.lon;IN.lat=s.lat;IN.ped=s.ped;step(DT);if([1,3,6,10,20].some(tt=>Math.abs(t+DT-tt)<DT/2))out.push(`t=${(t+DT).toFixed(0)}: ${gs().toFixed(2)} m/s`);}
 console.log('1 m/s drift, one 0.6 s nudge of 25 % aft at t=1:\n   '+out.join('\n   '));}
{const o=trimmed();const raw={col:o.col,lon:0,lat:0,ped:0,att:false};E.WIND.spd=8;E.WIND.turb=1;E.windReset(3);const out=[];
 for(let t=0;t<30;t+=DT){const s=sasApply(DT,raw);IN.col=s.col;IN.lon=s.lon;IN.lat=s.lat;IN.ped=s.ped;step(DT);if([10,20,30].some(tt=>Math.abs(t+DT-tt)<DT/2))out.push(`t=${(t+DT).toFixed(0)}: ${gs().toFixed(2)} m/s, ${Math.hypot(E.S.pos[0]+200,E.S.pos[1]).toFixed(1)} m off, hdg ${(E.S.eul[2]*RAD).toFixed(0)}`);}
 console.log('hands off in 8 kt wind with light turbulence:\n   '+out.join('\n   '));}
