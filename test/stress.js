/* Stress tests and unconventional manoeuvres (2.16.6). What the scenario suite
   (test/scenarios.js) does not fly: sharp-edged gusts, sideward and rearward
   flight at the edge, a collective snapped up or dumped at Vne, overpitching
   on one engine, an engine failure in the high hover, a sustained 60° turn,
   a zoom into a tail slide, an aileron roll, a loop, negative g, landings
   with drift, hard landings, a run-on landing, random inputs, and the energy
   balance in autorotation. Each row prints the measurement, what physics or
   the type's limits lead one to expect, and OK / CHECK / INFO.
   `node test/stress.js [S1 S2 …]` runs a selection. */
const {mk,st,direct,ap,apHover,apCruise,pipe,R}=require('./scenarios.js');
let bad=0;const want=process.argv.slice(2);const on=k=>!want.length||want.includes(k);
const row=(name,val,ok,expect)=>{if(ok===false)bad++;console.log(`  ${ok===null?'INFO ':ok?'OK   ':'CHECK'} ${name.padEnd(64)} ${String(val).padStart(14)}   ${expect||''}`);};
const cl=(v,a,b)=>Math.max(a,Math.min(b,v)),f1=v=>v.toFixed(1),f0=v=>v.toFixed(0),f2=v=>v.toFixed(2);
/* the state watched on every step: finite numbers, a unit quaternion, extremes, incidents */
function watcher(F){const w={nan:false,qerr:0,nzMin:9,nzMax:-9,nrMin:999,nrMax:0,fliMax:0,hMin:1e9,pMax:0,qMax:0,rMax:0,stall:0,inc:new Set(),crash:''};
  w.f=()=>{const S=F.S;if(w.crash)return;if(S.crash){w.crash=S.crash;return;}const v=[...S.pos,...S.vb,...S.om,...S.q,S.rot.Om,S.NR,S.nz];if(v.some(x=>!Number.isFinite(x)))w.nan=true;
    w.qerr=Math.max(w.qerr,Math.abs(Math.hypot(...S.q)-1));w.nzMin=Math.min(w.nzMin,S.nz);w.nzMax=Math.max(w.nzMax,S.nz);w.nrMin=Math.min(w.nrMin,S.NR);w.nrMax=Math.max(w.nrMax,S.NR);
    w.fliMax=Math.max(w.fliMax,S.eng.fli);w.hMin=Math.min(w.hMin,S.hAGL);w.pMax=Math.max(w.pMax,Math.abs(S.om[0])*R);w.qMax=Math.max(w.qMax,Math.abs(S.om[1])*R);w.rMax=Math.max(w.rMax,Math.abs(S.om[2])*R);
    w.stall=Math.max(w.stall,S.rot.stall||0);if(S.incident)w.inc.add(S.incident.id);if(S.crash&&!w.crash)w.crash=S.crash;};return w;}
const sane=(name,w)=>row(`${name}: numbers finite, quaternion unit`,w.nan?'NaN':`|q|-1 ${w.qerr.toExponential(0)}`,!w.nan&&w.qerr<1e-6,'robust integration');
/* pilots: attitude (scenarios.js style) and body rate */
function attP(F,thC,phC,I){const S=F.S,[phi,th]=S.eul,[p,q]=S.om;I.l=(I.l===undefined?F.IN.lon:I.l)+(th-thC)*F.DT*0.8;I.r=(I.r===undefined?F.IN.lat:I.r)+(phC-phi)*F.DT*0.8;
  return {lon:cl(2.2*(th-thC)+0.7*q+I.l,-1,1),lat:cl(2.4*(phC-phi)-0.6*p+I.r,-1,1)};}
function rateP(F,pC,qC,I){const [p,q]=F.S.om;I.l=cl((I.l===undefined?F.IN.lon:I.l)+(q-qC)*F.DT*2,-1,1);I.r=cl((I.r===undefined?F.IN.lat:I.r)+(pC-p)*F.DT*2,-1,1);
  return {lon:cl(1.2*(q-qC)+I.l,-1,1),lat:cl(1.0*(pC-p)+I.r,-1,1)};}
/* the feet: hold a heading (right pedal positive turns the nose right) */
function pedP(F,psi0,J){const e=((psi0-F.S.eul[2]+3*Math.PI)%(2*Math.PI))-Math.PI,r=F.S.om[2];J.p=cl((J.p===undefined?F.IN.ped:J.p)+e*F.DT*0.5,-1,1);return cl(J.p+1.2*e-0.6*r,-1,1);}
const D=Math.PI/180,trimmedHover=(o)=>{const F=mk('high',o);apHover(F);ap(F,6);return F;},trimmedCruise=(kt,o)=>{const F=mk('cruise',o);apCruise(F,kt);ap(F,25);return F;};
const energy=F=>{const S=F.S,I=F.inertia(),w=S.om,Iw=[I[0]*w[0]+I[1]*w[1]+I[2]*w[2],I[3]*w[0]+I[4]*w[1]+I[5]*w[2],I[6]*w[0]+I[7]*w[1]+I[8]*w[2]];
  return S.m*9.81*(-S.pos[2])+0.5*S.m*(S.vb[0]**2+S.vb[1]**2+S.vb[2]**2)+0.5*(w[0]*Iw[0]+w[1]*Iw[1]+w[2]*Iw[2])+0.5*F.H.rotor.Ir*S.rot.Om**2;};

