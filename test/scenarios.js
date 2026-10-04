/* Scenario analysis: signs and magnitudes of the yaw, pitch and roll
   physics and of the control-law interventions in normal and limit
   manoeuvres. Groups: A yaw/pedal physics, B cyclic and limit manoeuvres,
   C control laws in those manoeuvres. `node test/scenarios.js A|B|C`. */
const {loadFull}=require('./loadfull.js');
const R=180/Math.PI;let bad=0;
function row(name,val,ok,expect){if(!ok)bad++;console.log(`  ${ok?'OK   ':'CHECK'} ${name.padEnd(62)} ${String(val).padStart(12)}   ${expect}`);}
function mk(kind,o={}){const F=loadFull();F.WIND.spd=o.wind||0;F.WIND.dir=o.wdir===undefined?270:o.wdir;F.WIND.turb=0;F.cfg.mass=o.mass||2500;F.cfg.dT=o.dT||0;
  Object.assign(F.cfg,{sas:true,attHold:true,hdgHold:true,hoverAssist:false,kbdCol:'metered',kbdPed:'heading',pedRate:25});F.uiReset(kind);return F;}
const ang=a=>((a+540)%360)-180;
function st(F){const S=F.S,v=F.mrot(F.qmat(S.q),S.vb);return {p:S.om[0]*R,q:S.om[1]*R,r:S.om[2]*R,phi:S.eul[0]*R,th:S.eul[1]*R,psi:S.eul[2]*R,gs:Math.hypot(v[0],v[1]),ias:S.ias/F.KT,vs:S.vs/F.FPM,h:S.hAGL,nr:S.NR,fli:S.eng.fli,P:S.Pload/1e3,nz:S.nz,ay:S.ay,fenSt:S.fen.stall,stall:S.rot.stall,ped:S.ctl.ped,col:S.ctl.col,lon:S.ctl.lon,lat:S.ctl.lat,mtip:S.rot.Mtip};}
/* direct: the controls as the airframe sees them (no SAS), ctl(t) returns overrides */
function direct(F,sec,ctl,rec){const base={col:F.IN.col,lon:F.IN.lon,lat:F.IN.lat,ped:F.IN.ped};for(let i=0;i<sec/F.DT;i++){const t=i*F.DT;const c=Object.assign({},base,ctl?ctl(t,base):{});F.IN.col=c.col;F.IN.lon=c.lon;F.IN.lat=c.lat;F.IN.ped=c.ped;F.step(F.DT);if(rec)rec(t,st(F));}}
/* autopilot flies, mod(t,AP) may change its targets; except lists axes the scenario sets itself */
function ap(F,sec,mod,except,rec){const A=F.AP;A.on=true;for(let i=0;i<sec/F.DT;i++){const t=i*F.DT;if(mod)mod(t,A);const o=F.apStep(F.DT);const ex=except?except(t):{};for(const k of ['col','lon','lat','ped'])F.IN[k]=ex[k]!==undefined?ex[k]:o[k];F.step(F.DT);if(rec)rec(t,st(F));}}
function apHover(F){const A=F.AP;A.mode='hover';A.auto=false;A.alt=F.S.alt;A.hdg=F.S.eul[2];A.posN=F.S.pos[0];A.posE=F.S.pos[1];A.vN=0;A.vE=0;A.freezeInt=false;A.pOnly=false;}
function apCruise(F,kt){const A=F.AP;A.mode='cruise';A.auto=false;A.ias=kt;A.alt=F.S.alt;A.hdg=F.S.eul[2];A.posN=null;A.posE=null;A.freezeInt=false;A.pOnly=false;}
/* the browser pipeline */
function pipe(F,sec,fn,rec){for(let i=0;i<sec/F.DT;i++){const t=i*F.DT;if(fn)fn(t);F.inputStep(F.DT);F.tutorStep(F.DT);F.coachStep(F.DT);F.step(F.DT);if(rec)rec(t,st(F));}}
module.exports={mk,st,direct,ap,apHover,apCruise,pipe,row,ang,R,get bad(){return bad;},attPilot:(...a)=>attPilot(...a)};
const G=process.argv[2]||'A';
if(require.main===module&&G==='A'){
console.log('\n■ A1 pedal turns in the hover at 30 °/s, autopilot holds height and position');
{const res={};for(const dir of [1,0,-1]){const F=mk('high');apHover(F);let P=0,n=0;ap(F,14,(t,A)=>{if(dir)A.hdg=F.S.eul[2]+dir*30/R*0.25;},null,(t,s)=>{if(t>4){P+=F.S.fen.P/1e3;n++;}});res[dir]=P/n;}
 row('Fenestron power: right turn / hover / left turn (kW)',`${res[1].toFixed(1)} / ${res[0].toFixed(1)} / ${res[-1].toFixed(1)}`,res[1]>res[0]&&res[-1]<res[0],'right turn needs more, left less (the yaw changes the fan inflow)');}
console.log('\n■ A2 full pedal for 3 s from a trimmed hover, SAS off, other axes held');
{for(const [name,ped] of [['right',1],['left',-1]]){const F=mk('high');apHover(F);let rmax=0,r1=0,fst=0,nrmin=200,fl=0;ap(F,3,null,()=>({ped}),(t,s)=>{rmax=Math.max(rmax,Math.abs(s.r));if(Math.abs(t-1)<F.DT/2)r1=Math.abs(s.r);fst=Math.max(fst,s.fenSt);nrmin=Math.min(nrmin,s.nr);fl=Math.max(fl,s.fli);});
  row(`full ${name} pedal: yaw rate after 1 s / 3 s (°/s)`,`${r1.toFixed(0)} / ${rmax.toFixed(0)}`,r1>50&&r1<140&&rmax<260,name==='right'?'full fan authority, fin and boom damp (the flight manual limits hover turns to 60 °/s)':'left: Fenestron thrust ~0, rotor torque unopposed (fin and boom damp)');row(`full ${name} pedal: Fenestron stalled fraction`,fst.toFixed(2),name==='right'?fst>0.2:true,name==='right'?'right (high pitch) stalls':'—');
  row(`full ${name} pedal: NR minimum / FLI max`,`${nrmin.toFixed(1)} / ${fl.toFixed(1)}`,nrmin>96,'governor holds NR');}}
console.log('\n■ A3 couplings and the yaw kick');
{let F=mk('high');apHover(F);let r1=0;ap(F,1.5,null,t=>({col:F.TRIM.col+0.1,ped:F.SAS.intP}),(t,s)=>{if(Math.abs(s.r)>Math.abs(r1))r1=s.r;});row('collective +10 %, pedals fixed: yaw',r1.toFixed(1)+' °/s',r1<-5,'nose left (clockwise rotor)');
 F=mk('high');apHover(F);let r2=0;ap(F,0.01);const pedT=F.IN.ped;for(const en of F.S.eng.e)en.fail=true;ap(F,1.5,null,()=>({ped:pedT,col:F.IN.col}),(t,s)=>{if(Math.abs(s.r)>Math.abs(r2))r2=s.r;});row('both engines fail in the hover, pedals fixed: yaw',r2.toFixed(1)+' °/s',r2>5,'nose right (torque reaction gone)');
 F=mk('high');apCruise(F,65);ap(F,25);const pedP=st(F).ped;for(const en of F.S.eng.e)en.on=false;F.AP.auto=true;F.AP.ias=65;ap(F,25);const pa=st(F).ped;row('pedal at 65 kt: autorotation vs powered',`${pa.toFixed(2)} / ${pedP.toFixed(2)}`,pa<pedP-0.1,'left of the powered position (rotor torque gone)');}
console.log('\n■ A4 pedal needed vs wind azimuth in the hover (17 kt and 30 kt), heading north');
for(const kt of [17,30]){const peds=[];let worst={m:1};for(let wd=0;wd<360;wd+=30){const F=mk('high',{wind:kt,wdir:wd});apHover(F);ap(F,25);const s=st(F);peds.push(s.ped.toFixed(2));const m=1-Math.abs(s.ped);if(m<worst.m)worst={m,wd,ped:s.ped,fs:s.fenSt,hd:ang(s.psi)};}
 console.log(`    ${kt} kt, wind from 0..330 by 30°: ${peds.join(' ')}`);row(`${kt} kt: smallest pedal margin (wind from ${worst.wd}°)`,`${(worst.m*100).toFixed(0)} %`,kt===17?worst.m>0.1:worst.m>0,kt===17?'>10 % at 17 kt (certification wind)':'some margin left at 30 kt');}
console.log('\n■ A5 pedal in forward flight (100 kt, SAS off, stick and collective fixed)');
{const F=mk('cruise');apCruise(F,100);ap(F,15);let beta=0,p1=0,phi1=0,r3=0;const base=st(F);
 direct(F,4,(t,b)=>({ped:b.ped+(t<2?0.1:0)}),(t,s)=>{if(Math.abs(t-1)<F.DT/2){p1=s.p;phi1=s.phi-base.phi;beta=Math.atan2(F.S.vb[1],F.S.vb[0])*R;}if(Math.abs(t-3.9)<F.DT/2)r3=s.r;});
 row('right pedal +10 % at 100 kt: sideslip after 1 s (°, + = wind from right)',beta.toFixed(1),beta<-1,'nose right → wind from the left');
 row('… roll after 1 s (dihedral effect)',`${phi1.toFixed(1)}°`,phi1>0,'rolls right (rotor flaps away from the wind)');
 row('… yaw rate 1.9 s after release (weathercock)',`${r3.toFixed(1)} °/s`,Math.abs(r3)<4,'fin and Fenestron bring the nose back');}
}
/* a scripted pilot flying an attitude with the raw controls (no SAS) */
function attPilot(F,thC,phC,I){const S=F.S,[phi,th]=S.eul,[p,q]=S.om;I.l=(I.l||F.IN.lon)+(th-thC)*F.DT*0.8;I.r=(I.r||F.IN.lat)+(phC-phi)*F.DT*0.8;
  return {lon:Math.max(-1,Math.min(1,2.2*(th-thC)+0.7*q+I.l)),lat:Math.max(-1,Math.min(1,2.4*(phC-phi)-0.6*p+I.r))};}
