/* ═══════════════ TUTOR ═══════════════
   A helicopter has four controls that all talk to each other, which is
   why nobody learns them at once. The tutor hands them over one at a
   time: the autopilot flies every axis the student does not have yet
   (locked axes take the autopilot's output instead of the device), each
   step names one thing to do, the simulation checks whether it happened,
   and the instrument that matters for the step is highlighted. */
const TUTOR={on:false,li:0,si:0,t:0,hold:0,prog:0,passed:0,flash:0,target:null,lockCol:false,lockCyc:false,lockLon:false,lockLat:false,lockPed:false,peak:0,flag:false,lessonDone:false,trim:{lon:0.02,lat:0.14},demo:false};
/* helpers for checks: hold(cond, seconds) accumulates time while cond is
   true and resets when it is not; prog shows the bar. */
function tHold(cond,sec,dt){if(cond)TUTOR.hold+=dt;else TUTOR.hold=Math.max(0,TUTOR.hold-dt*2);TUTOR.prog=clamp(TUTOR.hold/sec,0,1);return TUTOR.hold>=sec;}
function tDist(n,e){return Math.hypot(S.pos[0]-n,S.pos[1]-e);}
function tSpeed(){return Math.hypot(S.vb[0],S.vb[1]);}
function tHdg(deg,tol){return Math.abs(wrapPi(S.eul[2]-deg*DEG))*RAD<tol;}
const LESSONS=[
 {title:'Orientation',reset:'pad',lock:{col:true,cyc:true,ped:true},aids:{sas:true,attHold:true,hdgHold:true,hoverAssist:false},
  steps:[
   {text:'You are in the right seat of an EC135, rotor at 100 %, skids on the pad. In this lesson the autopilot flies; you just look. N continues.',hl:['horizon'],manual:true},
   {text:'Top: the heading tape. Left: airspeed (IAS) in knots. Right: height above ground (RAD ALT) in feet and the vertical speed in feet per minute. N continues.',hl:['hdg','ias','ra'],manual:true},
   {text:'Bottom left, the two limits: NR is the rotor speed (green 97–104 %), FLI the power (10 = max continuous, 11 = take-off). The lamps beside them flag states such as VRS or ground effect. N continues.',hl:['nrfli'],manual:true},
   {text:'Bottom centre: the control positions, stick in the square, collective as a bar, pedals as a slider. Beside it the drift arrow: where the aircraft moves over the ground. In the hover you want it inside the circle. A click into the view captures the mouse as the stick (Esc releases it); the stick starts at the centre, the small cross shows its position. N continues.',hl:['ctl','drift'],manual:true},
   {text:'Bottom right, the rotor disc: angle of attack of every blade element, nose up. Green is fine, yellow high, red stalled. N continues, and then you start flying.',hl:['disc'],manual:true},
  ]},
 {title:'The collective',reset:'pad',lock:{col:false,cyc:true,ped:true},aids:{sas:true,attHold:true,hdgHold:true,hoverAssist:false},
  steps:[
   {text:'Your only control now is the collective: W raises it slowly, S lowers it (or the mouse wheel). The autopilot holds attitude and heading. Tap W and watch the FLI rise.',hl:['col','fli'],check:(dt)=>S.ctl.col>0.22},
   {text:'Keep raising until the skids lift. At about 35 % the aircraft gets light: the skid loads in the controls box go to zero. Climb slowly.',hl:['col','ra'],check:(dt)=>S.hAGL>0.6},
   {text:'Stop the climb at 3 m: lower the collective a little as you pass 2 m. Height answers with a delay: small corrections, then wait. Hold 3 m (±1 m) for 5 seconds.',hl:['ra','col'],check:(dt)=>tHold(Math.abs(S.hAGL-3)<1&&!S.onGround,5,dt)},
   {text:'Climb to 10 m and come back to 3 m. When you lower the collective the aircraft starts sinking a second later: that delay is what you have to learn to feel.',hl:['ra','col'],check:(dt)=>{if(S.hAGL>9.5)TUTOR.flag=true;return TUTOR.flag&&Math.abs(S.hAGL-3)<1&&Math.abs(S.vs)<1;}},
   {text:'Land: lower the collective a hair, let it sink at less than 1 m/s (under 200 fpm). When the skids touch, lower the collective fully.',hl:['ra','col'],check:(dt)=>S.onGround&&S.touch&&S.touch.vs<1.5&&S.ctl.col<0.15},
  ]},
 {title:'The pedals',reset:'hover',lock:{col:true,cyc:true,ped:false},aids:{sas:true,attHold:true,hdgHold:true,hoverAssist:false},
  steps:[
   {text:'You hover at 3 m; the autopilot holds height and position. D is right pedal: the nose yaws right. Turn to heading 090 (east). The key commands a yaw rate; releasing it holds the heading.',hl:['hdg','ped'],check:(dt)=>tHold(tHdg(90,6),2,dt)},
   {text:'Watch the FLI: on this aircraft right pedal costs power, because the Fenestron pushes against the rotor torque. Turn left to 270.',hl:['hdg','fli'],check:(dt)=>tHold(tHdg(270,6),2,dt)},
   {text:'Back to north (360) and hold for 5 seconds. Stop pressing before the target heading: the turn keeps going.',hl:['hdg'],check:(dt)=>tHold(tHdg(0,5),5,dt)},
  ]},
 {title:'Calm hover',reset:'hover',lock:{col:true,cyc:false,ped:true},aids:{sas:true,attHold:true,hdgHold:true,hoverAssist:false},
  steps:[
   {text:'Hands off. The aircraft was handed to you trimmed: stick, pedal and collective sit at the values that make it stand still, and the attitude hold keeps that attitude. Touch nothing and watch for 15 seconds: it stays. This is the state every hover starts from.',hl:['drift','stick'],target:[0,0],showTrim:true,check:(dt)=>TUTOR.t>15&&tDist(0,0)<12},
   {text:'Now one single nudge: mouse briefly about 20 % forward and straight back to centre. Watch: the nose dips and returns, but the aircraft now rolls slowly forward. An attitude change leaves velocity behind, even when the attitude is long back where it was. Continue once the drift arrow points forward.',hl:['drift','stick'],target:[0,0],showTrim:true,check:(dt)=>{const R=qmat(S.q),v=mrot(R,S.vb);const f=v[0]*Math.cos(S.eul[2])+v[1]*Math.sin(S.eul[2]);if(TUTOR.v0===undefined)TUTOR.v0=f;return f-TUTOR.v0>0.3;}},
   {text:'The counter-nudge: briefly back, centre. Do not hold it: one nudge. The drift stops. That is the whole technique of the hover: change the attitude, velocity appears; counter-attitude, velocity disappears; in between, do nothing.',hl:['drift','stick'],target:[0,0],showTrim:true,check:(dt)=>tHold(tSpeed()<0.3,2,dt)},
   {text:'Three more times: nudge, drift grows, counter-nudge, drift gone. Wait a second after each nudge before you judge: the aircraft answers late. At the end hold the pad within 5 m for 15 seconds.',hl:['drift','stick'],target:[0,0],showTrim:true,check:(dt)=>tHold(tDist(0,0)<5,15,dt)},
  ]},
 {title:'Why the stick is hard',reset:'hover',lock:{col:true,cyc:true,ped:true},aids:{sas:true,attHold:true,hdgHold:true,hoverAssist:false},mouseMode:'attitude',
  steps:[
   {text:'The stick does not control position. It tilts the rotor disc, the tilt rotates the fuselage, the attitude accelerates the aircraft, acceleration builds velocity, velocity moves the position. Each stage takes time: stick to attitude about half a second, attitude to a noticeable velocity two seconds. Whoever watches the position reacts four seconds late and starts to oscillate. N continues.',hl:['horizon','drift'],manual:true},
   {text:'Hence the rule: fly the attitude, read the drift, position takes care of itself. The drift arrow shows velocity, the fastest feedback you have. The recipe for every correction: small impulse, stick back to centre, wait a second, then the counter-impulse before the movement stops. N continues.',hl:['drift','stick'],manual:true},
   {text:'Watch the autopilot. It hovers for 15 seconds and you see in the controls box how small its stick movements are: mostly under five percent, and never long in one direction. The blue cross is the trim: that is where the stick sits in a calm hover, a little right and a touch aft.',hl:['stick'],demo:true,showTrim:true,check:(dt)=>TUTOR.t>15},
   {text:'Now you, on the pole. The aircraft is tethered and cannot drift, only tilt. Click into the view to capture the mouse. It commands an attitude: mouse forward = nose down. Put the nose 5° down (pitch ladder) and hold it for 3 seconds.',hl:['horizon'],tether:true,lock:{col:true,lon:false,lat:true,ped:true},check:(dt)=>tHold(Math.abs(S.eul[1]*RAD+5)<1.5,3,dt)},
   {text:'Nose 5° up, 3 seconds. Note how little mouse travel that is. This is the whole range in which a hover happens.',hl:['horizon'],tether:true,lock:{col:true,lon:false,lat:true,ped:true},check:(dt)=>tHold(Math.abs(S.eul[1]*RAD-5)<1.5,3,dt)},
   {text:'Back to the hover attitude: nose slightly up, about 3°, where the mark on the pitch ladder is. Hold it calmly for 5 seconds.',hl:['horizon'],tether:true,lock:{col:true,lon:false,lat:true,ped:true},check:(dt)=>tHold(Math.abs(S.eul[1]*RAD-3)<1.5,5,dt)},
  ]},
 {title:'One axis: fore and aft',reset:'hover',lock:{col:true,lon:false,lat:true,ped:true},aids:{sas:true,attHold:true,hdgHold:true,hoverAssist:false},mouseMode:'attitude',
  steps:[
   {text:'The tether is gone, but the autopilot holds the lateral axis. You only have fore and aft, and the mouse still commands attitude. Keep the pad within 5 m for 20 seconds. Watch the drift arrow: as soon as it points forward, nose a touch up. Do not wait for the position to go.',hl:['drift','horizon'],target:[0,0],showTrim:true,check:(dt)=>tHold(tDist(0,0)<5,20,dt)},
   {text:'To the column 25 m ahead and stop there. Nose 2° down until the drift arrow shows about two metres per second, then hover attitude. Halfway, nose 2° up until the arrow vanishes, then hover attitude again.',hl:['drift','horizon'],target:[25,0],showTrim:true,check:(dt)=>tHold(tDist(25,0)<4&&tSpeed()<0.8,3,dt)},
   {text:'Back to the pad, same recipe backwards. Flying backwards is allowed; you need not turn.',hl:['drift'],target:[0,0],showTrim:true,check:(dt)=>tHold(tDist(0,0)<4&&tSpeed()<0.8,3,dt)},
  ]},
 {title:'One axis: sideways',reset:'hover',lock:{col:true,lon:true,lat:false,ped:true},aids:{sas:true,attHold:true,hdgHold:true,hoverAssist:false},mouseMode:'attitude',
  steps:[
   {text:'Now the autopilot holds the longitudinal axis, you only have sideways. Mouse right = right skid low = movement to the right. On this aircraft the calm hover hangs about 4° to the right: that is the trim attitude, not level. Hold the pad for 20 seconds.',hl:['drift','horizon'],target:[0,0],showTrim:true,check:(dt)=>tHold(tDist(0,0)<5,20,dt)},
   {text:'20 m to the right to the column and stop, then back. The nose stays on north.',hl:['drift'],target:[0,20],showTrim:true,check:(dt)=>{if(tDist(0,20)<4&&tSpeed()<0.8)TUTOR.flag=true;return TUTOR.flag&&tHold(tDist(0,0)<4&&tSpeed()<0.8,3,dt);}},
  ]},
 {title:'Both axes as attitude',reset:'hover',lock:{col:true,cyc:false,ped:true},aids:{sas:true,attHold:true,hdgHold:true,hoverAssist:false},mouseMode:'attitude',
  steps:[
   {text:'Both axes, the mouse still commands attitude. The autopilot only holds height and heading now. Keep the pad within 5 m for 20 seconds. If it starts to oscillate: mouse onto the blue cross, do nothing for a second.',hl:['drift','stick'],target:[0,0],showTrim:true,check:(dt)=>tHold(tDist(0,0)<5,20,dt)},
   {text:'A square: to the column ahead, then right, then back, then left to the pad. Stop at every corner. The column moves along.',hl:['drift'],target:[20,0],showTrim:true,check:(dt)=>{const c=[[20,0],[20,20],[0,20],[0,0]];const k=TUTOR.peak|0;if(k>=c.length)return true;TUTOR.target=c[k];if(tDist(c[k][0],c[k][1])<4&&tSpeed()<0.8){TUTOR.hold+=dt;if(TUTOR.hold>2){TUTOR.hold=0;TUTOR.peak=k+1;}}else TUTOR.hold=0;TUTOR.prog=(k+TUTOR.hold/2)/c.length;return false;}},
   {text:'Hold once more for 20 seconds, now within 3 m. That is the accuracy a landing needs.',hl:['drift'],target:[0,0],showTrim:true,check:(dt)=>tHold(tDist(0,0)<3,20,dt)},
  ]},
 {title:'The stick as velocity',reset:'hover',lock:{col:true,cyc:false,ped:true},aids:{sas:true,attHold:true,hdgHold:true,hoverAssist:true},mouseMode:'stick',assist:1,
  steps:[
   {text:'Another way to the same goal: hover assist. The mouse is now a velocity command: the centre means stop, slightly forward means slowly forward. The computer translates into attitude. Fly to the column and stop there.',hl:['stick','drift'],target:[25,0],check:(dt)=>tHold(tDist(25,0)<4&&tSpeed()<1,2,dt)},
   {text:'Back over the pad, centre the mouse before you get there.',hl:['drift'],target:[0,0],check:(dt)=>tHold(tDist(0,0)<3&&tSpeed()<0.7,2,dt)},
   {text:'Now only half the help: the mouse is half velocity, half stick. You feel the aircraft lagging behind. Hold the pad within 4 m for 20 seconds.',hl:['drift','stick'],target:[0,0],assist:0.5,check:(dt)=>tHold(tDist(0,0)<4,20,dt)},
   {text:'A quarter of the help. To the column and back, stop at both ends.',hl:['drift','stick'],target:[25,0],assist:0.25,check:(dt)=>{if(tDist(25,0)<4&&tSpeed()<0.8)TUTOR.flag=true;return TUTOR.flag&&tHold(tDist(0,0)<4&&tSpeed()<0.8,2,dt);}},
  ]},
 {title:'The raw stick',reset:'hover',lock:{col:true,cyc:false,ped:true},aids:{sas:true,attHold:false,hdgHold:true,hoverAssist:false},
  steps:[
   {text:'Now without the attitude hold, damping only: the mouse tilts the rotor disc directly. One impulse forward and the nose drops and stays down until you give the counter-impulse; nothing brings it back. The trim is still fed in, the blue cross shows it. Keep the pad within 5 m for 20 seconds.',hl:['stick','drift'],target:[0,0],showTrim:true,check:(dt)=>tHold(tDist(0,0)<5,20,dt)},
   {text:'Stop the drift. The aircraft is about to get a push forward, three metres per second. Stop it within 10 m: nose up until the drift arrow shrinks, stick back onto the cross before it reaches zero.',hl:['drift','stick'],inject:[3,0],showTrim:true,check:(dt)=>tHold(tSpeed()<0.5&&tDist(0,0)<12,1.5,dt)},
   {text:'Again, push to the left. Same recipe: stick the other way until the arrow shrinks, then back onto the cross.',hl:['drift','stick'],inject:[0,-3],showTrim:true,check:(dt)=>tHold(tSpeed()<0.5&&tDist(0,0)<12,1.5,dt)},
   {text:'To the column ahead and stop. Impulse, centre, halfway, counter-impulse, centre. Think in impulses.',hl:['stick','drift'],target:[25,0],showTrim:true,check:(dt)=>tHold(tDist(25,0)<4&&tSpeed()<0.8,3,dt)},
   {text:'Back to the pad and hold within 3 m for 20 seconds. If you can do this, you can hover.',hl:['drift'],target:[0,0],showTrim:true,check:(dt)=>tHold(tDist(0,0)<3,20,dt)},
  ]},
 {title:'All together',reset:'pad',lock:{col:false,cyc:false,ped:false},aids:{sas:true,attHold:true,hdgHold:true,hoverAssist:false},
  steps:[
   {text:'All three controls are yours: collective (W/S), pedals (A/D), stick (mouse). Lift off, hold 3 m with the collective, north with the pedals, the pad with the stick. 20 seconds within 5 m and ±1.5 m of height.',hl:['col','ra','drift'],target:[0,0],check:(dt)=>tHold(!S.onGround&&tDist(0,0)<5&&Math.abs(S.hAGL-3)<1.5,20,dt)},
   {text:'Land inside the ring (7 m around the H) at less than 1.5 m/s. Drift to zero first, then sink, never the other way round: a sideways touchdown rolls the aircraft.',hl:['drift','ra'],target:[0,0],check:(dt)=>S.onGround&&tDist(0,0)<7&&S.touch&&S.touch.vs<1.5&&S.ctl.col<0.2},
  ]},
 {title:'Transition to forward flight',reset:'hover',lock:{col:false,cyc:false,ped:false},aids:{sas:true,attHold:true,hdgHold:true,hoverAssist:false},
  steps:[
   {text:'Lower the nose a little and accelerate. Between 15 and 25 kt the aircraft shudders and wants to climb: the rotor reaches clean air (translational lift). Ease the collective, hold the nose. Target: 60 kt and 300 ft.',hl:['ias','ra'],check:(dt)=>S.ias>55*KT&&S.hAGL>300*FT},
   {text:'Climb to 500 ft and level off: lower the collective until the vertical speed is zero. Hold 60 kt (±10) and 500 ft (±100) for 10 seconds. Speed comes from the stick, height from the collective.',hl:['ias','ra','col'],check:(dt)=>tHold(Math.abs(S.ias/KT-60)<10&&Math.abs(S.hAGL/FT-500)<100,10,dt)},
   {text:'Turn: stick slightly right, the aircraft banks and turns. A touch of aft stick keeps the nose up. Turn to heading 180 and hold it.',hl:['hdg','stick'],check:(dt)=>tHold(tHdg(180,10)&&S.hAGL>200*FT,5,dt)},
  ]},
 {title:'Approach and landing',reset:'approach',lock:{col:false,cyc:false,ped:false},aids:{sas:true,attHold:true,hdgHold:true,hoverAssist:false},
  steps:[
   {text:'900 m south of the pad at 500 ft and 70 kt. Bring the speed back to 40 kt with the stick and descend at 500 fpm with the collective. The pad should stay put in the window: if it climbs, you are low.',hl:['ias','ra'],check:(dt)=>tDist(0,0)<400&&S.ias<45*KT&&S.hAGL<300*FT},
   {text:'Below 25 kt the translational lift goes: the aircraft settles and now needs power. Collective in, the FLI rises to 6 or 7. Come to a hover at 3 m over the pad.',hl:['fli','drift'],target:[0,0],check:(dt)=>tHold(tDist(0,0)<6&&Math.abs(S.hAGL-3)<2&&tSpeed()<1.5,3,dt)},
   {text:'Land as you learned: drift zero, then sink, collective fully down once the skids sit. After that you are ready for the exercises in the menu.',hl:['drift','ra'],target:[0,0],check:(dt)=>S.onGround&&tDist(0,0)<8&&S.ctl.col<0.2},
  ]},
];
function tutorStart(li){
  TUTOR.on=true;TUTOR.li=clamp(li,0,LESSONS.length-1);TUTOR.lessonDone=false;
  const L=LESSONS[TUTOR.li];
  cfg.resetKind=L.reset;uiReset(L.reset);UI.phantom=null;
  Object.assign(cfg,L.aids);
  cfg.kbdCol='metered';cfg.kbdPed='heading';cfg.assistK=L.assist!==undefined?L.assist:1;
  tutorLocks(L.lock);
  // the autopilot flies the locked axes: hold the current position, 3 m, north
  AP.on=true;AP.mode='hover';AP.auto=false;AP.posN=L.reset==='approach'?null:S.pos[0];AP.posE=L.reset==='approach'?null:S.pos[1];AP.vN=0;AP.vE=0;AP.hdg=S.eul[2];
  AP.alt=terrainH(S.pos[0],S.pos[1])+3+1.3;apBumpless(AP);
  tutorSetStep(0);uiSync();
  const sel=document.getElementById('tutorSel');if(sel)sel.value=String(TUTOR.li);
}
function tutorLocks(l){TUTOR.lockCol=!!l.col;TUTOR.lockPed=!!l.ped;TUTOR.lockLon=l.cyc!==undefined?!!l.cyc:!!l.lon;TUTOR.lockLat=l.cyc!==undefined?!!l.cyc:!!l.lat;TUTOR.lockCyc=TUTOR.lockLon&&TUTOR.lockLat;}
function tutorSetStep(si){TUTOR.si=si;TUTOR.t=0;TUTOR.hold=0;TUTOR.prog=0;TUTOR.passed=0;TUTOR.flag=false;TUTOR.peak=0;TUTOR.v0=undefined;
  const L=LESSONS[TUTOR.li],st=L.steps[si];TUTOR.target=st.target?[st.target[0],st.target[1]]:null;
  tutorLocks(st.lock||L.lock);TUTOR.demo=!!st.demo;TUTOR.showTrim=!!st.showTrim;
  if(st.assist!==undefined)cfg.assistK=st.assist;else if(L.assist!==undefined)cfg.assistK=L.assist;
  S.tether=st.tether?[S.pos[0],S.pos[1]]:null;
  if(st.inject){const R=qmat(S.q);const vb=mrotT(R,[st.inject[0],st.inject[1],0]);S.vb=vadd(S.vb,vb);}
}
function tutorNext(){if(!TUTOR.on)return;const L=LESSONS[TUTOR.li];
  if(TUTOR.lessonDone||TUTOR.si>=L.steps.length-1){if(TUTOR.li<LESSONS.length-1)tutorStart(TUTOR.li+1);else tutorStop();return;}
  tutorSetStep(TUTOR.si+1);}
