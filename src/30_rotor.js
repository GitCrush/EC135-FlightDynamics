/* ═══════════════ MAIN ROTOR ═══════════════
   Blade element model, time-marching per blade. Each blade is a rigid
   beam on an offset flap hinge with a spring; its flap angle is a state.
   The aerodynamic loads are integrated over Ne elements every step, so
   dissymmetry of lift, retreating blade stall, advancing tip drag rise,
   coning, the flap response to body rates (rotor damping) and the
   control phase all come out of the same loop instead of being fitted.

   Hub frame: x_h forward, y_h right, z_h down along the shaft (tilted
   forward by H.rotor.tilt). Azimuth psi is measured from aft in the
   direction of rotation, sense s = +1 clockwise from above.
     radial direction     rh = (-cos psi, -s sin psi, 0)
     tangential (motion)  th = ( sin psi, -s cos psi, 0)
     flap-up axis         e2 = s th
   Flap equation from the Euler equation of the blade about the hinge, with
   the hub rotating at body rates (Coriolis and angular-acceleration
   terms), the centrifugal stiffening of the offset hinge, the spring and
   gravity:
     bdd = M_aero/Ib + w3*w1 - s*wdot_h.th + s*Om*w_h.rh - Kb*b/Ib - e R Sb Om² sin b/Ib - g Sb/Ib
   where w1, w3 are the blade's total angular velocity along the span and
   the third axis. */
function airfoil(al,M,rt){
  /* Symmetric section: linear lift to a soft stall, flat-plate blend
     beyond it, Prandtl-Glauert on the slope and a drag divergence above
     Mdd. The stall angle drops with Mach: the advancing tip stalls early
     at high speed, the retreating root stalls at high angle. */
  const pg=1/Math.sqrt(1-Math.min(M*M,0.72));
  const as=rt.aStall*(1-0.5*clamp((M-0.4)/0.4,0,1));
  const aa=Math.abs(al), sg=al<0?-1:1;
  let cl,cd;
  if(aa<as){cl=rt.a*pg*al;cd=rt.cd0+rt.cd2*al*al;}
  else{
    const t=sm(0,0.20,aa-as);                       // 11° wide transition
    const clmax=rt.a*pg*as, clfp=1.1*Math.sin(2*aa);
    cl=sg*lerp(clmax,clfp,t);
    cd=rt.cd0+rt.cd2*as*as+t*1.9*Math.sin(aa)*Math.sin(aa);
  }
  if(M>rt.Mdd)cd+=12.5*Math.pow(M-rt.Mdd,3);
  return[cl,cd];
}
function rotorInit(rt){
  const R=rt.R, eR=rt.e*R, L=R-eR;
  rt.eR=eR; rt.Ib=rt.mb*L*L/3; rt.Sb=rt.mb*L/2;          // uniform beam from the hinge
  rt.A=Math.PI*R*R; rt.sigma=rt.N*rt.c/(Math.PI*R);
  /* Spring for the target flap frequency ratio at nominal speed:
     nu² = 1 + eR Sb/Ib + Kb/(Ib Om²) */
  const nuOff=1+eR*rt.Sb/rt.Ib;
  rt.Kb=Math.max(0,(rt.nu*rt.nu-nuOff)*rt.Ib*rt.Om0*rt.Om0);
  rt.gamma=1.225*rt.a*rt.c*Math.pow(R,4)/rt.Ib;          // Lock number at sea level
  /* Control phase: flap lags pitch by atan((gamma/8)/(nu²-1)) for a
     first-harmonic input; the swashplate is timed for that at 100 % NR. */
  rt.phase=Math.atan2(rt.gamma/8,rt.nu*rt.nu-1);
  rt.r=[];rt.dr=L/rt.Ne;
  for(let j=0;j<rt.Ne;j++)rt.r.push(eR+(j+0.5)*rt.dr);
  // hub frame from body: rotation about y by the forward shaft tilt
  const c=Math.cos(rt.tilt),s=Math.sin(rt.tilt);
  rt.Rbh=[c,0,-s, 0,1,0, s,0,c];                          // hub -> body (row-major)
}
function rotorState(rt){
  const b=[],bd=[];for(let k=0;k<rt.N;k++){b.push(0.03);bd.push(0);}
  return {psi:0,Om:rt.Om0,beta:b,betad:bd,lam0:0.05,lamx:0,lamy:0,lamxd:0,lamyd:0,
          T:0,Q:0,P:0,CT:0,mu:0,lamc:0,vrs:0,ge:1,chi:0,stall:0,stallAz:0,Mtip:0,
          F:[0,0,0],M:[0,0,0],aoa:[],noise:0,noiseT:0,tipZ:0};
}
/* One rotor step. vb, om: body velocity and rates; wb: wind in body axes;
   rho, aSound; hAGL of the hub; th0/thLon/thLat: blade pitch commands;
   Qdrive: torque from the transmission (positive in the direction of
   rotation). Returns forces/moments in body axes at the CG. */
