/* ═══════════════ COACH ═══════════════
   An instructor in the left seat. A shadow copy of the autopilot flies
   along every frame with the goal "keep this hover / this speed and
   height" (or the tutor's target), and the difference between its stick
   and yours is the correction you owe: shown as an arrow from your stick
   to where it should be, a ghost marker in the controls box, arrows on
   the collective and the pedals, and one short word. Rotor limits come
   first, then sink rate, then drift, then heading. Hysteresis keeps it
   from nagging. K toggles it. With a click-to-fly target (below) the goal
   is the way to the target instead, and the arrows turn gold. */
const COACH={on:true,voice:false,ap:null,cue:{lon:0,lat:0,ped:0,col:0},hint:'',long:'',hintLevel:0,hintT:0,alive:false,hdgRef:0,altRef:0,tick:0,spokenT:-10,spoken:'',legendT:0,yawFree:false};
/* Spoken instruction (Web Speech API). Level-2 hints interrupt, level-1
   hints wait 3 s after the last utterance; the same sentence is not
   repeated within 8 s. */
function coachSay(text,lvl){
  if(!COACH.voice||typeof speechSynthesis==='undefined'||!text)return;
  const now=performance.now()/1000;
  if(lvl<2&&now-COACH.spokenT<3)return;
  if(text===COACH.spoken&&now-COACH.spokenT<8)return;
  try{if(lvl>=2)speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='en-US';u.rate=1.05;u.pitch=1;speechSynthesis.speak(u);COACH.spokenT=now;COACH.spoken=text;}catch(e){}
}
function coachSet(mode){ // 'off' | 'cues' | 'voice'
  COACH.on=mode!=='off';COACH.voice=mode==='voice';COACH.legendT=S?S.t:0;if(!COACH.on){COACH.hint='';COACH.long='';if(typeof speechSynthesis!=='undefined')speechSynthesis.cancel();}
  if(typeof uiSync==='function')uiSync();if(typeof coachButtons==='function')coachButtons();
}
function coachCycle(){coachSet(!COACH.on?'cues':COACH.voice?'off':'voice');}
/* the heading to hold in the hover: a commanded turn is not an error; while the student turns, or the
   heading hold is still braking, the heading is free */
function coachHoverHdg(){
  const turning=(IN.raw.yawCmd||0)!==0||Math.abs(IN.raw.ped||0)>=0.04||Math.abs(SAS.rCmd||0)>2*DEG;
  if(cfg.hdgHold)COACH.hdgRef=SAS.hold?SAS.psiRef:S.eul[2];
  else if(turning||Math.abs(S.om[2])<6*DEG)COACH.hdgRef=S.eul[2];
  COACH.yawFree=turning||(cfg.hdgHold&&!SAS.hold);return COACH.hdgRef;}
/* the word on the screen, with hysteresis: a level-1 hint stays 1.5 s, level 2 replaces anything at once */
function coachHint(hint,long,lvl){
  if(hint&&(lvl>=2||!COACH.hint||S.t-COACH.hintT>1.5||lvl>COACH.hintLevel)){if(hint!==COACH.hint){COACH.hintT=S.t;COACH.flash=S.t;coachSay(long,lvl);}COACH.hint=hint;COACH.long=long;COACH.hintLevel=lvl;}
  else if(!hint&&S.t-COACH.hintT>1.5){COACH.hint='';COACH.long='';COACH.hintLevel=0;}}
