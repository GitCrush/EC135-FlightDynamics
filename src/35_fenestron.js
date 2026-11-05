/* ═══════════════ FENESTRON ═══════════════
   Shrouded fan at the tail. Ducted-fan momentum theory: the fan carries
   only part of the total thrust, the shroud lip the rest (half each for
   an exit area equal to the disc, sigma_d = 1). The fan therefore works
   at a higher inflow and lower blade loading than an open tail rotor of
   the same size, which is why it needs large pitch angles and why its
   thrust augmentation fades in forward flight, where the lip suction
   disappears. Three blade elements with the uniform fan inflow, the
   section stall from the same airfoil model (yaw authority saturates at
   high pitch: the Fenestron's version of loss of tail rotor
   effectiveness, worst with power on and the wind on the wrong side),
   and a first-order inflow lag. The fan pushes the tail against the
   main rotor's torque reaction: with the EC135's counterclockwise rotor
   (s = -1) the torque yaws the nose right, so the thrust acts along +y
   and the left pedal adds it. Written for either sense: the side is
   -s, the anti-torque pedal is s·ped (right for clockwise, left for
   counterclockwise). */
function fenInit(f){f.A=Math.PI*f.R*f.R;f.r=[];f.dr=f.R*0.8/f.Ne;for(let j=0;j<f.Ne;j++)f.r.push(0.2*f.R+(j+0.5)*f.dr);f.rt={a:f.a,cd0:f.cd0,cd2:0.5,aStall:f.aStall,Mdd:0.85};
  f.Am=f.A/(4*f.sd*f.sd);}                                 // momentum area of the fan alone