if(require.main===module&&G==='B'){
console.log('\n■ B1 speed stability (80 kt, controls frozen, +5 m/s speed disturbance)');
{const F=mk('cruise');apCruise(F,80);ap(F,15);const th0=st(F).th;F.S.vb[0]+=5;let th2=0;direct(F,2,null,(t,s)=>{th2=s.th;});row('pitch change 2 s after a speed increase',`${(th2-th0).toFixed(1)}°`,th2>th0,'nose up: positive speed stability (rotor flaps back)');}
console.log('\n■ B2 angle-of-attack response (100 kt, controls frozen, 3 m/s up-gust)');
{const F=mk('cruise');apCruise(F,100);ap(F,15);F.S.vb[2]+=3;let q1=0,nz=0;direct(F,1,null,(t,s)=>{q1=s.q;nz=Math.max(nz,s.nz);});row('pitch rate 1 s after the gust',`${q1.toFixed(1)} °/s`,Math.abs(q1)<15,'hingeless: mildly unstable (nose up) is typical');row('… load factor peak',nz.toFixed(2),nz>1.05,'the rotor feels the gust');}
console.log('\n■ B3 pitch–roll cross-coupling in the hover (10 % step, 1 s, SAS off)');
{let F=mk('high');apHover(F);ap(F,0.05);let p1=0,q1=0;direct(F,1,(t,b)=>({lon:b.lon+0.1}),(t,s)=>{p1=s.p;q1=s.q;});row('forward stick: roll rate / pitch rate',`${(p1/Math.abs(q1)).toFixed(2)}`,Math.abs(p1/q1)<0.6,'coupling below 60 % of the on-axis rate');
 F=mk('high');apHover(F);ap(F,0.05);let p2=0,q2=0;direct(F,1,(t,b)=>({lat:b.lat+0.1}),(t,s)=>{p2=s.p;q2=s.q;});row('right stick: pitch rate / roll rate',`${(q2/Math.abs(p2)).toFixed(2)}`,Math.abs(q2/p2)<0.6,'coupling below 60 % of the on-axis rate');}
console.log('\n■ B4 retreating blade stall: 140 kt at 2910 kg, aft stick +25 % for 2 s');
{const F=mk('cruise',{mass:2910});apCruise(F,140);ap(F,30);const a=st(F);let nz=0,stl=0,pAt=0,phiMax=0,thMax=0;
 direct(F,3,(t,b)=>({lon:b.lon-(t<2?0.25:0)}),(t,s)=>{nz=Math.max(nz,s.nz);if(s.stall>stl){stl=s.stall;pAt=s.p;}phiMax=Math.abs(s.phi-a.phi)>Math.abs(phiMax)?s.phi-a.phi:phiMax;thMax=Math.max(thMax,s.th-a.th);});
 row('load factor peak',nz.toFixed(2),nz>1.4,'a real pull');row('retreating side stalled (fraction of the disc)',stl.toFixed(2),stl>0.1,'stall appears');row('roll during the stall (°/s at peak, + = right)',pAt.toFixed(1),pAt>0,'rolls to the retreating side: right for a clockwise rotor');row('pitch-up',`${thMax.toFixed(0)}°`,thMax>5,'nose rises');}
console.log('\n■ B5 low g: pushover at 100 kt, then roll control at low g');
{const F=mk('cruise');apCruise(F,100);ap(F,15);let nzMin=9,pLow=0;direct(F,2.5,(t,b)=>({lon:b.lon+(t<1.2?0.3:0),lat:b.lat+(t>1.2&&t<2.2?0.15:0)}),(t,s)=>{nzMin=Math.min(nzMin,s.nz);if(t>1.2&&t<2.2)pLow=Math.max(pLow,s.p);});
 row('minimum load factor',nzMin.toFixed(2),nzMin<0.6,'unloaded rotor');row('roll rate available at low g (15 % right stick)',`${pLow.toFixed(0)} °/s`,pLow>8,'hingeless: control power stays (no mast bumping)');}
console.log('\n■ B6 Vne (155 kt) in a shallow descent: forward stick margin, tip Mach, stall');
{const F=mk('cruise');apCruise(F,155);F.AP.alt=null;F.AP.vs=-2.5;ap(F,50);let mt=0;ap(F,0.3,null,null,(t,x)=>{mt=Math.max(mt,x.mtip);});const s=st(F);s.mtip=mt; /* tip Mach over a full revolution, not one instant */ row('IAS reached',s.ias.toFixed(0)+' kt',s.ias>150,'');row('forward stick used',(s.lon*100).toFixed(0)+' %',s.lon<0.95,'margin left at Vne');row('advancing tip Mach',s.mtip.toFixed(2),s.mtip>0.78&&s.mtip<0.9,'near drag divergence');row('retreating stall fraction',s.stall.toFixed(2),s.stall<0.2,'little at 1 g');}
console.log('\n■ B7 quick stop from 70 kt at 50 ft: nose up 20°, collective holds the height');
for(const feet of [false,true]){const F=mk('approach');F.S.pos[2]+=F.S.hAGL-15.2;apCruise(F,70);F.AP.alt=-F.S.pos[2];ap(F,12);const h0=st(F).h,psi0=F.S.eul[2];const I={};let nrMax=0,hMin=1e9,hMax=0,aftMin=0,t0=null,ci=F.IN.col,pi=F.IN.ped,yawMax=0;
 if(!feet){direct(F,10,(t,b)=>{const s=st(F);const thC=(s.ias>15?20:s.ias>3?10:3.5)/R;const c=attPilot(F,thC,0,I);ci=Math.max(0,Math.min(1,ci+((h0-s.h)*0.4-F.S.vs)*F.DT*0.1));return {lon:c.lon,lat:c.lat,col:Math.max(0,Math.min(1,ci-0.05*F.S.vs))};},(t,s)=>{if(Math.abs(s.r)>Math.abs(yawMax))yawMax=s.r;});
   row('quick stop with the pedals held still: peak yaw rate',yawMax.toFixed(0)+' °/s',yawMax<-30,'nose yaws left as the fin unloads and the power comes in');continue;}
 direct(F,14,(t,b)=>{const s=st(F);const thC=(s.ias>15?20:s.ias>3?10:3.5)/R;const c=attPilot(F,thC,0,I);ci=Math.max(0,Math.min(1,ci+((h0-s.h)*0.4-F.S.vs)*F.DT*0.1));
   const e=((psi0-F.S.eul[2]+3*Math.PI)%(2*Math.PI))-Math.PI;pi=Math.max(-1,Math.min(1,pi+e*F.DT*1.0));const ped=Math.max(-1,Math.min(1,pi+1.8*e-0.7*F.S.om[2]));yawMax=Math.max(yawMax,Math.abs(s.r));
   return {lon:c.lon,lat:c.lat,col:Math.max(0,Math.min(1,ci-0.05*F.S.vs)),ped};},
  (t,s)=>{nrMax=Math.max(nrMax,s.nr);hMin=Math.min(hMin,F.S.gear.minH);hMax=Math.max(hMax,s.h);aftMin=Math.min(aftMin,s.lon);const v=F.mrot(F.qmat(F.S.q),F.S.vb);const along=v[0]*Math.cos(psi0)+v[1]*Math.sin(psi0);if(t0===null&&along<2.6)t0=t;});
 row('quick stop with the feet: 70 kt to below 5 kt along the track',t0===null?'never':t0.toFixed(1)+' s',t0!==null&&t0<16,'≈ V / (g·tan(20°−3.5°)) = 12 s');row('… peak yaw rate with the feet working',yawMax.toFixed(0)+' °/s',yawMax<15,'heading held');row('NR peak (rotor unloaded, then loaded in the flare)',nrMax.toFixed(1)+' %',nrMax>100.5&&nrMax<110,'rises, stays below the limit');
 row('height band (lowest airframe point … max height)',`${hMin.toFixed(1)} … ${hMax.toFixed(1)} m`,hMin>0.5,'no tail strike from 50 ft');row('aft stick used',(aftMin*100).toFixed(0)+' %',aftMin>-0.97,'margin left');}
console.log('\n■ B8 autorotation from 1000 ft at 65 kt, flare at 120 ft, cushion with the collective');
{const F=mk('high');apCruise(F,65);ap(F,25);for(const en of F.S.eng.e)en.on=false;F.AP.auto=true;F.AP.ias=65;let phase='glide',nrFl=0,vsT=null,iasT=0,nrT=0,ci=0;const I={};
 ap(F,120,null,t=>{const s=st(F),sink=-F.S.vs;
   if(phase==='glide'&&s.h<120*F.FT){phase='flare';ci=F.IN.col;}
   if(phase==='flare'&&(s.ias<20||s.h<20*F.FT))phase='level';
   if(phase==='glide')return {};
   if(phase==='flare'){const c=attPilot(F,20/R,0,I);return {lon:c.lon,lat:c.lat,col:ci};}            // flare: nose up, collective where it was
   const c=attPilot(F,6/R,0,I);
   if(s.h<9){const want=Math.max(0.5,s.h*0.35);ci=Math.max(0,Math.min(1,ci+(sink-want)*F.DT*0.9));}  // cushion: more collective while sinking faster than wanted
   return {lon:c.lon,lat:c.lat,col:ci};},
   (t,s)=>{if(phase!=='glide')nrFl=Math.max(nrFl,s.nr);if(vsT===null&&F.S.onGround){vsT=F.S.touch.vs;iasT=s.ias;nrT=s.nr;}});
 row('NR peak in the flare',nrFl.toFixed(0)+' %',nrFl>100&&nrFl<115,'flare loads the disc: NR rises');row('touchdown sink rate',vsT===null?'no touchdown':(vsT/F.FPM).toFixed(0)+' fpm',vsT!==null&&vsT<2.4,'below the hard-landing limit (470 fpm)');row('touchdown speed / NR',vsT===null?'-':`${iasT.toFixed(0)} kt / ${nrT.toFixed(0)} %`,iasT<40&&nrT>50,'run-on landing; the speed depends on the script\'s flare timing');}
console.log('\n■ B9 both engines fail in a 3 m hover: cushion with the collective from the start');
{const F=mk('hover');apHover(F);ap(F,1);for(const en of F.S.eng.e)en.fail=true;let vsT=null,nrT=0,ci=F.IN.col;
 ap(F,8,null,t=>{const s=st(F);const want=Math.max(0.4,Math.min(2.0,s.h*0.6));ci=Math.max(0,Math.min(1,ci+((-F.S.vs)-want)*F.DT*1.5));return {col:ci};},(t,s)=>{if(vsT===null&&F.S.onGround){vsT=F.S.touch.vs;nrT=s.nr;}});
 row('touchdown sink rate',vsT===null?'-':(vsT/F.FPM).toFixed(0)+' fpm',vsT!==null&&vsT<2.4,'survivable: rotor energy cushions');row('NR at touchdown',nrT.toFixed(0)+' %',nrT>55,'energy used, not exhausted');}
}
if(require.main===module&&G==='C'){
const key=(F,k,on)=>{F.DEV.keys[k]=on;};
console.log('\n■ C1 attitude command: can the aids reach the attitudes of limit manoeuvres?');
{const F=mk('high');let thMax=0,phMax=0;pipe(F,4,t=>{key(F,'ArrowDown',t<4);},(t,s)=>{thMax=Math.max(thMax,s.th);});
 const G2=mk('high');pipe(G2,4,t=>{key(G2,'ArrowRight',t<4);},(t,s)=>{phMax=Math.max(phMax,s.phi);});
 row('full aft stick, attitude command on: max pitch',thMax.toFixed(0)+'°',thMax>=24,'quick stop needs 20–30°');row('full right stick, attitude command on: max bank',phMax.toFixed(0)+'°',phMax>=30,'steep turn / evasive manoeuvre needs 30–45°');}
console.log('\n■ C2 banked turn at 100 kt with the aids on (right stick 1.5 s, then hold the bank with the stick centred? no: keep the key)');
{const F=mk('cruise');const psi0=st(F).psi;let ay=0,phi=0,turn=0;pipe(F,10,t=>{key(F,'ArrowRight',t<10);},(t,s)=>{if(t>6){ay=Math.max(ay,Math.abs(s.ay));phi=s.phi;}});const psi1=st(F).psi;turn=((psi1-psi0+540)%360-180)/10;
 const expected=9.81*Math.tan(phi/R)/(st(F).ias*F.KT)*R;
 row('turn rate with the stick held right',turn.toFixed(1)+' °/s',turn>0.5*expected,`≈ g·tan(bank)/V = ${expected.toFixed(1)} °/s (bank ${phi.toFixed(0)}°)`);row('lateral acceleration (ball) in the turn',ay.toFixed(2)+' m/s²',ay<1.5,'coordinated: ball near the centre');}
console.log('\n■ C3 collective changes in cruise (100 kt, aids on): unwanted roll and sideslip?');
{for(const k of ['KeyW','KeyS']){const F=mk('cruise');const a=st(F);let phi=0,b=0,dpsi=0;pipe(F,8,t=>{key(F,k,t<1.5);},(t,s)=>{phi=Math.max(phi,Math.abs(s.phi-a.phi));const va=[F.S.vb[0]-F.S.windB[0],F.S.vb[1]-F.S.windB[1]];b=Math.max(b,Math.abs(Math.atan2(va[1],va[0])*R));dpsi=Math.max(dpsi,Math.abs(((s.psi-a.psi+540)%360)-180));});
  row(`${k} 1.5 s at 100 kt (cruise ↔ take-off power): peak sideslip`,b.toFixed(1)+'°',b<3,'pedal anticipation keeps the ball');row(`${k} … heading change`,dpsi.toFixed(1)+'°',dpsi<6,'cruise heading hold through the roll axis');row(`${k} … bank used for it`,phi.toFixed(1)+'°',phi<7,'small');}}
console.log('\n■ C4 one engine fails in the hover: can the keys reach the 30-second OEI power?');
{const F=mk('high');F.S.eng.e[0].fail=true;let fli=0,nrMin=200;pipe(F,8,t=>{key(F,'KeyW',t>1&&t<8);},(t,s)=>{fli=Math.max(fli,s.fli);nrMin=Math.min(nrMin,s.nr);});
 row('max FLI reached with W held (OEI scale: 10 = continuous, ~12 = 30 s)',fli.toFixed(1),fli>11.3,'the metered lever must allow the 30-second rating');row('NR minimum',nrMin.toFixed(1)+' %',nrMin>94,'');}
console.log('\n■ C5 both engines fail at 70 kt, collective down with S at once');
{const F=mk('cruise');F.AP.on=false;for(const en of F.S.eng.e)en.fail=true;let nrMin=200,tDown=null;const c0=F.IN.col;pipe(F,6,t=>{key(F,'KeyS',t<6);},(t,s)=>{nrMin=Math.min(nrMin,s.nr);if(tDown===null&&s.col<0.05)tDown=t;});
 row('time to lower the collective fully with S',tDown===null?'not reached':tDown.toFixed(1)+' s',tDown!==null&&tDown<1.6,'a pilot dumps the lever in about a second');row('NR minimum during the entry',nrMin.toFixed(0)+' %',nrMin>85,'stays above the autorotation minimum');}
console.log('\n■ C6 pedal keys in cruise (100 kt): yaw-rate command or sideslip?');
{const F=mk('cruise');let beta=0,fs=0,r=0;pipe(F,4,t=>{key(F,'KeyD',t<3);},(t,s)=>{beta=Math.max(beta,Math.abs(Math.atan2(F.S.vb[1],F.S.vb[0])*R));fs=Math.max(fs,s.fenSt);r=Math.max(r,s.r);});
 row('D held 3 s at 100 kt: peak sideslip',beta.toFixed(0)+'°',beta<15,'pedal in cruise trims sideslip; it should not force a flat 25 °/s skid');row('… peak yaw rate',r.toFixed(0)+' °/s',true,'');row('… Fenestron stall',fs.toFixed(2),fs<0.5,'');}
console.log('\n■ C7 engine failure in the hover with heading hold on and off');
for(const hh of [true,false]){const F=mk('high');F.cfg.hdgHold=hh;F.cfg.sas=hh;let rMax=0;for(const en of F.S.eng.e)en.fail=true;pipe(F,2,null,(t,s)=>{rMax=Math.max(rMax,Math.abs(s.r));});
 row(`yaw kick at total engine failure, ${hh?'SAS and heading hold on':'all aids off, pedals still'}`,rMax.toFixed(0)+' °/s',hh?rMax<20:rMax>20,hh?'the aid catches it':'the raw kick is there to learn');}
console.log('\n■ C8 coach in limit states');
{let F=mk('cruise',{mass:2910});F.AP.on=false;const a=st(F);pipe(F,6,t=>{key(F,'ArrowUp',false);F.DEV.keys.KeyW=t<4;});let hint='';
 F=mk('high');F.S.eng.e[0].fail=true;F.S.eng.e[1].fail=true;pipe(F,1.5,null,()=>{if(F.COACH.hint)hint=F.COACH.hint;});row('both engines out in the hover: coach says',hint||'—',/NR/.test(hint),'NR first');
 F=mk('high');hint='';pipe(F,12,t=>{F.DEV.keys.KeyS=t<5;},()=>{if(F.COACH.hintLevel>=2)hint=F.COACH.hint;});row('vertical descent (S held 5 s) in the hover: coach says',hint||'—',/Vortex|Sink|NR/.test(hint),'vortex ring or sink-rate warning');}
}


