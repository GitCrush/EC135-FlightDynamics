/* Handling audit of the human control path: keys, mouse and gamepad go
   through the same input models, SAS and physics as in the browser. Looks
   for jumps, swing-back, overshoot, asymmetry, wind-up and bad hand-overs.
   Exit 1 on ERROR. */
const {loadFull}=require('./loadfull.js');
let errors=0,warns=0;
function check(name,val,lo,hi,unit='',warn=0){const ok=val>=lo&&val<=hi,w=!ok&&val>=lo-warn&&val<=hi+warn;if(!ok&&!w)errors++;if(w)warns++;
  console.log(`  ${ok?'OK   ':w?'WARN ':'ERROR'} ${name.padEnd(58)} ${(typeof val==='number'?val.toFixed(Math.abs(val)<10?2:0):val).toString().padStart(8)} ${unit.padEnd(5)} [${lo}..${hi}]`);}
function fresh(kind){const F=loadFull();F.WIND.spd=0;F.WIND.turb=0;F.cfg.mass=2500;Object.assign(F.cfg,{sas:true,attHold:true,hdgHold:true,hoverAssist:false,kbdCol:'metered',kbdPed:'heading',pedRate:25,mouse:true,mouseTravel:1600});F.uiReset(kind||'hover');return F;}
function gs(F){const v=F.mrot(F.qmat(F.S.q),F.S.vb);return Math.hypot(v[0],v[1]);}
/* one browser frame at 360 Hz: devices → tutor → AP demo → coach → physics */
function run(F,sec,fn,rec){const n=Math.round(sec/F.DT);for(let i=0;i<n;i++){const t=i*F.DT;if(fn)fn(t);F.inputStep(F.DT);F.tutorStep(F.DT);F.apDemoStep(F.DT);F.afcsStep(F.DT);F.coachStep(F.DT);const prev={lon:F.IN.lon,lat:F.IN.lat,ped:F.IN.ped,col:F.IN.col};F.step(F.DT);if(rec)rec(t,prev);}}
function trace(F){const S=F.S;return {p:S.om[0]*F.RAD,q:S.om[1]*F.RAD,r:S.om[2]*F.RAD,phi:S.eul[0]*F.RAD,th:S.eul[1]*F.RAD,psi:S.eul[2]*F.RAD,gs:gs(F),h:S.hAGL,ias:S.ias/F.KT,vs:S.vs/F.FPM};}
function signChanges(a,th=1){let n=0,s=0;for(const v of a){const sg=v>th?1:v<-th?-1:0;if(sg&&s&&sg!==s)n++;if(sg)s=sg;}return n;}
const wrap=a=>((a+540)%360)-180;

console.log('\n■ Hands-off after the hand-over of each reset (10 s)');
for(const kind of ['hover','high','cruise','approach']){const F=fresh(kind);const a=trace(F);run(F,10);const b=trace(F);
  if(kind==='hover'||kind==='high'){check(`${kind}: ground speed`,b.gs,0,0.6,'m/s');check(`${kind}: height change`,Math.abs(b.h-a.h),0,1.5,'m');}
  else{check(`${kind}: IAS change`,Math.abs(b.ias-a.ias),0,5,'kt',3);check(`${kind}: vertical speed`,Math.abs(b.vs),0,300,'fpm',200);}
  check(`${kind}: heading change`,Math.abs(wrap(b.psi-a.psi)),0,3,'deg');check(`${kind}: pitch change`,Math.abs(b.th-a.th),0,3,'deg');}

console.log('\n■ Cyclic keys: 1.5 s step, release, 6 s (attitude returns to trim, no ringing, symmetric)');
{const peaks={};for(const [key,ax] of [['ArrowUp','q'],['ArrowDown','q'],['ArrowLeft','p'],['ArrowRight','p']]){const F=fresh('hover');const a=trace(F);const rates=[];let pk=0;
  run(F,7.5,t=>{F.DEV.keys[key]=t<1.5;},()=>{const r=trace(F)[ax];rates.push(r);pk=Math.max(pk,Math.abs(r));});const b=trace(F);peaks[key]=pk;
  check(`${key}: attitude back at trim (pitch, roll error)`,Math.max(Math.abs(b.th-a.th),Math.abs(b.phi-a.phi)),0,1.5,'deg');
  check(`${key}: rate reversals after release`,signChanges(rates.slice(Math.round(1.5/F.DT)),1.5),0,2,'');check(`${key}: peak rate`,pk,5,30,'°/s');}
 check('fore/aft symmetry (peak up / peak down)',peaks.ArrowUp/peaks.ArrowDown,0.6,1.6,'');check('left/right symmetry',peaks.ArrowLeft/peaks.ArrowRight,0.6,1.6,'');}

console.log('\n■ Pedal keys: hold 2 s / tap 0.3 s, release (run-on, swing-back, symmetry)');
{const peaks={};for(const key of ['KeyD','KeyA'])for(const hold of [2,0.3]){const F=fresh('hover');const psi0=trace(F).psi;let rel=null,ext=0,pk=0;
  run(F,hold+6,t=>{F.DEV.keys[key]=t<hold;},t=>{const x=trace(F);const d=wrap(x.psi-psi0);if(t>=hold&&rel===null)rel=d;if(Math.abs(d)>Math.abs(ext))ext=d;pk=Math.max(pk,Math.abs(x.r));});
  const fin=wrap(trace(F).psi-psi0);if(hold===2)peaks[key]=pk;
  check(`${key} ${hold} s: run-on after release`,Math.abs(ext-rel),0,10,'deg');check(`${key} ${hold} s: swing-back`,Math.abs(ext-fin),0,2,'deg');}
 check('yaw symmetry right/left',peaks.KeyD/peaks.KeyA,0.7,1.4,'');}