function fenState(){return {vi:20,T:0,Tfan:0,Q:0,P:0,th:0,stall:0,Vax:0,duct:1};}
function fenStep(f,st,dt,vb,om,wb,rho,aSound,OmMain,ped,wake,s){
  const side=-(s||1), pa=(s||1)*ped;                                  // thrust direction along y; pedal in the anti-torque sense
  /* Tail drive failure: the fan no longer turns with the rotor; it gives
     no thrust and takes no power. What is left against the rotor torque
     is the fin, the fuselage and the pilot's collective. */
  if(st.failed){st.T=0;st.Tfan=0;st.Q=0;st.P=0;st.stall=0;st.th=0;st.Vax=0;return {F:[0,0,0],M:[0,0,0],P:0};}
  const Om=OmMain*f.ratio;
  const vt=vsub(vadd(vb,vcross(om,f.pos)),wb);                    // tail velocity relative to air, body axes
  /* Axial flow through the duct in the wake direction (-side): moving
     the tail in the thrust direction feeds the fan like a climb, moving
     it the other way opposes its wake.
     The main-rotor downwash at the tail is in-plane for the fan: it
     costs a little of the shroud's augmentation in the hover. */
  const Vax=side*vt[1], Vip=Math.hypot(vt[0],vt[2]-(wake||0));
  st.Vax=Vax;
  const th=clamp(f.th0+pa*(pa>0?f.thMax-f.th0:f.th0-f.thMin),f.thMin,f.thMax);
  st.th=th;
  let T=0,Q=0,stallW=0;
  for(let j=0;j<f.Ne;j++){
    const r=f.r[j], UT=Om*r, UP=Vax+st.vi;
    const U2=UT*UT+UP*UP,U=Math.sqrt(U2), phi=Math.atan2(UP,UT), al=th-phi;
    const [cl,cd]=airfoil(al,U/aSound,f.rt);
    const qc=0.5*rho*U2*f.c*f.dr*f.N;
    const L=qc*cl,D=qc*cd;
    T+=(L*UT-D*UP)/U; Q+=r*(L*UP+D*UT)/U;
    if(Math.abs(al)>f.aStall)stallW+=1;
  }
  /* Fan inflow and shroud thrust from ducted-fan momentum theory with the
     axial flow V through the duct (Vax; exit/disc area ratio sd = sigma):
     fan plane velocity vf = V + vi, exit velocity vf/sigma,
       fan thrust    Tf = 1/2 rho A (vf²/sigma² - V²)
       total thrust  T  = rho A vf (vf/sigma - V)     (fan + shroud lip).
     In the static case this is the fan carrying 1/(2 sigma) of the total,
     as before; with axial flow it also gives the duct's ram drag, the
     mass flow (40 kg/s in the hover) taking the tail's sideways velocity:
     the main source of the Fenestron's yaw damping, which the fan-alone
     relation used until 1.8 left at about 60 %. In-plane flow (forward
     flight, the rotor wake) fades the duct toward an open fan. */
  /* Duct effectiveness: 1 static, toward 0 edgewise. The lip suction needs the flow to enter
     the inlet all round; a crossflow of the order of the fan's own through-flow separates it
     on the windward lip. Flight speed across the duct (2.0) fades it faster than the main-
     rotor downwash (0.5), which only grazes the upper lip in the hover. (Until 2.0 both
     counted 0.5: at 60 kt the duct still gave half its static augmentation, and its
     momentum relation cancelled most of a sideslip's effect on the fan, ~15 N per m/s of
     sideways flow at 60 kt against ~35 for an open fan.) */
  const vfa=Math.max(Math.abs(Vax+st.vi),5),fd=1/(1+(2.0*(vt[0]*vt[0]+vt[2]*vt[2])+0.5*(wake||0)*(wake||0))/(vfa*vfa));
  let vi;
  if(T>0){const vfD=f.sd*Math.sqrt(Math.max(2*T/(rho*f.A)+Vax*Vax,0));   // ducted inversion: vf from Tf and V
    const viD=vfD-Vax;
    let viO=st.vi;for(let it=0;it<4;it++){const V=Math.max(Math.sqrt(Vip*Vip+(Vax+viO)*(Vax+viO)),2);viO=0.5*viO+0.5*T/(2*rho*f.A*V);}   // open fan in edgewise flow
    vi=fd*viD+(1-fd)*viO;}
  /* Reverse thrust: the shroud adds little (see below), so the fan works as an open fan of
     its own disc area, static or edgewise. (Until 2.0 a quarter of the disc, which in
     cruise, where the fan sits near zero thrust, made the induced flow cancel most of a
     sideslip: the fan's weathercock and yaw damping at speed came out at ~40 %.) */
  else{const Tm=Math.max(-T,1);vi=st.vi;for(let it=0;it<4;it++){const V=Math.max(Math.sqrt(Vip*Vip+(Vax+vi)*(Vax+vi)),2);vi=0.5*vi-0.5*Tm/(2*rho*f.A*V);}}
  st.vi+=(vi-st.vi)*Math.min(1,dt/f.tau);
  st.duct=fd;
  /* Reverse thrust (pedal past zero thrust, with the torque): the lip suction that gives the
     shroud its share only works with the flow entering over the rounded
     inlet; pushed backwards, the flow leaves over that lip and enters
     through the stator side, so the shroud adds little. */
  const vf=Vax+st.vi;
  const Tduct=T>0?rho*f.A*vf*(vf/f.sd-Vax):0;   // total by momentum (fan + lip)
  st.Tfan=T;st.T=T>0?T+fd*Math.max(Tduct-T,-T):T*(1+0.15*f.sd*fd);st.Q=Q;st.P=Q*Om;st.stall=stallW/f.Ne;
  const F=[0,side*st.T,0];
  return {F,M:vcross(f.pos,F),P:st.P};
}

