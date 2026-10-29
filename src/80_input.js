/* ═══════════════ INPUT DEVICES AND PILOT MODELS ═══════════════
   A key is on or off; a hand on the collective is not. Every device
   therefore gets its own model of what the pilot's limb does between
   the device and the control, and the models are switchable so that a
   pilot with a real collective lever gets the raw control.
     mouse     a click in the view captures the pointer (Pointer Lock);
               from then on the mouse is a virtual stick driven by its
               movement, starting at neutral, full deflection after
               cfg.mouseTravel pixels, shaped by cfg.mouseCurve (linear by default,
               2.12.5; expo 1.5 until then). Esc releases it. Held C
               or the middle button steers the head instead of the stick.
     wheel     collective
     W/S       collective lever: 'metered' (power-aware rate: stops at the
               limit, slows against a drooping rotor) or 'rate'; a tap is fine
               (0.3 %), a hold is fast (2.12.7)
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
/* (2.13.3) The stick wants the mouse's own movement: with the system's pointer acceleration a quick move out and a
   slow one back do not meet, and the stick creeps. Chrome passes the raw movement where it can (unadjustedMovement:
   Windows, macOS, ChromeOS; web.dev "Disable mouse acceleration"); elsewhere, or if it refuses, the plain lock, and
   the hint on the first capture says where to switch the acceleration off. */
function mouseArm(stage){if(DEV.mouse.armed||!stage.requestPointerLock)return;
  const plain=()=>{try{const r=stage.requestPointerLock();if(r&&r.catch)r.catch(()=>{});}catch(e){}};
  const plat=(typeof navigator!=='undefined'&&navigator.userAgentData&&navigator.userAgentData.platform)||'';
  if(!/Windows|macOS|Chrome OS/.test(plat)){DEV.mouse.raw=false;plain();return;}
  try{const r=stage.requestPointerLock({unadjustedMovement:true});if(r&&r.then)r.then(()=>{DEV.mouse.raw=true;},()=>{DEV.mouse.raw=false;plain();});else DEV.mouse.raw=false;}catch(e){DEV.mouse.raw=false;plain();}}
/* (2.14) Fitting the stick to the mouse pad. On the first capture (and from the setup) the aircraft waits while
   the hand sweeps the mouse from the pad's left edge to its right edge at the pace it flies; full stick is then
   45 % of that width, so the stops lie just inside the pad's edges and the hand never has to lift the mouse.
   The fixed 1600 px were 2 cm of mouse at 2000 dpi and 5 cm at 800 dpi. A click takes it, Enter skips. */
const CAL={on:false,pending:false,x:0,min:0,max:0,ran:false};
function calStart(){CAL.on=true;CAL.pending=false;CAL.ran=true;CAL.x=CAL.min=CAL.max=0;DEV.mouse.vx=DEV.mouse.vy=0;if(!UI.paused){UI.paused=true;CAL.paused=true;}}
function calEnd(take){if(!CAL.on)return;CAL.on=false;const w=CAL.max-CAL.min;
  if(take&&w>=300){cfg.mouseTravel=clamp(Math.round(w*0.45/50)*50,300,2500);if(typeof dlNote==='function')dlNote(`Mouse: full stick ${cfg.mouseTravel} px (the pad: ${Math.round(w)} px)`);}
  cfg.mouseCal=true;DEV.mouse.vx=DEV.mouse.vy=0;if(CAL.paused){UI.paused=false;CAL.paused=false;}if(typeof uiSync==='function')uiSync();}