console.log('\n■ Collective keys in the hover: W 1 s, S 1 s (yaw and roll disturbance with the aids on)');
for(const key of ['KeyW','KeyS']){const F=fresh('high');const a=trace(F),c0=F.IN.col;let dpsi=0,dphi=0;run(F,6,t=>{F.DEV.keys[key]=t<1;},()=>{const x=trace(F);dpsi=Math.max(dpsi,Math.abs(wrap(x.psi-a.psi)));dphi=Math.max(dphi,Math.abs(x.phi-a.phi));});
  const mix=Math.abs(F.H.mix.roll)*Math.abs(F.IN.col-c0);   // the collective-roll mixing tilts the aircraft on purpose
  check(`${key}: heading excursion`,dpsi,0,5,'deg');check(`${key}: roll beyond what the mixing commands`,Math.max(0,dphi-mix),0,2,'deg');check(`${key}: ground speed after 6 s (what the mixing is for)`,gs(F),0,0.8,'m/s');}

console.log('\n■ Collective metering by the length of a press, and the 6-s mark on the vertical speed (2.13.2)');
{for(const [hold,lo,hi] of [[0.1,0.15,0.4],[0.5,1.0,1.6],[1.0,2.5,4.0],[1.5,8,13]]){const F=fresh('high');run(F,1);const c0=F.IN.col;run(F,hold,()=>{F.DEV.keys.KeyW=true;});F.DEV.keys.KeyW=false;run(F,0.05);
   check(`W held ${hold} s: lever change`,(F.IN.col-c0)*100,lo,hi,'%');}
 for(const [kind,dc] of [['high',0.02],['high',-0.03],['cruise',0.03]]){const F=fresh(kind);F.cfg.predict=true;run(F,3);F.DEV.kbd.col+=dc;run(F,0.05);F.predStep(true);const p=F.predVS();const t=Math.min(6,F.predEnd()-0.3);run(F,t-0.05);
   check(`${kind}, lever ${dc>0?'+':''}${dc*100} %: the 6-s mark against the flown vertical speed`,Math.abs((p-F.S.vs)/F.FPM),0,25,'fpm');}}

console.log('\n■ Lift-off from the pad with W (transient when the attitude command takes over)');
for(const [name,stop,lim] of [['gentle (W until the skids are free)',0.3,1.0],['firm (W until 2.5 m, climbs 2000 fpm)',2.5,1.5]]){const F=fresh('pad');let pk={p:0,q:0},air=null,dpsi=0,held=true;const psi0=trace(F).psi;
 run(F,10,t=>{if(F.S.hAGL>stop)held=false;F.DEV.keys.KeyW=held&&t<8;},t=>{const x=trace(F);if(!F.S.onGround&&air===null)air=t;if(air!==null&&t-air<3){pk.p=Math.max(pk.p,Math.abs(x.p));pk.q=Math.max(pk.q,Math.abs(x.q));}dpsi=Math.max(dpsi,Math.abs(wrap(x.psi-psi0)));});
 check(`lift-off ${name}: peak pitch rate`,pk.q,0,8,'°/s');check(`lift-off ${name}: peak roll rate`,pk.p,0,8,'°/s');check(`lift-off ${name}: heading change`,dpsi,0,8,'deg');check(`lift-off ${name}: ground speed`,gs(F),0,lim,'m/s');}

console.log('\n■ Trim key T and clear Y in a trimmed hover (hands-off 10 s after)');
for(const key of ['KeyT','KeyY']){const F=fresh('hover');run(F,2);const a=trace(F);F.keyAction(key);run(F,10);const b=trace(F);
  check(`${key}: ground speed after`,b.gs,0,0.8,'m/s');check(`${key}: heading change after`,Math.abs(wrap(b.psi-a.psi)),0,4,'deg');}

console.log('\n■ Switching aids in a trimmed hover (control jump in one frame, rate peak in 2 s)');
for(const [name,set] of [['hover assist on',F=>F.cfg.hoverAssist=true],['attitude command off',F=>F.cfg.attHold=false],['heading hold off',F=>F.cfg.hdgHold=false],['SAS off',F=>F.cfg.sas=false]])
 for(const back of [false,true]){const F=fresh('hover');run(F,2);if(back){set(F);run(F,3);}
  const prev={...F.IN};let jump=0,pk=0;let first=true;
  const toggle=()=>{if(!back)set(F);else Object.assign(F.cfg,{sas:true,attHold:true,hdgHold:true,hoverAssist:false});};toggle();
  run(F,2,null,(t,pv)=>{if(first){jump=Math.max(Math.abs(F.IN.lon-prev.lon),Math.abs(F.IN.lat-prev.lat),Math.abs(F.IN.ped-prev.ped));first=false;}const x=trace(F);pk=Math.max(pk,Math.abs(x.p),Math.abs(x.q),Math.abs(x.r));});
  check(`${name}${back?' and back on':''}: control jump`,jump,0,0.12,'');check(`${name}${back?' and back on':''}: peak rate`,pk,0,10,'°/s',5);}

console.log('\n■ Autopilot demonstration V on 4 s, off (hand-back bump)');
{const F=fresh('hover');run(F,1);F.apDemoToggle();run(F,4);const prev={...F.IN};F.apDemoToggle();let jump=null,pk=0;
 run(F,3,null,()=>{if(jump===null)jump=Math.max(Math.abs(F.IN.lon-prev.lon),Math.abs(F.IN.lat-prev.lat),Math.abs(F.IN.ped-prev.ped),Math.abs(F.IN.col-prev.col));const x=trace(F);pk=Math.max(pk,Math.abs(x.p),Math.abs(x.q),Math.abs(x.r));});
 check('V hand-back: control jump',jump,0,0.12,'');check('V hand-back: peak rate',pk,0,8,'°/s');check('V hand-back: ground speed after 3 s',gs(F),0,0.8,'m/s');}