/* ═══════════════ ENGINES, GOVERNOR, ROTOR SPEED ═══════════════
   Two turbines as first-order power lags with an acceleration limit,
   governed by a FADEC that holds 100 % NR: proportional + integral on the
   NR error plus a load feedforward (the real FADEC uses collective
   anticipation; feeding forward the measured rotor load is the same
   idea and needs no separate sensor model). Ratings clamp the command,
   the transmission clamps the sum. Power reaches the rotor through a
   freewheel: torque flows only in the driving direction, so with the
   engines at idle or dead the rotor is free to autorotate. */
function engState(e){const a=[];for(let i=0;i<e.n;i++)a.push({P:0,cmd:0,on:true,fail:false,N1:0,startT:0,sw:'flight',TOT:500,dir:-1});return {e:a,brake:false,oat:15,int:0,mode:'twin',fli:0,limit:'',Qdrive:0,Qmast:0,Pavail:0,Pdemand:0,Pmcp:1,P2:1,Ptop:1,tAbove:0,tAbove30:0,oeiT:0};}
/* Start: the starter brings N1 to idle in about 25 s, the FADEC then
   governs NR up; the drive torque at low rotor speed is capped by what
   the turbine can deliver through the freewheel, which is what makes a
   rotor run-up take the better part of a minute. */
function engStart(st){st.brake=false;st.e.forEach((en,i)=>{if(!en.on&&!en.fail){en.on=true;en.startT=25;en.N1=0;en.sw='flight';en.dir=-1;engFaultTake(st,i);}});}
/* (2.17.1) Start faults, armed for one engine's next start (the menu, Failures & data; ENGFAULT.next = {i, kind}):
   'hot': the fuel comes in rich, the TOT runs past the start limits, 1000 °C at its peak if nothing is done;
   'hung': the engine lights and accelerates but stops at 42 % N1 short of idle, the TOT creeping up 6 °C a second
   from 700 °C. The limits watched in the start (PW206B2 of the P2+, from a training deck of the flight manual's
   limits, not the manual itself): 760 °C at most for a continuous start, 875 °C for 2 s at most. Beyond 875 °C for
   more than 2 s, or past 950 °C at all, the turbine is damaged: the engine fails (Restore repairs it). The FADEC
   here does not abort for you; the switch to OFF does, and the TOT then falls as the engine runs down. */
const ENGFAULT={next:null};   // armed for the next start, {i, kind}: outside the state, a reset (the cold start) keeps it
function engFaultTake(st,i){const en=st.e[i];en.fault=null;en.hungT=0;en.overT=0;en.peakTOT=0;if(ENGFAULT.next&&ENGFAULT.next.i===i){en.fault=ENGFAULT.next.kind;ENGFAULT.next=null;}}
function engStop(st){for(const en of st.e){en.on=false;en.startT=0;en.sw='off';en.dir=1;}}
/* (2.16) The start as flown. Each engine has its main switch, OFF - IDLE - FLIGHT. IDLE from OFF starts it:
   the starter turns it up, it lights at about 12 % N1, the turbine outlet temperature (TOT) peaks during the
   acceleration and settles at ground idle (N1 62 % here) after about 25 s. With no engine in FLIGHT the
   FADEC holds the rotor at a ground-idle speed (70 % NR here); FLIGHT runs it up to 100 %. One engine
   after the other: the second is started once the first is at idle. The rotor brake holds the rotor
   stopped after a cold reset; no start with it on, and it is applied only with the engines off and the
   rotor below 50 % NR. The figures (idle N1 and NR, the TOT curve: about 480 °C at idle, a peak near
   740 °C in the start, about 820 °C at take-off power) are the typical shape of a small turboshaft's
   start, not the type's flight-manual values. Returns '' or why not. */
function engSwitch(st,i,to){const en=st.e[i];if(!en)return 'no engine';
  if(to==='idle'&&!en.on){if(en.fail)return 'failed';if(st.brake)return 'brake';en.on=true;en.startT=25;en.N1=0;en.sw='idle';engFaultTake(st,i);return '';}
  if(to==='idle'){en.sw='idle';return '';}
  if(to==='flight'){if(!en.on)return 'off';en.sw='flight';return '';}
  if(to==='off'){en.on=false;en.startT=0;en.sw='off';return '';}
  return '?';}
