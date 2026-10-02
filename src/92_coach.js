/* ═══════════════ COACH ═══════════════
   An instructor in the left seat. A shadow copy of the autopilot flies
   along every frame with the goal "keep this hover / this speed and
   height" (or the tutor's target), and the difference between its stick
   and yours is the correction you owe: shown as an arrow from your stick
   to where it should be, a ghost marker in the controls box, arrows on
   the collective and the pedals, and one short word. Rotor limits come
   first, then sink rate, then drift, then heading. Hysteresis keeps it
   from nagging. K toggles it. */
const COACH={on:true,voice:true,ap:null,cue:{lon:0,lat:0,ped:0,col:0},hint:'',long:'',hintLevel:0,hintT:0,alive:false,hdgRef:0,altRef:0,tick:0,spokenT:-10,spoken:'',legendT:0};
/* Spoken instruction (Web Speech API). Level-2 hints interrupt, level-1
   hints wait 3 s after the last utterance; the same sentence is not
   repeated within 8 s. */
function coachSay(text,lvl){
  if(!COACH.voice||typeof speechSynthesis==='undefined'||!text)return;
  const now=performance.now()/1000;
  if(lvl<2&&now-COACH.spokenT<3)return;
  if(text===COACH.spoken&&now-COACH.spokenT<8)return;
  try{if(lvl>=2)speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang=cfg.lang==='de'?'de-DE':'en-US';u.rate=1.05;u.pitch=1;speechSynthesis.speak(u);COACH.spokenT=now;COACH.spoken=text;}catch(e){}
}
function coachSet(mode){ // 'off' | 'cues' | 'voice'
  COACH.on=mode!=='off';COACH.voice=mode==='voice';COACH.legendT=S?S.t:0;if(!COACH.on){COACH.hint='';COACH.long='';if(typeof speechSynthesis!=='undefined')speechSynthesis.cancel();}
  if(typeof uiSync==='function')uiSync();if(typeof coachButtons==='function')coachButtons();
}
function coachCycle(){coachSet(!COACH.on?'cues':COACH.voice?'off':'voice');}
function coachStep(dt){
  if(!COACH.on||REPLAY.on||UI.apDemo||!S){COACH.alive=false;return;}
  if(!COACH.ap){COACH.ap=apClone();COACH.ap.pOnly=true;}
  const A=COACH.ap,hover=S.ias<30*KT,onGround=S.onGround;
  if(onGround&&S.ctl.col<0.25){COACH.alive=false;COACH.hint='';return;}   // nothing to coach with the rotor unloaded on the ground
  // goals: the tutor's target when it has one, otherwise stop the drift and hold what you have
  A.auto=false;
  if(TUTOR.on&&TUTOR.target){A.mode='hover';A.posN=TUTOR.target[0];A.posE=TUTOR.target[1];A.alt=terrainH(TUTOR.target[0],TUTOR.target[1])+3+1.3;A.hdg=0;}
  else if(hover){A.mode='hover';A.posN=null;A.posE=null;A.vN=0;A.vE=0;
    // a commanded turn is not an error: while the student turns, or the heading hold is still braking, the heading is free
    const turning=(IN.raw.yawCmd||0)!==0||Math.abs(IN.raw.ped||0)>=0.04||Math.abs(SAS.rCmd||0)>2*DEG;
    if(cfg.hdgHold)COACH.hdgRef=SAS.hold?SAS.psiRef:S.eul[2];
    else if(turning||Math.abs(S.om[2])<6*DEG)COACH.hdgRef=S.eul[2];
    COACH.yawFree=turning||(cfg.hdgHold&&!SAS.hold);A.hdg=COACH.hdgRef;
    if(Math.abs(S.vs)<0.8)COACH.altRef=S.alt;A.alt=onGround?null:COACH.altRef;A.vs=0;}
  else{A.mode='cruise';if(Math.abs(S.nz-1)<0.15)A.ias=S.ias/KT;A.alt=null;if(Math.abs(S.vs)<1.0)A.vs=0;else A.vs=A.vs||0;}
  A.mode==='cruise'&&(A.hdg=S.eul[2]);
  /* Trim attitude: the coach compares against the attitude the aircraft
     settles at, not against level. Learned as a slow average, seeded with
     the hover trim of this type (nose 3.5° up, right skid 4° low). */
  if(COACH.trimTh===undefined){COACH.trimTh=3.5*DEG;COACH.trimPhi=4*DEG;}
  const quiet=Math.hypot(S.om[0],S.om[1])<8*DEG;
  if(quiet){COACH.trimTh+=(S.eul[1]-COACH.trimTh)*Math.min(1,dt/6);COACH.trimPhi+=(S.eul[0]-COACH.trimPhi)*Math.min(1,dt/6);}
  A.thTrim=COACH.trimTh;A.phTrim=COACH.trimPhi;
  /* Proportional only: the shadow autopilot returns the correction it would
     add now (attitude error, rate, velocity error), not a full stick
     position, so it does not need the trim and cannot wind up. */
  A.pOnly=true;const o=apStep(dt,A);
  const lk=TUTOR.on?{lon:TUTOR.lockLon,lat:TUTOR.lockLat,ped:TUTOR.lockPed,col:TUTOR.lockCol}:{};
  const c=COACH.cue;
  const raw={lon:sat(o.lon,1),lat:sat(o.lat,1),ped:COACH.yawFree?0:sat(o.ped,1),col:sat(o.col-0.50,0.5)};
  for(const k in raw){const v=lk[k]?0:raw[k];c[k]+=(v-c[k])*Math.min(1,dt*6);}   // smoothed: an instructor does not twitch
  // intentional manoeuvres are not errors: no lateral/longitudinal cue while the student is deliberately translating in the tutor without a target
  COACH.alive=true;
  /* hint, by priority, with hold time: a short word for the screen, a sentence for the voice */
  const de=cfg.lang==='de';let hint='',long='',lvl=0;
  const power=S.eng.mode!=='off';
  const dir=(k,v)=>{const m={lon:v>0?['Knüppel vor','Stick forward']:['Knüppel zurück','Stick back'],lat:v>0?['Knüppel rechts','Stick right']:['Knüppel links','Stick left'],ped:v>0?['Pedal rechts','Right pedal']:['Pedal links','Left pedal']}[k];return de?m[0]:m[1];};
  if(power&&S.NR<H.nr.minPowerOn-1.5){hint=de?'NR fällt':'NR dropping';long=de?'Rotordrehzahl fällt. Kollektiv senken, sofort.':'Rotor speed is dropping. Lower the collective, now.';lvl=2;}
  else if(!power&&S.NR<H.nr.minAuto+3){hint=de?'NR niedrig':'NR low';long=de?'Rotordrehzahl in der Autorotation zu niedrig. Kollektiv senken, Knüppel zurück.':'Rotor speed too low in autorotation. Collective down, aft stick.';lvl=2;}
  else if(S.eng.fli>11.2){hint=de?'Überlast':'Overtorque';long=de?'Über Startleistung. Kollektiv etwas senken.':'Above take-off power. Ease the collective.';lvl=2;}
  else if(S.rot.vrs>0.35){hint=de?'Wirbelring':'Vortex ring';long=de?'Wirbelringzustand. Knüppel nach vorn, aus dem eigenen Abwind heraus. Nicht mehr Kollektiv.':'Vortex ring state. Stick forward, fly out of your own downwash. No more collective.';lvl=2;}
  else if(hover&&!onGround&&S.vs<-2.5&&S.hAGL<40){hint=de?'Sinkrate':'Sink rate';long=de?'Du sinkst schnell nahe dem Boden. Kollektiv rein.':'You are sinking fast near the ground. Collective in.';lvl=2;}
  else if(S.fen.stall>0.6){hint=de?'Fenestron am Limit':'Fenestron limit';long=de?'Fenestron gesättigt. Leistung rausnehmen, Nase in den Wind.':'Fenestron saturated. Take power off, nose into wind.';lvl=2;}
  else if(hover&&!onGround&&Math.hypot(c.lon,c.lat)>0.14){
    const k=Math.abs(c.lon)>Math.abs(c.lat)?'lon':'lat',v=c[k];hint=dir(k,v);
    const why=k==='lon'?(v>0?(de?'Du driftest rückwärts.':'You are drifting backwards.'):(de?'Du driftest nach vorn.':'You are drifting forward.')):(v>0?(de?'Du driftest nach links.':'You are drifting left.'):(de?'Du driftest nach rechts.':'You are drifting right.'));
    long=why+' '+(de?`${hint}, ein wenig, bis der Driftpfeil kleiner wird, dann zurück zur Mitte.`:`${hint}, a little, until the drift arrow shrinks, then back to centre.`);lvl=1;}
  else if(hover&&!onGround&&Math.abs(c.ped)>0.18){hint=dir('ped',c.ped);long=(c.ped>0?(de?'Die Nase dreht nach links. ':'The nose is turning left. '):(de?'Die Nase dreht nach rechts. ':'The nose is turning right. '))+hint+(de?', bis sie steht.':' until it stops.');lvl=1;}
  else if(hover&&!onGround&&Math.abs(c.col)>0.10&&!lk.col){hint=c.col>0?(de?'Kollektiv rein':'Collective in'):(de?'Kollektiv raus':'Collective out');long=c.col>0?(de?'Du verlierst Höhe. Kollektiv ein wenig rein.':'You are losing height. A little collective in.'):(de?'Du steigst. Kollektiv ein wenig raus.':'You are climbing. A little collective out.');lvl=1;}
  else if(!hover&&Math.abs(c.lon)>0.18){hint=c.lon>0?(de?'Nase runter':'Nose down'):(de?'Nase hoch':'Nose up');long=c.lon>0?(de?'Fahrt zu niedrig. Nase etwas runter.':'Speed too low. Nose a little down.'):(de?'Fahrt zu hoch. Nase etwas hoch.':'Speed too high. Nose a little up.');lvl=1;}
  else if(!hover&&Math.abs(c.col)>0.12&&!lk.col){hint=c.col>0?(de?'Kollektiv rein':'Collective in'):(de?'Kollektiv raus':'Collective out');long=c.col>0?(de?'Du sinkst. Kollektiv rein, bis die Sinkrate null ist.':'You are sinking. Collective in until the vertical speed is zero.'):(de?'Du steigst. Kollektiv raus.':'You are climbing. Collective out.');lvl=1;}
  else if(!hover&&Math.abs(c.ped)>0.2){hint=dir('ped',c.ped);long=(de?'Kugel aus der Mitte. ':'Ball off centre. ')+hint+'.';lvl=1;}
  // hysteresis: a level-1 hint stays 1.5 s, level 2 replaces anything at once
  if(hint&&(lvl>=2||!COACH.hint||S.t-COACH.hintT>1.5||lvl>COACH.hintLevel)){if(hint!==COACH.hint){COACH.hintT=S.t;COACH.flash=S.t;coachSay(long,lvl);}COACH.hint=hint;COACH.long=long;COACH.hintLevel=lvl;}
  else if(!hint&&S.t-COACH.hintT>1.5){COACH.hint='';COACH.long='';COACH.hintLevel=0;}
}
/* overlay drawing, called from hudDraw. Colour language: green = move
   the control this way, red = rotor limit, white = where you are. */