function coachStep(dt){
  if(GUIDE.on&&(TUTOR.on||REPLAY.on||UI.apDemo))guideClear();   // a lesson has its own column; the replay and the demonstration fly themselves
  if((!COACH.on&&!GUIDE.on)||REPLAY.on||UI.apDemo||!S){COACH.alive=false;return;}
  if(!COACH.ap){COACH.ap=apClone();COACH.ap.pOnly=true;}
  const A=COACH.ap,hover=S.ias<30*KT,onGround=S.onGround,c=COACH.cue;
  if(GUIDE.on)guideUpdate(dt);   // where the target is; over it and still, it is reached: the arrows are green again
  if(!COACH.on&&!GUIDE.on){COACH.alive=false;return;}
  if(onGround&&(GUIDE.on||S.ctl.col<0.25)){
    if(!GUIDE.on){COACH.alive=false;COACH.hint='';return;}   // nothing to coach with the rotor unloaded on the ground
    for(const k in c)c[k]+=((k==='col'?0.5:0)-c[k])*Math.min(1,dt*6);COACH.alive=true;   // a target: lift off first
    coachHint('Collective in','Lift off toward the target: collective in, smoothly, until the skids come free.',1);return;}
  // goals: the way to the click-to-fly target, the tutor's target, or else stop the drift and hold what you have
  A.auto=false;COACH.yawFree=false;
  if(GUIDE.on)guideGoals(A,hover);
  else if(TUTOR.on&&TUTOR.target){A.mode='hover';A.posN=TUTOR.target[0];A.posE=TUTOR.target[1];A.alt=terrainH(TUTOR.target[0],TUTOR.target[1])+3+1.3;A.hdg=0;}
  else if(hover){A.mode='hover';A.posN=null;A.posE=null;A.vN=0;A.vE=0;A.hdg=coachHoverHdg();
    if(Math.abs(S.vs)<0.8)COACH.altRef=S.alt;A.alt=onGround?null:COACH.altRef;A.vs=0;}
  else{A.mode='cruise';A.hdg=S.eul[2];if(Math.abs(S.nz-1)<0.15)A.ias=S.ias/KT;A.alt=null;if(Math.abs(S.vs)<1.0)A.vs=0;else A.vs=A.vs||0;}
  /* Trim attitude: the coach compares against the attitude the aircraft
     settles at, not against level. Learned as a slow average, seeded with
     the hover trim of this type (nose 3° up, left skid 3.5° low: the
     Fenestron pushes right against the counterclockwise rotor's torque). */
  if(COACH.trimTh===undefined){COACH.trimTh=TRIM.th;COACH.trimPhi=TRIM.phi;}   // (2.16.8) the trim the reset handed over (until now the hover's 3° nose up, also in cruise: 6° off there)
  /* on the way to a target only while the speed is steady: a flare held for half a minute is not the trim
     (learned, it would ask for ever more nose-up) */
  const vH=mrot(qmat(S.q),S.vb),acc=COACH.vPrev&&dt>0?Math.hypot(vH[0]-COACH.vPrev[0],vH[1]-COACH.vPrev[1])/dt:0;COACH.vPrev=[vH[0],vH[1]];COACH.acc=(COACH.acc||0)+(acc-(COACH.acc||0))*Math.min(1,dt/0.5);
  const quiet=Math.hypot(S.om[0],S.om[1])<8*DEG&&(!GUIDE.on||COACH.acc<0.3);
  if(quiet){COACH.trimTh+=(S.eul[1]-COACH.trimTh)*Math.min(1,dt/6);COACH.trimPhi+=(S.eul[0]-COACH.trimPhi)*Math.min(1,dt/6);}
  A.thTrim=COACH.trimTh;A.phTrim=COACH.trimPhi;
  /* Proportional only: the shadow autopilot returns the correction it would
     add now (attitude error, rate, velocity error), not a full stick
     position, so it does not need the trim and cannot wind up. */
  A.pOnly=true;const o=apStep(dt,A);
  const lk={lon:axisHeld('lon'),lat:axisHeld('lat'),ped:axisHeld('ped'),col:axisHeld('col')};
  const raw={lon:sat(o.lon,1),lat:sat(o.lat,1),ped:COACH.yawFree?0:sat(o.ped,1),col:sat(o.col-0.50,0.5)};
  /* (2.13.1) Under the rate command (forward flight) the stick that brings the attitude is a deflection that
     dies away as it arrives, not a held offset: where the stick should be is the correction scaled to a
     rate (about 1 s to close an attitude error), and the cue is the way from the stick to there. */
  if(SAS.mode==='att'&&SAS.rc){raw.lon=sat(0.65*o.lon,1)-(IN.raw.lon-(SAS.rcL||0));raw.lat=sat(0.27*o.lat,1)-(IN.raw.lat-(SAS.rcR||0));}
  /* (2.16.7) Under the attitude command (the hover) likewise: the stick position that commands the attitude the
     shadow autopilot wants (the inverse of the command shaping in sasApply: 15°·x + 13°·x³ of pitch, 20°·x +
     20°·x³ of bank), and the cue is the way from the stick to there. Until now it was the autopilot's correction
     against the attitude the aircraft has, which lags the stick by a few tenths of a second: the arrow still said
     "more" when the stick was already right, and a student who followed it briskly (the stick moving at 1.5 to
     3 times the arrow per second, 0.35 to 0.6 s to react) overshot and rocked the hover up to 4-6 m/s with the
     stick at the stops. Now the drift dies away for any pace of the hand (test/handling.js). */
  let tgt=null;   // the hover's stick target, smoothed alone: the arrow follows the hand at once
  if(!(SAS.mode==='att'&&SAS.rc)&&SAS.mode==='att'&&A.att){const inv=(a,b,y)=>{let x=clamp(y/(a+b),-1,1);for(let i=0;i<6;i++)x-=(a*x+b*x*x*x-y)/(a+3*b*x*x);return clamp(x,-1,1);};
    const tL=inv(15,13,(SAS.refTh-A.att.th)/DEG),tR=inv(20,20,(A.att.ph-SAS.refPhi-(SAS.phMix||0))/DEG),T=COACH.tgt||(COACH.tgt={lon:IN.raw.lon,lat:IN.raw.lat}),k=Math.min(1,dt*6);
    T.lon+=(tL-T.lon)*k;T.lat+=(tR-T.lat)*k;tgt=T;}else COACH.tgt=null;
  /* (2.16.2) The collective against where the vertical speed is going, not where it is. The lever sets a vertical
     speed that arrives over 3 to 4 s; a cue on the present one kept asking for more lever while the aircraft was
     already about to stop sinking, and turned round with every swing. With the predictor's 6-s vertical speed
     (PRED.vsTr) it asks only for what the lever still lacks. */
  if(PRED.vsTr!=null&&!onGround){const vsC=A.alt!==null&&A.alt!==undefined?clamp((A.alt-S.alt)*0.25,-5,5):(A.vs||0);raw.col=sat(0.03*(vsC-PRED.vsTr),0.5);}
  for(const k in raw){const v=lk[k]?0:raw[k];c[k]+=(v-c[k])*Math.min(1,dt*6);}   // smoothed: an instructor does not twitch
  if(tgt){c.lon=lk.lon?0:sat(tgt.lon-IN.raw.lon,1);c.lat=lk.lat?0:sat(tgt.lat-IN.raw.lat,1);}
  coachColDir();
  COACH.alive=true;
  /* hint, by priority, with hold time: a short word for the screen, a sentence for the voice */
  let hint='',long='',lvl=0;
  const power=S.eng.mode!=='off';
  const dir=(k,v)=>{const m={lon:v>0?'Stick forward':'Stick back',lat:v>0?'Stick right':'Stick left',ped:v>0?'Right pedal':'Left pedal'}[k];return m;};
  if(power&&S.NR<H.nr.minPowerOn-1.5){hint='NR dropping';long='Rotor speed is dropping. Lower the collective, now.';lvl=2;}
  else if(!power&&S.NR<H.nr.minAuto+3){hint='NR low';long='Rotor speed too low in autorotation. Collective down, aft stick.';lvl=2;}
  else if(S.eng.fli>(S.eng.mode==='oei'?12.2:11.2)){hint='Overtorque';long='Above the power limit. Ease the collective.';lvl=2;}
  else if(S.eng.mode==='oei'&&S.eng.tAbove30>20&&S.eng.limit==='OEI 30s'){hint='OEI 30 s';long='The 30-second rating is running out. Reduce power below FLI 11.';lvl=2;}
  else if(S.rot.vrs>0.35){hint='Vortex ring';long='Vortex ring state. Stick forward firmly to fly out of your own downwash; collective up as power allows.';lvl=2;}
  else if(hover&&!onGround&&S.vs<-2.5&&S.hAGL<40){hint='Sink rate';long='You are sinking fast near the ground. Collective in.';lvl=2;}
  else if(S.fen.stall>0.6){hint='Fenestron limit';long='Fenestron saturated. Take power off, nose into wind.';lvl=2;}
  else if(GUIDE.on)[hint,long,lvl]=guideHint(c,hover,lk);
  else if(hover&&!onGround&&Math.hypot(c.lon,c.lat)>0.14){
    const k=Math.abs(c.lon)>Math.abs(c.lat)?'lon':'lat',v=c[k];hint=dir(k,v);
    const why=k==='lon'?(v>0?('You are drifting backwards.'):('You are drifting forward.')):(v>0?('You are drifting left.'):('You are drifting right.'));
    long=why+' '+(`${hint}, a little, until the drift arrow shrinks, then back to centre.`);lvl=1;}
  else if(hover&&!onGround&&Math.abs(c.ped)>0.18){hint=dir('ped',c.ped);long=(c.ped>0?('The nose is turning left. '):('The nose is turning right. '))+hint+(' until it stops.');lvl=1;}
  else if(hover&&!onGround&&Math.abs(c.col)>0.10&&!lk.col){hint=c.col>0?('Collective in'):('Collective out');long=c.col>0?('You are losing height. A little collective in.'):('You are climbing. A little collective out.');lvl=1;}
  else if(!hover&&Math.abs(c.lon)>0.18){hint=c.lon>0?('Nose down'):('Nose up');long=c.lon>0?('Speed too low. Nose a little down.'):('Speed too high. Nose a little up.');lvl=1;}
  else if(!hover&&Math.abs(c.col)>0.12&&!lk.col){hint=c.col>0?('Collective in'):('Collective out');long=c.col>0?('You are sinking. Collective in until the vertical speed is zero.'):('You are climbing. Collective out.');lvl=1;}
  else if(!hover&&Math.abs(c.ped)>0.2){hint=dir('ped',c.ped);long=('Ball off centre. ')+hint+'.';lvl=1;}
  /* (2.17.0) the mouse holding the stick out under the attitude command at speed, the attitude steady: the trim would let it rest */
  {const out=cfg.mouse&&DEV.mouse.armed&&SAS.mode==='att'&&SAS.fwd&&!SAS.rc&&Math.abs(IN.raw.lat)+Math.abs(IN.raw.lon)>0.2&&Math.abs(S.om[0])<4*DEG&&Math.abs(S.om[1])<4*DEG;
   COACH.holdOut=out?(COACH.holdOut||0)+dt:0;
   if(!hint&&COACH.holdOut>4){const pd=cfg.mouseButtons==='pedals';hint=pd?'T trims':'Click trims';long=`You are holding the stick out. ${pd?'T':'A left click'} trims: the attitude stays, the stick rests at the centre.`;lvl=1;}}
  coachHint(hint,long,lvl);
}
/* overlay drawing, called from hudDraw. Colour language: green = move
   the control this way (gold on the way to a click-to-fly target), red =
   rotor limit, white = where you are. */
