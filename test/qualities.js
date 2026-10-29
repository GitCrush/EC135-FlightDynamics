/* Flight qualities and physics consistency, written after an independent
   review found that the older suites mostly measured the model against
   itself. Every row says what kind of check it is:

     VAL  against published data the model was not tuned to (source in the row)
     CAL  a calibration point: the model was fitted to it; the row only
          guards against drift and proves nothing about realism
     PHY  a physical law or sign that must hold whatever the parameters
     REG  regression against test/golden.json (model properties that have
          no published reference; a change must be deliberate: run with
          --update after reviewing it)
     KNOWN a documented deviation from published data; it does not fail,
          but it must not get worse than its bound
     RULE a published rule implemented as written (a limit, a ratio, a
          time limit): it checks the bookkeeping, not the physics

   An independent re-check of 1.8 reclassified the roll bandwidth and
   phase delay from VAL to CAL (the servo lag was chosen to match them) and
   the type-certificate rows from VAL to RULE.

   Exit 1 on any FAIL. --fast skips the frequency sweeps (for mutation runs). */
'use strict';
const fs=require('fs'),path=require('path');
const {loadEngine}=require('./load.js');
const L=require('./lib/linear.js');
const FAST=process.argv.includes('--fast'),UPDATE=process.argv.includes('--update');
const GOLD_F=path.join(__dirname,'golden.json');
const gold=fs.existsSync(GOLD_F)?JSON.parse(fs.readFileSync(GOLD_F,'utf8')):{};const newGold={};
let fails=0,known=0;
function row(kind,name,val,ok,expect,unit=''){const st=ok?'OK  ':kind==='KNOWN'?'KNOWN':'FAIL';if(!ok&&kind!=='KNOWN')fails++;if(kind==='KNOWN')known++;
  const v=typeof val==='number'?(Math.abs(val)>=100?val.toFixed(0):Math.abs(val)>=10?val.toFixed(1):val.toFixed(3)):val;
  console.log(`  ${st.padEnd(5)} ${kind.padEnd(5)} ${name.padEnd(64)} ${String(v).padStart(9)} ${unit.padEnd(6)} ${expect}`);}
function within(kind,name,val,lo,hi,unit,src){row(kind,name,val,val>=lo&&val<=hi,`[${lo} … ${hi}]${src?'  '+src:''}`,unit);}
function reg(name,val,tolRel,unit){newGold[name]=val;const g=gold[name];
  if(UPDATE||g===undefined){row('REG',name,val,true,g===undefined?'(new golden value)':'(golden updated)',unit);return;}
  const ok=Math.abs(val-g)<=Math.abs(g)*tolRel+1e-9;row('REG',name,val,ok,`golden ${typeof g==='number'?+g.toPrecision(4):g} ±${(tolRel*100).toFixed(0)} %`,unit);}
function mk(o={}){const E=loadEngine();E.WIND.spd=0;E.WIND.turb=0;E.cfg.mass=o.mass||2500;E.cfg.dT=o.dT||0;if(o.thk)E.H.eng.thk=o.thk;return E;}
function fly(E,sec,rec){const {AP,IN,DT}=E;for(let t=0;t<sec;t+=DT){const o=E.apStep(DT);IN.col=o.col;IN.lon=o.lon;IN.lat=o.lat;IN.ped=o.ped;E.step(DT);if(rec)rec(t);}}
const R2D=180/Math.PI;

console.log('\n■ Rotor in isolation (hover, hub fixed, 9° collective)');
{const E=mk(),rt=E.H.rotor,DT=E.DT;
 function run(lon,lat,om){const st=E.rotorState(rt);const acc={F:[0,0,0],M:[0,0,0],a:0,b:0,lx:0,ly:0,n:0},N=Math.round(6/DT);
   for(let i=0;i<N;i++){E.rotorStep(rt,st,DT,[0,0,0],om||[0,0,0],[0,0,0],[0,0,0],1.225,340,500,9/R2D,lon,lat,0);
     if(i>N-110){for(let k=0;k<3;k++){acc.F[k]+=st.F[k];acc.M[k]+=st.M[k];}let a=0,b=0;for(let k=0;k<4;k++){const p=st.psi+2*Math.PI*k/4;a+=st.beta[k]*Math.cos(p)/2;b+=st.beta[k]*Math.sin(p)/2;}
       acc.a+=a;acc.b+=b;acc.n++;}}
   for(let k=0;k<3;k++){acc.F[k]/=acc.n;acc.M[k]/=acc.n;}acc.a/=acc.n;acc.b/=acc.n;acc.lx=st.lamx;acc.ly=st.lamy;return acc;}
 const r0=run(0,0),rl=run(0,1/R2D),rf=run(1/R2D,0),T=-r0.F[2];
 const tiltR=E.H.rotor.s*(rl.b-r0.b),tiltF=rf.a-r0.a;   // b is the sine harmonic in the direction of rotation: s·b is the tilt to the right
 within('PHY','thrust follows the tip-path plane, lateral: ΔFy / (T · tilt)',(rl.F[1]-r0.F[1])/(T*tiltR),0.9,1.25,'','(1 = the thrust vector tilts with the disc)');
 within('PHY','thrust follows the tip-path plane, longitudinal: ΔFx / (T · tilt)',(rf.F[0]-r0.F[0])/(T*tiltF),0.9,1.25,'');
 // right cyclic: more lift on the left; the inflow (downwash) must be higher on the left (lamy < 0, y right)
 row('PHY','right cyclic: inflow gradient points to the lifting (left) side',rl.ly.toFixed(4),rl.ly<0,'λy < 0 (more downwash where the lift is)');
 row('PHY','forward cyclic: inflow gradient points to the lifting (aft) side',rf.lx.toFixed(4),rf.lx<0,'λx < 0');
 const dp=run(0,0,[0.05,0,0]),dq=run(0,0,[0,0.05,0]);
 const Lp=(dp.M[0]-r0.M[0])/0.05,Mq=(dq.M[1]-r0.M[1])/0.05,Mp=(dp.M[1]-r0.M[1])/0.05,Lq=(dq.M[0]-r0.M[0])/0.05;
 /* hub moment per radian of disc tilt. The hinge offset was chosen so that its centrifugal part gives
    the ERF 1997 figure (~2000 Nm per degree = 115 kNm/rad); the moment measured at the hub also carries
    the 1/rev lift shear at the offset hinges, so the total is larger and is kept as a golden value. */
 const Kh=(rl.M[0]-r0.M[0])/tiltR;reg('hub moment per disc tilt, total (kNm/rad)',Kh/1e3,0.08,'kNm/rad');
 within('PHY','rotor roll / pitch rate damping ratio (a rotor in hover is axisymmetric)',Lp/Mq,0.85,1.18,'');
 within('PHY','cross-coupling: |Mp| / |Lp|',Math.abs(Mp/Lp),0,0.3,'');
 reg('rotor rate damping Lp (kNm per rad/s)',Lp/1e3,0.08,'kNm·s');
}