const COACH_GREEN='#49e36b';
function coachDraw(x,W,Hh){
  if(!COACH.on||REPLAY.on)return;
  const de=cfg.lang==='de';
  // legend for the first 20 s after switching on
  if(S.t-COACH.legendT<20){x.font='12px "Arial Narrow",sans-serif';x.textAlign='center';x.fillStyle='rgba(13,12,10,0.7)';x.fillRect(W/2-250,Hh*0.86-50,500,22);x.fillStyle=COACH_GREEN;x.fillText(de?'Coach: grüner Pfeil = Knüppel in diese Richtung · Ring = Ziel · rot = Rotorgrenze · K schaltet um':'Coach: green arrow = move the stick this way · ring = target · red = rotor limit · K cycles',W/2,Hh*0.86-35);}
  if(!COACH.alive)return;
  const c=COACH.cue;
  const cx0=W/2,cy0=Hh/2-40;const sx=cx0+(DEV.mouse.armed?DEV.mouse.vx*110:0),sy=cy0+(DEV.mouse.armed?DEV.mouse.vy*110:0);
  const mag=Math.hypot(c.lon,c.lat);
  if(mag>0.06&&!(TUTOR.on&&TUTOR.lockLon&&TUTOR.lockLat)){const L=Math.min(130,mag*300);const ex=sx+c.lat/mag*L,ey=sy-c.lon/mag*L;const a=Math.atan2(ey-sy,ex-sx);
    const pulse=0.75+0.25*Math.abs(Math.sin(S.t*5));
    for(const [col,w] of [['rgba(13,12,10,0.8)',mag>0.2?8:6],[COACH_GREEN,mag>0.2?5:3]]){x.strokeStyle=col;x.lineWidth=w;x.globalAlpha=col===COACH_GREEN?pulse:1;x.beginPath();x.moveTo(sx,sy);x.lineTo(ex,ey);x.stroke();}
    x.fillStyle=COACH_GREEN;x.beginPath();x.moveTo(ex+10*Math.cos(a),ey+10*Math.sin(a));x.lineTo(ex-14*Math.cos(a-0.5),ey-14*Math.sin(a-0.5));x.lineTo(ex-14*Math.cos(a+0.5),ey-14*Math.sin(a+0.5));x.closePath();x.fill();x.globalAlpha=1;
    x.strokeStyle='#fff';x.lineWidth=2;x.beginPath();x.arc(ex,ey,11,0,7);x.stroke();
    const lab=Math.abs(c.lon)>Math.abs(c.lat)?(c.lon>0?(de?'vor':'forward'):(de?'zurück':'back')):(c.lat>0?(de?'rechts':'right'):(de?'links':'left'));
    x.font='bold 14px "Arial Narrow",sans-serif';x.textAlign='center';x.fillStyle='#0d0c0a';x.fillText(lab,ex+1,ey-19);x.fillStyle=COACH_GREEN;x.fillText(lab,ex,ey-20);}
  // collective and pedal arrows beside the controls box, with words
  const bx=W/2-70,by=Hh-60;x.font='bold 12px "Arial Narrow",sans-serif';x.textAlign='center';
  if(Math.abs(c.col)>0.06&&!(TUTOR.on&&TUTOR.lockCol)){const up=c.col>0,ax=bx+45,ay=up?by-44:by+40;x.fillStyle=COACH_GREEN;x.beginPath();x.moveTo(ax,ay+(up?-12:12));x.lineTo(ax-8,ay);x.lineTo(ax+8,ay);x.closePath();x.fill();x.fillText(up?(de?'Kollektiv rein':'collective in'):(de?'Kollektiv raus':'collective out'),ax,up?ay-18:ay+26);}
  if(Math.abs(c.ped)>0.1&&!(TUTOR.on&&TUTOR.lockPed)){const d=c.ped>0?1:-1,ax=bx+100+d*56,ay=by+26;x.fillStyle=COACH_GREEN;x.beginPath();x.moveTo(ax+d*14,ay);x.lineTo(ax,ay-8);x.lineTo(ax,ay+8);x.closePath();x.fill();x.fillText(d>0?(de?'Pedal rechts':'right pedal'):(de?'Pedal links':'left pedal'),bx+100+d*60,ay+24);}
  // ghost stick in the controls box: green ring where the stick belongs
  if(!(TUTOR.on&&TUTOR.lockLon&&TUTOR.lockLat)){const gx=bx+(S.ctl.lat+c.lat)*28,gy=by-(S.ctl.lon+c.lon)*28;x.strokeStyle=COACH_GREEN;x.lineWidth=2;x.beginPath();x.arc(gx,gy,5,0,7);x.stroke();}
  // the word and the sentence
  if(COACH.hint){const lvl=COACH.hintLevel,flash=S.t-(COACH.flash||0)<0.4;x.textAlign='center';
    x.font='bold 20px "Arial Narrow",sans-serif';const tw=Math.max(x.measureText(COACH.hint).width,0)+40;x.font='13px "Arial Narrow",sans-serif';const lw=x.measureText(COACH.long).width+40;
    const bw=Math.min(W-40,Math.max(tw,lw)),ty=TUTOR.on?Hh*0.86-110:86;
    x.fillStyle=lvl>=2?(flash?'rgba(255,59,31,0.95)':'rgba(255,59,31,0.85)'):(flash?'rgba(73,227,107,0.95)':'rgba(13,12,10,0.8)');x.fillRect(W/2-bw/2,ty-18,bw,52);
    x.font='bold 20px "Arial Narrow",sans-serif';x.fillStyle=lvl>=2||flash?'#0d0c0a':COACH_GREEN;x.fillText(COACH.hint,W/2,ty);
    x.font='13px "Arial Narrow",sans-serif';x.fillStyle=lvl>=2||flash?'#0d0c0a':HUD_COL.ink;x.fillText(COACH.long,W/2,ty+22);}
}
