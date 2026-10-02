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
   and a first-order inflow lag. Thrust acts along -y (to the left) for
   positive pedal; the sense matches a clockwise main rotor whose torque
   yaws the nose left. */
function fenInit(f){f.A=Math.PI*f.R*f.R;f.r=[];f.dr=f.R*0.8/f.Ne;for(let j=0;j<f.Ne;j++)f.r.push(0.2*f.R+(j+0.5)*f.dr);f.rt={a:f.a,cd0:f.cd0,cd2:0.5,aStall:f.aStall,Mdd:0.85};
  f.Am=f.A/(4*f.sd*f.sd);}                                 // momentum area of the fan alone
function fenState(){return {vi:20,T:0,Tfan:0,Q:0,P:0,th:0,stall:0,Vax:0,duct:1};}
function fenStep(f,st,dt,vb,om,wb,rho,aSound,OmMain,ped,wake){
  const Om=OmMain*f.ratio;
  const vt=vsub(vadd(vb,vcross(om,f.pos)),wb);                    // tail velocity relative to air, body axes
  /* Axial flow through the duct in the wake direction (+y): moving left
     (v<0) feeds the fan like a climb; moving right opposes its wake.
     The main-rotor downwash at the tail is in-plane for the fan: it
     costs a little of the shroud's augmentation in the hover. */
  const Vax=-vt[1], Vip=Math.hypot(vt[0],vt[2]-(wake||0));
  st.Vax=Vax;
  const th=clamp(f.th0+ped*(ped>0?f.thMax-f.th0:f.th0-f.thMin),f.thMin,f.thMax);
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
  // fan inflow toward the ducted momentum value for the current fan thrust
  const Tm=Math.max(Math.abs(T),1);
  let vi=st.vi;
  for(let it=0;it<4;it++){const V=Math.max(Math.sqrt(Vip*Vip+(Vax+vi)*(Vax+vi)),2);vi=0.5*vi+0.5*Math.sign(T||1)*Tm/(2*rho*f.Am*V);}
  st.vi+=(vi-st.vi)*Math.min(1,dt/f.tau);
  // shroud thrust share: full in the static case, gone once the in-plane flow dominates
  const duct=f.sd/(1+0.5*Math.pow(Vip/Math.max(Math.abs(st.vi),5),2));
  st.duct=duct;
  /* Reverse thrust (left pedal past zero): the lip suction that gives the
     shroud its share only works with the flow entering over the rounded
     inlet; pushed backwards, the flow leaves over that lip and enters
     through the stator side, so the shroud adds little. */
  st.Tfan=T;st.T=T>0?T*(1+duct):T*(1+0.15*duct);st.Q=Q;st.P=Q*Om;st.stall=stallW/f.Ne;
  const F=[0,-st.T,0];
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
function engState(e){const a=[];for(let i=0;i<e.n;i++)a.push({P:0,cmd:0,on:true,fail:false,N1:0,startT:0});return {e:a,int:0,mode:'twin',fli:0,limit:'',Qdrive:0,Pavail:0,Pdemand:0};}
/* Start: the starter brings N1 to idle in about 25 s, the FADEC then
   governs NR up; the drive torque at low rotor speed is capped by what
   the turbine can deliver through the freewheel, which is what makes a
   rotor run-up take the better part of a minute. */
function engStart(st){for(const en of st.e){if(!en.on&&!en.fail){en.on=true;en.startT=25;en.N1=0;}}}
function engStop(st){for(const en of st.e){en.on=false;en.startT=0;}}
function engStep(e,st,dt,NRpct,Pload,dCol,colRate,Pcap){
  const err=100-NRpct;
  for(const en of st.e)if(en.startT>0)en.startT-=dt;
  const nRun=st.e.filter(x=>x.on&&!x.fail&&x.startT<=0).length;
  const nStart=st.e.filter(x=>x.on&&!x.fail&&x.startT>0).length;
  st.mode=nRun===2?'twin':nRun===1?'oei':nStart?'start':'off';
  // per-engine rating and transmission share
  const perMax=nRun===2?e.top:e.oei30, perMcp=nRun===2?e.mcp:e.oeiCont;
  const xmsn=nRun===2?e.xmsnTop:e.oei30;   // OEI: the 30-second rating is what the gearbox tolerates
  const totalMax=Math.min(xmsn,perMax*nRun);
  st.Pavail=totalMax;
  /* Governor: feedforward of the current load, referred to nominal NR
     (the measured load rises with NR³; fed forward unreferred it would be
     positive feedback), plus PI on the NR error with anti-windup. */
  const k=clamp(100/Math.max(NRpct,50),0.5,2);
  const ff=Math.max(0,Pload)*k*k*k+e.acc+colRate*e.kp*8;
  st.int=clamp(st.int+err*dt*e.ki,-150e3,150e3);
  let cmd=ff+err*e.kp+st.int;
  if(cmd>totalMax){st.int-=err*dt*e.ki;cmd=totalMax;}
  if(Pcap!==undefined&&cmd>Pcap){st.int-=err*dt*e.ki;cmd=Pcap;}   // run-up schedule
  if(cmd<e.idle*nRun)cmd=e.idle*nRun;
  st.Pdemand=cmd;
  let Ptot=0;
  for(const en of st.e){
    if(!en.on||en.fail){en.cmd=0;en.P=approach(en.P,0,dt*(en.fail?600e3:200e3));en.N1=Math.max(0,en.N1-dt*8);continue;}
    if(en.startT>0){en.cmd=0;en.P=approach(en.P,0,dt*100e3);en.N1=lerp(0,62,1-en.startT/25);continue;}
    en.cmd=clamp(cmd/Math.max(nRun,1),e.idle,perMax);
    const dP=clamp((en.cmd-en.P)/e.tau,-e.rate*3,e.rate);
    en.P+=dP*dt;
    en.N1=lerp(62,101,clamp(en.P/e.top,0,1.05));
    Ptot+=en.P;
  }
  // first-limit indicator: 10 = MCP, 11 = TOP (twin); per engine in OEI
  st.fli=nRun===2?Ptot/e.xmsnMcp*10:nRun===1?Ptot/e.oeiCont*10:0;
  st.limit=nRun===2?(Ptot>e.xmsnMcp?'TOP':''):nRun===1?(Ptot>e.oeiCont?'OEI 30s':'OEI'):'OFF';
  return Ptot;
}
