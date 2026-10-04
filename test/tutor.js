/* Tutor regression: an ideal student (simple controllers on the axes the
   lesson hands over) must be able to pass every step within a time
   limit while the locked axes are flown by the tutor's autopilot. */
/* The real code, all of it (test/loadfull.js): the same reset hand-over,
   tutor and control laws as the browser. Only the student is simulated. */
const {loadFull}=require('./loadfull.js');
const E=loadFull();E.WIND.spd=0;E.WIND.turb=0;
const {IN,cfg,AP,TUTOR,LESSONS,tutorStart,tutorStep,tutorNext,step,DT,KT,FT,RAD,DEG,wrapPi,clamp,sat,terrainH,qmat,mrot}=E;
/* ideal student: goal = {alt (m AGL) | land, pos [n,e], hdg (deg), ias (kt), climbTo (ft)} */
const ST={ci:0,ai:0,ei:0};
function student(g,dt){const S=E.S,[phi,th,psi]=S.eul,[p,q,r]=S.om;
  // collective
  if(!TUTOR.lockCol){
    if(g.land){IN.col=S.onGround?0:clamp(0.50-0.08*(S.vs+0.5)+ST.ci,0,1);ST.ci=clamp(ST.ci-(S.vs+0.5)*dt*0.02,-0.3,0.3);}
    else if(g.ias!==undefined){const vsT=clamp(((g.climbTo||500)*FT-S.hAGL)*0.3,-3,4);ST.ci=clamp(ST.ci+(vsT-S.vs)*dt*0.01,-0.3,0.3);IN.col=clamp(0.48+0.04*(vsT-S.vs)+ST.ci,0,1);}
    else{const vsT=clamp((g.alt-S.hAGL)*0.5,-1.5,1.5);ST.ci=clamp(ST.ci+(vsT-S.vs)*dt*0.01,-0.3,0.4);IN.col=clamp(0.50+0.05*(vsT-S.vs)+ST.ci,0,1);}}
  // pedals
  if(!TUTOR.lockPed){const e=wrapPi((g.hdg||0)*DEG-psi);IN.ped=sat(1.6*e-0.7*r+0.45,1);}
  // cyclic: position or speed hold through attitude
  if(!TUTOR.lockLon||!TUTOR.lockLat){let thC,phC;
    if(g.follow&&TUTOR.target)g={pos:TUTOR.target};
    if(g.att){thC=(g.att.th||0)*DEG;phC=(g.att.phi||0)*DEG;ST.ai=clamp(ST.ai+(th-thC)*dt*0.4,-0.3,0.3);}
    else if(g.ias!==undefined){const u=S.vb[0];thC=clamp(-0.05*(g.ias*KT-u)-ST.ai,-0.3,0.25);ST.ai=clamp(ST.ai+(g.ias*KT-u)*dt*0.01,-0.2,0.2);
      const vyT=g.track?clamp(-S.pos[1]*0.2,-5,5):0;phC=clamp(0.05*(vyT-S.vb[1])+(g.hdg!==undefined?0.6*wrapPi(g.hdg*DEG-psi):0),-0.4,0.4);}
    else{const R=qmat(S.q),vN=mrot(R,S.vb);const pos=g.pos||[0,0];const vNc=clamp((pos[0]-S.pos[0])*0.35,-4,4),vEc=clamp((pos[1]-S.pos[1])*0.35,-4,4);
      const cps=Math.cos(psi),sps=Math.sin(psi);const evx=(vNc-vN[0])*cps+(vEc-vN[1])*sps,evy=-(vNc-vN[0])*sps+(vEc-vN[1])*cps;
      ST.ai=clamp(ST.ai+evx*dt*0.004,-0.12,0.12);ST.ei=clamp(ST.ei+evy*dt*0.004,-0.12,0.12);thC=clamp(-0.06*evx-ST.ai,-0.3,0.3);phC=clamp(0.06*evy+ST.ei,-0.3,0.3);}
    /* a hand knows where the stick sits in the hover: trim feed-forward plus its own slow integrator */
    if(g.ias===undefined&&!g.att){thC+=E.TRIM.th;phC+=E.TRIM.phi;}
    ST.li=clamp((ST.li||0)+(th-thC)*dt*0.8,-1,1);ST.ri=clamp((ST.ri||0)+(phC-phi)*dt*0.8,-1,1);
    if(!TUTOR.lockLon)IN.lon=sat(E.TRIM.lon+ST.li+2.2*(th-thC)+0.55*q,1);if(!TUTOR.lockLat)IN.lat=sat(E.TRIM.lat+ST.ri+2.4*(phC-phi)-0.5*p,1);}
}
const GOALS={
  'The collective':[{alt:3},{alt:3},{alt:3},{alt:10,then:{alt:3}},{land:true}],
  'The pedals':[{hdg:90},{hdg:270},{hdg:0}],
  'Calm hover':[{hands:true},{nudge:[0.2,0]},{pos:[0,0]},{pos:[0,0]}],
  'Why the stick is hard':[{manual:true},{manual:true},{demo:true},{att:{th:-5}},{att:{th:5}},{att:{th:3}}],
  'One axis: fore and aft':[{pos:[0,0]},{pos:[25,0]},{pos:[0,0]}],
  'One axis: sideways':[{pos:[0,0]},{pos:[0,20],then:{pos:[0,0]}}],
  'Both axes as attitude':[{pos:[0,0]},{follow:true},{pos:[0,0]}],
  'The stick as velocity':[{pos:[25,0]},{pos:[0,0]},{pos:[0,0]},{pos:[25,0],then:{pos:[0,0]}}],
  'The raw stick':[{pos:[0,0]},{pos:[0,0]},{pos:[0,0]},{pos:[25,0]},{pos:[0,0]}],
  'All together':[{alt:3,pos:[0,0]},{land:true,pos:[0,0]}],
  'Transition to forward flight':[{ias:60,climbTo:350},{ias:60,climbTo:500},{ias:60,climbTo:500,hdg:180}],
  'Approach and landing':[{ias:40,climbTo:200,hdg:0,track:true},{alt:3,pos:[0,0]},{land:true,pos:[0,0]}],
};
let fail=0;
for(let li=1;li<LESSONS.length;li++){
  tutorStart(li);ST.li=ST.ri=0;const L=LESSONS[li];console.log(`■ ${L.title}`);
  const goals=GOALS[L.title];if(!goals){console.log('  ERROR no goals for lesson');fail++;continue;}
  for(let si=0;si<L.steps.length;si++){
    if(TUTOR.si!==si){console.log(`  ERROR expected step ${si}, tutor is at ${TUTOR.si}`);fail++;break;}
    let g=goals[si]||{},t=0,limit=L.title.startsWith('Transition')||L.title.startsWith('Approach')?120:60;ST.ci=ST.ai=ST.ei=0;
    if(g.manual){tutorNext();console.log(`  OK    step ${si+1}: manual`);continue;}
    if(g.hands||g.nudge){/* hands-off or a scripted nudge through the SAS */E.SAS.init=false;}
    const t0=E.S.t;
    while(TUTOR.si===si&&!TUTOR.lessonDone&&t<limit){
      if(g.then&&TUTOR.flag)g=g.then;
      if(g.hands||g.nudge){const raw={col:IN.col,lon:(g.nudge&&t>0.5&&t<1.3)?g.nudge[0]:0,lat:0,ped:0,att:false};const o=E.sasApply(DT,raw);IN.lon=o.lon;IN.lat=o.lat;IN.ped=o.ped;}
      else if(!g.demo)student(g,DT);tutorStep(DT);step(DT);t+=DT;
      if(process.env.TRACE&&L.title===process.env.TRACE&&si===+(process.env.STEP||0)&&Math.round(t/DT)%720===0){const S=E.S;console.log(`    t ${t.toFixed(0)} N ${S.pos[0].toFixed(1)} E ${S.pos[1].toFixed(1)} vb ${S.vb[0].toFixed(2)} ${S.vb[1].toFixed(2)} th ${(S.eul[1]*RAD).toFixed(1)} phi ${(S.eul[0]*RAD).toFixed(1)} lon ${IN.lon.toFixed(2)} lat ${IN.lat.toFixed(2)} apE ${E.AP.posE} hold ${TUTOR.hold.toFixed(1)}`);}
      if(L.title.startsWith('Approach')&&si===0){/* approach: descend toward the pad */ g.climbTo=Math.max(60,Math.hypot(E.S.pos[0],E.S.pos[1])*0.11/FT);}
    }
    const ok=TUTOR.si!==si||TUTOR.lessonDone;
    console.log(`  ${ok?'OK   ':'ERROR'} step ${si+1}: ${(t).toFixed(1)} s  (agl ${E.S.hAGL.toFixed(1)} m, ias ${(E.S.ias/KT).toFixed(0)} kt, hdg ${(E.S.eul[2]*RAD).toFixed(0)}, d ${Math.hypot(E.S.pos[0],E.S.pos[1]).toFixed(1)} m${E.S.crash?', CRASH '+E.S.crash:''})`);
    if(!ok){fail++;break;}
  }
}
console.log(fail?`${fail} step(s) not passable`:'all tutor steps passable');process.exit(fail?1:0);
