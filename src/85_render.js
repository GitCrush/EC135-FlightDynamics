/* ═══════════════ RENDERER (WebGL 1, no dependencies) ═══════════════
   Everything is drawn in NED world coordinates; the camera basis is
   built from forward/up vectors, so no axis conversion happens outside
   this file. The ground is one mesh with a procedural shader in world
   coordinates: fields with crop rows and hedges, the airfield (runway,
   taxiway, apron, pad markings), roads, the lake, forest floor and rock
   on the slopes. A hovering pilot looks at ground texture drifting under
   the nose, and only a per-fragment texture is fine enough for that. The
   sky is a dome with a cloud layer projected on a plane at 1500 m, so
   clouds give an altitude and drift cue. The rotor is drawn from the
   live blade states (azimuth, flap angle, coning) and the shadow on the
   ground is the height cue it is in the real aircraft. */
const R3={gl:null,pr:{},m:{},w:1,h:1,vp:null,cam:{pos:[0,0,-3],f:[1,0,0],u:[0,0,-1],chasePsi:0,chasePos:null},time:0,turb:0};
/* World coordinates in metres reach 4000: the fragment shaders need
   highp (mediump is a 16-bit float on Apple and mobile GPUs, useless
   beyond a few hundred metres), and the hash must not feed sin() with
   huge arguments. */
const GLSL_PREC=`#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
`;
const GLSL_COMMON=`
float h(vec2 p){p=mod(p,4096.0);vec3 q=fract(vec3(p.xyx)*vec3(0.1031,0.1030,0.0973));q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){return 0.5*vn(p)+0.25*vn(p*2.03+1.7)+0.125*vn(p*4.1+3.1)+0.0625*vn(p*8.3+5.2);}
float seg(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;float t=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0);return length(pa-ba*t);}
`;
const VS_LIT=`attribute vec3 aP;attribute vec3 aN;attribute vec3 aC;uniform mat4 uMVP;uniform mat4 uM;varying vec3 vN;varying vec3 vC;varying vec3 vW;
void main(){vec4 w=uM*vec4(aP,1.0);vW=w.xyz;vN=normalize(mat3(uM)*aN);vC=aC;gl_Position=uMVP*vec4(aP,1.0);}`;
const FS_LIT=`${GLSL_PREC}varying vec3 vN;varying vec3 vC;varying vec3 vW;uniform vec3 uSun;uniform vec3 uCam;uniform float uAlpha;uniform vec3 uFog;
void main(){vec3 n=normalize(vN);float d=max(dot(n,uSun),0.0);float amb=mix(0.30,0.52,clamp(-n.z*0.5+0.5,0.0,1.0));
  vec3 c=vC*(amb+0.62*d);float dist=length(vW-uCam);float f=1.0-exp(-dist*0.00036);c=mix(c,uFog,f);gl_FragColor=vec4(c,uAlpha);}`;
const FS_GND=`${GLSL_PREC}varying vec3 vN;varying vec3 vC;varying vec3 vW;uniform vec3 uSun;uniform vec3 uCam;uniform float uAlpha;uniform vec3 uFog;uniform float uT;
${GLSL_COMMON}
void main(){
  vec2 p=vW.xy; float alt=-vW.z; vec3 n=normalize(vN);
  /* fields: 45 m cells, each with a crop type and a row direction */
  vec2 cell=floor(p/45.0), fc=fract(p/45.0);
  float r1=h(cell), r2=h(cell+3.7), r3=h(cell+11.1);
  vec3 grass=mix(vec3(0.33,0.46,0.20),vec3(0.47,0.55,0.25),vn(p/60.0));
  grass=mix(grass,vec3(0.30,0.40,0.17),0.4*(vn(p/9.0)*0.6+vn(p/3.0)*0.4));
  vec2 jit=vec2(h(floor(p/3.0)),h(floor(p/3.0)+7.0))*0.9;
  grass=mix(grass,vec3(0.24,0.33,0.14),step(0.90,h(floor(p/0.8+jit)))*0.4);
  grass=mix(grass,vec3(0.40,0.45,0.22),step(0.93,h(floor(p/0.35)))*0.35);
  float rowc=(r2<0.5)?p.x:p.y;
  vec3 crop=mix(vec3(0.42,0.50,0.18),vec3(0.62,0.58,0.26),r3);
  crop*=0.86+0.14*(1.0-2.0*abs(fract(rowc/0.9)-0.5));                 // 0.9 m rows
  vec3 plough=vec3(0.36,0.28,0.18)*(0.80+0.20*(1.0-2.0*abs(fract(rowc/0.6)-0.5)));
  vec3 fld=r1<0.55?grass:(r1<0.85?crop:plough);
  float hx=step(0.35,h(cell+5.5))*(1.0-smoothstep(0.0,0.025,min(fc.x,1.0-fc.x))), hy=step(0.35,h(cell+8.1))*(1.0-smoothstep(0.0,0.025,min(fc.y,1.0-fc.y)));
  float hedge=max(hx,hy);
  fld=mix(fld,vec3(0.16,0.25,0.10),hedge*0.85);                     // hedgerows
  /* forest floor and rock */
  float fd=vn(p/260.0+vec2(9.2,4.4));
  fld=mix(fld,vec3(0.20,0.27,0.13),smoothstep(0.5,0.65,fd)*0.7);
  float slope=1.0-(-n.z);
  vec3 rock=mix(vec3(0.42,0.38,0.33),vec3(0.55,0.50,0.44),vn(p/4.0));
  fld=mix(fld,rock,smoothstep(0.045,0.09,slope));
  fld=mix(fld,vec3(0.55,0.47,0.33),clamp((alt-16.0)/12.0,0.0,1.0)*0.5);
  /* airfield: runway 18/36, taxiway, apron and pad; roads; all in world metres */
  float rw=seg(p,vec2(-900.0,-150.0),vec2(-100.0,-150.0));
  float tw=min(seg(p,vec2(-100.0,-150.0),vec2(-40.0,-150.0)),seg(p,vec2(-40.0,-150.0),vec2(-40.0,-50.0)));
  float apron=max(abs(p.x)-40.0,abs(p.y)-60.0);
  float road=min(seg(p,vec2(-1500.0,-300.0),vec2(1500.0,-300.0)),seg(p,vec2(280.0,-1500.0),vec2(280.0,1500.0)));
  vec3 asphalt=vec3(0.30,0.30,0.31)*(0.9+0.2*vn(p/1.3));
  vec3 concrete=vec3(0.58,0.57,0.54)*(0.92+0.12*vn(p/2.2));
  float joints=1.0-smoothstep(0.0,0.05,min(abs(fract(p.x/5.0)-0.5),abs(fract(p.y/5.0)-0.5))*5.0);
  concrete=mix(concrete,vec3(0.45,0.44,0.42),joints*0.5);
  vec3 col=fld;
  col=mix(col,vec3(0.28,0.28,0.29)*(0.9+0.2*vn(p/1.1)),1.0-smoothstep(3.3,3.8,road));
  float dash=step(0.5,fract(p.x/12.0))*step(abs(p.y+300.0),0.12)+step(0.5,fract(p.y/12.0))*step(abs(p.x-280.0),0.12);
  col=mix(col,vec3(0.9,0.9,0.85),dash*(1.0-smoothstep(3.0,3.5,road)));
  col=mix(col,asphalt,1.0-smoothstep(9.8,10.4,rw));
  float cl=step(abs(p.y+150.0),0.25)*step(0.5,fract(p.x/30.0))*step(-880.0,p.x)*step(p.x,-120.0);
  float thr=step(abs(p.y+150.0),8.0)*step(0.5,fract((p.y+150.0)/2.0))*(step(abs(p.x+890.0),6.0)+step(abs(p.x+110.0),6.0));
  float edge=step(9.4,rw)*step(rw,9.8);
  col=mix(col,vec3(0.92,0.92,0.88),(cl+thr+edge)*(1.0-smoothstep(9.8,10.4,rw)));
  col=mix(col,concrete,1.0-smoothstep(4.8,5.3,tw));
  col=mix(col,vec3(0.95,0.80,0.15),step(abs(seg(p,vec2(-100.0,-150.0),vec2(-40.0,-150.0))),0.12)*step(0.5,fract(p.x/4.0))+step(abs(p.x+40.0),0.12)*step(-150.0,p.y)*step(p.y,-50.0)*step(0.5,fract(p.y/4.0)));
  col=mix(col,concrete,1.0-smoothstep(-0.3,0.3,apron));
  float rp=length(p);
  col=mix(col,vec3(0.24,0.24,0.26),1.0-smoothstep(7.4,7.8,rp));                       // pad
  col=mix(col,vec3(0.95,0.95,0.92),step(6.5,rp)*step(rp,7.3));                          // ring
  float H=step(abs(p.y),2.2)*step(abs(p.x),0.35)+step(abs(abs(p.y)-1.85),0.35)*step(abs(p.x),2.0);
  col=mix(col,vec3(0.95,0.95,0.92),H*step(rp,7.0));
  float tlof=step(abs(max(abs(p.x)-14.0,abs(p.y)-14.0)),0.2);
  col=mix(col,vec3(0.95,0.80,0.15),tlof*step(0.5,fract((p.x+p.y)/3.0)));
  /* lake */
  float dl=length(p-vec2(-450.0,550.0));
  if(dl<230.0&&alt<-1.1){vec3 water=mix(vec3(0.16,0.30,0.38),vec3(0.28,0.42,0.48),vn(p/6.0+uT*0.05));
    vec3 v=normalize(uCam-vW);vec3 nn=normalize(vec3((vn(p/2.0+uT*0.3)-0.5)*0.06,(vn(p/2.0+3.0-uT*0.25)-0.5)*0.06,-1.0));
    float spec=pow(max(dot(reflect(-uSun,nn),v),0.0),60.0);col=water+spec*0.7;}
  float d=max(dot(n,uSun),0.0);float amb=mix(0.34,0.54,clamp(-n.z*0.5+0.5,0.0,1.0));
  col=col*(amb+0.62*d);
  float dist=length(vW-uCam);float f=1.0-exp(-dist*0.00036);col=mix(col,uFog,f);
  gl_FragColor=vec4(col,1.0);}`;