if(on('S1')){console.log('\n■ S1 sharp-edged gust of 20 kt in the hover at 1000 ft, controls frozen, SAS off (signs after 1 s)');
 for(const [name,dir] of [['from the right',90],['from the left',270],['from ahead',0]]){const F=trimmedHover();const w=watcher(F);const s0=st(F);
  F.WIND.dir=dir;F.WIND.spd=20/F.windProfile(-F.S.pos[2]+0);F.WIND.turb=0;let s1=null;direct(F,1,null,(t,s)=>{w.f();s1=s;});
  const dphi=s1.phi-s0.phi,dth=s1.th-s0.th,dpsi=((s1.psi-s0.psi+540)%360)-180,dvs=s1.vs;
  if(dir===0){row(`gust ${name}: pitch change / climb after 1 s`,`${f1(dth)}° / ${f0(dvs)} fpm`,dth>0.3&&dvs>0,'disc flaps back: nose up; translational lift: climbs');}
  else{const sg=dir===90?1:-1;row(`gust ${name}: roll / heading change after 1 s`,`${f1(dphi)}° / ${f1(dpsi)}°`,sg*dphi<-0.3&&sg*dpsi>0.3,`rolls away from the gust (dihedral), nose turns into it (fin, Fenestron)`);}
  sane(`gust ${name}`,w);}}

if(on('S2')){console.log('\n■ S2 sideward and rearward flight (holding position in wind at 1000 ft, 2910 kg, autopilot hover)');
 for(const [name,kt,dir] of [['35 kt to the right (wind from the right)',35,90],['35 kt to the left (wind from the left)',35,270],['30 kt rearward (wind from behind)',30,180],['45 kt forward (reference)',45,0]]){
  const F=mk('high',{wind:kt,wdir:dir,mass:2910});apHover(F);const w=watcher(F);let ss=[];const n0=F.S.pos[0],e0=F.S.pos[1];
  ap(F,45,null,null,(t,s)=>{w.f();if(t>35)ss.push(s);});   /* (until 2.16.5 the hover mode dropped its lateral loop above 25 kt of airspeed and drifted 5 m/s) */
  const avg=k=>ss.reduce((a,s)=>a+s[k],0)/ss.length,lat=avg('lat'),lon=avg('lon'),ped=avg('ped'),phi=avg('phi'),th=avg('th'),gs=avg('gs'),fen=Math.max(...ss.map(s=>s.fenSt));
  const m=Math.max(Math.abs(lat),Math.abs(lon),Math.abs(ped));
  row(`${name}: lat / lon / pedal (stick %)`,`${f0(lat*100)} / ${f0(lon*100)} / ${f0(ped*100)}`,m<0.9,'control margin left (≥ 10 % of travel)');
  row(`… bank / pitch / drift over ground / Fenestron stall / FLI`,`${f1(phi)}° / ${f1(th)}° / ${f1(gs)} m/s / ${f2(fen)} / ${f1(w.fliMax)}`,gs<1.0&&w.fliMax<11.6,'held in position, within the take-off rating');}}

if(on('S3')){console.log('\n■ S3 collective snapped to the top in 0.5 s in the hover (2500 kg, 1000 ft), attitude held, feet still');
 const F=trimmedHover();const w=watcher(F);const c0=F.IN.col,P0=F.S.Pload,th0=F.S.eul[1],ph0=F.S.eul[0],I={};let s5=null,rMax=0,vs5=0;
 direct(F,5,(t)=>Object.assign({col:Math.min(1,c0+(1-c0)*t/0.5)},attP(F,th0,ph0,I)),(t,s)=>{w.f();rMax=Math.max(rMax,s.r);s5=s;});
 const dP=F.S.Pload-P0,W=F.S.m*9.81;vs5=s5.vs*0.00508;
 row('FLI peak (11.5 = take-off limit) / overtorque warning',`${f1(w.fliMax)} / ${w.inc.has('overtorque')?'yes':'no'}`,w.fliMax>11.5===w.inc.has('overtorque'),'the engines stop at their take-off power; the warning comes if the FLI passes 11.5');
 row('NR minimum / low-NR warning',`${f1(w.nrMin)} % / ${w.inc.has('lownr')?'yes':'no'}`,w.nrMin>94.5||w.inc.has('lownr'),'full lever is more than the engines give: NR droops (overpitching), the horn must come below 94.5 %');
 row('climb rate after 5 s against the excess power',`${f0(s5.vs)} fpm`,vs5>dP/W*0.8&&vs5<dP/W*2.2,`between ΔP/W and 2ΔP/W: ${f0(dP/W/0.00508)}–${f0(2*dP/W/0.00508)} fpm (ΔP ${f0(dP/1e3)} kW)`);
 row('yaw rate peak in 5 s, feet still',f0(rMax)+' °/s',rMax>10,'nose right with the torque (counterclockwise rotor); ΔQ/N_r ≈ 5 kNm / (4900 kg m² · 0.56/s) ≈ 110 °/s');sane('collective snap',w);}

