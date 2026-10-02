/* ═══════════════ UI, EXERCISES, MAIN LOOP ═══════════════ */
const UI={paused:false,phantom:null,ex:null,exT:0,acc:0,last:0,fps:0,briefing:''};
const EXERCISES={
  free:{name:['Freier Flug (getrimmte Schwebe)','Free flight (trimmed hover)'],reset:'hover',brief:['Du übernimmst eine getrimmte Schwebe in 3 m: Knüppel, Pedal und Kollektiv stehen richtig, die Lagehaltung hält die Lage. Erst nur zusehen, dann kleine Tipps. Der Coach sagt dir, was fehlt.','You take over a trimmed hover at 3 m: stick, pedal and collective are right, the attitude hold keeps the attitude. Watch first, then small nudges. The coach tells you what is missing.']},
  pad:{name:['Vom Pad abheben','Lift off from the pad'],reset:'pad',brief:['Rotor auf 100 %, Kufen auf dem Pad. Kollektiv langsam heben (W oder Mausrad); die Lagehaltung übernimmt die Trimmlage beim Abheben. Driftpfeil im Kreis halten.','Rotor at 100 %, skids on the pad. Raise the collective slowly (W or wheel); the attitude hold takes the trim attitude as you lift. Keep the drift arrow in the circle.']},
  cold:{name:['Kaltstart','Cold start'],reset:'cold',brief:['Rotor steht, Blätter hängen auf den Anschlägen. E startet beide Triebwerke: Anlasser 25 s, dann läuft die FADEC den Rotor in etwa 40 s hoch. E noch einmal stellt ab. Kollektiv bleibt unten, bis NR im grünen Bereich ist.','Rotor stopped, blades drooped on the stops. E starts both engines: the starter needs 25 s, then the FADEC runs the rotor up over about 40 s. E again shuts down. Collective stays flat until NR is in the green.']},
  hover:{name:['Schweben über dem Pad','Hover over the pad'],reset:'hover',phantom:'hover',target:[0,0,3],brief:['Halte 3 m über dem H, Nase nach Norden. Das Phantom schwebt 20 m rechts von dir als Referenz. Schau auf den Driftpfeil, nicht auf den Horizont.','Hold 3 m over the H, heading north. The phantom hovers 20 m to your right as a reference. Watch the drift vector, not the horizon.']},
  pedal:{name:['Pedaldrehungen','Pedal turns'],reset:'hover',brief:['Aus der Schwebe eine volle Drehung links und eine rechts mit 15 °/s. Das Kollektiv wandert mit dem Pedal: rechtes Pedal nimmt Leistung, linkes gibt sie zurück.','From the hover, a full turn left and a full turn right at 15 °/s. The collective moves with the pedal: right pedal takes power, left pedal gives it back.']},
  quick:{name:['Quick Stop','Quick stop'],reset:'approach',brief:['Aus 70 kt in 500 ft in die Schwebe bremsen, ohne zu steigen: Knüppel zurück und Kollektiv runter zusammen, dann Kollektiv wieder rein, wenn die Fahrt weg ist. Achte auf das Heck.','From 70 kt at 500 ft, decelerate to a hover without climbing: aft cyclic and collective down together, then collective back in as the airspeed bleeds off. Watch the tail.']},
  slope:{name:['Hanglandung','Slope landing'],reset:'hover',target:[0,150,0],brief:['Der Hügel 150 m östlich hat 8° Flanken. Quer zum Hang landen: bergseitige Kufe zuerst, Knüppel in den Hang, während das Kollektiv kommt. Jenseits des kritischen Winkels ist der Knüppel am Anschlag.','The mound 150 m east has 8° flanks. Land across the slope: upslope skid first, cyclic into the slope as the collective comes down. Beyond the critical angle the cyclic runs out.']},
  roof:{name:['Dachlandeplatz','Rooftop pad'],reset:'approach',target:[-260,-420,3],brief:['Das Krankenhaus-Pad, 22 m hoch, 500 m südwestlich des Platzes. Im kurzen Endanflug keine Bodentextur unter der Nase: flieg den Anflug auf die Pad-Markierung und die Randfeuer, und halte einen Fluchtweg offen, bis die Kufen im Ring sind.','The hospital pad, 22 m up at 500 m south-west of the field. No ground texture under the nose on short final: fly the approach on the pad markings and the perimeter lights, and keep an escape route until the skids are inside the ring.']},
  confined:{name:['Confined Area','Confined area'],reset:'approach',brief:['Der Baumring 340 m südöstlich. Ein steiler Anflug hinein braucht Leistung im Bodeneffekt, die er nicht haben wird; plane den Abbruch, bevor du dich festlegst.','The tree ring at 340 m to the south-east. A steep approach into it needs power in ground effect it will not have; plan the escape before committing.']},
  auto:{name:['Autorotation','Autorotation'],reset:'high',trigger:'engfail',brief:['Zehn Sekunden nach dem Reset fallen beide Triebwerke aus. Kollektiv sofort runter, 65–70 kt, NR im grünen Bereich. Abfangen bei 100 ft, Lage waagerecht, mit dem Rest der Rotorenergie abfedern.','Both engines fail ten seconds after the reset. Collective down at once, 65-70 kt, NR in the green. Flare at 100 ft, level, cushion with the last of the rotor energy.']},
  vrs:{name:['Wirbelringzustand','Vortex ring state'],reset:'high',brief:['Unter 15 kt verlangsamen und mit Leistung mehr als 800 fpm sinken lassen. Wenn die VRS-Lampe kommt: rausfliegen, Knüppel in eine seitliche oder Vorwärtsbewegung (Vuichard: rechts mit linkem Pedal), nicht mehr Kollektiv.','Slow to below 15 kt and let the sink pass 800 fpm with power on. When the VRS lamp comes on, fly out: cyclic into a sideways or forward translation (Vuichard: right cyclic with left pedal), not more collective.']},
  approach:{name:['Anflug mit dem Phantom','Approach with the phantom'],reset:'approach',phantom:'approach',brief:['Das Phantom fliegt einen 6°-Anflug zum Pad und endet in der Schwebe. Flieg Formation. Es weiß, wo beim Translational Lift die Leistung reinkommt.','The phantom flies a 6° approach to the pad and terminates in a hover. Fly formation on it. It knows where the power comes in at translational lift.']},
  oei:{name:['Triebwerksausfall in der Schwebe','Engine failure in the hover'],reset:'hover',trigger:'oei',brief:['Fünf Sekunden nach dem Reset fällt ein Triebwerk aus. Das verbleibende hat eine 30-Sekunden-Grenze; die FLI-Skala wechselt auf OEI. Nase runter, NR halten, landen oder wegfliegen.','One engine quits five seconds after the reset. The remaining engine has a 30-second rating; FLI scale changes to OEI. Lower the nose, keep NR, land or fly away.']},
};
const PANEL_DE={'Coach':'Coach','K cycles':'K schaltet um','Off':'Aus','Cues':'Hinweise','Cues + voice':'Hinweise + Stimme','Tutor':'Tutor','Exercise':'Übung','Last 20 s':'Letzte 20 s','Reset':'Reset','Engines':'Triebwerke','Last incident':'Letzter Vorfall','Start lesson':'Lektion starten','Stop':'Stopp','Cold':'Kalt','Pad':'Pad','Hover':'Hover','1000 ft':'1000 ft','Cruise':'Reise','Fail 1  G':'Ausfall 1  G','Fail both':'Beide aus','Restore':'Reparieren','CSV':'CSV','Replay  L':'Replay  L','X exports CSV':'X exportiert CSV','R repeats':'R wiederholt','N next · B back · Q':'N weiter · B zurück · Q'};
function applyLang(){
  const de=cfg.lang==='de';
  document.querySelectorAll('#hud .eyebrow span, #hud button').forEach(el=>{if(!el.dataset.en)el.dataset.en=el.textContent;el.textContent=de?(PANEL_DE[el.dataset.en]||el.dataset.en):el.dataset.en;});
  const ex=document.getElementById('exercise');if(ex)for(const op of ex.options)op.textContent=T_(EXERCISES[op.value].name[0],EXERCISES[op.value].name[1]);
  const ts=document.getElementById('tutorSel');if(ts)LESSONS.forEach((L,i)=>{ts.options[i].textContent=(i+1)+' · '+T_(L.title[0],L.title[1]);});
  const b=document.getElementById('brief');if(b&&EXERCISES[UI.ex])b.textContent=T_(EXERCISES[UI.ex].brief[0],EXERCISES[UI.ex].brief[1]);
  const k=document.getElementById('keys');if(k)k.innerHTML=de?'Tasten und Geräte: siehe <b>Setup</b> (rechts unten in der Sicht)':'Keys and devices: see <b>Setup</b> (bottom right of the view)';
}
const SETUP=[
  ['Aircraft',[
    ['mass','Mass','range',1800,2910,10,'kg'],['cgx','CG offset','range',-0.15,0.15,0.01,'m'],['dT','ISA deviation','range',-20,35,1,'°C'],
  ]],
  ['Wind',[
    ['wdir','From','range',0,359,5,'°'],['wspd','Speed','range',0,35,1,'kt'],['wturb','Turbulence','range',0,3,0.25,''],['wgust','Gusts','range',0,20,1,'kt'],
  ]],
  ['Stability aids',[
    ['coach','Coach: correction cues  K','check'],['coachVoice','Coach voice (speech)','check'],['sas','SAS rate damping + trim feedforward','check'],['attHold','Attitude command around trim (centred stick = calm)','check'],['hdgHold','Heading hold (pedals centred)','check'],['hoverAssist','Hover assist (stick = velocity)  H','check'],
  ]],
  ['Input models',[
    ['kbdCol','Collective keys W/S','select',['metered','rate']],['kbdPed','Pedal keys A/D','select',['heading','rate']],['pedRate','Yaw rate per pedal key','range',10,45,5,'°/s'],
    ['mouse','Mouse cyclic','check'],['mouseButtons','Mouse buttons = pedals','check'],['mouseTravel','Mouse travel (px for full stick)','range',300,2500,100,'px'],
  ]],
  ['Keys',[['keys','Mouse: click into the view to capture it as the stick, Esc releases · mouse buttons = pedals · hold C or the middle button to look around · wheel or W S collective · A D pedals · arrows stick · T trim to the present attitude · Shift + arrows beep trim · Y back to the hover trim · H hover assist · V autopilot demo · K coach · L replay · X CSV · E engines · G engine failure · R reset · 1 2 3 views · F flight path marker · P pause · N B Q tutor · ? key list','note']]],
  ['Gamepad / joystick',[
    ['padMap','Preset','select',['gamepad','joystick','custom']],['padDead','Stick dead zone','range',0,0.2,0.01,''],['padPanel','','pad'],
  ]],
  ['View',[
    ['lang','Tutor language','select',['de','en']],['view','Camera  1/2/3','select',['cockpit','chase','tower']],['cloud','Cloud cover','range',0,1,0.1,''],['hud','HUD','check'],['rotorDisc','Rotor-state map','check'],['fpm','Flight path marker  F','check'],['sound','Sound','check'],
  ]],
];
function cfgGet(k){if(k==='coach')return COACH.on;if(k==='coachVoice')return COACH.voice;if(k==='wdir')return WIND.dir;if(k==='wspd')return WIND.spd;if(k==='wturb')return WIND.turb;if(k==='wgust')return WIND.gust;if(k==='padMap')return DEV.padMap;if(k==='padDead')return cfg.padDead;return cfg[k];}
function cfgSet(k,v){if(k==='coach'){coachSet(v?(COACH.voice?'voice':'cues'):'off');return;}if(k==='coachVoice'){coachSet(v?'voice':(COACH.on?'cues':'off'));return;}if(k==='wdir')WIND.dir=v;else if(k==='wspd')WIND.spd=v;else if(k==='wturb')WIND.turb=v;else if(k==='wgust')WIND.gust=v;else if(k==='padMap'){DEV.padMap=v;if(v!=='custom')padPreset(v);else padSave();}else if(k==='padDead'){cfg.padDead=v;padSave();}else cfg[k]=v;
  if(k==='view')setView(v);
  if(k==='lang')applyLang();}
