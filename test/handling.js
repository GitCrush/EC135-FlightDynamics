/* Handling audit of the human control path: keys, mouse and gamepad go
   through the same input models, SAS and physics as in the browser. Looks
   for jumps, swing-back, overshoot, asymmetry, wind-up and bad hand-overs.
   Exit 1 on ERROR. */
const {loadFull}=require('./loadfull.js');
let errors=0,warns=0;
function check(name,val,lo,hi,unit='',warn=0){const ok=val>=lo&&val<=hi,w=!ok&&val>=lo-warn&&val<=hi+warn;if(!ok&&!w)errors++;if(w)warns++;
  console.log(`  ${ok?'OK   ':w?'WARN ':'ERROR'} ${name.padEnd(58)} ${(typeof val==='number'?val.toFixed(Math.abs(val)<10?2:0):val).toString().padStart(8)} ${unit.padEnd(5)} [${lo}..${hi}]`);}
function fresh(kind){const F=loadFull();F.WIND.spd=0;F.WIND.turb=0;F.cfg.mass=2500;F.cfg.lang='en';Object.assign(F.cfg,{sas:true,attHold:true,hdgHold:true,hoverAssist:false,kbdCol:'metered',kbdPed:'heading',pedRate:25,mouse:true,mouseTravel:1600});F.uiReset(kind||'hover');return F;}
function gs(F){const v=F.mrot(F.qmat(F.S.q),F.S.vb);return Math.hypot(v[0],v[1]);}
/* one browser frame at 360 Hz: devices → tutor → AP demo → coach → physics */
function run(F,sec,fn,rec){const n=Math.round(sec/F.DT);for(let i=0;i<n;i++){const t=i*F.DT;if(fn)fn(t);F.inputStep(F.DT);F.tutorStep(F.DT);F.apDemoStep(F.DT);F.coachStep(F.DT);const prev={lon:F.IN.lon,lat:F.IN.lat,ped:F.IN.ped,col:F.IN.col};F.step(F.DT);if(rec)rec(t,prev);}}
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
  const mix=9.3*Math.abs(F.IN.col-c0);   // the collective-roll mixing tilts the aircraft on purpose
  check(`${key}: heading excursion`,dpsi,0,5,'deg');check(`${key}: roll beyond what the mixing commands`,Math.max(0,dphi-mix),0,2,'deg');check(`${key}: ground speed after 6 s (what the mixing is for)`,gs(F),0,0.8,'m/s');}

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

console.log('\n■ Mouse stick moved while the tutor holds that axis, then the axis is handed over');
{const F=fresh('hover');F.DEV.mouse.armed=true;F.tutorStart(5);   // 'One axis: fore and aft' holds the lateral axis
 run(F,1);F.DEV.mouse.vx=0.4;run(F,1);const prev={...F.IN};F.tutorStart(7);let jump=null;run(F,0.5,null,()=>{if(jump===null)jump=Math.abs(F.IN.lat-prev.lat);});
 check('lateral axis handed over: stick jump',jump,0,0.12,'');F.tutorStop();}

console.log('\n■ Tutor lessons start calm: the autopilot takes the held axes without a bump');
for(const [li,name] of [[3,'calm hover'],[5,'one axis: fore and aft'],[6,'one axis: sideways']]){const F=fresh('hover');F.tutorStart(li);const a=trace(F);let pk=0;run(F,10,null,()=>{const x=trace(F);pk=Math.max(pk,Math.abs(x.p),Math.abs(x.q),Math.abs(x.r));});
 check(`lesson ${li+1} (${name}): ground speed after 10 s hands-off`,gs(F),0,0.8,'m/s');check(`lesson ${li+1} (${name}): peak rate`,pk,0,6,'°/s');F.tutorStop();}

console.log('\n■ Saturation: full forward key for 8 s, release (wind-up)');
{const F=fresh('high');const a=trace(F);const qs=[];run(F,16,t=>{F.DEV.keys.ArrowUp=t<8;},t=>{if(t>8)qs.push(trace(F).q);});const b=trace(F);
 check('after 8 s of full stick: pitch back near trim 8 s later',Math.abs(b.th-a.th),0,3,'deg',2);check('pitch-rate reversals after release',signChanges(qs,1.5),0,2,'');}

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
{const F=loadFull({throwPads:true});F.WIND.spd=0;F.cfg.lang='en';let threw=false;try{F.uiReset('hover');run(F,1);}catch(e){threw=true;}
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

console.log(`\n${errors?errors+' ERROR(s)':'all handling checks within range'}${warns?', '+warns+' WARN':''}\n`);process.exit(errors?1:0);