console.log('\n■ Sense of rotation and mirror symmetry');
{const E=mk();row('RULE','main rotor turns counterclockwise seen from above (s = -1)',E.H.rotor.s,E.H.rotor.s===-1,'Airbus Helicopters IN 3540-I-00 lists the EC135 P2+ among the counterclockwise types');
 /* the same manoeuvres with the rotor turning the other way, inputs mirrored: the motion must be the exact mirror image
    (proves that every part of the model follows the sense: rotor, Fenestron side, fin camber, pilot aids) */
 const run=(sense,man)=>{const F=loadEngine(sense>0?{patch:[{from:'    s:-1,',to:'    s:+1,'}]}:{});F.WIND.spd=0;F.WIND.turb=0;F.cfg.mass=2500;L.trim(F,'hover');const {IN,DT}=F,c0={...IN},out=[];
   for(let t=0;t<3;t+=DT){Object.assign(IN,c0);man(IN,t,c0,sense);F.step(DT);out.push([F.S.eul[0],F.S.eul[1],F.S.eul[2],F.S.om[0],F.S.om[1],F.S.om[2],F.S.vb[1],F.S.vb[2],F.S.NR]);}return out;};
 const mir=[-1,1,-1,-1,1,-1,-1,1,1];let worst=0;
 for(const m of [(I,t,c,s)=>{if(t<1)I.lat=c.lat-s*0.1;},(I,t,c,s)=>{I.ped=c.ped-s*0.1;},(I,t,c)=>{I.col=c.col+0.05;}]){const a=run(-1,m),b=run(+1,m);
   a.forEach((x,i)=>x.forEach((v,k)=>{worst=Math.max(worst,Math.abs(v-mir[k]*b[i][k])/Math.max(1,Math.abs(v)));}));}
 within('PHY','mirror test: clockwise model, mirrored, against the counterclockwise one (largest difference)',worst,0,1e-6,'','lateral pulse, pedal step, collective step; exact mirror image');}

console.log('\n■ Linear modes, hover 1000 ft, 2500 kg (rigid body, rotor quasi-static)');
const hov=L.linearise(L.trim(mk(),'hover'));{const A=hov.A;
 const Xu=A[0][0],Mu=A[4][0],Lv=A[3][1],Zw=A[2][2],Lp=A[3][3],Mq=A[4][4],Nr=A[5][5];
 row('PHY','speed damping Xu < 0',Xu.toFixed(4),Xu<0,'drag of the tilting disc opposes speed');
 row('PHY','speed stability Mu > 0',Mu.toFixed(4),Mu>0,'forward speed flaps the disc back: nose up');
 row('PHY','dihedral effect Lv < 0',Lv.toFixed(4),Lv<0,'sideslip from the right rolls left');
 row('PHY','damping Zw, Lp, Mq, Nr all negative',[Zw,Lp,Mq,Nr].map(v=>v.toFixed(2)).join(' '),Zw<0&&Lp<0&&Mq<0&&Nr<0,'');
 within('PHY','roll / pitch damping ratio Lp/Mq (Ixx < Iyy, same rotor)',Lp/Mq,1.8,5,'','hingeless rotor, Iyy/Ixx ≈ 2.9');
 reg('hover Xu (1/s)',Xu,0.15);reg('hover Mu (rad/(m·s))',Mu,0.15);reg('hover Zw (1/s)',Zw,0.10);reg('hover Lp (1/s)',Lp,0.10);reg('hover Mq (1/s)',Mq,0.10);reg('hover Nr (1/s)',Nr,0.12);
 const md=L.modes(A);for(const m of md)console.log('        '+L.fmtMode(m));
 const osc=md.filter(m=>m.osc&&m.period>5);const worst=osc.sort((a,b)=>b.re-a.re)[0];
 within('PHY','hover oscillation (most unstable, period > 5 s): period',worst.period,6,25,'s','helicopters drift in a slow oscillation');
 within('PHY','… doubling time (seconds a pilot has)',worst.t2||99,3,60,'s','unstable but slow');
 reg('hover oscillation period (s)',worst.period,0.10);reg('hover oscillation real part (1/s)',worst.re,0.25);}

console.log('\n■ Linear modes, level flight 100 kt, 2500 kg');
const cru=L.linearise(L.trim(mk(),'cruise',100));{const A=cru.A;
 const Nv=A[5][1],Mw=A[4][2],Lv=A[3][1];
 row('PHY','weathercock stability Nv > 0',Nv.toFixed(4),Nv>0,'fin and Fenestron turn the nose into the wind');
 row('PHY','dihedral effect Lv < 0',Lv.toFixed(4),Lv<0,'');
 reg('100 kt Nv (rad/(m·s))',Nv,0.15);reg('100 kt Mw (rad/(m·s))',Mw,0.25);
 const md=L.modes(A);for(const m of md)console.log('        '+L.fmtMode(m));
 const lat=L.modes(A,[1,3,5,6]).filter(m=>m.osc&&m.period<8).sort((a,b)=>a.period-b.period)[0];
 if(lat){within('PHY','Dutch roll period',lat.period,1.2,6,'s','light helicopters: a few seconds');within('PHY','Dutch roll damping ratio',lat.zeta,0.05,0.7,'');
   reg('Dutch roll period (s)',lat.period,0.10);reg('Dutch roll zeta',lat.zeta,0.20);}
 else row('PHY','Dutch roll present',`none`,false,'a lateral oscillation with a period of a few seconds');}