function setView(v){cfg.view=v;R3.cam.chasePos=null;uiSync();}
function buildSetup(){
  const root=document.getElementById('setupBody');root.innerHTML='';
  for(const [title,items] of SETUP){
    const h=document.createElement('div');h.className='sec';h.textContent=title;root.appendChild(h);
    for(const it of items){
      const [k,label,type]=it;const row=document.createElement('label');row.className='row';
      const sp=document.createElement('span');sp.textContent=label;row.appendChild(sp);
      let inp;
      if(type==='note'){row.className='note';sp.textContent=label;root.appendChild(row);continue;}
      if(type==='pad'){const d=document.createElement('div');d.id='padPanel';root.appendChild(d);padPanelBuild(d);continue;}
      if(type==='range'){inp=document.createElement('input');inp.type='range';inp.min=it[3];inp.max=it[4];inp.step=it[5];inp.value=cfgGet(k);const val=document.createElement('b');val.className='data';val.textContent=cfgGet(k)+' '+it[6];
        inp.oninput=()=>{cfgSet(k,parseFloat(inp.value));val.textContent=inp.value+' '+it[6];};row.appendChild(inp);row.appendChild(val);}
      else if(type==='check'){inp=document.createElement('input');inp.type='checkbox';inp.checked=!!cfgGet(k);inp.onchange=()=>cfgSet(k,inp.checked);row.appendChild(inp);}
      else{inp=document.createElement('select');for(const o of it[3]){const op=document.createElement('option');op.value=o;op.textContent=o;inp.appendChild(op);}inp.value=cfgGet(k);inp.onchange=()=>cfgSet(k,inp.value);row.appendChild(inp);}
      inp.dataset.key=k;root.appendChild(row);
    }
  }
  const ex=document.getElementById('exercise');ex.innerHTML='';for(const k in EXERCISES){const op=document.createElement('option');op.value=k;op.textContent=T_(EXERCISES[k].name[0],EXERCISES[k].name[1]);ex.appendChild(op);}
  ex.onchange=()=>{startExercise(ex.value);ex.blur();};
}
function uiSync(){document.querySelectorAll('#setupBody [data-key]').forEach(el=>{const k=el.dataset.key;if(el.type==='checkbox')el.checked=!!cfgGet(k);else el.value=cfgGet(k);});}
/* The autopilot trims the aircraft in fast time and hands it over: every
   airborne reset starts calm, with stick, pedal and collective at trim. */