if(on('S4')){console.log('\n■ S4 collective dumped in 0.5 s at 150 kt, engines running (2500 kg)');
 const F=trimmedCruise(150);const w=watcher(F);const c0=F.IN.col,s0=st(F);let s1=null,rMin=0,nz1=9;
 direct(F,1.2,t=>({col:Math.max(0,c0*(1-t/0.5))}),(t,s)=>{w.f();rMin=Math.min(rMin,s.r);nz1=Math.min(nz1,s.nz);if(Math.abs(t-1)<F.DT/2)s1=s;});
 row('cyclic frozen, 1 s after: pitch change / load factor min',`${f1(s1.th-s0.th)}° / ${f2(nz1)}`,s1.th<s0.th&&nz1<0.6,'less thrust, less flap-back: nose down; unloaded');
 row('… below the structural limit of -1 g (CS 27.337) / a warning for it',`${nz1<-1?'yes':'no'} / ${[...w.inc].join(',')||'none'}`,nz1>=-1||w.inc.has('gload'),'(2.16.7) the load-factor warning must come');
 row('… yaw rate (feet still)',f0(rMin)+' °/s',rMin<-3,'less torque: nose left');
 const I={};direct(F,8,()=>Object.assign({col:0},attP(F,0,0,I)),()=>w.f());
 row('NR peak, collective down, wings level (power-off limit 106 %)',f1(w.nrMax)+' %',null,'the engines cannot brake the rotor: an overspeed is real here; the pilot must raise the lever');
 row('… overspeed warning given',w.inc.has('overspeed')?'yes':'no ('+([...w.inc].join(',')||'none')+')',w.nrMax<106||w.inc.has('overspeed'),'above 106 % the warning must come');sane('collective dump',w);}

if(on('S5')){console.log('\n■ S5 overpitching on one engine: 2910 kg, ISA+20, 1000 ft, engine 1 fails, collective pulled beyond the power');
 const res={};for(const dc of [0.03,0.15]){const F=trimmedHover({mass:2910,dT:20});const w=watcher(F);F.S.eng.e[0].fail=true;const c0=F.IN.col;let ss=[];
  ap(F,10,null,t=>({col:c0+dc*Math.min(1,t/0.5)}),(t,s)=>{w.f();if(t>7)ss.push(s);});
  res[dc]={vs:ss.reduce((a,s)=>a+s.vs,0)/ss.length,nr:ss.reduce((a,s)=>a+s.nr,0)/ss.length,w};}
 row('collective +3 % / +15 %: NR after 7–10 s',`${f1(res[0.03].nr)} / ${f1(res[0.15].nr)} %`,res[0.15].nr<res[0.03].nr-2,'beyond the power the rotor slows (thrust ~ NR²)');
 row('… vertical speed',`${f0(res[0.03].vs)} / ${f0(res[0.15].vs)} fpm`,null,'at a lower NR the profile power falls with NR³: the same power carries a little more (the blades\' lift coefficient rises with 1/NR²)');
 row('… low-NR warning (+15 %)',[...res[0.15].w.inc].join(',')||'none',res[0.15].nr>=97||res[0.15].w.inc.has('lownr'),'below 97 % the warning must come');}

if(on('S6')){console.log('\n■ S6 both engines fail in a hover at 1000 ft (2500 kg): lever down, right pedal, nose down 15° to 60 kt (airspeed along the body)');
 for(const delay of [0.3,1.0]){const F=trimmedHover();const w=watcher(F);for(const en of F.S.eng.e)en.fail=true;const h0=F.S.hAGL,psi0=F.S.eul[2];let c=F.IN.col,I={},J={},h55=null,vs55=0,thC=-15*D,yawMax=0,tStop=null;
 direct(F,40,(t)=>{const s=st(F);if(t<delay)return {};c=t<delay+0.6?Math.max(0,c-F.DT*1.0):cl(c+(s.nr-101)*F.DT*0.04,0,1);
   const u=F.S.vb[0]/F.KT;thC=u<50?-15*D:cl(thC+(u-62)*F.DT*0.006,-16*D,10*D);return Object.assign({col:c,ped:pedP(F,psi0,J)},attP(F,thC,0,I));},
  (t,s)=>{if(s.h<40)return;w.f();const dp=Math.abs(((s.psi-psi0*R+540)%360)-180);yawMax=Math.max(yawMax,dp);if(tStop===null&&t>delay+0.2&&s.r>-2)tStop=t;if(h55===null&&F.S.vb[0]/F.KT>=55){h55=h0-s.h;vs55=s.vs;}});
 row(`reaction after ${delay} s: height lost until 55 kt`,h55===null?'not reached above 130 ft':f0(h55/0.3048)+' ft',delay<0.5?h55!==null&&h55/0.3048>150&&h55/0.3048<700:null,'from a zero-speed hover several hundred feet (the H-V diagram\'s upper hover height)');
 row('… yaw: largest heading change / left yaw stopped after',`${f0(yawMax)}° / ${tStop===null?'never':f1(tStop)+' s'}`,null,'the anti-torque stays while the torque goes: nose left. Full right pedal gives only -0.2 kN of fan thrust (full left +3.5 kN) against the drive of the fan and accessories: an open point, not checked against the type');
 row('… sink rate on reaching 55 kt',f0(vs55)+' fpm',null,'');
 row('… NR minimum / maximum (power-off limits 85–106 %)',`${f1(w.nrMin)} / ${f1(w.nrMax)} %`,w.nrMin>70&&w.nrMax<110,'the 1-s delay costs NR: AAIB (Airbus simulation) 69–71 % after 2 s at full lever');sane('hover autorotation',w);}}