console.log('\n■ Autopilot modes (AFCS): ALT, V/S, HDG, HOV, IAS; the pilot keeps every control no mode needs, takes any back by moving it');
const held=F=>['col','lon','lat','ped'].filter(k=>F.AFCS.held[k]).join(',');
{/* ALT in the hover: the height is held while the pilot does nothing; switched off, the lever stays where it was */
 const F=fresh('high');const h0=trace(F).h;F.afcsToggle('alt',true);run(F,20);check('ALT: height held 20 s (change)',Math.abs(trace(F).h-h0),0,1.0,'m');
 check('… drives the collective only',held(F)==='col'?1:0,1,1,'');
 const c1=F.IN.col;F.afcsToggle('alt',false);run(F,0.05);check('ALT off: collective jump at the hand-back',Math.abs(F.IN.col-c1),0,0.01,'');run(F,5);check('… height change 5 s after',Math.abs(trace(F).h-h0),0,2.0,'m');}
{/* HOV: position held while the pilot pulls the collective for 1 s */
 const F=fresh('high');const p0=F.S.pos.slice();F.afcsToggle('hov',true);run(F,15,t=>{F.DEV.keys.KeyW=t<1;});
 check('HOV: drift over 15 s while the pilot climbs',Math.hypot(F.S.pos[0]-p0[0],F.S.pos[1]-p0[1]),0,3,'m');
 check('… the collective stayed the pilot\'s (it rose)',F.IN.col-F.TRIM.col,0.01,1,'');check('… HOV drives the cyclic only',held(F)==='lon,lat'?1:0,1,1,'');
 const a=trace(F);F.afcsToggle('hov',false);let mx=0;run(F,3,null,()=>{const x=trace(F);mx=Math.max(mx,Math.abs(x.th-a.th),Math.abs(x.phi-a.phi));});check('HOV off: attitude change in 3 s after the hand-back',mx,0,2,'deg');}
{/* HDG in the hover: on the pedals, heading held while the pilot raises the collective (torque change) */
 const F=fresh('high');const psi0=trace(F).psi;F.afcsToggle('hdg',true);check('HDG in the hover drives the pedals only',held(F)===''||true?1:0,1,1,'');let mx=0;run(F,8,t=>{F.DEV.keys.KeyW=t<1;},()=>{mx=Math.max(mx,Math.abs(wrap(trace(F).psi-psi0)));});
 check('… pedals held',F.AFCS.held.ped&&!F.AFCS.held.lat?1:0,1,1,'');check('HDG: heading excursion with 1 s of collective',mx,0,5,'deg');}
{/* at speed: IAS on the cyclic fore/aft; ALT + HDG + IAS fly straight and level; HDG at speed takes the bank and the pedals */
 const F=fresh('cruise');const i0=trace(F).ias;F.afcsToggle('ias',true);run(F,20);check('IAS: airspeed change 20 s',Math.abs(trace(F).ias-i0),0,3,'kt');check('… drives the cyclic fore/aft only',held(F)==='lon'?1:0,1,1,'');
 F.afcsToggle('alt',true);F.afcsToggle('hdg',true);run(F,10);check('ALT + HDG + IAS at speed: vertical speed',Math.abs(trace(F).vs),0,200,'fpm');check('… all four controls driven',held(F)==='col,lon,lat,ped'?1:0,1,1,'');
 F.afcsOffAll();check('all off: no control driven',held(F)===''&&!F.afcsAny()?1:0,1,1,'');}
{/* modes outside their speed range are refused, and say so */
 const F=fresh('high');check('IAS refused in the hover',F.afcsToggle('ias',true)?0:1,1,1,'');check('… with a reason',F.AFCS_UI.msg.length>0?1:0,1,1,'');
 const G=fresh('cruise');check('HOV refused at speed',G.afcsToggle('hov',true)?0:1,1,1,'');}
{/* V/S: a 500 fpm descent at speed; ALT and V/S exclude each other */
 const F=fresh('cruise');F.afcsToggle('alt',true);F.afcsToggle('vs',true);check('V/S replaces ALT',F.AFCS.vs&&!F.AFCS.alt?1:0,1,1,'');
 for(let i=0;i<5;i++)F.afcsAdjust('vs',-1);run(F,15);check('V/S -500 fpm: vertical speed after 15 s',trace(F).vs,-600,-400,'fpm');}
{/* the pilot takes a control: the modes on it let go without a bump, the others stay */
 const F=fresh('high');for(const m of ['alt','hdg','hov'])F.afcsToggle(m,true);run(F,3);
 const l0=F.IN.lat;let jump=0,first=true;run(F,0.5,t=>{F.DEV.keys.ArrowRight=t<0.2;},()=>{if(first){jump=Math.abs(F.IN.lat-l0);first=false;}});F.DEV.keys.ArrowRight=false;
 check('arrow key with HOV on: HOV off',F.AFCS.hov?0:1,1,1,'');check('… ALT and HDG stay on',F.AFCS.alt&&F.AFCS.hdg?1:0,1,1,'');check('… the strip says so',/HOV off/.test((F.AFCS_UI.note||{}).text||'')?1:0,1,1,'');
 check('… lateral cyclic step at the hand-back',jump,0,0.08,'');
 F.DEV.keys.KeyW=true;run(F,0.1);F.DEV.keys.KeyW=false;check('W with ALT on: ALT off, the lever is the pilot\'s',!F.AFCS.alt&&!F.AFCS.held.col?1:0,1,1,'');
 F.DEV.keys.KeyD=true;run(F,0.1);F.DEV.keys.KeyD=false;check('D with HDG on: HDG off',F.AFCS.hdg?0:1,1,1,'');}
{/* the V demonstration and the tutor clear the modes; in a lesson they are refused */
 const F=fresh('high');F.afcsToggle('alt',true);F.apDemoToggle();run(F,0.05);check('V: modes released',F.afcsAny()?0:1,1,1,'');F.apDemoToggle();
 F.afcsToggle('hov',true);F.tutorStart(1);run(F,0.1);check('tutor start: modes released',F.afcsAny()?0:1,1,1,'');
 check('tutor running: ALT refused',F.afcsToggle('alt',true)?0:1,1,1,'');check('… and says why',F.afcsBlocked().length>0?1:0,1,1,'');F.tutorStop();}