function mouseDisarm(){DEV.mouse.armed=false;DEV.mouse.l=DEV.mouse.r=false;if(DEV.look.stage)DEV.look.stage.classList.remove('armed');}
function inputInit(stage){
  if(typeof window==='undefined')return;
  DEV.look.stage=stage;
  window.addEventListener('keydown',e=>{if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT')return;if(e.code==='KeyC'&&!e.repeat)lookStart();if(e.code==='KeyM'&&!e.repeat)aimStart();if(CAL.on&&(e.code==='Enter'||e.code==='NumpadEnter')){calEnd(false);e.preventDefault();return;}DEV.keys[e.code]=true;if(!e.repeat)keyAction(e.code);if(e.key==='?'&&e.code!=='Slash'&&!e.repeat)UI.showKeys=!UI.showKeys;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','F1','Slash'].includes(e.code))e.preventDefault();});
  window.addEventListener('keyup',e=>{DEV.keys[e.code]=false;if(e.code==='KeyC')lookStop();if(e.code==='KeyM')aimStop();});
  stage.addEventListener('mousemove',e=>{
    const dx=e.movementX||0,dy=e.movementY||0;
    if(AIM.on){const r=(R3.canvas||stage).getBoundingClientRect();aimMove(dx,dy,e.clientX-r.left,e.clientY-r.top);return;}   // click to fly: the cursor moves, the stick stays
    if(CAL.on){CAL.x+=dx;CAL.min=Math.min(CAL.min,CAL.x);CAL.max=Math.max(CAL.max,CAL.x);return;}   // (2.14) fitting the stick: the sweep, the stick stays
    if(DEV.look.on){DEV.look.yawT=sat(DEV.look.yawT+dx*0.0022,2.6);DEV.look.pitchT=clamp(DEV.look.pitchT-dy*0.0022,-1.0,1.2);return;}   // stick frozen while looking; the camera follows smoothly
    if(DEV.mouse.armed){const t=Math.max(200,cfg.mouseTravel);DEV.mouse.vx=sat(DEV.mouse.vx+dx/t,1);DEV.mouse.vy=sat(DEV.mouse.vy+dy/t,1);}   // virtual stick, ±1 = full deflection
    const r=stage.getBoundingClientRect();DEV.mouse.x=(e.clientX-r.left)/r.width*2-1;DEV.mouse.y=(e.clientY-r.top)/r.height*2-1;});
  document.addEventListener('pointerlockchange',()=>{const locked=document.pointerLockElement===stage;DEV.look.locked=locked;
    if(locked&&!DEV.look.ownLock){DEV.mouse.armed=true;DEV.mouse.vx=0;DEV.mouse.vy=0;stage.classList.add('armed');if(CAL.pending||(!cfg.mouseCal&&!CAL.ran))calStart();else if(DEV.mouse.firstArm===undefined&&!CAL.ran)DEV.mouse.firstArm=performance.now()/1000;}   // captured: the stick starts at neutral; (2.14) the first time, fit it to the pad (the card names the acceleration switch too)
    if(!locked){if(DEV.look.on)DEV.look.on=false;DEV.look.ownLock=false;mouseDisarm();calEnd(false);}});
  stage.addEventListener('mouseenter',()=>{DEV.mouse.on=true;});
  stage.addEventListener('mouseleave',()=>{DEV.mouse.on=false;});
  stage.addEventListener('contextmenu',e=>e.preventDefault());
  stage.addEventListener('mousedown',e=>{
    if(!(e.target===stage||e.target.id==='ovl'||e.target.id==='world'))return;   // clicks on the welcome card or the setup panel are not the hand
    if(AIM.on){aimClick(e.button);e.preventDefault();return;}   // click to fly: left sets the target, right clears it (not a pedal, not a capture)
    if(e.button===0&&!DEV.mouse.armed&&!DEV.look.on&&cfg.mouse){mouseArm(stage);return;}   // capture the pointer; the stick starts neutral
    if(!DEV.mouse.armed)return;
    if(CAL.on){if(e.button===0)calEnd(true);return;}   // (2.14) the click takes the sweep, it is not a pedal
    if(e.button===0)DEV.mouse.l=true;if(e.button===2)DEV.mouse.r=true;if(e.button===1){e.preventDefault();lookStart();}});
  window.addEventListener('mouseup',e=>{if(e.button===0)DEV.mouse.l=false;if(e.button===2)DEV.mouse.r=false;if(e.button===1)lookStop();});
  stage.addEventListener('mousedown',e=>{DEV.mouse.down=true;soundStart&&soundStart();});
  window.addEventListener('mouseup',()=>{DEV.mouse.down=false;});
  stage.addEventListener('wheel',e=>{if(e.target&&e.target.closest&&e.target.closest('#apMenu,#setup'))return;   // a panel scrolls, the lever stays
    if(AIM.on){aimWheel(e.deltaY*(e.deltaMode===1?33:e.deltaMode===2?400:1));e.preventDefault();return;}   // click to fly: the wheel sets the target's height
    /* (2.12.7) The wheel as the collective: one notch 0.4 % of the lever (0.06° of blade pitch, ~55 fpm of steady
       climb in the hover), the same in every browser (the delta comes in pixels, lines or pages: normalised to
       notches of 100 px). Until 2.12.6 a notch was 4 % in Chrome on Windows (~500 fpm, a 0.1 g jolt), 2 % in
       Chrome on Linux and 0.1 % in Firefox. Spun fast the steps grow, up to four-fold (more than about two
       notches within a quarter second), so a large lever movement does not take fifty notches. */
    const px=e.deltaY*(e.deltaMode===1?33:e.deltaMode===2?400:1),n=clamp(px/100,-3,3),now=performance.now(),W=DEV.wh||(DEV.wh={t:now,r:0});
    W.r=W.r*Math.exp(-Math.max(0,now-W.t)/250)+Math.abs(n);W.t=now;
    DEV.kbd.col=clamp(DEV.kbd.col-n*0.004*clamp(1+(W.r-2)/2,1,4),0,1);DEV.wheel=true;e.preventDefault();},{passive:false});
  window.addEventListener('gamepadconnected',e=>{DEV.pad=e.gamepad.index;PAD.connectedT=performance.now();});
  padLoad();
}
/* (2.16) The engines by hand: Shift+1 and Shift+2 move an engine's main switch one step (OFF - IDLE - FLIGHT,
   then back down), Shift+B the rotor brake, Shift+E the whole sequence (brake off, engine 1 to IDLE, engine 2
   once the first is at idle, both to FLIGHT; running: both to IDLE, again: OFF). */