if(on('S7')){console.log('\n■ S7 60° bank at 110 kt (2500 kg), collective up to the take-off rating, pitch held');
 const F=trimmedCruise(110);const w=watcher(F);const s0=st(F),tas0=F.S.tas,I={};let nzs=[],sEnd=null,c=F.IN.col;
 direct(F,15,(t)=>{c=cl(c+F.DT*(F.S.eng.fli<11.2?0.12:-0.3),0,1);return Object.assign({col:c},attP(F,s0.th*D+2*D,60*D,I));},(t,s)=>{w.f();if(t>3)nzs.push(s.nz);sEnd=s;});
 const nz=nzs.reduce((a,b)=>a+b,0)/nzs.length;
 row('mean load factor from 3 s (60° level needs 2.0)',f2(nz),nz>1.6,'');
 const vb=F.S.vb,fl=Math.acos(Math.max(-1,Math.min(1,vb[0]/Math.max(F.S.tas,1e-6))))*R;
 row('true airspeed / height change in 15 s; the airspeed indicator, flow angle at the end',`${f0((F.S.tas-tas0)/F.KT)} kt / ${f0((sEnd.h-s0.h)/0.3048)} ft; ${f0(sEnd.ias)} kt, ${f0(fl)}°`,null,'2 g at 110 kt: C_T/σ ≈ 0.15, at the edge of the rotor\'s thrust; a level 60° turn bleeds speed or height');
 row('retreating-blade stall (fraction of the disc)',f2(w.stall),w.stall>0.02,'stall appears near C_T/σ 0.12–0.15 at μ ≈ 0.27');sane('60° turn',w);}

if(on('S8')){console.log('\n■ S8 zoom from 140 kt to 50° nose up, then hands off into the tail slide (SAS off)');
 const F=trimmedCruise(140);const w=watcher(F);const b={lon:F.IN.lon,lat:F.IN.lat,ped:F.IN.ped,col:F.IN.col},I={};let slide=false,tS=0,vMin=0,thMin=90,thMax=-90,rMax=0;
 direct(F,22,(t)=>{if(!slide&&F.S.vb[0]<3){slide=true;tS=t;}if(slide)return {lon:b.lon,lat:b.lat,ped:b.ped};return attP(F,50*D,0,I);},(t,s)=>{w.f();if(slide&&t-tS<8){vMin=Math.min(vMin,F.S.vb[0]);thMin=Math.min(thMin,s.th);thMax=Math.max(thMax,s.th);rMax=Math.max(rMax,Math.abs(s.r));}});
 row('tail slide reached / backward speed along the body',slide?`yes / ${f1(-vMin)} m/s`:'no',slide,'');
 row('… pitch range in the 8 s after / peak yaw rate',`${f0(thMin)}° … ${f0(thMax)}° / ${f0(rMax)} °/s`,thMin<thMax-20,'the nose falls through (weathervane in pitch) and the tail swings round');
 row('… NR range until the ground / end',`${f1(w.nrMin)}–${f1(w.nrMax)} % / ${w.crash||'none'}`,null,'reverse flow through the disc unloads the rotor, the governor cannot hold 100 %');sane('tail slide',w);}

if(on('S9')){console.log('\n■ S9 aileron roll: 120 kt, pull to 20° nose up, roll right at up to 90 °/s, collective held (SAS off)');
 const F=trimmedCruise(120);const w=watcher(F);const h0=F.S.alt,I={},J={};let roll=0,phase=0,tRoll=0,t0=0;
 direct(F,20,(t)=>{const [phi,th]=F.S.eul;if(phase===0){if(th>18*D){phase=1;t0=t;}return attP(F,22*D,0,I);}
   if(phase===1){roll+=F.S.om[0]*F.DT;if(roll>=2*Math.PI-15*D){phase=2;tRoll=t-t0;}return rateP(F,90*D,0,J);}
   return attP(F,0,0,I);},()=>w.f());
 row('roll completed / time for 360°',phase===2?`yes / ${f1(tRoll)} s`:'no',phase===2&&tRoll<7,'a hingeless rotor keeps its control moment at low and negative g (BO 105 displays)');
 row('… peak roll rate / load factor range',`${f0(w.pMax)} °/s / ${f2(w.nzMin)}…${f2(w.nzMax)}`,w.pMax>60,'about the bare aircraft\'s full-stick rate (80–100 °/s)');
 row('… height change at the end / NR range',`${f0((F.S.alt-h0)/0.3048)} ft / ${f1(w.nrMin)}–${f1(w.nrMax)} %`,w.nrMin>90&&!w.crash,'loses height while inverted');sane('aileron roll',w);}

if(on('S10')){console.log('\n■ S10 loop: 140 kt, collective +12 %, pull at about 2 g (SAS off)');
 const F=trimmedCruise(140);const w=watcher(F);const h0=F.S.alt,c0=F.IN.col,I={},J={};let ang=0,done=false,vTop=999,hMax=-1e9,tDone=0;
 direct(F,30,(t)=>{if(!done){ang+=F.S.om[1]*F.DT;if(ang>=2*Math.PI-10*D){done=true;tDone=t;}const V=Math.max(15,Math.hypot(...F.S.vb));
   if(ang>Math.PI*0.4&&ang<Math.PI*1.4)vTop=Math.min(vTop,F.S.ias/F.KT);hMax=Math.max(hMax,F.S.alt);return Object.assign({col:Math.min(1,c0+0.12)},rateP(F,0,cl(1.1*9.81/V,8*D,30*D),J));}
   return Object.assign({col:c0},attP(F,0,0,I));},()=>w.f());
 row('loop completed / time',done?`yes / ${f1(tDone)} s`:'no',null,'the EC135 is not cleared for aerobatics; the physics allows it with a hingeless rotor');
 row('… IAS over the top / height gained at the top',`${f0(vTop)} kt / ${f0((hMax-h0)/0.3048)} ft`,null,'');
 row('… load factor range / NR range / crash',`${f2(w.nzMin)}…${f2(w.nzMax)} / ${f1(w.nrMin)}–${f1(w.nrMax)} % / ${w.crash||'none'}`,!w.crash,'');sane('loop (pitch through ±90°)',w);
 {const G=trimmedCruise(140);G.AP.on=false;G.cfg.sas=true;G.cfg.attHold=true;G.cfg.cycLaw='rcah';const w2=watcher(G);let thMax=-90;G.DEV.mouse.armed=true;pipe(G,1,()=>{G.DEV.mouse.vy=0;G.DEV.mouse.vx=0;});pipe(G,10,(t)=>{G.DEV.mouse.vy=1;G.DEV.mouse.vx=0;},(t,s)=>{w2.f();thMax=Math.max(thMax,s.th);});   /* centred first: a stick already deflected when the law takes over is its new centre */
  row('same with the aids on (full aft stick held 10 s): max pitch',f0(thMax)+'°',thMax<30,'the rate command stops at its 26° limit; no loop by accident');sane('aids on, full aft',w2);}
 {const G=trimmedCruise(120);G.AP.on=false;G.cfg.sas=true;G.cfg.attHold=true;G.cfg.cycLaw='rcah';G.DEV.mouse.armed=true;let phMax=0;pipe(G,1,()=>{G.DEV.mouse.vx=0;G.DEV.mouse.vy=0;});pipe(G,6,()=>{G.DEV.mouse.vx=1;},(t,s)=>{phMax=Math.max(phMax,s.phi);});
  row('aids on, full right stick held 6 s at 120 kt: max bank',f0(phMax)+'°',phMax<47,'the rate command stops at its 43° limit');}}