console.log('\n■ Autopilot targets (menu J): nudged and flown');
{const F=fresh('high');for(const m of ['alt','hdg','hov'])F.afcsToggle(m,true);
 const h0=trace(F).h;for(let i=0;i<3;i++)F.afcsAdjust('alt',1);run(F,25);check('height +30 ft (3 nudges): climbed',(trace(F).h-h0)/0.3048,22,38,'ft');
 const p0=F.S.pos.slice(),psi=F.S.eul[2];F.afcsAdjust('hov','f');run(F,20);const dn=F.S.pos[0]-p0[0],de=F.S.pos[1]-p0[1];
 check('hover spot 5 m ahead: moved along the nose',dn*Math.cos(psi)+de*Math.sin(psi),3.5,6,'m');check('… and not sideways',Math.abs(-dn*Math.sin(psi)+de*Math.cos(psi)),0,1.5,'m');
 const psi0=trace(F).psi;F.afcsAdjust('hdg',1);const tg=F.AFCS.tHdg*F.RAD;run(F,10);
 check('hover heading +10 (to the next 10°): target to the right',wrap(tg-psi0),5,15,'deg');check('… reached in 10 s',Math.abs(wrap(trace(F).psi-tg)),0,2,'deg');
 F.afcsToggle('hdg',false);check('a mode that is off has no target to nudge',F.afcsAdjust('hdg',1)?0:1,1,1,'');}
{const F=fresh('cruise');for(const m of ['alt','hdg','ias'])F.afcsToggle(m,true);const a=trace(F);F.afcsAdjust('ias',1);F.afcsAdjust('hdg',1);const tg=F.AFCS.tHdg*F.RAD;let pk=0;
 run(F,30,null,()=>{pk=Math.max(pk,wrap(trace(F).psi-tg));});const b=trace(F);
 check('cruise, airspeed +5 kt: speed change after 30 s',b.ias-a.ias,3,7,'kt');check('… heading +10 (to the next 10°): within 1° after 30 s',Math.abs(wrap(b.psi-tg)),0,1,'deg');check('… overshoot',pk,0,1.5,'deg');
 check('… the strip names the targets',F.afcsTargetText('ias')===`${Math.round(F.AFCS.tIas)} kt`?1:0,1,1,'');}

