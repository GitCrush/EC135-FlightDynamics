/* ═══════════════ ATMOSPHERE, WIND, TERRAIN ═══════════════ */
/* ISA with a temperature offset (hot-and-high is a helicopter's main
   performance limit; the FLI moves with density altitude). */
function atmo(hm,dT){
  const T0=288.15+dT, L=0.0065;
  const T=Math.max(216.65,T0-L*hm);
  const p=101325*Math.pow(1-L*hm/(288.15+dT),5.2559);
  const rho=p/(287.05*T);
  return {rho,T,p,a:Math.sqrt(1.4*287.05*T),
          dalt:(1-Math.pow(rho/1.225,1/4.2559))/(L/288.15)};   // density altitude, m
}
/* Terrain: flat around the airfield, a mound for slope landings (8° flanks
   at about 25 m radius), a lake, rolling hills further out from a
   deterministic value noise. Height is positive up. Everything that
   touches the ground (skids, tail, blade tips, ground effect) and the
   renderer read this one function, so the mesh and the physics never
   disagree.
   2.9, the world grows: mountains to the north (foothills from 1.6 km,
   ridges of 700 to 900 m beyond 4 km) with a rounded summit for mountain
   landings (the Kuppe, 2.5 km north-north-east, 260 m, a flat top of 14 m
   radius); a hill with 8 to 12° flanks in the north-west for slope
   landings; a river from the mountains through its valley into the lake
   and out of it to the south-east; a small town 2.7 km to the south-west
   with a high-rise pad and a crane; a clearing in the western forest;
   hazy hills all round out to 7 km. */
const TERRAIN={mound:{n:0,e:150,h:6,r:32},lake:{n:-450,e:550,r:160,h:-1.5},
  runway:{n0:-900,n1:-100,e:-150,w:10},apron:{n:40,e:60},roads:[[-1500,-300,1500,-300],[280,-1500,280,1500]],
  kuppe:{n:2350,e:700,h:260,top:14,R:400},hill:{n:1550,e:-950,h:42,R:170},clearing:{n:200,e:-880,r:20},
  town:{n0:-2620,n1:-1980,e0:-1820,e1:-1180,h:0},townRoad:[-1500,-300,-2000,-1180]};
function hash2(i,j){let x=(i*374761393+j*668265263)|0;x=(x^(x>>>13))*1274126177|0;x=x^(x>>>16);return ((x>>>0)%100000)/100000;}
function vnoise(x,y){const i=Math.floor(x),j=Math.floor(y),fx=x-i,fy=y-j,ux=fx*fx*(3-2*fx),uy=fy*fy*(3-2*fy);
  const a=hash2(i,j),b=hash2(i+1,j),c=hash2(i,j+1),d=hash2(i+1,j+1);return (a+(b-a)*ux)*(1-uy)+(c+(d-c)*ux)*uy;}
const rnoise=(x,y)=>{const v=1-Math.abs(2*vnoise(x,y)-1);return v*v;};   // ridged: sharp crests, broad valleys
/* the land before the rivers cut into it */
function groundBase(n,e){
  const r=Math.hypot(n,e);
  let h=0;if(r>450){const far=sm(450,1400,r);h=far*(46*(vnoise(n/520+3.1,e/520+7.3)-0.45)+14*(vnoise(n/140+1.7,e/140+2.9)-0.5)+4*(vnoise(n/45,e/45)-0.5));   // (the physics asks some thirty times a step: nothing is computed that is not there)
    if(r>2600)h+=sm(2600,3900,r)*140*(0.35+0.65*vnoise(n/700+5.5,e/700+1.2));}   // ridge on the horizon
  if(n>1500){const m=sm(1600,3800,n)*(250+650*sm(2500,5500,n))*(0.55+0.45*vnoise(e/1700+3.3,n/1700+0.4));   // the mountains to the north
    h+=m*(0.30+0.70*(0.62*rnoise(n/900+1.3,e/900+7.7)+0.38*rnoise(n/360+4.1,e/360+2.2)));}
  if(r>4300)h+=sm(4300,6500,r)*(220*vnoise(n/1300+8.1,e/1300+2.6)+130*rnoise(n/600+1.9,e/600+6.4));   // hazy hills all round
  const T=TERRAIN.town;if(n>T.n0-260&&n<T.n1+260&&e>T.e0-260&&e<T.e1+260){const k=sm(260,60,Math.max(T.n0-n,n-T.n1,T.e0-e,e-T.e1,0));h=lerp(h,T.h,k);}   // the town stands on level ground
  const K=TERRAIN.kuppe,dk=Math.hypot(n-K.n,e-K.e);if(dk<K.R*3){const g=dk<K.top?1:Math.exp(-Math.pow((dk-K.top)/K.R,2));h=lerp(h,K.h,g);}   // the summit: flat on top, flanks of up to 30°
  const Hh=TERRAIN.hill,dh=Math.hypot(n-Hh.n,e-Hh.e);if(dh<Hh.R*3)h+=Hh.h*Math.exp(-Math.pow(dh/Hh.R,2));
  h=Math.max(h,-6);
  const m=TERRAIN.mound, d2=((n-m.n)**2+(e-m.e)**2)/(2*m.r*m.r);
  h+=m.h*Math.exp(-d2);
  return h;
}
/* Rivers: a Catmull-Rom line through the control points in 15 m steps, with the level of its flood plain,
   which only falls downstream: up the inflow from the lake it rises at most 0.6 % and stays 1.6 m under the
   land, down the outflow it falls with the land. Within 28 m beyond the water's edge the ground is the flood
   plain (the water lies 6 cm above it); beyond that it blends back into the land over 30 m plus 2.5 m per
   metre of height between them, at most 600 m: a valley through the hills (in the mountains the river
   may climb 3.6 % upstream). A 200 m grid of the segments
   near each cell keeps the lookup cheap. */