if(on('S11')){console.log('\n■ S11 pushover to negative g at 120 kt (SAS off)');
 const F=trimmedCruise(120);const w=watcher(F);const I={},J={};let pLow=0;
 direct(F,4.5,(t)=>{if(t<1.2)return rateP(F,0,-20*D,J);if(t<2.2)return rateP(F,40*D,-8*D,J);return attP(F,0,0,I);},(t,s)=>{w.f();if(t>1.2&&t<2.2)pLow=Math.max(pLow,s.p);});
 row('minimum load factor',f2(w.nzMin),w.nzMin<0,'a hingeless rotor can push: negative thrust');
 row('roll rate available near the minimum (commanded 40 °/s)',f0(pLow)+' °/s',pLow>20,'no mast bumping, control power stays');
 row('NR range / crash',`${f1(w.nrMin)}–${f1(w.nrMax)} % / ${w.crash||'none'}`,w.nrMin>90&&w.nrMax<108,'');sane('negative g',w);}

if(on('S12')){console.log('\n■ S12 touchdown with 2.5 m/s of drift to the right (2500 kg, 0.6 m/s sink, skid friction across 0.65)');
 const land=(name,ctl,expect,ok)=>{const F=mk('hover');apHover(F);ap(F,4);const th0=F.S.eul[1],ph0=F.S.eul[0],c0=F.IN.col,l0=F.IN.lat;F.S.pos[2]+=F.S.hAGL-0.3;
  {const Rm=F.qmat(F.S.q);for(let i=0;i<3;i++)F.S.vb[i]+=Rm[6+i]*0.6+Rm[3+i]*2.5;}   /* 0.6 m/s down and 2.5 m/s east, in earth axes */
  const w=watcher(F),I={};let touched=false,tT=0,phiMax=0;
  direct(F,5,(t)=>{if(!touched&&F.S.gear.contact>0){touched=true;tT=t;}return ctl({F,t,tT,touched,c0,l0,th0,ph0,I});},(t,s)=>{w.f();if(!w.crash)phiMax=Math.max(phiMax,Math.abs(s.phi));});
  const roll=w.crash==='Rolled over'||/Blade strike/.test(w.crash);
  row(name,`${f0(phiMax)}° / ${roll?'rolled over':'upright'}${w.inc.has('rollover')?', warned':''}`,ok(roll,w),expect);};
 land('pilot holds the attitude, lever eased down: max bank / outcome',({F,touched,c0,th0,ph0,I,t,tT})=>Object.assign({col:touched?Math.max(0,c0-0.06-(t-tT)*0.5):c0-0.06},attP(F,th0,ph0,I)),'stays upright: the leading skid slides',(r)=>!r);
 land('stick and lever frozen at the hover: max bank / outcome',({touched,c0})=>({col:touched?c0-0.03:c0-0.06}),'stays upright: thrust along the mast rights it about the skid',(r)=>!r);
 land('15 % right stick at contact (towards the drift), lever held',({touched,c0,l0})=>({lat:touched?l0+0.15:l0,col:touched?c0-0.03:c0-0.06}),'dynamic rollover over the right skid, warned first',(r,w)=>r&&w.inc.has('rollover'));
 land('the same, the lever lowered at once',({touched,c0,l0,t,tT})=>({lat:touched?l0+0.15:l0,col:touched?Math.max(0,c0-0.06-(t-tT)*1.0):c0-0.06}),'lowering the lever saves it (the standard recovery)',(r)=>!r);}

if(on('S13')){console.log('\n■ S13 vertical touchdowns at different sink rates (2500 kg, hover collective, level)');
 for(const fpm of [200,400,550,800,1100,1400]){const F=mk('hover');apHover(F);ap(F,4);F.S.pos[2]+=F.S.hAGL-0.3;const R_=F.qmat(F.S.q),v=fpm*F.FPM;
  /* sink along the earth vertical, expressed in body axes */ F.S.vb=[R_[6]*v,R_[7]*v,R_[8]*v];const w=watcher(F);const I={};let tv=null;
  direct(F,3,(t)=>Object.assign({col:F.IN.col},attP(F,F.S.eul[1],0,I)),()=>{w.f();if(tv===null&&F.S.touch&&F.S.touch.vs)tv=F.S.touch.vs;});
  row(`${fpm} fpm: touchdown sink / verdict`,`${f0((tv||0)/F.FPM)} fpm / ${w.crash||([...w.inc].includes('hard')?'hard landing':'normal')}`,(fpm<450?!w.inc.has('hard')&&!w.crash:fpm<1150?w.inc.has('hard')||!!w.crash:!!w.crash),fpm<450?'normal':fpm<1150?'hard landing (limit drop of CS 27.725: 13 in ≈ 500 fpm)':'gear destroyed');}}