const VS_SKY=`attribute vec3 aP;uniform mat4 uMVP;varying vec3 vD;void main(){vD=aP;vec4 c=uMVP*vec4(aP,1.0);gl_Position=vec4(c.xy,c.w*0.9999,c.w);}`;   // just inside the far plane
const FS_SKY=`${GLSL_PREC}varying vec3 vD;uniform vec3 uSun;uniform vec3 uCam;uniform float uT;uniform vec3 uFog;uniform float uCloud;uniform vec2 uWind;
${GLSL_COMMON}
void main(){vec3 d=normalize(vD);float up=clamp(-d.z,-0.05,1.0);
  vec3 zen=vec3(0.30,0.48,0.82),hor=uFog;
  vec3 c=mix(hor,zen,pow(max(up,0.0),0.45));
  float s=max(dot(d,uSun),0.0);c+=vec3(1.0,0.92,0.75)*(pow(s,600.0)*1.5+pow(s,12.0)*0.12);
  if(up>0.01){float hc=1500.0+uCam.z;vec2 uv=uCam.xy+d.xy/up*hc-uWind*uT;   // cloud base 1500 m above sea level
    float k=fbm(uv/850.0);float cov=smoothstep(0.55-uCloud*0.25,0.75-uCloud*0.2,k);
    float shade=mix(0.68,1.0,fbm(uv/300.0+2.0));vec3 cc=mix(vec3(0.62,0.66,0.72),vec3(1.0,1.0,1.0),shade);
    float fade=smoothstep(0.0,0.12,up);c=mix(c,cc,cov*fade*0.95);}
  gl_FragColor=vec4(c,1.0);}`;
function glProg(gl,vs,fs){const p=gl.createProgram();for(const [t,s] of [[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]]){const sh=gl.createShader(t);gl.shaderSource(sh,s);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh));gl.attachShader(p,sh);}
  gl.linkProgram(p);const o={p,a:{},u:{}};for(const n of ['aP','aN','aC'])o.a[n]=gl.getAttribLocation(p,n);for(const n of ['uMVP','uM','uSun','uCam','uAlpha','uFog','uT','uCloud','uWind'])o.u[n]=gl.getUniformLocation(p,n);return o;}
/* ---- mesh builder: primitives appended with a transform, chunked at 60k vertices ---- */
function MB(){this.chunks=[];this.cur=null;this.fresh();}
MB.prototype.fresh=function(){this.cur={P:[],N:[],C:[],I:[]};this.chunks.push(this.cur);};
MB.prototype.add=function(pos,nrm,col,idx,M){if(this.cur.P.length/3+pos.length/3>60000)this.fresh();const c=this.cur,b=c.P.length/3;const R=M&&M.R?M.R:null,T=M&&M.T?M.T:[0,0,0],S=M&&M.S?M.S:null;
  for(let i=0;i<pos.length;i+=3){let p=[pos[i],pos[i+1],pos[i+2]],n=[nrm[i],nrm[i+1],nrm[i+2]];if(S){p=[p[0]*S[0],p[1]*S[1],p[2]*S[2]];n=vnorm([n[0]/S[0],n[1]/S[1],n[2]/S[2]]);}if(R){p=mrot(R,p);n=mrot(R,n);}c.P.push(p[0]+T[0],p[1]+T[1],p[2]+T[2]);c.N.push(n[0],n[1],n[2]);const cc=Array.isArray(col[0])?col[(i/3)|0]||col[0]:col;c.C.push(cc[0],cc[1],cc[2]);}
  for(const i of idx)c.I.push(i+b);return this;};
