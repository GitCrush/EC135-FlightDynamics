/* Consistency harness: flies the model through the reference conditions
   and compares with flight-manual / textbook numbers. Run with `node
   test/consistency.js`; exit code 1 on ERROR (CI). Each scenario prints
   what it measured, so a failed check tells you which mechanism drifted. */
const {loadEngine}=require('./load.js');
const RES=[];let errors=0;
function check(name,val,lo,hi,unit='',warnBand=0){
  const ok=val>=lo&&val<=hi;
  const warn=!ok&&val>=lo-warnBand&&val<=hi+warnBand;
  const tag=ok?'OK   ':warn?'WARN ':'ERROR';
  if(!ok&&!warn)errors++;
  const v=typeof val==='number'?val.toFixed(Math.abs(val)<10?2:0):val;
  console.log(`  ${tag} ${name.padEnd(46)} ${String(v).padStart(8)} ${unit.padEnd(4)} [${lo}..${hi}]`);
}
function fresh(){const E=loadEngine();E.WIND.spd=0;E.WIND.turb=0;E.cfg.mass=2500;E.cfg.dT=0;return E;}
function fly(E,sec,setup,every){const {IN,AP,step,apStep,DT}=E;let n=0;for(let t=0;t<sec;t+=DT){if(setup)setup(t);const o=apStep(DT);IN.col=o.col;IN.lon=o.lon;IN.lat=o.lat;IN.ped=o.ped;step(DT);if(every&&++n%every===0)every.call&&every(t);}}
function hover(E,sec,alt){const {AP,reset}=E;reset('high');E.S.pos[2]=-(alt||304.8);AP.on=true;AP.mode='hover';AP.alt=-E.S.pos[2];AP.hdg=0;AP.vN=0;AP.vE=0;AP.auto=false;fly(E,sec);}
function cruise(E,kt,sec,vs){const {AP,reset}=E;reset('cruise');E.S.vb[0]=kt*E.KT;E.S.rot.lam0=0.02;AP.on=true;AP.mode='cruise';AP.ias=kt;if(vs===undefined){AP.alt=-E.S.pos[2];}else{AP.alt=null;AP.vs=vs;}AP.auto=false;fly(E,sec);}