const ENG_SEQ={on:false};
function engNote(t,col){if(typeof afcsNote==='function')afcsNote(t,col||'#6fd3e0');}
const ENG_WHY={brake:'rotor brake on: Shift+B releases it',failed:'the engine has failed',off:'start it first: IDLE',engines:'engines off first',nr:'only below 50 % NR'};
function engKey(i){const en=S.eng.e[i];if(!en)return;ENG_SEQ.on=false;const sw=en.on?(en.sw==='idle'?'idle':'flight'):'off';
  const to=sw==='off'?'idle':sw==='flight'?'idle':en.dir<0?'off':'flight';const why=engSwitch(S.eng,i,to);
  if(why){engNote(`ENG ${i+1}: ${ENG_WHY[why]||why}`,'#ffb300');return;}en.dir=to==='flight'?-1:to==='off'?1:en.dir;engNote(`ENG ${i+1} ${to.toUpperCase()}`+(sw==='off'?' – starting':''));}
function engAuto(){const E=S.eng.e,run=E.some(x=>x.on&&!x.fail);
  if(!run){ENG_SEQ.on=true;ENG_SEQ.stage=0;if(S.eng.brake){engBrake(S.eng,false);engNote('Rotor brake off');}return;}
  ENG_SEQ.on=false;const fl=E.some(x=>x.on&&x.sw!=='idle');E.forEach((x,i)=>{engSwitch(S.eng,i,fl?'idle':'off');x.dir=fl?x.dir:1;});engNote(fl?'Both engines IDLE':'Both engines OFF');}
function engSeqStep(){if(!ENG_SEQ.on||!S)return;const E=S.eng.e,ready=x=>x.on&&x.startT<=0;
  if(ENG_SEQ.stage===0){if(engSwitch(S.eng,0,'idle')===''){engNote('ENG 1 IDLE – starting');ENG_SEQ.stage=1;}else ENG_SEQ.on=false;}
  else if(ENG_SEQ.stage===1&&ready(E[0])){engSwitch(S.eng,1,'idle');engNote('ENG 2 IDLE – starting');ENG_SEQ.stage=2;}
  else if(ENG_SEQ.stage===2&&ready(E[1])){E.forEach((x,i)=>{engSwitch(S.eng,i,'flight');x.dir=-1;});engNote('Both engines FLIGHT – rotor running up');ENG_SEQ.on=false;}}