function trimNow(sec){
  S.alt=-S.pos[2];S.eul=qtoEuler(S.q);const v=vlen(S.vb);const hover=v<30*KT;AP.on=true;AP.auto=false;AP.mode=hover?'hover':'cruise';AP.ias=v/KT;AP.posN=hover?S.pos[0]:null;AP.posE=hover?S.pos[1]:null;AP.alt=S.alt;AP.hdg=S.eul[2];AP.vN=0;AP.vE=0;for(const k in AP.int)AP.int[k]=0;AP.pOnly=false;AP.freezeInt=false;
  /* Position hold first, then pure velocity hold until the aircraft is
     really still: the integrators then hold exactly the zero-acceleration
     trim, which is what gets handed over. */
  let o;for(let t=0;t<(sec||8);t+=DT){o=apStep(DT);IN.col=o.col;IN.lon=o.lon;IN.lat=o.lat;IN.ped=o.ped;step(DT);}
  if(hover){for(let t=0;t<20;t+=DT){o=apStep(DT);IN.col=o.col;IN.lon=o.lon;IN.lat=o.lat;IN.ped=o.ped;step(DT);   // keep holding the spot until still and back on it
    if(t>4&&Math.hypot(S.vb[0],S.vb[1])<0.03&&Math.abs(S.vs)<0.03&&vlen(S.om)<0.2*DEG&&Math.hypot(S.pos[0]-AP.posN,S.pos[1]-AP.posE)<0.3)break;}}
  AP.on=false;AP.posN=AP.posE=null;trimHandover(o);DEV.kbd.col=o.col;DEV.kbd.psiRef=S.eul[2];DEV.kbd.ped=0;DEV.kbd.lon=DEV.kbd.lat=0;IN.trimLon=IN.trimLat=IN.trimPed=0;
  if(COACH.ap){COACH.trimTh=S.eul[1];COACH.trimPhi=S.eul[0];}S.log=[];S.t=0;S.logT=0;
}
function uiReset(kind){reset(kind);SAS.init=false;if(HUD.aoaMap)HUD.aoaMap.fill(NaN);SCORE.n=0;SCORE.sum=0;SCORE.max=0;SCORE.hsum=0;const sc=document.getElementById('score');if(sc)sc.textContent='';DEV.kbd.col=IN.col;DEV.kbd.psiRef=S.eul[2];DEV.kbd.lon=DEV.kbd.lat=DEV.kbd.ped=0;R3.cam.chasePos=null;HUD.incText='';for(const k in INC_LAST)delete INC_LAST[k];
  if(kind!=='pad'&&kind!=='cold')trimNow(8);
  else{/* on the ground: find the hover trim for this mass, CG and wind in fast time at 3 m,
          then put the aircraft back on the pad. Lift-off then starts with the right stick. */
    const keepC=IN.col;reset('hover');trimNow(6);reset(kind);SAS.init=false;SAS.mode='';IN.col=keepC;DEV.kbd.col=IN.col;DEV.kbd.psiRef=S.eul[2];S.log=[];}}
