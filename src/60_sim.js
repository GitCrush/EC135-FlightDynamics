/* ═══════════════ SIMULATION ═══════════════ */
const DT=1/360;                                   // 55 steps per rotor revolution at 100 % NR
const cfg={
  mass:2500, cgx:0.0, dT:0, qnh:1013,             // aircraft & atmosphere
  sas:true, attHold:true, hdgHold:true, hoverAssist:false, assistK:1,   // stability augmentation (training aids); assistK blends hover assist with the raw stick
  kbdCol:'metered', kbdPed:'heading', pedRate:25,            // keyboard pilot models; yaw rate per pedal key, °/s
  mouse:true, mouseMode:'stick', mouseTravel:1600, mouseButtons:true, padDead:0.06,   // px of mouse movement for full stick (real stick: 80 mm lateral, 108 mm longitudinal per side)
  view:'cockpit', hud:true, rotorDisc:true, fpm:true, sound:true, cloud:0.4,
  engFail:'none',
};
const IN={col:0.45,lon:0,lat:0,ped:0,             // controls after the pilot models, [0..1] / [-1..1]
          raw:{col:0.45,lon:0,lat:0,ped:0},       // device values
          trimLon:0,trimLat:0,trimPed:0};
let S=null;
function newState(){
  return {
    t:0,frame:0,pos:[0,0,-1.30],vb:[0,0,0],q:qfromEuler(0,0,0),om:[0,0,0],omd:[0,0,0],
    rot:rotorState(H.rotor),fen:fenState(),eng:engState(H.eng),
    ctl:{col:0.45,lon:0,lat:0,ped:0},
    rho:1.225,aS:340,wind:[0,0,0],windB:[0,0,0],
    hAGL:0,gear:{contact:0,minH:0,maxSink:0,tail:false},onGround:true,
    NR:100,Pload:0,Pavail:0,Fb:[0,0,0],Mb:[0,0,0],
    ias:0,tas:0,vs:0,alt:0,eul:[0,0,0],nz:1,ay:0,
    crash:'',incident:null,touch:{air:false,vs:0},fuelBurn:0,m:cfg.mass,
    stats:{air:0,maxFli:0,minNr:200,maxNr:0,maxIas:0,maxBank:0,maxSink:0,touchVs:0,landings:0,incidents:0},tether:null,
    log:[],logT:0,logFreeze:0,
  };
}
function placeAt(n,e,altAGL,psi,ias){
  S=newState();
  const hg=terrainH(n,e);
  S.pos=[n,e,-(hg+altAGL+(altAGL<0.5?1.30:1.30))];
  S.q=qfromEuler(0,0,psi);
  S.vb=[ias*KT,0,0];
  S.onGround=altAGL<0.5;
  if(altAGL>0.5){S.rot.lam0=0.05;IN.col=0.52;S.ctl.col=0.52;}else{IN.col=0.05;S.ctl.col=0.05;}
  IN.lon=IN.lat=IN.ped=0;IN.trimLon=IN.trimLat=IN.trimPed=0;
  S.eng.int=0;for(const en of S.eng.e){en.P=altAGL>0.5?220e3:15e3;en.N1=80;en.on=true;en.fail=false;en.startT=0;}
  windReset();
  return S;
}
function reset(kind){
  if(kind==='cold'){placeAt(0,0,0,0,0);S.rot.Om=0;S.rot.lam0=0;for(const en of S.eng.e){en.on=false;en.P=0;en.N1=0;}for(let k=0;k<H.rotor.N;k++)S.rot.beta[k]=-0.03;return S;}
  if(kind==='hover')return placeAt(0,0,3,0,0);
  if(kind==='high')return placeAt(-200,0,1000*FT,0,0);
  if(kind==='cruise')return placeAt(-1500,0,1500*FT,0,100);
  if(kind==='approach')return placeAt(-900,0,500*FT,0,70);
  return placeAt(0,0,0,0,0);   // pad
}
function inertia(){const I=H.I.slice();const k=S.m/H.m;for(let i=0;i<9;i++)I[i]*=k;return I;}
function inv3(a){const[a0,a1,a2,a3,a4,a5,a6,a7,a8]=a;const d=a0*(a4*a8-a5*a7)-a1*(a3*a8-a5*a6)+a2*(a3*a7-a4*a6);
  return[(a4*a8-a5*a7)/d,(a2*a7-a1*a8)/d,(a1*a5-a2*a4)/d,(a5*a6-a3*a8)/d,(a0*a8-a2*a6)/d,(a2*a3-a0*a5)/d,(a3*a7-a4*a6)/d,(a1*a6-a0*a7)/d,(a0*a4-a1*a3)/d];}