const RIVERS=[{pts:[[3900,-260],[3300,-190],[2700,-130],[2150,-70],[1650,110],[1150,300],[700,350],[280,380],[0,450],[-220,540],[-330,585]],w:12,lake:'end'},
  {pts:[[-560,690],[-760,900],[-1050,1120],[-1500,1250],[-2100,1300],[-2800,1450],[-3600,1700],[-4600,2000],[-6800,2500]],w:13,lake:'start'}];
const RIV={cell:200,grid:new Map()};
(function riverInit(){
  for(const rv of RIVERS){const C=rv.pts,P=[];
    for(let i=0;i<C.length-1;i++){const p0=C[Math.max(0,i-1)],p1=C[i],p2=C[i+1],p3=C[Math.min(C.length-1,i+2)],L=Math.hypot(p2[0]-p1[0],p2[1]-p1[1]),k=Math.max(1,Math.round(L/15));
      for(let s=0;s<k;s++){const t=s/k;P.push([0,1].map(q=>0.5*(2*p1[q]+(-p0[q]+p2[q])*t+(2*p0[q]-5*p1[q]+4*p2[q]-p3[q])*t*t+(-p0[q]+3*p1[q]-3*p2[q]+p3[q])*t*t*t)));}}
    P.push(C[C.length-1]);
    const low=(q)=>{let m=1e9;for(const [dn,de] of [[0,0],[rv.w,0],[-rv.w,0],[0,rv.w],[0,-rv.w]])m=Math.min(m,groundBase(q[0]+dn,q[1]+de));return m-1.6;};
    const L=new Array(P.length),lakeL=TERRAIN.lake.h+0.4;
    if(rv.lake==='end'){L[P.length-1]=lakeL;for(let i=P.length-2;i>=0;i--){const ds=Math.hypot(P[i][0]-P[i+1][0],P[i][1]-P[i+1][1]);L[i]=Math.max(L[i+1],Math.min(L[i+1]+(0.006+0.03*sm(1600,3200,P[i][0]))*ds,low(P[i])));}}   // steeper in the mountains
    else{L[0]=lakeL;for(let i=1;i<P.length;i++){const ds=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]);L[i]=Math.min(L[i-1]-0.0003*ds,low(P[i]));}}
    rv.P=P;rv.L=L;rv.S=[0];for(let i=1;i<P.length;i++)rv.S.push(rv.S[i-1]+Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]));
    rv.R=[];for(let i=0;i<P.length-1;i++){const a=P[i],b=P[i+1],c=RIV.cell;
      /* how far this piece reaches: out to where the land is still being blended in, sampled on both sides */
      const mn=(a[0]+b[0])/2,me=(a[1]+b[1])/2,len=Math.hypot(b[0]-a[0],b[1]-a[1]),un=-(b[1]-a[1])/len,ue=(b[0]-a[0])/len,Lm=(L[i]+L[i+1])/2;let g=rv.w+60;
      for(const sd of [-1,1])for(const d of [40,80,120,180,260,360,480,620])if(rv.w+28+Math.min(600,30+2.5*Math.abs(groundBase(mn+sd*un*d,me+sd*ue*d)-Lm))>d)g=Math.max(g,Math.min(d+140,rv.w+28+600));
      rv.R.push(g+len/2);
      for(let ci=Math.floor((Math.min(a[0],b[0])-g)/c);ci<=Math.floor((Math.max(a[0],b[0])+g)/c);ci++)for(let cj=Math.floor((Math.min(a[1],b[1])-g)/c);cj<=Math.floor((Math.max(a[1],b[1])+g)/c);cj++){
        if(Math.hypot((ci+0.5)*c-mn,(cj+0.5)*c-me)>g+len/2+c*0.71)continue;const key=ci*100003+cj;let l=RIV.grid.get(key);if(!l){l=[];RIV.grid.set(key,l);}l.push([rv,i]);}}}
})();
/* the nearest river line: distance, the flood plain's level there, the half width of the water, how far along */
function riverAt(n,e){const l=RIV.grid.get(Math.floor(n/RIV.cell)*100003+Math.floor(e/RIV.cell));if(!l)return null;let best=null,bd=1e18;
  for(const [rv,i] of l){const a=rv.P[i],b=rv.P[i+1],R=rv.R[i];if(Math.abs(n-(a[0]+b[0])/2)>R||Math.abs(e-(a[1]+b[1])/2)>R)continue;const bx=b[0]-a[0],by=b[1]-a[1],t=clamp(((n-a[0])*bx+(e-a[1])*by)/(bx*bx+by*by),0,1),dx=n-a[0]-bx*t,dy=e-a[1]-by*t,d2=dx*dx+dy*dy;
    if(d2<bd){bd=d2;best={d:0,L:rv.L[i]+(rv.L[i+1]-rv.L[i])*t,w:rv.w,s:rv.S[i]+(rv.S[i+1]-rv.S[i])*t,rv};}}
  if(best)best.d=Math.sqrt(bd);return best;}