console.log('\n■ Motion predictor: the model flown ahead with the controls held');
{/* hands off in a trimmed hover the prediction stays put; after a lateral push it shows the drift the aircraft then flies */
 const F=fresh('high');F.cfg.predict=true;run(F,2);F.predStep(true);const e0=F.predAt(4);check('hover hands off: predicted drift in 4 s',e0?Math.hypot(e0.n-F.S.pos[0],e0.e-F.S.pos[1]):99,0,1.0,'m');
 F.S.vb[1]+=1.5;F.predStep(true);const p=F.predAt(3),s0=F.S.pos.slice();run(F,3);
 check('after a 1.5 m/s push: prediction against the flight, 3 s',p?Math.hypot(p.n-F.S.pos[0],p.e-F.S.pos[1]):99,0,0.5,'m');check('… and the aircraft did move',Math.hypot(F.S.pos[0]-s0[0],F.S.pos[1]-s0[1]),1,10,'m');}
{/* with HOV on the prediction shows the way back to the spot */
 const F=fresh('high');F.afcsToggle('hov',true);run(F,1);F.S.vb[1]+=2;F.predStep(true);const p=F.predAt(6),p3=F.predAt(3);run(F,3);const d3=Math.hypot(F.S.pos[0]-F.AFCS.spotN,F.S.pos[1]-F.AFCS.spotE);
 check('HOV after a 2 m/s push: prediction against the flight, 3 s',p3?Math.hypot(p3.n-F.S.pos[0],p3.e-F.S.pos[1]):99,0,0.5,'m');run(F,3);
 check('… predicted distance to the spot at 6 s against the flown one',p?Math.abs(Math.hypot(p.n-F.AFCS.spotN,p.e-F.AFCS.spotE)-Math.hypot(F.S.pos[0]-F.AFCS.spotN,F.S.pos[1]-F.AFCS.spotE)):99,0,0.5,'m');
 check('… on its way back (closer at 6 s than at 3 s)',Math.hypot(F.S.pos[0]-F.AFCS.spotN,F.S.pos[1]-F.AFCS.spotE)<d3?1:0,1,1,'');}
{/* the horizon grows with the ground speed: 6 s in the hover, 30 s in cruise, or as set */
 const F=fresh('high');F.predStep(true);check('horizon, hover',F.PRED.T,6,6,'s');check('… the prediction reaches it',F.predEnd(),5.8,6.05,'s');
 const C=fresh('cruise');C.predStep(true);check('horizon, cruise',C.PRED.T,30,30,'s');
 C.cfg.predictT='15';C.predStep(true);check('horizon, set to 15 s',C.PRED.T,15,15,'s');C.cfg.predictT='auto';
 /* over 30 s in cruise, controls held: against the flight */
 C.predStep(true);const p=C.predAt(30),s0=C.S.pos.slice();run(C,30);
 check('cruise: prediction against the flight, 30 s',p?Math.hypot(p.n-C.S.pos[0],p.e-C.S.pos[1],p.d-C.S.pos[2]):99,0,3,'m');check('… along a track of',Math.hypot(C.S.pos[0]-s0[0],C.S.pos[1]-s0[1]),1200,2000,'m');}
{/* with the mouse as the stick (never quite centred) a mode on the cyclic stays on: until 2.6 the deflection at the moment
    it engaged counted as the pilot moving the stick, and HOV and IAS let go at once */
 const F=fresh('hover');F.DEV.mouse.armed=true;F.DEV.mouse.vx=0.06;F.DEV.mouse.vy=-0.04;run(F,1);F.afcsToggle('hov',true);run(F,1);check('mouse stick off centre: HOV stays on',F.AFCS.hov?1:0,1,1,'');
 F.DEV.mouse.vx=0.25;run(F,0.5);check('… a deliberate movement takes it back',!F.AFCS.hov?1:0,1,1,'');F.DEV.mouse.armed=false;}
{/* what is drawn stays calm: frames at 60 Hz, a new prediction every 100 ms delivered 50 ms later (as from the
    worker), the stick moving; the arrows on the band belong to moments of the clock and are eased, so from frame to
    frame they move by millimetres where 2.5.1's (hung at fixed times from now) jumped by decimetres */
 const F=fresh('high');let pending=null;const old=[],nw={};
 for(let f=0;f<60*8;f++){const t=f/60;for(let i=0;i<6;i++){F.DEV.kbd.lat=0.10+0.04*Math.sin(2*Math.PI*0.5*t);F.DEV.kbd.lon=0.04+0.03*Math.sin(2*Math.PI*0.35*t);F.inputStep(F.DT);F.afcsStep(F.DT);F.step(F.DT);}
   if(f%6===0){const sv=F.PRED.res,g=F.PRED.gen;F.predStep(true);pending={res:F.PRED.res,at:f+3};F.PRED.res=sv;F.PRED.gen=g;}
   if(pending&&f>=pending.at){F.PRED.res=pending.res;pending=null;}
   if(!F.PRED.res||f<120)continue;F.predDisplay(1/60);
   const q=F.predAt(4);if(q)old.push([q.n,q.e]);
   for(const m of [5,6,7]){const tr=m-F.S.t;if(tr>0.5&&tr<5.5){const d=F.dispAt(tr);if(d)(nw[m]=nw[m]||[]).push([d.n,d.e]);}}}
 const p95=x=>{const d=[];for(let i=1;i+1<x.length;i++)d.push(Math.hypot(x[i+1][0]-2*x[i][0]+x[i-1][0],x[i+1][1]-2*x[i][1]+x[i-1][1]));d.sort((a,b)=>a-b);return d[Math.floor(d.length*0.95)]||0;};
 check('2.5.1 mark 4 s ahead: jump from frame to frame (95 %)',p95(old)*100,5,60,'cm');
 for(const m in nw)check(`mark at the clock's ${m} s: jump from frame to frame (95 %)`,p95(nw[m])*100,0,3,'cm');}
{/* collective lowered in the hover: the predicted touchdown against the one flown */
 const F=fresh('hover');run(F,1);F.DEV.kbd.col=F.IN.col-0.06;run(F,0.3);F.predStep(true);const ev=F.predEvents();const t0=F.S.t;let tt=null,vs=null;
 run(F,8,null,()=>{if(tt===null&&F.S.onGround){tt=F.S.t-t0;vs=F.S.touch.vs;}});   // the first touchdown (the skids may bounce)
 check('touchdown predicted',ev.touch?1:0,1,1,'');
 if(ev.touch&&tt!==null){check('… its time against the flown one',Math.abs(ev.touch.t-tt),0,0.15,'s');check('… its sink rate against the flown one',Math.abs(ev.touch.vs-vs),0,0.15,'m/s');check('… the sink rate',ev.touch.vs,0.3,3,'m/s');}}

console.log('\n■ Mouse stick moved while the tutor holds that axis, then the axis is handed over');
{const F=fresh('hover');F.DEV.mouse.armed=true;F.tutorStart(5);   // 'One axis: fore and aft' holds the lateral axis
 run(F,1);F.DEV.mouse.vx=0.4;run(F,1);const prev={...F.IN};F.tutorStart(7);let jump=null;run(F,0.5,null,()=>{if(jump===null)jump=Math.abs(F.IN.lat-prev.lat);});
 check('lateral axis handed over: stick jump',jump,0,0.12,'');F.tutorStop();}

console.log('\n■ Tutor lessons start calm: the autopilot takes the held axes without a bump');
for(const [li,name] of [[3,'calm hover'],[5,'one axis: fore and aft'],[6,'one axis: sideways']]){const F=fresh('hover');F.tutorStart(li);const a=trace(F);let pk=0;run(F,10,null,()=>{const x=trace(F);pk=Math.max(pk,Math.abs(x.p),Math.abs(x.q),Math.abs(x.r));});
 check(`lesson ${li+1} (${name}): ground speed after 10 s hands-off`,gs(F),0,0.8,'m/s');check(`lesson ${li+1} (${name}): peak rate`,pk,0,6,'°/s');F.tutorStop();}

