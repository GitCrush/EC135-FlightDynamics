/* ═══════════════ UI, EXERCISES, MAIN LOOP ═══════════════ */
const UI={paused:false,phantom:null,ex:null,exT:0,acc:0,last:0,fps:0,briefing:''};
const EXERCISES={
  free:{name:'Free flight (trimmed hover)',reset:'hover',brief:'You take over a trimmed hover at 3 m: stick, pedal and collective are right, the attitude hold keeps the attitude. Watch first, then small nudges. The coach tells you what is missing.'},
  pad:{name:'Lift off from the pad',reset:'pad',brief:'Rotor at 100 %, skids on the pad. Raise the collective slowly (W or wheel); the attitude hold takes the trim attitude as you lift. Keep the drift arrow in the circle.'},
  cold:{name:'Cold start',reset:'cold',brief:'Rotor stopped, rotor brake on, both engine switches OFF. By hand: Shift+B releases the brake; Shift+1 puts engine 1 to IDLE: the starter turns it, it lights at about 12 % N1 and the TOT peaks on the VEMD, then it settles at ground idle (25 s) and the rotor turns at 70 %. Then Shift+2 for engine 2, and once both idle, Shift+1 and Shift+2 again to FLIGHT: the FADEC runs the rotor up to 100 %. Shift+E does the whole sequence. Collective fully down throughout.'},
  hover:{name:'Hover over the pad',reset:'hover',phantom:'hover',target:[0,0,3],brief:'Hold 3 m over the H, heading north. The phantom hovers 20 m to your right as a reference. Watch the drift vector, not the horizon.'},
  pedal:{name:'Pedal turns',reset:'hover',brief:'From the hover, a full turn left and a full turn right at 15 °/s. The collective moves with the pedal: left pedal takes power, right pedal gives it back (the EC135 rotor turns counterclockwise).'},
  quick:{name:'Quick stop',reset:'approach',brief:'From 70 kt at 500 ft, decelerate to a hover without climbing: aft cyclic and collective down together, then collective back in as the airspeed bleeds off. Watch the tail.'},
  slope:{name:'Slope landing',reset:'hover',target:[0,150,0],brief:'The mound 150 m east has 8° flanks. Land across the slope: upslope skid first, cyclic into the slope as the collective comes down. Beyond the critical angle the cyclic runs out.'},
  roof:{name:'Rooftop pad',reset:'approach',target:[-260,-420,3],brief:'The hospital pad, 22 m up at 500 m south-west of the field. No ground texture under the nose on short final: fly the approach on the pad markings and the perimeter lights, and keep an escape route until the skids are inside the ring.'},
  confined:{name:'Confined area',reset:'approach',brief:'The tree ring at 340 m to the south-east. A steep approach into it needs power in ground effect it will not have; plan the escape before committing.'},
  auto:{name:'Autorotation',reset:'high',trigger:'engfail',brief:'Both engines fail ten seconds after the reset. Collective down at once, 65-70 kt, NR in the green. Flare at 100 ft, level, cushion with the last of the rotor energy.'},
  vrs:{name:'Vortex ring state',reset:'high',brief:'Slow to below 15 kt and let the sink pass 800 fpm with power on. When the VRS lamp comes on, recover: forward cyclic decisively with the collective up as power allows (the classical technique Airbus advises). With no room ahead, the Vuichard technique for this counterclockwise rotor: take-off power, right cyclic to a 15–20° bank, left pedal for the heading.'},
  approach:{name:'Approach with the phantom',reset:'approach',phantom:'approach',brief:'The phantom flies a 6° approach to the pad and terminates in a hover. Fly formation on it. It knows where the power comes in at translational lift.'},
  peak:{name:'Mountain top (the Kuppe)',reset:'approach',start:[1250,700,380,0,60],target:[2350,700,3],brief:'The rounded summit 1.1 km ahead, 260 m high, with a pad on its flat top and a windsock. Up there the air is thinner and the wind comes over the crest: approach into the wind, a little steeper than usual, and keep the escape downhill in mind. The flanks fall away on all sides: no ground cushion until the last metres.'},
  clearing:{name:'Forest clearing',reset:'hover',start:[200,-220,150,270,30],target:[200,-880,3],brief:'A clearing of some 50 m in the forest 660 m west, beyond the power line along the road (the wires sag to about 9 m between the pylons). Cross the line well above the pylons, then a steep approach into the clearing. The trees stand 11 to 17 m and are obstacles: blades in the crowns end the flight. Above their tops there is no ground cushion, and the downwash recirculates.'},
  hill:{name:'Slope landing on the hill',reset:'approach',start:[1000,-988,120,0,50],target:[1550,-988,0],brief:'The hill 550 m north has a site on its western flank marked by four orange cones, about 8° of slope falling to the west. Land with the nose across the slope (north or south), upslope skid first, then lower the downslope skid as the cyclic goes into the slope.'},
  highrise:{name:'High-rise pad in the town',reset:'approach',start:[-1250,-650,240,225,70],target:[-2268,-1468,3],brief:'The town 1.3 km south-west: the glass tower with the pad on its roof, 66 m up, the crane beside it (its jib and the hoist cable are obstacles). Approach over the streets, not the crane; the roof gives no ground texture until the last moment, the windsock on its corner shows the wind up there.'},
  oei:{name:'Engine failure in the hover',reset:'hover',trigger:'oei',brief:'One engine quits five seconds after the reset. The remaining engine has a 30-second rating; FLI scale changes to OEI. Lower the nose, keep NR, land or fly away.'},
};
function refreshTexts(){
  const ex=document.getElementById('exercise');if(ex)for(const op of ex.options)op.textContent=EXERCISES[op.value].name;
  const ts=document.getElementById('tutorSel');if(ts)LESSONS.forEach((L,i)=>{ts.options[i].textContent=(i+1)+' · '+L.title;});
  const b=document.getElementById('brief');if(b&&EXERCISES[UI.ex])b.textContent=EXERCISES[UI.ex].brief;
  const k=document.getElementById('keys');if(k)k.innerHTML='Keys and devices: see <b>Setup</b> (bottom right of the view)';
}
const SETUP=[
  ['Profile',[
    ['profile','Level','select',['beginner','intermediate','realistic','custom'],{beginner:'Beginner',intermediate:'Intermediate',realistic:'Realistic',custom:'Custom'}],
    ['profNote','','profnote'],['resetAll','','reset'],
  ]],
  ['Aircraft',[
    ['mass','Mass','range',1800,2910,10,'kg'],['cgx','CG offset','range',-0.15,0.15,0.01,'m'],['dT','ISA deviation','range',-20,35,1,'°C'],
  ]],
  ['Wind',[
    ['weather','Weather','select',['calm','breeze','gusty','strong','custom'],{calm:'Calm',breeze:'Breeze 8 kt',gusty:'Gusty 14 kt',strong:'Strong 22 kt',custom:'Custom'}],
    ['wdir','From','range',0,359,5,'°'],['wspd','Speed','range',0,35,1,'kt'],['wturb','Turbulence','range',0,3,0.25,''],['wgust','Gusts','range',0,20,1,'kt'],
  ]],
  ['Stability aids',[
    ['coach','Coach: correction cues  K','check'],['coachVoice','Coach voice (speech)','check'],['sas','SAS rate damping + trim feedforward','check'],['attHold','Attitude command around trim (centred stick = calm)','check'],['cycLaw','Cyclic in forward flight (attitude aid)','select',['rcah','acah'],{rcah:'rate (RCAH)',acah:'attitude (ACAH)'}],['hdgHold','Heading hold (pedals centred)','check'],['hoverAssist','Hover assist (stick = velocity)  H','check'],
  ]],
  ['Input models',[
    ['kbdCol','Collective keys W/S','select',['metered','rate']],['kbdPed','Pedal keys A/D','select',['heading','rate']],['pedRate','Yaw rate per pedal key','range',10,45,5,'°/s'],
    ['mouse','Mouse cyclic','check'],['mouseButtons','Mouse buttons = pedals','check'],['mouseTravel','Mouse travel (px for full stick)','range',300,2500,50,'px'],['mouseCalBtn','','cal'],['mouseCurve','Mouse curve (stick per movement)','select',['linear','mild','strong']],
  ]],
  ['Keys',[['keys','Mouse: click into the view to capture it as the stick, Esc releases · mouse buttons = pedals · hold C or the middle button to look around · hold Q / E to glance out of the left / right door window · Shift+Z head tracking by webcam, Z centres it · wheel or W S collective · A D pedals · arrows stick · T trim to the present attitude · Shift + arrows beep trim · Y back to the hover trim · H hover assist · V autopilot demo · U I O autopilot: ALT, HOV/IAS, HDG · hold M: click to fly · J autopilot menu · K coach · L replay · X CSV · Shift+E engines · G engine failure · R reset · 1 2 3 views · F flight path marker · P predicted path · Space pause · N B Shift+Q tutor · ? key list','note']]],
  ['Gamepad / joystick',[
    ['padMap','Preset','select',['gamepad','joystick','custom']],['padDead','Stick dead zone','range',0,0.2,0.01,''],['padPanel','','pad'],
  ]],
  ['View',[
    ['view','Camera  1/2/3','select',['cockpit','chase','tower']],['gfx','Graphics (light for weak GPUs)','select',['auto','full','light']],['fov','Cockpit field of view (across)','range',50,90,2,'°'],['cloud','Cloud cover','range',0,1,0.1,''],['tod','Time of day','range',6.5,19.5,0.5,'h'],['vis','Visibility','range',1.5,20,0.5,'km'],['frame','Cockpit frame (attitude reference)','check'],['motion','Motion cues (the head moves with the accelerations)','select',['off','subtle','full']],['htPanel','','ht'],['htYaw','Head tracking: turn gain','range',1.5,6,0.25,'x'],['htPitch','Head tracking: nod gain','range',1,5,0.25,'x'],['apr','Approach view (gaze down)  4','select',['off','on']],['aprChin','… with chin windows (costs frame rate)','check'],['perfTest','','perf'],['hud','HUD','check'],['rotorDisc','Rotor-state map','check'],['fpm','Flight path marker  F','check'],['predict','Predicted path  P','check'],['predictT','Prediction: seconds ahead (auto: 6 in the hover to 30 at speed)','select',['auto','4','8','15','30']],['sound','Sound','check'],['volume','Volume','range',0,100,5,'%'],
  ]],
];
if(cfg.apr!=='on')cfg.apr='off';
if(cfg.frame===undefined)cfg.frame=true;
if(cfg.aprChin===undefined)cfg.aprChin=false;
if(cfg.htYaw===undefined)cfg.htYaw=3.5;if(cfg.htPitch===undefined)cfg.htPitch=2.5;   // (2.13) head tracking gains   // (2.13) the approach view's chin windows: off by default (a second pass the integrated GPUs pay for)   // (2.13) the cockpit frame's lines   // (2.12.4) on or off by key, no 'auto' any more
if(cfg.fov===undefined)cfg.fov=72;   // cockpit field of view across, degrees (the vertical angle is kept between 46 and 62, see cockpitFov)
if(cfg.gfx===undefined){let g=null;try{g=localStorage.getItem('ec135fd.gfx');}catch(e){}cfg.gfx=['auto','full','light'].includes(g)?g:'auto';}   // graphics mode, see GFX in the renderer
/* (2.14) Profiles: one choice for the aids, the coach and the displays (2.16.1: not the weather any more; no wind unless chosen). Changing any of them by
   hand (in the setup or by key) makes it 'custom'. Realistic: rate damping only, no attitude
   command or heading hold, no coach, no predictor or trainer displays, no wind of its own. */
