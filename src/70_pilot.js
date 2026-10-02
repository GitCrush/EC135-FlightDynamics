/* ═══════════════ PILOT MODELS ═══════════════
   One cascaded controller serves three purposes: the phantom that flies
   the exercises, the trim finder in the harness, and the stability
   augmentation the human can switch on. Inner loops command attitude
   with rate damping, outer loops command velocity, collective holds
   height or vertical speed with rotor-speed protection, pedals hold
   heading in the hover and centre the ball in forward flight. Gains are
   in control units per rad, rad/s, m/s. */
const AP_MAIN={
  on:false, mode:'hover',
  vN:0,vE:0,      // wanted ground velocity, NED (hover / translation)
  posN:null,posE:null,   // wanted position; when set, the velocity command comes from the position error
  ias:0,          // wanted airspeed (cruise)
  alt:null,vs:0,  // wanted altitude (m) or vertical speed (m/s) when alt is null
  hdg:0,          // wanted heading (rad)
  auto:false,     // autorotation: collective for NR, no height loop
  int:{lon:0,lat:0,col:0,ped:0,attL:0,attR:0},
  out:{col:0.5,lon:0,lat:0,ped:0},
};
const AP=AP_MAIN;
/* Bumpless engage: the autopilot takes over from the controls as they
   are. Its integrators are set so that its first output equals the
   present stick, pedal and collective; without this it would start from
   zero and spend seconds finding a trim that is 38 % aft of centre. */