function startExercise(key){
  const ex=EXERCISES[key];UI.ex=key;UI.exT=0;UI.trig=false;cfg.resetKind=ex.reset;if(TUTOR.on)tutorStop();uiReset(ex.reset);
  document.getElementById('brief').textContent=T_(ex.brief[0],ex.brief[1]);
  UI.phantom=null;
  if(ex.phantom){const P={S:null,ap:null,in:{col:0.5,lon:0,lat:0,ped:0},kind:ex.phantom};
    const keep=S;
    if(ex.phantom==='hover'){placeAt(0,20,3,0,0);}else{placeAt(-1100,0,600*FT,0,70);}
    P.S=S;P.S.phantom=true;S=keep;
    P.ap={on:true,mode:ex.phantom==='hover'?'hover':'cruise',vN:0,vE:0,ias:70,alt:-P.S.pos[2],vs:0,hdg:0,auto:false,int:{lon:0,lat:0,col:0,ped:0,attL:0,attR:0},out:{col:0.5,lon:0,lat:0,ped:0}};
    UI.phantom=P;}
}
/* The phantom is a second aircraft flown by the autopilot through the
   same physics. It borrows the globals for one step at a time. */
function phantomStep(dt){
  const P=UI.phantom;if(!P||!P.S)return;
  const keepS=S,keepIn={col:IN.col,lon:IN.lon,lat:IN.lat,ped:IN.ped},keepAp={};for(const k in AP)keepAp[k]=AP[k];
  S=P.S;Object.assign(AP,P.ap);IN.col=P.in.col;IN.lon=P.in.lon;IN.lat=P.in.lat;IN.ped=P.in.ped;
  // approach script: 6° slope to the pad, then a hover at 3 m
  if(P.kind==='approach'){const dist=Math.hypot(S.pos[0],S.pos[1]);const slope=Math.tan(6*DEG);
    if(dist>60){AP.mode='cruise';AP.ias=clamp(dist/12,25,70);AP.alt=null;AP.vs=-(AP.ias*KT)*slope*0.95;if(S.hAGL<dist*slope*0.5)AP.vs=0;}
    else{AP.mode='hover';AP.vN=-S.pos[0]*0.25;AP.vE=-S.pos[1]*0.25;AP.alt=terrainH(0,0)+3+1.3;AP.hdg=0;}}
  const o=apStep(dt);IN.col=o.col;IN.lon=o.lon;IN.lat=o.lat;IN.ped=o.ped;
  step(dt);
  P.in={col:IN.col,lon:IN.lon,lat:IN.lat,ped:IN.ped};for(const k in AP)P.ap[k]=AP[k];
  S=keepS;Object.assign(AP,keepAp);IN.col=keepIn.col;IN.lon=keepIn.lon;IN.lat=keepIn.lat;IN.ped=keepIn.ped;
}
/* V: the autopilot takes the aircraft and holds the hover (or the cruise
   above 40 kt); the student watches the controls move, then takes it back
   with V. A demonstration, not an aid: the SAS settings stay as they are. */