function tutorBack(){if(!TUTOR.on)return;if(TUTOR.si>0)tutorSetStep(TUTOR.si-1);else if(TUTOR.li>0)tutorStart(TUTOR.li-1);}
function tutorStop(){AP.freezeInt=false;TUTOR.on=false;TUTOR.target=null;TUTOR.lockCol=TUTOR.lockCyc=TUTOR.lockLon=TUTOR.lockLat=TUTOR.lockPed=false;TUTOR.demo=false;TUTOR.showTrim=false;AP.on=false;AP.posN=AP.posE=null;if(S)S.tether=null;cfg.assistK=1;cfg.attHold=true;}
/* Called after the devices have written IN and before the physics step:
   locked axes take the autopilot, then the step is checked. */
function tutorStep(dt){
  if(!TUTOR.on)return;
  const L=LESSONS[TUTOR.li],st=L.steps[TUTOR.si];
  const demo=TUTOR.demo&&TUTOR.passed<=0;
  if(TUTOR.lockCol||TUTOR.lockLon||TUTOR.lockLat||TUTOR.lockPed||demo){
    // heading reference: follow the student's pedals when they have them, else hold
    if(!TUTOR.lockPed&&!demo)AP.hdg=S.eul[2];
    /* Position hold only for the axes the autopilot flies: with one cyclic
       axis handed over, the autopilot keeps the other coordinate. */
    if(TUTOR.lockLon&&TUTOR.lockLat||demo){if(AP.posN===null){AP.posN=S.pos[0];AP.posE=S.pos[1];}}
    else if(TUTOR.lockLat){AP.posN=null;AP.posE=AP.posE===null?S.pos[1]:AP.posE;}
    else if(TUTOR.lockLon){AP.posE=null;AP.posN=AP.posN===null?S.pos[0]:AP.posN;}
    else{AP.posN=null;AP.posE=null;}
    if(AP.posN===null)AP.vN=0;if(AP.posE===null)AP.vE=0;
    AP.freezeInt=!!S.tether;                                   // on the pole the velocity loops must not wind up
    const o=apStep(dt);
    if(TUTOR.lockCol||demo){IN.col=o.col;DEV.kbd.col=o.col;}
    if(TUTOR.lockLon||demo)IN.lon=o.lon;
    if(TUTOR.lockLat||demo)IN.lat=o.lat;
    if(TUTOR.lockPed||demo){IN.ped=o.ped;DEV.kbd.psiRef=AP.hdg;}
    // the hover trim, learned while the autopilot has the cyclic
    if((TUTOR.lockLon&&TUTOR.lockLat||demo)&&!S.onGround&&tSpeed()<1){TUTOR.trim.lon+=(o.lon-TUTOR.trim.lon)*Math.min(1,dt*0.3);TUTOR.trim.lat+=(o.lat-TUTOR.trim.lat)*Math.min(1,dt*0.3);}
  }
  TUTOR.t+=dt;
  if(TUTOR.passed>0){TUTOR.passed-=dt;if(TUTOR.passed<=0){if(TUTOR.si<L.steps.length-1)tutorSetStep(TUTOR.si+1);else TUTOR.lessonDone=true;}return;}
  if(!TUTOR.lessonDone&&!st.manual&&st.check&&st.check(dt)){TUTOR.passed=1.6;TUTOR.flash=S.t;}
  if(S.crash&&!TUTOR.lessonDone){TUTOR.crashT=(TUTOR.crashT||0)+dt;if(TUTOR.crashT>4){TUTOR.crashT=0;tutorStart(TUTOR.li);}}
}