function keyAction(code){
  if(replayKey(code))return;
  const shift=DEV.keys.ShiftLeft||DEV.keys.ShiftRight;
  if(shift&&(code==='Digit1'||code==='Digit2')){engKey(code==='Digit1'?0:1);return;}
  if(shift&&code==='KeyB'){const on=!S.eng.brake,why=engBrake(S.eng,on,S.NR);engNote(why?`Rotor brake: ${ENG_WHY[why]}`:on?'Rotor brake ON':'Rotor brake off',why?'#ffb300':undefined);return;}
  const map={KeyL:()=>replayStart(),KeyV:()=>apDemoToggle(),KeyU:()=>afcsToggle('alt'),KeyI:()=>afcsToggle(S.ias>40*KT?'ias':'hov'),KeyO:()=>afcsToggle('hdg'),KeyJ:()=>apMenuToggle(),Escape:()=>apMenuShow(false),KeyK:()=>coachCycle(),Slash:()=>{UI.showKeys=!UI.showKeys;},F1:()=>{UI.showKeys=!UI.showKeys;},KeyR:()=>{const k=cfg.resetKind||'pad';if(k.startsWith('ex:'))startExercise(k.slice(3));else uiReset(k);},Digit1:()=>setView('cockpit'),Digit2:()=>setView('chase'),Digit3:()=>setView('tower'),Digit4:()=>{cfg.apr=cfg.apr==='on'?'off':'on';APR.ack=true;APR.fpsCmp={t:performance.now(),f0:UI.fps||0,on:cfg.apr==='on'};uiSync();dlNote('Approach view '+(cfg.apr==='on'?(cfg.aprChin?'on: the gaze lowers, the chin windows come into view (4: back)':'on: the gaze lowers 15° (4: back)'):'off'));},
    KeyZ:()=>{if(DEV.keys.ShiftLeft||DEV.keys.ShiftRight){if(HT.on)htStop();else htStart();dlNote(HT.on?'Head tracking off':'Head tracking: starting the webcam…');}else if(HT.on){htCentre();dlNote('Head tracking: centred');}},   // (2.13) Shift+Z head tracking on/off, Z centres it
    KeyT:()=>trimSet(),
    KeyY:()=>trimClear(),
    KeyH:()=>{cfg.hoverAssist=!cfg.hoverAssist;uiSync();},
    KeyG:()=>{engineFailure('one');},
    KeyE:()=>{if(!(DEV.keys.ShiftLeft||DEV.keys.ShiftRight))return;engAuto();},   // (2.13) Shift+E: E alone is the glance right; (2.16) the whole sequence
    KeyX:()=>{downloadCSV();},
    KeyP:()=>{cfg.predict=!cfg.predict;uiSync();},
    Space:()=>{if(!CAL.on)UI.paused=!UI.paused;},
    KeyF:()=>{cfg.fpm=!cfg.fpm;uiSync();},
    KeyN:()=>tutorNext(),Enter:()=>tutorNext(),KeyB:()=>tutorBack(),KeyQ:()=>{if(DEV.keys.ShiftLeft||DEV.keys.ShiftRight)tutorStop();}};   // (2.13) Shift+Q: Q alone is the glance left
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
  /* The pilot takes a control the autopilot's modes drive (70_pilot.js AFCS): a key, the wheel, the
     gamepad, or the mouse stick moved (more than ~25 px within a moment) releases the modes on it,
     bumplessly, before the stability augmentation reads the devices below. */
  if(afcsAny()&&!UI.apDemo&&!TUTOR.on){const H_=AFCS.held,ov=AFCS_UI.ovAcc;
    ov.lon=Math.max(0,ov.lon-dt*0.08)+(H_.lon?Math.abs(DEV.mouse.vy):0);ov.lat=Math.max(0,ov.lat-dt*0.08)+(H_.lat?Math.abs(DEV.mouse.vx):0);
    if(H_.col&&((k.KeyW||k.KeyS)||DEV.wheel||Math.abs(gColRate)>0.15||(gColPos!==null&&padActive)))afcsPilotTakes('col');
    if(H_.ped&&((k.KeyA||k.KeyD)||(cfg.mouseButtons&&DEV.mouse.armed&&(DEV.mouse.l||DEV.mouse.r))||Math.abs(gPed)>0.15))afcsPilotTakes('ped');
    if(H_.lon&&(k.ArrowUp||k.ArrowDown||Math.abs(gLon)>0.15||ov.lon>0.016))afcsPilotTakes('lon');
    if(H_.lat&&(k.ArrowLeft||k.ArrowRight||Math.abs(gLat)>0.15||ov.lat>0.016))afcsPilotTakes('lat');}
  DEV.wheel=false;
  // ---- collective
  let colKey=(k.KeyW?1:0)-(k.KeyS?1:0);const keyed=colKey!==0&&!(Math.abs(gColRate)>0);
  if(Math.abs(gColRate)>0)colKey=gColRate;
  DEV.colHold=keyed&&Math.sign(colKey)===DEV.colSign?(DEV.colHold||0)+dt:0;DEV.colSign=keyed?Math.sign(colKey):0;   // (2.12.7) how long W or S has been held
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
        const fli=Math.max(S.eng.fli,S.eng.fliDem||0), lim=S.eng.mode==='oei'?12:11;   // the demand leads the gauge: metering on the gauge alone overshot into the limit and drooped NR to 96 %   // the top of the scale: take-off, or the OEI 30-s rating
        rate*=clamp((lim-0.15-fli)/1.5,0,1);   // stops just short of the limit: the governor needs some margin to hold NR
        if(S.NR<H.nr.minPowerOn+0.5&&S.eng.mode!=='off')rate=0;
      }
    }
    /* (2.12.7) A tap is fine, a hold is fast. Until 2.12.6 a tap moved the lever 3-4 % (~400-500 fpm).
       (2.13.2) The fine part is longer and even: for 0.6 s the lever moves at 9 % of the rate, 2.5 %/s up
       (about 320 fpm a second of holding in the hover, a 0.1 s tap 0.25 %, ~30 fpm), then the rate rises to
       the full one by 2 s. 2.12.7 rose from 0.25 s to 1 s: 0.5 s of W gave 2 %, 0.75 s 6 %, 1 s 12 %
       (270, 730, 1400 fpm), too steep to meter a height correction by the length of a press. Now 0.5 s 1.3 %,
       1 s 3.2 %, 1.5 s 10 % (160, 400, 1200 fpm); the full lever takes about 5 s (4 before). The emergency throw
       (engines out, rotor drooping) is not slowed. */
    const throwDown=colKey<0&&cfg.kbdCol==='metered'&&(S.eng.mode==='off'||S.NR<96);
    if(keyed&&!throwDown)rate*=0.09+0.91*sm(0.6,2.0,DEV.colHold);
    DEV.kbd.col=clamp(DEV.kbd.col+colKey*rate*dt,0,1);
  }
  raw.col=DEV.kbd.col;
  engSeqStep();   // (2.16) Shift+E's sequence, one step when the engines are ready
  // ---- pedals: an offset from the trim pedal; 'heading' = key is a yaw-rate demand, the SAS holds the heading when released
  const pedKey=(k.KeyD?1:0)-(k.KeyA?1:0)+(cfg.mouseButtons&&DEV.mouse.armed?((DEV.mouse.r?1:0)-(DEV.mouse.l?1:0)):0);
  raw.yawCmd=0;
  if(padActive&&Math.abs(gPed)>0){raw.ped=gPed;}
  else if(cfg.kbdPed==='heading'){raw.ped=0;raw.yawCmd=sat(pedKey,1)*(cfg.pedRate||25)*DEG;}   // key = yaw-rate demand; the SAS closes the loop
  else{if(pedKey!==0)DEV.kbd.ped=sat(DEV.kbd.ped+pedKey*1.2*dt,1);else DEV.kbd.ped=approach(DEV.kbd.ped,0,0.8*dt);raw.ped=DEV.kbd.ped;}
  // ---- cyclic: mouse (virtual stick), gamepad, or arrow keys (stick moves while pressed, centres when released)
  /* An axis the tutor, the autopilot demonstration or an autopilot mode drives is not in the
     student's hand: its stick stays centred, so handing it over is bumpless. */
  const held=UI.apDemo||false, lkLon=held||(TUTOR.on?TUTOR.lockLon:AFCS.held.lon), lkLat=held||(TUTOR.on?TUTOR.lockLat:AFCS.held.lat);
  if(lkLon){DEV.mouse.vy=0;DEV.kbd.lon=0;} if(lkLat){DEV.mouse.vx=0;DEV.kbd.lat=0;}
  const kx=(k.ArrowRight?1:0)-(k.ArrowLeft?1:0), ky=(k.ArrowUp?1:0)-(k.ArrowDown?1:0);
  let lon=0,lat=0,src='none';
  if(padActive&&(Math.abs(gLon)+Math.abs(gLat)>0)){lon=gLon;lat=gLat;src='pad';}
  else if(cfg.mouse&&DEV.mouse.armed){
    /* virtual stick, then the curve (2.12.5: cfg.mouseCurve). Until 2.12.4 always expo 1.5 (half the travel 35 %
       stick); on top of the attitude command's own shaping (70_pilot.js: 20° + 20° x stick³ of bank) the response
       per pixel grew 35-fold from the centre to the stop: nearly nothing around the centre, then suddenly a lot,
       and long ways for a reversal. 'linear' (the default) leaves the shaping to the attitude command alone (4-fold
       from centre to stop), 'mild' is expo 1.25, 'strong' the old 1.5. */
    const xp=cfg.mouseCurve==='strong'?1.5:cfg.mouseCurve==='mild'?1.25:1,ex=v=>Math.sign(v)*Math.pow(Math.min(Math.abs(v),1),xp);
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
