/* ═══════════════ LIFE (2.9) ═══════════════
   What moves in the landscape besides the aircraft, all of it drawn, none of it in the physics:
   - cars on the roads and the town's streets, keeping to the right, turning round at the ends of their
     routes (main roads 50 to 85 km/h, the town 30 to 45), over the bridge on its deck;
   - three flocks of large birds circling over the lake, the western forest and the summit, flapping and
     gliding by turns, scattering from a helicopter that comes within 70 m;
   - smoke from three chimneys in the village and the factory's stack by the town, rising and drifting
     with the wind, thinning as it spreads;
   - a sailing boat crossing the lake, heeling a little and rocking.
   Time is R3.time, so a still frame (UI.freeze) holds everything where it is. */
const LIFE={ready:false,cars:[],routes:[],birds:[],smoke:[],rng:null};
function lifeInit(gl){if(LIFE.ready)return;LIFE.ready=true;const rng=makeRng(77);LIFE.rng=makeRng(78);
  const cols=[[0.72,0.10,0.08],[0.12,0.24,0.52],[0.86,0.86,0.83],[0.13,0.13,0.14],[0.55,0.56,0.58],[0.20,0.40,0.22],[0.85,0.62,0.12],[0.40,0.42,0.48]];
  LIFE.carM=cols.map(c=>{const b=new MB();const bd=gBox([0,0,-0.62],[2.15,0.88,0.42]);b.add(bd.P,bd.N,c,bd.I);const cb=gBox([-0.25,0,-1.28],[1.25,0.80,0.34]);b.add(cb.P,cb.N,[0.18,0.22,0.27],cb.I);
    for(const [x,y] of [[1.4,0.8],[1.4,-0.8],[-1.4,0.8],[-1.4,-0.8]]){const w=gBox([x,y,-0.32],[0.32,0.12,0.32]);b.add(w.P,w.N,[0.08,0.08,0.08],w.I);}return b.upload(gl)[0];});
  {const b=new MB();const bd=gBox([0,0,-1.5],[5.5,1.25,1.25]);b.add(bd.P,bd.N,[0.85,0.85,0.80],bd.I);const cb=gBox([4.6,0,-1.6],[0.9,1.22,1.1]);b.add(cb.P,cb.N,[0.70,0.15,0.12],cb.I);LIFE.truckM=b.upload(gl)[0];}
  const T=TERRAIN.town,st=k=>T.n0+64*k,se=k=>T.e0+64*k;
  const R=[{pts:[[-1500,-300],[1500,-300]],v:[17,24],k:7},{pts:[[280,-1500],[280,1500]],v:[17,24],k:6},
    {pts:[[-1500,-300],[-2000,-1180],[st(9),-1180],[st(9),T.e0]],v:[14,20],k:3},
    {pts:[[st(2),T.e0],[st(2),T.e1]],v:[8,12],k:2},{pts:[[st(7),T.e0],[st(7),T.e1]],v:[8,12],k:2},{pts:[[T.n0,se(3)],[T.n1,se(3)]],v:[8,12],k:2},{pts:[[T.n0,se(8)],[T.n1,se(8)]],v:[8,12],k:2}];
  for(const r of R){const S=[0];for(let i=1;i<r.pts.length;i++)S.push(S[i-1]+Math.hypot(r.pts[i][0]-r.pts[i-1][0],r.pts[i][1]-r.pts[i-1][1]));r.S=S;r.L=S[S.length-1];LIFE.routes.push(r);
    for(let i=0;i<r.k;i++)LIFE.cars.push({r,v:r.v[0]+(r.v[1]-r.v[0])*rng(),s0:rng()*2*r.L,m:rng()<0.12&&r.v[0]>12?-1:Math.floor(rng()*cols.length)});}
  // birds: a body and two wings each (six vertices), built anew every frame into one buffer
  const fl=[{n:-450,e:550,h:55,R:90,k:10},{n:250,e:-760,h:80,R:140,k:12},{n:2300,e:640,h:90,R:180,k:9}];
  for(const f of fl)for(let i=0;i<f.k;i++)LIFE.birds.push({f,ph:rng()*6.28,dr:(rng()-0.5)*0.35*f.R,dh:(rng()-0.5)*16,fp:rng()*6.28,fl:0});
  LIFE.birdBuf={vp:gl.createBuffer(),vn:gl.createBuffer(),vc:gl.createBuffer(),ib:gl.createBuffer(),n:LIFE.birds.length*6};
  {const I=new Uint16Array(LIFE.birds.length*6);for(let i=0;i<I.length;i++)I[i]=i;gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,LIFE.birdBuf.ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,I,gl.STATIC_DRAW);
   const C=new Float32Array(LIFE.birds.length*18);for(let i=0;i<C.length;i+=3){C[i]=0.22;C[i+1]=0.18;C[i+2]=0.14;}gl.bindBuffer(gl.ARRAY_BUFFER,LIFE.birdBuf.vc);gl.bufferData(gl.ARRAY_BUFFER,C,gl.STATIC_DRAW);}
  // smoke: the village's chimneys (85_render.js R3.chimneys) and the factory stack
  for(const c of (R3.chimneys||[]))LIFE.smoke.push({p:c,parts:[],next:0,rate:0.35,size:[0.8,5],life:11,col:[0.80,0.80,0.80]});
  LIFE.smoke.push({p:[-2100,-1150,-(TERRAIN.town.h+41)],parts:[],next:0,rate:0.18,size:[2.0,14],life:16,col:[0.86,0.86,0.85]});
  LIFE.smokeP=glProg(gl,VS_SMOKE,FS_SMOKE);LIFE.sBuf=gl.createBuffer();LIFE.sCBuf=gl.createBuffer();LIFE.sABuf=gl.createBuffer();
  // the boat: hull, mast, sail
  {const b=new MB();const h=gBox([0,0,-0.35],[2.6,0.95,0.35]);b.add(h.P,h.N,[0.92,0.92,0.90],h.I);const bow=gCone(2.6,0.95,4.0,0.05,4);b.add(bow.P,bow.N,[0.92,0.92,0.90],bow.I,{R:rotX(Math.PI/4),T:[0,0,-0.35]});
   const m=gBox([0.6,0,-4.2],[0.06,0.06,3.9]);b.add(m.P,m.N,[0.75,0.72,0.66],m.I);
   const P=[0.7,0,-0.9, 0.7,0,-7.8, -2.2,0,-1.0],N=[0,1,0,0,1,0,0,1,0];b.add(P,N,[0.97,0.97,0.95],[0,1,2,0,2,1]);LIFE.boatM=b.upload(gl)[0];}}