console.log('\n■ Dutch roll at 60 kt against the DLR identification; the governed rotor in the yaw axis');
{const c60=L.linearise(L.trim(mk(),'cruise',60));const lat=L.modes(c60.A,[1,3,5,6]).filter(m=>m.osc&&m.period<8).sort((a,b)=>a.period-b.period)[0];
 const w=lat?Math.hypot(lat.re,2*Math.PI/lat.period):0;
 /* CAL: the yaw inertia (4900 kg m², 2.1) was chosen with this frequency, the identified hover yaw
    damping and the flight-test author's Dutch roll period at 100 kt: the model comes out ~12 % under the
    DLR frequency (it cannot meet both, see docs/TECHNICAL.md) */
 within('CAL','Dutch roll at 60 kt: natural frequency',w,1.80*0.88,1.86*1.12,'rad/s','DLR (Seher-Weiss 2007, Table 2): 1.80-1.86 rad/s; yaw inertia chosen with it');
 // VAL since 2.1: not fitted (until 2.0 KNOWN at 0.18, with the fuselage's weathercock moment of the wrong sign)
 within('VAL','… damping ratio',lat?lat.zeta:0,0.20,0.33,'','DLR identified 0.24-0.28');}

console.log('\n■ Directional derivatives at 90 kt by component, against Kampa et al. 1997, Fig. 18 (Eurocopter model checked against flight tests)');
{/* weathercock and dihedral per dynamic pressure (m³ per degree of sideslip), yaw damping per yaw inertia (1/s);
    quasi-static: sideslip and yaw rate frozen, rotor, inflow and engines settle */
 const E=mk();E.reset('cruise');E.S.vb[0]=90*E.KT;Object.assign(E.AP,{on:true,mode:'cruise',auto:false,ias:90,alt:-E.S.pos[2],hdg:E.S.eul[2]});fly(E,50);E.AP.on=false;
 const S0=structuredClone(E.S),V=Math.hypot(S0.vb[0],S0.vb[1],S0.vb[2]),q=0.5*S0.rho*V*V,Izz=E.inertia?E.inertia()[8]:E.H.I[8];
 const run=(db,dr)=>{E.S=structuredClone(S0);const S=E.S,b0=Math.atan2(S0.vb[1],S0.vb[0]),vb=[V*Math.cos(b0+db),V*Math.sin(b0+db),S0.vb[2]],N={},Lx={};let n=0;
   for(let t=0;t<1.3;t+=E.DT){S.vb=vb.slice();S.om=[0,0,dr];S.q=S0.q.slice();S.omd=[0,0,0];S.pos=S0.pos.slice();E.step(E.DT);if(t>=0.8){for(const k in S.Mz)N[k]=(N[k]||0)+S.Mz[k];for(const k in S.Mx)Lx[k]=(Lx[k]||0)+S.Mx[k];n++;}}
   for(const k in N)N[k]/=n;for(const k in Lx)Lx[k]/=n;return {N,Lx};};
 const d=2*Math.PI/180,pb=run(d,0),mb=run(-d,0),pr=run(0,0.05),mr=run(0,-0.05);
 const wc=k=>(pb.N[k]-mb.N[k])/(2*d)/q/57.3,yd=k=>(pr.N[k]-mr.N[k])/0.1/Izz,dh=k=>(pb.Lx[k]-mb.Lx[k])/(2*d)/q/57.3;
 // CAL: the fuselage's Munk moment volume was set to this; VAL: fin and Fenestron, rotor, totals (not fitted)
 within('CAL','fuselage weathercock (m³/°)',wc('fus'),-0.30,-0.22,'','Kampa: -0.26 (destabilising); yaw moment volume set to it');
 within('VAL','fin + Fenestron weathercock (m³/°)',wc('fin')+wc('fen'),0.43,0.62,'','Kampa: +0.51');
 within('VAL','total weathercock (m³/°)',wc('fus')+wc('fin')+wc('fen')+wc('rot'),0.18,0.38,'','Kampa: +0.25');
 within('PHY','fuselage yaw damping (1/s)',yd('fus'),-0.15,0,'','Kampa: ~0, "no significant moment is created due to yaw rate"');
 within('VAL','fin + Fenestron yaw damping (1/s)',yd('fin')+yd('fen'),-1.6,-0.9,'','Kampa: -1.35 (their yaw inertia unknown)');
 within('VAL','total dihedral (m³/°)',dh('rot')+dh('fin')+dh('fen')+dh('fus'),-0.36,-0.22,'','Kampa: -0.30 (rotor -0.17, fin + Fenestron -0.12)');
 // the rotor's share is not fitted; the fin's height (centre of pressure above the CG) was set with the fin + Fenestron share
 within('VAL','rotor dihedral (m³/°)',dh('rot'),-0.22,-0.13,'','Kampa: -0.17');
 within('CAL','fin + Fenestron dihedral (m³/°)',dh('fin')+dh('fen'),-0.15,-0.08,'','Kampa: -0.12; fin height set with it');
 reg('fuselage weathercock 90 kt (m³/°)',wc('fus'),0.1);reg('fin+Fenestron yaw damping 90 kt (1/s)',yd('fin')+yd('fen'),0.1);
 {const Eh=mk();L.trim(Eh,'hover');const {A}=L.linearise(Eh);
  // CAL: the yaw inertia was chosen with it
  within('CAL','hover yaw damping Nr (1/s)',A[5][5],-0.65,-0.40,'','DLR (Seher-Weiss 2017, Fig. 13): about -0.5');}
 /* The rotor keeps its angular momentum while the airframe yaws under it: a yaw acceleration in the
    rotor's sense takes relative rotor speed away and the other sense adds it, before the governor reacts
    (conservation of angular momentum about the shaft). In the first 0.3 s of a pedal step the change of
    relative rotor speed over the change of yaw rate is close to -s (1 here); the load change alone gives ~0.2. */
 {const E=mk();L.trim(E,'hover');const {IN,DT}=E,c0={...IN},Om0=E.S.rot.Om,r0=E.S.om[2];
  for(let t=0;t<0.3;t+=DT){Object.assign(IN,c0);IN.ped=c0.ped+0.15;E.step(DT);}
  const k=-E.H.rotor.s*(E.S.rot.Om-Om0)/(E.S.om[2]-r0);
  within('PHY','yaw acceleration and rotor speed: -s·ΔΩ/Δr in the first 0.3 s of a pedal step',k,0.8,1.6,'','angular momentum about the shaft');}}