function engBrake(st,on,NRpct){if(!on){st.brake=false;return '';}if(st.e.some(x=>x.on&&!x.fail))return 'engines';if(NRpct>50)return 'nr';st.brake=true;return '';}
function engStep(e,st,dt,NRpct,Pload,dCol,colRate,Pcap,lapse){
  const kL=lapse===undefined?1:lapse;st.lapse=kL;   // above 1 (cold, low) the transmission limits
  for(const en of st.e)if(en.startT>0)en.startT-=dt;
  if(st.brake&&st.e.some(x=>x.on&&!x.fail))st.brake=false;   // an engine turning: the brake is off (a start sets the switch only with it off)
  const nRun=st.e.filter(x=>x.on&&!x.fail&&x.startT<=0).length;
  const nFlight=st.e.filter(x=>x.on&&!x.fail&&x.startT<=0&&x.sw!=='idle').length;   // (2.16) IDLE: the FADEC holds ground idle
  const err=(nFlight||!nRun?100:70)-NRpct;st.nrTgt=nFlight||!nRun?100:70;
  const nStart=st.e.filter(x=>x.on&&!x.fail&&x.startT>0).length;
  st.mode=nRun===2?'twin':nRun===1?'oei':nStart?'start':'off';
  /* Available power per rating: the smaller of the turbines' thermodynamic
     rating in the present air and the transmission torque limit at the
     present rotor speed. Twin: MCP and take-off; OEI: MCP, 2 min, 30 s. */
  const m=e.pRef*Math.min(kL,Math.max(NRpct,50)/100), c=e.tcds;   // ratings scale with the smaller of turbine lapse and rotor speed
  let Pmcp=1,P2=1,Ptop=1;
  if(nRun===2){Pmcp=2*c.mcp*m;Ptop=2*c.top*m;P2=Ptop;}
  else if(nRun===1){Pmcp=c.oeiMcp*m;P2=c.oei2*m;Ptop=c.oei30*m;}
  const totalMax=nRun?Ptop:0, perMax=nRun?Ptop/nRun:0;
  st.Pmcp=Pmcp;st.P2=P2;st.Ptop=Ptop;
  st.Pavail=totalMax;
  /* Governor: feedforward of the current load, referred to nominal NR
     (the measured load rises with NR³; fed forward unreferred it would be
     positive feedback), plus PI on the NR error with anti-windup. */
  const k=clamp(100/Math.max(NRpct,50),0.5,2);
  /* the load reaches the fuel control through filtered torque and speed signals: ~0.15 s
     (until 2.0 it was fed forward instantly, and a collective step drooped NR by 0.27 %) */
  st.ffP=st.ffP===undefined?Math.max(0,Pload):st.ffP+(Math.max(0,Pload)-st.ffP)*Math.min(1,dt/0.15);
  const ff=st.ffP*k*k*k+colRate*e.kp*8;   // Pload here is the engines' whole load (S.Peng)
  st.int=clamp(st.int+err*dt*e.ki,-150e3,150e3);
  let cmd=ff+err*e.kp+st.int;
  if(cmd>totalMax){st.int-=err*dt*e.ki;cmd=totalMax;}
  if(Pcap!==undefined&&cmd>Pcap){st.int-=err*dt*e.ki;cmd=Pcap;}   // run-up schedule
  if(cmd<e.idle*nRun)cmd=e.idle*nRun;
  st.Pdemand=cmd;
  let Ptot=0;const nIdle=nRun-nFlight,share=nFlight?Math.max(cmd-nIdle*e.idle,0)/nFlight:cmd/Math.max(nRun,1);
  const oat=st.oat===undefined?15:st.oat,totT=(en,tgt)=>{en.TOT=(en.TOT===undefined?oat:en.TOT)+(tgt-(en.TOT===undefined?oat:en.TOT))*Math.min(1,dt/(tgt>en.TOT?1.0:en.on?2.5:40));};
  for(const en of st.e){
    if(!en.on||en.fail){en.cmd=0;en.P=approach(en.P,0,dt*(en.fail?600e3:200e3));en.N1=Math.max(0,en.N1-dt*8);totT(en,en.N1>12?480*en.N1/62:oat);continue;}
    if(en.startT>0){en.cmd=0;en.P=approach(en.P,0,dt*100e3);
      if(en.fault==='hung'&&en.startT<25*(1-0.68)){en.startT=25*(1-0.68);en.hungT=(en.hungT||0)+dt;}   // (2.17.1) it stops at 42 % N1 and never reaches idle
      en.N1=lerp(0,62,1-en.startT/25);
      const pk=en.fault==='hot'?520:260;let tgt=en.N1<12?oat:480+pk*Math.exp(-(((en.N1-32)/14)**2));
      if(en.fault==='hot'&&en.N1>32)tgt=Math.max(tgt,480+pk*0.9);   // rich: it stays hot past the peak
      if(en.fault==='hung'&&en.hungT>0)tgt=Math.max(tgt,700+6*en.hungT);
      totT(en,tgt);en.peakTOT=Math.max(en.peakTOT||0,en.TOT);
      en.overT=en.TOT>875?(en.overT||0)+dt:0;
      if(en.TOT>950||en.overT>2){en.fail=true;en.damaged=true;en.on=false;en.startT=0;en.sw='off';}   // the turbine damaged
      continue;}   // light-off at 12 %, the peak in the acceleration   // light-off at 12 %, the peak in the acceleration
    en.cmd=clamp(nFlight&&en.sw==='idle'?e.idle:share,e.idle,perMax);
    const dP=clamp((en.cmd-en.P)/e.tau,-e.rate*3,e.rate);
    en.P+=dP*dt;
    en.N1=lerp(62,101,clamp(en.P/e.top,0,1.05));
    totT(en,480+340*clamp(en.P/e.top,0,1.1));
    Ptot+=en.P;
  }
  /* First limit indicator, one scale for whichever limit is closer:
     twin 10 = MCP, 11 = take-off; OEI 10 = OEI MCP, 11 = 2 min, 12 = 30 s. */
  const seg=(P,a,b)=>(P-a)/Math.max(b-a,1e3);
  const fliOf=P=>nRun===0?0:P<=Pmcp?10*P/Pmcp:nRun===2?10+seg(P,Pmcp,Ptop):P<=P2?10+seg(P,Pmcp,P2):11+seg(P,P2,Ptop);
  st.fli=fliOf(Ptot);
  st.fliDem=fliOf(Math.max(0,Pload)*k*k*k);   // what the rotor asks for now, referred to 100 % NR; the turbines follow 0.5 s later (used by the metered collective)
  /* Time above the continuous ratings, for the time limits. Twin: above
     MCP (5 min). OEI: above OEI MCP in all (2.5 min) and above the 2-min
     rating (30 s); an OEI event starts the clocks once. */
  if(nRun===2){st.tAbove=Ptot>Pmcp*1.005?(st.tAbove||0)+dt:0;st.tAbove30=0;st.oeiT=0;}
  else if(nRun===1){st.oeiT=(st.oeiT||0)+dt;if(Ptot>Pmcp*1.005)st.tAbove=(st.tAbove||0)+dt;if(Ptot>P2*1.005)st.tAbove30=(st.tAbove30||0)+dt;}
  st.limit=nRun===2?(Ptot>Pmcp*1.005?'TOP':''):nRun===1?(Ptot>P2*1.005?'OEI 30s':Ptot>Pmcp*1.005?'OEI 2min':'OEI'):'OFF';
  return Ptot;
}
