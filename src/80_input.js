/* ═══════════════ INPUT DEVICES AND PILOT MODELS ═══════════════
   A key is on or off; a hand on the collective is not. Every device
   therefore gets its own model of what the pilot's limb does between
   the device and the control, and the models are switchable so that a
   pilot with a real collective lever gets the raw control.
     mouse     a click in the view captures the pointer (Pointer Lock);
               from then on the mouse is a virtual stick driven by its
               movement, starting at neutral, full deflection after
               cfg.mouseTravel pixels (expo 1.5). Esc releases it. Held C
               or the middle button steers the head instead of the stick.
     wheel     collective
     W/S       collective lever: 'metered' (power-aware rate: stops at the
               limit, slows against a drooping rotor) or 'rate'
     A/D       pedals: 'heading' (key = yaw rate demand, heading held when
               released) or 'rate' (pedal position moves while pressed)
     arrows    cyclic: 'attitude' (key = attitude demand, held when
               released) or 'rate'
     gamepad   any axis of any connected device per function (cyclic
               lateral / longitudinal, pedals, collective as rate or as
               position), learned in the setup or from a preset; scaled
               dead zone on sticks; triggers as collective up/down */
const DEV={keys:{},mouse:{x:0,y:0,on:false,down:false,armed:false,vx:0,vy:0},pad:null,padMap:'gamepad',lastPad:0,
           kbd:{col:0.45,ped:0,lon:0,lat:0,thRef:0,phiRef:0,psiRef:0},
           look:{on:false,yaw:0,pitch:0,yawT:0,pitchT:0,locked:false,ownLock:false,stage:null}};
/* Look around: hold C or the middle mouse button. While the stick has the
   pointer captured, the same movement steers the head and the stick is
   frozen; without a capture the look takes its own lock and releases it. */
function lookStart(){if(DEV.look.on)return;DEV.look.on=true;
  if(!DEV.mouse.armed){const st=DEV.look.stage;if(st&&st.requestPointerLock){try{const r=st.requestPointerLock();if(r&&r.catch)r.catch(()=>{});}catch(e){}}DEV.look.ownLock=true;}}
function lookStop(){if(!DEV.look.on)return;DEV.look.on=false;
  if(DEV.look.ownLock){DEV.look.ownLock=false;if(document.pointerLockElement&&document.exitPointerLock)document.exitPointerLock();}}
/* Gamepad mapping per function: device index d, axis a, inverted, and for
   the collective whether the axis is a spring stick (rate) or a slider /
   throttle (position). Positive means: stick right, stick forward, right
   pedal, collective up. */
const PAD_PRESETS={
  gamepad:{lat:{d:0,a:2,inv:false},lon:{d:0,a:3,inv:true},ped:{d:0,a:0,inv:false},col:{d:0,a:1,inv:true,mode:'rate'},trig:true},
  joystick:{lat:{d:0,a:0,inv:false},lon:{d:0,a:1,inv:true},ped:{d:0,a:2,inv:false},col:{d:0,a:3,inv:true,mode:'position'},trig:false},
};
const PAD={map:JSON.parse(JSON.stringify(PAD_PRESETS.gamepad)),learn:null,pads:[],blocked:false,colPosSeen:null};
function padPreset(name){if(!PAD_PRESETS[name])return;PAD.map=JSON.parse(JSON.stringify(PAD_PRESETS[name]));PAD.colPosSeen=null;padSave();}
function padSave(){try{localStorage.setItem('ec135fd.pad',JSON.stringify({map:PAD.map,dead:cfg.padDead,preset:DEV.padMap}));}catch(e){}}
function padLoad(){try{const j=JSON.parse(localStorage.getItem('ec135fd.pad')||'null');if(j&&j.map){PAD.map=j.map;if(j.dead!==undefined)cfg.padDead=j.dead;if(j.preset)DEV.padMap=j.preset;}}catch(e){}}
function padPoll(){
  if(PAD.blocked||typeof navigator==='undefined'||!navigator.getGamepads){PAD.pads=[];return PAD.pads;}
  try{PAD.pads=Array.from(navigator.getGamepads()||[]);}
  catch(e){PAD.blocked=true;PAD.pads=[];}   // embedded frames may forbid the Gamepad API: check once, then stay quiet
  return PAD.pads;
}
function padAxis(m,stick){
  if(!m)return null;const p=PAD.pads[m.d];if(!p||!p.connected)return null;let v=p.axes[m.a];if(v===undefined||v===null)return null;
  if(m.inv)v=-v;
  if(stick){const dz=cfg.padDead||0;const a=Math.abs(v);v=a<dz?0:Math.sign(v)*(a-dz)/(1-dz);}   // scaled dead zone: no step at its edge
  return clamp(v,-1,1);
}
/* Learning: remember every axis, wait for one to move by half its range in
   the direction the student was asked for, take it. A collective axis that
   rests far from centre is a slider or throttle: position mode. */
