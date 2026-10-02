/* Control realism audit: open-loop responses from a trimmed hover with the
   SAS off, per 10 % of control. Reference ranges: hingeless light twin,
   ADS-33-era handling data (Bo-105 class), stated in README. */
const {loadEngine}=require('./load.js');
function fresh(){const E=loadEngine();E.WIND.spd=0;E.WIND.turb=0;E.cfg.mass=2500;return E;}
function trim(E){const {AP,reset,IN,step,apStep,DT}=E;reset('high');AP.on=true;AP.mode='hover';AP.alt=-E.S.pos[2];AP.hdg=0;AP.vN=0;AP.vE=0;
  for(let t=0;t<40;t+=DT){const o=apStep(DT);IN.col=o.col;IN.lon=o.lon;IN.lat=o.lat;IN.ped=o.ped;step(DT);}return {...IN};}
function stepResp(axis,amp,T){const E=fresh();const c=trim(E);const {IN,step,DT,RAD}=E;const out={};let peak=0,t63=null;
  for(let t=0;t<T;t+=DT){IN[axis]=c[axis]+amp;step(DT);const S=E.S;const r=[S.om[0]*RAD,S.om[1]*RAD,S.om[2]*RAD];
    const main={lon:-r[1],lat:r[0],ped:r[2],col:r[2]}[axis];
    for(const tt of [0.5,1,2,4])if(Math.abs(t-tt)<DT/2)out[tt]={p:r[0],q:r[1],r:r[2],phi:S.eul[0]*RAD,th:S.eul[1]*RAD,psi:S.eul[2]*RAD,vs:S.vs/E.FPM,nr:S.NR};
    if(Math.abs(main)>peak)peak=Math.abs(main);}
  return {out,peak,trim:c};}
const E0=fresh();const c0=trim(E0);
console.log('■ Hover trim, 2500 kg:',`lon ${(c0.lon*100).toFixed(0)} %  lat ${(c0.lat*100).toFixed(0)} %  ped ${(c0.ped*100).toFixed(0)} %  col ${(c0.col*100).toFixed(0)} %  · attitude pitch ${(E0.S.eul[1]*E0.RAD).toFixed(1)}° roll ${(E0.S.eul[0]*E0.RAD).toFixed(1)}°`);
console.log('■ Open-loop step responses, +10 % of full control, SAS off (rates in °/s, attitudes in °)');
const fmt=(o,k)=>o?o[k].toFixed(1).padStart(6):'   n/a';
for(const [axis,name,main,cross] of [['lat','lateral cyclic','p','q'],['lon','longitudinal cyclic','q','p'],['ped','pedal','r','p'],['col','collective (no pedal)','r','q']]){
  const R=stepResp(axis,0.10,4);const o=R.out;
  console.log(`  ${name.padEnd(24)} rate ${main} @0.5 s ${fmt(o[0.5],main)}  @1 s ${fmt(o[1],main)}  @2 s ${fmt(o[2],main)}   cross ${cross} @1 s ${fmt(o[1],cross)}  attitude @1 s: roll ${fmt(o[1],'phi')} pitch ${fmt(o[1],'th')}${axis==='col'?'  vs @2 s '+fmt(o[2],'vs')+' fpm  NR '+fmt(o[2],'nr'):''}`);
}
// rate per degree of blade cyclic, and the physical gearing behind it
const H=E0.H.rotor;
console.log(`■ Gearing: lateral ±${(H.lat*E0.RAD).toFixed(1)}° blade, longitudinal ${(H.lonC*E0.RAD).toFixed(1)}° ± ${(H.lonH*E0.RAD).toFixed(1)}°; 10 % stick = ${(H.lat*E0.RAD*0.1).toFixed(2)}° / ${(H.lonH*E0.RAD*0.1).toFixed(2)}° cyclic`);
console.log(`  hub moment stiffness ${((H.Kb+H.eR*H.Sb*H.Om0*H.Om0)*H.N/2/1e3).toFixed(0)} kNm/rad,  I roll ${E0.H.I[0]} / pitch ${E0.H.I[4]} / yaw ${E0.H.I[8]} kg m²`);
// control lag: time to 50 % of the 2 s roll rate after a lateral step (actuator + rotor)
{const E=fresh();const c=trim(E);const {IN,step,DT,RAD}=E;let p2=null,t50=null;const hist=[];
 for(let t=0;t<2;t+=DT){IN.lat=c.lat+0.1;step(DT);hist.push([t,E.S.om[0]*RAD]);}p2=hist[hist.length-1][1];for(const [t,p] of hist)if(t50===null&&p>0.5*p2)t50=t;
 console.log(`■ Lag: roll rate reaches 50 % of its 2 s value after ${t50.toFixed(2)} s (actuator 0.45 s full travel, flap + inflow dynamics)`);}
// trim at speed
for(const v of [60,100]){const E=fresh();E.reset('cruise');E.S.vb[0]=v*E.KT;E.AP.on=true;E.AP.mode='cruise';E.AP.ias=v;E.AP.alt=-E.S.pos[2];for(let t=0;t<60;t+=E.DT){const o=E.apStep(E.DT);E.IN.col=o.col;E.IN.lon=o.lon;E.IN.lat=o.lat;E.IN.ped=o.ped;E.step(E.DT);}
 console.log(`■ Trim at ${v} kt: lon ${(E.S.ctl.lon*100).toFixed(0)} %  lat ${(E.S.ctl.lat*100).toFixed(0)} %  ped ${(E.S.ctl.ped*100).toFixed(0)} %  col ${(E.S.ctl.col*100).toFixed(0)} %  pitch ${(E.S.eul[1]*E.RAD).toFixed(1)}°`);}