/* trimmed hover at the altitude where the aircraft is close to its power limit (FLI target) */
function nearLimit(o){const F=mk('high',{mass:o.mass||2910,dT:o.dT===undefined?20:o.dT,wind:o.wind||0,wdir:o.wdir});let alt=300,prev=300;
  /* climb in 150 m steps until the hover needs the target FLI; if a step lands beyond what the engines
     can hold (FLI at take-off power with NR drooping), go back one step */
  const tgt=o.fli||10.2,ok=s=>s.fli<=10.85&&s.nr>=99;
  const g0=-F.S.pos[2]-F.S.hAGL-1.3;   // terrain height under the start point: the search runs above it
  alt=prev=g0+300;
  for(let h=g0+300;h<=g0+3600;h+=150){F.S.pos[2]=-h;F.trimNow(10);const s=st(F);
    if(s.fli>=tgt||!ok(s)){let lo=prev,hi=h;for(let k=0;k<4;k++){const m=(lo+hi)/2;F.S.pos[2]=-m;F.trimNow(10);const sm=st(F);if(ok(sm)&&sm.fli<=tgt+0.1)lo=m;else hi=m;}   // bisect to the highest holding point under the target
      F.S.pos[2]=-lo;F.trimNow(12);alt=Math.round(lo);break;}prev=h;alt=h;}
  return {F,alt};}