const PROFILES={
  beginner:{cfg:{sas:true,attHold:true,hdgHold:true,hoverAssist:false,cycLaw:'rcah',predict:true,fpm:true,rotorDisc:true,motion:'subtle'},coach:'cues'},
  intermediate:{cfg:{sas:true,attHold:true,hdgHold:true,hoverAssist:false,cycLaw:'rcah',predict:true,fpm:true,rotorDisc:true,motion:'subtle'},coach:'off'},
  realistic:{cfg:{sas:true,attHold:false,hdgHold:false,hoverAssist:false,cycLaw:'rcah',predict:false,fpm:false,rotorDisc:false,motion:'full'},coach:'off'}};
const PROFILE_NOTE={beginner:'Sets the aids, the coach and the displays (the wind is set in the Wind block). Beginner: all aids on, the coach shows the corrections, the predicted path.',intermediate:'All aids on, no coach, the predicted path.',
  realistic:'Rate damping only: no attitude command, no heading hold, no coach, no predictor or rotor map.',custom:'Changed by hand; pick a profile to start from one again.'};
/* (2.14) Weather presets for the wind block (the direction stays) */
const WEATHER={calm:{spd:0,turb:0,gust:0},breeze:{spd:8,turb:0.5,gust:3},gusty:{spd:14,turb:1.0,gust:8},strong:{spd:22,turb:1.75,gust:12}};
function coachMode(){return !COACH.on?'off':COACH.voice?'voice':'cues';}
function coachWant(m){UI.coachMode=m;if(UI.started)coachSet(m);}   // before the start the welcome card's buttons switch it on (the legend's 20 s begin there)
/* (2.16.1) A level or a weather preset chosen on the welcome card used to switch the wind at once while the
   trimmed hover waited behind the card: 14 kt into an aircraft trimmed for calm air drifts at 7 m/s within 5 s.
   Now the simulation holds while the card is open and the start trims anew in the chosen air; chosen in flight,
   the wind eases to the new values (2 kt a second), a change of weather rather than a blow. */