if(on('S14')){console.log('\n■ S14 run-on landing at 40 kt on the runway, lever down at contact (2500 kg)');
 const F=mk('approach');F.S.pos[0]=-860;F.S.pos[1]=-150;F.S.pos[2]=-(F.terrainH(-860,-150)+3+1.30);apCruise(F,40);F.AP.alt=-F.S.pos[2];ap(F,15);const w=watcher(F);const c0=F.IN.col,I={};let touched=false,tT=0,x0=0,v0=0,thMin=90,tStop=null,dist=0;
 direct(F,20,(t)=>{if(!touched&&F.S.gear.contact>0){touched=true;tT=t;x0=[F.S.pos[0],F.S.pos[1]];v0=st(F).gs;}const c=attP(F,1*D,0,I);
   return Object.assign({col:!touched?c0-0.05:Math.max(0,c0-0.05-(t-tT)*0.5)},c);},(t,s)=>{w.f();if(touched){thMin=Math.min(thMin,s.th);if(tStop===null&&s.gs<0.3){tStop=t-tT;dist=Math.hypot(F.S.pos[0]-x0[0],F.S.pos[1]-x0[1]);}}});
 row('ground speed at contact / slide to a stop',`${f1(v0)} m/s / ${tStop===null?'not stopped':f0(dist)+' m in '+f1(tStop)+' s'}`,tStop!==null&&dist>v0*v0/(2*9.81*0.8)&&dist<v0*v0/(2*9.81*0.15),'skid friction μ 0.15–0.8 (rotor lift unloads it at first)');
 row('… lowest pitch on the skids / crash',`${f1(thMin)}° / ${w.crash||'none'}`,!w.crash&&thMin>-10,'no nose-over');sane('run-on landing',w);}

if(on('S15')){console.log('\n■ S15 random full-range inputs at 4 Hz, 40 s, SAS off, from the 1000 ft hover (5 seeds)');
 let worst={nan:false,q:0},crashes=[];for(let seed=1;seed<=5;seed++){let x=seed*9301;const rnd=()=>{x=(x*16807)%2147483647;return x/2147483647;};
  const F=trimmedHover();const w=watcher(F);let c={};direct(F,40,(t)=>{if(Math.round(t*360)%90===0)c={lon:rnd()*2-1,lat:rnd()*2-1,ped:rnd()*2-1,col:rnd()};return c;},()=>w.f());
  worst.nan=worst.nan||w.nan;worst.q=Math.max(worst.q,w.qerr);crashes.push(w.crash||'-');}
 row('NaN / quaternion error over 200 s of abuse',`${worst.nan?'NaN':'none'} / ${worst.q.toExponential(0)}`,!worst.nan&&worst.q<1e-6,'');row('… outcomes',crashes.join(', '),null,'');
 {const F=trimmedHover();F.AP.on=false;F.cfg.sas=true;F.cfg.attHold=true;F.DEV.mouse.armed=true;const w=watcher(F);let x=7;const rnd=()=>{x=(x*16807)%2147483647;return x/2147483647;};
  pipe(F,40,(t)=>{if(Math.round(t*360)%45===0){F.DEV.mouse.vx=rnd()*2-1;F.DEV.mouse.vy=rnd()*2-1;}},()=>w.f());
  row('aids on, the mouse thrown about at 8 Hz for 40 s: peak rates p/q/r',`${f0(w.pMax)} / ${f0(w.qMax)} / ${f0(w.rMax)} °/s`,!w.nan&&w.pMax<150&&w.qMax<80,'the laws stay bounded');}}

if(on('S16')){console.log('\n■ S16 both engines fail at 140 kt in level flight: the first rotor deceleration against P/(I·Ω)');
 const F=trimmedCruise(140);const Om=F.S.rot.Om,P=F.S.Peng,nr0=F.S.NR;for(const en of F.S.eng.e)en.fail=true;const w=watcher(F);let nr02=0;
 direct(F,0.2,null,(t,s)=>{w.f();nr02=s.nr;});const meas=(nr0-nr02)/0.2,exp=P/(F.H.rotor.Ir*Om*Om)*100;
 row('NR decay in the first 0.2 s, lever held',f1(meas)+' %/s',meas>exp*0.9&&meas<exp*1.3,`P/(I_R·Ω²) = ${f1(exp)} %/s with the whole load (${f0(P/1e3)} kW: rotor, Fenestron, accessories, gear losses); the torque rises as Ω falls`);
 direct(F,1.0,null,()=>w.f());row('… NR 1.2 s after with the lever still held',f1(F.S.NR)+' %',null,'why the lever must go down at once');}