function apBumpless(A){A=A||AP_MAIN;const [phi,th]=S.eul,[p,q]=S.om;
  A.int.lon=0;A.int.lat=0;
  A.int.attL=clamp(S.ctl.lon-2.2*th-0.55*q,-1.2,1.2);
  A.int.attR=clamp(S.ctl.lat+2.4*phi+0.5*p,-1.2,1.2);
  A.int.col=clamp(S.ctl.col-0.50,-0.3,0.4);
  A.int.ped=clamp(S.ctl.ped,-0.5,0.9);
}
function apClone(){const a=JSON.parse(JSON.stringify(AP_MAIN));a.on=true;return a;}
function apStep(dt,apo){
  const AP=apo||AP_MAIN;   // the shadow autopilot of the coach passes its own object
  if(AP.pOnly){for(const k in AP.int)AP.int[k]=0;}   // proportional only: the coach wants the correction, not the trim
  const [phi,th,psi]=S.eul, [p,q,r]=S.om;
  const R=qmat(S.q), vN=mrot(R,S.vb);
  const cps=Math.cos(psi),sps=Math.sin(psi);
  // velocity error in body-horizontal axes
  let evx,evy;
  if(AP.mode==='cruise'){
    evx=AP.ias*KT-S.ias; evy=0;
  }else{
    if(AP.posN!==null)AP.vN=clamp((AP.posN-S.pos[0])*0.35,-4,4);
    if(AP.posE!==null)AP.vE=clamp((AP.posE-S.pos[1])*0.35,-4,4);
    const dN=AP.vN-vN[0], dE=AP.vE-vN[1];
    evx=dN*cps+dE*sps; evy=-dN*sps+dE*cps;
  }
  // outer loop: attitude commands from velocity error (with a little integral against trim drift)
  const cruise=S.ias>25*KT;
  if(!AP.freezeInt&&!AP.pOnly){AP.int.lon=clamp(AP.int.lon+evx*dt*(cruise?0.01:0.004),-0.2,0.2);
  AP.int.lat=clamp(AP.int.lat+evy*dt*0.004,-0.12,0.12);}
  // attitude commands; thTrim/phTrim let a proportional-only user (the coach) supply the trim attitude the integrators would hold
  const thC=clamp(-(cruise?0.05:0.06)*evx-AP.int.lon+(AP.thTrim||0),-0.35,0.30);
  const phC=clamp((cruise?0.0:0.06)*evy+AP.int.lat+(AP.phTrim||0),-0.35,0.35);
  // inner loop: attitude hold with rate damping
  // attitude integrators: the trimmed stick moves with speed (speed stability), the loop has to follow it
  if(!AP.pOnly){AP.int.attL=clamp((AP.int.attL||0)+(th-thC)*dt*0.6,-1.2,1.2);
  AP.int.attR=clamp((AP.int.attR||0)+(phC-phi)*dt*0.6,-1.2,1.2);}
  let lon=2.2*(th-thC)+0.55*q+AP.int.attL;   // stick forward = nose down: positive lon lowers theta
  let lat=2.4*(phC-phi)-0.5*p+AP.int.attR;
  // collective: height or vertical speed, then NR protection
  let vsC=AP.alt!==null?clamp((AP.alt-S.alt)*0.25,-5,5):AP.vs;
  let col;
  if(AP.auto){
    // autorotation: collective holds NR in the band, cyclic holds speed
    const nrC=100;
    AP.int.col=clamp(AP.int.col+(S.NR-nrC)*dt*0.004,-0.2,0.35);
    col=0.22+0.018*(S.NR-nrC)+AP.int.col;
  }else{
    // integrator frozen at the power limit: the pilot does not keep pulling into a drooping rotor
    const limited=S.NR<H.nr.minPowerOn+0.5||S.eng.fli>10.8;
    if(!limited&&!AP.pOnly)AP.int.col=clamp(AP.int.col+(vsC-S.vs)*dt*0.004,-0.3,0.4);
    col=0.50+0.03*(vsC-S.vs)+AP.int.col;
    if(S.NR<H.nr.minPowerOn+0.5)col-=0.08*(H.nr.minPowerOn+0.5-S.NR);   // overpitch protection
    if(S.eng.fli>11)col-=0.05*(S.eng.fli-11);                              // stay below take-off power
  }
  // pedals: heading in hover, ball in cruise
  let ped;
  if(AP.mode==='cruise'&&cruise){if(!AP.pOnly)AP.int.ped=clamp(AP.int.ped-S.ay*dt*0.01,-0.4,0.4);ped=-0.10*S.ay-0.35*r+AP.int.ped;}
  else{const e=wrapPi(AP.hdg-psi);if(!AP.pOnly)AP.int.ped=clamp(AP.int.ped+e*dt*0.25,-0.5,0.9);ped=2.0*e-0.8*r+AP.int.ped;}
  AP.out={col:clamp(col,0,1),lon:sat(lon,1),lat:sat(lat,1),ped:sat(ped,1)};
  return AP.out;
}
/* ═══ Trim and stability augmentation for the human ═══
   TRIM is what the aircraft needs to stand still: attitude (nose up,
   right skid low) and the stick, pedal and collective that hold it. It
   is seeded with the type's hover trim, set exactly whenever the
   autopilot hands over a trimmed aircraft (every reset), and learned
   slowly in a calm hover. Attitude hold is an attitude *command* around
   that trim with an integrator: centred stick = trim attitude = no
   acceleration. A proportional hold could only keep the trim attitude
   with a standing error of ~3°, which is 0.5 m/s² of drift, the reason
   the first hovers felt impossible. */
const TRIM={th:3.6*DEG,phi:4.2*DEG,lon:-0.385,lat:0.01,ped:0.40,col:0.526,hover:null};   // seeds (2500 kg, ISA, calm); replaced by the measured trim at every reset
const SAS={psiRef:0,init:false,intL:-0.385,intR:0.06,intP:0.39,rCmd:0,hold:false,mode:'',refTh:0,refPhi:0,outLon:-0.385,outLat:0.06};
function trimHandover(o){   // from the autopilot's trimmed state
  TRIM.th=S.eul[1];TRIM.phi=S.eul[0];TRIM.lon=o.lon;TRIM.lat=o.lat;TRIM.ped=o.ped;TRIM.col=o.col;TRIM.q=S.eng.Qdrive;
  if(S.ias<20*KT)TRIM.hover={th:TRIM.th,phi:TRIM.phi,lon:TRIM.lon,lat:TRIM.lat};
  SAS.intL=o.lon;SAS.intR=o.lat;SAS.intP=o.ped;SAS.psiRef=S.eul[2];SAS.init=true;SAS.rCmd=0;SAS.hold=true;
  SAS.fwd=S.ias>45*KT;SAS.mode='att';SAS.refTh=TRIM.th;SAS.refPhi=TRIM.phi;SAS.thC=TRIM.th;SAS.phC=TRIM.phi;SAS.outLon=o.lon;SAS.outLat=o.lat;
}
/* Trim to what is commanded now (key T): the attitude the stick holds
   becomes the new centre, the stick goes back to centre, nothing moves. */