/* where a car is: along its route and back (it turns round at the ends), to the right of the centre line */
function lifeCar(c,t){const r=c.r,L=r.L;let s=(c.s0+c.v*t)%(2*L),back=false;if(s>L){s=2*L-s;back=true;}
  let i=1;while(i<r.S.length-1&&r.S[i]<s)i++;const a=r.pts[i-1],b=r.pts[i],f=(s-r.S[i-1])/Math.max(1e-6,r.S[i]-r.S[i-1]);
  let dn=b[0]-a[0],de=b[1]-a[1];const l=Math.hypot(dn,de)||1;dn/=l;de/=l;if(back){dn=-dn;de=-de;}
  const n=a[0]+(b[0]-a[0])*f-de*1.8,e=a[1]+(b[1]-a[1])*f+dn*1.8;let h=groundH(n,e);if(Math.abs(n-280)<6&&Math.abs(e-380)<75)h=Math.max(h,0.55);   // on the bridge's deck
  return {n,e,h,psi:Math.atan2(de,dn)};}
/* the parked cars (2.11: beside houses, in the farms' yards, at the hospital's car park; 85_render.js lists them) */
function lifeParked(){if(LIFE.parkedM)return LIFE.parkedM;const rng=makeRng(79),P=[];for(const [n,e,psi,g] of (R3.parked||[]))P.push({n,e,psi,g,m:Math.floor(rng()*LIFE.carM.length)});return LIFE.parkedM=P;}
/* the cars' shadows (2.11): every car within r of the eye, moving or parked, through the renderer's shadow pass */
function lifeShadows(shd,cp,r){if(!LIFE.ready)return;const t=R3.time;
  for(const c of LIFE.cars){const q=lifeCar(c,t);if(Math.hypot(q.n-cp[0],q.e-cp[1])>r)continue;shd(c.m<0?LIFE.truckM:LIFE.carM[c.m],m4model(rotZ(q.psi),[q.n,q.e,-q.h]),-q.h);}
  for(const p of lifeParked()){if(Math.hypot(p.n-cp[0],p.e-cp[1])>r)continue;shd(LIFE.carM[p.m],m4model(rotZ(p.psi),[p.n,p.e,-p.g]),-p.g);}}