MB.prototype.upload=function(gl){return this.chunks.filter(c=>c.I.length).map(c=>{const m={n:c.I.length};
  m.vp=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,m.vp);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(c.P),gl.STATIC_DRAW);
  m.vn=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,m.vn);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(c.N),gl.STATIC_DRAW);
  m.vc=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,m.vc);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(c.C),gl.STATIC_DRAW);
  m.ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,m.ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(c.I),gl.STATIC_DRAW);return m;});};
// box centred at c with half sizes s (flat-shaded)
function gBox(c,s){const P=[],N=[],I=[];const f=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  for(const n of f){const u=n[0]?[0,1,0]:[1,0,0],v=vcross(n,u);const b=P.length/3;for(const [a,bb] of [[-1,-1],[1,-1],[1,1],[-1,1]]){P.push(c[0]+s[0]*(n[0]+a*u[0]+bb*v[0]),c[1]+s[1]*(n[1]+a*u[1]+bb*v[1]),c[2]+s[2]*(n[2]+a*u[2]+bb*v[2]));N.push(n[0],n[1],n[2]);}I.push(b,b+1,b+2,b,b+2,b+3);}
  return {P,N,I};}
// cone/cylinder along +x from x0 (radius r0) to x1 (radius r1)
function gCone(x0,r0,x1,r1,seg=12,cap=true){const P=[],N=[],I=[];const L=x1-x0,dr=r0-r1,nl=Math.hypot(L,dr)||1;
  for(let i=0;i<=seg;i++){const a=i/seg*2*Math.PI,cy=Math.cos(a),cz=Math.sin(a);P.push(x0,r0*cy,r0*cz,x1,r1*cy,r1*cz);const nx=dr/nl,nr=L/nl;N.push(nx,nr*cy,nr*cz,nx,nr*cy,nr*cz);}
  for(let i=0;i<seg;i++){const b=i*2;I.push(b,b+2,b+1,b+1,b+2,b+3);}
  if(cap){for(const [x,r,d] of [[x0,r0,-1],[x1,r1,1]]){if(r<=0)continue;const b=P.length/3;P.push(x,0,0);N.push(d,0,0);for(let i=0;i<=seg;i++){const a=i/seg*2*Math.PI;P.push(x,r*Math.cos(a),r*Math.sin(a));N.push(d,0,0);}for(let i=0;i<seg;i++){if(d>0)I.push(b,b+1+i,b+2+i);else I.push(b,b+2+i,b+1+i);}}}
  return {P,N,I};}
// tube between two points
function basisX(d){const x=vnorm(d);let up=Math.abs(x[2])<0.9?[0,0,1]:[1,0,0];const y=vnorm(vcross(up,x)),z=vcross(x,y);return [x[0],y[0],z[0],x[1],y[1],z[1],x[2],y[2],z[2]];}
function tube(b,a,c,r0,r1,col,seg=6){const d=vsub(c,a),L=vlen(d);const g=gCone(0,r0,L,r1===undefined?r0:r1,seg);b.add(g.P,g.N,col,g.I,{R:basisX(d),T:a});}
// ellipsoid, disc/ring, gable roof, lofted body
function gEll(r,sa=16,sb=10){const P=[],N=[],I=[];for(let j=0;j<=sb;j++){const t=j/sb*Math.PI,st=Math.sin(t),ct=Math.cos(t);for(let i=0;i<=sa;i++){const a=i/sa*2*Math.PI;const n=[ct,st*Math.cos(a),st*Math.sin(a)];P.push(n[0]*r[0],n[1]*r[1],n[2]*r[2]);const nn=vnorm([n[0]/r[0],n[1]/r[1],n[2]/r[2]]);N.push(nn[0],nn[1],nn[2]);}}
  for(let j=0;j<sb;j++)for(let i=0;i<sa;i++){const b=j*(sa+1)+i;I.push(b,b+sa+1,b+1,b+1,b+sa+1,b+sa+2);}return {P,N,I};}
function gDisc(r0,r1,seg=32){const P=[],N=[],I=[];for(let i=0;i<=seg;i++){const a=i/seg*2*Math.PI,c=Math.cos(a),s=Math.sin(a);P.push(r0*c,r0*s,0,r1*c,r1*s,0);N.push(0,0,-1,0,0,-1);}
  for(let i=0;i<seg;i++){const b=i*2;I.push(b,b+2,b+1,b+1,b+2,b+3);}return {P,N,I};}   // front face seen from above (-z)
function gRoof(hx,hy,zb,zt){const P=[hx,-hy,zb, hx,hy,zb, hx,0,zt, -hx,-hy,zb, -hx,hy,zb, -hx,0,zt, hx,-hy,zb,-hx,-hy,zb,hx,0,zt,-hx,0,zt, hx,hy,zb,-hx,hy,zb,hx,0,zt,-hx,0,zt];
  const nl=vnorm([0,-(zt-zb),-hy]),nr=vnorm([0,(zt-zb),-hy]);const N=[1,0,0,1,0,0,1,0,0,-1,0,0,-1,0,0,-1,0,0,...nl,...nl,...nl,...nl,...nr,...nr,...nr,...nr];
  const I=[0,1,2,3,5,4,6,8,7,7,8,9,10,11,12,11,13,12];return {P,N,I};}
/* Lofted fuselage: sections [x, half-width, half-height, z-centre]; glass tint on the canopy and the side windows. */
function gLoft(secs,seg=14){const P=[],N=[],cols=[],I=[];const nS=secs.length;
  for(let j=0;j<nS;j++){const [x,w,hh,zc]=secs[j];for(let i=0;i<=seg;i++){const a=i/seg*2*Math.PI,cy=Math.cos(a),cz=Math.sin(a);P.push(x,w*cy,zc+hh*cz);
      const dx=j<nS-1?(secs[j+1][1]-w)/(secs[j+1][0]-x):(w-secs[j-1][1])/(x-secs[j-1][0]);const nn=vnorm([-dx*0.6,cy/Math.max(w,0.01),cz/Math.max(hh,0.01)]);N.push(nn[0],nn[1],nn[2]);
      const glass=(x>0.6&&x<3.3&&cz<-0.15)||(x>-0.5&&x<0.6&&cz<-0.25&&cz>-0.85&&Math.abs(cy)>0.6);cols.push(glass?[0.22,0.28,0.36]:[0.83,0.82,0.78]);}}
  for(let j=0;j<nS-1;j++)for(let i=0;i<seg;i++){const b=j*(seg+1)+i;I.push(b,b+seg+1,b+1,b+1,b+seg+1,b+seg+2);}
  return {P,N,I,cols};}