function groundH(n,e){
  let h=groundBase(n,e);
  const q=riverAt(n,e);if(q){const W1=q.w+28,Wb=Math.min(600,30+2.5*Math.abs(h-q.L));if(q.d<W1+Wb)h=lerp(h,q.L,sm(W1+Wb,W1,q.d));}
  const L=TERRAIN.lake, dl=Math.hypot(n-L.n,e-L.e);
  if(dl<L.r+90){const th=Math.atan2(e-L.e,n-L.n);const rl=L.r*(0.8+0.4*vnoise(2.2+Math.cos(th)*1.4,3.7+Math.sin(th)*1.4));h=lerp(h,L.h,sm(rl+50,rl,dl));}   // shoreline follows a noise
  return h;
}
/* Buildings the physics sees (skids, blade tips, ground effect: flat roofs, plateaus the ground mesh does
   not have): the hospital with its pad, and the town's blocks, high-rises and the crane's mast (2.9). The
   renderer draws them by kind. */
const BUILDINGS=[{n:-260,e:-420,w:16,l:16,h:22,pad:true,kind:'hospital'}];
const TOWN_B=(()=>{const T=TERRAIN.town,rng=makeRng(29),B=[],cn=(T.n0+T.n1)/2,ce=(T.e0+T.e1)/2;
  for(let n=T.n0+5;n<T.n1-40;n+=64)for(let e=T.e0+5;e<T.e1-40;e+=64){   // blocks of 54 m between 10 m streets
    const bn=n+27,be=e+27,dc=Math.hypot(bn-cn,be-ce),core=sm(330,60,dc);
    if(Math.abs(bn-(-2268))<10&&Math.abs(be-(-1468))<10){B.push({n:bn,e:be,w:13,l:13,h:66,pad:true,kind:'tower'});B.push({n:bn+20,e:be-20,w:0.9,l:0.9,h:52,kind:'mast'});continue;}   // the high-rise with the pad (-2268, -1468), the crane beside it
    if(rng()<0.13)continue;   // a park
    const k=rng()<0.5?1:rng()<0.6?2:4;
    for(let q=0;q<k;q++){const w=k===1?18+6*rng():k===2?11+3*rng():10+2*rng(),l=k===1?18+6*rng():k===2?22+3*rng():10+2*rng();
      const on=k===1?0:k===2?(q?13:-13):(q&1?13:-13),oe=k===1||k===2?0:(q&2?13:-13);
      const tall=rng()<0.25*core;const hh=tall?32+38*rng()*core:6+(8+14*core)*rng();
      B.push({n:bn+on,e:be+oe,w:w/2,l:l/2,h:Math.round(hh/3.2)*3.2,kind:tall?'tower':'block',c:rng()});}}
  return B;})();