if(!FAST){console.log('\n■ Attitude bandwidth and phase delay at 75 kt, bare airframe (ADS-33 small amplitude)');
 /* trim once, then every dwell starts from a copy of that state (simulation, autopilot and inputs) */
 const E0=mk();E0.reset('cruise');const g=E0.terrainH(E0.S.pos[0],E0.S.pos[1]);E0.S.pos[2]=-(g+400);E0.S.vb[0]=75*E0.KT;Object.assign(E0.AP,{on:true,mode:'cruise',auto:false,ias:75,alt:g+400,hdg:E0.S.eul[2]});fly(E0,40);
 const snap={S:structuredClone(E0.S),AP:structuredClone(E0.AP),IN:structuredClone(E0.IN)};
 const trimmed=()=>{const E=mk();E.S=structuredClone(snap.S);Object.assign(E.AP,structuredClone(snap.AP));Object.assign(E.IN,structuredClone(snap.IN));return E;};
 /* the collective stays at its trim value during the sweeps, as in a flight-test sweep (until 2.2 the autopilot held
    the height with it, which added phase lead to the pitch response below ~1.5 rad/s) */
 const ro=L.bandwidth(trimmed,'roll',undefined,undefined,{colFixed:true}),pi=L.bandwidth(trimmed,'pitch',undefined,undefined,{colFixed:true});
 const src='ERF 1997 (Kampa et al.), Table 4, EC135 at 75 kt';
 // CAL, not VAL: the 20 ms servo lag was chosen to match the phase delay, and Ixx comes from the same paper's sensitivity chart
 within('CAL','roll bandwidth (published 3.7 rad/s, ±15 %)',ro.bw,3.7*0.85,3.7*1.15,'rad/s',src+'; Ixx from the same paper');
 within('CAL','roll phase delay (published 55 ms, ±15 ms)',ro.tp*1000,40,70,'ms',src+'; servo lag fitted to it');
 row('KNOWN','pitch bandwidth: published 1.84 rad/s; model quicker (bound 3.3)',pi.bw,pi.bw<=3.3,'open deviation, see docs/TECHNICAL.md','rad/s');
 within('CAL','pitch phase delay (published 92 ms, ±15 ms)',pi.tp*1000,77,107,'ms',src+'; the 25 ms equivalent delay in pitch (H.lonDelay, 2.16) fitted to it');
 reg('roll bandwidth 75 kt (rad/s)',ro.bw,0.08);reg('pitch bandwidth 75 kt (rad/s)',pi.bw,0.08);}

console.log('\n■ Performance against published figures');
{/* hover ceilings out of ground effect, 2835 kg, flown: the AP climbs there in steps and hovers
    30 s. CAL: the turbine lapse was fitted so that the engines' whole load (rotor, Fenestron,
    accessories, friction) equals take-off power exactly there. */
 const src='EC135 P2 datasheet: HOGE 2685 m ISA, 1785 m ISA+20 at 2835 kg';
 for(const [dT,h] of [[0,2685],[20,1785]]){const E=mk({mass:2835,dT});E.reset('high');const {AP}=E;let a=-E.S.pos[2];
   AP.on=true;AP.mode='hover';AP.auto=false;AP.hdg=E.S.eul[2];AP.posN=E.S.pos[0];AP.posE=E.S.pos[1];AP.vN=0;AP.vE=0;
   while(a<h-150){a=Math.min(h-150,a+200);E.S.pos[2]=-a;AP.alt=a;fly(E,6);}
   E.S.pos[2]=-(h-1);AP.alt=h;fly(E,20);const a0=E.S.alt;let nrMin=200,P=0,Pav=0,n=0;fly(E,30,t=>{nrMin=Math.min(nrMin,E.S.NR);if(t>20){P+=E.S.Peng;Pav+=E.S.Pavail;n++;}});
   within('CAL',`hover ceiling ISA${dT?'+'+dT:''} ${h} m: engine load / take-off power`,P/Pav,0.98,1.02,'',src);
   within('CAL',`… flown 30 s: height lost / NR minimum`,a0-E.S.alt,-3,10,'m',`NR min ${nrMin.toFixed(1)} % (≥ 98.5)`);if(nrMin<98.5)row('CAL','… NR held at the ceiling',nrMin,false,'≥ 98.5 %','%');}
 // climb at Vy (65 kt), MTOW, sea level ISA, at maximum continuous and at take-off power
 {const climb=fli=>{const E=mk({mass:2910});E.reset('cruise');const g=E.terrainH(E.S.pos[0],E.S.pos[1]);E.S.pos[2]=-(g+150);E.S.vb[0]=65*E.KT;const {AP}=E;AP.on=true;AP.mode='cruise';AP.auto=false;AP.ias=65;AP.alt=g+150;AP.hdg=E.S.eul[2];fly(E,30);
   AP.alt=null;AP.vs=0;let vs=0,n=0;for(let t=0;t<40;t+=E.DT){AP.vs+=(fli-E.S.eng.fli)*E.DT*0.6;const o=E.apStep(E.DT);E.IN.col=o.col;E.IN.lon=o.lon;E.IN.lat=o.lat;E.IN.ped=o.ped;E.step(E.DT);if(t>30){vs+=E.S.vs;n++;}}return vs/n/E.FPM;};
  const cm=climb(10),ct=climb(10.95);
  /* weak: the published 1500 fpm (MTOW, sea level) gives no power setting. It passes if the figure
     lies between the model's climb at maximum continuous and at take-off power, ±10 %. */
  row('VAL','climb at 65 kt, MTOW, sea level: MCP … take-off power',`${cm.toFixed(0)} … ${ct.toFixed(0)}`,1500>=cm*0.9&&1500<=ct*1.1,'weak: published ~1500 fpm, power setting not stated','fpm');
  reg('climb MTOW SL MCP (fpm)',cm,0.06,'fpm');}
 // level speed at maximum continuous power, MTOW, near sea level
 {const E=mk({mass:2910});E.reset('cruise');const g=E.terrainH(E.S.pos[0],E.S.pos[1]);E.S.pos[2]=-(g+150);E.S.vb[0]=137*E.KT;const {AP}=E;AP.on=true;AP.mode='cruise';AP.auto=false;AP.ias=137;AP.alt=g+150;AP.hdg=E.S.eul[2];
  let P=0,n=0;fly(E,45,t=>{if(t>35){P+=E.S.Peng;n++;}});within('CAL','engine load at 137 kt, MTOW, near sea level / maximum continuous',P/n/E.S.eng.Pmcp,0.97,1.03,'','calibrated: frontal drag area');}}