console.log('\n■ Hover trim, 2500 kg, 1000 ft, ISA');
{const E=fresh();hover(E,40);const S=E.S;
 check('vertical speed',S.vs/E.FPM,-30,30,'fpm');
 check('thrust / weight',S.rot.T/(E.cfg.mass*9.81),1.00,1.06,'');
 check('power required',S.Pload/1e3,380,470,'kW');
 check('FLI (10 = maximum continuous, from the TCDS ratio and the turbine lapse)',S.eng.fli,6.5,8.5,'');
 check('collective (0..1)',S.ctl.col,0.42,0.56,'');
 check('blade pitch at 0.75R',(E.H.rotor.col0+S.ctl.col*(E.H.rotor.col1-E.H.rotor.col0))*E.RAD,8,10.5,'deg');
 check('pedal (left −: against the torque of the counterclockwise rotor)',S.ctl.ped,-0.65,-0.25,'');
 check('Fenestron thrust',S.fen.T,1300,2300,'N');
 check('Fenestron power share',S.fen.P/S.Pload,0.06,0.14,'');
 check('roll attitude (left skid low −)',S.eul[0]*E.RAD,-6,-1.5,'deg');
 check('pitch attitude',S.eul[1]*E.RAD,1,6,'deg');
 check('NR',S.NR,99.5,100.5,'%');
 check('coning',S.rot.beta.reduce((a,b)=>a+b,0)/4*E.RAD,2,4,'deg');
 check('mean induced inflow ratio',S.rot.lam0,0.048,0.062,'');
 check('lateral drift',Math.abs(S.vb[1]),0,0.3,'m/s');
}
console.log('\n■ Hover free response (controls frozen after trim, 2 °/s pitch-rate kick)');
{const E=fresh();hover(E,40);const {IN,step,DT}=E;const S0={th:E.S.eul[1],phi:E.S.eul[0]};let tDouble=null,maxDev=0;
 E.S.om[1]+=2*E.DEG;   // a defined disturbance: without one the excursion depended on trim residue (until 1.7 this check could not fail)
 for(let t=0;t<40;t+=DT){step(DT);const d=Math.abs(E.S.eul[1]-S0.th);if(d>maxDev)maxDev=d;if(!tDouble&&d>5*E.DEG)tDouble=t;}
 check('time to 5 deg pitch excursion',tDouble===null?99:tDouble,3,25,'s');   // unstable but slow: seconds for the pilot (modes in test/qualities.js)
 check('NR held by FADEC through it',E.S.NR,98,102,'%');
}
console.log('\n■ Governor: +6 % collective step in hover');
{const E=fresh();hover(E,30);const {IN,step,DT}=E;const c0=IN.col;let nrMin=200,nrMax=0;
 for(let t=0;t<6;t+=DT){IN.col=c0+0.06;step(DT);nrMin=Math.min(nrMin,E.S.NR);nrMax=Math.max(nrMax,E.S.NR);}
 check('NR minimum (transient droop)',nrMin,98.0,100,'%');
 check('NR maximum',nrMax,100,102,'%');
 check('climb after 6 s',E.S.vs/E.FPM,250,800,'fpm');
}
console.log('\n■ Ground effect: hover power vs skid height');
{const P={};for(const h of [0.3,3,30]){const E=fresh();E.reset('hover');E.S.pos[2]=-(h+1.3);E.AP.on=true;E.AP.mode='hover';E.AP.alt=h+1.3;E.AP.hdg=0;fly(E,60);P[h]=E.S.Pload;}
 /* The model uses the Cheeseman-Bennett formula itself, so this guards the
    implementation (induced share, height), it does not validate the formula. */
 check('power IGE (skids at 0.3 m) / OGE',P[0.3]/P[30],0.80,0.93,'');
 check('power at 3 m / OGE',P[3]/P[30],0.90,0.99,'');
}
console.log('\n■ Level flight power (2500 kg, 1500 ft)');
{const P={};for(const v of [40,60,80,100,120,135]){const E=fresh();cruise(E,v,80);P[v]=E.S.Pload/1e3;const S=E.S;if(process.env.V)console.log('   ',v,'kt',P[v].toFixed(0),'kW vs',(S.vs/E.FPM).toFixed(0),'ias',(S.ias/E.KT).toFixed(1));
  if(v===135){check('IAS reached',S.ias/E.KT,130,140,'kt');check('pitch attitude at 135 kt',S.eul[1]*E.RAD,-9,-3,'deg');check('retreating stall fraction',S.rot.stall,0,0.15,'');}}
 check('bucket power (60 kt)',P[60],230,320,'kW');
 /* bands: the flight-test author's power build-up (flighttest/cards.json, F1.2: total shaft power,
    f = 1.2-1.5 m², Cd0 and kappa spread) less ~15 kW of accessories, which Pload leaves out.
    (Until 1.8 330-430 / 430-560 / 560-720 kW, set when the Fenestron still carried the
    anti-torque at speed: 40-60 kW of it.) */
 check('power 100 kt',P[100],250,370,'kW');
 check('power 120 kt',P[120],315,470,'kW');
 check('power 135 kt (MCP at 2500 kg: ~610)',P[135],405,590,'kW');
 check('bucket below 40 kt power',P[60]/P[40],0.75,1.0,'');
}
console.log('\n■ Climb at Vy, take-off power');
{const E=fresh();cruise(E,65,50,12);const S=E.S;
 check('rate of climb',S.vs/E.FPM,1500,2800,'fpm');
 check('power used',S.Pload/1e3,600,710,'kW');
 check('NR',S.NR,98.5,101.5,'%');
}
console.log('\n■ Autorotation, 65 kt');
{const E=fresh();cruise(E,70,20);for(const en of E.S.eng.e)en.on=false;E.AP.auto=true;E.AP.ias=65;fly(E,25);const S=E.S;
 check('sink rate',-S.vs/E.FPM,1500,2300,'fpm');
 check('NR (TCDS power-off range 85–106 %)',S.NR,85,106,'%');
 check('collective',S.ctl.col,0,0.2,'');
 check('rotor power (driven by the air, <0)',S.rot.P/1e3,-60,10,'kW');   // it drives the Fenestron's reverse thrust against the cambered fin (until 1.8: -40)
}
console.log('\n■ Vortex ring state: vertical descent at 1600 fpm');
{const E=fresh();E.reset('high');E.AP.on=true;E.AP.mode='hover';E.AP.alt=null;E.AP.vs=-8;E.AP.hdg=0;let vrsMax=0,inc=null;
 fly(E,30,t=>{if(E.S.rot.vrs>vrsMax)vrsMax=E.S.rot.vrs;if(E.S.incident&&E.S.incident.id==='vrs')inc=E.S.incident;});
 check('VRS depth reached',vrsMax,0.6,1.0,'');
 check('incident detector fired',inc?1:0,1,1,'');
 // recovery: forward speed
 E.AP.vs=0;E.AP.vN=20;fly(E,12);
 check('sink after Vuichard/forward recovery',-E.S.vs/E.FPM,-800,400,'fpm');
 check('VRS cleared',E.S.rot.vrs,0,0.2,'');
}
console.log('\n■ Control response from hover (steps for 1 s)');
{const E=fresh();hover(E,30);const {IN,step,DT}=E;const c={...IN};let pMax=0;for(let t=0;t<1;t+=DT){IN.lat=c.lat+0.2;step(DT);pMax=Math.max(pMax,E.S.om[0]*E.RAD);}
 check('roll rate for +20 % lateral',pMax,10,40,'°/s');
 const E2=fresh();hover(E2,30);const c2={...E2.IN};let qMin=0;for(let t=0;t<1;t+=DT){E2.IN.lon=c2.lon+0.2;E2.step(DT);qMin=Math.min(qMin,E2.S.om[1]*E2.RAD);}
 check('pitch rate for +20 % longitudinal (nose down)',-qMin,8,55,'°/s');
 const E3=fresh();hover(E3,30);const c3={...E3.IN};let rMax=0;for(let t=0;t<1;t+=DT){E3.IN.ped=c3.ped-0.3;E3.step(DT);rMax=Math.max(rMax,-E3.S.om[2]*E3.RAD);}
 check('yaw rate for 30 % more left pedal (1 s)',rMax,20,70,'°/s');
 const E4=fresh();hover(E4,30);const c4={...E4.IN};let rM=0;for(let t=0;t<2;t+=DT){E4.IN.ped=c4.ped-0.5;E4.step(DT);rM=Math.max(rM,-E4.S.om[2]*E4.RAD);}
 check('yaw rate for 50 % more left pedal (2 s)',rM,40,160,'°/s');   // a Fenestron is quick in yaw (no published data)
}
console.log('\n■ One engine inoperative in hover');
{const E=fresh();hover(E,30);E.S.eng.e[0].fail=true;let nrMin=200;fly(E,12,t=>{nrMin=Math.min(nrMin,E.S.NR);});const S=E.S;
 check('NR minimum after failure',nrMin,93,100,'%');
 check('hover held (vs)',S.vs/E.FPM,-300,200,'fpm');
 check('power on the remaining engine',S.Pload/1e3,380,560,'kW');
 check('FLI in OEI scale',S.eng.fli,8,12.5,'');
}
console.log('\n■ On the ground');
{const E=fresh();E.reset('pad');E.IN.col=0.05;for(let t=0;t<8;t+=E.DT)E.step(E.DT);const S=E.S;
 check('contacts',S.gear.contact,4,4,'');
 check('drift in 8 s',Math.hypot(S.pos[0],S.pos[1]),0,0.1,'m');
 check('yaw creep',Math.abs(S.om[2]*E.RAD),0,1.0,'°/s');
 check('flat-pitch power',S.Pload/1e3,80,180,'kW');
 // dynamic rollover: on the ground, lateral cyclic with partial collective
 E.IN.col=0.36;let rolled=false,inc=null;for(let t=0;t<8;t+=E.DT){if(t>2)E.IN.lat=0.6;E.step(E.DT);if(Math.abs(E.S.eul[0])>0.3)rolled=true;if(E.S.incident&&(E.S.incident.id==='rollover'||E.S.incident.id==='crash'))inc=E.S.incident.id;}
 check('dynamic rollover with 60 % lateral at light skids',rolled?1:0,1,1,'');
 check('rollover/crash flagged',inc?1:0,1,1,'');
}
console.log('\n■ Rotor-speed governing (FADEC) in the hover: collective dump and pull, AP on the other axes');
for(const [name,dc,tr] of [['dump to near flat pitch in 0.5 s',-0.35,0.5],['pull of 0.15 in 1 s (below the take-off limit)',0.15,1]]){
 const E=fresh();hover(E,20);const {IN,DT}=E,c0=E.S.ctl.col;let mx=0,mn=200,late=0,cross=0,side=0;
 for(let t=0;t<12;t+=DT){const o=E.apStep(DT);IN.lon=o.lon;IN.lat=o.lat;IN.ped=o.ped;IN.col=c0+dc*Math.min(1,t/tr);E.step(DT);const nr=E.S.NR;
   mx=Math.max(mx,nr);mn=Math.min(mn,nr);if(t>6)late=Math.max(late,Math.abs(nr-100));const sd=nr>100.3?1:nr<99.7?-1:0;if(sd&&side&&sd!==side)cross++;if(sd)side=sd;}
 check(`${name}: NR range, low`,mn,97,100.5,'%');check(`${name}: NR range, high`,mx,99.5,104,'%');
 check(`${name}: NR settled after 6 s`,late,0,0.5,'%');check(`${name}: NR swings through 100 % (zeta)`,cross,0,2,'');}