function apDemoToggle(){UI.apDemo=!UI.apDemo;if(UI.apDemo){AP.on=true;AP.auto=false;AP.mode=S.ias>40*KT?'cruise':'hover';AP.ias=S.ias/KT;AP.posN=AP.mode==='hover'?S.pos[0]:null;AP.posE=AP.mode==='hover'?S.pos[1]:null;AP.alt=S.alt;AP.hdg=S.eul[2];apBumpless(AP);}
  else{if(!TUTOR.on){AP.on=false;AP.posN=AP.posE=null;}trimHandover(AP.out);DEV.kbd.col=IN.col;DEV.kbd.psiRef=S.eul[2];}}
function apDemoStep(dt){if(!UI.apDemo||TUTOR.on)return;const o=apStep(dt);IN.col=o.col;IN.lon=o.lon;IN.lat=o.lat;IN.ped=o.ped;}
function engineFailure(kind){if(kind==='restore'){for(const en of S.eng.e){en.fail=false;en.on=true;}return;}
  if(kind==='both'){for(const en of S.eng.e)en.fail=true;return;}
  const en=S.eng.e.find(e=>!e.fail);if(en)en.fail=true;}
function downloadCSV(){const csv=exportCSV();if(!csv)return;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='ec135-flight-dynamics-log.csv';a.click();}
function loop(now){
  requestAnimationFrame(loop);
  let dtF=Math.min(0.1,(now-UI.last)/1000||0);UI.last=now;
  if(!UI.paused&&!UI.freeze){   // UI.freeze: still frame without the pause text (screenshots)
    inputStep(dtF);tutorStep(dtF);apDemoStep(dtF);coachStep(dtF);
    UI.acc+=dtF;let n=0;
    while(UI.acc>=DT&&n<60){step(DT);phantomStep(DT);UI.acc-=DT;n++;}
    UI.exT+=dtF;
    const ex=EXERCISES[UI.ex];
    if(ex&&ex.trigger==='engfail'&&UI.exT>10&&!UI.trig){UI.trig=true;engineFailure('both');}
    if(ex&&ex.trigger==='oei'&&UI.exT>5&&!UI.trig){UI.trig=true;engineFailure('one');}
  }
  replayFrame(dtF);
  render(dtF);hudDraw(dtF);soundUpdate(dtF);
  sideUpdate(dtF);
  replayAfter();
}
/* Score: position hold against the exercise target over the last 30 s. */
const SCORE={n:0,sum:0,max:0,hsum:0};
function scoreUpdate(dtF){
  const ex=EXERCISES[UI.ex];if(!ex||!ex.target){return;}
  const t=ex.target,d=Math.hypot(S.pos[0]-t[0],S.pos[1]-t[1],(S.hAGL)-t[2]);
  const h=Math.abs(wrapPi(S.eul[2]))*RAD;
  SCORE.n++;SCORE.sum+=d;SCORE.max=Math.max(SCORE.max,d);SCORE.hsum+=h;
  if(SCORE.n>1800){SCORE.n*=0.5;SCORE.sum*=0.5;SCORE.hsum*=0.5;}   // ~30 s memory
  document.getElementById('score').textContent=`hold: mean ${(SCORE.sum/SCORE.n).toFixed(1)} m, max ${SCORE.max.toFixed(1)} m, heading ±${(SCORE.hsum/SCORE.n).toFixed(0)}°`;
}
/* Strip chart of the 20 s log: the logger of the rally sim, for the rotor. */
function chartDraw(){
  const c=document.getElementById('chart');if(!c)return;const x=c.getContext('2d');const W=c.width,Hh=c.height;
  x.fillStyle='#0d0c0a';x.fillRect(0,0,W,Hh);const L=S.log;if(L.length<2)return;
  const n=L.length,t0=L[0].t,t1=L[n-1].t,dtT=Math.max(t1-t0,1);
  const trace=(key,lo,hi,col,label,dy)=>{x.strokeStyle=col;x.lineWidth=1.2;x.beginPath();for(let i=0;i<n;i++){const px=(L[i].t-t0)/dtT*W,py=Hh-(clamp(L[i][key],lo,hi)-lo)/(hi-lo)*(Hh-14)-2;if(i)x.lineTo(px,py);else x.moveTo(px,py);}x.stroke();x.fillStyle=col;x.font='10px Arial Narrow,sans-serif';x.fillText(label,4,dy);};
  trace('nr',88,112,'#e8e2d6','NR 88-112',10);trace('fli',0,12.5,'#ffb300','FLI 0-12.5',20);trace('vs',-2000,2000,'#6fd3e0','V/S ±2000',30);trace('vrs',0,1,'#ff3b1f','VRS',40);trace('stall',0,1,'#ff8a3b','stall',50);
  if(S.incident&&S.incident.t>=t0){const px=(S.incident.t-t0)/dtT*W;x.strokeStyle='#ff3b1f';x.setLineDash([3,3]);x.beginPath();x.moveTo(px,0);x.lineTo(px,Hh);x.stroke();x.setLineDash([]);}
  if(S.logFreeze>0){x.fillStyle='#ffb300';x.fillText('frozen for review',W-88,10);}
  if(REPLAY.on){const px=(REPLAY.log[REPLAY.i].t-t0)/dtT*W;x.strokeStyle='#ffb300';x.beginPath();x.moveTo(px,0);x.lineTo(px,Hh);x.stroke();}
}
/* Debrief: when the aircraft has been airborne in an exercise and sits on
   the ground again for three seconds, the numbers that matter appear once. */