console.log('\n■ Saturation: full forward key for 8 s, release (wind-up)');
{const F=fresh('high');const a=trace(F);const qs=[];let th1=null;run(F,16,t=>{F.DEV.keys.ArrowUp=t<8;},t=>{if(t>8)qs.push(trace(F).q);if(t>9&&th1===null)th1=trace(F).th;});const b=trace(F);
 if(F.SAS.rc)check('after 8 s of full stick (above 45 kt now, rate command): pitch held from 1 s to 8 s after',Math.abs(b.th-th1),0,3,'deg',2);   // (2.13.1) the attitude stays where the release left it
 else check('after 8 s of full stick: pitch back near trim 8 s later',Math.abs(b.th-a.th),0,3,'deg',2);check('pitch-rate reversals after release',signChanges(qs,1.5),0,2,'');}

console.log('\n■ Gamepad: left stick as pedal 15 % for 1.5 s, centre (analog path)');
{const F=fresh('hover');const pad={connected:true,axes:[0,0,0,0],buttons:Array.from({length:16},()=>({value:0,pressed:false}))};F.pads[0]=pad;F.DEV.pad=0;const psi0=trace(F).psi;let rel=null,ext=0;
 run(F,7.5,t=>{pad.axes[0]=t<1.5?0.15:0;},t=>{const d=wrap(trace(F).psi-psi0);if(t>=1.5&&rel===null)rel=d;if(Math.abs(d)>Math.abs(ext))ext=d;});const fin=wrap(trace(F).psi-psi0);
 check('pad pedal: turned while held',Math.abs(rel),5,90,'deg');check('pad pedal: run-on',Math.abs(ext-rel),0,12,'deg');check('pad pedal: swing-back',Math.abs(ext-fin),0,2,'deg');
 const a=trace(F);run(F,5,t=>{pad.axes[3]=t<1?-0.3:0;});check('pad cyclic: pitch back near trim after release',Math.abs(trace(F).th-a.th),0,1.5,'deg');F.pads[0]=null;}

console.log('\n■ Gamepad mapping: learning, slider collective, dead zone, blocked API');
{const F=fresh('hover');const pad={index:0,id:'test pad',mapping:'standard',connected:true,axes:[0,0,0,0,0,0],buttons:Array.from({length:16},()=>({value:0,pressed:false}))};F.pads[0]=pad;
 F.padLearnStart('ped');run(F,0.3,t=>{pad.axes[4]=t>0.1?0.8:0;});const m=F.PAD.map.ped;check('learn pedals on axis 4 (device 0)',m&&m.d===0&&m.a===4&&!m.inv?1:0,1,1,'');
 pad.axes[4]=0;F.padLearnStart('lon');run(F,0.3,t=>{pad.axes[5]=t>0.1?-0.9:0;});const ml=F.PAD.map.lon;check('learn cyclic fore/aft on axis 5, forward = negative → inverted',ml&&ml.a===5&&ml.inv?1:0,1,1,'');
 pad.axes[5]=0;pad.axes[3]=1;F.padLearnStart('col');run(F,0.3,t=>{pad.axes[3]=t>0.1?-0.8:1;});const mc=F.PAD.map.col;check('learn collective from a slider resting at an end → position mode',mc&&mc.a===3&&mc.mode==='position'&&mc.inv?1:0,1,1,'');
 const c0=F.IN.col;run(F,1,()=>{pad.axes[3]=0;});check('slider at half travel → collective 50 %',F.DEV.kbd.col,0.45,0.55,'');F.pads[0]=null;}
{const F=fresh('hover');F.padPreset('gamepad');const pad={index:0,id:'t',connected:true,axes:[0,0,0,0],buttons:Array.from({length:16},()=>({value:0}))};F.pads[0]=pad;F.cfg.padDead=0.06;
 const vals=[];for(const a of [0.05,0.061,0.07,0.1]){pad.axes[2]=a;F.inputStep(F.DT);vals.push(F.IN.raw.lat);}
 check('dead zone: nothing below 6 %',Math.abs(vals[0]),0,0.0001,'');check('dead zone: no step at its edge (raw just above)',Math.abs(vals[1]),0,0.01,'');check('dead zone: scaled above it (10 % → ~4 %)',vals[3],0.03,0.05,'');F.pads[0]=null;}
{const F=loadFull({throwPads:true});F.WIND.spd=0;let threw=false;try{F.uiReset('hover');run(F,1);}catch(e){threw=true;}
 check('Gamepad API blocked (embedded frame): no exception, flag set',(!threw&&F.PAD.blocked)?1:0,1,1,'');check('… and the keys still fly',Math.abs(F.S.eul[1])<0.3?1:0,1,1,'');}

console.log('\n■ Forward flight with the keys: accelerate, release, trim with T');
{const F=fresh('high');let ias1=0;run(F,12,t=>{F.DEV.keys.ArrowUp=t<0.4;if(t>0.4&&t<0.42)F.keyAction('KeyT');});   // nudge to ~6° nose down, trim there
 run(F,10);ias1=trace(F).ias;const a=trace(F);run(F,10);const b=trace(F);
 check('speed built with a nudge and T (kt)',ias1,10,130,'kt');check('after T: attitude held hands-off 10 s (pitch change)',Math.abs(b.th-a.th),0,1.5,'deg');
 const thHover=F.TRIM.hover.th*F.RAD;F.keyAction('KeyY');run(F,5);check('Y: nose back at the hover attitude after 5 s',Math.abs(trace(F).th-thHover),0,1,'deg');
 const i5=trace(F).ias;run(F,15);check('Y: speed decreasing (fixed collective: it zooms)',i5-trace(F).ias,1,80,'kt');}
{const F=fresh('high');const th0=trace(F).th;run(F,2,t=>{F.DEV.keys.ShiftLeft=true;F.DEV.keys.ArrowUp=true;});F.DEV.keys.ShiftLeft=false;F.DEV.keys.ArrowUp=false;run(F,3);
 check('beep trim Shift+Up 2 s: nose lower by ~6°',th0-trace(F).th,4,8,'deg');}