function rotZ(a){const c=Math.cos(a),s=Math.sin(a);return [c,-s,0,s,c,0,0,0,1];}
function rotY(a){const c=Math.cos(a),s=Math.sin(a);return [c,0,s,0,1,0,-s,0,c];}
function rotX(a){const c=Math.cos(a),s=Math.sin(a);return [1,0,0,0,c,-s,0,s,c];}
function mmul(A,B){const C=new Array(9).fill(0);for(let i=0;i<3;i++)for(let j=0;j<3;j++)for(let k=0;k<3;k++)C[i*3+j]+=A[i*3+k]*B[k*3+j];return C;}
const UPX=[0,0,1, 0,1,0, -1,0,0];                       // maps +x of a gCone to straight up (-z)
/* ---- scene ---- */
function glInit(canvas){
  const gl=canvas.getContext('webgl',{antialias:true,alpha:false});
  if(!gl)throw new Error('WebGL not available');
  R3.gl=gl;R3.canvas=canvas;R3.pr.lit=glProg(gl,VS_LIT,FS_LIT);R3.pr.gnd=glProg(gl,VS_LIT,FS_GND);R3.pr.sky=glProg(gl,VS_SKY,FS_SKY);
  // what this GPU gives us; the far plane follows the depth buffer
  const hp=gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER,gl.HIGH_FLOAT);
  R3.info={depthBits:gl.getParameter(gl.DEPTH_BITS),fragHighp:hp&&hp.precision>0,renderer:(gl.getExtension('WEBGL_debug_renderer_info')?gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL):'?')};
  R3.far=R3.info.depthBits>=24?9000:4500;
  console.log('EC135 Flight Dynamics GL:',JSON.stringify(R3.info));
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);
  // sky dome
  {const b=new MB();const d=gEll([5000,5000,5000],24,12);b.add(d.P,d.N.map(v=>-v),[1,1,1],d.I.slice().reverse());R3.m.sky=b.upload(gl)[0];}
  // terrain: warped grid, fine near the pad, coarse at 4 km
  {const N=200;const P=[],Nn=[],C=[],I=[];const w=u=>4000*Math.sign(u)*Math.pow(Math.abs(u),1.8);
    const gN=(n,e)=>{const d=0.5,hn=(groundH(n+d,e)-groundH(n-d,e))/(2*d),he=(groundH(n,e+d)-groundH(n,e-d))/(2*d);return vnorm([-hn,-he,-1]);};
    for(let j=0;j<=N;j++)for(let i=0;i<=N;i++){const n=w(j/N*2-1),e=w(i/N*2-1);const hgt=groundH(n,e),nn=gN(n,e);P.push(n,e,-hgt);Nn.push(nn[0],nn[1],nn[2]);C.push(0,0,0);}
    for(let j=0;j<N;j++)for(let i=0;i<N;i++){const a=j*(N+1)+i;I.push(a,a+1,a+N+1,a+1,a+N+2,a+N+1);}
    const m={n:I.length};
    m.vp=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,m.vp);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(P),gl.STATIC_DRAW);
    m.vn=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,m.vn);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(Nn),gl.STATIC_DRAW);
    m.vc=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,m.vc);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(C),gl.STATIC_DRAW);
    m.ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,m.ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(I),gl.STATIC_DRAW);
    R3.m.ground=m;}
  buildScenery(gl);buildAircraft(gl);
}
function buildScenery(gl){
  const b=new MB(),rng=makeRng(3);const hAt=(n,e)=>-terrainH(n,e);
  const soil=gDisc(0,3.2,10);
  const tree=(n,e,s,kind)=>{const z=hAt(n,e);const dark=0.85+0.3*rng();
    b.add(soil.P,soil.N,[0.20,0.26,0.12],soil.I,{S:[s,s,1],T:[n,e,z-0.06]});                       // shade under the crown
    if(kind==='pine'){tube(b,[n,e,z],[n,e,z-2.0*s],0.22*s,0.16*s,[0.33,0.24,0.15],4);
      for(const [zz,r,hh] of [[1.6,2.1,5.0],[4.4,1.3,3.6]]){const c=gCone(0,r*s,-hh*s,0.05,5,false);b.add(c.P,c.N,[0.11*dark,0.30*dark,0.13*dark],c.I,{R:UPX,T:[n,e,z-zz*s]});}}
    else{tube(b,[n,e,z],[n,e,z-2.4*s],0.28*s,0.18*s,[0.36,0.26,0.16],5);
      const cr=gEll([2.6*s,2.6*s,2.2*s],7,4);b.add(cr.P,cr.N,[0.16*dark,0.38*dark,0.13*dark],cr.I,{T:[n,e,z-4.2*s]});
      const c2=gEll([1.7*s,1.9*s,1.6*s],6,3);b.add(c2.P,c2.N,[0.20*dark,0.42*dark,0.15*dark],c2.I,{T:[n+0.8*s,e-0.6*s,z-5.6*s]});}};
  // forests from the shared density function, jittered grid, 20 m spacing within 1300 m
  let nT=0;
  for(let n=-1300;n<=1300;n+=20)for(let e=-1300;e<=1300;e+=20){const jn=n+(rng()-0.5)*14,je=e+(rng()-0.5)*14;const d=forestD(jn,je);
    if(d<0.53||inLake(jn,je))continue;if(Math.hypot(jn,je)<90)continue;if(Math.abs(je+150)<24&&jn<-90&&jn>-910)continue;if(Math.abs(je+300)<8||Math.abs(jn-280)<8)continue;
    if(rng()>0.75+(d-0.5)*1.5)continue;tree(jn,je,0.75+rng()*0.7,rng()<0.6?'pine':'broad');nT++;}
  // scattered single trees, hedgerow trees
  for(let i=0;i<220;i++){const n=(rng()*2-1)*1400,e=(rng()*2-1)*1400;if(Math.hypot(n,e)<120||inLake(n,e))continue;if(Math.abs(e+150)<30&&n<-80&&n>-920)continue;if(Math.abs(e+300)<10||Math.abs(n-280)<10)continue;tree(n,e,0.9+rng()*0.8,'broad');}
  for(let i=0;i<14;i++){const a=i/14*2*Math.PI;tree(260+28*Math.cos(a),-220+28*Math.sin(a),1.3,'broad');}   // confined area
  // control tower (the tower camera sits in its cab)
  {const c=gCone(0,2.2,-11,1.8,10);b.add(c.P,c.N,[0.75,0.74,0.70],c.I,{R:UPX,T:[-70,55,hAt(-70,55)]});
    const cab=gBox([0,0,-12.5],[3.2,3.2,1.6]);b.add(cab.P,cab.N,[0.22,0.30,0.38],cab.I,{T:[-70,55,hAt(-70,55)]});
    const rf=gBox([0,0,-14.3],[3.6,3.6,0.25]);b.add(rf.P,rf.N,[0.85,0.85,0.82],rf.I,{T:[-70,55,hAt(-70,55)]});}
  // hangars with doors, fuel station, fence posts round the apron
  for(let i=0;i<4;i++){const n=-130,e=150+i*44,z=hAt(n,e);const hb=gBox([0,0,-5.5],[20,16,5.5]);b.add(hb.P,hb.N,[0.60,0.60,0.62],hb.I,{T:[n,e,z]});
    const rf=gRoof(20.5,16.5,-11,-15);b.add(rf.P,rf.N,[0.48,0.32,0.26],rf.I,{T:[n,e,z]});
    const dr=gBox([20.05,0,-4.5],[0.1,12,4.5]);b.add(dr.P,dr.N,[0.35,0.36,0.40],dr.I,{T:[n,e,z]});}
  {const z=hAt(-70,-80);const fb=gBox([0,0,-1.6],[3,2,1.6]);b.add(fb.P,fb.N,[0.85,0.30,0.15],fb.I,{T:[-70,-80,z]});const fr=gBox([0,0,-4.5],[7,5,0.2]);b.add(fr.P,fr.N,[0.85,0.85,0.82],fr.I,{T:[-70,-80,z]});
    for(const [dn,de] of [[6,4],[6,-4],[-6,4],[-6,-4]])tube(b,[-70+dn,-80+de,z],[-70+dn,-80+de,z-4.4],0.12,0.12,[0.6,0.6,0.6],5);}
  for(let e=-62;e<=62;e+=8)for(const n of [-42,42]){tube(b,[n,e,hAt(n,e)],[n,e,hAt(n,e)-1.5],0.05,0.05,[0.55,0.55,0.55],4);}
  // pad perimeter lights, runway edge and threshold lights, windsock pole, approach cones
  for(let i=0;i<12;i++){const a=i/12*2*Math.PI,n=9*Math.cos(a),e=9*Math.sin(a);const l=gBox([n,e,hAt(n,e)-0.08],[0.1,0.1,0.08]);b.add(l.P,l.N,[1.0,0.85,0.2],l.I);}
  for(let n=-900;n<=-100;n+=50)for(const e of [-161,-139]){const l=gBox([n,e,hAt(n,e)-0.2],[0.15,0.15,0.2]);b.add(l.P,l.N,n===-900||n===-100?[0.2,1.0,0.3]:[1.0,1.0,0.9],l.I);}
  tube(b,[35,-45,hAt(35,-45)],[35,-45,hAt(35,-45)-7],0.06,0.05,[0.8,0.8,0.8],6);
  for(const [n,e] of [[25,25],[25,-25],[-25,25],[-25,-25]]){const c=gCone(0,0.35,-1.0,0.0,8);b.add(c.P,c.N,[0.95,0.45,0.1],c.I,{R:UPX,T:[n,e,hAt(n,e)]});}
  // power line along the north-south road: the hazard low flying is about
  for(let n=-1400;n<=1400;n+=70){const e=-322,z=hAt(n,e);tube(b,[n,e,z],[n,e,z-11],0.18,0.14,[0.45,0.40,0.35],5);const cb=gBox([0,0,-10.6],[0.12,1.6,0.08]);b.add(cb.P,cb.N,[0.45,0.40,0.35],cb.I,{T:[n,e,z]});
    if(n<1400)for(const dy of [-1.4,0,1.4]){const z2=hAt(n+70,e);const a=[n,e+dy,z-10.5],c=[n+70,e+dy,z2-10.5];const mid=[n+35,e+dy,(z+z2)/2-10.5+1.2];tube(b,a,mid,0.03,0.03,[0.15,0.15,0.15],3);tube(b,mid,c,0.03,0.03,[0.15,0.15,0.15],3);}}
  // village east of the road
  for(let i=0;i<16;i++){const n=300+rng()*140,e=480+rng()*220;if(Math.abs(n-280)<14)continue;const z=hAt(n,e),w=5+rng()*3,l=6+rng()*4,hh=3+rng()*1.5;const R=rotZ(rng()<0.5?0:Math.PI/2);
    const hb=gBox([0,0,-hh/2],[l,w,hh/2]);b.add(hb.P,hb.N,[0.80+0.1*rng(),0.76,0.68],hb.I,{R,T:[n,e,z]});const rf=gRoof(l+0.4,w+0.4,-hh,-hh-w*0.7);b.add(rf.P,rf.N,[0.55+0.2*rng(),0.25,0.20],rf.I,{R,T:[n,e,z]});}
  {const z=hAt(400,600);const ch=gBox([0,0,-4],[8,5,4]);b.add(ch.P,ch.N,[0.82,0.80,0.74],ch.I,{T:[400,600,z]});const rf=gRoof(8.4,5.4,-8,-12);b.add(rf.P,rf.N,[0.4,0.4,0.42],rf.I,{T:[400,600,z]});
    const tw=gBox([9.5,0,-9],[2,2,9]);b.add(tw.P,tw.N,[0.82,0.80,0.74],tw.I,{T:[400,600,z]});const sp=gCone(0,2.4,-9,0.0,4);b.add(sp.P,sp.N,[0.35,0.35,0.38],sp.I,{R:UPX,T:[409.5,600,z-18]});}
  // hospital with the rooftop pad (the plateau the physics sees is in BUILDINGS)
  for(const bd of BUILDINGS){const z=-groundH(bd.n,bd.e);const bx=gBox([0,0,-bd.h/2],[bd.w,bd.l,bd.h/2]);b.add(bx.P,bx.N,[0.78,0.76,0.72],bx.I,{T:[bd.n,bd.e,z]});
    for(let f=1;f<bd.h/3.2;f++){const band=gBox([0,0,-f*3.2],[bd.w+0.05,bd.l+0.05,0.5]);b.add(band.P,band.N,[0.35,0.42,0.50],band.I,{T:[bd.n,bd.e,z]});}
    const wing=gBox([bd.w+12,0,-5],[12,bd.l,5]);b.add(wing.P,wing.N,[0.78,0.76,0.72],wing.I,{T:[bd.n,bd.e,z]});
    if(bd.pad){const pd=gDisc(0,11,32);b.add(pd.P,pd.N,[0.22,0.22,0.24],pd.I,{T:[bd.n,bd.e,z-bd.h-0.12]});const rg=gDisc(9.5,10.5,32);b.add(rg.P,rg.N,[0.95,0.95,0.92],rg.I,{T:[bd.n,bd.e,z-bd.h-0.20]});
      const hb=gBox([0,0,-bd.h-0.20],[2.2,0.35,0.02]);b.add(hb.P,hb.N,[0.95,0.95,0.92],hb.I,{T:[bd.n,bd.e,z]});for(const y of [-1.8,1.8]){const bb=gBox([0,y,-bd.h-0.20],[0.35,2.0,0.02]);b.add(bb.P,bb.N,[0.95,0.95,0.92],bb.I,{T:[bd.n,bd.e,z]});}
      for(let i=0;i<8;i++){const a=i/8*2*Math.PI;const l=gBox([13*Math.cos(a),13*Math.sin(a),-bd.h-0.6],[0.1,0.1,0.6]);b.add(l.P,l.N,[1.0,0.85,0.2],l.I,{T:[bd.n,bd.e,z]});}
      const rail=gBox([0,0,-bd.h-0.6],[bd.w,bd.l,0.05]);}
    const cross=gBox([bd.w+0.05,0,-bd.h*0.6],[0.05,2.5,0.6]);b.add(cross.P,cross.N,[0.85,0.15,0.15],cross.I,{T:[bd.n,bd.e,z]});const cross2=gBox([bd.w+0.05,0,-bd.h*0.6],[0.05,0.6,2.5]);b.add(cross2.P,cross2.N,[0.85,0.15,0.15],cross2.I,{T:[bd.n,bd.e,z]});}
  // wind turbine towers (the rotors are drawn live)
  R3.turbines=[[900,-700],[1010,-560],[1120,-420]];
  for(const [n,e] of R3.turbines){const z=hAt(n,e);tube(b,[n,e,z],[n,e,z-60],2.2,1.3,[0.90,0.90,0.90],10);}
  // jetty on the lake
  {const z=1.5;tube(b,[-300,520,hAt(-300,520)],[-330,530,z-0.6],0.5,0.5,[0.45,0.35,0.25],4);}
  R3.m.scene=b.upload(gl);R3.nTrees=nT;
  const wb=new MB();const ws=gCone(0,0.35,2.6,0.12,8,false);wb.add(ws.P,ws.N,[1.0,0.45,0.05],ws.I);R3.m.sock=wb.upload(gl)[0];
  const tb=new MB();const nac=gBox([0,0,0],[3.6,1.4,1.4]);tb.add(nac.P,nac.N,[0.9,0.9,0.9],nac.I,{T:[-1.5,0,0]});for(let k=0;k<3;k++){const bl=gBox([0,0,-14.5],[0.25,0.7,14.5]);tb.add(bl.P,bl.N,[0.92,0.92,0.92],bl.I,{R:rotX(k*2*Math.PI/3),T:[2.4,0,0]});}R3.m.turbine=tb.upload(gl)[0];
}
function buildAircraft(gl){
  const grey=[0.83,0.82,0.78],dark=[0.18,0.18,0.2],red=[0.75,0.12,0.1];
  const b=new MB();
  /* fuselage loft: nose, cabin, engine deck taper, boom (body axes, x forward) */
  const lf=gLoft([[3.55,0.06,0.06,0.25],[3.25,0.40,0.42,0.15],[2.7,0.66,0.72,0.02],[2.0,0.78,0.90,-0.12],[1.2,0.82,0.95,-0.18],[0.3,0.82,0.95,-0.18],[-0.6,0.76,0.86,-0.22],[-1.3,0.58,0.62,-0.28],[-1.9,0.40,0.42,-0.30],[-4.0,0.27,0.30,-0.33],[-5.7,0.20,0.24,-0.36],[-6.3,0.15,0.20,-0.40]],16);
  b.add(lf.P,lf.N,lf.cols,lf.I);
  const deck=gBox([-0.35,0,-0.92],[1.35,0.52,0.22]);b.add(deck.P,deck.N,[0.72,0.71,0.68],deck.I);            // engine cowling
  for(const y of [-0.62,0.62]){const ex=gCone(-1.75,0.14,-1.95,0.14,8);b.add(ex.P,ex.N,[0.25,0.22,0.2],ex.I,{T:[0,y,-0.95]});}   // exhausts
  for(const y of [-0.55,0.55]){const it=gBox([0.55,y*0.9,-1.05],[0.35,0.18,0.12]);b.add(it.P,it.N,[0.3,0.3,0.32],it.I);}     // intakes
  const fin=gBox([-6.15,0,-0.55],[0.55,0.09,1.0]);b.add(fin.P,fin.N,red,fin.I);
  const fintop=gBox([-6.2,0,-1.65],[0.45,0.07,0.15]);b.add(fintop.P,fintop.N,grey,fintop.I);
  const stab=gBox([-4.9,0,0.15],[0.30,1.3,0.035]);b.add(stab.P,stab.N,grey,stab.I);
  for(const y of [-1.3,1.3]){const ep=gBox([-4.9,y,0.0],[0.32,0.03,0.34]);b.add(ep.P,ep.N,red,ep.I);}
  // skids: tubes with upturned front, cross tubes
  for(const y of [-1.02,1.02]){tube(b,[-1.5,y,1.30],[1.5,y,1.30],0.05,0.05,dark,6);tube(b,[1.5,y,1.30],[2.0,y,0.95],0.05,0.045,dark,6);
    for(const x of [0.9,-1.0]){tube(b,[x,0,0.75],[x,y,1.30],0.045,0.04,dark,5);}}
  const mast=gCone(0,0.09,0.85,0.09,8);b.add(mast.P,mast.N,dark,mast.I,{R:UPX,T:[0,0,-0.85]});
  const ll=gBox([1.9,0.3,0.55],[0.12,0.12,0.06]);b.add(ll.P,ll.N,[1,1,0.9],ll.I);                                 // landing light
  R3.m.body=b.upload(gl)[0];
  const fb=new MB();const fd=gDisc(0.5,0.62,24);fb.add(fd.P,fd.N,red,fd.I,{R:rotX(-Math.PI/2),T:[-6.15,0.10,-0.55]});fb.add(fd.P,fd.N,red,fd.I,{R:rotX(Math.PI/2),T:[-6.15,-0.10,-0.55]});
  const rim=gCone(-0.10,0.55,0.10,0.55,24,false);fb.add(rim.P,rim.N,dark,rim.I,{R:[0,1,0,-1,0,0,0,0,1],T:[-6.15,0,-0.55]});
  const hubc=gCone(-0.12,0.13,0.12,0.13,10);fb.add(hubc.P,hubc.N,dark,hubc.I,{R:[0,1,0,-1,0,0,0,0,1],T:[-6.15,0,-0.55]});R3.m.fen=fb.upload(gl)[0];
  const fz=new MB();const fzd=gDisc(0.14,0.48,24);fz.add(fzd.P,fzd.N,[0.3,0.3,0.32],fzd.I,{R:rotX(-Math.PI/2),T:[-6.15,0.04,-0.55]});fz.add(fzd.P,fzd.N,[0.3,0.3,0.32],fzd.I,{R:rotX(Math.PI/2),T:[-6.15,-0.04,-0.55]});R3.m.fenBlur=fz.upload(gl)[0];
  const bl=new MB();const bx=gBox([2.8,0,0],[2.3,0.145,0.02]);bl.add(bx.P,bx.N,[0.22,0.22,0.24],bx.I);const tipm=gBox([5.05,0,0],[0.06,0.145,0.021]);bl.add(tipm.P,tipm.N,[0.9,0.85,0.2],tipm.I);
  const cuff=gBox([0.55,0,0],[0.3,0.11,0.06]);bl.add(cuff.P,cuff.N,dark,cuff.I);R3.m.blade=bl.upload(gl)[0];
  const hb=new MB();const hub=gCone(-0.12,0.30,0.12,0.30,10);hb.add(hub.P,hub.N,dark,hub.I,{R:UPX});const cap=gEll([0.16,0.16,0.14],8,5);hb.add(cap.P,cap.N,dark,cap.I,{T:[0,0,-0.2]});R3.m.hub=hb.upload(gl)[0];
  const db=new MB();const dd=gDisc(0.4,5.1,40);db.add(dd.P,dd.N,[0.6,0.6,0.62],dd.I);R3.m.disc=db.upload(gl)[0];
  const sb=new MB();const sd=gDisc(0,5.2,32);sb.add(sd.P,sd.N,[0.05,0.05,0.05],sd.I);R3.m.shadow=sb.upload(gl)[0];
  const cb=new MB();const cc=gCone(0,2.2,9,2.2,16,false);cb.add(cc.P,cc.N,[1.0,0.72,0.1],cc.I);R3.m.column=cb.upload(gl)[0];   // tutor target
  const rb=new MB();const rg=gDisc(4.2,8.5,40);rb.add(rg.P,rg.N,[0.72,0.68,0.5],rg.I);R3.m.wash=rb.upload(gl)[0];         // downwash ring
  const ph=new MB();const pl=gLoft([[3.4,0.06,0.06,0.2],[2.4,0.7,0.8,0.0],[0.8,0.8,0.9,-0.15],[-1.2,0.6,0.65,-0.25],[-2,0.4,0.4,-0.3],[-6.3,0.15,0.2,-0.4]],10);ph.add(pl.P,pl.N,[0.4,0.7,0.9],pl.I);R3.m.phantom=ph.upload(gl)[0];
}
/* ---- matrices (column-major mat4) ---- */
function m4persp(fov,asp,n,f){const t=1/Math.tan(fov/2);return new Float32Array([t/asp,0,0,0, 0,t,0,0, 0,0,(f+n)/(n-f),-1, 0,0,2*f*n/(n-f),0]);}
function m4mul(A,B){const C=new Float32Array(16);for(let i=0;i<4;i++)for(let j=0;j<4;j++){let s=0;for(let k=0;k<4;k++)s+=A[k*4+j]*B[i*4+k];C[i*4+j]=s;}return C;}
function m4view(C,f,u){const r=vnorm(vcross(f,u));const uu=vcross(r,f);return new Float32Array([r[0],uu[0],-f[0],0, r[1],uu[1],-f[1],0, r[2],uu[2],-f[2],0, -vdot(r,C),-vdot(uu,C),vdot(f,C),1]);}
function m4model(R,T){return new Float32Array([R[0],R[3],R[6],0, R[1],R[4],R[7],0, R[2],R[5],R[8],0, T[0],T[1],T[2],1]);}
const M4I=m4model([1,0,0,0,1,0,0,0,1],[0,0,0]);
function drawMesh(pr,m,M,alpha=1){const gl=R3.gl;gl.useProgram(pr.p);
  gl.bindBuffer(gl.ARRAY_BUFFER,m.vp);gl.enableVertexAttribArray(pr.a.aP);gl.vertexAttribPointer(pr.a.aP,3,gl.FLOAT,false,0,0);
  if(pr.a.aN>=0){gl.bindBuffer(gl.ARRAY_BUFFER,m.vn);gl.enableVertexAttribArray(pr.a.aN);gl.vertexAttribPointer(pr.a.aN,3,gl.FLOAT,false,0,0);}
  if(pr.a.aC>=0){gl.bindBuffer(gl.ARRAY_BUFFER,m.vc);gl.enableVertexAttribArray(pr.a.aC);gl.vertexAttribPointer(pr.a.aC,3,gl.FLOAT,false,0,0);}
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,m.ib);
  gl.uniformMatrix4fv(pr.u.uMVP,false,m4mul(R3.vp,M));if(pr.u.uM)gl.uniformMatrix4fv(pr.u.uM,false,M);
  gl.uniform3fv(pr.u.uSun,R3.sun);gl.uniform3fv(pr.u.uCam,R3.cam.pos);if(pr.u.uAlpha)gl.uniform1f(pr.u.uAlpha,alpha);
  gl.uniform3fv(pr.u.uFog,R3.fog);if(pr.u.uT)gl.uniform1f(pr.u.uT,R3.time);if(pr.u.uCloud)gl.uniform1f(pr.u.uCloud,cfg.cloud);if(pr.u.uWind)gl.uniform2fv(pr.u.uWind,R3.windXY||[0,0]);
  gl.drawElements(gl.TRIANGLES,m.n,gl.UNSIGNED_SHORT,0);}