const COACH_GREEN='#49e36b';
/* (2.16.2) the collective arrow's direction with hysteresis: shown above 0.06, gone below 0.035, and turned round
   only after it has been shown for 0.6 s (it could flip within a fifth of a second) */
function coachColDir(){const v=COACH.cue.col||0,d=COACH.colDir||0,now=S?S.t:0;
  if(!d){if(Math.abs(v)>0.06){COACH.colDir=Math.sign(v);COACH.colT=now;}}
  else if(Math.abs(v)<0.035||(Math.sign(v)!==d&&Math.abs(v)>0.06&&now-(COACH.colT||0)>0.6)){COACH.colDir=Math.abs(v)<0.035?0:Math.sign(v);COACH.colT=now;}
  return COACH.colDir||0;}
/* the legend for the first 20 s after switching on; on the hints' line (2.13.3: it lay at a fixed height, in the cockpit on the panel) */
function coachLegend(x,W){if(!COACH.on||GUIDE.on||REPLAY.on||!S||S.t-COACH.legendT>=20)return;const y=hudSlotB(22);
  x.font='12px "Arial Narrow",sans-serif';x.textAlign='center';x.fillStyle='rgba(13,12,10,0.7)';x.fillRect(W/2-250,y,500,22);x.fillStyle=COACH_GREEN;x.fillText('Coach: green arrow = move the stick this way · ring = target · red = rotor limit · K cycles',W/2,y+15);}