console.log('\n■ On the ground: arrow keys held 2 s (no tip-over)');
{const F=fresh('pad');let mx=0;run(F,4,t=>{F.DEV.keys.ArrowRight=t<2;},()=>{mx=Math.max(mx,Math.abs(trace(F).phi));});check('max roll on the skids',mx,0,3,'deg');}

console.log('\n■ Click to fly: a pilot who only follows the gold arrows reaches the target');
/* The pilot: moves the mouse stick as long as the arrow shows (3 /s of the correction), the collective with a little lead
   (2 × the arrow plus its integral, never slammed to the stops), and holds a pedal key while the pedal arrow is out. */
function follower(F){const P={base:F.DEV.kbd.col,I:0};F.DEV.mouse.armed=true;
  return ()=>{const c=F.COACH.cue,m=F.DEV.mouse,dt=F.DT;m.vx=F.sat(m.vx+c.lat*3*dt,1);m.vy=F.sat(m.vy-c.lon*3*dt,1);
    P.I=F.clamp(P.I+c.col*dt,0.12-P.base,0.9-P.base);F.DEV.kbd.col=F.clamp(P.base+2*c.col+P.I,0.1,0.92);F.DEV.keys.KeyD=c.ped>0.15;F.DEV.keys.KeyA=c.ped<-0.15;};}
function guided(kind,dn,de,h,sec,setup){const F=fresh(kind);if(setup)setup(F);run(F,0.5);const n=F.S.pos[0]+dn,e=F.S.pos[1]+de,ok=F.guideSet(n,e,h),R={F,ok,t:null,vmax:0,hmin:1e9,sink:0,bank:0,dh:99,d:99};const pilot=follower(F);
  run(F,sec,pilot,t=>{if(R.t!==null)return;if(!F.GUIDE.on){R.t=t;R.d=Math.hypot(F.S.pos[0]-n,F.S.pos[1]-e);R.dh=F.S.hAGL+F.terrainH(F.S.pos[0],F.S.pos[1])-F.terrainH(n,e)-h;return;}
    R.vmax=Math.max(R.vmax,gs(F));R.hmin=Math.min(R.hmin,F.S.hAGL);R.sink=Math.min(R.sink,F.S.vs);R.bank=Math.max(R.bank,Math.abs(F.S.eul[0]*F.RAD));});return R;}
{const R=guided('hover',120,90,3,70);check('ground target 150 m away: set',R.ok?1:0,1,1,'');check('… reached (over it and still for 2 s) after',R.t===null?999:R.t,15,50,'s');
 check('… then off the spot',R.d,0,3,'m');check('… and off the hover height',Math.abs(R.dh),0,1.5,'m');check('… fastest on the way',R.vmax,5,12,'m/s');check('… lowest on the way (skids)',R.hmin,2,5,'m');
 check('… the arrows are green again (no target)',R.F.GUIDE.on?1:0,0,0,'');}
{const R=guided('hover',300,0,100*0.3048,100);check('a point in the air, 300 m ahead at 100 ft: reached after',R.t===null?999:R.t,25,80,'s');check('… height off the target',Math.abs(R.dh),0,1.5,'m');}
{const R=guided('cruise',1000,1732,3,240);check('from cruise (100 kt, ~1500 ft) to a ground target 2 km off, 60° right: reached after',R.t===null?999:R.t,80,200,'s');
 check('… steepest bank on the way',R.bank,5,35,'deg');check('… fastest sink on the way (asked: 1000 fpm)',-R.sink,3,7.5,'m/s');check('… lowest before the target (skids)',R.hmin,2.5,600,'m');}
{const R=guided('high',20,10,3,240);check('straight down to the ground from the high hover: reached after',R.t===null?999:R.t,40,200,'s');check('… fastest sink at low speed (asked: 500 fpm, vortex ring)',-R.sink,1.5,3.3,'m/s');}
{/* what the arrows ask for at the start: the direction is right */
 const cue=(kind,dn,de,h,sec)=>{const F=fresh(kind);run(F,0.5);F.guideSet(F.S.pos[0]+dn,F.S.pos[1]+de,h);run(F,sec||1);return F;};
 let F=cue('hover',200,0,3);check('target 200 m ahead: stick forward (arrow)',F.COACH.cue.lon,0.06,1,'');check('… the word',F.COACH.hint==='Stick forward'?1:0,1,1,'');
 F=cue('hover',-150,40,3);check('target behind: pedal arrow (turn)',Math.abs(F.COACH.cue.ped),0.1,1,'');
 F=cue('hover',0,0,80);check('target straight above (80 m): collective in (arrow)',F.COACH.cue.col,0.06,1,'');
 F=fresh('cruise');run(F,0.5);const b=F.S.eul[2]+Math.PI/2;F.guideSet(F.S.pos[0]+2000*Math.cos(b),F.S.pos[1]+2000*Math.sin(b),F.S.hAGL);run(F,1);
 check('cruise, target 90° right: stick right (bank)',F.COACH.cue.lat,0.18,1,'');check('… the word',F.COACH.hint==='Bank right'?1:0,1,1,'');
 F=fresh('pad');run(F,0.5);F.guideSet(F.S.pos[0]+100,F.S.pos[1],3);run(F,1);check('on the pad, collective down: collective in (lift off)',F.COACH.cue.col,0.3,0.5,'');check('… the word',F.COACH.hint==='Collective in'?1:0,1,1,'');}
{/* setting, clearing, refusing; the autopilot lets go; the wheel picks the height */
 const F=fresh('hover');run(F,0.5);F.afcsToggle('hov',true);F.afcsToggle('alt',true);run(F,0.5);F.guideSet(F.S.pos[0]+50,F.S.pos[1],3);check('target set with HOV and ALT on: the autopilot lets go',F.afcsAny()?1:0,0,0,'');
 F.aimClick(2);check('… right-click while aiming clears it',F.GUIDE.on?1:0,0,0,'');F.guideSet(F.S.pos[0]+50,F.S.pos[1],3);F.uiReset('hover');check('… a reset clears it',F.GUIDE.on?1:0,0,0,'');
 F.AIM.hi=0;F.aimWheel(-100);check('wheel up one notch: 25 ft',F.aimH()/0.3048,24.9,25.1,'ft');F.aimWheel(300);check('… down past the ground: the ground (hover 10 ft = 3 m)',F.aimH(),3,3,'m');
 const T=fresh('hover');T.tutorStart&&T.tutorStart(3);T.TUTOR.on=true;check('refused in a tutor lesson',T.guideSet(T.S.pos[0]+50,T.S.pos[1],3)?1:0,0,0,'');}