function lifeDraw(dt,rmax){const gl=R3.gl;if(!gl)return;lifeInit(gl);const t=R3.time,cp=R3.cam.pos,rp=rmax||2000,rc=rmax||2500,P=frustumPlanes(R3.vp);   // rmax: only the cars within it, no boat or birds (the chin windows, 2.12.2); cars out of view are not drawn
  for(const p of lifeParked()){if(Math.hypot(p.n-cp[0],p.e-cp[1])>rp||!sphereVisible(P,[p.n,p.e,-p.g-1],4))continue;drawMesh(R3.pr.lit,LIFE.carM[p.m],m4model(rotZ(p.psi),[p.n,p.e,-p.g]));}
  // cars
  for(const c of LIFE.cars){const q=lifeCar(c,t);if(Math.hypot(q.n-cp[0],q.e-cp[1])>rc||!sphereVisible(P,[q.n,q.e,-q.h-1.5],7))continue;drawMesh(R3.pr.lit,c.m<0?LIFE.truckM:LIFE.carM[c.m],m4model(rotZ(q.psi),[q.n,q.e,-q.h]));}
  if(rmax)return;
  // the boat
  {const L=TERRAIN.lake,a=t*0.035,n=L.n+70*Math.cos(a),e=L.e+48*Math.sin(a),psi=Math.atan2(48*Math.cos(a),-70*Math.sin(a));
   if(Math.hypot(n-cp[0],e-cp[1])<3000)drawMesh(R3.pr.lit,LIFE.boatM,m4model(mmul(rotZ(psi),rotX(0.10+0.04*Math.sin(t*1.3))),[n,e,-(L.h+0.4)+0.05*Math.sin(t*1.9)]));}
  // birds
  {const B=LIFE.birds,P=new Float32Array(B.length*18),N=new Float32Array(B.length*18),hp=S.pos;let k=0;
   for(const b of B){const f=b.f,R=f.R+b.dr,w=11/R,a=b.ph+w*t,g=terrainH(f.n,f.e);
     let p=[f.n+R*Math.cos(a),f.e+R*Math.sin(a),-(g+f.h+b.dh+4*Math.sin(t*0.3+b.ph))];
     const d=vsub(p,hp),dl=vlen(d);b.fl+=((dl<70?1:0)-b.fl)*Math.min(1,dt*(dl<70?2:0.3));   // a helicopter close by: they scatter and climb, and come back slowly
     if(b.fl>0.01)p=vadd(p,vadd(vscl(vnorm(d),b.fl*45),[0,0,-b.fl*20]));
     const hd=[-Math.sin(a),Math.cos(a),0],sd=[Math.cos(a),Math.sin(a),0],flap=Math.sin(t*0.7+b.fp)>0.2||b.fl>0.2?Math.sin(t*9+b.fp):0.15;   // flapping and gliding by turns
     const span=0.9,tipz=-flap*0.45,nose=vadd(p,vscl(hd,0.45)),tail=vadd(p,vscl(hd,-0.35));
     for(const sg of [-1,1]){const tip=vadd(vadd(p,vscl(sd,sg*span)),[0,0,tipz]);for(const v of [nose,tail,tip]){P[k]=v[0];P[k+1]=v[1];P[k+2]=v[2];N[k]=0;N[k+1]=0;N[k+2]=-1;k+=3;}}}
   const bb=LIFE.birdBuf;gl.bindBuffer(gl.ARRAY_BUFFER,bb.vp);gl.bufferData(gl.ARRAY_BUFFER,P,gl.DYNAMIC_DRAW);gl.bindBuffer(gl.ARRAY_BUFFER,bb.vn);gl.bufferData(gl.ARRAY_BUFFER,N,gl.DYNAMIC_DRAW);
   gl.disable(gl.CULL_FACE);drawMesh(R3.pr.lit,bb,M4I);gl.enable(gl.CULL_FACE);}}