function coachDraw(x,W,Hh){
  if((!COACH.on&&!GUIDE.on)||REPLAY.on)return;
  const CC=GUIDE.on?GUIDE_COL:COACH_GREEN;
  if(!COACH.alive)return;
  const c=COACH.cue;
  const cx0=W/2,cy0=Hh/2-40;const sx=cx0+(DEV.mouse.armed?DEV.mouse.vx*110:0),sy=cy0+(DEV.mouse.armed?DEV.mouse.vy*110:0);
  const mag=Math.hypot(c.lon,c.lat);
  if(mag>0.06&&!(axisHeld('lon')&&axisHeld('lat'))){const L=Math.min(130,mag*300);const ex=sx+c.lat/mag*L,ey=sy-c.lon/mag*L;const a=Math.atan2(ey-sy,ex-sx);
    const pulse=0.75+0.25*Math.abs(Math.sin(S.t*5));
    for(const [col,w] of [['rgba(13,12,10,0.8)',mag>0.2?8:6],[CC,mag>0.2?5:3]]){x.strokeStyle=col;x.lineWidth=w;x.globalAlpha=col===CC?pulse:1;x.beginPath();x.moveTo(sx,sy);x.lineTo(ex,ey);x.stroke();}
    x.fillStyle=CC;x.beginPath();x.moveTo(ex+10*Math.cos(a),ey+10*Math.sin(a));x.lineTo(ex-14*Math.cos(a-0.5),ey-14*Math.sin(a-0.5));x.lineTo(ex-14*Math.cos(a+0.5),ey-14*Math.sin(a+0.5));x.closePath();x.fill();x.globalAlpha=1;
    x.strokeStyle='#fff';x.lineWidth=2;x.beginPath();x.arc(ex,ey,11,0,7);x.stroke();
    const lab=Math.abs(c.lon)>Math.abs(c.lat)?(c.lon>0?('forward'):('back')):(c.lat>0?('right'):('left'));
    x.font='bold 14px "Arial Narrow",sans-serif';x.textAlign='center';x.fillStyle='#0d0c0a';x.fillText(lab,ex+1,ey-19);x.fillStyle=CC;x.fillText(lab,ex,ey-20);}
  // collective and pedal arrows beside the controls box, with words
  const CF=hudCtlFrame(W,Hh),bx=CF.cx,by=CF.cy;x.save();x.scale(CF.s,CF.s);x.font='bold 12px "Arial Narrow",sans-serif';x.textAlign='center';   // on the control indicator: in the cockpit inside the panel's scale
  if(COACH.colDir&&!axisHeld('col')){const up=COACH.colDir>0,ax=bx+45,ay=up?by-44:by+40;x.fillStyle=CC;x.beginPath();x.moveTo(ax,ay+(up?-12:12));x.lineTo(ax-8,ay);x.lineTo(ax+8,ay);x.closePath();x.fill();x.fillText(up?('collective in'):('collective out'),ax,up?ay-18:ay+26);}
  if(Math.abs(c.ped)>0.1&&!axisHeld('ped')){const d=c.ped>0?1:-1,ax=bx+100+d*56,ay=by+26;x.fillStyle=CC;x.beginPath();x.moveTo(ax+d*14,ay);x.lineTo(ax,ay-8);x.lineTo(ax,ay+8);x.closePath();x.fill();x.fillText(d>0?('right pedal'):('left pedal'),bx+100+d*60,ay+24);}
  // ghost stick in the controls box: a ring where the stick belongs
  if(!(axisHeld('lon')&&axisHeld('lat'))){const gx=bx+(S.ctl.lat+c.lat)*28,gy=by-(S.ctl.lon+c.lon)*28;x.strokeStyle=CC;x.lineWidth=2;x.beginPath();x.arc(gx,gy,5,0,7);x.stroke();}
  x.restore();
  // the word and the sentence
  if(COACH.hint){const lvl=COACH.hintLevel,flash=S.t-(COACH.flash||0)<0.4;x.textAlign='center';
    x.font='bold 20px "Arial Narrow",sans-serif';const tw=Math.max(x.measureText(COACH.hint).width,0)+40;x.font='13px "Arial Narrow",sans-serif';const lw=x.measureText(COACH.long).width+40;
    const bw=Math.min(W-40,Math.max(tw,lw)),ty=hudSlotT(52)+18;   // (2.13.3) in the top stack (90_hud.js), under the tutor and an incident
    x.fillStyle=lvl>=2?(flash?'rgba(255,59,31,0.95)':'rgba(255,59,31,0.85)'):(flash?(GUIDE.on?'rgba(255,184,26,0.95)':'rgba(73,227,107,0.95)'):'rgba(13,12,10,0.8)');x.fillRect(W/2-bw/2,ty-18,bw,52);
    x.font='bold 20px "Arial Narrow",sans-serif';x.fillStyle=lvl>=2||flash?'#0d0c0a':CC;x.fillText(COACH.hint,W/2,ty);
    x.font='13px "Arial Narrow",sans-serif';x.fillStyle=lvl>=2||flash?'#0d0c0a':HUD_COL.ink;x.fillText(COACH.long,W/2,ty+22);}
}