function terrainH(n,e){
  let h=groundH(n,e);
  for(const b of BUILDINGS)if(Math.abs(n-b.n)<b.w&&Math.abs(e-b.e)<b.l)h=Math.max(h,groundH(b.n,b.e)+b.h);
  const T=TERRAIN.town;if(n>T.n0&&n<T.n1&&e>T.e0&&e<T.e1)for(const b of TOWN_B)if(Math.abs(n-b.n)<b.w&&Math.abs(e-b.e)<b.l)h=Math.max(h,T.h+b.h);
  return h;
}
function inLake(n,e){return groundH(n,e)<TERRAIN.lake.h+0.4&&Math.hypot(n-TERRAIN.lake.n,e-TERRAIN.lake.e)<TERRAIN.lake.r*1.3;}
/* where no tree may stand (2.9): the rivers' banks, the town, under the wires, the clearing, the summit, the slope site */
function treeBlocked(n,e,m=0){   // m: a margin all round (the canopy's mesh keeps 6 m further off, so the trees at its edge stand in front of it)
  const T=TERRAIN.town;if(n>T.n0-25-m&&n<T.n1+25+m&&e>T.e0-25-m&&e<T.e1+25+m)return true;
  if(Math.abs(e+322)<12+m||(Math.abs(e+300)<10+m&&Math.abs(n)<1510)||(Math.abs(n-280)<10+m&&Math.abs(e)<1510)||(Math.abs(e+150)<26+m&&n<-80+m&&n>-920-m))return true;   // the wires, the roads, the runway
  if(n>1080-m&&n<1200+m&&e>-280-m&&e<720+m)return true;
  if(Math.hypot(n-900,e+700)<12+m||Math.hypot(n-1010,e+560)<12+m||Math.hypot(n-1120,e+420)<12+m)return true;   // the wind turbines' feet
  const C=TERRAIN.clearing,K=TERRAIN.kuppe;if(Math.hypot(n-C.n,e-C.e)<C.r+6+m||Math.hypot(n-K.n,e-K.e)<45+m||Math.hypot(n-1550,e+988)<26+m)return true;
  {const R=TERRAIN.townRoad,bx=R[2]-R[0],by=R[3]-R[1],t=clamp(((n-R[0])*bx+(e-R[1])*by)/(bx*bx+by*by),0,1);if(Math.hypot(n-R[0]-bx*t,e-R[1]-by*t)<10+m)return true;}
  const q=riverAt(n,e);return !!q&&q.d<q.w+22+m;}
/* The forest's crowns as the physics sees them (2.9): where the forest density passes 0.56 the crowns close
   over the ground, 11 to 17 m up (groups of crowns a couple of metres apart), lower towards the tree line. The
   trees drawn (85_render.js) stand at these heights. Height over the ground; 0 where there is no forest. The
   rotor's blades in it are a crash (60_sim.js). */
function canopyH(n,e){const C=TERRAIN.clearing,dc=Math.hypot(n-C.n,e-C.e);
  const r=dc>C.r+4.5&&dc<C.r+14?13*sm(C.r+4.5,C.r+6.5,dc):0;   // the clearing's ring of trees (85_render.js), from 24.5 m out
  const d=forestD(n,e);if(d<0.56)return r;const g=groundH(n,e);if(g>480||treeBlocked(n,e))return r;
  return Math.max(r,(11+6*vnoise(n/90+4.4,e/90+1.1)+3.2*(vnoise(n/8.5+0.3,e/8.5+5.7)-0.5))*sm(0.56,0.60,d)*(1-sm(400,480,g)));}   // the crowns' height, groups standing out by a couple of metres; at the forest's edge rising over some 10 m
function inRiver(n,e){const q=riverAt(n,e);return !!q&&q.d<q.w;}
function inWater(n,e){return inLake(n,e)||inRiver(n,e);}
function terrainN(n,e){ // unit normal pointing up (NED: negative D), from finite differences
  const d=0.5, hn=(terrainH(n+d,e)-terrainH(n-d,e))/(2*d), he=(terrainH(n,e+d)-terrainH(n,e-d))/(2*d);
  return vnorm([-hn,-he,-1]);
}
/* Wires the rotor can hit (2.9): the power line along the north-south road and the one across the river
   valley, each wire as straight pieces between the pylons and the low point of its sag; and the town
   crane's jib and hoist cable. [n0,e0,h0, n1,e1,h1, kind] */