console.log('\n■ Physical laws');
{// induced power: hover power grows roughly with m^1.5 (less, because the profile power stays)
 const P=m=>{const E=mk({mass:m});L.trim(E,'hover');return E.S.Pload;};const p1=P(2300),p2=P(2900);const ex=Math.log(p2/p1)/Math.log(2900/2300);
 within('PHY','hover power vs mass: exponent between 2300 and 2900 kg',ex,1.15,1.5,'','momentum theory: 1.5 for induced power alone');
 // steady autorotation: the potential energy lost per second pays for what level flight at that speed needs
 const E=mk();E.reset('high');const {AP}=E;AP.on=true;AP.mode='cruise';AP.auto=false;AP.ias=65;AP.alt=-E.S.pos[2];AP.hdg=E.S.eul[2];E.S.vb[0]=65*E.KT;fly(E,30);
 let Plev=0,n=0;fly(E,10,t=>{Plev+=E.S.Pload;n++;});Plev/=n;
 for(const en of E.S.eng.e)en.on=false;AP.auto=true;AP.ias=65;E.S.pos[2]-=300;let vs=0;n=0;fly(E,40,t=>{if(t>30){vs+=E.S.vs;n++;}});vs/=n;
 within('PHY','steady autorotation at 65 kt: m·g·sink / level-flight power',E.S.m*9.81*(-vs)/Plev,0.85,1.3,'','energy balance');
 within('PHY','autorotation rotor speed within the power-off limits',E.S.NR,E.H.nr.minAuto,E.H.nr.maxAuto,'%','TCDS: 85–106 % above 1900 kg');}

console.log('\n■ Vortex ring (2500 kg, 1500 m): steady descents, path independence, collective in the ring');
{const vrsRun=(prof,sec,col)=>{const E=mk();E.reset('high');E.S.pos[2]=-1500;const {AP,IN,DT}=E;
   const vh=Math.sqrt(2500*9.81/(2*E.atmo(1500,0).rho*E.H.rotor.A));Object.assign(AP,{on:true,mode:'hover',auto:false,alt:null,vs:0,hdg:0,vN:0,vE:0,posN:E.S.pos[0],posE:E.S.pos[1]});
   const acc={vi:0,P:0,vz:0,n:0};let vz2=null,vz0=null;
   for(let t=0;t<sec;t+=DT){AP.vs=prof(t)*vh;const o=E.apStep(DT);IN.lon=o.lon;IN.lat=o.lat;IN.ped=o.ped;IN.col=col?col(t,o.col):o.col;E.step(DT);
     if(t>sec-10){acc.vi+=E.S.rot.lam0*E.S.rot.Om*E.H.rotor.R;acc.P+=E.S.Pload;acc.vz+=E.S.vs;acc.n++;}}
   return {vi:acc.vi/acc.n/vh,P:acc.P/acc.n,x:acc.vz/acc.n/vh,E,vh};};
 // the empirical curve (Leishman, scaled to join momentum theory at x = 0)
 const curve=x=>(1.15-1.125*x-1.372*x*x-1.718*x*x*x-0.655*x*x*x*x)/1.15;
 for(const x of [-0.35,-0.5]){const r=vrsRun(t=>x*Math.min(1,t/8),40);
   within('PHY',`steady descent at ${r.x.toFixed(2)} vh: induced velocity / empirical curve`,r.vi/curve(r.x),0.88,1.12,'','Leishman (2006), outside the core where a descent can be held');}
 // the same descent reached two ways: straight, or with a collective pulse on the way: the steady flow must not remember
 const a=vrsRun(t=>-0.5*Math.min(1,t/8),55),b=vrsRun(t=>-0.5*Math.min(1,t/8),55,(t,c)=>t>15&&t<20?c+0.06:c);
 within('PHY','path independence: power at -0.5 vh, straight / with a pulse on the way',a.P/b.P,0.97,1.03,'','a held collective settles to one flow, whatever came before');
 /* a pull of 0.08 for 2 s: change of vertical speed, in a normal descent (0.15 vh) and in the developed ring (0.75 vh).
    In the ring the extra thrust goes into the recirculation: Johnson, NASA TP-2005-213477 */
 const pull=(x,dc)=>{const E=mk();E.reset('high');E.S.pos[2]=-1500;const {AP,IN,DT}=E;const vh=Math.sqrt(2500*9.81/(2*E.atmo(1500,0).rho*E.H.rotor.A));
   Object.assign(AP,{on:true,mode:'hover',auto:false,alt:null,vs:0,hdg:0,vN:0,vE:0,posN:E.S.pos[0],posE:E.S.pos[1]});let c0=0,v0=0,w=0;
   for(let t=0;t<32;t+=DT){AP.vs=x*vh*Math.min(1,t/6);const o=E.apStep(DT);IN.lon=o.lon;IN.lat=o.lat;IN.ped=o.ped;
     if(t<30){IN.col=o.col;c0=o.col;v0=E.S.vs;w=E.S.rot.vrs;}else IN.col=c0+(dc||0);E.step(DT);}
   return {dv:E.S.vs-v0,w};};
 /* each pull is compared with the same flight without it: the roughness is seeded, so both see the same
    fluctuation and the difference is the pull's own effect (since 1.9 the roughness is large enough to
    hide it in a single 2-s window) */
 const pull2=x=>{const a=pull(x,0.08),b=pull(x,0);return {dv:a.dv-b.dv,w:a.w};};
 const n=pull2(-0.15),r=pull2(-0.75);
 within('PHY','a 2-s collective pull in the developed ring / the same pull in a normal descent',r.dv/n.dv,-0.5,0.5,'',`vertical speed gained: ${(r.dv/0.3048*60).toFixed(0)} vs ${(n.dv/0.3048*60).toFixed(0)} fpm (ring depth ${r.w.toFixed(2)})`);}