let WIND_T=null;
function weatherApply(w){const W_=WEATHER[w];if(!W_)return;cfg.weather=w;
  if(!UI.started){WIND.spd=W_.spd;WIND.turb=W_.turb;WIND.gust=W_.gust;WIND_T=null;return;}
  WIND_T={spd:W_.spd,turb:W_.turb,gust:W_.gust};if(typeof dlNote==='function')dlNote(`Weather: the wind goes to ${W_.spd} kt over ${Math.max(1,Math.round(Math.abs(W_.spd-WIND.spd)/2))} s`);}
function windEase(dt){if(!WIND_T)return;const r={spd:2,turb:0.25,gust:1.5};let done=true;
  for(const k in WIND_T){WIND[k]=approach(WIND[k],WIND_T[k],r[k]*dt);if(WIND[k]!==WIND_T[k])done=false;}if(done)WIND_T=null;}
function windNow(){return WIND_T||WIND;}   // what the wind is going to be
function profileApply(n){const P=PROFILES[n];if(!P)return;Object.assign(cfg,P.cfg);coachWant(P.coach);cfg.profile=n;if(typeof uiSync==='function')uiSync();if(typeof welcomeLevels==='function')welcomeLevels();}
function profileCheck(){   // a setting changed by hand: the profile and the weather say 'custom'
  const P=PROFILES[cfg.profile];if(P&&(Object.keys(P.cfg).some(k=>cfg[k]!==P.cfg[k])||(UI.started?coachMode():UI.coachMode)!==P.coach)){cfg.profile='custom';uiSync();}
  const W_=WEATHER[cfg.weather],Wn=windNow();if(W_&&(Wn.spd!==W_.spd||Wn.turb!==W_.turb||Wn.gust!==W_.gust)){cfg.weather='custom';uiSync();}}
/* (2.14) The settings stay in this browser (until 2.13 only the graphics and the gamepad's mapping did):
   saved once a second when something changed, never during a lesson or the performance test (they set
   their own), and read before the setup is built. */
const PERSIST=['mass','cgx','dT','sas','attHold','hdgHold','hoverAssist','cycLaw','kbdCol','kbdPed','pedRate','mouse','mouseButtons','mouseTravel','mouseCurve','mouseCal',
  'view','fov','cloud','tod','vis','frame','htYaw','htPitch','aprChin','hud','rotorDisc','fpm','predict','predictT','sound','volume','profile','weather','motion'];
function settingsSnap(){const Wn=windNow(),o={v:2,cfg:{},wind:{dir:WIND.dir,spd:Wn.spd,turb:Wn.turb,gust:Wn.gust},coach:UI.started?coachMode():UI.coachMode};for(const k of PERSIST)if(cfg[k]!==undefined)o.cfg[k]=cfg[k];return o;}
function settingsSave(){if(TUTOR.on||PT.on||REPLAY.on)return;profileCheck();try{const j=JSON.stringify(settingsSnap());if(j!==UI.savedJ){localStorage.setItem('ec135fd.settings',j);UI.savedJ=j;}}catch(e){}}
function settingsLoad(){let o=null;try{o=JSON.parse(localStorage.getItem('ec135fd.settings')||'null');}catch(e){}
  if(!o||!o.cfg){profileApply('beginner');UI.coachMode='cues';return false;}   // the first start: Beginner, every aid and the coach (the setup's Level takes them away)
  for(const k of PERSIST){const v=o.cfg[k];if(v!==undefined&&(cfg[k]===undefined||typeof v===typeof cfg[k]))cfg[k]=v;}
  if(o.wind&&(o.v||1)>=2)for(const k of ['dir','spd','turb','gust'])if(typeof o.wind[k]==='number')WIND[k]=o.wind[k];   // (2.16.1) until then a level set the wind: dropped, calm air
  if((o.v||1)<2)cfg.weather='calm';
  UI.coachMode=['off','cues','voice'].includes(o.coach)?o.coach:'cues';UI.savedJ=JSON.stringify(o);return true;}