function hdgPed(F,psiRef,I){const e=((psiRef-F.S.eul[2]+3*Math.PI)%(2*Math.PI))-Math.PI;I.p=Math.max(-1,Math.min(1,(I.p===undefined?F.IN.ped:I.p)+e*F.DT*1.0));return Math.max(-1,Math.min(1,I.p+1.8*e-0.7*F.S.om[2]));}
if(require.main===module&&G==='D'){
for(const [label,fl] of [['with a little margin (FLI ~10.4)',10.4],['at the limit (FLI ~10.8, just able to hover)',10.75]]){
 console.log(`\n■ D1 pedal turns at 30 °/s, collective held, 2910 kg ISA+20 ${label}`);
 const res={};for(const [name,dir] of [['right',1],['left',-1]]){const {F:G,alt}=nearLimit({fli:fl});const b=st(G);apHover(G);let nrMin=200,vsMin=99,vsMax=-99,pf=0,pf0=G.S.fen.P/1e3;const I={p:b.ped};
  ap(G,8,null,t=>{const e=dir*30/R-G.S.om[2];I.p=Math.max(-1,Math.min(1,I.p+e*G.DT*1.5));return {ped:Math.max(-1,Math.min(1,I.p+1.2*e)),col:b.col};},
   (t,s)=>{if(t>2){nrMin=Math.min(nrMin,s.nr);vsMin=Math.min(vsMin,s.vs);vsMax=Math.max(vsMax,s.vs);pf=Math.max(pf,G.S.fen.P/1e3);}});
  res[name]={nrMin,vsMin,vsMax,pf,pf0,alt,fli:b.fli};
  row(`${name} turn: Fenestron power / NR min / vertical speed range (hover at ${alt} m, FLI ${b.fli.toFixed(1)})`,`${pf0.toFixed(0)}→${pf.toFixed(0)} kW / ${nrMin.toFixed(1)} % / ${vsMin.toFixed(0)}…${vsMax.toFixed(0)} fpm`,true,'');}
 const R1=res.right,L1=res.left;
 if(fl<10.6)row('with margin: the rotor-airspeed effect dominates (right climbs, left sinks, both mildly)',`${R1.vsMax.toFixed(0)} / ${L1.vsMin.toFixed(0)} fpm`,R1.vsMax>0&&L1.vsMin<0&&Math.abs(L1.vsMin)<400&&R1.vsMax<400,'a yaw in the rotor direction adds blade airspeed (~1.3 % at 30 °/s)');
 else row('at the limit the right turn is the costly one: more droop or sink than the left',`NR ${R1.nrMin.toFixed(1)} vs ${L1.nrMin.toFixed(1)} %, sink ${R1.vsMin.toFixed(0)} vs ${L1.vsMin.toFixed(0)} fpm`,R1.nrMin<L1.nrMin-0.2||R1.vsMin<L1.vsMin-100,'the tail\'s extra power is not there: the rotor droops');}
console.log('\n■ D2 collective surge near the power limit: torque kick and pedal margin');
{const {F}=nearLimit({});const b=st(F);apHover(F);let rMin=0;ap(F,3,null,t=>({col:b.col+Math.min(0.1,t*0.1),ped:b.ped}),(t,s)=>{rMin=Math.min(rMin,s.r);});
 row('+10 % collective in 1 s, pedals still: yaw',`${rMin.toFixed(0)} °/s`,rMin<-8,'nose left with the torque');
 const {F:G}=nearLimit({});const c=st(G);apHover(G);let pedMax=0,fs=0,dpsi=0;const psi0=G.S.eul[2],I={};ap(G,4,null,t=>({col:c.col+Math.min(0.1,t*0.1),ped:hdgPed(G,psi0,I)}),(t,s)=>{pedMax=Math.max(pedMax,s.ped);fs=Math.max(fs,s.fenSt);dpsi=Math.max(dpsi,Math.abs(((s.psi-psi0*R+540)%360)-180));});
 row('same with the feet holding the heading: pedal used / Fenestron stall / heading',`${(pedMax*100).toFixed(0)} % / ${fs.toFixed(2)} / ${dpsi.toFixed(1)}°`,pedMax<0.98&&dpsi<8,'right pedal goes in, margin left');}
console.log('\n■ D3 tail drive failure');
{let F=mk('high');apHover(F);ap(F,0.01);const p0=F.IN.ped;F.S.fen.failed=true;let r2=0,r5=0;ap(F,5,null,t=>({ped:p0}),(t,s)=>{if(Math.abs(t-2)<F.DT/2)r2=s.r;r5=s.r;});
 row('in the hover, collective held: yaw after 2 s / 5 s',`${r2.toFixed(0)} / ${r5.toFixed(0)} °/s`,r2<-30,'nose left: the rotor torque is unopposed');
 F=mk('high');apHover(F);ap(F,0.01);F.S.fen.failed=true;const c0=F.IN.col;let r5b=0;ap(F,5,null,t=>({ped:p0,col:t>0.5?c0-0.2:c0}),(t,s)=>{r5b=s.r;});
 row('… collective lowered 20 % after 0.5 s: yaw after 5 s',`${r5b.toFixed(0)} °/s`,Math.abs(r5b)<Math.abs(r5)*0.75,'less torque, slower spin: the standard first action');
 F=mk('cruise');apCruise(F,100);ap(F,10);const pc=F.IN.ped;F.S.fen.failed=true;let beta=0,rr=0;ap(F,15,null,t=>({ped:pc}),(t,s)=>{const va=[F.S.vb[0]-F.S.windB[0],F.S.vb[1]-F.S.windB[1]];beta=Math.atan2(va[1],va[0])*R;rr=s.r;});
 row('at 100 kt: sideslip and yaw rate after 15 s',`${beta.toFixed(0)}° / ${rr.toFixed(1)} °/s`,Math.abs(beta)<25&&Math.abs(rr)<3,'the fin holds the nose at a steady sideslip');
 F=mk('cruise');apCruise(F,100);ap(F,10);F.S.fen.failed=true;let vLost=null;ap(F,60,(t,A)=>{A.ias=Math.max(20,100-t*1.6);},t=>({ped:pc}),(t,s)=>{const va=[F.S.vb[0]-F.S.windB[0],F.S.vb[1]-F.S.windB[1]];const b=Math.abs(Math.atan2(va[1],va[0])*R);if(vLost===null&&(b>35||Math.abs(s.r)>20))vLost=s.ias;});
 row('decelerating with the failure: speed at which the yaw is lost',vLost===null?'held to 20 kt':vLost.toFixed(0)+' kt',vLost!==null&&vLost>25&&vLost<80,'the fin works down to a minimum speed: run-on landing above it');}
console.log('\n■ D4 directional stability in a 15 kt wind, pedals frozen after trim (no SAS)');
{const res=[];for(let wd=0;wd<360;wd+=45){const F=mk('high',{wind:15,wdir:wd});F.cfg.sas=false;apHover(F);ap(F,15);const p0=F.IN.ped,psi0=F.S.eul[2];ap(F,12,null,t=>({ped:p0}));res.push([wd,((F.S.eul[2]-psi0)*R+540)%360-180]);}
 console.log('    wind from 0..315 by 45: heading change after 12 s: '+res.map(x=>x[1].toFixed(0)).join(' '));
 const head=Math.abs(res[0][1]),tail=Math.abs(res[4][1]);row('headwind vs tailwind: heading change',`${head.toFixed(0)}° / ${tail.toFixed(0)}°`,tail>head+10,'tailwind is unstable: the nose swings toward the wind (weathercock)');}
console.log('\n■ D5 loss of yaw authority near the limit: 2910 kg, ISA+20, 20 kt wind from the left, a 25 °/s left yaw to stop');
{const {F}=nearLimit({wind:20,wdir:270,fli:9.8});const b=st(F);apHover(F);F.S.om[2]=-25/R;let tStop=null,fs=0,nrMin=200;
 ap(F,6,null,t=>({ped:1,col:b.col}),(t,s)=>{fs=Math.max(fs,s.fenSt);nrMin=Math.min(nrMin,s.nr);if(tStop===null&&s.r>-1)tStop=t;});
 row('full right pedal: time to stop the yaw / Fenestron stall / NR min',`${tStop===null?'not stopped':tStop.toFixed(1)+' s'} / ${fs.toFixed(2)} / ${nrMin.toFixed(1)} %`,tStop!==null,'stoppable, but the fan stalls and the rotor droops near the limit');}
}
if(require.main===module&&G==='E'){
/* free-response analysis: peaks of a signal, period from successive peaks of one sign, growth per cycle */
function osc(ts,ys){
  /* detrend (linear fit), upward zero crossings give the period, the largest |y| between crossings the amplitude per half cycle */
  const n=ys.length;if(n<10)return null;let sx=0,sy=0,sxx=0,sxy=0;for(let i=0;i<n;i++){sx+=ts[i];sy+=ys[i];sxx+=ts[i]*ts[i];sxy+=ts[i]*ys[i];}
  const k=(n*sxy-sx*sy)/(n*sxx-sx*sx),c=(sy-k*sx)/n,d=ys.map((y,i)=>y-(k*ts[i]+c));
  const zc=[];for(let i=1;i<n;i++)if((d[i-1]<0)!==(d[i]<0))zc.push(i);
  if(zc.length<3)return null;const up=zc.filter(i=>d[i]>0);if(up.length<2)return null;
  const P=(ts[up[up.length-1]]-ts[up[0]])/(up.length-1);const amp=[];for(let j=1;j<zc.length;j++){let m=0;for(let i=zc[j-1];i<zc[j];i++)m=Math.max(m,Math.abs(d[i]));amp.push(m);}
  if(amp.length<3)return {P,g:null};const g=amp[2]/Math.max(amp[0],1e-6);return {P,g,T2:g>1?P*Math.log(2)/Math.log(g):null};}
console.log('\n■ E1 hover modes, all controls frozen at trim, no SAS (small kick, 40 s)');
for(const [name,ax,kick] of [['longitudinal','q',1],['lateral','p',0]]){const F=mk('high');F.cfg.sas=false;apHover(F);ap(F,20);const s0=st(F);F.S.om[kick]+=2/R;const ts=[],ys=[];let tGo=null;
 direct(F,40,null,(t,s)=>{ts.push(t);ys.push(ax==='q'?s.q:s.p);const d=ax==='q'?Math.abs(s.th-s0.th):Math.abs(s.phi-s0.phi);if(tGo===null&&d>10)tGo=t;});
 const o=osc(ts,ys);row(`${name}: period / growth per cycle / time to 10° off`,o?`${o.P.toFixed(1)} s / ×${o.g===null?'?':o.g.toFixed(2)} / ${tGo===null?'>40':tGo.toFixed(0)} s`:`aperiodic / ${tGo===null?'>40':tGo.toFixed(0)} s`,tGo===null||tGo>3,'hover is unstable but slow: a pilot has seconds, not tenths');}
console.log('\n■ E2 cruise modes at 100 kt, controls frozen, no SAS');
{let F=mk('cruise');F.cfg.sas=false;apCruise(F,100);ap(F,20);const b=st(F);const ts=[],ys=[];direct(F,25,(t,c)=>({ped:c.ped+(t<1?0.08:t<2?-0.08:0)}),(t,s)=>{if(t>2){ts.push(t);ys.push(s.r);}});const o=osc(ts,ys);
 row('Dutch roll after a pedal doublet: period / amplitude ratio per cycle',o?`${o.P.toFixed(1)} s / ×${o.g===null?'?':o.g.toFixed(2)}`:'no oscillation',o!==null&&o.P>0.7&&o.P<8&&(o.g===null||o.g<1.3),'damped; the model is stiff in yaw (fin and Fenestron about equal), period shorter than the 2–4 s typical of light helicopters: open, needs data');
 F=mk('cruise');F.cfg.sas=false;apCruise(F,100);ap(F,20);const i0=st(F).ias;F.S.vb[0]+=2.5;const t2=[],y2=[];direct(F,60,null,(t,s)=>{t2.push(t);y2.push(s.ias-i0);});const o2=osc(t2,y2);
 row('phugoid after +5 kt: period / growth per cycle',o2?`${o2.P.toFixed(0)} s / ×${o2.g===null?'?':o2.g.toFixed(2)}`:'no oscillation in 60 s',o2===null||o2.P>8,'long period; helicopters are often mildly unstable here');
 F=mk('cruise');F.cfg.sas=false;apCruise(F,100);ap(F,20);const ph0=st(F).phi;F.S.om[0]+=4/R;let ph=0,phMax=0;direct(F,20,null,(t,s)=>{ph=s.phi-ph0;phMax=Math.max(phMax,Math.abs(ph));});
 row('spiral: bank 20 s after a 4 °/s roll kick (largest)',`${ph.toFixed(1)}° (${phMax.toFixed(1)}°)`,phMax<45,'slow divergence at most');}
console.log('\n■ E3 transition with the lateral stick frozen at the hover trim (autopilot flies pitch, power, pedals)');
{const F=mk('high');apHover(F);ap(F,10);const s0=st(F);const lat0=F.IN.lat;let ph15=null,ph25=null,iasMax=0;
 ap(F,30,(t,A)=>{A.mode='hover';A.posN=null;A.posE=null;A.vN=Math.min(16,t*1.2);A.vE=0;},t=>({lat:lat0}),(t,s)=>{if(ph15===null&&s.ias>12)ph15=s.phi-s0.phi;if(ph25===null&&s.ias>25)ph25=s.phi-s0.phi;iasMax=Math.max(iasMax,s.ias);});
 row('roll attitude change at 12 kt / 25 kt (lateral stick held)',`${(ph15||0).toFixed(1)}° / ${(ph25||0).toFixed(1)}°`,(ph15||0)<0,'transverse flow effect: a clockwise rotor rolls left as it gains speed');}
for(const [label,o] of [['light, power in hand (2500 kg, ISA, 1000 ft)',{}],['heavy and hot, at the power limit (2910 kg, ISA+20, near the ceiling)',{heavy:true}]]){
 console.log(`\n■ E4 vortex ring recoveries, ${label}: 1800 fpm vertical, then 20 s`);
 const res={};for(const tech of ['collective only','classical (forward + collective)','Vuichard (left bank, right pedal)']){
  let F;if(o.heavy){F=nearLimit({fli:10.4}).F;}else{F=mk('high');F.S.pos[2]=-1220;F.trimNow(8);}
  /* enter: descend vertically until the ring is developed (not a fixed time: with power settling the
     autopilot's own collective deepens it, and from low altitude the ground would come first) */
  apHover(F);F.AP.alt=null;F.AP.vs=-9.1;F.AP.on=true;for(let te=0;te<20;te+=F.DT){const q=F.apStep(F.DT);F.IN.col=q.col;F.IN.lon=q.lon;F.IN.lat=q.lat;F.IN.ped=q.ped;F.step(F.DT);if(te>3&&F.S.rot.vrs>0.6)break;}
  const vrs0=F.S.rot.vrs;
  const h0=st(F).h,psi0=F.S.eul[2],I={},J={};let tOut=null,hMin=h0,vsMin=0,nrMin=200;const c0=F.IN.col;
  direct(F,20,(t)=>{let thC=F.TRIM.th,phC=F.TRIM.phi,ped=hdgPed(F,psi0,J),col=Math.min(0.95,c0+Math.min(0.35,t*0.7));
    if(tech.startsWith('classical'))thC=-10/R;if(tech.startsWith('Vuichard'))phC=-17/R;
    const c=attPilot(F,thC,phC,I);return {lon:c.lon,lat:c.lat,col,ped};},(t,s)=>{if(tOut===null){hMin=Math.min(hMin,s.h);vsMin=Math.min(vsMin,s.vs);nrMin=Math.min(nrMin,s.nr);}if(tOut===null&&F.S.rot.vrs<0.15&&s.vs>0)tOut=t;});
  res[tech]=[h0-hMin,tOut];row(`${tech}: height lost / worst sink / NR min / out after`,`${(h0-hMin).toFixed(0)} m / ${vsMin.toFixed(0)} fpm / ${nrMin.toFixed(0)} % / ${tOut===null?'not in 20 s':tOut.toFixed(1)+' s'}`,true,`(VRS ${vrs0.toFixed(2)} at the start)`);}
 const cls=res['classical (forward + collective)'],vui=res['Vuichard (left bank, right pedal)'],col=res['collective only'];
 if(!o.heavy)row('collective alone loses the most height',`${col[0].toFixed(0)} m vs ${Math.max(cls[0],vui[0]).toFixed(0)} m`,col[0]>Math.max(cls[0],vui[0]),'with power in hand a big pull still gets out, but late');
 else row('at the power limit collective alone fails or loses far more',`${col[1]===null?'not out':col[0].toFixed(0)+' m'} vs ${Math.max(cls[0],vui[0]).toFixed(0)} m`,col[1]===null||col[0]>1.5*Math.max(cls[0],vui[0]),'no thrust to spare: only a way out of the wake helps');
 row('Vuichard and classical both recover',`${vui[1]===null?'no':'yes'} / ${cls[1]===null?'no':'yes'}`,vui[1]!==null&&cls[1]!==null,'');}
}
if(require.main===module)process.on('exit',()=>{console.log(bad?`\n${bad} CHECK(s)`:'\nall scenario checks within range');process.exitCode=bad?1:0;});