console.log('\n■ Findings of the 1.8 flight test: anti-torque in cruise and autorotation, rotor speed after a power loss, blade stall, ring roughness');
{/* cruise as the flight-test pilot trims it (ball centred, heading held); the yaw budget splits the
    anti-torque between Fenestron, fin and fuselage. Airbus (IN 3540): the fin carries it in cruise, the
    pedal goes back toward the zero-thrust position. CAL: the fin camber was set with this statement. */
 const trimAt=(kt,sec)=>{const E=mk();E.reset('cruise');E.S.vb[0]=kt*E.KT;E.S.rot.lam0=0.02;Object.assign(E.AP,{on:true,mode:'cruise',auto:false,ias:kt,alt:-E.S.pos[2],hdg:E.S.eul[2]});
   const acc={fen:0,fin:0,rot:0,ay:0,ped:0,n:0};fly(E,sec,t=>{if(t>sec-5){acc.fen+=E.S.Mz.fen;acc.fin+=E.S.Mz.fin;acc.rot+=E.S.Mz.rot;acc.ay+=E.S.ay;acc.ped+=E.S.ctl.ped;acc.n++;}});
   for(const k in acc)if(k!=='n')acc[k]/=acc.n;return acc;};
 const hv=mk();L.trim(hv,'hover');const pedH=hv.S.ctl.ped;
 const c120=trimAt(120,45);
 within('CAL','120 kt, ball centred: Fenestron share of the anti-torque moment',-c120.fen/c120.rot,-0.05,0.45,'','Airbus IN 3540: the fin carries the anti-torque in cruise, the pedal goes back to the zero-thrust position (fin camber set with it)');
 row('PHY','… the ball is centred',c120.ay.toFixed(3),Math.abs(c120.ay)<0.08,'|ay| < 0.08 m/s² (the trim really is balanced)','m/s²');
 row('CAL','cruise pedal right of the hover pedal (120 kt)',(c120.ped-pedH).toFixed(3),c120.ped-pedH>0.15,'Airbus IN 3540: more left pedal in the hover than in cruise','');
 reg('Fenestron share of anti-torque, 120 kt',-c120.fen/c120.rot,0.15);
 // steady 65 kt autorotation: the fin's camber needs reverse fan thrust, near but not into the right stop (the right-stop pitch is set with this)
 {const E=mk();E.reset('cruise');const g=E.terrainH(E.S.pos[0],E.S.pos[1]);E.S.pos[2]=-(g+1500);E.S.vb[0]=70*E.KT;Object.assign(E.AP,{on:true,mode:'cruise',auto:false,ias:70,alt:-E.S.pos[2],hdg:E.S.eul[2]});fly(E,25);
  const p100=trimAt(100,40).ped;for(const en of E.S.eng.e)en.on=false;E.AP.auto=true;E.AP.ias=65;let ay=0,ped=0,fT=0,n=0;fly(E,35,t=>{if(t>30){ay+=E.S.ay;ped+=E.S.ctl.ped;fT+=E.S.fen.T;n++;}});ay/=n;ped/=n;fT/=n;
  row('CAL','steady autorotation, 65 kt: reverse fan thrust near the right stop, pedal well right of the 100 kt trim',`${ped.toFixed(2)} (100 kt ${p100.toFixed(2)}), fan ${fT.toFixed(0)} N`,fT<0&&ped-p100>0.4&&ped>0.75&&Math.abs(ped)<0.97,'Airbus IN 3540: more negative Fenestron thrust at full pedal against the fin in autorotation (right stop set with it)','');
  row('PHY','… with the ball centred',ay.toFixed(3),Math.abs(ay)<0.1,'|ay| < 0.1 m/s²','m/s²');}
 /* rotor speed after a double engine failure at 40 kt with the collective raised to the top: the Airbus
    simulation quoted by the AAIB (AAR 3/2015, 1.16.4): ~70 % at 2 s, ~61 % at 3 s, 50 % after ~4.5 s.
    CAL: the polar inertia was fitted to it. */
 {const E=mk();E.reset('cruise');const g=E.terrainH(E.S.pos[0],E.S.pos[1]);E.S.pos[2]=-(g+600);E.S.vb[0]=40*E.KT;Object.assign(E.AP,{on:true,mode:'cruise',auto:false,ias:40,alt:-E.S.pos[2],hdg:E.S.eul[2]});fly(E,40);
  const {IN,DT}=E,c0=E.S.ctl.col;for(const en of E.S.eng.e)en.fail=true;const nr={};
  for(let i=0,t=0;t<=3.0+1e-9;i++,t=i*DT){const o=E.apStep(DT);IN.lon=o.lon;IN.lat=o.lat;IN.ped=o.ped;IN.col=Math.min(1,c0+(1-c0)*Math.min(1,t/0.5));E.step(DT);for(const tt of [2,3])if(Math.abs(t-tt)<DT/2)nr[tt]=E.S.NR;}
  within('CAL','double engine failure at 40 kt, collective to the top: NR at 2 s',nr[2],65,75,'%','AAIB AAR 3/2015 1.16.4 (Airbus simulation): 69-71 %; rotor inertia fitted');
  within('CAL','… NR at 3 s',nr[3],56,66,'%','~61 %');reg('NR 3 s after a double engine failure at 40 kt, full collective',nr[3],0.03,'%');}
 /* retreating-blade stall: an abrupt pull-up from 140 kt at 2910 kg (aft cyclic 25 % of the travel in
    0.5 s, wings held level with the lateral cyclic). Kampa et al. (ERF 1997, Fig. 22) give the EC135's
    limit blade loading against the advance ratio: C_T/σ (from load factor times weight) 0.20 at μ 0.2-0.23,
    0.18 at 0.30, 0.155 at 0.36, 0.12 at 0.40, with flight points along it. As the aircraft pulls up it
    slows, so the peak is compared with the limit at the advance ratio where it occurs. Nothing in the
    model was fitted to this figure (the airfoils' stall comes from their published polars).
    Until 2.2 a KNOWN row compared the load factor at which 10 % of the disc first stalls (1.2-1.3 g)
    with the 1.7 g of the limit: different things (local stall begins well below the limit load). */
 {const E=mk({mass:2910});E.reset('cruise');E.S.vb[0]=140*E.KT;E.S.rot.lam0=0.02;Object.assign(E.AP,{on:true,mode:'cruise',auto:false,ias:140,alt:-E.S.pos[2],hdg:E.S.eul[2]});fly(E,45);E.AP.on=false;
  const {IN,DT}=E,c={...E.S.ctl},rt=E.H.rotor,sig=rt.N*rt.c/(Math.PI*rt.R),W=2910*9.81;let nzOn=null,nzf=1,best={x:0},tw=0,nt=0,ri=c.lat;const tw0=E.S.rot.thEl.reduce((a,v)=>a+v,0)/4;
  const kampa=mu=>{const P=[[0.2,0.20],[0.23,0.20],[0.27,0.192],[0.30,0.181],[0.33,0.168],[0.35,0.157],[0.36,0.151],[0.40,0.122]];if(mu<=P[0][0])return P[0][1];for(let i=1;i<P.length;i++)if(mu<=P[i][0]){const a=P[i-1],b=P[i];return a[1]+(b[1]-a[1])*(mu-a[0])/(b[0]-a[0]);}return 0.12;};
  for(let t=0;t<2.5;t+=DT){Object.assign(IN,c);IN.lon=c.lon-0.25*Math.min(1,t/0.5);
    const [phi]=E.S.eul,p=E.S.om[0];ri+=(0-phi)*DT*0.8;IN.lat=Math.max(-1,Math.min(1,2.4*(0-phi)-0.6*p+ri));
    E.step(DT);nzf+=(E.S.nz-nzf)*Math.min(1,DT/0.1);
    const x=nzf*W/(E.S.rho*Math.PI*rt.R**2*(E.S.rot.Om*rt.R)**2*sig);if(x>best.x)best={x,mu:E.S.rot.mu,nz:nzf};
    if(nzOn===null&&E.S.rot.stall>0.1)nzOn=E.S.nz;if(t>0.8&&t<1.8){tw+=E.S.rot.thEl.reduce((a,v)=>a+v,0)/4;nt++;}}
  within('VAL','abrupt pull-up from 140 kt, 2910 kg: peak blade loading / Kampa\'s limit at that advance ratio',best.x/kampa(best.mu),0.90,1.10,'',`ERF 1997 Fig. 22; peak C_T/σ ${best.x.toFixed(3)} at μ ${best.mu.toFixed(3)} (limit ${kampa(best.mu).toFixed(3)}), ${best.nz.toFixed(2)} g`);
  /* blade torsion (2.1): separated sections carry a nose-down moment that twists the blade back toward
     reattachment; attached, the sections carry almost none and the trim is untouched */
  within('PHY','stalled rotor: mean elastic twist of the blades (nose down)',tw/nt*E.RAD,-6,-0.5,'deg','separated-flow moment / torsional stiffness');
  within('PHY','… in the 140 kt trim before the pull',Math.abs(tw0)*E.RAD,0,1.0,'deg','nearly attached: little twist (the retreating tip sits at its stall angle)');
  reg('pull-up peak blade loading C_T/σ, 140 kt',best.x,0.03,'');reg('stall onset (10 % of the disc) load factor, 140 kt pull',nzOn||0,0.06,'g');}
 /* vortex-ring roughness: collective held in the developed ring, thrust over one revolution, detrended over 4 s.
    Johnson (NASA TP-2005-213477) and flight experience: low-frequency thrust fluctuations of 10-40 % peak to peak.
    The share of the fluctuation the slow ring dynamics put into ~2-6 s periods depends on the seeded sequence. */
 {const E=mk();E.reset('high');E.S.pos[2]=-1500;const {AP,IN,DT}=E;const vh=Math.sqrt(2500*9.81/(2*E.atmo(1500,0).rho*E.H.rotor.A));
  Object.assign(AP,{on:true,mode:'hover',auto:false,alt:null,vs:0,hdg:0,vN:0,vE:0,posN:E.S.pos[0],posE:E.S.pos[1]});let c0=0;const T=[];
  for(let t=0;t<52;t+=DT){AP.vs=-0.7*vh*Math.min(1,t/6);const o=E.apStep(DT);IN.lon=o.lon;IN.lat=o.lat;IN.ped=o.ped;if(t<26){IN.col=o.col;c0=o.col;}else IN.col=c0;E.step(DT);if(t>=26&&E.S.frame%18===0)T.push(E.S.Tbar);}
  const w=80,d=T.map((x,i)=>{const lo=Math.max(0,i-w/2),hi=Math.min(T.length,i+w/2);let m=0;for(let j=lo;j<hi;j++)m+=T[j];return x-m/(hi-lo);}).slice(w/2,-w/2),mean=T.reduce((a,b)=>a+b,0)/T.length;
  // CAL: the roughness amplitude (H.rotor.vrsN) was set after the 1.8 flight test with this band in view
  within('CAL','vortex ring, collective held: thrust fluctuation peak to peak (detrended over 4 s)',(Math.max(...d)-Math.min(...d))/mean*100,10,40,'%','Johnson TP-2005-213477 and flight reports, 10-40 %; amplitude set to it');
  reg('vortex-ring thrust fluctuation p-p (%)',(Math.max(...d)-Math.min(...d))/mean*100,0.25,'%');}
}