function settingsReset(){try{localStorage.removeItem('ec135fd.settings');localStorage.removeItem('ec135fd.gfx');}catch(e){}location.reload();}
function cfgGet(k){if(k==='coach')return COACH.on;if(k==='coachVoice')return COACH.voice;if(k==='wdir')return WIND.dir;if(k==='wspd')return WIND.spd;if(k==='wturb')return WIND.turb;if(k==='wgust')return WIND.gust;if(k==='padMap')return DEV.padMap;if(k==='padDead')return cfg.padDead;return cfg[k];}
function cfgSet(k,v){if(k==='profile'){if(v!=='custom')profileApply(v);return;}if(k==='weather'){if(v!=='custom'){weatherApply(v);uiSync();}return;}if(k==='coach'){coachSet(v?(COACH.voice?'voice':'cues'):'off');return;}if(k==='coachVoice'){coachSet(v?'voice':(COACH.on?'cues':'off'));return;}if(k==='wdir')WIND.dir=v;else if(k==='wspd')WIND.spd=v;else if(k==='wturb')WIND.turb=v;else if(k==='wgust')WIND.gust=v;else if(k==='padMap'){DEV.padMap=v;if(v!=='custom')padPreset(v);else padSave();}else if(k==='padDead'){cfg.padDead=v;padSave();}else cfg[k]=v;
  if(k==='view')setView(v);
  if(k==='gfx')gfxSet(v);
}
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
      if(type==='profnote'){const d=document.createElement('div');d.className='note';d.id='profNote';d.textContent=PROFILE_NOTE[cfg.profile]||'';root.appendChild(d);continue;}
      if(type==='reset'){const d=document.createElement('div');d.className='note';d.innerHTML='<button id="setReset" title="Back to the first start: beginner profile, mouse not fitted, default graphics">Reset all settings</button>';root.appendChild(d);
        d.querySelector('#setReset').onclick=e=>{e.preventDefault();settingsReset();};continue;}
      if(type==='cal'){const d=document.createElement('div');d.className='note';d.innerHTML='<button id="calRun" title="The next capture of the mouse starts it: sweep from the pad\'s left edge to its right edge, click">Fit the travel to the mouse pad</button> <span id="calNote"></span>';root.appendChild(d);
        d.querySelector('#calRun').onclick=e=>{e.preventDefault();e.target.blur();CAL.pending=true;const n=document.getElementById('calNote');if(n)n.textContent='click into the view to start';};continue;}
      if(type==='pad'){const d=document.createElement('div');d.id='padPanel';root.appendChild(d);padPanelBuild(d);continue;}
      if(type==='ht'){const d=document.createElement('div');d.className='note';   // (2.13) head tracking by webcam
        d.innerHTML='<div style="display:flex;gap:6px;flex-wrap:wrap"><button id="htRun" title="The camera picture stays in this browser; the face detector (about 10 MB) comes from jsDelivr the first time">Head tracking (webcam): start</button><button id="htCentre" title="Z">Centre (Z)</button></div><div id="htStatus" class="data" style="margin-top:4px">off</div>';
        root.appendChild(d);d.querySelector('#htRun').onclick=e=>{e.preventDefault();e.target.blur();if(HT.on)htStop();else htStart();};
        d.querySelector('#htCentre').onclick=e=>{e.preventDefault();e.target.blur();htCentre();};continue;}
      if(type==='perf'){const d=document.createElement('div');d.className='note';   // (2.12.3) the performance test
        d.innerHTML='<div style="display:flex;gap:6px"><button id="perfRun" title="Measures the view here, eight ways, 2.5 s each; hands off meanwhile">Performance test (here, 25 s)</button><button id="perfCopy">Copy</button></div><textarea id="perfOut" readonly rows="3" style="width:100%;margin-top:6px;font:10px/1.35 ui-monospace,monospace;background:#0d0c0a;color:var(--ink);border:1px solid #2e2924;resize:vertical"></textarea>';
        root.appendChild(d);d.querySelector('#perfRun').onclick=e=>{e.preventDefault();e.target.blur();perfStart();};
        d.querySelector('#perfCopy').onclick=e=>{e.preventDefault();const t=document.getElementById('perfOut');t.select();let ok=false;try{ok=document.execCommand('copy');}catch(_){}if(!ok&&navigator.clipboard)navigator.clipboard.writeText(t.value).catch(()=>{});e.target.blur();};continue;}
      if(type==='range'){inp=document.createElement('input');inp.type='range';inp.min=it[3];inp.max=it[4];inp.step=it[5];inp.value=cfgGet(k);const val=document.createElement('b');val.className='data';val.textContent=cfgGet(k)+' '+it[6];
        inp.oninput=()=>{cfgSet(k,parseFloat(inp.value));val.textContent=inp.value+' '+it[6];};row.appendChild(inp);row.appendChild(val);}
      else if(type==='check'){inp=document.createElement('input');inp.type='checkbox';inp.checked=!!cfgGet(k);inp.onchange=()=>cfgSet(k,inp.checked);row.appendChild(inp);}
      else{inp=document.createElement('select');for(const o of it[3]){const op=document.createElement('option');op.value=o;op.textContent=(it[4]&&it[4][o])||o;inp.appendChild(op);}inp.value=cfgGet(k);inp.onchange=()=>cfgSet(k,inp.value);row.appendChild(inp);}
      inp.dataset.key=k;if(type==='range')inp.dataset.unit=it[6];root.appendChild(row);
    }
  }
  const ex=document.getElementById('exercise');ex.innerHTML='';for(const k in EXERCISES){const op=document.createElement('option');op.value=k;op.textContent=EXERCISES[k].name;ex.appendChild(op);}
  ex.onchange=()=>{startExercise(ex.value);ex.blur();};
}
function uiSync(){document.querySelectorAll('#setupBody [data-key]').forEach(el=>{const k=el.dataset.key;if(el.type==='checkbox')el.checked=!!cfgGet(k);else el.value=cfgGet(k);if(el.type==='range'&&el.nextSibling&&el.nextSibling.classList&&el.nextSibling.classList.contains('data'))el.nextSibling.textContent=cfgGet(k)+' '+(el.dataset.unit||'');});
  const pn=document.getElementById('profNote');if(pn)pn.textContent=PROFILE_NOTE[cfg.profile]||'';const cn=document.getElementById('calNote');if(cn&&!CAL.pending)cn.textContent='';}
/* The autopilot trims the aircraft in fast time and hands it over: every
   airborne reset starts calm, with stick, pedal and collective at trim. */
function trimNow(sec){
  S.alt=-S.pos[2];S.eul=qtoEuler(S.q);const v=vlen(S.vb);const hover=v<30*KT;AP.on=true;AP.auto=false;AP.mode=hover?'hover':'cruise';AP.ias=v/KT;AP.posN=hover?S.pos[0]:null;AP.posE=hover?S.pos[1]:null;AP.alt=S.alt;AP.hdg=S.eul[2];AP.vN=0;AP.vE=0;AP.pOnly=false;AP.freezeInt=false;apBumpless(AP);   // bumpless: zero integrators drop the collective first, near the limit that sinks into the ring
  /* Position hold first, then pure velocity hold until the aircraft is
     really still: the integrators then hold exactly the zero-acceleration
     trim, which is what gets handed over. */
  /* (2.16.1) trimmed in the mean wind: turbulence and gusts are held off while the autopilot trims and start from
     nothing at the hand-over (the first gust some seconds later), so the aircraft is not handed over in a gust */
  const wk={t:WIND.turb,g:WIND.gust};WIND.turb=0;WIND.gust=0;windReset();
  let o;for(let t=0;t<(sec||8);t+=DT){o=apStep(DT);IN.col=o.col;IN.lon=o.lon;IN.lat=o.lat;IN.ped=o.ped;step(DT);}
  if(hover){for(let t=0;t<20;t+=DT){o=apStep(DT);IN.col=o.col;IN.lon=o.lon;IN.lat=o.lat;IN.ped=o.ped;step(DT);   // keep holding the spot until still and back on it
    if(t>4&&Math.hypot(S.vb[0],S.vb[1])<0.03&&Math.abs(S.vs)<0.03&&vlen(S.om)<0.2*DEG&&Math.hypot(S.pos[0]-AP.posN,S.pos[1]-AP.posE)<0.3)break;}}
  WIND.turb=wk.t;WIND.gust=wk.g;windReset();
  AP.on=false;AP.posN=AP.posE=null;trimHandover(o);DEV.kbd.col=o.col;DEV.kbd.psiRef=S.eul[2];DEV.kbd.ped=0;DEV.kbd.lon=DEV.kbd.lat=0;IN.trimLon=IN.trimLat=IN.trimPed=0;
  if(COACH.ap){COACH.trimTh=S.eul[1];COACH.trimPhi=S.eul[0];}S.log=[];S.t=0;S.logT=0;
}
function uiReset(kind){afcsOff();guideReset();AFCS_UI.note=null;AFCS_UI.trail=[];AFCS_UI.base=null;AP.on=false;AP.kci=undefined;PRED.res=null;PRED.past.length=0;PRED.Tauto=6;PRED.gen++;PRED.main=null;PRED.busy=false;reset(kind);SAS.init=false;if(typeof afcsButtons==='function')afcsButtons();if(HUD.aoaMap)HUD.aoaMap.fill(NaN);SCORE.n=0;SCORE.sum=0;SCORE.max=0;SCORE.hsum=0;const sc=document.getElementById('score');if(sc)sc.textContent='';DEV.kbd.col=IN.col;DEV.kbd.psiRef=S.eul[2];DEV.kbd.lon=DEV.kbd.lat=DEV.kbd.ped=0;R3.cam.chasePos=null;HUD.incText='';for(const k in INC_LAST)delete INC_LAST[k];
  if(kind!=='pad'&&kind!=='cold')trimNow(8);
  else{/* on the ground: find the hover trim for this mass, CG and wind in fast time at 3 m,
          then put the aircraft back on the pad. Lift-off then starts with the right stick. */
    const keepC=IN.col;reset('hover');trimNow(6);reset(kind);SAS.init=false;SAS.mode='';IN.col=keepC;DEV.kbd.col=IN.col;DEV.kbd.psiRef=S.eul[2];S.log=[];}
  Object.assign(IN.raw,{col:DEV.kbd.col,lon:0,lat:0,ped:0});}   // the controls as the next frame will read them (the predictor starts from them before that frame)