/* ═══ Click to fly (2.7): the coach leads the way to a target ═══
   Hold M: a cursor appears (with the mouse captured as the stick it is moved by the mouse while the stick
   stays where it is; otherwise it is the mouse pointer). Under it the spot on the ground (along the line
   of sight) or in the plan view, and the tutor's column standing there faintly. The wheel lifts the target
   from the ground (a hover at 10 ft, the height of the tutor's targets) into the air, up to 2000 ft above
   the ground there. A click sets the target: the column stands there (for a point in the air taller, with
   a ring at the height), a gold bug on the heading tape and a mark in the plan view show where it lies, and
   the coach's arrows turn gold: the shadow autopilot behind them now flies the way to the target
   (guideGoals) instead of "stand still", and its corrections are what the pilot is shown. The pilot flies,
   nothing is driven; an engaged autopilot lets go. Over the target and still for 2 s (or landed at a ground
   target) it is reached: the column fades, the arrows are green again and say "stand still". A right
   click while holding M clears the target, so do a reset and a tutor lesson; releasing M without a click
   changes nothing. (In 2.6 the autopilot flew there.) */
const AIM={on:false,x:0,y:0,locked:false,hi:0,wacc:0,pick:null};
const AIM_FT=[10,25,50,100,150,200,300,500,750,1000,1500,2000];   // the wheel's heights above the ground at the target; the first is the ground: a hover at 3 m
const GUIDE={on:false,n:0,e:0,h:3,t0:0,still:0,doneT:-99,dn:0,de:0,d:0,dh:0,along:0,gs:0,v:0,vs:0,gam:0};
const GUIDE_COL='#ffb81a';   // the column's gold (85_render.js): arrows and column read as one
function aimH(){return AIM.hi?AIM_FT[AIM.hi]*FT:3;}
function guideDist(d){return d<995?`${Math.round(d)} m`:`${(d/1000).toFixed(1)} km`;}
function guideHText(h){return h<3.5?'ground (hover 10 ft)':`${Math.round(h/FT)} ft above the ground`;}
function aimStart(){if(AIM.on)return;AIM.on=true;AIM.hi=0;AIM.wacc=0;AIM.locked=!!DEV.mouse.armed;if(AIM.locked||!AIM.x){AIM.x=R3.w/2;AIM.y=R3.h*0.42;}}
function aimStop(){AIM.on=false;AIM.pick=null;}
function aimMove(dx,dy,sx,sy){if(AIM.locked){AIM.x=clamp(AIM.x+dx,0,R3.w);AIM.y=clamp(AIM.y+dy,0,R3.h);}else{AIM.x=sx;AIM.y=sy;}}
/* the wheel while aiming: one notch (~100 px of scroll) a step up or down the heights */
function aimWheel(dy){AIM.wacc+=dy;while(Math.abs(AIM.wacc)>=80){const s=Math.sign(AIM.wacc);AIM.hi=clamp(AIM.hi-s,0,AIM_FT.length-1);AIM.wacc-=s*80;}}
/* the spot under a point of the view: in the plan view, or where the line of sight meets the ground */
function aimPick(sx,sy){
  if(cfg.hud&&cfg.predict&&typeof SCOPE!=='undefined'&&SCOPE.cur){const L=PANEL.lay,[cx,cy,R]=L?[L.nav.plan.cx*L.s,L.nav.plan.cy*L.s,L.nav.plan.R*L.s]:cfg.view==='cockpit'?[-1e4,-1e4,0]:(()=>{const sB=hudSB(R3.w),p=hudPlanPos(R3.w/sB,R3.h/sB);return [p[0]*sB,p[1]*sB,p[2]*sB];})();   // (2.14) the plan view in its scale
    if(Math.abs(sx-cx)<=R+8&&Math.abs(sy-cy)<=R+8){const k=R/SCOPE.cur.sc,al=-(sy-cy)/k,ac=(sx-cx)/k,c=Math.cos(S.eul[2]),s=Math.sin(S.eul[2]);return {n:S.pos[0]+al*c-ac*s,e:S.pos[1]+al*s+ac*c,src:'plan'};}}
  if(cfg.view==='cockpit'&&HUD.panelA>0.5&&sy>HUD.panelTop){   // the instrument panel; (2.12) under a lifted panel the floor, but the chin windows
    const L=PANEL.lay,inQ=q=>{let sg=0;for(let i=0;i<4;i++){const a=q[i],b=q[(i+1)%4],c=(b[0]-a[0])*(sy-a[1])-(b[1]-a[1])*(sx-a[0]);if(c){if(sg&&Math.sign(c)!==sg)return false;sg=Math.sign(c);}}return true;};
    if(!(HUD.panelUp>0&&L&&sy>(L.t+PNL_H)*L.s&&chinQuads(0).some(inQ)))return null;}
  const c=R3.cam;if(!c.f)return null;const r=vnorm(vcross(c.f,c.u)),uu=vcross(r,c.f),ty=Math.tan(c.fov/2),tx=ty*R3.w/R3.h,xn=sx/R3.w*2-1,yn=1-sy/R3.h*2;
  const d=vnorm(vadd(c.f,vadd(vscl(r,xn*tx),vscl(uu,yn*ty)))),under=t=>{const p=vadd(c.pos,vscl(d,t));return p[2]>=-terrainH(p[0],p[1]);};
  let t0=0.3,t=0.3;if(under(t0))return null;
  while(t<3000){t=Math.max(t*1.03,t+0.4);if(under(t))break;t0=t;}if(t>=3000)return null;
  for(let i=0;i<24;i++){const m=(t0+t)/2;if(under(m))t=m;else t0=m;}
  const p=vadd(c.pos,vscl(d,t));return {n:p[0],e:p[1],src:'view'};}