const WIRES=(()=>{const W=[];const span=(a,b,top,sag)=>{const za=groundH(a[0],a[1])+top,zb=groundH(b[0],b[1])+top,m=[(a[0]+b[0])/2,(a[1]+b[1])/2,(za+zb)/2-sag];W.push([a[0],a[1],za,m[0],m[1],m[2],'w'],[m[0],m[1],m[2],b[0],b[1],zb,'w']);};
  for(let n=-1400;n<1400;n+=70)for(const dy of [-1.4,0,1.4])span([n,-322+dy],[n+70,-322+dy],10.5,1.2);
  const V=[[1180,-260],[1160,-20],[1140,220],[1120,460],[1100,700]];for(let i=0;i<V.length-1;i++)for(const dn of [-2.2,0,2.2])span([V[i][0]+dn,V[i][1]],[V[i+1][0]+dn,V[i+1][1]],24,4.5);
  for(const m of TOWN_B)if(m.kind==='mast'){const h=TERRAIN.town.h+m.h+0.6;W.push([m.n,m.e-12,h,m.n,m.e+38,h,'j'],[m.n,m.e+30,h,m.n,m.e+30,TERRAIN.town.h+24,'j']);}   // the crane's jib and hoist cable ('j': drawn as the crane)
  return W;})();
/* Forest density, shared by the tree placement and the ground colour (2.9: none in the clearing, on the
   rivers' flood plains, in the town; up the mountains to the tree line at 480 m). */
function forestD(n,e,raw){const r=Math.hypot(n,e);let d=vnoise(n/260+9.2,e/260+4.4)*sm(90,220,r)*sm(60,140,Math.hypot(n-260,e+220))*sm(170,300,Math.hypot(n-(-450),e-550));
  if(raw)return d;   // (as until 2.8: the tree placement near the field keeps its random stream)
  const C=TERRAIN.clearing;d*=sm(C.r,C.r+18,Math.hypot(n-C.n,e-C.e));
  d*=sm(48,80,Math.hypot(n+245,e+420));   // (2.9.2) the hospital stands in a clearing of its own, its lawn and car park round it
  if(n>1500)d=Math.max(d,sm(1700,2600,n)*(0.35+0.6*vnoise(n/330+2.7,e/330+8.1)));   // the mountain forests
  return d;}
/* Wind: steady vector plus a Dryden-like turbulence (two first-order
   filters per axis on white noise, bandwidth scaled with airspeed/length
   scale) plus a slow gust envelope. Reported in NED. */
const WIND={dir:270,spd:0,turb:0,gust:0,seed:7};
const WST={f:[0,0,0],g:[0,0,0],gustT:0,gustA:0,rng:makeRng(7)};
function windReset(seed){WST.rng=makeRng(seed||WIND.seed);WST.f=[0,0,0];WST.g=[0,0,0];WST.gustT=0;WST.gustA=0;}
/* Boundary layer: WIND.spd is the wind at 10 m; 1/7 power law above 2 m
   (up to 300 m, 1.63 times the 10 m value), cut in half at the ground. */
function windProfile(hAGL){return Math.pow(clamp(hAGL,2,300)/10,1/7)*(0.5+0.5*sm(0,4,hAGL));}
function windAt(dt,V,hAGL){
  const from=WIND.dir*DEG, w=WIND.spd*KT;
  const prof=windProfile(hAGL);
  const base=[-Math.cos(from)*w*prof,-Math.sin(from)*w*prof,0];
  if(WIND.turb>0){
    // Dryden: L = 200 m (low altitude), sigma from the turbulence setting
    const sig=WIND.turb*1.0, L=Math.max(50,Math.min(300,hAGL*3+40)), Vx=Math.max(V,3);
    const a=Math.exp(-dt*Vx/L), k=Math.sqrt(1-a*a)*sig;
    for(let i=0;i<3;i++){
      const n=(WST.rng()+WST.rng()+WST.rng()-1.5)*2;   // ~N(0,1)
      WST.f[i]=a*WST.f[i]+k*n; WST.g[i]=a*WST.g[i]+(1-a)*WST.f[i];
      base[i]+=WST.g[i]*(i===2?0.6:1);
    }
  }
  if(WIND.gust>0){
    WST.gustT-=dt;
    if(WST.gustT<=0){WST.gustT=6+WST.rng()*14;WST.gustA=(WST.rng()>0.5?1:-1)*WIND.gust*KT*(0.5+WST.rng()*0.5);}
    const ph=WST.gustT%1, env=Math.sin(Math.PI*ph);
    base[0]+=-Math.cos(from)*WST.gustA*env;base[1]+=-Math.sin(from)*WST.gustA*env;
  }
  return base;
}