console.log('\n■ Training aids stay consistent with the physics');
{/* equilibrium climbs and descents at zero ground speed; the descent stays
    above the vortex-ring onset (a VRS point once sat in this regression and
    skewed the mixing by 45 %) */
 const fit=(pts,k)=>{const n=pts.length,mx=pts.reduce((a,p)=>a+p[0],0)/n,my=pts.reduce((a,p)=>a+p[k],0)/n;let sxy=0,sxx=0;for(const p of pts){sxy+=(p[0]-mx)*(p[k]-my);sxx+=(p[0]-mx)**2;}
   const b=sxy/sxx,res=Math.max(...pts.map(p=>Math.abs(p[k]-my-b*(p[0]-mx)))),span=Math.max(...pts.map(p=>p[k]))-Math.min(...pts.map(p=>p[k]));return {b,lin:res/span};};
 const pts=[];for(const vs of [-1.5,0,2,4,6,8]){const E=mk();E.reset('high');const {AP}=E;AP.on=true;AP.mode='hover';AP.auto=false;AP.alt=null;AP.vs=vs;AP.hdg=0;AP.posN=E.S.pos[0];AP.posE=E.S.pos[1];AP.vN=0;AP.vE=0;fly(E,25);
   pts.push([E.S.ctl.col,E.S.eul[0]*R2D,E.S.ctl.ped]);}
 /* 100 kt: the pedal against the mast torque (kNm), from a 1,600 fpm descent to an 8 m/s climb: the aids'
    torque anticipation in forward flight (H.mix.pedQ) */
 const fwd=[];for(const vs of [-8,-4,0,4,8]){const E=mk();E.reset('cruise');E.S.vb[0]=100*E.KT;const {AP}=E;Object.assign(AP,{on:true,mode:'cruise',auto:false,ias:100,alt:null,vs,hdg:E.S.eul[2]});fly(E,40);
   fwd.push([E.S.eng.Qmast/1e3,0,E.S.ctl.ped]);}
 const E=mk(),mr=fit(pts,1),mp=fit(pts,2),mf=fit(fwd,2);
 within('PHY','roll per collective, measured vs the aids\' mixing (H.mix.roll)',mr.b/E.H.mix.roll,0.9,1.1,'',`measured ${mr.b.toFixed(2)} °/unit`);
 within('PHY','pedal per collective in the hover vs the anticipation (H.mix.ped)',mp.b/E.H.mix.ped,0.9,1.1,'',`measured ${mp.b.toFixed(2)}`);
 within('PHY','pedal per mast torque at 100 kt vs the anticipation (H.mix.pedQ)',mf.b/(E.H.mix.pedQ*1e3),0.9,1.1,'',`measured ${mf.b.toFixed(4)} per kNm`);
 within('PHY','linearity: largest residual of the three fits / span',Math.max(mr.lin,mp.lin,mf.lin),0,0.08,'','a straight line is a fair mixing law here');}