console.log('\n■ Crosswind hover, 25 kt (Fenestron margins)');
{for(const [d,name] of [[90,'from the right (wake direction)'],[270,'from the left (against the wake)']]){const E=fresh();E.WIND.dir=d;E.WIND.spd=25/E.windProfile(300);hover(E,45);const S=E.S;   // 25 kt at the aircraft (300 m), not at the 10 m reference

  check('pedal, wind '+name,S.ctl.ped,d===90?-0.9:-0.4,d===90?-0.3:0.4,'');check('Fenestron stall fraction, wind '+name,S.fen.stall,0,0.7,'');check('heading held, wind '+name,Math.abs(S.eul[2]*E.RAD),0,4,'deg');}}
console.log('\n■ Maximum take-off mass, 140 kt');
{const E=fresh();E.cfg.mass=2910;cruise(E,135,70);const S=E.S;   // 140 kt at MTOW needs take-off power at 1000 ft once the turbines lapse with altitude
 check('IAS reached at MTOW',S.ias/E.KT,131,138,'kt');check('power at MTOW 135 kt (below the take-off limit, ~675 kW here)',S.Pload/1e3,560,675,'kW');check('forward cyclic margin',S.ctl.lon,0.4,0.9,'');check('NR',S.NR,98.5,101.5,'%');}
