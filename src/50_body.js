/* ═══════════════ FUSELAGE, EMPENNAGE, LANDING GEAR ═══════════════ */
/* Fuselage: drag by axis (a helicopter flies sideways and backwards too,
   so one frontal area is not enough), the destabilising pitch and yaw
   moments of a blunt body, and the rotor download. */
/* The side area is spread along the body (cabin and tail boom strips),
   each strip seeing its own crossflow including the yaw rate: a spinning
   aircraft drags its tail boom sideways through the air, which is the
   main yaw damping at high yaw rates. In pure sideslip the strips add up
   to the same side force as before. */
/* cabin 4.5 m x 1.6 m, Cd 0.6 = 4.2 m²; tail boom 5 m x 0.5 m, Cd 1.0 = 2.5 m² (estimates) */
const FUS_STRIPS=[[2.6,0.23],[1.2,0.22],[-0.2,0.18],[-1.8,0.093],[-3.2,0.093],[-4.6,0.093],[-5.9,0.093]];   // [x m, share of the side drag area]
function fuselage(fus,va,rho,T,om){
  const V=vlen(va), q=0.5*rho*V*V;
  const F=[-0.5*rho*fus.f[0]*V*va[0],0,-0.5*rho*fus.f[2]*V*va[2]+fus.down*T];
  let Mz=0;
  for(const [x,k] of FUS_STRIPS){const vy=va[1]+(om?om[2]*x:0), vx=va[0];const vs=Math.hypot(vx,vy);const Fy=-0.5*rho*fus.f[1]*k*vs*vy;F[1]+=Fy;Mz+=x*Fy;}
  const al=Math.atan2(va[2],Math.max(Math.abs(va[0]),0.5)), be=Math.atan2(va[1],Math.max(Math.abs(va[0]),0.5));
  const M=[0,q*fus.Vm*sat(al,0.5),q*fus.Vn*sat(be,0.5)+Mz];
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
  const V=vlen(va), q=0.5*rho*V*V;
  let al=Math.atan2(va[2],Math.max(Math.abs(va[0]),1))+sb.i0;
  al=sat(al,sb.aStall)*(1-0.6*sm(sb.aStall,sb.aStall*2,Math.abs(al)));
  const L=q*sb.S*sb.a*al, F=[0,0,-L];
  return {F,M:vcross(r,F)};
}
/* Vertical fin (with the Fenestron shroud) and stabiliser end plates:
   weathercock stability, and a cambered fin that carries part of the
   anti-torque in cruise. */
function fin(fus,vb,om,wb,rho){
  let F=[0,0,0],M=[0,0,0];
  for(const [fn,cl0] of [[fus.fin,fus.fin.cl0],[fus.endpl,0]]){
    const r=[fn.x,0,fn.z||0];
    const va=vsub(vadd(vb,vcross(om,r)),wb);
    const V=vlen(va), q=0.5*rho*V*V;
    /* Attached lift up to the stall angle, then the normal force of a flat
       plate in crossflow (1.2 sin beta): a surface pushed sideways keeps
       resisting, it does not go limp. */
    const be=Math.atan2(va[1],Math.max(Math.abs(va[0]),1)), as=fn.aStall||0.3, ab=Math.abs(be), t=sm(as,2*as,ab);
    const cy=(1-t)*(fn.a*sat(be,as)+cl0*(1-sm(as,2*as,ab)))+t*Math.sign(be)*1.2*Math.abs(Math.sin(be));
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