function debriefCheck(dtF){
  if(TUTOR.on||REPLAY.on)return;
  if(!S.onGround||S.stats.air<5){UI.debriefT=0;if(!S.onGround)UI.debriefShown=false;return;}
  UI.debriefT=(UI.debriefT||0)+dtF;
  if(UI.debriefT>3&&!UI.debriefShown){UI.debriefShown=true;const st=S.stats,ex=EXERCISES[UI.ex];
    const tgt=ex&&ex.target?Math.hypot(S.pos[0]-ex.target[0],S.pos[1]-ex.target[1]):null;
    const de=cfg.lang==='de';
    const rows=[[de?'Flugzeit':'Airborne',`${st.air.toFixed(0)} s`],[de?'Aufsetzen':'Touchdown',`${(st.touchVs/FPM).toFixed(0)} fpm${st.touchVs>H.gear.hardVs?(de?' – hart':' – hard'):''}`],
      tgt!==null?[de?'Abstand zum Ziel':'Distance to target',`${tgt.toFixed(1)} m`]:null,[de?'Max FLI':'Max FLI',st.maxFli.toFixed(1)],[de?'NR min / max':'NR min / max',`${st.minNr.toFixed(0)} / ${st.maxNr.toFixed(0)} %`],
      [de?'Max Fahrt / Schräglage':'Max speed / bank',`${(st.maxIas/KT).toFixed(0)} kt / ${(st.maxBank*RAD).toFixed(0)}°`],[de?'Vorfälle':'Incidents',String(st.incidents)]].filter(Boolean);
    UI.debrief={t:S.t,rows,title:de?'Debriefing':'Debrief'};S.stats={air:0,maxFli:0,minNr:200,maxNr:0,maxIas:0,maxBank:0,maxSink:0,touchVs:0,landings:0,incidents:0};}
}
/* Gamepad test panel: every axis of every connected device as a bar, the
   buttons as dots, the mapping per function with a learn button. */