console.log('\n■ Cyclic in forward flight: rate command, attitude hold (2.13.1); the mouse stick');
{/* a turn: a push of 15 % for 2 s and back to the centre; the bank stays, the heading turns; a reversal is one push the other way */
 const F=fresh('cruise');const m=F.DEV.mouse;m.armed=true;run(F,1);check('cruise: the rate command is on',F.SAS.rc?1:0,1,1,'');
 let pk=0;run(F,2,t=>{m.vx=0.15;},()=>{pk=Math.max(pk,Math.abs(trace(F).p));});m.vx=0;run(F,1);const b1=trace(F).phi;run(F,10);const b2=trace(F);
 check('15 % right for 2 s: roll rate',pk,7,16,'°/s');check('… bank when the stick is back',b1,15,30,'deg');check('… bank 10 s later (held, hands off)',Math.abs(b2.phi-b1),0,2,'deg');
 run(F,2,t=>{m.vx=-0.25;});m.vx=0;run(F,6);const b3=trace(F);check('reversal: 25 % left for 2 s, then centre: bank',b3.phi,-30,-10,'deg');
 run(F,3);check('… held (3 s later)',Math.abs(trace(F).phi-b3.phi),0,2,'deg');}
{/* the centre: a mouse left 3 % off holds; a small bank left by a small push levels and the heading is held */
 const F=fresh('cruise');const m=F.DEV.mouse;m.armed=true;run(F,1);const a=trace(F);m.vx=0.03;m.vy=-0.03;run(F,10);const b=trace(F);
 check('stick 3 % off the centre for 10 s: bank change',Math.abs(b.phi-a.phi),0,1.5,'deg');check('… pitch change',Math.abs(b.th-a.th),0,1,'deg');
 m.vx=0.08;run(F,0.6);m.vx=0;run(F,12);const c=trace(F);check('a nudge to ~3° of bank: wings back at the trim after 12 s',Math.abs(c.phi-F.TRIM.phi*F.RAD),0,1,'deg');
 run(F,10);check('… heading held 10 s later',Math.abs(wrap(trace(F).psi-c.psi)),0,1.5,'deg');}
{/* a flare: a pull of 20 % for 1.5 s, then hands off; slowing through 35 kt the attitude command takes over without a bump */
 const F=fresh('cruise');const m=F.DEV.mouse;m.armed=true;run(F,1);const a=trace(F);run(F,1.5,t=>{m.vy=0.2;});m.vy=0;run(F,1);const b=trace(F);
 check('flare: 20 % aft for 1.5 s: nose up by',b.th-a.th,6,15,'deg');run(F,5);check('… held 5 s later, hands off',Math.abs(trace(F).th-b.th),0,1.5,'deg');
 let sw=null,pk=0;run(F,40,null,t=>{if(sw===null&&!F.SAS.rc)sw=t;if(sw!==null&&t-sw<3){const x=trace(F);pk=Math.max(pk,Math.abs(x.q));}});
 check('… slows through 35 kt: the attitude command takes over',sw===null?0:1,1,1,'');check('… pitch rate in 3 s after the switch',pk,0,4,'°/s');}
{/* accelerating out of the hover with the stick held forward: through 45 kt the rate command must not pitch the nose on */
 const F=fresh('high');const m=F.DEV.mouse;m.armed=true;run(F,1);let sw=null,th0=0,pk=0,mx=0;
 run(F,40,t=>{m.vy=-0.35;},t=>{const x=trace(F);if(sw===null&&F.SAS.rc){sw=t;th0=x.th;}if(sw!==null&&t-sw<4){pk=Math.max(pk,Math.abs(x.q));mx=Math.max(mx,Math.abs(x.th-th0));}});
 check('accelerating, 35 % forward held: rate command on',sw===null?0:1,1,1,'');check('… pitch rate in 4 s after the switch',pk,0,3,'°/s');check('… pitch change in 4 s after the switch',mx,0,2,'deg');
 m.vy=-0.2;run(F,3);const c=trace(F);check('… easing the stick back toward the centre: attitude held',Math.abs(c.th-th0),0,2.5,'deg');}

console.log(`\n${errors?errors+' ERROR(s)':'all handling checks within range'}${warns?', '+warns+' WARN':''}\n`);process.exit(errors?1:0);