/* a click while aiming: the left button sets the target, the right one clears it */
function aimClick(btn){
  if(btn===2){if(GUIDE.on){guideClear();afcsNote('Click to fly: target cleared',GUIDE_COL);}return false;}
  const p=aimPick(AIM.x,AIM.y);if(!p){afcsNote('Click to fly: point at the ground or into the plan view');return false;}
  return guideSet(p.n,p.e,aimH());}
/* why click to fly would not lead now ('' when it would) */
function guideCheck(){return TUTOR.on?'stop the tutor lesson first (Shift+Q)':UI.apDemo?'end the V demonstration first':REPLAY.on?'not during the replay':S.crash?'reset first (R)':'';}
function guideSet(n,e,h){
  const why=guideCheck();if(why){afcsNote('Click to fly: '+why);return false;}
  const ap=afcsAny();if(ap)afcsOffAll();   // the pilot flies: the autopilot lets go of every control, without a bump
  Object.assign(GUIDE,{on:true,n,e,h,t0:S.t,still:0});if(COACH.ap)COACH.ap.vs=0;COACH.hint='';COACH.hintLevel=0;for(const k in COACH.cue)COACH.cue[k]=0;guideUpdate(0);   // a new instruction: the arrows grow from nothing
  afcsNote(`Click to fly: ${guideDist(GUIDE.d)}${ap?', autopilot off':''}. Follow the gold arrows`,GUIDE_COL);return true;}
function guideClear(){if(!GUIDE.on)return;GUIDE.on=false;GUIDE.doneT=S.t;if(COACH.ap)COACH.ap.vs=0;}
function guideReset(){GUIDE.on=false;GUIDE.doneT=-99;AIM.on=false;AIM.pick=null;}
/* where the target lies from here; over it and still for 2 s, or landed at a ground target: reached */
function guideUpdate(dt){const G=GUIDE,dn=G.n-S.pos[0],de=G.e-S.pos[1],d=Math.hypot(dn,de),vN=mrot(qmat(S.q),S.vb),gsp=Math.hypot(vN[0],vN[1]);
  G.dn=dn;G.de=de;G.d=d;G.dh=terrainH(G.n,G.e)+1.3+G.h-S.alt;G.along=d>0.5?(vN[0]*dn+vN[1]*de)/d:0;G.gs=gsp;
  if(!dt)return;
  const still=d<3&&Math.abs(G.dh)<1.5&&gsp<0.8&&Math.abs(S.vs)<0.5,landed=S.onGround&&d<6&&G.h<3.5&&S.ctl.col<0.35;
  G.still=still?G.still+dt:0;
  if(G.still>2||landed){guideClear();COACH.hint='Target reached';COACH.long=landed?'On the ground at the target.':'Over the target. The arrows are green again: hold the hover.';
    COACH.hintLevel=1;COACH.hintT=S.t;COACH.flash=S.t;coachSay(COACH.long,1);afcsNote('Click to fly: target reached',GUIDE_COL);}}
/* The way, as goals for the coach's shadow autopilot.
   Along: the ground speed toward the target grows with the distance (4 m/s, up to 41 m/s = 80 kt from
   1.1 km) and is limited so that it can stop at 0.6 m/s² (and 0.4 m/s per metre near it), as in
   2.6's hover taxi; below 30 kt in the hover regime a velocity over the ground (the wind does not matter)
   with the nose into the way, and before that turn at most 4 m/s; above it, the coach's cruise mode: an
   airspeed that makes good that ground speed and a heading that keeps the track on the bearing (the
   present drift angle kept). Each step asked for is at most 2 m/s (hover, ~7° of attitude) or 3 m/s
   (cruise). Within 3 m the tutor's position hold.
   Up and down: the straight line from here to the target, lifted over a hill on the way so that it clears
   it by the height there would be over flat ground (3 to 15 m); the vertical speed follows the progress
   along it, near the target (15 m) the height directly. Descents are kept to 500 fpm at low speed (vortex
   ring) and 1000 fpm from 40 kt, climbs to 500 and 800 fpm; where the line is steeper, the speed along is
   held back so the height can follow. */