const PAD_FN=[['lat','Knüppel quer','Cyclic lateral','nach rechts','to the right'],['lon','Knüppel längs','Cyclic fore/aft','nach vorn','forward'],['ped','Pedale','Pedals','rechtes Pedal','right pedal'],['col','Kollektiv','Collective','nach oben','up']];
function padPanelBuild(root){
  root.innerHTML='';const st=document.createElement('div');st.id='padStatus';st.className='note';root.appendChild(st);
  const cv=document.createElement('canvas');cv.id='padCanvas';cv.width=262;cv.height=110;cv.style.cssText='width:100%;height:110px;background:#0d0c0a;display:block;margin:4px 0';root.appendChild(cv);
  for(const [f] of PAD_FN){const row=document.createElement('div');row.className='row';row.innerHTML=`<span id="padLbl_${f}"></span><b id="padMap_${f}" style="width:auto;flex:1;text-align:left;color:var(--ink)"></b>`;
    const b=document.createElement('button');b.id='padLearn_'+f;b.onclick=()=>{padLearnStart(f);b.blur();};row.appendChild(b);root.appendChild(row);}
}
function padPanelUpdate(){
  const de=cfg.lang==='de',el=id=>document.getElementById(id);const st=el('padStatus');if(!st)return;
  const pads=PAD.pads.filter(p=>p&&p.connected);
  st.textContent=PAD.blocked?(de?'Gamepad-Zugriff ist in diesem eingebetteten Fenster gesperrt – Datei herunterladen und lokal im Browser öffnen.':'Gamepad access is blocked in this embedded frame – download the file and open it locally in the browser.')
    :!pads.length?(de?'Kein Gerät erkannt. Anschließen (Kabel oder Dongle) und einmal eine Taste drücken.':'No device found. Connect it (cable or dongle) and press any button once.')
    :PAD.learn?(de?`Jetzt ${PAD_FN.find(x=>x[0]===PAD.learn.f)[1]} kräftig ${PAD_FN.find(x=>x[0]===PAD.learn.f)[3]} bewegen …`:`Now move the ${PAD_FN.find(x=>x[0]===PAD.learn.f)[2].toLowerCase()} firmly ${PAD_FN.find(x=>x[0]===PAD.learn.f)[4]} …`)
    :pads.map(p=>`${p.index}: ${p.id.slice(0,38)} (${p.mapping||'raw'})`).join(' · ');
  const cv=el('padCanvas');if(cv){const x=cv.getContext('2d');x.fillStyle='#0d0c0a';x.fillRect(0,0,cv.width,cv.height);x.font='10px Arial Narrow,sans-serif';let y=4;
    const used={};for(const [f] of PAD_FN){const m=PAD.map[f];if(m)used[m.d+':'+m.a]=f;}
    for(const p of pads){for(let a=0;a<p.axes.length&&y<cv.height-14;a++){const v=p.axes[a],k=p.index+':'+a;x.fillStyle='#8a8274';x.fillText(`${p.index}:${a}`,2,y+8);
        x.fillStyle='#2a2620';x.fillRect(30,y+1,170,8);x.fillStyle=used[k]?'#49e36b':'#6fd3e0';const c=115;x.fillRect(Math.min(c,c+v*85),y+1,Math.abs(v*85),8);x.fillStyle='#e8e2d6';x.fillRect(c,y,1,10);
        x.fillStyle=used[k]?'#49e36b':'#8a8274';x.fillText(used[k]?(PAD_FN.find(q=>q[0]===used[k])[de?1:2]):v.toFixed(2),206,y+8);y+=12;}
      let bx=2;for(let b=0;b<p.buttons.length;b++){const on=p.buttons[b].value>0.1;x.fillStyle=on?'#ffb300':'#2a2620';x.beginPath();x.arc(bx+5,cv.height-6,4,0,7);x.fill();bx+=12;}}}
  for(const [f,de1,en1] of PAD_FN){const m=PAD.map[f];const l=el('padLbl_'+f);if(l)l.textContent=de?de1:en1;
    const t=el('padMap_'+f);if(t)t.textContent=m?`${de?'Gerät':'dev'} ${m.d} · ${de?'Achse':'axis'} ${m.a}${m.inv?(de?' · umgekehrt':' · inverted'):''}${f==='col'?' · '+(m.mode==='position'?(de?'Position':'position'):(de?'Rate':'rate'))+(PAD.map.trig?(de?' + Trigger':' + triggers'):''):''}`:'–';
    const b=el('padLearn_'+f);if(b)b.textContent=PAD.learn&&PAD.learn.f===f?'…':(de?'Lernen':'Learn');}
}
function coachButtons(){const m=!COACH.on?'coachOff':COACH.voice?'coachVoice':'coachCues';for(const id of ['coachOff','coachCues','coachVoice']){const b=document.getElementById(id);if(b)b.classList.toggle('on',id===m);}}
function sideUpdate(dtF){
  debriefCheck(dtF||1/60);
  const el=id=>document.getElementById(id);const f0=v=>String(Math.round(v)||0);   // no "-0"
  UI.sideT=(UI.sideT||0)+1;if(UI.sideT%6===0){chartDraw();scoreUpdate();}
  if(UI.sideT%3===0){const su=document.getElementById('setup');if(su&&su.classList.contains('open'))padPanelUpdate();}
  el('bigIas').textContent=f0(S.ias/KT);el('bigAlt').textContent=f0(S.hAGL/FT);el('bigVs').textContent=f0(S.vs/FPM);
  el('bigNr').textContent=S.NR.toFixed(1);el('bigFli').textContent=S.eng.fli.toFixed(1);
  el('bigNr').style.color=(S.NR<H.nr.minPowerOn||S.NR>H.nr.maxPowerOn)&&S.eng.mode!=='off'?'var(--hot)':'var(--ink)';
  el('bigFli').style.color=S.eng.fli>11?'var(--hot)':S.eng.fli>10?'var(--amber)':'var(--ink)';
  if(UI.sideT%60===1&&R3.info){const g=el('gl');g.textContent=`GL ${R3.info.depthBits}-bit depth · ${R3.info.fragHighp?'highp':'mediump only'} · ${String(R3.info.renderer).slice(0,40)}`;g.title=R3.info.renderer;}
  el('stat').textContent=`${S.eng.mode.toUpperCase().padEnd(5)}${f0(S.Pload/1e3).padStart(4)}kW N1 ${S.eng.e.map(e=>f0(e.N1).padStart(3)).join('/')} ${f0(S.m)}kg DA${f0(atmo(S.alt,cfg.dT).dalt/FT).padStart(6)}ft${f0(S.t).padStart(5)}s`;
  if(S.incident){const inc=el('inc');if(inc.dataset.t!==String(S.incident.t)){inc.dataset.t=String(S.incident.t);inc.textContent=S.incident.text;inc.title=S.incident.text;}
    if(UI.sideT%30===0)el('incAge').textContent=`${Math.max(0,S.t-S.incident.t).toFixed(0)} s ago`;}
}
function boot(){
  const stage=document.getElementById('stage');
  glInit(document.getElementById('world'));hudInit(document.getElementById('ovl'));inputInit(stage);buildSetup();
  document.getElementById('setupTab').onclick=()=>document.getElementById('setup').classList.toggle('open');
  for(const [id,fn] of [['rCold',()=>{cfg.resetKind='cold';uiReset('cold');}],['rPad',()=>{cfg.resetKind='pad';uiReset('pad');}],['rHover',()=>{cfg.resetKind='hover';uiReset('hover');}],['rHigh',()=>{cfg.resetKind='high';uiReset('high');}],['rCruise',()=>{cfg.resetKind='cruise';uiReset('cruise');}],
    ['eFail',()=>engineFailure('one')],['eBoth',()=>engineFailure('both')],['eRestore',()=>engineFailure('restore')],['csv',downloadCSV],['replay',()=>{REPLAY.on?replayStop():replayStart();}]])document.getElementById(id).onclick=fn;
  startExercise('free');UI.trig=false;
  document.getElementById('exercise').value='free';
  const ts=document.getElementById('tutorSel');LESSONS.forEach((L,i)=>{const op=document.createElement('option');op.value=String(i);op.textContent=(i+1)+' · '+T_(L.title[0],L.title[1]);ts.appendChild(op);});
  document.getElementById('tutorStart').onclick=()=>{tutorStart(parseInt(ts.value));document.getElementById('tutorStart').blur();};
  document.getElementById('tutorStop').onclick=()=>tutorStop();
  for(const [id,m] of [['coachOff','off'],['coachCues','cues'],['coachVoice','voice']])document.getElementById(id).onclick=()=>{coachSet(m);document.getElementById(id).blur();};
  coachButtons();
  ts.onchange=()=>{if(TUTOR.on)tutorStart(parseInt(ts.value));ts.blur();};
  document.querySelectorAll('#setupBody select').forEach(el=>el.addEventListener('change',()=>el.blur()));
  // welcome card: the first thing a new pilot sees
  const w=document.getElementById('welcome');
  const wl=()=>{const de=cfg.lang==='de';w.querySelector('h1').textContent='EC135 Flight Dynamics';
    w.querySelector('p').textContent=de?'EC135-Flugdynamik zum Lernen. Ein Hubschrauber hat vier Steuer, die alle miteinander reden – der Tutor gibt sie dir in dreizehn Lektionen einzeln, den Knüppel in fünf Stufen. Maus = Knüppel (ein Klick in die Sicht fängt sie, Esc gibt sie frei), W/S = Kollektiv, A/D = Pedale.':'EC135 flight dynamics for learning. A helicopter has four controls that all talk to each other; the tutor hands them over one at a time in thirteen lessons, the stick in five stages. Mouse = stick (a click into the view captures it, Esc releases), W/S = collective, A/D = pedals.';
    document.getElementById('wTutor').textContent=de?'Tutor starten – Lektion 1':'Start the tutor – lesson 1';document.getElementById('wFree').textContent=de?'Frei fliegen':'Fly free';
    document.getElementById('wLang').textContent=de?'English':'Deutsch';};
  wl();
  document.getElementById('wLang').onclick=()=>{cfg.lang=cfg.lang==='de'?'en':'de';applyLang();uiSync();wl();};
  document.getElementById('wTutor').onclick=()=>{w.style.display='none';soundStart();coachSet('voice');tutorStart(0);};
  document.getElementById('wFree').onclick=()=>{w.style.display='none';soundStart();coachSet('voice');};
  window.addEventListener('blur',()=>{if(!UI.paused){UI.paused=true;UI.autoPaused=true;}});
  stage.addEventListener('mousedown',()=>{if(UI.autoPaused){UI.paused=false;UI.autoPaused=false;}});
  applyLang();
  requestAnimationFrame(loop);
}
