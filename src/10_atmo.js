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
   disagree. */
const TERRAIN={mound:{n:0,e:150,h:6,r:32},lake:{n:-450,e:550,r:160,h:-1.5},
  runway:{n0:-900,n1:-100,e:-150,w:10},apron:{n:40,e:60},roads:[[-1500,-300,1500,-300],[280,-1500,280,1500]]};
function hash2(i,j){let x=(i*374761393+j*668265263)|0;x=(x^(x>>>13))*1274126177|0;x=x^(x>>>16);return ((x>>>0)%100000)/100000;}
function vnoise(x,y){const i=Math.floor(x),j=Math.floor(y),fx=x-i,fy=y-j,ux=fx*fx*(3-2*fx),uy=fy*fy*(3-2*fy);
  const a=hash2(i,j),b=hash2(i+1,j),c=hash2(i,j+1),d=hash2(i+1,j+1);return (a+(b-a)*ux)*(1-uy)+(c+(d-c)*ux)*uy;}
/* Rooftop pads: flat plateaus the physics sees (skids, blade tips, ground
   effect) but the ground mesh does not; the renderer draws the building. */
const BUILDINGS=[{n:-260,e:-420,w:16,l:16,h:22,pad:true}];
function groundH(n,e){
  const r=Math.hypot(n,e);
  const far=sm(450,1400,r);
  let h=far*(46*(vnoise(n/520+3.1,e/520+7.3)-0.45)+14*(vnoise(n/140+1.7,e/140+2.9)-0.5)+4*(vnoise(n/45,e/45)-0.5));
  h+=sm(2600,3900,r)*140*(0.35+0.65*vnoise(n/700+5.5,e/700+1.2));   // ridge on the horizon
  h=Math.max(h,-6);
  const m=TERRAIN.mound, d2=((n-m.n)**2+(e-m.e)**2)/(2*m.r*m.r);
  h+=m.h*Math.exp(-d2);
  const L=TERRAIN.lake, dl=Math.hypot(n-L.n,e-L.e);
  if(dl<L.r+90){const th=Math.atan2(e-L.e,n-L.n);const rl=L.r*(0.8+0.4*vnoise(2.2+Math.cos(th)*1.4,3.7+Math.sin(th)*1.4));h=lerp(h,L.h,sm(rl+50,rl,dl));}   // shoreline follows a noise
  return h;
}
function terrainH(n,e){
  let h=groundH(n,e);
  for(const b of BUILDINGS)if(Math.abs(n-b.n)<b.w&&Math.abs(e-b.e)<b.l)h=Math.max(h,groundH(b.n,b.e)+b.h);
  return h;
}
function inLake(n,e){return groundH(n,e)<TERRAIN.lake.h+0.4&&Math.hypot(n-TERRAIN.lake.n,e-TERRAIN.lake.e)<TERRAIN.lake.r*1.3;}
function terrainN(n,e){ // unit normal pointing up (NED: negative D), from finite differences
  const d=0.5, hn=(terrainH(n+d,e)-terrainH(n-d,e))/(2*d), he=(terrainH(n,e+d)-terrainH(n,e-d))/(2*d);
  return vnorm([-hn,-he,-1]);
}
/* Forest density, shared by the tree placement and the ground colour. */
function forestD(n,e){const r=Math.hypot(n,e);return vnoise(n/260+9.2,e/260+4.4)*sm(90,220,r)*sm(60,140,Math.hypot(n-260,e+220))*sm(170,300,Math.hypot(n-(-450),e-550));}
/* Wind: steady vector plus a Dryden-like turbulence (two first-order
   filters per axis on white noise, bandwidth scaled with airspeed/length
   scale) plus a slow gust envelope. Reported in NED. */
const WIND={dir:270,spd:0,turb:0,gust:0,seed:7};
const WST={f:[0,0,0],g:[0,0,0],gustT:0,gustA:0,rng:makeRng(7)};
function windReset(seed){WST.rng=makeRng(seed||WIND.seed);WST.f=[0,0,0];WST.g=[0,0,0];WST.gustT=0;WST.gustA=0;}
function windAt(dt,V,hAGL){
  const from=WIND.dir*DEG, w=WIND.spd*KT;
  // boundary layer: 1/7 power law above 2 m, cut in half at the ground
  const prof=Math.pow(clamp(hAGL,2,300)/10,1/7)*(0.5+0.5*sm(0,4,hAGL));
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