function step(dt){
  const m=Math.max(H.mEmpty,cfg.mass-S.fuelBurn), rt=H.rotor, R=qmat(S.q);
  S.m=m;
  /* ---- Atmosphere and wind at the aircraft ---- */
  S.alt=-S.pos[2];
  const at=atmo(S.alt,cfg.dT); S.rho=at.rho; S.aS=at.a;
  const hg=terrainH(S.pos[0],S.pos[1]); S.hAGL=S.alt-hg-1.30;   // skid height above ground
  const vNED=mrot(R,S.vb);
  S.wind=windAt(dt,vlen(S.vb),S.hAGL+1.3);
  S.windB=mrotT(R,S.wind);
  /* ---- Actuators: hydraulic servos, full travel in 0.45 s ---- */
  const rate=dt/0.45;
  S.ctl.col=approach(S.ctl.col,clamp(IN.col,0,1),rate);
  S.ctl.lon=approach(S.ctl.lon,sat(IN.lon,1),2*rate);
  S.ctl.lat=approach(S.ctl.lat,sat(IN.lat,1),2*rate);
  S.ctl.ped=approach(S.ctl.ped,sat(IN.ped,1),2*rate);
  const th0=rt.col0+S.ctl.col*(rt.col1-rt.col0);
  /* ---- Main rotor ---- */
  const hubW=vadd(S.pos,mrot(R,rt.hub));
  const hubAGL=-(hubW[2]+terrainH(hubW[0],hubW[1]));
  const st=S.rot;
  const Qdrive=S.eng.Qdrive;
  const thLon=rt.lonC+S.ctl.lon*rt.lonH;                               // linear gearing, range centred forward
  rotorStep(rt,st,dt,S.vb,S.om,S.omd,S.windB,S.rho,S.aS,hubAGL,th0,thLon,S.ctl.lat*rt.lat,Qdrive);
  /* ---- Fenestron ---- */
  const wakeT=1.2*st.lam0*st.Om*rt.R*sm(0.10,0.02,st.mu);          // rotor wake at the tail, hover to transition
  const fe=fenStep(H.fen,S.fen,dt,S.vb,S.om,S.windB,S.rho,S.aS,st.Om,S.ctl.ped,wakeT);
  /* ---- Engines and rotor speed ----
     I Om' = Q_drive - Q_rotor - Q_fen(referred) - Q_accessories */
  S.NR=st.Om/rt.Om0*100;
  const Pfen=Math.max(0,S.fen.P);
  S.Pload=st.P+Pfen;
  /* Run-up only: below 60 % NR the torque the turbine can pass is limited.
     Above that there is no cap: a drooping rotor in an overpitch must
     still get full power, the FLI sits at the limit while NR bleeds. */
  const qCap=S.NR<60?H.eng.qMax+Math.pow(S.NR/60,3)*26000:1e9;
  const lapse=H.eng.thk*(at.p/101325)*Math.pow(at.T/288.15,-H.eng.thb);   // turbine power in the present air
  const Ptot=engStep(H.eng,S.eng,dt,S.NR,S.Pload,0,(IN.col-S.ctl.col),qCap*Math.max(st.Om,1)+H.eng.idle*2,lapse);
  const Qeng=Math.min(Math.max(0,Ptot)/Math.max(st.Om,5),qCap);                  // freewheel
  const Qload=st.Q+Pfen/Math.max(st.Om,5)+H.eng.acc/rt.Om0+H.eng.qFric*Math.min(1,st.Om/2);   // accessories as constant torque
  S.eng.Qdrive=Qeng;
  st.Om=Math.max(0,st.Om+(Qeng-Qload)/rt.Ir*dt);
  // fuel: burned mass comes off the take-off mass
  S.fuelBurn+=Ptot/3.6e6*H.eng.sfc*dt;
  S.Pavail=S.eng.Pavail;
  /* ---- Fuselage, empennage, gear, gravity ---- */
  const va=vsub(S.vb,S.windB);
  const fu=fuselage(H.fus,va,S.rho,st.T,S.om);
  const sb=stabiliser(H.fus,S.vb,S.om,S.windB,S.rho,st.lam0,st.Om*rt.R,st.mu);
  const fi=fin(H.fus,S.vb,S.om,S.windB,S.rho);
  const ge=gearStep(H.gear,S,R);
  const gB=mrotT(R,[0,0,9.81*m]);
  /* Training tether: a stiff spring-damper on the CG to a point on the
     ground plane. The aircraft can pitch and roll but not translate: the
     stick-to-attitude link can be learned without the consequences. */
  let Ft=[0,0,0];
  if(S.tether){const k=m*10,c=2*0.7*Math.sqrt(k*m);const dN=S.pos[0]-S.tether[0],dE=S.pos[1]-S.tether[1];
    const Fn=[-k*dN-c*vNED[0],-k*dE-c*vNED[1],0];Ft=mrotT(R,Fn);}
  const F=[st.F[0]+fe.F[0]+fu.F[0]+sb.F[0]+fi.F[0]+ge.F[0]+gB[0]+Ft[0],
           st.F[1]+fe.F[1]+fu.F[1]+sb.F[1]+fi.F[1]+ge.F[1]+gB[1]+Ft[1],
           st.F[2]+fe.F[2]+fu.F[2]+sb.F[2]+fi.F[2]+ge.F[2]+gB[2]+Ft[2]];
  const cgOff=[cfg.cgx,0,0];                                   // CG shift: moves every arm
  const M=[st.M[0]+fe.M[0]+fu.M[0]+sb.M[0]+fi.M[0]+ge.M[0],
           st.M[1]+fe.M[1]+fu.M[1]+sb.M[1]+fi.M[1]+ge.M[1],
           st.M[2]+fe.M[2]+fu.M[2]+sb.M[2]+fi.M[2]+ge.M[2]];
  const Mc=vsub(M,vcross(cgOff,vsub(F,gB)));
  S.Fb=F;S.Mb=Mc;S.Mz={rot:st.M[2],fen:fe.M[2],fus:fu.M[2],stab:sb.M[2],fin:fi.M[2],gear:ge.M[2]};   // yaw moment budget (diagnostics)
  /* ---- Rigid body: I w' + w x (I w + H_rotor) = M ---- */
  const I=inertia(), Iinv=inv3(I);
  /* Gyroscopic term of the rotating parts that are rigidly attached: hub
     and gearbox only. The blades' angular momentum reaches the body
     through the flap hinges, and that path is already in the flap
     equation (the Coriolis term) and the transmitted hinge moments;
     adding the blade inertia here would count the precession twice. */
  const Hrot=mrot(rt.Rbh,[0,0,rt.s*rt.Ihub*st.Om]);
  const Iw=mrot(I,S.om);
  const gyro=vcross(S.om,vadd(Iw,Hrot));
  S.omd=mrot(Iinv,vsub(Mc,gyro));
  const acc=vsub(vscl(F,1/m),vcross(S.om,S.vb));
  S.nz=-(acc[2]-gB[2]/m+ (vcross(S.om,S.vb))[2])/9.81; S.ay=(F[1]-gB[1])/m;
  S.om=vadd(S.om,vscl(S.omd,dt));
  S.vb=vadd(S.vb,vscl(acc,dt));
  S.q=qstep(S.q,S.om,dt);
  S.pos=vadd(S.pos,vscl(mrot(qmat(S.q),S.vb),dt));
  /* ---- Derived, ground state, blade strike ---- */
  S.eul=qtoEuler(S.q);
  S.tas=vlen(va);S.ias=S.tas*Math.sqrt(S.rho/1.225);
  S.vs=-vNED[2];
  S.gear=ge;
  const wasGround=S.onGround; S.onGround=ge.contact>0;
  if(S.onGround&&!wasGround){S.touch={air:false,vs:ge.maxSink,t:S.t};S.stats.touchVs=ge.maxSink;S.stats.landings++;}
  if(!S.onGround){S.stats.air+=dt;S.stats.maxFli=Math.max(S.stats.maxFli,S.eng.fli);S.stats.minNr=Math.min(S.stats.minNr,S.NR);S.stats.maxNr=Math.max(S.stats.maxNr,S.NR);S.stats.maxIas=Math.max(S.stats.maxIas,S.ias);S.stats.maxBank=Math.max(S.stats.maxBank,Math.abs(S.eul[0]));S.stats.maxSink=Math.max(S.stats.maxSink,-S.vs);}
  if(!S.crash){
    // main rotor tips against the terrain
    for(let k=0;k<rt.N;k++){
      const psi=st.psi+2*Math.PI*k/rt.N, b=st.beta[k];
      const ph=[-Math.cos(psi)*rt.R*Math.cos(b),-rt.s*Math.sin(psi)*rt.R*Math.cos(b),-rt.R*Math.sin(b)];
      const pw=vadd(S.pos,mrot(R,vadd(rt.hub,mrot(rt.Rbh,ph))));
      if(pw[2]+terrainH(pw[0],pw[1])>0){S.crash='Blade strike';break;}
    }
    if(ge.contact&&(Math.abs(S.eul[0])>0.9||Math.abs(S.eul[1])>0.9))S.crash='Rolled over';
    if(ge.contact&&inLake(S.pos[0],S.pos[1]))S.crash='Ditched in the lake';
    if(ge.contact&&ge.maxSink>6)S.crash='Crash landing';
  }
  if(S.crash){st.Om=Math.max(0,st.Om-dt*8);for(const en of S.eng.e)en.fail=true;}
  S.t+=dt;S.frame++;
  logger(dt);
}
/* ---- Logger (20 s at 60 Hz) with the incident detector ---- */
const LOG_HZ=60,LOG_N=20*LOG_HZ;
function logger(dt){
  S.logT+=dt;if(S.logT<1/LOG_HZ)return;S.logT-=1/LOG_HZ;
  const st=S.rot;
  const rec={t:S.t,alt:S.alt,agl:S.hAGL,ias:S.ias/KT,vs:S.vs/FPM,nr:S.NR,fli:S.eng.fli,
    phi:S.eul[0]*RAD,th:S.eul[1]*RAD,psi:S.eul[2]*RAD,p:S.om[0]*RAD,q:S.om[1]*RAD,r:S.om[2]*RAD,
    col:S.ctl.col,lon:S.ctl.lon,lat:S.ctl.lat,ped:S.ctl.ped,T:st.T,P:S.Pload,vrs:st.vrs,stall:st.stall,ge:st.ge,
    fen:S.fen.stall,nz:S.nz,mu:st.mu,vy:S.vb[1],n:S.pos[0],e:S.pos[1],d:S.pos[2],u:S.vb[0],w:S.vb[2],rpsi:st.psi,b0:st.beta[0],b1:st.beta[1],b2:st.beta[2],b3:st.beta[3],lam0:st.lam0,cont:S.gear.contact,mode:S.eng.mode,crash:S.crash?1:0,
    aoa:st.aoa.map(a=>Float32Array.from(a))};   // per-blade angles of attack: the rotor map in the replay
  if(S.logFreeze>0){S.logFreeze-=1/LOG_HZ;}
  else{S.log.push(rec);if(S.log.length>LOG_N)S.log.shift();}
  incidentCheck(rec);
}
/* The detector names the mechanism, not just the symptom. Each rule is
   the textbook condition; the message tells the pilot what the rotor is
   doing and the standard recovery. */