if(on('S17')){console.log('\n■ S17 energy balance in autorotation (engines off, still air, gentle random cyclic, 60 s)');
 const F=trimmedCruise(80);F.WIND.turb=0;F.WIND.spd=0;F.WIND.gust=0;for(const en of F.S.eng.e)en.fail=true;let c=F.IN.col;const I={};let x=3;const rnd=()=>{x=(x*16807)%2147483647;return x/2147483647;};
 const psi0=F.S.eul[2],J={};direct(F,4,()=>{c=cl(c+(F.S.NR-100)*F.DT*0.04-F.DT*0.3,0,1);return Object.assign({col:c,ped:pedP(F,psi0,J)},attP(F,0,0,I));});
 let E=energy(F),Emax=0,ths=0,phs=0;const w=watcher(F);
 direct(F,60,(t)=>{if(Math.round(t*360)%360===0){ths=(rnd()*10-3)*D;phs=(rnd()*30-15)*D;}c=cl(c+(F.S.NR-100)*F.DT*0.04,0,1);return Object.assign({col:c,ped:pedP(F,F.S.eul[2]+(F.S.vb[1]/Math.max(20,F.S.vb[0])),J)},attP(F,ths,phs,I));},
  (t)=>{w.f();if(Math.round(t*360)%180===0){const e=energy(F);Emax=Math.max(Emax,e-E);E=e;}});
 row('largest energy gain over any 0.5 s (kJ), no power in',f1(Emax/1e3),Emax<5e3,'still air and no engine: the total energy can only fall');
 row('… height above ground at the end / crash',`${f0(F.S.hAGL)} m / ${w.crash||'none'}`,null,'');sane('autorotation energy',w);}

if(on('S18')){console.log('\n■ S18 the airspeed reading in a vertical descent (engines off, 1000 ft, collective down, no forward speed)');
 const F=trimmedHover();F.S.pos[2]-=600;for(const en of F.S.eng.e)en.fail=true;const psi0=F.S.eul[2],I={},J={};let c=F.IN.col,r=null,fwdLatch=false;
 direct(F,14,()=>{c=cl(c+(F.S.NR-100)*F.DT*0.04-(F.S.NR>95?F.DT*0.3:0),0,1);return Object.assign({col:c,ped:pedP(F,psi0,J)},attP(F,3*D,0,I));},(t,s)=>{if(F.S.ias>45*F.KT)fwdLatch=true;r=s;});
 const u=Math.max(0,F.S.vb[0])*Math.sqrt(F.S.rho/1.225)/F.KT;
 row('sink / forward air speed along the body / model IAS',`${f0(r.vs)} fpm / ${f0(u)} kt / ${f0(r.ias)} kt`,Math.abs(r.ias-u)<10,'a pitot reads the flow along its tube: about the forward part; the model takes the whole vector');
 row('… the forward-flight laws (RCAH above 45 kt) would engage',fwdLatch?'yes':'no',!fwdLatch,'they belong to forward flight, not to a vertical descent');
 row('… the vortex-ring warning can fire (rule: IAS < 30 kt)',r.ias<30?'yes':'no',r.ias<30||r.vs>-500,'at 3000 fpm the sink alone reads 30 kt');}

if(on('S19')){console.log('\n■ S19 gusts (2.16.7): single events along the mean wind, 15 kt wind, gust setting 8 kt, 10 min at the aircraft');
 const F=mk('high');F.WIND.spd=15;F.WIND.dir=0;F.WIND.turb=0;F.WIND.gust=8;F.windReset(3);const dt=1/60,w=[];for(let i=0;i<600/dt;i++){const v=F.windAt(dt,10,300);w.push(Math.hypot(v[0],v[1])/F.KT);}
 const base=15*F.windProfile(300);let ev=0,inG=false,mx=0;for(const v of w){const g=Math.abs(v-base)>0.5;if(g&&!inG)ev++;inG=g;mx=Math.max(mx,Math.abs(v-base));}
 let pk=[0,0];for(let f=0.1;f<=2;f+=0.05){let c=0,sn=0;for(let i=0;i<w.length;i++){c+=(w[i]-base)*Math.cos(2*Math.PI*f*i*dt);sn+=(w[i]-base)*Math.sin(2*Math.PI*f*i*dt);}const a=Math.hypot(c,sn)/w.length*2;if(a>pk[1])pk=[f,a];}
 row('gust events per minute / largest change of the wind',`${f1(ev/10)} / ${f1(mx)} kt`,ev/10>=2.5&&ev/10<=8&&mx<=8.1&&mx>=4,'one every 6 to 21 s, up to the set amplitude (until 2.16.6 the wind pumped once a second without a pause)');
 row('… strongest frequency in the wind',`${f2(pk[0])} Hz`,pk[0]<0.6,'the gusts last 2 to 5 s: below 0.5 Hz, no 1 Hz line');}

