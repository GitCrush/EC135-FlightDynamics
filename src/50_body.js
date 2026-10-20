/* ═══════════════ FUSELAGE, EMPENNAGE, LANDING GEAR ═══════════════ */
/* Fuselage: drag by axis (a helicopter flies sideways and backwards too,
   so one frontal area is not enough), the destabilising pitch and yaw
   moments of a blunt body, and the rotor download. */
/* Lateral forces in two parts (2.1, after the derivative breakdown of
   Kampa et al., ERF 1997, Fig. 18):
   - Crossflow drag, spread along the body (cabin and tail boom strips):
     each strip feels the flow normal to the body axis, its own sideways
     velocity (including the yaw rate times its arm) and, under the disc,
     the rotor downwash. Crossflow principle: the flow along the body
     does not count, so in forward flight at small sideslip this drag is
     quadratic and small; sideways, in a spin, or in the hover wake it is
     large. A spinning aircraft drags its tail boom through the air.
   - The cabin's side force as a lifting body (low aspect ratio), linear
     in the sideslip at speed, acting near the CG, with the destabilising
     Munk moment of the whole body below.
   Until 2.0 the strips took the full airspeed into the crossflow, which
   made the whole body a lifting surface: the boom gave the fuselage a
   stabilising weathercock moment (+0.06 m³/°, Kampa: -0.26) and a yaw
   damping of -0.25 1/s at 90 kt (Kampa: ~0, "no significant moment is
   created due to yaw rate"). The Dutch roll came out too stiff at speed
   and the yaw inertia fitted to it too large. */
/* cabin 4.5 m x 1.6 m, Cd 0.6 = 4.2 m²; tail boom 5 m x 0.5 m, Cd 1.0 = 2.5 m² (estimates) */
const FUS_STRIPS=[[2.6,0.23],[1.2,0.22],[-0.2,0.18],[-1.8,0.093],[-3.2,0.093],[-4.6,0.093],[-5.9,0.093]];   // [x m, share of the side drag area]
function fuselage(fus,va,rho,T,om,chi){
  const V=vlen(va), q=0.5*rho*V*V;
  /* rotor download: the wake hits the cabin in the hover; as it skews
     back with speed (wake skew chi) it passes behind (until 1.8 it acted
     at every speed, 2.5 % of the thrust in cruise as well) */
  const cw=Math.cos(chi||0);
  /* vertical: the crossflow drag of the body in the flow normal to it (a vertical climb or
     descent, sideways flight) and, at speed, the cabin's lift as a low-aspect-ratio body
     (Sz per radian of angle of attack, |u|*w). Until 2.0 the vertical drag area acted with
     the full airspeed: at 140 kt and -4° it pressed the fuselage down with 1.6 kN, which
     the rotor had to carry (5 % of the thrust, and the retreating blade with it). */
  const F=[-0.5*rho*fus.f[0]*V*va[0],0,-0.5*rho*fus.f[2]*Math.hypot(va[1],va[2])*va[2]-0.5*rho*fus.Sz*Math.abs(va[0])*va[2]+fus.down*T*cw*cw];
  /* Strips under the disc also sit in the rotor wake: the downwash across
     the cabin and boom adds to the crossflow, so a sideways or yawing
     motion meets drag linear in its velocity even in the hover, as in
     forward flight (until 1.8 the hover crossflow drag was quadratic and
     gave the yawing boom no damping at small rates). Wake at the fuselage
     ~1.6 vi, swept back with the skew like the download. */
  const vdw=1.6*Math.sqrt(Math.max(T,0)/(2*rho*H.rotor.A))*cw*cw;
  let Mz=0;
  for(const [x,k] of FUS_STRIPS){const vy=va[1]+(om?om[2]*x:0), vz=(Math.abs(x)<H.rotor.R?vdw:0)-va[2];const vn=Math.sqrt(vy*vy+vz*vz);const Fy=-0.5*rho*fus.f[1]*k*vn*vy;F[1]+=Fy;Mz+=x*Fy;}
  /* lifting-body side force of the cabin: q*Sy*beta at small sideslip, gone in pure crossflow (|u|*v) */
  {const vy=va[1]+(om?om[2]*fus.xy:0);const Fy=-0.5*rho*fus.Sy*Math.abs(va[0])*vy;F[1]+=Fy;Mz+=fus.xy*Fy;}
  /* Blunt-body (Munk) moments go as u*w and u*v: q*alpha for small
     angles, largest at 45°, gone in pure crossflow, and reversed in
     backward flight as for any body. (Until 1.8: q*sat(alpha) with the
     full dynamic pressure, which kept a pitch and yaw moment in a
     vertical descent with no forward speed at all.) */
  const M=[0,0.5*rho*fus.Vm*va[0]*va[2],0.5*rho*fus.Vn*va[0]*va[1]+Mz];
  return {F,M};
}
/* Horizontal stabiliser with the main-rotor wake on it. At low forward
   speed the skewed wake hits the tail: the downwash is largest around
   mu 0.05-0.08 (transition), gives the nose-up 'hump' through
   translational lift, and vanishes in cruise. */