function startExercise(key){
  const ex=EXERCISES[key];UI.ex=key;UI.exT=0;UI.trig=false;cfg.resetKind=ex.reset;if(TUTOR.on)tutorStop();uiReset(ex.reset);
  if(ex.start){const [n,e,hft,psi,kt]=ex.start;placeAt(n,e,hft*FT,psi*DEG,kt);trimNow(kt>30?2:4);cfg.resetKind='ex:'+key;}   // (2.9) a start of its own, trimmed; R repeats it
  document.getElementById('brief').textContent=ex.brief;
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
function apDemoToggle(){if(!UI.apDemo)afcsOffAll();UI.apDemo=!UI.apDemo;if(UI.apDemo){AP.on=true;AP.auto=false;AP.mode=S.ias>40*KT?'cruise':'hover';AP.ias=S.ias/KT;AP.posN=AP.mode==='hover'?S.pos[0]:null;AP.posE=AP.mode==='hover'?S.pos[1]:null;AP.alt=S.alt;AP.hdg=S.eul[2];apBumpless(AP);}
  else{if(!TUTOR.on){AP.on=false;AP.posN=AP.posE=null;}trimHandover(AP.out);DEV.kbd.col=IN.col;DEV.kbd.psiRef=S.eul[2];}}
function apDemoStep(dt){if(!UI.apDemo||TUTOR.on)return;const o=apStep(dt);IN.col=o.col;IN.lon=o.lon;IN.lat=o.lat;IN.ped=o.ped;}
function engineFailure(kind){if(kind==='restore'){for(const en of S.eng.e){en.fail=false;en.on=true;}S.fen.failed=false;return;}
  if(kind==='tail'){S.fen.failed=true;return;}
  if(kind==='both'){for(const en of S.eng.e)en.fail=true;return;}
  const en=S.eng.e.find(e=>!e.fail);if(en)en.fail=true;}
/* CSV of the 20-s log: the browser saves it from a blob link, opened as a file or from a web server alike. */
function downloadCSV(){const csv=exportCSV();if(!csv)return;const name='ec135-flight-dynamics-log.csv';
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download=name;a.click();}
/* (2.12.3) The performance test (setup, View). At the present place, the simulation held, the view is drawn
   for 2.5 s in each of eight ways: the normal cockpit view and the approach view, the approach view without its
   chin windows and with them at full resolution and in the full shader (2.12.4), both views in light graphics and with half the pixels.
   Per frame: the interval in the page's own loop (what the eye sees), the time to issue the frame (JavaScript),
   the time until the GPU has drawn it (a one-pixel read waits for it) and the overlay's. One block of text to
   copy: it says where the time goes on this machine. */
const PT={on:false,i:0,t:0,a:[],keep:null,res:[]};
const PT_LIST=[['normal',{apr:'off'}],['approach',{apr:'on'}],['approach, no chin',{apr:'on',noChin:1}],['approach, chin full',{apr:'on',chinFull:1}],
  ['normal, light gfx',{apr:'off',gfx:'light'}],['approach, light gfx',{apr:'on',gfx:'light'}],['normal, 1/2 pixels',{apr:'off',scale:Math.SQRT1_2}],['approach, 1/2 pixels',{apr:'on',scale:Math.SQRT1_2}]];
function perfOut(t){const o=document.getElementById('perfOut');if(o){o.value=t;o.rows=Math.min(14,t.split('\n').length+1);}}
function perfApply(o){cfg.apr=o.apr;APR.k=o.apr==='on'?1:0;PERF.noChin=!!o.noChin;PERF.chinFull=!!o.chinFull;PERF.scale=o.scale||1;cfg.gfx=o.gfx||PT.keep.gfx;}
function perfSync(){const gl=R3.gl;if(gl){PT.px=PT.px||new Uint8Array(4);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,PT.px);}}
function perfStart(){if(PT.on)return;PT.keep={view:cfg.view,apr:cfg.apr,k:APR.k,armed:APR.armed,freeze:UI.freeze,gfx:cfg.gfx,drs:DRS.s};
  const su=document.getElementById('setup');if(su)su.classList.remove('open');
  UI.freeze=true;cfg.view='cockpit';PT.on=true;PERF.on=true;PT.i=0;PT.t=0;PT.a=[];PT.res=[];perfApply(PT_LIST[0][1]);perfOut('running: about 25 s, hands off');}
function perfFrame(dt,js,draw,hud){PT.t+=dt;if(PT.t>0.6)PT.a.push([dt*1000,js,draw,hud]);if(PT.t<3.1)return;
  const med=k=>{const b=PT.a.map(r=>r[k]).sort((x,y)=>x-y);return b[b.length>>1]||0;},p90=k=>{const b=PT.a.map(r=>r[k]).sort((x,y)=>x-y);return b[Math.floor(b.length*0.9)]||0;};
  PT.res.push([PT_LIST[PT.i][0],med(0),p90(0),med(1),med(2),med(3),R3.canvas.width+'x'+R3.canvas.height]);PT.i++;PT.t=0;PT.a=[];
  if(PT.i<PT_LIST.length){perfApply(PT_LIST[PT.i][1]);return;}
  PT.on=false;PERF.on=false;PERF.noChin=false;PERF.chinFull=false;PERF.scale=1;
  const k=PT.keep;cfg.view=k.view;cfg.apr=k.apr;cfg.gfx=k.gfx;APR.k=k.k;APR.armed=k.armed;UI.freeze=k.freeze;
  const f=v=>v.toFixed(1).padStart(6),L=['EC135 '+APP_VERSION+' performance test · '+(()=>{const u=navigator.userAgent,b=(u.match(/Firefox\/[\d.]+/)||u.match(/Edg\/[\d.]+/)||u.match(/Chrome\/[\d.]+/)||u.match(/Version\/[\d.]+(?= .*Safari)/)||['?'])[0],o=(u.match(/Linux|Windows|Mac OS X|Android|iPhone|iPad|CrOS/)||['?'])[0];return b+' '+o+(/Wayland/i.test(u)?' Wayland':'');})()+' · '+String(R3.info&&R3.info.renderer||'?')+' · page '+R3.w+'x'+R3.h+' · '+cfg.gfx+' (DRS '+Math.round(k.drs*100)+' %) · at '+Math.round(S.pos[0])+','+Math.round(S.pos[1])+' '+Math.round(S.hAGL)+' m',
    'ms per frame:           interval   p90    js  drawn  hud  buffer'];
  for(const r of PT.res)L.push(r[0].padEnd(22)+f(r[1])+f(r[2])+f(r[3])+f(r[4])+f(r[5])+'  '+r[6]);
  perfOut(L.join('\n'));const su=document.getElementById('setup');if(su)su.classList.add('open');}