const INC_RULES=[
  {id:'tailfail',test:r=>S.fen.failed&&!S.onGround,
   text:r=>`Tail drive failure: no anti-torque. In the hover, lower the collective at once (less torque, less spin) and land. In cruise keep the airspeed, the fin holds the nose; plan a run-on landing and close the throttles at touchdown if the yaw cannot be held.`},
  {id:'vrs',test:r=>r.vrs>0.35&&r.vs<-500&&r.ias<30,
   text:r=>`Vortex ring state: sinking ${(-r.vs).toFixed(0)} fpm at ${r.ias.toFixed(0)} kt, the rotor is recirculating its own wake. More collective alone does not stop it. Recover as Airbus advises: forward cyclic decisively to gain airspeed, collective up as power allows. With no room ahead (Vuichard, clockwise rotor): take-off power, left cyclic to a 15–20° bank, right pedal to hold the heading.`},
  {id:'lownr',test:r=>r.nr<H.nr.minPowerOn-2.5&&r.fli>9.5&&S.eng.mode!=='start',
   text:r=>`Rotor speed ${r.nr.toFixed(1)} %: the collective demands more power than ${S.eng.mode==='oei'?'one engine':'the engines'} can deliver (FLI ${r.fli.toFixed(1)}). Lower the collective to recover NR, then trade airspeed for height.`},
  {id:'lownrauto',test:r=>r.nr<H.nr.minAuto&&r.fli<3&&S.eng.mode!=='off'&&S.eng.mode!=='start'&&!S.onGround,
   text:r=>`Rotor speed ${r.nr.toFixed(1)} % in autorotation: the disc is not driven enough. Lower the collective, aft cyclic to load the rotor.`},
  {id:'overspeed',test:r=>r.nr>H.nr.maxAuto,
   text:r=>`Rotor overspeed ${r.nr.toFixed(1)} %: raise the collective to load the disc.`},
  {id:'rbs',test:r=>r.stall>0.28&&r.ias>90,
   text:r=>`Retreating blade stall at ${r.ias.toFixed(0)} kt: the retreating side of the disc is beyond its stall angle, the nose pitches up and the aircraft rolls toward the retreating side. Reduce collective and airspeed, ease the g.`},
  {id:'fen',test:r=>r.fen>0.6&&Math.abs(r.ped)>0.9,
   text:r=>`Fenestron at its limit: pedal ${(r.ped*100).toFixed(0)} %, blades stalled. Yaw authority is gone until power comes off or airspeed comes on. Reduce collective, get the nose into wind.`},
  {id:'overtorque',test:r=>r.fli>11.5,
   text:r=>`Above take-off power (FLI ${r.fli.toFixed(1)}): overtorque. Lower the collective.`},
  {id:'rollover',test:r=>S.onGround&&S.gear.contact<4&&S.gear.contact>0&&Math.abs(r.phi)>7&&Math.sign(r.p)===Math.sign(r.phi)&&Math.abs(r.p)>4,
   text:r=>`Dynamic rollover: pivoting on one skid at ${Math.abs(r.phi).toFixed(0)}° with the rotor pulling sideways. Lower the collective smoothly. Cyclic alone cannot stop it once the critical angle is passed.`},
  {id:'hard',test:r=>S.touch&&S.touch.t&&S.t-S.touch.t<0.5&&S.touch.vs>H.gear.hardVs&&!S.touch.air,
   text:r=>`Hard landing: ${(S.touch.vs/FPM).toFixed(0)} fpm at touchdown.`},
  {id:'vne',test:r=>r.ias>H.vne+3,text:r=>`Above Vne (${H.vne} kt).`},
  {id:'crash',test:r=>!!S.crash,text:r=>S.crash+'.'},
];
const INC_LAST={};
function incidentCheck(rec){
  for(const rule of INC_RULES){
    if(rule.test(rec)){
      if(INC_LAST[rule.id]&&S.t-INC_LAST[rule.id]<8)return;
      INC_LAST[rule.id]=S.t;S.stats.incidents++;
      S.incident={id:rule.id,t:S.t,text:rule.text(rec)};
      if(rule.id==='crash'||rule.id==='rollover'||rule.id==='hard')S.logFreeze=6;
      return;
    }
  }
}
function exportCSV(){
  if(!S.log.length)return '';
  const keys=Object.keys(S.log[0]).filter(k=>k!=='aoa');
  return keys.join(',')+'\n'+S.log.map(r=>keys.map(k=>typeof r[k]==='number'?r[k].toFixed(4):r[k]).join(',')).join('\n');
}
rotorInit(H.rotor);fenInit(H.fen);