/* smoke, after everything opaque: points that grow and fade (alpha per particle in aN.x) */
const VS_SMOKE=`attribute vec3 aP;attribute vec4 aC;attribute vec3 aN;uniform mat4 uMVP;uniform float uScale;varying vec4 vC;varying float vA;
void main(){vec4 c=uMVP*vec4(aP,1.0);gl_Position=c;gl_PointSize=clamp(aC.a*uScale/max(c.w,0.5),1.0,256.0);vC=aC;vA=aN.x;}`;
const FS_SMOKE=`${GLSL_PREC}varying vec4 vC;varying float vA;uniform float uAlpha;void main(){vec2 q=gl_PointCoord-0.5;float r=dot(q,q)*4.0;if(r>1.0)discard;gl_FragColor=vec4(vC.rgb,(1.0-r)*(1.0-r)*uAlpha*vA);}`;
function lifeSmoke(dt){const gl=R3.gl;if(!gl||!LIFE.ready)return;const run=!UI.paused&&!UI.freeze,rng=LIFE.rng,w=R3.windXY||[0,0];const P=[],C=[],A=[];
  for(const s of LIFE.smoke){if(run){s.next-=dt;if(s.next<=0){s.next=s.rate*(0.7+0.6*rng());s.parts.push({p:s.p.slice(),v:[(rng()-0.5)*0.3,(rng()-0.5)*0.3,-1.1-0.4*rng()],age:0});}
      for(const q of s.parts){q.age+=dt;q.v[0]+=(w[0]*0.9-q.v[0])*Math.min(1,dt*0.5);q.v[1]+=(w[1]*0.9-q.v[1])*Math.min(1,dt*0.5);q.v[2]*=Math.exp(-dt*0.15);q.p=vadd(q.p,vscl(q.v,dt));}
      s.parts=s.parts.filter(q=>q.age<s.life);}
    for(const q of s.parts){const f=q.age/s.life;P.push(q.p[0],q.p[1],q.p[2]);C.push(s.col[0],s.col[1],s.col[2],s.size[0]+(s.size[1]-s.size[0])*Math.sqrt(f));A.push((1-f)*Math.min(1,q.age*2),0,0);}}
  const n=P.length/3;if(!n)return;const pr=LIFE.smokeP;gl.useProgram(pr.p);
  gl.bindBuffer(gl.ARRAY_BUFFER,LIFE.sBuf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(P),gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(pr.a.aP);gl.vertexAttribPointer(pr.a.aP,3,gl.FLOAT,false,0,0);
  gl.bindBuffer(gl.ARRAY_BUFFER,LIFE.sCBuf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(C),gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(pr.a.aC);gl.vertexAttribPointer(pr.a.aC,4,gl.FLOAT,false,0,0);
  gl.bindBuffer(gl.ARRAY_BUFFER,LIFE.sABuf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(A),gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(pr.a.aN);gl.vertexAttribPointer(pr.a.aN,3,gl.FLOAT,false,0,0);
  gl.uniformMatrix4fv(pr.u.uMVP,false,R3.vp);gl.uniform1f(pr.u.uScale,(R3.ph||R3.h)*0.9/Math.tan(R3.cam.fov/2)*0.5);gl.uniform1f(pr.u.uAlpha,0.30);
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.drawArrays(gl.POINTS,0,n);gl.depthMask(true);gl.disable(gl.BLEND);
  gl.disableVertexAttribArray(pr.a.aN);}