function loop(now){
  requestAnimationFrame(loop);
  let dtF=Math.min(0.1,(now-UI.last)/1000||0);UI.last=now;
  const wel=UI.welEl||(UI.welEl=document.getElementById('welcome')),hold=!!(wel&&wel.style.display!=='none');   // (2.16.1) nothing moves behind the welcome card
  if(!UI.paused&&!UI.freeze&&!hold){   // UI.freeze: still frame without the pause text (screenshots)
    windEase(dtF);
    inputStep(dtF);tutorStep(dtF);apDemoStep(dtF);afcsStep(dtF);coachStep(dtF);
    UI.acc+=dtF;let n=0;
    while(UI.acc>=DT&&n<60){step(DT);phantomStep(DT);UI.acc-=DT;n++;}
    UI.exT+=dtF;
    const ex=EXERCISES[UI.ex];
    if(ex&&ex.trigger==='engfail'&&UI.exT>10&&!UI.trig){UI.trig=true;engineFailure('both');}
    if(ex&&ex.trigger==='oei'&&UI.exT>5&&!UI.trig){UI.trig=true;engineFailure('one');}
  }
  if(!UI.paused&&!UI.freeze&&!hold)predStep();
  htStep(dtF);   // (2.13) the head, by webcam
  replayFrame(dtF);
  if(PT.on){const t0=performance.now();render(dtF);const t1=performance.now();perfSync();const t2=performance.now();hudDraw(dtF);perfFrame(dtF,t1-t0,t2-t0,performance.now()-t2);}   // (2.12.3) the performance test
  else{render(dtF);hudDraw(dtF);}
  soundUpdate(dtF);
  sideUpdate(dtF);
  if(now-(UI.saveAt||0)>1000){UI.saveAt=now;settingsSave();}   // (2.14) once a second of real time (a slow frame's dt is capped)
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
    const rows=[['Airborne',`${st.air.toFixed(0)} s`],['Touchdown',`${(st.touchVs/FPM).toFixed(0)} fpm${st.touchVs>H.gear.hardVs?(' – hard'):''}`],
      tgt!==null?['Distance to target',`${tgt.toFixed(1)} m`]:null,['Max FLI',st.maxFli.toFixed(1)],['NR min / max',`${st.minNr.toFixed(0)} / ${st.maxNr.toFixed(0)} %`],
      ['Max speed / bank',`${(st.maxIas/KT).toFixed(0)} kt / ${(st.maxBank*RAD).toFixed(0)}°`],['Incidents',String(st.incidents)]].filter(Boolean);
    UI.debrief={t:S.t,rows,title:'Debrief'};S.stats={air:0,maxFli:0,minNr:200,maxNr:0,maxIas:0,maxBank:0,maxSink:0,touchVs:0,landings:0,incidents:0};}
}
/* Gamepad test panel: every axis of every connected device as a bar, the
   buttons as dots, the mapping per function with a learn button. */
const PAD_FN=[['lat','Cyclic lateral','to the right'],['lon','Cyclic fore/aft','forward'],['ped','Pedals','right pedal'],['col','Collective','up']];
function padPanelBuild(root){
  root.innerHTML='';const st=document.createElement('div');st.id='padStatus';st.className='note';root.appendChild(st);
  const cv=document.createElement('canvas');cv.id='padCanvas';cv.width=262;cv.height=110;cv.style.cssText='width:100%;height:110px;background:#0d0c0a;display:block;margin:4px 0';root.appendChild(cv);
  for(const [f] of PAD_FN){const row=document.createElement('div');row.className='row';row.innerHTML=`<span id="padLbl_${f}"></span><b id="padMap_${f}" style="width:auto;flex:1;text-align:left;color:var(--ink)"></b>`;
    const b=document.createElement('button');b.id='padLearn_'+f;b.onclick=()=>{padLearnStart(f);b.blur();};row.appendChild(b);root.appendChild(row);}
}
function padPanelUpdate(){
  const el=id=>document.getElementById(id);const st=el('padStatus');if(!st)return;
  const pads=PAD.pads.filter(p=>p&&p.connected);
  st.textContent=PAD.blocked?('Gamepad access is blocked in this embedded frame – download the file and open it locally in the browser.')
    :!pads.length?('No device found. Connect it (cable or dongle) and press any button once.')
    :PAD.learn?(`Now move the ${PAD_FN.find(x=>x[0]===PAD.learn.f)[1].toLowerCase()} firmly ${PAD_FN.find(x=>x[0]===PAD.learn.f)[2]} …`)
    :pads.map(p=>`${p.index}: ${p.id.slice(0,38)} (${p.mapping||'raw'})`).join(' · ');
  const cv=el('padCanvas');if(cv){const x=cv.getContext('2d');x.fillStyle='#0d0c0a';x.fillRect(0,0,cv.width,cv.height);x.font='10px Arial Narrow,sans-serif';let y=4;
    const used={};for(const [f] of PAD_FN){const m=PAD.map[f];if(m)used[m.d+':'+m.a]=f;}
    for(const p of pads){for(let a=0;a<p.axes.length&&y<cv.height-14;a++){const v=p.axes[a],k=p.index+':'+a;x.fillStyle='#8a8274';x.fillText(`${p.index}:${a}`,2,y+8);
        x.fillStyle='#2a2620';x.fillRect(30,y+1,170,8);x.fillStyle=used[k]?'#49e36b':'#6fd3e0';const c=115;x.fillRect(Math.min(c,c+v*85),y+1,Math.abs(v*85),8);x.fillStyle='#e8e2d6';x.fillRect(c,y,1,10);
        x.fillStyle=used[k]?'#49e36b':'#8a8274';x.fillText(used[k]?(PAD_FN.find(q=>q[0]===used[k])[1]):v.toFixed(2),206,y+8);y+=12;}
      let bx=2;for(let b=0;b<p.buttons.length;b++){const on=p.buttons[b].value>0.1;x.fillStyle=on?'#ffb300':'#2a2620';x.beginPath();x.arc(bx+5,cv.height-6,4,0,7);x.fill();bx+=12;}}}
  for(const [f,label] of PAD_FN){const m=PAD.map[f];const l=el('padLbl_'+f);if(l)l.textContent=label;
    const t=el('padMap_'+f);if(t)t.textContent=m?`dev ${m.d} · axis ${m.a}${m.inv?(' · inverted'):''}${f==='col'?' · '+(m.mode==='position'?('position'):('rate'))+(PAD.map.trig?(' + triggers'):''):''}`:'–';
    const b=el('padLearn_'+f);if(b)b.textContent=PAD.learn&&PAD.learn.f===f?'…':('Learn');}
}
/* The autopilot menu: built in the page (html/template.html), filled here. Open or closed with J, the
   Autopilot tab at the top left of the view, Menu in the side panel; Esc closes it. Flying goes on. */