function rotorStep(rt,st,dt,vb,om,omd,wb,rho,aSound,hAGL,th0,thLon,thLat,Qdrive){
  const R=rt.R,s=rt.s,Om=st.Om,N=rt.N,Ne=rt.Ne,OmR=Math.max(Om*R,3);   // floor: coefficients stay finite with the rotor stopped
  // hub kinematics in hub axes
  const vh=mrotT(rt.Rbh,vadd(vb,vcross(om,rt.hub)));      // hub velocity
  const oh=mrotT(rt.Rbh,om), ohd=mrotT(rt.Rbh,omd);
  const wh=mrotT(rt.Rbh,wb);
  const va=vsub(vh,wh);                                    // hub velocity relative to the air
  const mu=Math.hypot(va[0],va[1])/OmR, lamc=-va[2]/OmR;   // advance ratio; free-stream inflow, + down through the disc
  st.mu=mu;st.lamc=lamc;
  // cyclic: pitch minimum placed 'phase' before the wanted disc tilt, in the rotation sense
  const ph=-s*rt.phase, cp=Math.cos(ph), sp=Math.sin(ph);
  const ux=thLon*cp-thLat*sp, uy=thLon*sp+thLat*cp;        // rot((lon,lat), -s*phase)
  const F=[0,0,0], Mh=[0,0,0], Ma=[0,0,0];
  let Q=0,T=0,stallW=0,stallAz=0,Mtip=0,tipZmax=-1e9;
  const gI=rt.Sb*9.81/rt.Ib;
  if(!st.aoa.length)for(let k=0;k<N;k++)st.aoa.push(new Float32Array(Ne));
  for(let k=0;k<N;k++){
    const psi=st.psi+2*Math.PI*k/N, cps=Math.cos(psi),sps=Math.sin(psi);
    const rh=[-cps,-s*sps,0], th=[sps,-s*cps,0], e2=[s*th[0],s*th[1],0];
    const b=st.beta[k], cb=Math.cos(b), sb=Math.sin(b);
    const e1=[rh[0]*cb,rh[1]*cb,-sb], e3=[rh[0]*sb,rh[1]*sb,cb];
    let Maero=0, Fk=[0,0,0], Mk=[0,0,0];
    for(let j=0;j<Ne;j++){
      const r=rt.r[j], rr=r/R;
      const pos=[r*cb*rh[0],r*cb*rh[1],-r*sb];
      // blade element velocity: hub + body rotation + rotor rotation + flapping
      const vrot=vcross(oh,pos);
      const vel=[vh[0]+vrot[0]+Om*r*cb*th[0], vh[1]+vrot[1]+Om*r*cb*th[1], vh[2]+vrot[2]-r*st.betad[k]];
      // induced inflow at this position (uniform + gradients), down
      const lamI=Math.max(st.lam0+st.lamx*pos[0]/R+st.lamy*pos[1]/R,-0.6);
      const vi=lamI*OmR;
      const UT=(vel[0]-wh[0])*th[0]+(vel[1]-wh[1])*th[1];   // air from ahead of the section
      const UP=vi+wh[2]-vel[2];                             // air down through the section
      const U2=UT*UT+UP*UP, U=Math.sqrt(U2);
      const phi=Math.atan2(UP,UT);
      const theta=th0+rt.twist*(rr-0.75)-(ux*rh[0]+uy*rh[1])-(rt.d3||0)*b;   // delta3: flap up takes pitch out
      const al=wrapPi(theta-phi);
      const M=U/aSound;
      const [cl,cd]=airfoil(al,M,rt);
      const qc=0.5*rho*U2*rt.c*rt.dr;
      let L=qc*cl, D=qc*cd;
      if(rr>rt.B)L=0;                                       // tip loss
      const Ft=-(L*UP+D*UT)/(U+1e-6), Fz=-(L*UT-D*UP)/(U+1e-6);
      const dF=[Ft*th[0],Ft*th[1],Fz];
      vaddTo(Fk,dF);
      vaddTo(Mk,vcross(pos,dF));
      Maero+=(r-rt.eR)*(-Fz);
      Q+=r*(-Ft);
      st.aoa[k][j]=al;
      if(Math.abs(al)>rt.aStall*(1-0.5*clamp((M-0.4)/0.4,0,1))&&rr>0.4){stallW+=rr;stallAz+=rr*psi;}
      if(j===Ne-1){if(M>Mtip)Mtip=M;}
      if(j===Ne-1){const pb=mrot(rt.Rbh,pos);const z=pb[2]+rt.hub[2];if(z>tipZmax)tipZmax=z;}
    }
    /* Flap dynamics (see header). Total blade angular velocity:
       w = w_h + s Om z + betad e2; components along e1, e3. */
    const w1=vdot(oh,e1)-s*Om*sb, w3=vdot(oh,e3)+s*Om*cb;
    // structural damping (2 % critical) matters only with the rotor stopped, where there is no aerodynamic damping
    const Mflap=Maero-rt.Kb*b-rt.eR*rt.Sb*Om*Om*sb-gI*rt.Ib*cb-0.04*Math.sqrt(rt.Kb*rt.Ib)*st.betad[k];
    const bdd=Mflap/rt.Ib+w3*w1-s*vdot(ohd,th)+s*Om*vdot(oh,rh);
    st.betad[k]+=bdd*dt;
    st.betad[k]=sat(st.betad[k],8);                         // numerical safety only
    st.beta[k]=clamp(st.beta[k]+st.betad[k]*dt,-0.10,0.40);   // droop stop -6°, flap stop +23°
    if(st.beta[k]<=-0.10&&st.betad[k]<0)st.betad[k]=0;
    // transmitted hub loads: aero moment minus the part released by the hinge, plus spring and offset
    const mHinge=Maero;                                     // aero moment about the flap axis
    const kOff=rt.Kb*b+rt.eR*rt.Sb*Om*Om*sb;
    vaddTo(F,Fk);
    vaddTo(Ma,Mk);
    Mh[0]+=Mk[0]-mHinge*e2[0]+kOff*e2[0];
    Mh[1]+=Mk[1]-mHinge*e2[1]+kOff*e2[1];
    Mh[2]+=Mk[2];
  }
  // shaft-axis component of the aero moment goes to the rotor speed DOF; the airframe feels the drive torque reaction
  Mh[2]=-s*Qdrive;
  T=-F[2];
  st.T=T;st.Q=Q;st.P=Q*Om;st.CT=T/(rho*rt.A*OmR*OmR);
  st.stall=stallW/(N*Ne*0.7);st.stallAz=stallW>0?stallAz/stallW:0;st.Mtip=Mtip;st.tipZ=tipZmax;
  const CL=-Ma[0]/(rho*rt.A*OmR*OmR*R), CM=Ma[1]/(rho*rt.A*OmR*OmR*R);   // roll (lift on the left +), pitch (nose-up +)
  /* ---- Inflow ----
     Uniform part: first-order lag (Pitt-Peters apparent mass 128/75pi)
     towards the momentum-theory value. In the vortex-ring region
     (-2 < Vz/vh < 0 at low advance ratio) momentum theory has no
     solution; the empirical curve from Leishman replaces it and a
     low-pass noise reproduces the thrust fluctuations. Ground effect
     after Cheeseman-Bennett as a reduction of induced velocity. */
  const CT=Math.max(st.CT,2e-4), vh0=Math.sqrt(CT/2);
  let l0=st.lam0;
  for(let it=0;it<6;it++){const V=Math.max(Math.sqrt(mu*mu+(lamc+l0)*(lamc+l0)),0.4*vh0);l0=0.5*l0+0.5*CT/(2*V);}   // relaxed fixed point
  const lam=lamc+l0;
  let lam0s=l0;
  const xa=lamc/vh0;                                        // axial ratio: negative = descending
  let w=0;if(!(xa<0&&xa>-2.6))st.ctSlow=CT;
  if(xa<0&&xa>-2.6){
    const x=Math.max(xa,-2);
    const poly=1.15-1.125*x-1.372*x*x-1.718*x*x*x-0.655*x*x*x*x;
    w=Math.pow(1-clamp(mu/(1.3*vh0),0,1),2)*sm(0,0.5,-xa)*sm(-2.6,-2.0,xa);
    lam0s=lerp(lam0s,poly*vh0,w);
    /* Two things the mean-inflow curve leaves out, after Johnson's VRS
       model (NASA TP-2005-213477): (1) in the core the heave damping
       vanishes: with the curve alone the net inflow falls as the descent
       grows, so a deeper descent would give more thrust and the state
       would cure itself; a term rising with the descent ratio removes that
       and lets the sink accelerate until about 1.3 vh. (2) Collective is
       ineffective: the extra thrust of a quick collective pull is fed back
       into the recirculating wake as extra inflow (filtered thrust as the
       reference, 4 s), so pulling alone does not stop the sink. */
    st.ctSlow=st.ctSlow===undefined?CT:st.ctSlow+(CT-st.ctSlow)*Math.min(1,dt/4);
    const core=w*sm(-0.45,-0.8,x)*sm(-1.7,-1.35,x);
    lam0s+=core*0.40*vh0*(-x-0.6);
    lam0s+=(0.5*w+3.5*core)*Math.max(0,CT-st.ctSlow)/(2*vh0);   // in the core a pull keeps about a quarter of its normal effect
    st.noiseT-=dt;
    if(st.noiseT<=0){st.noiseT=0.12+0.2*WST.rng();st.noiseTgt=(WST.rng()-0.5);}   // seeded: the harness must replay
    st.noise+=((st.noiseTgt||0)-st.noise)*Math.min(1,dt*6);
    lam0s+=w*0.35*vh0*st.noise;
  }
  /* Power settling: inside the vortex ring, collective added beyond the
     value at entry goes into a stronger recirculation instead of thrust.
     The extra pitch raises the inflow nearly one for one at the reference
     radius (0.75 R), so the blade angle of attack, and with it the thrust,
     barely moves while the induced power grows. Forward or sideways speed
     (mu) takes the aircraft out of the region and the term with it. */
  /* only in the developed ring: in the incipient stage more collective still
     works (Airbus: the classical technique is effective there) */
  if(w<0.55||st.thVrs===undefined)st.thVrs=th0;
  lam0s+=sm(0.55,0.9,w)*0.65*Math.max(0,th0-st.thVrs);
  st.vrs=w;
  let kG=1;
  if(hAGL>0){const z=Math.max(hAGL,0.35*R);kG=1-(R/(4*z))*(R/(4*z))/(1+Math.pow(mu/Math.max(st.lam0,0.01),2));}
  st.ge=kG;lam0s*=kG;
  const VT=Math.max(Math.sqrt(mu*mu+lam*lam),0.5*vh0);
  st.lam0+=(lam0s-st.lam0)*Math.min(1,dt*2*VT*Om/0.5432);
  // gradients: Glauert wake skew (quasi-steady) + moment-driven (dynamic)
  const chi=Math.atan2(mu,Math.max(Math.abs(lam),1e-3)); st.chi=chi;
  const kx=Math.tan(chi/2), Vh=Math.max(Math.hypot(va[0],va[1]),1e-3);
  const gx=-st.lam0*kx*va[0]/Vh, gy=-st.lam0*kx*va[1]/Vh;
  /* The gradient gains go as 1/V and are meaningless when the rotor
     barely turns: floor the mass-flow parameter at 2 m/s of through-flow
     and cap the gradients, otherwise a run-down rotor at 15 % NR feeds
     its own flapping through the inflow and spins back up. */
  const Vm=Math.max((mu*mu+lam*(lam+st.lam0))/VT,0.3*vh0,2/OmR), cc=Math.cos(chi);
  const Kx=(4*cc/(1+cc))/Vm, Ky=(4/(1+cc))/Vm;
  const rate=Math.min(1,dt*Om/(0.113*Math.max(Kx,Ky)+1e-3));
  const gmax=2*Math.max(st.lam0,0.02);
  st.lamxd=clamp(st.lamxd+(Kx*CM-st.lamxd)*rate,-gmax,gmax); st.lamyd=clamp(st.lamyd+(-Ky*CL-st.lamyd)*rate,-gmax,gmax);
  st.lamx=gx+st.lamxd; st.lamy=gy+st.lamyd;
  st.psi+=Om*dt; if(st.psi>2*Math.PI)st.psi-=2*Math.PI;
  st.F=mrot(rt.Rbh,F); st.M=vadd(mrot(rt.Rbh,Mh),vcross(rt.hub,st.F));
  return st;
}