/* ---- cameras ---- */
function cameraUpdate(dt){
  const c=R3.cam,R=qmat(S.q),[phi,th,psi]=S.eul;
  // head: the mouse sets a target, the camera follows with a 120 ms lag; on release both return forward
  const lk=DEV.look;if(!lk.on){lk.yawT=(lk.yawT||0)*Math.max(0,1-dt*6);lk.pitchT=(lk.pitchT||0)*Math.max(0,1-dt*6);}
  const kf=Math.min(1,dt/0.12);lk.yaw+=((lk.yawT||0)-lk.yaw)*kf;lk.pitch+=((lk.pitchT||0)-lk.pitch)*kf;
  if(cfg.view==='cockpit'){
    c.pos=vadd(S.pos,mrot(R,H.pilot.eye));
    // head yaw about the body vertical, then pitch; the default line of sight is 6° down
    const cy=Math.cos(lk.yaw),sy=Math.sin(lk.yaw),el=6*DEG-lk.pitch,ce=Math.cos(el),se=Math.sin(el);
    c.f=mrot(R,[ce*cy,ce*sy,se]);c.u=mrot(R,[se*cy,se*sy,-ce]);c.fov=64*DEG;
  }else if(cfg.view==='chase'){
    const vN=mrot(R,S.vb);const fast=Math.hypot(vN[0],vN[1])>12;
    const want=c.lockPsi!==undefined?c.lockPsi:fast?Math.atan2(vN[1],vN[0]):psi;   // lockPsi: fixed camera azimuth (screenshots)
    c.chasePsi+=wrapPi(want-c.chasePsi)*Math.min(1,dt*1.5);
    const az=c.chasePsi+lk.yaw,elv=clamp(0.32+lk.pitch,-0.05,1.3),dist=25;   // look around orbits the camera
    const back=[-Math.cos(az)*Math.cos(elv)*dist,-Math.sin(az)*Math.cos(elv)*dist,-Math.sin(elv)*dist];
    const tgt=vadd(S.pos,back);
    const hg=terrainH(tgt[0],tgt[1]);if(tgt[2]>-hg-1.5)tgt[2]=-hg-1.5;
    c.chasePos=c.chasePos?vadd(c.chasePos,vscl(vsub(tgt,c.chasePos),Math.min(1,dt*4))):tgt;
    c.pos=c.chasePos;c.f=vnorm(vsub(vadd(S.pos,[0,0,-1.5]),c.pos));c.u=[0,0,-1];c.fov=55*DEG;
  }else{
    c.pos=[-70,55,-(terrainH(-70,55)+12.6)];const d=vsub(S.pos,c.pos);const dist=vlen(d);
    c.f=vnorm(d);c.u=[0,0,-1];c.fov=clamp(2*Math.atan(22/dist),8*DEG,60*DEG);
  }
}
function project(w){const v=R3.vp;const x=v[0]*w[0]+v[4]*w[1]+v[8]*w[2]+v[12],y=v[1]*w[0]+v[5]*w[1]+v[9]*w[2]+v[13],z=v[2]*w[0]+v[6]*w[1]+v[10]*w[2]+v[14],ww=v[3]*w[0]+v[7]*w[1]+v[11]*w[2]+v[15];
  if(ww<=0.01)return null;return [(x/ww*0.5+0.5)*R3.w,(0.5-y/ww*0.5)*R3.h];}