function stabiliser(fus,vb,om,wb,rho,lam0,OmR,mu){
  const sb=fus.stab, r=[sb.x,0,sb.z];
  const wake=2*lam0*OmR*(0.35*sm(0.06,0.0,mu)+0.9*Math.exp(-Math.pow((mu-0.065)/0.035,2)));
  const va=vsub(vadd(vb,vcross(om,r)),vadd(wb,[0,0,wake]));
  const q=0.5*rho*(va[0]*va[0]+va[2]*va[2]);   // flow along the span (sideways flight) carries no lift
  let al=Math.atan2(va[2],Math.max(Math.abs(va[0]),1))+sb.i0;
  al=sat(al,sb.aStall)*(1-0.6*sm(sb.aStall,sb.aStall*2,Math.abs(al)));
  const L=q*sb.S*sb.a*al, F=[0,0,-L];
  return {F,M:vcross(r,F)};
}
/* Vertical fin (with the Fenestron shroud) and stabiliser end plates:
   weathercock stability, and a cambered fin that carries part of the
   anti-torque in cruise. */
function fin(fus,vb,om,wb,rho,s){
  let F=[0,0,0],M=[0,0,0];
  /* the camber pushes the tail against the rotor's torque reaction: to the
     right for the EC135's counterclockwise rotor (s = -1) */
  for(const [fn,cl0] of [[fus.fin,(s||1)*fus.fin.cl0],[fus.endpl,0]]){
    const r=[fn.x,0,fn.z||0];
    const va=vsub(vadd(vb,vcross(om,r)),wb);
    /* only the flow across the fin counts: in a vertical descent the air
       runs along its span. (Until 1.8 the full dynamic pressure acted, and
       the camber term alone pushed the tail round in a steep descent.) */
    const q=0.5*rho*(va[0]*va[0]+va[1]*va[1]);
    /* Attached lift up to the stall angle, then the normal force of a flat
       plate in crossflow (1.2 sin beta): a surface pushed sideways keeps
       resisting, it does not go limp. */
    /* Camber and incidence shift the zero-lift sideslip: the section works
       at the effective angle be + cl0/a and stalls there, so a cambered fin
       stalls first with the nose swung against its camber. (Until 1.8 the
       stall was taken on the sideslip alone, which let the camber lift
       add to the full attached lift on that side.) */
    const be=Math.atan2(va[1],Math.max(Math.abs(va[0]),1)), as=fn.aStall||0.3, ae=be+cl0/fn.a, ab=Math.abs(ae), t=sm(as,2*as,ab);
    const cy=(1-t)*fn.a*sat(ae,as)+t*Math.sign(ae)*1.2*Math.abs(Math.sin(ae));
    const Y=-q*fn.S*cy;
    const Fi=[0,Y,0];F=vadd(F,Fi);M=vadd(M,vcross(r,Fi));
  }
  return {F,M};
}
/* Skids and tail bumper: spring-damper normal force along the local
   terrain normal, anisotropic Coulomb friction regularised at 6 mm/s.
   The four points make the aircraft pivot about one skid when the rotor
   pulls sideways on the ground: dynamic rollover is not scripted. */
function gearStep(g,S,R){
  let F=[0,0,0],M=[0,0,0],contact=0,minH=1e9,maxSink=0,tail=false;const loads=[0,0,0,0,0];
  const pts=g.pts.concat([g.tail]);
  for(let i=0;i<pts.length;i++){
    const pb=pts[i];
    const pw=vadd(S.pos,mrot(R,pb));
    const hg=terrainH(pw[0],pw[1]);
    const n=terrainN(pw[0],pw[1]);
    const pen=(pw[2]+hg)*(-n[2]);
    const h=-(pw[2]+hg); if(h<minH)minH=h;
    if(pen<=0)continue;
    const vw=mrot(R,vadd(S.vb,vcross(S.om,pb)));
    const vn=vdot(vw,n);
    if(-vn>maxSink)maxSink=-vn;
    const Fn=Math.max(0,g.k*pen-g.c*vn);loads[i]=Fn;
    const vt=vsub(vw,vscl(n,vn));
    const vtb=mrotT(R,vt), sp=vlen(vt)+0.006;
    const fr=[-Fn*g.muX*vtb[0]/sp,-Fn*g.muY*vtb[1]/sp,-Fn*g.muY*vtb[2]/sp];
    const Fb=vadd(mrotT(R,vscl(n,Fn)),fr);
    F=vadd(F,Fb);M=vadd(M,vcross(pb,Fb));
    if(i===4)tail=true;else contact++;
  }
  return {F,M,contact,minH,maxSink,tail,loads};
}