function apMenuShow(on){UI.apMenu=!!on;const m=document.getElementById('apMenu'),t=document.getElementById('apTab');if(m)m.classList.toggle('open',UI.apMenu);if(t)t.style.display=UI.apMenu?'none':'';if(UI.apMenu)apMenuSync();}
function apMenuToggle(){apMenuShow(!UI.apMenu);}
function apMenuSync(){
  const el=id=>document.getElementById(id),m=el('apMenu');if(!m)return;
  const t=el('apTab');if(t)t.classList.toggle('hold',afcsAny());
  if(!UI.apMenu)return;
  const f=S.ias>40*KT,bl=afcsBlocked();
  for(const k of ['alt','vs','hdg','hov','ias']){const b=el('amM'+k);if(!b)continue;b.classList.toggle('on',!!AFCS[k]);
    const avail=!bl&&!(AFCS[k]?false:afcsUnavailable(k));b.disabled=!avail&&!AFCS[k];const tx=el('amT'+k);if(tx)tx.textContent=AFCS[k]?afcsTargetText(k):'';}
  const ch=el('amChdg');if(ch)ch.textContent=f?'bank + pedals':'pedals';
  el('amMhov').style.display=f&&!AFCS.hov?'none':'';el('amMias').style.display=!f&&!AFCS.ias?'none':'';
  const row=(id,on,val,hint)=>{const r=el('amR'+id);if(!r)return;r.classList.toggle('off',!on);r.querySelectorAll('button').forEach(b=>{b.disabled=!on;});const v=el('amV'+id);if(v)v.textContent=on?val:hint;};
  row('alt',AFCS.alt&&!bl,afcsTargetText('alt'),'ALT off');row('vs',AFCS.vs&&!bl,afcsTargetText('vs'),'V/S off');
  row('hdg',AFCS.hdg&&!bl,afcsTargetText('hdg'),'HDG off');row('ias',AFCS.ias&&!bl,afcsTargetText('ias'),f?'IAS off':'above 40 kt');
  row('hov',AFCS.hov&&!bl,'','');
  el('amRhov').style.display=f?'none':'';el('amRias').style.display=f?'':'none';
  const w=el('amWhy');if(w)w.textContent=bl||AFCS_UI.msg||'';
}
function apMenuInit(){
  const el=id=>document.getElementById(id),m=el('apMenu');if(!m)return;
  const after=b=>{if(b&&b.blur)b.blur();apMenuSync();};
  el('apTab').onclick=()=>apMenuShow(true);el('amClose').onclick=()=>apMenuShow(false);
  const sm=el('asMenu');if(sm)sm.onclick=()=>{apMenuToggle();sm.blur();};
  m.querySelectorAll('[data-mode]').forEach(b=>{b.onclick=()=>{afcsToggle(b.dataset.mode);after(b);};});
  m.querySelectorAll('[data-adj]').forEach(b=>{b.onclick=()=>{const d=b.dataset.d;afcsAdjust(b.dataset.adj,b.dataset.adj==='hov'?d:parseFloat(d));after(b);};});
  el('amOff').onclick=()=>{afcsOffAll();after(el('amOff'));};
  apMenuSync();
}
function afcsButtons(){const f=S.ias>40*KT,b=id=>document.getElementById(id);
  if(b('asAlt'))b('asAlt').classList.toggle('on',AFCS.alt||AFCS.vs);if(b('asHdg'))b('asHdg').classList.toggle('on',AFCS.hdg);
  const sp=b('asSpd');if(sp){sp.textContent=f?'IAS':'HOV';sp.classList.toggle('on',f?AFCS.ias:AFCS.hov);}apMenuSync();}