function guideGoals(A,hover){
  const G=GUIDE,d=G.d,ux=d>0.5?G.dn/d:0,uy=d>0.5?G.de/d:0,psi=S.eul[2],brg=Math.atan2(G.de,G.dn),vN=mrot(qmat(S.q),S.vb);
  const fw=sm(15*KT,40*KT,S.ias),vsMin=-(2.5+2.5*fw),vsMax=2.5+1.5*fw;
  let gam=G.dh/Math.max(d,1);
  if(d>40)for(let i=1;i<=16;i++){const f=i/17,s=f*d;if(s<10||d-s<20)continue;const cl=clamp(S.hAGL+(G.h-S.hAGL)*f,3,15);{const qn=S.pos[0]+G.dn*f,qe=S.pos[1]+G.de*f;gam=Math.max(gam,(terrainH(qn,qe)+canopyH(qn,qe)+1.3+cl-S.alt)/s);}}   // over the hills and the forests
  let v=Math.min(clamp(4+d/30,4,41),Math.sqrt(2*0.6*Math.max(0,d-1.5)),0.4*d);
  if(Math.abs(gam)>0.01)v=Math.min(v,Math.max(3,(gam<0?-vsMin:vsMax)/Math.abs(gam)));
  const near=d<25;
  if(hover&&!near&&Math.abs(wrapPi(brg-psi))>45*DEG)v=Math.min(v,4);   // the nose into the way first
  const vs=clamp(d<15?G.dh*0.3:Math.max(0,G.along)*gam,vsMin,vsMax);
  G.v=v;G.vs=vs;G.gam=gam;A.alt=null;A.vs=vs;
  if(hover){A.mode='hover';
    if(d<3){A.posN=G.n;A.posE=G.e;}
    else{const eN=v*ux-vN[0],eE=v*uy-vN[1],em=Math.hypot(eN,eE),k=em>2?2/em:1;A.posN=A.posE=null;A.vN=vN[0]+eN*k;A.vE=vN[1]+eE*k;}
    A.hdg=near?coachHoverHdg():brg;}
  else{A.mode='cruise';A.ias=(S.ias+clamp(v-G.along,-3,3))/KT;
    const trk=Math.hypot(vN[0],vN[1])>5?Math.atan2(vN[1],vN[0]):psi;A.hdg=brg+clamp(wrapPi(psi-trk),-0.5,0.5);}}
/* the words on the way: what the largest arrow asks for, and why */
function guideHint(c,hover,lk){
  const climb=['Collective in','Climb toward the target: a little collective in.',1],descend=['Collective out','Descend toward the target: a little collective out.',1];
  if(hover){
    if(Math.hypot(c.lon,c.lat)>0.14){const k=Math.abs(c.lon)>Math.abs(c.lat)?'lon':'lat',v=c[k];
      if(k==='lon')return v>0?['Stick forward','Toward the target: a little forward, then back to centre as the speed builds.',1]:['Stick back','Slow down for the target: a little back, then centre.',1];
      return [v>0?'Stick right':'Stick left',`A little ${v>0?'right':'left'}, then centre: that keeps you on the way to the target.`,1];}
    if(Math.abs(c.ped)>0.18)return [c.ped>0?'Right pedal':'Left pedal','Turn the nose toward the target.',1];
    if(Math.abs(c.col)>0.10&&!lk.col)return c.col>0?climb:descend;}
  else{
    if(Math.abs(c.lat)>0.18)return [c.lat>0?'Bank right':'Bank left',`The target lies to the ${c.lat>0?'right':'left'}: bank until the nose points at it, then level the wings.`,1];
    if(Math.abs(c.col)>0.12&&!lk.col)return c.col>0?climb:descend;
    if(Math.abs(c.lon)>0.18)return c.lon>0?['Nose down','Speed up toward the target: nose a little down.',1]:['Nose up','Slow down, the target is coming: nose a little up.',1];
    if(Math.abs(c.ped)>0.2)return [c.ped>0?'Right pedal':'Left pedal','Ball off centre.',1];}
  return ['','',0];}
/* ---- drawing ---- */
/* the tutor's column (85_render.js), taller for a point in the air, with a ring at its height */
function guideColumn(n,e,h,al){const g=terrainH(n,e),L=Math.max(9,h+6)/9;
  drawMesh(R3.pr.lit,R3.m.column,m4model(mmul(UPX,[L,0,0,0,1,0,0,0,1]),[n,e,-g]),al);
  if(h>3.5&&R3.m.ring)drawMesh(R3.pr.lit,R3.m.ring,m4model(UPX,[n,e,-g-h]),Math.min(0.85,al*2.4));}
/* in the 3D pass: the target's column (fading out for 2.5 s once reached or cleared), and while aiming a faint one under the cursor */
function guideGL(){if(!R3.m.column)return;
  if(GUIDE.on)guideColumn(GUIDE.n,GUIDE.e,GUIDE.h,0.25+0.15*Math.sin(R3.time*3));
  else{const f=(S.t-GUIDE.doneT)/2.5;if(f>=0&&f<1)guideColumn(GUIDE.n,GUIDE.e,GUIDE.h,0.3*(1-f));}
  if(AIM.on&&AIM.pick&&AIM.pick.src==='view')guideColumn(AIM.pick.n,AIM.pick.e,aimH(),0.13);}
/* in the view, while the column is too far to see (or the point in the air too high above it): a gold
   diamond where the target is, with its distance */