function padLearnStart(f){padPoll();PAD.learn={f,base:PAD.pads.map(p=>p&&p.connected?p.axes.slice():null),t:0};}
function padLearnStep(dt){
  const L=PAD.learn;if(!L)return;L.t+=dt;if(L.t>10){PAD.learn=null;return;}
  let best=null;PAD.pads.forEach((p,d)=>{if(!p||!p.connected||!L.base[d])return;p.axes.forEach((v,a)=>{const dv=v-(L.base[d][a]||0);if(!best||Math.abs(dv)>Math.abs(best.dv))best={d,a,dv,base:L.base[d][a]||0};});});
  if(best&&Math.abs(best.dv)>0.5){const m={d:best.d,a:best.a,inv:best.dv<0};if(L.f==='col')m.mode=Math.abs(best.base)>0.5?'position':'rate';
    PAD.map[L.f]=m;PAD.learn=null;DEV.padMap='custom';PAD.colPosSeen=null;padSave();}
}
function mouseArm(stage){if(DEV.mouse.armed)return;try{const r=stage.requestPointerLock&&stage.requestPointerLock();if(r&&r.catch)r.catch(()=>{});}catch(e){}}
function mouseDisarm(){DEV.mouse.armed=false;DEV.mouse.l=DEV.mouse.r=false;if(DEV.look.stage)DEV.look.stage.classList.remove('armed');}
function inputInit(stage){
  if(typeof window==='undefined')return;
  DEV.look.stage=stage;
  window.addEventListener('keydown',e=>{if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT')return;if(e.code==='KeyC'&&!e.repeat)lookStart();DEV.keys[e.code]=true;if(!e.repeat)keyAction(e.code);if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','F1','Slash'].includes(e.code))e.preventDefault();});
  window.addEventListener('keyup',e=>{DEV.keys[e.code]=false;if(e.code==='KeyC')lookStop();});
  stage.addEventListener('mousemove',e=>{
    const dx=e.movementX||0,dy=e.movementY||0;
    if(DEV.look.on){DEV.look.yawT=sat(DEV.look.yawT+dx*0.0022,2.6);DEV.look.pitchT=clamp(DEV.look.pitchT-dy*0.0022,-1.0,1.2);return;}   // stick frozen while looking; the camera follows smoothly
    if(DEV.mouse.armed){const t=Math.max(200,cfg.mouseTravel);DEV.mouse.vx=sat(DEV.mouse.vx+dx/t,1);DEV.mouse.vy=sat(DEV.mouse.vy+dy/t,1);}   // virtual stick, ±1 = full deflection
    const r=stage.getBoundingClientRect();DEV.mouse.x=(e.clientX-r.left)/r.width*2-1;DEV.mouse.y=(e.clientY-r.top)/r.height*2-1;});
  document.addEventListener('pointerlockchange',()=>{const locked=document.pointerLockElement===stage;DEV.look.locked=locked;
    if(locked&&!DEV.look.ownLock){DEV.mouse.armed=true;DEV.mouse.vx=0;DEV.mouse.vy=0;stage.classList.add('armed');}   // captured: the stick starts at neutral
    if(!locked){if(DEV.look.on)DEV.look.on=false;DEV.look.ownLock=false;mouseDisarm();}});
  stage.addEventListener('mouseenter',()=>{DEV.mouse.on=true;});
  stage.addEventListener('mouseleave',()=>{DEV.mouse.on=false;});
  stage.addEventListener('contextmenu',e=>e.preventDefault());
  stage.addEventListener('mousedown',e=>{
    if(!(e.target===stage||e.target.id==='ovl'||e.target.id==='world'))return;   // clicks on the welcome card or the setup panel are not the hand
    if(e.button===0&&!DEV.mouse.armed&&!DEV.look.on&&cfg.mouse){mouseArm(stage);return;}   // capture the pointer; the stick starts neutral
    if(!DEV.mouse.armed)return;
    if(e.button===0)DEV.mouse.l=true;if(e.button===2)DEV.mouse.r=true;if(e.button===1){e.preventDefault();lookStart();}});
  window.addEventListener('mouseup',e=>{if(e.button===0)DEV.mouse.l=false;if(e.button===2)DEV.mouse.r=false;if(e.button===1)lookStop();});
  stage.addEventListener('mousedown',e=>{DEV.mouse.down=true;soundStart&&soundStart();});
  window.addEventListener('mouseup',()=>{DEV.mouse.down=false;});
  stage.addEventListener('wheel',e=>{DEV.kbd.col=clamp(DEV.kbd.col-e.deltaY*0.0004,0,1);e.preventDefault();},{passive:false});
  window.addEventListener('gamepadconnected',e=>{DEV.pad=e.gamepad.index;PAD.connectedT=performance.now();});
  padLoad();
}
function keyAction(code){
  if(replayKey(code))return;
  const map={KeyL:()=>replayStart(),KeyV:()=>apDemoToggle(),KeyK:()=>coachCycle(),Slash:()=>{UI.showKeys=!UI.showKeys;},F1:()=>{UI.showKeys=!UI.showKeys;},KeyR:()=>uiReset(cfg.resetKind||'pad'),Digit1:()=>setView('cockpit'),Digit2:()=>setView('chase'),Digit3:()=>setView('tower'),
    KeyT:()=>trimSet(),
    KeyY:()=>trimClear(),
    KeyH:()=>{cfg.hoverAssist=!cfg.hoverAssist;uiSync();},
    KeyG:()=>{engineFailure('one');},
    KeyE:()=>{if(S.eng.mode==='off')engStart(S.eng);else engStop(S.eng);},
    KeyX:()=>{downloadCSV();},
    KeyP:()=>{UI.paused=!UI.paused;},
    Space:()=>{UI.paused=!UI.paused;},
    KeyF:()=>{cfg.fpm=!cfg.fpm;uiSync();},
    KeyN:()=>tutorNext(),Enter:()=>tutorNext(),KeyB:()=>tutorBack(),KeyQ:()=>tutorStop()};
  if(map[code])map[code]();
}
/* Reads all devices and fills IN.raw; the models turn keys into limbs. */
function inputStep(dt){
  if(REPLAY.on)return;
  const k=DEV.keys, raw=IN.raw;
  const [phi,th,psi]=S.eul;
  // ---- gamepad(s), through the learned or preset mapping
  padPoll();padLearnStep(dt);
  let gLon=0,gLat=0,gPed=0,gColRate=0,gColPos=null,padActive=false;
  if(PAD.pads.some(p=>p&&p.connected)&&!PAD.learn){
    const M=PAD.map;gLat=padAxis(M.lat,true)||0;gLon=padAxis(M.lon,true)||0;gPed=padAxis(M.ped,true)||0;
    const cv=padAxis(M.col,!M.col||M.col.mode!=='position');
    if(cv!==null){if(M.col&&M.col.mode==='position'){const pos=clamp((cv+1)/2,0,1);if(PAD.colPosSeen===null)PAD.colPosSeen=pos;if(Math.abs(pos-PAD.colPosSeen)>0.02)PAD.colPosSeen=-1;if(PAD.colPosSeen===-1)gColPos=pos;}   // a slider takes over once it has been moved
      else gColRate=cv;}
    if(M.trig){const p=PAD.pads[M.lat?M.lat.d:0];const bt=p&&p.buttons;if(bt){const up=bt[7]?bt[7].value:0,dn=bt[6]?bt[6].value:0;if(up>0.05)gColRate+=up;if(dn>0.05)gColRate-=dn;}}
    padActive=Math.abs(gLon)+Math.abs(gLat)+Math.abs(gPed)+Math.abs(gColRate)>0.02||gColPos!==null;
    if(padActive)DEV.lastPad=S.t;
  }
  // ---- collective
  let colKey=(k.KeyW?1:0)-(k.KeyS?1:0);
  if(Math.abs(gColRate)>0)colKey=gColRate;
  if(gColPos!==null&&padActive){DEV.kbd.col=gColPos;}
  else if(colKey!==0){
    /* raising: full lever in ~3.5 s. Lowering: finely metered in normal
       flight, but with the engines out or the rotor drooping the hand throws
       the lever down, as trained: that is the escape from every rotor emergency. */
    let rate=colKey<0?((cfg.kbdCol==='metered'&&(S.eng.mode==='off'||S.NR<96))?1.4:0.4):0.28;
    if(cfg.kbdCol==='metered'){
      /* The metered lever: the pilot watches the FLI and the rotor. Raising
         slows down near the limit and stops when the rotor droops; lowering
         is never metered (that is the escape from every rotor emergency). */
      if(colKey>0){
        const fli=S.eng.fli, lim=S.eng.mode==='oei'?10:11;
        rate*=clamp((lim+0.3-fli)/1.5,0,1);
        if(S.NR<H.nr.minPowerOn+0.5&&S.eng.mode!=='off')rate=0;
      }
    }
    DEV.kbd.col=clamp(DEV.kbd.col+colKey*rate*dt,0,1);
  }
  raw.col=DEV.kbd.col;
  // ---- pedals: an offset from the trim pedal; 'heading' = key is a yaw-rate demand, the SAS holds the heading when released
  const pedKey=(k.KeyD?1:0)-(k.KeyA?1:0)+(cfg.mouseButtons&&DEV.mouse.armed?((DEV.mouse.r?1:0)-(DEV.mouse.l?1:0)):0);
  raw.yawCmd=0;
  if(padActive&&Math.abs(gPed)>0){raw.ped=gPed;}
  else if(cfg.kbdPed==='heading'){raw.ped=0;raw.yawCmd=sat(pedKey,1)*(cfg.pedRate||25)*DEG;}   // key = yaw-rate demand; the SAS closes the loop
  else{if(pedKey!==0)DEV.kbd.ped=sat(DEV.kbd.ped+pedKey*1.2*dt,1);else DEV.kbd.ped=approach(DEV.kbd.ped,0,0.8*dt);raw.ped=DEV.kbd.ped;}
  // ---- cyclic: mouse (virtual stick), gamepad, or arrow keys (stick moves while pressed, centres when released)
  /* An axis the tutor or the autopilot demonstration holds is not in the
     student's hand: its stick stays centred, so handing it over is bumpless. */
  const held=UI.apDemo||false, lkLon=held||(TUTOR.on&&TUTOR.lockLon), lkLat=held||(TUTOR.on&&TUTOR.lockLat);
  if(lkLon){DEV.mouse.vy=0;DEV.kbd.lon=0;} if(lkLat){DEV.mouse.vx=0;DEV.kbd.lat=0;}
  const kx=(k.ArrowRight?1:0)-(k.ArrowLeft?1:0), ky=(k.ArrowUp?1:0)-(k.ArrowDown?1:0);
  let lon=0,lat=0,src='none';
  if(padActive&&(Math.abs(gLon)+Math.abs(gLat)>0)){lon=gLon;lat=gLat;src='pad';}
  else if(cfg.mouse&&DEV.mouse.armed){
    // virtual stick; expo 1.5: half the mouse travel is 35 % stick, the hover lives in the first few centimetres
    const ex=v=>Math.sign(v)*Math.pow(Math.min(Math.abs(v),1),1.5);
    lon=ex(-DEV.mouse.vy);lat=ex(DEV.mouse.vx);src='mouse';}
  const beep=k.ShiftLeft||k.ShiftRight;
  if(beep&&(kx||ky)){trimBeep([ky,kx],dt);DEV.kbd.lon=approach(DEV.kbd.lon,0,1.5*dt);DEV.kbd.lat=approach(DEV.kbd.lat,0,1.5*dt);}   // Shift + arrows: beep trim
  else{/* two-stage ramp per axis: quickly to 60 % (a tap stays fine), then slowly to the stop
          (full stick after about 2 s of holding); an axis without its key centres */
    const ramp=(v,d)=>{if(!d)return approach(v,0,1.5*dt);const out=v===0||Math.sign(d)===Math.sign(v);return sat(v+d*(out&&Math.abs(v)>=0.6?0.3:1.2)*dt,1);};
    DEV.kbd.lon=ramp(DEV.kbd.lon,ky);DEV.kbd.lat=ramp(DEV.kbd.lat,kx);}

  lon+=DEV.kbd.lon;lat+=DEV.kbd.lat;if(src==='none'&&(kx||ky))src='keys';
  raw.att=false;
  raw.lon=sat(lon,1);raw.lat=sat(lat,1);raw.ped=sat(raw.ped,1);   // the trim lives in TRIM (SAS), not as a stick offset
  raw.src=src;
  // ---- stability augmentation, then the controls the airframe sees
  const o=sasApply(dt,raw);
  IN.col=o.col;IN.lon=o.lon;IN.lat=o.lat;IN.ped=o.ped;
}