function coachButtons(){const m=!COACH.on?'coachOff':COACH.voice?'coachVoice':'coachCues';for(const id of ['coachOff','coachCues','coachVoice']){const b=document.getElementById(id);if(b)b.classList.toggle('on',id===m);}}
function sideUpdate(dtF){
  debriefCheck(dtF||1/60);
  const el=id=>document.getElementById(id);const f0=v=>String(Math.round(v)||0);   // no "-0"
  UI.sideT=(UI.sideT||0)+1;if(UI.sideT%6===0){chartDraw();scoreUpdate();apMenuSync();}
  /* (2.12.8) frames per second (the average over about a second) in the GL line, and after the approach view
     is switched, the rate before and 3 s after: one number to compare on any machine */
  if(dtF>0&&dtF<0.5)UI.fps=UI.fps?UI.fps+(1/dtF-UI.fps)*Math.min(1,dtF/1):1/dtF;
  if(APR.fpsCmp&&performance.now()-APR.fpsCmp.t>3000){const c=APR.fpsCmp;APR.fpsCmp=null;APR.fpsNote=`approach view ${c.on?'on':'off'}: ${Math.round(c.f0)} → ${Math.round(UI.fps)} fps`;APR.fpsNoteT=performance.now();dlNote(APR.fpsNote[0].toUpperCase()+APR.fpsNote.slice(1));}
  if(UI.sideT%3===0){const su=document.getElementById('setup');if(su&&su.classList.contains('open'))padPanelUpdate();}
  if(UI.sideT%10===0){const hs=document.getElementById('htStatus'),hb=document.getElementById('htRun');if(hs&&hs.textContent!==HT.status)hs.textContent=HT.status;if(hb){const t=HT.busy?'Head tracking: starting…':HT.on?'Head tracking: stop':'Head tracking (webcam): start';if(hb.textContent!==t)hb.textContent=t;}}
  /* the numbers at 15 Hz, and only what changed: every text change costs the page a style and layout
     pass (2.2 rewrote all of them every frame) */
  UI.sideAcc=(UI.sideAcc||0)+(dtF||1/60);if(UI.sideAcc<1/15)return;UI.sideAcc=0;
  if(UI.sideT%15===0)afcsButtons();
  const set=(id,v)=>{const e=el(id);if(e&&e.__t!==v){e.__t=v;e.textContent=v;}},col=(id,v)=>{const e=el(id);if(e&&e.__c!==v){e.__c=v;e.style.color=v;}};
  set('bigIas',f0(S.ias/KT));set('bigAlt',f0(S.hAGL/FT));set('bigVs',f0(S.vs/FPM));
  set('bigNr',S.NR.toFixed(1));set('bigFli',S.eng.fli.toFixed(1));
  col('bigNr',(S.NR<H.nr.minPowerOn||S.NR>H.nr.maxPowerOn)&&S.eng.mode!=='off'?'var(--hot)':'var(--ink)');
  col('bigFli',S.eng.fli>11?'var(--hot)':S.eng.fli>10?'var(--amber)':'var(--ink)');
  if(R3.info&&R3.canvas){const g=el('gl');set('gl',(R3.soft?'SOFTWARE RENDERING (the browser is not using the GPU: switch on hardware acceleration) · ':'')+`GL ${R3.info.depthBits}-bit depth · ${R3.info.fragHighp?'highp':'mediump only'} · ${GFX.mode}${cfg.gfx==='auto'?' (auto)':''} · ${R3.canvas.width}×${R3.canvas.height} px · ${Math.round(UI.fps||0)} fps${APR.fpsNote&&performance.now()-APR.fpsNoteT<60000?' · '+APR.fpsNote:''} · ${String(R3.info.renderer).slice(0,40)}`);const ti=R3.info.renderer+(GFX.why?' · '+GFX.why:'');if(g&&g.title!==ti)g.title=ti;col('gl',R3.soft?'var(--amber)':'');}
  set('stat',`${S.eng.mode.toUpperCase().padEnd(5)}${f0((S.Peng||S.Pload)/1e3).padStart(4)}kW N1 ${S.eng.e.map(e=>f0(e.N1).padStart(3)).join('/')} ${f0(S.m)}kg DA${f0(atmo(S.alt,cfg.dT).dalt/FT).padStart(6)}ft${f0(S.t).padStart(5)}s`);
  if(S.incident){const inc=el('inc');if(inc.dataset.t!==String(S.incident.t)){inc.dataset.t=String(S.incident.t);inc.textContent=S.incident.text;inc.title=S.incident.text;}
    set('incAge',`${Math.max(0,S.t-S.incident.t).toFixed(0)} s ago`);}
}
/* (2.14) the welcome card's level: the three profiles, the saved one marked */
function welcomeLevels(){const box=document.getElementById('wLevel');if(!box)return;
  if(!box.childElementCount){for(const [n,l] of [['beginner','Beginner'],['intermediate','Intermediate'],['realistic','Realistic']]){const b=document.createElement('button');b.dataset.p=n;b.textContent=l;b.title=PROFILE_NOTE[n];b.onclick=()=>{profileApply(n);b.blur();};box.appendChild(b);}}
  for(const b of box.querySelectorAll('button'))b.classList.toggle('on',b.dataset.p===cfg.profile);
  const t=document.getElementById('wLevelNote');if(t)t.textContent=PROFILE_NOTE[cfg.profile]||'';}
function boot(){
  const stage=document.getElementById('stage');
  settingsLoad();   // (2.14) before anything reads the settings
  window.addEventListener('pagehide',settingsSave);   // and what changed in the last second
  glInit(document.getElementById('world'));hudInit(document.getElementById('ovl'));inputInit(stage);buildSetup();
  document.getElementById('setupTab').onclick=()=>document.getElementById('setup').classList.toggle('open');
  for(const [id,fn] of [['rCold',()=>{cfg.resetKind='cold';uiReset('cold');}],['rPad',()=>{cfg.resetKind='pad';uiReset('pad');}],['rHover',()=>{cfg.resetKind='hover';uiReset('hover');}],['rHigh',()=>{cfg.resetKind='high';uiReset('high');}],['rCruise',()=>{cfg.resetKind='cruise';uiReset('cruise');}],
    ['eFail',()=>engineFailure('one')],['eBoth',()=>engineFailure('both')],['eRestore',()=>engineFailure('restore')],['eTail',()=>engineFailure('tail')],['csv',downloadCSV],['replay',()=>{REPLAY.on?replayStop():replayStart();}]])document.getElementById(id).onclick=fn;
  startExercise('free');UI.trig=false;
  document.getElementById('exercise').value='free';
  const ts=document.getElementById('tutorSel');LESSONS.forEach((L,i)=>{const op=document.createElement('option');op.value=String(i);op.textContent=(i+1)+' · '+L.title;ts.appendChild(op);});
  document.getElementById('tutorStart').onclick=()=>{tutorStart(parseInt(ts.value));document.getElementById('tutorStart').blur();};
  document.getElementById('tutorStop').onclick=()=>tutorStop();
  for(const [id,m] of [['coachOff','off'],['coachCues','cues'],['coachVoice','voice']])document.getElementById(id).onclick=()=>{coachSet(m);document.getElementById(id).blur();};
  coachSet(UI.coachMode||'cues');   // (2.16.1) the saved or the level's coach from the first frame
  for(const [id,k] of [['asAlt',()=>AFCS.vs?'vs':'alt'],['asHdg',()=>'hdg'],['asSpd',()=>S.ias>40*KT?'ias':'hov']])document.getElementById(id).onclick=()=>{afcsToggle(k());document.getElementById(id).blur();};afcsButtons();apMenuInit();
  ts.onchange=()=>{if(TUTOR.on)tutorStart(parseInt(ts.value));ts.blur();};
  document.querySelectorAll('#setupBody select').forEach(el=>el.addEventListener('change',()=>el.blur()));
  // welcome card: the first thing a new pilot sees
  const w=document.getElementById('welcome');
  const wl=()=>{w.querySelector('h1').textContent='EC135 Flight Dynamics';
    w.querySelector('p').textContent='EC135 flight dynamics for learning. A helicopter has four controls that all talk to each other; the tutor hands them over one at a time in thirteen lessons, the stick in five stages. Mouse = stick (a click into the view captures it, Esc releases), W/S = collective, A/D = pedals; ? or F1 lists every key. The training aids are on; the setup\'s Level takes them away.';
    document.getElementById('wTutor').textContent='Start the tutor – lesson 1';document.getElementById('wFree').textContent='Fly free';};
  wl();
  welcomeLevels();
  const go=()=>{w.style.display='none';UI.started=true;soundStart();coachSet(UI.coachMode||'cues');};
  document.getElementById('wTutor').onclick=()=>{go();tutorStart(0);};
  document.getElementById('wFree').onclick=()=>{go();startExercise(UI.ex||'free');};   // (2.16.1) trimmed anew in the air the level chose
  window.addEventListener('blur',()=>{if(!UI.paused){UI.paused=true;UI.autoPaused=true;}});
  stage.addEventListener('mousedown',()=>{if(UI.autoPaused){UI.paused=false;UI.autoPaused=false;}});
  refreshTexts();
  requestAnimationFrame(loop);
}