function render(dt){
  const gl=R3.gl,cv=R3.canvas;R3.time+=dt;
  const W=cv.clientWidth|0,Hh=cv.clientHeight|0;if(cv.width!==W||cv.height!==Hh){cv.width=W;cv.height=Hh;}
  R3.w=W;R3.h=Hh;gl.viewport(0,0,W,Hh);
  cameraUpdate(dt);
  const c=R3.cam;R3.vp=m4mul(m4persp(c.fov,W/Hh,1.0,R3.far),m4view(c.pos,c.f,c.u));
  R3.sun=vnorm([0.45,-0.35,-0.82]);R3.fog=[0.74,0.80,0.88];R3.windXY=[S.wind[0],S.wind[1]];
  gl.clearColor(R3.fog[0],R3.fog[1],R3.fog[2],1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  // sky dome, centred on the camera, behind everything
  gl.depthMask(false);gl.disable(gl.CULL_FACE);drawMesh(R3.pr.sky,R3.m.sky,m4model([1,0,0,0,1,0,0,0,1],c.pos));gl.depthMask(true);gl.enable(gl.CULL_FACE);
  drawMesh(R3.pr.gnd,R3.m.ground,M4I);
  for(const m of R3.m.scene)drawMesh(R3.pr.lit,m,M4I);
  // windsock: points downwind, droops when calm
  {const w=S.wind,ws=Math.hypot(w[0],w[1]);const az=ws>0.2?Math.atan2(w[1],w[0]):WIND.dir*DEG+Math.PI;const droop=lerp(65*DEG,3*DEG,clamp(ws/7,0,1));
    const Rm=mmul(rotZ(az),rotY(-droop));drawMesh(R3.pr.lit,R3.m.sock,m4model(Rm,[35,-45,-terrainH(35,-45)-7]));}
  // wind turbines: face the wind, turn with it
  {const w=S.wind,ws=Math.hypot(w[0],w[1]);const az=ws>0.5?Math.atan2(-w[1],-w[0]):WIND.dir*DEG;R3.turb+=dt*clamp(ws/6,0.15,1)*1.3;
    for(const [n,e] of R3.turbines){drawMesh(R3.pr.lit,R3.m.turbine,m4model(mmul(rotZ(az),rotX(R3.turb)),[n,e,-terrainH(n,e)-60]));}}
  // the aircraft
  const R=qmat(S.q),rt=H.rotor;
  const cockpit=cfg.view==='cockpit';
  if(!cockpit){drawMesh(R3.pr.lit,R3.m.body,m4model(R,S.pos));}
  drawMesh(R3.pr.lit,R3.m.fen,m4model(R,S.pos));
  const hubW=vadd(S.pos,mrot(R,rt.hub)),Rh=mmul(R,rt.Rbh);
  drawMesh(R3.pr.lit,R3.m.hub,m4model(Rh,hubW));
  const st=S.rot;
  for(let k=0;k<rt.N;k++){const psi=st.psi+2*Math.PI*k/rt.N;const a=Math.atan2(-rt.s*Math.sin(psi),-Math.cos(psi));
    drawMesh(R3.pr.lit,R3.m.blade,m4model(mmul(Rh,mmul(rotZ(a),rotY(st.beta[k]))),hubW));}
  // rotor disc blur at the tip-path plane, Fenestron blur, the shadow, the phantom
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.disable(gl.CULL_FACE);
  if(st.Om>15){let b0=0,bc=0,bs=0;for(let k=0;k<rt.N;k++){const psi=st.psi+2*Math.PI*k/rt.N;b0+=st.beta[k];bc+=st.beta[k]*Math.cos(psi);bs+=st.beta[k]*Math.sin(psi);}
    b0/=rt.N;bc*=2/rt.N;bs*=2/rt.N;
    // tip-path plane: up(x,y) = b0 - bc x - s bs y in hub axes -> rotY(-bc) then rotX(s bs)
    const Rt=mmul(rotY(-bc),rotX(rt.s*bs));
    drawMesh(R3.pr.lit,R3.m.disc,m4model(mmul(Rh,Rt),vadd(hubW,mrot(Rh,[0,0,-2.5*Math.sin(b0)]))),clamp((st.Om-15)/25,0,1)*0.22);
    drawMesh(R3.pr.lit,R3.m.fenBlur,m4model(R,S.pos),clamp((st.Om-15)/25,0,1)*0.35);}
  // downwash on the ground: a pale ring that widens and fades with height, the eye's own ground-effect gauge
  if(st.Om>25&&S.hAGL<12&&S.hAGL>-0.5){const k=clamp(1-S.hAGL/12,0,1)*clamp(st.T/(S.m*9.81),0,1.2);const sc=1+S.hAGL*0.12;
    drawMesh(R3.pr.lit,R3.m.wash,m4model([sc,0,0,0,sc,0,0,0,1],[S.pos[0],S.pos[1],-terrainH(S.pos[0],S.pos[1])-0.1]),0.10*k*(0.85+0.15*Math.sin(R3.time*9)));}
  {const sun=R3.sun,hg=terrainH(S.pos[0],S.pos[1]),hAbove=-S.pos[2]-hg;const off=vscl([sun[0],sun[1],0],hAbove/Math.max(-sun[2],0.3));
    const sp=[S.pos[0]-off[0],S.pos[1]-off[1],-terrainH(S.pos[0]-off[0],S.pos[1]-off[1])-0.06];
    drawMesh(R3.pr.lit,R3.m.shadow,m4model([1,0,0,0,1,0,0,0,1],sp),clamp(0.45-hAbove*0.004,0.08,0.45));}
  if(UI.phantom&&UI.phantom.S){const P=UI.phantom.S;drawMesh(R3.pr.lit,R3.m.phantom,m4model(qmat(P.q),P.pos),0.45);}
  if(TUTOR.target){const [n,e]=TUTOR.target;const pulse=0.25+0.15*Math.sin(R3.time*3);drawMesh(R3.pr.lit,R3.m.column,m4model(UPX,[n,e,-terrainH(n,e)]),pulse);}
  gl.depthMask(true);gl.disable(gl.BLEND);gl.enable(gl.CULL_FACE);
}