function guideDraw(x){if(!GUIDE.on)return;const G=GUIDE;if(G.d<40&&Math.abs(G.dh)<15)return;
  const q=project([G.n,G.e,-(terrainH(G.n,G.e)+1.3+G.h)]);if(!q||q[0]<0||q[0]>R3.w||q[1]<0||q[1]>R3.h)return;if(cfg.view==='cockpit'&&HUD.panelA>0.5&&q[1]>HUD.panelTop)return;
  x.save();x.translate(q[0],q[1]);x.lineJoin='round';
  for(const [c,w] of [['rgba(13,12,10,0.8)',4],[GUIDE_COL,2]]){x.strokeStyle=c;x.lineWidth=w;x.beginPath();x.moveTo(0,-9);x.lineTo(8,0);x.lineTo(0,9);x.lineTo(-8,0);x.closePath();x.stroke();}
  x.fillStyle=GUIDE_COL;x.beginPath();x.arc(0,0,2,0,7);x.fill();
  x.font='bold 12px "Arial Narrow",sans-serif';x.textAlign='center';x.textBaseline='top';const t=guideDist(G.d);x.fillStyle='#0d0c0a';x.fillText(t,1,14);x.fillStyle=GUIDE_COL;x.fillText(t,0,13);x.restore();}
/* on the heading tape: a gold bug at the target's bearing (a pointer at the tape's end beyond it), and left of the tape what is left of the way */
function guideDrawTape(x,cx,hd){const G=GUIDE,b=((Math.atan2(G.de,G.dn)*RAD)%360+360)%360,off=((b-hd+540)%360)-180,px=cx+off*2.8,out=Math.abs(px-cx)>160,qx=clamp(px,cx-160,cx+160);
  x.save();x.fillStyle=GUIDE_COL;x.strokeStyle='#0d0c0a';x.lineWidth=1;x.beginPath();
  if(out){const s=Math.sign(off);x.moveTo(qx+s*7,22);x.lineTo(qx-s*3,14);x.lineTo(qx-s*3,30);}else{x.moveTo(qx,13);x.lineTo(qx-6,5);x.lineTo(qx+6,5);}
  x.closePath();x.fill();x.stroke();
  const eta=G.along>1&&G.d>3?G.d/G.along:0,ft=Math.round(G.dh/FT/10)*10,txt=`TARGET ${guideDist(G.d)} · ${ft>0?'↑ '+ft:ft<0?'↓ '+(-ft):'±0'} ft${eta&&eta<600?` · ${Math.round(eta)} s`:''}`;
  x.font='bold 13px "Arial Narrow",sans-serif';x.textAlign='right';x.textBaseline='middle';const w=x.measureText(txt).width;
  x.fillStyle=HUD_COL.panel;x.fillRect(cx-176-w-12,4,w+12,22);x.fillStyle=GUIDE_COL;x.fillText(txt,cx-176-6,15.5);x.restore();}
/* in the plan view (87_predict.js predDrawPlan): the target, or beyond the scale a pointer at the edge */
function guideDrawPlan(x,px,py,cx,cy,R){const dx=px-cx,dy=py-cy,m=Math.max(Math.abs(dx),Math.abs(dy)),out=m>R,t=out?R/m:1,qx=cx+dx*t,qy=cy+dy*t;
  x.save();x.strokeStyle=GUIDE_COL;x.fillStyle=GUIDE_COL;x.lineWidth=1.5;x.globalAlpha=0.8;x.setLineDash([4,4]);x.beginPath();x.moveTo(cx,cy);x.lineTo(qx,qy);x.stroke();x.setLineDash([]);x.globalAlpha=1;
  if(out){x.translate(qx,qy);x.rotate(Math.atan2(dy,dx));x.beginPath();x.moveTo(6,0);x.lineTo(-6,-6);x.lineTo(-6,6);x.closePath();x.fill();}
  else{x.lineWidth=2;x.beginPath();x.arc(qx,qy,7,0,7);x.stroke();x.beginPath();x.arc(qx,qy,3,0,7);x.fill();}
  x.restore();}
/* while aiming: the cursor, what a click would set, and how */
function aimDraw(x){
  if(!AIM.on)return;const W=R3.w,X=AIM.x,Y=AIM.y,p=aimPick(X,Y),col=GUIDE_COL;AIM.pick=p;
  x.save();x.textBaseline='middle';
  x.strokeStyle=p?col:'rgba(232,226,214,0.8)';x.lineWidth=1.5;x.beginPath();x.arc(X,Y,9,0,7);x.moveTo(X-18,Y);x.lineTo(X-5,Y);x.moveTo(X+5,Y);x.lineTo(X+18,Y);x.moveTo(X,Y-18);x.lineTo(X,Y-5);x.moveTo(X,Y+5);x.lineTo(X,Y+18);x.stroke();
  const why=p?guideCheck():'',txt=p?(why?why:`fly here · ${guideDist(Math.hypot(p.n-S.pos[0],p.e-S.pos[1]))} · ${guideHText(aimH())}`):'no ground here';x.font='bold 12px "Arial Narrow",sans-serif';const tw=x.measureText(txt).width;
  x.fillStyle='rgba(13,12,10,0.75)';x.fillRect(X+14,Y+12,tw+12,20);x.fillStyle=p&&!why?col:why?HUD_COL.amber:'rgba(232,226,214,0.8)';x.textAlign='left';x.fillText(txt,X+20,Y+22);
  const hint='CLICK TO FLY · click a spot on the ground or in the plan view · wheel: height'+(GUIDE.on?' · right-click: clear the target':'')+' · release M to cancel';x.font='13px "Arial Narrow",sans-serif';const hw=x.measureText(hint).width;
  const ay=hudSlotT(22);x.fillStyle='rgba(13,12,10,0.75)';x.fillRect(W/2-hw/2-10,ay,hw+20,22);x.fillStyle=col;x.textAlign='center';x.fillText(hint,W/2,ay+11);   // (2.13.3) in the top stack
  x.restore();}