if(on('S20')){console.log('\n■ S20 (2.17.1) the wind over the terrain: 20 kt from the west at the Kuppe (2350 N, 700 E, 260 m); the low-altitude turbulence');
 const F=mk('high');F.WIND.spd=20;F.WIND.dir=270;F.WIND.turb=0;F.WIND.gust=0;F.windReset(5);const K=[2350,700],U=20*F.KT;
 const at=(de,h)=>{const n=K[0],e=K[1]+de,g=F.terrainH(n,e);F.WST.terT=0;const v=F.windAt(1/60,U,h,[n,e,-(g+h)]);return {v,w:v[2],sp:Math.hypot(v[0],v[1]),q:F.WST.q,s:F.WST.s,U0:U*F.windProfile(h)};};
 const wd=at(-300,30),lee=at(400,30),top=at(0,30),fl=(()=>{F.WST.terT=0;const v=F.windAt(1/60,U,30,[0,0,-30]);return {w:v[2],q:F.WST.q};})();
 row('windward flank, 300 m west of the top, 30 m up: vertical wind / of the wind there',`${f1(-wd.w)} m/s up (${f0(-wd.w/F.FPM)} fpm) / ${f2(-wd.w/wd.U0)}`,-wd.w/wd.U0>0.15&&-wd.w/wd.U0<0.5,'the air follows the slope, up to 0.4 of the wind near the ground');
 row('lee, 400 m east of the top, 30 m up: wake / wind speed against the free wind / vertical',`${f2(lee.q)} / ${f2(lee.sp/lee.U0)} / ${f1(lee.w)} m/s down`,lee.q>0.6&&lee.sp/lee.U0<0.7&&lee.w>0,'sheltered and sinking behind a 30° flank');
 row('on the summit, 30 m up: wake / vertical',`${f2(top.q)} / ${f1(top.w)} m/s`,top.q<0.1&&Math.abs(top.w)<1,'in the free wind');
 row('the field (flat, far from the hills): wake / vertical',`${f2(fl.q)} / ${f2(fl.w)} m/s`,fl.q<0.05&&Math.abs(fl.w)<0.5,'');
 // the turbulence's intensity and pace with height (the setting 1: σ_u 1 m/s at 300 ft), 15 min of samples each
 const stat=(h,de)=>{const G=mk('high');G.WIND.spd=15;G.WIND.dir=270;G.WIND.turb=1;G.WIND.gust=0;G.windReset(9);const n=de===undefined?0:K[0],e=de===undefined?0:K[1]+de,g=G.terrainH(n,e);const us=[],ws=[];
   for(let i=0;i<900*20;i++){const v=G.windAt(1/20,15*G.KT*G.windProfile(h),h,[n,e,-(g+h)]);us.push(v[0]);ws.push(v[2]);}   // 15 min: the big eddies aloft pass in ~25 s
   const sd=a=>{const m=a.reduce((x,y)=>x+y,0)/a.length;return Math.sqrt(a.reduce((x,y)=>x+(y-m)**2,0)/a.length);};
   let zc=0;const mu=us.reduce((x,y)=>x+y,0)/us.length;for(let i=1;i<us.length;i++)if((us[i]-mu)*(us[i-1]-mu)<0)zc++;return {su:sd(us),sw:sd(ws),f:zc/2/900};};
 const lo=stat(3),hi=stat(300),lw=stat(30,400);
 row('turbulence near the ground (10 ft) against 1000 ft: horizontal intensity / vertical against horizontal at 10 ft',`${f2(lo.su/hi.su)} / ${f2(lo.sw/lo.su)}`,lo.su/hi.su>1.4&&lo.su/hi.su<2.6&&lo.sw/lo.su<0.6,'MIL-HDBK-1797: 2 near the ground, the vertical gusts small there');
 row('… the horizontal gusts\' pace near the ground against 1000 ft',`${f1(lo.f/hi.f)} times`,lo.f/hi.f>1.5,'smaller eddies, quicker');
 row('… in the Kuppe\'s lee (30 m up) against the free air at 30 m: horizontal intensity',`${f2(lw.su/stat(30).su)} times`,lw.su/stat(30).su>1.5,'the wake tumbles');}

if(on('S21')){console.log('\n■ S21 (2.17.1) start faults: a normal start, a hot start, a hung start, each left alone or aborted at the first warning');
 const start=(kind,abort)=>{const F=mk('cold');F.WIND.spd=0;F.WIND.turb=0;F.uiReset('cold');F.S.eng.brake=false;if(kind)F.ENGFAULT.next={i:0,kind};F.engSwitch(F.S.eng,0,'idle');
   let peak=0,n1max=0,warn=null,dmgT=null,t=0,cut=null;const en=F.S.eng.e[0];
   for(;t<60;t+=F.DT){F.step(F.DT);peak=Math.max(peak,en.TOT);n1max=Math.max(n1max,en.N1);const inc=F.S.incident&&F.S.incident.id;
     if(!warn&&(inc==='hotstart'||inc==='hungstart'))warn={id:inc,t};if(abort&&warn&&cut===null){F.engSwitch(F.S.eng,0,'off');cut=t;}if(en.damaged&&dmgT===null)dmgT=t;if(!en.on&&!abort&&!en.damaged&&t>30)break;}
   return {peak,n1max,warn,dmgT,cut,idle:en.on&&en.startT<=0,dmg:!!en.damaged};};
 const N=start(null,false),Hn=start('hot',false),Ha=start('hot',true),Gn=start('hung',false),Ga=start('hung',true);
 row('normal start: TOT peak / at idle after 60 s / a warning',`${f0(N.peak)} °C / ${N.idle?'yes':'no'} / ${N.warn?N.warn.id:'none'}`,N.peak>700&&N.peak<760&&N.idle&&!N.warn,'760 °C the start\'s continuous limit');
 row('hot start left alone: the warning at / damaged at / TOT peak',`${Hn.warn?f1(Hn.warn.t)+' s':'none'} / ${Hn.dmgT!==null?f1(Hn.dmgT)+' s':'no'} / ${f0(Hn.peak)} °C`,!!Hn.warn&&Hn.dmg&&Hn.warn.t<Hn.dmgT,'warned first, then above 875 °C for 2 s');
 row('hot start aborted at the warning: TOT peak / damaged',`${f0(Ha.peak)} °C / ${Ha.dmg?'yes':'no'}`,!Ha.dmg&&Ha.peak<875,'switched off in time');
 row('hung start left alone: N1 at most / the warning at / damaged at',`${f0(Gn.n1max)} % / ${Gn.warn?f1(Gn.warn.t)+' s':'none'} / ${Gn.dmgT!==null?f1(Gn.dmgT)+' s':'no'}`,Gn.n1max<45&&!!Gn.warn&&Gn.dmg,'stuck short of idle, the TOT creeping up');
 row('hung start aborted at the warning: damaged',Ga.dmg?'yes':'no',!Ga.dmg,'');}

console.log(`\n${bad?bad+' to check':'all stress checks as expected'}`);process.exit(0);