function trimSet(){
  // the commanded attitude, not the measured one: the aircraft may still be on its way there
  TRIM.th=SAS.mode==='att'&&SAS.thC!==undefined?SAS.thC:S.eul[1];TRIM.phi=SAS.mode==='att'&&SAS.phC!==undefined?SAS.phC-9.3*DEG*clamp(IN.raw.col-TRIM.col,-0.4,0.4):S.eul[0];TRIM.col=IN.raw.col;TRIM.lon=SAS.outLon;TRIM.lat=SAS.outLat;
  SAS.refTh=TRIM.th;SAS.refPhi=TRIM.phi;SAS.thC=TRIM.th;SAS.phC=TRIM.phi;SAS.intL=SAS.outLon-0.85*S.om[1];SAS.intR=SAS.outLat+0.7*S.om[0];
  if(typeof DEV!=='undefined'){DEV.kbd.lon=DEV.kbd.lat=0;DEV.mouse.vx=DEV.mouse.vy=0;}
}
/* Clear the trim (key Y): back to the hover trim, eased in by the reference rate limit. */
function trimClear(){const h=TRIM.hover||{th:3.6*DEG,phi:4.2*DEG,lon:-0.385,lat:0.01};TRIM.th=h.th;TRIM.phi=h.phi;TRIM.lon=h.lon;TRIM.lat=h.lat;
  if(typeof DEV!=='undefined'){DEV.kbd.lon=DEV.kbd.lat=0;DEV.mouse.vx=DEV.mouse.vy=0;}}