console.log('\n■ Rules from the type certificate (EASA.R.009): bookkeeping, not physics');
{const ratios=(alt,dT)=>{const E=mk({dT});E.reset('high');E.S.pos[2]=-alt;E.step(E.DT);const tw={mcp:E.S.eng.Pmcp,top:E.S.eng.Ptop};E.S.eng.e[0].fail=true;E.step(E.DT);
   return {mcp:tw.mcp/tw.top,o30:E.S.eng.Ptop/tw.top,o2:E.S.eng.P2/E.S.eng.Ptop,omcp:E.S.eng.Pmcp/E.S.eng.Ptop};};
 const want={mcp:69/78,o30:128/156,o2:125/128,omcp:89.5/128};
 for(const [alt,dT,name] of [[100,0,'sea level ISA'],[3000,20,'3000 m ISA+20']]){const r=ratios(alt,dT),err=Math.max(...Object.keys(want).map(k=>Math.abs(r[k]/want[k]-1)));
   row('RULE',`rating ratios equal the certificate's, ${name}`,`${r.mcp.toFixed(3)} ${r.o30.toFixed(3)} ${r.o2.toFixed(3)} ${r.omcp.toFixed(3)}`,err<0.002,'MCP/TOP 0.885, OEI30/TOP 0.821, OEI2/OEI30 0.977, OEIMCP/OEI30 0.699');}
 // the time-limit clocks. OEI hover at 2500 kg needs more than OEI MCP, less than the 2-min rating: the 2.5-min clock
 {const E=mk();L.trim(E,'hover');E.S.eng.e[0].fail=true;const {AP}=E;AP.on=true;let first={},fliMax=0;fly(E,170,t=>{fliMax=Math.max(fliMax,E.S.eng.fli);if(E.S.incident&&!first[E.S.incident.id])first[E.S.incident.id]=t;});
  const t=first.oei2;row('RULE','OEI hover, 2500 kg: the 2.5-min clock fires on time',t===undefined?'none':t.toFixed(0)+' s',t!==undefined&&t>=145&&t<=160,`FLI max ${fliMax.toFixed(1)}; incidents ${Object.keys(first).join(',')||'none'}`,'');}
 // … and with the collective pulled beyond the 2-min rating: the 30-s clock, counted from the first moment above it
 {const E=mk();L.trim(E,'hover');E.S.eng.e[0].fail=true;const {AP,IN,DT}=E;AP.on=true;const c0=E.S.ctl.col;let first={},t0=null;
  for(let t=0;t<60;t+=DT){const o=E.apStep(DT);IN.lon=o.lon;IN.lat=o.lat;IN.ped=o.ped;IN.col=c0+0.12;E.step(DT);
    if(t0===null&&E.S.eng.limit==='OEI 30s')t0=t;if(E.S.incident&&!first[E.S.incident.id])first[E.S.incident.id]=t;}
  const dt=first.oei30!==undefined&&t0!==null?first.oei30-t0:null;
  row('RULE','OEI, collective beyond the 2-min rating: the 30-s clock',dt===null?'none':dt.toFixed(0)+' s',dt!==null&&dt>=29&&dt<=34,`incidents ${Object.keys(first).join(',')||'none'}`,'');}
 const E2=mk();row('RULE','rotor speed limits: power on / power off',`${E2.H.nr.minPowerOn}–${E2.H.nr.maxPowerOn} / ${E2.H.nr.minAuto}–${E2.H.nr.maxAuto}`,E2.H.nr.minPowerOn===97&&E2.H.nr.maxPowerOn===104&&E2.H.nr.minAuto===85&&E2.H.nr.maxAuto===106,'97–104 / 85–106 % (TCDS, above 1900 kg)','%');}

if(UPDATE)fs.writeFileSync(GOLD_F,JSON.stringify(newGold,null,1)+'\n');
console.log(`\n${fails?fails+' FAIL':'all quality checks within range'}${known?`, ${known} known deviation(s)`:''}${UPDATE?' (golden values written)':''}`);
process.exit(fails?1:0);