console.log('\n■ Cold start and shutdown');
{const E=fresh();E.reset('cold');E.IN.col=0.02;E.S.eng.e.forEach(en=>{en.on=true;en.startT=25;});let t100=null;for(let t=0;t<120;t+=E.DT){E.step(E.DT);if(!t100&&E.S.NR>99)t100=t;}
 check('time to 100 % NR from a cold start',t100||120,40,90,'s');
 E.S.eng.e.forEach(en=>en.on=false);let tStop=null;for(let t=0;t<200;t+=E.DT){E.step(E.DT);if(!tStop&&E.S.NR<1)tStop=t;}
 check('rotor stop after shutdown',tStop||200,40,150,'s');check('blade droop on the stop',E.S.rot.beta[0]*E.RAD,-6.5,-1,'deg');}
console.log('\n■ Determinism and invariants');
{const a=fresh(),b=fresh();a.WIND.turb=2;b.WIND.turb=2;hover(a,20);hover(b,20);
 check('identical runs with turbulence',a.S.pos[0]===b.S.pos[0]&&a.S.NR===b.S.NR?1:0,1,1,'');
 const E=fresh();hover(E,10);const {step,DT}=E;let ok=true,maxB=0;for(let t=0;t<10;t+=DT){step(DT);for(const bb of E.S.rot.beta)maxB=Math.max(maxB,Math.abs(bb));if(!isFinite(E.S.NR)||!isFinite(E.S.pos[2]))ok=false;}
 check('finite state',ok?1:0,1,1,'');check('max flap angle',maxB*E.RAD,0,12,'deg');
 check('bookkeeping: power = torque x speed (invariant, not validation)',Math.abs(E.S.rot.P-E.S.rot.Q*E.S.rot.Om)/Math.abs(E.S.rot.P)*100,0,0.1,'%');
}
console.log(`\n${errors?errors+' ERROR(s)':'all checks within range'}\n`);
process.exit(errors?1:0);