/* Beep trim (Shift + arrows): moves the trim attitude at 3 °/s, as the four-way switch on a cyclic does. */
function trimBeep(dl,dt){TRIM.th=clamp(TRIM.th-dl[0]*3*DEG*dt,-0.4,0.35);TRIM.phi=clamp(TRIM.phi+dl[1]*3*DEG*dt,-0.4,0.4);}
function trimLearn(dt,raw){
  // learn only from an unaccelerated aircraft: slow is not enough, an aircraft that is just pulling away is slow too
  const R=qmat(S.q),vN=mrot(R,S.vb);if(!SAS.vN)SAS.vN=vN.slice();
  const ax=(vN[0]-SAS.vN[0])/dt,ay=(vN[1]-SAS.vN[1])/dt;SAS.vN=vN.slice();SAS.acc=(SAS.acc||0)+(Math.hypot(ax,ay)-(SAS.acc||0))*Math.min(1,dt/1.0);
  const calm=Math.hypot(S.om[0],S.om[1])<4*DEG&&Math.abs(raw.lon)<0.05&&Math.abs(raw.lat)<0.05&&!S.onGround&&SAS.acc<0.08;
  const hover=Math.hypot(S.vb[0],S.vb[1])<1.5;
  if(calm&&(hover||S.ias>30*KT)){const k=Math.min(1,dt/10);TRIM.th+=(S.eul[1]-TRIM.th)*k;TRIM.phi+=(S.eul[0]-TRIM.phi)*k;TRIM.lon+=(SAS.intL-TRIM.lon)*k;TRIM.lat+=(SAS.intR-TRIM.lat)*k;if(Math.abs(raw.ped)<0.04)TRIM.ped+=((SAS.intP||TRIM.ped)-TRIM.ped)*k;
    if(hover&&Math.abs(S.vs)<0.3)TRIM.hover={th:TRIM.th,phi:TRIM.phi,lon:TRIM.lon,lat:TRIM.lat};}   // the hover trim Y returns to
}
function sasApply(dt,raw){
  const [phi,th,psi]=S.eul,[p,q,r]=S.om;
  if(!SAS.init){SAS.psiRef=psi;SAS.init=true;SAS.intL=TRIM.lon;SAS.intR=TRIM.lat;SAS.intP=TRIM.ped;}
  trimLearn(dt,raw);
  let lon=raw.lon,lat=raw.lat,ped=raw.ped;
  /* Which law flies the cyclic. On every change of law the new one starts
     from the stick the old one left (bumpless): the integrator absorbs the
     difference and the attitude reference starts at the present attitude,
     then eases to the trim at 2 °/s. Lift-off, switching aids and taking
     the SAS back on therefore never kick the stick. */
  /* Light on the skids (rotor carries 85 % of the weight) counts as
     airborne for the attitude law: the aircraft finds the hover attitude
     while still pivoting on its skids, left skid up first, the way a
     pilot lifts off, and leaves the ground without a sideways step. */
  const light=S.onGround&&S.rot.T>0.85*S.m*9.81, free=!S.onGround||light;
  const mode=raw.att?'raw':(cfg.hoverAssist&&S.ias<40*KT&&cfg.sas&&free)?'assist':(cfg.sas&&cfg.attHold&&free)?'att':cfg.sas?'damp':'raw';
  if(mode!==SAS.mode){
    if(mode==='att'||mode==='assist'){
      // lift-off (from the ground law) starts at the trim attitude: that is where the aircraft has to hang the moment it is free
      // lift-off: start at the present attitude and roll into the trim at 5 °/s while still pivoting on the skids
      const lift=SAS.mode==='damp';
      SAS.refTh=th;SAS.refPhi=phi;SAS.thC=SAS.refTh;SAS.phC=SAS.refPhi;SAS.intL=SAS.outLon-(mode==='att'?0.85:0.55)*q;SAS.intR=SAS.outLat+(mode==='att'?0.7:0.5)*p;SAS.liftT=lift?0:99;}
    SAS.mode=mode;
  }
  SAS.liftT=(SAS.liftT===undefined?99:SAS.liftT)+dt;
  const ease=(SAS.liftT<3?5:2)*DEG*dt;
  /* Collective-to-roll mixing: more power means more torque, more
     Fenestron thrust to the left, so the aircraft has to hang further
     right to stand still (measured: 9.3° per unit of collective). Many
     helicopters mix this mechanically; here it shifts the attitude the
     centred stick commands. */
  const phMix=9.3*DEG*clamp(raw.col-TRIM.col,-0.4,0.4)*(1-sm(20*KT,45*KT,S.ias));   // a hover effect: in cruise the fin carries the anti-torque
  if(mode==='assist'){
    // stick = wanted ground velocity, ±8 m/s; the SAS flies the attitude around the trim. assistK blends towards the raw stick
    const R=qmat(S.q), vN=mrot(R,S.vb), cps=Math.cos(psi),sps=Math.sin(psi);
    const vx=vN[0]*cps+vN[1]*sps, vy=-vN[0]*sps+vN[1]*cps;
    SAS.refTh=approach(SAS.refTh,TRIM.th,ease);SAS.refPhi=approach(SAS.refPhi,TRIM.phi,ease);
    const thC=clamp(SAS.refTh-0.06*(raw.lon*8-vx),-0.3,0.3), phC=clamp(SAS.refPhi+phMix+0.06*(raw.lat*8-vy),-0.3,0.3);
    SAS.intL=clamp(SAS.intL+(th-thC)*dt*0.5,-0.5,0.5);SAS.intR=clamp(SAS.intR+(phC-phi)*dt*0.5,-0.5,0.5);
    const k=clamp(cfg.assistK===undefined?1:cfg.assistK,0,1);
    lon=lerp(raw.lon+0.35*q+TRIM.lon,2.2*(th-thC)+0.55*q+SAS.intL,k); lat=lerp(raw.lat-0.35*p+TRIM.lat,2.4*(phC-phi)-0.5*p+SAS.intR,k);
  }else if(mode==='att'){
    // attitude command around the trim: full stick = 15° pitch / 20° roll away from it; integrator holds it without error
    SAS.refTh=approach(SAS.refTh,TRIM.th,ease);SAS.refPhi=approach(SAS.refPhi,TRIM.phi,ease);
    /* Command shaping: fine around the centre (10 % stick = 1.5° pitch, 2° bank), steep at the stops
       (full stick = 28° pitch, 40° bank from the trim) so quick stops and steep turns stay flyable with the aid on. */
    /* Cruise heading hold through the roll axis: with the stick centred and
       the wings near the trim attitude, a heading error becomes a small bank
       toward it (at most 6°); the pedal stays on turn coordination. Moving
       the stick sideways flies a turn and the new heading is taken when the
       stick comes back. */
    let phHdg=0;
    if(SAS.fwd&&cfg.hdgHold&&Math.abs(raw.lat)<0.05){
      if(!SAS.holdF&&Math.abs(phi-SAS.refPhi)<3*DEG&&Math.abs(r)<2*DEG){SAS.holdF=true;SAS.psiRefF=psi;}
      if(SAS.holdF)phHdg=clamp(1.0*wrapPi(SAS.psiRefF-psi),-5*DEG,5*DEG);
    }else SAS.holdF=false;
    const thC=clamp(SAS.refTh-(15*raw.lon+13*raw.lon**3)*DEG,-0.55,0.55), phC=clamp(SAS.refPhi+phMix+phHdg+(20*raw.lat+20*raw.lat**3)*DEG,-0.75,0.75);
    /* Anti-wind-up: the integrators trim out steady errors (speed changes
       the trimmed stick a lot) but stop while the command itself moves
       fast (a manoeuvre) or the stick is at its stop. */
    const mvL=Math.abs(thC-(SAS.thC===undefined?thC:SAS.thC))/dt>4*DEG, mvR=Math.abs(phC-(SAS.phC===undefined?phC:SAS.phC))/dt>4*DEG;
    const eL=th-thC, eR=phC-phi;
    if(!mvL&&!(Math.abs(SAS.outLon)>=0.99&&Math.sign(eL)===Math.sign(SAS.outLon)))SAS.intL=clamp(SAS.intL+eL*dt*0.5,light?TRIM.lon-0.12:-1,light?TRIM.lon+0.12:1);
    if(!mvR&&!(Math.abs(SAS.outLat)>=0.99&&Math.sign(eR)===Math.sign(SAS.outLat)))SAS.intR=clamp(SAS.intR+eR*dt*0.5,light?TRIM.lat-0.10:-1,light?TRIM.lat+0.10:1);
    // light on the skids the integrators may lead the stick by a bounded amount, as a pilot's hand does before the aircraft comes free
    lon=2.0*eL+0.85*q+SAS.intL; lat=2.2*eR-0.7*p+SAS.intR;SAS.thC=thC;SAS.phC=phC;     // well damped: no overshoot after a large input
  }else if(mode==='damp'){
    lon=raw.lon+0.35*q+TRIM.lon; lat=raw.lat-0.35*p+TRIM.lat;         // rate damping only; the trim stick is still fed forward
  }else if(!raw.att){
    lon=raw.lon+TRIM.lon; lat=raw.lat+TRIM.lat;                       // no SAS: the stick is where the hand holds it, trim included
  }
  SAS.outLon=sat(lon,1);SAS.outLat=sat(lat,1);
  if(S.onGround&&!light){SAS.intL=TRIM.lon;SAS.intR=TRIM.lat;SAS.intP=TRIM.ped;}   // no wind-up against the skids
  // pedals: the trim pedal is fed forward; heading hold with an integrator when the pedals are centred
  /* Yaw: rate command, heading hold. A pedal key commands a yaw rate that
     builds up over ~0.35 s instead of kicking full pedal; releasing it
     commands zero rate, the loop brakes the turn, and only when the
     aircraft has (almost) stopped is the heading captured and held. The
     heading reference is never taken while the aircraft still turns,
     which is what used to swing the nose back after every release.
     Analog pedals (gamepad, rate keys) pass straight through; the same
     capture applies when they return to centre. Torque anticipation:
     the pedal moves with the collective (0.6 of the lever travel), as a
     pilot's foot does. */
  const dc=raw.col-TRIM.col;let antic=cfg.sas?1.29*dc:0;   // in cruise too: the torque changes there as well (sweep: smallest sideslip with the full term)   // measured equilibrium: 1.29 units of pedal per unit of collective (hover); an aid, so it goes with the SAS
  /* Torque loss (engine failure): the drive torque falls far below what
     the collective asks for; the pedal follows the torque that is really
     there (0.86 of the travel from hover torque to none). */
  if(cfg.sas&&TRIM.q>0&&S.eng.mode!=='twin'){const qExp=TRIM.q*Math.max(0.2,1+1.5*dc),def=Math.min(0,S.eng.Qdrive/qExp-0.85);antic+=0.86*def/0.85;}   // only after a real failure, not at a power limit
  const yc=raw.yawCmd||0, manual=Math.abs(raw.ped)>=0.04;
  const rc0=SAS.rCmd||0, slowing=Math.abs(yc)<Math.abs(rc0)||yc*rc0<0;
  SAS.rCmd=rc0+(yc-rc0)*Math.min(1,dt/(slowing?0.10:0.35));       // start the turn gently, stop it firmly
  /* Forward flight (above 45 kt, back below 35 kt): the yaw axis turns from
     heading hold into turn coordination. The turn rate follows the bank
     (g·tan φ / V), the pedal integrator trims the sideslip to zero, and a
     pedal key asks for 8° of sideslip instead of a yaw rate. */
  if(SAS.fwd===undefined)SAS.fwd=false;
  if(!SAS.fwd&&S.ias>45*KT&&!S.onGround){SAS.fwd=true;SAS.hold=false;}
  if(SAS.fwd&&(S.ias<35*KT||S.onGround)){SAS.fwd=false;SAS.hold=false;SAS.rCmd=0;}
  const va=vsub(S.vb,S.windB),beta=Math.atan2(va[1],Math.max(va[0],1));
  if(manual){SAS.hold=false;SAS.psiRef=psi;ped=SAS.intP+antic+raw.ped-(cfg.sas?0.4:0)*r;}
  else if(SAS.fwd&&cfg.sas){
    const betaC=-Math.sign(yc)*8*DEG, rCo=9.81*Math.tan(clamp(phi,-1.2,1.2))*Math.cos(th)/Math.max(S.tas,15);
    if(!S.onGround)SAS.intP=clamp(SAS.intP+(beta-betaC)*dt*0.8,-0.6,0.9);
    ped=SAS.intP+antic+1.2*(rCo-r)+2.0*(beta-betaC);SAS.psiRef=psi;
  }else{
    let rc=SAS.rCmd;
    if(yc!==0||Math.abs(SAS.rCmd)>2*DEG||S.onGround)SAS.hold=false;
    else if(!SAS.hold&&cfg.hdgHold&&Math.abs(r)<2*DEG){SAS.hold=true;SAS.psiRef=psi;}   // capture where it stopped
    if(SAS.hold){const e=wrapPi(SAS.psiRef-psi);rc=clamp(2.2*e,-10*DEG,10*DEG);SAS.intP=clamp(SAS.intP+e*dt*0.5,-0.6,0.9);}
    const loop=yc!==0||SAS.hold||cfg.sas||Math.abs(SAS.rCmd)>0.2*DEG;          // the keyboard limb closes the rate loop while it commands
    ped=SAS.intP+antic+(loop?1.4*(rc-r):0);
  }
  return {col:raw.col,lon:sat(lon,1),lat:sat(lat,1),ped:sat(ped,1)};
}
